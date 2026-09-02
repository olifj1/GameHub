(() => {
  const canvas = document.getElementById("racer-canvas");
  const ctx = canvas.getContext("2d");

  const lapEl = document.getElementById("racer-lap");
  const timeEl = document.getElementById("racer-time");
  const speedEl = document.getElementById("racer-speed");
  const statusEl = document.getElementById("racer-status");
  const resetButton = document.getElementById("racer-reset");
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
    right: document.getElementById("racer-right"),
    gas: document.getElementById("racer-accelerate"),
    brake: document.getElementById("racer-brake")
  };

  const WORLD = { width: 1500, height: 1220 };
  const DEFAULT_TUNING = { topSpeed: 380, acceleration: 270, grip: 5.5 };
  const TUNING_KEY = "gameHubRacerTuning";
  const TIMES_KEY = "gameHubRacerBestTimes";
  const input = { left: false, right: false, gas: false, brake: false };

  const COURSE_DEFS = {
    easy: {
      name: "Club Circuit",
      laps: 1,
      width: 150,
      target: 31,
      points: [
        [310, 265], [690, 180], [1115, 275], [1280, 535],
        [1170, 880], [790, 1040], [390, 930], [205, 625]
      ],
      surfaces: [
        { type: "gravel", from: 0.47, to: 0.56 }
      ]
    },
    medium: {
      name: "Quarry Run",
      laps: 2,
      width: 128,
      target: 61,
      points: [
        [260, 270], [620, 155], [1010, 205], [1290, 420],
        [1160, 670], [1340, 905], [1030, 1075], [705, 865],
        [415, 1050], [165, 795], [285, 560], [505, 455]
      ],
      surfaces: [
        { type: "gravel", from: 0.19, to: 0.29 },
        { type: "gravel", from: 0.67, to: 0.75 }
      ]
    },
    hard: {
      name: "Switchback",
      laps: 3,
      width: 112,
      target: 93,
      points: [
        [245, 240], [560, 145], [835, 315], [1120, 190],
        [1350, 435], [1115, 635], [1330, 875], [1010, 1080],
        [710, 875], [430, 1070], [155, 850], [345, 620],
        [150, 420], [430, 350]
      ],
      surfaces: [
        { type: "gravel", from: 0.11, to: 0.19 },
        { type: "wet", from: 0.37, to: 0.47 },
        { type: "gravel", from: 0.71, to: 0.79 }
      ]
    }
  };

  const SURFACES = {
    tarmac: { max: 1, accel: 1, grip: 1, drag: 0.34, label: "TARMAC" },
    gravel: { max: 0.68, accel: 0.72, grip: 0.58, drag: 1.12, label: "GRAVEL" },
    wet: { max: 0.90, accel: 0.92, grip: 0.38, drag: 0.42, label: "WET" },
    grass: { max: 0.46, accel: 0.52, grip: 0.48, drag: 1.85, label: "GRASS" }
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

  function catmullRomClosed(points, steps = 34) {
    const result = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        result.push({ x, y });
      }
    }
    return result;
  }

  function buildTrack() {
    course = COURSE_DEFS[difficulty];
    track = catmullRomClosed(course.points);
    trackLength = track.length;
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
    Object.keys(input).forEach(key => input[key] = false);
    Object.values(controls).forEach(button => button.classList.remove("pressed"));
    lapEl.textContent = `1 / ${course.laps}`;
    timeEl.textContent = "0:00.00";
    speedEl.textContent = "0";
    const best = Number(bestTimes[difficulty]);
    statusEl.textContent = best
      ? `${course.name} · Best ${formatTime(best)} · accelerate when ready.`
      : `${course.name} · accelerate when you are ready.`;
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

  function trackFraction(index) {
    return index / trackLength;
  }

  function fractionInRange(fraction, from, to) {
    if (from <= to) return fraction >= from && fraction <= to;
    return fraction >= from || fraction <= to;
  }

  function surfaceAt(position) {
    if (position.distance > course.width * 0.52) return "grass";
    const f = trackFraction(position.index);
    for (const patch of course.surfaces) {
      if (fractionInRange(f, patch.from, patch.to)) return patch.type;
    }
    return "tarmac";
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

  function startRaceIfNeeded() {
    if (raceStarted || finished) return;
    raceStarted = true;
    raceStart = performance.now();
    lapStart = raceStart;
    statusEl.textContent = `${course.name} · go!`;
  }

  function finishRace(now = performance.now()) {
    if (finished) return;
    finished = true;
    raceStarted = false;
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

    if (input.gas) startRaceIfNeeded();

    const headingX = Math.cos(car.angle);
    const headingY = Math.sin(car.angle);
    const rightX = -headingY;
    const rightY = headingX;
    let forwardSpeed = car.vx * headingX + car.vy * headingY;
    let sideSpeed = car.vx * rightX + car.vy * rightY;

    if (input.gas) {
      forwardSpeed += tuning.acceleration * surface.accel * dt;
    }

    if (input.brake) {
      if (forwardSpeed > 14) {
        forwardSpeed *= Math.max(0, 1 - 3.9 * dt);
      } else {
        forwardSpeed -= tuning.acceleration * 0.50 * surface.accel * dt;
      }
    }

    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const steerSpeed = Math.min(1, Math.abs(forwardSpeed) / 125);
    if (steer && Math.abs(forwardSpeed) > 4) {
      const reverse = forwardSpeed < 0 ? -1 : 1;
      const steeringGrip = 0.62 + surface.grip * 0.38;
      car.angle += steer * reverse * 2.45 * (0.20 + steerSpeed * 0.80) * steeringGrip * dt;
    }

    // Grip removes lateral velocity. Low-grip surfaces let the body point in a
    // new direction while the car keeps sliding along its previous path.
    const lateralGrip = tuning.grip * surface.grip;
    sideSpeed *= Math.exp(-lateralGrip * dt);
    forwardSpeed *= Math.exp(-surface.drag * dt);

    const maxForward = tuning.topSpeed * surface.max;
    forwardSpeed = Math.max(-maxForward * 0.38, Math.min(maxForward, forwardSpeed));

    const hx = Math.cos(car.angle);
    const hy = Math.sin(car.angle);
    const rx = -hy;
    const ry = hx;
    car.vx = hx * forwardSpeed + rx * sideSpeed;
    car.vy = hy * forwardSpeed + ry * sideSpeed;

    speed = Math.hypot(car.vx, car.vy);
    const maxSpeed = tuning.topSpeed * surface.max * 1.06;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      car.vx *= scale;
      car.vy *= scale;
      speed = maxSpeed;
    }

    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));

    nearest = nearestTrackPoint(car.x, car.y);
    currentSurface = surfaceAt(nearest);
    updateLapProgress();

    const lookAhead = 85 + Math.min(125, speed * 0.25);
    const cameraTargetX = car.x + Math.cos(car.angle) * lookAhead;
    const cameraTargetY = car.y + Math.sin(car.angle) * lookAhead;
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

  function drawSurfaceSegment(patch) {
    const start = Math.floor(patch.from * trackLength);
    const end = Math.floor(patch.to * trackLength);
    const drawRange = (a, b) => {
      ctx.beginPath();
      ctx.moveTo(track[a].x, track[a].y);
      for (let i = a + 1; i <= b; i++) ctx.lineTo(track[i % trackLength].x, track[i % trackLength].y);
      ctx.strokeStyle = patch.type === "gravel" ? "#9f8c77" : "#76949b";
      ctx.lineWidth = course.width - 10;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    };
    if (start <= end) drawRange(start, Math.max(start + 1, end));
    else {
      drawRange(start, trackLength - 1);
      drawRange(0, end);
    }
  }

  function drawWorld() {
    ctx.fillStyle = "#91a47e";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // Quiet field markings give the moving camera some texture without making
    // the scene busy or relying on external artwork.
    ctx.fillStyle = "rgba(52,68,49,.10)";
    for (let y = 45; y < WORLD.height; y += 90) {
      const offset = (Math.floor(y / 90) % 2) * 42;
      for (let x = 35 + offset; x < WORLD.width; x += 84) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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

    course.surfaces.forEach(drawSurfaceSegment);

    traceTrackPath();
    ctx.strokeStyle = "rgba(246,241,234,.48)";
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 24]);
    ctx.stroke();
    ctx.setLineDash([]);

    drawStartLine();
    drawTrackFurniture();
  }

  function drawStartLine() {
    const p = track[0];
    const tangent = tangentAt(0);
    const normal = { x: -tangent.y, y: tangent.x };
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

    void normal;
  }

  function drawTrackFurniture() {
    const gateFractions = [0.23, 0.48, 0.73, 0.91];
    gateFractions.forEach((fraction, gateIndex) => {
      const p = track[Math.round(fraction * trackLength) % trackLength];
      const t = tangentAt(Math.round(fraction * trackLength) % trackLength);
      const n = { x: -t.y, y: t.x };
      const outer = course.width * 0.64;
      ctx.strokeStyle = "rgba(243,239,233,.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - n.x * outer, p.y - n.y * outer);
      ctx.lineTo(p.x + n.x * outer, p.y + n.y * outer);
      ctx.stroke();

      if (gateIndex < nextGate) {
        ctx.fillStyle = "rgba(225,237,218,.72)";
        ctx.beginPath();
        ctx.arc(p.x + n.x * outer, p.y + n.y * outer, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
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
    roundRect(ctx, -17, -19, 7, 15, 2);
    ctx.fill();
    roundRect(ctx, 10, -19, 7, 15, 2);
    ctx.fill();
    roundRect(ctx, -17, 5, 7, 15, 2);
    ctx.fill();
    roundRect(ctx, 10, 5, 7, 15, 2);
    ctx.fill();

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

  function drawSurfaceBadge() {
    const surface = SURFACES[currentSurface];
    ctx.save();
    roundRect(ctx, 18, 18, 108, 36, 12);
    ctx.fillStyle = "rgba(247,242,237,.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(52,57,68,.16)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#746e69";
    ctx.font = "800 9px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
    ctx.fillText("SURFACE", 31, 32);
    ctx.fillStyle = "#343944";
    ctx.font = "900 12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
    ctx.fillText(surface.label, 31, 46);
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
    roundRect(ctx, canvas.width / 2 - 92, canvas.height * 0.70 - 26, 184, 52, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(52,57,68,.16)";
    ctx.stroke();
    ctx.fillStyle = "#343944";
    ctx.font = "900 16px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
    ctx.fillText("ACCELERATE TO START", canvas.width / 2, canvas.height * 0.70 + 6);
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

    drawSurfaceBadge();
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
  bindHold(controls.gas, "gas");
  bindHold(controls.brake, "brake");

  const keyMap = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "gas", w: "gas", W: "gas",
    ArrowDown: "brake", s: "brake", S: "brake"
  };

  document.addEventListener("keydown", event => {
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
