export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });

  try {
    const body = req.body || {};
    const rawName = String(body.name || body.originalName || body.cardmarketName || '').trim();
    const rawNumber = String(body.number || body.fullNumber || body.searchNumber || '').trim();
    const rawSetCode = String(body.setCode || '').trim();

    if (!rawName && !rawNumber && !rawSetCode) {
      return res.status(400).json({ ok: false, error: 'Kein Suchbegriff vorhanden.' });
    }

    function normalizeName(value) {
      return String(value || '')
        .replace(/-EX$/i, ' EX')
        .replace(/-GX$/i, ' GX')
        .replace(/-V$/i, ' V')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function fold(value) {
      return normalizeName(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function baseName(value) {
      return normalizeName(value)
        .replace(/\bEX\b/gi, '')
        .replace(/\bGX\b/gi, '')
        .replace(/\bVMAX\b/gi, '')
        .replace(/\bVSTAR\b/gi, '')
        .replace(/\bV\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function cleanNumber(value) {
      return String(value || '').toUpperCase().split('/')[0].replace(/\s+/g, '').trim();
    }

    function cleanSetCode(value) {
      return String(value || '').toUpperCase().replace(/\s+/g, '').trim()
        .replace(/^BK$/, 'BLK')
        .replace(/^B1K$/, 'BLK')
        .replace(/^WH$/, 'WHT')
        .replace(/^WF$/, 'WHT')
        .replace(/^SVBA$/, 'SV8A');
    }

    const name = normalizeName(rawName);
    const base = baseName(rawName);
    const nameFolded = fold(name);
    const baseFolded = fold(base);
    const number = cleanNumber(rawNumber);
    const setCode = cleanSetCode(rawSetCode);

    const queries = [];
    const addQuery = (query) => {
      if (query && !queries.includes(query)) queries.push(query);
    };

    if (base && number && setCode) addQuery(`name:${base} number:${number} set.ptcgoCode:${setCode}`);
    if (name && number) addQuery(`name:"${name}" number:${number}`);
    if (base && number) addQuery(`name:${base} number:${number}`);
    if (number && setCode) addQuery(`number:${number} set.ptcgoCode:${setCode}`);
    if (name) addQuery(`name:"${name}"`);
    if (rawName) addQuery(`name:"${rawName}"`);
    if (base) addQuery(`name:${base}`);
    if (base) addQuery(`name:"${base}"`);
    if (number) addQuery(`number:${number}`);

    const seen = new Set();
    const cards = [];
    let usedQuery = '';

    function scoreCard(card) {
      let score = 0;
      const cardName = fold(card.name);
      const cardNumber = cleanNumber(card.number);
      const cardSetCode = cleanSetCode(card.setCode);

      if (nameFolded && cardName === nameFolded) score += 90;
      else if (baseFolded && cardName.includes(baseFolded)) score += 58;
      else if (nameFolded && cardName.includes(nameFolded)) score += 46;

      if (number && cardNumber === number) score += 85;
      else if (number && cardNumber.startsWith(number)) score += 45;

      if (setCode && cardSetCode === setCode) score += 60;
      if (/ ex$/i.test(name) && /\bex\b/i.test(card.name)) score += 12;
      if (/\b(v|vmax|vstar|gx)\b/i.test(name) && fold(card.name).includes(fold(name.match(/\b(vmax|vstar|gx|v)\b/i)?.[1] || ''))) score += 8;

      return score;
    }

    for (const q of queries) {
      const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=25&orderBy=-set.releaseDate`;
      const response = await fetch(url, {
        headers: process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
      });
      const data = await response.json();
      if (!response.ok) continue;
      usedQuery = usedQuery || q;
      for (const c of (data.data || [])) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const card = {
          id: c.id,
          name: c.name || '',
          cardmarketName: (c.name || '')
            .replace(/\s+ex$/i, '-ex')
            .replace(/\s+EX$/i, '-EX')
            .replace(/\s+V$/i, '-V')
            .replace(/\s+GX$/i, '-GX'),
          number: c.number || '',
          setCode: (c.set?.ptcgoCode || c.set?.id || '').toUpperCase(),
          setName: (c.set?.name || '').replace(/\s+/g, '-'),
          series: c.set?.series || '',
          rarity: c.rarity || '',
          imageSmall: c.images?.small || '',
          imageLarge: c.images?.large || ''
        };
        cards.push({ ...card, score: scoreCard(card) });
      }
      if (cards.length >= 30) break;
    }

    cards.sort((a, b) => b.score - a.score);
    return res.status(200).json({ ok: true, query: usedQuery || queries[0] || '', cards: cards.slice(0, 5) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfehler' });
  }
}
