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

function chooseSeparatedRows(count,rows){
  const out=[];
  for(let tries=0;tries<200 && out.length<count;tries++){
    const r=randomBetween(1,rows-2);
    if(out.every(x=>Math.abs(x-r)>=2)) out.push(r);
  }
  // Reliable fallback for very unlucky random choices.
  while(out.length<count){
    const candidate=1+Math.floor((out.length+1)*(rows-2)/(count+1));
    if(!out.includes(candidate)) out.push(candidate);
    else out.push(Math.min(rows-2,candidate+1));
  }
  return out.slice(0,count);
}

function routeDirection(a,b){
  if(b.row<a.row) return 0;
  if(b.col>a.col) return 1;
  if(b.row>a.row) return 2;
  return 3;
}

function addCheckpointCandidate(list,a,b){
  if(a.row===b.row){
    const lo=Math.min(a.col,b.col)+1, hi=Math.max(a.col,b.col)-1;
    if(hi>=lo) list.push({row:a.row,col:Math.floor((lo+hi)/2)});
  }else{
    const lo=Math.min(a.row,b.row)+1, hi=Math.max(a.row,b.row)-1;
    if(hi>=lo) list.push({row:Math.floor((lo+hi)/2),col:a.col});
  }
}

function makeBranchFromSplitter(splitter,inDir,rows,cols,routeCells){
  // Generated splitters sit on horizontal right-moving sections. Send the
  // branch toward whichever vertical edge is farther away, giving it room.
  let branchDir=splitter.row>=Math.floor(rows/2)?0:2;
  let target={row:branchDir===0?0:rows-1,col:splitter.col};
  const orientation=mirrorOrientationForTurn(inDir,branchDir);
  if(orientation===null) return null;
  addSegmentCells(routeCells,splitter,target);
  return {target,orientation,dir:branchDir};
}

function generateLaserLevel(){
  const D=laserDifficultyInfo[laserDifficulty];
  laserGridSize=D.grid;
  const size=laserGridSizes[D.grid];
  laserRowsCount=size.rows;
  laserColsCount=size.cols;
  laserSizeButtons.forEach(b=>b.classList.toggle("active",b.dataset.laserSize===D.grid));

  const rows=laserRowsCount, cols=laserColsCount;
  laserMirrors=new Map();
  laserGeneratedSolution=[];

  // One vertical transition gives two turns; two gives four; three gives six.
  const verticalTransitions=D.turns/2;
  const rowValues=chooseSeparatedRows(verticalTransitions+1,rows);

  const turnCols=[];
  const fractions=verticalTransitions===1 ? [.48]
    : verticalTransitions===2 ? [.30,.66]
    : [.23,.50,.74];
  fractions.forEach((f,i)=>{
    let col=Math.max(2,Math.min(cols-3,Math.round((cols-1)*f)));
    if(i && col<=turnCols[i-1]+1) col=turnCols[i-1]+2;
    turnCols.push(Math.min(cols-3,col));
  });

  const points=[{row:rowValues[0],col:0}];
  for(let i=0;i<verticalTransitions;i++){
    points.push({row:rowValues[i],col:turnCols[i]});
    points.push({row:rowValues[i+1],col:turnCols[i]});
  }
  points.push({row:rowValues[rowValues.length-1],col:cols-1});

  const routeCells=new Set();
  const dirs=[];
  for(let i=0;i<points.length-1;i++){
    addSegmentCells(routeCells,points[i],points[i+1]);
    dirs.push(routeDirection(points[i],points[i+1]));
  }

  laserLevel={
    emitter:{row:points[0].row,col:points[0].col,dir:dirs[0]},
    checkpoints:[],
    targets:[{...points[points.length-1]}],
    splitters:new Map(),
    blocks:new Set()
  };

  // Every bend is a required player mirror.
  for(let i=1;i<points.length-1;i++){
    const orientation=mirrorOrientationForTurn(dirs[i-1],dirs[i]);
    if(orientation!==null){
      laserGeneratedSolution.push({row:points[i].row,col:points[i].col,orientation});
    }
  }

  // Add fixed splitters on long horizontal sections for Medium/Hard. Their
  // branches terminate directly at extra targets, so the generated puzzle has
  // a known valid solution without requiring diagonal optics.
  const horizontalSegments=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    if(a.row===b.row && Math.abs(b.col-a.col)>=3){
      horizontalSegments.push({index:i,a,b,dir:dirs[i]});
    }
  }

  const branchCheckpointCandidates=[];
  horizontalSegments.slice(0,D.splitters).forEach((seg,branchIndex)=>{
    const lo=Math.min(seg.a.col,seg.b.col)+1;
    const hi=Math.max(seg.a.col,seg.b.col)-1;
    if(hi<lo) return;
    const span=hi-lo+1;
    const col=lo+Math.floor(span*(branchIndex+1)/(D.splitters+1));
    const splitter={row:seg.a.row,col};
    const branch=makeBranchFromSplitter(splitter,seg.dir,rows,cols,routeCells);
    if(!branch) return;
    laserLevel.splitters.set(laserKey(splitter.row,splitter.col),branch.orientation);
    laserLevel.targets.push(branch.target);

    // A checkpoint halfway along each branch makes splitters meaningful.
    const midRow=Math.floor((splitter.row+branch.target.row)/2);
    if(midRow!==splitter.row && midRow!==branch.target.row){
      branchCheckpointCandidates.push({row:midRow,col:splitter.col});
    }
  });

  // Checkpoints scale with difficulty. Prefer branches first on harder levels,
  // then distribute the rest along the main route.
  const mainCheckpointCandidates=[];
  for(let i=0;i<points.length-1;i++) addCheckpointCandidate(mainCheckpointCandidates,points[i],points[i+1]);
  const blockedSpecial=new Set([
    ...points.slice(1,-1).map(p=>laserKey(p.row,p.col)),
    ...[...laserLevel.splitters.keys()]
  ]);
  const candidates=[
    ...branchCheckpointCandidates,
    ...mainCheckpointCandidates.filter(p=>!blockedSpecial.has(laserKey(p.row,p.col)))
  ];
  const unique=[];
  const seenCp=new Set();
  for(const cp of candidates){
    const k=laserKey(cp.row,cp.col);
    if(!seenCp.has(k) && !laserLevel.targets.some(t=>laserKey(t.row,t.col)===k)){
      seenCp.add(k); unique.push(cp);
    }
  }
  laserLevel.checkpoints=unique.slice(0,D.checkpoints);

  // Logic-like obstacle blocks fill only cells that are not on any guaranteed
  // beam path, so every generated puzzle remains solvable.
  const wanted=Math.max(5,Math.floor(rows*cols*D.obstacleRatio));
  const choices=[];
  for(let r=0;r<rows;r++) for(let col=0;col<cols;col++){
    const k=laserKey(r,col);
    if(!routeCells.has(k)) choices.push(k);
  }
  choices.sort(()=>Math.random()-.5);
  choices.slice(0,wanted).forEach(k=>laserLevel.blocks.add(k));

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
