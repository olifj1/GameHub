(() => {
  'use strict';

  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clone = obj => JSON.parse(JSON.stringify(obj));

  // v1.8.67 proportions are measured against the assembled character on the
  // original simple-parts reference sheet: large head, compact torso and shorter,
  // slimmer limbs.  These values are the rig proportions; the atlas art is then
  // scaled between the same joint pivots rather than driving the skeleton size.
  const BODY = Object.freeze({
    torso: 0.30,
    neck: 0.040,
    headR: 0.170,
    upperArm: 0.190,
    lowerArm: 0.180,
    upperLeg: 0.240,
    lowerLeg: 0.230,
    foot: 0.145,
    ankleHeight: 0.065,
    ankleForward: 0.035,
    hair1: 0.27,
    hair2: 0.25,
    cloak1: 0.34,
    cloak2: 0.35
  });

  const KEY_NAMES = ['Contact L','Down L','Passing L','Up L','Contact R','Down R','Passing R','Up R'];

  // v4 atlas: art extracted programmatically from the first simple-parts character sheet.
  // The sheet is authoritative for the character design; limbs are separated deterministically
  // and the cream source background has been removed to alpha.
  const ATLAS = Object.freeze({
    width: 1600,
    height: 1152,
    cellW: 320,
    cellH: 384,
    url: 'walklab-rig-v4.png',
    sourceUrl: 'walklab-character-source.png',
    parts: {
      head:            {c:0,r:0,a0:[.5181,.7157],a1:[.5181,.2729]},
      torso_upper:     {c:1,r:0,a0:[.5188,.2167],a1:[.5125,.7807]},
      dress_lower:     {c:2,r:0,a0:[.5163,.2566],a1:[.5163,.7434]},
      far_upper_arm:   {c:3,r:0,a0:[.4984,.1719],a1:[.4984,.8281]},
      far_lower_arm:   {c:4,r:0,a0:[.5000,.1719],a1:[.5000,.6562]},
      far_upper_leg:   {c:0,r:1,a0:[.4984,.2266],a1:[.4984,.7734]},
      far_lower_leg:   {c:1,r:1,a0:[.5000,.1651],a1:[.5000,.8323]},
      far_foot:        {c:2,r:1,a0:[.4139,.3984],a1:[.6780,.5625]},
      near_upper_leg:  {c:3,r:1,a0:[.4984,.2572],a1:[.4984,.7428]},
      near_lower_leg:  {c:4,r:1,a0:[.4984,.1651],a1:[.4984,.8323]},
      near_foot:       {c:0,r:2,a0:[.4019,.3984],a1:[.7035,.5625]},
      near_upper_arm:  {c:1,r:2,a0:[.5000,.1784],a1:[.5000,.8216]},
      near_lower_arm:  {c:2,r:2,a0:[.5000,.1719],a1:[.5000,.6562]}
    }
  });

  function atlasRect(name) {
    const p = ATLAS.parts[name];
    if (!p) return null;
    return { x:p.c*ATLAS.cellW, y:p.r*ATLAS.cellH, w:ATLAS.cellW, h:ATLAS.cellH, a0:p.a0, a1:p.a1 };
  }

  function makeKey(i) {
    // Reference-proportion walk.  The support leg is intentionally close to
    // straight at contact and passing, with the deepest compression confined to
    // the down pose.  This removes the permanent crouch visible in earlier cycles.
    const pelvisY = [0.510,0.490,0.530,0.520,0.510,0.490,0.530,0.520][i];
    const lean = [4,5,4,3,4,5,4,3][i] * DEG;

    // A/B are the two legs.  The planted heel travels from just ahead of the
    // pelvis to just behind it while staying on the floor; the other leg clears
    // the ground with a modest knee fold rather than tucking underneath the body.
    const aFootX = [ 0.120,0.070,0.000,-0.100,-0.160,-0.100,0.000,0.100][i];
    const bFootX = [-0.160,-0.100,0.000, 0.100, 0.120, 0.070,0.000,-0.100][i];
    const aFootLift=[0,0,0,0,.055,.105,.145,.095][i];
    const bFootLift=[.055,.105,.145,.095,0,0,0,0][i];
    const aFootAngle=[0,0,0,7,-9,-14,-5,2][i] * DEG;
    const bFootAngle=[-9,-14,-5,2,0,0,0,7][i] * DEG;

    // Smaller, relaxed counter-swing to match the assembled reference image.
    const aHandX=[-.095,-.075,-.025,.055,.095,.075,.025,-.055][i];
    const bHandX=[ .095, .075, .025,-.055,-.095,-.075,-.025,.055][i];
    const handY=[.285,.295,.305,.300,.285,.295,.305,.300][i];

    const hairAngle=[110,108,104,106,110,114,117,114][i]*DEG;
    const hairBend=[10,8,5,8,12,15,16,13][i]*DEG;

    return {
      name:KEY_NAMES[i], pelvisY, lean,
      aFootX,aFootLift,aFootAngle,
      bFootX,bFootLift,bFootAngle,
      aHandX,aHandY:handY,bHandX,bHandY:handY,
      hairAngle,hairBend,
      planted:i<4?'A':'B', travel:i/8, key:true
    };
  }

  function defaultKeys(){ return Array.from({length:8},(_,i)=>makeKey(i)); }

  function interpolatePose(a,b,t,name,travelB=b.travel){
    const keys=['pelvisY','lean','aFootX','aFootLift','aFootAngle','bFootX','bFootLift','bFootAngle','aHandX','aHandY','bHandX','bHandY','hairAngle','hairBend'];
    const out={name,planted:a.planted,travel:lerp(a.travel,travelB,t),key:false};
    keys.forEach(k=>out[k]=lerp(a[k],b[k],t));
    return out;
  }

  function buildFramesFromKeys(keys){
    const out=new Array(16);
    for(let i=0;i<8;i++){
      const a=clone(keys[i]); a.key=true; a.name=KEY_NAMES[i]; out[i*2]=a;
      const ni=(i+1)%8,b=keys[ni],travelB=ni===0?1:b.travel;
      out[i*2+1]=interpolatePose(a,b,.5,`${KEY_NAMES[i]} → ${KEY_NAMES[ni]}`,travelB);
    }
    return out;
  }

  const DEFAULT_FRAMES = buildFramesFromKeys(defaultKeys());

  function normalizedPose(p,i=0){
    const d=DEFAULT_FRAMES[i%16];
    return {
      ...clone(d), ...clone(p||{}),
      aFootAngle:Number.isFinite(p?.aFootAngle)?p.aFootAngle:d.aFootAngle,
      bFootAngle:Number.isFinite(p?.bFootAngle)?p.bFootAngle:d.bFootAngle,
      hairAngle:Number.isFinite(p?.hairAngle)?p.hairAngle:d.hairAngle,
      hairBend:Number.isFinite(p?.hairBend)?p.hairBend:d.hairBend,
      key:i%2===0
    };
  }

  function sampleFrames(frames,phase){
    const p=((phase%1)+1)%1*16;
    const i=Math.floor(p)%16,t=p-Math.floor(p),j=(i+1)%16;
    const a=normalizedPose(frames[i],i),b=normalizedPose(frames[j],j);
    const travelB=j===0?1:b.travel;
    return interpolatePose(a,b,t,a.name,travelB);
  }

  function rot(v,ang){
    const c=Math.cos(ang),s=Math.sin(ang);
    return {x:v.x*c-v.y*s,y:v.x*s+v.y*c};
  }

  function solveJoint(root,target,l1,l2,mode){
    let dx=target.x-root.x,dy=target.y-root.y,d=Math.hypot(dx,dy)||1e-5;
    const minD=Math.abs(l1-l2)+.001,maxD=l1+l2-.001,cd=clamp(d,minD,maxD);
    dx*=cd/d;dy*=cd/d;d=cd;
    const t={x:root.x+dx,y:root.y+dy};
    const a=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-a*a));
    const ux=dx/d,uy=dy/d,bx=root.x+ux*a,by=root.y+uy*a,px=-uy,py=ux;
    const c1={x:bx+px*h,y:by+py*h},c2={x:bx-px*h,y:by-py*h};
    let joint;
    if(mode==='knee') {
      // World-space Y points upward. Keep side-view knees bending toward travel
      // (screen-right) regardless of which algebraic IK candidate is c1/c2.
      joint=c1.x>=c2.x?c1:c2;
    } else {
      // The older editor solved in screen-space (Y down) and used c1 for the
      // visually-correct elbow branch. This shared rig solves in world-space
      // (Y up), which swaps that branch. c2 restores the same forward/natural
      // elbow bend and prevents the arm appearing to fold backwards.
      joint=c2;
    }
    return {joint,target:t};
  }

  function footGeometry(heel,angle){
    const ankleToHeel=rot({x:-BODY.ankleForward,y:-BODY.ankleHeight},angle);
    const ankle={x:heel.x-ankleToHeel.x,y:heel.y-ankleToHeel.y};
    const ankleToToe=rot({x:BODY.foot-BODY.ankleForward,y:-BODY.ankleHeight},angle);
    const toe={x:ankle.x+ankleToToe.x,y:ankle.y+ankleToToe.y};
    return {heel,ankle,toe};
  }

  function geometry(pose){
    const p=normalizedPose(pose);
    const pelvis={x:0,y:p.pelvisY};
    const chest={x:pelvis.x+Math.sin(p.lean)*BODY.torso,y:pelvis.y+Math.cos(p.lean)*BODY.torso};
    const shoulder={...chest};
    const neck={x:chest.x+Math.sin(p.lean)*BODY.neck,y:chest.y+Math.cos(p.lean)*BODY.neck};
    const head={x:neck.x+Math.sin(p.lean)*BODY.headR*.95,y:neck.y+Math.cos(p.lean)*BODY.headR*.95};
    const headTop={x:head.x+Math.sin(p.lean)*BODY.headR*.95,y:head.y+Math.cos(p.lean)*BODY.headR*.95};
    const hairRoot={x:head.x-BODY.headR*.45,y:head.y-BODY.headR*.15};
    const h1={x:hairRoot.x+Math.cos(p.hairAngle)*BODY.hair1,y:hairRoot.y-Math.sin(p.hairAngle)*BODY.hair1};
    const h2Angle=p.hairAngle+p.hairBend;
    const h2={x:h1.x+Math.cos(h2Angle)*BODY.hair2,y:h1.y-Math.sin(h2Angle)*BODY.hair2};

    const aHeel={x:p.aFootX,y:p.aFootLift};
    const bHeel={x:p.bFootX,y:p.bFootLift};
    let aFoot=footGeometry(aHeel,p.aFootAngle), bFoot=footGeometry(bHeel,p.bFootAngle);
    const aLeg=solveJoint(pelvis,aFoot.ankle,BODY.upperLeg,BODY.lowerLeg,'knee');
    const bLeg=solveJoint(pelvis,bFoot.ankle,BODY.upperLeg,BODY.lowerLeg,'knee');
    // If a foot target was out of reach, keep the foot attached to the clamped ankle.
    const shiftFoot=(f,newAnkle)=>{
      const dx=newAnkle.x-f.ankle.x,dy=newAnkle.y-f.ankle.y;
      return {ankle:newAnkle,heel:{x:f.heel.x+dx,y:f.heel.y+dy},toe:{x:f.toe.x+dx,y:f.toe.y+dy}};
    };
    aFoot=shiftFoot(aFoot,aLeg.target); bFoot=shiftFoot(bFoot,bLeg.target);

    const aWTarget={x:shoulder.x+p.aHandX,y:shoulder.y-p.aHandY};
    const bWTarget={x:shoulder.x+p.bHandX,y:shoulder.y-p.bHandY};
    const aArm=solveJoint(shoulder,aWTarget,BODY.upperArm,BODY.lowerArm,'elbow');
    const bArm=solveJoint(shoulder,bWTarget,BODY.upperArm,BODY.lowerArm,'elbow');

    const waist={x:lerp(chest.x,pelvis.x,.78),y:lerp(chest.y,pelvis.y,.78)};
    const dressHem={x:pelvis.x-.010,y:Math.max(.14,pelvis.y-.185)};
    const sway=Math.sin((p.travel||0)*TAU)*.035;
    const cloakMid={x:shoulder.x-.155-sway*.70,y:shoulder.y-.205};
    const cloakTip={x:cloakMid.x-.205-sway*.45,y:cloakMid.y-.225};
    const cloakFrontTip={x:pelvis.x-.070+sway*.25,y:pelvis.y-.215};

    return {
      pose:p,pelvis,chest,shoulder,neck,head,headTop,waist,dressHem,
      hairRoot,hairMid:h1,hairTip:h2,cloakMid,cloakTip,cloakFrontTip,
      aK:aLeg.joint,aAnkle:aFoot.ankle,aHeel:aFoot.heel,aToe:aFoot.toe,
      bK:bLeg.joint,bAnkle:bFoot.ankle,bHeel:bFoot.heel,bToe:bFoot.toe,
      aE:aArm.joint,aW:aArm.target,bE:bArm.joint,bW:bArm.target
    };
  }

  function seg(name,a,b,layer,alpha=1){ return {name,a,b,layer,alpha,kind:'segment'}; }

  function partsForPose(pose){
    const g=geometry(pose);
    // Deliberately simple v4 cutout: no cloak, extra hair chains or accessories yet.
    // Painter order is explicit: far leg / far arm / body / near leg / dress / near arm / head.
    return [
      seg('far_upper_leg',g.pelvis,g.bK,0,.94),
      seg('far_lower_leg',g.bK,g.bAnkle,1,.94),
      seg('far_foot',g.bAnkle,g.bToe,2,.95),
      seg('far_upper_arm',g.shoulder,g.bE,3,.93),
      seg('far_lower_arm',g.bE,g.bW,4,.93),
      seg('torso_upper',g.chest,g.pelvis,5,1),
      seg('near_upper_leg',g.pelvis,g.aK,6,1),
      seg('near_lower_leg',g.aK,g.aAnkle,7,1),
      seg('near_foot',g.aAnkle,g.aToe,8,1),
      seg('dress_lower',g.pelvis,g.dressHem,9,1),
      seg('near_upper_arm',g.shoulder,g.aE,10,1),
      seg('near_lower_arm',g.aE,g.aW,11,1),
      seg('head',g.neck,g.headTop,12,1)
    ];
  }

  function projectPoint(pt,view){
    const flip=view.flipX??1;
    return {x:view.cx+pt.x*view.scale*flip,y:view.groundY-pt.y*view.scale};
  }

  function drawPartCanvas(ctx,atlas,part,view,opts={}){
    const r=atlasRect(part.name); if(!r||!atlas)return;
    let A=projectPoint(part.a,view),B=projectPoint(part.b,view);
    const flip=view.flipX??1;
    const p0={x:r.a0[0]*r.w,y:r.a0[1]*r.h};
    const p1={x:r.a1[0]*r.w,y:r.a1[1]*r.h};
    // Canvas and atlas image coordinates both use +Y downward. The v3 atlas
    // anchors were authored in that same convention, so preserve the source Y
    // direction here. Negating it rotated every cutout plane roughly 180° away
    // from the bone it was supposed to follow.
    const svx=(p1.x-p0.x)*flip,svy=(p1.y-p0.y);
    const dvx=B.x-A.x,dvy=B.y-A.y;
    const sl=Math.hypot(svx,svy)||1,dl=Math.hypot(dvx,dvy)||1;
    const scale=dl/sl,rot=Math.atan2(dvy,dvx)-Math.atan2(svy,svx);
    ctx.save(); ctx.globalAlpha*=part.alpha*(opts.alpha??1); ctx.translate(A.x,A.y); ctx.rotate(rot); ctx.scale(scale*flip,scale);
    ctx.drawImage(atlas,r.x,r.y,r.w,r.h,-p0.x,-p0.y,r.w,r.h); ctx.restore();
  }

  function drawCanvas(ctx,atlas,pose,view,opts={}){
    const parts=partsForPose(pose);
    parts.forEach(part=>drawPartCanvas(ctx,atlas,part,view,opts));
    return parts;
  }

  window.GameHubWalkRig={
    DEG,TAU,BODY,ATLAS,KEY_NAMES,DEFAULT_FRAMES,
    clone,clamp,lerp,makeKey,defaultKeys,interpolatePose,buildFramesFromKeys,normalizedPose,sampleFrames,
    geometry,partsForPose,atlasRect,projectPoint,drawCanvas,solveJoint,footGeometry
  };
})();
