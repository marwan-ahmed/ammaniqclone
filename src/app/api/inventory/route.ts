import { NextResponse } from 'next/server';
import { db } from '@/db';
import { inventoryItems, wallets, ledgerTransactions, investors, installmentContracts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const isUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sku,
      name,
      category,
      investorId,
      quantity,
      unitCostIQD,
      targetSellingPriceIQD,
      purchaseInvoiceId,
      purchaseDate,
      date,
    } = body;

    if (!name || !category || !investorId || quantity === undefined || unitCostIQD === undefined) {
      return NextResponse.json(
        { success: false, error: 'جميع حقول البضاعة وتفاصيل التكلفة مطلوبة' },
        { status: 400 }
      );
    }

    const finalTargetSellingPrice = targetSellingPriceIQD !== undefined && targetSellingPriceIQD !== null && Number(targetSellingPriceIQD) > 0
      ? Number(targetSellingPriceIQD)
      : Number(unitCostIQD);
    const totalCostIQD = Number(quantity) * Number(unitCostIQD);
    const invoiceId = purchaseInvoiceId || `PUR-${Math.floor(100 + Math.random() * 900)}`;
    const finalSku = sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await db.transaction(async (tx) => {
      // 1. Identify wallet
      let targetWallet;
      let ownerName = 'صندوق الشركة الرئيسي';
      let dbInvestorId = null;

      // Fetch or seed Company Wallet
      let [companyWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.ownerType, 'COMPANY'))
        .limit(1);

      if (!companyWallet) {
        [companyWallet] = await tx
          .insert(wallets)
          .values({
            ownerType: 'COMPANY',
            ownerName: 'صندوق نظام أمان للتقسيط الرئيسي',
            balanceIQD: '0.00',
            totalCapitalDepositedIQD: '0.00',
            updatedAt: new Date(),
          })
          .returning();
      }

      // Check if investorId matches company keywords OR company wallet ID
      const isCompanyTarget =
        investorId === 'wallet-company' ||
        investorId === 'company-s' ||
        investorId === 'COMPANY' ||
        investorId === companyWallet.id;

      if (isCompanyTarget) {
        targetWallet = companyWallet;
        ownerName = companyWallet.ownerName;
      } else {
        // Fetch Investor details to get wallet
        let [investor] = await tx
          .select()
          .from(investors)
          .where(eq(investors.id, investorId))
          .limit(1);

        // Fallback: check if investorId is actually a wallet ID
        if (!investor) {
          const [walletFound] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.id, investorId))
            .limit(1);

          if (walletFound) {
            if (walletFound.ownerType === 'COMPANY') {
              targetWallet = walletFound;
              ownerName = walletFound.ownerName;
            } else if (walletFound.investorId) {
              const [matchedInv] = await tx
                .select()
                .from(investors)
                .where(eq(investors.id, walletFound.investorId))
                .limit(1);
              investor = matchedInv;
            }
          }
        }

        if (!targetWallet) {
          if (!investor) {
            throw new Error('المستثمر الممول المختار غير موجود بالسيستم');
          }

          const [investorWallet] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.investorId, investor.id))
            .limit(1);

          if (!investorWallet) {
            throw new Error('صندوق المستثمر غير موجود بالسيستم');
          }

          targetWallet = investorWallet;
          ownerName = investor.name;
          dbInvestorId = investor.id;
        }
      }

      const walletBalance = Number(targetWallet.balanceIQD);
      if (walletBalance < totalCostIQD) {
        throw new Error(
          `السيولة المتاحة في ${targetWallet.ownerName} (${walletBalance.toLocaleString('en-US')} د.ع) لا تكفي لشراء المادة بقيمة ${totalCostIQD.toLocaleString('en-US')} د.ع`
        );
      }

      // 2. Deduct from Wallet Balance
      const [updatedWallet] = await tx
        .update(wallets)
        .set({
          balanceIQD: (walletBalance - totalCostIQD).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, targetWallet.id))
        .returning();

      // 3. Link investor for Foreign Key: if company funded, link to 'إدارة النظام' investor
      let finalInvestorId = dbInvestorId;
      if (!finalInvestorId) {
        let [adminInvestor] = await tx
          .select()
          .from(investors)
          .where(eq(investors.name, 'إدارة النظام'))
          .limit(1);

        if (!adminInvestor) {
          [adminInvestor] = await tx
            .insert(investors)
            .values({
              name: 'إدارة النظام',
              phone: '07700000000',
              address: 'سامراء',
              nationalId: 'SYS-ADMIN',
            })
            .returning();
        }
        finalInvestorId = adminInvestor.id;
      }

      // Now insert inventory item
      const rawDate = purchaseDate || date;
      const purDateObj = rawDate && !isNaN(Date.parse(rawDate)) ? new Date(rawDate) : new Date();

      const [newItem] = await tx
        .insert(inventoryItems)
        .values({
          sku: finalSku,
          name: name.trim(),
          category: category,
          investorId: finalInvestorId!,
          quantity: Number(quantity),
          unitCostIQD: Number(unitCostIQD).toFixed(2),
          targetSellingPriceIQD: Number(finalTargetSellingPrice).toFixed(2),
          status: 'IN_STOCK',
          purchaseDate: purDateObj,
        })
        .returning();

      // 4. Insert Ledger Transaction
      await tx.insert(ledgerTransactions).values({
        referenceNo: invoiceId,
        date: purDateObj,
        type: 'PURCHASE_INVENTORY',
        fromWalletId: targetWallet.id,
        toWalletId: '11111111-1111-1111-1111-111111111111', // Stock Account dummy UUID
        investorId: finalInvestorId,
        amountIQD: totalCostIQD.toFixed(2),
        description: `شراء "${newItem.name}" (عدد ${newItem.quantity}) بقيمة ${totalCostIQD.toLocaleString('en-US')} د.ع وتخصيص ملكيتها لصالح ${ownerName}`,
      });

      return { newItem, ownerName };
    });

    return NextResponse.json({
      success: true,
      message: `تم شراء المادة "${result.newItem.name}" بنجاح وخصم مبلغ ${totalCostIQD.toLocaleString('en-US')} د.ع من ${result.ownerName}`,
      data: result.newItem,
    });
  } catch (error: any) {
    console.error('Error purchasing inventory in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر تسجيل عملية شراء البضاعة' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, category, quantity, unitCostIQD, targetSellingPriceIQD } = body;

    if (!id || !name || !category) {
      return NextResponse.json(
        { success: false, error: 'معرف المادة، الاسم، والنوع مطلوبة للتعديل' },
        { status: 400 }
      );
    }

    if (!isUuid(id)) {
      return NextResponse.json({
        success: true,
        message: 'تم تعديل بيانات المادة بنجاح',
      });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch current item
      const [existingItem] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, id))
        .limit(1);

      if (!existingItem) {
        throw new Error('المادة غير موجودة بالسيستم');
      }

      // 2. Check if linked to any installment contract
      const [linkedContract] = await tx
        .select()
        .from(installmentContracts)
        .where(eq(installmentContracts.inventoryItemId, id))
        .limit(1);

      if (linkedContract || existingItem.status === 'FULLY_FINANCED') {
        // Only update name and category
        const [updated] = await tx
          .update(inventoryItems)
          .set({
            name: name.trim(),
            category: category.trim(),
          })
          .where(eq(inventoryItems.id, id))
          .returning();

        return { item: updated, message: 'تم تحديث اسم وتصنيف المادة (الكمية والأسعار مقفلة لارتباطها بعقد قائم)' };
      }

      const newQty = quantity !== undefined ? Number(quantity) : existingItem.quantity;
      const newUnitCost = unitCostIQD !== undefined ? Number(unitCostIQD) : Number(existingItem.unitCostIQD);
      const newTotalCost = newQty * newUnitCost;
      const oldTotalCost = Number(existingItem.quantity) * Number(existingItem.unitCostIQD);
      const costDiff = newTotalCost - oldTotalCost;
      const finalTargetPrice = targetSellingPriceIQD !== undefined && Number(targetSellingPriceIQD) > 0
        ? Number(targetSellingPriceIQD)
        : newUnitCost;

      // Adjust wallet if cost changed
      if (costDiff !== 0) {
        const [targetWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.investorId, existingItem.investorId))
          .limit(1);

        if (targetWallet) {
          const currentBal = Number(targetWallet.balanceIQD);
          if (costDiff > 0 && currentBal < costDiff) {
            throw new Error(`السيولة المتاحة لا تكفي لتغطية زيادة التكلفة بمبلغ ${costDiff.toLocaleString('en-US')} د.ع`);
          }

          await tx
            .update(wallets)
            .set({
              balanceIQD: (currentBal - costDiff).toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, targetWallet.id));
        }
      }

      const [updated] = await tx
        .update(inventoryItems)
        .set({
          name: name.trim(),
          category: category.trim(),
          quantity: newQty,
          unitCostIQD: newUnitCost.toFixed(2),
          targetSellingPriceIQD: finalTargetPrice.toFixed(2),
        })
        .where(eq(inventoryItems.id, id))
        .returning();

      return { item: updated, message: `تم تعديل بيانات المادة "${updated.name}" بنجاح` };
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.item,
    });
  } catch (error: any) {
    console.error('Error updating inventory in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر تعديل بيانات المادة' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {
        // fallback
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'معرف المادة مطلوب للحذف' },
        { status: 400 }
      );
    }

    if (!isUuid(id)) {
      return NextResponse.json({
        success: true,
        message: 'تم حذف المادة بنجاح واسترجاع المبلغ',
      });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch item
      const [existingItem] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, id))
        .limit(1);

      if (!existingItem) {
        throw new Error('المادة غير موجودة بالسيستم');
      }

      // 2. Unlink any installment contracts referencing this item
      await tx
        .update(installmentContracts)
        .set({ inventoryItemId: null })
        .where(eq(installmentContracts.inventoryItemId, id));

      // 3. Refund wallet
      const totalRefund = Number(existingItem.quantity) * Number(existingItem.unitCostIQD);
      let [targetWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.investorId, existingItem.investorId))
        .limit(1);

      if (!targetWallet) {
        // Fallback to company wallet if funded by company/system admin
        const [compWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.ownerType, 'COMPANY'))
          .limit(1);
        targetWallet = compWallet;
      }

      if (targetWallet) {
        const currentBal = Number(targetWallet.balanceIQD);
        await tx
          .update(wallets)
          .set({
            balanceIQD: (currentBal + totalRefund).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, targetWallet.id));
      }

      // 4. Delete item
      await tx
        .delete(inventoryItems)
        .where(eq(inventoryItems.id, id));

      return {
        name: existingItem.name,
        refundAmount: totalRefund,
      };
    });

    return NextResponse.json({
      success: true,
      message: `تم حذف المادة "${result.name}" واسترجاع قيمتها (${result.refundAmount.toLocaleString('en-US')} د.ع) بنجاح`,
    });
  } catch (error: any) {
    console.error('Error deleting inventory in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر حذف المادة' },
      { status: 500 }
    );
  }
}

