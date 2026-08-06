import { randomBytes } from 'node:crypto';
import { getSessionUser, hasAdminToken } from './_auth.js';

let catalogSchemaReady = false;

const MANUAL_SET_ALIASES = {
  BASE: ['Base Set', 'Base-Set', 'Basis Set', 'base1'],
  JU: ['Jungle', 'Dschungel', 'base2'],
  FO: ['Fossil', 'base3'],
  B2: ['Base Set 2', 'Base-Set-2', 'base4'],
  TR: ['Team Rocket', 'Team-Rocket', 'base5'],
  G1: ['Gym Heroes', 'Gym-Heroes', 'gym1'],
  G2: ['Gym Challenge', 'Gym-Challenge', 'gym2'],
  N1: ['Neo Genesis', 'Neo-Genesis', 'neo1'],
  N2: ['Neo Discovery', 'Neo-Discovery', 'neo2'],
  N3: ['Neo Revelation', 'Neo-Revelation', 'neo3'],
  N4: ['Neo Destiny', 'Neo-Destiny', 'neo4'],
  LC: ['Legendary Collection', 'Legendary-Collection', 'base6'],
  EX: ['Expedition Base Set', 'Expedition-Base-Set', 'ecard1'],
  AQ: ['Aquapolis', 'ecard2'],
  SK: ['Skyridge', 'ecard3'],
  RS: ['EX Ruby & Sapphire', 'Ruby & Sapphire', 'EX-Ruby-&-Sapphire', 'ex1'],
  SS: ['EX Sandstorm', 'Sandstorm', 'ex2'],
  DR: ['EX Dragon', 'Dragon', 'ex3'],
  MA: ['EX Team Magma vs Team Aqua', 'Team Magma vs Team Aqua', 'ex4'],
  HL: ['EX Hidden Legends', 'Hidden Legends', 'ex5'],
  FRLG: ['EX FireRed & LeafGreen', 'FireRed & LeafGreen', 'ex6'],
  TRR: ['EX Team Rocket Returns', 'Team Rocket Returns', 'ex7'],
  DX: ['EX Deoxys', 'Deoxys', 'ex8'],
  EM: ['EX Emerald', 'Emerald', 'ex9'],
  UF: ['EX Unseen Forces', 'Unseen Forces', 'ex10'],
  DS: ['EX Delta Species', 'Delta Species', 'ex11'],
  LM: ['EX Legend Maker', 'Legend Maker', 'ex12'],
  HP: ['EX Holon Phantoms', 'Holon Phantoms', 'ex13'],
  CG: ['EX Crystal Guardians', 'Crystal Guardians', 'ex14'],
  DF: ['EX Dragon Frontiers', 'Dragon Frontiers', 'ex15'],
  PK: ['EX Power Keepers', 'Power Keepers', 'ex16'],
  DP: ['Diamond & Pearl', 'Diamond-and-Pearl', 'dp1'],
  MT: ['Mysterious Treasures', 'dp2'],
  SW: ['Secret Wonders', 'dp3'],
  GE: ['Great Encounters', 'dp4'],
  MD: ['Majestic Dawn', 'dp5'],
  LA: ['Legends Awakened', 'dp6'],
  SF: ['Stormfront', 'dp7'],
  PL: ['Platinum', 'pl1'],
  RR: ['Rising Rivals', 'pl2'],
  SV: ['Supreme Victors', 'pl3'],
  AR: ['Arceus', 'pl4'],
  HS: ['HeartGold & SoulSilver', 'HeartGold-SoulSilver', 'hgss1'],
  UL: ['Unleashed', 'hgss2'],
  UD: ['Undaunted', 'hgss3'],
  TM: ['Triumphant', 'hgss4'],
  BLW: ['Black & White', 'Black-and-White', 'bw1'],
  EPO: ['Emerging Powers', 'bw2'],
  NVI: ['Noble Victories', 'bw3'],
  NXD: ['Next Destinies', 'bw4'],
  DEX: ['Dark Explorers', 'bw5'],
  DRX: ['Dragons Exalted', 'bw6'],
  BCR: ['Boundaries Crossed', 'bw7'],
  PLS: ['Plasma Storm', 'bw8'],
  PLF: ['Plasma Freeze', 'bw9'],
  PLB: ['Plasma Blast', 'bw10'],
  LTR: ['Legendary Treasures', 'bw11'],
  XY: ['XY', 'xy1'],
  FLF: ['Flashfire', 'xy2'],
  FFI: ['Furious Fists', 'xy3'],
  PHF: ['Phantom Forces', 'xy4'],
  PRC: ['Primal Clash', 'xy5'],
  ROS: ['Roaring Skies', 'xy6'],
  AOR: ['Ancient Origins', 'xy7'],
  BKT: ['BREAKthrough', 'Breakthrough', 'xy8'],
  BKP: ['BREAKpoint', 'Breakpoint', 'xy9'],
  GEN: ['Generations', 'g1'],
  FCO: ['Fates Collide', 'xy10'],
  STS: ['Steam Siege', 'xy11'],
  EVO: ['Evolutions', 'xy12'],
  SUM: ['Sun & Moon', 'Sun-and-Moon', 'sm1'],
  GRI: ['Guardians Rising', 'sm2'],
  BUS: ['Burning Shadows', 'sm3'],
  SLG: ['Shining Legends', 'sm35'],
  CIN: ['Crimson Invasion', 'sm4'],
  UPR: ['Ultra Prism', 'sm5'],
  FLI: ['Forbidden Light', 'sm6'],
  CES: ['Celestial Storm', 'sm7'],
  DRM: ['Dragon Majesty', 'sm75'],
  LOT: ['Lost Thunder', 'sm8'],
  TEU: ['Team Up', 'sm9'],
  DET: ['Detective Pikachu', 'det1'],
  UNB: ['Unbroken Bonds', 'sm10'],
  UNM: ['Unified Minds', 'sm11'],
  HIF: ['Hidden Fates', 'sm115'],
  CEC: ['Cosmic Eclipse', 'sm12'],
  SSH: ['Sword & Shield', 'Sword-and-Shield', 'swsh1'],
  RCL: ['Rebel Clash', 'swsh2'],
  DAA: ['Darkness Ablaze', 'swsh3'],
  CPA: ['Champion\'s Path', 'Champions Path', 'swsh35'],
  VIV: ['Vivid Voltage', 'swsh4'],
  SHF: ['Shining Fates', 'swsh45'],
  BST: ['Battle Styles', 'swsh5'],
  CRE: ['Chilling Reign', 'swsh6'],
  EVS: ['Evolving Skies', 'swsh7'],
  CEL: ['Celebrations', 'cel25'],
  FST: ['Fusion Strike', 'swsh8'],
  BRS: ['Brilliant Stars', 'swsh9'],
  ASR: ['Astral Radiance', 'swsh10'],
  PGO: ['Pokemon GO', 'Pokémon GO', 'pgo'],
  LOR: ['Lost Origin', 'swsh11'],
  SIT: ['Silver Tempest', 'swsh12'],
  CRZ: ['Crown Zenith', 'swsh125'],
  SVI: ['Scarlet & Violet', 'Scarlet-and-Violet', 'sv1'],
  PAL: ['Paldea Evolved', 'sv2'],
  OBF: ['Obsidian Flames', 'sv3'],
  MEW: ['Scarlet & Violet 151', '151', 'Pokemon 151', 'sv3pt5'],
  PAR: ['Paradox Rift', 'sv4'],
  PAF: ['Paldean Fates', 'sv4pt5'],
  TEF: ['Temporal Forces', 'sv5'],
  TWM: ['Twilight Masquerade', 'sv6'],
  SFA: ['Shrouded Fable', 'sv6pt5'],
  SCR: ['Stellar Crown', 'sv7'],
  SSP: ['Surging Sparks', 'sv8'],
  PRE: ['Prismatic Evolutions', 'sv8pt5'],
  JTG: ['Journey Together', 'sv9'],
  DRI: ['Destined Rivals', 'sv10']
};

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
    .replace(/&/g, ' and ')
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
    .replace(/^SVBA$/, 'SV8A')
    .replace(/^MEW$/, 'MEW');
}

export function normalizeCardNumber(value) {
  const raw = String(value || '').toUpperCase().split('/')[0].replace(/\s+/g, '').trim().slice(0, 40);
  if (!/^\d+$/.test(raw)) return raw;
  const stripped = raw.replace(/^0+(?=\d)/, '') || '0';
  return stripped.length <= 2 ? stripped.padStart(3, '0') : stripped;
}

export function cardmarketSetSlug(value) {
  return normalizeText(value)
    .replace(/Pokémon/g, 'Pokemon')
    .replace(/&/g, 'and')
    .replace(/[/:]/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function unique(values) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

export function setAliasesFor(set = {}) {
  const code = normalizeSetCode(set.code || set.ptcgoCode || '');
  const sourceId = String(set.sourceId || set.id || '').trim();
  const name = normalizeText(set.name || '');
  const series = normalizeText(set.series || '');
  const manual = MANUAL_SET_ALIASES[code] || MANUAL_SET_ALIASES[sourceId.toUpperCase()] || [];
  return unique([
    code,
    sourceId,
    sourceId.toUpperCase(),
    name,
    name.replace(/^EX\s+/i, ''),
    cardmarketSetSlug(name),
    series && `${series} ${name}`,
    ...manual,
    ...manual.map(cardmarketSetSlug)
  ]);
}

export function catalogId(prefix) {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

async function upsertSetAliases(sql, set) {
  const code = normalizeSetCode(set.code || '');
  if (!set.id || !code) return;
  for (const alias of setAliasesFor(set)) {
    const folded = foldText(alias);
    if (!folded) continue;
    await sql`
      INSERT INTO cw_set_aliases (id, set_id, game, code, alias, alias_folded, source, updated_at)
      VALUES (${`${set.id}_${folded.replace(/\s+/g, '_')}`.slice(0, 220)}, ${set.id}, ${set.game || 'pokemon'}, ${code}, ${alias}, ${folded}, 'catalog', now())
      ON CONFLICT (game, alias_folded) DO UPDATE SET
        set_id = EXCLUDED.set_id,
        code = EXCLUDED.code,
        alias = EXCLUDED.alias,
        updated_at = now()
    `;
  }
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
    CREATE TABLE IF NOT EXISTS cw_set_aliases (
      id TEXT PRIMARY KEY,
      set_id TEXT REFERENCES cw_card_sets(id) ON DELETE CASCADE,
      game TEXT NOT NULL DEFAULT 'pokemon',
      code TEXT NOT NULL,
      alias TEXT NOT NULL,
      alias_folded TEXT NOT NULL,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (game, alias_folded)
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
      edition TEXT,
      treatment TEXT,
      promo BOOLEAN NOT NULL DEFAULT false,
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
  await sql`ALTER TABLE cw_card_variants ADD COLUMN IF NOT EXISTS edition TEXT`;
  await sql`ALTER TABLE cw_card_variants ADD COLUMN IF NOT EXISTS treatment TEXT`;
  await sql`ALTER TABLE cw_card_variants ADD COLUMN IF NOT EXISTS promo BOOLEAN NOT NULL DEFAULT false`;
  await sql`CREATE INDEX IF NOT EXISTS cw_cards_set_number_idx ON cw_cards (game, set_code, number)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_cards_set_name_idx ON cw_cards (game, set_name)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_set_aliases_code_idx ON cw_set_aliases (game, code)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_set_aliases_folded_idx ON cw_set_aliases (game, alias_folded)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_price_snapshots_user_time_idx ON cw_price_snapshots (user_id, fetched_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_scans_user_time_idx ON cw_scans (user_id, created_at DESC)`;
  catalogSchemaReady = true;
}

export async function resolveCatalogUserId(req, sql) {
  if (hasAdminToken(req)) return String(req.query?.user || 'default').slice(0, 80) || 'default';
  const user = await getSessionUser(req, sql);
  return user?.id || '';
}

export async function resolveSetCodes(sql, input = {}) {
  await ensureCatalogSchema(sql);
  const rawValues = unique([
    input.setCode,
    input.setName,
    input.set,
    input.expansion,
    input.series
  ]);
  const codes = new Set(rawValues.map(normalizeSetCode).filter(Boolean));
  const foldedValues = rawValues.map(foldText).filter(Boolean);
  for (const folded of foldedValues) {
    const rows = await sql`
      SELECT code
      FROM cw_set_aliases
      WHERE game = 'pokemon' AND (alias_folded = ${folded} OR alias_folded LIKE ${`%${folded}%`} OR ${folded} LIKE '%' || alias_folded || '%')
      LIMIT 10
    `;
    rows.forEach((row) => { if (row.code) codes.add(normalizeSetCode(row.code)); });
  }
  return Array.from(codes).filter(Boolean);
}

export function scoreCatalogCard(input, card) {
  const wantedName = foldText(input.name || input.originalName || input.cardmarketName);
  const wantedNumber = normalizeCardNumber(input.number || input.fullNumber || input.searchNumber);
  const wantedSet = normalizeSetCode(input.setCode);
  const wantedSetName = foldText(input.setName || input.set || input.expansion);
  const cardName = foldText(card.name);
  const cardNumber = normalizeCardNumber(card.number);
  const cardSet = normalizeSetCode(card.set_code || card.setCode);
  const cardSetName = foldText(card.set_name || card.setName);
  let score = 0;

  if (wantedName && cardName === wantedName) score += 90;
  else if (wantedName && cardName.includes(wantedName)) score += 52;
  else if (wantedName && wantedName.includes(cardName)) score += 36;
  if (wantedNumber && cardNumber === wantedNumber) score += 85;
  else if (wantedNumber && cardNumber.startsWith(wantedNumber)) score += 38;
  if (wantedSet && cardSet === wantedSet) score += 65;
  else if (wantedSetName && cardSetName && (cardSetName.includes(wantedSetName) || wantedSetName.includes(cardSetName))) score += 35;
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
  await upsertSetAliases(sql, rows.set);

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
    INSERT INTO cw_card_variants (id, card_id, variant_key, label, language, finish, edition, treatment, promo, raw, updated_at)
    VALUES (${`${row.id}_standard`}, ${row.id}, 'en:normal:unlimited:standard', 'Standard', 'en', 'normal', 'unlimited', 'standard', false, ${JSON.stringify({ rarity: rows.card.rarity })}, now())
    ON CONFLICT (card_id, variant_key) DO UPDATE SET
      label = EXCLUDED.label,
      language = EXCLUDED.language,
      finish = EXCLUDED.finish,
      edition = EXCLUDED.edition,
      treatment = EXCLUDED.treatment,
      promo = EXCLUDED.promo,
      raw = EXCLUDED.raw,
      updated_at = now()
  `;
  return row;
}

export async function searchCatalog(sql, input, limit = 12) {
  await ensureCatalogSchema(sql);
  const nameFolded = foldText(input.name || input.originalName || input.cardmarketName);
  const number = normalizeCardNumber(input.number || input.fullNumber || input.searchNumber);
  const setCodes = await resolveSetCodes(sql, input);
  const likeName = nameFolded ? `%${nameFolded}%` : '';
  const rows = await sql`
    SELECT id, game, source, source_id, name, number, set_code, set_name, rarity, image_small, image_large, raw, updated_at
    FROM cw_cards
    WHERE
      (${nameFolded} = '' OR name_folded LIKE ${likeName})
      AND (${number} = '' OR number = ${number})
      AND (${setCodes.length} = 0 OR set_code = ANY(${setCodes}))
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
      cardmarketSetName: cardmarketSetSlug(row.set_name || ''),
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
    setCode: price.setCode || input.setCode,
    setName: price.set || input.setName
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
