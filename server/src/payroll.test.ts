import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, type CalcInput } from './payroll.js';

const base: CalcInput = {
  payType: 'fixed', baseSalary: 0, rate: 0, taxRate: 12, workDays: 22, workedDays: 22, hours: 0,
  paidStudents: 0, revenue: 0, bonus: 0, deductions: 0, advance: 0,
};

test('oklad: to\'liq oy, bonus, soliq, avans', () => {
  const r = calculate({ ...base, baseSalary: 5_000_000, bonus: 500_000, advance: 1_000_000 });
  assert.equal(r.gross, 5_500_000);
  assert.equal(r.tax, 660_000);
  assert.equal(r.net, 5_500_000 - 660_000 - 1_000_000);
});

test('oklad: ishlangan kunlarga mutanosib', () => {
  const r = calculate({ ...base, baseSalary: 4_400_000, workedDays: 11 });
  assert.equal(r.base, 2_200_000);
});

test('o\'quvchi boshiga: to\'lagan o\'quvchilar soni x stavka', () => {
  const r = calculate({ ...base, payType: 'per_student', rate: 80_000, paidStudents: 25, taxRate: 0 });
  assert.equal(r.variable, 2_000_000);
  assert.equal(r.net, 2_000_000);
});

test('foiz: tushumdan ulush + qat\'iy qism', () => {
  const r = calculate({ ...base, payType: 'percent', rate: 40, revenue: 10_000_000, baseSalary: 1_000_000, taxRate: 0 });
  assert.equal(r.variable, 4_000_000);
  assert.equal(r.gross, 5_000_000);
});

test('soatbay', () => {
  const r = calculate({ ...base, payType: 'hourly', rate: 50_000, hours: 120, taxRate: 0, deductions: 100_000 });
  assert.equal(r.net, 5_900_000);
});
