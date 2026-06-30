// Adds setup-code password reset to the existing Account & Cloud card.
(function () {
  function $(id) { return document.getElementById(id); }

  function toast(text) {
    if (typeof window.toast === 'function') window.toast(text);
    else console.log(text);
  }

  function setStatus(text, type) {
    const el = $('cwCloudStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `cwCloudStatus ${type || ''}`.trim();
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

  async function resetPassword() {
    const username = $('cwAuthUsername')?.value || '';
    const password = $('cwAuthPassword')?.value || '';
    const setupToken = $('cwSetupToken')?.value || '';
    setStatus('Passwort wird zurueckgesetzt...');
    const data = await apiFetch('/api/auth', {
      method: 'POST',
      headers: setupToken ? { 'x-app-token': setupToken } : {},
      body: JSON.stringify({ action: 'reset-password', username, password })
    });
    ['cwAuthPassword', 'cwSetupToken'].forEach((id) => { const el = $(id); if (el) el.value = ''; });
    setStatus(`Passwort aktualisiert. Angemeldet als ${data.user?.displayName || data.user?.username || username}.`, 'ok');
    toast('Passwort zurueckgesetzt');
    if (window.cwCloudSync?.refreshAuth) await window.cwCloudSync.refreshAuth();
  }

  function install() {
    const form = $('cwAuthForm');
    const actions = form?.querySelector('.actions');
    const setupWrap = $('cwSetupWrap');
    if (!form || !actions || $('cwResetPassword')) return;

    if (setupWrap) {
      setupWrap.classList.remove('hidden');
      const label = setupWrap.querySelector('label');
      if (label) label.textContent = 'Einrichtungscode fuer Konto erstellen oder Passwort-Reset';
    }

    const hint = document.createElement('div');
    hint.id = 'cwResetHint';
    hint.className = 'cwCloudStatus';
    hint.textContent = 'Passwort vergessen? Benutzername, neues Passwort und Einrichtungscode eintragen, dann Passwort zuruecksetzen.';
    actions.parentNode.insertBefore(hint, actions.nextSibling);

    const button = document.createElement('button');
    button.className = 'btn ghost';
    button.id = 'cwResetPassword';
    button.type = 'button';
    button.textContent = 'Passwort zuruecksetzen';
    button.onclick = () => resetPassword().catch((err) => setStatus(`Reset: ${err.message}`, 'warn'));
    actions.appendChild(button);
  }

  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();
