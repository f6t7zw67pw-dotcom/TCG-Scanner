// Extra UI polish and Cardmarket variant helpers for Card Wizard Pro.
(function () {
  const ICONS = {
    scanner: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>',
    collection: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="12" height="16" rx="2"/><path d="M9 8h4"/><path d="M9 12h4"/><path d="M19 7v10"/></svg>',
    db: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.5 2.5 0 0 1 4.4 1.7c0 1.8-2.2 2.1-2.2 3.8"/><path d="M12 17.5h.01"/></svg>'
  };

  const VERSIONS = [
    { value: '', label: 'Normal' },
    { value: 'V1', label: 'V1' },
    { value: 'V2', label: 'V2' },
    { value: 'V3', label: 'V3' },
    { value: 'V4', label: 'V4' }
  ];

  function padNumber(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    const parts = raw.split('/');
    const left = parts[0].replace(/\s+/g, '');
    const padded = /^\d{1,2}$/.test(left) ? left.padStart(3, '0') : left;
    return parts.length > 1 ? `${padded}/${parts.slice(1).join('/').replace(/\s+/g, '')}` : padded;
  }

  function searchNumber(value) {
    return padNumber(String(value || '').split('/')[0]);
  }

  function addStyle() {
    if (document.getElementById('cw-helper-style')) return;
    const style = document.createElement('style');
    style.id = 'cw-helper-style';
    style.textContent = `
      .bottomNav .navIcon{width:24px;height:24px;display:grid;place-items:center;margin-bottom:2px}
      .bottomNav .navIcon svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 2px 8px rgba(0,0,0,.28))}
      .bottomNav .navBtn{gap:5px;color:#dbe7ff;border:1px solid rgba(112,142,190,.2)}
      .bottomNav .navBtn.active{color:white;border-color:rgba(255,255,255,.22)}
      .cwVariantBox{margin-top:12px;border:1px solid rgba(89,117,165,.32);border-radius:18px;background:linear-gradient(180deg,rgba(8,18,33,.98),rgba(5,13,26,.98));padding:12px;display:grid;gap:10px}
      .cwVariantHead{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:850}
      .cwVariantGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
      .cwVariantBtn{border:1px solid #304663;border-radius:14px;background:#102039;color:#f5f7fb;font-weight:850;min-height:44px;padding:8px 6px}
      .cwVariantBtn.active{background:linear-gradient(135deg,#7c3cff,#246bff);border-color:rgba(255,255,255,.3)}
      .cwVariantActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .cwVariantHint{font-size:13px;color:#a8b3c6;line-height:1.35}
      @media(max-width:520px){.cwVariantGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.cwVariantActions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function installIcons() {
    document.querySelectorAll('.bottomNav .navBtn').forEach((button) => {
      const key = button.dataset.tab;
      const icon = button.querySelector('.navIcon');
      if (icon && ICONS[key]) icon.innerHTML = ICONS[key];
    });
  }

  function selectedSingleVersion() {
    return document.querySelector('#typeChips .chip.active')?.dataset.ver || '';
  }

  function selectSingleVersion(version) {
    const chips = document.querySelectorAll('#typeChips .chip');
    chips.forEach((chip) => {
      const active = (chip.dataset.ver || '') === version;
      chip.classList.toggle('active', active);
      if (active && window.cardType) window.cardType = { type: chip.dataset.type || 'Normal', ver: version };
    });
    if (typeof window.buildUrl === 'function') window.buildUrl();
  }

  function singleCard(version) {
    return {
      setName: document.getElementById('setName')?.value || '',
      cardmarketName: document.getElementById('cardmarketName')?.value || '',
      originalName: document.getElementById('originalName')?.value || '',
      setCode: document.getElementById('setCode')?.value || '',
      fullNumber: padNumber(document.getElementById('fullNumber')?.value || ''),
      searchNumber: searchNumber(document.getElementById('searchNumber')?.value || document.getElementById('fullNumber')?.value || ''),
      cardVersion: version,
      languageCode: document.querySelector('#langChips .chip.active')?.dataset.code || '3'
    };
  }

  function buildVariantUrl(card, version) {
    if (typeof window.buildCMUrlFrom !== 'function') return '';
    return window.buildCMUrlFrom({ ...card, cardVersion: version, fullNumber: padNumber(card.fullNumber || card.number || ''), searchNumber: searchNumber(card.searchNumber || card.fullNumber || card.number || '') });
  }

  function openUrl(url) {
    if (url) window.open(url, '_blank');
  }

  async function copyUrl(url) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    if (typeof window.toast === 'function') window.toast('URL kopiert');
  }

  function ensureSingleVariants() {
    const urlBox = document.getElementById('cmUrl');
    if (!urlBox || document.getElementById('cwSingleVariants')) return;
    const box = document.createElement('div');
    box.id = 'cwSingleVariants';
    box.className = 'cwVariantBox';
    box.innerHTML = '<div class="cwVariantHead"><span>Cardmarket Varianten</span><button class="miniBtn miniGhost" type="button" data-cw-action="refresh">Aktualisieren</button></div><div class="cwVariantGrid"></div><div class="cwVariantActions"><button class="btn ghost" type="button" data-cw-action="open">Auswahl öffnen</button><button class="btn ghost" type="button" data-cw-action="copy">Auswahl kopieren</button></div><div class="cwVariantHint">Wenn Cardmarket nichts findet, teste direkt Normal, V1, V2, V3 oder V4.</div>';
    urlBox.parentNode.insertBefore(box, urlBox.nextSibling);
    box.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const action = button.dataset.cwAction;
      const version = button.dataset.version;
      if (version !== undefined) {
        selectSingleVersion(version);
        renderSingleVariants();
        return;
      }
      const selected = selectedSingleVersion();
      const url = buildVariantUrl(singleCard(selected), selected);
      if (action === 'open') openUrl(url);
      if (action === 'copy') await copyUrl(url);
      if (action === 'refresh') renderSingleVariants();
    });
    ['originalName', 'cardmarketName', 'fullNumber', 'searchNumber', 'setCode', 'setName'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('input', renderSingleVariants);
    });
    document.querySelectorAll('#typeChips .chip,#langChips .chip').forEach((chip) => chip.addEventListener('click', () => setTimeout(renderSingleVariants, 40)));
    renderSingleVariants();
  }

  function renderSingleVariants() {
    const grid = document.querySelector('#cwSingleVariants .cwVariantGrid');
    if (!grid) return;
    const selected = selectedSingleVersion();
    grid.innerHTML = VERSIONS.map((version) => {
      const url = buildVariantUrl(singleCard(version.value), version.value);
      const disabled = url ? '' : ' disabled';
      const active = selected === version.value ? ' active' : '';
      return `<button class="cwVariantBtn${active}" type="button" data-version="${version.value}"${disabled}>${version.label}</button>`;
    }).join('');
  }

  function ensureMultiVariants(cardEl) {
    if (!cardEl || cardEl.querySelector('.cwMultiVariants')) return;
    const urlBox = cardEl.querySelector('.url');
    if (!urlBox) return;
    const box = document.createElement('div');
    box.className = 'cwVariantBox cwMultiVariants';
    box.innerHTML = '<div class="cwVariantHead"><span>Varianten testen</span></div><div class="cwVariantGrid"></div><div class="cwVariantHint">Nimm die Variante, die bei Cardmarket wirklich Treffer zeigt.</div>';
    urlBox.parentNode.insertBefore(box, urlBox.nextSibling);
    box.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-version]');
      if (!button) return;
      const select = cardEl.querySelector('select[data-k="cardVersion"]');
      if (select) {
        select.value = button.dataset.version;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const card = readCardFromCardEl(cardEl);
      openUrl(buildVariantUrl(card, button.dataset.version));
      renderMultiVariants(cardEl);
    });
    renderMultiVariants(cardEl);
  }

  function readCardFromCardEl(cardEl) {
    const field = (key) => cardEl.querySelector(`input[data-k="${key}"],select[data-k="${key}"]`)?.value || '';
    return {
      originalName: field('originalName'),
      cardmarketName: field('cardmarketName'),
      fullNumber: padNumber(field('fullNumber')),
      searchNumber: searchNumber(field('fullNumber')),
      setCode: field('setCode'),
      setName: field('setName'),
      cardVersion: field('cardVersion'),
      languageCode: document.querySelector('#langChips .chip.active')?.dataset.code || '3'
    };
  }

  function renderMultiVariants(cardEl) {
    const grid = cardEl.querySelector('.cwMultiVariants .cwVariantGrid');
    if (!grid) return;
    const card = readCardFromCardEl(cardEl);
    const selected = card.cardVersion || '';
    grid.innerHTML = VERSIONS.map((version) => {
      const url = buildVariantUrl(card, version.value);
      const disabled = url ? '' : ' disabled';
      const active = selected === version.value ? ' active' : '';
      return `<button class="cwVariantBtn${active}" type="button" data-version="${version.value}"${disabled}>${version.label}</button>`;
    }).join('');
  }

  function enhanceMultiCards() {
    document.querySelectorAll('#multiResults .resultCard').forEach((cardEl) => {
      ensureMultiVariants(cardEl);
      cardEl.querySelectorAll('input[data-k],select[data-k]').forEach((field) => {
        if (field.dataset.cwVariantListener === '1') return;
        field.dataset.cwVariantListener = '1';
        field.addEventListener('input', () => renderMultiVariants(cardEl));
        field.addEventListener('change', () => renderMultiVariants(cardEl));
      });
    });
  }

  function install() {
    addStyle();
    installIcons();
    ensureSingleVariants();
    enhanceMultiCards();
    const multi = document.getElementById('multiResults');
    if (multi && !window.__cwCardmarketHelperObserver) {
      window.__cwCardmarketHelperObserver = new MutationObserver(() => setTimeout(enhanceMultiCards, 80));
      window.__cwCardmarketHelperObserver.observe(multi, { childList: true, subtree: true });
    }
  }

  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();
