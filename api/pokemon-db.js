const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cachedAt = 0;
let cachedPokemon = null;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CardWizardPro/1.0' }
  });
  if (!response.ok) throw new Error(`PokeAPI Fehler ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Nur GET erlaubt' });

  try {
    const now = Date.now();
    if (cachedPokemon && now - cachedAt < CACHE_TTL_MS) {
      return res.status(200).json({ ok: true, count: Object.keys(cachedPokemon).length, pokemon: cachedPokemon, cached: true });
    }

    const list = await fetchJson('https://pokeapi.co/api/v2/pokemon-species?limit=2000');
    const species = await Promise.all(
      (list.results || []).map(async item => {
        const data = await fetchJson(item.url);
        const names = Object.fromEntries((data.names || []).map(n => [n.language?.name, n.name]));
        return names.de && names.en ? [names.de, names.en] : null;
      })
    );

    cachedPokemon = Object.fromEntries(species.filter(Boolean));
    cachedAt = now;

    return res.status(200).json({ ok: true, count: Object.keys(cachedPokemon).length, pokemon: cachedPokemon, cached: false });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Pokemon DB konnte nicht geladen werden' });
  }
}
