import { useEffect, useState } from 'react';
import { api, currentPeriod, PAY_TYPES, useLive } from '../lib';
import { Empty, ErrorText, PageHeader, PeriodPicker } from '../components/ui';

interface Row {
  employee_id: number;
  full_name: string;
  pay_type: string;
  work_days: number | null;
  worked_days: number | null;
  hours: number | null;
}

export default function Attendance() {
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error, reload } = useLive<Row[]>(`/attendance?period=${period}`);
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState<number | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (data) setRows(data.map((r) => ({ ...r, work_days: r.work_days ?? 22, worked_days: r.worked_days ?? 22, hours: r.hours ?? 0 })));
  }, [data]);

  const update = (id: number, patch: Partial<Row>) => setRows(rows.map((r) => (r.employee_id === id ? { ...r, ...patch } : r)));

  async function save(r: Row) {
    setErr('');
    try {
      await api('/attendance', { method: 'PUT', body: { period, ...r } });
      setSaved(r.employee_id);
      setTimeout(() => setSaved(null), 1500);
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <PageHeader title="Tabel">
        <PeriodPicker value={period} onChange={setPeriod} />
      </PageHeader>
      <p className="mb-4 text-sm text-slate-500">
        Oklad ishlangan kunlarga mutanosib hisoblanadi. Soatbay xodimlar uchun soatlarni kiriting. Tabel kiritilmagan oy to'liq
        ishlangan deb olinadi.
      </p>
      <ErrorText>{error || err}</ErrorText>
      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? (
          <Empty>Faol xodimlar yo'q</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Xodim</th>
                <th>Ish kunlari (reja)</th>
                <th>Ishlangan kunlar</th>
                <th>Soatlar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee_id}>
                  <td>
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-slate-500">{PAY_TYPES[r.pay_type]}</div>
                  </td>
                  <td>
                    <input className="input w-24" type="number" min={0} max={31} value={r.work_days ?? 0}
                      onChange={(e) => update(r.employee_id, { work_days: +e.target.value })} />
                  </td>
                  <td>
                    <input className="input w-24" type="number" min={0} max={31} value={r.worked_days ?? 0}
                      onChange={(e) => update(r.employee_id, { worked_days: +e.target.value })} />
                  </td>
                  <td>
                    <input className="input w-24" type="number" min={0} step="any" value={r.hours ?? 0}
                      onChange={(e) => update(r.employee_id, { hours: +e.target.value })} />
                  </td>
                  <td className="text-right">
                    <button className="btn-ghost" onClick={() => save(r)}>
                      {saved === r.employee_id ? 'Saqlandi ✓' : 'Saqlash'}
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
