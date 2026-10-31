// Миграция SQL-схемы (pg/pg-mem) -> db.json для json-server.
// Данные берутся из того же seed, что и раньше (см. src/seed.js).
// Использование: node src/generate-db.js  -> пишет backend/db/db.json
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'db');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Относительные URL к ассетам макета. Файлы лежат в frontend/public/assets —
// именно оттуда их раздаёт vite (в dev) и dist (в prod). Ранее использовался
// путь /images, которого в public нет — из-за этого картинки услуг и мастеров
// не отображались на сайте (404).
const A = '/assets';

// ---- helpers ----
const hash = (pw) => bcrypt.hashSync(pw, 10);
const nowIso = () => new Date().toISOString();
const day = (offset) => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate() + offset).padStart(2, '0')}`;
};

// ---- seed-данные (идентичны src/seed.js) ----
const categoriesSrc = [
  ['Стрижки и укладки', 'Haircuts & Styling — авторские стрижки, окрашивание и укладки любой сложности', `${A}/asset-5b978307.png`, 1],
  ['Ногтевой сервис', 'Nail Service — маникюр, педикюр и покрытие гель-лаком премиум-классами', `${A}/asset-798b2c16.png`, 2],
  ['Browbar', 'Брови и ресницы — коррекция, ламинирование и наращивание', `${A}/asset-5b978307.png`, 3],
  ['Моментальный загар', 'Spray Tan — безопасный студийный загар за один визит', `${A}/asset-798b2c16.png`, 4],
  ['Мужской сервис', "Men's Grooming — барбер-услуги: стрижки, бороды, бритьё опасной бритвой", `${A}/asset-5b978307.png`, 5],
];

const mastersSrc = [
  { fn: 'Elena', ln: 'Rossi', sp: 'Lead Stylist', bio: '12 лет опыта, топ-стилист Astra. Стрижки, окрашивание, вечерние укладки.', photo: `${A}/master-elena-rossi.png`, rating: 4.9 },
  { fn: 'Marcus', ln: 'Thorne', sp: 'Master Barber', bio: 'Классическая и современная мужская парикмахерия, работа с бородой.', photo: `${A}/master-marcus-thorne.png`, rating: 4.8 },
  { fn: 'Sarah', ln: 'Jenkins', sp: 'Makeup Artist', bio: 'Макияж, brow&lash-сервис, образы для особых случаев.', photo: `${A}/master-sarah-jenkins.png`, rating: 4.9 },
];

// услуги: [категория, название, цена, длительность, мастера(индексы)]
const servicesSrc = [
  [0, 'Женская стрижка', 3500, 60, [0]],
  [0, 'Мужская стрижка', 2500, 45, [0, 1]],
  [0, 'Укладка / вечерний образ', 4000, 90, [0, 2]],
  [0, 'Окрашивание в одну технику', 6500, 120, [0]],
  [1, 'Маникюр + гель-лак', 3000, 90, [2]],
  [1, 'Педикюр', 3500, 90, [2]],
  [2, 'Коррекция и окрашивание бровей', 2200, 45, [2]],
  [2, 'Ламинирование ресниц', 2800, 60, [2]],
  [3, 'Моментальный загар (Body)', 3200, 30, [2]],
  [4, 'Моделирование бороды', 2000, 45, [1]],
  [4, 'Бритьё опасной бритвой', 2500, 60, [1]],
];

// ---- построение коллекций ----
const users = [];
const clients = [];
const masters = [];
const categories = [];
const services = [];
const master_services = [];
const schedules = [];
const schedule_exceptions = [];
const bookings = [];
const login_attempts = [];

let uid = 1;
function addUser(o) {
  const u = { id: uid, role: 'client', is_active: true, created_at: nowIso(), updated_at: nowIso(), ...o };
  users.push(u);
  uid++;
  return u;
}

categoriesSrc.forEach(([name, description, image_url, sort_order], i) => {
  categories.push({ id: i + 1, name, description, image_url, sort_order });
});

const DOW = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const masterIds = [];
mastersSrc.forEach((m, i) => {
  const u = addUser({
    role: 'master',
    firstname: m.fn,
    lastname: m.ln,
    email: `${m.fn}.${m.ln}`.toLowerCase().replace(/[^a-z]/g, '') + '@astra.com',
    phone: null,
    password_hash: hash('master123'),
    avatar_url: m.photo,
  });
  const mid = i + 1;
  masters.push({ id: mid, user_id: u.id, speciality: m.sp, bio: m.bio, photo_url: m.photo, rating_avg: m.rating });
  masterIds.push(mid);
  // график: пн-сб 09:00–20:00, перерыв 14:00–15:00; вс — выходной
  for (const dow of DOW) {
    schedules.push({ id: schedules.length + 1, master_id: mid, day_of_week: dow, start_time: '09:00', end_time: '20:00', break_start: '14:00', break_end: '15:00' });
  }
});

servicesSrc.forEach(([cat, name, price, duration_minutes, ms], i) => {
  const sid = i + 1;
  services.push({ id: sid, category_id: cat + 1, name, description: null, price, duration_minutes, is_active: true });
  for (const mi of ms) master_services.push({ master_id: masterIds[mi], service_id: sid });
});

// Администраторы (роли по ТЗ п.5.3)
const adminHash = hash('astra-admin-2026');
addUser({ role: 'super_admin', firstname: 'Anna', lastname: 'Velichko', email: 'admin@astra.com', phone: '+15550000001', password_hash: adminHash });
addUser({ role: 'manager', firstname: 'Irina', lastname: 'Manager', email: 'salon@astra.com', phone: '+15550000002', password_hash: adminHash });

// Демо-клиент и пара записей на «сегодня/завтра»
const cu = addUser({ role: 'client', firstname: 'Olivia', lastname: 'Martin', phone: '+15551230000', email: 'olivia@example.com', password_hash: '!' });
clients.push({ id: 1, user_id: cu.id, loyalty_balance: 0, notes: null });

let bid = 1;
function mk(dateStr, time, svcIdx, masterIdx, status, price) {
  const st = new Date(`${dateStr}T${time}:00Z`);
  const en = new Date(st.getTime() + servicesSrc[svcIdx][3] * 60000);
  bookings.push({
    id: bid++, client_id: 1, master_id: masterIds[masterIdx], service_id: svcIdx + 1,
    start_at: st.toISOString(), end_at: en.toISOString(), status, total_price: price, source: 'web',
    comment: null, discount_percent: 0, is_prepaid: false,
    created_at: nowIso(), updated_at: nowIso(),
  });
}
const t = day(0), tm = day(1);
mk(t, '10:00', 0, 0, 'confirmed', 3500);
mk(t, '11:30', 4, 2, 'pending', 3000);
mk(t, '13:00', 9, 1, 'completed', 2000);
mk(tm, '09:30', 2, 0, 'pending', 4000);
mk(tm, '15:00', 8, 2, 'confirmed', 3200);

const db = {
  users,
  clients,
  masters,
  categories,
  services,
  master_services,
  schedules,
  schedule_exceptions,
  bookings,
  login_attempts,
  audit_logs: [],
};

fs.mkdirSync(DB_DIR, { recursive: true });
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log(`db.json written -> ${DB_FILE}`);
console.log('Collections:', Object.fromEntries(Object.entries(db).map(([k, v]) => [k, v.length])));
