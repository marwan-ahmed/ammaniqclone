import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationStore } from '../services/simulation';
import { InstallmentContract, Borrower } from '../types/finance';

function setupTestEnvironment(store: SimulationStore) {
  const invRes = store.addInvestor({
    name: 'المستثمر علي',
    phone: '07701234567',
    address: 'بغداد',
    capitalAmount: 10000000,
    investorSharePercent: 70,
    companySharePercent: 30,
  });

  const borrower: Borrower = {
    id: 'borrower-1',
    name: 'احمد اياد ابراهيم',
    phone: '07709876543',
    nationalId: '123456',
    address: 'سامراء',
    city: 'سامراء',
    guarantors: [],
    totalFinancedIQD: 2400000,
    totalRepaidIQD: 0,
    remainingDebtIQD: 2400000,
    status: 'ACTIVE',
    createdAt: '2026-01-01'
  };
  store.borrowers.push(borrower);

  const contract: InstallmentContract = {
    id: 'contract-test-1',
    contractNumber: 'CNT-2026-795',
    invoiceNumber: 795,
    borrowerId: borrower.id,
    borrowerName: borrower.name,
    investorId: invRes.investor.id,
    investorName: invRes.investor.name,
    inventoryItemId: 'item-1',
    inventoryItemName: 'بضاعة 2 مليون',
    itemCostPriceIQD: 2000000,
    totalSalePriceIQD: 2400000,
    profitMarginIQD: 400000,
    downPaymentIQD: 0,
    financedAmountIQD: 2400000,
    monthlyInstallmentIQD: 200000,
    monthsCount: 12,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    schedules: [],
    status: 'ACTIVE'
  };
  store.contracts.push(contract);

  return { investor: invRes.investor, borrower, contract };
}

test('Installment Schedule Partial Payment & Rollover System', async (t) => {
  await t.test('correctly reduces current installment and rolls over remaining difference to next installment with exact Arabic notes', () => {
    const store = new SimulationStore();
    const { contract } = setupTestEnvironment(store);

    contract.schedules = [
      {
        id: 'sch-test-1',
        contractId: contract.id,
        installmentNumber: 1,
        dueDate: '2026-10-01',
        amountIQD: 200000,
        principalAmountIQD: 150000,
        profitAmountIQD: 50000,
        investorProfitShareIQD: 35000,
        companyProfitShareIQD: 15000,
        status: 'PENDING'
      },
      {
        id: 'sch-test-2',
        contractId: contract.id,
        installmentNumber: 2,
        dueDate: '2026-11-01',
        amountIQD: 200000,
        principalAmountIQD: 150000,
        profitAmountIQD: 50000,
        investorProfitShareIQD: 35000,
        companyProfitShareIQD: 15000,
        status: 'PENDING'
      },
      {
        id: 'sch-test-3',
        contractId: contract.id,
        installmentNumber: 3,
        dueDate: '2026-12-01',
        amountIQD: 200000,
        principalAmountIQD: 150000,
        profitAmountIQD: 50000,
        investorProfitShareIQD: 35000,
        companyProfitShareIQD: 15000,
        status: 'PENDING'
      }
    ];

    // Customer pays 50,000 IQD partially on installment 1
    const result = store.payInstallmentSchedule(contract.id, 'sch-test-1', 50000);
    assert.equal(result.success, true);

    const sch1 = contract.schedules.find((s) => s.id === 'sch-test-1')!;
    const sch2 = contract.schedules.find((s) => s.id === 'sch-test-2')!;

    // 1. Current installment checks
    assert.equal(sch1.status, 'PAID');
    assert.equal(sch1.amountIQD, 50000);
    assert.ok(sch1.notes?.includes('تم سداد 50,000 د.ع جزئياً'));
    assert.ok(sch1.notes?.includes('وترحيل المتبقي (150,000 د.ع) إلى القسط اللاحق'));

    // 2. Next installment checks (200,000 original + 150,000 rollover = 350,000)
    assert.equal(sch2.status, 'PENDING');
    assert.equal(sch2.amountIQD, 350000);
    assert.ok(sch2.notes?.includes('القسط الأصلي: 200,000 د.ع'));
    assert.ok(sch2.notes?.includes('والمتبقي 150,000 د.ع هو عن الدفعة السابقة (قسط شهر 1)'));

    // 3. Unaffected subsequent installments
    const sch3 = contract.schedules.find((s) => s.id === 'sch-test-3')!;
    assert.equal(sch3.amountIQD, 200000);
    assert.equal(sch3.status, 'PENDING');
  });

  await t.test('handles full payment without modifying next installment amount', () => {
    const store = new SimulationStore();
    const { contract } = setupTestEnvironment(store);

    contract.schedules = [
      {
        id: 'sch-full-1',
        contractId: contract.id,
        installmentNumber: 1,
        dueDate: '2026-10-01',
        amountIQD: 200000,
        principalAmountIQD: 150000,
        profitAmountIQD: 50000,
        investorProfitShareIQD: 35000,
        companyProfitShareIQD: 15000,
        status: 'PENDING'
      },
      {
        id: 'sch-full-2',
        contractId: contract.id,
        installmentNumber: 2,
        dueDate: '2026-11-01',
        amountIQD: 200000,
        principalAmountIQD: 150000,
        profitAmountIQD: 50000,
        investorProfitShareIQD: 35000,
        companyProfitShareIQD: 15000,
        status: 'PENDING'
      }
    ];

    const result = store.payInstallmentSchedule(contract.id, 'sch-full-1', 200000);
    assert.equal(result.success, true);

    const sch1 = contract.schedules.find((s) => s.id === 'sch-full-1')!;
    const sch2 = contract.schedules.find((s) => s.id === 'sch-full-2')!;

    assert.equal(sch1.status, 'PAID');
    assert.equal(sch1.amountIQD, 200000);
    assert.equal(sch2.amountIQD, 200000);
    assert.equal(sch2.notes, undefined);
  });

  await t.test('creates extension installment if partial payment is made on final installment', () => {
    const store = new SimulationStore();
    const { contract } = setupTestEnvironment(store);

    contract.schedules = [
      {
        id: 'sch-last-1',
        contractId: contract.id,
        installmentNumber: 1,
        dueDate: '2026-10-01',
        amountIQD: 200000,
        principalAmountIQD: 150000,
        profitAmountIQD: 50000,
        investorProfitShareIQD: 35000,
        companyProfitShareIQD: 15000,
        status: 'PENDING'
      }
    ];

    // Pay 80,000 on final installment
    const result = store.payInstallmentSchedule(contract.id, 'sch-last-1', 80000);
    assert.equal(result.success, true);

    assert.equal(contract.schedules.length, 2);
    const sch1 = contract.schedules[0];
    const schExt = contract.schedules[1];

    assert.equal(sch1.status, 'PAID');
    assert.equal(sch1.amountIQD, 80000);
    assert.equal(schExt.status, 'PENDING');
    assert.equal(schExt.installmentNumber, 2);
    assert.equal(schExt.amountIQD, 120000);
    assert.ok(schExt.notes?.includes('المتبقي 120,000 د.ع هو عن الدفعة السابقة (قسط شهر 1)'));
  });

  await t.test('direct debts also support partial repayment and carryover notes', () => {
    const store = new SimulationStore();

    const directDebt: InstallmentContract = {
      id: 'debt-1',
      contractNumber: 'DEBT-2026-100',
      borrowerId: 'borrower-debt-1',
      borrowerName: 'علي جاسم',
      investorId: 'company',
      investorName: 'النظام',
      inventoryItemId: 'item-d1',
      inventoryItemName: 'مكيف',
      itemCostPriceIQD: 800000,
      totalSalePriceIQD: 1000000,
      downPaymentIQD: 0,
      monthlyInstallmentIQD: 100000,
      monthsCount: 2,
      profitMarginIQD: 200000,
      financedAmountIQD: 1000000,
      startDate: '2026-10-01',
      endDate: '2026-12-01',
      status: 'ACTIVE',
      schedules: [
        {
          id: 'sch-debt-1',
          contractId: 'debt-1',
          installmentNumber: 1,
          dueDate: '2026-10-01',
          amountIQD: 100000,
          principalAmountIQD: 80000,
          profitAmountIQD: 20000,
          investorProfitShareIQD: 14000,
          companyProfitShareIQD: 6000,
          status: 'PENDING'
        },
        {
          id: 'sch-debt-2',
          contractId: 'debt-1',
          installmentNumber: 2,
          dueDate: '2026-11-01',
          amountIQD: 100000,
          principalAmountIQD: 80000,
          profitAmountIQD: 20000,
          investorProfitShareIQD: 14000,
          companyProfitShareIQD: 6000,
          status: 'PENDING'
        }
      ]
    };
    store.directDebts.push(directDebt);

    const result = store.payDirectDebtSchedule(directDebt.id, 'sch-debt-1', 40000);
    assert.equal(result.success, true);

    const sch1 = directDebt.schedules[0];
    const sch2 = directDebt.schedules[1];

    assert.equal(sch1.status, 'PAID');
    assert.equal(sch1.amountIQD, 40000);
    assert.equal(sch2.amountIQD, 160000);
    assert.ok(sch2.notes?.includes('القسط الأصلي: 100,000 د.ع'));
    assert.ok(sch2.notes?.includes('والمتبقي 60,000 د.ع هو عن الدفعة السابقة (قسط شهر 1)'));
  });

  await t.test('computes receipt previous balance and current balance with accurate deduction', () => {
    const contract: InstallmentContract = {
      id: 'cnt-calc-1',
      contractNumber: 'CNT-2026-795',
      borrowerId: 'b-1',
      borrowerName: 'احمد اياد ابراهيم',
      investorId: 'inv-1',
      investorName: 'المستثمر',
      inventoryItemId: 'item-1',
      inventoryItemName: 'بضاعة',
      itemCostPriceIQD: 3000000,
      totalSalePriceIQD: 4000000,
      profitMarginIQD: 1000000,
      downPaymentIQD: 0,
      financedAmountIQD: 4000000,
      monthlyInstallmentIQD: 1000000,
      monthsCount: 4,
      startDate: '2026-01-01',
      endDate: '2026-04-01',
      status: 'ACTIVE',
      schedules: [
        { id: 's1', contractId: 'cnt-calc-1', installmentNumber: 1, dueDate: '2026-01-01', amountIQD: 1000000, principalAmountIQD: 750000, profitAmountIQD: 250000, investorProfitShareIQD: 175000, companyProfitShareIQD: 75000, status: 'PAID' },
        { id: 's2', contractId: 'cnt-calc-1', installmentNumber: 2, dueDate: '2026-02-01', amountIQD: 1000000, principalAmountIQD: 750000, profitAmountIQD: 250000, investorProfitShareIQD: 175000, companyProfitShareIQD: 75000, status: 'PAID' },
        { id: 's3', contractId: 'cnt-calc-1', installmentNumber: 3, dueDate: '2026-03-01', amountIQD: 600000, principalAmountIQD: 450000, profitAmountIQD: 150000, investorProfitShareIQD: 105000, companyProfitShareIQD: 45000, status: 'PAID' },
        { id: 's4', contractId: 'cnt-calc-1', installmentNumber: 4, dueDate: '2026-04-01', amountIQD: 1400000, principalAmountIQD: 1050000, profitAmountIQD: 350000, investorProfitShareIQD: 245000, companyProfitShareIQD: 105000, status: 'PENDING' }
      ]
    };

    function calculateVoucherBalances(c: InstallmentContract, sch: any) {
      const totalContractFinancedIQD = (c.financedAmountIQD && c.financedAmountIQD > 0)
        ? c.financedAmountIQD
        : Math.max(0, (c.totalSalePriceIQD || 0) - (c.downPaymentIQD || 0));

      const fallbackTotal = c.schedules.reduce((sum, s) => sum + s.amountIQD, 0);
      const effectiveContractTotalIQD = totalContractFinancedIQD > 0 ? totalContractFinancedIQD : fallbackTotal;

      const paidPriorToThisIQD = c.schedules
        .filter((s) => s.installmentNumber < sch.installmentNumber && s.status === 'PAID')
        .reduce((sum, s) => sum + s.amountIQD, 0);

      const previousBalanceIQD = Math.max(0, effectiveContractTotalIQD - paidPriorToThisIQD);
      const currentPaidAmountIQD = sch.amountIQD;
      const currentBalanceIQD = Math.max(0, previousBalanceIQD - currentPaidAmountIQD);

      return { previousBalanceIQD, currentPaidAmountIQD, currentBalanceIQD };
    }

    // Installment 1:
    const b1 = calculateVoucherBalances(contract, contract.schedules[0]);
    assert.equal(b1.previousBalanceIQD, 4000000);
    assert.equal(b1.currentPaidAmountIQD, 1000000);
    assert.equal(b1.currentBalanceIQD, 3000000);

    // Installment 2:
    const b2 = calculateVoucherBalances(contract, contract.schedules[1]);
    assert.equal(b2.previousBalanceIQD, 3000000);
    assert.equal(b2.currentPaidAmountIQD, 1000000);
    assert.equal(b2.currentBalanceIQD, 2000000);

    // Installment 3 (Partial payment of 600,000):
    const b3 = calculateVoucherBalances(contract, contract.schedules[2]);
    assert.equal(b3.previousBalanceIQD, 2000000);
    assert.equal(b3.currentPaidAmountIQD, 600000);
    assert.equal(b3.currentBalanceIQD, 1400000);
    assert.equal(b3.currentBalanceIQD, b3.previousBalanceIQD - b3.currentPaidAmountIQD);

    // Installment 4 (Settles the remaining 1,400,000):
    const sch4Paid = { ...contract.schedules[3], status: 'PAID' as const };
    const contractWith4Paid: InstallmentContract = {
      ...contract,
      schedules: [contract.schedules[0], contract.schedules[1], contract.schedules[2], sch4Paid]
    };
    const b4 = calculateVoucherBalances(contractWith4Paid, sch4Paid);
    assert.equal(b4.previousBalanceIQD, 1400000);
    assert.equal(b4.currentPaidAmountIQD, 1400000);
    assert.equal(b4.currentBalanceIQD, 0);
  });

  await t.test('Multi-installment cascade (Marwan example: 100k installment, paid 250k -> settles 100k, next 100k, 50k on 3rd)', () => {
    const store = new SimulationStore();
    const { contract } = setupTestEnvironment(store);

    // Setup 4 schedules of 100,000 IQD each
    contract.schedules = [
      {
        id: 'sch-m1',
        contractId: contract.id,
        installmentNumber: 1,
        dueDate: '2026-10-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      },
      {
        id: 'sch-m2',
        contractId: contract.id,
        installmentNumber: 2,
        dueDate: '2026-11-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      },
      {
        id: 'sch-m3',
        contractId: contract.id,
        installmentNumber: 3,
        dueDate: '2026-12-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      },
      {
        id: 'sch-m4',
        contractId: contract.id,
        installmentNumber: 4,
        dueDate: '2027-01-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      }
    ];

    const initialBorrowerDebt = store.borrowers.find((b) => b.id === contract.borrowerId)!.remainingDebtIQD;

    // Customer pays 250,000 IQD on Installment 1
    const result = store.payInstallmentSchedule(contract.id, 'sch-m1', 250000);
    assert.equal(result.success, true);
    assert.ok(result.message.includes('250,000 د.ع'));

    const sch1 = contract.schedules.find((s) => s.id === 'sch-m1')!;
    const sch2 = contract.schedules.find((s) => s.id === 'sch-m2')!;
    const sch3 = contract.schedules.find((s) => s.id === 'sch-m3')!;
    const sch4 = contract.schedules.find((s) => s.id === 'sch-m4')!;

    // 1. Month 1: 100,000 IQD fully paid
    assert.equal(sch1.status, 'PAID');
    assert.equal(sch1.amountIQD, 100000);

    // 2. Month 2: 100,000 IQD fully paid from surplus
    assert.equal(sch2.status, 'PAID');
    assert.equal(sch2.amountIQD, 100000);
    assert.ok(sch2.notes?.includes('تم سداد القسط بالكامل من فائض سداد قسط شهر 1'));

    // 3. Month 3: 50,000 IQD partially paid from surplus, 50,000 rolled over to Month 4
    assert.equal(sch3.status, 'PAID');
    assert.equal(sch3.amountIQD, 50000);
    assert.ok(sch3.notes?.includes('تم سداد 50,000 د.ع جزئياً'));
    assert.ok(sch3.notes?.includes('وترحيل المتبقي (50,000 د.ع) إلى القسط اللاحق'));

    // 4. Month 4: 100,000 original + 50,000 rollover = 150,000 IQD
    assert.equal(sch4.status, 'PENDING');
    assert.equal(sch4.amountIQD, 150000);
    assert.ok(sch4.notes?.includes('القسط الأصلي: 100,000 د.ع'));
    assert.ok(sch4.notes?.includes('والمتبقي 50,000 د.ع هو عن الدفعة السابقة (قسط شهر 3)'));

    // 5. Borrower remaining debt reduced by exactly 250,000 IQD
    const finalBorrowerDebt = store.borrowers.find((b) => b.id === contract.borrowerId)!.remainingDebtIQD;
    assert.equal(initialBorrowerDebt - finalBorrowerDebt, 250000);
  });

  await t.test('Multi-installment cascade: exact multiple payments (pay 200k for two 100k installments)', () => {
    const store = new SimulationStore();
    const { contract } = setupTestEnvironment(store);

    contract.schedules = [
      {
        id: 'sch-x1',
        contractId: contract.id,
        installmentNumber: 1,
        dueDate: '2026-10-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      },
      {
        id: 'sch-x2',
        contractId: contract.id,
        installmentNumber: 2,
        dueDate: '2026-11-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      },
      {
        id: 'sch-x3',
        contractId: contract.id,
        installmentNumber: 3,
        dueDate: '2026-12-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      }
    ];

    const result = store.payInstallmentSchedule(contract.id, 'sch-x1', 200000);
    assert.equal(result.success, true);

    const sch1 = contract.schedules.find((s) => s.id === 'sch-x1')!;
    const sch2 = contract.schedules.find((s) => s.id === 'sch-x2')!;
    const sch3 = contract.schedules.find((s) => s.id === 'sch-x3')!;

    assert.equal(sch1.status, 'PAID');
    assert.equal(sch1.amountIQD, 100000);
    assert.equal(sch2.status, 'PAID');
    assert.equal(sch2.amountIQD, 100000);

    // Month 3 remains untouched
    assert.equal(sch3.status, 'PENDING');
    assert.equal(sch3.amountIQD, 100000);
  });

  await t.test('Multi-installment cascade: rejects payment exceeding total remaining debt', () => {
    const store = new SimulationStore();
    const { contract } = setupTestEnvironment(store);

    contract.schedules = [
      {
        id: 'sch-lim1',
        contractId: contract.id,
        installmentNumber: 1,
        dueDate: '2026-10-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      },
      {
        id: 'sch-lim2',
        contractId: contract.id,
        installmentNumber: 2,
        dueDate: '2026-11-01',
        amountIQD: 100000,
        principalAmountIQD: 80000,
        profitAmountIQD: 20000,
        investorProfitShareIQD: 14000,
        companyProfitShareIQD: 6000,
        status: 'PENDING'
      }
    ];

    // Total remaining is 200,000, trying to pay 250,000
    const result = store.payInstallmentSchedule(contract.id, 'sch-lim1', 250000);
    assert.equal(result.success, false);
    assert.ok(result.message.includes('يتجاوز إجمالي الأقساط المتبقية'));
  });
});

