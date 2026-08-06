import type { Candidate, CardRecord, ScanHistoryEntry, ScanResponse, UserInfo } from '../types';

interface ApiEnvelope { ok: boolean; error?: string }

async function request<T extends ApiEnvelope>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'Ungültige Serverantwort.' })) as T;
  if (!response.ok || !data.ok) throw new Error(data.error || `Request fehlgeschlagen (${response.status}).`);
  return data;
}

export const api = {
  scan: (image: string, extraText = '') => request<ScanResponse>('/api/scan', {
    method: 'POST', body: JSON.stringify({ mode: 'single', image, extraText }),
  }),
  candidates: (card: CardRecord) => request<ApiEnvelope & { cards: Candidate[] }>('/api/card-search', {
    method: 'POST', body: JSON.stringify({
      name: card.englishName || card.originalName || card.cardmarketName || '',
      originalName: card.originalName || '', cardmarketName: card.cardmarketName || '',
      number: card.fullNumber || card.searchNumber || '', setCode: card.setCode || '',
    }),
  }),
  me: () => request<ApiEnvelope & { user: UserInfo | null; setupRequired: boolean }>('/api/auth'),
  login: (username: string, password: string) => request<ApiEnvelope & { user: UserInfo }>('/api/auth', {
    method: 'POST', body: JSON.stringify({ action: 'login', username, password }),
  }),
  logout: () => request<ApiEnvelope>('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }),
  pullCollection: (cursor = '') => request<ApiEnvelope & { cards: CardRecord[]; syncCursor: string }>(
    cursor ? `/api/collection?since=${encodeURIComponent(cursor)}` : '/api/collection',
  ),
  pushCollection: (cards: CardRecord[]) => request<ApiEnvelope & { syncCursor: string; conflicts: number }>('/api/collection', {
    method: 'POST', body: JSON.stringify({ cards }),
  }),
  deleteCloudCards: (ids: string[]) => request<ApiEnvelope>('/api/collection', {
    method: 'DELETE', body: JSON.stringify({ ids }),
  }),
  history: () => request<ApiEnvelope & { scans: ScanHistoryEntry[] }>('/api/scans?limit=50'),
  clearHistory: () => request<ApiEnvelope>('/api/scans', { method: 'DELETE' }),
  pokemon: () => request<ApiEnvelope & { pokemon: Record<string, string> }>('/api/pokemon-db'),
  price: (card: CardRecord) => request<ApiEnvelope & { price?: string | number; provider?: string; fetchedAt?: string; source?: string }>('/api/prices', {
    method: 'POST', body: JSON.stringify({
      catalogId: card.catalogId || card.sourceId || '', name: card.cardmarketName || card.englishName || card.originalName,
      number: card.fullNumber || card.searchNumber, setCode: card.setCode,
    }),
  }),
};
