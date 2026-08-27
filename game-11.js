// Maze Snake — a classic Snake-style navigation game inside a braided maze.
// The existing optical Maze (game-08) is intentionally left untouched.

const snakeMazeBoard = $("#snake-maze-board");
const snakeMazeStatus = $("#snake-maze-status");
const snakeScoreEl = $("#snake-score");
const snakeGemsEl = $("#snake-gems");
const snakeLengthEl = $("#snake-length");
const snakeResult = $("#snake-maze-result");
const snakeResultStars = $("#snake-result-stars");
const snakeResultTitle = $("#snake-result-title");
const snakeResultText = $("#snake-result-text");
const snakeDifficultyButtons = $$('[data-snake-difficulty]');
const snakeDirectionButtons = $$('[data-snake-dir]');
const snakeNewMazeButton = $("#snake-new-maze");
const snakeRestartButton = $("#snake-restart");

const snakeDifficultyConfig = {
  easy:   { size: 13, braid: 6,  gems: 3, tick: 520, grow: 2, minRoute: 24, alternateChecks: 1 },
  medium: { size: 15, braid: 8,  gems: 5, tick: 440, grow: 2, minRoute: 28, alternateChecks: 1 },
  hard:   { size: 19, braid: 14, gems: 7, tick: 360, grow: 2, minRoute: 40, alternateChecks: 2 }
};

const snakeDirVectors = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1]
];

let snakeDifficulty = "easy";
let snakeLevel = null;
let snake = [];
let snakeCollectibles = new Set();
let snakeCollected = 0;
let snakeScore = 0;
let snakeGrowthPending = 0;
let snakeMoves = 0;
let snakeCurrentDir = null;
let snakePendingDir = null;
let snakeTimer = null;
let snakeRunning = false;
let snakeCrashed = false;
let snakeWon = false;
let snakeCells = new Map();
let snakeLastBodyKeys = new Set();

function snakeKey(row, col) { return `${row},${col}`; }
function snakePoint(key) {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}
function snakeShuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function snakeInBounds(row, col, size) {
  return row >= 0 && row < size && col >= 0 && col < size;
}
function snakeOpenNeighbours(point, blocks, size) {
  const result = [];
  snakeDirVectors.forEach(([dr, dc], dir) => {
    const row = point.row + dr;
    const col = point.col + dc;
    if (snakeInBounds(row, col, size) && !blocks.has(snakeKey(row, col))) result.push({ row, col, dir });
  });
  return result;
}
function snakeEdgeName(point, size) {
  const distances = [point.row, size - 1 - point.col, size - 1 - point.row, point.col];
  const min = Math.min(...distances);
  return distances.indexOf(min);
}
function snakeNearEdge(point, size) {
  return Math.min(point.row, point.col, size - 1 - point.row, size - 1 - point.col) <= 2;
}

function carveSnakeMaze(size, braidOpenings) {
  const blocks = new Set();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) blocks.add(snakeKey(row, col));
  }

  const odd = [];
  for (let n = 1; n <= size - 2; n += 2) odd.push(n);
  const start = {
    row: odd[Math.floor(Math.random() * odd.length)],
    col: odd[Math.floor(Math.random() * odd.length)]
  };
  const visited = new Set([snakeKey(start.row, start.col)]);
  const stack = [start];
  blocks.delete(snakeKey(start.row, start.col));

  while (stack.length) {
    const current = stack[stack.length - 1];
    const candidates = [];
    for (const [dr, dc] of snakeDirVectors) {
      const row = current.row + dr * 2;
      const col = current.col + dc * 2;
      if (row < 1 || row > size - 2 || col < 1 || col > size - 2) continue;
      if (visited.has(snakeKey(row, col))) continue;
      candidates.push({ row, col, wallRow: current.row + dr, wallCol: current.col + dc });
    }
    if (!candidates.length) {
      stack.pop();
      continue;
    }
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    blocks.delete(snakeKey(next.wallRow, next.wallCol));
    blocks.delete(snakeKey(next.row, next.col));
    visited.add(snakeKey(next.row, next.col));
    stack.push({ row: next.row, col: next.col });
  }

  // Open selected separator walls to braid loops into the perfect maze.
  const braid = [];
  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      const key = snakeKey(row, col);
      if (!blocks.has(key)) continue;
      if (row % 2 === 1 && col % 2 === 0) {
        if (!blocks.has(snakeKey(row, col - 1)) && !blocks.has(snakeKey(row, col + 1))) braid.push({ row, col });
      } else if (row % 2 === 0 && col % 2 === 1) {
        if (!blocks.has(snakeKey(row - 1, col)) && !blocks.has(snakeKey(row + 1, col))) braid.push({ row, col });
      }
    }
  }
  snakeShuffle(braid).slice(0, braidOpenings).forEach(point => blocks.delete(snakeKey(point.row, point.col)));
  return blocks;
}

function snakeShortestPath(start, end, blocks, size, extraBlockedKey = null) {
  const startKey = snakeKey(start.row, start.col);
  const endKey = snakeKey(end.row, end.col);
  if (startKey === extraBlockedKey || endKey === extraBlockedKey) return null;
  const queue = [start];
  const parent = new Map();
  const seen = new Set([startKey]);
  let index = 0;

  while (index < queue.length) {
    const current = queue[index++];
    const currentKey = snakeKey(current.row, current.col);
    if (currentKey === endKey) {
      const path = [];
      let key = currentKey;
      while (key) {
        path.push(snakePoint(key));
        key = parent.get(key) || null;
      }
      return path.reverse();
    }
    for (const neighbour of snakeOpenNeighbours(current, blocks, size)) {
      const key = snakeKey(neighbour.row, neighbour.col);
      if (key === extraBlockedKey || seen.has(key)) continue;
      seen.add(key);
      parent.set(key, currentKey);
      queue.push(neighbour);
    }
  }
  return null;
}

function snakeDistancesFrom(start, blocks, size) {
  const distances = new Map([[snakeKey(start.row, start.col), 0]]);
  const queue = [start];
  let index = 0;
  while (index < queue.length) {
    const current = queue[index++];
    const distance = distances.get(snakeKey(current.row, current.col));
    for (const neighbour of snakeOpenNeighbours(current, blocks, size)) {
      const key = snakeKey(neighbour.row, neighbour.col);
      if (distances.has(key)) continue;
      distances.set(key, distance + 1);
      queue.push(neighbour);
    }
  }
  return distances;
}

function snakeAlternativeRouteCount(path, blocks, size) {
  if (!path || path.length < 8) return 0;
  const candidates = [];
  for (let i = 3; i < path.length - 3; i += Math.max(1, Math.floor(path.length / 12))) candidates.push(i);
  let count = 0;
  for (const index of candidates) {
    const blockedKey = snakeKey(path[index].row, path[index].col);
    if (snakeShortestPath(path[0], path[path.length - 1], blocks, size, blockedKey)) count++;
  }
  return count;
}

function chooseSnakeCollectibles(blocks, size, start, exit, mainPath, count) {
  const pathKeys = new Set(mainPath.map(p => snakeKey(p.row, p.col)));
  const allOpen = [];
  const sideDeadEnds = [];
  const sideOpen = [];

  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      const key = snakeKey(row, col);
      if (blocks.has(key) || key === snakeKey(start.row, start.col) || key === snakeKey(exit.row, exit.col)) continue;
      const point = { row, col };
      const startDistance = Math.abs(row - start.row) + Math.abs(col - start.col);
      const exitDistance = Math.abs(row - exit.row) + Math.abs(col - exit.col);
      if (startDistance < 4 || exitDistance < 3) continue;
      allOpen.push(point);
      if (!pathKeys.has(key)) {
        sideOpen.push(point);
        if (snakeOpenNeighbours(point, blocks, size).length === 1) sideDeadEnds.push(point);
      }
    }
  }

  const chosen = [];
  const pools = [snakeShuffle(sideDeadEnds), snakeShuffle(sideOpen), snakeShuffle(allOpen)];
  for (const pool of pools) {
    for (const point of pool) {
      if (chosen.length >= count) break;
      if (chosen.some(other => Math.abs(other.row - point.row) + Math.abs(other.col - point.col) < 4)) continue;
      if (chosen.some(other => other.row === point.row && other.col === point.col)) continue;
      chosen.push(point);
    }
    if (chosen.length >= count) break;
  }
  return chosen.slice(0, count);
}

function tryGenerateSnakeMaze() {
  const D = snakeDifficultyConfig[snakeDifficulty];
  const size = D.size;
  const blocks = carveSnakeMaze(size, D.braid);
  const open = [];
  const deadEnds = [];

  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      if (blocks.has(snakeKey(row, col))) continue;
      const point = { row, col };
      open.push(point);
      if (snakeNearEdge(point, size) && snakeOpenNeighbours(point, blocks, size).length === 1) deadEnds.push(point);
    }
  }

  const startPool = deadEnds.length ? deadEnds : open.filter(p => snakeNearEdge(p, size));
  if (!startPool.length) return null;
  const start = startPool[Math.floor(Math.random() * startPool.length)];
  const distances = snakeDistancesFrom(start, blocks, size);
  let exitCandidates = open
    .filter(p => snakeNearEdge(p, size) && snakeKey(p.row, p.col) !== snakeKey(start.row, start.col))
    .map(p => ({ ...p, distance: distances.get(snakeKey(p.row, p.col)) || 0 }))
    .filter(p => p.distance >= D.minRoute);

  const startEdge = snakeEdgeName(start, size);
  const differentEdge = exitCandidates.filter(p => snakeEdgeName(p, size) !== startEdge);
  if (differentEdge.length) exitCandidates = differentEdge;
  exitCandidates.sort((a, b) => b.distance - a.distance);
  exitCandidates = exitCandidates.slice(0, Math.max(4, Math.ceil(exitCandidates.length * .3)));
  if (!exitCandidates.length) return null;
  const exit = exitCandidates[Math.floor(Math.random() * exitCandidates.length)];
  const path = snakeShortestPath(start, exit, blocks, size);
  if (!path || path.length < D.minRoute) return null;
  if (snakeAlternativeRouteCount(path, blocks, size) < D.alternateChecks) return null;

  const collectibles = chooseSnakeCollectibles(blocks, size, start, exit, path, D.gems);
  if (collectibles.length < D.gems) return null;
  return { size, blocks, start, exit, collectibles, pathLength: path.length };
}

function generateSnakeMaze() {
  stopSnakeTimer();
  let generated = null;
  for (let attempt = 0; attempt < 550 && !generated; attempt++) generated = tryGenerateSnakeMaze();
  if (!generated) {
    // A second pass with a slightly relaxed route-choice requirement is better
    // than presenting an empty board on an unlucky random sequence.
    const D = snakeDifficultyConfig[snakeDifficulty];
    const original = D.alternateChecks;
    D.alternateChecks = Math.max(0, original - 1);
    for (let attempt = 0; attempt < 250 && !generated; attempt++) generated = tryGenerateSnakeMaze();
    D.alternateChecks = original;
  }
  if (!generated) {
    snakeMazeStatus.textContent = "Could not carve a maze. Tap New maze to try again.";
    return;
  }
  snakeLevel = generated;
  buildSnakeMazeBoard();
  resetSnakeRun();
}

function buildSnakeMazeBoard() {
  if (!snakeLevel) return;
  const { size, blocks, start, exit, collectibles } = snakeLevel;
  snakeMazeBoard.innerHTML = "";
  snakeMazeBoard.style.setProperty("--snake-maze-size", size);
  snakeCells = new Map();

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const key = snakeKey(row, col);
      const cell = document.createElement("div");
      cell.className = blocks.has(key) ? "snake-maze-cell wall" : "snake-maze-cell corridor";
      cell.dataset.key = key;
      if (row === start.row && col === start.col) {
        cell.classList.add("start");
        cell.innerHTML = '<span class="snake-maze-marker start-marker">S</span>';
      }
      if (row === exit.row && col === exit.col) {
        cell.classList.add("exit");
        cell.innerHTML = '<span class="snake-maze-marker exit-marker">E</span>';
      }
      if (collectibles.some(point => point.row === row && point.col === col)) {
        cell.innerHTML += '<span class="snake-maze-pickup" aria-hidden="true">◆</span>';
      }
      snakeMazeBoard.appendChild(cell);
      snakeCells.set(key, cell);
    }
  }
}

function resetSnakeRun() {
  if (!snakeLevel) return;
  stopSnakeTimer();
  snake = [{ ...snakeLevel.start }];
  snakeCollectibles = new Set(snakeLevel.collectibles.map(p => snakeKey(p.row, p.col)));
  snakeCollected = 0;
  snakeScore = 0;
  snakeGrowthPending = 0;
  snakeMoves = 0;
  snakeCurrentDir = null;
  snakePendingDir = null;
  snakeRunning = false;
  snakeCrashed = false;
  snakeWon = false;
  snakeResult.classList.add("hidden");
  snakeMazeStatus.classList.remove("good", "bad");
  snakeMazeStatus.textContent = "Choose a direction to leave START.";

  // Restore collectible graphics after a previous run.
  snakeLevel.collectibles.forEach(point => {
    const cell = snakeCells.get(snakeKey(point.row, point.col));
    if (cell && !cell.querySelector(".snake-maze-pickup")) cell.insertAdjacentHTML("beforeend", '<span class="snake-maze-pickup" aria-hidden="true">◆</span>');
  });
  renderSnakeDynamic();
}

function stopSnakeTimer() {
  if (snakeTimer) clearInterval(snakeTimer);
  snakeTimer = null;
  snakeRunning = false;
}

function startSnakeTimer() {
  if (snakeTimer || snakeWon || snakeCrashed) return;
  snakeRunning = true;
  const D = snakeDifficultyConfig[snakeDifficulty];
  snakeTimer = setInterval(stepSnake, D.tick);
}

function isSnakeReverse(nextDir, currentDir) {
  return currentDir !== null && (nextDir + 2) % 4 === currentDir;
}

function queueSnakeDirection(dir) {
  if (!snakeLevel || snakeWon || snakeCrashed) return;
  if (isSnakeReverse(dir, snakeCurrentDir)) {
    snakeMazeStatus.textContent = "You can't reverse straight into your tail.";
    return;
  }

  if (!snakeRunning && snakeCurrentDir === null) {
    const head = snake[0];
    const [dr, dc] = snakeDirVectors[dir];
    const firstKey = snakeKey(head.row + dr, head.col + dc);
    if (!snakeInBounds(head.row + dr, head.col + dc, snakeLevel.size) || snakeLevel.blocks.has(firstKey)) {
      snakeMazeStatus.textContent = "There's a wall that way — choose another direction.";
      return;
    }
  }

  snakePendingDir = dir;
  if (!snakeRunning) {
    snakeMazeStatus.textContent = "Reach EXIT — detour for gems if you dare.";
    stepSnake();
    if (!snakeWon && !snakeCrashed) startSnakeTimer();
  }
}

function stepSnake() {
  if (!snakeLevel || snakeWon || snakeCrashed) return;
  const head = snake[0];

  // Forgiving turn buffering: a direction pressed just before a junction stays
  // queued until that turn is physically open. This keeps the game about route
  // planning rather than exact touchscreen timing.
  if (snakePendingDir !== null && !isSnakeReverse(snakePendingDir, snakeCurrentDir)) {
    const [pdr, pdc] = snakeDirVectors[snakePendingDir];
    const prow = head.row + pdr;
    const pcol = head.col + pdc;
    const pendingOpen = snakeInBounds(prow, pcol, snakeLevel.size) && !snakeLevel.blocks.has(snakeKey(prow, pcol));
    if (pendingOpen) {
      snakeCurrentDir = snakePendingDir;
      snakePendingDir = null;
    }
  }
  if (snakeCurrentDir === null) return;

  const [dr, dc] = snakeDirVectors[snakeCurrentDir];
  const next = { row: head.row + dr, col: head.col + dc };
  const nextKey = snakeKey(next.row, next.col);

  if (!snakeInBounds(next.row, next.col, snakeLevel.size) || snakeLevel.blocks.has(nextKey)) {
    crashSnake("You hit the maze wall.");
    return;
  }

  const bodyToCheck = snakeGrowthPending > 0 ? snake : snake.slice(0, -1);
  if (bodyToCheck.some(segment => segment.row === next.row && segment.col === next.col)) {
    crashSnake("You ran into your own tail.");
    return;
  }

  snake.unshift(next);
  snakeMoves++;

  if (snakeCollectibles.has(nextKey)) {
    snakeCollectibles.delete(nextKey);
    snakeCollected++;
    snakeScore += 250;
    snakeGrowthPending += snakeDifficultyConfig[snakeDifficulty].grow;
    snakeCells.get(nextKey)?.querySelector(".snake-maze-pickup")?.remove();
    snakeMazeStatus.textContent = `Gem collected — the snake grew! ${snakeLevel.collectibles.length - snakeCollected} left.`;
  }

  if (snakeGrowthPending > 0) snakeGrowthPending--;
  else snake.pop();

  renderSnakeDynamic();

  if (next.row === snakeLevel.exit.row && next.col === snakeLevel.exit.col) winSnake();
}

function crashSnake(message) {
  stopSnakeTimer();
  snakeCrashed = true;
  snakeMazeStatus.classList.remove("good");
  snakeMazeStatus.classList.add("bad");
  snakeMazeStatus.textContent = `${message} Tap Restart to try the same maze.`;
  snakeResultStars.textContent = "";
  snakeResultTitle.textContent = "Run ended";
  snakeResultText.textContent = `${snakeCollected} of ${snakeLevel.collectibles.length} gems collected.`;
  snakeResult.classList.remove("hidden");
}

function snakeStarScore() {
  if (!snakeLevel?.collectibles.length) return 1;
  return Math.max(1, Math.min(5, 1 + Math.round(4 * snakeCollected / snakeLevel.collectibles.length)));
}

function recordSnakeProgress(stars, score) {
  try {
    const progress = JSON.parse(localStorage.getItem("gameHubProgress") || "{}");
    const game = progress["game-11"] || { bestStars: 0, bestScore: 0, difficulties: {} };
    const old = game.difficulties[snakeDifficulty] || {};
    game.bestStars = Math.max(game.bestStars || 0, stars);
    game.bestScore = Math.max(game.bestScore || 0, score);
    game.difficulties[snakeDifficulty] = {
      bestStars: Math.max(old.bestStars || 0, stars),
      bestScore: Math.max(old.bestScore || 0, score),
      bestGems: Math.max(old.bestGems || 0, snakeCollected)
    };
    progress["game-11"] = game;
    localStorage.setItem("gameHubProgress", JSON.stringify(progress));
  } catch {
    // Progress tracking should never interfere with the game.
  }
}

function winSnake() {
  stopSnakeTimer();
  snakeWon = true;
  const efficiencyBonus = Math.max(0, 300 - snakeMoves * 2);
  snakeScore += 500 + efficiencyBonus;
  const stars = snakeStarScore();
  snakeMazeStatus.classList.remove("bad");
  snakeMazeStatus.classList.add("good");
  snakeMazeStatus.textContent = "Maze complete!";
  snakeResultStars.textContent = "★".repeat(stars) + "☆".repeat(5 - stars);
  snakeResultTitle.textContent = "Maze complete!";
  snakeResultText.textContent = `${snakeCollected}/${snakeLevel.collectibles.length} gems · ${snakeScore} points · length ${snake.length}.`;
  snakeResult.classList.remove("hidden");
  recordSnakeProgress(stars, snakeScore);
  renderSnakeDynamic();
}

function renderSnakeDynamic() {
  snakeLastBodyKeys.forEach(key => {
    const cell = snakeCells.get(key);
    if (!cell) return;
    cell.classList.remove("snake-body", "snake-head", "dir-0", "dir-1", "dir-2", "dir-3");
    cell.querySelector(".snake-head-face")?.remove();
  });
  snakeLastBodyKeys = new Set();

  snake.forEach((segment, index) => {
    const key = snakeKey(segment.row, segment.col);
    snakeLastBodyKeys.add(key);
    const cell = snakeCells.get(key);
    if (!cell) return;
    cell.classList.add(index === 0 ? "snake-head" : "snake-body");
    if (index === 0) {
      const dir = snakeCurrentDir === null ? 1 : snakeCurrentDir;
      cell.classList.add(`dir-${dir}`);
      cell.insertAdjacentHTML("beforeend", '<span class="snake-head-face" aria-hidden="true"><i></i><i></i></span>');
    }
  });

  snakeScoreEl.textContent = String(snakeScore);
  snakeGemsEl.textContent = `${snakeCollected} / ${snakeLevel?.collectibles.length || 0}`;
  snakeLengthEl.textContent = String(snake.length + snakeGrowthPending);
}

snakeDirectionButtons.forEach(button => {
  bindFastPress(button, () => queueSnakeDirection(Number(button.dataset.snakeDir)));
});
snakeDifficultyButtons.forEach(button => {
  bindFastPress(button, () => {
    const difficulty = button.dataset.snakeDifficulty;
    if (difficulty === snakeDifficulty) return;
    snakeDifficulty = difficulty;
    snakeDifficultyButtons.forEach(b => b.classList.toggle("active", b.dataset.snakeDifficulty === difficulty));
    generateSnakeMaze();
  });
});
bindFastPress(snakeNewMazeButton, generateSnakeMaze);
bindFastPress(snakeRestartButton, resetSnakeRun);

document.addEventListener("keydown", event => {
  const dir = ({ ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 })[event.key];
  if (dir === undefined) return;
  event.preventDefault();
  queueSnakeDirection(dir);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && snakeRunning) {
    stopSnakeTimer();
    if (!snakeWon && !snakeCrashed) snakeMazeStatus.textContent = "Paused — tap a direction to continue.";
  }
});

generateSnakeMaze();
