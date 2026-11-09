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
import { validateBackupData, sanitizeRowDates } from '@/utils/backup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { adminPasscode, backupData } = body;

    // 1. Verify Admin Passcode
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
          message: 'رمز أمان الإدارة غير صحيح. يرجى إدخال رمز المرور الإداري المعتمد للتحقق.'
        },
        { status: 401 }
      );
    }

    // 2. Validate Backup Payload Structure
    const validation = validateBackupData(backupData);
    if (!validation.isValid || !validation.summary) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error || 'ملف النسخة الاحتياطية غير صالح أو تالف'
        },
        { status: 400 }
      );
    }

    const d = backupData.data;

    // 3. Execute atomic transaction to wipe and restore in strict dependency order
    await db.transaction(async (tx) => {
      // Step A: Delete all existing data in reverse dependency order
      await tx.delete(directDebtSchedules);
      await tx.delete(directDebts);
      await tx.delete(installmentSchedules);
      await tx.delete(installmentContracts);
      await tx.delete(ledgerTransactions);
      await tx.delete(expenses);
      await tx.delete(revenues);
      await tx.delete(inventoryItems);
      await tx.delete(borrowers);
      await tx.delete(investorContracts);
      await tx.delete(wallets);
      await tx.delete(investors);
      await tx.delete(trashItems);
      await tx.delete(employees);
      await tx.delete(companies);
      await tx.delete(systemSettings);

      // Step B: Insert data in forward dependency order with chunking for large tables
      if (d.companies && d.companies.length > 0) {
        await tx.insert(companies).values(d.companies.map(sanitizeRowDates) as unknown as (typeof companies.$inferInsert)[]);
      }

      if (d.investors && d.investors.length > 0) {
        await tx.insert(investors).values(d.investors.map(sanitizeRowDates) as unknown as (typeof investors.$inferInsert)[]);
      }

      if (d.wallets && d.wallets.length > 0) {
        await tx.insert(wallets).values(d.wallets.map(sanitizeRowDates) as unknown as (typeof wallets.$inferInsert)[]);
      }

      if (d.investorContracts && d.investorContracts.length > 0) {
        await tx.insert(investorContracts).values(d.investorContracts.map(sanitizeRowDates) as unknown as (typeof investorContracts.$inferInsert)[]);
      }

      if (d.borrowers && d.borrowers.length > 0) {
        await tx.insert(borrowers).values(d.borrowers.map(sanitizeRowDates) as unknown as (typeof borrowers.$inferInsert)[]);
      }

      if (d.inventoryItems && d.inventoryItems.length > 0) {
        await tx.insert(inventoryItems).values(d.inventoryItems.map(sanitizeRowDates) as unknown as (typeof inventoryItems.$inferInsert)[]);
      }

      if (d.expenses && d.expenses.length > 0) {
        await tx.insert(expenses).values(d.expenses.map(sanitizeRowDates) as unknown as (typeof expenses.$inferInsert)[]);
      }

      if (d.revenues && d.revenues.length > 0) {
        await tx.insert(revenues).values(d.revenues.map(sanitizeRowDates) as unknown as (typeof revenues.$inferInsert)[]);
      }

      if (d.installmentContracts && d.installmentContracts.length > 0) {
        await tx.insert(installmentContracts).values(d.installmentContracts.map(sanitizeRowDates) as unknown as (typeof installmentContracts.$inferInsert)[]);
      }

      if (d.installmentSchedules && d.installmentSchedules.length > 0) {
        const schedules = d.installmentSchedules.map(sanitizeRowDates) as unknown as (typeof installmentSchedules.$inferInsert)[];
        for (let i = 0; i < schedules.length; i += 200) {
          await tx.insert(installmentSchedules).values(schedules.slice(i, i + 200));
        }
      }

      if (d.ledgerTransactions && d.ledgerTransactions.length > 0) {
        const txs = d.ledgerTransactions.map(sanitizeRowDates) as unknown as (typeof ledgerTransactions.$inferInsert)[];
        for (let i = 0; i < txs.length; i += 200) {
          await tx.insert(ledgerTransactions).values(txs.slice(i, i + 200));
        }
      }

      if (d.directDebts && d.directDebts.length > 0) {
        await tx.insert(directDebts).values(d.directDebts.map(sanitizeRowDates) as unknown as (typeof directDebts.$inferInsert)[]);
      }

      if (d.directDebtSchedules && d.directDebtSchedules.length > 0) {
        const ddSchedules = d.directDebtSchedules.map(sanitizeRowDates) as unknown as (typeof directDebtSchedules.$inferInsert)[];
        for (let i = 0; i < ddSchedules.length; i += 200) {
          await tx.insert(directDebtSchedules).values(ddSchedules.slice(i, i + 200));
        }
      }

      if (d.employees && d.employees.length > 0) {
        await tx.insert(employees).values(d.employees.map(sanitizeRowDates) as unknown as (typeof employees.$inferInsert)[]);
      }

      if (d.trashItems && d.trashItems.length > 0) {
        await tx.insert(trashItems).values(d.trashItems.map(sanitizeRowDates) as unknown as (typeof trashItems.$inferInsert)[]);
      }

      if (d.systemSettings && d.systemSettings.length > 0) {
        await tx.insert(systemSettings).values(d.systemSettings.map(sanitizeRowDates) as unknown as (typeof systemSettings.$inferInsert)[]);
      } else {
        // Ensure admin passcode exists even if backup had no settings table
        await tx.insert(systemSettings).values({
          key: 'admin_passcode',
          value: actualPasscode,
          description: 'رمز أمان الإدارة العامة لعمليات الحذف وتفريغ سلة المهملات',
          updatedBy: 'النسخ الاحتياطي'
        }).onConflictDoNothing();
      }
    });

    return NextResponse.json({
      success: true,
      message: 'تمت استعادة النسخة الاحتياطية بنجاح وتحديث كافة البيانات في قاعدة البيانات المركزية',
      summary: validation.summary
    });
  } catch (error: unknown) {
    console.error('Error restoring backup into Neon PostgreSQL:', error);
    const errMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء استعادة النسخة الاحتياطية في قاعدة البيانات';
    return NextResponse.json(
      {
        success: false,
        message: errMessage
      },
      { status: 500 }
    );
  }
}
