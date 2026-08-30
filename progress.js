const progressRoot = document.getElementById("progress-games");

const progressIcons = {
  "game-09": `<svg viewBox="0 0 48 48"><path d="M9 25h24c5 0 7-2 9-5-3-2-6-3-10-3H15z"/><path d="M14 17h22M12 30h25M17 17l2 13M31 17l-2 13M12 23L7 16l8 2M38 20h4M42 13v14M18 33a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM34 33a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>`
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
