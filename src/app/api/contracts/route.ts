import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  installmentContracts,
  installmentSchedules,
  inventoryItems,
  borrowers,
  investorContracts,
  systemSettings,
} from '@/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      borrowerId,
      inventoryItemId,
      totalSalePriceIQD,
      downPaymentIQD,
      monthsCount,
      startDate,
      quantity,
    } = body;

    if (!borrowerId || !inventoryItemId || totalSalePriceIQD === undefined || downPaymentIQD === undefined || !monthsCount) {
      return NextResponse.json(
        { success: false, error: 'جميع تفاصيل العقد والدفع والمدد مطلوبة' },
        { status: 400 }
      );
    }

    // 1. Fetch Borrower
    const [borrower] = await db
      .select()
      .from(borrowers)
      .where(eq(borrowers.id, borrowerId))
      .limit(1);

    if (!borrower) {
      return NextResponse.json({ success: false, error: 'الزبون المحدد غير موجود بالسيستم' }, { status: 404 });
    }

    // 2. Fetch Inventory Item
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, inventoryItemId))
      .limit(1);

    if (!item) {
      return NextResponse.json({ success: false, error: 'البضاعة المحددة غير موجودة بالسيستم' }, { status: 404 });
    }

    if (item.status === 'FULLY_FINANCED' && (item.quantity === null || item.quantity <= 0)) {
      return NextResponse.json({ success: false, error: 'البضاعة المحددة تم تمويل كامل كميتها مسبقاً' }, { status: 400 });
    }

    const reqQty = Math.max(1, parseInt(quantity || '1', 10) || 1);
    const currentQty = item.quantity !== null && item.quantity !== undefined ? item.quantity : 1;
    if (currentQty < reqQty) {
      return NextResponse.json(
        { success: false, error: `الكمية المطلوبة (${reqQty}) غير متوفرة بالمخزن. المتوفر حالياً: (${currentQty}) قطعة` },
        { status: 400 }
      );
    }

    // 3. Fetch Investor Contract for profit split details
    const [contractConfig] = await db
      .select()
      .from(investorContracts)
      .where(eq(investorContracts.investorId, item.investorId))
      .limit(1);

    const isCompanyOwned = !item.investorId;
    const investorSharePercent = isCompanyOwned ? 0 : (contractConfig ? parseFloat(contractConfig.investorSharePercent) : 60);
    const referrerSharePercent = isCompanyOwned ? 0 : (contractConfig && contractConfig.referrerSharePercent ? parseFloat(contractConfig.referrerSharePercent) : 0);
    const companySharePercent = isCompanyOwned ? 100 : (contractConfig ? parseFloat(contractConfig.companySharePercent) : 40);

    // Calculate finances
    const contractStartDate = startDate && !isNaN(Date.parse(startDate)) ? new Date(startDate) : new Date();

    // Check if numbering cycle was manually reset by admin
    const [epochSetting] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'numbering_reset_epoch'))
      .limit(1);

    const resetEpochStr = epochSetting?.value;
    const resetEpochDate = resetEpochStr && !isNaN(Date.parse(resetEpochStr)) ? new Date(resetEpochStr) : null;

    let existingContracts;
    if (resetEpochDate) {
      existingContracts = await db
        .select({ contractNumber: installmentContracts.contractNumber })
        .from(installmentContracts)
        .where(gte(installmentContracts.createdAt, resetEpochDate));
    } else {
      existingContracts = await db
        .select({ contractNumber: installmentContracts.contractNumber })
        .from(installmentContracts);
    }

    let maxContractNum = 0;
    for (const ec of existingContracts) {
      const n = parseInt(String(ec.contractNumber || '').replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maxContractNum) maxContractNum = n;
    }
    const contractNumber = String(maxContractNum + 1);
    const itemCostPriceIQD = parseFloat(item.unitCostIQD) * reqQty;
    const safeDownPayment = Math.min(itemCostPriceIQD, Math.max(0, parseFloat(downPaymentIQD || '0')));
    const financedAmountIQD = totalSalePriceIQD - safeDownPayment;
    const profitMarginIQD = totalSalePriceIQD - itemCostPriceIQD;
    const months = Number(monthsCount);
    const monthlyInstallmentIQD = Math.round(financedAmountIQD / months);

    const totalInvProfit = isCompanyOwned ? 0 : Math.round(profitMarginIQD * (investorSharePercent / 100));
    // حصة الشركة الإجمالية قبل استقطاع عمولة الوسيط
    const grossCompProfit = profitMarginIQD - totalInvProfit;
    // عمولة الوسيط تُحسب كنسبة مستقطعة من حصة أرباح الشركة فقط
    const totalRefProfit = (!isCompanyOwned && referrerSharePercent > 0)
      ? Math.round(grossCompProfit * (referrerSharePercent / 100))
      : 0;
    // صافي ربح الشركة المتبقي
    const totalCompProfit = grossCompProfit - totalRefProfit;

    const baseAmt = Math.floor(financedAmountIQD / months);
    const remAmt = financedAmountIQD % months;

    const baseInv = Math.floor(totalInvProfit / months);
    const remInv = totalInvProfit % months;

    const baseRef = Math.floor(totalRefProfit / months);
    const remRef = totalRefProfit % months;

    const baseComp = Math.floor(totalCompProfit / months);
    const remComp = totalCompProfit % months;



    const result = await db.transaction(async (tx) => {
      // 1. Insert Installment Contract
      const [newContract] = await tx
        .insert(installmentContracts)
        .values({
          contractNumber,
          borrowerId,
          investorId: item.investorId,
          inventoryItemId,
          itemCostPriceIQD: itemCostPriceIQD.toFixed(2),
          totalSalePriceIQD: Number(totalSalePriceIQD).toFixed(2),
          downPaymentIQD: Number(safeDownPayment).toFixed(2),
          monthlyInstallmentIQD: monthlyInstallmentIQD.toFixed(2),
          monthsCount: months,
          status: 'ACTIVE',
          startDate: contractStartDate,
        })
        .returning();

      // 2. Generate and Insert Schedules with exact remainder distribution (100% dinar conservation)
      const schedulesToInsert = [];
      const baseDate = new Date(contractStartDate);

      for (let i = 1; i <= months; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        const amount = baseAmt + (i <= remAmt ? 1 : 0);
        const invShare = baseInv + (i <= remInv ? 1 : 0);
        const refShare = baseRef + (i <= remRef ? 1 : 0);
        let isCompExtra = false;
        if (remComp > 0) {
          const shift = (remInv + remRef) % months;
          const idx = ((i - 1 + months - shift) % months) + 1;
          if (idx <= remComp) isCompExtra = true;
        }
        const compShare = baseComp + (isCompExtra ? 1 : 0);
        const profit = invShare + refShare + compShare;
        const principal = amount - profit;

        schedulesToInsert.push({
          contractId: newContract.id,
          installmentNumber: i,
          dueDate,
          amountIQD: amount.toFixed(2),
          principalAmountIQD: principal.toFixed(2),
          profitAmountIQD: profit.toFixed(2),
          investorProfitShareIQD: invShare.toFixed(2),
          referrerProfitShareIQD: refShare.toFixed(2),
          companyProfitShareIQD: compShare.toFixed(2),
          status: 'PENDING' as const,
        });
      }

      const newSchedules = await tx
        .insert(installmentSchedules)
        .values(schedulesToInsert)
        .returning();

      // 3. Decrement Inventory Item quantity and update status
      const newQty = Math.max(0, currentQty - reqQty);
      const newStatus = newQty === 0 ? 'FULLY_FINANCED' : 'PARTIALLY_FINANCED';

      await tx
        .update(inventoryItems)
        .set({
          quantity: newQty,
          status: newStatus,
        })
        .where(eq(inventoryItems.id, inventoryItemId));

      return {
        contract: newContract,
        schedules: newSchedules,
      };
    });

    return NextResponse.json({
      success: true,
      message: `تم إنشاء عقد التقسيط رقم ${contractNumber} بنجاح للعميل ${borrower.name}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error creating contract in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر تسجيل عقد التقسيط' },
      { status: 500 }
    );
  }
}
