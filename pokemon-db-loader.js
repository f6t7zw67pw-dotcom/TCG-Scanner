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

  function cardInput(cardEl, key) {
    return cardEl.querySelector(`input[data-k="${key}"]`);
  }

  function readCardFromDom(cardEl) {
    return {
      originalName: cardInput(cardEl, 'originalName')?.value || '',
      cardmarketName: cardInput(cardEl, 'cardmarketName')?.value || '',
      fullNumber: cardInput(cardEl, 'fullNumber')?.value || '',
      searchNumber: cardInput(cardEl, 'fullNumber')?.value || '',
      setCode: cardInput(cardEl, 'setCode')?.value || '',
      setName: cardInput(cardEl, 'setName')?.value || ''
    };
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
    triggerInput(cardInput(cardEl, 'originalName'), match.name || '');
    triggerInput(cardInput(cardEl, 'cardmarketName'), match.cardmarketName || match.name || '');
    triggerInput(cardInput(cardEl, 'fullNumber'), match.number || '');
    triggerInput(cardInput(cardEl, 'setCode'), match.setCode || '');
    triggerInput(cardInput(cardEl, 'setName'), match.setName || '');

    const urlBox = cardEl.querySelector('.url');
    if (urlBox && typeof window.buildCMUrlFrom === 'function') {
      urlBox.textContent = window.buildCMUrlFrom({
        originalName: match.name,
        cardmarketName: match.cardmarketName || match.name,
        fullNumber: match.number,
        searchNumber: String(match.number || '').split('/')[0],
        setCode: match.setCode,
        setName: match.setName
      }) || urlBox.textContent;
    }

    const toast = window.toast;
    if (typeof toast === 'function') toast('Treffer übernommen');
  }

  function renderDomMatches(cardEl, cards) {
    const target = cardEl.querySelector('[id^="multiMatches"]');
    if (!target) return;
    target.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'matchBox';
    box.innerHTML = `<b>Automatische Treffer (${cards.length})</b>`;
    if (!cards.length) box.innerHTML += '<div class="small">Keine sicheren Treffer. Felder prüfen oder Crop neu scannen.</div>';

    cards.forEach((card) => {
      const item = document.createElement('div');
      item.className = 'matchItem';
      item.innerHTML = `<img src="${card.imageSmall || ''}"><div><b>${card.name || '-'}</b><div class="small">${card.setName || '-'} · ${card.setCode || '-'} · ${card.number || '-'} · ${card.rarity || ''}</div><div class="actions"><button class="miniBtn use" type="button">Übernehmen</button>${card.imageLarge ? '<button class="miniBtn miniGhost img" type="button">Bild</button>' : ''}</div></div>`;
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

  function enhanceMultiCard(cardEl) {
    if (cardEl.dataset.multiEnhanced === '1') return;
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
      rescan.textContent = 'Scan läuft...';
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'single', image: cropImg.src, extraText: document.getElementById('visibleText')?.value || '' })
        });
        const data = await response.json();
        if (!data.ok) throw new Error(data.error || 'Scan fehlgeschlagen');
        const found = (data.cards || [])[0] || {};
        triggerInput(cardInput(cardEl, 'originalName'), found.originalName || found.name || '');
        triggerInput(cardInput(cardEl, 'cardmarketName'), found.cardmarketName || (typeof window.buildCMName === 'function' ? window.buildCMName(found.originalName || found.name || '') : ''));
        triggerInput(cardInput(cardEl, 'fullNumber'), found.fullNumber || found.number || '');
        triggerInput(cardInput(cardEl, 'setCode'), window.fixSetCode(found.setCode || '', found.setName || ''));
        triggerInput(cardInput(cardEl, 'setName'), found.setName || '');
        cardEl.dataset.autoSearchDone = '0';
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

    if (typeof window.renderMulti === 'function') {
      const originalRenderMulti = window.renderMulti;
      window.renderMulti = function (...args) {
        const result = originalRenderMulti.apply(this, args);
        setTimeout(enhanceVisibleMultiCards, 120);
        return result;
      };
    }

    const multiResults = document.getElementById('multiResults');
    if (multiResults) {
      new MutationObserver(() => setTimeout(enhanceVisibleMultiCards, 80)).observe(multiResults, { childList: true, subtree: true });
    }

    const oldStatus = document.getElementById('scanStatus');
    if (oldStatus && oldStatus.textContent.includes('Jetzt Treffer suchen')) {
      setTimeout(enhanceVisibleMultiCards, 120);
    }
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
