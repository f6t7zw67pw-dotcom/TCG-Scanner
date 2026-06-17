export default async function handler(req, res) {
  const source = 'https://raw.githubusercontent.com/f6t7zw67pw-dotcom/TCG-Scanner/4daa6f040f7c758934c7474ebe90b93528480f9b/pokemon-db-loader.js';
  try {
    const response = await fetch(source, { headers: { 'User-Agent': 'TCG-Scanner' } });
    if (!response.ok) throw new Error(`Basis-Loader konnte nicht geladen werden (${response.status})`);
    const code = await response.text();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(code);
  } catch (err) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(500).send(`console.error(${JSON.stringify(err?.message || 'Loader-Fehler')});`);
  }
}
