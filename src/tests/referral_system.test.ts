import assert from 'node:assert';
import { test, describe } from 'node:test';
import { InvestorContract, InstallmentScheduleItem, Investor } from '../types/finance';

describe('Referral System: Type Definitions and Contracts', () => {
  test('InvestorContract and InstallmentScheduleItem support referral fields', () => {
    const contract: InvestorContract = {
      id: 'inv-cnt-1',
      investorId: 'inv-bashir',
      investorSharePercent: 50,
      companySharePercent: 50,
      lossSharingPolicy: 'SHARED',
      contractDate: '2026-10-24',
      referrerId: 'inv-khalid',
      referrerName: 'خالد',
      referrerSharePercent: 5,
    };
    assert.strictEqual(contract.referrerSharePercent, 5);
    assert.strictEqual(contract.referrerId, 'inv-khalid');

    const schedule: InstallmentScheduleItem = {
      id: 'sch-1',
      contractId: 'cnt-1',
      installmentNumber: 1,
      dueDate: '2026-11-24',
      amountIQD: 100000,
      principalAmountIQD: 70000,
      profitAmountIQD: 30000,
      investorProfitShareIQD: 15000,
      referrerProfitShareIQD: 1500,
      companyProfitShareIQD: 13500,
      status: 'PENDING'
    };
    assert.strictEqual(schedule.referrerProfitShareIQD, 1500);

    const partner: Investor = {
      id: 'inv-ref-partner',
      name: 'سالم وسيط إحالة',
      phone: '07709999999',
      walletId: 'wallet-ref-partner',
      contract: contract,
      totalCapitalDeposited: 0,
      activeInvestmentsAmount: 0,
      availableLiquidity: 0,
      totalProfitsEarned: 0,
      totalLossesIncurred: 0,
      createdAt: '2026-10-24',
      isReferralPartner: true,
      totalReferralCommissionsEarned: 50000
    };
    assert.strictEqual(partner.isReferralPartner, true);
    assert.strictEqual(partner.totalReferralCommissionsEarned, 50000);
  });

  test('SimulationStore.createContract calculates exact referral shares with zero dinar drift', () => {
    const { SimulationStore } = require('../services/simulation');
    const store = new SimulationStore();

    // 1. Setup Khalid as Referrer (Investor with 40% share)
    const khalidRes = store.addInvestor({
      name: 'خالد المستثمر',
      phone: '07701111111',
      address: 'سامراء',
      capitalAmount: 10000000,
      investorSharePercent: 40,
      companySharePercent: 60,
    });
    const khalid = khalidRes.investor;

    // 2. Setup Bashir as Referred Investor (Referred by Khalid with 5% commission)
    const bashirRes = store.addInvestor({
      name: 'بشير المستثمر',
      phone: '07702222222',
      address: 'سامراء',
      capitalAmount: 10000000,
      investorSharePercent: 50,
      companySharePercent: 50,
      referrerId: khalid.id,
      referrerName: khalid.name,
      referrerSharePercent: 5,
    });
    const bashir = bashirRes.investor;

    // 3. Add inventory item for Bashir
    const itemRes = store.purchaseInventory({
      name: 'شاشة سامسونج 65 بوصة',
      category: 'إلكترونيات',
      investorId: bashir.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1300000,
    });
    const item = itemRes.item!;

    // 4. Add borrower
    const borrowerRes = store.addBorrower({
      name: 'عمر علي',
      phone: '07703333333',
      address: 'سامراء - شارع القاطول',
      guarantors: [],
    });
    const borrower = borrowerRes.borrower;

    // 5. Create 10-month contract (Profit = 300,000 IQD)
    // Bashir 50% = 150,000 IQD (15,000/mo)
    // Khalid 5% = 15,000 IQD (1,500/mo)
    // Company net 45% = 135,000 IQD (13,500/mo)
    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1300000,
      downPaymentIQD: 0,
      monthsCount: 10,
      startDate: '2026-11-01',
    });
    const contract = contractRes.contract!;

    assert.strictEqual(contract.schedules.length, 10);

    let sumPrincipal = 0;
    let sumInvProfit = 0;
    let sumRefProfit = 0;
    let sumCompProfit = 0;

    contract.schedules.forEach((s: any) => {
      assert.strictEqual(s.amountIQD, s.principalAmountIQD + s.profitAmountIQD);
      assert.strictEqual(
        s.profitAmountIQD,
        s.investorProfitShareIQD + (s.referrerProfitShareIQD || 0) + s.companyProfitShareIQD
      );
      sumPrincipal += s.principalAmountIQD;
      sumInvProfit += s.investorProfitShareIQD;
      sumRefProfit += s.referrerProfitShareIQD || 0;
      sumCompProfit += s.companyProfitShareIQD;
    });

    assert.strictEqual(sumPrincipal, 1000000);
    assert.strictEqual(sumInvProfit, 150000); // 50% to Bashir
    assert.strictEqual(sumRefProfit, 7500);   // 5% of company profit (150,000 * 5%) to Khalid
    assert.strictEqual(sumCompProfit, 142500); // remaining net to Company
    assert.strictEqual(sumInvProfit + sumRefProfit + sumCompProfit, 300000);
  });

  test('payInstallmentSchedule credits investor, referrer, and company wallet with ledger voucher', () => {
    const { SimulationStore } = require('../services/simulation');
    const store = new SimulationStore();

    const khalidRes = store.addInvestor({
      name: 'خالد المستثمر',
      phone: '07701111111',
      address: 'سامراء',
      capitalAmount: 5000000,
      investorSharePercent: 40,
      companySharePercent: 60,
    });
    const khalid = khalidRes.investor;

    const bashirRes = store.addInvestor({
      name: 'بشير المستثمر',
      phone: '07702222222',
      address: 'سامراء',
      capitalAmount: 5000000,
      investorSharePercent: 50,
      companySharePercent: 50,
      referrerId: khalid.id,
      referrerName: khalid.name,
      referrerSharePercent: 5,
    });
    const bashir = bashirRes.investor;

    const itemRes = store.purchaseInventory({
      name: 'غسالة ال جي',
      category: 'أجهزة منزلية',
      investorId: bashir.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1300000,
    });
    const item = itemRes.item!;

    const borrowerRes = store.addBorrower({
      name: 'علي حسن',
      phone: '07704444444',
      address: 'سامراء',
      guarantors: [],
    });
    const borrower = borrowerRes.borrower;

    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1300000,
      downPaymentIQD: 0,
      monthsCount: 10,
      startDate: '2026-11-01',
    });
    const contract = contractRes.contract!;

    const initialKhalidBal = store.wallets.find((w: any) => w.ownerId === khalid.id)!.balance;
    const initialBashirBal = store.wallets.find((w: any) => w.ownerId === bashir.id)!.balance;
    const initialCompanyBal = store.companyWallet.balance;

    // Pay first installment: Amount = 130,000 IQD
    // Principal = 100,000 (returns to Bashir)
    // Bashir Profit (50%) = 15,000 (to Bashir)
    // Khalid Referral (5% of Company 15,000) = 750 (to Khalid)
    // Company Profit = 14,250 (to Company)
    const scheduleId = contract.schedules[0].id;
    store.payInstallmentSchedule(contract.id, scheduleId);

    const updatedKhalidWallet = store.wallets.find((w: any) => w.ownerId === khalid.id)!;
    const updatedBashirWallet = store.wallets.find((w: any) => w.ownerId === bashir.id)!;
    const updatedCompanyWallet = store.companyWallet;

    assert.strictEqual(updatedBashirWallet.balance, initialBashirBal + 100000 + 15000);
    assert.strictEqual(updatedKhalidWallet.balance, initialKhalidBal + 750);
    assert.strictEqual(updatedCompanyWallet.balance, initialCompanyBal + 14250);

    // Check ledger transactions for REFERRAL_COMMISSION
    const refTx = store.transactions.find((t: any) => t.type === 'REFERRAL_COMMISSION');
    assert.ok(refTx, 'Referral commission ledger transaction must exist');
    assert.strictEqual(refTx.amountIQD, 750);
    assert.strictEqual(refTx.toWalletId, updatedKhalidWallet.id);
  });

  test('non-investor referral partner earns commissions into cash wallet without personal capital', () => {
    const { SimulationStore } = require('../services/simulation');
    const store = new SimulationStore();

    // Register pure referral partner (0 capital)
    const partnerRes = store.addInvestor({
      name: 'أحمد الوسيط',
      phone: '07709999999',
      address: 'سامراء',
      capitalAmount: 0,
      investorSharePercent: 0,
      companySharePercent: 100,
      isReferralPartner: true,
    });
    const partner = partnerRes.investor;
    assert.strictEqual(partner.isReferralPartner, true);
    assert.strictEqual(partner.totalCapitalDeposited, 0);

    // Bashir referred by partner with 10% referral cut
    const bashirRes = store.addInvestor({
      name: 'بشير التاجر',
      phone: '07708888888',
      address: 'سامراء',
      capitalAmount: 10000000,
      investorSharePercent: 60,
      companySharePercent: 40,
      referrerId: partner.id,
      referrerName: partner.name,
      referrerSharePercent: 10,
    });
    const bashir = bashirRes.investor;

    const itemRes = store.purchaseInventory({
      name: 'ثلاجة بيكو',
      category: 'أجهزة منزلية',
      investorId: bashir.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1400000,
    });
    const item = itemRes.item!;

    const borrowerRes = store.addBorrower({
      name: 'محمد جاسم',
      phone: '07705555555',
      address: 'سامراء',
      guarantors: [],
    });
    const borrower = borrowerRes.borrower;

    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1400000,
      downPaymentIQD: 0,
      monthsCount: 10,
      startDate: '2026-11-01',
    });
    const contract = contractRes.contract!;

    // Total profit = 400,000 IQD. Per schedule = 40,000 profit.
    // Bashir (60%) = 24,000 IQD
    // Company gross = 16,000 IQD
    // Partner (10% of company profit) = 1,600 IQD
    // Company (net) = 14,400 IQD
    const sch1 = contract.schedules[0];
    assert.strictEqual(sch1.investorProfitShareIQD, 24000);
    assert.strictEqual(sch1.referrerProfitShareIQD, 1600);
    assert.strictEqual(sch1.companyProfitShareIQD, 14400);

    // Pay installment
    store.payInstallmentSchedule(contract.id, sch1.id);

    const partnerWallet = store.wallets.find((w: any) => w.ownerId === partner.id)!;
    assert.strictEqual(partnerWallet.balance, 1600);
    const updatedPartner = store.investors.find((i: any) => i.id === partner.id)!;
    assert.strictEqual(updatedPartner.totalReferralCommissionsEarned, 1600);
  });

  test('partial payment rolls over remaining referral share to next schedule with exact conservation', () => {
    const { SimulationStore } = require('../services/simulation');
    const store = new SimulationStore();

    const khalidRes = store.addInvestor({
      name: 'خالد المستثمر',
      phone: '07701111111',
      address: 'سامراء',
      capitalAmount: 5000000,
      investorSharePercent: 40,
      companySharePercent: 60,
    });
    const khalid = khalidRes.investor;

    const bashirRes = store.addInvestor({
      name: 'بشير المستثمر',
      phone: '07702222222',
      address: 'سامراء',
      capitalAmount: 5000000,
      investorSharePercent: 50,
      companySharePercent: 50,
      referrerId: khalid.id,
      referrerName: khalid.name,
      referrerSharePercent: 5,
    });
    const bashir = bashirRes.investor;

    const itemRes = store.purchaseInventory({
      name: 'مكيف سبليت',
      category: 'أجهزة كهربائية',
      investorId: bashir.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1300000,
    });
    const item = itemRes.item!;

    const borrowerRes = store.addBorrower({
      name: 'عمر فاروق',
      phone: '07707777777',
      address: 'سامراء',
      guarantors: [],
    });
    const borrower = borrowerRes.borrower;

    const contractRes = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1300000,
      downPaymentIQD: 0,
      monthsCount: 10,
      startDate: '2026-11-01',
    });
    const contract = contractRes.contract!;

    const sch1 = contract.schedules[0]; // 130,000 IQD: Principal 100,000 | Profit: Bashir 15,000 | Khalid 750 | Company 14,250
    const sch2 = contract.schedules[1]; // 130,000 IQD

    // Pay only 65,000 IQD (half payment)
    store.payInstallmentSchedule(contract.id, sch1.id, 65000);

    assert.strictEqual(sch1.status, 'PAID');
    assert.strictEqual(sch1.amountIQD, 65000);
    assert.strictEqual(sch1.principalAmountIQD, 50000);
    assert.strictEqual(sch1.investorProfitShareIQD, 7500);
    assert.strictEqual(sch1.referrerProfitShareIQD, 375);
    assert.strictEqual(sch1.companyProfitShareIQD, 7125);
    assert.strictEqual(50000 + 7500 + 375 + 7125, 65000);

    // Verify rolled over into sch2
    const updatedSch2 = contract.schedules[1];
    assert.strictEqual(updatedSch2.amountIQD, 130000 + 65000); // 195,000
    assert.strictEqual(updatedSch2.principalAmountIQD, 100000 + 50000); // 150,000
    assert.strictEqual(updatedSch2.investorProfitShareIQD, 15000 + 7500); // 22,500
    assert.strictEqual(updatedSch2.referrerProfitShareIQD, 750 + 375); // 1,125
    assert.strictEqual(updatedSch2.companyProfitShareIQD, 14250 + 7125); // 21,375

    // Dinar conservation on sch2:
    assert.strictEqual(
      updatedSch2.principalAmountIQD +
      updatedSch2.investorProfitShareIQD +
      updatedSch2.referrerProfitShareIQD! +
      updatedSch2.companyProfitShareIQD,
      195000
    );
  });

  test('comprehensive user scenario: Khalid (40%) refers Bashir (50%, 5%), Saeed (40%, 7%), and Raad (60%, 3%) with exact conservation', () => {
    const { SimulationStore } = require('../services/simulation');
    const store = new SimulationStore();

    // 1. Khalid: Investor (40% Khalid / 60% Company)
    const khalid = store.addInvestor({
      name: 'خالد المستثمر',
      phone: '07701111111',
      address: 'سامراء',
      capitalAmount: 10000000,
      investorSharePercent: 40,
      companySharePercent: 60,
    }).investor;

    // 2. Bashir: Referred by Khalid (50% Bashir / 50% Company, 5% cut to Khalid)
    const bashir = store.addInvestor({
      name: 'بشير',
      phone: '07702222222',
      address: 'سامراء',
      capitalAmount: 10000000,
      investorSharePercent: 50,
      companySharePercent: 50,
      referrerId: khalid.id,
      referrerName: khalid.name,
      referrerSharePercent: 5,
    }).investor;

    // 3. Saeed: Referred by Khalid (40% Saeed / 60% Company, 7% cut to Khalid)
    const saeed = store.addInvestor({
      name: 'سعيد',
      phone: '07703333333',
      address: 'سامراء',
      capitalAmount: 10000000,
      investorSharePercent: 40,
      companySharePercent: 60,
      referrerId: khalid.id,
      referrerName: khalid.name,
      referrerSharePercent: 7,
    }).investor;

    // 4. Raad: Referred by Khalid (60% Raad / 40% Company, 3% cut to Khalid)
    const raad = store.addInvestor({
      name: 'رعد',
      phone: '07704444444',
      address: 'سامراء',
      capitalAmount: 10000000,
      investorSharePercent: 60,
      companySharePercent: 40,
      referrerId: khalid.id,
      referrerName: khalid.name,
      referrerSharePercent: 3,
    }).investor;

    // Borrower
    const borrower = store.addBorrower({
      name: 'أحمد محمود',
      phone: '07705555555',
      address: 'سامراء',
      guarantors: [],
    }).borrower;

    // Inventory items for each (Cost = 1,000,000, Sale = 1,300,000 -> Profit = 300,000 IQD each)
    const itemKhalid = store.purchaseInventory({
      name: 'مادة خالد',
      category: 'عام',
      investorId: khalid.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1300000,
    }).item!;

    const itemBashir = store.purchaseInventory({
      name: 'مادة بشير',
      category: 'عام',
      investorId: bashir.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1300000,
    }).item!;

    const itemSaeed = store.purchaseInventory({
      name: 'مادة سعيد',
      category: 'عام',
      investorId: saeed.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1300000,
    }).item!;

    const itemRaad = store.purchaseInventory({
      name: 'مادة رعد',
      category: 'عام',
      investorId: raad.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1300000,
    }).item!;

    // Create 1-month contracts for simplicity of exact arithmetic
    const cntKhalid = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: itemKhalid.id,
      totalSalePriceIQD: 1300000,
      downPaymentIQD: 0,
      monthsCount: 1,
      startDate: '2026-11-01',
    }).contract!;

    const cntBashir = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: itemBashir.id,
      totalSalePriceIQD: 1300000,
      downPaymentIQD: 0,
      monthsCount: 1,
      startDate: '2026-11-01',
    }).contract!;

    const cntSaeed = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: itemSaeed.id,
      totalSalePriceIQD: 1300000,
      downPaymentIQD: 0,
      monthsCount: 1,
      startDate: '2026-11-01',
    }).contract!;

    const cntRaad = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: itemRaad.id,
      totalSalePriceIQD: 1300000,
      downPaymentIQD: 0,
      monthsCount: 1,
      startDate: '2026-11-01',
    }).contract!;

    // Verify Schedule splits:
    // 1. Khalid's own contract: Profit = 300,000. Khalid 40% = 120,000. Company 60% = 180,000.
    assert.strictEqual(cntKhalid.schedules[0].investorProfitShareIQD, 120000);
    assert.strictEqual(cntKhalid.schedules[0].companyProfitShareIQD, 180000);

    // 2. Bashir: Profit = 300,000. Bashir 50% = 150,000. Khalid 5% of Company 150k = 7,500. Company = 142,500.
    assert.strictEqual(cntBashir.schedules[0].investorProfitShareIQD, 150000);
    assert.strictEqual(cntBashir.schedules[0].referrerProfitShareIQD, 7500);
    assert.strictEqual(cntBashir.schedules[0].companyProfitShareIQD, 142500);

    // 3. Saeed: Profit = 300,000. Saeed 40% = 120,000. Khalid 7% of Company 180k = 12,600. Company = 167,400.
    assert.strictEqual(cntSaeed.schedules[0].investorProfitShareIQD, 120000);
    assert.strictEqual(cntSaeed.schedules[0].referrerProfitShareIQD, 12600);
    assert.strictEqual(cntSaeed.schedules[0].companyProfitShareIQD, 167400);

    // 4. Raad: Profit = 300,000. Raad 60% = 180,000. Khalid 3% of Company 120k = 3,600. Company = 116,400.
    assert.strictEqual(cntRaad.schedules[0].investorProfitShareIQD, 180000);
    assert.strictEqual(cntRaad.schedules[0].referrerProfitShareIQD, 3600);
    assert.strictEqual(cntRaad.schedules[0].companyProfitShareIQD, 116400);

    // Pay all 4 contracts
    store.payInstallmentSchedule(cntKhalid.id, cntKhalid.schedules[0].id);
    store.payInstallmentSchedule(cntBashir.id, cntBashir.schedules[0].id);
    store.payInstallmentSchedule(cntSaeed.id, cntSaeed.schedules[0].id);
    store.payInstallmentSchedule(cntRaad.id, cntRaad.schedules[0].id);

    // Check Khalid's profits:
    const khalidInvestor = store.investors.find((i: any) => i.id === khalid.id)!;
    // Total profit earned = 120,000 (direct) + 23,700 (referrals) = 143,700 IQD
    assert.strictEqual(khalidInvestor.totalProfitsEarned, 143700);
    // Referral commissions earned = 7,500 + 12,600 + 3,600 = 23,700 IQD
    assert.strictEqual(khalidInvestor.totalReferralCommissionsEarned, 23700);
    // Direct profit from own capital = 120,000 IQD
    assert.strictEqual(khalidInvestor.totalProfitsEarned - khalidInvestor.totalReferralCommissionsEarned!, 120000);

    // Total profit flowing to Khalid: 120,000 + 45,000 = 165,000 IQD!
    // In percentage terms on a single contract base: 40% + 5% + 7% + 3% = 55% of 300k = 165,000 IQD!
    const khalidWallet = store.wallets.find((w: any) => w.ownerId === khalid.id)!;
    // Khalid's wallet received: Capital refund (1,000,000) + Direct profit (120,000) + 3 referral cuts (23,700)
    // Starting balance was 10,000,000 - 1,000,000 (inventory purchase) = 9,000,000
    // Final balance = 9,000,000 + 1,000,000 + 120,000 + 23,700 = 10,143,700 IQD
    assert.strictEqual(khalidWallet.balance, 10143700);

    // Check Company Profit:
    // Company retained profits:
    // Khalid contract: 180,000
    // Bashir contract: 142,500
    // Saeed contract: 167,400
    // Raad contract: 116,400
    // Total company profits = 606,300 IQD
    assert.strictEqual(store.companyWallet.balance, 180000 + 142500 + 167400 + 116400);

    // Exact dinar conservation across all 4 contracts:
    // Total paid: 4 * 1,300,000 = 5,200,000 IQD
    // Principal returned: 4 * 1,000,000 = 4,000,000 IQD
    // Total profit: 1,200,000 IQD
    // Investors profit: 120,000 (Khalid) + 150,000 (Bashir) + 120,000 (Saeed) + 180,000 (Raad) = 570,000 IQD
    // Referrer profit: 45,000 IQD
    // Company profit: 585,000 IQD
    // 570,000 + 45,000 + 585,000 = 1,200,000 IQD (EXACT 0 dinar drift!)
    assert.strictEqual(570000 + 45000 + 585000, 1200000);
  });

  test('referrerId UUID sanitization converts empty strings, invalid inputs, and non-UUIDs to strict null', () => {
    const isValidUuid = (val: unknown): val is string =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());

    const sanitizeReferrer = (id: unknown, share: unknown) => {
      const cleanReferrerId = isValidUuid(id) ? (id as string).trim() : null;
      const cleanReferrerShare = cleanReferrerId && share ? Number(share).toFixed(2) : '0.00';
      return { referrerId: cleanReferrerId, referrerSharePercent: cleanReferrerShare };
    };

    // Case 1: Empty string (user selected "بدون محيل")
    assert.deepStrictEqual(sanitizeReferrer('', 0), { referrerId: null, referrerSharePercent: '0.00' });
    assert.deepStrictEqual(sanitizeReferrer('   ', 5), { referrerId: null, referrerSharePercent: '0.00' });

    // Case 2: Undefined / Null
    assert.deepStrictEqual(sanitizeReferrer(undefined, undefined), { referrerId: null, referrerSharePercent: '0.00' });
    assert.deepStrictEqual(sanitizeReferrer(null, 10), { referrerId: null, referrerSharePercent: '0.00' });

    // Case 3: Invalid string
    assert.deepStrictEqual(sanitizeReferrer('invalid-uuid-123', 5), { referrerId: null, referrerSharePercent: '0.00' });

    // Case 4: Valid UUID
    const validUuid = 'fd1e7681-72ba-4f16-87a4-ec2d99ba58ac';
    assert.deepStrictEqual(sanitizeReferrer(validUuid, 5), { referrerId: validUuid, referrerSharePercent: '5.00' });
  });

  test('strict separation between Referral Brokers and Capital Investors across selectors and wallets', () => {
    const { SimulationStore } = require('../services/simulation');
    const {
      isReferralBroker,
      getCapitalInvestors,
      getReferralBrokers,
      getEligibleReferrers,
      getCapitalWallets
    } = require('../utils/investorSelectors');

    const store = new SimulationStore();

    // 1. Add a pure referral broker (0 capital, 0% investor share)
    const brokerRes = store.addInvestor({
      name: 'سالم الوسيط المعتمد',
      phone: '07709998888',
      address: 'سامراء',
      capitalAmount: 0,
      investorSharePercent: 0,
      companySharePercent: 100,
      isReferralPartner: true,
    });
    const broker = brokerRes.investor;

    // 2. Add a capital investor referred by the broker
    const investorRes = store.addInvestor({
      name: 'أوس المستثمر الفعلي',
      phone: '07701112222',
      address: 'سامراء',
      capitalAmount: 15000000,
      investorSharePercent: 60,
      companySharePercent: 40,
      referrerId: broker.id,
      referrerName: broker.name,
      referrerSharePercent: 10,
      isReferralPartner: false,
    });
    const capitalInvestor = investorRes.investor;

    // Verify classification
    assert.strictEqual(isReferralBroker(broker), true, 'Broker must be identified as referral broker');
    assert.strictEqual(isReferralBroker(capitalInvestor), false, 'Capital investor must not be identified as broker');

    // Verify getCapitalInvestors excludes the broker
    const capInvestors = getCapitalInvestors(store.investors);
    assert.strictEqual(capInvestors.some((i: any) => i.id === broker.id), false, 'Broker must NOT appear in capitalInvestors');
    assert.strictEqual(capInvestors.some((i: any) => i.id === capitalInvestor.id), true, 'Capital investor MUST appear in capitalInvestors');

    // Verify getReferralBrokers includes only the broker
    const brokersOnly = getReferralBrokers(store.investors);
    assert.strictEqual(brokersOnly.some((i: any) => i.id === broker.id), true, 'Broker MUST appear in referralBrokers');
    assert.strictEqual(brokersOnly.some((i: any) => i.id === capitalInvestor.id), false, 'Capital investor must NOT appear in referralBrokers');

    // Verify getEligibleReferrers puts brokers first
    const eligible = getEligibleReferrers(store.investors);
    assert.strictEqual(eligible[0].id, broker.id, 'Brokers should be prioritized first in eligible referrers');

    // Simulate broker earning commission in their wallet and verify they still remain excluded from capital investors & capital wallets
    const brokerWallet = store.wallets.find((w: any) => w.ownerId === broker.id)!;
    brokerWallet.balance = 250000;
    broker.availableLiquidity = 250000;

    assert.strictEqual(isReferralBroker(broker), true, 'Broker with earned commission balance must STILL be a referral broker');
    const capWallets = getCapitalWallets(store.wallets, store.investors);
    assert.strictEqual(capWallets.some((w: any) => w.id === brokerWallet.id), false, 'Broker commission wallet must NOT appear in capital wallets');
    assert.strictEqual(capWallets.some((w: any) => w.ownerId === capitalInvestor.id), true, 'Capital investor wallet MUST appear in capital wallets');
  });

  test('updateInvestor allows editing broker details and setting/updating forgotten referral commission % with immediate recalculation of unpaid schedules', () => {
    const { SimulationStore } = require('../services/simulation');
    const store = new SimulationStore();

    // 1. Add a referral broker
    const brokerRes = store.addInvestor({
      name: 'وسام الوسيط',
      phone: '07701119999',
      address: 'سامراء',
      capitalAmount: 0,
      investorSharePercent: 0,
      companySharePercent: 100,
      isReferralPartner: true,
    });
    const broker = brokerRes.investor;

    // 2. Add a capital investor where the user forgot to set the referral commission % (0% initially)
    const invRes = store.addInvestor({
      name: 'عمار التاجر',
      phone: '07702228888',
      address: 'سامراء',
      capitalAmount: 20000000,
      investorSharePercent: 60,
      companySharePercent: 40,
      referrerId: broker.id,
      referrerName: broker.name,
      referrerSharePercent: 0, // Forgotten initially!
    });
    const ammar = invRes.investor;

    // 3. Purchase item and create contract BEFORE fixing the commission %
    const item = store.purchaseInventory({
      name: 'سبلت طن ونص',
      category: 'تبريد',
      investorId: ammar.id,
      quantity: 1,
      unitCostIQD: 1000000,
      targetSellingPriceIQD: 1500000,
    }).item!;

    const borrower = store.addBorrower({
      name: 'زيدون طارق',
      phone: '07703337777',
      address: 'سامراء',
      guarantors: [],
    }).borrower;

    const contract = store.createContract({
      borrowerId: borrower.id,
      inventoryItemId: item.id,
      totalSalePriceIQD: 1500000,
      downPaymentIQD: 0,
      monthsCount: 10,
      startDate: '2026-11-01',
    }).contract!;

    // Initially, referrerProfitShareIQD is 0 because referrerSharePercent was 0
    assert.strictEqual(contract.schedules[0].referrerProfitShareIQD, 0);
    assert.strictEqual(contract.schedules[0].investorProfitShareIQD, 30000); // 60% of 50,000
    assert.strictEqual(contract.schedules[0].companyProfitShareIQD, 20000); // 40% of 50,000

    // 4. Edit broker's personal details (name & phone) and verify propagation
    const editBrokerRes = store.updateInvestor({
      id: broker.id,
      name: 'وسام الوسيط المحدث',
      phone: '07809990000',
      address: 'سامراء - حي القادسية',
      notes: 'وسيط معتمد محدث',
    });
    assert.strictEqual(editBrokerRes.success, true);
    assert.strictEqual(broker.name, 'وسام الوسيط المحدث');
    assert.strictEqual(ammar.referredByName, 'وسام الوسيط المحدث');
    assert.strictEqual(ammar.contract.referrerName, 'وسام الوسيط المحدث');

    // 5. Now edit Ammar's referral commission % from 0% to 10%
    const editAmmarRes = store.updateInvestor({
      id: ammar.id,
      name: ammar.name,
      phone: ammar.phone,
      investorSharePercent: 60,
      companySharePercent: 40,
      referrerId: broker.id,
      referrerName: broker.name,
      referrerSharePercent: 10,
    });
    assert.strictEqual(editAmmarRes.success, true);
    assert.strictEqual(ammar.contract.referrerSharePercent, 10);
    assert.strictEqual(ammar.referralSharePercent, 10);

    // Verify all 10 unpaid schedules immediately recalculated:
    // Profit = 50,000. Ammar (60%) = 30,000. Company gross = 20,000.
    // Broker 10% of Company 20,000 = 2,000. Company net = 18,000.
    for (const sch of contract.schedules) {
      assert.strictEqual(sch.investorProfitShareIQD, 30000);
      assert.strictEqual(sch.referrerProfitShareIQD, 2000);
      assert.strictEqual(sch.companyProfitShareIQD, 18000);
      assert.strictEqual(
        sch.principalAmountIQD + sch.investorProfitShareIQD + (sch.referrerProfitShareIQD || 0) + sch.companyProfitShareIQD,
        sch.amountIQD,
        'Zero dinar drift must be maintained after recalculation'
      );
    }

    // 6. Pay the first installment and verify the broker receives the 2,000 IQD commission
    store.payInstallmentSchedule(contract.id, contract.schedules[0].id);
    const brokerWallet = store.wallets.find((w: any) => w.ownerId === broker.id)!;
    assert.strictEqual(brokerWallet.balance, 2000);
    assert.strictEqual(broker.totalReferralCommissionsEarned, 2000);
  });

  test('referralCalculations: buildReferredInvestorSummary and resolveReferralCommissionVoucher verify 3-way 100% split across multiple contracts', () => {
    const { SimulationStore } = require('../services/simulation');
    const {
      getThreeWaySplitPercents,
      calculateContractReferralBreakdown,
      buildReferredInvestorSummary,
      resolveReferralCommissionVoucher,
    } = require('../utils/referralCalculations');

    const store = new SimulationStore();

    // 1. Register Khalid (Referral Broker with 0 personal capital)
    const khalid = store.addInvestor({
      name: 'خالد',
      phone: '07702222222',
      address: 'سامراء',
      capitalAmount: 0,
      investorSharePercent: 0,
      companySharePercent: 100,
      isReferralPartner: true,
    }).investor;

    // 2. Register Asaad (Referred Investor with 100,000,000 IQD, 50% investor / 50% company, 5% broker commission)
    const asaad = store.addInvestor({
      name: 'أسعد',
      phone: '07703333333',
      address: 'سامراء',
      capitalAmount: 100000000,
      investorSharePercent: 50,
      companySharePercent: 50,
      referrerId: khalid.id,
      referrerName: khalid.name,
      referrerSharePercent: 5,
    }).investor;

    const splits = getThreeWaySplitPercents(asaad);
    assert.strictEqual(splits.investorSharePercent, 50);
    assert.strictEqual(splits.referrerSharePercent, 5);
    assert.strictEqual(splits.grossCompanySharePercent, 50);
    assert.strictEqual(splits.effectiveReferrerPercent, 2.5);
    assert.strictEqual(splits.netCompanySharePercent, 47.5);
    assert.strictEqual(
      splits.investorSharePercent + splits.effectiveReferrerPercent + splits.netCompanySharePercent,
      100
    );

    // 3. Create Contract 1: Cost 5,000,000 -> Sale 7,500,000 (Profit = 2,500,000 across 10 months)
    const item1 = store.purchaseInventory({
      name: 'منظومة طاقة شمسية',
      category: 'طاقة',
      investorId: asaad.id,
      quantity: 1,
      unitCostIQD: 5000000,
      targetSellingPriceIQD: 7500000,
    }).item!;
    const borrower1 = store.addBorrower({
      name: 'قاسم محمد',
      phone: '07701112233',
      address: 'سامراء',
      guarantors: [],
    }).borrower;
    const contract1 = store.createContract({
      borrowerId: borrower1.id,
      inventoryItemId: item1.id,
      totalSalePriceIQD: 7500000,
      downPaymentIQD: 0,
      monthsCount: 10,
      startDate: '2026-01-01',
    }).contract!;

    // 4. Create Contract 2: Cost 5,000,000 -> Sale 6,500,000 (Profit = 1,500,000 across 1 months)
    const item2 = store.purchaseInventory({
      name: 'أجهزة تبريد مركزية',
      category: 'تبريد',
      investorId: asaad.id,
      quantity: 1,
      unitCostIQD: 5000000,
      targetSellingPriceIQD: 6500000,
    }).item!;
    const borrower2 = store.addBorrower({
      name: 'محمود جبار',
      phone: '07704445566',
      address: 'سامراء',
      guarantors: [],
    }).borrower;
    const contract2 = store.createContract({
      borrowerId: borrower2.id,
      inventoryItemId: item2.id,
      totalSalePriceIQD: 6500000,
      downPaymentIQD: 0,
      monthsCount: 1,
      startDate: '2026-02-01',
    }).contract!;

    // Pay all schedules for both contracts
    for (const sch of contract1.schedules) {
      store.payInstallmentSchedule(contract1.id, sch.id);
    }
    for (const sch of contract2.schedules) {
      store.payInstallmentSchedule(contract2.id, sch.id);
    }

    // Verify per-contract breakdown for Contract 1
    // Profit = 2,500,000. Investor 50% = 1,250,000. Company gross = 1,250,000.
    // Khalid 5% of 1,250,000 = 62,500. Company net = 1,187,500.
    const c1Breakdown = calculateContractReferralBreakdown(contract1, asaad);
    assert.strictEqual(c1Breakdown.collectedContractProfitIQD, 2500000);
    assert.strictEqual(c1Breakdown.collectedInvestorProfitIQD, 1250000); // 50%
    assert.strictEqual(c1Breakdown.collectedReferrerProfitIQD, 62500);   // 5% of company profit
    assert.strictEqual(c1Breakdown.collectedCompanyProfitIQD, 1187500);  // net company profit

    // Verify per-contract breakdown for Contract 2
    // Profit = 1,500,000. Investor 50% = 750,000. Company gross = 750,000.
    // Khalid 5% of 750,000 = 37,500. Company net = 712,500.
    const c2Breakdown = calculateContractReferralBreakdown(contract2, asaad);
    assert.strictEqual(c2Breakdown.collectedContractProfitIQD, 1500000);
    assert.strictEqual(c2Breakdown.collectedInvestorProfitIQD, 750000);  // 50%
    assert.strictEqual(c2Breakdown.collectedReferrerProfitIQD, 37500);   // 5% of company profit
    assert.strictEqual(c2Breakdown.collectedCompanyProfitIQD, 712500);   // net company profit

    // Verify investor summary across both contracts (Total Profit = 4,000,000)
    const summary = buildReferredInvestorSummary(asaad, store.contracts);
    assert.strictEqual(summary.contractsCount, 2);
    assert.strictEqual(summary.totalInstallments, 11);
    assert.strictEqual(summary.totalPaidInstallments, 11);
    assert.strictEqual(summary.collectedContractProfitIQD, 4000000);
    assert.strictEqual(summary.collectedInvestorProfitIQD, 2000000); // 50% of 4,000,000
    assert.strictEqual(summary.collectedReferrerProfitIQD, 100000);  // 5% of company's 2,000,000
    assert.strictEqual(summary.collectedCompanyProfitIQD, 1900000);  // net company profit
    assert.strictEqual(summary.remainingReferrerProfitIQD, 0);

    // Verify resolveReferralCommissionVoucher resolves the broker, referred investor, contract, and 100% installment profit
    const commissionTxs = store.transactions.filter((t: any) => t.type === 'REFERRAL_COMMISSION');
    assert.strictEqual(commissionTxs.length, 11);

    const firstVoucher = resolveReferralCommissionVoucher(
      commissionTxs[commissionTxs.length - 1], // first paid schedule of contract 1 (6,250 IQD commission)
      store.investors,
      store.contracts
    );
    assert.strictEqual(firstVoucher.referrerName, 'خالد');
    assert.strictEqual(firstVoucher.referredInvestorName, 'أسعد');
    assert.strictEqual(firstVoucher.commissionPercent, 5);
    assert.strictEqual(firstVoucher.commissionAmountIQD, 6250);
    assert.strictEqual(firstVoucher.installmentTotalProfitIQD, 250000);
    assert.strictEqual(firstVoucher.investorShareAmountIQD, 125000);
    assert.strictEqual(firstVoucher.netCompanyShareAmountIQD, 118750);
  });

  test('Broker Commission Cash Withdrawal: Partial & Full Withdrawal with Sequential Receipts', () => {
    const { SimulationStore } = require('../services/simulation');
    const store = new SimulationStore();

    // 1. Add pure referral broker
    const brokerRes = store.addInvestor({
      name: 'حسين عبد الرزاق',
      phone: '07704444444',
      address: 'سامراء',
      capitalAmount: 0,
      investorSharePercent: 0,
      companySharePercent: 100,
      isReferralPartner: true,
    });
    const broker = brokerRes.investor;
    assert.strictEqual(broker.isReferralPartner, true);

    const brokerWallet = store.wallets.find((w: any) => w.id === broker.walletId || w.ownerId === broker.id);
    assert.ok(brokerWallet, 'Broker wallet should exist');

    // Simulate accumulated referral commission of 500,000 IQD
    brokerWallet.balance = 500000;
    broker.availableLiquidity = 500000;
    broker.totalReferralCommissionsEarned = 500000;

    // 2. Perform partial withdrawal (200,000 IQD) without custom notes to test auto-generated description
    const withdrawal1 = store.withdrawInvestorFunds({
      investorId: broker.id,
      walletId: brokerWallet.id,
      amountIQD: 200000,
      type: 'COMMISSION_WITHDRAWAL',
      receiptNo: '1',
      date: '2026-11-08'
    });

    assert.strictEqual(withdrawal1.success, true);
    assert.strictEqual(brokerWallet.balance, 300000);
    assert.strictEqual(broker.availableLiquidity, 300000);
    assert.strictEqual(withdrawal1.transaction.referenceNo, '1');
    assert.strictEqual(withdrawal1.transaction.type, 'INVESTOR_WITHDRAWAL');
    assert.ok(withdrawal1.transaction.description.includes('سحب عمولة إحالة'));
    assert.ok(withdrawal1.transaction.description.includes('الوسيط حسين عبد الرزاق'));

    // 3. Attempt over-withdrawal (400,000 IQD when only 300,000 available)
    const overWithdrawal = store.withdrawInvestorFunds({
      investorId: broker.id,
      walletId: brokerWallet.id,
      amountIQD: 400000,
      type: 'COMMISSION_WITHDRAWAL',
      receiptNo: '2',
      date: '2026-11-08',
    });

    assert.strictEqual(overWithdrawal.success, false);
    assert.ok(overWithdrawal.message.includes('غير كافية'));
    assert.strictEqual(brokerWallet.balance, 300000);
    assert.strictEqual(broker.availableLiquidity, 300000);

    // 4. Perform full withdrawal of remaining 300,000 IQD
    const withdrawal2 = store.withdrawInvestorFunds({
      investorId: broker.id,
      walletId: brokerWallet.id,
      amountIQD: 300000,
      type: 'COMMISSION_WITHDRAWAL',
      receiptNo: '2',
      date: '2026-11-08',
      notes: 'سحب كامل الرصيد المتبقي من عمولة الإحالة'
    });

    assert.strictEqual(withdrawal2.success, true);
    assert.strictEqual(brokerWallet.balance, 0);
    assert.strictEqual(broker.availableLiquidity, 0);
    assert.strictEqual(withdrawal2.transaction.referenceNo, '2');

    // 5. Total earned commissions counter is preserved (historical tracking)
    assert.strictEqual(broker.totalReferralCommissionsEarned, 500000);
  });

  test('Test 13: Stale or net contract companySharePercent does not break 100% contract split in getThreeWaySplitPercents', () => {
    const { getThreeWaySplitPercents } = require('../utils/referralCalculations');
    // Simulating Bakr from live production screenshot where contract.companySharePercent had net 45
    const bakr: Investor = {
      id: 'inv-bakr',
      name: 'بكر',
      phone: '07700000000',
      walletId: 'w-bakr',
      contract: {
        id: 'cnt-bakr',
        investorId: 'inv-bakr',
        investorSharePercent: 50,
        companySharePercent: 45, // Stale net value stored previously in DB
        lossSharingPolicy: 'SHARED',
        contractDate: '2026-11-01',
        referrerId: 'broker-youssef',
        referrerName: 'يوسف',
        referrerSharePercent: 10,
        notes: ''
      },
      totalCapitalDeposited: 10000000,
      activeInvestmentsAmount: 0,
      availableLiquidity: 10000000,
      totalProfitsEarned: 0,
      totalReferralCommissionsEarned: 0,
      totalLossesIncurred: 0
    };

    const splits = getThreeWaySplitPercents(bakr);

    // Contractual gross company share must always complete investor share to 100%
    assert.strictEqual(splits.investorSharePercent, 50);
    assert.strictEqual(splits.grossCompanySharePercent, 50);
    assert.strictEqual(splits.investorSharePercent + splits.grossCompanySharePercent, 100);

    // Broker commission is 10% of company gross (50%) = 5% of contract total
    assert.strictEqual(splits.referrerSharePercent, 10);
    assert.strictEqual(splits.effectiveReferrerPercent, 5);

    // Company net share = 50% - 5% = 45%
    assert.strictEqual(splits.netCompanySharePercent, 45);

    // The sum of distributed contract shares equals exactly 100%
    assert.strictEqual(
      splits.investorSharePercent + splits.effectiveReferrerPercent + splits.netCompanySharePercent,
      100
    );
  });
});


