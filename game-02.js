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
  const radius = 98;
  const x = 150 + Math.sin(angle) * radius;
  const y = 150 - Math.cos(angle) * radius;
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", x);
  text.setAttribute("y", y + 1);
  text.textContent = n;
  clockNumbers.appendChild(text);
}

let hour = Number(localStorage.getItem("clockHour") || 12);
let minute = Number(localStorage.getItem("clockMinute") || 0);
hourSlider.value = hour;
minuteSlider.value = minute;

const skyStops = [
  { t: 0.00, c: [5, 8, 14] },
  { t: 0.18, c: [28, 44, 78] },
  { t: 0.24, c: [232, 148, 124] },
  { t: 0.30, c: [247, 199, 118] },
  { t: 0.50, c: [248, 219, 145] },
  { t: 0.70, c: [243, 190, 108] },
  { t: 0.79, c: [224, 120, 102] },
  { t: 0.86, c: [42, 51, 86] },
  { t: 1.00, c: [5, 8, 14] }
];

const lerp = (a, b, t) => a + (b - a) * t;

function skyColor(normalizedDay) {
  for (let i = 0; i < skyStops.length - 1; i++) {
    const a = skyStops[i];
    const b = skyStops[i + 1];
    if (normalizedDay >= a.t && normalizedDay <= b.t) {
      const localT = (normalizedDay - a.t) / (b.t - a.t);
      const rgb = a.c.map((value, j) => Math.round(lerp(value, b.c[j], localT)));
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  }
  return "rgb(5, 8, 14)";
}

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

function renderClock() {
  const minuteForHands = minute === 60 ? 0 : minute;
  const carriedHour = minute === 60 ? (hour + 1) % 24 : hour;
  const decimalHour = carriedHour + minuteForHands / 60;

  hourHand.style.transform = `rotate(${(decimalHour % 12) * 30}deg)`;
  minuteHand.style.transform = `rotate(${minute === 60 ? 360 : minute * 6}deg)`;

  const hh = String(carriedHour).padStart(2, "0");
  const mm = String(minute === 60 ? 0 : minute).padStart(2, "0");
  digitalTime.textContent = `${hh}:${mm}`;
  hourReadout.textContent = String(hour).padStart(2, "0");
  minuteReadout.textContent = String(minute).padStart(2, "0");
  dayLabel.textContent = labelForTime(decimalHour);
  clockScreen.style.backgroundColor = skyColor(decimalHour / 24);

  const page = $("#clock-page");
  const dark = decimalHour < 6 || decimalHour >= 20.5;
  page.style.color = dark ? "#f8fafc" : "#27313c";
  page.querySelector(".subhead").style.color = dark
    ? "rgba(248,250,252,.72)"
    : "rgba(39,49,60,.68)";

  localStorage.setItem("clockHour", hour);
  localStorage.setItem("clockMinute", minute);
}

hourSlider.addEventListener("input", () => {
  hour = Number(hourSlider.value);
  renderClock();
});

minuteSlider.addEventListener("input", () => {
  minute = Number(minuteSlider.value);
  renderClock();
});

renderClock();
