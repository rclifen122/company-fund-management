import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBulkPaymentRows,
  buildEmployeeMonthCoverage,
  getBulkPaymentEligibility,
  getMonthlyContribution,
} from '../src/utils/fundPaymentBatch.js';

const employees = [
  { id: 'employee-a', name: 'An', monthly_contribution_amount: 100000, join_date: '2026-01-10' },
  { id: 'employee-b', name: 'Bình', monthly_contribution_amount: 150000, fund_start_date: '2026-09-01' },
];

test('coverage prefers a real payment over a reconciliation', () => {
  const coverage = buildEmployeeMonthCoverage(
    [{ employee_id: 'employee-a', months_covered: ['2026-08'] }],
    [{ employee_id: 'employee-a', month_key: '2026-08' }]
  );

  assert.deepEqual(
    getBulkPaymentEligibility(employees[0], '2026-08', coverage),
    { eligible: false, status: 'paid', label: 'Đã đóng' }
  );
});

test('legacy payments use payment_date as their covered month', () => {
  const coverage = buildEmployeeMonthCoverage([
    { employee_id: 'employee-a', payment_date: '2026-07-05' },
  ]);

  assert.equal(getBulkPaymentEligibility(employees[0], '2026-07', coverage).status, 'paid');
});

test('employees cannot be selected before their contribution start month', () => {
  const eligibility = getBulkPaymentEligibility(
    employees[1],
    '2026-08',
    buildEmployeeMonthCoverage()
  );

  assert.deepEqual(eligibility, {
    eligible: false,
    status: 'not_started',
    label: 'Chưa đến kỳ',
  });
});

test('bulk rows retain individual contribution amounts and shared fields', () => {
  const rows = buildBulkPaymentRows({
    employees,
    selectedEmployeeIds: ['employee-a', 'employee-b'],
    amountsByEmployee: { 'employee-a': '120000' },
    monthKey: '2026-09',
    paymentDate: '2026-09-05',
    paymentMethod: 'bank_transfer',
    notes: 'Đợt tháng 9',
  });

  assert.deepEqual(rows, [
    {
      employee_id: 'employee-a',
      amount: 120000,
      payment_date: '2026-09-05',
      months_covered: ['2026-09'],
      payment_method: 'bank_transfer',
      notes: 'Đợt tháng 9',
    },
    {
      employee_id: 'employee-b',
      amount: 150000,
      payment_date: '2026-09-05',
      months_covered: ['2026-09'],
      payment_method: 'bank_transfer',
      notes: 'Đợt tháng 9',
    },
  ]);
});

test('invalid employee contribution falls back to the application default', () => {
  assert.equal(getMonthlyContribution({ monthly_contribution_amount: 0 }), 100000);
});
