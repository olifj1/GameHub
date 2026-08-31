(() => {
  "use strict";

  const W = 1000;
  const H = 1000;
  const LEGACY_H = 620;
  const LEVEL_Y_OFFSET = (H - LEGACY_H) / 2;
  const EPS = 2.5;
  const MAX_BOUNCES = 28;
  const MIRROR_LENGTH = 126;
  const PRISM_RADIUS = 44;
  const TARGET_RADIUS = 30;
  const CHECKPOINT_RADIUS = 22;
  const RGB_FACE_OFFSET = 45;

  const board = document.getElementById("laserflow-board");
  const statusEl = document.getElementById("laserflow-status");
  const targetCountEl = document.getElementById("laserflow-target-count");
  const checkpointCountEl = document.getElementById("laserflow-checkpoint-count");
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
    green: "#78a878",
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

  const HARD_FALLBACK_LEVEL = {"emitter":{"x":324.5194497101546,"y":72,"angle":-162.2237659435615},"targets":[{"id":"r1","x":896.5562632983246,"y":928,"colour":"red","label":"R"},{"id":"g1","x":529.3878951488298,"y":928,"colour":"green","label":"G"},{"id":"b1","x":72,"y":774.9942618186005,"colour":"blue","label":"B"}],"checkpoints":[{"id":"c1","x":904.3859914482433,"y":674.0861516788191,"colour":"red","label":"R"},{"id":"c2","x":600.7985344253505,"y":882.1202940747706,"colour":"green","label":"G"},{"id":"c3","x":110.15937759550249,"y":565.714218987574,"colour":"blue","label":"B"}],"islands":[[[377.40900689344386,443.3834668337049],[470.7545553153527,354.5247389942332],[613.1730111580531,319.04897808875126],[713.3552891981127,434.2736872759849],[753.9576520468452,598.4637587216205],[605.0365952259483,676.8592099984186],[445.66059245151007,723.172278625623],[320.317468443955,596.9588414836292]],[[209.1982021760437,326.4897077032087],[218.8991912526305,290.23412442004667],[255.14062271575372,296.03249438158014],[279.3757637454695,314.36380217365576],[291.46260732583676,342.58008953733827],[282.3630059769348,374.1239603163098],[254.20802386478485,397.24095150272075],[217.5810687510825,388.6023676296112],[207.1223559068791,354.5681642338112]],[[127.13017626917437,853.4330396640471],[153.50266272978058,826.7030768984051],[190.5252707249936,834.2781369806261],[229.03936745339726,838.05682533083],[225.37368792951804,871.6796250311518],[221.63572228750672,900.2654259110682],[191.69052518536643,917.7581958377609],[157.3738175750352,908.9533861159617],[132.37256511890246,887.0025111131963]],[[208.83521681272643,670.1698737797049],[225.07550178303208,690.4560308986855],[212.02802253253384,714.4945840246867],[179.01625438976157,723.7302058400005],[160.4798893815685,700.9010436277791],[151.4243637801233,674.5801600533017],[182.693698458222,665.6587703525136]],[[880.9774349577885,142.6798996970841],[833.941258861074,136.17862913972812],[812.4073874548594,114.49165167030444],[812.0581744493611,86.87825083631961],[852.6270208219269,68.6739814027527],[888.4182940064412,88.97614895538484],[910.2126847434386,115.35170041983756]],[[356.5898702618104,787.997258159393],[396.96361126982754,802.6842843682384],[413.25938534600743,828.5365651221648],[404.90739180717003,860.2771294501393],[360.7969607304555,869.5135575505939],[329.4320718706124,846.2581003501411],[320.8534429701965,812.6584558882066]]],"inventory":{"mirrors":5,"splitters":1},"prismMode":"rgb","prismSign":1,"par":5,"solution":{"emitterAngle":162.769237075088,"nodes":[{"id":"solution-pre","type":"mirror","x":173.01193583986878,"y":118.98856611301275,"angle":88.29027179555493},{"id":"solution-prism","type":"splitter","mode":"rgb","rgbSign":1,"x":772.0225052030567,"y":266.2450176006473,"angle":53.43357290087604},{"id":"solution-red-mirror","type":"mirror","x":915.8717908116191,"y":301.6078916986247,"angle":52.788764344485735},{"id":"solution-green-mirror","type":"mirror","x":744.057548642076,"y":790.079647050866,"angle":120.16801001678752},{"id":"solution-blue-mirror","type":"mirror","x":170.61762808748574,"y":234.13896672396106,"angle":141.69471341441272}]}};

  let difficulty = "easy";
  let levelCounter = { easy: 0, medium: 0, hard: 0 };
  let baseLevel = null;
  let emitter = null;
  let targets = [];
  let checkpoints = [];
  let islands = [];
  let inventory = { mirrors: 0, splitters: 0 };
  let par = 0;
  let nodes = [];
  let selectedId = "emitter";
  let dragState = null;
  let nextNodeId = 1;
  let targetHits = new Set();
  let checkpointHits = new Set();
  let wrongHits = new Set();
  let prismMode = "rb";
  let prismSign = 1;
  let solvedLastFrame = false;
  let placementType = null;

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

  function pointClearOfPolygon(point, polygon, padding = 0) {
    if (pointInPolygon(point, polygon)) return false;
    if (padding <= 0) return true;
    for (let i = 0; i < polygon.length; i++) {
      const a = { x: polygon[i][0], y: polygon[i][1] };
      const next = polygon[(i + 1) % polygon.length];
      const b = { x: next[0], y: next[1] };
      if (pointSegmentDistance(point, a, b) < padding) return false;
    }
    return true;
  }

  function createCentralMass(difficultyName) {
    const ranges = difficultyName === "easy"
      ? { rx: [175, 215], ry: [180, 235], offset: 72 }
      : difficultyName === "medium"
        ? { rx: [190, 235], ry: [200, 255], offset: 78 }
        : { rx: [205, 255], ry: [215, 275], offset: 86 };
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 500 + rand(-ranges.offset, ranges.offset);
      const y = 500 + rand(-ranges.offset, ranges.offset);
      const rx = rand(...ranges.rx);
      const ry = rand(...ranges.ry);
      const polygon = makeIslandPolygon(x, y, rx, ry);
      if (polygon.every(([px, py]) => px > 95 && px < W - 95 && py > 95 && py < H - 95)) {
        return { x, y, rx, ry, polygon, central: true };
      }
    }
    const x = 500, y = 500, rx = 205, ry = 225;
    return { x, y, rx, ry, polygon: makeIslandPolygon(x, y, rx, ry), central: true };
  }

  function routeAvoidsPolygon(paths, polygon) {
    return !segmentPairs(paths).some(segment => segmentIntersectsPolygon(segment.a, segment.b, polygon));
  }

  function islandCandidateClear(spec, routeSegments, keyPoints, existing) {
    const radius = Math.max(spec.rx, spec.ry) * 1.18;
    if (spec.x - radius < 42 || spec.x + radius > W - 42 || spec.y - radius < 42 || spec.y + radius > H - 42) return false;
    if (routeSegments.some(segment => pointSegmentDistance(spec, segment.a, segment.b) < radius + 30)) return false;
    if (keyPoints.some(point => distance(spec, point) < radius + 58)) return false;
    if (existing.some(other => distance(spec, other) < radius + Math.max(other.rx, other.ry) * 1.05 + 28)) return false;
    return true;
  }

  function makeLineOfSightBlocker(emitterPoint, target, routeSegments, keyPoints, existing, sizeScale = 1) {
    const fractions = shuffled([0.34, 0.43, 0.52, 0.61, 0.69]);
    for (const fraction of fractions) {
      for (let attempt = 0; attempt < 7; attempt++) {
        const x = emitterPoint.x + (target.x - emitterPoint.x) * clamp(fraction + rand(-0.045, 0.045), 0.28, 0.74);
        const y = emitterPoint.y + (target.y - emitterPoint.y) * clamp(fraction + rand(-0.045, 0.045), 0.28, 0.74);
        const rx = rand(42, 68) * sizeScale;
        const ry = rand(38, 74) * sizeScale;
        const spec = { x, y, rx, ry };
        if (!islandCandidateClear(spec, routeSegments, keyPoints, existing)) continue;
        spec.polygon = makeIslandPolygon(x, y, rx, ry);
        if (!segmentIntersectsPolygon(emitterPoint, target, spec.polygon)) continue;
        return spec;
      }
    }
    return null;
  }

  function addSatelliteIslands(existing, desiredCount, routeSegments, keyPoints, difficultyName) {
    const ranges = difficultyName === "easy" ? [34, 68] : difficultyName === "medium" ? [36, 78] : [38, 88];
    while (existing.length < desiredCount) {
      let best = null;
      let bestScore = -Infinity;
      for (let attempt = 0; attempt < 90; attempt++) {
        const rx = rand(ranges[0], ranges[1]);
        const ry = rand(ranges[0] * 0.76, ranges[1] * 1.08);
        const spec = {
          x: rand(68 + rx, W - 68 - rx),
          y: rand(68 + ry, H - 68 - ry),
          rx, ry
        };
        if (!islandCandidateClear(spec, routeSegments, keyPoints, existing)) continue;
        const nearest = Math.min(...existing.map(other => distance(spec, other)));
        const centreDistance = distance(spec, { x: 500, y: 500 });
        const score = nearest * 0.75 + centreDistance * 0.18 + rand(0, 120);
        if (score > bestScore) { best = spec; bestScore = score; }
      }
      if (!best) break;
      best.polygon = makeIslandPolygon(best.x, best.y, best.rx, best.ry);
      existing.push(best);
    }
    return existing;
  }

  function buildIslandsForSolution(emitterPoint, routeTargets, paths, solutionNodes, difficultyName, centralMass) {
    const routeSegments = segmentPairs(paths);
    const keyPoints = [emitterPoint, ...routeTargets, ...solutionNodes];
    const specs = [centralMass];
    const blockerScale = difficultyName === "hard" ? 1.08 : 1;

    for (const target of routeTargets) {
      if (segmentIntersectsPolygon(emitterPoint, target, centralMass.polygon)) continue;
      const blocker = makeLineOfSightBlocker(emitterPoint, target, routeSegments, keyPoints, specs, blockerScale);
      if (!blocker) return null;
      specs.push(blocker);
    }

    const desired = difficultyName === "easy" ? randInt(3, 4) : difficultyName === "medium" ? randInt(5, 6) : randInt(6, 8);
    addSatelliteIslands(specs, desired, routeSegments, keyPoints, difficultyName);

    const polygons = specs.map(spec => spec.polygon);
    if (polygons.length < Math.max(3, desired - 1)) return null;
    if (routeSegments.some(segment => polygons.some(polygon => segmentIntersectsPolygon(segment.a, segment.b, polygon)))) return null;
    if (routeTargets.some(target => !polygons.some(polygon => segmentIntersectsPolygon(emitterPoint, target, polygon)))) return null;
    return polygons;
  }

  function chooseBlockedTargetAfterMirror(mirrorPoint, incomingAngle, emitterPoint, centralMass, otherTargets = []) {
    for (let attempt = 0; attempt < 180; attempt++) {
      const target = randomEdgePoint();
      if (distance(mirrorPoint, target) < 260) continue;
      if (distance(emitterPoint, target) < 520) continue;
      if (otherTargets.some(other => distance(other, target) < 260)) continue;
      const turn = Math.abs(angleDifference(incomingAngle, angleBetween(mirrorPoint, target)));
      if (turn < 32 || turn > 152) continue;
      if (!segmentIntersectsPolygon(emitterPoint, target, centralMass.polygon)) continue;
      if (segmentIntersectsPolygon(mirrorPoint, target, centralMass.polygon)) continue;
      return target;
    }
    return null;
  }

  function chooseTargetAfterMirrorAvoidMass(mirrorPoint, incomingAngle, emitterPoint, centralMass, otherTargets = []) {
    for (let attempt = 0; attempt < 160; attempt++) {
      const target = randomEdgePoint();
      if (distance(mirrorPoint, target) < 235) continue;
      if (distance(emitterPoint, target) < 470) continue;
      if (otherTargets.some(other => distance(other, target) < 220)) continue;
      const turn = Math.abs(angleDifference(incomingAngle, angleBetween(mirrorPoint, target)));
      if (turn < 28 || turn > 156) continue;
      if (segmentIntersectsPolygon(mirrorPoint, target, centralMass.polygon)) continue;
      return target;
    }
    return null;
  }

  function checkpointOnSegment(id, a, b, colour = "any", label = "") {
    const t = rand(0.42, 0.68);
    return {
      id,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      colour,
      label
    };
  }

  function checkpointsForSolution(difficultyName, paths, colours = []) {
    if (difficultyName === "easy") {
      const path = paths[0];
      const i = Math.max(0, path.length - 2);
      return [checkpointOnSegment("c1", path[i], path[i + 1], "any", "")];
    }
    if (difficultyName === "medium") {
      return [
        checkpointOnSegment("c1", paths[1][1], paths[1][2], "red", "R"),
        checkpointOnSegment("c2", paths[2][1], paths[2][2], "blue", "B")
      ];
    }
    return colours.map((colour, index) => {
      const path = paths[index + 1];
      return checkpointOnSegment(`c${index + 1}`, path[1], path[2], colour, colour.slice(0, 1).toUpperCase());
    });
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

  function randomPointClearOfMass(centralMass, margin = 130) {
    for (let attempt = 0; attempt < 120; attempt++) {
      const point = randomInteriorPoint(margin);
      if (pointClearOfPolygon(point, centralMass.polygon, 62)) return point;
    }
    return null;
  }

  function generateEasyCandidate() {
    const mirrorCount = Math.random() < 0.34 ? 1 : 2;
    for (let attempt = 0; attempt < 260; attempt++) {
      const centralMass = createCentralMass("easy");
      const emitterPoint = randomEdgePoint();
      let target = null;
      for (let targetAttempt = 0; targetAttempt < 120; targetAttempt++) {
        const candidate = randomEdgePoint();
        if (distance(emitterPoint, candidate) < 560) continue;
        if (!segmentIntersectsPolygon(emitterPoint, candidate, centralMass.polygon)) continue;
        target = candidate;
        break;
      }
      if (!target) continue;

      const mirrors = [];
      for (let i = 0; i < mirrorCount; i++) {
        const point = randomPointClearOfMass(centralMass, 145);
        if (!point) break;
        mirrors.push(point);
      }
      if (mirrors.length !== mirrorCount) continue;
      const path = [emitterPoint, ...mirrors, target];
      if (!routeAvoidsPolygon([path], centralMass.polygon)) continue;
      const solutionNodes = mirrors.map((point, index) => ({
        id: `solution-m${index + 1}`,
        type: "mirror",
        x: point.x,
        y: point.y,
        angle: mirrorAngleFor(angleBetween(path[index], point), angleBetween(point, path[index + 2]))
      }));
      const routeTargets = [{ id: "w1", x: target.x, y: target.y, colour: "white", label: "W" }];
      if (!routeGeometryIsClean([path], solutionNodes, routeTargets)) continue;

      const islandsForLevel = buildIslandsForSolution(emitterPoint, routeTargets, [path], solutionNodes, "easy", centralMass);
      if (!islandsForLevel) continue;
      const solutionAngle = angleBetween(emitterPoint, mirrors[0]);
      const checkpointsForLevel = checkpointsForSolution("easy", [path]);
      return {
        emitter: { x: emitterPoint.x, y: emitterPoint.y, angle: perturbStartingAngle(solutionAngle, "easy") },
        targets: routeTargets,
        checkpoints: checkpointsForLevel,
        islands: islandsForLevel,
        inventory: { mirrors: mirrorCount + 1, splitters: 0 },
        prismMode: "rb",
        prismSign: 1,
        par: mirrorCount,
        solution: { emitterAngle: solutionAngle, nodes: solutionNodes }
      };
    }
    return null;
  }

  function generateMediumCandidate() {
    for (let attempt = 0; attempt < 420; attempt++) {
      const centralMass = createCentralMass("medium");
      const splitterPoint = randomPointClearOfMass(centralMass, 220);
      if (!splitterPoint) continue;
      const incomingAngle = rand(-180, 180);
      const preMirror = pointAlong(splitterPoint, incomingAngle + 180, rand(185, 270));
      if (!insideBoard(preMirror, 120) || !pointClearOfPolygon(preMirror, centralMass.polygon, 58)) continue;
      if (segmentIntersectsPolygon(preMirror, splitterPoint, centralMass.polygon)) continue;
      const emitterPoint = chooseEmitterForFirstNode(preMirror);
      if (segmentIntersectsPolygon(emitterPoint, preMirror, centralMass.polygon)) continue;
      const preTurn = Math.abs(angleDifference(angleBetween(emitterPoint, preMirror), incomingAngle));
      if (preTurn < 32 || preTurn > 150) continue;

      const blueAngle = normaliseAngle(incomingAngle + (Math.random() < 0.5 ? -1 : 1) * rand(62, 118));
      const redMirrorPoint = pointAlong(splitterPoint, incomingAngle, rand(175, 250));
      const blueMirrorPoint = pointAlong(splitterPoint, blueAngle, rand(175, 250));
      if (!insideBoard(redMirrorPoint, 112) || !insideBoard(blueMirrorPoint, 112)) continue;
      if (!pointClearOfPolygon(redMirrorPoint, centralMass.polygon, 54) || !pointClearOfPolygon(blueMirrorPoint, centralMass.polygon, 54)) continue;
      if (segmentIntersectsPolygon(splitterPoint, redMirrorPoint, centralMass.polygon)) continue;
      if (segmentIntersectsPolygon(splitterPoint, blueMirrorPoint, centralMass.polygon)) continue;
      if (distance(redMirrorPoint, blueMirrorPoint) < 170) continue;

      const redTargetPoint = chooseTargetAfterMirrorAvoidMass(redMirrorPoint, incomingAngle, emitterPoint, centralMass);
      if (!redTargetPoint) continue;
      const redTarget = { id: "r1", x: redTargetPoint.x, y: redTargetPoint.y, colour: "red", label: "R" };
      const blueTargetPoint = chooseTargetAfterMirrorAvoidMass(blueMirrorPoint, blueAngle, emitterPoint, centralMass, [redTarget]);
      if (!blueTargetPoint) continue;
      const blueTarget = { id: "b1", x: blueTargetPoint.x, y: blueTargetPoint.y, colour: "blue", label: "B" };
      if (distance(redTarget, blueTarget) < 260) continue;
      if ([redTarget, blueTarget].filter(target => segmentIntersectsPolygon(emitterPoint, target, centralMass.polygon)).length < 1) continue;

      const preNode = {
        id: "solution-pre-mirror", type: "mirror", x: preMirror.x, y: preMirror.y,
        angle: mirrorAngleFor(angleBetween(emitterPoint, preMirror), incomingAngle)
      };
      const splitterNode = {
        id: "solution-prism", type: "splitter", mode: "rb", x: splitterPoint.x, y: splitterPoint.y,
        angle: mirrorAngleFor(incomingAngle, blueAngle)
      };
      const redNode = {
        id: "solution-red-mirror", type: "mirror", x: redMirrorPoint.x, y: redMirrorPoint.y,
        angle: mirrorAngleFor(incomingAngle, angleBetween(redMirrorPoint, redTarget))
      };
      const blueNode = {
        id: "solution-blue-mirror", type: "mirror", x: blueMirrorPoint.x, y: blueMirrorPoint.y,
        angle: mirrorAngleFor(blueAngle, angleBetween(blueMirrorPoint, blueTarget))
      };
      const solutionNodes = [preNode, splitterNode, redNode, blueNode];
      const prePath = [emitterPoint, preMirror, splitterPoint];
      const redPath = [splitterPoint, redMirrorPoint, redTarget];
      const bluePath = [splitterPoint, blueMirrorPoint, blueTarget];
      const paths = [prePath, redPath, bluePath];
      const routeTargets = [redTarget, blueTarget];
      if (!routeGeometryIsClean(paths, solutionNodes, routeTargets)) continue;
      if (!routeAvoidsPolygon(paths, centralMass.polygon)) continue;

      const islandsForLevel = buildIslandsForSolution(emitterPoint, routeTargets, paths, solutionNodes, "medium", centralMass);
      if (!islandsForLevel) continue;
      const solutionAngle = angleBetween(emitterPoint, preMirror);
      return {
        emitter: { x: emitterPoint.x, y: emitterPoint.y, angle: perturbStartingAngle(solutionAngle, "medium") },
        targets: routeTargets,
        checkpoints: checkpointsForSolution("medium", paths),
        islands: islandsForLevel,
        inventory: { mirrors: 4, splitters: 1 },
        prismMode: "rb",
        prismSign: 1,
        par: 4,
        solution: { emitterAngle: solutionAngle, nodes: solutionNodes }
      };
    }
    return null;
  }

  function transformTemplatePoint(point, turns, mirrored) {
    let x = point.x;
    let y = point.y;
    if (mirrored) x = W - x;
    for (let i = 0; i < turns; i++) {
      const nx = H - y;
      const ny = x;
      x = nx;
      y = ny;
    }
    return { x, y };
  }

  function generateHardCandidate() {
    const colours = ["red", "green", "blue"];
    for (let attempt = 0; attempt < 120; attempt++) {
      // Start from a deliberately roomy three-way composition around a large
      // central mass, then rotate/mirror it. Small parameter variation keeps
      // the level organic without making RGB generation fragile.
      const centralMass = {
        x: 515 + rand(-22, 22),
        y: 500 + rand(-24, 24),
        rx: rand(192, 222),
        ry: rand(198, 232),
        central: true
      };
      centralMass.polygon = makeIslandPolygon(centralMass.x, centralMass.y, centralMass.rx, centralMass.ry);

      const prismBase = { x: rand(248, 270), y: rand(210, 230) };
      const emitterBase = { x: 72, y: rand(620, 690) };
      const preBase = { x: rand(100, 124), y: rand(800, 842) };
      const incomingBase = angleBetween(preBase, prismBase);
      const greenBaseAngle = rand(-8, 8);
      const redMirrorBase = pointAlong(prismBase, incomingBase, rand(146, 164));
      const greenMirrorBase = pointAlong(prismBase, greenBaseAngle, rand(500, 525));
      const blueBaseAngle = normaliseAngle(greenBaseAngle + 90);
      const blueMirrorBase = pointAlong(prismBase, blueBaseAngle, rand(575, 610));
      const redTargetBase = { x: 928, y: rand(92, 150) };
      const greenTargetBase = { x: 928, y: rand(455, 595) };
      const blueTargetBase = { x: rand(700, 825), y: 928 };

      const turns = randInt(0, 3);
      const mirrored = Math.random() < 0.5;
      const emitterPoint = transformTemplatePoint(emitterBase, turns, mirrored);
      const preMirror = transformTemplatePoint(preBase, turns, mirrored);
      const splitterPoint = transformTemplatePoint(prismBase, turns, mirrored);
      const redMirrorPoint = transformTemplatePoint(redMirrorBase, turns, mirrored);
      const greenMirrorPoint = transformTemplatePoint(greenMirrorBase, turns, mirrored);
      const blueMirrorPoint = transformTemplatePoint(blueMirrorBase, turns, mirrored);
      const routeTargets = [redTargetBase, greenTargetBase, blueTargetBase].map((point, i) => {
        const p = transformTemplatePoint(point, turns, mirrored);
        return { id: `${colours[i][0]}1`, x: p.x, y: p.y, colour: colours[i], label: colours[i][0].toUpperCase() };
      });

      const incomingAngle = angleBetween(preMirror, splitterPoint);
      const greenAngle = angleBetween(splitterPoint, greenMirrorPoint);
      const blueAngle = angleBetween(splitterPoint, blueMirrorPoint);
      const rgbSign = angleDifference(greenAngle, blueAngle) >= 0 ? 1 : -1;
      const prismAngle = mirrorAngleFor(incomingAngle, greenAngle);
      const expectedBlue = normaliseAngle(2 * (prismAngle + rgbSign * RGB_FACE_OFFSET) - incomingAngle);
      if (Math.abs(angleDifference(expectedBlue, blueAngle)) > 1.5) continue;

      const preNode = {
        id: "solution-pre", type: "mirror", x: preMirror.x, y: preMirror.y,
        angle: mirrorAngleFor(angleBetween(emitterPoint, preMirror), incomingAngle)
      };
      const prismNode = {
        id: "solution-prism", type: "splitter", mode: "rgb", rgbSign,
        x: splitterPoint.x, y: splitterPoint.y, angle: prismAngle
      };
      const branchPoints = [redMirrorPoint, greenMirrorPoint, blueMirrorPoint];
      const outputAngles = [incomingAngle, greenAngle, blueAngle];
      const branchNodes = colours.map((colour, i) => ({
        id: `solution-${colour}-mirror`, type: "mirror", x: branchPoints[i].x, y: branchPoints[i].y,
        angle: mirrorAngleFor(outputAngles[i], angleBetween(branchPoints[i], routeTargets[i]))
      }));
      const solutionNodes = [preNode, prismNode, ...branchNodes];
      const prePath = [emitterPoint, preMirror, splitterPoint];
      const branchPaths = colours.map((colour, i) => [splitterPoint, branchPoints[i], routeTargets[i]]);
      const paths = [prePath, ...branchPaths];

      if (!routeGeometryIsClean(paths, solutionNodes, routeTargets)) continue;
      if (!routeAvoidsPolygon(paths, centralMass.polygon)) continue;
      if (routeTargets.filter(target => segmentIntersectsPolygon(emitterPoint, target, centralMass.polygon)).length < 2) continue;

      const islandsForLevel = buildIslandsForSolution(emitterPoint, routeTargets, paths, solutionNodes, "hard", centralMass);
      if (!islandsForLevel) continue;
      const solutionAngle = angleBetween(emitterPoint, preMirror);
      return {
        emitter: { x: emitterPoint.x, y: emitterPoint.y, angle: perturbStartingAngle(solutionAngle, "hard") },
        targets: routeTargets,
        checkpoints: checkpointsForSolution("hard", paths, colours),
        islands: islandsForLevel,
        inventory: { mirrors: 5, splitters: 1 },
        prismMode: "rgb",
        prismSign: rgbSign,
        par: 5,
        solution: { emitterAngle: solutionAngle, nodes: solutionNodes }
      };
    }
    return null;
  }

  function squareFallbackLevel(source) {
    const level = deepClone(source);
    level.emitter.y += LEVEL_Y_OFFSET;
    level.targets.forEach(target => { target.y += LEVEL_Y_OFFSET; });
    (level.checkpoints || []).forEach(checkpoint => { checkpoint.y += LEVEL_Y_OFFSET; });
    level.islands.forEach(polygon => polygon.forEach(point => { point[1] += LEVEL_Y_OFFSET; }));
    return level;
  }

  function solutionPasses(level) {
    if (!level?.solution) return true;
    const previous = {
      emitter, targets, checkpoints, islands, nodes,
      targetHits, checkpointHits, wrongHits, prismMode, prismSign
    };
    try {
      emitter = { ...deepClone(level.emitter), angle: level.solution.emitterAngle };
      targets = deepClone(level.targets);
      checkpoints = deepClone(level.checkpoints || []);
      islands = deepClone(level.islands);
      prismMode = level.prismMode || "rb";
      prismSign = level.prismSign || 1;
      nodes = deepClone(level.solution.nodes);
      traceBeams();
      return targetHits.size === targets.length && checkpointHits.size === checkpoints.length && wrongHits.size === 0;
    } catch (_) {
      return false;
    } finally {
      emitter = previous.emitter;
      targets = previous.targets;
      checkpoints = previous.checkpoints;
      islands = previous.islands;
      nodes = previous.nodes;
      targetHits = previous.targetHits;
      checkpointHits = previous.checkpointHits;
      wrongHits = previous.wrongHits;
      prismMode = previous.prismMode;
      prismSign = previous.prismSign;
    }
  }

  function generateLevel(difficultyName) {
    const generator = difficultyName === "easy" ? generateEasyCandidate : difficultyName === "medium" ? generateMediumCandidate : generateHardCandidate;
    for (let attempt = 0; attempt < 60; attempt++) {
      const level = generator();
      if (level && solutionPasses(level)) return level;
    }

    // A known-good layout remains as an emergency fallback only. Normal play
    // should always come from the freeform solution-first generator above.
    if (difficultyName === "hard") return deepClone(HARD_FALLBACK_LEVEL);
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
    checkpoints = deepClone(baseLevel.checkpoints || []);
    islands = deepClone(baseLevel.islands);
    inventory = deepClone(baseLevel.inventory);
    prismMode = baseLevel.prismMode || "rb";
    prismSign = baseLevel.prismSign || 1;
    par = baseLevel.par || 0;
    nodes = [];
    selectedId = "emitter";
    dragState = null;
    nextNodeId = 1;
    solvedLastFrame = false;
    placementType = null;
    resultEl.classList.add("hidden");
    render();
    statusEl.textContent = difficulty === "easy"
      ? "Laser selected — use the rotate control below the board, then place a mirror to bend the beam."
      : difficulty === "medium"
        ? "Laser selected — route both colours through their checkpoints and targets."
        : "Laser selected — use the RGB prism, then route red, green and blue through matching checkpoints and targets.";
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
    const half = MIRROR_LENGTH / 2;
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
      const hit = node.type === "splitter"
        ? rayCircleIntersection(origin, dir, node, PRISM_RADIUS)
        : (() => {
            const seg = nodeSegment(node);
            return raySegmentIntersection(origin, dir, seg.a, seg.b);
          })();
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
    checkpointHits = new Set();
    wrongHits = new Set();
    const initialDirection = unitFromAngle(emitter.angle);

    function cast(origin, dir, colour, depth, skipNodeId = null, seen = new Set()) {
      if (depth > MAX_BOUNCES) return;
      const hit = nearestHit(origin, dir, skipNodeId);
      if (!hit || !Number.isFinite(hit.t)) return;

      const endPoint = hit.type === "splitter" ? { x: hit.node.x, y: hit.node.y } : hit;
      segments.push({ x1: origin.x, y1: origin.y, x2: endPoint.x, y2: endPoint.y, colour });

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
        if ((hit.node.mode || prismMode) === "rgb") {
          const sign = hit.node.rgbSign || prismSign || 1;
          const green = reflect(dir, hit.node.angle);
          const blue = reflect(dir, hit.node.angle + sign * RGB_FACE_OFFSET);
          cast({ x: hit.node.x + straight.x * 3, y: hit.node.y + straight.y * 3 }, straight, "red", depth + 1, hit.id, nextSeen);
          cast({ x: hit.node.x + green.x * 3, y: hit.node.y + green.y * 3 }, green, "green", depth + 1, hit.id, nextSeen);
          cast({ x: hit.node.x + blue.x * 3, y: hit.node.y + blue.y * 3 }, blue, "blue", depth + 1, hit.id, nextSeen);
        } else {
          const reflected = reflect(dir, hit.node.angle);
          cast({ x: hit.node.x + straight.x * 3, y: hit.node.y + straight.y * 3 }, straight, "red", depth + 1, hit.id, nextSeen);
          cast({ x: hit.node.x + reflected.x * 3, y: hit.node.y + reflected.y * 3 }, reflected, "blue", depth + 1, hit.id, nextSeen);
        }
      }
    }

    cast({ x: emitter.x + initialDirection.x * 26, y: emitter.y + initialDirection.y * 26 }, initialDirection, "white", 0);
    checkpoints.forEach(checkpoint => {
      const hit = segments.some(segment => {
        const colourMatches = checkpoint.colour === "any" || checkpoint.colour === segment.colour;
        if (!colourMatches) return false;
        return pointSegmentDistance(checkpoint, { x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }) <= CHECKPOINT_RADIUS + 2;
      });
      if (hit) checkpointHits.add(checkpoint.id);
    });
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
    if (checkpoints.some(checkpoint => Math.hypot(x - checkpoint.x, y - checkpoint.y) < 50)) return false;
    if (islands.some(polygon => pointInPolygon({ x, y }, polygon))) return false;
    if (nodes.some(node => node.id !== ignoreId && Math.hypot(x - node.x, y - node.y) < 60)) return false;
    return true;
  }

  function countType(type) {
    return nodes.filter(node => node.type === type).length;
  }

  function placementLabel(type) {
    return type === "splitter" ? (prismMode === "rgb" ? "RGB prism" : "prism") : "mirror";
  }

  function setPlacementType(type) {
    if (placementType === type) {
      placementType = null;
      statusEl.textContent = "Placement cancelled — select an optic or choose a piece to place.";
      render();
      return;
    }

    const max = type === "mirror" ? inventory.mirrors : inventory.splitters;
    if (countType(type) >= max) {
      statusEl.textContent = type === "mirror" ? "No mirrors left. Remove one to place it elsewhere." : "No prisms left. Remove one to place it elsewhere.";
      return;
    }

    placementType = type;
    selectedId = null;
    dragState = null;
    resultEl.classList.add("hidden");
    statusEl.textContent = `Tap a clear place on the board to add the ${placementLabel(type)}.`;
    render();
  }

  function placeNodeAt(type, x, y) {
    const max = type === "mirror" ? inventory.mirrors : inventory.splitters;
    if (countType(type) >= max) {
      placementType = null;
      statusEl.textContent = type === "mirror" ? "No mirrors left." : "No prisms left.";
      render();
      return false;
    }
    if (!canPlaceAt(x, y)) {
      statusEl.textContent = `That spot is blocked — tap another clear place for the ${placementLabel(type)}.`;
      return false;
    }

    const node = {
      id: `n${nextNodeId++}`,
      type,
      x,
      y,
      angle: type === "mirror" ? -35 : 20,
      mode: type === "splitter" ? prismMode : undefined,
      rgbSign: type === "splitter" ? prismSign : undefined
    };
    nodes.push(node);
    selectedId = node.id;
    placementType = null;
    resultEl.classList.add("hidden");
    statusEl.textContent = `${placementLabel(type)[0].toUpperCase() + placementLabel(type).slice(1)} placed — drag to move it or rotate below.`;
    render();
    return true;
  }

  function removeSelected() {
    if (!selectedId) return;
    placementType = null;
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
    const shape = createSvg("polygon", { points, class: `laserflow-island island-${index % 3}${index === 0 ? " central" : ""}` });
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

  function appendCheckpoint(checkpoint) {
    const hit = checkpointHits.has(checkpoint.id);
    const colourClass = checkpoint.colour === "any" ? "neutral" : checkpoint.colour;
    const group = createSvg("g", { class: `laserflow-checkpoint checkpoint-${colourClass}${hit ? " hit" : ""}` });
    group.append(
      createSvg("circle", { cx: checkpoint.x, cy: checkpoint.y, r: CHECKPOINT_RADIUS + 8, class: "laserflow-checkpoint-halo" }),
      createSvg("circle", { cx: checkpoint.x, cy: checkpoint.y, r: CHECKPOINT_RADIUS, class: "laserflow-checkpoint-ring" }),
      createSvg("circle", { cx: checkpoint.x, cy: checkpoint.y, r: 5, class: "laserflow-checkpoint-dot" })
    );
    if (checkpoint.label) {
      const text = createSvg("text", { x: checkpoint.x, y: checkpoint.y + 5, class: "laserflow-checkpoint-label", "text-anchor": "middle" });
      text.textContent = checkpoint.label;
      group.appendChild(text);
    }
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
        createSvg("circle", { cx: 0, cy: 0, r: PRISM_RADIUS, class: "laserflow-prism" }),
        createSvg("line", { x1: -24, y1: -16, x2: 10, y2: -16, class: "laserflow-prism-hatch" }),
        createSvg("line", { x1: -30, y1: -6, x2: 18, y2: -6, class: "laserflow-prism-hatch" }),
        createSvg("line", { x1: -30, y1: 6, x2: 18, y2: 6, class: "laserflow-prism-hatch" }),
        createSvg("line", { x1: -24, y1: 16, x2: 10, y2: 16, class: "laserflow-prism-hatch" }),
        createSvg("line", { x1: -27, y1: 0, x2: 27, y2: 0, class: "laserflow-prism-axis" }),
        createSvg("circle", { cx: 0, cy: 0, r: 7, class: "laserflow-prism-core" }),
        createSvg("circle", { cx: 27, cy: node.mode === "rgb" ? -16 : -10, r: 5, class: "laserflow-prism-red" }),
        ...(node.mode === "rgb" ? [createSvg("circle", { cx: 31, cy: 0, r: 5, class: "laserflow-prism-green" })] : []),
        createSvg("circle", { cx: 27, cy: node.mode === "rgb" ? 16 : 10, r: 5, class: "laserflow-prism-blue" })
      );
      group.appendChild(visual);
      group.appendChild(createSvg("circle", { cx: node.x, cy: node.y, r: PRISM_RADIUS + 14, class: "laserflow-prism-hit", "data-drag": "move", "data-node-id": node.id }));
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
    return { type: node.type === "mirror" ? "Mirror" : (node.mode === "rgb" ? "RGB Prism" : "Prism"), object: node };
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
    checkpointCountEl.textContent = `${checkpointHits.size} / ${checkpoints.length}`;
    pieceCountEl.textContent = `${pieces} / ${inventory.mirrors + inventory.splitters}`;
    parEl.textContent = par || "—";
    addMirrorButton.disabled = mirrorCount >= inventory.mirrors;
    addSplitterButton.disabled = splitterCount >= inventory.splitters;
    addSplitterButton.classList.toggle("hidden", inventory.splitters === 0);
    if (addMirrorButton.disabled && placementType === "mirror") placementType = null;
    if (addSplitterButton.disabled && placementType === "splitter") placementType = null;
    addMirrorButton.classList.toggle("placing", placementType === "mirror");
    addSplitterButton.classList.toggle("placing", placementType === "splitter");
    addMirrorButton.setAttribute("aria-pressed", placementType === "mirror" ? "true" : "false");
    addSplitterButton.setAttribute("aria-pressed", placementType === "splitter" ? "true" : "false");
    board.classList.toggle("placing", Boolean(placementType));
    deleteButton.disabled = !selectedId || selectedId === "emitter";
    updateRotateUi();

    if (solved && !solvedLastFrame) {
      const stars = par > 0 ? Math.max(1, 5 - Math.max(0, pieces - par)) : 5;
      resultEl.classList.add("hidden");
      statusEl.textContent = checkpoints.length ? "Every checkpoint and target received the right light." : "Every target received the right colour.";
      window.GameHubResults?.show({
        gameId: "game-10",
        difficulty,
        stars,
        score: null,
        title: stars === 5 ? "Perfect route!" : "Laser Lab complete!",
        summary: pieces <= par
          ? `Solved with ${pieces} piece${pieces === 1 ? "" : "s"} — at or under the five-star par.`
          : `Solved with ${pieces} pieces. Five-star par is ${par}.`,
        metrics: [
          { label: "Pieces", value: pieces },
          { label: "5★ par", value: par || "—" },
          { label: "Targets", value: `${targetHits.size}/${targets.length}` }
        ],
        againLabel: "Try again",
        onAgain: resetLevel
      });
    } else if (!solved) {
      resultEl.classList.add("hidden");
    }
    solvedLastFrame = solved;
  }

  function render() {
    board.innerHTML = "";
    appendBoardDefs();
    board.appendChild(createSvg("rect", { x: 0, y: 0, width: W, height: H, rx: 32, class: "laserflow-board-bg" }));

    islands.forEach(appendIsland);
    const segments = traceBeams();
    segments.forEach(appendBeam);
    checkpoints.forEach(appendCheckpoint);
    targets.forEach(appendTarget);
    appendEmitter();
    nodes.forEach(appendNode);

    const solved = targets.length > 0 && targetHits.size === targets.length && checkpointHits.size === checkpoints.length;
    updateHud(solved);
  }

  board.addEventListener("pointerdown", evt => {
    if (placementType) {
      evt.preventDefault();
      const p = svgPoint(evt);
      placeNodeAt(placementType, clamp(p.x, 70, W - 70), clamp(p.y, 70, H - 70));
      return;
    }

    const control = evt.target.closest?.("[data-drag], [data-select]") || evt.target;
    const dragType = control.dataset.drag;
    const nodeId = control.dataset.nodeId;
    const selectType = control.dataset.select;

    if (selectType === "emitter") {
      evt.preventDefault();
      placementType = null;
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
    placementType = null;
    selectedId = node.id;
    dragState = {
      pointerId: evt.pointerId,
      type: "move",
      nodeId: node.id,
      offsetX: node.x - p.x,
      offsetY: node.y - p.y
    };
    board.setPointerCapture(evt.pointerId);
    statusEl.textContent = `${node.type === "mirror" ? "Mirror" : (node.mode === "rgb" ? "RGB prism" : "Prism")} selected — drag to move, rotate below.`;
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

  addMirrorButton.addEventListener("click", () => setPlacementType("mirror"));
  addSplitterButton.addEventListener("click", () => setPlacementType("splitter"));
  deleteButton.addEventListener("click", removeSelected);
  resetButton.addEventListener("click", resetLevel);
  newButton.addEventListener("click", () => newLevel(false));
  difficultyButtons.forEach(button => button.addEventListener("click", () => setDifficulty(button.dataset.flowDifficulty)));

  setDifficulty("easy");
})();
