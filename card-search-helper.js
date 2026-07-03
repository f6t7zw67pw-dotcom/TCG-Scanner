// Sends richer scan context to the catalog search, auto-starts matches after scan and stabilizes Cardmarket fields.
(function () {
  if (window.__cwCardSearchHelper) return;
  window.__cwCardSearchHelper = true;

  const JP_NAME_OVERRIDES = {
    'ママンボウ': 'Alomomola'
  };
  const englishNameCache = new Map();

  function text(value) {
    return String(value || '').trim();
  }
  function hasAsianText(value) {
    return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(value || ''));
  }
  function toCardmarketName(value) {
    return text(value)
      .replace(/\s+ex$/i, '-ex')
      .replace(/\s+EX$/i, '-EX')
      .replace(/\s+V$/i, '-V')
      .replace(/\s+GX$/i, '-GX');
  }
  function latinFallbackName(value) {
    const clean = text(value);
    return JP_NAME_OVERRIDES[clean] || '';
  }
  function activeLanguageCode() {
    return text(document.querySelector('#langChips .chip.active')?.dataset?.code || '');
  }
  function activeLanguageLabel() {
    return text(document.querySelector('#langChips .chip.active')?.dataset?.label || '');
  }
  function lastScanCard() {
    const cards = Array.isArray(window.__cwLastScanLanguagePayload?.cards) ? window.__cwLastScanLanguagePayload.cards : [];
    return cards[0] || {};
  }
  function singleDomContext() {
    return {
      originalName: text(document.getElementById('originalName')?.value),
      cardmarketName: text(document.getElementById('cardmarketName')?.value),
      fullNumber: text(document.getElementById('fullNumber')?.value),
      searchNumber: text(document.getElementById('searchNumber')?.value),
      setCode: text(document.getElementById('setCode')?.value),
      setName: text(document.getElementById('setName')?.value),
      languageCode: activeLanguageCode(),
      language: activeLanguageLabel()
    };
  }
  function likelyEnglish(value) {
    return /^[A-Za-z0-9 .:'’&+\-]+$/.test(text(value));
  }
  function enrichSearchBody(body) {
    const scan = lastScanCard();
    const dom = singleDomContext();
    const next = { ...(body || {}) };

    const originalName = text(next.originalName || dom.originalName || scan.originalName || scan.visibleTitle || next.name);
    const rawCardmarket = text(next.cardmarketName || dom.cardmarketName || scan.cardmarketName || scan.englishName || next.name);
    const mapped = latinFallbackName(rawCardmarket) || latinFallbackName(originalName);
    const cardmarketName = hasAsianText(rawCardmarket) && mapped ? mapped : rawCardmarket;
    const englishName = text(next.englishName || scan.englishName || mapped || (likelyEnglish(cardmarketName) ? cardmarketName : ''));
    const visibleTitle = text(next.visibleTitle || scan.visibleTitle || (hasAsianText(originalName) ? originalName : ''));
    const fullNumber = text(next.fullNumber || dom.fullNumber || scan.fullNumber || next.number);
    const searchNumber = text(next.searchNumber || dom.searchNumber || scan.searchNumber || fullNumber.split('/')[0] || next.number);

    next.originalName = originalName;
    next.cardmarketName = cardmarketName;
    next.englishName = englishName;
    next.visibleTitle = visibleTitle;
    next.name = text(next.name || cardmarketName || englishName || originalName || visibleTitle);
    next.number = text(next.number || fullNumber || searchNumber);
    next.fullNumber = fullNumber;
    next.searchNumber = searchNumber;
    next.setCode = text(next.setCode || dom.setCode || scan.setCode);
    next.setName = text(next.setName || dom.setName || scan.setName);
    next.languageCode = text(next.languageCode || dom.languageCode || scan.languageCode);
    next.language = text(next.language || dom.language || scan.language);
    next.languageGuess = text(next.languageGuess || scan.languageGuess || scan.language);
    return next;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }
  async function englishNameFromPokemonSpecies(dexId) {
    if (!dexId) return '';
    const key = `species:${dexId}`;
    if (englishNameCache.has(key)) return englishNameCache.get(key);
    const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(dexId)}`);
    const name = text((data?.names || []).find((item) => item.language?.name === 'en')?.name || data?.name || '');
    const clean = name ? name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ') : '';
    englishNameCache.set(key, clean);
    return clean;
  }
  async function englishNameForCard(card) {
    if (!card) return '';
    const direct = text(card.cardmarketName || card.englishName || '');
    if (direct && !hasAsianText(direct)) return direct;
    const local = latinFallbackName(card.name) || latinFallbackName(card.cardmarketName);
    if (local) return local;

    const sourceId = text(card.sourceId || '').replace(/^tcgdex-[a-z-]+-/i, '');
    if (!sourceId) return '';
    const key = `tcgdex-en:${sourceId}`;
    if (englishNameCache.has(key)) return englishNameCache.get(key);

    const detail = await fetchJson(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(sourceId)}`);
    let name = text(detail?.name || '');
    if (!name || hasAsianText(name)) {
      const dexId = Array.isArray(detail?.dexId) ? detail.dexId[0] : detail?.dexId;
      name = await englishNameFromPokemonSpecies(dexId);
    }
    englishNameCache.set(key, name || '');
    return name || '';
  }
  function selectedMatchCard(button) {
    const item = button?.closest('.matchItem');
    const box = button?.closest('.matchBox');
    if (!item || !box) return null;
    const items = Array.from(box.querySelectorAll('.matchItem'));
    const index = items.indexOf(item);
    const cards = Array.isArray(window.__cwLastCardSearchResponse?.cards) ? window.__cwLastCardSearchResponse.cards : [];
    return index >= 0 ? cards[index] : null;
  }
  function setInputValue(input, value) {
    if (!input || !value) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function repairCardmarketFields(card) {
    if (!card) return;
    const cardmarket = document.getElementById('cardmarketName');
    const setName = document.getElementById('setName');
    const current = text(cardmarket?.value);
    const english = await englishNameForCard(card);
    if (english && (!current || hasAsianText(current) || current === text(card.name))) {
      setInputValue(cardmarket, toCardmarketName(english));
    }
    if (setName && card.cardmarketSetName && setName.value !== card.cardmarketSetName) {
      setInputValue(setName, card.cardmarketSetName);
    }
    if (typeof window.buildUrl === 'function') window.buildUrl();
  }
  function installMatchRepair() {
    if (document.documentElement.dataset.cwMatchRepair === '1') return;
    document.documentElement.dataset.cwMatchRepair = '1';
    document.addEventListener('click', (event) => {
      const button = event.target.closest('.matchItem .use');
      if (!button) return;
      const card = selectedMatchCard(button);
      setTimeout(() => repairCardmarketFields(card), 40);
      setTimeout(() => repairCardmarketFields(card), 450);
    }, true);
  }

  let lastAutoSearchSignature = '';
  function searchSignature() {
    const dom = singleDomContext();
    return [dom.originalName, dom.cardmarketName, dom.fullNumber, dom.searchNumber, dom.setCode, dom.setName].join('|');
  }
  function shouldAutoSearch() {
    const button = document.getElementById('singleTcgSearchBtn');
    const matches = document.getElementById('singleMatches');
    const sig = searchSignature();
    if (!button || !sig.replace(/\|/g, '')) return false;
    if (sig === lastAutoSearchSignature) return false;
    if (matches && /Treffer aus|Suche Treffer|Automatische Treffer/.test(matches.textContent || '')) return false;
    return true;
  }
  function autoSearchAfterScan() {
    [900, 1500, 2400, 3600].forEach((delay) => setTimeout(() => {
      if (!shouldAutoSearch()) return;
      const button = document.getElementById('singleTcgSearchBtn');
      lastAutoSearchSignature = searchSignature();
      button?.click();
    }, delay));
  }

  function installFetchPatch() {
    if (window.fetch.__cwCardSearchPatched) return;
    const originalFetch = window.fetch.bind(window);
    const patched = async function (input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (String(url).includes('/api/card-search') && init?.body) {
        try {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
          init = { ...init, body: JSON.stringify(enrichSearchBody(body)) };
        } catch {}
      }
      const response = await originalFetch(input, init);
      if (String(url).includes('/api/card-search')) {
        try {
          window.__cwLastCardSearchResponse = await response.clone().json();
          setTimeout(enhanceMatchUi, 80);
          setTimeout(enhanceMatchUi, 350);
        } catch {}
      }
      if (String(url).includes('/api/scan')) autoSearchAfterScan();
      return response;
    };
    patched.__cwCardSearchPatched = true;
    window.fetch = patched;
  }
  function imageFallbacks(src) {
    const list = [];
    const clean = text(src);
    if (!clean) return list;
    for (const ext of ['png', 'webp', 'jpg']) {
      list.push(clean.replace(/\/(low|high)\.(png|webp|jpg)$/i, `/low.${ext}`));
      list.push(clean.replace(/\/(low|high)\.(png|webp|jpg)$/i, `/high.${ext}`));
    }
    return Array.from(new Set(list.filter((item) => item && item !== clean)));
  }
  function attachImageFallback(img) {
    if (!img || img.dataset.cwImageFallback === '1') return;
    img.dataset.cwImageFallback = '1';
    img.dataset.cwFallbacks = JSON.stringify(imageFallbacks(img.getAttribute('src')));
    img.addEventListener('error', () => {
      let fallbacks = [];
      try { fallbacks = JSON.parse(img.dataset.cwFallbacks || '[]'); } catch {}
      const next = fallbacks.shift();
      img.dataset.cwFallbacks = JSON.stringify(fallbacks);
      if (next) img.src = next;
      else {
        img.alt = 'Kein Bild verfuegbar';
        img.style.opacity = '0.35';
      }
    });
  }
  function enhanceMatchUi() {
    document.querySelectorAll('.matchBox > b').forEach((title) => {
      title.textContent = title.textContent.replace('Treffer aus Pokémon TCG API', 'Treffer aus Katalog/API');
    });
    document.querySelectorAll('.matchItem img').forEach(attachImageFallback);
  }
  function loadHelper(src, flag, attr) {
    if (window[flag] || document.querySelector(`script[data-${attr}="1"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset[attr.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = '1';
    document.head.appendChild(script);
  }
  function installObserver() {
    if (window.__cwCardSearchObserver) return;
    window.__cwCardSearchObserver = new MutationObserver(enhanceMatchUi);
    window.__cwCardSearchObserver.observe(document.body, { childList: true, subtree: true });
  }
  function install() {
    installFetchPatch();
    installObserver();
    installMatchRepair();
    enhanceMatchUi();
    loadHelper('set-db-helper.js', '__cwSetDbHelper', 'cw-set-db-helper');
    loadHelper('mobile-input-helper.js', '__cwMobileInputHelper', 'cw-mobile-input-helper');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
  });
})();
