import { getSql, hasSessionOrAdmin } from './_auth.js';
import { recordScan } from './_catalog.js';
import { internalError } from './_errors.js';

const scanBuckets = globalThis.__cwScanBuckets || new Map();
globalThis.__cwScanBuckets = scanBuckets;

function clientId(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function checkRateLimit(req) {
  const max = Math.max(1, Number(process.env.SCAN_MAX_PER_HOUR || 80));
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const key = clientId(req);
  const bucket = scanBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  scanBuckets.set(key, bucket);
  return bucket.count <= max;
}

function approxDataUrlBytes(value) {
  const base64 = String(value || '').split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });
  const sql = getSql();
  if (!(await hasSessionOrAdmin(req, sql))) return res.status(401).json({ ok: false, error: 'Bitte anmelden, bevor du KI-Scans startest.' });
  if (!checkRateLimit(req)) return res.status(429).json({ ok: false, error: 'Scan-Limit erreicht. Bitte spaeter erneut versuchen.' });

  try {
    if (!process.env.OPENAI_API_KEY) return res.status(400).json({ ok: false, error: 'OPENAI_API_KEY fehlt in Vercel.' });
    const body = req.body || {};
    const mode = body.mode === 'multi' ? 'multi' : 'single';
    const image = body.image;
    const extraText = String(body.extraText || '').slice(0, 1200);
    if (!image || typeof image !== 'string') return res.status(400).json({ ok: false, error: 'Kein Bild empfangen.' });

    const maxImageBytes = Math.max(250000, Number(process.env.SCAN_MAX_IMAGE_BYTES || 4500000));
    if (approxDataUrlBytes(image) > maxImageBytes) {
      return res.status(413).json({ ok: false, error: 'Bild ist zu gross. Bitte kleiner oder staerker komprimiert hochladen.' });
    }

    const model = mode === 'multi' ? (process.env.OPENAI_MULTI_MODEL || 'gpt-4o') : (process.env.OPENAI_SINGLE_MODEL || 'gpt-4o-mini');
    const cardSchema = '{"originalName":"","visibleTitle":"","englishName":"","cardmarketName":"","fullNumber":"","searchNumber":"","setCode":"","setName":"","languageGuess":"","languageCode":"","cardType":"","cardVersion":"","condition":"","confidence":0,"warnings":[]}';
    const schema = mode === 'multi'
      ? `{"mode":"multi","listing":{"ebayPrice":"","shipping":"","listingType":"","notes":[]},"cards":[${cardSchema}]}`
      : `{"mode":"single","listing":{"ebayPrice":"","shipping":"","listingType":"","notes":[]},"cards":[${cardSchema}]}`;
    const sharedRules = [
      'Erkenne alle Pokemon-TCG Kartentypen: Pokemon, Trainer, Item, Supporter, Stadium, Tool, Energy und Special Energy. Trainer- und Energie-Karten sind vollwertige Treffer, nicht als Fehler behandeln.',
      'visibleTitle ist der Titel exakt so, wie er auf der Karte sichtbar ist, inklusive japanischer, chinesischer oder koreanischer Schriftzeichen, wenn er lesbar ist.',
      'originalName ist der beste nutzbare Kartentitel fuer die App. Bei Deutsch/Englisch kann das der sichtbare Titel sein. Bei Japanisch, Chinesisch oder Koreanisch soll originalName der englische internationale Kartenname sein, wenn du ihn sicher aus Artwork, Nummer, Set, sichtbarem Titel oder Zusatztext ableiten kannst; sonst sichtbaren Titel verwenden und warning setzen.',
      'englishName ist immer der englische internationale Kartenname fuer Pokemon-TCG-API/Cardmarket-Suche, wenn sicher ableitbar. Bei Unsicherheit leer lassen.',
      'cardmarketName ist der Cardmarket-kompatible englische Produktname: englischer Kartenname, mit EX/GX/V-Suffix passend als Charizard-ex, M Camerupt-EX, Pikachu V usw. Bei Trainer/Energy englischen Cardmarket-Namen verwenden, z. B. Welder, Professor Research, Basic Fire Energy. Wenn unsicher leer lassen.',
      'Bei japanischen Karten: languageGuess Japanese und languageCode 7. Bei englischen Karten: English/1. Bei deutschen Karten: German/3. Bei chinesischen Karten: Chinese und languageCode leer lassen, falls du keinen sicheren Cardmarket-Code kennst.',
      'Bei chinesischen, japanischen und koreanischen Karten ist die Kartennummer plus Set/Symbol oft wichtiger als der gedruckte Name. Nutze sichtbare Nummern, Set-Kuerzel, Copyright, Regulierungsmarke und Artwork, um englishName/cardmarketName zu bestimmen.',
      'cardType soll konkrete Werte wie Pokemon, Trainer, Item, Supporter, Stadium, Tool, Energy oder Special Energy nutzen, wenn sichtbar.',
      'Kartennummern koennen unten links, unten rechts, mittig unten oder bei alten Karten nah am Rand stehen. Suche nach Mustern wie 12/102, 101/108, SVP123, TG05/TG30 oder einzelner Sammlernummer.',
      'Set-Hinweise koennen links, rechts oder unten stehen: Set-Symbol, Set-Code, Copyright-Zeile, Wizards/e-Reader Layout, Erweiterungsname oder kleine Symbole. Wenn der SetCode unsicher ist, lieber setCode leer lassen und setName oder warning setzen.',
      'Gewichte die gedruckte Kartennummer staerker als Layoutposition. Bei alten Karten ist die Position nicht verlaesslich.',
      'Erlaubte condition-Werte sind nur: Near Mint, Excellent, Good, Played, Poor oder leer. Erlaubte cardVersion-Werte sind: leer, V1, V2, V3, V4. Nutze V1 fuer EX/V/GX, V2 fuer Illustration Rare/Full Art, V3 fuer Special Illustration Rare, V4 fuer Gold/Secret Rare. Bei Trainer/Energy normalerweise leer lassen.',
      'Erfinde nichts. Unsichere Felder leer lassen und warnings setzen.'
    ].join(' ');
    const prompt = mode === 'multi'
      ? `Du bist ein Pokemon-TCG Multi-Karten Ankauf-Scanner. Erkenne jede sichtbare Karte separat, inklusive Pokemon, Trainer, Item, Supporter, Stadium, Tool und Energy. ${sharedRules} eBay Gesamtpreis/Gebot und Versand nur erfassen, wenn sichtbar. Cardmarket-Preise nicht schaetzen. Gib ausschliesslich JSON in diesem Format zurueck: ${schema}`
      : `Du bist ein Pokemon-TCG Einzelkarten-Crop-Scanner. Das Bild zeigt normalerweise genau eine Karte oder einen engen Ausschnitt einer Karte. Analysiere diese Karte typunabhaengig: Pokemon, Trainer, Item, Supporter, Stadium, Tool oder Energy. Lies zuerst den grossen Kartentitel, dann die Kartennummer und danach SetCode/SetName, falls sichtbar. Keine Cardmarket-Preise schaetzen. ${sharedRules} Gib ausschliesslich JSON in diesem Format zurueck: ${schema}`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Du gibst ausschliesslich valides JSON zurueck.' },
          { role: 'user', content: [
            { type: 'text', text: `${prompt}\nZusatztext: ${extraText}` },
            { type: 'image_url', image_url: { url: image, detail: mode === 'multi' ? 'high' : 'high' } }
          ]}
        ]
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.warn(JSON.stringify({ event: 'scan_provider_error', providerStatus: response.status }));
      const status = response.status === 429 ? 429 : 502;
      const message = response.status === 429 ? 'Scan-Limit des KI-Anbieters erreicht.' : 'KI-Anbieter ist voruebergehend nicht verfuegbar.';
      return res.status(status).json({ ok: false, error: message });
    }
    const text = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { mode, listing: {}, cards: [], raw: text }; }

    let scanId = null;
    if (sql) {
      try {
        scanId = await recordScan(sql, {
          req,
          mode,
          input: { mode, extraText: extraText || '', imageBytes: approxDataUrlBytes(image) },
          result: parsed
        });
      } catch (historyError) {
        console.warn('Scan history write failed', historyError?.message || historyError);
      }
    }

    return res.status(200).json({ ok: true, model, scanId, ...parsed });
  } catch (err) {
    return internalError(res, 'Scan ist voruebergehend nicht verfuegbar.', err);
  }
}
