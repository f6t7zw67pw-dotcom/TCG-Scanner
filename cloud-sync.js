// Account-based cloud sync UI for Card Wizard Pro. Uses HttpOnly session cookies after login.
(function () {
  const AUTO_KEY = 'cw_cloud_auto';
  const CURSOR_KEY = 'cw_cloud_cursor';
  let syncing = false;
  let pushTimer = null;
  let currentUser = null;
  let setupRequired = false;

  function $(id) { return document.getElementById(id); }
  function toast(text) {
    if (typeof window.toast === 'function') window.toast(text);
    else console.log(text);
  }
  function collection() {
    try { return normalizeLocalCards(JSON.parse(localStorage.getItem('cw_collection') || '[]') || []); }
    catch { return []; }
  }
  function newId() {
    return globalThis.crypto?.randomUUID?.() || `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  function validDate(value) { return Number.isFinite(Date.parse(String(value || ''))); }
  function normalizeLocalCard(card) {
    const next = { ...(card || {}) };
    next.id = String(next.id || newId());
    next.version = Math.max(1, Math.trunc(Number(next.version) || 1));
    next.updatedAt = validDate(next.updatedAt) ? new Date(next.updatedAt).toISOString()
      : (validDate(next.createdAt) ? new Date(next.createdAt).toISOString() : new Date().toISOString());
    return next;
  }
  function normalizeLocalCards(cards) {
    const seen = new Set();
    return (cards || []).map((card) => {
      const normalized = normalizeLocalCard(card);
      if (seen.has(normalized.id)) normalized.id = newId();
      seen.add(normalized.id);
      return normalized;
    });
  }
  function saveCollection(cards) {
    syncing = true;
    localStorage.setItem('cw_collection', JSON.stringify(cards || []));
    syncing = false;
  }
  function autoSync() { return localStorage.getItem(AUTO_KEY) === '1'; }
  function syncCursor() { return localStorage.getItem(CURSOR_KEY) || ''; }
  function saveSyncCursor(value) {
    if (validDate(value)) localStorage.setItem(CURSOR_KEY, new Date(value).toISOString());
  }
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
  async function apiFetch(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...(options || {}),
      headers: { 'Content-Type': 'application/json', ...(options && options.headers ? options.headers : {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Fehler ${response.status}`);
    return data;
  }
  async function refreshAuth() {
    try {
      const data = await apiFetch('/api/auth');
      currentUser = data.user || null;
      setupRequired = Boolean(data.setupRequired);
    } catch {
      currentUser = null;
    }
    renderAuthState();
    return currentUser;
  }
  async function signUp() {
    const username = $('cwAuthUsername')?.value || '';
    const password = $('cwAuthPassword')?.value || '';
    const setupToken = $('cwSetupToken')?.value || '';
    const displayName = username;
    status('Konto wird erstellt...');
    const data = await apiFetch('/api/auth', {
      method: 'POST',
      headers: setupToken ? { 'x-app-token': setupToken } : {},
      body: JSON.stringify({ action: 'signup', username, password, displayName })
    });
    currentUser = data.user;
    clearPasswordFields();
    renderAuthState();
    status(`Angemeldet als ${currentUser.displayName || currentUser.username}.`, 'ok');
    toast('Konto erstellt');
  }
  async function login() {
    const username = $('cwAuthUsername')?.value || '';
    const password = $('cwAuthPassword')?.value || '';
    status('Anmeldung laeuft...');
    const data = await apiFetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password })
    });
    currentUser = data.user;
    clearPasswordFields();
    renderAuthState();
    status(`Angemeldet als ${currentUser.displayName || currentUser.username}.`, 'ok');
    toast('Angemeldet');
  }
  async function logout() {
    await apiFetch('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) });
    currentUser = null;
    renderAuthState();
    status('Abgemeldet. Lokale Sammlung bleibt auf diesem Geraet.', 'warn');
  }
  function clearPasswordFields() {
    ['cwAuthPassword', 'cwSetupToken'].forEach((id) => { const el = $(id); if (el) el.value = ''; });
  }
  async function pushCloud(silent) {
    if (!currentUser && !(await refreshAuth())) {
      status('Bitte zuerst anmelden.', 'warn');
      return;
    }
    const cards = collection().map(stripHeavyFields);
    saveCollection(cards);
    status(`Cloud: lade ${cards.length} Karten hoch...`);
    const data = await apiFetch('/api/collection', {
      method: 'POST',
      body: JSON.stringify({ cards })
    });
    status(
      data.conflicts
        ? `Cloud: ${data.accepted} gespeichert, ${data.conflicts} neuere Cloud-Versionen beibehalten.`
        : `Cloud: ${data.accepted ?? data.count ?? cards.length} Karten synchronisiert.`,
      data.conflicts ? 'warn' : 'ok'
    );
    if (!silent) toast('Cloud-Sync hochgeladen');
  }
  async function pullCloud() {
    if (!currentUser && !(await refreshAuth())) {
      status('Bitte zuerst anmelden.', 'warn');
      return;
    }
    status('Cloud: lade Sammlung...');
    const cursor = syncCursor();
    const data = await apiFetch(cursor ? `/api/collection?since=${encodeURIComponent(cursor)}` : '/api/collection');
    const cards = cursor ? mergeCards(collection(), data.cards || []) : (data.cards || []).map(normalizeLocalCard);
    saveCollection(cards);
    saveSyncCursor(data.syncCursor);
    status(`Cloud: ${data.count || 0} Aenderungen geladen. App wird aktualisiert.`, 'ok');
    toast('Cloud-Sammlung geladen');
    setTimeout(() => location.reload(), 700);
  }
  async function mergeCloud() {
    if (!currentUser && !(await refreshAuth())) {
      status('Bitte zuerst anmelden.', 'warn');
      return;
    }
    status('Cloud: fuehre lokale und Cloud-Sammlung zusammen...');
    const data = await apiFetch('/api/collection');
    const cards = mergeCards(data.cards || [], collection()).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    saveCollection(cards);
    await pushCloud(true);
    status(`Cloud: ${cards.length} Karten zusammengefuehrt. App wird aktualisiert.`, 'ok');
    setTimeout(() => location.reload(), 700);
  }
  function newerCard(candidate, current) {
    if (!current) return true;
    const candidateVersion = Number(candidate?.version || 1);
    const currentVersion = Number(current?.version || 1);
    if (candidateVersion !== currentVersion) return candidateVersion > currentVersion;
    return Date.parse(candidate?.updatedAt || 0) > Date.parse(current?.updatedAt || 0);
  }
  function mergeCards(base, changes) {
    const byId = new Map((base || []).map((card) => [String(card.id), normalizeLocalCard(card)]));
    (changes || []).forEach((card) => {
      const id = String(card?.id || '');
      if (!id) return;
      if (card.deleted === true) { byId.delete(id); return; }
      const normalized = normalizeLocalCard(card);
      if (newerCard(normalized, byId.get(id))) byId.set(id, normalized);
    });
    return Array.from(byId.values());
  }
  function schedulePush() {
    if (syncing || !autoSync() || !currentUser) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushCloud(true).catch((err) => status(`Cloud: ${err.message}`, 'warn')), 900);
  }
  function patchFetchCredentials() {
    if (window.__cwCloudFetchPatched) return;
    window.__cwCloudFetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.startsWith('/api/scan') || url.startsWith('/api/card-search') || url.startsWith('/api/collection') || url.startsWith('/api/auth')) {
        return originalFetch(input, { ...(init || {}), credentials: 'same-origin' });
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
      .cwSignedIn{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;border:1px solid rgba(33,194,107,.35);background:#062716;border-radius:16px;padding:12px;color:#c9ffdf}
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
      <div class="cwCloudHead"><span>Account & Cloud</span><span class="badge">Neon</span></div>
      <div id="cwAuthState"></div>
      <div id="cwAuthForm">
        <div class="cwCloudGrid">
          <div><label>Benutzername</label><input id="cwAuthUsername" autocomplete="username" placeholder="z. B. patrick"></div>
          <div><label>Passwort</label><input id="cwAuthPassword" type="password" autocomplete="current-password" placeholder="mind. 8 Zeichen"></div>
        </div>
        <div id="cwSetupWrap"><label>Einrichtungscode nur beim Konto erstellen</label><input id="cwSetupToken" type="password" autocomplete="off" placeholder="APP_ACCESS_TOKEN"></div>
        <div class="actions">
          <button class="btn primary" id="cwLogin" type="button">Anmelden</button>
          <button class="btn ghost" id="cwSignup" type="button">Konto erstellen</button>
        </div>
      </div>
      <label class="cwCloudToggle"><input id="cwCloudAuto" type="checkbox"> automatisch nach jedem Speichern hochladen</label>
      <div class="actions">
        <button class="btn ghost" id="cwPullCloud" type="button">Cloud laden</button>
        <button class="btn ghost" id="cwPushCloud" type="button">Lokal hochladen</button>
        <button class="btn primary" id="cwMergeCloud" type="button">Zusammenfuehren</button>
      </div>
      <div id="cwCloudStatus" class="cwCloudStatus">Melde dich an, dann synchronisiert die Sammlung mit der Cloud.</div>
    `;
    card.insertBefore(box, card.firstChild.nextSibling);
    $('cwCloudAuto').checked = autoSync();
    $('cwCloudAuto').addEventListener('change', (event) => {
      localStorage.setItem(AUTO_KEY, event.target.checked ? '1' : '0');
      status(event.target.checked ? 'Cloud: Auto-Sync aktiv.' : 'Cloud: Auto-Sync aus.', event.target.checked ? 'ok' : '');
    });
    $('cwLogin').onclick = () => login().catch((err) => status(`Login: ${err.message}`, 'warn'));
    $('cwSignup').onclick = () => signUp().catch((err) => status(`Konto: ${err.message}`, 'warn'));
    $('cwPullCloud').onclick = () => pullCloud().catch((err) => status(`Cloud: ${err.message}`, 'warn'));
    $('cwPushCloud').onclick = () => pushCloud(false).catch((err) => status(`Cloud: ${err.message}`, 'warn'));
    $('cwMergeCloud').onclick = () => mergeCloud().catch((err) => status(`Cloud: ${err.message}`, 'warn'));
    renderAuthState();
  }
  function renderAuthState() {
    const state = $('cwAuthState');
    const form = $('cwAuthForm');
    const setup = $('cwSetupWrap');
    if (!state || !form) return;
    if (currentUser) {
      state.innerHTML = `<div class="cwSignedIn"><span>Angemeldet als <b>${escapeHtml(currentUser.displayName || currentUser.username)}</b></span><button class="miniBtn miniGhost" id="cwLogout" type="button">Abmelden</button></div>`;
      form.classList.add('hidden');
      const button = $('cwLogout');
      if (button) button.onclick = () => logout().catch((err) => status(`Logout: ${err.message}`, 'warn'));
    } else {
      state.innerHTML = setupRequired ? '<div class="cwCloudStatus warn">Noch kein Konto vorhanden. Erstelle eins mit deinem Einrichtungscode.</div>' : '';
      form.classList.remove('hidden');
      if (setup) setup.classList.toggle('hidden', !setupRequired);
    }
  }
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function install() {
    patchFetchCredentials();
    patchStorage();
    ensureUi();
    refreshAuth();
  }
  window.cwCloudSync = { pullCloud, pushCloud, mergeCloud, refreshAuth };
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();
