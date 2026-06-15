// Multi-Scan Fix v1
// Fügt Regex-Nachkorrektur, Bottom-Crop-Fallback und bessere Multi-Metadaten hinzu.
// Einbinden in index.html direkt vor </body>:
// <script src="multi-scan-fix.js"></script>

(function(){
  function $(id){ return document.getElementById(id); }
  function norm(v){ return String(v || '').trim(); }

  window.extractCardMeta = function extractCardMeta(text){
    const rawOriginal = String(text || '');
    const raw = rawOriginal
      .toUpperCase()
      .replace(/[|]/g, '/')
      .replace(/\bO(?=\d)/g, '0')
      .replace(/(?<=\d)O\b/g, '0')
      .replace(/\s+/g, ' ')
      .replace(/S\s*V/g, 'SV')
      .replace(/B\s*L\s*K/g, 'BLK')
      .replace(/W\s*H\s*T/g, 'WHT')
      .trim();

    let fullNumber = '';
    let searchNumber = '';

    const numberMatch = raw.match(/\b([A-Z]{0,3}\d{1,3})\s*\/\s*(\d{1,3})\b/);
    if(numberMatch){
      fullNumber = `${numberMatch[1]}/${numberMatch[2]}`;
      searchNumber = numberMatch[1];
    } else {
      const specialMatch = raw.match(/\b(TG\d{1,2}|GG\d{1,2}|SV\d{1,3})\b/);
      if(specialMatch){
        fullNumber = specialMatch[1];
        searchNumber = specialMatch[1];
      }
    }

    let setCode = '';
    const setMatch = raw.match(/\b(SV\d{1,2}[A-Z]?|S\d{1,2}[A-Z]?|M\d[A-Z]?|BLK|B1K|BK|WHT|WH|WF|MEW|PAF|PRE|SSP|SCR|TWM|TEF|PAR|OBF|PAL|SVI|MEG)\b/);
    if(setMatch) setCode = setMatch[1];

    setCode = setCode
      .replace(/^BK$/, 'BLK')
      .replace(/^B1K$/, 'BLK')
      .replace(/^WH$/, 'WHT')
      .replace(/^WF$/, 'WHT')
      .replace(/^SVBA$/, 'SV8A');

    return { fullNumber, searchNumber, setCode, rawText: rawOriginal };
  };

  window.makeBottomCrop = async function makeBottomCrop(imageData){
    const img = await new Promise((resolve, reject)=>{
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = imageData;
    });

    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const y = Math.round(img.height * 0.62);
    const h = Math.round(img.height * 0.36);
    const x = Math.round(img.width * 0.04);
    const w = Math.round(img.width * 0.92);

    const out = document.createElement('canvas');
    out.width = 1200;
    out.height = Math.round(1200 * h / w);
    out.getContext('2d').drawImage(c, x, y, w, h, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.92);
  };

  window.scanCardWithMetaFallback = async function scanCardWithMetaFallback(cardImage, extraText){
    const first = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'single', image: cardImage, extraText: extraText || '' })
    });
    const firstData = await first.json();
    if(!firstData.ok) throw new Error(firstData.error || 'Scan fehlgeschlagen');

    let card = (firstData.cards || [])[0] || {};
    let meta = window.extractCardMeta([
      card.fullNumber,
      card.searchNumber,
      card.setCode,
      card.setName,
      card.originalName,
      extraText
    ].filter(Boolean).join(' '));

    if(!card.fullNumber && meta.fullNumber) card.fullNumber = meta.fullNumber;
    if(!card.searchNumber && meta.searchNumber) card.searchNumber = meta.searchNumber;
    if(!card.setCode && meta.setCode) card.setCode = meta.setCode;

    if(!card.fullNumber || !card.setCode){
      const bottomCrop = await window.makeBottomCrop(cardImage);
      const second = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          image: bottomCrop,
          extraText: 'Dies ist nur der untere Kartenbereich. Lies ausschließlich Kartennummer, Suchnummer, Setcode und Setname. ' + (extraText || '')
        })
      });
      const secondData = await second.json();
      const bottomCard = (secondData.cards || [])[0] || {};
      const bottomMeta = window.extractCardMeta([
        bottomCard.fullNumber,
        bottomCard.searchNumber,
        bottomCard.setCode,
        bottomCard.setName,
        bottomCard.raw,
        extraText
      ].filter(Boolean).join(' '));

      if(!card.fullNumber) card.fullNumber = bottomCard.fullNumber || bottomMeta.fullNumber || '';
      if(!card.searchNumber) card.searchNumber = bottomCard.searchNumber || bottomMeta.searchNumber || '';
      if(!card.setCode) card.setCode = bottomCard.setCode || bottomMeta.setCode || '';
      if(!card.setName) card.setName = bottomCard.setName || '';
      card.bottomCropUsed = true;
      card.bottomCropImage = bottomCrop;
    }

    if(card.setCode){
      card.setCode = String(card.setCode).toUpperCase()
        .replace(/^BK$/, 'BLK')
        .replace(/^B1K$/, 'BLK')
        .replace(/^WH$/, 'WHT')
        .replace(/^WF$/, 'WHT');
    }

    return card;
  };

  window.addEventListener('load', function(){
    const status = $('scanStatus');
    if(status && !status.dataset.multiFix){
      status.dataset.multiFix = '1';
      status.textContent = status.textContent + ' · Multi-Fix geladen.';
    }
  });
})();
