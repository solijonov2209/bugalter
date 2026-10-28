import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { PGlite, types } from '@electric-sql/pglite';

/**
 * PostgreSQL. DATABASE_URL berilsa (masalan Neon) haqiqiy serverga ulanadi,
 * aks holda lokal ishlab chiqish uchun fayldagi o'rnatilgan PGlite ishlatiladi.
 * Ikkalasida ham SQL bir xil.
 */

export type Row = Record<string, any>;

/** Matn ko'rinishidagi vaqt ustunlari uchun SQL ifodalar */
export const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`;
export const TODAY = `to_char(current_date, 'YYYY-MM-DD')`;

interface Querier {
  query(sql: string, params?: any[]): Promise<{ rows: Row[] }>;
}
interface Driver extends Querier {
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: (q: Querier) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function pgDriver(url: string): Driver {
  // COUNT/SUM bigint va numeric qiymatlarni son sifatida qaytarish
  pg.types.setTypeParser(20, Number);
  pg.types.setTypeParser(1700, Number);
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return {
    query: (sql, params) => pool.query(sql, params),
    exec: (sql) => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

function pgliteDriver(dir: string): Driver {
  if (dir !== 'memory://') fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir, { parsers: { [types.INT8]: Number, [types.NUMERIC]: Number } });
  return {
    query: (sql, params) => db.query<Row>(sql, params),
    exec: (sql) => db.exec(sql),
    transaction: (fn) => db.transaction((t) => fn(t)),
    close: () => db.close(),
  };
}

const driver = process.env.DATABASE_URL
  ? pgDriver(process.env.DATABASE_URL)
  : pgliteDriver(process.env.PGLITE_DIR ?? path.resolve(import.meta.dirname, '../data/pglite'));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company','center')),
  tax_rate DOUBLE PRECISION NOT NULL DEFAULT 12,
  currency TEXT NOT NULL DEFAULT 'UZS',
  created_at TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  pay_type TEXT NOT NULL CHECK (pay_type IN ('fixed','hourly','per_student','percent')),
  base_salary DOUBLE PRECISION NOT NULL DEFAULT 0,
  rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  hired_at TEXT NOT NULL DEFAULT ${TODAY}
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','accountant','employee')),
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  teacher_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  monthly_fee DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  joined_at TEXT NOT NULL DEFAULT ${TODAY}
);

CREATE TABLE IF NOT EXISTS student_payments (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  paid_at TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS attendance (
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  work_days INTEGER NOT NULL DEFAULT 22,
  worked_days INTEGER NOT NULL DEFAULT 22,
  hours DOUBLE PRECISION NOT NULL DEFAULT 0,
  PRIMARY KEY (employee_id, period)
);

CREATE TABLE IF NOT EXISTS adjustments (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bonus','deduction','advance')),
  amount DOUBLE PRECISION NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ${NOW}
);

-- Oylik hisobidan tashqari, qo'lga (naqd) berilgan pullar. Qoldiq = qo'lga beriladi − shu summalar.
CREATE TABLE IF NOT EXISTS cash_payouts (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  given_on TEXT NOT NULL DEFAULT ${TODAY},
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX IF NOT EXISTS cash_payouts_employee_period ON cash_payouts (employee_id, period);

CREATE TABLE IF NOT EXISTS payrolls (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  base DOUBLE PRECISION NOT NULL,
  variable DOUBLE PRECISION NOT NULL,
  bonus DOUBLE PRECISION NOT NULL,
  gross DOUBLE PRECISION NOT NULL,
  tax DOUBLE PRECISION NOT NULL,
  deductions DOUBLE PRECISION NOT NULL,
  advance DOUBLE PRECISION NOT NULL,
  net DOUBLE PRECISION NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (employee_id, period)
);
`;

export const ready = driver.exec(SCHEMA);

/** tx() ichida so'rovlar o'sha tranzaksiya ulanishidan o'tadi */
const txScope = new AsyncLocalStorage<Querier>();

/** `?` belgilarini PostgreSQL'ning $1, $2 ... parametrlariga aylantiradi */
const toPg = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

async function query(sql: string, params: any[]) {
  await ready;
  const q = txScope.getStore() ?? driver;
  return (await q.query(toPg(sql), params)).rows;
}

export const all = async <T = Row>(sql: string, ...params: any[]) => (await query(sql, params)) as T[];
export const get = async <T = Row>(sql: string, ...params: any[]) => (await query(sql, params))[0] as T | undefined;
export const run = async (sql: string, ...params: any[]) => {
  await query(sql, params);
};
/** INSERT bajarib, yangi yozuvning id sini qaytaradi */
export const insert = async (sql: string, ...params: any[]) => (await query(`${sql} RETURNING id`, params))[0].id as number;

export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txScope.getStore()) return fn();
  await ready;
  return driver.transaction((q) => txScope.run(q, fn));
}

export const closeDb = () => driver.close();
