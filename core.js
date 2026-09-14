(function(){
  const config = window.GH_CONFIG || { siteName: 'GameHub', title: 'Games', tagline: '' };

  function setHeaderText(){
    document.querySelectorAll('[data-site-name]').forEach((node) => {
      node.textContent = config.siteName || 'GameHub';
    });
    const title = document.getElementById('site-title');
    if (title) title.textContent = config.title || 'Games';
    const tagline = document.getElementById('site-tagline');
    if (tagline) tagline.textContent = config.tagline || '';
  }

  function initInfoDialogs(){
    const overlay = document.querySelector('.game-info-overlay');
    const openBtn = document.querySelector('.game-info-button');
    const closeBtn = document.querySelector('.game-info-close');
    if (!overlay || !openBtn || !closeBtn) return;
    const close = () => {
      overlay.hidden = true;
      document.body.classList.remove('dialog-open');
      openBtn.focus();
    };
    openBtn.addEventListener('click', () => {
      overlay.hidden = false;
      document.body.classList.add('dialog-open');
    });
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) close();
    });
  }

  function initInstallCard(){
    const overlay = document.getElementById('gh-install-overlay');
    const closeBtn = document.getElementById('gh-install-close');
    const doneBtn = document.getElementById('gh-install-done');
    const installBtn = document.getElementById('home-install');
    const copy = document.getElementById('gh-install-copy-text');
    const steps = document.getElementById('gh-install-steps');
    if (!overlay || !installBtn) return;

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (copy) copy.textContent = isiOS
      ? 'Open the Share sheet in Safari, then choose “Add to Home Screen”.'
      : 'Use your browser menu and look for an install or add-to-home-screen option.';
    if (steps) {
      steps.innerHTML = '';
      const stepsList = isiOS
        ? ['Tap the Share icon.', 'Scroll to “Add to Home Screen”.', 'Choose “Add”.']
        : ['Open the browser menu.', 'Choose Install / Add to Home Screen.', 'Confirm the prompt.'];
      stepsList.forEach((text, index) => {
        const item = document.createElement('div');
        item.className = 'gh-install-step';
        item.innerHTML = '<strong>' + (index + 1) + '</strong><span>' + text + '</span>';
        steps.appendChild(item);
      });
    }
    const close = () => { overlay.hidden = true; document.body.classList.remove('dialog-open'); };
    installBtn.hidden = false;
    installBtn.addEventListener('click', () => {
      overlay.hidden = false;
      document.body.classList.add('dialog-open');
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (doneBtn) doneBtn.addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  }

  function registerServiceWorker(){
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  function storageJSON(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }
  function saveJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {}
  }

  window.GH = {
    config,
    storageJSON,
    saveJSON,
    clamp(value, min, max){ return Math.max(min, Math.min(max, value)); },
    lerp(a, b, t){ return a + (b - a) * t; },
    easeInOut(t){ return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; }
  };

  setHeaderText();
  initInfoDialogs();
  initInstallCard();
  registerServiceWorker();
})();
