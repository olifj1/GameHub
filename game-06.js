// ----------------------------
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

const GW = gravityCanvas.width;
const GH = gravityCanvas.height;
const GRAVITY_WORLD_W = GW * 3;
const GRAVITY_WORLD_H = GH;

const gravityInput = { left:false, right:false, thrust:false };
const gravityWorld = {
  gravity:0.025, thrust:0.060, rotationSpeed:0.034,
  drag:0.996, maxSpeed:3.6, running:true, cameraX:0
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

// Three screen widths of cavern, with a navigable route through the obstacles.
const gravityWalls=[
  {x:0,y:0,w:GRAVITY_WORLD_W,h:34},
  {x:0,y:1004,w:GRAVITY_WORLD_W,h:36},
  {x:0,y:0,w:34,h:GRAVITY_WORLD_H},
  {x:GRAVITY_WORLD_W-34,y:0,w:34,h:GRAVITY_WORLD_H},
  {x:360,y:770,w:250,h:30},
  {x:610,y:34,w:38,h:300},
  {x:760,y:505,w:260,h:30},
  {x:1040,y:705,w:230,h:30},
  {x:1200,y:34,w:38,h:350},
  {x:1370,y:555,w:260,h:30},
  {x:1580,y:760,w:230,h:30},
  {x:1760,y:34,w:40,h:360},
  {x:1840,y:520,w:190,h:30}
];

const gravityStartPad={x:92,y:976,w:155,h:18};
const gravityGoalPad={x:1940,y:976,w:170,h:18};
const gravityCollectiblesBase=[
  {x:835,y:400,r:18},
  {x:1510,y:450,r:18}
];

let gravityCollectibles=[];
let rocket;

function resetGravityGame(){
  rocket={
    x:gravityStartPad.x+gravityStartPad.w/2,
    y:gravityStartPad.y-16,
    vx:0,vy:0,angle:0,radius:16,landed:false,crashed:false
  };
  gravityCollectibles=gravityCollectiblesBase.map(c=>({...c,collected:false}));
  gravityWorld.cameraX=0;
  gravityWorld.running=true;
  gravityInput.left=gravityInput.right=gravityInput.thrust=false;
  gravityMessage.classList.add("hidden");
  gravityCollect.textContent=`0/${gravityCollectibles.length}`;
}

function gravityRectCircleCollision(rect,x,y,r){
  const cx=Math.max(rect.x,Math.min(x,rect.x+rect.w));
  const cy=Math.max(rect.y,Math.min(y,rect.y+rect.h));
  const dx=x-cx,dy=y-cy;
  return dx*dx+dy*dy<r*r;
}

function gravityPadLanding(pad){
  const withinX=rocket.x>pad.x+12&&rocket.x<pad.x+pad.w-12;
  const bottom=rocket.y+rocket.radius;
  return withinX&&bottom>=pad.y-4&&bottom<=pad.y+12;
}

function crashGravity(reason="Rocket crashed"){
  if(!gravityWorld.running)return;
  gravityWorld.running=false;rocket.crashed=true;
  gravityMessageTitle.textContent="Crash!";
  gravityMessageText.textContent=reason;
  gravityMessage.classList.remove("hidden");
}

function winGravity(){
  if(!gravityWorld.running)return;
  gravityWorld.running=false;rocket.landed=true;
  const got=gravityCollectibles.filter(c=>c.collected).length;
  gravityMessageTitle.textContent="Nice landing!";
  gravityMessageText.textContent=got===gravityCollectibles.length
    ?"Perfect flight — you collected both stars."
    :`You landed safely and collected ${got}/${gravityCollectibles.length} stars.`;
  gravityMessage.classList.remove("hidden");
}

function updateGravity(){
  if(!gravityWorld.running)return;

  if(gravityInput.left)rocket.angle-=gravityWorld.rotationSpeed;
  if(gravityInput.right)rocket.angle+=gravityWorld.rotationSpeed;
  if(gravityInput.thrust){
    rocket.vx+=Math.sin(rocket.angle)*gravityWorld.thrust;
    rocket.vy-=Math.cos(rocket.angle)*gravityWorld.thrust;
  }

  rocket.vy+=gravityWorld.gravity;
  rocket.vx*=gravityWorld.drag;rocket.vy*=gravityWorld.drag;
  const speed=Math.hypot(rocket.vx,rocket.vy);
  if(speed>gravityWorld.maxSpeed){
    rocket.vx=rocket.vx/speed*gravityWorld.maxSpeed;
    rocket.vy=rocket.vy/speed*gravityWorld.maxSpeed;
  }
  rocket.x+=rocket.vx;rocket.y+=rocket.vy;

  if(rocket.x<rocket.radius||rocket.x>GRAVITY_WORLD_W-rocket.radius||
     rocket.y<rocket.radius||rocket.y>GRAVITY_WORLD_H-rocket.radius){
    crashGravity("You hit the edge of the cavern.");return;
  }

  for(const star of gravityCollectibles){
    if(!star.collected&&Math.hypot(rocket.x-star.x,rocket.y-star.y)<rocket.radius+star.r+4){
      star.collected=true;
      gravityCollect.textContent=`${gravityCollectibles.filter(c=>c.collected).length}/${gravityCollectibles.length}`;
    }
  }

  // Landing on the far pad is mandatory to complete the level.
  if(gravityPadLanding(gravityGoalPad)){
    const upright=Math.abs(Math.sin(rocket.angle))<0.42;
    const gentle=Math.hypot(rocket.vx,rocket.vy)<2.7;
    if(upright&&gentle&&rocket.vy>=-0.4){
      rocket.y=gravityGoalPad.y-rocket.radius;
      rocket.vx=rocket.vy=0;rocket.angle=0;
      winGravity();return;
    }
  }

  if(gravityPadLanding(gravityStartPad)&&rocket.vy>=0&&Math.hypot(rocket.vx,rocket.vy)<3.2){
    rocket.y=gravityStartPad.y-rocket.radius;
    rocket.vy=Math.min(0,rocket.vy);
  }

  for(const wall of gravityWalls){
    if(gravityRectCircleCollision(wall,rocket.x,rocket.y,rocket.radius)){
      crashGravity("You hit the cavern wall.");return;
    }
  }

  const wanted=rocket.x-GW*0.34;
  gravityWorld.cameraX+=(wanted-gravityWorld.cameraX)*0.055;
  gravityWorld.cameraX=Math.max(0,Math.min(GRAVITY_WORLD_W-GW,gravityWorld.cameraX));
}

function drawGravityBackground(){
  const g=gravityCtx.createLinearGradient(0,0,0,GH);
  g.addColorStop(0,"#f8f2ec");
  g.addColorStop(1,"#eee4dc");
  gravityCtx.fillStyle=g;
  gravityCtx.fillRect(0,0,GW,GH);

  // Sparse graphic marks instead of a dark star field.
  const offset=(gravityWorld.cameraX*.12)%GW;
  for(let i=0;i<34;i++){
    let x=((i*193)-offset)%(GW+80); if(x<0)x+=GW+80;
    const y=(i*227)%GH;
    const r=(i%5===0)?2.2:1.2;
    gravityCtx.beginPath();
    gravityCtx.arc(x,y,r,0,Math.PI*2);
    gravityCtx.fillStyle=i%4===0?"rgba(112,107,216,.34)":"rgba(37,43,51,.12)";
    gravityCtx.fill();
  }

  // A few deliberately flat decorative circles give it a designed-space feel.
  gravityCtx.fillStyle="rgba(112,107,216,.055)";
  gravityCtx.beginPath(); gravityCtx.arc(590,290,54,0,Math.PI*2); gravityCtx.fill();
  gravityCtx.strokeStyle="rgba(112,107,216,.16)";
  gravityCtx.lineWidth=2;
  gravityCtx.beginPath(); gravityCtx.arc(590,290,41,0,Math.PI*2); gravityCtx.stroke();
}

function withGravityCamera(drawFn){
  gravityCtx.save();
  gravityCtx.translate(-gravityWorld.cameraX,0);
  drawFn();
  gravityCtx.restore();
}

function drawGravityWalls(){
  // Collision geometry stays rectangular, but visually reads as clean architectural line-work.
  gravityCtx.lineWidth=4;
  gravityCtx.lineJoin="round";
  for(const wall of gravityWalls){
    gravityCtx.fillStyle="rgba(231,219,210,.42)";
    gravityCtx.fillRect(wall.x,wall.y,wall.w,wall.h);
    gravityCtx.strokeStyle="#343944";
    gravityCtx.strokeRect(wall.x+2,wall.y+2,wall.w-4,wall.h-4);
  }
}

function drawPad(pad,goal=false){
  const accent=goal?"#706bd8":"#7b7773";
  gravityCtx.fillStyle="#f7f1eb";
  gravityCtx.strokeStyle="#343944";
  gravityCtx.lineWidth=3;
  gravityCtx.beginPath();
  gravityCtx.roundRect(pad.x,pad.y-2,pad.w,pad.h+6,7);
  gravityCtx.fill();
  gravityCtx.stroke();

  gravityCtx.strokeStyle=accent;
  gravityCtx.lineWidth=3;
  gravityCtx.setLineDash([11,8]);
  gravityCtx.beginPath();
  gravityCtx.moveTo(pad.x+10,pad.y+pad.h+10);
  gravityCtx.lineTo(pad.x+pad.w-10,pad.y+pad.h+10);
  gravityCtx.stroke();
  gravityCtx.setLineDash([]);

  gravityCtx.fillStyle=accent;
  gravityCtx.font="800 14px system-ui";
  gravityCtx.textAlign="center";
  gravityCtx.fillText(goal?"LAND HERE":"START",pad.x+pad.w/2,pad.y-8);
}

function drawGravityCollectibles(){
  for(const star of gravityCollectibles){
    if(star.collected)continue;
    const pulse=1+Math.sin(performance.now()/240+star.x)*.08;
    gravityCtx.save();
    gravityCtx.translate(star.x,star.y);
    gravityCtx.scale(pulse,pulse);
    gravityCtx.strokeStyle="#706bd8";
    gravityCtx.fillStyle="#f7f1eb";
    gravityCtx.lineWidth=3;
    gravityCtx.beginPath();
    for(let i=0;i<8;i++){
      const a=-Math.PI/2+i*Math.PI/4;
      const r=i%2===0?star.r:star.r*.36;
      const x=Math.cos(a)*r,y=Math.sin(a)*r;
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
    gravityCtx.lineWidth=2.5;
    gravityCtx.beginPath();
    gravityCtx.moveTo(-6,15);
    gravityCtx.quadraticCurveTo(0,34+Math.random()*7,6,15);
    gravityCtx.closePath();
    gravityCtx.fill();
    gravityCtx.stroke();
  }

  // Simple outlined rocket: more logo/illustration than sprite.
  gravityCtx.fillStyle="#f8f2ec";
  gravityCtx.strokeStyle="#343944";
  gravityCtx.lineWidth=3;
  gravityCtx.beginPath();
  gravityCtx.moveTo(0,-22);
  gravityCtx.quadraticCurveTo(13,-8,11,13);
  gravityCtx.lineTo(0,8);
  gravityCtx.lineTo(-11,13);
  gravityCtx.quadraticCurveTo(-13,-8,0,-22);
  gravityCtx.closePath();
  gravityCtx.fill();
  gravityCtx.stroke();

  gravityCtx.fillStyle="#706bd8";
  gravityCtx.strokeStyle="#343944";
  gravityCtx.beginPath();
  gravityCtx.moveTo(-10,5); gravityCtx.lineTo(-18,15); gravityCtx.lineTo(-9,13); gravityCtx.closePath();
  gravityCtx.fill(); gravityCtx.stroke();
  gravityCtx.beginPath();
  gravityCtx.moveTo(10,5); gravityCtx.lineTo(18,15); gravityCtx.lineTo(9,13); gravityCtx.closePath();
  gravityCtx.fill(); gravityCtx.stroke();

  gravityCtx.fillStyle="#f8f2ec";
  gravityCtx.beginPath();
  gravityCtx.arc(0,-5,5.5,0,Math.PI*2);
  gravityCtx.fill();
  gravityCtx.strokeStyle="#706bd8";
  gravityCtx.lineWidth=3;
  gravityCtx.stroke();

  gravityCtx.restore();
}

function drawGravityProgress(){
  const margin=18,w=GW-margin*2,y=18;
  gravityCtx.fillStyle="rgba(37,43,51,.12)";
  gravityCtx.fillRect(margin,y,w,4);
  const progress=Math.max(0,Math.min(1,rocket.x/(GRAVITY_WORLD_W-34)));
  gravityCtx.fillStyle="#706bd8";
  gravityCtx.fillRect(margin,y,w*progress,4);
  gravityCtx.fillStyle="#343944";
  gravityCtx.font="800 11px system-ui";
  gravityCtx.textAlign="right";
  gravityCtx.fillText(`${Math.round(progress*100)}%`,GW-margin,y+18);
}

function drawGravity(){
  drawGravityBackground();
  withGravityCamera(()=>{drawGravityWalls();drawPad(gravityStartPad,false);drawPad(gravityGoalPad,true);drawGravityCollectibles();drawRocket();});
  drawGravityProgress();
  const height=Math.max(0,Math.round((1004-(rocket.y+rocket.radius))/8));
  gravityHeight.textContent=`${height} m`;
  gravitySpeed.textContent=Math.hypot(rocket.vx,rocket.vy).toFixed(1);
}

let gravityLast=performance.now();
function gravityLoop(now){
  const dt=Math.min(2.2,(now-gravityLast)/16.667);gravityLast=now;
  const steps=Math.max(1,Math.ceil(dt));for(let i=0;i<steps;i++)updateGravity();
  drawGravity();requestAnimationFrame(gravityLoop);
}

function bindGravityHold(button,key){
  const down=e=>{e.preventDefault();gravityInput[key]=true;button.classList.add("pressed")};
  const up=e=>{e.preventDefault();gravityInput[key]=false;button.classList.remove("pressed")};
  button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up);button.addEventListener("pointerleave",up);
}
bindGravityHold(gravityLeft,"left");bindGravityHold(gravityRight,"right");bindGravityHold(gravityThrust,"thrust");

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

gravityReset.addEventListener("click",resetGravityGame);
gravityAgain.addEventListener("click",resetGravityGame);
resetGravityGame();
requestAnimationFrame(gravityLoop);
