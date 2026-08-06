import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { mergeCards, normalizeCard, storage } from '../lib/storage';
import type { CardRecord, UserInfo, ViewId } from '../types';
import { normalizeCardModel } from '../domain/cardModel';

interface AppStateValue {
  view: ViewId;
  setView: (view: ViewId) => void;
  cards: CardRecord[];
  addCards: (cards: Partial<CardRecord>[]) => void;
  updateCard: (id: string, patch: Partial<CardRecord>) => void;
  removeCard: (id: string) => Promise<void>;
  user: UserInfo | null;
  refreshUser: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  pull: () => Promise<string>;
  push: () => Promise<string>;
  busy: boolean;
  notice: string;
  notify: (text: string) => void;
}

const AppState = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>('scanner');
  const [cards, setCards] = useState<CardRecord[]>(storage.loadCards);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => storage.loadDirtyIds(storage.loadCards()));
  const [user, setUser] = useState<UserInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const notify = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((current) => current === text ? '' : current), 2600);
  }, []);

  useEffect(() => { storage.saveCards(cards); }, [cards]);
  useEffect(() => { storage.saveDirtyIds(dirtyIds); }, [dirtyIds]);

  const refreshUser = useCallback(async () => {
    try { setUser((await api.me()).user); } catch { setUser(null); }
  }, []);
  useEffect(() => { void refreshUser(); }, [refreshUser]);

  const addCards = useCallback((incoming: Partial<CardRecord>[]) => {
    const normalized = incoming.map((card) => normalizeCard({ ...card, createdAt: card.createdAt || new Date().toISOString() }));
    setCards((current) => [...normalized, ...current]);
    setDirtyIds((current) => new Set([...current, ...normalized.map((card) => card.id)]));
  }, []);

  const updateCard = useCallback((id: string, patch: Partial<CardRecord>) => {
    const variantFields = ['cardId', 'language', 'finish', 'edition', 'treatment', 'gradingProvider', 'grade'];
    const refreshVariant = variantFields.some((key) => key in patch);
    setCards((current) => current.map((card) => card.id === id ? normalizeCardModel({
      ...card, ...patch, ...(refreshVariant ? { variantId: '' } : {}), id: card.id,
      version: card.version + 1, updatedAt: new Date().toISOString(),
    }) as CardRecord : card));
    setDirtyIds((current) => new Set(current).add(id));
  }, []);

  const removeCard = useCallback(async (id: string) => {
    setCards((current) => current.filter((card) => card.id !== id));
    setDirtyIds((current) => { const next = new Set(current); next.delete(id); return next; });
    if (user) await api.deleteCloudCards([id]);
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    setBusy(true);
    try { setUser((await api.login(username, password)).user); notify('Anmeldung erfolgreich.'); }
    finally { setBusy(false); }
  }, [notify]);

  const logout = useCallback(async () => {
    setBusy(true);
    try { await api.logout(); setUser(null); notify('Abgemeldet.'); }
    finally { setBusy(false); }
  }, [notify]);

  const pull = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api.pullCollection(storage.loadCursor());
      setCards((current) => mergeCards(current, result.cards));
      storage.saveCursor(result.syncCursor);
      return `${result.cards.length} Cloud-Änderungen verarbeitet.`;
    } finally { setBusy(false); }
  }, []);

  const push = useCallback(async () => {
    setBusy(true);
    try {
      const changed = cards.filter((card) => dirtyIds.has(card.id));
      if (!changed.length) return 'Keine lokalen Änderungen zum Hochladen.';
      const result = await api.pushCollection(changed.map(({ image: _image, ...card }) => card));
      storage.saveCursor(result.syncCursor);
      setDirtyIds((current) => { const next = new Set(current); changed.forEach((card) => next.delete(card.id)); return next; });
      return result.conflicts ? `Sync abgeschlossen, ${result.conflicts} Konflikte beibehalten.` : 'Cloud-Sync abgeschlossen.';
    } finally { setBusy(false); }
  }, [cards, dirtyIds]);

  const value = useMemo<AppStateValue>(() => ({
    view, setView, cards, addCards, updateCard, removeCard, user, refreshUser, login, logout,
    pull, push, busy, notice, notify,
  }), [view, cards, addCards, updateCard, removeCard, user, refreshUser, login, logout, pull, push, busy, notice, notify]);

  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}

export function useAppState(): AppStateValue {
  const state = useContext(AppState);
  if (!state) throw new Error('useAppState muss innerhalb AppStateProvider verwendet werden.');
  return state;
}
