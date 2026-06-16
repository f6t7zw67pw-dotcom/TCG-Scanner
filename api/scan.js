export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt' });
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(400).json({ ok: false, error: 'OPENAI_API_KEY fehlt in Vercel.' });
    const body = req.body || {};
    const mode = body.mode === 'multi' ? 'multi' : 'single';
    const image = body.image;
    const extraText = body.extraText || '';
    if (!image || typeof image !== 'string') return res.status(400).json({ ok: false, error: 'Kein Bild empfangen.' });
    const model = mode === 'multi' ? (process.env.OPENAI_MULTI_MODEL || 'gpt-4o') : (process.env.OPENAI_SINGLE_MODEL || 'gpt-4o-mini');
    const schema = mode === 'multi'
      ? '{"mode":"multi","listing":{"ebayPrice":"","shipping":"","listingType":"","notes":[]},"cards":[{"originalName":"","fullNumber":"","searchNumber":"","setCode":"","setName":"","languageGuess":"","languageCode":"","cardType":"","cardVersion":"","confidence":0,"warnings":[]}]}'
      : '{"mode":"single","listing":{"ebayPrice":"","shipping":"","listingType":"","notes":[]},"cards":[{"originalName":"","fullNumber":"","searchNumber":"","setCode":"","setName":"","languageGuess":"","languageCode":"","cardType":"","cardVersion":"","confidence":0,"warnings":[]}]}' ;
    const prompt = mode === 'multi'
      ? `Du bist ein Pokémon-TCG Multi-Karten Ankauf-Scanner. Erkenne jede sichtbare Karte separat. Erfinde nichts. Fehlende Felder leer lassen und warnings setzen. eBay Gesamtpreis/Gebot und Versand nur erfassen, wenn sichtbar. Cardmarket-Preise nicht schätzen. Gib ausschließlich JSON in diesem Format zurück: ${schema}`
      : `Du bist ein Pokémon-TCG Einzelkarten-Crop-Scanner. Das Bild zeigt normalerweise genau eine Karte oder einen engen Ausschnitt einer Karte. Analysiere nur diese eine Karte. Lies zuerst den Pokémon-Namen, dann die Kartennummer unten, danach SetCode/SetName falls sichtbar. Gewichte gedruckte Kartennummern stärker als dekorativen Text. Erfinde nichts: wenn Name, Nummer oder Set nicht klar lesbar sind, lasse das Feld leer und schreibe eine kurze warning. Keine Cardmarket-Preise schätzen. Gib ausschließlich JSON in diesem Format zurück: ${schema}`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Du gibst ausschließlich valides JSON zurück.' },
          { role: 'user', content: [
            { type: 'text', text: `${prompt}\nZusatztext: ${extraText}` },
            { type: 'image_url', image_url: { url: image, detail: mode === 'multi' ? 'high' : 'low' } }
          ]}
        ]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: data?.error?.message || 'OpenAI Fehler' });
    const text = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { mode, listing: {}, cards: [], raw: text }; }
    return res.status(200).json({ ok: true, model, ...parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfehler' });
  }
}
