// Shared helpers and application shell utilities.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Prevent iOS gesture zoom and unwanted double-tap zoom in the app shell.
document.addEventListener("gesturestart", event => event.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener("touchend", event => {
  const now = Date.now();
  if (now - lastTouchEnd <= 280) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

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
      const swUrl = new URL("../sw.js", document.currentScript?.src || new URL("core.js", location.href));
      const registration = await navigator.serviceWorker.register(swUrl.pathname);
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
