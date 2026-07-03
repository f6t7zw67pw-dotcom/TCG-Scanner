// Adds a checkable National Pokedex tab with collection auto-matching.
(function () {
  if (window.__cwPokedexHelper) return;
  window.__cwPokedexHelper = true;

  const LIMIT = 1025;
  const CACHE_KEY = 'cw_pokedex_species_v1';
  const MANUAL_KEY = 'cw_pokedex_manual_v1';
  const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;
  const GENERATIONS = [
    { id: 'gen1', label: 'Gen 1', region: 'Kanto', from: 1, to: 151 },
    { id: 'gen2', label: 'Gen 2', region: 'Johto', from: 152, to: 251 },
    { id: 'gen3', label: 'Gen 3', region: 'Hoenn', from: 252, to: 386 },
    { id: 'gen4', label: 'Gen 4', region: 'Sinnoh', from: 387, to: 493 },
    { id: 'gen5', label: 'Gen 5', region: 'Einall', from: 494, to: 649 },
    { id: 'gen6', label: 'Gen 6', region: 'Kalos', from: 650, to: 721 },
    { id: 'gen7', label: 'Gen 7', region: 'Alola', from: 722, to: 809 },
    { id: 'gen8', label: 'Gen 8', region: 'Galar/Hisui', from: 810, to: 905 },
    { id: 'gen9', label: 'Gen 9', region: 'Paldea', from: 906, to: 1025 }
  ];
  const GERMAN_TO_ENGLISH = {
    bisasam: 'bulbasaur', bisaknosp: 'ivysaur', bisaflor: 'venusaur',
    glumanda: 'charmander', glutexo: 'charmeleon', glurak: 'charizard',
    schiggy: 'squirtle', schillok: 'wartortle', turtok: 'blastoise',
    mauzi: 'meowth', psiana: 'espeon', terapagos: 'terapagos', keldeo: 'keldeo',
    durengard: 'aegislash', pikachu: 'pikachu', roserade: 'roserade',
    shardrago: 'druddigon', chillabell: 'cinccino', schnuthelm: 'shelmet',
    fukano: 'growlithe', evoli: 'eevee', aquana: 'vaporeon', blitza: 'jolteon',
    flamara: 'flareon', nachtara: 'umbreon', folipurba: 'leafeon',
    glaziola: 'glaceon', feelinara: 'sylveon'
  };

  let species = [];
  let activeGen = 'gen1';
  let query = '';
  let onlyOpen = false;
  let manualSet = new Set();
  let autoMap = new Map();

  function byId(id) { return document.getElementById(id); }
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.warn('Pokedex speichern fehlgeschlagen', err); }
  }
  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/♀/g, ' f ')
      .replace(/♂/g, ' m ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function displayName(name) {
    return String(name || '').split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
  }
  function imageUrl(id) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }
  function loadManual() {
    manualSet = new Set((readJson(MANUAL_KEY, []) || []).map(Number).filter(Boolean));
  }
  function saveManual() {
    writeJson(MANUAL_KEY, Array.from(manualSet).sort((a, b) => a - b));
  }
  function cleanCardName(value) {
    let name = normalize(value);
    if (!name) return '';
    name = name
      .replace(/\b(v union|vmax|vstar|break|lv x|ex|gx|v)\b/g, ' ')
      .replace(/^m\s+/, '')
      .replace(/^mega\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return GERMAN_TO_ENGLISH[name] || name;
  }
  function cardNamesFromCollection() {
    const names = [];
    const oldCollection = readJson('cw_collection', []);
    if (Array.isArray(oldCollection)) {
      oldCollection.forEach(card => {
        if (!card || typeof card !== 'object') return;
        names.push(card.originalName, card.cardmarketName, card.name);
      });
    }
    const v2 = readJson('cw_collections_v2', null);
    const collections = Array.isArray(v2?.collections) ? v2.collections : [];
    collections.forEach(collection => {
      const cards = Array.isArray(collection?.cards) ? collection.cards : [];
      cards.forEach(card => {
        if (!card || typeof card !== 'object') return;
        names.push(card.originalName, card.cardmarketName, card.name);
      });
    });
    return names.filter(Boolean).map(cleanCardName).filter(Boolean);
  }
  function buildAutoMap() {
    const next = new Map();
    if (!species.length) {
      autoMap = next;
      return;
    }
    const lookup = species.map(item => ({ id: item.id, name: normalize(item.name) }));
    const cardNames = cardNamesFromCollection();
    cardNames.forEach(cardName => {
      lookup.forEach(mon => {
        const hit = cardName === mon.name || new RegExp(`(^| )${mon.name}( |$)`).test(cardName);
        if (!hit) return;
        next.set(mon.id, (next.get(mon.id) || 0) + 1);
      });
    });
    autoMap = next;
  }
  async function loadSpecies() {
    const cached = readJson(CACHE_KEY, null);
    if (cached?.items?.length === LIMIT && Date.now() - (cached.createdAt || 0) < CACHE_MAX_AGE) {
      return cached.items;
    }
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species?limit=${LIMIT}`);
      if (!response.ok) throw new Error('PokeAPI nicht erreichbar');
      const data = await response.json();
      const items = (data.results || []).slice(0, LIMIT).map((item, index) => ({ id: index + 1, name: item.name }));
      writeJson(CACHE_KEY, { createdAt: Date.now(), items });
      return items;
    } catch (err) {
      if (cached?.items?.length) return cached.items;
      throw err;
    }
  }
  function addStyles() {
    if (byId('cwPokedexStyles')) return;
    const style = document.createElement('style');
    style.id = 'cwPokedexStyles';
    style.textContent = `
      .bottomNav{grid-template-columns:repeat(5,1fr)!important}
      .pokedexTop{display:grid;gap:12px;margin-bottom:14px}
      .pokedexStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .pokedexStat{border:1px solid rgba(89,117,165,.32);background:#071426;border-radius:16px;padding:12px}
      .pokedexStat b{display:block;font-size:20px;margin-bottom:3px}
      .pokedexGenTabs{display:flex;gap:8px;overflow:auto;padding-bottom:3px}
      .pokedexGenTabs .chip{white-space:nowrap;min-width:88px}
      .pokedexTools{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
      .pokedexCheck{display:flex;align-items:center;gap:8px;color:var(--m);font-weight:850;white-space:nowrap}
      .pokedexCheck input{width:auto;accent-color:#7c3cff}
      .pokedexGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(142px,1fr));gap:12px}
      .pokedexCard{border:1px solid rgba(89,117,165,.32);border-radius:20px;background:linear-gradient(180deg,#0a1628,#081221);padding:10px;display:grid;gap:8px;min-height:214px}
      .pokedexCard.done{border-color:rgba(33,194,107,.55);box-shadow:0 0 0 1px rgba(33,194,107,.16) inset}
      .pokedexImage{width:100%;aspect-ratio:1/1;object-fit:contain;background:rgba(3,8,16,.42);border-radius:15px}
      .pokedexLine{display:flex;align-items:center;gap:7px;min-width:0}
      .pokedexLine input{width:auto;accent-color:#21c26b}
      .pokedexName{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pokedexNo{font-size:12px;color:var(--m);font-weight:850}
      .pokedexBadge{font-size:11px;font-weight:900;border:1px solid #3c557a;background:#111f35;color:#d8e4ff;border-radius:999px;padding:5px 7px;width:max-content}
      .pokedexBadge.auto{border-color:rgba(33,194,107,.5);background:#062716;color:#c9ffdf}
      @media(max-width:620px){.pokedexStats{grid-template-columns:1fr}.pokedexTools{grid-template-columns:1fr}.pokedexGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.bottomNav{left:8px;right:8px;gap:5px}.bottomNav .navBtn{font-size:11px;padding-left:2px;padding-right:2px}.navIcon{font-size:18px}}
    `;
    document.head.appendChild(style);
  }
  function ensureTab() {
    addStyles();
    if (!byId('pokedex')) {
      const main = document.querySelector('main.wrap') || document.querySelector('main') || document.body;
      const section = document.createElement('section');
      section.id = 'pokedex';
      section.className = 'view hidden';
      section.innerHTML = `
        <div class="card">
          <div class="title"><h2>Pokedex</h2><span class="badge">National Dex</span></div>
          <div class="pokedexTop">
            <div class="pokedexStats">
              <div class="pokedexStat"><b id="pokedexTotalDone">0</b><span class="small">von ${LIMIT} abgehakt</span></div>
              <div class="pokedexStat"><b id="pokedexGenDone">0</b><span class="small">in dieser Generation</span></div>
              <div class="pokedexStat"><b id="pokedexCollectionDone">0</b><span class="small">durch Sammlung erkannt</span></div>
            </div>
            <div class="pokedexGenTabs" id="pokedexGenTabs"></div>
            <div class="pokedexTools">
              <input id="pokedexSearch" placeholder="Pokemon suchen...">
              <label class="pokedexCheck"><input id="pokedexOnlyOpen" type="checkbox"> nur offene</label>
            </div>
          </div>
          <div id="pokedexStatus" class="hint">Pokedex wird geladen...</div>
          <div id="pokedexGrid" class="pokedexGrid"></div>
        </div>`;
      main.appendChild(section);
    }
    const nav = document.querySelector('.bottomNav');
    if (nav && !nav.querySelector('[data-tab="pokedex"]')) {
      const button = document.createElement('button');
      button.className = 'navBtn';
      button.dataset.tab = 'pokedex';
      button.type = 'button';
      button.innerHTML = '<span class="navIcon">#</span><span>Pokedex</span>';
      const help = nav.querySelector('[data-tab="help"]');
      if (help) nav.insertBefore(button, help); else nav.appendChild(button);
    }
    const tabs = byId('pokedexGenTabs');
    if (tabs && !tabs.children.length) {
      tabs.innerHTML = GENERATIONS.map(gen => `<button class="chip${gen.id === activeGen ? ' active' : ''}" data-pokedex-gen="${gen.id}" type="button">${gen.label}<br><span class="small">${gen.region}</span></button>`).join('');
      tabs.addEventListener('click', event => {
        const button = event.target.closest('[data-pokedex-gen]');
        if (!button) return;
        activeGen = button.dataset.pokedexGen;
        renderPokedex();
      });
    }
    const search = byId('pokedexSearch');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', () => { query = normalize(search.value); renderPokedex(); });
    }
    const open = byId('pokedexOnlyOpen');
    if (open && !open.dataset.bound) {
      open.dataset.bound = '1';
      open.addEventListener('change', () => { onlyOpen = open.checked; renderPokedex(); });
    }
    const grid = byId('pokedexGrid');
    if (grid && !grid.dataset.bound) {
      grid.dataset.bound = '1';
      grid.addEventListener('change', event => {
        const checkbox = event.target.closest('[data-pokedex-id]');
        if (!checkbox) return;
        const id = Number(checkbox.dataset.pokedexId);
        if (checkbox.checked) manualSet.add(id); else manualSet.delete(id);
        saveManual();
        renderPokedex();
      });
    }
  }
  function currentGen() {
    return GENERATIONS.find(gen => gen.id === activeGen) || GENERATIONS[0];
  }
  function checked(id) {
    return manualSet.has(id) || autoMap.has(id);
  }
  function renderPokedex() {
    ensureTab();
    buildAutoMap();
    const grid = byId('pokedexGrid');
    const status = byId('pokedexStatus');
    if (!grid || !status) return;
    document.querySelectorAll('[data-pokedex-gen]').forEach(button => button.classList.toggle('active', button.dataset.pokedexGen === activeGen));
    const gen = currentGen();
    const totalDone = species.filter(mon => checked(mon.id)).length;
    const genSpecies = species.filter(mon => mon.id >= gen.from && mon.id <= gen.to);
    const genDone = genSpecies.filter(mon => checked(mon.id)).length;
    const autoDone = autoMap.size;
    if (byId('pokedexTotalDone')) byId('pokedexTotalDone').textContent = `${totalDone}`;
    if (byId('pokedexGenDone')) byId('pokedexGenDone').textContent = `${genDone}/${genSpecies.length}`;
    if (byId('pokedexCollectionDone')) byId('pokedexCollectionDone').textContent = `${autoDone}`;
    let visible = genSpecies.filter(mon => !query || normalize(mon.name).includes(query) || String(mon.id).includes(query));
    if (onlyOpen) visible = visible.filter(mon => !checked(mon.id));
    status.textContent = `${gen.label} ${gen.region}: ${genDone} von ${genSpecies.length} abgehakt.`;
    if (!visible.length) {
      grid.innerHTML = '<div class="hint">Keine Pokemon fuer diese Filter gefunden.</div>';
      return;
    }
    grid.innerHTML = visible.map(mon => {
      const isAuto = autoMap.has(mon.id);
      const isDone = checked(mon.id);
      const count = autoMap.get(mon.id) || 0;
      const badge = isAuto ? `<span class="pokedexBadge auto">In Sammlung${count > 1 ? ' x' + count : ''}</span>` : (manualSet.has(mon.id) ? '<span class="pokedexBadge">Manuell</span>' : '<span class="pokedexBadge">Offen</span>');
      return `<article class="pokedexCard${isDone ? ' done' : ''}">
        <img class="pokedexImage" src="${imageUrl(mon.id)}" alt="${displayName(mon.name)}" loading="lazy">
        <div class="pokedexLine"><input data-pokedex-id="${mon.id}" type="checkbox" ${isDone ? 'checked' : ''}><div class="pokedexName" title="${displayName(mon.name)}">${displayName(mon.name)}</div></div>
        <div class="pokedexNo">#${String(mon.id).padStart(4, '0')}</div>
        ${badge}
      </article>`;
    }).join('');
  }
  async function init() {
    ensureTab();
    loadManual();
    try {
      species = await loadSpecies();
      buildAutoMap();
      renderPokedex();
    } catch (err) {
      const status = byId('pokedexStatus');
      if (status) status.textContent = 'Pokedex konnte nicht geladen werden. Bitte Internetverbindung pruefen.';
      console.warn('Pokedex laden fehlgeschlagen', err);
    }
  }

  window.addEventListener('storage', event => {
    if (event.key === 'cw_collection' || event.key === 'cw_collections_v2' || event.key === MANUAL_KEY) {
      loadManual();
      renderPokedex();
    }
  });
  window.addEventListener('cwCollectionUpdated', renderPokedex);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
