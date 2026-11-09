import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. Register Employee (Pending Approval)
    if (action === 'register') {
      const { uid, name, role, email, phone, nationalId } = body;
      if (!name || !email) {
        return NextResponse.json({ success: false, error: 'الاسم والبريد الإلكتروني مطلوبان' }, { status: 400 });
      }

      const existing = await db.select().from(employees).where(eq(employees.email, email.toLowerCase().trim()));
      if (existing.length > 0) {
        if (uid && !existing[0].uid) {
          await db.update(employees).set({ uid }).where(eq(employees.id, existing[0].id));
        }
        return NextResponse.json({
          success: true,
          message: 'الحساب مسجل سابقاً وموجود بالسيستم',
          employee: { ...existing[0], uid: uid || existing[0].uid }
        });
      }

      const empId = uid || `emp-${Date.now()}`;
      const [newEmp] = await db.insert(employees).values({
        id: empId,
        uid: uid || null,
        name: name.trim(),
        role: role || 'محاسب مالي',
        email: email.toLowerCase().trim(),
        phone: phone ? phone.trim() : '07700000000',
        nationalId: nationalId ? nationalId.trim() : null,
        salaryIQD: '0.00',
        status: 'بانتظار الموافقة',
        permissions: '[]',
        notes: 'طلب انضمام مسجل عبر البوابة بانتظار موافقة مدير النظام'
      }).returning();

      return NextResponse.json({
        success: true,
        message: `تم تقديم طلب تسجيل الحساب للموظف "${newEmp.name}" بنجاح، وهو الآن بانتظار موافقة مدير النظام (أحمد إياد) لتفعيل الدخول وتعيين الصلاحيات`,
        employee: newEmp
      });
    }

    // 2. Approve Employee & Grant Permissions
    if (action === 'approve') {
      const { employeeId, permissions, salaryIQD } = body;
      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'معرف الموظف مطلوب' }, { status: 400 });
      }

      const defaultPerms = permissions && permissions.length > 0
        ? permissions
        : ['DASHBOARD_VIEW', 'FUNDS_MANAGE', 'EXPENSES_MANAGE', 'REVENUES_MANAGE', 'REPORTS_VIEW'];

      const [updatedEmp] = await db.update(employees)
        .set({
          status: 'نشط',
          permissions: JSON.stringify(defaultPerms),
          salaryIQD: salaryIQD ? String(salaryIQD) : '850000.00'
        })
        .where(eq(employees.id, employeeId))
        .returning();

      return NextResponse.json({
        success: true,
        message: `تم قبول وتفعيل حساب الموظف "${updatedEmp?.name || employeeId}" وتأكيد الصلاحيات بنجاح، ويمكنه الآن تسجيل الدخول بالنظام`,
        employee: updatedEmp
      });
    }

    // 3. Reject Employee Registration
    if (action === 'reject') {
      const { employeeId } = body;
      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'معرف الموظف مطلوب' }, { status: 400 });
      }

      await db.delete(employees).where(eq(employees.id, employeeId));

      return NextResponse.json({
        success: true,
        message: 'تم رفض وإلغاء طلب انضمام الموظف بنجاح'
      });
    }

    // 4. Update Permissions Only
    if (action === 'update_permissions') {
      const { employeeId, permissions } = body;
      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'معرف الموظف مطلوب' }, { status: 400 });
      }

      const [updatedEmp] = await db.update(employees)
        .set({
          permissions: JSON.stringify(permissions || [])
        })
        .where(eq(employees.id, employeeId))
        .returning();

      return NextResponse.json({
        success: true,
        message: `تم تحديث صلاحيات الموظف "${updatedEmp?.name || employeeId}" بنجاح (${permissions?.length || 0} صلاحية مخصصة)`,
        employee: updatedEmp
      });
    }

    return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });

  } catch (error: any) {
    console.error('Error in /api/employees route:', error);
    return NextResponse.json({ success: false, error: error.message || 'خطأ في خادم الموظفين' }, { status: 500 });
  }
}
