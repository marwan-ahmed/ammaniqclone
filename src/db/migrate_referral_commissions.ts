import { db } from './index';
import {
  installmentContracts,
  installmentSchedules,
  ledgerTransactions,
  wallets,
} from './schema';
import { eq, and } from 'drizzle-orm';

async function migrate() {
  console.log('--- Starting Referral Commission Restructuring Migration ---');

  await db.transaction(async (tx) => {
    // 1. Fetch Contract
    const [contract] = await tx
      .select()
      .from(installmentContracts)
      .limit(1);

    if (!contract) {
      console.log('No contracts found to migrate.');
      return;
    }

    console.log(`Processing Contract: ${contract.contractNumber} (ID: ${contract.id})`);

    // 2. Update Schedules for this contract:
    // Profit was 1,000,000 per schedule:
    // Investor: 500,000 (50% of contract profit)
    // Broker: 50,000 (10% of company profit 500,000)
    // Company: 450,000 (remaining company profit)
    await tx
      .update(installmentSchedules)
      .set({
        referrerProfitShareIQD: '50000.00',
        companyProfitShareIQD: '450000.00',
      })
      .where(eq(installmentSchedules.contractId, contract.id));

    console.log('✓ Updated installment schedules to: Referrer = 50,000, Company = 450,000 IQD per installment.');

    // 3. Update REFERRAL_COMMISSION ledger transactions
    await tx
      .update(ledgerTransactions)
      .set({
        amountIQD: '50000.00',
        investorProfitShareIQD: '50000.00',
        description: 'عمولة إحالة مستحقة للمُحيل في Neon DB بقيمة 50,000 د.ع مقتطعة من أرباح الشركة',
      })
      .where(eq(ledgerTransactions.type, 'REFERRAL_COMMISSION'));

    console.log('✓ Updated REFERRAL_COMMISSION ledger vouchers to 50,000 IQD each.');

    // 4. Update PAYMENT_RECEIVED ledger transactions
    await tx
      .update(ledgerTransactions)
      .set({
        referrerProfitShareIQD: '50000.00',
        companyProfitShareIQD: '450000.00',
      })
      .where(eq(ledgerTransactions.type, 'PAYMENT_RECEIVED'));

    console.log('✓ Updated PAYMENT_RECEIVED ledger transactions.');

    // 5. Update Wallets:
    // Referrer Wallet (Marwan) -> 500,000.00
    // Company Wallet -> 4,500,000.00
    const allWallets = await tx.select().from(wallets);
    const companyWallet = allWallets.find((w) => w.ownerType === 'COMPANY');
    const marwanWallet = allWallets.find((w) => w.ownerName.includes('مروان'));

    if (marwanWallet) {
      await tx
        .update(wallets)
        .set({
          balanceIQD: '500000.00',
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, marwanWallet.id));
      console.log(`✓ Set Marwan's commission wallet balance to: 500,000.00 IQD`);
    }

    if (companyWallet) {
      await tx
        .update(wallets)
        .set({
          balanceIQD: '4500000.00',
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, companyWallet.id));
      console.log(`✓ Set Company wallet balance to: 4,500,000.00 IQD`);
    }
  });

  console.log('--- Migration Completed Successfully ---');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

