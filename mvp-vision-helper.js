// Visual MVP blueprint for the scanner product direction.
(function () {
  function $(id) { return document.getElementById(id); }

  const pipeline = [
    ['1', 'Bild hochladen', 'Foto oder Datei wird lokal vorbereitet. Upload-first bleibt MVP-freundlich.'],
    ['2', 'Bild vorbereiten', 'Karte zuschneiden, entzerren und lesbarer machen.'],
    ['3', 'OCR & Merkmale', 'Name, Nummer, Set, Sprache und Variantenhinweise werden extrahiert.'],
    ['4', 'Eigener Katalog', 'Treffer kommen aus dem normalisierten Kartenkatalog, nicht direkt von Cardmarket.'],
    ['5', 'Confidence', 'Beste Kandidaten werden mit nachvollziehbarem Score angezeigt.'],
    ['6', 'Preisprovider', 'Cardmarket, Mock, TCGplayer oder eBay bleiben austauschbare Adapter.'],
    ['7', 'Sammlung', 'Bestätigte Karte, Scan und Preis-Snapshot werden gespeichert.']
  ];

  const models = [
    ['cards', 'game, name, normalized_name, set_id, collector_number, rarity, language, image_url'],
    ['card_sets', 'game, name, code, language, release_date, total_cards, logo_url'],
    ['card_variants', 'card_id, variant_type, finish, condition_notes, external_identifiers'],
    ['price_snapshots', 'variant_id, provider, currency, low, trend, average, captured_at'],
    ['scans', 'user_id, detected fields, candidates, confirmed_card_variant_id, confidence']
  ];

  const scoreRows = [
    ['Kartennummer exakt', 50],
    ['Set exakt', 25],
    ['Name gleich/ähnlich', 15],
    ['Sprache stimmt', 5],
    ['Bildähnlichkeit', 20],
    ['Variante erkannt', 10]
  ];

  const phases = [
    ['Jetzt sichtbar', 'Scan-Upload, Trefferliste, Cloud-Sammlung, Preis-Helper, Account-Login'],
    ['MVP 1', 'Neon-Tabellen für cards, card_sets, variants, scans und price_snapshots'],
    ['MVP 2', 'Katalog-Suche mit Scoring und maximal fünf Kandidaten'],
    ['MVP 3', 'Scan bestätigen, Kandidat speichern, Preis-Snapshot anhängen'],
    ['MVP 4', 'Bildspeicher, Löschfrist und spätere Hintergrundjobs']
  ];

  function addStyle() {
    if ($('cw-mvp-style')) return;
    const style = document.createElement('style');
    style.id = 'cw-mvp-style';
    style.textContent = `
      .cwMvpBoard{display:grid;gap:14px;margin-top:14px}
      .cwMvpHero{border:1px solid rgba(89,117,165,.34);border-radius:20px;background:linear-gradient(135deg,rgba(124,60,255,.24),rgba(36,107,255,.16));padding:16px;display:grid;gap:10px}
      .cwMvpHero h3{margin:0;font-size:22px}.cwMvpHero p{margin:0;color:#c4cede;line-height:1.45}
      .cwMvpGrid{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:900px){.cwMvpGrid{grid-template-columns:1fr 1fr}}
      .cwMvpPanel{border:1px solid rgba(89,117,165,.32);border-radius:18px;background:linear-gradient(180deg,rgba(8,18,33,.98),rgba(5,13,26,.98));padding:14px;display:grid;gap:10px}
      .cwMvpPanel h3{margin:0;font-size:18px}.cwMvpPanel .small{color:#a8b3c6}
      .cwMvpFlow{display:grid;gap:9px}.cwMvpStep{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;border:1px solid rgba(89,117,165,.24);border-radius:14px;padding:10px;background:#071426}
      .cwMvpBubble{width:30px;height:30px;border-radius:999px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3cff,#246bff);font-weight:900;color:white}
      .cwMvpStep b{display:block;margin-bottom:3px}.cwMvpStep span{color:#a8b3c6;font-size:13px;line-height:1.35}
      .cwMvpTable{display:grid;gap:8px}.cwMvpRow{display:grid;gap:6px;border:1px solid rgba(89,117,165,.24);border-radius:14px;padding:10px;background:#071426}
      .cwMvpRow b{color:#f5f7fb}.cwMvpRow span{color:#a8b3c6;font-size:13px;line-height:1.35;word-break:break-word}
      .cwScoreRow{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.cwScoreBar{grid-column:1/-1;height:9px;border-radius:999px;background:#081426;overflow:hidden}.cwScoreBar span{display:block;height:100%;background:linear-gradient(90deg,#21c26b,#246bff)}
      .cwMvpApi{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;color:#dbe7ff;background:#050d1a;border:1px solid #263b5c;border-radius:14px;padding:10px;line-height:1.55;white-space:pre-wrap}
      .cwMvpStatus{display:flex;gap:8px;flex-wrap:wrap}.cwMvpChip{border:1px solid rgba(150,170,255,.28);border-radius:999px;padding:7px 10px;background:#102039;color:#dbe7ff;font-size:12px;font-weight:850}
      .cwMvpChip.ready{border-color:rgba(33,194,107,.42);background:#062716;color:#c9ffdf}.cwMvpChip.next{border-color:rgba(255,157,69,.42);background:#321407;color:#ffd7bd}
    `;
    document.head.appendChild(style);
  }

  function renderPipeline() {
    return `<div class="cwMvpFlow">${pipeline.map(([n, title, text]) => `
      <div class="cwMvpStep"><div class="cwMvpBubble">${n}</div><div><b>${title}</b><span>${text}</span></div></div>
    `).join('')}</div>`;
  }

  function renderModels() {
    return `<div class="cwMvpTable">${models.map(([name, fields]) => `
      <div class="cwMvpRow"><b>${name}</b><span>${fields}</span></div>
    `).join('')}</div>`;
  }

  function renderScores() {
    const max = 50;
    return `<div class="cwMvpTable">${scoreRows.map(([name, points]) => `
      <div class="cwScoreRow"><b>${name}</b><span>${points} Punkte</span><div class="cwScoreBar"><span style="width:${Math.min(100, Math.round((points / max) * 100))}%"></span></div></div>
    `).join('')}</div><div class="small">Unter 80 Prozent: Nutzer muss Treffer bestätigen. Über 80 Prozent: trotzdem sichtbar prüfbar.</div>`;
  }

  function renderPhases() {
    return `<div class="cwMvpTable">${phases.map(([title, text], index) => `
      <div class="cwMvpRow"><b>${title}</b><span>${text}</span><div class="cwMvpStatus"><span class="cwMvpChip ${index === 0 ? 'ready' : 'next'}">${index === 0 ? 'vorhanden' : 'nächster Ausbau'}</span></div></div>
    `).join('')}</div>`;
  }

  function ensurePanel() {
    const help = $('help');
    if (!help || $('cwMvpBoard')) return;
    addStyle();
    const board = document.createElement('div');
    board.id = 'cwMvpBoard';
    board.className = 'cwMvpBoard';
    board.innerHTML = `
      <div class="cwMvpHero">
        <h3>TCG Scanner MVP Zielbild</h3>
        <p>Das ist die visualisierte Version deines Zielsystems: eigener Kartenkatalog als Wahrheit, Erkennung mit Kandidaten und Confidence, danach getrennte Preisadapter und Speicherung in deiner Cloud-Sammlung.</p>
        <div class="cwMvpStatus"><span class="cwMvpChip ready">Pokémon zuerst</span><span class="cwMvpChip">später Magic</span><span class="cwMvpChip">später Yu-Gi-Oh!</span><span class="cwMvpChip next">Cardmarket nur Preisprovider</span></div>
      </div>
      <div class="cwMvpGrid">
        <div class="cwMvpPanel"><h3>Scan-Ablauf</h3>${renderPipeline()}</div>
        <div class="cwMvpPanel"><h3>Confidence-Scoring</h3>${renderScores()}</div>
        <div class="cwMvpPanel"><h3>Datenmodell</h3>${renderModels()}</div>
        <div class="cwMvpPanel"><h3>API-Zielbild</h3><div class="cwMvpApi">POST /api/scans
POST /api/scans/:id/confirm
GET  /api/cards/search
GET  /api/cards/:id
GET  /api/cards/:id/prices
GET  /api/collection
POST /api/collection
PATCH /api/collection/:id
DELETE /api/collection/:id</div></div>
        <div class="cwMvpPanel wide"><h3>Umsetzungsphasen</h3>${renderPhases()}</div>
      </div>
    `;
    help.appendChild(board);
  }

  window.addEventListener('load', () => {
    ensurePanel();
    setTimeout(ensurePanel, 500);
    setTimeout(ensurePanel, 1500);
  });
})();
