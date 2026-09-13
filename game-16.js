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
    varying vec2 vUV;
    varying float vDepth;
    void main() {
      vec4 tex = texture2D(uTexture, vUV);
      float alpha = tex.a * uOpacity;
      if (alpha < 0.045) discard;
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

  function createTexture(draw, w = 256, h = 512) {
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
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function withMonoShape(ctx, fn) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    fn();
  }

  const textures = {};
  const assetAspect = {};

  function createImageTexture(url, label = 'image') {
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

    const image = new Image();
    image.onload = () => {
      assetAspect[label] = image.naturalWidth / image.naturalHeight;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    };
    image.onerror = () => {
      errorBox.hidden = false;
      errorBox.textContent = `${label} asset could not be loaded.`;
    };
    image.src = url;
    return tex;
  }

  textures.white = createTexture((ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }, 4, 4);

  // These two full sheets stay in the build as the editable source assets.
  // The renderer uses the individual alpha-cropped sprites made from them so
  // each tree / ground prop can be placed independently in the 3D forest.
  const treeAssets = [
    ['01', 237, 955], ['02', 382, 990], ['03', 230, 899],
    ['04', 248, 929], ['05', 240, 837], ['06', 293, 1018]
  ];
  treeAssets.forEach(([id, w, h]) => {
    const key = `tree${id}`;
    assetAspect[key] = w / h;
    textures[key] = createImageTexture(`sidescroll-tree-${id}.png?v=1.8.46`, key);
  });

  const groundAssets = [
    ['01', 351, 297], ['02', 360, 308], ['03', 394, 204], ['04', 276, 281],
    ['05', 389, 273], ['06', 304, 294], ['07', 267, 275], ['08', 394, 207],
    ['09', 353, 267], ['10', 309, 171], ['11', 343, 276], ['12', 398, 228]
  ];
  groundAssets.forEach(([id, w, h]) => {
    const key = `ground${id}`;
    assetAspect[key] = w / h;
    textures[key] = createImageTexture(`sidescroll-ground-${id}.png?v=1.8.46`, key);
  });

  textures.characterAtlas = createImageTexture('sidescroll-character-sheet.png?v=1.8.46', 'character sprite sheet');

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
  const WORLD = { nearZ: 6.5, farZ: -42 };
  const fogColor = [0.93, 0.95, 0.95];
  const groundY = -4.25;
  const pathZ = 0.55;

  const ground = {
    mesh: groundMesh,
    texture: textures.white,
    x: 0,
    y: groundY,
    z: WORLD.nearZ,
    sx: 210,
    sy: 1,
    sz: WORLD.nearZ - WORLD.farZ,
    layer: 'ground',
    tint: [0.060, 0.066, 0.070],
    opacity: 1,
    noFog: false,
    wrap: false
  };

  const backdrop = [];
  const foreground = [];

  function classifyLayer(z) {
    if (z > 1.2) return 'foreground';
    if (z > -9) return 'near';
    if (z > -24) return 'mid';
    return 'far';
  }

  function addObject(collection, type, x, z, width, height, opts = {}) {
    const resolvedHeight = height;
    const resolvedWidth = width ?? resolvedHeight * (assetAspect[type] || 1);
    collection.push({
      mesh: billboardMesh,
      texture: textures[type],
      x,
      y: opts.y ?? groundY,
      z,
      sx: resolvedWidth,
      sy: resolvedHeight,
      sz: 1,
      flip: opts.flip ?? (rand() > 0.5),
      shade: opts.shade ?? 1,
      opacity: opts.opacity ?? 1,
      noFog: !!opts.noFog,
      tint: opts.tint || null,
      asset: true,
      layer: opts.layer || classifyLayer(z),
      wrap: opts.wrap !== false
    });
  }

  function scatterForest() {
    // The tree sheet is intentionally used as a small library rather than a
    // single repeating backdrop. World-space random placement gives us the
    // natural variation of a real forest while keeping the density continuous
    // as the camera moves left/right.
    const trees = ['tree01', 'tree02', 'tree03', 'tree04', 'tree05', 'tree06'];
    const backTrees = [];
    const midTrees = [];

    // Dense tree wall beyond the path. Most of the visual weight lives here.
    for (let i = 0; i < 118; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const depth = Math.pow(rand(), 1.15);
      const z = -6.0 - depth * 34.0;
      const height = 10.5 + rand() * (7.5 - depth * 1.8);
      const type = trees[Math.floor(rand() * trees.length)];
      const width = height * (assetAspect[type] || 0.28);
      const layerShade = 0.92 + rand() * 0.13;
      addObject(backdrop, type, x, z, width, height, {
        shade: layerShade,
        opacity: 0.94 + rand() * 0.06,
        layer: z > -18 ? 'near' : (z > -31 ? 'mid' : 'far')
      });
      backTrees.push(i);
    }

    // A smaller number of taller, more open silhouettes give us canopy shapes
    // higher in frame without turning the foreground into a wall.
    for (let i = 0; i < 26; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = -19 - rand() * 20;
      const type = trees[(i * 3 + Math.floor(rand() * 2)) % trees.length];
      const height = 14.0 + rand() * 7.0;
      const width = height * (assetAspect[type] || 0.28);
      addObject(backdrop, type, x, z, width, height, {
        shade: 0.95 + rand() * 0.10,
        opacity: 0.88 + rand() * 0.10,
        layer: 'far'
      });
      midTrees.push(i);
    }

    // Low scrub/rocks sit mostly between the character and the tree wall.
    const lowAssets = ['ground01','ground02','ground03','ground04','ground05','ground06','ground07','ground08','ground09','ground10','ground11','ground12'];
    for (let i = 0; i < 72; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = -1.8 - Math.pow(rand(), 1.25) * 16.5;
      const type = lowAssets[Math.floor(rand() * lowAssets.length)];
      const height = 0.75 + rand() * 1.75;
      const width = height * (assetAspect[type] || 1.2);
      addObject(backdrop, type, x, z, width, height, {
        shade: 0.94 + rand() * 0.10,
        opacity: 0.86 + rand() * 0.12,
        layer: classifyLayer(z)
      });
    }

    // Near-side vegetation is deliberately low: it should constantly skim
    // the character's ankles/knees rather than obscure the body.
    const nearGrass = ['ground02','ground05','ground08','ground09'];
    const nearScrub = ['ground01','ground03','ground06','ground10','ground12'];
    const nearRocks = ['ground04','ground07','ground11'];

    for (let i = 0; i < 92; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = 0.7 + rand() * 3.7;
      let type;
      const r = rand();
      if (r < 0.60) type = nearGrass[Math.floor(rand() * nearGrass.length)];
      else if (r < 0.84) type = nearScrub[Math.floor(rand() * nearScrub.length)];
      else type = nearRocks[Math.floor(rand() * nearRocks.length)];
      const height = type.startsWith('ground0') && nearGrass.includes(type)
        ? 0.72 + rand() * 0.75
        : 0.62 + rand() * 1.05;
      const width = height * (assetAspect[type] || 1.2);
      addObject(foreground, type, x, z, width, height, {
        shade: 0.90 + rand() * 0.10,
        opacity: 0.92 + rand() * 0.08,
        layer: 'foreground'
      });
    }

    // A few near-side trees only, spaced widely enough that the character
    // remains readable while the foreground still has real depth.
    for (let i = 0; i < 8; i++) {
      const x = TILE.minX + rand() * TILE_WIDTH;
      const z = 2.7 + rand() * 1.8;
      const type = trees[(i + 1) % trees.length];
      const height = 8.5 + rand() * 4.0;
      const width = height * (assetAspect[type] || 0.28);
      addObject(foreground, type, x, z, width, height, {
        shade: 0.86 + rand() * 0.10,
        opacity: 0.94,
        layer: 'foreground'
      });
    }

    backdrop.sort((a, b) => a.z - b.z);
    foreground.sort((a, b) => a.z - b.z);
  }

  scatterForest();

  const character = {
    mesh: billboardMesh,
    texture: textures.characterAtlas,
    x: 0,
    y: groundY,
    z: pathZ,
    sx: 3.55,
    sy: 6.15,
    sz: 1,
    flip: false,
    layer: 'character',
    tint: [1, 1, 1],
    opacity: 0.98,
    noFog: false,
    screenOffsetX: -0.9,
    distanceTravelled: 0,
    lastFacing: 1,
    wrap: false
  };

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
    y: -1.62,
    z: 14.0,
    targetY: groundY + 1.10,
    targetZ: -13.5
  };

  let projection = mat4Identity();
  let debugDepth = false;
  let moveLeft = false;
  let moveRight = false;
  let activePointer = null;
  let dragStartX = 0;
  let dragStartCameraX = 0;
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
  }

  function wrapX(x, aroundX) {
    return x + Math.round((aroundX - x) / TILE_WIDTH) * TILE_WIDTH;
  }

  function tintFor(obj) {
    if (debugDepth) return debugTints[obj.layer] || [1, 1, 1];
    if (obj.tint) return obj.tint;
    if (obj.asset) return [obj.shade, obj.shade, obj.shade];
    const base = [0.155, 0.165, 0.172];
    return [base[0] * obj.shade, base[1] * obj.shade, base[2] * obj.shade];
  }

  function drawObject(obj, view, extra = null) {
    bindMesh(obj.mesh);
    gl.bindTexture(gl.TEXTURE_2D, extra?.texture || obj.texture);
    const drawX = extra?.x ?? (obj.wrap ? wrapX(obj.x, camera.x) : obj.x);
    gl.uniformMatrix4fv(loc.model, false, mat4Model(drawX, obj.y, obj.z, obj.sx, obj.sy, obj.sz, obj.flip));
    gl.uniformMatrix4fv(loc.view, false, view);
    gl.uniformMatrix4fv(loc.projection, false, projection);
    const tint = tintFor(obj);
    gl.uniform3f(loc.tint, tint[0], tint[1], tint[2]);
    gl.uniform3f(loc.fogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform1f(loc.fogNear, 6.5);
    gl.uniform1f(loc.fogFar, 44.0);
    gl.uniform1f(loc.fogAmount, obj.noFog ? 0 : (debugDepth ? 0.22 : 1.0));
    gl.uniform1f(loc.opacity, obj.opacity);
    gl.uniform2f(loc.uvScale, extra?.uvScale?.[0] ?? 1, extra?.uvScale?.[1] ?? 1);
    gl.uniform2f(loc.uvOffset, extra?.uvOffset?.[0] ?? 0, extra?.uvOffset?.[1] ?? 0);
    gl.drawElements(gl.TRIANGLES, obj.mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function currentCharacterFrame(isWalking) {
    if (!isWalking) {
      const t = performance.now() * 0.001;
      return Math.floor(t * 1.5) % 2 === 0 ? 0 : 1;
    }
    const stride = 2.8;
    const normalized = (character.distanceTravelled % stride) / stride;
    return Math.floor(normalized * 8) % 8;
  }

  function render(now) {
    resize();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    const moveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
    const speed = 1.35;
    if (moveDir) {
      camera.x += moveDir * speed * dt;
      hideHint();
    }

    const cameraDelta = camera.x - previousCameraX;
    const isWalking = Math.abs(cameraDelta) > 0.0001 || moveDir !== 0;
    if (Math.abs(cameraDelta) > 0.0001) {
      character.distanceTravelled += Math.abs(cameraDelta);
      character.lastFacing = cameraDelta >= 0 ? 1 : -1;
    }
    previousCameraX = camera.x;

    character.flip = character.lastFacing < 0;
    character.x = camera.x + character.screenOffsetX;

    gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const eye = [camera.x, camera.y, camera.z];
    const target = [camera.x, camera.targetY, camera.targetZ];
    const view = mat4LookAt(eye, target, [0, 1, 0]);

    drawObject({ ...ground, x: camera.x }, view);
    for (const obj of backdrop) drawObject(obj, view);

    const frameIndex = currentCharacterFrame(isWalking);
    drawObject(character, view, {
      texture: character.texture,
      x: character.x,
      uvScale: [1 / 8, 1],
      uvOffset: [frameIndex / 8, 0]
    });

    for (const obj of foreground) drawObject(obj, view);

    statusEl.textContent = debugDepth
      ? `Depth view · camera X ${camera.x.toFixed(1)} · asset depth`
      : `3D forest · camera X ${camera.x.toFixed(1)} · illustrated asset test`;

    requestAnimationFrame(render);
  }

  function bindHold(button, setter) {
    const down = e => {
      e.preventDefault();
      setter(true);
      hideHint();
      button.setPointerCapture?.(e.pointerId);
    };
    const up = e => {
      e.preventDefault();
      setter(false);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('pointerleave', e => {
      if (e.pointerType === 'mouse') setter(false);
    });
  }

  bindHold(leftBtn, v => (moveLeft = v));
  bindHold(rightBtn, v => (moveRight = v));

  resetBtn.addEventListener('click', () => {
    camera.x = 0;
    hideHint();
  });

  debugBtn.addEventListener('click', () => {
    debugDepth = !debugDepth;
    debugBtn.setAttribute('aria-pressed', String(debugDepth));
    debugBtn.textContent = debugDepth ? 'Normal view' : 'Depth view';
    depthKey.hidden = !debugDepth;
    hideHint();
  });

  canvas.addEventListener('pointerdown', e => {
    activePointer = e.pointerId;
    dragStartX = e.clientX;
    dragStartCameraX = camera.x;
    canvas.setPointerCapture?.(e.pointerId);
    hideHint();
  });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== activePointer) return;
    const dx = e.clientX - dragStartX;
    camera.x = dragStartCameraX - dx * 0.009;
  });

  const endDrag = e => {
    if (e.pointerId === activePointer) activePointer = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowLeft' || key === 'a') {
      moveLeft = true;
      hideHint();
    }
    if (e.key === 'ArrowRight' || key === 'd') {
      moveRight = true;
      hideHint();
    }
    if (e.key === '0') camera.x = 0;
  });

  window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowLeft' || key === 'a') moveLeft = false;
    if (e.key === 'ArrowRight' || key === 'd') moveRight = false;
  });

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    moveLeft = false;
    moveRight = false;
    lastTime = performance.now();
    previousCameraX = camera.x;
  });

  resize();
  requestAnimationFrame(render);
})();
