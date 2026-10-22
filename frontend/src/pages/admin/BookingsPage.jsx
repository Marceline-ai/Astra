import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { StatusBadge, fmtDateTime, STATUS_LABELS } from './common.jsx';

export default function BookingsPage() {
  const [rows, setRows] = useState([]);
  const [masters, setMasters] = useState([]);
  const [filters, setFilters] = useState({ date: '', master_id: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);

  function load(f = filters) {
    setLoading(true);
    const q = new URLSearchParams();
    if (f.date) q.set('date', f.date);
    if (f.master_id) q.set('master_id', f.master_id);
    if (f.status) q.set('status', f.status);
    api.bookings(q.toString() ? `?${q}` : '')
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api.masters().then(setMasters).catch(() => {});
    load();
  }, []);

  const setF = (k) => (e) => {
    const nf = { ...filters, [k]: e.target.value };
    setFilters(nf);
    load(nf);
  };

  async function openRow(id) {
    setOpenId(id);
    try {
      setDetail(await api.booking(id));
    } catch {
      setDetail(null);
    }
  }

  async function changeStatus(id, status) {
    await api.updateBooking(id, { status });
    load();
    if (openId === id) setDetail(await api.booking(id));
  }

  async function remove(id) {
    if (!confirm('Удалить запись безвозвратно?')) return;
    await api.deleteBooking(id);
    setOpenId(null);
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-2xl lg:text-3xl">Записи</h1>

      {/* Фильтры (ТЗ п.4.3): дата, мастер, статус */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label">По дате</label>
          <input type="date" className="field" value={filters.date} onChange={setF('date')} />
        </div>
        <div>
          <label className="label">По мастеру</label>
          <select className="field" value={filters.master_id} onChange={setF('master_id')}>
            <option value="">Все</option>
            {masters.map((m) => <option key={m.id} value={m.id}>{m.firstname} {m.lastname}</option>)}
          </select>
        </div>
        <div>
          <label className="label">По статусу</label>
          <select className="field" value={filters.status} onChange={setF('status')}>
            <option value="">Все</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button className="px-5 py-2.5 rounded-full border border-line text-sm hover:bg-cream w-full" onClick={() => { const nf = { date: '', master_id: '', status: '' }; setFilters(nf); load(nf); }}>
            Сбросить
          </button>
        </div>
      </div>

      {loading && <p className="text-muted">Загрузка…</p>}

      {/* Desktop: таблица */}
      {!loading && (
        <div className="card overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-cream/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Время</th>
                <th className="px-5 py-3">Клиент</th>
                <th className="px-5 py-3">Телефон</th>
                <th className="px-5 py-3">Услуга</th>
                <th className="px-5 py-3">Мастер</th>
                <th className="px-5 py-3">Статус</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-line hover:bg-cream/40 cursor-pointer" onClick={() => openRow(b.id)}>
                  <td className="px-5 py-3 whitespace-nowrap">{fmtDateTime(b.start_at)}</td>
                  <td className="px-5 py-3">{b.client_fn} {b.client_ln}</td>
                  <td className="px-5 py-3"><a href={`tel:${b.client_phone}`} onClick={(e) => e.stopPropagation()} className="text-rose hover:underline">{b.client_phone}</a></td>
                  <td className="px-5 py-3">{b.service_name}</td>
                  <td className="px-5 py-3">{b.master_fn} {b.master_ln}</td>
                  <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-3 text-right text-xs text-muted">Открыть →</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="7" className="px-5 py-10 text-center text-muted">Ничего не найдено</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile: карточки */}
      {!loading && (
        <div className="md:hidden space-y-3">
          {rows.map((b) => (
            <button key={b.id} onClick={() => openRow(b.id)} className="card w-full text-left p-4 active:scale-[0.99] transition">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{fmtDateTime(b.start_at)} · {b.service_name}</p>
                  <p className="text-sm text-muted mt-0.5">{b.client_fn} {b.client_ln} — {b.client_phone}</p>
                  <p className="text-xs text-muted mt-0.5">Мастер: {b.master_fn} {b.master_ln}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            </button>
          ))}
          {!rows.length && <p className="text-muted text-center py-8">Ничего не найдено</p>}
        </div>
      )}

      {/* Карточка записи */}
      {openId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setOpenId(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl">Запись №{openId}</h3>
              <button onClick={() => setOpenId(null)} aria-label="Закрыть" className="w-8 h-8 rounded-full hover:bg-cream">✕</button>
            </div>
            {detail ? (
              <>
                <dl className="text-sm space-y-2">
                  <div className="flex justify-between"><dt className="text-muted">Клиент</dt><dd className="font-medium">{detail.client_fn} {detail.client_ln}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Телефон</dt><dd><a className="text-rose" href={`tel:${detail.client_phone}`}>{detail.client_phone}</a></dd></div>
                  {detail.client_email && <div className="flex justify-between"><dt className="text-muted">Email</dt><dd>{detail.client_email}</dd></div>}
                  <div className="flex justify-between"><dt className="text-muted">Услуга</dt><dd className="font-medium">{detail.service_name} ({detail.duration_minutes} мин)</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Мастер</dt><dd>{detail.master_fn} {detail.master_ln}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Когда</dt><dd>{fmtDateTime(detail.start_at)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Стоимость</dt><dd>{detail.total_price} ₽{Number(detail.discount_percent) > 0 ? ` (скидка ${detail.discount_percent}%)` : ''}{detail.is_prepaid ? ' · предоплата' : ''}</dd></div>
                  {detail.comment && <div><dt className="text-muted">Комментарий</dt><dd className="mt-1 bg-cream rounded-lg p-2">{detail.comment}</dd></div>}
                </dl>
                <div>
                  <label className="label">Сменить статус</label>
                  <select className="field" value={detail.status} onChange={(e) => changeStatus(openId, e.target.value)}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="flex justify-between pt-1">
                  <button className="text-sm text-red-600 hover:underline" onClick={() => remove(openId)}>Удалить запись</button>
                  <button className="btn-primary !py-2.5 text-sm" onClick={() => setOpenId(null)}>Готово</button>
                </div>
              </>
            ) : (
              <p className="text-muted text-sm">Загрузка карточки…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
