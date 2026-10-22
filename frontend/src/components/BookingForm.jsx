import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

function formatPhone(v) {
  let d = v.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11);
  if (!d) return '';
  if (d[0] !== '7') d = '7' + d;
  let out = '+7';
  if (d.length > 1) out += ' (' + d.slice(1, 4);
  if (d.length >= 5) out += ') ' + d.slice(4, 7);
  if (d.length >= 8) out += '-' + d.slice(7, 9);
  if (d.length >= 10) out += '-' + d.slice(9, 11);
  return out;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function BookingForm() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    service_id: '', master_id: '', date: todayStr(), time: '',
    firstname: '', phone: '', lastname: '', email: '',
  });
  const [masters, setMasters] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.services().then(setServices).catch(() => setServerError('Не удалось загрузить услуги'));
    api.categories().then(setCategories).catch(() => {});
  }, []);

  // Мастер зависит от выбранной услуги (ТЗ п.3.2)
  useEffect(() => {
    setMasters([]);
    setForm((f) => ({ ...f, master_id: '', time: '' }));
    setSlots([]);
    if (!form.service_id) return;
    api.mastersForService(form.service_id).then(setMasters).catch(() => {});
  }, [form.service_id]);

  // Слоты зависят от мастера + даты + длительности услуги
  useEffect(() => {
    setSlots([]);
    setForm((f) => ({ ...f, time: '' }));
    if (!form.master_id || !form.date || !form.service_id) return;
    setSlotsLoading(true);
    api.slots(form.master_id, form.date, form.service_id)
      .then((r) => setSlots(r.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [form.master_id, form.date, form.service_id]);

  const set = (k) => (e) => {
    const v = k === 'phone' ? formatPhone(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => ({ ...er, [k]: undefined }));
    setServerError('');
  };

  const validate = () => {
    const er = {};
    if (!form.service_id) er.service_id = 'Выберите услугу';
    if (!form.master_id) er.master_id = 'Выберите мастера';
    if (!form.date) er.date = 'Выберите дату';
    if (!form.time) er.time = 'Выберите время';
    if (!form.firstname.trim()) er.firstname = 'Укажите имя';
    if (form.phone.replace(/\D/g, '').length < 11) er.phone = 'Укажите полный номер телефона';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) er.email = 'Некорректный email';
    return er;
  };

  const minDate = useMemo(() => todayStr(), []);
  const selectedService = services.find((s) => String(s.id) === String(form.service_id));

  async function submit(e) {
    e.preventDefault();
    const er = validate();
    if (Object.keys(er).length) return setErrors(er);
    setSubmitting(true);
    setServerError('');
    try {
      await api.createBooking({
        service_id: +form.service_id,
        master_id: +form.master_id,
        date: form.date,
        time: form.time,
        firstname: form.firstname.trim(),
        phone: form.phone,
        lastname: form.lastname.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      if (err.status === 409) {
        setServerError(err.details?.message || 'Это время уже занято. Выберите другой слот.');
        // обновим список свободных слотов
        if (form.master_id && form.service_id) {
          api.slots(form.master_id, form.date, form.service_id).then((r) => setSlots(r.slots || [])).catch(() => {});
        }
      } else if (err.status === 422 && err.details?.fields) {
        setErrors(err.details.fields);
      } else {
        setServerError(err.message || 'Произошла ошибка. Попробуйте позже.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="card max-w-xl mx-auto p-10 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-success/10 text-success grid place-items-center text-3xl mb-5">✓</div>
        <h3 className="font-serif text-2xl mb-3">Спасибо!</h3>
        <p className="text-muted mb-6">Мы свяжемся с вами для подтверждения.</p>
        <button className="btn-primary" onClick={() => { setSuccess(false); setForm({ ...form, time: '', firstname: '', phone: '', lastname: '', email: '' }); }}>
          Создать ещё одну запись
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="card max-w-3xl mx-auto p-6 md:p-10 space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="label" htmlFor="svc">Услуга *</label>
          <select id="svc" className="field" value={form.service_id} onChange={set('service_id')}>
            <option value="">— Выберите услугу —</option>
            {categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {services.filter((s) => String(s.category_id) === String(c.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.price}₽ / {s.duration_minutes} мин</option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.service_id && <p className="text-xs text-red-600 mt-1">{errors.service_id}</p>}
        </div>
        <div>
          <label className="label" htmlFor="mst">Мастер *</label>
          <select id="mst" className="field" value={form.master_id} onChange={set('master_id')} disabled={!form.service_id}>
            <option value="">{form.service_id ? '— Выберите мастера —' : 'Сначала выберите услугу'}</option>
            {masters.map((m) => (
              <option key={m.id} value={m.id}>{m.firstname} {m.lastname}{m.speciality ? ` — ${m.speciality}` : ''}</option>
            ))}
          </select>
          {errors.master_id && <p className="text-xs text-red-600 mt-1">{errors.master_id}</p>}
        </div>
        <div>
          <label className="label" htmlFor="dt">Дата *</label>
          <input id="dt" type="date" className="field" min={minDate} value={form.date} onChange={set('date')} />
          {errors.date && <p className="text-xs text-red-600 mt-1">{errors.date}</p>}
        </div>
        <div>
          <label className="label">Время *</label>
          {!form.master_id ? (
            <p className="text-sm text-muted italic pt-2">Выберите мастера и дату…</p>
          ) : slotsLoading ? (
            <p className="text-sm text-muted pt-2">Загрузка свободных слотов…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-warning pt-2">Нет свободных слотов на эту дату</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="Свободное время">
              {slots.map((t) => (
                <button
                  type="button"
                  key={t}
                  role="radio"
                  aria-checked={form.time === t}
                  onClick={() => set('time')({ target: { value: t } })}
                  className={`px-3.5 py-2 rounded-full text-sm border transition ${
                    form.time === t
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-ink border-line hover:border-rose'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {errors.time && <p className="text-xs text-red-600 mt-1">{errors.time}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 pt-2 border-t border-line">
        <div>
          <label className="label" htmlFor="fn">Имя *</label>
          <input id="fn" className="field" placeholder="Анна" value={form.firstname} onChange={set('firstname')} />
          {errors.firstname && <p className="text-xs text-red-600 mt-1">{errors.firstname}</p>}
        </div>
        <div>
          <label className="label" htmlFor="ph">Номер телефона *</label>
          <input id="ph" type="tel" inputMode="tel" className="field" placeholder="+7 (___) ___-__-__" value={form.phone} onChange={set('phone')} />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label className="label" htmlFor="ln">Фамилия</label>
          <input id="ln" className="field" placeholder="необязательно" value={form.lastname} onChange={set('lastname')} />
        </div>
        <div>
          <label className="label" htmlFor="em">Email</label>
          <input id="em" type="email" className="field" placeholder="необязательно" value={form.email} onChange={set('email')} />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>
      </div>

      {serverError && (
        <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{serverError}</p>
      )}

      <div className="pt-2">
        <button type="submit" className="btn-primary w-full md:w-auto" disabled={submitting}>
          {submitting ? 'Отправка…' : 'Записаться'}
        </button>
        {selectedService && (
          <p className="text-xs text-muted mt-3">
            Ориентировочно: {selectedService.name}, {selectedService.duration_minutes} мин, {selectedService.price} ₽
          </p>
        )}
      </div>
    </form>
  );
}
