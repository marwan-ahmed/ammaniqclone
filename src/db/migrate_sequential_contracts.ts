import { db } from './index';
import { installmentContracts, ledgerTransactions } from './schema';
import { asc, eq, like } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function migrate() {
  console.log('--- Starting Sequential Contract Numbering Migration ---');

  await db.transaction(async (tx) => {
    // 1. Fetch all contracts ordered by start date
    const contracts = await tx
      .select({
        id: installmentContracts.id,
        contractNumber: installmentContracts.contractNumber,
        startDate: installmentContracts.startDate,
      })
      .from(installmentContracts)
      .orderBy(asc(installmentContracts.startDate));

    console.log(`Found ${contracts.length} contracts to renumber sequentially.`);

    for (let i = 0; i < contracts.length; i++) {
      const oldNum = contracts[i].contractNumber;
      const newNum = String(i + 1);

      // If already matching newNum, skip
      if (oldNum === newNum) {
        console.log(`Contract ${contracts[i].id} is already #${newNum}`);
        continue;
      }

      console.log(`Renumbering contract: ${oldNum} -> ${newNum}`);

      // Update contract number in installment_contracts
      await tx
        .update(installmentContracts)
        .set({ contractNumber: newNum })
        .where(eq(installmentContracts.id, contracts[i].id));

      // Update ledger transactions if oldNum is in referenceNo
      await tx
        .update(ledgerTransactions)
        .set({ referenceNo: newNum })
        .where(eq(ledgerTransactions.referenceNo, oldNum));

      // Update descriptions mentioning the old contract number
      const relatedTxs = await tx
        .select({ id: ledgerTransactions.id, description: ledgerTransactions.description })
        .from(ledgerTransactions)
        .where(like(ledgerTransactions.description, `%${oldNum}%`));

      for (const t of relatedTxs) {
        const updatedDesc = t.description.replace(new RegExp(oldNum, 'g'), newNum);
        await tx
          .update(ledgerTransactions)
          .set({ description: updatedDesc })
          .where(eq(ledgerTransactions.id, t.id));
      }
    }
  });

  console.log('✓ Migration completed successfully. All contracts renumbered sequentially (1, 2, 3...).');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

