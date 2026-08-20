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
