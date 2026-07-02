import { getSql, hasSessionOrAdmin } from './_auth.js';
import { cardmarketSetSlug, ensureCatalogSchema, foldText, normalizeSetCode, setAliasesFor } from './_catalog.js';

const setBuckets = globalThis.__cwSetBuckets || new Map();
globalThis.__cwSetBuckets = setBuckets;

function clientId(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function checkRateLimit(req) {
  const max = Math.max(1, Number(process.env.SET_SYNC_MAX_PER_HOUR || 60));
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const key = clientId(req);
  const bucket = setBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  setBuckets.set(key, bucket);
  return bucket.count <= max;
}

async function upsertSet(sql, raw) {
  const code = normalizeSetCode(raw.ptcgoCode || raw.id || '');
  const id = `pokemon_set_${foldText(code || raw.id || raw.name).replace(/\s+/g, '_') || 'unknown'}`;
  const name = String(raw.name || '').trim() || code || raw.id;
  const set = {
    id,
    game: 'pokemon',
    code,
    name,
    series: String(raw.series || '').trim(),
    releaseDate: raw.releaseDate || null,
    source: 'pokemon-tcg-api',
    sourceId: raw.id || code,
    raw
  };

  await sql`
    INSERT INTO cw_card_sets (id, game, code, name, series, release_date, source, source_id, raw, updated_at)
    VALUES (${set.id}, ${set.game}, ${set.code}, ${set.name}, ${set.series || null}, ${set.releaseDate}, ${set.source}, ${set.sourceId}, ${JSON.stringify(set.raw)}, now())
    ON CONFLICT (game, code) DO UPDATE SET
      name = EXCLUDED.name,
      series = EXCLUDED.series,
      release_date = EXCLUDED.release_date,
      source = EXCLUDED.source,
      source_id = EXCLUDED.source_id,
      raw = EXCLUDED.raw,
      updated_at = now()
  `;

  for (const alias of setAliasesFor(set)) {
    const folded = foldText(alias);
    if (!folded) continue;
    await sql`
      INSERT INTO cw_set_aliases (id, set_id, game, code, alias, alias_folded, source, updated_at)
      VALUES (${`${set.id}_${folded.replace(/\s+/g, '_')}`.slice(0, 220)}, ${set.id}, ${set.game}, ${set.code}, ${alias}, ${folded}, 'sets-api', now())
      ON CONFLICT (game, alias_folded) DO UPDATE SET
        set_id = EXCLUDED.set_id,
        code = EXCLUDED.code,
        alias = EXCLUDED.alias,
        updated_at = now()
    `;
  }
  return set;
}

async function syncPokemonSets(sql) {
  const headers = process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {};
  const response = await fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate', { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Pokemon-TCG Sets konnten nicht geladen werden (${response.status}).`);
  const sets = Array.isArray(data.data) ? data.data : [];
  for (const set of sets) await upsertSet(sql, set);
  return sets.length;
}

function publicSet(row) {
  return {
    id: row.id,
    code: row.code || '',
    name: row.name || '',
    cardmarketSetName: cardmarketSetSlug(row.name || ''),
    series: row.series || '',
    releaseDate: row.release_date || '',
    sourceId: row.source_id || '',
    aliases: row.aliases || []
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Methode nicht erlaubt.' });

  const sql = getSql();
  if (!(await hasSessionOrAdmin(req, sql))) return res.status(401).json({ ok: false, error: 'Bitte anmelden, bevor du Set-Daten nutzt.' });
  if (!sql) return res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt in Vercel.' });

  try {
    await ensureCatalogSchema(sql);

    if (req.method === 'POST') {
      if (!checkRateLimit(req)) return res.status(429).json({ ok: false, error: 'Set-Sync-Limit erreicht. Bitte spaeter erneut versuchen.' });
      const count = await syncPokemonSets(sql);
      return res.status(200).json({ ok: true, synced: count });
    }

    const q = String(req.query.q || '').trim();
    const folded = foldText(q);
    const code = normalizeSetCode(q);
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 80)));
    const rows = q ? await sql`
      SELECT s.id, s.code, s.name, s.series, s.release_date, s.source_id, array_remove(array_agg(a.alias ORDER BY a.alias), NULL) AS aliases
      FROM cw_card_sets s
      LEFT JOIN cw_set_aliases a ON a.set_id = s.id
      WHERE s.game = 'pokemon'
        AND (
          s.code = ${code}
          OR lower(s.name) LIKE ${`%${q.toLowerCase()}%`}
          OR a.alias_folded LIKE ${`%${folded}%`}
        )
      GROUP BY s.id
      ORDER BY s.release_date DESC NULLS LAST, s.name ASC
      LIMIT ${limit}
    ` : await sql`
      SELECT s.id, s.code, s.name, s.series, s.release_date, s.source_id, array_remove(array_agg(a.alias ORDER BY a.alias), NULL) AS aliases
      FROM cw_card_sets s
      LEFT JOIN cw_set_aliases a ON a.set_id = s.id
      WHERE s.game = 'pokemon'
      GROUP BY s.id
      ORDER BY s.release_date DESC NULLS LAST, s.name ASC
      LIMIT ${limit}
    `;

    return res.status(200).json({ ok: true, sets: rows.map(publicSet), count: rows.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Set-Datenbank Fehler' });
  }
}
