import { getSql, hasSessionOrAdmin } from './_auth.js';
import { internalError } from './_errors.js';
import { recordPriceSnapshot } from './_catalog.js';
import { getCardPrice, normalizeCardInput } from './price-providers.js';

const priceBuckets = globalThis.__cwPriceBuckets || new Map();
globalThis.__cwPriceBuckets = priceBuckets;

function clientId(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function checkRateLimit(req) {
  const max = Math.max(1, Number(process.env.PRICE_MAX_PER_HOUR || 240));
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const key = clientId(req);
  const bucket = priceBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  priceBuckets.set(key, bucket);
  return bucket.count <= max;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });
  const sql = getSql();
  if (!(await hasSessionOrAdmin(req, sql))) return res.status(401).json({ ok: false, error: 'Bitte anmelden, bevor du Preise abrufst.' });
  if (!checkRateLimit(req)) return res.status(429).json({ ok: false, error: 'Preis-Limit erreicht. Bitte spaeter erneut versuchen.' });

  try {
    const input = normalizeCardInput(req.body || {});
    const result = await getCardPrice(input);
    if (sql && result?.price) {
      try {
        const snapshotId = await recordPriceSnapshot(sql, { req, input, result });
        result.snapshotId = snapshotId;
      } catch (snapshotError) {
        console.warn(JSON.stringify({ event: 'price_snapshot_write_failed', errorName: String(snapshotError?.name || 'Error').slice(0, 80) }));
      }
    }
    const status = result.status || (result.ok === false ? 503 : 200);
    return res.status(status).json(result);
  } catch (err) {
    if (err?.name === 'AbortError') {
      return res.status(504).json({ ok: false, error: 'Preisabfrage hat zu lange gedauert.' });
    }
    return internalError(res, 'Preisabfrage ist voruebergehend nicht verfuegbar.', err);
  }
}
