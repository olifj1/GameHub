(function(){
  const holder = document.getElementById('progress-games');
  if (!holder || !window.GH_CONFIG) return;
  const active = ['game-16', 'game-17'];
  holder.innerHTML = '';
  window.GH_CONFIG.games.forEach((game) => {
    const card = document.createElement('a');
    card.href = game.href;
    card.className = 'game-card';
    card.innerHTML = `
      <span class="game-card-badge">${active.includes(game.id) ? '★' : '•'}</span>
      <span class="game-card-title">${game.title}</span>
      <span class="game-card-status">${active.includes(game.id) ? 'Currently active in this build' : 'Listed in GameHub'}</span>
      <span class="game-card-arrow" aria-hidden="true">→</span>
    `;
    holder.appendChild(card);
  });
})();
