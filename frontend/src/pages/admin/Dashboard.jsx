import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { StatusBadge, fmtDateTime } from './common.jsx';
import BookingModal, { useBookingMeta } from './BookingModal.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(false);
  const meta = useBookingMeta();

  useEffect(() => {
    api.dashboard().then(setData).catch(() => {});
  }, [modal]);

  if (!data) return <p className="text-muted">Загрузка дашборда…</p>;

  const kpis = [
    ['Записей в плане', data.scheduled],
    ['Мастеров', data.masters],
    ['Ждут подтверждения', data.waitlist],
    ['Подтверждено / завершено', `${data.confirmed_share}%`],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl lg:text-3xl">Главная</h1>
        <button className="btn-primary !py-3" onClick={() => setModal(true)}>+ Создать запись вручную</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(([l, v]) => (
          <div key={l} className="card p-5">
            <p className="text-xs text-muted uppercase tracking-wide">{l}</p>
            <p className="font-serif text-3xl mt-2">{v}</p>
          </div>
        ))}
      </div>

      {/* Mobile FAB (ТЗ п.4.2) */}
      <button
        aria-label="Создать запись"
        onClick={() => setModal(true)}
        className="lg:hidden fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full bg-rose text-white text-2xl shadow-lg grid place-items-center"
      >
        +
      </button>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex justify-between items-center">
          <h2 className="font-semibold">Последние записи</h2>
          <a href="/admin/bookings" className="text-xs text-rose font-semibold hover:underline">Все записи →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Когда</th>
                <th className="px-5 py-3">Клиент</th>
                <th className="px-5 py-3 hidden md:table-cell">Услуга</th>
                <th className="px-5 py-3 hidden lg:table-cell">Мастер</th>
                <th className="px-5 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((b) => (
                <tr key={b.id} className="border-t border-line hover:bg-cream/40">
                  <td className="px-5 py-3 whitespace-nowrap">{fmtDateTime(b.start_at)}</td>
                  <td className="px-5 py-3">{b.client_name}<span className="block text-xs text-muted">{b.client_phone}</span></td>
                  <td className="px-5 py-3 hidden md:table-cell">{b.service_name}</td>
                  <td className="px-5 py-3 hidden lg:table-cell">{b.master_name}</td>
                  <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
              {!data.recent.length && (
                <tr><td colSpan="5" className="px-5 py-8 text-center text-muted">Записей пока нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BookingModal open={modal} onClose={() => setModal(false)} meta={meta} />
    </div>
  );
}
