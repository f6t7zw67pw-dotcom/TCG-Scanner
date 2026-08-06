import { getSessionUser, getSql, hasAdminToken, requireUser } from './_auth.js';
import {
  MAX_CARDS,
  MAX_PAYLOAD_BYTES,
  normalizeSyncCards,
  normalizeTimestamp,
  payloadBytes,
  validCard
} from './_collection-sync.js';
import { internalError } from './_errors.js';

const DEFAULT_USER = 'default';
let schemaReady = false;

async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS cw_collection_cards (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'default',
      payload JSONB NOT NULL,
      version BIGINT NOT NULL DEFAULT 1,
      client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id)
    )
  `;
  await sql`ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'cw_collection_cards'::regclass
          AND contype = 'p'
          AND array_length(conkey, 1) = 1
      ) THEN
        ALTER TABLE cw_collection_cards DROP CONSTRAINT cw_collection_cards_pkey;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'cw_collection_cards'::regclass
          AND contype = 'p'
      ) THEN
        ALTER TABLE cw_collection_cards ADD PRIMARY KEY (user_id, id);
      END IF;
    END $$
  `;
  await sql`CREATE INDEX IF NOT EXISTS cw_collection_cards_user_updated_idx ON cw_collection_cards (user_id, updated_at DESC)`;
  schemaReady = true;
}

async function resolveUserId(req, res, sql) {
  if (hasAdminToken(req)) return String(req.query?.user || DEFAULT_USER).slice(0, 80) || DEFAULT_USER;
  const user = await getSessionUser(req, sql);
  if (user) return user.id;
  const required = await requireUser(req, res, sql);
  return required?.id || '';
}

function readIncoming(req) {
  const body = req.body || {};
  const cards = Array.isArray(body.cards) ? body.cards : (body.card ? [body.card] : []);
  if (payloadBytes(body) > MAX_PAYLOAD_BYTES) return { error: [413, 'Sync-Payload ist zu gross.'] };
  if (cards.length > MAX_CARDS) return { error: [413, `Hoechstens ${MAX_CARDS} Karten pro Sync erlaubt.`] };
  if (!cards.every(validCard)) return { error: [400, 'Ungueltiges Kartenformat.'] };
  const now = new Date().toISOString();
  return { cards: normalizeSyncCards(cards, now) };
}

async function readCollection(req, res, sql, userId) {
  const rawSince = String(req.query?.since || '').trim();
  const since = rawSince ? normalizeTimestamp(rawSince, '') : '';
  if (rawSince && !since) return res.status(400).json({ ok: false, error: 'Ungueltiger Sync-Zeitpunkt.' });
  // Capture the cursor before reading. Changes committed after this point have a later
  // updated_at value and will therefore be included in the next incremental pull.
  const cursorRows = await sql`SELECT now() AS cursor`;
  const cursor = cursorRows[0]?.cursor;

  const rows = since
    ? await sql`
        SELECT id, payload, version, deleted_at, updated_at
        FROM cw_collection_cards
        WHERE user_id = ${userId} AND updated_at > ${since} AND updated_at <= ${cursor}
        ORDER BY updated_at ASC
      `
    : await sql`
        SELECT id, payload, version, deleted_at, updated_at
        FROM cw_collection_cards
        WHERE user_id = ${userId} AND deleted_at IS NULL AND updated_at <= ${cursor}
        ORDER BY COALESCE(payload->>'createdAt', payload->>'updatedAt') DESC NULLS LAST, updated_at DESC
      `;
  const cards = rows.map((row) => row.deleted_at
    ? { id: row.id, version: Number(row.version), updatedAt: row.updated_at, deleted: true }
    : { ...row.payload, id: row.id, version: Number(row.version), updatedAt: row.payload?.updatedAt || row.updated_at });
  return res.status(200).json({ ok: true, cards, count: cards.length, incremental: Boolean(since), syncCursor: cursor });
}

async function upsertCollection(req, res, sql, userId) {
  const parsed = readIncoming(req);
  if (parsed.error) return res.status(parsed.error[0]).json({ ok: false, error: parsed.error[1] });
  const records = parsed.cards.map((card) => ({
    id: card.id,
    payload: card,
    version: card.version,
    client_updated_at: card.updatedAt
  }));
  if (!records.length) return res.status(200).json({ ok: true, count: 0, accepted: 0, conflicts: 0, mode: 'incremental-upsert' });

  const rows = await sql`
    WITH incoming AS (
      SELECT item.id, item.payload, item.version, item.client_updated_at
      FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb)
        AS item(id TEXT, payload JSONB, version BIGINT, client_updated_at TIMESTAMPTZ)
    ), existing AS (
      SELECT c.id, c.payload, c.version, c.client_updated_at
      FROM cw_collection_cards c
      JOIN incoming i ON i.id = c.id
      WHERE c.user_id = ${userId}
    ), upserted AS (
      INSERT INTO cw_collection_cards (user_id, id, payload, version, client_updated_at, deleted_at, updated_at)
      SELECT ${userId}, id, payload, version, client_updated_at, NULL, now()
      FROM incoming
      ON CONFLICT (user_id, id) DO UPDATE SET
        payload = EXCLUDED.payload,
        version = EXCLUDED.version,
        client_updated_at = EXCLUDED.client_updated_at,
        deleted_at = NULL,
        updated_at = now()
      WHERE EXCLUDED.version > cw_collection_cards.version
         OR (EXCLUDED.version = cw_collection_cards.version
             AND EXCLUDED.client_updated_at > cw_collection_cards.client_updated_at)
      RETURNING id, payload, version, client_updated_at
    )
    SELECT i.id,
           (u.id IS NOT NULL) AS accepted,
           COALESCE(u.version, e.version, i.version) AS version
    FROM incoming i
    LEFT JOIN existing e ON e.id = i.id
    LEFT JOIN upserted u ON u.id = i.id
  `;
  const accepted = rows.filter((row) => row.accepted).length;
  const cursorRows = await sql`SELECT now() AS cursor`;
  return res.status(200).json({
    ok: true,
    count: records.length,
    accepted,
    conflicts: records.length - accepted,
    mode: 'incremental-upsert',
    syncCursor: cursorRows[0]?.cursor,
    results: rows
  });
}

async function deleteCards(req, res, sql, userId) {
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map((id) => String(id).slice(0, 128)).filter(Boolean))] : [];
  if (!ids.length) return res.status(400).json({ ok: false, error: 'Zu loeschende Karten-IDs fehlen.' });
  if (ids.length > MAX_CARDS) return res.status(413).json({ ok: false, error: `Hoechstens ${MAX_CARDS} Karten pro Sync erlaubt.` });
  const rows = await sql`
    UPDATE cw_collection_cards
    SET deleted_at = now(), updated_at = now(), client_updated_at = now(), version = version + 1,
        payload = jsonb_build_object('id', id, 'deleted', true, 'version', version + 1, 'updatedAt', now())
    WHERE user_id = ${userId} AND id = ANY(${ids}::text[]) AND deleted_at IS NULL
    RETURNING id, version
  `;
  return res.status(200).json({ ok: true, count: rows.length, deleted: rows.map((row) => ({ id: row.id, version: Number(row.version) })) });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PUT', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ ok: false, error: 'Methode nicht erlaubt.' });
  }

  const sql = getSql();
  if (!sql) return res.status(503).json({ ok: false, error: 'Cloud-Sync ist noch nicht eingerichtet.' });

  try {
    await ensureSchema(sql);
    const userId = await resolveUserId(req, res, sql);
    if (!userId) return;
    if (req.method === 'GET') return readCollection(req, res, sql, userId);
    if (req.method === 'DELETE') return deleteCards(req, res, sql, userId);
    return upsertCollection(req, res, sql, userId);
  } catch (err) {
    return internalError(res, 'Cloud-Sync ist voruebergehend nicht verfuegbar.', err);
  }
}
