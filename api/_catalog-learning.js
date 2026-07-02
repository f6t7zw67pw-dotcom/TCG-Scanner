import { cardmarketSetSlug, ensureCatalogSchema, foldText, normalizeSetCode, normalizeText, scoreCatalogCard } from './_catalog.js';

let learningSchemaReady = false;

export async function ensureLearningSchema(sql) {
  if (learningSchemaReady) return;
  await ensureCatalogSchema(sql);

  await sql`
    CREATE TABLE IF NOT EXISTS cw_card_name_aliases (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cw_cards(id) ON DELETE CASCADE,
      game TEXT NOT NULL DEFAULT 'pokemon',
      alias TEXT NOT NULL,
      alias_folded TEXT NOT NULL,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (game, alias_folded, card_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS cw_card_name_aliases_folded_idx ON cw_card_name_aliases (game, alias_folded)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_card_name_aliases_card_idx ON cw_card_name_aliases (card_id)`;
  learningSchemaReady = true;
}

function unique(values) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function aliasId(prefix, cardId, folded) {
  return `${prefix}_${cardId}_${folded.replace(/\s+/g, '_')}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 220);
}

function scanCardsFromResult(result = {}) {
  if (Array.isArray(result.cards)) return result.cards;
  if (result.card && typeof result.card === 'object') return [result.card];
  return [];
}

async function insertCardAlias(sql, card, alias, source = 'confirmation') {
  const clean = normalizeText(alias);
  const folded = foldText(clean);
  if (!card?.id || !clean || !folded || folded.length < 2) return false;
  if (folded === foldText(card.name)) return false;

  await sql`
    INSERT INTO cw_card_name_aliases (id, card_id, game, alias, alias_folded, source, updated_at)
    VALUES (${aliasId('card_alias', card.id, folded)}, ${card.id}, ${card.game || 'pokemon'}, ${clean}, ${folded}, ${source}, now())
    ON CONFLICT (game, alias_folded, card_id) DO UPDATE SET
      alias = EXCLUDED.alias,
      source = EXCLUDED.source,
      updated_at = now()
  `;
  return true;
}

async function insertSetAlias(sql, card, alias, source = 'confirmation') {
  const clean = normalizeText(alias);
  const folded = foldText(clean);
  const code = normalizeSetCode(card?.set_code || card?.setCode || '');
  if (!card?.set_id || !code || !clean || !folded || folded.length < 2) return false;

  await sql`
    INSERT INTO cw_set_aliases (id, set_id, game, code, alias, alias_folded, source, updated_at)
    VALUES (${aliasId('set_alias', card.set_id, folded)}, ${card.set_id}, ${card.game || 'pokemon'}, ${code}, ${clean}, ${folded}, ${source}, now())
    ON CONFLICT (game, alias_folded) DO UPDATE SET
      set_id = EXCLUDED.set_id,
      code = EXCLUDED.code,
      alias = EXCLUDED.alias,
      source = EXCLUDED.source,
      updated_at = now()
  `;
  return true;
}

export async function learnConfirmedCardAliases(sql, { scanResult, confirmedCardId, confirmedCard } = {}) {
  if (!sql) return { learnedCardAliases: 0, learnedSetAliases: 0 };
  await ensureLearningSchema(sql);

  const cardId = String(confirmedCardId || confirmedCard?.id || '').trim();
  if (!cardId) return { learnedCardAliases: 0, learnedSetAliases: 0 };

  const rows = await sql`
    SELECT id, game, name, set_id, set_code, set_name
    FROM cw_cards
    WHERE id = ${cardId}
    LIMIT 1
  `;
  const catalogCard = rows[0];
  if (!catalogCard) return { learnedCardAliases: 0, learnedSetAliases: 0 };

  const scanCards = scanCardsFromResult(scanResult);
  const firstScanCard = scanCards[0] || {};
  const nameAliases = unique([
    firstScanCard.originalName,
    firstScanCard.name,
    firstScanCard.cardmarketName,
    confirmedCard?.originalName,
    confirmedCard?.cardmarketName
  ]);
  const setAliases = unique([
    firstScanCard.setCode,
    firstScanCard.setName,
    firstScanCard.set,
    firstScanCard.expansion,
    confirmedCard?.setCode,
    confirmedCard?.setName,
    confirmedCard?.cardmarketSetName
  ]);

  let learnedCardAliases = 0;
  let learnedSetAliases = 0;
  for (const alias of nameAliases) {
    if (await insertCardAlias(sql, catalogCard, alias)) learnedCardAliases += 1;
  }
  for (const alias of setAliases) {
    if (await insertSetAlias(sql, catalogCard, alias)) learnedSetAliases += 1;
  }

  return { learnedCardAliases, learnedSetAliases };
}

export async function findLearnedAliasCards(sql, input = {}, limit = 12) {
  if (!sql) return [];
  await ensureLearningSchema(sql);

  const rawNames = unique([input.name, input.originalName, input.cardmarketName]);
  const foldedNames = rawNames.map(foldText).filter(Boolean);
  if (!foldedNames.length) return [];

  const seen = new Set();
  const cards = [];
  for (const folded of foldedNames) {
    const rows = await sql`
      SELECT c.id, c.game, c.source, c.source_id, c.name, c.number, c.set_code, c.set_name, c.rarity, c.image_small, c.image_large, c.raw, c.updated_at, a.alias
      FROM cw_card_name_aliases a
      JOIN cw_cards c ON c.id = a.card_id
      WHERE a.game = 'pokemon'
        AND (a.alias_folded = ${folded} OR a.alias_folded LIKE ${`%${folded}%`} OR ${folded} LIKE '%' || a.alias_folded || '%')
      ORDER BY a.updated_at DESC
      LIMIT ${Math.max(1, Math.min(30, Number(limit) || 12))}
    `;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      cards.push({
        id: row.id,
        sourceId: row.source_id,
        name: row.name,
        number: row.number || '',
        setCode: row.set_code || '',
        setName: row.set_name || '',
        cardmarketSetName: cardmarketSetSlug(row.set_name || ''),
        rarity: row.rarity || '',
        imageSmall: row.image_small || '',
        imageLarge: row.image_large || '',
        source: 'learned-alias',
        learnedAlias: row.alias || '',
        score: Math.max(78, scoreCatalogCard({ ...input, name: row.name, setCode: input.setCode || row.set_code }, row))
      });
    }
  }
  return cards.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(30, Number(limit) || 12)));
}
