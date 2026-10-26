import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { ADJ_KINDS, currentPeriod, money, useLive } from '../lib';
import Breakdown, { type Calc } from '../components/Breakdown';
import { Empty, ErrorText, PageHeader, PeriodPicker, Stat, StatusBadge } from '../components/ui';

interface Salary {
  employee: { full_name: string; position: string };
  live: Calc;
  saved: (Calc & { status: string; paid_at: string | null }) | null;
  adjustments: { id: number; kind: string; amount: number; note: string; created_at: string }[];
  history: { period: string; gross: number; tax: number; net: number; status: string; paid_at: string | null }[];
}

export default function MySalary() {
  const { me } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error } = useLive<Salary>(`/me/salary?period=${period}`);
  const [flash, setFlash] = useState(false);

  // Server o'zgarish yuborganda kartani qisqa yoritib qo'yamiz
  const net = data ? (data.saved && data.saved.status !== 'draft' ? data.saved : data.live).net : null;
  useEffect(() => {
    if (net === null) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(t);
  }, [net]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return null;
  const locked = data.saved && data.saved.status !== 'draft';
  const calc = locked ? data.saved! : data.live;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Salom, ${data.employee.full_name.split(' ').slice(-1)[0]}!`}>
        <PeriodPicker value={period} onChange={setPeriod} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className={`transition ${flash ? 'ring-4 ring-emerald-200 rounded-xl' : ''}`}>
          <Stat
            label={locked ? "Qo'lga beriladi" : "Hozircha qo'lga"}
            value={money(calc.net)}
            accent="text-emerald-700"
            hint={
              <span className="flex items-center gap-2">
                <StatusBadge status={data.saved?.status} />
                {!locked && <span className="flex items-center gap-1"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> jonli</span>}
              </span>
            }
          />
        </div>
        <Stat label="Hisoblangan" value={money(calc.gross)} />
        <Stat label="Soliq va ushlanmalar" value={money(calc.tax + calc.deductions + calc.advance)} accent="text-rose-700" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Qanday hisoblandi</h2>
          <Breakdown c={calc} taxRate={me?.org.tax_rate} />
        </div>
        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-3 font-semibold">Shu oydagi bonus, avans, ushlanmalar</h2>
            {data.adjustments.length === 0 ? (
              <p className="text-sm text-slate-500">Hozircha yo'q.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data.adjustments.map((a) => (
                  <li key={a.id} className="flex justify-between py-2">
                    <span>
                      {ADJ_KINDS[a.kind]}
                      {a.note && <span className="text-slate-500"> — {a.note}</span>}
                    </span>
                    <span className={`tabular-nums ${a.kind === 'bonus' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {a.kind === 'bonus' ? '+' : '−'}
                      {money(a.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-0">
            <h2 className="px-4 pt-4 font-semibold">Oyliklar tarixi</h2>
            {data.history.length === 0 ? (
              <Empty>Hali yopilgan oylar yo'q</Empty>
            ) : (
              <table className="table mt-2">
                <thead>
                  <tr>
                    <th>Oy</th>
                    <th className="text-right">Qo'lga</th>
                    <th>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.period}>
                      <td>{h.period}</td>
                      <td className="text-right tabular-nums">{money(h.net)}</td>
                      <td>
                        <StatusBadge status={h.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
