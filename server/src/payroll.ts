import { all, get, NOW, run, tx, type Row } from './db.js';

export type PayType = 'fixed' | 'hourly' | 'per_student' | 'percent';

export interface CalcInput {
  payType: PayType;
  baseSalary: number;
  rate: number;
  taxRate: number;
  workDays: number;
  workedDays: number;
  hours: number;
  /** O'quv markazi: shu oy uchun to'lov qilgan o'quvchilar soni */
  paidStudents: number;
  /** O'quv markazi: o'qituvchi guruhlaridan shu oy tushgan pul */
  revenue: number;
  bonus: number;
  deductions: number;
  advance: number;
}

export interface CalcResult {
  base: number;
  variable: number;
  bonus: number;
  gross: number;
  tax: number;
  deductions: number;
  advance: number;
  net: number;
}

const round = (n: number) => Math.round(n);

/** Bitta xodim uchun oylikni hisoblaydi. Sof funksiya — DB ga bog'liq emas. */
export function calculate(i: CalcInput): CalcResult {
  const ratio = i.workDays > 0 ? Math.min(i.workedDays / i.workDays, 1) : 1;
  const base = round(i.baseSalary * ratio);

  let variable = 0;
  if (i.payType === 'hourly') variable = i.rate * i.hours;
  else if (i.payType === 'per_student') variable = i.rate * i.paidStudents;
  else if (i.payType === 'percent') variable = (i.revenue * i.rate) / 100;
  variable = round(variable);

  const bonus = round(i.bonus);
  const gross = base + variable + bonus;
  const tax = round((gross * i.taxRate) / 100);
  const deductions = round(i.deductions);
  const advance = round(i.advance);
  return { base, variable, bonus, gross, tax, deductions, advance, net: gross - tax - deductions - advance };
}

export const currentPeriod = () => new Date().toISOString().slice(0, 7);

async function teacherStats(employeeId: number, period: string) {
  const groups = await all<{ id: number; name: string }>('SELECT id, name FROM groups WHERE teacher_id = ?', employeeId);
  const paid = (await get<{ students: number; revenue: number }>(
    `SELECT COUNT(DISTINCT p.student_id) AS students, COALESCE(SUM(p.amount), 0) AS revenue
     FROM student_payments p JOIN groups g ON g.id = p.group_id
     WHERE g.teacher_id = ? AND p.period = ?`,
    employeeId,
    period,
  ))!;
  const active = (await get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM students s JOIN groups g ON g.id = s.group_id WHERE g.teacher_id = ? AND s.active = 1`,
    employeeId,
  ))!;
  return { groups: groups.map((g) => g.name), paidStudents: paid.students, revenue: paid.revenue, activeStudents: active.n };
}

/** Xodimning tanlangan oy bo'yicha hisob-kitobini (saqlanmagan, "jonli") qaytaradi. */
export async function previewForEmployee(emp: Row, taxRate: number, period: string) {
  const att = await get('SELECT * FROM attendance WHERE employee_id = ? AND period = ?', emp.id, period);
  const adj = await all('SELECT kind, amount FROM adjustments WHERE employee_id = ? AND period = ?', emp.id, period);
  const sum = (k: string) => adj.filter((a) => a.kind === k).reduce((s, a) => s + a.amount, 0);
  const stats =
    emp.pay_type === 'per_student' || emp.pay_type === 'percent'
      ? await teacherStats(emp.id, period)
      : { groups: [], paidStudents: 0, revenue: 0, activeStudents: 0 };

  const input: CalcInput = {
    payType: emp.pay_type,
    baseSalary: emp.base_salary,
    rate: emp.rate,
    taxRate,
    workDays: att?.work_days ?? 0,
    workedDays: att?.worked_days ?? 0,
    hours: att?.hours ?? 0,
    paidStudents: stats.paidStudents,
    revenue: stats.revenue,
    bonus: sum('bonus'),
    deductions: sum('deduction'),
    advance: sum('advance'),
  };
  return {
    ...calculate(input),
    details: {
      payType: emp.pay_type,
      rate: emp.rate,
      baseSalary: emp.base_salary,
      workDays: input.workDays,
      workedDays: input.workedDays,
      hours: input.hours,
      ...stats,
    },
  };
}

/** Shu oy uchun xodimga qo'lga berilgan pullar yig'indisi */
export const handedTotal = async (employeeId: number, period: string) =>
  (await get<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM cash_payouts WHERE employee_id = ? AND period = ?',
    employeeId,
    period,
  ))!.total;

/** Oylik jadvali: saqlangan qatorlar bo'lsa ularni, bo'lmasa jonli hisobni ko'rsatadi. */
export async function payrollSheet(orgId: number, period: string) {
  const org = (await get('SELECT * FROM organizations WHERE id = ?', orgId))!;
  const emps = await all('SELECT * FROM employees WHERE org_id = ? AND active = 1 ORDER BY full_name', orgId);
  return Promise.all(emps.map(async (emp) => {
    const saved = await get('SELECT * FROM payrolls WHERE employee_id = ? AND period = ?', emp.id, period);
    const live = await previewForEmployee(emp, org.tax_rate, period);
    return {
      employee: { id: emp.id, full_name: emp.full_name, position: emp.position, pay_type: emp.pay_type },
      live,
      saved: saved ? ({ ...saved, details: JSON.parse(saved.details) } as Row) : null,
      handed: await handedTotal(emp.id, period),
    };
  }));
}

/** Qoralama holatidagi (yoki hali yo'q) qatorlarni qayta hisoblab saqlaydi. Tasdiqlangan/to'langanlar o'zgarmaydi. */
export async function savePayroll(orgId: number, period: string, employeeIds?: number[]) {
  const org = (await get('SELECT * FROM organizations WHERE id = ?', orgId))!;
  const emps = (await all('SELECT * FROM employees WHERE org_id = ? AND active = 1', orgId)).filter(
    (e) => !employeeIds || employeeIds.includes(e.id),
  );
  const touched: number[] = [];
  await tx(async () => {
    for (const emp of emps) {
      const existing = await get('SELECT status FROM payrolls WHERE employee_id = ? AND period = ?', emp.id, period);
      if (existing && existing.status !== 'draft') continue;
      const r = await previewForEmployee(emp, org.tax_rate, period);
      await run(
        `INSERT INTO payrolls (org_id, employee_id, period, base, variable, bonus, gross, tax, deductions, advance, net, details, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ${NOW})
         ON CONFLICT (employee_id, period) DO UPDATE SET
           base = excluded.base, variable = excluded.variable, bonus = excluded.bonus, gross = excluded.gross,
           tax = excluded.tax, deductions = excluded.deductions, advance = excluded.advance, net = excluded.net,
           details = excluded.details, updated_at = excluded.updated_at`,
        orgId, emp.id, period, r.base, r.variable, r.bonus, r.gross, r.tax, r.deductions, r.advance, r.net,
        JSON.stringify(r.details),
      );
      touched.push(emp.id);
    }
  });
  return touched;
}
