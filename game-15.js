(() => {
  'use strict';

  const canvas = document.getElementById('room-canvas');
  const carousel = document.getElementById('room-carousel');
  const selectedName = document.getElementById('room-selection-name');
  const rotateBtn = document.getElementById('room-rotate');
  const removeBtn = document.getElementById('room-remove');
  const clearBtn = document.getElementById('room-clear');
  const hint = document.getElementById('room-stage-hint');
  const wallSwatches = document.getElementById('room-wall-swatches');
  const floorSwatches = document.getElementById('room-floor-swatches');
  const prevBtn = document.getElementById('room-carousel-prev');
  const nextBtn = document.getElementById('room-carousel-next');
  const roomLabel = document.getElementById('room-current-label');
  const lightingBtn = document.getElementById('room-lighting');

  if (!canvas) return;

  if (!window.THREE) {
    hint.textContent = '3D renderer could not load. Reconnect once, then My House will work offline.';
    [rotateBtn, removeBtn, clearBtn, lightingBtn, prevBtn, nextBtn].forEach(b => { if (b) b.disabled = true; });
    return;
  }

  const THREE = window.THREE;
  const STORAGE_KEY = 'gamehub-my-house-webgl-v1';
  const MODEL_SCALE = 0.62;
  const TAU = Math.PI * 2;

  // The house now uses metre-like real-world proportions.
  const ROOM_W = 4.80;
  const ROOM_D = 3.60;
  const ROOM_H = 2.45;
  const SLAB_H = 0.24;
  const WALL_T = 0.14;
  const UPPER_Y = ROOM_H + SLAB_H;
  const HOUSE_W = ROOM_W * 2;
  const HOUSE_H = UPPER_Y + ROOM_H;
  const HOUSE_MIN_X = -HOUSE_W / 2;
  const HOUSE_MAX_X = HOUSE_W / 2;
  const BACK_Z = -ROOM_D / 2;
  const FRONT_Z = ROOM_D / 2;
  const DOOR_H = 2.04;
  const DOOR_SPAN_Z = 0.90;
  const DOOR_CENTRE_Z = 1.22;
  const DOOR_Z0 = DOOR_CENTRE_Z - DOOR_SPAN_Z / 2;
  const DOOR_Z1 = Math.min(FRONT_Z - 0.08, DOOR_CENTRE_Z + DOOR_SPAN_Z / 2);

  const STAIR = {
    x0: HOUSE_MIN_X + 0.45,
    x1: -0.82,
    z0: -0.88,
    z1: 0.18,
    steps: 15
  };

  const wallPalette = ['#f1dfd6', '#eadcc9', '#d8e6dc', '#dbe3ef', '#ead9e5', '#efe5bf'];
  const floorPalette = ['#c8a883', '#b9906c', '#d2c3ae', '#9ca99c', '#b4a297', '#c9b596'];

  const rooms = [
    { id:'bedroom', name:'Bedroom', cx:-ROOM_W/2, floorY:UPPER_Y, wall:wallPalette[0], floor:floorPalette[0], decor:'window' },
    { id:'studio', name:'Studio', cx: ROOM_W/2, floorY:UPPER_Y, wall:wallPalette[1], floor:floorPalette[2], decor:'gallery' },
    { id:'hall', name:'Hall', cx:-ROOM_W/2, floorY:0, wall:wallPalette[3], floor:floorPalette[4], decor:'stars' },
    { id:'living', name:'Living room', cx: ROOM_W/2, floorY:0, wall:wallPalette[2], floor:floorPalette[0], decor:'living' }
  ];

  rooms.forEach(room => {
    room.minX = room.cx - ROOM_W/2;
    room.maxX = room.cx + ROOM_W/2;
  });

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const scaled = v => v * MODEL_SCALE;
  const box = (x,y,z,w,h,d,color,opts={}) => ({kind:'box',x,y,z,w,h,d,color,...opts});
  const cyl = (x,y,z,r,h,color,opts={}) => ({kind:'cyl',x,y,z,r,h,color,...opts});
  const ellipsoid = (x,y,z,rx,ry,rz,color,opts={}) => ({kind:'ellipsoid',x,y,z,rx,ry,rz,color,...opts});

  // Furniture recipes remain deliberately close to v1.8.16 for a clean renderer A/B test.
  function makeCloudBed(){
    return [
      box(0,0.18,0,2.95,0.36,3.28,'#a67d65'), box(0,0.48,0,2.78,0.34,3.04,'#f7efe7'),
      ellipsoid(0,0.71,0.25,1.37,0.16,1.28,'#dca09b'),
      ellipsoid(-0.70,0.86,-0.89,0.63,0.18,0.43,'#fffaf4'), ellipsoid(0.60,0.86,-0.89,0.63,0.18,0.43,'#fffaf4'),
      box(0,1.22,-1.54,2.84,1.42,0.16,'#b88c75'),
      ellipsoid(-0.82,1.78,-1.43,0.72,0.56,0.18,'#f2d7d1'), ellipsoid(0,1.96,-1.43,0.88,0.72,0.18,'#f2d7d1'), ellipsoid(0.82,1.78,-1.43,0.72,0.56,0.18,'#f2d7d1')
    ];
  }

  function makeScallopSofa(){
    const teal='#789aa2', teal2='#91b0b4', seat='#aec5c6', wood='#7d6251';
    return [
      cyl(-1.28,0,-0.38,0.10,0.36,wood), cyl(1.28,0,-0.38,0.10,0.36,wood), cyl(-1.28,0,0.43,0.10,0.36,wood), cyl(1.28,0,0.43,0.10,0.36,wood),
      ellipsoid(0,0.48,0,1.66,0.35,0.78,teal),
      ellipsoid(-0.92,0.72,0.13,0.55,0.20,0.60,seat), ellipsoid(0,0.72,0.13,0.55,0.20,0.60,seat), ellipsoid(0.92,0.72,0.13,0.55,0.20,0.60,seat),
      ellipsoid(-0.95,1.40,-0.44,0.62,0.72,0.27,teal2), ellipsoid(0,1.53,-0.46,0.67,0.79,0.27,teal2), ellipsoid(0.95,1.40,-0.44,0.62,0.72,0.27,teal2),
      ellipsoid(-1.55,0.93,0.02,0.30,0.48,0.69,teal), ellipsoid(1.55,0.93,0.02,0.30,0.48,0.69,teal),
      ellipsoid(-0.52,1.05,-0.02,0.37,0.30,0.17,'#e8ba78',{rot:-0.17}), ellipsoid(0.62,1.08,-0.04,0.36,0.30,0.17,'#d9958f',{rot:0.18})
    ];
  }

  function makePetalChair(){
    const coral='#d48e87', light='#e5aaa1', wood='#7e6250';
    return [
      cyl(-0.46,0,-0.30,0.09,0.35,wood), cyl(0.46,0,-0.30,0.09,0.35,wood), cyl(-0.46,0,0.34,0.09,0.35,wood), cyl(0.46,0,0.34,0.09,0.35,wood),
      ellipsoid(0,0.52,0,0.86,0.31,0.72,coral), ellipsoid(0,0.74,0.10,0.63,0.18,0.54,'#f0c0b8'),
      ellipsoid(-0.47,1.24,-0.43,0.50,0.66,0.24,light,{rot:-0.12}), ellipsoid(0,1.44,-0.48,0.54,0.78,0.25,light), ellipsoid(0.47,1.24,-0.43,0.50,0.66,0.24,light,{rot:0.12}),
      ellipsoid(-0.73,0.87,0.05,0.21,0.40,0.60,coral), ellipsoid(0.73,0.87,0.05,0.21,0.40,0.60,coral)
    ];
  }

  function makePebbleCoffeeTable(){
    const top='#caa27e', rim='#a97f61', leg='#8b6b55';
    return [
      cyl(-0.78,0,-0.34,0.12,0.80,leg,{taper:0.72}), cyl(0.76,0,-0.30,0.12,0.80,leg,{taper:0.72}), cyl(-0.30,0,0.42,0.11,0.80,leg,{taper:0.72}),
      ellipsoid(0,0.86,0,1.32,0.14,0.78,rim), ellipsoid(-0.10,0.96,0.02,1.27,0.10,0.73,top)
    ];
  }

  function makeGlowLamp(){
    return [
      ellipsoid(0,0.13,0,0.50,0.13,0.50,'#8a6d5d'), ellipsoid(0,0.38,0,0.34,0.30,0.34,'#b58068'), cyl(0,0.57,0,0.075,0.78,'#876d5e'),
      cyl(0,1.29,0,0.58,0.58,'#e8bd76',{taper:0.66,emissive:true}), ellipsoid(0,1.27,0,0.60,0.11,0.60,'#d7a85f',{emissive:true}), ellipsoid(0,1.86,0,0.40,0.08,0.40,'#f2d08d',{emissive:true})
    ];
  }

  function makeSunburstRug(){
    const parts=[ellipsoid(0,0.045,0,2.02,0.045,1.40,'#d8b384'),ellipsoid(0,0.052,0,1.74,0.035,1.15,'#ead8b4')];
    const colours=['#d98f83','#7f9e91','#d8b36a'];
    for(let i=0;i<10;i++){ const a=TAU*i/10; parts.push(ellipsoid(Math.cos(a)*1.17,0.060,Math.sin(a)*0.74,0.19,0.025,0.14,colours[i%3],{rot:-a})); }
    parts.push(ellipsoid(0,0.063,0,0.35,0.026,0.28,'#d99a8f'));
    return parts;
  }

  function makeBubbleDrawers(){
    const wood='#bd9875';
    return [
      box(0,0.76,0,2.18,1.52,0.92,wood), ellipsoid(0,1.55,0,1.16,0.13,0.54,'#d1ad89'),
      box(0,1.18,0.474,1.86,0.38,0.04,'#c8a17d'), box(0,0.74,0.474,1.86,0.38,0.04,'#c8a17d'), box(0,0.30,0.474,1.86,0.38,0.04,'#c8a17d'),
      ellipsoid(0,1.18,0.52,0.12,0.12,0.08,'#769687'), ellipsoid(0,0.74,0.52,0.12,0.12,0.08,'#d88d83'), ellipsoid(0,0.30,0.52,0.12,0.12,0.08,'#dcb86f')
    ];
  }

  function makeArchedWardrobe(){
    return [
      box(0,1.43,0,2.12,2.86,1.02,'#9d826e'), ellipsoid(0,2.84,0,1.06,0.46,0.51,'#9d826e'),
      box(-0.52,1.42,0.525,0.93,2.56,0.05,'#ae9078'), box(0.52,1.42,0.525,0.93,2.56,0.05,'#ae9078'), box(0,1.42,0.56,0.05,2.52,0.03,'#806b5b'),
      ellipsoid(-0.15,1.43,0.61,0.09,0.09,0.07,'#e3bd77'), ellipsoid(0.15,1.43,0.61,0.09,0.09,0.07,'#e3bd77')
    ];
  }

  function makeBunnyBox(){
    return [
      box(0,0.42,0,1.78,0.84,1.04,'#8eb1b2'), ellipsoid(0,0.91,0,0.90,0.18,0.55,'#a5c3c3'),
      ellipsoid(-0.36,1.21,0.16,0.18,0.40,0.15,'#a5c3c3'), ellipsoid(0.36,1.21,0.16,0.18,0.40,0.15,'#a5c3c3'),
      ellipsoid(-0.24,0.52,0.55,0.07,0.08,0.04,'#334744'), ellipsoid(0.24,0.52,0.55,0.07,0.08,0.04,'#334744'), ellipsoid(0,0.37,0.56,0.09,0.07,0.04,'#d78c8c')
    ];
  }

  function makeSproutPlant(){
    return [
      cyl(0,0,0,0.48,0.58,'#bb8266',{taper:0.78}), cyl(0,0.58,0,0.08,0.92,'#5e8068'),
      ellipsoid(-0.32,1.15,0.03,0.36,0.22,0.18,'#77a27c',{rot:-0.35}), ellipsoid(0.34,1.35,-0.04,0.38,0.24,0.19,'#6e9674',{rot:0.30}),
      ellipsoid(-0.06,1.55,0.12,0.34,0.26,0.18,'#85ad83'), ellipsoid(0.08,1.07,-0.16,0.34,0.20,0.16,'#658b6c',{rot:0.58})
    ];
  }

  function makeBeanbag(){ return [ellipsoid(0,0.48,0,0.92,0.54,0.90,'#d08d82'),ellipsoid(-0.22,0.78,-0.12,0.58,0.37,0.60,'#dc9f94')]; }
  function makeBookStack(){ return [box(0,0.045,0,0.72,0.09,0.48,'#7896a2',{rot:-0.08}),box(0.04,0.135,0.01,0.68,0.09,0.45,'#e1a06f',{rot:0.07}),box(-0.04,0.225,-0.01,0.64,0.09,0.42,'#b88083',{rot:-0.03})]; }
  function makeMug(){ return [cyl(0,0,0,0.22,0.36,'#e9d7b7',{taper:0.90}),ellipsoid(0,0.36,0,0.21,0.045,0.21,'#6f574a'),ellipsoid(0.25,0.20,0,0.16,0.14,0.08,'#e9d7b7'),ellipsoid(0.27,0.20,0,0.08,0.075,0.085,'#6f574a')]; }
  function makeVase(){ return [ellipsoid(0,0.18,0,0.28,0.20,0.28,'#d78d82'),cyl(0,0.28,0,0.18,0.32,'#d78d82',{taper:0.68}),cyl(-0.06,0.56,0,0.025,0.48,'#62836c'),cyl(0.07,0.56,0.02,0.025,0.42,'#62836c'),ellipsoid(-0.07,1.06,0,0.16,0.12,0.13,'#e5b969'),ellipsoid(0.08,0.99,0.02,0.16,0.12,0.13,'#e4a0a0')]; }
  function makeCandle(){ return [cyl(0,0,0,0.18,0.38,'#f0dfbf',{taper:0.94}),ellipsoid(0,0.43,0,0.07,0.12,0.06,'#e9ad56',{emissive:true}),ellipsoid(0,0.48,0,0.035,0.075,0.03,'#fff1b6',{emissive:true})]; }
  function makeFruitBowl(){ return [ellipsoid(0,0.10,0,0.52,0.13,0.40,'#9d7b65'),ellipsoid(-0.20,0.26,0.02,0.18,0.18,0.18,'#df9b59'),ellipsoid(0.08,0.26,-0.08,0.18,0.18,0.18,'#d17c63'),ellipsoid(0.25,0.26,0.09,0.18,0.18,0.18,'#e1b35e')]; }
  function makeTinyPlant(){ return [cyl(0,0,0,0.24,0.28,'#b88768',{taper:0.76}),ellipsoid(-0.16,0.48,0,0.20,0.15,0.10,'#789b79',{rot:-0.42}),ellipsoid(0.17,0.53,0.01,0.20,0.15,0.10,'#6c8f70',{rot:0.42}),ellipsoid(0,0.66,-0.01,0.18,0.17,0.10,'#88aa82')]; }

  const templates = [
    { id:'bed', name:'Cloud bed', glyph:'☁', colour:'#d89a94', footprint:[2.9,3.25], maker:makeCloudBed },
    { id:'sofa', name:'Scallop sofa', glyph:'⌒', colour:'#7e9fa6', footprint:[3.5,1.65], maker:makeScallopSofa },
    { id:'chair', name:'Petal chair', glyph:'◡', colour:'#d48e87', footprint:[1.8,1.6], maker:makePetalChair },
    { id:'coffee', name:'Pebble table', glyph:'●', colour:'#caa27e', footprint:[2.75,1.65], supportHeight:1.03, supportSize:[2.28,1.18], maker:makePebbleCoffeeTable },
    { id:'lamp', name:'Glow lamp', glyph:'◉', colour:'#e8bd76', footprint:[1.3,1.3], maker:makeGlowLamp, lightHeight:1.75 },
    { id:'rug', name:'Sunburst rug', glyph:'✺', colour:'#d8b384', footprint:[4.2,3.0], maker:makeSunburstRug },
    { id:'drawers', name:'Bubble drawers', glyph:'•••', colour:'#c8a17d', footprint:[2.3,1.0], supportHeight:1.66, supportSize:[1.95,0.72], maker:makeBubbleDrawers },
    { id:'wardrobe', name:'Tall wardrobe', glyph:'∩', colour:'#9d826e', footprint:[2.2,1.1], maker:makeArchedWardrobe },
    { id:'toybox', name:'Bunny box', glyph:'⌣', colour:'#8eb1b2', footprint:[1.9,1.2], maker:makeBunnyBox },
    { id:'plant', name:'Sprout plant', glyph:'✦', colour:'#77a27c', footprint:[1.2,1.2], maker:makeSproutPlant },
    { id:'beanbag', name:'Beanbag', glyph:'◒', colour:'#d08d82', footprint:[1.9,1.9], maker:makeBeanbag },
    { id:'books', name:'Book stack', glyph:'≡', colour:'#7896a2', footprint:[0.78,0.54], place:'surface', maker:makeBookStack },
    { id:'mug', name:'Little mug', glyph:'◔', colour:'#e9d7b7', footprint:[0.52,0.46], place:'surface', maker:makeMug },
    { id:'vase', name:'Flower vase', glyph:'✿', colour:'#d78d82', footprint:[0.58,0.58], place:'surface', maker:makeVase },
    { id:'candle', name:'Candle', glyph:'◦', colour:'#f0dfbf', footprint:[0.42,0.42], place:'surface', maker:makeCandle },
    { id:'fruit', name:'Fruit bowl', glyph:'●', colour:'#df9b59', footprint:[1.0,0.8], place:'surface', maker:makeFruitBowl },
    { id:'tinyplant', name:'Tiny plant', glyph:'❧', colour:'#789b79', footprint:[0.62,0.62], place:'surface', maker:makeTinyPlant }
  ];

  const defaultItems = [
    { id:'seed-bed', type:'bed', room:'bedroom', x:-3.25, z:-0.28, rot:0 },
    { id:'seed-drawers', type:'drawers', room:'bedroom', x:-0.65, z:-1.12, rot:0 },
    { id:'seed-tinyplant', type:'tinyplant', room:'bedroom', x:0.0, z:0.0, rot:0, supportId:'seed-drawers' },
    { id:'seed-chair-studio', type:'chair', room:'studio', x:1.55, z:-0.82, rot:0 },
    { id:'seed-plant-studio', type:'plant', room:'studio', x:3.75, z:-1.12, rot:0 },
    { id:'seed-rug-living', type:'rug', room:'living', x:2.50, z:0.40, rot:0 },
    { id:'seed-sofa', type:'sofa', room:'living', x:2.45, z:-1.05, rot:0 },
    { id:'seed-chair', type:'chair', room:'living', x:4.05, z:0.50, rot:-Math.PI/2 },
    { id:'seed-coffee', type:'coffee', room:'living', x:2.45, z:0.43, rot:0 },
    { id:'seed-lamp', type:'lamp', room:'living', x:0.72, z:-1.12, rot:0 },
    { id:'seed-books', type:'books', room:'living', x:-0.37, z:0.02, rot:0.08, supportId:'seed-coffee' },
    { id:'seed-mug', type:'mug', room:'living', x:0.35, z:0.04, rot:0, supportId:'seed-coffee' },
    { id:'seed-vase', type:'vase', room:'living', x:0.03, z:-0.18, rot:0, supportId:'seed-coffee' }
  ];

  let state = {
    lighting:'day',
    rooms:Object.fromEntries(rooms.map(r => [r.id,{wall:r.wall,floor:r.floor}])),
    items:defaultItems.map(i => ({...i})),
    camera:{x:2.2,y:1.20,zoom:1.35}
  };

  let selectedId = null;
  let activeRoomId = 'living';
  let idCounter = 1;
  let gesture = null;
  let resizeRaf = 0;

  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0xd9d0c7, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9d0c7);

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 60);
  const cameraOffset = new THREE.Vector3(0, 2.55, 11.8);
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  const tempVec = new THREE.Vector3();
  const tempQuat = new THREE.Quaternion();
  const tempEuler = new THREE.Euler();

  const houseGroup = new THREE.Group();
  const itemRoot = new THREE.Group();
  const decorGroup = new THREE.Group();
  scene.add(houseGroup, decorGroup, itemRoot);

  const hemi = new THREE.HemisphereLight(0xfff7eb, 0x7f858d, 1.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d7, 2.35);
  sun.position.set(-5.5, 9.0, 7.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 24;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.022;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0,2.1,-0.3);

  const eveningFill = new THREE.AmbientLight(0xbcc5d6, 0.0);
  scene.add(eveningFill);

  const roomMaterials = new Map();
  const itemGroups = new Map();
  const supportAnchors = new Map();
  const supportPlanes = [];
  const selectableMeshes = [];
  const localLights = [];
  const emissiveMeshes = [];
  let selectionHelper = null;

  function roomById(id){ return rooms.find(r => r.id === id) || rooms[0]; }
  function templateById(id){ return templates.find(t => t.id === id); }
  function itemById(id){ return state.items.find(i => i.id === id); }

  function material(color, opts={}){
    const mat = new THREE.MeshStandardMaterial({
      color:new THREE.Color(color),
      roughness:opts.roughness ?? 0.88,
      metalness:opts.metalness ?? 0.0,
      side:opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide
    });
    if (opts.emissive) {
      mat.emissive = new THREE.Color(color);
      mat.emissiveIntensity = state.lighting === 'evening' ? 0.75 : 0.08;
    }
    return mat;
  }

  function setShadowFlags(mesh, cast=true, receive=true){
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }

  function addBox(parent, x,y,z,w,h,d,color, opts={}){
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material(color, opts));
    mesh.position.set(x,y,z);
    if (opts.rot) mesh.rotation.y = opts.rot;
    setShadowFlags(mesh, opts.castShadow !== false, opts.receiveShadow !== false);
    parent.add(mesh);
    return mesh;
  }

  function addCylinder(parent, x,y,z,r,h,color, opts={}){
    const taper = opts.taper == null ? 1 : opts.taper;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r*taper, r, h, 24, 1, false), material(color, opts));
    mesh.position.set(x,y+h/2,z);
    if (opts.rot) mesh.rotation.y = opts.rot;
    setShadowFlags(mesh, opts.castShadow !== false, opts.receiveShadow !== false);
    parent.add(mesh);
    return mesh;
  }

  function addEllipsoid(parent, x,y,z,rx,ry,rz,color, opts={}){
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), material(color, opts));
    mesh.scale.set(rx,ry,rz);
    mesh.position.set(x,y,z);
    if (opts.rot) mesh.rotation.y = opts.rot;
    setShadowFlags(mesh, opts.castShadow !== false, opts.receiveShadow !== false);
    parent.add(mesh);
    return mesh;
  }

  function buildPrimitive(parent, p, itemId){
    const opts={rot:p.rot||0,emissive:!!p.emissive,roughness:p.emissive?0.72:0.9};
    let mesh;
    if(p.kind==='box') mesh=addBox(parent,scaled(p.x),scaled(p.y),scaled(p.z),scaled(p.w),scaled(p.h),scaled(p.d),p.color,opts);
    else if(p.kind==='cyl') mesh=addCylinder(parent,scaled(p.x),scaled(p.y),scaled(p.z),scaled(p.r),scaled(p.h),p.color,{...opts,taper:p.taper});
    else mesh=addEllipsoid(parent,scaled(p.x),scaled(p.y),scaled(p.z),scaled(p.rx),scaled(p.ry),scaled(p.rz),p.color,opts);
    mesh.userData.itemId=itemId;
    selectableMeshes.push(mesh);
    if(p.emissive) emissiveMeshes.push(mesh);
    return mesh;
  }

  function addArchitectureBox(x0,x1,y0,y1,z0,z1,color, opts={}){
    if(x1<=x0||y1<=y0||z1<=z0) return null;
    return addBox(houseGroup,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,x1-x0,y1-y0,z1-z0,color,{roughness:0.96,...opts});
  }

  function makeRoomMaterial(roomId, key, color){
    const mat=material(color,{roughness:0.96});
    roomMaterials.set(`${roomId}:${key}`,mat);
    return mat;
  }

  function addDecorBox(parent,x,y,z,w,h,d,color){
    return addBox(parent,x,y,z,w,h,d,color,{castShadow:false,receiveShadow:true,roughness:0.9});
  }

  function buildRoom(room){
    const styles=state.rooms[room.id];
    const floorMat=makeRoomMaterial(room.id,'floor',styles.floor);
    const wallMat=makeRoomMaterial(room.id,'wall',styles.wall);

    const floor=new THREE.Mesh(new THREE.BoxGeometry(ROOM_W-0.04,0.055,ROOM_D-0.04),floorMat);
    floor.position.set(room.cx,room.floorY-0.027,0);
    floor.receiveShadow=true;
    houseGroup.add(floor);

    const back=new THREE.Mesh(new THREE.BoxGeometry(ROOM_W,ROOM_H,0.10),wallMat);
    back.position.set(room.cx,room.floorY+ROOM_H/2,BACK_Z-0.05);
    back.receiveShadow=true;
    houseGroup.add(back);

    const skirt=addBox(decorGroup,room.cx,room.floorY+0.075,BACK_Z+0.015,ROOM_W-0.08,0.15,0.035,'#f6f0e8',{castShadow:false,receiveShadow:true});
    skirt.userData.decor=true;

    if(room.decor==='window'){
      const frame=addBox(decorGroup,room.cx,room.floorY+1.48,BACK_Z+0.035,1.48,1.05,0.035,'#d99a91',{castShadow:false});
      addBox(decorGroup,room.cx,room.floorY+1.48,BACK_Z+0.058,1.22,0.82,0.025,'#c8dde2',{castShadow:false});
      addBox(decorGroup,room.cx,room.floorY+1.48,BACK_Z+0.078,0.045,0.82,0.02,'#f5efe8',{castShadow:false});
      addBox(decorGroup,room.cx,room.floorY+1.48,BACK_Z+0.078,1.22,0.045,0.02,'#f5efe8',{castShadow:false});
      frame.userData.decor=true;
    }else if(room.decor==='gallery'){
      const colours=['#799b91','#d79582','#cfbb79'];
      [-0.72,0,0.72].forEach((dx,i)=>{
        addBox(decorGroup,room.cx+dx,room.floorY+1.48+(i===1?0.12:0),BACK_Z+0.04,0.58,0.78,0.04,'#806e63',{castShadow:false});
        addBox(decorGroup,room.cx+dx,room.floorY+1.48+(i===1?0.12:0),BACK_Z+0.065,0.50,0.70,0.025,'#f2ece3',{castShadow:false});
        addBox(decorGroup,room.cx+dx,room.floorY+1.48+(i===1?0.12:0),BACK_Z+0.085,0.18,0.26,0.02,colours[i],{castShadow:false});
      });
    }else if(room.decor==='living'){
      addBox(decorGroup,room.cx,room.floorY+1.65,BACK_Z+0.04,1.65,0.68,0.04,'#826f64',{castShadow:false});
      addBox(decorGroup,room.cx,room.floorY+1.65,BACK_Z+0.065,1.55,0.58,0.025,'#f0e9df',{castShadow:false});
      ['#e1a07f','#e8c46e','#7d9c8f','#829caf'].forEach((c,i)=>addBox(decorGroup,room.cx-0.55+i*0.36,room.floorY+1.65,BACK_Z+0.085,0.22,0.28+(i%2)*0.08,0.02,c,{castShadow:false}));
    }else{
      const coords=[[-1.5,1.7],[-0.9,1.42],[-0.2,1.82],[0.55,1.48],[1.2,1.75]];
      coords.forEach((p,i)=>addBox(decorGroup,room.cx+p[0],room.floorY+p[1],BACK_Z+0.07,0.18,0.18,0.025,i%2?'#e0b867':'#d18f86',{castShadow:false}));
    }
  }

  function buildArchitecture(){
    houseGroup.clear();
    decorGroup.clear();
    roomMaterials.clear();

    rooms.forEach(buildRoom);

    const shell='#c9beb2', cut='#b8aa9d', trim='#efe6dd';
    addArchitectureBox(HOUSE_MIN_X-WALL_T,HOUSE_MIN_X,-0.16,HOUSE_H+0.18,BACK_Z-WALL_T,FRONT_Z+0.02,shell);
    addArchitectureBox(HOUSE_MAX_X,HOUSE_MAX_X+WALL_T,-0.16,HOUSE_H+0.18,BACK_Z-WALL_T,FRONT_Z+0.02,shell);
    addArchitectureBox(HOUSE_MIN_X-WALL_T,HOUSE_MAX_X+WALL_T,-0.20,0,BACK_Z-WALL_T,FRONT_Z+0.02,cut);
    addArchitectureBox(HOUSE_MIN_X-WALL_T,HOUSE_MAX_X+WALL_T,HOUSE_H,HOUSE_H+0.22,BACK_Z-WALL_T,FRONT_Z+0.02,cut);

    // Mid-floor slab, split around the staircase opening.
    addArchitectureBox(HOUSE_MIN_X,STAIR.x0,ROOM_H,UPPER_Y,BACK_Z,FRONT_Z,cut);
    addArchitectureBox(STAIR.x1,HOUSE_MAX_X,ROOM_H,UPPER_Y,BACK_Z,FRONT_Z,cut);
    addArchitectureBox(STAIR.x0,STAIR.x1,ROOM_H,UPPER_Y,BACK_Z,STAIR.z0,cut);
    addArchitectureBox(STAIR.x0,STAIR.x1,ROOM_H,UPPER_Y,STAIR.z1,FRONT_Z,cut);

    // Shared partition wall on each floor, with a correctly sized 2.04m doorway near the front.
    [0,UPPER_Y].forEach(floorY=>{
      addArchitectureBox(-WALL_T/2,WALL_T/2,floorY,floorY+ROOM_H,BACK_Z,DOOR_Z0,shell);
      addArchitectureBox(-WALL_T/2,WALL_T/2,floorY,floorY+ROOM_H,DOOR_Z1,FRONT_Z,shell);
      addArchitectureBox(-WALL_T/2,WALL_T/2,floorY+DOOR_H,floorY+ROOM_H,DOOR_Z0,DOOR_Z1,shell);

      // Door lining / architrave visible at the cut edges.
      addArchitectureBox(-WALL_T*0.78,WALL_T*0.78,floorY,floorY+DOOR_H,DOOR_Z0-0.035,DOOR_Z0+0.035,trim,{castShadow:false});
      addArchitectureBox(-WALL_T*0.78,WALL_T*0.78,floorY,floorY+DOOR_H,DOOR_Z1-0.035,DOOR_Z1+0.035,trim,{castShadow:false});
      addArchitectureBox(-WALL_T*0.78,WALL_T*0.78,floorY+DOOR_H-0.035,floorY+DOOR_H+0.035,DOOR_Z0,DOOR_Z1,trim,{castShadow:false});
    });

    // Real-proportion staircase: ~180mm rise across 15 steps, with a simple handrail.
    const stairRise=UPPER_Y/STAIR.steps;
    const stairRun=(STAIR.x1-STAIR.x0)/STAIR.steps;
    for(let i=0;i<STAIR.steps;i++){
      const x0=STAIR.x0+i*stairRun;
      const h=(i+1)*stairRise;
      addArchitectureBox(x0,x0+stairRun+0.012,0,h,STAIR.z0,STAIR.z1,'#b99372');
    }
    const railZ=STAIR.z1+0.045;
    for(let i=0;i<=STAIR.steps;i+=2){
      const x=STAIR.x0+i*stairRun;
      const baseY=i*stairRise;
      addCylinder(houseGroup,x,baseY,railZ,0.025,0.42,'#7b685a',{castShadow:true});
    }
    const railLen=Math.hypot(STAIR.x1-STAIR.x0,UPPER_Y);
    const railAngle=Math.atan2(UPPER_Y,STAIR.x1-STAIR.x0);
    const rail=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,railLen,16),material('#7b685a',{roughness:0.9}));
    rail.position.set((STAIR.x0+STAIR.x1)/2,UPPER_Y/2+0.42,railZ);
    rail.rotation.z=railAngle-Math.PI/2;
    rail.castShadow=true;
    houseGroup.add(rail);
  }

  function floorYForItem(item){ return roomById(item.room).floorY; }

  function createItemGroup(item){
    const t=templateById(item.type);
    const group=new THREE.Group();
    group.userData.itemId=item.id;
    group.userData.itemType=item.type;
    group.userData.room=item.room;
    t.maker().forEach(p=>buildPrimitive(group,p,item.id));

    // Larger invisible hit target makes small objects much easier to select on touch screens.
    const bounds=new THREE.Box3().setFromObject(group);
    const size=bounds.getSize(new THREE.Vector3());
    const centre=bounds.getCenter(new THREE.Vector3());
    const minW=t.place==='surface'?0.44:0.25;
    const hitGeom=new THREE.BoxGeometry(Math.max(size.x,minW),Math.max(size.y,0.42),Math.max(size.z,minW));
    const hitMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
    const hit=new THREE.Mesh(hitGeom,hitMat);
    hit.position.copy(centre);
    hit.userData.itemId=item.id;
    hit.userData.hitProxy=true;
    group.add(hit);
    selectableMeshes.push(hit);

    if(t.supportHeight){
      const anchor=new THREE.Group();
      anchor.name=`support-${item.id}`;
      anchor.position.y=scaled(t.supportHeight);
      group.add(anchor);
      supportAnchors.set(item.id,anchor);

      const supportSize=t.supportSize||t.footprint;
      const supportMesh=new THREE.Mesh(
        new THREE.PlaneGeometry(scaled(supportSize[0]),scaled(supportSize[1])),
        new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false,side:THREE.DoubleSide})
      );
      supportMesh.rotation.x=-Math.PI/2;
      supportMesh.position.y=0.012;
      supportMesh.userData.supportFor=item.id;
      anchor.add(supportMesh);
      supportPlanes.push(supportMesh);
    }

    if(t.lightHeight){
      const light=new THREE.PointLight(0xffc878,0,3.4,2);
      light.position.set(0,scaled(t.lightHeight),0);
      light.userData.itemId=item.id;
      group.add(light);
      localLights.push(light);
    }

    itemGroups.set(item.id,group);
    return group;
  }

  function rebuildItems(){
    itemRoot.clear();
    itemGroups.clear();
    supportAnchors.clear();
    selectableMeshes.length=0;
    supportPlanes.length=0;
    localLights.length=0;
    emissiveMeshes.length=0;

    // Create parents first so support anchors exist before children are attached.
    state.items.forEach(item=>{
      const group=createItemGroup(item);
      itemRoot.add(group);
    });

    state.items.forEach(item=>placeItemGroup(item));
    updateSelectionHelper();
    updateLighting();
  }

  function placeItemGroup(item){
    const group=itemGroups.get(item.id);
    if(!group)return;
    const room=roomById(item.room);
    group.userData.room=item.room;
    if(item.supportId && supportAnchors.has(item.supportId)){
      const anchor=supportAnchors.get(item.supportId);
      if(group.parent!==anchor) anchor.attach(group);
      group.position.set(item.x,0.012,item.z);
      group.rotation.set(0,item.rot||0,0);
    }else{
      item.supportId=null;
      if(group.parent!==itemRoot)itemRoot.attach(group);
      group.position.set(item.x,room.floorY,item.z);
      group.rotation.set(0,item.rot||0,0);
    }
  }

  function itemWorldPosition(item){
    const group=itemGroups.get(item.id);
    return group?group.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(item.x,floorYForItem(item),item.z);
  }

  function worldYaw(group){
    group.getWorldQuaternion(tempQuat);
    tempEuler.setFromQuaternion(tempQuat,'YXZ');
    return tempEuler.y;
  }

  function detachFromSupportToFloor(item, worldPoint=null){
    const group=itemGroups.get(item.id);
    if(!group)return;
    const wp=worldPoint||group.getWorldPosition(new THREE.Vector3());
    const yaw=worldYaw(group);
    itemRoot.attach(group);
    item.supportId=null;
    item.x=wp.x; item.z=wp.z; item.rot=yaw;
    group.position.set(wp.x,floorYForItem(item),wp.z);
    group.rotation.set(0,yaw,0);
  }

  function attachToSupport(item,supportId,worldPoint){
    const group=itemGroups.get(item.id),anchor=supportAnchors.get(supportId);
    if(!group||!anchor)return false;
    const yaw=worldYaw(group);
    anchor.attach(group);
    const local=anchor.worldToLocal(worldPoint.clone());
    item.supportId=supportId;
    item.x=local.x; item.z=local.z;
    // keep the object's apparent world orientation when first placed, then it follows the table thereafter
    const supportGroup=itemGroups.get(supportId);
    item.rot=yaw-worldYaw(supportGroup);
    group.position.set(local.x,0.012,local.z);
    group.rotation.set(0,item.rot,0);
    return true;
  }

  function clampFloorItem(item){
    if(item.supportId)return;
    const room=roomById(item.room),t=templateById(item.type);
    const fw=scaled(t.footprint[0]),fd=scaled(t.footprint[1]);
    const a=item.rot||0;
    const halfX=(Math.abs(Math.cos(a))*fw+Math.abs(Math.sin(a))*fd)/2;
    const halfZ=(Math.abs(Math.sin(a))*fw+Math.abs(Math.cos(a))*fd)/2;
    item.x=clamp(item.x,room.minX+halfX+0.08,room.maxX-halfX-0.08);
    item.z=clamp(item.z,BACK_Z+halfZ+0.10,FRONT_Z-halfZ-0.12);
  }

  function clampSupportedItem(item){
    if(!item.supportId)return;
    const support=itemById(item.supportId), st=support&&templateById(support.type),t=templateById(item.type);
    if(!support||!st||!st.supportHeight){ detachFromSupportToFloor(item); return; }
    const ss=st.supportSize||st.footprint;
    const halfX=Math.max(0.05,(scaled(ss[0])-scaled(t.footprint[0]))/2);
    const halfZ=Math.max(0.05,(scaled(ss[1])-scaled(t.footprint[1]))/2);
    item.x=clamp(item.x,-halfX,halfX);
    item.z=clamp(item.z,-halfZ,halfZ);
  }

  function validateSupports(){
    state.items.forEach(item=>{
      if(!item.supportId)return;
      const support=itemById(item.supportId);
      const t=support&&templateById(support.type);
      if(!support||support.room!==item.room||!t||!t.supportHeight)item.supportId=null;
    });
  }

  function updateCamera(){
    const target=new THREE.Vector3(state.camera.x,state.camera.y,-0.05);
    camera.position.copy(target).add(cameraOffset);
    camera.zoom=state.camera.zoom;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function updateActiveRoom(force=false){
    const x=state.camera.x;
    const upstairs=state.camera.y>UPPER_Y-0.25;
    const roomId=upstairs?(x<0?'bedroom':'studio'):(x<0?'hall':'living');
    if(!force&&roomId===activeRoomId)return;
    activeRoomId=roomId;
    roomLabel.textContent=roomById(activeRoomId).name;
    buildSwatches(wallSwatches,wallPalette,'wall');
    buildSwatches(floorSwatches,floorPalette,'floor');
  }

  function render(){
    updateCamera();
    if(selectionHelper)selectionHelper.update();
    renderer.render(scene,camera);
  }

  function updateLighting(){
    const evening=state.lighting==='evening';
    hemi.intensity=evening?0.40:1.55;
    hemi.color.set(evening?0xcbd3e5:0xfff7eb);
    hemi.groundColor.set(evening?0x575968:0x7f858d);
    sun.intensity=evening?0.28:2.35;
    sun.color.set(evening?0xaab7d4:0xfff0d7);
    eveningFill.intensity=evening?0.22:0.0;
    localLights.forEach(light=>{light.intensity=evening?24:0;});
    emissiveMeshes.forEach(mesh=>{if(mesh.material&&'emissiveIntensity' in mesh.material)mesh.material.emissiveIntensity=evening?0.85:0.07;});
    renderer.setClearColor(evening?0x777985:0xd9d0c7,1);
    scene.background.set(evening?0x777985:0xd9d0c7);
    updateLightingButton();
    render();
  }

  function pointerCoords(ev){
    const r=canvas.getBoundingClientRect();
    return {x:ev.clientX-r.left,y:ev.clientY-r.top,w:r.width,h:r.height};
  }

  function setRayFromPoint(p){
    pointerNdc.set((p.x/p.w)*2-1,-(p.y/p.h)*2+1);
    raycaster.setFromCamera(pointerNdc,camera);
  }

  function intersectHorizontal(p,y){
    setRayFromPoint(p);
    plane.constant=-y;
    return raycaster.ray.intersectPlane(plane,new THREE.Vector3());
  }

  function pickItem(p){
    setRayFromPoint(p);
    const hits=raycaster.intersectObjects(selectableMeshes,false);
    for(const hit of hits){
      const id=hit.object.userData.itemId;
      if(id&&itemById(id))return {id,point:hit.point};
    }
    return null;
  }

  function pickSupport(p,item){
    if(templateById(item.type).place!=='surface')return null;
    setRayFromPoint(p);
    const hits=raycaster.intersectObjects(supportPlanes,false);
    for(const hit of hits){
      const supportId=hit.object.userData.supportFor;
      if(!supportId||supportId===item.id)continue;
      const support=itemById(supportId);
      if(support&&support.room===item.room)return {supportId,point:hit.point.clone()};
    }
    return null;
  }

  function updateSelectionHelper(){
    if(selectionHelper){ scene.remove(selectionHelper); selectionHelper.geometry?.dispose?.(); selectionHelper.material?.dispose?.(); selectionHelper=null; }
    const group=selectedId&&itemGroups.get(selectedId);
    if(!group)return;
    selectionHelper=new THREE.BoxHelper(group,0xffffff);
    selectionHelper.material.transparent=true;
    selectionHelper.material.opacity=0.72;
    selectionHelper.material.depthTest=false;
    selectionHelper.renderOrder=50;
    scene.add(selectionHelper);
  }

  function selectItem(id){
    selectedId=id;
    updateSelection();
    updateSelectionHelper();
    render();
  }

  const pointers=new Map();

  function pointerDistance(){
    const pts=[...pointers.values()];
    if(pts.length<2)return 0;
    return Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
  }

  function pointerMidpoint(){
    const pts=[...pointers.values()];
    if(pts.length<2)return null;
    return {x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2,w:pts[0].w,h:pts[0].h};
  }

  canvas.addEventListener('pointerdown',ev=>{
    const p=pointerCoords(ev);
    pointers.set(ev.pointerId,p);
    try{canvas.setPointerCapture(ev.pointerId);}catch{}

    if(pointers.size===2){
      const mid=pointerMidpoint();
      gesture={mode:'pinch',startDist:pointerDistance(),startZoom:state.camera.zoom,startMid:mid,startCamX:state.camera.x,startCamY:state.camera.y};
      hint.textContent='Pinch to zoom · drag with two fingers to pan';
      return;
    }
    if(pointers.size>2)return;

    const picked=pickItem(p);
    if(picked){
      selectItem(picked.id);
      const item=itemById(picked.id);
      const wp=itemWorldPosition(item);
      const y=wp.y;
      const hit=intersectHorizontal(p,y)||picked.point;
      gesture={mode:'item',pointerId:ev.pointerId,id:item.id,dx:wp.x-hit.x,dz:wp.z-hit.z,moved:false,startX:p.x,startY:p.y};
      hint.textContent=templateById(item.type).place==='surface'?'Drag onto a table or drawers':'Drag it into place';
    }else{
      selectItem(null);
      gesture={mode:'pan',pointerId:ev.pointerId,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,startCamX:state.camera.x,startCamY:state.camera.y,moved:false};
      hint.textContent='Drag to explore · pinch to zoom';
    }
  });

  canvas.addEventListener('pointermove',ev=>{
    if(!pointers.has(ev.pointerId))return;
    const p=pointerCoords(ev);
    pointers.set(ev.pointerId,p);

    if(pointers.size>=2){
      if(!gesture||gesture.mode!=='pinch'){
        const mid=pointerMidpoint();
        gesture={mode:'pinch',startDist:pointerDistance(),startZoom:state.camera.zoom,startMid:mid,startCamX:state.camera.x,startCamY:state.camera.y};
      }
      const d=pointerDistance();
      if(gesture.startDist>4)state.camera.zoom=clamp(gesture.startZoom*(d/gesture.startDist),0.82,2.35);
      const mid=pointerMidpoint();
      if(mid&&gesture.startMid){
        const unitsPerPixel=5.4/(mid.h*Math.max(0.75,state.camera.zoom));
        state.camera.x=clamp(gesture.startCamX-(mid.x-gesture.startMid.x)*unitsPerPixel,HOUSE_MIN_X+0.75,HOUSE_MAX_X-0.75);
        state.camera.y=clamp(gesture.startCamY+(mid.y-gesture.startMid.y)*unitsPerPixel,0.85,HOUSE_H-0.35);
      }
      updateActiveRoom();
      render();
      return;
    }

    if(!gesture||gesture.pointerId!==ev.pointerId)return;

    if(gesture.mode==='pan'){
      const dx=p.x-gesture.startX,dy=p.y-gesture.startY;
      const unitsPerPixel=5.8/(p.h*Math.max(0.78,state.camera.zoom));
      state.camera.x=clamp(gesture.startCamX-dx*unitsPerPixel,HOUSE_MIN_X+0.75,HOUSE_MAX_X-0.75);
      state.camera.y=clamp(gesture.startCamY+dy*unitsPerPixel,0.85,HOUSE_H-0.35);
      gesture.moved=gesture.moved||Math.hypot(dx,dy)>4;
      updateActiveRoom();
      render();
      return;
    }

    if(gesture.mode==='item'){
      const item=itemById(gesture.id),group=item&&itemGroups.get(item.id);
      if(!item||!group)return;
      const t=templateById(item.type);
      const supportHit=pickSupport(p,item);

      if(t.place==='surface'&&supportHit){
        if(item.supportId!==supportHit.supportId)attachToSupport(item,supportHit.supportId,supportHit.point);
        else{
          const anchor=supportAnchors.get(item.supportId);
          const local=anchor.worldToLocal(supportHit.point.clone());
          item.x=local.x; item.z=local.z;
          clampSupportedItem(item);
          group.position.set(item.x,0.012,item.z);
        }
      }else{
        const floorY=floorYForItem(item);
        const hit=intersectHorizontal(p,floorY);
        if(hit){
          if(item.supportId)detachFromSupportToFloor(item,hit);
          item.x=hit.x+gesture.dx; item.z=hit.z+gesture.dz;
          clampFloorItem(item);
          group.position.set(item.x,floorY,item.z);
        }
      }
      gesture.moved=gesture.moved||Math.hypot(p.x-gesture.startX,p.y-gesture.startY)>4;
      if(selectionHelper)selectionHelper.update();
      updateSelection();
      render();
    }
  });

  function finishPointer(ev){
    pointers.delete(ev.pointerId);
    if(gesture&&gesture.mode==='pinch'&&pointers.size===1){ gesture=null; }
    else if(pointers.size===0){
      if(gesture&&(gesture.mode==='item'||gesture.mode==='pan'))save();
      gesture=null;
      hint.textContent='Drag empty space to explore · pinch to zoom';
    }
  }
  canvas.addEventListener('pointerup',finishPointer);
  canvas.addEventListener('pointercancel',finishPointer);

  rotateBtn.addEventListener('click',()=>{
    const item=itemById(selectedId); if(!item)return;
    item.rot=(item.rot||0)+Math.PI/2;
    const group=itemGroups.get(item.id); if(group)group.rotation.y=item.rot;
    if(item.supportId)clampSupportedItem(item); else clampFloorItem(item);
    placeItemGroup(item); save(); updateSelectionHelper(); render();
  });

  function dropDependentsToFloor(supportId){
    state.items.filter(i=>i.supportId===supportId).forEach(child=>{
      const group=itemGroups.get(child.id);
      const wp=group.getWorldPosition(new THREE.Vector3());
      const yaw=worldYaw(group);
      itemRoot.attach(group);
      child.supportId=null; child.x=wp.x; child.z=wp.z; child.rot=yaw;
      clampFloorItem(child);
      group.position.set(child.x,floorYForItem(child),child.z);
      group.rotation.set(0,child.rot,0);
    });
  }

  removeBtn.addEventListener('click',()=>{
    const item=itemById(selectedId); if(!item)return;
    dropDependentsToFloor(item.id);
    state.items=state.items.filter(i=>i.id!==item.id);
    selectedId=null;
    rebuildItems(); updateSelection(); save(); render();
  });

  clearBtn.addEventListener('click',()=>{
    const removed=new Set(state.items.filter(i=>i.room===activeRoomId).map(i=>i.id));
    state.items=state.items.filter(i=>i.room!==activeRoomId);
    state.items.forEach(i=>{if(removed.has(i.supportId))i.supportId=null;});
    selectedId=null; rebuildItems(); updateSelection(); save(); render();
    hint.textContent=`${roomById(activeRoomId).name} cleared`;
  });

  lightingBtn.addEventListener('click',()=>{
    state.lighting=state.lighting==='day'?'evening':'day';
    updateLighting(); save();
  });

  prevBtn.addEventListener('click',()=>carousel.scrollBy({left:-carousel.clientWidth*0.72,behavior:'smooth'}));
  nextBtn.addEventListener('click',()=>carousel.scrollBy({left:carousel.clientWidth*0.72,behavior:'smooth'}));

  function addItem(type){
    const t=templateById(type),room=roomById(activeRoomId); if(!t)return;
    const count=state.items.filter(i=>i.room===room.id).length;
    const item={id:`item-${Date.now()}-${idCounter++}`,type,room:room.id,x:room.cx+((count%3)-1)*0.24,z:0.25+((count%2)?0.20:-0.12),rot:0};
    if(t.place==='surface'){
      const support=state.items.find(s=>s.room===room.id&&templateById(s.type)?.supportHeight);
      if(support){item.supportId=support.id;item.x=0;item.z=0;}
    }
    if(!item.supportId)clampFloorItem(item);
    state.items.push(item);
    const group=createItemGroup(item);itemRoot.add(group);placeItemGroup(item);updateLighting();
    selectItem(item.id);save();
    hint.textContent=t.place==='surface'?(item.supportId?'Added to a surface · drag to fine tune':'Drag onto a table or drawers'):`Drag the ${t.name.toLowerCase()} into place`;
  }

  function buildCarousel(){
    carousel.innerHTML='';
    templates.forEach(t=>{
      const b=document.createElement('button');b.type='button';b.className='room-item-card';
      b.innerHTML=`<span class="room-item-glyph" style="--room-item-colour:${t.colour}">${t.glyph}</span><strong>${t.name}</strong><small>${t.place==='surface'?'Place':'Add'}</small>`;
      b.addEventListener('click',()=>addItem(t.id));carousel.appendChild(b);
    });
  }

  function buildSwatches(holder,palette,key){
    if(!holder)return;
    const style=state.rooms[activeRoomId]; holder.innerHTML='';
    palette.forEach(col=>{
      const b=document.createElement('button');b.type='button';b.className='room-swatch';b.style.background=col;b.setAttribute('aria-label',`${key} colour ${col}`);
      if(style[key]===col)b.classList.add('active');
      b.addEventListener('click',()=>{
        style[key]=col;
        const mat=roomMaterials.get(`${activeRoomId}:${key}`);if(mat)mat.color.set(col);
        [...holder.children].forEach(x=>x.classList.toggle('active',x===b));save();render();
      });
      holder.appendChild(b);
    });
  }

  function updateSelection(){
    const item=itemById(selectedId),t=item&&templateById(item.type),support=item&&item.supportId&&itemById(item.supportId);
    selectedName.textContent=t?`${t.name}${support?` · on ${templateById(support.type).name}`:''}`:'Nothing selected';
    rotateBtn.disabled=!item;removeBtn.disabled=!item;
  }

  function updateLightingButton(){
    lightingBtn.textContent=state.lighting==='day'?'☀ Day':'◐ Evening';
    lightingBtn.setAttribute('aria-label',state.lighting==='day'?'Switch to evening lighting':'Switch to daytime lighting');
  }

  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}

  function load(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;
      const parsed=JSON.parse(raw);if(!parsed||!Array.isArray(parsed.items))return;
      const roomState=Object.fromEntries(rooms.map(r=>[r.id,{wall:r.wall,floor:r.floor}]));
      rooms.forEach(r=>{if(parsed.rooms&&parsed.rooms[r.id]){roomState[r.id].wall=parsed.rooms[r.id].wall||r.wall;roomState[r.id].floor=parsed.rooms[r.id].floor||r.floor;}});
      state={
        lighting:parsed.lighting==='evening'?'evening':'day', rooms:roomState,
        items:parsed.items.filter(i=>templateById(i.type)&&rooms.some(r=>r.id===i.room)).slice(0,90),
        camera:{
          x:clamp(Number(parsed.camera?.x)||2.2,HOUSE_MIN_X+0.75,HOUSE_MAX_X-0.75),
          y:clamp(Number(parsed.camera?.y)||1.2,0.85,HOUSE_H-0.35),
          zoom:clamp(Number(parsed.camera?.zoom)||1.35,0.82,2.35)
        }
      };
      validateSupports();
      state.items.forEach(i=>{if(!i.supportId)clampFloorItem(i);});
    }catch{}
  }

  function resizeRenderer(){
    const r=canvas.getBoundingClientRect();if(!r.width)return;
    const cssW=r.width,cssH=Math.max(410,Math.min(590,cssW*1.05));
    canvas.style.height=`${cssH}px`;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    renderer.setSize(cssW,cssH,false);
    camera.aspect=cssW/cssH;
    camera.updateProjectionMatrix();
    render();
  }
  function queueResize(){cancelAnimationFrame(resizeRaf);resizeRaf=requestAnimationFrame(resizeRenderer);}

  load();
  buildArchitecture();
  rebuildItems();
  buildCarousel();
  updateActiveRoom(true);
  updateSelection();
  updateLighting();
  hint.textContent='Drag empty space to explore · pinch to zoom';
  window.addEventListener('resize',queueResize,{passive:true});
  if('ResizeObserver' in window)new ResizeObserver(queueResize).observe(canvas.parentElement);
  queueResize();
})();
