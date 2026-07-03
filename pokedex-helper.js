// Adds a checkable National Pokedex tab with manual card assignments.
(function () {
  if (window.__cwPokedexHelper) return;
  window.__cwPokedexHelper = true;

  const LIMIT = 1025;
  const CACHE_KEY = 'cw_pokedex_species_v1';
  const MANUAL_KEY = 'cw_pokedex_manual_v1';
  const ASSIGN_KEY = 'cw_pokedex_assignments_v1';
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
  let assignFilter = '';
  let activeAssignId = 0;
  let manualSet = new Set();
  let assignments = {};
  let suggestionMap = new Map();

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
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
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
  function loadAssignments() {
    const raw = readJson(ASSIGN_KEY, {});
    assignments = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  }
  function saveAssignments() {
    writeJson(ASSIGN_KEY, assignments);
  }
  function assignedKeys(id) {
    return Array.isArray(assignments[String(id)]) ? assignments[String(id)] : [];
  }
  function setAssignedKeys(id, keys) {
    const clean = Array.from(new Set(keys.filter(Boolean)));
    if (clean.length) assignments[String(id)] = clean;
    else delete assignments[String(id)];
    saveAssignments();
  }
  function cardTitle(card) {
    return card.cardmarketName || card.originalName || card.name || 'Unbenannte Karte';
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
  function collectionCards() {
    const cards = [];
    const seen = new Set();
    function add(card, collectionName, index) {
      if (!card || typeof card !== 'object') return;
      const key = String(card.id || `${collectionName || 'sammlung'}-${index}-${cardTitle(card)}-${card.fullNumber || ''}-${card.setCode || ''}`);
      if (seen.has(key)) return;
      seen.add(key);
      cards.push({
        key,
        collectionName: collectionName || 'Sammlung',
        title: cardTitle(card),
        number: card.fullNumber || card.number || '',
        setCode: card.setCode || '',
        setName: card.setName || '',
        image: card.image || card.imageSmall || '',
        names: [card.originalName, card.cardmarketName, card.name].filter(Boolean).map(cleanCardName).filter(Boolean),
        raw: card
      });
    }
    const oldCollection = readJson('cw_collection', []);
    if (Array.isArray(oldCollection)) oldCollection.forEach((card, index) => add(card, 'Hauptsammlung', index));
    const v2 = readJson('cw_collections_v2', null);
    const collections = Array.isArray(v2?.collections) ? v2.collections : [];
    collections.forEach(collection => {
      const list = Array.isArray(collection?.cards) ? collection.cards : [];
      list.forEach((card, index) => add(card, collection?.name || 'Sammlung', index));
    });
    return cards;
  }
  function buildSuggestionMap() {
    const next = new Map();
    if (!species.length) {
      suggestionMap = next;
      return;
    }
    const lookup = species.map(item => ({ id: item.id, name: normalize(item.name) }));
    collectionCards().forEach(card => {
      card.names.forEach(cardName => {
        lookup.forEach(mon => {
          const hit = cardName === mon.name || new RegExp(`(^| )${mon.name}( |$)`).test(cardName);
          if (!hit) return;
          const list = next.get(mon.id) || [];
          if (!list.some(item => item.key === card.key)) list.push(card);
          next.set(mon.id, list);
        });
      });
    });
    suggestionMap = next;
  }
  async function loadSpecies() {
    const cached = readJson(CACHE_KEY, null);
    if (cached?.items?.length === LIMIT && Date.now() - (cached.createdAt || 0) < CACHE_MAX_AGE) return cached.items;
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
      .pokedexGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(154px,1fr));gap:12px}
      .pokedexCard{border:1px solid rgba(89,117,165,.32);border-radius:20px;background:linear-gradient(180deg,#0a1628,#081221);padding:10px;display:grid;gap:8px;min-height:256px}
      .pokedexCard.done{border-color:rgba(33,194,107,.55);box-shadow:0 0 0 1px rgba(33,194,107,.16) inset}
      .pokedexImage{width:100%;aspect-ratio:1/1;object-fit:contain;background:rgba(3,8,16,.42);border-radius:15px}
      .pokedexLine{display:flex;align-items:center;gap:7px;min-width:0}
      .pokedexLine input{width:auto;accent-color:#21c26b}
      .pokedexName{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pokedexNo{font-size:12px;color:var(--m);font-weight:850}
      .pokedexBadges{display:flex;gap:6px;flex-wrap:wrap}
      .pokedexBadge{font-size:11px;font-weight:900;border:1px solid #3c557a;background:#111f35;color:#d8e4ff;border-radius:999px;padding:5px 7px;width:max-content}
      .pokedexBadge.auto{border-color:rgba(255,157,69,.5);background:#321407;color:#ffd7bd}
      .pokedexBadge.assigned{border-color:rgba(33,194,107,.5);background:#062716;color:#c9ffdf}
      .pokedexAssignBtn{border:1px solid #304663;border-radius:14px;background:linear-gradient(180deg,#162640,#0e1b30);color:var(--t);font-weight:850;padding:9px 8px}
      .pokedexOverlay{position:fixed;inset:0;background:rgba(2,6,14,.72);z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:16px}
      .pokedexModal{width:min(760px,100%);max-height:86vh;overflow:auto;background:linear-gradient(180deg,#101f36,#07111f);border:1px solid rgba(96,124,174,.48);border-radius:24px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.5)}
      .pokedexModalHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .pokedexCardList{display:grid;gap:9px;margin-top:12px}
      .pokedexAssignItem{display:grid;grid-template-columns:auto 54px 1fr;gap:10px;align-items:center;border:1px solid rgba(89,117,165,.32);border-radius:16px;background:#071426;padding:8px}
      .pokedexAssignItem input{width:auto;accent-color:#21c26b}
      .pokedexAssignItem img{width:54px;height:72px;object-fit:cover;border-radius:10px;background:#020814}
      @media(max-width:620px){.pokedexStats{grid-template-columns:1fr}.pokedexTools{grid-template-columns:1fr}.pokedexGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.bottomNav{left:8px;right:8px;gap:5px}.bottomNav .navBtn{font-size:11px;padding-left:2px;padding-right:2px}.navIcon{font-size:18px}.pokedexAssignItem{grid-template-columns:auto 44px 1fr}.pokedexAssignItem img{width:44px;height:60px}}
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
              <div class="pokedexStat"><b id="pokedexTotalDone">0</b><span class="small">von ${LIMIT} von dir abgehakt</span></div>
              <div class="pokedexStat"><b id="pokedexGenDone">0</b><span class="small">in dieser Generation</span></div>
              <div class="pokedexStat"><b id="pokedexAssignedDone">0</b><span class="small">Pokemon mit zugeordneten Karten</span></div>
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
      grid.addEventListener('click', event => {
        const button = event.target.closest('[data-assign-id]');
        if (!button) return;
        openAssignmentModal(Number(button.dataset.assignId));
      });
    }
  }
  function currentGen() {
    return GENERATIONS.find(gen => gen.id === activeGen) || GENERATIONS[0];
  }
  function checked(id) {
    return manualSet.has(id);
  }
  function assignedCount(id) {
    return assignedKeys(id).length;
  }
  function assignedPokemonCount() {
    return Object.values(assignments).filter(value => Array.isArray(value) && value.length).length;
  }
  function renderPokedex() {
    ensureTab();
    buildSuggestionMap();
    const grid = byId('pokedexGrid');
    const status = byId('pokedexStatus');
    if (!grid || !status) return;
    document.querySelectorAll('[data-pokedex-gen]').forEach(button => button.classList.toggle('active', button.dataset.pokedexGen === activeGen));
    const gen = currentGen();
    const totalDone = species.filter(mon => checked(mon.id)).length;
    const genSpecies = species.filter(mon => mon.id >= gen.from && mon.id <= gen.to);
    const genDone = genSpecies.filter(mon => checked(mon.id)).length;
    if (byId('pokedexTotalDone')) byId('pokedexTotalDone').textContent = `${totalDone}`;
    if (byId('pokedexGenDone')) byId('pokedexGenDone').textContent = `${genDone}/${genSpecies.length}`;
    if (byId('pokedexAssignedDone')) byId('pokedexAssignedDone').textContent = `${assignedPokemonCount()}`;
    let visible = genSpecies.filter(mon => !query || normalize(mon.name).includes(query) || String(mon.id).includes(query));
    if (onlyOpen) visible = visible.filter(mon => !checked(mon.id));
    status.textContent = `${gen.label} ${gen.region}: ${genDone} von ${genSpecies.length} von dir abgehakt. Vorschlaege haken nichts automatisch ab.`;
    if (!visible.length) {
      grid.innerHTML = '<div class="hint">Keine Pokemon fuer diese Filter gefunden.</div>';
      return;
    }
    grid.innerHTML = visible.map(mon => {
      const isDone = checked(mon.id);
      const suggestions = suggestionMap.get(mon.id) || [];
      const assigned = assignedCount(mon.id);
      const badges = [isDone ? '<span class="pokedexBadge assigned">Abgehakt</span>' : '<span class="pokedexBadge">Offen</span>'];
      if (assigned) badges.push(`<span class="pokedexBadge assigned">${assigned} zugeordnet</span>`);
      if (suggestions.length) badges.push(`<span class="pokedexBadge auto">${suggestions.length} Vorschlag${suggestions.length === 1 ? '' : 'e'}</span>`);
      return `<article class="pokedexCard${isDone ? ' done' : ''}">
        <img class="pokedexImage" src="${imageUrl(mon.id)}" alt="${displayName(mon.name)}" loading="lazy">
        <div class="pokedexLine"><input data-pokedex-id="${mon.id}" type="checkbox" ${isDone ? 'checked' : ''}><div class="pokedexName" title="${displayName(mon.name)}">${displayName(mon.name)}</div></div>
        <div class="pokedexNo">#${String(mon.id).padStart(4, '0')}</div>
        <div class="pokedexBadges">${badges.join('')}</div>
        <button class="pokedexAssignBtn" data-assign-id="${mon.id}" type="button">Karten zuordnen</button>
      </article>`;
    }).join('');
  }
  function openAssignmentModal(id) {
    activeAssignId = id;
    assignFilter = '';
    let overlay = byId('pokedexAssignOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pokedexAssignOverlay';
      overlay.className = 'pokedexOverlay';
      overlay.innerHTML = `
        <div class="pokedexModal">
          <div class="pokedexModalHead"><h2 id="pokedexAssignTitle">Karten zuordnen</h2><button class="btn ghost" id="pokedexAssignClose" type="button">Schliessen</button></div>
          <div class="hint" id="pokedexAssignHint"></div>
          <input id="pokedexAssignSearch" placeholder="Karte suchen...">
          <div id="pokedexAssignList" class="pokedexCardList"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.id === 'pokedexAssignClose') closeAssignmentModal();
      });
      byId('pokedexAssignSearch').addEventListener('input', event => {
        assignFilter = normalize(event.target.value);
        renderAssignmentModal();
      });
      byId('pokedexAssignList').addEventListener('change', event => {
        const checkbox = event.target.closest('[data-card-key]');
        if (!checkbox) return;
        const current = new Set(assignedKeys(activeAssignId));
        if (checkbox.checked) current.add(checkbox.dataset.cardKey);
        else current.delete(checkbox.dataset.cardKey);
        setAssignedKeys(activeAssignId, Array.from(current));
        renderAssignmentModal();
        renderPokedex();
      });
    }
    overlay.classList.remove('hidden');
    byId('pokedexAssignSearch').value = '';
    renderAssignmentModal();
  }
  function closeAssignmentModal() {
    const overlay = byId('pokedexAssignOverlay');
    if (overlay) overlay.classList.add('hidden');
    activeAssignId = 0;
  }
  function renderAssignmentModal() {
    const mon = species.find(item => item.id === activeAssignId);
    const list = byId('pokedexAssignList');
    if (!mon || !list) return;
    const selected = new Set(assignedKeys(activeAssignId));
    const suggestions = new Set((suggestionMap.get(activeAssignId) || []).map(card => card.key));
    const cards = collectionCards().filter(card => {
      if (!assignFilter) return true;
      const haystack = normalize(`${card.title} ${card.number} ${card.setCode} ${card.setName} ${card.collectionName}`);
      return haystack.includes(assignFilter);
    }).sort((a, b) => {
      const aScore = (selected.has(a.key) ? 0 : 10) + (suggestions.has(a.key) ? 0 : 1);
      const bScore = (selected.has(b.key) ? 0 : 10) + (suggestions.has(b.key) ? 0 : 1);
      return aScore - bScore || a.title.localeCompare(b.title);
    });
    byId('pokedexAssignTitle').textContent = `${displayName(mon.name)} Karten zuordnen`;
    byId('pokedexAssignHint').textContent = `${selected.size} Karte${selected.size === 1 ? '' : 'n'} zugeordnet. Vorschlaege sind nur Hilfe, du entscheidest selbst.`;
    if (!cards.length) {
      list.innerHTML = '<div class="hint">Keine Karten in deiner Sammlung gefunden.</div>';
      return;
    }
    list.innerHTML = cards.map(card => {
      const checkedAttr = selected.has(card.key) ? 'checked' : '';
      const suggestion = suggestions.has(card.key) ? '<span class="pokedexBadge auto">Vorschlag</span>' : '';
      const image = card.image ? `<img src="${card.image}" alt="${escapeHtml(card.title)}">` : '<img alt="">';
      return `<label class="pokedexAssignItem">
        <input data-card-key="${escapeHtml(card.key)}" type="checkbox" ${checkedAttr}>
        ${image}
        <div><b>${escapeHtml(card.title)}</b><div class="small">${escapeHtml(card.number)} · ${escapeHtml(card.setCode)} ${escapeHtml(card.setName)}</div><div class="small">${escapeHtml(card.collectionName)}</div>${suggestion}</div>
      </label>`;
    }).join('');
  }
  async function init() {
    ensureTab();
    loadManual();
    loadAssignments();
    try {
      species = await loadSpecies();
      buildSuggestionMap();
      renderPokedex();
    } catch (err) {
      const status = byId('pokedexStatus');
      if (status) status.textContent = 'Pokedex konnte nicht geladen werden. Bitte Internetverbindung pruefen.';
      console.warn('Pokedex laden fehlgeschlagen', err);
    }
  }

  window.addEventListener('storage', event => {
    if (event.key === 'cw_collection' || event.key === 'cw_collections_v2' || event.key === MANUAL_KEY || event.key === ASSIGN_KEY) {
      loadManual();
      loadAssignments();
      renderPokedex();
    }
  });
  window.addEventListener('cwCollectionUpdated', renderPokedex);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
