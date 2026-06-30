const DEFAULT_TTL_SECONDS = 60 * 60;
const DEFAULT_TIMEOUT_MS = 6500;

const priceCache = globalThis.__cwPriceCache || new Map();
globalThis.__cwPriceCache = priceCache;

export function normalizeCardInput(value = {}) {
  const number = String(value.number || value.fullNumber || value.searchNumber || '').trim().slice(0, 40);
  const name = String(value.name || value.originalName || value.cardmarketName || '').trim().slice(0, 140);
  const setCode = String(value.setCode || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 30)
    .replace(/^BK$/, 'BLK')
    .replace(/^B1K$/, 'BLK')
    .replace(/^WH$/, 'WHT')
    .replace(/^WF$/, 'WHT')
    .replace(/^SVBA$/, 'SV8A');
  const setName = String(value.setName || '').trim().slice(0, 160);
  const condition = String(value.condition || '').trim().slice(0, 40);
  const language = String(value.language || value.languageLabel || '').trim().slice(0, 40);
  const cardmarketUrl = String(value.cardmarketUrl || '').trim().slice(0, 500);

  return { name, number, setCode, setName, condition, language, cardmarketUrl };
}

export function validatePriceInput(input) {
  if (!input.name && !input.number && !input.setCode) {
    return 'Name, Kartennummer oder SetCode fehlt.';
  }
  if (input.name && input.name.length < 2) return 'Name ist zu kurz.';
  return '';
}

export function cacheKey(provider, input) {
  return [provider, input.name, input.number, input.setCode, input.condition, input.language]
    .map((part) => String(part || '').toLowerCase().trim())
    .join('|');
}

export function getCached(key) {
  const hit = priceCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    priceCache.delete(key);
    return null;
  }
  return hit.value;
}

export function setCached(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  priceCache.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
}

export function cleanNumber(value) {
  const raw = String(value || '').toUpperCase().split('/')[0].replace(/\s+/g, '').trim();
  if (!/^\d+$/.test(raw)) return raw;
  const stripped = raw.replace(/^0+(?=\d)/, '') || '0';
  return stripped.length <= 2 ? stripped.padStart(3, '0') : stripped;
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

function fold(value) {
  return normalizeName(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function quote(value) {
  return `"${String(value || '').replace(/"/g, '').trim()}"`;
}

function buildPokemonQueries(input) {
  const name = normalizeName(input.name);
  const number = cleanNumber(input.number);
  const setCode = input.setCode;
  const queries = [];
  const add = (query) => { if (query && !queries.includes(query)) queries.push(query); };

  if (name && number && setCode) add(`name:${quote(name)} number:${number} set.ptcgoCode:${setCode}`);
  if (name && number) add(`name:${quote(name)} number:${number}`);
  if (number && setCode) add(`number:${number} set.ptcgoCode:${setCode}`);
  if (name && setCode) add(`name:${quote(name)} set.ptcgoCode:${setCode}`);
  if (name) add(`name:${quote(name)}`);
  if (number) add(`number:${number}`);
  if (setCode) add(`set.ptcgoCode:${setCode}`);
  return queries;
}

function scorePokemonCard(input, card) {
  let score = 0;
  const cardName = fold(card.name);
  const inputName = fold(input.name);
  const cardNumber = cleanNumber(card.number);
  const inputNumber = cleanNumber(input.number);
  const cardSetCode = String(card.set?.ptcgoCode || card.set?.id || '').toUpperCase();

  if (inputName && cardName === inputName) score += 90;
  else if (inputName && cardName.includes(inputName)) score += 45;
  if (inputNumber && cardNumber === inputNumber) score += 80;
  if (input.setCode && cardSetCode === input.setCode) score += 60;
  return score;
}

function pickBestPrice(prices = {}) {
  const candidates = [
    ['averageSellPrice', prices.averageSellPrice],
    ['trendPrice', prices.trendPrice],
    ['avg7', prices.avg7],
    ['avg30', prices.avg30],
    ['avg1', prices.avg1],
    ['lowPrice', prices.lowPrice]
  ];
  for (const [field, raw] of candidates) {
    const amount = Number(raw);
    if (Number.isFinite(amount) && amount > 0) return { amount, field };
  }
  return null;
}

export async function fetchJsonWithTimeout(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || process.env.PRICE_FETCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetchImpl || fetch)(url, { ...(options.fetchOptions || {}), signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

export class PokemonTcgPriceProvider {
  constructor(options = {}) {
    this.name = 'pokemon-tcg-cardmarket';
    this.fetchImpl = options.fetchImpl;
    this.timeoutMs = options.timeoutMs;
    this.apiKey = options.apiKey || process.env.POKEMON_TCG_API_KEY || '';
  }

  async getPrice(input) {
    const queries = buildPokemonQueries(input);
    const cards = [];
    const seen = new Set();

    for (const query of queries) {
      const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=12&orderBy=-set.releaseDate`;
      const headers = this.apiKey ? { 'X-Api-Key': this.apiKey } : {};
      const { response, data } = await fetchJsonWithTimeout(url, {
        fetchImpl: this.fetchImpl,
        timeoutMs: this.timeoutMs,
        fetchOptions: { headers }
      });
      if (!response.ok) continue;
      for (const card of data.data || []) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        cards.push({ card, score: scorePokemonCard(input, card) });
      }
      if (cards.length) break;
    }

    cards.sort((a, b) => b.score - a.score);
    const match = cards.find((entry) => entry.card?.cardmarket?.prices) || cards[0];
    if (!match) return { ok: true, price: null, message: 'Aktuell kein Preis verfuegbar.' };

    const best = pickBestPrice(match.card.cardmarket?.prices || {});
    if (!best) return { ok: true, price: null, message: 'Aktuell kein Preis verfuegbar.' };

    return {
      ok: true,
      price: {
        cardName: match.card.name || input.name,
        set: match.card.set?.name || input.setName || '',
        setCode: String(match.card.set?.ptcgoCode || match.card.set?.id || input.setCode || '').toUpperCase(),
        number: match.card.number || input.number,
        amount: Number(best.amount.toFixed(2)),
        currency: 'EUR',
        condition: input.condition || '',
        language: input.language || '',
        source: 'Pokemon TCG API Cardmarket-Daten',
        sourceField: best.field,
        fetchedAt: new Date().toISOString(),
        url: input.cardmarketUrl || match.card.cardmarket?.url || ''
      }
    };
  }
}

export class CardmarketProvider {
  constructor() {
    this.name = 'cardmarket';
  }

  configured() {
    return Boolean(process.env.CARDMARKET_API_KEY && process.env.CARDMARKET_API_SECRET && process.env.CARDMARKET_API_TOKEN);
  }

  async getPrice() {
    if (!this.configured()) {
      return { ok: false, notConfigured: true, message: 'Preisabfrage ist noch nicht eingerichtet.' };
    }
    return {
      ok: false,
      notConfigured: true,
      message: 'Direkte Cardmarket-API ist noch nicht aktiviert. Nutze eine offiziell freigegebene Integration mit Backend-Credentials.'
    };
  }
}

export async function getCardPrice(input, options = {}) {
  const normalized = normalizeCardInput(input);
  const validationError = validatePriceInput(normalized);
  if (validationError) return { ok: false, status: 400, error: validationError };

  const ttl = Number(process.env.PRICE_CACHE_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  const key = cacheKey('pokemon-tcg-cardmarket', normalized);
  const cached = getCached(key);
  if (cached) return { ...cached, cached: true };

  const provider = options.provider || new PokemonTcgPriceProvider(options);
  const result = await provider.getPrice(normalized);
  if (result.ok) setCached(key, result, ttl);
  return { ...result, cached: false };
}
