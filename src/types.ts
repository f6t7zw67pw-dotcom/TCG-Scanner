export type ViewId = 'scanner' | 'collection' | 'account' | 'history' | 'database' | 'help';
export type ScanMode = 'single' | 'multi';
export type CardFinish = 'normal' | 'holo' | 'reverse_holo' | 'other';
export type CardEdition = 'unlimited' | 'first_edition' | 'promo' | 'other';
export type CardCondition = 'near_mint' | 'excellent' | 'good' | 'played' | 'poor' | 'ungraded';

export interface CardRecord {
  id: string;
  version: number;
  updatedAt: string;
  createdAt?: string;
  deleted?: boolean;
  originalName?: string;
  englishName?: string;
  cardmarketName?: string;
  fullNumber?: string;
  searchNumber?: string;
  setCode?: string;
  setName?: string;
  languageGuess?: string;
  languageCode?: string;
  cardType?: string;
  cardVersion?: string;
  condition?: string;
  confidence?: number;
  warnings?: string[];
  image?: string;
  imageSmall?: string;
  imageLarge?: string;
  cardmarketUrl?: string;
  catalogId?: string;
  sourceId?: string;
  selected?: boolean;
  scanError?: string;
  price?: string;
  priceSource?: string;
  priceFetchedAt?: string;
  multiLot?: boolean;
  lotName?: string;
  quantity?: number;
  modelVersion?: 2;
  tcg?: string;
  cardId?: string;
  variantId?: string;
  language?: string;
  finish?: CardFinish;
  edition?: CardEdition;
  treatment?: string;
  promo?: boolean;
  firstEdition?: boolean;
  gradingProvider?: string;
  grade?: string;
  gradingCert?: string;
  purchasePrice?: number | null;
  saleValue?: number | null;
  currency?: string;
}

export interface ScanResponse {
  ok: boolean;
  error?: string;
  model?: string;
  scanId?: string;
  cards?: CardRecord[];
}

export interface Candidate extends CardRecord {
  name?: string;
  number?: string;
  rarity?: string;
  score?: number;
  source?: string;
}

export interface UserInfo {
  id: string;
  username: string;
  displayName?: string;
}

export interface ScanHistoryEntry {
  id: string;
  mode: ScanMode;
  status: string;
  confidence: number | null;
  createdAt: string;
  card: { name: string; number: string; setCode: string; setName: string; warnings: string[] };
}
