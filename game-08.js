// ----------------------------
const laserBoard = $("#laser-board");
const laserBeamLayer = $("#laser-beam-layer");
const laserStatus = $("#laser-status");
const laserModeButtons = $$("[data-laser-mode]");
const laserSizeButtons = $$("[data-laser-size]");
const laserSetupTools = $$("[data-laser-tool]");
const laserPlayTools = $$("[data-laser-play-tool]");
const laserSetupPanel = $("#laser-setup-panel");
const laserPlayPanel = $("#laser-play-panel");
const laserMirrorCount = $("#laser-mirror-count");
const laserCheckpointCount = $("#laser-checkpoint-count");
const laserTargetCount = $("#laser-target-count");
const laserResult = $("#laser-result");
const laserResultText = $("#laser-result-text");
const laserLevelName = $("#laser-level-name");
const laserSaveButton = $("#laser-save-level");
const laserSavedLevels = $("#laser-saved-levels");
const laserLoadButton = $("#laser-load-level");
const laserDeleteButton = $("#laser-delete-level");
const laserResetPlay = $("#laser-reset-play");

const laserGridSizes = {
  small: { rows: 10, cols: 8 },
  medium: { rows: 12, cols: 9 },
  large: { rows: 14, cols: 10 }
};

const laserDirVectors = [
  [-1, 0], [-1, 1], [0, 1], [1, 1],
  [1, 0], [1, -1], [0, -1], [-1, -1]
];

let laserMode = "setup";
let laserGridSize = "large";
let laserRowsCount = 14;
let laserColsCount = 10;
let laserSetupTool = "emitter";
let laserPlayTool = "mirror";

let laserLevel = {
  emitter: null,
  checkpoints: [],
  targets: [],
  splitters: new Map(),
  blocks: new Set()
};

let laserMirrors = new Map();

function laserKey(row, col) { return `${row},${col}`; }
function laserInBounds(row, col) {
  return row >= 0 && row < laserRowsCount && col >= 0 && col < laserColsCount;
}
function laserDirAngle(dir) { return (dir * 45 - 90 + 360) % 360; }
function mirrorLineAngle(orientation) { return orientation * 22.5; }
function normalizeAngle(angle) { angle %= 360; return angle < 0 ? angle + 360 : angle; }
function angleToLaserDir(angle) {
  const dir = Math.round((normalizeAngle(angle) + 90) / 45);
  return ((dir % 8) + 8) % 8;
}
function laserReflect(dir, orientation) {
  return angleToLaserDir(2 * mirrorLineAngle(orientation) - laserDirAngle(dir));
}
function laserCellCenter(row, col) { return [(col + .5) * 100, (row + .5) * 100]; }

function setLaserGridSize(sizeName) {
  laserGridSize = sizeName;
  const size = laserGridSizes[sizeName];
  laserRowsCount = size.rows;
  laserColsCount = size.cols;
  laserLevel = { emitter: null, checkpoints: [], targets: [], splitters: new Map(), blocks: new Set() };
  laserMirrors = new Map();
  laserSizeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserSize === sizeName));
  renderLaserBoard(); traceLaser();
}

function setLaserMode(mode) {
  laserMode = mode;
  laserModeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserMode === mode));
  laserSetupPanel.classList.toggle("hidden", mode !== "setup");
  laserPlayPanel.classList.toggle("hidden", mode !== "play");
  laserResult.classList.add("hidden");
  renderLaserBoard(); traceLaser();
}

function clearLaserCell(row, col) {
  const key = laserKey(row, col);
  if (laserLevel.emitter && laserLevel.emitter.row === row && laserLevel.emitter.col === col) laserLevel.emitter = null;
  laserLevel.checkpoints = laserLevel.checkpoints.filter(x => !(x.row === row && x.col === col));
  laserLevel.targets = laserLevel.targets.filter(x => !(x.row === row && x.col === col));
  laserLevel.splitters.delete(key);
  laserLevel.blocks.delete(key);
  laserMirrors.delete(key);
}

function cellHasFixedObject(row, col) {
  const key = laserKey(row, col);
  return !!(
    (laserLevel.emitter && laserLevel.emitter.row === row && laserLevel.emitter.col === col) ||
    laserLevel.checkpoints.some(x => x.row === row && x.col === col) ||
    laserLevel.targets.some(x => x.row === row && x.col === col) ||
    laserLevel.splitters.has(key) ||
    laserLevel.blocks.has(key)
  );
}

function handleLaserSetupTap(row, col) {
  const key = laserKey(row, col);

  if (laserSetupTool === "eraser") {
    clearLaserCell(row, col);
    renderLaserBoard(); traceLaser(); return;
  }

  if (laserSetupTool === "emitter" && laserLevel.emitter &&
      laserLevel.emitter.row === row && laserLevel.emitter.col === col) {
    laserLevel.emitter.dir = (laserLevel.emitter.dir + 1) % 8;
    renderLaserBoard(); traceLaser(); return;
  }

  if (laserSetupTool === "splitter" && laserLevel.splitters.has(key)) {
    laserLevel.splitters.set(key, (laserLevel.splitters.get(key) + 1) % 8);
    renderLaserBoard(); traceLaser(); return;
  }

  clearLaserCell(row, col);

  if (laserSetupTool === "emitter") laserLevel.emitter = { row, col, dir: 2 };
  if (laserSetupTool === "checkpoint") laserLevel.checkpoints.push({ row, col });
  if (laserSetupTool === "target") laserLevel.targets.push({ row, col });
  if (laserSetupTool === "splitter") laserLevel.splitters.set(key, 2);
  if (laserSetupTool === "block") laserLevel.blocks.add(key);

  renderLaserBoard(); traceLaser();
}

function handleLaserPlayTap(row, col) {
  const key = laserKey(row, col);
  if (cellHasFixedObject(row, col)) return;

  if (laserPlayTool === "eraser") laserMirrors.delete(key);
  else if (laserMirrors.has(key)) laserMirrors.set(key, (laserMirrors.get(key) + 1) % 8);
  else laserMirrors.set(key, 2);

  laserResult.classList.add("hidden");
  renderLaserBoard(); traceLaser();
}

function renderLaserBoard() {
  laserBoard.innerHTML = "";
  laserBoard.style.setProperty("--laser-cols", laserColsCount);
  laserBoard.style.setProperty("--laser-rows", laserRowsCount);

  for (let row = 0; row < laserRowsCount; row++) {
    for (let col = 0; col < laserColsCount; col++) {
      const key = laserKey(row, col);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "laser-cell";

      if (laserLevel.blocks.has(key)) cell.classList.add("obstacle");

      if (laserLevel.emitter && laserLevel.emitter.row === row && laserLevel.emitter.col === col) {
        cell.classList.add("emitter-cell");
        const e = document.createElement("span");
        e.className = `laser-emitter dir-${laserLevel.emitter.dir}`;
        cell.appendChild(e);
      }

      if (laserLevel.targets.some(x => x.row === row && x.col === col)) {
        cell.classList.add("target-cell");
        const t = document.createElement("span");
        t.className = "laser-target"; t.dataset.target = key; cell.appendChild(t);
      }

      if (laserLevel.checkpoints.some(x => x.row === row && x.col === col)) {
        cell.classList.add("checkpoint-cell");
        const c = document.createElement("span");
        c.className = "laser-checkpoint"; c.dataset.checkpoint = key; cell.appendChild(c);
      }

      if (laserLevel.splitters.has(key)) {
        const s = document.createElement("span");
        s.className = `laser-splitter angle-${laserLevel.splitters.get(key)}`;
        cell.appendChild(s);
      }

      if (laserMirrors.has(key)) {
        const m = document.createElement("span");
        m.className = `laser-mirror angle-${laserMirrors.get(key)}`;
        cell.appendChild(m);
      }

      cell.addEventListener("click", () => {
        if (laserMode === "setup") handleLaserSetupTap(row, col);
        else handleLaserPlayTap(row, col);
      });

      laserBoard.appendChild(cell);
    }
  }
}

function traceSingleBeam(state, branchIndex, hitCheckpoints, hitTargets, queue) {
  const points = [];
  const seen = new Set();
  let { row, col, dir } = state;
  points.push(laserCellCenter(row, col));

  for (let step = 0; step < 500; step++) {
    const stateKey = `${row},${col},${dir}`;
    if (seen.has(stateKey)) break;
    seen.add(stateKey);

    const [dr, dc] = laserDirVectors[dir];
    const nr = row + dr, nc = col + dc;

    if (!laserInBounds(nr, nc)) {
      points.push([(col + .5 + dc * .5) * 100, (row + .5 + dr * .5) * 100]);
      break;
    }

    const key = laserKey(nr, nc);
    if (laserLevel.blocks.has(key)) {
      points.push([(col + .5 + dc * .5) * 100, (row + .5 + dr * .5) * 100]);
      break;
    }

    row = nr; col = nc; points.push(laserCellCenter(row, col));

    if (laserLevel.checkpoints.some(x => x.row === row && x.col === col)) hitCheckpoints.add(key);

    if (laserLevel.targets.some(x => x.row === row && x.col === col)) {
      hitTargets.add(key);
      break;
    }

    if (laserMirrors.has(key)) {
      dir = laserReflect(dir, laserMirrors.get(key));
      continue;
    }

    if (laserLevel.splitters.has(key)) {
      const reflected = laserReflect(dir, laserLevel.splitters.get(key));
      if (reflected !== dir) {
        queue.push({ row, col, dir: reflected, branchIndex: branchIndex + queue.length + 1 });
      }
    }
  }

  return points;
}

function traceLaser() {
  laserBeamLayer.innerHTML = "";
  laserBeamLayer.setAttribute("viewBox", `0 0 ${laserColsCount * 100} ${laserRowsCount * 100}`);

  const hitCheckpoints = new Set();
  const hitTargets = new Set();

  if (!laserLevel.emitter) {
    updateLaserStats(hitCheckpoints, hitTargets);
    laserStatus.textContent = laserMode === "setup"
      ? "Place a laser, at least one target, then build your puzzle."
      : "This level needs a laser.";
    return;
  }

  const queue = [{ ...laserLevel.emitter, branchIndex: 1 }];
  let processed = 0;

  while (queue.length && processed < 32) {
    const beam = queue.shift();
    processed++;
    const points = traceSingleBeam(beam, beam.branchIndex, hitCheckpoints, hitTargets, queue);
    if (points.length > 1) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("class", `laser-beam-line branch-${((processed - 1) % 4) + 1}`);
      line.setAttribute("points", points.map(([x,y]) => `${x},${y}`).join(" "));
      laserBeamLayer.appendChild(line);
    }
  }

  document.querySelectorAll(".laser-checkpoint").forEach(m => m.classList.toggle("hit", hitCheckpoints.has(m.dataset.checkpoint)));
  document.querySelectorAll(".laser-target").forEach(m => m.classList.toggle("hit", hitTargets.has(m.dataset.target)));

  updateLaserStats(hitCheckpoints, hitTargets);

  const checkpointsOkay = laserLevel.checkpoints.length === 0 || hitCheckpoints.size === laserLevel.checkpoints.length;
  const targetsOkay = laserLevel.targets.length > 0 && hitTargets.size === laserLevel.targets.length;

  if (laserMode === "play" && checkpointsOkay && targetsOkay) {
    laserStatus.classList.add("good");
    laserStatus.textContent = "Puzzle solved!";
    laserResultText.textContent = "Every target and checkpoint was hit.";
    laserResult.classList.remove("hidden");
  } else {
    laserStatus.classList.remove("good","bad");
    laserResult.classList.add("hidden");
    if (laserMode === "play") {
      laserStatus.textContent = laserLevel.targets.length
        ? "Place mirrors to hit every checkpoint and target."
        : "This level needs at least one target.";
    }
  }
}

function updateLaserStats(hitCheckpoints, hitTargets) {
  laserMirrorCount.textContent = String(laserMirrors.size);
  laserCheckpointCount.textContent = `${hitCheckpoints.size} / ${laserLevel.checkpoints.length}`;
  laserTargetCount.textContent = `${hitTargets.size} / ${laserLevel.targets.length}`;
}

function serializeLaserLevel() {
  return {
    version: 1,
    name: laserLevelName.value.trim() || "Untitled Laser Level",
    gridSize: laserGridSize,
    rows: laserRowsCount, cols: laserColsCount,
    emitter: laserLevel.emitter,
    checkpoints: laserLevel.checkpoints,
    targets: laserLevel.targets,
    splitters: [...laserLevel.splitters.entries()],
    blocks: [...laserLevel.blocks]
  };
}

function deserializeLaserLevel(data) {
  const sizeName = data.gridSize && laserGridSizes[data.gridSize] ? data.gridSize : "large";
  laserGridSize = sizeName;
  laserRowsCount = data.rows || laserGridSizes[sizeName].rows;
  laserColsCount = data.cols || laserGridSizes[sizeName].cols;
  laserLevel = {
    emitter: data.emitter || null,
    checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints : [],
    targets: Array.isArray(data.targets) ? data.targets : [],
    splitters: new Map(Array.isArray(data.splitters) ? data.splitters : []),
    blocks: new Set(Array.isArray(data.blocks) ? data.blocks : [])
  };
  laserMirrors = new Map();
  laserLevelName.value = data.name || "";
  laserSizeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserSize === sizeName));
  setLaserMode("setup");
}

function getSavedLaserLevels() {
  try { return JSON.parse(localStorage.getItem("laserLabSavedLevels") || "{}"); }
  catch { return {}; }
}
function storeSavedLaserLevels(levels) {
  localStorage.setItem("laserLabSavedLevels", JSON.stringify(levels));
}
function refreshSavedLaserLevels() {
  const levels = getSavedLaserLevels();
  laserSavedLevels.innerHTML = '<option value="">Saved levels…</option>';
  Object.keys(levels).sort().forEach(name => {
    const option = document.createElement("option");
    option.value = name; option.textContent = name; laserSavedLevels.appendChild(option);
  });
}

laserModeButtons.forEach(b => b.addEventListener("click", () => setLaserMode(b.dataset.laserMode)));
laserSizeButtons.forEach(b => b.addEventListener("click", () => setLaserGridSize(b.dataset.laserSize)));
laserSetupTools.forEach(b => b.addEventListener("click", () => {
  laserSetupTool = b.dataset.laserTool;
  laserSetupTools.forEach(x => x.classList.toggle("active", x === b));
}));
laserPlayTools.forEach(b => b.addEventListener("click", () => {
  if (!b.dataset.laserPlayTool) return;
  laserPlayTool = b.dataset.laserPlayTool;
  laserPlayTools.forEach(x => { if (x.dataset.laserPlayTool) x.classList.toggle("active", x === b); });
}));

laserResetPlay.addEventListener("click", () => {
  laserMirrors = new Map(); laserResult.classList.add("hidden"); renderLaserBoard(); traceLaser();
});

laserSaveButton.addEventListener("click", () => {
  const data = serializeLaserLevel();
  const levels = getSavedLaserLevels();
  levels[data.name] = data;
  storeSavedLaserLevels(levels);
  refreshSavedLaserLevels();
  laserSavedLevels.value = data.name;
  laserStatus.textContent = `Saved "${data.name}".`;
});

laserLoadButton.addEventListener("click", () => {
  const name = laserSavedLevels.value;
  if (!name) return;
  const levels = getSavedLaserLevels();
  if (!levels[name]) return;
  deserializeLaserLevel(levels[name]);
  laserStatus.textContent = `Loaded "${name}".`;
});

laserDeleteButton.addEventListener("click", () => {
  const name = laserSavedLevels.value;
  if (!name) return;
  const levels = getSavedLaserLevels();
  delete levels[name];
  storeSavedLaserLevels(levels);
  refreshSavedLaserLevels();
  laserStatus.textContent = `Deleted "${name}".`;
});

refreshSavedLaserLevels();
setLaserMode("setup");
renderLaserBoard();
traceLaser();
