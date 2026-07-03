import { enrichForeignNameInput, hasAsianText } from './_i18n-name.js';

const buckets = globalThis.__cwNameTranslateBuckets || new Map();
globalThis.__cwNameTranslateBuckets = buckets;

function clientId(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function rateLimit(req) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const max = Math.max(20, Number(process.env.NAME_TRANSLATE_MAX_PER_HOUR || 180));
  const key = clientId(req);
  const bucket = buckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= max;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });
  if (!rateLimit(req)) return res.status(429).json({ ok: false, error: 'Namens-Suchlimit erreicht. Bitte spaeter erneut versuchen.' });

  const input = req.body || {};
  const raw = `${input.name || ''} ${input.originalName || ''} ${input.cardmarketName || ''} ${input.visibleTitle || ''}`;
  if (!hasAsianText(raw)) return res.status(200).json({ ok: true, translated: false, card: input });

  try {
    const card = await enrichForeignNameInput(input);
    return res.status(200).json({
      ok: true,
      translated: !!card.englishName,
      card
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Namensuebersetzung fehlgeschlagen.' });
  }
}
