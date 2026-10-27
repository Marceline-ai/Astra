// repo.js — слой доступа к данным для json-server/lowdb (миграция с PostgreSQL/pg-mem).
// Хранилище: backend/db/db.json — тот же файл можно поднимать чистым json-server:
//   npx json-server --watch db/db.json --port 3000
// Публичный интерфейс (сигнатуры) совпадает со старым сервером на SQL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSONFile } from 'lowdb/node';
import { Low } from 'lowdb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_FILE = path.join(__dirname, '..', 'db', 'db.json');

if (!fs.existsSync(DB_FILE)) {
  console.error(`[repo] Не найден ${DB_FILE}. Запустите миграцию: node src/generate-db.js`);
  process.exit(1);
}

const adapter = new JSONFile(DB_FILE);
export const db = new Low(adapter, {});
await db.read();

const EMPTY = {
  users: [], clients: [], masters: [], categories: [], services: [],
  master_services: [], schedules: [], schedule_exceptions: [], bookings: [], login_attempts: [],
  audit_logs: [],
};
db.data = { ...EMPTY, ...db.data };
db.data._sequence ??= {};

export const MODE_LABEL = 'json-server';

// ------------------------------------------------------------------ helpers
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const eq = (a, b) => String(a) === String(b);
const toInt = (v) => Math.round(Number(v));
const isoDay = (d) => d.toISOString().slice(0, 10);
const DOW_LIST = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function dowOf(dateStr) { return DOW_LIST[new Date(dateStr + 'T12:00:00').getDay()]; }

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function toMin(t) {
  if (typeof t === 'string') { const [h, m] = t.slice(0, 5).split(':'); return +h * 60 + +m; }
  return t.getHours() * 60 + t.getMinutes();
}
export function minToHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function nextId(collection) {
  const seq = db.data._sequence;
  const maxExisting = db.data[collection].reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
  seq[collection] = Math.max((seq[collection] ?? 0) + 1, maxExisting + 1);
  return seq[collection];
}

async function insert(collection, data) {
  const rec = { id: nextId(collection), ...data };
  db.data[collection].push(rec);
  await db.write();
  return structuredClone(rec);
}

const find = (collection, pred = () => true) => db.data[collection].filter(pred);
const byId = (collection, id) => db.data[collection].find(r => eq(r.id, id)) ?? null;
const userOf = (userId) => db.data.users.find(u => eq(u.id, userId)) ?? null;

// ------------------------------------------------------------------ public reads
// Приведение записей db.json к каноничной форме (миграция с PostgreSQL):
// поля могут отсутствовать/быть null — нормализуем, чтобы фронтенд всегда
// получал полный набор полей; строки приводим к string, числа — к number.
const str = (v) => (v === undefined || v === null ? '' : String(v));

// Совместимость со старыми данными: до миграции на json-server картинки
// хранились по пути /images/..., но в frontend/public таких файлов нет
// (ассеты лежат в /assets). Нормализуем URL «на лету», чтобы изображения
// отображались и в старых db.json, и после перегенерации.
export function normalizeAssetUrl(u) {
  const s = str(u);
  return s.startsWith('/images/') ? '/assets/' + s.slice('/images/'.length) : s;
}
const numOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

// Время из db.json: 'HH:MM', 'HH:MM:SS' или ISO-строка → Date в локальном ТЗ
// (совместимо со старым postgres TIMESTAMPTZ). Нужен для schedules/exceptions.
export function jsonTimeToDate(v) {
  if (v instanceof Date) return v;
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/))) {
    const d = new Date();
    d.setHours(+m[1], +m[2], 0, 0);
    return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeCategory(c) {
  return {
    id: numOrNull(c.id),
    name: str(c.name),
    description: str(c.description ?? c.descr),
    image_url: normalizeAssetUrl(c.image_url),
    sort_order: numOrNull(c.sort_order) ?? 0,
  };
}

function normalizeService(s) {
  return {
    id: numOrNull(s.id),
    category_id: numOrNull(s.category_id),
    name: str(s.name),
    description: s.description == null ? null : str(s.description),
    price: numOrNull(s.price) ?? 0,
    duration_minutes: numOrNull(s.duration_minutes) ?? 0,
    is_active: s.is_active !== false, // json-запись без флага считается активной
  };
}

function normalizeMasterRow(m, u) {
  return {
    id: numOrNull(m.id),
    user_id: numOrNull(m.user_id),
    firstname: str(u?.firstname ?? m.firstname),
    lastname: str(u?.lastname ?? m.lastname),
    speciality: str(m.speciality),
    bio: str(m.bio),
    photo_url: normalizeAssetUrl(m.photo_url ?? u?.avatar_url),
    rating_avg: numOrNull(m.rating_avg) ?? 0,
  };
}

export async function listCategories() {
  return [...db.data.categories].map(normalizeCategory).sort((a, b) => a.sort_order - b.sort_order);
}

export async function listServices() {
  return [...db.data.services]
    .map(normalizeService)
    .filter(s => s.is_active)
    .sort((a, b) => (a.category_id ?? 0) - (b.category_id ?? 0) || a.name.localeCompare(b.name));
}

export async function listPublicMasters() {
  return db.data.masters
    .map(m => normalizeMasterRow(m, userOf(m.user_id)))
    .filter(m => m.id !== null && m.firstname !== '') // мастер привязан к активному пользователю
    .sort((a, b) => a.id - b.id);
}

// Совместимость форм записи связей: master_services | service_masters | services.master_ids
const linksForService = (serviceId) => {
  const out = [];
  for (const c of ['master_services', 'service_masters']) {
    for (const r of db.data[c] ?? []) {
      if (eq(r.service_id, serviceId)) out.push(num(r.master_id));
    }
  }
  const svc = db.data.services.find(s => eq(s.id, serviceId));
  for (const mid of svc?.master_ids ?? []) out.push(num(mid));
  return out.filter((v) => v !== null);
};

export async function mastersForService(serviceId) {
  // Важно: master_services в db.json могут не иметь поля id — сортировка по
  // ms.id давала NaN и пустой список. Фильтруем только по service_id,
  // исключаем дубли мастеров. Если прямых связей нет (например, база поднята
  // «чистым» json-server без таблицы связей), возвращаем всех активных мастеров,
  // чтобы dropdown «Мастер» никогда не оставался пустым.
  const seen = new Set();
  const ids = linksForService(serviceId).filter((mid) => !seen.has(mid) && seen.add(mid));
  const rows = (ids.length > 0 ? ids.map((mid) => byId('masters', mid)) : db.data.masters)
    .filter(Boolean)
    .map(m => normalizeMasterRow(m, userOf(m.user_id)))
    .filter(m => m.id !== null && m.firstname !== '')
    .sort((a, b) => a.id - b.id)
    .map(({ id, firstname, lastname, speciality, photo_url }) => ({ id, firstname, lastname, speciality, photo_url }));
  return rows;
}

export async function getService(id) {
  const s = byId('services', id);
  return s ? normalizeService(s) : null;
}
export async function getActiveService(id) {
  const s = await getService(id);
  return s && s.is_active ? s : null;
}
export const masterHasService = (masterId, serviceId) => {
  const ids = linksForService(serviceId);
  if (ids.length === 0) return byId('masters', masterId) !== null; // связей нет — допускаем всех мастеров
  return ids.includes(num(masterId));
};

// ------------------------------------------------------------------ schedule logic
export async function getWorkingIntervals(masterId, dateStr) {
  const exc = find('schedule_exceptions', e => eq(e.master_id, masterId) && eq(e.exception_date, dateStr));
  if (exc.length > 0) {
    const e = exc[0];
    if (!e.is_working) return [];
    const s = jsonTimeToDate(e.start_time), t = jsonTimeToDate(e.end_time);
    if (s && t) return [{ start: toMin(s), end: toMin(t), break: null }];
  }
  const sched = find('schedules', s => eq(s.master_id, masterId) && s.day_of_week === dowOf(dateStr));
  if (sched.length === 0) return [];
  const s = sched[0];
  const start = jsonTimeToDate(s.start_time), end = jsonTimeToDate(s.end_time);
  if (!start || !end) return [];
  const bs = jsonTimeToDate(s.break_start), be = jsonTimeToDate(s.break_end);
  const breakRange = bs && be ? { start: toMin(bs), end: toMin(be) } : null;
  return [{ start: toMin(start), end: toMin(end), break: breakRange }];
}

function dayMinutes(ts, dateStr) {
  const d = ts instanceof Date ? ts : new Date(ts);
  const utcDate = isoDay(d);
  const base = utcDate === dateStr ? 0 : (new Date(utcDate) > new Date(dateStr) ? 24 * 60 : -24 * 60);
  return base + d.getUTCHours() * 60 + d.getUTCMinutes();
}

export async function getBusyIntervals(masterId, dateStr) {
  const dayStart = new Date(dateStr + 'T00:00:00Z').getTime();
  const rows = find('bookings', b =>
    eq(b.master_id, masterId) && b.status !== 'canceled' &&
    new Date(b.end_at).getTime() > dayStart && new Date(b.start_at).getTime() < dayStart + 86400000);
  return rows.map(r => ({ start: dayMinutes(r.start_at, dateStr), end: dayMinutes(r.end_at, dateStr), bookingId: r.id }));
}

export const SLOT_STEP_MIN = 30;

export async function getFreeSlots(masterId, dateStr, durationMin, nowMin = -1) {
  const intervals = await getWorkingIntervals(masterId, dateStr);
  if (intervals.length === 0) return [];
  const busy = await getBusyIntervals(masterId, dateStr);
  const slots = [];
  for (const iv of intervals) {
    const segs = [];
    if (iv.break) {
      if (iv.start < iv.break.start) segs.push([iv.start, iv.break.start]);
      if (iv.break.end < iv.end) segs.push([iv.break.end, iv.end]);
    } else segs.push([iv.start, iv.end]);
    for (const [s, e] of segs) {
      for (let t = Math.ceil(s / SLOT_STEP_MIN) * SLOT_STEP_MIN; t + durationMin <= e; t += SLOT_STEP_MIN) {
        if (t < nowMin) continue;
        const overlap = busy.some(b => !(b.end <= t || b.start >= t + durationMin));
        if (!overlap) slots.push(minToHHMM(t));
      }
    }
  }
  return slots;
}

export async function findConflict(masterId, startAt, endAt, ignoreBookingId = null) {
  const conf = find('bookings', b =>
    eq(b.master_id, masterId) && b.status !== 'canceled' &&
    new Date(b.start_at) < new Date(endAt) && new Date(b.end_at) > new Date(startAt) &&
    !eq(b.id, ignoreBookingId));
  return conf.length > 0 ? conf[0] : null;
}

export async function getScheduleGrid(dateStr, masters) {
  const out = [];
  for (const m of masters) {
    const intervals = await getWorkingIntervals(m.id, dateStr);
    const busy = await getBusyIntervals(m.id, dateStr);
    out.push({ master: m, intervals, busy });
  }
  return out;
}

// ------------------------------------------------------------------ auth / users
export async function findUserByLogin(login) {
  const key = login.trim().toLowerCase();
  return db.data.users.find(u => u.is_active && (eq(u.email, key) || eq(u.email, login) || eq(u.phone, login))) ?? null;
}
export async function getUserById(id) {
  return byId('users', id);
}
export async function createUser(data) {
  const now = new Date().toISOString();
  return insert('users', { role: 'client', is_active: true, created_at: now, updated_at: now, ...data });
}
export async function createClient(userId) {
  return insert('clients', { user_id: userId, loyalty_balance: 0, notes: null });
}
export async function clientByUserId(userId) {
  return find('clients', c => eq(c.user_id, userId))[0] ?? null;
}

export async function recordAttempt(loginKey, ip, success) {
  await insert('login_attempts', { login_key: loginKey, ip: ip ?? '', success, attempted_at: new Date().toISOString() });
  if (success) {
    db.data.login_attempts = find('login_attempts', a => !eq(a.login_key, loginKey));
    await db.write();
  }
}

const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MIN = 15;
export async function checkBruteForce(loginKey) {
  const cutoff = Date.now() - LOCK_WINDOW_MIN * 60000;
  const fails = find('login_attempts', a => a.login_key === loginKey && !a.success && new Date(a.attempted_at).getTime() > cutoff);
  return fails.length >= MAX_ATTEMPTS;
}

// ------------------------------------------------------------------ clients (ensure)
export async function ensureClient({ firstname, lastname, phone, email }) {
  let cl = null;
  const byPhone = db.data.users.find(u => eq(u.phone, phone));
  if (byPhone) cl = clientByUserId(byPhone.id);
  if (!cl && email) {
    const byEmail = db.data.users.find(u => eq(u.email, email));
    if (byEmail) cl = clientByUserId(byEmail.id);
  }
  if (cl) return cl;
  const u = await createUser({ role: 'client', firstname, lastname: lastname ?? '', phone, email: email || null, password_hash: '!' });
  return insert('clients', { user_id: u.id, loyalty_balance: 0, notes: null });
}

// ------------------------------------------------------------------ bookings
function decorateBooking(b) {
  const svc = byId('services', b.service_id) ?? {};
  const cat = svc.category_id ? byId('categories', svc.category_id) : null;
  const m = byId('masters', b.master_id) ?? {};
  const mu = userOf(m.user_id) ?? {};
  const cl = byId('clients', b.client_id) ?? {};
  const cu = userOf(cl.user_id) ?? {};
  return {
    ...structuredClone(b),
    service_name: svc.name, duration_minutes: svc.duration_minutes, category_name: cat?.name ?? null,
    speciality: m.speciality, master_fn: mu.firstname, master_ln: mu.lastname, master_photo: m.photo_url,
    client_fn: cu.firstname, client_ln: cu.lastname, client_phone: cu.phone, client_email: cu.email,
  };
}

export async function createBooking(data) {
  const now = new Date().toISOString();
  return insert('bookings', { status: 'pending', comment: null, discount_percent: 0, is_prepaid: false, source: 'web', created_at: now, updated_at: now, ...data });
}
export async function getBooking(id) {
  return byId('bookings', id);
}
export async function getBookingPayload(id) {
  const b = byId('bookings', id);
  return b ? decorateBooking(b) : null;
}

export async function listBookings({ date, master_id, status } = {}) {
  let rows = [...db.data.bookings];
  if (date) {
    const d0 = new Date(date + 'T00:00:00Z').getTime(), d1 = d0 + 864e5;
    rows = rows.filter(b => new Date(b.start_at).getTime() >= d0 && new Date(b.start_at).getTime() < d1);
  }
  if (master_id) rows = rows.filter(b => eq(b.master_id, master_id));
  if (status) rows = rows.filter(b => b.status === status);
  rows.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  return rows.slice(0, 200).map(decorateBooking);
}

export async function updateBooking(id, patch) {
  const b = byId('bookings', id);
  if (!b) return null;
  Object.assign(b, patch, { updated_at: new Date().toISOString() });
  await db.write();
  return decorateBooking(b);
}

export async function deleteBooking(id) {
  const before = db.data.bookings.length;
  db.data.bookings = find('bookings', b => !eq(b.id, id));
  if (db.data.bookings.length === before) return false;
  await db.write();
  return true;
}

// ------------------------------------------------------------------ аудит (журнал действий сотрудников)
// Раньше при миграции на json-server логирование действий администраторов было
// потеряно — теперь каждое важное действие пишется в коллекцию audit_logs.
export async function addAuditLog({ user_id, actor_name, role, action, entity, entity_id, details, ip }) {
  return insert('audit_logs', {
    user_id: user_id ?? null,
    actor_name: str(actor_name),
    role: str(role),
    action: str(action),
    entity: str(entity),
    entity_id: entity_id == null ? null : num(entity_id),
    details: details == null ? null : (typeof details === 'string' ? details : JSON.stringify(details)),
    ip: str(ip),
    created_at: new Date().toISOString(),
  });
}

export async function listAuditLogs({ limit = 100 } = {}) {
  return [...db.data.audit_logs]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, Math.max(1, Math.min(500, toInt(limit) || 100)))
    .map(r => structuredClone(r));
}

export async function clearAuditLogs() {
  db.data.audit_logs = [];
  await db.write();
}

// ------------------------------------------------------------------ dashboard
export async function getDashboard() {
  const today = toDateStr(new Date());
  const B = db.data.bookings;
  const scheduled = B.filter(b => ['pending', 'confirmed'].includes(b.status) && isoDay(new Date(b.start_at)) >= today).length;
  const masters = db.data.masters.length;
  const waitlist = B.filter(b => b.status === 'pending').length;
  const confirmedShare = B.length ? Math.round(100 * B.filter(b => ['confirmed', 'completed'].includes(b.status)).length / B.length) : 0;
  const recent = [...B]
    .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
    .slice(0, 10)
    .map(b => {
      const d = decorateBooking(b);
      return { id: d.id, start_at: d.start_at, status: d.status, service_name: d.service_name, master_name: `${d.master_fn} ${d.master_ln}`, client_name: `${d.client_fn} ${d.client_ln}`, client_phone: d.client_phone };
    });
  return { scheduled, masters, waitlist, confirmed_share: confirmedShare, recent };
}

// ------------------------------------------------------------------ admin schedule view
export async function getAdminSchedule(date) {
  const masters = db.data.masters
    .map(m => ({ m, u: userOf(m.user_id) }))
    .filter(({ u }) => u && u.is_active)
    .map(({ m, u }) => ({ id: m.id, firstname: u.firstname, lastname: u.lastname, speciality: m.speciality, photo_url: m.photo_url }));
  const grid = await getScheduleGrid(date, masters);
  const d0 = new Date(date + 'T00:00:00Z').getTime(), d1 = d0 + 864e5;
  const bookings = find('bookings', b => b.status !== 'canceled' && new Date(b.start_at).getTime() >= d0 && new Date(b.start_at).getTime() < d1)
    .map(b => ({ ...structuredClone(b), service_name: byId('services', b.service_id)?.name }));
  return { date, grid, bookings };
}

// ------------------------------------------------------------------ settings: categories
export async function createCategory({ name, description, image_url, sort_order }) {
  return insert('categories', { name, description: description ?? null, image_url: image_url ?? null, sort_order: sort_order ?? 0 });
}
export async function updateCategory(id, data) {
  const c = byId('categories', id);
  if (!c) return null;
  Object.assign(c, { name: data.name, description: data.description ?? null, image_url: data.image_url ?? null, sort_order: data.sort_order ?? 0 });
  await db.write();
  return structuredClone(c);
}
export async function deleteCategory(id) {
  db.data.categories = find('categories', c => !eq(c.id, id));
  for (const s of find('services', s => eq(s.category_id, id))) s.category_id = null;
  await db.write();
}

// ------------------------------------------------------------------ settings: services
export async function createService({ category_id, name, description, price, duration_minutes, is_active, master_ids }) {
  const s = await insert('services', { category_id: category_id ?? null, name, description: description ?? null, price: toInt(price), duration_minutes: toInt(duration_minutes), is_active: is_active ?? true });
  for (const mid of master_ids ?? []) if (!masterHasService(mid, s.id)) db.data.master_services.push({ master_id: num(mid), service_id: s.id });
  await db.write();
  return s;
}
export async function updateService(id, body) {
  const old = byId('services', id);
  if (!old) return null;
  Object.assign(old, {
    category_id: body.category_id ?? old.category_id,
    name: body.name ?? old.name,
    description: body.description ?? old.description,
    price: body.price !== undefined ? toInt(body.price) : old.price,
    duration_minutes: body.duration_minutes !== undefined ? toInt(body.duration_minutes) : old.duration_minutes,
    is_active: body.is_active ?? old.is_active,
  });
  if (body.master_ids) {
    db.data.master_services = find('master_services', ms => !eq(ms.service_id, id));
    for (const mid of body.master_ids) db.data.master_services.push({ master_id: num(mid), service_id: num(id) });
  }
  await db.write();
  return structuredClone(old);
}
export async function deleteService(id) {
  db.data.services = find('services', s => !eq(s.id, id));
  db.data.master_services = find('master_services', ms => !eq(ms.service_id, id));
  await db.write();
}

// ------------------------------------------------------------------ settings: masters
export async function listAdminMasters() {
  return db.data.masters.map(m => {
    const u = userOf(m.user_id) ?? {};
    return { ...structuredClone(m), firstname: str(u.firstname ?? m.firstname), lastname: str(u.lastname ?? m.lastname), email: str(u.email), phone: str(u.phone), is_active: u.is_active !== false };
  });
}

// ------------------------------------------------------------------ clients (админ-список)
export async function listClients({ search } = {}) {
  const q = str(search).trim().toLowerCase();
  const bookingsByClient = {};
  for (const b of db.data.bookings) bookingsByClient[b.client_id] = (bookingsByClient[b.client_id] ?? 0) + 1;
  let rows = db.data.clients.map(c => {
    const u = userOf(c.user_id) ?? {};
    return {
      id: numOrNull(c.id),
      user_id: numOrNull(c.user_id),
      firstname: str(u.firstname),
      lastname: str(u.lastname),
      email: str(u.email),
      phone: str(u.phone),
      loyalty_balance: numOrNull(c.loyalty_balance) ?? 0,
      notes: c.notes == null ? null : str(c.notes),
      bookings_count: bookingsByClient[c.id] ?? 0,
      created_at: u.created_at ?? null,
    };
  });
  if (q) {
    rows = rows.filter(r =>
      `${r.firstname} ${r.lastname}`.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) || r.phone.includes(q));
  }
  return rows.sort((a, b) => a.id - b.id);
}
export async function updateMaster(id, body) {
  const m = byId('masters', id);
  if (!m) return null;
  Object.assign(m, { speciality: body.speciality ?? null, bio: body.bio ?? null, photo_url: body.photo_url ?? null });
  if (body.service_ids) {
    db.data.master_services = find('master_services', ms => !eq(ms.master_id, id));
    for (const sid of body.service_ids) db.data.master_services.push({ master_id: num(id), service_id: num(sid) });
  }
  await db.write();
  return structuredClone(m);
}

// schedules
export const getSchedules = (masterId) => find('schedules', s => eq(s.master_id, masterId));
export async function putSchedules(masterId, list) {
  db.data.schedules = find('schedules', s => !eq(s.master_id, masterId));
  for (const s of list ?? []) {
    db.data.schedules.push({ id: nextId('schedules'), master_id: num(masterId), day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, break_start: s.break_start ?? null, break_end: s.break_end ?? null });
  }
  await db.write();
  return getSchedules(masterId);
}

// exceptions
export const getExceptions = (masterId) => find('schedule_exceptions', e => eq(e.master_id, masterId));
export async function createException(masterId, body) {
  return insert('schedule_exceptions', {
    master_id: num(masterId), exception_date: body.exception_date, is_working: body.is_working ?? false,
    start_time: body.start_time ?? null, end_time: body.end_time ?? null, reason: body.reason ?? null,
  });
}
export async function deleteException(id) {
  db.data.schedule_exceptions = find('schedule_exceptions', e => !eq(e.id, id));
  await db.write();
}

// ------------------------------------------------------------------ staff
export async function createStaff({ role, firstname, lastname, email, phone, password_hash, speciality }) {
  const u = await createUser({ role, firstname, lastname: lastname ?? '', email: email || null, phone: phone || null, password_hash });
  if (role === 'master') await insert('masters', { user_id: u.id, speciality: speciality ?? null, bio: null, photo_url: null, rating_avg: 0 });
  return u;
}
