import { useState, type FormEvent } from 'react';
import { ADJ_KINDS, api, currentPeriod, money, useLive } from '../lib';
import { Empty, ErrorText, Field, PageHeader, PeriodPicker } from '../components/ui';

interface Adj {
  id: number;
  employee_id: number;
  full_name: string;
  kind: string;
  amount: number;
  note: string;
  created_at: string;
}

export default function Adjustments() {
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error, reload } = useLive<Adj[]>(`/adjustments?period=${period}`);
  const { data: emps } = useLive<{ id: number; full_name: string; active: number }[]>('/employees');
  const [form, setForm] = useState({ employee_id: '', kind: 'bonus', amount: '', note: '' });
  const [err, setErr] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/adjustments', { method: 'POST', body: { ...form, period } });
      setForm({ ...form, amount: '', note: '' });
      reload();
    } catch (x: any) {
      setErr(x.message);
    }
  }

  async function remove(id: number) {
    await api(`/adjustments/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div>
      <PageHeader title="Bonus, avans va ushlanmalar">
        <PeriodPicker value={period} onChange={setPeriod} />
      </PageHeader>

      <form onSubmit={add} className="card mb-6 grid gap-3 sm:grid-cols-5 sm:items-end">
        <div className="sm:col-span-2">
          <Field label="Xodim">
            <select className="input" required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">Tanlang…</option>
              {emps?.filter((e) => e.active).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Turi">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(ADJ_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Summa (so'm)">
          <input className="input" type="number" min={1} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <button className="btn-primary">Qo'shish</button>
        <div className="sm:col-span-5">
          <input className="input" placeholder="Izoh (ixtiyoriy)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </form>

      <ErrorText>{error || err}</ErrorText>
      <div className="card overflow-x-auto p-0">
        {data?.length === 0 ? (
          <Empty>Bu oy uchun yozuvlar yo'q</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Xodim</th>
                <th>Turi</th>
                <th className="text-right">Summa</th>
                <th>Izoh</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.full_name}</td>
                  <td>{ADJ_KINDS[a.kind]}</td>
                  <td className={`text-right tabular-nums ${a.kind === 'bonus' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {money(a.amount)}
                  </td>
                  <td className="text-slate-500">{a.note}</td>
                  <td className="text-right">
                    <button className="btn-danger" onClick={() => remove(a.id)}>
                      O'chirish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
