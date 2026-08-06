import { getSql, hasSessionOrAdmin } from './_auth.js';
import { internalError } from './_errors.js';
import { ensureCatalogSchema, recordScan, resolveCatalogUserId } from './_catalog.js';

const scanHistoryBuckets = globalThis.__cwScanHistoryBuckets || new Map();
globalThis.__cwScanHistoryBuckets = scanHistoryBuckets;

function clientId(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function checkWriteRateLimit(req) {
  const max = Math.max(1, Number(process.env.SCAN_HISTORY_MAX_PER_HOUR || 180));
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const key = clientId(req);
  const bucket = scanHistoryBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  scanHistoryBuckets.set(key, bucket);
  return bucket.count <= max;
}

function compactScan(row) {
  const cards = Array.isArray(row.result?.cards) ? row.result.cards : [];
  const first = cards[0] || {};
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    confidence: row.confidence === null ? null : Number(row.confidence),
    createdAt: row.created_at,
    bestCardId: row.best_card_id || '',
    card: {
      name: first.originalName || first.name || '',
      number: first.fullNumber || first.searchNumber || first.number || '',
      setCode: first.setCode || '',
      setName: first.setName || '',
      warnings: first.warnings || []
    },
    result: row.result || {}
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Methode nicht erlaubt.' });

  const sql = getSql();
  if (!(await hasSessionOrAdmin(req, sql))) return res.status(401).json({ ok: false, error: 'Bitte anmelden, bevor du Scan-Historie nutzt.' });
  if (!sql) return res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt in Vercel. Scan-Historie ist noch nicht eingerichtet.' });

  try {
    await ensureCatalogSchema(sql);
    const userId = await resolveCatalogUserId(req, sql);
    if (!userId) return res.status(401).json({ ok: false, error: 'Bitte anmelden.' });

    if (req.method === 'GET') {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
      const rows = await sql`
        SELECT id, mode, status, input, result, best_card_id, confidence, warnings, created_at
        FROM cw_scans
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return res.status(200).json({ ok: true, scans: rows.map(compactScan), count: rows.length });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM cw_scans WHERE user_id = ${userId}`;
      return res.status(200).json({ ok: true, count: 0 });
    }

    if (!checkWriteRateLimit(req)) return res.status(429).json({ ok: false, error: 'Scan-Historie Limit erreicht. Bitte spaeter erneut versuchen.' });
    const body = req.body || {};
    const id = await recordScan(sql, {
      req,
      mode: body.mode || body.result?.mode || 'single',
      input: body.input || {},
      result: body.result || body
    });
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    return internalError(res, 'Scan-Historie ist voruebergehend nicht verfuegbar.', err);
  }
}
