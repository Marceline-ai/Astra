// Auth: JWT в httpOnly-cookie, bcrypt-хэши, анти-брутфорс (ТЗ п.4.1, 5.3)
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, one } from './db.js';

const SECRET = process.env.JWT_SECRET || 'astra-dev-secret-change-me';
const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MIN = 15;

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: `${user.firstname} ${user.lastname}` },
    SECRET, { expiresIn: '8h' }
  );
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

// requireAuth / requireRole middleware
export function authMiddleware(req, res, next) {
  const token = req.cookies?.astra_token || (req.headers.authorization || '').replace('Bearer ', '');
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized', message: 'Требуется вход в систему' });
  req.user = payload;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden', message: 'Недостаточно прав' });
    next();
  };
}

async function recentFailCount(loginKey) {
  const rows = await query(
    `SELECT success FROM login_attempts WHERE login_key = $1 AND attempted_at > now() - interval '${LOCK_WINDOW_MIN} minutes'`,
    [loginKey]
  );
  // pg-mem может не поддержать interval — fallback:
  if (rows === undefined) return 0;
  return rows.filter(r => !r.success).length;
}

export async function checkBruteForce(loginKey) {
  let fails;
  try {
    fails = await recentFailCount(loginKey);
  } catch {
    const rows = await query(`SELECT success FROM login_attempts WHERE login_key = $1`, [loginKey]);
    fails = rows.filter(r => !r.success).slice(-MAX_ATTEMPTS).length;
  }
  return fails >= MAX_ATTEMPTS;
}

export async function recordAttempt(loginKey, ip, success) {
  await query(
    `INSERT INTO login_attempts (login_key, ip, success, attempted_at) VALUES ($1,$2,$3, now())`,
    [loginKey, ip ?? '', success]
  );
  if (success) {
    await query(`DELETE FROM login_attempts WHERE login_key = $1`, [loginKey]).catch(() => {});
  }
}

export async function verifyCredentials(login, password) {
  const u = await one(
    `SELECT * FROM users WHERE (email = $1 OR phone = $1) AND is_active = TRUE`,
    [login.trim().toLowerCase()]
  );
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  return ok ? u : null;
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export const ROLES_STAFF = ['manager', 'admin', 'super_admin'];
