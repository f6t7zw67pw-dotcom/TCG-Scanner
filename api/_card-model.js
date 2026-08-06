const FINISHES = new Set(['normal', 'holo', 'reverse_holo', 'other']);
const EDITIONS = new Set(['unlimited', 'first_edition', 'promo', 'other']);
const CONDITIONS = new Set(['near_mint', 'excellent', 'good', 'played', 'poor', 'ungraded']);
const LEGACY_TREATMENTS = { V1: 'standard_special', V2: 'illustration_rare', V3: 'special_illustration_rare', V4: 'secret_rare' };

function text(value, max = 160) { return String(value || '').trim().slice(0, max); }
function enumValue(value, allowed, fallback) { const normalized = text(value, 40).toLowerCase().replace(/[\s-]+/g, '_'); return allowed.has(normalized) ? normalized : fallback; }
function money(value) { const number = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(2)) : null; }
function quantity(value) { return Math.max(1, Math.min(999999, Math.trunc(Number(value) || 1))); }

export function legacyTreatment(value) { return LEGACY_TREATMENTS[text(value, 8).toUpperCase()] || ''; }

export function variantKey(card = {}) {
  const grading = text(card.gradingProvider, 40).toLowerCase() || 'raw';
  const grade = text(card.grade, 20).toLowerCase() || 'ungraded';
  return [
    text(card.cardId || card.catalogId || card.sourceId || 'unconfirmed', 180),
    text(card.language || card.languageCode || 'unknown', 20).toLowerCase(),
    enumValue(card.finish, FINISHES, 'normal'),
    enumValue(card.edition, EDITIONS, card.promo ? 'promo' : 'unlimited'),
    text(card.treatment || legacyTreatment(card.cardVersion) || 'standard', 60).toLowerCase(),
    grading,
    grade
  ].join(':').toLowerCase().replace(/[^a-z0-9:_-]/g, '_');
}

export function normalizeCollectionCard(card = {}) {
  const finish = enumValue(card.finish, FINISHES, 'normal');
  const edition = enumValue(card.edition, EDITIONS, card.promo ? 'promo' : 'unlimited');
  const condition = enumValue(card.condition, CONDITIONS, 'ungraded');
  const treatment = text(card.treatment || legacyTreatment(card.cardVersion) || 'standard', 60).toLowerCase().replace(/[\s-]+/g, '_');
  const normalized = {
    ...card,
    modelVersion: 2,
    tcg: text(card.tcg || card.game || 'pokemon', 40).toLowerCase(),
    cardId: text(card.cardId || card.catalogId || card.sourceId, 180),
    language: text(card.language || card.languageGuess || card.languageCode || 'unknown', 40).toLowerCase(),
    finish,
    edition,
    treatment,
    promo: edition === 'promo',
    firstEdition: edition === 'first_edition',
    condition,
    gradingProvider: text(card.gradingProvider, 40),
    grade: text(card.grade, 20),
    gradingCert: text(card.gradingCert, 80),
    quantity: quantity(card.quantity),
    purchasePrice: money(card.purchasePrice),
    saleValue: money(card.saleValue ?? card.price),
    currency: text(card.currency || 'EUR', 3).toUpperCase()
  };
  normalized.variantId = text(card.variantId, 240) || variantKey(normalized);
  return normalized;
}

export const cardModelValues = {
  finishes: [...FINISHES], editions: [...EDITIONS], conditions: [...CONDITIONS]
};
