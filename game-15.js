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
  const lightControl = document.getElementById('room-light-control');
  const lightLevel = document.getElementById('room-light-level');
  const lightValue = document.getElementById('room-light-value');
  const lightShadowBtn = document.getElementById('room-light-shadow');
  const spotAngleControl = document.getElementById('room-spot-angle-control');
  const spotAngleLevel = document.getElementById('room-spot-angle');
  const spotAngleValue = document.getElementById('room-spot-angle-value');
  const wallpaperSwatches = document.getElementById('room-wallpaper-swatches');
  const floorTextureSwatches = document.getElementById('room-floor-texture-swatches');
  const perfBadge = document.getElementById('room-perf-badge');
  const inventoryTitle = document.getElementById('room-inventory-title');
  const inventorySubtitle = document.getElementById('room-inventory-subtitle');
  const categoryRow = document.getElementById('room-category-row');
  const lightingPanelBtn = document.getElementById('room-lighting-panel-button');
  const globalLightPanel = document.getElementById('room-global-light-panel');
  const globalLightClose = document.getElementById('room-global-light-close');
  const globalLightMode = document.getElementById('room-global-light-mode');
  const directLevel = document.getElementById('room-direct-level');
  const directValue = document.getElementById('room-direct-value');
  const ambientLevel = document.getElementById('room-ambient-level');
  const ambientValue = document.getElementById('room-ambient-value');
  const indirectLevel = document.getElementById('room-indirect-level');
  const indirectValue = document.getElementById('room-indirect-value');
  const globalLightReset = document.getElementById('room-global-light-reset');

  if (!canvas) return;

  if (!window.THREE) {
    hint.textContent = '3D renderer could not load. Reconnect once, then My House will work offline.';
    [rotateBtn, removeBtn, clearBtn, lightingBtn, lightingPanelBtn, prevBtn, nextBtn].forEach(b => { if (b) b.disabled = true; });
    return;
  }

  const THREE = window.THREE;
  const STORAGE_KEY = 'gamehub-my-house-webgl-v9';
  const MODEL_SCALE = 0.62;
  const TAU = Math.PI * 2;

  // Reference-derived house proportions (measured from the pastel dollhouse
  // concept): main room width ≈ 1.78 × clear room height, and the central
  // circulation core ≈ half a main-room width.  We keep metre-like units so
  // furniture can stay grounded in believable real-world scale.
  const ROOM_H = 2.50;
  const SIDE_ROOM_W = 4.45;
  const CORE_W = 2.22;
  const ROOM_D = 4.20;
  const SLAB_H = 0.20;
  const WALL_T = 0.12;
  const UPPER_Y = ROOM_H + SLAB_H;
  const HOUSE_W = SIDE_ROOM_W * 2 + CORE_W;
  const HOUSE_H = UPPER_Y + ROOM_H;
  const HOUSE_MIN_X = -HOUSE_W / 2;
  const HOUSE_MAX_X = HOUSE_W / 2;
  const CORE_MIN_X = -CORE_W / 2;
  const CORE_MAX_X = CORE_W / 2;
  const BACK_Z = -ROOM_D / 2;
  const FRONT_Z = ROOM_D / 2;
  const DOOR_OPEN_W = 0.826;
  const DOOR_OPEN_H = 2.04;
  const LAMP_DEFAULT_LEVEL = 0.28;
  const LAMP_MAX_INTENSITY = 6.2;
  const LIGHT_LEVEL_MAX = 1.50;
  const INDIRECT_LEVEL_MAX = 1.50;
  const SPOT_CONE_MIN_DEG = 50;
  const SPOT_CONE_MAX_DEG = 170;
  const SPOT_CONE_DEFAULT_DEG = 130;
  const CEILING_MOUNT_Y = ROOM_H - 0.04;
  const LIGHTING_PRESETS = {
    day:{direct:1.00,ambient:1.00,indirect:0.18},
    evening:{direct:0.00,ambient:0.28,indirect:0.38}
  };
  const ROOM_DAYLIGHT_FACTORS = { bedroom:0.84, kids:0.88, living:0.96, kitchen:1.00, hall:0.52, landing:0.58 };
  const ROOM_WINDOW_SIDES = { bedroom:'left', living:'left', kids:'right', kitchen:'right', hall:'centre', landing:'centre' };

  // Compact dog-leg / return stair kept in the rear half of the central core,
  // leaving a real hall and upper landing at the open front of the dollhouse.
  const STAIR = {
    stepsPerFlight: 7,
    going: 0.25,
    frontZ: 0.42,
    landingDepth: 0.48,
    sideInset: 0.12,
    centreGap: 0.08
  };
  STAIR.totalSteps = STAIR.stepsPerFlight * 2;
  STAIR.rise = UPPER_Y / STAIR.totalSteps;
  STAIR.midY = STAIR.rise * STAIR.stepsPerFlight;
  STAIR.flightBackZ = STAIR.frontZ - STAIR.going * STAIR.stepsPerFlight;
  STAIR.landingBackZ = STAIR.flightBackZ - STAIR.landingDepth;
  STAIR.leftX0 = CORE_MIN_X + STAIR.sideInset;
  STAIR.leftX1 = -STAIR.centreGap;
  STAIR.rightX0 = STAIR.centreGap;
  STAIR.rightX1 = CORE_MAX_X - STAIR.sideInset;
  const CORE_DRESS_MIN_Z = 0.68;

  const ROOM_LAYERS = { bedroom:1, landing:2, kids:3, living:4, hall:5, kitchen:6 };
  const INVENTORY_CATEGORIES = {
    furniture:'Big pieces',
    storage:'Storage',
    soft:'Soft',
    play:'Kids room',
    decor:'Ornaments',
    lighting:'Lighting',
    wall:'Wall art',
    kitchen:'Kitchen'
  };
  const ROOM_CATEGORY_ORDER = {
    bedroom:['furniture','storage','soft','decor','lighting','wall'],
    landing:['furniture','soft','decor','lighting'],
    kids:['furniture','storage','soft','play','decor','lighting','wall'],
    living:['furniture','soft','storage','decor','lighting','wall'],
    hall:['furniture','soft','decor','lighting'],
    kitchen:['kitchen','furniture','decor','lighting','wall']
  };

  const wallPalette = ['#f1dfd6', '#eadcc9', '#d8e6dc', '#dbe3ef', '#ead9e5', '#efe5bf'];
  const floorPalette = ['#c8a883', '#b9906c', '#d2c3ae', '#9ca99c', '#b4a297', '#c9b596'];
  const wallpaperPatterns = [
    {id:'plain',name:'Plain'},
    {id:'stripe',name:'Soft stripe'},
    {id:'dot',name:'Confetti dots'},
    {id:'stars',name:'Little stars'},
    {id:'clouds',name:'Clouds'},
    {id:'arch',name:'Little arches'},
    {id:'sprig',name:'Leaf sprigs'}
  ];
  const floorTexturePatterns = [
    {id:'plain',name:'Plain'},
    {id:'plank',name:'Floor boards'},
    {id:'carpet',name:'Carpet'},
    {id:'tile',name:'Tiles'},
    {id:'herringbone',name:'Parquet'},
    {id:'checker',name:'Checker'}
  ];

  const rooms = [
    { id:'bedroom', name:'Bedroom', minX:HOUSE_MIN_X, maxX:CORE_MIN_X, floorY:UPPER_Y, wall:wallPalette[0], floor:floorPalette[0], wallpaper:'plain', floorTexture:'plank', decor:'bedroom' },
    { id:'landing', name:'Landing', minX:CORE_MIN_X, maxX:CORE_MAX_X, floorY:UPPER_Y, wall:'#e9e0d5', floor:floorPalette[0], wallpaper:'plain', floorTexture:'plank', core:true, allowWall:false, placeMinZ:CORE_DRESS_MIN_Z, placeMaxZ:FRONT_Z-0.10 },
    { id:'kids', name:'Kids room', minX:CORE_MAX_X, maxX:HOUSE_MAX_X, floorY:UPPER_Y, wall:'#cfd8df', floor:floorPalette[2], wallpaper:'stars', floorTexture:'plank', decor:'kids' },
    { id:'living', name:'Living room', minX:HOUSE_MIN_X, maxX:CORE_MIN_X, floorY:0, wall:'#f0e3d6', floor:floorPalette[0], wallpaper:'plain', floorTexture:'plank', decor:'living' },
    { id:'hall', name:'Hall', minX:CORE_MIN_X, maxX:CORE_MAX_X, floorY:0, wall:'#eee5da', floor:floorPalette[0], wallpaper:'plain', floorTexture:'plank', core:true, allowWall:false, placeMinZ:CORE_DRESS_MIN_Z, placeMaxZ:FRONT_Z-0.10 },
    { id:'kitchen', name:'Kitchen', minX:CORE_MAX_X, maxX:HOUSE_MAX_X, floorY:0, wall:'#eef0eb', floor:floorPalette[0], wallpaper:'plain', floorTexture:'plank', decor:'kitchen' }
  ];

  rooms.forEach(room => {
    room.cx = (room.minX + room.maxX) / 2;
    room.width = room.maxX - room.minX;
    room.wallPlaneZ = BACK_Z + 0.075;
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
      cyl(0,1.29,0,0.58,0.58,'#e8bd76',{taper:0.66,emissive:true,castShadow:false}), ellipsoid(0,1.27,0,0.60,0.11,0.60,'#d7a85f',{emissive:true,castShadow:false}), ellipsoid(0,1.86,0,0.40,0.08,0.40,'#f2d08d',{emissive:true,castShadow:false})
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

  function makeBedsideTable(){
    return [
      cyl(-0.33,0,-0.25,0.048,0.26,'#806554',{taper:0.70}),cyl(0.33,0,-0.25,0.048,0.26,'#806554',{taper:0.70}),
      cyl(-0.33,0,0.25,0.048,0.26,'#806554',{taper:0.70}),cyl(0.33,0,0.25,0.048,0.26,'#806554',{taper:0.70}),
      box(0,0.65,0,0.88,0.82,0.70,'#c59d79'),ellipsoid(0,1.10,0,0.49,0.10,0.40,'#d6b18d'),
      box(0,0.82,0.36,0.70,0.28,0.035,'#d2a986'),box(0,0.48,0.36,0.70,0.28,0.035,'#d2a986'),
      ellipsoid(0,0.82,0.40,0.065,0.065,0.05,'#7d9a8c'),ellipsoid(0,0.48,0.40,0.065,0.065,0.05,'#d4958d')
    ];
  }

  function makeBedsideLamp(){
    return [
      ellipsoid(0,0.06,0,0.28,0.07,0.28,'#8f7461'),cyl(0,0.12,0,0.045,0.48,'#806959'),
      cyl(0,0.53,0,0.34,0.34,'#efc983',{taper:0.67,emissive:true,castShadow:false}),
      ellipsoid(0,0.87,0,0.23,0.055,0.23,'#f5d99c',{emissive:true,castShadow:false})
    ];
  }

  function makeAlarmClock(){
    return [
      ellipsoid(0,0.23,0,0.36,0.31,0.20,'#7896a2'),ellipsoid(0,0.23,0.205,0.29,0.25,0.03,'#f5efe6'),
      cyl(-0.18,0.52,0,0.10,0.08,'#7896a2',{rot:0.2}),cyl(0.18,0.52,0,0.10,0.08,'#7896a2',{rot:-0.2}),
      box(0,0.23,0.242,0.045,0.16,0.018,'#4b5555',{rotZ:-0.12}),box(0,0.23,0.246,0.13,0.032,0.018,'#4b5555',{rotZ:0.38}),
      cyl(-0.19,0,0,0.035,0.10,'#6d7f82',{taper:0.75}),cyl(0.19,0,0,0.035,0.10,'#6d7f82',{taper:0.75})
    ];
  }

  function makeCeilingPendant(){
    return [
      cyl(0,-0.08,0,0.022,0.16,'#8b7361'),
      ellipsoid(0,0,0,0.18,0.05,0.18,'#b89d83'),
      cyl(0,-0.42,0,0.42,0.42,'#efd6a4',{taper:0.58,emissive:true,castShadow:false}),
      ellipsoid(0,-0.63,0,0.29,0.05,0.29,'#f7e5b5',{emissive:true,castShadow:false})
    ];
  }

  function makeCloudCeilingLight(){
    return [
      cyl(0,-0.09,0,0.02,0.18,'#9b8678'),
      ellipsoid(0,0,0,0.16,0.05,0.16,'#bba696'),
      ellipsoid(-0.30,-0.30,0.03,0.28,0.16,0.19,'#f3efe7',{emissive:true,castShadow:false}),
      ellipsoid(0.02,-0.34,0,0.36,0.18,0.23,'#fff7ea',{emissive:true,castShadow:false}),
      ellipsoid(0.34,-0.29,-0.02,0.28,0.16,0.19,'#f3efe7',{emissive:true,castShadow:false}),
      ellipsoid(0.03,-0.22,0.03,0.24,0.14,0.18,'#f6f0dd',{emissive:true,castShadow:false})
    ];
  }

  function makeKidsBed(){
    return [
      cyl(-0.92,0,-1.08,0.06,0.56,'#cfb28c'),cyl(0.92,0,-1.08,0.06,0.56,'#cfb28c'),
      cyl(-0.92,0,1.08,0.06,0.46,'#cfb28c'),cyl(0.92,0,1.08,0.06,0.46,'#cfb28c'),
      box(0,0.16,0,2.02,0.20,2.38,'#d0b58d'),
      box(0,0.42,0,1.88,0.28,2.14,'#f7efe4'),
      box(0,0.58,0.10,1.82,0.18,1.74,'#9bb8b9'),
      ellipsoid(0,0.75,-0.70,1.04,0.16,0.42,'#a3c3c2'),
      ellipsoid(0,0.88,-0.98,0.72,0.17,0.27,'#fffaf2'),
      box(0,0.82,-1.16,2.06,1.06,0.08,'#cfae86'),
      box(0,0.62,1.16,2.00,0.46,0.08,'#cfae86')
    ];
  }

  function makeKidsDesk(){
    return [
      cyl(-0.58,0,-0.34,0.05,0.74,'#b99370'),cyl(0.58,0,-0.34,0.05,0.74,'#b99370'),
      cyl(-0.58,0,0.34,0.05,0.74,'#b99370'),cyl(0.58,0,0.34,0.05,0.74,'#b99370'),
      box(0,0.78,0,1.46,0.10,0.82,'#d5bb97'),
      box(0,1.06,-0.28,1.32,0.08,0.18,'#d5bb97'),
      box(-0.42,0.45,0.30,0.24,0.48,0.12,'#e0c7a9'), box(0.42,0.45,0.30,0.24,0.48,0.12,'#e0c7a9'),
      box(-0.42,0.30,0.37,0.18,0.16,0.03,'#8ab3af'), box(0.42,0.30,0.37,0.18,0.16,0.03,'#f0c486')
    ];
  }

  function makeBookcase(){
    return [
      box(0,1.36,0,1.22,2.72,0.48,'#a78a72'),
      box(0,2.35,0.02,1.00,0.06,0.34,'#c5a488'), box(0,1.70,0.02,1.00,0.06,0.34,'#c5a488'), box(0,1.05,0.02,1.00,0.06,0.34,'#c5a488'), box(0,0.42,0.02,1.00,0.06,0.34,'#c5a488'),
      box(-0.26,2.11,0.08,0.18,0.36,0.18,'#8fb2b0'), box(-0.05,2.11,0.08,0.18,0.36,0.18,'#d99592'), box(0.17,2.11,0.08,0.18,0.36,0.18,'#e2b969'),
      box(-0.18,1.46,0.08,0.18,0.30,0.18,'#d0b3dd'), box(0.03,1.46,0.08,0.18,0.30,0.18,'#9bbfd0'), box(0.24,1.46,0.08,0.18,0.30,0.18,'#e0c790'),
      ellipsoid(-0.22,0.78,0.02,0.18,0.14,0.13,'#8eb1b2'), ellipsoid(0.00,0.80,0.02,0.22,0.18,0.16,'#9ec0bf'), ellipsoid(0.22,0.78,0.02,0.18,0.14,0.13,'#8eb1b2'),
      ellipsoid(-0.02,0.63,0.22,0.10,0.09,0.05,'#334744')
    ];
  }

  function makeSkyRug(){
    const parts=[ellipsoid(0,0.04,0,1.62,0.04,1.62,'#a8c4cf')];
    const stars=[[0.0,0.0],[0.55,-0.28],[-0.62,0.34],[0.18,0.74],[-0.22,-0.72]];
    stars.forEach(([x,z])=>parts.push(ellipsoid(x,0.052,z,0.12,0.02,0.12,'#f4ead2')));
    return parts;
  }

  function makeBunting(){
    const parts=[box(0,0.26,0,1.58,0.03,0.03,'#aa8c74')];
    const cols=['#d99b8f','#e5c16f','#7fa59a','#8bb0c6'];
    [-0.55,-0.20,0.15,0.50].forEach((x,i)=>{parts.push(box(x,0,0.03,0.18,0.26,0.02,cols[i],{rotZ:0.785}));});
    return parts;
  }

  // Kitchen pieces use the room's metre-like scale rather than the older
  // undersized prototype proportions. With MODEL_SCALE=0.62 these recipes
  // land at roughly 0.90 m worktop height, 1.8 m fridge height and 0.60 m
  // wall-cabinet height, matching the reference image much more closely.
  function makeKitchenCabinet(){
    return [
      box(0,0.68,0,1.46,1.36,0.86,'#aab79b'),
      box(0,1.44,0,1.56,0.10,0.92,'#d8b996'),
      box(-0.34,0.70,0.45,0.58,1.08,0.055,'#bdc8ae'),box(0.34,0.70,0.45,0.58,1.08,0.055,'#bdc8ae'),
      box(-0.08,0.70,0.49,0.035,0.28,0.025,'#a97f55'),box(0.08,0.70,0.49,0.035,0.28,0.025,'#a97f55')
    ];
  }

  function makeSinkCabinet(){
    return [
      box(0,0.68,0,1.70,1.36,0.88,'#aab79b'),
      box(0,1.44,0,1.80,0.10,0.94,'#d8b996'),
      box(-0.39,0.70,0.46,0.64,1.08,0.055,'#bdc8ae'),box(0.39,0.70,0.46,0.64,1.08,0.055,'#bdc8ae'),
      box(0,1.47,0.05,0.88,0.055,0.48,'#f4f1eb'),box(0,1.41,0.05,0.70,0.12,0.34,'#e8e4dc'),
      cyl(0,1.55,0.24,0.025,0.30,'#75675e',{rotX:Math.PI/2}),box(0.15,1.74,0.24,0.30,0.035,0.035,'#75675e')
    ];
  }

  function makeOvenCabinet(){
    return [
      box(0,0.68,0,1.46,1.36,0.86,'#aab79b'),box(0,1.44,0,1.56,0.10,0.92,'#d8b996'),
      box(0,0.67,0.46,1.02,0.96,0.06,'#50585a'),box(0,0.76,0.50,0.84,0.60,0.035,'#24292b'),
      box(0,1.18,0.50,0.84,0.10,0.035,'#777f80'),
      cyl(-0.30,1.19,0.54,0.045,0.04,'#d8d4ca',{rotX:Math.PI/2}),cyl(-0.10,1.19,0.54,0.045,0.04,'#d8d4ca',{rotX:Math.PI/2}),cyl(0.10,1.19,0.54,0.045,0.04,'#d8d4ca',{rotX:Math.PI/2}),cyl(0.30,1.19,0.54,0.045,0.04,'#d8d4ca',{rotX:Math.PI/2}),
      cyl(-0.32,1.51,-0.20,0.14,0.025,'#343b3c'),cyl(0.32,1.51,-0.20,0.14,0.025,'#343b3c'),cyl(-0.32,1.51,0.20,0.14,0.025,'#343b3c'),cyl(0.32,1.51,0.20,0.14,0.025,'#343b3c')
    ];
  }

  function makeWallCabinet(){
    return [
      box(0,0,0,1.48,0.98,0.46,'#9daa8f'),
      box(-0.35,0,0.25,0.62,0.80,0.045,'#b9c5aa'),box(0.35,0,0.25,0.62,0.80,0.045,'#b9c5aa'),
      box(-0.08,0,0.28,0.035,0.28,0.025,'#a97f55'),box(0.08,0,0.28,0.035,0.28,0.025,'#a97f55')
    ];
  }

  function makeKitchenShelf(){
    return [
      box(0,0,0,1.52,0.10,0.42,'#c49d78'),
      box(-0.56,-0.18,-0.04,0.08,0.36,0.12,'#9a7a61'),box(0.56,-0.18,-0.04,0.08,0.36,0.12,'#9a7a61'),
      cyl(-0.42,0.18,0.08,0.12,0.28,'#e8d9bd',{taper:0.82}),cyl(-0.08,0.16,0.08,0.10,0.24,'#d9b990',{taper:0.82}),
      cyl(0.28,0.17,0.08,0.11,0.26,'#b8c6ae',{taper:0.82})
    ];
  }

  function makeFridge(){
    return [
      box(0,1.45,0,1.22,2.90,1.02,'#bfcdd1'),
      box(0,1.45,0.53,1.10,2.76,0.045,'#d6e0e2'),
      box(0,2.04,0.56,1.10,0.045,0.03,'#a7b5ba'),
      box(-0.40,1.62,0.57,0.055,0.62,0.035,'#849399'),box(-0.40,0.72,0.57,0.055,0.54,0.035,'#849399'),
      box(0.20,1.76,0.58,0.16,0.13,0.02,'#e6b66d',{rotZ:0.08}),box(-0.12,1.18,0.58,0.18,0.14,0.02,'#d38f78',{rotZ:-0.05})
    ];
  }

  function makeDiningTable(){
    return [
      cyl(0,1.18,0,1.12,0.13,'#c99f77',{taper:0.96}),
      cyl(0,0.10,0,0.15,1.12,'#a98061',{taper:0.82}),
      cyl(0,0.05,0,0.66,0.10,'#a98061',{taper:0.82})
    ];
  }

  function makeDiningChair(){
    return [
      cyl(-0.42,0,-0.34,0.055,0.78,'#94775f'),cyl(0.42,0,-0.34,0.055,0.78,'#94775f'),cyl(-0.42,0,0.34,0.055,0.78,'#94775f'),cyl(0.42,0,0.34,0.055,0.78,'#94775f'),
      box(0,0.78,0,0.96,0.14,0.86,'#9eaf91'),
      box(0,1.36,-0.36,0.96,1.04,0.12,'#9eaf91'),
      ellipsoid(0,1.38,-0.28,0.36,0.34,0.08,'#b7c3aa')
    ];
  }

  function makeMicrowave(){
    return [
      box(0,0.34,0,1.02,0.68,0.62,'#ece9df'),box(-0.13,0.35,0.33,0.62,0.46,0.035,'#495355'),
      box(0.37,0.35,0.33,0.18,0.46,0.035,'#d5d1c7'),cyl(0.37,0.47,0.36,0.045,0.035,'#7b746e',{rotX:Math.PI/2}),cyl(0.37,0.28,0.36,0.045,0.035,'#7b746e',{rotX:Math.PI/2})
    ];
  }

  function makeKitchenClock(){
    const parts=[cyl(0,0,0,0.46,0.08,'#9a806b',{rotX:Math.PI/2}),cyl(0,0,0.06,0.39,0.04,'#f6f0e4',{rotX:Math.PI/2})];
    for(let i=0;i<12;i++){const a=TAU*i/12;parts.push(ellipsoid(Math.sin(a)*0.30,Math.cos(a)*0.30,0.11,0.018,0.018,0.012,'#655a52'));}
    parts.push(box(0,0.08,0.12,0.035,0.22,0.018,'#655a52',{rotZ:-0.18}),box(0.08,-0.02,0.13,0.20,0.03,0.018,'#655a52',{rotZ:0.20}));
    return parts;
  }

  function makeKitchenJars(){
    return [
      cyl(-0.28,0,0,0.13,0.38,'#e8ddc8',{taper:0.90}),cyl(-0.28,0.39,0,0.14,0.06,'#b99572'),
      cyl(0.02,0,0,0.15,0.46,'#d5dfcf',{taper:0.90}),cyl(0.02,0.47,0,0.16,0.06,'#b99572'),
      cyl(0.34,0,0,0.12,0.32,'#ead1b5',{taper:0.90}),cyl(0.34,0.33,0,0.13,0.06,'#b99572')
    ];
  }

  function makeSunPrint(){
    const parts=[box(0,0,0,1.12,0.88,0.08,'#866f62'),box(0,0,0.065,1.00,0.76,0.045,'#f6efe5')];
    parts.push(ellipsoid(0,0,0.105,0.19,0.19,0.025,'#e5b962'));
    for(let i=0;i<8;i++){const a=TAU*i/8;parts.push(box(Math.cos(a)*0.30,Math.sin(a)*0.30,0.105,0.18,0.035,0.022,'#d99b76',{rotZ:a}));}
    return parts;
  }

  function makeArchPrint(){
    return [
      box(0,0,0,0.86,1.10,0.08,'#826d62'),box(0,0,0.065,0.74,0.98,0.04,'#f3ece2'),
      box(0,-0.17,0.105,0.48,0.42,0.025,'#d7a28e'),ellipsoid(0,0.13,0.105,0.24,0.30,0.025,'#d7a28e'),
      ellipsoid(0,0.05,0.132,0.12,0.17,0.018,'#7e9b8e')
    ];
  }

  function makeLeafPrint(){
    return [
      box(0,0,0,1.00,0.78,0.08,'#806f65'),box(0,0,0.065,0.88,0.66,0.04,'#f6f0e7'),
      cyl(0,-0.18,0.105,0.025,0.42,'#67846d'),
      ellipsoid(-0.12,0.03,0.105,0.18,0.10,0.022,'#76977a',{rotZ:-0.55}),ellipsoid(0.13,0.17,0.105,0.18,0.10,0.022,'#88a986',{rotZ:0.52}),
      ellipsoid(-0.13,0.28,0.105,0.16,0.09,0.022,'#6f9176',{rotZ:-0.48})
    ];
  }

  const templates = [
    { id:'bed', name:'Pillow arch bed', glyph:'☁', colour:'#d89a94', footprint:[2.95,3.32], maker:makeCloudBed, advancedModel:'bed-v1', category:'furniture', rooms:['bedroom'] },
    { id:'kidsbed', name:'Kids bed', glyph:'☾', colour:'#9bb8b9', footprint:[2.10,2.52], maker:makeKidsBed, category:'furniture', rooms:['kids'] },
    { id:'desk', name:'Play desk', glyph:'⌸', colour:'#d5bb97', footprint:[1.56,0.92], supportHeight:0.88, supportSize:[1.26,0.58], maker:makeKidsDesk, category:'furniture', rooms:['kids'] },
    { id:'sofa', name:'Scallop sofa', glyph:'⌒', colour:'#7e9fa6', footprint:[3.5,1.65], maker:makeScallopSofa, category:'furniture', rooms:['living'] },
    { id:'chair', name:'Petal chair', glyph:'◡', colour:'#d48e87', footprint:[1.8,1.6], maker:makePetalChair, category:'furniture', rooms:['living','kids','bedroom','hall','landing'] },
    { id:'coffee', name:'Pebble table', glyph:'●', colour:'#caa27e', footprint:[2.75,1.65], supportHeight:1.03, supportSize:[2.28,1.18], maker:makePebbleCoffeeTable, category:'furniture', rooms:['living'] },
    { id:'bedside', name:'Bedside table', glyph:'▣', colour:'#c59d79', footprint:[0.96,0.82], supportHeight:1.15, supportSize:[0.86,0.64], maker:makeBedsideTable, category:'furniture', rooms:['bedroom','kids','hall','landing'] },
    { id:'drawers', name:'Bubble drawers', glyph:'•••', colour:'#c8a17d', footprint:[2.3,1.0], supportHeight:1.66, supportSize:[1.95,0.72], maker:makeBubbleDrawers, category:'storage', rooms:['bedroom','kids','living'] },
    { id:'wardrobe', name:'Tall wardrobe', glyph:'∩', colour:'#9d826e', footprint:[2.2,1.1], maker:makeArchedWardrobe, category:'storage', rooms:['bedroom','kids'] },
    { id:'bookcase', name:'Bookcase', glyph:'☷', colour:'#a78a72', footprint:[1.28,0.56], maker:makeBookcase, category:'storage', rooms:['kids','living','landing'] },
    { id:'toybox', name:'Bunny box', glyph:'⌣', colour:'#8eb1b2', footprint:[1.9,1.2], maker:makeBunnyBox, category:'play', rooms:['kids'] },
    { id:'rug', name:'Sunburst rug', glyph:'✺', colour:'#d8b384', footprint:[4.2,3.0], maker:makeSunburstRug, category:'soft', rooms:['living','bedroom'] },
    { id:'kidsrug', name:'Sky rug', glyph:'✦', colour:'#a8c4cf', footprint:[3.26,3.26], maker:makeSkyRug, category:'soft', rooms:['kids'] },
    { id:'beanbag', name:'Beanbag', glyph:'◒', colour:'#d08d82', footprint:[1.9,1.9], maker:makeBeanbag, category:'soft', rooms:['kids','living','bedroom'] },
    { id:'books', name:'Book stack', glyph:'≡', colour:'#7896a2', footprint:[0.78,0.54], place:'surface', maker:makeBookStack, category:'decor', rooms:['all'] },
    { id:'mug', name:'Little mug', glyph:'◔', colour:'#e9d7b7', footprint:[0.52,0.46], place:'surface', maker:makeMug, category:'decor', rooms:['living','kitchen','hall','landing'] },
    { id:'vase', name:'Flower vase', glyph:'✿', colour:'#d78d82', footprint:[0.58,0.58], place:'surface', maker:makeVase, category:'decor', rooms:['living','kitchen','bedroom','hall','landing','kids'] },
    { id:'candle', name:'Candle', glyph:'◦', colour:'#f0dfbf', footprint:[0.42,0.42], place:'surface', maker:makeCandle, category:'decor', rooms:['living','bedroom','hall','landing'] },
    { id:'fruit', name:'Fruit bowl', glyph:'●', colour:'#df9b59', footprint:[1.0,0.8], place:'surface', maker:makeFruitBowl, category:'decor', rooms:['kitchen','living'] },
    { id:'tinyplant', name:'Tiny plant', glyph:'❧', colour:'#789b79', footprint:[0.62,0.62], place:'surface', maker:makeTinyPlant, category:'decor', rooms:['all'] },
    { id:'plant', name:'Sprout plant', glyph:'✦', colour:'#77a27c', footprint:[1.2,1.2], maker:makeSproutPlant, category:'decor', rooms:['all'] },
    { id:'lamp', name:'Glow lamp', glyph:'◉', colour:'#e8bd76', footprint:[1.3,1.3], maker:makeGlowLamp, lightHeight:1.75, category:'lighting', rooms:['living','kitchen'] },
    { id:'bedlamp', name:'Bedside lamp', glyph:'◉', colour:'#efc983', footprint:[0.72,0.72], place:'surface', maker:makeBedsideLamp, lightHeight:0.84, lightScale:0.56, lightDistance:2.8, category:'lighting', rooms:['bedroom','kids','hall','landing','kitchen'] },
    { id:'ceiling', name:'Ceiling pendant', glyph:'⬤', colour:'#efd6a4', footprint:[1.10,1.10], place:'ceiling', canRotate:false, maker:makeCeilingPendant, lightHeight:-0.44, lightScale:0.95, lightDistance:4.2, category:'lighting', rooms:['living','kitchen','hall','landing','bedroom'] },
    { id:'cloudceiling', name:'Cloud ceiling light', glyph:'☁', colour:'#f4f0e2', footprint:[1.10,1.10], place:'ceiling', canRotate:false, maker:makeCloudCeilingLight, lightHeight:-0.30, lightScale:0.82, lightDistance:4.0, category:'lighting', rooms:['kids'] },
    { id:'clock', name:'Alarm clock', glyph:'◷', colour:'#7896a2', footprint:[0.78,0.52], place:'surface', maker:makeAlarmClock, category:'decor', rooms:['bedroom','kids','hall','landing'] },
    { id:'cabinet', name:'Base cabinet', glyph:'▥', colour:'#aab79b', footprint:[1.56,0.92], supportHeight:1.49, supportSize:[1.42,0.76], maker:makeKitchenCabinet, category:'kitchen', rooms:['kitchen'] },
    { id:'sinkcab', name:'Farmhouse sink', glyph:'▤', colour:'#aab79b', footprint:[1.80,0.94], supportHeight:1.49, supportSize:[1.62,0.78], maker:makeSinkCabinet, category:'kitchen', rooms:['kitchen'] },
    { id:'ovencab', name:'Oven + hob', glyph:'▦', colour:'#7e8c80', footprint:[1.56,0.92], supportHeight:1.49, supportSize:[1.42,0.76], maker:makeOvenCabinet, category:'kitchen', rooms:['kitchen'] },
    { id:'fridge', name:'Fridge', glyph:'▯', colour:'#bfcdd1', footprint:[1.22,1.02], maker:makeFridge, category:'kitchen', rooms:['kitchen'] },
    { id:'wallcab', name:'Wall cabinet', glyph:'☰', colour:'#9daa8f', footprint:[1.48,0.24], wallSize:[1.48,0.98], place:'wall', canRotate:false, maker:makeWallCabinet, category:'kitchen', rooms:['kitchen'] },
    { id:'shelf', name:'Open shelf', glyph:'═', colour:'#c49d78', footprint:[1.52,0.22], wallSize:[1.52,0.62], place:'wall', canRotate:false, maker:makeKitchenShelf, category:'kitchen', rooms:['kitchen'] },
    { id:'diningtable', name:'Dining table', glyph:'◯', colour:'#c99f77', footprint:[2.36,2.36], supportHeight:1.25, supportSize:[1.72,1.72], maker:makeDiningTable, category:'kitchen', rooms:['kitchen'] },
    { id:'diningchair', name:'Dining chair', glyph:'⌑', colour:'#9eaf91', footprint:[1.04,0.94], maker:makeDiningChair, category:'kitchen', rooms:['kitchen'] },
    { id:'microwave', name:'Microwave', glyph:'▣', colour:'#ece9df', footprint:[1.08,0.68], place:'surface', maker:makeMicrowave, category:'kitchen', rooms:['kitchen'] },
    { id:'kitchenjars', name:'Storage jars', glyph:'•••', colour:'#d5dfcf', footprint:[0.92,0.48], place:'surface', maker:makeKitchenJars, category:'kitchen', rooms:['kitchen'] },
    { id:'kitchenclock', name:'Wall clock', glyph:'◷', colour:'#9a806b', footprint:[0.92,0.12], wallSize:[0.92,0.92], place:'wall', canRotate:false, maker:makeKitchenClock, category:'kitchen', rooms:['kitchen'] },
    { id:'sunprint', name:'Sun picture', glyph:'☼', colour:'#e5b962', footprint:[1.12,0.14], wallSize:[1.12,0.88], place:'wall', canRotate:false, maker:makeSunPrint, category:'wall', rooms:['bedroom','living','kids','kitchen'] },
    { id:'archprint', name:'Arch picture', glyph:'∩', colour:'#d7a28e', footprint:[0.86,0.14], wallSize:[0.86,1.10], place:'wall', canRotate:false, maker:makeArchPrint, category:'wall', rooms:['bedroom','living','kitchen'] },
    { id:'leafprint', name:'Leaf picture', glyph:'❧', colour:'#76977a', footprint:[1.00,0.14], wallSize:[1.00,0.78], place:'wall', canRotate:false, maker:makeLeafPrint, category:'wall', rooms:['living','kitchen','bedroom'] },
    { id:'bunting', name:'Bunting', glyph:'⚑', colour:'#d99b8f', footprint:[1.58,0.12], wallSize:[1.58,0.52], place:'wall', canRotate:false, maker:makeBunting, category:'wall', rooms:['kids'] }
  ];

  const defaultItems = [
    { id:'seed-bed', type:'bed', room:'bedroom', x:-3.55, z:0.38, rot:0 },
    { id:'seed-bedside-l', type:'bedside', room:'bedroom', x:-4.72, z:0.18, rot:0 },
    { id:'seed-bedside-r', type:'bedside', room:'bedroom', x:-2.38, z:0.18, rot:0 },
    { id:'seed-bedlamp-l', type:'bedlamp', room:'bedroom', x:0, z:0, rot:0, supportId:'seed-bedside-l', lightLevel:0.22, shadowEnabled:true },
    { id:'seed-bedlamp-r', type:'bedlamp', room:'bedroom', x:-0.10, z:0, rot:0, supportId:'seed-bedside-r', lightLevel:0.22, shadowEnabled:true },
    { id:'seed-clock', type:'clock', room:'bedroom', x:0.21, z:0.00, rot:0, supportId:'seed-bedside-r' },
    { id:'seed-books-bed', type:'books', room:'bedroom', x:0.16, z:0.03, rot:-0.05, supportId:'seed-bedside-l' },

    { id:'seed-landing-plant', type:'plant', room:'landing', x:0.58, z:1.42, rot:0 },
    { id:'seed-landing-ceiling', type:'ceiling', room:'landing', x:0.00, y:CEILING_MOUNT_Y, z:1.12, rot:0, lightLevel:0.18, shadowEnabled:true },

    { id:'seed-kids-bed', type:'kidsbed', room:'kids', x:4.28, z:0.72, rot:0 },
    { id:'seed-kids-rug', type:'kidsrug', room:'kids', x:3.62, z:0.56, rot:0 },
    { id:'seed-kids-desk', type:'desk', room:'kids', x:3.18, z:-0.76, rot:0 },
    { id:'seed-kids-chair', type:'chair', room:'kids', x:3.18, z:-0.02, rot:Math.PI },
    { id:'seed-kids-bookcase', type:'bookcase', room:'kids', x:2.44, z:-1.02, rot:0 },
    { id:'seed-kids-box', type:'toybox', room:'kids', x:4.78, z:0.10, rot:0 },
    { id:'seed-kids-plant', type:'plant', room:'kids', x:4.86, z:-1.04, rot:0 },
    { id:'seed-kids-ceiling', type:'cloudceiling', room:'kids', x:3.52, y:CEILING_MOUNT_Y, z:-0.12, rot:0, lightLevel:0.17, shadowEnabled:true },

    { id:'seed-rug-living', type:'rug', room:'living', x:-3.55, z:0.44, rot:0 },
    { id:'seed-sofa', type:'sofa', room:'living', x:-3.58, z:-0.76, rot:0 },
    { id:'seed-chair', type:'chair', room:'living', x:-2.18, z:0.62, rot:-Math.PI/2 },
    { id:'seed-coffee', type:'coffee', room:'living', x:-3.50, z:0.54, rot:0 },
    { id:'seed-lamp', type:'lamp', room:'living', x:-4.76, z:-0.78, rot:0, lightLevel:LAMP_DEFAULT_LEVEL, shadowEnabled:true },
    { id:'seed-books', type:'books', room:'living', x:-0.32, z:0.02, rot:0.08, supportId:'seed-coffee' },
    { id:'seed-mug', type:'mug', room:'living', x:0.31, z:0.04, rot:0, supportId:'seed-coffee' },
    { id:'seed-vase', type:'vase', room:'living', x:0.03, z:-0.16, rot:0, supportId:'seed-coffee' },
    { id:'seed-living-ceiling', type:'ceiling', room:'living', x:-3.55, y:CEILING_MOUNT_Y, z:-0.06, rot:0, lightLevel:0.20, shadowEnabled:true },

    { id:'seed-hall-bedside', type:'bedside', room:'hall', x:-0.52, z:1.38, rot:0 },
    { id:'seed-hall-lamp', type:'bedlamp', room:'hall', x:0.00, z:0.00, rot:0, supportId:'seed-hall-bedside', lightLevel:0.20, shadowEnabled:true },
    { id:'seed-hall-ceiling', type:'ceiling', room:'hall', x:0.00, y:CEILING_MOUNT_Y, z:1.12, rot:0, lightLevel:0.20, shadowEnabled:true },

    { id:'seed-kitchen-fridge', type:'fridge', room:'kitchen', x:1.72, z:-1.45, rot:0 },
    { id:'seed-kitchen-cab1', type:'cabinet', room:'kitchen', x:2.72, z:-1.48, rot:0 },
    { id:'seed-kitchen-sink', type:'sinkcab', room:'kitchen', x:3.78, z:-1.48, rot:0 },
    { id:'seed-kitchen-oven', type:'ovencab', room:'kitchen', x:4.88, z:-1.48, rot:0 },
    { id:'seed-kitchen-cab2', type:'cabinet', room:'kitchen', x:5.02, z:-0.20, rot:-Math.PI/2 },
    { id:'seed-kitchen-cab3', type:'cabinet', room:'kitchen', x:5.02, z:0.78, rot:-Math.PI/2 },
    { id:'seed-kitchen-wall1', type:'wallcab', room:'kitchen', x:2.64, y:1.78, z:0, rot:0 },
    { id:'seed-kitchen-wall2', type:'wallcab', room:'kitchen', x:4.70, y:1.78, z:0, rot:0 },
    { id:'seed-kitchen-shelf', type:'shelf', room:'kitchen', x:4.00, y:1.92, z:0, rot:0 },
    { id:'seed-kitchen-clock', type:'kitchenclock', room:'kitchen', x:5.08, y:1.82, z:0, rot:0 },
    { id:'seed-kitchen-table', type:'diningtable', room:'kitchen', x:3.62, z:0.62, rot:0 },
    { id:'seed-kitchen-chair1', type:'diningchair', room:'kitchen', x:2.72, z:0.62, rot:Math.PI/2 },
    { id:'seed-kitchen-chair2', type:'diningchair', room:'kitchen', x:4.52, z:0.62, rot:-Math.PI/2 },
    { id:'seed-kitchen-microwave', type:'microwave', room:'kitchen', x:0.00, z:0.00, rot:0, supportId:'seed-kitchen-cab2' },
    { id:'seed-kitchen-jars', type:'kitchenjars', room:'kitchen', x:-0.10, z:0.00, rot:0, supportId:'seed-kitchen-cab1' },
    { id:'seed-kitchen-ceiling', type:'ceiling', room:'kitchen', x:3.62, y:CEILING_MOUNT_Y, z:0.48, rot:0, lightLevel:0.18, shadowEnabled:true },
    { id:'seed-kitchen-plant', type:'plant', room:'kitchen', x:4.84, z:1.34, rot:0 },
    { id:'seed-kitchen-fruit', type:'fruit', room:'kitchen', x:0.00, z:0.00, rot:0, supportId:'seed-kitchen-table' },
    { id:'seed-kitchen-vase', type:'vase', room:'kitchen', x:-0.30, z:-0.08, rot:0, supportId:'seed-kitchen-sink' }
  ];


  let state = {
    lighting:'day',
    lightingLevels:{
      day:{...LIGHTING_PRESETS.day},
      evening:{...LIGHTING_PRESETS.evening}
    },
    rooms:Object.fromEntries(rooms.map(r => [r.id,{wall:r.wall,floor:r.floor,wallpaper:r.wallpaper,floorTexture:r.floorTexture}])),
    items:defaultItems.map(i => ({...i})),
    camera:{x:-3.30,y:1.18,zoom:1.24}
  };

  let selectedId = null;
  let activeRoomId = 'living';
  let activeInventoryCategory = 'furniture';
  let idCounter = 1;
  let gesture = null;
  let resizeRaf = 0;

  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0xd9d0c7, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Static shadow maps are reused while the camera pans/zooms. They are only
  // rebuilt when furniture/lights move or their shadow state changes.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9d0c7);

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 60);
  camera.layers.enableAll();
  const cameraOffset = new THREE.Vector3(0, 0.68, 12.20);
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  const wallPlane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
  const tempVec = new THREE.Vector3();
  const tempQuat = new THREE.Quaternion();
  const tempEuler = new THREE.Euler();

  const houseGroup = new THREE.Group();
  const itemRoot = new THREE.Group();
  const decorGroup = new THREE.Group();
  scene.add(houseGroup, decorGroup, itemRoot);

  const hemi = new THREE.HemisphereLight(0xfff7eb, 0x7f858d, 1.55);
  hemi.layers.enableAll();
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d7, 2.35);
  sun.position.set(-5.5, 9.0, 7.5);
  sun.castShadow = true;
  sun.layers.enableAll();
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 24;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.022;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0,2.1,-0.3);

  const eveningFill = new THREE.AmbientLight(0xbcc5d6, 0.0);
  eveningFill.layers.enableAll();
  scene.add(eveningFill);

  const roomMaterials = new Map();
  const wallpaperTextures = new Map();
  const floorTextures = new Map();
  const itemGroups = new Map();
  const supportAnchors = new Map();
  const supportPlanes = [];
  const selectableMeshes = [];
  const localLights = [];
  const indirectLightRigs = new Map();
  const emissiveMeshes = [];
  let selectionHelper = null;
  let renderAverageMs = 0;
  let renderSamples = 0;
  let activeShadowCount = 0;

  function roomById(id){ return rooms.find(r => r.id === id) || rooms[0]; }
  function templateById(id){ return templates.find(t => t.id === id); }
  function itemById(id){ return state.items.find(i => i.id === id); }

  function roomLayerIndex(roomId){ return ROOM_LAYERS[roomId] || 0; }

  function roomSetName(roomId){
    return roomById(roomId).name;
  }

  function templateAllowedInRoom(t, roomId){
    const allowed=t.rooms||['all'];
    return allowed.includes('all')||allowed.includes(roomId);
  }

  function filteredTemplates(roomId=activeRoomId, category=activeInventoryCategory){
    return templates.filter(t=>templateAllowedInRoom(t,roomId) && (!category || t.category===category));
  }

  function availableCategories(roomId=activeRoomId){
    const ordered=ROOM_CATEGORY_ORDER[roomId]||Object.keys(INVENTORY_CATEGORIES);
    return ordered.filter(cat=>templates.some(t=>t.category===cat && templateAllowedInRoom(t,roomId)));
  }

  function enableRoomLayers(object, roomIds){
    if(!object)return object;
    const ids=Array.isArray(roomIds)?roomIds:[roomIds];
    object.traverse(obj=>{
      ids.forEach(id=>{ const layer=roomLayerIndex(id); if(layer)obj.layers.enable(layer); });
    });
    return object;
  }

  function assignItemRoomLayer(group,roomId){
    const layer=roomLayerIndex(roomId);
    if(!layer)return;
    group.traverse(obj=>{
      if(obj.isPointLight||obj.isSpotLight){
        // Local lights illuminate and shadow only their own room layer.
        obj.layers.set(layer);
        if(obj.shadow?.camera)obj.shadow.camera.layers.set(layer);
      }else{
        // Keep layer 0 for camera/raycast compatibility and add the room layer
        // used by room-local point lights and their shadow cameras.
        obj.layers.enable(layer);
      }
    });
  }

  function invalidateShadows(roomId=null,includeSun=true){
    // Keep shadow maps static while the camera simply pans/zooms. When scene
    // geometry moves, only local lights in that room are asked to redraw.
    renderer.shadowMap.needsUpdate=true;
    if(includeSun&&sun?.shadow)sun.shadow.needsUpdate=true;
    localLights.forEach(light=>{
      if(!roomId||light.userData.room===roomId)light.shadow.needsUpdate=true;
    });
  }

  function roomInteriorCenterZ(room){
    if(room.core){
      const minZ=Number(room.placeMinZ ?? CORE_DRESS_MIN_Z);
      const maxZ=Number(room.placeMaxZ ?? (FRONT_Z-0.10));
      return clamp((minZ+maxZ)/2, minZ+0.18, maxZ-0.18);
    }
    return 0.08;
  }

  function ensureIndirectRig(room){
    let rig=indirectLightRigs.get(room.id);
    if(rig)return rig;
    const layer=roomLayerIndex(room.id) || 0;
    const side=ROOM_WINDOW_SIDES[room.id]||'centre';
    const centreZ=roomInteriorCenterZ(room);
    const sideX=side==='left' ? room.minX + 0.36 : side==='right' ? room.maxX - 0.36 : room.cx;

    const floorLight=new THREE.PointLight(0xffffff,0,5.2,2);
    floorLight.position.set(room.cx,room.floorY+0.56,centreZ+0.05);
    floorLight.layers.set(layer);
    floorLight.castShadow=false;

    const wallLight=new THREE.PointLight(0xffffff,0,4.9,2);
    wallLight.position.set(sideX,room.floorY+1.42,centreZ-0.22);
    wallLight.layers.set(layer);
    wallLight.castShadow=false;

    const backLight=new THREE.PointLight(0xffffff,0,4.1,2);
    backLight.position.set(room.cx,room.floorY+1.18,BACK_Z+0.56);
    backLight.layers.set(layer);
    backLight.castShadow=false;

    rig={floorLight,wallLight,backLight};
    indirectLightRigs.set(room.id,rig);
    scene.add(floorLight);
    scene.add(wallLight);
    scene.add(backLight);
    return rig;
  }

  function roomFeatureColor(roomId){
    let r=0,g=0,b=0,w=0;
    state.items.forEach(item=>{
      if(item.room!==roomId)return;
      const t=templateById(item.type);
      if(!t||!t.colour)return;
      const weightMap={ furniture:4.4, kitchen:4.2, storage:3.1, soft:2.6, play:2.4, lighting:1.4, wall:1.2, decor:1.0 };
      let weight=weightMap[t.category]||1.0;
      if(item.supportId)weight*=0.72;
      const c=new THREE.Color(t.colour);
      r+=c.r*weight; g+=c.g*weight; b+=c.b*weight; w+=weight;
    });
    return w>0 ? new THREE.Color(r/w,g/w,b/w) : new THREE.Color(state.rooms[roomId]?.wall || '#ddd5cc');
  }

  function roomLampEnergy(roomId){
    let total=0;
    localLights.forEach(light=>{
      if(light.userData.room!==roomId)return;
      total+=Math.max(0,Number(light.intensity)||0);
    });
    return clamp(total/6.6,0,2.2);
  }

  function updateIndirectLighting(levels, evening){
    const indirectLevel=clamp(Number(levels.indirect ?? 0),0,INDIRECT_LEVEL_MAX);
    const daylightColor=new THREE.Color(evening?0xaab7d4:0xfff0d7);
    const lampColor=new THREE.Color(0xffc878);

    rooms.forEach(room=>{
      const rig=ensureIndirectRig(room);
      const style=state.rooms[room.id]||room;
      const wallColor=new THREE.Color(style.wall || room.wall);
      const floorColor=new THREE.Color(style.floor || room.floor);
      const featureColor=roomFeatureColor(room.id);
      const daylight=(evening?0.28:1.0)*levels.direct*(ROOM_DAYLIGHT_FACTORS[room.id]||0.72);
      const lamp=roomLampEnergy(room.id);
      const sourceEnergy=(daylight*1.18)+(lamp*1.42);
      const sourceMix=Math.max(0.0001,(daylight*1.05)+(lamp*0.95));
      const sourceColor=new THREE.Color(0,0,0)
        .add(daylightColor.clone().multiplyScalar(daylight*1.05))
        .add(lampColor.clone().multiplyScalar(lamp*0.95))
        .multiplyScalar(1/sourceMix);
      const base=indirectLevel*sourceEnergy;
      const floorIntensity=clamp(base*1.08,0,2.8);
      const wallIntensity=clamp(base*0.76,0,2.2);
      const backIntensity=clamp(base*0.54,0,1.6);

      rig.floorLight.color.copy(sourceColor).lerp(floorColor,0.58).lerp(featureColor,0.12);
      rig.wallLight.color.copy(sourceColor).lerp(wallColor,0.56).lerp(featureColor,0.14);
      rig.backLight.color.copy(sourceColor).lerp(wallColor,0.38).lerp(featureColor,0.22);

      rig.floorLight.intensity=indirectLevel>0.001?floorIntensity:0;
      rig.wallLight.intensity=indirectLevel>0.001?wallIntensity:0;
      rig.backLight.intensity=indirectLevel>0.001?backIntensity:0;
    });
  }

  function wallpaperTexture(patternId){
    if(!patternId||patternId==='plain')return null;
    if(wallpaperTextures.has(patternId))return wallpaperTextures.get(patternId);
    const c=document.createElement('canvas');
    c.width=128;c.height=128;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,128,128);
    ctx.fillStyle='#ded9d2';ctx.strokeStyle='#d8d3cc';ctx.lineWidth=6;
    if(patternId==='stripe'){
      ctx.fillStyle='#e7e2dc';
      for(let x=0;x<128;x+=32)ctx.fillRect(x,0,12,128);
    }else if(patternId==='dot'){
      ctx.fillStyle='#d7d2cb';
      [[20,22],[64,50],[108,22],[20,90],[64,118],[108,90]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,5,0,TAU);ctx.fill();});
    }else if(patternId==='stars'){
      ctx.fillStyle='#dce6ee';ctx.fillRect(0,0,128,128);
      ctx.fillStyle='#f6edd7';
      const stars=[[18,20],[56,18],[98,26],[32,64],[84,62],[18,104],[64,100],[110,94]];
      stars.forEach(([x,y])=>{
        ctx.beginPath();
        for(let i=0;i<5;i++){
          const a=-Math.PI/2+i*TAU/5;
          const b=a+TAU/10;
          if(i===0)ctx.moveTo(x+Math.cos(a)*7,y+Math.sin(a)*7);
          else ctx.lineTo(x+Math.cos(a)*7,y+Math.sin(a)*7);
          ctx.lineTo(x+Math.cos(b)*3.2,y+Math.sin(b)*3.2);
        }
        ctx.closePath();ctx.fill();
      });
    }else if(patternId==='clouds'){
      ctx.fillStyle='#dbe6f3';ctx.fillRect(0,0,128,128);
      ctx.fillStyle='#f5f0df';
      [[22,32],[76,28],[40,84],[96,92]].forEach(([x,y])=>{
        ctx.beginPath();ctx.ellipse(x,y,14,10,0,0,TAU);ctx.ellipse(x+12,y+2,12,9,0,0,TAU);ctx.ellipse(x-11,y+3,10,8,0,0,TAU);ctx.fill();
      });
    }else if(patternId==='arch'){
      ctx.strokeStyle='#d5d0c8';ctx.lineWidth=7;
      for(let y=34;y<150;y+=48){
        for(let x=-8;x<150;x+=48){ctx.beginPath();ctx.arc(x,y,18,Math.PI,0);ctx.stroke();}
      }
    }else if(patternId==='sprig'){
      ctx.fillStyle='#eef1ec';ctx.fillRect(0,0,128,128);
      ctx.strokeStyle='#c6cebf';ctx.fillStyle='#d5ddd0';ctx.lineWidth=4;
      [[28,34],[94,82]].forEach(([x,y],i)=>{
        ctx.beginPath();ctx.moveTo(x,y+25);ctx.quadraticCurveTo(x+(i?8:-8),y,x,y-24);ctx.stroke();
        [[-11,-10],[10,1],[-9,12]].forEach(([dx,dy])=>{ctx.beginPath();ctx.ellipse(x+dx,y+dy,8,4,dx<0?-0.6:0.6,0,TAU);ctx.fill();});
      });
    }
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(5.5,3.6);
    tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy?.()||1);
    wallpaperTextures.set(patternId,tex);
    return tex;
  }

  function floorTexture(patternId){
    if(!patternId||patternId==='plain')return null;
    if(floorTextures.has(patternId))return floorTextures.get(patternId);
    const c=document.createElement('canvas');
    c.width=192;c.height=192;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,c.width,c.height);
    if(patternId==='plank'){
      ctx.fillStyle='#efe8dd';ctx.fillRect(0,0,192,192);
      ctx.strokeStyle='#d4c4b1';ctx.lineWidth=3;
      for(let x=0;x<=192;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,192);ctx.stroke();}
      ctx.lineWidth=1.5;ctx.strokeStyle='#c3b19c';
      for(let y=22;y<192;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(96,y);ctx.stroke();ctx.beginPath();ctx.moveTo(96,y+16);ctx.lineTo(192,y+16);ctx.stroke();}
    }else if(patternId==='herringbone'){
      ctx.fillStyle='#f0e7da';ctx.fillRect(0,0,192,192);
      ctx.strokeStyle='#cfbeaa';ctx.lineWidth=2;
      for(let y=-48;y<240;y+=24){
        for(let x=-48;x<240;x+=48){
          ctx.beginPath();ctx.moveTo(x,y+24);ctx.lineTo(x+24,y);ctx.lineTo(x+48,y+24);ctx.stroke();
          ctx.beginPath();ctx.moveTo(x+24,y+24);ctx.lineTo(x+48,y+48);ctx.lineTo(x+72,y+24);ctx.stroke();
        }
      }
    }else if(patternId==='tile'){
      ctx.fillStyle='#f3f1ed';ctx.fillRect(0,0,192,192);
      ctx.strokeStyle='#cec8c0';ctx.lineWidth=4;
      for(let x=0;x<=192;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,192);ctx.stroke();}
      for(let y=0;y<=192;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(192,y);ctx.stroke();}
    }else if(patternId==='carpet'){
      ctx.fillStyle='#e9dcc8';ctx.fillRect(0,0,192,192);
      ctx.strokeStyle='rgba(255,255,255,0.22)';ctx.lineWidth=1;
      for(let y=4;y<192;y+=8){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(192,y);ctx.stroke();}
      ctx.strokeStyle='rgba(180,150,120,0.18)';
      for(let x=4;x<192;x+=8){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,192);ctx.stroke();}
    }else if(patternId==='checker'){
      const cols=['#f3efe7','#ddd4c6'];
      for(let y=0;y<192;y+=32)for(let x=0;x<192;x+=32){ctx.fillStyle=cols[((x+y)/32)%2];ctx.fillRect(x,y,32,32);}
    }
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(3.4,3.4);
    tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy?.()||1);
    floorTextures.set(patternId,tex);
    return tex;
  }

  function applyRoomWallFinish(roomId){
    const style=state.rooms[roomId];
    const mat=roomMaterials.get(`${roomId}:wall`);
    if(!style||!mat)return;
    mat.color.set(style.wall);
    mat.map=wallpaperTexture(style.wallpaper||'plain');
    mat.needsUpdate=true;
  }

  function applyRoomFloorFinish(roomId){
    const style=state.rooms[roomId];
    const mat=roomMaterials.get(`${roomId}:floor`);
    if(!style||!mat)return;
    mat.color.set(style.floor);
    mat.map=floorTexture(style.floorTexture||'plain');
    mat.needsUpdate=true;
  }

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
    if (opts.rotX) mesh.rotation.x = opts.rotX;
    if (opts.rotZ) mesh.rotation.z = opts.rotZ;
    setShadowFlags(mesh, opts.castShadow !== false, opts.receiveShadow !== false);
    parent.add(mesh);
    return mesh;
  }

  function addCylinder(parent, x,y,z,r,h,color, opts={}){
    const taper = opts.taper == null ? 1 : opts.taper;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r*taper, r, h, 24, 1, false), material(color, opts));
    mesh.position.set(x,y+h/2,z);
    if (opts.rot) mesh.rotation.y = opts.rot;
    if (opts.rotX) mesh.rotation.x = opts.rotX;
    if (opts.rotZ) mesh.rotation.z = opts.rotZ;
    setShadowFlags(mesh, opts.castShadow !== false, opts.receiveShadow !== false);
    parent.add(mesh);
    return mesh;
  }

  function addEllipsoid(parent, x,y,z,rx,ry,rz,color, opts={}){
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), material(color, opts));
    mesh.scale.set(rx,ry,rz);
    mesh.position.set(x,y,z);
    if (opts.rot) mesh.rotation.y = opts.rot;
    if (opts.rotX) mesh.rotation.x = opts.rotX;
    if (opts.rotZ) mesh.rotation.z = opts.rotZ;
    setShadowFlags(mesh, opts.castShadow !== false, opts.receiveShadow !== false);
    parent.add(mesh);
    return mesh;
  }

  function roundedRectShape(w,h,r){
    const x=-w/2,y=-h/2,rr=Math.min(r,w/2,h/2);
    const shape=new THREE.Shape();
    shape.moveTo(x+rr,y);
    shape.lineTo(x+w-rr,y);
    shape.quadraticCurveTo(x+w,y,x+w,y+rr);
    shape.lineTo(x+w,y+h-rr);
    shape.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
    shape.lineTo(x+rr,y+h);
    shape.quadraticCurveTo(x,y+h,x,y+h-rr);
    shape.lineTo(x,y+rr);
    shape.quadraticCurveTo(x,y,x+rr,y);
    shape.closePath();
    return shape;
  }

  function archPanelShape(w,h){
    const x=-w/2,y=-h/2;
    const shape=new THREE.Shape();
    shape.moveTo(x,y);
    shape.lineTo(x,y+h*0.56);
    shape.bezierCurveTo(x,y+h*0.78,-w*0.34,y+h*0.80,-w*0.27,y+h*0.88);
    shape.bezierCurveTo(-w*0.18,y+h*1.02,-w*0.08,y+h,0,y+h);
    shape.bezierCurveTo(w*0.08,y+h,w*0.18,y+h*1.02,w*0.27,y+h*0.88);
    shape.bezierCurveTo(w*0.34,y+h*0.80,w/2,y+h*0.78,w/2,y+h*0.56);
    shape.lineTo(w/2,y);
    shape.closePath();
    return shape;
  }

  function extrudedShapeGeometry(shape,depth,bevel=0.025){
    const geo=new THREE.ExtrudeGeometry(shape,{
      depth,
      bevelEnabled:true,
      bevelSegments:3,
      steps:1,
      curveSegments:10,
      bevelSize:Math.min(bevel,depth*0.35),
      bevelThickness:Math.min(bevel,depth*0.28)
    });
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }

  function addRoundedPanel(parent,x,y,z,w,h,d,r,color,opts={}){
    const mesh=new THREE.Mesh(extrudedShapeGeometry(roundedRectShape(w,h,r),d,opts.bevel??0.025),material(color,{roughness:opts.roughness??0.92}));
    mesh.position.set(x,y,z);
    if(opts.rotY)mesh.rotation.y=opts.rotY;
    setShadowFlags(mesh,opts.castShadow!==false,opts.receiveShadow!==false);
    parent.add(mesh);
    return mesh;
  }

  function addRoundedSlab(parent,x,y,z,w,h,d,r,color,opts={}){
    const mesh=new THREE.Mesh(extrudedShapeGeometry(roundedRectShape(w,d,r),h,opts.bevel??0.022),material(color,{roughness:opts.roughness??0.94}));
    mesh.rotation.x=Math.PI/2;
    mesh.position.set(x,y,z);
    if(opts.rotY)mesh.rotation.y=opts.rotY;
    setShadowFlags(mesh,opts.castShadow!==false,opts.receiveShadow!==false);
    parent.add(mesh);
    return mesh;
  }

  function addArchPanel(parent,x,y,z,w,h,d,color,opts={}){
    const mesh=new THREE.Mesh(extrudedShapeGeometry(archPanelShape(w,h),d,opts.bevel??0.028),material(color,{roughness:opts.roughness??0.93}));
    mesh.position.set(x,y,z);
    setShadowFlags(mesh,opts.castShadow!==false,opts.receiveShadow!==false);
    parent.add(mesh);
    return mesh;
  }

  function addSoftPipe(parent,points,radius,color){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])),false,'catmullrom',0.35);
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,28,radius,8,false),material(color,{roughness:0.9}));
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }

  function buildAdvancedBed(parent,itemId){
    const timber='#9f765f', timberDark='#7f5d4c', linen='#fbf5ec', blush='#d99b98', blushDark='#c9807c', head='#e5b2ad';

    // Properly bevelled frame and mattress, generated from rounded 2D profiles and extruded into 3D.
    addRoundedSlab(parent,0,0.20,0,1.86,0.22,2.08,0.16,timber,{bevel:0.032});
    addRoundedSlab(parent,0,0.385,-0.01,1.76,0.22,1.98,0.14,linen,{bevel:0.035,roughness:0.97});

    // A shaped upholstered headboard: one continuous custom silhouette rather than overlapping spheres.
    addArchPanel(parent,0,0.89,-1.055,1.94,1.46,0.15,head,{bevel:0.035});
    const channelXs=[-0.62,-0.31,0,0.31,0.62];
    channelXs.forEach((x,i)=>{
      const heights=[0.84,1.02,1.12,1.02,0.84];
      addRoundedPanel(parent,x,0.98,-0.965,0.22,heights[i],0.055,0.10,i===2?'#efc2bd':'#eab9b4',{bevel:0.018});
    });
    [-0.46,0,0.46].forEach(x=>addEllipsoid(parent,x,0.92,-0.925,0.032,0.032,0.018,'#bf7773',{castShadow:false}));

    // Bedding with separate soft layers and piping to make the silhouette read at dollhouse scale.
    addRoundedSlab(parent,0,0.555,0.15,1.67,0.105,1.52,0.13,blush,{bevel:0.026});
    addRoundedSlab(parent,-0.43,0.665,-0.64,0.72,0.17,0.43,0.15,'#fffaf4',{bevel:0.026});
    addRoundedSlab(parent,0.43,0.665,-0.64,0.72,0.17,0.43,0.15,'#fffaf4',{bevel:0.026});
    addSoftPipe(parent,[[-0.76,0.612,0.86],[-0.26,0.620,0.90],[0.26,0.617,0.90],[0.76,0.612,0.86]],0.018,blushDark);
    addSoftPipe(parent,[[-0.80,0.612,-0.10],[-0.78,0.618,0.34],[-0.76,0.612,0.84]],0.014,blushDark);
    addSoftPipe(parent,[[0.80,0.612,-0.10],[0.78,0.618,0.34],[0.76,0.612,0.84]],0.014,blushDark);

    // Tapered feet and a subtle front rail.
    [-0.73,0.73].forEach(x=>{
      addCylinder(parent,x,0.0,-0.79,0.055,0.18,timberDark,{taper:0.68});
      addCylinder(parent,x,0.0,0.79,0.055,0.18,timberDark,{taper:0.68});
    });
    addRoundedPanel(parent,0,0.24,1.00,1.72,0.24,0.10,0.09,timber,{bevel:0.022});

    parent.userData.advancedModel='bed-v1';
  }

  function buildPrimitive(parent, p, itemId){
    const opts={rot:p.rot||0,rotX:p.rotX||0,rotZ:p.rotZ||0,emissive:!!p.emissive,roughness:p.emissive?0.72:0.9,castShadow:p.castShadow!==false,receiveShadow:p.receiveShadow!==false};
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
    if(key==='wall')mat.map=wallpaperTexture(state.rooms[roomId]?.wallpaper||'plain');
    if(key==='floor')mat.map=floorTexture(state.rooms[roomId]?.floorTexture||'plain');
    roomMaterials.set(`${roomId}:${key}`,mat);
    return mat;
  }

  function addDecorBox(parent,x,y,z,w,h,d,color){
    return addBox(parent,x,y,z,w,h,d,color,{castShadow:false,receiveShadow:true,roughness:0.9});
  }

  function addRoomWindow(room, opts={}){
    const width=opts.width??1.55;
    const height=opts.height??1.10;
    const sill=opts.sill??0.92;
    const cx=room.cx+(opts.offsetX??0);
    const cy=room.floorY+sill+height/2;
    const frameCol=opts.frame||'#d1b7a6';
    const glassCol=opts.glass||'#cadfe3';
    const frameZ=BACK_Z+0.040;
    addBox(decorGroup,cx,cy,frameZ,width+0.28,height+0.28,0.04,frameCol,{castShadow:false});
    addBox(decorGroup,cx,cy,frameZ+0.022,width,height,0.025,glassCol,{castShadow:false});
    addBox(decorGroup,cx,cy,frameZ+0.036,0.045,height,0.016,'#f8f3ec',{castShadow:false});
    addBox(decorGroup,cx,cy,frameZ+0.036,width,0.045,0.016,'#f8f3ec',{castShadow:false});
    if(opts.panes===6){
      addBox(decorGroup,cx-width/3,cy,frameZ+0.036,0.036,height,0.016,'#f8f3ec',{castShadow:false});
      addBox(decorGroup,cx+width/3,cy,frameZ+0.036,0.036,height,0.016,'#f8f3ec',{castShadow:false});
      addBox(decorGroup,cx,cy-height/4,frameZ+0.036,width,0.036,0.016,'#f8f3ec',{castShadow:false});
      addBox(decorGroup,cx,cy+height/4,frameZ+0.036,width,0.036,0.016,'#f8f3ec',{castShadow:false});
    }
    if(opts.curtains){
      const drop=(opts.curtainDrop??(height*0.55));
      const edge=(opts.curtainWidth??0.18);
      addBox(decorGroup,cx-width/2-edge/2,cy+0.02,frameZ+0.020,edge,drop,0.024,opts.curtainColor||'#d7a39b',{castShadow:false});
      addBox(decorGroup,cx+width/2+edge/2,cy+0.02,frameZ+0.020,edge,drop,0.024,opts.curtainColor||'#d7a39b',{castShadow:false});
      addBox(decorGroup,cx,cy+height/2+0.11,frameZ+0.018,width+0.42,0.05,0.02,'#f4efe8',{castShadow:false});
    }
  }

  function addSideWindow(room, side='left', opts={}){
    const width=opts.width??1.58;
    const height=opts.height??1.22;
    const sill=opts.sill??0.88;
    const cz=(opts.offsetZ??0);
    const cy=room.floorY+sill+height/2;
    const frameCol=opts.frameColor||'#cbb7a7';
    const glassCol=opts.glassColor||'#cfe1e6';
    const left=side==='left';
    const x=left?room.minX+0.038:room.maxX-0.038;
    const sign=left?1:-1;
    addBox(decorGroup,x+sign*0.020,cy,cz,0.04,height+0.24,width+0.28,frameCol,{castShadow:false});
    addBox(decorGroup,x+sign*0.036,cy,cz,0.025,height,width,glassCol,{castShadow:false});
    addBox(decorGroup,x+sign*0.050,cy,cz,0.016,height,0.045,'#f8f3ec',{castShadow:false});
    addBox(decorGroup,x+sign*0.050,cy,cz,0.016,0.045,width,'#f8f3ec',{castShadow:false});
    if(opts.panes===6||opts.panes===4){
      addBox(decorGroup,x+sign*0.050,cy-height/4,cz,0.016,0.036,width,'#f8f3ec',{castShadow:false});
      addBox(decorGroup,x+sign*0.050,cy+height/4,cz,0.016,0.036,width,'#f8f3ec',{castShadow:false});
      addBox(decorGroup,x+sign*0.050,cy,cz,0.016,height,0.036,'#f8f3ec',{castShadow:false});
    }
    addBox(decorGroup,x+sign*0.10,room.floorY+sill-0.06,cz,0.18,0.05,width+0.12,'#eee4d5',{castShadow:false});
    if(opts.curtains){
      const drop=(opts.curtainDrop??(height*0.86));
      const edge=(opts.curtainWidth??0.22);
      addBox(decorGroup,x+sign*0.018,cy+0.02,cz-width/2-edge/2,0.024,drop,edge,opts.curtainColor||'#d7a39b',{castShadow:false});
      addBox(decorGroup,x+sign*0.018,cy+0.02,cz+width/2+edge/2,0.024,drop,edge,opts.curtainColor||'#d7a39b',{castShadow:false});
      addBox(decorGroup,x+sign*0.016,cy+height/2+0.11,cz,0.02,0.05,width+0.42,'#f4efe8',{castShadow:false});
    }
  }

  function buildRoom(room){
    const houseStart=houseGroup.children.length;
    const decorStart=decorGroup.children.length;
    const styles=state.rooms[room.id];
    const floorMat=makeRoomMaterial(room.id,'floor',styles.floor);
    const wallMat=makeRoomMaterial(room.id,'wall',styles.wall);

    const floor=new THREE.Mesh(new THREE.BoxGeometry(room.width-0.04,0.055,ROOM_D-0.04),floorMat);
    floor.position.set(room.cx,room.floorY-0.027,(BACK_Z+FRONT_Z)/2);
    floor.receiveShadow=true;
    houseGroup.add(floor);

    const back=new THREE.Mesh(new THREE.BoxGeometry(room.width,ROOM_H,0.10),wallMat);
    back.position.set(room.cx,room.floorY+ROOM_H/2,BACK_Z-0.05);
    back.receiveShadow=true;
    houseGroup.add(back);

    const skirt=addBox(decorGroup,room.cx,room.floorY+0.075,BACK_Z+0.015,room.width-0.08,0.15,0.035,'#f6f0e8',{castShadow:false,receiveShadow:true});
    skirt.userData.decor=true;

    if(room.decor==='bedroom'){
      addSideWindow(room,'left',{width:1.26,height:1.34,sill:0.78,curtains:true,curtainColor:'#d7a39b',panes:4,offsetZ:-0.45});
    }else if(room.decor==='kids'){
      addSideWindow(room,'right',{width:1.18,height:1.30,sill:0.76,curtains:true,curtainColor:'#7fa0ba',panes:4,offsetZ:-0.55});
    }else if(room.decor==='living'){
      addSideWindow(room,'left',{width:1.30,height:1.62,sill:0.48,curtains:true,curtainColor:'#d3b59f',panes:4,offsetZ:-0.35});
    }else if(room.decor==='kitchen'){
      addSideWindow(room,'right',{width:1.12,height:1.18,sill:0.84,curtains:false,panes:4,offsetZ:0.12});
    }

    houseGroup.children.slice(houseStart).forEach(obj=>enableRoomLayers(obj,room.id));
    decorGroup.children.slice(decorStart).forEach(obj=>enableRoomLayers(obj,room.id));
  }

  function addArchitectureMaterialBox(x0,x1,y0,y1,z0,z1,mat,roomIds){
    if(x1<=x0||y1<=y0||z1<=z0)return null;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),mat);
    mesh.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
    mesh.castShadow=true;mesh.receiveShadow=true;
    houseGroup.add(mesh);
    enableRoomLayers(mesh,roomIds);
    return mesh;
  }

  function addDoorOpeningInXWall(xCentre,floorY,centreZ,shell,trim,roomIds){
    const x0=xCentre-WALL_T/2;
    const x1=xCentre+WALL_T/2;
    const z0=centreZ-DOOR_OPEN_W/2;
    const z1=centreZ+DOOR_OPEN_W/2;
    const add=(...args)=>enableRoomLayers(addArchitectureBox(...args),roomIds);
    add(x0,x1,floorY,floorY+ROOM_H,BACK_Z,z0,shell);
    add(x0,x1,floorY,floorY+ROOM_H,z1,FRONT_Z,shell);
    add(x0,x1,floorY+DOOR_OPEN_H,floorY+ROOM_H,z0,z1,shell);
    add(x0-0.02,x1+0.02,floorY,floorY+DOOR_OPEN_H,z0-0.03,z0+0.03,trim,{castShadow:false});
    add(x0-0.02,x1+0.02,floorY,floorY+DOOR_OPEN_H,z1-0.03,z1+0.03,trim,{castShadow:false});
    add(x0-0.02,x1+0.02,floorY+DOOR_OPEN_H-0.03,floorY+DOOR_OPEN_H+0.03,z0,z1,trim,{castShadow:false});
  }

  function addCoreWindow(floorY,opts={}){
    const width=opts.width??0.92;
    const height=opts.height??1.20;
    const y=floorY+(opts.sill??1.02)+height/2;
    const z=BACK_Z+0.040;
    addBox(decorGroup,0,y,z,width+0.24,height+0.24,0.04,'#ccb8a8',{castShadow:false});
    addBox(decorGroup,0,y,z+0.022,width,height,0.024,'#cfe1e6',{castShadow:false});
    addBox(decorGroup,0,y,z+0.035,0.04,height,0.016,'#f7f2ec',{castShadow:false});
    addBox(decorGroup,0,y,z+0.035,width,0.04,0.016,'#f7f2ec',{castShadow:false});
  }

  function addHorizontalRail(x0,x1,y,z,color='#7b685a'){
    const len=Math.max(0.01,x1-x0);
    const rail=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.026,len,14),material(color,{roughness:0.9}));
    rail.rotation.z=Math.PI/2;
    rail.position.set((x0+x1)/2,y,z);
    rail.castShadow=true;
    houseGroup.add(rail);
    return rail;
  }

  function buildArchitecture(){
    houseGroup.clear();
    decorGroup.clear();
    roomMaterials.clear();

    rooms.filter(room=>!room.core).forEach(buildRoom);

    const shell='#c9beb2', cut='#b8aa9d', trim='#efe6dd';

    enableRoomLayers(addArchitectureBox(HOUSE_MIN_X-WALL_T,HOUSE_MIN_X,-0.16,HOUSE_H+0.18,BACK_Z-WALL_T,FRONT_Z+0.02,shell),['bedroom','living']);
    enableRoomLayers(addArchitectureBox(HOUSE_MAX_X,HOUSE_MAX_X+WALL_T,-0.16,HOUSE_H+0.18,BACK_Z-WALL_T,FRONT_Z+0.02,shell),['kids','kitchen']);
    enableRoomLayers(addArchitectureBox(HOUSE_MIN_X-WALL_T,HOUSE_MAX_X+WALL_T,-0.18,0,BACK_Z-WALL_T,FRONT_Z+0.02,cut),Object.keys(ROOM_LAYERS));
    enableRoomLayers(addArchitectureBox(HOUSE_MIN_X-WALL_T,HOUSE_MAX_X+WALL_T,HOUSE_H,HOUSE_H+0.20,BACK_Z-WALL_T,FRONT_Z+0.02,cut),Object.keys(ROOM_LAYERS));

    // Hall and landing are now true rooms with independent materials / save state.
    const hallStyle=state.rooms.hall, landingStyle=state.rooms.landing;
    const hallFloorMat=makeRoomMaterial('hall','floor',hallStyle.floor);
    const hallWallMat=makeRoomMaterial('hall','wall',hallStyle.wall);
    const landingFloorMat=makeRoomMaterial('landing','floor',landingStyle.floor);
    const landingWallMat=makeRoomMaterial('landing','wall',landingStyle.wall);

    const hallFloor=new THREE.Mesh(new THREE.BoxGeometry(CORE_W-0.04,0.055,ROOM_D-0.04),hallFloorMat);
    hallFloor.position.set(0,-0.027,0); hallFloor.receiveShadow=true; houseGroup.add(hallFloor); enableRoomLayers(hallFloor,'hall');
    const hallBack=new THREE.Mesh(new THREE.BoxGeometry(CORE_W,ROOM_H,0.10),hallWallMat);
    hallBack.position.set(0,ROOM_H/2,BACK_Z-0.05); hallBack.receiveShadow=true; houseGroup.add(hallBack); enableRoomLayers(hallBack,'hall');

    const landingDepth=FRONT_Z-CORE_DRESS_MIN_Z;
    const landingFloor=new THREE.Mesh(new THREE.BoxGeometry(CORE_W-0.04,0.055,landingDepth),landingFloorMat);
    landingFloor.position.set(0,UPPER_Y-0.027,(CORE_DRESS_MIN_Z+FRONT_Z)/2); landingFloor.receiveShadow=true; houseGroup.add(landingFloor); enableRoomLayers(landingFloor,'landing');
    enableRoomLayers(addArchitectureBox(CORE_MIN_X,CORE_MAX_X,ROOM_H,UPPER_Y,CORE_DRESS_MIN_Z,FRONT_Z,cut),['landing']);
    const landingBack=new THREE.Mesh(new THREE.BoxGeometry(CORE_W,ROOM_H,0.10),landingWallMat);
    landingBack.position.set(0,UPPER_Y+ROOM_H/2,BACK_Z-0.05); landingBack.receiveShadow=true; houseGroup.add(landingBack); enableRoomLayers(landingBack,'landing');

    addBox(decorGroup,0,0.075,BACK_Z+0.015,CORE_W-0.08,0.15,0.035,'#f6f0e8',{castShadow:false,receiveShadow:true});
    addBox(decorGroup,0,UPPER_Y+0.075,CORE_DRESS_MIN_Z+0.015,CORE_W-0.08,0.15,0.035,'#f6f0e8',{castShadow:false,receiveShadow:true});

    // Slim separators with door openings into the side rooms.
    addDoorOpeningInXWall(CORE_MIN_X,0,-0.02,shell,trim,['living','hall']);
    addDoorOpeningInXWall(CORE_MAX_X,0,-0.02,shell,trim,['kitchen','hall']);
    addDoorOpeningInXWall(CORE_MIN_X,UPPER_Y,-0.02,shell,trim,['bedroom','landing']);
    addDoorOpeningInXWall(CORE_MAX_X,UPPER_Y,-0.02,shell,trim,['kids','landing']);

    // Rear dog-leg stair: lower flight runs back on the left, turns across a
    // half landing, then returns toward the front on the right.
    const stairMeshes=[];
    for(let i=0;i<STAIR.stepsPerFlight;i++){
      const z1=STAIR.frontZ-i*STAIR.going;
      const z0=z1-STAIR.going-0.006;
      const top=(i+1)*STAIR.rise;
      stairMeshes.push(addArchitectureBox(STAIR.leftX0,STAIR.leftX1,0,top,z0,z1,'#b99372'));
    }
    const halfLanding=addArchitectureBox(CORE_MIN_X+0.10,CORE_MAX_X-0.10,STAIR.midY-0.07,STAIR.midY,STAIR.landingBackZ,STAIR.flightBackZ,'#b99372');
    stairMeshes.push(halfLanding);
    for(let i=0;i<STAIR.stepsPerFlight;i++){
      const z0=STAIR.flightBackZ+i*STAIR.going;
      const z1=z0+STAIR.going+0.006;
      const top=STAIR.midY+(i+1)*STAIR.rise;
      stairMeshes.push(addArchitectureBox(STAIR.rightX0,STAIR.rightX1,STAIR.midY,top,z0,z1,'#b99372'));
    }
    stairMeshes.filter(Boolean).forEach(m=>enableRoomLayers(m,['hall','landing']));

    // Light, open balustrades rather than solid stair cheeks.
    const railCol='#7b685a';
    const postH=0.82;
    for(let i=0;i<=STAIR.stepsPerFlight;i+=2){
      const z=STAIR.frontZ-Math.min(i,STAIR.stepsPerFlight)*STAIR.going;
      const baseY=Math.min(STAIR.midY,(i+0.2)*STAIR.rise);
      const post=addCylinder(houseGroup,STAIR.leftX1+0.035,baseY,z,0.021,postH,railCol,{castShadow:true}); enableRoomLayers(post,['hall','landing']);
    }
    const lowerRail=addSoftPipe(houseGroup,[[STAIR.leftX1+0.035,postH,STAIR.frontZ],[STAIR.leftX1+0.035,STAIR.midY+postH,STAIR.flightBackZ]],0.028,railCol); enableRoomLayers(lowerRail,['hall','landing']);
    for(let i=0;i<=STAIR.stepsPerFlight;i+=2){
      const z=STAIR.flightBackZ+Math.min(i,STAIR.stepsPerFlight)*STAIR.going;
      const baseY=STAIR.midY+Math.min(STAIR.midY,(i+0.2)*STAIR.rise);
      const post=addCylinder(houseGroup,STAIR.rightX0-0.035,baseY,z,0.021,postH,railCol,{castShadow:true}); enableRoomLayers(post,['hall','landing']);
    }
    const upperRail=addSoftPipe(houseGroup,[[STAIR.rightX0-0.035,STAIR.midY+postH,STAIR.flightBackZ],[STAIR.rightX0-0.035,UPPER_Y+postH,STAIR.frontZ]],0.028,railCol); enableRoomLayers(upperRail,['hall','landing']);

    for(let x=CORE_MIN_X+0.16;x<=CORE_MAX_X-0.16;x+=0.32){
      const post=addCylinder(houseGroup,x,UPPER_Y,CORE_DRESS_MIN_Z-0.06,0.021,0.82,railCol,{castShadow:true}); enableRoomLayers(post,'landing');
    }
    const landingRail=addHorizontalRail(CORE_MIN_X+0.16,CORE_MAX_X-0.16,UPPER_Y+0.84,CORE_DRESS_MIN_Z-0.06); enableRoomLayers(landingRail,'landing');

    invalidateShadows();
  }

  function floorYForItem(item){
    const room=roomById(item.room),t=templateById(item.type);
    return t?.place==='ceiling' ? room.floorY + (Number(item.y)||CEILING_MOUNT_Y) : room.floorY;
  }

  function createItemGroup(item){
    const t=templateById(item.type);
    const group=new THREE.Group();
    group.userData.itemId=item.id;
    group.userData.itemType=item.type;
    group.userData.room=item.room;
    if(t.advancedModel==='bed-v1') buildAdvancedBed(group,item.id);
    else t.maker().forEach(p=>buildPrimitive(group,p,item.id));

    // Larger invisible hit target makes small objects much easier to select on touch screens.
    const bounds=new THREE.Box3().setFromObject(group);
    const size=bounds.getSize(new THREE.Vector3());
    const centre=bounds.getCenter(new THREE.Vector3());
    const minW=t.place==='surface'?0.44:(t.place==='wall'?0.52:0.25);
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
      if(!Number.isFinite(Number(item.lightLevel))) item.lightLevel=LAMP_DEFAULT_LEVEL;
      item.lightLevel=clamp(Number(item.lightLevel),0,LIGHT_LEVEL_MAX);
      if(typeof item.shadowEnabled!=='boolean')item.shadowEnabled=true;
      const distance=Number(t.lightDistance)||3.9;
      const isCeiling=t.place==='ceiling';
      if(isCeiling){
        const templateCone=Number(t.spotConeDeg)||(Number(t.spotAngle)?Number(t.spotAngle)*360:SPOT_CONE_DEFAULT_DEG);
        item.spotConeDeg=clamp(Number(item.spotConeDeg??templateCone),SPOT_CONE_MIN_DEG,SPOT_CONE_MAX_DEG);
      }
      const light=isCeiling
        ? new THREE.SpotLight(0xffc878,0,distance,THREE.MathUtils.degToRad(item.spotConeDeg/2),Number(t.spotPenumbra)||0.58,2)
        : new THREE.PointLight(0xffc878,0,distance,2);
      light.position.set(0,scaled(t.lightHeight),0);
      light.userData.itemId=item.id;
      light.userData.room=item.room;
      light.userData.lightKind=isCeiling?'ceiling-spot':'point';
      light.castShadow=false;
      if(isCeiling){
        const target=new THREE.Object3D();
        target.position.set(0,-2.25,0);
        target.userData.itemId=item.id;
        target.userData.room=item.room;
        group.add(target);
        light.target=target;
        light.shadow.mapSize.set(384,384);
      }else{
        // Point lights require six shadow renders, so keep their maps small.
        light.shadow.mapSize.set(256,256);
      }
      light.shadow.camera.near=0.06;
      light.shadow.camera.far=distance;
      light.shadow.bias=-0.0022;
      light.shadow.normalBias=0.042;
      light.shadow.autoUpdate=false;
      light.shadow.needsUpdate=true;
      group.add(light);
      localLights.push(light);
    }

    assignItemRoomLayer(group,item.room);
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
    const room=roomById(item.room),t=templateById(item.type);
    group.userData.room=item.room;
    if(t?.place==='wall'){
      item.supportId=null;
      if(group.parent!==itemRoot)itemRoot.attach(group);
      if(!Number.isFinite(Number(item.y)))item.y=1.45;
      clampWallItem(item);
      group.position.set(item.x,room.floorY+item.y,room.wallPlaneZ);
      group.rotation.set(0,0,0);
    }else if(t?.place==='ceiling'){
      item.supportId=null;
      if(group.parent!==itemRoot)itemRoot.attach(group);
      if(!Number.isFinite(Number(item.y)))item.y=CEILING_MOUNT_Y;
      clampCeilingItem(item);
      group.position.set(item.x,room.floorY+item.y,item.z);
      group.rotation.set(0,0,0);
    }else if(item.supportId && supportAnchors.has(item.supportId)){
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
    if(group)return group.getWorldPosition(new THREE.Vector3());
    const room=roomById(item.room),t=templateById(item.type);
    return t?.place==='wall' ? new THREE.Vector3(item.x,room.floorY+(item.y||1.45),room.wallPlaneZ) : t?.place==='ceiling' ? new THREE.Vector3(item.x,room.floorY+(item.y||CEILING_MOUNT_Y),item.z) : new THREE.Vector3(item.x,floorYForItem(item),item.z);
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

  function clampWallItem(item){
    const room=roomById(item.room),t=templateById(item.type);
    if(t?.place!=='wall')return;
    const size=t.wallSize||[1,0.8];
    const halfW=scaled(size[0])/2,halfH=scaled(size[1])/2;
    item.x=clamp(Number(item.x)||room.cx,room.minX+halfW+0.16,room.maxX-halfW-0.16);
    item.y=clamp(Number(item.y)||1.45,halfH+0.30,ROOM_H-halfH-0.18);
  }

  function clampCeilingItem(item){
    const room=roomById(item.room),t=templateById(item.type);
    const fw=scaled(t.footprint[0]),fd=scaled(t.footprint[1]);
    item.x=clamp(item.x,room.minX+fw/2+0.10,room.maxX-fw/2-0.10);
    const minZ=(room.placeMinZ??BACK_Z)+fd/2+0.10;
    const maxZ=(room.placeMaxZ??FRONT_Z)-fd/2-0.10;
    item.z=clamp(item.z,Math.min(minZ,maxZ),maxZ);
    item.y=CEILING_MOUNT_Y;
  }

  function clampFloorItem(item){
    if(item.supportId)return;
    const t=templateById(item.type);
    if(t?.place==='ceiling'){ clampCeilingItem(item); return; }
    const room=roomById(item.room);
    const fw=scaled(t.footprint[0]),fd=scaled(t.footprint[1]);
    const a=item.rot||0;
    const halfX=(Math.abs(Math.cos(a))*fw+Math.abs(Math.sin(a))*fd)/2;
    const halfZ=(Math.abs(Math.sin(a))*fw+Math.abs(Math.cos(a))*fd)/2;
    item.x=clamp(item.x,room.minX+halfX+0.08,room.maxX-halfX-0.08);
    const minZ=(room.placeMinZ??BACK_Z)+halfZ+0.10;
    const maxZ=(room.placeMaxZ??FRONT_Z)-halfZ-0.10;
    item.z=clamp(item.z,Math.min(minZ,maxZ),maxZ);
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
    let roomId;
    if(x>=CORE_MIN_X&&x<=CORE_MAX_X) roomId=upstairs?'landing':'hall';
    else roomId=upstairs?(x<CORE_MIN_X?'bedroom':'kids'):(x<CORE_MIN_X?'living':'kitchen');
    if(!force&&roomId===activeRoomId)return;
    activeRoomId=roomId;
    roomLabel.textContent=roomById(activeRoomId).name;
    buildSwatches(wallSwatches,wallPalette,'wall');
    buildSwatches(floorSwatches,floorPalette,'floor');
    buildWallpaperSwatches();
    buildFloorTextureSwatches();
    buildInventoryCategories();
    buildCarousel();
    updateLocalLightShadows();
  }

  function render(){
    updateCamera();
    if(selectionHelper)selectionHelper.update();
    const shadowRefresh=renderer.shadowMap.needsUpdate===true;
    const start=performance.now();
    renderer.render(scene,camera);
    const elapsed=performance.now()-start;
    renderSamples++;
    renderAverageMs=renderSamples===1?elapsed:(renderAverageMs*0.82+elapsed*0.18);
    if(perfBadge){
      const approxFps=Math.min(999,Math.round(1000/Math.max(0.5,elapsed)));
      const levels=currentLightingLevels();
      perfBadge.textContent=`${shadowRefresh?'Shadow':'Frame'} ${elapsed.toFixed(1)}ms · ~${approxFps}fps · ${activeShadowCount} local sh. · GI ${Math.round((levels.indirect||0)*100)}%`;
    }
  }

  function lampLevelFor(item){
    return clamp(Number(item?.lightLevel ?? LAMP_DEFAULT_LEVEL),0,LIGHT_LEVEL_MAX);
  }

  function spotConeDegreesFor(item,t=templateById(item?.type)){
    if(!item||t?.place!=='ceiling')return SPOT_CONE_DEFAULT_DEG;
    const templateCone=Number(t.spotConeDeg)||(Number(t.spotAngle)?Number(t.spotAngle)*360:SPOT_CONE_DEFAULT_DEG);
    return clamp(Number(item.spotConeDeg??templateCone),SPOT_CONE_MIN_DEG,SPOT_CONE_MAX_DEG);
  }

  function localLightForItem(itemId){
    return localLights.find(light=>light.userData.itemId===itemId)||null;
  }

  function currentLightingLevels(){
    const mode=state.lighting==='evening'?'evening':'day';
    state.lightingLevels ||= {};
    state.lightingLevels[mode] ||= {...LIGHTING_PRESETS[mode]};
    const levels=state.lightingLevels[mode];
    levels.direct=clamp(Number(levels.direct ?? LIGHTING_PRESETS[mode].direct),0,1);
    levels.ambient=clamp(Number(levels.ambient ?? LIGHTING_PRESETS[mode].ambient),0,1);
    levels.indirect=clamp(Number(levels.indirect ?? LIGHTING_PRESETS[mode].indirect),0,INDIRECT_LEVEL_MAX);
    return levels;
  }

  function updateGlobalLightPanel(){
    const levels=currentLightingLevels();
    const mode=state.lighting==='evening'?'Evening':'Day';
    if(globalLightMode)globalLightMode.textContent=`${mode} preset`;
    if(directLevel)directLevel.value=String(Math.round(levels.direct*100));
    if(directValue)directValue.textContent=`${Math.round(levels.direct*100)}%`;
    if(ambientLevel)ambientLevel.value=String(Math.round(levels.ambient*100));
    if(ambientValue)ambientValue.textContent=`${Math.round(levels.ambient*100)}%`;
    if(indirectLevel)indirectLevel.value=String(Math.round(levels.indirect*100));
    if(indirectValue)indirectValue.textContent=`${Math.round(levels.indirect*100)}%`;
  }

  function updateLocalLightShadows(){
    const evening=state.lighting==='evening';
    let count=0;
    localLights.forEach(light=>{
      const item=itemById(light.userData.itemId);
      const shouldCast=!!(evening&&item&&item.shadowEnabled!==false&&lampLevelFor(item)>0.04);
      if(light.castShadow!==shouldCast){
        light.castShadow=shouldCast;
        light.shadow.needsUpdate=true;
        renderer.shadowMap.needsUpdate=true;
      }
      if(shouldCast)count++;
    });
    activeShadowCount=count;
  }

  function updateLighting(){
    const evening=state.lighting==='evening';
    const levels=currentLightingLevels();

    // Direct light is the sun/moon-style directional source. Evening now
    // defaults to 0%, so artificial room lights can define the scene cleanly.
    sun.intensity=2.35*levels.direct;
    sun.color.set(evening?0xaab7d4:0xfff0d7);
    sun.castShadow=levels.direct>0.01;

    // Ambient control scales the non-directional sky/fill rig while preserving
    // warmer daytime and cooler evening colour character.
    hemi.intensity=(evening?1.22:1.55)*levels.ambient;
    hemi.color.set(evening?0xcbd3e5:0xfff7eb);
    hemi.groundColor.set(evening?0x575968:0x7f858d);
    eveningFill.intensity=evening?0.55*levels.ambient:0.0;

    localLights.forEach(light=>{
      const item=itemById(light.userData.itemId);
      const t=item&&templateById(item.type);
      light.intensity=evening?LAMP_MAX_INTENSITY*(t?.lightScale||1)*lampLevelFor(item):0;
    });
    updateIndirectLighting(levels, evening);
    updateLocalLightShadows();
    emissiveMeshes.forEach(mesh=>{
      if(!mesh.material||!('emissiveIntensity' in mesh.material))return;
      const item=itemById(mesh.userData.itemId);
      const t=item&&templateById(item.type);
      const level=t?.lightHeight?lampLevelFor(item):0.75;
      mesh.material.emissiveIntensity=evening?(0.04+0.62*level):0.04;
    });
    renderer.setClearColor(evening?0x777985:0xd9d0c7,1);
    scene.background.set(evening?0x777985:0xd9d0c7);
    updateLightingButton();
    updateGlobalLightPanel();
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

  function intersectRoomWall(p,room){
    setRayFromPoint(p);
    wallPlane.constant=-room.wallPlaneZ;
    return raycaster.ray.intersectPlane(wallPlane,new THREE.Vector3());
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
    updateLocalLightShadows();
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

    // The only gesture that directly moves furniture is one that starts on the
    // item that is already selected. Everything else begins as a tap-or-pan:
    // release without moving to select/deselect, or move to pan the house.
    if(picked&&picked.id===selectedId){
      const item=itemById(picked.id);
      const t=templateById(item.type);
      const wp=itemWorldPosition(item);
      if(t.place==='wall'){
        const hit=intersectRoomWall(p,roomById(item.room))||picked.point;
        gesture={mode:'item',pointerId:ev.pointerId,id:item.id,dx:wp.x-hit.x,dy:wp.y-hit.y,moved:false,armed:false,startX:p.x,startY:p.y};
        hint.textContent='Drag the selected picture around the wall';
      }else{
        const hit=intersectHorizontal(p,wp.y)||picked.point;
        gesture={mode:'item',pointerId:ev.pointerId,id:item.id,dx:wp.x-hit.x,dz:wp.z-hit.z,moved:false,armed:false,startX:p.x,startY:p.y};
        hint.textContent=t.place==='surface' ? 'Drag the selected detail onto a surface' : t.place==='ceiling' ? 'Drag the selected ceiling light across the room' : 'Drag the selected item into place';
      }
      return;
    }

    gesture={
      mode:'panSelect',
      pointerId:ev.pointerId,
      candidateId:picked?.id||null,
      startX:p.x,startY:p.y,
      startCamX:state.camera.x,startCamY:state.camera.y,
      moved:false
    };
    hint.textContent=picked?'Tap to select · drag to explore':'Drag to explore · tap empty space to deselect';
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
      if(gesture.startDist>4)state.camera.zoom=clamp(gesture.startZoom*(d/gesture.startDist),0.82,3.0);
      const mid=pointerMidpoint();
      if(mid&&gesture.startMid){
        const unitsPerPixel=5.4/(mid.h*Math.max(0.75,state.camera.zoom));
        state.camera.x=clamp(gesture.startCamX-(mid.x-gesture.startMid.x)*unitsPerPixel,HOUSE_MIN_X+0.65,HOUSE_MAX_X-0.65);
        state.camera.y=clamp(gesture.startCamY+(mid.y-gesture.startMid.y)*unitsPerPixel,0.85,HOUSE_H-0.35);
      }
      updateActiveRoom();
      render();
      return;
    }

    if(!gesture||gesture.pointerId!==ev.pointerId)return;

    if(gesture.mode==='panSelect'||gesture.mode==='pan'){
      const dx=p.x-gesture.startX,dy=p.y-gesture.startY;
      const distance=Math.hypot(dx,dy);
      if(distance<5&&!gesture.moved)return;
      gesture.mode='pan';
      gesture.moved=true;
      const unitsPerPixel=5.8/(p.h*Math.max(0.78,state.camera.zoom));
      state.camera.x=clamp(gesture.startCamX-dx*unitsPerPixel,HOUSE_MIN_X+0.65,HOUSE_MAX_X-0.65);
      state.camera.y=clamp(gesture.startCamY+dy*unitsPerPixel,0.85,HOUSE_H-0.35);
      updateActiveRoom();
      render();
      return;
    }

    if(gesture.mode==='item'){
      const distance=Math.hypot(p.x-gesture.startX,p.y-gesture.startY);
      if(!gesture.armed){
        if(distance<7)return;
        gesture.armed=true;
      }
      const item=itemById(gesture.id),group=item&&itemGroups.get(item.id);
      if(!item||!group)return;
      const t=templateById(item.type);
      const supportHit=pickSupport(p,item);

      if(t.place==='wall'){
        const room=roomById(item.room);
        const hit=intersectRoomWall(p,room);
        if(hit){
          item.x=hit.x+gesture.dx;
          item.y=hit.y+gesture.dy-room.floorY;
          clampWallItem(item);
          group.position.set(item.x,room.floorY+item.y,room.wallPlaneZ);
        }
      }else if(t.place==='surface'&&supportHit){
        if(item.supportId!==supportHit.supportId)attachToSupport(item,supportHit.supportId,supportHit.point);
        else{
          const anchor=supportAnchors.get(item.supportId);
          const local=anchor.worldToLocal(supportHit.point.clone());
          item.x=local.x; item.z=local.z;
          clampSupportedItem(item);
          group.position.set(item.x,0.012,item.z);
        }
      }else{
        const planeY=floorYForItem(item);
        const hit=intersectHorizontal(p,planeY);
        if(hit){
          if(item.supportId)detachFromSupportToFloor(item,hit);
          item.x=hit.x+gesture.dx; item.z=hit.z+gesture.dz;
          if(t.place==='ceiling') clampCeilingItem(item);
          else clampFloorItem(item);
          group.position.set(item.x,planeY,item.z);
        }
      }
      gesture.moved=true;
      invalidateShadows(item.room);
      if(selectionHelper)selectionHelper.update();
      updateSelection();
      render();
    }
  });

  function finishPointer(ev){
    pointers.delete(ev.pointerId);
    if(gesture&&gesture.mode==='pinch'&&pointers.size===1){ gesture=null; }
    else if(pointers.size===0){
      if(gesture?.mode==='pan'){
        if(gesture.moved)save();
      }else if(gesture?.mode==='panSelect'){
        // No meaningful movement: this was a tap, so select the touched item
        // (or deselect on the background). Selection happens on release.
        selectItem(gesture.candidateId||null);
      }else if(gesture?.mode==='item'&&gesture.moved){
        save();
      }
      gesture=null;
      hint.textContent='Tap selects · selected item moves · other drags explore';
    }
  }
  canvas.addEventListener('pointerup',finishPointer);
  canvas.addEventListener('pointercancel',finishPointer);

  rotateBtn.addEventListener('click',()=>{
    const item=itemById(selectedId); if(!item)return;
    const t=templateById(item.type);
    if(t?.canRotate===false||t?.place==='wall')return;
    item.rot=(item.rot||0)+Math.PI/2;
    const group=itemGroups.get(item.id); if(group)group.rotation.y=item.rot;
    if(item.supportId)clampSupportedItem(item); else clampFloorItem(item);
    placeItemGroup(item); save(); invalidateShadows(item.room); updateSelectionHelper(); render();
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
    invalidateShadows();
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

  function setGlobalLightPanelOpen(open){
    if(!globalLightPanel)return;
    globalLightPanel.hidden=!open;
    lightingPanelBtn?.setAttribute('aria-expanded',String(open));
    lightingPanelBtn?.setAttribute('aria-label',open?'Close scene lighting controls':'Open scene lighting controls');
    if(open)updateGlobalLightPanel();
  }

  lightingPanelBtn?.addEventListener('click',()=>setGlobalLightPanelOpen(globalLightPanel?.hidden!==false));
  globalLightClose?.addEventListener('click',()=>setGlobalLightPanelOpen(false));

  directLevel?.addEventListener('input',()=>{
    const levels=currentLightingLevels();
    levels.direct=clamp(Number(directLevel.value)/100,0,1);
    if(directValue)directValue.textContent=`${Math.round(levels.direct*100)}%`;
    invalidateShadows(null,true);
    updateLighting();
  });
  directLevel?.addEventListener('change',save);

  ambientLevel?.addEventListener('input',()=>{
    const levels=currentLightingLevels();
    levels.ambient=clamp(Number(ambientLevel.value)/100,0,1);
    if(ambientValue)ambientValue.textContent=`${Math.round(levels.ambient*100)}%`;
    updateLighting();
  });
  ambientLevel?.addEventListener('change',save);

  indirectLevel?.addEventListener('input',()=>{
    const levels=currentLightingLevels();
    levels.indirect=clamp(Number(indirectLevel.value)/100,0,INDIRECT_LEVEL_MAX);
    if(indirectValue)indirectValue.textContent=`${Math.round(levels.indirect*100)}%`;
    updateLighting();
  });
  indirectLevel?.addEventListener('change',save);

  globalLightReset?.addEventListener('click',()=>{
    const mode=state.lighting==='evening'?'evening':'day';
    state.lightingLevels[mode]={...LIGHTING_PRESETS[mode]};
    invalidateShadows(null,true);
    updateLighting();
    save();
  });

  lightLevel?.addEventListener('input',()=>{
    const item=itemById(selectedId),t=item&&templateById(item.type);
    if(!item||!t?.lightHeight)return;
    item.lightLevel=clamp(Number(lightLevel.value)/100,0,LIGHT_LEVEL_MAX);
    if(lightValue)lightValue.textContent=`${Math.round(item.lightLevel*100)}%`;
    updateLighting();
  });
  lightLevel?.addEventListener('change',save);

  spotAngleLevel?.addEventListener('input',()=>{
    const item=itemById(selectedId),t=item&&templateById(item.type);
    if(!item||t?.place!=='ceiling')return;
    item.spotConeDeg=clamp(Number(spotAngleLevel.value),SPOT_CONE_MIN_DEG,SPOT_CONE_MAX_DEG);
    if(spotAngleValue)spotAngleValue.textContent=`${Math.round(item.spotConeDeg)}°`;
    const light=localLightForItem(item.id);
    if(light?.isSpotLight){
      light.angle=THREE.MathUtils.degToRad(item.spotConeDeg/2);
      light.shadow.needsUpdate=true;
      renderer.shadowMap.needsUpdate=true;
    }
    render();
  });
  spotAngleLevel?.addEventListener('change',save);

  lightShadowBtn?.addEventListener('click',()=>{
    const item=itemById(selectedId),t=item&&templateById(item.type);
    if(!item||!t?.lightHeight)return;
    item.shadowEnabled=item.shadowEnabled===false;
    updateSelection();
    updateLocalLightShadows();
    save();render();
  });

  prevBtn.addEventListener('click',()=>carousel.scrollBy({left:-carousel.clientWidth*0.72,behavior:'smooth'}));
  nextBtn.addEventListener('click',()=>carousel.scrollBy({left:carousel.clientWidth*0.72,behavior:'smooth'}));

  function addItem(type){
    const t=templateById(type),room=roomById(activeRoomId); if(!t)return;
    if(t.place==='wall'&&room.allowWall===false){
      hint.textContent='Hall and landing wall placement comes next · use floor furniture and lights here for now';
      return;
    }
    if(room.core&&t.place!=='wall'&&t.place!=='surface'){
      const usableW=room.width-0.18;
      const usableD=(room.placeMaxZ-room.placeMinZ)-0.18;
      if(scaled(t.footprint[0])>usableW||scaled(t.footprint[1])>usableD){
        hint.textContent=`${t.name} is too large for this ${room.name.toLowerCase()}`;
        return;
      }
    }
    const count=state.items.filter(i=>i.room===room.id).length;
    const zMid=((room.placeMinZ??BACK_Z)+(room.placeMaxZ??FRONT_Z))/2;
    const item={id:`item-${Date.now()}-${idCounter++}`,type,room:room.id,x:room.cx+((count%3)-1)*0.20,z:zMid+((count%2)?0.14:-0.10),rot:0};
    if(t.lightHeight){item.lightLevel=LAMP_DEFAULT_LEVEL;item.shadowEnabled=true;}
    if(t.place==='wall'){
      item.x=room.cx;item.y=1.48;item.z=0;
      clampWallItem(item);
    }else if(t.place==='ceiling'){
      item.x=room.cx; item.y=CEILING_MOUNT_Y; item.z=zMid;
      clampCeilingItem(item);
    }else if(t.place==='surface'){
      const support=state.items.find(s=>s.room===room.id&&templateById(s.type)?.supportHeight);
      if(support){item.supportId=support.id;item.x=0;item.z=0;}
    }
    if(t.place!=='wall'&&t.place!=='ceiling'&&!item.supportId)clampFloorItem(item);
    state.items.push(item);
    const group=createItemGroup(item);itemRoot.add(group);placeItemGroup(item);invalidateShadows(room.id);updateLighting();
    selectItem(item.id);save();
    hint.textContent=t.place==='wall' ? `Hang the ${t.name.toLowerCase()} where you like` : t.place==='ceiling' ? `Slide the ${t.name.toLowerCase()} across the ceiling` : t.place==='surface' ? (item.supportId?'Added to a surface · drag to fine tune':'Drag onto a table or drawers') : `Drag the ${t.name.toLowerCase()} into place`;
  }

  function buildInventoryCategories(){
    if(!categoryRow)return;
    const roomName=roomSetName(activeRoomId);
    if(inventoryTitle)inventoryTitle.textContent=`${roomName.toUpperCase()} SET`;
    if(inventorySubtitle)inventorySubtitle.textContent='Choose a category';
    const categories=availableCategories(activeRoomId);
    if(!categories.includes(activeInventoryCategory))activeInventoryCategory=categories[0]||null;
    categoryRow.innerHTML='';
    categories.forEach(cat=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='room-category-chip';
      btn.textContent=INVENTORY_CATEGORIES[cat]||cat;
      btn.setAttribute('aria-pressed',String(activeInventoryCategory===cat));
      if(activeInventoryCategory===cat)btn.classList.add('active');
      btn.addEventListener('click',()=>{
        activeInventoryCategory=cat;
        buildInventoryCategories();
        buildCarousel();
      });
      categoryRow.appendChild(btn);
    });
  }

  function buildCarousel(){
    carousel.innerHTML='';
    const visible=filteredTemplates(activeRoomId,activeInventoryCategory);
    visible.forEach(t=>{
      const b=document.createElement('button');b.type='button';b.className='room-item-card';
      b.innerHTML=`<span class="room-item-glyph" style="--room-item-colour:${t.colour}">${t.glyph}</span><strong>${t.name}</strong><small>${t.place==='wall'?'Hang':(t.place==='surface'?'Place':(t.place==='ceiling'?'Ceiling':'Add'))}</small>`;
      b.addEventListener('click',()=>addItem(t.id));carousel.appendChild(b);
    });
    if(!visible.length){
      const empty=document.createElement('div');
      empty.className='room-carousel-empty';
      empty.textContent='Nothing in this category yet';
      carousel.appendChild(empty);
    }
  }

  function buildSwatches(holder,palette,key){
    if(!holder)return;
    const style=state.rooms[activeRoomId]; holder.innerHTML='';
    palette.forEach(col=>{
      const b=document.createElement('button');b.type='button';b.className='room-swatch';b.style.background=col;b.setAttribute('aria-label',`${key} colour ${col}`);
      if(style[key]===col)b.classList.add('active');
      b.addEventListener('click',()=>{
        style[key]=col;
        const mat=roomMaterials.get(`${activeRoomId}:${key}`);
        if(key==='wall')applyRoomWallFinish(activeRoomId);
        else if(key==='floor')applyRoomFloorFinish(activeRoomId);
        else if(mat)mat.color.set(col);
        [...holder.children].forEach(x=>x.classList.toggle('active',x===b));save();render();
      });
      holder.appendChild(b);
    });
  }

  function buildWallpaperSwatches(){
    if(!wallpaperSwatches)return;
    const style=state.rooms[activeRoomId];
    wallpaperSwatches.innerHTML='';
    wallpaperPatterns.forEach(pattern=>{
      const b=document.createElement('button');
      b.type='button';b.className='room-pattern-swatch';
      b.dataset.pattern=pattern.id;b.setAttribute('aria-label',pattern.name);b.title=pattern.name;
      if(pattern.id==='stripe')b.style.backgroundImage='repeating-linear-gradient(90deg,#f8f3ed 0 8px,#d9d3cc 8px 12px)';
      else if(pattern.id==='dot')b.style.backgroundImage='radial-gradient(circle at 30% 30%,#cfc8bf 0 3px,transparent 4px),radial-gradient(circle at 72% 68%,#cfc8bf 0 3px,transparent 4px)';
      else if(pattern.id==='stars')b.style.background='linear-gradient(#dbe5ee,#dbe5ee)', b.style.backgroundImage='radial-gradient(circle at 20% 28%,#f6edd7 0 3px,transparent 4px),radial-gradient(circle at 55% 24%,#f6edd7 0 3px,transparent 4px),radial-gradient(circle at 78% 52%,#f6edd7 0 3px,transparent 4px),radial-gradient(circle at 36% 74%,#f6edd7 0 3px,transparent 4px)';
      else if(pattern.id==='arch')b.style.backgroundImage='radial-gradient(ellipse at 50% 72%,transparent 0 9px,#d2cbc3 10px 12px,transparent 13px)';
      else if(pattern.id==='sprig')b.style.backgroundImage='radial-gradient(ellipse at 35% 40%,#c9d0c6 0 4px,transparent 5px),radial-gradient(ellipse at 65% 62%,#c9d0c6 0 4px,transparent 5px)';
      else if(pattern.id==='clouds')b.style.backgroundImage='linear-gradient(#dbe5ee,#dbe5ee),radial-gradient(circle at 32% 36%,#f5f0df 0 5px,transparent 6px),radial-gradient(circle at 46% 38%,#f5f0df 0 5px,transparent 6px),radial-gradient(circle at 67% 66%,#f5f0df 0 5px,transparent 6px)';
      else b.textContent='—';
      if((style.wallpaper||'plain')===pattern.id)b.classList.add('active');
      b.addEventListener('click',()=>{
        style.wallpaper=pattern.id;
        applyRoomWallFinish(activeRoomId);
        [...wallpaperSwatches.children].forEach(x=>x.classList.toggle('active',x===b));
        save();render();
      });
      wallpaperSwatches.appendChild(b);
    });
  }

  function buildFloorTextureSwatches(){
    if(!floorTextureSwatches)return;
    const style=state.rooms[activeRoomId];
    floorTextureSwatches.innerHTML='';
    floorTexturePatterns.forEach(pattern=>{
      const b=document.createElement('button');
      b.type='button';b.className='room-pattern-swatch';
      b.dataset.pattern=pattern.id;b.setAttribute('aria-label',pattern.name);b.title=pattern.name;
      if(pattern.id==='plank')b.style.backgroundImage='repeating-linear-gradient(90deg,#e6dccf 0 11px,#cdbca6 11px 13px)';
      else if(pattern.id==='herringbone')b.style.backgroundImage='repeating-linear-gradient(45deg,#e5d8c7 0 8px,#cdbca6 8px 10px,#ede3d7 10px 18px,#cdbca6 18px 20px)';
      else if(pattern.id==='tile')b.style.backgroundImage='linear-gradient(#d0cbc5 2px,transparent 2px),linear-gradient(90deg,#d0cbc5 2px,transparent 2px)';
      else if(pattern.id==='checker')b.style.backgroundImage='linear-gradient(45deg,#e9dfd0 25%,transparent 25%,transparent 75%,#e9dfd0 75%),linear-gradient(45deg,#d8cec0 25%,transparent 25%,transparent 75%,#d8cec0 75%)';
      else if(pattern.id==='carpet')b.style.backgroundImage='repeating-linear-gradient(0deg,#e9dcc8 0 6px,#e4d4c0 6px 7px),repeating-linear-gradient(90deg,#e9dcc8 0 6px,#deccb7 6px 7px)';
      else b.textContent='—';
      if((style.floorTexture||'plain')===pattern.id)b.classList.add('active');
      b.addEventListener('click',()=>{
        style.floorTexture=pattern.id;
        applyRoomFloorFinish(activeRoomId);
        [...floorTextureSwatches.children].forEach(x=>x.classList.toggle('active',x===b));
        save();render();
      });
      floorTextureSwatches.appendChild(b);
    });
  }

  function updateSelection(){
    const item=itemById(selectedId),t=item&&templateById(item.type),support=item&&item.supportId&&itemById(item.supportId);
    selectedName.textContent=t?`${t.name}${support?` · on ${templateById(support.type).name}`:''}`:'Nothing selected';
    rotateBtn.disabled=!item||t?.canRotate===false||t?.place==='wall'||t?.place==='ceiling';removeBtn.disabled=!item;
    const isLamp=!!(item&&t?.lightHeight);
    if(lightControl)lightControl.hidden=!isLamp;
    const isSpot=!!(isLamp&&t?.place==='ceiling');
    if(spotAngleControl)spotAngleControl.hidden=!isSpot;
    if(isLamp&&lightLevel&&lightValue){
      const pct=Math.round(lampLevelFor(item)*100);
      lightLevel.value=String(pct);
      lightValue.textContent=`${pct}%`;
      if(isSpot&&spotAngleLevel&&spotAngleValue){
        const cone=Math.round(spotConeDegreesFor(item,t));
        spotAngleLevel.value=String(cone);
        spotAngleValue.textContent=`${cone}°`;
      }
      if(lightShadowBtn){
        const enabled=item.shadowEnabled!==false;
        lightShadowBtn.textContent=enabled?'SHADOWS ON':'SHADOWS OFF';
        lightShadowBtn.setAttribute('aria-pressed',String(enabled));
        lightShadowBtn.classList.toggle('off',!enabled);
      }
    }
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
      const roomState=Object.fromEntries(rooms.map(r=>[r.id,{wall:r.wall,floor:r.floor,wallpaper:r.wallpaper,floorTexture:r.floorTexture}]));
      rooms.forEach(r=>{
        if(parsed.rooms&&parsed.rooms[r.id]){
          roomState[r.id].wall=parsed.rooms[r.id].wall||r.wall;
          roomState[r.id].floor=parsed.rooms[r.id].floor||r.floor;
          const wp=parsed.rooms[r.id].wallpaper;
          roomState[r.id].wallpaper=wallpaperPatterns.some(p=>p.id===wp)?wp:r.wallpaper;
          const ft=parsed.rooms[r.id].floorTexture;
          roomState[r.id].floorTexture=floorTexturePatterns.some(p=>p.id===ft)?ft:r.floorTexture;
        }
      });
      const parsedLevels=parsed.lightingLevels||{};
      const lightingLevels={
        day:{
          direct:clamp(Number(parsedLevels.day?.direct ?? LIGHTING_PRESETS.day.direct),0,1),
          ambient:clamp(Number(parsedLevels.day?.ambient ?? LIGHTING_PRESETS.day.ambient),0,1),
          indirect:clamp(Number(parsedLevels.day?.indirect ?? LIGHTING_PRESETS.day.indirect),0,INDIRECT_LEVEL_MAX)
        },
        evening:{
          direct:clamp(Number(parsedLevels.evening?.direct ?? LIGHTING_PRESETS.evening.direct),0,1),
          ambient:clamp(Number(parsedLevels.evening?.ambient ?? LIGHTING_PRESETS.evening.ambient),0,1),
          indirect:clamp(Number(parsedLevels.evening?.indirect ?? LIGHTING_PRESETS.evening.indirect),0,INDIRECT_LEVEL_MAX)
        }
      };
      state={
        lighting:parsed.lighting==='evening'?'evening':'day', lightingLevels, rooms:roomState,
        items:parsed.items.filter(i=>templateById(i.type)&&rooms.some(r=>r.id===i.room)).slice(0,120),
        camera:{
          x:clamp(Number(parsed.camera?.x)||-3.30,HOUSE_MIN_X+0.65,HOUSE_MAX_X-0.65),
          y:clamp(Number(parsed.camera?.y)||1.2,0.85,HOUSE_H-0.35),
          zoom:clamp(Number(parsed.camera?.zoom)||1.24,0.82,3.0)
        }
      };
      validateSupports();
      state.items.forEach(i=>{
        const t=templateById(i.type);
        if(t?.lightHeight){
          i.lightLevel=clamp(Number(i.lightLevel??LAMP_DEFAULT_LEVEL),0,LIGHT_LEVEL_MAX);
          if(typeof i.shadowEnabled!=='boolean')i.shadowEnabled=true;
          if(t?.place==='ceiling')i.spotConeDeg=spotConeDegreesFor(i,t);
        }
        if(t?.place==='wall')clampWallItem(i);
        else if(t?.place==='ceiling')clampCeilingItem(i);
        else if(!i.supportId)clampFloorItem(i);
      });
    }catch{}
  }

  function resizeRenderer(){
    const r=canvas.getBoundingClientRect();if(!r.width)return;
    const cssW=r.width;
    const viewportH=Math.max(640,window.innerHeight||800);
    const cssH=Math.max(248,Math.min(468,cssW*0.80,viewportH*0.34));
    canvas.style.height=`${cssH}px`;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    renderer.setSize(cssW,cssH,false);
    camera.aspect=cssW/cssH;
    camera.updateProjectionMatrix();
    render();
  }
  function queueResize(){cancelAnimationFrame(resizeRaf);resizeRaf=requestAnimationFrame(resizeRenderer);}

  load();
  validateSupports();
  state.items.forEach(i=>{
    const t=templateById(i.type);
    if(t?.lightHeight){
      i.lightLevel=clamp(Number(i.lightLevel??LAMP_DEFAULT_LEVEL),0,LIGHT_LEVEL_MAX);
      if(typeof i.shadowEnabled!=='boolean')i.shadowEnabled=true;
      if(t?.place==='ceiling')i.spotConeDeg=spotConeDegreesFor(i,t);
    }
    if(t?.place==='wall')clampWallItem(i);
    else if(t?.place==='ceiling')clampCeilingItem(i);
    else if(!i.supportId)clampFloorItem(i);
  });
  buildArchitecture();
  rebuildItems();
  buildCarousel();
  updateActiveRoom(true);
  updateSelection();
  updateLighting();
  hint.textContent='Tap selects · selected item moves · other drags explore';
  window.addEventListener('resize',queueResize,{passive:true});
  if('ResizeObserver' in window)new ResizeObserver(queueResize).observe(canvas.parentElement);
  queueResize();
})();
