(() => {
  'use strict';

  const canvas = document.getElementById('sidescroll-canvas');
  const errorBox = document.getElementById('sidescroll-error');
  const statusEl = document.getElementById('sidescroll-status');
  const hintEl = document.getElementById('sidescroll-hint');
  const debugBtn = document.getElementById('sidescroll-depth');
  const depthKey = document.getElementById('sidescroll-depth-key');
  const leftBtn = document.getElementById('sidescroll-left');
  const rightBtn = document.getElementById('sidescroll-right');
  const resetBtn = document.getElementById('sidescroll-centre');

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: true,
    depth: true,
    premultipliedAlpha: false,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    errorBox.hidden = false;
    errorBox.textContent = 'WebGL is unavailable on this device/browser.';
    return;
  }

  const VERT = `
    attribute vec3 aPosition;
    attribute vec2 aUV;
    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    varying vec2 vUV;
    varying float vDepth;
    void main() {
      vec4 viewPos = uView * uModel * vec4(aPosition, 1.0);
      vUV = aUV;
      vDepth = max(0.0, -viewPos.z);
      gl_Position = uProjection * viewPos;
    }
  `;

  const FRAG = `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec3 uTint;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uFogAmount;
    uniform float uOpacity;
    varying vec2 vUV;
    varying float vDepth;
    void main() {
      vec4 tex = texture2D(uTexture, vUV);
      float alpha = tex.a * uOpacity;
      if (alpha < 0.08) discard;
      float fog = smoothstep(uFogNear, uFogFar, vDepth) * uFogAmount;
      vec3 base = tex.rgb * uTint;
      vec3 rgb = mix(base, uFogColor, fog);
      gl_FragColor = vec4(rgb, alpha);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
    }
    return shader;
  }

  function makeProgram() {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed');
    }
    return program;
  }

  let program;
  try {
    program = makeProgram();
  } catch (err) {
    errorBox.hidden = false;
    errorBox.textContent = `WebGL setup failed: ${err.message}`;
    return;
  }

  const loc = {
    pos: gl.getAttribLocation(program, 'aPosition'),
    uv: gl.getAttribLocation(program, 'aUV'),
    model: gl.getUniformLocation(program, 'uModel'),
    view: gl.getUniformLocation(program, 'uView'),
    projection: gl.getUniformLocation(program, 'uProjection'),
    texture: gl.getUniformLocation(program, 'uTexture'),
    tint: gl.getUniformLocation(program, 'uTint'),
    fogColor: gl.getUniformLocation(program, 'uFogColor'),
    fogNear: gl.getUniformLocation(program, 'uFogNear'),
    fogFar: gl.getUniformLocation(program, 'uFogFar'),
    fogAmount: gl.getUniformLocation(program, 'uFogAmount'),
    opacity: gl.getUniformLocation(program, 'uOpacity')
  };

  // One bottom-anchored XY quad. Every tree/rock/grass card is this real 3D plane
  // translated to a different world-space X/Y/Z and scaled to its physical size.
  const vertices = new Float32Array([
    -0.5, 0.0, 0.0,  0.0, 0.0,
     0.5, 0.0, 0.0,  1.0, 0.0,
    -0.5, 1.0, 0.0,  0.0, 1.0,
     0.5, 1.0, 0.0,  1.0, 1.0
  ]);
  const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.useProgram(program);
  gl.enableVertexAttribArray(loc.pos);
  gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(loc.uv);
  gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 20, 12);
  gl.uniform1i(loc.texture, 0);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearDepth(1);

  function mat4Identity() {
    return new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ]);
  }

  function mat4Model(x, y, z, sx, sy, flipX = false) {
    const s = flipX ? -sx : sx;
    return new Float32Array([
      s,0,0,0,
      0,sy,0,0,
      0,0,1,0,
      x,y,z,1
    ]);
  }

  function mat4View(x, y, z) {
    const m = mat4Identity();
    m[12] = -x;
    m[13] = -y;
    m[14] = -z;
    return m;
  }

  function mat4Perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0
    ]);
  }

  function createTexture(draw, w = 256, h = 512) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw(ctx, w, h);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  function branch(ctx, x1, y1, x2, y2, width) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const textures = {};

  textures.treeA = createTexture((ctx,w,h) => {
    ctx.beginPath();
    ctx.moveTo(w*.43,h);
    ctx.lineTo(w*.47,h*.20);
    ctx.lineTo(w*.53,h*.08);
    ctx.lineTo(w*.58,h);
    ctx.closePath(); ctx.fill();
    branch(ctx,w*.50,h*.42,w*.20,h*.27,w*.055);
    branch(ctx,w*.52,h*.34,w*.78,h*.18,w*.045);
    branch(ctx,w*.49,h*.56,w*.16,h*.47,w*.04);
    branch(ctx,w*.54,h*.60,w*.84,h*.49,w*.035);
    ellipse(ctx,w*.19,h*.25,w*.18,h*.08,-.3);
    ellipse(ctx,w*.80,h*.17,w*.18,h*.075,.28);
    ellipse(ctx,w*.16,h*.46,w*.16,h*.07,.15);
    ellipse(ctx,w*.83,h*.48,w*.15,h*.065,-.2);
  });

  textures.treeB = createTexture((ctx,w,h) => {
    ctx.beginPath();
    ctx.moveTo(w*.39,h);
    ctx.lineTo(w*.47,h*.28);
    ctx.lineTo(w*.41,h*.06);
    ctx.lineTo(w*.52,h*.23);
    ctx.lineTo(w*.61,h);
    ctx.closePath(); ctx.fill();
    branch(ctx,w*.49,h*.40,w*.18,h*.21,w*.05);
    branch(ctx,w*.53,h*.51,w*.88,h*.31,w*.045);
    branch(ctx,w*.46,h*.31,w*.24,h*.11,w*.035);
    branch(ctx,w*.55,h*.24,w*.72,h*.07,w*.03);
    ellipse(ctx,w*.18,h*.19,w*.15,h*.06,-.25);
    ellipse(ctx,w*.88,h*.30,w*.12,h*.055,.15);
    ellipse(ctx,w*.73,h*.07,w*.12,h*.045,-.1);
  });

  textures.treeC = createTexture((ctx,w,h) => {
    ctx.beginPath();
    ctx.moveTo(w*.43,h);
    ctx.lineTo(w*.46,h*.13);
    ctx.lineTo(w*.50,h*.03);
    ctx.lineTo(w*.55,h*.13);
    ctx.lineTo(w*.60,h);
    ctx.closePath(); ctx.fill();
    for (let i=0;i<7;i++) {
      const y = h*(.16 + i*.095);
      const span = w*(.22 + i*.012);
      branch(ctx,w*.50,y,w*.50-span,y+h*.055,w*.026);
      branch(ctx,w*.52,y+h*.018,w*.52+span,y+h*.075,w*.024);
    }
  });

  textures.bush = createTexture((ctx,w,h) => {
    ellipse(ctx,w*.25,h*.72,w*.23,h*.20,-.2);
    ellipse(ctx,w*.50,h*.60,w*.28,h*.27,.05);
    ellipse(ctx,w*.76,h*.73,w*.22,h*.19,.2);
    ctx.fillRect(w*.47,h*.63,w*.06,h*.37);
  },256,256);

  textures.grass = createTexture((ctx,w,h) => {
    ctx.lineWidth = 7;
    for (let i=0;i<16;i++) {
      const startX = w*(.10 + i*.05) + ((i % 2) ? 5 : -5);
      const midX = startX + (((i % 5) - 2) * w * .03);
      const tipX = startX + (((i % 7) - 3) * w * .02);
      const tipY = h*(.18 + (i % 4)*.08);
      ctx.beginPath();
      ctx.moveTo(startX, h);
      ctx.quadraticCurveTo(midX, h*.62, tipX, tipY);
      ctx.stroke();
    }
    ctx.fillRect(w*.10,h*.92,w*.80,h*.08);
  },256,256);

  textures.rock = createTexture((ctx,w,h) => {
    ctx.beginPath();
    ctx.moveTo(w*.08,h*.92);
    ctx.lineTo(w*.18,h*.53);
    ctx.lineTo(w*.41,h*.29);
    ctx.lineTo(w*.70,h*.34);
    ctx.lineTo(w*.91,h*.66);
    ctx.lineTo(w*.86,h*.92);
    ctx.closePath(); ctx.fill();
  },256,256);

  textures.snag = createTexture((ctx,w,h) => {
    ctx.beginPath();
    ctx.moveTo(w*.39,h);
    ctx.lineTo(w*.45,h*.27);
    ctx.lineTo(w*.51,h*.12);
    ctx.lineTo(w*.58,h);
    ctx.closePath(); ctx.fill();
    branch(ctx,w*.49,h*.35,w*.16,h*.18,w*.045);
    branch(ctx,w*.52,h*.46,w*.84,h*.25,w*.04);
    branch(ctx,w*.48,h*.22,w*.31,h*.07,w*.03);
  });

  textures.background = createTexture((ctx,w,h) => {
    const base = ctx.createLinearGradient(0,0,0,h);
    base.addColorStop(0,'rgb(226,232,229)');
    base.addColorStop(.42,'rgb(212,221,218)');
    base.addColorStop(.78,'rgb(196,208,208)');
    base.addColorStop(1,'rgb(183,197,199)');
    ctx.fillStyle = base;
    ctx.fillRect(0,0,w,h);

    const glow = ctx.createRadialGradient(w*.56,h*.44,8,w*.56,h*.44,w*.54);
    glow.addColorStop(0,'rgba(255,255,255,.98)');
    glow.addColorStop(.20,'rgba(247,250,248,.90)');
    glow.addColorStop(.48,'rgba(229,236,233,.48)');
    glow.addColorStop(1,'rgba(226,232,229,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0,0,w,h);

    const lowMist = ctx.createLinearGradient(0,h*.52,0,h);
    lowMist.addColorStop(0,'rgba(236,240,238,0)');
    lowMist.addColorStop(.35,'rgba(231,236,234,.22)');
    lowMist.addColorStop(.78,'rgba(223,229,228,.45)');
    lowMist.addColorStop(1,'rgba(214,223,223,.58)');
    ctx.fillStyle = lowMist;
    ctx.fillRect(0,h*.50,w,h*.50);
  },512,512);

  textures.mist = createTexture((ctx,w,h) => {
    const g = ctx.createRadialGradient(w*.50,h*.55,w*.10,w*.50,h*.55,w*.42);
    g.addColorStop(0,'rgba(255,255,255,.95)');
    g.addColorStop(.36,'rgba(255,255,255,.60)');
    g.addColorStop(.72,'rgba(244,247,246,.24)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
  },512,256);

  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(172903);
  const objects = [];
  const groundY = -4.10;

  function addObject(type,x,z,width,height,opts={}) {
    objects.push({
      type, texture: textures[type], x, y: opts.y ?? groundY, z,
      width, height,
      flip: opts.flip ?? (rand() > .5),
      shade: opts.shade ?? (0.88 + rand()*.16),
      opacity: opts.opacity ?? 1,
      noFog: !!opts.noFog,
      layer: opts.layer || 'mid'
    });
  }

  function scatterLayer(cfg) {
    const treeTypes = cfg.treeTypes || ['treeA','treeB','treeC'];
    const count = cfg.count;
    for (let i=0;i<count;i++) {
      const x = -52 + rand()*104;
      const z = cfg.z + (rand()-.5)*cfg.zJitter;
      const h = cfg.hMin + rand()*(cfg.hMax-cfg.hMin);
      const w = h*(cfg.widthRatioMin + rand()*(cfg.widthRatioMax-cfg.widthRatioMin));
      const t = treeTypes[Math.floor(rand()*treeTypes.length)];
      addObject(t,x,z,w,h,{ layer: cfg.layer, shade: cfg.shadeMin + rand()*(cfg.shadeMax-cfg.shadeMin) });
    }
    const shrubCount = Math.round(count*.72);
    for (let i=0;i<shrubCount;i++) {
      const x = -54 + rand()*108;
      const z = cfg.z + (rand()-.5)*cfg.zJitter;
      if (rand() < .58) {
        const h = cfg.shrubScale*(.65+rand()*.85);
        addObject('bush',x,z,h*1.4,h,{ layer: cfg.layer, shade: cfg.shadeMin + rand()*.08 });
      } else {
        const h = cfg.shrubScale*(.50+rand()*.58);
        addObject('rock',x,z,h*1.35,h,{ layer: cfg.layer, shade: cfg.shadeMin + rand()*.08 });
      }
    }
  }

  // These are genuine world-space depth bands. Camera motion is identical for every object;
  // the apparent parallax comes only from perspective projection and physical Z distance.
  scatterLayer({ layer:'deep', z:-36, zJitter:5, count:24, hMin:26, hMax:34, widthRatioMin:.22, widthRatioMax:.34, shrubScale:4.0, shadeMin:.92, shadeMax:1.04 });
  scatterLayer({ layer:'far',  z:-26, zJitter:5, count:24, hMin:21, hMax:29, widthRatioMin:.22, widthRatioMax:.35, shrubScale:3.2, shadeMin:.86, shadeMax:.98 });
  scatterLayer({ layer:'mid',  z:-15, zJitter:4, count:22, hMin:16, hMax:23, widthRatioMin:.20, widthRatioMax:.34, shrubScale:2.5, shadeMin:.74, shadeMax:.88 });
  scatterLayer({ layer:'near', z:-7,  zJitter:3.5, count:18, hMin:10, hMax:15, widthRatioMin:.19, widthRatioMax:.32, shrubScale:1.7, shadeMin:.58, shadeMax:.74 });

  // Sparse foreground silhouettes between the camera and the notional character plane.
  for (let i=0;i<18;i++) {
    const x = -50 + rand()*100;
    const z = 3.8 + rand()*1.8;
    if (rand() < .70) {
      const h = 1.6 + rand()*2.2;
      addObject('grass',x,z,h*.95,h,{ layer:'foreground', shade:.34 + rand()*.08 });
    } else {
      const h = 5.2 + rand()*4.2;
      addObject(rand()>.5?'treeA':'snag',x,z,h*.25,h,{ layer:'foreground', shade:.30 + rand()*.08 });
    }
  }

  // A few near rocks give the bottom silhouette some readable motion.
  for (let i=0;i<18;i++) {
    const h = .60 + rand()*1.0;
    addObject('rock',-48+rand()*96,1.8+rand()*2.6,h*1.5,h,{layer:'foreground',shade:.34+rand()*.08});
  }

  // Ground-level mist cards create the cohesive light fog seen between the trees,
  // instead of only lightening the trees themselves.
  for (const band of [
    { z:-34, count:7, widthMin:20, widthMax:30, heightMin:7, heightMax:10, y:groundY-0.4, opacity:0.34 },
    { z:-24, count:8, widthMin:14, widthMax:22, heightMin:5, heightMax:8, y:groundY-0.55, opacity:0.24 },
    { z:-15, count:8, widthMin:11, widthMax:17, heightMin:4, heightMax:6, y:groundY-0.7, opacity:0.15 }
  ]) {
    for (let i=0;i<band.count;i++) {
      const width = band.widthMin + rand()*(band.widthMax-band.widthMin);
      const height = band.heightMin + rand()*(band.heightMax-band.heightMin);
      addObject('mist', -56 + rand()*112, band.z + (rand()-.5)*4.0, width, height, {
        y: band.y + rand()*0.45,
        layer: 'mist',
        shade: 1,
        opacity: band.opacity * (0.85 + rand()*0.3),
        noFog: true,
        flip: rand() > .5
      });
    }
  }

  // Render far-to-near. Depth testing still decides visibility; the order mainly improves soft edges.
  objects.sort((a,b) => a.z - b.z);

  const background = {
    texture: textures.background,
    x: 0, y: -15, z: -49,
    width: 180, height: 55,
    shade: 1, opacity: 1, noFog: true, layer: 'background'
  };

  const fogColor = [0.92, 0.95, 0.94];
  const baseTint = [0.038, 0.050, 0.058];
  const debugTints = {
    foreground:[0.68,0.34,0.27],
    near:[0.66,0.42,0.34],
    mid:[0.42,0.58,0.54],
    far:[0.38,0.49,0.67],
    deep:[0.43,0.49,0.64],
    mist:[0.90,0.94,0.97]
  };

  const camera = { x:0, y:-2.35, z:14.5, minX:-36, maxX:36 };
  let projection = mat4Identity();
  let debugDepth = false;
  let moveLeft = false;
  let moveRight = false;
  let activePointer = null;
  let dragStartX = 0;
  let dragStartCameraX = 0;
  let lastTime = performance.now();
  let hintTimer = window.setTimeout(() => hintEl.classList.add('hidden'), 4200);

  function hideHint() {
    hintEl.classList.add('hidden');
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = 0;
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth*dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight*dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0,0,w,h);
      projection = mat4Perspective(28*Math.PI/180, w/h, .1, 120);
    }
  }

  function tintFor(obj) {
    if (obj.layer === 'background') return [1,1,1];
    if (debugDepth) return debugTints[obj.layer] || [1,1,1];
    return [baseTint[0]*obj.shade, baseTint[1]*obj.shade, baseTint[2]*obj.shade];
  }

  function drawPlane(obj, view) {
    gl.bindTexture(gl.TEXTURE_2D, obj.texture);
    gl.uniformMatrix4fv(loc.model,false,mat4Model(obj.x,obj.y,obj.z,obj.width,obj.height,obj.flip));
    gl.uniformMatrix4fv(loc.view,false,view);
    const tint = tintFor(obj);
    gl.uniform3f(loc.tint,tint[0],tint[1],tint[2]);
    gl.uniform3f(loc.fogColor,fogColor[0],fogColor[1],fogColor[2]);
    gl.uniform1f(loc.fogNear,10.0);
    gl.uniform1f(loc.fogFar,54.0);
    gl.uniform1f(loc.fogAmount,obj.noFog ? 0 : (debugDepth ? .30 : 1.0));
    gl.uniform1f(loc.opacity,obj.opacity);
    gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);
  }

  function render(now) {
    resize();
    const dt = Math.min(.05,(now-lastTime)/1000);
    lastTime = now;

    const dir = (moveRight?1:0) - (moveLeft?1:0);
    if (dir) {
      camera.x += dir * 7.0 * dt;
      camera.x = Math.max(camera.minX,Math.min(camera.maxX,camera.x));
      hideHint();
    }

    gl.clearColor(0.86,0.90,0.90,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(loc.projection,false,projection);
    const view = mat4View(camera.x,camera.y,camera.z);

    // Background remains a real far plane, simply very large in world space.
    drawPlane(background,view);
    for (const obj of objects) drawPlane(obj,view);

    statusEl.textContent = debugDepth
      ? `Depth view · camera X ${camera.x.toFixed(1)} · real Z spacing`
      : `3D planes · camera X ${camera.x.toFixed(1)} · cohesive fog`;

    requestAnimationFrame(render);
  }

  function bindHold(button,setter) {
    const down = e => { e.preventDefault(); setter(true); hideHint(); button.setPointerCapture?.(e.pointerId); };
    const up = e => { e.preventDefault(); setter(false); };
    button.addEventListener('pointerdown',down);
    button.addEventListener('pointerup',up);
    button.addEventListener('pointercancel',up);
    button.addEventListener('lostpointercapture',up);
    button.addEventListener('pointerleave',e => { if (e.pointerType === 'mouse') setter(false); });
  }
  bindHold(leftBtn,v => moveLeft=v);
  bindHold(rightBtn,v => moveRight=v);

  resetBtn.addEventListener('click',() => {
    camera.x = 0;
    hideHint();
  });

  debugBtn.addEventListener('click',() => {
    debugDepth = !debugDepth;
    debugBtn.setAttribute('aria-pressed',String(debugDepth));
    debugBtn.textContent = debugDepth ? 'Normal view' : 'Depth view';
    depthKey.hidden = !debugDepth;
    hideHint();
  });

  canvas.addEventListener('pointerdown',e => {
    activePointer = e.pointerId;
    dragStartX = e.clientX;
    dragStartCameraX = camera.x;
    canvas.setPointerCapture?.(e.pointerId);
    hideHint();
  });

  canvas.addEventListener('pointermove',e => {
    if (e.pointerId !== activePointer) return;
    const dx = e.clientX - dragStartX;
    camera.x = Math.max(camera.minX,Math.min(camera.maxX,dragStartCameraX - dx*.030));
  });

  const endDrag = e => {
    if (e.pointerId === activePointer) activePointer = null;
  };
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);

  window.addEventListener('keydown',e => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { moveLeft = true; hideHint(); }
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { moveRight = true; hideHint(); }
    if (e.key === '0') camera.x = 0;
  });
  window.addEventListener('keyup',e => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveLeft = false;
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveRight = false;
  });

  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',() => {
    moveLeft = false;
    moveRight = false;
    lastTime = performance.now();
  });


  resize();
  requestAnimationFrame(render);
})();
