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
  "game-08": `<svg viewBox="0 0 48 48"><path d="M8 24h15M29 24h11M23 14l8 10-8 10zM10 18v12"/></svg>`,
  "game-09": `<svg viewBox="0 0 48 48"><path d="M9 25h24c5 0 7-2 9-5-3-2-6-3-10-3H15z"/><path d="M14 17h22M12 30h25M17 17l2 13M31 17l-2 13M12 23L7 16l8 2M38 20h4M42 13v14M18 33a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM34 33a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>`
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
