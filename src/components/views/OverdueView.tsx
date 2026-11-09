'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Search,
  Filter,
  Phone,
  MessageSquare,
  Printer,
  DollarSign,
  User,
  ShieldCheck,
  Building2,
  MapPin,
  ArrowUpDown,
  RefreshCw,
  X,
  Check,
  FileText,
  BadgeAlert,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { calculateInstallmentDueStatus, InstallmentDueInfo } from '@/utils/installmentDates';
import { formatIQD, formatNumber, toEnglishDigits } from '@/utils/formatters';
import { CollectorReportModal } from '@/components/common/CollectorReportModal';
import { ContractDocumentHubModal, getInvoiceNumber } from '@/components/common/ContractDocumentHubModal';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { ActiveTab } from '@/components/layout/Sidebar';

interface OverdueViewProps {
  store: SimulationStore;
  onPaySchedule?: (contractId: string, scheduleId: string, customPaidAmountIQD?: number, paidDate?: string) => Promise<any> | void;
  setActiveTab?: (tab: ActiveTab) => void;
}

type FilterCategory = 'ALL' | 'CRITICAL' | 'MODERATE' | 'RECENT' | 'DUE_TODAY' | 'UPCOMING';
type SortField = 'DAYS_DESC' | 'DAYS_ASC' | 'AMOUNT_DESC' | 'NAME_ASC';

interface OverdueScheduleRow {
  scheduleId: string;
  contractId: string;
  contractNumber: string;
  invoiceNumber: string;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amountIQD: number;
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  borrowerAddress: string;
  borrowerRemainingDebt: number;
  guarantors: {
    name: string;
    phone: string;
    department?: string;
    address?: string;
  }[];
  inventoryItemName: string;
  investorName: string;
  dueInfo: InstallmentDueInfo;
}

export const OverdueView: React.FC<OverdueViewProps> = ({
  store,
  onPaySchedule,
  setActiveTab
}) => {
  // Modal states
  const [isCollectorModalOpen, setIsCollectorModalOpen] = useState<boolean>(false);
  const [collectorInitialFilter, setCollectorInitialFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING'>('OVERDUE');
  const [documentModalContractId, setDocumentModalContractId] = useState<string | null>(null);

  // Pay Modal state
  const [payTarget, setPayTarget] = useState<OverdueScheduleRow | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isPaying, setIsPaying] = useState<boolean>(false);

  // Search, filter & sort
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [sortField, setSortField] = useState<SortField>('DAYS_DESC');

  // Build the complete dataset of pending / overdue / upcoming installments
  const allRows: OverdueScheduleRow[] = useMemo(() => {
    const rows: OverdueScheduleRow[] = [];

    store.contracts.forEach((contract) => {
      const borrower = store.borrowers.find((b) => b.id === contract.borrowerId);
      const inventoryItem = store.inventory.find((i) => i.id === contract.inventoryItemId);
      const investor = store.investors.find((i) => i.id === contract.investorId);
      const totalInstallments = contract.schedules.length;

      contract.schedules.forEach((schedule) => {
        // Exclude paid schedules from the overdue action table
        if (schedule.status === 'PAID') return;

        const dueInfo = calculateInstallmentDueStatus(schedule.dueDate, false);

        rows.push({
          scheduleId: schedule.id,
          contractId: contract.id,
          contractNumber: contract.contractNumber || contract.id.slice(0, 8),
          invoiceNumber: getInvoiceNumber(contract),
          installmentNumber: schedule.installmentNumber,
          totalInstallments,
          dueDate: schedule.dueDate,
          amountIQD: schedule.amountIQD,
          borrowerId: contract.borrowerId,
          borrowerName: borrower?.name || contract.borrowerName || 'زبون غير محدد',
          borrowerPhone: borrower?.phone || 'غير متوفر',
          borrowerAddress: borrower?.address || 'سامراء',
          borrowerRemainingDebt: borrower?.remainingDebtIQD || 0,
          guarantors: borrower?.guarantors?.map((g) => ({
            name: g.name,
            phone: g.phone,
            department: g.department,
            address: g.address
          })) || [],
          inventoryItemName: inventoryItem?.name || contract.inventoryItemName || 'بضاعة بالتقسيط',
          investorName: investor?.name || 'محفظة الشركة',
          dueInfo
        });
      });
    });

    return rows;
  }, [store.contracts, store.borrowers, store.inventory, store.investors]);

  // Aggregate KPI metrics
  const stats = useMemo(() => {
    let overdueCount = 0;
    let overdueAmount = 0;
    let criticalOverdueCount = 0;
    let moderateOverdueCount = 0;
    let recentOverdueCount = 0;
    let dueTodayCount = 0;
    let dueTodayAmount = 0;
    let upcomingCount = 0;
    let upcomingAmount = 0;

    const overdueBorrowerIds = new Set<string>();

    allRows.forEach((row) => {
      const { status, daysOverdue } = row.dueInfo;

      if (status === 'OVERDUE') {
        overdueCount++;
        overdueAmount += row.amountIQD;
        overdueBorrowerIds.add(row.borrowerId);

        if (daysOverdue > 30) {
          criticalOverdueCount++;
        } else if (daysOverdue >= 8) {
          moderateOverdueCount++;
        } else {
          recentOverdueCount++;
        }
      } else if (status === 'DUE_TODAY') {
        dueTodayCount++;
        dueTodayAmount += row.amountIQD;
      } else if (status === 'UPCOMING') {
        upcomingCount++;
        upcomingAmount += row.amountIQD;
      }
    });

    return {
      overdueCount,
      overdueAmount,
      criticalOverdueCount,
      moderateOverdueCount,
      recentOverdueCount,
      overdueBorrowersCount: overdueBorrowerIds.size,
      dueTodayCount,
      dueTodayAmount,
      upcomingCount,
      upcomingAmount
    };
  }, [allRows]);

  // Filter and search
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      // 1. Category Filter
      if (filterCategory === 'CRITICAL') {
        if (row.dueInfo.status !== 'OVERDUE' || row.dueInfo.daysOverdue <= 30) return false;
      } else if (filterCategory === 'MODERATE') {
        if (row.dueInfo.status !== 'OVERDUE' || row.dueInfo.daysOverdue < 8 || row.dueInfo.daysOverdue > 30) return false;
      } else if (filterCategory === 'RECENT') {
        if (row.dueInfo.status !== 'OVERDUE' || row.dueInfo.daysOverdue < 1 || row.dueInfo.daysOverdue > 7) return false;
      } else if (filterCategory === 'DUE_TODAY') {
        if (row.dueInfo.status !== 'DUE_TODAY') return false;
      } else if (filterCategory === 'UPCOMING') {
        if (row.dueInfo.status !== 'UPCOMING') return false;
      }

      // 2. Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchBorrower = row.borrowerName.toLowerCase().includes(q);
      const matchPhone = row.borrowerPhone.includes(q);
      const matchContract = row.contractNumber.toLowerCase().includes(q) || row.invoiceNumber.toLowerCase().includes(q);
      const matchItem = row.inventoryItemName.toLowerCase().includes(q);
      const matchAddress = row.borrowerAddress.toLowerCase().includes(q);
      const matchGuarantor = row.guarantors.some(
        (g) => g.name.toLowerCase().includes(q) || g.phone.includes(q) || (g.department && g.department.toLowerCase().includes(q))
      );

      return matchBorrower || matchPhone || matchContract || matchItem || matchAddress || matchGuarantor;
    });
  }, [allRows, filterCategory, searchQuery]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];

    list.sort((a, b) => {
      if (sortField === 'DAYS_DESC') {
        // Overdue with highest days first, then due today, then upcoming
        const getWeight = (row: OverdueScheduleRow) => {
          if (row.dueInfo.status === 'OVERDUE') return 100000 + row.dueInfo.daysOverdue;
          if (row.dueInfo.status === 'DUE_TODAY') return 50000;
          if (row.dueInfo.status === 'UPCOMING') return 10000 - (row.dueInfo.daysRemaining || 0);
          return 0;
        };
        return getWeight(b) - getWeight(a);
      }

      if (sortField === 'DAYS_ASC') {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      if (sortField === 'AMOUNT_DESC') {
        return b.amountIQD - a.amountIQD;
      }

      if (sortField === 'NAME_ASC') {
        return a.borrowerName.localeCompare(b.borrowerName, 'ar');
      }

      return 0;
    });

    return list;
  }, [filteredRows, sortField]);

  // Helper for WhatsApp link
  const createWhatsAppLink = (phone: string, borrowerName: string, instNum: number, amount: number, item: string) => {
    const digits = toEnglishDigits(phone).replace(/\D/g, '');
    let cleanPhone = digits;
    if (digits.startsWith('07')) {
      cleanPhone = '964' + digits.slice(1);
    } else if (digits.startsWith('7') && digits.length === 10) {
      cleanPhone = '964' + digits;
    }

    const message = `السلام عليكم ورحمة الله، أخي الكريم ${borrowerName}، نود تذكيركم بحلول موعد قسطكم الشهري رقم (${instNum}) بمبلغ (${formatNumber(amount)} د.ع) لعقد (${item}). نرجو التفضل بالتسديد شاكرين حسن تعاونكم - شركة أمان للتقسيط سامراء`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  // Open pay modal
  const handleOpenPay = (row: OverdueScheduleRow) => {
    setPayTarget(row);
    setPayAmount(row.amountIQD);
    setPayDate(new Date().toISOString().split('T')[0]);
  };

  // Confirm pay
  const handleConfirmPay = async () => {
    if (!payTarget || !onPaySchedule) return;
    setIsPaying(true);
    try {
      await onPaySchedule(payTarget.contractId, payTarget.scheduleId, payAmount, payDate);
      setPayTarget(null);
    } catch (err) {
      console.error('Payment error in OverdueView:', err);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-950 border border-red-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/40 shadow-lg shadow-red-500/20">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    المتأخرين عن السداد والتحصيل
                  </h1>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 font-mono">
                    {stats.overdueCount} قسط متأخر
                  </span>
                </div>
                <p className="text-xs md:text-sm text-slate-300 mt-1">
                  نظام سامراء لمتابعة الأقساط المستحقة، كشف هواتف الزبائن والكفلاء، والاتصال بالمحصلين
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <PrivacyToggleButton />
            <button
              onClick={() => {
                setCollectorInitialFilter('OVERDUE');
                setIsCollectorModalOpen(true);
              }}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-600/30 transition-all duration-200 hover:scale-[1.02]"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة كشف المحصل (A4)</span>
            </button>

            <button
              onClick={() => {
                setCollectorInitialFilter('ALL');
                setIsCollectorModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-sm font-semibold transition-colors"
              title="طباعة شاملة للمتأخرات والمستحقات القادمة"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>كشف شامل للمستحقات</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Overdue Amount */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-red-500/30 shadow-lg relative overflow-hidden group hover:border-red-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-400">إجمالي المبالغ المتأخرة</span>
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-red-400 tracking-tight">
              <PrivacyMaskedAmount id="overdue-total-amount" value={stats.overdueAmount} label="المبالغ المتأخرة" size="lg" />
            </div>
            <p className="text-[11px] text-slate-400">
              من أصل <span className="font-bold text-white font-mono">{stats.overdueCount}</span> قسط متأخر
            </p>
          </div>
        </div>

        {/* Card 2: Overdue Installments Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-lg relative overflow-hidden group hover:border-amber-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-400">الأقساط المتأخرة وتوزيعها</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              {stats.overdueCount} <span className="text-xs font-normal text-slate-400">قسط</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-mono">
              <span className="text-red-400 font-bold">{stats.criticalOverdueCount} حرج (&gt;30ي)</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">{stats.moderateOverdueCount} متوسط</span>
              <span>•</span>
              <span className="text-yellow-300 font-bold">{stats.recentOverdueCount} حديث</span>
            </div>
          </div>
        </div>

        {/* Card 3: Overdue Borrowers */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-400">الزبائن المتأخرين</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {stats.overdueBorrowersCount} <span className="text-xs font-normal text-slate-400">زبون</span>
            </div>
            <p className="text-[11px] text-slate-400">
              يحتاجون إلى تواصل هاتفي ومتابعة ميدانية
            </p>
          </div>
        </div>

        {/* Card 4: Due Today & Upcoming (Early Warning) */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-blue-500/30 shadow-lg relative overflow-hidden group hover:border-blue-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-400">اليوم وقريباً (إنذار مبكر)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-blue-400 font-mono tracking-tight">
              {stats.dueTodayCount + stats.upcomingCount} <span className="text-xs font-normal text-slate-400">قسط</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {stats.dueTodayCount > 0 ? (
                <span className="text-emerald-400 font-bold">{stats.dueTodayCount} اليوم</span>
              ) : (
                'لا مستحق اليوم'
              )}
              {' '}و {stats.upcomingCount} خلال 7 أيام
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم الزبون، رقم الهاتف، اسم الكفيل، أو رقم العقد..."
              className="w-full pl-4 pr-11 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Selector & Privacy Button */}
          <div className="flex items-center gap-2 shrink-0">
            <PrivacyToggleButton variant="compact" />
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-red-500"
            >
              <option value="DAYS_DESC">الأكثر تأخيراً (بالأيام تنازلياً)</option>
              <option value="DAYS_ASC">الأقرب موعداً (تاريخ الاستحقاق)</option>
              <option value="AMOUNT_DESC">الأعلى مبلغاً</option>
              <option value="NAME_ASC">اسم الزبون أبجدياً</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filterCategory === 'ALL'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            جميع المستحقات ({allRows.length})
          </button>

          <button
            onClick={() => setFilterCategory('CRITICAL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
              filterCategory === 'CRITICAL'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-slate-950/60 text-red-400 hover:bg-red-500/10 border border-red-500/20'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            متأخر حرج (&gt; 30 يوم) ({stats.criticalOverdueCount})
          </button>

          <button
            onClick={() => setFilterCategory('MODERATE')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filterCategory === 'MODERATE'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-slate-950/60 text-amber-300 hover:bg-amber-500/10 border border-amber-500/20'
            }`}
          >
            متأخر (8 - 30 يوم) ({stats.moderateOverdueCount})
          </button>

          <button
            onClick={() => setFilterCategory('RECENT')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filterCategory === 'RECENT'
                ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/30'
                : 'bg-slate-950/60 text-yellow-300 hover:bg-yellow-500/10 border border-yellow-500/20'
            }`}
          >
            متأخر حديث (1 - 7 أيام) ({stats.recentOverdueCount})
          </button>

          <button
            onClick={() => setFilterCategory('DUE_TODAY')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filterCategory === 'DUE_TODAY'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-950/60 text-blue-300 hover:bg-blue-500/10 border border-blue-500/20'
            }`}
          >
            يستحق اليوم ({stats.dueTodayCount})
          </button>

          <button
            onClick={() => setFilterCategory('UPCOMING')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filterCategory === 'UPCOMING'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-950/60 text-purple-300 hover:bg-purple-500/10 border border-purple-500/20'
            }`}
          >
            قادم خلال 7 أيام ({stats.upcomingCount})
          </button>
        </div>
      </div>

      {/* Overdue Data Table */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-950/80 text-slate-400 text-xs border-b border-slate-800 font-semibold select-none">
              <tr>
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4">الزبون وتفاصيل الاتصال</th>
                <th className="py-3.5 px-4">الكفيل الضامن</th>
                <th className="py-3.5 px-4">العقد والسلعة</th>
                <th className="py-3.5 px-4">القسط والاستحقاق</th>
                <th className="py-3.5 px-4">حالة التأخير والأيام</th>
                <th className="py-3.5 px-4">مبلغ القسط</th>
                <th className="py-3.5 px-4 text-center">إجراءات المحصل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-base font-bold text-white">لا توجد أقساط مطابقة للفلتر</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {searchQuery
                          ? 'لم نجد أي نتائج تطابق عملية البحث الحالية، جرّب مسح نص البحث.'
                          : 'ممتاز! لا يوجد أي أقساط متأخرة حالياً في هذا التصنيف.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, index) => {
                  const isCritical = row.dueInfo.status === 'OVERDUE' && row.dueInfo.daysOverdue > 30;

                  return (
                    <tr
                      key={row.scheduleId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isCritical ? 'bg-red-500/5' : ''
                      }`}
                    >
                      {/* 1. Index */}
                      <td className="py-4 px-4 text-center font-mono text-xs text-slate-400">
                        {index + 1}
                      </td>

                      {/* 2. Borrower Details */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <PrivacyMaskedText id={`overdue-borrower-${row.scheduleId}`} text={row.borrowerName} as="span" className="font-bold text-white text-sm block" />
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <a
                              href={`tel:${row.borrowerPhone}`}
                              className="font-mono text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-semibold"
                              dir="ltr"
                            >
                              <Phone className="w-3 h-3 shrink-0" />
                              <PrivacyMaskedText id={`overdue-bor-phone-${row.scheduleId}`} text={row.borrowerPhone} label={`هاتف: ${row.borrowerName}`} size="xs" className="font-mono text-emerald-400 font-semibold" />
                            </a>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{row.borrowerAddress}</span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Guarantor */}
                      <td className="py-4 px-4">
                        {row.guarantors.length > 0 ? (
                          <div className="space-y-1">
                            <PrivacyMaskedText id={`overdue-guarantor-${row.scheduleId}`} text={row.guarantors[0].name} as="span" className="font-semibold text-slate-200 text-xs block" />
                            <a
                              href={`tel:${row.guarantors[0].phone}`}
                              className="font-mono text-cyan-400 hover:underline text-xs flex items-center gap-1"
                              dir="ltr"
                            >
                              <Phone className="w-3 h-3 shrink-0" />
                              <PrivacyMaskedText id={`overdue-g-phone-${row.scheduleId}`} text={row.guarantors[0].phone} label={`هاتف كفيل: ${row.guarantors[0].name}`} size="xs" className="font-mono text-cyan-400" />
                            </a>
                            {row.guarantors[0].department && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[140px]">{row.guarantors[0].department}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">بدون كفيل مسجل</span>
                        )}
                      </td>

                      {/* 4. Contract & Item */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span className="font-bold text-white text-xs block">
                            {row.inventoryItemName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 block">
                            {row.invoiceNumber}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <span>المتبقي:</span>
                            <PrivacyMaskedAmount id={`overdue-bor-rem-${row.scheduleId}`} value={row.borrowerRemainingDebt} label={`متبقي: ${row.borrowerName}`} size="xs" className="text-slate-300 font-semibold" />
                          </span>
                        </div>
                      </td>

                      {/* 5. Installment & Due Date */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-200 block">
                            القسط {row.installmentNumber} من {row.totalInstallments}
                          </span>
                          <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{row.dueDate}</span>
                          </div>
                        </div>
                      </td>

                      {/* 6. Overdue Status & Exact Days */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${row.dueInfo.badgeClassName}`}
                          >
                            {row.dueInfo.status === 'OVERDUE' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            )}
                            {row.dueInfo.label}
                          </span>
                          {row.dueInfo.status === 'OVERDUE' && (
                            <span className="block text-[11px] font-mono text-red-400 font-semibold">
                              تأخير: {row.dueInfo.daysOverdue} يوم
                            </span>
                          )}
                          {row.dueInfo.status === 'UPCOMING' && (
                            <span className="block text-[11px] font-mono text-purple-400">
                              متبقي: {row.dueInfo.daysRemaining} يوم
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Installment Amount */}
                      <td className="py-4 px-4 font-mono">
                        <PrivacyMaskedAmount
                          id={`overdue-row-amt-${row.scheduleId}`}
                          value={row.amountIQD}
                          label={`قسط #${row.installmentNumber}: ${row.borrowerName}`}
                          size="sm"
                          className="font-extrabold text-amber-300 text-sm block"
                        />
                      </td>

                      {/* 8. Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Direct Phone Call */}
                          <a
                            href={`tel:${row.borrowerPhone}`}
                            className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                            title="اتصال هاتفي بالزبون"
                          >
                            <Phone className="w-4 h-4" />
                          </a>

                          {/* WhatsApp Reminder */}
                          <a
                            href={createWhatsAppLink(
                              row.borrowerPhone,
                              row.borrowerName,
                              row.installmentNumber,
                              row.amountIQD,
                              row.inventoryItemName
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 transition-colors"
                            title="إرسال رسالة تذكير واتساب"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>

                          {/* Quick Pay */}
                          {onPaySchedule && (
                            <button
                              onClick={() => handleOpenPay(row)}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-colors flex items-center gap-1"
                              title="تسديد القسط واستلام المبلغ"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>تسديد</span>
                            </button>
                          )}

                          {/* Documents Hub */}
                          <button
                            onClick={() => setDocumentModalContractId(row.contractId)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="عرض سندات العقد"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Installment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">تسديد قسط متأخر</h3>
                  <p className="text-xs text-slate-400">تسجيل استلام المبلغ نقداً من الزبون</p>
                </div>
              </div>
              <button
                onClick={() => setPayTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">اسم الزبون:</span>
                <span className="font-bold text-white">{payTarget.borrowerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">السلعة والعقد:</span>
                <span className="font-semibold text-slate-200">{payTarget.inventoryItemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">رقم القسط:</span>
                <span className="font-mono text-slate-200">
                  قسط {payTarget.installmentNumber} من {payTarget.totalInstallments}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">تاريخ الاستحقاق:</span>
                <span className="font-mono text-red-400">{payTarget.dueDate} ({payTarget.dueInfo.label})</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  المبلغ المستلم (د.ع)
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  تاريخ التسديد الفعلي
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isPaying || payAmount <= 0}
                onClick={handleConfirmPay}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPaying ? (
                  <span>جاري التسجيل...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تأكيد التسديد</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collector Report Modal */}
      <CollectorReportModal
        isOpen={isCollectorModalOpen}
        onClose={() => setIsCollectorModalOpen(false)}
        store={store}
        initialFilter={collectorInitialFilter}
      />

      {/* Contract Documents Modal */}
      {documentModalContractId && store.contracts.find((c) => c.id === documentModalContractId) && (
        <ContractDocumentHubModal
          contract={store.contracts.find((c) => c.id === documentModalContractId)!}
          store={store}
          onClose={() => setDocumentModalContractId(null)}
          onPaySchedule={onPaySchedule}
        />
      )}
    </div>
  );
};
