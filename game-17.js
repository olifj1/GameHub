(() => {
  'use strict';

  const canvas = document.getElementById('walklab-canvas');
  const ctx = canvas.getContext('2d');
  const readout = document.getElementById('walklab-readout');
  const editHint = document.getElementById('walklab-edit-hint');
  const scrub = document.getElementById('walklab-scrub');
  const prev = document.getElementById('walklab-prev');
  const next = document.getElementById('walklab-next');
  const playBtn = document.getElementById('walklab-play');
  const onionBtn = document.getElementById('walklab-onion');
  const keysBtn = document.getElementById('walklab-keys');
  const midsBtn = document.getElementById('walklab-mids');
  const resetBtn = document.getElementById('walklab-reset');
  const copyBtn = document.getElementById('walklab-copy');
  const pasteBtn = document.getElementById('walklab-paste');
  const saveBtn = document.getElementById('walklab-save');
  const loadBtn = document.getElementById('walklab-load');
  const exportBtn = document.getElementById('walklab-export');
  const rigArtBtn = document.getElementById('walklab-rigart');
  const fileInput = document.getElementById('walklab-file');
  const spriteBtn = document.getElementById('walklab-sprite');
  const spriteLoadBtn = document.getElementById('walklab-sprite-load');
  const spriteFileInput = document.getElementById('walklab-sprite-file');
  const fpsSlider = document.getElementById('walklab-fps');
  const fpsOut = document.getElementById('walklab-fps-out');


  // Export format is deliberately fixed so every animation uses exactly the
  // same sprite-cell proportions. The user only needs to position/scale the
  // visible crop frame in the editor.
  const EXPORT = Object.freeze({
    cellW: 256,
    cellH: 384,
    cols: 4,
    rows: 4,
    aspect: 2 / 3
  });

  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;

  // Deliberately simple fixed-length side-view stick rig.
  const BODY = Object.freeze({
    torso: 0.40,
    neck: 0.055,
    headR: 0.105,
    upperArm: 0.255,
    lowerArm: 0.245,
    upperLeg: 0.38,
    lowerLeg: 0.38,
    foot: 0.15,
    hair: 0.48
  });

  const KEY_NAMES = ['Contact L','Down L','Passing L','Up L','Contact R','Down R','Passing R','Up R'];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clonePose(p) { return JSON.parse(JSON.stringify(p)); }

  function makeKey(i) {
    const pelvisY = [0.700, 0.655, 0.690, 0.735, 0.700, 0.655, 0.690, 0.735][i];
    // A consistent slight forward lean reads more naturally for a travelling walk.
    const lean = [7, 9, 8, 6, 7, 9, 8, 6][i] * DEG;

    // Eight deliberate key poses. During each stance, the planted foot moves
    // backwards by exactly the same amount that travel moves forwards, so its
    // world position stays fixed. Both feet are shifted slightly left so the
    // legs sit more naturally under the centre of mass.
    const aFootX = [ 0.180,  0.055, -0.070, -0.195, -0.320, -0.260, -0.070,  0.100][i];
    const bFootX = [-0.320, -0.260, -0.070,  0.100,  0.180,  0.055, -0.070, -0.195][i];
    const aFootLift = [0.000,0.000,0.000,0.000,0.000,0.035,0.160,0.120][i];
    const bFootLift = [0.000,0.035,0.160,0.120,0.000,0.000,0.000,0.000][i];

    // Smooth contralateral arm swing. These hand targets describe a simple
    // pendulum arc, with the opposite arm exactly half a cycle out of phase.
    // The in-between frames then interpolate cleanly without a mid-cycle pop.
    const aHandX = [-0.200,-0.141, 0.000, 0.141, 0.200, 0.141, 0.000,-0.141][i];
    const bHandX = [ 0.200, 0.141, 0.000,-0.141,-0.200,-0.141, 0.000, 0.141][i];
    const handY  = [ 0.400, 0.415, 0.430, 0.415, 0.400, 0.415, 0.430, 0.415][i];

    // One fixed-length hair guide rooted low on the back of the head. The
    // angle now hangs mostly downward along the back, with a small delayed
    // swing rather than sticking out horizontally behind the head.
    const hairAngle = [106,103,100,102,106,110,113,110][i] * DEG;

    return {
      name: KEY_NAMES[i],
      pelvisY,
      lean,
      aFootX,
      aFootLift,
      bFootX,
      bFootLift,
      aHandX,
      aHandY: handY,
      bHandX,
      bHandY: handY,
      hairAngle,
      planted: i < 4 ? 'A' : 'B',
      travel: i / 8,
      key: true
    };
  }

  function defaultKeys() { return Array.from({length:8}, (_,i) => makeKey(i)); }

  function interpolatePose(a, b, t, name, travelB = b.travel) {
    return {
      name,
      pelvisY: lerp(a.pelvisY, b.pelvisY, t),
      lean: lerp(a.lean, b.lean, t),
      aFootX: lerp(a.aFootX, b.aFootX, t),
      aFootLift: lerp(a.aFootLift, b.aFootLift, t),
      bFootX: lerp(a.bFootX, b.bFootX, t),
      bFootLift: lerp(a.bFootLift, b.bFootLift, t),
      aHandX: lerp(a.aHandX, b.aHandX, t),
      aHandY: lerp(a.aHandY, b.aHandY, t),
      bHandX: lerp(a.bHandX, b.bHandX, t),
      bHandY: lerp(a.bHandY, b.bHandY, t),
      hairAngle: lerp(a.hairAngle ?? 155*DEG, b.hairAngle ?? 155*DEG, t),
      planted: a.planted,
      travel: lerp(a.travel, travelB, t),
      key: false
    };
  }

  function buildFramesFromKeys(keys) {
    const out = new Array(16);
    for (let i = 0; i < 8; i++) {
      const a = clonePose(keys[i]);
      a.key = true;
      a.name = KEY_NAMES[i];
      out[i * 2] = a;
      const nextIndex = (i + 1) % 8;
      const b = keys[nextIndex];
      const travelB = nextIndex === 0 ? 1 : b.travel;
      out[i * 2 + 1] = interpolatePose(a, b, 0.5, `${KEY_NAMES[i]} → ${KEY_NAMES[nextIndex]}`, travelB);
    }
    return out;
  }

  let frames = buildFramesFromKeys(defaultKeys());
  let frame = 0;
  let playing = false;
  let onion = true;
  let keysOnly = false;
  let fps = 14;
  let copiedPose = null;
  let lastAdvance = performance.now();
  let activeJoint = null;
  let activePointer = null;

  let activeExportControl = null;
  let exportDragStart = null;
  // Normalised to the live editor canvas. Width drives height through the
  // fixed 2:3 aspect ratio; centre stays stable across all 16 frames.
  let exportFrame = { cx: 0.50, cy: 0.545, width: 0.44 };

  // Sprite comparison is deliberately tied to the same fixed 4x4 Walk Lab
  // atlas format as Export PNG. The bundled SideScroll character is loaded by
  // default; the user can replace it with any other 4x4 image sheet.
  let spriteOverlay = false;
  let spriteAtlas = null;
  let spriteAtlasName = 'SideScroll character';
  const SPRITE_OPACITY = 0.58;

  // Cutout-rig artwork. The generated concept sheet is pre-cut into this
  // transparent atlas so Walk Lab can transform the same pixels on every
  // frame instead of asking image generation to redraw each pose.
  let rigArt = true;
  let rigAtlas = null;
  const RIG_ATLAS = Object.freeze({
    width: 2048, height: 576,
    parts: {
      head_hood:{x:20,y:20,w:177,h:183}, head_front:{x:217,y:20,w:116,h:151},
      back_hair:{x:353,y:20,w:214,h:181}, hair_tail_a:{x:587,y:20,w:110,h:151}, hair_tail_b:{x:717,y:20,w:93,h:156},
      torso_dress:{x:830,y:20,w:156,h:220}, front_skirt:{x:1006,y:20,w:139,h:135},
      front_cloak:{x:1165,y:20,w:129,h:214}, back_cloak:{x:1314,y:20,w:140,h:216}, rear_cloak:{x:1474,y:20,w:193,h:256},
      pouch_belt:{x:1687,y:20,w:114,h:48}, near_upper_arm:{x:1821,y:20,w:86,h:114},
      near_lower_arm:{x:20,y:296,w:110,h:117}, far_upper_arm:{x:150,y:296,w:67,h:108}, far_lower_arm:{x:237,y:296,w:91,h:113},
      near_upper_leg:{x:348,y:296,w:114,h:202}, near_lower_leg:{x:482,y:296,w:60,h:202}, near_boot:{x:562,y:296,w:125,h:92},
      far_upper_leg:{x:707,y:296,w:86,h:200}, far_lower_leg:{x:813,y:296,w:68,h:188}, far_boot:{x:901,y:296,w:126,h:99}
    }
  });

  function loadRigAtlas() {
    const img = new Image();
    img.onload = () => { rigAtlas = img; draw(); };
    img.onerror = () => { rigAtlas = null; draw(); };
    img.src = 'walklab-rig-parts.png?v=1.8.62';
  }

  function rigRect(name) { return RIG_ATLAS.parts[name]; }

  // Similarity-transform one atlas crop so two source anchor points land on
  // two skeleton points. This is the 2D equivalent of attaching a textured
  // plane to a bone: translation, rotation and uniform scale are deterministic.
  function drawRigSegment(c, name, a, b, anchors, alpha = 1) {
    if (!rigAtlas) return;
    const r = rigRect(name); if (!r) return;
    const p0 = { x: anchors[0] * r.w, y: anchors[1] * r.h };
    const p1 = { x: anchors[2] * r.w, y: anchors[3] * r.h };
    const svx = p1.x - p0.x, svy = p1.y - p0.y;
    const dvx = b.x - a.x, dvy = b.y - a.y;
    const sl = Math.hypot(svx,svy) || 1;
    const dl = Math.hypot(dvx,dvy) || 1;
    const scale = dl / sl;
    const rot = Math.atan2(dvy,dvx) - Math.atan2(svy,svx);
    c.save(); c.globalAlpha *= alpha; c.translate(a.x,a.y); c.rotate(rot); c.scale(scale,scale);
    c.drawImage(rigAtlas,r.x,r.y,r.w,r.h,-p0.x,-p0.y,r.w,r.h);
    c.restore();
  }

  function drawRigAt(c, name, point, opts = {}) {
    if (!rigAtlas) return;
    const r=rigRect(name); if(!r) return;
    const px=(opts.px ?? .5)*r.w, py=(opts.py ?? .5)*r.h;
    const scale=opts.scale ?? 1, rot=opts.rot ?? 0;
    c.save(); c.globalAlpha*=opts.alpha ?? 1; c.translate(point.x,point.y); c.rotate(rot); c.scale(scale,scale);
    c.drawImage(rigAtlas,r.x,r.y,r.w,r.h,-px,-py,r.w,r.h); c.restore();
  }

  function drawBoot(c, name, ankle, scale, alpha=1) {
    const toe={x:ankle.x + BODY.foot*scale,y:ankle.y};
    drawRigSegment(c,name,ankle,toe,[.28,.18,.88,.68],alpha);
  }

  function drawRigArt(c,p,g,opts={}) {
    if(!rigArt || !rigAtlas) return;
    const alpha=opts.alpha ?? 1;
    const s=g.scale;
    const cloakTip={x:g.pelvis.x-.36*s,y:g.pelvis.y+.15*s};
    const cloakTipFar={x:g.pelvis.x-.48*s,y:g.pelvis.y+.19*s};

    // Back-most secondary pieces.
    drawRigSegment(c,'back_hair',g.hairRoot,g.hairTip,[.82,.12,.12,.72],alpha*.98);
    drawRigSegment(c,'rear_cloak',g.shoulder,cloakTipFar,[.62,.08,.28,.88],alpha*.98);
    drawRigSegment(c,'back_cloak',g.shoulder,cloakTip,[.45,.08,.48,.90],alpha*.96);

    // Far limbs.
    drawRigSegment(c,'far_upper_arm',g.shoulder,g.bE,[.48,.06,.54,.94],alpha*.95);
    drawRigSegment(c,'far_lower_arm',g.bE,g.bW,[.20,.08,.58,.73],alpha*.95);
    drawRigSegment(c,'far_upper_leg',g.pelvis,g.bK,[.32,.04,.55,.95],alpha*.96);
    drawRigSegment(c,'far_lower_leg',g.bK,g.bF,[.50,.03,.48,.96],alpha*.96);
    drawBoot(c,'far_boot',g.bF,s,alpha*.96);

    // Torso and main cloak/dress masses.
    drawRigSegment(c,'torso_dress',g.chest,g.pelvis,[.53,.05,.52,.53],alpha);
    drawRigSegment(c,'front_skirt',g.pelvis,{x:g.pelvis.x+.01*s,y:g.pelvis.y+.25*s},[.48,.08,.50,.86],alpha*.98);
    drawRigSegment(c,'front_cloak',g.shoulder,cloakTip,[.56,.08,.46,.90],alpha*.98);
    drawRigAt(c,'pouch_belt',{x:g.pelvis.x-.01*s,y:g.pelvis.y-.03*s},{px:.55,py:.40,scale:s*.00105,rot:p.lean*.35,alpha});

    // Near limbs over the body.
    drawRigSegment(c,'near_upper_leg',g.pelvis,g.aK,[.72,.03,.24,.94],alpha);
    drawRigSegment(c,'near_lower_leg',g.aK,g.aF,[.50,.03,.48,.96],alpha);
    drawBoot(c,'near_boot',g.aF,s,alpha);
    drawRigSegment(c,'near_upper_arm',g.shoulder,g.aE,[.86,.06,.30,.94],alpha);
    drawRigSegment(c,'near_lower_arm',g.aE,g.aW,[.15,.06,.67,.72],alpha);

    // Head last so it stays clean over cloak/hair roots.
    const headScale=(BODY.headR*2.75*s)/rigRect('head_hood').h;
    drawRigAt(c,'head_hood',g.neck,{px:.56,py:.79,scale:headScale,rot:p.lean*.32,alpha});
  }

  function keyBlackBackground(sourceCanvas) {
    // Image-gen sheets often arrive on solid black. Key only the near-black
    // pixels so dark leggings/hair remain intact while the page background
    // becomes transparent for comparison over the stick rig.
    const c = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const image = c.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const d = image.data;
    let alreadyTransparent = false;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 250) { alreadyTransparent = true; break; }
    }
    if (!alreadyTransparent) {
      for (let i = 0; i < d.length; i += 4) {
        const m = Math.max(d[i], d[i + 1], d[i + 2]);
        if (m <= 7) d[i + 3] = 0;
        else if (m < 20) d[i + 3] = Math.round((m - 7) / 13 * 255);
      }
      c.putImageData(image, 0, 0);
    }
    return sourceCanvas;
  }

  function atlasFromImage(img) {
    const out = document.createElement('canvas');
    out.width = Math.max(4, img.naturalWidth || img.width || 4);
    out.height = Math.max(4, img.naturalHeight || img.height || 4);
    const c = out.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, out.width, out.height);
    c.drawImage(img, 0, 0, out.width, out.height);
    return keyBlackBackground(out);
  }

  function loadSpriteURL(url, name = 'Sprite', enable = true) {
    const img = new Image();
    img.onload = () => {
      spriteAtlas = atlasFromImage(img);
      spriteAtlasName = name;
      if (enable) {
        spriteOverlay = true;
        spriteBtn?.classList.add('active');
        spriteBtn?.setAttribute('aria-pressed', 'true');
      }
      draw();
    };
    img.onerror = () => {
      spriteAtlas = null;
      draw();
    };
    img.src = url;
  }

  function drawSpriteFrame(c, frameIndex, W = canvas.width, H = canvas.height) {
    if (!spriteOverlay || !spriteAtlas) return;
    const r = exportRect(W, H);
    const cellW = spriteAtlas.width / 4;
    const cellH = spriteAtlas.height / 4;
    const col = frameIndex % 4;
    const row = Math.floor(frameIndex / 4);
    c.save();
    c.globalAlpha = SPRITE_OPACITY;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(
      spriteAtlas,
      col * cellW, row * cellH, cellW, cellH,
      r.x, r.y, r.w, r.h
    );
    c.restore();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function solveJoint(root, target, l1, l2, mode) {
    let dx = target.x - root.x;
    let dy = target.y - root.y;
    let d = Math.hypot(dx, dy) || 0.0001;
    const minD = Math.abs(l1 - l2) + 0.001;
    const maxD = l1 + l2 - 0.001;
    const cd = clamp(d, minD, maxD);
    dx *= cd / d;
    dy *= cd / d;
    const tx = root.x + dx;
    const ty = root.y + dy;
    d = cd;

    const a = (l1*l1 - l2*l2 + d*d) / (2*d);
    const h = Math.sqrt(Math.max(0, l1*l1 - a*a));
    const ux = dx / d, uy = dy / d;
    const bx = root.x + ux * a;
    const by = root.y + uy * a;
    const px = -uy, py = ux;
    const c1 = { x: bx + px*h, y: by + py*h };
    const c2 = { x: bx - px*h, y: by - py*h };

    let joint;
    if (mode === 'knee') {
      // Side-view knees always bend toward travel (screen-right), preventing
      // the backwards-folding legs that made the previous editor confusing.
      joint = c1.x >= c2.x ? c1 : c2;
    } else {
      // Always use the same IK branch for elbows. Selecting by whichever
      // candidate happened to be lower caused the arm to flip inside-out as
      // the hand crossed beneath the shoulder. A stable branch gives a smooth,
      // forward-folding elbow throughout the whole swing.
      joint = c1;
    }
    return { joint, target: {x: tx, y: ty} };
  }

  function geometry(p, W = canvas.width, H = canvas.height) {
    const scale = Math.min(W * 0.34, H * 0.56);
    const cx = W * 0.5;
    const groundY = H * 0.84;
    const pelvis = { x: cx, y: groundY - p.pelvisY * scale };
    const chest = {
      x: pelvis.x + Math.sin(p.lean) * BODY.torso * scale,
      y: pelvis.y - Math.cos(p.lean) * BODY.torso * scale
    };
    const shoulder = { x: chest.x, y: chest.y };
    const neck = {
      x: chest.x + Math.sin(p.lean) * BODY.neck * scale,
      y: chest.y - Math.cos(p.lean) * BODY.neck * scale
    };
    const head = {
      x: neck.x + Math.sin(p.lean) * BODY.headR * 0.95 * scale,
      y: neck.y - Math.cos(p.lean) * BODY.headR * 0.95 * scale
    };
    const hairRoot = {
      x: head.x - BODY.headR * 0.55 * scale,
      y: head.y + BODY.headR * 0.48 * scale
    };
    const hairAngle = Number.isFinite(p.hairAngle) ? p.hairAngle : 114 * DEG;
    const hairTip = {
      x: hairRoot.x + Math.cos(hairAngle) * BODY.hair * scale,
      y: hairRoot.y + Math.sin(hairAngle) * BODY.hair * scale
    };

    const aFTarget = { x: cx + p.aFootX * scale, y: groundY - p.aFootLift * scale };
    const bFTarget = { x: cx + p.bFootX * scale, y: groundY - p.bFootLift * scale };
    const aLeg = solveJoint(pelvis, aFTarget, BODY.upperLeg*scale, BODY.lowerLeg*scale, 'knee');
    const bLeg = solveJoint(pelvis, bFTarget, BODY.upperLeg*scale, BODY.lowerLeg*scale, 'knee');

    const aHTarget = { x: shoulder.x + p.aHandX*scale, y: shoulder.y + p.aHandY*scale };
    const bHTarget = { x: shoulder.x + p.bHandX*scale, y: shoulder.y + p.bHandY*scale };
    const aArm = solveJoint(shoulder, aHTarget, BODY.upperArm*scale, BODY.lowerArm*scale, 'elbow');
    const bArm = solveJoint(shoulder, bHTarget, BODY.upperArm*scale, BODY.lowerArm*scale, 'elbow');

    return {
      W,H,scale,cx,groundY,pelvis,chest,shoulder,neck,head,hairRoot,hairTip,
      aK:aLeg.joint,aF:aLeg.target,bK:bLeg.joint,bF:bLeg.target,
      aE:aArm.joint,aW:aArm.target,bE:bArm.joint,bW:bArm.target
    };
  }

  function line(c, a, b, width, stroke, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke();
    c.restore();
  }

  function circle(c, p, r, fill, stroke, alpha = 1) {
    c.save(); c.globalAlpha=alpha;
    c.beginPath(); c.arc(p.x,p.y,r,0,TAU); c.fillStyle=fill; c.fill();
    if (stroke) { c.strokeStyle=stroke; c.lineWidth=Math.max(1,r*.20); c.stroke(); }
    c.restore();
  }

  function drawFoot(c, ankle, scale, color, alpha = 1, planted = false) {
    const toe = { x: ankle.x + BODY.foot*scale, y: ankle.y };
    line(c, ankle, toe, Math.max(3, scale*0.026), color, alpha);
    if (planted) {
      line(c, {x:ankle.x-scale*.035,y:ankle.y+scale*.012}, {x:toe.x+scale*.025,y:toe.y+scale*.012}, Math.max(2,scale*.010), '#718f89', alpha*.85);
    }
  }

  function drawPoseTo(c, p, g, opts = {}) {
    const ghost = !!opts.ghost;
    const alpha = opts.alpha ?? 1;
    const handles = !!opts.handles;
    const s = g.scale;
    const back = ghost ? '#adb4b5' : '#98a0a2';
    const front = ghost ? '#7f898b' : '#354047';
    const core = ghost ? '#929b9d' : '#26343a';
    const lw = Math.max(3, s*.026);

    // Back limbs first.
    line(c,g.pelvis,g.bK,lw,back,alpha*.70);
    line(c,g.bK,g.bF,lw,back,alpha*.70);
    drawFoot(c,g.bF,s,back,alpha*.70,p.planted==='B');
    line(c,g.shoulder,g.bE,lw*.82,back,alpha*.70);
    line(c,g.bE,g.bW,lw*.82,back,alpha*.70);

    // Central body / shoulder attachment.
    line(c,g.pelvis,g.chest,lw*1.05,core,alpha);
    line(c,g.chest,g.neck,lw*.72,core,alpha);
    circle(c,g.head,BODY.headR*s,ghost?'#c0c5c5':'#f0ebe5',core,alpha);
    // Long-hair guide bone: deliberately simple and fixed-length.
    line(c,g.hairRoot,g.hairTip,lw*.58,ghost?'#a5abad':'#7a4b49',alpha*.88);
    circle(c,g.hairRoot,Math.max(2.5,s*.015),ghost?'#aeb4b5':'#e9e4df',core,alpha*.90);
    circle(c,g.hairTip,Math.max(2.3,s*.013),ghost?'#aeb4b5':'#b56a64',core,alpha*.90);
    circle(c,g.shoulder,Math.max(3,s*.022),ghost?'#adb4b5':'#f0ebe5',core,alpha);

    // Front limbs.
    line(c,g.pelvis,g.aK,lw,front,alpha);
    line(c,g.aK,g.aF,lw,front,alpha);
    drawFoot(c,g.aF,s,front,alpha,p.planted==='A');
    line(c,g.shoulder,g.aE,lw*.82,front,alpha);
    line(c,g.aE,g.aW,lw*.82,front,alpha);

    // Small automatic elbow/knee dots show the fixed-length hinges without
    // turning them into fiddly draggable controls.
    for (const q of [g.aK,g.bK,g.aE,g.bE]) circle(c,q,Math.max(2.5,s*.014),ghost?'#aab1b2':'#d8d4cf',core,alpha*.95);

    if (handles && !ghost) {
      const handleList = [
        ['pelvis',g.pelvis],['chest',g.chest],
        ['aF',g.aF],['bF',g.bF],['aW',g.aW],['bW',g.bW]
      ];
      for (const [name,q] of handleList) {
        const selected = name === activeJoint;
        circle(c,q,(selected?.034:.028)*s,selected?'#6f8f89':'#fffdfa','#344047',1);
      }
      c.save();
      c.strokeStyle='rgba(111,143,137,.45)';
      c.lineWidth=Math.max(1,s*.005);
      c.setLineDash([5,6]);
      c.beginPath(); c.moveTo(g.cx,g.pelvis.y-.08*s); c.lineTo(g.cx,g.groundY+.03*s); c.stroke();
      c.restore();
    }
  }

  function exportRect(W = canvas.width, H = canvas.height) {
    const minW = Math.max(80, W * 0.22);
    const maxW = Math.max(minW, Math.min(W * 0.90, H * 0.86 * EXPORT.aspect));
    let w = clamp(exportFrame.width * W, minW, maxW);
    let h = w / EXPORT.aspect;
    let cx = exportFrame.cx * W;
    let cy = exportFrame.cy * H;
    const margin = Math.max(8, W * 0.018);
    cx = clamp(cx, margin + w / 2, W - margin - w / 2);
    cy = clamp(cy, margin + h / 2, H - margin - h / 2);
    exportFrame.cx = cx / W;
    exportFrame.cy = cy / H;
    exportFrame.width = w / W;
    return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
  }

  function exportHandles(W = canvas.width, H = canvas.height) {
    const r = exportRect(W, H);
    const lift = Math.max(20, W * 0.045);
    return {
      rect: r,
      move: { x: r.cx, y: r.y - lift },
      corners: [
        { x: r.x, y: r.y },
        { x: r.x + r.w, y: r.y },
        { x: r.x, y: r.y + r.h },
        { x: r.x + r.w, y: r.y + r.h }
      ]
    };
  }

  function drawExportFrame(c, W = canvas.width, H = canvas.height) {
    const h = exportHandles(W, H);
    const r = h.rect;
    const lineW = Math.max(2, W * 0.0045);
    const knobR = Math.max(7, W * 0.015);
    c.save();
    c.strokeStyle = 'rgba(90,132,125,.92)';
    c.fillStyle = 'rgba(243,237,231,.90)';
    c.lineWidth = lineW;
    c.setLineDash([Math.max(8,W*.016), Math.max(6,W*.012)]);
    c.strokeRect(r.x, r.y, r.w, r.h);
    c.setLineDash([]);

    // Move handle and connector.
    c.beginPath(); c.moveTo(r.cx, r.y); c.lineTo(h.move.x, h.move.y); c.stroke();
    c.beginPath(); c.arc(h.move.x, h.move.y, knobR * 1.12, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(h.move.x, h.move.y, knobR * .33, 0, TAU); c.fillStyle='#5a847d'; c.fill();

    // Uniform scale handles; scaling is always about the frame centre and the
    // 2:3 aspect can never drift.
    c.fillStyle = 'rgba(243,237,231,.94)';
    for (const q of h.corners) {
      c.beginPath(); c.arc(q.x, q.y, knobR, 0, TAU); c.fill(); c.stroke();
    }

    const label = `EXPORT ${EXPORT.cellW}×${EXPORT.cellH}  ·  ATLAS ${EXPORT.cellW*EXPORT.cols}×${EXPORT.cellH*EXPORT.rows}`;
    c.font = `800 ${Math.max(11, W*.023)}px system-ui, -apple-system, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    const tw = c.measureText(label).width;
    const tx = r.cx;
    const ty = r.y - Math.max(6, W*.012);
    c.fillStyle = 'rgba(41,55,57,.78)';
    const padX = Math.max(7,W*.014), padY=Math.max(4,W*.008);
    c.fillRect(tx-tw/2-padX, ty-Math.max(14,W*.032)-padY, tw+padX*2, Math.max(17,W*.036)+padY*2);
    c.fillStyle = '#f5f0eb';
    c.fillText(label, tx, ty-padY);
    c.restore();
  }

  function findExportControl(pos) {
    const h = exportHandles();
    const hitR = Math.max(24, canvas.width * 0.045);
    if (Math.hypot(pos.x-h.move.x,pos.y-h.move.y) <= hitR) return 'move';
    for (const q of h.corners) {
      if (Math.hypot(pos.x-q.x,pos.y-q.y) <= hitR) return 'scale';
    }
    return null;
  }

  function editExportFrame(mode, pos) {
    const W=canvas.width,H=canvas.height;
    if (!exportDragStart) return;
    if (mode === 'move') {
      const dx = pos.x - exportDragStart.pointer.x;
      const dy = pos.y - exportDragStart.pointer.y;
      exportFrame.cx = exportDragStart.frame.cx + dx / W;
      exportFrame.cy = exportDragStart.frame.cy + dy / H;
    } else if (mode === 'scale') {
      const cx = exportDragStart.frame.cx * W;
      const cy = exportDragStart.frame.cy * H;
      const halfWFromX = Math.abs(pos.x - cx);
      const halfWFromY = Math.abs(pos.y - cy) * EXPORT.aspect;
      const newW = Math.max(halfWFromX, halfWFromY) * 2;
      exportFrame.width = newW / W;
    }
    exportRect(W,H); // clamps and writes the normalised values back.
    draw();
  }

  function draw() {
    resize();
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#f3ede7'; ctx.fillRect(0,0,W,H);
    const g=geometry(frames[frame]);
    const pad=W*.055;

    ctx.strokeStyle='rgba(76,82,86,.22)';
    ctx.lineWidth=Math.max(1,W*.003);
    ctx.strokeRect(pad,H*.07,W-pad*2,H*.81);

    ctx.strokeStyle='rgba(60,68,70,.42)';
    ctx.lineWidth=Math.max(1,W*.003);
    ctx.beginPath(); ctx.moveTo(pad,g.groundY); ctx.lineTo(W-pad,g.groundY); ctx.stroke();

    // Ground marks move exactly with root travel. During each stance the
    // planted foot remains over one world-space mark, making slide easy to spot.
    const spacing = g.scale * 0.25;
    const travelPx = frames[frame].travel * g.scale;
    const offset = -((travelPx % spacing) + spacing) % spacing;
    ctx.strokeStyle='rgba(88,100,99,.16)';
    ctx.lineWidth=Math.max(1,W*.002);
    for(let x=offset-spacing;x<W+spacing;x+=spacing){
      ctx.beginPath(); ctx.moveTo(x,g.groundY+.03*g.scale); ctx.lineTo(x+spacing*.35,g.groundY+.03*g.scale); ctx.stroke();
    }

    // Deterministic cutout planes follow the authored bones. The older full-sheet
    // sprite comparison remains optional underneath.
    drawSpriteFrame(ctx, frame, W, H);
    drawRigArt(ctx,frames[frame],g,{alpha:.92});

    if (onion) {
      const pPrev=frames[(frame+15)%16], pNext=frames[(frame+1)%16];
      drawPoseTo(ctx,pPrev,geometry(pPrev),{ghost:true,alpha:.17});
      drawPoseTo(ctx,pNext,geometry(pNext),{ghost:true,alpha:.17});
    }
    drawPoseTo(ctx,frames[frame],g,{handles:true});
    drawExportFrame(ctx,W,H);

    const p=frames[frame];
    readout.textContent=`Frame ${frame+1} / 16 · ${p.name} · ${p.key?'KEY':'IN-BETWEEN'} · ${p.planted==='A'?'LEFT':'RIGHT'} PLANT${rigArt&&rigAtlas?' · RIG ART':''}${spriteOverlay&&spriteAtlas?' · SPRITE':''}`;
    editHint.textContent=activeExportControl ? `Editing export frame · ${activeExportControl}` : (activeJoint ? `Editing ${activeJoint}` : 'Drag joints · Rig art follows bones · export frame: top handle moves, corners scale');
    scrub.value=String(frame);
  }

  function pointerPos(e) {
    const r=canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
  }

  function findJoint(pos) {
    const g=geometry(frames[frame]);
    const list=[['pelvis',g.pelvis],['chest',g.chest],['aF',g.aF],['bF',g.bF],['aW',g.aW],['bW',g.bW]];
    const radius=.095*g.scale;
    let best=null,bestD=Infinity;
    for(const [name,q] of list){
      const d=Math.hypot(pos.x-q.x,pos.y-q.y);
      if(d<radius&&d<bestD){best=name;bestD=d;}
    }
    return best;
  }

  function clampEndpoint(root, pos, l1, l2) {
    let dx=pos.x-root.x, dy=pos.y-root.y;
    let d=Math.hypot(dx,dy)||0.0001;
    const minD=Math.abs(l1-l2)+.002, maxD=l1+l2-.002;
    const cd=clamp(d,minD,maxD);
    return {x:root.x+dx*cd/d,y:root.y+dy*cd/d};
  }

  function editJoint(name, pos) {
    const p=frames[frame];
    const g=geometry(p);
    const s=g.scale;

    if (name==='pelvis') {
      p.pelvisY=clamp((g.groundY-pos.y)/s,.625,.745);
    } else if (name==='chest') {
      p.lean=clamp(Math.atan2(pos.x-g.pelvis.x,g.pelvis.y-pos.y),-18*DEG,18*DEG);
    } else if (name==='aF' || name==='bF') {
      const planted = (name==='aF' && p.planted==='A') || (name==='bF' && p.planted==='B');
      const target={x:pos.x,y:planted?g.groundY:Math.min(pos.y,g.groundY)};
      const clamped=clampEndpoint(g.pelvis,target,BODY.upperLeg*s,BODY.lowerLeg*s);
      const prefix=name==='aF'?'a':'b';
      p[`${prefix}FootX`]=clamp((clamped.x-g.cx)/s,-.36,.36);
      p[`${prefix}FootLift`]=planted?0:clamp((g.groundY-clamped.y)/s,0,.22);
    } else if (name==='aW' || name==='bW') {
      const clamped=clampEndpoint(g.shoulder,pos,BODY.upperArm*s,BODY.lowerArm*s);
      const prefix=name==='aW'?'a':'b';
      p[`${prefix}HandX`]=clamp((clamped.x-g.shoulder.x)/s,-.26,.26);
      p[`${prefix}HandY`]=clamp((clamped.y-g.shoulder.y)/s,.28,.45);
    }
    draw();
  }

  canvas.addEventListener('pointerdown',e=>{
    const pos=pointerPos(e);
    const exportControl=findExportControl(pos);
    if(exportControl){
      playing=false; playBtn.textContent='Play'; playBtn.classList.remove('active');
      activeExportControl=exportControl;
      activePointer=e.pointerId;
      exportDragStart={pointer:pos,frame:{...exportFrame}};
      canvas.setPointerCapture?.(e.pointerId);
      draw();
      return;
    }
    const joint=findJoint(pos); if(!joint)return;
    playing=false; playBtn.textContent='Play'; playBtn.classList.remove('active');
    activeJoint=joint; activePointer=e.pointerId; canvas.setPointerCapture?.(e.pointerId); editJoint(joint,pos);
  });
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerId!==activePointer)return;
    const pos=pointerPos(e);
    if(activeExportControl) editExportFrame(activeExportControl,pos);
    else if(activeJoint) editJoint(activeJoint,pos);
  });
  function endDrag(e){
    if(e.pointerId!==activePointer)return;
    activePointer=null; activeJoint=null; activeExportControl=null; exportDragStart=null; draw();
  }
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);

  function step(dir) {
    if(keysOnly){frame=(frame+dir*2+16)%16;if(frame%2)frame=(frame+1)%16;}
    else frame=(frame+dir+16)%16;
    lastAdvance=performance.now(); draw();
  }

  function animate(now) {
    if(playing){
      const interval=1000/fps;
      if(now-lastAdvance>=interval){step(1);lastAdvance=now;}
    }
    requestAnimationFrame(animate);
  }

  function rebuildMids() {
    for(let i=0;i<8;i++){
      const a=frames[i*2];
      const nextIndex=(i+1)%8;
      const b=frames[nextIndex*2];
      const travelB=nextIndex===0?1:b.travel;
      frames[i*2+1]=interpolatePose(a,b,.5,`${a.name} → ${b.name}`,travelB);
    }
    draw();
  }

  function resetCycle() {
    frames=buildFramesFromKeys(defaultKeys());
    frame=0; playing=false; playBtn.textContent='Play'; playBtn.classList.remove('active');
    copiedPose=null; pasteBtn.disabled=true; draw();
  }

  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function saveJSON(){
    const data={type:'GameHubWalkLab',version:9,fps,body:BODY,exportFrame,export:{cellW:EXPORT.cellW,cellH:EXPORT.cellH,cols:EXPORT.cols,rows:EXPORT.rows,aspect:EXPORT.aspect},frames};
    downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'walk-lab-animation.json');
  }

  async function loadJSON(file){
    try{
      const data=JSON.parse(await file.text());
      if(!data||!Array.isArray(data.frames)||data.frames.length!==16)throw new Error('Expected a 16-frame Walk Lab animation.');
      const required=['pelvisY','lean','aFootX','aFootLift','bFootX','bFootLift','aHandX','aHandY','bHandX','bHandY'];
      if(!required.every(k=>Number.isFinite(data.frames[0]?.[k])))throw new Error('This is an older Walk Lab format. Reset the cycle or load a v3 animation.');
      frames=data.frames.map((p,i)=>({
        ...clonePose(p),
        hairAngle:Number.isFinite(p.hairAngle)?p.hairAngle:114*DEG,
        key:i%2===0
      }));
      if(Number.isFinite(data.fps)){fps=clamp(Math.round(data.fps),4,24);fpsSlider.value=String(fps);fpsOut.textContent=`${fps} fps`;}
      if(data.exportFrame && Number.isFinite(data.exportFrame.cx) && Number.isFinite(data.exportFrame.cy) && Number.isFinite(data.exportFrame.width)){
        exportFrame={cx:data.exportFrame.cx,cy:data.exportFrame.cy,width:data.exportFrame.width};
      }
      frame=0; playing=false; playBtn.textContent='Play'; playBtn.classList.remove('active'); draw();
    }catch(err){alert(`Could not load animation: ${err.message}`);}
  }

  function exportPNG(){
    // The visible frame is the single source crop for every pose. We render
    // each animation frame into a transparent editor-sized buffer, crop that
    // exact rectangle, and scale it into a fixed 256×384 atlas cell.
    resize();
    const W=canvas.width,H=canvas.height;
    const r=exportRect(W,H);
    const out=document.createElement('canvas');
    out.width=EXPORT.cellW*EXPORT.cols;
    out.height=EXPORT.cellH*EXPORT.rows;
    const c=out.getContext('2d');
    c.clearRect(0,0,out.width,out.height);
    c.imageSmoothingEnabled=true;
    c.imageSmoothingQuality='high';

    const scratch=document.createElement('canvas');
    scratch.width=W; scratch.height=H;
    const sc=scratch.getContext('2d');
    sc.imageSmoothingEnabled=true;
    sc.imageSmoothingQuality='high';

    frames.forEach((p,i)=>{
      sc.clearRect(0,0,W,H);
      const gg=geometry(p,W,H);
      if(rigArt && rigAtlas) drawRigArt(sc,p,gg,{alpha:1});
      else drawPoseTo(sc,p,gg,{handles:false,ghost:false});
      const col=i%EXPORT.cols,row=Math.floor(i/EXPORT.cols);
      c.drawImage(
        scratch,
        r.x,r.y,r.w,r.h,
        col*EXPORT.cellW,row*EXPORT.cellH,EXPORT.cellW,EXPORT.cellH
      );
    });
    out.toBlob(blob=>{if(blob)downloadBlob(blob,rigArt&&rigAtlas?'walk-lab-rig-art-16-frame.png':'walk-lab-16-frame-reference.png');},'image/png');
  }

  scrub.addEventListener('input',()=>{frame=Number(scrub.value);playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');draw();});
  prev.addEventListener('click',()=>{playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');step(-1);});
  next.addEventListener('click',()=>{playing=false;playBtn.textContent='Play';playBtn.classList.remove('active');step(1);});
  playBtn.addEventListener('click',()=>{playing=!playing;playBtn.textContent=playing?'Pause':'Play';playBtn.classList.toggle('active',playing);lastAdvance=performance.now();draw();});
  onionBtn.addEventListener('click',()=>{onion=!onion;onionBtn.classList.toggle('active',onion);onionBtn.setAttribute('aria-pressed',String(onion));draw();});
  keysBtn.addEventListener('click',()=>{keysOnly=!keysOnly;keysBtn.classList.toggle('active',keysOnly);keysBtn.setAttribute('aria-pressed',String(keysOnly));if(keysOnly&&frame%2)frame=(frame+1)%16;draw();});
  midsBtn.addEventListener('click',rebuildMids);
  resetBtn?.addEventListener('click',resetCycle);
  copyBtn.addEventListener('click',()=>{copiedPose=clonePose(frames[frame]);pasteBtn.disabled=false;});
  pasteBtn.addEventListener('click',()=>{if(!copiedPose)return;const keepName=frames[frame].name,keepKey=frames[frame].key,keepTravel=frames[frame].travel,keepPlant=frames[frame].planted;frames[frame]={...clonePose(copiedPose),name:keepName,key:keepKey,travel:keepTravel,planted:keepPlant};draw();});
  saveBtn.addEventListener('click',saveJSON);
  loadBtn.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',()=>{const f=fileInput.files?.[0];if(f)loadJSON(f);fileInput.value='';});
  exportBtn.addEventListener('click',exportPNG);
  rigArtBtn?.addEventListener('click',()=>{rigArt=!rigArt;rigArtBtn.classList.toggle('active',rigArt);rigArtBtn.setAttribute('aria-pressed',String(rigArt));draw();});
  spriteBtn?.addEventListener('click',()=>{
    spriteOverlay=!spriteOverlay;
    spriteBtn.classList.toggle('active',spriteOverlay);
    spriteBtn.setAttribute('aria-pressed',String(spriteOverlay));
    draw();
  });
  spriteLoadBtn?.addEventListener('click',()=>spriteFileInput?.click());
  spriteFileInput?.addEventListener('change',()=>{
    const f=spriteFileInput.files?.[0];
    if(!f)return;
    const url=URL.createObjectURL(f);
    const img=new Image();
    img.onload=()=>{
      spriteAtlas=atlasFromImage(img);
      spriteAtlasName=f.name || 'Loaded sprite';
      spriteOverlay=true;
      spriteBtn?.classList.add('active');
      spriteBtn?.setAttribute('aria-pressed','true');
      URL.revokeObjectURL(url);
      draw();
    };
    img.onerror=()=>{URL.revokeObjectURL(url);alert('Could not load that sprite image.');};
    img.src=url;
    spriteFileInput.value='';
  });
  fpsSlider.addEventListener('input',()=>{fps=Number(fpsSlider.value);fpsOut.value=`${fps} fps`;fpsOut.textContent=`${fps} fps`;lastAdvance=performance.now();});
  window.addEventListener('resize',draw,{passive:true});

  playBtn.textContent='Play';
  playBtn.classList.remove('active');
  loadRigAtlas();
  loadSpriteURL('sidescroll-character-walk.png?v=1.8.62', 'Minimal iconic girl', false);
  spriteOverlay=false; spriteBtn?.classList.remove('active'); spriteBtn?.setAttribute('aria-pressed','false');
  draw();
  requestAnimationFrame(animate);
})();
