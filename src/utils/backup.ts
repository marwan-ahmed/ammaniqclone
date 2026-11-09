// Backup & Restore Engine Types and Validation Utilities
// For Finance System "Aman" - Samarra, Iraq

export interface BackupMetadata {
  version: string;
  systemName: string;
  exportedAt: string;
  totalRecords: number;
  tableCounts: Record<string, number>;
}

export interface BackupDataPayload {
  companies?: Record<string, unknown>[];
  investors?: Record<string, unknown>[];
  investorContracts?: Record<string, unknown>[];
  wallets?: Record<string, unknown>[];
  inventoryItems?: Record<string, unknown>[];
  borrowers?: Record<string, unknown>[];
  installmentContracts?: Record<string, unknown>[];
  installmentSchedules?: Record<string, unknown>[];
  ledgerTransactions?: Record<string, unknown>[];
  employees?: Record<string, unknown>[];
  expenses?: Record<string, unknown>[];
  revenues?: Record<string, unknown>[];
  directDebts?: Record<string, unknown>[];
  directDebtSchedules?: Record<string, unknown>[];
  trashItems?: Record<string, unknown>[];
  systemSettings?: Record<string, unknown>[];
}

export interface FullBackupPayload {
  version: string;
  system: string;
  exportedAt: string;
  metadata: BackupMetadata;
  data: BackupDataPayload;
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  summary?: {
    version: string;
    exportedAt: string;
    totalRecords: number;
    borrowersCount: number;
    contractsCount: number;
    investorsCount: number;
    schedulesCount: number;
    tableCounts: Record<string, number>;
  };
}

export const BACKUP_VERSION = '1.0';
export const SYSTEM_NAME = 'نظام أمان للتقسيط - سامراء';

export const ORDERED_TABLE_KEYS = [
  'companies',
  'investors',
  'wallets',
  'investorContracts',
  'borrowers',
  'inventoryItems',
  'expenses',
  'revenues',
  'installmentContracts',
  'installmentSchedules',
  'ledgerTransactions',
  'directDebts',
  'directDebtSchedules',
  'employees',
  'trashItems',
  'systemSettings'
] as const;

export function generateBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `aman_backup_${yyyy}-${mm}-${dd}_${hh}-${min}.json`;
}

export const DATE_FIELD_NAMES = new Set([
  'createdAt',
  'updatedAt',
  'contractDate',
  'purchaseDate',
  'startDate',
  'dueDate',
  'paidDate',
  'date',
  'deletedAt'
]);

export function sanitizeRowDates<T extends Record<string, unknown>>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const sanitized: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(sanitized)) {
    if (DATE_FIELD_NAMES.has(key) && value !== null && value !== undefined) {
      if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          sanitized[key] = parsed;
        }
      }
    }
  }
  return sanitized as T;
}

export function validateBackupData(payload: unknown): BackupValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'ملف النسخة الاحتياطية غير صالح أو فارغ' };
  }

  const obj = payload as Record<string, unknown>;

  if (typeof obj.version !== 'string') {
    return { isValid: false, error: 'الملف لا يحتوي على رقم إصدار معتمد للنسخ الاحتياطي (version)' };
  }

  if (!obj.data || typeof obj.data !== 'object') {
    return { isValid: false, error: 'الملف لا يحتوي على قسم البيانات الأساسي (data)' };
  }

  const data = obj.data as Record<string, unknown>;

  // Check that present tables are arrays
  let totalRecords = 0;
  const tableCounts: Record<string, number> = {};

  for (const tableKey of ORDERED_TABLE_KEYS) {
    if (tableKey in data) {
      if (!Array.isArray(data[tableKey])) {
        return { isValid: false, error: `جدول (${tableKey}) يحتوي على بنية بيانات غير صالحة (يجب أن يكون مصفوفة)` };
      }
      const count = data[tableKey].length;
      tableCounts[tableKey] = count;
      totalRecords += count;
    } else {
      tableCounts[tableKey] = 0;
    }
  }

  const borrowersCount = tableCounts['borrowers'] || 0;
  const contractsCount = tableCounts['installmentContracts'] || 0;
  const investorsCount = tableCounts['investors'] || 0;
  const schedulesCount = tableCounts['installmentSchedules'] || 0;

  return {
    isValid: true,
    summary: {
      version: obj.version,
      exportedAt: typeof obj.exportedAt === 'string' && obj.exportedAt ? obj.exportedAt : new Date().toISOString(),
      totalRecords,
      borrowersCount,
      contractsCount,
      investorsCount,
      schedulesCount,
      tableCounts
    }
  };
}
