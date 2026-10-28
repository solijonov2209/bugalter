import crypto from 'node:crypto';
import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, get, insert, NOW, run, tx } from './db.js';
import { requireAuth, requireRole, signToken, staffOnly, type AuthUser } from './auth.js';
import { currentPeriod, handedTotal, payrollSheet, previewForEmployee, savePayroll } from './payroll.js';
import { notifyPayroll } from './realtime.js';

export const api = Router();

const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Davr YYYY-MM formatida bo\'lishi kerak');
const id = z.coerce.number().int().positive();
const money = z.coerce.number().min(0);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD formatida bo\'lishi kerak');

const periodOf = (req: Request) => period.parse(req.query.period ?? currentPeriod());

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Yozuv shu tashkilotga tegishli ekanini tekshiradi */
async function owned(table: 'employees' | 'groups' | 'students', rowId: number, orgId: number) {
  const row = await get(`SELECT * FROM ${table} WHERE id = ? AND org_id = ?`, rowId, orgId);
  if (!row) throw new HttpError(404, 'Topilmadi');
  return row;
}

const teacherOfGroup = async (groupId: number | null | undefined) =>
  groupId ? ((await get('SELECT teacher_id FROM groups WHERE id = ?', groupId))?.teacher_id as number | null) : null;
const ids = (...xs: (number | null | undefined)[]) => [...new Set(xs.filter((x): x is number => !!x))];

// ---------- Auth ----------

api.post('/auth/register', async (req, res) => {
  const body = z
    .object({
      orgName: z.string().min(2),
      orgType: z.enum(['company', 'center']),
      email: z.email(),
      password: z.string().min(6),
    })
    .parse(req.body);
  if (await get('SELECT 1 FROM users WHERE email = ?', body.email)) throw new HttpError(409, 'Bu email band');
  const user = await tx(async () => {
    const orgId = await insert('INSERT INTO organizations (name, type) VALUES (?, ?)', body.orgName, body.orgType);
    const userId = await insert(
      'INSERT INTO users (org_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      orgId, body.email, bcrypt.hashSync(body.password, 10), 'admin',
    );
    return { id: userId, orgId, role: 'admin', employeeId: null } satisfies AuthUser;
  });
  res.status(201).json({ token: signToken(user) });
});

api.post('/auth/login', async (req, res) => {
  const body = z.object({ email: z.string(), password: z.string() }).parse(req.body);
  const u = await get('SELECT * FROM users WHERE email = ?', body.email);
  if (!u || !bcrypt.compareSync(body.password, u.password_hash)) throw new HttpError(401, 'Email yoki parol noto\'g\'ri');
  res.json({ token: signToken({ id: u.id, orgId: u.org_id, role: u.role, employeeId: u.employee_id }) });
});

/**
 * Unutilgan parolni tiklash. Faqat serverda ADMIN_RESET_KEY o'rnatilgan bo'lsa ishlaydi;
 * kalitni bilgan kishi (server egasi) istalgan foydalanuvchiga yangi parol qo'ya oladi.
 */
api.post('/auth/reset-password', async (req, res) => {
  const resetKey = process.env.ADMIN_RESET_KEY;
  if (!resetKey) throw new HttpError(404, 'Parolni tiklash serverda yoqilmagan');
  const body = z.object({ key: z.string(), email: z.string(), password: z.string().min(6) }).parse(req.body);
  const a = Buffer.from(body.key);
  const b = Buffer.from(resetKey);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(403, 'Tiklash kaliti noto\'g\'ri');
  const u = await get('SELECT id FROM users WHERE email = ?', body.email);
  if (!u) throw new HttpError(404, 'Bunday email bilan foydalanuvchi yo\'q');
  await run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(body.password, 10), u.id);
  res.json({ ok: true });
});

api.use(requireAuth);

api.get('/auth/me', async (req, res) => {
  const org = await get('SELECT * FROM organizations WHERE id = ?', req.user.orgId);
  const user = await get('SELECT id, email, role, employee_id FROM users WHERE id = ?', req.user.id);
  const employee = req.user.employeeId ? await get('SELECT * FROM employees WHERE id = ?', req.user.employeeId) : null;
  res.json({ user, org, employee });
});

// ---------- Xodim kabineti ----------

api.get('/me/salary', requireRole('employee'), async (req, res) => {
  const p = periodOf(req);
  const emp = await get('SELECT * FROM employees WHERE id = ?', req.user.employeeId);
  if (!emp) throw new HttpError(404, 'Xodim topilmadi');
  const org = (await get('SELECT tax_rate FROM organizations WHERE id = ?', req.user.orgId))!;
  const saved = await get('SELECT * FROM payrolls WHERE employee_id = ? AND period = ?', emp.id, p);
  res.json({
    period: p,
    employee: emp,
    live: await previewForEmployee(emp, org.tax_rate, p),
    saved: saved ? { ...saved, details: JSON.parse(saved.details) } : null,
    adjustments: await all('SELECT * FROM adjustments WHERE employee_id = ? AND period = ? ORDER BY created_at DESC', emp.id, p),
    handed: await handedTotal(emp.id, p),
    payouts: await all('SELECT * FROM cash_payouts WHERE employee_id = ? AND period = ? ORDER BY given_on DESC, id DESC', emp.id, p),
    history: await all(
      'SELECT period, gross, tax, net, status, paid_at FROM payrolls WHERE employee_id = ? ORDER BY period DESC LIMIT 12',
      emp.id,
    ),
  });
});

// Quyidagilar faqat buxgalteriya uchun
api.use(staffOnly);

// ---------- Tashkilot ----------

api.patch('/org', requireRole('admin'), async (req, res) => {
  const body = z
    .object({ name: z.string().min(2), type: z.enum(['company', 'center']), tax_rate: z.coerce.number().min(0).max(100) })
    .partial()
    .parse(req.body);
  for (const [k, v] of Object.entries(body)) await run(`UPDATE organizations SET ${k} = ? WHERE id = ?`, v, req.user.orgId);
  const emps = (await all<{ id: number }>('SELECT id FROM employees WHERE org_id = ?', req.user.orgId)).map((e) => e.id);
  notifyPayroll(req.user.orgId, emps, currentPeriod());
  res.json(await get('SELECT * FROM organizations WHERE id = ?', req.user.orgId));
});

api.get('/dashboard', async (req, res) => {
  const p = periodOf(req);
  const sheet = await payrollSheet(req.user.orgId, p);
  const totals = sheet.reduce(
    (t, r) => {
      const v = r.saved ?? r.live;
      t.gross += v.gross;
      t.tax += v.tax;
      t.net += v.net;
      // To'langan oylikda qo'lga berilgan pul allaqachon "to'langan" ichida
      if (r.saved?.status === 'paid') t.paid += v.net;
      else t.handed += r.handed;
      return t;
    },
    { gross: 0, tax: 0, net: 0, paid: 0, handed: 0 },
  );
  const center = await get(
    `SELECT (SELECT COUNT(*) FROM students WHERE org_id = ? AND active = 1) AS students,
            (SELECT COUNT(*) FROM groups WHERE org_id = ?) AS groups,
            (SELECT COALESCE(SUM(amount),0) FROM student_payments WHERE org_id = ? AND period = ?) AS revenue`,
    req.user.orgId, req.user.orgId, req.user.orgId, p,
  );
  const trend = (
    await all(
      `SELECT period, SUM(gross) AS gross, SUM(net) AS net FROM payrolls WHERE org_id = ?
       GROUP BY period ORDER BY period DESC LIMIT 6`,
      req.user.orgId,
    )
  ).reverse();
  res.json({ period: p, employees: sheet.length, totals, center, trend });
});

// ---------- Xodimlar ----------

const employeeSchema = z.object({
  full_name: z.string().min(2),
  position: z.string().default(''),
  phone: z.string().default(''),
  pay_type: z.enum(['fixed', 'hourly', 'per_student', 'percent']),
  base_salary: money.default(0),
  rate: money.default(0),
  active: z.coerce.boolean().default(true),
});

api.get('/employees', async (req, res) => {
  res.json(
    await all(
      `SELECT e.*, u.email AS login_email FROM employees e LEFT JOIN users u ON u.employee_id = e.id
       WHERE e.org_id = ? ORDER BY e.active DESC, e.full_name`,
      req.user.orgId,
    ),
  );
});

api.post('/employees', async (req, res) => {
  const b = employeeSchema.parse(req.body);
  const newId = await insert(
    'INSERT INTO employees (org_id, full_name, position, phone, pay_type, base_salary, rate, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    req.user.orgId, b.full_name, b.position, b.phone, b.pay_type, b.base_salary, b.rate, b.active ? 1 : 0,
  );
  res.status(201).json(await get('SELECT * FROM employees WHERE id = ?', newId));
});

api.put('/employees/:id', async (req, res) => {
  const empId = id.parse(req.params.id);
  await owned('employees', empId, req.user.orgId);
  const b = employeeSchema.parse(req.body);
  await run(
    'UPDATE employees SET full_name = ?, position = ?, phone = ?, pay_type = ?, base_salary = ?, rate = ?, active = ? WHERE id = ?',
    b.full_name, b.position, b.phone, b.pay_type, b.base_salary, b.rate, b.active ? 1 : 0, empId,
  );
  notifyPayroll(req.user.orgId, [empId], currentPeriod());
  res.json(await get('SELECT * FROM employees WHERE id = ?', empId));
});

api.delete('/employees/:id', requireRole('admin'), async (req, res) => {
  const empId = id.parse(req.params.id);
  await owned('employees', empId, req.user.orgId);
  await run('DELETE FROM employees WHERE id = ?', empId);
  res.status(204).end();
});

/** Xodimga shaxsiy kabinetga kirish uchun login berish (yoki parolni yangilash) */
api.post('/employees/:id/account', async (req, res) => {
  const empId = id.parse(req.params.id);
  await owned('employees', empId, req.user.orgId);
  const b = z.object({ email: z.email(), password: z.string().min(6) }).parse(req.body);
  const existing = await get('SELECT * FROM users WHERE employee_id = ?', empId);
  const clash = await get('SELECT id FROM users WHERE email = ?', b.email);
  if (clash && clash.id !== existing?.id) throw new HttpError(409, 'Bu email band');
  const hash = bcrypt.hashSync(b.password, 10);
  if (existing) await run('UPDATE users SET email = ?, password_hash = ? WHERE id = ?', b.email, hash, existing.id);
  else
    await run('INSERT INTO users (org_id, email, password_hash, role, employee_id) VALUES (?, ?, ?, ?, ?)',
      req.user.orgId, b.email, hash, 'employee', empId);
  res.json({ ok: true });
});

// ---------- Tabel (ish kunlari / soatlar) ----------

api.get('/attendance', async (req, res) => {
  const p = periodOf(req);
  res.json(
    await all(
      `SELECT e.id AS employee_id, e.full_name, e.pay_type, a.work_days, a.worked_days, a.hours
       FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id AND a.period = ?
       WHERE e.org_id = ? AND e.active = 1 ORDER BY e.full_name`,
      p, req.user.orgId,
    ),
  );
});

api.put('/attendance', async (req, res) => {
  const b = z
    .object({
      period,
      employee_id: id,
      work_days: z.coerce.number().int().min(0).max(31),
      worked_days: z.coerce.number().int().min(0).max(31),
      hours: z.coerce.number().min(0).default(0),
    })
    .parse(req.body);
  await owned('employees', b.employee_id, req.user.orgId);
  await run(
    `INSERT INTO attendance (employee_id, period, work_days, worked_days, hours) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (employee_id, period) DO UPDATE SET work_days = excluded.work_days, worked_days = excluded.worked_days, hours = excluded.hours`,
    b.employee_id, b.period, b.work_days, b.worked_days, b.hours,
  );
  notifyPayroll(req.user.orgId, [b.employee_id], b.period);
  res.json({ ok: true });
});

// ---------- Bonus / ushlanma / avans ----------

api.get('/adjustments', async (req, res) => {
  const p = periodOf(req);
  res.json(
    await all(
      `SELECT a.*, e.full_name FROM adjustments a JOIN employees e ON e.id = a.employee_id
       WHERE e.org_id = ? AND a.period = ? ORDER BY a.created_at DESC`,
      req.user.orgId, p,
    ),
  );
});

api.post('/adjustments', async (req, res) => {
  const b = z
    .object({ employee_id: id, period, kind: z.enum(['bonus', 'deduction', 'advance']), amount: money, note: z.string().default('') })
    .parse(req.body);
  await owned('employees', b.employee_id, req.user.orgId);
  const newId = await insert(
    'INSERT INTO adjustments (employee_id, period, kind, amount, note) VALUES (?, ?, ?, ?, ?)',
    b.employee_id, b.period, b.kind, b.amount, b.note,
  );
  notifyPayroll(req.user.orgId, [b.employee_id], b.period);
  res.status(201).json(await get('SELECT * FROM adjustments WHERE id = ?', newId));
});

api.delete('/adjustments/:id', async (req, res) => {
  const a = await get(
    'SELECT a.* FROM adjustments a JOIN employees e ON e.id = a.employee_id WHERE a.id = ? AND e.org_id = ?',
    id.parse(req.params.id), req.user.orgId,
  );
  if (!a) throw new HttpError(404, 'Topilmadi');
  await run('DELETE FROM adjustments WHERE id = ?', a.id);
  notifyPayroll(req.user.orgId, [a.employee_id], a.period);
  res.status(204).end();
});

// ---------- Qo'lga berilgan pullar ----------

api.get('/cash-payouts', async (req, res) => {
  const p = periodOf(req);
  res.json(
    await all(
      `SELECT c.*, e.full_name FROM cash_payouts c JOIN employees e ON e.id = c.employee_id
       WHERE e.org_id = ? AND c.period = ? ORDER BY c.given_on DESC, c.id DESC`,
      req.user.orgId, p,
    ),
  );
});

api.post('/cash-payouts', async (req, res) => {
  const b = z
    .object({ employee_id: id, period, amount: money.positive(), given_on: date, note: z.string().default('') })
    .parse(req.body);
  await owned('employees', b.employee_id, req.user.orgId);
  const newId = await insert(
    'INSERT INTO cash_payouts (employee_id, period, amount, given_on, note) VALUES (?, ?, ?, ?, ?)',
    b.employee_id, b.period, b.amount, b.given_on, b.note,
  );
  notifyPayroll(req.user.orgId, [b.employee_id], b.period);
  res.status(201).json(await get('SELECT * FROM cash_payouts WHERE id = ?', newId));
});

api.delete('/cash-payouts/:id', async (req, res) => {
  const c = await get(
    'SELECT c.* FROM cash_payouts c JOIN employees e ON e.id = c.employee_id WHERE c.id = ? AND e.org_id = ?',
    id.parse(req.params.id), req.user.orgId,
  );
  if (!c) throw new HttpError(404, 'Topilmadi');
  await run('DELETE FROM cash_payouts WHERE id = ?', c.id);
  notifyPayroll(req.user.orgId, [c.employee_id], c.period);
  res.status(204).end();
});

// ---------- O'quv markazi: guruhlar, o'quvchilar, to'lovlar ----------

const groupSchema = z.object({ name: z.string().min(1), teacher_id: id.nullable().default(null), monthly_fee: money.default(0) });

api.get('/groups', async (req, res) => {
  res.json(
    await all(
      `SELECT g.*, e.full_name AS teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.active = 1) AS student_count
       FROM groups g LEFT JOIN employees e ON e.id = g.teacher_id WHERE g.org_id = ? ORDER BY g.name`,
      req.user.orgId,
    ),
  );
});

api.post('/groups', async (req, res) => {
  const b = groupSchema.parse(req.body);
  if (b.teacher_id) await owned('employees', b.teacher_id, req.user.orgId);
  const newId = await insert('INSERT INTO groups (org_id, name, teacher_id, monthly_fee) VALUES (?, ?, ?, ?)',
    req.user.orgId, b.name, b.teacher_id, b.monthly_fee);
  res.status(201).json(await get('SELECT * FROM groups WHERE id = ?', newId));
});

api.put('/groups/:id', async (req, res) => {
  const gid = id.parse(req.params.id);
  const old = await owned('groups', gid, req.user.orgId);
  const b = groupSchema.parse(req.body);
  if (b.teacher_id) await owned('employees', b.teacher_id, req.user.orgId);
  await run('UPDATE groups SET name = ?, teacher_id = ?, monthly_fee = ? WHERE id = ?', b.name, b.teacher_id, b.monthly_fee, gid);
  notifyPayroll(req.user.orgId, ids(old.teacher_id, b.teacher_id), currentPeriod());
  res.json(await get('SELECT * FROM groups WHERE id = ?', gid));
});

api.delete('/groups/:id', async (req, res) => {
  const g = await owned('groups', id.parse(req.params.id), req.user.orgId);
  await run('DELETE FROM groups WHERE id = ?', g.id);
  notifyPayroll(req.user.orgId, ids(g.teacher_id), currentPeriod());
  res.status(204).end();
});

const studentSchema = z.object({
  full_name: z.string().min(2),
  phone: z.string().default(''),
  group_id: id.nullable().default(null),
  active: z.coerce.boolean().default(true),
});

api.get('/students', async (req, res) => {
  const p = periodOf(req);
  res.json(
    await all(
      `SELECT s.*, g.name AS group_name, g.monthly_fee,
        (SELECT COALESCE(SUM(amount),0) FROM student_payments sp WHERE sp.student_id = s.id AND sp.period = ?) AS paid
       FROM students s LEFT JOIN groups g ON g.id = s.group_id WHERE s.org_id = ? ORDER BY s.active DESC, s.full_name`,
      p, req.user.orgId,
    ),
  );
});

api.post('/students', async (req, res) => {
  const b = studentSchema.parse(req.body);
  if (b.group_id) await owned('groups', b.group_id, req.user.orgId);
  const newId = await insert('INSERT INTO students (org_id, full_name, phone, group_id, active) VALUES (?, ?, ?, ?, ?)',
    req.user.orgId, b.full_name, b.phone, b.group_id, b.active ? 1 : 0);
  notifyPayroll(req.user.orgId, ids(await teacherOfGroup(b.group_id)), currentPeriod());
  res.status(201).json(await get('SELECT * FROM students WHERE id = ?', newId));
});

api.put('/students/:id', async (req, res) => {
  const sid = id.parse(req.params.id);
  const old = await owned('students', sid, req.user.orgId);
  const b = studentSchema.parse(req.body);
  if (b.group_id) await owned('groups', b.group_id, req.user.orgId);
  await run('UPDATE students SET full_name = ?, phone = ?, group_id = ?, active = ? WHERE id = ?',
    b.full_name, b.phone, b.group_id, b.active ? 1 : 0, sid);
  notifyPayroll(req.user.orgId, ids(await teacherOfGroup(old.group_id), await teacherOfGroup(b.group_id)), currentPeriod());
  res.json(await get('SELECT * FROM students WHERE id = ?', sid));
});

api.delete('/students/:id', async (req, res) => {
  const s = await owned('students', id.parse(req.params.id), req.user.orgId);
  await run('DELETE FROM students WHERE id = ?', s.id);
  notifyPayroll(req.user.orgId, ids(await teacherOfGroup(s.group_id)), currentPeriod());
  res.status(204).end();
});

api.get('/student-payments', async (req, res) => {
  const p = periodOf(req);
  res.json(
    await all(
      `SELECT sp.*, s.full_name, g.name AS group_name FROM student_payments sp
       JOIN students s ON s.id = sp.student_id LEFT JOIN groups g ON g.id = sp.group_id
       WHERE sp.org_id = ? AND sp.period = ? ORDER BY sp.paid_at DESC`,
      req.user.orgId, p,
    ),
  );
});

api.post('/student-payments', async (req, res) => {
  const b = z.object({ student_id: id, period, amount: money.positive() }).parse(req.body);
  const s = await owned('students', b.student_id, req.user.orgId);
  const newId = await insert('INSERT INTO student_payments (org_id, student_id, group_id, period, amount) VALUES (?, ?, ?, ?, ?)',
    req.user.orgId, s.id, s.group_id, b.period, b.amount);
  notifyPayroll(req.user.orgId, ids(await teacherOfGroup(s.group_id)), b.period);
  res.status(201).json(await get('SELECT * FROM student_payments WHERE id = ?', newId));
});

api.delete('/student-payments/:id', async (req, res) => {
  const p = await get('SELECT * FROM student_payments WHERE id = ? AND org_id = ?', id.parse(req.params.id), req.user.orgId);
  if (!p) throw new HttpError(404, 'Topilmadi');
  await run('DELETE FROM student_payments WHERE id = ?', p.id);
  notifyPayroll(req.user.orgId, ids(await teacherOfGroup(p.group_id)), p.period);
  res.status(204).end();
});

// ---------- Oylik vedomosti ----------

api.get('/payroll', async (req, res) => {
  const p = periodOf(req);
  res.json({ period: p, rows: await payrollSheet(req.user.orgId, p) });
});

api.post('/payroll/calculate', async (req, res) => {
  const b = z.object({ period, employee_ids: z.array(id).optional() }).parse(req.body);
  const touched = await savePayroll(req.user.orgId, b.period, b.employee_ids);
  notifyPayroll(req.user.orgId, touched, b.period);
  res.json({ updated: touched.length });
});

api.post('/payroll/status', async (req, res) => {
  const b = z
    .object({ period, status: z.enum(['draft', 'approved', 'paid']), employee_ids: z.array(id).min(1) })
    .parse(req.body);
  const rows = await all(
    `SELECT id, employee_id FROM payrolls WHERE org_id = ? AND period = ? AND employee_id IN (${b.employee_ids.map(() => '?').join(',')})`,
    req.user.orgId, b.period, ...b.employee_ids,
  );
  await tx(async () => {
    for (const r of rows)
      await run(
        `UPDATE payrolls SET status = ?, paid_at = CASE WHEN ?::text = 'paid' THEN ${NOW} ELSE NULL END, updated_at = ${NOW} WHERE id = ?`,
        b.status, b.status, r.id,
      );
  });
  notifyPayroll(req.user.orgId, rows.map((r) => r.employee_id), b.period);
  res.json({ updated: rows.length });
});

export { HttpError };
