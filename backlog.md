# Backlog

## Phase 1 – Real Bus Stop Data with Orientation

Fetch real Zagreb bus stop data (coordinates + names) from OpenStreetMap via Overpass API. Deduce each stop's orientation by finding the adjacent road segment and computing its bearing. The shelter's open side faces the road. Store results as a static JSON file. Enrich the frontend with a searchable dropdown so users can pick a real station, placing the 3D shelter at the correct orientation for a realistic simulation.

**Difficulty: ⭐⭐⭐ Medium-Hard**
- Overpass query design is straightforward; the geometry math for orientation (nearest road segment, bearing, perpendicular toward road) requires care.
- UI integration (search/autocomplete, wiring selected stop into the 3D scene) is moderate.
- Edge cases: stops with no nearby road, stops at intersections, one-way vs two-way roads.

## Phase 2 – Headless Shade Calculation API

Create a headless (non-rendering) version of the shade calculation. Accepts station location, orientation, and date as parameters. Returns shading status over the day — either a combined score (% of daylight hours shaded) or an array of intervals at configurable resolution (e.g., every 5 minutes). Uses SunCalc + raycasting logic extracted from the existing frontend code, but without Three.js rendering.

**Difficulty: ⭐⭐⭐ Medium**
- Core sun math (SunCalc) is already working; needs extraction from the animation loop.
- Raycasting can be done with a minimal Three.js scene (no renderer needed, or use a simple geometric intersection).
- Main challenge: decoupling the shade logic from the DOM and animation frame loop.

## Phase 3 – City-Wide Shade Statistics

Using Phase 2's headless API, run shade calculations across all Zagreb bus stops for representative dates (solstices, equinoxes, peak summer). Produce rankings: worst stations (most sun exposure during commute hours), best stations, seasonal comparisons. Output as a data file and/or a dashboard page.

**Difficulty: ⭐⭐ Easy-Medium**
- Straightforward batch processing once Phase 2 is solid.
- Main work is choosing meaningful metrics and presenting results.
- Could be compute-intensive if running thousands of stops × many dates, but parallelizable.

## Phase 4 – 3D Surrounding Buildings / Terrain

Add surrounding 3D building geometry around the selected stop. Use the existing building mesh endpoint (from the cadastre-data / zagreb-buildings ecosystem) to fetch nearby buildings and render them in the Three.js scene. This would show realistic shadow interactions — a tall building south of a stop might shade it all morning.

**Difficulty: ⭐⭐⭐⭐ Hard**
- Need to fetch, parse, and render 3D building meshes (GeoJSON polygons → extruded Three.js geometry).
- Coordinate system conversion (WGS84 → local meters centered on the stop).
- Performance: rendering many buildings while maintaining interactive frame rates.
- Shadow mapping must work across a much larger scene.

## Phase 5 – Road Grid Overlay

Display the road network as lines/outlines on the ground plane around the selected station. Gives spatial context without the complexity of full building geometry. Roads would be drawn as flat lines on the surface.

**Difficulty: ⭐⭐ Easy-Medium**
- Road geometry is already fetched in Phase 1 (or easily re-queried from Overpass).
- Just project road node coordinates onto the ground plane as Three.js Line objects.
- Coordinate conversion same as Phase 4 but simpler (2D lines, no extrusion).
