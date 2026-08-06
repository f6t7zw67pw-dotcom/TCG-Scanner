import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  isIncomingNewer,
  mergeCollectionChanges,
  normalizeSyncCard,
  normalizeSyncCards
} from '../api/_collection-sync.js';

test('new cards receive UUIDs and stable sync metadata', () => {
  const now = '2026-07-30T12:00:00.000Z';
  const card = normalizeSyncCard({ name: 'Pikachu', image: 'data:image/png;base64,AAAA' }, now);
  assert.match(card.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(card.version, 1);
  assert.equal(card.updatedAt, now);
  assert.equal(card.image, undefined);
  assert.deepEqual(normalizeSyncCard(card, '2026-08-01T00:00:00.000Z'), card);
});

test('legacy IDs remain usable during migration', () => {
  const card = normalizeSyncCard({ id: 1720000000000, createdAt: '2025-01-01T00:00:00Z' });
  assert.equal(card.id, '1720000000000');
  assert.equal(card.updatedAt, '2025-01-01T00:00:00.000Z');
});

test('colliding legacy IDs are split before a batch upsert', () => {
  const cards = normalizeSyncCards([{ id: 'duplicate' }, { id: 'duplicate' }], '2026-07-30T12:00:00.000Z');
  assert.equal(cards[0].id, 'duplicate');
  assert.notEqual(cards[1].id, 'duplicate');
  assert.notEqual(cards[0].id, cards[1].id);
});

test('newer versions win and stale writes are rejected', () => {
  const old = { id: 'same-id', version: 2, updatedAt: '2026-07-30T10:00:00Z', name: 'old' };
  const stale = { id: 'same-id', version: 1, updatedAt: '2026-07-30T12:00:00Z', name: 'stale' };
  const newer = { id: 'same-id', version: 3, updatedAt: '2026-07-30T09:00:00Z', name: 'new' };
  assert.equal(isIncomingNewer(stale, old), false);
  assert.equal(isIncomingNewer(newer, old), true);
  assert.equal(mergeCollectionChanges([old], [stale])[0].name, 'old');
  assert.equal(mergeCollectionChanges([old], [newer])[0].name, 'new');
});

test('incremental tombstones remove only the addressed card', () => {
  const cards = [
    { id: 'a', version: 1, updatedAt: '2026-07-30T10:00:00Z' },
    { id: 'b', version: 1, updatedAt: '2026-07-30T10:00:00Z' }
  ];
  assert.deepEqual(mergeCollectionChanges(cards, [{ id: 'a', deleted: true }]).map((card) => card.id), ['b']);
});

test('migration is tenant-safe and does not delete existing rows', async () => {
  const migration = await readFile(new URL('../migrations/001_collection_sync_v2.sql', import.meta.url), 'utf8');
  assert.match(migration, /PRIMARY KEY \(user_id, id\)/);
  assert.doesNotMatch(migration, /\b(?:DELETE|TRUNCATE)\b/i);

  const route = await readFile(new URL('../api/collection.js', import.meta.url), 'utf8');
  assert.match(route, /ON CONFLICT \(user_id, id\)/);
  assert.match(route, /jsonb_to_recordset/);
  assert.match(route, /EXCLUDED\.version > cw_collection_cards\.version/);
  assert.doesNotMatch(route, /DELETE FROM cw_collection_cards WHERE user_id/);
});
