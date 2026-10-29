import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../lib';
import { ErrorText, Field } from '../components/ui';

const TITLES = {
  login: 'Tizimga kirish',
  register: "Tashkilotni ro'yxatdan o'tkazish",
  reset: 'Parolni tiklash',
};

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [form, setForm] = useState({ email: '', password: '', orgName: '', orgType: 'company', key: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'reset') {
        await api('/auth/reset-password', { method: 'POST', body: { key: form.key, email: form.email, password: form.password } });
        setMode('login');
        setInfo('Parol yangilandi, endi yangi parol bilan kiring.');
        return;
      }
      const { token } = await api('/auth/' + mode, { method: 'POST', body: form });
      await login(token);
      nav('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Bugalter</div>
          <h1 className="text-xl font-semibold">{TITLES[mode]}</h1>
        </div>
        {mode === 'register' && (
          <>
            <Field label="Tashkilot nomi">
              <input className="input" required value={form.orgName} onChange={set('orgName')} />
            </Field>
            <Field label="Turi">
              <select className="input" value={form.orgType} onChange={set('orgType')}>
                <option value="company">Korxona</option>
                <option value="center">O'quv markazi</option>
              </select>
            </Field>
          </>
        )}
        <Field label="Email">
          <input className="input" type="email" required value={form.email} onChange={set('email')} />
        </Field>
        {mode === 'reset' && (
          <>
            <p className="text-sm text-slate-500">
              Tiklash kaliti Render'dagi service sozlamalarida, Environment bo'limida <code>ADMIN_RESET_KEY</code> nomi bilan turadi.
            </p>
            <Field label="Tiklash kaliti">
              <input className="input" required value={form.key} onChange={set('key')} />
            </Field>
          </>
        )}
        <Field label={mode === 'reset' ? 'Yangi parol' : 'Parol'}>
          <input className="input" type="password" required minLength={6} value={form.password} onChange={set('password')} />
        </Field>
        <ErrorText>{error}</ErrorText>
        {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {mode === 'login' ? 'Kirish' : mode === 'register' ? "Ro'yxatdan o'tish" : 'Parolni yangilash'}
        </button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="text-indigo-600 hover:underline"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Yangi tashkilot ochish' : 'Kirish sahifasiga qaytish'}
          </button>
          {mode === 'login' && (
            <button type="button" className="text-slate-500 hover:underline" onClick={() => setMode('reset')}>
              Parolni unutdingizmi?
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
