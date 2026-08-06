import { randomUUID } from 'node:crypto';

export const MAX_CARDS = 5000;
export const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

export function payloadBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); } catch { return Infinity; }
}

export function validCard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.id !== undefined && String(value.id).length > 128) return false;
  return true;
}

export function normalizeTimestamp(value, fallback = new Date().toISOString()) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

export function normalizeSyncCard(card, now = new Date().toISOString()) {
  const next = { ...(card || {}) };
  if (typeof next.image === 'string' && next.image.startsWith('data:image/')) delete next.image;
  if (typeof next.cropImage === 'string' && next.cropImage.startsWith('data:image/')) delete next.cropImage;
  next.id = String(next.id || randomUUID()).slice(0, 128);
  next.version = Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(Number(next.version) || 1)));
  next.updatedAt = normalizeTimestamp(next.updatedAt || next.createdAt, now);
  return next;
}

export function normalizeSyncCards(cards, now = new Date().toISOString()) {
  const seen = new Set();
  return (cards || []).map((card) => {
    let normalized = normalizeSyncCard(card, now);
    if (seen.has(normalized.id)) normalized = normalizeSyncCard({ ...normalized, id: undefined }, now);
    seen.add(normalized.id);
    return normalized;
  });
}

export function isIncomingNewer(incoming, existing) {
  if (!existing) return true;
  const incomingVersion = Math.max(1, Number(incoming?.version) || 1);
  const existingVersion = Math.max(1, Number(existing?.version) || 1);
  if (incomingVersion !== existingVersion) return incomingVersion > existingVersion;
  return Date.parse(incoming?.updatedAt || 0) > Date.parse(existing?.updatedAt || 0);
}

export function mergeCollectionChanges(localCards, cloudCards) {
  const byId = new Map((localCards || []).map((card) => [String(card.id), card]));
  for (const card of cloudCards || []) {
    const id = String(card?.id || '');
    if (!id) continue;
    if (card.deleted === true) {
      byId.delete(id);
      continue;
    }
    if (isIncomingNewer(card, byId.get(id))) byId.set(id, card);
  }
  return Array.from(byId.values());
}
