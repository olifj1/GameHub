(() => {
  const planEl = document.getElementById("attack-plan");
  const battleEl = document.getElementById("attack-battle");
  const vehicleGrid = document.getElementById("attack-vehicle-grid");
  const queueEl = document.getElementById("attack-queue");
  const undoBtn = document.getElementById("attack-undo");
  const sendBtn = document.getElementById("attack-send");
  const sendCopy = document.getElementById("attack-send-copy");
  const roundEl = document.getElementById("attack-round");
  const cashEl = document.getElementById("attack-cash");
  const baseEl = document.getElementById("attack-base");
  const waveCountEl = document.getElementById("attack-wave-count");
  const roundNoteEl = document.getElementById("attack-round-note");
  const battleRoundEl = document.getElementById("attack-battle-round");
  const battleUnitsEl = document.getElementById("attack-battle-units");
  const battleBaseEl = document.getElementById("attack-battle-base");
  const battleStatusEl = document.getElementById("attack-battle-status");
  const speedBtn = document.getElementById("attack-speed");
  const pauseBtn = document.getElementById("attack-pause");
  const pauseOverlay = document.getElementById("attack-pause-overlay");
  const resumeBtn = document.getElementById("attack-resume");
  const abortBtn = document.getElementById("attack-abort");
  const canvas = document.getElementById("attack-canvas");
  const ctx = canvas.getContext("2d");

  const MAX_QUEUE = 8;
  const WORLD = { width: 720, height: 900 };
  const START = { x: 360, y: 850 };
  const BASE = { x: 360, y: 54 };
  const BRIDGE = { x: 352, y: 548, length: 112, width: 78 };

  const VEHICLES = {
    scout: {
      id: "scout", name: "Scout", cost: 25, speed: 92, hp: 38, armour: 0,
      attack: 0, range: 0, fireRate: 0, baseDamage: 1, body: "#d88952", accent: "#6f4b37",
      meta: "Fast · light armour"
    },
    armoured: {
      id: "armoured", name: "Armoured", cost: 45, speed: 63, hp: 92, armour: 2,
      attack: 0, range: 0, fireRate: 0, baseDamage: 2, body: "#758a72", accent: "#46584a",
      meta: "Slow · tough"
    },
    gunbuggy: {
      id: "gunbuggy", name: "Gun Buggy", cost: 120, speed: 74, hp: 68, armour: 1,
      attack: 18, range: 112, fireRate: .72, baseDamage: 2, body: "#c1874e", accent: "#55504a",
      meta: "Armed · mobile"
    },
    tank: {
      id: "tank", name: "Tank", cost: 190, speed: 52, hp: 165, armour: 5,
      attack: 30, range: 124, fireRate: 1.0, baseDamage: 4, body: "#69765f", accent: "#3f493b",
      meta: "Heavy · powerful"
    }
  };

  const TURRET_SLOTS = [
    { id: "d1", route: "direct", x: 258, y: 700, unlock: 1 },
    { id: "d2", route: "direct", x: 475, y: 568, unlock: 1 },
    { id: "w1", route: "winding", x: 592, y: 700, unlock: 1 },
    { id: "d3", route: "direct", x: 270, y: 365, unlock: 2 },
    { id: "w2", route: "winding", x: 135, y: 420, unlock: 3 },
    { id: "d4", route: "direct", x: 465, y: 215, unlock: 4 },
    { id: "w3", route: "winding", x: 180, y: 245, unlock: 5 }
  ];

  const ROUTE_DEFS = {
    direct: {
      colour: "#b36f45",
      commands: [
        ["M", [360, 850]],
        ["C", [338, 790], [332, 720], [350, 655]],
        ["C", [373, 590], [346, 527], [364, 465]],
        ["C", [387, 399], [350, 337], [371, 270]],
        ["C", [388, 205], [367, 125], [360, 54]]
      ]
    },
    winding: {
      colour: "#4f847b",
      commands: [
        ["M", [360, 850]],
        ["C", [480, 842], [612, 785], [583, 700]],
        ["C", [562, 638], [486, 608], [423, 570]],
        ["C", [354, 528], [268, 532], [226, 478]],
        ["C", [170, 407], [257, 363], [190, 304]],
        ["C", [126, 248], [220, 185], [278, 142]],
        ["C", [308, 111], [338, 81], [360, 54]]
      ]
    }
  };

  const routes = {
    direct: buildRoute(ROUTE_DEFS.direct.commands, 7),
    winding: buildRoute(ROUTE_DEFS.winding.commands, 7)
  };

  let state = {
    round: 1,
    cash: 100,
    baseHealth: 12,
    selectedRoute: "direct",
    queue: [],
    lastSummary: "Build your first wave."
  };

  let battle = null;
  let animationFrame = 0;
  let lastFrame = performance.now();
  let speedMultiplier = 1;
  let paused = false;
  let environment = makeEnvironment(52);

  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function cubic(p0, p1, p2, p3, t) {
    const it = 1 - t;
    return {
      x: it ** 3 * p0.x + 3 * it ** 2 * t * p1.x + 3 * it * t ** 2 * p2.x + t ** 3 * p3.x,
      y: it ** 3 * p0.y + 3 * it ** 2 * t * p1.y + 3 * it * t ** 2 * p2.y + t ** 3 * p3.y
    };
  }

  function buildRoute(commands, samplesPerCurve) {
    const points = [];
    let current = null;
    commands.forEach(command => {
      const [kind, ...args] = command;
      if (kind === "M") {
        current = { x: args[0][0], y: args[0][1] };
        points.push({ ...current });
      } else if (kind === "L") {
        const end = { x: args[0][0], y: args[0][1] };
        const steps = Math.max(2, Math.ceil(dist(current, end) / 28));
        for (let i = 1; i <= steps; i++) points.push({ x: lerp(current.x, end.x, i / steps), y: lerp(current.y, end.y, i / steps) });
        current = end;
      } else if (kind === "C") {
        const p1 = { x: args[0][0], y: args[0][1] };
        const p2 = { x: args[1][0], y: args[1][1] };
        const p3 = { x: args[2][0], y: args[2][1] };
        const approx = dist(current, p1) + dist(p1, p2) + dist(p2, p3);
        const steps = Math.max(samplesPerCurve, Math.ceil(approx / 18));
        for (let i = 1; i <= steps; i++) points.push(cubic(current, p1, p2, p3, i / steps));
        current = p3;
      }
    });

    let total = 0;
    points[0].d = 0;
    for (let i = 1; i < points.length; i++) {
      total += dist(points[i - 1], points[i]);
      points[i].d = total;
    }
    return { points, length: total };
  }

  function pointAtDistance(route, distanceValue) {
    const points = route.points;
    if (distanceValue <= 0) return pointWithHeading(points[0], points[1]);
    if (distanceValue >= route.length) return pointWithHeading(points[points.length - 1], points[points.length - 2], true);
    let lo = 1, hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].d < distanceValue) lo = mid + 1;
      else hi = mid;
    }
    const b = points[lo], a = points[lo - 1];
    const span = Math.max(0.0001, b.d - a.d);
    const t = (distanceValue - a.d) / span;
    return {
      x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t),
      heading: Math.atan2(b.y - a.y, b.x - a.x)
    };
  }

  function pointWithHeading(a, b, reverse = false) {
    const heading = reverse ? Math.atan2(a.y - b.y, a.x - b.x) : Math.atan2(b.y - a.y, b.x - a.x);
    return { x: a.x, y: a.y, heading };
  }

  function seededRandom(seed) {
    let x = seed >>> 0;
    return () => {
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function distanceToRoute(x, y, route) {
    let best = Infinity;
    for (let i = 0; i < route.points.length; i += 3) {
      const p = route.points[i];
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < best) best = d;
    }
    return best;
  }

  function makeEnvironment(seed) {
    const random = seededRandom(seed);
    const trees = [];
    const rocks = [];
    for (let i = 0; i < 190; i++) {
      const x = 24 + random() * 672;
      const y = 70 + random() * 785;
      if (distanceToRoute(x, y, routes.direct) < 54 || distanceToRoute(x, y, routes.winding) < 48) continue;
      if (Math.hypot(x - START.x, y - START.y) < 90 || Math.hypot(x - BASE.x, y - BASE.y) < 90) continue;
      if (TURRET_SLOTS.some(slot => Math.hypot(x - slot.x, y - slot.y) < 38)) continue;
      if (random() < .72) trees.push({ x, y, r: 9 + random() * 9, v: random() });
      else rocks.push({ x, y, r: 6 + random() * 11, v: random() });
    }
    return { trees, rocks };
  }

  function vehicleSvg(vehicle, compact = false) {
    const body = vehicle.body;
    const accent = vehicle.accent;
    const turret = vehicle.attack > 0 ? `<circle cx="16" cy="19" r="5" fill="${accent}"/><rect x="14.5" y="4" width="3" height="14" rx="1.5" fill="${accent}"/>` : "";
    const tankTracks = vehicle.id === "tank" ? `<rect x="4" y="8" width="5" height="28" rx="2.5" fill="#3d4140"/><rect x="23" y="8" width="5" height="28" rx="2.5" fill="#3d4140"/>` : `<rect x="4" y="10" width="4" height="9" rx="2" fill="#3d4140"/><rect x="24" y="10" width="4" height="9" rx="2" fill="#3d4140"/><rect x="4" y="25" width="4" height="9" rx="2" fill="#3d4140"/><rect x="24" y="25" width="4" height="9" rx="2" fill="#3d4140"/>`;
    return `<svg viewBox="0 0 32 44" aria-hidden="true">${tankTracks}<rect x="8" y="6" width="16" height="32" rx="5" fill="${body}" stroke="${accent}" stroke-width="2"/><rect x="11" y="10" width="10" height="8" rx="2" fill="#d9e3dd" opacity=".75"/>${turret}</svg>`;
  }

  function renderPlan() {
    roundEl.textContent = String(state.round);
    cashEl.textContent = `£${state.cash}`;
    baseEl.textContent = String(state.baseHealth);
    waveCountEl.textContent = `${state.queue.length} / ${MAX_QUEUE}`;
    roundNoteEl.textContent = state.lastSummary;

    document.querySelectorAll("[data-attack-route]").forEach(button => {
      button.classList.toggle("active", button.dataset.attackRoute === state.selectedRoute);
    });

    vehicleGrid.innerHTML = Object.values(VEHICLES).map(vehicle => {
      const affordable = state.cash >= vehicle.cost && state.queue.length < MAX_QUEUE;
      return `<button class="attack-vehicle-card ${affordable ? "" : "unaffordable"}" type="button" data-buy-vehicle="${vehicle.id}" ${affordable ? "" : "disabled"}>
        <span class="attack-vehicle-icon">${vehicleSvg(vehicle)}</span>
        <span class="attack-vehicle-name">${vehicle.name}</span>
        <span class="attack-vehicle-price">£${vehicle.cost}</span>
        <span class="attack-vehicle-meta">${vehicle.meta}</span>
        <span class="attack-vehicle-buy">${affordable ? `BUY · ${state.selectedRoute.toUpperCase()}` : state.cash < vehicle.cost ? "NOT ENOUGH CASH" : "WAVE FULL"}</span>
      </button>`;
    }).join("");

    vehicleGrid.querySelectorAll("[data-buy-vehicle]").forEach(button => {
      button.addEventListener("click", () => buyVehicle(button.dataset.buyVehicle));
    });

    queueEl.innerHTML = state.queue.length
      ? state.queue.map(item => `<span class="attack-queue-unit route-${item.route}" title="${VEHICLES[item.type].name} · ${item.route}">${vehicleSvg(VEHICLES[item.type], true)}</span>`).join("")
      : `<span class="attack-queue-empty">Your purchased vehicles will appear here.</span>`;

    undoBtn.disabled = state.queue.length === 0;
    sendBtn.disabled = state.queue.length === 0;
    sendCopy.textContent = state.queue.length
      ? `${state.queue.filter(v => v.route === "direct").length} direct · ${state.queue.filter(v => v.route === "winding").length} winding`
      : "Buy at least one vehicle";
  }

  function buyVehicle(type) {
    const vehicle = VEHICLES[type];
    if (!vehicle || state.cash < vehicle.cost || state.queue.length >= MAX_QUEUE) return;
    state.cash -= vehicle.cost;
    state.queue.push({ type, route: state.selectedRoute });
    renderPlan();
  }

  function undoLast() {
    const item = state.queue.pop();
    if (!item) return;
    state.cash += VEHICLES[item.type].cost;
    renderPlan();
  }

  function activeTurretSlots(round) {
    return TURRET_SLOTS.filter(slot => slot.unlock <= round);
  }

  function makeTurrets(round) {
    const stat = 1 + (round - 1) * .12;
    return activeTurretSlots(round).map(slot => ({
      ...slot,
      maxHp: Math.round(58 * stat),
      hp: Math.round(58 * stat),
      range: 112 + Math.min(20, round * 2),
      damage: 9 + Math.floor((round - 1) * 1.6),
      cooldown: .68 - Math.min(.12, (round - 1) * .015),
      timer: Math.random() * .35,
      alive: true,
      flash: 0
    }));
  }

  function makeBattleUnits(queue) {
    return queue.map((item, index) => {
      const profile = VEHICLES[item.type];
      return {
        id: `${Date.now()}-${index}`,
        type: item.type,
        routeName: item.route,
        profile,
        distance: -index * 9,
        launchAt: index * .52,
        hp: profile.hp,
        maxHp: profile.hp,
        alive: true,
        launched: false,
        reached: false,
        gunTimer: .15 + index * .07,
        x: START.x,
        y: START.y,
        heading: -Math.PI / 2,
        hitFlash: 0
      };
    });
  }

  function startWave() {
    if (!state.queue.length) return;
    const spent = state.queue.reduce((sum, item) => sum + VEHICLES[item.type].cost, 0);
    battle = {
      round: state.round,
      units: makeBattleUnits(state.queue),
      turrets: makeTurrets(state.round),
      shots: [],
      effects: [],
      elapsed: 0,
      finished: false,
      destroyedTurrets: 0,
      originalQueue: state.queue.map(item => ({ ...item })),
      spent
    };
    state.queue = [];
    planEl.hidden = true;
    battleEl.hidden = false;
    paused = false;
    speedMultiplier = 1;
    speedBtn.textContent = "1×";
    pauseOverlay.hidden = true;
    battleRoundEl.textContent = String(state.round);
    battleBaseEl.textContent = String(state.baseHealth);
    battleStatusEl.textContent = "Wave in progress";
    lastFrame = performance.now();
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(frame);
  }

  function updateBattle(dt) {
    if (!battle || battle.finished) return;
    battle.elapsed += dt;

    battle.units.forEach(unit => {
      if (!unit.alive || unit.reached) return;
      if (!unit.launched) {
        if (battle.elapsed < unit.launchAt) return;
        unit.launched = true;
      }
      const route = routes[unit.routeName];
      unit.distance += unit.profile.speed * dt;
      if (unit.distance >= route.length) {
        unit.distance = route.length;
        unit.reached = true;
        state.baseHealth = Math.max(0, state.baseHealth - unit.profile.baseDamage);
        battleBaseEl.textContent = String(state.baseHealth);
        battle.effects.push({ x: BASE.x, y: BASE.y + 18, life: .55, max: .55, kind: "base" });
        return;
      }
      const p = pointAtDistance(route, Math.max(0, unit.distance));
      unit.x = p.x; unit.y = p.y; unit.heading = p.heading;
      unit.hitFlash = Math.max(0, unit.hitFlash - dt * 6);

      if (unit.profile.attack > 0) {
        unit.gunTimer -= dt;
        if (unit.gunTimer <= 0) {
          const target = nearestTurret(unit, unit.profile.range);
          if (target) {
            unit.gunTimer = unit.profile.fireRate;
            const damage = unit.profile.attack;
            target.hp -= damage;
            target.flash = 1;
            battle.shots.push({ x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, life: .11, max: .11, team: "player" });
            if (target.hp <= 0 && target.alive) {
              target.alive = false;
              battle.destroyedTurrets += 1;
              battle.effects.push({ x: target.x, y: target.y, life: .65, max: .65, kind: "boom" });
            }
          }
        }
      }
    });

    battle.turrets.forEach(turret => {
      if (!turret.alive) return;
      turret.timer -= dt;
      turret.flash = Math.max(0, turret.flash - dt * 7);
      if (turret.timer > 0) return;
      const target = nearestUnit(turret, turret.range);
      if (!target) return;
      turret.timer = turret.cooldown;
      const finalDamage = Math.max(2, turret.damage - target.profile.armour);
      target.hp -= finalDamage;
      target.hitFlash = 1;
      battle.shots.push({ x1: turret.x, y1: turret.y, x2: target.x, y2: target.y, life: .12, max: .12, team: "enemy" });
      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        battle.effects.push({ x: target.x, y: target.y, life: .62, max: .62, kind: "boom" });
      }
    });

    battle.shots.forEach(shot => { shot.life -= dt; });
    battle.effects.forEach(effect => { effect.life -= dt; });
    battle.shots = battle.shots.filter(shot => shot.life > 0);
    battle.effects = battle.effects.filter(effect => effect.life > 0);

    const active = battle.units.filter(unit => unit.alive && !unit.reached).length;
    const waiting = battle.units.filter(unit => unit.alive && !unit.reached && !unit.launched).length;
    battleUnitsEl.textContent = String(active);
    battleStatusEl.textContent = `${battle.units.filter(u => u.reached).length} through · ${battle.units.filter(u => !u.alive).length} lost · ${battle.turrets.filter(t => !t.alive).length} turrets down`;

    if (state.baseHealth <= 0) {
      finishCampaign();
      return;
    }

    if (active === 0 && waiting === 0) finishWave();
  }

  function nearestUnit(turret, range) {
    let best = null, bestDistance = range;
    battle.units.forEach(unit => {
      if (!unit.alive || !unit.launched || unit.reached) return;
      const d = Math.hypot(unit.x - turret.x, unit.y - turret.y);
      if (d < bestDistance) { bestDistance = d; best = unit; }
    });
    return best;
  }

  function nearestTurret(unit, range) {
    let best = null, bestDistance = range;
    battle.turrets.forEach(turret => {
      if (!turret.alive) return;
      const d = Math.hypot(unit.x - turret.x, unit.y - turret.y);
      if (d < bestDistance) { bestDistance = d; best = turret; }
    });
    return best;
  }

  function finishWave() {
    if (!battle || battle.finished) return;
    battle.finished = true;
    const survivors = battle.units.filter(unit => unit.reached).length;
    const destroyed = battle.destroyedTurrets;
    const income = 70 + battle.round * 10 + survivors * 18 + destroyed * 20;
    state.cash += income;
    state.round += 1;
    state.lastSummary = `Wave complete · ${survivors} through · ${destroyed} turrets destroyed · +£${income}. Enemy defence upgraded.`;
    battleStatusEl.textContent = `Wave complete · +£${income}`;
    window.setTimeout(() => returnToPlan(), 850);
  }

  function finishCampaign() {
    if (!battle || battle.finished) return;
    battle.finished = true;
    cancelAnimationFrame(animationFrame);
    const roundWon = state.round;
    const remaining = battle.units.filter(unit => unit.reached || unit.alive).length;
    if (window.GameHubResults) {
      window.GameHubResults.show({
        gameId: "game-14",
        difficulty: "easy",
        stars: Math.max(1, Math.min(5, 6 - Math.floor(roundWon / 2))),
        score: Math.max(100, 1200 - roundWon * 80),
        title: "Breakthrough!",
        summary: "The enemy base has fallen.",
        metrics: [
          { label: "Rounds", value: roundWon },
          { label: "Cash", value: `£${state.cash}` },
          { label: "Vehicles left", value: remaining }
        ],
        againLabel: "New campaign",
        onAgain: resetCampaign
      });
    } else {
      resetCampaign();
    }
  }

  function returnToPlan() {
    cancelAnimationFrame(animationFrame);
    battle = null;
    battleEl.hidden = true;
    planEl.hidden = false;
    renderPlan();
  }

  function abortWave() {
    if (!battle) return;
    state.cash += battle.spent;
    state.queue = battle.originalQueue.map(item => ({ ...item }));
    state.lastSummary = "Wave aborted · purchases refunded.";
    paused = false;
    returnToPlan();
  }

  function resetCampaign() {
    state = { round: 1, cash: 100, baseHealth: 12, selectedRoute: "direct", queue: [], lastSummary: "Build your first wave." };
    battle = null;
    paused = false;
    window.GameHubResults?.close?.();
    battleEl.hidden = true;
    planEl.hidden = false;
    renderPlan();
  }

  function frame(now) {
    const rawDt = Math.min(.035, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!paused) updateBattle(rawDt * speedMultiplier);
    drawBattle();
    if (battle && !battle.finished) animationFrame = requestAnimationFrame(frame);
  }

  function drawBattle() {
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    drawTerrain();
    drawRoutes();
    drawBaseAndSpawn();
    drawTurrets();

    if (!battle) return;
    battle.units.filter(u => u.routeName === "winding").forEach(drawUnit);
    drawShots("enemy");
    drawRoadBridge();
    battle.units.filter(u => u.routeName === "direct").forEach(drawUnit);
    drawShots("player");
    drawEffects();
  }

  function drawTerrain() {
    ctx.fillStyle = "#cdb681";
    ctx.fillRect(0, 0, 720, 900);

    ctx.fillStyle = "#b9aa79";
    ctx.beginPath(); ctx.ellipse(120, 210, 180, 120, -.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(610, 360, 160, 190, .15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(160, 690, 210, 150, .1, 0, Math.PI * 2); ctx.fill();

    // Decorative river kept away from the drivable lanes.
    ctx.strokeStyle = "#5c9e9a"; ctx.lineWidth = 54; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-20, 360); ctx.bezierCurveTo(75, 330, 105, 405, 80, 470); ctx.bezierCurveTo(55, 535, 110, 590, 22, 625); ctx.stroke();
    ctx.strokeStyle = "#8cc3b9"; ctx.lineWidth = 34;
    ctx.beginPath(); ctx.moveTo(-20, 360); ctx.bezierCurveTo(75, 330, 105, 405, 80, 470); ctx.bezierCurveTo(55, 535, 110, 590, 22, 625); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.32)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-10, 367); ctx.bezierCurveTo(58, 350, 77, 410, 61, 455); ctx.stroke();

    environment.rocks.forEach(rock => drawRock(rock.x, rock.y, rock.r, rock.v));
    environment.trees.forEach(tree => drawTree(tree.x, tree.y, tree.r, tree.v));
  }

  function drawTree(x, y, r, v) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(56,67,49,.17)";
    ctx.beginPath(); ctx.ellipse(r * .28, r * .35, r * .9, r * .65, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = v > .5 ? "#617557" : "#6d805c";
    [[0,-.35],[-.45,.1],[.42,.12],[0,.42]].forEach(([ox,oy], i) => {
      ctx.beginPath(); ctx.arc(ox*r, oy*r, r*(i === 0 ? .62 : .54), 0, Math.PI*2); ctx.fill();
    });
    ctx.fillStyle = "rgba(191,199,136,.28)";
    ctx.beginPath(); ctx.arc(-r*.18, -r*.35, r*.22, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawRock(x, y, r, v) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(72,67,58,.16)"; ctx.beginPath(); ctx.ellipse(3, 4, r, r*.68, .2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = v > .5 ? "#9c9278" : "#a79a7d";
    ctx.beginPath(); ctx.moveTo(-r*.9, r*.2); ctx.lineTo(-r*.4,-r*.7); ctx.lineTo(r*.35,-r*.8); ctx.lineTo(r*.9,-r*.1); ctx.lineTo(r*.55,r*.65); ctx.lineTo(-r*.45,r*.7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(75,70,61,.35)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }

  function drawRouteStroke(route, edge, fill, width) {
    const pts = route.points;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = edge; ctx.lineWidth = width + 10; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = width; ctx.stroke();
  }

  function drawRoutes() {
    drawRouteStroke(routes.winding, "#ad9567", "#dbc38e", 48);
    drawRouteStroke(routes.direct, "#a78f62", "#d4b97e", 56);

    // A few understated direction marks make the two lanes read as routes.
    drawRouteArrow(routes.direct, .16, "rgba(120,87,59,.34)");
    drawRouteArrow(routes.direct, .72, "rgba(120,87,59,.34)");
    drawRouteArrow(routes.winding, .23, "rgba(70,102,92,.35)");
    drawRouteArrow(routes.winding, .72, "rgba(70,102,92,.35)");
  }

  function drawRouteArrow(route, fraction, colour) {
    const p = pointAtDistance(route, route.length * fraction);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.heading + Math.PI/2); ctx.strokeStyle = colour; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-7, 5); ctx.lineTo(0, -5); ctx.lineTo(7, 5); ctx.stroke(); ctx.restore();
  }

  function drawRoadBridge() {
    // Direct route crosses over the winding route here. The shadow hides the
    // lower road edge and the deck is redrawn above any winding vehicle.
    ctx.save(); ctx.translate(BRIDGE.x, BRIDGE.y); ctx.rotate(-.06);
    ctx.fillStyle = "rgba(65,59,50,.24)"; ctx.fillRect(-BRIDGE.width/2-8, -BRIDGE.length/2+7, BRIDGE.width+16, BRIDGE.length);
    ctx.fillStyle = "#cdb682"; ctx.fillRect(-BRIDGE.width/2, -BRIDGE.length/2, BRIDGE.width, BRIDGE.length);
    ctx.strokeStyle = "#81745f"; ctx.lineWidth = 5; ctx.strokeRect(-BRIDGE.width/2, -BRIDGE.length/2, BRIDGE.width, BRIDGE.length);
    ctx.strokeStyle = "#e7d4aa"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-BRIDGE.width/2+8,-BRIDGE.length/2); ctx.lineTo(-BRIDGE.width/2+8,BRIDGE.length/2); ctx.moveTo(BRIDGE.width/2-8,-BRIDGE.length/2); ctx.lineTo(BRIDGE.width/2-8,BRIDGE.length/2); ctx.stroke();
    ctx.restore();
  }

  function drawBaseAndSpawn() {
    ctx.save();
    // Player launch pad.
    ctx.translate(START.x, 867);
    ctx.fillStyle = "#b7a57f"; ctx.strokeStyle = "#81745f"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-74, -26, 148, 52, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8d765d"; ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(-9,0); ctx.lineTo(9,0); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Enemy monolith/base.
    ctx.save(); ctx.translate(BASE.x, 35);
    ctx.fillStyle = "#807866"; ctx.strokeStyle = "#5d594e"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-62,-30,124,62,13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#4c5b5c"; ctx.beginPath(); ctx.roundRect(-25,-17,50,38,10); ctx.fill();
    ctx.strokeStyle = "#75b9b2"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0,2,13,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  function drawTurrets() {
    const list = battle ? battle.turrets : makeTurrets(state.round);
    list.forEach(turret => {
      if (!turret.alive) return;
      ctx.save(); ctx.translate(turret.x, turret.y);
      ctx.fillStyle = "rgba(52,48,43,.18)"; ctx.beginPath(); ctx.ellipse(3,7,24,14,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = turret.flash > 0 ? "#d8b58c" : "#756e64"; ctx.strokeStyle = "#514e49"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#9a5d49"; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#514e49"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-22); ctx.stroke();
      drawHealthBar(-20,-30,40,5,turret.hp/turret.maxHp,"#b95c54");
      ctx.restore();
    });
  }

  function drawUnit(unit) {
    if (!unit.alive || !unit.launched || unit.reached) return;
    const p = unit.profile;
    ctx.save(); ctx.translate(unit.x, unit.y); ctx.rotate(unit.heading + Math.PI/2);
    if (unit.hitFlash > 0) ctx.globalAlpha = .65 + Math.sin(unit.hitFlash*30)*.25;
    ctx.fillStyle = "rgba(57,51,44,.20)"; ctx.beginPath(); ctx.ellipse(3,5,11,17,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#3f4140";
    if (unit.type === "tank") {
      ctx.fillRect(-12,-17,5,34); ctx.fillRect(7,-17,5,34);
    } else {
      [[-11,-12],[7,-12],[-11,7],[7,7]].forEach(([x,y]) => ctx.fillRect(x,y,4,8));
    }
    ctx.fillStyle = p.body; ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-8,-17,16,34,4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(222,231,224,.72)"; ctx.fillRect(-5,-12,10,8);
    if (p.attack > 0) {
      ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(0,1,5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = p.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0,-1); ctx.lineTo(0,-17); ctx.stroke();
    }
    ctx.restore();
    drawHealthBar(unit.x-14,unit.y-25,28,4,unit.hp/unit.maxHp,"#5f9777");
  }

  function drawHealthBar(x, y, w, h, ratio, colour) {
    ctx.fillStyle = "rgba(48,45,42,.68)"; ctx.beginPath(); ctx.roundRect(x,y,w,h,h/2); ctx.fill();
    ctx.fillStyle = colour; ctx.beginPath(); ctx.roundRect(x+1,y+1,Math.max(0,(w-2)*Math.max(0,Math.min(1,ratio))),h-2,(h-2)/2); ctx.fill();
  }

  function drawShots(team) {
    if (!battle) return;
    battle.shots.filter(shot => shot.team === team).forEach(shot => {
      const alpha = Math.max(0, shot.life / shot.max);
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = team === "enemy" ? "#c45d4d" : "#4f847b"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(shot.x1, shot.y1); ctx.lineTo(shot.x2, shot.y2); ctx.stroke();
      ctx.restore();
    });
  }

  function drawEffects() {
    if (!battle) return;
    battle.effects.forEach(effect => {
      const t = 1 - effect.life / effect.max;
      ctx.save(); ctx.globalAlpha = 1 - t;
      if (effect.kind === "boom") {
        ctx.fillStyle = "#d6864f"; ctx.beginPath(); ctx.arc(effect.x,effect.y,5+t*18,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ead3a0"; ctx.beginPath(); ctx.arc(effect.x,effect.y,3+t*9,0,Math.PI*2); ctx.fill();
      } else {
        ctx.strokeStyle = "#6cb7ae"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(effect.x,effect.y,9+t*20,0,Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    });
  }

  document.querySelectorAll("[data-attack-route]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedRoute = button.dataset.attackRoute;
      renderPlan();
    });
  });
  undoBtn.addEventListener("click", undoLast);
  sendBtn.addEventListener("click", startWave);
  speedBtn.addEventListener("click", () => {
    speedMultiplier = speedMultiplier === 1 ? 2 : 1;
    speedBtn.textContent = `${speedMultiplier}×`;
  });
  pauseBtn.addEventListener("click", () => {
    if (!battle || battle.finished) return;
    paused = true;
    pauseOverlay.hidden = false;
  });
  resumeBtn.addEventListener("click", () => {
    paused = false;
    pauseOverlay.hidden = true;
    lastFrame = performance.now();
  });
  abortBtn.addEventListener("click", abortWave);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && battle && !battle.finished) {
      paused = true;
      pauseOverlay.hidden = false;
    }
  });

  renderPlan();
  drawBattle();
})();
