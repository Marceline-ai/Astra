import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAYS_RU = { monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср', thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Вс' };

export default function SettingsPage() {
  const [tab, setTab] = useState('categories');
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-2xl lg:text-3xl">Настройки</h1>
      <p className="text-sm text-muted -mt-3">Изменения справочников мгновенно отражаются в клиентской форме записи.</p>
      <div className="flex gap-2 flex-wrap">
        {[['categories', 'Категории'], ['services', 'Услуги'], ['masters', 'Мастера']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition ${tab === k ? 'bg-ink text-white border-ink' : 'bg-white border-line hover:border-rose'}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'services' && <ServicesTab />}
      {tab === 'masters' && <MastersTab />}
    </div>
  );
}

// ---------------------------------------------------------------- Categories
function CategoriesTab() {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({ name: '', description: '', sort_order: 0 });
  const load = () => api.categoriesAll().then(setRows).catch(() => {});
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    await api.createCategory(draft);
    setDraft({ name: '', description: '', sort_order: rows.length + 1 });
    load();
  }
  async function del(id) {
    if (!confirm('Удалить категорию?')) return;
    await api.deleteCategory(id);
    load();
  }

  return (
    <div className="card p-5 space-y-4">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted">
          <tr><th className="py-2">Порядок</th><th className="py-2">Название</th><th className="py-2 hidden md:table-cell">Описание</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-line">
              <td className="py-2.5 w-16">{c.sort_order}</td>
              <td className="py-2.5 font-medium">{c.name}</td>
              <td className="py-2.5 text-muted hidden md:table-cell max-w-[300px] truncate">{c.description}</td>
              <td className="py-2.5 text-right"><button onClick={() => del(c.id)} className="text-xs text-red-600 hover:underline">Удалить</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={add} className="grid md:grid-cols-4 gap-3 pt-3 border-t border-line">
        <input className="field" placeholder="Название категории" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className="field md:col-span-2" placeholder="Описание" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <button className="btn-primary !py-2.5 text-sm">+ Добавить</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- Services
function ServicesTab() {
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [draft, setDraft] = useState({ name: '', category_id: '', price: '', duration_minutes: '' });
  const load = () => Promise.all([api.servicesAll(), api.categoriesAll()]).then(([s, c]) => { setRows(s); setCats(c); }).catch(() => {});
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!draft.name || !draft.price || !draft.duration_minutes) return;
    await api.createService({
      name: draft.name,
      category_id: draft.category_id ? +draft.category_id : null,
      price: +draft.price,
      duration_minutes: +draft.duration_minutes,
    });
    setDraft({ name: '', category_id: '', price: '', duration_minutes: '' });
    load();
  }
  async function toggleActive(s) {
    await api.updateService(s.id, { is_active: !s.is_active });
    load();
  }
  async function del(id) {
    if (!confirm('Удалить услугу?')) return;
    await api.deleteService(id);
    load();
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="text-left text-xs uppercase text-muted">
            <tr><th className="py-2">Услуга</th><th className="py-2">Категория</th><th className="py-2">Цена, ₽</th><th className="py-2">Мин</th><th className="py-2">Активна</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="py-2.5 font-medium">{s.name}</td>
                <td className="py-2.5 text-muted">{cats.find((c) => c.id === s.category_id)?.name || '—'}</td>
                <td className="py-2.5">{s.price}</td>
                <td className="py-2.5">{s.duration_minutes}</td>
                <td className="py-2.5">
                  <button onClick={() => toggleActive(s)} className={`w-10 h-6 rounded-full transition ${s.is_active ? 'bg-success' : 'bg-gray-300'} relative`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${s.is_active ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ left: s.is_active ? '18px' : '2px' }} />
                  </button>
                </td>
                <td className="py-2.5 text-right"><button onClick={() => del(s.id)} className="text-xs text-red-600 hover:underline">Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={add} className="grid md:grid-cols-5 gap-3 pt-3 border-t border-line">
        <input className="field" placeholder="Название услуги" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <select className="field" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
          <option value="">Без категории</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="field" type="number" min="0" placeholder="Цена" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        <input className="field" type="number" min="5" step="5" placeholder="Длит., мин" value={draft.duration_minutes} onChange={(e) => setDraft({ ...draft, duration_minutes: e.target.value })} />
        <button className="btn-primary !py-2.5 text-sm">+ Добавить</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- Masters
function MastersTab() {
  const [rows, setRows] = useState([]);
  const load = () => api.mastersAll().then(setRows).catch(() => {});
  useEffect(load, []);
  const [sel, setSel] = useState(null);

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="card p-5 space-y-2">
        <h3 className="font-semibold mb-2">Мастера</h3>
        {rows.map((m) => (
          <button key={m.id} onClick={() => setSel(m)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition ${String(sel?.id) === String(m.id) ? 'border-rose bg-rose/5' : 'border-line hover:bg-cream'}`}>
            <p className="font-medium">{m.firstname} {m.lastname}</p>
            <p className="text-xs text-muted">{m.speciality} · ★ {Number(m.rating_avg || 0).toFixed(1)}</p>
          </button>
        ))}
      </div>
      {sel ? <MasterEditor master={sel} onSaved={load} /> : <p className="text-muted self-center">Выберите мастера для редактирования графика и специализации.</p>}
    </div>
  );
}

function MasterEditor({ master, onSaved }) {
  const [spec, setSpec] = useState(master.speciality || '');
  const [bio, setBio] = useState(master.bio || '');
  const [sched, setSched] = useState([]);
  const [exc, setExc] = useState([]);
  const [msg, setMsg] = useState('');
  const [newExc, setNewExc] = useState({ exception_date: '', is_working: false, reason: '' });

  useEffect(() => {
    setSpec(master.speciality || '');
    setBio(master.bio || '');
    api.masterSchedules(master.id).then((r) => {
      // одна строка на день недели: active если есть запись для дня
      const byDay = Object.fromEntries((r || []).map((s) => [s.day_of_week, s]));
      setSched(DAYS.map((d) => ({ day_of_week: d, active: !!byDay[d], start_time: byDay[d]?.start_time || '09:00', end_time: byDay[d]?.end_time || '20:00' })));
    });
    api.masterExceptions(master.id).then(setExc).catch(() => setExc([]));
  }, [master.id]);

  async function saveProfile() {
    await api.updateMaster(master.id, { speciality: spec, bio });
    setMsg('Профиль сохранён');
    onSaved();
  }

  async function saveSchedule() {
    const body = { schedules: sched.filter((s) => s.active).map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time })) };
    await api.putMasterSchedules(master.id, body);
    setMsg('График сохранён — слоты на сайте обновятся сразу');
  }

  async function addException(e) {
    e.preventDefault();
    if (!newExc.exception_date) return;
    await api.createException(master.id, newExc);
    setNewExc({ exception_date: '', is_working: false, reason: '' });
    api.masterExceptions(master.id).then(setExc);
  }

  return (
    <div className="card p-5 space-y-5">
      <h3 className="font-semibold">{master.firstname} {master.lastname}</h3>
      <div className="space-y-3">
        <div>
          <label className="label">Специализация</label>
          <input className="field" value={spec} onChange={(e) => setSpec(e.target.value)} />
        </div>
        <div>
          <label className="label">О мастере</label>
          <textarea className="field" rows="2" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <button onClick={saveProfile} className="btn-primary !py-2 text-sm">Сохранить профиль</button>
      </div>

      <div>
        <label className="label">График работы (повторяющийся)</label>
        <div className="space-y-2">
          {sched.map((s, i) => (
            <div key={s.day_of_week} className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2 w-20">
                <input type="checkbox" checked={s.active} className="accent-rose"
                  onChange={(e) => setSched(sched.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} />
                <span>{DAYS_RU[s.day_of_week]}</span>
              </label>
              {s.active ? (
                <>
                  <input type="time" className="field !w-28 !py-1.5" value={s.start_time}
                    onChange={(e) => setSched(sched.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))} />
                  <span className="text-muted">—</span>
                  <input type="time" className="field !w-28 !py-1.5" value={s.end_time}
                    onChange={(e) => setSched(sched.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))} />
                </>
              ) : <span className="text-muted text-xs">выходной</span>}
            </div>
          ))}
        </div>
        <button onClick={saveSchedule} className="btn-primary !py-2 text-sm mt-3">Сохранить график</button>
      </div>

      <div>
        <label className="label">Исключения (отпуска / праздники)</label>
        <div className="space-y-1 mb-3">
          {exc.map((x) => (
            <div key={x.id} className="flex justify-between items-center text-sm bg-cream rounded-lg px-3 py-2">
              <span>{x.exception_date?.slice(0, 10)} — {x.is_working ? `работает ${x.start_time || ''}-${x.end_time || ''}` : 'выходной'}{x.reason ? ` (${x.reason})` : ''}</span>
              <button className="text-xs text-red-600" onClick={async () => { await api.deleteException(x.id); api.masterExceptions(master.id).then(setExc); }}>✕</button>
            </div>
          ))}
          {!exc.length && <p className="text-xs text-muted">Нет исключений</p>}
        </div>
        <form onSubmit={addException} className="flex flex-wrap gap-2">
          <input type="date" className="field !w-auto" value={newExc.exception_date} onChange={(e) => setNewExc({ ...newExc, exception_date: e.target.value })} />
          <label className="flex items-center gap-2 text-sm px-2">
            <input type="checkbox" className="accent-rose" checked={newExc.is_working} onChange={(e) => setNewExc({ ...newExc, is_working: e.target.checked })} />
            рабочий день
          </label>
          <input className="field flex-1 min-w-[120px]" placeholder="Причина" value={newExc.reason} onChange={(e) => setNewExc({ ...newExc, reason: e.target.value })} />
          <button className="btn-rose !py-2 text-sm">+ Исключение</button>
        </form>
      </div>

      {msg && <p className="text-sm text-success">{msg}</p>}
    </div>
  );
}
