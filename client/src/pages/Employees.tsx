import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { api, money, PAY_TYPES, useLive } from '../lib';
import { Empty, ErrorText, Field, Modal, PageHeader } from '../components/ui';

interface Employee {
  id: number;
  full_name: string;
  position: string;
  phone: string;
  pay_type: string;
  base_salary: number;
  rate: number;
  active: number;
  login_email: string | null;
}

const blank = { full_name: '', position: '', phone: '', pay_type: 'fixed', base_salary: 0, rate: 0, active: true };

const RATE_LABEL: Record<string, string> = {
  hourly: "Soatlik stavka (so'm)",
  per_student: "Har bir to'lagan o'quvchi uchun (so'm)",
  percent: "Guruh tushumidan foiz (%)",
};

export default function Employees() {
  const { me } = useAuth();
  const { data, error, reload } = useLive<Employee[]>('/employees');
  const [edit, setEdit] = useState<(typeof blank & { id?: number }) | null>(null);
  const [account, setAccount] = useState<Employee | null>(null);
  const [formErr, setFormErr] = useState('');
  const center = me?.org.type === 'center';
  const types = Object.entries(PAY_TYPES).filter(([k]) => center || (k !== 'per_student' && k !== 'percent'));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    try {
      await api(edit.id ? `/employees/${edit.id}` : '/employees', { method: edit.id ? 'PUT' : 'POST', body: edit });
      setEdit(null);
      reload();
    } catch (err: any) {
      setFormErr(err.message);
    }
  }

  async function remove(emp: Employee) {
    if (!confirm(`${emp.full_name} o'chirilsinmi? Uning barcha oylik tarixi ham o'chadi.`)) return;
    await api(`/employees/${emp.id}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    reload();
  }

  const payText = (e: Employee) => {
    const parts = [];
    if (e.base_salary) parts.push(`oklad ${money(e.base_salary)}`);
    if (e.pay_type === 'hourly') parts.push(`${money(e.rate)}/soat`);
    if (e.pay_type === 'per_student') parts.push(`${money(e.rate)}/o'quvchi`);
    if (e.pay_type === 'percent') parts.push(`tushumdan ${e.rate}%`);
    return parts.join(' + ') || '—';
  };

  return (
    <div>
      <PageHeader title={center ? "Xodimlar va o'qituvchilar" : 'Xodimlar'}>
        <button className="btn-primary" onClick={() => (setFormErr(''), setEdit({ ...blank }))}>
          + Xodim qo'shish
        </button>
      </PageHeader>
      <ErrorText>{error}</ErrorText>
      <div className="card overflow-x-auto p-0">
        {data?.length === 0 ? (
          <Empty>Hali xodim qo'shilmagan</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>F.I.Sh.</th>
                <th>Lavozim</th>
                <th>Hisoblash turi</th>
                <th>Stavka</th>
                <th>Kabinet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((e) => (
                <tr key={e.id} className={e.active ? '' : 'opacity-50'}>
                  <td className="font-medium">
                    {e.full_name}
                    {!e.active && <span className="ml-2 text-xs text-slate-500">(nofaol)</span>}
                    {e.phone && <div className="text-xs font-normal text-slate-500">{e.phone}</div>}
                  </td>
                  <td>{e.position}</td>
                  <td className="text-xs">{PAY_TYPES[e.pay_type]}</td>
                  <td className="tabular-nums">{payText(e)}</td>
                  <td>
                    <button className="text-sm text-indigo-600 hover:underline" onClick={() => (setFormErr(''), setAccount(e))}>
                      {e.login_email ?? 'Login berish'}
                    </button>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button
                      className="btn-ghost"
                      onClick={() => (setFormErr(''), setEdit({ ...e, active: !!e.active }))}
                    >
                      Tahrirlash
                    </button>
                    {me?.user.role === 'admin' && (
                      <button className="btn-danger" onClick={() => remove(e)}>
                        O'chirish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Xodimni tahrirlash' : 'Yangi xodim'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="F.I.Sh.">
                <input className="input" required value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
              </Field>
            </div>
            <Field label="Lavozim">
              <input className="input" value={edit.position} onChange={(e) => setEdit({ ...edit, position: e.target.value })} />
            </Field>
            <Field label="Telefon">
              <input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Field label="Oylik qanday hisoblanadi">
                <select className="input" value={edit.pay_type} onChange={(e) => setEdit({ ...edit, pay_type: e.target.value })}>
                  {types.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={edit.pay_type === 'fixed' ? "Oylik oklad (so'm)" : "Qat'iy qism (so'm, ixtiyoriy)"}>
              <input
                className="input"
                type="number"
                min={0}
                value={edit.base_salary}
                onChange={(e) => setEdit({ ...edit, base_salary: +e.target.value })}
              />
            </Field>
            {edit.pay_type !== 'fixed' && (
              <Field label={RATE_LABEL[edit.pay_type]}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="any"
                  value={edit.rate}
                  onChange={(e) => setEdit({ ...edit, rate: +e.target.value })}
                />
              </Field>
            )}
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              Faol (oylik hisoblanadi)
            </label>
            <div className="col-span-2">
              <ErrorText>{formErr}</ErrorText>
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>
                Bekor qilish
              </button>
              <button className="btn-primary">Saqlash</button>
            </div>
          </form>
        </Modal>
      )}

      {account && <AccountModal emp={account} onClose={() => setAccount(null)} onSaved={reload} />}
    </div>
  );
}

function AccountModal({ emp, onClose, onSaved }: { emp: Employee; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState(emp.login_email ?? '');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/employees/${emp.id}/account`, { method: 'POST', body: { email, password } });
      onSaved();
      onClose();
    } catch (x: any) {
      setErr(x.message);
    }
  }
  return (
    <Modal title={`${emp.full_name}: shaxsiy kabinet`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-500">
          Xodim shu login bilan kirib, o'z oyligini real vaqtda ko'radi. Boshqa xodimlarning ma'lumotlari unga ko'rinmaydi.
        </p>
        <Field label="Email (login)">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={emp.login_email ? 'Yangi parol' : 'Parol'}>
          <input className="input" type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end">
          <button className="btn-primary">Saqlash</button>
        </div>
      </form>
    </Modal>
  );
}
