export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });

  try {
    const body = req.body || {};
    const rawName = String(body.name || body.originalName || body.cardmarketName || '').trim();
    const number = String(body.number || body.fullNumber || body.searchNumber || '').trim();
    const setCode = String(body.setCode || '').trim();

    if (!rawName && !number && !setCode) {
      return res.status(400).json({ ok: false, error: 'Kein Suchbegriff vorhanden.' });
    }

    const name = rawName
      .replace(/-EX$/i, ' ex')
      .replace(/-GX$/i, ' gx')
      .replace(/-V$/i, ' v')
      .replace(/-/g, ' ')
      .trim();

    const terms = [];
    if (name) terms.push(`name:"${name}"`);
    if (number) terms.push(`number:${number.split('/')[0]}`);

    const q = terms.join(' ');
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=12&orderBy=-set.releaseDate`;

    const response = await fetch(url, {
      headers: process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: data?.error?.message || 'Pokémon TCG API Fehler' });
    }

    const cards = (data.data || []).map(c => ({
      id: c.id,
      name: c.name || '',
      cardmarketName: (c.name || '').replace(/\s+ex$/i, '-ex').replace(/\s+EX$/i, '-EX'),
      number: c.number || '',
      setCode: (c.set?.ptcgoCode || c.set?.id || '').toUpperCase(),
      setName: (c.set?.name || '').replace(/\s+/g, '-'),
      series: c.set?.series || '',
      rarity: c.rarity || '',
      imageSmall: c.images?.small || '',
      imageLarge: c.images?.large || ''
    }));

    return res.status(200).json({ ok: true, query: q, cards });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfehler' });
  }
}
