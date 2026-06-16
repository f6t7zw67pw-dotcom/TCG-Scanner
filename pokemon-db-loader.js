// Loads the full German -> English Pokemon name DB into Card Wizard Pro localStorage.
// Include this script after the main app script.
(function () {
  const STORAGE_KEY = 'cw_pokemon';

  function mergePokemonDb(existing, incoming) {
    return { ...(existing || {}), ...(incoming || {}) };
  }

  async function loadFullPokemonDb() {
    const response = await fetch('/api/pokemon-db');
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Pokemon DB konnte nicht geladen werden');

    let current = {};
    try { current = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}

    const merged = mergePokemonDb(current, data.pokemon);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

    window.pokemon = merged;
    if (typeof window.refreshDb === 'function') window.refreshDb();
    if (window.pokemonDbLoaded) window.pokemonDbLoaded(merged, data.count);
    return { count: data.count, pokemon: merged };
  }

  window.loadFullPokemonDb = loadFullPokemonDb;

  window.addEventListener('load', async function () {
    try {
      const result = await loadFullPokemonDb();
      const status = document.getElementById('nameHint') || document.getElementById('scanStatus');
      if (status) status.textContent = `Pokemon-DB geladen: ${result.count} Namen.`;
    } catch (err) {
      const status = document.getElementById('nameHint') || document.getElementById('scanStatus');
      if (status) status.textContent = `Pokemon-DB konnte nicht geladen werden: ${err.message}`;
    }
  });
})();
