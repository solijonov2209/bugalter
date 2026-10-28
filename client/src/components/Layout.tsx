import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

const ROLE: Record<string, string> = { admin: 'Administrator', accountant: 'Buxgalter', employee: 'Xodim' };

export default function Layout() {
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!me) return null;

  const staff = me.user.role !== 'employee';
  const center = me.org.type === 'center';
  const links = staff
    ? [
        { to: '/', label: 'Bosh sahifa' },
        { to: '/payroll', label: 'Oylik vedomosti' },
        { to: '/employees', label: center ? "Xodimlar va o'qituvchilar" : 'Xodimlar' },
        { to: '/attendance', label: 'Tabel' },
        { to: '/adjustments', label: 'Bonus / avans / ushlanma' },
        { to: '/cash-payouts', label: "Qo'lga berilgan pullar" },
        ...(center
          ? [
              { to: '/groups', label: 'Guruhlar' },
              { to: '/students', label: "O'quvchilar va to'lovlar" },
            ]
          : []),
        { to: '/settings', label: 'Sozlamalar' },
      ]
    : [{ to: '/', label: 'Mening oyligim' }];

  return (
    <div className="min-h-screen md:flex">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-semibold">{me.org.name}</span>
        <button className="btn-ghost" onClick={() => setOpen(!open)}>
          Menyu
        </button>
      </header>
      <aside
        className={`${open ? 'block' : 'hidden'} w-full shrink-0 border-r border-slate-200 bg-white md:sticky md:top-0 md:block md:h-screen md:w-64`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 hidden md:block">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Bugalter</div>
            <div className="mt-1 font-semibold">{me.org.name}</div>
            <div className="text-xs text-slate-500">{center ? "O'quv markazi" : 'Korxona'}</div>
          </div>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto border-t border-slate-200 pt-4 text-sm">
            <div className="font-medium">{me.employee?.full_name ?? me.user.email}</div>
            <div className="mb-2 text-xs text-slate-500">{ROLE[me.user.role]}</div>
            <button className="btn-ghost w-full" onClick={logout}>
              Chiqish
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
