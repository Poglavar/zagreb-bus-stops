-- Zagreb 3D building footprints with height data for shade simulation
CREATE TABLE IF NOT EXISTS building (
    object_id integer PRIMARY KEY,
    z_min real,
    z_max real,
    z_delta real,
    geom geometry(Polygon, 4326),
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_building_geom ON building USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_building_z_delta ON building (z_delta);
