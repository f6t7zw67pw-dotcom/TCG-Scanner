// Loads the full German -> English Pokemon name DB into Card Wizard Pro localStorage.
// Include this script after the main app script.
(function () {
  const STORAGE_KEY = 'cw_pokemon';
  const RELOAD_KEY = 'cw_pokemon_full_db_reload_done';

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
    return {
      originalName: cardField(cardEl, 'originalName')?.value || '',
      cardmarketName: cardField(cardEl, 'cardmarketName')?.value || '',
      fullNumber: cardField(cardEl, 'fullNumber')?.value || '',
      searchNumber: cardField(cardEl, 'fullNumber')?.value || '',
      setCode: cardField(cardEl, 'setCode')?.value || '',
      setName: cardField(cardEl, 'setName')?.value || '',
      cardVersion: cardField(cardEl, 'cardVersion')?.value || '',
      condition: cardField(cardEl, 'condition')?.value || 'Near Mint'
    };
  }

  function buildMultiUrl(card) {
    if (typeof window.buildCMUrlFrom !== 'function') return '';
    const url = window.buildCMUrlFrom(card);
    if (!url) return '';
    const minCondition = conditionParam(card.condition);
    if (!minCondition) return url;
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}minCondition=${encodeURIComponent(minCondition)}`;
  }

  function refreshCardUrl(cardEl) {
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

    if (typeof window.cropDataURL === 'function' && !window.cropDataURL.__enhanced) {
      const enhanced = function (canvas, x, y, w, h) {
        return enhanceCropDataUrl(canvas, x, y, w, h);
      };
      enhanced.__enhanced = true;
      window.cropDataURL = enhanced;
    }
  }

  async function callCardSearch(scan) {
    return window.searchTcgCards(scan);
  }

  function applyMatchToCard(cardEl, match) {
    triggerInput(cardField(cardEl, 'originalName'), match.name || '');
    triggerInput(cardField(cardEl, 'cardmarketName'), match.cardmarketName || match.name || '');
    triggerInput(cardField(cardEl, 'fullNumber'), match.number || '');
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
        triggerInput(cardField(cardEl, 'fullNumber'), found.fullNumber || found.number || '');
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
      if (status) status.textContent = `Pokemon-DB geladen: ${result.count} Namen.`;

      if (!result.hadFullDb && sessionStorage.getItem(RELOAD_KEY) !== '1') {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      }
    } catch (err) {
      installMultiEnhancements();
      if (status) status.textContent = `Pokemon-DB konnte nicht geladen werden: ${err.message}`;
    }
  });
})();
