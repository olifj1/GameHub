(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const canvas = $("#coaster-canvas");
  const ctx = canvas.getContext("2d");
  const pieceButtons = $$(".coaster-piece");
  const addButton = $("#coaster-add");
  const removeButton = $("#coaster-remove");
  const playButton = $("#coaster-play");
  const statusEl = $("#coaster-status");
  const lengthEl = $("#coaster-length");
  const speedEl = $("#coaster-speed");
  const gEl = $("#coaster-g");
  const runMessage = $("#coaster-run-message");
  const runTitle = $("#coaster-run-title");
  const runText = $("#coaster-run-text");
  const tryAgainButton = $("#coaster-try-again");
  const backBuildButton = $("#coaster-back-build");
  const zoomOutButton = $("#coaster-zoom-out");
  const zoomInButton = $("#coaster-zoom-in");
  const fitButton = $("#coaster-fit");

  const W = canvas.width;
  const H = canvas.height;
  const START_X = 160;
  const START_Y = 820;
  const GROUND_Y = 1180;
  const PIECE_LENGTH = 118;
  const GENTLE_DELTA = Math.PI / 12; // 15 degrees.
  const TIGHT_DELTA = Math.PI / 6;   // 30 degrees.
  const MAX_ANGLE = Math.PI * 5 / 12; // 75 degrees.
  // The virtual build world is intentionally much taller than the visible canvas.
  // Camera zoom/pan exposes it without forcing the whole coaster to shrink.
  const MIN_Y = -220;
  const MAX_Y = 1110;
  const WORLD_TO_METERS = 0.08;
  const GRAVITY = 45;
  const LIFT_SPEED = 42;
  const START_SPEED = 48;
  const ROLLING_DRAG = 1.05;
  const MAX_PIECES = 72;
  const MIN_ZOOM = 0.34;
  const MAX_ZOOM = 1.7;
  const DEFAULT_ZOOM = 0.88;

  const typeMeta = {
    start: { label: "Start", length: 128, powered: true },
    end: { label: "End", length: 138 },
    straight: { label: "Straight", length: PIECE_LENGTH },
    curveUp: { label: "Gentle up", length: PIECE_LENGTH, delta: -GENTLE_DELTA },
    curveDown: { label: "Gentle down", length: PIECE_LENGTH, delta: GENTLE_DELTA },
    curveUpTight: { label: "Tight up", length: PIECE_LENGTH, delta: -TIGHT_DELTA },
    curveDownTight: { label: "Tight down", length: PIECE_LENGTH, delta: TIGHT_DELTA },
    lift: { label: "Lift", length: PIECE_LENGTH, powered: true },
    liftUp: { label: "Lift up", length: PIECE_LENGTH, delta: -GENTLE_DELTA, powered: true },
    liftDown: { label: "Lift down", length: PIECE_LENGTH, delta: GENTLE_DELTA, powered: true }
  };

  let selectedType = "start";
  let pieces = [];
  let totalLength = 0;
  let mode = "build";
  let cart = null;
  let raf = 0;
  let lastTime = 0;
  let peakSpeed = 0;
  let peakG = 1;
  let stallTime = 0;
  let cameraMode = "follow";
  let cameraScale = DEFAULT_ZOOM;
  let cameraCenterX = START_X + 350;
  let cameraCenterY = START_Y - 80;
  let panPointerId = null;
  let panStart = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function nice(value, digits = 1) {
    return Number(value).toFixed(digits);
  }

  function tailPoint() {
    if (!pieces.length) return { x: START_X, y: START_Y };
    const tail = pieces[pieces.length - 1];
    return { x: tail.endX, y: tail.endY };
  }

  function worldToScreen(point, centerX = cameraCenterX, centerY = cameraCenterY, scale = cameraScale) {
    return {
      x: (point.x - centerX) * scale + W / 2,
      y: (point.y - centerY) * scale + H / 2
    };
  }

  function screenToWorld(x, y) {
    return {
      x: (x - W / 2) / cameraScale + cameraCenterX,
      y: (y - H / 2) / cameraScale + cameraCenterY
    };
  }

  function keepTailVisible() {
    if (cameraMode === "fit") return;
    const tail = tailPoint();
    let screen = worldToScreen(tail);
    const left = W * 0.16;
    const right = W * 0.78;
    const top = H * 0.16;
    const bottom = H * 0.80;
    if (screen.x > right) cameraCenterX += (screen.x - right) / cameraScale;
    if (screen.x < left) cameraCenterX -= (left - screen.x) / cameraScale;
    screen = worldToScreen(tail);
    if (screen.y > bottom) cameraCenterY += (screen.y - bottom) / cameraScale;
    if (screen.y < top) cameraCenterY -= (top - screen.y) / cameraScale;
  }

  function setZoom(nextScale, anchorX = W / 2, anchorY = H / 2) {
    const before = screenToWorld(anchorX, anchorY);
    cameraMode = "follow";
    cameraScale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    cameraCenterX = before.x - (anchorX - W / 2) / cameraScale;
    cameraCenterY = before.y - (anchorY - H / 2) / cameraScale;
    draw();
  }

  function endpointFor(type, startX, startY, startAngle) {
    const meta = typeMeta[type];
    const length = meta.length;
    const delta = meta.delta || 0;
    if (!delta) {
      return {
        x: startX + Math.cos(startAngle) * length,
        y: startY + Math.sin(startAngle) * length,
        angle: startAngle
      };
    }
    const k = delta / length;
    const endAngle = startAngle + delta;
    return {
      x: startX + (Math.sin(endAngle) - Math.sin(startAngle)) / k,
      y: startY + (Math.cos(startAngle) - Math.cos(endAngle)) / k,
      angle: endAngle
    };
  }

  function pointOnPiece(piece, localS) {
    const s = clamp(localS, 0, piece.length);
    if (!piece.delta) {
      return {
        x: piece.x + Math.cos(piece.angle) * s,
        y: piece.y + Math.sin(piece.angle) * s,
        angle: piece.angle,
        curvature: 0
      };
    }
    const k = piece.delta / piece.length;
    const angle = piece.angle + k * s;
    return {
      x: piece.x + (Math.sin(angle) - Math.sin(piece.angle)) / k,
      y: piece.y + (Math.cos(piece.angle) - Math.cos(angle)) / k,
      angle,
      curvature: k
    };
  }

  function recalcTrack() {
    let x = START_X;
    let y = START_Y;
    let angle = 0;
    let s = 0;
    pieces.forEach((piece, index) => {
      const meta = typeMeta[piece.type];
      piece.index = index;
      piece.x = x;
      piece.y = y;
      piece.angle = angle;
      piece.length = meta.length;
      piece.delta = meta.delta || 0;
      piece.powered = !!meta.powered;
      piece.startS = s;
      const end = endpointFor(piece.type, x, y, angle);
      piece.endX = end.x;
      piece.endY = end.y;
      piece.endAngle = end.angle;
      piece.endS = s + piece.length;
      x = end.x;
      y = end.y;
      angle = end.angle;
      s = piece.endS;
    });
    totalLength = s;
  }

  function trackHas(type) {
    return pieces.some(piece => piece.type === type);
  }

  function isCompleteTrack() {
    return pieces.length >= 2 && pieces[0].type === "start" && pieces[pieces.length - 1].type === "end";
  }

  function nextPiecePreview(type) {
    if (!pieces.length) {
      if (type !== "start") return { ok: false, message: "Start must be the first piece." };
      const end = endpointFor(type, START_X, START_Y, 0);
      return { ok: true, startX: START_X, startY: START_Y, startAngle: 0, end };
    }
    if (trackHas("end")) return { ok: false, message: "Remove the End piece before adding more track." };
    if (pieces.length >= MAX_PIECES) return { ok: false, message: "This coaster is already very long — add End and give it a run." };
    if (type === "start") return { ok: false, message: "There is already a Start section." };
    const tail = pieces[pieces.length - 1];
    const startAngle = tail.endAngle;
    const delta = typeMeta[type].delta || 0;
    const endAngle = startAngle + delta;
    if (Math.abs(endAngle) > MAX_ANGLE + 1e-6) {
      return { ok: false, message: "That curve would make the track too steep for this prototype." };
    }
    const end = endpointFor(type, tail.endX, tail.endY, startAngle);
    if (end.y < MIN_Y || end.y > MAX_Y) {
      return { ok: false, message: "That piece would leave the build area. Curve back the other way first." };
    }
    return { ok: true, startX: tail.endX, startY: tail.endY, startAngle, end };
  }

  function selectPiece(type) {
    selectedType = type;
    pieceButtons.forEach(button => button.classList.toggle("active", button.dataset.coasterPiece === type));
    if (mode === "build") {
      statusEl.textContent = `${typeMeta[type].label} selected — tap Add.`;
    }
  }

  function addPiece() {
    if (mode !== "build") return;
    const preview = nextPiecePreview(selectedType);
    if (!preview.ok) {
      statusEl.textContent = preview.message;
      pulseStatus();
      return;
    }
    pieces.push({ type: selectedType });
    recalcTrack();
    if (selectedType === "start") {
      selectPiece("straight");
      statusEl.textContent = "Start added. Build the track, then finish with End.";
    } else if (selectedType === "end") {
      statusEl.textContent = "Coaster complete — tap Play to test it.";
    } else {
      statusEl.textContent = `${typeMeta[selectedType].label} added.`;
    }
    keepTailVisible();
    updateUi();
    draw();
  }

  function removePiece() {
    if (mode !== "build" || !pieces.length) return;
    const removed = pieces.pop();
    recalcTrack();
    if (!pieces.length) {
      selectPiece("start");
      statusEl.textContent = "Track cleared. Add a Start section.";
    } else {
      statusEl.textContent = `${typeMeta[removed.type].label} removed.`;
    }
    keepTailVisible();
    updateUi();
    draw();
  }

  function pulseStatus() {
    statusEl.classList.remove("coaster-status-pulse");
    void statusEl.offsetWidth;
    statusEl.classList.add("coaster-status-pulse");
  }

  function updateUi() {
    const lengthMeters = totalLength * WORLD_TO_METERS;
    lengthEl.textContent = `${Math.round(lengthMeters)} m`;
    removeButton.disabled = mode !== "build" || !pieces.length;
    addButton.disabled = mode !== "build";
    pieceButtons.forEach(button => button.disabled = mode !== "build");
    if (mode === "build") {
      playButton.disabled = !isCompleteTrack();
      playButton.textContent = "▶ Play";
      speedEl.textContent = "0 km/h";
      gEl.textContent = "1.0 g";
    } else if (mode === "play") {
      playButton.disabled = false;
      playButton.textContent = "■ Stop";
    } else {
      playButton.disabled = true;
      playButton.textContent = "▶ Play";
    }
  }

  function findPieceAt(s) {
    if (!pieces.length) return null;
    if (s >= totalLength) return pieces[pieces.length - 1];
    let lo = 0;
    let hi = pieces.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const p = pieces[mid];
      if (s < p.startS) hi = mid - 1;
      else if (s >= p.endS) lo = mid + 1;
      else return p;
    }
    return pieces[clamp(lo, 0, pieces.length - 1)];
  }

  function sampleTrackAt(s) {
    const piece = findPieceAt(clamp(s, 0, totalLength));
    if (!piece) return { x: START_X, y: START_Y, angle: 0, curvature: 0, piece: null };
    const point = pointOnPiece(piece, clamp(s - piece.startS, 0, piece.length));
    return { ...point, piece };
  }

  function startRun() {
    if (!isCompleteTrack()) return;
    window.GameHubResults?.close();
    runMessage.hidden = true;
    mode = "play";
    peakSpeed = START_SPEED;
    peakG = 1;
    stallTime = 0;
    cart = {
      s: 0,
      v: START_SPEED,
      finished: false
    };
    statusEl.textContent = "Running — gravity takes over after powered sections.";
    updateUi();
    cancelAnimationFrame(raf);
    lastTime = performance.now();
    raf = requestAnimationFrame(runFrame);
  }

  function stopRunToBuild(message = "Back in build mode.") {
    cancelAnimationFrame(raf);
    mode = "build";
    cart = null;
    runMessage.hidden = true;
    statusEl.textContent = message;
    updateUi();
    draw();
  }

  function failRun(title, text) {
    cancelAnimationFrame(raf);
    mode = "failed";
    runTitle.textContent = title;
    runText.textContent = text;
    runMessage.hidden = false;
    statusEl.textContent = "The design needs another adjustment.";
    addButton.disabled = true;
    removeButton.disabled = true;
    playButton.disabled = true;
    pieceButtons.forEach(button => button.disabled = true);
    draw();
  }

  function coasterScore() {
    const gravityLength = pieces
      .filter(piece => !piece.powered && piece.type !== "end")
      .reduce((sum, piece) => sum + piece.length, 0) * WORLD_TO_METERS;
    const liftLength = pieces
      .filter(piece => piece.powered && piece.type !== "start")
      .reduce((sum, piece) => sum + piece.length, 0) * WORLD_TO_METERS;
    const topKmh = peakSpeed * WORLD_TO_METERS * 3.6;
    const gExcitement = clamp((peakG - 1) * 220, 0, 650);
    return Math.max(0, Math.round(900 + gravityLength * 9 + liftLength * 2 + topKmh * 17 + gExcitement));
  }

  function starRating(score) {
    if (score >= 2750) return 5;
    if (score >= 2250) return 4;
    if (score >= 1800) return 3;
    if (score >= 1450) return 2;
    return 1;
  }

  function finishRun() {
    cancelAnimationFrame(raf);
    mode = "finished";
    const score = coasterScore();
    const stars = starRating(score);
    const lengthM = Math.round(totalLength * WORLD_TO_METERS);
    const speedKmh = Math.round(peakSpeed * WORLD_TO_METERS * 3.6);
    const gText = `${nice(peakG)} g`;
    statusEl.textContent = `Complete — ${stars} star${stars === 1 ? "" : "s"}.`;
    draw();
    window.GameHubResults?.show({
      gameId: "game-08",
      difficulty: "standard",
      stars,
      score,
      title: "Coaster complete!",
      summary: stars >= 4 ? "A long, lively ride that made good use of gravity." : "It works! Now see if you can make it longer or more exciting.",
      metrics: [
        { label: "Length", value: `${lengthM} m` },
        { label: "Top speed", value: `${speedKmh} km/h` },
        { label: "Peak G", value: gText }
      ],
      againLabel: "Run again",
      onAgain: startRun
    });
  }

  function runFrame(now) {
    if (mode !== "play" || !cart) return;
    const dt = clamp((now - lastTime) / 1000, 0, 0.032);
    lastTime = now;

    const sample = sampleTrackAt(cart.s);
    if (!sample.piece) return failRun("No track", "Add a complete coaster before testing it.");

    if (sample.piece.powered) {
      const response = 3.6;
      const targetSpeed = sample.piece.type === "start" ? START_SPEED : LIFT_SPEED;
      cart.v += (targetSpeed - cart.v) * Math.min(1, response * dt);
      stallTime = 0;
    } else {
      cart.v += GRAVITY * Math.sin(sample.angle) * dt;
      cart.v -= ROLLING_DRAG * dt;
      if (cart.v < 1.0) stallTime += dt;
      else stallTime = 0;
    }

    if (cart.v <= 0.2 || stallTime > 0.55) {
      speedEl.textContent = "0 km/h";
      return failRun("The cart stalled", "It ran out of momentum before the next descent. Try a lift section or change the hills.");
    }

    cart.s += cart.v * dt;
    const after = sampleTrackAt(Math.min(cart.s, totalLength));
    const apparentG = Math.abs(cart.v * cart.v * after.curvature - GRAVITY * Math.cos(after.angle)) / GRAVITY;
    peakSpeed = Math.max(peakSpeed, cart.v);
    peakG = Math.max(peakG, apparentG);
    speedEl.textContent = `${Math.round(cart.v * WORLD_TO_METERS * 3.6)} km/h`;
    gEl.textContent = `${nice(apparentG)} g`;

    if (cart.s >= totalLength - 0.5) {
      cart.s = totalLength;
      return finishRun();
    }

    draw();
    raf = requestAnimationFrame(runFrame);
  }

  function trackBounds(includePreview = false) {
    if (!pieces.length) {
      return { minX: START_X - 80, maxX: START_X + 620, minY: START_Y - 360, maxY: START_Y + 250 };
    }
    let minX = START_X;
    let maxX = START_X;
    let minY = START_Y;
    let maxY = START_Y;
    const scanPiece = piece => {
      for (let i = 0; i <= 16; i++) {
        const p = pointOnPiece(piece, piece.length * i / 16);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    };
    pieces.forEach(scanPiece);
    if (includePreview && mode === "build") {
      const preview = nextPiecePreview(selectedType);
      if (preview.ok) {
        const meta = typeMeta[selectedType];
        scanPiece({
          x: preview.startX,
          y: preview.startY,
          angle: preview.startAngle,
          length: meta.length,
          delta: meta.delta || 0
        });
      }
    }
    return { minX, maxX, minY, maxY };
  }

  function fitCamera() {
    const bounds = trackBounds(true);
    const padX = 90;
    const padY = 75;
    const width = Math.max(300, bounds.maxX - bounds.minX);
    const height = Math.max(260, bounds.maxY - bounds.minY);
    cameraScale = clamp(Math.min((W - padX * 2) / width, (H - padY * 2) / height), MIN_ZOOM, 1.18);
    cameraCenterX = (bounds.minX + bounds.maxX) / 2;
    cameraCenterY = (bounds.minY + bounds.maxY) / 2;
    cameraMode = "fit";
    draw();
  }

  function viewTransform() {
    if (mode === "play" || mode === "failed" || mode === "finished") {
      const cartPoint = cart ? sampleTrackAt(cart.s) : { x: START_X, y: START_Y };
      const playScale = clamp(cameraScale, 0.52, 1.18);
      return {
        map: p => ({
          x: (p.x - cartPoint.x) * playScale + W * 0.34,
          y: (p.y - cartPoint.y) * playScale + H * 0.53
        }),
        scale: playScale,
        cameraX: cartPoint.x
      };
    }

    if (cameraMode === "fit") {
      const bounds = trackBounds(true);
      const padX = 90;
      const padY = 75;
      const width = Math.max(300, bounds.maxX - bounds.minX);
      const height = Math.max(260, bounds.maxY - bounds.minY);
      cameraScale = clamp(Math.min((W - padX * 2) / width, (H - padY * 2) / height), MIN_ZOOM, 1.18);
      cameraCenterX = (bounds.minX + bounds.maxX) / 2;
      cameraCenterY = (bounds.minY + bounds.maxY) / 2;
    }

    return {
      map: p => worldToScreen(p),
      scale: cameraScale,
      cameraX: cameraCenterX
    };
  }

  function drawBackground(transform) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#eef0ec";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = "rgba(39,49,60,.055)";
    ctx.lineWidth = 1;
    for (let y = 30; y < H; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let x = 20; x < W; x += 58) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    const groundY = transform.map({ x: 0, y: GROUND_Y }).y;
    if (groundY < H + 20) {
      ctx.strokeStyle = "rgba(39,49,60,.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(W, groundY);
      ctx.stroke();
      ctx.strokeStyle = "rgba(39,49,60,.12)";
      ctx.lineWidth = 1.2;
      for (let x = -20; x < W + 30; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, groundY + 2);
        ctx.lineTo(x + 13, groundY + 14);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPiece(piece, transform) {
    const samples = [];
    for (let i = 0; i <= 18; i++) {
      const p = pointOnPiece(piece, piece.length * i / 18);
      const normal = { x: -Math.sin(p.angle), y: Math.cos(p.angle) };
      const mapped = transform.map(p);
      const half = 5.2 * Math.max(0.55, transform.scale);
      samples.push({
        center: mapped,
        angle: p.angle,
        a: { x: mapped.x + normal.x * half, y: mapped.y + normal.y * half },
        b: { x: mapped.x - normal.x * half, y: mapped.y - normal.y * half }
      });
    }

    ctx.save();
    ctx.strokeStyle = piece.powered ? "#a55f59" : "#303941";
    ctx.lineWidth = 2.3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ["a", "b"].forEach(key => {
      ctx.beginPath();
      samples.forEach((sample, index) => {
        if (!index) ctx.moveTo(sample[key].x, sample[key].y);
        else ctx.lineTo(sample[key].x, sample[key].y);
      });
      ctx.stroke();
    });

    ctx.strokeStyle = piece.powered ? "rgba(165,95,89,.75)" : "rgba(48,57,65,.62)";
    ctx.lineWidth = 1.25;
    for (let i = 1; i < samples.length - 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(samples[i].a.x, samples[i].a.y);
      ctx.lineTo(samples[i].b.x, samples[i].b.y);
      ctx.stroke();
    }

    if (piece.powered && piece.type !== "start") {
      ctx.strokeStyle = "rgba(165,95,89,.72)";
      for (let i = 2; i < samples.length - 1; i += 3) {
        const c = samples[i].center;
        const tangent = { x: Math.cos(samples[i].angle), y: Math.sin(samples[i].angle) };
        const normal = { x: -tangent.y, y: tangent.x };
        ctx.beginPath();
        ctx.moveTo(c.x - tangent.x * 5 + normal.x * 10, c.y - tangent.y * 5 + normal.y * 10);
        ctx.lineTo(c.x + tangent.x * 5 + normal.x * 2, c.y + tangent.y * 5 + normal.y * 2);
        ctx.stroke();
      }
    }

    if (piece.type === "start" || piece.type === "end") {
      const anchorWorld = pointOnPiece(piece, piece.length * (piece.type === "start" ? 0.28 : 0.72));
      const anchor = transform.map(anchorWorld);
      const label = piece.type === "start" ? "START" : "END";
      ctx.fillStyle = "rgba(247,241,235,.94)";
      ctx.strokeStyle = piece.type === "start" ? "#a55f59" : "#303941";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(anchor.x - 28, anchor.y - 38, 56, 21, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = piece.type === "start" ? "#a55f59" : "#303941";
      ctx.font = "900 10px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, anchor.x, anchor.y - 27.5);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y - 17);
      ctx.lineTo(anchor.x, anchor.y - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSupport(worldPoint, transform, every = true) {
    if (!every) return;
    const top = transform.map(worldPoint);
    const bottom = transform.map({ x: worldPoint.x, y: GROUND_Y });
    if (bottom.y <= top.y + 8 || top.x < -20 || top.x > W + 20) return;
    ctx.save();
    ctx.strokeStyle = "rgba(48,57,65,.18)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y + 7);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
    const midY = (top.y + bottom.y) / 2;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y + 10);
    ctx.lineTo(top.x + 12, midY);
    ctx.lineTo(top.x, bottom.y - 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCart(transform) {
    if (!cart) return;
    const p = sampleTrackAt(cart.s);
    const c = transform.map(p);
    const scale = mode === "build" ? Math.max(0.72, transform.scale) : 1;
    ctx.save();
    ctx.translate(c.x, c.y - 13 * scale);
    ctx.rotate(p.angle);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#a55f59";
    ctx.fillStyle = "rgba(247,241,235,.96)";
    ctx.beginPath();
    ctx.roundRect(-18 * scale, -11 * scale, 36 * scale, 16 * scale, 6 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12 * scale, -11 * scale);
    ctx.lineTo(-5 * scale, -18 * scale);
    ctx.lineTo(9 * scale, -18 * scale);
    ctx.lineTo(14 * scale, -11 * scale);
    ctx.stroke();
    ctx.fillStyle = "#eef0ec";
    [-10, 10].forEach(x => {
      ctx.beginPath();
      ctx.arc(x * scale, 8 * scale, 4.1 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function draw() {
    const transform = viewTransform();
    drawBackground(transform);

    pieces.forEach((piece, index) => {
      if (index % 2 === 0 && piece.type !== "start" && piece.type !== "end") {
        drawSupport(pointOnPiece(piece, piece.length * 0.5), transform);
      }
      drawPiece(piece, transform);
    });

    if (mode === "build") {
      const preview = nextPiecePreview(selectedType);
      if (preview.ok) {
        const meta = typeMeta[selectedType];
        const ghost = {
          type: selectedType,
          x: preview.startX,
          y: preview.startY,
          angle: preview.startAngle,
          length: meta.length,
          delta: meta.delta || 0,
          powered: !!meta.powered
        };
        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.setLineDash([6, 5]);
        drawPiece(ghost, transform);
        ctx.restore();
      }
    }

    if (!pieces.length) {
      ctx.save();
      ctx.fillStyle = "rgba(39,49,60,.5)";
      ctx.font = "800 20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Build from START to END", W / 2, H / 2 - 6);
      ctx.font = "700 13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "rgba(39,49,60,.38)";
      ctx.fillText("Choose a piece below, then tap Add", W / 2, H / 2 + 22);
      ctx.restore();
    }

    if (cart) drawCart(transform);
  }

  pieceButtons.forEach(button => {
    button.addEventListener("click", () => selectPiece(button.dataset.coasterPiece));
  });
  addButton.addEventListener("click", addPiece);
  removeButton.addEventListener("click", removePiece);
  playButton.addEventListener("click", () => {
    if (mode === "play") stopRunToBuild("Run stopped — adjust the track or try again.");
    else startRun();
  });
  tryAgainButton.addEventListener("click", startRun);
  backBuildButton.addEventListener("click", () => stopRunToBuild("Adjust the track, then test it again."));

  zoomOutButton.addEventListener("click", () => setZoom(cameraScale / 1.22));
  zoomInButton.addEventListener("click", () => setZoom(cameraScale * 1.22));
  fitButton.addEventListener("click", fitCamera);

  canvas.addEventListener("pointerdown", event => {
    if (mode !== "build") return;
    panPointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    panStart = {
      x: event.clientX,
      y: event.clientY,
      centerX: cameraCenterX,
      centerY: cameraCenterY
    };
  });
  canvas.addEventListener("pointermove", event => {
    if (mode !== "build" || panPointerId !== event.pointerId || !panStart) return;
    cameraMode = "follow";
    const rect = canvas.getBoundingClientRect();
    const pxToCanvasX = W / Math.max(1, rect.width);
    const pxToCanvasY = H / Math.max(1, rect.height);
    const dx = (event.clientX - panStart.x) * pxToCanvasX;
    const dy = (event.clientY - panStart.y) * pxToCanvasY;
    cameraCenterX = panStart.centerX - dx / cameraScale;
    cameraCenterY = panStart.centerY - dy / cameraScale;
    draw();
  });
  const endPan = event => {
    if (panPointerId !== event.pointerId) return;
    panPointerId = null;
    panStart = null;
  };
  canvas.addEventListener("pointerup", endPan);
  canvas.addEventListener("pointercancel", endPan);

  // Give keyboard testing a small convenience without changing touch-first UI.
  document.addEventListener("keydown", event => {
    if (event.key === "Enter" && mode === "build" && isCompleteTrack()) startRun();
    if ((event.key === "Backspace" || event.key === "Delete") && mode === "build") {
      event.preventDefault();
      removePiece();
    }
  });

  recalcTrack();
  updateUi();
  draw();
})();
