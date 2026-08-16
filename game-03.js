// ----------------------------
const modeButtons = $$("[data-sum-mode]");
const difficultyButtons = $$("[data-difficulty]");
const durationButtons = $$("[data-duration]");
const difficultyNote = $("#difficulty-note");
const testOptions = $("#test-options");
const startTestButton = $("#start-test");
const sumSetup = $("#sum-setup");
const sumPlay = $("#sum-play");
const testTopline = $("#test-topline");
const timerValue = $("#timer-value");
const liveScore = $("#live-score");
const sumQuestion = $("#sum-question");
const answerDisplay = $("#answer-display");
const sumFeedback = $("#sum-feedback");
const digitButtons = $$("[data-digit]");
const answerClear = $("#answer-clear");
const answerCheck = $("#answer-check");
const newSumButton = $("#new-sum");
const passSumButton = $("#pass-sum");
const bestScoreLabel = $("#best-score");
const testResults = $("#test-results");
const resultScore = $("#result-score");
const resultCorrect = $("#result-correct");
const resultPassed = $("#result-passed");
const resultBest = $("#result-best");
const resultMessage = $("#result-message");
const tryAgain = $("#try-again");
const leaveTest = $("#leave-test");

const difficultyInfo = {
  easy: {
    note: "Mostly + and − to 10, with a little 2, 5 and 10 times-table practice.",
    points: 1
  },
  medium: {
    note: "+ and − to 20, with simple multiplication mixed in.",
    points: 2
  },
  hard: {
    note: "Bigger + and − problems, plus times tables up to 10 × 12.",
    points: 3
  }
};

let sumMode = localStorage.getItem("sumMode") || "practice";
let difficulty = localStorage.getItem("sumDifficulty") || "easy";
let testDuration = Number(localStorage.getItem("sumDuration") || 60);
let currentProblem = null;
let answerText = "";
let feedbackLocked = false;

let testRunning = false;
let testEndAt = 0;
let testTimer = null;
let testScore = 0;
let testCorrect = 0;
let testPassed = 0;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeAddition(maxAnswer) {
  const minPart = maxAnswer <= 10 ? 1 : 2;
  const answer = randomInt(minPart * 2, maxAnswer);
  const a = randomInt(minPart, answer - minPart);
  const b = answer - a;
  return { a, b, op: "+", answer };
}

function makeSubtraction(maxStart) {
  const minPart = maxStart <= 10 ? 1 : 2;
  const a = randomInt(Math.max(minPart + 1, 3), maxStart);
  const b = randomInt(minPart, a - minPart);
  return { a, b, op: "−", answer: a - b };
}

function makeMultiplication(maxTable, maxMultiplier) {
  const a = randomInt(2, maxTable);
  const b = randomInt(2, maxMultiplier);
  return { a, b, op: "×", answer: a * b };
}

function generateProblem() {
  let problem;
  const roll = Math.random();

  if (difficulty === "easy") {
    if (roll < 0.16) {
      const tables = [2, 5, 10];
      const a = tables[randomInt(0, tables.length - 1)];
      const b = randomInt(2, 5);
      problem = { a, b, op: "×", answer: a * b };
    } else if (roll < 0.58) {
      problem = makeAddition(10);
    } else {
      problem = makeSubtraction(10);
    }
  } else if (difficulty === "medium") {
    if (roll < 0.28) problem = makeMultiplication(5, 10);
    else if (roll < 0.64) problem = makeAddition(20);
    else problem = makeSubtraction(20);
  } else {
    if (roll < 0.38) problem = makeMultiplication(10, 12);
    else if (roll < 0.69) problem = makeAddition(50);
    else problem = makeSubtraction(50);
  }

  if (
    currentProblem &&
    problem.a === currentProblem.a &&
    problem.b === currentProblem.b &&
    problem.op === currentProblem.op
  ) {
    return generateProblem();
  }

  currentProblem = problem;
  answerText = "";
  feedbackLocked = false;
  answerDisplay.classList.remove("correct", "wrong");
  sumFeedback.classList.remove("good", "bad");
  sumQuestion.textContent = `${problem.a} ${problem.op} ${problem.b} = ?`;
  sumFeedback.textContent = testRunning ? "Solve it or tap Pass" : "Tap the numbers below";
  renderAnswer();
}

function renderAnswer() {
  answerDisplay.textContent = answerText || "?";
}

function setDifficulty(value) {
  difficulty = value;
  localStorage.setItem("sumDifficulty", difficulty);

  difficultyButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.difficulty === difficulty);
  });

  difficultyNote.textContent = difficultyInfo[difficulty].note;
  updateBestScore();
  generateProblem();
}

function setDuration(seconds) {
  testDuration = Number(seconds);
  localStorage.setItem("sumDuration", testDuration);

  durationButtons.forEach(button => {
    button.classList.toggle("active", Number(button.dataset.duration) === testDuration);
  });

  updateBestScore();
}

function setSumMode(mode) {
  if (testRunning) endTest(false);

  sumMode = mode;
  localStorage.setItem("sumMode", sumMode);

  modeButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.sumMode === sumMode);
  });

  const isTest = sumMode === "test";
  testOptions.classList.toggle("hidden", !isTest);
  testTopline.classList.add("hidden");
  passSumButton.classList.add("hidden");
  newSumButton.classList.toggle("hidden", isTest);
  testResults.classList.add("hidden");
  sumPlay.classList.toggle("hidden", isTest);
  sumSetup.classList.remove("hidden");

  if (!isTest) generateProblem();
  updateBestScore();
}

function bestKey() {
  return `sumBest:${difficulty}:${testDuration}`;
}

function getBestScore() {
  return Number(localStorage.getItem(bestKey()) || 0);
}

function updateBestScore() {
  const best = getBestScore();
  bestScoreLabel.textContent = best ? `Best: ${best} points` : "Best: —";
}

function appendDigit(digit) {
  if (feedbackLocked || (!testRunning && sumMode === "test")) return;
  if (answerText.length >= 3) return;
  if (answerText === "0") answerText = "";
  answerText += digit;
  renderAnswer();
}

function backspaceAnswer() {
  if (feedbackLocked) return;
  answerText = answerText.slice(0, -1);
  renderAnswer();
}

function checkAnswer() {
  if (feedbackLocked || answerText === "" || !currentProblem) return;

  const value = Number(answerText);

  if (value === currentProblem.answer) {
    answerDisplay.classList.remove("wrong");
    answerDisplay.classList.add("correct");
    sumFeedback.classList.remove("bad");
    sumFeedback.classList.add("good");
    sumFeedback.textContent = testRunning ? "Correct! ★" : "You got it! ★";

    if (testRunning) {
      testCorrect += 1;
      testScore += difficultyInfo[difficulty].points;
      liveScore.textContent = testScore;
      feedbackLocked = true;
      setTimeout(() => {
        if (testRunning) generateProblem();
      }, 320);
    } else {
      feedbackLocked = true;
    }
  } else {
    answerDisplay.classList.remove("correct");
    answerDisplay.classList.add("wrong");
    sumFeedback.classList.remove("good");
    sumFeedback.classList.add("bad");
    sumFeedback.textContent = "Not quite — have another go";
    answerText = "";
    setTimeout(() => {
      answerDisplay.classList.remove("wrong");
      renderAnswer();
    }, 320);
  }
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutesPart = Math.floor(safe / 60);
  const secondsPart = String(safe % 60).padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

function updateTimer() {
  if (!testRunning) return;
  const remaining = (testEndAt - Date.now()) / 1000;
  timerValue.textContent = formatTime(remaining);

  if (remaining <= 0) endTest(true);
}

function startTest() {
  clearInterval(testTimer);

  testRunning = true;
  testScore = 0;
  testCorrect = 0;
  testPassed = 0;
  testEndAt = Date.now() + testDuration * 1000;

  sumSetup.classList.add("hidden");
  testResults.classList.add("hidden");
  sumPlay.classList.remove("hidden");
  testTopline.classList.remove("hidden");
  passSumButton.classList.remove("hidden");
  newSumButton.classList.add("hidden");

  liveScore.textContent = "0";
  timerValue.textContent = formatTime(testDuration);
  generateProblem();

  testTimer = setInterval(updateTimer, 150);
}

function passProblem() {
  if (!testRunning) return;
  testPassed += 1;
  generateProblem();
}

function endTest(showResults = true) {
  if (!testRunning && !showResults) return;

  clearInterval(testTimer);
  testTimer = null;
  const wasRunning = testRunning;
  testRunning = false;

  if (!showResults) {
    sumSetup.classList.remove("hidden");
    testTopline.classList.add("hidden");
    passSumButton.classList.add("hidden");
    return;
  }

  if (!wasRunning) return;

  const oldBest = getBestScore();
  const newBest = Math.max(oldBest, testScore);
  localStorage.setItem(bestKey(), newBest);

  resultScore.textContent = testScore;
  resultCorrect.textContent = testCorrect;
  resultPassed.textContent = testPassed;
  resultBest.textContent = newBest;

  if (testScore > oldBest && testScore > 0) {
    resultMessage.textContent = "New best score! ★";
  } else if (testCorrect >= 10) {
    resultMessage.textContent = "Brilliant work!";
  } else if (testCorrect >= 5) {
    resultMessage.textContent = "Great work!";
  } else {
    resultMessage.textContent = "Good try — have another go!";
  }

  sumPlay.classList.add("hidden");
  sumSetup.classList.add("hidden");
  testResults.classList.remove("hidden");
  updateBestScore();
}

modeButtons.forEach(button => {
  button.addEventListener("click", () => setSumMode(button.dataset.sumMode));
});

difficultyButtons.forEach(button => {
  button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
});

durationButtons.forEach(button => {
  button.addEventListener("click", () => setDuration(button.dataset.duration));
});

digitButtons.forEach(button => {
  button.addEventListener("click", () => appendDigit(button.dataset.digit));
});

answerClear.addEventListener("click", backspaceAnswer);
answerCheck.addEventListener("click", checkAnswer);
newSumButton.addEventListener("click", generateProblem);
passSumButton.addEventListener("click", passProblem);
startTestButton.addEventListener("click", startTest);
tryAgain.addEventListener("click", startTest);

leaveTest.addEventListener("click", () => {
  setSumMode("practice");
});

setDifficulty(difficulty);
setDuration(testDuration);
setSumMode(sumMode);
