/**
 * Credit Scoring & Borrower Quality Engine
 * Pure in-memory analytical evaluation of borrower creditworthiness and portfolio health.
 * Zero database schema modifications; adheres to exact dinar conservation and English numerals.
 */

import { Borrower, InstallmentContract } from '@/types/finance';
import { calculateInstallmentDueStatus } from './installmentDates';

export type CreditTier = 'AAA' | 'A' | 'B' | 'C' | 'D';

export interface CreditBreakdown {
  punctualityScore: number;    // 0 - 40
  dtiScore: number;            // 0 - 25
  guarantorScore: number;      // 0 - 20
  historyScore: number;        // 0 - 15
  totalScore: number;          // 0 - 100
}

export interface BorrowerCreditEvaluation {
  borrowerId: string;
  borrowerName: string;
  totalScore: number;
  tier: CreditTier;
  tierLabel: string;
  tierShortLabel: string;
  tierColor: string;
  tierBadgeClass: string;
  isBlacklisted: boolean;
  blacklistReason?: string;
  dtiRatio: number;
  monthlyInstallmentSum: number;
  monthlyIncomeIQD: number;
  recommendedCreditLimitIQD: number;
  availableCreditLimitIQD: number;
  remainingDebtIQD: number;
  overdueInstallmentsCount: number;
  maxDaysOverdue: number;
  breakdown: CreditBreakdown;
}

export interface PortfolioCreditSummary {
  evaluations: BorrowerCreditEvaluation[];
  portfolioHealthIndex: number; // 0 - 100%
  tierCounts: Record<CreditTier, number>;
  blacklistedCount: number;
  totalExposureIQD: number;
  totalAvailableCreditIQD: number;
}

/**
 * Evaluates the credit score and quality tier for a single borrower.
 */
export function evaluateBorrowerCredit(
  borrower: Borrower,
  contracts: InstallmentContract[],
  referenceDate: Date = new Date()
): BorrowerCreditEvaluation {
  // Find all contracts belonging to this borrower
  const borrowerContracts = contracts.filter((c) => c.borrowerId === borrower.id);

  // 1. Analyze Schedules: Punctuality, Active Monthly Installments, Max Overdue
  let activeMonthlySum = 0;
  let overdueCount = 0;
  let maxDaysOverdue = 0;
  let paidOnTimeCount = 0;
  let hasDefaultedContract = borrowerContracts.some((c) => c.status === 'DEFAULTED');

  borrowerContracts.forEach((c) => {
    if (c.status === 'ACTIVE') {
      activeMonthlySum += c.monthlyInstallmentIQD || 0;
    }

    c.schedules?.forEach((s) => {
      if (s.status === 'PAID') {
        paidOnTimeCount++;
      } else {
        const due = calculateInstallmentDueStatus(s.dueDate, false, referenceDate);
        if (due.status === 'OVERDUE') {
          overdueCount++;
          if (due.daysOverdue > maxDaysOverdue) {
            maxDaysOverdue = due.daysOverdue;
          }
        }
      }
    });
  });

  // -------------------------------------------------------------
  // Pillar 1: Repayment Punctuality (0 - 40 points)
  // -------------------------------------------------------------
  let punctualityScore = 40;
  if (overdueCount > 0) {
    if (maxDaysOverdue > 60) {
      punctualityScore = 0;
    } else if (maxDaysOverdue > 30) {
      punctualityScore = 10;
    } else if (maxDaysOverdue >= 8) {
      punctualityScore = 20;
    } else {
      // 1 to 7 days
      punctualityScore = 30;
    }
    // Additional deduction for multiple late installments
    if (overdueCount > 1) {
      punctualityScore = Math.max(0, punctualityScore - (overdueCount - 1) * 5);
    }
  } else {
    // Reward bonus for proven payment discipline (up to 5 extra bonus within 40 cap)
    if (paidOnTimeCount >= 3) {
      punctualityScore = 40;
    }
  }

  // -------------------------------------------------------------
  // Pillar 2: Debt-to-Income Capacity (DTI) (0 - 25 points)
  // -------------------------------------------------------------
  const monthlyIncome = borrower.monthlyIncomeIQD || 0;
  let dtiRatio = 0;
  let dtiScore = 15; // default moderate assumption if income not registered

  if (monthlyIncome > 0) {
    dtiRatio = activeMonthlySum / monthlyIncome;
    if (dtiRatio <= 0.30) {
      dtiScore = 25; // Excellent: installment is <= 30% of salary
    } else if (dtiRatio <= 0.45) {
      dtiScore = 18; // Good: 31% - 45%
    } else if (dtiRatio <= 0.60) {
      dtiScore = 10; // Constrained: 46% - 60%
    } else {
      dtiScore = 3;  // Overleveraged: > 60%
    }
  }

  // -------------------------------------------------------------
  // Pillar 3: Guarantor Strength & Documentation (0 - 20 points)
  // -------------------------------------------------------------
  let guarantorScore = 5; // Base without guarantor
  const guarantors = borrower.guarantors || [];

  if (guarantors.length > 0) {
    guarantorScore = 12; // Has registered guarantor
    const primaryG = guarantors[0];

    // Government or Department workplace check
    if (primaryG.department && primaryG.department.trim().length > 0) {
      guarantorScore += 5;
    }

    // Official letter / endorsement check
    if (primaryG.letterNumber && primaryG.letterNumber.trim().length > 0) {
      guarantorScore += 3;
    }
  }
  guarantorScore = Math.min(20, guarantorScore);

  // -------------------------------------------------------------
  // Pillar 4: Contract History & Customer Longevity (0 - 15 points)
  // -------------------------------------------------------------
  let historyScore = 8; // Starting balance for new customer

  const completedContractsCount = borrowerContracts.filter((c) => c.status === 'COMPLETED').length;
  if (completedContractsCount > 0) {
    historyScore = 15; // Proven track record
  } else if (borrowerContracts.length > 0 && overdueCount === 0 && paidOnTimeCount > 0) {
    historyScore = 12; // Active and paying cleanly
  }

  if (hasDefaultedContract || borrower.status === 'DEFAULTED') {
    historyScore = 0;
  }

  // Total raw score (0 - 100)
  let totalScore = punctualityScore + dtiScore + guarantorScore + historyScore;
  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  // -------------------------------------------------------------
  // Smart Auto-Blacklist Triggers
  // -------------------------------------------------------------
  let isBlacklisted = false;
  let blacklistReason: string | undefined;

  if (maxDaysOverdue >= 60) {
    isBlacklisted = true;
    blacklistReason = `تأخير حرج في سداد قسط لأكثر من 60 يوماً (${maxDaysOverdue} يوم تأخير)`;
    totalScore = Math.min(35, totalScore);
  } else if (borrower.status === 'DEFAULTED' || hasDefaultedContract) {
    isBlacklisted = true;
    blacklistReason = 'الزبون مسجل بحالة تعثر مالي أو عقد غير مسدد';
    totalScore = Math.min(25, totalScore);
  } else if (totalScore < 40) {
    isBlacklisted = true;
    blacklistReason = 'انخفاض التقييم الائتماني الإجمالي دون الحد الأدنى المقبول (40 نقطة)';
  }

  // -------------------------------------------------------------
  // Tier Classification
  // -------------------------------------------------------------
  let tier: CreditTier = 'B';
  let tierLabel = 'متوسط (برونزي B)';
  let tierShortLabel = 'برونزي B';
  let tierColor = 'amber';
  let tierBadgeClass = 'bg-amber-500/15 text-amber-300 border border-amber-500/30';

  if (isBlacklisted || totalScore < 40) {
    tier = 'D';
    tierLabel = 'قائمة سوداء (محظور D)';
    tierShortLabel = 'قائمة سوداء D';
    tierColor = 'red';
    tierBadgeClass = 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse';
  } else if (totalScore >= 90) {
    tier = 'AAA';
    tierLabel = 'ممتاز (ذهبي AAA)';
    tierShortLabel = 'ذهبي AAA';
    tierColor = 'emerald';
    tierBadgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black';
  } else if (totalScore >= 75) {
    tier = 'A';
    tierLabel = 'جيد جداً (فضي A)';
    tierShortLabel = 'فضي A';
    tierColor = 'cyan';
    tierBadgeClass = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
  } else if (totalScore >= 60) {
    tier = 'B';
    tierLabel = 'متوسط (برونزي B)';
    tierShortLabel = 'برونزي B';
    tierColor = 'amber';
    tierBadgeClass = 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
  } else {
    tier = 'C';
    tierLabel = 'عالي المخاطر (مقيد C)';
    tierShortLabel = 'مقيد C';
    tierColor = 'orange';
    tierBadgeClass = 'bg-orange-500/20 text-orange-300 border border-orange-500/40';
  }

  // -------------------------------------------------------------
  // Smart Credit Limit Calculator (اقتراح السقف الائتماني الأقصى)
  // -------------------------------------------------------------
  let recommendedCreditLimitIQD = 0;

  if (!isBlacklisted) {
    if (monthlyIncome > 0) {
      let maxDtiPercent = 0.30;
      if (tier === 'AAA') maxDtiPercent = 0.45;
      else if (tier === 'A') maxDtiPercent = 0.40;
      else if (tier === 'B') maxDtiPercent = 0.30;
      else if (tier === 'C') maxDtiPercent = 0.20;

      // Max allowable monthly installment over a 12-month standard term
      const maxMonthlyInstallment = monthlyIncome * maxDtiPercent;
      recommendedCreditLimitIQD = Math.round(maxMonthlyInstallment * 12);
    } else {
      // Default base limits if salary is unspecified
      if (tier === 'AAA') recommendedCreditLimitIQD = 4000000;
      else if (tier === 'A') recommendedCreditLimitIQD = 3000000;
      else if (tier === 'B') recommendedCreditLimitIQD = 1500000;
      else if (tier === 'C') recommendedCreditLimitIQD = 500000;
    }
  }

  const remainingDebt = borrower.remainingDebtIQD || 0;
  const availableCreditLimitIQD = isBlacklisted
    ? 0
    : Math.max(0, recommendedCreditLimitIQD - remainingDebt);

  return {
    borrowerId: borrower.id,
    borrowerName: borrower.name,
    totalScore,
    tier,
    tierLabel,
    tierShortLabel,
    tierColor,
    tierBadgeClass,
    isBlacklisted,
    blacklistReason,
    dtiRatio,
    monthlyInstallmentSum: activeMonthlySum,
    monthlyIncomeIQD: monthlyIncome,
    recommendedCreditLimitIQD,
    availableCreditLimitIQD,
    remainingDebtIQD: remainingDebt,
    overdueInstallmentsCount: overdueCount,
    maxDaysOverdue,
    breakdown: {
      punctualityScore,
      dtiScore,
      guarantorScore,
      historyScore,
      totalScore
    }
  };
}

/**
 * Aggregates credit quality and health metrics across the entire portfolio of borrowers.
 */
export function evaluatePortfolioCredit(
  borrowers: Borrower[],
  contracts: InstallmentContract[],
  referenceDate: Date = new Date()
): PortfolioCreditSummary {
  const evaluations = borrowers.map((b) => evaluateBorrowerCredit(b, contracts, referenceDate));

  const tierCounts: Record<CreditTier, number> = {
    AAA: 0,
    A: 0,
    B: 0,
    C: 0,
    D: 0
  };

  let totalScoreSum = 0;
  let blacklistedCount = 0;
  let totalExposureIQD = 0;
  let totalAvailableCreditIQD = 0;

  evaluations.forEach((ev) => {
    tierCounts[ev.tier]++;
    totalScoreSum += ev.totalScore;
    if (ev.isBlacklisted) blacklistedCount++;
    totalExposureIQD += ev.remainingDebtIQD;
    totalAvailableCreditIQD += ev.availableCreditLimitIQD;
  });

  const portfolioHealthIndex = borrowers.length > 0
    ? Math.round((totalScoreSum / (borrowers.length * 100)) * 100)
    : 100;

  return {
    evaluations,
    portfolioHealthIndex,
    tierCounts,
    blacklistedCount,
    totalExposureIQD,
    totalAvailableCreditIQD
  };
}
