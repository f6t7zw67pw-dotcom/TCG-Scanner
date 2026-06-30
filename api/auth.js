import {
  adminTokenConfigured,
  clearSessionCookie,
  countUsers,
  createSession,
  createUser,
  destroySession,
  ensureAuthSchema,
  findUserByLogin,
  getSessionUser,
  getSql,
  hasAdminToken,
  publicUser,
  updateUserPassword,
  verifyPassword
} from './_auth.js';

function readAction(req) {
  if (req.method === 'GET') return 'me';
  return String((req.body || {}).action || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ ok: false, error: 'Methode nicht erlaubt.' });
  }

  const sql = getSql();
  if (!sql) return res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt in Vercel.' });
  if (!adminTokenConfigured()) return res.status(503).json({ ok: false, error: 'APP_ACCESS_TOKEN fehlt in Vercel.' });

  try {
    await ensureAuthSchema(sql);
    const action = readAction(req);

    if (action === 'me') {
      const user = await getSessionUser(req, sql);
      return res.status(200).json({ ok: true, user: publicUser(user), setupRequired: (await countUsers(sql)) === 0 });
    }

    if (action === 'logout') {
      await destroySession(req, res, sql);
      return res.status(200).json({ ok: true });
    }

    if (action === 'signup') {
      const existingUsers = await countUsers(sql);
      if (existingUsers > 0 && !hasAdminToken(req)) {
        return res.status(403).json({ ok: false, error: 'Weitere Konten brauchen den Einrichtungscode.' });
      }
      if (existingUsers === 0 && !hasAdminToken(req)) {
        return res.status(403).json({ ok: false, error: 'Erstes Konto braucht den Einrichtungscode.' });
      }
      const user = await createUser(sql, req.body || {});
      await createSession(res, sql, user.id);
      return res.status(200).json({ ok: true, user: publicUser(user) });
    }

    if (action === 'reset-password') {
      if (!hasAdminToken(req)) {
        return res.status(403).json({ ok: false, error: 'Passwort-Reset braucht den Einrichtungscode.' });
      }
      const user = await updateUserPassword(sql, req.body || {});
      await createSession(res, sql, user.id);
      return res.status(200).json({ ok: true, user: publicUser(user) });
    }

    if (action === 'login') {
      const found = await findUserByLogin(sql, req.body?.username);
      if (!found || !verifyPassword(req.body?.password, found.password_hash)) {
        clearSessionCookie(res);
        return res.status(401).json({ ok: false, error: 'Benutzername oder Passwort stimmt nicht.' });
      }
      await createSession(res, sql, found.id);
      return res.status(200).json({ ok: true, user: publicUser(found) });
    }

    return res.status(400).json({ ok: false, error: 'Unbekannte Auth-Aktion.' });
  } catch (err) {
    const duplicate = String(err?.message || '').includes('duplicate key');
    return res.status(duplicate ? 409 : 500).json({ ok: false, error: duplicate ? 'Benutzername ist bereits vergeben.' : (err?.message || 'Auth Fehler') });
  }
}
