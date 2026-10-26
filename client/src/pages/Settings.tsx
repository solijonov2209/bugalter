import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { api } from '../lib';
import { ErrorText, Field, PageHeader } from '../components/ui';

export default function Settings() {
  const { me, refresh } = useAuth();
  const [form, setForm] = useState({ name: me!.org.name, type: me!.org.type, tax_rate: me!.org.tax_rate });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const admin = me?.user.role === 'admin';

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/org', { method: 'PATCH', body: form });
      await refresh();
      setMsg('Saqlandi');
    } catch (x: any) {
      setErr(x.message);
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="Sozlamalar" />
      <form onSubmit={save} className="card space-y-4">
        <Field label="Tashkilot nomi">
          <input className="input" disabled={!admin} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Turi">
          <select className="input" disabled={!admin} value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as 'company' | 'center' })}>
            <option value="company">Korxona</option>
            <option value="center">O'quv markazi (guruhlar, o'quvchilar, o'quvchiga qarab oylik)</option>
          </select>
        </Field>
        <Field label="Jismoniy shaxslar daromad solig'i (%)">
          <input className="input" type="number" min={0} max={100} step="0.1" disabled={!admin} value={form.tax_rate}
            onChange={(e) => setForm({ ...form, tax_rate: +e.target.value })} />
        </Field>
        <p className="text-xs text-slate-500">
          Soliq stavkasi o'zgarsa, qoralama holatidagi oyliklar qayta hisoblanadi. Tasdiqlangan va to'langan oyliklar o'zgarmaydi.
        </p>
        <ErrorText>{err}</ErrorText>
        {admin ? (
          <div className="flex items-center justify-end gap-3">
            {msg && <span className="text-sm text-emerald-700">{msg}</span>}
            <button className="btn-primary">Saqlash</button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Sozlamalarni faqat administrator o'zgartira oladi.</p>
        )}
      </form>
    </div>
  );
}
