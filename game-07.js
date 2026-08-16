// ----------------------------
const codingBoard = $("#coding-board");
const codingStatus = $("#coding-status");
const codingLevelButtons = $$("[data-coding-level]");
const commandButtons = $$("[data-command]");
const programTimeline = $("#program-timeline");
const programCount = $("#program-count");
const codingRun = $("#coding-run");
const codingClear = $("#coding-clear");
const codingUndo = $("#coding-undo");
const newCodingPuzzle = $("#new-coding-puzzle");
const codingGuideToggle = $("#coding-guide-toggle");
const codingWinOverlay = $("#coding-win-overlay");
const codingWinStars = $("#coding-win-stars");
const codingWinText = $("#coding-win-text");

const CODING_ROWS = 7;
const CODING_COLS = 6;

const codingLevelInfo = {
  easy: {
    minCommands: 7,
    minTurns: 2,
    extraOpenCells: 13,
    maxCommands: 18
  },
  medium: {
    minCommands: 10,
    minTurns: 3,
    extraOpenCells: 7,
    maxCommands: 22
  },
  hard: {
    minCommands: 13,
    minTurns: 4,
    extraOpenCells: 2,
    maxCommands: 28
  }
};

const directionVectors = [
  [-1, 0], // north
  [0, 1],  // east
  [1, 0],  // south
  [0, -1]  // west
];

const commandGlyphs = {
  forward: "↑",
  back: "↓",
  left: "↶",
  right: "↷"
};

const absoluteMoveGlyph = {
  "0,-1": "←",
  "0,1": "→",
  "-1,0": "↑",
  "1,0": "↓"
};

let codingLevel = localStorage.getItem("codingLevel") || "easy";
let codingGuideOn = localStorage.getItem("codingGuideOn") !== "false";
let codingPuzzle = null;
let codingProgram = [];
let codingRunning = false;
let codingRunToken = 0;

codingGuideToggle.checked = codingGuideOn;

function cellKey(row, col) {
  return `${row},${col}`;
}

function codingInBounds(row, col) {
  return row >= 0 && row < CODING_ROWS && col >= 0 && col < CODING_COLS;
}

function codingBlocked(row, col, puzzle = codingPuzzle) {
  return puzzle.obstacles.has(cellKey(row, col));
}

function nextCodingState(state, command, puzzle = codingPuzzle) {
  let { row, col, dir } = state;

  if (command === "left") {
    return { row, col, dir: (dir + 3) % 4, collision: false };
  }

  if (command === "right") {
    return { row, col, dir: (dir + 1) % 4, collision: false };
  }

  const [dr, dc] = directionVectors[dir];
  const sign = command === "back" ? -1 : 1;
  const nr = row + dr * sign;
  const nc = col + dc * sign;

  if (!codingInBounds(nr, nc) || codingBlocked(nr, nc, puzzle)) {
    return { row, col, dir, collision: true };
  }

  return { row: nr, col: nc, dir, collision: false };
}

function codingShortestProgram(puzzle) {
  const start = { row: puzzle.start.row, col: puzzle.start.col, dir: 0 };
  const queue = [{ state: start, path: [] }];
  const seen = new Set([`${start.row},${start.col},${start.dir}`]);
  const commands = ["forward", "back", "left", "right"];

  while (queue.length) {
    const current = queue.shift();
    const s = current.state;

    if (s.row === puzzle.goal.row && s.col === puzzle.goal.col) {
      return current.path;
    }

    for (const command of commands) {
      const n = nextCodingState(s, command, puzzle);
      if (n.collision) continue;

      const key = `${n.row},${n.col},${n.dir}`;
      if (seen.has(key)) continue;

      seen.add(key);
      queue.push({ state: n, path: [...current.path, command] });
    }
  }

  return null;
}

function countProgramTurns(program) {
  return program.filter(command => command === "left" || command === "right").length;
}

// Make one long, self-avoiding route first, then turn most other cells into blocks.
// This produces much more maze-like layouts than simply scattering random blocks.
function makeWindingRoute(start, goal, minimumCells) {
  const path = [{ ...start }];
  const visited = new Set([cellKey(start.row, start.col)]);

  function dfs(row, col) {
    if (
      row === goal.row &&
      col === goal.col &&
      path.length >= minimumCells
    ) {
      return true;
    }

    const candidates = [
      [-1, 0], [0, 1], [0, -1], [1, 0]
    ].map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
     .filter(cell =>
       codingInBounds(cell.row, cell.col) &&
       !visited.has(cellKey(cell.row, cell.col)) &&
       // Do not touch the top row until we enter the goal.
       (cell.row !== 0 || (cell.row === goal.row && cell.col === goal.col))
     );

    // Prefer sideways moves often enough to create bends.
    candidates.sort(() => Math.random() - .5);
    candidates.sort((a, b) => {
      const aSide = a.row === row ? -0.25 : 0;
      const bSide = b.row === row ? -0.25 : 0;
      return (Math.random() + aSide) - (Math.random() + bSide);
    });

    for (const next of candidates) {
      visited.add(cellKey(next.row, next.col));
      path.push(next);

      if (dfs(next.row, next.col)) return true;

      path.pop();
      visited.delete(cellKey(next.row, next.col));
    }

    return false;
  }

  return dfs(start.row, start.col) ? path : null;
}

function buildMazeCandidate(level) {
  const info = codingLevelInfo[level];

  const start = {
    row: CODING_ROWS - 1,
    col: randomInt(0, CODING_COLS - 1)
  };

  let goalCol = randomInt(0, CODING_COLS - 1);
  if (CODING_COLS > 2) {
    while (Math.abs(goalCol - start.col) < 2) {
      goalCol = randomInt(0, CODING_COLS - 1);
    }
  }

  const goal = { row: 0, col: goalCol };

  const routeMinimum =
    level === "easy" ? 9 :
    level === "medium" ? 12 : 15;

  const route = makeWindingRoute(start, goal, routeMinimum);
  if (!route) return null;

  const routeSet = new Set(route.map(cell => cellKey(cell.row, cell.col)));
  const obstacles = new Set();

  for (let row = 0; row < CODING_ROWS; row++) {
    for (let col = 0; col < CODING_COLS; col++) {
      const key = cellKey(row, col);
      if (!routeSet.has(key)) obstacles.add(key);
    }
  }

  // Open a few extra spaces. Easy has more freedom; Hard is closer to a corridor maze.
  const obstacleArray = [...obstacles].sort(() => Math.random() - .5);
  let opened = 0;

  for (const key of obstacleArray) {
    if (opened >= info.extraOpenCells) break;

    const [row, col] = key.split(",").map(Number);
    if (row === 0 || row === CODING_ROWS - 1) continue;

    obstacles.delete(key);
    opened += 1;
  }

  const puzzle = { start, goal, obstacles };
  const solution = codingShortestProgram(puzzle);
  if (!solution) return null;

  const turns = countProgramTurns(solution);

  if (
    solution.length < info.minCommands ||
    solution.length > info.maxCommands ||
    turns < info.minTurns
  ) {
    return null;
  }

  puzzle.solution = solution;
  return puzzle;
}

function buildCodingPuzzle() {
  codingRunToken += 1;
  codingRunning = false;
  codingProgram = [];
  codingWinOverlay.classList.add("hidden");

  let puzzle = null;

  for (let attempt = 0; attempt < 500; attempt++) {
    puzzle = buildMazeCandidate(codingLevel);
    if (puzzle) break;
  }

  // Guaranteed fallback.
  if (!puzzle) {
    const start = { row: 6, col: 1 };
    const goal = { row: 0, col: 4 };
    const open = new Set([
      "6,1","5,1","4,1","4,2","4,3","3,3","2,3","2,4","1,4","0,4",
      "5,0","3,2","1,3"
    ]);
    const obstacles = new Set();

    for (let row = 0; row < CODING_ROWS; row++) {
      for (let col = 0; col < CODING_COLS; col++) {
        const key = cellKey(row, col);
        if (!open.has(key)) obstacles.add(key);
      }
    }

    puzzle = { start, goal, obstacles };
    puzzle.solution = codingShortestProgram(puzzle);
  }

  codingPuzzle = puzzle;
  resetCodingRover(false);

  codingStatus.classList.remove("good", "bad", "resetting");
  codingStatus.textContent = `Can you reach the flag? Best route: ${puzzle.solution.length} commands.`;

  renderCodingBoard();
  renderCodingProgram();
  setCodingControlsEnabled(true);
}

function addGuideMarker(cell, item) {
  const marker = document.createElement("span");
  marker.className = "guide-marker-simple";

  if (item.visited) {
    const dot = document.createElement("span");
    dot.className = "guide-simple-dot";
    marker.appendChild(dot);
  }

  const arrow = document.createElement("span");
  const guideDir = ((item.finalDir % 4) + 4) % 4;
  const guideDirClass = ["dir-0", "dir-2", "dir-4", "dir-6"][guideDir];
  arrow.className = `guide-simple-arrow ${guideDirClass}`;
  arrow.textContent = item.collision ? "×" : "➤";
  if (item.collision) arrow.classList.add("collision");
  marker.appendChild(arrow);

  cell.appendChild(marker);
}

function simulateCodingGuide() {
  const cells = new Map();

  let state = {
    row: codingPuzzle.start.row,
    col: codingPuzzle.start.col,
    dir: 0
  };

  function ensureCell(row, col) {
    const key = `${row},${col}`;
    if (!cells.has(key)) {
      cells.set(key, {
        row,
        col,
        visited: false,
        collision: false,
        finalDir: state.dir
      });
    }
    return cells.get(key);
  }

  // Mark the starting square so the first facing direction is visible.
  const startCell = ensureCell(state.row, state.col);
  startCell.visited = true;
  startCell.finalDir = state.dir;

  for (const command of codingProgram) {
    const next = nextCodingState(state, command);

    if (command === "left" || command === "right") {
      state = { row: next.row, col: next.col, dir: next.dir };
      const cell = ensureCell(state.row, state.col);
      cell.finalDir = state.dir;
      continue;
    }

    if (next.collision) {
      const cell = ensureCell(state.row, state.col);
      cell.collision = true;
      cell.finalDir = state.dir;
      break;
    }

    state = { row: next.row, col: next.col, dir: next.dir };
    const cell = ensureCell(state.row, state.col);
    cell.visited = true;
    cell.finalDir = state.dir;
  }

  return [...cells.values()];
}

function renderCodingBoard() {
  codingBoard.innerHTML = "";
  const guide = codingGuideOn && !codingRunning ? simulateCodingGuide() : [];

  for (let row = 0; row < CODING_ROWS; row++) {
    for (let col = 0; col < CODING_COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";

      if (codingPuzzle.obstacles.has(cellKey(row, col))) {
        cell.classList.add("obstacle");
      }

      const isStart = row === codingPuzzle.start.row && col === codingPuzzle.start.col;
      const isGoal = row === codingPuzzle.goal.row && col === codingPuzzle.goal.col;

      if (isStart) {
        cell.classList.add("start-cell");
        const label = document.createElement("span");
        label.className = "cell-label";
        label.textContent = "START";
        cell.appendChild(label);
      }

      if (isGoal) {
        cell.classList.add("goal-cell");
        const flag = document.createElement("span");
        flag.className = "goal-flag";
        flag.textContent = "🏁";
        cell.appendChild(flag);
      }

      const guideItem = guide.find(item => item.row === row && item.col === col);

      if (guideItem) {
        addGuideMarker(cell, guideItem);
      }

      if (row === codingPuzzle.state.row && col === codingPuzzle.state.col) {
        const rover = document.createElement("span");
        rover.className = `rover dir-${codingPuzzle.state.dir}`;
        rover.id = "coding-rover";
        cell.appendChild(rover);
      }

      codingBoard.appendChild(cell);
    }
  }
}

function renderCodingProgram(activeIndex = -1, doneThrough = -1) {
  programCount.textContent = codingProgram.length;
  programTimeline.innerHTML = "";

  if (!codingProgram.length) {
    const empty = document.createElement("span");
    empty.className = "program-empty";
    empty.textContent = "Tap a command below";
    programTimeline.appendChild(empty);
    return;
  }

  codingProgram.forEach((command, index) => {
    const step = document.createElement("span");
    step.className = "program-step";
    step.textContent = commandGlyphs[command];
    step.title = command;

    if (index === activeIndex) step.classList.add("running");
    else if (index <= doneThrough) step.classList.add("done");

    programTimeline.appendChild(step);
  });

  if (activeIndex >= 0 && programTimeline.children[activeIndex]) {
    programTimeline.children[activeIndex].scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });
  }
}

function addCodingCommand(command) {
  if (codingRunning || codingProgram.length >= 32) return;

  codingProgram.push(command);
  codingWinOverlay.classList.add("hidden");
  codingStatus.classList.remove("good", "bad", "resetting");
  codingStatus.textContent = codingProgram.length >= 32
    ? "Program full — press Run or remove a step."
    : "Build your program, then press Run.";

  renderCodingProgram();
  renderCodingBoard();
  programTimeline.scrollLeft = programTimeline.scrollWidth;
}

function setCodingControlsEnabled(enabled) {
  commandButtons.forEach(button => button.disabled = !enabled);
  codingUndo.disabled = !enabled;
  codingClear.disabled = !enabled;
  codingRun.disabled = !enabled;
  newCodingPuzzle.disabled = !enabled;
  codingLevelButtons.forEach(button => button.disabled = !enabled);
  codingGuideToggle.disabled = !enabled;
}

function resetCodingRover(render = true) {
  codingPuzzle.state = {
    row: codingPuzzle.start.row,
    col: codingPuzzle.start.col,
    dir: 0
  };

  if (render) renderCodingBoard();
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function returnRoverToStart(token) {
  codingStatus.classList.add("resetting");
  await wait(520);

  if (token !== codingRunToken) return;

  resetCodingRover();
  renderCodingProgram();
  codingStatus.classList.remove("resetting");
  codingRunning = false;
  setCodingControlsEnabled(true);
}

async function runCodingProgram() {
  if (codingRunning || !codingProgram.length) {
    if (!codingProgram.length) {
      codingStatus.classList.remove("good");
      codingStatus.classList.add("bad");
      codingStatus.textContent = "Add some commands first.";
    }
    return;
  }

  codingRunning = true;
  const token = ++codingRunToken;
  codingWinOverlay.classList.add("hidden");
  setCodingControlsEnabled(false);
  resetCodingRover();
  renderCodingBoard();

  let completedIndex = -1;

  for (let i = 0; i < codingProgram.length; i++) {
    if (token !== codingRunToken) return;

    renderCodingProgram(i, completedIndex);
    const next = nextCodingState(codingPuzzle.state, codingProgram[i]);

    if (next.collision) {
      codingStatus.classList.remove("good");
      codingStatus.classList.add("bad");
      codingStatus.textContent = "Bonk! The rover hit something.";

      const rover = $("#coding-rover");
      if (rover) rover.classList.add("bump");

      await returnRoverToStart(token);
      return;
    }

    codingPuzzle.state = {
      row: next.row,
      col: next.col,
      dir: next.dir
    };

    renderCodingBoard();
    completedIndex = i;
    await wait(360);

    if (
      codingPuzzle.state.row === codingPuzzle.goal.row &&
      codingPuzzle.state.col === codingPuzzle.goal.col
    ) {
      finishCodingSuccess(i + 1);
      return;
    }
  }

  renderCodingProgram(-1, completedIndex);
  codingStatus.classList.remove("good");
  codingStatus.classList.add("bad");
  codingStatus.textContent = "Not there yet — try changing your program.";
  await returnRoverToStart(token);
}

function finishCodingSuccess(usedCommands) {
  codingRunning = false;
  renderCodingProgram(-1, usedCommands - 1);
  renderCodingBoard();

  codingStatus.classList.remove("bad", "resetting");
  codingStatus.classList.add("good");
  codingStatus.textContent = "You reached the flag!";

  const optimal = codingPuzzle.solution.length;
  const extra = usedCommands - optimal;
  const stars = extra <= 1 ? 3 : extra <= 4 ? 2 : 1;

  codingWinStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  codingWinText.textContent =
    usedCommands === optimal
      ? `Perfect route — ${usedCommands} commands.`
      : `${usedCommands} commands. Best possible is ${optimal}.`;

  codingWinOverlay.classList.remove("hidden");
  setCodingControlsEnabled(true);
}

commandButtons.forEach(button => {
  button.addEventListener("click", () => addCodingCommand(button.dataset.command));
});

codingUndo.addEventListener("click", () => {
  if (codingRunning || !codingProgram.length) return;
  codingProgram.pop();
  codingWinOverlay.classList.add("hidden");
  renderCodingProgram();
  renderCodingBoard();
});

codingClear.addEventListener("click", () => {
  if (codingRunning) return;

  codingProgram = [];
  codingWinOverlay.classList.add("hidden");
  resetCodingRover(false);

  codingStatus.classList.remove("good", "bad", "resetting");
  codingStatus.textContent = "Build your program, then press Run.";

  renderCodingProgram();
  renderCodingBoard();
});

codingRun.addEventListener("click", runCodingProgram);
newCodingPuzzle.addEventListener("click", buildCodingPuzzle);

codingGuideToggle.addEventListener("change", () => {
  codingGuideOn = codingGuideToggle.checked;
  localStorage.setItem("codingGuideOn", codingGuideOn ? "true" : "false");
  renderCodingBoard();
});

codingLevelButtons.forEach(button => {
  button.addEventListener("click", () => {
    if (codingRunning) return;

    codingLevel = button.dataset.codingLevel;
    localStorage.setItem("codingLevel", codingLevel);

    codingLevelButtons.forEach(b => {
      b.classList.toggle("active", b.dataset.codingLevel === codingLevel);
    });

    buildCodingPuzzle();
  });
});

codingLevelButtons.forEach(button => {
  button.classList.toggle("active", button.dataset.codingLevel === codingLevel);
});

buildCodingPuzzle();
