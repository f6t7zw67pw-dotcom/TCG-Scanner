// Loads the full German -> English Pokemon name DB into Card Wizard Pro localStorage.
// Include this script after the main app script.
(function () {
  const STORAGE_KEY = 'cw_pokemon';
  const RELOAD_KEY = 'cw_pokemon_full_db_reload_done';

  function mergePokemonDb(existing, incoming) {
    return { ...(existing || {}), ...(incoming || {}) };
  }

  function installAppPatches() {
    window.fixSetCode = function (code, setName = '') {
      const c = String(code || '').trim().toUpperCase();
      const n = String(setName || '').trim().toLowerCase();

      if (c === 'WHT' || c === 'WH' || c === 'WF') return 'WHT';
      if (c === 'BLK' || c === 'BK' || c === 'B1K') return 'BLK';
      if (c) return c;
      if (n.includes('white')) return 'WHT';
      if (n.includes('black')) return 'BLK';
      return c;
    };

    window.liveSet = function () {
      const setCodeInput = document.getElementById('setCode');
      const setNameInput = document.getElementById('setName');
      if (!setCodeInput || !setNameInput) return;

      const c = window.fixSetCode(setCodeInput.value);
      setCodeInput.value = c;
      if (typeof window.setNameFromCode === 'function') {
        const n = window.setNameFromCode(c);
        if (n) setNameInput.value = n;
      }
      if (typeof window.buildUrl === 'function') window.buildUrl();
    };

    const setCodeInput = document.getElementById('setCode');
    if (setCodeInput) setCodeInput.oninput = window.liveSet;

    window.searchTcgCards = async function (scan) {
      const rawName = scan.originalName || scan.cardmarketName || scan.name || '';
      let searchName = rawName;

      try {
        if (typeof window.buildCMName === 'function') {
          const translated = window.buildCMName(rawName);
          if (translated) searchName = translated.replace(/-/g, ' ');
        }
      } catch {}

      const response = await fetch('/api/card-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchName,
          number: scan.fullNumber || scan.searchNumber || scan.number || '',
          setCode: scan.setCode || ''
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Kartensuche fehlgeschlagen');
      return data.cards || [];
    };
  }

  async function loadFullPokemonDb() {
    const response = await fetch('/api/pokemon-db');
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Pokemon DB konnte nicht geladen werden');

    let current = {};
    try { current = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}

    const hadFullDb = Object.keys(current).length >= data.count;
    const merged = mergePokemonDb(current, data.pokemon);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

    if (window.pokemonDbLoaded) window.pokemonDbLoaded(merged, data.count);
    return { count: data.count, pokemon: merged, hadFullDb };
  }

  window.loadFullPokemonDb = loadFullPokemonDb;
  installAppPatches();

  window.addEventListener('load', async function () {
    const status = document.getElementById('nameHint') || document.getElementById('scanStatus');
    try {
      const result = await loadFullPokemonDb();
      installAppPatches();
      if (status) status.textContent = `Pokemon-DB geladen: ${result.count} Namen.`;

      if (!result.hadFullDb && sessionStorage.getItem(RELOAD_KEY) !== '1') {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      }
    } catch (err) {
      if (status) status.textContent = `Pokemon-DB konnte nicht geladen werden: ${err.message}`;
    }
  });
})();
