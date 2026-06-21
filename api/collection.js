import { getSessionUser, getSql, hasAdminToken, requireUser } from './_auth.js';

const DEFAULT_USER = 'default';
let schemaReady = false;

function stripHeavyFields(card) {
  const next = { ...(card || {}) };
  if (typeof next.image === 'string' && next.image.startsWith('data:image/')) delete next.image;
  if (typeof next.cropImage === 'string' && next.cropImage.startsWith('data:image/')) delete next.cropImage;
  if (!next.id) next.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  next.updatedAt = new Date().toISOString();
  return next;
}

async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS cw_collection_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'default',
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS cw_collection_cards_user_updated_idx ON cw_collection_cards (user_id, updated_at DESC)`;
  schemaReady = true;
}

async function resolveUserId(req, res, sql) {
  if (hasAdminToken(req)) return String(req.query.user || DEFAULT_USER).slice(0, 80) || DEFAULT_USER;
  const user = await getSessionUser(req, sql);
  if (user) return user.id;
  const required = await requireUser(req, res, sql);
  return required?.id || '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PUT', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ ok: false, error: 'Methode nicht erlaubt.' });
  }

  const sql = getSql();
  if (!sql) {
    return res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt in Vercel. Cloud-Sync ist noch nicht eingerichtet.' });
  }

  try {
    await ensureSchema(sql);
    const userId = await resolveUserId(req, res, sql);
    if (!userId) return;

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT payload
        FROM cw_collection_cards
        WHERE user_id = ${userId}
        ORDER BY COALESCE(payload->>'createdAt', payload->>'updatedAt') DESC NULLS LAST, updated_at DESC
      `;
      return res.status(200).json({ ok: true, cards: rows.map((row) => row.payload), count: rows.length });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM cw_collection_cards WHERE user_id = ${userId}`;
      return res.status(200).json({ ok: true, count: 0 });
    }

    const body = req.body || {};
    const incoming = Array.isArray(body.cards) ? body.cards : (body.card ? [body.card] : []);
    const cards = incoming.map(stripHeavyFields).filter(Boolean).slice(0, 5000);

    if (req.method === 'PUT') {
      await sql`DELETE FROM cw_collection_cards WHERE user_id = ${userId}`;
    }

    for (const card of cards) {
      await sql`
        INSERT INTO cw_collection_cards (id, user_id, payload, updated_at)
        VALUES (${String(card.id)}, ${userId}, ${JSON.stringify(card)}, now())
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
      `;
    }

    return res.status(200).json({ ok: true, count: cards.length, mode: req.method === 'PUT' ? 'replace' : 'upsert' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Cloud-Sync Fehler' });
  }
}
