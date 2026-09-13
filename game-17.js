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
  const BODY = Object.freeze({
    torso: 0.48,
    neck: 0.08,
    headRx: 0.115,
    headRy: 0.145,
    shoulderHalf: 0.075,
    hipHalf: 0.048,
    upperArm: 0.285,
    lowerArm: 0.265,
    upperLeg: 0.42,
    lowerLeg: 0.43,
    foot: 0.16
  });

  const KEY_NAMES = ['Contact L','Down L','Passing L','Up L','Contact R','Down R','Passing R','Up R'];

  function pose(name, pelvisY, leanDeg, aLeg, bLeg, aArm, bArm, planted) {
    return {
      name,
      pelvisY,
      lean: leanDeg * DEG,
      aUpperLeg: aLeg[0] * DEG,
      aLowerLeg: aLeg[1] * DEG,
      bUpperLeg: bLeg[0] * DEG,
      bLowerLeg: bLeg[1] * DEG,
      aUpperArm: aArm[0] * DEG,
      aLowerArm: aArm[1] * DEG,
      bUpperArm: bArm[0] * DEG,
      bLowerArm: bArm[1] * DEG,
      planted,
      key: true
    };
  }

  const defaultKeys = [
    pose('Contact L', .955,  4, [ 27,   7], [-25,  -8], [-27,-13], [ 28, 15], 'A'),
    pose('Down L',    .895,  5, [ 17,  -4], [-18, -31], [-18, -8], [ 20,  9], 'A'),
    pose('Passing L', .930,  2, [ -7,   1], [ 20, -18], [ -3,  2], [  4, -2], 'A'),
    pose('Up L',      .985, -1, [-18,  10], [ 34,  17], [ 17,  8], [-20, -9], 'A'),
    pose('Contact R', .955,  4, [-25,  -8], [ 27,   7], [ 28, 15], [-27,-13], 'B'),
    pose('Down R',    .895,  5, [-18, -31], [ 17,  -4], [ 20,  9], [-18, -8], 'B'),
    pose('Passing R', .930,  2, [ 20, -18], [ -7,   1], [  4, -2], [ -3,  2], 'B'),
    pose('Up R',      .985, -1, [ 34,  17], [-18,  10], [-20, -9], [ 17,  8], 'B')
  ];

  function clonePose(p) { return JSON.parse(JSON.stringify(p)); }
  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  function lerpAngle(a, b, t) { return a + wrapAngle(b - a) * t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function interpolatePose(a, b, t, name) {
    return {
      name,
      pelvisY: lerp(a.pelvisY, b.pelvisY, t),
      lean: lerpAngle(a.lean, b.lean, t),
      aUpperLeg: lerpAngle(a.aUpperLeg, b.aUpperLeg, t),
      aLowerLeg: lerpAngle(a.aLowerLeg, b.aLowerLeg, t),
      bUpperLeg: lerpAngle(a.bUpperLeg, b.bUpperLeg, t),
      bLowerLeg: lerpAngle(a.bLowerLeg, b.bLowerLeg, t),
      aUpperArm: lerpAngle(a.aUpperArm, b.aUpperArm, t),
      aLowerArm: lerpAngle(a.aLowerArm, b.aLowerArm, t),
      bUpperArm: lerpAngle(a.bUpperArm, b.bUpperArm, t),
      bLowerArm: lerpAngle(a.bLowerArm, b.bLowerArm, t),
      planted: t < .5 ? a.planted : b.planted,
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
      const b = keys[(i + 1) % 8];
      out[i * 2 + 1] = interpolatePose(a, b, .5, `${KEY_NAMES[i]} → ${KEY_NAMES[(i + 1) % 8]}`);
    }
    return out;
  }

  let frames = buildFramesFromKeys(defaultKeys);
  let frame = 0;
  let playing = true;
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

  function pointFrom(root, angle, lengthPx) {
    return {
      x: root.x + Math.sin(angle) * lengthPx,
      y: root.y + Math.cos(angle) * lengthPx
    };
  }

  function geometry(p, W = canvas.width, H = canvas.height) {
    const scale = Math.min(W * 0.31, H * 0.48);
    const cx = W * 0.5;
    const groundY = H * 0.84;
    const pelvis = { x: cx, y: groundY - p.pelvisY * scale };
    const chest = {
      x: pelvis.x + Math.sin(p.lean) * BODY.torso * scale,
      y: pelvis.y - Math.cos(p.lean) * BODY.torso * scale
    };
    const neck = {
      x: chest.x + Math.sin(p.lean) * BODY.neck * scale,
      y: chest.y - Math.cos(p.lean) * BODY.neck * scale
    };
    const head = {
      x: neck.x + Math.sin(p.lean) * BODY.headRy * 0.72 * scale,
      y: neck.y - Math.cos(p.lean) * BODY.headRy * 0.72 * scale
    };

    // Small side-view offsets make front/back limbs readable without changing lengths.
    const shoulderNormal = { x: Math.cos(p.lean), y: Math.sin(p.lean) };
    const hipNormal = { x: 1, y: 0 };
    const shA = { x: chest.x + shoulderNormal.x * BODY.shoulderHalf * scale, y: chest.y + shoulderNormal.y * BODY.shoulderHalf * scale };
    const shB = { x: chest.x - shoulderNormal.x * BODY.shoulderHalf * scale, y: chest.y - shoulderNormal.y * BODY.shoulderHalf * scale };
    const hipA = { x: pelvis.x + hipNormal.x * BODY.hipHalf * scale, y: pelvis.y };
    const hipB = { x: pelvis.x - hipNormal.x * BODY.hipHalf * scale, y: pelvis.y };

    const aK = pointFrom(hipA, p.aUpperLeg, BODY.upperLeg * scale);
    const aF = pointFrom(aK, p.aLowerLeg, BODY.lowerLeg * scale);
    const bK = pointFrom(hipB, p.bUpperLeg, BODY.upperLeg * scale);
    const bF = pointFrom(bK, p.bLowerLeg, BODY.lowerLeg * scale);
    const aE = pointFrom(shA, p.aUpperArm, BODY.upperArm * scale);
    const aW = pointFrom(aE, p.aLowerArm, BODY.lowerArm * scale);
    const bE = pointFrom(shB, p.bUpperArm, BODY.upperArm * scale);
    const bW = pointFrom(bE, p.bLowerArm, BODY.lowerArm * scale);

    return { W,H,scale,cx,groundY,pelvis,chest,neck,head,shA,shB,hipA,hipB,aK,aF,bK,bF,aE,aW,bE,bW };
  }

  function capsuleSegment(c, a, b, wA, wB, fill, stroke, alpha = 1) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = fill;
    c.strokeStyle = stroke;
    c.lineWidth = Math.max(1, (wA + wB) * .055);
    c.beginPath();
    c.moveTo(a.x + nx * wA, a.y + ny * wA);
    c.lineTo(b.x + nx * wB, b.y + ny * wB);
    c.quadraticCurveTo(b.x + nx * wB * .25, b.y + ny * wB * .25, b.x - nx * wB, b.y - ny * wB);
    c.lineTo(a.x - nx * wA, a.y - ny * wA);
    c.quadraticCurveTo(a.x - nx * wA * .25, a.y - ny * wA * .25, a.x + nx * wA, a.y + ny * wA);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  function jointCircle(c, p, r, fill, stroke, alpha = 1) {
    c.save(); c.globalAlpha = alpha; c.beginPath(); c.arc(p.x,p.y,r,0,TAU); c.fillStyle=fill; c.fill();
    if (stroke) { c.strokeStyle=stroke; c.lineWidth=Math.max(1,r*.22); c.stroke(); }
    c.restore();
  }

  function drawTorso(c, g, alpha, ghost) {
    const s = g.scale;
    const dx = g.chest.x - g.pelvis.x, dy = g.chest.y - g.pelvis.y;
    const len = Math.hypot(dx,dy) || 1;
    const nx=-dy/len, ny=dx/len;
    const sh = .145*s, hip = .105*s;
    c.save(); c.globalAlpha=alpha;
    c.fillStyle = ghost ? '#a8b0b1' : '#758084';
    c.strokeStyle = ghost ? '#8e989a' : '#344248';
    c.lineWidth=Math.max(1,s*.008);
    c.beginPath();
    c.moveTo(g.chest.x+nx*sh,g.chest.y+ny*sh);
    c.lineTo(g.pelvis.x+nx*hip,g.pelvis.y+ny*hip);
    c.quadraticCurveTo(g.pelvis.x,g.pelvis.y+.04*s,g.pelvis.x-nx*hip,g.pelvis.y-ny*hip);
    c.lineTo(g.chest.x-nx*sh,g.chest.y-ny*sh);
    c.quadraticCurveTo(g.chest.x,g.chest.y-.025*s,g.chest.x+nx*sh,g.chest.y+ny*sh);
    c.closePath(); c.fill(); c.stroke(); c.restore();
  }

  function drawFoot(c, ankle, angle, scale, fill, stroke, alpha) {
    const len=BODY.foot*scale;
    const dir={x:Math.cos(angle)*len,y:-Math.sin(angle)*len*.18};
    const end={x:ankle.x+dir.x,y:ankle.y+dir.y};
    capsuleSegment(c, ankle, end, .038*scale, .026*scale, fill, stroke, alpha);
  }

  function drawPoseTo(c, p, g, opts = {}) {
    const ghost=!!opts.ghost;
    const alpha=opts.alpha ?? 1;
    const handles=!!opts.handles;
    const s=g.scale;
    const outline=ghost?'#98a0a2':'#344047';
    const back=ghost?'#b7bdbd':'#8a9496';
    const front=ghost?'#9ca5a6':'#566369';
    const skin=ghost?'#c1c6c6':'#aeb9b9';

    // back limbs
    capsuleSegment(c,g.hipB,g.bK,.075*s,.060*s,back,outline,alpha*.72);
    capsuleSegment(c,g.bK,g.bF,.060*s,.045*s,back,outline,alpha*.72);
    drawFoot(c,g.bF,p.bLowerLeg,s,back,outline,alpha*.72);
    capsuleSegment(c,g.shB,g.bE,.052*s,.042*s,back,outline,alpha*.72);
    capsuleSegment(c,g.bE,g.bW,.042*s,.030*s,back,outline,alpha*.72);
    jointCircle(c,g.bW,.034*s,back,outline,alpha*.72);

    drawTorso(c,g,alpha,ghost);
    capsuleSegment(c,g.chest,g.neck,.050*s,.045*s,skin,outline,alpha);

    // head: oval with a simple nose wedge, more useful to image-gen than a circle.
    c.save(); c.globalAlpha=alpha; c.translate(g.head.x,g.head.y); c.rotate(p.lean*.45);
    c.fillStyle=skin; c.strokeStyle=outline; c.lineWidth=Math.max(1,s*.008);
    c.beginPath(); c.ellipse(0,0,BODY.headRx*s,BODY.headRy*s,0,0,TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(BODY.headRx*s*.82,-.02*s); c.lineTo(BODY.headRx*s*1.18,.01*s); c.lineTo(BODY.headRx*s*.82,.04*s); c.closePath(); c.fill(); c.stroke();
    c.restore();

    // front limbs
    capsuleSegment(c,g.hipA,g.aK,.078*s,.062*s,front,outline,alpha);
    capsuleSegment(c,g.aK,g.aF,.062*s,.045*s,front,outline,alpha);
    drawFoot(c,g.aF,p.aLowerLeg,s,front,outline,alpha);
    capsuleSegment(c,g.shA,g.aE,.054*s,.043*s,front,outline,alpha);
    capsuleSegment(c,g.aE,g.aW,.043*s,.030*s,front,outline,alpha);
    jointCircle(c,g.aW,.035*s,front,outline,alpha);

    if (!ghost && p.planted) {
      const planted = p.planted === 'A' ? g.aF : g.bF;
      c.save(); c.strokeStyle='#718f89'; c.lineWidth=Math.max(2,s*.012); c.lineCap='round';
      c.beginPath(); c.moveTo(planted.x-.09*s,g.groundY+.025*s); c.lineTo(planted.x+.09*s,g.groundY+.025*s); c.stroke(); c.restore();
    }

    if (handles && !ghost) {
      const handlesList = [
        ['pelvis',g.pelvis],['chest',g.chest],
        ['aK',g.aK],['aF',g.aF],['bK',g.bK],['bF',g.bF],
        ['aE',g.aE],['aW',g.aW],['bE',g.bE],['bW',g.bW]
      ];
      for (const [name,q] of handlesList) {
        const selected=name===activeJoint;
        jointCircle(c,q,(selected?.026:.020)*s,selected?'#6f8f89':'#f6f3ef','#344047',1);
      }
      // locked root guide
      c.save(); c.strokeStyle='rgba(111,143,137,.55)'; c.lineWidth=Math.max(1,s*.005); c.setLineDash([4,5]);
      c.beginPath(); c.moveTo(g.cx,g.pelvis.y-.10*s); c.lineTo(g.cx,g.groundY+.03*s); c.stroke(); c.restore();
    }
  }

  function draw() {
    resize();
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#f3ede7'; ctx.fillRect(0,0,W,H);
    const g=geometry(frames[frame]);
    const pad=W*.055;
    ctx.strokeStyle='rgba(76,82,86,.22)'; ctx.lineWidth=Math.max(1,W*.003);
    ctx.strokeRect(pad,H*.07,W-pad*2,H*.81);
    ctx.strokeStyle='rgba(60,68,70,.40)'; ctx.lineWidth=Math.max(1,W*.003);
    ctx.beginPath(); ctx.moveTo(pad,g.groundY+.025*g.scale); ctx.lineTo(W-pad,g.groundY+.025*g.scale); ctx.stroke();

    // floor ticks make sliding obvious
    const phase=(frame/16)*52*Math.min(window.devicePixelRatio||1,2);
    ctx.strokeStyle='rgba(88,100,99,.14)'; ctx.lineWidth=Math.max(1,W*.002);
    for(let x=-60;x<W+60;x+=52*Math.min(window.devicePixelRatio||1,2)){
      const px=x-phase;
      ctx.beginPath();ctx.moveTo(px,g.groundY+.04*g.scale);ctx.lineTo(px+20,g.groundY+.04*g.scale);ctx.stroke();
    }

    if (onion) {
      const prevG=geometry(frames[(frame+15)%16]);
      const nextG=geometry(frames[(frame+1)%16]);
      drawPoseTo(ctx,frames[(frame+15)%16],prevG,{ghost:true,alpha:.17});
      drawPoseTo(ctx,frames[(frame+1)%16],nextG,{ghost:true,alpha:.17});
    }
    drawPoseTo(ctx,frames[frame],g,{handles:true});

    const p=frames[frame];
    readout.textContent=`Frame ${frame+1} / 16 · ${p.name} · ${p.key?'KEY':'IN-BETWEEN'}${activeJoint?` · ${activeJoint}`:''}`;
    editHint.textContent=playing?'Pause or drag a joint to edit':(activeJoint?`Editing ${activeJoint}`:'Drag a white joint handle');
    scrub.value=String(frame);
  }

  function pointerPos(e) {
    const r=canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
  }

  function findJoint(pos) {
    const g=geometry(frames[frame]);
    const list=[['pelvis',g.pelvis],['chest',g.chest],['aK',g.aK],['aF',g.aF],['bK',g.bK],['bF',g.bF],['aE',g.aE],['aW',g.aW],['bE',g.bE],['bW',g.bW]];
    const radius=.075*g.scale;
    let best=null,bestD=Infinity;
    for(const [name,q] of list){const d=Math.hypot(pos.x-q.x,pos.y-q.y);if(d<radius&&d<bestD){best=name;bestD=d;}}
    return best;
  }

  function angleFromDown(root, p) { return Math.atan2(p.x-root.x, p.y-root.y); }

  function solve2Bone(root, target, l1, l2, currentJoint) {
    const dx=target.x-root.x,dy=target.y-root.y;
    let d=Math.hypot(dx,dy)||.0001;
    const minD=Math.abs(l1-l2)+.0001,maxD=l1+l2-.0001;
    const cd=clamp(d,minD,maxD);
    const scale=cd/d;
    const tx=root.x+dx*scale,ty=root.y+dy*scale;
    const aim=Math.atan2(tx-root.x,ty-root.y);
    const cosOff=clamp((l1*l1+cd*cd-l2*l2)/(2*l1*cd),-1,1);
    const off=Math.acos(cosOff);
    const candidates=[aim+off,aim-off];
    let best=null,bestDist=Infinity;
    for(const upper of candidates){
      const j=pointFrom(root,upper,l1);
      const dist=Math.hypot(j.x-currentJoint.x,j.y-currentJoint.y);
      if(dist<bestDist){bestDist=dist;best={upper,j};}
    }
    const lower=Math.atan2(tx-best.j.x,ty-best.j.y);
    return {upper:wrapAngle(best.upper),lower:wrapAngle(lower)};
  }

  function editJoint(name, pos) {
    const p=frames[frame];
    const g=geometry(p);
    const s=g.scale;
    if (name==='pelvis') {
      p.pelvisY=clamp((g.groundY-pos.y)/s,.78,1.12);
    } else if (name==='chest') {
      p.lean=clamp(Math.atan2(pos.x-g.pelvis.x,g.pelvis.y-pos.y),-25*DEG,25*DEG);
    } else if (name==='aK') {
      const rel=wrapAngle(p.aLowerLeg-p.aUpperLeg); p.aUpperLeg=angleFromDown(g.hipA,pos); p.aLowerLeg=wrapAngle(p.aUpperLeg+rel);
    } else if (name==='bK') {
      const rel=wrapAngle(p.bLowerLeg-p.bUpperLeg); p.bUpperLeg=angleFromDown(g.hipB,pos); p.bLowerLeg=wrapAngle(p.bUpperLeg+rel);
    } else if (name==='aE') {
      const rel=wrapAngle(p.aLowerArm-p.aUpperArm); p.aUpperArm=angleFromDown(g.shA,pos); p.aLowerArm=wrapAngle(p.aUpperArm+rel);
    } else if (name==='bE') {
      const rel=wrapAngle(p.bLowerArm-p.bUpperArm); p.bUpperArm=angleFromDown(g.shB,pos); p.bLowerArm=wrapAngle(p.bUpperArm+rel);
    } else if (name==='aF') {
      const r=solve2Bone(g.hipA,pos,BODY.upperLeg*s,BODY.lowerLeg*s,g.aK); p.aUpperLeg=r.upper;p.aLowerLeg=r.lower;
    } else if (name==='bF') {
      const r=solve2Bone(g.hipB,pos,BODY.upperLeg*s,BODY.lowerLeg*s,g.bK); p.bUpperLeg=r.upper;p.bLowerLeg=r.lower;
    } else if (name==='aW') {
      const r=solve2Bone(g.shA,pos,BODY.upperArm*s,BODY.lowerArm*s,g.aE); p.aUpperArm=r.upper;p.aLowerArm=r.lower;
    } else if (name==='bW') {
      const r=solve2Bone(g.shB,pos,BODY.upperArm*s,BODY.lowerArm*s,g.bE); p.bUpperArm=r.upper;p.bLowerArm=r.lower;
    }
    draw();
  }

  canvas.addEventListener('pointerdown',e=>{
    const pos=pointerPos(e); const joint=findJoint(pos); if(!joint)return;
    playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');
    activeJoint=joint;activePointer=e.pointerId;canvas.setPointerCapture?.(e.pointerId);editJoint(joint,pos);
  });
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===activePointer&&activeJoint)editJoint(activeJoint,pointerPos(e));});
  function endDrag(e){if(e.pointerId!==activePointer)return;activePointer=null;activeJoint=null;draw();}
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);

  function step(dir) {
    if(keysOnly){frame=(frame+dir*2+16)%16;if(frame%2)frame=(frame+1)%16;}else frame=(frame+dir+16)%16;
    lastAdvance=performance.now();draw();
  }

  function animate(now) {
    if(playing){const interval=1000/fps;if(now-lastAdvance>=interval){step(1);lastAdvance=now;}}
    requestAnimationFrame(animate);
  }

  function rebuildMids() {
    for(let i=0;i<8;i++){
      const a=frames[i*2]; const b=frames[((i+1)%8)*2];
      frames[i*2+1]=interpolatePose(a,b,.5,`${a.name} → ${b.name}`);
    }
    draw();
  }

  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function saveJSON(){
    const data={type:'GameHubWalkLab',version:2,fps,body:BODY,frames};
    downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'walk-lab-animation.json');
  }

  async function loadJSON(file){
    try{
      const data=JSON.parse(await file.text());
      if(!data||!Array.isArray(data.frames)||data.frames.length!==16)throw new Error('Expected a 16-frame Walk Lab animation.');
      frames=data.frames.map((p,i)=>({...clonePose(p),key:i%2===0}));
      if(Number.isFinite(data.fps)){fps=clamp(Math.round(data.fps),4,24);fpsSlider.value=String(fps);fpsOut.textContent=`${fps} fps`;}
      frame=0;playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');draw();
    }catch(err){alert(`Could not load animation: ${err.message}`);}
  }

  function exportPNG(){
    const cellW=280,cellH=360,cols=4,rows=4;
    const out=document.createElement('canvas');out.width=cellW*cols;out.height=cellH*rows;
    const c=out.getContext('2d');c.clearRect(0,0,out.width,out.height);
    frames.forEach((p,i)=>{
      const col=i%cols,row=Math.floor(i/cols);
      c.save();c.translate(col*cellW,row*cellH);
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
  copyBtn.addEventListener('click',()=>{copiedPose=clonePose(frames[frame]);pasteBtn.disabled=false;});
  pasteBtn.addEventListener('click',()=>{if(!copiedPose)return;const keepName=frames[frame].name,keepKey=frames[frame].key;frames[frame]={...clonePose(copiedPose),name:keepName,key:keepKey};draw();});
  saveBtn.addEventListener('click',saveJSON);
  loadBtn.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',()=>{const f=fileInput.files?.[0];if(f)loadJSON(f);fileInput.value='';});
  exportBtn.addEventListener('click',exportPNG);
  fpsSlider.addEventListener('input',()=>{fps=Number(fpsSlider.value);fpsOut.value=`${fps} fps`;fpsOut.textContent=`${fps} fps`;lastAdvance=performance.now();});
  window.addEventListener('resize',draw,{passive:true});

  draw();
  requestAnimationFrame(animate);
})();
