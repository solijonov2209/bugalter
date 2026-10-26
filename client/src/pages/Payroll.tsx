import { useState } from 'react';
import { useAuth } from '../auth';
import { api, currentPeriod, money, PAY_TYPES, useLive } from '../lib';
import Breakdown, { type Calc } from '../components/Breakdown';
import { Empty, ErrorText, Modal, PageHeader, PeriodPicker, StatusBadge } from '../components/ui';

interface Row {
  employee: { id: number; full_name: string; position: string; pay_type: string };
  live: Calc;
  saved: (Calc & { status: string; paid_at: string | null }) | null;
}

export default function Payroll() {
  const { me } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error, reload } = useLive<{ rows: Row[] }>(`/payroll?period=${period}`);
  const [selected, setSelected] = useState<number[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const rows = data?.rows ?? [];
  const allIds = rows.map((r) => r.employee.id);
  const targets = selected.length ? selected : allIds;

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setSelected([]);
      reload();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  const calculate = () => act(() => api('/payroll/calculate', { method: 'POST', body: { period, employee_ids: targets } }));
  const setStatus = (status: string) =>
    act(() => api('/payroll/status', { method: 'POST', body: { period, status, employee_ids: targets } }));

  const total = rows.reduce((s, r) => s + (r.saved ?? r.live).net, 0);
  const outdated = (r: Row) => r.saved?.status === 'draft' && r.saved.net !== r.live.net;

  return (
    <div>
      <PageHeader title="Oylik vedomosti">
        <PeriodPicker value={period} onChange={setPeriod} />
        <button className="btn-ghost" disabled={busy} onClick={calculate}>
          {selected.length ? `Tanlanganlarni hisoblash (${selected.length})` : 'Hammasini hisoblash'}
        </button>
        <button className="btn-ghost" disabled={busy} onClick={() => setStatus('approved')}>
          Tasdiqlash
        </button>
        <button className="btn-primary" disabled={busy} onClick={() => setStatus('paid')}>
          To'landi deb belgilash
        </button>
      </PageHeader>
      <p className="mb-4 text-sm text-slate-500">
        Jadvaldagi raqamlar jonli: tabel, bonus yoki o'quvchi to'lovi kiritilishi bilan yangilanadi. "Hisoblash" qoralamani saqlaydi,
        "Tasdiqlash" va "To'landi" uni qulflaydi. Hech narsa tanlanmasa, amal hamma xodimga qo'llanadi.
      </p>
      <ErrorText>{error || msg}</ErrorText>

      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? (
          <Empty>Faol xodimlar yo'q. Avval "Xodimlar" bo'limida xodim qo'shing.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={selected.length === rows.length}
                    onChange={(e) => setSelected(e.target.checked ? allIds : [])}
                  />
                </th>
                <th>Xodim</th>
                <th>Turi</th>
                <th className="text-right">Brutto</th>
                <th className="text-right">Soliq</th>
                <th className="text-right">Avans/ushl.</th>
                <th className="text-right">Qo'lga</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = r.saved ?? r.live;
                return (
                  <tr key={r.employee.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetail(r)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(r.employee.id)}
                        onChange={(e) =>
                          setSelected(e.target.checked ? [...selected, r.employee.id] : selected.filter((x) => x !== r.employee.id))
                        }
                      />
                    </td>
                    <td>
                      <div className="font-medium">{r.employee.full_name}</div>
                      <div className="text-xs text-slate-500">{r.employee.position}</div>
                    </td>
                    <td className="text-xs text-slate-600">{PAY_TYPES[r.employee.pay_type]}</td>
                    <td className="text-right tabular-nums">{money(v.gross)}</td>
                    <td className="text-right tabular-nums text-rose-700">{money(v.tax)}</td>
                    <td className="text-right tabular-nums text-rose-700">{money(v.advance + v.deductions)}</td>
                    <td className="text-right font-semibold tabular-nums">{money(v.net)}</td>
                    <td>
                      <StatusBadge status={r.saved?.status} />
                      {outdated(r) && <div className="mt-1 text-xs text-amber-700">O'zgargan, qayta hisoblang</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={6} className="px-3 py-3 text-right">
                  Jami qo'lga:
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{money(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {detail && (
        <Modal title={detail.employee.full_name} onClose={() => setDetail(null)}>
          {detail.saved && detail.saved.status !== 'draft' && (
            <p className="mb-3 text-sm text-slate-500">Bu oylik qulflangan, quyida saqlangan hisob ko'rsatilgan.</p>
          )}
          <Breakdown c={detail.saved && detail.saved.status !== 'draft' ? detail.saved : detail.live} taxRate={me?.org.tax_rate} />
        </Modal>
      )}
    </div>
  );
}
