import { NextResponse } from 'next/server';
import { db } from '@/db';
import { wallets, ledgerTransactions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const isUuid = (val?: string) =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { walletId, amountIQD, notes, date } = body;

    if (!walletId || amountIQD === undefined || Number(amountIQD) <= 0) {
      return NextResponse.json(
        { success: false, error: 'المحفظة وقيمة الإيداع (أكبر من 0) مطلوبان' },
        { status: 400 }
      );
    }

    // 1. Fetch Wallet safely with UUID check
    let wallet: typeof wallets.$inferSelect | undefined;
    if (isUuid(walletId)) {
      const [found] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .limit(1);
      wallet = found;
    }

    // Fallback: If wallet-company or COMPANY or not found as UUID
    if (!wallet && (walletId === 'wallet-company' || walletId === 'COMPANY' || !isUuid(walletId))) {
      const [companyWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.ownerType, 'COMPANY'))
        .limit(1);

      if (companyWallet) {
        wallet = companyWallet;
      } else {
        // Auto-seed company wallet row if missing from DB
        const [created] = await db
          .insert(wallets)
          .values({
            ownerType: 'COMPANY',
            ownerName: 'صندوق نظام أمان للتقسيط الرئيسي',
            balanceIQD: '0.00',
            totalCapitalDepositedIQD: '0.00',
            updatedAt: new Date(),
          })
          .returning();
        wallet = created;
      }
    }

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'المحفظة المحددة غير موجودة بالسيستم' }, { status: 404 });
    }

    const depositAmount = Number(amountIQD);
    const newBalance = Number(wallet.balanceIQD) + depositAmount;
    const newCapital = Number(wallet.totalCapitalDepositedIQD) + depositAmount;
    const refNo = `DEP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const parsedDate = date && !isNaN(Date.parse(date)) ? new Date(date) : new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Update Wallet by its real DB UUID
      const [updatedWallet] = await tx
        .update(wallets)
        .set({
          balanceIQD: newBalance.toFixed(2),
          totalCapitalDepositedIQD: newCapital.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id))
        .returning();

      // 2. Insert Transaction Ledger
      const [txRecord] = await tx
        .insert(ledgerTransactions)
        .values({
          referenceNo: refNo,
          date: parsedDate,
          type: 'DEPOSIT',
          fromWalletId: '00000000-0000-0000-0000-000000000000', // External source dummy UUID
          toWalletId: wallet.id,
          investorId: wallet.investorId,
          amountIQD: depositAmount.toFixed(2),
          description: notes || `تغذية وإيداع رأس مال جديد بقيمة ${depositAmount.toLocaleString('en-US')} د.ع إلى ${wallet.ownerName}`,
        })
        .returning();

      return {
        wallet: updatedWallet,
        transaction: txRecord,
      };
    });

    return NextResponse.json({
      success: true,
      message: `تم إيداع مبلغ ${depositAmount.toLocaleString('en-US')} د.ع بنجاح في ${wallet.ownerName}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error depositing capital:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'فشل تسجيل عملية الإيداع في قاعدة البيانات' },
      { status: 500 }
    );
  }
}
