import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateInstallmentDueStatus,
  getBorrowerDueSummary,
  normalizeToMidnight
} from '../utils/installmentDates';
import { InstallmentContract } from '../types/finance';

describe('Installment Dates & Overdue Calculation Tests', () => {
  const baseDate = new Date('2026-10-23T12:00:00Z'); // Friday Oct 23, 2026

  it('correctly handles already paid installments', () => {
    const res = calculateInstallmentDueStatus('2026-10-01', true, baseDate);
    assert.strictEqual(res.status, 'PAID');
    assert.strictEqual(res.daysOverdue, 0);
    assert.strictEqual(res.label, 'مسدد بالكامل');
    assert.strictEqual(res.severity, 'NONE');
  });

  it('detects installments overdue by 1 day', () => {
    const res = calculateInstallmentDueStatus('2026-10-22', false, baseDate);
    assert.strictEqual(res.status, 'OVERDUE');
    assert.strictEqual(res.diffDays, -1);
    assert.strictEqual(res.daysOverdue, 1);
    assert.strictEqual(res.label, 'متأخر منذ 1 يوم');
    assert.strictEqual(res.severity, 'MODERATE');
  });

  it('detects installments overdue by 14 days with HIGH severity', () => {
    const res = calculateInstallmentDueStatus('2026-10-09', false, baseDate);
    assert.strictEqual(res.status, 'OVERDUE');
    assert.strictEqual(res.diffDays, -14);
    assert.strictEqual(res.daysOverdue, 14);
    assert.strictEqual(res.label, 'متأخر منذ 14 يوم');
    assert.strictEqual(res.severity, 'HIGH');
  });

  it('detects critical overdue (> 30 days)', () => {
    const res = calculateInstallmentDueStatus('2026-09-01', false, baseDate);
    assert.strictEqual(res.status, 'OVERDUE');
    assert.ok(res.daysOverdue > 30);
    assert.strictEqual(res.severity, 'CRITICAL');
  });

  it('detects installments due exactly today', () => {
    const res = calculateInstallmentDueStatus('2026-10-23', false, baseDate);
    assert.strictEqual(res.status, 'DUE_TODAY');
    assert.strictEqual(res.diffDays, 0);
    assert.strictEqual(res.daysOverdue, 0);
    assert.strictEqual(res.daysRemaining, 0);
    assert.strictEqual(res.label, 'يستحق اليوم');
  });

  it('matches user example: due in 5 days (2026-10-28) is marked UPCOMING', () => {
    // User requested example: "مروان يستحق قسطه الشهري يوم 28/10/2026 يعني باقي 5 ايام على التسديد يكون هناك تنبيه"
    const res = calculateInstallmentDueStatus('2026-10-28', false, baseDate);
    assert.strictEqual(res.status, 'UPCOMING');
    assert.strictEqual(res.diffDays, 5);
    assert.strictEqual(res.daysRemaining, 5);
    assert.strictEqual(res.label, 'باقي 5 أيام على موعد السداد');
    assert.strictEqual(res.shortLabel, 'باقي 5 أيام');
  });

  it('marks installments more than 7 days ahead as FUTURE', () => {
    const res = calculateInstallmentDueStatus('2026-11-15', false, baseDate);
    assert.strictEqual(res.status, 'FUTURE');
    assert.strictEqual(res.daysRemaining, 23);
    assert.strictEqual(res.label, 'باقي 23 يوم');
  });

  describe('getBorrowerDueSummary', () => {
    const dummyContract: InstallmentContract = {
      id: 'cnt-1',
      contractNumber: 'CNT-101',
      borrowerId: 'bor-1',
      borrowerName: 'مروان أحمد',
      investorId: 'inv-1',
      investorName: 'الحاج مهند',
      inventoryItemId: 'item-1',
      inventoryItemName: 'حديد تسليح',
      itemCostPriceIQD: 1000000,
      totalSalePriceIQD: 1300000,
      profitMarginIQD: 300000,
      downPaymentIQD: 300000,
      financedAmountIQD: 1000000,
      monthlyInstallmentIQD: 100000,
      monthsCount: 10,
      startDate: '2026-01-01',
      endDate: '2026-11-01',
      status: 'ACTIVE',
      schedules: [
        {
          id: 'sch-1',
          contractId: 'cnt-1',
          installmentNumber: 1,
          dueDate: '2026-10-28', // 5 days upcoming
          amountIQD: 100000,
          principalAmountIQD: 70000,
          profitAmountIQD: 30000,
          investorProfitShareIQD: 18000,
          companyProfitShareIQD: 12000,
          status: 'PENDING'
        }
      ]
    };

    it('summarizes borrower with upcoming installment', () => {
      const summary = getBorrowerDueSummary('bor-1', [dummyContract], baseDate);
      assert.strictEqual(summary.hasOverdue, false);
      assert.strictEqual(summary.hasUpcoming, true);
      assert.strictEqual(summary.earliestUpcomingDays, 5);
      assert.strictEqual(summary.overallStatus, 'UPCOMING');
      assert.ok(summary.summaryBadge.label.includes('باقي 5 أيام'));
    });

    it('prioritizes OVERDUE over upcoming if any installment is late', () => {
      const contractWithOverdue: InstallmentContract = {
        ...dummyContract,
        schedules: [
          ...dummyContract.schedules,
          {
            id: 'sch-2',
            contractId: 'cnt-1',
            installmentNumber: 2,
            dueDate: '2026-10-20', // 3 days overdue
            amountIQD: 100000,
            principalAmountIQD: 70000,
            profitAmountIQD: 30000,
            investorProfitShareIQD: 18000,
            companyProfitShareIQD: 12000,
            status: 'PENDING'
          }
        ]
      };

      const summary = getBorrowerDueSummary('bor-1', [contractWithOverdue], baseDate);
      assert.strictEqual(summary.hasOverdue, true);
      assert.strictEqual(summary.maxDaysOverdue, 3);
      assert.strictEqual(summary.overallStatus, 'OVERDUE');
      assert.ok(summary.summaryBadge.label.includes('متأخر (3 يوم)'));
    });
  });
});
