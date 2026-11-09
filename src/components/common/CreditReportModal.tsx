'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  X,
  Search,
  Filter,
  ShieldCheck,
  AlertCircle,
  Building2,
  CheckCircle2,
  Download,
  Calendar,
  User,
  SlidersHorizontal,
  FileText
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';
import {
  evaluatePortfolioCredit,
  BorrowerCreditEvaluation,
  CreditTier
} from '@/utils/creditScore';
import { formatNumber, formatIQD, formatDate } from '@/utils/formatters';

interface CreditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: SimulationStore;
  currentEmployeeName?: string;
  initialFilter?: 'ALL' | CreditTier | 'VIP';
}

type FilterTier = 'ALL' | 'VIP' | CreditTier;
type PageOrientation = 'landscape' | 'portrait';

export const CreditReportModal: React.FC<CreditReportModalProps> = ({
  isOpen,
  onClose,
  store,
  currentEmployeeName = 'أحمد إياد',
  initialFilter = 'ALL'
}) => {
  const profile = store.companyProfile || DEFAULT_COMPANY_REPORT_PROFILE;
  const [filterTier, setFilterTier] = useState<FilterTier>(initialFilter);
  const [orientation, setOrientation] = useState<PageOrientation>('landscape');
  const [searchQuery, setSearchQuery] = useState('');
  const [auditorName, setAuditorName] = useState(currentEmployeeName || profile.managerName || 'أحمد إياد');
  const [customNotes, setCustomNotes] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setFilterTier(initialFilter);
  }, [initialFilter]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Portfolio Credit Evaluations
  const portfolio = useMemo(() => {
    return evaluatePortfolioCredit(store.borrowers, store.contracts);
  }, [store.borrowers, store.contracts]);

  // Filtered rows
  const filteredEvaluations = useMemo(() => {
    return portfolio.evaluations.filter((ev) => {
      // Tier filter
      if (filterTier === 'VIP') {
        if (ev.tier !== 'AAA' && ev.tier !== 'A') return false;
      } else if (filterTier !== 'ALL') {
        if (ev.tier !== filterTier) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const borrower = store.borrowers.find((b) => b.id === ev.borrowerId);
        const nameMatch = ev.borrowerName.toLowerCase().includes(q);
        const jobMatch = borrower?.jobTitle?.toLowerCase().includes(q) || false;
        const cityMatch = borrower?.city?.toLowerCase().includes(q) || false;
        const reasonMatch = ev.blacklistReason?.toLowerCase().includes(q) || false;
        return nameMatch || jobMatch || cityMatch || reasonMatch;
      }

      return true;
    });
  }, [portfolio.evaluations, filterTier, searchQuery, store.borrowers]);

  // Aggregates for the filtered list
  const filteredMetrics = useMemo(() => {
    let totalRecommendedLimit = 0;
    let totalAvailableLimit = 0;
    let totalActiveDebt = 0;
    let totalMonthlyIncome = 0;
    let blacklistedCount = 0;
    let vipCount = 0;
    let moderateCount = 0;

    filteredEvaluations.forEach((ev) => {
      totalRecommendedLimit += ev.recommendedCreditLimitIQD;
      totalAvailableLimit += ev.availableCreditLimitIQD;
      totalActiveDebt += ev.remainingDebtIQD;
      totalMonthlyIncome += ev.monthlyIncomeIQD;
      if (ev.isBlacklisted) blacklistedCount++;
      if (ev.tier === 'AAA' || ev.tier === 'A') vipCount++;
      if (ev.tier === 'B' || ev.tier === 'C') moderateCount++;
    });

    return {
      count: filteredEvaluations.length,
      totalRecommendedLimit,
      totalAvailableLimit,
      totalActiveDebt,
      totalMonthlyIncome,
      blacklistedCount,
      vipCount,
      moderateCount
    };
  }, [filteredEvaluations]);

  if (!isOpen) return null;

  // Flawless Isolated Iframe Print
  const handlePrint = () => {
    const printContent = document.getElementById('printable-credit-report-sheet');
    if (!printContent) return;

    const existingIframe = document.getElementById('print-credit-isolated-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'print-credit-isolated-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>كشف الجودة الائتمانية وسقوف التمويل والمخاطر - ${profile.companyName}</title>
        <style>
          @page {
            size: A4 ${orientation};
            margin: 6mm 8mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, 'Tajawal', Arial, sans-serif;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            direction: rtl;
            margin: 0;
            padding: 0;
            width: 100%;
            height: auto;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #475569 !important;
            color: #0f172a !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
          .kpi-box {
            border: 1px solid #cbd5e1 !important;
            border-radius: 6px !important;
            background-color: #f8fafc !important;
          }
          .badge-aaa {
            background-color: #fef3c7 !important;
            color: #92400e !important;
            border: 1px solid #f59e0b !important;
            font-weight: bold !important;
          }
          .badge-a {
            background-color: #dbeafe !important;
            color: #1e40af !important;
            border: 1px solid #3b82f6 !important;
            font-weight: bold !important;
          }
          .badge-b {
            background-color: #ccfbf1 !important;
            color: #115e59 !important;
            border: 1px solid #14b8a6 !important;
            font-weight: bold !important;
          }
          .badge-c {
            background-color: #ffedd5 !important;
            color: #9a3412 !important;
            border: 1px solid #f97316 !important;
            font-weight: bold !important;
          }
          .badge-d {
            background-color: #fee2e2 !important;
            color: #991b1b !important;
            border: 1.5px solid #ef4444 !important;
            font-weight: 800 !important;
          }
          .row-blacklisted {
            background-color: #fff5f5 !important;
          }
          .row-aaa {
            background-color: #fffdf7 !important;
          }
          .stamp-box {
            border: 2px dashed #94a3b8;
            border-radius: 50%;
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 9px;
            color: #64748b;
            font-weight: bold;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 350);
  };

  const getFilterTitle = () => {
    switch (filterTier) {
      case 'VIP':
        return 'كشف عملاء النخبة والفئات الموثوقة (AAA / A)';
      case 'AAA':
        return 'كشف الزبائن الفئة الذهبية الممتازة (AAA)';
      case 'A':
        return 'كشف الزبائن الفئة الفضية الموثوقة (A)';
      case 'B':
        return 'كشف الزبائن الفئة البرونزية (B)';
      case 'C':
        return 'كشف الزبائن الفئة المقيدة بالمخاطر (C)';
      case 'D':
        return 'كشف القائمة السوداء والزبائن المحظورين (Auto-Blacklist)';
      default:
        return 'الكشف الشامل للجودة الائتمانية والمخاطر وسقوف التمويل';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[96vw] xl:max-w-7xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden on print) */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  معاينة وطباعة كشف الجودة الائتمانية وسقوف التمويل
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                  تقرير رسمي A4
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                توليد كشف إداري رسمي معتمد للمدير العام ولجنة الائتمان مع توثيق السقوف، الركائز الأربع، والتواقيع
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
            {/* Orientation Toggle */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  orientation === 'landscape'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="عرض أفقي مخصص للجداول العريضة"
              >
                عرض أفقي (Landscape) ⭐
              </button>
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  orientation === 'portrait'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="عرض عمودي قياسي"
              >
                عرض عمودي (Portrait)
              </button>
            </div>

            {/* Print Action */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند الآن (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customization Toolbar */}
        <div className="p-3.5 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 text-[11px] ml-1">تصفية التقرير:</span>
            <button
              onClick={() => setFilterTier('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                filterTier === 'ALL'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              الكل ({portfolio.evaluations.length})
            </button>
            <button
              onClick={() => setFilterTier('VIP')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                filterTier === 'VIP'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              ⭐ نخبة وموثوق (AAA / A)
            </button>
            <button
              onClick={() => setFilterTier('AAA')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                filterTier === 'AAA'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              AAA ({portfolio.tierCounts.AAA})
            </button>
            <button
              onClick={() => setFilterTier('A')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                filterTier === 'A'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              A ({portfolio.tierCounts.A})
            </button>
            <button
              onClick={() => setFilterTier('B')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                filterTier === 'B'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              B ({portfolio.tierCounts.B})
            </button>
            <button
              onClick={() => setFilterTier('C')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                filterTier === 'C'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              C ({portfolio.tierCounts.C})
            </button>
            <button
              onClick={() => setFilterTier('D')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                filterTier === 'D'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
              }`}
            >
              🚫 القائمة السوداء ({portfolio.blacklistedCount})
            </button>
          </div>

          {/* Search & Metadata Fields */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الكشف..."
                className="pr-8 pl-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 w-44"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">اسم المسؤول:</span>
              <input
                type="text"
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs w-36 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/80 flex justify-center">
          {/* Printable Document Container */}
          <div
            id="printable-credit-report-sheet"
            className={`bg-white text-slate-900 shadow-2xl rounded-sm p-8 text-right font-sans my-2 select-text ${
              orientation === 'landscape'
                ? 'w-full max-w-[1100px] min-h-[750px]'
                : 'w-full max-w-[850px] min-h-[1050px]'
            }`}
            dir="rtl"
          >
            {/* 1. Official Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-start justify-between">
              {/* Right: Company details */}
              <div className="space-y-0.5 text-xs text-slate-800">
                <p className="font-extrabold text-slate-950 text-base">{profile.companyName}</p>
                <p className="text-[11px] text-slate-600">{profile.companyAddress}</p>
                <p className="text-[10px] text-slate-500">{profile.companyActivity || 'دائرة الرقابة وإدارة المخاطر والائتمان'}</p>
              </div>

              {/* Center: Title & Subtitle */}
              <div className="text-center space-y-1">
                {/* <div className="inline-block px-3 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700 mb-1">
                  وثيقة رقابية وتحليلية سرية ومعتمدة
                </div> */}
                <h1 className="text-lg font-black text-slate-950 tracking-tight">
                  {getFilterTitle()}
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">
                  قياس الجودة الائتمانية، احتساب السقوف الآمنة، وكشف القائمة السوداء للزبائن
                </p>
              </div>

              {/* Left: Metadata */}
              <div className="text-left text-xs space-y-1 text-slate-700">
                <p>
                  <strong className="text-slate-900">تاريخ الإصدار:</strong>{' '}
                  <span className="font-mono">{reportDate}</span>
                </p>
                {/* <p>
                  <strong className="text-slate-900">رقم الوثيقة:</strong>{' '}
                  <span className="font-mono font-bold">CR-SAM-{reportDate.replace(/-/g, '')}-01</span>
                </p>
                <p>
                  <strong className="text-slate-900">إعداد وتدقيق:</strong> {auditorName}
                </p>
                <p>
                  <strong className="text-slate-900">عدد السجلات:</strong>{' '}
                  <span className="font-bold font-mono">{filteredEvaluations.length} زبون</span>
                </p> */}
              </div>
            </div>

            {/* 2. Executive KPI Highlights Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-2.5 bg-slate-50 border border-slate-300 rounded-lg mb-4 text-[11px]">
              <div className="p-1.5 text-center border-l border-slate-200">
                <span className="text-slate-500 block text-[9.5px]">سلامة المحفظة:</span>
                <span className="font-black text-slate-900 text-sm font-mono">
                  {portfolio.portfolioHealthIndex}%
                </span>
              </div>
              <div className="p-1.5 text-center border-l border-slate-200">
                <span className="text-slate-500 block text-[9.5px]">النخبة (AAA/A):</span>
                <span className="font-bold text-emerald-700 text-xs font-mono">
                  {filteredMetrics.vipCount} زبون
                </span>
              </div>
              <div className="p-1.5 text-center border-l border-slate-200">
                <span className="text-slate-500 block text-[9.5px]">المقيدين (B/C):</span>
                <span className="font-bold text-slate-700 text-xs font-mono">
                  {filteredMetrics.moderateCount} زبون
                </span>
              </div>
              <div className="p-1.5 text-center border-l border-slate-200">
                <span className="text-slate-500 block text-[9.5px]">القائمة السوداء:</span>
                <span className="font-black text-rose-700 text-xs font-mono">
                  {filteredMetrics.blacklistedCount} محظور
                </span>
              </div>
              <div className="p-1.5 text-center border-l border-slate-200">
                <span className="text-slate-500 block text-[9.5px]">السقوف المعتمدة:</span>
                <span className="font-bold text-slate-900 text-[11px] font-mono">
                  {formatNumber(filteredMetrics.totalRecommendedLimit)} د.ع
                </span>
              </div>
              <div className="p-1.5 text-center border-l border-slate-200">
                <span className="text-slate-500 block text-[9.5px]">الديون القائمة:</span>
                <span className="font-bold text-purple-800 text-[11px] font-mono">
                  {formatNumber(filteredMetrics.totalActiveDebt)} د.ع
                </span>
              </div>
              <div className="p-1.5 text-center">
                <span className="text-slate-500 block text-[9.5px]">الرصيد المتاح:</span>
                <span className="font-black text-emerald-700 text-[11px] font-mono">
                  {formatNumber(filteredMetrics.totalAvailableLimit)} د.ع
                </span>
              </div>
            </div>

            {/* 3. Main Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-400 border-collapse mb-4">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-400">
                    <th className="border border-slate-400 p-2 text-center w-8">#</th>
                    <th className="border border-slate-400 p-2 text-right">اسم الزبون</th>
                    <th className="border border-slate-400 p-2 text-right">الوظيفة / جهة العمل</th>
                    <th className="border border-slate-400 p-2 text-center">الراتب الشهري</th>
                    <th className="border border-slate-400 p-2 text-center w-16">الدرجة</th>
                    <th className="border border-slate-400 p-2 text-center w-20">التصنيف</th>
                    <th className="border border-slate-400 p-2 text-center w-14">DTI</th>
                    <th className="border border-slate-400 p-2 text-center">السقف المقترح</th>
                    <th className="border border-slate-400 p-2 text-center">الديون النشطة</th>
                    <th className="border border-slate-400 p-2 text-center">الرصيد المتاح</th>
                    <th className="border border-slate-400 p-2 text-right">حالة الاعتماد والملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvaluations.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="border border-slate-400 p-6 text-center text-slate-500 font-medium">
                        لا توجد سجلات تطابق معايير التصفية والبحث المحددة
                      </td>
                    </tr>
                  ) : (
                    filteredEvaluations.map((ev, index) => {
                      const borrower = store.borrowers.find((b) => b.id === ev.borrowerId);
                      const isEven = index % 2 === 1;

                      let badgeClass = 'badge-b';
                      if (ev.tier === 'AAA') badgeClass = 'badge-aaa';
                      else if (ev.tier === 'A') badgeClass = 'badge-a';
                      else if (ev.tier === 'C') badgeClass = 'badge-c';
                      else if (ev.tier === 'D') badgeClass = 'badge-d';

                      let rowClass = isEven ? 'bg-slate-50/50' : 'bg-white';
                      if (ev.isBlacklisted) rowClass = 'bg-rose-50/70';
                      else if (ev.tier === 'AAA') rowClass = 'bg-amber-50/40';

                      return (
                        <tr key={ev.borrowerId} className={rowClass}>
                          <td className="border border-slate-400 p-1.5 text-center font-mono font-bold text-slate-700">
                            {index + 1}
                          </td>
                          <td className="border border-slate-400 p-1.5 font-bold text-slate-900">
                            {ev.borrowerName}
                          </td>
                          <td className="border border-slate-400 p-1.5 text-slate-700 text-[11px]">
                            {borrower?.jobTitle || borrower?.city || 'سامراء'}
                          </td>
                          <td className="border border-slate-400 p-1.5 text-center font-mono text-slate-800">
                            {ev.monthlyIncomeIQD > 0 ? formatNumber(ev.monthlyIncomeIQD) : '-'}
                          </td>
                          <td className="border border-slate-400 p-1.5 text-center font-mono font-bold text-slate-900">
                            {ev.totalScore} / 100
                          </td>
                          <td className="border border-slate-400 p-1.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
                              {ev.tierShortLabel}
                            </span>
                          </td>
                          <td className="border border-slate-400 p-1.5 text-center font-mono text-slate-700">
                            {(ev.dtiRatio * 100).toFixed(0)}%
                          </td>
                          <td className="border border-slate-400 p-1.5 text-center font-mono font-bold text-slate-900">
                            {formatNumber(ev.recommendedCreditLimitIQD)}
                          </td>
                          <td className="border border-slate-400 p-1.5 text-center font-mono text-purple-900">
                            {formatNumber(ev.remainingDebtIQD)}
                          </td>
                          <td className="border border-slate-400 p-1.5 text-center font-mono font-black text-emerald-800 bg-emerald-50/40">
                            {formatNumber(ev.availableCreditLimitIQD)}
                          </td>
                          <td className="border border-slate-400 p-1.5 text-[10.5px]">
                            {ev.isBlacklisted ? (
                              <span className="font-bold text-rose-700">
                                🚫 {ev.blacklistReason || 'محظور بقائمة المخاطر الحرجة'}
                              </span>
                            ) : ev.tier === 'AAA' ? (
                              <span className="font-bold text-amber-800">
                                ⭐ مؤهل بامتياز (سقف مميز 45% من الراتب)
                              </span>
                            ) : ev.tier === 'A' ? (
                              <span className="font-medium text-blue-900">
                                مؤهل ائتمانياً (سقف 40% من الراتب)
                              </span>
                            ) : ev.tier === 'B' ? (
                              <span className="text-slate-700">
                                مؤهل ضمن السقف (مخاطر مقبولة 30%)
                              </span>
                            ) : (
                              <span className="text-orange-900 font-medium">
                                مقيد بمخاطر (يتطلب كفيلاً إضافياً)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 font-bold border-t-2 border-slate-900 text-slate-950">
                    <td colSpan={3} className="border border-slate-400 p-2 text-center">
                      المجاميع الإجمالية لعدد ({filteredEvaluations.length}) زبون
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-mono">
                      {formatNumber(filteredMetrics.totalMonthlyIncome)}
                    </td>
                    <td colSpan={3} className="border border-slate-400 p-2 text-center text-xs">
                      متوسط السلامة: {portfolio.portfolioHealthIndex}%
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-mono">
                      {formatNumber(filteredMetrics.totalRecommendedLimit)}
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-mono text-purple-950">
                      {formatNumber(filteredMetrics.totalActiveDebt)}
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-mono text-emerald-950 bg-emerald-100/60">
                      {formatNumber(filteredMetrics.totalAvailableLimit)}
                    </td>
                    <td className="border border-slate-400 p-2 text-center text-[10px] text-slate-600">
                      جميع المبالغ مسجلة بالدينار العراقي (IQD)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Optional Management Notes */}
            {customNotes && (
              <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg mb-4 text-xs">
                <span className="font-bold text-slate-900 block mb-0.5">ملاحظات وتوصيات الإدارة:</span>
                <p className="text-slate-700 leading-relaxed">{customNotes}</p>
              </div>
            )}

            {/* Official Legal Declaration & Signatures */}
            <div className="pt-4 border-t-2 border-slate-900 text-xs">
              <p className="text-[10px] text-slate-600 leading-relaxed text-center mb-6">
                «تم تدقيق واحتساب مؤشرات هذا الكشف استناداً إلى سجلات الأقساط، التزامات الدخل (DTI)، الكفلاء الموثقين، وتاريخ السداد وفق قواعد الرقابة الائتمانية لشركة أمان، ويُعد وثيقة رقابية استشارية لتحديد السقوف وحماية رأس المال»
              </p>

              <div className="grid grid-cols-4 gap-4 text-center items-end">
                {/* 1. Credit Officer */}
                <div className="space-y-6">
                  <div>
                    <p className="font-bold text-slate-900">مسؤول الائتمان والمخاطر</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{auditorName}</p>
                  </div>
                  <p className="font-serif text-slate-400 text-xs border-b border-dotted border-slate-400 pb-1">
                    التوقيع: ..........................
                  </p>
                </div>

                {/* 2. Financial Accountant */}
                <div className="space-y-6">
                  <div>
                    <p className="font-bold text-slate-900">المحاسب المالي والقانوني</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">قسم الحسابات والتدقيق</p>
                  </div>
                  <p className="font-serif text-slate-400 text-xs border-b border-dotted border-slate-400 pb-1">
                    التوقيع: ..........................
                  </p>
                </div>

                {/* 3. Official Stamp */}
                <div className="flex flex-col items-center justify-center">
                  <div className="stamp-box">
                    <span>
                      {profile.companyName}
                      <br />
                      الختم الرسمي
                      <br />
                      {profile.companyAddress ? profile.companyAddress.split('-')[0].trim() : 'سامراء'}
                    </span>
                  </div>
                </div>

                {/* 4. General Manager */}
                <div className="space-y-6">
                  <div>
                    <p className="font-bold text-slate-900">مصادقة المدير العام</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{profile.managerName || 'أحمد إياد'}</p>
                  </div>
                  <p className="font-serif text-slate-400 text-xs border-b border-dotted border-slate-400 pb-1">
                    التوقيع والختم: ..........................
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
