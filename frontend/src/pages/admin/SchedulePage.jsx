import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import BookingModal, { useBookingMeta } from './BookingModal.jsx';

const STATUS_COLORS = {
  pending: 'bg-[#FFF4E5] border-l-[3px] border-warning',
  confirmed: 'bg-[#E8F5E9] border-l-[3px] border-success',
  completed: 'bg-[#E8F3EC] border-l-[3px] border-info',
  no_show: 'bg-gray-100 border-l-[3px] border-gray-400',
  canceled: 'bg-red-50 border-l-[3px] border-red-400',
};

const toMin = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);
const pad = (n) => String(n).padStart(2, '0');

export default function SchedulePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // prefill object or false
  const meta = useBookingMeta();

  useEffect(() => {
    api.schedule(`?date=${date}`).then(setData).catch(() => setData(null));
  }, [date]);

  const view = useMemo(() => {
    if (!data) return null;
    let min = 9 * 60, max = 20 * 60;
    for (const col of data.grid) {
      for (const iv of col.intervals || []) {
        min = Math.min(min, toMin(iv.start_time?.slice(0, 5) || '09:00'));
        max = Math.max(max, toMin(iv.end_time?.slice(0, 5) || '20:00'));
      }
    }
    min = Math.floor(min / 60) * 60;
    max = Math.ceil(max / 60) * 60;
    const rows = [];
    for (let m = min; m < max; m += 30) rows.push(m);
    return { min, max, rows };
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl lg:text-3xl">Расписание</h1>
        <div className="flex items-center gap-3">
          <input type="date" className="field !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-primary !py-2.5 text-sm whitespace-nowrap" onClick={() => setModal({ date })}>
            + Создать запись
          </button>
        </div>
      </div>

      {!data && <p className="text-muted">Загрузка расписания…</p>}
      {data && view && (
        <div className="card overflow-x-auto">
          <div
            className="grid min-w-[640px]"
            style={{ gridTemplateColumns: `72px repeat(${data.grid.length}, minmax(150px, 1fr))` }}
          >
            {/* header row */}
            <div className="sticky top-0 bg-white border-b border-line p-3 text-xs text-muted">Время</div>
            {data.grid.map((col) => (
              <div key={col.master.id} className="sticky top-0 bg-white border-b border-l border-line p-3 text-sm font-semibold truncate">
                {col.master.firstname} {col.master.lastname}
                <span className="block text-[11px] font-normal text-muted">{col.master.speciality}</span>
              </div>
            ))}

            {/* body: time rows × masters */}
            {view.rows.map((m) => (
              <FragmentRow
                key={m}
                minutes={m}
                view={view}
                columns={data.grid}
                bookings={data.bookings}
                onSlot={(masterId, time) => setModal({ date, master_id: String(masterId), time })}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Клик по свободной ячейке — быстрое создание записи. Цвета карточек: оранжевый — новая, зелёный — подтверждена, тёмно-зелёный — завершена.
      </p>

      {modal !== null && (
        <BookingModal
          open
          onClose={() => setModal(false)}
          prefill={modal || {}}
          meta={meta}
          onCreated={() => api.schedule(`?date=${date}`).then(setData)}
        />
      )}
    </div>
  );
}

function FragmentRow({ minutes, view, columns, bookings, onSlot }) {
  const hh = pad(Math.floor(minutes / 60));
  const mm = pad(minutes % 60);
  const time = `${hh}:${mm}`;
  return (
    <>
      <div className="border-b border-line py-2 px-2 text-xs text-muted text-right sticky left-0 bg-white">{time}</div>
      {columns.map((col) => {
        const b = (bookings || []).find((bk) => {
          const st = new Date(bk.start_at);
          const bmin = st.getUTCHours() * 60 + st.getUTCMinutes();
          return bk.master_id === col.master.id && bmin === minutes;
        });
        const working = (col.intervals || []).some((iv) => {
          const s = toMin(String(iv.start_time).slice(0, 5));
          const e = toMin(String(iv.end_time).slice(0, 5));
          const bs = iv.break_start ? toMin(String(iv.break_start).slice(0, 5)) : null;
          const be = iv.break_end ? toMin(String(iv.break_end).slice(0, 5)) : null;
          const inBreak = bs !== null && minutes >= bs && minutes < be;
          return minutes >= s && minutes < e && !inBreak;
        });
        if (b) {
          return (
            <div key={col.master.id} className="border-b border-l border-line p-1">
              <div
                className={`rounded-lg px-2 py-1.5 text-[11px] leading-tight cursor-default ${STATUS_COLORS[b.status] || 'bg-gray-100'}`}
                title={`${b.service_name} · ${b.start_at}`}
              >
                <b>{b.service_name}</b>
                <span className="block opacity-70">{new Date(b.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</span>
              </div>
            </div>
          );
        }
        return (
          <button
            key={col.master.id}
            onClick={() => working && onSlot(col.master.id, time)}
            disabled={!working}
            className={`border-b border-l border-line transition ${working ? 'hover:bg-rose/10 cursor-pointer' : 'bg-[repeating-linear-gradient(45deg,#faf9f6,#faf9f6_6px,#f1efe9_6px,#f1efe9_12px)] cursor-not-allowed'}`}
            aria-label={working ? `Создать запись на ${time}` : 'Не рабочее время'}
          />
        );
      })}
    </>
  );
}
