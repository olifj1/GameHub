const codingBoard = $("#coding-board");
const codingStatus = $("#coding-status");
const codingLevelButtons = $$('[data-coding-level]');
const commandButtons = $$('[data-command]');
const programTimeline = $("#program-timeline");
const programCount = $("#program-count");
const programEditor = $("#program-editor");
const programMoveLeft = $("#program-move-left");
const programDelete = $("#program-delete");
const programMoveRight = $("#program-move-right");
const codingRun = $("#coding-run");
const codingClear = $("#coding-clear");
const codingUndo = $("#coding-undo");
const newCodingPuzzle = $("#new-coding-puzzle");
const codingGuideToggle = $("#coding-guide-toggle");
const codingWinOverlay = $("#coding-win-overlay");
const codingWinStars = $("#coding-win-stars");
const codingWinText = $("#coding-win-text");

const levelInfo = {
  easy:   { rows:5, cols:5, min:5,  open:8, crate:false, max:18 },
  medium: { rows:6, cols:6, min:8,  open:5, crate:true,  max:25 },
  hard:   { rows:7, cols:7, min:11, open:3, crate:true,  max:32 }
};
const dirs = [[-1,0],[0,1],[1,0],[0,-1]];
let codingLevel = localStorage.getItem('codingLevel') || 'easy';
if (!levelInfo[codingLevel]) codingLevel = 'easy';
let codingGuideOn = localStorage.getItem('codingGuideOn') !== 'false';
let puzzle = null;
let program = [];
let selectedProgramIndex = null;
let insertIndex = null;
let running = false;
let token = 0;

const key = (r,c) => `${r},${c}`;
const info = () => levelInfo[codingLevel];
const inBounds = (r,c) => r >= 0 && r < info().rows && c >= 0 && c < info().cols;
const blocked = (r,c,p=puzzle) => p.obstacles.has(key(r,c));
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));

function stepState(st, cmd, p=puzzle){
  const s = {...st};
  if(cmd === 'left'){ s.dir = (s.dir + 3) % 4; return s; }
  if(cmd === 'right'){ s.dir = (s.dir + 1) % 4; return s; }
  if(cmd === 'action'){
    if(!info().crate) return {...s, invalid:true};
    if(!s.carrying && !s.delivered && s.row === p.crate.row && s.col === p.crate.col){ s.carrying=true; return s; }
    if(s.carrying && s.row === p.drop.row && s.col === p.drop.col){ s.carrying=false; s.delivered=true; return s; }
    return {...s, invalid:true};
  }
  const [dr,dc] = dirs[s.dir];
  const sign = cmd === 'back' ? -1 : 1;
  const nr = s.row + dr*sign, nc = s.col + dc*sign;
  if(!inBounds(nr,nc) || blocked(nr,nc,p)) return {...s, collision:true};
  s.row=nr; s.col=nc; return s;
}

function shortest(p){
  const start = {row:p.start.row,col:p.start.col,dir:0,carrying:false,delivered:!info().crate};
  const q=[{s:start,path:[]}], seen=new Set();
  const commands=['forward','back','left','right',...(info().crate?['action']:[])];
  while(q.length){
    const {s,path}=q.shift();
    const sk=`${s.row},${s.col},${s.dir},${+s.carrying},${+s.delivered}`;
    if(seen.has(sk)) continue;
    seen.add(sk);
    if(s.row===p.goal.row && s.col===p.goal.col && s.delivered) return path;
    for(const c of commands){
      const n=stepState(s,c,p);
      if(!n.collision && !n.invalid) q.push({s:n,path:[...path,c]});
    }
  }
  return null;
}

function makeRoute(start,goal,minCells){
  const path=[{...start}], visited=new Set([key(start.row,start.col)]);
  function dfs(r,c){
    if(r===goal.row && c===goal.col && path.length>=minCells) return true;
    const choices=[[-1,0],[0,1],[1,0],[0,-1]]
      .map(([dr,dc])=>({row:r+dr,col:c+dc}))
      .filter(n=>inBounds(n.row,n.col) && !visited.has(key(n.row,n.col)) && (n.row!==0 || (n.row===goal.row&&n.col===goal.col)))
      .sort(()=>Math.random()-.5);
    for(const n of choices){
      visited.add(key(n.row,n.col)); path.push(n);
      if(dfs(n.row,n.col)) return true;
      path.pop(); visited.delete(key(n.row,n.col));
    }
    return false;
  }
  return dfs(start.row,start.col) ? path : null;
}

function buildCandidate(){
  const I=info();
  const start={row:I.rows-1,col:Math.floor(Math.random()*I.cols)};
  const goal={row:0,col:Math.floor(Math.random()*I.cols)};
  const route=makeRoute(start,goal,I.min);
  if(!route) return null;
  const routeSet=new Set(route.map(x=>key(x.row,x.col)));
  const obstacles=new Set();
  for(let r=0;r<I.rows;r++) for(let c=0;c<I.cols;c++) if(!routeSet.has(key(r,c))) obstacles.add(key(r,c));
  [...obstacles].sort(()=>Math.random()-.5).slice(0,I.open).forEach(k=>obstacles.delete(k));
  const p={start,goal,obstacles};
  if(I.crate){
    const a=Math.max(1,Math.min(route.length-3,Math.floor(route.length*.3)));
    const b=Math.max(a+1,Math.min(route.length-2,Math.floor(route.length*.68)));
    p.crate={...route[a]}; p.drop={...route[b]};
  }
  const solution=shortest(p);
  if(!solution || solution.length>I.max) return null;
  p.solution=solution;
  return p;
}

function reset(render=true){
  puzzle.state={row:puzzle.start.row,col:puzzle.start.col,dir:0,carrying:false,delivered:!info().crate};
  if(render) renderBoard();
}

function clearProgramSelection(){
  selectedProgramIndex=null;
  insertIndex=null;
}

function newPuzzle(){
  token++; running=false; program=[]; clearProgramSelection(); puzzle=null;
  codingWinOverlay.classList.add('hidden');
  for(let i=0;i<500 && !puzzle;i++) puzzle=buildCandidate();
  if(!puzzle){
    const I=info();
    puzzle={start:{row:I.rows-1,col:0},goal:{row:0,col:I.cols-1},obstacles:new Set()};
    if(I.crate){ puzzle.crate={row:I.rows-2,col:0}; puzzle.drop={row:1,col:I.cols-1}; }
    puzzle.solution=shortest(puzzle)||[];
  }
  reset(false);
  codingStatus.className='coding-status';
  codingStatus.textContent=info().crate ? 'Deliver the crate, then reach the flag.' : 'Reach the flag.';
  renderBoard(); renderProgram(); setEnabled(true);
}

function forkliftSvg(){
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect class="forklift-outline" x="18" y="24" width="28" height="31" rx="4"/>
    <rect class="forklift-window" x="23" y="35" width="18" height="13" rx="2"/>
    <path class="forklift-mast" d="M20 23h24M23 23V15M41 23V15"/>
    <path class="forklift-forks" d="M23 15V5M41 15V5M23 5h5M41 5h-5"/>
    <rect class="forklift-wheel" x="13" y="30" width="5" height="12" rx="2"/>
    <rect class="forklift-wheel" x="46" y="30" width="5" height="12" rx="2"/>
    <path class="forklift-direction" d="M32 20V10M28 14l4-4 4 4"/>
  </svg>`;
}

function crateSvg(className='coding-crate'){
  return `<span class="${className}" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 9l10-5 10 5v14l-10 5-10-5V9Z M6 9l10 5 10-5M16 14v14M11 6.5l10 5"/></svg></span>`;
}

function dropSvg(){
  return `<span class="coding-drop" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M8 29v5h24v-5M12 29h16M20 5v18M14 17l6 6 6-6"/><rect x="13" y="25" width="14" height="8" rx="1"/></svg></span>`;
}

function commandSvg(cmd, actionKind='action'){
  if(cmd==='forward') return `<svg viewBox="0 0 32 32"><path d="M16 25V7M9 14l7-7 7 7"/></svg>`;
  if(cmd==='back') return `<svg viewBox="0 0 32 32"><path d="M16 7v18M9 18l7 7 7-7"/></svg>`;
  if(cmd==='left') return `<svg viewBox="0 0 32 32"><path d="M23 24a10 10 0 0 0-10-16M13 8l4-5M13 8l6 2"/></svg>`;
  if(cmd==='right') return `<svg viewBox="0 0 32 32"><path d="M9 24A10 10 0 0 1 19 8M19 8l-4-5M19 8l-6 2"/></svg>`;
  if(actionKind==='drop') return `<svg viewBox="0 0 32 32"><path d="M9 20h14v8H9zM12 20v-5h8v5M16 5v10M12 11l4 4 4-4"/></svg>`;
  return `<svg viewBox="0 0 32 32"><path d="M9 20h14v8H9zM12 20v-5h8v5M16 15V5M12 9l4-4 4 4"/></svg>`;
}

function actionKinds(){
  const kinds=[];
  let s={row:puzzle.start.row,col:puzzle.start.col,dir:0,carrying:false,delivered:!info().crate};
  for(const cmd of program){
    let kind='action';
    if(cmd==='action') kind=s.carrying?'drop':'pick';
    kinds.push(kind);
    const n=stepState(s,cmd);
    if(!n.collision&&!n.invalid) s=n;
  }
  return kinds;
}

function guidePreview(){
  if(!codingGuideOn || running || !program.length) return [];
  let s={row:puzzle.start.row,col:puzzle.start.col,dir:0,carrying:false,delivered:!info().crate};
  const marks=[];
  for(const cmd of program){
    const actionKind=cmd==='action'?(s.carrying?'drop':'pick'):null;
    const n=stepState(s,cmd);
    if(n.collision || n.invalid){ marks.push({row:s.row,col:s.col,dir:s.dir,cmd,actionKind,collision:true}); break; }
    s=n;
    marks.push({row:s.row,col:s.col,dir:s.dir,cmd,actionKind,collision:false});
  }
  return marks;
}

function addGuideMarker(cell, mark){
  const marker=document.createElement('span');
  marker.className='coding-guide-marker'+(mark.collision?' collision':'')+((mark.cmd==='left'||mark.cmd==='right')?' turn':'')+(mark.cmd==='action'?' action':'');
  const actionIcon=mark.cmd==='action' ? `<span class="coding-guide-action ${mark.actionKind}">${commandSvg('action',mark.actionKind)}</span>` : '';
  marker.innerHTML=`<span class="coding-guide-dot"></span><span class="coding-guide-arrow dir-${mark.dir}" style="--guide-rot:${mark.dir*90}deg"><span></span></span>${actionIcon}`;
  cell.appendChild(marker);
}

function renderBoard(){
  const I=info(), guide=guidePreview();
  codingBoard.style.setProperty('--coding-rows',I.rows);
  codingBoard.style.setProperty('--coding-cols',I.cols);
  codingBoard.innerHTML='';
  for(let r=0;r<I.rows;r++) for(let c=0;c<I.cols;c++){
    const el=document.createElement('div');
    el.className='grid-cell';
    if(puzzle.obstacles.has(key(r,c))) el.classList.add('obstacle');
    if(r===puzzle.start.row&&c===puzzle.start.col) el.classList.add('start-cell');
    if(r===puzzle.goal.row&&c===puzzle.goal.col){
      el.classList.add('goal-cell');
      el.innerHTML+='<span class="finish-mark"><svg viewBox="0 0 32 32"><path d="M8 28V5M9 6h14l-3 5 3 5H9"/></svg></span>';
    }
    if(info().crate){
      if(puzzle.state.delivered && r===puzzle.drop.row && c===puzzle.drop.col) el.innerHTML+=crateSvg('coding-crate delivered');
      else if(!puzzle.state.carrying && r===puzzle.crate.row && c===puzzle.crate.col) el.innerHTML+=crateSvg();
      if(r===puzzle.drop.row&&c===puzzle.drop.col) el.innerHTML+=dropSvg();
    }
    const mark=[...guide].reverse().find(m=>m.row===r&&m.col===c);
    if(mark) addGuideMarker(el,mark);
    codingBoard.appendChild(el);
  }
  const rover=document.createElement('div');
  rover.id='coding-rover'; rover.className='coding-forklift';
  rover.innerHTML=forkliftSvg()+(puzzle.state.carrying?crateSvg('carried-crate'):'');
  codingBoard.appendChild(rover);
  positionRover(false);
}

function positionRover(anim=true){
  const rover=$("#coding-rover"); if(!rover) return;
  rover.classList.toggle('animate',anim);
  const x=(puzzle.state.col+.5)*100/info().cols;
  const y=(puzzle.state.row+.5)*100/info().rows;
  rover.style.left=x+'%'; rover.style.top=y+'%';
  rover.style.transform=`translate(-50%,-50%) rotate(${puzzle.state.dir*90}deg)`;
}

function insertSlot(index){
  const b=document.createElement('button');
  b.type='button';
  b.className='program-insert-slot'+(insertIndex===index?' selected':'');
  b.dataset.insertIndex=index;
  b.setAttribute('aria-label',`Insert a command at position ${index+1}`);
  b.innerHTML='<span>+</span>';
  return b;
}

function renderProgram(active=-1,done=-1){
  if(selectedProgramIndex!==null && selectedProgramIndex>=program.length) selectedProgramIndex=program.length?program.length-1:null;
  if(insertIndex!==null && insertIndex>program.length) insertIndex=program.length;
  programCount.textContent=program.length;
  programTimeline.innerHTML='';
  const kinds=actionKinds();
  programTimeline.appendChild(insertSlot(0));
  if(!program.length){
    const empty=document.createElement('span'); empty.className='program-empty'; empty.textContent=''; programTimeline.appendChild(empty);
  }
  program.forEach((c,i)=>{
    const e=document.createElement('button');
    e.type='button'; e.className='program-step'; e.dataset.programIndex=i;
    e.setAttribute('aria-label',`Command ${i+1}: ${c}`);
    e.innerHTML=commandSvg(c,kinds[i]);
    if(i===active)e.classList.add('running'); else if(i<=done)e.classList.add('done');
    if(i===selectedProgramIndex)e.classList.add('selected');
    programTimeline.appendChild(e);
    programTimeline.appendChild(insertSlot(i+1));
  });
  if(programEditor){
    programEditor.hidden=selectedProgramIndex===null || running;
    if(selectedProgramIndex!==null){
      programMoveLeft.disabled=selectedProgramIndex<=0;
      programMoveRight.disabled=selectedProgramIndex>=program.length-1;
      programDelete.disabled=false;
    }
  }
  if(!running) renderBoard();
}

function add(c){
  if(running||program.length>=32)return;
  if(insertIndex!==null){
    program.splice(insertIndex,0,c);
    selectedProgramIndex=insertIndex;
    insertIndex=null;
  } else {
    program.push(c);
    selectedProgramIndex=program.length-1;
  }
  renderProgram();
}

function deleteSelected(){
  if(running||selectedProgramIndex===null)return;
  program.splice(selectedProgramIndex,1);
  if(!program.length) selectedProgramIndex=null;
  else selectedProgramIndex=Math.min(selectedProgramIndex,program.length-1);
  insertIndex=null;
  renderProgram();
}

function moveSelected(delta){
  if(running||selectedProgramIndex===null)return;
  const next=selectedProgramIndex+delta;
  if(next<0||next>=program.length)return;
  [program[selectedProgramIndex],program[next]]=[program[next],program[selectedProgramIndex]];
  selectedProgramIndex=next; insertIndex=null; renderProgram();
}

function setEnabled(v){
  commandButtons.forEach(b=>{b.disabled=!v; b.hidden=(b.dataset.command==='action'&&!info().crate)});
  [codingUndo,codingClear,codingRun,newCodingPuzzle,...codingLevelButtons].forEach(b=>b.disabled=!v);
  if(codingGuideToggle) codingGuideToggle.disabled=!v;
  if(!v && programEditor) programEditor.hidden=true;
}

async function run(){
  if(running||!program.length)return;
  clearProgramSelection();
  running=true; const t=++token; setEnabled(false); reset(false); renderBoard();
  let done=-1;
  for(let i=0;i<program.length;i++){
    if(t!==token)return;
    renderProgram(i,done);
    const c=program[i], n=stepState(puzzle.state,c);
    if(n.collision||n.invalid){
      codingStatus.textContent=n.collision?'The forklift cannot drive there.':'Pick up or drop on the marked square.';
      await wait(500); running=false; reset(); renderProgram(); setEnabled(true); return;
    }
    puzzle.state=n;
    if(c==='left'||c==='right'){ positionRover(true); await wait(480); }
    else if(c==='action'){ renderBoard(); await wait(480); }
    else { positionRover(true); await wait(600); }
    done=i;
    if(puzzle.state.row===puzzle.goal.row&&puzzle.state.col===puzzle.goal.col&&puzzle.state.delivered){ finish(i+1); return; }
  }
  renderProgram(-1,done);
  codingStatus.textContent=info().crate&&!puzzle.state.delivered?'The crate still needs delivering.':'Not at the flag yet.';
  await wait(450); running=false; reset(); renderProgram(); setEnabled(true);
}

function finish(used){
  running=false; renderProgram(-1,used-1); codingStatus.textContent='Challenge complete!';
  const extra=used-puzzle.solution.length, stars=extra<=1?3:extra<=4?2:1;
  codingWinStars.textContent='★'.repeat(stars)+'☆'.repeat(3-stars);
  codingWinText.textContent=extra<=0?'Perfect program!':`${used} commands`;
  codingWinOverlay.classList.remove('hidden'); setEnabled(true);
}

function bindPress(el,fn){
  if(!el) return;
  let lastPointer=0;
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    lastPointer=performance.now();
    e.preventDefault();
    if(!el.disabled) fn(e);
  });
  el.addEventListener('click',e=>{
    if(performance.now()-lastPointer<600){ e.preventDefault(); return; }
    if(!el.disabled) fn(e);
  });
}

function handleTimelineTarget(target){
  const step=target.closest('[data-program-index]');
  if(step){
    const i=Number(step.dataset.programIndex);
    selectedProgramIndex=selectedProgramIndex===i?null:i;
    insertIndex=null;
    renderProgram();
    return;
  }
  const slot=target.closest('[data-insert-index]');
  if(slot){
    const i=Number(slot.dataset.insertIndex);
    insertIndex=insertIndex===i?null:i;
    selectedProgramIndex=null;
    renderProgram();
  }
}
let timelinePointer=0;
programTimeline.addEventListener('pointerdown',e=>{
  if(running)return;
  if(!e.target.closest('[data-program-index],[data-insert-index]')) return;
  timelinePointer=performance.now(); e.preventDefault(); handleTimelineTarget(e.target);
});
programTimeline.addEventListener('click',e=>{
  if(performance.now()-timelinePointer<600){e.preventDefault();return;}
  if(!running) handleTimelineTarget(e.target);
});

commandButtons.forEach(b=>bindPress(b,()=>add(b.dataset.command)));
bindPress(programMoveLeft,()=>moveSelected(-1));
bindPress(programDelete,deleteSelected);
bindPress(programMoveRight,()=>moveSelected(1));
bindPress(codingUndo,()=>{if(!running){program.pop();clearProgramSelection();renderProgram();}});
bindPress(codingClear,()=>{if(!running){program=[];clearProgramSelection();reset(false);renderProgram();}});
bindPress(codingRun,run);
bindPress(newCodingPuzzle,newPuzzle);
codingLevelButtons.forEach(b=>bindPress(b,()=>{
  if(running)return;
  codingLevel=b.dataset.codingLevel;
  localStorage.setItem('codingLevel',codingLevel);
  codingLevelButtons.forEach(x=>x.classList.toggle('active',x===b));
  newPuzzle();
}));
if(codingGuideToggle){
  codingGuideToggle.checked=codingGuideOn;
  codingGuideToggle.addEventListener('change',()=>{
    codingGuideOn=codingGuideToggle.checked;
    localStorage.setItem('codingGuideOn',codingGuideOn?'true':'false');
    renderBoard();
  });
}
codingLevelButtons.forEach(b=>b.classList.toggle('active',b.dataset.codingLevel===codingLevel));
newPuzzle();
