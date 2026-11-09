import { NextResponse } from 'next/server';
import { db } from '@/db';
import { trashItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { trashId } = body;

    if (!trashId) {
      return NextResponse.json(
        { success: false, error: 'معرّف عنصر سلة المهملات مطلوب' },
        { status: 400 }
      );
    }

    const [item] = await db
      .select()
      .from(trashItems)
      .where(eq(trashItems.id, trashId))
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'العنصر غير موجود في سلة المهملات' },
        { status: 404 }
      );
    }

    // Delete from trash table
    await db.delete(trashItems).where(eq(trashItems.id, trashId));

    let parsedData = null;
    try {
      parsedData = JSON.parse(item.originalData);
    } catch {
      parsedData = item.originalData;
    }

    return NextResponse.json({
      success: true,
      message: `تمت استعادة "${item.title}" بنجاح وإعادته للنظام`,
      data: {
        entityType: item.entityType,
        entityId: item.entityId,
        title: item.title,
        originalData: parsedData
      }
    });
  } catch (error: any) {
    console.error('Error restoring trash item:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
