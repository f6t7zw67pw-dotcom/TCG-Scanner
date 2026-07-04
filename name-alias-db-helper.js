// Editable local card-name alias DB for trainer, item, Pokemon and foreign-language names.
(function () {
  if (window.__cwNameAliasDbHelper) return;
  window.__cwNameAliasDbHelper = true;

  const STORAGE_KEY = 'cw_name_aliases';
  const DEFAULT_ALIASES = {
    'Schweißer': 'Welder',
    'Forschung des Professors': "Professor's Research",
    'Befehl vom Boss': "Boss's Orders",
    'Mary': 'Marnie',
    'Richter': 'Judge',
    'Sonderbonbon': 'Rare Candy',
    'Hyperball': 'Ultra Ball',
    'Superball': 'Great Ball',
    'Pokeball': 'Poke Ball',
    'Nestball': 'Nest Ball',
    'Flottball': 'Quick Ball',
    'Tausch': 'Switch',
    'Fluchtseil': 'Escape Rope',
    'Energiesuche': 'Energy Search',
    'Doppelte Turbo Energie': 'Double Turbo Energy',
    'Kampf VIP Pass': 'Battle VIP Pass',
    'Pfad zum Gipfel': 'Path to the Peak',
    'ママンボウ': 'Alomomola',
    'イベルタル': 'Yveltal',
    'フシギダネ': 'Bulbasaur',
    'ピカチュウ': 'Pikachu',
    'リザードン': 'Charizard',
    '伊裴爾塔爾': 'Yveltal',
    '伊裳尔塔尔': 'Yveltal',
    '妙蛙种子': 'Bulbasaur',
    '妙蛙種子': 'Bulbasaur',
    '皮卡丘': 'Pikachu',
    '喷火龙': 'Charizard',
    '噴火龍': 'Charizard'
  };

  function $(id) { return document.getElementById(id); }
  function text(value) { return String(value || '').trim(); }
  function toast(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else console.log(message);
  }
  function fold(value) {
    return text(value)
      .normalize('NFKC')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function toCardmarketName(value) {
    return text(value)
      .replace(/\s+ex$/i, '-ex')
      .replace(/\s+EX$/i, '-EX')
      .replace(/\s+V$/i, '-V')
      .replace(/\s+GX$/i, '-GX');
  }
  function parseLines(value) {
    const map = {};
    String(value || '').split('\n').forEach((line) => {
      const clean = line.trim();
      if (!clean || clean.startsWith('#')) return;
      const match = clean.match(/^(.+?)\s*(?:=>|->|:|=)\s*(.+)$/);
      if (!match) return;
      const alias = text(match[1]);
      const english = text(match[2]);
      if (alias && english) map[alias] = english;
    });
    return map;
  }
  function formatMap(map) {
    return Object.entries(map || {}).map(([alias, english]) => `${alias}: ${english}`).join('\n');
  }
  function readSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  function mergedAliases() {
    return { ...DEFAULT_ALIASES, ...readSaved() };
  }
  function saveAliases(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
    window.dispatchEvent(new CustomEvent('cw:name-aliases-updated'));
  }
  function lookupAlias(value) {
    const wanted = fold(value);
    if (!wanted) return '';
    for (const [alias, english] of Object.entries(mergedAliases())) {
      if (fold(alias) === wanted) return text(english);
    }
    return '';
  }
  function applyToSingle(force) {
    const original = $('originalName');
    const cardmarket = $('cardmarketName');
    const hint = $('nameHint');
    if (!original || !cardmarket) return false;
    const english = lookupAlias(original.value);
    if (!english) return false;
    if (force || !cardmarket.value || /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(cardmarket.value)) {
      cardmarket.value = toCardmarketName(english);
      cardmarket.dispatchEvent(new Event('input', { bubbles: true }));
      cardmarket.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (hint) hint.textContent = `Namens-DB: ${original.value} -> ${english}`;
    if (typeof window.buildUrl === 'function') window.buildUrl();
    return true;
  }
  function installUi() {
    const db = $('db');
    if (!db || $('nameAliasDb')) return;
    const card = document.createElement('div');
    card.className = 'card wide';
    card.innerHTML = `
      <div class="title"><h2>Karten-Namen DB</h2><span class="badge">Alias -> Englisch</span></div>
      <div class="small">Format pro Zeile: fremder/deutscher Name: Englischer Name. Funktioniert auch mit Japanisch, Chinesisch, Trainer, Items und Energien.</div>
      <textarea id="nameAliasDb" style="min-height:260px" spellcheck="false"></textarea>
      <div class="actions">
        <button class="btn primary" id="saveNameAliasDb" type="button">Namen DB speichern</button>
        <button class="btn ghost" id="testNameAliasDb" type="button">Aktuellen Namen testen</button>
      </div>
      <div id="nameAliasDbHint" class="small">Diese DB wird vor der Treffer-Suche und beim Scan-Feld genutzt.</div>
    `;
    db.appendChild(card);
    $('nameAliasDb').value = formatMap(mergedAliases());
    $('saveNameAliasDb').onclick = () => {
      saveAliases(parseLines($('nameAliasDb').value));
      toast('Karten-Namen DB gespeichert');
      applyToSingle(true);
    };
    $('testNameAliasDb').onclick = () => {
      const name = text($('originalName')?.value || $('cardmarketName')?.value || '');
      const english = lookupAlias(name);
      const hint = $('nameAliasDbHint');
      if (hint) hint.textContent = english ? `${name} -> ${english}` : 'Kein Alias fuer den aktuellen Namen gefunden.';
      if (english) applyToSingle(true);
    };
  }
  function installSingleHandlers() {
    const original = $('originalName');
    const force = $('forceTranslateBtn');
    if (original && original.dataset.cwNameAlias !== '1') {
      original.dataset.cwNameAlias = '1';
      original.addEventListener('input', () => setTimeout(() => applyToSingle(false), 0));
      original.addEventListener('change', () => applyToSingle(false));
    }
    if (force && force.dataset.cwNameAlias !== '1') {
      force.dataset.cwNameAlias = '1';
      force.addEventListener('click', () => setTimeout(() => applyToSingle(true), 30));
    }
  }
  function install() {
    installUi();
    installSingleHandlers();
  }

  window.cwNameAliasLookup = lookupAlias;
  window.cwNameAliasMap = mergedAliases;
  window.cwApplyNameAliasToSingle = applyToSingle;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();
