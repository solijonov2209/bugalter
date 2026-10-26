import { useState, type FormEvent } from 'react';
import { api, money, useLive } from '../lib';
import { Empty, ErrorText, Field, Modal, PageHeader } from '../components/ui';

interface Group {
  id: number;
  name: string;
  teacher_id: number | null;
  teacher_name: string | null;
  monthly_fee: number;
  student_count: number;
}

const blank = { name: '', teacher_id: null as number | null, monthly_fee: 0 };

export default function Groups() {
  const { data, error, reload } = useLive<Group[]>('/groups');
  const { data: emps } = useLive<{ id: number; full_name: string; pay_type: string; active: number }[]>('/employees');
  const [edit, setEdit] = useState<(typeof blank & { id?: number }) | null>(null);
  const [err, setErr] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    try {
      await api(edit.id ? `/groups/${edit.id}` : '/groups', { method: edit.id ? 'PUT' : 'POST', body: edit });
      setEdit(null);
      reload();
    } catch (x: any) {
      setErr(x.message);
    }
  }

  async function remove(g: Group) {
    if (!confirm(`"${g.name}" guruhi o'chirilsinmi? O'quvchilar guruhsiz qoladi.`)) return;
    await api(`/groups/${g.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div>
      <PageHeader title="Guruhlar">
        <button className="btn-primary" onClick={() => (setErr(''), setEdit({ ...blank }))}>
          + Guruh qo'shish
        </button>
      </PageHeader>
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.length === 0 && (
          <div className="card sm:col-span-3">
            <Empty>Guruhlar yo'q</Empty>
          </div>
        )}
        {data?.map((g) => (
          <div key={g.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{g.name}</div>
                <div className="text-sm text-slate-500">{g.teacher_name ?? "O'qituvchi biriktirilmagan"}</div>
              </div>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {g.student_count} o'quvchi
              </span>
            </div>
            <div className="mt-3 text-sm">Oylik to'lov: {money(g.monthly_fee)}</div>
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost" onClick={() => (setErr(''), setEdit(g))}>
                Tahrirlash
              </button>
              <button className="btn-danger" onClick={() => remove(g)}>
                O'chirish
              </button>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Guruhni tahrirlash' : 'Yangi guruh'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-3">
            <Field label="Nomi">
              <input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="O'qituvchi">
              <select
                className="input"
                value={edit.teacher_id ?? ''}
                onChange={(e) => setEdit({ ...edit, teacher_id: e.target.value ? +e.target.value : null })}
              >
                <option value="">—</option>
                {emps?.filter((e) => e.active).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="O'quvchi uchun oylik to'lov (so'm)">
              <input className="input" type="number" min={0} value={edit.monthly_fee}
                onChange={(e) => setEdit({ ...edit, monthly_fee: +e.target.value })} />
            </Field>
            <ErrorText>{err}</ErrorText>
            <div className="flex justify-end">
              <button className="btn-primary">Saqlash</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
