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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@aman.iq').toLowerCase().trim();

    const cleanCompany = await db.transaction(async (tx) => {
      // 1. Wiping tables in strict relational dependency order
      await tx.delete(directDebtSchedules);
      await tx.delete(directDebts);
      await tx.delete(installmentSchedules);
      await tx.delete(installmentContracts);
      await tx.delete(ledgerTransactions);
      
      // Expenses and revenues reference wallets, delete before wallets!
      await tx.delete(expenses);
      await tx.delete(revenues);

      // Inventory items reference investors, delete before investors
      await tx.delete(inventoryItems);

      // Borrowers
      await tx.delete(borrowers);

      // Investor contracts reference investors, delete before investors
      await tx.delete(investorContracts);

      // Wallets reference investors, delete before investors
      await tx.delete(wallets);

      // Investors
      await tx.delete(investors);

      // Companies
      await tx.delete(companies);

      // Trash items
      await tx.delete(trashItems);

      // Employees
      await tx.delete(employees);

      // 2. Re-seed clean initial company record
      const [newCompany] = await tx.insert(companies).values({
        name: 'نظام أمان للتقسيط - سامراء',
        city: 'سامراء',
        governorate: 'صلاح الدين',
        currency: 'IQD'
      }).returning();

      // 3. Re-seed clean company wallet
      await tx.insert(wallets).values({
        ownerType: 'COMPANY',
        ownerName: 'صندوق نظام أمان الرئيسي',
        balanceIQD: '0.00',
        totalCapitalDepositedIQD: '0.00'
      });

      // 4. Re-seed clean Super Admin employee
      await tx.insert(employees).values({
        id: 'emp-1',
        name: 'أحمد إياد',
        role: 'مدير النظام',
        phone: '07705554433',
        email: adminEmail,
        nationalId: 'IQ-10029384',
        salaryIQD: '1500000.00',
        status: 'نشط',
        permissions: JSON.stringify([
          'DASHBOARD_VIEW', 'INVESTORS_MANAGE', 'BORROWERS_MANAGE',
          'FUNDS_MANAGE', 'INVENTORY_MANAGE', 'CONTRACTS_CREATE',
          'EXPENSES_MANAGE', 'REVENUES_MANAGE', 'REPORTS_VIEW',
          'DEBT_LEDGER_MANAGE', 'EMPLOYEES_MANAGE', 'SETTINGS_MANAGE',
          'TRASH_MANAGE'
        ]),
        notes: 'المدير العام المالك وصاحب الصلاحيات الشاملة المطلقة للنظام'
      });

      // 5. Re-seed default admin passcode in system settings
      await tx.insert(systemSettings).values({
        key: 'admin_passcode',
        value: '2026',
        description: 'رمز أمان الإدارة العامة لعمليات الحذف وتفريغ سلة المهملات',
        updatedBy: 'النظام'
      }).onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: '2026',
          updatedAt: new Date(),
          updatedBy: 'النظام'
        }
      });

      return newCompany;
    });

    return NextResponse.json({
      success: true,
      message: 'تم تصفير وإعادة تهيئة كافة جداول قاعدة البيانات المركزية بنجاح ونقطة بداية نظيفة (0 د.ع)',
      company: cleanCompany
    });

  } catch (error: any) {
    console.error('Error resetting database in Neon PostgreSQL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'تعذر تصفير قاعدة البيانات المركزية'
      },
      { status: 500 }
    );
  }
}
