import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SimulationStore } from '../services/simulation';
import { Wallet } from '../types/finance';

describe('Installment Schedule Exact Dinar Conservation & Rounding Tests', () => {
  test('createContract distributes dinar remainders with zero drift (12 months 50/50 split)', () => {
    const store = new SimulationStore();

    // Setup Investor
    store.investors = [
      {
        id: 'inv-1',
        name: 'شوكت إبراهيم',
        phone: '07700000000',
        walletId: 'wallet-inv-1',
        contract: {
          id: 'cfg-1',
          investorId: 'inv-1',
          investorSharePercent: 50,
          companySharePercent: 50,
          lossSharingPolicy: 'SHARED',
          contractDate: '2026-01-01'
        },
        totalCapitalDeposited: 1000000,
        availableLiquidity: 0,
        activeInvestmentsAmount: 1000000,
        totalProfitsEarned: 0,
        totalLossesIncurred: 0,
        createdAt: '2026-01-01'
      }
    ];

    store.wallets = [
      store.companyWallet,
      {
        id: 'wallet-inv-1',
        ownerType: 'INVESTOR',
        ownerId: 'inv-1',
        ownerName: 'شوكت إبراهيم',
        balance: 0,
        totalAssetsValuation: 1000000,
        totalDebtsValuation: 0,
        currency: 'IQD',
        updatedAt: '2026-01-01'
      }
    ];

    store.inventory = [
      {
        id: 'item-1',
        sku: 'SKU-001',
        name: 'غسالة ال جي',
        category: 'أجهزة كهربائية',
        investorId: 'inv-1',
        investorName: 'شوكت إبراهيم',
        quantity: 1,
        unitCostIQD: 1000000,
        totalCostIQD: 1000000,
        targetSellingPriceIQD: 1200000,
        purchaseInvoiceId: 'INV-1',
        status: 'IN_STOCK',
        purchaseDate: '2026-01-01'
      }
    ];

    store.borrowers = [
      {
        id: 'bor-1',
        name: 'علي حسن',
        phone: '07800000000',
        nationalId: '123456',
        city: 'سامراء',
        address: 'حي القادسية',
        guarantors: [],
        totalFinancedIQD: 0,
        totalRepaidIQD: 0,
        remainingDebtIQD: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01'
      }
    ];

    const res = store.createContract({
      borrowerId: 'bor-1',
      inventoryItemId: 'item-1',
      totalSalePriceIQD: 1200000,
      downPaymentIQD: 0,
      monthsCount: 12
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.contract);

    const contract = res.contract;
    const scheds = contract.schedules;
    assert.strictEqual(scheds.length, 12);

    let sumAmt = 0;
    let sumPrinc = 0;
    let sumInv = 0;
    let sumComp = 0;

    for (const s of scheds) {
      assert.strictEqual(
        s.principalAmountIQD + s.investorProfitShareIQD + s.companyProfitShareIQD,
        s.amountIQD,
        `Schedule ${s.installmentNumber} must balance exactly`
      );
      assert.strictEqual(
        s.investorProfitShareIQD + s.companyProfitShareIQD,
        s.profitAmountIQD,
        `Schedule ${s.installmentNumber} profit shares must equal total profit`
      );
      sumAmt += s.amountIQD;
      sumPrinc += s.principalAmountIQD;
      sumInv += s.investorProfitShareIQD;
      sumComp += s.companyProfitShareIQD;
    }

    assert.strictEqual(sumAmt, 1200000, 'Sum of installments must equal 1,200,000 IQD');
    assert.strictEqual(sumPrinc, 1000000, 'Sum of principal must equal 1,000,000 IQD');
    assert.strictEqual(sumInv, 100000, 'Sum of investor profit must equal 100,000 IQD');
    assert.strictEqual(sumComp, 100000, 'Sum of company profit must equal 100,000 IQD');
  });

  test('createContract handles odd months count (14 months) with exact sum conservation', () => {
    const store = new SimulationStore();

    store.investors = [
      {
        id: 'inv-1',
        name: 'شوكت إبراهيم',
        phone: '07700000000',
        walletId: 'wallet-inv-1',
        contract: {
          id: 'cfg-1',
          investorId: 'inv-1',
          investorSharePercent: 50,
          companySharePercent: 50,
          lossSharingPolicy: 'SHARED',
          contractDate: '2026-01-01'
        },
        totalCapitalDeposited: 1000000,
        availableLiquidity: 0,
        activeInvestmentsAmount: 1000000,
        totalProfitsEarned: 0,
        totalLossesIncurred: 0,
        createdAt: '2026-01-01'
      }
    ];

    store.wallets = [
      store.companyWallet,
      {
        id: 'wallet-inv-1',
        ownerType: 'INVESTOR',
        ownerId: 'inv-1',
        ownerName: 'شوكت إبراهيم',
        balance: 0,
        totalAssetsValuation: 1000000,
        totalDebtsValuation: 0,
        currency: 'IQD',
        updatedAt: '2026-01-01'
      }
    ];

    store.inventory = [
      {
        id: 'item-2',
        sku: 'SKU-002',
        name: 'مكيف سبليت',
        category: 'أجهزة كهربائية',
        investorId: 'inv-1',
        investorName: 'شوكت إبراهيم',
        quantity: 1,
        unitCostIQD: 1000000,
        totalCostIQD: 1000000,
        targetSellingPriceIQD: 1300000,
        purchaseInvoiceId: 'INV-2',
        status: 'IN_STOCK',
        purchaseDate: '2026-01-01'
      }
    ];

    store.borrowers = [
      {
        id: 'bor-2',
        name: 'محمد خالد',
        phone: '07800000001',
        nationalId: '123457',
        city: 'سامراء',
        address: 'حي الشهداء',
        guarantors: [],
        totalFinancedIQD: 0,
        totalRepaidIQD: 0,
        remainingDebtIQD: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01'
      }
    ];

    const res = store.createContract({
      borrowerId: 'bor-2',
      inventoryItemId: 'item-2',
      totalSalePriceIQD: 1300000,
      downPaymentIQD: 0,
      monthsCount: 14
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.contract);

    const scheds = res.contract.schedules;
    assert.strictEqual(scheds.length, 14);

    let sumAmt = 0;
    let sumPrinc = 0;
    let sumInv = 0;
    let sumComp = 0;

    for (const s of scheds) {
      assert.strictEqual(
        s.principalAmountIQD + s.investorProfitShareIQD + s.companyProfitShareIQD,
        s.amountIQD,
        `Schedule ${s.installmentNumber} must balance exactly`
      );
      sumAmt += s.amountIQD;
      sumPrinc += s.principalAmountIQD;
      sumInv += s.investorProfitShareIQD;
      sumComp += s.companyProfitShareIQD;
    }

    assert.strictEqual(sumAmt, 1300000, 'Sum of installments must equal 1,300,000 IQD');
    assert.strictEqual(sumPrinc, 1000000, 'Sum of principal must equal 1,000,000 IQD');
    assert.strictEqual(sumInv, 150000, 'Sum of investor profit must equal 150,000 IQD');
    assert.strictEqual(sumComp, 150000, 'Sum of company profit must equal 150,000 IQD');
  });

  test('payInstallmentSchedule preserves exact schedule profit shares and produces exact 100k company profit', () => {
    const store = new SimulationStore();

    store.investors = [
      {
        id: 'inv-1',
        name: 'شوكت إبراهيم',
        phone: '07700000000',
        walletId: 'wallet-inv-1',
        contract: {
          id: 'cfg-1',
          investorId: 'inv-1',
          investorSharePercent: 50,
          companySharePercent: 50,
          lossSharingPolicy: 'SHARED',
          contractDate: '2026-01-01'
        },
        totalCapitalDeposited: 1000000,
        availableLiquidity: 0,
        activeInvestmentsAmount: 1000000,
        totalProfitsEarned: 0,
        totalLossesIncurred: 0,
        createdAt: '2026-01-01'
      }
    ];

    const invWallet: Wallet = {
      id: 'wallet-inv-1',
      ownerType: 'INVESTOR',
      ownerId: 'inv-1',
      ownerName: 'شوكت إبراهيم',
      balance: 0,
      totalAssetsValuation: 1000000,
      totalDebtsValuation: 0,
      currency: 'IQD',
      updatedAt: '2026-01-01'
    };
    store.wallets = [store.companyWallet, invWallet];

    store.inventory = [
      {
        id: 'item-1',
        sku: 'SKU-001',
        name: 'غسالة ال جي',
        category: 'أجهزة كهربائية',
        investorId: 'inv-1',
        investorName: 'شوكت إبراهيم',
        quantity: 1,
        unitCostIQD: 1000000,
        totalCostIQD: 1000000,
        targetSellingPriceIQD: 1200000,
        purchaseInvoiceId: 'INV-1',
        status: 'IN_STOCK',
        purchaseDate: '2026-01-01'
      }
    ];

    store.borrowers = [
      {
        id: 'bor-1',
        name: 'علي حسن',
        phone: '07800000000',
        nationalId: '123456',
        city: 'سامراء',
        address: 'حي القادسية',
        guarantors: [],
        totalFinancedIQD: 0,
        totalRepaidIQD: 0,
        remainingDebtIQD: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01'
      }
    ];

    const cRes = store.createContract({
      borrowerId: 'bor-1',
      inventoryItemId: 'item-1',
      totalSalePriceIQD: 1200000,
      downPaymentIQD: 0,
      monthsCount: 12
    });
    assert.ok(cRes.contract);
    const contract = cRes.contract;

    // Simulate paying months 1, 2, 3 fully
    for (let i = 0; i < 3; i++) {
      const sch = contract.schedules[i];
      const pRes = store.payInstallmentSchedule(contract.id, sch.id);
      assert.strictEqual(pRes.success, true);
    }

    // Simulate month 4 partial payment of 90,000 (10,000 carried over to month 5)
    const sch4 = contract.schedules[3];
    const p4Res = store.payInstallmentSchedule(contract.id, sch4.id, 90000);
    assert.strictEqual(p4Res.success, true);

    // Simulate paying months 5..12 fully (month 5 is 110,000)
    for (let i = 4; i < 12; i++) {
      const sch = contract.schedules[i];
      const pRes = store.payInstallmentSchedule(contract.id, sch.id);
      assert.strictEqual(pRes.success, true);
    }

    // Now check all paid schedules totals
    let totalPaidAmt = 0;
    let totalPaidPrinc = 0;
    let totalPaidInv = 0;
    let totalPaidComp = 0;

    for (const s of contract.schedules) {
      assert.strictEqual(s.status, 'PAID');
      totalPaidAmt += s.amountIQD;
      totalPaidPrinc += s.principalAmountIQD;
      totalPaidInv += s.investorProfitShareIQD;
      totalPaidComp += s.companyProfitShareIQD;
    }

    assert.strictEqual(totalPaidAmt, 1200000, 'Total paid must equal 1,200,000 IQD');
    assert.strictEqual(totalPaidPrinc, 1000000, 'Total principal must equal 1,000,000 IQD');
    assert.strictEqual(totalPaidInv, 100000, 'Total investor profit must equal 100,000 IQD');
    assert.strictEqual(totalPaidComp, 100000, 'Total company profit must equal 100,000 IQD (NOT 100,007!)');

    // Verify Wallets
    assert.strictEqual(store.companyWallet.balance, 100000, 'Company wallet must receive exactly 100,000 IQD');
    assert.strictEqual(invWallet.balance, 1100000, 'Investor wallet must receive exactly 1,100,000 IQD');
  });
});
