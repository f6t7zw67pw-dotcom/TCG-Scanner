// Sends richer scan context to the catalog search and softens broken image fallbacks.
(function () {
  if (window.__cwCardSearchHelper) return;
  window.__cwCardSearchHelper = true;

  function text(value) {
    return String(value || '').trim();
  }
  function hasAsianText(value) {
    return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(value || ''));
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
    const cardmarketName = text(next.cardmarketName || dom.cardmarketName || scan.cardmarketName || scan.englishName || next.name);
    const englishName = text(next.englishName || scan.englishName || (likelyEnglish(cardmarketName) ? cardmarketName : ''));
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
  function loadSetDbHelper() {
    if (window.__cwSetDbHelper || document.querySelector('script[data-cw-set-db-helper="1"]')) return;
    const script = document.createElement('script');
    script.src = 'set-db-helper.js';
    script.async = false;
    script.dataset.cwSetDbHelper = '1';
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
    enhanceMatchUi();
    loadSetDbHelper();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
  });
})();
