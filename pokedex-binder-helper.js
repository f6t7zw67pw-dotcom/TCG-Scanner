// Adds a 3x3 binder view for assigned Pokedex cards.
(function () {
  if (window.__cwPokedexBinderHelper) return;
  window.__cwPokedexBinderHelper = true;

  const LIMIT = 1025;
  const SPECIES_CACHE = 'cw_pokedex_species_v1';
  const ASSIGN_KEY = 'cw_pokedex_assignments_v1';
  const MODE_KEY = 'cw_pokedex_view_mode_v1';
  const PAGE_KEY = 'cw_pokedex_binder_page_v1';
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

  let species = [];
  let mode = localStorage.getItem(MODE_KEY) || 'list';
  let pageByGen = readJson(PAGE_KEY, {});

  function byId(id) { return document.getElementById(id); }
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.warn('Binder speichern fehlgeschlagen', err); }
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
  function activeGen() {
    const active = document.querySelector('[data-pokedex-gen].active')?.dataset.pokedexGen;
    return GENERATIONS.find(gen => gen.id === active) || GENERATIONS[0];
  }
  function currentPage(genId) {
    return Math.max(0, Number(pageByGen[genId] || 0));
  }
  function setPage(genId, page) {
    pageByGen[genId] = Math.max(0, page);
    writeJson(PAGE_KEY, pageByGen);
  }
  function assignedKeys(id) {
    const assignments = readJson(ASSIGN_KEY, {});
    return Array.isArray(assignments[String(id)]) ? assignments[String(id)] : [];
  }
  function cardTitle(card) {
    return card.cardmarketName || card.originalName || card.name || 'Unbenannte Karte';
  }
  function collectionCardsByKey() {
    const cards = new Map();
    const seen = new Set();
    function add(card, collectionName, index) {
      if (!card || typeof card !== 'object') return;
      const key = String(card.id || `${collectionName || 'sammlung'}-${index}-${cardTitle(card)}-${card.fullNumber || ''}-${card.setCode || ''}`);
      if (seen.has(key)) return;
      seen.add(key);
      cards.set(key, {
        key,
        collectionName: collectionName || 'Sammlung',
        title: cardTitle(card),
        number: card.fullNumber || card.number || '',
        setCode: card.setCode || '',
        setName: card.setName || '',
        language: card.language || card.languageLabel || card.lang || '',
        image: card.image || card.imageSmall || '',
        url: card.cardmarketUrl || '',
        raw: card
      });
    }
    const legacy = readJson('cw_collection', []);
    if (Array.isArray(legacy)) legacy.forEach((card, index) => add(card, 'Hauptsammlung', index));
    const store = readJson('cw_collections_v2', null);
    const collections = Array.isArray(store?.collections) ? store.collections : [];
    collections.forEach(collection => {
      const list = Array.isArray(collection?.cards) ? collection.cards : [];
      list.forEach((card, index) => add(card, collection?.name || 'Sammlung', index));
    });
    return cards;
  }
  async function loadSpecies() {
    const cached = readJson(SPECIES_CACHE, null);
    if (cached?.items?.length === LIMIT) return cached.items;
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species?limit=${LIMIT}`);
    if (!response.ok) throw new Error('PokeAPI nicht erreichbar');
    const data = await response.json();
    const items = (data.results || []).slice(0, LIMIT).map((item, index) => ({ id: index + 1, name: item.name }));
    writeJson(SPECIES_CACHE, { createdAt: Date.now(), items });
    return items;
  }
  function addStyles() {
    if (byId('cwPokedexBinderStyles')) return;
    const style = document.createElement('style');
    style.id = 'cwPokedexBinderStyles';
    style.textContent = `
      .pokedexViewSwitch{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .pokedexViewSwitch .chip{min-width:120px}
      #pokedex.pokedexBinderMode #pokedexGrid{display:none!important}
      #pokedex:not(.pokedexBinderMode) #pokedexBinder{display:none!important}
      .binderToolbar{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin:12px 0}
      .binderToolbar .btn{min-height:44px;padding:10px 14px}
      .binderPageText{text-align:center;color:var(--m);font-weight:850}
      .binderSheet{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:14px;border:1px solid rgba(120,150,210,.32);border-radius:24px;background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02)),#06101d;box-shadow:inset 0 0 36px rgba(255,255,255,.04),0 18px 45px rgba(0,0,0,.32)}
      .binderPocket{position:relative;min-height:248px;border:1px solid rgba(190,210,255,.28);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.025));box-shadow:inset 0 0 18px rgba(255,255,255,.08);padding:9px;display:grid;grid-template-rows:auto 1fr auto;gap:7px;overflow:hidden}
      .binderPocket::after{content:"";position:absolute;inset:7px;border:1px solid rgba(255,255,255,.12);border-radius:14px;pointer-events:none}
      .binderHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;position:relative;z-index:1}
      .binderMon{font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .binderNo{font-size:12px;color:var(--m);font-weight:850}
      .binderArt{position:absolute;right:8px;bottom:30px;width:66px;height:66px;object-fit:contain;opacity:.18;filter:saturate(.7);pointer-events:none}
      .binderCardMain{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;min-height:144px;border-radius:14px;background:rgba(2,8,18,.34);overflow:hidden}
      .binderCardMain img{width:100%;height:100%;max-height:172px;object-fit:contain;display:block}
      .binderEmpty{color:var(--m);font-size:13px;text-align:center;padding:20px 8px}
      .binderFooter{position:relative;z-index:1;display:grid;gap:6px}
      .binderCardTitle{font-size:12px;font-weight:850;line-height:1.25;min-height:30px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .binderMiniRow{display:flex;gap:4px;align-items:center;overflow:hidden}
      .binderMiniRow img{width:28px;height:38px;object-fit:cover;border-radius:5px;border:1px solid rgba(255,255,255,.22);background:#020814}
      .binderCount{font-size:11px;font-weight:900;border:1px solid rgba(33,194,107,.5);background:#062716;color:#c9ffdf;border-radius:999px;padding:4px 7px;width:max-content}
      .binderHint{margin-top:10px;color:var(--m);font-size:13px;line-height:1.4}
      @media(max-width:760px){.binderSheet{gap:8px;padding:8px}.binderPocket{min-height:196px;padding:7px}.binderCardMain{min-height:112px}.binderCardMain img{max-height:132px}.binderArt{width:48px;height:48px}.binderToolbar{grid-template-columns:1fr}.binderPageText{text-align:left}}
    `;
    document.head.appendChild(style);
  }
  function ensureBinderUi() {
    const pokedex = byId('pokedex');
    const status = byId('pokedexStatus');
    if (!pokedex || !status) return false;
    addStyles();
    if (!byId('pokedexViewSwitch')) {
      const switcher = document.createElement('div');
      switcher.id = 'pokedexViewSwitch';
      switcher.className = 'pokedexViewSwitch';
      switcher.innerHTML = '<button class="chip" data-pokedex-view="list" type="button">Pokedex Liste</button><button class="chip" data-pokedex-view="binder" type="button">Binder 3x3</button>';
      status.parentNode.insertBefore(switcher, status.nextSibling);
      switcher.addEventListener('click', event => {
        const button = event.target.closest('[data-pokedex-view]');
        if (!button) return;
        mode = button.dataset.pokedexView;
        localStorage.setItem(MODE_KEY, mode);
        renderBinder();
      });
    }
    if (!byId('pokedexBinder')) {
      const binder = document.createElement('div');
      binder.id = 'pokedexBinder';
      binder.innerHTML = '<div class="binderToolbar"><button class="btn ghost" id="binderPrev" type="button">Zurueck</button><div class="binderPageText" id="binderPageText">Binder</div><button class="btn ghost" id="binderNext" type="button">Weiter</button></div><div id="binderSheet" class="binderSheet"></div><div class="binderHint">Japanische oder chinesische Karten funktionieren hier genauso: Karte speichern, im Pokedex dem Pokemon zuordnen, dann erscheint sie in der Binder-Tasche. Der Name muss dafuer nicht perfekt erkannt sein.</div>';
      const grid = byId('pokedexGrid');
      grid.parentNode.insertBefore(binder, grid);
      byId('binderPrev').addEventListener('click', () => {
        const gen = activeGen();
        setPage(gen.id, currentPage(gen.id) - 1);
        renderBinder();
      });
      byId('binderNext').addEventListener('click', () => {
        const gen = activeGen();
        setPage(gen.id, currentPage(gen.id) + 1);
        renderBinder();
      });
    }
    return true;
  }
  function renderBinder() {
    if (!ensureBinderUi() || !species.length) return;
    const pokedex = byId('pokedex');
    const isBinder = mode === 'binder';
    pokedex.classList.toggle('pokedexBinderMode', isBinder);
    document.querySelectorAll('[data-pokedex-view]').forEach(button => button.classList.toggle('active', button.dataset.pokedexView === mode));
    if (!isBinder) return;

    const gen = activeGen();
    const genSpecies = species.filter(mon => mon.id >= gen.from && mon.id <= gen.to);
    const maxPage = Math.max(0, Math.ceil(genSpecies.length / 9) - 1);
    let page = Math.min(currentPage(gen.id), maxPage);
    setPage(gen.id, page);
    const pageMons = genSpecies.slice(page * 9, page * 9 + 9);
    const cards = collectionCardsByKey();
    const sheet = byId('binderSheet');
    const text = byId('binderPageText');
    if (text) text.textContent = `${gen.label} ${gen.region} - Binder-Seite ${page + 1} / ${maxPage + 1}`;
    if (byId('binderPrev')) byId('binderPrev').disabled = page <= 0;
    if (byId('binderNext')) byId('binderNext').disabled = page >= maxPage;
    sheet.innerHTML = pageMons.map(mon => {
      const assigned = assignedKeys(mon.id).map(key => cards.get(key)).filter(Boolean);
      const first = assigned[0];
      const mainImage = first?.image || '';
      const mini = assigned.slice(0, 5).map(card => card.image ? `<img src="${card.image}" alt="${escapeHtml(card.title)}">` : '').join('');
      const title = first ? escapeHtml(first.title) : 'Noch keine Karte zugeordnet';
      const details = first ? `${escapeHtml(first.number)} ${escapeHtml(first.setCode)} ${first.language ? '- ' + escapeHtml(first.language) : ''}` : '';
      return `<div class="binderPocket">
        <div class="binderHeader"><div class="binderMon" title="${displayName(mon.name)}">${displayName(mon.name)}</div><div class="binderNo">#${String(mon.id).padStart(4, '0')}</div></div>
        <img class="binderArt" src="${imageUrl(mon.id)}" alt="">
        <div class="binderCardMain">${mainImage ? `<img src="${mainImage}" alt="${title}">` : `<div class="binderEmpty">${displayName(mon.name)}<br>keine Karte zugeordnet</div>`}</div>
        <div class="binderFooter"><div class="binderCardTitle">${title}</div>${details ? `<div class="small">${details}</div>` : ''}<div class="binderMiniRow">${mini}${assigned.length > 1 ? `<span class="binderCount">+${assigned.length - 1}</span>` : ''}</div></div>
      </div>`;
    }).join('');
  }
  async function init() {
    try {
      species = await loadSpecies();
    } catch (err) {
      console.warn('Binder Pokedex konnte nicht laden', err);
    }
    const ready = ensureBinderUi();
    if (ready) renderBinder();
  }
  function scheduleRender() {
    setTimeout(renderBinder, 80);
    setTimeout(renderBinder, 350);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-pokedex-gen], .navBtn, [data-assign-id], #pokedexAssignClose')) scheduleRender();
  });
  document.addEventListener('change', event => {
    if (event.target.closest('[data-card-key], [data-pokedex-id]')) scheduleRender();
  });
  window.addEventListener('storage', event => {
    if ([ASSIGN_KEY, 'cw_collection', 'cw_collections_v2', MODE_KEY].includes(event.key)) scheduleRender();
  });

  const boot = () => {
    init();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (ensureBinderUi() || tries > 30) {
        clearInterval(timer);
        renderBinder();
      }
    }, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
