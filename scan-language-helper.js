// Normalizes scan results for Japanese, Chinese and other non-German cards.
(function () {
  if (window.__cwScanLanguageHelper) return;
  window.__cwScanLanguageHelper = true;

  const LANGUAGE_CODES = {
    english: '1', englisch: '1', en: '1',
    german: '3', deutsch: '3', de: '3',
    japanese: '7', japanisch: '7', ja: '7', jp: '7',
    korean: '8', koreanisch: '8', ko: '8', kr: '8'
  };
  const LANGUAGE_LABELS = {
    '1': 'Englisch',
    '3': 'Deutsch',
    '7': 'Japanisch',
    '8': 'Koreanisch'
  };

  function normalize(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function bestSearchName(card) {
    return String(card?.cardmarketName || card?.englishName || card?.originalName || card?.visibleTitle || card?.name || '').trim();
  }
  function visibleOrBestName(card) {
    const visible = String(card?.visibleTitle || '').trim();
    const original = String(card?.originalName || '').trim();
    const english = String(card?.englishName || card?.cardmarketName || '').trim();
    return original || visible || english;
  }
  function languageCode(card) {
    const explicit = String(card?.languageCode || '').trim();
    if (explicit) return explicit;
    const guess = normalize(card?.languageGuess || card?.language || '');
    if (LANGUAGE_CODES[guess]) return LANGUAGE_CODES[guess];
    if (guess.includes('japan')) return '7';
    if (guess.includes('korea')) return '8';
    if (guess.includes('engl')) return '1';
    if (guess.includes('german') || guess.includes('deutsch')) return '3';
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
  function enhanceSingleCard(card) {
    if (!card || typeof card !== 'object') return;
    const original = document.getElementById('originalName');
    const cardmarket = document.getElementById('cardmarketName');
    const hint = document.getElementById('nameHint');
    const originalValue = visibleOrBestName(card);
    const searchValue = bestSearchName(card);
    if (originalValue) setInputValue(original, originalValue);
    if (searchValue) setInputValue(cardmarket, searchValue);
    applyLanguageChip(languageCode(card));
    if (hint && (card.englishName || card.visibleTitle || card.languageGuess)) {
      const lang = card.languageGuess ? `Sprache: ${card.languageGuess}. ` : '';
      const visible = card.visibleTitle ? `Originaltitel: ${card.visibleTitle}. ` : '';
      const english = card.englishName ? `Suchname: ${card.englishName}.` : '';
      hint.textContent = `${lang}${visible}${english}`.trim();
    }
    if (typeof window.buildUrl === 'function') window.buildUrl();
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
  }
  function normalizeScanPayload(payload) {
    if (!payload || !Array.isArray(payload.cards)) return payload;
    payload.cards = payload.cards.map(card => {
      const next = { ...card };
      if (!next.originalName && (next.englishName || next.visibleTitle)) next.originalName = next.englishName || next.visibleTitle;
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
