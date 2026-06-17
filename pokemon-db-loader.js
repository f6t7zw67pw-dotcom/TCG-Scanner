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

  window.cwNormalizeCardNumber = normalizeCardNumber;
  window.cwNormalizeSearchNumber = normalizeSearchNumber;
  window.cwInstallNumberFixes = installNumberFixes;

  loadScript(BASE_LOADER)
    .then(() => {
      nudgeLoadHandlers();
      return loadScript(HELPER);
    })
    .then(() => {
      installNumberFixes();
      setTimeout(installNumberFixes, 500);
      setTimeout(installNumberFixes, 1500);
      const observer = new MutationObserver(() => setTimeout(installNumberFixes, 40));
      observer.observe(document.documentElement, { childList: true, subtree: true });
      nudgeLoadHandlers();
    })
    .catch((err) => {
      const status = document.getElementById('nameHint') || document.getElementById('scanStatus');
      if (status) status.textContent = err.message;
      console.error(err);
    });
})();
