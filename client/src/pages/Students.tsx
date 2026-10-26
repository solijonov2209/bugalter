import { useState, type FormEvent } from 'react';
import { api, currentPeriod, money, useLive } from '../lib';
import { Empty, ErrorText, Field, Modal, PageHeader, PeriodPicker } from '../components/ui';

interface Student {
  id: number;
  full_name: string;
  phone: string;
  group_id: number | null;
  group_name: string | null;
  monthly_fee: number | null;
  active: number;
  paid: number;
}

const blank = { full_name: '', phone: '', group_id: null as number | null, active: true };

export default function Students() {
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error, reload } = useLive<Student[]>(`/students?period=${period}`);
  const { data: groups } = useLive<{ id: number; name: string }[]>('/groups');
  const [edit, setEdit] = useState<(typeof blank & { id?: number }) | null>(null);
  const [pay, setPay] = useState<{ student: Student; amount: number } | null>(null);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');

  const list = (data ?? []).filter(
    (s) => !filter || (filter === 'debt' ? s.active && s.paid < (s.monthly_fee ?? 0) : String(s.group_id) === filter),
  );
  const paidCount = (data ?? []).filter((s) => s.paid > 0).length;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    try {
      await api(edit.id ? `/students/${edit.id}` : '/students', { method: edit.id ? 'PUT' : 'POST', body: edit });
      setEdit(null);
      reload();
    } catch (x: any) {
      setErr(x.message);
    }
  }

  async function savePayment(e: FormEvent) {
    e.preventDefault();
    if (!pay) return;
    try {
      await api('/student-payments', { method: 'POST', body: { student_id: pay.student.id, period, amount: pay.amount } });
      setPay(null);
      reload();
    } catch (x: any) {
      setErr(x.message);
    }
  }

  async function remove(s: Student) {
    if (!confirm(`${s.full_name} o'chirilsinmi? To'lovlari ham o'chadi.`)) return;
    await api(`/students/${s.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div>
      <PageHeader title="O'quvchilar va to'lovlar">
        <PeriodPicker value={period} onChange={setPeriod} />
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Barcha guruhlar</option>
          <option value="debt">Faqat qarzdorlar</option>
          {groups?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={() => (setErr(''), setEdit({ ...blank }))}>
          + O'quvchi
        </button>
      </PageHeader>
      <p className="mb-4 text-sm text-slate-500">
        {period} oyi: {paidCount} / {data?.length ?? 0} o'quvchi to'lov qilgan. O'qituvchining oyligi shu oy to'lagan o'quvchilar
        soniga (yoki tushumiga) qarab avtomatik hisoblanadi.
      </p>
      <ErrorText>{error || (!edit && !pay && err)}</ErrorText>
      <div className="card overflow-x-auto p-0">
        {list.length === 0 ? (
          <Empty>O'quvchilar topilmadi</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>O'quvchi</th>
                <th>Guruh</th>
                <th className="text-right">Shu oy to'ladi</th>
                <th>Holat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const fee = s.monthly_fee ?? 0;
                const status =
                  s.paid >= fee && s.paid > 0
                    ? ['To\'langan', 'bg-emerald-100 text-emerald-800']
                    : s.paid > 0
                      ? ['Qisman', 'bg-amber-100 text-amber-800']
                      : ['To\'lamagan', 'bg-rose-100 text-rose-700'];
                return (
                  <tr key={s.id} className={s.active ? '' : 'opacity-50'}>
                    <td className="font-medium">
                      {s.full_name}
                      {s.phone && <div className="text-xs font-normal text-slate-500">{s.phone}</div>}
                    </td>
                    <td>{s.group_name ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {money(s.paid)}
                      {fee > 0 && <div className="text-xs text-slate-500">/ {money(fee)}</div>}
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status[1]}`}>{status[0]}</span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="btn-primary"
                        disabled={!s.group_id}
                        title={s.group_id ? '' : 'Avval guruhga biriktiring'}
                        onClick={() => (setErr(''), setPay({ student: s, amount: Math.max(fee - s.paid, 0) || fee }))}
                      >
                        To'lov
                      </button>
                      <button className="btn-ghost ml-1" onClick={() => (setErr(''), setEdit({ ...s, active: !!s.active }))}>
                        Tahrirlash
                      </button>
                      <button className="btn-danger" onClick={() => remove(s)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? "O'quvchini tahrirlash" : "Yangi o'quvchi"} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-3">
            <Field label="F.I.Sh.">
              <input className="input" required value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
            </Field>
            <Field label="Telefon">
              <input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <Field label="Guruh">
              <select className="input" value={edit.group_id ?? ''}
                onChange={(e) => setEdit({ ...edit, group_id: e.target.value ? +e.target.value : null })}>
                <option value="">—</option>
                {groups?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              Faol (o'qiyapti)
            </label>
            <ErrorText>{err}</ErrorText>
            <div className="flex justify-end">
              <button className="btn-primary">Saqlash</button>
            </div>
          </form>
        </Modal>
      )}

      {pay && (
        <Modal title={`To'lov: ${pay.student.full_name}`} onClose={() => setPay(null)}>
          <form onSubmit={savePayment} className="space-y-3">
            <p className="text-sm text-slate-500">
              {period} oyi uchun, guruh: {pay.student.group_name}
            </p>
            <Field label="Summa (so'm)">
              <input className="input" type="number" min={1} required value={pay.amount}
                onChange={(e) => setPay({ ...pay, amount: +e.target.value })} />
            </Field>
            <ErrorText>{err}</ErrorText>
            <div className="flex justify-end">
              <button className="btn-primary">Qabul qilish</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
