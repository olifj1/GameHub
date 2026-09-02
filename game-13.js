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

  const WORLD = { width: 1500, height: 1220 };
  const DEFAULT_TUNING = { topSpeed: 330, acceleration: 220, grip: 3.2 };
  const TUNING_KEY = "gameHubRacerTuningV2";
  const TIMES_KEY = "gameHubRacerBestTimes";
  const input = { left: false, right: false };

  // Circuit layouts are built like real race tracks rather than as freeform
  // spline loops: long straights are true line segments, while individual
  // corners use deliberately placed Bezier arcs. This creates recognisable
  // braking zones, hairpins, sweepers, esses and short connecting chutes.
  const COURSE_DEFS = {
    easy: {
      name: "Club Circuit",
      laps: 1,
      width: 142,
      target: 28,
      seed: 19,
      start: [300, 160],
      commands: [
        ["L", [980, 160]],
        ["C", [1120, 160], [1210, 250], [1210, 380]],
        ["L", [1210, 610]],
        ["C", [1210, 750], [1125, 835], [990, 835]],
        ["C", [850, 835], [765, 750], [765, 610]],
        ["L", [765, 525]],
        ["C", [765, 410], [690, 370], [575, 370]],
        ["L", [360, 370]],
        ["C", [220, 370], [150, 305], [165, 230]],
        ["C", [178, 165], [230, 160], [300, 160]]
      ]
    },
    medium: {
      name: "Grand Prix Loop",
      laps: 2,
      width: 128,
      target: 60,
      seed: 43,
      start: [300, 120],
      commands: [
        ["L", [980, 120]],
        ["C", [1125, 120], [1210, 220], [1240, 350]],
        ["L", [1290, 540]],
        ["C", [1320, 660], [1230, 755], [1100, 760]],
        ["L", [830, 760]],
        ["C", [750, 760], [735, 690], [665, 680]],
        ["C", [600, 670], [575, 735], [515, 755]],
        ["L", [350, 830]],
        ["C", [225, 885], [150, 805], [175, 690]],
        ["L", [235, 455]],
        ["C", [120, 410], [115, 240], [195, 160]],
        ["C", [220, 135], [255, 120], [300, 120]]
      ]
    },
    hard: {
      name: "Mountain Ring",
      laps: 3,
      width: 118,
      target: 88,
      seed: 71,
      start: [280, 120],
      commands: [
        ["L", [1010, 120]],
        ["C", [1135, 120], [1200, 190], [1235, 300]],
        ["L", [1310, 510]],
        ["C", [1350, 630], [1255, 705], [1130, 685]],
        ["L", [930, 650]],
        ["C", [820, 630], [785, 705], [845, 790]],
        ["L", [1010, 990]],
        ["C", [1075, 1075], [985, 1130], [875, 1090]],
        ["L", [625, 1000]],
        ["C", [520, 965], [455, 1040], [355, 1000]],
        ["C", [250, 960], [230, 855], [290, 770]],
        ["L", [475, 510]],
        ["C", [535, 425], [500, 350], [405, 345]],
        ["L", [300, 345]],
        ["C", [180, 345], [140, 250], [190, 175]],
        ["C", [210, 140], [245, 120], [280, 120]]
      ]
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

  function loadBestTimes() {
    try {
      const saved = JSON.parse(localStorage.getItem(TIMES_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (_) {
      return {};
    }
  }

  function saveBestTime(seconds) {
    const previous = Number(bestTimes[difficulty]);
    if (!previous || seconds < previous) {
      bestTimes[difficulty] = seconds;
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
    trees = [];
    let attempts = 0;
    while (trees.length < 76 && attempts < 1200) {
      attempts += 1;
      const x = 55 + random() * (WORLD.width - 110);
      const y = 55 + random() * (WORLD.height - 110);
      const point = nearestTrackPoint(x, y);
      if (point.distance < course.width * 0.78 + 32) continue;
      const start = track[0];
      if (Math.hypot(x - start.x, y - start.y) < 150) continue;
      trees.push({
        x, y,
        size: 18 + random() * 15,
        variant: random()
      });
    }
  }

  function buildTrack() {
    course = COURSE_DEFS[difficulty];
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
    car = {
      x: start.x,
      y: start.y,
      vx: 0,
      vy: 0,
      angle,
      width: 30,
      length: 48
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
    const best = Number(bestTimes[difficulty]);
    statusEl.textContent = best
      ? `${course.name} · Best ${formatTime(best)} · press Go when ready.`
      : `${course.name} · press Go when you are ready.`;
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
        summary: `${course.name} finished in ${formatTime(totalSeconds)}.`,
        metrics: [
          { label: "Time", value: formatTime(totalSeconds) },
          { label: "Fastest lap", value: formatTime(fastestLap) },
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
    let speed = Math.hypot(car.vx, car.vy);
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // Steering rotates the car, not its velocity. The tyres then pull the
    // velocity back toward the car's heading over time. This separation is
    // what gives the car a controllable slip angle instead of feeling on rails.
    const speedFactor = Math.min(1, speed / 125);
    if (steer && speed > 4) {
      const turnRate = 2.46 * (0.24 + speedFactor * 0.76);
      car.angle += steer * turnRate * dt;
    }

    let headingX = Math.cos(car.angle);
    let headingY = Math.sin(car.angle);
    let rightX = -headingY;
    let rightY = headingX;

    if (raceStarted) {
      const steeringLift = 1 - Math.abs(steer) * 0.28;
      car.vx += headingX * tuning.acceleration * surface.accel * steeringLift * dt;
      car.vy += headingY * tuning.acceleration * surface.accel * steeringLift * dt;
    } else {
      car.vx *= Math.exp(-4 * dt);
      car.vy *= Math.exp(-4 * dt);
    }

    // Recalculate local velocity after yawing. Low grip leaves more sideways
    // velocity in place; high grip pulls the car toward the direction it faces.
    let forwardSpeed = car.vx * headingX + car.vy * headingY;
    let sideSpeed = car.vx * rightX + car.vy * rightY;
    const gripStrength = Math.max(0.35, tuning.grip * surface.grip);
    const lateralCorrection = 1 - Math.exp(-gripStrength * dt);
    car.vx -= rightX * sideSpeed * lateralCorrection;
    car.vy -= rightY * sideSpeed * lateralCorrection;

    // A little extra slip appears when steering hard at speed, so the rear
    // starts to rotate progressively rather than suddenly snapping loose.
    if (raceStarted && steer && speed > 115 && currentSurface === "tarmac") {
      const driftBuild = Math.min(1, (speed - 115) / 150) * (1.15 - Math.min(1, tuning.grip / 6));
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
    const maxSpeed = tuning.topSpeed * surface.max;
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
    ctx.fillStyle = "rgba(49,58,47,.16)";
    ctx.beginPath();
    ctx.ellipse(5, r * 0.44, r * 0.9, r * 0.42, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#786b56";
    ctx.fillRect(-2.4, r * 0.18, 4.8, r * 0.65);

    const light = tree.variant > 0.5 ? "#587354" : "#506a4d";
    const dark = tree.variant > 0.5 ? "#405b42" : "#476044";
    ctx.strokeStyle = "rgba(45,55,44,.55)";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(-r * 0.28, 0, r * 0.55, 0, Math.PI * 2);
    ctx.arc(r * 0.30, r * 0.03, r * 0.50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(0, -r * 0.24, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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

  function drawWorld() {
    ctx.fillStyle = "#91a47e";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.fillStyle = "rgba(52,68,49,.08)";
    for (let y = 45; y < WORLD.height; y += 90) {
      const offset = (Math.floor(y / 90) % 2) * 42;
      for (let x = 35 + offset; x < WORLD.width; x += 84) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    trees.forEach(drawTree);

    traceTrackPath();
    ctx.strokeStyle = "#d8d0c6";
    ctx.lineWidth = course.width + 24;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    traceTrackPath();
    ctx.strokeStyle = "#3e4449";
    ctx.lineWidth = course.width;
    ctx.stroke();

    traceTrackPath();
    ctx.strokeStyle = "rgba(246,241,234,.48)";
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 24]);
    ctx.stroke();
    ctx.setLineDash([]);

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

  function drawCar() {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle + Math.PI / 2);

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

  resetButton.addEventListener("click", resetRace);

  resetRace();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(frame);
})();
