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
const laserNewGenerated = $("#laser-new-generated");
const laserDifficultyButtons = $$("[data-laser-difficulty]");

const laserGridSizes = {
  small: { rows: 8, cols: 8 },
  medium: { rows: 10, cols: 10 },
  large: { rows: 12, cols: 12 }
};

const laserDifficultyInfo = {
  easy:   { grid:"small",  checkpoints:1, splitters:0, obstacleRatio:.10, turns:2 },
  medium: { grid:"medium", checkpoints:2, splitters:1, obstacleRatio:.15, turns:4 },
  hard:   { grid:"large",  checkpoints:3, splitters:2, obstacleRatio:.19, turns:6 }
};
let laserDifficulty = localStorage.getItem("laserDifficulty") || "easy";
if(!laserDifficultyInfo[laserDifficulty]) laserDifficulty="easy";

// Orthogonal-only beam directions: up, right, down, left.
const laserDirVectors = [
  [-1, 0], [0, 1], [1, 0], [0, -1]
];

let laserMode = "setup";
let laserGridSize = "large";
let laserRowsCount = 12;
let laserColsCount = 12;
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
function laserDirAngle(dir) { return dir * 90 - 90; }
function laserReflect(dir, orientation) {
  // orientation 0 = "/" and 1 = "\". Both turn cardinal beams by 90 degrees.
  const slash = [1,0,3,2];
  const backslash = [3,2,1,0];
  return (orientation % 2 === 0 ? slash : backslash)[dir];
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

function setLaserMode(mode,generate=true) {
  laserMode = mode;
  laserModeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserMode === mode));
  laserSetupPanel.classList.toggle("hidden", mode !== "setup");
  laserPlayPanel.classList.toggle("hidden", mode !== "play");
  laserResult.classList.add("hidden");
  if(mode==="play" && generate){
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
    laserLevel.emitter.dir = (laserLevel.emitter.dir + 1) % 4;
    renderLaserBoard(); traceLaser(); return;
  }

  if (laserSetupTool === "splitter" && laserLevel.splitters.has(key)) {
    laserLevel.splitters.set(key, (laserLevel.splitters.get(key) + 1) % 2);
    renderLaserBoard(); traceLaser(); return;
  }

  clearLaserCell(row, col);

  if (laserSetupTool === "emitter") laserLevel.emitter = { row, col, dir: 1 };
  if (laserSetupTool === "checkpoint") laserLevel.checkpoints.push({ row, col });
  if (laserSetupTool === "target") laserLevel.targets.push({ row, col });
  if (laserSetupTool === "splitter") laserLevel.splitters.set(key, 0);
  if (laserSetupTool === "block") laserLevel.blocks.add(key);

  renderLaserBoard(); traceLaser();
}

function handleLaserPlayTap(row, col) {
  const key = laserKey(row, col);
  if (cellHasFixedObject(row, col)) return;

  if (laserPlayTool === "eraser") laserMirrors.delete(key);
  else if (laserMirrors.has(key)) laserMirrors.set(key, (laserMirrors.get(key) + 1) % 2);
  else laserMirrors.set(key, 0);

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
        e.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="10" width="14" height="12" rx="3"/><path d="M19 13h5l4 3-4 3h-5M9 16h6"/></svg>';
        cell.appendChild(e);
      }

      if (laserLevel.targets.some(x => x.row === row && x.col === col)) {
        cell.classList.add("target-cell");
        const t = document.createElement("span");
        t.className = "laser-target"; t.dataset.target = key;
        t.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><circle cx="16" cy="16" r="2"/></svg>';
        cell.appendChild(t);
      }

      if (laserLevel.checkpoints.some(x => x.row === row && x.col === col)) {
        cell.classList.add("checkpoint-cell");
        const c = document.createElement("span");
        c.className = "laser-checkpoint"; c.dataset.checkpoint = key;
        c.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4"/></svg>';
        cell.appendChild(c);
      }

      if (laserLevel.splitters.has(key)) {
        const s = document.createElement("span");
        s.className = `laser-splitter angle-${laserLevel.splitters.get(key)}`;
        s.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 16h9M18 16h10M16 14l7-7M13 13l3-3 3 3-3 3-3-3Z"/></svg>';
        cell.appendChild(s);
      }

      if (laserMirrors.has(key)) {
        const m = document.createElement("span");
        m.className = `laser-mirror angle-${laserMirrors.get(key)}`;
        m.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 26L26 6M9 28L29 8"/></svg>';
        cell.appendChild(m);
      }

      cell.addEventListener("click", () => {
        if (laserMode === "setup") handleLaserSetupTap(row, col);
        else handleLaserPlayTap(row, col);
      });

      laserBoard.appendChild(cell);
    }
  }

  // Keep the beam SVG inside the exact same box as the grid so its coordinate
  // system cannot drift relative to the cells.
  laserBoard.appendChild(laserBeamLayer);
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


let laserGeneratedSolution = [];

function mirrorOrientationForTurn(inDir,outDir){
  if(laserReflect(inDir,0)===outDir) return 0;
  if(laserReflect(inDir,1)===outDir) return 1;
  return null;
}

function addSegmentCells(set,a,b){
  if(a.row===b.row){
    const lo=Math.min(a.col,b.col), hi=Math.max(a.col,b.col);
    for(let c=lo;c<=hi;c++) set.add(laserKey(a.row,c));
  }else if(a.col===b.col){
    const lo=Math.min(a.row,b.row), hi=Math.max(a.row,b.row);
    for(let r=lo;r<=hi;r++) set.add(laserKey(r,a.col));
  }
}

function randomBetween(min,max){
  return min+Math.floor(Math.random()*(max-min+1));
}


function shuffleArray(items){
  for(let i=items.length-1;i>0;i--){
    const k=Math.floor(Math.random()*(i+1));
    [items[i],items[k]]=[items[k],items[i]];
  }
  return items;
}

function mazeNeighbors(row,col,rows,cols){
  const out=[];
  for(const [dr,dc] of laserDirVectors){
    const nr=row+dr,nc=col+dc;
    if(nr>=0&&nr<rows&&nc>=0&&nc<cols) out.push({row:nr,col:nc});
  }
  return out;
}

function shortestMazePath(start,target,blocks,rows,cols){
  const q=[start];
  const parent=new Map();
  const seen=new Set([laserKey(start.row,start.col)]);
  while(q.length){
    const cur=q.shift();
    if(cur.row===target.row&&cur.col===target.col){
      const path=[];
      let k=laserKey(cur.row,cur.col);
      let node=cur;
      while(node){
        path.push(node);
        const pk=parent.get(k);
        if(!pk) break;
        node=pk.node;
        k=pk.key;
      }
      return path.reverse();
    }
    for(const n of mazeNeighbors(cur.row,cur.col,rows,cols)){
      const k=laserKey(n.row,n.col);
      if(seen.has(k)||blocks.has(k)) continue;
      seen.add(k);
      parent.set(k,{node:cur,key:laserKey(cur.row,cur.col)});
      q.push(n);
    }
  }
  return null;
}

function lineOfSightClear(a,b,blocks){
  if(a.row===b.row){
    const lo=Math.min(a.col,b.col)+1, hi=Math.max(a.col,b.col);
    for(let col=lo;col<hi;col++) if(blocks.has(laserKey(a.row,col))) return false;
    return true;
  }
  if(a.col===b.col){
    const lo=Math.min(a.row,b.row)+1, hi=Math.max(a.row,b.row);
    for(let row=lo;row<hi;row++) if(blocks.has(laserKey(row,a.col))) return false;
    return true;
  }
  return false;
}

function recursiveDivide(blocks,minRow,maxRow,minCol,maxCol,depth=0){
  const height=maxRow-minRow+1;
  const width=maxCol-minCol+1;
  if(width<4||height<4) return;

  // Split the longer dimension, with a little randomness to avoid a rigid grid.
  const horizontal = height>width ? true : width>height ? false : Math.random()<.5;

  if(horizontal){
    const candidates=[];
    for(let r=minRow+1;r<=maxRow-1;r++) candidates.push(r);
    if(!candidates.length) return;
    const wallRow=candidates[Math.floor(Math.random()*candidates.length)];

    const openings=new Set();
    const openingCount=depth<1?2:1;
    while(openings.size<openingCount){
      openings.add(randomBetween(minCol,maxCol));
    }
    for(let col=minCol;col<=maxCol;col++){
      if(!openings.has(col)) blocks.add(laserKey(wallRow,col));
    }

    recursiveDivide(blocks,minRow,wallRow-1,minCol,maxCol,depth+1);
    recursiveDivide(blocks,wallRow+1,maxRow,minCol,maxCol,depth+1);
  }else{
    const candidates=[];
    for(let col=minCol+1;col<=maxCol-1;col++) candidates.push(col);
    if(!candidates.length) return;
    const wallCol=candidates[Math.floor(Math.random()*candidates.length)];

    const openings=new Set();
    const openingCount=depth<1?2:1;
    while(openings.size<openingCount){
      openings.add(randomBetween(minRow,maxRow));
    }
    for(let row=minRow;row<=maxRow;row++){
      if(!openings.has(row)) blocks.add(laserKey(row,wallCol));
    }

    recursiveDivide(blocks,minRow,maxRow,minCol,wallCol-1,depth+1);
    recursiveDivide(blocks,minRow,maxRow,wallCol+1,maxCol,depth+1);
  }
}

function compressMazePath(path){
  if(path.length<3) return path.slice();
  const out=[path[0]];
  let prevDir=routeDirection(path[0],path[1]);
  for(let i=1;i<path.length-1;i++){
    const nextDir=routeDirection(path[i],path[i+1]);
    if(nextDir!==prevDir){
      out.push(path[i]);
      prevDir=nextDir;
    }
  }
  out.push(path[path.length-1]);
  return out;
}

function pathDirectionAt(path,index){
  if(index>=path.length-1) return null;
  return routeDirection(path[index],path[index+1]);
}

function chooseCheckpointIndices(path,count){
  // Never place a checkpoint close to the laser or target, and prefer points
  // well inside straight runs rather than immediately on a mirror.
  const turns=new Set();
  for(let i=1;i<path.length-1;i++){
    const a=routeDirection(path[i-1],path[i]);
    const b=routeDirection(path[i],path[i+1]);
    if(a!==b) turns.add(i);
  }

  const candidates=[];
  for(let i=3;i<path.length-3;i++){
    if(turns.has(i)||turns.has(i-1)||turns.has(i+1)) continue;
    candidates.push(i);
  }
  if(candidates.length<count){
    for(let i=3;i<path.length-3;i++){
      if(!turns.has(i)&&!candidates.includes(i)) candidates.push(i);
    }
  }
  if(!candidates.length) return [];

  const chosen=[];
  for(let n=1;n<=count;n++){
    const wanted=(path.length-1)*(n/(count+1));
    let best=null,bestDist=Infinity;
    for(const idx of candidates){
      if(chosen.includes(idx)) continue;
      const d=Math.abs(idx-wanted);
      if(d<bestDist){best=idx;bestDist=d;}
    }
    if(best!==null) chosen.push(best);
  }
  return chosen.sort((a,b)=>a-b);
}

function tryGenerateMazePuzzle(){
  const D=laserDifficultyInfo[laserDifficulty];
  laserGridSize=D.grid;
  const size=laserGridSizes[D.grid];
  laserRowsCount=size.rows;
  laserColsCount=size.cols;
  laserSizeButtons.forEach(b=>b.classList.toggle("active",b.dataset.laserSize===D.grid));

  const rows=laserRowsCount, cols=laserColsCount;
  const blocks=new Set();

  // Recursive division creates long walls and false corridors/chambers.
  recursiveDivide(blocks,0,rows-1,0,cols-1);

  // Pick start and target from opposite edges. Their rows must differ so the
  // target is never directly in front of the emitter.
  const start={row:randomBetween(1,rows-2),col:0};
  let target={row:randomBetween(1,rows-2),col:cols-1};
  for(let tries=0;tries<20 && Math.abs(target.row-start.row)<2;tries++){
    target={row:randomBetween(1,rows-2),col:cols-1};
  }

  // Guarantee both endpoints and a small launch/arrival corridor are open.
  [start,target,{row:start.row,col:1},{row:target.row,col:cols-2}].forEach(p=>blocks.delete(laserKey(p.row,p.col)));

  const path=shortestMazePath(start,target,blocks,rows,cols);
  if(!path || path.length < Math.max(8,Math.floor(rows*1.25))) return null;

  // Require at least one turn before a checkpoint and enough turns for the difficulty.
  const compressed=compressMazePath(path);
  const mirrorCount=Math.max(0,compressed.length-2);
  const minMirrors=laserDifficulty==="easy"?2:laserDifficulty==="medium"?3:4;
  if(mirrorCount<minMirrors) return null;

  const firstDir=routeDirection(path[0],path[1]);
  if(firstDir!==1) return null; // laser always launches into the board

  const checkpointIndices=chooseCheckpointIndices(path,D.checkpoints);
  if(checkpointIndices.length<D.checkpoints) return null;
  if(checkpointIndices[0]<4) return null;

  const level={
    emitter:{row:start.row,col:start.col,dir:1},
    checkpoints:checkpointIndices.map(i=>({...path[i]})),
    targets:[{...target}],
    splitters:new Map(),
    blocks
  };

  const solution=[];
  for(let i=1;i<path.length-1;i++){
    const inDir=routeDirection(path[i-1],path[i]);
    const outDir=routeDirection(path[i],path[i+1]);
    if(inDir!==outDir){
      const orientation=mirrorOrientationForTurn(inDir,outDir);
      if(orientation===null) return null;
      solution.push({row:path[i].row,col:path[i].col,orientation});
    }
  }

  // Medium/Hard: put fixed splitters later in the route, never right beside
  // the emitter. Each splitter opens a short side objective ending in a target.
  const splitterCandidates=[];
  for(let i=Math.max(5,Math.floor(path.length*.35));i<path.length-4;i++){
    const inDir=routeDirection(path[i-1],path[i]);
    const outDir=routeDirection(path[i],path[i+1]);
    if(inDir!==outDir) continue; // straight section only
    const leftDir=(inDir+3)%4, rightDir=(inDir+1)%4;
    for(const branchDir of shuffleArray([leftDir,rightDir])){
      let r=path[i].row,c=path[i].col;
      const [dr,dc]=laserDirVectors[branchDir];
      const cells=[];
      for(let s=0;s<3;s++){
        r+=dr;c+=dc;
        if(r<0||r>=rows||c<0||c>=cols||blocks.has(laserKey(r,c))) break;
        cells.push({row:r,col:c});
      }
      if(cells.length>=2){
        const orientation=mirrorOrientationForTurn(inDir,branchDir);
        if(orientation!==null){
          splitterCandidates.push({index:i,cell:path[i],branchDir,orientation,cells});
          break;
        }
      }
    }
  }

  let usedSplitters=0;
  const occupied=new Set([
    laserKey(start.row,start.col),
    laserKey(target.row,target.col),
    ...level.checkpoints.map(p=>laserKey(p.row,p.col))
  ]);

  for(const cand of splitterCandidates){
    if(usedSplitters>=D.splitters) break;
    const k=laserKey(cand.cell.row,cand.cell.col);
    if(occupied.has(k)) continue;

    const branchTarget=cand.cells[cand.cells.length-1];
    level.splitters.set(k,cand.orientation);
    level.targets.push(branchTarget);
    occupied.add(k);
    occupied.add(laserKey(branchTarget.row,branchTarget.col));

    // Ensure the side branch is clear even if division walls changed nearby.
    for(const p of cand.cells) level.blocks.delete(laserKey(p.row,p.col));
    usedSplitters++;
  }

  if(usedSplitters<D.splitters) return null;

  return {level,solution,path};
}

function generateLaserLevel(){
  laserMirrors=new Map();
  laserGeneratedSolution=[];

  let generated=null;
  for(let attempt=0;attempt<180 && !generated;attempt++){
    generated=tryGenerateMazePuzzle();
  }

  if(!generated){
    // Extremely defensive fallback: temporarily step down one complexity level.
    const original=laserDifficulty;
    const fallback=original==="hard"?"medium":"easy";
    laserDifficulty=fallback;
    generated=tryGenerateMazePuzzle();
    laserDifficulty=original;
  }

  if(!generated){
    laserStatus.textContent="Could not generate a level. Tap New level to try again.";
    return;
  }

  laserLevel=generated.level;
  laserGeneratedSolution=generated.solution;
  laserLevelName.value="";
  laserResult.classList.add("hidden");
  renderLaserBoard();
  traceLaser();
  laserStatus.textContent="Place mirrors to hit every checkpoint and target.";
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
  const savedEmitter=data.emitter ? {...data.emitter} : null;
  if(savedEmitter){
    // Older saved levels used eight directions (0,2,4,6 were cardinal).
    if(savedEmitter.dir>3) savedEmitter.dir=Math.round(savedEmitter.dir/2)%4;
    savedEmitter.dir=((savedEmitter.dir%4)+4)%4;
  }
  const savedSplitters=new Map(
    (Array.isArray(data.splitters) ? data.splitters : []).map(([k,v])=>[k,Math.round(Number(v)/2)%2])
  );
  laserLevel = {
    emitter: savedEmitter,
    checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints : [],
    targets: Array.isArray(data.targets) ? data.targets : [],
    splitters: savedSplitters,
    blocks: new Set(Array.isArray(data.blocks) ? data.blocks : [])
  };
  laserMirrors = new Map();
  laserLevelName.value = data.name || "";
  laserSizeButtons.forEach(b => b.classList.toggle("active", b.dataset.laserSize === sizeName));
  setLaserMode("setup",false);
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

laserModeButtons.forEach(b => b.addEventListener("click", () => setLaserMode(b.dataset.laserMode,true)));
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

laserDifficultyButtons.forEach(b=>{
  b.classList.toggle("active",b.dataset.laserDifficulty===laserDifficulty);
  b.addEventListener("click",()=>{
    laserDifficulty=b.dataset.laserDifficulty;
    localStorage.setItem("laserDifficulty",laserDifficulty);
    laserDifficultyButtons.forEach(x=>x.classList.toggle("active",x===b));
    generateLaserLevel();
  });
});

laserNewGenerated.addEventListener("click", generateLaserLevel);

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
setLaserMode("play",true);
