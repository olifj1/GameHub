(function(){
  const GH = window.GH || {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    storageJSON: (_, fallback) => fallback,
    saveJSON: () => {}
  };

  const TAU = Math.PI * 2;
  const STORAGE_KEY = 'gamehub-walklab-v1.8.72';

  const art = {
    image: new Image(),
    ready: false,
    parts: {
      head: { x: 16, y: 84, w: 288, h: 217, pivotX: 214, pivotY: 202 },
      torso: { x: 380, y: 52, w: 197, h: 282, pivotX: 102, pivotY: 224 },
      skirt: { x: 660, y: 72, w: 279, h: 240, pivotX: 136, pivotY: 28 }
    }
  };
  art.image.onload = () => { art.ready = true; };
  art.image.src = 'walklab-rig-v4.png';

  function mix(a, b, t){ return { x: GH.lerp(a.x, b.x, t), y: GH.lerp(a.y, b.y, t) }; }
  function vec(x, y){ return { x, y }; }
  function dist(a, b){ return Math.hypot(b.x - a.x, b.y - a.y); }
  function angle(a, b){ return Math.atan2(b.y - a.y, b.x - a.x); }
  function wrap01(t){ t = t % 1; return t < 0 ? t + 1 : t; }
  function triangleWave(t){ return 1 - Math.abs((wrap01(t) * 2) - 1); }

  function solveIK(start, end, len1, len2, bendDir){
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    let d = Math.hypot(dx, dy);
    if (d < 0.0001) d = 0.0001;
    const clamped = GH.clamp(d, Math.abs(len1 - len2) + 0.001, len1 + len2 - 0.001);
    const ux = dx / d;
    const uy = dy / d;
    const a = (len1 * len1 - len2 * len2 + clamped * clamped) / (2 * clamped);
    const h = Math.sqrt(Math.max(0, len1 * len1 - a * a));
    const mx = start.x + ux * a;
    const my = start.y + uy * a;
    const px = -uy * bendDir;
    const py = ux * bendDir;
    return { x: mx + px * h, y: my + py * h };
  }

  function gaitFoot(phase, opts){
    const p = wrap01(phase);
    const stance = p < opts.stanceRatio;
    const u = stance ? p / opts.stanceRatio : (p - opts.stanceRatio) / (1 - opts.stanceRatio);
    let x = 0;
    let lift = 0;
    let roll = 0;
    if (stance) {
      x = GH.lerp(opts.step * 0.54, -opts.step * 0.54, u);
      const heel = Math.sin(u * Math.PI) * 0.15;
      roll = GH.lerp(0.32, -0.22, u) - heel * 0.08;
    } else {
      x = GH.lerp(-opts.step * 0.54, opts.step * 0.54, u);
      lift = -Math.sin(u * Math.PI) * opts.lift;
      roll = GH.lerp(-0.28, 0.3, u);
    }
    return { x, y: lift, roll, stance, u };
  }

  function buildLocomotionPose(anim, phase){
    const isRun = anim === 'run';
    const step = isRun ? 66 : 46;
    const lift = isRun ? 24 : 13;
    const stanceRatio = isRun ? 0.44 : 0.58;
    const bob = isRun ? 10 : 6;
    const lean = isRun ? 0.16 : 0.06;
    const armAmp = isRun ? 34 : 22;
    const pelvisBase = -78;
    const rootBob = Math.abs(Math.sin(phase * TAU)) * bob;
    const root = vec(0, pelvisBase + rootBob);
    const torsoAngle = -lean * Math.sin(phase * TAU) + (isRun ? 0.06 : 0);

    const backLeg = gaitFoot(phase + 0.5, { step, lift, stanceRatio });
    const frontLeg = gaitFoot(phase, { step, lift, stanceRatio });

    if (isRun) {
      const flight = Math.max(0, Math.sin((phase * TAU) * 2 - Math.PI * 0.45));
      backLeg.y -= flight * 8;
      frontLeg.y -= flight * 8;
    }

    const hipBack = vec(-8, root.y + 4);
    const hipFront = vec(10, root.y + 1);
    const ankleBase = -12;
    const ankleBack = vec(backLeg.x, ankleBase + backLeg.y);
    const ankleFront = vec(frontLeg.x, ankleBase + frontLeg.y);
    const kneeBack = solveIK(hipBack, ankleBack, 57, 58, -1);
    const kneeFront = solveIK(hipFront, ankleFront, 59, 57, 1);

    const shoulderBack = vec(-8, root.y - 62);
    const shoulderFront = vec(12, root.y - 58);
    const armSwing = Math.sin(phase * TAU);
    const elbowBackTarget = vec(-10 - armAmp * 0.4 * armSwing, root.y - 32 + Math.cos(phase * TAU) * 4);
    const handBack = vec(-18 - armAmp * armSwing, root.y - 6 + Math.max(0, Math.sin(phase * TAU)) * 10);
    const elbowBack = solveIK(shoulderBack, handBack, 38, 34, -1);
    const elbowFrontTarget = vec(18 + armAmp * 0.35 * armSwing, root.y - 26 - Math.cos(phase * TAU) * 4);
    const handFront = vec(28 + armAmp * armSwing, root.y - 2 + Math.max(0, -Math.sin(phase * TAU)) * 9);
    const elbowFront = solveIK(shoulderFront, handFront, 39, 35, 1);

    return {
      animation: anim,
      phase,
      root,
      torsoAngle,
      headAngle: torsoAngle * 0.32,
      shoulderBack,
      shoulderFront,
      elbowBack: mix(elbowBack, elbowBackTarget, 0.22),
      elbowFront: mix(elbowFront, elbowFrontTarget, 0.22),
      handBack,
      handFront,
      hipBack,
      hipFront,
      kneeBack,
      kneeFront,
      ankleBack,
      ankleFront,
      footBackAngle: backLeg.roll,
      footFrontAngle: frontLeg.roll,
      groundY: 0,
      rootBob,
      step
    };
  }

  function buildJumpPose(t){
    const u = GH.clamp(t, 0, 1);
    const jumpHeight = Math.sin(u * Math.PI) * 76;
    const forward = GH.lerp(-10, 20, u);
    const root = vec(forward, -88 - jumpHeight);
    const torsoAngle = -0.1 + Math.sin(u * Math.PI) * 0.18;
    const shoulderBack = vec(-8 + forward * 0.04, root.y - 60);
    const shoulderFront = vec(12 + forward * 0.05, root.y - 58);
    const hipBack = vec(-8, root.y + 3);
    const hipFront = vec(10, root.y + 1);

    const tuck = Math.sin(u * Math.PI);
    const ankleBack = vec(-18 + GH.lerp(-6, 8, u), -24 - jumpHeight * 0.04 + tuck * -18);
    const ankleFront = vec(26 + GH.lerp(-4, 10, u), -18 - jumpHeight * 0.04 + tuck * -28);
    const kneeBack = solveIK(hipBack, ankleBack, 52, 54, -1);
    const kneeFront = solveIK(hipFront, ankleFront, 56, 52, 1);

    const handBack = vec(-28 - tuck * 10, root.y - 52 - tuck * 6);
    const handFront = vec(32 + tuck * 18, root.y - 68 + tuck * 12);
    const elbowBack = solveIK(shoulderBack, handBack, 36, 33, -1);
    const elbowFront = solveIK(shoulderFront, handFront, 38, 35, 1);

    return {
      animation: 'jump', phase: u, root, torsoAngle, headAngle: torsoAngle * 0.28,
      shoulderBack, shoulderFront, elbowBack, elbowFront, handBack, handFront,
      hipBack, hipFront, kneeBack, kneeFront, ankleBack, ankleFront,
      footBackAngle: -0.45 + tuck * 0.3,
      footFrontAngle: 0.18 + tuck * 0.22,
      groundY: 0,
      rootBob: 0,
      step: 52
    };
  }

  const animationDefs = {
    walk: { label: 'Walk', duration: 1.0, frames: 16 },
    run: { label: 'Run', duration: 0.72, frames: 16 },
    jump: { label: 'Jump', duration: 0.9, frames: 12 }
  };

  function getPose(animation, normalizedTime){
    const t = wrap01(normalizedTime || 0);
    if (animation === 'jump') return buildJumpPose(t);
    return buildLocomotionPose(animation, t);
  }

  function getSampledFrames(animation){
    const def = animationDefs[animation] || animationDefs.walk;
    const out = [];
    for (let i = 0; i < def.frames; i += 1) {
      out.push(getPose(animation, i / def.frames));
    }
    return out;
  }

  function drawStickLimb(ctx, a, b, widthA, widthB, color){
    const ang = angle(a, b);
    const len = dist(a, b);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -widthA * 0.5);
    ctx.lineTo(len, -widthB * 0.5);
    ctx.lineTo(len, widthB * 0.5);
    ctx.lineTo(0, widthA * 0.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawHand(ctx, p, r){
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fillStyle = '#f1cab5';
    ctx.fill();
  }

  function drawBoot(ctx, ankle, footAngle, frontness){
    ctx.save();
    ctx.translate(ankle.x, ankle.y);
    ctx.rotate(footAngle);
    const scaleY = frontness > 0 ? 1 : 0.98;
    ctx.scale(1, scaleY);
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(10, -8);
    ctx.lineTo(25, -5);
    ctx.lineTo(34, 0);
    ctx.lineTo(30, 10);
    ctx.lineTo(-14, 10);
    ctx.lineTo(-14, -2);
    ctx.closePath();
    ctx.fillStyle = '#6a4c3b';
    ctx.fill();
    ctx.fillStyle = '#b58a71';
    ctx.fillRect(-14, -13, 24, 8);
    ctx.strokeStyle = 'rgba(52,34,24,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, 0, 2, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawBodyArt(ctx, pose){
    if (!art.ready) return;
    const torso = art.parts.torso;
    const skirt = art.parts.skirt;
    const head = art.parts.head;
    const bodyScale = 0.35;

    const torsoAnchor = { x: (pose.shoulderFront.x + pose.shoulderBack.x) * 0.5 + 2, y: (pose.hipFront.y + pose.hipBack.y) * 0.5 + 6 };
    ctx.save();
    ctx.translate(torsoAnchor.x, torsoAnchor.y);
    ctx.rotate(pose.torsoAngle);
    ctx.drawImage(art.image, torso.x, torso.y, torso.w, torso.h,
      -torso.pivotX * bodyScale, -torso.pivotY * bodyScale, torso.w * bodyScale, torso.h * bodyScale);
    ctx.restore();

    const skirtAnchor = { x: (pose.hipFront.x + pose.hipBack.x) * 0.5 + 2, y: (pose.hipFront.y + pose.hipBack.y) * 0.5 - 1 };
    ctx.save();
    ctx.translate(skirtAnchor.x, skirtAnchor.y);
    ctx.rotate(pose.torsoAngle * 0.4);
    ctx.drawImage(art.image, skirt.x, skirt.y, skirt.w, skirt.h,
      -skirt.pivotX * bodyScale, -skirt.pivotY * bodyScale, skirt.w * bodyScale, skirt.h * bodyScale);
    ctx.restore();

    const neck = { x: (pose.shoulderFront.x + pose.shoulderBack.x) * 0.5 + 8, y: (pose.shoulderFront.y + pose.shoulderBack.y) * 0.5 - 12 };
    const headScale = 0.36;
    ctx.save();
    ctx.translate(neck.x, neck.y);
    ctx.rotate(pose.headAngle);
    ctx.drawImage(art.image, head.x, head.y, head.w, head.h,
      -head.pivotX * headScale, -head.pivotY * headScale, head.w * headScale, head.h * headScale);
    ctx.restore();
  }

  function drawCharacter(ctx, pose, options){
    const opts = Object.assign({ x: 0, y: 0, scale: 1, showArt: true, showStick: false, showPlanes: false, shadow: false }, options || {});
    ctx.save();
    ctx.translate(opts.x, opts.y);
    ctx.scale(opts.scale, opts.scale);

    if (opts.shadow) {
      ctx.save();
      ctx.translate(0, 6);
      ctx.scale(1.1, 0.32);
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 12, 0, 0, TAU);
      ctx.fillStyle = 'rgba(32,38,42,0.18)';
      ctx.fill();
      ctx.restore();
    }

    // back limbs
    drawStickLimb(ctx, pose.hipBack, pose.kneeBack, 13, 11, '#454449');
    drawStickLimb(ctx, pose.kneeBack, pose.ankleBack, 11, 9, '#55545b');
    drawBoot(ctx, pose.ankleBack, pose.footBackAngle, -1);
    drawStickLimb(ctx, pose.shoulderBack, pose.elbowBack, 11, 10, '#6c564c');
    drawStickLimb(ctx, pose.elbowBack, pose.handBack, 10, 9, '#7a6358');
    drawHand(ctx, pose.handBack, 4.8);

    if (opts.showArt) drawBodyArt(ctx, pose);

    // front limbs
    drawStickLimb(ctx, pose.hipFront, pose.kneeFront, 14, 12, '#4b4950');
    drawStickLimb(ctx, pose.kneeFront, pose.ankleFront, 12, 10, '#5b5a61');
    drawBoot(ctx, pose.ankleFront, pose.footFrontAngle, 1);
    drawStickLimb(ctx, pose.shoulderFront, pose.elbowFront, 12, 10, '#7f6558');
    drawStickLimb(ctx, pose.elbowFront, pose.handFront, 10, 8.5, '#8c7264');
    drawHand(ctx, pose.handFront, 5.2);

    if (opts.showStick || opts.showPlanes) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = opts.showPlanes ? 'rgba(103,146,144,0.95)' : 'rgba(54,64,70,0.7)';
      ctx.lineWidth = opts.showPlanes ? 1.4 : 2;
      const lines = [
        [pose.hipBack, pose.kneeBack], [pose.kneeBack, pose.ankleBack],
        [pose.hipFront, pose.kneeFront], [pose.kneeFront, pose.ankleFront],
        [pose.shoulderBack, pose.elbowBack], [pose.elbowBack, pose.handBack],
        [pose.shoulderFront, pose.elbowFront], [pose.elbowFront, pose.handFront],
        [pose.shoulderBack, pose.shoulderFront], [pose.hipBack, pose.hipFront]
      ];
      lines.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      const nodes = [pose.hipBack, pose.hipFront, pose.kneeBack, pose.kneeFront, pose.ankleBack, pose.ankleFront, pose.shoulderBack, pose.shoulderFront, pose.elbowBack, pose.elbowFront, pose.handBack, pose.handFront];
      nodes.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.2, 0, TAU);
        ctx.fillStyle = '#f7f8f7';
        ctx.fill();
        ctx.stroke();
      });
    }

    if (opts.showPlanes) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(103,146,144,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-110, 0);
      ctx.lineTo(110, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pose.root.y + 12);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function saveState(state){ GH.saveJSON(STORAGE_KEY, state); }
  function loadState(){ return GH.storageJSON(STORAGE_KEY, null); }

  window.GameHubWalkRig = {
    storageKey: STORAGE_KEY,
    animationDefs,
    getPose,
    getSampledFrames,
    drawCharacter,
    saveState,
    loadState,
    art
  };
})();
