import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { cardmarketUrl, safeHttpUrl } from '../lib/links';
import { useAppState } from '../state/AppState';
import type { CardRecord } from '../types';
import { ErrorBox, Panel } from './Layout';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

export function CollectionView() {
  const { cards, updateCard, removeCard, notify } = useAppState();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [pricing, setPricing] = useState('');
  const filtered = useMemo(() => cards.filter((card) => JSON.stringify(card).toLocaleLowerCase().includes(query.toLocaleLowerCase())), [cards, query]);

  async function fetchPrice(card: CardRecord) {
    if (!card.catalogId) return setError('Preisabfrage erst nach bestätigtem Katalogtreffer möglich.');
    setPricing(card.id); setError('');
    try {
      const result = await api.price(card);
      updateCard(card.id, { price: result.price === undefined ? '' : String(result.price), priceSource: result.provider || result.source || '', priceFetchedAt: result.fetchedAt || new Date().toISOString() });
      notify(result.price === undefined ? 'Kein Preis verfügbar.' : 'Preis-Snapshot aktualisiert.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Preisabfrage fehlgeschlagen.'); }
    finally { setPricing(''); }
  }

  return <Panel title="Sammlung" intro={`${cards.length} Karten im lokalen, Phase-2-kompatiblen Speicher.`}>
    <div className="toolbar"><input type="search" placeholder="Sammlung durchsuchen …" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button className="secondary" type="button" onClick={() => download('collection.json', JSON.stringify(cards, null, 2), 'application/json')}>JSON Export</button>
      <button className="secondary" type="button" onClick={() => download('collection.csv', cards.map((card) => [card.originalName, card.fullNumber, card.setCode, card.price].join(';')).join('\n'), 'text/csv')}>CSV Export</button></div>
    <ErrorBox error={error} />
    <div className="collection-list">{filtered.map((card) => {
      const image = safeHttpUrl(card.imageSmall) || safeHttpUrl(card.image) || (card.image?.startsWith('data:image/') ? card.image : '');
      const market = cardmarketUrl(card);
      return <article className="collection-card" key={card.id}>
        {image && <img src={image} alt="" />}<div className="grow"><strong>{card.cardmarketName || card.originalName || 'Unbenannt'}</strong><p>{[card.fullNumber, card.setCode, card.setName].filter(Boolean).join(' · ') || 'Noch keine Kartendetails'}</p>
          <div className="inline-fields"><label>Menge<input type="number" min="1" value={Number(card.quantity || 1)} onChange={(event) => updateCard(card.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></label><label>Preis<input value={card.price || ''} onChange={(event) => updateCard(card.id, { price: event.target.value })} /></label></div>
          {card.priceSource && <small className="muted">{card.priceSource} · {card.priceFetchedAt ? new Date(card.priceFetchedAt).toLocaleString('de-DE') : ''}</small>}
          <div className="button-row">{market && <a className="button secondary" href={market} target="_blank" rel="noopener noreferrer">Cardmarket</a>}<button className="secondary" disabled={pricing === card.id} onClick={() => void fetchPrice(card)}>Preis abrufen</button><button className="danger" onClick={() => void removeCard(card.id)}>Entfernen</button></div>
        </div>
      </article>;
    })}{!filtered.length && <p className="empty">Keine Karten gefunden.</p>}</div>
  </Panel>;
}
