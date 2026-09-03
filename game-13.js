(() => {
  const canvas = document.getElementById("racer-canvas");
  const ctx = canvas.getContext("2d");

  const lapEl = document.getElementById("racer-lap");
  const timeEl = document.getElementById("racer-time");
  const speedEl = document.getElementById("racer-speed");
  const bestEl = document.getElementById("racer-best");
  const statusEl = document.getElementById("racer-status");
  const goButton = document.getElementById("racer-go");
  const goLabel = document.getElementById("racer-go-label");
  const difficultyButtons = [...document.querySelectorAll("[data-racer-difficulty]")];
  const settings = document.querySelector(".racer-settings");
  const carButtons = [...document.querySelectorAll("[data-racer-car]")];
  const modeButtons = [...document.querySelectorAll("[data-racer-mode]")];
  const ghostButtons = [...document.querySelectorAll("[data-racer-ghost]")];
  const pauseOverlay = document.getElementById("racer-pause-overlay");
  const resumeButton = document.getElementById("racer-resume");
  const restartButton = document.getElementById("racer-restart");

  const topSpeedSlider = document.getElementById("racer-top-speed");
  const accelerationSlider = document.getElementById("racer-acceleration");
  const gripSlider = document.getElementById("racer-grip");
  const topSpeedValue = document.getElementById("racer-top-speed-value");
  const accelerationValue = document.getElementById("racer-acceleration-value");
  const gripValue = document.getElementById("racer-grip-value");
  const tuningReset = document.getElementById("racer-tuning-reset");

  const controls = {
    left: document.getElementById("racer-left"),
    right: document.getElementById("racer-right")
  };

  let WORLD = { width: 2200, height: 1600 };
  const DEFAULT_TUNINGS = {
    formula: { topSpeed: 350, acceleration: 240, grip: 3.6 },
    road: { topSpeed: 290, acceleration: 190, grip: 2.5 }
  };
  const LEGACY_TUNING_KEY = "gameHubRacerTuningV2";
  const TUNING_KEY = "gameHubRacerTuningsV3";
  const CAR_KEY = "gameHubRacerCarV1";
  const MODE_KEY = "gameHubRacerModeV1";
  const GHOST_ENABLED_KEY = "gameHubRacerGhostEnabledV1";
  const TIMES_KEY = "gameHubRacerBestLapsV1";
  const GHOST_KEY = "gameHubRacerGhostsV1";
  const input = { left: false, right: false };

  // The circuits are original layouts, but they are designed with the rhythm
  // of real race tracks: long straights, defined braking zones, hairpins,
  // sweepers, esses and short technical links. Grand Prix mode uses a classic
  // 1 / 2 / 3 lap progression while Time Trial can run indefinitely.
  const COURSE_DEFS = {
    easy: {
      name: "Club Circuit",
      laps: 1,
      width: 136,
      target: 48,
      seed: 19,
      world: { width: 2700, height: 2200 },
      start: [500, 300],
      widthZones: [],
      runoffZones: [
        { start: 0.18, end: 0.27, extra: 58 },
        { start: 0.53, end: 0.585, extra: 52 }
      ],
      commands: [
        ["L", [2100, 300]],
        ["C", [2350, 300], [2480, 450], [2480, 650]],
        ["C", [2480, 850], [2340, 960], [2150, 940]],
        ["L", [1720, 900]],
        ["C", [1550, 880], [1480, 1020], [1570, 1160]],
        ["C", [1660, 1300], [1570, 1440], [1400, 1430]],
        ["L", [980, 1400]],
        ["C", [760, 1380], [650, 1520], [700, 1690]],
        ["C", [760, 1900], [590, 2050], [390, 1970]],
        ["C", [180, 1880], [120, 1650], [250, 1480]],
        ["L", [650, 1050]],
        ["C", [780, 910], [730, 760], [570, 700]],
        ["L", [320, 610]],
        ["C", [170, 560], [105, 435], [180, 335]],
        ["C", [230, 275], [330, 300], [500, 300]]
      ]
    },
    medium: {
      name: "Grand Prix Loop",
      laps: 2,
      width: 130,
      target: 60,
      seed: 43,
      world: { width: 3300, height: 2800 },
      start: [500, 300],
      widthZones: [],
      runoffZones: [
        { start: 0.18, end: 0.245, extra: 62 },
        { start: 0.385, end: 0.425, extra: 54 },
        { start: 0.53, end: 0.57, extra: 60 }
      ],
      commands: [
        ["L", [2500, 300]],
        ["C", [2850, 300], [3000, 500], [3000, 750]],
        ["L", [3000, 1050]],
        ["C", [3000, 1280], [2820, 1400], [2600, 1370]],
        ["L", [2200, 1310]],
        ["C", [2020, 1280], [1940, 1420], [2040, 1560]],
        ["C", [2140, 1700], [2080, 1830], [1900, 1850]],
        ["L", [1420, 1900]],
        ["C", [1210, 1920], [1110, 2080], [1200, 2250]],
        ["C", [1300, 2440], [1110, 2590], [900, 2540]],
        ["L", [500, 2440]],
        ["C", [240, 2370], [170, 2160], [290, 1980]],
        ["L", [780, 1300]],
        ["C", [900, 1130], [850, 980], [690, 920]],
        ["L", [380, 800]],
        ["C", [205, 740], [105, 565], [160, 405]],
        ["C", [200, 305], [320, 300], [500, 300]]
      ]
    },
    hard: {
      name: "Forest Crossover",
      laps: 3,
      width: 124,
      target: 70,
      seed: 71,
      world: { width: 2700, height: 2400 },
      start: [400, 240],
      widthZones: [],
      runoffZones: [
        { start: 0.15, end: 0.235, extra: 60 },
        { start: 0.415, end: 0.485, extra: 54 },
        { start: 0.555, end: 0.605, extra: 62 },
        { start: 0.69, end: 0.75, extra: 54 }
      ],
      bridge: { x: 1861, y: 1205, overProgress: 0.797, underProgress: 0.294 },
      commands: [
        ["L", [2050, 240]],
        ["C", [2320, 240], [2500, 400], [2500, 650]],
        ["C", [2500, 820], [2390, 960], [2210, 1010]],
        ["L", [720, 1840]],
        ["C", [500, 1960], [470, 2130], [620, 2210]],
        ["C", [780, 2290], [980, 2200], [1120, 2180]],
        ["L", [1600, 2180]],
        ["C", [1830, 2180], [2020, 2030], [1990, 1840]],
        ["C", [1960, 1660], [2140, 1540], [2320, 1620]],
        ["C", [2500, 1700], [2600, 1510], [2500, 1360]],
        ["C", [2400, 1210], [2240, 1190], [2110, 1280]],
        ["L", [520, 800]],
        ["C", [350, 730], [240, 650], [220, 520]],
        ["C", [195, 385], [250, 240], [400, 240]]
      ]
    }
  };

  const CAR_PROFILES = {
    formula: {
      name: "Formula",
      max: 1.06,
      accel: 1.06,
      grip: 1.12,
      turn: 1.06,
      drift: 0.82,
      width: 34,
      length: 58
    },
    road: {
      name: "Road",
      max: 0.92,
      accel: 0.90,
      grip: 0.84,
      turn: 0.95,
      drift: 1.24,
      width: 30,
      length: 48
    }
  };

  const SURFACES = {
    tarmac: { max: 1, accel: 1, grip: 1, drag: 0.24 },
    gravel: { max: 0.68, accel: 0.55, grip: 0.62, drag: 1.12 },
    grass: { max: 0.46, accel: 0.45, grip: 0.46, drag: 1.9 }
  };
  let difficulty = "easy";
  let course = null;
  let track = [];
  let trackLength = 0;
  let car = null;
  let camera = { x: 0, y: 0, zoom: 1.06 };
  let nearest = { index: 0, distance: 0 };
  let lastTrackIndex = 0;
  let nextGate = 0;
  let currentLap = 1;
  let lapStart = 0;
  let raceStart = 0;
  let raceStarted = false;
  let finished = false;
  let paused = false;
  let pauseStartedAt = 0;
  let lapTimes = [];
  let currentSurface = "tarmac";
  let animationFrame = 0;
  let lastFrame = performance.now();
  let carType = loadCarType();
  let raceMode = loadRaceMode();
  let ghostEnabled = loadGhostEnabled();
  let tunings = loadTunings();
  let tuning = tunings[carType];
  let bestTimes = loadBestTimes();
  let bestGhosts = loadBestGhosts();
  let currentLapSamples = [];
  let lastGhostSampleAt = -Infinity;
  let trees = [];
  let skidMarks = [];
  let skidTick = 0;
  let bridgeInfo = null;
  let runoffZonesResolved = [];

  function validTuning(value, fallback) {
    return {
      topSpeed: Number(value?.topSpeed) || fallback.topSpeed,
      acceleration: Number(value?.acceleration) || fallback.acceleration,
      grip: Number(value?.grip) || fallback.grip
    };
  }

  function loadTunings() {
    try {
      const saved = JSON.parse(localStorage.getItem(TUNING_KEY) || "null");
      if (saved && typeof saved === "object") {
        return {
          formula: validTuning(saved.formula, DEFAULT_TUNINGS.formula),
          road: validTuning(saved.road, DEFAULT_TUNINGS.road)
        };
      }

      // Preserve the old single setup as the Formula setup on first upgrade.
      const legacy = JSON.parse(localStorage.getItem(LEGACY_TUNING_KEY) || "null");
      return {
        formula: validTuning(legacy, DEFAULT_TUNINGS.formula),
        road: { ...DEFAULT_TUNINGS.road }
      };
    } catch (_) {
      return {
        formula: { ...DEFAULT_TUNINGS.formula },
        road: { ...DEFAULT_TUNINGS.road }
      };
    }
  }

  function saveTuning() {
    tunings[carType] = { ...tuning };
    try { localStorage.setItem(TUNING_KEY, JSON.stringify(tunings)); }
    catch (_) {}
  }

  function loadCarType() {
    try {
      const saved = localStorage.getItem(CAR_KEY);
      return CAR_PROFILES[saved] ? saved : "formula";
    } catch (_) {
      return "formula";
    }
  }

  function saveCarType() {
    try { localStorage.setItem(CAR_KEY, carType); }
    catch (_) {}
  }

  function loadRaceMode() {
    try { return localStorage.getItem(MODE_KEY) === "tt" ? "tt" : "gp"; }
    catch (_) { return "gp"; }
  }

  function saveRaceMode() {
    try { localStorage.setItem(MODE_KEY, raceMode); }
    catch (_) {}
  }

  function loadGhostEnabled() {
    try { return localStorage.getItem(GHOST_ENABLED_KEY) !== "off"; }
    catch (_) { return true; }
  }

  function saveGhostEnabled() {
    try { localStorage.setItem(GHOST_ENABLED_KEY, ghostEnabled ? "on" : "off"); }
    catch (_) {}
  }

  function syncCarUI() {
    carButtons.forEach(button => button.classList.toggle("active", button.dataset.racerCar === carType));
  }

  function syncModeUI() {
    modeButtons.forEach(button => button.classList.toggle("active", button.dataset.racerMode === raceMode));
  }

  function syncGhostUI() {
    ghostButtons.forEach(button => button.classList.toggle("active", (button.dataset.racerGhost === "on") === ghostEnabled));
  }

  function loadBestTimes() {
    try {
      const saved = JSON.parse(localStorage.getItem(TIMES_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (_) {
      return {};
    }
  }

  function loadBestGhosts() {
    try {
      const saved = JSON.parse(localStorage.getItem(GHOST_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (_) {
      return {};
    }
  }

  function bestTimeKey() {
    return `${difficulty}:${carType}`;
  }

  function saveBestLap(seconds, samples) {
    const key = bestTimeKey();
    const previous = Number(bestTimes[key]);
    if (previous && seconds >= previous) return false;

    bestTimes[key] = seconds;
    try { localStorage.setItem(TIMES_KEY, JSON.stringify(bestTimes)); }
    catch (_) {}

    const compactSamples = (samples || []).map(sample => [
      Math.max(0, Math.round(sample[0])),
      Math.round(sample[1] * 10) / 10,
      Math.round(sample[2] * 10) / 10,
      Math.round(sample[3] * 10000) / 10000,
      Math.round(sample[4] || 0)
    ]);

    if (compactSamples.length >= 2) {
      bestGhosts[key] = {
        duration: Math.round(seconds * 1000),
        samples: compactSamples
      };
      try { localStorage.setItem(GHOST_KEY, JSON.stringify(bestGhosts)); }
      catch (_) {}
    }

    return true;
  }

  function syncTuningUI() {
    topSpeedSlider.value = String(tuning.topSpeed);
    accelerationSlider.value = String(tuning.acceleration);
    gripSlider.value = String(tuning.grip);
    topSpeedValue.textContent = Math.round(tuning.topSpeed);
    accelerationValue.textContent = Math.round(tuning.acceleration);
    gripValue.textContent = Number(tuning.grip).toFixed(2).replace(/0$/, "");
  }

  function bindTuning(slider, key, output, formatter = value => String(value)) {
    slider.addEventListener("input", () => {
      tuning[key] = Number(slider.value);
      output.textContent = formatter(tuning[key]);
      saveTuning();
    });
  }

  bindTuning(topSpeedSlider, "topSpeed", topSpeedValue, value => String(Math.round(value)));
  bindTuning(accelerationSlider, "acceleration", accelerationValue, value => String(Math.round(value)));
  bindTuning(gripSlider, "grip", gripValue, value => Number(value).toFixed(2).replace(/0$/, ""));
  tuningReset.addEventListener("click", () => {
    tuning = { ...DEFAULT_TUNINGS[carType] };
    tunings[carType] = tuning;
    syncTuningUI();
    saveTuning();
  });
  syncTuningUI();

  function cubicPoint(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    return {
      x: uu * u * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + tt * t * p3[0],
      y: uu * u * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + tt * t * p3[1]
    };
  }

  function sampleCircuit(definition) {
    const raw = [{ x: definition.start[0], y: definition.start[1] }];
    let current = [...definition.start];

    definition.commands.forEach(command => {
      if (command[0] === "L") {
        const end = command[1];
        const length = Math.hypot(end[0] - current[0], end[1] - current[1]);
        const samples = Math.max(2, Math.ceil(length / 8));
        for (let i = 1; i <= samples; i++) {
          const t = i / samples;
          raw.push({
            x: current[0] + (end[0] - current[0]) * t,
            y: current[1] + (end[1] - current[1]) * t
          });
        }
        current = [...end];
        return;
      }

      const c1 = command[1];
      const c2 = command[2];
      const end = command[3];
      const estimate = Math.hypot(c1[0] - current[0], c1[1] - current[1])
        + Math.hypot(c2[0] - c1[0], c2[1] - c1[1])
        + Math.hypot(end[0] - c2[0], end[1] - c2[1]);
      const samples = Math.max(12, Math.ceil(estimate / 7));
      for (let i = 1; i <= samples; i++) {
        raw.push(cubicPoint(current, c1, c2, end, i / samples));
      }
      current = [...end];
    });

    if (raw.length > 1 && Math.hypot(raw[0].x - raw[raw.length - 1].x, raw[0].y - raw[raw.length - 1].y) < 0.01) {
      raw.pop();
    }

    // Gently blend command joins on the closed loop. Collinear samples on
    // straights stay effectively unchanged, while abrupt line/Bezier joins
    // become broad, continuous-radius transitions instead of little pinches.
    let smoothed = raw;
    const blend = 0.24;
    for (let pass = 0; pass < 5; pass++) {
      smoothed = smoothed.map((point, i, source) => {
        const prev = source[(i - 1 + source.length) % source.length];
        const next = source[(i + 1) % source.length];
        return {
          x: point.x * (1 - blend) + (prev.x + next.x) * 0.5 * blend,
          y: point.y * (1 - blend) + (prev.y + next.y) * 0.5 * blend
        };
      });
    }
    return smoothed;
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function generateTrees() {
    const random = seededRandom(course.seed);
    const spacing = difficulty === "hard" ? 86 : difficulty === "medium" ? 82 : 78;
    trees = [];

    // A jittered grid gives the woodland a dense, continuous feel without
    // creating obvious rows. Trees stay well outside the racing surface.
    for (let gy = 45; gy < WORLD.height - 35; gy += spacing) {
      for (let gx = 45; gx < WORLD.width - 35; gx += spacing) {
        if (random() < 0.08) continue;
        const x = gx + (random() - 0.5) * spacing * 0.58;
        const y = gy + (random() - 0.5) * spacing * 0.58;
        const point = nearestTrackPoint(x, y);
        if (point.distance < course.width * 0.78 + 42) continue;
        const start = track[0];
        if (Math.hypot(x - start.x, y - start.y) < 165) continue;
        trees.push({
          x, y,
          size: 20 + random() * 17,
          variant: random(),
          rotation: random() * Math.PI * 2
        });
      }
    }
  }

  function progressAt(index) {
    return ((index % trackLength) + trackLength) % trackLength / trackLength;
  }

  function inZone(progress, zone) {
    return progress >= zone.start && progress <= zone.end;
  }

  function widthAt() {
    // Track width is deliberately consistent again; interest comes from the
    // racing line, kerbs and runoff rather than artificial road widening.
    return course.width;
  }

  function resolveRunoffZones() {
    runoffZonesResolved = (course.runoffZones || []).map(zone => {
      const startIndex = Math.max(0, Math.floor(zone.start * trackLength));
      const endIndex = Math.min(trackLength - 1, Math.ceil(zone.end * trackLength));
      let turnSum = 0;
      let samples = 0;
      const step = Math.max(4, Math.floor((endIndex - startIndex) / 12));
      for (let i = startIndex; i <= endIndex; i += step) {
        turnSum += turnAmountAt(i);
        samples += 1;
      }
      // Positive curvature is a left turn. The outside is therefore the
      // right-hand edge (-1 relative to our left-facing normal), and vice versa.
      const outsideSide = (turnSum / Math.max(1, samples)) >= 0 ? -1 : 1;
      return { ...zone, startIndex, endIndex, outsideSide };
    });
  }

  function runoffInfoAt(index) {
    const progress = progressAt(index);
    let match = null;
    runoffZonesResolved.forEach(zone => {
      if (!inZone(progress, zone)) return;
      const span = Math.max(0.0001, zone.end - zone.start);
      const t = Math.max(0, Math.min(1, (progress - zone.start) / span));
      const taper = Math.pow(Math.sin(Math.PI * t), 0.45);
      const effectiveExtra = zone.extra * taper;
      if (!match || effectiveExtra > match.effectiveExtra) match = { ...zone, effectiveExtra };
    });
    return match;
  }

  function resolveBridge() {
    bridgeInfo = null;
    if (!course.bridge) return;
    const findNearProgress = progress => {
      const centre = Math.round(progress * trackLength);
      const radius = Math.max(50, Math.round(trackLength * 0.06));
      let bestIndex = centre;
      let bestDistanceSq = Infinity;
      for (let offset = -radius; offset <= radius; offset++) {
        const i = (centre + offset + trackLength) % trackLength;
        const dx = track[i].x - course.bridge.x;
        const dy = track[i].y - course.bridge.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDistanceSq) {
          bestDistanceSq = d2;
          bestIndex = i;
        }
      }
      return bestIndex;
    };
    bridgeInfo = {
      overIndex: findNearProgress(course.bridge.overProgress),
      underIndex: findNearProgress(course.bridge.underProgress)
    };
  }

  function buildTrack() {
    course = COURSE_DEFS[difficulty];
    WORLD = { ...course.world };
    track = sampleCircuit(course);
    trackLength = track.length;
    resolveRunoffZones();
    resolveBridge();
    generateTrees();
  }

  function angleBetween(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  }


  function recordGhostSample(now, force = false) {
    if (!raceStarted || !car) return;
    const effectiveNow = paused ? pauseStartedAt : now;
    const elapsed = Math.max(0, effectiveNow - lapStart);
    if (!force && elapsed - lastGhostSampleAt < 70) return;
    lastGhostSampleAt = elapsed;
    currentLapSamples.push([elapsed, car.x, car.y, car.angle, nearest.index]);
    if (currentLapSamples.length > 2600) currentLapSamples.splice(1, currentLapSamples.length - 2600);
  }

  function ghostPoseAt(now = performance.now()) {
    if (!raceStarted || !ghostEnabled) return null;
    const data = bestGhosts[bestTimeKey()];
    const samples = data?.samples;
    if (!Array.isArray(samples) || samples.length < 2) return null;

    const effectiveNow = paused ? pauseStartedAt : now;
    const elapsed = Math.max(0, effectiveNow - lapStart);
    const duration = Number(data.duration) || samples[samples.length - 1][0];
    if (elapsed > duration + 120) return null;

    if (elapsed <= samples[0][0]) {
      const s = samples[0];
      return { x: s[1], y: s[2], angle: s[3], index: s[4] || 0 };
    }

    let lo = 0;
    let hi = samples.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid][0] <= elapsed) lo = mid;
      else hi = mid;
    }

    const a = samples[lo];
    const b = samples[Math.min(samples.length - 1, hi)];
    const span = Math.max(1, b[0] - a[0]);
    const t = Math.max(0, Math.min(1, (elapsed - a[0]) / span));
    let angleDelta = b[3] - a[3];
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    return {
      x: a[1] + (b[1] - a[1]) * t,
      y: a[2] + (b[2] - a[2]) * t,
      angle: a[3] + angleDelta * t,
      index: t < 0.5 ? (a[4] || 0) : (b[4] || 0)
    };
  }

  function recordRacerProgress(lapSeconds, newBest, lapNumber, force = false) {
    if (!force && lapNumber !== 1 && !newBest) return;
    const target = course.target;
    const stars = lapSeconds <= target ? 5
      : lapSeconds <= target * 1.15 ? 4
      : lapSeconds <= target * 1.35 ? 3
      : lapSeconds <= target * 1.65 ? 2 : 1;
    const score = Math.max(100, Math.round(12000 - lapSeconds * 55));
    window.GameHubProgress?.recordResult({
      gameId: "game-13",
      difficulty,
      stars,
      score,
      metrics: {
        bestLap: formatTime(Number(bestTimes[bestTimeKey()]) || lapSeconds),
        car: CAR_PROFILES[carType].name,
        mode: raceMode === "gp" ? "Grand Prix" : "Time Trial"
      }
    });
  }

  function lapLabel() {
    return raceMode === "gp" ? `${Math.min(currentLap, course.laps)} / ${course.laps}` : String(currentLap);
  }

  function readyStatus() {
    const best = Number(bestTimes[bestTimeKey()]);
    const hasGhost = ghostEnabled && !!bestGhosts[bestTimeKey()]?.samples?.length;
    if (raceMode === "gp") {
      return `${course.name} · ${course.laps} lap Grand Prix${best ? ` · Best ${formatTime(best)}` : ""} · press Go.`;
    }
    return best
      ? `${course.name} · Best ${formatTime(best)}${hasGhost ? " · ghost ready" : ""} · press Go.`
      : `${course.name} · first lap sets your best · press Go.`;
  }

  function resetRace() {
    buildTrack();
    const start = track[0];
    const ahead = track[8];
    const angle = angleBetween(start, ahead);
    const profile = CAR_PROFILES[carType];
    car = {
      x: start.x,
      y: start.y,
      vx: 0,
      vy: 0,
      angle,
      width: profile.width,
      length: profile.length
    };
    camera.x = car.x + Math.cos(angle) * 70;
    camera.y = car.y + Math.sin(angle) * 70;
    camera.zoom = 1.06;
    nearest = { index: 0, distance: 0 };
    lastTrackIndex = 0;
    nextGate = 0;
    currentLap = 1;
    lapTimes = [];
    currentLapSamples = [];
    lastGhostSampleAt = -Infinity;
    raceStarted = false;
    finished = false;
    paused = false;
    pauseStartedAt = 0;
    raceStart = 0;
    lapStart = 0;
    currentSurface = "tarmac";
    skidMarks = [];
    skidTick = 0;
    Object.keys(input).forEach(key => input[key] = false);
    Object.values(controls).forEach(button => button.classList.remove("pressed"));
    lapEl.textContent = lapLabel();
    timeEl.textContent = "0:00.00";
    speedEl.textContent = "0";
    const best = Number(bestTimes[bestTimeKey()]);
    bestEl.textContent = best ? formatTime(best) : "--";
    goButton.disabled = false;
    goButton.classList.remove("running", "paused");
    goLabel.textContent = "GO";
    pauseOverlay.hidden = true;
    statusEl.textContent = readyStatus();
    settings.removeAttribute("open");
  }

  function nearestTrackPoint(x, y, hintIndex = null) {
    let bestIndex = 0;
    let bestDistanceSq = Infinity;

    const testIndex = i => {
      const index = (i + trackLength) % trackLength;
      const dx = x - track[index].x;
      const dy = y - track[index].y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistanceSq) {
        bestDistanceSq = d2;
        bestIndex = index;
      }
    };

    if (Number.isFinite(hintIndex) && trackLength) {
      const radius = Math.min(190, Math.max(80, Math.round(trackLength * 0.11)));
      for (let offset = -radius; offset <= radius; offset++) testIndex(hintIndex + offset);
      // If the car has gone a long way off course, fall back to a global search.
      if (bestDistanceSq > Math.pow(course.width * 2.8, 2)) {
        bestDistanceSq = Infinity;
        for (let i = 0; i < trackLength; i++) testIndex(i);
      }
    } else {
      for (let i = 0; i < trackLength; i++) testIndex(i);
    }

    return { index: bestIndex, distance: Math.sqrt(bestDistanceSq) };
  }

  function surfaceAt(position) {
    const halfRoad = widthAt(position.index) * 0.52;
    if (position.distance <= halfRoad) return "tarmac";

    const runoff = runoffInfoAt(position.index);
    if (runoff && car) {
      const p = track[position.index];
      const tangent = tangentAt(position.index);
      const nx = -tangent.y;
      const ny = tangent.x;
      const lateral = (car.x - p.x) * nx + (car.y - p.y) * ny;
      const outsideDistance = lateral * runoff.outsideSide;
      if (outsideDistance > halfRoad && outsideDistance <= halfRoad + runoff.effectiveExtra) return "gravel";
    }
    return "grass";
  }

  function tangentAt(index) {
    const a = track[(index - 3 + trackLength) % trackLength];
    const b = track[(index + 3) % trackLength];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  }

  function movingAlongTrack(index) {
    const tangent = tangentAt(index);
    return car.vx * tangent.x + car.vy * tangent.y > 10;
  }

  function circularDistance(a, b, n) {
    const raw = Math.abs(a - b);
    return Math.min(raw, n - raw);
  }

  function updateLapProgress(now = performance.now()) {
    const gates = [0.23, 0.48, 0.73, 0.91].map(value => Math.round(value * trackLength));
    const index = nearest.index;

    if (nextGate < gates.length && circularDistance(index, gates[nextGate], trackLength) < 8 && movingAlongTrack(index)) {
      nextGate += 1;
    }

    const crossedStart = lastTrackIndex > trackLength * 0.86 && index < trackLength * 0.14 && movingAlongTrack(index);
    if (crossedStart && nextGate === gates.length && raceStarted && !paused) {
      recordGhostSample(now, true);
      const completedLap = currentLap;
      const lapSeconds = (now - lapStart) / 1000;
      const completedSamples = currentLapSamples.slice();
      lapTimes.push(lapSeconds);
      const newBest = saveBestLap(lapSeconds, completedSamples);
      const best = Number(bestTimes[bestTimeKey()]);

      if (raceMode === "gp" && completedLap >= course.laps) {
        recordRacerProgress(lapSeconds, newBest, completedLap, true);
        finished = true;
        raceStarted = false;
        currentLap = course.laps;
        lapEl.textContent = lapLabel();
        timeEl.textContent = formatTime(lapSeconds);
        bestEl.textContent = best ? formatTime(best) : "--";
        const totalSeconds = (now - raceStart) / 1000;
        statusEl.textContent = `Grand Prix complete · ${formatTime(totalSeconds)} · Best ${formatTime(best || lapSeconds)}`;
        goButton.disabled = false;
        goButton.classList.remove("running", "paused");
        goLabel.textContent = "AGAIN";
        lastTrackIndex = index;
        return;
      }

      if (raceMode === "tt") recordRacerProgress(lapSeconds, newBest, completedLap);

      nextGate = 0;
      currentLap += 1;
      lapStart = now;
      currentLapSamples = [];
      lastGhostSampleAt = -Infinity;
      lapEl.textContent = lapLabel();
      timeEl.textContent = "0:00.00";
      bestEl.textContent = best ? formatTime(best) : "--";
      if (raceMode === "tt") {
        statusEl.textContent = newBest
          ? `New best ${formatTime(lapSeconds)}${ghostEnabled ? " · ghost updated" : ""} · Lap ${currentLap}`
          : `Lap ${completedLap} ${formatTime(lapSeconds)} · Best ${formatTime(best)} · Lap ${currentLap}`;
      } else {
        statusEl.textContent = `Lap ${completedLap} ${formatTime(lapSeconds)} · ${currentLap} / ${course.laps}`;
      }
      recordGhostSample(now, true);
    }

    lastTrackIndex = index;
  }

  function startRace() {
    if (raceStarted || finished) return;
    raceStarted = true;
    paused = false;
    raceStart = performance.now();
    lapStart = raceStart;
    currentLapSamples = [];
    lastGhostSampleAt = -Infinity;
    recordGhostSample(raceStart, true);
    goButton.disabled = false;
    goButton.classList.add("running");
    goButton.classList.remove("paused");
    goLabel.textContent = "PAUSE";
    const best = Number(bestTimes[bestTimeKey()]);
    if (raceMode === "gp") {
      statusEl.textContent = `${course.name} · ${course.laps} lap Grand Prix`;
    } else {
      statusEl.textContent = best && ghostEnabled
        ? `${course.name} · chase the ${formatTime(best)} ghost`
        : `${course.name} · chase your best lap`;
    }
  }

  function pauseRace() {
    if (!raceStarted || finished || paused) return;
    paused = true;
    pauseStartedAt = performance.now();
    Object.keys(input).forEach(name => setInput(name, false, controls[name]));
    pauseOverlay.hidden = false;
    goButton.disabled = true;
    goButton.classList.add("paused");
    statusEl.textContent = "Paused";
    resumeButton.focus({ preventScroll: true });
  }

  function resumeRace() {
    if (!paused) return;
    const now = performance.now();
    const pausedFor = now - pauseStartedAt;
    raceStart += pausedFor;
    lapStart += pausedFor;
    paused = false;
    pauseStartedAt = 0;
    pauseOverlay.hidden = true;
    goButton.disabled = false;
    goButton.classList.remove("paused");
    lastFrame = now;
    statusEl.textContent = raceMode === "gp"
      ? `${course.name} · Lap ${currentLap} / ${course.laps}`
      : `${course.name} · Lap ${currentLap}`;
  }

  function handleCenterButton() {
    if (finished) {
      resetRace();
      return;
    }
    if (!raceStarted) {
      startRace();
      return;
    }
    if (!paused) pauseRace();
  }

  function updatePhysics(dt) {
    if (paused) return;
    if (finished) {
      car.vx *= Math.exp(-2.2 * dt);
      car.vy *= Math.exp(-2.2 * dt);
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      return;
    }

    nearest = nearestTrackPoint(car.x, car.y, nearest.index);
    currentSurface = surfaceAt(nearest);
    const surface = SURFACES[currentSurface];
    const profile = CAR_PROFILES[carType];
    let speed = Math.hypot(car.vx, car.vy);
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // Steering rotates the car, not its velocity. The tyres then pull the
    // velocity back toward the car's heading over time. This separation is
    // what gives the car a controllable slip angle instead of feeling on rails.
    const speedFactor = Math.min(1, speed / 125);
    if (steer && speed > 4) {
      const turnRate = 2.46 * profile.turn * (0.24 + speedFactor * 0.76);
      car.angle += steer * turnRate * dt;
    }

    let headingX = Math.cos(car.angle);
    let headingY = Math.sin(car.angle);
    let rightX = -headingY;
    let rightY = headingX;

    if (raceStarted) {
      const steeringLift = 1 - Math.abs(steer) * 0.28;
      car.vx += headingX * tuning.acceleration * profile.accel * surface.accel * steeringLift * dt;
      car.vy += headingY * tuning.acceleration * profile.accel * surface.accel * steeringLift * dt;
    } else {
      car.vx *= Math.exp(-4 * dt);
      car.vy *= Math.exp(-4 * dt);
    }

    // Recalculate local velocity after yawing. Low grip leaves more sideways
    // velocity in place; high grip pulls the car toward the direction it faces.
    let forwardSpeed = car.vx * headingX + car.vy * headingY;
    let sideSpeed = car.vx * rightX + car.vy * rightY;
    const gripStrength = Math.max(0.35, tuning.grip * profile.grip * surface.grip);
    const lateralCorrection = 1 - Math.exp(-gripStrength * dt);
    car.vx -= rightX * sideSpeed * lateralCorrection;
    car.vy -= rightY * sideSpeed * lateralCorrection;

    // A little extra slip appears when steering hard at speed, so the rear
    // starts to rotate progressively rather than suddenly snapping loose.
    if (raceStarted && steer && speed > 115 && currentSurface === "tarmac") {
      const driftBuild = Math.min(1, (speed - 115) / 150) * (1.15 - Math.min(1, tuning.grip / 6)) * profile.drift;
      car.vx -= rightX * steer * driftBuild * 38 * dt;
      car.vy -= rightY * steer * driftBuild * 38 * dt;
    }

    const drag = surface.drag + Math.abs(steer) * 0.16;
    car.vx *= Math.exp(-drag * dt);
    car.vy *= Math.exp(-drag * dt);

    headingX = Math.cos(car.angle);
    headingY = Math.sin(car.angle);
    rightX = -headingY;
    rightY = headingX;
    forwardSpeed = car.vx * headingX + car.vy * headingY;
    sideSpeed = car.vx * rightX + car.vy * rightY;

    // No reversing is needed in this game. If a slide spins the velocity past
    // ninety degrees, bleed the backwards component away without killing drift.
    if (forwardSpeed < -8) {
      car.vx -= headingX * forwardSpeed * Math.min(1, 4 * dt);
      car.vy -= headingY * forwardSpeed * Math.min(1, 4 * dt);
    }

    speed = Math.hypot(car.vx, car.vy);
    const maxSpeed = tuning.topSpeed * profile.max * surface.max;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      car.vx *= scale;
      car.vy *= scale;
      speed = maxSpeed;
    }

    const slip = Math.abs(sideSpeed);
    skidTick += 1;
    if (currentSurface === "tarmac" && speed > 120 && slip > 28 && skidTick % 2 === 0) {
      const rearX = car.x - headingX * car.length * 0.35;
      const rearY = car.y - headingY * car.length * 0.35;
      const axle = car.width * 0.31;
      const markLength = Math.min(12, 3 + slip * 0.07);
      for (const side of [-1, 1]) {
        const x = rearX + rightX * axle * side;
        const y = rearY + rightY * axle * side;
        skidMarks.push({ x1: x, y1: y, x2: x - car.vx / Math.max(1, speed) * markLength, y2: y - car.vy / Math.max(1, speed) * markLength });
      }
      if (skidMarks.length > 420) skidMarks.splice(0, skidMarks.length - 420);
    }

    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));

    nearest = nearestTrackPoint(car.x, car.y, nearest.index);
    currentSurface = surfaceAt(nearest);
    if (raceStarted) {
      const now = performance.now();
      recordGhostSample(now);
      updateLapProgress(now);
    }

    const velocityAngle = speed > 16 ? Math.atan2(car.vy, car.vx) : car.angle;
    const lookAhead = 82 + Math.min(125, speed * 0.25);
    const cameraTargetX = car.x + Math.cos(velocityAngle) * lookAhead;
    const cameraTargetY = car.y + Math.sin(velocityAngle) * lookAhead;
    const follow = 1 - Math.exp(-5.2 * dt);
    camera.x += (cameraTargetX - camera.x) * follow;
    camera.y += (cameraTargetY - camera.y) * follow;

    // Close and readable at low speed, easing out only a little on fast sections.
    const carTopSpeed = Math.max(1, tuning.topSpeed * profile.max);
    const speedRatio = Math.min(1, speed / carTopSpeed);
    const targetZoom = 1.06 - speedRatio * 0.12;
    const zoomFollow = 1 - Math.exp(-2.8 * dt);
    camera.zoom += (targetZoom - camera.zoom) * zoomFollow;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "--";
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(2).padStart(5, "0")}`;
  }

  function updateHud(now) {
    const speed = Math.hypot(car.vx, car.vy);
    speedEl.textContent = String(Math.round(speed * 0.26));
    if (raceStarted && !finished) {
      const effectiveNow = paused ? pauseStartedAt : now;
      timeEl.textContent = formatTime((effectiveNow - lapStart) / 1000);
    }
  }

  function traceTrackPath(targetCtx = ctx) {
    if (!track.length) return;
    targetCtx.beginPath();
    targetCtx.moveTo(track[0].x, track[0].y);
    for (let i = 1; i < track.length; i++) targetCtx.lineTo(track[i].x, track[i].y);
    targetCtx.closePath();
  }

  function drawTree(tree) {
    const r = tree.size;
    ctx.save();
    ctx.translate(tree.x, tree.y);
    ctx.rotate(tree.rotation || 0);

    // Top-down canopy: a soft shadow and overlapping crown lobes, with no
    // visible side-on trunk. The small centre spot just hints at the tree core.
    ctx.fillStyle = "rgba(38,52,39,.18)";
    ctx.beginPath();
    ctx.ellipse(5, 6, r * 0.92, r * 0.78, 0.18, 0, Math.PI * 2);
    ctx.fill();

    const dark = tree.variant > 0.5 ? "#426044" : "#496649";
    const mid = tree.variant > 0.5 ? "#557557" : "#5d7b59";
    const light = tree.variant > 0.5 ? "#6e8b66" : "#708d67";

    ctx.strokeStyle = "rgba(42,58,43,.48)";
    ctx.lineWidth = 1.4;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.06, r * 0.54, 0, Math.PI * 2);
    ctx.arc(r * 0.34, -r * 0.10, r * 0.52, 0, Math.PI * 2);
    ctx.arc(r * 0.20, r * 0.30, r * 0.50, 0, Math.PI * 2);
    ctx.arc(-r * 0.22, r * 0.30, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.arc(0, -r * 0.27, r * 0.55, 0, Math.PI * 2);
    ctx.arc(-r * 0.12, r * 0.02, r * 0.50, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.28, r * 0.26, 0, Math.PI * 2);
    ctx.arc(r * 0.16, -r * 0.18, r * 0.21, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(72,68,51,.55)";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2.2, r * 0.09), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }


  function drawSkidMarks() {
    if (!skidMarks.length) return;
    ctx.save();
    ctx.strokeStyle = "rgba(24,29,32,.28)";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    skidMarks.forEach(mark => {
      ctx.beginPath();
      ctx.moveTo(mark.x1, mark.y1);
      ctx.lineTo(mark.x2, mark.y2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function turnAmountAt(index) {
    const before = tangentAt((index - 10 + trackLength) % trackLength);
    const after = tangentAt((index + 10) % trackLength);
    return Math.atan2(before.x * after.y - before.y * after.x, before.x * after.x + before.y * after.y);
  }

  function curbEdgePoint(index, side) {
    const wrapped = (index + trackLength) % trackLength;
    const p = track[wrapped];
    const tangent = tangentAt(wrapped);
    const half = widthAt(wrapped) * 0.5;
    const nx = -tangent.y;
    const ny = tangent.x;
    return { x: p.x + nx * half * side, y: p.y + ny * half * side };
  }

  function drawCurbs() {
    // Kerbs follow the actual tarmac edge instead of being independent blocks.
    // They sit half on/half off the road and only appear on sustained corners.
    ctx.save();
    ctx.lineWidth = 13;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";

    const step = 4;
    for (let i = 0; i < trackLength - step; i += step) {
      const turnA = turnAmountAt(i);
      const turnB = turnAmountAt(i + step);
      if (Math.abs(turnA) < 0.032 || Math.abs(turnB) < 0.032) continue;
      if (Math.sign(turnA) !== Math.sign(turnB)) continue;

      // Positive curvature turns left, so the left-hand road edge is the
      // inside kerb; negative curvature uses the right-hand edge.
      const side = turnA > 0 ? 1 : -1;
      const a = curbEdgePoint(i, side);
      const b = curbEdgePoint(i + step, side);
      ctx.strokeStyle = (Math.floor(i / (step * 3)) % 2 === 0) ? "#c95c53" : "#f2eee7";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }


  function traceTrackRange(startProgress, endProgress) {
    const start = Math.max(0, Math.floor(startProgress * trackLength));
    const end = Math.min(trackLength - 1, Math.ceil(endProgress * trackLength));
    if (end <= start) return;
    ctx.beginPath();
    ctx.moveTo(track[start].x, track[start].y);
    for (let i = start + 1; i <= end; i++) ctx.lineTo(track[i].x, track[i].y);
  }

  function offsetTrackPoint(index, side, offset) {
    const wrapped = (index + trackLength) % trackLength;
    const p = track[wrapped];
    const tangent = tangentAt(wrapped);
    const nx = -tangent.y;
    const ny = tangent.x;
    return { x: p.x + nx * offset * side, y: p.y + ny * offset * side };
  }

  function runoffExtraAtZone(zone, index) {
    const span = Math.max(1, zone.endIndex - zone.startIndex);
    const t = Math.max(0, Math.min(1, (index - zone.startIndex) / span));
    return zone.extra * Math.pow(Math.sin(Math.PI * t), 0.45);
  }

  function drawRunoff() {
    runoffZonesResolved.forEach((zone, zoneIndex) => {
      const side = zone.outsideSide;
      const inner = course.width * 0.5 + 5;
      const step = 3;

      // Build a tapered gravel bed only on the outside of the corner. The road
      // is drawn on top afterwards, leaving a clean edge beside the tarmac.
      ctx.beginPath();
      let started = false;
      for (let i = zone.startIndex; i <= zone.endIndex; i += step) {
        const extra = runoffExtraAtZone(zone, i);
        const point = offsetTrackPoint(i, side, inner + extra);
        if (!started) { ctx.moveTo(point.x, point.y); started = true; }
        else ctx.lineTo(point.x, point.y);
      }
      const endPoint = offsetTrackPoint(zone.endIndex, side, inner + runoffExtraAtZone(zone, zone.endIndex));
      ctx.lineTo(endPoint.x, endPoint.y);
      for (let i = zone.endIndex; i >= zone.startIndex; i -= step) {
        const point = offsetTrackPoint(i, side, inner);
        ctx.lineTo(point.x, point.y);
      }
      const startPoint = offsetTrackPoint(zone.startIndex, side, inner);
      ctx.lineTo(startPoint.x, startPoint.y);
      ctx.closePath();
      ctx.fillStyle = "#c7b697";
      ctx.fill();

      // Sparse aggregate marks sit only in that outside bed.
      ctx.save();
      ctx.fillStyle = "rgba(93,82,66,.20)";
      for (let i = zone.startIndex + 5; i < zone.endIndex - 5; i += 13) {
        const extra = runoffExtraAtZone(zone, i);
        if (extra < 9) continue;
        const hash = Math.abs(Math.sin((i + 1) * 12.9898 + zoneIndex * 8.21));
        const offset = inner + 6 + hash * Math.max(5, extra - 10);
        const point = offsetTrackPoint(i, side, offset);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.0 + hash * 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawWiderRoadSections() {
    // Intentionally unused: v1.7.14 returns every circuit to one consistent width.
  }

  function traceBridgeSegment(index, radius = 24) {
    if (!bridgeInfo) return;
    const start = Math.max(0, index - radius);
    const end = Math.min(trackLength - 1, index + radius);
    ctx.beginPath();
    ctx.moveTo(track[start].x, track[start].y);
    for (let i = start + 1; i <= end; i++) ctx.lineTo(track[i].x, track[i].y);
  }

  function drawBridgeOverlay() {
    if (!bridgeInfo) return;
    const width = widthAt(bridgeInfo.overIndex);
    traceBridgeSegment(bridgeInfo.overIndex, 28);
    ctx.strokeStyle = "rgba(37,43,47,.28)";
    ctx.lineWidth = width + 34;
    ctx.lineCap = "butt";
    ctx.stroke();
    traceBridgeSegment(bridgeInfo.overIndex, 26);
    ctx.strokeStyle = "#d6cec4";
    ctx.lineWidth = width + 18;
    ctx.lineCap = "butt";
    ctx.stroke();
    traceBridgeSegment(bridgeInfo.overIndex, 25);
    ctx.strokeStyle = "#3e4449";
    ctx.lineWidth = width;
    ctx.lineCap = "butt";
    ctx.stroke();
  }

  function carIsOnUnderpass() {
    return !!bridgeInfo && circularDistance(nearest.index, bridgeInfo.underIndex, trackLength) < 34;
  }

  function drawWorld() {
    ctx.fillStyle = "#91a47e";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    trees.forEach(tree => {
      if (Math.abs(tree.x - camera.x) > 680 || Math.abs(tree.y - camera.y) > 780) return;
      drawTree(tree);
    });

    drawRunoff();

    traceTrackPath();
    ctx.strokeStyle = "#d6cec4";
    ctx.lineWidth = course.width + 18;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    traceTrackPath();
    ctx.strokeStyle = "#3e4449";
    ctx.lineWidth = course.width;
    ctx.stroke();

    drawCurbs();
    drawSkidMarks();
    drawStartLine();
    drawBridgeOverlay();
  }


  function drawStartLine() {
    const p = track[0];
    const tangent = tangentAt(0);
    const half = widthAt(0) * 0.47;
    const blocks = 8;
    const blockW = (half * 2) / blocks;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(tangent.y, tangent.x));
    for (let row = -1; row <= 0; row++) {
      for (let i = 0; i < blocks; i++) {
        ctx.fillStyle = (i + row) % 2 === 0 ? "#f3efe9" : "#22282d";
        ctx.fillRect(row * 10, -half + i * blockW, 10, blockW + 1);
      }
    }
    ctx.restore();
  }

  function roundRect(targetCtx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    targetCtx.beginPath();
    targetCtx.moveTo(x + radius, y);
    targetCtx.arcTo(x + w, y, x + w, y + h, radius);
    targetCtx.arcTo(x + w, y + h, x, y + h, radius);
    targetCtx.arcTo(x, y + h, x, y, radius);
    targetCtx.arcTo(x, y, x + w, y, radius);
    targetCtx.closePath();
  }

  function drawRoadCar() {
    ctx.fillStyle = "#20262b";
    roundRect(ctx, -17, -19, 7, 15, 2); ctx.fill();
    roundRect(ctx, 10, -19, 7, 15, 2); ctx.fill();
    roundRect(ctx, -17, 5, 7, 15, 2); ctx.fill();
    roundRect(ctx, 10, 5, 7, 15, 2); ctx.fill();

    ctx.fillStyle = "#c77858";
    ctx.strokeStyle = "#2e3438";
    ctx.lineWidth = 2.5;
    roundRect(ctx, -14, -24, 28, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#dce6e6";
    roundRect(ctx, -10, -12, 20, 13, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(46,52,56,.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#aeb9b8";
    roundRect(ctx, -9, 5, 18, 8, 3);
    ctx.fill();

    ctx.fillStyle = "#f2e7b5";
    ctx.fillRect(-10, -23, 6, 3);
    ctx.fillRect(4, -23, 6, 3);
  }

  function drawFormulaCar() {
    const body = "#c77858";
    const dark = "#252b30";

    // Exposed tyres.
    ctx.fillStyle = dark;
    roundRect(ctx, -18, -19, 7, 13, 2); ctx.fill();
    roundRect(ctx, 11, -19, 7, 13, 2); ctx.fill();
    roundRect(ctx, -19, 8, 8, 16, 2); ctx.fill();
    roundRect(ctx, 11, 8, 8, 16, 2); ctx.fill();

    // Front and rear wings.
    ctx.fillStyle = dark;
    roundRect(ctx, -19, -29, 38, 5, 2); ctx.fill();
    roundRect(ctx, -16, 23, 32, 5, 2); ctx.fill();

    // Slim nose and centre body.
    ctx.fillStyle = body;
    ctx.strokeStyle = "#30363a";
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(0, -29);
    ctx.lineTo(5, -20);
    ctx.lineTo(6, -9);
    ctx.lineTo(11, -2);
    ctx.lineTo(10, 13);
    ctx.lineTo(6, 24);
    ctx.lineTo(-6, 24);
    ctx.lineTo(-10, 13);
    ctx.lineTo(-11, -2);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-5, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sidepods make the silhouette unmistakably open-wheel.
    ctx.fillStyle = body;
    roundRect(ctx, -14, -1, 7, 18, 3); ctx.fill(); ctx.stroke();
    roundRect(ctx, 7, -1, 7, 18, 3); ctx.fill(); ctx.stroke();

    // Cockpit / halo area from above.
    ctx.fillStyle = "#2e3a40";
    ctx.beginPath();
    ctx.ellipse(0, 3, 5.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d8d0c6";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, Math.PI * 0.12, Math.PI * 0.88, true);
    ctx.stroke();

    ctx.fillStyle = "#f2e7b5";
    ctx.fillRect(-2.5, -26, 5, 3);
  }

  function drawCar() {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle + Math.PI / 2);
    if (carType === "formula") drawFormulaCar();
    else drawRoadCar();
    ctx.restore();
  }

  function ghostIsOnUnderpass(pose) {
    return !!bridgeInfo && !!pose && circularDistance(pose.index, bridgeInfo.underIndex, trackLength) < 34;
  }

  function drawGhostCar(now) {
    const pose = ghostPoseAt(now);
    if (!pose) return null;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle + Math.PI / 2);
    ctx.globalAlpha = 0.34;
    ctx.globalCompositeOperation = "screen";
    if (carType === "formula") drawFormulaCar();
    else drawRoadCar();
    ctx.restore();
    return pose;
  }


  function drawMiniMap(now) {
    const box = { x: canvas.width - 132, y: 18, w: 114, h: 92 };
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, 14);
    ctx.fillStyle = "rgba(247,242,237,.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(52,57,68,.16)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(box.x + 9, box.y + 9, box.w - 18, box.h - 18);
    ctx.clip();

    const scale = Math.min((box.w - 24) / WORLD.width, (box.h - 24) / WORLD.height);
    const ox = box.x + box.w / 2 - WORLD.width * scale / 2;
    const oy = box.y + box.h / 2 - WORLD.height * scale / 2;
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    traceTrackPath();
    ctx.strokeStyle = "#70787d";
    ctx.lineWidth = 3.2 / scale;
    ctx.stroke();
    const ghostPose = ghostPoseAt(now);
    if (ghostPose) {
      ctx.strokeStyle = "rgba(245,249,247,.92)";
      ctx.lineWidth = 2.3 / scale;
      ctx.beginPath();
      ctx.arc(ghostPose.x, ghostPose.y, 4.2 / scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#c77858";
    ctx.beginPath();
    ctx.arc(car.x, car.y, 3.6 / scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawReady() {
    if (raceStarted || finished) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(247,242,237,.92)";
    roundRect(ctx, canvas.width / 2 - 78, canvas.height * 0.70 - 24, 156, 48, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(52,57,68,.16)";
    ctx.stroke();
    ctx.fillStyle = "#343944";
    ctx.font = "900 16px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
    ctx.fillText("PRESS GO", canvas.width / 2, canvas.height * 0.70 + 6);
    ctx.restore();
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const viewScale = camera.zoom;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height * 0.58);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-camera.x, -camera.y);
    drawWorld();
    const ghostPose = drawGhostCar(now);
    if (ghostIsOnUnderpass(ghostPose)) drawBridgeOverlay();
    drawCar();
    // On the crossover's lower road, redraw the bridge after the car so it
    // genuinely passes beneath it. On the upper road the car stays on top.
    if (carIsOnUnderpass()) drawBridgeOverlay();
    ctx.restore();

    drawMiniMap(now);
    drawReady();
  }

  function frame(now) {
    const dt = Math.min(0.032, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;
    updatePhysics(dt);
    updateHud(now);
    draw(now);
    animationFrame = requestAnimationFrame(frame);
  }

  function setInput(name, pressed, button) {
    input[name] = pressed;
    button?.classList.toggle("pressed", pressed);
  }

  function bindHold(button, name) {
    const release = event => {
      if (event && button.hasPointerCapture?.(event.pointerId)) {
        try { button.releasePointerCapture(event.pointerId); } catch (_) {}
      }
      setInput(name, false, button);
    };

    button.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
      setInput(name, true, button);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", () => setInput(name, false, button));
  }

  bindHold(controls.left, "left");
  bindHold(controls.right, "right");
  goButton.addEventListener("click", handleCenterButton);
  resumeButton.addEventListener("click", resumeRace);
  restartButton.addEventListener("click", resetRace);

  const keyMap = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right"
  };

  document.addEventListener("keydown", event => {
    if (event.key === " " || event.key === "Enter" || event.key === "ArrowUp") {
      event.preventDefault();
      if (paused) resumeRace();
      else handleCenterButton();
      return;
    }
    if (event.key === "Escape" && raceStarted && !finished) {
      event.preventDefault();
      if (paused) resumeRace();
      else pauseRace();
      return;
    }
    const name = keyMap[event.key];
    if (!name) return;
    event.preventDefault();
    if (!event.repeat) setInput(name, true, controls[name]);
  });
  document.addEventListener("keyup", event => {
    const name = keyMap[event.key];
    if (!name) return;
    event.preventDefault();
    setInput(name, false, controls[name]);
  });
  window.addEventListener("blur", () => {
    Object.keys(input).forEach(name => setInput(name, false, controls[name]));
    if (raceStarted && !paused && !finished) pauseRace();
  });

  difficultyButtons.forEach(button => {
    button.addEventListener("click", () => {
      difficulty = button.dataset.racerDifficulty;
      difficultyButtons.forEach(other => other.classList.toggle("active", other === button));
      resetRace();
    });
  });

  modeButtons.forEach(button => {
    button.addEventListener("click", () => {
      const next = button.dataset.racerMode;
      if (!['gp', 'tt'].includes(next) || next === raceMode) return;
      raceMode = next;
      saveRaceMode();
      syncModeUI();
      resetRace();
    });
  });

  ghostButtons.forEach(button => {
    button.addEventListener("click", () => {
      const next = button.dataset.racerGhost === "on";
      if (next === ghostEnabled) return;
      ghostEnabled = next;
      saveGhostEnabled();
      syncGhostUI();
      statusEl.textContent = raceStarted
        ? (ghostEnabled ? "Ghost enabled" : "Ghost hidden")
        : readyStatus();
    });
  });

  carButtons.forEach(button => {
    button.addEventListener("click", () => {
      const next = button.dataset.racerCar;
      if (!CAR_PROFILES[next] || next === carType) return;
      carType = next;
      tuning = tunings[carType] || { ...DEFAULT_TUNINGS[carType] };
      tunings[carType] = tuning;
      saveCarType();
      syncCarUI();
      syncTuningUI();
      resetRace();
    });
  });

  syncCarUI();
  syncModeUI();
  syncGhostUI();
  syncTuningUI();
  resetRace();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(frame);
})();
