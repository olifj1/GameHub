(() => {
  'use strict';

  const canvas = document.getElementById('room-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
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

  if (!canvas || !ctx) return;

  const STORAGE_KEY = 'gamehub-my-room-v1';
  const ROOM = { minX: -5, maxX: 5, minZ: -4.2, maxZ: 4.1 };
  const TAU = Math.PI * 2;

  const wallPalette = ['#efe6de', '#eadfd0', '#dde6df', '#dfe4ed', '#eadde4', '#eee4c9'];
  const floorPalette = ['#c9ad8b', '#b99c7d', '#d4c8b7', '#9fa79f', '#b6a79b', '#c9b8a0'];

  const templates = [
    { id: 'bed', name: 'Bed', glyph: '▰', colour: '#c78e82', size: [2.7, 1.35, 3.35], maker: makeBed },
    { id: 'chair', name: 'Chair', glyph: '⌑', colour: '#8fa79a', size: [1.35, 1.75, 1.35], maker: makeChair },
    { id: 'desk', name: 'Table', glyph: '▱', colour: '#b18d69', size: [2.25, 1.45, 1.35], maker: makeDesk },
    { id: 'sofa', name: 'Sofa', glyph: '▭', colour: '#859aaa', size: [2.65, 1.55, 1.35], maker: makeSofa },
    { id: 'dresser', name: 'Drawers', glyph: '▦', colour: '#b49372', size: [2.15, 1.7, 1.0], maker: makeDresser },
    { id: 'shelf', name: 'Bookshelf', glyph: '▥', colour: '#8d775f', size: [2.0, 2.75, 0.75], maker: makeShelf },
    { id: 'lamp', name: 'Lamp', glyph: '◒', colour: '#d1a866', size: [0.85, 2.1, 0.85], maker: makeLamp },
    { id: 'rug', name: 'Rug', glyph: '▰', colour: '#b88478', size: [2.9, 0.08, 2.1], maker: makeRug },
    { id: 'chest', name: 'Toy box', glyph: '▣', colour: '#8ba9aa', size: [1.8, 0.95, 1.0], maker: makeChest },
    { id: 'plant', name: 'Plant', glyph: '✦', colour: '#6f9278', size: [1.0, 1.9, 1.0], maker: makePlant }
  ];

  let state = {
    wall: wallPalette[0],
    floor: floorPalette[0],
    items: []
  };
  let selectedId = null;
  let drag = null;
  let idCounter = 1;
  let resizeRaf = 0;

  const camera = {
    pos: v3(8.9, 7.2, 11.8),
    target: v3(-0.2, 1.45, -0.15),
    fov: 42,
    right: v3(), up: v3(), forward: v3(), focal: 1, cx: 0, cy: 0
  };

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
    const p = Math.abs(amount);
    r = Math.round((target-r)*p+r); g = Math.round((target-g)*p+g); b = Math.round((target-b)*p+b);
    return `rgb(${r},${g},${b})`;
  }

  function box(x,y,z,w,h,d,color, opts={}) {
    return { kind:'box', x,y,z,w,h,d,color, ...opts };
  }

  function cyl(x,y,z,r,h,color, opts={}) {
    return { kind:'cyl', x,y,z,r,h,color, ...opts };
  }

  function makeBed(c) {
    return [
      box(0,0.18,0,c[0],0.36,c[2],'#b99372'),
      box(0,0.53,0,c[0]*0.94,0.36,c[2]*0.92,'#f2eee7'),
      box(0,0.78,-c[2]*0.33,c[0]*0.92,0.12,c[2]*0.2,'#dca69c'),
      box(-c[0]*0.23,0.82,-c[2]*0.27,c[0]*0.38,0.16,c[2]*0.24,'#fffaf2'),
      box(c[0]*0.23,0.82,-c[2]*0.27,c[0]*0.38,0.16,c[2]*0.24,'#fffaf2'),
      box(0,0.95,-c[2]*0.48,c[0],1.05,0.12,'#a87961')
    ];
  }
  function makeChair(c) {
    const leg = '#76614f';
    return [
      box(0,0.78,0,c[0],0.24,c[2],c.colour || '#8fa79a'),
      box(0,1.37,-c[2]*0.44,c[0],1.05,0.18,c.colour || '#8fa79a'),
      box(-c[0]*0.37,0.36,-c[2]*0.34,0.16,0.72,0.16,leg),
      box(c[0]*0.37,0.36,-c[2]*0.34,0.16,0.72,0.16,leg),
      box(-c[0]*0.37,0.36,c[2]*0.34,0.16,0.72,0.16,leg),
      box(c[0]*0.37,0.36,c[2]*0.34,0.16,0.72,0.16,leg)
    ];
  }
  function makeDesk(c) {
    const leg = '#8b6e53';
    return [
      box(0,1.02,0,c[0],0.22,c[2],c.colour || '#b18d69'),
      box(-c[0]*0.4,0.48,-c[2]*0.34,0.16,0.96,0.16,leg),
      box(c[0]*0.4,0.48,-c[2]*0.34,0.16,0.96,0.16,leg),
      box(-c[0]*0.4,0.48,c[2]*0.34,0.16,0.96,0.16,leg),
      box(c[0]*0.4,0.48,c[2]*0.34,0.16,0.96,0.16,leg)
    ];
  }
  function makeSofa(c) {
    const col = c.colour || '#859aaa';
    return [
      box(0,0.47,0,c[0],0.7,c[2],shade(col,0.05)),
      box(0,1.05,-c[2]*0.38,c[0],0.95,c[2]*0.25,col),
      box(-c[0]*0.46,0.8,0,c[0]*0.12,0.8,c[2]*0.92,col),
      box(c[0]*0.46,0.8,0,c[0]*0.12,0.8,c[2]*0.92,col),
      box(-c[0]*0.24,0.83,0.08,c[0]*0.43,0.22,c[2]*0.73,shade(col,0.13)),
      box(c[0]*0.24,0.83,0.08,c[0]*0.43,0.22,c[2]*0.73,shade(col,0.13))
    ];
  }
  function makeDresser(c) {
    const col = c.colour || '#b49372';
    return [
      box(0,0.85,0,c[0],1.7,c[2],col),
      box(0,1.42,c[2]*0.505,c[0]*0.84,0.05,0.03,shade(col,-0.18),{decal:true}),
      box(0,0.88,c[2]*0.505,c[0]*0.84,0.05,0.03,shade(col,-0.18),{decal:true}),
      box(0,0.34,c[2]*0.505,c[0]*0.84,0.05,0.03,shade(col,-0.18),{decal:true})
    ];
  }
  function makeShelf(c) {
    const col = c.colour || '#8d775f';
    const parts = [box(0,1.37,0,c[0],2.74,c[2],col)];
    for (let i=0;i<4;i++) parts.push(box(0,0.52+i*0.58,c[2]*0.51,c[0]*0.84,0.08,0.05,shade(col,-0.17),{decal:true}));
    return parts;
  }
  function makeLamp(c) {
    const col = c.colour || '#d1a866';
    return [
      cyl(0,0,0,0.4,0.18,'#876d58'),
      cyl(0,0.18,0,0.09,1.4,'#7e6d5d'),
      cyl(0,1.58,0,0.42,0.48,col,{taper:0.62})
    ];
  }
  function makeRug(c) { return [box(0,0.035,0,c[0],0.07,c[2],c.colour || '#b88478')]; }
  function makeChest(c) {
    const col = c.colour || '#8ba9aa';
    return [box(0,0.42,0,c[0],0.84,c[2],col),box(0,0.91,0,c[0]*1.02,0.14,c[2]*1.04,shade(col,-0.05))];
  }
  function makePlant(c) {
    const col = c.colour || '#6f9278';
    return [
      cyl(0,0,0,0.42,0.58,'#a7795d',{taper:0.82}),
      cyl(0,0.58,0,0.08,0.78,'#647962'),
      cyl(-0.18,1.18,0.04,0.32,0.54,col,{taper:0.22}),
      cyl(0.22,1.35,-0.08,0.34,0.55,shade(col,0.07),{taper:0.22}),
      cyl(0.03,1.55,0.15,0.30,0.48,shade(col,-0.04),{taper:0.22})
    ];
  }

  function templateById(id){ return templates.find(t=>t.id===id); }
  function itemParts(item) {
    const t = templateById(item.type);
    if (!t) return [];
    const cfg = { 0:t.size[0],1:t.size[1],2:t.size[2], colour:t.colour };
    const parts = t.maker(cfg);
    return parts.map(p => transformPart(p,item));
  }

  function transformPart(p,item) {
    const a = item.rot || 0, ca=Math.cos(a), sa=Math.sin(a);
    const x = p.x*ca - p.z*sa;
    const z = p.x*sa + p.z*ca;
    return { ...p, x:item.x+x, z:item.z+z, rot:a };
  }

  function setupCamera() {
    camera.forward = norm(sub(camera.target,camera.pos));
    camera.right = norm(cross(camera.forward,v3(0,1,0)));
    camera.up = norm(cross(camera.right,camera.forward));
    camera.cx = canvas.width*0.5;
    camera.cy = canvas.height*0.49;
    camera.focal = (canvas.height*0.5)/Math.tan((camera.fov*Math.PI/180)*0.5);
  }

  function project(p) {
    const q=sub(p,camera.pos);
    const z=dot(q,camera.forward);
    if (z <= 0.05) return null;
    return { x:camera.cx + dot(q,camera.right)/z*camera.focal, y:camera.cy - dot(q,camera.up)/z*camera.focal, z };
  }

  function screenToFloor(sx,sy) {
    const dx=(sx-camera.cx)/camera.focal;
    const dy=(camera.cy-sy)/camera.focal;
    const dir=norm(add(camera.forward,add(mul(camera.right,dx),mul(camera.up,dy))));
    if (Math.abs(dir.y)<1e-5) return null;
    const t=-camera.pos.y/dir.y;
    if (t<=0) return null;
    return add(camera.pos,mul(dir,t));
  }

  const faces = [
    { ids:[0,1,2,3], n:v3(0,-1,0), s:-0.16 },
    { ids:[4,7,6,5], n:v3(0,1,0), s:0.12 },
    { ids:[0,4,5,1], n:v3(0,0,-1), s:-0.06 },
    { ids:[1,5,6,2], n:v3(1,0,0), s:-0.11 },
    { ids:[2,6,7,3], n:v3(0,0,1), s:0.02 },
    { ids:[3,7,4,0], n:v3(-1,0,0), s:-0.03 }
  ];

  function boxVerts(p) {
    const x=p.x,y=p.y,z=p.z,w=p.w/2,h=p.h/2,d=p.d/2,a=p.rot||0,ca=Math.cos(a),sa=Math.sin(a);
    const raw=[[-w,-h,-d],[w,-h,-d],[w,-h,d],[-w,-h,d],[-w,h,-d],[w,h,-d],[w,h,d],[-w,h,d]];
    return raw.map(q=>{
      const rx=q[0]*ca-q[2]*sa, rz=q[0]*sa+q[2]*ca;
      return v3(x+rx,y+q[1],z+rz);
    });
  }

  function pushBoxFaces(list,p,owner,selected=false) {
    const verts=boxVerts(p);
    const pv=verts.map(project);
    if (pv.some(v=>!v)) return;
    const ca=Math.cos(p.rot||0),sa=Math.sin(p.rot||0);
    for (const f of faces) {
      const pts=f.ids.map(i=>pv[i]);
      let n=f.n;
      n=v3(n.x*ca-n.z*sa,n.y,n.x*sa+n.z*ca);
      const center=f.ids.reduce((acc,i)=>add(acc,verts[i]),v3());
      const c=mul(center,1/f.ids.length);
      const toCam=norm(sub(camera.pos,c));
      if (dot(n,toCam)<=0.001) continue;
      const depth=pts.reduce((s,q)=>s+q.z,0)/pts.length;
      list.push({pts,depth,fill:shade(p.color,f.s),owner,selected});
    }
  }

  function pushCylinderFaces(list,p,owner,selected=false) {
    const seg=10, a=p.rot||0, taper=p.taper==null?1:p.taper;
    const bottom=[],top=[];
    for(let i=0;i<seg;i++){
      const ang=TAU*i/seg+a;
      bottom.push(v3(p.x+Math.cos(ang)*p.r,p.y,p.z+Math.sin(ang)*p.r));
      top.push(v3(p.x+Math.cos(ang)*p.r*taper,p.y+p.h,p.z+Math.sin(ang)*p.r*taper));
    }
    const all=[...bottom,...top].map(project);
    if(all.some(v=>!v)) return;
    for(let i=0;i<seg;i++){
      const j=(i+1)%seg;
      const pts=[all[i],all[j],all[seg+j],all[seg+i]];
      const depth=pts.reduce((s,q)=>s+q.z,0)/4;
      list.push({pts,depth,fill:shade(p.color,-0.04+0.09*Math.cos(TAU*(i+0.5)/seg)),owner,selected});
    }
    const topPts=top.map(project);
    list.push({pts:topPts,depth:topPts.reduce((s,q)=>s+q.z,0)/seg,fill:shade(p.color,0.12),owner,selected});
  }

  function drawPoly(points, fill, stroke=null, width=1) {
    if (!points.length) return;
    ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
    if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=width; ctx.lineJoin='round'; ctx.stroke(); }
  }

  function render() {
    setupCamera();
    ctx.fillStyle='#f3eee8'; ctx.fillRect(0,0,canvas.width,canvas.height);

    const floorPts=[v3(ROOM.minX,0,ROOM.minZ),v3(ROOM.maxX,0,ROOM.minZ),v3(ROOM.maxX,0,ROOM.maxZ),v3(ROOM.minX,0,ROOM.maxZ)].map(project);
    drawPoly(floorPts,state.floor,'rgba(45,42,39,.22)',2);

    drawWallBack();
    drawWallLeft();
    drawFloorLines();

    const list=[];
    const bounds=[];
    for(const item of state.items){
      const parts=itemParts(item);
      const owner=item.id;
      const isSel=owner===selectedId;
      const ownerPoints=[];
      for(const p of parts){
        if(p.kind==='box') {
          pushBoxFaces(list,p,owner,isSel);
          boxVerts(p).forEach(v=>{const q=project(v); if(q) ownerPoints.push(q);});
        } else if(p.kind==='cyl') {
          pushCylinderFaces(list,p,owner,isSel);
          const q=project(v3(p.x,p.y+p.h*0.5,p.z)); if(q) ownerPoints.push(q);
          for(let i=0;i<8;i++){ const an=TAU*i/8; const qq=project(v3(p.x+Math.cos(an)*p.r,p.y,p.z+Math.sin(an)*p.r)); if(qq) ownerPoints.push(qq); }
        }
      }
      if(ownerPoints.length){
        bounds.push({id:owner,minX:Math.min(...ownerPoints.map(p=>p.x))-8,maxX:Math.max(...ownerPoints.map(p=>p.x))+8,minY:Math.min(...ownerPoints.map(p=>p.y))-8,maxY:Math.max(...ownerPoints.map(p=>p.y))+8,depth:ownerPoints.reduce((s,p)=>s+p.z,0)/ownerPoints.length});
      }
    }
    list.sort((a,b)=>b.depth-a.depth);
    for(const f of list){ drawPoly(f.pts,f.fill,'rgba(54,49,45,.14)',1.1); }

    if(selectedId){
      const b=bounds.find(b=>b.id===selectedId);
      if(b){
        ctx.save(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=5; ctx.setLineDash([10,7]); ctx.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY); ctx.restore();
      }
    }
    canvas._itemBounds=bounds;
  }

  function drawWallBack(){
    const y=3.9;
    const pts=[v3(ROOM.minX,0,ROOM.minZ),v3(ROOM.maxX,0,ROOM.minZ),v3(ROOM.maxX,y,ROOM.minZ),v3(ROOM.minX,y,ROOM.minZ)].map(project);
    drawPoly(pts,state.wall,'rgba(45,42,39,.2)',2);
    const skirting=[v3(ROOM.minX,0.04,ROOM.minZ+0.02),v3(ROOM.maxX,0.04,ROOM.minZ+0.02),v3(ROOM.maxX,0.18,ROOM.minZ+0.02),v3(ROOM.minX,0.18,ROOM.minZ+0.02)].map(project);
    drawPoly(skirting,'#f7f3ee');
  }
  function drawWallLeft(){
    const y=3.9;
    const pts=[v3(ROOM.minX,0,ROOM.maxZ),v3(ROOM.minX,0,ROOM.minZ),v3(ROOM.minX,y,ROOM.minZ),v3(ROOM.minX,y,ROOM.maxZ)].map(project);
    drawPoly(pts,shade(state.wall,-0.04),'rgba(45,42,39,.2)',2);
    const skirting=[v3(ROOM.minX+0.02,0.04,ROOM.maxZ),v3(ROOM.minX+0.02,0.04,ROOM.minZ),v3(ROOM.minX+0.02,0.18,ROOM.minZ),v3(ROOM.minX+0.02,0.18,ROOM.maxZ)].map(project);
    drawPoly(skirting,'#eee9e3');
  }
  function drawFloorLines(){
    ctx.save(); ctx.strokeStyle='rgba(69,61,54,.08)'; ctx.lineWidth=1;
    for(let x=ROOM.minX+1;x<ROOM.maxX;x+=1){ const a=project(v3(x,0.012,ROOM.minZ)),b=project(v3(x,0.012,ROOM.maxZ)); ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); }
    ctx.restore();
  }

  function pointerPos(ev){
    const r=canvas.getBoundingClientRect();
    return {x:(ev.clientX-r.left)/r.width*canvas.width,y:(ev.clientY-r.top)/r.height*canvas.height};
  }
  function pickAt(p){
    const arr=(canvas._itemBounds||[]).filter(b=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY);
    if(!arr.length) return null;
    arr.sort((a,b)=>a.depth-b.depth);
    return arr[0].id;
  }

  canvas.addEventListener('pointerdown', ev=>{
    const p=pointerPos(ev);
    const id=pickAt(p);
    if(id){
      selectedId=id; updateSelection(); render();
      const item=state.items.find(i=>i.id===id);
      const floor=screenToFloor(p.x,p.y);
      if(item&&floor){ drag={id,pointerId:ev.pointerId,dx:item.x-floor.x,dz:item.z-floor.z,moved:false,startX:p.x,startY:p.y}; canvas.setPointerCapture(ev.pointerId); }
    } else { selectedId=null; updateSelection(); render(); }
  });
  canvas.addEventListener('pointermove', ev=>{
    if(!drag||drag.pointerId!==ev.pointerId) return;
    const p=pointerPos(ev);
    if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>6) drag.moved=true;
    const floor=screenToFloor(p.x,p.y); if(!floor) return;
    const item=state.items.find(i=>i.id===drag.id); if(!item) return;
    const t=templateById(item.type); const margin=Math.max(t.size[0],t.size[2])*0.34;
    item.x=clamp(floor.x+drag.dx,ROOM.minX+margin,ROOM.maxX-margin);
    item.z=clamp(floor.z+drag.dz,ROOM.minZ+margin,ROOM.maxZ-margin);
    hint.textContent='Drag it wherever you like';
    render();
  });
  function endDrag(ev){ if(!drag||drag.pointerId!==ev.pointerId) return; try{canvas.releasePointerCapture(ev.pointerId);}catch{} drag=null; save(); }
  canvas.addEventListener('pointerup',endDrag); canvas.addEventListener('pointercancel',endDrag);

  rotateBtn.addEventListener('click',()=>{
    const item=state.items.find(i=>i.id===selectedId); if(!item) return;
    item.rot=((item.rot||0)+Math.PI/2)%TAU; save(); render();
  });
  removeBtn.addEventListener('click',()=>{
    if(!selectedId) return; state.items=state.items.filter(i=>i.id!==selectedId); selectedId=null; updateSelection(); save(); render(); hint.textContent='Choose something below to add it';
  });
  clearBtn.addEventListener('click',()=>{
    state.items=[]; selectedId=null; updateSelection(); save(); render(); hint.textContent='Room cleared — choose something new';
  });

  prevBtn.addEventListener('click',()=>carousel.scrollBy({left:-carousel.clientWidth*0.72,behavior:'smooth'}));
  nextBtn.addEventListener('click',()=>carousel.scrollBy({left:carousel.clientWidth*0.72,behavior:'smooth'}));

  function addItem(type){
    const t=templateById(type); if(!t) return;
    const spread=((state.items.length%5)-2)*0.38;
    const item={id:`item-${Date.now()}-${idCounter++}`,type,x:clamp(spread,-2.2,2.2),z:clamp(0.6+((state.items.length%3)-1)*0.42,-1.4,2.2),rot:0};
    state.items.push(item); selectedId=item.id; updateSelection(); save(); render(); hint.textContent=`Drag the ${t.name.toLowerCase()} into place`;
  }

  function buildCarousel(){
    carousel.innerHTML='';
    templates.forEach(t=>{
      const b=document.createElement('button'); b.type='button'; b.className='room-item-card'; b.innerHTML=`<span class="room-item-glyph" style="--room-item-colour:${t.colour}">${t.glyph}</span><strong>${t.name}</strong><small>Add</small>`;
      b.addEventListener('click',()=>addItem(t.id)); carousel.appendChild(b);
    });
  }

  function buildSwatches(holder,palette,key){
    holder.innerHTML='';
    palette.forEach(col=>{
      const b=document.createElement('button'); b.type='button'; b.className='room-swatch'; b.style.background=col; b.setAttribute('aria-label',`${key} colour ${col}`);
      if(state[key]===col) b.classList.add('active');
      b.addEventListener('click',()=>{ state[key]=col; [...holder.children].forEach(x=>x.classList.toggle('active',x===b)); save(); render(); });
      holder.appendChild(b);
    });
  }

  function updateSelection(){
    const item=state.items.find(i=>i.id===selectedId); const t=item&&templateById(item.type);
    selectedName.textContent=t?t.name:'Nothing selected'; rotateBtn.disabled=!item; removeBtn.disabled=!item;
  }

  function save(){ try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }catch{} }
  function load(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return;
      const parsed=JSON.parse(raw); if(parsed&&Array.isArray(parsed.items)) state={wall:parsed.wall||wallPalette[0],floor:parsed.floor||floorPalette[0],items:parsed.items.filter(i=>templateById(i.type)).slice(0,40)};
    }catch{}
  }

  function resizeCanvas(){
    const r=canvas.getBoundingClientRect(); if(!r.width) return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const cssW=r.width, cssH=Math.max(390,Math.min(580,cssW*1.07));
    canvas.style.height=`${cssH}px`;
    const w=Math.round(cssW*dpr),h=Math.round(cssH*dpr);
    if(canvas.width!==w||canvas.height!==h){ canvas.width=w;canvas.height=h; }
    render();
  }
  function queueResize(){ cancelAnimationFrame(resizeRaf); resizeRaf=requestAnimationFrame(resizeCanvas); }

  load(); buildCarousel(); buildSwatches(wallSwatches,wallPalette,'wall'); buildSwatches(floorSwatches,floorPalette,'floor'); updateSelection();
  window.addEventListener('resize',queueResize,{passive:true});
  if('ResizeObserver' in window) new ResizeObserver(queueResize).observe(canvas.parentElement);
  queueResize();
})();
