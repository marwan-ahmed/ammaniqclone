'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  X,
  Search,
  Filter,
  Phone,
  User,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Building2,
  FileText,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import {
  calculateInstallmentDueStatus,
  InstallmentDueInfo
} from '@/utils/installmentDates';
import { DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';
import { formatNumber, formatDate, formatDateTime } from '@/utils/formatters';
import { getInvoiceNumber, getContractNumber } from '@/components/common/ContractDocumentHubModal';

interface CollectorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: SimulationStore;
  initialFilter?: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';
}

type FilterCategory = 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';

interface CollectorScheduleRow {
  scheduleId: string;
  contractId: string;
  contractNumber: string;
  invoiceNumber: string;
  installmentNumber: number;
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

export const CollectorReportModal: React.FC<CollectorReportModalProps> = ({
  isOpen,
  onClose,
  store,
  initialFilter = 'ALL'
}) => {
  const profile = store.companyProfile || DEFAULT_COMPANY_REPORT_PROFILE;
  const [filter, setFilter] = useState<FilterCategory>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [collectorName, setCollectorName] = useState('المحصل الميداني');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setFilter(initialFilter);
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

  // Aggregate all unpaid schedules across all contracts with due information
  const allRows: CollectorScheduleRow[] = useMemo(() => {
    const today = new Date();
    const rows: CollectorScheduleRow[] = [];

    for (const contract of store.contracts) {
      const borrower = store.borrowers.find((b) => b.id === contract.borrowerId);
      const borrowerGuarantors = borrower?.guarantors || [];
      const borrowerRemaining = borrower?.remainingDebtIQD || 0;

      for (const schedule of contract.schedules) {
        if (schedule.status !== 'PAID') {
          const dueInfo = calculateInstallmentDueStatus(schedule.dueDate, false, today);

          rows.push({
            scheduleId: schedule.id,
            contractId: contract.id,
            contractNumber: getContractNumber(contract),
            invoiceNumber: getInvoiceNumber(contract),
            installmentNumber: schedule.installmentNumber,
            dueDate: schedule.dueDate,
            amountIQD: schedule.amountIQD,
            borrowerId: contract.borrowerId,
            borrowerName: contract.borrowerName,
            borrowerPhone: borrower?.phone || 'غير مسجل',
            borrowerAddress: borrower?.address || 'سامراء',
            borrowerRemainingDebt: borrowerRemaining,
            guarantors: borrowerGuarantors,
            inventoryItemName: contract.inventoryItemName,
            investorName: contract.investorName,
            dueInfo
          });
        }
      }
    }

    // Sort: Overdue first (most overdue first), then due today, then upcoming
    return rows.sort((a, b) => {
      // Prioritize overdue (negative diffDays, smaller means more overdue)
      if (a.dueInfo.status === 'OVERDUE' && b.dueInfo.status !== 'OVERDUE') return -1;
      if (a.dueInfo.status !== 'OVERDUE' && b.dueInfo.status === 'OVERDUE') return 1;
      if (a.dueInfo.status === 'OVERDUE' && b.dueInfo.status === 'OVERDUE') {
        return a.dueInfo.diffDays - b.dueInfo.diffDays; // -30 before -2
      }
      if (a.dueInfo.status === 'DUE_TODAY' && b.dueInfo.status !== 'DUE_TODAY') return -1;
      if (a.dueInfo.status !== 'DUE_TODAY' && b.dueInfo.status === 'DUE_TODAY') return 1;

      return a.dueInfo.diffDays - b.dueInfo.diffDays;
    });
  }, [store.contracts, store.borrowers]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      // Status category filter
      let matchesCategory = true;
      if (filter === 'OVERDUE') {
        matchesCategory = row.dueInfo.status === 'OVERDUE';
      } else if (filter === 'DUE_TODAY') {
        matchesCategory = row.dueInfo.status === 'DUE_TODAY';
      } else if (filter === 'UPCOMING') {
        matchesCategory = row.dueInfo.status === 'UPCOMING';
      }

      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        row.borrowerName.toLowerCase().includes(q) ||
        row.borrowerPhone.includes(q) ||
        row.borrowerAddress.toLowerCase().includes(q) ||
        row.contractNumber.toLowerCase().includes(q) ||
        row.invoiceNumber.includes(q) ||
        row.inventoryItemName.toLowerCase().includes(q) ||
        row.guarantors.some(
          (g) => g.name.toLowerCase().includes(q) || g.phone.includes(q)
        );

      return matchesCategory && matchesSearch;
    });
  }, [allRows, filter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const overdueList = allRows.filter((r) => r.dueInfo.status === 'OVERDUE');
    const dueTodayList = allRows.filter((r) => r.dueInfo.status === 'DUE_TODAY');
    const upcomingList = allRows.filter((r) => r.dueInfo.status === 'UPCOMING');

    const totalOverdueAmount = overdueList.reduce((sum, r) => sum + r.amountIQD, 0);
    const totalDueTodayAmount = dueTodayList.reduce((sum, r) => sum + r.amountIQD, 0);
    const totalUpcomingAmount = upcomingList.reduce((sum, r) => sum + r.amountIQD, 0);

    return {
      totalActionable: allRows.length,
      overdueCount: overdueList.length,
      overdueAmount: totalOverdueAmount,
      dueTodayCount: dueTodayList.length,
      dueTodayAmount: totalDueTodayAmount,
      upcomingCount: upcomingList.length,
      upcomingAmount: totalUpcomingAmount
    };
  }, [allRows]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Print-specific style tag */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-collector-report, #printable-collector-report * {
            visibility: visible;
          }
          #printable-collector-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 10mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
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
            border: 1px solid #475569 !important;
            color: #000000 !important;
            padding: 4px 6px !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
          .print-badge {
            border: 1px solid #000000 !important;
            padding: 2px 4px !important;
            font-weight: bold !important;
          }
        }
      ` }} />

      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>كشف التحصيل والمتابعة الميدانية للمحصل</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  طباعة رسمية A4
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                توليد كشف يومي دقيق بجميع الأقساط المتأخرة والمستحقة بالأيام لتزويد المحصل الميداني بالبيانات وأرقام الكفلاء
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف الآن (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar (Hidden on print) */}
        <div className="no-print p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filter === 'ALL'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              الكل المطلوب متابعته ({allRows.length})
            </button>
            <button
              onClick={() => setFilter('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filter === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-rose-400 hover:bg-rose-950/40'
              }`}
            >
              المتأخرون عن السداد ({stats.overdueCount})
            </button>
            <button
              onClick={() => setFilter('DUE_TODAY')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filter === 'DUE_TODAY'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-blue-400 hover:bg-blue-950/40'
              }`}
            >
              يستحقون اليوم ({stats.dueTodayCount})
            </button>
            <button
              onClick={() => setFilter('UPCOMING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filter === 'UPCOMING'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-amber-400 hover:bg-amber-950/40'
              }`}
            >
              مستحق قريباً (خلال 7 أيام) ({stats.upcomingCount})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الزبون أو الكفيل أو الهاتف..."
                className="w-full pl-3 pr-9 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Printable Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <div
            id="printable-collector-report"
            className="bg-white text-slate-900 p-6 md:p-8 rounded-2xl shadow-xl space-y-6"
            dir="rtl"
          >
            {/* Printable Document Header */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-950 tracking-tight">
                    {profile.companyName}
                  </h1>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">
                    كشف التحصيل والمتابعة الميدانية للمتأخرين والمستحقين
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {profile.companyAddress} | الهاتف المعتمد للإدارة: {profile.companyPhone}
                  </p>
                </div>

                <div className="text-left text-xs space-y-1 font-mono text-slate-700">
                  <p>
                    <span className="font-bold">تاريخ الكشف:</span> {formatDate(new Date())}
                  </p>
                  <p>
                    <span className="font-bold">وقت الطباعة:</span> {formatDateTime(new Date())}
                  </p>
                  <p>
                    <span className="font-bold">المحصل المكلّف:</span> {collectorName}
                  </p>
                </div>
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200 text-center text-xs">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <span className="text-slate-500 block">إجمالي الحالات</span>
                  <strong className="text-base font-black text-slate-900">
                    {filteredRows.length} قسط
                  </strong>
                </div>
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <span className="text-rose-700 font-bold block">أقساط متأخرة</span>
                  <strong className="text-base font-black text-rose-800">
                    {stats.overdueCount} ({formatNumber(stats.overdueAmount)} د.ع)
                  </strong>
                </div>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-blue-700 font-bold block">مستحقة اليوم</span>
                  <strong className="text-base font-black text-blue-800">
                    {stats.dueTodayCount} ({formatNumber(stats.dueTodayAmount)} د.ع)
                  </strong>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-amber-700 font-bold block">مستحقة قريباً</span>
                  <strong className="text-base font-black text-amber-800">
                    {stats.upcomingCount} ({formatNumber(stats.upcomingAmount)} د.ع)
                  </strong>
                </div>
              </div>
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-300">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400">
                  <tr>
                    <th className="p-2.5 border-l border-slate-300 text-center w-8">#</th>
                    <th className="p-2.5 border-l border-slate-300">الزبون وبيانات الاتصال</th>
                    <th className="p-2.5 border-l border-slate-300">العنوان</th>
                    <th className="p-2.5 border-l border-slate-300">الكفيل الضامن</th>
                    <th className="p-2.5 border-l border-slate-300">العقد والقسط</th>
                    <th className="p-2.5 border-l border-slate-300">تاريخ الاستحقاق</th>
                    <th className="p-2.5 border-l border-slate-300 text-center">حالة التأخير / الأيام</th>
                    <th className="p-2.5 border-l border-slate-300">المبلغ المطلوب</th>
                    <th className="p-2.5 text-center min-w-[160px]">ملاحظات المحصل والاتصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-500">
                        لا توجد أقساط مطابقة لهذا الفلتر حالياً
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr key={row.scheduleId} className="hover:bg-slate-50">
                        <td className="p-2 border-l border-slate-300 text-center font-bold text-slate-600">
                          {idx + 1}
                        </td>

                        {/* Borrower Info */}
                        <td className="p-2 border-l border-slate-300">
                          <p className="font-bold text-slate-950 text-sm">{row.borrowerName}</p>
                          <p className="text-slate-600 font-mono text-[11px] mt-0.5 flex items-center gap-1">
                            <span>📞 {row.borrowerPhone}</span>
                          </p>
                        </td>

                        {/* Address */}
                        <td className="p-2 border-l border-slate-300 text-slate-700 max-w-[140px]">
                          {row.borrowerAddress}
                        </td>

                        {/* Guarantor Info */}
                        <td className="p-2 border-l border-slate-300">
                          {row.guarantors && row.guarantors.length > 0 ? (
                            <div>
                              <p className="font-bold text-slate-900">{row.guarantors[0].name}</p>
                              <p className="text-slate-600 font-mono text-[11px]">📞 {row.guarantors[0].phone}</p>
                              {row.guarantors[0].department && (
                                <p className="text-[10px] text-slate-500">{row.guarantors[0].department}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">لا يوجد كفيل مسجل</span>
                          )}
                        </td>

                        {/* Contract & Schedule */}
                        <td className="p-2 border-l border-slate-300">
                          <p className="font-bold text-slate-900">
                            قسط #{row.installmentNumber}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            عقد: #{row.contractNumber}
                          </p>
                          <p className="text-[10px] text-slate-600 truncate max-w-[120px]">
                            {row.inventoryItemName}
                          </p>
                        </td>

                        {/* Due Date */}
                        <td className="p-2 border-l border-slate-300 font-mono text-slate-800">
                          {row.dueDate}
                        </td>

                        {/* Overdue / Days Status */}
                        <td className="p-2 border-l border-slate-300 text-center">
                          {row.dueInfo.status === 'OVERDUE' && (
                            <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-xs border border-rose-300 print-badge">
                              ⚠️ {row.dueInfo.label}
                            </span>
                          )}
                          {row.dueInfo.status === 'DUE_TODAY' && (
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs border border-blue-300 print-badge">
                              🔔 يستحق اليوم
                            </span>
                          )}
                          {row.dueInfo.status === 'UPCOMING' && (
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-xs border border-amber-300 print-badge">
                              ⏳ باقي {row.dueInfo.daysRemaining} أيام
                            </span>
                          )}
                          {row.dueInfo.status === 'FUTURE' && (
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] border border-slate-300">
                              باقي {row.dueInfo.daysRemaining} يوم
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="p-2 border-l border-slate-300 font-bold">
                          <p className="text-slate-950 font-black">
                            {formatNumber(row.amountIQD)} د.ع
                          </p>
                          <p className="text-[10px] text-slate-500 font-normal">
                            المتبقي الكلي: {formatNumber(row.borrowerRemainingDebt)} د.ع
                          </p>
                        </td>

                        {/* Collector Check-off Field */}
                        <td className="p-2 text-xs">
                          <div className="space-y-1 text-[10px] text-slate-700">
                            <div className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-slate-400 inline-block rounded-sm"></span>
                              <span>تم الاتصال و وعد بالسداد</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-slate-400 inline-block rounded-sm"></span>
                              <span>لم يرد / مغلق</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-slate-400 inline-block rounded-sm"></span>
                              <span>تم التحويل للكفيل</span>
                            </div>
                            <div className="pt-1 text-[9px] text-slate-500 border-t border-dotted border-slate-300">
                              تاريخ الوعد: .........................
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Printable Signatures Footer */}
            <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-6 text-center text-xs">
              <div>
                <p className="font-bold text-slate-800">توقيع المحصل الميداني</p>
                <p className="text-[11px] text-slate-500 mt-1">المستلم للكشف</p>
                <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
              </div>
              <div>
                <p className="font-bold text-slate-800">مسؤول قسم التحصيل والمتابعة</p>
                <p className="text-[11px] text-slate-500 mt-1">المصادق على الكشف</p>
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
