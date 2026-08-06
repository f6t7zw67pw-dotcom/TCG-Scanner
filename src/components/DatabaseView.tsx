import { useState } from 'react';
import { api } from '../lib/api';
import { storage } from '../lib/storage';
import { ErrorBox, Panel } from './Layout';

function formatMap(map: Record<string, string>) { return Object.entries(map).map(([key, value]) => `${key}: ${value}`).join('\n'); }
function parseMap(text: string) { const map: Record<string, string> = {}; for (const line of text.split(/\r?\n/)) { const match = line.match(/^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/); if (match) map[match[1].trim()] = match[2].trim(); } return map; }

export function DatabaseView() {
  const [pokemon, setPokemon] = useState(() => formatMap(storage.loadMap('cw_pokemon'))); const [sets, setSets] = useState(() => formatMap(storage.loadMap('cw_sets'))); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  function save() { storage.saveMap('cw_pokemon', parseMap(pokemon)); storage.saveMap('cw_sets', parseMap(sets)); setMessage('Lokale Alias-Datenbanken gespeichert.'); }
  async function refreshPokemon() { setError(''); try { const map = (await api.pokemon()).pokemon; setPokemon(formatMap(map)); storage.saveMap('cw_pokemon', map); setMessage(`${Object.keys(map).length} Pokémon-Aliase geladen.`); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Import fehlgeschlagen.'); } }
  return <Panel title="Datenbankverwaltung" intro="Lokale Sprach- und Set-Aliase bleiben mit dem bisherigen Speicherformat kompatibel.">
    <ErrorBox error={error} />{message && <div className="message success">{message}</div>}<div className="database-grid"><label>Pokémon-Aliase<textarea rows={18} value={pokemon} onChange={(event) => setPokemon(event.target.value)} placeholder="Glurak: Charizard" /></label><label>Set-Aliase<textarea rows={18} value={sets} onChange={(event) => setSets(event.target.value)} placeholder="MEW: 151" /></label></div>
    <div className="button-row"><button onClick={save}>Lokal speichern</button><button className="secondary" onClick={() => void refreshPokemon()}>Pokémon-DB aktualisieren</button></div>
  </Panel>;
}
