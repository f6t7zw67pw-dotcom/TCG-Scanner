import { randomBytes } from 'node:crypto';
import { getSessionUser, hasAdminToken } from './_auth.js';

let catalogSchemaReady = false;

export function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function foldText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSetCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .slice(0, 40)
    .replace(/^BK$/, 'BLK')
    .replace(/^B1K$/, 'BLK')
    .replace(/^WH$/, 'WHT')
    .replace(/^WF$/, 'WHT')
    .replace(/^SVBA$/, 'SV8A');
}

export function normalizeCardNumber(value) {
  const raw = String(value || '').toUpperCase().split('/')[0].replace(/\s+/g, '').trim().slice(0, 40);
  if (!/^\d+$/.test(raw)) return raw;
  const stripped = raw.replace(/^0+(?=\d)/, '') || '0';
  return stripped.length <= 2 ? stripped.padStart(3, '0') : stripped;
}

export function catalogId(prefix) {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

export async function ensureCatalogSchema(sql) {
  if (catalogSchemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS cw_card_sets (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL DEFAULT 'pokemon',
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      series TEXT,
      release_date DATE,
      source TEXT,
      source_id TEXT,
      raw JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (game, code)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cw_cards (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL DEFAULT 'pokemon',
      source TEXT,
      source_id TEXT,
      name TEXT NOT NULL,
      name_folded TEXT NOT NULL,
      number TEXT,
      set_id TEXT REFERENCES cw_card_sets(id) ON DELETE SET NULL,
      set_code TEXT,
      set_name TEXT,
      rarity TEXT,
      image_small TEXT,
      image_large TEXT,
      raw JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (game, source, source_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cw_card_variants (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cw_cards(id) ON DELETE CASCADE,
      variant_key TEXT NOT NULL,
      label TEXT NOT NULL,
      language TEXT,
      finish TEXT,
      raw JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (card_id, variant_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cw_price_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      card_id TEXT REFERENCES cw_cards(id) ON DELETE SET NULL,
      provider TEXT NOT NULL,
      source TEXT,
      source_field TEXT,
      amount NUMERIC(12,2),
      currency TEXT NOT NULL DEFAULT 'EUR',
      condition TEXT,
      language TEXT,
      url TEXT,
      raw JSONB,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cw_scans (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      mode TEXT NOT NULL DEFAULT 'single',
      status TEXT NOT NULL DEFAULT 'done',
      input JSONB,
      result JSONB,
      best_card_id TEXT REFERENCES cw_cards(id) ON DELETE SET NULL,
      confidence NUMERIC(6,2),
      warnings JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS cw_cards_name_folded_idx ON cw_cards (name_folded)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_cards_set_number_idx ON cw_cards (game, set_code, number)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_price_snapshots_user_time_idx ON cw_price_snapshots (user_id, fetched_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_scans_user_time_idx ON cw_scans (user_id, created_at DESC)`;
  catalogSchemaReady = true;
}

export async function resolveCatalogUserId(req, sql) {
  if (hasAdminToken(req)) return String(req.query?.user || 'default').slice(0, 80) || 'default';
  const user = await getSessionUser(req, sql);
  return user?.id || '';
}

export function scoreCatalogCard(input, card) {
  const wantedName = foldText(input.name || input.originalName || input.cardmarketName);
  const wantedNumber = normalizeCardNumber(input.number || input.fullNumber || input.searchNumber);
  const wantedSet = normalizeSetCode(input.setCode);
  const cardName = foldText(card.name);
  const cardNumber = normalizeCardNumber(card.number);
  const cardSet = normalizeSetCode(card.set_code || card.setCode);
  let score = 0;

  if (wantedName && cardName === wantedName) score += 90;
  else if (wantedName && cardName.includes(wantedName)) score += 52;
  else if (wantedName && wantedName.includes(cardName)) score += 36;
  if (wantedNumber && cardNumber === wantedNumber) score += 85;
  else if (wantedNumber && cardNumber.startsWith(wantedNumber)) score += 38;
  if (wantedSet && cardSet === wantedSet) score += 65;
  return Math.min(100, score);
}

function pokemonCardToRows(card) {
  const setCode = normalizeSetCode(card.set?.ptcgoCode || card.set?.id || '');
  const setId = `pokemon_set_${foldText(setCode || card.set?.id || card.set?.name).replace(/\s+/g, '_') || 'unknown'}`;
  const cardId = `pokemon_card_${String(card.id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  return {
    set: {
      id: setId,
      game: 'pokemon',
      code: setCode || String(card.set?.id || '').toUpperCase(),
      name: normalizeText(card.set?.name || 'Unbekanntes Set'),
      series: normalizeText(card.set?.series || ''),
      releaseDate: card.set?.releaseDate || null,
      source: 'pokemon-tcg-api',
      sourceId: card.set?.id || setCode,
      raw: card.set || {}
    },
    card: {
      id: cardId,
      game: 'pokemon',
      source: 'pokemon-tcg-api',
      sourceId: card.id || cardId,
      name: normalizeText(card.name || ''),
      nameFolded: foldText(card.name || ''),
      number: normalizeCardNumber(card.number || ''),
      setId,
      setCode,
      setName: normalizeText(card.set?.name || ''),
      rarity: normalizeText(card.rarity || ''),
      imageSmall: card.images?.small || '',
      imageLarge: card.images?.large || '',
      raw: card
    }
  };
}

export async function upsertPokemonCard(sql, pokemonCard) {
  await ensureCatalogSchema(sql);
  const rows = pokemonCardToRows(pokemonCard);
  if (!rows.card.name) return null;

  await sql`
    INSERT INTO cw_card_sets (id, game, code, name, series, release_date, source, source_id, raw, updated_at)
    VALUES (${rows.set.id}, ${rows.set.game}, ${rows.set.code}, ${rows.set.name}, ${rows.set.series || null}, ${rows.set.releaseDate}, ${rows.set.source}, ${rows.set.sourceId}, ${JSON.stringify(rows.set.raw)}, now())
    ON CONFLICT (game, code) DO UPDATE SET
      name = EXCLUDED.name,
      series = EXCLUDED.series,
      release_date = EXCLUDED.release_date,
      raw = EXCLUDED.raw,
      updated_at = now()
  `;

  const inserted = await sql`
    INSERT INTO cw_cards (id, game, source, source_id, name, name_folded, number, set_id, set_code, set_name, rarity, image_small, image_large, raw, updated_at)
    VALUES (${rows.card.id}, ${rows.card.game}, ${rows.card.source}, ${rows.card.sourceId}, ${rows.card.name}, ${rows.card.nameFolded}, ${rows.card.number}, ${rows.card.setId}, ${rows.card.setCode}, ${rows.card.setName}, ${rows.card.rarity}, ${rows.card.imageSmall}, ${rows.card.imageLarge}, ${JSON.stringify(rows.card.raw)}, now())
    ON CONFLICT (game, source, source_id) DO UPDATE SET
      name = EXCLUDED.name,
      name_folded = EXCLUDED.name_folded,
      number = EXCLUDED.number,
      set_id = EXCLUDED.set_id,
      set_code = EXCLUDED.set_code,
      set_name = EXCLUDED.set_name,
      rarity = EXCLUDED.rarity,
      image_small = EXCLUDED.image_small,
      image_large = EXCLUDED.image_large,
      raw = EXCLUDED.raw,
      updated_at = now()
    RETURNING *
  `;

  const row = inserted[0];
  await sql`
    INSERT INTO cw_card_variants (id, card_id, variant_key, label, raw, updated_at)
    VALUES (${`${row.id}_standard`}, ${row.id}, 'standard', 'Standard', ${JSON.stringify({ rarity: rows.card.rarity })}, now())
    ON CONFLICT (card_id, variant_key) DO UPDATE SET raw = EXCLUDED.raw, updated_at = now()
  `;
  return row;
}

export async function searchCatalog(sql, input, limit = 12) {
  await ensureCatalogSchema(sql);
  const nameFolded = foldText(input.name || input.originalName || input.cardmarketName);
  const number = normalizeCardNumber(input.number || input.fullNumber || input.searchNumber);
  const setCode = normalizeSetCode(input.setCode);
  const likeName = nameFolded ? `%${nameFolded}%` : '';

  const rows = await sql`
    SELECT id, game, source, source_id, name, number, set_code, set_name, rarity, image_small, image_large, raw, updated_at
    FROM cw_cards
    WHERE
      (${nameFolded} = '' OR name_folded LIKE ${likeName})
      AND (${number} = '' OR number = ${number})
      AND (${setCode} = '' OR set_code = ${setCode})
    ORDER BY updated_at DESC
    LIMIT ${Math.max(1, Math.min(50, Number(limit) || 12))}
  `;

  return rows
    .map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      name: row.name,
      number: row.number || '',
      setCode: row.set_code || '',
      setName: row.set_name || '',
      rarity: row.rarity || '',
      imageSmall: row.image_small || '',
      imageLarge: row.image_large || '',
      source: row.source || 'catalog',
      score: scoreCatalogCard(input, row)
    }))
    .sort((a, b) => b.score - a.score);
}

export async function recordPriceSnapshot(sql, { req, input, result }) {
  if (!sql || !result?.price) return null;
  await ensureCatalogSchema(sql);
  const userId = await resolveCatalogUserId(req, sql);
  const id = catalogId('price');
  const price = result.price;
  const matches = await searchCatalog(sql, {
    name: price.cardName || input.name,
    number: price.number || input.number,
    setCode: price.setCode || input.setCode
  }, 1);
  await sql`
    INSERT INTO cw_price_snapshots (id, user_id, card_id, provider, source, source_field, amount, currency, condition, language, url, raw, fetched_at)
    VALUES (${id}, ${userId || null}, ${matches[0]?.id || null}, ${result.provider || 'pokemon-tcg-cardmarket'}, ${price.source || ''}, ${price.sourceField || ''}, ${price.amount || null}, ${price.currency || 'EUR'}, ${price.condition || input.condition || ''}, ${price.language || input.language || ''}, ${price.url || ''}, ${JSON.stringify({ input, result })}, ${price.fetchedAt || new Date().toISOString()})
  `;
  return id;
}

export async function recordScan(sql, { req, mode, input, result }) {
  if (!sql) return null;
  await ensureCatalogSchema(sql);
  const userId = await resolveCatalogUserId(req, sql);
  const cards = Array.isArray(result?.cards) ? result.cards : [];
  const best = cards
    .map((card) => ({ card, score: Number(card.confidence || 0) }))
    .sort((a, b) => b.score - a.score)[0];
  const matches = best?.card ? await searchCatalog(sql, best.card, 1) : [];
  const id = catalogId('scan');
  await sql`
    INSERT INTO cw_scans (id, user_id, mode, status, input, result, best_card_id, confidence, warnings)
    VALUES (${id}, ${userId || null}, ${mode || result?.mode || 'single'}, 'done', ${JSON.stringify(input || {})}, ${JSON.stringify(result || {})}, ${matches[0]?.id || null}, ${best?.score || null}, ${JSON.stringify(best?.card?.warnings || [])})
  `;
  return id;
}
