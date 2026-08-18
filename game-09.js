const flightCanvas = $("#flight-canvas");
const flightCtx = flightCanvas.getContext("2d");
const flightUp = $("#flight-up");
const flightDown = $("#flight-down");
const flightEngineButton = $("#flight-engine");
const flightEngineLabel = $("#flight-engine-label");
const flightReset = $("#flight-reset");
const flightSpeed = $("#flight-speed");
const flightHoops = $("#flight-hoops");
const flightEngineState = $("#flight-engine-state");
const flightStatus = $("#flight-status");
const flightMessage = $("#flight-message");
const flightMessageTitle = $("#flight-message-title");
const flightMessageText = $("#flight-message-text");
const flightAgain = $("#flight-again");

const FW = flightCanvas.width;
const FH = flightCanvas.height;
const FLIGHT_WORLD_W = 6500;
const GROUND_Y = 520;
const START_RUNWAY = {x:45,w:720};
const FINISH_RUNWAY = {x:5650,w:720};

const flightInput = {up:false,down:false};
const flightWorld = {
  cameraX:0,
  pitchRate:0.038,
  gravity:0.16,
  maxSpeed:6.1,
  cruiseSpeed:5.0,
  acceleration:0.045,
  coastDrag:0.992,
  engineDrag:0.998,
  glideGravity:0.052,
  glideDrag:0.9985,
  glideSteer:0.028,
  running:true
};

const hoopTemplate = [
  {x:1250,y:305,r:48},
  {x:2220,y:205,r:48},
  {x:3190,y:355,r:48},
  {x:4250,y:190,r:48},
  {x:5200,y:325,r:48}
];

let hoops=[];
let plane;
let cumulativeTurn=0;
let lastAngle=0;

function normalAngle(a){
  return Math.atan2(Math.sin(a),Math.cos(a));
}

function resetFlight(){
  plane={
    x:175,
    y:GROUND_Y-23,
    angle:0,
    speed:0,
    vx:0,
    vy:0,
    engine:false,
    landed:true,
    crashed:false,
    finished:false
  };
  hoops=hoopTemplate.map(h=>({...h,hit:false}));
  flightWorld.cameraX=0;
  flightWorld.running=true;
  flightInput.up=flightInput.down=false;
  cumulativeTurn=0;
  lastAngle=0;
  flightMessage.classList.add("hidden");
  flightStatus.textContent="Start the engine when you are ready.";
  updateFlightHud();
}

function toggleEngine(){
  if(!flightWorld.running)return;
  plane.engine=!plane.engine;
  if(plane.engine){
    flightStatus.textContent=plane.landed?"Engine started — build some speed.":"Engine on.";
  }else{
    flightStatus.textContent=plane.landed?"Engine off.":"Engine off — you are gliding.";
  }
  updateFlightHud();
}

function updateFlightHud(){
  flightEngineState.textContent=plane.engine?"ON":"OFF";
  flightEngineState.classList.toggle("on",plane.engine);
  flightEngineLabel.textContent=plane.engine?"ENGINE ON":"START ENGINE";
  flightSpeed.textContent=Math.round(plane.speed*28);
  flightHoops.textContent=`${hoops.filter(h=>h.hit).length} / ${hoops.length}`;
}

function crashFlight(message){
  if(!flightWorld.running)return;
  flightWorld.running=false;
  plane.crashed=true;
  plane.engine=false;
  updateFlightHud();
  flightMessageTitle.textContent="Crash!";
  flightMessageText.textContent=message;
  flightAgain.textContent="Try again";
  flightMessage.classList.remove("hidden");
}

function finishFlight(){
  if(!flightWorld.running)return;
  flightWorld.running=false;
  plane.finished=true;
  plane.engine=false;
  updateFlightHud();
  flightMessageTitle.textContent="Flight complete!";
  flightMessageText.textContent="All hoops collected and a safe landing.";
  flightAgain.textContent="Fly again";
  flightMessage.classList.remove("hidden");
}

function onRunway(x){
  if(x>=START_RUNWAY.x && x<=START_RUNWAY.x+START_RUNWAY.w) return "start";
  if(x>=FINISH_RUNWAY.x && x<=FINISH_RUNWAY.x+FINISH_RUNWAY.w) return "finish";
  return null;
}

function safeLanding(verticalSpeed){
  const angle=Math.abs(normalAngle(plane.angle));
  const movingForward=Math.cos(plane.angle)>.80;
  return angle<0.20 && verticalSpeed<1.25 && plane.speed<5.2 && movingForward;
}

function updateHoops(){
  for(const hoop of hoops){
    if(hoop.hit)continue;
    const dx=plane.x-hoop.x,dy=plane.y-hoop.y;
    if(Math.hypot(dx,dy)<hoop.r*.72){
      hoop.hit=true;
      flightHoops.textContent=`${hoops.filter(h=>h.hit).length} / ${hoops.length}`;
      flightStatus.textContent=hoops.every(h=>h.hit)?"All hoops — find the finish runway.":"Hoop!";
    }
  }
}

function updateFlight(){
  if(!flightWorld.running)return;

  const wasLanded=plane.landed;

  if(plane.landed){
    // On the runway the aeroplane stays essentially level. Once it has enough
    // speed, Up lets the nose rise and breaks ground naturally.
    if(plane.engine){
      plane.speed=Math.min(flightWorld.cruiseSpeed,plane.speed+flightWorld.acceleration);
    }else{
      plane.speed*=.972;
      if(plane.speed<.015)plane.speed=0;
    }

    if(flightInput.up && plane.speed>2.4){
      plane.angle=Math.max(-0.25,plane.angle-flightWorld.pitchRate*.55);
    }else{
      plane.angle*=.88;
    }

    if(flightInput.down){
      plane.angle=Math.min(.08,plane.angle+flightWorld.pitchRate*.35);
    }

    plane.x+=Math.max(0,Math.cos(plane.angle)*plane.speed);
    plane.vx=Math.max(0,Math.cos(plane.angle)*plane.speed);
    plane.vy=0;

    if(plane.angle<-0.075 && plane.speed>2.75){
      plane.landed=false;
      plane.y-=1.5;
      plane.vx=Math.cos(plane.angle)*plane.speed;
      plane.vy=Math.sin(plane.angle)*plane.speed;
      flightStatus.textContent="Airborne!";
    }else{
      plane.y=GROUND_Y-23;
      plane.angle=Math.max(-0.10,Math.min(.08,plane.angle));
    }
  }

  if(!plane.landed){
    if(flightInput.up)plane.angle-=flightWorld.pitchRate;
    if(flightInput.down)plane.angle+=flightWorld.pitchRate;

    // Tiny self-levelling around normal flight keeps the controls friendly,
    // but disappears once the aeroplane is committed to a steep turn/loop.
    const n=normalAngle(plane.angle);
    if(!flightInput.up&&!flightInput.down&&Math.abs(n)<.62){
      plane.angle-=n*.012;
    }

    let verticalSpeed=plane.vy;
    let horizontalSpeed=plane.vx;

    if(plane.engine){
      // Powered flight remains responsive and arcade-like: the velocity is
      // pulled quite strongly toward the direction the nose is pointing.
      plane.speed+=(flightWorld.cruiseSpeed-plane.speed)*.016;
      plane.speed=Math.min(flightWorld.maxSpeed,plane.speed);
      plane.speed*=flightWorld.engineDrag;

      const targetVx=Math.cos(plane.angle)*plane.speed;
      const targetVy=Math.sin(plane.angle)*plane.speed+flightWorld.gravity;
      plane.vx+=(targetVx-plane.vx)*.24;
      plane.vy+=(targetVy-plane.vy)*.24;
    }else{
      // With no engine there is no forward thrust. Keep the aircraft's
      // existing momentum, let the controls gently change its flight path,
      // and continuously accelerate it downward under gravity.
      let glideSpeed=Math.hypot(plane.vx,plane.vy);
      if(glideSpeed<.01){
        plane.vx=Math.cos(plane.angle)*Math.max(.9,plane.speed);
        plane.vy=Math.sin(plane.angle)*Math.max(.9,plane.speed);
        glideSpeed=Math.hypot(plane.vx,plane.vy);
      }

      const velocityAngle=Math.atan2(plane.vy,plane.vx);
      const angleError=normalAngle(plane.angle-velocityAngle);

      // Aerodynamic steering is deliberately much weaker than powered flight.
      // Pulling the nose up can trade speed for a brief climb, but cannot
      // manufacture height indefinitely.
      const steer=flightWorld.glideSteer*Math.min(1,glideSpeed/3.2);
      const guidedAngle=velocityAngle+angleError*steer;
      const controlDrag=Math.min(.004,Math.abs(angleError)*.0014);
      const retainedSpeed=glideSpeed*(flightWorld.glideDrag-controlDrag);

      plane.vx=Math.cos(guidedAngle)*retainedSpeed;
      plane.vy=Math.sin(guidedAngle)*retainedSpeed+flightWorld.glideGravity;

      // At low airspeed the nose naturally wants to fall rather than hanging
      // in a powered-looking climb.
      const actualSpeed=Math.hypot(plane.vx,plane.vy);
      if(actualSpeed<1.65){
        const n=normalAngle(plane.angle);
        if(n<.18) plane.angle+=.010;
      }
    }

    horizontalSpeed=plane.vx;
    verticalSpeed=plane.vy;
    plane.speed=Math.hypot(horizontalSpeed,verticalSpeed);

    plane.x+=horizontalSpeed;
    plane.y+=verticalSpeed;

    // Track a full rotation for a small bit of feedback; loops are free-form
    // and do not need to be an objective.
    const current=plane.angle;
    let delta=normalAngle(current-lastAngle);
    cumulativeTurn+=delta;
    lastAngle=current;
    if(Math.abs(cumulativeTurn)>=Math.PI*2){
      cumulativeTurn=0;
      flightStatus.textContent="Loop!";
    }

    if(plane.y+23>=GROUND_Y){
      const runway=onRunway(plane.x);
      if(runway && safeLanding(verticalSpeed)){
        plane.y=GROUND_Y-23;
        plane.angle=0;
        plane.landed=true;
        plane.speed=Math.min(plane.speed,3.6);
        plane.vx=plane.speed;
        plane.vy=0;

        if(runway==="finish"){
          if(hoops.every(h=>h.hit)){
            finishFlight();
            return;
          }
          const left=hoops.filter(h=>!h.hit).length;
          flightStatus.textContent=`Safe landing — ${left} hoop${left===1?"":"s"} still to fly through.`;
        }else{
          flightStatus.textContent="Safe landing.";
        }
      }else{
        crashFlight(runway?"Too fast or too steep for a safe landing.":"You need a runway to land.");
        return;
      }
    }

    if(plane.y<-80){
      crashFlight("You flew too high.");
      return;
    }
  }

  if(plane.x<20){
    plane.x=20;
  }
  if(plane.x>FLIGHT_WORLD_W-30){
    crashFlight("You flew beyond the airfield.");
    return;
  }

  updateHoops();

  // Follow the plane horizontally, keeping some view ahead.
  const wanted=plane.x-FW*.30;
  flightWorld.cameraX+=(wanted-flightWorld.cameraX)*.065;
  flightWorld.cameraX=Math.max(0,Math.min(FLIGHT_WORLD_W-FW,flightWorld.cameraX));

  if(wasLanded&&!plane.landed) lastAngle=plane.angle;

  updateFlightHud();
}

function drawCloud(x,y,s=1){
  flightCtx.save();
  flightCtx.translate(x,y);
  flightCtx.scale(s,s);
  flightCtx.strokeStyle="rgba(67,76,83,.18)";
  flightCtx.lineWidth=3;
  flightCtx.lineCap="round";
  flightCtx.beginPath();
  flightCtx.moveTo(-35,9);
  flightCtx.bezierCurveTo(-30,-4,-17,-7,-8,0);
  flightCtx.bezierCurveTo(-2,-18,22,-17,27,1);
  flightCtx.bezierCurveTo(41,1,47,10,43,18);
  flightCtx.lineTo(-31,18);
  flightCtx.stroke();
  flightCtx.restore();
}

function drawBackground(){
  flightCtx.fillStyle="#edf0ee";
  flightCtx.fillRect(0,0,FW,FH);

  // soft distant horizon
  flightCtx.fillStyle="#e4ded7";
  flightCtx.beginPath();
  flightCtx.moveTo(0,438);
  for(let x=0;x<=FW;x+=80){
    const y=425+Math.sin((x+flightWorld.cameraX*.10)/150)*15;
    flightCtx.lineTo(x,y);
  }
  flightCtx.lineTo(FW,FH);
  flightCtx.lineTo(0,FH);
  flightCtx.closePath();
  flightCtx.fill();

  const cloudShift=flightWorld.cameraX*.18;
  for(let i=0;i<10;i++){
    let x=(i*285-cloudShift)%(FW+320);
    if(x<-160)x+=FW+320;
    drawCloud(x,95+(i%4)*72,.75+(i%3)*.16);
  }
}

function drawGround(){
  flightCtx.fillStyle="#d7d1ca";
  flightCtx.fillRect(0,GROUND_Y,FLIGHT_WORLD_W,FH-GROUND_Y);
  flightCtx.strokeStyle="#565d63";
  flightCtx.lineWidth=3;
  flightCtx.beginPath();
  flightCtx.moveTo(0,GROUND_Y);
  flightCtx.lineTo(FLIGHT_WORLD_W,GROUND_Y);
  flightCtx.stroke();

  // sparse graphic grass marks
  flightCtx.strokeStyle="rgba(71,79,73,.30)";
  flightCtx.lineWidth=2;
  for(let x=0;x<FLIGHT_WORLD_W;x+=105){
    flightCtx.beginPath();
    flightCtx.moveTo(x,GROUND_Y+18);
    flightCtx.lineTo(x+5,GROUND_Y+10);
    flightCtx.lineTo(x+9,GROUND_Y+18);
    flightCtx.stroke();
  }
}

function drawRunway(runway,label){
  flightCtx.fillStyle="#f7f2ec";
  flightCtx.strokeStyle="#4f565d";
  flightCtx.lineWidth=3;
  flightCtx.beginPath();
  flightCtx.roundRect(runway.x,GROUND_Y-8,runway.w,34,7);
  flightCtx.fill();
  flightCtx.stroke();

  flightCtx.strokeStyle="#8a8681";
  flightCtx.lineWidth=2;
  flightCtx.setLineDash([28,18]);
  flightCtx.beginPath();
  flightCtx.moveTo(runway.x+20,GROUND_Y+9);
  flightCtx.lineTo(runway.x+runway.w-20,GROUND_Y+9);
  flightCtx.stroke();
  flightCtx.setLineDash([]);

  flightCtx.fillStyle="#6f6965";
  flightCtx.font="800 15px system-ui";
  flightCtx.textAlign="center";
  flightCtx.fillText(label,runway.x+runway.w/2,GROUND_Y+52);
}

function drawHoop(hoop,index){
  flightCtx.save();
  flightCtx.translate(hoop.x,hoop.y);

  flightCtx.strokeStyle=hoop.hit?"rgba(85,139,128,.28)":"#568a83";
  flightCtx.lineWidth=8;
  flightCtx.beginPath();
  flightCtx.arc(0,0,hoop.r,0,Math.PI*2);
  flightCtx.stroke();

  flightCtx.strokeStyle=hoop.hit?"rgba(85,139,128,.18)":"rgba(86,138,131,.32)";
  flightCtx.lineWidth=2;
  flightCtx.beginPath();
  flightCtx.arc(0,0,hoop.r+10,0,Math.PI*2);
  flightCtx.stroke();

  flightCtx.fillStyle=hoop.hit?"rgba(85,139,128,.40)":"#568a83";
  flightCtx.font="850 14px system-ui";
  flightCtx.textAlign="center";
  flightCtx.textBaseline="middle";
  flightCtx.fillText(hoop.hit?"✓":String(index+1),0,1);
  flightCtx.restore();
}

function drawFinishFlag(){
  const x=FINISH_RUNWAY.x+FINISH_RUNWAY.w-45;
  flightCtx.strokeStyle="#4f565d";
  flightCtx.lineWidth=3;
  flightCtx.beginPath();
  flightCtx.moveTo(x,GROUND_Y-7);
  flightCtx.lineTo(x,GROUND_Y-78);
  flightCtx.stroke();

  flightCtx.fillStyle="#b87068";
  flightCtx.beginPath();
  flightCtx.moveTo(x+2,GROUND_Y-75);
  flightCtx.lineTo(x+42,GROUND_Y-63);
  flightCtx.lineTo(x+2,GROUND_Y-48);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();
}

function drawPlane(){
  flightCtx.save();
  flightCtx.translate(plane.x,plane.y);
  flightCtx.rotate(plane.angle);
  flightCtx.lineJoin="round";
  flightCtx.lineCap="round";

  // engine motion mark
  if(plane.engine&&flightWorld.running){
    flightCtx.strokeStyle="rgba(184,112,104,.60)";
    flightCtx.lineWidth=3;
    flightCtx.beginPath();
    flightCtx.moveTo(-31,-4);
    flightCtx.lineTo(-45,-4);
    flightCtx.moveTo(-33,4);
    flightCtx.lineTo(-42,4);
    flightCtx.stroke();
  }

  // clean side-view aeroplane
  flightCtx.fillStyle="#f7f2ec";
  flightCtx.strokeStyle="#343b43";
  flightCtx.lineWidth=3;
  flightCtx.beginPath();
  flightCtx.moveTo(-31,0);
  flightCtx.lineTo(-10,-7);
  flightCtx.lineTo(18,-7);
  flightCtx.quadraticCurveTo(32,-5,38,0);
  flightCtx.quadraticCurveTo(30,7,17,8);
  flightCtx.lineTo(-10,8);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  // wing
  flightCtx.fillStyle="#d9e3e0";
  flightCtx.beginPath();
  flightCtx.moveTo(-2,-3);
  flightCtx.lineTo(13,-22);
  flightCtx.lineTo(20,-20);
  flightCtx.lineTo(10,1);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  flightCtx.beginPath();
  flightCtx.moveTo(-4,5);
  flightCtx.lineTo(13,20);
  flightCtx.lineTo(19,18);
  flightCtx.lineTo(9,4);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  // tail
  flightCtx.fillStyle="#b87068";
  flightCtx.beginPath();
  flightCtx.moveTo(-22,-4);
  flightCtx.lineTo(-29,-18);
  flightCtx.lineTo(-18,-16);
  flightCtx.lineTo(-10,-5);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  // cockpit
  flightCtx.fillStyle="#d6e1e4";
  flightCtx.beginPath();
  flightCtx.moveTo(14,-7);
  flightCtx.quadraticCurveTo(23,-13,29,-5);
  flightCtx.lineTo(26,-3);
  flightCtx.lineTo(15,-3);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  // landing wheels, useful orientation cue
  flightCtx.fillStyle="#343b43";
  flightCtx.beginPath();
  flightCtx.arc(-5,12,4,0,Math.PI*2);
  flightCtx.arc(21,11,4,0,Math.PI*2);
  flightCtx.fill();

  flightCtx.restore();
}

function drawProgress(){
  const x=24,y=24,w=FW-48;
  flightCtx.strokeStyle="rgba(52,59,67,.16)";
  flightCtx.lineWidth=4;
  flightCtx.beginPath();
  flightCtx.moveTo(x,y);
  flightCtx.lineTo(x+w,y);
  flightCtx.stroke();

  const p=Math.max(0,Math.min(1,plane.x/FLIGHT_WORLD_W));
  flightCtx.strokeStyle="#b87068";
  flightCtx.lineWidth=4;
  flightCtx.beginPath();
  flightCtx.moveTo(x,y);
  flightCtx.lineTo(x+w*p,y);
  flightCtx.stroke();

  for(const hoop of hoops){
    const hx=x+w*(hoop.x/FLIGHT_WORLD_W);
    flightCtx.fillStyle=hoop.hit?"#568a83":"#aaa5a0";
    flightCtx.beginPath();
    flightCtx.arc(hx,y,5,0,Math.PI*2);
    flightCtx.fill();
  }
}

function drawFlight(){
  drawBackground();

  flightCtx.save();
  flightCtx.translate(-flightWorld.cameraX,0);
  drawGround();
  drawRunway(START_RUNWAY,"START");
  drawRunway(FINISH_RUNWAY,"LAND");
  drawFinishFlag();
  hoops.forEach(drawHoop);
  drawPlane();
  flightCtx.restore();

  drawProgress();
}

function bindHold(button,key){
  const down=e=>{
    if(e.pointerType==="mouse"&&e.button!==0)return;
    e.preventDefault();
    flightInput[key]=true;
    button.classList.add("pressed");
  };
  const up=e=>{
    e.preventDefault();
    flightInput[key]=false;
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown",down);
  button.addEventListener("pointerup",up);
  button.addEventListener("pointercancel",up);
  button.addEventListener("pointerleave",up);
}

bindHold(flightUp,"up");
bindHold(flightDown,"down");

let enginePointer=0;
flightEngineButton.addEventListener("pointerdown",e=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  enginePointer=performance.now();
  e.preventDefault();
  toggleEngine();
});
flightEngineButton.addEventListener("click",e=>{
  if(performance.now()-enginePointer<600){e.preventDefault();return;}
  toggleEngine();
});

flightReset.addEventListener("click",resetFlight);
flightAgain.addEventListener("click",resetFlight);

document.addEventListener("keydown",e=>{
  if(e.key==="ArrowUp"||e.key.toLowerCase()==="w")flightInput.up=true;
  if(e.key==="ArrowDown"||e.key.toLowerCase()==="s")flightInput.down=true;
  if(e.key===" "||e.key==="Enter")toggleEngine();
});
document.addEventListener("keyup",e=>{
  if(e.key==="ArrowUp"||e.key.toLowerCase()==="w")flightInput.up=false;
  if(e.key==="ArrowDown"||e.key.toLowerCase()==="s")flightInput.down=false;
});

let flightLast=performance.now();
function flightLoop(now){
  const dt=Math.min(2.3,(now-flightLast)/16.667);
  flightLast=now;
  const steps=Math.max(1,Math.ceil(dt));
  for(let i=0;i<steps;i++)updateFlight();
  drawFlight();
  requestAnimationFrame(flightLoop);
}

resetFlight();
requestAnimationFrame(flightLoop);
