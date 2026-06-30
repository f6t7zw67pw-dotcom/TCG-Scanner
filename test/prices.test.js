import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanNumber,
  getCardPrice,
  normalizeCardInput,
  PokemonTcgPriceProvider,
  validatePriceInput
} from '../api/price-providers.js';

test('normalizes and validates price input', () => {
  const input = normalizeCardInput({ originalName: ' Pikachu ', fullNumber: '25/102', setCode: ' base ' });
  assert.equal(input.name, 'Pikachu');
  assert.equal(input.number, '25/102');
  assert.equal(input.setCode, 'BASE');
  assert.equal(validatePriceInput(input), '');
  assert.equal(validatePriceInput(normalizeCardInput({})), 'Name, Kartennummer oder SetCode fehlt.');
});

test('cleans short card numbers for provider search', () => {
  assert.equal(cleanNumber('7/102'), '007');
  assert.equal(cleanNumber('025/102'), '025');
  assert.equal(cleanNumber('TG12'), 'TG12');
});

test('pokemon provider returns a normalized price result', async () => {
  const provider = new PokemonTcgPriceProvider({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          data: [{
            id: 'base1-58',
            name: 'Pikachu',
            number: '58',
            set: { name: 'Base Set', ptcgoCode: 'BS' },
            cardmarket: {
              url: 'https://example.test/pikachu',
              prices: { averageSellPrice: 4.2, trendPrice: 3.9 }
            }
          }]
        };
      }
    })
  });
  const result = await provider.getPrice(normalizeCardInput({ name: 'Pikachu', number: '58', setCode: 'BS' }));
  assert.equal(result.ok, true);
  assert.equal(result.price.amount, 4.2);
  assert.equal(result.price.currency, 'EUR');
  assert.equal(result.price.sourceField, 'averageSellPrice');
});

test('getCardPrice rejects empty requests before provider call', async () => {
  const result = await getCardPrice({}, { provider: { async getPrice() { throw new Error('should not run'); } } });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});
