export const STATUS_LABELS = {
  pending: 'Новая',
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  canceled: 'Отменена',
  no_show: 'Не пришла',
};

export const STATUS_STYLES = {
  pending: 'bg-[#FFF4E5] text-warning',
  confirmed: 'bg-[#E8F5E9] text-success',
  completed: 'bg-[#E8F3EC] text-info',
  canceled: 'bg-red-50 text-red-600',
  no_show: 'bg-gray-100 text-gray-500',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-500'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
