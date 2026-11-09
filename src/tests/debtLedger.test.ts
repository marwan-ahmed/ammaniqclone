import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateEntryRemaining,
  createEmptyDebtEntry,
  normalizeDebtEntry,
  calculateDebtorTotals,
  createDebtorAccount,
  parseDebtorAccountFromDbRow,
  serializeDebtorAccountForDb,
  filterAndSortDebtors,
  paginateItems,
  getVisibleEntries,
} from '../utils/debtLedger';

describe('Standalone Debt Ledger (دفتر الديون المستقل) Unit Tests', () => {
  it('calculateEntryRemaining computes (debtAmount - paidAmount) and clamps at 0', () => {
    assert.equal(calculateEntryRemaining(500000, 200000), 300000);
    assert.equal(calculateEntryRemaining(500000, 500000), 0);
    assert.equal(calculateEntryRemaining(500000, 600000), 0);
    assert.equal(calculateEntryRemaining(-100, 50), 0);
  });

  it('normalizeDebtEntry sanitizes fields and calculates remainingAmount automatically', () => {
    const entry = normalizeDebtEntry({
      id: 'row-1',
      debtAmount: 750000,
      debtDate: '2026-10-01',
      paidAmount: 250000,
      paidDate: '2026-10-15',
      notes: 'دفعة أولى نقداً',
    });

    assert.equal(entry.id, 'row-1');
    assert.equal(entry.debtAmount, 750000);
    assert.equal(entry.debtDate, '2026-10-01');
    assert.equal(entry.paidAmount, 250000);
    assert.equal(entry.paidDate, '2026-10-15');
    assert.equal(entry.remainingAmount, 500000);
    assert.equal(entry.notes, 'دفعة أولى نقداً');
  });

  it('createDebtorAccount supports multiple debtors (جميل، أوس، نهاد) and computes totals accurately', () => {
    const jameel = createDebtorAccount({
      debtorName: 'جميل',
      entries: [
        {
          debtAmount: 1000000,
          debtDate: '2026-10-01',
          paidAmount: 400000,
          paidDate: '2026-10-10',
          notes: 'دين خارجي 1',
        },
        {
          debtAmount: 500000,
          debtDate: '2026-10-12',
          paidAmount: 100000,
          paidDate: '2026-10-20',
          notes: 'دين خارجي 2',
        },
      ],
    });

    const aws = createDebtorAccount({
      debtorName: 'أوس',
      entries: [
        {
          debtAmount: 300000,
          debtDate: '2026-10-05',
          paidAmount: 300000,
          paidDate: '2026-10-25',
          notes: 'تم التسديد بالكامل',
        },
      ],
    });

    const nihad = createDebtorAccount({
      debtorName: 'نهاد',
      entries: [createEmptyDebtEntry('2026-10-29')],
    });

    assert.equal(jameel.debtorName, 'جميل');
    assert.equal(jameel.totalDebt, 1500000);
    assert.equal(jameel.totalPaid, 500000);
    assert.equal(jameel.totalRemaining, 1000000);
    assert.equal(jameel.entries[0].remainingAmount, 600000);
    assert.equal(jameel.entries[1].remainingAmount, 1000000);

    assert.equal(aws.debtorName, 'أوس');
    assert.equal(aws.totalRemaining, 0);

    assert.equal(nihad.debtorName, 'نهاد');
    assert.equal(nihad.entries.length, 1);
  });

  it('recalculates running remaining balance down on payment rows and up on new debt rows (Asaad scenario)', () => {
    const asaad = createDebtorAccount({
      debtorName: 'اسعد',
      entries: [
        { debtAmount: 500000, paidAmount: 0, debtDate: '2026-10-29' },
        { debtAmount: 0, paidAmount: 250000, debtDate: '2026-10-29', paidDate: '2026-10-29' },
        { debtAmount: 0, paidAmount: 50000, debtDate: '2026-10-29', paidDate: '2026-10-29' },
        { debtAmount: 0, paidAmount: 40000, debtDate: '2026-10-29', paidDate: '2026-10-31' },
        { debtAmount: 600000, paidAmount: 0, debtDate: '2026-10-29' },
      ],
    });

    assert.equal(asaad.entries[0].remainingAmount, 500000);
    assert.equal(asaad.entries[1].remainingAmount, 250000);
    assert.equal(asaad.entries[2].remainingAmount, 200000);
    assert.equal(asaad.entries[3].remainingAmount, 160000);
    assert.equal(asaad.entries[4].remainingAmount, 760000);
    assert.equal(asaad.totalDebt, 1100000);
    assert.equal(asaad.totalPaid, 340000);
    assert.equal(asaad.totalRemaining, 760000);
  });

  it('createDebtorAccount rejects empty debtor name', () => {
    assert.throws(() => {
      createDebtorAccount({ debtorName: '   ' });
    }, /اسم المدين مطلوب/);
  });

  it('serializeDebtorAccountForDb and parseDebtorAccountFromDbRow preserve all 6 columns in round-trip', () => {
    const original = createDebtorAccount({
      id: 'debtor-123',
      debtorName: 'جميل',
      entries: [
        {
          id: 'e-1',
          debtAmount: 1200000,
          debtDate: '2026-10-01',
          paidAmount: 500000,
          paidDate: '2026-10-15',
          notes: 'ملاحظة تجريبية',
        },
      ],
    });

    const dbPayload = serializeDebtorAccountForDb(original);
    const restored = parseDebtorAccountFromDbRow({
      id: 'debtor-123',
      borrowerName: dbPayload.borrowerName,
      totalAmountIQD: dbPayload.totalAmountIQD,
      downPaymentIQD: dbPayload.downPaymentIQD,
      notes: dbPayload.notes,
      createdAt: '2026-10-01',
    });

    assert.equal(restored.id, 'debtor-123');
    assert.equal(restored.debtorName, 'جميل');
    assert.equal(restored.totalDebt, 1200000);
    assert.equal(restored.totalPaid, 500000);
    assert.equal(restored.totalRemaining, 700000);
    assert.equal(restored.entries.length, 1);
    assert.equal(restored.entries[0].debtDate, '2026-10-01');
    assert.equal(restored.entries[0].paidDate, '2026-10-15');
    assert.equal(restored.entries[0].notes, 'ملاحظة تجريبية');
  });

  it('calculateDebtorTotals handles empty array safely', () => {
    const totals = calculateDebtorTotals([]);
    assert.deepEqual(totals, { totalDebt: 0, totalPaid: 0, totalRemaining: 0 });
  });

  it('UI components include 2-step add modal ("التالي") and exact 6 table columns', () => {
    const modalSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/views/AddDebtorModal.tsx'),
      'utf8'
    );
    const tableSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/views/DebtorTableSection.tsx'),
      'utf8'
    );
    const viewSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/views/DebtLedgerView.tsx'),
      'utf8'
    );

    assert.ok(modalSource.includes('التالي'), 'Add modal must include "التالي" button');
    assert.ok(modalSource.includes('اسم المدين'), 'Add modal must ask for debtor name');

    const requiredColumns = [
      'مبلغ الدين',
      'التاريخ',
      'المبلغ المسدد',
      'تاريخ التسديد',
      'المتبقي',
      'الملاحظات',
    ];

    for (const col of requiredColumns) {
      assert.ok(modalSource.includes(col), `AddDebtorModal missing column: ${col}`);
      assert.ok(tableSource.includes(col), `DebtorTableSection missing column: ${col}`);
    }

    assert.ok(viewSource.includes('إضافة'), 'DebtLedgerView must include "إضافة" button');
  });

  it('filterAndSortDebtors, paginateItems, and getVisibleEntries handle 100 debtors × 10 entries cleanly', () => {
    const accounts = Array.from({ length: 25 }, (_, i) =>
      createDebtorAccount({
        id: `d-${i + 1}`,
        debtorName: `مدين ${i + 1}`,
        entries: Array.from({ length: 10 }, (__, j) => ({
          id: `e-${i}-${j}`,
          debtAmount: 100000,
          paidAmount: i % 5 === 0 ? 100000 : j * 5000,
          debtDate: `2026-10-${String((j % 28) + 1).padStart(2, '0')}`,
          notes: j === 0 ? `ملاحظة خاصة ${i + 1}` : '',
        })),
      })
    );

    const activeOnly = filterAndSortDebtors(accounts, { statusFilter: 'ACTIVE' });
    const settledOnly = filterAndSortDebtors(accounts, { statusFilter: 'SETTLED' });
    assert.equal(settledOnly.length, 5);
    assert.equal(activeOnly.length, 20);

    const searchResult = filterAndSortDebtors(accounts, { searchTerm: 'ملاحظة خاصة 12' });
    assert.equal(searchResult.length, 1);
    assert.equal(searchResult[0].debtorName, 'مدين 12');

    const page1 = paginateItems(activeOnly, 1, 10);
    const page2 = paginateItems(activeOnly, 2, 10);
    assert.equal(page1.totalPages, 2);
    assert.equal(page1.pagedItems.length, 10);
    assert.equal(page2.pagedItems.length, 10);

    const sampleEntries = activeOnly[0].entries;
    const compact = getVisibleEntries(sampleEntries, false, 4);
    assert.equal(compact.visibleEntries.length, 4);
    assert.equal(compact.hiddenCount, 6);
    assert.equal(
      compact.visibleEntries[3].remainingAmount,
      sampleEntries[9].remainingAmount
    );

    const expanded = getVisibleEntries(sampleEntries, true, 4);
    assert.equal(expanded.visibleEntries.length, 10);
    assert.equal(expanded.hiddenCount, 0);
  });
});

