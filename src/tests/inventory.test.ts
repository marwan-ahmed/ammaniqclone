import assert from 'node:assert';
import { test, describe } from 'node:test';
import { formatIQD } from '../components/views/InventoryView';
import { SimulationStore } from '../services/simulation';

describe('Inventory & Dinar Separator Unit Tests', () => {
  test('formatIQD formats Iraqi Dinars with dot thousands separators correctly', () => {
    assert.strictEqual(formatIQD(1000000), '1.000.000');
    assert.strictEqual(formatIQD(1000), '1.000');
    assert.strictEqual(formatIQD(250000), '250.000');
    assert.strictEqual(formatIQD(0), '0');
    assert.strictEqual(formatIQD('5000000'), '5.000.000');
  });

  test('SimulationStore.purchaseInventory supports custom string categories and defaults targetSellingPriceIQD', () => {
    const store = new SimulationStore();
    
    // Deposit initial funds into company wallet
    store.companyWallet.balance = 10000000;

    const result = store.purchaseInventory({
      name: 'طن حديد تسليح 12 ملم',
      category: 'مواد إنشائية حديثة',
      investorId: store.companyWallet.id,
      quantity: 2,
      unitCostIQD: 1000000,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.item);
    assert.strictEqual(result.item.name, 'طن حديد تسليح 12 ملم');
    assert.strictEqual(result.item.category, 'مواد إنشائية حديثة');
    assert.strictEqual(result.item.quantity, 2);
    assert.strictEqual(result.item.unitCostIQD, 1000000);
    assert.strictEqual(result.item.totalCostIQD, 2000000);
    assert.strictEqual(result.item.targetSellingPriceIQD, 1000000); // defaults to unit cost
    assert.strictEqual(store.companyWallet.balance, 8000000);
  });

  test('formatIQD handles invalid inputs and floats gracefully', () => {
    assert.strictEqual(formatIQD('invalid'), '0');
    assert.strictEqual(formatIQD(1234.56), '1.235');
  });

  test('SimulationStore.updateInventory updates item and adjusts wallet balance correctly', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 10000000;

    const purchaseRes = store.purchaseInventory({
      name: 'مكيف سبليت 2 طن',
      category: 'أجهزة كهربائية',
      investorId: store.companyWallet.id,
      quantity: 1,
      unitCostIQD: 500000,
    });
    assert.strictEqual(purchaseRes.success, true);
    assert.strictEqual(store.companyWallet.balance, 9500000);

    const itemId = purchaseRes.item!.id;

    // Update quantity from 1 to 2 (costs +500,000 extra)
    const updateRes = store.updateInventory({
      id: itemId,
      name: 'مكيف سبليت 2 طن انفيرتر',
      category: 'أجهزة كهربائية موفرة',
      quantity: 2,
      unitCostIQD: 500000,
      targetSellingPriceIQD: 650000,
    });

    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.item!.name, 'مكيف سبليت 2 طن انفيرتر');
    assert.strictEqual(updateRes.item!.category, 'أجهزة كهربائية موفرة');
    assert.strictEqual(updateRes.item!.quantity, 2);
    assert.strictEqual(updateRes.item!.totalCostIQD, 1000000);
    assert.strictEqual(store.companyWallet.balance, 9000000); // 9.5M - 0.5M
  });

  test('SimulationStore.deleteInventory deletes in-stock item and refunds wallet', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 10000000;

    const purchaseRes = store.purchaseInventory({
      name: 'شاشة تلفزيون 65 بوصة',
      category: 'إلكترونيات',
      investorId: store.companyWallet.id,
      quantity: 1,
      unitCostIQD: 700000,
    });
    assert.strictEqual(purchaseRes.success, true);
    assert.strictEqual(store.companyWallet.balance, 9300000);

    const itemId = purchaseRes.item!.id;
    assert.ok(store.inventory.some((i) => i.id === itemId));

    // Delete item
    const deleteRes = store.deleteInventory(itemId);
    assert.strictEqual(deleteRes.success, true);
    assert.strictEqual(store.inventory.some((i) => i.id === itemId), false);
    assert.strictEqual(store.companyWallet.balance, 10000000); // Refunded back to 10M
  });

  test('SimulationStore.deleteInventory successfully unlinks and deletes item linked to a contract and refunds wallet', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 10000000;

    const purchaseRes = store.purchaseInventory({
      name: 'حاسبات لابتوب ديل',
      category: 'إلكترونيات',
      investorId: store.companyWallet.id,
      quantity: 1,
      unitCostIQD: 500000,
    });
    assert.strictEqual(purchaseRes.success, true);
    const item = purchaseRes.item!;

    // Create a contract referencing this item
    const contract = {
      id: 'contract-test-1',
      contractNumber: 'CNT-2026-001',
      borrowerId: 'b-1',
      borrowerName: 'مروان أحمد',
      investorId: store.companyWallet.id,
      investorName: 'صندوق الشركة الرئيسي',
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      itemCostPriceIQD: item.unitCostIQD,
      totalSalePriceIQD: 700000,
      profitMarginIQD: 200000,
      downPaymentIQD: 100000,
      financedAmountIQD: 600000,
      monthlyInstallmentIQD: 100000,
      monthsCount: 6,
      startDate: '2026-01-01',
      endDate: '2026-07-01',
      schedules: [],
      status: 'ACTIVE' as const,
    };
    store.contracts.push(contract);

    // Delete item
    const deleteRes = store.deleteInventory(item.id);
    assert.strictEqual(deleteRes.success, true);
    assert.ok(deleteRes.message.includes('إلغاء ارتباطها بالعقد') || deleteRes.message.includes('تم حذف المادة'));

    // Check item is removed from inventory
    assert.strictEqual(store.inventory.some((i) => i.id === item.id), false);
    // Check contract has unlinked inventoryItemId
    assert.strictEqual(contract.inventoryItemId, '');
    // Check wallet is refunded back to 10M
    assert.strictEqual(store.companyWallet.balance, 10000000);
  });

  test('SimulationStore.withdrawInvestorFunds processes cash withdrawal and deducts balance and liquidity', () => {
    const store = new SimulationStore();
    const investorId = 'inv-test-1';
    const walletId = 'wallet-inv-test-1';

    const investor = {
      id: investorId,
      name: 'مروان',
      phone: '07815262001',
      address: 'سامراء',
      walletId,
      contract: {
        id: 'cnt-inv-1',
        investorId,
        investorSharePercent: 50,
        companySharePercent: 50,
        lossSharingPolicy: 'SHARED' as const,
        contractDate: '2026-01-01',
      },
      totalCapitalDeposited: 3000000,
      activeInvestmentsAmount: 0,
      availableLiquidity: 2600000,
      totalProfitsEarned: 0,
      totalLossesIncurred: 0,
      createdAt: '2026-01-01',
    };

    const wallet = {
      id: walletId,
      ownerType: 'INVESTOR' as const,
      ownerId: investorId,
      ownerName: 'صندوق المستثمر مروان',
      balance: 2600000,
      totalAssetsValuation: 0,
      totalDebtsValuation: 0,
      currency: 'IQD' as const,
      updatedAt: '2026-01-01',
    };

    store.investors.push(investor);
    store.wallets.push(wallet);

    // 1. Successful Profit Withdrawal
    const withdrawRes = store.withdrawInvestorFunds({
      investorId,
      amountIQD: 600000,
      type: 'PROFIT_WITHDRAWAL',
      notes: 'سحب أرباح نقدية مستحقة',
      receiptNo: 'REC-001',
    });

    assert.strictEqual(withdrawRes.success, true);
    assert.strictEqual(wallet.balance, 2000000);
    assert.strictEqual(investor.availableLiquidity, 2000000);
    assert.strictEqual(investor.totalCapitalDeposited, 3000000); // Capital untouched on profit withdrawal
    assert.ok(store.transactions.some((t) => t.referenceNo === 'REC-001' && t.type === 'INVESTOR_WITHDRAWAL'));

    // 2. Successful Capital Withdrawal
    const capitalWithdrawRes = store.withdrawInvestorFunds({
      investorId,
      amountIQD: 500000,
      type: 'CAPITAL_WITHDRAWAL',
      notes: 'سحب جزئي من رأس المال',
    });

    assert.strictEqual(capitalWithdrawRes.success, true);
    assert.strictEqual(wallet.balance, 1500000);
    assert.strictEqual(investor.availableLiquidity, 1500000);
    assert.strictEqual(investor.totalCapitalDeposited, 2500000); // Capital reduced

    // 3. Excessive Withdrawal fails
    const failRes = store.withdrawInvestorFunds({
      investorId,
      amountIQD: 5000000,
    });
    assert.strictEqual(failRes.success, false);
    assert.ok(failRes.message.includes('غير كافية'));
  });

  test('Multi-quantity inventory item decrements quantity per contract, remains available until 0, and restores on contract delete', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 20000000;

    // 1. Add borrower
    const borrower = {
      id: 'bor-multi-test',
      name: 'علي كمال',
      phone: '07701122334',
      address: 'سامراء - القادسية',
      city: 'سامراء',
      guarantors: [],
      totalFinancedIQD: 0,
      totalRepaidIQD: 0,
      remainingDebtIQD: 0,
      status: 'ACTIVE' as const,
      createdAt: '2026-01-01'
    };
    store.borrowers.push(borrower);

    // 2. Purchase item with quantity = 3
    const purchaseRes = store.purchaseInventory({
      name: 'شاشة سامسونج 65 بوصة 4K',
      category: 'إلكترونيات',
      investorId: store.companyWallet.id,
      quantity: 3,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1400000
    });
    assert.strictEqual(purchaseRes.success, true);
    const item = purchaseRes.item!;
    assert.strictEqual(item.quantity, 3);
    assert.strictEqual(item.totalCostIQD, 3000000);
    assert.strictEqual(item.status, 'IN_STOCK');
    assert.strictEqual(store.companyWallet.totalAssetsValuation, 3000000);

    // 3. Create Contract 1 (selling 1 unit)
    const contractRes1 = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1400000,
      downPaymentIQD: 200000,
      monthsCount: 12
    });
    assert.strictEqual(contractRes1.success, true);
    assert.strictEqual(item.quantity, 2);
    assert.strictEqual(item.totalCostIQD, 2000000);
    assert.strictEqual(item.status, 'PARTIALLY_FINANCED');
    assert.strictEqual(store.companyWallet.totalAssetsValuation, 2000000);

    // 4. Create Contract 2 (selling 2nd unit)
    const contractRes2 = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1400000,
      downPaymentIQD: 0,
      monthsCount: 12
    });
    assert.strictEqual(contractRes2.success, true);
    assert.strictEqual(item.quantity, 1);
    assert.strictEqual(item.totalCostIQD, 1000000);
    assert.strictEqual(item.status, 'PARTIALLY_FINANCED');
    assert.strictEqual(store.companyWallet.totalAssetsValuation, 1000000);

    // 5. Create Contract 3 (selling 3rd and final unit)
    const contractRes3 = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1400000,
      downPaymentIQD: 0,
      monthsCount: 12
    });
    assert.strictEqual(contractRes3.success, true);
    assert.strictEqual(item.quantity, 0);
    assert.strictEqual(item.totalCostIQD, 0);
    assert.strictEqual(item.status, 'FULLY_FINANCED');
    assert.strictEqual(store.companyWallet.totalAssetsValuation, 0);

    // 6. Delete Contract 3 (restoring 1 unit back to inventory)
    const deleteContractRes = store.deleteContract(contractRes3.contract!.id);
    assert.strictEqual(deleteContractRes.success, true);
    assert.strictEqual(item.quantity, 1);
    assert.strictEqual(item.totalCostIQD, 1000000);
    assert.strictEqual(item.status, 'IN_STOCK');
    assert.strictEqual(store.companyWallet.totalAssetsValuation, 1000000);
  });

  test('Contract creation with custom quantity (> 1) deducts exact quantity and restores on deletion', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 10000000;

    // 1. Purchase 5 iPhones at 1,000,000 IQD each
    const purchase = store.purchaseInventory({
      investorId: 'COMPANY_MAIN',
      name: 'ايفون 16 برو',
      category: 'موبايلات',
      quantity: 5,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1300000
    });
    assert.strictEqual(purchase.success, true);
    const item = purchase.item!;
    assert.strictEqual(item.quantity, 5);
    assert.strictEqual(item.totalCostIQD, 5000000);

    const borrower = {
      id: 'bor-multi-qty-test',
      name: 'محمد حسن',
      phone: '07709988776',
      address: 'سامراء - حي المعلمين',
      city: 'سامراء',
      guarantors: [],
      totalFinancedIQD: 0,
      totalRepaidIQD: 0,
      remainingDebtIQD: 0,
      status: 'ACTIVE' as const,
      createdAt: '2026-01-01'
    };
    store.borrowers.push(borrower);

    // 2. Reject request if quantity requested exceeds stock
    const excessRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      quantity: 6,
      totalSalePriceIQD: 7800000,
      downPaymentIQD: 0,
      monthsCount: 12
    });
    assert.strictEqual(excessRes.success, false);
    assert.strictEqual(item.quantity, 5);

    // 3. Create contract for 3 units
    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      quantity: 3,
      totalSalePriceIQD: 3900000, // 3 * 1,300,000
      downPaymentIQD: 900000,
      monthsCount: 12
    });
    assert.strictEqual(contractRes.success, true);
    assert.strictEqual(contractRes.contract?.quantity, 3);
    assert.strictEqual(contractRes.contract?.itemCostPriceIQD, 3000000); // 3 * 1,000,000
    assert.strictEqual(item.quantity, 2); // 5 - 3 = 2
    assert.strictEqual(item.totalCostIQD, 2000000);
    assert.strictEqual(item.status, 'PARTIALLY_FINANCED');

    // 4. Delete contract and verify all 3 units are restored back to inventory
    const deleteRes = store.deleteContract(contractRes.contract!.id);
    assert.strictEqual(deleteRes.success, true);
    assert.strictEqual(item.quantity, 5); // 2 + 3 = 5
    assert.strictEqual(item.totalCostIQD, 5000000);
    assert.strictEqual(item.status, 'IN_STOCK');
  });

  test('Dashboard inventory calculations: count and valuation strictly match actual warehouse quantities and exclude fully financed items', () => {
    const store = new SimulationStore();
    store.companyWallet.balance = 20000000;

    // 1. Purchase an item "بضاعه10" with quantity 1 for 10,000,000 IQD
    const purchase = store.purchaseInventory({
      investorId: 'COMPANY_MAIN',
      name: 'بضاعه10',
      category: 'كرت',
      quantity: 1,
      unitCostIQD: 10000000,
      targetSellingPriceIQD: 12000000
    });
    assert.strictEqual(purchase.success, true);
    const item = purchase.item!;

    // Helper functions matching DashboardView calculations
    const computeInStockItems = (inv: typeof store.inventory) =>
      inv.filter((i) => i.status !== 'FULLY_FINANCED' && (i.quantity ?? 0) > 0);
    const computeTotalQty = (inv: typeof store.inventory) =>
      computeInStockItems(inv).reduce((acc, i) => acc + (i.quantity || 0), 0);
    const computeTotalValuation = (inv: typeof store.inventory) =>
      computeInStockItems(inv).reduce((acc, i) => acc + ((i.quantity || 0) * (i.unitCostIQD || 0)), 0);

    // Initial state: 1 item in stock, qty = 1, valuation = 10,000,000 IQD
    assert.strictEqual(computeInStockItems(store.inventory).length, 1);
    assert.strictEqual(computeTotalQty(store.inventory), 1);
    assert.strictEqual(computeTotalValuation(store.inventory), 10000000);

    // 2. Finance this item completely in an installment contract (user case: "بضاعه10" fully financed, qty = 0)
    const borrower = {
      id: 'bor-user-case-test',
      name: 'علي كريم',
      phone: '07701122334',
      address: 'سامراء',
      city: 'سامراء',
      guarantors: [],
      totalFinancedIQD: 0,
      totalRepaidIQD: 0,
      remainingDebtIQD: 0,
      status: 'ACTIVE' as const,
      createdAt: '2026-01-01'
    };
    store.borrowers.push(borrower);

    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      quantity: 1,
      totalSalePriceIQD: 12000000,
      downPaymentIQD: 0,
      monthsCount: 6
    });
    assert.strictEqual(contractRes.success, true);
    assert.strictEqual(item.quantity, 0);
    assert.strictEqual(item.status, 'FULLY_FINANCED');

    // VERIFICATION: Dashboard inventory count MUST equal 0 (actual warehouse quantity), NOT 1 (store.inventory.length)
    assert.strictEqual(computeTotalQty(store.inventory), 0, 'Dashboard inventory count must be 0 when item quantity in warehouse is 0');
    assert.strictEqual(computeTotalValuation(store.inventory), 0, 'Dashboard valuation must be 0 when in-stock quantity is 0');
    assert.strictEqual(computeInStockItems(store.inventory).length, 0);

    // 3. Purchase a multi-quantity item (5 units at 2,000,000 IQD each)
    const purchaseMulti = store.purchaseInventory({
      investorId: 'COMPANY_MAIN',
      name: 'تلفزيون 55 بوصة',
      category: 'شاشات',
      quantity: 5,
      unitCostIQD: 2000000,
      targetSellingPriceIQD: 2500000
    });
    assert.strictEqual(purchaseMulti.success, true);

    // Total in-stock qty must equal 5 (the physical units in warehouse), and valuation = 10,000,000 IQD
    assert.strictEqual(computeTotalQty(store.inventory), 5);
    assert.strictEqual(computeTotalValuation(store.inventory), 10000000);

    // 4. Finance 2 units from the multi-quantity item (3 units remaining in warehouse)
    const contractRes2 = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: purchaseMulti.item!.id,
      quantity: 2,
      totalSalePriceIQD: 5000000,
      downPaymentIQD: 0,
      monthsCount: 10
    });
    assert.strictEqual(contractRes2.success, true);

    // Warehouse must now reflect 3 units, valuation = 6,000,000 IQD
    assert.strictEqual(computeTotalQty(store.inventory), 3);
    assert.strictEqual(computeTotalValuation(store.inventory), 6000000);
  });
});
