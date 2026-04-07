// Import Zagreb 3D building footprints from GeoJSON into PostGIS.
// Usage: node scripts/import-buildings.js <path-to-geojson>
// Reads the GeoJSON, extracts height data, and batch-inserts into the building table.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BATCH_SIZE = 1000;

async function main() {
    const geojsonPath = process.argv[2];
    if (!geojsonPath) {
        console.log('Usage: node scripts/import-buildings.js <path-to-geojson>');
        console.log('Example: node scripts/import-buildings.js ../zagreb-3d/inputs-zagreb/ZG3D_2022_3d_model_GZ_-7099510407498302587.geojson');
        process.exit(0);
    }

    const absPath = path.resolve(geojsonPath);
    if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`);
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Create table if needed
    const ddl = fs.readFileSync(path.join(__dirname, '..', 'db', 'building.sql'), 'utf8');
    await pool.query(ddl);
    console.log('Table building ready');

    // Check existing count
    const { rows: [{ count: existingCount }] } = await pool.query('SELECT count(*)::int as count FROM building');
    if (existingCount > 0) {
        console.log(`Table already has ${existingCount} rows. Truncating...`);
        await pool.query('TRUNCATE building');
    }

    console.log(`Reading ${absPath}...`);
    const raw = fs.readFileSync(absPath, 'utf8');
    const geojson = JSON.parse(raw);
    const features = geojson.features;
    console.log(`Parsed ${features.length} features`);

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < features.length; i += BATCH_SIZE) {
        const batch = features.slice(i, i + BATCH_SIZE);
        const values = [];
        const params = [];
        let paramIdx = 1;

        for (const f of batch) {
            const props = f.properties;
            const geomType = f.geometry.type;

            // Only handle Polygon; for MultiPolygon take the largest ring
            let polygon;
            if (geomType === 'Polygon') {
                polygon = f.geometry;
            } else if (geomType === 'MultiPolygon') {
                // Pick the polygon with the most coordinates (largest footprint)
                let maxCoords = 0;
                let bestIdx = 0;
                for (let pi = 0; pi < f.geometry.coordinates.length; pi++) {
                    const coordCount = f.geometry.coordinates[pi][0].length;
                    if (coordCount > maxCoords) {
                        maxCoords = coordCount;
                        bestIdx = pi;
                    }
                }
                polygon = {
                    type: 'Polygon',
                    coordinates: f.geometry.coordinates[bestIdx]
                };
            } else {
                skipped++;
                continue;
            }

            // Strip Z coordinates from polygon (we store height separately)
            const coords2d = polygon.coordinates.map(ring =>
                ring.map(([lon, lat]) => [lon, lat])
            );
            const geom2d = { type: 'Polygon', coordinates: coords2d };

            values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, ST_SetSRID(ST_GeomFromGeoJSON($${paramIdx + 4}), 4326))`);
            params.push(props.OBJECTID, props.Z_Min, props.Z_Max, props.Z_Delta, JSON.stringify(geom2d));
            paramIdx += 5;
        }

        if (values.length > 0) {
            const sql = `INSERT INTO building (object_id, z_min, z_max, z_delta, geom) VALUES ${values.join(', ')} ON CONFLICT (object_id) DO NOTHING`;
            await pool.query(sql, params);
            inserted += values.length;
        }

        if ((i + BATCH_SIZE) % 10000 < BATCH_SIZE) {
            console.log(`${new Date().toISOString()} Inserted ${inserted}/${features.length} (skipped ${skipped})`);
        }
    }

    console.log(`Done. Inserted ${inserted}, skipped ${skipped}`);
    await pool.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
