import { NextResponse } from 'next/server';
import { db } from '@/db';
import { directDebtSchedules, wallets, directDebts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { scheduleId, paidAmountIQD, paidDate } = await req.json();

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'رقم القسط غير محدد' },
        { status: 400 }
      );
    }

    const [schedule] = await db
      .select()
      .from(directDebtSchedules)
      .where(eq(directDebtSchedules.id, scheduleId))
      .limit(1);

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'قسط الدين المباشر غير موجود في قاعدة البيانات' },
        { status: 404 }
      );
    }

    if (schedule.status === 'PAID') {
      return NextResponse.json(
        { success: false, error: 'القسط مدفوع سابقاً في قاعدة البيانات' },
        { status: 400 }
      );
    }

    const paymentDateObj = paidDate && !isNaN(Date.parse(paidDate)) ? new Date(paidDate) : new Date();
    const payAmt = typeof paidAmountIQD === 'number' && paidAmountIQD > 0 ? paidAmountIQD : parseFloat(schedule.amountIQD || '0');

    // Update status and paid date in db
    await db
      .update(directDebtSchedules)
      .set({
        status: 'PAID',
        paidDate: paymentDateObj,
        amountIQD: payAmt.toFixed(2),
      })
      .where(eq(directDebtSchedules.id, scheduleId));

    // Update wallet balance in database
    try {
      const [parentDebt] = await db
        .select()
        .from(directDebts)
        .where(eq(directDebts.id, schedule.directDebtId))
        .limit(1);

      let targetWallet: any;
      if (parentDebt?.investorId && parentDebt.investorId !== 'COMPANY' && parentDebt.investorId !== 'COMPANY_MAIN') {
        const [invWallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.investorId, parentDebt.investorId))
          .limit(1);
        if (invWallet) targetWallet = invWallet;
      }

      if (!targetWallet) {
        const [compWallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.ownerType, 'COMPANY'))
          .limit(1);
        targetWallet = compWallet;
      }

      if (targetWallet) {
        const curBal = parseFloat(targetWallet.balanceIQD || '0');
        const payAmt = parseFloat(schedule.amountIQD || '0');
        await db
          .update(wallets)
          .set({
            balanceIQD: (curBal + payAmt).toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(wallets.id, targetWallet.id));
      }
    } catch (wErr) {
      console.warn('Could not update wallet balance on direct debt pay:', wErr);
    }

    return NextResponse.json({
      success: true,
      message: 'تم تسديد قسط الدين المباشر بنجاح في قاعدة البيانات الحية للمنصة',
    });
  } catch (error: any) {
    console.error('Error paying direct debt schedule in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر تسديد قسط الدين المباشر' },
      { status: 500 }
    );
  }
}
