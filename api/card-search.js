import searchHandler from './cards/search.js';
import { enrichForeignNameInput, hasAsianText } from './_i18n-name.js';
import { getSql, hasAdminToken } from './_auth.js';
import { ensurePokemonNameAliasSchema, lookupPokemonNameAlias, upsertPokemonNameAliases } from './_pokemon-name-aliases.js';

export const config = { maxDuration: 60 };

function text(value) {
  return String(value || '').trim();
}

function normalizeCardmarketName(value) {
  return text(value)
    .replace(/\s+ex$/i, '-ex')
    .replace(/\s+EX$/i, '-EX')
    .replace(/\s+V$/i, '-V')
    .replace(/\s+GX$/i, '-GX');
}

function fastCandidate(input) {
  const number = text(input.fullNumber || input.number || input.searchNumber);
  const setCode = text(input.setCode);
  const setName = text(input.cardmarketSetName || input.setName);
  const cardmarketName = normalizeCardmarketName(input.cardmarketName || input.englishName || input.name);
  const visibleName = text(input.originalName || input.visibleTitle || input.name || cardmarketName);
  if (!cardmarketName && !visibleName) return null;
  if (!number && !setCode && !setName) return null;

  return {
    id: `fast-scan-${Date.now()}`,
    sourceId: input.i18nSourceId || '',
    name: visibleName || cardmarketName,
    cardmarketName: cardmarketName || visibleName,
    number,
    setCode,
    setName,
    cardmarketSetName: setName,
    rarity: text(input.rarity || input.cardType),
    imageSmall: text(input.imageSmall || input.image),
    imageLarge: text(input.imageLarge || input.image),
    score: input.englishName || input.cardmarketName ? 82 : 58,
    source: input.i18nSource || 'fast-scan'
  };
}

async function applyPokemonAlias(input = {}) {
  const names = [input.name, input.originalName, input.cardmarketName, input.visibleTitle]
    .map(text)
    .filter(Boolean);
  if (!names.some(hasAsianText)) return null;
  for (const name of names) {
    const alias = await lookupPokemonNameAlias(name).catch(() => null);
    if (!alias?.englishName) continue;
    const englishName = alias.englishName;
    return {
      ...input,
      name: englishName,
      englishName,
      cardmarketName: normalizeCardmarketName(englishName),
      originalName: text(input.originalName || input.visibleTitle || input.name || alias.alias),
      visibleTitle: text(input.visibleTitle || input.originalName || input.name || alias.alias),
      i18nSource: alias.source || 'pokemon-name-db',
      i18nSourceId: String(alias.pokemonId || ''),
      i18nScore: 95,
      __cwAliasApplied: true
    };
  }
  return null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TCG-Scanner' } });
  if (!response.ok) throw new Error(`PokeAPI Fehler ${response.status}`);
  return response.json();
}

async function runLimited(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    while (index < items.length) {
      const current = items[index++];
      results.push(await worker(current));
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, next));
  return results;
}

async function syncPokemonAliases(req, res) {
  if (!hasAdminToken(req)) return res.status(401).json({ ok: false, error: 'Admin-Token fehlt oder ist falsch.' });
  const sql = getSql();
  if (!sql) return res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt.' });

  await ensurePokemonNameAliasSchema(sql);
  const offset = Math.max(0, Number(req.query.offset || req.body?.offset || 0));
  const limit = Math.max(1, Math.min(250, Number(req.query.limit || req.body?.limit || 150)));
  const list = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species?offset=${offset}&limit=${limit}`);
  const items = Array.isArray(list.results) ? list.results : [];
  let aliases = 0;
  let imported = 0;
  const failures = [];

  await runLimited(items, 12, async (item) => {
    try {
      const species = await fetchJson(item.url);
      aliases += await upsertPokemonNameAliases(sql, species);
      imported += 1;
    } catch (err) {
      failures.push({ name: item.name, error: err?.message || 'Import fehlgeschlagen' });
    }
  });

  return res.status(200).json({
    ok: true,
    source: 'pokeapi-name-alias-sync',
    offset,
    limit,
    imported,
    aliases,
    total: Number(list.count || 0),
    nextOffset: offset + items.length < Number(list.count || 0) ? offset + items.length : null,
    failures: failures.slice(0, 10)
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    if (req.body.adminAction === 'syncPokemonAliases') {
      return syncPokemonAliases(req, res);
    }
    const aliased = await applyPokemonAlias(req.body);
    if (req.body.fast === true || req.body.fast === 'true') {
      const enriched = aliased || await enrichForeignNameInput(req.body).catch(() => req.body);
      const card = fastCandidate(enriched);
      return res.status(200).json({ ok: true, source: 'fast-scan', setCodes: enriched.setCode ? [enriched.setCode] : [], cards: card ? [card] : [] });
    }
    req.body = aliased || await enrichForeignNameInput(req.body);
  }
  return searchHandler(req, res);
}
