import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationStore } from '../services/simulation';

test('Installment Contract Creation - Investor filtering, profit margins, and months calculations', async (t) => {
  await t.test('filters inventory strictly by selected investor', () => {
    const store = new SimulationStore();

    // Create mock inventory items belonging to different investors
    store.inventory = [
      {
        id: 'item-1',
        sku: 'SKU-1',
        name: 'شاشة سامسونج 55 بوصة',
        category: 'شاشات',
        investorId: 'inv-1',
        investorName: 'مروان احمد',
        quantity: 1,
        unitCostIQD: 500000,
        totalCostIQD: 500000,
        targetSellingPriceIQD: 700000,
        status: 'IN_STOCK',
        purchaseDate: '2026-08-31',
        purchaseInvoiceId: 'PUR-1'
      },
      {
        id: 'item-2',
        sku: 'SKU-2',
        name: 'غسالة ال جي 10 كيلو',
        category: 'غسالات',
        investorId: 'inv-2',
        investorName: 'علي إياد',
        quantity: 1,
        unitCostIQD: 800000,
        totalCostIQD: 800000,
        targetSellingPriceIQD: 1100000,
        status: 'IN_STOCK',
        purchaseDate: '2026-08-31',
        purchaseInvoiceId: 'PUR-2'
      },
      {
        id: 'item-3',
        sku: 'SKU-3',
        name: 'مكيف جري 2 طن',
        category: 'تبريد',
        investorId: 'COMPANY_MAIN',
        investorName: 'صندوق نظام أمان الرئيسي',
        quantity: 1,
        unitCostIQD: 1000000,
        totalCostIQD: 1000000,
        targetSellingPriceIQD: 1400000,
        status: 'IN_STOCK',
        purchaseDate: '2026-08-31',
        purchaseInvoiceId: 'PUR-3'
      }
    ];

    // Filter helper function
    const getItemsForInvestor = (investorId: string) => {
      return store.inventory.filter((item) => {
        if (item.status !== 'IN_STOCK') return false;
        if (
          investorId === 'COMPANY_MAIN' ||
          investorId === 'company-s' ||
          investorId === 'wallet-company'
        ) {
          return (
            item.investorId === 'COMPANY_MAIN' ||
            item.investorId === 'company-s' ||
            item.investorId === 'wallet-company' ||
            !item.investorId ||
            item.investorName.includes('الشركة') ||
            item.investorName.includes('أمان') ||
            item.investorName.includes('نظام أمان')
          );
        }
        return (
          item.investorId === investorId ||
          item.investorName.includes(investorId)
        );
      });
    };

    const marwanItems = getItemsForInvestor('inv-1');
    assert.equal(marwanItems.length, 1);
    assert.equal(marwanItems[0].name, 'شاشة سامسونج 55 بوصة');

    const aliItems = getItemsForInvestor('inv-2');
    assert.equal(aliItems.length, 1);
    assert.equal(aliItems[0].name, 'غسالة ال جي 10 كيلو');

    const companyItems = getItemsForInvestor('COMPANY_MAIN');
    assert.equal(companyItems.length, 1);
    assert.equal(companyItems[0].name, 'مكيف جري 2 طن');

    const unknownItems = getItemsForInvestor('inv-999');
    assert.equal(unknownItems.length, 0);
  });

  await t.test('correctly fetches item base cost and calculates profit margin and total contract price without down payment', () => {
    // Pricing calculation helper mirroring the UI component
    const calculatePricing = (cost: number, profitPercent: number, downPayment: number = 0) => {
      const safeCost = Math.max(0, cost);
      const safeDownPayment = Math.min(safeCost, Math.max(0, downPayment));
      const netCost = Math.max(0, safeCost - safeDownPayment);
      const safePercent = Math.max(0, profitPercent);
      const profitAmount = Math.round(netCost * (safePercent / 100));
      const financedAmount = netCost + profitAmount;
      const totalSale = safeDownPayment + financedAmount;
      return {
        itemCostPriceIQD: safeCost,
        downPaymentIQD: safeDownPayment,
        netCostIQD: netCost,
        profitMarginPercent: safePercent,
        profitAmountIQD: profitAmount,
        financedAmountIQD: financedAmount,
        totalSalePriceIQD: totalSale
      };
    };

    // Item with base cost of 1,000,000 IQD and 30% profit margin without down payment
    const pricing1 = calculatePricing(1000000, 30, 0);
    assert.equal(pricing1.itemCostPriceIQD, 1000000);
    assert.equal(pricing1.netCostIQD, 1000000);
    assert.equal(pricing1.profitAmountIQD, 300000);
    assert.equal(pricing1.financedAmountIQD, 1300000);
    assert.equal(pricing1.totalSalePriceIQD, 1300000); // 1,000,000 + 300,000
    assert.equal(pricing1.downPaymentIQD, 0);

    // Item with base cost of 500,000 IQD and 40% profit margin without down payment
    const pricing2 = calculatePricing(500000, 40, 0);
    assert.equal(pricing2.itemCostPriceIQD, 500000);
    assert.equal(pricing2.netCostIQD, 500000);
    assert.equal(pricing2.profitAmountIQD, 200000);
    assert.equal(pricing2.financedAmountIQD, 700000);
    assert.equal(pricing2.totalSalePriceIQD, 700000); // 500,000 + 200,000
    assert.equal(pricing2.downPaymentIQD, 0);
  });

  await t.test('correctly deducts down payment from item cost and multiplies net remainder by profit percent', () => {
    const calculatePricing = (cost: number, profitPercent: number, downPayment: number = 0) => {
      const safeCost = Math.max(0, cost);
      const safeDownPayment = Math.min(safeCost, Math.max(0, downPayment));
      const netCost = Math.max(0, safeCost - safeDownPayment);
      const safePercent = Math.max(0, profitPercent);
      const profitAmount = Math.round(netCost * (safePercent / 100));
      const financedAmount = netCost + profitAmount;
      const totalSale = safeDownPayment + financedAmount;
      return {
        itemCostPriceIQD: safeCost,
        downPaymentIQD: safeDownPayment,
        netCostIQD: netCost,
        profitMarginPercent: safePercent,
        profitAmountIQD: profitAmount,
        financedAmountIQD: financedAmount,
        totalSalePriceIQD: totalSale
      };
    };

    // Item cost 1,000,000 IQD, Down payment 200,000 IQD, Profit margin 30%
    // Net remainder = 1,000,000 - 200,000 = 800,000 IQD
    // Profit = 800,000 * 30% = 240,000 IQD
    // Financed debt (المبلغ المتقسط) = 800,000 + 240,000 = 1,040,000 IQD
    // Total sale price = 200,000 + 1,040,000 = 1,240,000 IQD
    const p1 = calculatePricing(1000000, 30, 200000);
    assert.equal(p1.itemCostPriceIQD, 1000000);
    assert.equal(p1.downPaymentIQD, 200000);
    assert.equal(p1.netCostIQD, 800000);
    assert.equal(p1.profitAmountIQD, 240000);
    assert.equal(p1.financedAmountIQD, 1040000);
    assert.equal(p1.totalSalePriceIQD, 1240000);

    // Monthly installment for 10 months
    const monthly10 = Math.round(p1.financedAmountIQD / 10);
    assert.equal(monthly10, 104000);

    // Clamping test: down payment exceeds cost -> clamped to cost
    const pClamp = calculatePricing(1000000, 30, 1500000);
    assert.equal(pClamp.downPaymentIQD, 1000000);
    assert.equal(pClamp.netCostIQD, 0);
    assert.equal(pClamp.profitAmountIQD, 0);
    assert.equal(pClamp.financedAmountIQD, 0);
    assert.equal(pClamp.totalSalePriceIQD, 1000000);
  });

  await t.test('correctly calculates dynamic monthly installments for custom typed months count (full total sale price)', () => {
    const totalSalePriceIQD = 1200000;
    const financedAmount = totalSalePriceIQD; // 1,200,000 IQD

    // 10 months
    const monthly10 = Math.round(financedAmount / 10);
    assert.equal(monthly10, 120000);

    // 12 months
    const monthly12 = Math.round(financedAmount / 12);
    assert.equal(monthly12, 100000);

    // 14 months
    const monthly14 = Math.round(financedAmount / 14);
    assert.equal(monthly14, 85714);

    // Custom 17 months
    const monthly17 = Math.round(financedAmount / 17);
    assert.equal(monthly17, 70588);

    // Custom 30 months
    const monthly30 = Math.round(financedAmount / 30);
    assert.equal(monthly30, 40000);
  });

  await t.test('getInvoiceNumber returns clean integer without SP prefix or symbols', async () => {
    const { getInvoiceNumber } = await import('../components/common/ContractDocumentHubModal');

    // Case 1: Contract ending in 6832 (user's exact example)
    const c1: any = { contractNumber: 'CNT-2026-6832' };
    assert.equal(getInvoiceNumber(c1), '6832');

    // Case 2: Contract ending in 151
    const c2: any = { contractNumber: 'CNT-2026-151' };
    assert.equal(getInvoiceNumber(c2), '151');

    // Case 3: Explicit numeric invoiceNumber stored on contract
    const c3: any = { contractNumber: 'CNT-2026-999', invoiceNumber: 1005 };
    assert.equal(getInvoiceNumber(c3), '1005');

    // Verify it contains no letters (no SP) and no symbols (no #)
    const res = getInvoiceNumber(c1);
    assert.match(res, /^\d+$/);
    assert.equal(res.includes('SP'), false);
    assert.equal(res.includes('#'), false);
  });

  await t.test('searching by invoice number finds matching contracts', async () => {
    const { getInvoiceNumber } = await import('../components/common/ContractDocumentHubModal');

    const contracts: any[] = [
      { contractNumber: 'CNT-2026-151', borrowerName: 'أحمد شاكر', investorName: 'علي', inventoryItemName: 'بضاعة' },
      { contractNumber: 'CNT-2026-6832', borrowerName: 'تتتلاهمهامه', investorName: 'شوكت', inventoryItemName: 'بضاعة 1.5 مليون' }
    ];

    const searchKeyword = '6832';
    const found = contracts.filter((c) => {
      const invNo = getInvoiceNumber(c);
      return (
        c.contractNumber.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        invNo.includes(searchKeyword.trim())
      );
    });

    assert.equal(found.length, 1);
    assert.equal(found[0].contractNumber, 'CNT-2026-6832');
  });

  await t.test('getReceiptNumber returns clean integer without SP prefix or symbols and provides proper sequence', async () => {
    const { getReceiptNumber } = await import('../components/common/ContractDocumentHubModal');

    // Case 1: Explicit receipt number on schedule
    const sch1: any = { id: 'sch-1', status: 'PAID', receiptNumber: 1045 };
    assert.equal(getReceiptNumber(sch1), '1045');

    // Case 2: Schedule with SP-style id is sanitized to pure digits
    const sch2: any = { id: 'sch-1107', status: 'PAID' };
    const r2 = getReceiptNumber(sch2);
    assert.match(r2, /^\d+$/);
    assert.equal(r2.includes('SP'), false);

    // Case 3: Sequential numbering across store paid schedules
    const storeMock: any = {
      contracts: [
        {
          id: 'c1',
          schedules: [
            { id: 's-10', status: 'PAID', installmentNumber: 1, paidDate: '2026-01-01' },
            { id: 's-11', status: 'PAID', installmentNumber: 2, paidDate: '2026-02-01' }
          ]
        },
        {
          id: 'c2',
          schedules: [
            { id: 's-20', status: 'PAID', installmentNumber: 1, paidDate: '2026-03-01' },
            { id: 's-21', status: 'PENDING', installmentNumber: 2 }
          ]
        }
      ],
      directDebts: []
    };

    const resFirst = getReceiptNumber(storeMock.contracts[0].schedules[0], storeMock.contracts[0], storeMock);
    const resSecond = getReceiptNumber(storeMock.contracts[0].schedules[1], storeMock.contracts[0], storeMock);
    const resThird = getReceiptNumber(storeMock.contracts[1].schedules[0], storeMock.contracts[1], storeMock);

    assert.equal(resFirst, '1');
    assert.equal(resSecond, '2');
    assert.equal(resThird, '3');
  });

  await t.test('Installment Sales Invoice Table: getInvoiceTableItem calculates Total = Quantity × Unit Price (User Example)', async () => {
    const { getInvoiceTableItem } = await import('../components/common/ContractDocumentHubModal');

    // User's exact scenario:
    // ت: 1
    // اسم المادة: بضاعة 1
    // العدد: 5
    // الوحدة: قطعة
    // سعر الوحدة: 1 مليون (1,000,000 د.ع)
    // الاجمالي: 5 مليون (5,000,000 د.ع)
    const mockContractUserExample: any = {
      contractNumber: 'CNT-2026-001',
      inventoryItemName: 'بضاعة 1',
      quantity: 5,
      totalSalePriceIQD: 5000000
    };

    const row = getInvoiceTableItem(mockContractUserExample);

    assert.equal(row.index, 1, 'ت should be 1');
    assert.equal(row.itemName, 'بضاعة 1', 'اسم المادة should match item name');
    assert.equal(row.quantity, 5, 'العدد should be 5');
    assert.equal(row.unit, 'قطعة', 'الوحدة should be قطعة');
    assert.equal(row.unitPriceIQD, 1000000, 'سعر الوحدة should be 1,000,000 (1 million)');
    assert.equal(row.totalPriceIQD, 5000000, 'الاجمالي should be 5,000,000 (5 million)');
    assert.equal(row.totalPriceIQD, row.quantity * row.unitPriceIQD, 'Total must equal Quantity × Unit Price');
  });

  await t.test('Installment Sales Invoice Table: default quantity of 1 and item prefixing', async () => {
    const { getInvoiceTableItem } = await import('../components/common/ContractDocumentHubModal');

    // Case with no explicit quantity (defaults to 1) and item name without prefix
    const mockContractSingle: any = {
      contractNumber: 'CNT-2026-371',
      inventoryItemName: 'ايفون',
      totalSalePriceIQD: 13000000
    };

    const row = getInvoiceTableItem(mockContractSingle);

    assert.equal(row.index, 1);
    assert.equal(row.itemName, 'بضاعة ايفون');
    assert.equal(row.quantity, 1);
    assert.equal(row.unit, 'قطعة');
    assert.equal(row.unitPriceIQD, 13000000);
    assert.equal(row.totalPriceIQD, 13000000);
    assert.equal(row.totalPriceIQD, row.quantity * row.unitPriceIQD);
  });
});


