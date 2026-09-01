// Colour Blocks — reverse contiguous runs of coloured tiles until each quadrant is solid.

const colourBoardEl = $("#colour-blocks-board");
const colourMovesEl = $("#colour-moves");
const colourParEl = $("#colour-par");
const colourSolidEl = $("#colour-solid");
const colourStatusEl = $("#colour-blocks-status");
const colourDifficultyButtons = $$('[data-colour-difficulty]');
const colourUndoButton = $("#colour-undo");
const colourResetButton = $("#colour-reset");
const colourNewButton = $("#colour-new");

const colourDifficultyConfig = {
  easy:   { size: 4, scrambleMoves: 6, minMixedBlocks: 3 },
  medium: { size: 6, scrambleMoves: 12, minMixedBlocks: 4 },
  hard:   { size: 8, scrambleMoves: 20, minMixedBlocks: 4 }
};

const colourPalette = [
  { name: "coral",  value: "#c97969" },
  { name: "blue",   value: "#7596b7" },
  { name: "gold",   value: "#d4ad5f" },
  { name: "green",  value: "#779b78" }
];

let colourDifficulty = "easy";
let colourSize = 4;
let colourPar = 6;
let colourBoard = [];
let colourInitialBoard = [];
let colourMoves = 0;
let colourHistory = [];
let colourSolved = false;
let colourDrag = null;

function colourShuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function colourCloneBoard(board) {
  return board.map(row => [...row]);
}

function colourBuildSolved(size) {
  const half = size / 2;
  const quadrantColours = colourShuffle([0, 1, 2, 3]);
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const quadrant = (row >= half ? 2 : 0) + (col >= half ? 1 : 0);
      return quadrantColours[quadrant];
    })
  );
}

function colourReverse(board, move) {
  const { axis, fixed, start, end } = move;
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  const values = [];
  for (let n = low; n <= high; n++) {
    values.push(axis === "row" ? board[fixed][n] : board[n][fixed]);
  }
  values.reverse();
  for (let n = low; n <= high; n++) {
    if (axis === "row") board[fixed][n] = values[n - low];
    else board[n][fixed] = values[n - low];
  }
}

function colourMoveChanges(board, move) {
  const before = colourCloneBoard(board);
  colourReverse(before, move);
  for (let row = 0; row < before.length; row++) {
    for (let col = 0; col < before.length; col++) {
      if (before[row][col] !== board[row][col]) return true;
    }
  }
  return false;
}

function colourSolidBlocks(board = colourBoard) {
  const size = board.length;
  const half = size / 2;
  let solid = 0;
  for (let blockRow = 0; blockRow < 2; blockRow++) {
    for (let blockCol = 0; blockCol < 2; blockCol++) {
      const first = board[blockRow * half][blockCol * half];
      let same = true;
      for (let row = blockRow * half; row < (blockRow + 1) * half && same; row++) {
        for (let col = blockCol * half; col < (blockCol + 1) * half; col++) {
          if (board[row][col] !== first) { same = false; break; }
        }
      }
      if (same) solid++;
    }
  }
  return solid;
}

function colourIsSolved(board = colourBoard) {
  return colourSolidBlocks(board) === 4;
}

function colourMakeScrambledBoard() {
  const config = colourDifficultyConfig[colourDifficulty];
  let best = null;

  for (let attempt = 0; attempt < 120; attempt++) {
    const board = colourBuildSolved(config.size);
    const moves = [];
    let lastKey = "";

    for (let i = 0; i < config.scrambleMoves; i++) {
      let chosen = null;
      for (let pick = 0; pick < 80 && !chosen; pick++) {
        const axis = Math.random() < 0.5 ? "row" : "col";
        const fixed = Math.floor(Math.random() * config.size);
        const a = Math.floor(Math.random() * config.size);
        let b = Math.floor(Math.random() * config.size);
        if (b === a) b = (b + 1 + Math.floor(Math.random() * (config.size - 1))) % config.size;
        const move = { axis, fixed, start: Math.min(a, b), end: Math.max(a, b) };
        const key = `${axis}:${fixed}:${move.start}:${move.end}`;
        if (key === lastKey || !colourMoveChanges(board, move)) continue;
        chosen = move;
        lastKey = key;
      }
      if (!chosen) break;
      colourReverse(board, chosen);
      moves.push(chosen);
    }

    const mixed = 4 - colourSolidBlocks(board);
    const candidate = { board, moves, mixed };
    if (!best || mixed > best.mixed) best = candidate;
    if (moves.length === config.scrambleMoves && !colourIsSolved(board) && mixed >= config.minMixedBlocks) return candidate;
  }

  return best;
}

function colourCellIndexFromPoint(clientX, clientY) {
  const rect = colourBoardEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = Math.max(0, Math.min(rect.width - 0.01, clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height - 0.01, clientY - rect.top));
  return {
    row: Math.max(0, Math.min(colourSize - 1, Math.floor((y / rect.height) * colourSize))),
    col: Math.max(0, Math.min(colourSize - 1, Math.floor((x / rect.width) * colourSize)))
  };
}

function colourSelectionCells(drag = colourDrag) {
  if (!drag || !drag.axis) return [];
  const cells = [];
  if (drag.axis === "row") {
    const low = Math.min(drag.start.col, drag.end.col);
    const high = Math.max(drag.start.col, drag.end.col);
    for (let col = low; col <= high; col++) cells.push(`${drag.start.row},${col}`);
  } else {
    const low = Math.min(drag.start.row, drag.end.row);
    const high = Math.max(drag.start.row, drag.end.row);
    for (let row = low; row <= high; row++) cells.push(`${row},${drag.start.col}`);
  }
  return cells;
}

function colourRender() {
  const selected = new Set(colourSelectionCells());
  colourBoardEl.style.setProperty("--colour-grid-size", colourSize);
  colourBoardEl.innerHTML = "";

  for (let row = 0; row < colourSize; row++) {
    for (let col = 0; col < colourSize; col++) {
      const colourIndex = colourBoard[row][col];
      const tile = document.createElement("div");
      tile.className = "colour-blocks-tile" + (selected.has(`${row},${col}`) ? " selected" : "");
      tile.dataset.row = row;
      tile.dataset.col = col;
      tile.dataset.colour = colourPalette[colourIndex].name;
      tile.style.setProperty("--tile-colour", colourPalette[colourIndex].value);
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", `${colourPalette[colourIndex].name} tile`);
      colourBoardEl.appendChild(tile);
    }
  }

  const solid = colourSolidBlocks();
  colourMovesEl.textContent = colourMoves;
  colourParEl.textContent = colourPar;
  colourSolidEl.textContent = `${solid} / 4`;
  colourUndoButton.disabled = colourHistory.length === 0 || colourSolved;
  colourResetButton.disabled = colourMoves === 0 || colourSolved;
}

function colourStarsForMoves(moves) {
  if (moves <= colourPar) return 5;
  if (moves <= Math.ceil(colourPar * 1.25)) return 4;
  if (moves <= Math.ceil(colourPar * 1.6)) return 3;
  if (moves <= Math.ceil(colourPar * 2.2)) return 2;
  return 1;
}

function colourFinishPuzzle() {
  if (colourSolved) return;
  colourSolved = true;
  colourRender();
  const stars = colourStarsForMoves(colourMoves);
  colourStatusEl.textContent = `Solved in ${colourMoves} move${colourMoves === 1 ? "" : "s"}!`;
  colourStatusEl.classList.add("good");

  window.GameHubResults?.show({
    gameId: "game-12",
    difficulty: colourDifficulty,
    stars,
    score: null,
    title: stars === 5 ? "Perfectly sorted!" : "Puzzle complete!",
    summary: stars === 5
      ? `You solved it in ${colourMoves} moves — at or under par.`
      : `All four colour blocks are solid.`,
    metrics: [
      { label: "Moves", value: colourMoves },
      { label: "Par", value: colourPar },
      { label: "Board", value: `${colourSize}×${colourSize}` }
    ],
    againLabel: "New puzzle",
    onAgain: colourNewPuzzle
  });
}

function colourCommitMove(move) {
  if (colourSolved || !move || move.start === move.end) return;
  colourHistory.push(colourCloneBoard(colourBoard));
  colourReverse(colourBoard, move);
  colourMoves++;
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = "Keep going — make each large block one solid colour.";
  colourRender();
  if (colourIsSolved()) colourFinishPuzzle();
}

function colourNewPuzzle() {
  const config = colourDifficultyConfig[colourDifficulty];
  colourSize = config.size;
  const generated = colourMakeScrambledBoard();
  colourBoard = colourCloneBoard(generated.board);
  colourInitialBoard = colourCloneBoard(generated.board);
  colourPar = generated.moves.length || config.scrambleMoves;
  colourMoves = 0;
  colourHistory = [];
  colourSolved = false;
  colourDrag = null;
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = "Swipe across a row or column to reverse those tiles.";
  colourRender();
}

function colourResetPuzzle() {
  colourBoard = colourCloneBoard(colourInitialBoard);
  colourMoves = 0;
  colourHistory = [];
  colourSolved = false;
  colourDrag = null;
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = "Puzzle reset.";
  colourRender();
}

function colourUndo() {
  if (!colourHistory.length || colourSolved) return;
  colourBoard = colourHistory.pop();
  colourMoves = Math.max(0, colourMoves - 1);
  colourDrag = null;
  colourStatusEl.textContent = "Last move undone.";
  colourRender();
}

colourBoardEl.addEventListener("pointerdown", event => {
  if (colourSolved || (event.pointerType === "mouse" && event.button !== 0)) return;
  const start = colourCellIndexFromPoint(event.clientX, event.clientY);
  if (!start) return;
  event.preventDefault();
  colourBoardEl.setPointerCapture?.(event.pointerId);
  colourDrag = {
    pointerId: event.pointerId,
    start,
    end: { ...start },
    axis: null,
    startX: event.clientX,
    startY: event.clientY
  };
  colourRender();
});

colourBoardEl.addEventListener("pointermove", event => {
  if (!colourDrag || colourDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  const current = colourCellIndexFromPoint(event.clientX, event.clientY);
  if (!current) return;
  const dx = event.clientX - colourDrag.startX;
  const dy = event.clientY - colourDrag.startY;

  if (!colourDrag.axis) {
    const rect = colourBoardEl.getBoundingClientRect();
    const threshold = Math.max(5, rect.width / colourSize * 0.22);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    colourDrag.axis = Math.abs(dx) >= Math.abs(dy) ? "row" : "col";
  }

  if (colourDrag.axis === "row") {
    colourDrag.end = { row: colourDrag.start.row, col: current.col };
  } else {
    colourDrag.end = { row: current.row, col: colourDrag.start.col };
  }
  colourRender();
});

function colourEndDrag(event) {
  if (!colourDrag || colourDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  const drag = colourDrag;
  colourDrag = null;
  try { colourBoardEl.releasePointerCapture?.(event.pointerId); } catch (_) {}

  if (!drag.axis) {
    colourRender();
    return;
  }

  const move = drag.axis === "row"
    ? { axis: "row", fixed: drag.start.row, start: drag.start.col, end: drag.end.col }
    : { axis: "col", fixed: drag.start.col, start: drag.start.row, end: drag.end.row };

  if (move.start === move.end) {
    colourRender();
    return;
  }
  colourCommitMove(move);
}

colourBoardEl.addEventListener("pointerup", colourEndDrag);
colourBoardEl.addEventListener("pointercancel", event => {
  if (!colourDrag || colourDrag.pointerId !== event.pointerId) return;
  colourDrag = null;
  colourRender();
});

colourDifficultyButtons.forEach(button => {
  button.addEventListener("click", () => {
    colourDifficulty = button.dataset.colourDifficulty;
    colourDifficultyButtons.forEach(other => other.classList.toggle("active", other === button));
    colourNewPuzzle();
  });
});

colourUndoButton.addEventListener("click", colourUndo);
colourResetButton.addEventListener("click", colourResetPuzzle);
colourNewButton.addEventListener("click", colourNewPuzzle);

colourNewPuzzle();
