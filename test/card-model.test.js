import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { legacyTreatment, normalizeCollectionCard, variantKey } from '../api/_card-model.js';

test('legacy V1-V4 values migrate to treatment without defining finish', () => {
  assert.equal(legacyTreatment('V2'), 'illustration_rare');
  const card = normalizeCollectionCard({ id: 'legacy', cardVersion: 'V3' });
  assert.equal(card.treatment, 'special_illustration_rare');
  assert.equal(card.finish, 'normal');
  assert.equal(card.modelVersion, 2);
});

test('variants of the same card receive distinct stable keys', () => {
  const base = { cardId: 'pokemon_card_base1-4', language: 'en', edition: 'unlimited', treatment: 'standard' };
  const normal = variantKey({ ...base, finish: 'normal' });
  const holo = variantKey({ ...base, finish: 'holo' });
  const firstEdition = variantKey({ ...base, finish: 'holo', edition: 'first_edition' });
  assert.notEqual(normal, holo);
  assert.notEqual(holo, firstEdition);
  assert.equal(variantKey({ ...base, finish: 'normal' }), normal);
  assert.equal(variantKey({ ...base, cardId: 'POKEMON_CARD_BASE1-4', finish: 'normal' }), normal);
});

test('quantity and monetary fields normalize without duplicating identity', () => {
  const card = normalizeCollectionCard({ cardId: 'card-1', quantity: '3', purchasePrice: '1,25', saleValue: 4.5 });
  assert.equal(card.quantity, 3);
  assert.equal(card.purchasePrice, 1.25);
  assert.equal(card.saleValue, 4.5);
  assert.equal(card.currency, 'EUR');
});

test('grading participates in variant identity', () => {
  const raw = normalizeCollectionCard({ cardId: 'card-1', finish: 'holo' });
  const graded = normalizeCollectionCard({ cardId: 'card-1', finish: 'holo', gradingProvider: 'PSA', grade: '10' });
  assert.notEqual(raw.variantId, graded.variantId);
  assert.match(graded.variantId, /psa:10$/);
});

test('phase 4 migration is additive and contains no destructive statements', () => {
  const sql = fs.readFileSync(new URL('../migrations/002_card_variant_model.sql', import.meta.url), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS variant_id/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS cw_collection_cards_user_variant_idx/i);
  assert.match(sql, /CASE\s+WHEN COALESCE\(payload->>'quantity'/i);
  assert.match(sql, /WHERE variant_id IS NULL OR variant_id = ''/i);
  assert.doesNotMatch(sql, /\b(?:DELETE|TRUNCATE|DROP TABLE)\b/i);
});
