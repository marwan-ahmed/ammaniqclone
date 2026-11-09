import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isBorrowerSettled,
  getBorrowerStatusDisplay,
  getPersistedBorrowersCardLayout,
  persistBorrowersCardLayout,
  BORROWERS_CARD_LAYOUT_KEY
} from '../utils/installmentDates';
import { SimulationStore } from '../services/simulation';
import { Borrower } from '../types/finance';

describe('Borrower Status Display Engine ("مسدد" vs "نشط")', () => {
  it('isBorrowerSettled returns true when status is explicitly SETTLED', () => {
    const borrower: Partial<Borrower> = {
      status: 'SETTLED',
      totalFinancedIQD: 1_500_000,
      remainingDebtIQD: 0
    };
    assert.strictEqual(isBorrowerSettled(borrower), true);
  });

  it('isBorrowerSettled returns true when all loans are fully repaid (remainingDebtIQD <= 0 and totalFinancedIQD > 0)', () => {
    const borrower: Partial<Borrower> = {
      status: 'ACTIVE',
      totalFinancedIQD: 2_000_000,
      remainingDebtIQD: 0
    };
    assert.strictEqual(isBorrowerSettled(borrower), true);
  });

  it('isBorrowerSettled returns false when borrower has unpaid remaining balance', () => {
    const borrower: Partial<Borrower> = {
      status: 'ACTIVE',
      totalFinancedIQD: 2_000_000,
      remainingDebtIQD: 500_000
    };
    assert.strictEqual(isBorrowerSettled(borrower), false);
  });

  it('isBorrowerSettled returns false for newly registered borrower with 0 loans', () => {
    const borrower: Partial<Borrower> = {
      status: 'ACTIVE',
      totalFinancedIQD: 0,
      remainingDebtIQD: 0
    };
    assert.strictEqual(isBorrowerSettled(borrower), false);
  });

  it('getBorrowerStatusDisplay returns exact Arabic label "مسدد" when fully repaid', () => {
    const fullyPaidBorrower: Partial<Borrower> = {
      status: 'SETTLED',
      totalFinancedIQD: 1_200_000,
      remainingDebtIQD: 0
    };
    const display = getBorrowerStatusDisplay(fullyPaidBorrower);
    assert.strictEqual(display.label, 'مسدد');
    assert.ok(display.className.includes('text-blue-400'));
  });

  it('getBorrowerStatusDisplay returns exact Arabic label "نشط" when loan is not fully paid', () => {
    const activeBorrower: Partial<Borrower> = {
      status: 'ACTIVE',
      totalFinancedIQD: 1_200_000,
      remainingDebtIQD: 400_000
    };
    const display = getBorrowerStatusDisplay(activeBorrower);
    assert.strictEqual(display.label, 'نشط');
    assert.ok(display.className.includes('text-emerald-400'));
  });

  it('SimulationStore lifecycle: transitions from "نشط" to "مسدد" upon full payment and back to "نشط" on new contract', () => {
    const store = new SimulationStore();

    // 1. Register new borrower
    const regRes = store.addBorrower({
      name: 'علي حسن العباسي',
      phone: '07701234567',
      address: 'سامراء - شارع القاطول',
      guarantors: []
    });
    assert.strictEqual(regRes.success, true);
    const borrower = regRes.borrower;
    assert.strictEqual(borrower.status, 'ACTIVE');
    assert.strictEqual(getBorrowerStatusDisplay(borrower).label, 'نشط');

    // 2. Add inventory item for company
    store.companyWallet.balance = 10_000_000;
    const purchaseRes = store.purchaseInventory({
      name: 'هاتف سامسونج S24 ألترا',
      category: 'هواتف ذكية',
      unitCostIQD: 1_000_000,
      targetSellingPriceIQD: 1_200_000,
      quantity: 5,
      investorId: 'wallet-company'
    });
    assert.strictEqual(purchaseRes.success, true);
    const item = purchaseRes.item!;

    // 3. Issue contract for 1,200,000 with 0 down payment over 2 months (600,000 / month)
    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1_200_000,
      downPaymentIQD: 0,
      monthsCount: 2
    });
    assert.strictEqual(contractRes.success, true);
    const contract = contractRes.contract!;
    assert.strictEqual(borrower.remainingDebtIQD, 1_200_000);
    assert.strictEqual(borrower.status, 'ACTIVE');
    assert.strictEqual(getBorrowerStatusDisplay(borrower).label, 'نشط');

    // 4. Pay 1st installment (600,000) -> Still has 600,000 remaining debt -> label must remain "نشط"
    const pay1 = store.payInstallmentSchedule(contract.id, contract.schedules[0].id);
    assert.strictEqual(pay1.success, true);
    assert.strictEqual(borrower.remainingDebtIQD, 600_000);
    assert.strictEqual(borrower.status, 'ACTIVE');
    assert.strictEqual(getBorrowerStatusDisplay(borrower).label, 'نشط');

    // 5. Pay 2nd installment (600,000) -> Remaining debt becomes 0 -> label must become "مسدد"
    const pay2 = store.payInstallmentSchedule(contract.id, contract.schedules[1].id);
    assert.strictEqual(pay2.success, true);
    assert.strictEqual(borrower.remainingDebtIQD, 0);
    assert.strictEqual(borrower.status, 'SETTLED');
    assert.strictEqual(getBorrowerStatusDisplay(borrower).label, 'مسدد');

    // 6. Issue a new contract for the same borrower -> borrower has active debt again -> transitions to "نشط"
    const contractRes2 = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1_200_000,
      downPaymentIQD: 0,
      monthsCount: 2
    });
    assert.strictEqual(contractRes2.success, true);
    assert.strictEqual(borrower.remainingDebtIQD, 1_200_000);
    assert.strictEqual(borrower.status, 'ACTIVE');
    assert.strictEqual(getBorrowerStatusDisplay(borrower).label, 'نشط');
  });

  describe('Card Layout Mode Persistence (Grid vs List)', () => {
    it('defaults to "grid" when nothing is saved or in Node environment without localStorage', () => {
      assert.strictEqual(getPersistedBorrowersCardLayout(), 'grid');
    });

    it('persists and restores "list" and "grid" when mock localStorage is present', () => {
      const storageMap = new Map<string, string>();
      const mockStorage = {
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => storageMap.set(k, v),
        removeItem: (k: string) => storageMap.delete(k),
        clear: () => storageMap.clear(),
        length: 0,
        key: () => null
      };

      // Mock global window and localStorage
      const originalWindow = (global as any).window;
      (global as any).window = { localStorage: mockStorage };

      try {
        // Initial state is default 'grid'
        assert.strictEqual(getPersistedBorrowersCardLayout(), 'grid');

        // User switches to 'list'
        persistBorrowersCardLayout('list');
        assert.strictEqual(storageMap.get(BORROWERS_CARD_LAYOUT_KEY), 'list');
        assert.strictEqual(getPersistedBorrowersCardLayout(), 'list');

        // User switches back to 'grid'
        persistBorrowersCardLayout('grid');
        assert.strictEqual(storageMap.get(BORROWERS_CARD_LAYOUT_KEY), 'grid');
        assert.strictEqual(getPersistedBorrowersCardLayout(), 'grid');

        // Corrupted or invalid value falls back safely to 'grid'
        storageMap.set(BORROWERS_CARD_LAYOUT_KEY, 'invalid_mode');
        assert.strictEqual(getPersistedBorrowersCardLayout(), 'grid');
      } finally {
        if (originalWindow !== undefined) {
          (global as any).window = originalWindow;
        } else {
          delete (global as any).window;
        }
      }
    });
  });

  describe('Dashboard Borrower Card Metrics Alignment', () => {
    it('matches user scenario: 1 borrower with fully paid loan produces 1 total, 0 active, and 0 active debt', () => {
      const store = new SimulationStore();
      store.borrowers = [
        {
          id: 'bor-1',
          name: 'علي حسن العباسي',
          phone: '07701234567',
          address: 'سامراء',
          city: 'سامراء',
          guarantors: [],
          totalFinancedIQD: 1_200_000,
          totalRepaidIQD: 1_200_000,
          remainingDebtIQD: 0,
          status: 'ACTIVE', // status in DB might have been ACTIVE before sync
          createdAt: '2026-01-01'
        }
      ];

      // Mirror DashboardView calculation logic
      const activeBorrowers = store.borrowers.filter((b) => !isBorrowerSettled(b));
      const activeBorrowersCount = activeBorrowers.length;
      const totalDebts = activeBorrowers.reduce((acc, b) => acc + Math.max(0, b.remainingDebtIQD || 0), 0);

      assert.strictEqual(store.borrowers.length, 1);
      assert.strictEqual(activeBorrowersCount, 0);
      assert.strictEqual(totalDebts, 0);
    });

    it('correctly calculates mixed portfolio: active debtors counted, settled debtors excluded from active debts', () => {
      const store = new SimulationStore();
      store.borrowers = [
        {
          id: 'bor-settled',
          name: 'الزبون المسدد',
          phone: '07701111111',
          address: 'سامراء',
          city: 'سامراء',
          guarantors: [],
          totalFinancedIQD: 2_000_000,
          totalRepaidIQD: 2_000_000,
          remainingDebtIQD: 0,
          status: 'SETTLED',
          createdAt: '2026-01-01'
        },
        {
          id: 'bor-active',
          name: 'الزبون النشط',
          phone: '07702222222',
          address: 'سامراء',
          city: 'سامراء',
          guarantors: [],
          totalFinancedIQD: 1_500_000,
          totalRepaidIQD: 500_000,
          remainingDebtIQD: 1_000_000,
          status: 'ACTIVE',
          createdAt: '2026-01-01'
        }
      ];

      const activeBorrowers = store.borrowers.filter((b) => !isBorrowerSettled(b));
      const activeBorrowersCount = activeBorrowers.length;
      const totalDebts = activeBorrowers.reduce((acc, b) => acc + Math.max(0, b.remainingDebtIQD || 0), 0);

      assert.strictEqual(store.borrowers.length, 2);
      assert.strictEqual(activeBorrowersCount, 1);
      assert.strictEqual(totalDebts, 1_000_000);
    });
  });
});

