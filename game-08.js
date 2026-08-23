// Laser Lab v1.1.4
// One board model is shared by the designer, saved levels and generated play.
// Mirrors/splitters placed in the Designer describe the intended solution;
// they are hidden while testing a designed level so the player can rebuild it.

const laserBoard = $("#laser-board");
const laserBeamLayer = $("#laser-beam-layer");
const laserStatus = $("#laser-status");
const laserModeButtons = $$('[data-laser-mode]');
const laserSizeButtons = $$('[data-laser-size]');
const laserSetupTools = $$('[data-laser-tool]');
const laserPlayTools = $$('[data-laser-play-tool]');
const laserSetupPanel = $("#laser-setup-panel");
const laserPlayPanel = $("#laser-play-panel");
const laserPieceCount = $("#laser-piece-count");
const laserCheckpointCount = $("#laser-checkpoint-count");
const laserTargetCount = $("#laser-target-count");
const laserResult = $("#laser-result");
const laserResultStars = $("#laser-result-stars");
const laserResultText = $("#laser-result-text");
const laserLevelName = $("#laser-level-name");
const laserSaveButton = $("#laser-save-level");
const laserNewDesigner = $("#laser-new-designer");
const laserSavedLevels = $("#laser-saved-levels");
const laserLoadButton = $("#laser-load-level");
const laserDeleteButton = $("#laser-delete-level");
const laserExportButton = $("#laser-export-level");
const laserImportButton = $("#laser-import-level");
const laserImportFile = $("#laser-import-file");
const laserPlayDesigned = $("#laser-play-designed");
const laserDesignMirrors = $("#laser-design-mirrors");
const laserDesignSplitters = $("#laser-design-splitters");
const laserDesignPar = $("#laser-design-par");
const laserResetPlay = $("#laser-reset-play");
const laserNewGenerated = $("#laser-new-generated");
const laserDifficultyButtons = $$('[data-laser-difficulty]');
const laserMirrorsLeft = $("#laser-mirrors-left");
const laserSplittersLeft = $("#laser-splitters-left");
const laserParDisplay = $("#laser-par-display");

const laserGridSizes = {
  small: { rows: 8, cols: 8 },
  medium: { rows: 10, cols: 10 },
  large: { rows: 12, cols: 12 }
};

// Difficulty is now driven by decisions, not just board size. Checkpoints are
// deliberately sparse on harder levels so they do less of the route-finding.
const laserDifficultyInfo = {
  easy:   { grid: "small",  checkpoints: 1, splitters: 0, minMirrors: 3, mirrorSlack: 3 },
  medium: { grid: "medium", checkpoints: 1, splitters: 1, minMirrors: 5, mirrorSlack: 4 },
  hard:   { grid: "large",  checkpoints: 0, splitters: 2, minMirrors: 7, mirrorSlack: 5 }
};

let laserDifficulty = localStorage.getItem("laserDifficulty") || "easy";
if (!laserDifficultyInfo[laserDifficulty]) laserDifficulty = "easy";

// Cardinal beam directions: up, right, down, left.
const laserDirVectors = [[-1, 0], [0, 1], [1, 0], [0, -1]];

let laserMode = "setup";
let laserGridSize = "large";
let laserRowsCount = 12;
let laserColsCount = 12;
let laserSetupTool = "emitter";
let laserPlayTool = "mirror";
let laserPlaySource = "generated";

function newLaserLevel() {
  return {
    emitter: null,
    checkpoints: [],
    targets: [],
    fixedMirrors: new Map(),
    fixedSplitters: new Map(),
    blocks: new Set(),
    inventory: { mirrors: 6, splitters: 1 },
    par: 0
  };
}

let laserLevel = newLaserLevel();
let laserPlayerMirrors = new Map();
let laserPlayerSplitters = new Map();

function laserKey(row, col) { return `${row},${col}`; }
function laserInBounds(row, col) {
  return row >= 0 && row < laserRowsCount && col >= 0 && col < laserColsCount;
}
function laserReflect(dir, orientation) {
  // orientation 0 = "/" and 1 = "\\".
  const slash = [1, 0, 3, 2];
  const backslash = [3, 2, 1, 0];
  return (orientation % 2 === 0 ? slash : backslash)[dir];
}
function laserCellCenter(row, col) { return [(col + 0.5) * 100, (row + 0.5) * 100]; }
function clampInt(value, min, max, fallback = min) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function normaliseOrientation(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) <= 1) return ((Math.round(n) % 2) + 2) % 2;
  return ((Math.round(n / 2) % 2) + 2) % 2;
}
function clearPlayerPieces() {
  laserPlayerMirrors = new Map();
  laserPlayerSplitters = new Map();
}
function playerPieceCount() {
  return laserPlayerMirrors.size + laserPlayerSplitters.size;
}
function hideDesignerSolutionOptics() {
  return laserMode === "play" && laserPlaySource === "designed";
}
function activeMirrorAt(key) {
  if (!hideDesignerSolutionOptics() && laserLevel.fixedMirrors.has(key)) return laserLevel.fixedMirrors.get(key);
  if (laserPlayerMirrors.has(key)) return laserPlayerMirrors.get(key);
  return null;
}
function activeSplitterAt(key) {
  if (!hideDesignerSolutionOptics() && laserLevel.fixedSplitters.has(key)) return laserLevel.fixedSplitters.get(key);
  if (laserPlayerSplitters.has(key)) return laserPlayerSplitters.get(key);
  return null;
}

function syncDesignerSettingsFromLevel() {
  laserDesignMirrors.value = String(laserLevel.inventory?.mirrors ?? 0);
  laserDesignSplitters.value = String(laserLevel.inventory?.splitters ?? 0);
  laserDesignPar.value = laserLevel.par > 0 ? String(laserLevel.par) : "";
}

function syncLevelSettingsFromDesigner() {
  laserLevel.inventory = {
    mirrors: clampInt(laserDesignMirrors.value, 0, 30, 0),
    splitters: clampInt(laserDesignSplitters.value, 0, 8, 0)
  };
  laserLevel.par = clampInt(laserDesignPar.value, 0, 40, 0);
}

function laserDesignerHasWork() {
  const mirrors = clampInt(laserDesignMirrors.value, 0, 30, 6);
  const splitters = clampInt(laserDesignSplitters.value, 0, 8, 1);
  const par = clampInt(laserDesignPar.value, 0, 40, 0);
  return !!(
    laserLevelName.value.trim() ||
    laserLevel.emitter ||
    laserLevel.checkpoints.length ||
    laserLevel.targets.length ||
    laserLevel.fixedMirrors.size ||
    laserLevel.fixedSplitters.size ||
    laserLevel.blocks.size ||
    mirrors !== 6 ||
    splitters !== 1 ||
    par !== 0
  );
}

function resetLaserDesigner(sizeName = laserGridSize) {
  laserGridSize = sizeName;
  const size = laserGridSizes[sizeName];
  laserRowsCount = size.rows;
  laserColsCount = size.cols;
  laserLevel = newLaserLevel();
  clearPlayerPieces();
  laserLevelName.value = "";
  laserSavedLevels.value = "";
  syncDesignerSettingsFromLevel();
  laserSizeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserSize === sizeName));
  laserResult.classList.add("hidden");
  setLaserMode("setup", { generate: false });
  laserStatus.textContent = "New blank level. Saved levels have not been changed.";
}

function confirmNewLaserDesigner(sizeName = laserGridSize) {
  if (laserDesignerHasWork()) {
    const okay = window.confirm("Start a new level? The current designer board will be cleared. Your saved levels will not be changed.");
    if (!okay) return false;
  }
  resetLaserDesigner(sizeName);
  return true;
}

function setLaserGridSize(sizeName) {
  resetLaserDesigner(sizeName);
}

function setLaserMode(mode, options = {}) {
  const { generate = false } = options;
  laserMode = mode;
  laserModeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserMode === mode));
  laserSetupPanel.classList.toggle("hidden", mode !== "setup");
  laserPlayPanel.classList.toggle("hidden", mode !== "play");
  laserResult.classList.add("hidden");

  if (mode === "play" && generate) {
    generateLaserLevel();
    return;
  }

  renderLaserBoard();
  traceLaser();
}

function clearLaserCell(row, col) {
  const key = laserKey(row, col);
  if (laserLevel.emitter && laserLevel.emitter.row === row && laserLevel.emitter.col === col) laserLevel.emitter = null;
  laserLevel.checkpoints = laserLevel.checkpoints.filter(x => !(x.row === row && x.col === col));
  laserLevel.targets = laserLevel.targets.filter(x => !(x.row === row && x.col === col));
  laserLevel.fixedMirrors.delete(key);
  laserLevel.fixedSplitters.delete(key);
  laserLevel.blocks.delete(key);
  laserPlayerMirrors.delete(key);
  laserPlayerSplitters.delete(key);
}

function cellHasFixedObject(row, col) {
  const key = laserKey(row, col);
  const designerOpticHere = !hideDesignerSolutionOptics() && (
    laserLevel.fixedMirrors.has(key) || laserLevel.fixedSplitters.has(key)
  );
  return !!(
    (laserLevel.emitter && laserLevel.emitter.row === row && laserLevel.emitter.col === col) ||
    laserLevel.checkpoints.some(x => x.row === row && x.col === col) ||
    laserLevel.targets.some(x => x.row === row && x.col === col) ||
    designerOpticHere ||
    laserLevel.blocks.has(key)
  );
}

function handleLaserSetupTap(row, col) {
  const key = laserKey(row, col);

  if (laserSetupTool === "eraser") {
    clearLaserCell(row, col);
    renderLaserBoard();
    traceLaser();
    return;
  }

  if (laserSetupTool === "emitter" && laserLevel.emitter &&
      laserLevel.emitter.row === row && laserLevel.emitter.col === col) {
    laserLevel.emitter.dir = (laserLevel.emitter.dir + 1) % 4;
    renderLaserBoard();
    traceLaser();
    return;
  }

  if (laserSetupTool === "mirror" && laserLevel.fixedMirrors.has(key)) {
    laserLevel.fixedMirrors.set(key, (laserLevel.fixedMirrors.get(key) + 1) % 2);
    renderLaserBoard();
    traceLaser();
    return;
  }

  if (laserSetupTool === "splitter" && laserLevel.fixedSplitters.has(key)) {
    laserLevel.fixedSplitters.set(key, (laserLevel.fixedSplitters.get(key) + 1) % 2);
    renderLaserBoard();
    traceLaser();
    return;
  }

  clearLaserCell(row, col);
  if (laserSetupTool === "emitter") laserLevel.emitter = { row, col, dir: 1 };
  if (laserSetupTool === "checkpoint") laserLevel.checkpoints.push({ row, col });
  if (laserSetupTool === "target") laserLevel.targets.push({ row, col });
  if (laserSetupTool === "mirror") laserLevel.fixedMirrors.set(key, 0);
  if (laserSetupTool === "splitter") laserLevel.fixedSplitters.set(key, 0);
  if (laserSetupTool === "block") laserLevel.blocks.add(key);

  renderLaserBoard();
  traceLaser();
}

function remainingInventory(type) {
  if (type === "mirror") return Math.max(0, laserLevel.inventory.mirrors - laserPlayerMirrors.size);
  if (type === "splitter") return Math.max(0, laserLevel.inventory.splitters - laserPlayerSplitters.size);
  return 0;
}

function handleLaserPlayTap(row, col) {
  const key = laserKey(row, col);
  if (cellHasFixedObject(row, col)) return;

  if (laserPlayTool === "eraser") {
    laserPlayerMirrors.delete(key);
    laserPlayerSplitters.delete(key);
  } else if (laserPlayTool === "mirror") {
    if (laserPlayerMirrors.has(key)) {
      laserPlayerMirrors.set(key, (laserPlayerMirrors.get(key) + 1) % 2);
    } else {
      if (remainingInventory("mirror") <= 0) {
        laserStatus.textContent = "No mirrors left. Erase one to move it.";
        return;
      }
      laserPlayerSplitters.delete(key);
      laserPlayerMirrors.set(key, 0);
    }
  } else if (laserPlayTool === "splitter") {
    if (laserPlayerSplitters.has(key)) {
      laserPlayerSplitters.set(key, (laserPlayerSplitters.get(key) + 1) % 2);
    } else {
      if (remainingInventory("splitter") <= 0) {
        laserStatus.textContent = "No splitters left. Erase one to move it.";
        return;
      }
      laserPlayerMirrors.delete(key);
      laserPlayerSplitters.set(key, 0);
    }
  }

  laserResult.classList.add("hidden");
  renderLaserBoard();
  traceLaser();
}

function makeMirrorElement(orientation, fixed) {
  const m = document.createElement("span");
  m.className = `laser-mirror angle-${orientation}${fixed ? " fixed-optic" : ""}`;
  m.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 26L26 6M9 28L29 8"/></svg>';
  return m;
}

function makeSplitterElement(orientation, fixed) {
  const s = document.createElement("span");
  s.className = `laser-splitter angle-${orientation}${fixed ? " fixed-optic" : ""}`;
  s.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 16h9M18 16h10M16 14l7-7M13 13l3-3 3 3-3 3-3-3Z"/></svg>';
  return s;
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
        e.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="10" width="14" height="12" rx="3"/><path d="M19 13h5l4 3-4 3h-5M9 16h6"/></svg>';
        cell.appendChild(e);
      }

      if (laserLevel.targets.some(x => x.row === row && x.col === col)) {
        cell.classList.add("target-cell");
        const t = document.createElement("span");
        t.className = "laser-target";
        t.dataset.target = key;
        t.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><circle cx="16" cy="16" r="2"/></svg>';
        cell.appendChild(t);
      }

      if (laserLevel.checkpoints.some(x => x.row === row && x.col === col)) {
        cell.classList.add("checkpoint-cell");
        const c = document.createElement("span");
        c.className = "laser-checkpoint";
        c.dataset.checkpoint = key;
        c.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4"/></svg>';
        cell.appendChild(c);
      }

      if (!hideDesignerSolutionOptics() && laserLevel.fixedMirrors.has(key)) {
        cell.appendChild(makeMirrorElement(laserLevel.fixedMirrors.get(key), true));
      } else if (laserPlayerMirrors.has(key)) {
        cell.appendChild(makeMirrorElement(laserPlayerMirrors.get(key), false));
      }

      if (!hideDesignerSolutionOptics() && laserLevel.fixedSplitters.has(key)) {
        cell.appendChild(makeSplitterElement(laserLevel.fixedSplitters.get(key), true));
      } else if (laserPlayerSplitters.has(key)) {
        cell.appendChild(makeSplitterElement(laserPlayerSplitters.get(key), false));
      }

      cell.addEventListener("click", () => {
        if (laserMode === "setup") handleLaserSetupTap(row, col);
        else handleLaserPlayTap(row, col);
      });
      laserBoard.appendChild(cell);
    }
  }

  // The SVG is re-used, but is re-attached after the cell rebuild so its
  // coordinate space always matches the board exactly.
  laserBoard.appendChild(laserBeamLayer);
  updateInventoryDisplay();
}

function traceSingleBeam(state, hitCheckpoints, hitTargets, queue) {
  const points = [];
  const seen = new Set();
  let { row, col, dir } = state;
  points.push(laserCellCenter(row, col));

  for (let step = 0; step < 500; step++) {
    const stateKey = `${row},${col},${dir}`;
    if (seen.has(stateKey)) break;
    seen.add(stateKey);

    const [dr, dc] = laserDirVectors[dir];
    const nr = row + dr;
    const nc = col + dc;

    if (!laserInBounds(nr, nc)) {
      points.push([(col + 0.5 + dc * 0.5) * 100, (row + 0.5 + dr * 0.5) * 100]);
      break;
    }

    const key = laserKey(nr, nc);
    if (laserLevel.blocks.has(key)) {
      points.push([(col + 0.5 + dc * 0.5) * 100, (row + 0.5 + dr * 0.5) * 100]);
      break;
    }

    row = nr;
    col = nc;
    points.push(laserCellCenter(row, col));

    if (laserLevel.checkpoints.some(x => x.row === row && x.col === col)) hitCheckpoints.add(key);

    if (laserLevel.targets.some(x => x.row === row && x.col === col)) {
      hitTargets.add(key);
      break;
    }

    const mirror = activeMirrorAt(key);
    if (mirror !== null) {
      dir = laserReflect(dir, mirror);
      continue;
    }

    const splitter = activeSplitterAt(key);
    if (splitter !== null) {
      const reflected = laserReflect(dir, splitter);
      queue.push({ row, col, dir: reflected });
      // The original beam deliberately continues straight.
    }
  }

  return points;
}

function calculateStars(used, par) {
  if (!par || par <= 0) return 0;
  const over = Math.max(0, used - par);
  return Math.max(1, 5 - over);
}

function starString(stars) {
  if (stars <= 0) return "✓";
  return `${"★".repeat(stars)}${"☆".repeat(5 - stars)}`;
}

function recordLaserProgress(stars, used) {
  if (stars <= 0) return;
  try {
    const progress = JSON.parse(localStorage.getItem("gameHubProgress") || "{}");
    const game = progress["game-08"] || { bestStars: 0, generated: {}, designed: {} };
    game.bestStars = Math.max(game.bestStars || 0, stars);

    if (laserPlaySource === "generated") {
      const old = game.generated[laserDifficulty] || {};
      game.generated[laserDifficulty] = {
        bestStars: Math.max(old.bestStars || 0, stars),
        bestPieces: old.bestPieces ? Math.min(old.bestPieces, used) : used
      };
    } else {
      const levelName = laserLevelName.value.trim() || "Current designed level";
      const old = game.designed[levelName] || {};
      game.designed[levelName] = {
        bestStars: Math.max(old.bestStars || 0, stars),
        bestPieces: old.bestPieces ? Math.min(old.bestPieces, used) : used
      };
    }

    progress["game-08"] = game;
    localStorage.setItem("gameHubProgress", JSON.stringify(progress));
  } catch {
    // Scoring should never stop the puzzle itself from working.
  }
}

function traceLaser() {
  laserBeamLayer.innerHTML = "";
  laserBeamLayer.setAttribute("viewBox", `0 0 ${laserColsCount * 100} ${laserRowsCount * 100}`);

  const hitCheckpoints = new Set();
  const hitTargets = new Set();

  if (!laserLevel.emitter) {
    updateLaserStats(hitCheckpoints, hitTargets);
    laserStatus.textContent = laserMode === "setup"
      ? "Place a laser and at least one target, then build your puzzle."
      : "This level needs a laser.";
    return;
  }

  const queue = [{ ...laserLevel.emitter }];
  let processed = 0;
  while (queue.length && processed < 48) {
    const beam = queue.shift();
    processed++;
    const points = traceSingleBeam(beam, hitCheckpoints, hitTargets, queue);
    if (points.length > 1) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("class", `laser-beam-line branch-${((processed - 1) % 4) + 1}`);
      line.setAttribute("points", points.map(([x, y]) => `${x},${y}`).join(" "));
      laserBeamLayer.appendChild(line);
    }
  }

  document.querySelectorAll(".laser-checkpoint").forEach(m => m.classList.toggle("hit", hitCheckpoints.has(m.dataset.checkpoint)));
  document.querySelectorAll(".laser-target").forEach(m => m.classList.toggle("hit", hitTargets.has(m.dataset.target)));
  updateLaserStats(hitCheckpoints, hitTargets);

  const checkpointsOkay = laserLevel.checkpoints.length === 0 || hitCheckpoints.size === laserLevel.checkpoints.length;
  const targetsOkay = laserLevel.targets.length > 0 && hitTargets.size === laserLevel.targets.length;

  if (laserMode === "play" && checkpointsOkay && targetsOkay) {
    const used = playerPieceCount();
    const stars = calculateStars(used, laserLevel.par);
    laserStatus.classList.add("good");
    laserStatus.textContent = "Puzzle solved!";
    laserResultStars.textContent = starString(stars);
    laserResultText.textContent = laserLevel.par > 0
      ? `${used} pieces used · 5-star par ${laserLevel.par}.`
      : `${used} player pieces used.`;
    laserResult.classList.remove("hidden");
    recordLaserProgress(stars, used);
  } else {
    laserStatus.classList.remove("good", "bad");
    laserResult.classList.add("hidden");
    if (laserMode === "play") {
      if (!laserLevel.targets.length) laserStatus.textContent = "This level needs at least one target.";
      else if (laserLevel.inventory.splitters > 0) laserStatus.textContent = "Route the beam. Decide where mirrors and splitters belong.";
      else laserStatus.textContent = "Place mirrors to hit every checkpoint and target.";
    }
  }
}

function updateLaserStats(hitCheckpoints, hitTargets) {
  const used = playerPieceCount();
  laserPieceCount.textContent = `${used} / ${laserLevel.par > 0 ? laserLevel.par : "—"}`;
  laserCheckpointCount.textContent = `${hitCheckpoints.size} / ${laserLevel.checkpoints.length}`;
  laserTargetCount.textContent = `${hitTargets.size} / ${laserLevel.targets.length}`;
  updateInventoryDisplay();
}

function updateInventoryDisplay() {
  if (!laserMirrorsLeft) return;
  const mirrorTotal = laserLevel.inventory?.mirrors || 0;
  const splitterTotal = laserLevel.inventory?.splitters || 0;
  laserMirrorsLeft.textContent = `${Math.max(0, mirrorTotal - laserPlayerMirrors.size)} / ${mirrorTotal}`;
  laserSplittersLeft.textContent = `${Math.max(0, splitterTotal - laserPlayerSplitters.size)} / ${splitterTotal}`;
  laserParDisplay.textContent = laserLevel.par > 0 ? String(laserLevel.par) : "—";
}

function mirrorOrientationForTurn(inDir, outDir) {
  if (laserReflect(inDir, 0) === outDir) return 0;
  if (laserReflect(inDir, 1) === outDir) return 1;
  return null;
}
function randomBetween(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function shuffleArray(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [items[i], items[k]] = [items[k], items[i]];
  }
  return items;
}
function mazeNeighbors(row, col, rows, cols) {
  const out = [];
  for (const [dr, dc] of laserDirVectors) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push({ row: nr, col: nc });
  }
  return out;
}
function routeDirection(a, b) {
  if (b.row < a.row) return 0;
  if (b.col > a.col) return 1;
  if (b.row > a.row) return 2;
  return 3;
}

function shortestMazePath(start, target, blocks, rows, cols) {
  const q = [start];
  const parent = new Map();
  const seen = new Set([laserKey(start.row, start.col)]);
  let qIndex = 0;

  while (qIndex < q.length) {
    const cur = q[qIndex++];
    if (cur.row === target.row && cur.col === target.col) {
      const path = [];
      let node = cur;
      let key = laserKey(cur.row, cur.col);
      while (node) {
        path.push(node);
        const p = parent.get(key);
        if (!p) break;
        node = p.node;
        key = p.key;
      }
      return path.reverse();
    }

    for (const n of mazeNeighbors(cur.row, cur.col, rows, cols)) {
      const key = laserKey(n.row, n.col);
      if (seen.has(key) || blocks.has(key)) continue;
      seen.add(key);
      parent.set(key, { node: cur, key: laserKey(cur.row, cur.col) });
      q.push(n);
    }
  }
  return null;
}

function recursiveDivide(blocks, minRow, maxRow, minCol, maxCol, depth = 0) {
  const height = maxRow - minRow + 1;
  const width = maxCol - minCol + 1;
  if (width < 4 || height < 4) return;

  const horizontal = height > width ? true : width > height ? false : Math.random() < 0.5;
  if (horizontal) {
    const candidates = [];
    for (let r = minRow + 1; r <= maxRow - 1; r++) candidates.push(r);
    if (!candidates.length) return;
    const wallRow = candidates[Math.floor(Math.random() * candidates.length)];
    const openings = new Set();
    const openingCount = depth < 1 ? 2 : 1;
    while (openings.size < openingCount) openings.add(randomBetween(minCol, maxCol));
    for (let col = minCol; col <= maxCol; col++) if (!openings.has(col)) blocks.add(laserKey(wallRow, col));
    recursiveDivide(blocks, minRow, wallRow - 1, minCol, maxCol, depth + 1);
    recursiveDivide(blocks, wallRow + 1, maxRow, minCol, maxCol, depth + 1);
  } else {
    const candidates = [];
    for (let col = minCol + 1; col <= maxCol - 1; col++) candidates.push(col);
    if (!candidates.length) return;
    const wallCol = candidates[Math.floor(Math.random() * candidates.length)];
    const openings = new Set();
    const openingCount = depth < 1 ? 2 : 1;
    while (openings.size < openingCount) openings.add(randomBetween(minRow, maxRow));
    for (let row = minRow; row <= maxRow; row++) if (!openings.has(row)) blocks.add(laserKey(row, wallCol));
    recursiveDivide(blocks, minRow, maxRow, minCol, wallCol - 1, depth + 1);
    recursiveDivide(blocks, minRow, maxRow, wallCol + 1, maxCol, depth + 1);
  }
}

function compressMazePath(path) {
  if (path.length < 3) return path.slice();
  const out = [path[0]];
  let prevDir = routeDirection(path[0], path[1]);
  for (let i = 1; i < path.length - 1; i++) {
    const nextDir = routeDirection(path[i], path[i + 1]);
    if (nextDir !== prevDir) {
      out.push(path[i]);
      prevDir = nextDir;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

function chooseCheckpointIndices(path, count) {
  if (count <= 0) return [];
  const turns = new Set();
  for (let i = 1; i < path.length - 1; i++) {
    if (routeDirection(path[i - 1], path[i]) !== routeDirection(path[i], path[i + 1])) turns.add(i);
  }

  const candidates = [];
  for (let i = 4; i < path.length - 4; i++) {
    if (turns.has(i) || turns.has(i - 1) || turns.has(i + 1)) continue;
    candidates.push(i);
  }
  if (candidates.length < count) {
    for (let i = 3; i < path.length - 3; i++) if (!turns.has(i) && !candidates.includes(i)) candidates.push(i);
  }
  if (!candidates.length) return [];

  const chosen = [];
  for (let n = 1; n <= count; n++) {
    const wanted = (path.length - 1) * (n / (count + 1));
    let best = null;
    let bestDist = Infinity;
    for (const idx of candidates) {
      if (chosen.includes(idx)) continue;
      const d = Math.abs(idx - wanted);
      if (d < bestDist) { best = idx; bestDist = d; }
    }
    if (best !== null) chosen.push(best);
  }
  return chosen.sort((a, b) => a - b);
}

function findSplitterCandidates(path, blocks, rows, cols) {
  const pathKeys = new Set(path.map(p => laserKey(p.row, p.col)));
  const candidates = [];

  for (let i = Math.max(5, Math.floor(path.length * 0.25)); i < path.length - 5; i++) {
    const inDir = routeDirection(path[i - 1], path[i]);
    const outDir = routeDirection(path[i], path[i + 1]);
    if (inDir !== outDir) continue;

    for (const branchDir of shuffleArray([(inDir + 3) % 4, (inDir + 1) % 4])) {
      const [dr, dc] = laserDirVectors[branchDir];
      let r = path[i].row;
      let c = path[i].col;
      const cells = [];

      for (let s = 0; s < 4; s++) {
        r += dr;
        c += dc;
        const key = laserKey(r, c);
        if (r < 0 || r >= rows || c < 0 || c >= cols || blocks.has(key) || pathKeys.has(key)) break;
        cells.push({ row: r, col: c });
      }

      if (cells.length >= 2) {
        const orientation = mirrorOrientationForTurn(inDir, branchDir);
        if (orientation !== null) {
          candidates.push({ index: i, cell: { ...path[i] }, orientation, cells });
        }
      }
    }
  }
  return shuffleArray(candidates);
}

function chooseSplitterBranches(candidates, count) {
  const chosen = [];
  const occupiedBranchCells = new Set();

  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    if (chosen.some(x => Math.abs(x.index - candidate.index) < 4)) continue;
    if (candidate.cells.some(p => occupiedBranchCells.has(laserKey(p.row, p.col)))) continue;

    const length = randomBetween(2, candidate.cells.length);
    const target = candidate.cells[length - 1];
    const branchCells = candidate.cells.slice(0, length);
    chosen.push({ ...candidate, target, branchCells });
    branchCells.forEach(p => occupiedBranchCells.add(laserKey(p.row, p.col)));
  }
  return chosen;
}

function tryGenerateMazePuzzle() {
  const D = laserDifficultyInfo[laserDifficulty];
  const size = laserGridSizes[D.grid];
  const rows = size.rows;
  const cols = size.cols;
  const blocks = new Set();
  recursiveDivide(blocks, 0, rows - 1, 0, cols - 1);

  const start = { row: randomBetween(1, rows - 2), col: 0 };
  let target = { row: randomBetween(1, rows - 2), col: cols - 1 };
  for (let tries = 0; tries < 20 && Math.abs(target.row - start.row) < 2; tries++) {
    target = { row: randomBetween(1, rows - 2), col: cols - 1 };
  }

  [start, target, { row: start.row, col: 1 }, { row: target.row, col: cols - 2 }]
    .forEach(p => blocks.delete(laserKey(p.row, p.col)));

  const path = shortestMazePath(start, target, blocks, rows, cols);
  if (!path || path.length < Math.max(9, Math.floor(rows * 1.35))) return null;

  const compressed = compressMazePath(path);
  const mirrorCount = Math.max(0, compressed.length - 2);
  if (mirrorCount < D.minMirrors) return null;
  if (routeDirection(path[0], path[1]) !== 1) return null;

  const checkpointIndices = chooseCheckpointIndices(path, D.checkpoints);
  if (checkpointIndices.length < D.checkpoints) return null;

  const solutionMirrors = [];
  for (let i = 1; i < path.length - 1; i++) {
    const inDir = routeDirection(path[i - 1], path[i]);
    const outDir = routeDirection(path[i], path[i + 1]);
    if (inDir !== outDir) {
      const orientation = mirrorOrientationForTurn(inDir, outDir);
      if (orientation === null) return null;
      solutionMirrors.push({ row: path[i].row, col: path[i].col, orientation });
    }
  }

  const splitterBranches = chooseSplitterBranches(findSplitterCandidates(path, blocks, rows, cols), D.splitters);
  if (splitterBranches.length < D.splitters) return null;

  const level = {
    emitter: { row: start.row, col: start.col, dir: 1 },
    checkpoints: checkpointIndices.map(i => ({ ...path[i] })),
    targets: [{ ...target }, ...splitterBranches.map(x => ({ ...x.target }))],
    fixedMirrors: new Map(),
    fixedSplitters: new Map(),
    blocks,
    inventory: {
      mirrors: solutionMirrors.length + D.mirrorSlack,
      splitters: D.splitters
    },
    par: solutionMirrors.length + D.splitters
  };

  return {
    level,
    solution: {
      mirrors: solutionMirrors,
      splitters: splitterBranches.map(x => ({ row: x.cell.row, col: x.cell.col, orientation: x.orientation }))
    }
  };
}

function generateLaserLevel() {
  clearPlayerPieces();
  laserPlaySource = "generated";

  let generated = null;
  for (let attempt = 0; attempt < 320 && !generated; attempt++) generated = tryGenerateMazePuzzle();

  if (!generated) {
    laserStatus.textContent = "Could not generate a level. Tap New to try again.";
    return;
  }

  const D = laserDifficultyInfo[laserDifficulty];
  laserGridSize = D.grid;
  laserRowsCount = laserGridSizes[D.grid].rows;
  laserColsCount = laserGridSizes[D.grid].cols;
  laserLevel = generated.level;
  laserLevelName.value = "";
  laserSizeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserSize === D.grid));
  laserResult.classList.add("hidden");
  renderLaserBoard();
  traceLaser();
}

function validateDesignedLevel() {
  syncLevelSettingsFromDesigner();
  if (!laserLevel.emitter) return "Add a laser before playing this level.";
  if (!laserLevel.targets.length) return "Add at least one target before playing this level.";
  return "";
}

function playDesignedLevel() {
  const error = validateDesignedLevel();
  if (error) {
    laserStatus.textContent = error;
    return;
  }
  clearPlayerPieces();
  laserPlaySource = "designed";
  setLaserMode("play", { generate: false });
  laserStatus.textContent = "Designed level: the solution optics are hidden. Rebuild the route with the player pieces.";
}

function serializeLaserLevel() {
  syncLevelSettingsFromDesigner();
  return {
    version: 2,
    name: laserLevelName.value.trim() || "Untitled Laser Level",
    gridSize: laserGridSize,
    rows: laserRowsCount,
    cols: laserColsCount,
    emitter: laserLevel.emitter,
    checkpoints: laserLevel.checkpoints,
    targets: laserLevel.targets,
    fixedMirrors: [...laserLevel.fixedMirrors.entries()],
    fixedSplitters: [...laserLevel.fixedSplitters.entries()],
    blocks: [...laserLevel.blocks],
    inventory: { ...laserLevel.inventory },
    par: laserLevel.par
  };
}

function deserializeLaserLevel(data) {
  const sizeName = data.gridSize && laserGridSizes[data.gridSize] ? data.gridSize : "large";
  laserGridSize = sizeName;
  laserRowsCount = data.rows || laserGridSizes[sizeName].rows;
  laserColsCount = data.cols || laserGridSizes[sizeName].cols;

  const savedEmitter = data.emitter ? { ...data.emitter } : null;
  if (savedEmitter) {
    if (savedEmitter.dir > 3) savedEmitter.dir = Math.round(savedEmitter.dir / 2) % 4;
    savedEmitter.dir = ((savedEmitter.dir % 4) + 4) % 4;
  }

  // Older saves stored Designer optics under the fixedMirrors/fixedSplitters names.
  // They are retained for file compatibility, but in designed play they act as
  // the hidden reference solution rather than pre-placed player pieces.
  const rawSplitters = Array.isArray(data.fixedSplitters) ? data.fixedSplitters : (Array.isArray(data.splitters) ? data.splitters : []);
  const rawMirrors = Array.isArray(data.fixedMirrors) ? data.fixedMirrors : [];

  laserLevel = {
    emitter: savedEmitter,
    checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints : [],
    targets: Array.isArray(data.targets) ? data.targets : [],
    fixedMirrors: new Map(rawMirrors.map(([k, v]) => [k, normaliseOrientation(v)])),
    fixedSplitters: new Map(rawSplitters.map(([k, v]) => [k, normaliseOrientation(v)])),
    blocks: new Set(Array.isArray(data.blocks) ? data.blocks : []),
    inventory: {
      mirrors: clampInt(data.inventory?.mirrors, 0, 30, 6),
      splitters: clampInt(data.inventory?.splitters, 0, 8, 1)
    },
    par: clampInt(data.par, 0, 40, 0)
  };

  clearPlayerPieces();
  laserLevelName.value = data.name || "";
  laserSizeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserSize === sizeName));
  syncDesignerSettingsFromLevel();
  setLaserMode("setup", { generate: false });
}

function getSavedLaserLevels() {
  try { return JSON.parse(localStorage.getItem("laserLabSavedLevels") || "{}"); }
  catch { return {}; }
}
function storeSavedLaserLevels(levels) { localStorage.setItem("laserLabSavedLevels", JSON.stringify(levels)); }

function laserSafeFileName(name) {
  const cleaned = String(name || "Laser Lab Level")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 60);
  return cleaned || "Laser Lab Level";
}

async function exportLaserLevel() {
  const levels = getSavedLaserLevels();
  const selectedName = laserSavedLevels.value;
  const data = selectedName && levels[selectedName] ? levels[selectedName] : serializeLaserLevel();
  const levelName = data.name || selectedName || "Laser Lab Level";
  const fileName = `${laserSafeFileName(levelName)}.laser.json`;
  const json = JSON.stringify(data, null, 2);

  try {
    const file = new File([json], fileName, { type: "application/json" });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: levelName,
        text: "GameHub Laser Lab level"
      });
      laserStatus.textContent = `Exported "${levelName}".`;
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.warn("Laser Lab share export failed; falling back to download.", error);
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  laserStatus.textContent = `Exported "${levelName}".`;
}

function uniqueImportedLaserName(baseName, levels) {
  const base = String(baseName || "Imported Laser Level").trim() || "Imported Laser Level";
  if (!levels[base]) return base;
  let number = 2;
  let candidate = `${base} (imported)`;
  while (levels[candidate]) {
    candidate = `${base} (imported ${number})`;
    number += 1;
  }
  return candidate;
}

async function importLaserLevelFile(file) {
  if (!file) return;
  try {
    const raw = await file.text();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid level data");
    if (!data.emitter && !Array.isArray(data.targets) && !Array.isArray(data.checkpoints)) throw new Error("Not a Laser Lab level");

    const levels = getSavedLaserLevels();
    const importedName = uniqueImportedLaserName(data.name || file.name.replace(/\.laser\.json$|\.json$/i, ""), levels);
    const imported = { ...data, name: importedName };

    // Deserialising normalises older level formats before we save the imported copy.
    deserializeLaserLevel(imported);
    const normalised = serializeLaserLevel();
    normalised.name = importedName;
    levels[importedName] = normalised;
    storeSavedLaserLevels(levels);
    refreshSavedLaserLevels();
    laserSavedLevels.value = importedName;
    laserLevelName.value = importedName;
    laserStatus.textContent = `Imported "${importedName}".`;
  } catch (error) {
    console.warn("Laser Lab level import failed.", error);
    laserStatus.textContent = "Could not import that Laser Lab level.";
  } finally {
    laserImportFile.value = "";
  }
}

function refreshSavedLaserLevels() {
  const levels = getSavedLaserLevels();
  laserSavedLevels.innerHTML = '<option value="">Saved levels…</option>';
  Object.keys(levels).sort().forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    laserSavedLevels.appendChild(option);
  });
}

laserModeButtons.forEach(b => b.addEventListener("click", () => {
  if (b.dataset.laserMode === "play") setLaserMode("play", { generate: true });
  else setLaserMode("setup", { generate: false });
}));

laserSizeButtons.forEach(b => b.addEventListener("click", () => {
  const nextSize = b.dataset.laserSize;
  if (nextSize === laserGridSize) return;
  confirmNewLaserDesigner(nextSize);
}));

laserSetupTools.forEach(b => b.addEventListener("click", () => {
  laserSetupTool = b.dataset.laserTool;
  laserSetupTools.forEach(x => x.classList.toggle("active", x === b));
}));

laserPlayTools.forEach(b => b.addEventListener("click", () => {
  laserPlayTool = b.dataset.laserPlayTool;
  laserPlayTools.forEach(x => x.classList.toggle("active", x === b));
}));

[laserDesignMirrors, laserDesignSplitters, laserDesignPar].forEach(input => {
  input.addEventListener("change", syncLevelSettingsFromDesigner);
  input.addEventListener("blur", () => {
    syncLevelSettingsFromDesigner();
    syncDesignerSettingsFromLevel();
  });
});

laserDifficultyButtons.forEach(b => {
  b.classList.toggle("active", b.dataset.laserDifficulty === laserDifficulty);
  b.addEventListener("click", () => {
    laserDifficulty = b.dataset.laserDifficulty;
    localStorage.setItem("laserDifficulty", laserDifficulty);
    laserDifficultyButtons.forEach(x => x.classList.toggle("active", x === b));
    generateLaserLevel();
  });
});

laserNewDesigner.addEventListener("click", () => confirmNewLaserDesigner(laserGridSize));
laserPlayDesigned.addEventListener("click", playDesignedLevel);
laserNewGenerated.addEventListener("click", generateLaserLevel);
laserResetPlay.addEventListener("click", () => {
  clearPlayerPieces();
  laserResult.classList.add("hidden");
  renderLaserBoard();
  traceLaser();
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

laserExportButton.addEventListener("click", exportLaserLevel);
laserImportButton.addEventListener("click", () => laserImportFile.click());
laserImportFile.addEventListener("change", () => importLaserLevelFile(laserImportFile.files?.[0]));

laserDeleteButton.addEventListener("click", () => {
  const name = laserSavedLevels.value;
  if (!name) return;
  const levels = getSavedLaserLevels();
  delete levels[name];
  storeSavedLaserLevels(levels);
  refreshSavedLaserLevels();
  laserSavedLevels.value = "";
  laserStatus.textContent = `Deleted "${name}".`;
});

refreshSavedLaserLevels();
syncDesignerSettingsFromLevel();
setLaserMode("play", { generate: true });
