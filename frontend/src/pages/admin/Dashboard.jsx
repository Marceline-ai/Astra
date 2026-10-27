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

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex justify-between items-center">
          <h2 className="font-semibold">Журнал действий (логирование)</h2>
        </div>
        <AuditLog />
      </div>

      <BookingModal open={modal} onClose={() => setModal(false)} meta={meta} />
    </div>
  );
}

const ACTION_LABELS = {
  login: 'Вход',
  login_failed: 'Неудачный вход',
  logout: 'Выход',
  booking_created: 'Запись создана',
  booking_updated: 'Запись изменена',
  booking_deleted: 'Запись удалена',
  category_created: 'Категория создана',
  category_updated: 'Категория изменена',
  category_deleted: 'Категория удалена',
  service_created: 'Услуга создана',
  service_updated: 'Услуга изменена',
  service_deleted: 'Услуга удалена',
  master_updated: 'Мастер изменён',
  schedule_updated: 'График изменён',
  exception_created: 'Исключение графика создано',
  exception_deleted: 'Исключение графика удалено',
  staff_created: 'Сотрудник создан',
  audit_cleared: 'Журнал очищен',
};

function AuditLog() {
  const [logs, setLogs] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.auditLogs().then(setLogs).catch((e) => setErr(e.message || 'Не удалось загрузить журнал'));
  }, []);

  if (err) return <p className="px-5 py-6 text-sm text-red-600">{err}</p>;
  if (!logs) return <p className="px-5 py-6 text-sm text-muted">Загрузка журнала…</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-cream/60 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-5 py-3 whitespace-nowrap">Когда</th>
            <th className="px-5 py-3">Кто</th>
            <th className="px-5 py-3">Действие</th>
            <th className="px-5 py-3 hidden md:table-cell">Объект</th>
            <th className="px-5 py-3">Подробности</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-line hover:bg-cream/40">
              <td className="px-5 py-3 whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
              <td className="px-5 py-3 whitespace-nowrap">{l.actor_name}<span className="block text-xs text-muted">{l.role}</span></td>
              <td className="px-5 py-3 whitespace-nowrap">{ACTION_LABELS[l.action] ?? l.action}</td>
              <td className="px-5 py-3 whitespace-nowrap hidden md:table-cell">{l.entity}{l.entity_id != null ? ` #${l.entity_id}` : ''}</td>
              <td className="px-5 py-3 text-muted">{l.details ?? '—'}</td>
            </tr>
          ))}
          {!logs.length && (
            <tr><td colSpan="5" className="px-5 py-8 text-center text-muted">Действий пока нет</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
