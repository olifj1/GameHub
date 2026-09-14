const progressRoot = document.getElementById("progress-games");

const progressIcons = {
  "game-08": `<svg viewBox="0 0 48 48"><path d="M5 33c8 0 8-20 17-20s8 22 17 22h4"/><path d="M7 38h34M12 31v7M22 15v23M32 31v7"/><rect x="17" y="8" width="10" height="7" rx="2"/></svg>`,
  "game-09": `<svg viewBox="0 0 48 48"><path d="M9 25h24c5 0 7-2 9-5-3-2-6-3-10-3H15z"/><path d="M14 17h22M12 30h25M17 17l2 13M31 17l-2 13M12 23L7 16l8 2M38 20h4M42 13v14M18 33a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM34 33a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>`,
  "game-10": `<svg viewBox="0 0 48 48"><path d="M7 33h11l9-18M27 15h14M18 33l8 7M18 33l-5 8"/><path d="M26 13l6-5M26 17l6 5"/></svg>`,
  "game-11": `<svg viewBox="0 0 48 48"><path d="M10 12h17v8H17v8h14v8H20"/><path d="M20 36c-5 0-8-3-8-7M31 28c5 0 7 3 7 7"/><circle cx="38" cy="35" r="2"/></svg>`,
  "game-12": `<svg viewBox="0 0 48 48"><rect x="8" y="8" width="14" height="14" rx="3"/><rect x="26" y="8" width="14" height="14" rx="3"/><rect x="8" y="26" width="14" height="14" rx="3"/><rect x="26" y="26" width="14" height="14" rx="3"/></svg>`,
  "game-13": `<svg viewBox="0 0 48 48"><path d="M16 8h16l4 9v20H12V17z"/><path d="M17 17h14M18 10l-2 7M30 10l2 7M17 28h14"/><circle cx="16" cy="35" r="3"/><circle cx="32" cy="35" r="3"/></svg>`
};

function starsText(count) {
  const safe = Math.max(0, Math.min(5, Math.round(Number(count) || 0)));
  return `<span class="progress-stars" aria-label="${safe} out of 5 stars">${Array.from({length:5},(_,i)=>`<span class="${i<safe?"filled":""}">★</span>`).join("")}</span>`;
}

function niceDifficulty(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const trackedGames = (window.APP_CONFIG?.games || []).filter(game => game.enabled && game.progress?.enabled);

if (!trackedGames.length) {
  progressRoot.innerHTML = `<div class="progress-empty"><strong>No tracked games yet</strong><p>Results will appear here as games join the shared progress system.</p></div>`;
} else {
  trackedGames.forEach(game => {
    const saved = window.GameHubProgress?.getGame(game.id) || { difficulties: {} };
    const card = document.createElement("article");
    card.className = "progress-game-card";
    card.dataset.gameId = game.id;

    const rows = (game.progress.difficulties || ["easy","medium","hard"]).map(difficulty => {
      const result = saved.difficulties?.[difficulty] || {};
      const completed = (result.bestStars || 0) > 0;
      const score = game.progress.hasScore && completed
        ? `<span class="progress-score">Best ${Math.round(result.bestScore || 0).toLocaleString()}</span>`
        : `<span class="progress-score muted">${completed ? "Completed" : "Not completed"}</span>`;
      return `<div class="progress-difficulty ${completed ? "completed" : ""}">
        <strong>${niceDifficulty(difficulty)}</strong>
        ${starsText(result.bestStars || 0)}
        ${score}
      </div>`;
    }).join("");

    card.innerHTML = `
      <div class="progress-game-heading">
        <span class="progress-game-icon" aria-hidden="true">${progressIcons[game.id] || game.icon || "★"}</span>
        <div><p>GAME RESULTS</p><h2>${game.displayName}</h2></div>
        <a href="${game.path}" aria-label="Play ${game.displayName}">Play →</a>
      </div>
      <div class="progress-difficulty-list">${rows}</div>`;
    progressRoot.appendChild(card);
  });
}
