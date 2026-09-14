(() => {
  'use strict';

  const Rig = window.GameHubWalkRig;
  if (!Rig) return;

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
  const artBtn = document.getElementById('walklab-rigart');
  const stickBtn = document.getElementById('walklab-stick');
  const planesBtn = document.getElementById('walklab-planes');
  const fitBtn = document.getElementById('walklab-fit');
  const fileInput = document.getElementById('walklab-file');
  const clipButtons = [...document.querySelectorAll('.walklab-clip[data-clip]')];

  const clips = {
    walk: Rig.DEFAULT_FRAMES.map(Rig.clone),
    run: Rig.RUN_FRAMES.map(Rig.clone),
    jump: Rig.JUMP_FRAMES.map(Rig.clone)
  };
  const clipCycleMs = { walk:1050, run:720, jump:900 };
  let activeClip = 'walk';
  let frames = clips[activeClip];
  let frame = 0;
  let playing = false;
  let onion = false;
  let keysOnly = false;
  let playPhase = 0;
  let copiedPose = null;
  let lastAnimTime = performance.now();

  let showArt = true;
  let showStick = true;
  let showPlanes = false;
  let rigAtlas = null;

  const SHARED_ANIM_KEY = 'gamehub.walklab.anim.v4';
  const SHARED_CLIPS_KEY = 'gamehub.walklab.anim.v5';
  function persistSharedAnimation(){
    try{
      localStorage.setItem(SHARED_CLIPS_KEY, JSON.stringify({version:13,walk:clips.walk,run:clips.run,jump:clips.jump}));
      // Keep v4 walk compatibility for the previous SideScroll build.
      localStorage.setItem(SHARED_ANIM_KEY, JSON.stringify({version:12,frames:clips.walk}));
    }catch(_){}
  }

  // Editor camera: normalised pan keeps the view stable across DPR/resizes.
  const view = { zoom: 1.0, panX: 0, panY: 0 };
  const pointers = new Map();
  let gesture = null;
  let activeJoint = null;

  function loadRigAtlas() {
    const img = new Image();
    img.onload = () => { rigAtlas = img; draw(); };
    img.onerror = () => { rigAtlas = null; readout.textContent = 'Rig art failed to load'; draw(); };
    img.src = Rig.ATLAS.url.startsWith('data:') ? Rig.ATLAS.url : `${Rig.ATLAS.url}?v=1.8.73`;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
  }

  function screenView(W = canvas.width, H = canvas.height) {
    const baseScale = Math.min(W * 0.39, H * 0.61);
    return {
      scale: baseScale * view.zoom,
      cx: W * (0.50 + view.panX),
      groundY: H * (0.84 + view.panY),
      flipX: 1
    };
  }

  function toScreen(pt, sv = screenView()) { return Rig.projectPoint(pt, sv); }
  function toLocal(pos, sv = screenView()) {
    return { x:(pos.x-sv.cx)/sv.scale, y:(sv.groundY-pos.y)/sv.scale };
  }

  function clipView(phase, sv = screenView()) {
    if (activeClip !== 'jump') return sv;
    const lift = Math.sin(Rig.clamp(phase,0,1) * Math.PI) * .31;
    return {...sv, groundY: sv.groundY - lift * sv.scale};
  }

  function screenGeometry(pose, sv = screenView()) {
    const g = Rig.geometry(pose);
    const o = {...g};
    for (const [k,v] of Object.entries(g)) {
      if (v && typeof v === 'object' && Number.isFinite(v.x) && Number.isFinite(v.y)) o[k] = toScreen(v, sv);
    }
    o.scale = sv.scale; o.cx = sv.cx; o.groundY = sv.groundY; o.local = g;
    return o;
  }

  function line(c,a,b,w,color,alpha=1) {
    c.save(); c.globalAlpha=alpha; c.strokeStyle=color; c.lineWidth=w; c.lineCap='round'; c.lineJoin='round';
    c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke(); c.restore();
  }
  function circle(c,p,r,fill,stroke,alpha=1) {
    c.save(); c.globalAlpha=alpha; c.beginPath(); c.arc(p.x,p.y,r,0,Rig.TAU); c.fillStyle=fill; c.fill();
    if(stroke){c.strokeStyle=stroke;c.lineWidth=Math.max(1,r*.18);c.stroke();} c.restore();
  }

  function drawStick(c,pose,g,opts={}) {
    const ghost=!!opts.ghost, alpha=opts.alpha??1, handles=!!opts.handles, s=g.scale;
    const back=ghost?'#a9b1b2':'#314047', front=ghost?'#bcc3c3':'#aeb8b9', core=ghost?'#a5adae':'#243238';
    const lw=Math.max(3,s*.020);

    // Far leg, now explicitly hip -> knee -> ankle -> toe. The heel is a
    // contact marker, not the ankle itself.
    line(c,g.pelvis,g.bK,lw,back,alpha); line(c,g.bK,g.bAnkle,lw,back,alpha); line(c,g.bAnkle,g.bToe,lw*.78,back,alpha);
    line(c,g.bAnkle,g.bHeel,lw*.60,back,alpha*.9);
    // Far arm.
    line(c,g.shoulder,g.bE,lw*.78,back,alpha); line(c,g.bE,g.bW,lw*.78,back,alpha);
    // Core.
    line(c,g.pelvis,g.chest,lw*1.06,core,alpha); line(c,g.chest,g.neck,lw*.7,core,alpha);
    circle(c,g.head,Rig.BODY.headR*s,ghost?'#c4c8c7':'#f0ebe5',core,alpha);

    // Near leg / foot.
    line(c,g.pelvis,g.aK,lw,front,alpha); line(c,g.aK,g.aAnkle,lw,front,alpha); line(c,g.aAnkle,g.aToe,lw*.78,front,alpha);
    line(c,g.aAnkle,g.aHeel,lw*.60,front,alpha*.9);
    // Near arm.
    line(c,g.shoulder,g.aE,lw*.82,front,alpha); line(c,g.aE,g.aW,lw*.82,front,alpha);

    // Automatic hinges.
    for(const q of [g.aK,g.bK,g.aAnkle,g.bAnkle,g.aE,g.bE]) circle(c,q,Math.max(2.4,s*.012),ghost?'#acb2b2':'#dad6d1',core,alpha*.95);
    circle(c,g.shoulder,Math.max(3,s*.019),ghost?'#acb2b2':'#f0ebe5',core,alpha);

    // Heel contact marks make the difference between heel, ankle and toe clear.
    const footMark=(heel,toe,planted)=>{
      if(!planted)return;
      line(c,{x:heel.x-s*.018,y:heel.y+s*.014},{x:toe.x+s*.018,y:toe.y+s*.014},Math.max(2,s*.007),'#6f8f89',alpha*.9);
    };
    footMark(g.aHeel,g.aToe,pose.planted==='A'); footMark(g.bHeel,g.bToe,pose.planted==='B');

    if(handles&&!ghost){
      const hs=[['pelvis',g.pelvis],['chest',g.chest],['aHeel',g.aHeel],['bHeel',g.bHeel],['aW',g.aW],['bW',g.bW]];
      for(const [name,q] of hs){
        const selected=name===activeJoint;
        circle(c,q,(selected?.030:.024)*s,selected?'#6f8f89':'#fffdfa','#344047',1);
      }
    }
  }

  function drawPlaneDebug(c, pose, sv) {
    const parts = Rig.partsForPose(pose);
    c.save(); c.globalAlpha=.42; c.strokeStyle='#6f8f89'; c.lineWidth=Math.max(1,canvas.width*.002); c.setLineDash([5,4]);
    for(const part of parts){
      const r=Rig.atlasRect(part.name); if(!r)continue;
      const A=Rig.projectPoint(part.a,sv),B=Rig.projectPoint(part.b,sv);
      const p0={x:r.a0[0]*r.w,y:r.a0[1]*r.h},p1={x:r.a1[0]*r.w,y:r.a1[1]*r.h};
      const svx=p1.x-p0.x,svy=p1.y-p0.y,dvx=B.x-A.x,dvy=B.y-A.y;
      const sl=Math.hypot(svx,svy)||1,dl=Math.hypot(dvx,dvy)||1,sc=dl/sl,rot=Math.atan2(dvy,dvx)-Math.atan2(svy,svx);
      const tr=(x,y)=>{
        const lx=(x-p0.x)*sc,ly=(y-p0.y)*sc,co=Math.cos(rot),si=Math.sin(rot);
        return {x:A.x+lx*co-ly*si,y:A.y+lx*si+ly*co};
      };
      const q=[tr(0,0),tr(r.w,0),tr(r.w,r.h),tr(0,r.h)];
      c.beginPath();c.moveTo(q[0].x,q[0].y);q.slice(1).forEach(v=>c.lineTo(v.x,v.y));c.closePath();c.stroke();

      // Orientation audit: show the authoritative A→B axis used by each plane.
      c.save(); c.setLineDash([]); c.globalAlpha=.8; c.strokeStyle='#9a554d'; c.fillStyle='#9a554d';
      c.beginPath(); c.moveTo(A.x,A.y); c.lineTo(B.x,B.y); c.stroke();
      const ang=Math.atan2(B.y-A.y,B.x-A.x),ah=Math.max(5,canvas.width*.009);
      c.beginPath();
      c.moveTo(B.x,B.y);
      c.lineTo(B.x-Math.cos(ang-.55)*ah,B.y-Math.sin(ang-.55)*ah);
      c.lineTo(B.x-Math.cos(ang+.55)*ah,B.y-Math.sin(ang+.55)*ah);
      c.closePath(); c.fill(); c.restore();
    }
    c.restore();
  }

  function draw() {
    resize();
    const W=canvas.width,H=canvas.height,sv=screenView(W,H);
    const phase=playing?playPhase:frame/16;
    const pose=playing?Rig.sampleFrames(frames,playPhase):frames[frame];
    const charView=clipView(phase,sv);
    const g=screenGeometry(pose,charView);
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#f3ede7';ctx.fillRect(0,0,W,H);

    const pad=W*.055;
    ctx.strokeStyle='rgba(76,82,86,.20)';ctx.lineWidth=Math.max(1,W*.003);ctx.strokeRect(pad,H*.07,W-pad*2,H*.81);
    ctx.strokeStyle='rgba(60,68,70,.40)';ctx.beginPath();ctx.moveTo(pad,sv.groundY);ctx.lineTo(W-pad,sv.groundY);ctx.stroke();

    // Travelling ground marks for foot-slide checking.
    const spacing=sv.scale*.25,travelPx=(pose.travel||0)*sv.scale,offset=-((travelPx%spacing)+spacing)%spacing;
    ctx.strokeStyle='rgba(88,100,99,.15)';ctx.lineWidth=Math.max(1,W*.002);
    for(let x=offset-spacing;x<W+spacing;x+=spacing){ctx.beginPath();ctx.moveTo(x,g.groundY+sv.scale*.025);ctx.lineTo(x+spacing*.35,g.groundY+sv.scale*.025);ctx.stroke();}

    if(showArt&&rigAtlas) Rig.drawCanvas(ctx,rigAtlas,pose,charView,{alpha:.98});
    if(showPlanes) drawPlaneDebug(ctx,pose,charView);

    if(onion&&showStick){
      const pp=frames[(frame+15)%16],pn=frames[(frame+1)%16];
      drawStick(ctx,pp,screenGeometry(pp,charView),{ghost:true,alpha:.16});
      drawStick(ctx,pn,screenGeometry(pn,charView),{ghost:true,alpha:.16});
    }
    if(showStick) drawStick(ctx,pose,g,{handles:true});

    const plant=pose.planted==='A'?'LEFT PLANT':pose.planted==='B'?'RIGHT PLANT':'AIRBORNE';
    const clipLabel=activeClip.toUpperCase();
    readout.textContent=playing
      ? `Playing ${clipLabel} · ${plant} · ${Math.round(view.zoom*100)}%`
      : `${clipLabel} · Frame ${frame+1} / 16 · ${pose.name} · ${pose.key?'KEY':'IN-BETWEEN'} · ${plant} · ${Math.round(view.zoom*100)}%`;
    editHint.textContent=activeJoint?`Editing ${activeJoint}`:'Drag joints · drag empty space to pan · pinch to zoom';
    if(!playing) scrub.value=String(frame);
  }

  function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}

  function findJoint(pos){
    const g=screenGeometry(frames[frame],clipView(frame/16)),s=g.scale;
    const list=[['pelvis',g.pelvis],['chest',g.chest],['aHeel',g.aHeel],['bHeel',g.bHeel],['aW',g.aW],['bW',g.bW]];
    const radius=.080*s; let best=null,bestD=Infinity;
    for(const [name,q] of list){const d=Math.hypot(pos.x-q.x,pos.y-q.y);if(d<radius&&d<bestD){best=name;bestD=d;}}
    return best;
  }

  function editJoint(name,pos){
    const p=frames[frame],sv=clipView(frame/16),local=toLocal(pos,sv),lg=Rig.geometry(p);
    if(name==='pelvis') p.pelvisY=Rig.clamp(local.y,.445,.545);
    else if(name==='chest') p.lean=Rig.clamp(Math.atan2(local.x-lg.pelvis.x,local.y-lg.pelvis.y),-18*Rig.DEG,20*Rig.DEG);
    else if(name==='aHeel'||name==='bHeel'){
      const prefix=name==='aHeel'?'a':'b';
      const planted=(prefix==='a'&&p.planted==='A')||(prefix==='b'&&p.planted==='B');
      p[`${prefix}FootX`]=Rig.clamp(local.x,-.40,.40);
      p[`${prefix}FootLift`]=planted?0:Rig.clamp(local.y,0,.24);
    } else if(name==='aW'||name==='bW'){
      const prefix=name==='aW'?'a':'b';
      p[`${prefix}HandX`]=Rig.clamp(local.x-lg.shoulder.x,-.28,.28);
      p[`${prefix}HandY`]=Rig.clamp(lg.shoulder.y-local.y,.27,.47);
    }
    persistSharedAnimation();
    draw();
  }

  function beginGesture(){
    if(pointers.size===2){
      const ps=[...pointers.values()],dx=ps[1].x-ps[0].x,dy=ps[1].y-ps[0].y;
      gesture={type:'pinch',dist:Math.hypot(dx,dy)||1,mid:{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2},zoom:view.zoom,panX:view.panX,panY:view.panY};
      activeJoint=null;
    }
  }

  canvas.addEventListener('pointerdown',e=>{
    const pos=pointerPos(e); pointers.set(e.pointerId,pos); canvas.setPointerCapture?.(e.pointerId);
    playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');
    if(pointers.size===1){
      activeJoint=findJoint(pos);
      if(activeJoint) gesture={type:'joint'};
      else gesture={type:'pan',start:pos,panX:view.panX,panY:view.panY};
    } else beginGesture();
    draw();
  });

  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    const pos=pointerPos(e);pointers.set(e.pointerId,pos);
    if(pointers.size===2){
      if(!gesture||gesture.type!=='pinch') beginGesture();
      const ps=[...pointers.values()],dx=ps[1].x-ps[0].x,dy=ps[1].y-ps[0].y,dist=Math.hypot(dx,dy)||1;
      const mid={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};
      const oldSv={scale:Math.min(canvas.width*.39,canvas.height*.61)*gesture.zoom,cx:canvas.width*(.5+gesture.panX),groundY:canvas.height*(.84+gesture.panY)};
      const localMid={x:(gesture.mid.x-oldSv.cx)/oldSv.scale,y:(oldSv.groundY-gesture.mid.y)/oldSv.scale};
      view.zoom=Rig.clamp(gesture.zoom*(dist/gesture.dist),.55,3.2);
      const newScale=Math.min(canvas.width*.39,canvas.height*.61)*view.zoom;
      view.panX=(mid.x-localMid.x*newScale)/canvas.width-.5;
      view.panY=(mid.y+localMid.y*newScale)/canvas.height-.84;
      draw(); return;
    }
    if(activeJoint){ editJoint(activeJoint,pos); return; }
    if(gesture?.type==='pan'){
      view.panX=gesture.panX+(pos.x-gesture.start.x)/canvas.width;
      view.panY=gesture.panY+(pos.y-gesture.start.y)/canvas.height;
      draw();
    }
  });

  function endPointer(e){
    pointers.delete(e.pointerId); activeJoint=null;
    if(pointers.size===1){const [id,pos]=[...pointers.entries()][0];gesture={type:'pan',start:pos,panX:view.panX,panY:view.panY};}
    else gesture=null;
    draw();
  }
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);

  function step(dir){
    if(keysOnly){frame=(frame+dir*2+16)%16;if(frame%2)frame=(frame+1)%16;}else frame=(frame+dir+16)%16;
    playPhase=frame/16;draw();
  }
  function animate(now){
    const dt=Math.min(50,Math.max(0,now-lastAnimTime));
    lastAnimTime=now;
    if(playing){
      playPhase=(playPhase+dt/(clipCycleMs[activeClip]||1050))%1;
      frame=Math.floor(playPhase*16)%16;
      draw();
    }
    requestAnimationFrame(animate);
  }

  function rebuildMids(){
    for(let i=0;i<8;i++){
      const a=Rig.normalizedPose(frames[i*2],i*2),ni=(i+1)%8,b=Rig.normalizedPose(frames[ni*2],ni*2),travelB=ni===0?1:b.travel;
      frames[i*2+1]=Rig.interpolatePose(a,b,.5,`${a.name} → ${b.name}`,travelB);
    }
    persistSharedAnimation();
    draw();
  }
  function resetCycle(){
    const defaults=activeClip==='run'?Rig.RUN_FRAMES:(activeClip==='jump'?Rig.JUMP_FRAMES:Rig.DEFAULT_FRAMES);
    clips[activeClip]=defaults.map(Rig.clone);frames=clips[activeClip];
    frame=0;playPhase=0;playing=false;copiedPose=null;pasteBtn.disabled=true;persistSharedAnimation();fitView();draw();
  }
  function fitView(){view.zoom=1;view.panX=0;view.panY=0;draw();}

  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function saveJSON(){
    const data={type:'GameHubWalkLab',version:13,body:Rig.BODY,activeClip,clips:{walk:clips.walk,run:clips.run,jump:clips.jump}};
    downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'walk-lab-locomotion-v3.json');
  }
  async function loadJSON(file){
    try{
      const data=JSON.parse(await file.text());
      if(data?.clips){
        for(const name of ['walk','run','jump']) if(Array.isArray(data.clips[name])&&data.clips[name].length===16) clips[name]=data.clips[name].map((p,i)=>Rig.normalizedPose(p,i));
        activeClip=['walk','run','jump'].includes(data.activeClip)?data.activeClip:'walk';
      } else if(Array.isArray(data?.frames)&&data.frames.length===16){
        clips[activeClip]=data.frames.map((p,i)=>Rig.normalizedPose(p,i));
      } else throw new Error('Expected Walk Lab locomotion clips or a 16-frame animation.');
      frames=clips[activeClip];frame=0;playPhase=0;playing=false;updateClipButtons();persistSharedAnimation();fitView();draw();
    }catch(err){alert(`Could not load animation: ${err.message}`);}
  }

  function updateClipButtons(){
    clipButtons.forEach(btn=>{
      const active=btn.dataset.clip===activeClip;
      btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
    });
  }
  function switchClip(name){
    if(!clips[name])return;
    activeClip=name;frames=clips[name];frame=0;playPhase=0;copiedPose=null;pasteBtn.disabled=true;
    updateClipButtons();persistSharedAnimation();draw();
  }
  clipButtons.forEach(btn=>btn.addEventListener('click',()=>switchClip(btn.dataset.clip)));

  scrub.addEventListener('input',()=>{frame=Number(scrub.value);playPhase=frame/16;playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');draw();});
  prev.addEventListener('click',()=>{playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');step(-1);});
  next.addEventListener('click',()=>{playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');step(1);});
  playBtn.addEventListener('click',()=>{playing=!playing;playBtn.textContent=playing?'Pause':'Play';playBtn.classList.toggle('active',playing);if(playing)playPhase=frame/16;lastAnimTime=performance.now();draw();});
  onionBtn.addEventListener('click',()=>{onion=!onion;onionBtn.classList.toggle('active',onion);onionBtn.setAttribute('aria-pressed',String(onion));draw();});
  keysBtn.addEventListener('click',()=>{keysOnly=!keysOnly;keysBtn.classList.toggle('active',keysOnly);keysBtn.setAttribute('aria-pressed',String(keysOnly));if(keysOnly&&frame%2)frame=(frame+1)%16;draw();});
  midsBtn.addEventListener('click',rebuildMids);resetBtn.addEventListener('click',resetCycle);fitBtn.addEventListener('click',fitView);
  copyBtn.addEventListener('click',()=>{copiedPose=Rig.clone(frames[frame]);pasteBtn.disabled=false;});
  pasteBtn.addEventListener('click',()=>{if(!copiedPose)return;const old=frames[frame];frames[frame]={...Rig.clone(copiedPose),name:old.name,key:old.key,travel:old.travel,planted:old.planted};persistSharedAnimation();draw();});
  saveBtn.addEventListener('click',saveJSON);loadBtn.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',()=>{const f=fileInput.files?.[0];if(f)loadJSON(f);fileInput.value='';});
  artBtn.addEventListener('click',()=>{showArt=!showArt;artBtn.classList.toggle('active',showArt);artBtn.setAttribute('aria-pressed',String(showArt));draw();});
  stickBtn.addEventListener('click',()=>{showStick=!showStick;stickBtn.classList.toggle('active',showStick);stickBtn.setAttribute('aria-pressed',String(showStick));draw();});
  planesBtn.addEventListener('click',()=>{showPlanes=!showPlanes;planesBtn.classList.toggle('active',showPlanes);planesBtn.setAttribute('aria-pressed',String(showPlanes));draw();});
  window.addEventListener('resize',draw,{passive:true});

  playBtn.textContent='Play';playBtn.classList.remove('active');onionBtn.classList.remove('active');
  try{
    const savedClips=JSON.parse(localStorage.getItem(SHARED_CLIPS_KEY)||'null');
    if(savedClips){
      if(savedClips.walk?.length===16) clips.walk=savedClips.walk.map((p,i)=>Rig.normalizedPose(p,i));
      if(savedClips.run?.length===16) clips.run=savedClips.run.map((p,i)=>Rig.normalizedPose(p,i));
      if(savedClips.jump?.length===16) clips.jump=savedClips.jump.map((p,i)=>Rig.normalizedPose(p,i));
    } else {
      const saved=JSON.parse(localStorage.getItem(SHARED_ANIM_KEY)||'null');
      if(saved?.frames?.length===16) clips.walk=saved.frames.map((p,i)=>Rig.normalizedPose(p,i));
    }
  }catch(_){}
  frames=clips[activeClip];updateClipButtons();persistSharedAnimation();
  loadRigAtlas();draw();requestAnimationFrame(animate);
})();
