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
      if (alpha < 0.05) discard;
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
    new Uint16Array([0, 1, 2, 2, 1, 3])
  );

  const groundMesh = createMesh(
    new Float32Array([
      -0.5, 0.0,  0.0, 0.0, 0.0,
       0.5, 0.0,  0.0, 1.0, 0.0,
      -0.5, 0.0, -1.0, 0.0, 1.0,
       0.5, 0.0, -1.0, 1.0, 1.0
    ]),
    new Uint16Array([0, 1, 2, 2, 1, 3])
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
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
      -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
      -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
      1
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

  textures.treeA = createTexture((ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.43, h);
    ctx.lineTo(w * 0.47, h * 0.20);
    ctx.lineTo(w * 0.53, h * 0.08);
    ctx.lineTo(w * 0.58, h);
    ctx.closePath();
    ctx.fill();
    branch(ctx, w * 0.50, h * 0.42, w * 0.20, h * 0.27, w * 0.055);
    branch(ctx, w * 0.52, h * 0.34, w * 0.78, h * 0.18, w * 0.045);
    branch(ctx, w * 0.49, h * 0.56, w * 0.16, h * 0.47, w * 0.04);
    branch(ctx, w * 0.54, h * 0.60, w * 0.84, h * 0.49, w * 0.035);
    ellipse(ctx, w * 0.19, h * 0.25, w * 0.18, h * 0.08, -0.3);
    ellipse(ctx, w * 0.80, h * 0.17, w * 0.18, h * 0.075, 0.28);
    ellipse(ctx, w * 0.16, h * 0.46, w * 0.16, h * 0.07, 0.15);
    ellipse(ctx, w * 0.83, h * 0.48, w * 0.15, h * 0.065, -0.2);
  });

  textures.treeB = createTexture((ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.39, h);
    ctx.lineTo(w * 0.47, h * 0.28);
    ctx.lineTo(w * 0.41, h * 0.06);
    ctx.lineTo(w * 0.52, h * 0.23);
    ctx.lineTo(w * 0.61, h);
    ctx.closePath();
    ctx.fill();
    branch(ctx, w * 0.49, h * 0.40, w * 0.18, h * 0.21, w * 0.05);
    branch(ctx, w * 0.53, h * 0.51, w * 0.88, h * 0.31, w * 0.045);
    branch(ctx, w * 0.46, h * 0.31, w * 0.24, h * 0.11, w * 0.035);
    branch(ctx, w * 0.55, h * 0.24, w * 0.72, h * 0.07, w * 0.03);
    ellipse(ctx, w * 0.18, h * 0.19, w * 0.15, h * 0.06, -0.25);
    ellipse(ctx, w * 0.88, h * 0.30, w * 0.12, h * 0.055, 0.15);
    ellipse(ctx, w * 0.73, h * 0.07, w * 0.12, h * 0.045, -0.1);
  });

  textures.treeC = createTexture((ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.43, h);
    ctx.lineTo(w * 0.46, h * 0.13);
    ctx.lineTo(w * 0.50, h * 0.03);
    ctx.lineTo(w * 0.55, h * 0.13);
    ctx.lineTo(w * 0.60, h);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const y = h * (0.14 + i * 0.10);
      const span = w * (0.18 + i * 0.015);
      branch(ctx, w * 0.50, y, w * 0.50 - span, y + h * 0.055, w * 0.022 + i * 0.8);
      branch(ctx, w * 0.52, y + h * 0.018, w * 0.52 + span, y + h * 0.072, w * 0.020 + i * 0.7);
    }
  });

  textures.snag = createTexture((ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.39, h);
    ctx.lineTo(w * 0.45, h * 0.27);
    ctx.lineTo(w * 0.51, h * 0.12);
    ctx.lineTo(w * 0.58, h);
    ctx.closePath();
    ctx.fill();
    branch(ctx, w * 0.49, h * 0.35, w * 0.16, h * 0.18, w * 0.045);
    branch(ctx, w * 0.52, h * 0.46, w * 0.84, h * 0.25, w * 0.04);
    branch(ctx, w * 0.48, h * 0.22, w * 0.31, h * 0.07, w * 0.03);
  });

  textures.bush = createTexture((ctx, w, h) => {
    ellipse(ctx, w * 0.22, h * 0.77, w * 0.22, h * 0.17, -0.15);
    ellipse(ctx, w * 0.48, h * 0.64, w * 0.28, h * 0.24, 0.05);
    ellipse(ctx, w * 0.76, h * 0.77, w * 0.22, h * 0.17, 0.15);
    ctx.fillRect(w * 0.47, h * 0.66, w * 0.06, h * 0.34);
  }, 256, 256);

  textures.rock = createTexture((ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.92);
    ctx.lineTo(w * 0.18, h * 0.58);
    ctx.lineTo(w * 0.40, h * 0.36);
    ctx.lineTo(w * 0.72, h * 0.40);
    ctx.lineTo(w * 0.90, h * 0.72);
    ctx.lineTo(w * 0.86, h * 0.92);
    ctx.closePath();
    ctx.fill();
  }, 256, 256);

  textures.grass = createTexture((ctx, w, h) => {
    ctx.lineWidth = 8;
    for (let i = 0; i < 12; i++) {
      const startX = w * (0.10 + i * 0.065);
      const midX = startX + (((i % 5) - 2) * w * 0.03);
      const tipX = startX + (((i % 7) - 3) * w * 0.018);
      const tipY = h * (0.24 + (i % 4) * 0.07);
      ctx.beginPath();
      ctx.moveTo(startX, h);
      ctx.quadraticCurveTo(midX, h * 0.68, tipX, tipY);
      ctx.stroke();
    }
    ctx.fillRect(w * 0.08, h * 0.93, w * 0.84, h * 0.07);
  }, 256, 256);

  textures.white = createTexture((ctx, w, h) => {
    ctx.fillRect(0, 0, w, h);
  }, 4, 4);

  function makeCharacterFrame({ bodyLean = 0, frontLeg = 0, backLeg = 0, frontArm = 0, backArm = 0, bob = 0, scarf = 0 }) {
    return createTexture((ctx, w, h) => {
      const cx = w * 0.48 + bodyLean;
      const footY = h * 0.95;
      const hipY = h * 0.63 - bob;
      const shoulderY = h * 0.39 - bob;
      const headY = h * 0.19 - bob;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 22;

      ctx.beginPath();
      ctx.moveTo(cx, shoulderY);
      ctx.lineTo(cx + bodyLean * 0.35, hipY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + 8, shoulderY + 12);
      ctx.lineTo(cx + 32, shoulderY + 54 + backArm * 0.45);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 2, shoulderY + 16);
      ctx.lineTo(cx - 26, shoulderY + 56 + frontArm * 0.45);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + 6, hipY);
      ctx.lineTo(cx + 18, footY - 74);
      ctx.lineTo(cx + 26, footY + frontLeg);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 4, hipY);
      ctx.lineTo(cx - 18, footY - 70);
      ctx.lineTo(cx - 22, footY + backLeg);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 16, shoulderY + 4);
      ctx.lineTo(cx + 16, shoulderY + 1);
      ctx.lineTo(cx + 24, hipY - 18);
      ctx.lineTo(cx - 2, hipY + 14);
      ctx.lineTo(cx - 24, hipY - 6);
      ctx.closePath();
      ctx.fill();

      if (scarf) {
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(cx + 2, shoulderY + 10);
        ctx.lineTo(cx + 22, shoulderY + 18);
        ctx.lineTo(cx + 44, shoulderY + 26 + scarf);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, headY, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx - 12, headY + 16);
      ctx.quadraticCurveTo(cx + 12, headY + 26, cx + 20, headY + 54);
      ctx.lineTo(cx + 2, headY + 58);
      ctx.quadraticCurveTo(cx - 30, headY + 42, cx - 24, headY + 8);
      ctx.closePath();
      ctx.fill();
    }, 256, 512);
  }

  const characterFrames = {
    idle: [
      makeCharacterFrame({ bob: 0, bodyLean: 0, frontLeg: 0, backLeg: 0, frontArm: 0, backArm: 0, scarf: 4 }),
      makeCharacterFrame({ bob: 3, bodyLean: 1, frontLeg: 0, backLeg: 0, frontArm: -2, backArm: 2, scarf: 8 }),
      makeCharacterFrame({ bob: 1, bodyLean: 0, frontLeg: 0, backLeg: 0, frontArm: 2, backArm: -2, scarf: 5 }),
      makeCharacterFrame({ bob: 2, bodyLean: -1, frontLeg: 0, backLeg: 0, frontArm: 1, backArm: 0, scarf: 7 })
    ],
    walk: [
      makeCharacterFrame({ bodyLean: 3, frontLeg: 10, backLeg: -6, frontArm: -16, backArm: 18, bob: 2, scarf: 8 }),
      makeCharacterFrame({ bodyLean: 4, frontLeg: 4, backLeg: -2, frontArm: -8, backArm: 10, bob: 4, scarf: 10 }),
      makeCharacterFrame({ bodyLean: 1, frontLeg: -2, backLeg: 3, frontArm: 2, backArm: -2, bob: 1, scarf: 6 }),
      makeCharacterFrame({ bodyLean: -2, frontLeg: -8, backLeg: 8, frontArm: 12, backArm: -14, bob: 3, scarf: 3 }),
      makeCharacterFrame({ bodyLean: -3, frontLeg: -4, backLeg: 4, frontArm: 8, backArm: -10, bob: 4, scarf: 1 }),
      makeCharacterFrame({ bodyLean: 0, frontLeg: 3, backLeg: -1, frontArm: -1, backArm: 3, bob: 1, scarf: 4 }),
      makeCharacterFrame({ bodyLean: 2, frontLeg: 8, backLeg: -8, frontArm: -14, backArm: 14, bob: 3, scarf: 7 }),
      makeCharacterFrame({ bodyLean: 4, frontLeg: 12, backLeg: -10, frontArm: -18, backArm: 18, bob: 2, scarf: 9 })
    ]
  };

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(520913);
  const WORLD = { minX: -92, maxX: 92, nearZ: 6.5, farZ: -42 };
  const fogColor = [0.93, 0.95, 0.95];
  const groundY = -4.25;
  const pathZ = 0.25;

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
    tint: [0.055, 0.060, 0.064],
    shade: 1,
    opacity: 1,
    noFog: false
  };

  const objects = [];

  function classifyLayer(z) {
    if (z > 2.0) return 'foreground';
    if (z > -9) return 'near';
    if (z > -23) return 'mid';
    return 'far';
  }

  function addBillboard(type, x, z, width, height, opts = {}) {
    objects.push({
      mesh: billboardMesh,
      texture: textures[type],
      x,
      y: opts.y ?? groundY,
      z,
      sx: width,
      sy: height,
      sz: 1,
      flip: opts.flip ?? (rand() > 0.5),
      shade: opts.shade ?? 1,
      opacity: opts.opacity ?? 1,
      noFog: !!opts.noFog,
      tint: opts.tint || null,
      layer: opts.layer || classifyLayer(z)
    });
  }

  function scatterBand(minX, maxX, step, jitter, cb) {
    for (let x = minX; x <= maxX; x += step) {
      cb(x + (rand() - 0.5) * jitter);
    }
  }

  function scatterForest() {
    const backTreeTypes = ['treeA', 'treeB', 'treeC', 'treeC', 'snag'];

    // Dense treeline behind the path: highest density close behind the character, then falling off into depth.
    for (let i = 0; i < 136; i++) {
      const depthMix = Math.pow(rand(), 1.65);
      const z = -4.5 - depthMix * 32.0;
      const x = WORLD.minX + rand() * (WORLD.maxX - WORLD.minX);
      const height = 9 + rand() * (18 - depthMix * 4);
      const width = height * (0.18 + rand() * 0.14);
      addBillboard(backTreeTypes[Math.floor(rand() * backTreeTypes.length)], x, z, width, height, {
        shade: 0.92 + rand() * 0.18
      });
    }

    // Additional slimmer far trunks to keep the distant forest full without overpowering it.
    for (let i = 0; i < 34; i++) {
      const z = -24 - rand() * 16;
      const x = WORLD.minX + rand() * (WORLD.maxX - WORLD.minX);
      const height = 12 + rand() * 10;
      addBillboard('snag', x, z, height * 0.16, height, { shade: 1.02 + rand() * 0.12, opacity: 0.92 });
    }

    // Back-side rocks and bushes around the base of the denser forest.
    for (let i = 0; i < 54; i++) {
      const depthMix = Math.pow(rand(), 1.35);
      const z = -3.5 - depthMix * 24;
      const x = WORLD.minX + rand() * (WORLD.maxX - WORLD.minX);
      if (rand() < 0.60) {
        const h = 1.5 + rand() * 2.6;
        addBillboard('bush', x, z, h * 1.45, h, { shade: 0.94 + rand() * 0.14, opacity: 0.90 });
      } else {
        const h = 1.0 + rand() * 1.7;
        addBillboard('rock', x, z, h * 1.55, h, { shade: 0.88 + rand() * 0.12, opacity: 0.94 });
      }
    }

    // Near side of the path: sparse trees only.
    for (let i = 0; i < 10; i++) {
      const x = WORLD.minX + rand() * (WORLD.maxX - WORLD.minX);
      const z = 2.2 + rand() * 2.6;
      const height = 7 + rand() * 6;
      addBillboard(rand() < 0.65 ? 'treeA' : 'snag', x, z, height * 0.18, height, {
        shade: 0.78 + rand() * 0.10,
        layer: 'foreground'
      });
    }

    // Near-side path props: more small rocks and bushes around the character lane.
    for (let i = 0; i < 60; i++) {
      const x = WORLD.minX + rand() * (WORLD.maxX - WORLD.minX);
      const z = 0.8 + rand() * 3.2;
      if (rand() < 0.52) {
        const h = 1.0 + rand() * 1.4;
        addBillboard('rock', x, z, h * 1.5, h, { shade: 0.78 + rand() * 0.08, layer: 'foreground' });
      } else {
        const h = 1.0 + rand() * 1.8;
        addBillboard('bush', x, z, h * 1.45, h, { shade: 0.84 + rand() * 0.10, layer: 'foreground', opacity: 0.92 });
      }
    }

    // Low grass belt along the near side, giving the ankle-height occlusion.
    scatterBand(WORLD.minX - 2, WORLD.maxX + 2, 2.1, 1.0, x => {
      const z = 1.3 + rand() * 1.4;
      const h = 1.0 + rand() * 1.0;
      addBillboard('grass', x, z, h * 0.95, h, {
        shade: 0.78 + rand() * 0.08,
        opacity: 0.95,
        layer: 'foreground'
      });
    });

    // Extra scattered grass just behind the path to soften the base of the back treeline.
    for (let i = 0; i < 62; i++) {
      const x = WORLD.minX + rand() * (WORLD.maxX - WORLD.minX);
      const z = -1.0 - rand() * 4.0;
      const h = 0.9 + rand() * 1.1;
      addBillboard('grass', x, z, h * 0.95, h, {
        shade: 0.88 + rand() * 0.10,
        opacity: 0.86
      });
    }

    objects.sort((a, b) => a.z - b.z);
  }

  scatterForest();

  const character = {
    mesh: billboardMesh,
    x: -6.0,
    y: groundY,
    z: pathZ,
    sx: 2.25,
    sy: 4.8,
    sz: 1,
    flip: false,
    layer: 'character',
    tint: [0.18, 0.17, 0.17],
    opacity: 0.96,
    noFog: false,
    screenOffsetX: -6.0,
    walkPhase: 0,
    lastFacing: 1
  };

  const debugTints = {
    ground: [0.50, 0.46, 0.75],
    character: [0.82, 0.58, 0.32],
    foreground: [0.70, 0.32, 0.28],
    near: [0.67, 0.43, 0.31],
    mid: [0.42, 0.59, 0.55],
    far: [0.37, 0.48, 0.68]
  };

  const camera = {
    x: 0,
    y: -1.55,
    z: 14.2,
    targetY: groundY + 1.15,
    targetZ: -14,
    minX: -52,
    maxX: 52
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
  let recentMotion = 0;
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

  function tintFor(obj) {
    if (debugDepth) return debugTints[obj.layer] || [1, 1, 1];
    if (obj.tint) return obj.tint;
    const base = [0.105, 0.112, 0.118];
    return [base[0] * obj.shade, base[1] * obj.shade, base[2] * obj.shade];
  }

  function drawObject(obj, view, textureOverride = null) {
    bindMesh(obj.mesh);
    gl.bindTexture(gl.TEXTURE_2D, textureOverride || obj.texture);
    gl.uniformMatrix4fv(loc.model, false, mat4Model(obj.x, obj.y, obj.z, obj.sx, obj.sy, obj.sz, obj.flip));
    gl.uniformMatrix4fv(loc.view, false, view);
    const tint = tintFor(obj);
    gl.uniform3f(loc.tint, tint[0], tint[1], tint[2]);
    gl.uniform3f(loc.fogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform1f(loc.fogNear, 7.0);
    gl.uniform1f(loc.fogFar, 46.0);
    gl.uniform1f(loc.fogAmount, obj.noFog ? 0 : (debugDepth ? 0.22 : 1.0));
    gl.uniform1f(loc.opacity, obj.opacity);
    gl.drawElements(gl.TRIANGLES, obj.mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function currentCharacterTexture(now, isWalking) {
    if (!isWalking) {
      const frame = Math.floor(now * 0.0035) % characterFrames.idle.length;
      return characterFrames.idle[frame];
    }
    const fps = 10;
    const frame = Math.floor(character.walkPhase * fps) % characterFrames.walk.length;
    return characterFrames.walk[frame];
  }

  function render(now) {
    resize();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    const dir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
    if (dir) {
      camera.x += dir * 7.0 * dt;
      camera.x = Math.max(camera.minX, Math.min(camera.maxX, camera.x));
      hideHint();
    }

    recentMotion = (camera.x - previousCameraX) / Math.max(dt, 0.0001);
    previousCameraX = camera.x;

    const isWalking = Math.abs(recentMotion) > 0.2;
    if (isWalking) {
      character.lastFacing = recentMotion >= 0 ? 1 : -1;
      character.walkPhase += dt;
    }
    character.flip = character.lastFacing < 0;
    character.x = camera.x + character.screenOffsetX;

    gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(loc.projection, false, projection);

    const eye = [camera.x, camera.y, camera.z];
    const target = [camera.x, camera.targetY, camera.targetZ];
    const view = mat4LookAt(eye, target, [0, 1, 0]);

    drawObject(ground, view);

    const charTexture = currentCharacterTexture(now, isWalking);
    let drawnCharacter = false;
    for (const obj of objects) {
      if (!drawnCharacter && obj.z >= character.z) {
        drawObject(character, view, charTexture);
        drawnCharacter = true;
      }
      drawObject(obj, view);
    }
    if (!drawnCharacter) drawObject(character, view, charTexture);

    statusEl.textContent = debugDepth
      ? `Depth view · camera X ${camera.x.toFixed(1)} · path + character`
      : `3D forest · camera X ${camera.x.toFixed(1)} · depth fog`;

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
    camera.x = Math.max(camera.minX, Math.min(camera.maxX, dragStartCameraX - dx * 0.032));
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
