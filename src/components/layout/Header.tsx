'use client';

import React from 'react';
import { Bell, LogOut, Sparkles } from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { Employee, SYSTEM_PERMISSIONS } from '@/types/finance';
import { CurrencySwitcher } from '@/components/common/CurrencySwitcher';

interface HeaderProps {
  activeTab: ActiveTab;
  companyBalance: number;
  totalInvestorsCapital: number;
  onResetSimulation: () => void;
  currentEmployee?: Employee;
  onSignOut?: () => void;
  onOpenWelcomeBanner?: () => void;
}

const tabTitles: Record<ActiveTab, string> = {
  dashboard: 'لوحة التحكم الرئيسية',
  company_fund: 'صندوق الشركة الرئيسي وإدارة الخزينة',
  investors: 'سجل المستثمرين وعقود المحافظ',
  referrals: 'شبكة الإحالة واستقطاب رؤوس الأموال والعمولات',
  borrowers: 'سجل الزبائن والكفلاء',
  overdue: 'سجل المتأخرين عن السداد ومتابعة التحصيل',
  credit_score: 'لوحة قياس الائتمان وجودة الزبائن',
  funds: 'إدارة الصناديق والمحافظ المالية المستقلة',
  inventory: 'إدارة المخزن والأصول (تتبع الملكية)',
  invoices: 'سجل الفواتير وعقود التقسيط',
  expenses: 'المصروفات التشغيلية للشركة',
  revenues: 'الإيرادات والعمولات الإدارية',
  reports: 'التقارير المالية والأرباح والخسائر',
  debt_ledger: 'دفتر الديون',
  employees: 'إدارة الموظفين والصلاحيات',
  trash: 'سلة المهملات والأرشيف المسترجع',
  settings: 'إعدادات النظام والنسب التلقائية',
  profile: 'الملف الشخصي وإدارة الحساب',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currentEmployee,
  onSignOut,
  onOpenWelcomeBanner
}) => {
  const empName = currentEmployee ? currentEmployee.name : 'أحمد إياد';

  const empRole = currentEmployee ? currentEmployee.role : 'مدير النظام';
  const permCount = currentEmployee ? (currentEmployee.role === 'مدير النظام' ? SYSTEM_PERMISSIONS.length : currentEmployee.permissions.length) : SYSTEM_PERMISSIONS.length;

  return (
    <header className="print:hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-6 sm:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-0 z-20 shadow-lg">
      {/* Title & Active Page */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight break-words">{tabTitles[activeTab]}</h2>
        </div>
      </div>

      {/* User Switcher Pill & Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
        {/* Currency Switcher (IQD / USD) */}
        <CurrencySwitcher />

        {/* Active Logged-in Employee Display Pill */}
        <div
          className="bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-right"
          title={`المستخدم الحالي: ${empName} (${empRole})`}
        >
          <div className="w-8 h-8 rounded-lg bg-[#0A3C6E] text-white border border-[#1783C1]/30 font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
            {empName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white leading-tight truncate">{empName}</span>
              <span className="px-1.5 py-0.2 rounded bg-[#1783C1]/20 text-sky-300 border border-[#1783C1]/30 text-[10px] font-semibold">
                {permCount} صلاحية
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate">{empRole}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 3D Welcome Banner Launcher */}
          {onOpenWelcomeBanner && (
            <button
              onClick={onOpenWelcomeBanner}
              title="عرض البنر الترحيبي 3D لنظام أمان"
              className="p-2.5 rounded-xl bg-[#0A3C6E]/30 hover:bg-[#0A3C6E]/60 text-sky-200 hover:text-white transition-colors border border-[#1783C1]/40 flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-[#1783C1] shrink-0 animate-pulse" />
              <span className="hidden xl:inline">البنر الترحيبي 3D</span>
            </button>
          )}

          {onSignOut && (
            <button
              onClick={onSignOut}
              title="تسجيل الخروج من النظام"
              className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors border border-rose-500/30 flex items-center gap-2 text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="hidden sm:inline">الخروج</span>
            </button>
          )}

          <button className="relative p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#1783C1] ring-4 ring-slate-900" />
          </button>
        </div>
      </div>
    </header>
  );
};
