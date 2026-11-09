import { NextResponse } from 'next/server';
import { db } from '@/db';
import { directDebts, systemSettings } from '@/db/schema';
import { eq, desc, and, gte, lt } from 'drizzle-orm';
import {
  createDebtorAccount,
  parseDebtorAccountFromDbRow,
  serializeDebtorAccountForDb,
  DebtLedgerEntry,
} from '@/utils/debtLedger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const rows = await db.select().from(directDebts).orderBy(desc(directDebts.createdAt));
    const accounts = rows.map((row) => parseDebtorAccountFromDbRow(row));

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر جلب بيانات دفتر الديون';
    console.error('Error fetching standalone debt ledger:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      debtorName?: string;
      entries?: Partial<DebtLedgerEntry>[];
    };

    const rawName = typeof body.debtorName === 'string' ? body.debtorName.trim() : '';
    if (!rawName) {
      return NextResponse.json(
        { success: false, error: 'يرجى إدخال اسم المدين' },
        { status: 400 }
      );
    }

    const account = createDebtorAccount({
      debtorName: rawName,
      entries: Array.isArray(body.entries) ? body.entries : [],
    });
    const serialized = serializeDebtorAccountForDb(account);

    // Check if numbering cycle was manually reset by admin
    const [epochSetting] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'numbering_reset_epoch'))
      .limit(1);

    const resetEpochStr = epochSetting?.value;
    const resetEpochDate = resetEpochStr && !isNaN(Date.parse(resetEpochStr)) ? new Date(resetEpochStr) : null;

    let existingDebts;
    if (resetEpochDate) {
      existingDebts = await db
        .select({ contractNumber: directDebts.contractNumber })
        .from(directDebts)
        .where(gte(directDebts.createdAt, resetEpochDate));
    } else {
      existingDebts = await db
        .select({ contractNumber: directDebts.contractNumber })
        .from(directDebts);
    }

    let maxDebtNum = 0;
    for (const ed of existingDebts) {
      const n = parseInt(String(ed.contractNumber || '').replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maxDebtNum) maxDebtNum = n;
    }
    const contractNumber = String(maxDebtNum + 1);

    const [inserted] = await db
      .insert(directDebts)
      .values({
        contractNumber,
        borrowerName: serialized.borrowerName,
        borrowerPhone: null,
        investorId: 'external',
        itemName: 'سجل ديون خارجي',
        totalAmountIQD: serialized.totalAmountIQD,
        downPaymentIQD: serialized.downPaymentIQD,
        monthsCount: 1,
        status: account.totalRemaining <= 0 && account.totalDebt > 0 ? 'COMPLETED' : 'ACTIVE',
        startDate: new Date(),
        notes: serialized.notes,
      })
      .returning();

    const savedAccount = parseDebtorAccountFromDbRow(inserted);

    return NextResponse.json({
      success: true,
      message: `تم فتح حساب المدين (${savedAccount.debtorName}) في دفتر الديون بنجاح`,
      data: savedAccount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر حفظ حساب المدين';
    console.error('Error creating debtor account:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: string;
      debtorName?: string;
      entries?: Partial<DebtLedgerEntry>[];
    };

    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const rawName = typeof body.debtorName === 'string' ? body.debtorName.trim() : '';
    if (!id || !rawName) {
      return NextResponse.json(
        { success: false, error: 'معرف المدين واسم المدين مطلوبان للتحديث' },
        { status: 400 }
      );
    }

    const account = createDebtorAccount({
      id,
      debtorName: rawName,
      entries: Array.isArray(body.entries) ? body.entries : [],
    });
    const serialized = serializeDebtorAccountForDb(account);

    const [updated] = await db
      .update(directDebts)
      .set({
        borrowerName: serialized.borrowerName,
        totalAmountIQD: serialized.totalAmountIQD,
        downPaymentIQD: serialized.downPaymentIQD,
        status: account.totalRemaining <= 0 && account.totalDebt > 0 ? 'COMPLETED' : 'ACTIVE',
        notes: serialized.notes,
      })
      .where(eq(directDebts.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'لم يتم العثور على سجل المدين في قاعدة البيانات' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `تم تحديث جدول المدين (${account.debtorName}) بنجاح`,
      data: parseDebtorAccountFromDbRow(updated),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر تحديث سجل المدين';
    console.error('Error updating debtor account:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim() || '';
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'معرف المدين مطلوب للحذف' },
        { status: 400 }
      );
    }

    await db.delete(directDebts).where(eq(directDebts.id, id));

    return NextResponse.json({
      success: true,
      message: 'تم حذف حساب المدين من دفتر الديون بنجاح',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر حذف سجل المدين';
    console.error('Error deleting debtor account:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
