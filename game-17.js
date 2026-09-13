(() => {
  'use strict';

  const canvas = document.getElementById('walklab-canvas');
  const ctx = canvas.getContext('2d');
  const readout = document.getElementById('walklab-readout');
  const editHint = document.getElementById('walklab-edit-hint');
  const scrub = document.getElementById('walklab-scrub');
  const prev = document.getElementById('walklab-prev');
  const next = document.getElementById('walklab-next');
  const playBtn = document.getElementById('walklab-play');
  const onionBtn = document.getElementById('walklab-onion');
  const keysBtn = document.getElementById('walklab-keys');
  const midsBtn = document.getElementById('walklab-mids');
  const resetBtn = document.getElementById('walklab-reset');
  const copyBtn = document.getElementById('walklab-copy');
  const pasteBtn = document.getElementById('walklab-paste');
  const saveBtn = document.getElementById('walklab-save');
  const loadBtn = document.getElementById('walklab-load');
  const exportBtn = document.getElementById('walklab-export');
  const fileInput = document.getElementById('walklab-file');
  const fpsSlider = document.getElementById('walklab-fps');
  const fpsOut = document.getElementById('walklab-fps-out');

  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;

  // Deliberately simple fixed-length side-view stick rig.
  const BODY = Object.freeze({
    torso: 0.40,
    neck: 0.055,
    headR: 0.105,
    upperArm: 0.255,
    lowerArm: 0.245,
    upperLeg: 0.38,
    lowerLeg: 0.38,
    foot: 0.15
  });

  const KEY_NAMES = ['Contact L','Down L','Passing L','Up L','Contact R','Down R','Passing R','Up R'];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clonePose(p) { return JSON.parse(JSON.stringify(p)); }

  function makeKey(i) {
    const pelvisY = [0.700, 0.660, 0.690, 0.730, 0.700, 0.660, 0.690, 0.730][i];
    const lean = [2, 3, 1, 0, 2, 3, 1, 0][i] * DEG;

    // The stance foot travels backwards exactly as root travel increases.
    // This makes the planted foot stay fixed in world space when paired with
    // the moving floor ticks: footX + travel is constant through each stance.
    const aFootX = [ 0.250,  0.125,  0.000, -0.125, -0.250, -0.125,  0.000,  0.125][i];
    const bFootX = [-0.250, -0.125,  0.000,  0.125,  0.250,  0.125,  0.000, -0.125][i];
    const aFootLift = [0.000,0.000,0.000,0.000,0.000,0.080,0.160,0.100][i];
    const bFootLift = [0.000,0.080,0.160,0.100,0.000,0.000,0.000,0.000][i];

    // Arms counter-swing against the legs. Both shoulders share the same
    // central attachment point; elbows are solved automatically.
    const aHandX = [-0.180,-0.090,0.000,0.090,0.180,0.090,0.000,-0.090][i];
    const bHandX = [ 0.180, 0.090,0.000,-0.090,-0.180,-0.090,0.000, 0.090][i];
    const handY = [0.300,0.315,0.305,0.290,0.300,0.315,0.305,0.290][i];

    return {
      name: KEY_NAMES[i],
      pelvisY,
      lean,
      aFootX,
      aFootLift,
      bFootX,
      bFootLift,
      aHandX,
      aHandY: handY,
      bHandX,
      bHandY: handY,
      planted: i < 4 ? 'A' : 'B',
      travel: i / 8,
      key: true
    };
  }

  function defaultKeys() { return Array.from({length:8}, (_,i) => makeKey(i)); }

  function interpolatePose(a, b, t, name, travelB = b.travel) {
    return {
      name,
      pelvisY: lerp(a.pelvisY, b.pelvisY, t),
      lean: lerp(a.lean, b.lean, t),
      aFootX: lerp(a.aFootX, b.aFootX, t),
      aFootLift: lerp(a.aFootLift, b.aFootLift, t),
      bFootX: lerp(a.bFootX, b.bFootX, t),
      bFootLift: lerp(a.bFootLift, b.bFootLift, t),
      aHandX: lerp(a.aHandX, b.aHandX, t),
      aHandY: lerp(a.aHandY, b.aHandY, t),
      bHandX: lerp(a.bHandX, b.bHandX, t),
      bHandY: lerp(a.bHandY, b.bHandY, t),
      planted: a.planted,
      travel: lerp(a.travel, travelB, t),
      key: false
    };
  }

  function buildFramesFromKeys(keys) {
    const out = new Array(16);
    for (let i = 0; i < 8; i++) {
      const a = clonePose(keys[i]);
      a.key = true;
      a.name = KEY_NAMES[i];
      out[i * 2] = a;
      const nextIndex = (i + 1) % 8;
      const b = keys[nextIndex];
      const travelB = nextIndex === 0 ? 1 : b.travel;
      out[i * 2 + 1] = interpolatePose(a, b, 0.5, `${KEY_NAMES[i]} → ${KEY_NAMES[nextIndex]}`, travelB);
    }
    return out;
  }

  let frames = buildFramesFromKeys(defaultKeys());
  let frame = 0;
  let playing = false;
  let onion = true;
  let keysOnly = false;
  let fps = 14;
  let copiedPose = null;
  let lastAdvance = performance.now();
  let activeJoint = null;
  let activePointer = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function solveJoint(root, target, l1, l2, mode) {
    let dx = target.x - root.x;
    let dy = target.y - root.y;
    let d = Math.hypot(dx, dy) || 0.0001;
    const minD = Math.abs(l1 - l2) + 0.001;
    const maxD = l1 + l2 - 0.001;
    const cd = clamp(d, minD, maxD);
    dx *= cd / d;
    dy *= cd / d;
    const tx = root.x + dx;
    const ty = root.y + dy;
    d = cd;

    const a = (l1*l1 - l2*l2 + d*d) / (2*d);
    const h = Math.sqrt(Math.max(0, l1*l1 - a*a));
    const ux = dx / d, uy = dy / d;
    const bx = root.x + ux * a;
    const by = root.y + uy * a;
    const px = -uy, py = ux;
    const c1 = { x: bx + px*h, y: by + py*h };
    const c2 = { x: bx - px*h, y: by - py*h };

    let joint;
    if (mode === 'knee') {
      // Side-view knees always bend toward travel (screen-right), preventing
      // the backwards-folding legs that made the previous editor confusing.
      joint = c1.x >= c2.x ? c1 : c2;
    } else {
      // Elbows favour the lower candidate for a relaxed hanging arm.
      joint = c1.y >= c2.y ? c1 : c2;
    }
    return { joint, target: {x: tx, y: ty} };
  }

  function geometry(p, W = canvas.width, H = canvas.height) {
    const scale = Math.min(W * 0.34, H * 0.56);
    const cx = W * 0.5;
    const groundY = H * 0.84;
    const pelvis = { x: cx, y: groundY - p.pelvisY * scale };
    const chest = {
      x: pelvis.x + Math.sin(p.lean) * BODY.torso * scale,
      y: pelvis.y - Math.cos(p.lean) * BODY.torso * scale
    };
    const shoulder = { x: chest.x, y: chest.y };
    const neck = {
      x: chest.x + Math.sin(p.lean) * BODY.neck * scale,
      y: chest.y - Math.cos(p.lean) * BODY.neck * scale
    };
    const head = {
      x: neck.x + Math.sin(p.lean) * BODY.headR * 0.95 * scale,
      y: neck.y - Math.cos(p.lean) * BODY.headR * 0.95 * scale
    };

    const aFTarget = { x: cx + p.aFootX * scale, y: groundY - p.aFootLift * scale };
    const bFTarget = { x: cx + p.bFootX * scale, y: groundY - p.bFootLift * scale };
    const aLeg = solveJoint(pelvis, aFTarget, BODY.upperLeg*scale, BODY.lowerLeg*scale, 'knee');
    const bLeg = solveJoint(pelvis, bFTarget, BODY.upperLeg*scale, BODY.lowerLeg*scale, 'knee');

    const aHTarget = { x: shoulder.x + p.aHandX*scale, y: shoulder.y + p.aHandY*scale };
    const bHTarget = { x: shoulder.x + p.bHandX*scale, y: shoulder.y + p.bHandY*scale };
    const aArm = solveJoint(shoulder, aHTarget, BODY.upperArm*scale, BODY.lowerArm*scale, 'elbow');
    const bArm = solveJoint(shoulder, bHTarget, BODY.upperArm*scale, BODY.lowerArm*scale, 'elbow');

    return {
      W,H,scale,cx,groundY,pelvis,chest,shoulder,neck,head,
      aK:aLeg.joint,aF:aLeg.target,bK:bLeg.joint,bF:bLeg.target,
      aE:aArm.joint,aW:aArm.target,bE:bArm.joint,bW:bArm.target
    };
  }

  function line(c, a, b, width, stroke, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke();
    c.restore();
  }

  function circle(c, p, r, fill, stroke, alpha = 1) {
    c.save(); c.globalAlpha=alpha;
    c.beginPath(); c.arc(p.x,p.y,r,0,TAU); c.fillStyle=fill; c.fill();
    if (stroke) { c.strokeStyle=stroke; c.lineWidth=Math.max(1,r*.20); c.stroke(); }
    c.restore();
  }

  function drawFoot(c, ankle, scale, color, alpha = 1, planted = false) {
    const toe = { x: ankle.x + BODY.foot*scale, y: ankle.y };
    line(c, ankle, toe, Math.max(3, scale*0.026), color, alpha);
    if (planted) {
      line(c, {x:ankle.x-scale*.035,y:ankle.y+scale*.012}, {x:toe.x+scale*.025,y:toe.y+scale*.012}, Math.max(2,scale*.010), '#718f89', alpha*.85);
    }
  }

  function drawPoseTo(c, p, g, opts = {}) {
    const ghost = !!opts.ghost;
    const alpha = opts.alpha ?? 1;
    const handles = !!opts.handles;
    const s = g.scale;
    const back = ghost ? '#adb4b5' : '#98a0a2';
    const front = ghost ? '#7f898b' : '#354047';
    const core = ghost ? '#929b9d' : '#26343a';
    const lw = Math.max(3, s*.026);

    // Back limbs first.
    line(c,g.pelvis,g.bK,lw,back,alpha*.70);
    line(c,g.bK,g.bF,lw,back,alpha*.70);
    drawFoot(c,g.bF,s,back,alpha*.70,p.planted==='B');
    line(c,g.shoulder,g.bE,lw*.82,back,alpha*.70);
    line(c,g.bE,g.bW,lw*.82,back,alpha*.70);

    // Central body / shoulder attachment.
    line(c,g.pelvis,g.chest,lw*1.05,core,alpha);
    line(c,g.chest,g.neck,lw*.72,core,alpha);
    circle(c,g.head,BODY.headR*s,ghost?'#c0c5c5':'#f0ebe5',core,alpha);
    circle(c,g.shoulder,Math.max(3,s*.022),ghost?'#adb4b5':'#f0ebe5',core,alpha);

    // Front limbs.
    line(c,g.pelvis,g.aK,lw,front,alpha);
    line(c,g.aK,g.aF,lw,front,alpha);
    drawFoot(c,g.aF,s,front,alpha,p.planted==='A');
    line(c,g.shoulder,g.aE,lw*.82,front,alpha);
    line(c,g.aE,g.aW,lw*.82,front,alpha);

    // Small automatic elbow/knee dots show the fixed-length hinges without
    // turning them into fiddly draggable controls.
    for (const q of [g.aK,g.bK,g.aE,g.bE]) circle(c,q,Math.max(2.5,s*.014),ghost?'#aab1b2':'#d8d4cf',core,alpha*.95);

    if (handles && !ghost) {
      const handleList = [
        ['pelvis',g.pelvis],['chest',g.chest],
        ['aF',g.aF],['bF',g.bF],['aW',g.aW],['bW',g.bW]
      ];
      for (const [name,q] of handleList) {
        const selected = name === activeJoint;
        circle(c,q,(selected?.034:.028)*s,selected?'#6f8f89':'#fffdfa','#344047',1);
      }
      c.save();
      c.strokeStyle='rgba(111,143,137,.45)';
      c.lineWidth=Math.max(1,s*.005);
      c.setLineDash([5,6]);
      c.beginPath(); c.moveTo(g.cx,g.pelvis.y-.08*s); c.lineTo(g.cx,g.groundY+.03*s); c.stroke();
      c.restore();
    }
  }

  function draw() {
    resize();
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#f3ede7'; ctx.fillRect(0,0,W,H);
    const g=geometry(frames[frame]);
    const pad=W*.055;

    ctx.strokeStyle='rgba(76,82,86,.22)';
    ctx.lineWidth=Math.max(1,W*.003);
    ctx.strokeRect(pad,H*.07,W-pad*2,H*.81);

    ctx.strokeStyle='rgba(60,68,70,.42)';
    ctx.lineWidth=Math.max(1,W*.003);
    ctx.beginPath(); ctx.moveTo(pad,g.groundY); ctx.lineTo(W-pad,g.groundY); ctx.stroke();

    // Ground marks move exactly with root travel. During each stance the
    // planted foot remains over one world-space mark, making slide easy to spot.
    const spacing = g.scale * 0.25;
    const travelPx = frames[frame].travel * g.scale;
    const offset = -((travelPx % spacing) + spacing) % spacing;
    ctx.strokeStyle='rgba(88,100,99,.16)';
    ctx.lineWidth=Math.max(1,W*.002);
    for(let x=offset-spacing;x<W+spacing;x+=spacing){
      ctx.beginPath(); ctx.moveTo(x,g.groundY+.03*g.scale); ctx.lineTo(x+spacing*.35,g.groundY+.03*g.scale); ctx.stroke();
    }

    if (onion) {
      const pPrev=frames[(frame+15)%16], pNext=frames[(frame+1)%16];
      drawPoseTo(ctx,pPrev,geometry(pPrev),{ghost:true,alpha:.17});
      drawPoseTo(ctx,pNext,geometry(pNext),{ghost:true,alpha:.17});
    }
    drawPoseTo(ctx,frames[frame],g,{handles:true});

    const p=frames[frame];
    readout.textContent=`Frame ${frame+1} / 16 · ${p.name} · ${p.key?'KEY':'IN-BETWEEN'} · ${p.planted==='A'?'LEFT':'RIGHT'} PLANT`;
    editHint.textContent=activeJoint ? `Editing ${activeJoint}` : 'Drag pelvis, chest, hands or feet';
    scrub.value=String(frame);
  }

  function pointerPos(e) {
    const r=canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
  }

  function findJoint(pos) {
    const g=geometry(frames[frame]);
    const list=[['pelvis',g.pelvis],['chest',g.chest],['aF',g.aF],['bF',g.bF],['aW',g.aW],['bW',g.bW]];
    const radius=.095*g.scale;
    let best=null,bestD=Infinity;
    for(const [name,q] of list){
      const d=Math.hypot(pos.x-q.x,pos.y-q.y);
      if(d<radius&&d<bestD){best=name;bestD=d;}
    }
    return best;
  }

  function clampEndpoint(root, pos, l1, l2) {
    let dx=pos.x-root.x, dy=pos.y-root.y;
    let d=Math.hypot(dx,dy)||0.0001;
    const minD=Math.abs(l1-l2)+.002, maxD=l1+l2-.002;
    const cd=clamp(d,minD,maxD);
    return {x:root.x+dx*cd/d,y:root.y+dy*cd/d};
  }

  function editJoint(name, pos) {
    const p=frames[frame];
    const g=geometry(p);
    const s=g.scale;

    if (name==='pelvis') {
      p.pelvisY=clamp((g.groundY-pos.y)/s,.625,.745);
    } else if (name==='chest') {
      p.lean=clamp(Math.atan2(pos.x-g.pelvis.x,g.pelvis.y-pos.y),-18*DEG,18*DEG);
    } else if (name==='aF' || name==='bF') {
      const planted = (name==='aF' && p.planted==='A') || (name==='bF' && p.planted==='B');
      const target={x:pos.x,y:planted?g.groundY:Math.min(pos.y,g.groundY)};
      const clamped=clampEndpoint(g.pelvis,target,BODY.upperLeg*s,BODY.lowerLeg*s);
      const prefix=name==='aF'?'a':'b';
      p[`${prefix}FootX`]=clamp((clamped.x-g.cx)/s,-.36,.36);
      p[`${prefix}FootLift`]=planted?0:clamp((g.groundY-clamped.y)/s,0,.22);
    } else if (name==='aW' || name==='bW') {
      const clamped=clampEndpoint(g.shoulder,pos,BODY.upperArm*s,BODY.lowerArm*s);
      const prefix=name==='aW'?'a':'b';
      p[`${prefix}HandX`]=clamp((clamped.x-g.shoulder.x)/s,-.30,.30);
      p[`${prefix}HandY`]=clamp((clamped.y-g.shoulder.y)/s,.16,.44);
    }
    draw();
  }

  canvas.addEventListener('pointerdown',e=>{
    const pos=pointerPos(e); const joint=findJoint(pos); if(!joint)return;
    playing=false; playBtn.textContent='Play'; playBtn.classList.remove('active');
    activeJoint=joint; activePointer=e.pointerId; canvas.setPointerCapture?.(e.pointerId); editJoint(joint,pos);
  });
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===activePointer&&activeJoint)editJoint(activeJoint,pointerPos(e));});
  function endDrag(e){if(e.pointerId!==activePointer)return;activePointer=null;activeJoint=null;draw();}
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);

  function step(dir) {
    if(keysOnly){frame=(frame+dir*2+16)%16;if(frame%2)frame=(frame+1)%16;}
    else frame=(frame+dir+16)%16;
    lastAdvance=performance.now(); draw();
  }

  function animate(now) {
    if(playing){
      const interval=1000/fps;
      if(now-lastAdvance>=interval){step(1);lastAdvance=now;}
    }
    requestAnimationFrame(animate);
  }

  function rebuildMids() {
    for(let i=0;i<8;i++){
      const a=frames[i*2];
      const nextIndex=(i+1)%8;
      const b=frames[nextIndex*2];
      const travelB=nextIndex===0?1:b.travel;
      frames[i*2+1]=interpolatePose(a,b,.5,`${a.name} → ${b.name}`,travelB);
    }
    draw();
  }

  function resetCycle() {
    frames=buildFramesFromKeys(defaultKeys());
    frame=0; playing=false; playBtn.textContent='Play'; playBtn.classList.remove('active');
    copiedPose=null; pasteBtn.disabled=true; draw();
  }

  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function saveJSON(){
    const data={type:'GameHubWalkLab',version:3,fps,body:BODY,frames};
    downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'walk-lab-animation.json');
  }

  async function loadJSON(file){
    try{
      const data=JSON.parse(await file.text());
      if(!data||!Array.isArray(data.frames)||data.frames.length!==16)throw new Error('Expected a 16-frame Walk Lab animation.');
      const required=['pelvisY','lean','aFootX','aFootLift','bFootX','bFootLift','aHandX','aHandY','bHandX','bHandY'];
      if(!required.every(k=>Number.isFinite(data.frames[0]?.[k])))throw new Error('This is an older Walk Lab format. Reset the cycle or load a v3 animation.');
      frames=data.frames.map((p,i)=>({...clonePose(p),key:i%2===0}));
      if(Number.isFinite(data.fps)){fps=clamp(Math.round(data.fps),4,24);fpsSlider.value=String(fps);fpsOut.textContent=`${fps} fps`;}
      frame=0; playing=false; playBtn.textContent='Play'; playBtn.classList.remove('active'); draw();
    }catch(err){alert(`Could not load animation: ${err.message}`);}
  }

  function exportPNG(){
    const cellW=280,cellH=360,cols=4,rows=4;
    const out=document.createElement('canvas'); out.width=cellW*cols; out.height=cellH*rows;
    const c=out.getContext('2d'); c.clearRect(0,0,out.width,out.height);
    frames.forEach((p,i)=>{
      const col=i%cols,row=Math.floor(i/cols);
      c.save(); c.translate(col*cellW,row*cellH);
      const g=geometry(p,cellW,cellH);
      drawPoseTo(c,p,g,{handles:false,ghost:false});
      c.restore();
    });
    out.toBlob(blob=>{if(blob)downloadBlob(blob,'walk-lab-reference.png');},'image/png');
  }

  scrub.addEventListener('input',()=>{frame=Number(scrub.value);playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');draw();});
  prev.addEventListener('click',()=>{playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');step(-1);});
  next.addEventListener('click',()=>{playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');step(1);});
  playBtn.addEventListener('click',()=>{playing=!playing;playBtn.textContent=playing?'Pause':'Play';playBtn.classList.toggle('active',playing);lastAdvance=performance.now();draw();});
  onionBtn.addEventListener('click',()=>{onion=!onion;onionBtn.classList.toggle('active',onion);onionBtn.setAttribute('aria-pressed',String(onion));draw();});
  keysBtn.addEventListener('click',()=>{keysOnly=!keysOnly;keysBtn.classList.toggle('active',keysOnly);keysBtn.setAttribute('aria-pressed',String(keysOnly));if(keysOnly&&frame%2)frame=(frame+1)%16;draw();});
  midsBtn.addEventListener('click',rebuildMids);
  resetBtn?.addEventListener('click',resetCycle);
  copyBtn.addEventListener('click',()=>{copiedPose=clonePose(frames[frame]);pasteBtn.disabled=false;});
  pasteBtn.addEventListener('click',()=>{if(!copiedPose)return;const keepName=frames[frame].name,keepKey=frames[frame].key,keepTravel=frames[frame].travel,keepPlant=frames[frame].planted;frames[frame]={...clonePose(copiedPose),name:keepName,key:keepKey,travel:keepTravel,planted:keepPlant};draw();});
  saveBtn.addEventListener('click',saveJSON);
  loadBtn.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',()=>{const f=fileInput.files?.[0];if(f)loadJSON(f);fileInput.value='';});
  exportBtn.addEventListener('click',exportPNG);
  fpsSlider.addEventListener('input',()=>{fps=Number(fpsSlider.value);fpsOut.value=`${fps} fps`;fpsOut.textContent=`${fps} fps`;lastAdvance=performance.now();});
  window.addEventListener('resize',draw,{passive:true});

  playBtn.textContent='Play';
  playBtn.classList.remove('active');
  draw();
  requestAnimationFrame(animate);
})();
