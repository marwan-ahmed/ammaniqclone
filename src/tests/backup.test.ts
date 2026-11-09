import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateBackupFilename,
  validateBackupData,
  sanitizeRowDates,
  BACKUP_VERSION,
  SYSTEM_NAME,
  FullBackupPayload
} from '../utils/backup';

describe('Backup & Restore Utility Engine', () => {
  it('generates standard safe backup filename with date and time', () => {
    const fixedDate = new Date(2026, 10, 4, 15, 30); // 4 Nov 2026 15:30
    const filename = generateBackupFilename(fixedDate);
    assert.strictEqual(filename, 'aman_backup_2026-11-04_15-30.json');
  });

  it('rejects null, non-object, or empty input', () => {
    assert.strictEqual(validateBackupData(null).isValid, false);
    assert.strictEqual(validateBackupData(undefined).isValid, false);
    assert.strictEqual(validateBackupData('invalid string').isValid, false);
    assert.strictEqual(validateBackupData(12345).isValid, false);
  });

  it('rejects backup payload missing version or data field', () => {
    const noVersion = { system: SYSTEM_NAME, data: {} };
    const res1 = validateBackupData(noVersion);
    assert.strictEqual(res1.isValid, false);
    assert.match(res1.error || '', /version/i);

    const noData = { version: BACKUP_VERSION, system: SYSTEM_NAME };
    const res2 = validateBackupData(noData);
    assert.strictEqual(res2.isValid, false);
    assert.match(res2.error || '', /data/i);
  });

  it('rejects backup payload where a table is not an array', () => {
    const corruptedData = {
      version: BACKUP_VERSION,
      system: SYSTEM_NAME,
      data: {
        borrowers: 'not an array'
      }
    };
    const res = validateBackupData(corruptedData);
    assert.strictEqual(res.isValid, false);
    assert.match(res.error || '', /borrowers.*مصفوفة/i);
  });

  it('validates a complete valid backup payload and calculates accurate summary statistics', () => {
    const validBackup: FullBackupPayload = {
      version: BACKUP_VERSION,
      system: SYSTEM_NAME,
      exportedAt: '2026-11-04T12:00:00.000Z',
      metadata: {
        version: BACKUP_VERSION,
        systemName: SYSTEM_NAME,
        exportedAt: '2026-11-04T12:00:00.000Z',
        totalRecords: 8,
        tableCounts: {
          companies: 1,
          investors: 2,
          borrowers: 3,
          installmentContracts: 2
        }
      },
      data: {
        companies: [{ id: 'c1', name: 'نظام أمان' }],
        investors: [{ id: 'inv1' }, { id: 'inv2' }],
        borrowers: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }],
        installmentContracts: [{ id: 'ct1' }, { id: 'ct2' }],
        wallets: [],
        expenses: [],
        revenues: []
      }
    };

    const res = validateBackupData(validBackup);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.summary?.version, BACKUP_VERSION);
    assert.strictEqual(res.summary?.totalRecords, 8);
    assert.strictEqual(res.summary?.borrowersCount, 3);
    assert.strictEqual(res.summary?.contractsCount, 2);
    assert.strictEqual(res.summary?.investorsCount, 2);
    assert.strictEqual(res.summary?.tableCounts.borrowers, 3);
    assert.strictEqual(res.summary?.tableCounts.expenses, 0);
  });

  it('sanitizeRowDates correctly converts ISO date strings to real Date instances while preserving other fields', () => {
    const rawRow: Record<string, unknown> = {
      id: 'inv-123',
      name: 'مستثمر تجريبي',
      amountIQD: '500000.00',
      createdAt: '2026-11-04T10:15:30.000Z',
      contractDate: '2026-11-01T00:00:00.000Z',
      dueDate: '2026-12-01T00:00:00.000Z',
      unrelatedField: 'safe'
    };

    const sanitized = sanitizeRowDates(rawRow);
    assert.strictEqual(sanitized.id, 'inv-123');
    assert.strictEqual(sanitized.amountIQD, '500000.00');
    assert.strictEqual(sanitized.unrelatedField, 'safe');
    assert.ok(sanitized.createdAt && typeof sanitized.createdAt === 'object' && sanitized.createdAt instanceof Date);
    assert.ok(sanitized.contractDate && typeof sanitized.contractDate === 'object' && sanitized.contractDate instanceof Date);
    assert.ok(sanitized.dueDate && typeof sanitized.dueDate === 'object' && sanitized.dueDate instanceof Date);
    assert.strictEqual((sanitized.createdAt as Date).toISOString(), '2026-11-04T10:15:30.000Z');
  });

  it('sanitizeRowDates handles null and undefined date fields gracefully without crashing', () => {
    const rowWithNulls: Record<string, unknown> = {
      id: 'inv-456',
      createdAt: null,
      paidDate: undefined,
      dueDate: 'not-a-valid-date'
    };
    const sanitized = sanitizeRowDates(rowWithNulls);
    assert.strictEqual(sanitized.createdAt, null);
    assert.strictEqual(sanitized.paidDate, undefined);
    assert.strictEqual(sanitized.dueDate, 'not-a-valid-date');
  });
});
