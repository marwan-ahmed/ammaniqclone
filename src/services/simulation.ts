// Financial Accounting Engine & Simulation Service for Company S (Samarra, Iraq)
// Enforces "Every Dinar Has a Known Owner" (Dedicated Investor Wallets & Profit Split)

import {
  Investor,
  InvestorContract,
  Wallet,
  InventoryItem,
  Borrower,
  InstallmentContract,
  InstallmentScheduleItem,
  LedgerTransaction,
  ExpenseItem,
  RevenueItem,
  Employee,
  TrashItem,
  TrashEntityType,
  SYSTEM_PERMISSIONS
} from '@/types/finance';
import { getNextInvestorWithdrawalReceiptNumber } from '@/utils/receiptNumbering';
import { CompanyReportProfile, DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';

export class SimulationStore {
  public companyWallet: Wallet;
  public investors: Investor[];
  public wallets: Wallet[];
  public inventory: InventoryItem[];
  public borrowers: Borrower[];
  public contracts: InstallmentContract[];
  public directDebts: InstallmentContract[];
  public transactions: LedgerTransaction[];
  public expenses: ExpenseItem[];
  public revenues: RevenueItem[];
  public employees: Employee[];
  public trashItems: TrashItem[];
  public adminPasscode: string;
  public privacyPasscode: string;
  public privacyAutoHideSeconds: number;
  public numberingResetEpoch: string | null;
  public companyProfile: CompanyReportProfile;

  constructor() {
    this.adminPasscode = '2026';
    this.privacyPasscode = '2026';
    this.privacyAutoHideSeconds = 30;
    this.numberingResetEpoch = null;
    this.companyProfile = { ...DEFAULT_COMPANY_REPORT_PROFILE };
    if (typeof window !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
        if (typeof cache.privacyAutoHideSeconds === 'number') {
          this.privacyAutoHideSeconds = cache.privacyAutoHideSeconds;
        }
        if (cache.privacyPasscode) {
          this.privacyPasscode = String(cache.privacyPasscode);
        }
        if (cache.adminPasscode) {
          this.adminPasscode = String(cache.adminPasscode);
        }
        if (cache.numberingResetEpoch) {
          this.numberingResetEpoch = String(cache.numberingResetEpoch);
        }
        if (cache.companyProfile && typeof cache.companyProfile === 'object') {
          this.companyProfile = { ...this.companyProfile, ...cache.companyProfile };
        }
      } catch {}
    }
    // 1. Company Wallet (صندوق الشركة الرئيسي)
    this.companyWallet = {
      id: 'wallet-company',
      ownerType: 'COMPANY',
      ownerId: 'company-s',
      ownerName: 'صندوق نظام أمان للتقسيط الرئيسي',
      balance: 0,
      totalAssetsValuation: 0,
      totalDebtsValuation: 0,
      currency: 'IQD',
      updatedAt: new Date().toISOString()
    };

    this.investors = [];
    this.wallets = [this.companyWallet];
    this.inventory = [];
    this.borrowers = [];
    this.contracts = [];
    this.directDebts = [];
    this.transactions = [];
    this.expenses = [];
    this.revenues = [];
    this.trashItems = [];

    // 10. Employees (System Admin)
    this.employees = [
      {
        id: 'emp-1',
        name: 'أحمد إياد',
        role: 'مدير النظام',
        phone: '07705554433',
        email: 'ahmed.ayad@ajeebiq.com',
        nationalId: 'IQ-10029384',
        salaryIQD: 1500000,
        status: 'نشط',
        joinedDate: '2025-11-01',
        permissions: SYSTEM_PERMISSIONS.map(p => p.id),
        notes: 'المدير العام المالك وصاحب الصلاحيات الشاملة المطلقة للنظام'
      }
    ];
  }

  // Helper method to keep all transactions sorted in reverse chronological order (newest date first)
  public sortTransactions(): void {
    this.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Method to process a repayment for a specific installment schedule (supports full and partial payments with rollover)
  public payInstallmentSchedule(
    contractId: string,
    scheduleId: string,
    customPaidAmountIQD?: number,
    paymentDate?: string
  ): { success: boolean; message: string } {
    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) return { success: false, message: 'عقد التقسيط غير موجود' };

    const schedule = contract.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return { success: false, message: 'القسط غير موجود' };
    if (schedule.status === 'PAID') return { success: false, message: 'القسط مدفوع سابقاً' };

    const isCompanyContract =
      contract.investorId === 'wallet-company' ||
      contract.investorId === 'company-s' ||
      contract.investorId === 'COMPANY' ||
      contract.investorId === 'COMPANY_MAIN' ||
      contract.investorId === this.companyWallet.id ||
      contract.investorName === this.companyWallet.ownerName;

    const investor = isCompanyContract ? undefined : this.investors.find((i) => i.id === contract.investorId);
    if (!isCompanyContract && !investor) return { success: false, message: 'المستثمر الممول غير موجود' };

    const investorWallet = isCompanyContract
      ? this.companyWallet
      : this.wallets.find((w) => w.id === investor?.walletId);
    if (!investorWallet) return { success: false, message: isCompanyContract ? 'صندوق الشركة غير موجود' : 'صندوق المستثمر غير موجود' };

    if (typeof customPaidAmountIQD === 'number' && customPaidAmountIQD <= 0) {
      return { success: false, message: 'يرجى إدخال مبلغ سداد صحيح بالدينار العراقي أكبر من صفر' };
    }

    // Eligible unpaid schedules starting from this schedule onwards
    const eligibleSchedules = contract.schedules
      .filter((s) => s.status !== 'PAID' && s.installmentNumber >= schedule.installmentNumber)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);

    const totalPayableDebt = eligibleSchedules.reduce((acc, s) => acc + s.amountIQD, 0);
    if (typeof customPaidAmountIQD === 'number' && customPaidAmountIQD > totalPayableDebt) {
      return {
        success: false,
        message: `المبلغ المدخل (${customPaidAmountIQD.toLocaleString('en-US')} د.ع) يتجاوز إجمالي الأقساط المتبقية على العقد (${totalPayableDebt.toLocaleString('en-US')} د.ع)`
      };
    }

    let remainingToApply = typeof customPaidAmountIQD === 'number' ? customPaidAmountIQD : schedule.amountIQD;
    const todayStr = paymentDate || new Date().toISOString().split('T')[0];
    const fullyPaidList: { num: number; amount: number }[] = [];
    let partialInfo: { num: number; paid: number; remDiff: number } | null = null;
    let totalActuallyPaid = 0;

    for (const sch of eligibleSchedules) {
      if (remainingToApply <= 0) break;

      const schOriginalAmount = sch.amountIQD;
      const isLastChunk = remainingToApply < schOriginalAmount;
      const paidForSch = isLastChunk ? remainingToApply : schOriginalAmount;
      const remainingDifference = schOriginalAmount - paidForSch;

      let paidPrincipal: number;
      let paidInvestorProfit: number;
      let paidReferrerProfit: number;
      let paidCompanyProfit: number;
      let paidProfit: number;

      let remainingPrincipal: number;
      let remainingInvestorProfit: number;
      let remainingReferrerProfit: number;
      let remainingCompanyProfit: number;
      let remainingProfit: number;

      if (!isLastChunk) {
        paidPrincipal = sch.principalAmountIQD;
        paidInvestorProfit = sch.investorProfitShareIQD;
        paidReferrerProfit = sch.referrerProfitShareIQD || 0;
        paidCompanyProfit = sch.companyProfitShareIQD;
        paidProfit = sch.profitAmountIQD;

        remainingPrincipal = 0;
        remainingInvestorProfit = 0;
        remainingReferrerProfit = 0;
        remainingCompanyProfit = 0;
        remainingProfit = 0;
      } else {
        const ratio = schOriginalAmount > 0 ? (paidForSch / schOriginalAmount) : 1;
        paidPrincipal = Math.min(sch.principalAmountIQD, Math.round(sch.principalAmountIQD * ratio));
        paidInvestorProfit = Math.min(sch.investorProfitShareIQD, Math.round(sch.investorProfitShareIQD * ratio));
        const originalRef = sch.referrerProfitShareIQD || 0;
        paidReferrerProfit = Math.min(originalRef, Math.round(originalRef * ratio));
        paidCompanyProfit = Math.max(0, paidForSch - paidPrincipal - paidInvestorProfit - paidReferrerProfit);
        paidProfit = paidInvestorProfit + paidReferrerProfit + paidCompanyProfit;

        remainingPrincipal = sch.principalAmountIQD - paidPrincipal;
        remainingInvestorProfit = sch.investorProfitShareIQD - paidInvestorProfit;
        remainingReferrerProfit = originalRef - paidReferrerProfit;
        remainingCompanyProfit = sch.companyProfitShareIQD - paidCompanyProfit;
        remainingProfit = remainingInvestorProfit + remainingReferrerProfit + remainingCompanyProfit;
      }

      // If partial payment, carry over to subsequent installment
      if (isLastChunk && remainingDifference > 0) {
        const nextSchedule = contract.schedules.find((s) => s.installmentNumber === sch.installmentNumber + 1)
          || contract.schedules.find((s) => s.status !== 'PAID' && s.id !== sch.id);

        if (nextSchedule) {
          const nextOriginalAmount = nextSchedule.amountIQD;
          nextSchedule.amountIQD += remainingDifference;
          nextSchedule.principalAmountIQD += remainingPrincipal;
          nextSchedule.profitAmountIQD += remainingProfit;
          nextSchedule.investorProfitShareIQD += remainingInvestorProfit;
          nextSchedule.referrerProfitShareIQD = (nextSchedule.referrerProfitShareIQD || 0) + remainingReferrerProfit;
          nextSchedule.companyProfitShareIQD += remainingCompanyProfit;

          const nextNote = `القسط الأصلي: ${nextOriginalAmount.toLocaleString('en-US')} د.ع، والمتبقي ${remainingDifference.toLocaleString('en-US')} د.ع هو عن الدفعة السابقة (قسط شهر ${sch.installmentNumber})`;
          nextSchedule.notes = nextSchedule.notes ? `${nextSchedule.notes} | ${nextNote}` : nextNote;
        } else {
          // This was the final installment: create an extra installment so the remaining balance is scheduled
          const nextNumber = sch.installmentNumber + 1;
          const nextDueDateObj = new Date(sch.dueDate);
          nextDueDateObj.setMonth(nextDueDateObj.getMonth() + 1);
          const nextDueDateStr = nextDueDateObj.toISOString().split('T')[0];

          contract.schedules.push({
            id: `sch-${contract.id}-${nextNumber}`,
            contractId: contract.id,
            installmentNumber: nextNumber,
            dueDate: nextDueDateStr,
            amountIQD: remainingDifference,
            principalAmountIQD: remainingPrincipal,
            profitAmountIQD: remainingProfit,
            investorProfitShareIQD: remainingInvestorProfit,
            referrerProfitShareIQD: remainingReferrerProfit,
            companyProfitShareIQD: remainingCompanyProfit,
            status: 'PENDING',
            notes: `المتبقي ${remainingDifference.toLocaleString('en-US')} د.ع هو عن الدفعة السابقة (قسط شهر ${sch.installmentNumber})`
          });
          contract.monthsCount = contract.schedules.length;
          contract.endDate = nextDueDateStr;
        }

        const noteText = sch.id !== schedule.id
          ? `تم سداد ${paidForSch.toLocaleString('en-US')} د.ع جزئياً من أصل ${schOriginalAmount.toLocaleString('en-US')} د.ع (من فائض سداد قسط شهر ${schedule.installmentNumber})، وترحيل المتبقي (${remainingDifference.toLocaleString('en-US')} د.ع) إلى القسط اللاحق`
          : `تم سداد ${paidForSch.toLocaleString('en-US')} د.ع جزئياً من أصل ${schOriginalAmount.toLocaleString('en-US')} د.ع، وترحيل المتبقي (${remainingDifference.toLocaleString('en-US')} د.ع) إلى القسط اللاحق`;
        sch.notes = sch.notes ? `${sch.notes} | ${noteText}` : noteText;
        partialInfo = { num: sch.installmentNumber, paid: paidForSch, remDiff: remainingDifference };
      } else {
        if (sch.id !== schedule.id) {
          const cascadeNote = `تم سداد القسط بالكامل من فائض سداد قسط شهر ${schedule.installmentNumber}`;
          sch.notes = sch.notes ? `${sch.notes} | ${cascadeNote}` : cascadeNote;
        }
        fullyPaidList.push({ num: sch.installmentNumber, amount: paidForSch });
      }

      // Update Schedule status & values
      sch.status = 'PAID';
      sch.paidDate = todayStr;
      sch.amountIQD = paidForSch;
      sch.principalAmountIQD = paidPrincipal;
      sch.profitAmountIQD = paidProfit;
      sch.investorProfitShareIQD = paidInvestorProfit;
      sch.referrerProfitShareIQD = paidReferrerProfit;
      sch.companyProfitShareIQD = paidCompanyProfit;

      // Assign sequential integer receipt number relative to manual reset epoch
      if (!sch.receiptNumber) {
        const epochTime = this.numberingResetEpoch && !isNaN(Date.parse(this.numberingResetEpoch))
          ? new Date(this.numberingResetEpoch).getTime()
          : 0;

        let maxReceipt = 0;
        for (const c of this.contracts) {
          for (const s of c.schedules) {
            if (s.receiptNumber) {
              const pTime = s.paidDate && !isNaN(Date.parse(s.paidDate)) ? new Date(s.paidDate).getTime() : 0;
              if (pTime >= epochTime) {
                const num = parseInt(String(s.receiptNumber).replace(/\D/g, ''), 10);
                if (!isNaN(num) && num > maxReceipt) maxReceipt = num;
              }
            }
          }
        }
        for (const d of this.directDebts) {
          for (const s of d.schedules) {
            if (s.receiptNumber) {
              const pTime = s.paidDate && !isNaN(Date.parse(s.paidDate)) ? new Date(s.paidDate).getTime() : 0;
              if (pTime >= epochTime) {
                const num = parseInt(String(s.receiptNumber).replace(/\D/g, ''), 10);
                if (!isNaN(num) && num > maxReceipt) maxReceipt = num;
              }
            }
          }
        }
        sch.receiptNumber = maxReceipt + 1;
      }

      if (isCompanyContract) {
        // Contract is company-owned: 100% of money flows to Company Wallet
        this.companyWallet.balance += paidForSch;
        this.companyWallet.totalDebtsValuation = Math.max(0, this.companyWallet.totalDebtsValuation - paidPrincipal);
        this.companyWallet.updatedAt = new Date().toISOString();
      } else {
        // Money flows to Investor Wallet (رأس المال + حصة المستثمر من الربح)
        const amountForInvestorWallet = paidPrincipal + paidInvestorProfit;
        investorWallet.balance += amountForInvestorWallet;
        if (investor) {
          investor.availableLiquidity += amountForInvestorWallet;
          investor.totalProfitsEarned += paidInvestorProfit;
        }

        // Money flows to Company Wallet (حصة الشركة من الربح بعد اقتطاع عمولة الإحالة)
        this.companyWallet.balance += paidCompanyProfit;

        // If there is referral profit, credit Referrer Wallet and record Referral Commission Transaction
        if (paidReferrerProfit > 0 && investor?.contract?.referrerId) {
          const refId = investor.contract.referrerId;
          const refWallet = this.wallets.find(w => w.ownerId === refId);
          if (refWallet) {
            refWallet.balance += paidReferrerProfit;
            refWallet.updatedAt = new Date().toISOString();
          }
          const referrer = this.investors.find(inv => inv.id === refId);
          if (referrer) {
            referrer.totalProfitsEarned += paidReferrerProfit;
            referrer.totalReferralCommissionsEarned = (referrer.totalReferralCommissionsEarned || 0) + paidReferrerProfit;
            referrer.availableLiquidity += paidReferrerProfit;
          }

          const refTx: LedgerTransaction = {
            id: `tx-ref-${contract.borrowerId}-${sch.installmentNumber}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            referenceNo: `REF-2026-${sch.receiptNumber || sch.installmentNumber}`,
            date: todayStr,
            type: 'REFERRAL_COMMISSION',
            investorId: refId,
            investorName: referrer?.name || investor.contract.referrerName || 'المُحيل',
            borrowerId: contract.borrowerId,
            borrowerName: contract.borrowerName,
            fromWalletId: this.companyWallet.id,
            fromWalletName: this.companyWallet.ownerName,
            toWalletId: refWallet?.id || `wallet-${refId}`,
            toWalletName: referrer?.name || 'المُحيل',
            amountIQD: paidReferrerProfit,
            investorProfitShareIQD: paidReferrerProfit,
            companyProfitShareIQD: 0,
            description: `عمولة إحالة مستحقة للمُحيل ${referrer?.name || investor.contract.referrerName} بنسبة (${investor.contract.referrerSharePercent}%) عن سداد قسط المستثمر ${investor.name} بقيمة ${paidReferrerProfit.toLocaleString('en-US')} د.ع مقتطعة من أرباح الشركة`
          };
          this.transactions.unshift(refTx);
        }
      }

      // Add Ledger Transaction record
      const newTx: LedgerTransaction = {
        id: `tx-${contract.borrowerId}-${sch.installmentNumber}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        referenceNo: `PAY-2026-30${sch.installmentNumber}`,
        date: todayStr,
        type: 'PAYMENT_RECEIVED',
        investorId: isCompanyContract ? this.companyWallet.id : investor?.id,
        investorName: isCompanyContract ? this.companyWallet.ownerName : investor?.name,
        borrowerId: contract.borrowerId,
        borrowerName: contract.borrowerName,
        fromWalletId: `wallet-borrower-${contract.borrowerId}`,
        fromWalletName: contract.borrowerName,
        toWalletId: isCompanyContract ? this.companyWallet.id : investorWallet.id,
        toWalletName: isCompanyContract ? this.companyWallet.ownerName : investorWallet.ownerName,
        amountIQD: paidForSch,
        investorProfitShareIQD: isCompanyContract ? 0 : paidInvestorProfit,
        referrerId: (!isCompanyContract && investor?.contract?.referrerId) ? investor.contract.referrerId : undefined,
        referrerProfitShareIQD: paidReferrerProfit > 0 ? paidReferrerProfit : undefined,
        companyProfitShareIQD: isCompanyContract ? paidProfit : paidCompanyProfit,
        description: isCompanyContract
          ? (isLastChunk
              ? `تم سداد قسط جزئي بقيمة ${paidForSch.toLocaleString('en-US')} د.ع (وترحيل المتبقي ${remainingDifference.toLocaleString('en-US')} د.ع للقسط اللاحق) لحساب ${this.companyWallet.ownerName}`
              : `تم سداد القسط رقم ${sch.installmentNumber} بقيمة ${paidForSch.toLocaleString('en-US')} د.ع وتغذية ${this.companyWallet.ownerName} بكامل المبلغ (أصل + ربح)`)
          : (isLastChunk
              ? `تم سداد قسط جزئي بقيمة ${paidForSch.toLocaleString('en-US')} د.ع (وترحيل المتبقي ${remainingDifference.toLocaleString('en-US')} د.ع للقسط اللاحق) للمستثمر ${investor!.name}`
              : `تم سداد القسط رقم ${sch.installmentNumber} بقيمة ${paidForSch.toLocaleString('en-US')} د.ع للمستثمر ${investor!.name} وتقسيم الربح (${paidInvestorProfit.toLocaleString('en-US')} د.ع للمستثمر ${paidReferrerProfit > 0 ? `/ ${paidReferrerProfit.toLocaleString('en-US')} د.ع إحالة ` : ''}/ ${paidCompanyProfit.toLocaleString('en-US')} د.ع للشركة)`)
      };

      this.transactions.unshift(newTx);

      remainingToApply -= paidForSch;
      totalActuallyPaid += paidForSch;
    }

    this.sortTransactions();

    // Check if entire contract is fully settled
    const allPaid = contract.schedules.every((s) => s.status === 'PAID');
    if (allPaid) {
      contract.status = 'COMPLETED';
    }

    // Update Borrower repayment counters and status
    const borrower = this.borrowers.find((b) => b.id === contract.borrowerId);
    if (borrower) {
      borrower.totalRepaidIQD += totalActuallyPaid;
      borrower.remainingDebtIQD -= totalActuallyPaid;
      if (borrower.remainingDebtIQD <= 0) {
        borrower.remainingDebtIQD = 0;
        borrower.status = 'SETTLED';
      } else {
        borrower.status = 'ACTIVE';
      }
    }

    let returnMessage = '';
    const totalCount = fullyPaidList.length + (partialInfo ? 1 : 0);
    if (totalCount > 1) {
      if (partialInfo) {
        returnMessage = `تم سداد ${totalActuallyPaid.toLocaleString('en-US')} د.ع بنجاح: تسديد كامل لـ (${fullyPaidList.length}) أقساط وتسديد جزئي بقيمة ${partialInfo.paid.toLocaleString('en-US')} د.ع لقسط شهر ${partialInfo.num} مع ترحيل ${partialInfo.remDiff.toLocaleString('en-US')} د.ع`;
      } else {
        returnMessage = `تم سداد ${totalActuallyPaid.toLocaleString('en-US')} د.ع بنجاح وتسديد (${fullyPaidList.length}) أقساط بالكامل`;
      }
    } else if (partialInfo) {
      returnMessage = `تم سداد ${totalActuallyPaid.toLocaleString('en-US')} د.ع جزئياً وترحيل المتبقي ${partialInfo.remDiff.toLocaleString('en-US')} د.ع للقسط اللاحق بنجاح`;
    } else {
      returnMessage = `تم تسديد القسط بنجاح وتغذية ${isCompanyContract ? this.companyWallet.ownerName : `صندوق المستثمر ${investor!.name}`}`;
    }

    return {
      success: true,
      message: returnMessage
    };
  }

  // Method to register a new investor and setup dedicated wallet & contract
  public addInvestor(data: {
    name: string;
    phone: string;
    address?: string;
    nationalId?: string;
    capitalAmount: number;
    investorSharePercent: number;
    companySharePercent: number;
    notes?: string;
    date?: string;
    referrerId?: string;
    referrerName?: string;
    referrerSharePercent?: number;
    isReferralPartner?: boolean;
  }): { success: boolean; message: string; investor: Investor } {
    const investorId = `investor-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const walletId = `wallet-${investorId}`;
    const invDate = data.date || new Date().toISOString().split('T')[0];

    const newContract: InvestorContract = {
      id: `contract-${investorId}`,
      investorId,
      investorSharePercent: data.investorSharePercent,
      companySharePercent: data.companySharePercent,
      lossSharingPolicy: 'SHARED',
      contractDate: invDate,
      notes: data.notes || 'عقد محفظة سرية ومستقلة حسب الأصول',
      referrerId: data.referrerId,
      referrerName: data.referrerName,
      referrerSharePercent: data.referrerSharePercent || 0,
    };

    const newInvestor: Investor = {
      id: investorId,
      name: data.name,
      phone: data.phone,
      address: data.address || '',
      nationalId: data.nationalId || `IQ-${Math.floor(10000000 + Math.random() * 90000000)}`,
      walletId,
      contract: newContract,
      totalCapitalDeposited: data.capitalAmount,
      activeInvestmentsAmount: 0,
      availableLiquidity: data.capitalAmount,
      totalProfitsEarned: 0,
      totalLossesIncurred: 0,
      createdAt: invDate,
      isReferralPartner: Boolean(data.isReferralPartner),
      referredById: data.referrerId,
      referredByName: data.referrerName,
      referralSharePercent: data.referrerSharePercent || 0,
      totalReferralCommissionsEarned: 0
    };

    const newWallet: Wallet = {
      id: walletId,
      ownerType: 'INVESTOR',
      ownerId: investorId,
      ownerName: `صندوق المستثمر ${data.name}`,
      balance: data.capitalAmount,
      totalAssetsValuation: 0,
      totalDebtsValuation: 0,
      currency: 'IQD',
      updatedAt: new Date().toISOString()
    };

    this.investors.push(newInvestor);
    this.wallets.push(newWallet);

    if (data.capitalAmount > 0) {
      const initTx: LedgerTransaction = {
        id: `tx-dep-init-${Date.now()}`,
        referenceNo: `DEP-${Math.floor(1000 + Math.random() * 9000)}`,
        date: invDate,
        type: 'DEPOSIT',
        investorId,
        investorName: data.name,
        fromWalletId: 'external',
        fromWalletName: 'رأس مال تأسيسي أولي',
        toWalletId: walletId,
        toWalletName: newWallet.ownerName,
        amountIQD: data.capitalAmount,
        description: `إيداع رأس مال تأسيسي للمستثمر ${data.name}`
      };
      this.transactions.unshift(initTx);
      this.sortTransactions();
    }

    return {
      success: true,
      message: `تم إضافة المستثمر ${data.name} وإنشاء محفظة بقيمة ${data.capitalAmount.toLocaleString('en-US')} د.ع بنجاح`,
      investor: newInvestor
    };
  }

  // Method to edit an existing investor or referral broker's data and referral commission
  public updateInvestor(data: {
    id: string;
    name: string;
    phone: string;
    address?: string;
    nationalId?: string;
    investorSharePercent?: number;
    companySharePercent?: number;
    referrerId?: string;
    referrerName?: string;
    referrerSharePercent?: number;
    notes?: string;
  }): { success: boolean; message: string; investor?: Investor } {
    const investor = this.investors.find((i) => i.id === data.id);
    if (!investor) {
      return { success: false, message: 'المستثمر أو الوسيط غير موجود بالسيستم' };
    }
    if (!data.name || !data.name.trim() || !data.phone || !data.phone.trim()) {
      return { success: false, message: 'الاسم ورقم الهاتف حقول مطلوبة' };
    }

    const cleanName = data.name.trim();
    const cleanPhone = data.phone.trim();

    investor.name = cleanName;
    investor.phone = cleanPhone;
    if (data.address !== undefined) investor.address = data.address.trim();
    if (data.nationalId !== undefined && data.nationalId.trim()) investor.nationalId = data.nationalId.trim();

    if (data.investorSharePercent !== undefined) {
      const invPct = Math.max(0, Math.min(100, Number(data.investorSharePercent)));
      investor.contract.investorSharePercent = invPct;
      investor.contract.companySharePercent =
        data.companySharePercent !== undefined
          ? Math.max(0, Math.min(100, Number(data.companySharePercent)))
          : Math.max(0, 100 - invPct);
    }

    if (data.notes !== undefined) {
      investor.contract.notes = data.notes.trim();
    }

    // Update referral assignment & commission percentage
    if (data.referrerId !== undefined) {
      const cleanRefId = data.referrerId.trim();
      if (cleanRefId && cleanRefId !== investor.id) {
        const referrerObj = this.investors.find((i) => i.id === cleanRefId);
        const resolvedRefName = data.referrerName?.trim() || referrerObj?.name || investor.contract.referrerName || '';
        const resolvedRefPct =
          data.referrerSharePercent !== undefined
            ? Math.max(0, Number(data.referrerSharePercent))
            : investor.contract.referrerSharePercent || 0;

        investor.contract.referrerId = cleanRefId;
        investor.contract.referrerName = resolvedRefName;
        investor.contract.referrerSharePercent = resolvedRefPct;
        investor.referredById = cleanRefId;
        investor.referredByName = resolvedRefName;
        investor.referralSharePercent = resolvedRefPct;
      } else {
        investor.contract.referrerId = undefined;
        investor.contract.referrerName = undefined;
        investor.contract.referrerSharePercent = 0;
        investor.referredById = undefined;
        investor.referredByName = undefined;
        investor.referralSharePercent = 0;
      }
    } else if (data.referrerSharePercent !== undefined) {
      const resolvedRefPct = investor.contract.referrerId ? Math.max(0, Number(data.referrerSharePercent)) : 0;
      investor.contract.referrerSharePercent = resolvedRefPct;
      investor.referralSharePercent = resolvedRefPct;
    }

    // Propagate updated name to wallet, inventory, contracts, and referred investors
    const wallet = this.wallets.find((w) => w.id === investor.walletId || w.ownerId === investor.id);
    if (wallet) {
      wallet.ownerName =
        investor.isReferralPartner && investor.totalCapitalDeposited === 0
          ? `محفظة عمولات الإحالة (${cleanName})`
          : `صندوق المستثمر ${cleanName}`;
      wallet.updatedAt = new Date().toISOString();
    }

    this.inventory.forEach((item) => {
      if (item.investorId === investor.id) {
        item.investorName = cleanName;
      }
    });

    this.investors.forEach((other) => {
      if (other.referredById === investor.id || other.contract?.referrerId === investor.id) {
        other.referredByName = cleanName;
        if (other.contract) {
          other.contract.referrerName = cleanName;
        }
      }
    });

    // Recalculate profit splits on all unpaid installment schedules for this investor's contracts
    const invPct = investor.contract.investorSharePercent;
    const refId = investor.contract.referrerId;
    const refPct = refId ? Math.max(0, Number(investor.contract.referrerSharePercent || 0)) : 0;

    this.contracts.forEach((contract) => {
      if (contract.investorId === investor.id) {
        contract.investorName = cleanName;
        contract.schedules.forEach((sch) => {
          if (sch.status !== 'PAID') {
            const profitIQD = sch.profitAmountIQD;
            const invShare = Math.round(profitIQD * (invPct / 100));
            const grossComp = Math.max(0, profitIQD - invShare);
            const refShare = refId && refPct > 0 ? Math.round(grossComp * (refPct / 100)) : 0;
            const compShare = Math.max(0, grossComp - refShare);
            sch.investorProfitShareIQD = invShare;
            sch.referrerProfitShareIQD = refShare;
            sch.companyProfitShareIQD = compShare;
          }
        });
      }
    });

    return {
      success: true,
      message: `تم تحديث بيانات ونسب العمولة لـ "${cleanName}" بنجاح`,
      investor
    };
  }

  // Method to register a new borrower with guarantors
  public addBorrower(data: {
    name: string;
    phone: string;
    address: string;
    nationalId?: string;
    wifeName?: string;
    city?: string;
    jobTitle?: string;
    monthlyIncomeIQD?: number;
    introducedBy?: string;
    guarantors: {
      name: string;
      phone: string;
      nationalId: string;
      address?: string;
      department?: string;
      letterNumber?: string;
      letterDate?: string;
    }[];
  }): { success: boolean; message: string; borrower: Borrower } {
    const borrowerId = `borrower-${Date.now()}`;
    const newBorrower: Borrower = {
      id: borrowerId,
      name: data.name,
      phone: data.phone,
      address: data.address,
      nationalId: data.nationalId || '',
      wifeName: data.wifeName || '',
      city: data.city || 'سامراء',
      jobTitle: data.jobTitle || 'غير محدد',
      monthlyIncomeIQD: data.monthlyIncomeIQD || 0,
      introducedBy: data.introducedBy ? data.introducedBy.trim() : undefined,
      guarantors: data.guarantors,
      totalFinancedIQD: 0,
      totalRepaidIQD: 0,
      remainingDebtIQD: 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0]
    };

    this.borrowers.push(newBorrower);

    return {
      success: true,
      message: `تم تسجيل الزبون ${data.name} والكفلاء بنجاح في النظام`,
      borrower: newBorrower
    };
  }

  // Method to edit an existing borrower's details
  public updateBorrower(
    borrowerId: string,
    data: {
      name: string;
      phone: string;
      address: string;
      nationalId?: string;
      wifeName?: string;
      city?: string;
      jobTitle?: string;
      monthlyIncomeIQD?: number;
      introducedBy?: string;
    }
  ): { success: boolean; message: string; borrower?: Borrower } {
    const borrower = this.borrowers.find((b) => b.id === borrowerId);
    if (!borrower) return { success: false, message: 'الزبون غير موجود' };

    borrower.name = data.name;
    borrower.phone = data.phone;
    borrower.address = data.address;
    if (data.nationalId !== undefined) borrower.nationalId = data.nationalId;
    if (data.wifeName !== undefined) borrower.wifeName = data.wifeName;
    if (data.city !== undefined) borrower.city = data.city;
    if (data.jobTitle !== undefined) borrower.jobTitle = data.jobTitle;
    if (data.monthlyIncomeIQD !== undefined) borrower.monthlyIncomeIQD = data.monthlyIncomeIQD;
    if (data.introducedBy !== undefined) borrower.introducedBy = data.introducedBy ? data.introducedBy.trim() : undefined;

    // Update borrower name in contracts
    this.contracts.forEach((c) => {
      if (c.borrowerId === borrowerId) {
        c.borrowerName = data.name;
      }
    });

    return {
      success: true,
      message: `تم تحديث بيانات الزبون ${data.name} بنجاح`,
      borrower
    };
  }

  // Method to delete a borrower record (soft-delete to Recycle Bin with full stock & capital reversal)
  public deleteBorrower(borrowerId: string, deletedBy: string = 'مدير النظام'): { success: boolean; message: string } {
    const index = this.borrowers.findIndex((b) => b.id === borrowerId);
    if (index === -1) return { success: false, message: 'الزبون غير موجود' };

    const borrower = this.borrowers[index];
    const associatedContracts = this.contracts.filter((c) => c.borrowerId === borrowerId);

    // 1. Safety Guard: Prevent deletion if any contract has paid installments
    for (const contract of associatedContracts) {
      const hasPaidInstallments = Array.isArray(contract.schedules) && contract.schedules.some((s) => s.status === 'PAID');
      if (hasPaidInstallments) {
        return {
          success: false,
          message: `لا يمكن إلغاء الزبون لوجود أقساط مسددة بالفعل في العقد رقم (${contract.contractNumber}). يرجى تسوية واسترداد الأقساط المسددة أولاً قبل الإلغاء.`
        };
      }
    }

    // 2. Perform full financial and inventory reversal for each associated contract
    for (const contract of associatedContracts) {
      // Return goods to inventory
      if (contract.inventoryItemId) {
        const item = this.inventory.find((i) => i.id === contract.inventoryItemId);
        if (item) {
          const itemUnitCost = item.unitCostIQD || 0;
          const contractItemCost = contract.itemCostPriceIQD || 0;
          const restoreQty = contract.quantity || (itemUnitCost > 0 ? Math.max(1, Math.round(contractItemCost / itemUnitCost)) : 1);
          item.quantity = (item.quantity !== undefined ? item.quantity : 0) + restoreQty;
          item.totalCostIQD = item.quantity * item.unitCostIQD;
          item.status = 'IN_STOCK';
        }
      }

      // Wallet & Investor capital reversal (Restore assets, zero out financed loan & profits)
      const isCompanyOwned =
        contract.investorId === 'wallet-company' ||
        contract.investorId === 'company-s' ||
        contract.investorId === 'COMPANY' ||
        contract.investorId === 'COMPANY_MAIN' ||
        contract.investorId === this.companyWallet.id ||
        contract.investorName === this.companyWallet.ownerName;

      const investor = isCompanyOwned ? undefined : this.investors.find((i) => i.id === contract.investorId);
      const targetWallet = isCompanyOwned
        ? this.companyWallet
        : (this.wallets.find((w) => w.id === investor?.walletId || w.ownerId === contract.investorId) || this.companyWallet);

      if (investor) {
        investor.activeInvestmentsAmount = Math.max(0, (investor.activeInvestmentsAmount || 0) - (contract.financedAmountIQD || 0));
      }

      if (targetWallet) {
        // Restore capital/goods assets valuation to wallet
        targetWallet.totalAssetsValuation += contract.itemCostPriceIQD;
        // Wipe financed debts (canceling unearned profits & debt valuation)
        targetWallet.totalDebtsValuation = Math.max(0, targetWallet.totalDebtsValuation - contract.financedAmountIQD);

        // Refund down payment to borrower if paid at contract creation
        if (contract.downPaymentIQD && contract.downPaymentIQD > 0) {
          targetWallet.balance = Math.max(0, targetWallet.balance - contract.downPaymentIQD);
          this.transactions.unshift({
            id: `tx-refund-dp-${contract.id}-${Date.now()}`,
            referenceNo: `REFUND-${contract.contractNumber}`,
            date: new Date().toISOString().split('T')[0],
            type: 'WITHDRAWAL',
            fromWalletId: targetWallet.id,
            fromWalletName: targetWallet.ownerName,
            toWalletId: 'wallet-borrower',
            toWalletName: `الزبون: ${borrower.name}`,
            amountIQD: contract.downPaymentIQD,
            description: `استرجاع الدفعة الأولى للزبون "${borrower.name}" لإلغاء العقد #${contract.contractNumber} واستعادة البضاعة للمخزن`
          });
        }

        targetWallet.updatedAt = new Date().toISOString();
      }
    }

    // 3. Move to trash
    this.moveToTrash(
      'BORROWER',
      borrower.id,
      borrower.name,
      `ملف زبون (${borrower.phone}) مع (${associatedContracts.length}) عقد تقسيط مسترجع للمخزن`,
      'الزبائن',
      { borrower, associatedContracts },
      borrower.totalFinancedIQD,
      deletedBy
    );

    this.borrowers.splice(index, 1);
    this.contracts = this.contracts.filter((c) => c.borrowerId !== borrowerId);

    return {
      success: true,
      message: `تم إلغاء ملف الزبون "${borrower.name}" وإرجاع البضاعة للمخزن ورأس المال للممول بنجاح`
    };
  }

  // Method to add a new guarantor to an existing borrower
  public addGuarantor(
    borrowerId: string,
    guarantor: {
      name: string;
      phone: string;
      nationalId: string;
      address?: string;
      department?: string;
      letterNumber?: string;
      letterDate?: string;
    }
  ): { success: boolean; message: string } {
    const borrower = this.borrowers.find((b) => b.id === borrowerId);
    if (!borrower) return { success: false, message: 'الزبون غير موجود' };

    borrower.guarantors.push(guarantor);
    return { success: true, message: `تم إضافة الكفيل ${guarantor.name} إلى ملف الزبون ${borrower.name}` };
  }

  // Method to deposit capital into a wallet
  public depositCapital(data: {
    walletId: string;
    amountIQD: number;
    notes?: string;
    date?: string;
  }): {
    success: boolean;
    message: string;
    transaction?: LedgerTransaction;
    previousBalance?: number;
    newBalance?: number;
    wallet?: Wallet;
    investorName?: string;
  } {
    let wallet = this.wallets.find((w) => w.id === data.walletId);
    if (!wallet && (data.walletId === this.companyWallet.id || data.walletId === 'wallet-company' || data.walletId === 'COMPANY')) {
      wallet = this.companyWallet;
      if (!this.wallets.some((w) => w.id === this.companyWallet.id)) {
        this.wallets.unshift(this.companyWallet);
      }
    }
    if (!wallet) return { success: false, message: 'الصندوق المالي غير موجود' };
    if (data.amountIQD <= 0) return { success: false, message: 'مبلغ الإيداع يجب أن يكون أكبر من صفر' };

    const previousBalance = wallet.balance;
    wallet.balance += data.amountIQD;
    wallet.updatedAt = new Date().toISOString();

    if (wallet.id === this.companyWallet.id || wallet.ownerType === 'COMPANY') {
      this.companyWallet.balance = wallet.balance;
      this.companyWallet.updatedAt = wallet.updatedAt;
    }

    let investorName: string | undefined;
    if (wallet.ownerType === 'INVESTOR') {
      const investor = this.investors.find((i) => i.walletId === wallet.id || i.id === wallet.ownerId);
      if (investor) {
        investor.totalCapitalDeposited += data.amountIQD;
        investor.availableLiquidity += data.amountIQD;
        investorName = investor.name;
      }
    }

    const txDate = data.date || new Date().toISOString().split('T')[0];
    const refNo = `DEP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const newTx: LedgerTransaction = {
      id: `tx-dep-${Date.now()}`,
      referenceNo: refNo,
      date: txDate,
      type: 'DEPOSIT',
      investorId: wallet.ownerType === 'INVESTOR' ? wallet.ownerId : undefined,
      investorName: investorName || wallet.ownerName,
      fromWalletId: 'external',
      fromWalletName: 'إيداع إضافي خارجي',
      toWalletId: wallet.id,
      toWalletName: wallet.ownerName,
      amountIQD: data.amountIQD,
      description: data.notes || `تغذية وإيداع رأس مال جديد بقيمة ${data.amountIQD.toLocaleString('en-US')} د.ع إلى ${wallet.ownerName}`
    };

    this.transactions.unshift(newTx);
    this.sortTransactions();

    return {
      success: true,
      message: `تم إيداع مبلغ ${data.amountIQD.toLocaleString('en-US')} د.ع بنجاح في ${wallet.ownerName}`,
      transaction: newTx,
      previousBalance,
      newBalance: wallet.balance,
      wallet,
      investorName
    };
  }

  // Method to purchase a new inventory item funded by a specific investor wallet or company wallet
  public purchaseInventory(data: {
    sku?: string;
    name: string;
    category: string;
    investorId?: string; // investorId or walletId or 'company-s'
    ownerId?: string;
    quantity: number;
    unitCostIQD: number;
    targetSellingPriceIQD?: number;
    purchaseInvoiceId?: string;
    date?: string;
  }): { success: boolean; message: string; item?: InventoryItem; transaction?: LedgerTransaction } {
    const totalCostIQD = data.quantity * data.unitCostIQD;
    const targetSellingPrice = data.targetSellingPriceIQD !== undefined ? data.targetSellingPriceIQD : data.unitCostIQD;

    const targetOwner = data.ownerId || data.investorId || 'wallet-company';

    // Check if Company Wallet
    const isCompanyTarget =
      targetOwner === 'wallet-company' ||
      targetOwner === 'company-s' ||
      targetOwner === 'COMPANY' ||
      targetOwner === 'COMPANY_MAIN' ||
      targetOwner === this.companyWallet.id;

    let ownerName: string;
    let ownerId: string;
    let fromWalletId: string;
    let fromWalletName: string;

    if (isCompanyTarget) {
      if (this.companyWallet.balance < totalCostIQD) {
        return {
          success: false,
          message: `السيولة المتاحة في صندوق الشركة الرئيسي (${this.companyWallet.balance.toLocaleString('en-US')} د.ع) لا تكفي لشراء المادة بقيمة ${totalCostIQD.toLocaleString('en-US')} د.ع`
        };
      }
      this.companyWallet.balance -= totalCostIQD;
      this.companyWallet.totalAssetsValuation += totalCostIQD;
      this.companyWallet.updatedAt = new Date().toISOString();

      ownerId = 'company-s';
      ownerName = this.companyWallet.ownerName;
      fromWalletId = this.companyWallet.id;
      fromWalletName = this.companyWallet.ownerName;
    } else {
      const investor = this.investors.find((i) => i.id === targetOwner || i.walletId === targetOwner);
      if (!investor) return { success: false, message: 'الجهة الممولة غير موجودة' };

      const investorWallet = this.wallets.find((w) => w.id === investor.walletId || w.ownerId === investor.id);
      if (!investorWallet) return { success: false, message: 'صندوق المستثمر غير موجود' };

      if (investorWallet.balance < totalCostIQD) {
        return {
          success: false,
          message: `السيولة المتاحة في صندوق ${investor.name} (${investorWallet.balance.toLocaleString('en-US')} د.ع) لا تكفي لشراء المادة بقيمة ${totalCostIQD.toLocaleString('en-US')} د.ع`
        };
      }

      investorWallet.balance -= totalCostIQD;
      investorWallet.totalAssetsValuation += totalCostIQD;
      investor.availableLiquidity -= totalCostIQD;

      ownerId = investor.id;
      ownerName = investor.name;
      fromWalletId = investorWallet.id;
      fromWalletName = investorWallet.ownerName;
    }

    const itemId = `inv-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const sku = data.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceId = data.purchaseInvoiceId || `PUR-${Math.floor(100 + Math.random() * 900)}`;
    const purDate = data.date || new Date().toISOString().split('T')[0];

    const newItem: InventoryItem = {
      id: itemId,
      sku,
      name: data.name,
      category: data.category,
      investorId: ownerId,
      investorName: ownerName,
      quantity: data.quantity,
      unitCostIQD: data.unitCostIQD,
      totalCostIQD,
      targetSellingPriceIQD: targetSellingPrice,
      purchaseInvoiceId: invoiceId,
      status: 'IN_STOCK',
      purchaseDate: purDate
    };

    this.inventory.unshift(newItem);

    // Ledger Transaction
    const newTx: LedgerTransaction = {
      id: `tx-pur-${Date.now()}`,
      referenceNo: invoiceId,
      date: purDate,
      type: 'PURCHASE_INVENTORY',
      investorId: isCompanyTarget ? undefined : ownerId,
      investorName: ownerName,
      fromWalletId,
      fromWalletName,
      toWalletId: 'inventory-stock',
      toWalletName: `المخزن - قسم ${data.category}`,
      amountIQD: totalCostIQD,
      description: `شراء ${data.name} (عدد ${data.quantity}) بقيمة ${totalCostIQD.toLocaleString('en-US')} د.ع وتخصيص ملكيتها لصالح ${ownerName}`
    };

    this.transactions.unshift(newTx);
    this.sortTransactions();

    return {
      success: true,
      message: `تم شراء المادة "${data.name}" بنجاح وخصم مبلغ ${totalCostIQD.toLocaleString('en-US')} د.ع من ${ownerName}`,
      item: newItem,
      transaction: newTx
    };
  }

  // Method to edit an inventory item
  public updateInventory(data: {
    id: string;
    name: string;
    category: string;
    quantity: number;
    unitCostIQD: number;
    targetSellingPriceIQD?: number;
  }): { success: boolean; message: string; item?: InventoryItem } {
    const item = this.inventory.find((i) => i.id === data.id);
    if (!item) {
      return { success: false, message: 'المادة غير موجودة بالمخزن' };
    }

    const isLinkedToContract = this.contracts.some((c) => c.inventoryItemId === item.id);
    if (isLinkedToContract || item.status === 'FULLY_FINANCED') {
      // If linked to contract, only allow editing non-financial metadata
      item.name = data.name.trim();
      item.category = data.category.trim();
      return {
        success: true,
        message: `تم تحديث اسم وتصنيف المادة "${item.name}" (الكمية والأسعار مقفلة لارتباطها بعقد تقسيط قائم)`,
        item
      };
    }

    const newQuantity = Number(data.quantity);
    const newUnitCost = Number(data.unitCostIQD);
    const newTotalCost = newQuantity * newUnitCost;
    const costDiff = newTotalCost - item.totalCostIQD;
    const targetSellingPrice = data.targetSellingPriceIQD !== undefined && Number(data.targetSellingPriceIQD) > 0
      ? Number(data.targetSellingPriceIQD)
      : newUnitCost;

    const isCompanyTarget =
      item.investorId === 'wallet-company' ||
      item.investorId === 'company-s' ||
      item.investorId === 'COMPANY' ||
      item.investorId === this.companyWallet.id;

    if (costDiff !== 0) {
      if (isCompanyTarget) {
        if (costDiff > 0 && this.companyWallet.balance < costDiff) {
          return {
            success: false,
            message: `السيولة المتاحة في صندوق الشركة (${this.companyWallet.balance.toLocaleString('en-US')} د.ع) لا تكفي لتغطية زيادة التكلفة (${costDiff.toLocaleString('en-US')} د.ع)`
          };
        }
        this.companyWallet.balance -= costDiff;
        this.companyWallet.totalAssetsValuation = Math.max(0, this.companyWallet.totalAssetsValuation + costDiff);
        this.companyWallet.updatedAt = new Date().toISOString();
      } else {
        const investor = this.investors.find((i) => i.id === item.investorId || i.walletId === item.investorId);
        const investorWallet = this.wallets.find((w) => w.id === investor?.walletId || w.ownerId === investor?.id);

        if (costDiff > 0 && investorWallet && investorWallet.balance < costDiff) {
          return {
            success: false,
            message: `السيولة المتاحة في صندوق المستثمر (${investorWallet.balance.toLocaleString('en-US')} د.ع) لا تكفي لتغطية زيادة التكلفة (${costDiff.toLocaleString('en-US')} د.ع)`
          };
        }

        if (investorWallet) {
          investorWallet.balance -= costDiff;
          investorWallet.totalAssetsValuation = Math.max(0, investorWallet.totalAssetsValuation + costDiff);
        }
        if (investor) {
          investor.availableLiquidity -= costDiff;
          investor.activeInvestmentsAmount = Math.max(0, investor.activeInvestmentsAmount + costDiff);
        }
      }

      // Add Ledger Adjustment Transaction
      const adjTx: LedgerTransaction = {
        id: `tx-adj-${Date.now()}`,
        referenceNo: `ADJ-${item.purchaseInvoiceId || Math.floor(100 + Math.random() * 900)}`,
        date: new Date().toISOString().split('T')[0],
        type: 'INVENTORY_ADJUSTMENT',
        fromWalletId: costDiff > 0 ? (isCompanyTarget ? this.companyWallet.id : item.investorId) : 'inventory-stock',
        fromWalletName: costDiff > 0 ? item.investorName : `المخزن - قسم ${item.category}`,
        toWalletId: costDiff > 0 ? 'inventory-stock' : (isCompanyTarget ? this.companyWallet.id : item.investorId),
        toWalletName: costDiff > 0 ? `المخزن - قسم ${item.category}` : item.investorName,
        amountIQD: Math.abs(costDiff),
        description: `تسوية تكلفة المادة "${item.name}" بفارق ${costDiff > 0 ? '+' : '-'}${Math.abs(costDiff).toLocaleString('en-US')} د.ع`
      };
      this.transactions.unshift(adjTx);
    }

    item.name = data.name.trim();
    item.category = data.category.trim();
    item.quantity = newQuantity;
    item.unitCostIQD = newUnitCost;
    item.totalCostIQD = newTotalCost;
    item.targetSellingPriceIQD = targetSellingPrice;

    return {
      success: true,
      message: `تم تعديل بيانات المادة "${item.name}" بنجاح`,
      item
    };
  }

  // Method to delete an inventory item
  public deleteInventory(itemId: string): { success: boolean; message: string } {
    const itemIndex = this.inventory.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      return { success: false, message: 'المادة غير موجودة بالمخزن' };
    }

    const item = this.inventory[itemIndex];

    // Unlink any installment contracts referencing this item
    const linkedContracts = this.contracts.filter((c) => c.inventoryItemId === itemId);
    for (const contract of linkedContracts) {
      contract.inventoryItemId = ''; // Unlink from inventory item
    }

    // Refund the purchase cost back to the investor or company wallet
    const isCompanyTarget =
      item.investorId === 'wallet-company' ||
      item.investorId === 'company-s' ||
      item.investorId === 'COMPANY' ||
      item.investorId === this.companyWallet.id;

    if (isCompanyTarget) {
      this.companyWallet.balance += item.totalCostIQD;
      this.companyWallet.totalAssetsValuation = Math.max(0, this.companyWallet.totalAssetsValuation - item.totalCostIQD);
      this.companyWallet.updatedAt = new Date().toISOString();
    } else {
      const investor = this.investors.find((i) => i.id === item.investorId || i.walletId === item.investorId);
      const investorWallet = this.wallets.find((w) => w.id === investor?.walletId || w.ownerId === investor?.id);

      if (investorWallet) {
        investorWallet.balance += item.totalCostIQD;
        investorWallet.totalAssetsValuation = Math.max(0, investorWallet.totalAssetsValuation - item.totalCostIQD);
      }
      if (investor) {
        investor.availableLiquidity += item.totalCostIQD;
        investor.activeInvestmentsAmount = Math.max(0, investor.activeInvestmentsAmount - item.totalCostIQD);
      }
    }

    // Add refund/cancellation transaction to Ledger
    const cancelTx: LedgerTransaction = {
      id: `tx-del-${Date.now()}`,
      referenceNo: `DEL-${item.purchaseInvoiceId || Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString().split('T')[0],
      type: 'INVENTORY_REVERSAL',
      fromWalletId: 'inventory-stock',
      fromWalletName: `المخزن - قسم ${item.category}`,
      toWalletId: isCompanyTarget ? this.companyWallet.id : item.investorId,
      toWalletName: item.investorName,
      amountIQD: item.totalCostIQD,
      description: `إلغاء وحذف المادة "${item.name}" واسترجاع السيولة بمبلغ ${item.totalCostIQD.toLocaleString('en-US')} د.ع إلى ${item.investorName}`
    };
    this.transactions.unshift(cancelTx);

    // Remove from inventory
    this.inventory.splice(itemIndex, 1);

    const extraNote = linkedContracts.length > 0 ? ' وإلغاء ارتباطها بالعقد' : '';
    return {
      success: true,
      message: `تم حذف المادة "${item.name}"${extraNote} واسترجاع قيمتها (${item.totalCostIQD.toLocaleString('en-US')} د.ع) إلى ${item.investorName} بنجاح`
    };
  }

  // Method to process cash withdrawal for an investor or referral broker
  public withdrawInvestorFunds(data: {
    investorId: string;
    amountIQD: number;
    type?: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL' | 'COMMISSION_WITHDRAWAL';
    notes?: string;
    receiptNo?: string;
    date?: string;
  }): { success: boolean; message: string; investor?: Investor; wallet?: Wallet; transaction?: LedgerTransaction } {
    const investor = this.investors.find((i) => i.id === data.investorId);
    if (!investor) return { success: false, message: 'المستثمر أو الوسيط غير موجود بالسيستم' };

    const wallet = this.wallets.find((w) => w.id === investor.walletId || w.ownerId === investor.id);
    if (!wallet) return { success: false, message: 'صندوق المحفظة غير موجود' };

    const amount = Number(data.amountIQD);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: 'يرجى إدخال مبلغ سحب صحيح أكبر من صفر' };
    }

    if (wallet.balance < amount) {
      return {
        success: false,
        message: `السيولة النقدية المتاحة في محفظة ${investor.name} (${wallet.balance.toLocaleString('en-US')} د.ع) غير كافية لسحب مبلغ ${amount.toLocaleString('en-US')} د.ع`
      };
    }

    // Deduct from wallet balance and available liquidity
    wallet.balance -= amount;
    wallet.updatedAt = new Date().toISOString();
    investor.availableLiquidity = Math.max(0, investor.availableLiquidity - amount);

    // If capital withdrawal, adjust capital
    if (data.type === 'CAPITAL_WITHDRAWAL') {
      investor.totalCapitalDeposited = Math.max(0, investor.totalCapitalDeposited - amount);
    }

    const refNo =
      data.receiptNo && data.receiptNo.trim()
        ? data.receiptNo.trim()
        : getNextInvestorWithdrawalReceiptNumber(this.transactions, this.numberingResetEpoch);
    const txTypeDesc =
      data.type === 'COMMISSION_WITHDRAWAL'
        ? 'سحب عمولة إحالة'
        : data.type === 'PROFIT_WITHDRAWAL'
        ? 'سحب أرباح'
        : data.type === 'CAPITAL_WITHDRAWAL'
        ? 'سحب من رأس المال'
        : 'سحب نقدي';

    const roleLabel = investor.isReferralPartner ? 'الوسيط' : 'المستثمر';
    const txDate = data.date || new Date().toISOString().split('T')[0];
    const tx: LedgerTransaction = {
      id: `tx-wth-${Date.now()}`,
      referenceNo: refNo,
      date: txDate,
      type: 'INVESTOR_WITHDRAWAL',
      investorId: investor.id,
      investorName: investor.name,
      fromWalletId: wallet.id,
      fromWalletName: wallet.ownerName,
      toWalletId: 'cash-out',
      toWalletName: `${roleLabel} نقداً (${investor.name})`,
      amountIQD: amount,
      description: data.notes || `${txTypeDesc} لـ ${roleLabel} ${investor.name} بمبلغ ${amount.toLocaleString('en-US')} د.ع`
    };

    this.transactions.unshift(tx);
    this.sortTransactions();

    return {
      success: true,
      message: `تم سحب مبلغ ${amount.toLocaleString('en-US')} د.ع بنجاح لـ ${roleLabel} ${investor.name}`,
      investor,
      wallet,
      transaction: tx
    };
  }

  // Method to process cash withdrawal from Company Fund (صندوق نظام أمان الرئيسي)
  public withdrawCompanyFunds(data: {
    amountIQD: number;
    recipientName?: string;
    type?: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
    notes?: string;
    receiptNo?: string;
    date?: string;
  }): { success: boolean; message: string; wallet?: Wallet; transaction?: LedgerTransaction } {
    const amount = Number(data.amountIQD);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: 'يرجى إدخال مبلغ سحب صحيح أكبر من صفر' };
    }

    if (this.companyWallet.balance < amount) {
      return {
        success: false,
        message: `السيولة النقدية المتاحة في صندوق الشركة الرئيسي (${this.companyWallet.balance.toLocaleString('en-US')} د.ع) غير كافية لسحب مبلغ ${amount.toLocaleString('en-US')} د.ع`
      };
    }

    // Deduct from company wallet balance
    this.companyWallet.balance -= amount;
    this.companyWallet.updatedAt = new Date().toISOString();

    // Synchronize in wallets array
    const w = this.wallets.find((wallet) => wallet.id === this.companyWallet.id || wallet.ownerType === 'COMPANY');
    if (w) {
      w.balance = this.companyWallet.balance;
      w.updatedAt = this.companyWallet.updatedAt;
    }

    const refNo = data.receiptNo && data.receiptNo.trim()
      ? data.receiptNo.trim()
      : `WTH-COMP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const recipient = data.recipientName && data.recipientName.trim() ? data.recipientName.trim() : 'إدارة الشركة نقداً';
    const txTypeDesc =
      data.type === 'PROFIT_WITHDRAWAL'
        ? 'سحب أرباح شركة'
        : data.type === 'CAPITAL_WITHDRAWAL'
        ? 'سحب رأس مال'
        : 'سحب نقدي من الخزينة';

    const txDate = data.date || new Date().toISOString().split('T')[0];
    const tx: LedgerTransaction = {
      id: `tx-comp-wth-${Date.now()}`,
      referenceNo: refNo,
      date: txDate,
      type: 'WITHDRAWAL',
      fromWalletId: this.companyWallet.id,
      fromWalletName: this.companyWallet.ownerName,
      toWalletId: 'cash-out',
      toWalletName: `المستلم نقداً: ${recipient}`,
      amountIQD: amount,
      description: data.notes && data.notes.trim()
        ? `${txTypeDesc} للمستلم (${recipient}): ${data.notes.trim()}`
        : `${txTypeDesc} لصالح (${recipient}) بمبلغ ${amount.toLocaleString('en-US')} د.ع من صندوق الشركة الرئيسي`
    };

    this.transactions.unshift(tx);
    this.sortTransactions();

    return {
      success: true,
      message: `تم سحب مبلغ ${amount.toLocaleString('en-US')} د.ع بنجاح من صندوق الشركة الرئيسي لصالح ${recipient}`,
      wallet: this.companyWallet,
      transaction: tx
    };
  }

  // Method to create a new installment contract
  public createContract(data: {
    borrowerId: string;
    inventoryItemId: string;
    totalSalePriceIQD: number;
    downPaymentIQD: number;
    monthsCount: number;
    startDate?: string;
    quantity?: number;
  }): { success: boolean; message: string; contract?: InstallmentContract } {
    const borrower = this.borrowers.find((b) => b.id === data.borrowerId);
    if (!borrower) return { success: false, message: 'الزبون غير موجود' };

    const item = this.inventory.find((i) => i.id === data.inventoryItemId);
    if (!item) return { success: false, message: 'المادة بالمخزن غير موجودة' };

    const availableQty = item.quantity !== undefined ? item.quantity : 1;
    const qty = Math.max(1, data.quantity || 1);
    if (availableQty < qty) {
      return { success: false, message: `الكمية المطلوبة (${qty}) غير متوفرة بالمخزن. المتوفر حالياً: (${availableQty}) قطعة` };
    }

    const isCompanyOwned =
      item.investorId === 'wallet-company' ||
      item.investorId === 'company-s' ||
      item.investorId === 'COMPANY' ||
      item.investorId === 'COMPANY_MAIN' ||
      item.investorId === this.companyWallet.id ||
      item.investorName === this.companyWallet.ownerName;

    const investor = isCompanyOwned ? undefined : this.investors.find((i) => i.id === item.investorId);
    const investorName = isCompanyOwned ? this.companyWallet.ownerName : (investor ? investor.name : item.investorName);
    const investorSharePercent = isCompanyOwned ? 0 : (investor ? investor.contract.investorSharePercent : 60);
    const companySharePercent = isCompanyOwned ? 100 : (investor ? investor.contract.companySharePercent : 40);

    const contractId = `contract-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const contractStartDate = data.startDate && !isNaN(Date.parse(data.startDate))
      ? new Date(data.startDate)
      : new Date();
    const contractCreatedAt = new Date().toISOString();

    const epochTime = this.numberingResetEpoch && !isNaN(Date.parse(this.numberingResetEpoch))
      ? new Date(this.numberingResetEpoch).getTime()
      : 0;

    let maxContractNum = 0;
    for (const c of this.contracts) {
      const cTime = c.createdAt && !isNaN(Date.parse(c.createdAt))
        ? new Date(c.createdAt).getTime()
        : (c.startDate && !isNaN(Date.parse(c.startDate)) ? new Date(c.startDate).getTime() : 0);
      if (cTime >= epochTime) {
        const n = parseInt(String(c.contractNumber || '').replace(/\D/g, ''), 10);
        if (!isNaN(n) && n > maxContractNum) maxContractNum = n;
      }
    }
    const contractNumber = String(maxContractNum + 1);

    const itemCostPriceIQD = item.unitCostIQD * qty;
    const safeDownPayment = Math.min(itemCostPriceIQD, Math.max(0, data.downPaymentIQD || 0));
    const financedAmountIQD = data.totalSalePriceIQD - safeDownPayment;
    const profitMarginIQD = data.totalSalePriceIQD - itemCostPriceIQD;
    const monthlyInstallmentIQD = Math.round(financedAmountIQD / data.monthsCount);

    // Build installment schedules with exact remainder distribution (conserving 100% of dinars)
    const schedules: InstallmentScheduleItem[] = [];
    const months = data.monthsCount;

    const referrerId = (!isCompanyOwned && investor?.contract?.referrerId) ? investor.contract.referrerId : undefined;
    const referrerSharePercent = (!isCompanyOwned && referrerId && investor?.contract?.referrerSharePercent)
      ? Math.max(0, Number(investor.contract.referrerSharePercent))
      : 0;

    const totalInvProfit = isCompanyOwned ? 0 : Math.round(profitMarginIQD * (investorSharePercent / 100));
    const grossCompProfit = profitMarginIQD - totalInvProfit;
    const totalRefProfit = (referrerId && referrerSharePercent > 0)
      ? Math.round(grossCompProfit * (referrerSharePercent / 100))
      : 0;
    const totalCompProfit = Math.max(0, grossCompProfit - totalRefProfit);

    const baseAmt = Math.floor(financedAmountIQD / months);
    const remAmt = financedAmountIQD % months;

    const baseInv = Math.floor(totalInvProfit / months);
    const remInv = totalInvProfit % months;

    const baseRef = Math.floor(totalRefProfit / months);
    const remRef = totalRefProfit % months;

    const baseComp = Math.floor(totalCompProfit / months);
    const remComp = totalCompProfit % months;

    const startDate = data.startDate || new Date().toISOString().split('T')[0];
    const startDateObj = new Date(startDate);
    for (let i = 1; i <= months; i++) {
      const dueDate = new Date(startDateObj);
      dueDate.setMonth(dueDate.getMonth() + i);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const amountIQD = baseAmt + (i <= remAmt ? 1 : 0);
      const invShare = baseInv + (i <= remInv ? 1 : 0);
      const refShare = baseRef + (i <= remRef ? 1 : 0);
      let isCompExtra = false;
      if (remComp > 0) {
        const offset = (remInv + remRef) % months;
        const idx = ((i - 1 + months - offset) % months) + 1;
        if (idx <= remComp) isCompExtra = true;
      }
      const compShare = baseComp + (isCompExtra ? 1 : 0);
      const profitIQD = invShare + refShare + compShare;
      const principalIQD = amountIQD - profitIQD;

      schedules.push({
        id: `sch-${contractId}-${i}`,
        contractId,
        installmentNumber: i,
        dueDate: dueDateStr,
        amountIQD,
        principalAmountIQD: principalIQD,
        profitAmountIQD: profitIQD,
        investorProfitShareIQD: invShare,
        referrerProfitShareIQD: refShare,
        companyProfitShareIQD: compShare,
        status: 'PENDING'
      });
    }

    const endDateObj = new Date(startDateObj);
    endDateObj.setMonth(endDateObj.getMonth() + data.monthsCount);
    const endDate = endDateObj.toISOString().split('T')[0];

    const newContract: InstallmentContract = {
      id: contractId,
      contractNumber,
      invoiceNumber: contractNumber,
      createdAt: contractCreatedAt,
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      investorId: item.investorId,
      investorName,
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      quantity: qty,
      itemCostPriceIQD,
      totalSalePriceIQD: data.totalSalePriceIQD,
      profitMarginIQD,
      downPaymentIQD: safeDownPayment,
      financedAmountIQD,
      monthlyInstallmentIQD,
      monthsCount: data.monthsCount,
      startDate,
      endDate,
      schedules,
      status: 'ACTIVE'
    };

    // Update inventory item quantity and status
    item.quantity = Math.max(0, availableQty - qty);
    item.totalCostIQD = item.quantity * item.unitCostIQD;
    item.status = item.quantity === 0 ? 'FULLY_FINANCED' : 'PARTIALLY_FINANCED';

    // Update borrower balances and status
    borrower.totalFinancedIQD += data.totalSalePriceIQD;
    borrower.remainingDebtIQD += financedAmountIQD;
    if (borrower.remainingDebtIQD > 0) {
      borrower.status = 'ACTIVE';
    }

    // Update target wallet (company or investor) debt valuation, asset valuation and cash balance for down payment
    const targetWallet = isCompanyOwned
      ? this.companyWallet
      : (this.wallets.find((w) => w.id === investor?.walletId || w.ownerId === item.investorId) || this.companyWallet);

    if (investor) {
      investor.activeInvestmentsAmount = (investor.activeInvestmentsAmount || 0) + financedAmountIQD;
    }

    if (targetWallet) {
      targetWallet.totalDebtsValuation += financedAmountIQD;
      targetWallet.totalAssetsValuation = Math.max(0, targetWallet.totalAssetsValuation - itemCostPriceIQD);
      if (safeDownPayment > 0) {
        targetWallet.balance += safeDownPayment;
      }
      targetWallet.updatedAt = new Date().toISOString();
    }

    if (safeDownPayment > 0) {
      this.transactions.unshift({
        id: `tx-dp-${contractId}`,
        referenceNo: contractNumber,
        date: startDate,
        type: 'ISSUE_INSTALLMENT',
        fromWalletId: 'wallet-borrower',
        fromWalletName: `الزبون: ${borrower.name}`,
        toWalletId: targetWallet.id,
        toWalletName: targetWallet.ownerName,
        investorId: isCompanyOwned ? this.companyWallet.id : item.investorId,
        investorName,
        borrowerId: borrower.id,
        borrowerName: borrower.name,
        amountIQD: safeDownPayment,
        description: `استلام دفعة مقدمة نقداً لعقد التقسيط ${contractNumber} للزبون ${borrower.name} وتغذية ${targetWallet.ownerName}`
      });
      this.sortTransactions();
    }

    this.contracts.unshift(newContract);

    return {
      success: true,
      message: `تم إنشاء عقد التقسيط رقم ${contractNumber} بنجاح للزبون ${borrower.name}`,
      contract: newContract
    };
  }

  // Method to register and save a direct debt entry with automatic schedule generation
  public addDirectDebt(data: {
    borrowerName: string;
    borrowerPhone?: string;
    investorId: string;
    itemName: string;
    totalAmountIQD: number;
    downPaymentIQD: number;
    monthsCount: number;
    startDate?: string;
    notes?: string;
  }): { success: boolean; message: string; contract?: InstallmentContract } {
    if (!data.borrowerName || !data.borrowerName.trim()) {
      return { success: false, message: 'يرجى كتابة اسم الزبون / العميل' };
    }
    if (!data.itemName || !data.itemName.trim()) {
      return { success: false, message: 'يرجى كتابة اسم المادة أو بيان الدين' };
    }
    if (!data.totalAmountIQD || data.totalAmountIQD <= 0) {
      return { success: false, message: 'مبلغ الدين يجب أن يكون أكبر من صفر' };
    }
    if (!data.monthsCount || data.monthsCount <= 0) {
      return { success: false, message: 'عدد الأشهر / الأقساط يجب أن يكون شهر واحد على الأقل' };
    }

    // 2. Find Investor or Company Wallet
    const isCompany = data.investorId === 'company-s';
    const investor = this.investors.find((i) => i.id === data.investorId);
    const investorName = isCompany
      ? 'نظام أمان للتقسيط (صندوق الشركة الرئيسي)'
      : investor
      ? investor.name
      : this.investors[0]?.name || 'الدائن الممول';
    const investorId = isCompany
      ? 'company-s'
      : investor
      ? investor.id
      : this.investors[0]?.id || 'investor-1';
    const investorSharePercent = isCompany ? 0 : investor ? investor.contract.investorSharePercent : 60;
    const companySharePercent = isCompany ? 100 : investor ? investor.contract.companySharePercent : 40;

    const contractId = `contract-${Date.now()}`;
    const debtCreatedAt = new Date().toISOString();
    const epochTime = this.numberingResetEpoch && !isNaN(Date.parse(this.numberingResetEpoch))
      ? new Date(this.numberingResetEpoch).getTime()
      : 0;

    let maxLegacyNum = 0;
    for (const c of this.directDebts) {
      const cTime = c.createdAt && !isNaN(Date.parse(c.createdAt))
        ? new Date(c.createdAt).getTime()
        : (c.startDate && !isNaN(Date.parse(c.startDate)) ? new Date(c.startDate).getTime() : 0);
      if (cTime >= epochTime) {
        const n = parseInt(String(c.contractNumber || '').replace(/\D/g, ''), 10);
        if (!isNaN(n) && n > maxLegacyNum) maxLegacyNum = n;
      }
    }
    const contractNumber = String(maxLegacyNum + 1);

    const financedAmountIQD = Math.max(0, data.totalAmountIQD - (data.downPaymentIQD || 0));
    const itemCostPriceIQD = Math.round(data.totalAmountIQD * 0.8);
    const profitMarginIQD = data.totalAmountIQD - itemCostPriceIQD;
    const monthlyInstallmentIQD = Math.round(financedAmountIQD / data.monthsCount);

    // Build installment schedules with exact remainder distribution (conserving 100% of dinars)
    const schedules: InstallmentScheduleItem[] = [];
    const months = data.monthsCount;

    const totalInvProfit = isCompany ? 0 : Math.round(profitMarginIQD * (investorSharePercent / 100));
    const totalCompProfit = profitMarginIQD - totalInvProfit;

    const baseAmt = Math.floor(financedAmountIQD / months);
    const remAmt = financedAmountIQD % months;

    const baseInv = Math.floor(totalInvProfit / months);
    const remInv = totalInvProfit % months;

    const baseComp = Math.floor(totalCompProfit / months);
    const remComp = totalCompProfit % months;

    const startDate = data.startDate || new Date().toISOString().split('T')[0];
    const today = new Date(startDate);

    for (let i = 1; i <= months; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(dueDate.getMonth() + i);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const amountIQD = baseAmt + (i <= remAmt ? 1 : 0);
      const invShare = baseInv + (i <= remInv ? 1 : 0);
      let isCompExtra = false;
      if (remComp > 0) {
        const idx = ((i - 1 + months - (remInv % months)) % months) + 1;
        if (idx <= remComp) isCompExtra = true;
      }
      const compShare = baseComp + (isCompExtra ? 1 : 0);
      const profitIQD = invShare + compShare;
      const principalIQD = amountIQD - profitIQD;

      schedules.push({
        id: `sch-${contractId}-${i}`,
        contractId,
        installmentNumber: i,
        dueDate: dueDateStr,
        amountIQD,
        principalAmountIQD: principalIQD,
        profitAmountIQD: profitIQD,
        investorProfitShareIQD: invShare,
        companyProfitShareIQD: compShare,
        status: 'PENDING'
      });
    }

    const endDateObj = new Date(today);
    endDateObj.setMonth(endDateObj.getMonth() + data.monthsCount);
    const endDate = endDateObj.toISOString().split('T')[0];

    const newContract: InstallmentContract = {
      id: contractId,
      contractNumber,
      invoiceNumber: contractNumber,
      createdAt: debtCreatedAt,
      borrowerId: `direct-borrower-${Date.now()}`,
      borrowerName: data.borrowerName.trim(),
      investorId,
      investorName,
      inventoryItemId: `item-${contractId}`,
      inventoryItemName: data.itemName,
      itemCostPriceIQD,
      totalSalePriceIQD: data.totalAmountIQD,
      profitMarginIQD,
      downPaymentIQD: data.downPaymentIQD || 0,
      financedAmountIQD,
      monthlyInstallmentIQD,
      monthsCount: data.monthsCount,
      startDate,
      endDate,
      schedules,
      status: 'ACTIVE'
    };

    this.directDebts.unshift(newContract);

    return {
      success: true,
      message: `تم إضافة وتسجيل الدين والجدول للعميل ${data.borrowerName.trim()} بنجاح`,
      contract: newContract
    };
  }

  // Method to pay direct debt schedule in-memory (supports full and partial payments with rollover)
  public payDirectDebtSchedule(
    contractId: string,
    scheduleId: string,
    customPaidAmountIQD?: number,
    paymentDate?: string
  ): { success: boolean; message: string } {
    const contract = this.directDebts.find((c) => c.id === contractId);
    if (!contract) return { success: false, message: 'دين دفتر الديون غير موجود' };

    const schedule = contract.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return { success: false, message: 'القسط غير موجود في دفتر الديون' };
    if (schedule.status === 'PAID') return { success: false, message: 'القسط مدفوع سابقاً' };

    if (typeof customPaidAmountIQD === 'number' && customPaidAmountIQD <= 0) {
      return { success: false, message: 'يرجى إدخال مبلغ سداد صحيح بالدينار العراقي أكبر من صفر' };
    }

    const eligibleSchedules = contract.schedules
      .filter((s) => s.status !== 'PAID' && s.installmentNumber >= schedule.installmentNumber)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);

    const totalPayableDebt = eligibleSchedules.reduce((acc, s) => acc + s.amountIQD, 0);
    if (typeof customPaidAmountIQD === 'number' && customPaidAmountIQD > totalPayableDebt) {
      return {
        success: false,
        message: `المبلغ المدخل (${customPaidAmountIQD.toLocaleString('en-US')} د.ع) يتجاوز إجمالي الأقساط المتبقية (${totalPayableDebt.toLocaleString('en-US')} د.ع)`
      };
    }

    const isCompanyTarget =
      contract.investorId === 'wallet-company' ||
      contract.investorId === 'company-s' ||
      contract.investorId === 'COMPANY' ||
      contract.investorId === 'COMPANY_MAIN' ||
      contract.investorId === this.companyWallet.id ||
      !contract.investorId;

    const investor = isCompanyTarget ? undefined : this.investors.find((i) => i.id === contract.investorId || i.walletId === contract.investorId);
    const invWallet = isCompanyTarget ? undefined : this.wallets.find((w) => w.id === investor?.walletId || w.ownerId === investor?.id);
    const targetWallet: Wallet = isCompanyTarget ? this.companyWallet : (invWallet || this.companyWallet);

    let remainingToApply = typeof customPaidAmountIQD === 'number' ? customPaidAmountIQD : schedule.amountIQD;
    const todayStr = paymentDate || new Date().toISOString().split('T')[0];
    const fullyPaidList: { num: number; amount: number }[] = [];
    let partialInfo: { num: number; paid: number; remDiff: number } | null = null;
    let totalActuallyPaid = 0;

    for (const sch of eligibleSchedules) {
      if (remainingToApply <= 0) break;

      const schOriginalAmount = sch.amountIQD;
      const isLastChunk = remainingToApply < schOriginalAmount;
      const paidForSch = isLastChunk ? remainingToApply : schOriginalAmount;
      const remainingDifference = schOriginalAmount - paidForSch;

      if (isLastChunk && remainingDifference > 0) {
        const nextSchedule = contract.schedules.find((s) => s.installmentNumber === sch.installmentNumber + 1)
          || contract.schedules.find((s) => s.status !== 'PAID' && s.id !== sch.id);

        if (nextSchedule) {
          const nextOrig = nextSchedule.amountIQD;
          nextSchedule.amountIQD += remainingDifference;
          const noteText = `القسط الأصلي: ${nextOrig.toLocaleString('en-US')} د.ع، والمتبقي ${remainingDifference.toLocaleString('en-US')} د.ع هو عن الدفعة السابقة (قسط شهر ${sch.installmentNumber})`;
          nextSchedule.notes = nextSchedule.notes ? `${nextSchedule.notes} | ${noteText}` : noteText;
        }

        const noteText = sch.id !== schedule.id
          ? `تم سداد ${paidForSch.toLocaleString('en-US')} د.ع جزئياً من أصل ${schOriginalAmount.toLocaleString('en-US')} د.ع (من فائض سداد قسط شهر ${schedule.installmentNumber})، وترحيل المتبقي (${remainingDifference.toLocaleString('en-US')} د.ع) إلى القسط اللاحق`
          : `تم سداد ${paidForSch.toLocaleString('en-US')} د.ع جزئياً من أصل ${schOriginalAmount.toLocaleString('en-US')} د.ع، وترحيل المتبقي (${remainingDifference.toLocaleString('en-US')} د.ع) إلى القسط اللاحق`;
        sch.notes = sch.notes ? `${sch.notes} | ${noteText}` : noteText;
        partialInfo = { num: sch.installmentNumber, paid: paidForSch, remDiff: remainingDifference };
      } else {
        if (sch.id !== schedule.id) {
          const cascadeNote = `تم سداد القسط بالكامل من فائض سداد قسط شهر ${schedule.installmentNumber}`;
          sch.notes = sch.notes ? `${sch.notes} | ${cascadeNote}` : cascadeNote;
        }
        fullyPaidList.push({ num: sch.installmentNumber, amount: paidForSch });
      }

      sch.status = 'PAID';
      sch.paidDate = todayStr;
      sch.amountIQD = paidForSch;

      // Assign sequential integer receipt number relative to manual reset epoch
      if (!sch.receiptNumber) {
        const epochTime = this.numberingResetEpoch && !isNaN(Date.parse(this.numberingResetEpoch))
          ? new Date(this.numberingResetEpoch).getTime()
          : 0;

        let maxReceipt = 0;
        for (const c of this.contracts) {
          for (const s of c.schedules) {
            if (s.receiptNumber) {
              const pTime = s.paidDate && !isNaN(Date.parse(s.paidDate)) ? new Date(s.paidDate).getTime() : 0;
              if (pTime >= epochTime) {
                const num = parseInt(String(s.receiptNumber).replace(/\D/g, ''), 10);
                if (!isNaN(num) && num > maxReceipt) maxReceipt = num;
              }
            }
          }
        }
        for (const d of this.directDebts) {
          for (const s of d.schedules) {
            if (s.receiptNumber) {
              const pTime = s.paidDate && !isNaN(Date.parse(s.paidDate)) ? new Date(s.paidDate).getTime() : 0;
              if (pTime >= epochTime) {
                const num = parseInt(String(s.receiptNumber).replace(/\D/g, ''), 10);
                if (!isNaN(num) && num > maxReceipt) maxReceipt = num;
              }
            }
          }
        }
        sch.receiptNumber = maxReceipt + 1;
      }

      targetWallet.balance += paidForSch;
      targetWallet.updatedAt = new Date().toISOString();
      if (investor) {
        investor.availableLiquidity += paidForSch;
        investor.totalProfitsEarned += Math.round(sch.profitAmountIQD * (paidForSch / (schOriginalAmount || 1)));
      }

      // Add Ledger Transaction record
      const newTx: LedgerTransaction = {
        id: `tx-direct-${contract.id}-${sch.installmentNumber}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        referenceNo: `PAY-DIR-${sch.receiptNumber || Date.now().toString().slice(-4)}`,
        date: todayStr,
        type: 'PAYMENT_RECEIVED',
        investorId: isCompanyTarget ? this.companyWallet.id : contract.investorId,
        investorName: isCompanyTarget ? this.companyWallet.ownerName : contract.investorName,
        borrowerId: contract.borrowerId,
        borrowerName: contract.borrowerName,
        fromWalletId: `wallet-borrower-${contract.borrowerId}`,
        fromWalletName: contract.borrowerName,
        toWalletId: targetWallet.id,
        toWalletName: targetWallet.ownerName,
        amountIQD: paidForSch,
        description: `تسديد قسط دين مباشر رقم ${sch.installmentNumber} بقيمة ${paidForSch.toLocaleString('en-US')} د.ع للعميل ${contract.borrowerName} وتغذية ${targetWallet.ownerName}`
      };
      this.transactions.unshift(newTx);

      remainingToApply -= paidForSch;
      totalActuallyPaid += paidForSch;
    }

    this.sortTransactions();

    // Check if entire contract is fully settled
    const allPaid = contract.schedules.every((s) => s.status === 'PAID');
    if (allPaid) {
      contract.status = 'COMPLETED';
    }

    let returnMessage = '';
    const totalCount = fullyPaidList.length + (partialInfo ? 1 : 0);
    if (totalCount > 1) {
      if (partialInfo) {
        returnMessage = `تم سداد ${totalActuallyPaid.toLocaleString('en-US')} د.ع بنجاح: تسديد كامل لـ (${fullyPaidList.length}) أقساط وتسديد جزئي بقيمة ${partialInfo.paid.toLocaleString('en-US')} د.ع لقسط شهر ${partialInfo.num} مع ترحيل ${partialInfo.remDiff.toLocaleString('en-US')} د.ع وتغذية ${targetWallet.ownerName}`;
      } else {
        returnMessage = `تم سداد ${totalActuallyPaid.toLocaleString('en-US')} د.ع بنجاح وتسديد (${fullyPaidList.length}) أقساط بالكامل وتغذية ${targetWallet.ownerName}`;
      }
    } else if (partialInfo) {
      returnMessage = `تم سداد ${totalActuallyPaid.toLocaleString('en-US')} د.ع جزئياً وترحيل المتبقي ${partialInfo.remDiff.toLocaleString('en-US')} د.ع للقسط اللاحق وتغذية ${targetWallet.ownerName}`;
    } else {
      returnMessage = `تم تسديد قسط الدين بنجاح وتغذية ${targetWallet.ownerName} بمبلغ ${totalActuallyPaid.toLocaleString('en-US')} د.ع`;
    }

    return {
      success: true,
      message: returnMessage
    };
  }

  // Method to register a new operational expense and deduct from selected wallet
  public addExpense(data: {
    title: string;
    category: 'رواتب' | 'إيجارات' | 'تسويق' | 'مصاريف نقل ولوجستيك' | 'صيانة' | 'نثريات' | 'أجهزة ومعدات' | 'رسوم حكومية وإدارية' | 'أخرى';
    amountIQD: number;
    paidFromWalletId: string;
    recipientName?: string;
    referenceNo?: string;
    date?: string;
    notes?: string;
  }): { success: boolean; message: string; expense?: ExpenseItem } {
    if (!data.title || !data.title.trim()) {
      return { success: false, message: 'يرجى إدخال عنوان أو بيان المصروف' };
    }
    if (!data.amountIQD || data.amountIQD <= 0) {
      return { success: false, message: 'مبلغ المصروف يجب أن يكون أكبر من صفر' };
    }

    const wallet = this.wallets.find((w) => w.id === data.paidFromWalletId);
    if (!wallet) {
      return { success: false, message: 'الصندوق المالي المحدد غير موجود' };
    }

    if (wallet.balance < data.amountIQD) {
      return {
        success: false,
        message: `السيولة المتاحة في ${wallet.ownerName} (${wallet.balance.toLocaleString('en-US')} د.ع) لا تكفي لتغطية المصروف بقيمة ${data.amountIQD.toLocaleString('en-US')} د.ع`
      };
    }

    // Deduct from wallet balance
    wallet.balance -= data.amountIQD;
    wallet.updatedAt = new Date().toISOString();

    // If investor wallet, also deduct availableLiquidity
    if (wallet.ownerType === 'INVESTOR') {
      const investor = this.investors.find((i) => i.walletId === wallet.id || i.id === wallet.ownerId);
      if (investor) {
        investor.availableLiquidity -= data.amountIQD;
      }
    }

    const expenseId = `exp-${Date.now()}`;
    const refNo = data.referenceNo && data.referenceNo.trim() ? data.referenceNo.trim() : `EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const expenseDate = data.date || new Date().toISOString().split('T')[0];

    const newExpense: ExpenseItem = {
      id: expenseId,
      title: data.title.trim(),
      category: data.category,
      amountIQD: data.amountIQD,
      date: expenseDate,
      paidFromWalletId: wallet.id,
      paidFromWalletName: wallet.ownerName,
      recipientName: data.recipientName ? data.recipientName.trim() : undefined,
      referenceNo: refNo,
      notes: data.notes ? data.notes.trim() : undefined
    };

    this.expenses.unshift(newExpense);

    // Add Ledger Transaction record
    const newTx: LedgerTransaction = {
      id: `tx-exp-${Date.now()}`,
      referenceNo: refNo,
      date: expenseDate,
      type: 'EXPENSE',
      investorId: wallet.ownerType === 'INVESTOR' ? wallet.ownerId : undefined,
      investorName: wallet.ownerType === 'INVESTOR' ? wallet.ownerName : undefined,
      fromWalletId: wallet.id,
      fromWalletName: wallet.ownerName,
      toWalletId: 'expense-operational',
      toWalletName: `مصروفات تشغيلية - قسم ${data.category}`,
      amountIQD: data.amountIQD,
      description: `صرف مصروف تشغيلي: "${data.title}" - لأجل: ${data.category} - المقتطع من: ${wallet.ownerName}`
    };

    this.transactions.unshift(newTx);
    this.sortTransactions();

    return {
      success: true,
      message: `تم تسجيل المصروف "${data.title}" بقيمة ${data.amountIQD.toLocaleString('en-US')} د.ع وخصمه بنجاح من ${wallet.ownerName}`,
      expense: newExpense
    };
  }

  // Method to delete an operational expense (soft-delete to Recycle Bin and refund balance to wallet)
  public deleteExpense(expenseId: string, deletedBy: string = 'مدير النظام'): { success: boolean; message: string } {
    const expenseIndex = this.expenses.findIndex((e) => e.id === expenseId);
    if (expenseIndex === -1) {
      return { success: false, message: 'المصروف غير موجود' };
    }

    const expense = this.expenses[expenseIndex];

    // Find the wallet and refund the balance
    const wallet = this.wallets.find((w) => w.id === expense.paidFromWalletId);
    if (wallet) {
      wallet.balance += expense.amountIQD;
      wallet.updatedAt = new Date().toISOString();

      if (wallet.ownerType === 'INVESTOR') {
        const investor = this.investors.find((i) => i.walletId === wallet.id || i.id === wallet.ownerId);
        if (investor) {
          investor.availableLiquidity += expense.amountIQD;
        }
      }
    }

    // Move to trash
    this.moveToTrash(
      'EXPENSE',
      expense.id,
      expense.title,
      `سند صرف (${expense.referenceNo}) من ${wallet?.ownerName || 'الصندوق'} بقيمة ${expense.amountIQD.toLocaleString('en-US')} د.ع`,
      'المصروفات التشغيلية',
      expense,
      expense.amountIQD,
      deletedBy
    );

    // Remove from expenses array
    this.expenses.splice(expenseIndex, 1);

    // Remove from ledger transactions
    this.transactions = this.transactions.filter(
      (tx) => !(tx.type === 'EXPENSE' && tx.referenceNo === expense.referenceNo)
    );

    return {
      success: true,
      message: `تم نقل المصروف "${expense.title}" إلى سلة المهملات وإعادة رصيد ${expense.amountIQD.toLocaleString('en-US')} د.ع لصالح ${wallet?.ownerName || 'الصندوق'}`
    };
  }

  // Method to edit an operational expense and balance old and new wallets
  public editExpense(
    expenseId: string,
    data: {
      title: string;
      category: 'رواتب' | 'إيجارات' | 'تسويق' | 'مصاريف نقل ولوجستيك' | 'صيانة' | 'نثريات' | 'أجهزة ومعدات' | 'رسوم حكومية وإدارية' | 'أخرى';
      amountIQD: number;
      paidFromWalletId: string;
      recipientName?: string;
      referenceNo?: string;
      date?: string;
      notes?: string;
    }
  ): { success: boolean; message: string; expense?: ExpenseItem } {
    const expense = this.expenses.find((e) => e.id === expenseId);
    if (!expense) {
      return { success: false, message: 'المصروف غير موجود' };
    }

    if (!data.title || !data.title.trim()) {
      return { success: false, message: 'يرجى إدخال عنوان أو بيان المصروف' };
    }
    if (!data.amountIQD || data.amountIQD <= 0) {
      return { success: false, message: 'مبلغ المصروف يجب أن يكون أكبر من صفر' };
    }

    const oldWalletId = expense.paidFromWalletId;
    const newWalletId = data.paidFromWalletId;
    const oldAmount = expense.amountIQD;
    const newAmount = data.amountIQD;

    const oldWallet = this.wallets.find((w) => w.id === oldWalletId);
    const newWallet = this.wallets.find((w) => w.id === newWalletId);

    if (!newWallet) {
      return { success: false, message: 'الصندوق المالي المحدد غير موجود' };
    }

    // Wallet balance adjustment
    if (oldWalletId === newWalletId) {
      const difference = newAmount - oldAmount;
      if (difference > 0 && newWallet.balance < difference) {
        return {
          success: false,
          message: `السيولة المتاحة في ${newWallet.ownerName} (${newWallet.balance.toLocaleString('en-US')} د.ع) لا تكفي لتغطية الزيادة بقيمة ${difference.toLocaleString('en-US')} د.ع`
        };
      }
      newWallet.balance -= difference;
      newWallet.updatedAt = new Date().toISOString();

      if (newWallet.ownerType === 'INVESTOR') {
        const investor = this.investors.find((i) => i.walletId === newWallet.id || i.id === newWallet.ownerId);
        if (investor) {
          investor.availableLiquidity -= difference;
        }
      }
    } else {
      if (newWallet.balance < newAmount) {
        return {
          success: false,
          message: `السيولة المتاحة في الصندوق الجديد ${newWallet.ownerName} (${newWallet.balance.toLocaleString('en-US')} د.ع) لا تكفي لتغطية المصروف بقيمة ${newAmount.toLocaleString('en-US')} د.ع`
        };
      }

      // Refund old wallet
      if (oldWallet) {
        oldWallet.balance += oldAmount;
        oldWallet.updatedAt = new Date().toISOString();
        if (oldWallet.ownerType === 'INVESTOR') {
          const oldInvestor = this.investors.find((i) => i.walletId === oldWallet.id || i.id === oldWallet.ownerId);
          if (oldInvestor) {
            oldInvestor.availableLiquidity += oldAmount;
          }
        }
      }

      // Deduct new wallet
      newWallet.balance -= newAmount;
      newWallet.updatedAt = new Date().toISOString();
      if (newWallet.ownerType === 'INVESTOR') {
        const newInvestor = this.investors.find((i) => i.walletId === newWallet.id || i.id === newWallet.ownerId);
        if (newInvestor) {
          newInvestor.availableLiquidity -= newAmount;
        }
      }
    }

    const refNo = (data.referenceNo && data.referenceNo.trim()) || expense.referenceNo || `EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const expenseDate = data.date || expense.date;

    // Update in-place
    expense.title = data.title.trim();
    expense.category = data.category;
    expense.amountIQD = newAmount;
    expense.date = expenseDate;
    expense.paidFromWalletId = newWallet.id;
    expense.paidFromWalletName = newWallet.ownerName;
    expense.recipientName = data.recipientName ? data.recipientName.trim() : undefined;
    expense.referenceNo = refNo;
    expense.notes = data.notes ? data.notes.trim() : undefined;

    // Update ledger transaction
    const tx = this.transactions.find((t) => t.type === 'EXPENSE' && t.referenceNo === refNo);
    if (tx) {
      tx.referenceNo = refNo;
      tx.date = expenseDate;
      tx.investorId = newWallet.ownerType === 'INVESTOR' ? newWallet.ownerId : undefined;
      tx.investorName = newWallet.ownerType === 'INVESTOR' ? newWallet.ownerName : undefined;
      tx.fromWalletId = newWallet.id;
      tx.fromWalletName = newWallet.ownerName;
      tx.toWalletName = `مصروفات تشغيلية - قسم ${data.category}`;
      tx.amountIQD = newAmount;
      tx.description = `تعديل مصروف تشغيلي: "${data.title}" - لأجل: ${data.category} - المقتطع من: ${newWallet.ownerName}`;
    } else {
      const newTx: LedgerTransaction = {
        id: `tx-exp-${Date.now()}`,
        referenceNo: refNo,
        date: expenseDate,
        type: 'EXPENSE',
        investorId: newWallet.ownerType === 'INVESTOR' ? newWallet.ownerId : undefined,
        investorName: newWallet.ownerType === 'INVESTOR' ? newWallet.ownerName : undefined,
        fromWalletId: newWallet.id,
        fromWalletName: newWallet.ownerName,
        toWalletId: 'expense-operational',
        toWalletName: `مصروفات تشغيلية - قسم ${data.category}`,
        amountIQD: newAmount,
        description: `تعديل مصروف تشغيلي: "${data.title}" - لأجل: ${data.category} - المقتطع من: ${newWallet.ownerName}`
      };
      this.transactions.unshift(newTx);
    }

    return {
      success: true,
      message: `تم تعديل المصروف "${data.title}" بنجاح وتسوية الأرصدة الحسابية والقيود`,
      expense
    };
  }

  // Method to register a direct administrative revenue / fee to Company Wallet
  public addRevenue(data: {
    title: string;
    category: 'رسوم كشف واستعلام' | 'رسوم فتح ملف وتنظيم عقد' | 'أرباح إدارية واستشارية' | 'غرامات تأخير ورسوم تسوية' | 'إيرادات أخرى';
    amountIQD: number;
    notes?: string;
    date?: string;
  }): { success: boolean; message: string; revenue?: RevenueItem } {
    if (!data.title || !data.title.trim()) {
      return { success: false, message: 'يرجى إدخال بيان أو وصف الإيراد' };
    }
    if (!data.amountIQD || data.amountIQD <= 0) {
      return { success: false, message: 'مبلغ الإيراد يجب أن يكون أكبر من صفر' };
    }

    const revenueId = `rev-${Date.now()}`;
    const date = data.date || new Date().toISOString().split('T')[0];

    const newRev: RevenueItem = {
      id: revenueId,
      title: data.title.trim(),
      category: data.category,
      amountIQD: data.amountIQD,
      date,
      receivedToWalletId: this.companyWallet.id,
      notes: data.notes ? data.notes.trim() : ''
    };

    // Credit Company Wallet
    this.companyWallet.balance += data.amountIQD;
    this.companyWallet.updatedAt = new Date().toISOString();

    this.revenues.unshift(newRev);

    // Ledger Transaction
    const newTx: LedgerTransaction = {
      id: `tx-rev-${Date.now()}`,
      referenceNo: `REV-${Date.now().toString().slice(-6)}`,
      date,
      type: 'REVENUE',
      fromWalletId: 'external-client',
      fromWalletName: 'العميل / الإيراد المباشر',
      toWalletId: this.companyWallet.id,
      toWalletName: this.companyWallet.ownerName,
      amountIQD: data.amountIQD,
      description: `إيراد إداري مباشر: ${data.title} (${data.category}) تم إيداعه وتغذيته في ${this.companyWallet.ownerName}`
    };

    this.transactions.unshift(newTx);
    this.sortTransactions();

    return {
      success: true,
      message: `تم تسجيل الإيراد "${data.title}" بقيمة ${data.amountIQD.toLocaleString('en-US')} د.ع وتغذية صندوق الشركة بنجاح`,
      revenue: newRev
    };
  }

  // Employee Management Methods
  public addEmployee(data: {
    uid?: string;
    name: string;
    role: 'مدير النظام' | 'محاسب مالي' | 'مسؤول مخزن' | 'متابعة أقساط' | 'استعلام ميداني';
    phone: string;
    email: string;
    nationalId?: string;
    salaryIQD: number;
    status: 'نشط' | 'إجازة' | 'معطل' | 'بانتظار الموافقة';
    permissions: string[];
    notes?: string;
  }): { success: boolean; message: string; employee?: Employee } {
    if (!data.name.trim()) return { success: false, message: 'اسم الموظف مطلوب' };

    const newEmp: Employee = {
      id: data.uid ? data.uid : `emp-${Date.now()}`,
      uid: data.uid || undefined,
      name: data.name.trim(),
      role: data.role,
      phone: data.phone.trim(),
      email: data.email.trim(),
      nationalId: data.nationalId ? data.nationalId.trim() : undefined,
      salaryIQD: Number(data.salaryIQD) || 0,
      status: data.status || 'بانتظار الموافقة',
      joinedDate: new Date().toISOString().split('T')[0],
      permissions: data.permissions || [],
      notes: data.notes ? data.notes.trim() : undefined
    };

    this.employees.unshift(newEmp);
    return {
      success: true,
      message: newEmp.status === 'بانتظار الموافقة'
        ? `تم تسجيل طلب الموظف "${newEmp.name}" بنجاح، وهو الآن بانتظار موافقة مدير النظام`
        : `تم إضافة الموظف "${newEmp.name}" وتعيين صلاحياته بنجاح`,
      employee: newEmp
    };
  }

  public editEmployee(empId: string, data: {
    uid?: string;
    name: string;
    role: 'مدير النظام' | 'محاسب مالي' | 'مسؤول مخزن' | 'متابعة أقساط' | 'استعلام ميداني';
    phone: string;
    email: string;
    nationalId?: string;
    salaryIQD: number;
    status: 'نشط' | 'إجازة' | 'معطل' | 'بانتظار الموافقة';
    permissions?: string[];
    notes?: string;
  }): { success: boolean; message: string; employee?: Employee } {
    const emp = this.employees.find(e => e.id === empId || e.uid === empId);
    if (!emp) return { success: false, message: 'الموظف غير موجود' };

    if (data.uid) emp.uid = data.uid;
    emp.name = data.name.trim();
    emp.role = data.role;
    emp.phone = data.phone.trim();
    emp.email = data.email.trim();
    emp.nationalId = data.nationalId ? data.nationalId.trim() : undefined;
    emp.salaryIQD = Number(data.salaryIQD) || 0;
    emp.status = data.status;
    if (data.permissions) {
      emp.permissions = data.permissions;
    }
    emp.notes = data.notes ? data.notes.trim() : undefined;

    return {
      success: true,
      message: `تم تحديث بيانات الموظف "${emp.name}" بنجاح`,
      employee: emp
    };
  }

  public approveEmployee(empId: string): { success: boolean; message: string; employee?: Employee } {
    const emp = this.employees.find(e => e.id === empId);
    if (!emp) return { success: false, message: 'الموظف غير موجود' };

    emp.status = 'نشط';
    // If permissions are empty, assign default permissions for their role
    if (!emp.permissions || emp.permissions.length === 0) {
      if (emp.role === 'محاسب مالي') {
        emp.permissions = [
          'DASHBOARD_VIEW', 'COMPANY_FUND_MANAGE', 'COMPANY_FUND_WITHDRAW', 'FUNDS_MANAGE',
          'REPORTS_VIEW', 'REPORTS_EXPORT', 'INVESTORS_VIEW', 'INVESTORS_STATEMENT_PRINT',
          'BORROWERS_VIEW', 'CONTRACTS_VIEW', 'CONTRACTS_CREATE', 'INSTALLMENTS_PAY',
          'CONTRACTS_PRINT', 'DEBT_LEDGER_MANAGE', 'INVENTORY_VIEW', 'EXPENSES_MANAGE',
          'REVENUES_MANAGE'
        ];
      } else if (emp.role === 'مسؤول مخزن') {
        emp.permissions = [
          'DASHBOARD_VIEW', 'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'INVENTORY_EDIT',
          'CONTRACTS_VIEW'
        ];
      } else if (emp.role === 'متابعة أقساط') {
        emp.permissions = [
          'DASHBOARD_VIEW', 'BORROWERS_VIEW', 'OVERDUE_MANAGE', 'COLLECTION_PRINT',
          'CONTRACTS_VIEW', 'INSTALLMENTS_PAY', 'CONTRACTS_PRINT', 'DEBT_LEDGER_MANAGE',
          'CREDIT_SCORE_VIEW'
        ];
      } else if (emp.role === 'استعلام ميداني') {
        emp.permissions = [
          'DASHBOARD_VIEW', 'BORROWERS_VIEW', 'OVERDUE_MANAGE', 'CREDIT_SCORE_VIEW'
        ];
      } else {
        emp.permissions = ['DASHBOARD_VIEW'];
      }
    }

    return {
      success: true,
      message: `تم قبول وتفعيل حساب الموظف "${emp.name}" بنجاح، ويمكنه الآن تسجيل الدخول بالنظام`,
      employee: emp
    };
  }

  public rejectEmployee(empId: string): { success: boolean; message: string } {
    const empIndex = this.employees.findIndex(e => e.id === empId);
    if (empIndex === -1) return { success: false, message: 'الموظف غير موجود' };

    const empName = this.employees[empIndex].name;
    this.employees.splice(empIndex, 1);

    return {
      success: true,
      message: `تم رفض وإلغاء طلب انضمام الموظف "${empName}" بنجاح`
    };
  }



  public updateEmployeePermissions(empId: string, permissions: string[]): { success: boolean; message: string } {
    const emp = this.employees.find(e => e.id === empId);
    if (!emp) return { success: false, message: 'الموظف غير موجود' };

    emp.permissions = permissions;
    return {
      success: true,
      message: `تم تحديث صلاحيات الموظف "${emp.name}" بنجاح (${permissions.length} صلاحية مخصصة)`
    };
  }

  public deleteEmployee(empId: string, deletedBy: string = 'مدير النظام'): { success: boolean; message: string } {
    const index = this.employees.findIndex(e => e.id === empId);
    if (index === -1) return { success: false, message: 'الموظف غير موجود' };

    const emp = this.employees[index];
    if (emp.role === 'مدير النظام') {
      return { success: false, message: 'لا يمكن حذف حساب مدير النظام الرئيسي' };
    }

    this.moveToTrash(
      'EMPLOYEE',
      emp.id,
      emp.name,
      `موظف (${emp.role}) - الراتب: ${emp.salaryIQD.toLocaleString('en-US')} د.ع`,
      'الموظفون والصلاحيات',
      emp,
      emp.salaryIQD,
      deletedBy
    );

    this.employees.splice(index, 1);

    return {
      success: true,
      message: `تم نقل الموظف "${emp.name}" إلى سلة المهملات وإلغاء صلاحياته بنجاح`
    };
  }

  // Delete Contract (soft-delete to Recycle Bin)
  public deleteContract(contractId: string, deletedBy: string = 'مدير النظام'): { success: boolean; message: string } {
    const index = this.contracts.findIndex(c => c.id === contractId);
    if (index === -1) return { success: false, message: 'العقد غير موجود' };

    const contract = this.contracts[index];
    this.moveToTrash(
      'CONTRACT',
      contract.id,
      `عقد تقسيط #${contract.contractNumber || contract.id}`,
      `عقد العميل: ${contract.borrowerName} - الإجمالي: ${contract.totalSalePriceIQD.toLocaleString('en-US')} د.ع (${contract.schedules.length} قسط)`,
      'عقود التقسيط',
      contract,
      contract.totalSalePriceIQD,
      deletedBy
    );

    // Restore inventory item quantity and status if linked
    if (contract.inventoryItemId) {
      const item = this.inventory.find((i) => i.id === contract.inventoryItemId);
      if (item) {
        const restoreQty = contract.quantity || 1;
        item.quantity = (item.quantity !== undefined ? item.quantity : 0) + restoreQty;
        item.totalCostIQD = item.quantity * item.unitCostIQD;
        item.status = 'IN_STOCK';

        const isCompanyOwned =
          item.investorId === 'wallet-company' ||
          item.investorId === 'company-s' ||
          item.investorId === this.companyWallet.id;
        const targetWallet = isCompanyOwned
          ? this.companyWallet
          : (this.wallets.find((w) => w.id === item.investorId || w.ownerId === item.investorId) || this.companyWallet);

        if (targetWallet) {
          targetWallet.totalAssetsValuation += contract.itemCostPriceIQD;
          targetWallet.totalDebtsValuation = Math.max(0, targetWallet.totalDebtsValuation - contract.financedAmountIQD);
          targetWallet.updatedAt = new Date().toISOString();
        }
      }
    }

    this.contracts.splice(index, 1);
    return {
      success: true,
      message: `تم نقل عقد التقسيط للعميل "${contract.borrowerName}" إلى سلة المهملات بنجاح واستعادة المادة للمخزن`
    };
  }

  // Delete Inventory Item (soft-delete to Recycle Bin)
  public deleteInventoryItem(itemId: string, deletedBy: string = 'مدير النظام'): { success: boolean; message: string } {
    const index = this.inventory.findIndex(i => i.id === itemId);
    if (index === -1) return { success: false, message: 'المادة غير موجودة في المخزن' };

    const item = this.inventory[index];
    this.moveToTrash(
      'INVENTORY',
      item.id,
      item.name,
      `مادة مخزنية - الكمية: ${item.quantity} (${item.category})`,
      'المخزن والأصول',
      item,
      item.totalCostIQD,
      deletedBy
    );

    this.inventory.splice(index, 1);
    return {
      success: true,
      message: `تم نقل المادة "${item.name}" إلى سلة المهملات بنجاح`
    };
  }

  // Delete Revenue (soft-delete to Recycle Bin)
  public deleteRevenue(revenueId: string, deletedBy: string = 'مدير النظام'): { success: boolean; message: string } {
    const index = this.revenues.findIndex(r => r.id === revenueId);
    if (index === -1) return { success: false, message: 'الإيراد غير موجود' };

    const rev = this.revenues[index];
    const wallet = this.wallets.find(w => w.id === rev.receivedToWalletId) || this.companyWallet;
    if (wallet) {
      wallet.balance = Math.max(0, wallet.balance - rev.amountIQD);
      wallet.updatedAt = new Date().toISOString();
    }

    this.moveToTrash(
      'REVENUE',
      rev.id,
      rev.title,
      `سند إيراد (${rev.category}) بقيمة ${rev.amountIQD.toLocaleString('en-US')} د.ع`,
      'الإيرادات والأرباح',
      rev,
      rev.amountIQD,
      deletedBy
    );

    this.revenues.splice(index, 1);
    return {
      success: true,
      message: `تم نقل الإيراد "${rev.title}" إلى سلة المهملات بنجاح وخصم قيمته (${rev.amountIQD.toLocaleString('en-US')} د.ع) من رصيد ${wallet ? wallet.ownerName : 'صندوق الشركة'}`
    };
  }

  // Delete Investor (soft-delete to Recycle Bin)
  public deleteInvestor(investorId: string, deletedBy: string = 'مدير النظام'): { success: boolean; message: string } {
    const index = this.investors.findIndex(i => i.id === investorId);
    if (index === -1) return { success: false, message: 'المستثمر غير موجود' };

    const inv = this.investors[index];
    this.moveToTrash(
      'INVESTOR',
      inv.id,
      inv.name,
      `حساب مستثمر (${inv.phone}) - رأس المال: ${inv.totalCapitalDeposited.toLocaleString('en-US')} د.ع`,
      'المستثمرون والمحافظ',
      inv,
      inv.totalCapitalDeposited,
      deletedBy
    );

    this.investors.splice(index, 1);
    return {
      success: true,
      message: `تم نقل المستثمر "${inv.name}" إلى سلة المهملات بنجاح`
    };
  }

  // Delete Direct Debt (soft-delete to Recycle Bin)
  public deleteDirectDebt(debtId: string, deletedBy: string = 'مدير النظام'): { success: boolean; message: string } {
    const index = this.directDebts.findIndex(d => d.id === debtId);
    if (index === -1) return { success: false, message: 'الدين المباشر غير موجود' };

    const debt = this.directDebts[index];
    this.moveToTrash(
      'DIRECT_DEBT',
      debt.id,
      `دين مباشر - ${debt.borrowerName}`,
      `قيمة الدين: ${debt.totalSalePriceIQD.toLocaleString('en-US')} د.ع`,
      'الديون المباشرة',
      debt,
      debt.totalSalePriceIQD,
      deletedBy
    );

    this.directDebts.splice(index, 1);
    return {
      success: true,
      message: `تم نقل الدين المباشر للعميل "${debt.borrowerName}" إلى سلة المهملات بنجاح`
    };
  }

  // Move item to Recycle Bin
  public moveToTrash(
    entityType: TrashEntityType,
    entityId: string,
    title: string,
    subtitle: string,
    category: string,
    originalData: any,
    amountIQD?: number,
    deletedBy: string = 'مدير النظام',
    notes?: string
  ): { success: boolean; message: string; trashItem: TrashItem } {
    const trashItem: TrashItem = {
      id: `trash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      entityType,
      entityId,
      title,
      subtitle,
      category,
      amountIQD,
      deletedAt: new Date().toISOString(),
      deletedBy,
      originalData: JSON.parse(JSON.stringify(originalData)),
      notes
    };
    this.trashItems.unshift(trashItem);
    return {
      success: true,
      message: `تم نقل "${title}" إلى سلة المهملات بنجاح`,
      trashItem
    };
  }

  // Restore item from Recycle Bin
  public restoreFromTrash(trashId: string): { success: boolean; message: string; restoredItem?: any } {
    const index = this.trashItems.findIndex(t => t.id === trashId);
    if (index === -1) {
      return { success: false, message: 'العنصر غير موجود في سلة المهملات' };
    }

    const trash = this.trashItems[index];
    const data = trash.originalData;

    switch (trash.entityType) {
      case 'BORROWER': {
        const borrowerData = data.borrower || data;
        const exists = this.borrowers.some(b => b.id === borrowerData.id);
        if (!exists) {
          this.borrowers.push(borrowerData);
        }
        if (data.associatedContracts && Array.isArray(data.associatedContracts)) {
          for (const c of data.associatedContracts) {
            if (!this.contracts.some(existing => existing.id === c.id)) {
              this.contracts.push(c);
              // Re-deduct restored contract inventory
              if (c.inventoryItemId) {
                const item = this.inventory.find(i => i.id === c.inventoryItemId);
                if (item) {
                  const contractQty = c.quantity || 1;
                  item.quantity = Math.max(0, (item.quantity !== undefined ? item.quantity : 1) - contractQty);
                  item.totalCostIQD = item.quantity * item.unitCostIQD;
                  item.status = item.quantity === 0 ? 'FULLY_FINANCED' : 'PARTIALLY_FINANCED';
                }
              }
              // Re-apply wallet valuations
              const isCompanyOwned =
                c.investorId === 'wallet-company' ||
                c.investorId === 'company-s' ||
                c.investorId === 'COMPANY' ||
                c.investorId === 'COMPANY_MAIN' ||
                c.investorId === this.companyWallet.id ||
                c.investorName === this.companyWallet.ownerName;

              const targetWallet = isCompanyOwned
                ? this.companyWallet
                : (this.wallets.find((w) => w.id === c.investorId || w.ownerId === c.investorId) || this.companyWallet);

              if (targetWallet) {
                targetWallet.totalAssetsValuation = Math.max(0, targetWallet.totalAssetsValuation - c.itemCostPriceIQD);
                targetWallet.totalDebtsValuation += c.financedAmountIQD;
                if (c.downPaymentIQD && c.downPaymentIQD > 0) {
                  targetWallet.balance += c.downPaymentIQD;
                }
                targetWallet.updatedAt = new Date().toISOString();
              }
            }
          }
        }
        break;
      }
      case 'CONTRACT': {
        const contractData = data;
        const exists = this.contracts.some(c => c.id === contractData.id);
        if (!exists) {
          this.contracts.push(contractData);
          if (contractData.inventoryItemId) {
            const item = this.inventory.find(i => i.id === contractData.inventoryItemId);
            if (item) {
              const contractQty = contractData.quantity || 1;
              item.quantity = Math.max(0, (item.quantity !== undefined ? item.quantity : 1) - contractQty);
              item.totalCostIQD = item.quantity * item.unitCostIQD;
              item.status = item.quantity === 0 ? 'FULLY_FINANCED' : 'PARTIALLY_FINANCED';
            }
          }
        }
        break;
      }
      case 'EXPENSE': {
        const expenseData = data;
        const exists = this.expenses.some(e => e.id === expenseData.id);
        if (!exists) {
          this.expenses.push(expenseData);
          const wallet = this.wallets.find(w => w.id === expenseData.paidFromWalletId);
          if (wallet) {
            wallet.balance = Math.max(0, wallet.balance - expenseData.amountIQD);
            wallet.updatedAt = new Date().toISOString();
            if (wallet.ownerType === 'INVESTOR') {
              const investor = this.investors.find(i => i.walletId === wallet.id || i.id === wallet.ownerId);
              if (investor) {
                investor.availableLiquidity = Math.max(0, investor.availableLiquidity - expenseData.amountIQD);
              }
            }
          }
        }
        break;
      }
      case 'REVENUE': {
        const revenueData = data;
        const exists = this.revenues.some(r => r.id === revenueData.id);
        if (!exists) {
          this.revenues.push(revenueData);
          const wallet = this.wallets.find(w => w.id === (revenueData.receivedToWalletId || revenueData.walletId)) || this.companyWallet;
          if (wallet) {
            wallet.balance += revenueData.amountIQD;
            wallet.updatedAt = new Date().toISOString();
          }
        }
        break;
      }
      case 'INVENTORY': {
        const itemData = data;
        const exists = this.inventory.some(i => i.id === itemData.id);
        if (!exists) {
          this.inventory.push(itemData);
        }
        break;
      }
      case 'EMPLOYEE': {
        const empData = data;
        const exists = this.employees.some(e => e.id === empData.id);
        if (!exists) {
          this.employees.push(empData);
        }
        break;
      }
      case 'INVESTOR': {
        const invData = data;
        const exists = this.investors.some(i => i.id === invData.id);
        if (!exists) {
          this.investors.push(invData);
        }
        break;
      }
      case 'DIRECT_DEBT': {
        const debtData = data;
        const exists = this.directDebts.some(d => d.id === debtData.id);
        if (!exists) {
          this.directDebts.push(debtData);
        }
        break;
      }
    }

    this.trashItems.splice(index, 1);
    return {
      success: true,
      message: `تمت استعادة "${trash.title}" بنجاح وإعادته للنظام`,
      restoredItem: data
    };
  }

  // Permanent Delete single item from Recycle Bin
  public permanentDeleteFromTrash(trashId: string): { success: boolean; message: string } {
    const index = this.trashItems.findIndex(t => t.id === trashId);
    if (index === -1) {
      return { success: false, message: 'العنصر غير موجود في سلة المهملات' };
    }
    const removedTitle = this.trashItems[index].title;
    this.trashItems.splice(index, 1);
    return {
      success: true,
      message: `تم حذف "${removedTitle}" نهائياً من سلة المهملات`
    };
  }

  // Empty Recycle Bin manually (all or by type)
  public emptyTrash(entityTypeFilter?: TrashEntityType): { success: boolean; message: string; count: number } {
    const initialCount = this.trashItems.length;
    if (entityTypeFilter) {
      const itemsToDelete = this.trashItems.filter(t => t.entityType === entityTypeFilter);
      this.trashItems = this.trashItems.filter(t => t.entityType !== entityTypeFilter);
      return {
        success: true,
        message: `تم تفريغ ${itemsToDelete.length} عنصر من سلة المهملات نهائياً`,
        count: itemsToDelete.length
      };
    } else {
      this.trashItems = [];
      return {
        success: true,
        message: `تم تفريغ سلة المهملات بالكامل (${initialCount} عنصر) نهائياً وبنجاح`,
        count: initialCount
      };
    }
  }

  // Reset and clear all demo data for production launch
  public clearAllDemoData(): { success: boolean; message: string } {
    this.companyWallet.balance = 0;
    this.companyWallet.totalAssetsValuation = 0;
    this.companyWallet.totalDebtsValuation = 0;
    this.companyWallet.updatedAt = new Date().toISOString();

    this.investors = [];
    this.wallets = [this.companyWallet];
    this.inventory = [];
    this.borrowers = [];
    this.contracts = [];
    this.directDebts = [];
    this.transactions = [];
    this.expenses = [];
    this.revenues = [];
    this.trashItems = [];

    // Keep active admin employee
    const adminEmp = this.employees.find(e => e.role === 'مدير النظام') || {
      id: 'emp-1',
      name: 'أحمد إياد',
      role: 'مدير النظام' as const,
      phone: '07705554433',
      email: 'ahmed.ayad@ajeebiq.com',
      nationalId: 'IQ-10029384',
      salaryIQD: 1500000,
      status: 'نشط' as const,
      joinedDate: '2025-11-01',
      permissions: [
        'DASHBOARD_VIEW',
        'COMPANY_FUND_MANAGE',
        'INVESTORS_MANAGE',
        'REFERRALS_MANAGE',
        'BORROWERS_MANAGE',
        'OVERDUE_MANAGE',
        'CREDIT_SCORE_VIEW',
        'FUNDS_MANAGE',
        'INVENTORY_MANAGE',
        'CONTRACTS_CREATE',
        'EXPENSES_MANAGE',
        'REVENUES_MANAGE',
        'REPORTS_VIEW',
        'DEBT_LEDGER_MANAGE',
        'EMPLOYEES_MANAGE',
        'SETTINGS_MANAGE',
        'TRASH_MANAGE'
      ],
      notes: 'المدير العام المالك وصاحب الصلاحيات الشاملة المطلقة للنظام'
    };

    this.employees = [adminEmp];

    return {
      success: true,
      message: 'تم تفريغ كافة البيانات التجريبية بنجاح وتهيئة المنصة للإطلاق الفعلي والبدء بإدخال التداولات الحقيقية'
    };
  }

  public setAdminPasscode(newPasscode: string): { success: boolean; message: string } {
    if (!newPasscode || newPasscode.trim().length < 4) {
      return { success: false, message: 'رمز الأمان يجب أن يتكون من 4 خانات على الأقل' };
    }
    this.adminPasscode = newPasscode.trim();
    this.privacyPasscode = newPasscode.trim();
    return { success: true, message: 'تم تحديث رمز الأمان بنجاح' };
  }

  public setPrivacySettings(passcode: string, autoHideSeconds: number): { success: boolean; message: string } {
    if (!passcode || passcode.trim().length < 4) {
      return { success: false, message: 'رمز المرور يجب أن يتكون من 4 خانات على الأقل' };
    }
    this.privacyPasscode = passcode.trim();
    this.adminPasscode = passcode.trim();
    this.privacyAutoHideSeconds = autoHideSeconds;
    return { success: true, message: 'تم تحديث إعدادات الخصوصية بنجاح' };
  }

  public resetNumberingCycle(timestamp?: string): { success: boolean; message: string; epoch: string } {
    const epoch = timestamp || new Date().toISOString();
    this.numberingResetEpoch = epoch;
    if (typeof window !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
        cache.numberingResetEpoch = epoch;
        localStorage.setItem('aman_finance_live_cache', JSON.stringify(cache));
      } catch {}
    }
    return {
      success: true,
      message: 'تم تصفير دورة الترقيم بنجاح. سيبدأ ترقيم العقود والوصولات الجديدة من رقم 1',
      epoch
    };
  }

  public setCompanyProfile(data: Partial<CompanyReportProfile>): {
    success: boolean;
    message: string;
    profile: CompanyReportProfile;
  } {
    this.companyProfile = {
      ...this.companyProfile,
      ...data,
      companyName: data.companyName !== undefined && data.companyName.trim() ? data.companyName.trim() : this.companyProfile.companyName,
      companyAddress: data.companyAddress !== undefined && data.companyAddress.trim() ? data.companyAddress.trim() : this.companyProfile.companyAddress,
      companyPhone: data.companyPhone !== undefined && data.companyPhone.trim() ? data.companyPhone.trim() : this.companyProfile.companyPhone,
      companyActivity: data.companyActivity !== undefined && data.companyActivity.trim() ? data.companyActivity.trim() : this.companyProfile.companyActivity,
      managerName: data.managerName !== undefined && data.managerName.trim() ? data.managerName.trim() : this.companyProfile.managerName,
    };
    if (typeof window !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
        cache.companyProfile = this.companyProfile;
        localStorage.setItem('aman_finance_live_cache', JSON.stringify(cache));
      } catch {}
    }
    return {
      success: true,
      message: 'تم حفظ وتحديث بيانات وهوية الشركة بنجاح',
      profile: this.companyProfile
    };
  }
}








