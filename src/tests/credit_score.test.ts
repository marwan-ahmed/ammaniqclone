import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  evaluateBorrowerCredit,
  evaluatePortfolioCredit,
  CreditTier,
  BorrowerCreditEvaluation
} from '../utils/creditScore';
import { Borrower, InstallmentContract } from '../types/finance';

describe('Credit Scoring & Borrower Quality Engine Tests', () => {
  const baseBorrower: Borrower = {
    id: 'b-1',
    name: 'علي حسن السامرائي',
    phone: '07701234567',
    address: 'سامراء - حي المعلمين',
    city: 'سامراء',
    monthlyIncomeIQD: 1500000, // 1.5M IQD salary
    totalFinancedIQD: 2400000,
    totalRepaidIQD: 1200000,
    remainingDebtIQD: 1200000,
    status: 'ACTIVE',
    createdAt: '2026-01-01',
    guarantors: [
      {
        name: 'عمر طارق الجبوري',
        phone: '07709876543',
        nationalId: '1234567890',
        department: 'مديرية تربية سامراء',
        letterNumber: 'TR-2026-88',
        letterDate: '2026-01-05'
      }
    ]
  };

  test('Tier AAA: On-time payments, low DTI, and government guarantor yields golden rating', () => {
    const contracts: InstallmentContract[] = [
      {
        id: 'c-1',
        contractNumber: 'CT-101',
        borrowerId: 'b-1',
        borrowerName: 'علي حسن السامرائي',
        investorId: 'inv-1',
        investorName: 'محفظة النور',
        inventoryItemId: 'item-1',
        inventoryItemName: 'لابتوب ديل',
        itemCostPriceIQD: 1800000,
        totalSalePriceIQD: 2400000,
        profitMarginIQD: 600000,
        downPaymentIQD: 0,
        financedAmountIQD: 2400000,
        monthlyInstallmentIQD: 200000, // 200k / 1.5M = 13.3% DTI (very low)
        monthsCount: 12,
        startDate: '2026-01-01',
        endDate: '2026-12-01',
        status: 'ACTIVE',
        schedules: [
          {
            id: 's-1',
            contractId: 'c-1',
            installmentNumber: 1,
            dueDate: '2026-02-01',
            amountIQD: 200000,
            principalAmountIQD: 150000,
            profitAmountIQD: 50000,
            investorProfitShareIQD: 30000,
            companyProfitShareIQD: 20000,
            status: 'PAID',
            paidDate: '2026-02-01'
          },
          {
            id: 's-2',
            contractId: 'c-1',
            installmentNumber: 2,
            dueDate: '2026-11-01', // Future due date
            amountIQD: 200000,
            principalAmountIQD: 150000,
            profitAmountIQD: 50000,
            investorProfitShareIQD: 30000,
            companyProfitShareIQD: 20000,
            status: 'PENDING'
          }
        ]
      }
    ];

    const refDate = new Date('2026-10-23');
    const result = evaluateBorrowerCredit(baseBorrower, contracts, refDate);

    assert.ok(result.totalScore >= 90, `Expected score >= 90, got ${result.totalScore}`);
    assert.strictEqual(result.tier, 'AAA');
    assert.strictEqual(result.isBlacklisted, false);
    assert.ok(result.recommendedCreditLimitIQD > 5000000);
    assert.ok(result.availableCreditLimitIQD > 0);
  });

  test('Tier B: Moderate borrower with minor delay (1-7 days) and higher DTI', () => {
    const contracts: InstallmentContract[] = [
      {
        id: 'c-2',
        contractNumber: 'CT-102',
        borrowerId: 'b-1',
        borrowerName: 'علي حسن السامرائي',
        investorId: 'inv-1',
        investorName: 'محفظة النور',
        inventoryItemId: 'item-1',
        inventoryItemName: 'لابتوب ديل',
        itemCostPriceIQD: 1800000,
        totalSalePriceIQD: 2400000,
        profitMarginIQD: 600000,
        downPaymentIQD: 0,
        financedAmountIQD: 2400000,
        monthlyInstallmentIQD: 750000, // 750k / 1.5M = 50% DTI
        monthsCount: 12,
        startDate: '2026-01-01',
        endDate: '2026-12-01',
        status: 'ACTIVE',
        schedules: [
          {
            id: 's-3',
            contractId: 'c-2',
            installmentNumber: 1,
            dueDate: '2026-10-20', // Due 3 days ago relative to 2026-10-23
            amountIQD: 750000,
            principalAmountIQD: 550000,
            profitAmountIQD: 200000,
            investorProfitShareIQD: 120000,
            companyProfitShareIQD: 80000,
            status: 'PENDING'
          }
        ]
      }
    ];

    const refDate = new Date('2026-10-23');
    const result = evaluateBorrowerCredit(baseBorrower, contracts, refDate);

    assert.ok(result.totalScore >= 60 && result.totalScore < 80, `Expected score in 60-79, got ${result.totalScore}`);
    assert.strictEqual(result.tier, 'B');
    assert.strictEqual(result.isBlacklisted, false);
  });

  test('Auto-Blacklist: Installment overdue by > 60 days triggers immediate Tier D Blacklist', () => {
    const contracts: InstallmentContract[] = [
      {
        id: 'c-3',
        contractNumber: 'CT-103',
        borrowerId: 'b-1',
        borrowerName: 'علي حسن السامرائي',
        investorId: 'inv-1',
        investorName: 'محفظة النور',
        inventoryItemId: 'item-1',
        inventoryItemName: 'لابتوب ديل',
        itemCostPriceIQD: 1800000,
        totalSalePriceIQD: 2400000,
        profitMarginIQD: 600000,
        downPaymentIQD: 0,
        financedAmountIQD: 2400000,
        monthlyInstallmentIQD: 200000,
        monthsCount: 12,
        startDate: '2026-01-01',
        endDate: '2026-12-01',
        status: 'ACTIVE',
        schedules: [
          {
            id: 's-4',
            contractId: 'c-3',
            installmentNumber: 1,
            dueDate: '2026-08-01', // 83 days overdue relative to 2026-10-23
            amountIQD: 200000,
            principalAmountIQD: 150000,
            profitAmountIQD: 50000,
            investorProfitShareIQD: 30000,
            companyProfitShareIQD: 20000,
            status: 'PENDING'
          }
        ]
      }
    ];

    const refDate = new Date('2026-10-23');
    const result = evaluateBorrowerCredit(baseBorrower, contracts, refDate);

    assert.strictEqual(result.isBlacklisted, true);
    assert.strictEqual(result.tier, 'D');
    assert.ok(result.totalScore < 40);
    assert.ok(result.blacklistReason && result.blacklistReason.includes('يوم'));
    assert.strictEqual(result.availableCreditLimitIQD, 0); // Blacklisted has 0 available credit
  });

  test('Auto-Blacklist: Defaulted contract triggers immediate Blacklist', () => {
    const defaultedBorrower: Borrower = {
      ...baseBorrower,
      status: 'DEFAULTED'
    };

    const refDate = new Date('2026-10-23');
    const result = evaluateBorrowerCredit(defaultedBorrower, [], refDate);

    assert.strictEqual(result.isBlacklisted, true);
    assert.strictEqual(result.tier, 'D');
    assert.ok(result.blacklistReason && result.blacklistReason.includes('تعثر'));
  });

  test('Credit Limit Calculator: correctly calculates ceiling and deducts current debt', () => {
    const borrowerWithDebt: Borrower = {
      ...baseBorrower,
      monthlyIncomeIQD: 2000000, // 2M IQD salary
      remainingDebtIQD: 3000000  // 3M debt already
    };

    const refDate = new Date('2026-10-23');
    const result = evaluateBorrowerCredit(borrowerWithDebt, [], refDate);

    // Tier AAA with 2M salary: Max monthly installment = 45% of 2M = 900,000.
    // 12 months * 900k = 10,800,000 IQD limit.
    // Available = 10.8M - 3M = 7,800,000 IQD.
    assert.ok(result.recommendedCreditLimitIQD >= 10000000);
    assert.strictEqual(result.availableCreditLimitIQD, result.recommendedCreditLimitIQD - 3000000);
  });

  test('evaluatePortfolioCredit: aggregates portfolio metrics, health index and tier counts', () => {
    const b1 = { ...baseBorrower, id: 'b-1' };
    const b2 = { ...baseBorrower, id: 'b-2', status: 'DEFAULTED' as const };

    const refDate = new Date('2026-10-23');
    const portfolio = evaluatePortfolioCredit([b1, b2], [], refDate);

    assert.strictEqual(portfolio.evaluations.length, 2);
    assert.strictEqual(portfolio.blacklistedCount, 1);
    assert.ok(portfolio.portfolioHealthIndex > 0 && portfolio.portfolioHealthIndex < 100);
    assert.strictEqual(portfolio.tierCounts.D, 1);
  });
});
