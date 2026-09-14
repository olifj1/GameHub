(function(){
  const grid = document.getElementById('game-grid');
  if (!grid || !window.GH_CONFIG) return;
  window.GH_CONFIG.games.forEach((game) => {
    const link = document.createElement('a');
    link.className = 'game-card';
    link.href = game.href;
    link.innerHTML = `
      <span class="game-card-badge">${game.id.replace('game-','').padStart(2,'0')}</span>
      <span class="game-card-title">${game.title}</span>
      <span class="game-card-status">${game.status || 'Open'}</span>
      <span class="game-card-arrow" aria-hidden="true">→</span>
    `;
    grid.appendChild(link);
  });
})();
