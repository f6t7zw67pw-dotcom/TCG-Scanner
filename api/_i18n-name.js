import { canonicalSetSlugFor, expandedSetCodeVariants } from './_set-aliases.js';
import { lookupPokemonNameAlias } from './_pokemon-name-aliases.js';

const tcgdexListCache = globalThis.__cwI18nTcgdexListCache || new Map();
globalThis.__cwI18nTcgdexListCache = tcgdexListCache;
const tcgdexDetailCache = globalThis.__cwI18nTcgdexDetailCache || new Map();
globalThis.__cwI18nTcgdexDetailCache = tcgdexDetailCache;
const speciesNameCache = globalThis.__cwI18nSpeciesNameCache || new Map();
globalThis.__cwI18nSpeciesNameCache = speciesNameCache;

const STATIC_FOREIGN_NAME_ALIASES = {
  'ママンボウ': 'Alomomola',
  'イベルタル': 'Yveltal',
  '伊裳尔塔尔': 'Yveltal',
  '伊裴爾塔爾': 'Yveltal',
  'レパルダス': 'Liepard',
  'イシズマイ': 'Dwebble',
  'サンダース': 'Jolteon',
  'ブースター': 'Flareon',
  'シャワーズ': 'Vaporeon',
  'エーフィ': 'Espeon',
  'ブラッキー': 'Umbreon',
  'リーフィア': 'Leafeon',
  'グレイシア': 'Glaceon',
  'ニンフィア': 'Sylveon',
  'ピカチュウ': 'Pikachu',
  'リザードン': 'Charizard',
  'フシギバナ': 'Venusaur',
  'カメックス': 'Blastoise',
  'ミュウ': 'Mew',
  'ミュウツー': 'Mewtwo',
  'ゲンガー': 'Gengar',
  'ルカリオ': 'Lucario',
  'レックウザ': 'Rayquaza',
  'ギラティナ': 'Giratina',
  'アルセウス': 'Arceus',
  'リザードンex': 'Charizard-ex',
  'ピカチュウex': 'Pikachu-ex',
  '焰白酋雷姆': 'White Kyurem',
  '皮卡丘': 'Pikachu',
  '喷火龙': 'Charizard',
  '噴火龍': 'Charizard',
  '妙蛙花': 'Venusaur',
  '水箭龟': 'Blastoise',
  '水箭龜': 'Blastoise',
  '梦幻': 'Mew',
  '夢幻': 'Mew',
  '超梦': 'Mewtwo',
  '超夢': 'Mewtwo',
  '耿鬼': 'Gengar',
  '路卡利欧': 'Lucario',
  '路卡利歐': 'Lucario',
  '烈空坐': 'Rayquaza',
  '骑拉帝纳': 'Giratina',
  '騎拉帝納': 'Giratina',
  '阿尔宙斯': 'Arceus',
  '阿爾宙斯': 'Arceus'
};

function text(value) {
  return String(value || '').trim();
}

function fold(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasAsianText(value) {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(value || ''));
}

function looksLatinName(value) {
  const clean = text(value);
  return !!clean && !hasAsianText(clean) && /^[A-Za-z0-9 .:'’&+\-]+$/.test(clean);
}

function toCardmarketName(value) {
  return text(value)
    .replace(/\s+ex$/i, '-ex')
    .replace(/\s+EX$/i, '-EX')
    .replace(/\s+V$/i, '-V')
    .replace(/\s+GX$/i, '-GX');
}

function comparableNumber(value) {
  return text(value)
    .toUpperCase()
    .split('/')[0]
    .replace(/^0+(?=\d)/, '')
    .replace(/\s+/g, '');
}

function inputNames(input) {
  return [input.name, input.originalName, input.cardmarketName, input.englishName, input.visibleTitle]
    .map(text)
    .filter(Boolean);
}

function staticAlias(input) {
  for (const name of inputNames(input)) {
    if (STATIC_FOREIGN_NAME_ALIASES[name]) return STATIC_FOREIGN_NAME_ALIASES[name];
  }
  return '';
}

async function databaseAlias(input) {
  for (const name of inputNames(input)) {
    const row = await lookupPokemonNameAlias(name).catch(() => null);
    if (row?.englishName) return row;
  }
  return null;
}

function languageCandidates(input) {
  const guess = fold(`${input.languageGuess || ''} ${input.language || ''} ${input.languageCode || ''}`);
  const raw = inputNames(input).join(' ');
  if (String(input.languageCode || '') === '7' || guess.includes('japan')) return ['ja'];
  if (guess.includes('chinese') || guess.includes('china') || guess.includes('zh') || guess.includes('cn')) return ['zh-tw', 'zh-cn', 'cn'];
  if (hasAsianText(raw)) return ['ja', 'zh-tw', 'zh-cn', 'cn', 'ko'];
  return [];
}

async function fetchJson(url, cache, key, cacheMs = 6 * 60 * 60 * 1000) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.createdAt < cacheMs) return cached.value;
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TCG-Scanner' } });
  if (!response.ok) return null;
  const value = await response.json().catch(() => null);
  if (value) cache.set(key, { createdAt: Date.now(), value });
  return value;
}

async function fetchTcgdexList(lang) {
  const cards = await fetchJson(`https://api.tcgdex.net/v2/${encodeURIComponent(lang)}/cards`, tcgdexListCache, lang);
  return Array.isArray(cards) ? cards : [];
}

async function fetchTcgdexDetail(lang, id) {
  if (!id) return null;
  return fetchJson(`https://api.tcgdex.net/v2/${encodeURIComponent(lang)}/cards/${encodeURIComponent(id)}`, tcgdexDetailCache, `${lang}:${id}`);
}

async function englishSpeciesName(dexId) {
  const id = Array.isArray(dexId) ? dexId[0] : dexId;
  if (!id) return '';
  const key = String(id);
  const cached = speciesNameCache.get(key);
  if (cached) return cached;
  const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(key)}`, speciesNameCache, `species:${key}`, 30 * 24 * 60 * 60 * 1000);
  const raw = text((data?.names || []).find((item) => item.language?.name === 'en')?.name || data?.name || '');
  const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, ' ') : '';
  speciesNameCache.set(key, name);
  return name;
}

async function englishNameForTcgdexCard(card, lang) {
  if (!card) return '';
  if (looksLatinName(card.englishName)) return text(card.englishName);
  if (looksLatinName(card.cardmarketName)) return text(card.cardmarketName);
  if (looksLatinName(card.name)) return text(card.name);

  const englishDetail = lang === 'en' ? card : await fetchTcgdexDetail('en', card.id);
  if (looksLatinName(englishDetail?.name)) return text(englishDetail.name);
  const localDetail = card.dexId ? card : await fetchTcgdexDetail(lang, card.id);
  return englishSpeciesName(localDetail?.dexId || englishDetail?.dexId);
}

function setScore(card, input) {
  const wanted = expandedSetCodeVariants(input.setCode, input.setName, input.set, input.expansion)
    .map(fold)
    .filter(Boolean);
  if (!wanted.length) return 0;
  const actual = expandedSetCodeVariants(card.setCode, card.set?.id, card.set?.name, String(card.id || '').split('-')[0])
    .map(fold)
    .filter(Boolean);
  if (actual.some((value) => wanted.some((want) => value === want))) return 30;
  if (actual.some((value) => wanted.some((want) => value.includes(want) || want.includes(value)))) return 18;
  return 0;
}

function scoreCard(card, input) {
  const rawNames = inputNames(input).filter(hasAsianText).map(fold).filter(Boolean);
  const cardName = fold(card.name || '');
  const wantedNumber = comparableNumber(input.number || input.fullNumber || input.searchNumber);
  const actualNumber = comparableNumber(card.localId || card.number || '');
  let score = 0;

  if (rawNames.length && rawNames.some((name) => cardName === name)) score += 70;
  else if (rawNames.length && rawNames.some((name) => cardName.includes(name) || name.includes(cardName))) score += 48;

  if (wantedNumber && actualNumber && wantedNumber === actualNumber) score += 34;
  score += setScore(card, input);
  if (tcgdexImage(card)) score += 2;
  return score;
}

function tcgdexImage(card) {
  return card?.image ? `${card.image}/low.png` : '';
}

async function findForeignTranslation(input) {
  const langs = languageCandidates(input);
  if (!langs.length) return null;
  const candidates = [];

  for (const lang of langs) {
    const cards = await fetchTcgdexList(lang);
    for (const card of cards) {
      const score = scoreCard(card, input);
      if (score >= 70) candidates.push({ lang, card, score });
    }
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  const detail = await fetchTcgdexDetail(best.lang, best.card.id);
  const card = detail ? { ...best.card, ...detail } : best.card;
  const englishName = await englishNameForTcgdexCard(card, best.lang);
  if (!englishName) return null;

  const setCode = card.setCode || card.set?.id || String(card.id || '').split('-')[0] || '';
  const rawSetName = card.setName || card.set?.name || setCode;
  const setName = canonicalSetSlugFor(setCode, rawSetName, input.setCode, input.setName) || text(rawSetName).replace(/\s+/g, '-');
  return {
    englishName,
    cardmarketName: toCardmarketName(englishName),
    originalName: text(card.name || input.originalName || input.name || input.visibleTitle || ''),
    visibleTitle: text(card.name || input.visibleTitle || ''),
    number: text(card.localId || card.number || input.number || input.fullNumber || input.searchNumber || ''),
    setCode,
    setName,
    cardmarketSetName: setName,
    sourceId: card.id || '',
    source: `i18n-tcgdex-${best.lang}`,
    score: best.score
  };
}

export async function enrichForeignNameInput(input = {}) {
  const original = { ...input };
  const dbAlias = await databaseAlias(original);
  const alias = text(dbAlias?.englishName || staticAlias(original));
  const hasForeign = hasAsianText(inputNames(original).join(' '));
  if (!alias && !hasForeign) return original;

  let translated = null;
  if (!alias || hasForeign) {
    try {
      translated = await findForeignTranslation(original);
    } catch {
      translated = null;
    }
  }

  const englishName = text(translated?.englishName || alias);
  if (!englishName) return original;

  const existingLatin = looksLatinName(original.cardmarketName) ? text(original.cardmarketName) : '';
  const originalName = text(original.originalName || original.visibleTitle || (hasAsianText(original.name) ? original.name : '') || translated?.originalName || dbAlias?.alias || '');
  const cardmarketName = toCardmarketName(existingLatin || translated?.cardmarketName || englishName);

  return {
    ...original,
    name: englishName,
    originalName: originalName || original.originalName || original.name || '',
    visibleTitle: text(original.visibleTitle || translated?.visibleTitle || originalName),
    englishName,
    cardmarketName,
    number: original.number || original.fullNumber || original.searchNumber || translated?.number || '',
    fullNumber: original.fullNumber || original.number || translated?.number || '',
    searchNumber: original.searchNumber || String(original.number || translated?.number || '').split('/')[0] || '',
    setCode: original.setCode || translated?.setCode || '',
    setName: original.setName || translated?.setName || '',
    cardmarketSetName: original.cardmarketSetName || translated?.cardmarketSetName || translated?.setName || '',
    i18nSource: translated?.source || dbAlias?.source || 'i18n-static-alias',
    i18nSourceId: translated?.sourceId || (dbAlias?.pokemonId ? String(dbAlias.pokemonId) : ''),
    i18nScore: translated?.score || (dbAlias ? 95 : alias ? 80 : 0)
  };
}
