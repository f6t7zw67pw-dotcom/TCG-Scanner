import { getSql, hasSessionOrAdmin } from '../_auth.js';
import { ensureCatalogSchema, normalizeCardNumber, normalizeSetCode, resolveSetCodes, searchCatalog, upsertPokemonCard } from '../_catalog.js';

const searchBuckets = globalThis.__cwCatalogSearchBuckets || new Map();
globalThis.__cwCatalogSearchBuckets = searchBuckets;

function clientId(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function checkRateLimit(req) {
  const max = Math.max(1, Number(process.env.CATALOG_SEARCH_MAX_PER_HOUR || 240));
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const key = clientId(req);
  const bucket = searchBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  searchBuckets.set(key, bucket);
  return bucket.count <= max;
}

function normalizeName(value) {
  return String(value || '')
    .replace(/-EX$/i, ' EX')
    .replace(/-GX$/i, ' GX')
    .replace(/-V$/i, ' V')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function baseName(value) {
  return normalizeName(value)
    .replace(/\bEX\b/gi, '')
    .replace(/\bGX\b/gi, '')
    .replace(/\bVMAX\b/gi, '')
    .replace(/\bVSTAR\b/gi, '')
    .replace(/\bV\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function quote(value) {
  return `"${String(value || '').replace(/"/g, '').trim()}"`;
}

function buildPokemonQueries(input, setCodes = []) {
  const name = normalizeName(input.name || input.originalName || input.cardmarketName);
  const base = baseName(name);
  const number = normalizeCardNumber(input.number || input.fullNumber || input.searchNumber);
  const type = String(input.cardType || input.supertype || '').trim();
  const codes = Array.from(new Set([normalizeSetCode(input.setCode), ...setCodes.map(normalizeSetCode)].filter(Boolean)));
  const queries = [];
  const add = (query) => { if (query && !queries.includes(query)) queries.push(query); };
  const withCodes = codes.length ? codes : [''];

  for (const setCode of withCodes) {
    if (name && number && setCode) add(`name:${quote(name)} number:${number} set.ptcgoCode:${setCode}`);
    if (base && number && setCode && base !== name) add(`name:${quote(base)} number:${number} set.ptcgoCode:${setCode}`);
    if (number && setCode) add(`number:${number} set.ptcgoCode:${setCode}`);
    if (name && setCode) add(`name:${quote(name)} set.ptcgoCode:${setCode}`);
    if (base && setCode && base !== name) add(`name:${quote(base)} set.ptcgoCode:${setCode}`);
  }

  if (name && number) add(`name:${quote(name)} number:${number}`);
  if (base && number && base !== name) add(`name:${quote(base)} number:${number}`);
  if (name && type) add(`name:${quote(name)} supertype:${quote(type)}`);
  if (name) add(`name:${quote(name)}`);
  if (base && base !== name) add(`name:${quote(base)}`);
  if (number) add(`number:${number}`);
  for (const setCode of codes) add(`set.ptcgoCode:${setCode}`);
  return queries;
}

async function fetchPokemonCandidates(input, setCodes = []) {
  const seen = new Set();
  const cards = [];
  const headers = process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {};

  for (const query of buildPokemonQueries(input, setCodes)) {
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=30&orderBy=-set.releaseDate`;
    const response = await fetch(url, { headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) continue;
    for (const card of data.data || []) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      cards.push(card);
    }
    if (cards.length >= 30) break;
  }
  return cards;
}

function publicCard(card) {
  return {
    id: card.id,
    sourceId: card.sourceId || card.source_id || '',
    name: card.name || '',
    cardmarketName: String(card.name || '')
      .replace(/\s+ex$/i, '-ex')
      .replace(/\s+EX$/i, '-EX')
      .replace(/\s+V$/i, '-V')
      .replace(/\s+GX$/i, '-GX'),
    number: card.number || '',
    setCode: card.setCode || card.set_code || '',
    setName: String(card.setName || card.set_name || '').replace(/\s+/g, '-'),
    cardmarketSetName: card.cardmarketSetName || '',
    rarity: card.rarity || '',
    imageSmall: card.imageSmall || card.image_small || '',
    imageLarge: card.imageLarge || card.image_large || '',
    score: Number(card.score || 0),
    source: card.source || 'catalog'
  };
}

async function flexibleCatalogSearch(sql, input, limit = 12) {
  const attempts = [
    input,
    { ...input, setCode: '' },
    { ...input, setCode: '', number: input.number || input.fullNumber || input.searchNumber || '' },
    { ...input, setCode: '', setName: '', number: '', fullNumber: '', searchNumber: '' }
  ];
  const seen = new Set();
  const merged = [];
  for (const attempt of attempts) {
    const rows = await searchCatalog(sql, attempt, limit);
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    if (merged.length >= limit && Number(merged[0]?.score || 0) >= 70) break;
  }
  return merged.sort((a, b) => b.score - a.score).slice(0, limit);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });

  const sql = getSql();
  if (!(await hasSessionOrAdmin(req, sql))) return res.status(401).json({ ok: false, error: 'Bitte anmelden, bevor du Karten suchst.' });
  if (!sql) return res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt in Vercel. Katalogsuche ist noch nicht eingerichtet.' });
  if (!checkRateLimit(req)) return res.status(429).json({ ok: false, error: 'Katalog-Suchlimit erreicht. Bitte spaeter erneut versuchen.' });

  try {
    await ensureCatalogSchema(sql);
    const input = req.body || {};
    const hasQuery = input.name || input.originalName || input.cardmarketName || input.number || input.fullNumber || input.searchNumber || input.setCode || input.setName;
    if (!hasQuery) return res.status(400).json({ ok: false, error: 'Kein Suchbegriff vorhanden.' });

    const setCodes = await resolveSetCodes(sql, input);
    let cards = await flexibleCatalogSearch(sql, input, 12);
    let hydrated = false;

    if (cards.length < 3 || Number(cards[0]?.score || 0) < 70) {
      const externalCards = await fetchPokemonCandidates(input, setCodes);
      for (const card of externalCards) await upsertPokemonCard(sql, card);
      hydrated = externalCards.length > 0;
      cards = await flexibleCatalogSearch(sql, input, 12);
    }

    return res.status(200).json({ ok: true, source: hydrated ? 'catalog+pokemon-tcg-api' : 'catalog', setCodes, cards: cards.map(publicCard).slice(0, 12) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Katalogsuche fehlgeschlagen.' });
  }
}
