import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { currentPeriod, money, useLive } from '../lib';
import { ErrorText, PageHeader, PeriodPicker, Stat } from '../components/ui';

interface Dash {
  employees: number;
  totals: { gross: number; tax: number; net: number; paid: number; handed: number };
  center: { students: number; groups: number; revenue: number };
  trend: { period: string; gross: number; net: number }[];
}

export default function Dashboard() {
  const { me } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error } = useLive<Dash>(`/dashboard?period=${period}`);
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return null;
  const center = me?.org.type === 'center';
  const max = Math.max(1, ...data.trend.map((t) => t.gross));

  return (
    <div>
      <PageHeader title="Bosh sahifa">
        <PeriodPicker value={period} onChange={setPeriod} />
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hisoblangan fond" value={money(data.totals.gross)} hint={`${data.employees} ta faol xodim`} />
        <Stat label="Soliq" value={money(data.totals.tax)} accent="text-rose-700" />
        <Stat label="Qo'lga beriladi" value={money(data.totals.net)} accent="text-indigo-700" />
        <Stat
          label="To'langan"
          value={money(data.totals.paid)}
          accent="text-emerald-700"
          hint={
            data.totals.handed
              ? `Qo'lga berilgan: ${money(data.totals.handed)} · Qoldiq: ${money(data.totals.net - data.totals.paid - data.totals.handed)}`
              : `Qoldiq: ${money(data.totals.net - data.totals.paid)}`
          }
        />
      </div>

      {center && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Faol o'quvchilar" value={data.center.students} hint={`${data.center.groups} ta guruh`} />
          <Stat label="Shu oy tushum" value={money(data.center.revenue)} accent="text-emerald-700" />
          <Stat
            label="Oylik fondi / tushum"
            value={data.center.revenue ? `${Math.round((data.totals.gross / data.center.revenue) * 100)}%` : '—'}
            hint="Tushumning qancha qismi oylikka ketadi"
          />
        </div>
      )}

      <div className="mt-6 card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Oxirgi oylar bo'yicha oylik fondi</h2>
          <Link to="/payroll" className="text-sm text-indigo-600 hover:underline">
            Vedomostga o'tish →
          </Link>
        </div>
        {data.trend.length === 0 ? (
          <p className="text-sm text-slate-500">Hali saqlangan vedomost yo'q.</p>
        ) : (
          <div className="flex h-48 items-end gap-4">
            {data.trend.map((t) => (
              <div key={t.period} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-xs tabular-nums text-slate-500">{(t.gross / 1e6).toFixed(1)} mln</div>
                <div className="w-full max-w-16 rounded-t-md bg-indigo-500" style={{ height: `${(t.gross / max) * 140}px` }} />
                <div className="text-xs text-slate-600">{t.period}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
