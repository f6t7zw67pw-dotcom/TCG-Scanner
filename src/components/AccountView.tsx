import { useState, type FormEvent } from 'react';
import { useAppState } from '../state/AppState';
import { ErrorBox, Panel } from './Layout';

export function AccountView() {
  const { user, login, logout, pull, push, busy, notify } = useAppState();
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { await login(username, password); setPassword(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Anmeldung fehlgeschlagen.'); } }
  async function sync(action: () => Promise<string>) { setError(''); try { notify(await action()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cloud-Sync fehlgeschlagen.'); } }
  return <div className="stack"><Panel title="Account und Cloud-Sync" intro="Cloudaktionen sind explizit und patchen weder fetch noch localStorage.">
    <ErrorBox error={error} />
    {user ? <><div className="account-card"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName || user.username}</strong><p>Angemeldet</p></div></div>
      <div className="button-row"><button disabled={busy} onClick={() => void sync(push)}>Lokal → Cloud</button><button className="secondary" disabled={busy} onClick={() => void sync(pull)}>Cloud → Lokal</button><button className="danger" disabled={busy} onClick={() => void logout()}>Abmelden</button></div></>
      : <form className="form-grid compact" onSubmit={(event) => void submit(event)}><label>Benutzername<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>Passwort<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy || !username || !password}>Anmelden</button></form>}
  </Panel></div>;
}
