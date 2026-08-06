import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ScanHistoryEntry } from '../types';
import { ErrorBox, Panel } from './Layout';

export function HistoryView() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); setError(''); try { setEntries((await api.history()).scans); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Historie konnte nicht geladen werden.'); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  return <Panel title="Scan-Historie" intro="Es werden nur strukturierte Ergebnisse angezeigt, keine vollständigen Kartenbilder.">
    <div className="button-row"><button className="secondary" onClick={() => void load()}>Aktualisieren</button><button className="danger" disabled={!entries.length} onClick={async () => { if (!window.confirm('Scan-Historie wirklich löschen?')) return; await api.clearHistory(); setEntries([]); }}>Historie löschen</button></div>
    <ErrorBox error={error} />{loading ? <p className="muted">Lade …</p> : <div className="history-list">{entries.map((entry) => <article key={entry.id}><strong>{entry.card.name || 'Unbekannte Karte'}</strong><p>{[entry.card.number, entry.card.setCode, new Date(entry.createdAt).toLocaleString('de-DE')].filter(Boolean).join(' · ')}</p>{entry.confidence !== null && <span className="score">Confidence {Math.round(entry.confidence * (entry.confidence <= 1 ? 100 : 1))}%</span>}</article>)}{!entries.length && <p className="empty">Keine Scans vorhanden.</p>}</div>}
  </Panel>;
}
