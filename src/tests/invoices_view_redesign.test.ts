import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPersistedInvoicesViewMode,
  persistInvoicesViewMode,
  INVOICES_VIEW_MODE_KEY,
  calculateInstallmentDueStatus,
  isContractCompleted
} from '../utils/installmentDates';
import {
  getInvoiceNumber,
  getContractNumber,
  getReceiptNumber
} from '../components/common/ContractDocumentHubModal';

test('Invoices View Redesign - View Modes, Sorting, Status Filtering & KPI Calculations', async (t) => {
  await t.test('isContractCompleted logic: detects completed contracts even if DB status is ACTIVE', () => {
    // 1. Explicitly COMPLETED
    assert.strictEqual(
      isContractCompleted({
        status: 'COMPLETED',
        totalSalePriceIQD: 10000000,
        schedules: [{ status: 'PAID', amountIQD: 10000000 }]
      }),
      true
    );

    // 2. User exact scenario (CNT-2026-544): status was 'ACTIVE' in DB, but all 10 of 10 schedules are PAID
    const userContract544 = {
      id: 'cnt-544',
      contractNumber: 'CNT-2026-544',
      status: 'ACTIVE', // still active in DB
      totalSalePriceIQD: 10000000,
      downPaymentIQD: 0,
      schedules: Array.from({ length: 10 }, (_, i) => ({
        installmentNumber: i + 1,
        status: 'PAID',
        amountIQD: 1000000
      }))
    };
    assert.strictEqual(isContractCompleted(userContract544), true, 'Must identify 10/10 paid contract as completed');

    // 3. Contract paid via full down payment (or down payment + paid schedules = total sale)
    const fullyPaidViaDownPayment = {
      status: 'ACTIVE',
      totalSalePriceIQD: 5000000,
      downPaymentIQD: 5000000,
      schedules: []
    };
    assert.strictEqual(isContractCompleted(fullyPaidViaDownPayment), true);

    // 4. Truly ACTIVE contract with unpaid schedules
    const activeContract = {
      status: 'ACTIVE',
      totalSalePriceIQD: 10000000,
      downPaymentIQD: 0,
      schedules: [
        { status: 'PAID', amountIQD: 1000000 },
        { status: 'PENDING', amountIQD: 1000000 }
      ]
    };
    assert.strictEqual(isContractCompleted(activeContract), false);
  });
  await t.test('View Mode Persistence (Cards vs Accounting Table)', (sub) => {
    // SSR / No window environment fallback
    assert.strictEqual(getPersistedInvoicesViewMode(), 'cards');

    // Mock localStorage
    const mockStorage: Record<string, string> = {};
    const originalWindow = globalThis.window;

    try {
      (globalThis as any).window = {
        localStorage: {
          getItem: (key: string) => mockStorage[key] || null,
          setItem: (key: string, val: string) => {
            mockStorage[key] = val;
          }
        }
      };

      // Default before save
      assert.strictEqual(getPersistedInvoicesViewMode(), 'cards');

      // Persist table mode
      persistInvoicesViewMode('table');
      assert.strictEqual(mockStorage[INVOICES_VIEW_MODE_KEY], 'table');
      assert.strictEqual(getPersistedInvoicesViewMode(), 'table');

      // Persist cards mode
      persistInvoicesViewMode('cards');
      assert.strictEqual(mockStorage[INVOICES_VIEW_MODE_KEY], 'cards');
      assert.strictEqual(getPersistedInvoicesViewMode(), 'cards');

      // Invalid stored value falls back to 'cards'
      mockStorage[INVOICES_VIEW_MODE_KEY] = 'invalid_mode';
      assert.strictEqual(getPersistedInvoicesViewMode(), 'cards');
    } finally {
      if (originalWindow !== undefined) {
        (globalThis as any).window = originalWindow;
      } else {
        delete (globalThis as any).window;
      }
    }
  });

  await t.test('Contract Status Filtering (ALL, ACTIVE, COMPLETED, OVERDUE)', () => {
    const contracts: any[] = [
      {
        id: 'c1',
        contractNumber: 'CNT-2026-101',
        status: 'ACTIVE',
        schedules: [
          { status: 'PAID', dueDate: '2026-01-01', amountIQD: 100000 },
          { status: 'PENDING', dueDate: '2026-12-01', amountIQD: 100000 } // Future
        ]
      },
      {
        id: 'c2',
        contractNumber: 'CNT-2026-102',
        status: 'COMPLETED',
        schedules: [
          { status: 'PAID', dueDate: '2026-01-01', amountIQD: 500000 }
        ]
      },
      {
        id: 'c3',
        contractNumber: 'CNT-2026-103',
        status: 'ACTIVE',
        schedules: [
          { status: 'PENDING', dueDate: '2020-01-01', amountIQD: 200000 } // Overdue!
        ]
      },
      {
        id: 'c4',
        contractNumber: 'CNT-2026-544',
        status: 'ACTIVE', // DB status was ACTIVE, but all schedules are PAID (User case)
        totalSalePriceIQD: 10000000,
        schedules: [
          { status: 'PAID', dueDate: '2026-01-01', amountIQD: 5000000 },
          { status: 'PAID', dueDate: '2026-02-01', amountIQD: 5000000 }
        ]
      }
    ];

    const filterContracts = (statusFilter: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE') => {
      return contracts.filter((c) => {
        const isCompleted = isContractCompleted(c);
        if (statusFilter === 'ACTIVE') return !isCompleted;
        if (statusFilter === 'COMPLETED') return isCompleted;
        if (statusFilter === 'OVERDUE') {
          return (
            !isCompleted &&
            c.schedules.some(
              (s: any) => s.status === 'PENDING' && calculateInstallmentDueStatus(s.dueDate, false).status === 'OVERDUE'
            )
          );
        }
        return true;
      });
    };

    assert.strictEqual(filterContracts('ALL').length, 4);
    assert.strictEqual(filterContracts('ACTIVE').length, 2); // c1, c3
    assert.strictEqual(filterContracts('COMPLETED').length, 2); // c2 AND c4!
    assert.strictEqual(filterContracts('COMPLETED').some((c) => c.id === 'c4'), true, 'c4 (CNT-2026-544) must appear in completed filter');
    assert.strictEqual(filterContracts('OVERDUE').length, 1);
    assert.strictEqual(filterContracts('OVERDUE')[0].id, 'c3');
  });

  await t.test('Contract Sorting Logic (LATEST, DUE_DATE, REMAINING_HIGH, TOTAL_HIGH)', () => {
    const contracts: any[] = [
      {
        id: 'c1',
        contractNumber: 'CNT-2026-101',
        startDate: '2026-01-01',
        totalSalePriceIQD: 2000000,
        downPaymentIQD: 500000,
        schedules: [
          { status: 'PENDING', dueDate: '2026-11-20', amountIQD: 500000 }
        ]
      },
      {
        id: 'c2',
        contractNumber: 'CNT-2026-102',
        startDate: '2026-05-01',
        totalSalePriceIQD: 5000000,
        downPaymentIQD: 0,
        schedules: [
          { status: 'PENDING', dueDate: '2026-11-10', amountIQD: 1000000 } // Earlier due
        ]
      },
      {
        id: 'c3',
        contractNumber: 'CNT-2026-103',
        startDate: '2026-03-01',
        totalSalePriceIQD: 1000000,
        downPaymentIQD: 1000000,
        schedules: []
      }
    ];

    // 1. Sort by LATEST (startDate descending)
    const sortedLatest = [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate));
    assert.strictEqual(sortedLatest[0].id, 'c2'); // 2026-05-01
    assert.strictEqual(sortedLatest[1].id, 'c3'); // 2026-03-01
    assert.strictEqual(sortedLatest[2].id, 'c1'); // 2026-01-01

    // 2. Sort by DUE_DATE (earliest pending schedule first)
    const sortedDueDate = [...contracts].sort((a, b) => {
      const nextA = a.schedules.find((s: any) => s.status === 'PENDING')?.dueDate || '9999-99-99';
      const nextB = b.schedules.find((s: any) => s.status === 'PENDING')?.dueDate || '9999-99-99';
      return nextA.localeCompare(nextB);
    });
    assert.strictEqual(sortedDueDate[0].id, 'c2'); // 2026-11-10
    assert.strictEqual(sortedDueDate[1].id, 'c1'); // 2026-11-20
    assert.strictEqual(sortedDueDate[2].id, 'c3'); // No pending

    // 3. Sort by REMAINING_HIGH
    const sortedRemaining = [...contracts].sort((a, b) => {
      const paidA = a.schedules.filter((s: any) => s.status === 'PAID').reduce((sum: number, s: any) => sum + s.amountIQD, 0) + a.downPaymentIQD;
      const remA = a.totalSalePriceIQD - paidA;
      const paidB = b.schedules.filter((s: any) => s.status === 'PAID').reduce((sum: number, s: any) => sum + s.amountIQD, 0) + b.downPaymentIQD;
      const remB = b.totalSalePriceIQD - paidB;
      return remB - remA;
    });
    assert.strictEqual(sortedRemaining[0].id, 'c2'); // 5,000,000 remaining
    assert.strictEqual(sortedRemaining[1].id, 'c1'); // 1,500,000 remaining
    assert.strictEqual(sortedRemaining[2].id, 'c3'); // 0 remaining

    // 4. Sort by TOTAL_HIGH
    const sortedTotal = [...contracts].sort((a, b) => b.totalSalePriceIQD - a.totalSalePriceIQD);
    assert.strictEqual(sortedTotal[0].id, 'c2'); // 5,000,000
    assert.strictEqual(sortedTotal[1].id, 'c1'); // 2,000,000
    assert.strictEqual(sortedTotal[2].id, 'c3'); // 1,000,000
  });

  await t.test('KPI Computations with Active, Settled, Overdue & Collection Ratio', () => {
    const contracts: any[] = [
      {
        id: 'c1',
        totalSalePriceIQD: 10000000,
        downPaymentIQD: 2000000,
        status: 'ACTIVE',
        schedules: [
          { status: 'PAID', amountIQD: 1000000, dueDate: '2026-01-01' },
          { status: 'PENDING', amountIQD: 1000000, dueDate: '2020-01-01' } // overdue
        ]
      },
      {
        id: 'c2',
        totalSalePriceIQD: 5000000,
        downPaymentIQD: 1000000,
        status: 'COMPLETED',
        schedules: [
          { status: 'PAID', amountIQD: 4000000, dueDate: '2026-02-01' }
        ]
      }
    ];

    const totalContractsCount = contracts.length;
    const completedContractsCount = contracts.filter(isContractCompleted).length;
    const activeContractsCount = contracts.filter((c) => !isContractCompleted(c)).length;
    const overdueContractsCount = contracts.filter((c) =>
      !isContractCompleted(c) &&
      c.schedules.some((s: any) => s.status === 'PENDING' && calculateInstallmentDueStatus(s.dueDate, false).status === 'OVERDUE')
    ).length;

    const totalFinancedValuationAll = contracts.reduce((sum, c) => sum + c.totalSalePriceIQD, 0);

    const totalRepaidAll = contracts.reduce((sum, c) => {
      const paidSum = c.schedules
        .filter((s: any) => s.status === 'PAID')
        .reduce((sSum: number, s: any) => sSum + s.amountIQD, 0);
      return sum + c.downPaymentIQD + paidSum;
    }, 0);

    const totalRemainingDebtAll = totalFinancedValuationAll - totalRepaidAll;
    const overallCollectionPercent =
      totalFinancedValuationAll > 0
        ? Number(((totalRepaidAll / totalFinancedValuationAll) * 100).toFixed(1))
        : 0;

    assert.strictEqual(totalContractsCount, 2);
    assert.strictEqual(activeContractsCount, 1);
    assert.strictEqual(completedContractsCount, 1);
    assert.strictEqual(overdueContractsCount, 1);

    assert.strictEqual(totalFinancedValuationAll, 15000000);
    // Repaid: c1 (2,000,000 DP + 1,000,000 PAID) + c2 (1,000,000 DP + 4,000,000 PAID) = 3,000,000 + 5,000,000 = 8,000,000
    assert.strictEqual(totalRepaidAll, 8000000);
    // Remaining debt: 15,000,000 - 8,000,000 = 7,000,000
    assert.strictEqual(totalRemainingDebtAll, 7000000);
    // Collection %: 8,000,000 / 15,000,000 * 100 = 53.3%
    assert.strictEqual(overallCollectionPercent, 53.3);
  });

  await t.test('Clean Sequential Numbering Engine (Contracts, Invoices & Receipts without English prefixes)', async (sub) => {
    // 1. getContractNumber tests
    assert.strictEqual(getContractNumber({ contractNumber: '1' } as any), '1');
    assert.strictEqual(getContractNumber({ contractNumber: '2' } as any), '2');
    assert.strictEqual(getContractNumber({ contractNumber: '123' } as any), '123');
    // Legacy support: extracts trailing digits without CNT- prefix
    assert.strictEqual(getContractNumber({ contractNumber: 'CNT-2026-544' } as any), '544');
    assert.strictEqual(getContractNumber({ contractNumber: 'CNT-2026-1' } as any), '1');
    assert.strictEqual(getContractNumber({} as any), '1');

    // 2. getInvoiceNumber aligns with clean contract numbers
    assert.strictEqual(getInvoiceNumber({ contractNumber: '1' } as any), '1');
    assert.strictEqual(getInvoiceNumber({ contractNumber: '123' } as any), '123');
    assert.strictEqual(getInvoiceNumber({ contractNumber: '3', invoiceNumber: 3 } as any), '3');
    assert.strictEqual(getInvoiceNumber({ contractNumber: 'CNT-2026-544' } as any), '544');

    // 3. getReceiptNumber starts sequentially from 1 (not 1001)
    const mockStore: any = {
      contracts: [
        {
          id: 'c1',
          schedules: [
            { id: 's1', status: 'PAID', paidDate: '2026-01-01', installmentNumber: 1 },
            { id: 's2', status: 'PAID', paidDate: '2026-02-01', installmentNumber: 2 }
          ]
        },
        {
          id: 'c2',
          schedules: [
            { id: 's3', status: 'PAID', paidDate: '2026-03-01', installmentNumber: 1 }
          ]
        }
      ],
      directDebts: []
    };

    assert.strictEqual(getReceiptNumber(mockStore.contracts[0].schedules[0], mockStore.contracts[0], mockStore), '1');
    assert.strictEqual(getReceiptNumber(mockStore.contracts[0].schedules[1], mockStore.contracts[0], mockStore), '2');
    assert.strictEqual(getReceiptNumber(mockStore.contracts[1].schedules[0], mockStore.contracts[1], mockStore), '3');

    // Explicit numeric receiptNumber
    assert.strictEqual(getReceiptNumber({ id: 's-explicit', status: 'PAID', receiptNumber: 123 } as any), '123');

    // 4. Searching contracts by clean numbers (e.g. "123", "3", "544")
    const sampleContracts: any[] = [
      { id: 'c1', contractNumber: '1', borrowerName: 'علي' },
      { id: 'c2', contractNumber: '2', borrowerName: 'محمد' },
      { id: 'c3', contractNumber: '123', borrowerName: 'أحمد' },
      { id: 'c4', contractNumber: 'CNT-2026-544', borrowerName: 'حسين' }
    ];

    const matchClean123 = sampleContracts.filter((c) =>
      c.contractNumber.toLowerCase().includes('123') ||
      getContractNumber(c).includes('123')
    );
    assert.strictEqual(matchClean123.length, 1);
    assert.strictEqual(matchClean123[0].id, 'c3');

    const matchClean544 = sampleContracts.filter((c) =>
      c.contractNumber.toLowerCase().includes('544') ||
      getContractNumber(c).includes('544')
    );
    assert.strictEqual(matchClean544.length, 1);
    assert.strictEqual(matchClean544[0].id, 'c4');
  });

  await t.test('Manual Numbering Reset Button (Explicit Admin Reset vs Automatic Turnover)', () => {
    // 1. Without clicking reset button: numbering continues sequentially without automatic calendar turnover
    const existingPortfolio = [
      { id: 'c1', contractNumber: '1', createdAt: '2026-01-10T10:00:00.000Z', startDate: '2026-01-10' },
      { id: 'c2', contractNumber: '2', createdAt: '2026-06-15T12:00:00.000Z', startDate: '2026-06-15' },
      { id: 'c3', contractNumber: '3', createdAt: '2026-11-05T09:00:00.000Z', startDate: '2026-11-05' },
    ];

    function calculateNextContractNumber(
      contracts: any[],
      resetEpoch: string | null,
      contractCreatedAt: string
    ): string {
      const epochTime = resetEpoch && !isNaN(Date.parse(resetEpoch))
        ? new Date(resetEpoch).getTime()
        : 0;

      let maxNum = 0;
      for (const c of contracts) {
        const cTime = c.createdAt ? new Date(c.createdAt).getTime() : new Date(c.startDate).getTime();
        if (cTime >= epochTime) {
          const n = parseInt(getContractNumber(c), 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
      return String(maxNum + 1);
    }

    // A contract created in 2027 WITHOUT a manual reset continues from 4!
    assert.strictEqual(
      calculateNextContractNumber(existingPortfolio, null, '2027-01-01T10:00:00.000Z'),
      '4',
      'Should NOT reset automatically without manual admin button click'
    );

    // 2. Admin explicitly clicks "تصفير دورة الترقيم" at 2026-11-05T12:00:00.000Z
    const resetEpoch = '2026-11-05T12:00:00.000Z';

    // First contract created after reset epoch MUST reset to '1'!
    assert.strictEqual(
      calculateNextContractNumber(existingPortfolio, resetEpoch, '2026-11-05T12:30:00.000Z'),
      '1',
      'First contract created after manual reset must start at 1'
    );

    // Add contract #1 to portfolio
    const portfolioAfterFirstNewContract = [
      ...existingPortfolio,
      { id: 'c4-new', contractNumber: '1', createdAt: '2026-11-05T12:30:00.000Z', startDate: '2026-11-05' }
    ];

    // Second contract created after reset epoch MUST be '2'!
    assert.strictEqual(
      calculateNextContractNumber(portfolioAfterFirstNewContract, resetEpoch, '2026-11-05T13:00:00.000Z'),
      '2',
      'Second contract in new cycle must be 2'
    );

    // 3. Verify past records preservation
    assert.strictEqual(getContractNumber(portfolioAfterFirstNewContract[0]), '1');
    assert.strictEqual(getContractNumber(portfolioAfterFirstNewContract[1]), '2');
    assert.strictEqual(getContractNumber(portfolioAfterFirstNewContract[2]), '3');
    assert.strictEqual(getContractNumber(portfolioAfterFirstNewContract[3]), '1'); // new cycle #1
    assert.strictEqual(portfolioAfterFirstNewContract.length, 4, 'All historical contracts must be preserved');

    // 4. Receipts reset behavior with manual numberingResetEpoch
    const storeWithManualReset: any = {
      numberingResetEpoch: resetEpoch,
      contracts: [
        {
          id: 'c1',
          schedules: [
            // Paid before manual reset:
            { id: 'sch-pre-1', status: 'PAID', paidDate: '2026-05-01T10:00:00.000Z', installmentNumber: 1 },
            { id: 'sch-pre-2', status: 'PAID', paidDate: '2026-06-01T10:00:00.000Z', installmentNumber: 2 },
            // Paid after manual reset:
            { id: 'sch-post-1', status: 'PAID', paidDate: '2026-11-05T13:00:00.000Z', installmentNumber: 3 },
            { id: 'sch-post-2', status: 'PAID', paidDate: '2026-11-05T14:00:00.000Z', installmentNumber: 4 },
          ]
        }
      ],
      directDebts: []
    };

    // Receipts paid after the manual reset start from 1, 2!
    assert.strictEqual(
      getReceiptNumber(storeWithManualReset.contracts[0].schedules[2], storeWithManualReset.contracts[0], storeWithManualReset),
      '1',
      'First receipt in new cycle starts from 1'
    );
    assert.strictEqual(
      getReceiptNumber(storeWithManualReset.contracts[0].schedules[3], storeWithManualReset.contracts[0], storeWithManualReset),
      '2',
      'Second receipt in new cycle is 2'
    );
  });
});
