// Bootstrap loader: keeps the existing Pokemon DB enhancements and then adds the UI helper scripts.
(function () {
  const BASE_LOADER = '/api/loader-base';
  const HELPER = 'cardmarket-helper.js';
  const NUMBER_FIX = 'card-number-fix.js';

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
    .then(() => loadScript(NUMBER_FIX))
    .then(nudgeLoadHandlers)
    .catch((err) => {
      const status = document.getElementById('nameHint') || document.getElementById('scanStatus');
      if (status) status.textContent = err.message;
      console.error(err);
    });
})();
