// Card DB Matcher v1
// Ziel: Scanner-Ergebnis wird nicht blind übernommen, sondern gegen eine Kartendatenbank gematcht.
// Einbindung in index.html direkt vor </body>:
// <script src="card-db-matcher.js"></script>

(function(){
  function norm(v){
    return String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[‐‑‒–—]/g, '-')
      .replace(/[-_]+/g, ' ')
      .replace(/[^a-z0-9äöüß\.\/ ]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanNum(v){
    return String(v || '').toUpperCase().replace(/\s/g, '');
  }

  function loadCardDb(){
    try { return JSON.parse(localStorage.getItem('cw_card_db')) || DEFAULT_CARD_DB; }
    catch { return DEFAULT_CARD_DB; }
  }

  function saveCardDb(db){
    localStorage.setItem('cw_card_db', JSON.stringify(db || []));
  }

  const DEFAULT_CARD_DB = [
    // Start-Beispiele. Diese DB kann später stark erweitert werden.
    { de:'Mauzi ex', en:'Meowth-ex', cm:'Meowth-ex', setCode:'SV8A', setName:'Terastal-Festival-ex', number:'172/187', languageCode:'3' },
    { de:'Psiana ex', en:'Espeon-ex', cm:'Espeon-ex', setCode:'SV8A', setName:'Terastal-Festival-ex', number:'175/187', languageCode:'3' },
    { de:'Terapagos ex', en:'Terapagos-ex', cm:'Terapagos-ex', setCode:'SV8A', setName:'Terastal-Festival-ex', number:'170/187', languageCode:'3' },
    { de:'Keldeo ex', en:'Keldeo-ex', cm:'Keldeo-ex', setCode:'SV8A', setName:'Terastal-Festival-ex', number:'', languageCode:'7' },
    { de:'Durengard EX', en:'Aegislash-EX', cm:'Aegislash-EX', setCode:'', setName:'', number:'', languageCode:'3' }
  ];

  function scoreCard(scan, card){
    const sName = norm(scan.originalName || scan.cardmarketName || scan.name || '');
    const sCm = norm(scan.cardmarketName || '');
    const sNum = cleanNum(scan.fullNumber || scan.searchNumber || '');
    const sCode = cleanNum(scan.setCode || '');
    let score = 0;

    const names = [card.de, card.en, card.cm].map(norm).filter(Boolean);
    for(const n of names){
      if(!n) continue;
      if(sName === n || sCm === n) score += 60;
      else if(sName && (n.includes(sName) || sName.includes(n))) score += 38;
    }

    if(sNum && cleanNum(card.number) === sNum) score += 55;
    else if(sNum && cleanNum(card.number).startsWith(sNum)) score += 35;

    if(sCode && cleanNum(card.setCode) === sCode) score += 35;
    if(scan.setName && norm(card.setName) === norm(scan.setName)) score += 20;
    if(scan.languageCode && String(card.languageCode || '') === String(scan.languageCode)) score += 8;

    return score;
  }

  window.findCardMatches = function findCardMatches(scan, limit){
    const db = loadCardDb();
    return db
      .map(card => ({ card, score: scoreCard(scan || {}, card) }))
      .filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0, limit || 5);
  };

  window.applyCardMatchToScan = function applyCardMatchToScan(scan, match){
    const c = match.card || match;
    return {
      ...(scan || {}),
      originalName: c.de || scan.originalName || '',
      cardmarketName: c.cm || c.en || scan.cardmarketName || '',
      fullNumber: c.number || scan.fullNumber || '',
      searchNumber: c.number ? String(c.number).split('/')[0] : (scan.searchNumber || ''),
      setCode: c.setCode || scan.setCode || '',
      setName: c.setName || scan.setName || '',
      languageCode: c.languageCode || scan.languageCode || '3'
    };
  };

  window.cardDbMatcher = {
    loadCardDb,
    saveCardDb,
    findCardMatches: window.findCardMatches,
    applyCardMatchToScan: window.applyCardMatchToScan,
    DEFAULT_CARD_DB
  };
})();
