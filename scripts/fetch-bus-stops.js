#!/usr/bin/env node

// Fetch Zagreb bus stops from Overpass API and calculate shelter orientations
// by finding the nearest road segment for each stop.
//
// Usage: node scripts/fetch-bus-stops.js
// Output: data/zagreb-bus-stops.json

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ZAGREB_BBOX = '45.72,15.82,45.87,16.17';
const MAX_ROAD_DISTANCE = 50; // meters

async function queryOverpass(query) {
    const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Overpass API error ${response.status}: ${text.slice(0, 200)}`);
    }
    return response.json();
}

// Single query: get bus stops, then roads within 50m of any stop, plus road nodes
async function fetchStopsAndRoads() {
    const query = `
[out:json][timeout:300][bbox:${ZAGREB_BBOX}];
(
  node["highway"="bus_stop"];
  node["public_transport"="platform"]["bus"="yes"];
)->.stops;
.stops out body;
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|bus_guideway)$"](around.stops:${MAX_ROAD_DISTANCE});
out body;
>;
out skel qt;
`;
    console.log('Querying Overpass API (this may take a minute)...');
    const data = await queryOverpass(query);
    console.log(`Received ${data.elements.length} elements`);

    const stops = [];
    const wayList = [];
    const nodeMap = new Map(); // id -> {lat, lon}

    for (const el of data.elements) {
        if (el.type === 'node') {
            nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
            const isBusStop = el.tags?.highway === 'bus_stop' ||
                (el.tags?.public_transport === 'platform' && el.tags?.bus === 'yes');
            if (isBusStop) {
                stops.push({
                    id: el.id,
                    name: el.tags?.name || el.tags?.['name:hr'] || el.tags?.ref || `Stop ${el.id}`,
                    lat: el.lat,
                    lon: el.lon,
                    tags: el.tags || {}
                });
            }
        } else if (el.type === 'way') {
            wayList.push(el);
        }
    }

    // Resolve way node coordinates
    const roads = wayList.map(way => ({
        id: way.id,
        tags: way.tags || {},
        nodes: way.nodes.map(nid => nodeMap.get(nid)).filter(Boolean)
    })).filter(r => r.nodes.length >= 2);

    return { stops, roads };
}

// Haversine distance in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Closest point on segment AB to point P (flat-earth approx, fine for <100m)
function closestPointOnSegment(p, a, b) {
    const cosLat = Math.cos(p.lat * Math.PI / 180);
    const px = (p.lon - a.lon) * cosLat;
    const py = p.lat - a.lat;
    const bx = (b.lon - a.lon) * cosLat;
    const by = b.lat - a.lat;
    const lenSq = bx * bx + by * by;
    if (lenSq === 0) {
        return { lat: a.lat, lon: a.lon, t: 0, dist: haversineDistance(p.lat, p.lon, a.lat, a.lon) };
    }
    const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
    const cLat = a.lat + t * (b.lat - a.lat);
    const cLon = a.lon + t * (b.lon - a.lon);
    return { lat: cLat, lon: cLon, t, dist: haversineDistance(p.lat, p.lon, cLat, cLon) };
}

// Geographic bearing in degrees (0=N, 90=E, 180=S, 270=W)
function bearingDeg(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
        Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// For each stop, find nearest road segment and compute orientation
function calculateOrientations(stops, roads) {
    return stops.map(stop => {
        let minDist = Infinity;
        let bestA = null, bestB = null;

        for (const road of roads) {
            for (let i = 0; i < road.nodes.length - 1; i++) {
                const a = road.nodes[i];
                const b = road.nodes[i + 1];
                const c = closestPointOnSegment(stop, a, b);
                if (c.dist < minDist) {
                    minDist = c.dist;
                    bestA = a;
                    bestB = b;
                }
            }
        }

        let orientationDeg = 0;

        if (minDist <= MAX_ROAD_DISTANCE && bestA && bestB) {
            // Road bearing along the segment
            const roadBearing = bearingDeg(bestA.lat, bestA.lon, bestB.lat, bestB.lon);

            // Cross product to determine which side of the road the stop is on
            const cosLat = Math.cos(stop.lat * Math.PI / 180);
            const rdx = (bestB.lon - bestA.lon) * cosLat;
            const rdy = bestB.lat - bestA.lat;
            const sdx = (stop.lon - bestA.lon) * cosLat;
            const sdy = stop.lat - bestA.lat;
            const cross = rdx * sdy - rdy * sdx;

            // Perpendicular toward the road
            // cross > 0 → stop is left of A→B → road is to the right → face roadBearing + 90
            // cross < 0 → stop is right of A→B → road is to the left → face roadBearing - 90
            if (cross > 0) {
                orientationDeg = (roadBearing + 90) % 360;
            } else if (cross < 0) {
                orientationDeg = (roadBearing - 90 + 360) % 360;
            } else {
                // Exactly on the road line — face along the road
                orientationDeg = roadBearing;
            }
        }

        return {
            id: stop.id,
            name: stop.name,
            lat: stop.lat,
            lon: stop.lon,
            orientationDeg: Math.round(orientationDeg * 10) / 10,
            roadDistanceM: Math.round(minDist * 10) / 10
        };
    });
}

// Cardinal direction label
function cardinalDir(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}

async function main() {
    const { stops, roads } = await fetchStopsAndRoads();
    console.log(`Parsed ${stops.length} bus stops, ${roads.length} road segments`);

    console.log('Calculating orientations...');
    const results = calculateOrientations(stops, roads);

    const matched = results.filter(s => s.roadDistanceM <= MAX_ROAD_DISTANCE);
    const unmatched = results.filter(s => s.roadDistanceM > MAX_ROAD_DISTANCE);
    console.log(`${matched.length} stops matched to a road, ${unmatched.length} without nearby road`);

    // Make display names unique by appending facing direction for duplicates
    const nameCounts = {};
    for (const s of results) nameCounts[s.name] = (nameCounts[s.name] || 0) + 1;
    for (const s of results) {
        if (nameCounts[s.name] > 1) {
            s.displayName = `${s.name} (→${cardinalDir(s.orientationDeg)})`;
        } else {
            s.displayName = s.name;
        }
    }

    results.sort((a, b) => a.name.localeCompare(b.name, 'hr'));

    const outDir = join(__dirname, '..', 'data');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'zagreb-bus-stops.json');
    writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`Wrote ${results.length} stops to ${outPath}`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
