import { getSql, hasAdminToken } from './_auth.js';
import { ensurePokemonNameAliasSchema, upsertPokemonNameAliases } from './_pokemon-name-aliases.js';

export const config = { maxDuration: 60 };

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TCG-Scanner' } });
  if (!response.ok) throw new Error(`PokeAPI Fehler ${response.status}`);
  return response.json();
}

async function runLimited(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    while (index < items.length) {
      const current = items[index++];
      results.push(await worker(current));
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, next));
  return results;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });
  if (!hasAdminToken(req)) return res.status(401).json({ ok: false, error: 'Admin-Token fehlt oder ist falsch.' });

  const sql = getSql();
  if (!sql) return res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt.' });

  try {
    await ensurePokemonNameAliasSchema(sql);
    const offset = Math.max(0, Number(req.query.offset || req.body?.offset || 0));
    const limit = Math.max(1, Math.min(250, Number(req.query.limit || req.body?.limit || 150)));
    const list = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species?offset=${offset}&limit=${limit}`);
    const items = Array.isArray(list.results) ? list.results : [];
    let aliases = 0;
    let imported = 0;
    const failures = [];

    await runLimited(items, 12, async (item) => {
      try {
        const species = await fetchJson(item.url);
        aliases += await upsertPokemonNameAliases(sql, species);
        imported += 1;
      } catch (err) {
        failures.push({ name: item.name, error: err?.message || 'Import fehlgeschlagen' });
      }
    });

    return res.status(200).json({
      ok: true,
      offset,
      limit,
      imported,
      aliases,
      total: Number(list.count || 0),
      nextOffset: offset + items.length < Number(list.count || 0) ? offset + items.length : null,
      failures: failures.slice(0, 10)
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Pokemon-Alias-Sync fehlgeschlagen.' });
  }
}
