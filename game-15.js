(() => {
  'use strict';

  const canvas = document.getElementById('room-canvas');
  const ctx = canvas && canvas.getContext('2d', { alpha: false });
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

  if (!canvas || !ctx) return;

  const STORAGE_KEY = 'gamehub-my-house-v3';
  const TAU = Math.PI * 2;
  const ROOM_W = 8.0;
  const ROOM_D = 4.8;
  const ROOM_H = 4.4;
  const SLAB_H = 0.38;
  const UPPER_Y = ROOM_H + SLAB_H;
  const FRONT_Z = 2.20;
  const BACK_Z = FRONT_Z - ROOM_D;
  const HOUSE_MIN_X = -ROOM_W;
  const HOUSE_MAX_X = ROOM_W;
  const HOUSE_TOP = UPPER_Y + ROOM_H;
  const WALL_T = 0.28;
  const DOOR_Z = 0.10;
  const DOOR_D = 1.55;
  const DOOR_H = 2.62;
  const STAIR = { minX:-3.25, maxX:-1.05, minZ:-1.0, maxZ:1.86, x:-2.15 };

  const wallPalette = ['#f1dfd6', '#eadcc9', '#d8e6dc', '#dbe3ef', '#ead9e5', '#efe5bf'];
  const floorPalette = ['#c8a883', '#b9906c', '#d2c3ae', '#9ca99c', '#b4a297', '#c9b596'];

  const rooms = [
    { id:'bedroom', name:'Bedroom', cx:-4.0, floorY:UPPER_Y, wall:wallPalette[0], floor:floorPalette[0], decor:'window' },
    { id:'studio', name:'Studio', cx:4.0, floorY:UPPER_Y, wall:wallPalette[1], floor:floorPalette[2], decor:'gallery' },
    { id:'play', name:'Play room', cx:-4.0, floorY:0, wall:wallPalette[3], floor:floorPalette[4], decor:'stars' },
    { id:'living', name:'Living room', cx:4.0, floorY:0, wall:wallPalette[2], floor:floorPalette[0], decor:'living' }
  ];

  rooms.forEach(r => {
    r.minX = r.cx - ROOM_W / 2;
    r.maxX = r.cx + ROOM_W / 2;
    r.backZ = BACK_Z;
    r.frontZ = FRONT_Z;
  });

  function v3(x=0,y=0,z=0){ return {x,y,z}; }
  function add(a,b){ return v3(a.x+b.x,a.y+b.y,a.z+b.z); }
  function sub(a,b){ return v3(a.x-b.x,a.y-b.y,a.z-b.z); }
  function mul(a,s){ return v3(a.x*s,a.y*s,a.z*s); }
  function dot(a,b){ return a.x*b.x+a.y*b.y+a.z*b.z; }
  function cross(a,b){ return v3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x); }
  function len(a){ return Math.hypot(a.x,a.y,a.z) || 1; }
  function norm(a){ const l=len(a); return v3(a.x/l,a.y/l,a.z/l); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function shade(hex, amount){
    const c=hex.replace('#','');
    const n=parseInt(c,16);
    let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    const target=amount<0?0:255;
    const p=Math.min(1,Math.abs(amount));
    r=Math.round((target-r)*p+r);
    g=Math.round((target-g)*p+g);
    b=Math.round((target-b)*p+b);
    return `rgb(${r},${g},${b})`;
  }

  function box(x,y,z,w,h,d,color,opts={}){ return {kind:'box',x,y,z,w,h,d,color,...opts}; }
  function cyl(x,y,z,r,h,color,opts={}){ return {kind:'cyl',x,y,z,r,h,color,...opts}; }
  function ellipsoid(x,y,z,rx,ry,rz,color,opts={}){ return {kind:'ellipsoid',x,y,z,rx,ry,rz,color,...opts}; }

  // ---------- Character furniture -------------------------------------------------

  function makeCloudBed(){
    return [
      box(0,0.18,0,2.95,0.36,3.28,'#a67d65'),
      box(0,0.48,0,2.78,0.34,3.04,'#f7efe7'),
      ellipsoid(0,0.71,0.25,1.37,0.16,1.28,'#dca09b'),
      ellipsoid(-0.70,0.86,-0.89,0.63,0.18,0.43,'#fffaf4'),
      ellipsoid(0.60,0.86,-0.89,0.63,0.18,0.43,'#fffaf4'),
      box(0,1.22,-1.54,2.84,1.42,0.16,'#b88c75'),
      ellipsoid(-0.82,1.78,-1.43,0.72,0.56,0.18,'#f2d7d1'),
      ellipsoid(0,1.96,-1.43,0.88,0.72,0.18,'#f2d7d1'),
      ellipsoid(0.82,1.78,-1.43,0.72,0.56,0.18,'#f2d7d1'),
      ellipsoid(-0.73,0.77,0.43,0.12,0.045,0.12,'#eac77f'),
      ellipsoid(-0.37,0.77,0.10,0.12,0.045,0.12,'#8fa99e'),
      ellipsoid(0.02,0.77,0.47,0.12,0.045,0.12,'#c97e7d'),
      ellipsoid(0.40,0.77,0.05,0.12,0.045,0.12,'#eac77f'),
      ellipsoid(0.76,0.77,0.43,0.12,0.045,0.12,'#8fa99e')
    ];
  }

  function makeScallopSofa(){
    const teal='#789aa2', teal2='#91b0b4', seat='#aec5c6', wood='#7d6251';
    return [
      cyl(-1.28,0,-0.38,0.10,0.36,wood), cyl(1.28,0,-0.38,0.10,0.36,wood),
      cyl(-1.28,0,0.43,0.10,0.36,wood), cyl(1.28,0,0.43,0.10,0.36,wood),
      ellipsoid(0,0.48,0,1.66,0.35,0.78,teal),
      ellipsoid(-0.92,0.72,0.13,0.55,0.20,0.60,seat),
      ellipsoid(0,0.72,0.13,0.55,0.20,0.60,seat),
      ellipsoid(0.92,0.72,0.13,0.55,0.20,0.60,seat),
      ellipsoid(-0.95,1.40,-0.44,0.62,0.72,0.27,teal2),
      ellipsoid(0,1.53,-0.46,0.67,0.79,0.27,teal2),
      ellipsoid(0.95,1.40,-0.44,0.62,0.72,0.27,teal2),
      ellipsoid(-1.55,0.93,0.02,0.30,0.48,0.69,teal),
      ellipsoid(1.55,0.93,0.02,0.30,0.48,0.69,teal),
      ellipsoid(-0.52,1.05,-0.02,0.37,0.30,0.17,'#e8ba78',{rot:-0.17}),
      ellipsoid(0.62,1.08,-0.04,0.36,0.30,0.17,'#d9958f',{rot:0.18})
    ];
  }

  function makePetalChair(){
    const coral='#d48e87', light='#e5aaa1', wood='#7e6250';
    return [
      cyl(-0.46,0,-0.30,0.09,0.35,wood), cyl(0.46,0,-0.30,0.09,0.35,wood),
      cyl(-0.46,0,0.34,0.09,0.35,wood), cyl(0.46,0,0.34,0.09,0.35,wood),
      ellipsoid(0,0.52,0,0.86,0.31,0.72,coral),
      ellipsoid(0,0.74,0.10,0.63,0.18,0.54,'#f0c0b8'),
      ellipsoid(-0.47,1.24,-0.43,0.50,0.66,0.24,light,{rot:-0.12}),
      ellipsoid(0,1.44,-0.48,0.54,0.78,0.25,light),
      ellipsoid(0.47,1.24,-0.43,0.50,0.66,0.24,light,{rot:0.12}),
      ellipsoid(-0.73,0.87,0.05,0.21,0.40,0.60,coral),
      ellipsoid(0.73,0.87,0.05,0.21,0.40,0.60,coral)
    ];
  }

  function makePebbleCoffeeTable(){
    const top='#caa27e', rim='#a97f61', leg='#8b6b55';
    return [
      cyl(-0.78,0,-0.34,0.12,0.80,leg,{taper:0.72}),
      cyl(0.76,0,-0.30,0.12,0.80,leg,{taper:0.72}),
      cyl(-0.30,0,0.42,0.11,0.80,leg,{taper:0.72}),
      ellipsoid(0,0.86,0,1.32,0.14,0.78,rim),
      ellipsoid(-0.10,0.96,0.02,1.27,0.10,0.73,top)
    ];
  }

  function makeGlowLamp(){
    return [
      ellipsoid(0,0.13,0,0.50,0.13,0.50,'#8a6d5d'),
      ellipsoid(0,0.38,0,0.34,0.30,0.34,'#b58068'),
      cyl(0,0.57,0,0.075,0.78,'#876d5e'),
      cyl(0,1.29,0,0.58,0.58,'#e8bd76',{taper:0.66,emissive:true}),
      ellipsoid(0,1.27,0,0.60,0.11,0.60,'#d7a85f',{emissive:true}),
      ellipsoid(0,1.86,0,0.40,0.08,0.40,'#f2d08d',{emissive:true})
    ];
  }

  function makeSunburstRug(){
    const parts=[ellipsoid(0,0.045,0,2.02,0.045,1.40,'#d8b384')];
    parts.push(ellipsoid(0,0.052,0,1.74,0.035,1.15,'#ead8b4'));
    const colours=['#d98f83','#7f9e91','#d8b36a'];
    for(let i=0;i<10;i++){
      const a=TAU*i/10;
      parts.push(ellipsoid(Math.cos(a)*1.17,0.060,Math.sin(a)*0.74,0.19,0.025,0.14,colours[i%3],{rot:-a}));
    }
    parts.push(ellipsoid(0,0.063,0,0.35,0.026,0.28,'#d99a8f'));
    return parts;
  }

  function makeBubbleDrawers(){
    const wood='#bd9875';
    return [
      box(0,0.76,0,2.18,1.52,0.92,wood),
      ellipsoid(0,1.55,0,1.16,0.13,0.54,'#d1ad89'),
      box(0,1.18,0.474,1.86,0.38,0.04,'#c8a17d'),
      box(0,0.74,0.474,1.86,0.38,0.04,'#c8a17d'),
      box(0,0.30,0.474,1.86,0.38,0.04,'#c8a17d'),
      ellipsoid(0,1.18,0.52,0.12,0.12,0.08,'#769687'),
      ellipsoid(0,0.74,0.52,0.12,0.12,0.08,'#d88d83'),
      ellipsoid(0,0.30,0.52,0.12,0.12,0.08,'#dcb86f')
    ];
  }

  function makeArchedWardrobe(){
    return [
      box(0,1.43,0,2.12,2.86,1.02,'#9d826e'),
      ellipsoid(0,2.84,0,1.06,0.46,0.51,'#9d826e'),
      box(-0.52,1.42,0.525,0.93,2.56,0.05,'#ae9078'),
      box(0.52,1.42,0.525,0.93,2.56,0.05,'#ae9078'),
      box(0,1.42,0.56,0.05,2.52,0.03,'#806b5b'),
      ellipsoid(-0.15,1.43,0.61,0.09,0.09,0.07,'#e3bd77'),
      ellipsoid(0.15,1.43,0.61,0.09,0.09,0.07,'#e3bd77')
    ];
  }

  function makeBunnyBox(){
    return [
      box(0,0.42,0,1.78,0.84,1.04,'#8eb1b2'),
      ellipsoid(0,0.91,0,0.90,0.18,0.55,'#a5c3c3'),
      ellipsoid(-0.36,1.21,0.16,0.18,0.40,0.15,'#a5c3c3'),
      ellipsoid(0.36,1.21,0.16,0.18,0.40,0.15,'#a5c3c3'),
      ellipsoid(-0.24,0.52,0.55,0.07,0.08,0.04,'#334744'),
      ellipsoid(0.24,0.52,0.55,0.07,0.08,0.04,'#334744'),
      ellipsoid(0,0.37,0.56,0.09,0.07,0.04,'#d78c8c')
    ];
  }

  function makeSproutPlant(){
    return [
      cyl(0,0,0,0.48,0.58,'#bb8266',{taper:0.78}),
      cyl(0,0.58,0,0.08,0.92,'#5e8068'),
      ellipsoid(-0.32,1.15,0.03,0.36,0.22,0.18,'#77a27c',{rot:-0.35}),
      ellipsoid(0.34,1.35,-0.04,0.38,0.24,0.19,'#6e9674',{rot:0.30}),
      ellipsoid(-0.06,1.55,0.12,0.34,0.26,0.18,'#85ad83'),
      ellipsoid(0.08,1.07,-0.16,0.34,0.20,0.16,'#658b6c',{rot:0.58})
    ];
  }

  function makeBeanbag(){
    return [
      ellipsoid(0,0.48,0,0.92,0.54,0.90,'#d08d82'),
      ellipsoid(-0.22,0.78,-0.12,0.58,0.37,0.60,'#dc9f94')
    ];
  }

  // Small dressing objects. These can snap to supporting furniture.
  function makeBookStack(){
    return [
      box(0,0.045,0,0.72,0.09,0.48,'#7896a2',{rot:-0.08}),
      box(0.04,0.135,0.01,0.68,0.09,0.45,'#e1a06f',{rot:0.07}),
      box(-0.04,0.225,-0.01,0.64,0.09,0.42,'#b88083',{rot:-0.03}),
      box(-0.27,0.225,0.205,0.05,0.09,0.42,'#f2d7b1',{rot:-0.03})
    ];
  }

  function makeMug(){
    return [
      cyl(0,0,0,0.22,0.36,'#e9d7b7',{taper:0.90}),
      ellipsoid(0,0.36,0,0.21,0.045,0.21,'#6f574a'),
      ellipsoid(0.25,0.20,0,0.16,0.14,0.08,'#e9d7b7'),
      ellipsoid(0.27,0.20,0,0.08,0.075,0.085,'#6f574a')
    ];
  }

  function makeVase(){
    return [
      ellipsoid(0,0.18,0,0.28,0.20,0.28,'#d78d82'),
      cyl(0,0.28,0,0.18,0.32,'#d78d82',{taper:0.68}),
      cyl(-0.06,0.56,0,0.025,0.48,'#62836c'),
      cyl(0.07,0.56,0.02,0.025,0.42,'#62836c'),
      ellipsoid(-0.07,1.06,0,0.16,0.12,0.13,'#e5b969'),
      ellipsoid(0.08,0.99,0.02,0.16,0.12,0.13,'#e4a0a0')
    ];
  }

  function makeCandle(){
    return [
      cyl(0,0,0,0.18,0.38,'#f0dfbf',{taper:0.94}),
      ellipsoid(0,0.43,0,0.07,0.12,0.06,'#e9ad56',{emissive:true}),
      ellipsoid(0,0.48,0,0.035,0.075,0.03,'#fff1b6',{emissive:true})
    ];
  }

  function makeFruitBowl(){
    return [
      ellipsoid(0,0.10,0,0.52,0.13,0.40,'#9d7b65'),
      ellipsoid(-0.20,0.26,0.02,0.18,0.18,0.18,'#df9b59'),
      ellipsoid(0.08,0.26,-0.08,0.18,0.18,0.18,'#d17c63'),
      ellipsoid(0.25,0.26,0.09,0.18,0.18,0.18,'#e1b35e')
    ];
  }

  function makeTinyPlant(){
    return [
      cyl(0,0,0,0.24,0.28,'#b88768',{taper:0.76}),
      ellipsoid(-0.16,0.48,0,0.20,0.15,0.10,'#789b79',{rot:-0.42}),
      ellipsoid(0.17,0.53,0.01,0.20,0.15,0.10,'#6c8f70',{rot:0.42}),
      ellipsoid(0,0.66,-0.01,0.18,0.17,0.10,'#88aa82')
    ];
  }

  const templates = [
    { id:'bed', name:'Cloud bed', glyph:'☁', colour:'#d89a94', footprint:[2.9,3.25], maker:makeCloudBed },
    { id:'sofa', name:'Scallop sofa', glyph:'⌒', colour:'#7e9fa6', footprint:[3.5,1.65], maker:makeScallopSofa },
    { id:'chair', name:'Petal chair', glyph:'◡', colour:'#d48e87', footprint:[1.8,1.6], maker:makePetalChair },
    { id:'coffee', name:'Pebble table', glyph:'●', colour:'#caa27e', footprint:[2.75,1.65], supportHeight:1.03, supportSize:[2.28,1.18], maker:makePebbleCoffeeTable },
    { id:'lamp', name:'Glow lamp', glyph:'◉', colour:'#e8bd76', footprint:[1.3,1.3], maker:makeGlowLamp },
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
    { id:'seed-bed', type:'bed', room:'bedroom', x:-5.70, z:-0.20, rot:0 },
    { id:'seed-drawers', type:'drawers', room:'bedroom', x:-1.25, z:-1.72, rot:0 },
    { id:'seed-tinyplant', type:'tinyplant', room:'bedroom', x:-1.25, z:-1.70, rot:0, supportId:'seed-drawers' },
    { id:'seed-chair-studio', type:'chair', room:'studio', x:2.30, z:-1.05, rot:0 },
    { id:'seed-plant-studio', type:'plant', room:'studio', x:6.75, z:-1.42, rot:0 },
    { id:'seed-bean', type:'beanbag', room:'play', x:-5.75, z:0.52, rot:0 },
    { id:'seed-toybox', type:'toybox', room:'play', x:-6.65, z:-1.55, rot:0 },
    { id:'seed-rug-living', type:'rug', room:'living', x:4.18, z:0.26, rot:0 },
    { id:'seed-sofa', type:'sofa', room:'living', x:4.12, z:-1.37, rot:0 },
    { id:'seed-chair', type:'chair', room:'living', x:6.72, z:0.36, rot:-Math.PI/2 },
    { id:'seed-coffee', type:'coffee', room:'living', x:4.18, z:0.38, rot:0 },
    { id:'seed-lamp', type:'lamp', room:'living', x:1.38, z:-1.42, rot:0 },
    { id:'seed-books', type:'books', room:'living', x:3.72, z:0.33, rot:0.10, supportId:'seed-coffee' },
    { id:'seed-mug', type:'mug', room:'living', x:4.56, z:0.34, rot:0, supportId:'seed-coffee' },
    { id:'seed-vase', type:'vase', room:'living', x:4.14, z:0.14, rot:0, supportId:'seed-coffee' }
  ];

  let state = {
    lighting:'day',
    rooms:Object.fromEntries(rooms.map(r=>[r.id,{wall:r.wall,floor:r.floor}])),
    items:defaultItems.map(i=>({...i})),
    camera:{x:4.0,y:2.10}
  };
  let selectedId=null;
  let gesture=null;
  let activeRoomId='living';
  let idCounter=1;
  let resizeRaf=0;
  let pointLights=[];

  const camera={pos:v3(),target:v3(),fov:35,right:v3(),up:v3(),forward:v3(),focal:1,cx:0,cy:0};

  function roomById(id){ return rooms.find(r=>r.id===id)||rooms[0]; }
  function templateById(id){ return templates.find(t=>t.id===id); }
  function itemById(id){ return state.items.find(i=>i.id===id); }

  function itemBaseY(item){
    const room=roomById(item.room);
    if(item.supportId){
      const support=itemById(item.supportId);
      const st=support&&templateById(support.type);
      if(support&&support.room===item.room&&st&&st.supportHeight){
        return room.floorY+st.supportHeight;
      }
    }
    return room.floorY;
  }

  function setupCamera(){
    camera.target=v3(state.camera.x,state.camera.y,0);
    camera.pos=v3(state.camera.x,state.camera.y+3.20,18.7);
    camera.forward=norm(sub(camera.target,camera.pos));
    camera.right=norm(cross(camera.forward,v3(0,1,0)));
    camera.up=norm(cross(camera.right,camera.forward));
    camera.cx=canvas.width*0.5;
    camera.cy=canvas.height*0.49;
    camera.focal=(canvas.height*0.5)/Math.tan((camera.fov*Math.PI/180)*0.5);
  }

  function project(p){
    const q=sub(p,camera.pos);
    const z=dot(q,camera.forward);
    if(z<=0.05)return null;
    return {x:camera.cx+dot(q,camera.right)/z*camera.focal,y:camera.cy-dot(q,camera.up)/z*camera.focal,z};
  }

  function screenToPlane(sx,sy,planeY){
    const dx=(sx-camera.cx)/camera.focal;
    const dy=(camera.cy-sy)/camera.focal;
    const dir=norm(add(camera.forward,add(mul(camera.right,dx),mul(camera.up,dy))));
    if(Math.abs(dir.y)<1e-5)return null;
    const t=(planeY-camera.pos.y)/dir.y;
    if(t<=0)return null;
    return add(camera.pos,mul(dir,t));
  }

  function rotatedNormal(n,a){
    const ca=Math.cos(a),sa=Math.sin(a);
    return v3(n.x*ca-n.z*sa,n.y,n.x*sa+n.z*ca);
  }

  function gatherPointLights(){
    if(state.lighting!=='evening')return [];
    return state.items.filter(i=>i.type==='lamp').map(i=>({pos:v3(i.x,itemBaseY(i)+1.66,i.z),power:1.08}));
  }

  function lightingAmount(normal,center,emissive=false){
    if(emissive&&state.lighting==='evening')return 0.34;
    const sunDir=norm(v3(-0.65,1.0,0.88));
    if(state.lighting==='day'){
      const diffuse=Math.max(0,dot(normal,sunDir));
      const level=0.47+diffuse*0.70;
      return clamp((level-0.66)*0.48,-0.20,0.28);
    }
    let level=0.27+Math.max(0,dot(normal,norm(v3(0.2,1,0.25))))*0.15;
    pointLights.forEach(light=>{
      const delta=sub(light.pos,center),d=len(delta);
      if(d>5.6)return;
      const facing=Math.max(0,dot(normal,norm(delta)));
      level+=facing*(1-d/5.6)*1.04*light.power;
    });
    return clamp((level-0.56)*0.54,-0.31,0.31);
  }

  function litColor(hex,normal,center,emissive=false,bias=0){
    return shade(hex,clamp(lightingAmount(normal,center,emissive)+bias,-0.35,0.36));
  }

  const boxFaces=[
    {ids:[0,1,2,3],n:v3(0,-1,0)},
    {ids:[4,7,6,5],n:v3(0,1,0)},
    {ids:[0,4,5,1],n:v3(0,0,-1)},
    {ids:[1,5,6,2],n:v3(1,0,0)},
    {ids:[2,6,7,3],n:v3(0,0,1)},
    {ids:[3,7,4,0],n:v3(-1,0,0)}
  ];

  function transformPart(p,item){
    const baseY=itemBaseY(item);
    const itemRot=item.rot||0;
    const a=itemRot+(p.rot||0),ca=Math.cos(itemRot),sa=Math.sin(itemRot);
    const x=p.x*ca-p.z*sa,z=p.x*sa+p.z*ca;
    return {...p,x:item.x+x,y:baseY+p.y,z:item.z+z,rot:a};
  }

  function itemParts(item){
    const t=templateById(item.type);
    return t?t.maker().map(p=>transformPart(p,item)):[];
  }

  function boxVerts(p){
    const w=p.w/2,h=p.h/2,d=p.d/2,a=p.rot||0,ca=Math.cos(a),sa=Math.sin(a);
    const raw=[[-w,-h,-d],[w,-h,-d],[w,-h,d],[-w,-h,d],[-w,h,-d],[w,h,-d],[w,h,d],[-w,h,d]];
    return raw.map(q=>{
      const rx=q[0]*ca-q[2]*sa,rz=q[0]*sa+q[2]*ca;
      return v3(p.x+rx,p.y+q[1],p.z+rz);
    });
  }

  function pushBoxFaces(list,p,owner,selected=false,architecture=false){
    const verts=boxVerts(p),pv=verts.map(project);
    if(pv.some(v=>!v))return;
    for(const f of boxFaces){
      const pts=f.ids.map(i=>pv[i]);
      const normal=rotatedNormal(f.n,p.rot||0);
      const c=mul(f.ids.reduce((acc,i)=>add(acc,verts[i]),v3()),1/f.ids.length);
      if(dot(normal,norm(sub(camera.pos,c)))<=0.001)continue;
      list.push({
        pts,
        depth:pts.reduce((s,q)=>s+q.z,0)/pts.length,
        fill:litColor(p.color,normal,c,p.emissive,false),
        owner,
        selected,
        stroke:architecture?'rgba(65,57,52,.10)':'rgba(61,52,47,.055)',
        width:architecture?1.25:0.7
      });
    }
  }

  function pushCylinderFaces(list,p,owner,selected=false){
    const seg=18,taper=p.taper==null?1:p.taper,bottom=[],top=[];
    for(let i=0;i<seg;i++){
      const ang=TAU*i/seg;
      bottom.push(v3(p.x+Math.cos(ang)*p.r,p.y,p.z+Math.sin(ang)*p.r));
      top.push(v3(p.x+Math.cos(ang)*p.r*taper,p.y+p.h,p.z+Math.sin(ang)*p.r*taper));
    }
    const all=[...bottom,...top].map(project);
    if(all.some(v=>!v))return;
    for(let i=0;i<seg;i++){
      const j=(i+1)%seg,pts=[all[i],all[j],all[seg+j],all[seg+i]],ang=TAU*(i+0.5)/seg;
      const normal=v3(Math.cos(ang),0,Math.sin(ang));
      const c=v3(p.x+normal.x*p.r,p.y+p.h*0.5,p.z+normal.z*p.r);
      list.push({pts,depth:pts.reduce((s,q)=>s+q.z,0)/4,fill:litColor(p.color,normal,c,p.emissive),owner,selected,stroke:null});
    }
    const topPts=top.map(project),tc=v3(p.x,p.y+p.h,p.z);
    list.push({pts:topPts,depth:topPts.reduce((s,q)=>s+q.z,0)/seg,fill:litColor(p.color,v3(0,1,0),tc,p.emissive),owner,selected,stroke:null});
  }

  function ellipsoidPoints(p){
    const lat=8,lon=18,rings=[],a=p.rot||0,ca=Math.cos(a),sa=Math.sin(a);
    for(let iy=0;iy<=lat;iy++){
      const phi=-Math.PI/2+Math.PI*iy/lat,cp=Math.cos(phi),sp=Math.sin(phi),ring=[];
      for(let ix=0;ix<lon;ix++){
        const th=TAU*ix/lon,lx=Math.cos(th)*cp*p.rx,lz=Math.sin(th)*cp*p.rz;
        const rx=lx*ca-lz*sa,rz=lx*sa+lz*ca;
        ring.push(v3(p.x+rx,p.y+sp*p.ry,p.z+rz));
      }
      rings.push(ring);
    }
    return rings;
  }

  function pushEllipsoidFaces(list,p,owner,selected=false){
    const rings=ellipsoidPoints(p),lat=rings.length-1,lon=rings[0].length,a=p.rot||0;
    for(let iy=0;iy<lat;iy++){
      for(let ix=0;ix<lon;ix++){
        const j=(ix+1)%lon,verts=[rings[iy][ix],rings[iy][j],rings[iy+1][j],rings[iy+1][ix]],pts=verts.map(project);
        if(pts.some(v=>!v))continue;
        const c=mul(verts.reduce((acc,v)=>add(acc,v),v3()),0.25);
        const local=v3((c.x-p.x)/(p.rx||1),(c.y-p.y)/(p.ry||1),(c.z-p.z)/(p.rz||1));
        const normal=rotatedNormal(norm(local),a);
        if(dot(normal,norm(sub(camera.pos,c)))<=0.001)continue;
        list.push({pts,depth:pts.reduce((s,q)=>s+q.z,0)/4,fill:litColor(p.color,normal,c,p.emissive),owner,selected,stroke:null});
      }
    }
  }

  function drawPoly(points,fill,stroke=null,width=1){
    if(!points||!points.length||points.some(p=>!p))return;
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();}
  }

  function worldRect(x0,x1,z0,z1,y,fill,stroke='rgba(52,47,44,.18)',lw=1.2){
    drawPoly([v3(x0,y,z0),v3(x1,y,z0),v3(x1,y,z1),v3(x0,y,z1)].map(project),fill,stroke,lw);
  }

  function wallRect(room,cx,cy,w,h,fill,stroke='#6f645d',lw=1.2){
    const z=room.backZ+0.018;
    const pts=[
      v3(cx-w/2,room.floorY+cy-h/2,z),v3(cx+w/2,room.floorY+cy-h/2,z),
      v3(cx+w/2,room.floorY+cy+h/2,z),v3(cx-w/2,room.floorY+cy+h/2,z)
    ].map(project);
    drawPoly(pts,fill,stroke,lw);
  }

  function drawRoomDecor(room){
    if(room.decor==='window'){
      wallRect(room,room.cx,2.72,2.30,1.38,state.lighting==='day'?'#cce1e6':'#5c6679','#f7f0e8',5);
      wallRect(room,room.cx,2.72,0.08,1.38,'#f7f0e8',null);
      wallRect(room,room.cx,2.72,2.30,0.08,'#f7f0e8',null);
      wallRect(room,room.cx-1.33,2.65,0.40,1.68,'#d79b95',null);
      wallRect(room,room.cx+1.33,2.65,0.40,1.68,'#d79b95',null);
    }else if(room.decor==='gallery'){
      wallRect(room,room.cx-1.32,2.74,1.28,1.16,'#f2e6d8','#846f61',3);
      wallRect(room,room.cx+0.18,2.96,1.04,1.44,'#e3b39e','#846f61',3);
      wallRect(room,room.cx+1.47,2.64,1.12,0.94,'#d2c18d','#846f61',3);
      wallRect(room,room.cx-1.32,2.74,0.46,0.46,'#7c9a8e',null);
      wallRect(room,room.cx+0.18,2.96,0.40,0.60,'#758fa1',null);
    }else if(room.decor==='living'){
      wallRect(room,room.cx,3.05,2.64,1.12,'#efe8da','#846f61',3);
      wallRect(room,room.cx,3.05,1.92,0.58,'#d89c8f',null);
      wallRect(room,room.cx-0.60,3.10,0.28,0.40,'#e7c16f',null);
      wallRect(room,room.cx+0.12,3.02,0.34,0.44,'#78998d',null);
      wallRect(room,room.cx+0.72,3.12,0.30,0.36,'#809baa',null);
    }else{
      const stars=[[-2.6,3.08],[-1.7,2.62],[-0.6,3.25],[0.6,2.72],[1.8,3.16],[2.65,2.48]];
      stars.forEach((s,i)=>wallRect(room,room.cx+s[0],s[1],0.30,0.30,i%2?'#e0b867':'#d18f86',null));
      wallRect(room,room.cx,1.82,3.2,0.09,'#f0d6aa',null);
    }
  }

  function drawFloor(room){
    const style=state.rooms[room.id],floorColor=litColor(style.floor,v3(0,1,0),v3(room.cx,room.floorY,BACK_Z+ROOM_D*0.5));
    if(room.id==='bedroom'){
      worldRect(room.minX,STAIR.minX,BACK_Z,FRONT_Z,room.floorY,floorColor);
      worldRect(STAIR.maxX,room.maxX,BACK_Z,FRONT_Z,room.floorY,floorColor);
      worldRect(STAIR.minX,STAIR.maxX,BACK_Z,STAIR.minZ,room.floorY,floorColor);
      worldRect(STAIR.minX,STAIR.maxX,STAIR.maxZ,FRONT_Z,room.floorY,floorColor);
      worldRect(STAIR.minX,STAIR.maxX,STAIR.minZ,STAIR.maxZ,room.floorY-0.015,'#786f68','rgba(52,47,44,.15)',1);
    }else{
      worldRect(room.minX,room.maxX,BACK_Z,FRONT_Z,room.floorY,floorColor);
    }

    ctx.save();ctx.strokeStyle='rgba(73,61,52,.075)';ctx.lineWidth=1;
    for(let z=BACK_Z+0.70;z<FRONT_Z;z+=0.70){
      const a=project(v3(room.minX,room.floorY+0.012,z)),b=project(v3(room.maxX,room.floorY+0.012,z));
      if(a&&b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    }
    ctx.restore();
  }

  function drawBackWall(room){
    const style=state.rooms[room.id];
    const pts=[
      v3(room.minX,room.floorY,BACK_Z),v3(room.maxX,room.floorY,BACK_Z),
      v3(room.maxX,room.floorY+ROOM_H,BACK_Z),v3(room.minX,room.floorY+ROOM_H,BACK_Z)
    ].map(project);
    drawPoly(pts,litColor(style.wall,v3(0,0,1),v3(room.cx,room.floorY+ROOM_H*0.5,BACK_Z)),'rgba(52,47,44,.18)',1.2);
    const skirt=[
      v3(room.minX,room.floorY+0.05,BACK_Z+0.02),v3(room.maxX,room.floorY+0.05,BACK_Z+0.02),
      v3(room.maxX,room.floorY+0.18,BACK_Z+0.02),v3(room.minX,room.floorY+0.18,BACK_Z+0.02)
    ].map(project);
    drawPoly(skirt,'#f6f0e8');
    drawRoomDecor(room);
  }

  function drawRoom(room){ drawBackWall(room); drawFloor(room); }

  function addCenteredBox(parts,x0,x1,y0,y1,z0,z1,color,opts={}){
    if(x1<=x0||y1<=y0||z1<=z0)return;
    parts.push(box((x0+x1)/2,(y0+y1)/2,(z0+z1)/2,x1-x0,y1-y0,z1-z0,color,opts));
  }

  function architectureParts(){
    const parts=[],shell='#cfc3b7',cut='#b9aa9c',trim='#eee5dc';
    // Outer side walls, foundation and roof are continuous pieces so the dollhouse reads as one slice.
    addCenteredBox(parts,HOUSE_MIN_X-WALL_T,HOUSE_MIN_X, -0.22,HOUSE_TOP+0.22, BACK_Z-WALL_T,FRONT_Z+0.02,shell);
    addCenteredBox(parts,HOUSE_MAX_X,HOUSE_MAX_X+WALL_T, -0.22,HOUSE_TOP+0.22, BACK_Z-WALL_T,FRONT_Z+0.02,shell);
    addCenteredBox(parts,HOUSE_MIN_X-WALL_T,HOUSE_MAX_X+WALL_T,-0.34,0,BACK_Z-WALL_T,FRONT_Z+0.02,cut);
    addCenteredBox(parts,HOUSE_MIN_X-WALL_T,HOUSE_MAX_X+WALL_T,HOUSE_TOP,HOUSE_TOP+0.34,BACK_Z-WALL_T,FRONT_Z+0.02,cut);

    // Floor slab between storeys with a real stair opening.
    const slabY0=ROOM_H,slabY1=UPPER_Y;
    addCenteredBox(parts,HOUSE_MIN_X,STAIR.minX,slabY0,slabY1,BACK_Z,FRONT_Z,cut);
    addCenteredBox(parts,STAIR.maxX,HOUSE_MAX_X,slabY0,slabY1,BACK_Z,FRONT_Z,cut);
    addCenteredBox(parts,STAIR.minX,STAIR.maxX,slabY0,slabY1,BACK_Z,STAIR.minZ,cut);
    addCenteredBox(parts,STAIR.minX,STAIR.maxX,slabY0,slabY1,STAIR.maxZ,FRONT_Z,cut);

    // Shared centre wall on both floors, each with a doorway cut through it.
    for(const floorY of [0,UPPER_Y]){
      const door0=DOOR_Z-DOOR_D/2,door1=DOOR_Z+DOOR_D/2;
      addCenteredBox(parts,-WALL_T/2,WALL_T/2,floorY,floorY+ROOM_H,BACK_Z,door0,shell);
      addCenteredBox(parts,-WALL_T/2,WALL_T/2,floorY,floorY+ROOM_H,door1,FRONT_Z,shell);
      addCenteredBox(parts,-WALL_T/2,WALL_T/2,floorY+DOOR_H,floorY+ROOM_H,door0,door1,shell);
      // Slightly oversized trims make the opening legible at phone size.
      addCenteredBox(parts,-WALL_T*0.75,WALL_T*0.75,floorY,floorY+DOOR_H,door0-0.05,door0+0.08,trim);
      addCenteredBox(parts,-WALL_T*0.75,WALL_T*0.75,floorY,floorY+DOOR_H,door1-0.08,door1+0.05,trim);
      addCenteredBox(parts,-WALL_T*0.75,WALL_T*0.75,floorY+DOOR_H-0.06,floorY+DOOR_H+0.10,door0,door1,trim);
    }

    // Staircase. Solid stepped blocks keep the silhouette strong in this software renderer.
    const steps=12,tread=(STAIR.maxZ-STAIR.minZ)/steps;
    for(let i=0;i<steps;i++){
      const top=(i+1)*(UPPER_Y-0.12)/steps;
      const z=STAIR.maxZ-(i+0.5)*tread;
      parts.push(box(STAIR.x,top/2,z,1.58,top,tread+0.025,'#c8a27f'));
    }
    // Newel posts.
    parts.push(cyl(STAIR.x-0.88,0.02,STAIR.maxZ-0.08,0.07,1.02,'#866b59'));
    parts.push(cyl(STAIR.x-0.88,UPPER_Y-1.03,STAIR.minZ+0.08,0.07,1.02,'#866b59'));
    return parts;
  }

  function tracePoly(points){
    if(!points||!points.length)return false;
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
    ctx.closePath();return true;
  }

  function roomFloorPoints(room){
    return [v3(room.minX,room.floorY,BACK_Z),v3(room.maxX,room.floorY,BACK_Z),v3(room.maxX,room.floorY,FRONT_Z),v3(room.minX,room.floorY,FRONT_Z)].map(project);
  }

  function drawLampGlows(){
    if(state.lighting!=='evening')return;
    state.items.filter(i=>i.type==='lamp').forEach(item=>{
      const room=roomById(item.room),p=project(v3(item.x,room.floorY+0.04,item.z));
      if(!p)return;
      const floor=roomFloorPoints(room);
      ctx.save();tracePoly(floor);ctx.clip();
      const radius=Math.max(95,canvas.width*0.17);
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
      g.addColorStop(0,'rgba(255,220,151,.28)');g.addColorStop(0.55,'rgba(255,211,128,.11)');g.addColorStop(1,'rgba(255,211,128,0)');
      ctx.fillStyle=g;ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);ctx.restore();
    });
  }

  function drawItemShadow(item){
    const t=templateById(item.type);if(!t||item.type==='rug')return;
    const room=roomById(item.room),baseY=itemBaseY(item);
    if(baseY>room.floorY+0.10)return; // tabletop objects get their contact shadow from the table itself.
    let ox=0.16,oz=0.18,alpha=0.14;
    if(state.lighting==='day'){ox=0.32;oz=-0.15;alpha=0.16;}else{ox=0.07;oz=0.05;alpha=0.20;}
    const rx=t.footprint[0]*0.40,rz=t.footprint[1]*0.34,center=project(v3(item.x+ox,room.floorY+0.016,item.z+oz));
    if(!center)return;
    const edge=project(v3(item.x+ox+rx,room.floorY+0.016,item.z+oz));
    if(!edge)return;
    const r=Math.max(12,Math.abs(edge.x-center.x));
    const g=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,r*1.3);
    g.addColorStop(0,`rgba(53,45,41,${alpha})`);g.addColorStop(1,'rgba(53,45,41,0)');
    ctx.save();ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(center.x,center.y,r*1.25,r*0.42,0,0,TAU);ctx.fill();ctx.restore();
  }

  function partBoundsPoints(p){
    if(p.kind==='box')return boxVerts(p);
    if(p.kind==='cyl'){
      const out=[];
      for(const yy of [p.y,p.y+p.h])for(let i=0;i<8;i++){const a=TAU*i/8;out.push(v3(p.x+Math.cos(a)*p.r,yy,p.z+Math.sin(a)*p.r));}
      return out;
    }
    if(p.kind==='ellipsoid'){
      const out=[];
      for(const x of [-p.rx,p.rx])for(const y of [-p.ry,p.ry])for(const z of [-p.rz,p.rz])out.push(v3(p.x+x,p.y+y,p.z+z));
      return out;
    }
    return [];
  }

  function drawHouseEdges(){
    const lines=[
      [v3(HOUSE_MIN_X,0,FRONT_Z),v3(HOUSE_MAX_X,0,FRONT_Z)],
      [v3(HOUSE_MIN_X,UPPER_Y,FRONT_Z),v3(HOUSE_MAX_X,UPPER_Y,FRONT_Z)],
      [v3(HOUSE_MIN_X,HOUSE_TOP,FRONT_Z),v3(HOUSE_MAX_X,HOUSE_TOP,FRONT_Z)],
      [v3(HOUSE_MIN_X,0,FRONT_Z),v3(HOUSE_MIN_X,HOUSE_TOP,FRONT_Z)],
      [v3(HOUSE_MAX_X,0,FRONT_Z),v3(HOUSE_MAX_X,HOUSE_TOP,FRONT_Z)]
    ];
    ctx.save();ctx.strokeStyle='rgba(70,60,54,.62)';ctx.lineWidth=Math.max(2,canvas.width/330);ctx.lineCap='round';
    lines.forEach(line=>{const a=project(line[0]),b=project(line[1]);if(a&&b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}});
    ctx.restore();
  }

  function drawStairRail(){
    const a=project(v3(STAIR.x-0.89,0.95,STAIR.maxZ-0.05));
    const b=project(v3(STAIR.x-0.89,UPPER_Y-0.15,STAIR.minZ+0.10));
    if(!a||!b)return;
    ctx.save();ctx.strokeStyle='#866b59';ctx.lineWidth=Math.max(3,canvas.width/220);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    for(let i=1;i<6;i++){
      const t=i/6,z=STAIR.maxZ-(STAIR.maxZ-STAIR.minZ)*t,y=(UPPER_Y-0.26)*t;
      const p0=project(v3(STAIR.x-0.89,y-0.58,z)),p1=project(v3(STAIR.x-0.89,y+0.14,z));
      if(p0&&p1){ctx.lineWidth=Math.max(1.5,canvas.width/430);ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();}
    }
    ctx.restore();
  }

  function drawSupportTarget(){
    if(!gesture||gesture.mode!=='item'||!gesture.previewSupport)return;
    const support=itemById(gesture.previewSupport),t=support&&templateById(support.type);
    if(!support||!t)return;
    const room=roomById(support.room),size=t.supportSize||t.footprint,a=support.rot||0,ca=Math.cos(a),sa=Math.sin(a);
    const pts=[[-size[0]/2,-size[1]/2],[size[0]/2,-size[1]/2],[size[0]/2,size[1]/2],[-size[0]/2,size[1]/2]].map(q=>{
      const x=q[0]*ca-q[1]*sa,z=q[0]*sa+q[1]*ca;
      return project(v3(support.x+x,room.floorY+t.supportHeight+0.02,support.z+z));
    });
    if(pts.some(p=>!p))return;
    ctx.save();ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=Math.max(3,canvas.width/220);ctx.setLineDash([9,6]);
    ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();ctx.stroke();ctx.restore();
  }

  function render(){
    setupCamera();pointLights=gatherPointLights();
    ctx.fillStyle=state.lighting==='day'?'#ddd4ca':'#797377';ctx.fillRect(0,0,canvas.width,canvas.height);

    rooms.forEach(drawRoom);
    drawLampGlows();
    state.items.forEach(drawItemShadow);

    const list=[],bounds=[];
    architectureParts().forEach(p=>{
      if(p.kind==='box')pushBoxFaces(list,p,null,false,true);
      else if(p.kind==='cyl')pushCylinderFaces(list,p,null,false);
    });

    for(const item of state.items){
      const ownerPoints=[],isSel=item.id===selectedId;
      for(const p of itemParts(item)){
        if(p.kind==='box')pushBoxFaces(list,p,item.id,isSel,false);
        else if(p.kind==='cyl')pushCylinderFaces(list,p,item.id,isSel);
        else if(p.kind==='ellipsoid')pushEllipsoidFaces(list,p,item.id,isSel);
        partBoundsPoints(p).forEach(v=>{const q=project(v);if(q)ownerPoints.push(q);});
      }
      if(ownerPoints.length){
        bounds.push({
          id:item.id,
          minX:Math.min(...ownerPoints.map(p=>p.x))-7,maxX:Math.max(...ownerPoints.map(p=>p.x))+7,
          minY:Math.min(...ownerPoints.map(p=>p.y))-7,maxY:Math.max(...ownerPoints.map(p=>p.y))+7,
          depth:ownerPoints.reduce((s,p)=>s+p.z,0)/ownerPoints.length
        });
      }
    }

    list.sort((a,b)=>b.depth-a.depth);
    list.forEach(f=>drawPoly(f.pts,f.fill,f.stroke,f.width||1));
    drawStairRail();drawHouseEdges();drawSupportTarget();

    if(selectedId){
      const b=bounds.find(x=>x.id===selectedId);
      if(b){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(3,canvas.width/220);ctx.setLineDash([10,7]);ctx.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);ctx.restore();}
    }
    canvas._itemBounds=bounds;
  }

  function pointerPos(ev){
    const r=canvas.getBoundingClientRect();
    return {x:(ev.clientX-r.left)/r.width*canvas.width,y:(ev.clientY-r.top)/r.height*canvas.height};
  }

  function pickAt(p){
    const arr=(canvas._itemBounds||[]).filter(b=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY);
    if(!arr.length)return null;
    arr.sort((a,b)=>a.depth-b.depth);return arr[0].id;
  }

  function nearestRoom(){
    let best=rooms[0],score=Infinity;
    rooms.forEach(room=>{
      const dx=state.camera.x-room.cx,dy=state.camera.y-(room.floorY+2.0),s=dx*dx+dy*dy*1.30;
      if(s<score){score=s;best=room;}
    });
    return best;
  }

  function refreshActiveRoom(force=false){
    const next=nearestRoom().id;if(!force&&next===activeRoomId)return;
    activeRoomId=next;roomLabel.textContent=roomById(activeRoomId).name;
    buildSwatches(wallSwatches,wallPalette,'wall');buildSwatches(floorSwatches,floorPalette,'floor');
  }

  function rotatedFootprintSize(t,item){
    const a=item.rot||0,swap=Math.abs(Math.sin(a))>0.5;
    return [swap?t.footprint[1]:t.footprint[0],swap?t.footprint[0]:t.footprint[1]];
  }

  function clampItemToRoom(item){
    const room=roomById(item.room),t=templateById(item.type);if(!t)return;
    const [fw,fd]=rotatedFootprintSize(t,item);
    item.x=clamp(item.x,room.minX+fw*0.50,room.maxX-fw*0.50);
    item.z=clamp(item.z,room.backZ+fd*0.50,room.frontZ-fd*0.55-0.20);
  }

  function surfaceContains(surface,x,z){
    const t=templateById(surface.type);if(!t||!t.supportHeight)return false;
    const size=t.supportSize||t.footprint,a=-(surface.rot||0),ca=Math.cos(a),sa=Math.sin(a),dx=x-surface.x,dz=z-surface.z;
    const lx=dx*ca-dz*sa,lz=dx*sa+dz*ca;
    return Math.abs(lx)<=size[0]*0.45&&Math.abs(lz)<=size[1]*0.43;
  }

  function findSupportFor(item,x,z){
    const t=templateById(item.type);if(!t||t.place!=='surface')return null;
    const candidates=state.items.filter(s=>s.id!==item.id&&s.room===item.room&&templateById(s.type)?.supportHeight&&surfaceContains(s,x,z));
    if(!candidates.length)return null;
    candidates.sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));
    return candidates[0].id;
  }

  function validateSupports(){
    state.items.forEach(item=>{
      if(!item.supportId)return;
      const support=itemById(item.supportId),t=support&&templateById(support.type);
      if(!support||support.room!==item.room||!t||!t.supportHeight)item.supportId=null;
    });
  }

  canvas.addEventListener('pointerdown',ev=>{
    const p=pointerPos(ev),id=pickAt(p);
    if(id){
      selectedId=id;updateSelection();render();
      const item=itemById(id),room=item&&roomById(item.room),floor=room&&screenToPlane(p.x,p.y,room.floorY);
      if(item&&floor){
        gesture={mode:'item',id,pointerId:ev.pointerId,dx:item.x-floor.x,dz:item.z-floor.z,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,moved:false,previewSupport:item.supportId||null};
      }
    }else{
      selectedId=null;updateSelection();render();
      gesture={mode:'pan',pointerId:ev.pointerId,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,moved:false};
    }
    try{canvas.setPointerCapture(ev.pointerId);}catch{}
  });

  canvas.addEventListener('pointermove',ev=>{
    if(!gesture||gesture.pointerId!==ev.pointerId)return;
    const p=pointerPos(ev);if(Math.hypot(p.x-gesture.startX,p.y-gesture.startY)>6)gesture.moved=true;
    if(gesture.mode==='item'){
      const item=itemById(gesture.id);if(!item)return;
      const room=roomById(item.room),floor=screenToPlane(p.x,p.y,room.floorY);if(!floor)return;
      item.x=floor.x+gesture.dx;item.z=floor.z+gesture.dz;clampItemToRoom(item);
      const t=templateById(item.type);
      if(t&&t.place==='surface'){
        const support=findSupportFor(item,item.x,item.z);
        item.supportId=support;gesture.previewSupport=support;
        hint.textContent=support?`Place on ${templateById(itemById(support).type).name.toLowerCase()}`:'Drag onto a table or drawers';
      }else{
        item.supportId=null;hint.textContent='Drag it into place';
      }
      render();
    }else{
      const scale=11.4/canvas.width,dx=p.x-gesture.lastX,dy=p.y-gesture.lastY;
      state.camera.x=clamp(state.camera.x-dx*scale,-5.45,5.45);
      state.camera.y=clamp(state.camera.y+dy*scale,1.75,7.25);
      gesture.lastX=p.x;gesture.lastY=p.y;refreshActiveRoom();hint.textContent='Drag empty space to explore the house';render();
    }
  });

  function endGesture(ev){
    if(!gesture||gesture.pointerId!==ev.pointerId)return;
    try{canvas.releasePointerCapture(ev.pointerId);}catch{}
    gesture=null;save();render();
  }
  canvas.addEventListener('pointerup',endGesture);canvas.addEventListener('pointercancel',endGesture);

  rotateBtn.addEventListener('click',()=>{
    const item=itemById(selectedId);if(!item)return;
    item.rot=((item.rot||0)+Math.PI/2)%TAU;clampItemToRoom(item);
    const support=item.supportId&&itemById(item.supportId);if(item.supportId&&(!support||!surfaceContains(support,item.x,item.z)))item.supportId=null;
    save();render();
  });

  removeBtn.addEventListener('click',()=>{
    if(!selectedId)return;
    state.items.forEach(i=>{if(i.supportId===selectedId)i.supportId=null;});
    state.items=state.items.filter(i=>i.id!==selectedId);selectedId=null;updateSelection();save();render();hint.textContent='Put away — choose something else';
  });

  clearBtn.addEventListener('click',()=>{
    const removed=new Set(state.items.filter(i=>i.room===activeRoomId).map(i=>i.id));
    state.items=state.items.filter(i=>i.room!==activeRoomId);state.items.forEach(i=>{if(removed.has(i.supportId))i.supportId=null;});
    selectedId=null;updateSelection();save();render();hint.textContent=`${roomById(activeRoomId).name} cleared`;
  });

  lightingBtn.addEventListener('click',()=>{
    state.lighting=state.lighting==='day'?'evening':'day';updateLightingButton();save();render();
  });

  prevBtn.addEventListener('click',()=>carousel.scrollBy({left:-carousel.clientWidth*0.72,behavior:'smooth'}));
  nextBtn.addEventListener('click',()=>carousel.scrollBy({left:carousel.clientWidth*0.72,behavior:'smooth'}));

  function addItem(type){
    const t=templateById(type),room=roomById(activeRoomId);if(!t)return;
    const count=state.items.filter(i=>i.room===room.id).length;
    const item={id:`item-${Date.now()}-${idCounter++}`,type,room:room.id,x:room.cx+((count%3)-1)*0.35,z:0.12+((count%2)?0.30:-0.16),rot:0};
    if(t.place==='surface'){
      const support=state.items.find(s=>s.room===room.id&&templateById(s.type)?.supportHeight);
      if(support){item.x=support.x;item.z=support.z;item.supportId=support.id;}
    }
    clampItemToRoom(item);state.items.push(item);selectedId=item.id;updateSelection();save();render();
    hint.textContent=t.place==='surface'?(item.supportId?`Added to ${templateById(itemById(item.supportId).type).name.toLowerCase()}`:'Drag onto a table or drawers'):`Drag the ${t.name.toLowerCase()} into place`;
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
    const style=state.rooms[activeRoomId];holder.innerHTML='';
    palette.forEach(col=>{
      const b=document.createElement('button');b.type='button';b.className='room-swatch';b.style.background=col;b.setAttribute('aria-label',`${key} colour ${col}`);
      if(style[key]===col)b.classList.add('active');
      b.addEventListener('click',()=>{style[key]=col;[...holder.children].forEach(x=>x.classList.toggle('active',x===b));save();render();});holder.appendChild(b);
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
        lighting:parsed.lighting==='evening'?'evening':'day',rooms:roomState,
        items:parsed.items.filter(i=>templateById(i.type)&&rooms.some(r=>r.id===i.room)).slice(0,80),
        camera:{x:clamp(parsed.camera&&Number.isFinite(Number(parsed.camera.x))?Number(parsed.camera.x):4.0,-5.45,5.45),y:clamp(parsed.camera&&Number.isFinite(Number(parsed.camera.y))?Number(parsed.camera.y):2.1,1.75,7.25)}
      };
      validateSupports();state.items.forEach(clampItemToRoom);
    }catch{}
  }

  function resizeCanvas(){
    const r=canvas.getBoundingClientRect();if(!r.width)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),cssW=r.width,cssH=Math.max(410,Math.min(590,cssW*1.05));
    canvas.style.height=`${cssH}px`;
    const w=Math.round(cssW*dpr),h=Math.round(cssH*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    render();
  }
  function queueResize(){cancelAnimationFrame(resizeRaf);resizeRaf=requestAnimationFrame(resizeCanvas);}

  load();activeRoomId=nearestRoom().id;buildCarousel();refreshActiveRoom(true);updateSelection();updateLightingButton();
  window.addEventListener('resize',queueResize,{passive:true});
  if('ResizeObserver'in window)new ResizeObserver(queueResize).observe(canvas.parentElement);
  queueResize();
})();
