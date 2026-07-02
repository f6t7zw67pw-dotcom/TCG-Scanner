import { getSql, hasSessionOrAdmin } from '../_auth.js';
import { ensureCatalogSchema, resolveCatalogUserId } from '../_catalog.js';
import { learnConfirmedCardAliases } from '../_catalog-learning.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Nur POST erlaubt.' });

  const sql = getSql();
  if (!(await hasSessionOrAdmin(req, sql))) return res.status(401).json({ ok: false, error: 'Bitte anmelden, bevor du Scans bestaetigst.' });
  if (!sql) return res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt in Vercel.' });

  try {
    await ensureCatalogSchema(sql);
    const userId = await resolveCatalogUserId(req, sql);
    if (!userId) return res.status(401).json({ ok: false, error: 'Bitte anmelden.' });

    const body = req.body || {};
    const scanId = String(body.scanId || '').trim();
    const cardId = String(body.cardId || body.card?.id || '').trim();
    const card = body.card && typeof body.card === 'object' ? body.card : null;
    if (!scanId) return res.status(400).json({ ok: false, error: 'scanId fehlt.' });
    if (!cardId && !card) return res.status(400).json({ ok: false, error: 'Kartenbestaetigung fehlt.' });

    const rows = await sql`
      SELECT id, result
      FROM cw_scans
      WHERE id = ${scanId} AND user_id = ${userId}
      LIMIT 1
    `;
    const scan = rows[0];
    if (!scan) return res.status(404).json({ ok: false, error: 'Scan wurde nicht gefunden.' });

    const result = scan.result && typeof scan.result === 'object' ? scan.result : {};
    const learning = await learnConfirmedCardAliases(sql, {
      scanResult: result,
      confirmedCardId: cardId,
      confirmedCard: card
    });
    const updatedResult = {
      ...result,
      confirmedCard: card || result.confirmedCard || null,
      confirmation: {
        cardId: cardId || card?.id || '',
        confirmedAt: new Date().toISOString(),
        learned: learning
      }
    };

    await sql`
      UPDATE cw_scans
      SET result = ${JSON.stringify(updatedResult)}, best_card_id = ${cardId || null}, status = 'confirmed'
      WHERE id = ${scanId} AND user_id = ${userId}
    `;

    return res.status(200).json({ ok: true, scanId, cardId: cardId || card?.id || '', status: 'confirmed', learned: learning });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Scan-Bestaetigung fehlgeschlagen.' });
  }
}
