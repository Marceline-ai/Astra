import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate, NavLink } from 'react-router-dom';
import { api } from '../../api.js';

const NAV = [
  { to: '/admin', label: 'Главная', icon: '◈', end: true },
  { to: '/admin/schedule', label: 'Расписание', icon: '▦' },
  { to: '/admin/bookings', label: 'Записи', icon: '☰' },
  { to: '/admin/settings', label: 'Настройки', icon: '⚙' },
];

export default function AdminLayout() {
  const [user, setUser] = useState(undefined); // undefined = идёт проверка, null = не авторизован
  const nav = useNavigate();

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="min-h-screen grid place-items-center text-muted">Проверка сессии…</div>;
  if (user === null) return <Navigate to="/admin/login" replace />;

  async function logout() {
    await api.logout().catch(() => {});
    nav('/admin/login');
  }

  return (
    <div className="min-h-screen bg-cream pb-20 lg:pb-0">
      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-line p-6 z-30">
        <p className="font-serif text-2xl mb-10">Astra<span className="text-rose">.</span> <span className="text-xs font-sans text-muted align-middle">ADMIN</span></p>
        <nav className="flex flex-col gap-1.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? 'bg-ink text-white' : 'text-ink/70 hover:bg-cream'
                }`
              }
            >
              <span aria-hidden>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-line">
          <p className="text-sm font-semibold truncate">{user.firstname} {user.lastname}</p>
          <p className="text-xs text-muted mb-3">{user.role}</p>
          <button onClick={logout} className="text-xs text-rose hover:underline">Выйти</button>
        </div>
      </aside>

      {/* Topbar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-line px-4 h-14 flex items-center justify-between">
        <p className="font-serif text-xl">Astra<span className="text-rose">.</span></p>
        <button onClick={logout} className="text-xs text-muted">Выйти</button>
      </header>

      <main className="lg:ml-60 px-4 md:px-8 py-6 max-w-[1400px]">
        <Outlet context={{ user }} />
      </main>

      {/* Bottom tab bar (Mobile) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line grid grid-cols-4">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-ink' : 'text-muted'}`
            }
          >
            <span className="text-base" aria-hidden>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
