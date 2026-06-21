import { neon } from '@neondatabase/serverless';
import { pbkdf2Sync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const SESSION_DAYS = 30;
const SESSION_COOKIE = 'cw_session';
let authSchemaReady = false;

export function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!url) return null;
  return neon(url);
}

export function tokenFrom(req) {
  return String(req.headers['x-app-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();
}

export function hasAdminToken(req) {
  const expected = String(process.env.APP_ACCESS_TOKEN || '').trim();
  return Boolean(expected && tokenFrom(req) === expected);
}

export function adminTokenConfigured() {
  return Boolean(String(process.env.APP_ACCESS_TOKEN || '').trim());
}

export function parseCookies(req) {
  const header = String(req.headers.cookie || '');
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index === -1) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

export function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 60);
}

export function publicUser(row) {
  if (!row) return null;
  return { id: row.id, username: row.username, displayName: row.display_name || row.username };
}

export async function ensureAuthSchema(sql) {
  if (authSchemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS cw_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cw_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES cw_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS cw_sessions_user_idx ON cw_sessions (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS cw_sessions_expires_idx ON cw_sessions (expires_at)`;
  authSchemaReady = true;
}

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(String(password || ''), salt, 210000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$210000$${salt}$${hash}`;
}

export function verifyPassword(password, encoded) {
  const parts = String(encoded || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const [, iterationsRaw, salt, expected] = parts;
  const actual = pbkdf2Sync(String(password || ''), salt, Number(iterationsRaw), 32, 'sha256');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

function tokenHash(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

export async function getSessionUser(req, sql = getSql()) {
  if (!sql) return null;
  await ensureAuthSchema(sql);
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const rows = await sql`
    SELECT u.id, u.username, u.display_name
    FROM cw_sessions s
    JOIN cw_users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash(token)} AND s.expires_at > now()
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createSession(res, sql, userId) {
  const token = randomBytes(32).toString('base64url');
  await sql`
    INSERT INTO cw_sessions (token_hash, user_id, expires_at)
    VALUES (${tokenHash(token)}, ${userId}, now() + interval '30 days')
  `;
  setSessionCookie(res, token);
}

export async function destroySession(req, res, sql = getSql()) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (sql && token) {
    await ensureAuthSchema(sql);
    await sql`DELETE FROM cw_sessions WHERE token_hash = ${tokenHash(token)}`;
  }
  clearSessionCookie(res);
}

export async function countUsers(sql) {
  await ensureAuthSchema(sql);
  const rows = await sql`SELECT COUNT(*)::int AS count FROM cw_users`;
  return Number(rows[0]?.count || 0);
}

export async function createUser(sql, { username, password, displayName }) {
  await ensureAuthSchema(sql);
  const cleanUsername = normalizeUsername(username);
  if (cleanUsername.length < 3) throw new Error('Benutzername muss mindestens 3 Zeichen haben.');
  if (String(password || '').length < 8) throw new Error('Passwort muss mindestens 8 Zeichen haben.');
  const id = `user_${randomBytes(12).toString('hex')}`;
  const rows = await sql`
    INSERT INTO cw_users (id, username, display_name, password_hash)
    VALUES (${id}, ${cleanUsername}, ${String(displayName || cleanUsername).trim().slice(0, 80)}, ${hashPassword(password)})
    RETURNING id, username, display_name
  `;
  return rows[0];
}

export async function findUserByLogin(sql, username) {
  await ensureAuthSchema(sql);
  const cleanUsername = normalizeUsername(username);
  const rows = await sql`
    SELECT id, username, display_name, password_hash
    FROM cw_users
    WHERE username = ${cleanUsername}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function requireUser(req, res, sql = getSql()) {
  const expected = String(process.env.APP_ACCESS_TOKEN || '').trim();
  if (!expected) {
    res.status(503).json({ ok: false, error: 'APP_ACCESS_TOKEN fehlt in Vercel. Anmeldung bleibt gesperrt.' });
    return null;
  }
  if (!sql) {
    res.status(503).json({ ok: false, error: 'DATABASE_URL fehlt in Vercel. Cloud ist noch nicht eingerichtet.' });
    return null;
  }
  const user = await getSessionUser(req, sql);
  if (user) return user;
  res.status(401).json({ ok: false, error: 'Bitte anmelden.' });
  return null;
}

export async function hasSessionOrAdmin(req, sql = getSql()) {
  if (!adminTokenConfigured()) return true;
  if (hasAdminToken(req)) return true;
  return Boolean(await getSessionUser(req, sql));
}
