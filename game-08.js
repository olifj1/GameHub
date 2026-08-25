// Maze v1.3.0
// The original grid Laser Lab has become a maze-routing game. One board model
// is still shared by Designer, saved levels and generated play. Designer corner
// reflectors/splitters describe the intended solution and are hidden while testing.

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
  small: { rows: 13, cols: 13 },
  medium: { rows: 15, cols: 15 },
  large: { rows: 17, cols: 17 }
};

// Maze difficulty changes both scale and route ambiguity. Every generated maze
// contains loops, and checkpoints remain part of Hard rather than disappearing.
const laserDifficultyInfo = {
  easy:   { grid: "small",  checkpoints: 2, splitters: 0, minMirrors: 4, maxMirrors: 8,  mirrorSlack: 3, braid: 7 },
  medium: { grid: "medium", checkpoints: 2, splitters: 1, minMirrors: 5, maxMirrors: 14, mirrorSlack: 4, braid: 11 },
  hard:   { grid: "large",  checkpoints: 3, splitters: 1, minMirrors: 7, maxMirrors: 20, mirrorSlack: 5, braid: 16 }
};

let laserDifficulty = localStorage.getItem("laserDifficulty") || "easy";
if (!laserDifficultyInfo[laserDifficulty]) laserDifficulty = "easy";

// Cardinal beam directions: up, right, down, left.
const laserDirVectors = [[-1, 0], [0, 1], [1, 0], [0, -1]];

let laserMode = "setup";
let laserGridSize = "large";
let laserRowsCount = 17;
let laserColsCount = 17;
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
  laserStatus.textContent = "New blank maze. Saved mazes have not been changed.";
}

function confirmNewLaserDesigner(sizeName = laserGridSize) {
  if (laserDesignerHasWork()) {
    const okay = window.confirm("Start a new maze? The current designer board will be cleared. Your saved mazes will not be changed.");
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

  if (laserSetupTool === "target") {
    const existing = laserLevel.targets.find(x => x.row === row && x.col === col);
    if (existing) {
      const colours = ["white", "red", "blue"];
      existing.color = colours[(colours.indexOf(existing.color || "white") + 1) % colours.length];
      renderLaserBoard();
      traceLaser();
      return;
    }
  }

  clearLaserCell(row, col);
  if (laserSetupTool === "emitter") laserLevel.emitter = { row, col, dir: 1 };
  if (laserSetupTool === "checkpoint") laserLevel.checkpoints.push({ row, col });
  if (laserSetupTool === "target") laserLevel.targets.push({ row, col, color: "white" });
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
        laserStatus.textContent = "No corner pieces left. Erase one to move it.";
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
  m.className = `laser-mirror maze-corner angle-${orientation}${fixed ? " fixed-optic" : ""}`;
  m.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="maze-corner-fill" d="M4 28L28 4V28Z"/><path class="maze-corner-hatch" d="M12 28l16-16M18 28l10-10M24 28l4-4"/><path class="maze-corner-face" d="M4 28L28 4"/></svg>';
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

      const targetData = laserLevel.targets.find(x => x.row === row && x.col === col);
      if (targetData) {
        const targetColour = targetData.color || "white";
        cell.classList.add("target-cell", `target-cell-${targetColour}`);
        const t = document.createElement("span");
        t.className = `laser-target target-${targetColour}`;
        t.dataset.target = key;
        const label = targetColour === "red" ? "R" : targetColour === "blue" ? "B" : "E";
        t.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><text x="16" y="19" text-anchor="middle">${label}</text></svg>`;
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

function targetAcceptsColour(target, colour) {
  return (target.color || "white") === colour;
}

function traceSingleBeam(state, hitCheckpoints, hitTargets, wrongTargets, queue) {
  const segments = [];
  const seen = new Set();
  let { row, col, dir } = state;
  let colour = state.color || "white";
  let points = [laserCellCenter(row, col)];

  function finishSegment() {
    if (points.length > 1) segments.push({ points, colour });
  }

  for (let step = 0; step < 800; step++) {
    const stateKey = `${row},${col},${dir},${colour}`;
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

    const target = laserLevel.targets.find(x => x.row === row && x.col === col);
    if (target) {
      if (targetAcceptsColour(target, colour)) hitTargets.add(key);
      else wrongTargets.add(key);
      break;
    }

    const mirror = activeMirrorAt(key);
    if (mirror !== null) {
      dir = laserReflect(dir, mirror);
      continue;
    }

    const splitter = activeSplitterAt(key);
    if (splitter !== null && colour === "white") {
      // A white beam becomes two distinct puzzle routes. Red continues straight;
      // blue follows the reflected branch.
      const reflected = laserReflect(dir, splitter);
      queue.push({ row, col, dir: reflected, color: "blue" });
      finishSegment();
      colour = "red";
      points = [laserCellCenter(row, col)];
    }
  }

  finishSegment();
  return segments;
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
      const levelName = laserLevelName.value.trim() || "Current designed maze";
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
  const wrongTargets = new Set();

  if (!laserLevel.emitter) {
    updateLaserStats(hitCheckpoints, hitTargets);
    laserStatus.textContent = laserMode === "setup"
      ? "Place a start laser and at least one exit, then build your maze."
      : "This maze needs a start laser.";
    return;
  }

  const queue = [{ ...laserLevel.emitter, color: "white" }];
  let processed = 0;
  while (queue.length && processed < 48) {
    const beam = queue.shift();
    processed++;
    const segments = traceSingleBeam(beam, hitCheckpoints, hitTargets, wrongTargets, queue);
    segments.forEach(segment => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("class", `laser-beam-line beam-${segment.colour}`);
      line.setAttribute("points", segment.points.map(([x, y]) => `${x},${y}`).join(" "));
      laserBeamLayer.appendChild(line);
    });
  }

  document.querySelectorAll(".laser-checkpoint").forEach(m => m.classList.toggle("hit", hitCheckpoints.has(m.dataset.checkpoint)));
  document.querySelectorAll(".laser-target").forEach(m => {
    m.classList.toggle("hit", hitTargets.has(m.dataset.target));
    m.classList.toggle("wrong", wrongTargets.has(m.dataset.target) && !hitTargets.has(m.dataset.target));
  });
  updateLaserStats(hitCheckpoints, hitTargets);

  const checkpointsOkay = laserLevel.checkpoints.length === 0 || hitCheckpoints.size === laserLevel.checkpoints.length;
  const targetsOkay = laserLevel.targets.length > 0 && hitTargets.size === laserLevel.targets.length;

  if (laserMode === "play" && checkpointsOkay && targetsOkay) {
    const used = playerPieceCount();
    const stars = calculateStars(used, laserLevel.par);
    laserStatus.classList.add("good");
    laserStatus.textContent = "Maze complete!";
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
      if (!laserLevel.targets.length) laserStatus.textContent = "This maze needs at least one exit.";
      else if (wrongTargets.size) laserStatus.textContent = "That exit needs a different colour.";
      else if (laserLevel.inventory.splitters > 0) laserStatus.textContent = "Find the route, then split white light into the matching coloured exits.";
      else laserStatus.textContent = "Use diagonal corners to guide the beam through every checkpoint to the exit.";
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

function oddInteriorValues(size) {
  const values = [];
  for (let n = 1; n <= size - 2; n += 2) values.push(n);
  return values;
}

function carveBraidedMaze(rows, cols, braidOpenings) {
  const blocks = new Set();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) blocks.add(laserKey(row, col));
  }

  const oddRows = oddInteriorValues(rows);
  const oddCols = oddInteriorValues(cols);
  const start = {
    row: oddRows[Math.floor(Math.random() * oddRows.length)],
    col: oddCols[Math.floor(Math.random() * oddCols.length)]
  };
  const visited = new Set([laserKey(start.row, start.col)]);
  const stack = [start];
  blocks.delete(laserKey(start.row, start.col));

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const next = [];
    for (const [dr, dc] of laserDirVectors) {
      const nr = cur.row + dr * 2;
      const nc = cur.col + dc * 2;
      if (nr < 1 || nr > rows - 2 || nc < 1 || nc > cols - 2) continue;
      if (visited.has(laserKey(nr, nc))) continue;
      next.push({ row: nr, col: nc, wallRow: cur.row + dr, wallCol: cur.col + dc });
    }

    if (!next.length) {
      stack.pop();
      continue;
    }

    const chosen = next[Math.floor(Math.random() * next.length)];
    blocks.delete(laserKey(chosen.wallRow, chosen.wallCol));
    blocks.delete(laserKey(chosen.row, chosen.col));
    visited.add(laserKey(chosen.row, chosen.col));
    stack.push({ row: chosen.row, col: chosen.col });
  }

  // A perfect maze has one route between any two points. Opening selected
  // separator walls creates loops: real route choices rather than decorative gaps.
  const braidCandidates = [];
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      const key = laserKey(row, col);
      if (!blocks.has(key)) continue;
      if (row % 2 === 1 && col % 2 === 0) {
        if (!blocks.has(laserKey(row, col - 1)) && !blocks.has(laserKey(row, col + 1))) braidCandidates.push({ row, col });
      } else if (row % 2 === 0 && col % 2 === 1) {
        if (!blocks.has(laserKey(row - 1, col)) && !blocks.has(laserKey(row + 1, col))) braidCandidates.push({ row, col });
      }
    }
  }
  shuffleArray(braidCandidates).slice(0, braidOpenings).forEach(p => blocks.delete(laserKey(p.row, p.col)));
  return blocks;
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

function chooseCheckpointIndices(path, count, excludedKeys = new Set()) {
  if (count <= 0) return [];
  const turns = new Set();
  for (let i = 1; i < path.length - 1; i++) {
    if (routeDirection(path[i - 1], path[i]) !== routeDirection(path[i], path[i + 1])) turns.add(i);
  }

  const candidates = [];
  for (let i = 3; i < path.length - 3; i++) {
    const key = laserKey(path[i].row, path[i].col);
    if (excludedKeys.has(key)) continue;
    if (turns.has(i) || turns.has(i - 1) || turns.has(i + 1)) continue;
    candidates.push(i);
  }
  if (candidates.length < count) {
    for (let i = 2; i < path.length - 2; i++) {
      const key = laserKey(path[i].row, path[i].col);
      if (!turns.has(i) && !excludedKeys.has(key) && !candidates.includes(i)) candidates.push(i);
    }
  }
  if (candidates.length < count) return [];

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

function pathSolutionMirrors(path) {
  const mirrors = [];
  for (let i = 1; i < path.length - 1; i++) {
    const inDir = routeDirection(path[i - 1], path[i]);
    const outDir = routeDirection(path[i], path[i + 1]);
    if (inDir === outDir) continue;
    const orientation = mirrorOrientationForTurn(inDir, outDir);
    if (orientation === null) return null;
    mirrors.push({ row: path[i].row, col: path[i].col, orientation });
  }
  return mirrors;
}

function mazeHasRouteChoice(start, target, blocks, path, rows, cols) {
  const candidates = [];
  for (let i = 3; i < path.length - 3; i += Math.max(1, Math.floor(path.length / 10))) candidates.push(path[i]);
  shuffleArray(candidates);
  for (const cell of candidates.slice(0, 8)) {
    const testBlocks = new Set(blocks);
    testBlocks.add(laserKey(cell.row, cell.col));
    if (shortestMazePath(start, target, testBlocks, rows, cols)) return true;
  }
  return false;
}

function boundaryExitCandidates(blocks, rows, cols, excluded = new Set()) {
  const out = [];
  for (let col = 1; col < cols - 1; col++) {
    if (!blocks.has(laserKey(1, col))) out.push({ inner: { row: 1, col }, target: { row: 0, col }, outDir: 0 });
    if (!blocks.has(laserKey(rows - 2, col))) out.push({ inner: { row: rows - 2, col }, target: { row: rows - 1, col }, outDir: 2 });
  }
  for (let row = 1; row < rows - 1; row++) {
    if (!blocks.has(laserKey(row, 1))) out.push({ inner: { row, col: 1 }, target: { row, col: 0 }, outDir: 3 });
    if (!blocks.has(laserKey(row, cols - 2))) out.push({ inner: { row, col: cols - 2 }, target: { row, col: cols - 1 }, outDir: 1 });
  }
  return shuffleArray(out.filter(x => !excluded.has(laserKey(x.target.row, x.target.col))));
}

function findColourBranch(mainPath, blocks, rows, cols, mainTarget, minTurns) {
  const mainKeys = new Set(mainPath.map(p => laserKey(p.row, p.col)));
  const excludedTargets = new Set([
    laserKey(mainPath[0].row, mainPath[0].col),
    laserKey(mainTarget.row, mainTarget.col)
  ]);
  const exits = boundaryExitCandidates(blocks, rows, cols, excludedTargets);
  const candidateIndices = [];
  for (let i = 4; i < mainPath.length - 4; i++) candidateIndices.push(i);
  shuffleArray(candidateIndices);

  for (const i of candidateIndices) {
    const inDir = routeDirection(mainPath[i - 1], mainPath[i]);
    const outDir = routeDirection(mainPath[i], mainPath[i + 1]);
    if (inDir !== outDir) continue;

    const sideDirs = shuffleArray([(inDir + 1) % 4, (inDir + 3) % 4]);
    for (const branchDir of sideDirs) {
      const [dr, dc] = laserDirVectors[branchDir];
      const first = { row: mainPath[i].row + dr, col: mainPath[i].col + dc };
      const firstKey = laserKey(first.row, first.col);
      if (first.row < 1 || first.row >= rows - 1 || first.col < 1 || first.col >= cols - 1) continue;
      if (blocks.has(firstKey) || mainKeys.has(firstKey)) continue;

      const orientation = mirrorOrientationForTurn(inDir, branchDir);
      if (orientation === null) continue;
      const branchBlocks = new Set(blocks);
      mainKeys.forEach(k => branchBlocks.add(k));
      branchBlocks.delete(laserKey(mainPath[i].row, mainPath[i].col));
      branchBlocks.delete(firstKey);

      for (const exit of exits) {
        if (Math.abs(exit.target.row - mainTarget.row) + Math.abs(exit.target.col - mainTarget.col) < Math.floor(rows * 0.45)) continue;
        if (mainKeys.has(laserKey(exit.inner.row, exit.inner.col))) continue;
        const partial = shortestMazePath(first, exit.inner, branchBlocks, rows, cols);
        if (!partial || partial.length < 5) continue;
        const fullPath = [{ ...mainPath[i] }, ...partial, { ...exit.target }];
        const mirrors = pathSolutionMirrors(fullPath);
        if (!mirrors || mirrors.length < minTurns) continue;
        return {
          index: i,
          cell: { ...mainPath[i] },
          orientation,
          path: fullPath,
          target: { ...exit.target, color: "blue" },
          mirrors
        };
      }
    }
  }
  return null;
}

function simulateMazeSolution(level, solution, rows, cols) {
  const mirrors = new Map(solution.mirrors.map(m => [laserKey(m.row, m.col), m.orientation]));
  const splitters = new Map(solution.splitters.map(x => [laserKey(x.row, x.col), x.orientation]));
  const hitTargets = new Set();
  const hitChecks = new Set();
  const queue = [{ ...level.emitter, color: "white" }];
  let beams = 0;

  while (queue.length && beams++ < 24) {
    let { row, col, dir, color } = queue.shift();
    const seen = new Set();
    for (let step = 0; step < 1000; step++) {
      const stateKey = `${row},${col},${dir},${color}`;
      if (seen.has(stateKey)) break;
      seen.add(stateKey);
      const [dr, dc] = laserDirVectors[dir];
      row += dr; col += dc;
      if (row < 0 || row >= rows || col < 0 || col >= cols) break;
      const key = laserKey(row, col);
      if (level.blocks.has(key)) break;
      if (level.checkpoints.some(x => x.row === row && x.col === col)) hitChecks.add(key);
      const target = level.targets.find(x => x.row === row && x.col === col);
      if (target) {
        if ((target.color || "white") === color) hitTargets.add(key);
        break;
      }
      if (mirrors.has(key)) { dir = laserReflect(dir, mirrors.get(key)); continue; }
      if (splitters.has(key) && color === "white") {
        queue.push({ row, col, dir: laserReflect(dir, splitters.get(key)), color: "blue" });
        color = "red";
      }
    }
  }
  return hitTargets.size === level.targets.length && hitChecks.size === level.checkpoints.length;
}

function tryGenerateMazePuzzle() {
  const D = laserDifficultyInfo[laserDifficulty];
  const size = laserGridSizes[D.grid];
  const rows = size.rows;
  const cols = size.cols;
  const blocks = carveBraidedMaze(rows, cols, D.braid);
  const oddRows = oddInteriorValues(rows);

  const startRow = oddRows[Math.floor(Math.random() * oddRows.length)];
  let targetRow = oddRows[Math.floor(Math.random() * oddRows.length)];
  for (let tries = 0; tries < 20 && Math.abs(targetRow - startRow) < Math.floor(rows * 0.3); tries++) {
    targetRow = oddRows[Math.floor(Math.random() * oddRows.length)];
  }

  const start = { row: startRow, col: 0 };
  const mainTarget = { row: targetRow, col: cols - 1, color: D.splitters ? "red" : "white" };
  [start, { row: startRow, col: 1 }, mainTarget, { row: targetRow, col: cols - 2 }]
    .forEach(p => blocks.delete(laserKey(p.row, p.col)));

  const mainPath = shortestMazePath(start, mainTarget, blocks, rows, cols);
  if (!mainPath || mainPath.length < Math.floor(rows * 1.6)) return null;
  if (routeDirection(mainPath[0], mainPath[1]) !== 1) return null;
  if (!mazeHasRouteChoice(start, mainTarget, blocks, mainPath, rows, cols)) return null;

  let mainMirrors = pathSolutionMirrors(mainPath);
  if (!mainMirrors || mainMirrors.length < D.minMirrors) return null;

  let colourBranch = null;
  let targets = [{ ...mainTarget }];
  let splitters = [];
  let branchMirrors = [];
  if (D.splitters) {
    colourBranch = findColourBranch(mainPath, blocks, rows, cols, mainTarget, laserDifficulty === "hard" ? 2 : 1);
    if (!colourBranch) return null;
    blocks.delete(laserKey(colourBranch.target.row, colourBranch.target.col));
    targets.push({ ...colourBranch.target });
    splitters.push({ row: colourBranch.cell.row, col: colourBranch.cell.col, orientation: colourBranch.orientation });
    branchMirrors = colourBranch.mirrors;
  }

  const excludedChecks = new Set(splitters.map(x => laserKey(x.row, x.col)));
  const mainCheckCount = D.splitters ? Math.max(1, D.checkpoints - 1) : D.checkpoints;
  const mainCheckIndices = chooseCheckpointIndices(mainPath, mainCheckCount, excludedChecks);
  if (mainCheckIndices.length < mainCheckCount) return null;
  const checkpoints = mainCheckIndices.map(i => ({ ...mainPath[i] }));

  if (D.splitters) {
    const branchCheckIndices = chooseCheckpointIndices(colourBranch.path, D.checkpoints - mainCheckCount, excludedChecks);
    if (branchCheckIndices.length < D.checkpoints - mainCheckCount) return null;
    branchCheckIndices.forEach(i => checkpoints.push({ ...colourBranch.path[i] }));
  }

  // The two routes are disjoint except at the splitter, so their turn pieces can
  // be merged directly into one hidden reference solution.
  const solutionMirrors = [...mainMirrors, ...branchMirrors];
  const uniqueMirrors = new Map();
  for (const m of solutionMirrors) {
    const key = laserKey(m.row, m.col);
    if (uniqueMirrors.has(key) && uniqueMirrors.get(key).orientation !== m.orientation) return null;
    uniqueMirrors.set(key, m);
  }
  const mirrors = [...uniqueMirrors.values()];
  if (mirrors.length > D.maxMirrors) return null;

  const level = {
    emitter: { row: start.row, col: start.col, dir: 1 },
    checkpoints,
    targets,
    fixedMirrors: new Map(),
    fixedSplitters: new Map(),
    blocks,
    inventory: {
      mirrors: mirrors.length + D.mirrorSlack,
      splitters: D.splitters
    },
    par: mirrors.length + D.splitters
  };
  const solution = { mirrors, splitters };
  if (!simulateMazeSolution(level, solution, rows, cols)) return null;
  return { level, solution };
}

function generateLaserLevel() {
  clearPlayerPieces();
  laserPlaySource = "generated";

  let generated = null;
  for (let attempt = 0; attempt < 700 && !generated; attempt++) generated = tryGenerateMazePuzzle();

  if (!generated) {
    laserStatus.textContent = "Could not carve a maze. Tap New to try again.";
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
  if (!laserLevel.emitter) return "Add a start laser before playing this maze.";
  if (!laserLevel.targets.length) return "Add at least one exit before playing this maze.";
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
  laserStatus.textContent = "Designed maze: the solution corners are hidden. Rebuild the route with the player pieces.";
}

function serializeLaserLevel() {
  syncLevelSettingsFromDesigner();
  return {
    version: 3,
    name: laserLevelName.value.trim() || "Untitled Maze",
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
    targets: Array.isArray(data.targets) ? data.targets.map(t => ({ ...t, color: t.color || "white" })) : [],
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
  const cleaned = String(name || "Maze Level")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 60);
  return cleaned || "Maze Level";
}

async function exportLaserLevel() {
  const levels = getSavedLaserLevels();
  const selectedName = laserSavedLevels.value;
  const data = selectedName && levels[selectedName] ? levels[selectedName] : serializeLaserLevel();
  const levelName = data.name || selectedName || "Maze Level";
  const fileName = `${laserSafeFileName(levelName)}.maze.json`;
  const json = JSON.stringify(data, null, 2);

  try {
    const file = new File([json], fileName, { type: "application/json" });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: levelName,
        text: "GameHub Maze level"
      });
      laserStatus.textContent = `Exported "${levelName}".`;
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.warn("Maze share export failed; falling back to download.", error);
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
  const base = String(baseName || "Imported Maze").trim() || "Imported Maze";
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
    if (!data.emitter && !Array.isArray(data.targets) && !Array.isArray(data.checkpoints)) throw new Error("Not a Maze level");

    const levels = getSavedLaserLevels();
    const importedName = uniqueImportedLaserName(data.name || file.name.replace(/\.maze\.json$|\.laser\.json$|\.json$/i, ""), levels);
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
    console.warn("Maze level import failed.", error);
    laserStatus.textContent = "Could not import that Maze level.";
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
