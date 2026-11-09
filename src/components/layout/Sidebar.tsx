'use client';

import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Wallet,
  Boxes,
  FileText,
  TrendingDown,
  TrendingUp,
  BarChart3,
  BookOpenCheck,
  UserCog,
  Settings,
  LogOut,
  Building2,
  Lock,
  ShieldCheck,
  User,
  Trash2,
  Landmark,
  AlertTriangle,
  Share2,
  Pencil,
  Check,
  ChevronUp,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { Employee, SYSTEM_PERMISSIONS } from '@/types/finance';
import {
  loadSavedSidebarOrder,
  saveSidebarOrder,
  moveSidebarItem,
  resolveSidebarOrder
} from '@/utils/sidebarOrder';

export type ActiveTab =
  | 'dashboard'
  | 'company_fund'
  | 'investors'
  | 'referrals'
  | 'borrowers'
  | 'overdue'
  | 'credit_score'
  | 'funds'
  | 'inventory'
  | 'invoices'
  | 'expenses'
  | 'revenues'
  | 'reports'
  | 'debt_ledger'
  | 'employees'
  | 'trash'
  | 'settings'
  | 'profile';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentEmployee?: Employee;
  hasPermission?: (permissionId: string) => boolean;
  trashCount?: number;
  overdueCount?: number;
}

const tabPermissionMap: Record<ActiveTab, string | string[] | null> = {
  dashboard: 'DASHBOARD_VIEW',
  company_fund: ['COMPANY_FUND_MANAGE', 'COMPANY_FUND_WITHDRAW', 'FUNDS_MANAGE'],
  investors: ['INVESTORS_MANAGE', 'INVESTORS_VIEW', 'INVESTORS_WITHDRAW', 'INVESTORS_STATEMENT_PRINT'],
  referrals: ['REFERRALS_MANAGE', 'INVESTORS_MANAGE'],
  borrowers: ['BORROWERS_MANAGE', 'BORROWERS_VIEW', 'BORROWERS_DELETE'],
  overdue: ['OVERDUE_MANAGE', 'BORROWERS_MANAGE'],
  credit_score: ['CREDIT_SCORE_VIEW', 'BORROWERS_MANAGE'],
  funds: ['FUNDS_MANAGE', 'COMPANY_FUND_MANAGE'],
  inventory: ['INVENTORY_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_EDIT', 'INVENTORY_DELETE'],
  invoices: ['CONTRACTS_CREATE', 'CONTRACTS_VIEW', 'INSTALLMENTS_PAY', 'CONTRACTS_PRINT'],
  expenses: ['EXPENSES_MANAGE', 'EXPENSES_DELETE'],
  revenues: 'REVENUES_MANAGE',
  reports: ['REPORTS_VIEW', 'REPORTS_EXPORT'],
  debt_ledger: 'DEBT_LEDGER_MANAGE',
  employees: ['EMPLOYEES_MANAGE', 'PERMISSIONS_ASSIGN'],
  trash: ['TRASH_MANAGE', 'TRASH_PERMANENT_DELETE'],
  settings: 'SETTINGS_MANAGE',
  profile: null,
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentEmployee,
  hasPermission = () => true,
  trashCount = 0,
  overdueCount = 0
}) => {
  const defaultMenuItems = useMemo(
    () => [
      { id: 'dashboard', label: 'لوحة التحكم الرئيسية', icon: LayoutDashboard },
      { id: 'company_fund', label: 'صندوق الشركة', icon: Landmark },
      { id: 'investors', label: 'المستثمرين والمحافظ', icon: Users },
      { id: 'referrals', label: 'شبكة الإحالة والعمولات', icon: Share2 },
      { id: 'borrowers', label: 'الزبائن والكفلاء', icon: UserCheck },
      { id: 'overdue', label: 'المتأخرين عن السداد', icon: AlertTriangle },
      { id: 'credit_score', label: 'قياس الائتمان والجودة', icon: ShieldCheck },
      { id: 'funds', label: 'الصناديق المالية', icon: Wallet },
      { id: 'inventory', label: 'المخزن والأصول', icon: Boxes },
      { id: 'invoices', label: 'الفواتير والعقود', icon: FileText },
      { id: 'expenses', label: 'المصروفات التشغيلية', icon: TrendingDown },
      { id: 'revenues', label: 'الإيرادات والرسوم', icon: TrendingUp },
      { id: 'reports', label: 'التقارير المالية P&L', icon: BarChart3 },
      { id: 'debt_ledger', label: 'دفتر الديون', icon: BookOpenCheck },
      { id: 'employees', label: 'الموظفين والصلاحيات', icon: UserCog },
      { id: 'trash', label: 'سلة المهملات والأرشيف', icon: Trash2 },
      { id: 'settings', label: 'الإعدادات والنظام', icon: Settings },
    ],
    []
  );

  const defaultIds = useMemo(() => defaultMenuItems.map((m) => m.id), [defaultMenuItems]);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [itemOrder, setItemOrder] = useState<string[]>(() => loadSavedSidebarOrder(defaultIds));

  const menuItems = useMemo(() => {
    const orderedIds = resolveSidebarOrder(itemOrder, defaultIds);
    const itemMap = new Map(defaultMenuItems.map((item) => [item.id, item]));
    return orderedIds.map((id) => itemMap.get(id)!).filter(Boolean);
  }, [itemOrder, defaultIds, defaultMenuItems]);

  const handleMoveItem = (itemId: string, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    setItemOrder((prev) => {
      const currentOrdered = resolveSidebarOrder(prev, defaultIds);
      const nextOrder = moveSidebarItem(currentOrdered, itemId, direction);
      saveSidebarOrder(nextOrder);
      return nextOrder;
    });
  };

  const handleResetOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    const reset = [...defaultIds];
    setItemOrder(reset);
    saveSidebarOrder(reset);
  };

  const empName = currentEmployee ? currentEmployee.name : 'أحمد إياد';

  const empRole = currentEmployee ? currentEmployee.role : 'مدير النظام';
  const isSuperAdmin = empRole === 'مدير النظام';
  const permCount = currentEmployee ? (isSuperAdmin ? SYSTEM_PERMISSIONS.length : (currentEmployee.permissions ? currentEmployee.permissions.length : 0)) : SYSTEM_PERMISSIONS.length;

  return (
    <aside className="print:hidden w-60 lg:w-64 xl:w-72 2xl:w-80 h-screen sticky top-0 shrink-0 bg-slate-900 text-slate-100 flex flex-col border-l border-slate-800 shadow-2xl select-none transition-all duration-200">
      {/* Brand & Location Header */}
      <div className="shrink-0 p-3.5 lg:p-4 xl:p-5 2xl:p-6 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2.5 lg:gap-3 min-w-0">
          <div className="w-10 h-10 lg:w-11 lg:h-11 2xl:w-12 2xl:h-12 rounded-xl bg-gradient-to-tr from-[#0A3C6E] to-[#1783C1] p-0.5 shadow-md shadow-[#0A3C6E]/30 shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Building2 className="w-5 h-5 lg:w-5.5 lg:h-5.5 2xl:w-6 2xl:h-6 text-[#1783C1]" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-sm lg:text-base xl:text-lg 2xl:text-xl text-white leading-tight truncate">نظام أمان للتقسيط</h1>
            <p className="text-[11px] lg:text-xs 2xl:text-sm text-[#1783C1] font-medium truncate mt-0.5">سامراء - صلاح الدين</p>
          </div>
        </div>
        <div className="mt-3 lg:mt-3.5 2xl:mt-4 px-2.5 py-1.5 lg:px-3 2xl:px-3.5 2xl:py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-[11px] lg:text-xs 2xl:text-sm text-slate-300">
          <span>العملة الرسمية:</span>
          <span className="font-bold text-[#1783C1]">دينار عراقي (د.ع)</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2 lg:p-2.5 xl:p-3 2xl:p-3.5 space-y-0.5 lg:space-y-1 2xl:space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 hover:scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <div className="px-2.5 lg:px-3 pt-1.5 pb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] lg:text-[11px] 2xl:text-xs font-semibold text-slate-400 tracking-wider">
            قائمة النظام الرئيسية
          </p>
          <div className="flex items-center gap-1">
            {isEditingOrder && (
              <button
                type="button"
                onClick={handleResetOrder}
                title="إعادة الترتيب الافتراضي"
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditingOrder((prev) => !prev)}
              title={isEditingOrder ? 'حفظ وإنهاء ترتيب القائمة' : 'تعديل أماكن وترتيب أزرار القائمة'}
              className={`p-1 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold ${
                isEditingOrder
                  ? 'bg-[#1783C1]/20 text-sky-300 border border-[#1783C1]/40 px-2'
                  : 'text-slate-400 hover:text-sky-300 hover:bg-slate-800/70'
              }`}
            >
              {isEditingOrder ? (
                <>
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>تم</span>
                </>
              ) : (
                <Pencil className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const requiredPerm = tabPermissionMap[item.id as ActiveTab];
          const isAllowed = !requiredPerm
            ? true
            : Array.isArray(requiredPerm)
              ? requiredPerm.some(p => hasPermission(p))
              : hasPermission(requiredPerm);
          const isFirst = idx === 0;
          const isLast = idx === menuItems.length - 1;

          return (
            <div
              key={item.id}
              onClick={() => {
                if (!isEditingOrder) {
                  setActiveTab(item.id as ActiveTab);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (!isEditingOrder && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setActiveTab(item.id as ActiveTab);
                }
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 lg:px-3 lg:py-2.5 xl:px-3.5 2xl:px-4 2xl:py-3 rounded-xl text-xs lg:text-[13px] xl:text-sm 2xl:text-[15px] font-medium transition-all duration-200 text-right min-w-0 cursor-pointer ${
                isEditingOrder
                  ? 'bg-slate-800 border border-dashed border-[#1783C1]/40 text-slate-200'
                  : isActive
                  ? 'bg-[#0A3C6E] text-white shadow-md shadow-[#0A3C6E]/30 font-bold'
                  : isAllowed
                  ? 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  : 'text-slate-500 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2 lg:gap-2.5 xl:gap-3 min-w-0">
                <Icon className={`w-4 h-4 lg:w-4.5 lg:h-4.5 xl:w-5 xl:h-5 2xl:w-5.5 2xl:h-5.5 shrink-0 ${isActive && !isEditingOrder ? 'text-white' : isAllowed ? 'text-slate-400 group-hover:text-[#1783C1]' : 'text-slate-600'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 lg:gap-2">
                {isEditingOrder ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={(e) => handleMoveItem(item.id, 'up', e)}
                      title="تحريك للأعلى"
                      className="p-1 rounded-lg bg-slate-900 hover:bg-[#1783C1]/20 text-slate-300 hover:text-sky-300 disabled:opacity-25 disabled:pointer-events-none border border-slate-700/80 transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={(e) => handleMoveItem(item.id, 'down', e)}
                      title="تحريك للأسفل"
                      className="p-1 rounded-lg bg-slate-900 hover:bg-[#1783C1]/20 text-slate-300 hover:text-sky-300 disabled:opacity-25 disabled:pointer-events-none border border-slate-700/80 transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    {item.id === 'overdue' && overdueCount > 0 && (
                      <span className={`px-1.5 py-0.5 lg:px-2 rounded-full text-[9px] lg:text-[10px] 2xl:text-xs font-mono font-bold shrink-0 animate-pulse ${
                        isActive
                          ? 'bg-white text-rose-600'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}>
                        {overdueCount}
                      </span>
                    )}

                    {item.id === 'trash' && trashCount > 0 && (
                      <span className={`px-1.5 py-0.5 lg:px-2 rounded-full text-[9px] lg:text-[10px] 2xl:text-xs font-mono font-bold shrink-0 ${
                        isActive
                          ? 'bg-white text-rose-600'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {trashCount}
                      </span>
                    )}

                    {!isAllowed && (
                      <span className="flex items-center gap-1 text-[9px] lg:text-[10px] 2xl:text-xs font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20 shrink-0">
                        <Lock className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                        <span>محظور</span>
                      </span>
                    )}

                    {isAllowed && (item.id === 'debt_ledger' || item.id === 'settings') && (
                      <span
                        className={`p-1 rounded-md text-[10px] shrink-0 ${
                          isActive
                            ? 'text-white/80'
                            : 'text-amber-400/90 bg-amber-500/10 border border-amber-500/20'
                        }`}
                        title="قسم محمي برمز أمان"
                      >
                        <Lock className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Profile & Account Switcher */}
      <div className="shrink-0 p-2.5 lg:p-3 xl:p-3.5 2xl:p-4 border-t border-slate-800/80 bg-slate-950/70">
        <div
          onClick={() => setActiveTab('profile')}
          className={`flex items-center justify-between p-2 lg:p-2.5 rounded-xl cursor-pointer transition-colors min-w-0 ${
            activeTab === 'profile' ? 'bg-[#0A3C6E] text-white' : 'hover:bg-slate-800/60 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 lg:gap-3 min-w-0">
            <div className={`w-8 h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 2xl:w-11 2xl:h-11 rounded-full ${activeTab === 'profile' ? 'bg-white text-[#0A3C6E]' : 'bg-[#0A3C6E] text-white border border-[#1783C1]/40'} flex items-center justify-center font-bold text-xs lg:text-sm 2xl:text-base shrink-0 shadow-sm`}>
              {empName.charAt(0)}
            </div>
            <div className="text-right min-w-0">
              <p className={`text-xs lg:text-[13px] xl:text-sm 2xl:text-base font-semibold leading-none truncate ${activeTab === 'profile' ? 'text-white' : 'text-slate-100'}`}>{empName}</p>
              <p className={`text-[10px] lg:text-[11px] xl:text-xs 2xl:text-xs mt-1 truncate ${activeTab === 'profile' ? 'text-white/80' : 'text-slate-400'}`}>{empRole}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
