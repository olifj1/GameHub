// Colour Blocks — select any 2x2 area, then rotate those four tiles until each quadrant is solid.

const colourBoardEl = $("#colour-blocks-board");
const colourMovesEl = $("#colour-moves");
const colourParEl = $("#colour-par");
const colourSolidEl = $("#colour-solid");
const colourStatusEl = $("#colour-blocks-status");
const colourDifficultyButtons = $$('[data-colour-difficulty]');
const colourRotateLeftButton = $("#colour-rotate-left");
const colourRotateRightButton = $("#colour-rotate-right");
const colourUndoButton = $("#colour-undo");
const colourResetButton = $("#colour-reset");
const colourNewButton = $("#colour-new");

const colourDifficultyConfig = {
  easy:   { size: 4, scrambleMoves: 6,  minMixedBlocks: 3 },
  medium: { size: 6, scrambleMoves: 11, minMixedBlocks: 4 },
  hard:   { size: 8, scrambleMoves: 18, minMixedBlocks: 4 }
};

const colourPalette = [
  { name: "coral", value: "#c97969" },
  { name: "blue",  value: "#7596b7" },
  { name: "gold",  value: "#d4ad5f" },
  { name: "green", value: "#779b78" }
];

let colourDifficulty = "easy";
let colourSize = 4;
let colourPar = 6;
let colourBoard = [];
let colourInitialBoard = [];
let colourMoves = 0;
let colourHistory = [];
let colourSolved = false;
let colourSelection = null;
let colourAnimating = false;

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

// turn: +1 = clockwise, -1 = anticlockwise.
function colourRotate(board, move) {
  if (!move) return;
  const row = move.row;
  const col = move.col;
  const turn = move.turn >= 0 ? 1 : -1;
  if (row < 0 || col < 0 || row >= board.length - 1 || col >= board.length - 1) return;

  const tl = board[row][col];
  const tr = board[row][col + 1];
  const br = board[row + 1][col + 1];
  const bl = board[row + 1][col];

  if (turn > 0) {
    board[row][col] = bl;
    board[row][col + 1] = tl;
    board[row + 1][col + 1] = tr;
    board[row + 1][col] = br;
  } else {
    board[row][col] = tr;
    board[row][col + 1] = br;
    board[row + 1][col + 1] = bl;
    board[row + 1][col] = tl;
  }
}

function colourMoveChanges(board, move) {
  const copy = colourCloneBoard(board);
  colourRotate(copy, move);
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
          if (board[row][col] !== first) {
            same = false;
            break;
          }
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

  for (let attempt = 0; attempt < 180; attempt++) {
    const board = colourBuildSolved(config.size);
    const moves = [];
    let previous = null;

    for (let i = 0; i < config.scrambleMoves; i++) {
      let chosen = null;
      for (let pick = 0; pick < 120 && !chosen; pick++) {
        const candidate = {
          row: Math.floor(Math.random() * (config.size - 1)),
          col: Math.floor(Math.random() * (config.size - 1)),
          turn: Math.random() < 0.5 ? -1 : 1
        };

        // Avoid immediately undoing or repeatedly spinning the same four cells.
        if (previous && previous.row === candidate.row && previous.col === candidate.col) continue;
        if (!colourMoveChanges(board, candidate)) continue;
        chosen = candidate;
      }
      if (!chosen) break;
      colourRotate(board, chosen);
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

function colourSelectionContains(row, col) {
  if (!colourSelection) return false;
  return row >= colourSelection.row && row <= colourSelection.row + 1 && col >= colourSelection.col && col <= colourSelection.col + 1;
}

function colourPositionSelectionFrame() {
  const frame = colourBoardEl.querySelector('.colour-blocks-selection-frame');
  if (!frame || !colourSelection) return;
  const tl = colourBoardEl.querySelector(`[data-row="${colourSelection.row}"][data-col="${colourSelection.col}"]`);
  const br = colourBoardEl.querySelector(`[data-row="${colourSelection.row + 1}"][data-col="${colourSelection.col + 1}"]`);
  if (!tl || !br) return;
  const boardRect = colourBoardEl.getBoundingClientRect();
  const tlRect = tl.getBoundingClientRect();
  const brRect = br.getBoundingClientRect();
  frame.style.left = `${tlRect.left - boardRect.left - 2}px`;
  frame.style.top = `${tlRect.top - boardRect.top - 2}px`;
  frame.style.width = `${brRect.right - tlRect.left + 4}px`;
  frame.style.height = `${brRect.bottom - tlRect.top + 4}px`;
}

function colourRender() {
  colourBoardEl.style.setProperty("--colour-grid-size", colourSize);
  colourBoardEl.innerHTML = "";

  for (let row = 0; row < colourSize; row++) {
    for (let col = 0; col < colourSize; col++) {
      const colourIndex = colourBoard[row][col];
      const tile = document.createElement("div");
      tile.className = "colour-blocks-tile" + (colourSelectionContains(row, col) ? " selected" : "");
      tile.dataset.row = row;
      tile.dataset.col = col;
      tile.dataset.colour = colourPalette[colourIndex].name;
      tile.style.setProperty("--tile-colour", colourPalette[colourIndex].value);
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", `${colourPalette[colourIndex].name} tile`);
      colourBoardEl.appendChild(tile);
    }
  }

  if (colourSelection) {
    const frame = document.createElement("div");
    frame.className = "colour-blocks-selection-frame";
    frame.setAttribute("aria-hidden", "true");
    colourBoardEl.appendChild(frame);
    colourPositionSelectionFrame();
  }

  const solid = colourSolidBlocks();
  colourMovesEl.textContent = colourMoves;
  colourParEl.textContent = colourPar;
  colourSolidEl.textContent = `${solid} / 4`;
  colourRotateLeftButton.disabled = !colourSelection || colourSolved || colourAnimating;
  colourRotateRightButton.disabled = !colourSelection || colourSolved || colourAnimating;
  colourUndoButton.disabled = colourHistory.length === 0 || colourSolved || colourAnimating;
  colourResetButton.disabled = colourMoves === 0 || colourSolved || colourAnimating;
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

function colourAnimationMapping(move) {
  const r = move.row;
  const c = move.col;
  if (move.turn > 0) {
    return [
      { dest: [r, c],         source: [r + 1, c] },
      { dest: [r, c + 1],     source: [r, c] },
      { dest: [r + 1, c + 1], source: [r, c + 1] },
      { dest: [r + 1, c],     source: [r + 1, c + 1] }
    ];
  }
  return [
    { dest: [r, c],         source: [r, c + 1] },
    { dest: [r, c + 1],     source: [r + 1, c + 1] },
    { dest: [r + 1, c + 1], source: [r + 1, c] },
    { dest: [r + 1, c],     source: [r, c] }
  ];
}

function colourAnimateRotation(move) {
  const mapping = colourAnimationMapping(move);
  const boardRect = colourBoardEl.getBoundingClientRect();
  if (!boardRect.width) {
    colourAnimating = false;
    colourRender();
    if (colourIsSolved()) colourFinishPuzzle();
    return;
  }

  const jobs = [];
  mapping.forEach(({ dest, source }) => {
    const destEl = colourBoardEl.querySelector(`[data-row="${dest[0]}"][data-col="${dest[1]}"]`);
    const sourceEl = colourBoardEl.querySelector(`[data-row="${source[0]}"][data-col="${source[1]}"]`);
    if (!destEl || !sourceEl) return;
    const destRect = destEl.getBoundingClientRect();
    const sourceRect = sourceEl.getBoundingClientRect();
    jobs.push({
      el: destEl,
      dx: sourceRect.left - destRect.left,
      dy: sourceRect.top - destRect.top
    });
  });

  jobs.forEach(job => {
    job.el.style.transition = "none";
    job.el.style.transform = `translate(${job.dx}px,${job.dy}px) scale(.94)`;
    job.el.style.zIndex = "7";
  });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    jobs.forEach(job => {
      job.el.style.transition = "transform .19s cubic-bezier(.2,.75,.25,1), filter .19s ease";
      job.el.style.transform = "translate(0,0) scale(.94)";
    });
  }));

  window.setTimeout(() => {
    jobs.forEach(job => {
      job.el.style.transition = "";
      job.el.style.transform = "";
      job.el.style.zIndex = "";
    });
    colourAnimating = false;
    colourRender();
    if (colourIsSolved()) colourFinishPuzzle();
  }, 225);
}

function colourCommitRotation(turn) {
  if (colourSolved || colourAnimating || !colourSelection) return;
  const move = { row: colourSelection.row, col: colourSelection.col, turn: turn >= 0 ? 1 : -1 };
  if (!colourMoveChanges(colourBoard, move)) {
    colourStatusEl.textContent = "Those four tiles are already the same colour — choose another area.";
    return;
  }

  colourHistory.push(colourCloneBoard(colourBoard));
  colourRotate(colourBoard, move);
  colourMoves++;
  colourAnimating = true;
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = turn > 0 ? "Rotated clockwise." : "Rotated anticlockwise.";
  colourRender();
  colourAnimateRotation(move);
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
  colourSelection = null;
  colourAnimating = false;
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = "Tap a 2×2 area, then rotate it left or right.";
  colourRender();
}

function colourResetPuzzle() {
  if (colourAnimating) return;
  colourBoard = colourCloneBoard(colourInitialBoard);
  colourMoves = 0;
  colourHistory = [];
  colourSolved = false;
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = "Puzzle reset — choose a 2×2 area.";
  colourRender();
}

function colourUndo() {
  if (!colourHistory.length || colourSolved || colourAnimating) return;
  colourBoard = colourHistory.pop();
  colourMoves = Math.max(0, colourMoves - 1);
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = "Last rotation undone.";
  colourRender();
}

colourBoardEl.addEventListener("pointerdown", event => {
  if (colourSolved || colourAnimating || (event.pointerType === "mouse" && event.button !== 0)) return;
  const cell = colourCellIndexFromPoint(event.clientX, event.clientY);
  if (!cell) return;
  event.preventDefault();

  colourSelection = {
    row: Math.min(cell.row, colourSize - 2),
    col: Math.min(cell.col, colourSize - 2)
  };
  colourStatusEl.classList.remove("good");
  colourStatusEl.textContent = "Selected four tiles — rotate left or right.";
  colourRender();
});

colourRotateLeftButton.addEventListener("click", () => colourCommitRotation(-1));
colourRotateRightButton.addEventListener("click", () => colourCommitRotation(1));

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

window.addEventListener("resize", () => requestAnimationFrame(colourPositionSelectionFrame));

colourNewPuzzle();
