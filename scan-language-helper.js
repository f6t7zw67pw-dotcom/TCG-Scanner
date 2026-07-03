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
  const translationCache = new Map();

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
  function bestSearchName(card) {
    const cm = text(card?.cardmarketName);
    if (cm && !hasAsianText(cm)) return cm;
    const english = text(card?.englishName);
    if (english && !hasAsianText(english)) return toCardmarketName(english);
    return text(card?.originalName || card?.visibleTitle || card?.name || cm);
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
  function translationKey(card) {
    return [card?.name, card?.originalName, card?.visibleTitle, card?.cardmarketName, card?.fullNumber, card?.number, card?.searchNumber, card?.setCode, card?.setName].map(text).join('|');
  }
  function translatedFromMatch(card, match) {
    if (!match) return card;
    const matchName = text(match.cardmarketName || match.englishName || match.name);
    const englishName = !hasAsianText(matchName) ? matchName.replace(/-/g, ' ') : '';
    return {
      ...card,
      originalName: text(card.originalName || card.visibleTitle || card.name || match.name),
      visibleTitle: text(card.visibleTitle || card.originalName || card.name || match.name),
      englishName: englishName || card.englishName || '',
      cardmarketName: !hasAsianText(matchName) ? toCardmarketName(matchName) : card.cardmarketName,
      fullNumber: card.fullNumber || match.number || card.number || '',
      searchNumber: card.searchNumber || String(match.number || card.number || '').split('/')[0],
      setCode: card.setCode || match.setCode || '',
      setName: match.cardmarketSetName || card.setName || match.setName || '',
      cardmarketSetName: match.cardmarketSetName || match.setName || card.cardmarketSetName || '',
      imageSmall: match.imageSmall || card.imageSmall || '',
      imageLarge: match.imageLarge || card.imageLarge || '',
      i18nSource: match.source || 'card-search'
    };
  }
  async function translateCard(card) {
    if (!card || !hasAsianText(`${card.name || ''} ${card.originalName || ''} ${card.visibleTitle || ''} ${card.cardmarketName || ''}`)) return card;
    const key = translationKey(card);
    if (translationCache.has(key)) return translationCache.get(key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const response = await fetch('/api/card-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: card.cardmarketName || card.originalName || card.visibleTitle || card.name || '',
          originalName: card.originalName || card.visibleTitle || card.name || '',
          cardmarketName: card.cardmarketName || '',
          visibleTitle: card.visibleTitle || '',
          number: card.fullNumber || card.searchNumber || card.number || '',
          fullNumber: card.fullNumber || card.number || '',
          searchNumber: card.searchNumber || String(card.number || '').split('/')[0],
          setCode: card.setCode || '',
          setName: card.setName || '',
          languageCode: card.languageCode || languageCode(card),
          language: card.language || card.languageGuess || ''
        })
      });
      const data = await response.json().catch(() => ({}));
      const match = Array.isArray(data.cards) ? data.cards[0] : null;
      const translated = data?.ok && match ? translatedFromMatch(card, match) : card;
      translationCache.set(key, translated);
      return translated;
    } catch {
      translationCache.set(key, card);
      return card;
    } finally {
      clearTimeout(timer);
    }
  }
  function applyTranslatedSingle(card) {
    if (!card) return;
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
    if (hint && (card.englishName || card.visibleTitle || card.languageGuess || card.i18nSource)) {
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
    if (hasAsianText(`${card.name || ''} ${card.originalName || ''} ${card.visibleTitle || ''} ${card.cardmarketName || ''}`)) {
      translateCard(card).then((translated) => {
        applyTranslatedSingle(translated);
        if (window.__cwLastScanLanguagePayload?.cards?.[0]) {
          window.__cwLastScanLanguagePayload.cards[0] = { ...window.__cwLastScanLanguagePayload.cards[0], ...translated };
        }
      }).catch(() => {});
    }
  }
  function enhanceMultiCard(domCard, card) {
    if (!domCard || !card) return;
    const original = domCard.querySelector('input[data-k="originalName"]');
    const cardmarket = domCard.querySelector('input[data-k="cardmarketName"]');
    setInputValue(original, visibleOrBestName(card));
    setInputValue(cardmarket, bestSearchName(card));
    domCard.dataset.scanLanguageCode = languageCode(card);
    domCard.dataset.scanVisibleTitle = card.visibleTitle || '';
    domCard.dataset.scanEnglishName = card.englishName || '';
    if (hasAsianText(`${card.name || ''} ${card.originalName || ''} ${card.visibleTitle || ''} ${card.cardmarketName || ''}`)) {
      translateCard(card).then((translated) => {
        setInputValue(original, visibleOrBestName(translated));
        setInputValue(cardmarket, bestSearchName(translated));
        domCard.dataset.scanEnglishName = translated.englishName || '';
      }).catch(() => {});
    }
  }
  function normalizeScanPayload(payload) {
    if (!payload || !Array.isArray(payload.cards)) return payload;
    payload.cards = payload.cards.map(card => {
      const next = { ...card };
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
