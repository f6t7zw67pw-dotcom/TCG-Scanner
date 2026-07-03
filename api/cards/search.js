import { getSql, hasSessionOrAdmin } from '../_auth.js';
import { ensureCatalogSchema, normalizeCardNumber, normalizeSetCode, resolveSetCodes, searchCatalog, upsertPokemonCard } from '../_catalog.js';
import { findLearnedAliasCards } from '../_catalog-learning.js';
import { nameSearchVariants } from '../_name-aliases.js';

const searchBuckets = globalThis.__cwCatalogSearchBuckets || new Map();
globalThis.__cwCatalogSearchBuckets = searchBuckets;
const tcgdexCache = globalThis.__cwTcgdexCache || new Map();
globalThis.__cwTcgdexCache = tcgdexCache;

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

function fold(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quote(value) {
  return `"${String(value || '').replace(/"/g, '').trim()}"`;
}

function buildNameVariants(input) {
  const raw = input.name || input.originalName || input.cardmarketName || input.englishName || input.visibleTitle || '';
  const variants = nameSearchVariants(raw);
  const normalized = normalizeName(raw);
  if (normalized && !variants.includes(normalized)) variants.push(normalized);
  for (const extra of [input.cardmarketName, input.englishName, input.visibleTitle, input.originalName]) {
    const value = normalizeName(extra || '');
    if (value && !variants.includes(value)) variants.push(value);
  }
  return variants.slice(0, 18);
}

function buildPokemonQueries(input, setCodes = []) {
  const names = buildNameVariants(input);
  const bases = Array.from(new Set(names.map(baseName).filter(Boolean)));
  const number = normalizeCardNumber(input.number || input.fullNumber || input.searchNumber);
  const type = String(input.cardType || input.supertype || '').trim();
  const codes = Array.from(new Set([normalizeSetCode(input.setCode), ...setCodes.map(normalizeSetCode)].filter(Boolean)));
  const queries = [];
  const add = (query) => { if (query && !queries.includes(query)) queries.push(query); };
  const withCodes = codes.length ? codes : [''];

  for (const setCode of withCodes) {
    for (const name of names) {
      if (name && number && setCode) add(`name:${quote(name)} number:${number} set.ptcgoCode:${setCode}`);
      if (name && setCode) add(`name:${quote(name)} set.ptcgoCode:${setCode}`);
    }
    for (const base of bases) {
      if (base && number && setCode) add(`name:${quote(base)} number:${number} set.ptcgoCode:${setCode}`);
      if (base && setCode) add(`name:${quote(base)} set.ptcgoCode:${setCode}`);
    }
    if (number && setCode) add(`number:${number} set.ptcgoCode:${setCode}`);
  }

  for (const name of names) {
    if (name && number) add(`name:${quote(name)} number:${number}`);
    if (name && type) add(`name:${quote(name)} supertype:${quote(type)}`);
    if (name) add(`name:${quote(name)}`);
  }
  for (const base of bases) {
    if (base && number) add(`name:${quote(base)} number:${number}`);
    if (base) add(`name:${quote(base)}`);
  }
  if (number) add(`number:${number}`);
  for (const setCode of codes) add(`set.ptcgoCode:${setCode}`);
  return queries.slice(0, 80);
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

function hasAsianText(value) {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(value || ''));
}

function tcgdexLanguages(input) {
  const configured = String(process.env.TCGDEX_LANGS || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (configured.length) return configured;
  const guess = fold(`${input.languageGuess || ''} ${input.language || ''} ${input.languageCode || ''}`);
  const text = `${input.name || ''} ${input.originalName || ''} ${input.cardmarketName || ''} ${input.visibleTitle || ''}`;
  if (String(input.languageCode || '') === '7' || guess.includes('japan')) return ['ja'];
  if (String(input.languageCode || '') === '8' || guess.includes('korea')) return ['ko'];
  if (guess.includes('chinese') || guess.includes('china') || guess.includes('cn') || guess.includes('zh')) return ['zh-tw', 'zh-cn', 'cn'];
  if (hasAsianText(text)) return ['ja', 'zh-tw', 'zh-cn', 'ko', 'cn'];
  return ['ja', 'zh-tw', 'zh-cn', 'ko'];
}

function comparableNumber(value) {
  return String(value || '')
    .toUpperCase()
    .split('/')[0]
    .replace(/^0+(?=\d)/, '')
    .replace(/\s+/g, '')
    .trim();
}

async function fetchTcgdexList(lang) {
  const cacheMs = Math.max(60000, Number(process.env.TCGDEX_CACHE_MS || 6 * 60 * 60 * 1000));
  const cached = tcgdexCache.get(lang);
  if (cached && Date.now() - cached.createdAt < cacheMs) return cached.cards;
  const url = `https://api.tcgdex.net/v2/${encodeURIComponent(lang)}/cards`;
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TCG-Scanner' } });
  if (!response.ok) throw new Error(`TCGdex ${lang} nicht erreichbar`);
  const cards = await response.json();
  if (!Array.isArray(cards)) throw new Error(`TCGdex ${lang} lieferte keine Kartenliste`);
  tcgdexCache.set(lang, { createdAt: Date.now(), cards });
  return cards;
}

function scoreTcgdexCard(card, input, lang) {
  const names = buildNameVariants(input).map(fold).filter(Boolean);
  const rawName = fold(input.name || input.originalName || input.cardmarketName || input.englishName || input.visibleTitle || '');
  if (rawName && !names.includes(rawName)) names.push(rawName);
  const cardName = fold(card.name || '');
  const number = comparableNumber(input.number || input.fullNumber || input.searchNumber);
  const localId = comparableNumber(card.localId || card.number || '');
  const setCode = fold(input.setCode || '');
  const setName = fold(input.setName || '');
  const cardSet = fold(card.setCode || card.set?.id || card.set?.name || String(card.id || '').split('-')[0]);
  let score = 0;

  if (cardName && names.some((name) => name && cardName === name)) score += 55;
  else if (cardName && names.some((name) => name && (cardName.includes(name) || name.includes(cardName)))) score += 32;
  if (number && localId && number === localId) score += 38;
  if (setCode && cardSet && (cardSet === setCode || cardSet.includes(setCode) || setCode.includes(cardSet))) score += 24;
  if (setName && cardSet && (cardSet.includes(setName) || setName.includes(cardSet))) score += 12;
  if (lang === 'ja' || lang === 'ko' || lang.startsWith('zh') || lang === 'cn') score += 8;
  if (!names.length && number && localId === number) score += 24;
  return score;
}

function tcgdexPublicCard(card, lang, score) {
  const setCode = card.setCode || card.set?.id || String(card.id || '').split('-')[0] || '';
  const setName = card.setName || card.set?.name || setCode;
  const image = card.image ? `${card.image}/high.webp` : '';
  return {
    id: `tcgdex-${lang}-${card.id}`,
    sourceId: card.id || '',
    name: card.name || '',
    cardmarketName: String(card.name || '')
      .replace(/\s+ex$/i, '-ex')
      .replace(/\s+EX$/i, '-EX')
      .replace(/\s+V$/i, '-V')
      .replace(/\s+GX$/i, '-GX'),
    number: card.localId || card.number || '',
    setCode,
    setName: String(setName || '').replace(/\s+/g, '-'),
    cardmarketSetName: '',
    rarity: card.rarity || '',
    imageSmall: image,
    imageLarge: image,
    score,
    source: `tcgdex-${lang}`
  };
}

async function fetchTcgdexCandidates(input, limit = 12) {
  const seen = new Set();
  const candidates = [];
  for (const lang of tcgdexLanguages(input)) {
    let cards = [];
    try {
      cards = await fetchTcgdexList(lang);
    } catch {
      continue;
    }
    for (const card of cards) {
      const score = scoreTcgdexCard(card, input, lang);
      if (score < 40) continue;
      const key = `${lang}:${card.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(tcgdexPublicCard(card, lang, score));
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

function publicCard(card) {
  return {
    id: card.id,
    sourceId: card.sourceId || card.source_id || '',
    name: card.name || '',
    cardmarketName: String(card.cardmarketName || card.name || '')
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

function catalogAttempts(input) {
  const names = buildNameVariants(input);
  const rawName = input.name || input.originalName || input.cardmarketName || input.englishName || input.visibleTitle || '';
  const baseAttempts = names.length ? names : [rawName];
  const attempts = [];
  for (const name of baseAttempts) {
    attempts.push({ ...input, name, originalName: name, cardmarketName: name });
    attempts.push({ ...input, name, originalName: name, cardmarketName: name, setCode: '' });
    attempts.push({ ...input, name, originalName: name, cardmarketName: name, setCode: '', number: input.number || input.fullNumber || input.searchNumber || '' });
    attempts.push({ ...input, name, originalName: name, cardmarketName: name, setCode: '', setName: '', number: '', fullNumber: '', searchNumber: '' });
  }
  return attempts;
}

async function flexibleCatalogSearch(sql, input, limit = 12) {
  const seen = new Set();
  const merged = [];
  const addRows = (rows) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
  };

  addRows(await findLearnedAliasCards(sql, input, limit));

  for (const attempt of catalogAttempts(input)) {
    const rows = await searchCatalog(sql, attempt, limit);
    addRows(rows);
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
    const hasQuery = input.name || input.originalName || input.cardmarketName || input.englishName || input.visibleTitle || input.number || input.fullNumber || input.searchNumber || input.setCode || input.setName;
    if (!hasQuery) return res.status(400).json({ ok: false, error: 'Kein Suchbegriff vorhanden.' });

    const setCodes = await resolveSetCodes(sql, input);
    let cards = await flexibleCatalogSearch(sql, input, 12);
    let hydrated = false;
    let tcgdexHydrated = false;

    if (cards.length < 3 || Number(cards[0]?.score || 0) < 70) {
      const externalCards = await fetchPokemonCandidates(input, setCodes);
      for (const card of externalCards) await upsertPokemonCard(sql, card);
      hydrated = externalCards.length > 0;
      cards = await flexibleCatalogSearch(sql, input, 12);
    }

    let resultCards = cards.map(publicCard);
    if (resultCards.length < 3 || Number(resultCards[0]?.score || 0) < 70 || hasAsianText(`${input.name || ''} ${input.originalName || ''} ${input.visibleTitle || ''}`)) {
      const tcgdexCards = await fetchTcgdexCandidates(input, 12);
      tcgdexHydrated = tcgdexCards.length > 0;
      const seen = new Set(resultCards.map((card) => `${card.source}:${card.sourceId || card.id}`));
      for (const card of tcgdexCards) {
        const key = `${card.source}:${card.sourceId || card.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        resultCards.push(card);
      }
      resultCards = resultCards.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    }

    const source = tcgdexHydrated
      ? (hydrated ? 'catalog+pokemon-tcg-api+tcgdex' : 'catalog+tcgdex')
      : (hydrated ? 'catalog+pokemon-tcg-api' : 'catalog');
    return res.status(200).json({ ok: true, source, setCodes, cards: resultCards.slice(0, 12) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Katalogsuche fehlgeschlagen.' });
  }
}
