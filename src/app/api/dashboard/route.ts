import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eq, and, gt } from 'drizzle-orm';
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

export async function GET(req: Request) {
  try {
    // Auto-heal legacy inventory items where quantity > 0 but status was incorrectly saved as FULLY_FINANCED
    try {
      await db
        .update(inventoryItems)
        .set({ status: 'IN_STOCK' })
        .where(and(eq(inventoryItems.status, 'FULLY_FINANCED'), gt(inventoryItems.quantity, 0)));
    } catch (e) {
      console.warn('Dashboard inventory auto-heal skipped:', e);
    }

    const safeFetch = async <T>(queryPromise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await queryPromise;
      } catch (err) {
        console.warn('Dashboard safeFetch fallback for table query:', err);
        return fallback;
      }
    };

    const [
      allCompanies,
      allInvestors,
      allInvestorContracts,
      rawWallets,
      allInventory,
      allBorrowers,
      allContracts,
      allSchedules,
      allTransactions,
      allExpenses,
      allRevenues,
      allDirectDebts,
      allDirectDebtSchedules,
      allTrashItems,
      rawEmployees,
      rawSettings
    ] = await Promise.all([
      safeFetch(db.select().from(companies), []),
      safeFetch(db.select().from(investors), []),
      safeFetch(db.select().from(investorContracts), []),
      safeFetch(db.select().from(wallets), []),
      safeFetch(db.select().from(inventoryItems), []),
      safeFetch(db.select().from(borrowers), []),
      safeFetch(db.select().from(installmentContracts), []),
      safeFetch(db.select().from(installmentSchedules), []),
      safeFetch(db.select().from(ledgerTransactions), []),
      safeFetch(db.select().from(expenses), []),
      safeFetch(db.select().from(revenues), []),
      safeFetch(db.select().from(directDebts), []),
      safeFetch(db.select().from(directDebtSchedules), []),
      safeFetch(db.select().from(trashItems), []),
      safeFetch(db.select().from(employees), []),
      safeFetch(db.select().from(systemSettings), [])
    ]);

    let allEmployees = rawEmployees;
    let allWallets = rawWallets;

    // Auto-heal/seed Company Wallet if missing from Neon DB
    const hasCompanyWallet = allWallets.some((w) => w.ownerType === 'COMPANY');
    if (!hasCompanyWallet) {
      try {
        const [companyWallet] = await db
          .insert(wallets)
          .values({
            ownerType: 'COMPANY',
            ownerName: 'صندوق نظام أمان للتقسيط الرئيسي',
            balanceIQD: '0.00',
            totalCapitalDepositedIQD: '0.00',
            updatedAt: new Date(),
          })
          .returning();
        allWallets = [companyWallet, ...allWallets];
      } catch (e) {
        console.warn('Failed to auto-seed company wallet in DB:', e);
      }
    }

    // Process system settings
    const settingsMap: Record<string, string> = {};
    rawSettings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    const adminPasscode = settingsMap['admin_passcode'] || '2026';

    // Auto-heal/seed System Admin (أحمد إياد) if missing from Neon DB
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@ammaniqclone.com').toLowerCase().trim();
    const hasAdmin = allEmployees.some(e => e.email.toLowerCase().trim() === adminEmail);

    if (!hasAdmin) {
      try {
        const [adminEmp] = await db.insert(employees).values({
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
        }).returning();
        allEmployees = [adminEmp, ...allEmployees];
      } catch (e) {
        console.warn('Failed to insert default admin employee into Neon DB:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        companies: allCompanies,
        investors: allInvestors,
        investorContracts: allInvestorContracts,
        wallets: allWallets,
        inventory: allInventory,
        borrowers: allBorrowers,
        contracts: allContracts,
        schedules: allSchedules,
        transactions: allTransactions,
        expenses: allExpenses,
        revenues: allRevenues,
        employees: allEmployees,
        directDebts: allDirectDebts,
        directSchedules: allDirectDebtSchedules,
        trashItems: allTrashItems,
        adminPasscode: adminPasscode,
        privacyPasscode: settingsMap['privacy_passcode'] || adminPasscode,
        privacyAutoHideSeconds: settingsMap['privacy_auto_hide_seconds'] !== undefined && settingsMap['privacy_auto_hide_seconds'] !== null
          ? Number(settingsMap['privacy_auto_hide_seconds'])
          : 30,
        settings: {
          adminPasscode,
          privacyPasscode: settingsMap['privacy_passcode'] || adminPasscode,
          privacyAutoHideSeconds: settingsMap['privacy_auto_hide_seconds'] !== undefined && settingsMap['privacy_auto_hide_seconds'] !== null
            ? Number(settingsMap['privacy_auto_hide_seconds'])
            : 30,
          ...settingsMap
        }
      },
    });
  } catch (error: any) {
    console.error('Error in dashboard GET handler:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
