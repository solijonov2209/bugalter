import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { api, currentPeriod, money, today, useLive } from '../lib';
import { Empty, ErrorText, Field, PageHeader, PeriodPicker } from '../components/ui';

interface Payout {
  id: number;
  employee_id: number;
  full_name: string;
  amount: number;
  given_on: string;
  note: string;
}

interface SheetRow {
  employee: { id: number; full_name: string };
  live: { net: number };
  saved: { net: number; status: string } | null;
  handed: number;
}

/** O'qituvchi/xodimga oylik hisobidan tashqari qo'lga berilgan pullar */
export default function CashPayouts() {
  const { me } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error, reload } = useLive<Payout[]>(`/cash-payouts?period=${period}`);
  const { data: sheet } = useLive<{ rows: SheetRow[] }>(`/payroll?period=${period}`);
  const [form, setForm] = useState({ employee_id: '', amount: '', given_on: today(), note: '' });
  const [err, setErr] = useState('');
  const who = me?.org.type === 'center' ? "O'qituvchi" : 'Xodim';

  async function add(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/cash-payouts', { method: 'POST', body: { ...form, period } });
      setForm({ ...form, amount: '', note: '' });
      reload();
    } catch (x: any) {
      setErr(x.message);
    }
  }

  async function remove(id: number) {
    await api(`/cash-payouts/${id}`, { method: 'DELETE' });
    reload();
  }

  const totals = (sheet?.rows ?? []).filter((r) => r.handed > 0);

  return (
    <div>
      <PageHeader title="Qo'lga berilgan pullar">
        <PeriodPicker value={period} onChange={setPeriod} />
      </PageHeader>
      <p className="mb-4 text-sm text-slate-500">
        {who}ga shu oy oyligi hisobidan qo'lga (naqd) berilgan summalarni kiriting. Ular oylikning qolgan qismidan ayiriladi va{' '}
        {who.toLowerCase()} kabinetida darhol ko'rinadi.
      </p>

      <form onSubmit={add} className="card mb-6 grid gap-3 sm:grid-cols-5 sm:items-end">
        <div className="sm:col-span-2">
          <Field label={who}>
            <select className="input" required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">Tanlang…</option>
              {sheet?.rows.map((r) => (
                <option key={r.employee.id} value={r.employee.id}>
                  {r.employee.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Sana">
          <input className="input" type="date" required value={form.given_on} onChange={(e) => setForm({ ...form, given_on: e.target.value })} />
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

      {totals.length > 0 && (
        <div className="card mb-6 overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>{who}</th>
                <th className="text-right">Oylik (qo'lga)</th>
                <th className="text-right">Qo'lga berilgan</th>
                <th className="text-right">Qoldiq</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((r) => {
                const net = (r.saved && r.saved.status !== 'draft' ? r.saved : r.live).net;
                const rest = net - r.handed;
                return (
                  <tr key={r.employee.id}>
                    <td className="font-medium">{r.employee.full_name}</td>
                    <td className="text-right tabular-nums">{money(net)}</td>
                    <td className="text-right tabular-nums text-rose-700">{money(r.handed)}</td>
                    <td className={`text-right font-semibold tabular-nums ${rest < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {money(rest)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        {data?.length === 0 ? (
          <Empty>Bu oy uchun qo'lga berilgan pul yo'q</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>{who}</th>
                <th className="text-right">Summa</th>
                <th>Izoh</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((c) => (
                <tr key={c.id}>
                  <td className="tabular-nums">{c.given_on}</td>
                  <td className="font-medium">{c.full_name}</td>
                  <td className="text-right tabular-nums text-rose-700">{money(c.amount)}</td>
                  <td className="text-slate-500">{c.note}</td>
                  <td className="text-right">
                    <button className="btn-danger" onClick={() => remove(c.id)}>
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
