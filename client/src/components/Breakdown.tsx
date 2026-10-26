import { money, PAY_TYPES } from '../lib';

export interface Calc {
  base: number;
  variable: number;
  bonus: number;
  gross: number;
  tax: number;
  deductions: number;
  advance: number;
  net: number;
  details: {
    payType: string;
    rate: number;
    baseSalary: number;
    workDays: number;
    workedDays: number;
    hours: number;
    groups: string[];
    paidStudents: number;
    revenue: number;
    activeStudents: number;
  };
}

/** Oylik qanday hisoblanganini qatorma-qator ko'rsatadi */
export default function Breakdown({ c, taxRate }: { c: Calc; taxRate?: number }) {
  const d = c.details;
  const variableLabel =
    d.payType === 'hourly'
      ? `${d.hours} soat × ${money(d.rate)}`
      : d.payType === 'per_student'
        ? `${d.paidStudents} ta to'lagan o'quvchi × ${money(d.rate)}`
        : d.payType === 'percent'
          ? `${money(d.revenue)} tushumning ${d.rate}%`
          : null;

  const rows: [string, number, string?][] = [];
  if (d.baseSalary > 0 || d.payType === 'fixed')
    rows.push([
      'Oklad',
      c.base,
      d.workDays ? `${d.workedDays}/${d.workDays} ish kuni, oklad ${money(d.baseSalary)}` : `oklad ${money(d.baseSalary)}`,
    ]);
  if (variableLabel) rows.push([PAY_TYPES[d.payType], c.variable, variableLabel]);
  if (c.bonus) rows.push(['Bonus', c.bonus]);

  return (
    <div className="space-y-3 text-sm">
      {d.groups?.length > 0 && (
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-indigo-900">
          Guruhlar: {d.groups.join(', ')} · faol o'quvchilar: {d.activeStudents} · shu oy to'laganlar: {d.paidStudents}
        </div>
      )}
      <table className="w-full">
        <tbody>
          {rows.map(([label, v, hint]) => (
            <tr key={label}>
              <td className="py-1">
                {label}
                {hint && <div className="text-xs text-slate-500">{hint}</div>}
              </td>
              <td className="whitespace-nowrap py-1 text-right tabular-nums">{money(v)}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-200 font-medium">
            <td className="py-1">Hisoblangan (brutto)</td>
            <td className="whitespace-nowrap py-1 text-right tabular-nums">{money(c.gross)}</td>
          </tr>
          <tr className="text-rose-700">
            <td className="py-1">Daromad solig'i{taxRate !== undefined && ` (${taxRate}%)`}</td>
            <td className="whitespace-nowrap py-1 text-right tabular-nums">−{money(c.tax)}</td>
          </tr>
          {c.deductions > 0 && (
            <tr className="text-rose-700">
              <td className="py-1">Ushlanmalar</td>
              <td className="whitespace-nowrap py-1 text-right tabular-nums">−{money(c.deductions)}</td>
            </tr>
          )}
          {c.advance > 0 && (
            <tr className="text-rose-700">
              <td className="py-1">Berilgan avans</td>
              <td className="whitespace-nowrap py-1 text-right tabular-nums">−{money(c.advance)}</td>
            </tr>
          )}
          <tr className="border-t border-slate-200 text-base font-semibold text-emerald-700">
            <td className="py-2">Qo'lga beriladi</td>
            <td className="whitespace-nowrap py-2 text-right tabular-nums">{money(c.net)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
