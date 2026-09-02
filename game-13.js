(() => {
  const canvas = document.getElementById("racer-canvas");
  const ctx = canvas.getContext("2d");

  const lapEl = document.getElementById("racer-lap");
  const timeEl = document.getElementById("racer-time");
  const speedEl = document.getElementById("racer-speed");
  const statusEl = document.getElementById("racer-status");
  const resetButton = document.getElementById("racer-reset");
  const goButton = document.getElementById("racer-go");
  const goLabel = document.getElementById("racer-go-label");
  const difficultyButtons = [...document.querySelectorAll("[data-racer-difficulty]")];
  const settings = document.querySelector(".racer-settings");
  const carButtons = [...document.querySelectorAll("[data-racer-car]")];

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
  const DEFAULT_TUNING = { topSpeed: 330, acceleration: 220, grip: 3.2 };
  const TUNING_KEY = "gameHubRacerTuningV2";
  const CAR_KEY = "gameHubRacerCarV1";
  const TIMES_KEY = "gameHubRacerBestTimesV2";
  const input = { left: false, right: false };

  // The circuits are original layouts, but they are designed with the rhythm
  // of real race tracks: long straights, defined braking zones, hairpins,
  // sweepers, esses and short technical links. Difficulty now changes the
  // physical length of a lap rather than simply asking for more laps.
  const COURSE_DEFS = {
    easy: {
      name: "Forest Club",
      laps: 1,
      width: 136,
      target: 32,
      seed: 19,
      world: { width: 2200, height: 1600 },
      start: [400, 220],
      commands: [
        ["L", [1500, 220]],
        ["C", [1720, 220], [1880, 360], [1880, 580]],
        ["L", [1880, 900]],
        ["C", [1880, 1120], [1720, 1280], [1500, 1280]],
        ["L", [950, 1280]],
        ["C", [760, 1280], [650, 1130], [680, 960]],
        ["C", [710, 800], [600, 700], [430, 700]],
        ["L", [280, 700]],
        ["C", [120, 700], [100, 520], [180, 400]],
        ["C", [245, 300], [310, 240], [400, 220]]
      ]
    },
    medium: {
      name: "Woodland Grand Prix",
      laps: 1,
      width: 130,
      target: 60,
      seed: 43,
      world: { width: 3000, height: 2700 },
      start: [450, 240],
      commands: [
        ["L", [2300, 240]],
        ["C", [2550, 240], [2750, 400], [2790, 650]],
        ["L", [2860, 1050]],
        ["C", [2900, 1280], [2700, 1460], [2470, 1440]],
        ["L", [2050, 1400]],
        ["C", [1880, 1380], [1810, 1510], [1890, 1650]],
        ["L", [2230, 2050]],
        ["C", [2330, 2170], [2220, 2290], [2060, 2260]],
        ["L", [1500, 2140]],
        ["C", [1320, 2100], [1220, 2200], [1150, 2350]],
        ["C", [1060, 2530], [830, 2580], [650, 2470]],
        ["L", [350, 2280]],
        ["C", [180, 2170], [170, 1970], [280, 1810]],
        ["L", [700, 1230]],
        ["C", [800, 1090], [760, 960], [600, 900]],
        ["L", [330, 800]],
        ["C", [160, 735], [130, 560], [220, 420]],
        ["C", [285, 320], [350, 265], [450, 240]]
      ]
    },
    hard: {
      name: "Endurance Ring",
      laps: 1,
      width: 124,
      target: 96,
      seed: 71,
      world: { width: 4600, height: 4100 },
      start: [550, 280],
      commands: [
        ["L", [3500, 280]],
        ["C", [3820, 280], [4100, 450], [4200, 760]],
        ["L", [4380, 1320]],
        ["C", [4460, 1580], [4270, 1800], [4010, 1800]],
        ["L", [3320, 1800]],
        ["C", [3100, 1800], [2990, 1950], [3090, 2140]],
        ["C", [3190, 2330], [3060, 2480], [2860, 2480]],
        ["L", [2250, 2480]],
        ["C", [2070, 2480], [1990, 2610], [2050, 2780]],
        ["L", [2360, 3350]],
        ["C", [2460, 3540], [2310, 3700], [2100, 3650]],
        ["L", [1160, 3440]],
        ["C", [900, 3380], [720, 3500], [620, 3720]],
        ["C", [510, 3960], [250, 3990], [150, 3790]],
        ["C", [110, 3610], [130, 3420], [300, 3300]],
        ["L", [760, 2960]],
        ["C", [930, 2830], [940, 2650], [820, 2510]],
        ["L", [410, 2030]],
        ["C", [250, 1840], [260, 1590], [430, 1430]],
        ["L", [970, 930]],
        ["C", [1120, 790], [1090, 620], [920, 550]],
        ["L", [650, 450]],
        ["C", [520, 400], [500, 330], [550, 280]]
      ]
    }
  };

  const CAR_PROFILES = {
    formula: {
      name: "Formula",
      max: 1.08,
      accel: 1.06,
      grip: 1.12,
      turn: 1.06,
      drift: 0.82,
      width: 34,
      length: 58
    },
    road: {
      name: "Road",
      max: 0.96,
      accel: 0.95,
      grip: 0.90,
      turn: 0.96,
      drift: 1.18,
      width: 30,
      length: 48
    }
  };

  const SURFACES = {
    tarmac: { max: 1, accel: 1, grip: 1, drag: 0.24 },
    grass: { max: 0.46, accel: 0.45, grip: 0.46, drag: 1.9 }
  };
  let difficulty = "easy";
  let course = null;
  let track = [];
  let trackLength = 0;
  let car = null;
  let camera = { x: 0, y: 0 };
  let nearest = { index: 0, distance: 0 };
  let lastTrackIndex = 0;
  let nextGate = 0;
  let currentLap = 1;
  let lapStart = 0;
  let raceStart = 0;
  let raceStarted = false;
  let finished = false;
  let lapTimes = [];
  let currentSurface = "tarmac";
  let animationFrame = 0;
  let lastFrame = performance.now();
  let tuning = loadTuning();
  let carType = loadCarType();
  let bestTimes = loadBestTimes();
  let trees = [];
  let skidMarks = [];
  let skidTick = 0;

  function loadTuning() {
    try {
      const saved = JSON.parse(localStorage.getItem(TUNING_KEY) || "{}");
      return {
        topSpeed: Number(saved.topSpeed) || DEFAULT_TUNING.topSpeed,
        acceleration: Number(saved.acceleration) || DEFAULT_TUNING.acceleration,
        grip: Number(saved.grip) || DEFAULT_TUNING.grip
      };
    } catch (_) {
      return { ...DEFAULT_TUNING };
    }
  }

  function saveTuning() {
    try { localStorage.setItem(TUNING_KEY, JSON.stringify(tuning)); }
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

  function syncCarUI() {
    carButtons.forEach(button => button.classList.toggle("active", button.dataset.racerCar === carType));
  }

  function loadBestTimes() {
    try {
      const saved = JSON.parse(localStorage.getItem(TIMES_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (_) {
      return {};
    }
  }

  function bestTimeKey() {
    return `${difficulty}:${carType}`;
  }

  function saveBestTime(seconds) {
    const key = bestTimeKey();
    const previous = Number(bestTimes[key]);
    if (!previous || seconds < previous) {
      bestTimes[key] = seconds;
      try { localStorage.setItem(TIMES_KEY, JSON.stringify(bestTimes)); }
      catch (_) {}
      return true;
    }
    return false;
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
    tuning = { ...DEFAULT_TUNING };
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
    return raw;
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

  function buildTrack() {
    course = COURSE_DEFS[difficulty];
    WORLD = { ...course.world };
    track = sampleCircuit(course);
    trackLength = track.length;
    generateTrees();
  }

  function angleBetween(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
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
    nearest = { index: 0, distance: 0 };
    lastTrackIndex = 0;
    nextGate = 0;
    currentLap = 1;
    lapTimes = [];
    raceStarted = false;
    finished = false;
    raceStart = 0;
    lapStart = 0;
    currentSurface = "tarmac";
    skidMarks = [];
    skidTick = 0;
    Object.keys(input).forEach(key => input[key] = false);
    Object.values(controls).forEach(button => button.classList.remove("pressed"));
    lapEl.textContent = `1 / ${course.laps}`;
    timeEl.textContent = "0:00.00";
    speedEl.textContent = "0";
    goButton.disabled = false;
    goButton.classList.remove("running");
    goLabel.textContent = "GO";
    const best = Number(bestTimes[bestTimeKey()]);
    statusEl.textContent = best
      ? `${course.name} · ${CAR_PROFILES[carType].name} · Best ${formatTime(best)} · press Go when ready.`
      : `${course.name} · ${CAR_PROFILES[carType].name} · press Go when you are ready.`;
    settings.removeAttribute("open");
  }

  function nearestTrackPoint(x, y) {
    let bestIndex = 0;
    let bestDistanceSq = Infinity;
    for (let i = 0; i < track.length; i++) {
      const dx = x - track[i].x;
      const dy = y - track[i].y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistanceSq) {
        bestDistanceSq = d2;
        bestIndex = i;
      }
    }
    return { index: bestIndex, distance: Math.sqrt(bestDistanceSq) };
  }

  function surfaceAt(position) {
    return position.distance > course.width * 0.52 ? "grass" : "tarmac";
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

  function updateLapProgress() {
    const gates = [0.23, 0.48, 0.73, 0.91].map(value => Math.round(value * trackLength));
    const index = nearest.index;

    if (nextGate < gates.length && circularDistance(index, gates[nextGate], trackLength) < 8 && movingAlongTrack(index)) {
      nextGate += 1;
    }

    const crossedStart = lastTrackIndex > trackLength * 0.86 && index < trackLength * 0.14 && movingAlongTrack(index);
    if (crossedStart && nextGate === gates.length && raceStarted) {
      const now = performance.now();
      const lapSeconds = (now - lapStart) / 1000;
      lapTimes.push(lapSeconds);
      nextGate = 0;

      if (currentLap >= course.laps) {
        finishRace(now);
      } else {
        currentLap += 1;
        lapStart = now;
        lapEl.textContent = `${currentLap} / ${course.laps}`;
        statusEl.textContent = `Lap ${currentLap} · previous ${formatTime(lapSeconds)}`;
      }
    }

    lastTrackIndex = index;
  }

  function startRace() {
    if (raceStarted || finished) return;
    raceStarted = true;
    raceStart = performance.now();
    lapStart = raceStart;
    goButton.disabled = true;
    goButton.classList.add("running");
    goLabel.textContent = "AUTO";
    statusEl.textContent = `${course.name} · go!`;
  }

  function finishRace(now = performance.now()) {
    if (finished) return;
    finished = true;
    raceStarted = false;
    goLabel.textContent = "DONE";
    const totalSeconds = (now - raceStart) / 1000;
    const fastestLap = Math.min(...lapTimes);
    const newTimeBest = saveBestTime(totalSeconds);
    const target = course.target;
    const stars = totalSeconds <= target ? 5
      : totalSeconds <= target * 1.15 ? 4
      : totalSeconds <= target * 1.35 ? 3
      : totalSeconds <= target * 1.65 ? 2 : 1;
    const score = Math.max(100, Math.round(12000 - totalSeconds * 55));

    statusEl.textContent = `${newTimeBest ? "New best · " : "Finished · "}${formatTime(totalSeconds)}`;
    window.setTimeout(() => {
      window.GameHubResults?.show({
        gameId: "game-13",
        difficulty,
        stars,
        score,
        title: newTimeBest ? "New best time!" : "Race complete!",
        summary: `${course.name} · ${CAR_PROFILES[carType].name} finished in ${formatTime(totalSeconds)}.`,
        metrics: [
          { label: "Time", value: formatTime(totalSeconds) },
          { label: "Fastest lap", value: formatTime(fastestLap) },
          { label: "Car", value: CAR_PROFILES[carType].name },
          { label: "Laps", value: String(course.laps) }
        ],
        againLabel: "Race again",
        onAgain: resetRace
      });
    }, 350);
  }

  function updatePhysics(dt) {
    if (finished) {
      car.vx *= Math.exp(-2.2 * dt);
      car.vy *= Math.exp(-2.2 * dt);
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      return;
    }

    nearest = nearestTrackPoint(car.x, car.y);
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

    nearest = nearestTrackPoint(car.x, car.y);
    currentSurface = surfaceAt(nearest);
    if (raceStarted) updateLapProgress();

    const velocityAngle = speed > 16 ? Math.atan2(car.vy, car.vx) : car.angle;
    const lookAhead = 82 + Math.min(125, speed * 0.25);
    const cameraTargetX = car.x + Math.cos(velocityAngle) * lookAhead;
    const cameraTargetY = car.y + Math.sin(velocityAngle) * lookAhead;
    const follow = 1 - Math.exp(-5.2 * dt);
    camera.x += (cameraTargetX - camera.x) * follow;
    camera.y += (cameraTargetY - camera.y) * follow;
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
      timeEl.textContent = formatTime((now - raceStart) / 1000);
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

  function drawCurbs() {
    const edge = course.width * 0.5 + 1;
    ctx.save();
    for (let i = 0; i < trackLength; i += 6) {
      const turn = Math.abs(turnAmountAt(i));
      if (turn < 0.045) continue;
      const p = track[i];
      const tangent = tangentAt(i);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(tangent.y, tangent.x));
      ctx.fillStyle = (Math.floor(i / 6) % 2 === 0) ? "#c95c53" : "#f2eee7";
      ctx.fillRect(-10, edge - 6, 20, 12);
      ctx.fillRect(-10, -edge - 6, 20, 12);
      ctx.restore();
    }
    ctx.restore();
  }


  function drawWorld() {
    ctx.fillStyle = "#91a47e";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // Only draw woodland near the camera. Hard has well over a thousand trees,
    // so culling keeps the moving canvas light enough for a phone.
    trees.forEach(tree => {
      if (Math.abs(tree.x - camera.x) > 560 || Math.abs(tree.y - camera.y) > 680) return;
      drawTree(tree);
    });

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

    // No centre lane line: this is now presented as a dedicated racing circuit.
    drawCurbs();
    drawSkidMarks();
    drawStartLine();
  }


  function drawStartLine() {
    const p = track[0];
    const tangent = tangentAt(0);
    const half = course.width * 0.47;
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


  function drawMiniMap() {
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

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const viewScale = 1.02;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height * 0.58);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-camera.x, -camera.y);
    drawWorld();
    drawCar();
    ctx.restore();

    drawMiniMap();
    drawReady();
  }

  function frame(now) {
    const dt = Math.min(0.032, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;
    updatePhysics(dt);
    updateHud(now);
    draw();
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
  goButton.addEventListener("click", startRace);

  const keyMap = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right"
  };

  document.addEventListener("keydown", event => {
    if (event.key === " " || event.key === "Enter" || event.key === "ArrowUp") {
      event.preventDefault();
      startRace();
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
  });

  difficultyButtons.forEach(button => {
    button.addEventListener("click", () => {
      difficulty = button.dataset.racerDifficulty;
      difficultyButtons.forEach(other => other.classList.toggle("active", other === button));
      resetRace();
    });
  });

  carButtons.forEach(button => {
    button.addEventListener("click", () => {
      const next = button.dataset.racerCar;
      if (!CAR_PROFILES[next] || next === carType) return;
      carType = next;
      saveCarType();
      syncCarUI();
      resetRace();
    });
  });

  resetButton.addEventListener("click", resetRace);

  syncCarUI();
  resetRace();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(frame);
})();
