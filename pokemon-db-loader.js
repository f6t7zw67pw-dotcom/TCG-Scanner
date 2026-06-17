// Bootstrap loader: keeps the existing Pokemon DB enhancements and then adds the UI helper scripts.
(function () {
  const BASE_LOADER = '/api/loader-base';
  const HELPER = 'cardmarket-helper.js';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Script konnte nicht geladen werden: ${src}`));
      document.head.appendChild(script);
    });
  }

  function nudgeLoadHandlers() {
    if (document.readyState === 'complete') {
      window.dispatchEvent(new Event('load'));
    }
  }

  function normalizeNumberPart(value) {
    const raw = String(value || '').toUpperCase().replace(/\s+/g, '').trim();
    if (!raw) return '';
    if (!/^\d+$/.test(raw)) return raw;
    const stripped = raw.replace(/^0+(?=\d)/, '') || '0';
    return stripped.length <= 2 ? stripped.padStart(3, '0') : stripped;
  }

  function normalizeCardNumber(value) {
    const raw = String(value || '').toUpperCase().trim();
    if (!raw) return '';
    const parts = raw.split('/');
    const left = normalizeNumberPart(parts[0]);
    if (parts.length === 1) return left;
    const right = parts.slice(1).join('/').replace(/\s+/g, '').trim();
    return right ? `${left}/${right}` : left;
  }

  function normalizeSearchNumber(value) {
    return normalizeNumberPart(String(value || '').split('/')[0]);
  }

  function shouldCleanWhileTyping(value) {
    const left = String(value || '').split('/')[0].replace(/\s+/g, '');
    return /^0{2,}\d{2,}$/.test(left) || /^0{3,}\d+$/.test(left);
  }

  function setValue(input, value) {
    if (!input || input.value === value) return false;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function normalizeSingle(finalize) {
    const full = document.getElementById('fullNumber');
    const search = document.getElementById('searchNumber');
    if (!full && !search) return;

    if (full) {
      const nextFull = finalize || shouldCleanWhileTyping(full.value) ? normalizeCardNumber(full.value) : full.value;
      if (setValue(full, nextFull) && search) setValue(search, normalizeSearchNumber(nextFull));
    }

    if (search) {
      const source = search.value || (full ? full.value : '');
      const nextSearch = finalize || shouldCleanWhileTyping(source) ? normalizeSearchNumber(source) : search.value;
      setValue(search, nextSearch);
    }

    if (typeof window.buildUrl === 'function') window.buildUrl();
  }

  function normalizeMultiInput(input, finalize) {
    if (!input) return;
    const next = finalize || shouldCleanWhileTyping(input.value) ? normalizeCardNumber(input.value) : input.value;
    setValue(input, next);
  }

  function installNumberFixes() {
    const full = document.getElementById('fullNumber');
    const search = document.getElementById('searchNumber');

    [full, search].forEach((input) => {
      if (!input || input.dataset.cwNumberFix === '1') return;
      input.dataset.cwNumberFix = '1';
      input.addEventListener('input', () => setTimeout(() => normalizeSingle(false), 0));
      input.addEventListener('blur', () => normalizeSingle(true));
      input.addEventListener('change', () => normalizeSingle(true));
    });

    document.querySelectorAll('#multiResults input[data-k="fullNumber"]').forEach((input) => {
      if (input.dataset.cwNumberFix === '1') return;
      input.dataset.cwNumberFix = '1';
      input.addEventListener('input', () => setTimeout(() => normalizeMultiInput(input, false), 0));
      input.addEventListener('blur', () => normalizeMultiInput(input, true));
      input.addEventListener('change', () => normalizeMultiInput(input, true));
    });
  }

  function clearField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resetScanAfterSave() {
    if (typeof window.clearImage === 'function') window.clearImage();
    try { localStorage.removeItem('cw_last_image'); } catch {}

    [
      'visibleText',
      'originalName',
      'cardmarketName',
      'fullNumber',
      'searchNumber',
      'setCode',
      'setName',
      'sellPrice',
      'ebayPrice',
      'shipping',
      'lotName',
      'lotEbayPrice',
      'lotShipping'
    ].forEach(clearField);

    const imageInput = document.getElementById('imageInput');
    if (imageInput) imageInput.value = '';

    const singleMatches = document.getElementById('singleMatches');
    if (singleMatches) singleMatches.innerHTML = '';

    const cropPreview = document.getElementById('cropPreview');
    if (cropPreview) cropPreview.innerHTML = '';

    const multiResults = document.getElementById('multiResults');
    if (multiResults) multiResults.innerHTML = '';

    if (Array.isArray(window.multiCards)) window.multiCards.length = 0;
    if (Array.isArray(window.cropImages)) window.cropImages.length = 0;

    const cmUrl = document.getElementById('cmUrl');
    if (cmUrl) cmUrl.textContent = 'Noch nicht genug Daten.';

    const nameHint = document.getElementById('nameHint');
    if (nameHint) nameHint.textContent = 'Pokemon-DB bereit.';

    const scanStatus = document.getElementById('scanStatus');
    if (scanStatus) scanStatus.textContent = 'Bereit fuer den naechsten Scan.';

    const scanProgress = document.getElementById('scanProgress');
    if (scanProgress) scanProgress.style.width = '35%';

    if (typeof window.updateProfit === 'function') window.updateProfit();
    if (typeof window.updateMultiProfit === 'function') window.updateMultiProfit();
    if (typeof window.buildUrl === 'function') window.buildUrl();
  }

  function wrapSaveButton(id) {
    const button = document.getElementById(id);
    if (!button || button.dataset.cwResetAfterSave === '1') return;
    const original = button.onclick;
    if (typeof original !== 'function') return;
    button.dataset.cwResetAfterSave = '1';
    button.onclick = function (event) {
      if (id === 'saveMultiBtn' && !document.querySelector('#multiResults .resultCard')) {
        if (typeof window.toast === 'function') window.toast('Keine Multi-Karten zum Speichern.');
        return undefined;
      }
      const result = original.call(this, event);
      resetScanAfterSave();
      return result;
    };
  }

  function installSaveResetHandlers() {
    wrapSaveButton('saveBtn');
    wrapSaveButton('saveMultiBtn');
  }

  window.cwNormalizeCardNumber = normalizeCardNumber;
  window.cwNormalizeSearchNumber = normalizeSearchNumber;
  window.cwInstallNumberFixes = installNumberFixes;
  window.cwResetScanAfterSave = resetScanAfterSave;

  loadScript(BASE_LOADER)
    .then(() => {
      nudgeLoadHandlers();
      return loadScript(HELPER);
    })
    .then(() => {
      installNumberFixes();
      installSaveResetHandlers();
      setTimeout(installNumberFixes, 500);
      setTimeout(installNumberFixes, 1500);
      setTimeout(installSaveResetHandlers, 500);
      setTimeout(installSaveResetHandlers, 1500);
      const observer = new MutationObserver(() => {
        setTimeout(installNumberFixes, 40);
        setTimeout(installSaveResetHandlers, 40);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      nudgeLoadHandlers();
    })
    .catch((err) => {
      const status = document.getElementById('nameHint') || document.getElementById('scanStatus');
      if (status) status.textContent = err.message;
      console.error(err);
    });
})();
