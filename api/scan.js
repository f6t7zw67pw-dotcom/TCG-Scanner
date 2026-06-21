const scanBuckets = globalThis.__cwScanBuckets || new Map();
globalThis.__cwScanBuckets = scanBuckets;

function clientId(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function tokenFrom(req) {
  return String(req.headers['x-app-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();
}

function hasAccess(req) {
  const expected = String(process.env.APP_ACCESS_TOKEN || '').trim();
  return !expected || tokenFrom(req) === expected;
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
  if (!hasAccess(req)) return res.status(401).json({ ok: false, error: 'KI-Scan ist geschuetzt. Cloud Token in der App eingeben.' });
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
    const cardSchema = '{"originalName":"","fullNumber":"","searchNumber":"","setCode":"","setName":"","languageGuess":"","languageCode":"","cardType":"","cardVersion":"","condition":"","confidence":0,"warnings":[]}';
    const schema = mode === 'multi'
      ? `{"mode":"multi","listing":{"ebayPrice":"","shipping":"","listingType":"","notes":[]},"cards":[${cardSchema}]}`
      : `{"mode":"single","listing":{"ebayPrice":"","shipping":"","listingType":"","notes":[]},"cards":[${cardSchema}]}`;
    const sharedRules = 'Erlaubte condition-Werte sind nur: Near Mint, Excellent, Good, Played, Poor oder leer. Erlaubte cardVersion-Werte sind: leer, V1, V2, V3, V4. Nutze V1 fuer EX/V/GX, V2 fuer Illustration Rare/Full Art, V3 fuer Special Illustration Rare, V4 fuer Gold/Secret Rare. Wenn unsicher, leer lassen.';
    const prompt = mode === 'multi'
      ? `Du bist ein Pokemon-TCG Multi-Karten Ankauf-Scanner. Erkenne jede sichtbare Karte separat. Erfinde nichts. Fehlende Felder leer lassen und warnings setzen. ${sharedRules} eBay Gesamtpreis/Gebot und Versand nur erfassen, wenn sichtbar. Cardmarket-Preise nicht schaetzen. Gib ausschliesslich JSON in diesem Format zurueck: ${schema}`
      : `Du bist ein Pokemon-TCG Einzelkarten-Crop-Scanner. Das Bild zeigt normalerweise genau eine Karte oder einen engen Ausschnitt einer Karte. Analysiere nur diese eine Karte. Lies zuerst den Pokemon-Namen, dann die Kartennummer unten, danach SetCode/SetName falls sichtbar. Bestimme cardType/cardVersion und condition nur wenn sichtbar bzw. aus der Kartenart klar ableitbar. Gewichte gedruckte Kartennummern staerker als dekorativen Text. Erfinde nichts: wenn Name, Nummer, Set, Zustand oder Kartentyp nicht klar lesbar sind, lasse das Feld leer und schreibe eine kurze warning. Keine Cardmarket-Preise schaetzen. ${sharedRules} Gib ausschliesslich JSON in diesem Format zurueck: ${schema}`;
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
            { type: 'image_url', image_url: { url: image, detail: mode === 'multi' ? 'high' : 'low' } }
          ]}
        ]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: data?.error?.message || 'OpenAI Fehler' });
    const text = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { mode, listing: {}, cards: [], raw: text }; }
    return res.status(200).json({ ok: true, model, ...parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfehler' });
  }
}
