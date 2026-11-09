export interface DebtLedgerEntry {
  id: string;
  debtAmount: number;
  debtDate: string;
  paidAmount: number;
  paidDate: string;
  remainingAmount: number;
  notes: string;
}

export interface DebtorAccount {
  id: string;
  debtorName: string;
  entries: DebtLedgerEntry[];
  totalDebt: number;
  totalPaid: number;
  totalRemaining: number;
  createdAt: string;
}

export function calculateEntryRemaining(debtAmount: number, paidAmount: number): number {
  const safeDebt = Number.isFinite(Number(debtAmount)) ? Math.max(0, Number(debtAmount)) : 0;
  const safePaid = Number.isFinite(Number(paidAmount)) ? Math.max(0, Number(paidAmount)) : 0;
  return Math.max(0, safeDebt - safePaid);
}

export function createEmptyDebtEntry(defaultDate?: string): DebtLedgerEntry {
  const today = defaultDate || new Date().toISOString().split('T')[0];
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    debtAmount: 0,
    debtDate: today,
    paidAmount: 0,
    paidDate: '',
    remainingAmount: 0,
    notes: '',
  };
}

export function normalizeDebtEntry(
  raw: Partial<DebtLedgerEntry>,
  fallbackIndex = 0
): DebtLedgerEntry {
  const debtAmount = Number.isFinite(Number(raw.debtAmount))
    ? Math.max(0, Number(raw.debtAmount))
    : 0;
  const paidAmount = Number.isFinite(Number(raw.paidAmount))
    ? Math.max(0, Number(raw.paidAmount))
    : 0;
  const remainingAmount = calculateEntryRemaining(debtAmount, paidAmount);

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim().length > 0
        ? raw.id.trim()
        : `entry-${fallbackIndex}-${Date.now()}`,
    debtAmount,
    debtDate: typeof raw.debtDate === 'string' ? raw.debtDate.trim().slice(0, 20) : '',
    paidAmount,
    paidDate: typeof raw.paidDate === 'string' ? raw.paidDate.trim().slice(0, 20) : '',
    remainingAmount,
    notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 500) : '',
  };
}

export function recalculateRunningEntries(
  rawEntries: Partial<DebtLedgerEntry>[]
): DebtLedgerEntry[] {
  let runningRemaining = 0;

  return rawEntries.map((raw, idx) => {
    const normalized = normalizeDebtEntry(raw, idx);
    runningRemaining = Math.max(
      0,
      runningRemaining + normalized.debtAmount - normalized.paidAmount
    );
    return {
      ...normalized,
      remainingAmount: runningRemaining,
    };
  });
}

export function calculateDebtorTotals(entries: DebtLedgerEntry[]): {
  totalDebt: number;
  totalPaid: number;
  totalRemaining: number;
} {
  let totalDebt = 0;
  let totalPaid = 0;

  for (const entry of entries) {
    const d = Number.isFinite(entry.debtAmount) ? Math.max(0, entry.debtAmount) : 0;
    const p = Number.isFinite(entry.paidAmount) ? Math.max(0, entry.paidAmount) : 0;
    totalDebt += d;
    totalPaid += p;
  }

  return {
    totalDebt,
    totalPaid,
    totalRemaining: Math.max(0, totalDebt - totalPaid),
  };
}

export function createDebtorAccount(params: {
  id?: string;
  debtorName: string;
  entries?: Partial<DebtLedgerEntry>[];
  createdAt?: string;
}): DebtorAccount {
  const cleanName = params.debtorName.trim().slice(0, 255);
  if (!cleanName) {
    throw new Error('اسم المدين مطلوب');
  }

  const normalizedEntries =
    params.entries && params.entries.length > 0
      ? recalculateRunningEntries(params.entries)
      : [];

  const totals = calculateDebtorTotals(normalizedEntries);
  const createdAt = params.createdAt || new Date().toISOString().split('T')[0];

  return {
    id: params.id || `debtor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    debtorName: cleanName,
    entries: normalizedEntries,
    totalDebt: totals.totalDebt,
    totalPaid: totals.totalPaid,
    totalRemaining: totals.totalRemaining,
    createdAt,
  };
}

export interface RawDirectDebtRow {
  id: string;
  borrowerName: string;
  totalAmountIQD?: string | number | null;
  downPaymentIQD?: string | number | null;
  startDate?: Date | string | null;
  notes?: string | null;
  createdAt?: Date | string | null;
}

export function parseDebtorAccountFromDbRow(row: RawDirectDebtRow): DebtorAccount {
  const dateStr = row.startDate
    ? new Date(row.startDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  let parsedEntries: DebtLedgerEntry[] | null = null;

  if (row.notes && typeof row.notes === 'string' && row.notes.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(row.notes) as { entries?: Partial<DebtLedgerEntry>[] };
      if (Array.isArray(parsed.entries)) {
        parsedEntries = parsed.entries.map((e, idx) => normalizeDebtEntry(e, idx));
      }
    } catch {
      parsedEntries = null;
    }
  }

  if (!parsedEntries) {
    const legacyDebt = parseFloat(String(row.totalAmountIQD || '0')) || 0;
    const legacyPaid = parseFloat(String(row.downPaymentIQD || '0')) || 0;
    parsedEntries = [
      normalizeDebtEntry(
        {
          id: `entry-${row.id}-0`,
          debtAmount: legacyDebt,
          debtDate: dateStr,
          paidAmount: legacyPaid,
          paidDate: legacyPaid > 0 ? dateStr : '',
          notes: typeof row.notes === 'string' ? row.notes : '',
        },
        0
      ),
    ];
  }

  const createdStr = row.createdAt
    ? new Date(row.createdAt).toISOString().split('T')[0]
    : dateStr;

  return createDebtorAccount({
    id: row.id,
    debtorName: row.borrowerName || 'مدين',
    entries: parsedEntries,
    createdAt: createdStr,
  });
}

export function serializeDebtorAccountForDb(account: DebtorAccount): {
  borrowerName: string;
  totalAmountIQD: string;
  downPaymentIQD: string;
  notes: string;
} {
  const normalizedEntries = recalculateRunningEntries(account.entries);
  const totals = calculateDebtorTotals(normalizedEntries);

  return {
    borrowerName: account.debtorName.trim().slice(0, 255),
    totalAmountIQD: totals.totalDebt.toFixed(2),
    downPaymentIQD: totals.totalPaid.toFixed(2),
    notes: JSON.stringify({
      version: 2,
      entries: normalizedEntries,
    }),
  };
}

export type DebtorStatusFilter = 'ALL' | 'ACTIVE' | 'SETTLED';
export type DebtorSortBy = 'HIGHEST_REMAINING' | 'RECENT' | 'NAME';

export function getDebtorLastActivityDate(account: DebtorAccount): string {
  let latest = account.createdAt || '';
  for (const entry of account.entries) {
    if (entry.paidDate && entry.paidDate > latest) latest = entry.paidDate;
    if (entry.debtDate && entry.debtDate > latest) latest = entry.debtDate;
  }
  return latest;
}

export function filterAndSortDebtors(
  accounts: DebtorAccount[],
  options: {
    searchTerm?: string;
    statusFilter?: DebtorStatusFilter;
    sortBy?: DebtorSortBy;
  } = {}
): DebtorAccount[] {
  const q = (options.searchTerm || '').trim().toLowerCase();
  const statusFilter = options.statusFilter || 'ALL';
  const sortBy = options.sortBy || 'HIGHEST_REMAINING';

  const filtered = accounts.filter((acc) => {
    if (statusFilter === 'ACTIVE' && acc.totalRemaining <= 0) return false;
    if (statusFilter === 'SETTLED' && acc.totalRemaining > 0) return false;
    if (!q) return true;
    const nameMatch = acc.debtorName.toLowerCase().includes(q);
    const notesMatch = acc.entries.some((e) => e.notes.toLowerCase().includes(q));
    return nameMatch || notesMatch;
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'HIGHEST_REMAINING') {
      return b.totalRemaining - a.totalRemaining;
    }
    if (sortBy === 'NAME') {
      return a.debtorName.localeCompare(b.debtorName, 'ar');
    }
    const dateA = getDebtorLastActivityDate(a);
    const dateB = getDebtorLastActivityDate(b);
    return dateB.localeCompare(dateA);
  });
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize = 10
): {
  pagedItems: T[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
} {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  return {
    pagedItems: items.slice(startIndex, startIndex + safePageSize),
    totalPages,
    currentPage,
    totalItems,
  };
}

export function getVisibleEntries(
  entries: DebtLedgerEntry[],
  showAll: boolean,
  limit = 4
): {
  visibleEntries: DebtLedgerEntry[];
  hiddenCount: number;
} {
  const safeLimit = Math.max(1, limit);
  if (showAll || entries.length <= safeLimit) {
    return { visibleEntries: entries, hiddenCount: 0 };
  }
  const hiddenCount = entries.length - safeLimit;
  return {
    visibleEntries: entries.slice(hiddenCount),
    hiddenCount,
  };
}


