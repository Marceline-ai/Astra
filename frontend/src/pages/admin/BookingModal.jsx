import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';

export function useBookingMeta() {
  const [services, setServices] = useState([]);
  const [masters, setMasters] = useState([]);
  useEffect(() => {
    api.services().then(setServices).catch(() => {});
    api.masters().then(setMasters).catch(() => {});
  }, []);
  return { services, masters };
}

/**
 * Модальная форма создания записи (используется в Dashboard и Schedule).
 * props: open, onClose, onCreated, prefill {master_id?, date?, time?}, meta {services, masters}
 */
export default function BookingModal({ open, onClose, onCreated, prefill = {}, meta }) {
  const { services, masters } = meta;
  const [f, setF] = useState({
    service_id: '', master_id: '', date: prefill.date || new Date().toISOString().slice(0, 10),
    time: prefill.time || '', firstname: '', phone: '', lastname: '', email: '',
    comment: '', discount_percent: 0, is_prepaid: false,
  });
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState('');
  const [conflictWarn, setConflictWarn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF((s) => ({ ...s, master_id: prefill.master_id || s.master_id, date: prefill.date || s.date, time: prefill.time || s.time }));
      setError('');
      setConflictWarn(false);
    }
  }, [open]);

  const eligibleMasters = useMemo(() => {
    if (!f.service_id) return masters;
    // мастера, привязанные к услуге — берём из публичного эндпоинта при выборе услуги
    return masters.filter((m) => !serviceMasterIds.length || serviceMasterIds.includes(String(m.id)));
  }, [f.service_id, masters]);
  const [serviceMasterIds, setServiceMasterIds] = useState([]);

  useEffect(() => {
    if (!f.service_id) { setServiceMasterIds([]); return; }
    api.mastersForService(f.service_id)
      .then((ms) => setServiceMasterIds(ms.map((m) => String(m.id))))
      .catch(() => setServiceMasterIds([]));
  }, [f.service_id]);

  useEffect(() => {
    if (!f.master_id || !f.date) { setSlots([]); return; }
    api.slots(f.master_id, f.date, f.service_id || 1)
      .then((r) => setSlots(r.slots || []))
      .catch(() => setSlots([]));
  }, [f.master_id, f.date, f.service_id]);

  if (!open) return null;

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(force = false) {
    setBusy(true);
    setError('');
    try {
      const res = await api.createBookingAdmin({
        service_id: +f.service_id,
        master_id: +f.master_id,
        date: f.date,
        time: f.time,
        firstname: f.firstname.trim(),
        phone: f.phone.trim(),
        lastname: f.lastname.trim() || undefined,
        email: f.email.trim() || undefined,
        comment: f.comment || undefined,
        discount_percent: +f.discount_percent || 0,
        is_prepaid: !!f.is_prepaid,
        force,
      });
      if (res.warning) setConflictWarn(res.warning);
      onCreated?.(res);
      if (!res.warning) onClose();
    } catch (err) {
      if (err.status === 409 && err.details?.error === 'slot_taken') {
        setConflictWarn(err.details.message || 'Время занято. Создать всё равно?');
      } else {
        setError(err.details?.message || err.message || 'Ошибка создания записи');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-serif text-xl">Новая запись</h3>
          <button onClick={onClose} aria-label="Закрыть" className="w-8 h-8 rounded-full hover:bg-cream">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Услуга *</label>
            <select className="field" value={f.service_id} onChange={set('service_id')}>
              <option value="">—</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}м)</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Мастер *</label>
            <select className="field" value={f.master_id} onChange={set('master_id')}>
              <option value="">—</option>
              {eligibleMasters.map((m) => <option key={m.id} value={m.id}>{m.firstname} {m.lastname}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Дата *</label>
            <input type="date" className="field" value={f.date} onChange={set('date')} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Время *</label>
            <input list="adm-times" className="field" placeholder="10:00" value={f.time} onChange={set('time')} />
            <datalist id="adm-times">{slots.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Имя клиента *</label>
            <input className="field" value={f.firstname} onChange={set('firstname')} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Телефон *</label>
            <input className="field" placeholder="+7 ..." value={f.phone} onChange={set('phone')} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Фамилия</label>
            <input className="field" value={f.lastname} onChange={set('lastname')} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Email</label>
            <input className="field" value={f.email} onChange={set('email')} />
          </div>
          <div className="col-span-2">
            <label className="label">Комментарий</label>
            <textarea className="field" rows="2" placeholder='Напр.: "Клиент просил позвонить за час"' value={f.comment} onChange={set('comment')} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Скидка, %</label>
            <input type="number" min="0" max="100" className="field" value={f.discount_percent} onChange={set('discount_percent')} />
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-end pb-2 gap-2">
            <input id="prepaid" type="checkbox" checked={!!f.is_prepaid} onChange={set('is_prepaid')} className="w-4 h-4 accent-rose" />
            <label htmlFor="prepaid" className="text-sm">Предоплата получена</label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        {conflictWarn && (
          <div className="text-sm text-warning bg-[#FFF4E5] border border-warning/30 rounded-xl px-3 py-2">
            ⚠ {conflictWarn}
            <button className="underline ml-2 font-semibold" disabled={busy} onClick={() => submit(true)}>Создать поверх занятого</button>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button className="px-5 py-2.5 rounded-full border border-line text-sm hover:bg-cream" onClick={onClose}>Отмена</button>
          <button
            className="btn-primary !py-2.5"
            disabled={busy || !f.service_id || !f.master_id || !f.date || !f.time || !f.firstname || !f.phone}
            onClick={() => submit(false)}
          >
            {busy ? 'Создание…' : 'Создать запись'}
          </button>
        </div>
      </div>
    </div>
  );
}
