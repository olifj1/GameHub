// Numbers / multiplication
// ----------------------------
const numberDown = $("#number-down");
const numberUp = $("#number-up");
const chosenNumberEl = $("#chosen-number");
const tapNumber = $("#tap-number");
const totalValue = $("#total-value");
const equation = $("#equation");
const multiplyEquation = $("#multiply-equation");
const tapDots = $("#tap-dots");
const tapCount = $("#tap-count");
const numbersReset = $("#numbers-reset");

let chosenNumber = Number(localStorage.getItem("chosenNumber") || 4);
let taps = Number(localStorage.getItem("numberTaps") || 0);

function renderNumbers() {
  chosenNumber = clamp(chosenNumber, 1, 12);
  const total = chosenNumber * taps;

  chosenNumberEl.textContent = chosenNumber;
  totalValue.textContent = total;
  tapCount.textContent = `${taps} ${taps === 1 ? "tap" : "taps"}`;

  if (taps === 0) {
    equation.textContent = "Tap the button to begin";
    multiplyEquation.textContent = "";
  } else if (taps <= 8) {
    equation.textContent = `${Array(taps).fill(chosenNumber).join(" + ")} = ${total}`;
    multiplyEquation.textContent = `${taps} × ${chosenNumber} = ${total}`;
  } else {
    equation.textContent = `${chosenNumber} added ${taps} times = ${total}`;
    multiplyEquation.textContent = `${taps} × ${chosenNumber} = ${total}`;
  }

  tapDots.innerHTML = "";
  for (let i = 0; i < Math.min(taps, 24); i++) {
    const dot = document.createElement("span");
    dot.className = "tap-dot";
    tapDots.appendChild(dot);
  }

  if (taps > 24) {
    const more = document.createElement("span");
    more.textContent = `+${taps - 24}`;
    more.style.cssText = "font-size:12px;font-weight:800;opacity:.55;align-self:center";
    tapDots.appendChild(more);
  }

  localStorage.setItem("chosenNumber", chosenNumber);
  localStorage.setItem("numberTaps", taps);
}

function changeChosenNumber(delta) {
  chosenNumber = clamp(chosenNumber + delta, 1, 12);
  taps = 0;
  renderNumbers();
}

numberDown.addEventListener("click", () => changeChosenNumber(-1));
numberUp.addEventListener("click", () => changeChosenNumber(1));
tapNumber.addEventListener("click", () => {
  taps += 1;
  renderNumbers();
});
numbersReset.addEventListener("click", () => {
  taps = 0;
  renderNumbers();
});

renderNumbers();
