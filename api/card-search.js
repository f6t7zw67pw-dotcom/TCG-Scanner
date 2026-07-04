import searchHandler from './cards/search.js';
import { enrichForeignNameInput } from './_i18n-name.js';

function text(value) {
  return String(value || '').trim();
}

function normalizeCardmarketName(value) {
  return text(value)
    .replace(/\s+ex$/i, '-ex')
    .replace(/\s+EX$/i, '-EX')
    .replace(/\s+V$/i, '-V')
    .replace(/\s+GX$/i, '-GX');
}

function fastCandidate(input) {
  const number = text(input.fullNumber || input.number || input.searchNumber);
  const setCode = text(input.setCode);
  const setName = text(input.cardmarketSetName || input.setName);
  const cardmarketName = normalizeCardmarketName(input.cardmarketName || input.englishName || input.name);
  const visibleName = text(input.originalName || input.visibleTitle || input.name || cardmarketName);
  if (!cardmarketName && !visibleName) return null;
  if (!number && !setCode && !setName) return null;

  return {
    id: `fast-scan-${Date.now()}`,
    sourceId: input.i18nSourceId || '',
    name: visibleName || cardmarketName,
    cardmarketName: cardmarketName || visibleName,
    number,
    setCode,
    setName,
    cardmarketSetName: setName,
    rarity: text(input.rarity || input.cardType),
    imageSmall: text(input.imageSmall || input.image),
    imageLarge: text(input.imageLarge || input.image),
    score: input.englishName || input.cardmarketName ? 82 : 58,
    source: input.i18nSource || 'fast-scan'
  };
}

export default async function handler(req, res) {
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    if (req.body.fast === true || req.body.fast === 'true') {
      res.setHeader('Cache-Control', 'no-store');
      const card = fastCandidate(req.body);
      return res.status(200).json({ ok: true, source: 'fast-scan', setCodes: req.body.setCode ? [req.body.setCode] : [], cards: card ? [card] : [] });
    }
    req.body = await enrichForeignNameInput(req.body);
  }
  return searchHandler(req, res);
}
