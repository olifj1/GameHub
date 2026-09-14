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
  easy:   { size: 4, scrambleMoves: 10, minMixedBlocks: 3, minDisorder: 10, minVariety: 7 },
  medium: { size: 6, scrambleMoves: 34, minMixedBlocks: 4, minDisorder: 38, minVariety: 12 },
  hard:   { size: 8, scrambleMoves: 64, minMixedBlocks: 4, minDisorder: 72, minVariety: 14 }
};

const colourPalette = [
  { name: "dusty rose", fill: "#d39e95", stroke: "#815f5b" },
  { name: "slate blue", fill: "#a6b5c5", stroke: "#667687" },
  { name: "ochre", fill: "#ccb06a", stroke: "#827046" },
  { name: "sage", fill: "#a7baa7", stroke: "#6a7d6a" }
];

const colourTokenThemes = {
  shapes: {
    label: "Shapes",
    names: ["moon", "star", "heart", "diamond"],
    render(index) {
      if (index === 0) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="46" cy="50" r="24" fill="var(--token-fill)" />
            <circle cx="58" cy="44" r="22" fill="var(--board-fill)" />
            <path d="M41 26a24 24 0 0 0 0 48 24 24 0 0 0 11-2" fill="none" stroke="var(--token-stroke)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>`;
      }
      if (index === 1) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 16l8 22 24 2-18 14 6 24-20-12-20 12 6-24-18-14 24-2Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5.5" stroke-linejoin="round" />
          </svg>`;
      }
      if (index === 2) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 78c-18-12-30-23-30-38 0-9 7-16 16-16 6 0 11 3 14 8 3-5 8-8 14-8 9 0 16 7 16 16 0 15-12 26-30 38Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5.5" stroke-linejoin="round" />
          </svg>`;
      }
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect x="28" y="28" width="44" height="44" rx="8" transform="rotate(45 50 50)" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5.5" />
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
            <path d="M50 34c-5-8-16-10-24-2-9 9-9 27 0 38 7 8 17 11 24 11s17-3 24-11c9-11 9-29 0-38-8-8-19-6-24 2Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5.5" stroke-linejoin="round" />
            <path d="M50 32c0-7 2-12 6-17" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
            <path d="M57 18c8 1 12 4 15 9" fill="none" stroke="var(--token-stroke)" stroke-width="4" stroke-linecap="round" />
            <path d="M35 42c5-6 12-10 20-10" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      if (index === 1) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 24c7 0 11 5 11 12 0 3-1 6-2 9 9 7 13 18 9 29-5 12-16 18-29 18s-24-6-29-18c-4-11 0-22 9-29-1-3-2-6-2-9 0-7 4-12 11-12 5 0 9 2 11 5 3-3 6-5 12-5Z" transform="translate(11 -6) scale(.78)" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="6" stroke-linejoin="round" />
            <path d="M48 29c2-8 8-13 14-16" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
            <path d="M49 31c8-2 14 0 18 5" fill="none" stroke="var(--token-stroke)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      if (index === 2) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <ellipse cx="50" cy="54" rx="28" ry="19" transform="rotate(-16 50 54)" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5.5" />
            <path d="M56 33c6-6 12-10 18-10" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
            <path d="M35 50c6-4 12-6 20-7" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <path d="M36 37c7 0 13 6 13 13s-6 13-13 13-13-6-13-13 6-13 13-13Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" />
          <path d="M64 47c7 0 13 6 13 13s-6 13-13 13-13-6-13-13 6-13 13-13Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" />
          <path d="M36 38c6-12 14-18 27-18" fill="none" stroke="var(--token-stroke)" stroke-width="5" stroke-linecap="round" />
          <path d="M51 19c4 1 8 4 10 8" fill="none" stroke="var(--token-stroke)" stroke-width="4" stroke-linecap="round" />
        </svg>`;
    }
  },
  sweets: {
    label: "Sweets",
    names: ["wrapped sweet", "lollipop", "jellybean", "donut"],
    render(index) {
      if (index === 0) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M18 50 30 39v22L18 50Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" stroke-linejoin="round" />
            <rect x="30" y="33" width="40" height="34" rx="10" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" />
            <path d="M70 39 82 50 70 61Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5" stroke-linejoin="round" />
            <path d="M39 42h22M39 58h22" stroke="rgba(255,255,255,.42)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      if (index === 1) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="52" cy="40" r="20" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5.5" />
            <circle cx="52" cy="40" r="8" fill="var(--board-fill)" stroke="var(--token-stroke)" stroke-width="4" />
            <path d="M52 60v20" fill="none" stroke="var(--token-stroke)" stroke-width="6" stroke-linecap="round" />
          </svg>`;
      }
      if (index === 2) {
        return `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M32 36c9-8 28-8 36 0 8 8 8 21 0 29-8 8-27 8-36 0-8-8-8-21 0-29Z" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5.5" stroke-linejoin="round" />
            <path d="M42 34c6 0 12 2 17 6" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="4" stroke-linecap="round" />
          </svg>`;
      }
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="24" fill="var(--token-fill)" stroke="var(--token-stroke)" stroke-width="5.5" />
          <circle cx="50" cy="50" r="10" fill="var(--board-fill)" stroke="var(--token-stroke)" stroke-width="4" />
          <circle cx="39" cy="41" r="2.5" fill="rgba(255,255,255,.58)" />
          <circle cx="58" cy="39" r="2.5" fill="rgba(255,255,255,.58)" />
          <circle cx="60" cy="58" r="2.5" fill="rgba(255,255,255,.58)" />
          <circle cx="42" cy="60" r="2.5" fill="rgba(255,255,255,.58)" />
        </svg>`;
    }
  }
};

let colourDifficulty = "easy";
let colourSize = 4;
let colourPar = 10;
let colourTheme = "fruit";
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

  for (let attempt = 0; attempt < 420; attempt++) {
    const board = colourBuildSolved(config.size);
    const moves = [];
    let previous = null;

    for (let i = 0; i < config.scrambleMoves; i++) {
      let chosen = null;
      for (let pick = 0; pick < 220 && !chosen; pick++) {
        const candidate = {
          row: Math.floor(Math.random() * (config.size - 1)),
          col: Math.floor(Math.random() * (config.size - 1)),
          turn: Math.random() < 0.5 ? -1 : 1
        };

        if (previous && previous.row === candidate.row && previous.col === candidate.col && previous.turn !== candidate.turn) continue;
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
      mixed > best.mixed ||
      (mixed === best.mixed && disorder > best.disorder) ||
      (mixed === best.mixed && disorder === best.disorder && variety > best.variety)
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
  frame.style.left = `${tlRect.left - boardRect.left - 3}px`;
  frame.style.top = `${tlRect.top - boardRect.top - 3}px`;
  frame.style.width = `${brRect.right - tlRect.left + 6}px`;
  frame.style.height = `${brRect.bottom - tlRect.top + 6}px`;
}

function colourTokenMarkup(colourIndex) {
  const theme = colourTokenThemes[colourTheme] || colourTokenThemes.fruit;
  const palette = colourPalette[colourIndex];
  return `
    <div class="colour-blocks-token colour-theme-${colourTheme}" style="--token-fill:${palette.fill}; --token-stroke:${palette.stroke}; --board-fill:#cfd4d8;">
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
      const tokenName = (colourTokenThemes[colourTheme] || colourTokenThemes.fruit).names[colourIndex] || "tile";
      tile.className = "colour-blocks-tile" + (colourSelectionContains(row, col) ? " selected" : "");
      tile.dataset.row = row;
      tile.dataset.col = col;
      tile.dataset.colour = colourPalette[colourIndex].name;
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
  if (moves <= colourPar + sizeBonus + 1) return 4;
  if (moves <= colourPar + sizeBonus * 2 + 4) return 3;
  if (moves <= colourPar + sizeBonus * 4 + 8) return 2;
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
    const tokenEl = destEl?.querySelector('.colour-blocks-token');
    if (!destEl || !sourceEl || !tokenEl) return;
    const destRect = destEl.getBoundingClientRect();
    const sourceRect = sourceEl.getBoundingClientRect();
    jobs.push({
      el: tokenEl,
      dx: (sourceRect.left + sourceRect.width / 2) - (destRect.left + destRect.width / 2),
      dy: (sourceRect.top + sourceRect.height / 2) - (destRect.top + destRect.height / 2)
    });
  });

  jobs.forEach(job => {
    job.el.style.transition = "none";
    job.el.style.transform = `translate(${job.dx}px, ${job.dy}px) scale(1.02)`;
    job.el.style.zIndex = "7";
  });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    jobs.forEach(job => {
      job.el.style.transition = "transform .2s cubic-bezier(.2,.75,.25,1)";
      job.el.style.transform = "translate(0, 0) scale(1)";
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
  }, 235);
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
    colourStatusEl.textContent = `${colourTokenThemes[colourTheme].label} icons selected.`;
  });
});

colourUndoButton.addEventListener("click", colourUndo);
colourResetButton.addEventListener("click", colourResetPuzzle);
colourNewButton.addEventListener("click", colourNewPuzzle);

window.addEventListener("resize", () => requestAnimationFrame(colourPositionSelectionFrame));

colourThemeButtons.forEach(button => button.classList.toggle("active", button.dataset.colourTheme === colourTheme));
colourNewPuzzle();
