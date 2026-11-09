'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  Download,
  X,
  Search,
  Users,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
  Filter,
  Building2,
  UserCheck
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { Borrower, InstallmentContract } from '@/types/finance';
import { getBorrowerDueSummary } from '@/utils/installmentDates';
import { formatNumber, formatDate } from '@/utils/formatters';
import { DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';

interface BorrowerIntroducersModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: SimulationStore;
}

type FilterStatus = 'ALL' | 'OVERDUE' | 'ACTIVE_DEBT' | 'SETTLED';

export interface IntroducerCustomerRow {
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  borrowerAddress: string;
  introducedBy: string;
  remainingDebtIQD: number;
  totalFinancedIQD: number;
  monthlyInstallmentIQD: number;
  overdueCount: number;
  totalOverdueAmountIQD: number;
  statusLabel: string;
  isOverdue: boolean;
  isSettled: boolean;
}

export interface IntroducerGroup {
  introducerName: string;
  totalCustomers: number;
  overdueCustomersCount: number;
  totalRemainingDebtIQD: number;
  totalOverdueAmountIQD: number;
  customers: IntroducerCustomerRow[];
}

export const BorrowerIntroducersModal: React.FC<BorrowerIntroducersModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const profile = store.companyProfile || DEFAULT_COMPANY_REPORT_PROFILE;
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [selectedIntroducer, setSelectedIntroducer] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  // Compile all customer rows with financial & overdue status
  const allCustomerRows: IntroducerCustomerRow[] = useMemo(() => {
    const rows: IntroducerCustomerRow[] = [];
    const today = new Date();

    for (const b of store.borrowers) {
      const introducerName = (b.introducedBy && b.introducedBy.trim()) || 'بدون معرّف / تسجيل مباشر';
      const dueSummary = getBorrowerDueSummary(b.id, store.contracts, today);

      // Find active monthly installment from active contracts
      const borrowerContracts = store.contracts.filter((c) => c.borrowerId === b.id && c.status === 'ACTIVE');
      const monthlyInstallment = borrowerContracts.reduce(
        (sum, c) => sum + (c.monthlyInstallmentIQD || 0),
        0
      );

      const isSettled = b.totalFinancedIQD > 0 && b.remainingDebtIQD <= 0;
      let statusLabel = 'منتظم بالسداد';
      if (dueSummary.hasOverdue) {
        statusLabel = `متأخر (${dueSummary.overdueCount} قسط)`;
      } else if (isSettled) {
        statusLabel = 'مسدد بالكامل';
      } else if (b.remainingDebtIQD > 0) {
        statusLabel = 'قائم بالسداد';
      }

      rows.push({
        borrowerId: b.id,
        borrowerName: b.name,
        borrowerPhone: b.phone || '',
        borrowerAddress: b.address || '',
        introducedBy: introducerName,
        remainingDebtIQD: b.remainingDebtIQD || 0,
        totalFinancedIQD: b.totalFinancedIQD || 0,
        monthlyInstallmentIQD: monthlyInstallment,
        overdueCount: dueSummary.overdueCount,
        totalOverdueAmountIQD: dueSummary.totalOverdueAmountIQD,
        statusLabel,
        isOverdue: dueSummary.hasOverdue,
        isSettled,
      });
    }

    return rows;
  }, [store.borrowers, store.contracts]);

  // List of distinct introducers for the dropdown filter
  const distinctIntroducers = useMemo(() => {
    const names = new Set<string>();
    allCustomerRows.forEach((r) => names.add(r.introducedBy));
    return Array.from(names).sort((a, b) => {
      if (a === 'بدون معرّف / تسجيل مباشر') return 1;
      if (b === 'بدون معرّف / تسجيل مباشر') return -1;
      return a.localeCompare(b, 'ar');
    });
  }, [allCustomerRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allCustomerRows.filter((row) => {
      // 1. Status Filter
      if (filterStatus === 'OVERDUE' && !row.isOverdue) return false;
      if (filterStatus === 'ACTIVE_DEBT' && row.remainingDebtIQD <= 0) return false;
      if (filterStatus === 'SETTLED' && !row.isSettled) return false;

      // 2. Specific Introducer Filter
      if (selectedIntroducer !== 'ALL' && row.introducedBy !== selectedIntroducer) {
        return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = row.borrowerName.toLowerCase().includes(q);
        const matchesPhone = row.borrowerPhone.includes(q);
        const matchesIntroducer = row.introducedBy.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesIntroducer) return false;
      }

      return true;
    });
  }, [allCustomerRows, filterStatus, selectedIntroducer, searchQuery]);

  // Group filtered rows by Introducer
  const groupedData: IntroducerGroup[] = useMemo(() => {
    const map = new Map<string, IntroducerCustomerRow[]>();

    filteredRows.forEach((row) => {
      const group = map.get(row.introducedBy) || [];
      group.push(row);
      map.set(row.introducedBy, group);
    });

    const groups: IntroducerGroup[] = [];
    map.forEach((customers, introducerName) => {
      const overdueCustomersCount = customers.filter((c) => c.isOverdue).length;
      const totalRemainingDebtIQD = customers.reduce((sum, c) => sum + c.remainingDebtIQD, 0);
      const totalOverdueAmountIQD = customers.reduce((sum, c) => sum + c.totalOverdueAmountIQD, 0);

      groups.push({
        introducerName,
        totalCustomers: customers.length,
        overdueCustomersCount,
        totalRemainingDebtIQD,
        totalOverdueAmountIQD,
        customers,
      });
    });

    // Sort: groups with overdue customers first, then by customer count
    return groups.sort((a, b) => {
      if (a.overdueCustomersCount !== b.overdueCustomersCount) {
        return b.overdueCustomersCount - a.overdueCustomersCount;
      }
      return b.totalCustomers - a.totalCustomers;
    });
  }, [filteredRows]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalCustomers = filteredRows.length;
    const overdueCount = filteredRows.filter((r) => r.isOverdue).length;
    const totalRemainingDebt = filteredRows.reduce((sum, r) => sum + r.remainingDebtIQD, 0);
    const totalOverdueAmount = filteredRows.reduce((sum, r) => sum + r.totalOverdueAmountIQD, 0);
    const totalIntroducersCount = groupedData.length;

    return {
      totalCustomers,
      overdueCount,
      totalRemainingDebt,
      totalOverdueAmount,
      totalIntroducersCount,
    };
  }, [filteredRows, groupedData]);

  if (!isOpen) return null;

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Export to CSV with UTF-8 BOM
  const handleExportCSV = () => {
    let csv = '\uFEFF';
    csv += 'من أحضر الزبون (المعرّف),اسم الزبون,رقم الهاتف,المتبقي الكلي (د.ع),الأقساط المتأخرة,مبلغ القسط الشهري (د.ع),المبلغ المتأخر (د.ع),الحالة\n';

    groupedData.forEach((group) => {
      group.customers.forEach((c) => {
        csv += `"${group.introducerName}","${c.borrowerName}","${c.borrowerPhone}","${c.remainingDebtIQD}","${c.overdueCount}","${c.monthlyInstallmentIQD}","${c.totalOverdueAmountIQD}","${c.statusLabel}"\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `كشف_المعرّفين_والزبائن_${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel (.xls HTML table)
  const handleExportExcel = () => {
    let excel = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
          th { background-color: #1e293b; color: #ffffff; border: 1px solid #475569; padding: 8px; font-weight: bold; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 7px; text-align: right; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .group-header { background-color: #fef3c7; font-weight: bold; color: #78350f; border: 1px solid #f59e0b; padding: 8px; }
          .overdue-badge { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
          .number { direction: ltr; text-align: left; font-weight: bold; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 20px;">
          <h2>${profile.companyName}</h2>
          <h3>كشف الزبائن مجمعين حسب من أحضرهم (المتابعة الودية قبل الكفيل)</h3>
          <p style="color: #64748b;">${profile.companyAddress} | الهاتف: ${profile.companyPhone}</p>
          <p>تاريخ الاستخراج: ${formatDate(reportDate)} | إجمالي الزبائن: ${stats.totalCustomers} | المتأخرين: ${stats.overdueCount}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>من أحضر الزبون (المعرّف)</th>
              <th>اسم الزبون</th>
              <th>رقم الهاتف</th>
              <th>المتبقي الكلي (د.ع)</th>
              <th>الأقساط المتأخرة</th>
              <th>مبلغ القسط الشهري (د.ع)</th>
              <th>المبلغ المتأخر (د.ع)</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
    `;

    groupedData.forEach((group) => {
      excel += `
        <tr>
          <td colspan="8" class="group-header">
            👤 المعرّف: ${group.introducerName} (عدد الزبائن: ${group.totalCustomers} | المتأخرين: ${group.overdueCustomersCount} | إجمالي المتبقي: ${formatNumber(group.totalRemainingDebtIQD)} د.ع)
          </td>
        </tr>
      `;
      group.customers.forEach((c) => {
        excel += `
          <tr>
            <td>${group.introducerName}</td>
            <td><b>${c.borrowerName}</b></td>
            <td style="direction: ltr; text-align: right;">${c.borrowerPhone}</td>
            <td class="number">${formatNumber(c.remainingDebtIQD)} د.ع</td>
            <td style="text-align: center;" class="${c.isOverdue ? 'overdue-badge' : ''}">${c.overdueCount} قسط</td>
            <td class="number">${formatNumber(c.monthlyInstallmentIQD)} د.ع</td>
            <td class="number">${formatNumber(c.totalOverdueAmountIQD)} د.ع</td>
            <td>${c.statusLabel}</td>
          </tr>
        `;
      });
    });

    excel += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excel], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `كشف_المعرّفين_${reportDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-introducers-report, #printable-introducers-report * {
            visibility: visible;
          }
          #printable-introducers-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 10mm !important;
            background: white !important;
            color: black !important;
            border: none !important;
            font-size: 10pt !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #333333 !important;
            padding: 4px 6px !important;
          }
          .print-group-header {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
        }
      `}} />

      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>كشف المعرّفين ومن أحضر الزبائن</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  متابعة ودية
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تجميع الزبائن حسب الشخص المعرّف للتواصل الودي وحثهم على السداد قبل الاتصال بالكفيل
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 hover:border-slate-600"
              title="تصدير كشف CSV متوافق مع إكسل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تصدير CSV</span>
            </button>

            {/* Excel Export */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
              title="تصدير ملف إكسل منسق للجداول"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>تصدير Excel</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-900/30"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف (A4)</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar (Hidden on print) */}
        <div className="no-print p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              الكل ({allCustomerRows.length})
            </button>

            <button
              onClick={() => setFilterStatus('OVERDUE')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold transition-all ${
                filterStatus === 'OVERDUE'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-slate-900 text-rose-400 hover:bg-rose-500/10 border border-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>المتأخرين فقط ({allCustomerRows.filter((r) => r.isOverdue).length})</span>
            </button>

            <button
              onClick={() => setFilterStatus('ACTIVE_DEBT')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                filterStatus === 'ACTIVE_DEBT'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              عليهم ديون قائمة ({allCustomerRows.filter((r) => r.remainingDebtIQD > 0).length})
            </button>

            <button
              onClick={() => setFilterStatus('SETTLED')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                filterStatus === 'SETTLED'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              مسددين بالكامل ({allCustomerRows.filter((r) => r.isSettled).length})
            </button>
          </div>

          {/* Introducer Dropdown & Search Bar */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Introducer selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedIntroducer}
                onChange={(e) => setSelectedIntroducer(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none text-xs cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  جميع المعرّفين ({distinctIntroducers.length})
                </option>
                {distinctIntroducers.map((name) => (
                  <option key={name} value={name} className="bg-slate-900 text-white">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بالزبون أو الهاتف أو المعرّف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Printable Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <div
            id="printable-introducers-report"
            className="bg-white text-slate-900 p-6 md:p-8 rounded-2xl shadow-xl space-y-6"
            dir="rtl"
          >
            {/* Printable Document Header */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-slate-900" />
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">
                      {profile.companyName}
                    </h1>
                  </div>
                  <p className="text-xs text-slate-600 font-semibold mt-1">
                    كشف متابعة الزبائن بحسب المعرّف (المتابعة الودية والاستباقية قبل الكفيل)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {profile.companyAddress} | الهاتف المعتمد للإدارة: {profile.companyPhone}
                  </p>
                </div>

                <div className="text-left text-xs space-y-1">
                  <div className="font-bold text-slate-800">
                    تاريخ الاستخراج:{' '}
                    <span className="font-mono text-slate-950 font-black">
                      {formatDate(reportDate)}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    عدد المعرّفين المشمولين:{' '}
                    <span className="font-bold text-slate-900">{stats.totalIntroducersCount}</span>
                  </div>
                </div>
              </div>

              {/* KPI summary strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300">
                  <p className="text-slate-600 text-[11px] font-semibold">إجمالي الزبائن</p>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{stats.totalCustomers} زبون</p>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <p className="text-rose-700 text-[11px] font-semibold">المتأخرين عن السداد</p>
                  <p className="text-lg font-black text-rose-800 mt-0.5">{stats.overdueCount} زبون</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-amber-700 text-[11px] font-semibold">المبالغ المتأخرة المطلوبة</p>
                  <p className="text-lg font-black text-amber-900 mt-0.5">
                    {formatNumber(stats.totalOverdueAmount)} د.ع
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300">
                  <p className="text-slate-600 text-[11px] font-semibold">إجمالي الديون القائمة</p>
                  <p className="text-lg font-black text-slate-900 mt-0.5">
                    {formatNumber(stats.totalRemainingDebt)} د.ع
                  </p>
                </div>
              </div>
            </div>

            {/* Grouped Tables by Introducer */}
            {groupedData.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-500" />
                <p className="text-base font-bold text-slate-700">لا توجد بيانات مطابقة لخيارات الفلترة الحالية</p>
                <p className="text-xs text-slate-500 mt-1">جرب تغيير حالة الفلتر أو مسح نص البحث</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedData.map((group) => (
                  <div
                    key={group.introducerName}
                    className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm"
                  >
                    {/* Introducer Header Banner */}
                    <div className="bg-slate-100 p-3.5 px-4 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3 print-group-header">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold text-sm">
                          👤
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 font-semibold">من أحضر الزبائن:</span>
                          <h3 className="text-base font-black text-slate-900 inline-block mr-1.5">
                            {group.introducerName}
                          </h3>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold border border-slate-300">
                          {group.totalCustomers} زبون
                        </span>

                        {group.overdueCustomersCount > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">
                            ⚠️ {group.overdueCustomersCount} متأخر
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                            ✓ لا يوجد متأخرين
                          </span>
                        )}

                        <span className="text-slate-700 font-semibold">
                          إجمالي المتبقي:{' '}
                          <span className="font-mono font-bold text-slate-950">
                            {formatNumber(group.totalRemainingDebtIQD)} د.ع
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Customers Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                            <th className="p-2.5 border-l border-slate-200 w-12 text-center">ت</th>
                            <th className="p-2.5 border-l border-slate-200">اسم الزبون</th>
                            <th className="p-2.5 border-l border-slate-200">رقم الهاتف</th>
                            <th className="p-2.5 border-l border-slate-200 text-left">المتبقي الكلي</th>
                            <th className="p-2.5 border-l border-slate-200 text-center">الأقساط المتأخرة</th>
                            <th className="p-2.5 border-l border-slate-200 text-left">مبلغ القسط الشهري</th>
                            <th className="p-2.5 border-l border-slate-200 text-left">المبلغ المتأخر</th>
                            <th className="p-2.5 text-center">الحالة والمتابعة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {group.customers.map((c, idx) => (
                            <tr
                              key={c.borrowerId}
                              className={`transition-colors ${
                                c.isOverdue ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="p-2.5 border-l border-slate-200 text-center font-mono font-semibold text-slate-500">
                                {idx + 1}
                              </td>

                              <td className="p-2.5 border-l border-slate-200">
                                <span className="font-bold text-slate-950 text-sm block">
                                  {c.borrowerName}
                                </span>
                                {c.borrowerAddress && (
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[180px]">
                                    {c.borrowerAddress}
                                  </span>
                                )}
                              </td>

                              <td className="p-2.5 border-l border-slate-200 font-mono text-slate-800">
                                <a
                                  href={`tel:${c.borrowerPhone}`}
                                  className="inline-flex items-center gap-1 hover:text-blue-600 hover:underline"
                                  title="اتصال هاتفي"
                                >
                                  <Phone className="w-3 h-3 text-slate-400 no-print" />
                                  <span>{c.borrowerPhone || 'غير متوفر'}</span>
                                </a>
                              </td>

                              <td className="p-2.5 border-l border-slate-200 font-mono font-bold text-slate-950 text-left">
                                {formatNumber(c.remainingDebtIQD)} د.ع
                              </td>

                              <td className="p-2.5 border-l border-slate-200 text-center">
                                {c.overdueCount > 0 ? (
                                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-xs border border-rose-300">
                                    ⚠️ {c.overdueCount} متأخر
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs font-semibold">0</span>
                                )}
                              </td>

                              <td className="p-2.5 border-l border-slate-200 font-mono font-bold text-slate-900 text-left">
                                {c.monthlyInstallmentIQD > 0 ? `${formatNumber(c.monthlyInstallmentIQD)} د.ع` : '-'}
                              </td>

                              <td className="p-2.5 border-l border-slate-200 font-mono text-left font-bold">
                                {c.totalOverdueAmountIQD > 0 ? (
                                  <span className="text-rose-700">
                                    {formatNumber(c.totalOverdueAmountIQD)} د.ع
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0 د.ع</span>
                                )}
                              </td>

                              <td className="p-2.5 text-center">
                                {c.isOverdue ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                                    <span>يحتاج اتصال المعرّف</span>
                                  </span>
                                ) : c.isSettled ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>مسدد بالكامل</span>
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-600">
                                    منتظم بالسداد
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Printable Signatures Footer */}
            <div className="pt-8 border-t-2 border-slate-900 grid grid-cols-3 gap-6 text-center text-xs">
              <div>
                <p className="font-bold text-slate-800">مسؤول المتابعة والاتصال</p>
                <p className="text-[11px] text-slate-500 mt-1">التواصل مع المعرّف</p>
                <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
              </div>
              <div>
                <p className="font-bold text-slate-800">مسؤول التحصيل والضمانات</p>
                <p className="text-[11px] text-slate-500 mt-1">متابعة الكفلاء في حال عدم السداد</p>
                <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
              </div>
              <div>
                <p className="font-bold text-slate-800">{profile.companyName}</p>
                <p className="text-[11px] text-slate-500 mt-1">المدير العام ({profile.managerName || 'أحمد إياد'})</p>
                <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

