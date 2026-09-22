<!-- Purpose: critical audit and prioritized execution plan for the Zagreb stop-shade simulator. -->

# Next steps — zagreb-stanice

Audit date: 2026-09-22. Scope: OSM acquisition/orientation derivation, checked-in stop data, 3D shade model, building API integration, search and interaction. Branch/head: `main` at `4460c63ba9e175c204d732d01370d9d42395f70c`. The worktree was clean before this report.

Validation: no automated tests or package test setup were found. A local measurement of `data/bus-stops.json` found 1,849 records with non-null name, coordinates, inferred orientation, road distance, and display name. That measures the checked-in file only, not current OSM or production API coverage.

## Product assessment

The 3D interaction is an appealing way to ask a concrete question: when would a generic shelter cast shade? It currently risks answering a different question as if it were factual. The source query collects bus stops only (`scripts/fetch-bus-stops.js:31-43`), although the page describes bus and tram stops (`index.html:8-18`). It does not establish that a real shelter exists, its shape, orientation, glazing, roof, tree cover, or nearby transient shade. The rendered shelter is a fixed generic model (`script.js:60-77`).

The repository should present itself as a what-if simulator until real shelter inventory and orientation evidence exist.

Priority scale: **P0** is reserved for a demonstrated severe exploit, data loss, or urgent operational/publication blocker; none was confirmed. **P1** is a material correctness or core-purpose issue. **P2** covers hardening, usability, maintainability and feature work.

## Prioritized work

### P1 — Never translate missing building data into “sunny”

**Confirmed bug.** Nearby buildings load from `/buildings-bus`; response status is not checked and failure only reaches the console (`script.js:410-447`). The shade test then runs against whatever geometry is present (`script.js:150-156`).

**Impact.** An outage, partial response, or malformed payload can remove surrounding shade and yield a confident false negative.

**Fix.** Model loading as `pending`, `complete`, `partial`, or `failed`; validate response and coverage. Suppress the shade verdict unless required geometry is complete, and show retry/last-success information.

**Acceptance.** Offline, 500, empty, malformed and partial-building fixtures cannot render “not in shade”; each displays an explicit unknown state.

### P1 — Align the claim with observed assets

**Confirmed mismatch.** The acquisition query includes only `highway=bus_stop` and bus platforms (`scripts/fetch-bus-stops.js:31-43`). Shelter geometry/presence is not acquired. The UI's fixed 4 m model is therefore hypothetical.

**Fix.** Either rename the experience to a generic shelter-placement simulator, or build a sourced stop-asset registry: mode, shelter presence/type, roof polygon/dimensions, orientation source, survey date and confidence. Add tram platforms explicitly if the product continues to claim them.

**Acceptance.** Every selected stop shows mode, asset source/date and confidence; real-world shade claims appear only for verified assets. Coverage totals report verified/unknown/no-shelter separately.

### P2 — Treat inferred orientation as uncertain

**Confirmed behavior.** Orientation is derived from the nearest generic road segment and which side contains the stop (`scripts/fetch-bus-stops.js:119-171`); default starts at 0°. It is not shelter orientation. Duplicate display names are disambiguated only by cardinal direction (`scripts/fetch-bus-stops.js:188-201`).

**Impact.** Curved roads, platforms away from carriageways, same-side bays, and terminals can produce wrong headings or ambiguous choices.

**Fix.** Store `orientation_source`, confidence, matched road ID/distance and unknown state. Prefer surveyed shelter bearings; expose manual rotation as a scenario and update the displayed value when rotated.

**Acceptance.** Unknown/low-confidence orientation is visible and excluded from factual summaries; a labeled validation sample reports angular error; selected labels are unique by stable stop ID.

### P2 — Improve geometry validity

`createBuildingMesh` handles an outer ring but not holes, and missing/falsey height falls back to an invented 3 m (`script.js:375-405`). Courtyards can cast solid shadows and unknown height can look measured.

**Fix.** Support polygon holes/multipolygons, preserve source height and confidence, and distinguish assumed from measured height. Add fixture scenes with a courtyard, multipolygon, missing height and overlapping footprints.

**Acceptance.** The fixtures yield expected ray intersections and the UI reports the share of shade-relevant buildings with assumed heights.

### P2 — Make search and 3D controls accessible and safe

The custom search uses `<div>` results and `innerHTML` with upstream OSM names (`script.js:481-552`), without combobox/listbox semantics. Controls are mostly mouse-oriented; the details toggle does not expose expanded state; animation continues rendering continuously and lacks a reduced-motion policy (`script.js:206-245`).

**Fix.** Render names with `textContent`, implement an accessible combobox or native list, use pointer/keyboard controls, add `aria-expanded`, and provide a static/paused default under reduced motion.

**Acceptance.** Keyboard-only selection/rotation/date changes work; hostile-name fixtures cannot inject markup; screen-reader state is announced; reduced-motion mode does not autoplay.

### P2 — Useful features

Add a seasonal shade calendar, “best shelter orientation” scenario, coverage/confidence map, tree-canopy layer with separate provenance, and a printable list of high-exposure verified stops. Keep simulated improvements visually distinct from observed conditions.

## Data and operations

- Add source timestamp, OSM replication/version, query bounds, feature counts, unmatched counts and schema version to the JSON. Preserve unknown as null instead of 0.
- Pin or self-host Three.js and SunCalc; current CDN scripts lack SRI (`index.html:64-66`).
- Add unit tests for query normalization/orientation and deterministic scene fixtures for solar/raycast logic, plus an API contract test. Local data does not establish deployed API freshness.

## Sensible execution order

1. Block verdicts on incomplete buildings and narrow the product claim.
2. Add verified asset/orientation provenance and tram coverage or remove that claim.
3. Test geometry/solar behavior and accessible controls.
4. Add confidence-aware planning features.
