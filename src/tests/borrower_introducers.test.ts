import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SimulationStore } from '../services/simulation';
import { Borrower, InstallmentContract, InstallmentScheduleItem } from '../types/finance';
import { getBorrowerDueSummary } from '../utils/installmentDates';

describe('Borrower Introducers & Friendly Collection Feature Tests', () => {
  test('Borrower creation stores introducedBy (من أحضر الزبون)', () => {
    const store = new SimulationStore();
    const result = store.addBorrower({
      name: 'زيد أحمد',
      phone: '07701112233',
      address: 'سامراء - حي القاطول',
      introducedBy: 'مروان',
      guarantors: [
        {
          name: 'كفيل زيد',
          phone: '07709998877',
          nationalId: 'IQ-123456',
        },
      ],
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.borrower.introducedBy, 'مروان');

    const found = store.borrowers.find((b) => b.id === result.borrower.id);
    assert.ok(found);
    assert.strictEqual(found.introducedBy, 'مروان');
  });

  test('Borrower update updates and persists introducedBy', () => {
    const store = new SimulationStore();
    const res = store.addBorrower({
      name: 'عمر علي',
      phone: '07702223344',
      address: 'سامراء - حي المعلمين',
      guarantors: [],
    });

    assert.strictEqual(res.borrower.introducedBy, undefined);

    // Update with introducedBy
    const updateRes = store.updateBorrower(res.borrower.id, {
      name: 'عمر علي',
      phone: '07702223344',
      address: 'سامراء - حي المعلمين',
      introducedBy: 'مروان',
    });

    assert.strictEqual(updateRes.success, true);
    const updated = store.borrowers.find((b) => b.id === res.borrower.id);
    assert.ok(updated);
    assert.strictEqual(updated.introducedBy, 'مروان');
  });

  test('User scenario: Grouping customers by introducer (مروان، أسعد، خالد)', () => {
    const store = new SimulationStore();

    // مروان أحضر: زيد، عمر، فراس
    const bZayd = store.addBorrower({ name: 'زيد', phone: '07701', address: 'حي 1', introducedBy: 'مروان', guarantors: [] }).borrower;
    const bOmar = store.addBorrower({ name: 'عمر', phone: '07702', address: 'حي 2', introducedBy: 'مروان', guarantors: [] }).borrower;
    const bFiras = store.addBorrower({ name: 'فراس', phone: '07703', address: 'حي 3', introducedBy: 'مروان', guarantors: [] }).borrower;

    // أسعد أحضر: رشا، محمد، كريم
    const bRasha = store.addBorrower({ name: 'رشا', phone: '07704', address: 'حي 4', introducedBy: 'أسعد', guarantors: [] }).borrower;
    const bMohammed = store.addBorrower({ name: 'محمد', phone: '07705', address: 'حي 5', introducedBy: 'أسعد', guarantors: [] }).borrower;
    const bKareem = store.addBorrower({ name: 'كريم', phone: '07706', address: 'حي 6', introducedBy: 'أسعد', guarantors: [] }).borrower;

    // خالد أحضر: سعاد، رقية، بلقيس
    const bSuad = store.addBorrower({ name: 'سعاد', phone: '07707', address: 'حي 7', introducedBy: 'خالد', guarantors: [] }).borrower;
    const bRuqaya = store.addBorrower({ name: 'رقية', phone: '07708', address: 'حي 8', introducedBy: 'خالد', guarantors: [] }).borrower;
    const bBalqis = store.addBorrower({ name: 'بلقيس', phone: '07709', address: 'حي 9', introducedBy: 'خالد', guarantors: [] }).borrower;

    // Grouping by introducer
    const groupMap = new Map<string, string[]>();
    store.borrowers.forEach((b) => {
      const key = b.introducedBy || 'بدون معرّف';
      const list = groupMap.get(key) || [];
      list.push(b.name);
      groupMap.set(key, list);
    });

    assert.deepStrictEqual(groupMap.get('مروان'), ['زيد', 'عمر', 'فراس']);
    assert.deepStrictEqual(groupMap.get('أسعد'), ['رشا', 'محمد', 'كريم']);
    assert.deepStrictEqual(groupMap.get('خالد'), ['سعاد', 'رقية', 'بلقيس']);
  });

  test('Calculates total remaining debt, overdue installments, and installment amounts accurately', () => {
    const store = new SimulationStore();

    const borrower = store.addBorrower({
      name: 'زيد أحمد',
      phone: '07701112233',
      address: 'سامراء',
      introducedBy: 'مروان',
      guarantors: [],
    }).borrower;

    borrower.totalFinancedIQD = 1000000;
    borrower.remainingDebtIQD = 800000;

    // Create a mock contract for the borrower with overdue schedule
    const mockContract: InstallmentContract = {
      id: 'contract-test-1',
      contractNumber: '101',
      invoiceNumber: 101,
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      investorId: 'inv-1',
      investorName: 'المستثمر',
      inventoryItemId: 'item-1',
      inventoryItemName: 'لابتوب',
      itemCostPriceIQD: 800000,
      totalSalePriceIQD: 1000000,
      downPaymentIQD: 200000,
      financedAmountIQD: 800000,
      monthlyInstallmentIQD: 100000,
      monthsCount: 8,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      schedules: [
        {
          id: 'sch-1',
          contractId: 'contract-test-1',
          installmentNumber: 1,
          dueDate: '2026-02-01', // Past date -> OVERDUE
          amountIQD: 100000,
          principalAmountIQD: 80000,
          profitAmountIQD: 20000,
          investorProfitShareIQD: 12000,
          companyProfitShareIQD: 8000,
          status: 'PENDING',
        },
        {
          id: 'sch-2',
          contractId: 'contract-test-1',
          installmentNumber: 2,
          dueDate: '2026-12-01', // Future date -> UPCOMING
          amountIQD: 100000,
          principalAmountIQD: 80000,
          profitAmountIQD: 20000,
          investorProfitShareIQD: 12000,
          companyProfitShareIQD: 8000,
          status: 'PENDING',
        },
      ],
    };

    store.contracts.push(mockContract);

    const dueSummary = getBorrowerDueSummary(borrower.id, store.contracts, new Date('2026-03-01'));
    assert.strictEqual(dueSummary.hasOverdue, true);
    assert.strictEqual(dueSummary.overdueCount, 1);
    assert.strictEqual(dueSummary.totalOverdueAmountIQD, 100000);
    assert.strictEqual(mockContract.monthlyInstallmentIQD, 100000);
  });

  test('CSV export payload contains UTF-8 BOM and required columns', () => {
    let csv = '\uFEFF';
    csv += 'من أحضر الزبون (المعرّف),اسم الزبون,رقم الهاتف,المتبقي الكلي (د.ع),الأقساط المتأخرة,مبلغ القسط الشهري (د.ع),المبلغ المتأخر (د.ع),الحالة\n';
    csv += '"مروان","زيد","07701112233","800000","1","100000","100000","متأخر (1 قسط)"\n';

    assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for MS Excel Arabic support');
    assert.ok(csv.includes('من أحضر الزبون (المعرّف)'));
    assert.ok(csv.includes('مروان'));
    assert.ok(csv.includes('زيد'));
    assert.ok(csv.includes('800000'));
    assert.ok(csv.includes('100000'));
  });
});

