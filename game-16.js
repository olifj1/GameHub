(function(){
  const GH = window.GH;
  const Rig = window.GameHubWalkRig;
  if (!GH || !Rig) return;

  const canvas = document.getElementById('sidescroll-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('sidescroll-status');
  const hint = document.getElementById('sidescroll-hint');
  const error = document.getElementById('sidescroll-error');
  const depthBtn = document.getElementById('sidescroll-depth');
  const depthKey = document.getElementById('sidescroll-depth-key');
  const leftBtn = document.getElementById('sidescroll-left');
  const rightBtn = document.getElementById('sidescroll-right');
  const centreBtn = document.getElementById('sidescroll-centre');
  const runBtn = document.getElementById('sidescroll-run');
  const jumpBtn = document.getElementById('sidescroll-jump');

  const state = {
    camX: 0,
    charX: 0,
    charY: 0,
    vx: 0,
    vy: 0,
    move: 0,
    facing: 1,
    run: false,
    depthView: false,
    onGround: true,
    jumpClock: 1,
    animClock: 0,
    last: 0,
    drag: null,
    sceneLength: 5200
  };

  const images = [];
  const treeImages = [];
  const groundImages = [];
  function loadImage(src, list){
    const image = new Image();
    image.src = src;
    image.onload = () => {};
    image.onerror = () => { if (error) { error.hidden = false; error.textContent = 'A SideScroll asset failed to load.'; } };
    images.push(image);
    list.push(image);
  }
  ['01','02','03','04','05','06'].forEach((id) => loadImage(`sidescroll-tree-${id}.png`, treeImages));
  ['01','02','03','04','05','06','07','08','09','10','11','12'].forEach((id) => loadImage(`sidescroll-ground-${id}.png`, groundImages));

  function seeded(i){
    const x = Math.sin(i * 127.1 + 31.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const layers = [];
  function addSprites(count, depthMin, depthMax, type){
    for (let i = 0; i < count; i += 1) {
      const r = seeded(i + count * 7 + type.length * 11);
      const rr = seeded(i + count * 17 + type.length * 13);
      const depth = GH.lerp(depthMin, depthMax, seeded(i + count * 31));
      layers.push({
        type,
        worldX: GH.lerp(-state.sceneLength * 0.55, state.sceneLength * 0.55, r),
        depth,
        variant: Math.floor(rr * (type === 'tree' ? treeImages.length : groundImages.length)),
        scale: type === 'tree' ? GH.lerp(0.42, 1.28, depth) : GH.lerp(0.36, 1.3, depth),
        baseY: type === 'tree' ? GH.lerp(0.50, 0.8, depth) : GH.lerp(0.72, 0.98, depth),
        flip: seeded(i + 99) > 0.5 ? 1 : -1
      });
    }
  }
  addSprites(26, 0.16, 0.34, 'tree');
  addSprites(22, 0.34, 0.58, 'tree');
  addSprites(30, 0.68, 0.98, 'ground');
  addSprites(34, 1.06, 1.34, 'ground');
  layers.sort((a, b) => a.depth - b.depth);

  function resize(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setHeld(button, held){ button?.classList.toggle('active', !!held); }
  function pressMove(dir){ state.move = dir; if (dir !== 0) state.facing = dir; }
  function releaseMove(dir){ if (state.move === dir) state.move = 0; }

  function bindHold(button, onPress, onRelease){
    if (!button) return;
    const start = (event) => { event.preventDefault(); onPress(); setHeld(button, true); };
    const end = (event) => { if (event) event.preventDefault(); onRelease(); setHeld(button, false); };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointerleave', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('touchstart', start, { passive: false });
    button.addEventListener('touchend', end, { passive: false });
  }

  function triggerJump(){
    if (!state.onGround) return;
    state.onGround = false;
    state.vy = -216;
    state.jumpClock = 0;
    if (jumpBtn) { jumpBtn.classList.add('active'); setTimeout(() => jumpBtn.classList.remove('active'), 180); }
  }

  bindHold(leftBtn, () => pressMove(-1), () => releaseMove(-1));
  bindHold(rightBtn, () => pressMove(1), () => releaseMove(1));
  runBtn?.addEventListener('click', () => { state.run = !state.run; runBtn.classList.toggle('active', state.run); });
  jumpBtn?.addEventListener('click', triggerJump);
  centreBtn?.addEventListener('click', () => {
    state.camX = 0; state.charX = 0; state.charY = 0; state.vx = 0; state.vy = 0; state.move = 0; state.onGround = true; state.jumpClock = 1;
  });
  depthBtn?.addEventListener('click', () => {
    state.depthView = !state.depthView;
    depthBtn.classList.toggle('active', state.depthView);
    depthBtn.setAttribute('aria-pressed', state.depthView ? 'true' : 'false');
    if (depthKey) { depthKey.hidden = !state.depthView; depthKey.setAttribute('aria-hidden', state.depthView ? 'false' : 'true'); }
  });

  canvas.addEventListener('pointerdown', (event) => {
    state.drag = { x: event.clientX, charX: state.charX };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.drag) return;
    const dx = event.clientX - state.drag.x;
    state.charX = state.drag.charX - dx * 1.25;
    state.camX = GH.lerp(state.camX, state.charX, 0.2);
    state.move = 0;
  });
  canvas.addEventListener('pointerup', () => { state.drag = null; });
  canvas.addEventListener('pointercancel', () => { state.drag = null; });

  function drawSky(w, h){
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#d5dfea');
    sky.addColorStop(0.44, '#e5edf2');
    sky.addColorStop(1, '#d8dfe1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const mist = ctx.createLinearGradient(0, h * 0.18, 0, h);
    mist.addColorStop(0, 'rgba(225,236,244,0.0)');
    mist.addColorStop(1, 'rgba(226,235,239,0.5)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, w, h);
  }

  function getPathMetrics(w, h){
    return {
      topY: h * 0.76,
      topH: h * 0.045,
      shoulderH: h * 0.05,
      shoulderW: w * 0.13,
      margin: w * 0.06
    };
  }

  function drawPath(w, h){
    const p = getPathMetrics(w, h);
    const leftOuter = p.margin;
    const rightOuter = w - p.margin;
    const leftTop = leftOuter + p.shoulderW;
    const rightTop = rightOuter - p.shoulderW;
    const bottomY = h * 0.93;

    ctx.beginPath();
    ctx.moveTo(leftOuter, p.topY + p.shoulderH);
    ctx.lineTo(leftTop, p.topY);
    ctx.lineTo(rightTop, p.topY);
    ctx.lineTo(rightOuter, p.topY + p.shoulderH);
    ctx.lineTo(rightOuter, bottomY);
    ctx.lineTo(leftOuter, bottomY);
    ctx.closePath();
    const sideGrad = ctx.createLinearGradient(0, p.topY, 0, bottomY);
    sideGrad.addColorStop(0, '#7f6552');
    sideGrad.addColorStop(1, '#56443b');
    ctx.fillStyle = sideGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(leftTop, p.topY);
    ctx.lineTo(rightTop, p.topY);
    ctx.lineTo(rightTop, p.topY + p.topH);
    ctx.lineTo(leftTop, p.topY + p.topH);
    ctx.closePath();
    const dirt = ctx.createLinearGradient(0, p.topY, 0, p.topY + p.topH);
    dirt.addColorStop(0, '#b28a63');
    dirt.addColorStop(0.5, '#a77b53');
    dirt.addColorStop(1, '#8a6547');
    ctx.fillStyle = dirt;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(leftTop, p.topY, rightTop - leftTop, p.topH);
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#6d513f';
    for (let i = 0; i < 20; i += 1) {
      const y = p.topY + 3 + ((i * 7) % Math.max(6, p.topH - 4));
      ctx.beginPath();
      ctx.moveTo(leftTop - 12 + i * 30, y);
      ctx.lineTo(leftTop + 26 + i * 30, y + 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(199,165,124,0.58)';
    ctx.fillRect(leftTop, p.topY + 4, rightTop - leftTop, 2);

    if (state.depthView) {
      ctx.strokeStyle = 'rgba(39,52,59,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(leftTop, p.topY, rightTop - leftTop, p.topH);
      ctx.strokeRect(leftOuter, p.topY, rightOuter - leftOuter, bottomY - p.topY);
    }
    return p;
  }

  function projectX(worldX, depth, w){
    return w * 0.5 + (worldX - state.camX * depth) * (0.22 + depth * 0.05);
  }

  function drawSprite(sprite, w, h, path){
    const img = sprite.type === 'tree' ? treeImages[sprite.variant] : groundImages[sprite.variant];
    if (!img || !img.complete) return;
    const screenX = projectX(sprite.worldX, sprite.depth, w);
    const screenY = sprite.type === 'tree'
      ? h * GH.lerp(0.76, 0.83, sprite.depth)
      : path.topY + path.topH + GH.lerp(-20, 12, sprite.depth - 0.66);
    const scale = sprite.scale * (sprite.type === 'tree' ? 0.8 : 0.9);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const x = screenX - drawW * 0.5;
    const y = screenY - drawH;

    ctx.save();
    const fog = GH.clamp(1.28 - sprite.depth * 0.62, 0.36, 1);
    ctx.globalAlpha = fog;
    if (sprite.type === 'tree') {
      const hue = sprite.depth < 0.4 ? 'hue-rotate(15deg) saturate(0.55) brightness(1.16)' : sprite.depth < 0.7 ? 'hue-rotate(12deg) saturate(0.72) brightness(1.06)' : 'hue-rotate(24deg) saturate(0.95) brightness(1.0)';
      ctx.filter = hue;
    } else {
      ctx.filter = sprite.depth > 1 ? 'hue-rotate(22deg) saturate(1.05) brightness(0.98)' : 'hue-rotate(10deg) saturate(0.75) brightness(1.05)';
    }
    if (sprite.flip < 0) {
      ctx.translate(x + drawW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, y, drawW, drawH);
    } else {
      ctx.drawImage(img, x, y, drawW, drawH);
    }
    ctx.filter = 'none';

    if (state.depthView) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = sprite.depth < 0.4 ? '#ced8dd' : sprite.depth < 0.8 ? '#84939a' : '#40515b';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, drawW, drawH);
    }
    ctx.restore();
  }

  function render(){
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);
    drawSky(w, h);

    const path = drawPath(w, h);

    layers.filter((s) => s.depth < 1.0).forEach((sprite) => drawSprite(sprite, w, h, path));

    // near edge foliage outside path shoulders
    layers.filter((s) => s.depth >= 1.0).forEach((sprite) => {
      const x = projectX(sprite.worldX, sprite.depth, w);
      if (x < path.margin + path.shoulderW - 20 || x > w - path.margin - path.shoulderW + 20) drawSprite(sprite, w, h, path);
    });

    // character
    const charScreenX = projectX(state.charX, 1, w);
    const charGroundY = path.topY + path.topH + 1;
    let pose;
    const speed = Math.abs(state.vx);
    if (!state.onGround) {
      pose = Rig.getPose('jump', GH.clamp(state.jumpClock / 0.9, 0, 1));
    } else if (speed > 70) {
      pose = Rig.getPose('run', state.animClock);
    } else if (speed > 6) {
      pose = Rig.getPose('walk', state.animClock);
    } else {
      pose = Rig.getPose('walk', 0.12);
    }

    ctx.save();
    ctx.translate(charScreenX, charGroundY + state.charY);
    if (state.facing < 0) ctx.scale(-1, 1);
    Rig.drawCharacter(ctx, pose, { x: 0, y: 0, scale: 0.92, showArt: true, showStick: false, showPlanes: false, shadow: true });
    ctx.restore();

    layers.filter((s) => s.depth >= 1.0).forEach((sprite) => {
      const x = projectX(sprite.worldX, sprite.depth, w);
      if (!(x < path.margin + path.shoulderW - 20 || x > w - path.margin - path.shoulderW + 20)) drawSprite(sprite, w, h, path);
    });

    // front vignette silhouettes
    ctx.fillStyle = 'rgba(33,40,46,0.12)';
    ctx.fillRect(0, h * 0.9, w, h * 0.1);
  }

  function tick(now){
    if (!state.last) state.last = now;
    const dt = Math.min(0.033, (now - state.last) / 1000);
    state.last = now;

    const targetSpeed = state.move * (state.run ? 122 : 68);
    const accel = state.onGround ? 8 : 4;
    state.vx = GH.lerp(state.vx, targetSpeed, Math.min(1, accel * dt));
    if (Math.abs(state.vx) < 0.12) state.vx = 0;
    state.charX += state.vx * dt;
    state.charX = GH.clamp(state.charX, -state.sceneLength * 0.5, state.sceneLength * 0.5);
    if (state.move !== 0) state.facing = state.move;

    if (!state.onGround) {
      state.vy += 420 * dt;
      state.charY += state.vy * dt;
      state.jumpClock += dt;
      if (state.charY >= 0) {
        state.charY = 0;
        state.vy = 0;
        state.onGround = true;
        state.jumpClock = 1;
      }
    }

    const pace = state.run ? 1.42 : 1.0;
    if (Math.abs(state.vx) > 3 && state.onGround) {
      state.animClock = (state.animClock + dt * pace * (0.55 + Math.abs(state.vx) / 88)) % 1;
    }
    state.camX = GH.lerp(state.camX, state.charX, Math.min(1, dt * 3.5));

    if (status) {
      const locomotion = !state.onGround ? 'jump' : Math.abs(state.vx) > 70 ? 'run' : Math.abs(state.vx) > 6 ? 'walk' : 'idle';
      status.textContent = `3D forest · path strip · ${locomotion} · camera X ${state.camX.toFixed(1)}`;
    }
    if (hint) hint.textContent = 'Drag the scene or hold LEFT / RIGHT · toggle RUN · tap JUMP';

    render();
    requestAnimationFrame(tick);
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') pressMove(-1);
    if (event.key === 'ArrowRight') pressMove(1);
    if (event.key === 'Shift') { state.run = true; runBtn?.classList.add('active'); }
    if (event.key === ' ' || event.key === 'ArrowUp') triggerJump();
  });
  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft') releaseMove(-1);
    if (event.key === 'ArrowRight') releaseMove(1);
    if (event.key === 'Shift') { state.run = false; runBtn?.classList.remove('active'); }
  });

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(tick);
})();
