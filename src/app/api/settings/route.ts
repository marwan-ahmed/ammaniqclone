import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const rows = await db.select().from(systemSettings);
    
    // Map key-value pairs into a clean dictionary
    const settingsDict: Record<string, string> = {};
    rows.forEach((row) => {
      settingsDict[row.key] = row.value;
    });

    // Default admin passcode if not yet configured
    if (!settingsDict['admin_passcode']) {
      settingsDict['admin_passcode'] = '2026';
      // Auto-initialize in DB safely
      try {
        await db.insert(systemSettings).values({
          key: 'admin_passcode',
          value: '2026',
          description: 'رمز أمان الإدارة العامة لعمليات الحذف وتفريغ سلة المهملات',
          updatedBy: 'النظام'
        }).onConflictDoNothing();
      } catch (insertErr) {
        console.warn('Initial admin_passcode auto-init skipped:', insertErr);
      }
    }

    return NextResponse.json({
      success: true,
      settings: {
        adminPasscode: settingsDict['admin_passcode'] || '2026',
        privacyPasscode: settingsDict['privacy_passcode'] || settingsDict['admin_passcode'] || '2026',
        privacyAutoHideSeconds: settingsDict['privacy_auto_hide_seconds'] !== undefined ? Number(settingsDict['privacy_auto_hide_seconds']) : 30,
        companyName: settingsDict['company_name'] || 'شركة أمان للتقسيط والاستثمار المالي',
        companyAddress: settingsDict['company_address'] || 'سامراء - حي الجامعة',
        companyPhone: settingsDict['company_phone'] || '07700000000',
        companyActivity: settingsDict['company_activity'] || 'تقسيط الأجهزة والمواد والمشاريع الاستثمارية',
        managerName: settingsDict['manager_name'] || 'أحمد إياد',
        defaultCity: settingsDict['default_city'] || 'سامراء',
        usdExchangeRatePer100: settingsDict['usd_exchange_rate_per_100'] ? Number(settingsDict['usd_exchange_rate_per_100']) : 153000,
        usdExchangeRateUpdatedAt: settingsDict['usd_exchange_rate_updated_at'] || '',
        companyProfile: {
          companyName: settingsDict['company_name'] || 'شركة أمان للتقسيط والاستثمار المالي',
          companyAddress: settingsDict['company_address'] || 'سامراء - حي الجامعة',
          companyPhone: settingsDict['company_phone'] || '07700000000',
          companyActivity: settingsDict['company_activity'] || 'تقسيط الأجهزة والمواد والمشاريع الاستثمارية',
          managerName: settingsDict['manager_name'] || 'أحمد إياد',
        },
        ...settingsDict
      }
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'تعذر جلب إعدادات النظام من قاعدة البيانات',
        settings: { adminPasscode: '2026', privacyPasscode: '2026', privacyAutoHideSeconds: 30 }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value, adminPasscode, privacyPasscode, autoHideSeconds, updatedBy = 'مدير النظام' } = body;

    // Handle company profile update for reports and branding
    if (body.companyProfile && typeof body.companyProfile === 'object') {
      const { companyName, companyAddress, companyPhone, companyActivity, managerName } = body.companyProfile;
      const now = new Date();
      const updates = [
        {
          key: 'company_name',
          value: String(companyName || '').trim() || 'شركة أمان للتقسيط والاستثمار المالي',
          desc: 'اسم الشركة الرسمي في المطبوعات والتقارير'
        },
        {
          key: 'company_address',
          value: String(companyAddress || '').trim() || 'سامراء - حي الجامعة',
          desc: 'عنوان الشركة المعتمد في التقارير'
        },
        {
          key: 'company_phone',
          value: String(companyPhone || '').trim() || '07700000000',
          desc: 'الهاتف المعتمد للإدارة في التقارير'
        },
        {
          key: 'company_activity',
          value: String(companyActivity || '').trim() || 'تقسيط الأجهزة والمواد والمشاريع الاستثمارية',
          desc: 'نشاط الشركة ومجال عملها'
        },
        {
          key: 'manager_name',
          value: String(managerName || '').trim() || 'أحمد إياد',
          desc: 'اسم المدير التنفيذي للمصادقة على التقارير'
        },
      ];

      for (const item of updates) {
        await db.insert(systemSettings).values({
          key: item.key,
          value: item.value,
          description: item.desc,
          updatedAt: now,
          updatedBy: String(updatedBy)
        }).onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: item.value, updatedAt: now, updatedBy: String(updatedBy) }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'تم حفظ وتحديث بيانات وهوية الشركة في قاعدة البيانات بنجاح',
        companyProfile: {
          companyName: updates[0].value,
          companyAddress: updates[1].value,
          companyPhone: updates[2].value,
          companyActivity: updates[3].value,
          managerName: updates[4].value,
        }
      });
    }

    // Handle USD exchange rate update if provided
    const newRate = body.exchangeRatePer100 !== undefined
      ? body.exchangeRatePer100
      : (body.usdExchangeRatePer100 !== undefined
          ? body.usdExchangeRatePer100
          : (key === 'usd_exchange_rate_per_100' ? value : undefined));

    if (newRate !== undefined) {
      const numRate = Number(newRate);
      if (isNaN(numRate) || numRate <= 0) {
        return NextResponse.json(
          { success: false, message: 'سعر الصرف يجب أن يكون رقماً موجباً أكبر من الصفر' },
          { status: 400 }
        );
      }
      const now = new Date();
      const roundedRate = Math.round(numRate);

      await db.insert(systemSettings).values({
        key: 'usd_exchange_rate_per_100',
        value: String(roundedRate),
        description: 'سعر صرف 100 دولار أمريكي مقابل الدينار العراقي',
        updatedAt: now,
        updatedBy: String(updatedBy)
      }).onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: String(roundedRate), updatedAt: now, updatedBy: String(updatedBy) }
      });

      await db.insert(systemSettings).values({
        key: 'usd_exchange_rate_updated_at',
        value: now.toISOString(),
        description: 'تاريخ وتوقيت آخر تحديث لسعر صرف الدولار',
        updatedAt: now,
        updatedBy: String(updatedBy)
      }).onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: now.toISOString(), updatedAt: now, updatedBy: String(updatedBy) }
      });

      return NextResponse.json({
        success: true,
        message: 'تم تحديث سعر صرف الدولار بنجاح في قاعدة البيانات',
        usdExchangeRatePer100: roundedRate,
        usdExchangeRateUpdatedAt: now.toISOString()
      });
    }

    // Handle batch privacy settings update if provided
    if (privacyPasscode !== undefined || autoHideSeconds !== undefined) {
      if (privacyPasscode !== undefined) {
        const cleanPass = String(privacyPasscode).trim();
        if (cleanPass.length >= 4) {
          await db.insert(systemSettings).values({
            key: 'privacy_passcode',
            value: cleanPass,
            description: 'رمز مرور فك حجب الأرقام والبيانات المالية',
            updatedAt: new Date(),
            updatedBy: String(updatedBy)
          }).onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: cleanPass, updatedAt: new Date(), updatedBy: String(updatedBy) }
          });

          // Also keep admin_passcode in sync
          await db.insert(systemSettings).values({
            key: 'admin_passcode',
            value: cleanPass,
            description: 'رمز أمان الإدارة العامة لعمليات الحذف وتفريغ سلة المهملات',
            updatedAt: new Date(),
            updatedBy: String(updatedBy)
          }).onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: cleanPass, updatedAt: new Date(), updatedBy: String(updatedBy) }
          });
        }
      }

      if (autoHideSeconds !== undefined && autoHideSeconds !== null) {
        const numSec = Number(autoHideSeconds);
        const secVal = String(isNaN(numSec) ? 30 : numSec);
        await db.insert(systemSettings).values({
          key: 'privacy_auto_hide_seconds',
          value: secVal,
          description: 'المهلة الزمنية بالثواني للإخفاء التلقائي للأرقام المكشوفة',
          updatedAt: new Date(),
          updatedBy: String(updatedBy)
        }).onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: secVal, updatedAt: new Date(), updatedBy: String(updatedBy) }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'تم حفظ وتحديث إعدادات الخصوصية والأمان بنجاح في قاعدة البيانات',
        privacyPasscode,
        autoHideSeconds
      });
    }

    const targetKey = key || 'admin_passcode';
    const targetValue = value !== undefined ? String(value) : (adminPasscode ? String(adminPasscode) : '');

    if (!targetValue || targetValue.trim().length < 4) {
      return NextResponse.json(
        { success: false, message: 'رمز الأمان / كلمة المرور يجب أن تتكون من 4 خانات على الأقل' },
        { status: 400 }
      );
    }

    const cleanValue = targetValue.trim();

    // Upsert into systemSettings
    await db
      .insert(systemSettings)
      .values({
        key: targetKey,
        value: cleanValue,
        description: targetKey === 'admin_passcode' ? 'رمز أمان الإدارة العامة لعمليات الحذف وتفريغ سلة المهملات' : 'إعدادات النظام',
        updatedAt: new Date(),
        updatedBy: String(updatedBy)
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: cleanValue,
          updatedAt: new Date(),
          updatedBy: String(updatedBy)
        }
      });

    return NextResponse.json({
      success: true,
      message: 'تم حفظ وتحديث رمز المرور السري بنجاح في قاعدة البيانات',
      key: targetKey,
      value: cleanValue
    });
  } catch (error: any) {
    console.error('Error updating settings in database:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'تعذر حفظ كلمة السر في قاعدة البيانات'
      },
      { status: 500 }
    );
  }
}
