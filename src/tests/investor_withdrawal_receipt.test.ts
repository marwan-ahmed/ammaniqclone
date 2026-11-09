import test from 'node:test';
import assert from 'node:assert';
import { getNextInvestorWithdrawalReceiptNumber } from '@/utils/receiptNumbering';
import { SimulationStore } from '@/services/simulation';
import { tafqeetIQD } from '@/utils/tafqeet';
import { LedgerTransaction } from '@/types/finance';

test('Investor Cash Withdrawal Sequential Receipt Numbering (1, 2, 3, 4...)', async (t) => {
  await t.test('returns "1" when transactions list is empty or undefined', () => {
    assert.strictEqual(getNextInvestorWithdrawalReceiptNumber([]), '1');
    assert.strictEqual(getNextInvestorWithdrawalReceiptNumber(undefined), '1');
  });

  await t.test('returns "1" when existing transactions only have legacy non-numeric codes', () => {
    const legacyTxs: LedgerTransaction[] = [
      {
        id: 'tx-1',
        referenceNo: 'WTH-2026-651',
        date: '2026-11-01',
        type: 'INVESTOR_WITHDRAWAL',
        fromWalletId: 'w-1',
        fromWalletName: 'صندوق اياد',
        toWalletId: 'cash-out',
        toWalletName: 'المستثمر نقداً',
        amountIQD: 1000000,
        description: 'سحب نقدي قديم'
      },
      {
        id: 'tx-2',
        referenceNo: 'REC-LEGACY-99',
        date: '2026-11-02',
        type: 'INVESTOR_WITHDRAWAL',
        fromWalletId: 'w-1',
        fromWalletName: 'صندوق اياد',
        toWalletId: 'cash-out',
        toWalletName: 'المستثمر نقداً',
        amountIQD: 500000,
        description: 'سحب نقدي'
      }
    ];

    assert.strictEqual(getNextInvestorWithdrawalReceiptNumber(legacyTxs), '1');
  });

  await t.test('increments sequentially starting from 1: 1 -> 2 -> 3 -> 4', () => {
    const txs: LedgerTransaction[] = [
      {
        id: 'tx-1',
        referenceNo: '1',
        date: '2026-11-03',
        type: 'INVESTOR_WITHDRAWAL',
        fromWalletId: 'w-1',
        fromWalletName: 'صندوق اياد',
        toWalletId: 'cash-out',
        toWalletName: 'المستثمر نقداً',
        amountIQD: 500000,
        description: 'سحب نقدي'
      }
    ];

    assert.strictEqual(getNextInvestorWithdrawalReceiptNumber(txs), '2');

    txs.push({
      id: 'tx-2',
      referenceNo: '2',
      date: '2026-11-03',
      type: 'INVESTOR_WITHDRAWAL',
      fromWalletId: 'w-1',
      fromWalletName: 'صندوق اياد',
      toWalletId: 'cash-out',
      toWalletName: 'المستثمر نقداً',
      amountIQD: 250000,
      description: 'سحب أرباح'
    });

    assert.strictEqual(getNextInvestorWithdrawalReceiptNumber(txs), '3');

    txs.push({
      id: 'tx-3',
      referenceNo: '3',
      date: '2026-11-03',
      type: 'INVESTOR_WITHDRAWAL',
      fromWalletId: 'w-1',
      fromWalletName: 'صندوق اياد',
      toWalletId: 'cash-out',
      toWalletName: 'المستثمر نقداً',
      amountIQD: 100000,
      description: 'سحب نقدي'
    });

    assert.strictEqual(getNextInvestorWithdrawalReceiptNumber(txs), '4');
  });

  await t.test('handles non-sequential order and correctly finds the next maximum integer', () => {
    const scrambledTxs: LedgerTransaction[] = [
      {
        id: 'tx-b',
        referenceNo: '5',
        date: '2026-11-03',
        type: 'INVESTOR_WITHDRAWAL',
        fromWalletId: 'w-1',
        fromWalletName: 'صندوق',
        toWalletId: 'cash-out',
        toWalletName: 'المستثمر نقداً',
        amountIQD: 100000,
        description: 'سحب نقدي'
      },
      {
        id: 'tx-a',
        referenceNo: '2',
        date: '2026-11-02',
        type: 'INVESTOR_WITHDRAWAL',
        fromWalletId: 'w-1',
        fromWalletName: 'صندوق',
        toWalletId: 'cash-out',
        toWalletName: 'المستثمر نقداً',
        amountIQD: 100000,
        description: 'سحب نقدي'
      }
    ];

    assert.strictEqual(getNextInvestorWithdrawalReceiptNumber(scrambledTxs), '6');
  });
});

test('SimulationStore.withdrawInvestorFunds Lifecycle and Receipt Generation', async (t) => {
  await t.test('automatically assigns receipt "1" then "2" on successive withdrawals', () => {
    const store = new SimulationStore();
    const investorId = 'inv-test-seq';
    const walletId = 'wallet-test-seq';

    const testInvestor = {
      id: investorId,
      name: 'اياد',
      phone: '07700000000',
      address: 'سامراء',
      walletId,
      totalCapitalDeposited: 10000000,
      availableLiquidity: 10000000,
      totalProfitsEarned: 2000000,
      activeInvestmentsAmount: 0,
      totalLossesIncurred: 0,
      activeFundedContractsCount: 1,
      totalFundedContractsCount: 1,
      contract: {
        id: 'c-test-01',
        investorId,
        investorSharePercent: 50,
        companySharePercent: 50,
        lossSharingPolicy: 'SHARED' as const,
        contractDate: '2026-01-01'
      },
      createdAt: '2026-01-01'
    };

    const testWallet = {
      id: walletId,
      ownerId: investorId,
      ownerName: 'محفظة اياد',
      ownerType: 'INVESTOR' as const,
      balance: 10000000,
      totalCapitalDeposited: 10000000,
      totalProfitsEarned: 2000000,
      totalAssetsValuation: 0,
      totalDebtsValuation: 0,
      currency: 'IQD' as const,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    };

    store.investors.push(testInvestor);
    store.wallets.push(testWallet);

    // First withdrawal (without passing receiptNo -> defaults to "1")
    const res1 = store.withdrawInvestorFunds({
      investorId,
      amountIQD: 1000000,
      type: 'PROFIT_WITHDRAWAL',
      notes: 'توزيع أرباح الوجبة الأولى'
    });

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.transaction?.referenceNo, '1');
    assert.strictEqual(testWallet.balance, 9000000);

    // Second withdrawal (without passing receiptNo -> defaults to "2")
    const res2 = store.withdrawInvestorFunds({
      investorId,
      amountIQD: 500000,
      type: 'PROFIT_WITHDRAWAL',
      notes: 'توزيع أرباح الوجبة الثانية'
    });

    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.transaction?.referenceNo, '2');
    assert.strictEqual(testWallet.balance, 8500000);
  });

  await t.test('preserves Arabic tafqeet for A5 withdrawal voucher', () => {
    const text1 = tafqeetIQD(1000000);
    assert.ok(text1.includes('مليون دينار عراقي'));

    const text2 = tafqeetIQD(2500000);
    assert.ok(text2.includes('مليونان') || text2.includes('مليونين') || text2.includes('خمسمائة ألف'));
  });
});
