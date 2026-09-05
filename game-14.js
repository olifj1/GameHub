(() => {
  const planEl = document.getElementById("attack-plan");
  const battleEl = document.getElementById("attack-battle");
  const rosterEl = document.getElementById("attack-roster-grid");
  const loadoutEl = document.getElementById("attack-loadout-slots");
  const deployBarEl = document.getElementById("attack-deploy-bar");
  const clearSlotBtn = document.getElementById("attack-clear-slot");
  const sendBtn = document.getElementById("attack-send");
  const sendLabel = document.getElementById("attack-send-label");
  const planNoteEl = document.getElementById("attack-plan-note");
  const cashEl = document.getElementById("attack-cash");
  const incomeEl = document.getElementById("attack-income");
  const yourBaseEl = document.getElementById("attack-your-base");
  const enemyBaseEl = document.getElementById("attack-enemy-base");
  const battleCashEl = document.getElementById("attack-battle-cash");
  const battleIncomeEl = document.getElementById("attack-battle-income");
  const battleYourBaseEl = document.getElementById("attack-battle-your-base");
  const battleEnemyBaseEl = document.getElementById("attack-battle-enemy-base");
  const battleStatusEl = document.getElementById("attack-battle-status");
  const miniStatsEl = document.getElementById("attack-mini-stats");
  const speedBtn = document.getElementById("attack-speed");
  const pauseBtn = document.getElementById("attack-pause");
  const canvas = document.getElementById("attack-canvas");
  const stageWrap = document.getElementById("attack-stage-wrap");
  const ctx = canvas.getContext("2d");

  const WORLD = { width: 660, height: 1120 };
  const START_CASH = 120;
  const START_BASE = 20;
  const INCOME_PER_SECOND = 3;
  const PLAYER = "player";
  const ENEMY = "enemy";
  const TEAM = {
    player: { main: "#4f847b", dark: "#365f59", pale: "#b9d6d0" },
    enemy: { main: "#b36f45", dark: "#75472f", pale: "#e2b79d" }
  };

  const ITEMS = {
    scout: { id:"scout", kind:"attack", name:"Scout", cost:28, hp:30, speed:104, armour:0, attack:0, range:0, fireRate:0, baseDamage:1, behavior:"run", meta:"Fast · avoids fights" },
    gunbuggy: { id:"gunbuggy", kind:"attack", name:"Gun Buggy", cost:68, hp:58, speed:74, armour:1, attack:10, range:92, fireRate:.72, baseDamage:2, behavior:"fight", meta:"Mobile · stops to fight" },
    tank: { id:"tank", kind:"attack", name:"Tank", cost:125, hp:125, speed:50, armour:4, attack:21, range:104, fireRate:1.08, baseDamage:3, behavior:"fight", meta:"Heavy · strong armour" },
    lightturret: { id:"lightturret", kind:"defence", name:"Light Turret", cost:38, hp:72, armour:0, attack:8, range:126, fireRate:.82, meta:"Cheap · general defence" },
    cannon: { id:"cannon", kind:"defence", name:"Cannon", cost:82, hp:108, armour:2, attack:19, range:148, fireRate:1.28, meta:"Slow · heavy hit" },
    rapid: { id:"rapid", kind:"defence", name:"Rapid Gun", cost:112, hp:94, armour:1, attack:6, range:118, fireRate:.31, meta:"Fast · good vs light units" }
  };

  const ROUTE_COMMANDS = [
    [
      ["M",136,1060],["C",100,980,88,900,126,818],["C",165,735,84,653,96,558],
      ["C",108,463,193,389,171,310],["C",150,232,114,169,132,68]
    ],
    [
      ["M",272,1060],["C",244,972,224,877,255,792],["C",288,706,337,640,338,560],
      ["C",339,475,276,405,258,324],["C",242,242,286,176,278,68]
    ],
    [
      ["M",388,1060],["C",418,973,438,880,407,794],["C",377,708,327,643,326,563],
      ["C",324,476,386,404,404,324],["C",421,242,378,174,386,68]
    ],
    [
      ["M",524,1060],["C",558,978,579,890,546,804],["C",514,718,579,648,570,556],
      ["C",561,467,492,392,506,314],["C",520,230,551,165,526,68]
    ]
  ];

  const routes = ROUTE_COMMANDS.map(commands => buildRoute(commands, 9));
  const routeStarts = routes.map(route => pointAtDistance(route, 0));
  const routeEnds = routes.map(route => pointAtDistance(route, route.length));

  const placementNodes = buildPlacementNodes();
  const environment = makeEnvironment(185);

  const state = {
    playerCash: START_CASH,
    enemyCash: START_CASH,
    playerBase: START_BASE,
    enemyBase: START_BASE,
    selectedSlot: 0,
    loadout: ["scout", "lightturret", "gunbuggy", "cannon"],
    started: false,
    gameOver: false
  };

  const battle = {
    units: [], turrets: [], shots: [], effects: [],
    nextUnitId: 1, nextTurretId: 1,
    aiTimer: 1.5,
    drag: null, armedSlot: null,
    hoverRoute: null, hoverNode: null,
    elapsed: 0,
    lastPlayerRoute: null
  };

  let running = false;
  let speedMultiplier = 1;
  let lastFrame = performance.now();
  let animationFrame = 0;

  const staticLayer = document.createElement("canvas");
  staticLayer.width = WORLD.width;
  staticLayer.height = WORLD.height;
  const staticCtx = staticLayer.getContext("2d");
  renderStaticLayer();

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
  function seededRandom(seed){ let x=seed>>>0; return ()=>{ x=(1664525*x+1013904223)>>>0; return x/4294967296; }; }
  function money(v){ return `£${Math.floor(Math.max(0,v))}`; }
  function angleApproach(current,target,amount){
    let d=((target-current+Math.PI)%(Math.PI*2))-Math.PI;
    return current+d*clamp(amount,0,1);
  }

  function cubic(p0,p1,p2,p3,t){
    const it=1-t;
    return {x:it**3*p0.x+3*it**2*t*p1.x+3*it*t**2*p2.x+t**3*p3.x,
            y:it**3*p0.y+3*it**2*t*p1.y+3*it*t**2*p2.y+t**3*p3.y};
  }

  function buildRoute(commands,samplesPerCurve){
    const points=[]; let current=null;
    commands.forEach(c=>{
      if(c[0]==="M"){
        current={x:c[1],y:c[2]}; points.push({...current});
      } else if(c[0]==="C"){
        const p1={x:c[1],y:c[2]},p2={x:c[3],y:c[4]},p3={x:c[5],y:c[6]};
        const approx=dist(current,p1)+dist(p1,p2)+dist(p2,p3);
        const steps=Math.max(samplesPerCurve,Math.ceil(approx/15));
        for(let i=1;i<=steps;i++) points.push(cubic(current,p1,p2,p3,i/steps));
        current=p3;
      }
    });
    let total=0; points[0].d=0;
    for(let i=1;i<points.length;i++){ total+=dist(points[i-1],points[i]); points[i].d=total; }
    return {points,length:total};
  }

  function pointAtDistance(route,distanceValue){
    const pts=route.points;
    if(distanceValue<=0){ const a=pts[0],b=pts[1]; return {x:a.x,y:a.y,heading:Math.atan2(b.y-a.y,b.x-a.x)}; }
    if(distanceValue>=route.length){ const a=pts[pts.length-2],b=pts[pts.length-1]; return {x:b.x,y:b.y,heading:Math.atan2(b.y-a.y,b.x-a.x)}; }
    let lo=1,hi=pts.length-1;
    while(lo<hi){ const mid=(lo+hi)>>1; if(pts[mid].d<distanceValue) lo=mid+1; else hi=mid; }
    const b=pts[lo],a=pts[lo-1],span=Math.max(.001,b.d-a.d),t=(distanceValue-a.d)/span;
    return {x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),heading:Math.atan2(b.y-a.y,b.x-a.x)};
  }

  function distanceToRoute(x,y,route){
    let best=Infinity;
    for(let i=0;i<route.points.length;i+=4){ const p=route.points[i]; best=Math.min(best,Math.hypot(x-p.x,y-p.y)); }
    return best;
  }

  function buildPlacementNodes(){
    const defs=[];
    const fractionsPlayer=[.15,.27,.37];
    const fractionsEnemy=[.63,.73,.85];
    routes.forEach((route,ri)=>{
      const baseOffset = (ri===1||ri===2) ? 96 : 88;
      fractionsPlayer.forEach((f,idx)=>defs.push(makeNode(route,ri,f,idx%2===0?-1:1,baseOffset,PLAYER)));
      fractionsEnemy.forEach((f,idx)=>defs.push(makeNode(route,ri,f,idx%2===0?1:-1,baseOffset,ENEMY)));
    });
    return defs.map((n,i)=>spreadNode({...n,id:`p${i}`}));
  }

  function makeNode(route,routeIndex,fraction,side,offset,team){
    const p=pointAtDistance(route,route.length*fraction);
    const nx=-Math.sin(p.heading),ny=Math.cos(p.heading);
    return {routeIndex,fraction,team,x:p.x+nx*offset*side,y:p.y+ny*offset*side,ox:nx*side,oy:ny*side,occupiedBy:null};
  }

  function spreadNode(node){
    for(let attempt=0; attempt<6; attempt++){
      let tooClose=false;
      for(let i=0;i<routes.length;i++){
        if(i===node.routeIndex) continue;
        if(distanceToRoute(node.x,node.y,routes[i]) < 60){ tooClose=true; break; }
      }
      if(!tooClose) break;
      node.x += node.ox * 12;
      node.y += node.oy * 12;
    }
    return node;
  }

  function makeEnvironment(seed){
    const r=seededRandom(seed),trees=[],rocks=[],scrub=[],patches=[],structures=[],pebbles=[];
    for(let i=0;i<42;i++) patches.push({x:r()*WORLD.width,y:r()*WORLD.height,rx:80+r()*150,ry:60+r()*125,a:.03+r()*.05,v:r(),rot:r()*Math.PI*2});
    for(let i=0;i<130;i++){
      const x=18+r()*(WORLD.width-36),y=28+r()*(WORLD.height-56);
      if(routes.every(route=>distanceToRoute(x,y,route)>42) && placementNodes.every(n=>Math.hypot(n.x-x,n.y-y)>36)) trees.push({x,y,r:10+r()*16,v:r(),rot:r()*6.28});
    }
    for(let i=0;i<56;i++){
      const x=18+r()*(WORLD.width-36),y=28+r()*(WORLD.height-56);
      if(routes.every(route=>distanceToRoute(x,y,route)>34)) rocks.push({x,y,r:6+r()*13,v:r(),rot:r()*6.28});
    }
    for(let i=0;i<180;i++) scrub.push({x:r()*WORLD.width,y:r()*WORLD.height,r:1+r()*2.8,v:r()});
    for(let i=0;i<170;i++) pebbles.push({x:r()*WORLD.width,y:r()*WORLD.height,r:.6+r()*1.6,v:r()});
    structures.push(
      {x:72,y:800,w:60,h:38,rot:-.16,type:"ruin"},
      {x:566,y:820,w:58,h:35,rot:-.1,type:"relay"},
      {x:80,y:312,w:52,h:35,rot:.08,type:"ruin"},
      {x:563,y:342,w:61,h:39,rot:.12,type:"relay"},
      {x:212,y:610,w:38,h:30,rot:-.08,type:"hut"},
      {x:456,y:960,w:42,h:30,rot:.06,type:"hut"}
    );
    return {trees,rocks,scrub,patches,structures,pebbles};
  }

  function itemSvg(item,team=PLAYER){
    const c=TEAM[team];
    if(item.kind==="defence"){
      const twin=item.id==="rapid";
      return `<svg viewBox="0 0 40 48" aria-hidden="true"><ellipse cx="20" cy="37" rx="14" ry="7" fill="#d8c6aa"/><circle cx="20" cy="31" r="11" fill="${c.dark}"/><circle cx="20" cy="30" r="7" fill="${c.main}"/><rect x="18" y="7" width="4" height="20" rx="2" fill="#45484a"/>${twin?'<rect x="12" y="10" width="4" height="17" rx="2" fill="#45484a"/><rect x="24" y="10" width="4" height="17" rx="2" fill="#45484a"/>':''}<circle cx="20" cy="28" r="3" fill="${c.pale}"/></svg>`;
    }
    if(item.id==="tank") return `<svg viewBox="0 0 40 58" aria-hidden="true"><rect x="7" y="9" width="7" height="40" rx="3" fill="#34383a"/><rect x="26" y="9" width="7" height="40" rx="3" fill="#34383a"/><rect x="11" y="7" width="18" height="44" rx="6" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><circle cx="20" cy="27" r="7" fill="${c.dark}"/><rect x="18" y="1" width="4" height="24" rx="2" fill="#383c3e"/><rect x="14" y="38" width="12" height="7" rx="2" fill="${c.pale}" opacity=".65"/></svg>`;
    return `<svg viewBox="0 0 40 58" aria-hidden="true"><circle cx="8" cy="14" r="4" fill="#323638"/><circle cx="32" cy="14" r="4" fill="#323638"/><circle cx="8" cy="44" r="4" fill="#323638"/><circle cx="32" cy="44" r="4" fill="#323638"/><rect x="10" y="5" width="20" height="48" rx="7" fill="${c.main}" stroke="${c.dark}" stroke-width="2"/><rect x="14" y="13" width="12" height="14" rx="3" fill="${c.pale}" opacity=".7"/>${item.attack?'<circle cx="20" cy="35" r="5" fill="#414547"/><rect x="18.5" y="25" width="3" height="12" rx="1.5" fill="#414547"/>':''}</svg>`;
  }

  function renderPlan(){
    cashEl.textContent=money(state.playerCash); incomeEl.textContent=`+£${INCOME_PER_SECOND}/s`;
    yourBaseEl.textContent=Math.max(0,state.playerBase); enemyBaseEl.textContent=Math.max(0,state.enemyBase);
    sendLabel.textContent=state.started?"RETURN TO BATTLE":"START BATTLE";
    clearSlotBtn.disabled=!state.loadout[state.selectedSlot];
    loadoutEl.innerHTML=state.loadout.map((id,index)=>{
      const item=id?ITEMS[id]:null,active=index===state.selectedSlot;
      return `<button type="button" class="attack-loadout-slot ${active?"active":""} ${item?"":"empty"}" data-loadout-slot="${index}"><span class="attack-slot-number">${index+1}</span><span class="attack-slot-icon">${item?itemSvg(item):"+"}</span><span class="attack-slot-copy"><strong>${item?item.name:"Empty"}</strong><small>${item?`${item.kind==="attack"?"Attack":"Defence"} · £${item.cost}`:"Tap then choose"}</small></span></button>`;
    }).join("");
    rosterEl.innerHTML=Object.values(ITEMS).map(item=>{
      const assigned=state.loadout[state.selectedSlot]===item.id;
      const affordable=state.playerCash>=item.cost;
      return `<button type="button" class="attack-roster-card ${assigned?"assigned":""} ${affordable?"":"unaffordable"}" data-assign-item="${item.id}"><span class="attack-roster-kind ${item.kind}">${item.kind==="attack"?"ATTACK":"DEFENCE"}</span><span class="attack-vehicle-icon">${itemSvg(item)}</span><span class="attack-roster-copy"><strong>${item.name}</strong><small>${item.meta}</small></span><span class="attack-vehicle-price">£${item.cost}</span></button>`;
    }).join("");
  }

  function renderBattleHud(){
    battleCashEl.textContent=money(state.playerCash); battleIncomeEl.textContent=`+£${INCOME_PER_SECOND}/s`;
    battleYourBaseEl.textContent=Math.max(0,state.playerBase); battleEnemyBaseEl.textContent=Math.max(0,state.enemyBase);
    const playerUnits=battle.units.filter(u=>u.team===PLAYER&&!u.dead).length;
    const playerDef=battle.turrets.filter(t=>t.team===PLAYER&&!t.dead).length;
    miniStatsEl.textContent=`${playerUnits} units · ${playerDef} defences`;
  }

  function renderDeployBar(){
    deployBarEl.innerHTML=state.loadout.map((id,index)=>{
      const item=id?ITEMS[id]:null,affordable=item&&state.playerCash>=item.cost;
      const armed=battle.armedSlot===index;
      return `<button type="button" class="attack-deploy-button ${item?`kind-${item.kind}`:"empty"} ${affordable?"":"unaffordable"} ${armed?"armed":""}" data-deploy-slot="${index}" ${item?"":"disabled"}><span class="attack-deploy-number">${index+1}</span><span class="attack-deploy-icon">${item?itemSvg(item):"+"}</span><span class="attack-deploy-copy"><strong>${item?item.name:"Empty"}</strong><small>${item?`£${item.cost} · ${item.kind==="attack"?"drag to route":"drag to point"}`:"Assign in Command"}</small></span></button>`;
    }).join("");
    deployBarEl.querySelectorAll("[data-deploy-slot]").forEach(btn=>{
      const index=Number(btn.dataset.deploySlot);
      btn.addEventListener("pointerdown",e=>beginDrag(index,e));
      btn.addEventListener("click",e=>{ if(e.detail===0) armSlot(index); });
    });
  }

  function openBattle(){
    state.started=true; planEl.hidden=true; battleEl.hidden=false; running=true; battle.armedSlot=null; planNoteEl.textContent="Battle paused. Remap any quick button, then return when ready.";
    resizeBattleLayout();
    requestAnimationFrame(resizeBattleLayout);
    lastFrame=performance.now(); renderDeployBar(); renderBattleHud(); drawBattle();
  }

  function openCommand(){
    running=false; cancelDrag(); planEl.hidden=false; battleEl.hidden=true; renderPlan();
  }

  function resizeBattleLayout(){
    if(battleEl.hidden) return;
    const page = document.querySelector('.attack-page');
    if(!page) return;
    const battleRect = battleEl.getBoundingClientRect();
    const hudH = document.querySelector('.attack-battle-hud')?.offsetHeight || 0;
    const statusH = document.querySelector('.attack-battle-status-row')?.offsetHeight || 0;
    const deployH = deployBarEl.offsetHeight || 0;
    const footerH = document.querySelector('.attack-battle-footer')?.offsetHeight || 0;
    const gaps = 28;
    const availableH = Math.max(260, battleRect.height - hudH - statusH - deployH - footerH - gaps);
    const widthFromHeight = availableH * WORLD.width / WORLD.height;
    const pageInnerWidth = Math.min((page.clientWidth || 0), window.innerWidth - 24);
    const width = Math.max(250, Math.min(pageInnerWidth, 404, widthFromHeight));
    stageWrap.style.width = `${width}px`;
  }

  function armSlot(index){
    const id=state.loadout[index],item=id?ITEMS[id]:null;
    if(!item) return;
    battle.armedSlot=index;
    battle.hoverRoute=null; battle.hoverNode=null;
    battleStatusEl.textContent=item.kind==="attack"?`Button ${index+1}: drag or tap one of the four routes.`:`Button ${index+1}: drag or tap a highlighted emplacement.`;
    renderDeployBar(); drawBattle();
  }

  function beginDrag(index,e){
    if(!running || state.gameOver) return;
    const id=state.loadout[index],item=id?ITEMS[id]:null;
    if(!item) return;
    if(state.playerCash<item.cost){ battleStatusEl.textContent=`Need ${money(item.cost-state.playerCash)} more for ${item.name}.`; return; }
    e.preventDefault();
    const ghost=document.createElement("div"); ghost.className=`attack-drag-ghost ${item.kind}`; ghost.innerHTML=`${itemSvg(item)}<span>${item.name}</span>`; document.body.appendChild(ghost);
    battle.drag={index,item,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,moved:false,ghost};
    moveGhost(e.clientX,e.clientY); updateDragHover(e.clientX,e.clientY);
    battleStatusEl.textContent=item.kind==="attack"?"Drop onto a highlighted route.":"Drop onto a highlighted defence point.";
    drawBattle();
  }

  function moveGhost(x,y){
    if(!battle.drag) return; battle.drag.x=x; battle.drag.y=y;
    battle.drag.ghost.style.transform=`translate(${x-37}px,${y-94}px)`;
  }

  function updateDragHover(clientX,clientY){
    if(!battle.drag) return;
    const local=clientToCanvas(clientX,clientY);
    battle.hoverRoute=null; battle.hoverNode=null;
    if(!local) return;
    if(battle.drag.item.kind==="attack"){
      let best=-1,bestD=Infinity;
      routes.forEach((route,i)=>{ const d=distanceToRoute(local.x,local.y,route); if(d<bestD){bestD=d;best=i;} });
      if(bestD<82) battle.hoverRoute=best;
    } else {
      let best=null,bestD=Infinity;
      placementNodes.filter(n=>n.team===PLAYER&&!n.occupiedBy).forEach(n=>{ const d=Math.hypot(local.x-n.x,local.y-n.y); if(d<bestD){bestD=d;best=n;} });
      if(best && bestD<82) battle.hoverNode=best.id;
    }
  }

  function onPointerMove(e){
    if(!battle.drag||e.pointerId!==battle.drag.pointerId) return;
    if(Math.hypot(e.clientX-battle.drag.startX,e.clientY-battle.drag.startY)>7) battle.drag.moved=true;
    moveGhost(e.clientX,e.clientY); updateDragHover(e.clientX,e.clientY); drawBattle();
  }

  function onPointerUp(e){
    if(!battle.drag||e.pointerId!==battle.drag.pointerId) return;
    const drag=battle.drag,local=clientToCanvas(e.clientX,e.clientY);
    if(!drag.moved){ cancelDrag(); armSlot(drag.index); return; }
    if(local){
      if(drag.item.kind==="attack") tryDropAttack(drag.item,local);
      else tryDropDefence(drag.item,local);
    }
    cancelDrag();
  }

  function cancelDrag(){
    if(battle.drag?.ghost) battle.drag.ghost.remove(); battle.drag=null; battle.hoverRoute=null; battle.hoverNode=null; drawBattle();
  }

  function clientToCanvas(clientX,clientY){
    const r=canvas.getBoundingClientRect();
    if(clientX<r.left||clientX>r.right||clientY<r.top||clientY>r.bottom) return null;
    return {x:(clientX-r.left)*WORLD.width/r.width,y:(clientY-r.top)*WORLD.height/r.height};
  }

  function tryDropAttack(item,p){
    if(state.playerCash<item.cost) return;
    let best=-1,bestD=Infinity;
    routes.forEach((route,i)=>{ const d=distanceToRoute(p.x,p.y,route); if(d<bestD){bestD=d;best=i;} });
    if(bestD>62){ battleStatusEl.textContent="Drop onto one of the highlighted routes."; return; }
    deployUnit(PLAYER,item.id,best); state.playerCash-=item.cost; battle.armedSlot=null; battle.lastPlayerRoute=best;
    battleStatusEl.textContent=`${item.name} launched on Route ${best+1}.`; renderDeployBar(); renderBattleHud();
  }

  function tryDropDefence(item,p){
    if(state.playerCash<item.cost) return;
    const candidates=placementNodes.filter(n=>n.team===PLAYER&&!n.occupiedBy);
    let best=null,bestD=Infinity;
    candidates.forEach(n=>{ const d=Math.hypot(p.x-n.x,p.y-n.y); if(d<bestD){bestD=d;best=n;} });
    if(!best||bestD>65){ battleStatusEl.textContent="Drop onto one of the highlighted defence points."; return; }
    buildTurret(PLAYER,item.id,best); state.playerCash-=item.cost; battle.armedSlot=null;
    battleStatusEl.textContent=`${item.name} built.`; renderDeployBar(); renderBattleHud();
  }

  function deployUnit(team,itemId,routeIndex){
    const item=ITEMS[itemId],route=routes[routeIndex];
    battle.units.push({id:battle.nextUnitId++,team,itemId,routeIndex,progress:team===PLAYER?0:route.length,hp:item.hp,maxHp:item.hp,heading:team===PLAYER?-Math.PI/2:Math.PI/2,cooldown:.1+Math.random()*.3,dead:false,smoke:0});
  }

  function buildTurret(team,itemId,node){
    const item=ITEMS[itemId];
    const turret={id:battle.nextTurretId++,team,itemId,nodeId:node.id,x:node.x,y:node.y,hp:item.hp,maxHp:item.hp,heading:team===PLAYER?-Math.PI/2:Math.PI/2,cooldown:.2+Math.random()*.3,dead:false,recoil:0};
    battle.turrets.push(turret); node.occupiedBy=turret.id;
  }

  function update(dt){
    if(!running||state.gameOver) return;
    const step=dt*speedMultiplier;
    battle.elapsed+=step;
    state.playerCash+=INCOME_PER_SECOND*step; state.enemyCash+=INCOME_PER_SECOND*step;
    battle.aiTimer-=step;
    if(battle.aiTimer<=0){ aiDecision(); battle.aiTimer=.95+Math.random()*1.15; }

    battle.units.forEach(unit=>updateUnit(unit,step));
    battle.turrets.forEach(t=>updateTurret(t,step));
    battle.shots.forEach(s=>s.ttl-=step);
    battle.effects.forEach(e=>{e.ttl-=step;e.r+=step*16;});
    battle.shots=battle.shots.filter(s=>s.ttl>0);
    battle.effects=battle.effects.filter(e=>e.ttl>0);
    battle.units=battle.units.filter(u=>!u.dead);
    battle.turrets=battle.turrets.filter(t=>!t.dead);
    if(Math.floor(battle.elapsed*4)%2===0){ renderBattleHud(); renderDeployBar(); }
  }

  function updateUnit(unit,dt){
    if(unit.dead) return;
    const item=ITEMS[unit.itemId],route=routes[unit.routeIndex];
    let shouldMove=true;
    if(item.attack>0 && item.behavior==="fight"){
      const target=findUnitTarget(unit,item.range) || findTurretTarget(unit,item.range);
      if(target){
        shouldMove=false;
        unit.heading=angleApproach(unit.heading,Math.atan2(target.y-unitY(unit),target.x-unitX(unit)),dt*6);
        unit.cooldown-=dt;
        if(unit.cooldown<=0){ fire(unit,target,item.attack); unit.cooldown=item.fireRate; }
      }
    }
    if(shouldMove){
      const dir=unit.team===PLAYER?1:-1;
      unit.progress+=dir*item.speed*dt;
      const p=pointAtDistance(route,clamp(unit.progress,0,route.length));
      unit.heading=p.heading+(unit.team===PLAYER?0:Math.PI);
      if(unit.team===PLAYER&&unit.progress>=route.length) reachBase(unit,ENEMY);
      if(unit.team===ENEMY&&unit.progress<=0) reachBase(unit,PLAYER);
    }
    unit.cooldown=Math.max(-.2,unit.cooldown-dt*(shouldMove?1:0));
    if(unit.hp<unit.maxHp*.42) unit.smoke=Math.min(1,unit.smoke+dt*.8); else unit.smoke=Math.max(0,unit.smoke-dt);
  }

  function unitPoint(unit){ return pointAtDistance(routes[unit.routeIndex],clamp(unit.progress,0,routes[unit.routeIndex].length)); }
  function unitX(unit){ return unitPoint(unit).x; }
  function unitY(unit){ return unitPoint(unit).y; }

  function findUnitTarget(unit,range){
    const p=unitPoint(unit),enemyTeam=unit.team===PLAYER?ENEMY:PLAYER;
    let best=null,bestD=Infinity;
    battle.units.forEach(other=>{
      if(other.dead||other.team!==enemyTeam) return;
      const op=unitPoint(other),d=Math.hypot(p.x-op.x,p.y-op.y);
      if(d<range&&d<bestD){bestD=d;best={type:"unit",ref:other,x:op.x,y:op.y};}
    });
    return best;
  }

  function findTurretTarget(unit,range){
    const p=unitPoint(unit),enemyTeam=unit.team===PLAYER?ENEMY:PLAYER;
    let best=null,bestD=Infinity;
    battle.turrets.forEach(t=>{
      if(t.dead||t.team!==enemyTeam) return;
      const d=Math.hypot(p.x-t.x,p.y-t.y);
      if(d<range&&d<bestD){bestD=d;best={type:"turret",ref:t,x:t.x,y:t.y};}
    });
    return best;
  }

  function updateTurret(turret,dt){
    if(turret.dead) return;
    const item=ITEMS[turret.itemId];
    const target=findNearestEnemyUnit(turret,item.range);
    turret.recoil=Math.max(0,turret.recoil-dt*4); turret.cooldown-=dt;
    if(target){
      turret.heading=angleApproach(turret.heading,Math.atan2(target.y-turret.y,target.x-turret.x),dt*7);
      if(turret.cooldown<=0){ fire(turret,target,item.attack); turret.cooldown=item.fireRate; turret.recoil=1; }
    }
  }

  function findNearestEnemyUnit(turret,range){
    const enemyTeam=turret.team===PLAYER?ENEMY:PLAYER; let best=null,bestD=Infinity;
    battle.units.forEach(u=>{
      if(u.dead||u.team!==enemyTeam) return; const p=unitPoint(u),d=Math.hypot(p.x-turret.x,p.y-turret.y);
      if(d<range&&d<bestD){bestD=d;best={type:"unit",ref:u,x:p.x,y:p.y};}
    });
    return best;
  }

  function fire(source,target,damage){
    const from=source.routeIndex!==undefined?unitPoint(source):{x:source.x,y:source.y};
    battle.shots.push({x1:from.x,y1:from.y,x2:target.x,y2:target.y,team:source.team,ttl:.095});
    const ref=target.ref,profile=ITEMS[ref.itemId];
    const actual=Math.max(1,damage-(profile.armour||0)); ref.hp-=actual;
    battle.effects.push({x:target.x,y:target.y,r:2,ttl:.18,team:source.team,type:"hit"});
    if(ref.hp<=0&&!ref.dead) destroyEntity(ref,source.team);
  }

  function destroyEntity(entity,killerTeam){
    entity.dead=true; const profile=ITEMS[entity.itemId];
    const reward=Math.max(5,Math.round(profile.cost*(entity.routeIndex!==undefined?.24:.34)));
    if(killerTeam===PLAYER) state.playerCash+=reward; else state.enemyCash+=reward;
    if(entity.nodeId){ const node=placementNodes.find(n=>n.id===entity.nodeId); if(node) node.occupiedBy=null; }
    const p=entity.routeIndex!==undefined?unitPoint(entity):entity;
    battle.effects.push({x:p.x,y:p.y,r:8,ttl:.55,team:killerTeam,type:"boom"});
  }

  function reachBase(unit,targetTeam){
    const item=ITEMS[unit.itemId]; unit.dead=true;
    if(targetTeam===ENEMY){ state.enemyBase-=item.baseDamage; state.playerCash+=18+item.baseDamage*5; battleStatusEl.textContent=`${item.name} reached the enemy base!`; }
    else { state.playerBase-=item.baseDamage; state.enemyCash+=18+item.baseDamage*5; battleStatusEl.textContent=`Enemy ${item.name} reached your base.`; }
    checkGameOver();
  }

  function aiDecision(){
    if(state.gameOver) return;
    const emptyNodes=placementNodes.filter(n=>n.team===ENEMY&&!n.occupiedBy);
    const playerPressureByRoute = routeAttackStrength(PLAYER);
    const enemyPressureByRoute = routeAttackStrength(ENEMY);
    const enemyTurretsByRoute = routeTurretCounts(ENEMY);
    const playerTurretsByRoute = routeTurretCounts(PLAYER);
    const pressureTotal = playerPressureByRoute.reduce((a,b)=>a+b,0);
    const baseDanger = state.enemyBase < state.playerBase || pressureTotal > 2.8;
    const wantDefence = emptyNodes.length && (
      enemyTurretsByRoute.reduce((a,b)=>a+b,0) < 3 ||
      baseDanger ||
      playerPressureByRoute.some((v,i)=>v > enemyTurretsByRoute[i] + 1.2) ||
      Math.random() < .18
    );

    if(wantDefence){
      const choices=[ITEMS.lightturret,ITEMS.cannon,ITEMS.rapid].filter(i=>state.enemyCash>=i.cost);
      if(choices.length){
        const hotRoute = playerPressureByRoute.indexOf(Math.max(...playerPressureByRoute));
        let item = choices[0];
        if(state.enemyCash>=ITEMS.cannon.cost && playerPressureByRoute[hotRoute] > 1.6) item = ITEMS.cannon;
        else if(state.enemyCash>=ITEMS.rapid.cost && playerPressureByRoute[hotRoute] > 2.2) item = ITEMS.rapid;
        const node=chooseAiNode(emptyNodes, playerPressureByRoute, enemyTurretsByRoute);
        if(node){ buildTurret(ENEMY,item.id,node); state.enemyCash-=item.cost; return; }
      }
    }

    const attackChoices=[];
    if(state.enemyCash>=ITEMS.scout.cost) attackChoices.push(ITEMS.scout);
    if(state.enemyCash>=ITEMS.gunbuggy.cost&&battle.elapsed>10) attackChoices.push(ITEMS.gunbuggy);
    if(state.enemyCash>=ITEMS.tank.cost&&battle.elapsed>32) attackChoices.push(ITEMS.tank);
    if(!attackChoices.length) return;

    const routeIndex=chooseAiRoute(playerTurretsByRoute, playerPressureByRoute, enemyPressureByRoute);
    let item = ITEMS.scout;
    const routeThreat = playerTurretsByRoute[routeIndex] + playerPressureByRoute[routeIndex] * .5;
    if(state.enemyCash>=ITEMS.tank.cost && battle.elapsed>36 && routeThreat >= 2.2 && Math.random()<.55) item = ITEMS.tank;
    else if(state.enemyCash>=ITEMS.gunbuggy.cost && battle.elapsed>12 && (routeThreat >= 1.2 || Math.random()<.68)) item = ITEMS.gunbuggy;
    else if(state.enemyCash>=ITEMS.scout.cost) item = ITEMS.scout;
    deployUnit(ENEMY,item.id,routeIndex); state.enemyCash-=item.cost;
  }

  function routeAttackStrength(team){
    const arr=new Array(4).fill(0);
    battle.units.forEach(u=>{
      if(u.dead || u.team!==team) return;
      const item = ITEMS[u.itemId];
      arr[u.routeIndex] += item.id==="tank" ? 1.9 : item.id==="gunbuggy" ? 1.2 : .75;
    });
    return arr;
  }

  function routeTurretCounts(team){
    const arr=new Array(4).fill(0);
    battle.turrets.forEach(t=>{
      if(t.dead || t.team!==team) return;
      const node=placementNodes.find(n=>n.id===t.nodeId); if(node) arr[node.routeIndex] += (t.itemId==="cannon" ? 1.25 : t.itemId==="rapid" ? 1.1 : 1);
    });
    return arr;
  }

  function chooseAiNode(nodes, playerPressureByRoute, enemyTurretsByRoute){
    const sorted=[...nodes].sort((a,b)=>{
      const sa = playerPressureByRoute[a.routeIndex]*3 - enemyTurretsByRoute[a.routeIndex]*1.1 - a.fraction*2 + Math.random()*.45;
      const sb = playerPressureByRoute[b.routeIndex]*3 - enemyTurretsByRoute[b.routeIndex]*1.1 - b.fraction*2 + Math.random()*.45;
      return sb - sa;
    });
    return sorted[0];
  }

  function chooseAiRoute(playerTurretsByRoute, playerPressureByRoute, enemyPressureByRoute){
    const scores = [0,1,2,3].map(i=>{
      const followPlayer = battle.lastPlayerRoute===i ? .4 : 0;
      const score = (4 - playerTurretsByRoute[i]*1.3) - playerPressureByRoute[i]*.45 + enemyPressureByRoute[i]*.15 + followPlayer + Math.random()*.75;
      return {i,score};
    }).sort((a,b)=>b.score-a.score);
    return scores[0].i;
  }

  function checkGameOver(){
    if(state.enemyBase>0&&state.playerBase>0) return;
    state.gameOver=true; running=false; renderBattleHud(); renderDeployBar(); drawBattle();
    const won=state.enemyBase<=0;
    battleStatusEl.textContent=won?"Enemy base destroyed!":"Your base has fallen.";
    setTimeout(()=>{
      if(window.GameHubResults?.show){
        window.GameHubResults.show({gameId:"game-14",title:won?"Victory!":"Defeated",summary:won?"You broke through and destroyed the enemy base.":"The opposing force destroyed your base.",stars:won?3:1,metrics:[{label:"Time",value:`${Math.floor(battle.elapsed)}s`},{label:"Credits",value:money(state.playerCash)}],againLabel:"Play again",onAgain:resetGame,save:false});
      }
    },250);
  }

  function resetGame(){
    state.playerCash=START_CASH; state.enemyCash=START_CASH; state.playerBase=START_BASE; state.enemyBase=START_BASE; state.selectedSlot=0; state.loadout=["scout","lightturret","gunbuggy","cannon"]; state.started=false; state.gameOver=false;
    battle.units=[]; battle.turrets=[]; battle.shots=[]; battle.effects=[]; battle.nextUnitId=1; battle.nextTurretId=1; battle.aiTimer=1.5; battle.elapsed=0; battle.armedSlot=null; battle.hoverRoute=null; battle.hoverNode=null; battle.lastPlayerRoute=null; cancelDrag(); placementNodes.forEach(n=>n.occupiedBy=null);
    openCommand(); planNoteEl.textContent="Assign anything to the four quick buttons. Cost is paid only when deployed.";
  }

  function canvasClick(e){
    if(!running||battle.drag||battle.armedSlot===null) return;
    const p=clientToCanvas(e.clientX,e.clientY); if(!p) return;
    const id=state.loadout[battle.armedSlot],item=id?ITEMS[id]:null; if(!item) return;
    if(state.playerCash<item.cost){ battleStatusEl.textContent=`Need ${money(item.cost-state.playerCash)} more for ${item.name}.`; return; }
    if(item.kind==="attack") tryDropAttack(item,p); else tryDropDefence(item,p);
  }

  function drawBattle(){
    ctx.clearRect(0,0,WORLD.width,WORLD.height); ctx.drawImage(staticLayer,0,0);
    drawTurrets(ctx); drawUnits(ctx); drawShots(ctx); drawEffects(ctx); drawDeploymentOverlay(ctx);
    if(state.gameOver){ ctx.save();ctx.fillStyle="rgba(38,42,43,.28)";ctx.fillRect(0,0,WORLD.width,WORLD.height);ctx.restore(); }
  }

  function renderStaticLayer(){
    const g=staticCtx; g.clearRect(0,0,WORLD.width,WORLD.height); drawTerrain(g); drawRoutes(g); drawBases(g); drawScenery(g);
  }

  function drawTerrain(g){
    const grd=g.createLinearGradient(0,0,0,WORLD.height); grd.addColorStop(0,"#ccb57b"); grd.addColorStop(.45,"#d3bc82"); grd.addColorStop(1,"#c4a96e"); g.fillStyle=grd; g.fillRect(0,0,WORLD.width,WORLD.height);
    environment.patches.forEach(p=>{g.save();g.globalAlpha=p.a;g.fillStyle=p.v>.54?"#8a9a69":"#ead69b";g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,p.rot,0,Math.PI*2);g.fill();g.restore();});
    environment.scrub.forEach(s=>{g.save();g.globalAlpha=.10+s.v*.08;g.fillStyle=s.v>.56?"#657652":"#8d744d";g.beginPath();g.arc(s.x,s.y,s.r,0,Math.PI*2);g.fill();g.restore();});
    environment.pebbles.forEach(s=>{g.save();g.globalAlpha=.12+s.v*.16;g.fillStyle=s.v>.5?"#a59777":"#b6a17d";g.beginPath();g.arc(s.x,s.y,s.r,0,Math.PI*2);g.fill();g.restore();});
    g.save();g.globalAlpha=.065;g.fillStyle="#f0dca6";g.beginPath();g.ellipse(330,560,250,178,0,0,Math.PI*2);g.fill();g.restore();
  }

  function drawRoutes(g){
    routes.forEach((route,i)=>{
      routeStroke(g,route,"rgba(122,97,57,.16)",42);
      routeStroke(g,route,"#a98c5a",36);
      routeStroke(g,route,"#d7bf8b",28);
      g.save();g.strokeStyle="rgba(125,101,61,.16)";g.lineWidth=2.2;g.setLineDash([7,18]);pathRoute(g,route);g.stroke();g.restore();
      g.save();g.globalAlpha=.2;g.strokeStyle="rgba(246,232,190,.45)";g.lineWidth=2;g.setLineDash([0,18]);pathRoute(g,route);g.stroke();g.restore();
      const s=routeStarts[i],e=routeEnds[i]; drawRouteMarker(g,s,i+1,PLAYER,.5); drawRouteMarker(g,e,i+1,ENEMY,.34);
    });
  }

  function pathRoute(g,route){ g.beginPath(); route.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); }
  function routeStroke(g,route,col,w){g.save();g.strokeStyle=col;g.lineWidth=w;g.lineCap="round";g.lineJoin="round";pathRoute(g,route);g.stroke();g.restore();}

  function drawRouteMarker(g,p,n,team,alpha){
    g.save();g.globalAlpha=alpha;g.fillStyle=TEAM[team].main;g.beginPath();g.arc(p.x,p.y,14,0,Math.PI*2);g.fill();g.fillStyle="#fff";g.font="900 12px system-ui";g.textAlign="center";g.textBaseline="middle";g.fillText(String(n),p.x,p.y+.5);g.restore();
  }

  function drawBases(g){
    drawBase(g,330,1093,PLAYER,Math.PI); drawBase(g,330,27,ENEMY,0);
  }

  function drawBase(g,x,y,team,rot){
    const c=TEAM[team];g.save();g.translate(x,y);g.rotate(rot);g.fillStyle="rgba(53,50,45,.18)";g.beginPath();g.roundRect(-82,-25,164,52,14);g.fill();g.fillStyle="#d5c5a7";g.strokeStyle="#776d5e";g.lineWidth=4;g.beginPath();g.roundRect(-76,-31,152,50,12);g.fill();g.stroke();
    g.fillStyle=c.dark;g.beginPath();g.roundRect(-35,-20,70,30,8);g.fill();g.fillStyle=c.main;g.beginPath();g.arc(0,-4,14,0,Math.PI*2);g.fill();g.strokeStyle=c.pale;g.lineWidth=3;g.stroke();g.restore();
  }

  function drawScenery(g){
    environment.rocks.forEach(r=>drawRock(g,r)); environment.trees.forEach(t=>drawTree(g,t)); environment.structures.forEach(s=>drawStructure(g,s));
  }

  function drawTree(g,t){
    g.save();g.translate(t.x,t.y);g.rotate(t.rot);g.fillStyle="rgba(54,61,47,.15)";g.beginPath();g.ellipse(4,6,t.r*1.12,t.r*.84,0,0,Math.PI*2);g.fill();
    const blobs=[[-.48,-.18,.72],[.38,-.28,.76],[-.12,.34,.84],[.06,-.52,.62],[.42,.16,.52]];
    blobs.forEach((b,i)=>{g.fillStyle=i%2?"#547258":"#688561";g.beginPath();g.arc(b[0]*t.r,b[1]*t.r,t.r*b[2],0,Math.PI*2);g.fill();});
    g.fillStyle="#8ea06f";g.beginPath();g.arc(-t.r*.18,-t.r*.26,t.r*.24,0,Math.PI*2);g.fill();g.fillStyle="#78674b";g.fillRect(-2,t.r*.28,4,t.r*.34);g.restore();
  }

  function drawRock(g,r){
    g.save();g.translate(r.x,r.y);g.rotate(r.rot);g.fillStyle="rgba(60,55,48,.13)";g.beginPath();g.ellipse(3,4,r.r*1.12,r.r*.76,0,0,Math.PI*2);g.fill();
    g.fillStyle="#998d73";polygon(g,0,0,r.r,6);g.fill();g.strokeStyle="#756d5f";g.lineWidth=1.4;g.stroke();g.fillStyle="#b8aa8a";polygon(g,-r.r*.18,-r.r*.22,r.r*.48,5);g.fill();g.restore();
  }

  function polygon(g,cx,cy,r,sides){g.beginPath();for(let i=0;i<sides;i++){const a=-Math.PI/2+i*Math.PI*2/sides;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();}

  function drawStructure(g,s){
    g.save();g.translate(s.x,s.y);g.rotate(s.rot);g.fillStyle="rgba(61,57,51,.14)";g.fillRect(-s.w*.48,-s.h*.35,s.w,s.h);
    if(s.type==="relay"){
      g.fillStyle="#857a67";g.strokeStyle="#655f54";g.lineWidth=2;g.beginPath();g.roundRect(-s.w/2,-s.h/2,s.w,s.h,6);g.fill();g.stroke();
      g.fillStyle="#b5a78d";g.fillRect(-s.w*.36,-s.h*.34,s.w*.72,s.h*.2);g.fillStyle="#4f847b";g.fillRect(-4,-s.h*.26,8,s.h*.52);
    } else if(s.type==="hut"){
      g.fillStyle="#8a7b64";g.strokeStyle="#675e52";g.lineWidth=2;g.beginPath();g.roundRect(-s.w/2,-s.h/2,s.w,s.h,5);g.fill();g.stroke();
      g.fillStyle="#cdb594";g.beginPath();g.moveTo(-s.w*.45,-2);g.lineTo(0,-s.h*.48);g.lineTo(s.w*.45,-2);g.closePath();g.fill();
      g.fillStyle="#d9c6a7";g.fillRect(-s.w*.12,2,s.w*.24,s.h*.28);
    } else {
      g.fillStyle="#93846d";g.strokeStyle="#665f55";g.lineWidth=2;g.beginPath();g.roundRect(-s.w/2,-s.h/2,s.w,s.h,5);g.fill();g.stroke();
      g.fillStyle="#b8aa90";g.fillRect(-s.w*.38,-s.h*.38,s.w*.76,s.h*.18);g.fillStyle="#c8b99d";g.fillRect(-s.w*.15,-s.h*.08,s.w*.3,s.h*.4);
    }
    g.restore();
  }

  function drawTurrets(g){
    battle.turrets.forEach(t=>{
      if(t.dead) return; const item=ITEMS[t.itemId],c=TEAM[t.team];g.save();g.translate(t.x,t.y);
      g.fillStyle="rgba(55,51,46,.2)";g.beginPath();g.ellipse(4,7,23,14,0,0,Math.PI*2);g.fill();
      g.fillStyle="#c2af8d";g.strokeStyle="#786c5d";g.lineWidth=2;g.beginPath();g.arc(0,0,20,0,Math.PI*2);g.fill();g.stroke();
      g.fillStyle=c.dark;g.beginPath();g.arc(0,0,13,0,Math.PI*2);g.fill();g.fillStyle=c.main;g.beginPath();g.arc(0,-1,9,0,Math.PI*2);g.fill();
      g.rotate(t.heading+Math.PI/2);const recoil=t.recoil*5;g.fillStyle="#414648";if(item.id==="rapid"){g.fillRect(-7,-29+recoil,4,25);g.fillRect(3,-29+recoil,4,25);}else{g.fillRect(-3,-32+recoil,6,29);}g.fillStyle=c.pale;g.beginPath();g.arc(0,0,3.5,0,Math.PI*2);g.fill();g.restore();
      drawHealth(g,t.x,t.y-28,34,t.hp/t.maxHp,c.main);
    });
  }

  function drawUnits(g){
    battle.units.forEach(u=>{
      if(u.dead) return;const p=unitPoint(u),item=ITEMS[u.itemId],c=TEAM[u.team];g.save();g.translate(p.x,p.y);g.rotate(u.heading+Math.PI/2);
      if(u.hp<u.maxHp*.45){g.globalAlpha=.16;g.fillStyle="#3e4441";g.beginPath();g.arc(0,15,5+u.smoke*5,0,Math.PI*2);g.fill();g.globalAlpha=1;}
      if(item.id==="tank"){g.fillStyle="#303536";g.fillRect(-13,-20,5,40);g.fillRect(8,-20,5,40);g.fillStyle=c.main;g.strokeStyle=c.dark;g.lineWidth=2;g.beginPath();g.roundRect(-10,-21,20,42,5);g.fill();g.stroke();g.fillStyle=c.dark;g.beginPath();g.arc(0,-2,7,0,Math.PI*2);g.fill();g.fillStyle="#3c4142";g.fillRect(-2,-23,4,20);}else{g.fillStyle="#303536";[[-11,-15],[11,-15],[-11,15],[11,15]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,4,0,Math.PI*2);g.fill();});g.fillStyle=c.main;g.strokeStyle=c.dark;g.lineWidth=2;g.beginPath();g.roundRect(-9,-22,18,44,6);g.fill();g.stroke();g.fillStyle=c.pale;g.beginPath();g.roundRect(-5,-13,10,12,3);g.fill();if(item.attack){g.fillStyle="#3c4142";g.beginPath();g.arc(0,7,5,0,Math.PI*2);g.fill();g.fillRect(-1.5,-6,3,14);}}
      g.restore();drawHealth(g,p.x,p.y-29,28,u.hp/u.maxHp,c.main);
    });
  }

  function drawHealth(g,x,y,w,ratio,col){g.save();g.fillStyle="rgba(49,49,46,.35)";g.fillRect(x-w/2,y,w,4);g.fillStyle=col;g.fillRect(x-w/2,y,w*clamp(ratio,0,1),4);g.restore();}
  function drawShots(g){battle.shots.forEach(s=>{g.save();g.globalAlpha=clamp(s.ttl/.095,0,1);g.strokeStyle=TEAM[s.team].pale;g.lineWidth=2.2;g.beginPath();g.moveTo(s.x1,s.y1);g.lineTo(s.x2,s.y2);g.stroke();g.restore();});}
  function drawEffects(g){battle.effects.forEach(e=>{g.save();g.globalAlpha=clamp(e.ttl/(e.type==="boom"?.55:.18),0,1);g.strokeStyle=e.type==="boom"?"#e7b878":"#fff4d5";g.lineWidth=e.type==="boom"?4:2;g.beginPath();g.arc(e.x,e.y,e.r,0,Math.PI*2);g.stroke();g.restore();});}

  function drawDeploymentOverlay(g){
    const slot=battle.drag?.index ?? battle.armedSlot;
    if(slot===null||slot===undefined) return;
    const id=state.loadout[slot],item=id?ITEMS[id]:null;if(!item) return;
    g.save();
    if(item.kind==="attack"){
      routes.forEach((route,i)=>{
        const active = battle.hoverRoute===i;
        g.globalAlpha=active?.42:.12;g.strokeStyle=active?TEAM.player.main:"rgba(79,132,123,.65)";g.lineWidth=active?18:11;pathRoute(g,route);g.stroke();
        const s=routeStarts[i];g.globalAlpha=active?.96:.76;g.fillStyle="#f7f1ea";g.strokeStyle=active?TEAM.player.dark:TEAM.player.main;g.lineWidth=active?5:4;g.beginPath();g.arc(s.x,s.y,active?32:28,0,Math.PI*2);g.fill();g.stroke();
        g.fillStyle=TEAM.player.dark;g.font=`950 ${active?18:17}px system-ui`;g.textAlign="center";g.textBaseline="middle";g.fillText(String(i+1),s.x,s.y);
      });
    } else {
      placementNodes.filter(n=>n.team===PLAYER).forEach(n=>{
        const free=!n.occupiedBy, active=battle.hoverNode===n.id;
        g.globalAlpha=free?(active?.98:.88):.25;g.fillStyle=free?(active?"rgba(247,241,234,.96)":"rgba(247,241,234,.84)"):"rgba(80,76,70,.25)";g.strokeStyle=free?(active?TEAM.player.dark:TEAM.player.main):"#726b63";g.lineWidth=active?4.5:3;g.beginPath();g.arc(n.x,n.y,active?24:20,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.arc(n.x,n.y,active?9:7,0,Math.PI*2);g.stroke();
      });
    }
    g.restore();
  }

  function frame(now){
    const dt=Math.min(.04,(now-lastFrame)/1000); lastFrame=now; update(dt); if(!battleEl.hidden) drawBattle(); animationFrame=requestAnimationFrame(frame);
  }

  loadoutEl.addEventListener("click",e=>{const btn=e.target.closest("[data-loadout-slot]");if(!btn)return;state.selectedSlot=Number(btn.dataset.loadoutSlot);renderPlan();});
  rosterEl.addEventListener("click",e=>{const btn=e.target.closest("[data-assign-item]");if(!btn)return;state.loadout[state.selectedSlot]=btn.dataset.assignItem;renderPlan();});
  clearSlotBtn.addEventListener("click",()=>{state.loadout[state.selectedSlot]=null;renderPlan();});
  sendBtn.addEventListener("click",openBattle);
  pauseBtn.addEventListener("click",openCommand);
  speedBtn.addEventListener("click",()=>{speedMultiplier=speedMultiplier===1?2:speedMultiplier===2?3:1;speedBtn.textContent=`${speedMultiplier}×`;});
  canvas.addEventListener("pointerup",canvasClick);
  window.addEventListener("pointermove",onPointerMove,{passive:false});
  window.addEventListener("pointerup",onPointerUp,{passive:false});
  window.addEventListener("pointercancel",onPointerUp,{passive:false});
  window.addEventListener("resize",()=>{ resizeBattleLayout(); },{passive:true});
  window.addEventListener("orientationchange",()=>setTimeout(resizeBattleLayout,120),{passive:true});

  renderPlan(); renderBattleHud(); renderDeployBar(); drawBattle();
  animationFrame=requestAnimationFrame(frame);
})();
