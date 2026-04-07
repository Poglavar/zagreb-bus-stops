// Express API server for bus stop shade simulator.
// Serves static frontend files and provides a /api/buildings endpoint
// that returns building footprints within a radius of a given lat/lon.

const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 3001;

// Serve static files from project root
app.use(express.static('.'));

// GET /api/buildings?lat=45.81&lon=15.98&radius=100
// Returns GeoJSON FeatureCollection of buildings within radius (meters)
app.get('/api/buildings', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const radius = parseFloat(req.query.radius) || 100;

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: 'lat and lon are required' });
    }

    if (radius < 1 || radius > 500) {
        return res.status(400).json({ error: 'radius must be between 1 and 500 meters' });
    }

    try {
        const result = await pool.query(`
            SELECT
                object_id,
                z_min,
                z_max,
                z_delta,
                ST_AsGeoJSON(geom)::json AS geometry
            FROM building
            WHERE ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
            )
        `, [lon, lat, radius]);

        const features = result.rows.map(row => ({
            type: 'Feature',
            properties: {
                object_id: row.object_id,
                z_min: row.z_min,
                z_max: row.z_max,
                z_delta: row.z_delta
            },
            geometry: row.geometry
        }));

        res.json({
            type: 'FeatureCollection',
            features
        });
    } catch (err) {
        console.error(`${new Date().toISOString()} Error querying buildings:`, err.message);
        res.status(500).json({ error: 'Database query failed' });
    }
});

app.listen(PORT, () => {
    console.log(`${new Date().toISOString()} Server running on http://localhost:${PORT}`);
});
