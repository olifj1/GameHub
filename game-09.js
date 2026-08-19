const flightCanvas = $("#flight-canvas");
const flightCtx = flightCanvas.getContext("2d");
const flightUp = $("#flight-up");
const flightDown = $("#flight-down");
const flightEngineButton = $("#flight-engine");
const flightEngineLabel = $("#flight-engine-label");
const flightReset = $("#flight-reset");
const flightSpeed = $("#flight-speed");
const flightHoops = $("#flight-hoops");
const flightStars = $("#flight-stars");
const flightEngineState = $("#flight-engine-state");
const flightStatus = $("#flight-status");
const flightMessage = $("#flight-message");
const flightMessageTitle = $("#flight-message-title");
const flightMessageText = $("#flight-message-text");
const flightAgain = $("#flight-again");
const flightDifficultyButtons = $$(".flight-difficulty");

const FW = flightCanvas.width;
const FH = flightCanvas.height;
const FLIGHT_WORLD_W = 6900;
const GROUND_Y = 565;
const START_RUNWAY = {x:45,w:900};
const FINISH_RUNWAY = {x:5450,w:1250};

const flightInput = {up:false,down:false};
const flightWorld = {
  cameraX:0,

  // v1.0.63: lower travel speed but faster pitch response. This makes the
  // aeroplane feel calmer across the level while producing much tighter loops.
  pitchRate:0.046,
  maxSpeed:5.30,
  cruiseSpeed:4.35,
  acceleration:0.044,

  // Keep vertical climbs useful without turning the extra climb authority into
  // extra horizontal speed. Gravity still wins eventually in a true vertical
  // climb, so a stall can develop and the aircraft can fall back into a dive.
  poweredThrust:0.078,
  poweredGravity:0.082,
  poweredDrag:0.989,
  poweredSteer:0.100,

  glideGravity:0.042,
  glideDrag:0.9988,
  maxGlideSpeed:4.85,
  glideSteer:0.031,
  running:true
};

const FLIGHT_COURSES = {
  easy:{
    hoops:[
      {x:1850,y:300,r:50,angle:0},
      {x:4050,y:220,r:50,angle:0}
    ],
    stars:[
      {x:1050,y:350,r:22},
      {x:2850,y:150,r:22},
      {x:4950,y:330,r:22}
    ],
    ringTolerance:1.05
  },
  medium:{
    hoops:[
      {x:1250,y:320,r:49,angle:0},
      {x:2350,y:190,r:49,angle:-0.55},
      {x:3550,y:330,r:49,angle:0.50},
      {x:4850,y:205,r:49,angle:0}
    ],
    stars:[
      {x:900,y:365,r:22},
      {x:1850,y:120,r:22},
      {x:3000,y:260,r:22},
      {x:4200,y:120,r:22},
      {x:5250,y:335,r:22}
    ],
    ringTolerance:0.90
  },
  hard:{
    hoops:[
      {x:1050,y:330,r:48,angle:0},
      {x:1900,y:195,r:48,angle:-0.80},
      {x:2750,y:285,r:48,angle:-Math.PI/2},
      {x:3650,y:160,r:48,angle:0.72},
      {x:4450,y:315,r:48,angle:Math.PI/2},
      {x:5200,y:205,r:48,angle:-0.45}
    ],
    stars:[
      {x:820,y:380,r:22},
      {x:1500,y:125,r:22},
      {x:2350,y:360,r:22},
      {x:3250,y:105,r:22},
      {x:4100,y:385,r:22},
      {x:5000,y:115,r:22}
    ],
    ringTolerance:0.78
  }
};

let flightDifficulty=localStorage.getItem("flightDifficulty")||"easy";
if(!FLIGHT_COURSES[flightDifficulty]) flightDifficulty="easy";

let hoops=[];
let stars=[];
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
    finished:false,
    finishPending:false
  };
  const course=FLIGHT_COURSES[flightDifficulty];
  hoops=course.hoops.map(h=>({...h,hit:false}));
  stars=course.stars.map(s=>({...s,hit:false}));
  flightDifficultyButtons.forEach(button=>button.classList.toggle("active",button.dataset.flightDifficulty===flightDifficulty));
  flightWorld.cameraX=0;
  flightWorld.running=true;
  flightInput.up=flightInput.down=false;
  cumulativeTurn=0;
  lastAngle=0;
  flightMessage.classList.add("hidden");
  flightMessage.classList.remove("flight-message-success");
  flightStatus.textContent=`${flightDifficulty[0].toUpperCase()+flightDifficulty.slice(1)} — start the engine when you are ready.`;
  updateFlightHud();
}

function toggleEngine(){
  if(!flightWorld.running||plane.finishPending)return;
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
  flightStars.textContent=`${stars.filter(s=>s.hit).length} / ${stars.length}`;
}

function crashFlight(message){
  if(!flightWorld.running)return;
  flightWorld.running=false;
  plane.crashed=true;
  plane.engine=false;
  updateFlightHud();
  flightMessage.classList.remove("flight-message-success");
  flightMessageTitle.textContent="Crash!";
  flightMessageText.textContent=message;
  flightAgain.textContent="Try again";
  flightMessage.classList.remove("hidden");
}

function finishFlight(){
  if(!flightWorld.running)return;
  flightWorld.running=false;
  plane.finished=true;
  plane.finishPending=false;
  plane.engine=false;
  plane.speed=0;
  plane.vx=0;
  plane.vy=0;
  updateFlightHud();

  const starCount=stars.filter(s=>s.hit).length;
  flightMessageTitle.textContent=starCount===stars.length?"Perfect flight!":"Flight complete!";
  flightMessageText.textContent=`${starCount}/${stars.length} stars collected.`;
  flightAgain.textContent="Fly again";
  flightMessage.classList.add("flight-message-success");
  flightMessage.classList.add("hidden");
  window.setTimeout(()=>{
    if(plane.finished) flightMessage.classList.remove("hidden");
  },300);
}

function onRunway(x){
  if(x>=START_RUNWAY.x && x<=START_RUNWAY.x+START_RUNWAY.w) return "start";
  if(x>=FINISH_RUNWAY.x && x<=FINISH_RUNWAY.x+FINISH_RUNWAY.w) return "finish";
  return null;
}

function safeLanding(verticalSpeed){
  const angle=Math.abs(normalAngle(plane.angle));
  const movingForward=Math.cos(plane.angle)>.70;
  return angle<0.30 && verticalSpeed<1.75 && plane.speed<6.0 && movingForward;
}

function updateHoops(){
  const course=FLIGHT_COURSES[flightDifficulty];
  const travelAngle=Math.hypot(plane.vx,plane.vy)>.35?Math.atan2(plane.vy,plane.vx):plane.angle;

  for(const hoop of hoops){
    if(hoop.hit)continue;
    const dx=plane.x-hoop.x,dy=plane.y-hoop.y;
    const ca=Math.cos(hoop.angle),sa=Math.sin(hoop.angle);
    const along=dx*ca+dy*sa;
    const across=-dx*sa+dy*ca;
    const aligned=Math.abs(normalAngle(travelAngle-hoop.angle))<course.ringTolerance;

    // The opening is broad across the ring but narrow in its travel direction,
    // so angled and vertical rings genuinely ask for a different approach.
    if(Math.abs(along)<hoop.r*.62 && Math.abs(across)<hoop.r*.68 && aligned){
      hoop.hit=true;
      flightHoops.textContent=`${hoops.filter(h=>h.hit).length} / ${hoops.length}`;
      flightStatus.textContent=hoops.every(h=>h.hit)?"All rings — find the finish runway.":"Ring!";
    }
  }
}

function updateStars(){
  for(const star of stars){
    if(star.hit)continue;
    if(Math.hypot(plane.x-star.x,plane.y-star.y)<star.r+19){
      star.hit=true;
      const got=stars.filter(s=>s.hit).length;
      flightStars.textContent=`${got} / ${stars.length}`;
      flightStatus.textContent=got===stars.length?"All stars collected!":"Star collected!";
    }
  }
}

function updateFlight(){
  if(!flightWorld.running)return;

  const wasLanded=plane.landed;

  if(plane.landed){
    // A completed flight is not frozen at touchdown: let the biplane roll
    // naturally to a satisfying stop before showing the result.
    if(plane.finishPending){
      plane.engine=false;
      plane.angle=0;
      plane.speed*=.968;
      if(plane.speed<.055){
        plane.speed=0;
        plane.vx=0;
        plane.vy=0;
        finishFlight();
        return;
      }
      plane.vx=plane.speed;
      plane.vy=0;
      plane.x+=plane.speed;
      plane.y=GROUND_Y-23;
    }else{
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
      // Powered flight now has actual thrust and gravity. Horizontal flight is
      // a little stronger, steep climbs keep their energy longer, but a truly
      // vertical climb will eventually run out of momentum and fall back.
      let poweredSpeed=Math.hypot(plane.vx,plane.vy);
      if(poweredSpeed<.05){
        plane.vx=Math.cos(plane.angle)*Math.max(1.0,plane.speed);
        plane.vy=Math.sin(plane.angle)*Math.max(1.0,plane.speed);
        poweredSpeed=Math.hypot(plane.vx,plane.vy);
      }

      const velocityAngle=Math.atan2(plane.vy,plane.vx);
      const angleError=normalAngle(plane.angle-velocityAngle);
      const guidedAngle=velocityAngle+angleError*flightWorld.poweredSteer;
      plane.vx=Math.cos(guidedAngle)*poweredSpeed;
      plane.vy=Math.sin(guidedAngle)*poweredSpeed;

      plane.vx+=Math.cos(plane.angle)*flightWorld.poweredThrust;
      plane.vy+=Math.sin(plane.angle)*flightWorld.poweredThrust+flightWorld.poweredGravity;
      plane.vx*=flightWorld.poweredDrag;
      plane.vy*=flightWorld.poweredDrag;

      let actualSpeed=Math.hypot(plane.vx,plane.vy);
      if(actualSpeed>flightWorld.maxSpeed){
        const scale=flightWorld.maxSpeed/actualSpeed;
        plane.vx*=scale;
        plane.vy*=scale;
      }

      // Near a powered stall, gravity wins decisively instead of allowing the
      // aircraft to hover in place. Pointing the nose down then rebuilds speed.
      actualSpeed=Math.hypot(plane.vx,plane.vy);
      if(actualSpeed<1.25){
        plane.vy+=0.040;
        const nose=normalAngle(plane.angle);
        if(nose<.30) plane.angle+=.010;
      }
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

      // Diving should regain useful speed, but not create an uncontrollable
      // amount of energy. Aerodynamic drag gives the glide a friendly terminal
      // speed while preserving the momentum trade-off.
      let actualSpeed=Math.hypot(plane.vx,plane.vy);
      if(actualSpeed>flightWorld.maxGlideSpeed){
        const scale=flightWorld.maxGlideSpeed/actualSpeed;
        plane.vx*=scale;
        plane.vy*=scale;
        actualSpeed=flightWorld.maxGlideSpeed;
      }
      plane.vy=Math.min(plane.vy,3.65);

      // A small ground-effect cushion over either runway makes the final flare
      // readable without turning landing into an automatic action.
      const runwayBelow=onRunway(plane.x);
      const altitude=GROUND_Y-(plane.y+23);
      if(runwayBelow && altitude<72 && altitude>0 && plane.vy>0 &&
         Math.abs(normalAngle(plane.angle))<.38){
        plane.vy*=.982;
      }

      // At low airspeed the nose naturally wants to fall rather than hanging
      // in a powered-looking climb.
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
            plane.finishPending=true;
            plane.engine=false;
            flightStatus.textContent="Great landing — rolling to a stop.";
          }else{
            const left=hoops.filter(h=>!h.hit).length;
            flightStatus.textContent=`Safe landing — ${left} ring${left===1?"":"s"} still to fly through.`;
          }
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
  updateStars();

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
  flightCtx.rotate(hoop.angle);

  const main=hoop.hit?"rgba(85,139,128,.27)":"#568a83";
  const soft=hoop.hit?"rgba(85,139,128,.14)":"rgba(86,138,131,.28)";

  // Local X is the direction of travel; the ring plane sits across it. This
  // makes an upward-pointing ring visibly rotate into a horizontal oval.
  flightCtx.strokeStyle=main;
  flightCtx.lineWidth=8;
  flightCtx.beginPath();
  flightCtx.ellipse(0,0,hoop.r*.56,hoop.r,0,0,Math.PI*2);
  flightCtx.stroke();

  flightCtx.strokeStyle=soft;
  flightCtx.lineWidth=2;
  flightCtx.beginPath();
  flightCtx.ellipse(0,0,hoop.r*.56+9,hoop.r+9,0,0,Math.PI*2);
  flightCtx.stroke();

  // Direction cue through the middle of the opening.
  flightCtx.strokeStyle=main;
  flightCtx.lineWidth=3;
  flightCtx.lineCap="round";
  flightCtx.lineJoin="round";
  flightCtx.beginPath();
  flightCtx.moveTo(-12,0);
  flightCtx.lineTo(13,0);
  flightCtx.moveTo(6,-6);
  flightCtx.lineTo(13,0);
  flightCtx.lineTo(6,6);
  flightCtx.stroke();

  flightCtx.restore();

  flightCtx.save();
  flightCtx.translate(hoop.x,hoop.y-hoop.r-15);
  flightCtx.fillStyle=hoop.hit?"rgba(85,139,128,.38)":"#568a83";
  flightCtx.font="850 13px system-ui";
  flightCtx.textAlign="center";
  flightCtx.textBaseline="middle";
  flightCtx.fillText(hoop.hit?"✓":String(index+1),0,0);
  flightCtx.restore();
}

function drawStarCollectible(star){
  flightCtx.save();
  flightCtx.translate(star.x,star.y);
  if(star.hit) flightCtx.globalAlpha=.18;

  flightCtx.strokeStyle="#b88a55";
  flightCtx.fillStyle="#f2dfaa";
  flightCtx.lineWidth=3;
  flightCtx.beginPath();
  for(let i=0;i<10;i++){
    const a=-Math.PI/2+i*Math.PI/5;
    const r=i%2===0?star.r:star.r*.44;
    const x=Math.cos(a)*r,y=Math.sin(a)*r;
    if(i===0)flightCtx.moveTo(x,y); else flightCtx.lineTo(x,y);
  }
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  flightCtx.strokeStyle="rgba(184,138,85,.35)";
  flightCtx.lineWidth=2;
  flightCtx.beginPath();
  flightCtx.arc(0,0,star.r+8,0,Math.PI*2);
  flightCtx.stroke();
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

  const ink="#343b43";
  const body="#f7f2ec";
  const wing="#d9e3e0";
  const accent="#b87068";

  flightCtx.strokeStyle=ink;
  flightCtx.lineWidth=3;

  // Classic side-on biplane fuselage.
  flightCtx.fillStyle=body;
  flightCtx.beginPath();
  flightCtx.moveTo(-30,2);
  flightCtx.lineTo(-18,-6);
  flightCtx.lineTo(17,-7);
  flightCtx.quadraticCurveTo(29,-6,34,-1);
  flightCtx.quadraticCurveTo(29,7,16,8);
  flightCtx.lineTo(-18,8);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  // Tail fin and tailplane.
  flightCtx.fillStyle=accent;
  flightCtx.beginPath();
  flightCtx.moveTo(-24,-4);
  flightCtx.lineTo(-29,-18);
  flightCtx.lineTo(-18,-15);
  flightCtx.lineTo(-11,-4);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();
  flightCtx.beginPath();
  flightCtx.moveTo(-29,1);
  flightCtx.lineTo(-38,-3);
  flightCtx.lineTo(-37,5);
  flightCtx.lineTo(-22,6);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  // Two wings and their struts make the silhouette clearly biplane.
  flightCtx.fillStyle=wing;
  flightCtx.beginPath();
  flightCtx.roundRect(-13,-19,38,6,3);
  flightCtx.fill();
  flightCtx.stroke();
  flightCtx.beginPath();
  flightCtx.roundRect(-15,8,40,6,3);
  flightCtx.fill();
  flightCtx.stroke();

  flightCtx.strokeStyle=ink;
  flightCtx.lineWidth=2;
  flightCtx.beginPath();
  flightCtx.moveTo(-7,-13); flightCtx.lineTo(-5,8);
  flightCtx.moveTo(14,-13); flightCtx.lineTo(12,8);
  flightCtx.moveTo(-7,-13); flightCtx.lineTo(12,8);
  flightCtx.moveTo(14,-13); flightCtx.lineTo(-5,8);
  flightCtx.stroke();

  // Cockpit.
  flightCtx.fillStyle="#d6e1e4";
  flightCtx.strokeStyle=ink;
  flightCtx.lineWidth=2.5;
  flightCtx.beginPath();
  flightCtx.arc(9,-8,6,Math.PI,0);
  flightCtx.lineTo(15,-5);
  flightCtx.lineTo(3,-5);
  flightCtx.closePath();
  flightCtx.fill();
  flightCtx.stroke();

  // Nose and propeller.
  flightCtx.fillStyle=accent;
  flightCtx.beginPath();
  flightCtx.roundRect(27,-5,7,10,3);
  flightCtx.fill();
  flightCtx.stroke();

  flightCtx.strokeStyle=plane.engine&&flightWorld.running?"rgba(184,112,104,.62)":ink;
  flightCtx.lineWidth=plane.engine&&flightWorld.running?5:3;
  flightCtx.beginPath();
  flightCtx.moveTo(36,-15);
  flightCtx.lineTo(36,15);
  flightCtx.stroke();
  flightCtx.fillStyle=ink;
  flightCtx.beginPath();
  flightCtx.arc(36,0,3.2,0,Math.PI*2);
  flightCtx.fill();

  // Undercarriage.
  flightCtx.strokeStyle=ink;
  flightCtx.lineWidth=2;
  flightCtx.beginPath();
  flightCtx.moveTo(-3,10); flightCtx.lineTo(-6,17);
  flightCtx.moveTo(17,10); flightCtx.lineTo(20,17);
  flightCtx.stroke();
  flightCtx.fillStyle=ink;
  flightCtx.beginPath();
  flightCtx.arc(-6,18,4,0,Math.PI*2);
  flightCtx.arc(20,18,4,0,Math.PI*2);
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
  stars.forEach(drawStarCollectible);
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

flightDifficultyButtons.forEach(button=>{
  bindFastPress(button,()=>{
    flightDifficulty=button.dataset.flightDifficulty;
    localStorage.setItem("flightDifficulty",flightDifficulty);
    resetFlight();
  });
});

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
