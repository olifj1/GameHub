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
  const directInfoEl = document.getElementById("attack-direct-info");
  const windingInfoEl = document.getElementById("attack-winding-info");
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

  const MAX_QUEUE = 6;
  // A slightly narrower, taller world makes the battlefield read closer on phone
  // without enlarging the surrounding GameHub chrome.
  const WORLD = { width: 660, height: 1120 };
  const X_SCALE = WORLD.width / 720;
  const Y_SCALE = WORLD.height / 900;
  const X = value => value * X_SCALE;
  const Y = value => value * Y_SCALE;
  const START = { x: X(360), y: Y(850) };
  const BASE = { x: X(360), y: Y(54) };
  const STARTING_CASH = 90;
  const STARTING_BASE_HEALTH = 14;

  // Balance target for the first playable campaign:
  // - Round 1 cash buys roughly 2–3 light vehicles.
  // - A light turret needs about four hits to kill a Scout.
  // - Armoured vehicles survive much longer but are correspondingly expensive.
  // - Turret health/damage rises gently while extra turret positions appear more slowly.
  // - Every round gives guaranteed funding so a bad wave never soft-locks the campaign.
  const VEHICLES = {
    scout: {
      id: "scout", name: "Scout", cost: 30, speed: 95, hp: 32, armour: 0,
      attack: 0, range: 0, fireRate: 0, baseDamage: 1, body: "#d88952", accent: "#6f4b37",
      meta: "Fast · 4 light hits"
    },
    armoured: {
      id: "armoured", name: "Armoured", cost: 50, speed: 67, hp: 82, armour: 2,
      attack: 0, range: 0, fireRate: 0, baseDamage: 2, body: "#758a72", accent: "#46584a",
      meta: "Tough · soaks fire"
    },
    gunbuggy: {
      id: "gunbuggy", name: "Gun Buggy", cost: 100, speed: 76, hp: 60, armour: 1,
      attack: 18, range: 118, fireRate: .78, baseDamage: 2, body: "#c1874e", accent: "#55504a",
      meta: "Armed · anti-turret"
    },
    tank: {
      id: "tank", name: "Tank", cost: 155, speed: 54, hp: 145, armour: 5,
      attack: 27, range: 126, fireRate: .98, baseDamage: 3, body: "#69765f", accent: "#3f493b",
      meta: "Heavy · breakthrough"
    }
  };

  const ROUTE_DEFS = {
    direct: {
      colour: "#b36f45",
      commands: [
        ["M", [360, 850]],
        ["C", [346, 790], [330, 720], [344, 650]],
        ["C", [360, 584], [324, 520], [342, 458]],
        ["C", [365, 390], [330, 325], [350, 258]],
        ["C", [368, 196], [354, 122], [360, 54]]
      ]
    },
    winding: {
      colour: "#4f847b",
      commands: [
        ["M", [360, 850]],
        ["C", [474, 842], [686, 802], [674, 710]],
        ["C", [667, 640], [608, 596], [536, 560]],
        ["C", [470, 525], [365, 495], [250, 455]],
        ["C", [155, 420], [116, 350], [170, 285]],
        ["C", [215, 232], [188, 190], [252, 150]],
        ["C", [292, 124], [332, 88], [360, 54]]
      ]
    }
  };

  function scaleCommands(commands) {
    return commands.map(command => {
      if (command[0] === "M" || command[0] === "L") {
        return [command[0], [X(command[1][0]), Y(command[1][1])]];
      }
      if (command[0] === "C") {
        return ["C",
          [X(command[1][0]), Y(command[1][1])],
          [X(command[2][0]), Y(command[2][1])],
          [X(command[3][0]), Y(command[3][1])]
        ];
      }
      return command;
    });
  }

  const routes = {
    direct: buildRoute(scaleCommands(ROUTE_DEFS.direct.commands), 7),
    winding: buildRoute(scaleCommands(ROUTE_DEFS.winding.commands), 7)
  };

  // One deliberate crossover remains as a visual crossroads, but turret slots are
  // kept well away from it so it never becomes an accidental kill-box.
  const CROSSOVER = pointAtDistance(routes.direct, routes.direct.length * .46);

  // Turrets are positioned from route fractions rather than arbitrary screen points.
  // That gives predictable firing exposure and makes route balancing easier to reason about.
  const TURRET_SLOT_DEFS = [
    { id: "d1", route: "direct", fraction: .18, side: -1, offset: 92, unlock: 1 },
    { id: "d2", route: "direct", fraction: .70, side: 1, offset: 96, unlock: 1 },
    { id: "w1", route: "winding", fraction: .34, side: -1, offset: 92, unlock: 1 },
    { id: "d3", route: "direct", fraction: .80, side: 1, offset: 96, unlock: 2 },
    { id: "w2", route: "winding", fraction: .64, side: 1, offset: 94, unlock: 3 },
    { id: "d4", route: "direct", fraction: .32, side: -1, offset: 98, unlock: 4 },
    { id: "w3", route: "winding", fraction: .82, side: -1, offset: 94, unlock: 5 }
  ];

  const TURRET_SLOTS = TURRET_SLOT_DEFS.map(def => {
    const route = routes[def.route];
    const p = pointAtDistance(route, route.length * def.fraction);
    const nx = -Math.sin(p.heading);
    const ny = Math.cos(p.heading);
    return {
      ...def,
      x: p.x + nx * def.offset * def.side,
      y: p.y + ny * def.offset * def.side,
      defaultAim: p.heading + Math.PI
    };
  });

  let state = {
    round: 1,
    cash: STARTING_CASH,
    baseHealth: STARTING_BASE_HEALTH,
    selectedRoute: "direct",
    queue: [],
    lastSummary: "Build your first wave."
  };

  let battle = null;
  let animationFrame = 0;
  let lastFrame = performance.now();
  let speedMultiplier = 1;
  let paused = false;
  const environment = makeEnvironment(52);
  const staticLayer = document.createElement("canvas");
  staticLayer.width = WORLD.width;
  staticLayer.height = WORLD.height;
  const staticCtx = staticLayer.getContext("2d");
  renderStaticLayer();

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
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
        for (let i = 1; i <= steps; i++) {
          points.push({ x: lerp(current.x, end.x, i / steps), y: lerp(current.y, end.y, i / steps) });
        }
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

  function safeFromRoutes(x, y, padding = 58) {
    return distanceToRoute(x, y, routes.direct) > padding && distanceToRoute(x, y, routes.winding) > padding;
  }

  function safeFromTurrets(x, y, padding = 45) {
    return !TURRET_SLOTS.some(slot => Math.hypot(x - slot.x, y - slot.y) < padding);
  }

  function makeEnvironment(seed) {
    const random = seededRandom(seed);
    const trees = [];
    const rocks = [];
    const scrub = [];
    const texture = [];
    const patches = [];
    const grassMarks = [];

    // Large translucent washes break up the flat field and blend into one another.
    for (let i = 0; i < 30; i++) {
      patches.push({
        x: random() * WORLD.width,
        y: random() * WORLD.height,
        rx: 75 + random() * 165,
        ry: 55 + random() * 135,
        rot: random() * Math.PI,
        light: random() > .48,
        strength: .045 + random() * .07
      });
    }

    for (let i = 0; i < 940; i++) {
      texture.push({
        x: random() * WORLD.width,
        y: random() * WORLD.height,
        r: .45 + random() * 1.45,
        a: .018 + random() * .052,
        light: random() > .56
      });
    }

    for (let i = 0; i < 190; i++) {
      grassMarks.push({
        x: random() * WORLD.width,
        y: random() * WORLD.height,
        len: 3 + random() * 8,
        rot: random() * Math.PI,
        a: .035 + random() * .07
      });
    }

    for (let i = 0; i < 360; i++) {
      const x = 18 + random() * (WORLD.width - 36);
      const y = Y(48) + random() * (WORLD.height - Y(96));
      if (!safeFromRoutes(x, y, 58)) continue;
      if (!safeFromTurrets(x, y, 50)) continue;
      if (Math.hypot(x - START.x, y - START.y) < 92 || Math.hypot(x - BASE.x, y - BASE.y) < 92) continue;
      const pick = random();
      if (pick < .60) trees.push({ x, y, r: 14 + random() * 13, v: random(), rot: random() * Math.PI });
      else if (pick < .84) rocks.push({ x, y, r: 8 + random() * 15, v: random(), rot: random() * Math.PI, cluster: random() });
      else scrub.push({ x, y, r: 5 + random() * 9, v: random() });
    }

    const candidates = [
      { x: X(105), y: Y(170), type: "relay", rot: -.18 },
      { x: X(594), y: Y(300), type: "ruin", rot: .16 },
      { x: X(116), y: Y(612), type: "walls", rot: .20 },
      { x: X(582), y: Y(736), type: "bunker", rot: -.18 },
      { x: X(145), y: Y(790), type: "ruin", rot: -.14 }
    ];
    const structures = candidates.filter(s => safeFromRoutes(s.x, s.y, 88) && safeFromTurrets(s.x, s.y, 64));

    return { trees, rocks, scrub, texture, patches, grassMarks, structures };
  }

  function vehicleSvg(vehicle) {
    const body = vehicle.body;
    const accent = vehicle.accent;
    const turret = vehicle.attack > 0
      ? `<circle cx="16" cy="20" r="5" fill="${accent}"/><rect x="14.5" y="4" width="3" height="15" rx="1.5" fill="${accent}"/>`
      : "";
    const tankTracks = vehicle.id === "tank"
      ? `<rect x="3" y="7" width="6" height="30" rx="3" fill="#3d4140"/><rect x="23" y="7" width="6" height="30" rx="3" fill="#3d4140"/>`
      : `<rect x="3" y="9" width="5" height="10" rx="2" fill="#3d4140"/><rect x="24" y="9" width="5" height="10" rx="2" fill="#3d4140"/><rect x="3" y="25" width="5" height="10" rx="2" fill="#3d4140"/><rect x="24" y="25" width="5" height="10" rx="2" fill="#3d4140"/>`;
    return `<svg viewBox="0 0 32 44" aria-hidden="true">${tankTracks}<rect x="8" y="6" width="16" height="32" rx="5" fill="${body}" stroke="${accent}" stroke-width="2"/><path d="M11 10h10v8H11z" fill="#d9e3dd" opacity=".75"/>${turret}</svg>`;
  }

  function activeTurretSlots(round) {
    return TURRET_SLOTS.filter(slot => slot.unlock <= round);
  }

  function routeTurretCount(routeName, round = state.round) {
    return activeTurretSlots(round).filter(slot => slot.route === routeName).length;
  }

  function renderPlan() {
    roundEl.textContent = String(state.round);
    cashEl.textContent = `£${state.cash}`;
    baseEl.textContent = String(state.baseHealth);
    waveCountEl.textContent = `${state.queue.length} / ${MAX_QUEUE}`;
    roundNoteEl.textContent = state.lastSummary;

    const directCount = routeTurretCount("direct");
    const windingCount = routeTurretCount("winding");
    if (directInfoEl) directInfoEl.textContent = `Short · ${directCount} turret${directCount === 1 ? "" : "s"}`;
    if (windingInfoEl) windingInfoEl.textContent = `Long · ${windingCount} turret${windingCount === 1 ? "" : "s"}`;

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
      ? state.queue.map(item => `<span class="attack-queue-unit route-${item.route}" title="${VEHICLES[item.type].name} · ${item.route}">${vehicleSvg(VEHICLES[item.type])}</span>`).join("")
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

  function turretStats(round) {
    const tier = Math.max(0, round - 1);
    return {
      level: 1 + Math.floor(tier / 2),
      hp: Math.round(60 + tier * 6),
      range: 116 + Math.min(12, tier * 2),
      damage: 9 + tier * .8,
      cooldown: Math.max(.56, .68 - tier * .012)
    };
  }

  function makeTurrets(round) {
    const stat = turretStats(round);
    return activeTurretSlots(round).map((slot, index) => ({
      ...slot,
      level: stat.level,
      maxHp: stat.hp,
      hp: stat.hp,
      range: stat.range,
      damage: stat.damage,
      cooldown: stat.cooldown,
      timer: .12 + ((index * .17) % .33),
      alive: true,
      flash: 0,
      aim: slot.defaultAim
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
        launchAt: index * .48,
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
      enemyShots: 0,
      playerShots: 0,
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
        battle.effects.push({ x: BASE.x, y: BASE.y + 20, life: .58, max: .58, kind: "base" });
        return;
      }

      const p = pointAtDistance(route, Math.max(0, unit.distance));
      unit.x = p.x;
      unit.y = p.y;
      unit.heading = p.heading;
      unit.hitFlash = Math.max(0, unit.hitFlash - dt * 6);

      if (unit.profile.attack > 0) {
        unit.gunTimer -= dt;
        if (unit.gunTimer <= 0) {
          const target = nearestTurret(unit, unit.profile.range);
          if (target) {
            unit.gunTimer = unit.profile.fireRate;
            target.hp -= unit.profile.attack;
            target.flash = 1;
            battle.playerShots += 1;
            battle.shots.push({ x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, life: .12, max: .12, team: "player" });
            battle.effects.push({ x: target.x, y: target.y, life: .15, max: .15, kind: "spark" });
            if (target.hp <= 0 && target.alive) {
              target.alive = false;
              battle.destroyedTurrets += 1;
              battle.effects.push({ x: target.x, y: target.y, life: .72, max: .72, kind: "boom" });
            }
          }
        }
      }
    });

    battle.turrets.forEach(turret => {
      if (!turret.alive) return;
      turret.timer -= dt;
      turret.flash = Math.max(0, turret.flash - dt * 7);
      const target = nearestUnit(turret, turret.range);
      if (target) {
        const wanted = Math.atan2(target.y - turret.y, target.x - turret.x);
        turret.aim = approachAngle(turret.aim, wanted, dt * 7);
      }
      if (turret.timer > 0 || !target) return;

      turret.timer = turret.cooldown;
      const finalDamage = Math.max(2, turret.damage - target.profile.armour);
      target.hp -= finalDamage;
      target.hitFlash = 1;
      battle.enemyShots += 1;
      battle.shots.push({ x1: turret.x, y1: turret.y, x2: target.x, y2: target.y, life: .13, max: .13, team: "enemy" });
      battle.effects.push({ x: turret.x + Math.cos(turret.aim) * 25, y: turret.y + Math.sin(turret.aim) * 25, life: .12, max: .12, kind: "muzzle" });
      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        battle.effects.push({ x: target.x, y: target.y, life: .66, max: .66, kind: "boom" });
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

  function approachAngle(current, target, amount) {
    let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return current + delta * clamp(amount, 0, 1);
  }

  function nearestUnit(turret, range) {
    let best = null, bestDistance = range;
    battle.units.forEach(unit => {
      if (!unit.alive || !unit.launched || unit.reached) return;
      if (unit.routeName !== turret.route) return;
      const d = Math.hypot(unit.x - turret.x, unit.y - turret.y);
      if (d < bestDistance) { bestDistance = d; best = unit; }
    });
    return best;
  }

  function nearestTurret(unit, range) {
    let best = null, bestDistance = range;
    battle.turrets.forEach(turret => {
      if (!turret.alive) return;
      if (turret.route !== unit.routeName) return;
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
    const funding = 85 + battle.round * 15;
    const performance = survivors * 10 + destroyed * 12;
    const income = funding + performance;
    state.cash += income;
    state.round += 1;
    state.lastSummary = `Wave complete · ${survivors} through · ${destroyed} turrets down · +£${income} (£${funding} funding + £${performance} bonus).`;
    battleStatusEl.textContent = `Wave complete · +£${income}`;
    window.setTimeout(() => returnToPlan(), 900);
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
        score: Math.max(100, 1300 - roundWon * 90),
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
    state = {
      round: 1,
      cash: STARTING_CASH,
      baseHealth: STARTING_BASE_HEALTH,
      selectedRoute: "direct",
      queue: [],
      lastSummary: "Build your first wave."
    };
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

  function renderStaticLayer() {
    staticCtx.clearRect(0, 0, WORLD.width, WORLD.height);
    drawTerrain(staticCtx);
    drawRoutes(staticCtx);
    drawBaseAndSpawn(staticCtx);
  }

  function drawBattle() {
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    ctx.drawImage(staticLayer, 0, 0);
    drawTurrets(ctx);

    if (!battle) return;
    battle.units.forEach(unit => drawUnit(ctx, unit));
    drawShots(ctx, "enemy");
    drawShots(ctx, "player");
    drawEffects(ctx);
  }

  function drawTerrain(g) {
    g.fillStyle = "#c7b17d";
    g.fillRect(0, 0, WORLD.width, WORLD.height);

    environment.patches.forEach(patch => {
      g.save();
      g.translate(patch.x, patch.y);
      g.rotate(patch.rot);
      const colour = patch.light ? [239,220,169] : [93,94,66];
      const gradient = g.createRadialGradient(0, 0, 8, 0, 0, Math.max(patch.rx, patch.ry));
      gradient.addColorStop(0, `rgba(${colour[0]},${colour[1]},${colour[2]},${patch.strength})`);
      gradient.addColorStop(.66, `rgba(${colour[0]},${colour[1]},${colour[2]},${patch.strength * .55})`);
      gradient.addColorStop(1, `rgba(${colour[0]},${colour[1]},${colour[2]},0)`);
      g.fillStyle = gradient;
      g.beginPath();
      g.ellipse(0, 0, patch.rx, patch.ry, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });

    environment.texture.forEach(mark => {
      g.fillStyle = mark.light ? `rgba(246,229,181,${mark.a})` : `rgba(70,72,52,${mark.a})`;
      g.beginPath();
      g.arc(mark.x, mark.y, mark.r, 0, Math.PI * 2);
      g.fill();
    });

    environment.grassMarks.forEach(mark => {
      if (!safeFromRoutes(mark.x, mark.y, 28)) return;
      g.save();
      g.translate(mark.x, mark.y);
      g.rotate(mark.rot);
      g.strokeStyle = `rgba(73,83,54,${mark.a})`;
      g.lineWidth = 1.1;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-mark.len * .5, 0);
      g.quadraticCurveTo(0, -2.2, mark.len * .5, 0);
      g.stroke();
      g.restore();
    });

    // A soft decorative river sits away from the two playable routes.
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "rgba(55,79,76,.20)";
    g.lineWidth = 68;
    g.beginPath();
    g.moveTo(X(-28), Y(350));
    g.bezierCurveTo(X(70), Y(325), X(112), Y(398), X(82), Y(468));
    g.bezierCurveTo(X(54), Y(535), X(108), Y(592), X(14), Y(632));
    g.stroke();
    g.strokeStyle = "#5c9c99";
    g.lineWidth = 57;
    g.stroke();
    g.strokeStyle = "#8dc2b7";
    g.lineWidth = 37;
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,.30)";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(X(-6), Y(360));
    g.bezierCurveTo(X(57), Y(345), X(77), Y(410), X(60), Y(458));
    g.stroke();

    environment.scrub.forEach(item => drawScrub(g, item.x, item.y, item.r, item.v));
    environment.rocks.forEach(rock => drawRock(g, rock.x, rock.y, rock.r, rock.v, rock.rot, rock.cluster));
    environment.trees.forEach(tree => drawTree(g, tree.x, tree.y, tree.r, tree.v, tree.rot));
    environment.structures.forEach(structure => drawStructure(g, structure));
  }

  function drawScrub(g, x, y, r, v) {
    g.save();
    g.translate(x, y);
    g.fillStyle = "rgba(48,57,40,.14)";
    g.beginPath(); g.ellipse(2, 3, r * 1.05, r * .72, .2, 0, Math.PI * 2); g.fill();
    const dark = v > .5 ? "#667255" : "#70765a";
    const light = v > .5 ? "#8c9568" : "#91936a";
    g.fillStyle = dark;
    [[0,0],[-.55,.1],[.45,.22],[.08,-.46]].forEach(([ox, oy], i) => {
      g.beginPath();
      g.arc(ox * r, oy * r, r * (i === 0 ? .62 : .43), 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = light;
    g.beginPath(); g.arc(-r*.18,-r*.28,r*.22,0,Math.PI*2); g.fill();
    g.restore();
  }

  function drawTree(g, x, y, r, v, rot = 0) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.fillStyle = "rgba(40,51,37,.20)";
    g.beginPath();
    g.ellipse(r * .22, r * .30, r * .95, r * .78, .16, 0, Math.PI * 2);
    g.fill();

    const dark = v > .5 ? "#465f43" : "#506847";
    const mid = v > .5 ? "#5c7853" : "#647d57";
    const light = v > .5 ? "#78916a" : "#82976d";
    g.strokeStyle = "rgba(40,54,40,.38)";
    g.lineWidth = 1.5;
    g.fillStyle = dark;
    g.beginPath();
    g.arc(-r*.36,-r*.06,r*.54,0,Math.PI*2);
    g.arc(r*.34,-r*.12,r*.52,0,Math.PI*2);
    g.arc(r*.22,r*.30,r*.50,0,Math.PI*2);
    g.arc(-r*.24,r*.31,r*.49,0,Math.PI*2);
    g.fill(); g.stroke();
    g.fillStyle = mid;
    g.beginPath();
    g.arc(0,-r*.29,r*.56,0,Math.PI*2);
    g.arc(-r*.10,r*.02,r*.50,0,Math.PI*2);
    g.fill();
    g.fillStyle = light;
    g.beginPath();
    g.arc(-r*.20,-r*.30,r*.27,0,Math.PI*2);
    g.arc(r*.16,-r*.18,r*.21,0,Math.PI*2);
    g.fill();
    g.fillStyle = "rgba(79,70,47,.52)";
    g.beginPath(); g.arc(0,0,Math.max(2.2,r*.085),0,Math.PI*2); g.fill();
    g.restore();
  }

  function drawRock(g, x, y, r, v, rot = 0, cluster = .5) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const stones = cluster > .62 ? [[0,0,1],[-.72,.38,.58],[.72,.31,.48]] : [[0,0,1],[-.62,.34,.46]];
    stones.forEach(([ox,oy,scale], index) => {
      const rr = r * scale;
      g.save(); g.translate(ox*r, oy*r);
      g.fillStyle = "rgba(66,61,50,.18)";
      g.beginPath(); g.ellipse(3,5,rr*1.05,rr*.78,.2,0,Math.PI*2); g.fill();
      g.fillStyle = index ? "#968e75" : (v > .5 ? "#a29a80" : "#aea185");
      g.strokeStyle = "rgba(72,67,56,.35)"; g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(-rr*.92,rr*.15); g.lineTo(-rr*.50,-rr*.68); g.lineTo(rr*.22,-rr*.88);
      g.lineTo(rr*.90,-rr*.18); g.lineTo(rr*.58,rr*.68); g.lineTo(-rr*.40,rr*.72); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = "rgba(230,216,181,.36)";
      g.beginPath(); g.moveTo(-rr*.44,-rr*.48); g.lineTo(rr*.20,-rr*.66); g.lineTo(rr*.48,-rr*.20); g.lineTo(-rr*.02,-rr*.08); g.closePath(); g.fill();
      if (index === 0 && rr > 12) {
        g.strokeStyle = "rgba(84,75,59,.22)"; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-rr*.15,-rr*.54); g.lineTo(rr*.08,-rr*.16); g.lineTo(-rr*.08,rr*.24); g.stroke();
      }
      g.restore();
    });
    g.restore();
  }

  function drawStructure(g, structure) {
    g.save();
    g.translate(structure.x, structure.y);
    g.rotate(structure.rot || 0);
    const wall = "#817b6b";
    const wallMid = "#999078";
    const wallLight = "#b8aa8d";
    const roof = "#6e7068";
    const dark = "#55564f";
    const glow = "#6ca9a3";

    g.fillStyle = "rgba(55,50,43,.18)";
    g.beginPath(); g.ellipse(5,10,36,25,.12,0,Math.PI*2); g.fill();

    if (structure.type === "relay") {
      g.fillStyle = wallMid; g.strokeStyle = dark; g.lineWidth = 2.3;
      g.beginPath(); g.moveTo(-30,8); g.lineTo(-24,-17); g.lineTo(0,-25); g.lineTo(27,-15); g.lineTo(31,10); g.lineTo(0,22); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = roof; g.beginPath(); g.ellipse(0,-2,15,11,0,0,Math.PI*2); g.fill();
      g.strokeStyle = glow; g.lineWidth = 4; g.beginPath(); g.arc(0,-2,7,0,Math.PI*2); g.stroke();
      [-22,22].forEach(px => { g.fillStyle=wall; g.fillRect(px-4,-25,8,34); g.fillStyle=glow; g.fillRect(px-1,-19,2,18); });
    } else if (structure.type === "bunker") {
      g.fillStyle = wallMid; g.strokeStyle = dark; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-31,13); g.lineTo(-25,-15); g.lineTo(19,-20); g.lineTo(31,-8); g.lineTo(27,16); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = roof; g.beginPath(); g.roundRect(-19,-13,33,20,6); g.fill();
      g.fillStyle = "#383f3f"; g.fillRect(14,-7,10,17);
      g.fillStyle = glow; g.fillRect(16,-4,6,3);
      g.strokeStyle = "rgba(232,219,187,.36)"; g.lineWidth = 2; g.beginPath(); g.moveTo(-23,-9); g.lineTo(8,-14); g.stroke();
    } else if (structure.type === "walls") {
      g.fillStyle = wall; g.strokeStyle = dark; g.lineWidth = 2.2;
      [[-33,-9,47,11],[17,-4,16,34],[-25,10,31,9]].forEach(([x,y,w,h]) => { g.beginPath(); g.roundRect(x,y,w,h,3); g.fill(); g.stroke(); });
      g.strokeStyle = "rgba(231,216,181,.32)"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-28,-6); g.lineTo(8,-6); g.moveTo(21,0); g.lineTo(21,22); g.stroke();
      g.fillStyle = "#79725f"; g.beginPath(); g.arc(-22,15,6,0,Math.PI*2); g.fill();
    } else {
      g.fillStyle = wallMid; g.strokeStyle = dark; g.lineWidth = 2.1;
      g.beginPath(); g.moveTo(-30,-9); g.lineTo(-6,-16); g.lineTo(5,-5); g.lineTo(29,-8); g.lineTo(25,9); g.lineTo(8,12); g.lineTo(-5,6); g.lineTo(-28,12); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = wallLight; g.beginPath(); g.moveTo(-23,-7); g.lineTo(-8,-11); g.lineTo(-3,-7); g.lineTo(-19,-3); g.closePath(); g.fill();
      g.fillStyle = "#6f6958"; g.fillRect(3,-4,7,15);
    }
    g.restore();
  }

  function polygon(g, cx, cy, radius, sides) {
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI/2 + i * Math.PI * 2 / sides;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  function drawRoutePath(g, route) {
    const pts = route.points;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  }

  function drawRouteStroke(g, route, edge, fill, width) {
    drawRoutePath(g, route);
    g.strokeStyle = "rgba(83,70,48,.16)";
    g.lineWidth = width + 14;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.stroke();
    g.strokeStyle = edge;
    g.lineWidth = width + 8;
    g.stroke();
    g.strokeStyle = fill;
    g.lineWidth = width;
    g.stroke();
  }

  function drawRoutes(g) {
    drawRouteStroke(g, routes.winding, "#ad9567", "#dbc38e", 48);
    drawRouteStroke(g, routes.direct, "#a78f62", "#d4b97e", 56);

    // Blend the two road surfaces at the single crossover so it reads as a
    // simple dusty crossroads rather than one road being a bridge.
    g.fillStyle = "rgba(154,130,86,.15)";
    g.beginPath(); g.arc(CROSSOVER.x, CROSSOVER.y, 41, 0, Math.PI*2); g.fill();
    g.fillStyle = "#d6bd86";
    g.beginPath(); g.arc(CROSSOVER.x, CROSSOVER.y, 34, 0, Math.PI*2); g.fill();
    g.fillStyle = "rgba(233,212,166,.16)";
    g.beginPath(); g.arc(CROSSOVER.x-8, CROSSOVER.y-7, 19, 0, Math.PI*2); g.fill();

    // Soft wheel-wear marks help the roads feel used without turning them into race tracks.
    [
      [routes.direct, .18], [routes.direct, .48], [routes.direct, .73],
      [routes.winding, .16], [routes.winding, .52], [routes.winding, .76]
    ].forEach(([route, fraction]) => drawRoadWear(g, route, fraction));

    drawRouteArrow(g, routes.direct, .16, "rgba(120,87,59,.31)");
    drawRouteArrow(g, routes.direct, .72, "rgba(120,87,59,.31)");
    drawRouteArrow(g, routes.winding, .23, "rgba(70,102,92,.32)");
    drawRouteArrow(g, routes.winding, .72, "rgba(70,102,92,.32)");
  }

  function drawRoadWear(g, route, fraction) {
    const p = pointAtDistance(route, route.length * fraction);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.heading);
    g.strokeStyle = "rgba(104,82,53,.12)";
    g.lineWidth = 2;
    g.lineCap = "round";
    [-9, 9].forEach(offset => {
      g.beginPath();
      g.moveTo(-22, offset);
      g.lineTo(22, offset);
      g.stroke();
    });
    g.restore();
  }

  function drawRouteArrow(g, route, fraction, colour) {
    const p = pointAtDistance(route, route.length * fraction);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.heading + Math.PI / 2);
    g.strokeStyle = colour;
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-7, 5);
    g.lineTo(0, -5);
    g.lineTo(7, 5);
    g.stroke();
    g.restore();
  }

  function drawBaseAndSpawn(g) {
    g.save();
    g.translate(START.x, Y(868));
    g.fillStyle = "rgba(65,58,50,.15)";
    g.beginPath(); g.ellipse(4,9,79,31,0,0,Math.PI*2); g.fill();
    g.fillStyle = "#b7a57f";
    g.strokeStyle = "#81745f";
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(-74, -26, 148, 52, 12);
    g.fill();
    g.stroke();
    g.fillStyle = "#8d765d";
    g.beginPath();
    g.moveTo(0,-15); g.lineTo(-10,1); g.lineTo(10,1); g.closePath(); g.fill();
    g.strokeStyle = "rgba(235,216,176,.55)";
    g.lineWidth = 2;
    g.strokeRect(-49,-14,27,28); g.strokeRect(-13,-14,27,28); g.strokeRect(23,-14,27,28);
    g.restore();

    g.save();
    g.translate(BASE.x, Y(36));
    g.fillStyle = "rgba(65,58,50,.17)";
    g.beginPath(); g.ellipse(3,12,72,34,0,0,Math.PI*2); g.fill();
    g.fillStyle = "#807866";
    g.strokeStyle = "#5d594e";
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(-65,-31,130,64,13);
    g.fill();
    g.stroke();
    g.fillStyle = "#615f57";
    g.fillRect(-54,-22,13,43); g.fillRect(41,-22,13,43);
    g.fillStyle = "#4c5b5c";
    g.beginPath(); g.roundRect(-25,-17,50,39,10); g.fill();
    g.strokeStyle = "#75b9b2";
    g.lineWidth = 5;
    g.beginPath(); g.arc(0,2,13,0,Math.PI*2); g.stroke();
    g.restore();
  }

  function drawTurrets(g) {
    const list = battle ? battle.turrets : makeTurrets(state.round);
    list.forEach(turret => {
      if (!turret.alive) return;
      g.save();
      g.translate(turret.x, turret.y);

      g.fillStyle = "rgba(45,43,39,.20)";
      g.beginPath(); g.ellipse(4,9,31,20,.08,0,Math.PI*2); g.fill();

      // Layered emplacement: broad plinth, inset ring and three chunky feet.
      g.fillStyle = "#998c70";
      g.strokeStyle = "#5d5a50";
      g.lineWidth = 2.5;
      g.beginPath(); polygon(g, 0, 0, 25, 8); g.fill(); g.stroke();
      g.fillStyle = "#b0a081";
      g.beginPath(); polygon(g, 0, 0, 19, 8); g.fill();
      g.fillStyle = "#67675f";
      [0, Math.PI*2/3, Math.PI*4/3].forEach(a => {
        const fx=Math.cos(a)*22, fy=Math.sin(a)*22;
        g.save(); g.translate(fx,fy); g.rotate(a); g.beginPath(); g.roundRect(-6,-4,12,8,3); g.fill(); g.restore();
      });
      g.fillStyle = "#555a55";
      g.beginPath(); g.arc(0,0,14.5,0,Math.PI*2); g.fill();
      g.strokeStyle = "rgba(222,204,166,.35)"; g.lineWidth = 1.5;
      g.beginPath(); g.arc(0,0,11,0,Math.PI*2); g.stroke();

      if (turret.level >= 2) {
        g.fillStyle = "#847861";
        g.beginPath(); g.roundRect(-24,-6,8,12,3); g.fill();
        g.beginPath(); g.roundRect(16,-6,8,12,3); g.fill();
      }

      g.rotate(turret.aim + Math.PI / 2);
      g.fillStyle = turret.flash > 0 ? "#d9b58a" : "#74736a";
      g.strokeStyle = "#41443f";
      g.lineWidth = 2.4;
      g.beginPath(); g.roundRect(-11,-13,22,23,7); g.fill(); g.stroke();
      g.fillStyle = "#a35f4b";
      g.beginPath(); g.arc(0,-2,6,0,Math.PI*2); g.fill();
      g.fillStyle = "#d8c5a1";
      g.beginPath(); g.arc(-2,-4,2,0,Math.PI*2); g.fill();
      g.strokeStyle = "#41443f";
      g.lineWidth = 4;
      g.lineCap = "round";
      [-4,4].forEach(x => { g.beginPath(); g.moveTo(x,-10); g.lineTo(x,-31); g.stroke(); });
      g.strokeStyle = "#8d8070"; g.lineWidth = 1.4;
      [-4,4].forEach(x => { g.beginPath(); g.moveTo(x,-13); g.lineTo(x,-29); g.stroke(); });
      g.restore();
      drawHealthBar(g, turret.x-23, turret.y-35, 46, 5, turret.hp/turret.maxHp, "#b95c54");
    });
  }

  function drawUnit(g, unit) {
    if (!unit.alive || !unit.launched || unit.reached) return;
    const p = unit.profile;
    g.save();
    g.translate(unit.x, unit.y);
    g.rotate(unit.heading + Math.PI/2);
    if (unit.hitFlash > 0) g.globalAlpha = .65 + Math.sin(unit.hitFlash*30)*.25;

    g.fillStyle = "rgba(57,51,44,.20)";
    g.beginPath(); g.ellipse(3,5,12,18,0,0,Math.PI*2); g.fill();
    g.fillStyle = "#3f4140";
    if (unit.type === "tank") {
      g.beginPath(); g.roundRect(-13,-18,5,36,2); g.fill();
      g.beginPath(); g.roundRect(8,-18,5,36,2); g.fill();
    } else {
      [[-12,-13],[8,-13],[-12,7],[8,7]].forEach(([x,y]) => {
        g.beginPath(); g.roundRect(x,y,4,9,2); g.fill();
      });
    }

    g.fillStyle = p.body;
    g.strokeStyle = p.accent;
    g.lineWidth = 2;
    g.beginPath(); g.roundRect(-8,-18,16,36,4); g.fill(); g.stroke();
    g.fillStyle = "rgba(222,231,224,.74)";
    g.beginPath(); g.roundRect(-5,-13,10,8,2); g.fill();
    g.fillStyle = "rgba(255,255,255,.16)";
    g.fillRect(-5,7,10,4);

    if (p.attack > 0) {
      g.fillStyle = p.accent;
      g.beginPath(); g.arc(0,1,5,0,Math.PI*2); g.fill();
      g.strokeStyle = p.accent;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(0,-1); g.lineTo(0,-18); g.stroke();
    }
    g.restore();
    drawHealthBar(g, unit.x-14, unit.y-26, 28, 4, unit.hp/unit.maxHp, "#5f9777");
  }

  function drawHealthBar(g, x, y, w, h, ratio, colour) {
    g.fillStyle = "rgba(48,45,42,.70)";
    g.beginPath(); g.roundRect(x,y,w,h,h/2); g.fill();
    g.fillStyle = colour;
    g.beginPath(); g.roundRect(x+1,y+1,Math.max(0,(w-2)*clamp(ratio,0,1)),h-2,(h-2)/2); g.fill();
  }

  function drawShots(g, team) {
    if (!battle) return;
    battle.shots.filter(shot => shot.team === team).forEach(shot => {
      const alpha = Math.max(0, shot.life / shot.max);
      g.save();
      g.globalAlpha = alpha;
      g.strokeStyle = team === "enemy" ? "#c45d4d" : "#4f847b";
      g.lineWidth = team === "enemy" ? 3 : 2.7;
      g.lineCap = "round";
      g.beginPath(); g.moveTo(shot.x1, shot.y1); g.lineTo(shot.x2, shot.y2); g.stroke();
      g.restore();
    });
  }

  function drawEffects(g) {
    if (!battle) return;
    battle.effects.forEach(effect => {
      const t = 1 - effect.life / effect.max;
      g.save();
      g.globalAlpha = 1 - t;
      if (effect.kind === "boom") {
        g.fillStyle = "#d6864f";
        g.beginPath(); g.arc(effect.x,effect.y,5+t*18,0,Math.PI*2); g.fill();
        g.fillStyle = "#ead3a0";
        g.beginPath(); g.arc(effect.x,effect.y,3+t*9,0,Math.PI*2); g.fill();
      } else if (effect.kind === "base") {
        g.strokeStyle = "#6cb7ae";
        g.lineWidth = 4;
        g.beginPath(); g.arc(effect.x,effect.y,9+t*20,0,Math.PI*2); g.stroke();
      } else if (effect.kind === "muzzle") {
        g.fillStyle = "#efc777";
        g.beginPath(); g.arc(effect.x,effect.y,2+t*5,0,Math.PI*2); g.fill();
      } else {
        g.fillStyle = "#e7c88a";
        g.beginPath(); g.arc(effect.x,effect.y,2+t*4,0,Math.PI*2); g.fill();
      }
      g.restore();
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
