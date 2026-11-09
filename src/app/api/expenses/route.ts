import { NextResponse } from 'next/server';
import { db } from '@/db';
import { wallets, expenses, ledgerTransactions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const isUuid = (val?: string) =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      category,
      amountIQD,
      paidFromWalletId,
      recipientName,
      referenceNo,
      date,
      notes,
    } = body;

    if (!title || !category || amountIQD === undefined || !paidFromWalletId) {
      return NextResponse.json(
        { success: false, error: 'عنوان المصروف والتصنيف والمبلغ والمحفظة حقول مطلوبة' },
        { status: 400 }
      );
    }

    // 1. Fetch Wallet safely with UUID check
    let wallet: typeof wallets.$inferSelect | undefined;
    if (isUuid(paidFromWalletId)) {
      const [found] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, paidFromWalletId))
        .limit(1);
      wallet = found;
    }

    // Fallback: If wallet-company or COMPANY or not found as UUID
    if (!wallet && (paidFromWalletId === 'wallet-company' || paidFromWalletId === 'COMPANY' || !isUuid(paidFromWalletId))) {
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

    const expenseAmount = Number(amountIQD);
    const walletBalance = Number(wallet.balanceIQD);

    if (walletBalance < expenseAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `السيولة المتاحة في ${wallet.ownerName} (${walletBalance.toLocaleString('en-US')} د.ع) لا تكفي لتغطية المصروف بقيمة ${expenseAmount.toLocaleString('en-US')} د.ع`,
        },
        { status: 400 }
      );
    }

    const refNo = referenceNo && referenceNo.trim() ? referenceNo.trim() : `EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const parsedDate = date ? new Date(date) : new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Deduct from wallet balance by real DB UUID
      const [updatedWallet] = await tx
        .update(wallets)
        .set({
          balanceIQD: (walletBalance - expenseAmount).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id))
        .returning();

      // 2. Insert Expense record
      const [expenseRecord] = await tx
        .insert(expenses)
        .values({
          referenceNo: refNo,
          title,
          category,
          amountIQD: expenseAmount.toFixed(2),
          paidFromWalletId: wallet.id,
          recipientName: recipientName || null,
          date: parsedDate,
          notes: notes || null,
        })
        .returning();

      // 3. Insert Transaction Ledger
      const [txRecord] = await tx
        .insert(ledgerTransactions)
        .values({
          referenceNo: refNo,
          date: parsedDate,
          type: 'EXPENSE',
          fromWalletId: wallet.id,
          toWalletId: '00000000-0000-0000-0000-000000000000', // External recipient dummy UUID
          investorId: wallet.investorId,
          amountIQD: expenseAmount.toFixed(2),
          description: notes || `مصروف تشغيلي (${category}): "${title}" مقتطع من ${wallet.ownerName}`,
        })
        .returning();

      return {
        wallet: updatedWallet,
        expense: expenseRecord,
        transaction: txRecord,
      };
    });

    return NextResponse.json({
      success: true,
      message: `تم تقييد المصروف بقيمة ${expenseAmount.toLocaleString('en-US')} د.ع وخصمه من ${wallet.ownerName} بنجاح`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error adding expense:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'فشل تقييد المصروف في قاعدة البيانات' },
      { status: 500 }
    );
  }
}
