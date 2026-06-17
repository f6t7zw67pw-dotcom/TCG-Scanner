// Bootstrap loader: keeps the existing Pokemon DB enhancements and then adds the Cardmarket helper UI.
(function () {
  const BASE_LOADER = 'https://cdn.jsdelivr.net/gh/f6t7zw67pw-dotcom/TCG-Scanner@4daa6f040f7c758934c7474ebe90b93528480f9b/pokemon-db-loader.js';
  const HELPER = 'cardmarket-helper.js';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Script konnte nicht geladen werden: ${src}`));
      document.head.appendChild(script);
    });
  }

  function nudgeLoadHandlers() {
    if (document.readyState === 'complete') {
      window.dispatchEvent(new Event('load'));
    }
  }

  loadScript(BASE_LOADER)
    .then(() => {
      nudgeLoadHandlers();
      return loadScript(HELPER);
    })
    .then(nudgeLoadHandlers)
    .catch((err) => {
      const status = document.getElementById('nameHint') || document.getElementById('scanStatus');
      if (status) status.textContent = err.message;
      console.error(err);
    });
})();
