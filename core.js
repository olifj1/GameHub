// Shared helpers and application shell utilities.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Prevent pinch/gesture zoom without swallowing legitimate rapid taps.
// The previous global touchend timer blocked the second quick tap on iOS.
// CSS touch-action handles double-tap zoom, so input events can pass through.
document.addEventListener("gesturestart", event => event.preventDefault(), { passive: false });

function bindFastPress(element, handler) {
  if (!element) return;
  let lastPointerPress = -Infinity;

  element.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    lastPointerPress = performance.now();
    event.preventDefault();
    if (!element.disabled) handler(event);
  });

  // Keyboard activation / click fallback. Ignore only the synthetic click
  // belonging to a pointer press already handled above.
  element.addEventListener("click", event => {
    if (performance.now() - lastPointerPress < 700) {
      event.preventDefault();
      return;
    }
    if (!element.disabled) handler(event);
  });
}
window.bindFastPress = bindFastPress;



// Shared per-game progress + completion result UI.
// GameHub intentionally does not calculate a global score or overall level:
// each mini-game owns its results, while this API keeps the presentation and
// storage format consistent.
(function installGameHubResults() {
  const STORAGE_KEY = "gameHubProgress";
  const difficultyOrder = ["easy", "medium", "hard"];

  function readAll() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeAll(all) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
    catch (_) {}
  }

  function normaliseDifficulty(game, difficulty) {
    const modern = game?.difficulties?.[difficulty];
    if (modern) {
      return {
        bestStars: Number(modern.bestStars ?? modern.stars ?? 0) || 0,
        bestScore: Number(modern.bestScore ?? 0) || 0,
        completions: Number(modern.completions ?? 0) || 0,
        lastScore: Number(modern.lastScore ?? 0) || 0,
        updatedAt: modern.updatedAt || null,
        metrics: modern.metrics || null
      };
    }

    // Compatibility with the first Laser Lab result format, which stored
    // difficulty records directly under the game id.
    const legacy = game?.[difficulty];
    if (legacy && typeof legacy === "object") {
      return {
        bestStars: Number(legacy.bestStars ?? legacy.stars ?? 0) || 0,
        bestScore: Number(legacy.bestScore ?? 0) || 0,
        completions: Number(legacy.completions ?? 0) || 0,
        lastScore: Number(legacy.lastScore ?? 0) || 0,
        updatedAt: legacy.updatedAt || null,
        metrics: legacy.metrics || null
      };
    }

    return { bestStars: 0, bestScore: 0, completions: 0, lastScore: 0, updatedAt: null, metrics: null };
  }

  function getGame(gameId) {
    const game = readAll()[gameId] || {};
    const difficulties = {};
    difficultyOrder.forEach(difficulty => {
      difficulties[difficulty] = normaliseDifficulty(game, difficulty);
    });
    return {
      bestStars: Number(game.bestStars ?? 0) || Math.max(...difficultyOrder.map(d => difficulties[d].bestStars)),
      bestScore: Number(game.bestScore ?? 0) || Math.max(...difficultyOrder.map(d => difficulties[d].bestScore)),
      difficulties
    };
  }

  function recordResult({ gameId, difficulty = "easy", stars = 1, score = null, metrics = null }) {
    const all = readAll();
    const game = all[gameId] && typeof all[gameId] === "object" ? all[gameId] : {};
    if (!game.difficulties || typeof game.difficulties !== "object") game.difficulties = {};

    const previous = normaliseDifficulty(game, difficulty);
    const safeStars = Math.max(1, Math.min(5, Math.round(Number(stars) || 1)));
    const hasScore = score !== null && score !== undefined && score !== "" && Number.isFinite(Number(score));
    const safeScore = hasScore ? Math.max(0, Math.round(Number(score))) : null;
    const now = new Date().toISOString();

    const newBestStars = safeStars > previous.bestStars;
    const newBestScore = hasScore && safeScore > previous.bestScore;

    const existingDifficulty = game.difficulties[difficulty] && typeof game.difficulties[difficulty] === "object"
      ? game.difficulties[difficulty]
      : {};
    game.difficulties[difficulty] = {
      ...existingDifficulty,
      bestStars: Math.max(previous.bestStars, safeStars),
      bestScore: hasScore ? Math.max(previous.bestScore, safeScore) : previous.bestScore,
      completions: previous.completions + 1,
      lastStars: safeStars,
      lastScore: hasScore ? safeScore : previous.lastScore,
      updatedAt: now,
      metrics: metrics || previous.metrics || null
    };
    game.bestStars = Math.max(Number(game.bestStars) || 0, safeStars);
    if (hasScore) game.bestScore = Math.max(Number(game.bestScore) || 0, safeScore);
    game.lastDifficulty = difficulty;
    game.updatedAt = now;
    all[gameId] = game;
    writeAll(all);

    return {
      newBestStars,
      newBestScore,
      newBest: newBestStars || newBestScore,
      record: normaliseDifficulty(game, difficulty)
    };
  }

  function starMarkup(stars) {
    const count = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
    return Array.from({ length: 5 }, (_, i) => `<span class="${i < count ? "filled" : ""}">★</span>`).join("");
  }

  let overlay = null;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "gh-result-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="gh-result-card" role="dialog" aria-modal="true" aria-labelledby="gh-result-title">
        <div class="gh-result-topline">
          <p class="gh-result-kicker" id="gh-result-kicker">RESULT</p>
          <span class="gh-result-best" id="gh-result-best" hidden>NEW BEST</span>
        </div>
        <h2 id="gh-result-title">Complete!</h2>
        <div class="gh-result-stars" id="gh-result-stars" aria-label="Result rating"></div>
        <p class="gh-result-summary" id="gh-result-summary"></p>
        <div class="gh-result-stats" id="gh-result-stats"></div>
        <div class="gh-result-actions">
          <button class="gh-result-primary" id="gh-result-again" type="button">Play again</button>
          <a class="gh-result-secondary" href="progress.html">Progress</a>
          <a class="gh-result-secondary" href="index.html">Games</a>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeResult() {
    if (!overlay) return;
    overlay.classList.remove("open");
    window.setTimeout(() => { if (overlay) overlay.hidden = true; }, 140);
  }

  function showResult(options) {
    const {
      gameId,
      difficulty = "easy",
      stars = 1,
      score = null,
      title = "Complete!",
      summary = "",
      metrics = [],
      againLabel = "Play again",
      onAgain = null,
      save = true
    } = options || {};

    const game = getGameConfig(gameId);
    const saveState = save ? recordResult({ gameId, difficulty, stars, score, metrics }) : { newBest: false };
    const el = ensureOverlay();
    const niceDifficulty = difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : "";
    const scoreNumber = Number(score);
    const hasScore = score !== null && score !== undefined && score !== "" && Number.isFinite(scoreNumber);

    el.querySelector("#gh-result-kicker").textContent = [game?.displayName || "Result", niceDifficulty].filter(Boolean).join(" · ").toUpperCase();
    el.querySelector("#gh-result-title").textContent = title;
    const starEl = el.querySelector("#gh-result-stars");
    starEl.innerHTML = starMarkup(stars);
    starEl.setAttribute("aria-label", `${Math.max(1, Math.min(5, Math.round(Number(stars) || 1)))} out of 5 stars`);
    el.querySelector("#gh-result-summary").textContent = summary;

    const best = el.querySelector("#gh-result-best");
    best.hidden = !saveState.newBest;

    const statItems = [];
    if (hasScore) statItems.push({ label: "Score", value: Math.round(scoreNumber).toLocaleString() });
    (Array.isArray(metrics) ? metrics : []).slice(0, 3).forEach(metric => {
      if (metric && metric.label != null && metric.value != null) statItems.push(metric);
    });
    const stats = el.querySelector("#gh-result-stats");
    stats.innerHTML = statItems.map(item => `<div><span>${String(item.label)}</span><strong>${String(item.value)}</strong></div>`).join("");
    stats.hidden = statItems.length === 0;

    const again = el.querySelector("#gh-result-again");
    again.textContent = againLabel;
    again.onclick = () => {
      closeResult();
      if (typeof onAgain === "function") onAgain();
    };

    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("open"));
    return saveState;
  }

  window.GameHubProgress = { readAll, getGame, recordResult, difficulties: difficultyOrder.slice() };
  window.GameHubResults = { show: showResult, close: closeResult };
})();

function getGameConfig(id) {
  return window.APP_CONFIG?.games?.find(game => game.id === id);
}

function applyConfiguredNames() {
  const site = window.APP_CONFIG?.site;
  const gameId = document.body.dataset.gameId;
  if (site) document.querySelectorAll("[data-site-name]").forEach(el => el.textContent = site.displayName);
  if (gameId) {
    const game = getGameConfig(gameId);
    if (game) {
      const heading = document.querySelector(".page-header h1");
      if (heading) heading.textContent = game.displayName;
      document.title = `${game.displayName} · ${site?.displayName || "Games"}`;
    }
  }
}

applyConfiguredNames();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Keep the worker inside the GitHub Pages project directory.
      // Using ../sw.js here escapes /GameHub/ and breaks registration.
      const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      await registration.update();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update();
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!sessionStorage.getItem("gameCollectionReloadedForUpdate")) {
          sessionStorage.setItem("gameCollectionReloadedForUpdate", "1");
          window.location.reload();
        }
      });
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}


// Shared instructions dialog for every game.
document.querySelectorAll(".game-info-button").forEach(button => {
  button.addEventListener("click", () => {
    const overlay = document.querySelector(".game-info-overlay");
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    overlay.querySelector(".game-info-close")?.focus();
  });
});
document.querySelectorAll(".game-info-overlay").forEach(overlay => {
  const close = () => {
    overlay.classList.remove("open");
    setTimeout(() => { overlay.hidden = true; }, 150);
  };
  overlay.querySelector(".game-info-close")?.addEventListener("click", close);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
});


// Portrait-only game presentation.
// In landscape we keep the page loaded, but cover it with a simple rotate-device message.
(function installOrientationGuard() {
  const overlay = document.createElement("div");
  overlay.className = "orientation-guard";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="orientation-guard-card">
      <div class="orientation-phone" aria-hidden="true">
        <span></span>
      </div>
      <strong>Rotate your device</strong>
      <p>GameHub works best in portrait.</p>
    </div>
  `;
  document.body.appendChild(overlay);
})();
