'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  Phone,
  Printer,
  Download,
  Building2,
  DollarSign,
  User,
  CheckCircle2,
  X,
  ArrowUpDown,
  ExternalLink,
  MessageSquare,
  Lock,
  ChevronLeft,
  Sparkles,
  Info,
  Calendar,
  AlertOctagon,
  Percent
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import {
  evaluateBorrowerCredit,
  evaluatePortfolioCredit,
  BorrowerCreditEvaluation,
  CreditTier
} from '@/utils/creditScore';
import { formatIQD, formatNumber, toEnglishDigits } from '@/utils/formatters';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { ActiveTab } from '@/components/layout/Sidebar';
import { CreditReportModal } from '@/components/common/CreditReportModal';

interface CreditScoreViewProps {
  store: SimulationStore;
  setActiveTab?: (tab: ActiveTab) => void;
}

type FilterSelection = 'ALL' | 'AAA' | 'A' | 'B' | 'C' | 'BLACKLIST';
type SortSelection = 'SCORE_DESC' | 'SCORE_ASC' | 'DEBT_DESC' | 'LIMIT_DESC' | 'NAME_ASC';

export const CreditScoreView: React.FC<CreditScoreViewProps> = ({ store, setActiveTab }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSelection, setFilterSelection] = useState<FilterSelection>('ALL');
  const [sortSelection, setSortSelection] = useState<SortSelection>('SCORE_DESC');
  const [selectedEvaluation, setSelectedEvaluation] = useState<BorrowerCreditEvaluation | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Portfolio-wide evaluation
  const portfolio = useMemo(() => {
    return evaluatePortfolioCredit(store.borrowers, store.contracts);
  }, [store.borrowers, store.contracts]);

  // Filtered rows
  const filteredEvaluations = useMemo(() => {
    return portfolio.evaluations.filter((ev) => {
      // 1. Tier / Blacklist Filter
      if (filterSelection === 'BLACKLIST') {
        if (!ev.isBlacklisted) return false;
      } else if (filterSelection !== 'ALL') {
        if (ev.tier !== filterSelection) return false;
      }

      // 2. Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = ev.borrowerName.toLowerCase().includes(q);
      const borrower = store.borrowers.find((b) => b.id === ev.borrowerId);
      const matchPhone = borrower?.phone.includes(q) || false;
      const matchAddress = borrower?.address.toLowerCase().includes(q) || false;
      const matchJob = borrower?.jobTitle?.toLowerCase().includes(q) || false;
      const matchGuarantor = borrower?.guarantors?.some((g) => g.name.toLowerCase().includes(q) || g.phone.includes(q)) || false;

      return matchName || matchPhone || matchAddress || matchJob || matchGuarantor;
    });
  }, [portfolio.evaluations, filterSelection, searchQuery, store.borrowers]);

  // Sorted rows
  const sortedEvaluations = useMemo(() => {
    const list = [...filteredEvaluations];
    list.sort((a, b) => {
      if (sortSelection === 'SCORE_DESC') return b.totalScore - a.totalScore;
      if (sortSelection === 'SCORE_ASC') return a.totalScore - b.totalScore;
      if (sortSelection === 'DEBT_DESC') return b.remainingDebtIQD - a.remainingDebtIQD;
      if (sortSelection === 'LIMIT_DESC') return b.recommendedCreditLimitIQD - a.recommendedCreditLimitIQD;
      if (sortSelection === 'NAME_ASC') return a.borrowerName.localeCompare(b.borrowerName, 'ar');
      return 0;
    });
    return list;
  }, [filteredEvaluations, sortSelection]);

  // Export to CSV Function
  const handleExportCSV = () => {
    const headers = [
      'اسم الزبون',
      'الهاتف',
      'الدرجة الائتمانية',
      'التصنيف',
      'الدخل الشهري د.ع',
      'نسبة عبء الدين DTI',
      'السقف الائتماني الأقصى د.ع',
      'الرصيد الائتماني المتاح د.ع',
      'إجمالي الدين القائم د.ع',
      'حالة القائمة السوداء',
      'سبب الحظر'
    ];

    const rows = sortedEvaluations.map((ev) => {
      const b = store.borrowers.find((item) => item.id === ev.borrowerId);
      return [
        `"${ev.borrowerName}"`,
        `"${b?.phone || ''}"`,
        ev.totalScore,
        `"${ev.tierShortLabel}"`,
        ev.monthlyIncomeIQD,
        `"${(ev.dtiRatio * 100).toFixed(1)}%"`,
        ev.recommendedCreditLimitIQD,
        ev.availableCreditLimitIQD,
        ev.remainingDebtIQD,
        ev.isBlacklisted ? '"نعم"' : '"لا"',
        `"${ev.blacklistReason || 'سليم'}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `كشف_الائتمان_وجودة_الزبائن_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open A4 Print & Report Preview Modal
  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-950 border border-blue-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40 shadow-lg shadow-blue-500/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                      لوحة قياس الائتمان وجودة الزبائن
                    </h1>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      محرك الذكاء الائتماني
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-300 mt-1">
                    تقييم تحليلي استشاري لملاءة الزبائن، كشف القائمة السوداء، واحتساب السقوف الائتمانية دون أي تأثير على العمليات المالية
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <PrivacyToggleButton />
              <button
                onClick={handlePrint}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 shadow-lg transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الكشف (A4)</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-sm font-bold transition-colors"
                title="تصدير إلى جدول Excel"
              >
                <Download className="w-4 h-4" />
                <span>تصدير Excel / CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Portfolio Health Gauge */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-blue-500/30 shadow-lg relative overflow-hidden group hover:border-blue-500/60 transition-all">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-slate-400">مؤشر السلامة الائتمانية للمحفظة</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                %
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-blue-400 font-mono tracking-tight flex items-baseline gap-1">
                <span>{portfolio.portfolioHealthIndex}</span>
                <span className="text-base font-normal text-slate-400">/ 100%</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {portfolio.portfolioHealthIndex >= 80 ? (
                  <span className="text-emerald-400 font-bold">● جودة ائتمانية ممتازة</span>
                ) : portfolio.portfolioHealthIndex >= 60 ? (
                  <span className="text-blue-400 font-bold">● جودة ائتمانية مستقرة</span>
                ) : (
                  <span className="text-amber-400 font-bold">● محفظة تتطلب حذر ومتابعة</span>
                )}
              </p>
            </div>
          </div>

          {/* Card 2: Golden AAA / A VIP Borrowers */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-lg relative overflow-hidden group hover:border-emerald-500/60 transition-all">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-slate-400">الزبائن الممتازون (AAA + A)</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {portfolio.tierCounts.AAA + portfolio.tierCounts.A} <span className="text-xs font-normal text-slate-400">زبون</span>
              </div>
              <p className="text-[11px] text-slate-400">
                مؤهلون لسقوف ائتمانية وتسهيلات تمويلية عليا
              </p>
            </div>
          </div>

          {/* Card 3: Moderate & Constrained (B + C) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-lg relative overflow-hidden group hover:border-amber-500/60 transition-all">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-slate-400">الزبائن المتوسطون والمقيدون</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                {portfolio.tierCounts.B + portfolio.tierCounts.C} <span className="text-xs font-normal text-slate-400">زبون</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {portfolio.tierCounts.B} متوسط (B) و {portfolio.tierCounts.C} مقيد (C)
              </p>
            </div>
          </div>

          {/* Card 4: Smart Auto-Blacklist */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-red-500/30 shadow-lg relative overflow-hidden group hover:border-red-500/60 transition-all">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-slate-400">القائمة السوداء (محظورون)</span>
              <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center animate-pulse">
                <AlertOctagon className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-red-400 font-mono tracking-tight">
                {portfolio.blacklistedCount} <span className="text-xs font-normal text-slate-400">زبون</span>
              </div>
              <p className="text-[11px] text-red-400/90 font-medium">
                تأخير حرج &gt; 60 يوماً أو تعثر سابق
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الزبون، رقم الهاتف، المهنة، أو الكفيل..."
                className="w-full pl-4 pr-11 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
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
                value={sortSelection}
                onChange={(e) => setSortSelection(e.target.value as SortSelection)}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="SCORE_DESC">الأعلى درجة ائتمانية أولاً</option>
                <option value="SCORE_ASC">الأقل درجة ائتمانية (الأكثر خطورة)</option>
                <option value="DEBT_DESC">الأعلى ديناً قائماً</option>
                <option value="LIMIT_DESC">الأعلى سقفاً ائتمانياً</option>
                <option value="NAME_ASC">اسم الزبون أبجدياً</option>
              </select>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <button
              onClick={() => setFilterSelection('ALL')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                filterSelection === 'ALL'
                  ? 'bg-slate-700 text-white shadow-md'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              جميع الزبائن ({portfolio.evaluations.length})
            </button>

            <button
              onClick={() => setFilterSelection('AAA')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                filterSelection === 'AAA'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-950/60 text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20'
              }`}
            >
              <span>ذهبي AAA</span>
              <span className="font-mono">({portfolio.tierCounts.AAA})</span>
            </button>

            <button
              onClick={() => setFilterSelection('A')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                filterSelection === 'A'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'bg-slate-950/60 text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/20'
              }`}
            >
              <span>فضي A</span>
              <span className="font-mono">({portfolio.tierCounts.A})</span>
            </button>

            <button
              onClick={() => setFilterSelection('B')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                filterSelection === 'B'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-slate-950/60 text-amber-300 hover:bg-amber-500/10 border border-amber-500/20'
              }`}
            >
              <span>برونزي B</span>
              <span className="font-mono">({portfolio.tierCounts.B})</span>
            </button>

            <button
              onClick={() => setFilterSelection('C')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                filterSelection === 'C'
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                  : 'bg-slate-950/60 text-orange-300 hover:bg-orange-500/10 border border-orange-500/20'
              }`}
            >
              <span>مقيد C</span>
              <span className="font-mono">({portfolio.tierCounts.C})</span>
            </button>

            <button
              onClick={() => setFilterSelection('BLACKLIST')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                filterSelection === 'BLACKLIST'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'bg-slate-950/60 text-red-400 hover:bg-red-500/10 border border-red-500/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              <span>القائمة السوداء المحظورة 🚫</span>
              <span className="font-mono">({portfolio.blacklistedCount})</span>
            </button>
          </div>
        </div>

        {/* Credit Quality Data Table */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-950/80 text-slate-400 text-xs border-b border-slate-800 font-semibold select-none">
                <tr>
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4">الزبون وتفاصيل الاتصال</th>
                  <th className="py-3.5 px-4">درجة الائتمان</th>
                  <th className="py-3.5 px-4">تصنيف الجودة</th>
                  <th className="py-3.5 px-4">الدخل وعبء الدين DTI</th>
                  <th className="py-3.5 px-4">السقف الائتماني المقترح</th>
                  <th className="py-3.5 px-4">الرصيد المتاح</th>
                  <th className="py-3.5 px-4">إجمالي الدين</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedEvaluations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-base font-bold text-white">لا توجد سجلات مطابقة للفلتر</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {searchQuery
                            ? 'لم نجد أي زبون يطابق نص البحث الحالي.'
                            : 'لا يوجد زبائن في هذا التصنيف حالياً.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedEvaluations.map((ev, index) => {
                    const b = store.borrowers.find((item) => item.id === ev.borrowerId);

                    return (
                      <tr
                        key={ev.borrowerId}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          ev.isBlacklisted ? 'bg-red-500/5' : ''
                        }`}
                      >
                        {/* 1. Index */}
                        <td className="py-4 px-4 text-center font-mono text-xs text-slate-400">
                          {index + 1}
                        </td>

                        {/* 2. Borrower Details */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <PrivacyMaskedText id={`credit-borrower-${ev.borrowerId}`} text={ev.borrowerName} as="span" className="font-bold text-white text-sm" />
                              {ev.isBlacklisted && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                  قائمة سوداء
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <a
                                href={`tel:${b?.phone}`}
                                className="font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                                dir="ltr"
                              >
                                <Phone className="w-3 h-3 shrink-0" />
                                <PrivacyMaskedText id={`credit-phone-${ev.borrowerId}`} text={b?.phone || 'غير مسجل'} label={`هاتف: ${ev.borrowerName}`} size="xs" className="font-mono text-emerald-400 font-semibold" />
                              </a>
                              {b?.jobTitle && (
                                <span className="text-[11px] text-slate-400">
                                  • {b.jobTitle}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {b?.address || 'سامراء'}
                            </p>
                          </div>
                        </td>

                        {/* 3. Score Progress Bar */}
                        <td className="py-4 px-4">
                          <div className="space-y-1.5 w-32">
                            <div className="flex justify-between items-baseline text-xs font-mono">
                              <span className="font-extrabold text-white text-sm">{ev.totalScore}</span>
                              <span className="text-[10px] text-slate-400">/ 100</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  ev.totalScore >= 90
                                    ? 'bg-emerald-500'
                                    : ev.totalScore >= 75
                                    ? 'bg-cyan-500'
                                    : ev.totalScore >= 60
                                    ? 'bg-amber-500'
                                    : ev.totalScore >= 40
                                    ? 'bg-orange-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${ev.totalScore}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 4. Tier Badge */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${ev.tierBadgeClass}`}>
                            {ev.tierShortLabel}
                          </span>
                        </td>

                        {/* 5. Income & DTI */}
                        <td className="py-4 px-4 font-mono text-xs">
                          <div className="space-y-0.5">
                            <span className="text-white block font-semibold">
                              {ev.monthlyIncomeIQD > 0 ? (
                                <PrivacyMaskedAmount id={`credit-income-${ev.borrowerId}`} value={ev.monthlyIncomeIQD} label={`دخل: ${ev.borrowerName}`} size="xs" className="text-white" />
                              ) : (
                                'غير محدد'
                              )}
                            </span>
                            <span className={`text-[11px] block font-bold ${
                              ev.dtiRatio <= 0.30
                                ? 'text-emerald-400'
                                : ev.dtiRatio <= 0.45
                                ? 'text-blue-400'
                                : ev.dtiRatio <= 0.60
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}>
                              DTI: {(ev.dtiRatio * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>

                        {/* 6. Recommended Limit */}
                        <td className="py-4 px-4 font-mono">
                          <PrivacyMaskedAmount
                            id={`credit-rec-limit-${ev.borrowerId}`}
                            value={ev.recommendedCreditLimitIQD}
                            label={`سقف موصى: ${ev.borrowerName}`}
                            size="xs"
                            className="text-xs font-bold text-blue-300 block"
                          />
                        </td>

                        {/* 7. Available Credit Limit */}
                        <td className="py-4 px-4 font-mono">
                          <PrivacyMaskedAmount
                            id={`credit-avail-limit-${ev.borrowerId}`}
                            value={ev.availableCreditLimitIQD}
                            label={`سقف متاح: ${ev.borrowerName}`}
                            size="xs"
                            className={`text-xs font-extrabold block ${
                              ev.availableCreditLimitIQD > 0
                                ? 'text-emerald-400'
                                : 'text-slate-500'
                            }`}
                          />
                        </td>

                        {/* 8. Remaining Debt */}
                        <td className="py-4 px-4 font-mono">
                          <PrivacyMaskedAmount
                            id={`credit-rem-debt-${ev.borrowerId}`}
                            value={ev.remainingDebtIQD}
                            label={`دين قائم: ${ev.borrowerName}`}
                            size="xs"
                            className="text-xs font-semibold text-slate-300 block"
                          />
                        </td>

                        {/* 9. Actions */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedEvaluation(ev)}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-colors flex items-center gap-1"
                              title="عرض تفاصيل نقاط الائتمان"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span>التفاصيل</span>
                            </button>

                            {b?.phone && (
                              <a
                                href={`tel:${b.phone}`}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                                title="اتصال هاتفي"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
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

        {/* Evaluation Breakdown Modal */}
        {selectedEvaluation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">تقرير الجودة الائتمانية للزبون</h3>
                    <p className="text-xs text-slate-400">{selectedEvaluation.borrowerName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvaluation(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Blacklist Alert Banner */}
              {selectedEvaluation.isBlacklisted && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs">
                  <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <p className="font-bold text-red-300 text-sm">الزبون مدرج في القائمة السوداء (محظور)</p>
                    <p className="text-red-400 leading-relaxed">{selectedEvaluation.blacklistReason}</p>
                  </div>
                </div>
              )}

              {/* Total Score Header */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">الدرجة الائتمانية الإجمالية:</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl font-black text-white font-mono">{selectedEvaluation.totalScore}</span>
                    <span className="text-xs text-slate-400 font-mono">/ 100 نقطة</span>
                  </div>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-xs font-black border ${selectedEvaluation.tierBadgeClass}`}>
                  {selectedEvaluation.tierLabel}
                </span>
              </div>

              {/* 4 Pillars Breakdown */}
              <div className="space-y-3 text-xs">
                <p className="font-bold text-slate-300">تفاصيل معايير التقييم الأربعة:</p>

                {/* Pillar 1 */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">1. الالتزام وتاريخ السداد</span>
                    <span className="text-[11px] text-slate-400">
                      {selectedEvaluation.overdueInstallmentsCount === 0
                        ? 'سداد منتظم وبدون أي تأخيرات حالية'
                        : `يوجد ${selectedEvaluation.overdueInstallmentsCount} قسط متأخر (أقصى تأخير: ${selectedEvaluation.maxDaysOverdue} يوم)`}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {selectedEvaluation.breakdown.punctualityScore} / 40
                  </span>
                </div>

                {/* Pillar 2 */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">2. الملاءة وعبء الدين للراتب (DTI)</span>
                    <span className="text-[11px] text-slate-400">
                      القسط الشهري يشكل {(selectedEvaluation.dtiRatio * 100).toFixed(0)}% من الدخل المسجل
                    </span>
                  </div>
                  <span className="font-mono font-bold text-blue-400 text-sm">
                    {selectedEvaluation.breakdown.dtiScore} / 25
                  </span>
                </div>

                {/* Pillar 3 */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">3. متانة الكفيل والضمانات</span>
                    <span className="text-[11px] text-slate-400">
                      توفر كفيل موظف حكومي ومستندات تأييد رسمية
                    </span>
                  </div>
                  <span className="font-mono font-bold text-cyan-400 text-sm">
                    {selectedEvaluation.breakdown.guarantorScore} / 20
                  </span>
                </div>

                {/* Pillar 4 */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">4. سابقة التعامل وتاريخ العقود</span>
                    <span className="text-[11px] text-slate-400">
                      سجل العقود المكتملة وحسن الالتزام التراكمي
                    </span>
                  </div>
                  <span className="font-mono font-bold text-purple-400 text-sm">
                    {selectedEvaluation.breakdown.historyScore} / 15
                  </span>
                </div>
              </div>

              {/* Credit Limit Summary Box */}
              <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>السقف الائتماني المقترح:</span>
                  <span className="font-bold text-blue-400">{formatIQD(selectedEvaluation.recommendedCreditLimitIQD)} د.ع</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>إجمالي الدين القائم حالياً:</span>
                  <span className="font-bold text-slate-200">{formatIQD(selectedEvaluation.remainingDebtIQD)} د.ع</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-blue-500/20 pt-2 font-bold">
                  <span>الرصيد الائتماني المتاح للشراء:</span>
                  <span className="text-emerald-400 text-sm">{formatIQD(selectedEvaluation.availableCreditLimitIQD)} د.ع</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvaluation(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        )}

      {/* Credit Report Modal for Live A4 Preview & Isolated Vector Printing */}
      <CreditReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        store={store}
        initialFilter={filterSelection === 'BLACKLIST' ? 'D' : filterSelection === 'ALL' ? 'ALL' : filterSelection}
      />
    </div>
  );
};
