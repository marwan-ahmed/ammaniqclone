import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  companies,
  investors,
  investorContracts,
  wallets,
  inventoryItems,
  borrowers,
  installmentContracts,
  installmentSchedules,
  ledgerTransactions,
  employees,
  expenses,
  revenues,
  directDebts,
  directDebtSchedules,
  trashItems,
  systemSettings
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  BACKUP_VERSION,
  SYSTEM_NAME,
  generateBackupFilename,
  FullBackupPayload
} from '@/utils/backup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { adminPasscode } = body;

    // 1. Verify Admin Passcode Security
    const passcodeRow = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'admin_passcode'))
      .limit(1);

    const actualPasscode = passcodeRow[0]?.value || '2026';

    if (!adminPasscode || String(adminPasscode).trim() !== actualPasscode) {
      return NextResponse.json(
        {
          success: false,
          message: 'رمز أمان الإدارة غير صحيح. يرجى إدخال رمز المرور الإداري الصحيح.'
        },
        { status: 401 }
      );
    }

    // 2. Fetch all 16 tables data in parallel
    const [
      companiesData,
      investorsData,
      investorContractsData,
      walletsData,
      inventoryItemsData,
      borrowersData,
      installmentContractsData,
      installmentSchedulesData,
      ledgerTransactionsData,
      employeesData,
      expensesData,
      revenuesData,
      directDebtsData,
      directDebtSchedulesData,
      trashItemsData,
      systemSettingsData
    ] = await Promise.all([
      db.select().from(companies),
      db.select().from(investors),
      db.select().from(investorContracts),
      db.select().from(wallets),
      db.select().from(inventoryItems),
      db.select().from(borrowers),
      db.select().from(installmentContracts),
      db.select().from(installmentSchedules),
      db.select().from(ledgerTransactions),
      db.select().from(employees),
      db.select().from(expenses),
      db.select().from(revenues),
      db.select().from(directDebts),
      db.select().from(directDebtSchedules),
      db.select().from(trashItems),
      db.select().from(systemSettings)
    ]);

    const tableCounts: Record<string, number> = {
      companies: companiesData.length,
      investors: investorsData.length,
      investorContracts: investorContractsData.length,
      wallets: walletsData.length,
      inventoryItems: inventoryItemsData.length,
      borrowers: borrowersData.length,
      installmentContracts: installmentContractsData.length,
      installmentSchedules: installmentSchedulesData.length,
      ledgerTransactions: ledgerTransactionsData.length,
      employees: employeesData.length,
      expenses: expensesData.length,
      revenues: revenuesData.length,
      directDebts: directDebtsData.length,
      directDebtSchedules: directDebtSchedulesData.length,
      trashItems: trashItemsData.length,
      systemSettings: systemSettingsData.length
    };

    const totalRecords = Object.values(tableCounts).reduce((acc, count) => acc + count, 0);
    const now = new Date();
    const exportedAt = now.toISOString();
    const filename = generateBackupFilename(now);

    const fullPayload: FullBackupPayload = {
      version: BACKUP_VERSION,
      system: SYSTEM_NAME,
      exportedAt,
      metadata: {
        version: BACKUP_VERSION,
        systemName: SYSTEM_NAME,
        exportedAt,
        totalRecords,
        tableCounts
      },
      data: {
        companies: companiesData,
        investors: investorsData,
        investorContracts: investorContractsData,
        wallets: walletsData,
        inventoryItems: inventoryItemsData,
        borrowers: borrowersData,
        installmentContracts: installmentContractsData,
        installmentSchedules: installmentSchedulesData,
        ledgerTransactions: ledgerTransactionsData,
        employees: employeesData,
        expenses: expensesData,
        revenues: revenuesData,
        directDebts: directDebtsData,
        directDebtSchedules: directDebtSchedulesData,
        trashItems: trashItemsData,
        systemSettings: systemSettingsData
      }
    };

    return NextResponse.json({
      success: true,
      message: 'تم تصدير النسخة الاحتياطية بنجاح',
      filename,
      metadata: fullPayload.metadata,
      backup: fullPayload
    });
  } catch (error: unknown) {
    console.error('Error generating full backup export:', error);
    const errMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء تصدير النسخة الاحتياطية';
    return NextResponse.json(
      {
        success: false,
        message: errMessage
      },
      { status: 500 }
    );
  }
}
