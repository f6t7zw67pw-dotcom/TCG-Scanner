// Loads the full German -> English Pokemon name DB into Card Wizard Pro localStorage.
// Include this script after the main app script.
(function () {
  const STORAGE_KEY = 'cw_pokemon';
  const RELOAD_KEY = 'cw_pokemon_full_db_reload_done';

  function mergePokemonDb(existing, incoming) {
    return { ...(existing || {}), ...(incoming || {}) };
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

  window.addEventListener('load', async function () {
    const status = document.getElementById('nameHint') || document.getElementById('scanStatus');
    try {
      const result = await loadFullPokemonDb();
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
