import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { adminPasscode, requestedBy = 'مدير النظام' } = body;

    // 1. Fetch current admin passcode from systemSettings or default 2026
    const [passSetting] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'admin_passcode'))
      .limit(1);

    const validPass = passSetting?.value || '2026';
    const cleanInputPass = adminPasscode ? String(adminPasscode).trim() : '';

    if (!cleanInputPass || cleanInputPass !== validPass.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'رمز أمان الإدارة غير صحيح. يرجى إدخال رمز المرور الإداري المعتمد لتأكيد تصفير دورة الترقيم.',
        },
        { status: 403 }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 2. Save numbering_reset_epoch into systemSettings
    await db
      .insert(systemSettings)
      .values({
        key: 'numbering_reset_epoch',
        value: nowIso,
        description: 'تاريخ وتوقيت تصفير دورة أرقام العقود والوصولات لتبدأ من رقم 1 يدوياً بقرار الإدارة',
        updatedAt: now,
        updatedBy: String(requestedBy),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: nowIso,
          updatedAt: now,
          updatedBy: String(requestedBy),
        },
      });

    return NextResponse.json({
      success: true,
      message: 'تم تصفير دورة الترقيم بنجاح. ستبدأ العقود والفواتير والوصولات الجديدة من رقم (1)، مع بقاء كافة السجلات السابقة محفوظة بكامل بياناتها.',
      numberingResetEpoch: nowIso,
    });
  } catch (error: any) {
    console.error('Error resetting numbering cycle:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'حدث خطأ في النظام أثناء تصفير دورة الترقيم',
      },
      { status: 500 }
    );
  }
}

