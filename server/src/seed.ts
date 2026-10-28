// Demo ma'lumotlar: bitta korxona va bitta o'quv markazi.
import bcrypt from 'bcryptjs';
import { closeDb, get, insert, NOW, run, tx } from './db.js';
import { currentPeriod, savePayroll } from './payroll.js';

const hash = bcrypt.hashSync('123456', 10);
const period = currentPeriod();
const prev = (() => {
  const d = new Date(`${period}-01`);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
})();

if (await get('SELECT 1 FROM users WHERE email = ?', 'admin@korxona.uz')) {
  console.log('Demo ma\'lumotlar allaqachon bor.');
  await closeDb();
  process.exit(0);
}

const user = (org: number, email: string, role: string, emp: number | null = null) =>
  run('INSERT INTO users (org_id, email, password_hash, role, employee_id) VALUES (?, ?, ?, ?, ?)', org, email, hash, role, emp);
const employee = (org: number, name: string, pos: string, type: string, base: number, rate = 0) =>
  insert('INSERT INTO employees (org_id, full_name, position, pay_type, base_salary, rate) VALUES (?, ?, ?, ?, ?, ?)',
    org, name, pos, type, base, rate);

let company = 0;
let center = 0;
await tx(async () => {

  // --- Korxona ---
  company = await insert("INSERT INTO organizations (name, type) VALUES ('Namuna MChJ', 'company')");
  await user(company, 'admin@korxona.uz', 'admin');
  await user(company, 'buxgalter@korxona.uz', 'accountant');
  const director = await employee(company, 'Karimov Aziz', 'Direktor', 'fixed', 12_000_000);
  const manager = await employee(company, 'Tursunova Malika', 'Menejer', 'fixed', 7_000_000);
  const worker = await employee(company, 'Rahimov Bekzod', 'Usta', 'hourly', 0, 45_000);
  await user(company, 'xodim@korxona.uz', 'employee', manager);
  for (const p of [prev, period]) {
    await run('INSERT INTO attendance VALUES (?, ?, 22, 22, 0)', director, p);
    await run('INSERT INTO attendance VALUES (?, ?, 22, 20, 0)', manager, p);
    await run('INSERT INTO attendance VALUES (?, ?, 22, 22, 168)', worker, p);
  }
  await run("INSERT INTO adjustments (employee_id, period, kind, amount, note) VALUES (?, ?, 'bonus', 1000000, 'Reja bajarilgani uchun')", manager, period);
  await run("INSERT INTO adjustments (employee_id, period, kind, amount, note) VALUES (?, ?, 'advance', 2000000, 'Oy o''rtasidagi avans')", manager, period);

  // --- O'quv markazi ---
  center = await insert("INSERT INTO organizations (name, type) VALUES ('Bilim o''quv markazi', 'center')");
  await user(center, 'admin@markaz.uz', 'admin');
  const t1 = await employee(center, 'Yusupova Dilnoza', 'Ingliz tili o\'qituvchisi', 'per_student', 0, 150_000);
  const t2 = await employee(center, 'Aliyev Sardor', 'Matematika o\'qituvchisi', 'percent', 1_000_000, 40);
  await employee(center, 'Nazarova Gulnora', 'Administrator', 'fixed', 4_000_000);
  await user(center, 'oqituvchi@markaz.uz', 'employee', t1);

  const groups = [
    { name: 'IELTS 1', teacher: t1, fee: 600_000, n: 12 },
    { name: 'General English', teacher: t1, fee: 450_000, n: 10 },
    { name: 'Matematika (abituriyent)', teacher: t2, fee: 500_000, n: 14 },
  ];
  const names = ['Ali', 'Vali', 'Hasan', 'Husan', 'Zarina', 'Madina', 'Jasur', 'Sevara', 'Otabek', 'Nilufar', 'Sardor', 'Kamola', 'Doston', 'Shahzoda'];
  for (const g of groups) {
    const gid = await insert('INSERT INTO groups (org_id, name, teacher_id, monthly_fee) VALUES (?, ?, ?, ?)', center, g.name, g.teacher, g.fee);
    for (let i = 0; i < g.n; i++) {
      const sid = await insert('INSERT INTO students (org_id, full_name, group_id) VALUES (?, ?, ?)', center, `${names[i]} (${g.name})`, gid);
      await run('INSERT INTO student_payments (org_id, student_id, group_id, period, amount) VALUES (?, ?, ?, ?, ?)', center, sid, gid, prev, g.fee);
      // Joriy oyda hammasi ham to'lamagan
      if (i % 4 !== 3)
        await run('INSERT INTO student_payments (org_id, student_id, group_id, period, amount) VALUES (?, ?, ?, ?, ?)', center, sid, gid, period, g.fee);
    }
  }

});

// O'tgan oy uchun to'langan vedomost — tarix ko'rinishi uchun
for (const org of [company, center]) {
  await savePayroll(org, prev);
  await run(`UPDATE payrolls SET status = 'paid', paid_at = ${NOW} WHERE org_id = ? AND period = ?`, org, prev);
}

console.log(`Demo tayyor. Parol hamma uchun: 123456
  Korxona: admin@korxona.uz, buxgalter@korxona.uz, xodim@korxona.uz
  Markaz:  admin@markaz.uz, oqituvchi@markaz.uz`);
await closeDb();
