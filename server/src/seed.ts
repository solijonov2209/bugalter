// Demo ma'lumotlar: bitta korxona va bitta o'quv markazi.
import bcrypt from 'bcryptjs';
import { db, get, run } from './db.js';
import { currentPeriod, savePayroll } from './payroll.js';

const hash = bcrypt.hashSync('123456', 10);
const period = currentPeriod();
const prev = (() => {
  const d = new Date(`${period}-01`);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
})();

if (get('SELECT 1 FROM users WHERE email = ?', 'admin@korxona.uz')) {
  console.log('Demo ma\'lumotlar allaqachon bor.');
  process.exit(0);
}

const insertId = (sql: string, ...p: any[]) => Number(run(sql, ...p).lastInsertRowid);
const user = (org: number, email: string, role: string, emp: number | null = null) =>
  run('INSERT INTO users (org_id, email, password_hash, role, employee_id) VALUES (?, ?, ?, ?, ?)', org, email, hash, role, emp);
const employee = (org: number, name: string, pos: string, type: string, base: number, rate = 0) =>
  insertId('INSERT INTO employees (org_id, full_name, position, pay_type, base_salary, rate) VALUES (?, ?, ?, ?, ?, ?)',
    org, name, pos, type, base, rate);

db.exec('BEGIN');

// --- Korxona ---
const company = insertId("INSERT INTO organizations (name, type) VALUES ('Namuna MChJ', 'company')");
user(company, 'admin@korxona.uz', 'admin');
user(company, 'buxgalter@korxona.uz', 'accountant');
const director = employee(company, 'Karimov Aziz', 'Direktor', 'fixed', 12_000_000);
const manager = employee(company, 'Tursunova Malika', 'Menejer', 'fixed', 7_000_000);
const worker = employee(company, 'Rahimov Bekzod', 'Usta', 'hourly', 0, 45_000);
user(company, 'xodim@korxona.uz', 'employee', manager);
for (const p of [prev, period]) {
  run('INSERT INTO attendance VALUES (?, ?, 22, 22, 0)', director, p);
  run('INSERT INTO attendance VALUES (?, ?, 22, 20, 0)', manager, p);
  run('INSERT INTO attendance VALUES (?, ?, 22, 22, 168)', worker, p);
}
run("INSERT INTO adjustments (employee_id, period, kind, amount, note) VALUES (?, ?, 'bonus', 1000000, 'Reja bajarilgani uchun')", manager, period);
run("INSERT INTO adjustments (employee_id, period, kind, amount, note) VALUES (?, ?, 'advance', 2000000, 'Oy o''rtasidagi avans')", manager, period);

// --- O'quv markazi ---
const center = insertId("INSERT INTO organizations (name, type) VALUES ('Bilim o''quv markazi', 'center')");
user(center, 'admin@markaz.uz', 'admin');
const t1 = employee(center, 'Yusupova Dilnoza', 'Ingliz tili o\'qituvchisi', 'per_student', 0, 150_000);
const t2 = employee(center, 'Aliyev Sardor', 'Matematika o\'qituvchisi', 'percent', 1_000_000, 40);
employee(center, 'Nazarova Gulnora', 'Administrator', 'fixed', 4_000_000);
user(center, 'oqituvchi@markaz.uz', 'employee', t1);

const groups = [
  { name: 'IELTS 1', teacher: t1, fee: 600_000, n: 12 },
  { name: 'General English', teacher: t1, fee: 450_000, n: 10 },
  { name: 'Matematika (abituriyent)', teacher: t2, fee: 500_000, n: 14 },
];
const names = ['Ali', 'Vali', 'Hasan', 'Husan', 'Zarina', 'Madina', 'Jasur', 'Sevara', 'Otabek', 'Nilufar', 'Sardor', 'Kamola', 'Doston', 'Shahzoda'];
for (const g of groups) {
  const gid = insertId('INSERT INTO groups (org_id, name, teacher_id, monthly_fee) VALUES (?, ?, ?, ?)', center, g.name, g.teacher, g.fee);
  for (let i = 0; i < g.n; i++) {
    const sid = insertId('INSERT INTO students (org_id, full_name, group_id) VALUES (?, ?, ?)', center, `${names[i]} (${g.name})`, gid);
    run('INSERT INTO student_payments (org_id, student_id, group_id, period, amount) VALUES (?, ?, ?, ?, ?)', center, sid, gid, prev, g.fee);
    // Joriy oyda hammasi ham to'lamagan
    if (i % 4 !== 3)
      run('INSERT INTO student_payments (org_id, student_id, group_id, period, amount) VALUES (?, ?, ?, ?, ?)', center, sid, gid, period, g.fee);
  }
}

db.exec('COMMIT');

// O'tgan oy uchun to'langan vedomost — tarix ko'rinishi uchun
for (const org of [company, center]) {
  savePayroll(org, prev);
  run("UPDATE payrolls SET status = 'paid', paid_at = datetime('now') WHERE org_id = ? AND period = ?", org, prev);
}

console.log(`Demo tayyor. Parol hamma uchun: 123456
  Korxona: admin@korxona.uz, buxgalter@korxona.uz, xodim@korxona.uz
  Markaz:  admin@markaz.uz, oqituvchi@markaz.uz`);
