import { NextResponse } from 'next/server';
import { db } from '@/db';
import { trashItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const list = await db.select().from(trashItems);
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error('Error fetching trash items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      entityType,
      entityId,
      title,
      subtitle,
      category,
      amountIQD,
      deletedBy,
      originalData,
      notes
    } = body;

    if (!entityType || !entityId || !title) {
      return NextResponse.json(
        { success: false, error: 'بيانات العنصر المنقول لسلة المهملات غير مكتملة' },
        { status: 400 }
      );
    }

    const trashId = id || `trash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const [inserted] = await db.insert(trashItems).values({
      id: trashId,
      entityType,
      entityId,
      title,
      subtitle: subtitle || null,
      category: category || 'عام',
      amountIQD: amountIQD !== undefined ? String(amountIQD) : null,
      deletedBy: deletedBy || 'مدير النظام',
      originalData: typeof originalData === 'string' ? originalData : JSON.stringify(originalData),
      notes: notes || null
    }).returning();

    return NextResponse.json({
      success: true,
      message: `تم نقل "${title}" إلى سلة المهملات بنجاح`,
      data: inserted
    });
  } catch (error: any) {
    console.error('Error adding item to trash:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { trashId, emptyAll, entityType } = body;

    if (trashId) {
      // Delete single item permanently
      await db.delete(trashItems).where(eq(trashItems.id, trashId));
      return NextResponse.json({
        success: true,
        message: 'تم حذف العنصر نهائياً من سلة المهملات'
      });
    }

    if (emptyAll) {
      // Empty entire recycle bin
      await db.delete(trashItems);
      return NextResponse.json({
        success: true,
        message: 'تم تفريغ سلة المهملات بالكامل بنجاح'
      });
    }

    if (entityType) {
      // Empty specific entity type
      await db.delete(trashItems).where(eq(trashItems.entityType, entityType));
      return NextResponse.json({
        success: true,
        message: `تم تفريغ عناصر ${entityType} من سلة المهملات بنجاح`
      });
    }

    return NextResponse.json(
      { success: false, error: 'يرجى تحديد العنصر أو اختيار تفريغ السلة' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error emptying trash:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
