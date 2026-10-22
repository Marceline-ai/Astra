// Логика расписания и свободных слотов (ТЗ п.3.2, 4.4)
import { query } from './db.js';

export const SLOT_STEP_MIN = 30;            // шаг сетки времени
export const DAY_START = '09:00';           // по макету админки 09:00–16:30+, working hours в футере 9-8
export const DAY_END = '20:00';

const DOW_ENUM = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Рабочие интервалы мастера на конкретную дату (с учётом schedule_exceptions)
export async function getWorkingIntervals(masterId, dateStr) {
  const exc = await query(
    `SELECT * FROM schedule_exceptions WHERE master_id = $1 AND exception_date = $2`,
    [masterId, dateStr]
  );
  if (exc.length > 0) {
    const e = exc[0];
    if (!e.is_working) return [];                       // выходной/отпуск
    if (e.start_time && e.end_time) {                   // работает в другое время
      return [{ start: toMin(e.start_time), end: toMin(e.end_time), break: null }];
    }
  }
  const dow = DOW_ENUM[new Date(dateStr + 'T12:00:00').getDay()];
  const sched = await query(
    `SELECT * FROM schedules WHERE master_id = $1 AND day_of_week = $2`,
    [masterId, dow]
  );
  if (sched.length === 0) return [];                    // не рабочий день
  const s = sched[0];
  let breakRange = null;
  if (s.break_start && s.break_end) breakRange = { start: toMin(s.break_start), end: toMin(s.break_end) };
  return [{ start: toMin(s.start_time), end: toMin(s.end_time), break: breakRange }];
}

export function toMin(t) { // "09:00" или Date -> минуты суток
  if (typeof t === 'string') { const [h,m] = t.slice(0,5).split(':'); return +h*60 + +m; }
  return t.getHours()*60 + t.getMinutes();
}
export function minToHHMM(min) {
  return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
}

// Занятые интервалы bookings (не отменённые) на дату у мастера
export async function getBusyIntervals(masterId, dateStr) {
  const rows = await query(
    `SELECT b.start_at, b.end_at, b.id FROM bookings b
     WHERE b.master_id = $1 AND b.status <> 'canceled'
       AND (b.start_at AT TIME ZONE 'UTC')::date = $2::date OR (b.end_at AT TIME ZONE 'UTC')::date = $2::date`,
    [masterId, dateStr]
  ).catch(async () => {
    // pg-mem не поддерживает AT TIME ZONE — простой вариант
    const d = new Date(dateStr + 'T00:00:00Z');
    const next = new Date(d.getTime() + 86400000);
    return query(
      `SELECT start_at, end_at, id FROM bookings WHERE master_id = $1 AND status <> 'canceled' AND start_at >= $2 AND start_at < $3`,
      [masterId, d, next]
    );
  });
  return rows.map(r => ({
    start: dayMinutes(r.start_at, dateStr),
    end: dayMinutes(r.end_at, dateStr),
    bookingId: r.id,
  }));
}

function dayMinutes(ts, dateStr) {
  const d = ts instanceof Date ? ts : new Date(ts);
  const utcDate = d.toISOString().slice(0,10);
  const base = utcDate === dateStr ? 0 : (new Date(utcDate) > new Date(dateStr) ? 24*60 : -24*60);
  return base + d.getUTCHours()*60 + d.getUTCMinutes();
}

// Свободные слоты для услуги длительностью durationMin на дату у мастера.
// nowMin — текущее время в минутах (UTC) для фильтра прошедших слотов сегодня.
export async function getFreeSlots(masterId, dateStr, durationMin, nowMin = -1) {
  const intervals = await getWorkingIntervals(masterId, dateStr);
  if (intervals.length === 0) return [];
  const busy = await getBusyIntervals(masterId, dateStr);
  const slots = [];
  for (const iv of intervals) {
    // сегменты без перерыва
    const segs = [];
    if (iv.break) {
      if (iv.start < iv.break.start) segs.push([iv.start, iv.break.start]);
      if (iv.break.end < iv.end) segs.push([iv.break.end, iv.end]);
    } else segs.push([iv.start, iv.end]);
    for (const [s,e] of segs) {
      for (let t = Math.ceil(s / SLOT_STEP_MIN) * SLOT_STEP_MIN; t + durationMin <= e; t += SLOT_STEP_MIN) {
        if (t < nowMin) continue;
        const overlap = busy.some(b => !(b.end <= t || b.start >= t + durationMin));
        if (!overlap) slots.push(minToHHMM(t));
      }
    }
  }
  return slots;
}

// Проверка конфликта (ТЗ п.3.2: при отправке проверить, не занято ли время)
export async function findConflict(masterId, startAt, endAt, ignoreBookingId = null) {
  const rows = await query(
    `SELECT id, status FROM bookings
     WHERE master_id = $1 AND status <> 'canceled'
       AND start_at < $3 AND end_at > $2`,
    [masterId, startAt, endAt]
  );
  const conf = rows.filter(r => String(r.id) !== String(ignoreBookingId));
  return conf.length > 0 ? conf[0] : null;
}

// Занятость для календаря админки: все мастера × интервал на дату
export async function getScheduleGrid(dateStr, masters) {
  const out = [];
  for (const m of masters) {
    const intervals = await getWorkingIntervals(m.id, dateStr);
    const busy = await getBusyIntervals(m.id, dateStr);
    out.push({ master: m, intervals, busy });
  }
  return out;
}
