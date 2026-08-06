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
      const price = typeof result.price === 'object' && result.price ? result.price.amount : result.price;
      updateCard(card.id, { saleValue: price === undefined || price === null ? null : Number(price), price: price === undefined || price === null ? '' : String(price), priceSource: result.provider || result.source || '', priceFetchedAt: result.fetchedAt || new Date().toISOString() });
      notify(price === undefined || price === null ? 'Kein Preis verfügbar.' : 'Preis-Snapshot aktualisiert.');
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
          <p className="variant-line">{[card.language, card.finish, card.edition, card.treatment, card.gradingProvider && `${card.gradingProvider} ${card.grade || ''}`].filter(Boolean).join(' · ')}</p>
          <details className="variant-editor"><summary>Variante bearbeiten</summary><div className="variant-fields">
            <label>Sprache<input value={card.language || ''} onChange={(event) => updateCard(card.id, { language: event.target.value })} placeholder="de, en, ja …" /></label>
            <label>Oberfläche<select value={card.finish || 'normal'} onChange={(event) => updateCard(card.id, { finish: event.target.value as CardRecord['finish'] })}><option value="normal">Normal</option><option value="holo">Holo</option><option value="reverse_holo">Reverse Holo</option><option value="other">Andere</option></select></label>
            <label>Edition<select value={card.edition || 'unlimited'} onChange={(event) => updateCard(card.id, { edition: event.target.value as CardRecord['edition'] })}><option value="unlimited">Unlimited</option><option value="first_edition">First Edition</option><option value="promo">Promo</option><option value="other">Andere</option></select></label>
            <label>Treatment<input value={card.treatment || ''} onChange={(event) => updateCard(card.id, { treatment: event.target.value })} placeholder="standard" /></label>
            <label>Zustand<select value={card.condition || 'ungraded'} onChange={(event) => updateCard(card.id, { condition: event.target.value })}><option value="ungraded">Nicht bewertet</option><option value="near_mint">Near Mint</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="played">Played</option><option value="poor">Poor</option></select></label>
            <label>Grading<input value={card.gradingProvider || ''} onChange={(event) => updateCard(card.id, { gradingProvider: event.target.value })} placeholder="PSA, BGS, CGC …" /></label>
            <label>Grade<input value={card.grade || ''} onChange={(event) => updateCard(card.id, { grade: event.target.value })} placeholder="10, 9.5 …" /></label>
          </div></details>
          <div className="inline-fields"><label>Menge<input type="number" min="1" value={Number(card.quantity || 1)} onChange={(event) => updateCard(card.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></label><label>Einkauf/Stück<input type="number" min="0" step="0.01" value={card.purchasePrice ?? ''} onChange={(event) => updateCard(card.id, { purchasePrice: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Verkaufswert/Stück<input type="number" min="0" step="0.01" value={card.saleValue ?? ''} onChange={(event) => updateCard(card.id, { saleValue: event.target.value === '' ? null : Number(event.target.value), price: event.target.value })} /></label></div>
          {card.priceSource && <small className="muted">{card.priceSource} · {card.priceFetchedAt ? new Date(card.priceFetchedAt).toLocaleString('de-DE') : ''}</small>}
          <div className="button-row">{market && <a className="button secondary" href={market} target="_blank" rel="noopener noreferrer">Cardmarket</a>}<button className="secondary" disabled={pricing === card.id} onClick={() => void fetchPrice(card)}>Preis abrufen</button><button className="danger" onClick={() => void removeCard(card.id)}>Entfernen</button></div>
        </div>
      </article>;
    })}{!filtered.length && <p className="empty">Keine Karten gefunden.</p>}</div>
  </Panel>;
}
