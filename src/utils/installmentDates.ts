/**
 * Installment Dates & Overdue Calculation Utilities
 * Calculates day-precision due dates, overdue counters, and collector alert categories.
 */

import { InstallmentContract } from '@/types/finance';

export type InstallmentDueStatus = 'PAID' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'FUTURE';

export type OverdueSeverity = 'NONE' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface InstallmentDueInfo {
  status: InstallmentDueStatus;
  diffDays: number; // Negative = overdue, 0 = due today, positive = days until due
  daysOverdue: number; // Absolute days overdue (0 if not overdue)
  daysRemaining: number; // Absolute days remaining (0 if past due or today)
  label: string; // Human-readable Arabic label with English numbers
  shortLabel: string;
  severity: OverdueSeverity;
  badgeClassName: string;
}

/**
 * Normalizes any date string or Date object to local calendar day midnight (00:00:00.000).
 */
export function normalizeToMidnight(dateInput: string | Date | number): Date {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return new Date();
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Calculates due status and day difference for an installment schedule.
 *
 * @param dueDateStr - Due date of schedule (YYYY-MM-DD or ISO string)
 * @param isPaid - Whether installment is already paid
 * @param referenceDate - Optional baseline date (defaults to current date)
 */
export function calculateInstallmentDueStatus(
  dueDateStr: string,
  isPaid: boolean,
  referenceDate: Date = new Date()
): InstallmentDueInfo {
  if (isPaid) {
    return {
      status: 'PAID',
      diffDays: 0,
      daysOverdue: 0,
      daysRemaining: 0,
      label: 'مسدد بالكامل',
      shortLabel: 'مسدد',
      severity: 'NONE',
      badgeClassName: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    };
  }

  const dueMidnight = normalizeToMidnight(dueDateStr);
  const refMidnight = normalizeToMidnight(referenceDate);

  const diffMs = dueMidnight.getTime() - refMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    const severity: OverdueSeverity =
      daysOverdue > 30 ? 'CRITICAL' : daysOverdue > 7 ? 'HIGH' : 'MODERATE';

    const badgeClassName =
      severity === 'CRITICAL'
        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black animate-pulse'
        : severity === 'HIGH'
        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold'
        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium';

    return {
      status: 'OVERDUE',
      diffDays,
      daysOverdue,
      daysRemaining: 0,
      label: `متأخر منذ ${daysOverdue} يوم`,
      shortLabel: `متأخر (${daysOverdue} يوم)`,
      severity,
      badgeClassName
    };
  }

  if (diffDays === 0) {
    return {
      status: 'DUE_TODAY',
      diffDays: 0,
      daysOverdue: 0,
      daysRemaining: 0,
      label: 'يستحق اليوم',
      shortLabel: 'اليوم',
      severity: 'HIGH',
      badgeClassName: 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold'
    };
  }

  // Future installments
  const daysRemaining = diffDays;
  if (daysRemaining <= 7) {
    return {
      status: 'UPCOMING',
      diffDays,
      daysOverdue: 0,
      daysRemaining,
      label: `باقي ${daysRemaining} أيام على موعد السداد`,
      shortLabel: `باقي ${daysRemaining} أيام`,
      severity: 'MODERATE',
      badgeClassName: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold'
    };
  }

  return {
    status: 'FUTURE',
    diffDays,
    daysOverdue: 0,
    daysRemaining,
    label: `باقي ${daysRemaining} يوم`,
    shortLabel: `باقي ${daysRemaining} يوم`,
    severity: 'NONE',
    badgeClassName: 'bg-slate-800 text-slate-400 border border-slate-700 font-normal'
  };
}

export interface BorrowerDueSummary {
  borrowerId: string;
  hasOverdue: boolean;
  maxDaysOverdue: number;
  overdueCount: number;
  totalOverdueAmountIQD: number;
  hasDueToday: boolean;
  dueTodayCount: number;
  hasUpcoming: boolean;
  upcomingCount: number;
  earliestUpcomingDays: number | null;
  overallStatus: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'SETTLED' | 'REGULAR';
  summaryBadge: {
    label: string;
    className: string;
  };
}

/**
 * Aggregates all contracts and schedules for a given borrower to determine
 * their overall collection alert status.
 */
export function getBorrowerDueSummary(
  borrowerId: string,
  contracts: InstallmentContract[],
  referenceDate: Date = new Date()
): BorrowerDueSummary {
  const borrowerContracts = contracts.filter((c) => c.borrowerId === borrowerId);

  let hasOverdue = false;
  let maxDaysOverdue = 0;
  let overdueCount = 0;
  let totalOverdueAmountIQD = 0;

  let hasDueToday = false;
  let dueTodayCount = 0;

  let hasUpcoming = false;
  let upcomingCount = 0;
  let earliestUpcomingDays: number | null = null;

  let totalUnpaidSchedules = 0;

  for (const contract of borrowerContracts) {
    for (const schedule of contract.schedules) {
      const isPaid = schedule.status === 'PAID';
      if (!isPaid) {
        totalUnpaidSchedules++;
        const info = calculateInstallmentDueStatus(schedule.dueDate, isPaid, referenceDate);

        if (info.status === 'OVERDUE') {
          hasOverdue = true;
          overdueCount++;
          totalOverdueAmountIQD += schedule.amountIQD;
          if (info.daysOverdue > maxDaysOverdue) {
            maxDaysOverdue = info.daysOverdue;
          }
        } else if (info.status === 'DUE_TODAY') {
          hasDueToday = true;
          dueTodayCount++;
        } else if (info.status === 'UPCOMING') {
          hasUpcoming = true;
          upcomingCount++;
          if (earliestUpcomingDays === null || info.daysRemaining < earliestUpcomingDays) {
            earliestUpcomingDays = info.daysRemaining;
          }
        }
      }
    }
  }

  if (hasOverdue) {
    return {
      borrowerId,
      hasOverdue,
      maxDaysOverdue,
      overdueCount,
      totalOverdueAmountIQD,
      hasDueToday,
      dueTodayCount,
      hasUpcoming,
      upcomingCount,
      earliestUpcomingDays,
      overallStatus: 'OVERDUE',
      summaryBadge: {
        label: `متأخر (${maxDaysOverdue} يوم)`,
        className:
          maxDaysOverdue > 30
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse'
            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold'
      }
    };
  }

  if (hasDueToday) {
    return {
      borrowerId,
      hasOverdue,
      maxDaysOverdue,
      overdueCount,
      totalOverdueAmountIQD,
      hasDueToday,
      dueTodayCount,
      hasUpcoming,
      upcomingCount,
      earliestUpcomingDays,
      overallStatus: 'DUE_TODAY',
      summaryBadge: {
        label: 'يستحق قسط اليوم',
        className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold'
      }
    };
  }

  if (hasUpcoming && earliestUpcomingDays !== null) {
    return {
      borrowerId,
      hasOverdue,
      maxDaysOverdue,
      overdueCount,
      totalOverdueAmountIQD,
      hasDueToday,
      dueTodayCount,
      hasUpcoming,
      upcomingCount,
      earliestUpcomingDays,
      overallStatus: 'UPCOMING',
      summaryBadge: {
        label: `قسط قادم (باقي ${earliestUpcomingDays} أيام)`,
        className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold'
      }
    };
  }

  if (borrowerContracts.length > 0 && totalUnpaidSchedules === 0) {
    return {
      borrowerId,
      hasOverdue,
      maxDaysOverdue,
      overdueCount,
      totalOverdueAmountIQD,
      hasDueToday,
      dueTodayCount,
      hasUpcoming,
      upcomingCount,
      earliestUpcomingDays,
      overallStatus: 'SETTLED',
      summaryBadge: {
        label: 'مسدد',
        className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      }
    };
  }

  return {
    borrowerId,
    hasOverdue,
    maxDaysOverdue,
    overdueCount,
    totalOverdueAmountIQD,
    hasDueToday,
    dueTodayCount,
    hasUpcoming,
    upcomingCount,
    earliestUpcomingDays,
    overallStatus: 'REGULAR',
    summaryBadge: {
      label: 'منتظم بالسداد',
      className: 'bg-slate-800 text-slate-300 border border-slate-700'
    }
  };
}

/**
 * Determines whether a borrower has completely settled their loan(s).
 * - When all loans are fully repaid: "مسدد"
 * - When there is any remaining unpaid debt: "نشط"
 */
export function isBorrowerSettled(borrower: {
  status?: string;
  totalFinancedIQD?: number;
  remainingDebtIQD?: number;
}): boolean {
  if (borrower.status === 'SETTLED') return true;
  if ((borrower.totalFinancedIQD ?? 0) > 0 && (borrower.remainingDebtIQD ?? 0) <= 0) return true;
  return false;
}

/**
 * Determines whether an installment contract is fully completed / settled.
 * A contract is completed when:
 * 1. Its status is explicitly 'COMPLETED', OR
 * 2. It has schedules and all schedules are marked 'PAID', OR
 * 3. Total paid (down payment + paid schedules) >= totalSalePriceIQD (with totalSalePriceIQD > 0).
 */
export function isContractCompleted(contract: {
  status?: string;
  totalSalePriceIQD?: number;
  downPaymentIQD?: number;
  schedules?: Array<{ status?: string; amountIQD?: number }>;
}): boolean {
  if (contract.status === 'COMPLETED') return true;

  if (Array.isArray(contract.schedules) && contract.schedules.length > 0) {
    const allPaid = contract.schedules.every((s) => s.status === 'PAID');
    if (allPaid) return true;
  }

  const totalSale = contract.totalSalePriceIQD ?? 0;
  if (totalSale > 0) {
    const downPayment = contract.downPaymentIQD ?? 0;
    const paidSchedules = (contract.schedules || [])
      .filter((s) => s.status === 'PAID')
      .reduce((sum, s) => sum + (s.amountIQD ?? 0), 0);
    const totalPaid = downPayment + paidSchedules;
    if (totalPaid >= totalSale) return true;
  }

  return false;
}

/**
 * Returns the exact Arabic display label and styling for borrower status:
 * - "مسدد" when fully repaid
 * - "نشط" when there is remaining debt or active status
 */
export function getBorrowerStatusDisplay(borrower: {
  status?: string;
  totalFinancedIQD?: number;
  remainingDebtIQD?: number;
}): {
  label: 'مسدد' | 'نشط';
  className: string;
} {
  const settled = isBorrowerSettled(borrower);
  if (settled) {
    return {
      label: 'مسدد',
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    };
  }
  return {
    label: 'نشط',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };
}

export const BORROWERS_CARD_LAYOUT_KEY = 'aman_borrowers_card_layout_mode';
export const INVOICES_VIEW_MODE_KEY = 'aman_invoices_view_mode';

/**
 * Retrieves the persisted borrower card layout mode ('grid' | 'list') from localStorage.
 * Defaults to 'grid' if not set, on SSR, or on invalid stored value.
 */
export function getPersistedBorrowersCardLayout(): 'grid' | 'list' {
  if (typeof window !== 'undefined') {
    try {
      const storage = window.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!storage) return 'grid';
      const saved = storage.getItem(BORROWERS_CARD_LAYOUT_KEY);
      if (saved === 'grid' || saved === 'list') {
        return saved;
      }
    } catch {
      // ignore localStorage errors (e.g. private mode or SSR)
    }
  }
  return 'grid';
}

/**
 * Persists the borrower card layout mode ('grid' | 'list') to localStorage.
 */
export function persistBorrowersCardLayout(mode: 'grid' | 'list'): void {
  if (typeof window !== 'undefined') {
    try {
      const storage = window.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
      if (storage) {
        storage.setItem(BORROWERS_CARD_LAYOUT_KEY, mode);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Retrieves the persisted invoices view mode ('cards' | 'table') from localStorage.
 * Defaults to 'cards' if not set, on SSR, or on invalid stored value.
 */
export function getPersistedInvoicesViewMode(): 'cards' | 'table' {
  if (typeof window !== 'undefined') {
    try {
      const storage = window.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!storage) return 'cards';
      const saved = storage.getItem(INVOICES_VIEW_MODE_KEY);
      if (saved === 'cards' || saved === 'table') {
        return saved;
      }
    } catch {
      // ignore localStorage errors
    }
  }
  return 'cards';
}

/**
 * Persists the invoices view mode ('cards' | 'table') to localStorage.
 */
export function persistInvoicesViewMode(mode: 'cards' | 'table'): void {
  if (typeof window !== 'undefined') {
    try {
      const storage = window.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
      if (storage) {
        storage.setItem(INVOICES_VIEW_MODE_KEY, mode);
      }
    } catch {
      // ignore
    }
  }
}

