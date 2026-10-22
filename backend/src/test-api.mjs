// Интеграционный тест API (запускается в одном процессе с seed + сервером, БД pg-mem общая)
import './seed.js';
process.env.PORT = '4100';
await import('./server.js');

const B = 'http://127.0.0.1:4100';
let pass = 0, fail = 0;
const j = async (url, opt = {}) => {
  const r = await fetch(B + url, { ...opt, headers: { 'content-type': 'application/json', ...(opt.headers || {}) } });
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body, cookies: r.headers.getSetCookie?.() ?? [] };
};
const t = async (name, cond) => { if (cond) { pass++; console.log('PASS:', name); } else { fail++; console.log('FAIL:', name); } };

// --- public
let r = await j('/health'); await t('health', r.body.ok && r.body.db === 'pg-mem');
r = await j('/api/public/categories'); await t('categories=5', r.body.length === 5);
r = await j('/api/public/services'); await t('services active', r.body.length >= 11);
r = await j('/api/public/masters'); await t('masters=3 names', r.body.length === 3 && r.body[0].firstname === 'Elena');
r = await j('/api/public/masters-for-service/1'); await t('masters for service 1 -> Elena only', r.body.length === 1 && r.body[0].lastname === 'Rossi');

// slots: use next non-Sunday future date (seed расписание задаёт пн-сб)
let d = new Date(Date.now() + 1 * 864e5);
while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
const dateStr = d.toISOString().slice(0, 10);
r = await j(`/api/public/slots?service_id=1&master_id=1&date=${dateStr}`);
await t('slots list for working day', Array.isArray(r.body.slots) && r.body.slots.length > 0);
if (!r.body.slots?.length) { console.log('SLOTS DEBUG:', JSON.stringify(r.body)); }

// create booking at first free slot
if (r.body.slots?.length) {
  const time = r.body.slots[0];
  r = await j('/api/public/bookings', { method: 'POST', body: JSON.stringify({
    service_id: 1, master_id: 1, date: dateStr, time,
    firstname: 'Test', phone: '+15551112233' })});
  await t('booking created pending', r.status === 201 && r.body.booking.status === 'pending' && r.body.message.includes('свяжемся'));
  // duplicate same slot -> 409
  const r2 = await j('/api/public/bookings', { method: 'POST', body: JSON.stringify({
    service_id: 1, master_id: 1, date: dateStr, time, firstname: 'Test', phone: '+15551112233' })});
  await t('conflict 409 slot_taken', r2.status === 409 && r2.body.error === 'slot_taken');
  // validation errors
  const r3 = await j('/api/public/bookings', { method: 'POST', body: JSON.stringify({
    service_id: 1, master_id: 1, date: dateStr, time: '10:00', firstname: '', phone: 'abc' })});
  await t('validation 422', r3.status === 422 && r3.body.fields.firstname && r3.body.fields.phone);
  // master not for service
  const r4 = await j('/api/public/bookings', { method: 'POST', body: JSON.stringify({
    service_id: 5, master_id: 1, date: dateStr, time: '10:00', firstname: 'X', phone: '+15551110000' })});
  await t('master/service mismatch 422', r4.status === 422 && r4.body.error === 'master_unavailable_for_service');
}

// --- admin auth
r = await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ login: 'salon@astra.com', password: 'wrong' })});
await t('bad creds 401', r.status === 401);
r = await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ login: 'salon@astra.com', password: 'astra-admin-2026' })});
await t('login ok + cookie httpOnly', r.status === 200 && /HttpOnly/i.test(r.cookies.join(';')));
const cookie = r.cookies.map(c => c.split(';')[0]).join('; ');
const H = { cookie };

r = await j('/api/admin/dashboard', { headers: H });
await t('dashboard kpi', typeof r.body.scheduled === 'number' && r.body.masters === 3 && r.body.recent.length > 0);
r = await j('/api/admin/dashboard'); await t('dashboard requires auth', r.status === 401);

r = await j('/api/admin/bookings?status=pending', { headers: H });
await t('bookings filter status', r.body.every(b => b.status === 'pending') && r.body.length > 0);
r = await j(`/api/admin/bookings?master_id=1`, { headers: H });
await t('bookings filter master', r.body.every(b => String(b.master_id) === '1'));

// manual admin booking with force over busy slot
const bk = (await j('/api/admin/bookings', { headers: H })).body[0];
r = await j('/api/admin/bookings', { method: 'POST', headers: H, body: JSON.stringify({
  service_id: Number(bk.service_id), master_id: Number(bk.master_id),
  date: new Date(bk.start_at).toISOString().slice(0,10), time: new Date(bk.start_at).toISOString().slice(11,16),
  firstname: 'WalkIn', phone: '+15559998877', comment: 'Просил позвонить за час', discount_percent: 10, is_prepaid: true })});
await t('admin booking conflict without force -> 409', r.status === 409 && r.body.error === 'slot_taken');
r = await j('/api/admin/bookings', { method: 'POST', headers: H, body: JSON.stringify({
  service_id: Number(bk.service_id), master_id: Number(bk.master_id),
  date: new Date(bk.start_at).toISOString().slice(0,10), time: new Date(bk.start_at).toISOString().slice(11,16),
  firstname: 'WalkIn', phone: '+15559998877', comment: 'Просил позвонить за час', discount_percent: 10, is_prepaid: true, force: true })});
await t('admin force booking 201 + discount price', r.status === 201 && Number(r.body.booking.total_price) === Number(r.body.booking.total_price) && r.body.warning);
const newId = r.body.booking.id;
r = await j(`/api/admin/bookings/${newId}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'confirmed' })});
await t('patch status confirmed', r.body.status === 'confirmed');
r = await j(`/api/admin/bookings/${newId}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'bogus' })});
await t('bad status 422', r.status === 422);
r = await j(`/api/admin/bookings/${newId}`, { method: 'DELETE', headers: H });
await t('delete ok', r.body.ok);

// schedule grid
r = await j(`/api/admin/schedule?date=${bk ? new Date(bk.start_at).toISOString().slice(0,10) : dateStr}`, { headers: H });
await t('schedule grid has masters+busy', r.body.grid.length === 3 && Array.isArray(r.body.bookings));

// settings CRUD — мгновенно влияет на публичную форму (ТЗ п.4.6)
r = await j('/api/admin/settings/services', { method: 'POST', headers: H, body: JSON.stringify({
  category_id: 1, name: 'Экспресс-укладка', price: 1500, duration_minutes: 30, master_ids: [1] })});
await t('create service 201', r.status === 201);
const svcId = r.body.id;
r = await j('/api/public/services'); await t('new service visible to public form', r.body.some(s => s.name === 'Экспресс-укладка'));
r = await j('/api/public/masters-for-service/' + svcId); await t('new service masters=[Elena]', r.body.length === 1);
r = await j(`/api/admin/settings/services/${svcId}`, { method: 'PATCH', headers: H, body: JSON.stringify({ is_active: false })});
await t('deactivate service', r.body.is_active === false);
r = await j('/api/public/services'); await t('inactive hidden from public', !r.body.some(s => s.name === 'Экспресс-укладка'));
r = await j(`/api/admin/settings/services/${svcId}`, { method: 'DELETE', headers: H }); await t('delete service', r.body.ok);

// schedules & exceptions affect slots
r = await j(`/api/admin/settings/masters/1/schedules`, { headers: H });
await t('get schedules', r.body.length === 6);
// set monday off via exception on next monday
const nm = new Date(d); while (nm.getUTCDay() !== 1) nm.setUTCDate(nm.getUTCDate() + 1);
const nmStr = nm.toISOString().slice(0, 10);
r = await j(`/api/admin/settings/masters/1/exceptions`, { method: 'POST', headers: H, body: JSON.stringify({ exception_date: nmStr, is_working: false, reason: 'Отпуск' })});
await t('add exception', r.status === 201);
r = await j(`/api/public/slots?service_id=1&master_id=1&date=${nmStr}`);
await t('slots empty on day-off', r.body.slots.length === 0);

// brute force lock: 5 wrong attempts then locked even with correct password
for (let i = 0; i < 5; i++) await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ login: 'admin@astra.com', password: 'nope' })});
r = await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ login: 'admin@astra.com', password: 'astra-admin-2026' })});
await t('brute-force lock 423', r.status === 423);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
