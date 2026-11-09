import { NextResponse } from 'next/server';
import { db } from '@/db';
import { borrowers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { borrowerId, guarantor } = body;

    if (!borrowerId || !guarantor || !guarantor.name || !guarantor.phone) {
      return NextResponse.json(
        { success: false, error: 'معرف الزبون وبيانات الكفيل (الاسم والهاتف) مطلوبة' },
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
      return NextResponse.json({ success: false, error: 'الزبون المحدد غير موجود' }, { status: 404 });
    }

    // 2. Append new guarantor
    let currentGuarantors = [];
    try {
      currentGuarantors = borrower.guarantors ? JSON.parse(borrower.guarantors) : [];
    } catch (e) {
      currentGuarantors = [];
    }

    currentGuarantors.push(guarantor);

    // 3. Update borrower record
    const [updatedBorrower] = await db
      .update(borrowers)
      .set({
        guarantors: JSON.stringify(currentGuarantors),
      })
      .where(eq(borrowers.id, borrowerId))
      .returning();

    return NextResponse.json({
      success: true,
      message: `تم إضافة الكفيل "${guarantor.name}" بنجاح لملف الزبون "${borrower.name}"`,
      data: updatedBorrower,
    });
  } catch (error: any) {
    console.error('Error adding guarantor in Neon DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر إضافة الكفيل ماليّاً' },
      { status: 500 }
    );
  }
}
