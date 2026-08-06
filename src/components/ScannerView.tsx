import { useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { compressImage, cropGrid, runLimited } from '../lib/images';
import { cardmarketUrl, safeHttpUrl } from '../lib/links';
import { normalizeCard } from '../lib/storage';
import { useAppState } from '../state/AppState';
import type { Candidate, CardRecord, ScanMode } from '../types';
import { CandidateList } from './CandidateList';
import { ErrorBox, Panel } from './Layout';

function CardEditor({ card, onChange }: { card: CardRecord; onChange: (card: CardRecord) => void }) {
  const field = (key: keyof CardRecord, label: string) => <label>{label}<input value={String(card[key] || '')} onChange={(event) => onChange({ ...card, [key]: event.target.value })} /></label>;
  return <div className="form-grid">
    {field('originalName', 'Kartenname')}{field('cardmarketName', 'Englisch / Cardmarket')}
    {field('fullNumber', 'Kartennummer')}{field('setCode', 'Set-Code')}{field('setName', 'Set-Name')}
    <label>Sprache<input value={card.language || ''} onChange={(event) => onChange({ ...card, language: event.target.value, variantId: '' })} placeholder="de, en, ja …" /></label>
    <label>Oberfläche<select value={card.finish || 'normal'} onChange={(event) => onChange({ ...card, finish: event.target.value as CardRecord['finish'], variantId: '' })}><option value="normal">Normal</option><option value="holo">Holo</option><option value="reverse_holo">Reverse Holo</option><option value="other">Andere</option></select></label>
    <label>Edition<select value={card.edition || 'unlimited'} onChange={(event) => onChange({ ...card, edition: event.target.value as CardRecord['edition'], variantId: '' })}><option value="unlimited">Unlimited</option><option value="first_edition">First Edition</option><option value="promo">Promo</option><option value="other">Andere</option></select></label>
    <label>Treatment<input value={card.treatment || ''} onChange={(event) => onChange({ ...card, treatment: event.target.value, variantId: '' })} placeholder="standard, illustration_rare …" /></label>
    <label>Zustand<select value={card.condition || 'ungraded'} onChange={(event) => onChange({ ...card, condition: event.target.value as CardRecord['condition'] })}>
      <option value="ungraded">Nicht bewertet</option><option value="near_mint">Near Mint</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="played">Played</option><option value="poor">Poor</option>
    </select></label>
    <label>Grading-Anbieter<input value={card.gradingProvider || ''} onChange={(event) => onChange({ ...card, gradingProvider: event.target.value, variantId: '' })} placeholder="PSA, BGS, CGC …" /></label>
    <label>Grade<input value={card.grade || ''} onChange={(event) => onChange({ ...card, grade: event.target.value, variantId: '' })} placeholder="10, 9.5 …" /></label>
  </div>;
}

export function ScannerView() {
  const { addCards, notify } = useAppState();
  const [mode, setMode] = useState<ScanMode>('single');
  const [image, setImage] = useState('');
  const [extraText, setExtraText] = useState('');
  const [layout, setLayout] = useState('2x2');
  const [card, setCard] = useState<CardRecord>(() => normalizeCard({}));
  const [multi, setMulti] = useState<CardRecord[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const preview = safeHttpUrl(image) || (image.startsWith('data:image/') ? image : '');
  const selectedCount = useMemo(() => multi.filter((item) => item.selected !== false && !item.scanError).length, [multi]);

  async function choose(file?: File) {
    if (!file) return;
    setError(''); setImage(await compressImage(file)); setMulti([]); setCandidates([]);
  }

  async function scanSingle(source = image): Promise<CardRecord> {
    const result = await api.scan(source, extraText);
    return normalizeCard({ ...(result.cards?.[0] || {}), image: source });
  }

  async function startScan() {
    if (!image) return setError('Bitte zuerst ein Bild auswählen.');
    setBusy(true); setError(''); setCandidates([]);
    try {
      if (mode === 'single') {
        const scanned = await scanSingle(); setCard(scanned); notify('Scan abgeschlossen. Bitte Treffer bestätigen.');
      } else {
        const [columns, rows] = layout.split('x').map(Number);
        const crops = await cropGrid(image, columns, rows);
        const results = await runLimited(crops, 3, async (crop) => scanSingle(crop));
        setMulti(results.map((result, index) => result.status === 'fulfilled'
          ? { ...result.value, selected: true, multiLot: true }
          : normalizeCard({ image: crops[index], selected: false, multiLot: true, scanError: result.reason instanceof Error ? result.reason.message : 'Scan fehlgeschlagen.' })));
        notify('Multi-Lot verarbeitet. Teilfehler können einzeln wiederholt werden.');
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Scan fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  async function searchCandidates(target: CardRecord = card) {
    setBusy(true); setError('');
    try { setCandidates((await api.candidates(target)).cards); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Kartensuche fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  function confirmCandidate(candidate: Candidate) {
    setCard((current) => normalizeCard({ ...current, ...candidate, id: current.id, catalogId: candidate.sourceId || candidate.id, originalName: candidate.name || current.originalName }));
    setCandidates([]); notify('Katalogtreffer bestätigt.');
  }

  return <div className="stack">
    <Panel title="Scanner" intro="Bilder bleiben bis zum Start eines KI-Scans lokal im Browser.">
      <div className="segmented"><button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Einzelkarte</button><button className={mode === 'multi' ? 'active' : ''} onClick={() => setMode('multi')}>Multi-Lot</button></div>
      <input ref={input} className="visually-hidden" type="file" accept="image/*" onChange={(event) => void choose(event.target.files?.[0])} />
      <button className="dropzone" type="button" onClick={() => input.current?.click()}>
        {preview ? <img src={preview} alt="Ausgewählte Karte" /> : <><strong>Foto auswählen</strong><span>Kamera oder Datei</span></>}
      </button>
      <label>Sichtbarer Zusatztext<textarea value={extraText} onChange={(event) => setExtraText(event.target.value)} placeholder="Optional: Kartennummer, Sprache, Set …" /></label>
      {mode === 'multi' && <label>Raster<select value={layout} onChange={(event) => setLayout(event.target.value)}><option value="2x2">2 × 2</option><option value="3x3">3 × 3</option></select></label>}
      <ErrorBox error={error} />
      <div className="button-row"><button type="button" disabled={busy || !image} onClick={() => void startScan()}>{busy ? 'Verarbeite …' : mode === 'single' ? 'Karte scannen' : 'Lot scannen'}</button><button className="secondary" type="button" onClick={() => { setImage(''); setMulti([]); }}>Zurücksetzen</button></div>
    </Panel>

    {mode === 'single' && (card.originalName || card.fullNumber) && <Panel title="Scan-Ergebnis" intro="Vor dem Speichern kann ein Katalogtreffer geprüft und bestätigt werden.">
      <CardEditor card={card} onChange={setCard} />
      <div className="button-row"><button type="button" disabled={busy} onClick={() => void searchCandidates()}>Katalogtreffer suchen</button>
        <button className="secondary" type="button" disabled={!card.originalName} onClick={() => { addCards([{ ...card, cardmarketUrl: cardmarketUrl(card) }]); notify('Karte lokal gespeichert.'); }}>Lokal speichern</button></div>
      <CandidateList candidates={candidates} onSelect={confirmCandidate} />
    </Panel>}

    {mode === 'multi' && multi.length > 0 && <Panel title={`Multi-Lot · ${selectedCount}/${multi.length} bereit`}>
      <div className="lot-grid">{multi.map((item, index) => <article className="lot-card" key={item.id}>
        {item.image && <img src={item.image} alt="" />}<label><input type="checkbox" checked={item.selected !== false} disabled={Boolean(item.scanError)} onChange={(event) => setMulti((current) => current.map((entry, i) => i === index ? { ...entry, selected: event.target.checked } : entry))} /> Karte {index + 1}</label>
        {item.scanError ? <><ErrorBox error={item.scanError} /><button type="button" onClick={async () => { setBusy(true); try { const retry = await scanSingle(item.image); setMulti((current) => current.map((entry, i) => i === index ? { ...retry, selected: true, multiLot: true } : entry)); } finally { setBusy(false); } }}>Erneut versuchen</button></> : <CardEditor card={item} onChange={(next) => setMulti((current) => current.map((entry, i) => i === index ? next : entry))} />}
      </article>)}</div>
      <button type="button" onClick={() => { addCards(multi.filter((item) => item.selected !== false && !item.scanError).map((item) => ({ ...item, cardmarketUrl: cardmarketUrl(item) }))); notify(`${selectedCount} Karten lokal gespeichert.`); }}>Ausgewählte speichern</button>
    </Panel>}
  </div>;
}
