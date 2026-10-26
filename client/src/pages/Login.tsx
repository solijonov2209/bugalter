import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../lib';
import { ErrorText, Field } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', orgName: '', orgType: 'company' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
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
          <h1 className="text-xl font-semibold">{mode === 'login' ? 'Tizimga kirish' : "Tashkilotni ro'yxatdan o'tkazish"}</h1>
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
        <Field label="Parol">
          <input className="input" type="password" required minLength={6} value={form.password} onChange={set('password')} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={busy}>
          {mode === 'login' ? 'Kirish' : "Ro'yxatdan o'tish"}
        </button>
        <button
          type="button"
          className="w-full text-center text-sm text-indigo-600 hover:underline"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? "Yangi tashkilot ochish" : 'Akkauntim bor — kirish'}
        </button>
      </form>
    </div>
  );
}
