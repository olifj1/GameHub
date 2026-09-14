(function(){
  const GH = window.GH;
  const Rig = window.GameHubWalkRig;
  if (!GH || !Rig) return;

  const canvas = document.getElementById('walklab-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const scrub = document.getElementById('walklab-scrub');
  const readout = document.getElementById('walklab-readout');
  const hint = document.getElementById('walklab-edit-hint');
  const playBtn = document.getElementById('walklab-play');
  const onionBtn = document.getElementById('walklab-onion');
  const keysBtn = document.getElementById('walklab-keys');
  const prevBtn = document.getElementById('walklab-prev');
  const nextBtn = document.getElementById('walklab-next');
  const resetBtn = document.getElementById('walklab-reset');
  const fitBtn = document.getElementById('walklab-fit');
  const saveBtn = document.getElementById('walklab-save');
  const loadBtn = document.getElementById('walklab-load');
  const fileInput = document.getElementById('walklab-file');
  const rigArtBtn = document.getElementById('walklab-rigart');
  const stickBtn = document.getElementById('walklab-stick');
  const planesBtn = document.getElementById('walklab-planes');
  const midsBtn = document.getElementById('walklab-mids');
  const copyBtn = document.getElementById('walklab-copy');
  const pasteBtn = document.getElementById('walklab-paste');
  const animSelect = document.getElementById('walklab-animation');
  const speedSlider = document.getElementById('walklab-speed');
  const speedReadout = document.getElementById('walklab-speed-readout');
  const previewButtons = Array.from(document.querySelectorAll('[data-preview-anim]'));

  const saved = Rig.loadState() || {};
  const state = {
    animation: saved.animation || 'walk',
    speed: saved.speed || 1,
    time: 0,
    playing: true,
    onion: !!saved.onion,
    keysOnly: false,
    showArt: saved.showArt !== false,
    showStick: saved.showStick !== false,
    showPlanes: !!saved.showPlanes,
    panX: saved.panX || 0,
    panY: saved.panY || 0,
    zoom: saved.zoom || 2.05,
    scrub: 0,
    clipboard: null,
    pointer: null,
    pinch: null
  };

  function persist(){
    Rig.saveState({
      animation: state.animation,
      speed: state.speed,
      onion: state.onion,
      showArt: state.showArt,
      showStick: state.showStick,
      showPlanes: state.showPlanes,
      panX: state.panX,
      panY: state.panY,
      zoom: state.zoom
    });
  }

  function resize(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setActive(el, on){ if (el) el.classList.toggle('active', !!on); if (el) el.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  function updateUI(){
    if (animSelect) animSelect.value = state.animation;
    if (speedSlider) speedSlider.value = String(state.speed);
    if (speedReadout) speedReadout.textContent = state.speed.toFixed(1) + 'x';
    if (scrub) scrub.max = String((Rig.animationDefs[state.animation] || Rig.animationDefs.walk).frames - 1);
    setActive(onionBtn, state.onion);
    setActive(keysBtn, state.keysOnly);
    setActive(rigArtBtn, state.showArt);
    setActive(stickBtn, state.showStick);
    setActive(planesBtn, state.showPlanes);
    playBtn.textContent = state.playing ? 'Pause' : 'Play';
    previewButtons.forEach((btn) => setActive(btn, btn.dataset.previewAnim === state.animation));
    const def = Rig.animationDefs[state.animation] || Rig.animationDefs.walk;
    const frameIndex = Math.round(state.scrub);
    if (readout) readout.textContent = `${def.label} · Frame ${frameIndex + 1} / ${def.frames} · ${state.playing ? 'PLAY' : 'SCRUB'}`;
    if (hint) hint.textContent = 'Pan with one finger · pinch to zoom · compare walk, run and jump';
    persist();
  }

  function screenToWorld(x, y){
    const rect = canvas.getBoundingClientRect();
    const px = x - rect.left;
    const py = y - rect.top;
    return {
      x: (px - rect.width * 0.5) / state.zoom - state.panX,
      y: (py - rect.height * 0.78) / state.zoom - state.panY
    };
  }

  function render(){
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#f3efec');
    sky.addColorStop(1, '#ece4de');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w * 0.5, h * 0.78);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(state.panX, state.panY);

    ctx.strokeStyle = 'rgba(110,120,126,0.3)';
    ctx.lineWidth = 1 / state.zoom;
    for (let x = -180; x <= 180; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, -240);
      ctx.lineTo(x, 50);
      ctx.stroke();
    }
    for (let y = -240; y <= 0; y += 30) {
      ctx.beginPath();
      ctx.moveTo(-210, y);
      ctx.lineTo(210, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(94,121,121,0.7)';
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.setLineDash([6 / state.zoom, 6 / state.zoom]);
    ctx.beginPath();
    ctx.moveTo(-220, 0);
    ctx.lineTo(220, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -220);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.setLineDash([]);

    const def = Rig.animationDefs[state.animation] || Rig.animationDefs.walk;
    const frames = Rig.getSampledFrames(state.animation);
    const t = state.playing ? (state.time / def.duration) : (state.scrub / Math.max(1, def.frames));
    const pose = Rig.getPose(state.animation, t);

    if (state.onion) {
      for (let i = -2; i <= 2; i += 1) {
        if (i === 0) continue;
        const p = Rig.getPose(state.animation, (t + i / def.frames + 1) % 1);
        ctx.save();
        ctx.globalAlpha = 0.11;
        Rig.drawCharacter(ctx, p, { x: 0, y: 0, scale: 1.05, showArt: state.showArt, showStick: state.showStick, showPlanes: false, shadow: false });
        ctx.restore();
      }
    }

    if (state.keysOnly) {
      frames.forEach((p, index) => {
        if (index % 4 !== 0) return;
        ctx.save();
        ctx.globalAlpha = 0.14 + (Math.abs(index - state.scrub) < 1 ? 0.08 : 0);
        Rig.drawCharacter(ctx, p, { x: (index - 6) * 24, y: 0, scale: 0.7, showArt: state.showArt, showStick: true, showPlanes: false, shadow: false });
        ctx.restore();
      });
    }

    Rig.drawCharacter(ctx, pose, { x: 0, y: 0, scale: 1.12, showArt: state.showArt, showStick: state.showStick, showPlanes: state.showPlanes, shadow: false });

    ctx.restore();
  }

  function loop(now){
    if (!loop.last) loop.last = now;
    const dt = Math.min(0.033, (now - loop.last) / 1000);
    loop.last = now;
    if (state.playing) {
      state.time += dt * state.speed;
      const def = Rig.animationDefs[state.animation] || Rig.animationDefs.walk;
      state.scrub = (state.time / def.duration) * def.frames % def.frames;
    }
    render();
    updateUI();
    requestAnimationFrame(loop);
  }

  function cycleAnimation(){
    state.animation = state.animation === 'walk' ? 'run' : state.animation === 'run' ? 'jump' : 'walk';
    state.time = 0;
    state.scrub = 0;
    updateUI();
  }

  prevBtn?.addEventListener('click', () => {
    const def = Rig.animationDefs[state.animation] || Rig.animationDefs.walk;
    state.playing = false;
    state.scrub = (state.scrub - 1 + def.frames) % def.frames;
    state.time = (state.scrub / def.frames) * def.duration;
    updateUI();
  });
  nextBtn?.addEventListener('click', () => {
    const def = Rig.animationDefs[state.animation] || Rig.animationDefs.walk;
    state.playing = false;
    state.scrub = (state.scrub + 1) % def.frames;
    state.time = (state.scrub / def.frames) * def.duration;
    updateUI();
  });
  scrub?.addEventListener('input', () => {
    const def = Rig.animationDefs[state.animation] || Rig.animationDefs.walk;
    state.playing = false;
    state.scrub = Number(scrub.value) || 0;
    state.time = (state.scrub / def.frames) * def.duration;
    updateUI();
  });
  playBtn?.addEventListener('click', () => { state.playing = !state.playing; updateUI(); });
  onionBtn?.addEventListener('click', () => { state.onion = !state.onion; updateUI(); });
  keysBtn?.addEventListener('click', () => { state.keysOnly = !state.keysOnly; updateUI(); });
  rigArtBtn?.addEventListener('click', () => { state.showArt = !state.showArt; updateUI(); });
  stickBtn?.addEventListener('click', () => { state.showStick = !state.showStick; updateUI(); });
  planesBtn?.addEventListener('click', () => { state.showPlanes = !state.showPlanes; updateUI(); });
  midsBtn?.addEventListener('click', cycleAnimation);
  resetBtn?.addEventListener('click', () => { state.time = 0; state.scrub = 0; state.animation = 'walk'; updateUI(); });
  fitBtn?.addEventListener('click', () => { state.panX = 0; state.panY = 0; state.zoom = 2.05; updateUI(); });
  copyBtn?.addEventListener('click', () => { state.clipboard = { animation: state.animation, scrub: state.scrub }; pasteBtn.disabled = false; });
  pasteBtn?.addEventListener('click', () => {
    if (!state.clipboard) return;
    state.animation = state.clipboard.animation;
    state.scrub = state.clipboard.scrub;
    state.playing = false;
    updateUI();
  });
  animSelect?.addEventListener('change', () => { state.animation = animSelect.value; state.time = 0; state.scrub = 0; updateUI(); });
  speedSlider?.addEventListener('input', () => { state.speed = Number(speedSlider.value) || 1; updateUI(); });
  previewButtons.forEach((btn) => btn.addEventListener('click', () => { state.animation = btn.dataset.previewAnim; state.time = 0; state.scrub = 0; updateUI(); }));
  saveBtn?.addEventListener('click', () => {
    const payload = {
      animation: state.animation,
      speed: state.speed,
      onion: state.onion,
      showArt: state.showArt,
      showStick: state.showStick,
      showPlanes: state.showPlanes,
      panX: state.panX,
      panY: state.panY,
      zoom: state.zoom
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'walklab-state.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });
  loadBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      Object.assign(state, {
        animation: payload.animation || 'walk',
        speed: payload.speed || 1,
        onion: !!payload.onion,
        showArt: payload.showArt !== false,
        showStick: payload.showStick !== false,
        showPlanes: !!payload.showPlanes,
        panX: payload.panX || 0,
        panY: payload.panY || 0,
        zoom: payload.zoom || 2.05,
        playing: false,
        time: 0,
        scrub: 0
      });
      updateUI();
    } catch (error) {}
  });

  function getTouchDistance(t1, t2){ return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY); }
  canvas.addEventListener('pointerdown', (event) => {
    state.pointer = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.pointer || state.pinch) return;
    const rect = canvas.getBoundingClientRect();
    state.panX = state.pointer.panX + (event.clientX - state.pointer.x) / state.zoom;
    state.panY = state.pointer.panY + (event.clientY - state.pointer.y) / state.zoom;
  });
  canvas.addEventListener('pointerup', () => { state.pointer = null; });
  canvas.addEventListener('pointercancel', () => { state.pointer = null; });
  canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
      state.pinch = {
        distance: getTouchDistance(event.touches[0], event.touches[1]),
        zoom: state.zoom
      };
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    if (event.touches.length === 2 && state.pinch) {
      const current = getTouchDistance(event.touches[0], event.touches[1]);
      state.zoom = GH.clamp(state.pinch.zoom * (current / Math.max(1, state.pinch.distance)), 1.2, 4.5);
    }
  }, { passive: true });
  canvas.addEventListener('touchend', (event) => { if (!event.touches || event.touches.length < 2) state.pinch = null; });

  window.addEventListener('resize', resize);
  resize();
  updateUI();
  requestAnimationFrame(loop);
})();
