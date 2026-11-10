import { db } from './index';
import {
  companies,
  wallets,
  employees
} from './schema';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  console.log('🌱 Starting database seeding for Neon PostgreSQL...');

  // 1. Insert Company
  const [company] = await db.insert(companies).values({
    name: 'نظام أمان للتقسيط - سامراء',
    city: 'سامراء',
    governorate: 'صلاح الدين',
    currency: 'IQD',
  }).onConflictDoNothing().returning();

  if (company) {
    console.log('✅ Company created:', company.name);
  }

  // 2. Insert Company Wallet (0.00 IQD)
  await db.insert(wallets).values({
    ownerType: 'COMPANY',
    ownerName: 'صندوق نظام أمان للتقسيط الرئيسي',
    balanceIQD: '0.00',
    totalCapitalDepositedIQD: '0.00',
  }).onConflictDoNothing();

  // 3. Insert Super Admin Employee
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@ammaniqclone.com').toLowerCase().trim();
  await db.insert(employees).values({
    id: 'emp-1',
    name: 'المدير العام',
    role: 'مدير النظام',
    phone: '07700000000',
    email: adminEmail,
    nationalId: 'IQ-10029384',
    salaryIQD: '1500000.00',
    status: 'نشط',
    permissions: JSON.stringify([
      'DASHBOARD_VIEW', 'INVESTORS_MANAGE', 'BORROWERS_MANAGE',
      'FUNDS_MANAGE', 'INVENTORY_MANAGE', 'CONTRACTS_CREATE',
      'EXPENSES_MANAGE', 'REVENUES_MANAGE', 'REPORTS_VIEW',
      'DEBT_LEDGER_MANAGE', 'EMPLOYEES_MANAGE', 'SETTINGS_MANAGE',
      'TRASH_MANAGE', 'PERMISSIONS_ASSIGN'
    ]),
    notes: 'المدير العام المالك وصاحب الصلاحيات الشاملة المطلقة للنظام'
  }).onConflictDoNothing();

  console.log('🎉 Clean Database seeding finished successfully!');
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
