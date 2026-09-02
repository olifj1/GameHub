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
  const DEFAULT_TUNING = { topSpeed: 330, acceleration: 220, grip: 6.5 };
  const TUNING_KEY = "gameHubRacerTuning";
  const TIMES_KEY = "gameHubRacerBestTimes";
  const input = { left: false, right: false };

  // Each circuit is built from explicit cubic Bezier sections. The points are
  // the actual road design rather than loose waypoints that an interpolating
  // spline has to guess its way through. That gives broad, consistent-radius
  // corners and lets S-bends flow cleanly from one section into the next.
  const COURSE_DEFS = {
    easy: {
      name: "Meadow Loop",
      laps: 1,
      width: 154,
      target: 29,
      segments: [
        [[315,250],[500,145],[760,135],[960,200]],
        [[960,200],[1160,245],[1300,375],[1270,550]],
        [[1270,550],[1240,735],[1120,885],[930,975]],
        [[930,975],[720,1070],[455,1035],[300,900]],
        [[300,900],[145,765],[155,560],[220,420]],
        [[220,420],[250,350],[240,293],[315,250]]
      ]
    },
    medium: {
      name: "Riverside",
      laps: 2,
      width: 138,
      target: 57,
      segments: [
        [[300,225],[500,120],[810,125],[1035,205]],
        [[1035,205],[1245,280],[1335,410],[1250,550]],
        [[1250,550],[1175,670],[985,635],[875,560]],
        [[875,560],[750,475],[630,475],[555,585]],
        [[555,585],[475,705],[600,825],[795,815]],
        [[795,815],[1010,805],[1200,845],[1250,955]],
        [[1250,955],[1300,1065],[1170,1100],[1050,1080]],
        [[1050,1080],[850,1050],[700,1040],[565,1015]],
        [[565,1015],[330,945],[180,800],[205,630]],
        [[205,630],[225,485],[215,270],[300,225]]
      ]
    },
    hard: {
      name: "Hill Circuit",
      laps: 3,
      width: 124,
      target: 86,
      segments: [
        [[300,220],[480,120],[735,125],[925,210]],
        [[925,210],[1065,275],[1130,360],[1085,450]],
        [[1085,450],[1020,575],[825,565],[735,475]],
        [[735,475],[640,380],[535,390],[475,495]],
        [[475,495],[405,615],[520,705],[685,690]],
        [[685,690],[865,675],[970,730],[965,830]],
        [[965,830],[960,925],[835,980],[690,935]],
        [[690,935],[530,885],[420,900],[385,1010]],
        [[385,1010],[335,1135],[155,1045],[170,875]],
        [[170,875],[180,735],[315,680],[350,585]],
        [[350,585],[385,485],[245,455],[205,385]],
        [[205,385],[165,315],[210,260],[300,220]]
      ]
    }
  };

  const SURFACES = {
    tarmac: { max: 1, accel: 1, grip: 1, drag: 0.30 },
    grass: { max: 0.48, accel: 0.52, grip: 0.56, drag: 1.75 }
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

  function cubicPoint(segment, t) {
    const [p0, p1, p2, p3] = segment;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    return {
      x: uu * u * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + tt * t * p3[0],
      y: uu * u * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + tt * t * p3[1]
    };
  }

  function sampleBezierCourse(segments, samplesPerSection = 54) {
    const raw = [];
    segments.forEach((segment, segmentIndex) => {
      for (let i = 0; i <= samplesPerSection; i++) {
        if (segmentIndex > 0 && i === 0) continue;
        raw.push(cubicPoint(segment, i / samplesPerSection));
      }
    });
    // The last closed section ends exactly on the first point; keep only one
    // copy so nearest-point and lap-crossing tests do not see a duplicate.
    if (raw.length > 1 && Math.hypot(raw[0].x - raw[raw.length - 1].x, raw[0].y - raw[raw.length - 1].y) < 0.01) {
      raw.pop();
    }

    // Resample by distance so lap gates, tangents and the minimap all behave
    // consistently even when one Bezier section is much longer than another.
    const cumulative = [0];
    for (let i = 1; i < raw.length; i++) {
      cumulative.push(cumulative[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
    }
    const closeLength = Math.hypot(raw[0].x - raw[raw.length - 1].x, raw[0].y - raw[raw.length - 1].y);
    const total = cumulative[cumulative.length - 1] + closeLength;
    const spacing = 8;
    const count = Math.max(220, Math.round(total / spacing));
    const result = [];

    for (let s = 0; s < count; s++) {
      const target = total * s / count;
      if (target >= cumulative[cumulative.length - 1]) {
        const d = target - cumulative[cumulative.length - 1];
        const t = closeLength ? d / closeLength : 0;
        const a = raw[raw.length - 1];
        const b = raw[0];
        result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        continue;
      }
      let hi = 1;
      while (hi < cumulative.length && cumulative[hi] < target) hi++;
      const lo = Math.max(0, hi - 1);
      const span = cumulative[hi] - cumulative[lo] || 1;
      const t = (target - cumulative[lo]) / span;
      result.push({
        x: raw[lo].x + (raw[hi].x - raw[lo].x) * t,
        y: raw[lo].y + (raw[hi].y - raw[lo].y) * t
      });
    }
    return result;
  }

  function buildTrack() {
    course = COURSE_DEFS[difficulty];
    track = sampleBezierCourse(course.segments);
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

    const headingX = Math.cos(car.angle);
    const headingY = Math.sin(car.angle);
    const rightX = -headingY;
    const rightY = headingX;
    let forwardSpeed = car.vx * headingX + car.vy * headingY;
    let sideSpeed = car.vx * rightX + car.vy * rightY;

    if (raceStarted) {
      forwardSpeed += tuning.acceleration * surface.accel * dt;
    } else {
      forwardSpeed *= Math.exp(-4 * dt);
      sideSpeed *= Math.exp(-4 * dt);
    }

    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const steerSpeed = Math.min(1, Math.abs(forwardSpeed) / 105);
    if (steer && Math.abs(forwardSpeed) > 4) {
      const steeringGrip = 0.68 + surface.grip * 0.32;
      car.angle += steer * 2.58 * (0.24 + steerSpeed * 0.76) * steeringGrip * dt;
      // A small automatic lift under full steering replaces the need for a
      // separate brake button and makes long presses workable on a phone.
      forwardSpeed *= Math.exp(-0.88 * Math.abs(steer) * dt);
    }

    const lateralGrip = tuning.grip * surface.grip;
    sideSpeed *= Math.exp(-lateralGrip * dt);
    forwardSpeed *= Math.exp(-surface.drag * dt);

    const maxForward = tuning.topSpeed * surface.max;
    forwardSpeed = Math.max(0, Math.min(maxForward, forwardSpeed));

    const hx = Math.cos(car.angle);
    const hy = Math.sin(car.angle);
    const rx = -hy;
    const ry = hx;
    car.vx = hx * forwardSpeed + rx * sideSpeed;
    car.vy = hy * forwardSpeed + ry * sideSpeed;

    speed = Math.hypot(car.vx, car.vy);
    const maxSpeed = tuning.topSpeed * surface.max * 1.04;
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
    if (raceStarted) updateLapProgress();

    const lookAhead = 80 + Math.min(120, speed * 0.24);
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

  function drawWorld() {
    ctx.fillStyle = "#91a47e";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

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

    traceTrackPath();
    ctx.strokeStyle = "rgba(246,241,234,.48)";
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 24]);
    ctx.stroke();
    ctx.setLineDash([]);

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
