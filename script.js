// Basic setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('container').appendChild(renderer.domElement);

// UI Elements
const timeDisplay = document.getElementById('time-display');
const sunriseDisplay = document.getElementById('sunrise-display');
const sunsetDisplay = document.getElementById('sunset-display');
const pauseButton = document.getElementById('pause-button');
const statusEmoji = document.getElementById('status-emoji');
const timelineCanvas = document.getElementById('timeline-canvas');
const timelineCtx = timelineCanvas.getContext('2d');
const timelineSunriseLabel = document.getElementById('timeline-sunrise-label');
const timelineSunsetLabel = document.getElementById('timeline-sunset-label');
const timelineMarkersContainer = document.getElementById('timeline-markers');
const datePicker = document.getElementById('date-picker');

// Hide old labels
sunriseDisplay.style.display = 'none';
sunsetDisplay.style.display = 'none';

// --- State Management ---
let isPaused = false;
let isRotateMode = false;
let isDragging = false;
let previousMouseX = 0;
let simulationDate = new Date(); // New state for the simulation date

// Initialize date picker
datePicker.value = simulationDate.toISOString().split('T')[0];

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);

// Ground
const groundGeometry = new THREE.PlaneGeometry(300, 300);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- Bus Station Group (Shelter + Person) ---
const busStation = new THREE.Group();
scene.add(busStation);

// --- Buildings Group (loaded dynamically per stop) ---
const buildingsGroup = new THREE.Group();
scene.add(buildingsGroup);

// Shelter
const material = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, transparent: true, opacity: 0.8 });
const backWall = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 0.1), material);
backWall.position.set(0, 1, -1);
backWall.castShadow = true;
busStation.add(backWall);
const sideWall1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 2), material);
sideWall1.position.set(-2, 1, 0);
sideWall1.castShadow = true;
busStation.add(sideWall1);
const sideWall2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 2), material);
sideWall2.position.set(2, 1, 0);
sideWall2.castShadow = true;
busStation.add(sideWall2);
const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 2.2), material);
roof.position.set(0, 2.05, 0);
roof.castShadow = true;
busStation.add(roof);

// Person model
const person = new THREE.Group();
const bodyHeight = 1.6;
const personHeadRadius = 0.1;
const personMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.2, bodyHeight, 16);
const body = new THREE.Mesh(bodyGeometry, personMaterial);
body.position.y = bodyHeight / 2;
person.add(body);
const headGeometry = new THREE.SphereGeometry(personHeadRadius, 32, 32);
const head = new THREE.Mesh(headGeometry, personMaterial);
head.position.y = bodyHeight + personHeadRadius;
person.add(head);
person.position.set(0, 0, 0);
busStation.add(person); // Add person to the station group

// --- North Arrow (Static) ---
const northArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1), // Direction (North)
    new THREE.Vector3(0, 0.1, 0),  // Origin
    10,                           // Length
    0xff0000,                     // Color
    1.0,                          // Head Length
    0.3                           // Head Width
);
scene.add(northArrow);

// --- Lights & Sun ---
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.camera.top = 150;
sunLight.shadow.camera.bottom = -150;
sunLight.shadow.camera.left = -150;
sunLight.shadow.camera.right = 150;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);
const sunGeometry = new THREE.SphereGeometry(0.15, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sunSphere);

// --- Core Logic ---
const raycaster = new THREE.Raycaster();
const headPosition = new THREE.Vector3();
let lat = 45.8150; // Zagreb latitude
let lon = 15.9819; // Zagreb longitude

function updateSunPosition(date) {
    const sunPosition = SunCalc.getPosition(date, lat, lon);
    const altitude = sunPosition.altitude;
    const azimuth = sunPosition.azimuth; // Azimuth from south, westward

    // Convert azimuth/altitude to 3D vector in our scene (Y-up, -Z North)
    // Suncalc's azimuth is from South (0) to West (PI/2).
    // Our scene's South is +Z, West is -X.
    const sunDirection = new THREE.Vector3(
        Math.cos(altitude) * -Math.sin(azimuth),
        Math.sin(altitude),
        Math.cos(altitude) * Math.cos(azimuth)
    );

    sunLight.position.copy(sunDirection).multiplyScalar(200);
    sunLight.target = busStation;
    sunSphere.position.copy(sunDirection).multiplyScalar(50);
}

function checkHeadInShade() {
    head.getWorldPosition(headPosition);
    const sunDirection = new THREE.Vector3().subVectors(sunSphere.position, headPosition).normalize();
    raycaster.set(headPosition, sunDirection);
    const shadeObjects = [...busStation.children, ...buildingsGroup.children];
    const intersects = raycaster.intersectObjects(shadeObjects);
    return intersects.length > 0;
}

// --- Timeline Logic ---
let lastShadeStatus = null;
let lastProgress = 0;

function formatTime(date) {
    return date.toTimeString().split(' ')[0].substring(0, 5);
}

function resetTimeline(sunrise, sunset) {
    const canvas = timelineCtx.canvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    timelineCtx.clearRect(0, 0, canvas.width, canvas.height);
    timelineMarkersContainer.innerHTML = '';
    timelineSunriseLabel.textContent = `Izlazak sunca: ${formatTime(sunrise)}`;
    timelineSunsetLabel.textContent = `Zalazak sunca: ${formatTime(sunset)}`;
    lastShadeStatus = null;
    lastProgress = 0;
}

function drawOnTimeline(progress, isShaded) {
    const canvas = timelineCtx.canvas;
    const x = progress * canvas.width;
    timelineCtx.strokeStyle = isShaded ? 'lime' : 'red';
    timelineCtx.lineWidth = 2;
    timelineCtx.beginPath();
    timelineCtx.moveTo(x, 0);
    timelineCtx.lineTo(x, canvas.height);
    timelineCtx.stroke();
}

function addTimelineMarker(progress, timeString) {
    const marker = document.createElement('div');
    marker.className = 'timeline-marker';
    marker.textContent = timeString.substring(0, 5);
    marker.style.left = `${progress * 100}%`;
    timelineMarkersContainer.appendChild(marker);
    const canvas = timelineCtx.canvas;
    const x = progress * canvas.width;
    timelineCtx.strokeStyle = 'black';
    timelineCtx.lineWidth = 2;
    timelineCtx.beginPath();
    timelineCtx.moveTo(x, 0);
    timelineCtx.lineTo(x, canvas.height);
    timelineCtx.stroke();
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (isPaused) {
        controls.update();
        renderer.render(scene, camera);
        return;
    }

    const times = SunCalc.getTimes(simulationDate, lat, lon);
    const sunrise = times.sunrise.getTime();
    const sunset = times.sunset.getTime();
    const animationDuration = 10000;
    const progress = (Date.now() % animationDuration) / animationDuration;
    const time = new Date(sunrise + (sunset - sunrise) * progress);

    if (progress < lastProgress) {
        resetTimeline(times.sunrise, times.sunset);
    }
    lastProgress = progress;

    updateSunPosition(time);

    // Update UI
    const timeString = formatTime(time);
    timeDisplay.textContent = `Vrijeme: ${timeString}`;

    const isShaded = checkHeadInShade();
    statusEmoji.textContent = isShaded ? '😊' : '😞';

    // Update Timeline
    drawOnTimeline(progress, isShaded);
    if (lastShadeStatus !== null && isShaded !== lastShadeStatus) {
        addTimelineMarker(progress, timeString);
    }
    lastShadeStatus = isShaded;

    controls.update();
    renderer.render(scene, camera);
}

// --- Event Listeners ---
pauseButton.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? 'Nastavi' : 'Pauza';
});

// Info panel toggle (collapsed by default on mobile)
const infoToggle = document.getElementById('info-toggle');
const infoContainer = document.getElementById('info-container');
if (window.matchMedia('(max-width: 600px)').matches) {
    infoContainer.classList.add('hidden');
}
infoToggle.addEventListener('click', () => {
    infoContainer.classList.toggle('hidden');
});

// Share button: copies the current URL (with ?id=<id>) to the clipboard.
const shareToggle = document.getElementById('share-toggle');
shareToggle.addEventListener('click', async () => {
    if (currentStop?.id != null) {
        history.replaceState(null, '', `${location.pathname}?id=${currentStop.id}`);
    }
    try {
        await navigator.clipboard.writeText(location.href);
        const original = shareToggle.textContent;
        shareToggle.textContent = '✓';
        shareToggle.classList.add('copied');
        setTimeout(() => {
            shareToggle.textContent = original;
            shareToggle.classList.remove('copied');
        }, 1500);
    } catch (err) {
        console.error('clipboard write failed:', err);
    }
});

datePicker.addEventListener('input', (event) => {
    simulationDate = new Date(event.target.value);
    // The date from the picker is UTC midnight, so adjust to local noon to avoid timezone issues.
    simulationDate.setMinutes(simulationDate.getMinutes() + simulationDate.getTimezoneOffset());
    const times = SunCalc.getTimes(simulationDate, lat, lon);
    resetTimeline(times.sunrise, times.sunset);
});

renderer.domElement.addEventListener('click', () => {
    if (isDragging) return; // Don't toggle mode if we just finished a drag
    isRotateMode = !isRotateMode;
    controls.enabled = !isRotateMode;
    renderer.domElement.style.cursor = isRotateMode ? 'ew-resize' : 'auto';
});

renderer.domElement.addEventListener('mousemove', (event) => {
    if (!isRotateMode) return;

    // Get intersection point on the ground plane
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(ground);

    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        // Calculate angle from center to mouse point and set station rotation
        const angle = Math.atan2(
            intersectionPoint.x - busStation.position.x,
            intersectionPoint.z - busStation.position.z
        );
        busStation.rotation.y = angle;
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const canvas = timelineCtx.canvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}, false);

animate();

// --- Bus Stop Data & Station Selector ---
const stationSearch = document.getElementById('station-search');
const stationDropdown = document.getElementById('station-dropdown');
const infoPosition = document.getElementById('info-position');
const infoLat = document.getElementById('info-lat');
const infoLon = document.getElementById('info-lon');
const infoFacing = document.getElementById('info-facing');

let busStops = [];
let highlightedIndex = -1;

function cardinalDir(deg) {
    const dirs = ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'];
    return dirs[Math.round(deg / 45) % 8];
}

function orientationToRotationY(orientationDeg) {
    return Math.PI - (orientationDeg * Math.PI / 180);
}

// --- Building Loading & Rendering ---
const BUILDING_RADIUS = 100; // meters
const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4c4a8,
    transparent: true,
    opacity: 0.85
});

// Convert WGS84 lat/lon to local scene coordinates (meters from center)
// In the scene: +X = East, -Z = North, Y = up
function geoToLocal(lon, lat, centerLon, centerLat) {
    const DEG_TO_RAD = Math.PI / 180;
    const R = 6371000; // Earth radius in meters
    const cosLat = Math.cos(centerLat * DEG_TO_RAD);
    const dx = (lon - centerLon) * DEG_TO_RAD * R * cosLat; // East-West in meters
    const dz = -(lat - centerLat) * DEG_TO_RAD * R;         // North-South (negated: +lat = north = -Z)
    return { x: dx, z: dz };
}

function clearBuildings() {
    while (buildingsGroup.children.length > 0) {
        const mesh = buildingsGroup.children[0];
        mesh.geometry.dispose();
        buildingsGroup.remove(mesh);
    }
}

function createBuildingMesh(polygon, zDelta, centerLon, centerLat) {
    // polygon.coordinates[0] is the outer ring: [[lon, lat], ...]
    const ring = polygon.coordinates[0];
    const shape = new THREE.Shape();

    for (let i = 0; i < ring.length; i++) {
        const p = geoToLocal(ring[i][0], ring[i][1], centerLon, centerLat);
        if (i === 0) {
            shape.moveTo(p.x, -p.z); // Shape is 2D (x, y), we'll rotate to XZ plane
        } else {
            shape.lineTo(p.x, -p.z);
        }
    }

    const height = Math.max(zDelta || 3, 1); // minimum 1m height
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false
    });

    // ExtrudeGeometry extrudes along +Z by default.
    // We need to rotate it so extrusion goes along +Y (up).
    geometry.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geometry, buildingMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

let buildingFetchController = null;

function loadBuildings(lat, lon) {
    // Abort any in-flight request
    if (buildingFetchController) {
        buildingFetchController.abort();
    }
    buildingFetchController = new AbortController();

    clearBuildings();

    const isLocal = !window.location.hostname.includes('zagreb.lol');
    const apiBase = isLocal ? `http://${window.location.hostname}:3001/api` : '/bus-stop-shade/api';
    fetch(`${apiBase}/buildings-bus?lat=${lat}&lon=${lon}&radius=${BUILDING_RADIUS}`, {
        signal: buildingFetchController.signal
    })
        .then(r => r.json())
        .then(data => {
            console.log(`Loaded ${data.features.length} buildings within ${BUILDING_RADIUS}m`);
            for (const feature of data.features) {
                const geom = feature.geometry;
                const zDelta = feature.properties.z_delta;

                if (geom.type === 'Polygon') {
                    const mesh = createBuildingMesh(geom, zDelta, lon, lat);
                    buildingsGroup.add(mesh);
                } else if (geom.type === 'MultiPolygon') {
                    for (const polygonCoords of geom.coordinates) {
                        const polygon = { type: 'Polygon', coordinates: polygonCoords };
                        const mesh = createBuildingMesh(polygon, zDelta, lon, lat);
                        buildingsGroup.add(mesh);
                    }
                }
            }
        })
        .catch(err => {
            if (err.name !== 'AbortError') {
                console.warn('Could not load buildings:', err);
            }
        });
}

// Tracks the currently selected stop so the share button can link to it.
let currentStop = null;

function selectStop(stop) {
    currentStop = stop;
    lat = stop.lat;
    lon = stop.lon;
    busStation.rotation.y = orientationToRotationY(stop.orientationDeg);

    // Reset timeline for new position
    const times = SunCalc.getTimes(simulationDate, lat, lon);
    resetTimeline(times.sunrise, times.sunset);

    // Update info panel
    infoPosition.textContent = stop.name;
    infoLat.textContent = stop.lat.toFixed(4);
    infoLon.textContent = stop.lon.toFixed(4);
    infoFacing.textContent = `${cardinalDir(stop.orientationDeg)} (${stop.orientationDeg}°)`;

    stationSearch.value = stop.displayName;
    stationDropdown.style.display = 'none';

    // Mirror the selection into the URL so the stop is shareable.
    if (stop.id != null) {
        history.replaceState(null, '', `${location.pathname}?id=${stop.id}`);
    }

    // Load surrounding buildings for shade calculation
    loadBuildings(stop.lat, stop.lon);
}

function renderDropdown(matches) {
    stationDropdown.innerHTML = '';
    highlightedIndex = -1;
    if (matches.length === 0) {
        stationDropdown.style.display = 'none';
        return;
    }
    const shown = matches.slice(0, 50);
    shown.forEach((stop, i) => {
        const div = document.createElement('div');
        div.className = 'station-option';
        div.innerHTML = `${stop.displayName}<br><span class="station-meta">${stop.roadDistanceM}m od ceste · smjer ${cardinalDir(stop.orientationDeg)}</span>`;
        div.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectStop(stop);
        });
        stationDropdown.appendChild(div);
    });
    if (matches.length > 50) {
        const more = document.createElement('div');
        more.className = 'station-option station-meta';
        more.textContent = `... i još ${matches.length - 50}. Nastavite tipkati za suženje pretrage.`;
        stationDropdown.appendChild(more);
    }
    stationDropdown.style.display = 'block';
}

stationSearch.addEventListener('input', () => {
    const query = stationSearch.value.toLowerCase().trim();
    if (query.length < 2) {
        stationDropdown.style.display = 'none';
        return;
    }
    const matches = busStops.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.displayName.toLowerCase().includes(query)
    );
    renderDropdown(matches);
});

stationSearch.addEventListener('focus', () => {
    if (stationSearch.value.length >= 2) {
        stationSearch.dispatchEvent(new Event('input'));
    }
});

stationSearch.addEventListener('blur', () => {
    setTimeout(() => { stationDropdown.style.display = 'none'; }, 150);
});

stationSearch.addEventListener('keydown', (e) => {
    const options = stationDropdown.querySelectorAll('.station-option:not(.station-meta)');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
        options.forEach((o, i) => o.classList.toggle('highlighted', i === highlightedIndex));
        if (options[highlightedIndex]) options[highlightedIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        options.forEach((o, i) => o.classList.toggle('highlighted', i === highlightedIndex));
        if (options[highlightedIndex]) options[highlightedIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            options[highlightedIndex].dispatchEvent(new MouseEvent('mousedown'));
        }
    } else if (e.key === 'Escape') {
        stationDropdown.style.display = 'none';
        stationSearch.blur();
    }
});

// Translate English cardinal abbreviations baked into displayName to Croatian
const CARDINAL_EN_TO_HR = {
    'NE': 'SI', 'NW': 'SZ', 'SE': 'JI', 'SW': 'JZ',
    'N': 'S', 'S': 'J', 'E': 'I', 'W': 'Z'
};
function translateDisplayName(name) {
    return name.replace(/→(NE|NW|SE|SW|N|S|E|W)/g, (_, d) => `→${CARDINAL_EN_TO_HR[d]}`);
}

// Load bus stop data
fetch('data/zagreb-bus-stops.json')
    .then(r => r.json())
    .then(data => {
        busStops = data.map(s => ({ ...s, displayName: translateDisplayName(s.displayName) }));
        console.log(`Loaded ${busStops.length} bus stops`);
        stationSearch.placeholder = `Pretraži ${busStops.length} stajališta...`;

        // Prefer a stop from ?id=<id> so shared links land on the right stop;
        // fall back to Selska (→Z) as the default landing stop.
        const requestedId = parseInt(new URLSearchParams(location.search).get('id'), 10);
        const initialStop = (Number.isFinite(requestedId) && busStops.find(s => s.id === requestedId))
            || busStops.find(s => s.displayName === 'Selska (→Z)');
        if (initialStop) selectStop(initialStop);
    })
    .catch(err => {
        console.warn('Could not load bus stop data:', err);
        stationSearch.placeholder = 'Podaci o stajalištima nisu dostupni';
        stationSearch.disabled = true;
    });