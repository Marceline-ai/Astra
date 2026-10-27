// Astra Salon — Backend API (Express + json-server/lowdb в качестве БД)
// Миграция с PostgreSQL/pg-mem: данные хранятся в backend/db/db.json
// (формат совместим с json-server: npx json-server --watch db/db.json).
// Публичные эндпоинты для сайта + защищённые для админки. ТЗ п.3.2, 4.x
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { z } from 'zod';
import * as repo from './repo.js';
import { toDateStr } from './repo.js';
import { signToken, authMiddleware, requireRole, verifyCredentials, recordAttempt, checkBruteForce, hashPassword, ROLES_STAFF } from './auth.js';

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------- helpers
const phoneRe = /^\+?[0-9()\-\s]{7,20}$/;

const bookingSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  master_id: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstname: z.string().trim().min(1).max(50),
  phone: z.string().trim().regex(phoneRe, 'invalid phone'),
  lastname: z.string().trim().max(50).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
});

const adminBookingSchema = bookingSchema.extend({
  comment: z.string().max(1000).optional(),
  discount_percent: z.coerce.number().int().min(0).max(100).optional().default(0),
  is_prepaid: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false), // админ может занять занятое время (с предупреждением)
});

function validationError(parsed) {
  const map = {};
  for (const i of parsed.error.issues) map[i.path[0]] = i.message;
  return map;
}

function bookingStart(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00Z`); // храним как UTC ISO-строки, слоты считаются в UTC-минутах суток
}

async function buildBookingPayload(b) {
  return repo.getBookingPayload(b.id);
}

// ================================================================ PUBLIC API
// Категории + услуги (для карточек услуг и dropdown «Услуга»)
app.get('/api/public/categories', async (_req, res) => {
  res.json(await repo.listCategories());
});

app.get('/api/public/services', async (_req, res) => {
  res.json(await repo.listServices());
});

// Мастера для карточек «Наши мастера»
app.get('/api/public/masters', async (_req, res) => {
  res.json(await repo.listPublicMasters());
});

// Клиенты (база после миграции на json-server содержала коллекцию clients,
// но эндпоинт был потерян — фронтент не получал данные).
app.get('/api/public/clients', async (_req, res) => {
  res.json(await repo.listClients());
});

// Dropdown «Мастер» зависит от выбранной «Услуги» (ТЗ п.3.2)
app.get('/api/public/masters-for-service/:serviceId', async (req, res) => {
  res.json(await repo.mastersForService(req.params.serviceId));
});

// Свободные слоты (Time picker показывает только свободные)
app.get('/api/public/slots', async (req, res) => {
  const svc = await repo.getActiveService(req.query.service_id);
  if (!svc) return res.status(404).json({ error: 'service_not_found' });
  const now = new Date();
  const todayStr = toDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
  const nowMin = req.query.date === todayStr ? now.getUTCHours() * 60 + now.getUTCMinutes() : -1;
  const slots = await repo.getFreeSlots(+req.query.master_id, req.query.date, svc.duration_minutes, nowMin);
  res.json({ slots });
});

// Создание клиентской записи
app.post('/api/public/bookings', async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: 'validation', fields: validationError(parsed), message: 'Проверьте обязательные поля' });
  }
  const d = parsed.data;
  const svc = await repo.getActiveService(d.service_id);
  if (!svc) return res.status(422).json({ error: 'service_not_found' });
  if (!repo.masterHasService(d.master_id, d.service_id)) {
    return res.status(422).json({ error: 'master_unavailable_for_service', message: 'Мастер не выполняет эту услугу' });
  }

  const start = bookingStart(d.date, d.time);
  const end = new Date(start.getTime() + svc.duration_minutes * 60000);

  // Проверка занятости (ТЗ: выводить понятную ошибку)
  const conflict = await repo.findConflict(d.master_id, start, end);
  if (conflict) return res.status(409).json({
    error: 'slot_taken',
    message: 'Это время уже занято мастером. Пожалуйста, выберите другой слот.',
  });
  // Валидация по расписанию мастера
  const free = await repo.getFreeSlots(d.master_id, d.date, svc.duration_minutes, -1);
  if (!free.includes(d.time)) {
    return res.status(409).json({ error: 'outside_schedule', message: 'Мастер не работает в это время или слот недоступен.' });
  }

  const client = await repo.ensureClient(d);
  const b = await repo.createBooking({
    client_id: client.id, master_id: d.master_id, service_id: d.service_id,
    start_at: start.toISOString(), end_at: end.toISOString(),
    status: 'pending', total_price: svc.price, source: 'web',
  });
  res.status(201).json({
    ok: true,
    message: 'Спасибо! Мы свяжемся с вами для подтверждения',
    booking: await buildBookingPayload(b),
  });
});

// ================================================================ ADMIN API

// CORS для standalone-режима: фронтенд (vite :5173 / статика) может обращаться
// к API напрямую, а не только через прокси. Credentials обязателен —
// авторизация через httpOnly-cookie.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Совместимость со старым путём авторизации (/api/auth/login):
// админка или старый билд могли ходить именно сюда — теперь это алиас на /api/admin/login.
app.post('/api/auth/login', (req, res, next) => {
  const body = req.body ?? {};
  if (body.login === undefined && body.email !== undefined) req.body = { ...body, login: body.email };
  next();
}, app.handle ? undefined : undefined);
app.post('/api/admin/login', async (req, res) => {
  const { login, password } = req.body ?? {};
  if (!login || !password) return res.status(422).json({ error: 'validation', message: 'Введите логин и пароль' });
  const key = String(login).trim().toLowerCase();
  if (await repo.checkBruteForce(key)) {
    return res.status(423).json({ error: 'locked', message: 'Слишком много попыток. Повторите через 15 минут.' });
  }
  const u = await verifyCredentials(key, password);
  if (!u || !ROLES_STAFF.includes(u.role)) {
    await repo.recordAttempt(key, req.ip, false);
    return res.status(401).json({ error: 'bad_credentials', message: 'Неверный логин или пароль' });
  }
  await repo.recordAttempt(key, req.ip, true);
  const token = signToken(u);
  res.cookie('astra_token', token, { httpOnly: true, sameSite: 'lax', secure: !!process.env.COOKIE_SECURE, maxAge: 8 * 3600 * 1000 });
  res.json({ ok: true, user: { id: u.id, name: `${u.firstname} ${u.lastname}`, role: u.role, email: u.email } });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('astra_token');
  res.json({ ok: true });
});

app.get('/api/admin/me', authMiddleware, async (req, res) => {
  const u = await repo.getUserById(req.user.sub);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const { id, role, firstname, lastname, email, avatar_url } = u;
  res.json({ id, role, firstname, lastname, email, avatar_url });
});

const A = [authMiddleware, requireRole(...ROLES_STAFF)];

// Дашборд KPI (как в макете: Scheduled / Masters / Waitlist(pending) / Confirmed %)
app.get('/api/admin/dashboard', ...A, async (_req, res) => {
  res.json(await repo.getDashboard());
});

// Список записей с фильтрами: дата, мастер, статус (ТЗ п.4.3)
app.get('/api/admin/bookings', ...A, async (req, res) => {
  res.json(await repo.listBookings({ date: req.query.date, master_id: req.query.master_id, status: req.query.status }));
});

app.get('/api/admin/bookings/:id', ...A, async (req, res) => {
  const b = await repo.getBooking(req.params.id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  res.json(await buildBookingPayload(b));
});

// Ручное создание записи админом (ТЗ п.4.5): force + комментарий + скидка/предоплата
app.post('/api/admin/bookings', ...A, async (req, res) => {
  const parsed = adminBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'validation', fields: validationError(parsed) });
  const d = parsed.data;
  const svc = await repo.getService(d.service_id);
  if (!svc) return res.status(422).json({ error: 'service_not_found' });
  const start = bookingStart(d.date, d.time);
  const end = new Date(start.getTime() + svc.duration_minutes * 60000);
  const conflict = await repo.findConflict(d.master_id, start, end);
  if (conflict && !d.force) {
    return res.status(409).json({
      error: 'slot_taken', conflict_booking_id: conflict.id,
      message: 'Время занято. Подтвердите создание поверх занятого слота (force=true).',
    });
  }
  const client = await repo.ensureClient(d);
  const price = Math.round(Number(svc.price) * (1 - d.discount_percent / 100) * 100) / 100;
  const b = await repo.createBooking({
    client_id: client.id, master_id: d.master_id, service_id: d.service_id,
    start_at: start.toISOString(), end_at: end.toISOString(),
    status: 'pending', total_price: price,
    comment: d.comment ?? null, discount_percent: d.discount_percent, is_prepaid: d.is_prepaid,
    source: 'admin',
  });
  res.status(201).json({ ok: true, warning: conflict ? 'Создано поверх занятого слота' : null, booking: await buildBookingPayload(b) });
});

// Изменение статуса / удаление (ТЗ п.4.3)
app.patch('/api/admin/bookings/:id', ...A, async (req, res) => {
  const allowed = ['status', 'comment', 'discount_percent', 'is_prepaid'];
  const patch = {};
  for (const k of allowed) if (k in (req.body ?? {})) {
    if (k === 'status' && !['pending', 'confirmed', 'completed', 'canceled', 'no_show'].includes(req.body[k]))
      return res.status(422).json({ error: 'bad_status' });
    patch[k] = req.body[k];
  }
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'nothing_to_update' });
  const b = await repo.updateBooking(req.params.id, patch);
  if (!b) return res.status(404).json({ error: 'not_found' });
  res.json(b);
});

app.delete('/api/admin/bookings/:id', ...A, async (req, res) => {
  const ok = await repo.deleteBooking(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Расписание-календарь (ТЗ п.4.4): мастера × время на дату
app.get('/api/admin/schedule', ...A, async (req, res) => {
  const date = req.query.date || toDateStr(new Date());
  res.json(await repo.getAdminSchedule(date));
});

// ================================================= SETTINGS (справочники, ТЗ п.4.6)
app.get('/api/admin/settings/categories', ...A, async (_r, res) => res.json(await repo.listCategories()));
app.post('/api/admin/settings/categories', ...A, async (req, res) => {
  const c = await repo.createCategory(req.body ?? {});
  res.status(201).json(c);
});
app.patch('/api/admin/settings/categories/:id', ...A, async (req, res) => {
  const c = await repo.updateCategory(req.params.id, req.body ?? {});
  if (!c) return res.status(404).json({ error: 'not_found' });
  res.json(c);
});
app.delete('/api/admin/settings/categories/:id', ...A, async (req, res) => {
  await repo.deleteCategory(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/settings/services', ...A, async (_r, res) => res.json(await repo.listServices()));
app.post('/api/admin/settings/services', ...A, async (req, res) => {
  const s = await repo.createService(req.body ?? {});
  res.status(201).json(s);
});
app.patch('/api/admin/settings/services/:id', ...A, async (req, res) => {
  const s = await repo.updateService(req.params.id, req.body ?? {});
  if (!s) return res.status(404).json({ error: 'not_found' });
  res.json(s);
});
app.delete('/api/admin/settings/services/:id', ...A, async (req, res) => {
  await repo.deleteService(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/settings/masters', ...A, async (_r, res) => res.json(await repo.listAdminMasters()));
app.patch('/api/admin/settings/masters/:id', ...A, async (req, res) => {
  const m = await repo.updateMaster(req.params.id, req.body ?? {});
  if (!m) return res.status(404).json({ error: 'not_found' });
  res.json(m);
});
// График работы мастера
app.get('/api/admin/settings/masters/:id/schedules', ...A, async (req, res) =>
  res.json(repo.getSchedules(req.params.id)));
app.put('/api/admin/settings/masters/:id/schedules', ...A, async (req, res) => {
  res.json(await repo.putSchedules(req.params.id, req.body?.schedules ?? []));
});
// Исключения
app.get('/api/admin/settings/masters/:id/exceptions', ...A, async (req, res) =>
  res.json(repo.getExceptions(req.params.id)));
app.post('/api/admin/settings/masters/:id/exceptions', ...A, async (req, res) => {
  const e = await repo.createException(req.params.id, req.body ?? {});
  res.status(201).json(e);
});
app.delete('/api/admin/settings/exceptions/:id', ...A, async (req, res) => {
  await repo.deleteException(req.params.id);
  res.json({ ok: true });
});

// Управление сотрудниками (права: super_admin)
app.post('/api/admin/settings/staff', authMiddleware, requireRole('super_admin', 'admin'), async (req, res) => {
  const { role, firstname, lastname, email, phone, password } = req.body;
  if (!['manager', 'admin', 'super_admin', 'master'].includes(role)) return res.status(422).json({ error: 'bad_role' });
  const hash = await hashPassword(password || 'changeme');
  const u = await repo.createStaff({ role, firstname, lastname, email, phone, password_hash: hash, speciality: req.body.speciality ?? null });
  res.status(201).json({ id: u.id });
});

app.get('/health', (_req, res) => res.json({ ok: true, db: repo.MODE_LABEL }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Astra API on :${PORT} (db=${repo.MODE_LABEL}, file=${repo.DB_FILE})`));
