import { db } from './index';
import {
  companies,
  investors,
  investorContracts,
  wallets,
  inventoryItems,
  borrowers,
  installmentContracts,
  installmentSchedules,
  ledgerTransactions
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
  }).returning();

  console.log('✅ Company created:', company.name);

  // 2. Insert Company Wallet (0.00 IQD)
  await db.insert(wallets).values({
    ownerType: 'COMPANY',
    ownerName: 'صندوق نظام أمان للتقسيط الرئيسي',
    balanceIQD: '0.00',
    totalCapitalDepositedIQD: '0.00',
  });

  console.log('🎉 Clean Database seeding finished successfully!');
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
