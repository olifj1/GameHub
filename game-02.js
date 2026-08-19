// Clock
// ----------------------------
const hourSlider = $("#hour-slider");
const minuteSlider = $("#minute-slider");
const hourReadout = $("#hour-readout");
const minuteReadout = $("#minute-readout");
const hourHand = $("#hour-hand");
const minuteHand = $("#minute-hand");
const digitalTime = $("#digital-time");
const dayLabel = $("#day-label");
const clockScreen = $("#clock-screen");
const clockTicks = $("#clock-ticks");
const cycleSun = $("#cycle-sun");
const cycleTimeLabel = $("#cycle-time-label");
const cycleZoneGroups = $$("[data-cycle-zone]");
const clockModeButtons = $$("[data-clock-mode]");
const clockTestRow = $("#clock-test-row");
const clockTestCard = $("#clock-test-card");
const clockTestTarget = $("#clock-test-target");
const clockTestFeedback = $("#clock-test-feedback");
const clockTestAction = $("#clock-test-action");
const clockPage = $("#clock-page");

for (let i = 0; i < 60; i++) {
  const angle = i * 6 * Math.PI / 180;
  const major = i % 5 === 0;
  const outer = 116;
  const inner = major ? 104 : 110;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", 150 + Math.sin(angle) * inner);
  line.setAttribute("y1", 150 - Math.cos(angle) * inner);
  line.setAttribute("x2", 150 + Math.sin(angle) * outer);
  line.setAttribute("y2", 150 - Math.cos(angle) * outer);
  line.setAttribute("class", major ? "tick major" : "tick");
  clockTicks.appendChild(line);
}

const clockNumbers = $("#clock-numbers");
for (let n = 1; n <= 12; n++) {
  const angle = n * 30 * Math.PI / 180;
  const radius = 91;
  const x = 150 + Math.sin(angle) * radius;
  const y = 150 - Math.cos(angle) * radius;
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", x);
  text.setAttribute("y", y);
  // Safari's SVG dominant-baseline sits these numerals slightly high.
  // A dy based on the font em gives consistent optical vertical centring.
  text.setAttribute("dy", "0.43em");
  text.textContent = n;
  clockNumbers.appendChild(text);
}

let hour = Number(localStorage.getItem("clockHour") || 12);
let minute = Number(localStorage.getItem("clockMinute") || 0);
hourSlider.value = hour;
minuteSlider.value = minute;

let clockMode = localStorage.getItem("clockMode") || "explore";
if(!["explore","test"].includes(clockMode)) clockMode="explore";

let clockTestHour = 7;
let clockTestMinute = 30;
let clockTestSolved = false;

function labelForTime(decimalHour) {
  if (decimalHour < 5) return "Night";
  if (decimalHour < 7) return "Sunrise";
  if (decimalHour < 11.5) return "Morning";
  if (decimalHour < 13.5) return "Midday";
  if (decimalHour < 17.5) return "Afternoon";
  if (decimalHour < 20) return "Sunset";
  if (decimalHour < 22) return "Evening";
  return "Night";
}

function cycleZoneForTime(decimalHour) {
  if (decimalHour < 5) return "night";
  if (decimalHour < 12) return "morning";
  if (decimalHour < 17) return "afternoon";
  if (decimalHour < 22) return "evening";
  return "night";
}


function formatClockTime(h,m){
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function clockQuestionPeriod(h){
  if(h < 5) return "at night";
  if(h < 12) return "in the morning";
  if(h < 17) return "in the afternoon";
  if(h < 22) return "in the evening";
  return "at night";
}

function formatClockQuestion(h,m){
  const displayHour=(h%12)||12;
  return `${displayHour}:${String(m).padStart(2,"0")} ${clockQuestionPeriod(h)}`;
}

function newClockTest(){
  const previous=`${clockTestHour}:${clockTestMinute}`;
  let nextHour,nextMinute,nextKey;

  // Generate a genuine time across the whole 24-hour day. The wording tells
  // the child which matching analogue-clock position belongs to this question.
  // Keep five-minute increments, and avoid 12:00 because every question starts there.
  do{
    nextHour=Math.floor(Math.random()*24);
    nextMinute=Math.floor(Math.random()*12)*5;
    nextKey=`${nextHour}:${nextMinute}`;
  }while(nextKey===previous || (nextHour===12 && nextMinute===0));

  clockTestHour=nextHour;
  clockTestMinute=nextMinute;
  clockTestSolved=false;
  clockTestTarget.textContent=formatClockQuestion(clockTestHour,clockTestMinute);
  clockTestFeedback.textContent="Move the hands, then check your answer.";
  clockTestFeedback.classList.remove("good","bad");
  clockTestAction.textContent="Check";

  // Give every question the same clear starting point: midday 12:00.
  hour=12;
  minute=0;
  hourSlider.value=12;
  minuteSlider.value=0;
  renderClock();
}

function setClockMode(mode){
  clockMode=mode;
  localStorage.setItem("clockMode",clockMode);
  const testing=clockMode==="test";

  clockModeButtons.forEach(button=>{
    button.classList.toggle("active",button.dataset.clockMode===clockMode);
  });

  clockPage.classList.toggle("clock-test-mode",testing);
  clockTestRow.classList.toggle("hidden",!testing);

  if(testing){
    newClockTest();
  }else{
    clockTestSolved=false;
    clockTestFeedback.classList.remove("good","bad");
    renderClock();
  }
}

function checkClockTest(){
  if(clockTestSolved){
    newClockTest();
    return;
  }

  // Test the actual point in the 24-hour day, not just the matching
  // analogue hand position. For example, 08:35 and 20:35 are different answers.
  const selectedHour=(hour===24?0:hour);
  const selectedMinute=minute===60?0:minute;
  const correctedHour=minute===60?(selectedHour+1)%24:selectedHour;
  const correct=correctedHour===clockTestHour && selectedMinute===clockTestMinute;

  clockTestFeedback.classList.remove("good","bad");
  if(correct){
    clockTestSolved=true;
    clockTestFeedback.textContent="Correct — well done!";
    clockTestFeedback.classList.add("good");
    clockTestAction.textContent="New time";
  }else{
    clockTestFeedback.textContent="Not quite — adjust the hands and try again.";
    clockTestFeedback.classList.add("bad");
  }
}

function renderClock() {
  const baseHour = hour === 24 ? 0 : hour;
  const minuteForHands = minute === 60 ? 0 : minute;
  const carriedHour = minute === 60 ? (baseHour + 1) % 24 : baseHour;
  const decimalHour = carriedHour + minuteForHands / 60;

  hourHand.style.transform = `rotate(${(decimalHour % 12) * 30}deg)`;
  minuteHand.style.transform = `rotate(${minute === 60 ? 360 : minute * 6}deg)`;

  const hh = String(carriedHour).padStart(2, "0");
  const mm = String(minute === 60 ? 0 : minute).padStart(2, "0");
  digitalTime.textContent = `${hh}:${mm}`;
  hourReadout.textContent = String(hour === 24 ? 0 : hour).padStart(2, "0");
  minuteReadout.textContent = String(minute).padStart(2, "0");
  dayLabel.textContent = labelForTime(decimalHour);

  // 24-hour sun orbit:
  // 06:00 = left horizon, 12:00 = top, 18:00 = right horizon, 00:00 = below.
  const orbitAngle = Math.PI - ((decimalHour - 6) / 12) * Math.PI;
  const sunX = 210 + Math.cos(orbitAngle) * 165;
  const sunY = 76 - Math.sin(orbitAngle) * 56;
  cycleSun.setAttribute("transform", `translate(${sunX.toFixed(2)} ${sunY.toFixed(2)})`);
  cycleSun.classList.toggle("below-horizon", decimalHour < 6 || decimalHour >= 18);

  cycleTimeLabel.textContent = `${hh}:${mm}`;

  const activeZone = cycleZoneForTime(decimalHour);
  cycleZoneGroups.forEach(group => {
    group.classList.toggle("active", group.dataset.cycleZone === activeZone);
  });

  if(clockMode==="explore"){
    localStorage.setItem("clockHour", hour === 24 ? 0 : hour);
    localStorage.setItem("clockMinute", minute);
  }
}

hourSlider.addEventListener("input", () => {
  hour = Number(hourSlider.value);
  if(clockMode==="test" && !clockTestSolved){
    clockTestFeedback.textContent="Move the hands, then check your answer.";
    clockTestFeedback.classList.remove("good","bad");
  }
  renderClock();
});

minuteSlider.addEventListener("input", () => {
  minute = Number(minuteSlider.value);
  if(clockMode==="test" && !clockTestSolved){
    clockTestFeedback.textContent="Move the hands, then check your answer.";
    clockTestFeedback.classList.remove("good","bad");
  }
  renderClock();
});

clockModeButtons.forEach(button=>{
  bindFastPress(button,()=>setClockMode(button.dataset.clockMode));
});
bindFastPress(clockTestAction,checkClockTest);

renderClock();
setClockMode(clockMode);
