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

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function shuffled(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function angleBetween(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  }

  function angleDifference(a, b) {
    let delta = (b - a) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  function turnAmount(a, b, c) {
    return Math.abs(angleDifference(angleBetween(a, b), angleBetween(b, c)));
  }

  function pointAlong(point, angle, amount) {
    const d = unitFromAngle(angle);
    return { x: point.x + d.x * amount, y: point.y + d.y * amount };
  }

  function insideBoard(point, margin = 80) {
    return point.x >= margin && point.x <= W - margin && point.y >= margin && point.y <= H - margin;
  }

  function randomInteriorPoint(margin = 130) {
    return { x: rand(margin, W - margin), y: rand(margin, H - margin) };
  }

  function randomEdgePoint(side = pick(["left", "right", "top", "bottom"]), inset = 72) {
    const along = rand(120, 880);
    if (side === "left") return { x: inset, y: along, side };
    if (side === "right") return { x: W - inset, y: along, side };
    if (side === "top") return { x: along, y: inset, side };
    return { x: along, y: H - inset, side };
  }

  function rayDistanceToInsetBox(origin, angle, inset = 72) {
    const d = unitFromAngle(angle);
    const hits = [];
    if (d.x > 1e-7) hits.push((W - inset - origin.x) / d.x);
    if (d.x < -1e-7) hits.push((inset - origin.x) / d.x);
    if (d.y > 1e-7) hits.push((H - inset - origin.y) / d.y);
    if (d.y < -1e-7) hits.push((inset - origin.y) / d.y);
    const valid = hits.filter(value => value > 0);
    return valid.length ? Math.min(...valid) : 0;
  }

  function pointNearEdgeAlongRay(origin, angle, inset = 72) {
    const amount = rayDistanceToInsetBox(origin, angle, inset);
    return amount > 0 ? pointAlong(origin, angle, amount) : null;
  }

  function mirrorAngleFor(inAngle, outAngle) {
    return normaliseAngle(inAngle + angleDifference(inAngle, outAngle) / 2);
  }

  function pointSegmentDistance(point, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    if (len2 <= 1e-8) return distance(point, a);
    const t = clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / len2, 0, 1);
    return Math.hypot(point.x - (a.x + vx * t), point.y - (a.y + vy * t));
  }

  function segmentPairs(paths) {
    const result = [];
    paths.forEach(path => {
      for (let i = 0; i < path.length - 1; i++) result.push({ a: path[i], b: path[i + 1] });
    });
    return result;
  }

  function samePoint(a, b, tolerance = 1) {
    return distance(a, b) <= tolerance;
  }

  function routeGeometryIsClean(paths, solutionNodes, routeTargets) {
    const segments = segmentPairs(paths);
    if (segments.some(segment => distance(segment.a, segment.b) < 145)) return false;

    for (const path of paths) {
      for (let i = 1; i < path.length - 1; i++) {
        const amount = turnAmount(path[i - 1], path[i], path[i + 1]);
        if (amount < 28 || amount > 155) return false;
      }
    }

    for (const segment of segments) {
      for (const node of solutionNodes) {
        if (samePoint(node, segment.a) || samePoint(node, segment.b)) continue;
        if (pointSegmentDistance(node, segment.a, segment.b) < 72) return false;
      }
      for (const target of routeTargets) {
        if (samePoint(target, segment.b)) continue;
        if (pointSegmentDistance(target, segment.a, segment.b) < TARGET_RADIUS + 18) return false;
      }
    }
    return true;
  }

  function segmentIntersection(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const denom = cross(r, s);
    if (Math.abs(denom) < 1e-8) return false;
    const q = { x: c.x - a.x, y: c.y - a.y };
    const t = cross(q, s) / denom;
    const u = cross(q, r) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  function segmentIntersectsPolygon(a, b, polygon) {
    if (pointInPolygon(a, polygon) || pointInPolygon(b, polygon)) return true;
    for (let i = 0; i < polygon.length; i++) {
      const c = { x: polygon[i][0], y: polygon[i][1] };
      const next = polygon[(i + 1) % polygon.length];
      const d = { x: next[0], y: next[1] };
      if (segmentIntersection(a, b, c, d)) return true;
    }
    return false;
  }

  function makeIslandPolygon(cx, cy, radiusX, radiusY) {
    const count = randInt(6, 9);
    const rotation = rand(0, Math.PI * 2);
    const points = [];
    for (let i = 0; i < count; i++) {
      const a = rotation + i * Math.PI * 2 / count;
      const jitter = rand(0.78, 1.15);
      points.push([
        cx + Math.cos(a) * radiusX * jitter,
        cy + Math.sin(a) * radiusY * jitter
      ]);
    }
    return points;
  }

  function islandCandidateClear(spec, routeSegments, keyPoints, existing) {
    const radius = Math.max(spec.rx, spec.ry) * 1.18;
    if (spec.x - radius < 42 || spec.x + radius > W - 42 || spec.y - radius < 42 || spec.y + radius > H - 42) return false;
    if (routeSegments.some(segment => pointSegmentDistance(spec, segment.a, segment.b) < radius + 30)) return false;
    if (keyPoints.some(point => distance(spec, point) < radius + 58)) return false;
    if (existing.some(other => distance(spec, other) < radius + Math.max(other.rx, other.ry) * 1.1 + 36)) return false;
    return true;
  }

  function makeLineOfSightBlocker(emitterPoint, target, routeSegments, keyPoints, existing, sizeScale = 1) {
    const fractions = shuffled([0.34, 0.43, 0.52, 0.61, 0.69]);
    for (const fraction of fractions) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const x = emitterPoint.x + (target.x - emitterPoint.x) * clamp(fraction + rand(-0.045, 0.045), 0.28, 0.74);
        const y = emitterPoint.y + (target.y - emitterPoint.y) * clamp(fraction + rand(-0.045, 0.045), 0.28, 0.74);
        const rx = rand(56, 78) * sizeScale;
        const ry = rand(48, 86) * sizeScale;
        const spec = { x, y, rx, ry };
        if (!islandCandidateClear(spec, routeSegments, keyPoints, existing)) continue;
        spec.polygon = makeIslandPolygon(x, y, rx, ry);
        if (!segmentIntersectsPolygon(emitterPoint, target, spec.polygon)) continue;
        return spec;
      }
    }
    return null;
  }

  function addSpreadIslands(existing, desiredCount, routeSegments, keyPoints, difficultyName) {
    const radiusRanges = difficultyName === "easy" ? [48, 92] : difficultyName === "medium" ? [48, 108] : [45, 122];
    while (existing.length < desiredCount) {
      let best = null;
      let bestScore = -Infinity;
      for (let attempt = 0; attempt < 70; attempt++) {
        const rx = rand(radiusRanges[0], radiusRanges[1]);
        const ry = rand(radiusRanges[0] * 0.78, radiusRanges[1] * 1.05);
        const spec = {
          x: rand(85 + rx, W - 85 - rx),
          y: rand(85 + ry, H - 85 - ry),
          rx,
          ry
        };
        if (!islandCandidateClear(spec, routeSegments, keyPoints, existing)) continue;
        const nearestIsland = existing.length ? Math.min(...existing.map(other => distance(spec, other))) : 500;
        const edgeVariety = Math.min(spec.x, W - spec.x, spec.y, H - spec.y);
        const score = nearestIsland + rand(0, 120) - Math.abs(edgeVariety - rand(150, 320)) * 0.18;
        if (score > bestScore) {
          best = spec;
          bestScore = score;
        }
      }
      if (!best) break;
      best.polygon = makeIslandPolygon(best.x, best.y, best.rx, best.ry);
      existing.push(best);
    }
    return existing;
  }

  function buildIslandsForSolution(emitterPoint, routeTargets, paths, solutionNodes, difficultyName) {
    const routeSegments = segmentPairs(paths);
    const keyPoints = [emitterPoint, ...routeTargets, ...solutionNodes];
    const specs = [];
    const blockerScale = difficultyName === "hard" ? 1.05 : 1;

    for (const target of routeTargets) {
      const blocker = makeLineOfSightBlocker(emitterPoint, target, routeSegments, keyPoints, specs, blockerScale);
      if (!blocker) return null;
      specs.push(blocker);
    }

    const desired = difficultyName === "easy" ? randInt(3, 5) : difficultyName === "medium" ? randInt(5, 7) : randInt(7, 9);
    addSpreadIslands(specs, desired, routeSegments, keyPoints, difficultyName);

    const polygons = specs.map(spec => spec.polygon);
    if (polygons.length < Math.max(3, desired - 1)) return null;
    if (routeSegments.some(segment => polygons.some(polygon => segmentIntersectsPolygon(segment.a, segment.b, polygon)))) return null;
    if (routeTargets.some(target => !polygons.some(polygon => segmentIntersectsPolygon(emitterPoint, target, polygon)))) return null;
    return polygons;
  }

  function chooseEmitterForFirstNode(firstNode) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const point = randomEdgePoint();
      if (distance(point, firstNode) < 300) continue;
      return point;
    }
    return randomEdgePoint("left");
  }

  function chooseTargetAfterMirror(mirrorPoint, incomingAngle, emitterPoint, otherTargets = []) {
    for (let attempt = 0; attempt < 120; attempt++) {
      const target = randomEdgePoint();
      if (distance(mirrorPoint, target) < 260) continue;
      if (distance(emitterPoint, target) < 500) continue;
      if (otherTargets.some(other => distance(other, target) < 290)) continue;
      const turn = Math.abs(angleDifference(incomingAngle, angleBetween(mirrorPoint, target)));
      if (turn < 34 || turn > 150) continue;
      return target;
    }
    return null;
  }

  function perturbStartingAngle(solutionAngle, difficultyName) {
    const amount = difficultyName === "easy" ? rand(12, 24) : difficultyName === "medium" ? rand(18, 32) : rand(22, 38);
    return normaliseAngle(solutionAngle + (Math.random() < 0.5 ? -amount : amount));
  }

  function generateEasyCandidate() {
    const mirrorCount = Math.random() < 0.42 ? 1 : 2;
    for (let attempt = 0; attempt < 160; attempt++) {
      const emitterPoint = randomEdgePoint();
      let target = null;
      for (let targetAttempt = 0; targetAttempt < 60; targetAttempt++) {
        const candidate = randomEdgePoint();
        if (distance(emitterPoint, candidate) >= 560) {
          target = candidate;
          break;
        }
      }
      if (!target) continue;

      const mirrors = [];
      for (let i = 0; i < mirrorCount; i++) mirrors.push(randomInteriorPoint(155));
      const path = [emitterPoint, ...mirrors, target];
      const solutionNodes = mirrors.map((point, index) => ({
        id: `solution-m${index + 1}`,
        type: "mirror",
        x: point.x,
        y: point.y,
        angle: mirrorAngleFor(angleBetween(path[index], point), angleBetween(point, path[index + 2]))
      }));
      const routeTargets = [{ id: "w1", x: target.x, y: target.y, colour: "white", label: "W" }];
      if (!routeGeometryIsClean([path], solutionNodes, routeTargets)) continue;

      const islandsForLevel = buildIslandsForSolution(emitterPoint, routeTargets, [path], solutionNodes, "easy");
      if (!islandsForLevel) continue;
      const solutionAngle = angleBetween(emitterPoint, mirrors[0]);
      return {
        emitter: { x: emitterPoint.x, y: emitterPoint.y, angle: perturbStartingAngle(solutionAngle, "easy") },
        targets: routeTargets,
        islands: islandsForLevel,
        inventory: { mirrors: mirrorCount + 1, splitters: 0 },
        par: mirrorCount,
        solution: { emitterAngle: solutionAngle, nodes: solutionNodes }
      };
    }
    return null;
  }

  function generateMediumCandidate() {
    for (let attempt = 0; attempt < 220; attempt++) {
      const splitterPoint = randomInteriorPoint(270);
      const incomingAngle = rand(-180, 180);
      const preMirror = pointAlong(splitterPoint, incomingAngle + 180, rand(185, 265));
      if (!insideBoard(preMirror, 125)) continue;
      const emitterPoint = chooseEmitterForFirstNode(preMirror);
      const preTurn = Math.abs(angleDifference(angleBetween(emitterPoint, preMirror), incomingAngle));
      if (preTurn < 34 || preTurn > 150) continue;

      const blueAngle = normaliseAngle(incomingAngle + (Math.random() < 0.5 ? -1 : 1) * rand(58, 124));
      const branchWithMirror = Math.random() < 0.5 ? "red" : "blue";
      let redTarget = null;
      let blueTarget = null;
      let branchMirror = null;
      const solutionNodes = [];

      if (branchWithMirror === "red") {
        const directBlue = pointNearEdgeAlongRay(splitterPoint, blueAngle);
        if (!directBlue || distance(splitterPoint, directBlue) < 300 || distance(emitterPoint, directBlue) < 500) continue;
        blueTarget = { id: "b1", x: directBlue.x, y: directBlue.y, colour: "blue", label: "B" };
        const redMirrorPoint = pointAlong(splitterPoint, incomingAngle, rand(180, 270));
        if (!insideBoard(redMirrorPoint, 125)) continue;
        const targetPoint = chooseTargetAfterMirror(redMirrorPoint, incomingAngle, emitterPoint, [blueTarget]);
        if (!targetPoint) continue;
        redTarget = { id: "r1", x: targetPoint.x, y: targetPoint.y, colour: "red", label: "R" };
        branchMirror = {
          id: "solution-red-mirror", type: "mirror", x: redMirrorPoint.x, y: redMirrorPoint.y,
          angle: mirrorAngleFor(incomingAngle, angleBetween(redMirrorPoint, redTarget))
        };
      } else {
        const directRed = pointNearEdgeAlongRay(splitterPoint, incomingAngle);
        if (!directRed || distance(splitterPoint, directRed) < 300 || distance(emitterPoint, directRed) < 500) continue;
        redTarget = { id: "r1", x: directRed.x, y: directRed.y, colour: "red", label: "R" };
        const blueMirrorPoint = pointAlong(splitterPoint, blueAngle, rand(180, 270));
        if (!insideBoard(blueMirrorPoint, 125)) continue;
        const targetPoint = chooseTargetAfterMirror(blueMirrorPoint, blueAngle, emitterPoint, [redTarget]);
        if (!targetPoint) continue;
        blueTarget = { id: "b1", x: targetPoint.x, y: targetPoint.y, colour: "blue", label: "B" };
        branchMirror = {
          id: "solution-blue-mirror", type: "mirror", x: blueMirrorPoint.x, y: blueMirrorPoint.y,
          angle: mirrorAngleFor(blueAngle, angleBetween(blueMirrorPoint, blueTarget))
        };
      }

      if (distance(redTarget, blueTarget) < 290) continue;
      const preNode = {
        id: "solution-pre-mirror", type: "mirror", x: preMirror.x, y: preMirror.y,
        angle: mirrorAngleFor(angleBetween(emitterPoint, preMirror), incomingAngle)
      };
      const splitterNode = {
        id: "solution-splitter", type: "splitter", x: splitterPoint.x, y: splitterPoint.y,
        angle: mirrorAngleFor(incomingAngle, blueAngle)
      };
      solutionNodes.push(preNode, splitterNode, branchMirror);

      const prePath = [emitterPoint, preMirror, splitterPoint];
      const redPath = branchWithMirror === "red"
        ? [splitterPoint, { x: branchMirror.x, y: branchMirror.y }, redTarget]
        : [splitterPoint, redTarget];
      const bluePath = branchWithMirror === "blue"
        ? [splitterPoint, { x: branchMirror.x, y: branchMirror.y }, blueTarget]
        : [splitterPoint, blueTarget];
      const paths = [prePath, redPath, bluePath];
      const routeTargets = [redTarget, blueTarget];
      if (!routeGeometryIsClean(paths, solutionNodes, routeTargets)) continue;

      const islandsForLevel = buildIslandsForSolution(emitterPoint, routeTargets, paths, solutionNodes, "medium");
      if (!islandsForLevel) continue;
      const solutionAngle = angleBetween(emitterPoint, preMirror);
      return {
        emitter: { x: emitterPoint.x, y: emitterPoint.y, angle: perturbStartingAngle(solutionAngle, "medium") },
        targets: routeTargets,
        islands: islandsForLevel,
        inventory: { mirrors: 3, splitters: 1 },
        par: 3,
        solution: { emitterAngle: solutionAngle, nodes: solutionNodes }
      };
    }
    return null;
  }

  function generateHardCandidate() {
    for (let attempt = 0; attempt < 280; attempt++) {
      const splitterPoint = randomInteriorPoint(270);
      const incomingAngle = rand(-180, 180);
      const lastPreMirror = pointAlong(splitterPoint, incomingAngle + 180, rand(185, 260));
      if (!insideBoard(lastPreMirror, 125)) continue;

      const useTwoPreMirrors = Math.random() < 0.48;
      let firstPreMirror = null;
      let emitterPoint = null;
      if (useTwoPreMirrors) {
        for (let preAttempt = 0; preAttempt < 80; preAttempt++) {
          const candidate = randomInteriorPoint(145);
          if (distance(candidate, lastPreMirror) < 190) continue;
          const secondTurn = Math.abs(angleDifference(angleBetween(candidate, lastPreMirror), incomingAngle));
          if (secondTurn < 32 || secondTurn > 150) continue;
          const emitterCandidate = chooseEmitterForFirstNode(candidate);
          const firstTurn = Math.abs(angleDifference(angleBetween(emitterCandidate, candidate), angleBetween(candidate, lastPreMirror)));
          if (firstTurn < 32 || firstTurn > 150) continue;
          firstPreMirror = candidate;
          emitterPoint = emitterCandidate;
          break;
        }
        if (!firstPreMirror || !emitterPoint) continue;
      } else {
        emitterPoint = chooseEmitterForFirstNode(lastPreMirror);
        const preTurn = Math.abs(angleDifference(angleBetween(emitterPoint, lastPreMirror), incomingAngle));
        if (preTurn < 32 || preTurn > 150) continue;
      }

      const blueAngle = normaliseAngle(incomingAngle + (Math.random() < 0.5 ? -1 : 1) * rand(62, 132));
      const redMirrorPoint = pointAlong(splitterPoint, incomingAngle, rand(180, 265));
      const blueMirrorPoint = pointAlong(splitterPoint, blueAngle, rand(180, 265));
      if (!insideBoard(redMirrorPoint, 120) || !insideBoard(blueMirrorPoint, 120)) continue;
      if (distance(redMirrorPoint, blueMirrorPoint) < 190) continue;

      const redTargetPoint = chooseTargetAfterMirror(redMirrorPoint, incomingAngle, emitterPoint);
      if (!redTargetPoint) continue;
      const redTarget = { id: "r1", x: redTargetPoint.x, y: redTargetPoint.y, colour: "red", label: "R" };
      const blueTargetPoint = chooseTargetAfterMirror(blueMirrorPoint, blueAngle, emitterPoint, [redTarget]);
      if (!blueTargetPoint) continue;
      const blueTarget = { id: "b1", x: blueTargetPoint.x, y: blueTargetPoint.y, colour: "blue", label: "B" };
      if (distance(redTarget, blueTarget) < 310) continue;

      const solutionNodes = [];
      if (useTwoPreMirrors) {
        solutionNodes.push({
          id: "solution-pre-a", type: "mirror", x: firstPreMirror.x, y: firstPreMirror.y,
          angle: mirrorAngleFor(angleBetween(emitterPoint, firstPreMirror), angleBetween(firstPreMirror, lastPreMirror))
        });
      }
      solutionNodes.push({
        id: "solution-pre-b", type: "mirror", x: lastPreMirror.x, y: lastPreMirror.y,
        angle: mirrorAngleFor(angleBetween(useTwoPreMirrors ? firstPreMirror : emitterPoint, lastPreMirror), incomingAngle)
      });
      solutionNodes.push({
        id: "solution-splitter", type: "splitter", x: splitterPoint.x, y: splitterPoint.y,
        angle: mirrorAngleFor(incomingAngle, blueAngle)
      });
      solutionNodes.push({
        id: "solution-red-mirror", type: "mirror", x: redMirrorPoint.x, y: redMirrorPoint.y,
        angle: mirrorAngleFor(incomingAngle, angleBetween(redMirrorPoint, redTarget))
      });
      solutionNodes.push({
        id: "solution-blue-mirror", type: "mirror", x: blueMirrorPoint.x, y: blueMirrorPoint.y,
        angle: mirrorAngleFor(blueAngle, angleBetween(blueMirrorPoint, blueTarget))
      });

      const prePath = useTwoPreMirrors
        ? [emitterPoint, firstPreMirror, lastPreMirror, splitterPoint]
        : [emitterPoint, lastPreMirror, splitterPoint];
      const redPath = [splitterPoint, redMirrorPoint, redTarget];
      const bluePath = [splitterPoint, blueMirrorPoint, blueTarget];
      const paths = [prePath, redPath, bluePath];
      const routeTargets = [redTarget, blueTarget];
      if (!routeGeometryIsClean(paths, solutionNodes, routeTargets)) continue;

      const islandsForLevel = buildIslandsForSolution(emitterPoint, routeTargets, paths, solutionNodes, "hard");
      if (!islandsForLevel) continue;
      const firstNode = useTwoPreMirrors ? firstPreMirror : lastPreMirror;
      const solutionAngle = angleBetween(emitterPoint, firstNode);
      const hiddenMirrorCount = solutionNodes.filter(node => node.type === "mirror").length;
      const parValue = solutionNodes.length;
      return {
        emitter: { x: emitterPoint.x, y: emitterPoint.y, angle: perturbStartingAngle(solutionAngle, "hard") },
        targets: routeTargets,
        islands: islandsForLevel,
        inventory: { mirrors: Math.min(5, hiddenMirrorCount + 1), splitters: 1 },
        par: parValue,
        solution: { emitterAngle: solutionAngle, nodes: solutionNodes }
      };
    }
    return null;
  }

  function squareFallbackLevel(source) {
    const level = deepClone(source);
    level.emitter.y += LEVEL_Y_OFFSET;
    level.targets.forEach(target => { target.y += LEVEL_Y_OFFSET; });
    level.islands.forEach(polygon => polygon.forEach(point => { point[1] += LEVEL_Y_OFFSET; }));
    return level;
  }

  function solutionPasses(level) {
    if (!level?.solution) return true;
    const previous = {
      emitter, targets, islands, nodes,
      targetHits, wrongHits
    };
    try {
      emitter = { ...deepClone(level.emitter), angle: level.solution.emitterAngle };
      targets = deepClone(level.targets);
      islands = deepClone(level.islands);
      nodes = deepClone(level.solution.nodes);
      traceBeams();
      return targetHits.size === targets.length && wrongHits.size === 0;
    } catch (_) {
      return false;
    } finally {
      emitter = previous.emitter;
      targets = previous.targets;
      islands = previous.islands;
      nodes = previous.nodes;
      targetHits = previous.targetHits;
      wrongHits = previous.wrongHits;
    }
  }

  function generateLevel(difficultyName) {
    const generator = difficultyName === "easy" ? generateEasyCandidate : difficultyName === "medium" ? generateMediumCandidate : generateHardCandidate;
    for (let attempt = 0; attempt < 24; attempt++) {
      const level = generator();
      if (level && solutionPasses(level)) return level;
    }

    // A known-good layout remains as an emergency fallback only. Normal play
    // should always come from the freeform solution-first generator above.
    const set = levelSets[difficultyName];
    return squareFallbackLevel(set[randInt(0, set.length - 1)]);
  }

  function setDifficulty(next) {
    difficulty = next;
    difficultyButtons.forEach(button => button.classList.toggle("active", button.dataset.flowDifficulty === next));
    newLevel();
  }

  function newLevel() {
    baseLevel = generateLevel(difficulty);
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
