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
    const { walletId, amountIQD, type, notes, receiptNo, recipientName, date } = body;

    if (!walletId || amountIQD === undefined || Number(amountIQD) <= 0) {
      return NextResponse.json(
        { success: false, error: 'المحفظة وقيمة السحب (أكبر من 0) مطلوبان' },
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
      wallet = companyWallet;
    }

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'المحفظة المحددة غير موجودة بالسيستم' }, { status: 404 });
    }

    const withdrawAmount = Number(amountIQD);
    const currentBalance = Number(wallet.balanceIQD);

    if (currentBalance < withdrawAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `الرصيد المتاح (${currentBalance.toLocaleString('en-US')} د.ع) لا يكفي لسحب مبلغ ${withdrawAmount.toLocaleString('en-US')} د.ع`
        },
        { status: 400 }
      );
    }

    const newBalance = currentBalance - withdrawAmount;
    const isCapital = type === 'CAPITAL_WITHDRAWAL';
    const currentCapital = Number(wallet.totalCapitalDepositedIQD);
    const newCapital = isCapital ? Math.max(0, currentCapital - withdrawAmount) : currentCapital;
    let refNo = receiptNo && String(receiptNo).trim() ? String(receiptNo).trim() : '';
    if (!refNo) {
      try {
        const recentTxs = await db
          .select({ referenceNo: ledgerTransactions.referenceNo })
          .from(ledgerTransactions)
          .limit(500);
        const numericRefs = recentTxs
          .map((t) => {
            const raw = String(t.referenceNo || '').trim();
            if (/^\d+$/.test(raw)) {
              const n = parseInt(raw, 10);
              return !isNaN(n) && n > 0 ? n : null;
            }
            return null;
          })
          .filter((n): n is number => n !== null);
        refNo = numericRefs.length > 0 ? String(Math.max(...numericRefs) + 1) : '1';
      } catch {
        refNo = '1';
      }
    }
    const parsedDate = date && !isNaN(Date.parse(date)) ? new Date(date) : new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Update Wallet by real DB UUID
      const [updatedWallet] = await tx
        .update(wallets)
        .set({
          balanceIQD: newBalance.toFixed(2),
          totalCapitalDepositedIQD: newCapital.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id))
        .returning();

      // 2. Insert Transaction Ledger using valid Postgres tx_type enum ('PROFIT_DISTRIBUTION' or 'EXPENSE')
      const dbTxType: 'PROFIT_DISTRIBUTION' | 'EXPENSE' =
        type === 'CAPITAL_WITHDRAWAL' ? 'EXPENSE' : 'PROFIT_DISTRIBUTION';

      const [txRecord] = await tx
        .insert(ledgerTransactions)
        .values({
          referenceNo: refNo,
          date: parsedDate,
          type: dbTxType,
          fromWalletId: wallet.id,
          toWalletId: '00000000-0000-0000-0000-000000000000', // External recipient dummy UUID
          investorId: wallet.investorId,
          amountIQD: withdrawAmount.toFixed(2),
          description: notes || (recipientName
            ? `سحب ${isCapital ? 'رأس مال' : 'أرباح'} لصالح (${recipientName}) بقيمة ${withdrawAmount.toLocaleString('en-US')} د.ع من ${wallet.ownerName}`
            : `سحب ${isCapital ? 'رأس مال' : 'أرباح'} بقيمة ${withdrawAmount.toLocaleString('en-US')} د.ع من ${wallet.ownerName}`),
        })
        .returning();

      return {
        wallet: updatedWallet,
        transaction: txRecord,
      };
    });

    return NextResponse.json({
      success: true,
      message: `تم سحب مبلغ ${withdrawAmount.toLocaleString('en-US')} د.ع بنجاح من ${wallet.ownerName}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error withdrawing capital/profits:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'فشل تسجيل عملية السحب في قاعدة البيانات' },
      { status: 500 }
    );
  }
}
