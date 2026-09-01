// Colour Blocks — shift whole rows and columns with wraparound until each quadrant is solid.

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
  easy:   { size: 4, scrambleMoves: 7,  minMixedBlocks: 3 },
  medium: { size: 6, scrambleMoves: 13, minMixedBlocks: 4 },
  hard:   { size: 8, scrambleMoves: 21, minMixedBlocks: 4 }
};

const colourPalette = [
  { name: "coral", value: "#c97969" },
  { name: "blue",  value: "#7596b7" },
  { name: "gold",  value: "#d4ad5f" },
  { name: "green", value: "#779b78" }
];

let colourDifficulty = "easy";
let colourSize = 4;
let colourPar = 7;
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

// delta is +1 for right/down and -1 for left/up.
function colourShift(board, move) {
  const { axis, fixed, delta } = move;
  const size = board.length;
  if (!size || !delta) return;

  if (axis === "row") {
    const row = [...board[fixed]];
    for (let col = 0; col < size; col++) {
      const source = (col - delta + size) % size;
      board[fixed][col] = row[source];
    }
    return;
  }

  const column = Array.from({ length: size }, (_, row) => board[row][fixed]);
  for (let row = 0; row < size; row++) {
    const source = (row - delta + size) % size;
    board[row][fixed] = column[source];
  }
}

function colourMoveChanges(board, move) {
  const copy = colourCloneBoard(board);
  colourShift(copy, move);
  for (let row = 0; row < copy.length; row++) {
    for (let col = 0; col < copy.length; col++) {
      if (copy[row][col] !== board[row][col]) return true;
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

  for (let attempt = 0; attempt < 160; attempt++) {
    const board = colourBuildSolved(config.size);
    const moves = [];
    let previous = null;

    for (let i = 0; i < config.scrambleMoves; i++) {
      let chosen = null;
      for (let pick = 0; pick < 100 && !chosen; pick++) {
        const axis = Math.random() < 0.5 ? "row" : "col";
        const fixed = Math.floor(Math.random() * config.size);
        const delta = Math.random() < 0.5 ? -1 : 1;
        const candidate = { axis, fixed, delta };

        // Avoid immediately undoing the previous scramble step.
        if (previous && previous.axis === axis && previous.fixed === fixed && previous.delta === -delta) continue;
        if (!colourMoveChanges(board, candidate)) continue;
        chosen = candidate;
      }
      if (!chosen) break;
      colourShift(board, chosen);
      moves.push(chosen);
      previous = chosen;
    }

    const mixed = 4 - colourSolidBlocks(board);
    const candidate = { board, moves, mixed };
    if (!best || mixed > best.mixed || (mixed === best.mixed && moves.length > best.moves.length)) best = candidate;
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
    for (let col = 0; col < colourSize; col++) cells.push(`${drag.start.row},${col}`);
  } else {
    for (let row = 0; row < colourSize; row++) cells.push(`${row},${drag.start.col}`);
  }
  return cells;
}

function colourDirectionText(drag = colourDrag) {
  if (!drag || !drag.axis || !drag.delta) return "";
  if (drag.axis === "row") return drag.delta > 0 ? "right" : "left";
  return drag.delta > 0 ? "down" : "up";
}

function colourRender() {
  const selected = new Set(colourSelectionCells());
  colourBoardEl.style.setProperty("--colour-grid-size", colourSize);
  colourBoardEl.dataset.shiftAxis = colourDrag?.axis || "";
  colourBoardEl.dataset.shiftDirection = colourDirectionText();
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
  if (colourSolved || !move || !move.delta) return;
  if (!colourMoveChanges(colourBoard, move)) {
    colourStatusEl.textContent = "That line is already uniform — try a different row or column.";
    colourRender();
    return;
  }
  colourHistory.push(colourCloneBoard(colourBoard));
  colourShift(colourBoard, move);
  colourMoves++;
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = "Keep going — every shift changes a whole row or column.";
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
  colourStatusEl.textContent = "Swipe a row or column to shift it one place.";
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
  colourStatusEl.textContent = "Last shift undone.";
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
    axis: null,
    delta: 0,
    startX: event.clientX,
    startY: event.clientY
  };
  colourRender();
});

colourBoardEl.addEventListener("pointermove", event => {
  if (!colourDrag || colourDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  const dx = event.clientX - colourDrag.startX;
  const dy = event.clientY - colourDrag.startY;
  const rect = colourBoardEl.getBoundingClientRect();
  const threshold = Math.max(10, rect.width / colourSize * 0.28);

  if (!colourDrag.axis) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    colourDrag.axis = Math.abs(dx) >= Math.abs(dy) ? "row" : "col";
  }

  if (colourDrag.axis === "row") {
    if (Math.abs(dx) < threshold) colourDrag.delta = 0;
    else colourDrag.delta = dx > 0 ? 1 : -1;
  } else {
    if (Math.abs(dy) < threshold) colourDrag.delta = 0;
    else colourDrag.delta = dy > 0 ? 1 : -1;
  }

  const direction = colourDirectionText();
  if (direction) {
    colourStatusEl.textContent = `Release to shift this ${colourDrag.axis} ${direction}.`;
  }
  colourRender();
});

function colourEndDrag(event) {
  if (!colourDrag || colourDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  const drag = colourDrag;
  colourDrag = null;
  try { colourBoardEl.releasePointerCapture?.(event.pointerId); } catch (_) {}

  if (!drag.axis || !drag.delta) {
    colourStatusEl.textContent = "Swipe left/right for a row, or up/down for a column.";
    colourRender();
    return;
  }

  const move = drag.axis === "row"
    ? { axis: "row", fixed: drag.start.row, delta: drag.delta }
    : { axis: "col", fixed: drag.start.col, delta: drag.delta };
  colourCommitMove(move);
}

colourBoardEl.addEventListener("pointerup", colourEndDrag);
colourBoardEl.addEventListener("pointercancel", event => {
  if (!colourDrag || colourDrag.pointerId !== event.pointerId) return;
  colourDrag = null;
  colourStatusEl.textContent = "Swipe a row or column to shift it one place.";
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
