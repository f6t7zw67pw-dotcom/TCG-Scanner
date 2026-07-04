// Bootstrap loader: keeps the existing Pokemon DB enhancements and then adds the UI helper scripts.
(function () {
  const BASE_LOADER = '/api/loader-base';
  const HELPER = 'cardmarket-helper.js';
  const NAME_ALIAS_HELPER = 'name-alias-db-helper.js';
  const SEARCH_HELPER = 'card-search-helper.js';
  const STABLE_SEARCH_HELPER = 'stable-search-helper.js';

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

  function addCropZoomStyle() {
    if (document.getElementById('cw-crop-zoom-style')) return;
    const style = document.createElement('style');
    style.id = 'cw-crop-zoom-style';
    style.textContent = `
      .cropCard img,#multiResults .preview .thumb{cursor:zoom-in}
      .cropCard::after,#multiResults .preview::after{content:'Tippen zum Vergroessern';display:block;margin-top:6px;color:#a8b3c6;font-size:12px;font-weight:750}
      .cwCropZoomOverlay{position:fixed;inset:0;z-index:5000;background:rgba(2,8,18,.94);display:none;grid-template-rows:auto 1fr auto;gap:10px;padding:14px;backdrop-filter:blur(14px)}
      .cwCropZoomOverlay.open{display:grid}
      .cwCropZoomTop,.cwCropZoomControls{display:flex;align-items:center;gap:8px;justify-content:space-between;max-width:1120px;width:100%;margin:0 auto}
      .cwCropZoomTitle{font-weight:900;color:#f5f7fb;font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cwCropZoomBtn{border:1px solid #304663;border-radius:14px;background:#102039;color:#f5f7fb;font-weight:900;min-height:44px;padding:9px 13px}
      .cwCropZoomBtn.primary{background:linear-gradient(135deg,#7c3cff,#246bff);border-color:rgba(255,255,255,.28)}
      .cwCropZoomStage{min-height:0;overflow:auto;display:grid;place-items:center;border:1px solid rgba(89,117,165,.32);border-radius:18px;background:radial-gradient(circle at center,rgba(36,107,255,.12),rgba(5,13,26,.96));max-width:1120px;width:100%;margin:0 auto;padding:18px;overscroll-behavior:contain}
      .cwCropZoomImage{max-width:none;width:auto;height:auto;max-height:none;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.45);transform-origin:center center;transition:transform .12s ease}
      .cwCropZoomControls{background:rgba(7,17,31,.88);border:1px solid rgba(89,117,165,.32);border-radius:18px;padding:10px}
      .cwCropZoomRange{accent-color:#7c3cff;flex:1;min-width:120px}
      .cwCropZoomValue{color:#dbe7ff;font-weight:900;min-width:54px;text-align:right}
      @media(max-width:620px){.cwCropZoomOverlay{padding:10px}.cwCropZoomTop,.cwCropZoomControls{gap:6px}.cwCropZoomBtn{min-height:42px;padding:8px 10px}.cwCropZoomTitle{font-size:14px}.cwCropZoomStage{padding:10px}.cropCard::after,#multiResults .preview::after{font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  function ensureCropZoomViewer() {
    let overlay = document.getElementById('cwCropZoomOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'cwCropZoomOverlay';
    overlay.className = 'cwCropZoomOverlay';
    overlay.innerHTML = `
      <div class="cwCropZoomTop">
        <div class="cwCropZoomTitle" id="cwCropZoomTitle">Crop ansehen</div>
        <button class="cwCropZoomBtn" type="button" data-cw-zoom-action="close">Schliessen</button>
      </div>
      <div class="cwCropZoomStage" id="cwCropZoomStage"><img class="cwCropZoomImage" id="cwCropZoomImage" alt="Vergroesserter Crop"></div>
      <div class="cwCropZoomControls">
        <button class="cwCropZoomBtn" type="button" data-cw-zoom-action="minus">-</button>
        <input class="cwCropZoomRange" id="cwCropZoomRange" type="range" min="80" max="360" step="10" value="180">
        <button class="cwCropZoomBtn" type="button" data-cw-zoom-action="plus">+</button>
        <button class="cwCropZoomBtn primary" type="button" data-cw-zoom-action="reset">100%</button>
        <div class="cwCropZoomValue" id="cwCropZoomValue">180%</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const range = overlay.querySelector('#cwCropZoomRange');
    range.addEventListener('input', () => applyCropZoom(Number(range.value)));
    overlay.addEventListener('click', (event) => {
      const action = event.target.closest('[data-cw-zoom-action]')?.dataset.cwZoomAction;
      if (!action) return;
      if (action === 'close') closeCropZoom();
      if (action === 'minus') applyCropZoom(Number(range.value) - 20);
      if (action === 'plus') applyCropZoom(Number(range.value) + 20);
      if (action === 'reset') applyCropZoom(100);
    });
    overlay.querySelector('#cwCropZoomStage').addEventListener('click', (event) => {
      if (event.target.id === 'cwCropZoomStage') closeCropZoom();
    });
    document.addEventListener('keydown', (event) => {
      if (!overlay.classList.contains('open')) return;
      if (event.key === 'Escape') closeCropZoom();
      if (event.key === '+' || event.key === '=') applyCropZoom(Number(range.value) + 20);
      if (event.key === '-') applyCropZoom(Number(range.value) - 20);
      if (event.key === '0') applyCropZoom(100);
    });
    return overlay;
  }

  function applyCropZoom(value) {
    const overlay = ensureCropZoomViewer();
    const range = overlay.querySelector('#cwCropZoomRange');
    const image = overlay.querySelector('#cwCropZoomImage');
    const label = overlay.querySelector('#cwCropZoomValue');
    const next = Math.max(80, Math.min(360, Math.round(value / 10) * 10));
    range.value = String(next);
    image.style.transform = `scale(${next / 100})`;
    label.textContent = `${next}%`;
  }

  function closeCropZoom() {
    const overlay = document.getElementById('cwCropZoomOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function openCropZoom(img) {
    if (!img || !img.src) return;
    const overlay = ensureCropZoomViewer();
    const image = overlay.querySelector('#cwCropZoomImage');
    const title = overlay.querySelector('#cwCropZoomTitle');
    const card = img.closest('.cropCard,.resultCard');
    const label = card?.querySelector('.small,b,label')?.textContent?.trim();
    image.src = img.src;
    title.textContent = label || 'Crop ansehen';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    applyCropZoom(180);
    setTimeout(() => overlay.querySelector('#cwCropZoomStage')?.scrollTo({ left: 0, top: 0 }), 30);
  }

  function installIndividualCropZoom() {
    addCropZoomStyle();
    ensureCropZoomViewer();
    if (document.documentElement.dataset.cwCropZoomInstalled === '1') return;
    document.documentElement.dataset.cwCropZoomInstalled = '1';
    document.addEventListener('click', (event) => {
      const img = event.target.closest('.cropCard img,#multiResults .preview img.thumb');
      if (!img) return;
      event.preventDefault();
      event.stopPropagation();
      openCropZoom(img);
    }, true);
  }

  window.cwNormalizeCardNumber = normalizeCardNumber;
  window.cwNormalizeSearchNumber = normalizeSearchNumber;
  window.cwInstallNumberFixes = installNumberFixes;
  window.cwResetScanAfterSave = resetScanAfterSave;
  window.cwOpenCropZoom = openCropZoom;

  loadScript(BASE_LOADER)
    .then(() => {
      nudgeLoadHandlers();
      return loadScript(HELPER);
    })
    .then(() => loadScript(NAME_ALIAS_HELPER))
    .then(() => loadScript(SEARCH_HELPER))
    .then(() => loadScript(STABLE_SEARCH_HELPER))
    .then(() => {
      installNumberFixes();
      installSaveResetHandlers();
      installIndividualCropZoom();
      setTimeout(installNumberFixes, 500);
      setTimeout(installNumberFixes, 1500);
      setTimeout(installSaveResetHandlers, 500);
      setTimeout(installSaveResetHandlers, 1500);
      setTimeout(installIndividualCropZoom, 500);
      setTimeout(installIndividualCropZoom, 1500);
      const observer = new MutationObserver(() => {
        setTimeout(installNumberFixes, 40);
        setTimeout(installSaveResetHandlers, 40);
        setTimeout(installIndividualCropZoom, 40);
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
