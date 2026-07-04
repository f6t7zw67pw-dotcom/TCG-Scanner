// Sends richer scan context to the catalog search and stabilizes Cardmarket fields.
(function () {
  if (window.__cwCardSearchHelper) return;
  window.__cwCardSearchHelper = true;

  const JP_NAME_OVERRIDES = {
    'ママンボウ': 'Alomomola',
    'イベルタル': 'Yveltal',
    'レパルダス': 'Liepard',
    'イシズマイ': 'Dwebble',
    'サンダース': 'Jolteon',
    'ブースター': 'Flareon',
    'シャワーズ': 'Vaporeon',
    'エーフィ': 'Espeon',
    'ブラッキー': 'Umbreon',
    'リーフィア': 'Leafeon',
    'グレイシア': 'Glaceon',
    'ニンフィア': 'Sylveon',
    'ピカチュウ': 'Pikachu',
    'リザードン': 'Charizard',
    'フシギダネ': 'Bulbasaur',
    'フシギソウ': 'Ivysaur',
    'フシギバナ': 'Venusaur',
    'ゼニガメ': 'Squirtle',
    'カメール': 'Wartortle',
    'カメックス': 'Blastoise',
    'ヒトカゲ': 'Charmander',
    'リザード': 'Charmeleon',
    'ミュウ': 'Mew',
    'ミュウツー': 'Mewtwo',
    'ゲンガー': 'Gengar',
    'ルカリオ': 'Lucario',
    'レックウザ': 'Rayquaza',
    'ギラティナ': 'Giratina',
    'アルセウス': 'Arceus'
  };
  const CN_NAME_OVERRIDES = {
    '伊裳尔塔尔': 'Yveltal',
    '伊裴爾塔爾': 'Yveltal',
    '焰白酋雷姆': 'White Kyurem',
    '皮卡丘': 'Pikachu',
    '喷火龙': 'Charizard',
    '噴火龍': 'Charizard',
    '妙蛙种子': 'Bulbasaur',
    '妙蛙種子': 'Bulbasaur',
    '妙蛙草': 'Ivysaur',
    '妙蛙花': 'Venusaur',
    '杰尼龟': 'Squirtle',
    '傑尼龜': 'Squirtle',
    '卡咪龟': 'Wartortle',
    '卡咪龜': 'Wartortle',
    '水箭龟': 'Blastoise',
    '水箭龜': 'Blastoise',
    '小火龙': 'Charmander',
    '小火龍': 'Charmander',
    '火恐龙': 'Charmeleon',
    '火恐龍': 'Charmeleon',
    '梦幻': 'Mew',
    '夢幻': 'Mew',
    '超梦': 'Mewtwo',
    '超夢': 'Mewtwo',
    '耿鬼': 'Gengar',
    '路卡利欧': 'Lucario',
    '路卡利歐': 'Lucario',
    '烈空坐': 'Rayquaza',
    '骑拉帝纳': 'Giratina',
    '騎拉帝納': 'Giratina',
    '阿尔宙斯': 'Arceus',
    '阿爾宙斯': 'Arceus'
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
  function localAlias(value) {
    if (typeof window.cwNameAliasLookup !== 'function') return '';
    try { return text(window.cwNameAliasLookup(value)); } catch { return ''; }
  }
  function latinFallbackName(value) {
    const clean = text(value);
    return localAlias(clean) || JP_NAME_OVERRIDES[clean] || CN_NAME_OVERRIDES[clean] || '';
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
    const mapped = localAlias(originalName) || localAlias(rawCardmarket) || latinFallbackName(rawCardmarket) || latinFallbackName(originalName) || latinFallbackName(scan.name) || latinFallbackName(scan.visibleTitle);
    const cardmarketName = mapped || rawCardmarket;
    const englishName = text(next.englishName || scan.englishName || mapped || (likelyEnglish(cardmarketName) ? cardmarketName : ''));
    const visibleTitle = text(next.visibleTitle || scan.visibleTitle || (hasAsianText(originalName) ? originalName : ''));
    const fullNumber = text(next.fullNumber || dom.fullNumber || scan.fullNumber || next.number);
    const searchNumber = text(next.searchNumber || dom.searchNumber || scan.searchNumber || fullNumber.split('/')[0] || next.number);

    next.originalName = originalName;
    next.cardmarketName = cardmarketName;
    next.englishName = englishName;
    next.visibleTitle = visibleTitle;
    next.name = text(englishName || cardmarketName || next.name || originalName || visibleTitle);
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

  function compactSearchResponse(data) {
    if (!data || !Array.isArray(data.cards)) return data;
    const maxCards = window.matchMedia && window.matchMedia('(max-width: 820px)').matches ? 5 : 8;
    return {
      ...data,
      cards: data.cards.slice(0, maxCards).map((card) => ({
        ...card,
        imageLarge: '',
        imageSmall: text(card.imageSmall || card.image || '').replace('/high.', '/low.')
      }))
    };
  }

  function responseFromJson(originalResponse, data) {
    const headers = new Headers(originalResponse.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers
    });
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

  function installSearchButtonGuard() {
    if (document.documentElement.dataset.cwSearchGuard === '1') return;
    document.documentElement.dataset.cwSearchGuard = '1';
    document.addEventListener('click', (event) => {
      const button = event.target.closest('#singleTcgSearchBtn,.findM');
      if (!button) return;
      if (button.dataset.cwBusy === '1') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      button.dataset.cwBusy = '1';
      button.disabled = true;
      const oldText = button.textContent;
      button.dataset.cwOldText = oldText;
      button.textContent = 'Suche...';
      setTimeout(() => {
        button.dataset.cwBusy = '0';
        button.disabled = false;
        button.textContent = button.dataset.cwOldText || oldText;
      }, 10000);
    }, true);
  }

  function releaseSearchButtons() {
    document.querySelectorAll('#singleTcgSearchBtn,.findM').forEach((button) => {
      if (button.dataset.cwBusy !== '1') return;
      button.dataset.cwBusy = '0';
      button.disabled = false;
      button.textContent = button.dataset.cwOldText || 'Treffer suchen';
    });
  }

  function installFetchPatch() {
    if (window.fetch.__cwCardSearchPatched) return;
    const originalFetch = window.fetch.bind(window);
    const patched = async function (input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isCardSearch = String(url).includes('/api/card-search');
      let timer = null;
      let controller = null;
      if (isCardSearch && init?.body) {
        try {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
          init = { ...init, body: JSON.stringify(enrichSearchBody(body)) };
        } catch {}
      }
      if (isCardSearch && !init?.signal && typeof AbortController !== 'undefined') {
        controller = new AbortController();
        timer = setTimeout(() => controller.abort(), 7000);
        init = { ...(init || {}), signal: controller.signal };
      }
      try {
        const response = await originalFetch(input, init);
        if (isCardSearch) {
          try {
            const data = compactSearchResponse(await response.clone().json());
            window.__cwLastCardSearchResponse = data;
            setTimeout(enhanceMatchUi, 80);
            setTimeout(enhanceMatchUi, 350);
            return responseFromJson(response, data);
          } catch {}
        }
        return response;
      } catch (err) {
        if (isCardSearch && err?.name === 'AbortError') throw new Error('Treffersuche dauert zu lange. Bitte nochmal druecken oder Name + Nummer pruefen.');
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        if (isCardSearch) setTimeout(releaseSearchButtons, 80);
      }
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
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.cwFallbacks = JSON.stringify(imageFallbacks(img.getAttribute('src')));
    img.addEventListener('error', () => {
      let fallbacks = [];
      try { fallbacks = JSON.parse(img.dataset.cwFallbacks || '[]'); } catch {}
      const next = fallbacks.shift();
      img.dataset.cwFallbacks = JSON.stringify(fallbacks);
      if (next) img.src = next;
      else {
        img.removeAttribute('src');
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
    installSearchButtonGuard();
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
