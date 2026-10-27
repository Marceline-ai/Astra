// Astra Salon — Backend API (Express)
// Публичные эндпоинты для сайта + защищённые для админки. ТЗ п.3.2, 4.x
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { z } from 'zod';
import { query, one, MODE_LABEL } from './db.js';
import { getFreeSlots, findConflict, getScheduleGrid, toDateStr, toMin, minToHHMM } from './schedule.js';
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

async function ensureClient({ firstname, lastname, phone, email }) {
  let c = await one(`SELECT c.* FROM clients c JOIN users u ON u.id=c.user_id WHERE u.phone=$1`, [phone]);
  if (!c && email) c = await one(`SELECT c.* FROM clients c JOIN users u ON u.id=c.user_id WHERE u.email=$1`, [email]);
  if (c) return c;
  const u = await one(
    `INSERT INTO users (role, firstname, lastname, phone, email, password_hash)
     VALUES ('client', $1,$2,$3,$4,'!') RETURNING id`,
    [firstname, lastname ?? '', phone, email || null]
  );
  c = await one(`INSERT INTO clients (user_id) VALUES ($1) RETURNING id`, [u.id]);
  return c;
}

function bookingStart(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00Z`); // храним как UTC, слоты считаются в UTC-минутах суток
}

async function buildBookingPayload(b) {
  const row = await one(
    `SELECT b.*, s.name AS service_name, s.duration_minutes, cat.name AS category_name,
            m.speciality, cu.firstname AS master_fn, cu.lastname AS master_ln, m.photo_url AS master_photo,
            uu.firstname AS client_fn, uu.lastname AS client_ln, uu.phone AS client_phone, uu.email AS client_email
     FROM bookings b
     JOIN services s ON s.id=b.service_id
     LEFT JOIN categories cat ON cat.id=s.category_id
     JOIN masters m ON m.id=b.master_id
     JOIN users cu ON cu.id=m.user_id
     JOIN clients cl ON cl.id=b.client_id
     JOIN users uu ON uu.id=cl.user_id
     WHERE b.id=$1`, [b.id]);
  return row;
}

// ================================================================ PUBLIC API
// Категории + услуги (для карточек услуг и dropdown «Услуга»)
app.get('/api/public/categories', async (_req, res) => {
  res.json(await query(`SELECT * FROM categories ORDER BY sort_order`));
});

app.get('/api/public/services', async (_req, res) => {
  res.json(await query(
    `SELECT s.*, s.category_id FROM services s WHERE s.is_active=TRUE ORDER BY s.category_id, s.name`));
});

// Мастера для карточек «Наши мастера»
app.get('/api/public/masters', async (_req, res) => {
  res.json(await query(
    `SELECT m.id, u.firstname, u.lastname, m.speciality, m.bio, m.photo_url, m.rating_avg
     FROM masters m JOIN users u ON u.id=m.user_id WHERE u.is_active=TRUE ORDER BY m.id`));
});

// Dropdown «Мастер» зависит от выбранной «Услуги» (ТЗ п.3.2)
app.get('/api/public/masters-for-service/:serviceId', async (req, res) => {
  res.json(await query(
    `SELECT m.id, u.firstname, u.lastname, m.speciality, m.photo_url
     FROM master_services ms JOIN masters m ON m.id=ms.master_id JOIN users u ON u.id=m.user_id
     WHERE ms.service_id=$1 AND u.is_active=TRUE`, [req.params.serviceId]));
});

// Свободные слоты (Time picker показывает только свободные)
app.get('/api/public/slots', async (req, res) => {
  const svc = await one(`SELECT duration_minutes FROM services WHERE id=$1 AND is_active=TRUE`, [req.query.service_id]);
  if (!svc) return res.status(404).json({ error: 'service_not_found' });
  const now = new Date();
  const todayStr = toDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
  const nowMin = req.query.date === todayStr ? now.getUTCHours()*60 + now.getUTCMinutes() : -1;
  const slots = await getFreeSlots(+req.query.master_id, req.query.date, svc.duration_minutes, nowMin);
  res.json({ slots });
});

// Создание клиентской записи
app.post('/api/public/bookings', async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    const map = {};
    for (const i of parsed.error.issues) map[i.path[0]] = i.message;
    return res.status(422).json({ error: 'validation', fields: map, message: 'Проверьте обязательные поля' });
  }
  const d = parsed.data;
  const svc = await one(`SELECT * FROM services WHERE id=$1 AND is_active=TRUE`, [d.service_id]);
  if (!svc) return res.status(422).json({ error: 'service_not_found' });
  const okRel = await one(`SELECT 1 AS x FROM master_services WHERE master_id=$1 AND service_id=$2`, [d.master_id, d.service_id]);
  if (!okRel) return res.status(422).json({ error: 'master_unavailable_for_service', message: 'Мастер не выполняет эту услугу' });

  const start = bookingStart(d.date, d.time);
  const end = new Date(start.getTime() + svc.duration_minutes * 60000);

  // Проверка занятости (ТЗ: выводить понятную ошибку)
  const conflict = await findConflict(d.master_id, start, end);
  if (conflict) return res.status(409).json({
    error: 'slot_taken',
    message: 'Это время уже занято мастером. Пожалуйста, выберите другой слот.',
  });
  // Валидация по расписанию мастера
  const free = await getFreeSlots(d.master_id, d.date, svc.duration_minutes, -1);
  if (!free.includes(d.time)) {
    return res.status(409).json({ error: 'outside_schedule', message: 'Мастер не работает в это время или слот недоступен.' });
  }

  const client = await ensureClient(d);
  const b = await one(
    `INSERT INTO bookings (client_id, master_id, service_id, start_at, end_at, status, total_price, source)
     VALUES ($1,$2,$3,$4,$5,'pending',$6,'web') RETURNING *`,
    [client.id, d.master_id, d.service_id, start, end, svc.price]
  );
  res.status(201).json({
    ok: true,
    message: 'Спасибо! Мы свяжемся с вами для подтверждения',
    booking: await buildBookingPayload(b),
  });
});

// ================================================================ ADMIN API
app.post('/api/admin/login', async (req, res) => {
  const { login, password } = req.body ?? {};
  if (!login || !password) return res.status(422).json({ error: 'validation', message: 'Введите логин и пароль' });
  const key = String(login).trim().toLowerCase();
  if (await checkBruteForce(key)) {
    return res.status(423).json({ error: 'locked', message: 'Слишком много попыток. Повторите через 15 минут.' });
  }
  const u = await verifyCredentials(key, password);
  if (!u || !ROLES_STAFF.includes(u.role)) {
    await recordAttempt(key, req.ip, false);
    return res.status(401).json({ error: 'bad_credentials', message: 'Неверный логин или пароль' });
  }
  await recordAttempt(key, req.ip, true);
  const token = signToken(u);
  res.cookie('astra_token', token, { httpOnly: true, sameSite: 'lax', secure: !!process.env.COOKIE_SECURE, maxAge: 8*3600*1000 });
  res.json({ ok: true, user: { id: u.id, name: `${u.firstname} ${u.lastname}`, role: u.role, email: u.email } });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('astra_token');
  res.json({ ok: true });
});

app.get('/api/admin/me', authMiddleware, async (req, res) => {
  const u = await one(`SELECT id, role, firstname, lastname, email, avatar_url FROM users WHERE id=$1`, [req.user.sub]);
  res.json(u);
});

const A = [authMiddleware, requireRole(...ROLES_STAFF)];

// Дашборд KPI (как в макете: Scheduled / Masters / Waitlist(pending) / Confirmed %)
app.get('/api/admin/dashboard', ...A, async (_req, res) => {
  const today = toDateStr(new Date());
  const sched = (await query(`SELECT id FROM bookings WHERE status IN ('pending','confirmed') AND start_at >= $1`, [today])).length;
  const masters = (await query(`SELECT id FROM masters`)).length;
  const pending = (await query(`SELECT id FROM bookings WHERE status='pending'`)).length;
  const all = (await query(`SELECT status FROM bookings`));
  const confirmedShare = all.length ? Math.round(100 * all.filter(b => ['confirmed','completed'].includes(b.status)).length / all.length) : 0;
  const recent = await query(
    `SELECT b.id, b.start_at, b.status, s.name AS service_name,
            cu.firstname||' '||cu.lastname AS master_name, uu.firstname||' '||uu.lastname AS client_name, uu.phone AS client_phone
     FROM bookings b JOIN services s ON s.id=b.service_id JOIN masters m ON m.id=b.master_id
     JOIN users cu ON cu.id=m.user_id JOIN clients cl ON cl.id=b.client_id JOIN users uu ON uu.id=cl.user_id
     ORDER BY b.created_at DESC LIMIT 10`);
  res.json({ scheduled: sched, masters, waitlist: pending, confirmed_share: confirmedShare, recent });
});

// Список записей с фильтрами: дата, мастер, статус (ТЗ п.4.3)
app.get('/api/admin/bookings', ...A, async (req, res) => {
  const conds = [], params = [];
  if (req.query.date) { conds.push(`b.start_at >= $${params.length+1} AND b.start_at < $${params.length+2}`);
    params.push(req.query.date, new Date(new Date(req.query.date+'T00:00:00Z').getTime()+864e5)); }
  if (req.query.master_id) { conds.push(`b.master_id = $${params.length+1}`); params.push(req.query.master_id); }
  if (req.query.status) { conds.push(`b.status = $${params.length+1}`); params.push(req.query.status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = await query(
    `SELECT b.*, s.name AS service_name, s.duration_minutes,
            cu.firstname AS master_fn, cu.lastname AS master_ln,
            uu.firstname AS client_fn, uu.lastname AS client_ln, uu.phone AS client_phone, uu.email AS client_email
     FROM bookings b JOIN services s ON s.id=b.service_id
     JOIN masters m ON m.id=b.master_id JOIN users cu ON cu.id=m.user_id
     JOIN clients cl ON cl.id=b.client_id JOIN users uu ON uu.id=cl.user_id
     ${where} ORDER BY b.start_at DESC LIMIT 200`, params);
  res.json(rows);
});

app.get('/api/admin/bookings/:id', ...A, async (req, res) => {
  const b = await one(`SELECT * FROM bookings WHERE id=$1`, [req.params.id]);
  if (!b) return res.status(404).json({ error: 'not_found' });
  res.json(await buildBookingPayload(b));
});

// Ручное создание записи админом (ТЗ п.4.5): force + комментарий + скидка/предоплата
app.post('/api/admin/bookings', ...A, async (req, res) => {
  const parsed = adminBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    const map = {}; for (const i of parsed.error.issues) map[i.path[0]] = i.message;
    return res.status(422).json({ error: 'validation', fields: map });
  }
  const d = parsed.data;
  const svc = await one(`SELECT * FROM services WHERE id=$1`, [d.service_id]);
  if (!svc) return res.status(422).json({ error: 'service_not_found' });
  const start = bookingStart(d.date, d.time);
  const end = new Date(start.getTime() + svc.duration_minutes * 60000);
  const conflict = await findConflict(d.master_id, start, end);
  if (conflict && !d.force) {
    return res.status(409).json({ error: 'slot_taken', conflict_booking_id: conflict.id,
      message: 'Время занято. Подтвердите создание поверх занятого слота (force=true).' });
  }
  const client = await ensureClient(d);
  const price = Number(svc.price) * (1 - d.discount_percent / 100);
  const b = await one(
    `INSERT INTO bookings (client_id, master_id, service_id, start_at, end_at, status, total_price,
                           comment, discount_percent, is_prepaid, source)
     VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,'admin') RETURNING *`,
    [client.id, d.master_id, d.service_id, start, end, price.toFixed(2), d.comment ?? null, d.discount_percent, d.is_prepaid]
  );
  res.status(201).json({ ok: true, warning: conflict ? 'Создано поверх занятого слота' : null, booking: await buildBookingPayload(b) });
});

// Изменение статуса / удаление (ТЗ п.4.3)
app.patch('/api/admin/bookings/:id', ...A, async (req, res) => {
  const allowed = ['status','comment','discount_percent','is_prepaid'];
  const sets = [], params = [];
  for (const k of allowed) if (k in (req.body ?? {})) {
    if (k === 'status' && !['pending','confirmed','completed','canceled','no_show'].includes(req.body[k]))
      return res.status(422).json({ error: 'bad_status' });
    sets.push(`${k} = $${params.length+1}`); params.push(req.body[k]);
  }
  if (!sets.length) return res.status(422).json({ error: 'nothing_to_update' });
  sets.push(`updated_at = now()`);
  params.push(req.params.id);
  const b = await one(`UPDATE bookings SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING *`, params);
  if (!b) return res.status(404).json({ error: 'not_found' });
  res.json(await buildBookingPayload(b));
});

app.delete('/api/admin/bookings/:id', ...A, async (req, res) => {
  const b = await one(`DELETE FROM bookings WHERE id=$1 RETURNING id`, [req.params.id]);
  if (!b) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Расписание-календарь (ТЗ п.4.4): мастера × время на дату
app.get('/api/admin/schedule', ...A, async (req, res) => {
  const date = req.query.date || toDateStr(new Date());
  const masters = await query(
    `SELECT m.id, u.firstname, u.lastname, m.speciality, m.photo_url FROM masters m JOIN users u ON u.id=m.user_id WHERE u.is_active=TRUE`);
  const grid = await getScheduleGrid(date, masters);
  const bookings = await query(
    `SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id
     WHERE b.start_at >= $1 AND b.start_at < $2 AND b.status <> 'canceled'`,
    [date, new Date(new Date(date+'T00:00:00Z').getTime()+864e5)]);
  res.json({ date, grid, bookings });
});

// ================================================= SETTINGS (справочники, ТЗ п.4.6)
app.get('/api/admin/settings/categories', ...A, async (_r,res)=> res.json(await query(`SELECT * FROM categories ORDER BY sort_order`)));
app.post('/api/admin/settings/categories', ...A, async (req,res)=>{
  const c = await one(`INSERT INTO categories (name, description, image_url, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.body.name, req.body.description ?? null, req.body.image_url ?? null, req.body.sort_order ?? 0]);
  res.status(201).json(c);
});
app.patch('/api/admin/settings/categories/:id', ...A, async (req,res)=>{
  const c = await one(`UPDATE categories SET name=$2, description=$3, image_url=$4, sort_order=$5 WHERE id=$1 RETURNING *`,
    [req.params.id, req.body.name, req.body.description ?? null, req.body.image_url ?? null, req.body.sort_order ?? 0]);
  if (!c) return res.status(404).json({error:'not_found'}); res.json(c);
});
app.delete('/api/admin/settings/categories/:id', ...A, async (req,res)=>{
  await query(`DELETE FROM categories WHERE id=$1`, [req.params.id]); res.json({ok:true});
});

app.get('/api/admin/settings/services', ...A, async (_r,res)=> res.json(await query(`SELECT * FROM services ORDER BY category_id, name`)));
app.post('/api/admin/settings/services', ...A, async (req,res)=>{
  const s = await one(`INSERT INTO services (category_id,name,description,price,duration_minutes,is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.body.category_id ?? null, req.body.name, req.body.description ?? null, req.body.price, req.body.duration_minutes, req.body.is_active ?? true]);
  // связать с мастерами
  for (const mid of req.body.master_ids ?? []) await query(`INSERT INTO master_services (master_id, service_id) VALUES ($1,$2)`, [mid, s.id]).catch(()=>{});
  res.status(201).json(s);
});
app.patch('/api/admin/settings/services/:id', ...A, async (req,res)=>{
  const old = await one(`SELECT * FROM services WHERE id=$1`, [req.params.id]);
  if (!old) return res.status(404).json({error:'not_found'});
  const s = await one(`UPDATE services SET category_id=$2,name=$3,description=$4,price=$5,duration_minutes=$6,is_active=$7 WHERE id=$1 RETURNING *`,
    [req.params.id, req.body.category_id ?? old.category_id, req.body.name ?? old.name, req.body.description ?? old.description,
     req.body.price ?? old.price, req.body.duration_minutes ?? old.duration_minutes, req.body.is_active ?? old.is_active]);
  if (req.body.master_ids) {
    await query(`DELETE FROM master_services WHERE service_id=$1`, [req.params.id]);
    for (const mid of req.body.master_ids) await query(`INSERT INTO master_services (master_id, service_id) VALUES ($1,$2)`, [mid, s.id]).catch(()=>{});
  }
  res.json(s);
});
app.delete('/api/admin/settings/services/:id', ...A, async (req,res)=>{
  await query(`DELETE FROM services WHERE id=$1`, [req.params.id]); res.json({ok:true});
});

app.get('/api/admin/settings/masters', ...A, async (_r,res)=> res.json(await query(
  `SELECT m.*, u.firstname, u.lastname, u.email, u.phone, u.is_active FROM masters m JOIN users u ON u.id=m.user_id`)));
app.patch('/api/admin/settings/masters/:id', ...A, async (req,res)=>{
  const m = await one(`UPDATE masters SET speciality=$2, bio=$3, photo_url=$4 WHERE id=$1 RETURNING *`,
    [req.params.id, req.body.speciality ?? null, req.body.bio ?? null, req.body.photo_url ?? null]);
  if (!m) return res.status(404).json({error:'not_found'});
  if (req.body.service_ids) {
    await query(`DELETE FROM master_services WHERE master_id=$1`, [req.params.id]);
    for (const sid of req.body.service_ids) await query(`INSERT INTO master_services (master_id, service_id) VALUES ($1,$2)`, [req.params.id, sid]).catch(()=>{});
  }
  res.json(m);
});
// График работы мастера
app.get('/api/admin/settings/masters/:id/schedules', ...A, async (req,res)=>
  res.json(await query(`SELECT * FROM schedules WHERE master_id=$1`, [req.params.id])));
app.put('/api/admin/settings/masters/:id/schedules', ...A, async (req,res)=>{
  await query(`DELETE FROM schedules WHERE master_id=$1`, [req.params.id]);
  for (const s of req.body.schedules ?? [])
    await query(`INSERT INTO schedules (master_id, day_of_week, start_time, end_time, break_start, break_end) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, s.day_of_week, s.start_time, s.end_time, s.break_start ?? null, s.break_end ?? null]);
  res.json(await query(`SELECT * FROM schedules WHERE master_id=$1`, [req.params.id]));
});
// Исключения
app.get('/api/admin/settings/masters/:id/exceptions', ...A, async (req,res)=>
  res.json(await query(`SELECT * FROM schedule_exceptions WHERE master_id=$1`, [req.params.id])));
app.post('/api/admin/settings/masters/:id/exceptions', ...A, async (req,res)=>{
  const e = await one(`INSERT INTO schedule_exceptions (master_id, exception_date, is_working, start_time, end_time, reason)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.id, req.body.exception_date, req.body.is_working ?? false, req.body.start_time ?? null, req.body.end_time ?? null, req.body.reason ?? null]);
  res.status(201).json(e);
});
app.delete('/api/admin/settings/exceptions/:id', ...A, async (req,res)=>{
  await query(`DELETE FROM schedule_exceptions WHERE id=$1`, [req.params.id]); res.json({ok:true});
});

// Управление сотрудниками (права: super_admin)
app.post('/api/admin/settings/staff', authMiddleware, requireRole('super_admin','admin'), async (req,res)=>{
  const { role, firstname, lastname, email, phone, password } = req.body;
  if (!['manager','admin','super_admin','master'].includes(role)) return res.status(422).json({error:'bad_role'});
  const hash = await hashPassword(password || 'changeme');
  const u = await one(`INSERT INTO users (role, firstname, lastname, email, phone, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [role, firstname, lastname ?? '', email || null, phone || null, hash]);
  if (role === 'master') await one(`INSERT INTO masters (user_id, speciality) VALUES ($1,$2)`, [u.id, req.body.speciality ?? null]);
  res.status(201).json({ id: u.id });
});

app.get('/health', (_req,res)=> res.json({ ok:true, db: MODE_LABEL }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Astra API on :${PORT} (db=${MODE_LABEL})`));
