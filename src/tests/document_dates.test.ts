import test from 'node:test';
import assert from 'node:assert';
import { SimulationStore } from '../services/simulation';

test('SimulationStore handles custom/historical document dates across operations', () => {
  const store = new SimulationStore();

  // 1. Historical Deposit Capital
  const depDate = '2025-01-10';
  const depRes = store.depositCapital({
    walletId: 'wallet-company',
    amountIQD: 50000000,
    notes: 'إيداع رأس مال تأسيسي قديم',
    date: depDate
  });
  assert.strictEqual(depRes.success, true);
  assert.strictEqual(depRes.transaction?.date, depDate);
  assert.strictEqual(store.transactions[0].date, depDate);

  // 2. Historical Company Withdrawal
  const compWthDate = '2025-01-15';
  const compWthRes = store.withdrawCompanyFunds({
    amountIQD: 1000000,
    recipientName: 'أحمد إياد',
    type: 'PROFIT_WITHDRAWAL',
    date: compWthDate,
    notes: 'سحب أرباح قديم'
  });
  assert.strictEqual(compWthRes.success, true);
  assert.strictEqual(compWthRes.transaction?.date, compWthDate);

  // 3. Historical Expense
  const expDate = '2025-01-20';
  const expRes = store.addExpense({
    title: 'إيجار مقر قديم',
    category: 'إيجارات',
    amountIQD: 500000,
    paidFromWalletId: 'wallet-company',
    date: expDate
  });
  assert.strictEqual(expRes.success, true);
  assert.strictEqual(store.expenses[0].date, expDate);
  const expTx = store.transactions.find((t) => t.description.includes('إيجار مقر قديم'));
  assert.strictEqual(expTx?.date, expDate);

  // 4. Historical Revenue
  const revDate = '2025-01-25';
  const revRes = store.addRevenue({
    title: 'رسوم تنظيم عقد سابقة',
    category: 'رسوم فتح ملف وتنظيم عقد',
    amountIQD: 50000,
    date: revDate
  });
  assert.strictEqual(revRes.success, true);
  assert.strictEqual(store.revenues[0].date, revDate);
  const revTx = store.transactions.find((t) => t.description.includes('رسوم تنظيم عقد سابقة'));
  assert.strictEqual(revTx?.date, revDate);

  // 5. Historical Inventory Purchase
  const purDate = '2025-02-01';
  const purRes = store.purchaseInventory({
    name: 'شاشة سامسونج 55 بوصة',
    category: 'أجهزة كهربائية',
    ownerId: 'wallet-company',
    quantity: 5,
    unitCostIQD: 400000,
    targetSellingPriceIQD: 600000,
    date: purDate
  });
  assert.strictEqual(purRes.success, true);
  assert.strictEqual(purRes.item?.purchaseDate, purDate);
  assert.strictEqual(purRes.transaction?.date, purDate);

  // 6. Historical Installment Contract Creation with StartDate
  const contractStartDate = '2025-02-15';
  // Add a borrower first
  const bRes = store.addBorrower({
    name: 'علي حسن السامرائي',
    phone: '07701112233',
    address: 'حي القاطول، سامراء',
    city: 'سامراء',
    guarantors: []
  });
  assert.strictEqual(bRes.success, true);

  const contractRes = store.createContract({
    borrowerId: bRes.borrower.id,
    inventoryItemId: purRes.item!.id,
    totalSalePriceIQD: 600000,
    downPaymentIQD: 100000,
    monthsCount: 5,
    startDate: contractStartDate
  });
  assert.strictEqual(contractRes.success, true);
  assert.strictEqual(contractRes.contract?.startDate, contractStartDate);
  // Schedules should start 1 month after contractStartDate
  const sch1 = contractRes.contract!.schedules[0];
  assert.ok(sch1.dueDate.startsWith('2025-03'), `Expected schedule 1 due date in March 2025, got ${sch1.dueDate}`);
  
  // Down payment tx should have contractStartDate
  const downPayTx = store.transactions.find((t) => t.description.includes('دفعة مقدمة'));
  assert.strictEqual(downPayTx?.date, contractStartDate);

  // 7. Historical Payment of Installment Schedule
  const payDate = '2025-03-12';
  const payRes = store.payInstallmentSchedule(
    contractRes.contract!.id,
    sch1.id,
    sch1.amountIQD,
    payDate
  );
  assert.strictEqual(payRes.success, true);
  assert.strictEqual(sch1.paidDate, payDate);
  const payTx = store.transactions.find((t) => t.id.includes(sch1.contractId) || (t.borrowerId === bRes.borrower.id && t.type === 'PAYMENT_RECEIVED'));
  assert.strictEqual(payTx?.date, payDate);
});
