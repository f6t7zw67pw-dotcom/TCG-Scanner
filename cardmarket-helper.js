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

  const NAME_ALIASES = {
    schweisser: 'Welder',
    'forschung des professors': "Professor's Research",
    'befehl vom boss': "Boss's Orders",
    'bosss befehle': "Boss's Orders",
    mary: 'Marnie',
    richter: 'Judge',
    'professor eichs hinweis': "Professor Oak's Hint",
    'professor eich': 'Professor Oak',
    'top genesung': 'Full Heal',
    beleber: 'Revive',
    sonderbonbon: 'Rare Candy',
    hyperball: 'Ultra Ball',
    superball: 'Great Ball',
    pokeball: 'Poke Ball',
    'poke ball': 'Poke Ball',
    nestball: 'Nest Ball',
    flottball: 'Quick Ball',
    finsterball: 'Dusk Ball',
    timerball: 'Timer Ball',
    levelball: 'Level Ball',
    freundesball: 'Friend Ball',
    tausch: 'Switch',
    fluchtseil: 'Escape Rope',
    energiewechsel: 'Energy Switch',
    energiesuche: 'Energy Search',
    'energie suche': 'Energy Search',
    'doppelte farblose energie': 'Double Colorless Energy',
    'doppelte turbo energie': 'Double Turbo Energy',
    'feuer energie': 'Fire Energy',
    'wasser energie': 'Water Energy',
    'pflanzen energie': 'Grass Energy',
    'elektro energie': 'Lightning Energy',
    'kampf energie': 'Fighting Energy',
    'psycho energie': 'Psychic Energy',
    'finsternis energie': 'Darkness Energy',
    'metall energie': 'Metal Energy',
    'feen energie': 'Fairy Energy',
    'drachen energie': 'Dragon Energy',
    'kampf vip pass': 'Battle VIP Pass',
    waldsiegelstein: 'Forest Seal Stone',
    erdversiegelungsstein: 'Earthen Seal Stone',
    luftballon: 'Air Balloon',
    wahlband: 'Choice Band',
    wahlschal: 'Choice Scarf',
    riesenumhang: 'Giant Cape',
    stadionruine: 'Ruins of Alph',
    'pfad zum gipfel': 'Path to the Peak',
    'stadt ohne namen': 'Lost City'
  };

  const CROP_SIZE_KEY = 'cw_crop_size';

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

  function foldName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function aliasForName(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const mega = raw.match(/^M\s+(.+?)\s*[- ]\s*EX$/i) || raw.match(/^Mega\s+(.+?)\s*[- ]\s*EX$/i);
    if (mega) return `M ${mega[1].trim()}-EX`;
    const ex = raw.match(/^(.+?)\s*[- ]\s*EX$/i);
    if (ex) return `${ex[1].trim()}-EX`;
    const gx = raw.match(/^(.+?)\s*[- ]\s*GX$/i);
    if (gx) return `${gx[1].trim()}-GX`;
    return NAME_ALIASES[foldName(raw)] || '';
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
      .cwCropSizeBox input[type=range]{accent-color:#7c3cff;width:100%}
      .cwCropSizeBox .cwRangeRow{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
      .cropGrid{grid-template-columns:repeat(auto-fit,minmax(var(--cw-crop-size,150px),1fr))!important}
      .cropCard img{height:calc(var(--cw-crop-size,150px) * 1.38);object-fit:cover}
      #multiResults .preview .thumb{width:var(--cw-result-thumb-width,110px);height:var(--cw-result-thumb-height,145px)}
      .matchBox{max-height:430px;overflow-y:auto;overscroll-behavior:contain;align-content:start}
      .matchBox>b{position:sticky;top:0;z-index:1;background:linear-gradient(180deg,rgba(8,18,33,.98),rgba(8,18,33,.92));padding:4px 0 8px}
      .matchBox::-webkit-scrollbar{width:10px}
      .matchBox::-webkit-scrollbar-track{background:#071426;border-radius:999px}
      .matchBox::-webkit-scrollbar-thumb{background:#304663;border-radius:999px}
      @media(max-width:520px){.cwVariantGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.cwVariantActions{grid-template-columns:1fr}.matchBox{max-height:360px}}
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

  function clampCropSize(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 150;
    return Math.max(110, Math.min(280, parsed));
  }

  function applyCropSize(value) {
    const size = clampCropSize(value);
    document.documentElement.style.setProperty('--cw-crop-size', `${size}px`);
    document.documentElement.style.setProperty('--cw-result-thumb-width', `${Math.round(size * 0.72)}px`);
    document.documentElement.style.setProperty('--cw-result-thumb-height', `${Math.round(size * 0.96)}px`);
    const input = document.getElementById('cwCropSize');
    const label = document.getElementById('cwCropSizeLabel');
    if (input) input.value = String(size);
    if (label) label.textContent = `${size}px`;
    try { localStorage.setItem(CROP_SIZE_KEY, String(size)); } catch {}
  }

  function ensureCropSizeControl() {
    const layout = document.getElementById('cropLayout');
    if (!layout || document.getElementById('cwCropSizeBox')) return;
    const saved = clampCropSize(localStorage.getItem(CROP_SIZE_KEY) || 150);
    const box = document.createElement('div');
    box.id = 'cwCropSizeBox';
    box.className = 'cwVariantBox cwCropSizeBox';
    box.innerHTML = `
      <div class="cwVariantHead"><span>Crop-Größe</span><span id="cwCropSizeLabel">${saved}px</span></div>
      <div class="cwRangeRow"><input id="cwCropSize" type="range" min="110" max="280" step="10" value="${saved}"><span class="cwVariantHint">Vorschau</span></div>
      <div class="cwVariantHint">Vergrößert die Crop-Kacheln und die Crop-Bilder in den Multi-Ergebnissen.</div>
    `;
    layout.parentNode.insertBefore(box, layout.nextSibling);
    box.querySelector('#cwCropSize').addEventListener('input', (event) => applyCropSize(event.target.value));
    applyCropSize(saved);
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

  function applySingleNameAlias() {
    const original = document.getElementById('originalName');
    const cardmarket = document.getElementById('cardmarketName');
    const hint = document.getElementById('nameHint');
    if (!original || !cardmarket) return;
    const alias = aliasForName(original.value);
    if (!alias) return;
    const currentFolded = foldName(cardmarket.value);
    const rawFolded = foldName(original.value);
    const aliasFolded = foldName(alias);
    if (!currentFolded || currentFolded === rawFolded || currentFolded === aliasFolded) {
      cardmarket.value = alias;
      cardmarket.dispatchEvent(new Event('change', { bubbles: true }));
      if (hint) hint.textContent = `Alias-Treffer: ${original.value.trim()} -> ${alias}`;
      if (typeof window.buildUrl === 'function') window.buildUrl();
      renderSingleVariants();
    }
  }

  function installNameAliasHelpers() {
    const original = document.getElementById('originalName');
    if (original && original.dataset.cwNameAlias !== '1') {
      original.dataset.cwNameAlias = '1';
      original.addEventListener('input', () => setTimeout(applySingleNameAlias, 0));
      original.addEventListener('change', () => setTimeout(applySingleNameAlias, 0));
      original.addEventListener('blur', () => setTimeout(applySingleNameAlias, 0));
    }
    const force = document.getElementById('forceTranslateBtn');
    if (force && force.dataset.cwNameAlias !== '1') {
      force.dataset.cwNameAlias = '1';
      force.addEventListener('click', () => setTimeout(applySingleNameAlias, 0));
    }
    setTimeout(applySingleNameAlias, 0);
  }

  function install() {
    addStyle();
    installIcons();
    ensureCropSizeControl();
    applyCropSize(localStorage.getItem(CROP_SIZE_KEY) || 150);
    ensureSingleVariants();
    installNameAliasHelpers();
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