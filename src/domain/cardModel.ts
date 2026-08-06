import type { CardRecord, CardCondition, CardEdition, CardFinish } from '../types';

const legacyTreatments: Record<string, string> = { V1: 'standard_special', V2: 'illustration_rare', V3: 'special_illustration_rare', V4: 'secret_rare' };
const finishes = new Set<CardFinish>(['normal', 'holo', 'reverse_holo', 'other']);
const editions = new Set<CardEdition>(['unlimited', 'first_edition', 'promo', 'other']);
const conditions = new Set<CardCondition>(['near_mint', 'excellent', 'good', 'played', 'poor', 'ungraded']);
const clean = (value: unknown, max = 160) => String(value || '').trim().slice(0, max);
const enumValue = <T extends string>(value: unknown, allowed: Set<T>, fallback: T): T => { const normalized = clean(value, 40).toLowerCase().replace(/[\s-]+/g, '_') as T; return allowed.has(normalized) ? normalized : fallback; };
const money = (value: unknown) => { const parsed = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null; };

export function legacyTreatment(value?: string): string { return legacyTreatments[clean(value, 8).toUpperCase()] || ''; }

export function createVariantId(card: Partial<CardRecord>): string {
  return [card.cardId || card.catalogId || card.sourceId || 'unconfirmed', card.language || card.languageCode || 'unknown', card.finish || 'normal', card.edition || 'unlimited', card.treatment || legacyTreatment(card.cardVersion) || 'standard', card.gradingProvider || 'raw', card.grade || 'ungraded']
    .map((part) => clean(part).toLowerCase()).join(':').replace(/[^a-z0-9:_-]/g, '_');
}

export function normalizeCardModel(card: Partial<CardRecord>): Partial<CardRecord> {
  const finish = enumValue(card.finish, finishes, 'normal');
  const edition = enumValue(card.edition, editions, card.promo ? 'promo' : 'unlimited');
  const condition = enumValue(card.condition, conditions, 'ungraded');
  const normalized: Partial<CardRecord> = {
    ...card, modelVersion: 2, tcg: clean(card.tcg || 'pokemon', 40).toLowerCase(),
    cardId: clean(card.cardId || card.catalogId || card.sourceId, 180),
    language: clean(card.language || card.languageGuess || card.languageCode || 'unknown', 40).toLowerCase(),
    finish, edition, treatment: clean(card.treatment || legacyTreatment(card.cardVersion) || 'standard', 60).toLowerCase().replace(/[\s-]+/g, '_'),
    promo: edition === 'promo', firstEdition: edition === 'first_edition', condition,
    gradingProvider: clean(card.gradingProvider, 40), grade: clean(card.grade, 20), gradingCert: clean(card.gradingCert, 80),
    quantity: Math.max(1, Math.min(999999, Math.trunc(Number(card.quantity) || 1))),
    purchasePrice: money(card.purchasePrice), saleValue: money(card.saleValue ?? card.price), currency: clean(card.currency || 'EUR', 3).toUpperCase(),
  };
  normalized.variantId = clean(card.variantId, 240) || createVariantId(normalized);
  return normalized;
}
