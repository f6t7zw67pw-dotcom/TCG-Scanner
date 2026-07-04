import { getSql } from './_auth.js';

let aliasSchemaReady = false;
const memoryCache = globalThis.__cwPokemonNameAliasCache || new Map();
globalThis.__cwPokemonNameAliasCache = memoryCache;

export function normalizePokemonAlias(value) {
  return String(value || '')
    .trim()
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function ensurePokemonNameAliasSchema(sql = getSql()) {
  if (!sql) return false;
  if (aliasSchemaReady) return true;
  await sql`
    CREATE TABLE IF NOT EXISTS cw_pokemon_name_aliases (
      id TEXT PRIMARY KEY,
      pokemon_id INT NOT NULL,
      english_name TEXT NOT NULL,
      alias TEXT NOT NULL,
      alias_folded TEXT NOT NULL,
      language TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'pokeapi',
      raw JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (alias_folded, language)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS cw_pokemon_name_aliases_alias_idx ON cw_pokemon_name_aliases (alias_folded)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_pokemon_name_aliases_english_idx ON cw_pokemon_name_aliases (english_name)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_pokemon_name_aliases_pokemon_idx ON cw_pokemon_name_aliases (pokemon_id)`;
  aliasSchemaReady = true;
  return true;
}

function publicAlias(row) {
  if (!row) return null;
  return {
    pokemonId: Number(row.pokemon_id || 0),
    englishName: row.english_name || '',
    alias: row.alias || '',
    language: row.language || '',
    source: row.source || 'pokemon-name-db'
  };
}

export async function lookupPokemonNameAlias(value, sql = getSql()) {
  const alias = String(value || '').trim();
  const folded = normalizePokemonAlias(alias);
  if (!folded) return null;
  if (memoryCache.has(folded)) return memoryCache.get(folded);
  if (!sql) return null;

  await ensurePokemonNameAliasSchema(sql);
  const rows = await sql`
    SELECT pokemon_id, english_name, alias, language, source
    FROM cw_pokemon_name_aliases
    WHERE alias_folded = ${folded}
    ORDER BY
      CASE language
        WHEN 'ja-Hrkt' THEN 1
        WHEN 'ja' THEN 2
        WHEN 'zh-Hans' THEN 3
        WHEN 'zh-Hant' THEN 4
        WHEN 'ko' THEN 5
        WHEN 'de' THEN 6
        ELSE 9
      END
    LIMIT 1
  `;
  const result = publicAlias(rows[0]);
  if (result) memoryCache.set(folded, result);
  return result;
}

export async function upsertPokemonNameAliases(sql, species) {
  await ensurePokemonNameAliasSchema(sql);
  const pokemonId = Number(species?.id || 0);
  const names = Array.isArray(species?.names) ? species.names : [];
  const englishName = String(names.find((item) => item.language?.name === 'en')?.name || species?.name || '')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  if (!pokemonId || !englishName) return 0;

  const allowed = new Set(['en', 'de', 'ja', 'ja-Hrkt', 'ko', 'zh-Hans', 'zh-Hant', 'roomaji']);
  const aliases = [];
  for (const item of names) {
    const language = String(item.language?.name || '').trim();
    const alias = String(item.name || '').trim();
    if (!allowed.has(language) || !alias) continue;
    aliases.push({ language, alias });
  }
  aliases.push({ language: 'en', alias: englishName });

  let count = 0;
  for (const item of aliases) {
    const folded = normalizePokemonAlias(item.alias);
    if (!folded) continue;
    const id = `pokemon_alias_${pokemonId}_${item.language}_${folded.replace(/\s+/g, '_')}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 220);
    await sql`
      INSERT INTO cw_pokemon_name_aliases (id, pokemon_id, english_name, alias, alias_folded, language, source, raw, updated_at)
      VALUES (${id}, ${pokemonId}, ${englishName}, ${item.alias}, ${folded}, ${item.language}, 'pokeapi', ${JSON.stringify(species)}, now())
      ON CONFLICT (alias_folded, language) DO UPDATE SET
        pokemon_id = EXCLUDED.pokemon_id,
        english_name = EXCLUDED.english_name,
        alias = EXCLUDED.alias,
        source = EXCLUDED.source,
        raw = EXCLUDED.raw,
        updated_at = now()
    `;
    memoryCache.set(folded, { pokemonId, englishName, alias: item.alias, language: item.language, source: 'pokemon-name-db' });
    count += 1;
  }
  return count;
}
