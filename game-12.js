// Colour Blocks — select any 2x2 area, then rotate those four tiles until each quadrant is solid.

const colourBoardEl = $("#colour-blocks-board");
const colourMovesEl = $("#colour-moves");
const colourParEl = $("#colour-par");
const colourSolidEl = $("#colour-solid");
const colourStatusEl = $("#colour-blocks-status");
const colourDifficultyButtons = $$('[data-colour-difficulty]');
const colourThemeButtons = $$('[data-colour-theme]');
const colourRotateLeftButton = $("#colour-rotate-left");
const colourRotateRightButton = $("#colour-rotate-right");
const colourUndoButton = $("#colour-undo");
const colourResetButton = $("#colour-reset");
const colourNewButton = $("#colour-new");

const colourDifficultyConfig = {
  easy:   { size: 4, scrambleMoves: 8,  minMixedBlocks: 3, minDisorder: 8,  minVariety: 7 },
  medium: { size: 6, scrambleMoves: 20, minMixedBlocks: 4, minDisorder: 24, minVariety: 10 },
  hard:   { size: 8, scrambleMoves: 32, minMixedBlocks: 4, minDisorder: 42, minVariety: 11 }
};

const colourPalette = [
  { name: "dusty rose", fill: "#d1a29a", stroke: "#805e59" },
  { name: "slate blue", fill: "#aab7c4", stroke: "#637181" },
  { name: "ochre",      fill: "#c8b07b", stroke: "#786643" },
  { name: "sage",       fill: "#a5b9a8", stroke: "#647767" }
];

const colourTokenThemes = {
  shapes: {
    label: "Shapes",
    names: ["circle", "diamond", "triangle", "square"],
    render(index) {
      if (index === 0) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="28" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" />
          </svg>`;
      }
      if (index === 1) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <rect x="28" y="28" width="44" height="44" rx="6" transform="rotate(45 50 50)" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" />
          </svg>`;
      }
      if (index === 2) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 20 L78 74 H22 Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" stroke-linejoin="round" />
          </svg>`;
      }
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect x="25" y="25" width="50" height="50" rx="10" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" />
        </svg>`;
    }
  },
  fruit: {
    label: "Fruit",
    names: ["apple", "pear", "lemon", "cherries"],
    render(index) {
      if (index === 0) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 34c-5-8-16-10-24-2-9 9-9 27 0 38 7 8 17 11 24 11s17-3 24-11c9-11 9-29 0-38-8-8-19-6-24 2Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" stroke-linejoin="round" />
            <path d="M52 21c7-5 13-5 18-2" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
            <path d="M50 32c0-7 1-12 5-17" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
            <path d="M56 18c8 0 12 3 14 8" fill="none" stroke="var(--token-stroke)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      if (index === 1) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 22c6 0 11 5 11 12 0 3-1 6-2 9 10 7 14 21 8 31-6 11-16 16-28 16s-22-5-28-16c-6-10-2-24 8-31-1-3-2-6-2-9 0-7 5-12 11-12 5 0 8 2 11 5 3-3 6-5 11-5Z" transform="translate(11 -5) scale(.78)" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" stroke-linejoin="round" />
            <path d="M49 28c1-8 6-13 12-16" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
            <path d="M51 27c8-2 13 0 17 5" fill="none" stroke="var(--token-stroke)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      if (index === 2) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <ellipse cx="50" cy="52" rx="26" ry="18" transform="rotate(-16 50 52)" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" />
            <path d="M57 31c5-6 11-9 17-9" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
          </svg>`;
      }
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <path d="M36 33c7 0 13 6 13 13s-6 13-13 13-13-6-13-13 6-13 13-13Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" />
          <path d="M64 43c7 0 13 6 13 13s-6 13-13 13-13-6-13-13 6-13 13-13Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" />
          <path d="M37 33c5-9 13-13 24-13" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
          <path d="M50 19c5 1 9 4 11 8" fill="none" stroke="var(--token-stroke)" stroke-width="4" stroke-linecap="round" />
        </svg>`;
    }
  },
  sweets: {
    label: "Sweets",
    names: ["wrapped sweet", "lollipop", "jellybean", "chocolate"],
    render(index) {
      if (index === 0) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M20 50 31 39v22L20 50Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" stroke-linejoin="round" />
            <rect x="31" y="33" width="38" height="34" rx="10" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" />
            <path d="M69 39 80 50 69 61Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" stroke-linejoin="round" />
            <path d="M40 42h20M40 58h20" stroke="rgba(255,255,255,.45)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      if (index === 1) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="53" cy="42" r="20" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" />
            <path d="M53 24a18 18 0 0 1 0 36 18 18 0 0 1 0-36Zm0 7a11 11 0 0 0 0 22 11 11 0 0 0 0-22Z" fill="rgba(255,255,255,.28)" />
            <path d="M53 61v20" fill="none" stroke="var(--token-stroke)" stroke-width="6" stroke-linecap="round" />
          </svg>`;
      }
      if (index === 2) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M33 35c8-8 29-8 36 0 8 8 8 22 0 30-7 8-28 8-36 0-8-8-8-22 0-30Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" stroke-linejoin="round" />
            <path d="M42 33c7 0 12 2 17 7" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect x="27" y="28" width="46" height="44" rx="6" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" />
          <path d="M42.5 28v44M57.5 28v44M27 43h46M27 57h46" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="4" />
        </svg>`;
    }
  }
};

let colourDifficulty = "easy";
let colourSize = 4;
let colourPar = 8;
let colourTheme = "shapes";
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

function colourQuadrantVariety(board = colourBoard) {
  const size = board.length;
  const half = size / 2;
  let variety = 0;
  for (let blockRow = 0; blockRow < 2; blockRow++) {
    for (let blockCol = 0; blockCol < 2; blockCol++) {
      const seen = new Set();
      for (let row = blockRow * half; row < (blockRow + 1) * half; row++) {
        for (let col = blockCol * half; col < (blockCol + 1) * half; col++) {
          seen.add(board[row][col]);
        }
      }
      variety += seen.size;
    }
  }
  return variety;
}

function colourDisorder(board = colourBoard) {
  const size = board.length;
  let changes = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (col < size - 1 && board[row][col] !== board[row][col + 1]) changes++;
      if (row < size - 1 && board[row][col] !== board[row + 1][col]) changes++;
    }
  }
  return changes;
}

function colourIsSolved(board = colourBoard) {
  return colourSolidBlocks(board) === 4;
}

function colourMakeScrambledBoard() {
  const config = colourDifficultyConfig[colourDifficulty];
  let best = null;

  for (let attempt = 0; attempt < 260; attempt++) {
    const board = colourBuildSolved(config.size);
    const moves = [];
    let previous = null;

    for (let i = 0; i < config.scrambleMoves; i++) {
      let chosen = null;
      for (let pick = 0; pick < 180 && !chosen; pick++) {
        const candidate = {
          row: Math.floor(Math.random() * (config.size - 1)),
          col: Math.floor(Math.random() * (config.size - 1)),
          turn: Math.random() < 0.5 ? -1 : 1
        };

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
    const disorder = colourDisorder(board);
    const variety = colourQuadrantVariety(board);
    const candidate = { board, moves, mixed, disorder, variety };

    if (
      !best ||
      disorder > best.disorder ||
      (disorder === best.disorder && variety > best.variety) ||
      (disorder === best.disorder && variety === best.variety && moves.length > best.moves.length)
    ) {
      best = candidate;
    }

    if (
      moves.length === config.scrambleMoves &&
      !colourIsSolved(board) &&
      mixed >= config.minMixedBlocks &&
      disorder >= config.minDisorder &&
      variety >= config.minVariety
    ) {
      return candidate;
    }
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

function colourTokenMarkup(colourIndex) {
  const theme = colourTokenThemes[colourTheme] || colourTokenThemes.shapes;
  const palette = colourPalette[colourIndex];
  return `
    <div class="colour-blocks-token colour-theme-${colourTheme}" style="--token-fill:${palette.fill}; --token-stroke:${palette.stroke};">
      ${theme.render(colourIndex)}
    </div>`;
}

function colourRender() {
  colourBoardEl.style.setProperty("--colour-grid-size", colourSize);
  colourBoardEl.innerHTML = "";

  for (let row = 0; row < colourSize; row++) {
    for (let col = 0; col < colourSize; col++) {
      const colourIndex = colourBoard[row][col];
      const tile = document.createElement("div");
      const tokenName = (colourTokenThemes[colourTheme] || colourTokenThemes.shapes).names[colourIndex] || "tile";
      tile.className = "colour-blocks-tile" + (colourSelectionContains(row, col) ? " selected" : "");
      tile.dataset.row = row;
      tile.dataset.col = col;
      tile.dataset.colour = colourPalette[colourIndex].name;
      tile.style.setProperty("--tile-colour", colourPalette[colourIndex].fill);
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", `${colourPalette[colourIndex].name} ${tokenName}`);
      tile.innerHTML = colourTokenMarkup(colourIndex);
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
  const sizeBonus = Math.max(4, colourSize);
  if (moves <= colourPar) return 5;
  if (moves <= colourPar + sizeBonus) return 4;
  if (moves <= colourPar + sizeBonus * 2 + 2) return 3;
  if (moves <= colourPar + sizeBonus * 4 + 4) return 2;
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
    job.el.style.transform = `translate(${job.dx}px,${job.dy}px) scale(.96)`;
    job.el.style.zIndex = "7";
  });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    jobs.forEach(job => {
      job.el.style.transition = "transform .19s cubic-bezier(.2,.75,.25,1)";
      job.el.style.transform = "translate(0,0) scale(.96)";
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
    colourStatusEl.textContent = "Those four tiles are already the same — choose another area.";
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

colourThemeButtons.forEach(button => {
  button.addEventListener("click", () => {
    colourTheme = button.dataset.colourTheme;
    colourThemeButtons.forEach(other => other.classList.toggle("active", other === button));
    colourRender();
    colourStatusEl.classList.remove("good");
    colourStatusEl.textContent = `${colourTokenThemes[colourTheme].label} style selected.`;
  });
});

colourUndoButton.addEventListener("click", colourUndo);
colourResetButton.addEventListener("click", colourResetPuzzle);
colourNewButton.addEventListener("click", colourNewPuzzle);

window.addEventListener("resize", () => requestAnimationFrame(colourPositionSelectionFrame));

colourNewPuzzle();
