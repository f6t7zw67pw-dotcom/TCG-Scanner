// Session-only cloud sync UI for Card Wizard Pro. Local mode keeps working without Neon.
(function () {
  const AUTO_KEY = 'cw_cloud_auto';
  const USER_KEY = 'cw_cloud_user';
  let sessionToken = '';
  let syncing = false;
  let pushTimer = null;

  function $(id) { return document.getElementById(id); }
  function toast(text) {
    if (typeof window.toast === 'function') window.toast(text);
    else console.log(text);
  }
  function collection() {
    try { return JSON.parse(localStorage.getItem('cw_collection') || '[]') || []; }
    catch { return []; }
  }
  function saveCollection(cards) {
    syncing = true;
    localStorage.setItem('cw_collection', JSON.stringify(cards || []));
    syncing = false;
  }
  function userId() { return String(localStorage.getItem(USER_KEY) || 'default').trim() || 'default'; }
  function autoSync() { return localStorage.getItem(AUTO_KEY) === '1'; }
  function status(text, type) {
    const el = $('cwCloudStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `cwCloudStatus ${type || ''}`.trim();
  }
  function stripHeavyFields(card) {
    const next = { ...(card || {}) };
    if (typeof next.image === 'string' && next.image.startsWith('data:image/')) delete next.image;
    if (typeof next.cropImage === 'string' && next.cropImage.startsWith('data:image/')) delete next.cropImage;
    return next;
  }
  async function cloudFetch(path, options) {
    const headers = { 'Content-Type': 'application/json', ...(options && options.headers ? options.headers : {}) };
    if (sessionToken) headers['x-app-token'] = sessionToken;
    const response = await fetch(path, { ...(options || {}), headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Cloud Fehler ${response.status}`);
    return data;
  }
  async function pushCloud(silent) {
    if (!sessionToken) {
      status('Cloud: Token nur fuer diese Sitzung eingeben. Lokaler Modus aktiv.', 'warn');
      return;
    }
    const cards = collection().map(stripHeavyFields);
    status(`Cloud: lade ${cards.length} Karten hoch...`);
    const data = await cloudFetch(`/api/collection?user=${encodeURIComponent(userId())}`, {
      method: 'PUT',
      body: JSON.stringify({ cards })
    });
    status(`Cloud: ${data.count || cards.length} Karten synchronisiert.`, 'ok');
    if (!silent) toast('Cloud-Sync hochgeladen');
  }
  async function pullCloud() {
    if (!sessionToken) {
      status('Cloud: Token nur fuer diese Sitzung eingeben. Lokaler Modus aktiv.', 'warn');
      return;
    }
    status('Cloud: lade Sammlung...');
    const data = await cloudFetch(`/api/collection?user=${encodeURIComponent(userId())}`);
    saveCollection(data.cards || []);
    status(`Cloud: ${data.count || 0} Karten geladen. App wird aktualisiert.`, 'ok');
    toast('Cloud-Sammlung geladen');
    setTimeout(() => location.reload(), 700);
  }
  async function mergeCloud() {
    if (!sessionToken) {
      status('Cloud: Token nur fuer diese Sitzung eingeben. Lokaler Modus aktiv.', 'warn');
      return;
    }
    status('Cloud: fuehre lokale und Cloud-Sammlung zusammen...');
    const data = await cloudFetch(`/api/collection?user=${encodeURIComponent(userId())}`);
    const byId = new Map();
    [...(data.cards || []), ...collection()].forEach((card) => byId.set(String(card.id || `${Date.now()}-${Math.random()}`), stripHeavyFields(card)));
    const cards = Array.from(byId.values()).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    saveCollection(cards);
    await pushCloud(true);
    status(`Cloud: ${cards.length} Karten zusammengefuehrt. App wird aktualisiert.`, 'ok');
    setTimeout(() => location.reload(), 700);
  }
  function schedulePush() {
    if (syncing || !autoSync() || !sessionToken) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushCloud(true).catch((err) => status(`Cloud: ${err.message}`, 'warn')), 900);
  }
  function patchFetchAuth() {
    if (window.__cwCloudFetchPatched) return;
    window.__cwCloudFetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (sessionToken && (url.startsWith('/api/scan') || url.startsWith('/api/card-search') || url.startsWith('/api/collection'))) {
        const next = { ...(init || {}) };
        next.headers = { ...(next.headers || {}), 'x-app-token': sessionToken };
        return originalFetch(input, next);
      }
      return originalFetch(input, init);
    };
  }
  function patchStorage() {
    if (window.__cwCloudStoragePatched) return;
    window.__cwCloudStoragePatched = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key) {
      const result = original.apply(this, arguments);
      if (key === 'cw_collection') schedulePush();
      return result;
    };
  }
  function addStyle() {
    if ($('cw-cloud-style')) return;
    const style = document.createElement('style');
    style.id = 'cw-cloud-style';
    style.textContent = `
      .cwCloudCard{margin-bottom:14px;border:1px solid rgba(89,117,165,.36);border-radius:20px;background:linear-gradient(180deg,rgba(8,18,33,.98),rgba(5,13,26,.98));padding:14px;display:grid;gap:10px}
      .cwCloudHead{display:flex;justify-content:space-between;gap:10px;align-items:center;font-weight:900}
      .cwCloudStatus{font-size:13px;color:#a8b3c6;line-height:1.4;border:1px solid rgba(89,117,165,.28);border-radius:14px;padding:10px;background:#071426}
      .cwCloudStatus.ok{color:#c9ffdf;border-color:rgba(33,194,107,.42);background:#062716}
      .cwCloudStatus.warn{color:#ffd7bd;border-color:rgba(255,157,69,.42);background:#321407}
      .cwCloudGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .cwCloudToggle{display:flex;gap:8px;align-items:center;color:#c4cede;font-weight:800}
      .cwCloudToggle input{width:auto}
      @media(max-width:620px){.cwCloudGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
  function ensureUi() {
    const section = $('collection');
    const card = section && section.querySelector('.card');
    if (!card || $('cwCloudCard')) return;
    addStyle();
    const box = document.createElement('div');
    box.id = 'cwCloudCard';
    box.className = 'cwCloudCard';
    box.innerHTML = `
      <div class="cwCloudHead"><span>Cloud-Sync</span><span class="badge">Neon</span></div>
      <div class="cwCloudGrid">
        <div><label>Cloud Token nur diese Sitzung</label><input id="cwCloudToken" type="password" autocomplete="off" placeholder="APP_ACCESS_TOKEN"></div>
        <div><label>Profil</label><input id="cwCloudUser" placeholder="default"></div>
      </div>
      <label class="cwCloudToggle"><input id="cwCloudAuto" type="checkbox"> automatisch nach jedem Speichern hochladen</label>
      <div class="actions">
        <button class="btn ghost" id="cwPullCloud" type="button">Cloud laden</button>
        <button class="btn ghost" id="cwPushCloud" type="button">Lokal hochladen</button>
        <button class="btn primary" id="cwMergeCloud" type="button">Zusammenfuehren</button>
      </div>
      <div id="cwCloudStatus" class="cwCloudStatus">Lokaler Modus aktiv. Fuer Cloud-Sync DATABASE_URL und APP_ACCESS_TOKEN in Vercel setzen.</div>
    `;
    card.insertBefore(box, card.firstChild.nextSibling);
    $('cwCloudUser').value = userId();
    $('cwCloudAuto').checked = autoSync();
    $('cwCloudToken').addEventListener('input', (event) => {
      sessionToken = event.target.value.trim();
      status(sessionToken ? 'Cloud: Token fuer diese Sitzung aktiv.' : 'Cloud: Token entfernt. Lokaler Modus aktiv.', sessionToken ? 'ok' : 'warn');
    });
    $('cwCloudUser').addEventListener('change', (event) => localStorage.setItem(USER_KEY, event.target.value.trim() || 'default'));
    $('cwCloudAuto').addEventListener('change', (event) => {
      localStorage.setItem(AUTO_KEY, event.target.checked ? '1' : '0');
      status(event.target.checked ? 'Cloud: Auto-Sync aktiv.' : 'Cloud: Auto-Sync aus.', event.target.checked ? 'ok' : '');
    });
    $('cwPullCloud').onclick = () => pullCloud().catch((err) => status(`Cloud: ${err.message}`, 'warn'));
    $('cwPushCloud').onclick = () => pushCloud(false).catch((err) => status(`Cloud: ${err.message}`, 'warn'));
    $('cwMergeCloud').onclick = () => mergeCloud().catch((err) => status(`Cloud: ${err.message}`, 'warn'));
  }
  function install() {
    patchFetchAuth();
    patchStorage();
    ensureUi();
  }
  window.cwCloudSync = { pullCloud, pushCloud, mergeCloud };
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();
