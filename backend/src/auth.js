// Auth: JWT в httpOnly-cookie, bcrypt-хэши, анти-брутфорс (ТЗ п.4.1, 5.3)
// Миграция на json-server/lowdb: доступ к данным через repo.js (db.json)
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { findUserByLogin, checkBruteForce as repoCheckBruteForce, recordAttempt as repoRecordAttempt } from './repo.js';

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

export { repoCheckBruteForce as checkBruteForce, repoRecordAttempt as recordAttempt };

export async function verifyCredentials(login, password) {
  const u = await findUserByLogin(login);
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  return ok ? u : null;
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export const ROLES_STAFF = ['manager', 'admin', 'super_admin'];
