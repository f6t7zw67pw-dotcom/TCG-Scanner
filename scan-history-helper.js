// Visible scan history UI backed by /api/scans.
(function () {
  function $(id) { return document.getElementById(id); }

  function toast(text) {
    if (typeof window.toast === 'function') window.toast(text);
    else console.log(text);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  async function apiFetch(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...(options || {}),
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Fehler ${response.status}`);
    return data;
  }

  function addStyle() {
    if ($('cw-scan-history-style')) return;
    const style = document.createElement('style');
    style.id = 'cw-scan-history-style';
    style.textContent = `
      .cwScanHistory{margin:14px 0;border:1px solid rgba(89,117,165,.36);border-radius:20px;background:linear-gradient(180deg,rgba(8,18,33,.98),rgba(5,13,26,.98));padding:14px;display:grid;gap:10px}
      .cwScanHistoryHead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-weight:900}
      .cwScanHistoryStatus{font-size:13px;color:#a8b3c6;line-height:1.4;border:1px solid rgba(89,117,165,.28);border-radius:14px;padding:10px;background:#071426}
      .cwScanHistoryStatus.ok{color:#c9ffdf;border-color:rgba(33,194,107,.42);background:#062716}
      .cwScanHistoryStatus.warn{color:#ffd7bd;border-color:rgba(255,157,69,.42);background:#321407}
      .cwScanHistoryList{display:grid;gap:8px;max-height:360px;overflow:auto;padding-right:2px}
      .cwScanHistoryItem{border:1px solid rgba(89,117,165,.26);border-radius:14px;background:#071426;padding:10px;display:grid;gap:6px}
      .cwScanHistoryItem b{color:#f5f7fb}.cwScanHistoryItem .small{color:#a8b3c6;font-size:13px;line-height:1.35}
      .cwScanHistoryMeta{display:flex;gap:8px;flex-wrap:wrap}.cwScanHistoryChip{border:1px solid rgba(150,170,255,.28);border-radius:999px;padding:5px 8px;background:#102039;color:#dbe7ff;font-size:12px;font-weight:850}
      @media(max-width:620px){.cwScanHistoryHead .actions{width:100%}.cwScanHistoryHead .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function status(text, type) {
    const el = $('cwScanHistoryStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `cwScanHistoryStatus ${type || ''}`.trim();
  }

  function render(scans) {
    const list = $('cwScanHistoryList');
    if (!list) return;
    if (!scans.length) {
      list.innerHTML = '<div class="cwScanHistoryStatus">Noch keine Scan-Historie in der Cloud. Nach dem naechsten KI-Scan erscheint hier ein Eintrag.</div>';
      return;
    }
    list.innerHTML = scans.map((scan) => {
      const card = scan.card || {};
      const title = card.name || 'Unbekannte Karte';
      const detail = [card.number, card.setCode || card.setName].filter(Boolean).join(' · ');
      const confidence = scan.confidence === null || scan.confidence === undefined ? '' : `${Math.round(Number(scan.confidence))}% Confidence`;
      const date = scan.createdAt ? new Date(scan.createdAt).toLocaleString('de-DE') : '';
      return `
        <div class="cwScanHistoryItem">
          <b>${escapeHtml(title)}</b>
          <div class="small">${escapeHtml(detail || 'Keine Kartendetails erkannt')}</div>
          <div class="cwScanHistoryMeta">
            <span class="cwScanHistoryChip">${escapeHtml(scan.mode || 'single')}</span>
            ${confidence ? `<span class="cwScanHistoryChip">${escapeHtml(confidence)}</span>` : ''}
            ${date ? `<span class="cwScanHistoryChip">${escapeHtml(date)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadHistory() {
    status('Scan-Historie wird geladen...');
    const data = await apiFetch('/api/scans?limit=20');
    render(data.scans || []);
    status(`${data.count || 0} Cloud-Scans geladen.`, 'ok');
  }

  async function clearHistory() {
    if (!confirm('Scan-Historie wirklich loeschen? Deine Sammlung bleibt erhalten.')) return;
    status('Scan-Historie wird geloescht...');
    await apiFetch('/api/scans', { method: 'DELETE' });
    render([]);
    status('Scan-Historie geloescht.', 'ok');
    toast('Scan-Historie geloescht');
  }

  function ensureUi() {
    const section = $('collection');
    const card = section && section.querySelector('.card');
    if (!card || $('cwScanHistory')) return;
    addStyle();
    const box = document.createElement('div');
    box.id = 'cwScanHistory';
    box.className = 'cwScanHistory';
    box.innerHTML = `
      <div class="cwScanHistoryHead">
        <span>Scan-Historie</span>
        <div class="actions">
          <button class="btn ghost" id="cwLoadScanHistory" type="button">Historie laden</button>
          <button class="btn ghost" id="cwClearScanHistory" type="button">Historie loeschen</button>
        </div>
      </div>
      <div id="cwScanHistoryStatus" class="cwScanHistoryStatus">Nach dem naechsten KI-Scan speichert Neon eine Historie fuer dein Konto.</div>
      <div id="cwScanHistoryList" class="cwScanHistoryList"></div>
    `;
    const cloud = $('cwCloudCard');
    if (cloud && cloud.parentNode === card) cloud.insertAdjacentElement('afterend', box);
    else card.insertBefore(box, card.firstChild.nextSibling);
    $('cwLoadScanHistory').onclick = () => loadHistory().catch((err) => status(err.message || 'Historie konnte nicht geladen werden.', 'warn'));
    $('cwClearScanHistory').onclick = () => clearHistory().catch((err) => status(err.message || 'Historie konnte nicht geloescht werden.', 'warn'));
  }

  function install() {
    ensureUi();
  }

  window.cwScanHistory = { loadHistory };
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 600);
    setTimeout(install, 1600);
  });
})();
