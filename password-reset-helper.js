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

  function setupTokenValue() {
    return $('cwResetSetupToken')?.value || $('cwSetupToken')?.value || '';
  }

  function syncSetupToken() {
    const legacy = $('cwSetupToken');
    const visible = $('cwResetSetupToken');
    if (legacy && visible) legacy.value = visible.value;
  }

  async function resetPassword() {
    syncSetupToken();
    const username = $('cwAuthUsername')?.value || '';
    const password = $('cwAuthPassword')?.value || '';
    const setupToken = setupTokenValue();
    setStatus('Passwort wird zurueckgesetzt...');
    const data = await apiFetch('/api/auth', {
      method: 'POST',
      headers: setupToken ? { 'x-app-token': setupToken } : {},
      body: JSON.stringify({ action: 'reset-password', username, password })
    });
    ['cwAuthPassword', 'cwSetupToken', 'cwResetSetupToken'].forEach((id) => { const el = $(id); if (el) el.value = ''; });
    setStatus(`Passwort aktualisiert. Angemeldet als ${data.user?.displayName || data.user?.username || username}.`, 'ok');
    toast('Passwort zurueckgesetzt');
    if (window.cwCloudSync?.refreshAuth) await window.cwCloudSync.refreshAuth();
  }

  function ensureResetCodeField(form, actions) {
    if ($('cwResetSetupWrap')) return;
    const box = document.createElement('div');
    box.id = 'cwResetSetupWrap';
    box.innerHTML = `
      <label>Einrichtungscode fuer Konto erstellen oder Passwort-Reset</label>
      <input id="cwResetSetupToken" type="password" autocomplete="off" placeholder="APP_ACCESS_TOKEN">
    `;
    form.insertBefore(box, actions);
    const input = $('cwResetSetupToken');
    if (input) input.addEventListener('input', syncSetupToken);
  }

  function wireSignupButton() {
    const signup = $('cwSignup');
    if (!signup || signup.dataset.cwSetupSync === '1') return;
    signup.dataset.cwSetupSync = '1';
    signup.addEventListener('click', syncSetupToken, true);
  }

  function install() {
    const form = $('cwAuthForm');
    const actions = form?.querySelector('.actions');
    if (!form || !actions) return;

    ensureResetCodeField(form, actions);
    wireSignupButton();
    syncSetupToken();

    if (!$('cwResetHint')) {
      const hint = document.createElement('div');
      hint.id = 'cwResetHint';
      hint.className = 'cwCloudStatus';
      hint.textContent = 'Benutzername, Passwort und Einrichtungscode eintragen. Dann Konto erstellen oder Passwort zuruecksetzen.';
      actions.parentNode.insertBefore(hint, actions.nextSibling);
    }

    if (!$('cwResetPassword')) {
      const button = document.createElement('button');
      button.className = 'btn ghost';
      button.id = 'cwResetPassword';
      button.type = 'button';
      button.textContent = 'Passwort zuruecksetzen';
      button.onclick = () => resetPassword().catch((err) => setStatus(`Reset: ${err.message}`, 'warn'));
      actions.appendChild(button);
    }
  }

  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
    setTimeout(install, 3000);
  });
})();
