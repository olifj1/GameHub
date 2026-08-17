const codingBoard = $("#coding-board");
const codingStatus = $("#coding-status");
const codingLevelButtons = $$('[data-coding-level]');
const commandButtons = $$('[data-command]');
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

const levelInfo = {
  easy:   { rows:5, cols:5, min:5,  open:8, crate:false, max:18 },
  medium: { rows:6, cols:6, min:8,  open:5, crate:true,  max:25 },
  hard:   { rows:7, cols:7, min:11, open:3, crate:true,  max:32 }
};
const dirs = [[-1,0],[0,1],[1,0],[0,-1]];
const glyph = { forward:'↑', back:'↓', left:'↶', right:'↷', action:'▣' };
let codingLevel = localStorage.getItem('codingLevel') || 'easy';
if (!levelInfo[codingLevel]) codingLevel = 'easy';
let codingGuideOn = localStorage.getItem('codingGuideOn') !== 'false';
let puzzle = null;
let program = [];
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

function newPuzzle(){
  token++; running=false; program=[]; puzzle=null;
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
    <rect class="forklift-body" x="15" y="21" width="34" height="30" rx="7"/>
    <rect class="forklift-cab" x="21" y="28" width="20" height="15" rx="3"/>
    <rect class="forklift-wheel" x="10" y="27" width="7" height="13" rx="3"/>
    <rect class="forklift-wheel" x="47" y="27" width="7" height="13" rx="3"/>
    <path d="M22 21V12M42 21V12M22 12h20M25 8v8M39 8v8"/>
    <path d="M25 8h-8M39 8h8"/>
    <path class="forklift-facing" d="M32 17l-6 8h12z"/>
  </svg>`;
}

function guidePreview(){
  if(!codingGuideOn || running || !program.length) return [];
  let s={row:puzzle.start.row,col:puzzle.start.col,dir:0,carrying:false,delivered:!info().crate};
  const marks=[];
  for(const cmd of program){
    const n=stepState(s,cmd);
    if(n.collision || n.invalid){ marks.push({row:s.row,col:s.col,dir:s.dir,collision:true}); break; }
    s=n;
    marks.push({row:s.row,col:s.col,dir:s.dir,collision:false});
  }
  return marks;
}

function addGuideMarker(cell, mark){
  const marker=document.createElement('span');
  marker.className='coding-guide-marker'+(mark.collision?' collision':'');
  marker.innerHTML=`<span class="coding-guide-dot"></span><span class="coding-guide-arrow" style="--guide-rot:${mark.dir*90}deg"></span>`;
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
    if(r===puzzle.start.row&&c===puzzle.start.col){
      el.classList.add('start-cell');
      el.innerHTML+='<span class="coding-start-label">START</span>';
    }
    if(r===puzzle.goal.row&&c===puzzle.goal.col){
      el.classList.add('goal-cell');
      el.innerHTML+='<span class="finish-mark"><svg viewBox="0 0 32 32"><path d="M8 28V5M9 6h14l-3 5 3 5H9"/></svg></span>';
    }
    if(info().crate&&!puzzle.state.delivered&&!puzzle.state.carrying&&r===puzzle.crate.row&&c===puzzle.crate.col) el.innerHTML+='<span class="coding-crate"></span>';
    if(info().crate&&r===puzzle.drop.row&&c===puzzle.drop.col) el.innerHTML+='<span class="coding-drop"></span><span class="coding-drop-label">DROP</span>';
    const mark=[...guide].reverse().find(m=>m.row===r&&m.col===c);
    if(mark) addGuideMarker(el,mark);
    codingBoard.appendChild(el);
  }
  const rover=document.createElement('div');
  rover.id='coding-rover'; rover.className='coding-forklift';
  rover.innerHTML=forkliftSvg()+(puzzle.state.carrying?'<span class="carried-crate"></span>':'');
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

function renderProgram(active=-1,done=-1){
  programCount.textContent=program.length;
  programTimeline.innerHTML='';
  if(!program.length){ programTimeline.innerHTML='<span class="program-empty">Tap a command below</span>'; renderBoard(); return; }
  program.forEach((c,i)=>{
    const e=document.createElement('span'); e.className='program-step'; e.textContent=glyph[c];
    if(i===active)e.classList.add('running'); else if(i<=done)e.classList.add('done');
    programTimeline.appendChild(e);
  });
  if(!running) renderBoard();
}

function add(c){
  if(running||program.length>=32)return;
  program.push(c); renderProgram();
}
function setEnabled(v){
  commandButtons.forEach(b=>{b.disabled=!v; b.hidden=(b.dataset.command==='action'&&!info().crate)});
  [codingUndo,codingClear,codingRun,newCodingPuzzle,...codingLevelButtons].forEach(b=>b.disabled=!v);
  if(codingGuideToggle) codingGuideToggle.disabled=!v;
}

async function run(){
  if(running||!program.length)return;
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

// Use pointerdown on touch devices so the global iOS double-tap guard cannot swallow
// a quick command -> Run / Undo / Clear press. Click remains as keyboard/mouse fallback.
function bindPress(el,fn){
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

commandButtons.forEach(b=>bindPress(b,()=>add(b.dataset.command)));
bindPress(codingUndo,()=>{if(!running){program.pop();renderProgram();}});
bindPress(codingClear,()=>{if(!running){program=[];reset(false);renderProgram();}});
bindPress(codingRun,run);
bindPress(newCodingPuzzle,()=>newPuzzle());
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
