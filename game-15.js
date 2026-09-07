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

  const STORAGE_KEY = 'gamehub-my-house-v2';
  const TAU = Math.PI * 2;
  const ROOM_W = 8.0;
  const ROOM_D = 4.55;
  const ROOM_H = 4.45;
  const FRONT_Z = 2.05;
  const BACK_Z = FRONT_Z - ROOM_D;
  const wallPalette = ['#f1dfd6', '#eadcc9', '#d8e6dc', '#dbe3ef', '#ead9e5', '#efe5bf'];
  const floorPalette = ['#c8a883', '#b9906c', '#d2c3ae', '#9ca99c', '#b4a297', '#c9b596'];

  const rooms = [
    { id: 'bedroom', name: 'Bedroom', cx: -4.2, floorY: 5.05, wall: wallPalette[0], floor: floorPalette[0], decor: 'window' },
    { id: 'living', name: 'Living room', cx: 4.2, floorY: 5.05, wall: wallPalette[2], floor: floorPalette[2], decor: 'gallery' },
    { id: 'play', name: 'Play room', cx: -4.2, floorY: 0.0, wall: wallPalette[3], floor: floorPalette[4], decor: 'stars' }
  ];
  rooms.forEach(r => {
    r.minX = r.cx - ROOM_W / 2;
    r.maxX = r.cx + ROOM_W / 2;
    r.backZ = BACK_Z;
    r.frontZ = FRONT_Z;
  });

  function v3(x = 0, y = 0, z = 0) { return { x, y, z }; }
  function add(a,b){ return v3(a.x+b.x,a.y+b.y,a.z+b.z); }
  function sub(a,b){ return v3(a.x-b.x,a.y-b.y,a.z-b.z); }
  function mul(a,s){ return v3(a.x*s,a.y*s,a.z*s); }
  function dot(a,b){ return a.x*b.x+a.y*b.y+a.z*b.z; }
  function cross(a,b){ return v3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x); }
  function len(a){ return Math.hypot(a.x,a.y,a.z) || 1; }
  function norm(a){ const l=len(a); return v3(a.x/l,a.y/l,a.z/l); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function shade(hex, amount) {
    const c = hex.replace('#','');
    const n = parseInt(c,16);
    let r = (n>>16)&255, g=(n>>8)&255, b=n&255;
    const target = amount < 0 ? 0 : 255;
    const p = Math.min(1, Math.abs(amount));
    r = Math.round((target-r)*p+r);
    g = Math.round((target-g)*p+g);
    b = Math.round((target-b)*p+b);
    return `rgb(${r},${g},${b})`;
  }

  function box(x,y,z,w,h,d,color, opts={}) { return { kind:'box', x,y,z,w,h,d,color, ...opts }; }
  function cyl(x,y,z,r,h,color, opts={}) { return { kind:'cyl', x,y,z,r,h,color, ...opts }; }
  function ellipsoid(x,y,z,rx,ry,rz,color, opts={}) { return { kind:'ellipsoid', x,y,z,rx,ry,rz,color, ...opts }; }

  function makeCloudBed() {
    return [
      box(0,0.20,0,2.9,0.40,3.25,'#a87c63'),
      box(0,0.52,0,2.72,0.42,3.02,'#f7efe6'),
      box(0,0.79,0.36,2.64,0.18,1.82,'#dc9f9a'),
      box(-0.68,0.89,0.42,0.43,0.055,0.43,'#c87876'),
      box(0.02,0.89,0.04,0.43,0.055,0.43,'#efc480'),
      box(0.70,0.89,0.50,0.43,0.055,0.43,'#92aa9c'),
      ellipsoid(-0.55,0.94,-0.94,0.62,0.19,0.42,'#fffaf4'),
      ellipsoid(0.55,0.94,-0.94,0.62,0.19,0.42,'#fffaf4'),
      box(0,1.18,-1.55,2.82,1.42,0.16,'#b98d75'),
      ellipsoid(-0.82,1.78,-1.45,0.72,0.57,0.17,'#f2d7d1'),
      ellipsoid(0,1.95,-1.45,0.86,0.72,0.17,'#f2d7d1'),
      ellipsoid(0.82,1.78,-1.45,0.72,0.57,0.17,'#f2d7d1')
    ];
  }

  function makeHugChair() {
    return [
      cyl(-0.42,0, -0.36,0.11,0.46,'#7e6656'), cyl(0.42,0,-0.36,0.11,0.46,'#7e6656'),
      cyl(-0.42,0, 0.36,0.11,0.46,'#7e6656'), cyl(0.42,0,0.36,0.11,0.46,'#7e6656'),
      ellipsoid(0,0.62,0,0.82,0.28,0.72,'#91ada0'),
      ellipsoid(0,1.26,-0.46,0.86,0.78,0.28,'#86a497'),
      ellipsoid(-0.68,0.89,0.02,0.22,0.35,0.66,'#86a497'),
      ellipsoid(0.68,0.89,0.02,0.22,0.35,0.66,'#86a497'),
      ellipsoid(0,0.78,-0.03,0.58,0.15,0.53,'#b9cec3')
    ];
  }

  function makeRoundTable() {
    return [
      cyl(0,0,0,0.48,0.16,'#9a755b'),
      cyl(0,0.16,0,0.20,0.78,'#a98264'),
      cyl(0,0.94,0,1.06,0.20,'#bd9270'),
      ellipsoid(0,1.15,0,0.92,0.10,0.92,'#cda786')
    ];
  }

  function makeBubbleSofa() {
    return [
      box(0,0.28,0,2.86,0.48,1.35,'#718e9e'),
      ellipsoid(-0.70,0.69,0.10,0.73,0.25,0.62,'#9fb7c2'),
      ellipsoid(0.70,0.69,0.10,0.73,0.25,0.62,'#9fb7c2'),
      ellipsoid(-0.68,1.28,-0.45,0.76,0.70,0.27,'#86a4b3'),
      ellipsoid(0.68,1.28,-0.45,0.76,0.70,0.27,'#86a4b3'),
      ellipsoid(-1.35,0.87,0.03,0.24,0.47,0.69,'#7898a8'),
      ellipsoid(1.35,0.87,0.03,0.24,0.47,0.69,'#7898a8'),
      ellipsoid(0.70,1.12,-0.12,0.34,0.28,0.18,'#efc27d')
    ];
  }

  function makeBubbleDrawers() {
    const wood = '#bd9875';
    return [
      box(0,0.76,0,2.18,1.52,0.92,wood),
      box(0,1.53,0,2.32,0.16,1.03,'#d1ad89'),
      box(0,1.18,0.474,1.86,0.38,0.04,'#c8a17d'),
      box(0,0.74,0.474,1.86,0.38,0.04,'#c8a17d'),
      box(0,0.30,0.474,1.86,0.38,0.04,'#c8a17d'),
      ellipsoid(0,1.18,0.52,0.12,0.12,0.08,'#769687'),
      ellipsoid(0,0.74,0.52,0.12,0.12,0.08,'#d88d83'),
      ellipsoid(0,0.30,0.52,0.12,0.12,0.08,'#dcb86f')
    ];
  }

  function makeArchedWardrobe() {
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

  function makeMushroomLamp() {
    return [
      ellipsoid(0,0.12,0,0.42,0.12,0.42,'#826d5f'),
      cyl(0,0.12,0,0.12,1.28,'#8f7a6b'),
      ellipsoid(0,1.54,0,0.72,0.30,0.72,'#efbf72',{emissive:true}),
      ellipsoid(0,1.38,0,0.42,0.16,0.42,'#f7d896',{emissive:true})
    ];
  }

  function makeFlowerRug() {
    const petals = [];
    for (let i=0;i<8;i++) {
      const a = TAU*i/8;
      petals.push(ellipsoid(Math.cos(a)*0.92,0.055,Math.sin(a)*0.70,0.82,0.055,0.60,i%2?'#d89a91':'#e7b7a8'));
    }
    petals.push(ellipsoid(0,0.06,0,0.84,0.06,0.72,'#e8c57d'));
    return petals;
  }

  function makeBunnyBox() {
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

  function makeSproutPlant() {
    return [
      cyl(0,0,0,0.48,0.58,'#bb8266',{taper:0.78}),
      cyl(0,0.58,0,0.08,0.92,'#5e8068'),
      ellipsoid(-0.32,1.15,0.03,0.36,0.22,0.18,'#77a27c'),
      ellipsoid(0.34,1.35,-0.04,0.38,0.24,0.19,'#6e9674'),
      ellipsoid(-0.06,1.55,0.12,0.34,0.26,0.18,'#85ad83'),
      ellipsoid(0.08,1.07,-0.16,0.34,0.20,0.16,'#658b6c')
    ];
  }

  function makeBeanbag() {
    return [
      ellipsoid(0,0.48,0,0.92,0.54,0.90,'#d08d82'),
      ellipsoid(-0.22,0.78,-0.12,0.58,0.37,0.60,'#dc9f94')
    ];
  }

  const templates = [
    { id:'bed', name:'Cloud bed', glyph:'☁', colour:'#d89a94', footprint:[2.9,3.25], maker:makeCloudBed },
    { id:'chair', name:'Hug chair', glyph:'◡', colour:'#8eaa9d', footprint:[1.75,1.55], maker:makeHugChair },
    { id:'table', name:'Round table', glyph:'●', colour:'#bd9270', footprint:[2.15,2.15], maker:makeRoundTable },
    { id:'sofa', name:'Bubble sofa', glyph:'⌒', colour:'#86a4b3', footprint:[3.0,1.55], maker:makeBubbleSofa },
    { id:'drawers', name:'Bubble drawers', glyph:'•••', colour:'#c8a17d', footprint:[2.3,1.0], maker:makeBubbleDrawers },
    { id:'wardrobe', name:'Tall wardrobe', glyph:'∩', colour:'#9d826e', footprint:[2.2,1.1], maker:makeArchedWardrobe },
    { id:'lamp', name:'Mushroom lamp', glyph:'●', colour:'#efbf72', footprint:[1.5,1.5], maker:makeMushroomLamp },
    { id:'rug', name:'Flower rug', glyph:'✿', colour:'#d99a91', footprint:[3.4,2.7], maker:makeFlowerRug },
    { id:'toybox', name:'Bunny box', glyph:'⌣', colour:'#8eb1b2', footprint:[1.9,1.2], maker:makeBunnyBox },
    { id:'plant', name:'Sprout plant', glyph:'✦', colour:'#77a27c', footprint:[1.2,1.2], maker:makeSproutPlant },
    { id:'beanbag', name:'Beanbag', glyph:'◒', colour:'#d08d82', footprint:[1.9,1.9], maker:makeBeanbag }
  ];

  const defaultItems = [
    { id:'seed-bed', type:'bed', room:'bedroom', x:-5.65, z:-0.25, rot:0 },
    { id:'seed-rug', type:'rug', room:'bedroom', x:-2.35, z:0.28, rot:0 },
    { id:'seed-lamp', type:'lamp', room:'bedroom', x:-1.62, z:-1.42, rot:0 },
    { id:'seed-sofa', type:'sofa', room:'living', x:4.10, z:-0.86, rot:0 },
    { id:'seed-plant', type:'plant', room:'living', x:6.78, z:-1.38, rot:0 },
    { id:'seed-table', type:'table', room:'play', x:-4.25, z:-0.38, rot:0 },
    { id:'seed-bean', type:'beanbag', room:'play', x:-6.62, z:0.28, rot:0 }
  ];

  let state = {
    lighting: 'day',
    rooms: Object.fromEntries(rooms.map(r => [r.id, { wall:r.wall, floor:r.floor }])),
    items: defaultItems.map(i => ({...i})),
    camera: { x:-4.2, y:7.0 }
  };
  let selectedId = null;
  let gesture = null;
  let activeRoomId = 'bedroom';
  let idCounter = 1;
  let resizeRaf = 0;
  let pointLights = [];

  const camera = {
    pos:v3(), target:v3(), fov:35,
    right:v3(), up:v3(), forward:v3(), focal:1, cx:0, cy:0
  };

  function roomById(id){ return rooms.find(r => r.id === id) || rooms[0]; }
  function templateById(id){ return templates.find(t => t.id === id); }

  function setupCamera() {
    camera.target = v3(state.camera.x, state.camera.y, 0);
    camera.pos = v3(state.camera.x, state.camera.y + 3.45, 18.2);
    camera.forward = norm(sub(camera.target,camera.pos));
    camera.right = norm(cross(camera.forward,v3(0,1,0)));
    camera.up = norm(cross(camera.right,camera.forward));
    camera.cx = canvas.width * 0.5;
    camera.cy = canvas.height * 0.49;
    camera.focal = (canvas.height*0.5) / Math.tan((camera.fov*Math.PI/180)*0.5);
  }

  function project(p) {
    const q = sub(p,camera.pos);
    const z = dot(q,camera.forward);
    if (z <= 0.05) return null;
    return { x:camera.cx + dot(q,camera.right)/z*camera.focal, y:camera.cy - dot(q,camera.up)/z*camera.focal, z };
  }

  function screenToPlane(sx,sy,planeY) {
    const dx=(sx-camera.cx)/camera.focal;
    const dy=(camera.cy-sy)/camera.focal;
    const dir=norm(add(camera.forward,add(mul(camera.right,dx),mul(camera.up,dy))));
    if(Math.abs(dir.y)<1e-5) return null;
    const t=(planeY-camera.pos.y)/dir.y;
    if(t<=0) return null;
    return add(camera.pos,mul(dir,t));
  }

  function rotatedNormal(n,a) {
    const ca=Math.cos(a), sa=Math.sin(a);
    return v3(n.x*ca-n.z*sa,n.y,n.x*sa+n.z*ca);
  }

  function gatherPointLights() {
    if (state.lighting !== 'evening') return [];
    return state.items.filter(i => i.type === 'lamp').map(i => {
      const r = roomById(i.room);
      return { pos:v3(i.x,r.floorY+1.55,i.z), power:1.0 };
    });
  }

  function lightingAmount(normal, center, emissive=false) {
    if (emissive && state.lighting === 'evening') return 0.30;
    const sunDir = norm(v3(-0.65,1.0,0.88));
    if (state.lighting === 'day') {
      const diffuse = Math.max(0,dot(normal,sunDir));
      const level = 0.48 + diffuse*0.68;
      return clamp((level-0.67)*0.48,-0.20,0.26);
    }
    let level = 0.30 + Math.max(0,dot(normal,norm(v3(0.2,1,0.25))))*0.15;
    pointLights.forEach(light => {
      const delta = sub(light.pos,center);
      const d = len(delta);
      if (d > 5.4) return;
      const facing = Math.max(0,dot(normal,norm(delta)));
      level += facing * (1-d/5.4) * 0.95 * light.power;
    });
    return clamp((level-0.57)*0.52,-0.30,0.28);
  }

  function litColor(hex, normal, center, emissive=false, bias=0) {
    return shade(hex, clamp(lightingAmount(normal,center,emissive)+bias,-0.35,0.35));
  }

  const boxFaces = [
    { ids:[0,1,2,3], n:v3(0,-1,0) },
    { ids:[4,7,6,5], n:v3(0,1,0) },
    { ids:[0,4,5,1], n:v3(0,0,-1) },
    { ids:[1,5,6,2], n:v3(1,0,0) },
    { ids:[2,6,7,3], n:v3(0,0,1) },
    { ids:[3,7,4,0], n:v3(-1,0,0) }
  ];

  function transformPart(p,item) {
    const room = roomById(item.room);
    const a=(item.rot||0)+(p.rot||0), ca=Math.cos(item.rot||0), sa=Math.sin(item.rot||0);
    const x=p.x*ca-p.z*sa;
    const z=p.x*sa+p.z*ca;
    return { ...p, x:item.x+x, y:room.floorY+p.y, z:item.z+z, rot:a };
  }

  function itemParts(item) {
    const t=templateById(item.type);
    return t ? t.maker().map(p => transformPart(p,item)) : [];
  }

  function boxVerts(p) {
    const w=p.w/2,h=p.h/2,d=p.d/2,a=p.rot||0,ca=Math.cos(a),sa=Math.sin(a);
    const raw=[[-w,-h,-d],[w,-h,-d],[w,-h,d],[-w,-h,d],[-w,h,-d],[w,h,-d],[w,h,d],[-w,h,d]];
    return raw.map(q => {
      const rx=q[0]*ca-q[2]*sa, rz=q[0]*sa+q[2]*ca;
      return v3(p.x+rx,p.y+q[1],p.z+rz);
    });
  }

  function pushBoxFaces(list,p,owner,selected=false) {
    const verts=boxVerts(p);
    const pv=verts.map(project);
    if(pv.some(v=>!v)) return;
    for(const f of boxFaces) {
      const pts=f.ids.map(i=>pv[i]);
      const normal=rotatedNormal(f.n,p.rot||0);
      const c=mul(f.ids.reduce((acc,i)=>add(acc,verts[i]),v3()),1/f.ids.length);
      if(dot(normal,norm(sub(camera.pos,c)))<=0.001) continue;
      const depth=pts.reduce((s,q)=>s+q.z,0)/pts.length;
      list.push({pts,depth,fill:litColor(p.color,normal,c,p.emissive,false),owner,selected});
    }
  }

  function pushCylinderFaces(list,p,owner,selected=false) {
    const seg=12, taper=p.taper==null?1:p.taper;
    const bottom=[],top=[];
    for(let i=0;i<seg;i++) {
      const ang=TAU*i/seg;
      bottom.push(v3(p.x+Math.cos(ang)*p.r,p.y,p.z+Math.sin(ang)*p.r));
      top.push(v3(p.x+Math.cos(ang)*p.r*taper,p.y+p.h,p.z+Math.sin(ang)*p.r*taper));
    }
    const all=[...bottom,...top].map(project);
    if(all.some(v=>!v)) return;
    for(let i=0;i<seg;i++) {
      const j=(i+1)%seg;
      const pts=[all[i],all[j],all[seg+j],all[seg+i]];
      const ang=TAU*(i+0.5)/seg;
      const normal=v3(Math.cos(ang),0,Math.sin(ang));
      const c=v3(p.x+normal.x*p.r,p.y+p.h*0.5,p.z+normal.z*p.r);
      const depth=pts.reduce((s,q)=>s+q.z,0)/4;
      list.push({pts,depth,fill:litColor(p.color,normal,c,p.emissive),owner,selected});
    }
    const topPts=top.map(project);
    const tc=v3(p.x,p.y+p.h,p.z);
    list.push({pts:topPts,depth:topPts.reduce((s,q)=>s+q.z,0)/seg,fill:litColor(p.color,v3(0,1,0),tc,p.emissive),owner,selected});
  }

  function ellipsoidPoints(p) {
    const lat=6, lon=12, rings=[];
    const a=p.rot||0,ca=Math.cos(a),sa=Math.sin(a);
    for(let iy=0;iy<=lat;iy++) {
      const phi=-Math.PI/2 + Math.PI*iy/lat;
      const cp=Math.cos(phi), sp=Math.sin(phi);
      const ring=[];
      for(let ix=0;ix<lon;ix++) {
        const th=TAU*ix/lon;
        const lx=Math.cos(th)*cp*p.rx;
        const lz=Math.sin(th)*cp*p.rz;
        const rx=lx*ca-lz*sa, rz=lx*sa+lz*ca;
        ring.push(v3(p.x+rx,p.y+sp*p.ry,p.z+rz));
      }
      rings.push(ring);
    }
    return rings;
  }

  function pushEllipsoidFaces(list,p,owner,selected=false) {
    const rings=ellipsoidPoints(p);
    const lat=rings.length-1, lon=rings[0].length;
    for(let iy=0;iy<lat;iy++) {
      for(let ix=0;ix<lon;ix++) {
        const j=(ix+1)%lon;
        const verts=[rings[iy][ix],rings[iy][j],rings[iy+1][j],rings[iy+1][ix]];
        const pts=verts.map(project);
        if(pts.some(v=>!v)) continue;
        const c=mul(verts.reduce((acc,v)=>add(acc,v),v3()),0.25);
        const local=v3((c.x-p.x)/(p.rx||1),(c.y-p.y)/(p.ry||1),(c.z-p.z)/(p.rz||1));
        const normal=norm(local);
        if(dot(normal,norm(sub(camera.pos,c)))<=0.001) continue;
        const depth=pts.reduce((s,q)=>s+q.z,0)/4;
        list.push({pts,depth,fill:litColor(p.color,normal,c,p.emissive),owner,selected});
      }
    }
  }

  function drawPoly(points,fill,stroke=null,width=1) {
    if(!points || !points.length || points.some(p=>!p)) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
    ctx.closePath();
    ctx.fillStyle=fill; ctx.fill();
    if(stroke) { ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke(); }
  }

  function roomFloorPoints(room) {
    return [
      v3(room.minX,room.floorY,room.backZ),v3(room.maxX,room.floorY,room.backZ),
      v3(room.maxX,room.floorY,room.frontZ),v3(room.minX,room.floorY,room.frontZ)
    ].map(project);
  }

  function wallRect(room,cx,cy,w,h,fill,stroke='#6f645d',lw=1.2) {
    const z=room.backZ+0.018;
    const pts=[v3(cx-w/2,room.floorY+cy-h/2,z),v3(cx+w/2,room.floorY+cy-h/2,z),v3(cx+w/2,room.floorY+cy+h/2,z),v3(cx-w/2,room.floorY+cy+h/2,z)].map(project);
    drawPoly(pts,fill,stroke,lw);
    return pts;
  }

  function drawRoomDecor(room) {
    if(room.decor==='window') {
      wallRect(room,room.cx,2.72,2.25,1.35,state.lighting==='day'?'#cce0e4':'#5e6779','#f7f0e8',5);
      wallRect(room,room.cx,2.72,0.08,1.35,'#f7f0e8',null);
      wallRect(room,room.cx,2.72,2.25,0.08,'#f7f0e8',null);
      wallRect(room,room.cx-1.30,2.65,0.38,1.65,'#d79b95',null);
      wallRect(room,room.cx+1.30,2.65,0.38,1.65,'#d79b95',null);
    } else if(room.decor==='gallery') {
      wallRect(room,room.cx-1.25,2.73,1.24,1.14,'#f2e6d8','#846f61',3);
      wallRect(room,room.cx+0.20,2.93,1.02,1.42,'#e3b39e','#846f61',3);
      wallRect(room,room.cx+1.45,2.62,1.10,0.92,'#d2c18d','#846f61',3);
      wallRect(room,room.cx-1.25,2.73,0.44,0.44,'#7c9a8e',null);
      wallRect(room,room.cx+0.20,2.93,0.38,0.58,'#758fa1',null);
    } else {
      const stars=[[-2.6,3.08],[-1.7,2.62],[-0.6,3.25],[0.6,2.72],[1.8,3.16],[2.65,2.48]];
      stars.forEach((s,i)=>wallRect(room,room.cx+s[0],s[1],0.30,0.30,i%2?'#e0b867':'#d18f86',null));
      wallRect(room,room.cx,1.82,3.2,0.09,'#f0d6aa',null);
    }
  }

  function drawRoom(room) {
    const style=state.rooms[room.id];
    const floorPts=roomFloorPoints(room);
    const floorCenter=v3(room.cx,room.floorY,room.backZ+ROOM_D*0.5);
    drawPoly(floorPts,litColor(style.floor,v3(0,1,0),floorCenter), 'rgba(52,47,44,.28)',2);

    const wallPts=[v3(room.minX,room.floorY,room.backZ),v3(room.maxX,room.floorY,room.backZ),v3(room.maxX,room.floorY+ROOM_H,room.backZ),v3(room.minX,room.floorY+ROOM_H,room.backZ)].map(project);
    const wallCenter=v3(room.cx,room.floorY+ROOM_H*0.5,room.backZ);
    drawPoly(wallPts,litColor(style.wall,v3(0,0,1),wallCenter),'rgba(52,47,44,.24)',2);

    const leftPts=[v3(room.minX,room.floorY,room.frontZ),v3(room.minX,room.floorY,room.backZ),v3(room.minX,room.floorY+ROOM_H,room.backZ),v3(room.minX,room.floorY+ROOM_H,room.frontZ)].map(project);
    drawPoly(leftPts,shade(style.wall,-0.08),'rgba(52,47,44,.20)',1.2);
    const rightPts=[v3(room.maxX,room.floorY,room.backZ),v3(room.maxX,room.floorY,room.frontZ),v3(room.maxX,room.floorY+ROOM_H,room.frontZ),v3(room.maxX,room.floorY+ROOM_H,room.backZ)].map(project);
    drawPoly(rightPts,shade(style.wall,-0.04),'rgba(52,47,44,.20)',1.2);

    const skirt=[v3(room.minX,room.floorY+0.05,room.backZ+0.02),v3(room.maxX,room.floorY+0.05,room.backZ+0.02),v3(room.maxX,room.floorY+0.18,room.backZ+0.02),v3(room.minX,room.floorY+0.18,room.backZ+0.02)].map(project);
    drawPoly(skirt,'#f6f0e8');

    ctx.save();ctx.strokeStyle='rgba(73,61,52,.09)';ctx.lineWidth=1;
    for(let z=room.backZ+0.75;z<room.frontZ;z+=0.75){
      const a=project(v3(room.minX,room.floorY+0.012,z)),b=project(v3(room.maxX,room.floorY+0.012,z));
      if(a&&b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    }
    ctx.restore();
    drawRoomDecor(room);
  }

  function tracePoly(points) {
    if(!points || !points.length) return false;
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
    ctx.closePath();return true;
  }

  function drawLampGlows() {
    if(state.lighting!=='evening') return;
    state.items.filter(i=>i.type==='lamp').forEach(item=>{
      const room=roomById(item.room);
      const p=project(v3(item.x,room.floorY+0.04,item.z));
      if(!p) return;
      const floor=roomFloorPoints(room);
      ctx.save();
      tracePoly(floor);ctx.clip();
      const radius=Math.max(90,canvas.width*0.16);
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
      g.addColorStop(0,'rgba(255,219,145,.25)');
      g.addColorStop(0.55,'rgba(255,211,128,.10)');
      g.addColorStop(1,'rgba(255,211,128,0)');
      ctx.fillStyle=g;ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
      ctx.restore();
    });
  }

  function drawItemShadow(item) {
    const t=templateById(item.type); if(!t || item.type==='rug') return;
    const room=roomById(item.room);
    let ox=0.18, oz=0.20, alpha=0.16;
    if(state.lighting==='day'){ox=0.34;oz=-0.16;alpha=0.18;}
    else {ox=0.08;oz=0.06;alpha=0.22;}
    const rx=t.footprint[0]*0.40, rz=t.footprint[1]*0.34;
    const pts=[];
    for(let i=0;i<16;i++){
      const a=TAU*i/16;
      pts.push(project(v3(item.x+ox+Math.cos(a)*rx,room.floorY+0.018,item.z+oz+Math.sin(a)*rz)));
    }
    drawPoly(pts,`rgba(53,45,41,${alpha})`);
  }

  function partBoundsPoints(p) {
    if(p.kind==='box') return boxVerts(p);
    if(p.kind==='cyl') {
      const out=[];
      for(let y of [p.y,p.y+p.h]) for(let i=0;i<8;i++){const a=TAU*i/8;out.push(v3(p.x+Math.cos(a)*p.r,p.y+(y-p.y),p.z+Math.sin(a)*p.r));}
      return out;
    }
    if(p.kind==='ellipsoid') {
      const out=[];
      for(const x of [-p.rx,p.rx]) for(const y of [-p.ry,p.ry]) for(const z of [-p.rz,p.rz]) out.push(v3(p.x+x,p.y+y,p.z+z));
      return out;
    }
    return [];
  }

  function drawHouseEdges() {
    rooms.forEach(room=>{
      const lines=[
        [v3(room.minX,room.floorY,room.frontZ),v3(room.maxX,room.floorY,room.frontZ)],
        [v3(room.minX,room.floorY,room.frontZ),v3(room.minX,room.floorY+ROOM_H,room.frontZ)],
        [v3(room.maxX,room.floorY,room.frontZ),v3(room.maxX,room.floorY+ROOM_H,room.frontZ)]
      ];
      ctx.save();ctx.strokeStyle='rgba(74,63,56,.58)';ctx.lineWidth=Math.max(2,canvas.width/340);ctx.lineCap='round';
      lines.forEach(line=>{const a=project(line[0]),b=project(line[1]);if(a&&b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}});
      ctx.restore();
    });
  }

  function render() {
    setupCamera();
    pointLights=gatherPointLights();
    ctx.fillStyle=state.lighting==='day'?'#ded6cc':'#7e777a';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    rooms.forEach(drawRoom);
    drawLampGlows();
    state.items.forEach(drawItemShadow);

    const list=[]; const bounds=[];
    for(const item of state.items) {
      const ownerPoints=[]; const isSel=item.id===selectedId;
      for(const p of itemParts(item)) {
        if(p.kind==='box') pushBoxFaces(list,p,item.id,isSel);
        else if(p.kind==='cyl') pushCylinderFaces(list,p,item.id,isSel);
        else if(p.kind==='ellipsoid') pushEllipsoidFaces(list,p,item.id,isSel);
        partBoundsPoints(p).forEach(v=>{const q=project(v);if(q)ownerPoints.push(q);});
      }
      if(ownerPoints.length) {
        bounds.push({
          id:item.id,
          minX:Math.min(...ownerPoints.map(p=>p.x))-7,
          maxX:Math.max(...ownerPoints.map(p=>p.x))+7,
          minY:Math.min(...ownerPoints.map(p=>p.y))-7,
          maxY:Math.max(...ownerPoints.map(p=>p.y))+7,
          depth:ownerPoints.reduce((s,p)=>s+p.z,0)/ownerPoints.length
        });
      }
    }
    list.sort((a,b)=>b.depth-a.depth);
    list.forEach(f=>drawPoly(f.pts,f.fill,'rgba(61,52,47,.12)',1));
    drawHouseEdges();

    if(selectedId) {
      const b=bounds.find(x=>x.id===selectedId);
      if(b){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(3,canvas.width/220);ctx.setLineDash([10,7]);ctx.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);ctx.restore();}
    }
    canvas._itemBounds=bounds;
  }

  function pointerPos(ev) {
    const r=canvas.getBoundingClientRect();
    return {x:(ev.clientX-r.left)/r.width*canvas.width,y:(ev.clientY-r.top)/r.height*canvas.height};
  }

  function pickAt(p) {
    const arr=(canvas._itemBounds||[]).filter(b=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY);
    if(!arr.length)return null;
    arr.sort((a,b)=>a.depth-b.depth);
    return arr[0].id;
  }

  function nearestRoom() {
    let best=rooms[0], score=Infinity;
    rooms.forEach(room=>{
      const dx=state.camera.x-room.cx;
      const dy=state.camera.y-(room.floorY+2.05);
      const s=dx*dx+dy*dy*1.35;
      if(s<score){score=s;best=room;}
    });
    return best;
  }

  function refreshActiveRoom(force=false) {
    const next=nearestRoom().id;
    if(!force && next===activeRoomId)return;
    activeRoomId=next;
    const room=roomById(activeRoomId);
    roomLabel.textContent=room.name;
    buildSwatches(wallSwatches,wallPalette,'wall');
    buildSwatches(floorSwatches,floorPalette,'floor');
  }

  function clampItemToRoom(item) {
    const room=roomById(item.room), t=templateById(item.type);
    if(!t)return;
    const a=item.rot||0;
    const swap=Math.abs(Math.sin(a))>0.5;
    const fw=swap?t.footprint[1]:t.footprint[0];
    const fd=swap?t.footprint[0]:t.footprint[1];
    item.x=clamp(item.x,room.minX+fw*0.48,room.maxX-fw*0.48);
    // The front is deliberately open: keep furniture away from the missing fourth wall.
    item.z=clamp(item.z,room.backZ+fd*0.48,room.frontZ-fd*0.55-0.22);
  }

  canvas.addEventListener('pointerdown',ev=>{
    const p=pointerPos(ev), id=pickAt(p);
    if(id){
      selectedId=id;updateSelection();render();
      const item=state.items.find(i=>i.id===id), room=item&&roomById(item.room);
      const floor=room&&screenToPlane(p.x,p.y,room.floorY);
      if(item&&floor){gesture={mode:'item',id,pointerId:ev.pointerId,dx:item.x-floor.x,dz:item.z-floor.z,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,moved:false};}
    } else {
      selectedId=null;updateSelection();render();
      gesture={mode:'pan',pointerId:ev.pointerId,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,moved:false};
    }
    try{canvas.setPointerCapture(ev.pointerId);}catch{}
  });

  canvas.addEventListener('pointermove',ev=>{
    if(!gesture||gesture.pointerId!==ev.pointerId)return;
    const p=pointerPos(ev);
    if(Math.hypot(p.x-gesture.startX,p.y-gesture.startY)>6)gesture.moved=true;
    if(gesture.mode==='item'){
      const item=state.items.find(i=>i.id===gesture.id);if(!item)return;
      const room=roomById(item.room), floor=screenToPlane(p.x,p.y,room.floorY);if(!floor)return;
      item.x=floor.x+gesture.dx;item.z=floor.z+gesture.dz;clampItemToRoom(item);
      hint.textContent='Drag it into place';render();
    } else {
      const scale=11.2/canvas.width;
      const dx=p.x-gesture.lastX,dy=p.y-gesture.lastY;
      state.camera.x=clamp(state.camera.x-dx*scale,-5.3,5.4);
      state.camera.y=clamp(state.camera.y+dy*scale,1.85,7.25);
      gesture.lastX=p.x;gesture.lastY=p.y;
      refreshActiveRoom();
      hint.textContent='Drag empty space to explore the house';render();
    }
  });

  function endGesture(ev){
    if(!gesture||gesture.pointerId!==ev.pointerId)return;
    try{canvas.releasePointerCapture(ev.pointerId);}catch{}
    if(gesture.mode==='pan'&&!gesture.moved)hint.textContent='Drag empty space to explore the house';
    gesture=null;save();
  }
  canvas.addEventListener('pointerup',endGesture);
  canvas.addEventListener('pointercancel',endGesture);

  rotateBtn.addEventListener('click',()=>{
    const item=state.items.find(i=>i.id===selectedId);if(!item)return;
    item.rot=((item.rot||0)+Math.PI/2)%TAU;clampItemToRoom(item);save();render();
  });

  removeBtn.addEventListener('click',()=>{
    if(!selectedId)return;
    state.items=state.items.filter(i=>i.id!==selectedId);selectedId=null;updateSelection();save();render();hint.textContent='Put away — choose something else';
  });

  clearBtn.addEventListener('click',()=>{
    state.items=state.items.filter(i=>i.room!==activeRoomId);selectedId=null;updateSelection();save();render();hint.textContent=`${roomById(activeRoomId).name} cleared`;
  });

  lightingBtn.addEventListener('click',()=>{
    state.lighting=state.lighting==='day'?'evening':'day';
    updateLightingButton();save();render();
  });

  prevBtn.addEventListener('click',()=>carousel.scrollBy({left:-carousel.clientWidth*0.72,behavior:'smooth'}));
  nextBtn.addEventListener('click',()=>carousel.scrollBy({left:carousel.clientWidth*0.72,behavior:'smooth'}));

  function addItem(type) {
    const t=templateById(type), room=roomById(activeRoomId);if(!t)return;
    const count=state.items.filter(i=>i.room===room.id).length;
    const item={id:`item-${Date.now()}-${idCounter++}`,type,room:room.id,x:room.cx+((count%3)-1)*0.35,z:0.10+((count%2)?0.32:-0.18),rot:0};
    clampItemToRoom(item);state.items.push(item);selectedId=item.id;updateSelection();save();render();hint.textContent=`Drag the ${t.name.toLowerCase()} into place`;
  }

  function buildCarousel() {
    carousel.innerHTML='';
    templates.forEach(t=>{
      const b=document.createElement('button');b.type='button';b.className='room-item-card';
      b.innerHTML=`<span class="room-item-glyph" style="--room-item-colour:${t.colour}">${t.glyph}</span><strong>${t.name}</strong><small>Add</small>`;
      b.addEventListener('click',()=>addItem(t.id));carousel.appendChild(b);
    });
  }

  function buildSwatches(holder,palette,key) {
    if(!holder)return;
    const style=state.rooms[activeRoomId];holder.innerHTML='';
    palette.forEach(col=>{
      const b=document.createElement('button');b.type='button';b.className='room-swatch';b.style.background=col;b.setAttribute('aria-label',`${key} colour ${col}`);
      if(style[key]===col)b.classList.add('active');
      b.addEventListener('click',()=>{style[key]=col;[...holder.children].forEach(x=>x.classList.toggle('active',x===b));save();render();});
      holder.appendChild(b);
    });
  }

  function updateSelection() {
    const item=state.items.find(i=>i.id===selectedId),t=item&&templateById(item.type);
    selectedName.textContent=t?t.name:'Nothing selected';rotateBtn.disabled=!item;removeBtn.disabled=!item;
  }

  function updateLightingButton() {
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
        lighting:parsed.lighting==='evening'?'evening':'day',
        rooms:roomState,
        items:parsed.items.filter(i=>templateById(i.type)&&rooms.some(r=>r.id===i.room)).slice(0,60),
        camera:{x:clamp(parsed.camera&&Number.isFinite(Number(parsed.camera.x))?Number(parsed.camera.x):-4.2,-5.3,5.4),y:clamp(parsed.camera&&Number.isFinite(Number(parsed.camera.y))?Number(parsed.camera.y):7.0,1.85,7.25)}
      };
      state.items.forEach(clampItemToRoom);
    }catch{}
  }

  function resizeCanvas() {
    const r=canvas.getBoundingClientRect();if(!r.width)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const cssW=r.width,cssH=Math.max(390,Math.min(560,cssW*1.02));
    canvas.style.height=`${cssH}px`;
    const w=Math.round(cssW*dpr),h=Math.round(cssH*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    render();
  }
  function queueResize(){cancelAnimationFrame(resizeRaf);resizeRaf=requestAnimationFrame(resizeCanvas);}

  load();
  activeRoomId=nearestRoom().id;
  buildCarousel();
  refreshActiveRoom(true);
  updateSelection();updateLightingButton();
  window.addEventListener('resize',queueResize,{passive:true});
  if('ResizeObserver'in window)new ResizeObserver(queueResize).observe(canvas.parentElement);
  queueResize();
})();
