import type { CardRecord } from '../types';
import { normalizeCardModel } from '../domain/cardModel';

const COLLECTION_KEY = 'cw_collection';
const CURSOR_KEY = 'cw_cloud_cursor';
const DIRTY_KEY = 'cw_cloud_dirty_ids';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

export function newId(): string {
  return crypto.randomUUID?.() || `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeCard(card: Partial<CardRecord>): CardRecord {
  const now = new Date().toISOString();
  return { ...normalizeCardModel(card), id: String(card.id || newId()), version: Math.max(1, Number(card.version) || 1), updatedAt: card.updatedAt || now } as CardRecord;
}

export const storage = {
  loadCards: (): CardRecord[] => readJson<Partial<CardRecord>[]>(COLLECTION_KEY, []).map(normalizeCard),
  saveCards: (cards: CardRecord[]) => localStorage.setItem(COLLECTION_KEY, JSON.stringify(cards)),
  loadCursor: () => localStorage.getItem(CURSOR_KEY) || '',
  saveCursor: (cursor: string) => { if (cursor) localStorage.setItem(CURSOR_KEY, cursor); },
  loadDirtyIds: (cards: CardRecord[]) => {
    const stored = readJson<string[] | null>(DIRTY_KEY, null);
    return new Set(stored === null ? cards.map((card) => card.id) : stored);
  },
  saveDirtyIds: (ids: Set<string>) => localStorage.setItem(DIRTY_KEY, JSON.stringify([...ids])),
  loadMap: (key: string) => readJson<Record<string, string>>(key, {}),
  saveMap: (key: string, value: Record<string, string>) => localStorage.setItem(key, JSON.stringify(value)),
};

export function mergeCards(local: CardRecord[], remote: CardRecord[]): CardRecord[] {
  const merged = new Map(local.map((card) => [card.id, card]));
  for (const incoming of remote.map(normalizeCard)) {
    const current = merged.get(incoming.id);
    const newer = !current || incoming.version > current.version ||
      (incoming.version === current.version && incoming.updatedAt > current.updatedAt);
    if (newer) incoming.deleted ? merged.delete(incoming.id) : merged.set(incoming.id, incoming);
  }
  return [...merged.values()].sort((a, b) => String(b.createdAt || b.updatedAt).localeCompare(String(a.createdAt || a.updatedAt)));
}
