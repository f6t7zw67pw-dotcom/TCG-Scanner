export default async function handler(req, res) {
  const source = 'https://raw.githubusercontent.com/f6t7zw67pw-dotcom/TCG-Scanner/4daa6f040f7c758934c7474ebe90b93528480f9b/pokemon-db-loader.js';
  const cloudSyncLoader = `\n;(() => {\n  if (document.querySelector('script[data-cw-cloud-sync="1"]')) return;\n  const script = document.createElement('script');\n  script.src = 'cloud-sync.js';\n  script.async = false;\n  script.dataset.cwCloudSync = '1';\n  document.head.appendChild(script);\n})();\n`;
  try {
    const response = await fetch(source, { headers: { 'User-Agent': 'TCG-Scanner' } });
    if (!response.ok) throw new Error(`Basis-Loader konnte nicht geladen werden (${response.status})`);
    const code = await response.text();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).send(code + cloudSyncLoader);
  } catch (err) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(500).send(`console.error(${JSON.stringify(err?.message || 'Loader-Fehler')});`);
  }
}
