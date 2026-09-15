(() => {
  'use strict';

  const Rig = window.GameHubWalkRig;
  if (!Rig) return;

  const canvas = document.getElementById('sidescroll-canvas');
  const errorBox = document.getElementById('sidescroll-error');
  const statusEl = document.getElementById('sidescroll-status');
  const hintEl = document.getElementById('sidescroll-hint');
  const debugBtn = document.getElementById('sidescroll-depth');
  const soundBtn = document.getElementById('sidescroll-sound');
  const depthKey = document.getElementById('sidescroll-depth-key');
  const driveControl = document.getElementById('sidescroll-drive');
  const driveThumb = document.getElementById('sidescroll-drive-thumb');
  const jumpBtn = document.getElementById('sidescroll-jump');
  const secondaryControls = document.getElementById('sidescroll-secondary-controls');
  const actionBtn = document.getElementById('sidescroll-action');
  const actionLabel = document.getElementById('sidescroll-action-label');
  const editBtn = document.getElementById('sidescroll-edit');
  const playControls = document.getElementById('sidescroll-play-controls');
  const editorControls = document.getElementById('sidescroll-editor-controls');
  const editorOverlay = document.getElementById('sidescroll-editor-overlay');
  const editorOverlayCtx = editorOverlay?.getContext('2d');
  const editorPalette = document.getElementById('sidescroll-editor-palette');
  const editorAssetsEl = document.getElementById('sidescroll-editor-assets');
  const editorPaletteClose = document.getElementById('sidescroll-editor-palette-close');
  const editorResetBtn = document.getElementById('sidescroll-editor-reset');
  const editorAddBtn = document.getElementById('sidescroll-editor-add');
  const editorDuplicateBtn = document.getElementById('sidescroll-editor-duplicate');
  const editorScaleDownBtn = document.getElementById('sidescroll-editor-scale-down');
  const editorScaleUpBtn = document.getElementById('sidescroll-editor-scale-up');
  const editorGameLayerBtn = document.getElementById('sidescroll-editor-game-layer');
  const editorCollisionBtn = document.getElementById('sidescroll-editor-collision');
  const editorDeleteBtn = document.getElementById('sidescroll-editor-delete');

  // SideScroll audio is deliberately local/offline. iOS requires the
  // AudioContext to be unlocked by a genuine user gesture. Fetch the audio
  // bytes immediately so the first tap only has to resume/decode them, then
  // keep retrying the ambience start after later gestures/visibility changes.
  const SideScrollAudio = (() => {
    const ENABLE_KEY = 'gamehub.sidescroll.audio.enabled.v1';
    const VERSION = '1.8.85';
    const files = {
      forest: `sidescroll-audio-forest.mp3?v=${VERSION}`,
      jump: `sidescroll-audio-jump.mp3?v=${VERSION}`,
      land: `sidescroll-audio-land.mp3?v=${VERSION}`,
      cratePickup: `sidescroll-audio-crate-pickup.mp3?v=${VERSION}`,
      crateDrop: `sidescroll-audio-crate-drop.mp3?v=${VERSION}`,
      footsteps: Array.from({ length: 4 }, (_, i) => `sidescroll-audio-footstep-${String(i).padStart(2,'0')}.mp3?v=${VERSION}`)
    };

    // iPhone Home-Screen PWAs have had several WebKit regressions where a
    // Web Audio AudioContext claims to be running but produces silence. For
    // SideScroll we therefore use ordinary HTMLMediaElement playback. It is
    // less clever, but much more resilient for a small set of local sounds.
    let enabled = true;
    let ambient = null;
    let pools = new Map();
    let poolCursor = new Map();
    let lastFootstep = -1;
    let mediaGeneration = 0;
    let lastPlaySucceeded = false;

    try {
      if (localStorage.getItem(ENABLE_KEY) === '0') enabled = false;
    } catch (_) {}

    function updateButton() {
      if (!soundBtn) return;
      soundBtn.textContent = enabled ? 'Sound' : 'Muted';
      soundBtn.setAttribute('aria-pressed', String(!enabled));
      soundBtn.setAttribute('aria-label', enabled ? 'Mute sound' : 'Turn sound on');
      soundBtn.dataset.audioReady = lastPlaySucceeded ? '1' : '0';
    }

    function makeAudio(src, { loop = false } = {}) {
      const audio = document.createElement('audio');
      audio.src = src;
      audio.preload = 'auto';
      audio.loop = loop;
      audio.playsInline = true;
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      audio.setAttribute('aria-hidden', 'true');
      audio.tabIndex = -1;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      try { audio.load(); } catch (_) {}
      return audio;
    }

    function stopAndRemove(audio) {
      if (!audio) return;
      try { audio.pause(); } catch (_) {}
      try { audio.removeAttribute('src'); } catch (_) {}
      try { audio.load(); } catch (_) {}
      try { audio.remove(); } catch (_) {}
    }

    function destroyMedia() {
      stopAndRemove(ambient);
      ambient = null;
      for (const pool of pools.values()) {
        for (const audio of pool) stopAndRemove(audio);
      }
      pools = new Map();
      poolCursor = new Map();
      lastPlaySucceeded = false;
    }

    function addPool(key, src, count = 3) {
      const pool = [];
      for (let i = 0; i < count; i++) pool.push(makeAudio(src));
      pools.set(key, pool);
      poolCursor.set(key, 0);
    }

    function buildMedia() {
      if (ambient) return;
      const generation = ++mediaGeneration;
      ambient = makeAudio(files.forest, { loop: true });
      ambient.volume = 0.52;

      addPool('jump', files.jump, 2);
      addPool('land', files.land, 2);
      addPool('cratePickup', files.cratePickup, 2);
      addPool('crateDrop', files.crateDrop, 2);
      files.footsteps.forEach((src, i) => addPool(`footstep${i}`, src, 2));

      const noteSuccess = () => {
        if (generation !== mediaGeneration) return;
        lastPlaySucceeded = true;
        updateButton();
      };
      ambient.addEventListener('playing', noteSuccess, { passive: true });
    }

    function ensureMedia() {
      if (!ambient) buildMedia();
    }

    function startAmbience() {
      if (!enabled) return;
      ensureMedia();
      if (!ambient) return;
      ambient.volume = 0.52;
      const promise = ambient.play();
      if (promise && typeof promise.then === 'function') {
        promise.then(() => {
          lastPlaySucceeded = true;
          updateButton();
        }).catch(err => {
          lastPlaySucceeded = false;
          updateButton();
          console.warn('SideScroll ambience play was blocked', err);
        });
      }
    }

    function primeEffectsDuringGesture() {
      // iOS can require each media element to be "blessed" by a user gesture.
      // Start one instance from every pool at effectively silent volume while
      // the pointer event is still active, then rewind it immediately.
      for (const pool of pools.values()) {
        const audio = pool[0];
        if (!audio) continue;
        const previousVolume = audio.volume;
        audio.volume = 0.00001;
        audio.currentTime = 0;
        try {
          const promise = audio.play();
          if (promise && typeof promise.then === 'function') {
            promise.then(() => {
              try { audio.pause(); } catch (_) {}
              try { audio.currentTime = 0; } catch (_) {}
              audio.volume = previousVolume;
            }).catch(() => {
              audio.volume = previousVolume;
            });
          } else {
            try { audio.pause(); } catch (_) {}
            try { audio.currentTime = 0; } catch (_) {}
            audio.volume = previousVolume;
          }
        } catch (_) {
          audio.volume = previousVolume;
        }
      }
    }

    function unlock() {
      if (!enabled) { updateButton(); return; }
      ensureMedia();
      // Keep these calls synchronous with the real pointer/click event. This
      // is the part Safari cares about for media playback permission.
      startAmbience();
      primeEffectsDuringGesture();
      updateButton();
    }

    function play(key, { volume = 1, rate = 1 } = {}) {
      if (!enabled) return;
      ensureMedia();
      const pool = pools.get(key);
      if (!pool || !pool.length) return;
      let index = poolCursor.get(key) || 0;
      const audio = pool[index % pool.length];
      poolCursor.set(key, (index + 1) % pool.length);

      try { audio.pause(); } catch (_) {}
      try { audio.currentTime = 0; } catch (_) {}
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.playbackRate = Math.max(0.55, Math.min(1.65, rate));
      try {
        const promise = audio.play();
        if (promise && typeof promise.then === 'function') {
          promise.then(() => {
            lastPlaySucceeded = true;
            updateButton();
          }).catch(err => {
            console.warn(`SideScroll sound ${key} was blocked`, err);
          });
        }
      } catch (err) {
        console.warn(`SideScroll sound ${key} failed`, err);
      }
    }

    function playFootstep(runAmount = 0, carrying = false) {
      const count = files.footsteps.length;
      if (!count) return;
      let index = Math.floor(Math.random() * count);
      if (count > 1 && index === lastFootstep) {
        index = (index + 1 + Math.floor(Math.random() * (count - 1))) % count;
      }
      lastFootstep = index;
      const run = Math.max(0, Math.min(1, runAmount));
      const volume = (0.34 + run * 0.18) * (carrying ? 0.92 : 1);
      const rate = 0.94 + Math.random() * 0.12 + run * 0.035;
      play(`footstep${index}`, { volume, rate });
    }

    function playLanding(speed = 2) {
      const strength = Math.max(0, Math.min(1, (speed - 0.8) / 4.2));
      play('land', { volume: 0.28 + strength * 0.30, rate: 1.01 - strength * 0.10 });
    }

    function stopAll() {
      if (ambient) {
        try { ambient.pause(); } catch (_) {}
      }
      for (const pool of pools.values()) {
        for (const audio of pool) {
          try { audio.pause(); } catch (_) {}
          try { audio.currentTime = 0; } catch (_) {}
        }
      }
    }

    function setEnabled(next) {
      enabled = Boolean(next);
      try { localStorage.setItem(ENABLE_KEY, enabled ? '1' : '0'); } catch (_) {}
      if (enabled) unlock();
      else stopAll();
      updateButton();
    }

    function toggle() { setEnabled(!enabled); }
    function isEnabled() { return enabled; }

    function recover() {
      // WebKit can leave media output silent after a Home-Screen PWA has been
      // backgrounded. Rebuilding the elements gives the next real gesture a
      // clean media session instead of reusing a poisoned one.
      if (!ambient) return;
      destroyMedia();
      buildMedia();
      updateButton();
    }

    buildMedia();
    updateButton();
    return { unlock, play, playFootstep, playLanding, toggle, isEnabled, updateButton, recover };
  })();

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
    uniform vec2 uUvScale;
    uniform vec2 uUvOffset;
    varying vec2 vUV;
    varying float vDepth;
    void main() {
      vec4 viewPos = uView * uModel * vec4(aPosition, 1.0);
      vUV = aUV * uUvScale + uUvOffset;
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
    uniform float uHighlight;
    uniform vec3 uHighlightColor;
    varying vec2 vUV;
    varying float vDepth;
    void main() {
      vec4 tex = texture2D(uTexture, vUV);
      float alpha = tex.a * uOpacity;
      if (alpha < 0.045) discard;
      float fog = smoothstep(uFogNear, uFogFar, vDepth) * uFogAmount;
      vec3 base = tex.rgb * uTint;
      base = mix(base, uHighlightColor, clamp(uHighlight, 0.0, 1.0) * 0.72);
      vec3 rgb = mix(base, uFogColor, fog * (1.0 - uHighlight * 0.72));
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

  function createProgram() {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    }
    return program;
  }

  let program;
  try {
    program = createProgram();
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
    opacity: gl.getUniformLocation(program, 'uOpacity'),
    highlight: gl.getUniformLocation(program, 'uHighlight'),
    highlightColor: gl.getUniformLocation(program, 'uHighlightColor'),
    uvScale: gl.getUniformLocation(program, 'uUvScale'),
    uvOffset: gl.getUniformLocation(program, 'uUvOffset')
  };

  function createMesh(vertices, indices) {
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return { vbo, ibo, count: indices.length };
  }

  const billboardMesh = createMesh(
    new Float32Array([
      -0.5, 0.0, 0.0,  0.0, 0.0,
       0.5, 0.0, 0.0,  1.0, 0.0,
      -0.5, 1.0, 0.0,  0.0, 1.0,
       0.5, 1.0, 0.0,  1.0, 1.0
    ]),
    new Uint16Array([0,1,2,2,1,3])
  );

  const groundMesh = createMesh(
    new Float32Array([
      -0.5, 0.0,  0.0, 0.0, 0.0,
       0.5, 0.0,  0.0, 1.0, 0.0,
      -0.5, 0.0, -1.0, 0.0, 1.0,
       0.5, 0.0, -1.0, 1.0, 1.0
    ]),
    new Uint16Array([0,1,2,2,1,3])
  );

  // Real path geometry. X runs along the level; Z is the top-down path width.
  // The cross-section keeps the low raised shoulders from v1.8.74, but the
  // whole strip now rolls gently up/down along X so it feels laid through real
  // woodland rather than extruded as a perfectly straight plank.
  const PATH_UNDULATION_A = 0.050;
  const PATH_UNDULATION_B = 0.024;
  function pathUndulationUnit(t) {
    const tau = Math.PI * 2;
    return Math.sin(t * tau * 2.0 + 0.55) * PATH_UNDULATION_A
         + Math.sin(t * tau * 5.0 - 0.80) * PATH_UNDULATION_B;
  }

  function createPathMesh(segments = 48) {
    const rows = [
      { z: 1.00, y: 0.00, v: 0.00 },
      { z: 0.82, y: 0.22, v: 0.12 },
      { z: 0.68, y: 0.12, v: 0.28 },
      { z:-0.68, y: 0.12, v: 0.72 },
      { z:-0.82, y: 0.22, v: 0.88 },
      { z:-1.00, y: 0.00, v: 1.00 }
    ];
    const vertices = [];
    const indices = [];
    for (let ix = 0; ix <= segments; ix++) {
      const t = ix / segments;
      const x = t - 0.5;
      const rise = pathUndulationUnit(t);
      for (const row of rows) {
        vertices.push(x, row.y + rise, row.z, t * 36.0, row.v);
      }
    }
    const rowCount = rows.length;
    for (let ix = 0; ix < segments; ix++) {
      for (let iz = 0; iz < rowCount - 1; iz++) {
        const a = ix * rowCount + iz;
        const b = (ix + 1) * rowCount + iz;
        const c = a + 1;
        const d = b + 1;
        indices.push(a,b,c, c,b,d);
      }
    }
    return createMesh(new Float32Array(vertices), new Uint16Array(indices));
  }

  const pathMesh = createPathMesh();

  function createRigPartMesh(name) {
    const r = Rig.atlasRect(name);
    if (!r) return null;
    const p0x = r.a0[0] * r.w, p0y = r.a0[1] * r.h;
    const left = -p0x, right = r.w - p0x;
    const top = p0y, bottom = p0y - r.h;
    const u0 = r.x / Rig.ATLAS.width, u1 = (r.x + r.w) / Rig.ATLAS.width;
    // Image uploads use UNPACK_FLIP_Y_WEBGL so atlas row coordinates (which are
    // measured from the image top) must be converted into bottom-origin WebGL V.
    // The old mapping sampled the opposite atlas rows, which is why boots/head/
    // torso pieces appeared attached to the correct bones but showed the wrong art.
    const vTop = 1 - (r.y / Rig.ATLAS.height);
    const vBottom = 1 - ((r.y + r.h) / Rig.ATLAS.height);
    return createMesh(
      new Float32Array([
        left, bottom, 0, u0, vBottom,
        right, bottom, 0, u1, vBottom,
        left, top, 0, u0, vTop,
        right, top, 0, u1, vTop
      ]),
      new Uint16Array([0,1,2,2,1,3])
    );
  }

  const rigPartMeshes = {};
  Object.keys(Rig.ATLAS.parts).forEach(name => { rigPartMeshes[name] = createRigPartMesh(name); });

  function bindMesh(mesh) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 20, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
  }

  gl.useProgram(program);
  gl.enableVertexAttribArray(loc.pos);
  gl.enableVertexAttribArray(loc.uv);
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

  function mat4Model(x, y, z, sx, sy, sz, flipX = false) {
    const scaleX = flipX ? -sx : sx;
    return new Float32Array([
      scaleX, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      x, y, z, 1
    ]);
  }

  function mat4Model2D(x, y, z, scale, rotation, mirrorX = 1) {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const sx = scale * mirrorX, sy = scale;
    return new Float32Array([
      c*sx, s*sx, 0, 0,
      -s*sy, c*sy, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1
    ]);
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

  function vec3Normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function vec3Cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function vec3Subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function mat4LookAt(eye, target, up) {
    const z = vec3Normalize(vec3Subtract(eye, target));
    const x = vec3Normalize(vec3Cross(up, z));
    const y = vec3Cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -(x[0]*eye[0] + x[1]*eye[1] + x[2]*eye[2]),
      -(y[0]*eye[0] + y[1]*eye[1] + y[2]*eye[2]),
      -(z[0]*eye[0] + z[1]*eye[1] + z[2]*eye[2]),
      1
    ]);
  }

  function createTexture(draw, w = 256, h = 512, repeat = false) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    return tex;
  }

  const textures = {};
  const assetAspect = {};

  function createImageTexture(url, label = 'image', fallbackUrl = null) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const loadIntoTexture = src => {
      const image = new Image();
      image.onload = () => {
        assetAspect[label] = image.naturalWidth / image.naturalHeight;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      };
      image.onerror = () => {
        if (fallbackUrl && src !== fallbackUrl) {
          loadIntoTexture(fallbackUrl);
          return;
        }
        if (!label.startsWith('ground')) {
          errorBox.hidden = false;
          errorBox.textContent = `${label} asset could not be loaded.`;
        }
      };
      image.src = src;
    };

    loadIntoTexture(url);
    return tex;
  }

  textures.white = createTexture((ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }, 4, 4);


  textures.pathDirt = createTexture((ctx,w,h) => {
    const grad=ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#a9845f');
    grad.addColorStop(.45,'#987352');
    grad.addColorStop(1,'#765844');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    let seed=7319;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<720;i++){
      const x=random()*w,y=random()*h,r=.4+random()*2.2;
      ctx.globalAlpha=.035+random()*.10;
      ctx.fillStyle=random()>.52?'#d1ad7e':'#4f4037';
      ctx.beginPath();ctx.ellipse(x,y,r*1.8,r,.35,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=.10;ctx.strokeStyle='#dbc092';ctx.lineWidth=1;
    for(let i=0;i<18;i++){
      const y=6+i*7+(i%3)*2;ctx.beginPath();ctx.moveTo(-10,y);ctx.bezierCurveTo(55,y+3,135,y-4,270,y+2);ctx.stroke();
    }
    ctx.globalAlpha=1;
  },256,128,true);

  // Forest dressing comes from one authored atlas.
  // This removes the old per-file fallback path which could substitute the
  // full woodland source sheet when an individual PNG failed to load.
  textures.dressingAtlas = createImageTexture('sidescroll-dressing-atlas.png?v=1.8.82', 'SideScroll dressing atlas');
  const assetUv = {
    tree06: { scale: [0.107421875, 0.373046875], offset: [0.003906250, 0.623046875] },
    tree02: { scale: [0.139648438, 0.362304688], offset: [0.115234375, 0.633789062] },
    tree01: { scale: [0.086914062, 0.349609375], offset: [0.258789062, 0.646484375] },
    tree04: { scale: [0.090820312, 0.340332031], offset: [0.349609375, 0.655761719] },
    tree03: { scale: [0.083984375, 0.329101562], offset: [0.444335938, 0.666992188] },
    tree05: { scale: [0.087890625, 0.306640625], offset: [0.532226562, 0.689453125] },
    ground02: { scale: [0.131835938, 0.112792969], offset: [0.624023438, 0.883300781] },
    ground01: { scale: [0.128417969, 0.108886719], offset: [0.759765625, 0.887207031] },
    ground06: { scale: [0.111328125, 0.107421875], offset: [0.003906250, 0.511718750] },
    ground04: { scale: [0.101074219, 0.103027344], offset: [0.119140625, 0.516113281] },
    ground11: { scale: [0.125488281, 0.101074219], offset: [0.224121094, 0.518066406] },
    ground07: { scale: [0.097656250, 0.100585938], offset: [0.353515625, 0.518554688] },
    ground05: { scale: [0.142578125, 0.100097656], offset: [0.455078125, 0.519042969] },
    ground09: { scale: [0.129394531, 0.097656250], offset: [0.601562500, 0.521484375] },
    ground12: { scale: [0.145507812, 0.083496094], offset: [0.734863281, 0.535644531] },
    ground08: { scale: [0.144531250, 0.075683594], offset: [0.003906250, 0.432128906] },
    ground03: { scale: [0.144531250, 0.074707031], offset: [0.152343750, 0.433105469] },
    ground10: { scale: [0.113281250, 0.062500000], offset: [0.300781250, 0.445312500] },
  };
  const assetDimensions = {
    tree01: [237, 955],
    tree02: [382, 990],
    tree03: [230, 899],
    tree04: [248, 929],
    tree05: [240, 837],
    tree06: [293, 1018],
    ground01: [351, 297],
    ground02: [360, 308],
    ground03: [394, 204],
    ground04: [276, 281],
    ground05: [389, 273],
    ground06: [304, 294],
    ground07: [267, 275],
    ground08: [394, 207],
    ground09: [353, 267],
    ground10: [309, 171],
    ground11: [343, 276],
    ground12: [398, 228],
  };
  Object.entries(assetDimensions).forEach(([key, size]) => {
    assetAspect[key] = size[0] / size[1];
    textures[key] = textures.dressingAtlas;
  });

  // Gameplay asset: a deliberately simple, readable wooden crate.  It is
  // generated in code so it has no extra file dependency and can be used as
  // the first editor-authored platform/obstacle.
  assetAspect.crate = 1.08;
  textures.crate = createTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // Fill the texture right down to the billboard baseline.  The previous
    // crate art had transparent padding beneath it, so the geometry was on the
    // path while the visible box appeared to float above it.
    const x = 18, y = 10, cw = 220, ch = 246;
    const topDepth = 20;
    ctx.fillStyle = '#a97b4e';
    ctx.beginPath(); ctx.moveTo(x, y + topDepth); ctx.lineTo(x + 24, y); ctx.lineTo(x + cw, y); ctx.lineTo(x + cw - 22, y + topDepth); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#775339';
    ctx.beginPath(); ctx.moveTo(x + cw - 22, y + topDepth); ctx.lineTo(x + cw, y); ctx.lineTo(x + cw, y + ch - 8); ctx.lineTo(x + cw - 22, y + ch); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(x, y + topDepth, x, y + ch);
    g.addColorStop(0, '#b78654'); g.addColorStop(1, '#8b5f3d');
    ctx.fillStyle = g; ctx.fillRect(x, y + topDepth, cw - 22, ch - topDepth);
    ctx.strokeStyle = '#5d402e'; ctx.lineWidth = 8; ctx.strokeRect(x + 4, y + topDepth + 4, cw - 32, ch - topDepth - 8);
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(x + 12, y + topDepth + 12); ctx.lineTo(x + cw - 36, y + ch - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + cw - 36, y + topDepth + 12); ctx.lineTo(x + 12, y + ch - 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(235,198,143,.42)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 12, y + topDepth + 15); ctx.lineTo(x + cw - 38, y + topDepth + 15); ctx.stroke();
    for (let i=0;i<7;i++) {
      ctx.strokeStyle = `rgba(77,49,32,${0.12 + i*0.012})`; ctx.lineWidth = 2;
      const yy = y + topDepth + 32 + i * 27; ctx.beginPath(); ctx.moveTo(x + 16, yy); ctx.lineTo(x + cw - 42, yy + (i%2?2:-2)); ctx.stroke();
    }
  }, 256, 256, false);

  textures.rigAtlas = createImageTexture(Rig.ATLAS.url.startsWith('data:') ? Rig.ATLAS.url : `${Rig.ATLAS.url}?v=1.8.82`, 'Walk Lab cutout rig atlas');

  function mulberry32(seed) {
    return function() {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(924315);
  const TILE = { minX: -62, maxX: 62 };
  const TILE_WIDTH = TILE.maxX - TILE.minX;
  const WORLD = { nearZ: 10.5, farZ: -42 };
  const fogColor = [0.875, 0.915, 0.945];
  const groundY = -4.55;

  // Think of this exactly like a top-down forest plan: a clear path runs along X,
  // the character walks down its centre, and woodland begins on either side.
  const pathZ = 0.0;
  const PATH_FLAT_HALF = 2.45;
  const PATH_BERM_HALF = 2.95;
  const PATH_OUTER_HALF = 3.60;
  const PATH_TOP_RISE = 0.12;
  const FAR_SIDE_START = -PATH_OUTER_HALF;
  const NEAR_SIDE_START = PATH_OUTER_HALF;

  // First gameplay obstacle: a shin-high fallen log on the path.  It repeats
  // with the scenery tile, giving us a concrete jump-height/distance target.
  const TEST_OBSTACLE_X = 3.35;
  const TEST_OBSTACLE_Z = 0.0;
  const TEST_OBSTACLE_HEIGHT = 0.76;
  const TEST_OBSTACLE_HALF_WIDTH = 0.62;
  const TEST_OBSTACLE_CLEARANCE = 0.68;

  function pathLocalX(x) {
    let local = ((x + TILE_WIDTH * 0.5) % TILE_WIDTH + TILE_WIDTH) % TILE_WIDTH - TILE_WIDTH * 0.5;
    return local;
  }

  function pathUndulationAtX(x) {
    const t = pathLocalX(x) / TILE_WIDTH + 0.5;
    return pathUndulationUnit(t);
  }

  function pathProfileHeight(z) {
    const az = Math.abs(z);
    if (az <= PATH_FLAT_HALF) return PATH_TOP_RISE;
    if (az <= PATH_BERM_HALF) {
      const t = (az - PATH_FLAT_HALF) / Math.max(0.001, PATH_BERM_HALF - PATH_FLAT_HALF);
      return Rig.lerp(PATH_TOP_RISE, 0.22, t);
    }
    if (az <= PATH_OUTER_HALF) {
      const t = (az - PATH_BERM_HALF) / Math.max(0.001, PATH_OUTER_HALF - PATH_BERM_HALF);
      return Rig.lerp(0.22, 0.0, t);
    }
    return 0;
  }

  function pathGroundYAt(x, z = 0) {
    return groundY + pathProfileHeight(z) + pathUndulationAtX(x);
  }

  // One authoritative playable floor height.  Character feet, locked gameplay
  // objects and platform collision all reference this same centre line rather
  // than each using a slightly different interpretation of the path mesh.
  function playSurfaceYAt(x) {
    return pathGroundYAt(x, pathZ);
  }

  const CRATE_HALF_WIDTH_FACTOR = 0.43;
  const CRATE_COLLISION_HEIGHT_FACTOR = 0.96;
  // The painted boots extend up to ~0.087 rig units below their ankle/toe baseline in
  // the v4 atlas.  Raise only the rendered rig by that amount so the visible
  // soles, not the internal bone line, sit on the playable floor.
  const CHARACTER_SOLE_ART_LOCAL_OFFSET = 0.0870;


  // World-anchored dirt floor.  Earlier builds moved this plane with the
  // camera, which made the UV pattern visibly slide beneath gaps in the
  // foliage.  It now spans one complete repeating scene tile in X and reaches
  // from just behind the camera all the way into the fog.  wrapX() moves it by
  // whole tile widths only, so both geometry and UVs remain fixed in world space.
  const GROUND_NEAR_Z = 14.25;
  const ground = {
    mesh: groundMesh,
    texture: textures.pathDirt,
    x: 0,
    y: groundY - 0.015,
    z: GROUND_NEAR_Z,
    sx: TILE_WIDTH,
    sy: 1,
    sz: GROUND_NEAR_Z - WORLD.farZ,
    layer: 'ground',
    tint: [0.63, 0.61, 0.55],
    opacity: 1,
    uvScale: [24, 14],
    noFog: false,
    wrap: true
  };


  const pathStrip = {
    mesh: pathMesh,
    texture: textures.pathDirt,
    x: 0,
    y: groundY,
    z: pathZ,
    sx: TILE_WIDTH,
    sy: 1,
    sz: PATH_OUTER_HALF,
    layer: 'ground',
    tint: [1.02, 0.99, 0.95],
    opacity: 1,
    noFog: false,
    wrap: true
  };

  const backdrop = [];
  const midfill = [];
  const frontOccluders = [];

  const SCENE_STORAGE_KEY = 'gamehub.sidescroll.scene.v2';
  let sceneIdCounter = 0;
  let userSceneCounter = 0;
  let testObstacleObject = null;

  const sceneData = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCENE_STORAGE_KEY) || 'null');
      if (parsed && (parsed.version === 2 || parsed.version === 3 || parsed.version === 4)) {
        parsed.version = 4;
        parsed.overrides ||= {};
        parsed.added ||= [];
        return parsed;
      }
    } catch (_) {}
    return { version: 4, overrides: {}, added: [] };
  })();

  function saveSceneData() {
    try { localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(sceneData)); } catch (_) {}
  }

  function classifyLayer(z) {
    if (z > 1.2) return 'foreground';
    if (z > -9) return 'near';
    if (z > -24) return 'mid';
    return 'far';
  }

  function addObject(collection, type, x, z, width, height, opts = {}) {
    const resolvedHeight = height;
    const resolvedWidth = width ?? resolvedHeight * (assetAspect[type] || 1);
    const category = opts.category || 'dressing';
    const obj = {
      id: opts.id || `proc-${++sceneIdCounter}`,
      mesh: billboardMesh,
      texture: textures[type],
      uvScale: opts.uvScale || assetUv[type]?.scale || [1, 1],
      uvOffset: opts.uvOffset || assetUv[type]?.offset || [0, 0],
      x,
      y: opts.y ?? groundY,
      z,
      sx: resolvedWidth,
      sy: resolvedHeight,
      baseSx: opts.baseSx ?? resolvedWidth,
      baseSy: opts.baseSy ?? resolvedHeight,
      sz: 1,
      flip: opts.flip ?? (rand() > 0.5),
      shade: opts.shade ?? 1,
      opacity: opts.opacity ?? 1,
      noFog: !!opts.noFog,
      tint: opts.tint || null,
      asset: true,
      assetName: type,
      category,
      gameplayType: opts.gameplayType || null,
      gameplayLayerLocked: typeof opts.gameplayLayerLocked === 'boolean' ? opts.gameplayLayerLocked : category === 'gameplay',
      layer: opts.layer || classifyLayer(z),
      wrap: opts.wrap !== false,
      collision: opts.collision ? { ...opts.collision } : null,
      deleted: !!opts.deleted,
      carried: false,
      userAdded: !!opts.userAdded
    };
    collection.push(obj);
    return obj;
  }

  function scatterForest() {
    const trees = ['tree01', 'tree02', 'tree03', 'tree04', 'tree05', 'tree06'];
    const allGround = ['ground01','ground02','ground03','ground04','ground05','ground06','ground07','ground08','ground09','ground10','ground11','ground12'];
    const grassScrub = ['ground01','ground02','ground03','ground05','ground06','ground08','ground09','ground10','ground11','ground12'];
    const rocks = ['ground03','ground04','ground07','ground10','ground11'];
    const edgeGrass = ['ground01','ground06','ground10','ground11'];

    // FAR PATH LIP ----------------------------------------------------------
    // The far edge is the one the side camera reads most clearly, so give it a
    // deliberately continuous low grass seam slightly inside the top of the
    // path.  The pieces overlap the dirt by a few centimetres and hide the
    // geometric line before the larger far-side woodland begins.
    const farLipCount = 238;
    for (let i = 0; i < farLipCount; i++) {
      const spacing = TILE_WIDTH / farLipCount;
      const x = TILE.minX + (i + 0.5) * spacing + (rand() - 0.5) * spacing * 0.72;
      const z = -(PATH_FLAT_HALF - 0.04 + rand() * 0.28);
      const type = edgeGrass[Math.floor(rand() * edgeGrass.length)];
      const height = 0.34 + rand() * 0.34;
      addObject(midfill, type, x, z, null, height, {
        y: pathGroundYAt(x, z) - 0.075,
        shade: 1.015 + rand() * 0.055,
        opacity: 0.96 + rand() * 0.035,
        layer: 'near'
      });
      if (i % 15 === 0 && rand() > 0.28) {
        const rockType = rocks[Math.floor(rand() * rocks.length)];
        addObject(midfill, rockType, x + (rand() - 0.5) * 0.42, z - 0.12 - rand() * 0.18, null, 0.34 + rand() * 0.30, {
          y: pathGroundYAt(x, z) - 0.06,
          shade: 0.99 + rand() * 0.07,
          opacity: 0.97,
          layer: 'near'
        });
      }
    }

    // PATH EDGE DRESSING -----------------------------------------------------
    // A low almost-continuous grass line sits directly on each raised shoulder,
    // hiding the mathematically sharp edge of the path.  Occasional rocks and
    // rooty clumps interrupt that line so it still feels naturally scattered.
    for (let i = 0; i < 145; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = -(PATH_BERM_HALF + 0.02 + rand() * 0.34);
      const type = edgeGrass[Math.floor(rand() * edgeGrass.length)];
      const height = 0.25 + rand() * 0.34;
      addObject(midfill, type, x, z, null, height, {
        y: pathGroundYAt(x, z) - 0.015,
        shade: 1.01 + rand() * 0.06,
        opacity: 0.94 + rand() * 0.05,
        layer: 'near'
      });
    }
    for (let i = 0; i < 155; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = PATH_BERM_HALF + 0.02 + rand() * 0.38;
      const type = edgeGrass[Math.floor(rand() * edgeGrass.length)];
      const height = 0.26 + rand() * 0.36;
      addObject(frontOccluders, type, x, z, null, height, {
        y: pathGroundYAt(x, z) - 0.015,
        shade: 0.99 + rand() * 0.06,
        opacity: 0.95 + rand() * 0.04,
        layer: 'foreground'
      });
    }
    for (let i = 0; i < 24; i++) {
      const nearSide = rand() > 0.5;
      const x = TILE.minX + rand() * TILE_WIDTH;
      const zSign = nearSide ? 1 : -1;
      const z = zSign * (PATH_BERM_HALF + 0.10 + rand() * 0.50);
      const type = rocks[Math.floor(rand() * rocks.length)];
      const height = 0.34 + rand() * 0.38;
      addObject(nearSide ? frontOccluders : midfill, type, x, z, null, height, {
        y: pathGroundYAt(x, z) - 0.02,
        shade: 0.98 + rand() * 0.07,
        opacity: 0.96,
        layer: nearSide ? 'foreground' : 'near'
      });
    }

    // FAR SIDE OF PATH -------------------------------------------------------
    // A dense woodland wall starts clearly behind the path, then gradually
    // thins with depth. This is the main silhouette mass behind the character.
    for (let i = 0; i < 178; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const depth = Math.pow(rand(), 1.45); // bias density toward the path edge
      const z = FAR_SIDE_START - 0.55 - depth * 35.5;
      const type = trees[Math.floor(rand() * trees.length)];
      const height = 9.8 + rand() * (8.2 - depth * 1.8);
      addObject(backdrop, type, x, z, null, height, {
        shade: 0.97 + rand() * 0.10,
        opacity: 0.92 + rand() * 0.08,
        layer: classifyLayer(z)
      });
    }

    // Taller canopy accents deeper in the forest keep the upper frame alive.
    for (let i = 0; i < 42; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = -18.0 - rand() * 21.0;
      const type = trees[Math.floor(rand() * trees.length)];
      const height = 14.0 + rand() * 7.5;
      addObject(backdrop, type, x, z, null, height, {
        shade: 1.00 + rand() * 0.08,
        opacity: 0.86 + rand() * 0.10,
        layer: 'far'
      });
    }

    // Dense undergrowth right along the far path edge hides the bases of the
    // first trees and makes the path boundary feel continuous.
    for (let i = 0; i < 230; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const edgeDepth = Math.pow(rand(), 1.8);
      const z = FAR_SIDE_START - 0.20 - edgeDepth * 8.0;
      const type = grassScrub[Math.floor(rand() * grassScrub.length)];
      const height = 0.72 + rand() * 1.40;
      addObject(midfill, type, x, z, null, height, {
        shade: 1.00 + rand() * 0.08,
        opacity: 0.91 + rand() * 0.08,
        layer: classifyLayer(z)
      });
    }

    // A few rocks/bushes extend further back and help blend the first forest
    // band into the fogged middle distance.
    for (let i = 0; i < 88; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = FAR_SIDE_START - 5.0 - rand() * 13.5;
      const type = allGround[Math.floor(rand() * allGround.length)];
      const height = 0.72 + rand() * 1.50;
      addObject(midfill, type, x, z, null, height, {
        shade: 1.02 + rand() * 0.07,
        opacity: 0.86 + rand() * 0.10,
        layer: classifyLayer(z)
      });
    }

    // NEAR SIDE OF PATH ------------------------------------------------------
    // Keep a real clear corridor in front of the character. Woodland begins
    // several world units closer to camera than the character instead of
    // sitting almost on top of the same Z plane.

    // Dense low path-edge strip. At this Z range perspective naturally drops
    // it lower in frame and gives us stronger foreground parallax.
    for (let i = 0; i < 310; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = NEAR_SIDE_START + 0.25 + rand() * 2.25;
      const type = grassScrub[Math.floor(rand() * grassScrub.length)];
      const height = 0.48 + rand() * 0.58;
      addObject(frontOccluders, type, x, z, null, height, {
        shade: 0.99 + rand() * 0.06,
        opacity: 0.95 + rand() * 0.04,
        layer: 'foreground'
      });
    }

    // Mid-near layer: still mostly small, but not tiny. This should fill the
    // lower third rather than leaving isolated postage-stamp props.
    for (let i = 0; i < 230; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = NEAR_SIDE_START + 2.2 + rand() * 2.45;
      const chooseRock = rand() < 0.28;
      const list = chooseRock ? rocks : grassScrub;
      const type = list[Math.floor(rand() * list.length)];
      const height = 0.55 + rand() * 0.72;
      addObject(frontOccluders, type, x, z, null, height, {
        shade: 0.98 + rand() * 0.07,
        opacity: 0.95 + rand() * 0.04,
        layer: 'foreground'
      });
    }

    // Closest strip: dense grass/rocks with enough real-world size to overlap
    // one another and cover the floor, but still low enough not to hide the
    // character when they pass in front.
    for (let i = 0; i < 205; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = NEAR_SIDE_START + 4.6 + rand() * 2.25;
      const type = allGround[Math.floor(rand() * allGround.length)];
      const height = 0.48 + rand() * 0.78;
      addObject(frontOccluders, type, x, z, null, height, {
        shade: 0.98 + rand() * 0.06,
        opacity: 0.96,
        layer: 'foreground'
      });
    }

    // First gameplay object: a clean wooden crate on the playable strip.
    // Unlike dressing, gameplay assets have authored collision and can be
    // stood on.  This gives the editor a clear object for jump tuning.
    testObstacleObject = addObject(frontOccluders, 'crate', TEST_OBSTACLE_X, TEST_OBSTACLE_Z, 0.96, 0.88, {
      id: 'gameplay-crate-01',
      y: playSurfaceYAt(TEST_OBSTACLE_X),
      shade: 1.0,
      opacity: 1.0,
      layer: 'foreground',
      category: 'gameplay',
      gameplayType: 'crate',
      collision: { halfWidth: 0.44, height: 0.88 * CRATE_COLLISION_HEIGHT_FACTOR, depth: 0.82, platform: true }
    });

    // Occasional larger near-side assets give a stronger sense of passing
    // through woodland, but remain uncommon so the path stays readable.
    for (let i = 0; i < 20; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = NEAR_SIDE_START + 2.5 + rand() * 4.5;
      if (rand() < 0.42) {
        const type = trees[Math.floor(rand() * trees.length)];
        const height = 5.2 + rand() * 4.8;
        addObject(frontOccluders, type, x, z, null, height, {
          shade: 0.92 + rand() * 0.08,
          opacity: 0.95,
          layer: 'foreground'
        });
      } else {
        const type = allGround[Math.floor(rand() * allGround.length)];
        const height = 1.05 + rand() * 1.15;
        addObject(frontOccluders, type, x, z, null, height, {
          shade: 0.96 + rand() * 0.07,
          opacity: 0.96,
          layer: 'foreground'
        });
      }
    }

    backdrop.sort((a, b) => a.z - b.z);
    midfill.sort((a, b) => a.z - b.z);
    frontOccluders.sort((a, b) => a.z - b.z);
  }

  function allSceneObjects() {
    return [...backdrop, ...midfill, ...frontOccluders];
  }

  function targetCollectionForZ(z) {
    if (z > 0.85) return frontOccluders;
    if (z > -12) return midfill;
    return backdrop;
  }

  function moveObjectToCorrectCollection(obj) {
    const target = obj.category === 'gameplay' ? frontOccluders : targetCollectionForZ(obj.z);
    for (const list of [backdrop, midfill, frontOccluders]) {
      const idx = list.indexOf(obj);
      if (idx >= 0 && list !== target) list.splice(idx, 1);
    }
    if (!target.includes(obj)) target.push(obj);
    obj.layer = classifyLayer(obj.z);
  }

  function applyOverrideToObject(obj, override) {
    if (!override) return;
    if (Number.isFinite(override.x)) obj.x = override.x;
    if (Number.isFinite(override.z)) obj.z = override.z;
    if (Number.isFinite(override.sx)) obj.sx = override.sx;
    if (Number.isFinite(override.sy)) obj.sy = override.sy;
    if (typeof override.flip === 'boolean') obj.flip = override.flip;
    if (typeof override.deleted === 'boolean') obj.deleted = override.deleted;
    if (override.category) obj.category = override.category;
    if ('gameplayType' in override) obj.gameplayType = override.gameplayType;
    if (typeof override.gameplayLayerLocked === 'boolean') obj.gameplayLayerLocked = override.gameplayLayerLocked;
    else if (obj.category === 'gameplay' && obj.gameplayLayerLocked == null) obj.gameplayLayerLocked = true;
    if (obj.category === 'gameplay' && obj.gameplayLayerLocked) obj.z = pathZ;
    if (override.collision === null) obj.collision = null;
    else if (override.collision) obj.collision = { ...override.collision };
    obj.y = Number.isFinite(override.y)
      ? override.y
      : (obj.category === 'gameplay' && obj.gameplayLayerLocked ? playSurfaceYAt(obj.x) : pathGroundYAt(obj.x, obj.z));
    moveObjectToCorrectCollection(obj);
  }

  function recordObjectEdit(obj) {
    if (!obj) return;
    if (obj.userAdded) {
      const saved = sceneData.added.find(item => item.id === obj.id);
      const payload = {
        id: obj.id, assetName: obj.assetName, x: obj.x, y: obj.y, z: obj.z,
        sx: obj.sx, sy: obj.sy, flip: obj.flip, collision: obj.collision ? { ...obj.collision } : null,
        category: obj.category || 'dressing', gameplayType: obj.gameplayType || null,
        gameplayLayerLocked: !!obj.gameplayLayerLocked, deleted: !!obj.deleted
      };
      if (saved) Object.assign(saved, payload);
      else sceneData.added.push(payload);
    } else {
      sceneData.overrides[obj.id] = {
        x: obj.x, y: obj.y, z: obj.z, sx: obj.sx, sy: obj.sy, flip: obj.flip,
        collision: obj.collision ? { ...obj.collision } : null, category: obj.category || 'dressing',
        gameplayType: obj.gameplayType || null, gameplayLayerLocked: !!obj.gameplayLayerLocked, deleted: !!obj.deleted
      };
    }
    saveSceneData();
  }

  function restoreSceneEdits() {
    for (const obj of allSceneObjects()) applyOverrideToObject(obj, sceneData.overrides[obj.id]);
    for (const saved of sceneData.added || []) {
      userSceneCounter += 1;
      const collection = saved.category === 'gameplay' || saved.assetName === 'crate' ? frontOccluders : targetCollectionForZ(saved.z);
      const obj = addObject(collection, saved.assetName, saved.x, saved.z, saved.sx, saved.sy, {
        id: saved.id, baseSx: saved.sx, baseSy: saved.sy, flip: saved.flip,
        y: Number.isFinite(saved.y) ? saved.y : ((saved.category === 'gameplay' || saved.assetName === 'crate') ? playSurfaceYAt(saved.x) : pathGroundYAt(saved.x, saved.z)), collision: saved.collision, deleted: saved.deleted,
        userAdded: true, shade: 1.0, opacity: 0.98, layer: classifyLayer(saved.z),
        category: saved.category || (saved.assetName === 'crate' ? 'gameplay' : 'dressing'), gameplayType: saved.gameplayType || (saved.assetName === 'crate' ? 'crate' : null),
        gameplayLayerLocked: typeof saved.gameplayLayerLocked === 'boolean' ? saved.gameplayLayerLocked : (saved.category === 'gameplay' || saved.assetName === 'crate')
      });
      obj.sx = saved.sx; obj.sy = saved.sy;
      if (obj.category === 'gameplay' && obj.gameplayLayerLocked) {
        obj.z = pathZ;
        if (!Number.isFinite(saved.y)) obj.y = playSurfaceYAt(obj.x);
        moveObjectToCorrectCollection(obj);
      }
    }
    backdrop.sort((a,b)=>a.z-b.z);
    midfill.sort((a,b)=>a.z-b.z);
    frontOccluders.sort((a,b)=>a.z-b.z);
  }

  scatterForest();
  restoreSceneEdits();
  settleGameplayCrates();

  const character = {
    x: 0,
    y: playSurfaceYAt(0),
    z: pathZ,
    scale: 2.31,
    tint: [1.0, 1.0, 1.0],
    opacity: 0.99,
    screenOffsetX: -0.18,
    distanceTravelled: 0,
    lastFacing: 1
  };

  function characterRenderY() {
    return character.y + CHARACTER_SOLE_ART_LOCAL_OFFSET * character.scale;
  }

  const SHARED_ANIM_KEY = 'gamehub.walklab.anim.v4';
  const SHARED_CLIPS_KEY = 'gamehub.walklab.anim.v6';
  const PREVIOUS_CLIPS_KEY = 'gamehub.walklab.anim.v5';
  let characterFrames = Rig.DEFAULT_FRAMES.map(Rig.clone);
  let runFrames = Rig.RUN_FRAMES.map(Rig.clone);
  let jumpFrames = Rig.JUMP_FRAMES.map(Rig.clone);
  function refreshCharacterFrames() {
    try {
      const clips = JSON.parse(localStorage.getItem(SHARED_CLIPS_KEY) || 'null');
      if (clips?.walk?.length === 16) characterFrames = clips.walk.map((p,i) => Rig.normalizedPose(p,i));
      if (clips?.run?.length === 16) runFrames = clips.run.map((p,i) => Rig.normalizedPose(p,i));
      if (clips?.jump?.length === 16) jumpFrames = clips.jump.map((p,i) => Rig.normalizedPose(p,i));
      if (!clips?.walk) {
        // Carry forward only the proven walk from the previous locomotion key.
        // Run/jump intentionally reset to the new v1.8.74 defaults so an older
        // saved experiment cannot silently overwrite this refinement pass.
        const previous = JSON.parse(localStorage.getItem(PREVIOUS_CLIPS_KEY) || 'null');
        if (previous?.walk?.length === 16) characterFrames = previous.walk.map((p,i) => Rig.normalizedPose(p,i));
        else {
          const saved = JSON.parse(localStorage.getItem(SHARED_ANIM_KEY) || 'null');
          if (saved?.frames?.length === 16) characterFrames = saved.frames.map((p,i) => Rig.normalizedPose(p,i));
        }
      }
    } catch (_) {}
  }
  refreshCharacterFrames();

  const debugTints = {
    ground: [0.50, 0.46, 0.75],
    character: [0.86, 0.58, 0.32],
    foreground: [0.70, 0.32, 0.28],
    near: [0.67, 0.43, 0.31],
    mid: [0.42, 0.59, 0.55],
    far: [0.37, 0.48, 0.68]
  };

  const camera = {
    x: 0,
    y: -3.00,
    z: 13.80,
    // This is intentionally ABOVE the camera Y: the camera is now actually
    // tilted upward a little, which places the character/path lower in frame.
    targetY: -2.15,
    targetZ: -13.0
  };

  let projection = mat4Identity();
  let debugDepth = false;
  let driveAxis = 0;
  let drivePointer = null;
  let keyLeft = false;
  let keyRight = false;
  let keyRun = false;
  const DRIVE_DEADZONE = 0.08;
  const WALK_POINT = 0.50;
  const WALK_SPEED = 1.15;
  const RUN_SPEED = 2.85;
  const WALK_STRIDE = 1.45;
  const RUN_STRIDE = 2.05;
  const JUMP_VELOCITY = 5.05;
  const JUMP_GRAVITY = 9.20;
  const JUMP_DURATION = (JUMP_VELOCITY * 2) / JUMP_GRAVITY;

  let runBlend = 0;
  let locomotionPhase = 0;
  let jumping = false;
  let jumpTime = 0;
  let jumpOffset = 0;
  let jumpVelocity = 0;
  let standingOnObject = null;

  // Simple gameplay interaction state.  Crates are carried by the live rig,
  // not baked into an animation sheet: locomotion keeps driving the legs while
  // the arms are blended into a stable carrying pose.  Pick-up / put-down are
  // short authored transitions around that same pose.
  let carriedObject = null;
  let interactionState = null; // { type:'pickup'|'drop', time, duration, object, startX, startY, targetX, targetY }
  const ACTION_RANGE = 1.18;
  const PICKUP_DURATION = 0.48;
  const DROP_DURATION = 0.44;
  const CARRY_FORWARD = 0.48;
  const CARRY_BOTTOM = 0.58;

  function phaseCrossed(previous, current, target) {
    if (current >= previous) return previous < target && current >= target;
    return previous < target || current >= target;
  }

  let activePointer = null;
  let dragStartX = 0;
  let dragStartCameraX = 0;

  let editMode = false;
  let selectedObject = null;
  let editorPointer = null;
  let editorDragKind = null;
  let editorDragOffset = { x: 0, z: 0 };
  let editorPanStart = 0;
  let editorPanCameraX = 0;
  let addAssetType = null;
  let editorTapState = null;
  let selectionCycleInfo = null;
  let currentViewMatrix = mat4Identity();
  const editorAssetGroups = [
    { title: 'GAMEPLAY', items: [
      { name: 'crate', label: 'WOODEN CRATE', category: 'gameplay', gameplayType: 'crate' }
    ]},
    { title: 'DRESSING · TREES', items: [
      'tree01','tree02','tree03','tree04','tree05','tree06'
    ].map(name => ({ name, label: `TREE ${Number(name.slice(-2))}`, category: 'dressing' }))},
    { title: 'DRESSING · GROUND', items: [
      'ground01','ground02','ground03','ground04','ground05','ground06',
      'ground07','ground08','ground09','ground10','ground11','ground12'
    ].map(name => ({ name, label: `GROUND ${Number(name.slice(-2))}`, category: 'dressing' }))}
  ];
  const editorAssetInfo = new Map(editorAssetGroups.flatMap(group => group.items.map(item => [item.name, item])));

  let lastTime = performance.now();
  let previousCameraX = camera.x;
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
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      projection = mat4Perspective((31 * Math.PI) / 180, w / h, 0.1, 180);
    }
    if (editorOverlay && editorOverlayCtx) {
      const ow = Math.max(1, Math.round(editorOverlay.clientWidth * dpr));
      const oh = Math.max(1, Math.round(editorOverlay.clientHeight * dpr));
      if (editorOverlay.width !== ow || editorOverlay.height !== oh) {
        editorOverlay.width = ow;
        editorOverlay.height = oh;
      }
      editorOverlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function mat4TransformPoint(m, x, y, z, w = 1) {
    return [
      m[0]*x + m[4]*y + m[8]*z + m[12]*w,
      m[1]*x + m[5]*y + m[9]*z + m[13]*w,
      m[2]*x + m[6]*y + m[10]*z + m[14]*w,
      m[3]*x + m[7]*y + m[11]*z + m[15]*w
    ];
  }

  function projectWorldPoint(x, y, z) {
    const v = mat4TransformPoint(currentViewMatrix, x, y, z, 1);
    const c = mat4TransformPoint(projection, v[0], v[1], v[2], v[3]);
    if (!c[3] || c[3] <= 0) return null;
    const nx = c[0] / c[3];
    const ny = c[1] / c[3];
    const rect = canvas.getBoundingClientRect();
    return {
      x: (nx * 0.5 + 0.5) * rect.width,
      y: (1 - (ny * 0.5 + 0.5)) * rect.height,
      ndcZ: c[2] / c[3]
    };
  }

  function cameraRayFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = 1 - ((clientY - rect.top) / Math.max(1, rect.height)) * 2;
    const eye = [camera.x, camera.y, camera.z];
    const forward = vec3Normalize([camera.x - eye[0], camera.targetY - eye[1], camera.targetZ - eye[2]]);
    const right = vec3Normalize(vec3Cross(forward, [0, 1, 0]));
    const up = vec3Normalize(vec3Cross(right, forward));
    const tan = Math.tan((31 * Math.PI / 180) * 0.5);
    const aspect = rect.width / Math.max(1, rect.height);
    const dir = vec3Normalize([
      forward[0] + right[0] * nx * tan * aspect + up[0] * ny * tan,
      forward[1] + right[1] * nx * tan * aspect + up[1] * ny * tan,
      forward[2] + right[2] * nx * tan * aspect + up[2] * ny * tan
    ]);
    return { eye, dir };
  }

  function groundPointFromClient(clientX, clientY) {
    const ray = cameraRayFromClient(clientX, clientY);
    if (Math.abs(ray.dir[1]) < 0.0001) return null;
    let targetY = groundY + PATH_TOP_RISE;
    let t = (targetY - ray.eye[1]) / ray.dir[1];
    if (t <= 0) return null;
    let x = ray.eye[0] + ray.dir[0] * t;
    let z = ray.eye[2] + ray.dir[2] * t;
    targetY = pathGroundYAt(x, z);
    t = (targetY - ray.eye[1]) / ray.dir[1];
    if (t <= 0) return null;
    x = ray.eye[0] + ray.dir[0] * t;
    z = ray.eye[2] + ray.dir[2] * t;
    return { x, z, y: pathGroundYAt(x, z) };
  }

  function objectScreenBounds(obj) {
    if (!obj || obj.deleted || obj.carried) return null;
    const x = obj.wrap ? wrapX(obj.x, camera.x) : obj.x;
    const points = [
      projectWorldPoint(x - obj.sx * 0.5, obj.y, obj.z),
      projectWorldPoint(x + obj.sx * 0.5, obj.y, obj.z),
      projectWorldPoint(x - obj.sx * 0.5, obj.y + obj.sy, obj.z),
      projectWorldPoint(x + obj.sx * 0.5, obj.y + obj.sy, obj.z)
    ].filter(Boolean);
    if (points.length < 2) return null;
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    return { left, right, top, bottom, width: right-left, height: bottom-top, cx:(left+right)*0.5, cy:(top+bottom)*0.5 };
  }

  function pickSceneObjects(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const candidates = [];
    for (const obj of allSceneObjects()) {
      if (obj.deleted || obj.carried) continue;
      const b = objectScreenBounds(obj);
      if (!b || b.right < -20 || b.left > rect.width + 20 || b.bottom < -20 || b.top > rect.height + 20) continue;
      const pad = 7;
      if (px < b.left-pad || px > b.right+pad || py < b.top-pad || py > b.bottom+pad) continue;
      const centreDist = Math.hypot(px-b.cx, py-b.cy);
      candidates.push({ obj, centreDist });
    }
    // Camera is on +Z, so larger Z is visually nearer. Start with the
    // foremost item and let repeated taps cycle backward through the stack.
    candidates.sort((a,b) => (b.obj.z - a.obj.z) || (a.centreDist - b.centreDist));
    return candidates.map(item => item.obj);
  }

  function cycleInfoFor(obj, candidates) {
    if (!obj || !candidates?.length) return null;
    const index = candidates.indexOf(obj);
    return index >= 0 ? { objects: candidates.slice(), index } : null;
  }

  function sortSceneCollections() {
    backdrop.sort((a,b)=>a.z-b.z);
    midfill.sort((a,b)=>a.z-b.z);
    frontOccluders.sort((a,b)=>a.z-b.z);
  }

  function updateEditorButtons() {
    const has = !!selectedObject && !selectedObject.deleted;
    [editorDuplicateBtn, editorScaleDownBtn, editorScaleUpBtn, editorCollisionBtn, editorDeleteBtn].forEach(btn => {
      if (btn) btn.disabled = !has;
    });
    if (editorGameLayerBtn) {
      const isGameplay = has && selectedObject.category === 'gameplay';
      editorGameLayerBtn.disabled = !isGameplay;
      editorGameLayerBtn.classList.toggle('active', !!(isGameplay && selectedObject.gameplayLayerLocked));
    }
    editorCollisionBtn?.classList.toggle('active', !!selectedObject?.collision);
    editorAddBtn?.classList.toggle('active', !!addAssetType);
  }

  function selectObject(obj, preserveCycle = false) {
    selectedObject = obj && !obj.deleted ? obj : null;
    if (!preserveCycle) selectionCycleInfo = null;
    addAssetType = null;
    if (editorPalette) editorPalette.hidden = true;
    updateAssetPaletteState();
    updateEditorButtons();
  }

  function setEditMode(on) {
    if (on && interactionState) {
      if (interactionState.type === 'pickup') interactionState.object.carried = false;
      else completeDrop();
      interactionState = null;
    }
    if (on && carriedObject) dropCarriedImmediate();
    editMode = !!on;
    document.body.classList.toggle('sidescroll-editing', editMode);
    if (editBtn) {
      editBtn.setAttribute('aria-pressed', String(editMode));
      editBtn.textContent = editMode ? 'Play' : 'Edit';
    }
    if (playControls) playControls.hidden = editMode;
    if (secondaryControls) secondaryControls.hidden = editMode;
    if (editorControls) editorControls.hidden = !editMode;
    if (!editMode) {
      selectedObject = null;
      selectionCycleInfo = null;
      editorTapState = null;
      addAssetType = null;
      if (editorPalette) editorPalette.hidden = true;
      setDriveAxis(0);
      // If a crate has just been positioned underneath the character, enter
      // Play mode standing on its top rather than intersecting it.
      const support = platformUnder(camera.x + character.screenOffsetX, Infinity);
      if (support) { jumpOffset = support.offset; standingOnObject = support.obj; }
      else if (!jumping) { jumpOffset = 0; standingOnObject = null; }
    } else {
      setDriveAxis(0);
      jumping = false;
      jumpOffset = 0;
      jumpVelocity = 0;
      standingOnObject = null;
      hintEl.classList.remove('hidden');
    }
    updateAssetPaletteState();
    updateEditorButtons();
  }

  function defaultAssetHeight(name) {
    if (name === 'crate') return 0.88;
    if (name.startsWith('tree')) return 8.2;
    if (name === 'ground09' || name === 'ground04' || name === 'ground07') return 0.88;
    return 0.82;
  }

  function createUserObject(type, point) {
    const h = defaultAssetHeight(type);
    const w = h * (assetAspect[type] || 1);
    const id = `user-${Date.now().toString(36)}-${++userSceneCounter}`;
    const info = editorAssetInfo.get(type) || { category: 'dressing', gameplayType: null };
    const collection = info.category === 'gameplay' ? frontOccluders : targetCollectionForZ(point.z);
    const gameplayCollision = type === 'crate'
      ? { halfWidth: Math.max(0.46, w * CRATE_HALF_WIDTH_FACTOR), height: h * CRATE_COLLISION_HEIGHT_FACTOR, depth: 0.82, platform: true }
      : null;
    const placementZ = info.category === 'gameplay' ? pathZ : point.z;
    const obj = addObject(collection, type, point.x, placementZ, w, h, {
      id, userAdded:true, baseSx:w, baseSy:h, y:info.category === 'gameplay' ? playSurfaceYAt(point.x) : pathGroundYAt(point.x, point.z),
      shade:1, opacity:.99, layer:classifyLayer(info.category === 'gameplay' ? pathZ : point.z),
      category: info.category || 'dressing', gameplayType: info.gameplayType || null, collision: gameplayCollision,
      gameplayLayerLocked: info.category === 'gameplay'
    });
    if (obj.category === 'gameplay') obj.y = restYForGameplayObject(obj, obj.x, null, true);
    moveObjectToCorrectCollection(obj);
    sortSceneCollections();
    recordObjectEdit(obj);
    selectObject(obj);
    return obj;
  }

  function duplicateSelected() {
    if (!selectedObject || selectedObject.deleted) return;
    const point = { x:selectedObject.x + 0.85, z:selectedObject.gameplayLayerLocked ? pathZ : selectedObject.z + 0.18 };
    const id = `user-${Date.now().toString(36)}-${++userSceneCounter}`;
    const collection = selectedObject.category === 'gameplay' ? frontOccluders : targetCollectionForZ(point.z);
    const obj = addObject(collection, selectedObject.assetName, point.x, point.z, selectedObject.sx, selectedObject.sy, {
      id, userAdded:true, baseSx:selectedObject.baseSx || selectedObject.sx, baseSy:selectedObject.baseSy || selectedObject.sy,
      y:selectedObject.category === 'gameplay' ? playSurfaceYAt(point.x) : pathGroundYAt(point.x, point.z), shade:selectedObject.shade, opacity:selectedObject.opacity,
      flip:selectedObject.flip, layer:classifyLayer(point.z), collision:selectedObject.collision ? { ...selectedObject.collision } : null,
      category:selectedObject.category || 'dressing', gameplayType:selectedObject.gameplayType || null, gameplayLayerLocked: !!selectedObject.gameplayLayerLocked
    });
    if (obj.category === 'gameplay') obj.y = restYForGameplayObject(obj, obj.x, null, true);
    moveObjectToCorrectCollection(obj);
    sortSceneCollections();
    recordObjectEdit(obj);
    selectObject(obj);
  }

  function scaleSelected(multiplier) {
    if (!selectedObject || selectedObject.deleted) return;
    const next = Rig.clamp((selectedObject.sy * multiplier), 0.18, selectedObject.assetName.startsWith('tree') ? 24 : (selectedObject.assetName === 'crate' ? 3.0 : 5.0));
    const ratio = next / Math.max(0.001, selectedObject.sy);
    selectedObject.sy = next;
    selectedObject.sx *= ratio;
    if (selectedObject.collision) {
      selectedObject.collision.halfWidth *= ratio;
      selectedObject.collision.height *= ratio;
    }
    selectedObject.y = selectedObject.category === 'gameplay'
      ? restYForGameplayObject(selectedObject)
      : pathGroundYAt(selectedObject.x, selectedObject.z);
    if (selectedObject.category === 'gameplay') settleGameplayCrates();
    recordObjectEdit(selectedObject);
    updateEditorButtons();
  }

  function toggleSelectedCollision() {
    if (!selectedObject || selectedObject.deleted) return;
    selectedObject.collision = selectedObject.collision ? null : {
      halfWidth: Math.max(0.18, selectedObject.sx * (selectedObject.category === 'gameplay' ? 0.43 : 0.34)),
      height: Math.max(0.24, selectedObject.sy * (selectedObject.category === 'gameplay' ? CRATE_COLLISION_HEIGHT_FACTOR : 0.66)),
      depth: Math.max(0.42, Math.min(1.15, selectedObject.sx * 0.42)),
      platform: selectedObject.category === 'gameplay'
    };
    recordObjectEdit(selectedObject);
    updateEditorButtons();
  }

  function toggleSelectedGameplayLayer() {
    if (!selectedObject || selectedObject.deleted || selectedObject.category !== 'gameplay') return;
    selectedObject.gameplayLayerLocked = !selectedObject.gameplayLayerLocked;
    if (selectedObject.gameplayLayerLocked) {
      selectedObject.z = pathZ;
      selectedObject.y = restYForGameplayObject(selectedObject);
      moveObjectToCorrectCollection(selectedObject);
      sortSceneCollections();
    }
    recordObjectEdit(selectedObject);
    updateEditorButtons();
    hintEl.textContent = selectedObject.gameplayLayerLocked
      ? 'Gameplay layer locked · this object will stay interactive with the character'
      : 'Gameplay layer unlocked · drag freely in depth';
    hintEl.classList.remove('hidden');
  }

  function deleteSelected() {
    if (!selectedObject || selectedObject.deleted) return;
    const wasGameplay = selectedObject.category === 'gameplay';
    selectedObject.deleted = true;
    recordObjectEdit(selectedObject);
    if (wasGameplay) settleGameplayCrates();
    selectedObject = null;
    updateEditorButtons();
  }

  function updateAssetPaletteState() {
    if (!editorAssetsEl) return;
    editorAssetsEl.querySelectorAll('.sidescroll-editor-asset').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.asset === addAssetType);
    });
  }

  function buildAssetPalette() {
    if (!editorAssetsEl) return;
    editorAssetsEl.innerHTML = '';
    for (const group of editorAssetGroups) {
      const heading = document.createElement('div');
      heading.className = 'sidescroll-editor-asset-group';
      heading.textContent = group.title;
      editorAssetsEl.appendChild(heading);
      for (const info of group.items) {
        const name = info.name;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `sidescroll-editor-asset ${info.category === 'gameplay' ? 'gameplay' : 'dressing'}`;
        btn.dataset.asset = name;
        if (name === 'crate') {
          btn.innerHTML = `<span class="sidescroll-crate-thumb" aria-hidden="true"><i></i></span><small>${info.label}</small>`;
        } else {
          const file = name.startsWith('tree')
            ? `sidescroll-tree-${name.slice(-2)}.png`
            : `sidescroll-ground-${name.slice(-2)}.png`;
          btn.innerHTML = `<img src="${file}" alt=""><small>${info.label}</small>`;
        }
        btn.addEventListener('click', e => {
          e.preventDefault();
          addAssetType = name;
          selectedObject = null;
          updateAssetPaletteState();
          updateEditorButtons();
          if (editorPalette) editorPalette.hidden = true;
          hintEl.textContent = info.category === 'gameplay'
            ? `Tap the path to add ${info.label.toLowerCase()} · gameplay collision included`
            : `Tap the ground to add ${name}`;
          hintEl.classList.remove('hidden');
        });
        editorAssetsEl.appendChild(btn);
      }
    }
  }

  function drawEditorOverlay() {
    if (!editorOverlayCtx || !editorOverlay) return;
    const ctx = editorOverlayCtx;
    const w = editorOverlay.clientWidth;
    const h = editorOverlay.clientHeight;
    ctx.clearRect(0, 0, w, h);
    if (!editMode) return;

    // Show authored gameplay collision even when the object itself is partly
    // hidden by foreground dressing. This makes logs/rocks much easier to
    // find and tune in edit mode.
    for (const obj of collisionObjects()) {
      if (obj === selectedObject) continue;
      const c = obj.collision;
      const drawX = obj.wrap ? wrapX(obj.x, camera.x) : obj.x;
      const y0 = obj.y;
      const points = [
        projectWorldPoint(drawX-c.halfWidth, y0, obj.z),
        projectWorldPoint(drawX+c.halfWidth, y0, obj.z),
        projectWorldPoint(drawX-c.halfWidth, y0+c.height, obj.z),
        projectWorldPoint(drawX+c.halfWidth, y0+c.height, obj.z)
      ].filter(Boolean);
      if (points.length < 2) continue;
      const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
      const left=Math.min(...xs), right=Math.max(...xs), top=Math.min(...ys), bottom=Math.max(...ys);
      ctx.save();
      ctx.strokeStyle='rgba(226,161,92,.58)';
      ctx.lineWidth=1.25;
      ctx.setLineDash([3,3]);
      ctx.strokeRect(left,top,right-left,bottom-top);
      ctx.restore();
    }

    if (selectedObject && !selectedObject.deleted) {
      const b = objectScreenBounds(selectedObject);
      if (b) {
        ctx.save();
        ctx.strokeStyle = '#ff4f95';
        ctx.lineWidth = 3;
        ctx.setLineDash([7,3]);
        ctx.strokeRect(b.left-4, b.top-4, b.width+8, b.height+8);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(20,31,34,.78)';
        const depthLabel = selectionCycleInfo && selectionCycleInfo.objects.includes(selectedObject) && selectionCycleInfo.objects.length > 1
          ? `  DEPTH ${selectionCycleInfo.objects.indexOf(selectedObject)+1}/${selectionCycleInfo.objects.length}` : '';
        const layerLabel = selectedObject.category === 'gameplay' && selectedObject.gameplayLayerLocked ? '  GAME LAYER' : '';
        const label = `${selectedObject.assetName}${layerLabel}${depthLabel}  x ${selectedObject.x.toFixed(1)}  z ${selectedObject.z.toFixed(1)}`;
        ctx.font = '700 10px -apple-system, BlinkMacSystemFont, sans-serif';
        const tw = ctx.measureText(label).width + 14;
        const lx = Math.max(4, Math.min(w-tw-4, b.left));
        const ly = Math.max(42, b.top-25);
        ctx.fillRect(lx, ly, tw, 19);
        ctx.fillStyle = '#f2f7f6';
        ctx.fillText(label, lx+7, ly+13);
        ctx.restore();
      }

      if (selectedObject.collision) {
        const c = selectedObject.collision;
        const drawX = selectedObject.wrap ? wrapX(selectedObject.x, camera.x) : selectedObject.x;
        const y0 = selectedObject.y;
        const points = [
          projectWorldPoint(drawX-c.halfWidth, y0, selectedObject.z),
          projectWorldPoint(drawX+c.halfWidth, y0, selectedObject.z),
          projectWorldPoint(drawX-c.halfWidth, y0+c.height, selectedObject.z),
          projectWorldPoint(drawX+c.halfWidth, y0+c.height, selectedObject.z)
        ].filter(Boolean);
        if (points.length >= 2) {
          const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
          const left=Math.min(...xs), right=Math.max(...xs), top=Math.min(...ys), bottom=Math.max(...ys);
          ctx.save();
          ctx.fillStyle='rgba(228,164,89,.12)';
          ctx.strokeStyle='#e2a15c';
          ctx.lineWidth=2;
          ctx.setLineDash([4,3]);
          ctx.fillRect(left,top,right-left,bottom-top);
          ctx.strokeRect(left,top,right-left,bottom-top);
          ctx.restore();
        }
      }
    }

    if (addAssetType) {
      ctx.save();
      ctx.fillStyle='rgba(20,31,34,.75)';
      ctx.font='800 11px -apple-system, BlinkMacSystemFont, sans-serif';
      const text=`ADD ${addAssetType.toUpperCase()} · tap ground`;
      const tw=ctx.measureText(text).width+18;
      ctx.fillRect((w-tw)/2,52,tw,24);
      ctx.fillStyle='#f2f7f6';
      ctx.fillText(text,(w-tw)/2+9,68);
      ctx.restore();
    }
  }

  function wrapX(x, aroundX) {
    return x + Math.round((aroundX - x) / TILE_WIDTH) * TILE_WIDTH;
  }

  function collisionObjects() {
    return allSceneObjects().filter(obj => !obj.deleted && !obj.carried && obj.collision);
  }

  function isGameplayCrate(obj) {
    return !!obj && !obj.deleted && !obj.carried && obj.category === 'gameplay' && obj.gameplayType === 'crate';
  }

  function crateHalfWidth(obj) {
    return obj?.collision?.halfWidth ?? Math.max(0.18, (obj?.sx || 0.9) * CRATE_HALF_WIDTH_FACTOR);
  }

  function crateHeight(obj) {
    return obj?.collision?.height ?? Math.max(0.24, (obj?.sy || 0.88) * CRATE_COLLISION_HEIGHT_FACTOR);
  }

  function cratesOverlapForStack(a, b) {
    if (!(a.gameplayLayerLocked && b.gameplayLayerLocked) && Math.abs(a.z - b.z) > 0.28) return false;
    const ax = wrapX(a.x, b.x);
    const reach = Math.min(crateHalfWidth(a), crateHalfWidth(b)) * 0.92;
    return Math.abs(ax - b.x) <= Math.max(0.16, reach);
  }

  function restYForGameplayObject(obj, aroundX = obj.x, settled = null, allowAnySupport = false) {
    if (!isGameplayCrate(obj)) return obj?.category === 'gameplay' && obj?.gameplayLayerLocked
      ? playSurfaceYAt(aroundX)
      : pathGroundYAt(aroundX, obj?.z ?? pathZ);
    let baseY = obj.gameplayLayerLocked ? playSurfaceYAt(aroundX) : pathGroundYAt(aroundX, obj.z);
    const currentBase = Number.isFinite(obj.y) ? obj.y : baseY;
    const supports = settled || allSceneObjects().filter(other => isGameplayCrate(other) && other !== obj);
    for (const other of supports) {
      if (other === obj || !cratesOverlapForStack(obj, other)) continue;
      const top = other.y + crateHeight(other);
      // Normal settling only accepts things that are already beneath this
      // crate.  Explicit placement/drop can opt in to the highest overlapping
      // support, which is what gives us intentional crate stacking.
      if (!allowAnySupport && top > currentBase + 0.10) continue;
      if (top > baseY) baseY = top;
    }
    return baseY;
  }

  function settleGameplayCrates() {
    const crates = allSceneObjects().filter(isGameplayCrate).sort((a,b) => a.y - b.y || a.x - b.x);
    const settled = [];
    for (const crate of crates) {
      if (crate.gameplayLayerLocked) crate.z = pathZ;
      if (crate.collision) {
        crate.collision.halfWidth = Math.max(0.12, crate.sx * CRATE_HALF_WIDTH_FACTOR);
        crate.collision.height = Math.max(0.18, crate.sy * CRATE_COLLISION_HEIGHT_FACTOR);
      }
      crate.y = restYForGameplayObject(crate, crate.x, settled);
      settled.push(crate);
    }
  }

  function platformOffsetFor(obj, characterX) {
    if (!obj?.collision?.platform) return 0;
    const platformTop = obj.y + (obj.collision.height ?? obj.sy * CRATE_COLLISION_HEIGHT_FACTOR);
    return platformTop - playSurfaceYAt(characterX);
  }

  function platformUnder(characterX, ceiling = Infinity) {
    let best = null;
    let bestOffset = -Infinity;
    for (const obj of collisionObjects()) {
      const c = obj.collision;
      if (!c?.platform) continue;
      const depth = c.depth ?? 0.82;
      if (Math.abs(obj.z - pathZ) > depth) continue;
      const obstacleX = wrapX(obj.x, characterX);
      const radius = Math.max(0.12, (c.halfWidth ?? obj.sx * 0.43) - 0.07);
      if (Math.abs(characterX - obstacleX) > radius) continue;
      const offset = platformOffsetFor(obj, characterX);
      if (offset <= ceiling + 0.08 && offset > bestOffset) { best = obj; bestOffset = offset; }
    }
    return best ? { obj: best, offset: bestOffset } : null;
  }

  function resolveObstacleMove(currentCameraX, proposedCameraX, clearanceHeight) {
    const offset = character.screenOffsetX;
    const currentX = currentCameraX + offset;
    const nextX = proposedCameraX + offset;
    let resolved = proposedCameraX;
    for (const obj of collisionObjects()) {
      const c = obj.collision;
      if (!c) continue;
      const depth = c.depth ?? 0.8;
      if (Math.abs(obj.z - pathZ) > depth) continue;
      const obstacleX = wrapX(obj.x, nextX);
      const topOffset = c.platform ? platformOffsetFor(obj, nextX) : (c.height ?? 0.6);
      // If the character's feet are already at or above the top surface they
      // can pass over it; otherwise the side of the collider blocks movement.
      if (clearanceHeight >= topOffset - 0.035) continue;
      const radius = (c.halfWidth ?? Math.max(0.22, obj.sx * 0.34)) + 0.18;
      if (Math.abs(nextX - obstacleX) < radius) {
        const side = currentX <= obstacleX ? -1 : 1;
        resolved = obstacleX + side * radius - offset;
      }
    }
    return resolved;
  }

  function tintFor(obj) {
    if (debugDepth) return debugTints[obj.layer] || [1, 1, 1];
    if (obj.tint) return obj.tint;
    if (obj.asset) {
      // Slightly greener vegetation against the warmer path, while preserving
      // the original illustrated texture values and the cool fog depth cue.
      if ((obj.assetName || '').startsWith('tree')) return [obj.shade * 0.94, obj.shade * 1.025, obj.shade * 0.94];
      return [obj.shade * 0.96, obj.shade * 1.015, obj.shade * 0.95];
    }
    const base = [0.155, 0.165, 0.172];
    return [base[0] * obj.shade, base[1] * obj.shade, base[2] * obj.shade];
  }

  function drawObject(obj, view, extra = null) {
    if (obj.deleted || (obj.carried && !extra?.force)) return;
    bindMesh(obj.mesh);
    gl.bindTexture(gl.TEXTURE_2D, extra?.texture || obj.texture);
    const drawX = extra?.x ?? (obj.wrap ? wrapX(obj.x, camera.x) : obj.x);
    gl.uniformMatrix4fv(loc.model, false, mat4Model(drawX, obj.y, obj.z, obj.sx, obj.sy, obj.sz, obj.flip));
    gl.uniformMatrix4fv(loc.view, false, view);
    gl.uniformMatrix4fv(loc.projection, false, projection);
    const tint = tintFor(obj);
    gl.uniform3f(loc.tint, tint[0], tint[1], tint[2]);
    const selectedHighlight = editMode && obj === selectedObject ? 1.0 : 0.0;
    gl.uniform1f(loc.highlight, selectedHighlight);
    gl.uniform3f(loc.highlightColor, 1.0, 0.18, 0.48);
    gl.uniform3f(loc.fogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform1f(loc.fogNear, 6.2);
    gl.uniform1f(loc.fogFar, 44.0);
    gl.uniform1f(loc.fogAmount, obj.noFog ? 0 : (debugDepth ? 0.22 : 1.0));
    // Keep the scene fully opaque in Edit mode. Transparency made overlapping
    // foliage impossible to read; selection is now communicated by a bright
    // tint + screen-space frame instead.
    gl.uniform1f(loc.opacity, obj.opacity);
    gl.uniform2f(loc.uvScale, extra?.uvScale?.[0] ?? obj.uvScale?.[0] ?? 1, extra?.uvScale?.[1] ?? obj.uvScale?.[1] ?? 1);
    gl.uniform2f(loc.uvOffset, extra?.uvOffset?.[0] ?? obj.uvOffset?.[0] ?? 0, extra?.uvOffset?.[1] ?? obj.uvOffset?.[1] ?? 0);
    gl.drawElements(gl.TRIANGLES, obj.mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function currentCharacterPhase(isWalking) {
    return isWalking ? locomotionPhase : 0;
  }

  function blendPose(a,b,t){
    if (t <= 0.001) return a;
    if (t >= 0.999) return b;
    const keys=['pelvisY','lean','aFootX','aFootLift','aFootAngle','bFootX','bFootLift','bFootAngle','aHandX','aHandY','bHandX','bHandY','hairAngle','hairBend','travel'];
    const planted = a.planted === b.planted ? a.planted : (t < .34 ? a.planted : (t > .66 ? b.planted : null));
    const out={...Rig.clone(a),name:t<.5?a.name:b.name,key:false,planted};
    keys.forEach(k=>out[k]=Rig.lerp(a[k],b[k],t));
    if(out.planted==='A') out.aFootLift=0;
    if(out.planted==='B') out.bFootLift=0;
    return out;
  }


  function smooth01(t) {
    t = Rig.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function poseForCarrying(basePose, carryAmount = 1, reachAmount = 0) {
    const p = Rig.clone(basePose);
    const carry = smooth01(carryAmount);
    const reach = smooth01(reachAmount);
    const targetAX = Rig.lerp(0.145, 0.105, reach);
    const targetBX = Rig.lerp(0.215, 0.165, reach);
    const targetAY = Rig.lerp(0.215, 0.345, reach);
    const targetBY = Rig.lerp(0.225, 0.350, reach);
    const armAmount = Math.max(carry, reach);
    p.aHandX = Rig.lerp(p.aHandX, targetAX, armAmount);
    p.bHandX = Rig.lerp(p.bHandX, targetBX, armAmount);
    p.aHandY = Rig.lerp(p.aHandY, targetAY, armAmount);
    p.bHandY = Rig.lerp(p.bHandY, targetBY, armAmount);
    p.pelvisY = Rig.lerp(p.pelvisY, 0.455, reach * 0.72);
    p.lean = Rig.lerp(p.lean, 13 * Math.PI / 180, reach * 0.80);
    p.hairAngle = Rig.lerp(p.hairAngle, 116 * Math.PI / 180, reach * 0.35);
    return p;
  }

  function heldCrateTransform(facing, pose = null) {
    const obj = carriedObject || interactionState?.object;
    const sx = obj ? obj.sx : 0.96;
    const sy = obj ? obj.sy : 0.88;
    let x = character.x + facing * CARRY_FORWARD;
    let y = characterRenderY() + CARRY_BOTTOM;

    // Attach the carried crate to the actual animated hand position rather than
    // to a fixed world height.  That means the box inherits the same pelvis /
    // shoulder rise and fall as the walk cycle instead of appearing to hover
    // while the character bobs behind it.
    if (pose) {
      const g = Rig.geometry(pose);
      const handX = ((g.aW.x + g.bW.x) * 0.5) * character.scale;
      const handY = ((g.aW.y + g.bW.y) * 0.5) * character.scale;
      x = character.x + handX * facing;
      y = characterRenderY() + handY - sy * 0.52;
    }

    return { x, y, z: character.z - 0.0004, sx, sy };
  }

  function interactionCrateTransform(facing, pose = null) {
    if (!interactionState) return carriedObject ? heldCrateTransform(facing, pose) : null;
    const st = interactionState;
    const p = smooth01(st.time / st.duration);
    const held = heldCrateTransform(facing, pose);
    if (st.type === 'pickup') {
      const lift = smooth01(Rig.clamp((p - 0.18) / 0.82, 0, 1));
      return {
        x: Rig.lerp(st.startX, held.x, lift),
        y: Rig.lerp(st.startY, held.y, lift),
        z: Rig.lerp(st.startZ, held.z, lift),
        sx: st.object.sx, sy: st.object.sy
      };
    }
    const settle = smooth01(Rig.clamp((p - 0.05) / 0.95, 0, 1));
    return {
      x: Rig.lerp(held.x, st.targetX, settle),
      y: Rig.lerp(held.y, st.targetY, settle),
      z: Rig.lerp(held.z, st.targetZ, settle),
      sx: st.object.sx, sy: st.object.sy
    };
  }

  function drawCarriedCrate(view, facing, pose = null) {
    const obj = interactionState?.object || carriedObject;
    if (!obj) return;
    const tr = interactionCrateTransform(facing, pose);
    if (!tr) return;
    const temp = {
      ...obj,
      carried: false,
      wrap: false,
      x: tr.x,
      y: tr.y,
      z: tr.z,
      sx: tr.sx,
      sy: tr.sy,
      opacity: 1,
      shade: 1,
      tint: null,
      layer: 'character'
    };
    drawObject(temp, view, { force: true });
  }

  function drawRigPartWebGL(part, view, facing) {
    const mesh = rigPartMeshes[part.name];
    const r = Rig.atlasRect(part.name);
    if (!mesh || !r) return;

    const ax = character.x + part.a.x * character.scale * facing;
    const renderY = characterRenderY();
    const ay = renderY + part.a.y * character.scale;
    const bx = character.x + part.b.x * character.scale * facing;
    const by = renderY + part.b.y * character.scale;
    const dvx = bx - ax, dvy = by - ay;
    const p0x = r.a0[0] * r.w, p0y = r.a0[1] * r.h;
    const p1x = r.a1[0] * r.w, p1y = r.a1[1] * r.h;
    const svx = (p1x - p0x) * facing;
    const svy = -(p1y - p0y);
    const srcLen = Math.hypot(svx, svy) || 1;
    const dstLen = Math.hypot(dvx, dvy) || 1;
    const scale = dstLen / srcLen;
    const rotation = Math.atan2(dvy, dvx) - Math.atan2(svy, svx);

    bindMesh(mesh);
    gl.bindTexture(gl.TEXTURE_2D, textures.rigAtlas);
    const z = character.z + (part.layer - 10) * 0.0009;
    gl.uniformMatrix4fv(loc.model, false, mat4Model2D(ax, ay, z, scale, rotation, facing));
    gl.uniformMatrix4fv(loc.view, false, view);
    gl.uniformMatrix4fv(loc.projection, false, projection);
    const tint = debugDepth ? debugTints.character : character.tint;
    gl.uniform3f(loc.tint, tint[0], tint[1], tint[2]);
    gl.uniform1f(loc.highlight, 0);
    gl.uniform3f(loc.highlightColor, 1.0, 0.18, 0.48);
    gl.uniform3f(loc.fogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform1f(loc.fogNear, 6.2);
    gl.uniform1f(loc.fogFar, 44.0);
    gl.uniform1f(loc.fogAmount, debugDepth ? 0.22 : 1.0);
    gl.uniform1f(loc.opacity, character.opacity * (part.alpha ?? 1));
    gl.uniform2f(loc.uvScale, 1, 1);
    gl.uniform2f(loc.uvOffset, 0, 0);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function drawRigCharacter(view, isWalking) {
    const phase = currentCharacterPhase(isWalking);
    let pose;
    if (jumping) {
      const jumpPhase = Rig.clamp(jumpTime / JUMP_DURATION, 0, 0.999);
      pose = Rig.sampleFrames(jumpFrames, jumpPhase);
    } else if (isWalking) {
      const walkPose = Rig.sampleFrames(characterFrames, phase);
      const runPose = Rig.sampleFrames(runFrames, phase);
      pose = blendPose(walkPose, runPose, runBlend);
    } else {
      pose = Rig.sampleFrames(characterFrames, 0.02);
    }

    if (carriedObject) pose = poseForCarrying(pose, 1, 0);
    if (interactionState) {
      const q = Rig.clamp(interactionState.time / interactionState.duration, 0, 1);
      if (interactionState.type === 'pickup') {
        const reach = Math.sin(Math.min(1, q) * Math.PI);
        const carry = smooth01(Rig.clamp((q - 0.52) / 0.48, 0, 1));
        pose = poseForCarrying(pose, carry, reach * (1 - carry * 0.65));
      } else {
        const reach = Math.sin(Math.min(1, q) * Math.PI);
        const carry = 1 - smooth01(Rig.clamp((q - 0.58) / 0.42, 0, 1));
        pose = poseForCarrying(pose, carry, reach * 0.95);
      }
    }

    const facing = character.lastFacing >= 0 ? 1 : -1;
    const parts = Rig.partsForPose(pose);
    let crateDrawn = false;
    for (const part of parts) {
      if (!crateDrawn && (carriedObject || interactionState) && part.name === 'near_upper_arm') {
        drawCarriedCrate(view, facing, pose);
        crateDrawn = true;
      }
      drawRigPartWebGL(part, view, facing);
    }
    if (!crateDrawn && (carriedObject || interactionState)) drawCarriedCrate(view, facing, pose);
  }

  function nearestActionCrate() {
    if (carriedObject || interactionState) return null;
    const characterXNow = camera.x + character.screenOffsetX;
    let best = null;
    let bestD = Infinity;
    for (const obj of allSceneObjects()) {
      if (obj.deleted || obj.carried || obj.category !== 'gameplay' || obj.gameplayType !== 'crate') continue;
      if (standingOnObject === obj) continue;
      const depth = obj.collision?.depth ?? 0.9;
      if (Math.abs(obj.z - pathZ) > Math.max(0.95, depth)) continue;
      const ox = wrapX(obj.x, characterXNow);
      const d = Math.abs(ox - characterXNow);
      // When crates are stacked at the same X, prefer the upper accessible one
      // so ACTION naturally peels a stack from the top instead of removing its
      // support from underneath.
      if (d <= ACTION_RANGE && (d < bestD - 0.02 || (Math.abs(d - bestD) <= 0.02 && (!best || obj.y > best.y)))) {
        best = obj; bestD = d;
      }
    }
    return best;
  }

  function updateActionUI() {
    if (!actionBtn || !actionLabel) return;
    actionBtn.classList.remove('ready', 'carrying');
    if (interactionState) {
      actionLabel.textContent = interactionState.type === 'pickup' ? 'PICKING UP' : 'PUTTING DOWN';
      actionBtn.classList.add('ready');
      return;
    }
    if (carriedObject) {
      actionLabel.textContent = 'PUT DOWN';
      actionBtn.classList.add('carrying');
      return;
    }
    const near = nearestActionCrate();
    if (near) {
      actionLabel.textContent = 'PICK UP';
      actionBtn.classList.add('ready');
    } else {
      actionLabel.textContent = 'ACTION';
    }
  }

  function startPickup(obj) {
    if (!obj || carriedObject || interactionState || jumping) return;
    const characterXNow = camera.x + character.screenOffsetX;
    obj.carried = true;
    // If this was the lower crate in a stack, the remaining crates settle onto
    // the next available support immediately rather than being left floating.
    settleGameplayCrates();
    interactionState = {
      type: 'pickup',
      time: 0,
      duration: PICKUP_DURATION,
      object: obj,
      startX: wrapX(obj.x, characterXNow),
      startY: obj.y,
      startZ: obj.z
    };
    standingOnObject = null;
    setDriveAxis(0);
    SideScrollAudio.play('cratePickup', { volume: 0.34, rate: 0.96 + Math.random() * 0.06 });
    hintEl.textContent = 'Picking up crate';
    hintEl.classList.remove('hidden');
  }

  function completePickup() {
    if (!interactionState || interactionState.type !== 'pickup') return;
    carriedObject = interactionState.object;
    carriedObject.carried = true;
    interactionState = null;
    hintEl.textContent = 'Carrying · ACTION puts the crate down';
    hintEl.classList.remove('hidden');
  }

  function dropTargetForCarried() {
    const facing = character.lastFacing >= 0 ? 1 : -1;
    const x = character.x + facing * 0.92;
    const z = carriedObject?.gameplayLayerLocked === false ? carriedObject.z : pathZ;
    const temp = carriedObject ? { ...carriedObject, x, z, carried: false } : null;
    const y = temp ? restYForGameplayObject(temp, x, null, true) : playSurfaceYAt(x);
    return { x, z, y };
  }

  function startDrop() {
    if (!carriedObject || interactionState || jumping) return;
    const target = dropTargetForCarried();
    interactionState = {
      type: 'drop',
      time: 0,
      duration: DROP_DURATION,
      object: carriedObject,
      targetX: target.x,
      targetY: target.y,
      targetZ: target.z
    };
    setDriveAxis(0);
    hintEl.textContent = 'Putting crate down';
    hintEl.classList.remove('hidden');
  }

  function completeDrop() {
    if (!interactionState || interactionState.type !== 'drop') return;
    const obj = interactionState.object;
    obj.x = interactionState.targetX;
    obj.z = obj.gameplayLayerLocked === false ? interactionState.targetZ : pathZ;
    obj.carried = false;
    obj.y = interactionState.targetY;
    carriedObject = null;
    interactionState = null;
    moveObjectToCorrectCollection(obj);
    sortSceneCollections();
    settleGameplayCrates();
    recordObjectEdit(obj);
    SideScrollAudio.play('crateDrop', { volume: 0.50, rate: 0.92 + Math.random() * 0.08 });
    hintEl.textContent = 'Crate placed';
    hintEl.classList.remove('hidden');
  }

  function dropCarriedImmediate() {
    if (!carriedObject) return;
    const obj = carriedObject;
    const target = dropTargetForCarried();
    obj.x = target.x;
    obj.z = obj.gameplayLayerLocked === false ? target.z : pathZ;
    obj.carried = false;
    obj.y = target.y;
    carriedObject = null;
    interactionState = null;
    moveObjectToCorrectCollection(obj);
    sortSceneCollections();
    settleGameplayCrates();
    recordObjectEdit(obj);
  }

  function performAction() {
    if (editMode || interactionState) return;
    if (carriedObject) { startDrop(); return; }
    const obj = nearestActionCrate();
    if (obj) startPickup(obj);
    else {
      hintEl.textContent = 'Move closer to a gameplay object';
      hintEl.classList.remove('hidden');
    }
  }

  function render(now) {
    resize();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    let landedThisFrame = false;

    if (interactionState) {
      interactionState.time += dt;
      if (interactionState.time >= interactionState.duration) {
        if (interactionState.type === 'pickup') completePickup();
        else completeDrop();
      }
    }

    const keyDir = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
    const usingKeys = keyDir !== 0;
    const rawAxis = (editMode || interactionState) ? 0 : (usingKeys ? keyDir * (keyRun ? 1 : WALK_POINT) : driveAxis);
    const axisMag = Math.abs(rawAxis);
    const moveDir = axisMag > DRIVE_DEADZONE ? Math.sign(rawAxis) : 0;

    // Map the spring slider directly to motion: halfway from centre is a full
    // walk, the outer half progressively opens into the run.  This keeps one
    // continuous thumb gesture for direction and speed.
    let analogSpeed = 0;
    let targetRun = 0;
    if (moveDir) {
      if (axisMag <= WALK_POINT) {
        const walkAmount = Rig.clamp((axisMag - DRIVE_DEADZONE) / Math.max(0.001, WALK_POINT - DRIVE_DEADZONE), 0, 1);
        analogSpeed = WALK_SPEED * walkAmount;
      } else {
        targetRun = Rig.clamp((axisMag - WALK_POINT) / Math.max(0.001, 1 - WALK_POINT), 0, 1);
        analogSpeed = Rig.lerp(WALK_SPEED, RUN_SPEED, targetRun);
      }
    }
    if (carriedObject) {
      targetRun = 0;
      analogSpeed = Math.min(analogSpeed, WALK_SPEED * 0.92);
    }

    // Vertical motion supports real gameplay platforms.  When descending, the
    // character can cross a platform top and land on it; walking off a crate
    // turns into a short fall instead of snapping to the ground.
    const previousJumpOffset = jumpOffset;
    if (jumping) {
      jumpTime += dt;
      jumpVelocity -= JUMP_GRAVITY * dt;
      jumpOffset += jumpVelocity * dt;

      if (jumpVelocity <= 0) {
        const characterXNow = camera.x + character.screenOffsetX;
        const platform = platformUnder(characterXNow, previousJumpOffset + 0.10);
        if (platform && previousJumpOffset >= platform.offset - 0.04 && jumpOffset <= platform.offset) {
          const impactSpeed = Math.abs(jumpVelocity);
          jumpOffset = platform.offset;
          jumpVelocity = 0;
          jumping = false;
          landedThisFrame = true;
          SideScrollAudio.playLanding(impactSpeed);
          jumpTime = 0;
          standingOnObject = platform.obj;
        }
      }

      if (jumping && jumpOffset <= 0 && jumpTime > 0.18) {
        const impactSpeed = Math.abs(jumpVelocity);
        jumpOffset = 0;
        jumpVelocity = 0;
        jumping = false;
        landedThisFrame = true;
        SideScrollAudio.playLanding(impactSpeed);
        jumpTime = 0;
        standingOnObject = null;
      }
    } else if (standingOnObject) {
      const characterXNow = camera.x + character.screenOffsetX;
      const support = platformUnder(characterXNow, jumpOffset + 0.12);
      if (support && support.obj === standingOnObject) {
        jumpOffset = support.offset;
      } else {
        // The feet have left the edge: preserve the current height and let
        // gravity take over naturally.
        standingOnObject = null;
        jumping = true;
        jumpTime = 0.22;
        jumpVelocity = 0;
      }
    }

    // Preserve the smooth pose blend while allowing the slider to control
    // actual ground speed continuously.  Releasing the thumb springs straight
    // back to idle rather than leaving a run latch behind.
    runBlend += (targetRun - runBlend) * Math.min(1, dt * 5.2);
    const smoothRun = runBlend * runBlend * (3 - 2 * runBlend);
    if (moveDir && analogSpeed > 0) {
      const proposedX = camera.x + moveDir * analogSpeed * dt;
      camera.x = resolveObstacleMove(camera.x, proposedX, jumpOffset);
      hideHint();
    }

    const cameraDelta = camera.x - previousCameraX;
    const isWalking = Math.abs(cameraDelta) > 0.0001;
    if (isWalking) {
      const travel = Math.abs(cameraDelta);
      const stride = Rig.lerp(WALK_STRIDE, RUN_STRIDE, smoothRun);
      const previousPhase = locomotionPhase;
      locomotionPhase = (locomotionPhase + travel / Math.max(0.001, stride)) % 1;
      character.distanceTravelled += travel;
      character.lastFacing = cameraDelta >= 0 ? 1 : -1;
      // Two foot plants per locomotion cycle.  Trigger from travelled distance /
      // rig phase rather than a timer so walk, run and slider speed stay locked.
      if (!jumping && !landedThisFrame && !interactionState) {
        if (phaseCrossed(previousPhase, locomotionPhase, 0.08) || phaseCrossed(previousPhase, locomotionPhase, 0.56)) {
          SideScrollAudio.playFootstep(smoothRun, Boolean(carriedObject));
        }
      }
    }
    previousCameraX = camera.x;

    character.x = camera.x + character.screenOffsetX;
    character.y = playSurfaceYAt(character.x) + jumpOffset;

    gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const eye = [camera.x, camera.y, camera.z];
    const target = [camera.x, camera.targetY, camera.targetZ];
    const view = mat4LookAt(eye, target, [0, 1, 0]);
    currentViewMatrix = view;

    drawObject(ground, view);
    drawObject(pathStrip, view);
    for (const obj of backdrop) drawObject(obj, view);
    for (const obj of midfill) drawObject(obj, view);

    drawRigCharacter(view, isWalking);

    for (const obj of frontOccluders) drawObject(obj, view);

    drawEditorOverlay();

    const baseMotionLabel = jumping ? 'JUMP' : (runBlend > .55 && isWalking ? 'RUN' : (isWalking ? 'WALK' : 'IDLE'));
    const motionLabel = interactionState
      ? (interactionState.type === 'pickup' ? 'PICK UP' : 'PUT DOWN')
      : (carriedObject ? `CARRY ${isWalking ? 'WALK' : 'IDLE'}` : baseMotionLabel);
    if (editMode) {
      const selectedDepth = selectionCycleInfo && selectedObject && selectionCycleInfo.objects.includes(selectedObject) && selectionCycleInfo.objects.length > 1
        ? ` · DEPTH ${selectionCycleInfo.objects.indexOf(selectedObject)+1}/${selectionCycleInfo.objects.length}` : '';
      const selected = selectedObject && !selectedObject.deleted
        ? `${selectedObject.category === 'gameplay' ? 'GAMEPLAY · ' : 'DRESSING · '}${selectedObject.assetName}${selectedObject.category === 'gameplay' && selectedObject.gameplayLayerLocked ? ' · GAME LAYER' : ''}${selectedObject.collision ? ' · COLLISION' : ''}${selectedDepth}`
        : (addAssetType ? `ADD ${addAssetType}` : 'tap scenery to select');
      statusEl.textContent = `EDIT · ${selected}`;
    } else {
      statusEl.textContent = debugDepth
        ? `Depth view · camera X ${camera.x.toFixed(1)} · raised path geometry`
        : `3D forest · ${motionLabel} · camera X ${camera.x.toFixed(1)} · dirt ground / scene editor`;
    }

    updateActionUI();
    requestAnimationFrame(render);
  }

  function setDriveAxis(value) {
    driveAxis = Rig.clamp(value, -1, 1);
    const display = Math.abs(driveAxis) < DRIVE_DEADZONE ? 0 : driveAxis;
    if (driveThumb) driveThumb.style.left = `${50 + display * 43}%`;
    if (driveControl) {
      driveControl.setAttribute('aria-valuenow', String(Math.round(display * 100)));
      driveControl.classList.toggle('moving', display !== 0);
      driveControl.classList.toggle('running', Math.abs(display) > WALK_POINT + 0.04);
    }
  }

  function updateDriveFromPointer(e) {
    if (!driveControl) return;
    const rect = driveControl.getBoundingClientRect();
    const centre = rect.left + rect.width * 0.5;
    const usableHalf = rect.width * 0.43;
    setDriveAxis((e.clientX - centre) / Math.max(1, usableHalf));
  }

  if (driveControl) {
    driveControl.addEventListener('pointerdown', e => {
      e.preventDefault();
      drivePointer = e.pointerId;
      driveControl.classList.add('dragging');
      driveControl.setPointerCapture?.(e.pointerId);
      updateDriveFromPointer(e);
      hideHint();
    });
    driveControl.addEventListener('pointermove', e => {
      if (e.pointerId !== drivePointer) return;
      e.preventDefault();
      updateDriveFromPointer(e);
    });
    const releaseDrive = e => {
      if (drivePointer !== null && e.pointerId !== drivePointer) return;
      drivePointer = null;
      driveControl.classList.remove('dragging');
      setDriveAxis(0);
    };
    driveControl.addEventListener('pointerup', releaseDrive);
    driveControl.addEventListener('pointercancel', releaseDrive);
    driveControl.addEventListener('lostpointercapture', releaseDrive);
    driveControl.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); setDriveAxis(Math.max(-1, driveAxis - 0.25)); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setDriveAxis(Math.min(1, driveAxis + 0.25)); }
      if (e.key === 'Home' || e.key === '0') { e.preventDefault(); setDriveAxis(0); }
    });
    driveControl.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setDriveAxis(0);
    });
  }

  function triggerJump(){
    if (editMode || jumping || interactionState) return;
    jumping = true;
    jumpTime = 0;
    // Keep the current support height so jumping from the top of a crate starts
    // from that surface rather than teleporting back to path level.
    standingOnObject = null;
    jumpVelocity = JUMP_VELOCITY;
    SideScrollAudio.play('jump', { volume: carriedObject ? 0.18 : 0.22, rate: 0.98 + Math.random() * 0.05 });
    hideHint();
  }
  jumpBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    triggerJump();
    jumpBtn.setPointerCapture?.(e.pointerId);
  });

  actionBtn?.addEventListener('pointerdown', e => {
    e.preventDefault();
    performAction();
    actionBtn.setPointerCapture?.(e.pointerId);
  });

  // Any deliberate input can satisfy the iPhone audio-unlock requirement.
  document.addEventListener('pointerdown', () => { SideScrollAudio.unlock(); }, { capture: true, passive: true });
  document.addEventListener('keydown', () => { SideScrollAudio.unlock(); }, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') SideScrollAudio.recover();
  });
  window.addEventListener('pageshow', e => {
    if (e.persisted) SideScrollAudio.recover();
  });
  soundBtn?.addEventListener('click', e => {
    e.preventDefault();
    SideScrollAudio.toggle();
  });

  debugBtn.addEventListener('click', () => {
    debugDepth = !debugDepth;
    debugBtn.setAttribute('aria-pressed', String(debugDepth));
    debugBtn.textContent = debugDepth ? 'Normal view' : 'Depth view';
    depthKey.hidden = !debugDepth;
    hideHint();
  });

  if (editBtn) editBtn.addEventListener('click', () => setEditMode(!editMode));
  editorAddBtn?.addEventListener('click', () => {
    if (!editMode || !editorPalette) return;
    editorPalette.hidden = !editorPalette.hidden;
    if (!editorPalette.hidden) {
      addAssetType = null;
      selectedObject = null;
      updateAssetPaletteState();
      updateEditorButtons();
    }
  });
  editorPaletteClose?.addEventListener('click', () => {
    if (editorPalette) editorPalette.hidden = true;
    addAssetType = null;
    updateAssetPaletteState();
    updateEditorButtons();
  });
  editorResetBtn?.addEventListener('click', () => {
    if (!window.confirm('Reset all SideScroll scene edits on this device?')) return;
    try { localStorage.removeItem(SCENE_STORAGE_KEY); } catch (_) {}
    window.location.reload();
  });
  editorDuplicateBtn?.addEventListener('click', duplicateSelected);
  editorScaleDownBtn?.addEventListener('click', () => scaleSelected(0.90));
  editorScaleUpBtn?.addEventListener('click', () => scaleSelected(1.10));
  editorGameLayerBtn?.addEventListener('click', toggleSelectedGameplayLayer);
  editorCollisionBtn?.addEventListener('click', toggleSelectedCollision);
  editorDeleteBtn?.addEventListener('click', deleteSelected);

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture?.(e.pointerId);
    hideHint();
    if (editMode) {
      editorPointer = e.pointerId;
      if (addAssetType) {
        const point = groundPointFromClient(e.clientX, e.clientY);
        if (point) {
          createUserObject(addAssetType, point);
          addAssetType = null;
          updateAssetPaletteState();
          updateEditorButtons();
          hintEl.textContent = 'Added · drag to move · use the tools below to tune it';
          hintEl.classList.remove('hidden');
        }
        editorPointer = null;
        return;
      }

      const candidates = pickSceneObjects(e.clientX, e.clientY);
      const alreadySelectedIndex = selectedObject ? candidates.indexOf(selectedObject) : -1;
      const hit = alreadySelectedIndex >= 0 ? selectedObject : (candidates[0] || null);
      if (hit) {
        if (hit !== selectedObject) selectObject(hit, true);
        selectionCycleInfo = cycleInfoFor(hit, candidates);
        const point = groundPointFromClient(e.clientX, e.clientY);
        editorDragKind = 'object';
        if (point) editorDragOffset = { x: hit.x - point.x, z: hit.z - point.z };
        else editorDragOffset = { x: 0, z: 0 };
        editorTapState = {
          startX: e.clientX, startY: e.clientY, moved: false,
          candidates, selectedAtDown: hit, wasAlreadySelected: alreadySelectedIndex >= 0
        };
        hintEl.textContent = candidates.length > 1
          ? `Selected · tap again to cycle ${candidates.length} overlapping assets · drag to move`
          : 'Selected · drag on the ground plane to reposition';
        hintEl.classList.remove('hidden');
      } else {
        selectObject(null);
        editorTapState = null;
        editorDragKind = 'pan';
        editorPanStart = e.clientX;
        editorPanCameraX = camera.x;
        hintEl.textContent = 'Empty-space drag pans along the level';
        hintEl.classList.remove('hidden');
      }
      return;
    }

    activePointer = e.pointerId;
    dragStartX = e.clientX;
    dragStartCameraX = camera.x;
  });

  canvas.addEventListener('pointermove', e => {
    if (editMode) {
      if (e.pointerId !== editorPointer) return;
      if (editorDragKind === 'object' && selectedObject) {
        if (editorTapState) {
          const travel = Math.hypot(e.clientX - editorTapState.startX, e.clientY - editorTapState.startY);
          if (travel < 6 && !editorTapState.moved) return;
          editorTapState.moved = true;
        }
        const point = groundPointFromClient(e.clientX, e.clientY);
        if (!point) return;
        selectedObject.x = point.x + editorDragOffset.x;
        selectedObject.z = selectedObject.category === 'gameplay' && selectedObject.gameplayLayerLocked
          ? pathZ
          : Rig.clamp(point.z + editorDragOffset.z, WORLD.farZ + 0.8, WORLD.nearZ - 0.6);
        selectedObject.y = selectedObject.category === 'gameplay'
          ? restYForGameplayObject(selectedObject)
          : pathGroundYAt(selectedObject.x, selectedObject.z);
        moveObjectToCorrectCollection(selectedObject);
        sortSceneCollections();
        selectionCycleInfo = null;
      } else if (editorDragKind === 'pan') {
        const dx = e.clientX - editorPanStart;
        camera.x = editorPanCameraX - dx * 0.0075;
      }
      return;
    }
    if (e.pointerId !== activePointer) return;
    const dx = e.clientX - dragStartX;
    camera.x = dragStartCameraX - dx * 0.0075;
  });

  const endDrag = e => {
    if (editMode) {
      if (e.pointerId !== editorPointer) return;
      if (editorDragKind === 'object' && selectedObject) {
        if (editorTapState?.moved) {
          recordObjectEdit(selectedObject);
        } else if (editorTapState?.wasAlreadySelected && editorTapState.candidates.length > 1) {
          const candidates = editorTapState.candidates.filter(obj => !obj.deleted);
          const currentIndex = Math.max(0, candidates.indexOf(editorTapState.selectedAtDown));
          const next = candidates[(currentIndex + 1) % candidates.length];
          selectedObject = next;
          selectionCycleInfo = cycleInfoFor(next, candidates);
          updateEditorButtons();
          hintEl.textContent = `Depth ${selectionCycleInfo.index + 1}/${candidates.length} · tap again to cycle · drag to move`;
          hintEl.classList.remove('hidden');
        }
      }
      editorTapState = null;
      editorPointer = null;
      editorDragKind = null;
      return;
    }
    if (e.pointerId === activePointer) activePointer = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (editMode) {
      if (e.key === 'Escape') { selectObject(null); if (editorPalette) editorPalette.hidden = true; addAssetType = null; updateAssetPaletteState(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObject) { e.preventDefault(); deleteSelected(); }
      return;
    }
    if (e.key === 'ArrowLeft' || key === 'a') {
      keyLeft = true;
      hideHint();
    }
    if (e.key === 'ArrowRight' || key === 'd') {
      keyRight = true;
      hideHint();
    }
    if (e.key === 'Shift') keyRun = true;
    if (e.key === ' ' || e.key === 'ArrowUp' || key === 'w') { e.preventDefault(); triggerJump(); }
    if (key === 'e') { e.preventDefault(); performAction(); }
    if (e.key === '0') camera.x = 0;
  });

  window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (editMode) return;
    if (e.key === 'ArrowLeft' || key === 'a') keyLeft = false;
    if (e.key === 'ArrowRight' || key === 'd') keyRight = false;
    if (e.key === 'Shift') keyRun = false;
  });

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    keyLeft = false;
    keyRight = false;
    keyRun = false;
    setDriveAxis(0);
    jumping = false;
    jumpTime = 0;
    jumpOffset = 0;
    jumpVelocity = 0;
    standingOnObject = null;
    if (interactionState?.type === 'pickup') interactionState.object.carried = false;
    if (interactionState?.type === 'drop') completeDrop();
    interactionState = null;
    locomotionPhase = 0;
    character.y = playSurfaceYAt(character.x);
    lastTime = performance.now();
    previousCameraX = camera.x;
  });

  buildAssetPalette();
  updateEditorButtons();
  setEditMode(false);
  resize();
  requestAnimationFrame(render);
})();
