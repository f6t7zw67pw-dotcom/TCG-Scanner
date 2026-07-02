// Keeps German trainer aliases visible after AI-filled scan results.
(function () {
  if (window.__cwScanAliasAutofix) return;
  window.__cwScanAliasAutofix = true;

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

  function setValue(input, value) {
    if (!input || input.value === value) return;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applySingleAlias() {
    const original = document.getElementById('originalName');
    const cardmarket = document.getElementById('cardmarketName');
    const hint = document.getElementById('nameHint');
    if (!original || !cardmarket) return;

    const alias = aliasForName(original.value);
    if (!alias) return;

    const currentFolded = foldName(cardmarket.value);
    const rawFolded = foldName(original.value);
    const aliasFolded = foldName(alias);
    const currentAlias = aliasForName(cardmarket.value);

    if (!currentFolded || currentFolded === rawFolded || currentFolded === aliasFolded || currentAlias === alias) {
      setValue(cardmarket, alias);
      if (hint) hint.textContent = `Alias-Treffer: ${original.value.trim()} -> ${alias}`;
      if (typeof window.buildUrl === 'function') window.buildUrl();
    }
  }

  function applyMultiAliases() {
    document.querySelectorAll('#multiResults .resultCard').forEach((card) => {
      const original = card.querySelector('input[data-k="originalName"]');
      const cardmarket = card.querySelector('input[data-k="cardmarketName"]');
      if (!original || !cardmarket) return;
      const alias = aliasForName(original.value);
      if (!alias) return;
      const currentFolded = foldName(cardmarket.value);
      const rawFolded = foldName(original.value);
      const aliasFolded = foldName(alias);
      const currentAlias = aliasForName(cardmarket.value);
      if (!currentFolded || currentFolded === rawFolded || currentFolded === aliasFolded || currentAlias === alias) {
        setValue(cardmarket, alias);
      }
    });
  }

  function applyAliases() {
    applySingleAlias();
    applyMultiAliases();
  }

  function scheduleAliasPasses() {
    [0, 80, 250, 600, 1200, 2500, 4500].forEach((delay) => setTimeout(applyAliases, delay));
  }

  function install() {
    const aiButton = document.getElementById('aiScanBtn');
    if (aiButton && aiButton.dataset.cwAliasAutofix !== '1') {
      aiButton.dataset.cwAliasAutofix = '1';
      aiButton.addEventListener('click', scheduleAliasPasses, true);
    }

    const original = document.getElementById('originalName');
    if (original && original.dataset.cwAliasAutofix !== '1') {
      original.dataset.cwAliasAutofix = '1';
      original.addEventListener('input', scheduleAliasPasses);
      original.addEventListener('change', scheduleAliasPasses);
    }

    const multi = document.getElementById('multiResults');
    if (multi && !window.__cwScanAliasAutofixObserver) {
      window.__cwScanAliasAutofixObserver = new MutationObserver(scheduleAliasPasses);
      window.__cwScanAliasAutofixObserver.observe(multi, { childList: true, subtree: true });
    }

    scheduleAliasPasses();
  }

  window.cwApplyScanAliases = applyAliases;
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();
