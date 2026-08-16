const site = window.APP_CONFIG.site;
document.getElementById("site-title").textContent = site.displayName;
document.getElementById("site-tagline").textContent = site.tagline;
document.title = site.displayName;

const grid = document.getElementById("game-grid");
window.APP_CONFIG.games.filter(game => game.enabled).forEach(game => {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = game.path;
  card.innerHTML = `
    <span class="game-card-icon" aria-hidden="true">${game.icon}</span>
    <h2>${game.displayName}</h2>
    <p>${game.description}</p>
    <span class="game-card-play">PLAY →</span>`;
  grid.appendChild(card);
});
