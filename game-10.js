(() => {
  "use strict";

  const W = 1000;
  const H = 1000;
  const LEGACY_H = 620;
  const LEVEL_Y_OFFSET = (H - LEGACY_H) / 2;
  const EPS = 2.5;
  const MAX_BOUNCES = 28;
  const MIRROR_LENGTH = 126;
  const SPLITTER_LENGTH = 112;
  const TARGET_RADIUS = 30;

  const board = document.getElementById("laserflow-board");
  const statusEl = document.getElementById("laserflow-status");
  const targetCountEl = document.getElementById("laserflow-target-count");
  const pieceCountEl = document.getElementById("laserflow-piece-count");
  const parEl = document.getElementById("laserflow-par");
  const mirrorsLeftEl = document.getElementById("laserflow-mirrors-left");
  const splittersLeftEl = document.getElementById("laserflow-splitters-left");
  const addMirrorButton = document.getElementById("laserflow-add-mirror");
  const addSplitterButton = document.getElementById("laserflow-add-splitter");
  const deleteButton = document.getElementById("laserflow-delete");
  const resetButton = document.getElementById("laserflow-reset");
  const newButton = document.getElementById("laserflow-new");
  const resultEl = document.getElementById("laserflow-result");
  const resultStarsEl = document.getElementById("laserflow-result-stars");
  const resultTextEl = document.getElementById("laserflow-result-text");
  const difficultyButtons = [...document.querySelectorAll("[data-flow-difficulty]")];
  const rotatePanel = document.getElementById("laserflow-rotate-panel");
  const rotateNameEl = document.getElementById("laserflow-rotate-name");
  const rotateValueEl = document.getElementById("laserflow-rotate-value");
  const rotateSlider = document.getElementById("laserflow-rotate-slider");
  const rotatePreviewLine = document.getElementById("laserflow-rotate-preview-line");

  const beamColours = {
    white: "#f1e6bd",
    red: "#e66b72",
    blue: "#679bc8"
  };

  const levelSets = {
    easy: [
      {
        emitter: { x: 74, y: 320, angle: -6 },
        targets: [{ id: "w1", x: 916, y: 286, colour: "white", label: "W" }],
        islands: [
          [[398,225],[520,206],[612,250],[626,343],[548,390],[424,370],[374,302]],
          [[690,88],[790,78],[835,130],[812,190],[712,188],[672,142]]
        ],
        inventory: { mirrors: 2, splitters: 0 },
        par: 1
      },
      {
        emitter: { x: 74, y: 255, angle: 5 },
        targets: [{ id: "w1", x: 918, y: 382, colour: "white", label: "W" }],
        islands: [
          [[370,244],[438,185],[547,190],[601,248],[580,330],[482,354],[396,324]],
          [[678,400],[760,372],[827,412],[836,485],[755,516],[676,485]]
        ],
        inventory: { mirrors: 2, splitters: 0 },
        par: 1
      }
    ],
    medium: [
      {
        emitter: { x: 72, y: 326, angle: -7 },
        targets: [
          { id: "r1", x: 918, y: 158, colour: "red", label: "R" },
          { id: "b1", x: 918, y: 476, colour: "blue", label: "B" }
        ],
        islands: [
          [[310,120],[390,88],[470,130],[464,211],[386,244],[306,200]],
          [[470,302],[555,252],[654,280],[690,365],[650,438],[548,455],[474,404]],
          [[724,88],[814,96],[849,154],[820,218],[738,214],[698,157]]
        ],
        inventory: { mirrors: 3, splitters: 1 },
        par: 3
      },
      {
        emitter: { x: 74, y: 292, angle: 4 },
        targets: [
          { id: "r1", x: 916, y: 440, colour: "red", label: "R" },
          { id: "b1", x: 916, y: 126, colour: "blue", label: "B" }
        ],
        islands: [
          [[280,250],[350,205],[420,228],[448,305],[410,372],[326,384],[270,332]],
          [[500,92],[590,75],[650,128],[640,205],[568,234],[493,188]],
          [[650,350],[730,318],[814,350],[834,430],[782,492],[690,482],[632,424]]
        ],
        inventory: { mirrors: 3, splitters: 1 },
        par: 3
      }
    ],
    hard: [
      {
        emitter: { x: 70, y: 330, angle: -8 },
        targets: [
          { id: "r1", x: 922, y: 112, colour: "red", label: "R" },
          { id: "b1", x: 922, y: 516, colour: "blue", label: "B" }
        ],
        islands: [
          [[250,95],[334,70],[400,104],[414,172],[368,226],[282,218],[228,164]],
          [[340,330],[414,278],[502,296],[526,374],[484,438],[392,446],[326,394]],
          [[535,92],[624,68],[700,108],[710,188],[652,238],[566,226],[518,166]],
          [[654,346],[736,314],[826,350],[850,424],[808,488],[714,498],[646,438]],
          [[802,210],[866,194],[902,238],[886,300],[820,314],[780,264]]
        ],
        inventory: { mirrors: 5, splitters: 1 },
        par: 4
      },
      {
        emitter: { x: 72, y: 278, angle: 8 },
        targets: [
          { id: "r1", x: 920, y: 492, colour: "red", label: "R" },
          { id: "b1", x: 920, y: 122, colour: "blue", label: "B" }
        ],
        islands: [
          [[220,248],[290,196],[372,216],[402,278],[370,340],[286,362],[222,320]],
          [[390,70],[474,56],[530,106],[520,176],[456,210],[384,166]],
          [[506,354],[584,306],[666,330],[700,400],[664,470],[578,488],[504,438]],
          [[668,108],[746,82],[824,118],[842,188],[790,242],[706,234],[650,172]],
          [[794,318],[860,300],[904,350],[892,414],[826,438],[776,388]]
        ],
        inventory: { mirrors: 5, splitters: 1 },
        par: 4
      }
    ]
  };

  let difficulty = "easy";
  let levelCounter = { easy: 0, medium: 0, hard: 0 };
  let baseLevel = null;
  let emitter = null;
  let targets = [];
  let islands = [];
  let inventory = { mirrors: 0, splitters: 0 };
  let par = 0;
  let nodes = [];
  let selectedId = "emitter";
  let dragState = null;
  let nextNodeId = 1;
  let targetHits = new Set();
  let wrongHits = new Set();
  let solvedLastFrame = false;

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // v1.2.1 keeps the existing hand-built layouts intact, but centres the
  // original 1000×620 play area inside the new square 1000×1000 board.
  // That preserves the islands' proportions and creates useful routing space
  // above and below them instead of stretching the artwork.
  function squareLevel(source) {
    const level = deepClone(source);
    level.emitter.y += LEVEL_Y_OFFSET;
    level.targets.forEach(target => { target.y += LEVEL_Y_OFFSET; });
    level.islands.forEach(polygon => polygon.forEach(point => { point[1] += LEVEL_Y_OFFSET; }));
    return level;
  }

  function setDifficulty(next) {
    difficulty = next;
    difficultyButtons.forEach(button => button.classList.toggle("active", button.dataset.flowDifficulty === next));
    newLevel(true);
  }

  function newLevel(first = false) {
    const set = levelSets[difficulty];
    const index = first ? levelCounter[difficulty] % set.length : (levelCounter[difficulty] + 1) % set.length;
    levelCounter[difficulty] = index;
    baseLevel = squareLevel(set[index]);
    resetLevel();
  }

  function resetLevel() {
    emitter = deepClone(baseLevel.emitter);
    targets = deepClone(baseLevel.targets);
    islands = deepClone(baseLevel.islands);
    inventory = deepClone(baseLevel.inventory);
    par = baseLevel.par || 0;
    nodes = [];
    selectedId = "emitter";
    dragState = null;
    nextNodeId = 1;
    solvedLastFrame = false;
    resultEl.classList.add("hidden");
    render();
    statusEl.textContent = difficulty === "easy"
      ? "Laser selected — use the rotate control below the board, then place a mirror to bend the beam."
      : "Laser selected — rotate below, then use mirrors and the splitter to route each colour.";
  }

  function svgPoint(evt) {
    const pt = board.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(board.getScreenCTM().inverse());
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function unitFromAngle(angle) {
    const r = degToRad(angle);
    return { x: Math.cos(r), y: Math.sin(r) };
  }

  function normalise(v) {
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / len, y: v.y / len };
  }

  function reflect(direction, mirrorAngle) {
    const m = unitFromAngle(mirrorAngle);
    const n = { x: -m.y, y: m.x };
    const dot = direction.x * n.x + direction.y * n.y;
    return normalise({ x: direction.x - 2 * dot * n.x, y: direction.y - 2 * dot * n.y });
  }

  function cross(a, b) {
    return a.x * b.y - a.y * b.x;
  }

  function raySegmentIntersection(origin, dir, a, b) {
    const s = { x: b.x - a.x, y: b.y - a.y };
    const q = { x: a.x - origin.x, y: a.y - origin.y };
    const denom = cross(dir, s);
    if (Math.abs(denom) < 1e-7) return null;
    const t = cross(q, s) / denom;
    const u = cross(q, dir) / denom;
    if (t > EPS && u >= 0 && u <= 1) return { t, x: origin.x + dir.x * t, y: origin.y + dir.y * t };
    return null;
  }

  function rayCircleIntersection(origin, dir, centre, radius) {
    const oc = { x: origin.x - centre.x, y: origin.y - centre.y };
    const b = 2 * (oc.x * dir.x + oc.y * dir.y);
    const c = oc.x * oc.x + oc.y * oc.y - radius * radius;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-b - root) / 2;
    const t2 = (-b + root) / 2;
    const t = t1 > EPS ? t1 : (t2 > EPS ? t2 : null);
    if (t == null) return null;
    return { t, x: origin.x + dir.x * t, y: origin.y + dir.y * t };
  }

  function boundaryIntersection(origin, dir) {
    const hits = [];
    if (dir.x > 1e-7) hits.push((W - origin.x) / dir.x);
    if (dir.x < -1e-7) hits.push((0 - origin.x) / dir.x);
    if (dir.y > 1e-7) hits.push((H - origin.y) / dir.y);
    if (dir.y < -1e-7) hits.push((0 - origin.y) / dir.y);
    const t = Math.min(...hits.filter(value => value > EPS));
    return { type: "boundary", id: "edge", t, x: origin.x + dir.x * t, y: origin.y + dir.y * t };
  }

  function nodeSegment(node) {
    const half = (node.type === "splitter" ? SPLITTER_LENGTH : MIRROR_LENGTH) / 2;
    const d = unitFromAngle(node.angle);
    return {
      a: { x: node.x - d.x * half, y: node.y - d.y * half },
      b: { x: node.x + d.x * half, y: node.y + d.y * half }
    };
  }

  function nearestHit(origin, dir, skipNodeId = null) {
    let best = boundaryIntersection(origin, dir);

    islands.forEach((polygon, islandIndex) => {
      for (let i = 0; i < polygon.length; i++) {
        const a = { x: polygon[i][0], y: polygon[i][1] };
        const next = polygon[(i + 1) % polygon.length];
        const b = { x: next[0], y: next[1] };
        const hit = raySegmentIntersection(origin, dir, a, b);
        if (hit && hit.t < best.t) best = { ...hit, type: "island", id: `island-${islandIndex}` };
      }
    });

    nodes.forEach(node => {
      if (node.id === skipNodeId) return;
      const seg = nodeSegment(node);
      const hit = raySegmentIntersection(origin, dir, seg.a, seg.b);
      if (hit && hit.t < best.t) best = { ...hit, type: node.type, id: node.id, node };
    });

    targets.forEach(target => {
      const hit = rayCircleIntersection(origin, dir, target, TARGET_RADIUS);
      if (hit && hit.t < best.t) best = { ...hit, type: "target", id: target.id, target };
    });

    return best;
  }

  function traceBeams() {
    const segments = [];
    targetHits = new Set();
    wrongHits = new Set();
    const initialDirection = unitFromAngle(emitter.angle);

    function cast(origin, dir, colour, depth, skipNodeId = null, seen = new Set()) {
      if (depth > MAX_BOUNCES) return;
      const hit = nearestHit(origin, dir, skipNodeId);
      if (!hit || !Number.isFinite(hit.t)) return;

      segments.push({ x1: origin.x, y1: origin.y, x2: hit.x, y2: hit.y, colour });

      if (hit.type === "target") {
        if (hit.target.colour === colour) targetHits.add(hit.target.id);
        else wrongHits.add(hit.target.id);
        return;
      }
      if (hit.type === "boundary" || hit.type === "island") return;

      const signature = `${hit.type}:${hit.id}:${colour}:${Math.round(hit.x)}:${Math.round(hit.y)}`;
      if (seen.has(signature)) return;
      const nextSeen = new Set(seen);
      nextSeen.add(signature);

      if (hit.type === "mirror") {
        const nextDir = reflect(dir, hit.node.angle);
        cast({ x: hit.x + nextDir.x * 3, y: hit.y + nextDir.y * 3 }, nextDir, colour, depth + 1, hit.id, nextSeen);
        return;
      }

      if (hit.type === "splitter") {
        const straight = normalise(dir);
        const reflected = reflect(dir, hit.node.angle);
        cast({ x: hit.x + straight.x * 3, y: hit.y + straight.y * 3 }, straight, "red", depth + 1, hit.id, nextSeen);
        cast({ x: hit.x + reflected.x * 3, y: hit.y + reflected.y * 3 }, reflected, "blue", depth + 1, hit.id, nextSeen);
      }
    }

    cast({ x: emitter.x + initialDirection.x * 26, y: emitter.y + initialDirection.y * 26 }, initialDirection, "white", 0);
    return segments;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function canPlaceAt(x, y, ignoreId = null) {
    if (x < 70 || x > W - 70 || y < 70 || y > H - 70) return false;
    if (Math.hypot(x - emitter.x, y - emitter.y) < 76) return false;
    if (targets.some(target => Math.hypot(x - target.x, y - target.y) < 64)) return false;
    if (islands.some(polygon => pointInPolygon({ x, y }, polygon))) return false;
    if (nodes.some(node => node.id !== ignoreId && Math.hypot(x - node.x, y - node.y) < 60)) return false;
    return true;
  }

  function countType(type) {
    return nodes.filter(node => node.type === type).length;
  }

  function findSpawnPoint() {
    const candidates = [
      [210, 860],[330, 860],[450, 860],[570, 860],[690, 860],[810, 860],
      [210, 140],[330, 140],[450, 140],[570, 140],[690, 140],[810, 140],
      [210, 500],[360, 500],[520, 500],[680, 500],[820, 500],
      [260, 760],[500, 760],[740, 760],[260, 240],[500, 240],[740, 240]
    ];
    for (const [x, y] of candidates) if (canPlaceAt(x, y)) return { x, y };
    return { x: 500, y: 850 };
  }

  function addNode(type) {
    const max = type === "mirror" ? inventory.mirrors : inventory.splitters;
    if (countType(type) >= max) {
      statusEl.textContent = type === "mirror" ? "No mirrors left. Remove one to move it elsewhere." : "No splitters left. Remove one to move it elsewhere.";
      return;
    }
    const spawn = findSpawnPoint();
    const node = { id: `n${nextNodeId++}`, type, x: spawn.x, y: spawn.y, angle: type === "mirror" ? -35 : 20 };
    nodes.push(node);
    selectedId = node.id;
    resultEl.classList.add("hidden");
    render();
    statusEl.textContent = `Drag the ${type} to move it, then use the rotate control below the board.`;
  }

  function removeSelected() {
    if (!selectedId) return;
    nodes = nodes.filter(node => node.id !== selectedId);
    selectedId = null;
    resultEl.classList.add("hidden");
    render();
  }

  function nodeById(id) {
    return nodes.find(node => node.id === id) || null;
  }

  function createSvg(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    return el;
  }

  function appendIsland(polygon, index) {
    const points = polygon.map(point => point.join(",")).join(" ");
    const shape = createSvg("polygon", { points, class: `laserflow-island island-${index % 3}` });
    board.appendChild(shape);
  }

  function appendTarget(target) {
    const group = createSvg("g", { class: `laserflow-target target-${target.colour}${targetHits.has(target.id) ? " hit" : ""}${wrongHits.has(target.id) ? " wrong" : ""}` });
    const halo = createSvg("circle", { cx: target.x, cy: target.y, r: 39, class: "laserflow-target-halo" });
    const outer = createSvg("circle", { cx: target.x, cy: target.y, r: TARGET_RADIUS, class: "laserflow-target-outer" });
    const inner = createSvg("circle", { cx: target.x, cy: target.y, r: 14, class: "laserflow-target-inner" });
    const text = createSvg("text", { x: target.x, y: target.y + 6, class: "laserflow-target-label", "text-anchor": "middle" });
    text.textContent = target.label;
    group.append(halo, outer, inner, text);
    board.appendChild(group);
  }

  function appendBeam(segment) {
    const glow = createSvg("line", {
      x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2,
      stroke: beamColours[segment.colour], class: "laserflow-beam-glow"
    });
    const line = createSvg("line", {
      x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2,
      stroke: beamColours[segment.colour], class: "laserflow-beam"
    });
    board.append(glow, line);
  }

  function appendEmitter() {
    const group = createSvg("g", { class: `laserflow-emitter-group${selectedId === "emitter" ? " selected" : ""}` });
    if (selectedId === "emitter") {
      group.appendChild(createSvg("circle", { cx: emitter.x, cy: emitter.y, r: 54, class: "laserflow-selection-ring" }));
    }

    const body = createSvg("g", {
      transform: `translate(${emitter.x} ${emitter.y}) rotate(${emitter.angle})`,
      class: "laserflow-emitter-body"
    });
    body.append(
      createSvg("rect", { x: -28, y: -17, width: 42, height: 34, rx: 6, class: "laserflow-emitter-case" }),
      createSvg("path", { d: "M14 -10 L34 -6 L34 6 L14 10 Z", class: "laserflow-emitter-nozzle" }),
      createSvg("line", { x1: -18, y1: -8, x2: -6, y2: -8, class: "laserflow-emitter-hatch" }),
      createSvg("line", { x1: -18, y1: 0, x2: -6, y2: 0, class: "laserflow-emitter-hatch" }),
      createSvg("line", { x1: -18, y1: 8, x2: -6, y2: 8, class: "laserflow-emitter-hatch" })
    );
    const hit = createSvg("circle", {
      cx: emitter.x, cy: emitter.y, r: 46, class: "laserflow-emitter-hit", "data-select": "emitter"
    });
    group.append(body, hit);
    board.appendChild(group);
  }

  function appendNode(node) {
    const selected = node.id === selectedId;
    const group = createSvg("g", { class: `laserflow-node ${node.type}${selected ? " selected" : ""}`, "data-node-id": node.id });

    if (selected) {
      group.appendChild(createSvg("circle", { cx: node.x, cy: node.y, r: 53, class: "laserflow-selection-ring" }));
    }

    if (node.type === "mirror") {
      const seg = nodeSegment(node);
      group.appendChild(createSvg("line", { x1: seg.a.x, y1: seg.a.y, x2: seg.b.x, y2: seg.b.y, class: "laserflow-mirror-back" }));
      group.appendChild(createSvg("line", { x1: seg.a.x, y1: seg.a.y, x2: seg.b.x, y2: seg.b.y, class: "laserflow-mirror-face" }));
      group.appendChild(createSvg("line", { x1: seg.a.x, y1: seg.a.y, x2: seg.b.x, y2: seg.b.y, class: "laserflow-node-hit", "data-drag": "move", "data-node-id": node.id }));
      group.appendChild(createSvg("circle", { cx: node.x, cy: node.y, r: 10, class: "laserflow-node-centre", "data-drag": "move", "data-node-id": node.id }));
    } else {
      const visual = createSvg("g", { transform: `translate(${node.x} ${node.y}) rotate(${node.angle})`, class: "laserflow-prism-visual", "data-drag": "move", "data-node-id": node.id });
      visual.append(
        createSvg("polygon", { points: "-43,-24 43,0 -43,24", class: "laserflow-prism" }),
        createSvg("line", { x1: -24, y1: -10, x2: -10, y2: -10, class: "laserflow-prism-hatch" }),
        createSvg("line", { x1: -24, y1: 0, x2: -6, y2: 0, class: "laserflow-prism-hatch" }),
        createSvg("line", { x1: -24, y1: 10, x2: -2, y2: 10, class: "laserflow-prism-hatch" }),
        createSvg("circle", { cx: 5, cy: -7, r: 5, class: "laserflow-prism-red" }),
        createSvg("circle", { cx: 5, cy: 7, r: 5, class: "laserflow-prism-blue" })
      );
      group.appendChild(visual);
      const seg = nodeSegment(node);
      group.appendChild(createSvg("line", { x1: seg.a.x, y1: seg.a.y, x2: seg.b.x, y2: seg.b.y, class: "laserflow-node-hit", "data-drag": "move", "data-node-id": node.id }));
    }

    board.appendChild(group);
  }

  function appendBoardDefs() {
    const defs = createSvg("defs");
    const pattern = createSvg("pattern", { id: "laserflow-island-hatch", width: 24, height: 24, patternUnits: "userSpaceOnUse", patternTransform: "rotate(38)" });
    pattern.appendChild(createSvg("rect", { x: 0, y: 0, width: 24, height: 24, class: "laserflow-hatch-base" }));
    pattern.appendChild(createSvg("line", { x1: 2, y1: 0, x2: 2, y2: 24, class: "laserflow-hatch-line" }));
    defs.appendChild(pattern);
    board.appendChild(defs);
  }

  function normaliseAngle(angle) {
    let value = Number(angle) || 0;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  }

  function selectedSubject() {
    if (selectedId === "emitter") return { type: "Laser", object: emitter };
    const node = nodeById(selectedId);
    if (!node) return null;
    return { type: node.type === "mirror" ? "Mirror" : "Splitter", object: node };
  }

  function updateRotateUi() {
    const selected = selectedSubject();
    const disabled = !selected;
    rotatePanel.classList.toggle("disabled", disabled);
    rotateSlider.disabled = disabled;
    if (!selected) {
      rotateNameEl.textContent = "Select an optic";
      rotateValueEl.textContent = "—";
      rotatePreviewLine.style.transform = "rotate(0deg)";
      return;
    }
    const angle = normaliseAngle(selected.object.angle);
    rotateNameEl.textContent = selected.type;
    rotateValueEl.textContent = `${Math.round(angle)}°`;
    rotateSlider.value = String(angle);
    rotatePreviewLine.style.transform = `rotate(${angle}deg)`;
  }

  function updateHud(solved) {
    const mirrorCount = countType("mirror");
    const splitterCount = countType("splitter");
    const pieces = nodes.length;
    mirrorsLeftEl.textContent = `${inventory.mirrors - mirrorCount} / ${inventory.mirrors}`;
    splittersLeftEl.textContent = `${inventory.splitters - splitterCount} / ${inventory.splitters}`;
    targetCountEl.textContent = `${targetHits.size} / ${targets.length}`;
    pieceCountEl.textContent = `${pieces} / ${inventory.mirrors + inventory.splitters}`;
    parEl.textContent = par || "—";
    addMirrorButton.disabled = mirrorCount >= inventory.mirrors;
    addSplitterButton.disabled = splitterCount >= inventory.splitters;
    addSplitterButton.classList.toggle("hidden", inventory.splitters === 0);
    deleteButton.disabled = !selectedId || selectedId === "emitter";
    updateRotateUi();

    if (solved && !solvedLastFrame) {
      const stars = par > 0 ? Math.max(1, 5 - Math.max(0, pieces - par)) : 5;
      resultStarsEl.textContent = "★".repeat(stars) + "☆".repeat(5 - stars);
      resultTextEl.textContent = pieces <= par ? `Solved at ${pieces} piece${pieces === 1 ? "" : "s"} — at or under par.` : `Solved with ${pieces} pieces. Par is ${par}.`;
      resultEl.classList.remove("hidden");
      statusEl.textContent = "Every target received the right colour.";
      saveProgress(stars, pieces);
    } else if (!solved) {
      resultEl.classList.add("hidden");
    }
    solvedLastFrame = solved;
  }

  function saveProgress(stars, pieces) {
    try {
      const all = JSON.parse(localStorage.getItem("gameHubProgress") || "{}");
      const game = all["game-10"] || {};
      const key = difficulty;
      const previous = game[key] || {};
      game[key] = {
        stars: Math.max(previous.stars || 0, stars),
        bestPieces: previous.bestPieces ? Math.min(previous.bestPieces, pieces) : pieces
      };
      all["game-10"] = game;
      localStorage.setItem("gameHubProgress", JSON.stringify(all));
    } catch (_) {}
  }

  function render() {
    board.innerHTML = "";
    appendBoardDefs();
    board.appendChild(createSvg("rect", { x: 0, y: 0, width: W, height: H, rx: 32, class: "laserflow-board-bg" }));

    islands.forEach(appendIsland);
    const segments = traceBeams();
    segments.forEach(appendBeam);
    targets.forEach(appendTarget);
    appendEmitter();
    nodes.forEach(appendNode);

    const solved = targets.length > 0 && targetHits.size === targets.length;
    updateHud(solved);
  }

  board.addEventListener("pointerdown", evt => {
    const control = evt.target.closest?.("[data-drag], [data-select]") || evt.target;
    const dragType = control.dataset.drag;
    const nodeId = control.dataset.nodeId;
    const selectType = control.dataset.select;

    if (selectType === "emitter") {
      evt.preventDefault();
      selectedId = "emitter";
      statusEl.textContent = "Laser selected — use the rotate control below the board.";
      render();
      return;
    }

    if (!dragType) {
      selectedId = null;
      render();
      return;
    }

    evt.preventDefault();
    const p = svgPoint(evt);
    const node = nodeById(nodeId);
    if (!node) return;
    selectedId = node.id;
    dragState = {
      pointerId: evt.pointerId,
      type: "move",
      nodeId: node.id,
      offsetX: node.x - p.x,
      offsetY: node.y - p.y
    };
    board.setPointerCapture(evt.pointerId);
    statusEl.textContent = `${node.type === "mirror" ? "Mirror" : "Splitter"} selected — drag to move, rotate below.`;
    render();
  });

  board.addEventListener("pointermove", evt => {
    if (!dragState || dragState.pointerId !== evt.pointerId) return;
    evt.preventDefault();
    const p = svgPoint(evt);
    const node = nodeById(dragState.nodeId);
    if (!node) return;

    const nextX = clamp(p.x + dragState.offsetX, 65, W - 65);
    const nextY = clamp(p.y + dragState.offsetY, 65, H - 65);
    if (canPlaceAt(nextX, nextY, node.id)) {
      node.x = nextX;
      node.y = nextY;
    }

    resultEl.classList.add("hidden");
    render();
  });

  function endDrag(evt) {
    if (!dragState || dragState.pointerId !== evt.pointerId) return;
    dragState = null;
    try { board.releasePointerCapture(evt.pointerId); } catch (_) {}
    render();
  }

  board.addEventListener("pointerup", endDrag);
  board.addEventListener("pointercancel", endDrag);

  rotateSlider.addEventListener("input", () => {
    const selected = selectedSubject();
    if (!selected) return;
    selected.object.angle = Number(rotateSlider.value);
    resultEl.classList.add("hidden");
    render();
  });

  addMirrorButton.addEventListener("click", () => addNode("mirror"));
  addSplitterButton.addEventListener("click", () => addNode("splitter"));
  deleteButton.addEventListener("click", removeSelected);
  resetButton.addEventListener("click", resetLevel);
  newButton.addEventListener("click", () => newLevel(false));
  difficultyButtons.forEach(button => button.addEventListener("click", () => setDifficulty(button.dataset.flowDifficulty)));

  setDifficulty("easy");
})();
