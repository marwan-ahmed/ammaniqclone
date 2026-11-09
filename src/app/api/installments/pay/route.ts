import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  installmentSchedules,
  installmentContracts,
  investorContracts,
  wallets,
  ledgerTransactions,
  investors
} from '@/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const { scheduleId, paidAmountIQD, paidDate } = await request.json();

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'رقم القسط غير محدد' },
        { status: 400 }
      );
    }

    // 1. Fetch Schedule from Neon DB
    const [schedule] = await db
      .select()
      .from(installmentSchedules)
      .where(eq(installmentSchedules.id, scheduleId));

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'القسط غير موجود في قاعدة بيانات Neon' },
        { status: 404 }
      );
    }

    if (schedule.status === 'PAID') {
      return NextResponse.json(
        { success: false, error: 'القسط مدفوع سابقاً في قاعدة البيانات' },
        { status: 400 }
      );
    }

    // 2. Fetch Contract
    const [contract] = await db
      .select()
      .from(installmentContracts)
      .where(eq(installmentContracts.id, schedule.contractId));

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'عقد التقسيط غير موجود' },
        { status: 404 }
      );
    }

    // 3. Fetch Investor Wallet
    const [investorWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.investorId, contract.investorId));

    // 4. Fetch Company Wallet
    const [companyWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.ownerType, 'COMPANY'));

    // Fetch Investor Contract to check if there is a referrer
    let referrerContract: any = null;
    let referrerWallet: any = null;
    if (contract.investorId) {
      const [invContract] = await db
        .select()
        .from(investorContracts)
        .where(eq(investorContracts.investorId, contract.investorId))
        .limit(1);
      referrerContract = invContract;

      if (referrerContract?.referrerId) {
        const [refWall] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.investorId, referrerContract.referrerId))
          .limit(1);
        referrerWallet = refWall;
      }
    }

    const now = paidDate && !isNaN(Date.parse(paidDate)) ? new Date(paidDate) : new Date();

    // Fetch all schedules for this contract to support multi-installment cascade
    const allContractSchedules = await db
      .select()
      .from(installmentSchedules)
      .where(eq(installmentSchedules.contractId, schedule.contractId));

    const eligibleSchedules = allContractSchedules
      .filter((s) => s.status !== 'PAID' && s.installmentNumber >= schedule.installmentNumber)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);

    const totalPayableDebt = eligibleSchedules.reduce((acc, s) => acc + parseFloat(s.amountIQD || '0'), 0);
    if (typeof paidAmountIQD === 'number' && paidAmountIQD > totalPayableDebt) {
      return NextResponse.json(
        { success: false, error: `المبلغ المدخل (${paidAmountIQD.toLocaleString('en-US')} د.ع) يتجاوز إجمالي الأقساط المتبقية (${totalPayableDebt.toLocaleString('en-US')} د.ع)` },
        { status: 400 }
      );
    }

    let remainingToApply = typeof paidAmountIQD === 'number' ? paidAmountIQD : parseFloat(schedule.amountIQD || '0');
    let totalActuallyPaid = 0;
    let totalPaidPrincipal = 0;
    let totalPaidInvProfit = 0;
    let totalPaidRefProfit = 0;
    let totalPaidCompProfit = 0;
    let fullyPaidCount = 0;
    let partialInfo: { num: number; paid: number; rem: number } | null = null;

    for (const sch of eligibleSchedules) {
      if (remainingToApply <= 0) break;

      const schOrigAmount = parseFloat(sch.amountIQD || '0');
      const isLastChunk = remainingToApply < schOrigAmount;
      const paidForSch = isLastChunk ? remainingToApply : schOrigAmount;
      const diff = schOrigAmount - paidForSch;

      const origPrinc = parseFloat(sch.principalAmountIQD || '0');
      const origInvProf = parseFloat(sch.investorProfitShareIQD || '0');
      const origRefProf = parseFloat(sch.referrerProfitShareIQD || '0');
      const origCompProf = parseFloat(sch.companyProfitShareIQD || '0');
      const origProf = parseFloat(sch.profitAmountIQD || '0');

      let paidPrinc: number;
      let paidInvProf: number;
      let paidRefProf: number;
      let paidCompProf: number;
      let paidProf: number;

      let remPrinc: number;
      let remInvProf: number;
      let remRefProf: number;
      let remCompProf: number;
      let remProf: number;

      if (!isLastChunk) {
        paidPrinc = origPrinc;
        paidInvProf = origInvProf;
        paidRefProf = origRefProf;
        paidCompProf = origCompProf;
        paidProf = origProf;

        remPrinc = 0;
        remInvProf = 0;
        remRefProf = 0;
        remCompProf = 0;
        remProf = 0;
        fullyPaidCount++;
      } else {
        const ratio = schOrigAmount > 0 ? (paidForSch / schOrigAmount) : 1;
        paidPrinc = Math.min(origPrinc, Math.round(origPrinc * ratio));
        paidInvProf = Math.min(origInvProf, Math.round(origInvProf * ratio));
        paidRefProf = Math.min(origRefProf, Math.round(origRefProf * ratio));
        paidCompProf = Math.max(0, paidForSch - paidPrinc - paidInvProf - paidRefProf);
        paidProf = paidInvProf + paidRefProf + paidCompProf;

        remPrinc = origPrinc - paidPrinc;
        remInvProf = origInvProf - paidInvProf;
        remRefProf = origRefProf - paidRefProf;
        remCompProf = origCompProf - paidCompProf;
        remProf = remInvProf + remRefProf + remCompProf;
        partialInfo = { num: sch.installmentNumber, paid: paidForSch, rem: diff };
      }

      await db
        .update(installmentSchedules)
        .set({
          status: 'PAID',
          paidDate: now,
          amountIQD: paidForSch.toFixed(2),
          principalAmountIQD: paidPrinc.toFixed(2),
          profitAmountIQD: paidProf.toFixed(2),
          investorProfitShareIQD: paidInvProf.toFixed(2),
          referrerProfitShareIQD: paidRefProf.toFixed(2),
          companyProfitShareIQD: paidCompProf.toFixed(2),
        })
        .where(eq(installmentSchedules.id, sch.id));

      if (isLastChunk && diff > 0) {
        const nextSchedule = allContractSchedules.find(
          (s) => s.installmentNumber === sch.installmentNumber + 1 && s.status !== 'PAID'
        );
        if (nextSchedule) {
          const nextOrigAmount = parseFloat(nextSchedule.amountIQD);
          const nextOrigPrinc = parseFloat(nextSchedule.principalAmountIQD);
          const nextOrigProf = parseFloat(nextSchedule.profitAmountIQD);
          const nextOrigInvProf = parseFloat(nextSchedule.investorProfitShareIQD);
          const nextOrigRefProf = parseFloat(nextSchedule.referrerProfitShareIQD || '0');
          const nextOrigCompProf = parseFloat(nextSchedule.companyProfitShareIQD);

          await db
            .update(installmentSchedules)
            .set({
              amountIQD: (nextOrigAmount + diff).toFixed(2),
              principalAmountIQD: (nextOrigPrinc + remPrinc).toFixed(2),
              profitAmountIQD: (nextOrigProf + remProf).toFixed(2),
              investorProfitShareIQD: (nextOrigInvProf + remInvProf).toFixed(2),
              referrerProfitShareIQD: (nextOrigRefProf + remRefProf).toFixed(2),
              companyProfitShareIQD: (nextOrigCompProf + remCompProf).toFixed(2),
            })
            .where(eq(installmentSchedules.id, nextSchedule.id));
        }
      }

      totalPaidPrincipal += paidPrinc;
      totalPaidInvProfit += paidInvProf;
      totalPaidRefProfit += paidRefProf;
      totalPaidCompProfit += paidCompProf;
      totalActuallyPaid += paidForSch;
      remainingToApply -= paidForSch;
    }

    // 6 & 7. Update Wallets balance
    if (!investorWallet && companyWallet) {
      // Contract is company-owned: 100% of payment goes to company wallet
      const currentBalance = parseFloat(companyWallet.balanceIQD);
      await db
        .update(wallets)
        .set({
          balanceIQD: (currentBalance + totalActuallyPaid).toFixed(2),
          updatedAt: now,
        })
        .where(eq(wallets.id, companyWallet.id));
    } else {
      if (investorWallet) {
        const currentBalance = parseFloat(investorWallet.balanceIQD);
        await db
          .update(wallets)
          .set({
            balanceIQD: (currentBalance + (totalPaidPrincipal + totalPaidInvProfit)).toFixed(2),
            updatedAt: now,
          })
          .where(eq(wallets.id, investorWallet.id));
      }

      if (companyWallet) {
        const currentBalance = parseFloat(companyWallet.balanceIQD);
        await db
          .update(wallets)
          .set({
            balanceIQD: (currentBalance + totalPaidCompProfit).toFixed(2),
            updatedAt: now,
          })
          .where(eq(wallets.id, companyWallet.id));
      }

      if (referrerWallet && totalPaidRefProfit > 0) {
        const currentRefBalance = parseFloat(referrerWallet.balanceIQD || '0');
        await db
          .update(wallets)
          .set({
            balanceIQD: (currentRefBalance + totalPaidRefProfit).toFixed(2),
            updatedAt: now,
          })
          .where(eq(wallets.id, referrerWallet.id));

        // Insert referral ledger transaction
        await db
          .insert(ledgerTransactions)
          .values({
            referenceNo: `REF-${Math.floor(1000 + Math.random() * 9000)}`,
            date: now,
            type: 'REFERRAL_COMMISSION',
            fromWalletId: companyWallet.id,
            toWalletId: referrerWallet.id,
            investorId: referrerContract.referrerId,
            referrerId: referrerContract.referrerId,
            borrowerId: contract.borrowerId,
            amountIQD: totalPaidRefProfit.toFixed(2),
            investorProfitShareIQD: totalPaidRefProfit.toFixed(2),
            companyProfitShareIQD: '0.00',
            description: `عمولة إحالة مستحقة للمُحيل بقيمة ${totalPaidRefProfit.toLocaleString('en-US')} د.ع مقتطعة من أرباح الشركة`,
          });
      }
    }

    // 8. Insert Ledger Transaction record (resets to 1 each year)
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear + 1, 0, 1);

    const txRecords = await db
      .select({ referenceNo: ledgerTransactions.referenceNo })
      .from(ledgerTransactions)
      .where(and(
        gte(ledgerTransactions.date, startOfYear),
        lt(ledgerTransactions.date, endOfYear)
      ));
    let maxTxNum = 0;
    for (const t of txRecords) {
      const n = parseInt(String(t.referenceNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maxTxNum) maxTxNum = n;
    }
    const payReferenceNo = String(maxTxNum + 1);

    const [newTx] = await db
      .insert(ledgerTransactions)
      .values({
        referenceNo: payReferenceNo,
        date: now,
        type: 'PAYMENT_RECEIVED',
        fromWalletId: contract.borrowerId,
        toWalletId: investorWallet ? investorWallet.id : companyWallet.id,
        investorId: contract.investorId,
        referrerId: referrerContract?.referrerId || null,
        borrowerId: contract.borrowerId,
        amountIQD: totalActuallyPaid.toFixed(2),
        investorProfitShareIQD: totalPaidInvProfit.toFixed(2),
        referrerProfitShareIQD: totalPaidRefProfit > 0 ? totalPaidRefProfit.toFixed(2) : null,
        companyProfitShareIQD: totalPaidCompProfit.toFixed(2),
        description: (fullyPaidCount > 1 || (fullyPaidCount === 1 && partialInfo))
          ? `سداد متعدد الأقساط بقيمة ${totalActuallyPaid.toLocaleString('en-US')} د.ع (${fullyPaidCount} أقساط بالكامل${partialInfo ? ` + سداد جزئي لقسط شهر ${partialInfo.num}` : ''})`
          : (partialInfo
              ? `سداد قسط جزئي بقيمة ${totalActuallyPaid.toLocaleString('en-US')} د.ع (وترحيل ${partialInfo.rem.toLocaleString('en-US')} د.ع للقسط اللاحق)`
              : `سداد قسط عقد تقسيط بقيمة ${totalActuallyPaid.toLocaleString('en-US')} د.ع وتغذية حساب المستثمر والشركة`),
      })
      .returning();

    // 8b. Check if entire contract is fully settled and update contract status in Neon DB
    const allContractSchedulesNow = await db
      .select()
      .from(installmentSchedules)
      .where(eq(installmentSchedules.contractId, schedule.contractId));
    const allSettled = allContractSchedulesNow.length > 0 && allContractSchedulesNow.every((s) => s.status === 'PAID');
    if (allSettled) {
      await db
        .update(installmentContracts)
        .set({ status: 'COMPLETED' })
        .where(eq(installmentContracts.id, schedule.contractId));
    }

    return NextResponse.json({
      success: true,
      message: (fullyPaidCount > 1 || (fullyPaidCount === 1 && partialInfo))
        ? `تم سداد ${totalActuallyPaid.toLocaleString('en-US')} د.ع بنجاح عبر (${fullyPaidCount}) أقساط في السجلات المالية`
        : (partialInfo
            ? `تم سداد ${totalActuallyPaid.toLocaleString('en-US')} د.ع جزئياً وترحيل المتبقي بنجاح`
            : 'تم سداد القسط وتحديث السجلات المالية المركزية بنجاح!'),
      data: { scheduleId, transaction: newTx },
    });
  } catch (error: any) {
    console.error('Error processing live payment in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
