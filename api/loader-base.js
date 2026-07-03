export default async function handler(req, res) {
  const source = 'https://raw.githubusercontent.com/f6t7zw67pw-dotcom/TCG-Scanner/4daa6f040f7c758934c7474ebe90b93528480f9b/pokemon-db-loader.js';
  const extensionLoader = `\n;(() => {\n  const scripts = [\n    ['cloud-sync.js', 'cwCloudSync', 'cw-cloud-sync'],\n    ['password-reset-helper.js', 'cwPasswordResetHelper', 'cw-password-reset-helper'],\n    ['price-helper.js', 'cwPriceHelper', 'cw-price-helper'],\n    ['mvp-vision-helper.js', 'cwMvpVisionHelper', 'cw-mvp-vision-helper'],\n    ['scan-history-helper.js', 'cwScanHistoryHelper', 'cw-scan-history-helper'],\n    ['scan-confirm-helper.js', 'cwScanConfirmHelper', 'cw-scan-confirm-helper'],\n    ['scan-alias-autofix.js', 'cwScanAliasAutofix', 'cw-scan-alias-autofix'],\n    ['scan-language-helper.js', 'cwScanLanguageHelper', 'cw-scan-language-helper'],\n    ['card-search-helper.js', 'cwCardSearchHelper', 'cw-card-search-helper'],\n    ['pokedex-helper.js', 'cwPokedexHelper', 'cw-pokedex-helper'],\n    ['pokedex-binder-helper.js', 'cwPokedexBinderHelper', 'cw-pokedex-binder-helper']\n  ];\n  for (const [src, flag, attr] of scripts) {\n    if (document.querySelector('script[data-' + attr + '=\"1\"]')) continue;\n    const script = document.createElement('script');\n    script.src = src;\n    script.async = false;\n    script.dataset[flag] = '1';\n    document.head.appendChild(script);\n  }\n})();\n`;
  try {
    const response = await fetch(source, { headers: { 'User-Agent': 'TCG-Scanner' } });
    if (!response.ok) throw new Error(`Basis-Loader konnte nicht geladen werden (${response.status})`);
    const code = await response.text();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).send(code + extensionLoader);
  } catch (err) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(500).send(`console.error(${JSON.stringify(err?.message || 'Loader-Fehler')});`);
  }
}
