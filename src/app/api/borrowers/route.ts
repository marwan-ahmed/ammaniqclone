import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  borrowers,
  installmentContracts,
  installmentSchedules,
  inventoryItems,
  wallets,
  trashItems,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
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
      city,
      jobTitle,
      monthlyIncomeIQD,
      introducedBy,
      guarantors,
      allowDuplicate
    } = body;

    if (!name || !phone || !address) {
      return NextResponse.json(
        { success: false, error: 'الاسم ورقم الهاتف والعنوان حقول مطلوبة' },
        { status: 400 }
      );
    }

    // Check for duplicate in database if not explicitly bypassed
    if (!allowDuplicate) {
      const existingBorrowers = await db.select().from(borrowers);
      const duplicateMatches = findDuplicateMatches(name, phone, existingBorrowers);

      if (duplicateMatches.exactNameMatches.length > 0) {
        return NextResponse.json(
          {
            success: false,
            isDuplicate: true,
            error: `يوجد زبون مسجل مسبقاً بنفس الاسم تماماً ("${duplicateMatches.exactNameMatches[0].name}"). يرجى التأكيد إذا كنت ترغب في إنشاء ملف منفصل.`,
          },
          { status: 409 }
        );
      }
    }

    const [newBorrower] = await db
      .insert(borrowers)
      .values({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city ? city.trim() : 'سامراء',
        jobTitle: jobTitle ? jobTitle.trim() : null,
        monthlyIncomeIQD: monthlyIncomeIQD ? Number(monthlyIncomeIQD).toFixed(2) : '0.00',
        introducedBy: introducedBy ? introducedBy.trim() : null,
        guarantors: guarantors ? JSON.stringify(guarantors) : '[]',
        status: 'ACTIVE',
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: `تم تسجيل الزبون "${newBorrower.name}" وكفلائه بنجاح في قاعدة البيانات الحية`,
      data: newBorrower,
    });
  } catch (error: any) {
    console.error('Error creating borrower in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر إضافة الزبون' },
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
      city,
      jobTitle,
      monthlyIncomeIQD,
      introducedBy
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'معرّف الزبون مطلوب' },
        { status: 400 }
      );
    }

    const [updatedBorrower] = await db
      .update(borrowers)
      .set({
        ...(name ? { name: name.trim() } : {}),
        ...(phone ? { phone: phone.trim() } : {}),
        ...(address ? { address: address.trim() } : {}),
        ...(city ? { city: city.trim() } : {}),
        ...(jobTitle !== undefined ? { jobTitle: jobTitle ? jobTitle.trim() : null } : {}),
        ...(monthlyIncomeIQD !== undefined ? { monthlyIncomeIQD: Number(monthlyIncomeIQD).toFixed(2) } : {}),
        ...(introducedBy !== undefined ? { introducedBy: introducedBy ? introducedBy.trim() : null } : {}),
      })
      .where(eq(borrowers.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      message: `تم تحديث بيانات الزبون بنجاح`,
      data: updatedBorrower,
    });
  } catch (error: any) {
    console.error('Error updating borrower in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر تعديل بيانات الزبون' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { borrowerId, deletedBy = 'مدير النظام' } = body;

    if (!borrowerId) {
      return NextResponse.json(
        { success: false, error: 'معرّف الزبون مطلوب' },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch Borrower
      const [borrower] = await tx
        .select()
        .from(borrowers)
        .where(eq(borrowers.id, borrowerId))
        .limit(1);

      if (!borrower) {
        throw new Error('الزبون غير موجود في قاعدة البيانات');
      }

      // 2. Fetch all associated installment contracts
      const associatedContracts = await tx
        .select()
        .from(installmentContracts)
        .where(eq(installmentContracts.borrowerId, borrowerId));

      // 3. Safety Guard: Check if any contract has paid installments
      for (const contract of associatedContracts) {
        const schedules = await tx
          .select()
          .from(installmentSchedules)
          .where(eq(installmentSchedules.contractId, contract.id));

        const hasPaid = schedules.some((s) => s.status === 'PAID');
        if (hasPaid) {
          throw new Error(
            `لا يمكن إلغاء الزبون لوجود أقساط مسددة بالفعل في العقد رقم (${contract.contractNumber}). يرجى تسوية واسترداد الأقساط المسددة أولاً قبل الإلغاء.`
          );
        }
      }

      // 4. Reverse each contract: restore inventory stock, adjust wallets, remove schedules and contract
      for (const contract of associatedContracts) {
        // Return goods to inventory
        if (contract.inventoryItemId) {
          const [item] = await tx
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.id, contract.inventoryItemId))
            .limit(1);

          if (item) {
            const currentQty = item.quantity !== undefined && item.quantity !== null ? item.quantity : 0;
            const unitCost = parseFloat(item.unitCostIQD || '0');
            const contractCost = parseFloat(contract.itemCostPriceIQD || '0');
            const restoreQty = unitCost > 0 ? Math.max(1, Math.round(contractCost / unitCost)) : 1;
            const newQty = currentQty + restoreQty;
            await tx
              .update(inventoryItems)
              .set({
                quantity: newQty,
                status: 'IN_STOCK',
              })
              .where(eq(inventoryItems.id, item.id));
          }
        }

        // Down payment refund adjustment if paid
        const downPayment = parseFloat(contract.downPaymentIQD || '0');
        if (downPayment > 0 && contract.investorId) {
          const [wallet] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.investorId, contract.investorId))
            .limit(1);

          if (wallet) {
            const currentBal = parseFloat(wallet.balanceIQD || '0');
            const newBal = Math.max(0, currentBal - downPayment);
            await tx
              .update(wallets)
              .set({ balanceIQD: newBal.toFixed(2), updatedAt: new Date() })
              .where(eq(wallets.id, wallet.id));
          }
        }

        // Delete contract schedules
        await tx
          .delete(installmentSchedules)
          .where(eq(installmentSchedules.contractId, contract.id));

        // Delete contract record
        await tx
          .delete(installmentContracts)
          .where(eq(installmentContracts.id, contract.id));
      }

      // 5. Store snapshot in trash_items
      const trashId = `trash-borrower-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await tx.insert(trashItems).values({
        id: trashId,
        entityType: 'BORROWER',
        entityId: borrower.id,
        title: borrower.name,
        subtitle: `ملف زبون (${borrower.phone}) مع (${associatedContracts.length}) عقد تقسيط مسترجع للمخزن`,
        category: 'الزبائن',
        amountIQD: null,
        deletedBy: deletedBy || 'مدير النظام',
        originalData: JSON.stringify({ borrower, associatedContracts }),
      });

      // 6. Delete borrower record
      await tx
        .delete(borrowers)
        .where(eq(borrowers.id, borrowerId));

      return {
        borrowerName: borrower.name,
        contractsCount: associatedContracts.length,
      };
    });

    return NextResponse.json({
      success: true,
      message: `تم إلغاء ملف الزبون "${result.borrowerName}" واسترجاع البضاعة للمخزن وتصفير الديون بنجاح`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error deleting borrower in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر إلغاء ملف الزبون' },
      { status: 400 }
    );
  }
}
