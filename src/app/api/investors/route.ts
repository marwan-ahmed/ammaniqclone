import { NextResponse } from 'next/server';
import { eq, and, ne, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  investors,
  wallets,
  investorContracts,
  ledgerTransactions,
  installmentContracts,
  installmentSchedules,
} from '@/db/schema';
import { findDuplicateMatches } from '@/utils/nameSimilarity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      address,
      nationalId,
      capitalAmount,
      investorSharePercent,
      companySharePercent,
      notes,
      allowDuplicate,
      date,
      referrerId,
      referrerSharePercent,
      isReferralPartner,
    } = body;

    if (!name || !phone || capitalAmount === undefined) {
      return NextResponse.json(
        { success: false, error: 'الاسم ورقم الهاتف ورأس المال حقول مطلوبة' },
        { status: 400 }
      );
    }

    // Check for duplicate in database if not explicitly bypassed
    if (!allowDuplicate) {
      const existingInvestors = await db.select().from(investors);
      const duplicateMatches = findDuplicateMatches(name, phone, existingInvestors);

      if (duplicateMatches.exactNameMatches.length > 0) {
        return NextResponse.json(
          {
            success: false,
            isDuplicate: true,
            error: `يوجد مستثمر مسجل مسبقاً بنفس الاسم تماماً ("${duplicateMatches.exactNameMatches[0].name}"). يرجى التأكيد إذا كنت ترغب في إنشاء حساب منفصل.`,
          },
          { status: 409 }
        );
      }
    }

    // Run database transaction to insert investor, wallet, and contract atomically
    const result = await db.transaction(async (tx) => {
      // 1. Insert Investor
      const [newInvestor] = await tx
        .insert(investors)
        .values({
          name: name.trim(),
          phone: phone.trim(),
          address: address ? address.trim() : null,
          nationalId: nationalId ? nationalId.trim() : null,
        })
        .returning();

      // 2. Insert Wallet
      const [newWallet] = await tx
        .insert(wallets)
        .values({
          ownerType: 'INVESTOR',
          investorId: newInvestor.id,
          ownerName: Boolean(isReferralPartner) ? `محفظة عمولات الإحالة (${newInvestor.name})` : `صندوق المستثمر ${newInvestor.name}`,
          balanceIQD: Number(capitalAmount).toFixed(2),
          totalCapitalDepositedIQD: Number(capitalAmount).toFixed(2),
        })
        .returning();

      const invDateObj = date && !isNaN(Date.parse(date)) ? new Date(date) : new Date();

      const isValidUuid = (val: unknown): val is string =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());

      const cleanReferrerId = isValidUuid(referrerId) ? referrerId.trim() : null;
      const cleanReferrerShare = cleanReferrerId && referrerSharePercent ? Number(referrerSharePercent).toFixed(2) : '0.00';

      // 3. Insert Investor Contract
      const [newContract] = await tx
        .insert(investorContracts)
        .values({
          investorId: newInvestor.id,
          investorSharePercent: Number(investorSharePercent || (Boolean(isReferralPartner) ? 0 : 60)).toFixed(2),
          companySharePercent: Number(companySharePercent || (Boolean(isReferralPartner) ? 100 : 40)).toFixed(2),
          lossPolicy: 'SHARED',
          referrerId: cleanReferrerId,
          referrerSharePercent: cleanReferrerShare,
          contractDate: invDateObj,
          notes: notes ? notes.trim() : (Boolean(isReferralPartner) ? 'حساب شريك إحالة معتمد' : 'عقد محفظة سرية ومستقلة حسب الأصول'),
        })
        .returning();

      // 4. Record Initial Capital Deposit in Ledger Transactions if capital > 0
      if (Number(capitalAmount) > 0) {
        await tx.insert(ledgerTransactions).values({
          referenceNo: `DEP-${Math.floor(1000 + Math.random() * 9000)}`,
          date: invDateObj,
          type: 'DEPOSIT',
          fromWalletId: newWallet.id,
          toWalletId: newWallet.id,
          investorId: newInvestor.id,
          amountIQD: Number(capitalAmount).toFixed(2),
          description: `إيداع رأس مال تأسيسي للمستثمر ${newInvestor.name}`,
        });
      }

      return {
        investor: newInvestor,
        wallet: newWallet,
        contract: newContract,
      };
    });

    return NextResponse.json({
      success: true,
      message: `تم إضافة المستثمر ${result.investor.name} وإنشاء محفظة بقيمة ${Number(capitalAmount).toLocaleString('en-US')} د.ع بنجاح`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error creating investor in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر إضافة المستثمر' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      phone,
      address,
      nationalId,
      investorSharePercent,
      companySharePercent,
      referrerId,
      referrerSharePercent,
      notes,
    } = body;

    if (!id || !name || !name.trim() || !phone || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: 'المعرّف والاسم ورقم الهاتف حقول مطلوبة' },
        { status: 400 }
      );
    }

    const isValidUuid = (val: unknown): val is string =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());

    if (!isValidUuid(id)) {
      return NextResponse.json(
        { success: false, error: 'معرّف السجل غير صالح' },
        { status: 400 }
      );
    }

    const cleanId = id.trim();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    const result = await db.transaction(async (tx) => {
      // 1. Update Investor personal info
      const [updatedInvestor] = await tx
        .update(investors)
        .set({
          name: cleanName,
          phone: cleanPhone,
          address: address !== undefined ? (address ? address.trim() : null) : undefined,
          nationalId: nationalId !== undefined ? (nationalId ? nationalId.trim() : null) : undefined,
        })
        .where(eq(investors.id, cleanId))
        .returning();

      if (!updatedInvestor) {
        throw new Error('المستثمر أو الوسيط غير موجود في قاعدة البيانات');
      }

      // 2. Update Wallet ownerName if present
      const existingWallets = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.investorId, cleanId));

      if (existingWallets.length > 0) {
        const w = existingWallets[0];
        const isReferralWallet = w.ownerName?.includes('عمولات الإحالة');
        await tx
          .update(wallets)
          .set({
            ownerName: isReferralWallet
              ? `محفظة عمولات الإحالة (${cleanName})`
              : `صندوق المستثمر ${cleanName}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, w.id));
      }

      // 3. Update Investor Contract (profit shares, referrerId, referrerSharePercent, notes)
      const existingContracts = await tx
        .select()
        .from(investorContracts)
        .where(eq(investorContracts.investorId, cleanId));

      let finalInvShare = 60;
      let finalRefId: string | null = null;
      let finalRefShare = 0;

      if (existingContracts.length > 0) {
        const currentContract = existingContracts[0];
        const nextInvPct =
          investorSharePercent !== undefined
            ? Math.max(0, Math.min(100, Number(investorSharePercent)))
            : parseFloat(currentContract.investorSharePercent || '60');
        const nextCompPct =
          companySharePercent !== undefined
            ? Math.max(0, Math.min(100, Number(companySharePercent)))
            : Math.max(0, 100 - nextInvPct);

        let nextRefId = currentContract.referrerId;
        if (referrerId !== undefined) {
          nextRefId =
            isValidUuid(referrerId) && referrerId.trim() !== cleanId
              ? referrerId.trim()
              : null;
        }

        let nextRefPct = parseFloat(currentContract.referrerSharePercent || '0');
        if (!nextRefId) {
          nextRefPct = 0;
        } else if (referrerSharePercent !== undefined) {
          nextRefPct = Math.max(0, Number(referrerSharePercent));
        }

        finalInvShare = nextInvPct;
        finalRefId = nextRefId;
        finalRefShare = nextRefPct;

        await tx
          .update(investorContracts)
          .set({
            investorSharePercent: nextInvPct.toFixed(2),
            companySharePercent: nextCompPct.toFixed(2),
            referrerId: nextRefId,
            referrerSharePercent: nextRefPct.toFixed(2),
            notes: notes !== undefined ? notes.trim() : currentContract.notes,
          })
          .where(eq(investorContracts.id, currentContract.id));
      }

      // 4. Recalculate unpaid installment schedules for this investor's active contracts
      const invInstallmentContracts = await tx
        .select({ id: installmentContracts.id })
        .from(installmentContracts)
        .where(eq(installmentContracts.investorId, cleanId));

      if (invInstallmentContracts.length > 0) {
        const contractIds = invInstallmentContracts.map((c) => c.id);
        const unpaidSchedules = await tx
          .select()
          .from(installmentSchedules)
          .where(
            and(
              inArray(installmentSchedules.contractId, contractIds),
              ne(installmentSchedules.status, 'PAID')
            )
          );

        for (const sch of unpaidSchedules) {
          const profitIQD = Math.round(parseFloat(sch.profitAmountIQD || '0'));
          const invShare = Math.round(profitIQD * (finalInvShare / 100));
          const grossComp = Math.max(0, profitIQD - invShare);
          const refShare =
            finalRefId && finalRefShare > 0
              ? Math.round(grossComp * (finalRefShare / 100))
              : 0;
          const compShare = Math.max(0, grossComp - refShare);

          await tx
            .update(installmentSchedules)
            .set({
              investorProfitShareIQD: invShare.toFixed(2),
              referrerProfitShareIQD: refShare.toFixed(2),
              companyProfitShareIQD: compShare.toFixed(2),
            })
            .where(eq(installmentSchedules.id, sch.id));
        }
      }

      return updatedInvestor;
    });

    return NextResponse.json({
      success: true,
      message: `تم تحديث بيانات ونسب العمولة لـ "${result.name}" بنجاح`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error updating investor in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر تحديث بيانات المستثمر أو الوسيط' },
      { status: 500 }
    );
  }
}
