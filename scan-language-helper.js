// Normalizes scan results for Japanese, Chinese and other non-German cards.
(function () {
  if (window.__cwScanLanguageHelper) return;
  window.__cwScanLanguageHelper = true;

  const LANGUAGE_CODES = {
    english: '1', englisch: '1', en: '1',
    german: '3', deutsch: '3', de: '3',
    japanese: '7', japanisch: '7', ja: '7', jp: '7',
    korean: '8', koreanisch: '8', ko: '8', kr: '8',
    chinese: '7', chinesisch: '7', zh: '7', cn: '7'
  };
  const STATIC_NAME_ALIASES = {
    'ママンボウ': 'Alomomola',
    'イベルタル': 'Yveltal',
    '伊裳尔塔尔': 'Yveltal',
    'レパルダス': 'Liepard',
    'イシズマイ': 'Dwebble',
    'サンダース': 'Jolteon',
    'ピカチュウ': 'Pikachu',
    'リザードン': 'Charizard',
    '皮卡丘': 'Pikachu',
    '喷火龙': 'Charizard',
    '噴火龍': 'Charizard'
  };

  function normalize(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function text(value) {
    return String(value || '').trim();
  }
  function hasAsianText(value) {
    return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(value || ''));
  }
  function likelyLatin(value) {
    return /^[A-Za-z0-9 .:'’&+\-]+$/.test(text(value));
  }
  function toCardmarketName(value) {
    return text(value)
      .replace(/\s+ex$/i, '-ex')
      .replace(/\s+EX$/i, '-EX')
      .replace(/\s+V$/i, '-V')
      .replace(/\s+GX$/i, '-GX');
  }
  function aliasFor(card) {
    for (const value of [card?.cardmarketName, card?.englishName, card?.originalName, card?.visibleTitle, card?.name]) {
      const alias = STATIC_NAME_ALIASES[text(value)];
      if (alias) return alias;
    }
    return '';
  }
  function lightweightTranslate(card) {
    const alias = aliasFor(card);
    if (!alias) return card;
    return {
      ...card,
      originalName: text(card.originalName || card.visibleTitle || card.name || card.cardmarketName),
      visibleTitle: text(card.visibleTitle || card.originalName || card.name || card.cardmarketName),
      englishName: alias,
      cardmarketName: toCardmarketName(alias)
    };
  }
  function bestSearchName(card) {
    const translated = lightweightTranslate(card || {});
    const cm = text(translated?.cardmarketName);
    if (cm && !hasAsianText(cm)) return cm;
    const english = text(translated?.englishName);
    if (english && !hasAsianText(english)) return toCardmarketName(english);
    return text(translated?.originalName || translated?.visibleTitle || translated?.name || cm);
  }
  function visibleOrBestName(card) {
    const visible = text(card?.visibleTitle);
    const original = text(card?.originalName);
    const name = text(card?.name);
    const english = text(card?.englishName || card?.cardmarketName);
    return original || visible || name || english;
  }
  function languageCode(card) {
    const explicit = text(card?.languageCode);
    if (explicit) return explicit;
    const guess = normalize(card?.languageGuess || card?.language || '');
    if (LANGUAGE_CODES[guess]) return LANGUAGE_CODES[guess];
    if (guess.includes('japan')) return '7';
    if (guess.includes('china') || guess.includes('chinese') || guess.includes('zh')) return '7';
    if (guess.includes('korea')) return '8';
    if (guess.includes('engl')) return '1';
    if (guess.includes('german') || guess.includes('deutsch')) return '3';
    if (hasAsianText(`${card?.name || ''} ${card?.originalName || ''} ${card?.visibleTitle || ''}`)) return '7';
    return '';
  }
  function setInputValue(input, value) {
    if (!input || !value || input.value === value) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function applyLanguageChip(code) {
    if (!code) return;
    let chip = document.querySelector(`#langChips .chip[data-code="${code}"]`);
    if (!chip && code === '8') {
      chip = document.createElement('button');
      chip.className = 'chip';
      chip.dataset.label = 'Koreanisch';
      chip.dataset.code = '8';
      chip.type = 'button';
      chip.textContent = 'Koreanisch';
      document.getElementById('langChips')?.appendChild(chip);
    }
    if (!chip) return;
    chip.click();
  }
  function applyTranslatedSingle(rawCard) {
    if (!rawCard) return;
    const card = lightweightTranslate(rawCard);
    const original = document.getElementById('originalName');
    const cardmarket = document.getElementById('cardmarketName');
    const fullNumber = document.getElementById('fullNumber');
    const searchNumber = document.getElementById('searchNumber');
    const setCode = document.getElementById('setCode');
    const setName = document.getElementById('setName');
    const hint = document.getElementById('nameHint');

    const originalValue = visibleOrBestName(card);
    const searchValue = bestSearchName(card);
    if (originalValue) setInputValue(original, originalValue);
    if (searchValue && (!hasAsianText(searchValue) || likelyLatin(searchValue))) setInputValue(cardmarket, toCardmarketName(searchValue));
    if (card.fullNumber || card.number) setInputValue(fullNumber, card.fullNumber || card.number);
    if (card.searchNumber || card.number) setInputValue(searchNumber, String(card.searchNumber || card.number || '').split('/')[0]);
    if (card.setCode) setInputValue(setCode, card.setCode);
    if (card.cardmarketSetName || card.setName) setInputValue(setName, card.cardmarketSetName || card.setName);

    applyLanguageChip(languageCode(card));
    if (hint && (card.englishName || card.visibleTitle || card.languageGuess)) {
      const lang = card.languageGuess ? `Sprache: ${card.languageGuess}. ` : '';
      const visible = card.visibleTitle ? `Originaltitel: ${card.visibleTitle}. ` : '';
      const english = card.englishName ? `Suchname: ${card.englishName}.` : '';
      hint.textContent = `${lang}${visible}${english}`.trim();
    }
    if (typeof window.buildUrl === 'function') window.buildUrl();
  }
  function enhanceSingleCard(card) {
    if (!card || typeof card !== 'object') return;
    applyTranslatedSingle(card);
    if (window.__cwLastScanLanguagePayload?.cards?.[0]) {
      window.__cwLastScanLanguagePayload.cards[0] = { ...window.__cwLastScanLanguagePayload.cards[0], ...lightweightTranslate(card) };
    }
  }
  function enhanceMultiCard(domCard, rawCard) {
    if (!domCard || !rawCard) return;
    const card = lightweightTranslate(rawCard);
    const original = domCard.querySelector('input[data-k="originalName"]');
    const cardmarket = domCard.querySelector('input[data-k="cardmarketName"]');
    setInputValue(original, visibleOrBestName(card));
    setInputValue(cardmarket, bestSearchName(card));
    domCard.dataset.scanLanguageCode = languageCode(card);
    domCard.dataset.scanVisibleTitle = card.visibleTitle || '';
    domCard.dataset.scanEnglishName = card.englishName || '';
  }
  function normalizeScanPayload(payload) {
    if (!payload || !Array.isArray(payload.cards)) return payload;
    payload.cards = payload.cards.map(card => {
      const next = lightweightTranslate({ ...card });
      if (!next.originalName && (next.englishName || next.visibleTitle || next.name)) next.originalName = next.visibleTitle || next.name || next.englishName;
      if (!next.cardmarketName && next.englishName) next.cardmarketName = next.englishName;
      return next;
    });
    return payload;
  }
  function installFetchPatch() {
    if (window.fetch.__cwScanLanguagePatched) return;
    const originalFetch = window.fetch.bind(window);
    const patched = async function (input, init) {
      const response = await originalFetch(input, init);
      const url = typeof input === 'string' ? input : input?.url || '';
      if (!String(url).includes('/api/scan')) return response;
      try {
        const clone = response.clone();
        const data = await clone.json();
        window.__cwLastScanLanguagePayload = normalizeScanPayload(data);
      } catch {}
      return response;
    };
    patched.__cwScanLanguagePatched = true;
    window.fetch = patched;
  }
  function applyLastPayload() {
    const payload = window.__cwLastScanLanguagePayload;
    const cards = Array.isArray(payload?.cards) ? payload.cards : [];
    if (!cards.length) return;
    enhanceSingleCard(cards[0]);
    document.querySelectorAll('#multiResults .resultCard').forEach((domCard, index) => enhanceMultiCard(domCard, cards[index]));
  }
  function scheduleAfterScan() {
    [80, 250, 600, 1200, 2500].forEach(delay => setTimeout(applyLastPayload, delay));
  }
  function install() {
    installFetchPatch();
    const scanButton = document.getElementById('aiScanBtn');
    if (scanButton && scanButton.dataset.cwScanLanguage !== '1') {
      scanButton.dataset.cwScanLanguage = '1';
      scanButton.addEventListener('click', scheduleAfterScan, true);
    }
    const multi = document.getElementById('multiResults');
    if (multi && !window.__cwScanLanguageObserver) {
      window.__cwScanLanguageObserver = new MutationObserver(scheduleAfterScan);
      window.__cwScanLanguageObserver.observe(multi, { childList: true, subtree: true });
    }
  }

  window.cwApplyScanLanguage = applyLastPayload;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();
