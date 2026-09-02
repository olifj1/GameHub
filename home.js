const site = window.APP_CONFIG.site;
document.getElementById("site-title").textContent = site.displayName;
document.getElementById("site-tagline").textContent = site.tagline;
document.title = site.displayName;

const iconSvg = {
  "game-01": `<svg viewBox="0 0 48 48"><path d="M14 14l20 20M34 14L14 34"/></svg>`,
  "game-02": `<svg viewBox="0 0 48 48"><circle cx="24" cy="25" r="15"/><path d="M24 25V15M24 25l8 5M18 7h12"/></svg>`,
  "game-03": `<svg viewBox="0 0 48 48"><path d="M24 11v26M11 24h26"/></svg>`,
  "game-04": `<svg viewBox="0 0 48 48"><path d="M8 13c7-3 12-1 16 3 4-4 9-6 16-3v25c-7-3-12-1-16 3-4-4-9-6-16-3zM24 16v25"/></svg>`,
  "game-05": `<svg viewBox="0 0 48 48"><rect x="10" y="8" width="28" height="32" rx="5"/><path d="M15 15h18M16 23h4M28 23h4M16 30h4M28 30h4"/></svg>`,
  "game-06": `<svg viewBox="0 0 48 48"><path d="M24 7c5 5 8 11 8 17l-8 8-8-8c0-6 3-12 8-17zM18 28l-5 8 8-2M30 28l5 8-8-2M24 17v8"/></svg>`,
  "game-07": `<svg viewBox="0 0 48 48"><path d="M8 30h27l4 6H13zM14 30V19h13v11M27 23h7l4 7M18 19v-6h10M15 36a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM34 36a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>`,
  "game-08": `<svg viewBox="0 0 48 48"><path d="M5 33c8 0 8-20 17-20s8 22 17 22h4"/><path d="M7 38h34M12 31v7M22 15v23M32 31v7"/><rect x="17" y="8" width="10" height="7" rx="2"/></svg>`,
  "game-09": `<svg viewBox="0 0 48 48"><path d="M9 25h24c5 0 7-2 9-5-3-2-6-3-10-3H15z"/><path d="M14 17h22M12 30h25M17 17l2 13M31 17l-2 13M12 23L7 16l8 2M38 20h4M42 13v14M18 33a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM34 33a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>`,
  "game-10": `<svg viewBox="0 0 48 48"><path d="M7 33h11l9-18M27 15h14M18 33l8 7M18 33l-5 8"/><path d="M26 13l6-5M26 17l6 5"/></svg>`,
  "game-11": `<svg viewBox="0 0 48 48"><path d="M10 12h17v8H17v8h14v8H20"/><path d="M20 36c-5 0-8-3-8-7M31 28c5 0 7 3 7 7"/><circle cx="38" cy="35" r="2"/></svg>`,
  "game-12": `<svg viewBox="0 0 48 48"><rect x="8" y="8" width="14" height="14" rx="3"/><rect x="26" y="8" width="14" height="14" rx="3"/><rect x="8" y="26" width="14" height="14" rx="3"/><rect x="26" y="26" width="14" height="14" rx="3"/><path d="M15 8v14M33 8v14M15 26v14M33 26v14M8 15h14M26 15h14M8 33h14M26 33h14"/></svg>`,
  "game-13": `<svg viewBox="0 0 48 48"><path d="M16 8h16l4 9v20H12V17z"/><path d="M17 17h14M18 10l-2 7M30 10l2 7M17 28h14"/><circle cx="16" cy="35" r="3"/><circle cx="32" cy="35" r="3"/></svg>`
};

const grid = document.getElementById("game-grid");
window.APP_CONFIG.games.filter(game => game.enabled).forEach(game => {
  const card = document.createElement("a");
  card.className = "game-card";
  card.dataset.gameId = game.id;
  card.href = game.path;
  card.innerHTML = `
    <span class="game-card-icon" aria-hidden="true">${iconSvg[game.id] || game.icon}</span>
    <h2>${game.displayName}</h2>
    <p>${game.description}</p>
    <span class="game-card-play">PLAY →</span>`;
  grid.appendChild(card);
});


// GameHub install helper.
// Chromium exposes a native install prompt through beforeinstallprompt.
// iOS/iPadOS deliberately keeps Add to Home Screen inside the browser Share UI,
// so the same GameHub button opens short device-specific instructions there.
(function setupInstallGameHub() {
  const installButton = document.getElementById("home-install");
  const overlay = document.getElementById("gh-install-overlay");
  const closeButton = document.getElementById("gh-install-close");
  const doneButton = document.getElementById("gh-install-done");
  const kicker = document.getElementById("gh-install-kicker");
  const copy = document.getElementById("gh-install-copy-text");
  const steps = document.getElementById("gh-install-steps");
  if (!installButton || !overlay) return;

  let deferredInstallPrompt = null;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  const isStandalone = () => (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    navigator.standalone === true
  );

  function setVisible(visible) {
    installButton.hidden = !visible;
  }

  function closeGuide() {
    overlay.classList.remove("open");
    setTimeout(() => { overlay.hidden = true; }, 150);
  }

  function openGuide(kind) {
    const ios = kind === "ios";
    const android = kind === "android";
    kicker.textContent = ios ? "IPHONE / IPAD" : android ? "ANDROID" : "INSTALL GAMEHUB";
    copy.textContent = ios
      ? "Apple keeps the final Add to Home Screen step in the browser Share menu."
      : android
        ? "If the install window did not appear, you can still add GameHub from your browser menu."
        : "Your browser can add GameHub to the Home screen or app launcher from its menu.";

    const labels = ios
      ? ["Tap the Share button in your browser.", "Choose Add to Home Screen.", "Tap Add to confirm."]
      : android
        ? ["Open the browser menu (⋮).", "Choose Install app or Add to Home screen.", "Confirm the install."]
        : ["Open your browser menu.", "Choose Install app or Add to Home screen.", "Confirm the install."];

    steps.innerHTML = labels.map((label, index) => `
      <div class="gh-install-step">
        <span>${index + 1}</span>
        <strong>${label}</strong>
      </div>`).join("");

    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    closeButton?.focus({ preventScroll: true });
  }

  // Hide the action when GameHub is already running from its installed icon.
  if (isStandalone()) {
    setVisible(false);
    return;
  }

  // iOS has no programmatic install prompt; show our guide immediately.
  // Android gets a visible action even before Chromium hands us its prompt so
  // there is always a useful fallback if browser/installability rules differ.
  setVisible(isIOS || isAndroid);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    setVisible(!isStandalone());
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    closeGuide();
    setVisible(false);
  });

  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", event => {
    if (event.matches) setVisible(false);
  });

  installButton.addEventListener("click", async () => {
    if (isStandalone()) {
      setVisible(false);
      return;
    }

    if (deferredInstallPrompt) {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === "accepted") {
          setVisible(false);
        } else {
          // Chromium normally issues a fresh event if installation remains
          // available. Keep a useful fallback visible in the meantime.
          setVisible(true);
        }
      } catch (error) {
        console.warn("GameHub install prompt could not be shown:", error);
        openGuide(isAndroid ? "android" : "generic");
      }
      return;
    }

    openGuide(isIOS ? "ios" : isAndroid ? "android" : "generic");
  });

  closeButton?.addEventListener("click", closeGuide);
  doneButton?.addEventListener("click", closeGuide);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeGuide();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) closeGuide();
  });
})();
