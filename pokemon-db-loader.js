// Loads the full German -> English Pokemon name DB into Card Wizard Pro localStorage.
// Include this script after the main app script.
(function () {
  const STORAGE_KEY = 'cw_pokemon';
  const RELOAD_KEY = 'cw_pokemon_full_db_reload_done';
  const COLLECTIONS_KEY = 'cw_collections_v2';
  const LEGACY_COLLECTION_KEY = 'cw_collection';

  function mergePokemonDb(existing, incoming) {
    return { ...(existing || {}), ...(incoming || {}) };
  }

  function triggerInput(input, value) {
    if (!input) return;
    input.value = value || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function cardField(cardEl, key) {
    return cardEl.querySelector(`input[data-k="${key}"],select[data-k="${key}"]`);
  }

  function padCardNumber(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    const parts = raw.split('/');
    const left = parts[0].replace(/\s+/g, '');
    const padded = /^\d{1,2}$/.test(left) ? left.padStart(3, '0') : left;
    if (parts.length <= 1) return padded;
    return `${padded}/${parts.slice(1).join('/').replace(/\s+/g, '')}`;
  }

  function searchNumberFrom(value) {
    return padCardNumber(String(value || '').split('/')[0]);
  }

  function cleanPrice(value) {
    const match = String(value || '').replace(/EUR/ig, '').replace(/€/g, '').match(/\d+(?:[,.]\d{1,2})?/);
    return match ? match[0].replace('.', ',') : '';
  }

  function priceNumber(value) {
    return parseFloat(cleanPrice(value).replace(',', '.')) || 0;
  }

  function money(value) {
    return `${value.toFixed(2).replace('.', ',')} Euro`;
  }

  function normalizeCondition(value) {
    const v = String(value || '').trim().toLowerCase();
    if (v.includes('excellent')) return 'Excellent';
    if (v.includes('good')) return 'Good';
    if (v.includes('played')) return 'Played';
    if (v.includes('poor')) return 'Poor';
    if (v.includes('near') || v.includes('mint')) return 'Near Mint';
    return value || 'Near Mint';
  }

  function inferCardVersion(card) {
    const rarity = String(card?.rarity || card?.cardType || '').toLowerCase();
    const name = String(card?.name || card?.originalName || '').toLowerCase();
    if (card?.cardVersion) return card.cardVersion;
    if (rarity.includes('special illustration')) return 'V3';
    if (rarity.includes('illustration') || rarity.includes('full art')) return 'V2';
    if (rarity.includes('gold') || rarity.includes('secret') || rarity.includes('hyper')) return 'V4';
    if (/\b(ex|gx|v)\b/.test(name)) return 'V1';
    return '';
  }

  function cardVersionLabel(value) {
    return ({ '': 'Normal', V1: 'EX / V', V2: 'IR / Full Art', V3: 'SIR', V4: 'Gold / Secret' })[value || ''] || 'Normal';
  }

  function conditionParam(value) {
    return ({
      'Near Mint': '2',
      Excellent: '3',
      Good: '4',
      Played: '5',
      Poor: '7'
    })[normalizeCondition(value)] || '';
  }

  function readCardFromDom(cardEl) {
    const fullNumber = padCardNumber(cardField(cardEl, 'fullNumber')?.value || '');
    return {
      originalName: cardField(cardEl, 'originalName')?.value || '',
      cardmarketName: cardField(cardEl, 'cardmarketName')?.value || '',
      fullNumber,
      searchNumber: searchNumberFrom(fullNumber),
      setCode: cardField(cardEl, 'setCode')?.value || '',
      setName: cardField(cardEl, 'setName')?.value || '',
      cardVersion: cardField(cardEl, 'cardVersion')?.value || '',
      condition: cardField(cardEl, 'condition')?.value || 'Near Mint',
      price: cleanPrice(cardField(cardEl, 'cmPrice')?.value || '')
    };
  }

  function buildMultiUrl(card) {
    if (typeof window.buildCMUrlFrom !== 'function') return '';
    const fixed = { ...card, fullNumber: padCardNumber(card.fullNumber || card.number || ''), searchNumber: searchNumberFrom(card.searchNumber || card.fullNumber || card.number || '') };
    const url = window.buildCMUrlFrom(fixed);
    if (!url) return '';
    const minCondition = conditionParam(card.condition);
    if (!minCondition) return url;
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}minCondition=${encodeURIComponent(minCondition)}`;
  }

  function refreshCardUrl(cardEl) {
    const fullNumberInput = cardField(cardEl, 'fullNumber');
    if (fullNumberInput) fullNumberInput.value = padCardNumber(fullNumberInput.value);
    const urlBox = cardEl.querySelector('.url');
    if (!urlBox) return '';
    const url = buildMultiUrl(readCardFromDom(cardEl));
    urlBox.textContent = url || 'Noch nicht genug Daten.';
    return url;
  }

  function enhanceCropDataUrl(canvas, x, y, w, h) {
    const insetX = Math.max(1, w * 0.018);
    const insetY = Math.max(1, h * 0.018);
    const sx = x + insetX;
    const sy = y + insetY;
    const sw = Math.max(1, w - insetX * 2);
    const sh = Math.max(1, h - insetY * 2);
    const scale = Math.min(2.2, Math.max(1, 760 / Math.max(sw, sh)));
    const out = document.createElement('canvas');
    out.width = Math.round(sw * scale);
    out.height = Math.round(sh * scale);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = 'brightness(1.04) contrast(1.18) saturate(1.06)';
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);

    try {
      const image = ctx.getImageData(0, 0, out.width, out.height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.04 + 2);
        data[i + 1] = Math.min(255, data[i + 1] * 1.04 + 2);
        data[i + 2] = Math.min(255, data[i + 2] * 1.04 + 2);
      }
      ctx.putImageData(image, 0, 0);
    } catch {}

    return out.toDataURL('image/jpeg', 0.92);
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }

  function baseCollectionStore() {
    return { selectedId: 'default', collections: [{ id: 'default', name: 'Hauptsammlung', cards: [] }] };
  }

  function normalizeStore(store) {
    const next = store && Array.isArray(store.collections) ? store : baseCollectionStore();
    if (!next.collections.length) next.collections.push({ id: 'default', name: 'Hauptsammlung', cards: [] });
    next.collections = next.collections.map((c, index) => ({
      id: c.id || `collection-${Date.now()}-${index}`,
      name: c.name || 'Sammlung',
      cards: Array.isArray(c.cards) ? c.cards : []
    }));
    if (!next.collections.some((c) => c.id === next.selectedId)) next.selectedId = next.collections[0].id;
    return next;
  }

  function getCollectionStore() {
    let store = normalizeStore(readJson(COLLECTIONS_KEY, null));
    const legacy = readJson(LEGACY_COLLECTION_KEY, []);
    if (!readJson(COLLECTIONS_KEY, null) && Array.isArray(legacy) && legacy.length) {
      store.collections[0].cards = legacy;
      saveCollectionStore(store);
    }
    return store;
  }

  function saveCollectionStore(store) {
    const normalized = normalizeStore(store);
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(normalized));
    syncLegacyCollection(normalized);
    return normalized;
  }

  function selectedCollection(store = getCollectionStore()) {
    return store.collections.find((c) => c.id === store.selectedId) || store.collections[0];
  }

  function syncLegacyCollection(store = getCollectionStore()) {
    const selected = selectedCollection(store);
    localStorage.setItem(LEGACY_COLLECTION_KEY, JSON.stringify(selected.cards || []));
  }

  function addCardsToSelected(cards) {
    const store = getCollectionStore();
    const selected = selectedCollection(store);
    selected.cards = [...cards, ...(selected.cards || [])];
    saveCollectionStore(store);
    renderCollectionTools();
    renderEnhancedCollection();
  }

  function imageFromSingleDom() {
    return document.querySelector('#imageBox img.thumb')?.src || readJson('cw_last_image', '') || '';
  }

  function readSingleCard() {
    const fullNumber = padCardNumber(document.getElementById('fullNumber')?.value || '');
    const url = typeof window.buildUrl === 'function' ? window.buildUrl() : (document.getElementById('cmUrl')?.textContent || '');
    return {
      id: Date.now(),
      originalName: document.getElementById('originalName')?.value || '',
      cardmarketName: document.getElementById('cardmarketName')?.value || '',
      fullNumber,
      searchNumber: searchNumberFrom(fullNumber),
      setCode: document.getElementById('setCode')?.value || '',
      setName: document.getElementById('setName')?.value || '',
      price: cleanPrice(document.getElementById('sellPrice')?.value || ''),
      ebayPrice: cleanPrice(document.getElementById('ebayPrice')?.value || ''),
      shipping: cleanPrice(document.getElementById('shipping')?.value || ''),
      condition: document.getElementById('condition')?.value || 'Near Mint',
      cardVersion: document.querySelector('#typeChips .chip.active')?.dataset.ver || '',
      lotName: '',
      image: imageFromSingleDom(),
      cardmarketUrl: appendConditionToUrl(url, document.getElementById('condition')?.value || 'Near Mint'),
      createdAt: new Date().toISOString()
    };
  }

  function appendConditionToUrl(url, condition) {
    if (!url || url.includes('Noch nicht genug')) return '';
    const minCondition = conditionParam(condition);
    if (!minCondition || url.includes('minCondition=')) return url;
    return `${url}${url.includes('?') ? '&' : '?'}minCondition=${encodeURIComponent(minCondition)}`;
  }

  function readMultiCard(cardEl, index) {
    const card = readCardFromDom(cardEl);
    return {
      id: Date.now() + index,
      ...card,
      price: cleanPrice(card.price || ''),
      ebayPrice: cleanPrice(document.getElementById('lotEbayPrice')?.value || ''),
      shipping: cleanPrice(document.getElementById('lotShipping')?.value || ''),
      lotName: document.getElementById('lotName')?.value || '',
      image: cardEl.querySelector('img.thumb')?.src || '',
      cardmarketUrl: refreshCardUrl(cardEl),
      createdAt: new Date().toISOString(),
      multiLot: true
    };
  }

  function saveSingleEnhanced() {
    const card = readSingleCard();
    if (!card.originalName && !card.cardmarketName && !card.fullNumber) {
      if (typeof window.toast === 'function') window.toast('Keine Karte zum Speichern');
      return;
    }
    addCardsToSelected([card]);
    if (typeof window.toast === 'function') window.toast('Karte gespeichert');
  }

  function saveMultiEnhanced() {
    const cards = [];
    document.querySelectorAll('#multiResults .resultCard').forEach((cardEl, index) => {
      const selected = cardEl.querySelector('.sel');
      if (selected && !selected.checked) return;
      cards.push(readMultiCard(cardEl, index));
    });
    if (!cards.length) {
      if (typeof window.toast === 'function') window.toast('Keine Multi-Karte ausgewaehlt');
      return;
    }
    addCardsToSelected(cards);
    if (typeof window.toast === 'function') window.toast(`${cards.length} Karten gespeichert`);
  }

  function ensureScannerCollectionPicker() {
    if (document.getElementById('cwCollectionPicker')) return;
    const anchor = document.getElementById('scanStatus');
    if (!anchor) return;
    const picker = document.createElement('div');
    picker.id = 'cwCollectionPicker';
    picker.className = 'card';
    picker.style.marginTop = '14px';
    picker.innerHTML = `<h2>Sammlung fuer Scan</h2><label>Speichern in</label><select id="cwScanCollection"></select><div class="row"><div><label>Neue Sammlung</label><input id="cwNewCollectionName" placeholder="z. B. Binder 1"></div><div><label>&nbsp;</label><button class="btn ghost" id="cwCreateCollection" type="button">Erstellen</button></div></div><div class="hint" id="cwCollectionHint"></div>`;
    anchor.parentNode.insertBefore(picker, anchor.nextSibling);
    document.getElementById('cwScanCollection').onchange = (e) => selectCollection(e.target.value);
    document.getElementById('cwCreateCollection').onclick = createCollectionFromInput;
    renderCollectionTools();
  }

  function ensureCollectionFilterUi() {
    const section = document.getElementById('collection');
    if (!section || document.getElementById('cwCollectionFilters')) return;
    const search = document.getElementById('search');
    const box = document.createElement('div');
    box.id = 'cwCollectionFilters';
    box.innerHTML = `<label>Sammlung</label><select id="cwViewCollection"></select><div class="row"><div><label>SetCode Filter</label><input id="cwFilterSet" placeholder="z. B. SV8A"></div><div><label>Zustand</label><select id="cwFilterCondition"><option value="">Alle</option><option>Near Mint</option><option>Excellent</option><option>Good</option><option>Played</option><option>Poor</option></select></div></div><div class="row"><div><label>Kartentyp</label><select id="cwFilterType"><option value="">Alle</option><option value="Normal">Normal</option><option value="V1">EX / V</option><option value="V2">IR / Full Art</option><option value="V3">SIR</option><option value="V4">Gold / Secret</option></select></div><div><label>Preis ab</label><input id="cwFilterMin" inputmode="decimal" placeholder="0,00"></div></div><div class="row"><div><label>Preis bis</label><input id="cwFilterMax" inputmode="decimal" placeholder="999,00"></div><div><label>&nbsp;</label><button class="btn ghost" id="cwResetFilters" type="button">Filter zuruecksetzen</button></div></div><div class="ok" id="cwCollectionValue">Wert: 0,00 Euro</div>`;
    if (search) search.parentNode.insertBefore(box, search.nextSibling);
    ['cwViewCollection', 'cwFilterSet', 'cwFilterCondition', 'cwFilterType', 'cwFilterMin', 'cwFilterMax'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.oninput = el.onchange = () => {
        if (id === 'cwViewCollection') selectCollection(el.value);
        renderEnhancedCollection();
      };
    });
    const reset = document.getElementById('cwResetFilters');
    if (reset) reset.onclick = () => {
      ['cwFilterSet', 'cwFilterMin', 'cwFilterMax'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['cwFilterCondition', 'cwFilterType'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      renderEnhancedCollection();
    };
  }

  function renderCollectionTools() {
    const store = getCollectionStore();
    const selected = selectedCollection(store);
    ['cwScanCollection', 'cwViewCollection'].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      const current = select.value || store.selectedId;
      select.innerHTML = store.collections.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
      select.value = store.collections.some((c) => c.id === current) ? current : store.selectedId;
    });
    const hint = document.getElementById('cwCollectionHint');
    if (hint) hint.textContent = `${selected.name}: ${(selected.cards || []).length} Karten, Wert ${money(totalValue(selected.cards || []))}`;
  }

  function createCollectionFromInput() {
    const input = document.getElementById('cwNewCollectionName');
    const name = (input?.value || '').trim();
    if (!name) return;
    const store = getCollectionStore();
    const id = `collection-${Date.now()}`;
    store.collections.push({ id, name, cards: [] });
    store.selectedId = id;
    if (input) input.value = '';
    saveCollectionStore(store);
    renderCollectionTools();
    renderEnhancedCollection();
    if (typeof window.toast === 'function') window.toast('Sammlung erstellt');
  }

  function selectCollection(id) {
    const store = getCollectionStore();
    if (store.collections.some((c) => c.id === id)) store.selectedId = id;
    saveCollectionStore(store);
    renderCollectionTools();
    renderEnhancedCollection();
  }

  function totalValue(cards) {
    return cards.reduce((sum, card) => sum + priceNumber(card.price || card.cmPrice), 0);
  }

  function filteredCards(cards) {
    const search = (document.getElementById('search')?.value || '').toLowerCase();
    const set = (document.getElementById('cwFilterSet')?.value || '').trim().toLowerCase();
    const condition = document.getElementById('cwFilterCondition')?.value || '';
    const type = document.getElementById('cwFilterType')?.value || '';
    const minRaw = document.getElementById('cwFilterMin')?.value || '';
    const maxRaw = document.getElementById('cwFilterMax')?.value || '';
    const min = minRaw ? priceNumber(minRaw) : null;
    const max = maxRaw ? priceNumber(maxRaw) : null;
    return cards.filter((card) => {
      const text = JSON.stringify(card).toLowerCase();
      const price = priceNumber(card.price || card.cmPrice);
      if (search && !text.includes(search)) return false;
      if (set && !String(card.setCode || '').toLowerCase().includes(set)) return false;
      if (condition && normalizeCondition(card.condition) !== condition) return false;
      if (type) {
        const label = type === 'Normal' ? '' : type;
        if ((card.cardVersion || '') !== label) return false;
      }
      if (min !== null && price < min) return false;
      if (max !== null && price > max) return false;
      return true;
    });
  }

  function renderEnhancedCollection() {
    const list = document.getElementById('collectionList');
    if (!list) return;
    const store = getCollectionStore();
    const selected = selectedCollection(store);
    const cards = filteredCards(selected.cards || []);
    const valueBox = document.getElementById('cwCollectionValue');
    if (valueBox) valueBox.textContent = `${selected.name}: ${cards.length} Karten angezeigt · Gesamtwert ${money(totalValue(cards))}`;
    list.innerHTML = '';
    if (!cards.length) {
      list.innerHTML = '<div class="hint">Keine Karten fuer diese Auswahl.</div>';
      return;
    }
    cards.forEach((card) => {
      const item = document.createElement('div');
      item.className = 'item';
      const title = card.cardmarketName || card.originalName || 'Unbenannt';
      const price = cleanPrice(card.price || card.cmPrice);
      item.innerHTML = `<div class="preview">${card.image ? `<img class="thumb" src="${escapeAttr(card.image)}">` : ''}<div><b>${escapeHtml(title)}</b><div class="small">${escapeHtml(card.fullNumber || '')} · ${escapeHtml(card.setCode || '')} ${escapeHtml(card.setName || '')}</div><div class="small">${escapeHtml(normalizeCondition(card.condition || ''))} · ${escapeHtml(cardVersionLabel(card.cardVersion || ''))} · ${price ? `${escapeHtml(price)} Euro` : 'kein Preis'}</div>${card.lotName ? `<div class="small">${escapeHtml(card.lotName)}</div>` : ''}${card.cardmarketUrl ? `<a href="${escapeAttr(card.cardmarketUrl)}" target="_blank">Cardmarket oeffnen</a>` : ''}</div></div>`;
      list.appendChild(item);
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
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

    window.normalizeNumber = function (value) {
      const full = padCardNumber(value);
      return { full, search: searchNumberFrom(full) };
    };

    if (typeof window.buildCMUrlFrom === 'function' && !window.buildCMUrlFrom.__cwPadded) {
      const originalBuild = window.buildCMUrlFrom;
      const wrapped = function (card) {
        const fullNumber = padCardNumber(card?.fullNumber || card?.number || '');
        return originalBuild({ ...(card || {}), fullNumber, searchNumber: searchNumberFrom(card?.searchNumber || fullNumber) });
      };
      wrapped.__cwPadded = true;
      window.buildCMUrlFrom = wrapped;
    }

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

    window.liveNumber = function () {
      const fullInput = document.getElementById('fullNumber');
      const searchInput = document.getElementById('searchNumber');
      if (!fullInput || !searchInput) return;
      const full = padCardNumber(fullInput.value);
      searchInput.value = searchNumberFrom(full);
      if (typeof window.buildUrl === 'function') window.buildUrl();
    };

    const setCodeInput = document.getElementById('setCode');
    if (setCodeInput) setCodeInput.oninput = window.liveSet;
    const fullNumberInput = document.getElementById('fullNumber');
    if (fullNumberInput) {
      fullNumberInput.oninput = window.liveNumber;
      fullNumberInput.onchange = () => { fullNumberInput.value = padCardNumber(fullNumberInput.value); window.liveNumber(); };
      fullNumberInput.onblur = fullNumberInput.onchange;
    }
    const searchNumberInput = document.getElementById('searchNumber');
    if (searchNumberInput) {
      searchNumberInput.onchange = () => { searchNumberInput.value = searchNumberFrom(searchNumberInput.value); if (typeof window.buildUrl === 'function') window.buildUrl(); };
      searchNumberInput.onblur = searchNumberInput.onchange;
    }

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
          number: padCardNumber(scan.fullNumber || scan.searchNumber || scan.number || ''),
          setCode: scan.setCode || ''
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Kartensuche fehlgeschlagen');
      return data.cards || [];
    };

    if (typeof window.cropDataURL === 'function' && !window.cropDataURL.__enhanced) {
      const enhanced = function (canvas, x, y, w, h) {
        return enhanceCropDataUrl(canvas, x, y, w, h);
      };
      enhanced.__enhanced = true;
      window.cropDataURL = enhanced;
    }

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.onclick = saveSingleEnhanced;
    const saveMultiBtn = document.getElementById('saveMultiBtn');
    if (saveMultiBtn) saveMultiBtn.onclick = saveMultiEnhanced;
    const search = document.getElementById('search');
    if (search) search.oninput = renderEnhancedCollection;
    const clearAll = document.getElementById('clearAll');
    if (clearAll) clearAll.onclick = () => {
      if (!confirm('Aktuelle Sammlung wirklich loeschen?')) return;
      const store = getCollectionStore();
      selectedCollection(store).cards = [];
      saveCollectionStore(store);
      renderCollectionTools();
      renderEnhancedCollection();
    };
  }

  async function callCardSearch(scan) {
    return window.searchTcgCards(scan);
  }

  function applyMatchToCard(cardEl, match) {
    triggerInput(cardField(cardEl, 'originalName'), match.name || '');
    triggerInput(cardField(cardEl, 'cardmarketName'), match.cardmarketName || match.name || '');
    triggerInput(cardField(cardEl, 'fullNumber'), padCardNumber(match.number || ''));
    triggerInput(cardField(cardEl, 'setCode'), match.setCode || '');
    triggerInput(cardField(cardEl, 'setName'), match.setName || '');
    triggerInput(cardField(cardEl, 'cardVersion'), inferCardVersion(match));
    refreshCardUrl(cardEl);
    if (typeof window.toast === 'function') window.toast('Treffer uebernommen');
  }

  function renderDomMatches(cardEl, cards) {
    const target = cardEl.querySelector('[id^="multiMatches"]');
    if (!target) return;
    target.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'matchBox';
    box.innerHTML = `<b>Automatische Treffer (${cards.length})</b>`;
    if (!cards.length) box.innerHTML += '<div class="small">Keine sicheren Treffer. Felder pruefen oder Crop neu scannen.</div>';

    cards.forEach((card) => {
      const item = document.createElement('div');
      item.className = 'matchItem';
      item.innerHTML = `<img src="${card.imageSmall || ''}"><div><b>${card.name || '-'}</b><div class="small">${card.setName || '-'} - ${card.setCode || '-'} - ${card.number || '-'} - ${card.rarity || ''}</div><div class="actions"><button class="miniBtn use" type="button">Uebernehmen</button>${card.imageLarge ? '<button class="miniBtn miniGhost img" type="button">Bild</button>' : ''}</div></div>`;
      item.querySelector('.use').onclick = () => applyMatchToCard(cardEl, card);
      const imgButton = item.querySelector('.img');
      if (imgButton) imgButton.onclick = () => open(card.imageLarge, '_blank');
      box.appendChild(item);
    });

    target.appendChild(box);
  }

  async function autoSearchCard(cardEl) {
    if (cardEl.dataset.autoSearchDone === '1') return;
    const scan = readCardFromDom(cardEl);
    if (!scan.originalName && !scan.cardmarketName && !scan.fullNumber && !scan.setCode) return;
    cardEl.dataset.autoSearchDone = '1';
    const target = cardEl.querySelector('[id^="multiMatches"]');
    if (target) target.innerHTML = '<div class="matchBox">Automatische Treffer werden gesucht...</div>';

    try {
      renderDomMatches(cardEl, await callCardSearch(scan));
    } catch (err) {
      if (target) target.innerHTML = `<div class="matchBox">Treffer-Suche fehlgeschlagen: ${err.message}</div>`;
    }
  }

  function insertMultiControls(cardEl) {
    const urlLabel = Array.from(cardEl.querySelectorAll('label')).find((label) => label.textContent.trim() === 'Cardmarket-URL');
    if (!urlLabel || cardEl.querySelector('[data-cw-extra="multi-type-condition"]')) return;

    const wrap = document.createElement('div');
    wrap.dataset.cwExtra = 'multi-type-condition';
    wrap.innerHTML = `<div class="row"><div><label>Kartentyp</label><select data-k="cardVersion"><option value="">Normal</option><option value="V1">EX / V -> V1</option><option value="V2">IR / Full Art -> V2</option><option value="V3">SIR -> V3</option><option value="V4">Gold -> V4</option></select></div><div><label>Zustand</label><select data-k="condition"><option>Near Mint</option><option>Excellent</option><option>Good</option><option>Played</option><option>Poor</option></select></div></div>`;
    urlLabel.parentNode.insertBefore(wrap, urlLabel);

    const originalName = cardField(cardEl, 'originalName');
    const cardmarketName = cardField(cardEl, 'cardmarketName');
    if (originalName) {
      originalName.addEventListener('input', () => {
        if (typeof window.buildCMName === 'function') {
          const translated = window.buildCMName(originalName.value);
          if (translated) triggerInput(cardmarketName, translated);
        }
        cardEl.dataset.autoSearchDone = '0';
        refreshCardUrl(cardEl);
      });
    }

    cardEl.querySelectorAll('input[data-k],select[data-k]').forEach((field) => {
      if (field.dataset.k === 'fullNumber') {
        field.addEventListener('change', () => { field.value = padCardNumber(field.value); refreshCardUrl(cardEl); });
        field.addEventListener('blur', () => { field.value = padCardNumber(field.value); refreshCardUrl(cardEl); });
      }
      field.addEventListener('input', () => refreshCardUrl(cardEl));
      field.addEventListener('change', () => refreshCardUrl(cardEl));
    });
  }

  function enhanceMultiCard(cardEl) {
    insertMultiControls(cardEl);

    const scan = readCardFromDom(cardEl);
    if (cardField(cardEl, 'cardVersion') && !cardField(cardEl, 'cardVersion').value) {
      triggerInput(cardField(cardEl, 'cardVersion'), inferCardVersion(scan));
    }
    if (cardField(cardEl, 'condition')) {
      triggerInput(cardField(cardEl, 'condition'), normalizeCondition(scan.condition));
    }

    const openButton = cardEl.querySelector('.openM');
    if (openButton) openButton.onclick = () => {
      const url = refreshCardUrl(cardEl);
      if (url) open(url, '_blank');
    };
    const copyButton = cardEl.querySelector('.copyM');
    if (copyButton) copyButton.onclick = async () => {
      const url = refreshCardUrl(cardEl);
      if (url) {
        await navigator.clipboard.writeText(url);
        if (typeof window.toast === 'function') window.toast('URL kopiert');
      }
    };

    if (cardEl.dataset.multiEnhanced === '1') {
      refreshCardUrl(cardEl);
      return;
    }
    cardEl.dataset.multiEnhanced = '1';

    const actions = cardEl.querySelector('.actions');
    const cropImg = cardEl.querySelector('img.thumb');
    if (!actions || !cropImg) return;

    const rescan = document.createElement('button');
    rescan.className = 'btn ghost';
    rescan.type = 'button';
    rescan.textContent = 'Crop neu scannen';
    rescan.onclick = async () => {
      rescan.disabled = true;
      rescan.textContent = 'Scan laeuft...';
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'single', image: cropImg.src, extraText: document.getElementById('visibleText')?.value || '' })
        });
        const data = await response.json();
        if (!data.ok) throw new Error(data.error || 'Scan fehlgeschlagen');
        const found = (data.cards || [])[0] || {};
        triggerInput(cardField(cardEl, 'originalName'), found.originalName || found.name || '');
        triggerInput(cardField(cardEl, 'cardmarketName'), found.cardmarketName || (typeof window.buildCMName === 'function' ? window.buildCMName(found.originalName || found.name || '') : ''));
        triggerInput(cardField(cardEl, 'fullNumber'), padCardNumber(found.fullNumber || found.number || ''));
        triggerInput(cardField(cardEl, 'setCode'), window.fixSetCode(found.setCode || '', found.setName || ''));
        triggerInput(cardField(cardEl, 'setName'), found.setName || '');
        triggerInput(cardField(cardEl, 'cardVersion'), inferCardVersion(found));
        triggerInput(cardField(cardEl, 'condition'), normalizeCondition(found.condition));
        cardEl.dataset.autoSearchDone = '0';
        refreshCardUrl(cardEl);
        await autoSearchCard(cardEl);
      } catch (err) {
        const target = cardEl.querySelector('[id^="multiMatches"]');
        if (target) target.innerHTML = `<div class="matchBox">Neu-Scan fehlgeschlagen: ${err.message}</div>`;
      } finally {
        rescan.disabled = false;
        rescan.textContent = 'Crop neu scannen';
      }
    };

    actions.appendChild(rescan);
    refreshCardUrl(cardEl);
  }

  function enhanceVisibleMultiCards() {
    document.querySelectorAll('#multiResults .resultCard').forEach((cardEl) => {
      enhanceMultiCard(cardEl);
      setTimeout(() => autoSearchCard(cardEl), 80);
    });
  }

  function installMultiEnhancements() {
    if (window.__cwMultiEnhancementsInstalled) return;
    window.__cwMultiEnhancementsInstalled = true;

    const multiResults = document.getElementById('multiResults');
    if (multiResults) {
      new MutationObserver(() => setTimeout(enhanceVisibleMultiCards, 80)).observe(multiResults, { childList: true, subtree: true });
    }

    setTimeout(enhanceVisibleMultiCards, 120);
  }

  function installCollectionEnhancements() {
    ensureScannerCollectionPicker();
    ensureCollectionFilterUi();
    renderCollectionTools();
    renderEnhancedCollection();
    document.addEventListener('click', (event) => {
      if (event.target.closest('.navBtn')) setTimeout(() => { renderCollectionTools(); renderEnhancedCollection(); }, 120);
    });
    const exportJson = document.getElementById('exportJson');
    if (exportJson) exportJson.onclick = () => {
      const store = getCollectionStore();
      const selected = selectedCollection(store);
      downloadFile(`${selected.name || 'sammlung'}.json`, JSON.stringify(selected.cards || [], null, 2), 'application/json');
    };
    const exportCsv = document.getElementById('exportCsv');
    if (exportCsv) exportCsv.onclick = () => {
      const selected = selectedCollection(getCollectionStore());
      const rows = (selected.cards || []).map((card) => [card.originalName, card.cardmarketName, card.fullNumber, card.setCode, card.setName, card.condition, card.cardVersion, card.price].map((v) => String(v || '').replace(/;/g, ',')).join(';'));
      downloadFile(`${selected.name || 'sammlung'}.csv`, rows.join('\n'), 'text/csv');
    };
  }

  function downloadFile(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
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
      installMultiEnhancements();
      installCollectionEnhancements();
      if (status) status.textContent = `Pokemon-DB geladen: ${result.count} Namen.`;

      if (!result.hadFullDb && sessionStorage.getItem(RELOAD_KEY) !== '1') {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      }
    } catch (err) {
      installAppPatches();
      installMultiEnhancements();
      installCollectionEnhancements();
      if (status) status.textContent = `Pokemon-DB konnte nicht geladen werden: ${err.message}`;
    }
  });
})();
