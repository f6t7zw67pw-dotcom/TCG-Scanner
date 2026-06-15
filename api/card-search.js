export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });

  try {
    const body = req.body || {};
    const rawName = String(body.name || body.originalName || body.cardmarketName || '').trim();
    const rawNumber = String(body.number || body.fullNumber || body.searchNumber || '').trim();

    if (!rawName && !rawNumber) {
      return res.status(400).json({ ok: false, error: 'Kein Suchbegriff vorhanden.' });
    }

    function normalizeName(v) {
      return String(v || '')
        .replace(/-EX$/i, ' EX')
        .replace(/-GX$/i, ' GX')
        .replace(/-V$/i, ' V')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function baseName(v) {
      return normalizeName(v)
        .replace(/\bEX\b/gi, '')
        .replace(/\bGX\b/gi, '')
        .replace(/\bVMAX\b/gi, '')
        .replace(/\bVSTAR\b/gi, '')
        .replace(/\bV\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const name = normalizeName(rawName);
    const base = baseName(rawName);
    const number = rawNumber.split('/')[0].trim();

    const queries = [];
    if (name) queries.push(`name:"${name}"`);
    if (rawName) queries.push(`name:"${rawName}"`);
    if (base) queries.push(`name:${base}`);
    if (base) queries.push(`name:"${base}"`);
    if (base && number) queries.push(`name:${base} number:${number}`);
    if (number && !base) queries.push(`number:${number}`);

    const seen = new Set();
    const cards = [];
    let usedQuery = '';

    for (const q of queries) {
      const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=20&orderBy=-set.releaseDate`;
      const response = await fetch(url, {
        headers: process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
      });
      const data = await response.json();
      if (!response.ok) continue;
      usedQuery = usedQuery || q;
      for (const c of (data.data || [])) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        cards.push({
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
        });
      }
      if (cards.length >= 12) break;
    }

    return res.status(200).json({ ok: true, query: usedQuery || queries[0] || '', cards: cards.slice(0, 20) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfehler' });
  }
}
