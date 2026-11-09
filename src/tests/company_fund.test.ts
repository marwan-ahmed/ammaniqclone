import assert from 'node:assert';
import { test, describe } from 'node:test';
import { SimulationStore } from '../services/simulation';

describe('Company Fund (صندوق الشركة) - Audit Fixes & Financial Flow Tests', () => {
  test('Point 1: Company-funded contract creates 100% company profit, credits down payment to company wallet, and successful installment repayment', () => {
    const store = new SimulationStore();

    // 1. Initial funding in company wallet
    store.companyWallet.balance = 10_000_000;
    store.companyWallet.totalDebtsValuation = 0;

    // 2. Add Borrower
    const borrowerRes = store.addBorrower({
      name: 'علي حسن السامرائي',
      phone: '07701234567',
      address: 'سامراء - حي الجبيرية',
      city: 'سامراء',
      guarantors: [
        {
          name: 'محمد كريم',
          phone: '07707654321',
          nationalId: 'IQ-99887766'
        }
      ]
    });
    assert.strictEqual(borrowerRes.success, true);
    const borrower = borrowerRes.borrower!;

    // 3. Purchase item financed 100% by Company Wallet
    const purchaseRes = store.purchaseInventory({
      name: 'مولدة كهربائية 50 كافيا',
      category: 'كهربائيات ومولدات',
      investorId: store.companyWallet.id,
      quantity: 1,
      unitCostIQD: 4_000_000
    });
    assert.strictEqual(purchaseRes.success, true);
    const item = purchaseRes.item!;
    assert.strictEqual(store.companyWallet.balance, 6_000_000); // 10M - 4M

    // 4. Create Contract for item using Company Wallet as financier
    // Cost: 4M, Down payment: 1M, Profit: 1M, Total sale: 5M, Financed debt: 4M over 4 months
    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 5_000_000,
      downPaymentIQD: 1_000_000,
      monthsCount: 4
    });

    assert.strictEqual(contractRes.success, true);
    const contract = contractRes.contract!;
    assert.ok(contract);

    // Verify down payment credited directly to company wallet
    assert.strictEqual(store.companyWallet.balance, 7_000_000); // 6M + 1M down payment
    assert.strictEqual(store.companyWallet.totalDebtsValuation, 4_000_000); // 5M - 1M = 4M

    // Verify profit distribution: 100% company, 0% outside investor
    assert.strictEqual(contract.schedules.length, 4);
    for (const sch of contract.schedules) {
      assert.strictEqual(sch.amountIQD, 1_000_000); // 4M / 4 = 1M/month
      assert.strictEqual(sch.investorProfitShareIQD, 0); // 0% to outside investor
      assert.strictEqual(sch.companyProfitShareIQD, 250_000); // 1M total profit / 4 months = 250,000 IQD/month
    }

    // 5. Pay first installment: 1,000,000 IQD
    const payRes = store.payInstallmentSchedule(contract.id, contract.schedules[0].id);
    assert.strictEqual(payRes.success, true);
    assert.ok(payRes.message.includes('صندوق نظام أمان'));

    // Company wallet should receive the entire 1,000,000 IQD (750k principal + 250k profit)
    assert.strictEqual(store.companyWallet.balance, 8_000_000); // 7M + 1M
    // Total debts valuation should decrease by principal (750,000)
    assert.strictEqual(store.companyWallet.totalDebtsValuation, 3_250_000); // 4M - 750k

    // Verify transaction record
    const latestTx = store.transactions[0];
    assert.strictEqual(latestTx.type, 'PAYMENT_RECEIVED');
    assert.strictEqual(latestTx.toWalletId, store.companyWallet.id);
    assert.strictEqual(latestTx.amountIQD, 1_000_000);
    assert.strictEqual(latestTx.companyProfitShareIQD, 250_000);
    assert.strictEqual(latestTx.investorProfitShareIQD, 0);
  });

  test('Point 2: Revenue lifecycle (addition, deletion, and trash restoration) correctly adjusts company wallet balance', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 5_000_000;

    // 1. Add revenue
    const addRes = store.addRevenue({
      title: 'رسوم كشف واستعلام ميداني',
      category: 'رسوم كشف واستعلام',
      amountIQD: 150_000,
      notes: 'كشف موقع لزبون'
    });
    assert.strictEqual(addRes.success, true);
    const revenue = addRes.revenue!;
    assert.strictEqual(revenue.receivedToWalletId, store.companyWallet.id);
    assert.strictEqual(store.companyWallet.balance, 5_150_000);

    // 2. Delete revenue: should deduct 150,000 from company wallet and move to trash
    const delRes = store.deleteRevenue(revenue.id);
    assert.strictEqual(delRes.success, true);
    assert.strictEqual(store.companyWallet.balance, 5_000_000);
    assert.strictEqual(store.revenues.length, 0);
    assert.strictEqual(store.trashItems.length, 1);
    assert.strictEqual(store.trashItems[0].entityType, 'REVENUE');

    // 3. Restore revenue from trash: should re-credit company wallet with 150,000
    const restoreRes = store.restoreFromTrash(store.trashItems[0].id);
    assert.strictEqual(restoreRes.success, true);
    assert.strictEqual(store.companyWallet.balance, 5_150_000);
    assert.strictEqual(store.revenues.length, 1);
  });

  test('Point 3: Direct debt installment repayment correctly credits company wallet and records transaction', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 2_000_000;

    // 1. Add Direct Debt (defaulted or direct to company)
    const directRes = store.addDirectDebt({
      borrowerName: 'عمر طارق الجبوري',
      borrowerPhone: '07709876543',
      investorId: 'COMPANY_MAIN',
      itemName: 'مستلزمات صيانة منزلية',
      totalAmountIQD: 600_000,
      downPaymentIQD: 100_000,
      monthsCount: 2
    });

    assert.strictEqual(directRes.success, true);
    const directDebt = directRes.contract!;
    assert.strictEqual(directDebt.schedules.length, 2);
    assert.strictEqual(directDebt.schedules[0].amountIQD, 250_000); // (600k - 100k) / 2 = 250k

    // 2. Pay first direct debt schedule (250,000 IQD)
    const payRes = store.payDirectDebtSchedule(directDebt.id, directDebt.schedules[0].id);
    assert.strictEqual(payRes.success, true);
    assert.strictEqual(directDebt.schedules[0].status, 'PAID');

    // Company wallet should be credited with 250,000 IQD
    assert.strictEqual(store.companyWallet.balance, 2_250_000); // 2M + 250k

    // Verify Ledger Transaction
    const latestTx = store.transactions[0];
    assert.strictEqual(latestTx.type, 'PAYMENT_RECEIVED');
    assert.strictEqual(latestTx.toWalletId, store.companyWallet.id);
    assert.strictEqual(latestTx.amountIQD, 250_000);

    // 3. Pay second (final) direct debt schedule: should complete the debt
    const payRes2 = store.payDirectDebtSchedule(directDebt.id, directDebt.schedules[1].id);
    assert.strictEqual(payRes2.success, true);
    assert.strictEqual(directDebt.status, 'COMPLETED');
    assert.strictEqual(store.companyWallet.balance, 2_500_000); // 2.25M + 250k
  });

  test('Point 4: Company fund cash withdrawal processes deduction, validates limits, and records ledger voucher', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 5_000_000;
    const w = store.wallets.find(wal => wal.id === store.companyWallet.id || wal.ownerType === 'COMPANY');
    if (w) w.balance = 5_000_000;

    // 1. Rejects invalid or negative amounts
    const failZero = store.withdrawCompanyFunds({ amountIQD: 0 });
    assert.strictEqual(failZero.success, false);
    assert.strictEqual(store.companyWallet.balance, 5_000_000);

    const failNeg = store.withdrawCompanyFunds({ amountIQD: -500_000 });
    assert.strictEqual(failNeg.success, false);

    // 2. Rejects amount exceeding available company liquidity
    const failExcess = store.withdrawCompanyFunds({ amountIQD: 6_000_000 });
    assert.strictEqual(failExcess.success, false);
    assert.ok(failExcess.message.includes('غير كافية'));
    assert.strictEqual(store.companyWallet.balance, 5_000_000);

    // 3. Successful cash withdrawal with custom recipient and notes
    const successRes = store.withdrawCompanyFunds({
      amountIQD: 1_500_000,
      recipientName: 'أحمد إياد (المدير العام)',
      type: 'PROFIT_WITHDRAWAL',
      notes: 'سحب أرباح نصف سنوية لمجلس الإدارة',
      receiptNo: 'WTH-COMP-2026-001'
    });

    assert.strictEqual(successRes.success, true);
    assert.strictEqual(store.companyWallet.balance, 3_500_000); // 5M - 1.5M
    const syncedWallet = store.wallets.find(wal => wal.id === store.companyWallet.id || wal.ownerType === 'COMPANY');
    assert.strictEqual(syncedWallet?.balance, 3_500_000);

    // 4. Verify Ledger Transaction
    const latestTx = store.transactions[0];
    assert.strictEqual(latestTx.type, 'WITHDRAWAL');
    assert.strictEqual(latestTx.referenceNo, 'WTH-COMP-2026-001');
    assert.strictEqual(latestTx.amountIQD, 1_500_000);
    assert.strictEqual(latestTx.fromWalletId, store.companyWallet.id);
    assert.ok(latestTx.toWalletName.includes('أحمد إياد'));
    assert.ok(latestTx.description.includes('سحب أرباح شركة'));
  });
});

