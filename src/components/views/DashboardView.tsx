'use client';

import React, { useMemo } from 'react';
import {
  Users,
  Boxes,
  UserCheck,
  Play,
  Sparkles,
  ChevronLeft,
  AlertTriangle,
  Wallet,
  Building2,
  TrendingUp,
  Coins,
  ArrowUpRight
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';

import { formatIQD } from '@/utils/formatters';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { calculateInstallmentDueStatus, isBorrowerSettled } from '@/utils/installmentDates';
import { getCapitalInvestors, getCapitalWallets } from '@/utils/investorSelectors';

interface DashboardViewProps {
  store: SimulationStore;
  onPaySchedule: (contractId: string, scheduleId: string) => void;
  setActiveTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ store, onPaySchedule, setActiveTab }) => {
  const capitalInvestors = getCapitalInvestors(store.investors);
  const capitalWallets = getCapitalWallets(store.wallets, store.investors);
  const totalInvestorCapital = capitalInvestors.reduce((acc, inv) => acc + inv.totalCapitalDeposited, 0);

  // In-stock warehouse inventory calculations (only physical items present in stock)
  const inStockItems = useMemo(
    () => store.inventory.filter((item) => item.status !== 'FULLY_FINANCED' && (item.quantity ?? 0) > 0),
    [store.inventory]
  );
  const totalInventoryQuantity = useMemo(
    () => inStockItems.reduce((acc, item) => acc + (item.quantity || 0), 0),
    [inStockItems]
  );
  const totalInventoryValuation = useMemo(
    () => inStockItems.reduce((acc, item) => acc + ((item.quantity || 0) * (item.unitCostIQD || 0)), 0),
    [inStockItems]
  );

  // Active borrowers and active outstanding debts (consistent with BorrowersView)
  const activeBorrowers = useMemo(
    () => store.borrowers.filter((b) => !isBorrowerSettled(b)),
    [store.borrowers]
  );
  const activeBorrowersCount = activeBorrowers.length;
  const totalDebts = useMemo(
    () => activeBorrowers.reduce((acc, b) => acc + Math.max(0, b.remainingDebtIQD || 0), 0),
    [activeBorrowers]
  );
  const totalInvestorProfits = capitalInvestors.reduce((acc, inv) => acc + inv.totalProfitsEarned, 0);

  // Company Fund & Profit Metrics
  const companyWalletBalance = store.companyWallet.balance;
  const companyRepaymentProfits = store.contracts
    .flatMap((c) => c.schedules)
    .filter((s) => s.status === 'PAID')
    .reduce((sum, s) => sum + s.companyProfitShareIQD, 0);
  const totalDirectRevenues = store.revenues.reduce((sum, r) => sum + r.amountIQD, 0);
  const totalCompanyProfits = companyRepaymentProfits + totalDirectRevenues;
  const totalCombinedLiquidity = capitalWallets.reduce((sum, w) => sum + w.balance, 0);

  // Overdue and upcoming installments calculations powered by standard utility
  const overdueInfo = useMemo(() => {
    let overdueCount = 0;
    let overdueAmount = 0;
    let dueTodayCount = 0;
    let upcomingCount = 0;
    const overdueBorrowerIds = new Set<string>();

    store.contracts.forEach((contract) => {
      contract.schedules.forEach((schedule) => {
        if (schedule.status === 'PAID') return;
        const due = calculateInstallmentDueStatus(schedule.dueDate, false);
        if (due.status === 'OVERDUE') {
          overdueCount++;
          overdueAmount += schedule.amountIQD;
          overdueBorrowerIds.add(contract.borrowerId);
        } else if (due.status === 'DUE_TODAY') {
          dueTodayCount++;
          overdueBorrowerIds.add(contract.borrowerId);
        } else if (due.status === 'UPCOMING') {
          upcomingCount++;
        }
      });
    });

    return {
      overdueCount,
      overdueAmount,
      dueTodayCount,
      upcomingCount,
      overdueBorrowersCount: overdueBorrowerIds.size
    };
  }, [store.contracts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/90 p-8 border border-slate-800 shadow-xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#1783C1]/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1783C1]/10 border border-[#1783C1]/30 text-sky-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#1783C1]" />
              <span>مركز التمويل وإدارة المحافظ التفاعلي - سامراء</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              لوحة التحكم الشاملة والمركز التفاعلي
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <PrivacyToggleButton />
            <button
              onClick={() => setActiveTab('funds')}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#0A3C6E] hover:bg-[#1783C1] text-white font-bold text-xs transition-all shadow-lg shadow-[#0A3C6E]/30 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>استعراض الصناديق والمحافظ</span>
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPANY FUND & LIQUIDITY HERO SECTION (Prominently Showcases Company Fund) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Hero Card 1: Company Wallet Balance */}
        <div
          onClick={() => setActiveTab('funds')}
          className="cursor-pointer bg-slate-900/90 border border-[#0A3C6E]/50 hover:border-[#1783C1] p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0A3C6E]/20 text-[#1783C1] flex items-center justify-center border border-[#0A3C6E]/40 shadow-sm">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-[#1783C1] font-bold block uppercase tracking-wider">صندوق الشركة المالي</span>
                <h3 className="font-extrabold text-white text-base group-hover:text-[#1783C1] transition-colors">
                  صندوق نظام أمان الرئيسي
                </h3>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-[#1783C1] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>

          <div className="pt-4 space-y-2">
            <span className="text-xs text-slate-400 block">السيولة المتاحة حالياً بالصندوق:</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight">
                <PrivacyMaskedAmount id="dash-hero-company-balance" value={companyWalletBalance} label="صندوق الشركة الرئيسي" size="lg" />
              </span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
              <span>الحالة: <strong className="text-sky-300">نشط وجاهز للتمويل</strong></span>
              <span className="text-[#1783C1] font-bold underline text-[11px]">كشف الحساب ⤹</span>
            </p>
          </div>
        </div>

        {/* Hero Card 2: Company Retained Profits */}
        <div
          onClick={() => setActiveTab('revenues')}
          className="cursor-pointer bg-slate-900/90 border border-slate-800 hover:border-[#1783C1]/60 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#1783C1]/20 text-[#1783C1] flex items-center justify-center border border-[#1783C1]/30 shadow-sm">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-[#1783C1] font-bold block uppercase tracking-wider">الأرباح والرسوم المباشرة</span>
                <h3 className="font-extrabold text-white text-base group-hover:text-[#1783C1] transition-colors">
                  أرباح الشركة المحققة
                </h3>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-[#1783C1] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>

          <div className="pt-4 space-y-2">
            <span className="text-xs text-slate-400 block">إجمالي أرباح التقسيط + الرسوم الإدارية:</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight">
                <PrivacyMaskedAmount id="dash-hero-company-profits" value={totalCompanyProfits} label="أرباح الشركة المحققة" size="lg" />
              </span>
            </div>
            <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
              <span>أرباح التقسيط: <PrivacyMaskedAmount id="dash-company-repay-profits" value={companyRepaymentProfits} label="أرباح التقسيط للشركة" size="xs" /></span>
              <span>الرسوم: <PrivacyMaskedAmount id="dash-direct-revenues" value={totalDirectRevenues} label="الرسوم الإدارية" size="xs" /></span>
            </div>
          </div>
        </div>

        {/* Hero Card 3: Combined Liquidity Pool */}
        <div
          onClick={() => setActiveTab('funds')}
          className="cursor-pointer bg-slate-900/90 border border-slate-800 hover:border-[#1783C1]/60 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0A3C6E]/20 text-[#1783C1] flex items-center justify-center border border-[#0A3C6E]/40 shadow-sm">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-[#1783C1] font-bold block uppercase tracking-wider">مجموع السيولة المتاحة</span>
                <h3 className="font-extrabold text-white text-base group-hover:text-[#1783C1] transition-colors">
                  إجمالي السيولة الشاملة
                </h3>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-[#1783C1] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>

          <div className="pt-4 space-y-2">
            <span className="text-xs text-slate-400 block">صندوق الشركة + جميع محافظ المستثمرين:</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight">
                <PrivacyMaskedAmount id="dash-hero-combined-liquidity" value={totalCombinedLiquidity} label="إجمالي السيولة الشاملة" size="lg" />
              </span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
              <span>عدد الصناديق والمحافظ: <strong className="text-slate-200">{capitalWallets.length} صناديق</strong></span>
              <span className="text-[#1783C1] font-bold underline text-[11px]">تفاصيل الصناديق ⤹</span>
            </p>
          </div>
        </div>
      </div>



      {/* Centralized Feature Hub Grid (Interactive Cards for Core Modules) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Module 1: Customers Hub */}
        <div
          onClick={() => setActiveTab('borrowers')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-900 p-6 rounded-3xl border border-[#1783C1]/30 shadow-xl transition-all duration-300 hover:border-[#1783C1]/60 hover:-translate-y-1 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#1783C1]/15 text-[#1783C1] flex items-center justify-center border border-[#1783C1]/30">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base group-hover:text-sky-300 transition-colors">
                  جدول العملاء والزبائن
                </h3>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-[#1783C1] transition-colors" />
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400">إجمالي عدد العملاء:</span>
              <span className="text-2xl font-black text-white">{store.borrowers.length} <span className="text-xs font-normal text-slate-400">عميل</span></span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>العملاء النشطون:</span>
                <span className="font-bold text-sky-300">{activeBorrowersCount} عميل</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>إجمالي الديون القائمة:</span>
                <PrivacyMaskedAmount id="dash-total-debts" value={totalDebts} label="إجمالي الديون القائمة" size="xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Module 2: Investors Hub */}
        <div
          onClick={() => setActiveTab('investors')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-900 p-6 rounded-3xl border border-blue-500/30 shadow-xl transition-all duration-300 hover:border-blue-500/60 hover:-translate-y-1 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base group-hover:text-blue-300 transition-colors">
                  المستثمرون والمحافظ
                </h3>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400">عدد المستثمرين:</span>
              <span className="text-2xl font-black text-white">{capitalInvestors.length} <span className="text-xs font-normal text-slate-400">مستثمر</span></span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>رؤوس الأموال:</span>
                <PrivacyMaskedAmount id="dash-investor-capital" value={totalInvestorCapital} label="رؤوس أموال المستثمرين" size="xs" />
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>أرباح المستثمرين:</span>
                <PrivacyMaskedAmount id="dash-investor-profits" value={totalInvestorProfits} label="أرباح المستثمرين" size="xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Module 3: Inventory Stock Hub */}
        <div
          onClick={() => setActiveTab('inventory')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-900 p-6 rounded-3xl border border-amber-500/30 shadow-xl transition-all duration-300 hover:border-amber-500/60 hover:-translate-y-1 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base group-hover:text-amber-300 transition-colors">
                  المخزون والأصول الممولة
                </h3>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400">عدد مواد المخزون:</span>
              <span className="text-2xl font-black text-white">
                {totalInventoryQuantity} <span className="text-xs font-normal text-slate-400">مادة</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>قيمة المخزون بالتكلفة:</span>
                <PrivacyMaskedAmount id="dash-inventory-valuation" value={totalInventoryValuation} label="قيمة المخزون بالتكلفة" size="xs" />
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>المواد المتاحة للشراء:</span>
                <span className="font-bold text-sky-300">
                  {totalInventoryQuantity} مادة{inStockItems.length > 0 ? ` (${inStockItems.length} صنف)` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 4: Overdue Collections Hub (المتأخرين عن السداد) */}
        <div
          onClick={() => setActiveTab('overdue')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-900 p-6 rounded-3xl border border-red-500/40 shadow-xl transition-all duration-300 hover:border-red-500/80 hover:-translate-y-1 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30 group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base group-hover:text-red-300 transition-colors">
                  المتأخرين عن السداد
                </h3>
                <span className="text-[11px] text-red-400/80">كشف المتابعة والتحصيل</span>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-red-400 transition-colors" />
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400">الأقساط المتأخرة:</span>
              <span className="text-2xl font-black text-red-400 font-mono">
                {overdueInfo.overdueCount} <span className="text-xs font-normal text-slate-400">قسط ({overdueInfo.overdueBorrowersCount} زبون)</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>مبلغ المتأخرات الفعلي:</span>
                <PrivacyMaskedAmount id="dash-overdue-total" value={overdueInfo.overdueAmount} label="مبلغ المتأخرات الفعلي" size="xs" />
              </div>
              <div className="flex justify-between text-slate-300">
                <span>تستحق اليوم وقريباً:</span>
                <span className="font-bold text-amber-300 font-mono">{overdueInfo.dueTodayCount + overdueInfo.upcomingCount} قسط للمتابعة</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
