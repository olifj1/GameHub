(() => {
  'use strict';

  const poses = [{"name":"Contact L","pelvisY":0.0,"lean":0.035,"aK":[0.34,0.52],"aF":[0.62,1.0],"bK":[-0.3,0.54],"bF":[-0.53,0.98],"aE":[-0.19,-0.23],"aW":[-0.36,0.02],"bE":[0.2,-0.2],"bW":[0.39,0.04],"key":true,"index":0,"planted":"A"},{"name":"Contact L \u2192 Down L","pelvisY":0.0425,"lean":0.04,"aK":[0.30500000000000005,0.535],"aF":[0.525,0.995],"bK":[-0.29000000000000004,0.525],"bF":[-0.455,0.965],"aE":[-0.16,-0.225],"aW":[-0.32499999999999996,0.039999999999999994],"bE":[0.17,-0.195],"bW":[0.345,0.045],"key":false,"index":1,"planted":"A"},{"name":"Down L","pelvisY":0.085,"lean":0.045,"aK":[0.27,0.55],"aF":[0.43,0.99],"bK":[-0.28,0.51],"bF":[-0.38,0.95],"aE":[-0.13,-0.22],"aW":[-0.29,0.06],"bE":[0.14,-0.19],"bW":[0.3,0.05],"key":true,"index":2,"planted":"A"},{"name":"Down L \u2192 Passing L","pelvisY":0.05,"lean":0.0325,"aK":[0.17500000000000002,0.53],"aF":[0.265,0.995],"bK":[-0.09000000000000002,0.455],"bF":[-0.195,0.82],"aE":[-0.07500000000000001,-0.21000000000000002],"aW":[-0.18,0.08499999999999999],"bE":[0.08000000000000002,-0.19],"bW":[0.19,0.07500000000000001],"key":false,"index":3,"planted":"A"},{"name":"Passing L","pelvisY":0.015,"lean":0.02,"aK":[0.08,0.51],"aF":[0.1,1.0],"bK":[0.1,0.4],"bF":[-0.01,0.69],"aE":[-0.02,-0.2],"aW":[-0.07,0.11],"bE":[0.02,-0.19],"bW":[0.08,0.1],"key":true,"index":4,"planted":"A"},{"name":"Passing L \u2192 Up L","pelvisY":-0.025,"lean":0.0075,"aK":[0.025,0.52],"aF":[-0.04000000000000001,1.0],"bK":[0.195,0.375],"bF":[0.13,0.685],"aE":[0.05499999999999999,-0.195],"aW":[0.1,0.09],"bE":[-0.04999999999999999,-0.185],"bW":[-0.085,0.07500000000000001],"key":false,"index":5,"planted":"A"},{"name":"Up L","pelvisY":-0.065,"lean":-0.005,"aK":[-0.03,0.53],"aF":[-0.18,1.0],"bK":[0.29,0.35],"bF":[0.27,0.68],"aE":[0.13,-0.19],"aW":[0.27,0.07],"bE":[-0.12,-0.18],"bW":[-0.25,0.05],"key":true,"index":6,"planted":"A"},{"name":"Up L \u2192 Contact R","pelvisY":-0.0325,"lean":0.015,"aK":[-0.165,0.535],"aF":[-0.355,0.99],"bK":[0.315,0.435],"bF":[0.445,0.8400000000000001],"aE":[0.165,-0.195],"aW":[0.33,0.05500000000000001],"bE":[-0.155,-0.20500000000000002],"bW":[-0.305,0.035],"key":false,"index":7,"planted":"A"},{"name":"Contact R","pelvisY":0.0,"lean":0.035,"aK":[-0.3,0.54],"aF":[-0.53,0.98],"bK":[0.34,0.52],"bF":[0.62,1.0],"aE":[0.2,-0.2],"aW":[0.39,0.04],"bE":[-0.19,-0.23],"bW":[-0.36,0.02],"key":true,"index":8,"planted":"B"},{"name":"Contact R \u2192 Down R","pelvisY":0.0425,"lean":0.04,"aK":[-0.29000000000000004,0.525],"aF":[-0.455,0.965],"bK":[0.30500000000000005,0.535],"bF":[0.525,0.995],"aE":[0.17,-0.195],"aW":[0.345,0.045],"bE":[-0.16,-0.225],"bW":[-0.32499999999999996,0.039999999999999994],"key":false,"index":9,"planted":"B"},{"name":"Down R","pelvisY":0.085,"lean":0.045,"aK":[-0.28,0.51],"aF":[-0.38,0.95],"bK":[0.27,0.55],"bF":[0.43,0.99],"aE":[0.14,-0.19],"aW":[0.3,0.05],"bE":[-0.13,-0.22],"bW":[-0.29,0.06],"key":true,"index":10,"planted":"B"},{"name":"Down R \u2192 Passing R","pelvisY":0.05,"lean":0.0325,"aK":[-0.09000000000000002,0.455],"aF":[-0.195,0.82],"bK":[0.17500000000000002,0.53],"bF":[0.265,0.995],"aE":[0.08000000000000002,-0.19],"aW":[0.19,0.07500000000000001],"bE":[-0.07500000000000001,-0.21000000000000002],"bW":[-0.18,0.08499999999999999],"key":false,"index":11,"planted":"B"},{"name":"Passing R","pelvisY":0.015,"lean":0.02,"aK":[0.1,0.4],"aF":[-0.01,0.69],"bK":[0.08,0.51],"bF":[0.1,1.0],"aE":[0.02,-0.19],"aW":[0.08,0.1],"bE":[-0.02,-0.2],"bW":[-0.07,0.11],"key":true,"index":12,"planted":"B"},{"name":"Passing R \u2192 Up R","pelvisY":-0.025,"lean":0.0075,"aK":[0.195,0.375],"aF":[0.13,0.685],"bK":[0.025,0.52],"bF":[-0.04000000000000001,1.0],"aE":[-0.04999999999999999,-0.185],"aW":[-0.085,0.07500000000000001],"bE":[0.05499999999999999,-0.195],"bW":[0.1,0.09],"key":false,"index":13,"planted":"B"},{"name":"Up R","pelvisY":-0.065,"lean":-0.005,"aK":[0.29,0.35],"aF":[0.27,0.68],"bK":[-0.03,0.53],"bF":[-0.18,1.0],"aE":[-0.12,-0.18],"aW":[-0.25,0.05],"bE":[0.13,-0.19],"bW":[0.27,0.07],"key":true,"index":14,"planted":"B"},{"name":"Up R \u2192 Contact L","pelvisY":-0.0325,"lean":0.015,"aK":[0.315,0.435],"aF":[0.445,0.8400000000000001],"bK":[-0.165,0.535],"bF":[-0.355,0.99],"aE":[-0.155,-0.20500000000000002],"aW":[-0.305,0.035],"bE":[0.165,-0.195],"bW":[0.33,0.05500000000000001],"key":false,"index":15,"planted":"B"}];
  const canvas = document.getElementById('walklab-canvas');
  const ctx = canvas.getContext('2d');
  const readout = document.getElementById('walklab-readout');
  const scrub = document.getElementById('walklab-scrub');
  const prev = document.getElementById('walklab-prev');
  const next = document.getElementById('walklab-next');
  const playBtn = document.getElementById('walklab-play');
  const onionBtn = document.getElementById('walklab-onion');
  const keysBtn = document.getElementById('walklab-keys');
  const fpsSlider = document.getElementById('walklab-fps');
  const fpsOut = document.getElementById('walklab-fps-out');

  let frame = 0;
  let playing = true;
  let onion = true;
  let keysOnly = false;
  let fps = 14;
  let lastAdvance = performance.now();

  function lerp(a,b,t) { return a+(b-a)*t; }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth*dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight*dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width=w; canvas.height=h; }
  }

  function geometry(p) {
    const W=canvas.width, H=canvas.height;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const scale=Math.min(W*0.31,H*0.43);
    const cx=W*0.50;
    const groundY=H*0.82;
    const pelvis={x:cx,y:groundY-scale*(1.0-p.pelvisY)};
    const chest={x:pelvis.x+p.lean*scale,y:pelvis.y-0.52*scale};
    const head={x:chest.x+0.02*scale,y:chest.y-0.30*scale};
    const hipA={x:pelvis.x-0.04*scale,y:pelvis.y+0.02*scale};
    const hipB={x:pelvis.x+0.04*scale,y:pelvis.y+0.02*scale};
    const shA={x:chest.x-0.06*scale,y:chest.y+0.02*scale};
    const shB={x:chest.x+0.06*scale,y:chest.y+0.02*scale};
    const P=(rel)=>({x:cx+rel[0]*scale,y:groundY-(1.0-rel[1]-p.pelvisY)*scale});
    const A=(rel)=>({x:chest.x+rel[0]*scale,y:chest.y+(rel[1]+0.22)*scale});
    return {scale,cx,groundY,pelvis,chest,head,hipA,hipB,shA,shB,aK:P(p.aK),aF:P(p.aF),bK:P(p.bK),bF:P(p.bF),aE:A(p.aE),aW:A(p.aW),bE:A(p.bE),bW:A(p.bW)};
  }

  function line(points, color, width, alpha=1) {
    ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y); for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y); ctx.stroke(); ctx.restore();
  }

  function circle(p,r,fill,alpha=1,stroke=null) {
    ctx.save(); ctx.globalAlpha=alpha; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(1,r*.16);ctx.stroke();} ctx.restore();
  }

  function drawPose(index, alpha=1, ghost=false) {
    const p=poses[(index+16)%16]; const g=geometry(p);
    const unit=g.scale/118;
    const back=ghost?'#8f999c':'#667176';
    const front=ghost?'#697477':'#28343a';
    const body=ghost?'#859093':'#647177';
    line([g.hipB,g.bK,g.bF],back,8*unit,alpha*.72);
    line([g.shB,g.bE,g.bW],back,7*unit,alpha*.72);
    line([g.pelvis,g.chest],body,13*unit,alpha);
    line([g.chest,{x:g.head.x,y:g.head.y+14*unit}],body,7*unit,alpha);
    circle(g.head,17*unit,ghost?'#9ea7aa':'#adb7ba',alpha,front);
    line([g.hipA,g.aK,g.aF],front,9*unit,alpha);
    line([g.shA,g.aE,g.aW],front,8*unit,alpha);
    const joints=[g.hipA,g.hipB,g.aK,g.bK,g.aF,g.bF,g.shA,g.shB,g.aE,g.bE,g.aW,g.bW,g.pelvis,g.chest];
    for(const q of joints) circle(q,3.3*unit,ghost?'#c4cbcc':'#eceeee',alpha*.85);
    if(!ghost) {
      const planted = p.planted==='A'?g.aF:g.bF;
      line([{x:planted.x-13*unit,y:g.groundY+7*unit},{x:planted.x+13*unit,y:g.groundY+7*unit}],'#718f89',3*unit,1);
    }
  }

  function draw() {
    resize();
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#f3ede7'; ctx.fillRect(0,0,W,H);

    // framing box and fixed baseline
    const pad=W*.055;
    ctx.strokeStyle='rgba(76,82,86,.24)'; ctx.lineWidth=Math.max(1,W*.003);
    ctx.strokeRect(pad,H*.07,W-pad*2,H*.79);
    const g=geometry(poses[frame]);
    ctx.strokeStyle='rgba(60,68,70,.42)'; ctx.lineWidth=Math.max(1,W*.003);
    ctx.beginPath(); ctx.moveTo(pad,g.groundY+8); ctx.lineTo(W-pad,g.groundY+8); ctx.stroke();

    // scrolling floor ticks help expose foot sliding.
    const phase=(frame/16)*52;
    ctx.strokeStyle='rgba(88,100,99,.16)'; ctx.lineWidth=Math.max(1,W*.002);
    for(let x=-60; x<W+60; x+=52) {
      const px=((x-phase)% (W+104));
      ctx.beginPath(); ctx.moveTo(px,g.groundY+12); ctx.lineTo(px+22,g.groundY+12); ctx.stroke();
    }

    if(onion) { drawPose(frame-1,.18,true); drawPose(frame+1,.18,true); }
    drawPose(frame,1,false);

    // fixed root marker
    circle({x:g.cx,y:g.groundY-g.scale},5*Math.min(window.devicePixelRatio||1,2),'#6f8f89',.9);

    const p=poses[frame];
    readout.textContent=`Frame ${frame+1} / 16 · ${p.name} · ${p.key?'KEY':'IN-BETWEEN'}`;
    scrub.value=String(frame);
  }

  function step(dir) {
    if(keysOnly) { frame=(frame+dir*2+16)%16; if(frame%2) frame=(frame+1)%16; }
    else frame=(frame+dir+16)%16;
    lastAdvance=performance.now(); draw();
  }

  function animate(now) {
    if(playing) {
      const interval=1000/fps;
      if(now-lastAdvance>=interval) {
        step(1); lastAdvance=now;
      }
    }
    requestAnimationFrame(animate);
  }

  scrub.addEventListener('input',()=>{frame=Number(scrub.value);playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');draw();});
  prev.addEventListener('click',()=>{playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');step(-1);});
  next.addEventListener('click',()=>{playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');step(1);});
  playBtn.addEventListener('click',()=>{playing=!playing;playBtn.textContent=playing?'Pause':'Play';playBtn.classList.toggle('active',playing);lastAdvance=performance.now();});
  onionBtn.addEventListener('click',()=>{onion=!onion;onionBtn.classList.toggle('active',onion);onionBtn.setAttribute('aria-pressed',String(onion));draw();});
  keysBtn.addEventListener('click',()=>{keysOnly=!keysOnly;keysBtn.classList.toggle('active',keysOnly);keysBtn.setAttribute('aria-pressed',String(keysOnly));if(keysOnly&&frame%2)frame=(frame+1)%16;draw();});
  fpsSlider.addEventListener('input',()=>{fps=Number(fpsSlider.value);fpsOut.value=`${fps} fps`;fpsOut.textContent=`${fps} fps`;lastAdvance=performance.now();});
  window.addEventListener('resize',draw,{passive:true});

  draw();
  requestAnimationFrame(animate);
})();