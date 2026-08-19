
const gravityCanvas = $("#gravity-canvas");
const gravityCtx = gravityCanvas.getContext("2d");
const gravityLeft = $("#gravity-left");
const gravityRight = $("#gravity-right");
const gravityThrust = $("#gravity-thrust");
const gravityReset = $("#gravity-reset");
const gravityAgain = $("#gravity-again");
const gravityMessage = $("#gravity-message");
const gravityMessageTitle = $("#gravity-message-title");
const gravityMessageText = $("#gravity-message-text");
const gravityHeight = $("#gravity-height");
const gravitySpeed = $("#gravity-speed");
const gravityCollect = $("#gravity-collect");
const gravitySlider = $("#gravity-slider");
const thrustSlider = $("#thrust-slider");
const gravityValue = $("#gravity-value");
const thrustValue = $("#thrust-value");
const gravityDifficultyButtons = $$("[data-gravity-difficulty]");

const GW = gravityCanvas.width;
const GH = gravityCanvas.height;
let GRAVITY_WORLD_W = GW * 2.5;
const GRAVITY_WORLD_H = GH;

const gravityInput = { left:false, right:false, thrust:false };
const gravityWorld = {
  gravity:0.025,
  thrust:0.060,
  rotationSpeed:0.034,
  drag:0.996,
  maxSpeed:3.6,
  running:true,
  cameraX:0
};

function updateGravityTuning(){
  gravityWorld.gravity=Number(gravitySlider.value);
  gravityWorld.thrust=Number(thrustSlider.value);
  gravityValue.textContent=gravityWorld.gravity.toFixed(3);
  thrustValue.textContent=gravityWorld.thrust.toFixed(3);
}
gravitySlider.addEventListener("input",updateGravityTuning);
thrustSlider.addEventListener("input",updateGravityTuning);
updateGravityTuning();

// Difficulty now changes the actual course rather than only the HUD.
// Easy is deliberately sparse; Medium introduces a checkpoint and optional
// exploration; Hard uses the full five-screen route with several required stops.
const GRAVITY_COURSES = {
  easy:{
    worldW:1800,
    start:{id:"start",x:82,y:838,w:150,h:18,type:"start"},
    goal:{id:"goal",x:1550,y:838,w:155,h:18,type:"goal"},
    checkpoints:[],
    stars:[],
    walls:[
      {id:"easy-p1",x:560,y:700,w:300,h:26},
      {id:"easy-v1",x:1010,y:28,w:34,h:220},
      {id:"easy-p2",x:1160,y:575,w:300,h:26}
    ]
  },

  medium:{
    worldW:2700,
    start:{id:"start",x:82,y:838,w:150,h:18,type:"start"},
    goal:{id:"goal",x:2470,y:838,w:155,h:18,type:"goal"},
    checkpoints:[
      {id:"checkpoint-1",x:1485,y:696,w:145,h:18,type:"checkpoint"}
    ],
    stars:[
      {x:1010,y:360,r:17},
      {x:1900,y:420,r:17},
      {x:2290,y:300,r:17}
    ],
    walls:[
      {id:"medium-p1",x:430,y:700,w:300,h:26},
      {id:"medium-v1",x:800,y:28,w:34,h:280},
      {id:"medium-p2",x:930,y:510,w:320,h:26},
      {id:"medium-p3",x:1420,y:720,w:280,h:26},
      {id:"medium-v2",x:1760,y:28,w:34,h:320},
      {id:"medium-p4",x:1890,y:545,w:300,h:26},
      {id:"medium-p5",x:2240,y:690,w:260,h:26}
    ]
  },

  hard:{
    worldW:3600,
    start:{id:"start",x:82,y:838,w:150,h:18,type:"start"},
    goal:{id:"goal",x:3370,y:838,w:155,h:18,type:"goal"},
    checkpoints:[
      {id:"checkpoint-1",x:1180,y:711,w:140,h:18,type:"checkpoint"},
      {id:"checkpoint-2",x:2345,y:431,w:145,h:18,type:"checkpoint"},
      {id:"checkpoint-3",x:2695,y:651,w:150,h:18,type:"checkpoint"}
    ],
    stars:[
      {x:900,y:350,r:17},
      {x:1545,y:430,r:17},
      {x:1980,y:380,r:17},
      {x:2470,y:300,r:17},
      {x:3060,y:390,r:17},
      {x:3270,y:650,r:17}
    ],
    walls:[
      {id:"hard-p1",x:350,y:690,w:270,h:26},
      {id:"hard-v1",x:660,y:28,w:34,h:300},
      {id:"hard-p2",x:790,y:470,w:300,h:26},
      {id:"hard-p3",x:1120,y:735,w:260,h:26},
      {id:"hard-v2",x:1370,y:28,w:34,h:350},
      {id:"hard-p4",x:1490,y:565,w:310,h:26},
      {id:"hard-floor-v1",x:1840,y:640,w:36,h:232},
      {id:"hard-p5",x:1940,y:735,w:250,h:26},
      {id:"hard-v3",x:2180,y:28,w:36,h:330},
      {id:"hard-p6",x:2290,y:455,w:300,h:26},
      {id:"hard-p7",x:2620,y:675,w:320,h:26},
      {id:"hard-v4",x:2920,y:28,w:36,h:350},
      {id:"hard-p8",x:3040,y:515,w:280,h:26},
      {id:"hard-p9",x:3150,y:690,w:180,h:26}
    ]
  }
};

let gravityDifficulty=localStorage.getItem("gravityDifficulty")||"easy";
if(!GRAVITY_COURSES[gravityDifficulty]) gravityDifficulty="easy";

let gravityWalls=[];
let gravityStartPad=null;
let gravityCheckpoints=[];
let gravityGoalPad=null;
let gravityStarsBase=[];
let gravityStars=[];
let gravityPads=[];
let landingWalls=[];
let checkpointVisited=[];
let rocket;

function applyGravityCourse(){
  const course=GRAVITY_COURSES[gravityDifficulty];
  GRAVITY_WORLD_W=course.worldW;

  gravityStartPad={...course.start};
  gravityGoalPad={...course.goal};
  gravityCheckpoints=course.checkpoints.map((cp,index)=>({...cp,index}));
  gravityStarsBase=course.stars.map(star=>({...star}));

  const bounds=[
    {id:"ceiling",x:0,y:0,w:GRAVITY_WORLD_W,h:28},
    {id:"floor",x:0,y:872,w:GRAVITY_WORLD_W,h:28},
    {id:"left-edge",x:0,y:0,w:28,h:GRAVITY_WORLD_H},
    {id:"right-edge",x:GRAVITY_WORLD_W-28,y:0,w:28,h:GRAVITY_WORLD_H}
  ];

  gravityWalls=[...bounds,...course.walls.map(w=>({...w}))];
  gravityPads=[gravityStartPad,...gravityCheckpoints,gravityGoalPad];
  landingWalls=gravityWalls.filter(w=>w.w>w.h*2 && w.y>40 && w.id!=="floor");

  gravityDifficultyButtons.forEach(button=>{
    button.classList.toggle("active",button.dataset.gravityDifficulty===gravityDifficulty);
  });
}

function resetGravityGame(){
  applyGravityCourse();
  rocket={
    x:gravityStartPad.x+gravityStartPad.w*.64,
    y:gravityStartPad.y-16,
    vx:0,vy:0,angle:0,radius:16,
    landed:false,crashed:false,landedOn:"start"
  };
  checkpointVisited=gravityCheckpoints.map(()=>false);
  gravityStars=gravityStarsBase.map(s=>({...s,collected:false}));
  gravityWorld.cameraX=0;
  gravityWorld.running=true;
  gravityInput.left=gravityInput.right=gravityInput.thrust=false;
  gravityMessage.classList.add("hidden");
  gravityAgain.textContent="Fly again";
  updateGravityGoalHud();
}

function gravityRectCircleCollision(rect,x,y,r){
  const cx=Math.max(rect.x,Math.min(x,rect.x+rect.w));
  const cy=Math.max(rect.y,Math.min(y,rect.y+rect.h));
  const dx=x-cx,dy=y-cy;
  return dx*dx+dy*dy<r*r;
}

function normalizeAngle(a){
  return Math.atan2(Math.sin(a),Math.cos(a));
}

function safeLanding(){
  const angle=Math.abs(normalizeAngle(rocket.angle));
  const totalSpeed=Math.hypot(rocket.vx,rocket.vy);
  return angle<=0.34 && totalSpeed<=2.05 && rocket.vy>=-0.15;
}

function crashGravity(reason="Rocket crashed"){
  if(!gravityWorld.running)return;
  gravityWorld.running=false;
  rocket.crashed=true;
  gravityAgain.textContent="Fly again";
  gravityMessageTitle.textContent="Crash!";
  gravityMessageText.textContent=reason;
  gravityMessage.classList.remove("hidden");
}

function allCheckpointsComplete(){
  return checkpointVisited.every(Boolean);
}

function updateGravityGoalHud(){
  const checks=checkpointVisited.filter(Boolean).length;
  const stars=gravityStars.filter(s=>s.collected).length;

  if(gravityCheckpoints.length===0 && gravityStars.length===0){
    gravityCollect.textContent="FINISH";
  }else{
    const parts=[];
    if(gravityCheckpoints.length) parts.push(`✓ ${checks}/${gravityCheckpoints.length}`);
    if(gravityStars.length) parts.push(`★ ${stars}/${gravityStars.length}`);
    gravityCollect.textContent=parts.join("  ");
  }
}

function registerLanding(surface){
  rocket.y=surface.y-rocket.radius;
  rocket.vx=0;
  rocket.vy=0;
  rocket.angle=0;
  rocket.landed=true;
  rocket.landedOn=surface.id;

  if(surface.type==="checkpoint" && !checkpointVisited[surface.index]){
    checkpointVisited[surface.index]=true;
    updateGravityGoalHud();
  }

  if(surface.type==="goal"){
    if(allCheckpointsComplete()){
      winGravity();
    }else{
      const left=checkpointVisited.filter(v=>!v).length;
      gravityAgain.textContent="Keep flying";
      gravityMessageTitle.textContent="Checkpoint missing";
      gravityMessageText.textContent=`Land at ${left} more checkpoint${left===1?"":"s"} before the finish.`;
      gravityMessage.classList.remove("hidden");
    }
  }
}

function winGravity(){
  if(!gravityWorld.running)return;
  gravityWorld.running=false;
  rocket.landed=true;
  gravityAgain.textContent="Fly again";
  gravityMessageTitle.textContent="Route complete!";
  const stars=gravityStars.filter(s=>s.collected).length;
  if(gravityCheckpoints.length===0 && gravityStars.length===0){
    gravityMessageText.textContent="Launch to landing complete!";
  }else{
    gravityMessageText.textContent=stars===gravityStars.length
      ?"Perfect route — every checkpoint and every star!"
      :`You stopped at every checkpoint and collected ${stars}/${gravityStars.length} stars.`;
  }
  gravityMessage.classList.remove("hidden");
}

function crossingTop(surface,prevY){
  const prevBottom=prevY+rocket.radius;
  const bottom=rocket.y+rocket.radius;
  const withinX=rocket.x>surface.x+rocket.radius*.55 &&
                rocket.x<surface.x+surface.w-rocket.radius*.55;

  // Only a downward crossing can become a landing. This prevents the launch
  // pad from immediately re-catching the rocket while it is thrusting upward.
  return withinX && rocket.vy>0 &&
         prevBottom<=surface.y+4 && bottom>=surface.y-2;
}

function tryLand(surface,prevY){
  if(!crossingTop(surface,prevY)) return false;
  if(!safeLanding()){
    crashGravity("Too fast or too tilted for a safe landing.");
    return true;
  }
  registerLanding(surface);
  return true;
}

function updateGravity(){
  if(!gravityWorld.running)return;

  if(rocket.landed){
    // A parked rocket stays upright and cannot rotate on the pad.
    rocket.angle=0;
    rocket.vx=0;
    rocket.vy=0;

    if(!gravityInput.thrust){
      const wanted=rocket.x-GW*.30;
      gravityWorld.cameraX+=(wanted-gravityWorld.cameraX)*.06;
      gravityWorld.cameraX=Math.max(0,Math.min(GRAVITY_WORLD_W-GW,gravityWorld.cameraX));
      return;
    }

    // Thrust breaks contact with the pad and begins a vertical take-off.
    rocket.landed=false;
    rocket.landedOn=null;
  }

  if(gravityInput.left)rocket.angle-=gravityWorld.rotationSpeed;
  if(gravityInput.right)rocket.angle+=gravityWorld.rotationSpeed;

  if(gravityInput.thrust){
    rocket.vx+=Math.sin(rocket.angle)*gravityWorld.thrust;
    rocket.vy-=Math.cos(rocket.angle)*gravityWorld.thrust;
  }

  const prevY=rocket.y;

  rocket.vy+=gravityWorld.gravity;
  rocket.vx*=gravityWorld.drag;
  rocket.vy*=gravityWorld.drag;

  const speed=Math.hypot(rocket.vx,rocket.vy);
  if(speed>gravityWorld.maxSpeed){
    rocket.vx=rocket.vx/speed*gravityWorld.maxSpeed;
    rocket.vy=rocket.vy/speed*gravityWorld.maxSpeed;
  }

  rocket.x+=rocket.vx;
  rocket.y+=rocket.vy;

  if(rocket.x<rocket.radius||rocket.x>GRAVITY_WORLD_W-rocket.radius||
     rocket.y<rocket.radius||rocket.y>GRAVITY_WORLD_H-rocket.radius){
    crashGravity("You hit the edge of the course.");
    return;
  }

  // Stars are optional exploration rewards and do not replace checkpoints.
  for(const star of gravityStars){
    if(!star.collected && Math.hypot(rocket.x-star.x,rocket.y-star.y)<rocket.radius+star.r+5){
      star.collected=true;
      updateGravityGoalHud();
    }
  }

  // Pads and every horizontal platform can be landed on.
  const surfaces=[...gravityPads,...landingWalls];
  for(const surface of surfaces){
    if(tryLand(surface,prevY)){
      if(!gravityWorld.running)return;
      break;
    }
  }

  // Pads are solid too: striking their side or underside is a crash.
  for(const pad of gravityPads){
    if(gravityRectCircleCollision(pad,rocket.x,rocket.y,rocket.radius)){
      const tangent=Math.abs((rocket.y+rocket.radius)-pad.y)<1.5;
      if(!tangent){
        crashGravity("You hit the side of a platform.");
        return;
      }
    }
  }

  for(const wall of gravityWalls){
    if(gravityRectCircleCollision(wall,rocket.x,rocket.y,rocket.radius)){
      const tangent=wall.w>wall.h*2 && Math.abs((rocket.y+rocket.radius)-wall.y)<1.5;
      if(!tangent){
        crashGravity("You hit the course wall.");
        return;
      }
    }
  }

  const wanted=rocket.x-GW*.30;
  gravityWorld.cameraX+=(wanted-gravityWorld.cameraX)*.06;
  gravityWorld.cameraX=Math.max(0,Math.min(GRAVITY_WORLD_W-GW,gravityWorld.cameraX));
}

function drawGravityBackground(){
  gravityCtx.fillStyle="#f5efe9";
  gravityCtx.fillRect(0,0,GW,GH);

  const offset=(gravityWorld.cameraX*.10)%GW;
  for(let i=0;i<28;i++){
    let x=((i*211)-offset)%(GW+90); if(x<0)x+=GW+90;
    const y=(i*179)%GH;
    gravityCtx.beginPath();
    gravityCtx.arc(x,y,i%6===0?2:1.1,0,Math.PI*2);
    gravityCtx.fillStyle=i%4===0?"rgba(112,107,216,.25)":"rgba(38,48,55,.10)";
    gravityCtx.fill();
  }

  gravityCtx.strokeStyle="rgba(112,107,216,.12)";
  gravityCtx.lineWidth=2;
  gravityCtx.beginPath();
  gravityCtx.arc(590,230,52,0,Math.PI*2);
  gravityCtx.stroke();
}

function withGravityCamera(drawFn){
  gravityCtx.save();
  gravityCtx.translate(-gravityWorld.cameraX,0);
  drawFn();
  gravityCtx.restore();
}

function drawGravityWalls(){
  gravityCtx.lineWidth=3;
  gravityCtx.lineJoin="round";
  for(const wall of gravityWalls){
    gravityCtx.fillStyle="#ede5de";
    gravityCtx.fillRect(wall.x,wall.y,wall.w,wall.h);
    gravityCtx.strokeStyle="#343944";
    gravityCtx.strokeRect(wall.x+1.5,wall.y+1.5,wall.w-3,wall.h-3);
  }
}

function drawFlag(x,y,accent,label){
  const poleX=x;
  gravityCtx.strokeStyle="#343944";
  gravityCtx.lineWidth=3;
  gravityCtx.beginPath();
  gravityCtx.moveTo(poleX,y);
  gravityCtx.lineTo(poleX,y-46);
  gravityCtx.stroke();

  gravityCtx.fillStyle=accent;
  gravityCtx.strokeStyle="#343944";
  gravityCtx.lineWidth=2.5;
  gravityCtx.beginPath();
  gravityCtx.moveTo(poleX+1,y-44);
  gravityCtx.lineTo(poleX+30,y-37);
  gravityCtx.lineTo(poleX+1,y-28);
  gravityCtx.closePath();
  gravityCtx.fill();
  gravityCtx.stroke();

  gravityCtx.fillStyle="#625d59";
  gravityCtx.font="800 11px system-ui";
  gravityCtx.textAlign="left";
  gravityCtx.fillText(label,poleX+7,y-7);
}

function drawPad(pad){
  const checkpoint=pad.type==="checkpoint";
  const goal=pad.type==="goal";
  const accent=goal?"#706bd8":checkpoint?"#4f8f84":"#77726d";

  gravityCtx.fillStyle="#f8f3ee";
  gravityCtx.strokeStyle="#343944";
  gravityCtx.lineWidth=3;
  gravityCtx.beginPath();
  gravityCtx.roundRect(pad.x,pad.y-2,pad.w,pad.h+6,6);
  gravityCtx.fill();
  gravityCtx.stroke();

  if(checkpoint){
    const visited=checkpointVisited[pad.index];
    gravityCtx.strokeStyle=visited?"#4f8f84":"rgba(79,143,132,.55)";
    gravityCtx.lineWidth=3;
    gravityCtx.setLineDash([10,7]);
    gravityCtx.beginPath();
    gravityCtx.moveTo(pad.x+10,pad.y+pad.h+9);
    gravityCtx.lineTo(pad.x+pad.w-10,pad.y+pad.h+9);
    gravityCtx.stroke();
    gravityCtx.setLineDash([]);

    gravityCtx.fillStyle=visited?"#4f8f84":"#625d59";
    gravityCtx.font="800 12px system-ui";
    gravityCtx.textAlign="center";
    gravityCtx.fillText(visited?"CHECK ✓":`CHECK ${pad.index+1}`,pad.x+pad.w/2,pad.y-9);
  }

  if(pad.type==="start") drawFlag(pad.x+5,pad.y,"#77726d","START");
  if(goal) drawFlag(pad.x+pad.w-8,pad.y,"#706bd8","FINISH");
}

function drawGravityStars(){
  for(const star of gravityStars){
    if(star.collected) continue;
    const pulse=1+Math.sin(performance.now()/260+star.x*.01)*.06;
    gravityCtx.save();
    gravityCtx.translate(star.x,star.y);
    gravityCtx.scale(pulse,pulse);
    gravityCtx.fillStyle="#f8f3ee";
    gravityCtx.strokeStyle="#706bd8";
    gravityCtx.lineWidth=2.6;
    gravityCtx.lineJoin="round";
    gravityCtx.beginPath();
    for(let i=0;i<10;i++){
      const a=-Math.PI/2+i*Math.PI/5;
      const r=i%2===0?star.r:star.r*.43;
      const x=Math.cos(a)*r;
      const y=Math.sin(a)*r;
      i===0?gravityCtx.moveTo(x,y):gravityCtx.lineTo(x,y);
    }
    gravityCtx.closePath();
    gravityCtx.fill();
    gravityCtx.stroke();
    gravityCtx.restore();
  }
}

function drawRocket(){
  gravityCtx.save();
  gravityCtx.translate(rocket.x,rocket.y);
  gravityCtx.rotate(rocket.angle);
  gravityCtx.lineJoin="round";
  gravityCtx.lineCap="round";

  if(gravityInput.thrust&&gravityWorld.running){
    gravityCtx.fillStyle="#c86f5b";
    gravityCtx.strokeStyle="#343944";
    gravityCtx.lineWidth=2.2;
    gravityCtx.beginPath();
    gravityCtx.moveTo(-5,15);
    gravityCtx.lineTo(0,30+Math.random()*5);
    gravityCtx.lineTo(5,15);
    gravityCtx.closePath();
    gravityCtx.fill();
    gravityCtx.stroke();
  }

  gravityCtx.fillStyle="#f8f2ec";
  gravityCtx.strokeStyle="#343944";
  gravityCtx.lineWidth=3;
  gravityCtx.beginPath();
  gravityCtx.moveTo(0,-22);
  gravityCtx.quadraticCurveTo(12,-7,10,13);
  gravityCtx.lineTo(0,8);
  gravityCtx.lineTo(-10,13);
  gravityCtx.quadraticCurveTo(-12,-7,0,-22);
  gravityCtx.closePath();
  gravityCtx.fill();
  gravityCtx.stroke();

  gravityCtx.fillStyle="#706bd8";
  gravityCtx.beginPath();
  gravityCtx.moveTo(-9,5);gravityCtx.lineTo(-17,15);gravityCtx.lineTo(-8,13);gravityCtx.closePath();
  gravityCtx.fill();gravityCtx.stroke();
  gravityCtx.beginPath();
  gravityCtx.moveTo(9,5);gravityCtx.lineTo(17,15);gravityCtx.lineTo(8,13);gravityCtx.closePath();
  gravityCtx.fill();gravityCtx.stroke();

  gravityCtx.fillStyle="#f8f2ec";
  gravityCtx.beginPath();
  gravityCtx.arc(0,-5,5.2,0,Math.PI*2);
  gravityCtx.fill();
  gravityCtx.strokeStyle="#706bd8";
  gravityCtx.lineWidth=2.7;
  gravityCtx.stroke();

  gravityCtx.restore();
}

function drawGravityProgress(){
  const margin=18,w=GW-margin*2,y=18;
  gravityCtx.fillStyle="rgba(37,43,51,.10)";
  gravityCtx.fillRect(margin,y,w,4);
  const progress=Math.max(0,Math.min(1,rocket.x/(GRAVITY_WORLD_W-28)));
  gravityCtx.fillStyle="#706bd8";
  gravityCtx.fillRect(margin,y,w*progress,4);

  // Checkpoint ticks.
  for(const cp of gravityCheckpoints){
    const px=margin+w*(cp.x/GRAVITY_WORLD_W);
    gravityCtx.fillStyle=checkpointVisited[cp.index]?"#4f8f84":"#9d9893";
    gravityCtx.beginPath();
    gravityCtx.arc(px,y+2,4,0,Math.PI*2);
    gravityCtx.fill();
  }
}

function drawGravity(){
  drawGravityBackground();
  withGravityCamera(()=>{
    drawGravityWalls();
    gravityPads.forEach(drawPad);
    drawGravityStars();
    drawRocket();
  });
  drawGravityProgress();

  const height=Math.max(0,Math.round((872-(rocket.y+rocket.radius))/8));
  gravityHeight.textContent=`${height} m`;
  gravitySpeed.textContent=Math.hypot(rocket.vx,rocket.vy).toFixed(1);
}

let gravityLast=performance.now();
function gravityLoop(now){
  const dt=Math.min(2.2,(now-gravityLast)/16.667);
  gravityLast=now;
  const steps=Math.max(1,Math.ceil(dt));
  for(let i=0;i<steps;i++)updateGravity();
  drawGravity();
  requestAnimationFrame(gravityLoop);
}

function bindGravityHold(button,key){
  const down=e=>{
    e.preventDefault();
    gravityInput[key]=true;
    button.classList.add("pressed");
  };
  const up=e=>{
    e.preventDefault();
    gravityInput[key]=false;
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown",down);
  button.addEventListener("pointerup",up);
  button.addEventListener("pointercancel",up);
  button.addEventListener("pointerleave",up);
}

bindGravityHold(gravityLeft,"left");
bindGravityHold(gravityRight,"right");
bindGravityHold(gravityThrust,"thrust");

document.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")gravityInput.left=true;
  if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")gravityInput.right=true;
  if(e.key==="ArrowUp"||e.key===" ")gravityInput.thrust=true;
});
document.addEventListener("keyup",e=>{
  if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")gravityInput.left=false;
  if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")gravityInput.right=false;
  if(e.key==="ArrowUp"||e.key===" ")gravityInput.thrust=false;
});

gravityDifficultyButtons.forEach(button=>{
  bindFastPress(button,()=>{
    gravityDifficulty=button.dataset.gravityDifficulty;
    localStorage.setItem("gravityDifficulty",gravityDifficulty);
    resetGravityGame();
  });
});

gravityReset.addEventListener("click",resetGravityGame);
gravityAgain.addEventListener("click",()=>{
  gravityMessage.classList.add("hidden");
  if(!gravityWorld.running) resetGravityGame();
});
resetGravityGame();
requestAnimationFrame(gravityLoop);
