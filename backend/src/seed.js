// Наполнение БД данными из макета Astra.fig (категории, услуги, мастера, расписание, админы)
import { query, one } from './db.js';
import { hashPassword } from './auth.js';

const A = '/images'; // относительные URL к ассетам макета (раздаёт фронтенд)

const categories = [
  ['Стрижки и укладки', 'Haircuts & Styling — авторские стрижки, окрашивание и укладки любой сложности', `${A}/master-elena-rossi.png`, 1],
  ['Ногтевой сервис', 'Nail Service — маникюр, педикюр и покрытие гель-лаком премиум-классами', `${A}/about-interior.png`, 2],
  ['Browbar', 'Брови и ресницы — коррекция, ламинирование и наращивание', `${A}/asset-5b978307.png`, 3],
  ['Моментальный загар', 'Spray Tan — безопасный студийный загар за один визит', `${A}/asset-798b2c16.png`, 4],
  ['Мужской сервис', "Men's Grooming — барбер-услуги: стрижки, бороды, бритьё опасной бритвой", `${A}/master-marcus-thorne.png`, 5],
];

const masters = [
  { fn: 'Elena', ln: 'Rossi', sp: 'Lead Stylist', bio: '12 лет опыта, топ-стилист Astra. Стрижки, окрашивание, вечерние укладки.', photo: `${A}/master-elena-rossi.png`, rating: 4.9 },
  { fn: 'Marcus', ln: 'Thorne', sp: 'Master Barber', bio: 'Классическая и современная мужская парикмахерия, работа с бородой.', photo: `${A}/master-marcus-thorne.png`, rating: 4.8 },
  { fn: 'Sarah', ln: 'Jenkins', sp: 'Makeup Artist', bio: 'Макияж, brow&lash-сервис, образы для особых случаев.', photo: `${A}/master-sarah-jenkins.png`, rating: 4.9 },
];

// услуги: [категория, название, цена, длительность, мастера(индексы)]
const services = [
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

async function seed() {
  const catIds = [];
  for (const [name, desc, img, sort] of categories) {
    const c = await one(`INSERT INTO categories (name, description, image_url, sort_order) VALUES ($1,$2,$3,$4) RETURNING id`,
      [name, desc, img, sort]);
    catIds.push(c.id);
  }

  const masterIds = [];
  for (const m of masters) {
    const u = await one(`INSERT INTO users (role, firstname, lastname, email, phone, password_hash, avatar_url)
      VALUES ('master',$1,$2,$3,$4,$5,$6) RETURNING id`,
      [m.fn, m.ln, `${m.fn}.${m.ln}`.toLowerCase().replace(/[^a-z]/g,'') + '@astra.com', null, await hashPassword('master123'), m.photo]);
    const mm = await one(`INSERT INTO masters (user_id, speciality, bio, photo_url, rating_avg) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [u.id, m.sp, m.bio, m.photo, m.rating]);
    masterIds.push(mm.id);
    // график: пн-сб 09:00–20:00, перерыв 14:00–15:00; вс — выходной
    for (const dow of ['monday','tuesday','wednesday','thursday','friday','saturday']) {
      await query(`INSERT INTO schedules (master_id, day_of_week, start_time, end_time, break_start, break_end)
        VALUES ($1,$2,'09:00','20:00','14:00','15:00')`, [mm.id, dow]);
    }
  }

  const svcIds = [];
  for (const [cat, name, price, dur, ms] of services) {
    const s = await one(`INSERT INTO services (category_id, name, price, duration_minutes) VALUES ($1,$2,$3,$4) RETURNING id`,
      [catIds[cat], name, price, dur]);
    svcIds.push(s.id);
    for (const mi of ms) await query(`INSERT INTO master_services (master_id, service_id) VALUES ($1,$2)`, [masterIds[mi], s.id]);
  }

  // Администраторы (роли по ТЗ п.5.3)
  const adminHash = await hashPassword('astra-admin-2026');
  await one(`INSERT INTO users (role, firstname, lastname, email, phone, password_hash) VALUES ('super_admin','Anna','Velichko','admin@astra.com','+15550000001',$1)`, [adminHash]);
  await one(`INSERT INTO users (role, firstname, lastname, email, phone, password_hash) VALUES ('manager','Irina','Manager','salon@astra.com','+15550000002',$1)`, [adminHash]);

  // Демо-клиент и пара записей на «сегодня/завтра»
  const cu = await one(`INSERT INTO users (role, firstname, lastname, phone, email, password_hash) VALUES ('client','Olivia','Martin','+15551230000','olivia@example.com','!') RETURNING id`);
  const cl = await one(`INSERT INTO clients (user_id) VALUES ($1) RETURNING id`, [cu.id]);

  const day = (offset) => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()+offset).padStart(2,'0')}`; };
  async function mk(dateStr, time, svcIdx, masterIdx, status, price) {
    const st = new Date(`${dateStr}T${time}:00Z`);
    const en = new Date(st.getTime() + services[svcIdx][3]*60000);
    await query(`INSERT INTO bookings (client_id, master_id, service_id, start_at, end_at, status, total_price, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'web')`, [cl.id, masterIds[masterIdx], svcIds[svcIdx], st, en, status, price]);
  }
  const t = day(0), tm = day(1);
  await mk(t, '10:00', 0, 0, 'confirmed', 3500);
  await mk(t, '11:30', 4, 2, 'pending', 3000);
  await mk(t, '13:00', 9, 1, 'completed', 2000);
  await mk(tm, '09:30', 2, 0, 'pending', 4000);
  await mk(tm, '15:00', 8, 2, 'confirmed', 3200);

  console.log('Seed done:', { categories: catIds.length, masters: masterIds.length, services: svcIds.length });
}

await seed();
