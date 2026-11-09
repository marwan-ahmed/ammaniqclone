import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationStore } from '../services/simulation';

test('Borrower Deletion & Financial Reversal Engine', async (t) => {
  await t.test('Scenario: Canceling customer loan before payment returns goods to inventory & restores investor capital', () => {
    const store = new SimulationStore();

    // 1. Create investor "أحمد"
    const invRes = store.addInvestor({
      name: 'الممول أحمد',
      phone: '07701234567',
      capitalAmount: 50000000,
      investorSharePercent: 60,
      companySharePercent: 40
    });
    assert.equal(invRes.success, true);
    const investor = invRes.investor!;

    // 2. Purchase inventory item funded by investor أحمد (Cost: 10,000,000 IQD)
    const itemRes = store.purchaseInventory({
      name: 'أجهزة كهربائية ممولة',
      category: 'أجهزة',
      investorId: investor.id,
      quantity: 5,
      unitCostIQD: 10000000,
      targetSellingPriceIQD: 13000000
    });
    assert.equal(itemRes.success, true);
    const item = itemRes.item!;

    // 3. Register customer "مروان"
    const borRes = store.addBorrower({
      name: 'مروان الزبون',
      phone: '07801234567',
      address: 'سامراء - شارع القادسية',
      guarantors: []
    });
    assert.equal(borRes.success, true);
    const borrower = borRes.borrower!;

    // 4. Create contract: 1 item, Total: 13,000,000 IQD, Down payment: 0, 10 months
    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 13000000,
      downPaymentIQD: 0,
      monthsCount: 10,
      quantity: 1
    });
    assert.equal(contractRes.success, true);

    const investorWallet = store.wallets.find((w) => w.id === investor.walletId || w.ownerId === investor.id)!;
    assert.ok(investorWallet, 'Investor wallet must exist');

    // Verification before cancellation:
    assert.equal(item.quantity, 4, 'Inventory item quantity should be decremented to 4');
    const assetValBeforeDelete = investorWallet.totalAssetsValuation;
    const debtValBeforeDelete = investorWallet.totalDebtsValuation;
    assert.equal(debtValBeforeDelete, 13000000, 'Financed amount of 13M should be in debts valuation');

    // 5. Customer comes after hours and wants to cancel before any installment is paid:
    const deleteRes = store.deleteBorrower(borrower.id);
    assert.equal(deleteRes.success, true, 'Deletion must succeed');

    // Customer and contract removed from active store
    assert.equal(store.borrowers.some((b) => b.id === borrower.id), false, 'Borrower should be removed from active borrowers');
    assert.equal(store.contracts.some((c) => c.borrowerId === borrower.id), false, 'Contracts should be removed from active contracts');

    // Inventory restored
    assert.equal(item.quantity, 5, 'Inventory item quantity must be restored to 5');
    assert.equal(item.status, 'IN_STOCK', 'Item status must be IN_STOCK');
    assert.equal(item.totalCostIQD, 50000000, 'Total item cost must be restored to 5 * 10M');

    // Investor Wallet: Capital/Goods returned, Debts wiped (Zero profit counted)
    assert.equal(investorWallet.totalAssetsValuation, assetValBeforeDelete + 10000000, 'Assets valuation must regain 10M cost of goods');
    assert.equal(investorWallet.totalDebtsValuation, 0, 'Debts valuation must be cleared of the 13M loan');

    // Item exists in trash
    assert.equal(store.trashItems.some((t) => t.entityId === borrower.id && t.entityType === 'BORROWER'), true);
  });

  await t.test('Scenario: Contract with down payment refunds cash to customer on cancellation', () => {
    const store = new SimulationStore();

    const invRes = store.addInvestor({
      name: 'ممول نقدي',
      phone: '07709999999',
      capitalAmount: 20000000,
      investorSharePercent: 50,
      companySharePercent: 50
    });
    const investor = invRes.investor!;

    const itemRes = store.purchaseInventory({
      name: 'هواتف ذكية',
      category: 'هواتف',
      investorId: investor.id,
      quantity: 2,
      unitCostIQD: 5000000,
      targetSellingPriceIQD: 7000000
    });
    const item = itemRes.item!;

    const borRes = store.addBorrower({
      name: 'زبون بمقدمة',
      phone: '07809999999',
      address: 'سامراء',
      guarantors: []
    });
    const borrower = borRes.borrower!;

    // Create contract with 1,000,000 IQD down payment
    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 7000000,
      downPaymentIQD: 1000000,
      monthsCount: 6,
      quantity: 1
    });
    assert.equal(contractRes.success, true);

    const investorWallet = store.wallets.find((w) => w.id === investor.walletId || w.ownerId === investor.id)!;
    const balanceBeforeCancel = investorWallet.balance;

    // Delete borrower
    const deleteRes = store.deleteBorrower(borrower.id);
    assert.equal(deleteRes.success, true);

    // Cash balance should have refunded 1M down payment
    assert.equal(investorWallet.balance, balanceBeforeCancel - 1000000, 'Wallet balance should deduct refunded down payment');
    // Inventory restored
    assert.equal(item.quantity, 2);
  });

  await t.test('Safety Guard: Rejects deletion if an installment was already paid', () => {
    const store = new SimulationStore();

    const invRes = store.addInvestor({
      name: 'الممول سعد',
      phone: '07705555555',
      capitalAmount: 30000000,
      investorSharePercent: 60,
      companySharePercent: 40
    });
    const investor = invRes.investor!;

    const itemRes = store.purchaseInventory({
      name: 'أثاث منزلي',
      category: 'أثاث',
      investorId: investor.id,
      quantity: 1,
      unitCostIQD: 4000000,
      targetSellingPriceIQD: 6000000
    });
    const item = itemRes.item!;

    const borRes = store.addBorrower({
      name: 'زبون سدد قسطاً',
      phone: '07805555555',
      address: 'سامراء',
      guarantors: []
    });
    const borrower = borRes.borrower!;

    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 6000000,
      downPaymentIQD: 0,
      monthsCount: 6,
      quantity: 1
    });
    assert.equal(contractRes.success, true);
    const contract = contractRes.contract!;

    // Pay 1st installment
    const firstSchedule = contract.schedules[0];
    const payRes = store.payInstallmentSchedule(contract.id, firstSchedule.id);
    assert.equal(payRes.success, true);

    // Try to delete borrower now:
    const deleteRes = store.deleteBorrower(borrower.id);
    assert.equal(deleteRes.success, false, 'Deletion must be blocked when paid installments exist');
    assert.match(deleteRes.message, /مسددة/);

    // Borrower and contract must remain intact
    assert.equal(store.borrowers.some((b) => b.id === borrower.id), true);
    assert.equal(store.contracts.some((c) => c.id === contract.id), true);
  });

  await t.test('Recycle Bin: Restoring deleted borrower re-deducts inventory and re-applies contract debts', () => {
    const store = new SimulationStore();

    const invRes = store.addInvestor({
      name: 'ممول استعادة',
      phone: '07708888888',
      capitalAmount: 40000000,
      investorSharePercent: 60,
      companySharePercent: 40
    });
    const investor = invRes.investor!;

    const itemRes = store.purchaseInventory({
      name: 'شاشات ذكية',
      category: 'شاشات',
      investorId: investor.id,
      quantity: 3,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1500000
    });
    const item = itemRes.item!;

    const borRes = store.addBorrower({
      name: 'زبون الاستعادة',
      phone: '07808888888',
      address: 'سامراء',
      guarantors: []
    });
    const borrower = borRes.borrower!;

    store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1500000,
      downPaymentIQD: 0,
      monthsCount: 3,
      quantity: 1
    });

    assert.equal(item.quantity, 2);

    // Delete borrower
    const deleteRes = store.deleteBorrower(borrower.id);
    assert.equal(deleteRes.success, true);
    assert.equal(item.quantity, 3, 'Item restored to 3 on delete');

    // Find trash item
    const trashItem = store.trashItems.find(t => t.entityId === borrower.id && t.entityType === 'BORROWER')!;
    assert.ok(trashItem);

    // Restore from trash
    const restoreRes = store.restoreFromTrash(trashItem.id);
    assert.equal(restoreRes.success, true);

    // After restore, item quantity should be re-deducted to 2
    assert.equal(item.quantity, 2, 'Item quantity should be re-deducted to 2 upon restoring contract');
    assert.equal(store.borrowers.some(b => b.id === borrower.id), true);
    assert.equal(store.contracts.some(c => c.borrowerId === borrower.id), true);
  });

  await t.test('Scenario: Selling 5 items out of 10 and canceling contract restores all 10 items to inventory and zeroes active loans', () => {
    const store = new SimulationStore();

    // 1. Investor with 50M capital
    const invRes = store.addInvestor({
      name: 'الممول اياد',
      phone: '07701111111',
      capitalAmount: 50000000,
      investorSharePercent: 60,
      companySharePercent: 40
    });
    const investor = invRes.investor!;

    // 2. Buy 10 items in inventory (each 2M, total 20M)
    const itemRes = store.purchaseInventory({
      name: 'مولدات كهربائية',
      category: 'طاقة',
      investorId: investor.id,
      quantity: 10,
      unitCostIQD: 2000000,
      targetSellingPriceIQD: 2600000
    });
    assert.equal(itemRes.success, true);
    const item = itemRes.item!;
    assert.equal(item.quantity, 10, 'Initial inventory must be 10 pieces');
    assert.equal(item.totalCostIQD, 20000000, 'Initial total cost must be 20,000,000');

    // 3. Register customer
    const borRes = store.addBorrower({
      name: 'مروان أحمد',
      phone: '07802222222',
      address: 'سامراء - حي المعلمين',
      guarantors: []
    });
    const borrower = borRes.borrower!;

    // 4. Sell 5 pieces out of 10
    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      quantity: 5,
      totalSalePriceIQD: 13000000, // 5 * 2.6M
      downPaymentIQD: 0,
      monthsCount: 10
    });
    assert.equal(contractRes.success, true);

    // Verify state after selling 5 pieces:
    assert.equal(item.quantity, 5, 'Inventory quantity must now be 5');
    assert.equal(item.totalCostIQD, 10000000, 'Inventory valuation must now be 10,000,000');
    assert.equal(investor.activeInvestmentsAmount, 13000000, 'Active loans must reflect the financed contract amount of 13M');

    // 5. Delete customer (Cancellation before payment)
    const delRes = store.deleteBorrower(borrower.id);
    assert.equal(delRes.success, true);

    // Verify state after deletion:
    // ALL 5 pieces must be returned, restoring the full 10 pieces!
    assert.equal(item.quantity, 10, 'ALL 5 items must be restored to inventory, returning total quantity to 10');
    assert.equal(item.totalCostIQD, 20000000, 'Inventory valuation must be fully restored to 20,000,000');
    assert.equal(item.status, 'IN_STOCK');

    // Active loans must drop to 0
    assert.equal(investor.activeInvestmentsAmount, 0, 'Active loan debts for investor must be completely cleared to 0');
    assert.equal(store.contracts.filter(c => c.investorId === investor.id).length, 0, 'No active contracts remaining');
  });
});
