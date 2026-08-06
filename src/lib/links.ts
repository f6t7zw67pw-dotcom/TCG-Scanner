import type { CardRecord } from '../types';

export function safeHttpUrl(value?: string): string {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function cardmarketUrl(card: CardRecord): string {
  const existing = safeHttpUrl(card.cardmarketUrl);
  if (existing) return existing;
  const name = card.cardmarketName || card.englishName || card.originalName;
  if (!name) return '';
  const query = [name, card.fullNumber || card.searchNumber, card.setName || card.setCode].filter(Boolean).join(' ');
  return `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(query)}`;
}
