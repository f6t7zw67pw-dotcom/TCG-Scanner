const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NAMES_CSV_URL = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv';
let cachedAt = 0;
let cachedPokemon = null;

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CardWizardPro/1.0',
      'Accept': 'text/csv,text/plain,*/*'
    }
  });
  if (!response.ok) throw new Error(`Pokemon DB Quelle Fehler ${response.status}`);
  return response.text();
}

function buildPokemonMap(csv) {
  const byId = new Map();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [pokemonSpeciesId, localLanguageId, name] = parseCsvLine(line);
    if (!pokemonSpeciesId || !localLanguageId || !name) continue;
    const id = Number(pokemonSpeciesId);
    const lang = Number(localLanguageId);
    if (!byId.has(id)) byId.set(id, {});
    if (lang === 6) byId.get(id).de = name;
    if (lang === 9) byId.get(id).en = name;
  }

  const pokemon = {};
  for (const entry of byId.values()) {
    if (entry.de && entry.en) pokemon[entry.de] = entry.en;
  }
  return pokemon;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Nur GET erlaubt' });

  try {
    const now = Date.now();
    if (cachedPokemon && now - cachedAt < CACHE_TTL_MS) {
      return res.status(200).json({ ok: true, count: Object.keys(cachedPokemon).length, pokemon: cachedPokemon, cached: true });
    }

    cachedPokemon = buildPokemonMap(await fetchText(NAMES_CSV_URL));
    cachedAt = now;

    return res.status(200).json({ ok: true, count: Object.keys(cachedPokemon).length, pokemon: cachedPokemon, cached: false });
  } catch (err) {
    console.error(JSON.stringify({ event: 'pokemon_db_error', errorName: String(err?.name || 'Error').slice(0, 80) }));
    return res.status(500).json({ ok: false, error: 'Pokemon DB konnte nicht geladen werden' });
  }
}
