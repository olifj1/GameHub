(() => {
  'use strict';

  const Rig = window.GameHubWalkRig;
  if (!Rig) return;

  const canvas = document.getElementById('sidescroll-canvas');
  const errorBox = document.getElementById('sidescroll-error');
  const statusEl = document.getElementById('sidescroll-status');
  const hintEl = document.getElementById('sidescroll-hint');
  const debugBtn = document.getElementById('sidescroll-depth');
  const depthKey = document.getElementById('sidescroll-depth-key');
  const leftBtn = document.getElementById('sidescroll-left');
  const rightBtn = document.getElementById('sidescroll-right');
  const runBtn = document.getElementById('sidescroll-run');
  const jumpBtn = document.getElementById('sidescroll-jump');

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

  const treeAssets = [
    ['01', 237, 955], ['02', 382, 990], ['03', 230, 899],
    ['04', 248, 929], ['05', 240, 837], ['06', 293, 1018]
  ];
  treeAssets.forEach(([id, w, h]) => {
    const key = `tree${id}`;
    assetAspect[key] = w / h;
    textures[key] = createImageTexture(`sidescroll-tree-${id}.png?v=1.8.74`, key);
  });

  const groundAssets = [
    ['01', 351, 297], ['02', 360, 308], ['03', 394, 204], ['04', 276, 281],
    ['05', 389, 273], ['06', 304, 294], ['07', 267, 275], ['08', 394, 207],
    ['09', 353, 267], ['10', 309, 171], ['11', 343, 276], ['12', 398, 228]
  ];
  groundAssets.forEach(([id, w, h]) => {
    const key = `ground${id}`;
    assetAspect[key] = w / h;
    const fallback = id === '12' ? 'sidescroll-ground-11.png?v=1.8.74' : null;
    textures[key] = createImageTexture(`sidescroll-ground-${id}.png?v=1.8.74`, key, fallback);
  });

  textures.rigAtlas = createImageTexture(Rig.ATLAS.url.startsWith('data:') ? Rig.ATLAS.url : `${Rig.ATLAS.url}?v=1.8.74`, 'Walk Lab cutout rig atlas');

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
  const TEST_OBSTACLE_X = 5.4;
  const TEST_OBSTACLE_Z = 0.10;
  const TEST_OBSTACLE_HEIGHT = 0.74;
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
    tint: [0.205, 0.195, 0.180],
    opacity: 1,
    noFog: false,
    wrap: false
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
      assetName: type,
      layer: opts.layer || classifyLayer(z),
      wrap: opts.wrap !== false
    });
  }

  function scatterForest() {
    const trees = ['tree01', 'tree02', 'tree03', 'tree04', 'tree05', 'tree06'];
    const allGround = ['ground01','ground02','ground03','ground04','ground05','ground06','ground07','ground08','ground09','ground10','ground11','ground12'];
    const grassScrub = ['ground01','ground02','ground03','ground05','ground06','ground08','ground09','ground10','ground11','ground12'];
    const rocks = ['ground03','ground04','ground07','ground10','ground11'];
    const edgeGrass = ['ground01','ground06','ground10','ground11'];

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

    // A single readable fallen-log obstacle sits on the playable centre strip.
    // It is deliberately modest for the first jump-tuning pass.
    addObject(frontOccluders, 'ground09', TEST_OBSTACLE_X, TEST_OBSTACLE_Z, null, TEST_OBSTACLE_HEIGHT, {
      y: pathGroundYAt(TEST_OBSTACLE_X, TEST_OBSTACLE_Z),
      shade: 1.02,
      opacity: 0.99,
      layer: 'foreground'
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

  scatterForest();

  const character = {
    x: 0,
    y: pathGroundYAt(0, pathZ),
    z: pathZ,
    scale: 2.31,
    tint: [1.0, 1.0, 1.0],
    opacity: 0.99,
    screenOffsetX: -0.18,
    distanceTravelled: 0,
    lastFacing: 1
  };

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
  let moveLeft = false;
  let moveRight = false;
  const WALK_SPEED = 1.15;
  const RUN_SPEED = 2.85;
  const WALK_STRIDE = 1.45;
  const RUN_STRIDE = 2.05;
  const JUMP_VELOCITY = 4.30;
  const JUMP_GRAVITY = 9.20;
  const JUMP_DURATION = (JUMP_VELOCITY * 2) / JUMP_GRAVITY;

  let runHeld = false;
  let runBlend = 0;
  let locomotionPhase = 0;
  let jumping = false;
  let jumpTime = 0;
  let jumpOffset = 0;
  let jumpVelocity = 0;
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

  function nearestObstacleX(aroundX) {
    return wrapX(TEST_OBSTACLE_X, aroundX);
  }

  function resolveObstacleMove(currentCameraX, proposedCameraX, clearanceHeight) {
    if (clearanceHeight >= TEST_OBSTACLE_CLEARANCE) return proposedCameraX;
    const offset = character.screenOffsetX;
    const currentX = currentCameraX + offset;
    const nextX = proposedCameraX + offset;
    const obstacleX = nearestObstacleX(nextX);
    const radius = TEST_OBSTACLE_HALF_WIDTH + 0.18;
    if (Math.abs(nextX - obstacleX) < radius) {
      // Low movement cannot occupy the log.  If a too-short jump drops back
      // into its collision span, return to the side the character came from;
      // a running jump has enough airborne travel to reach the far side.
      const side = currentX <= obstacleX ? -1 : 1;
      return obstacleX + side * radius - offset;
    }
    return proposedCameraX;
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
    bindMesh(obj.mesh);
    gl.bindTexture(gl.TEXTURE_2D, extra?.texture || obj.texture);
    const drawX = extra?.x ?? (obj.wrap ? wrapX(obj.x, camera.x) : obj.x);
    gl.uniformMatrix4fv(loc.model, false, mat4Model(drawX, obj.y, obj.z, obj.sx, obj.sy, obj.sz, obj.flip));
    gl.uniformMatrix4fv(loc.view, false, view);
    gl.uniformMatrix4fv(loc.projection, false, projection);
    const tint = tintFor(obj);
    gl.uniform3f(loc.tint, tint[0], tint[1], tint[2]);
    gl.uniform3f(loc.fogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform1f(loc.fogNear, 6.2);
    gl.uniform1f(loc.fogFar, 44.0);
    gl.uniform1f(loc.fogAmount, obj.noFog ? 0 : (debugDepth ? 0.22 : 1.0));
    gl.uniform1f(loc.opacity, obj.opacity);
    gl.uniform2f(loc.uvScale, extra?.uvScale?.[0] ?? 1, extra?.uvScale?.[1] ?? 1);
    gl.uniform2f(loc.uvOffset, extra?.uvOffset?.[0] ?? 0, extra?.uvOffset?.[1] ?? 0);
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

  function drawRigPartWebGL(part, view, facing) {
    const mesh = rigPartMeshes[part.name];
    const r = Rig.atlasRect(part.name);
    if (!mesh || !r) return;

    const ax = character.x + part.a.x * character.scale * facing;
    const ay = character.y + part.a.y * character.scale;
    const bx = character.x + part.b.x * character.scale * facing;
    const by = character.y + part.b.y * character.scale;
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
    const facing = character.lastFacing >= 0 ? 1 : -1;
    Rig.partsForPose(pose).forEach(part => drawRigPartWebGL(part, view, facing));
  }

  function render(now) {
    resize();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    const moveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);

    // Update vertical motion first so obstacle clearance is evaluated against
    // this frame's actual jump height.  The new arc is roughly twice as tall
    // as v1.8.73 and lasts just under a second.
    if (jumping) {
      jumpTime += dt;
      jumpVelocity -= JUMP_GRAVITY * dt;
      jumpOffset += jumpVelocity * dt;
      if (jumpOffset <= 0 && jumpTime > 0.18) {
        jumpOffset = 0;
        jumpVelocity = 0;
        jumping = false;
        jumpTime = 0;
      }
    }

    const targetRun = runHeld && moveDir !== 0 ? 1 : 0;
    // A slightly slower blend is intentional.  Phase is no longer recomputed
    // from a changing stride length, so walk->run cannot jump through several
    // animation frames while the blend is happening.
    runBlend += (targetRun - runBlend) * Math.min(1, dt * 4.4);
    const smoothRun = runBlend * runBlend * (3 - 2 * runBlend);
    const speed = Rig.lerp(WALK_SPEED, RUN_SPEED, smoothRun);
    if (moveDir) {
      const proposedX = camera.x + moveDir * speed * dt;
      camera.x = resolveObstacleMove(camera.x, proposedX, jumpOffset);
      hideHint();
    }

    const cameraDelta = camera.x - previousCameraX;
    const isWalking = Math.abs(cameraDelta) > 0.0001;
    if (isWalking) {
      const travel = Math.abs(cameraDelta);
      const stride = Rig.lerp(WALK_STRIDE, RUN_STRIDE, smoothRun);
      locomotionPhase = (locomotionPhase + travel / Math.max(0.001, stride)) % 1;
      character.distanceTravelled += travel;
      character.lastFacing = cameraDelta >= 0 ? 1 : -1;
    }
    previousCameraX = camera.x;

    character.x = camera.x + character.screenOffsetX;
    character.y = pathGroundYAt(character.x, pathZ) + jumpOffset;

    gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const eye = [camera.x, camera.y, camera.z];
    const target = [camera.x, camera.targetY, camera.targetZ];
    const view = mat4LookAt(eye, target, [0, 1, 0]);

    drawObject({ ...ground, x: camera.x }, view);
    drawObject(pathStrip, view);
    for (const obj of backdrop) drawObject(obj, view);
    for (const obj of midfill) drawObject(obj, view);

    drawRigCharacter(view, isWalking);

    for (const obj of frontOccluders) drawObject(obj, view);

    const motionLabel = jumping ? 'JUMP' : (runBlend > .55 && isWalking ? 'RUN' : (isWalking ? 'WALK' : 'IDLE'));
    statusEl.textContent = debugDepth
      ? `Depth view · camera X ${camera.x.toFixed(1)} · raised path geometry`
      : `3D forest · ${motionLabel} · camera X ${camera.x.toFixed(1)} · warm path / cool fog`;

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
  bindHold(runBtn, v => {
    runHeld = v;
    runBtn?.setAttribute('aria-pressed', String(v));
  });

  function triggerJump(){
    if (jumping) return;
    jumping = true;
    jumpTime = 0;
    jumpOffset = 0;
    jumpVelocity = JUMP_VELOCITY;
    hideHint();
  }
  jumpBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    triggerJump();
    jumpBtn.setPointerCapture?.(e.pointerId);
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
    camera.x = dragStartCameraX - dx * 0.0075;
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
    if (e.key === 'Shift') runHeld = true;
    if (e.key === ' ' || e.key === 'ArrowUp' || key === 'w') { e.preventDefault(); triggerJump(); }
    if (e.key === '0') camera.x = 0;
  });

  window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowLeft' || key === 'a') moveLeft = false;
    if (e.key === 'ArrowRight' || key === 'd') moveRight = false;
    if (e.key === 'Shift') runHeld = false;
  });

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    moveLeft = false;
    moveRight = false;
    runHeld = false;
    jumping = false;
    jumpTime = 0;
    jumpOffset = 0;
    jumpVelocity = 0;
    locomotionPhase = 0;
    character.y = pathGroundYAt(character.x, pathZ);
    lastTime = performance.now();
    previousCameraX = camera.x;
  });

  resize();
  requestAnimationFrame(render);
})();
