import type { ReactNode } from 'react';
import { useAppState } from '../state/AppState';
import type { ViewId } from '../types';

const navigation: { id: ViewId; label: string; icon: string }[] = [
  { id: 'scanner', label: 'Scanner', icon: '⌁' },
  { id: 'collection', label: 'Sammlung', icon: '▣' },
  { id: 'account', label: 'Account', icon: '●' },
  { id: 'history', label: 'Historie', icon: '↺' },
  { id: 'database', label: 'Datenbank', icon: '≡' },
  { id: 'help', label: 'Hilfe', icon: '?' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { view, setView, notice, user } = useAppState();
  return <>
    <header className="topbar">
      <div><span className="eyebrow">TCG COLLECTION TOOL</span><h1>Card Wizard <em>Pro</em></h1></div>
      <span className={`status-pill ${user ? 'online' : ''}`}>{user ? user.username : 'Lokal'}</span>
    </header>
    <main className="shell">{children}</main>
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {navigation.map((item) => <button key={item.id} type="button" className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
        <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
      </button>)}
    </nav>
    {notice && <div className="toast" role="status">{notice}</div>}
  </>;
}

export function Panel({ title, intro, children, className = '' }: { title: string; intro?: string; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><h2>{title}</h2>{intro && <p>{intro}</p>}</div>{children}</section>;
}

export function ErrorBox({ error }: { error: string }) {
  return error ? <div className="message error" role="alert">{error}</div> : null;
}
