import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(login.trim(), password);
      nav('/admin');
    } catch (err) {
      setError(err.details?.message || err.message || 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-br from-cream via-white to-[#f3e9e4]">
      <form onSubmit={submit} className="card w-full max-w-sm p-8 space-y-5">
        <div className="text-center">
          <p className="font-serif text-3xl mb-1">Astra<span className="text-rose">.</span></p>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Панель управления</p>
        </div>
        <div>
          <label className="label" htmlFor="l">Логин / Email</label>
          <input id="l" className="field" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="admin@astra.com" />
        </div>
        <div>
          <label className="label" htmlFor="p">Пароль</label>
          <input id="p" type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Вход…' : 'Войти'}</button>
        <a href="#forgot" onClick={(e) => { e.preventDefault(); setError('Восстановление пароля: обратитесь к супер-администратору салона.'); }} className="block text-center text-xs text-muted hover:text-rose">
          Забыли пароль?
        </a>
      </form>
    </div>
  );
}
