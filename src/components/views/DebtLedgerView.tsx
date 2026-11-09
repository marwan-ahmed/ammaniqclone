'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpenCheck,
  Plus,
  Search,
  Users,
  Wallet,
  CheckCircle2,
  Coins,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Lock,
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { formatNumber } from '@/utils/formatters';
import {
  DebtorAccount,
  DebtLedgerEntry,
  DebtorStatusFilter,
  DebtorSortBy,
  createDebtorAccount,
  filterAndSortDebtors,
  paginateItems,
} from '@/utils/debtLedger';
import { AddDebtorModal } from '@/components/views/AddDebtorModal';
import { DebtorTableSection } from '@/components/views/DebtorTableSection';

const STORAGE_KEY = 'aman_standalone_debt_ledger_v2';
const PAGE_SIZE = 10;

interface DebtLedgerViewProps {
  store?: SimulationStore;
  onPaySchedule?: unknown;
  onAddDirectDebt?: unknown;
  onLock?: () => void;
}

export const DebtLedgerView: React.FC<DebtLedgerViewProps> = ({ onLock }) => {
  const [accounts, setAccounts] = useState<DebtorAccount[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as DebtorAccount[];
        if (Array.isArray(parsed)) {
          return parsed.map((acc) =>
            createDebtorAccount({
              id: acc.id,
              debtorName: acc.debtorName,
              entries: acc.entries,
              createdAt: acc.createdAt,
            })
          );
        }
      }
    } catch {
      // Ignore invalid cache
    }
    return [];
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DebtorStatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<DebtorSortBy>('HIGHEST_REMAINING');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveToLocalCache = (list: DebtorAccount[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Ignore storage quota errors
    }
  };

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/direct-debts', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { success?: boolean; data?: DebtorAccount[] };
        if (json.success && Array.isArray(json.data)) {
          setAccounts(json.data);
          saveToLocalCache(json.data);
        }
      } catch {
        // Fallback to cached accounts when offline
      }
    };
    fetchAccounts();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddDebtor = async (debtorName: string, entries: DebtLedgerEntry[]) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/direct-debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtorName, entries }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: DebtorAccount;
      };
      const saved =
        json.success && json.data ? json.data : createDebtorAccount({ debtorName, entries });

      setAccounts((prev) => {
        const next = [saved, ...prev];
        saveToLocalCache(next);
        return next;
      });
      setExpandedIds((prev) => ({ ...prev, [saved.id]: true }));
      setIsAddModalOpen(false);
      showToast(json.message || `تم فتح حساب المدين (${debtorName}) بنجاح`);
    } catch {
      const localAcc = createDebtorAccount({ debtorName, entries });
      setAccounts((prev) => {
        const next = [localAcc, ...prev];
        saveToLocalCache(next);
        return next;
      });
      setExpandedIds((prev) => ({ ...prev, [localAcc.id]: true }));
      setIsAddModalOpen(false);
      showToast(`تم حفظ حساب المدين (${debtorName}) محلياً`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAccount = async (
    id: string,
    debtorName: string,
    entries: DebtLedgerEntry[]
  ) => {
    const updatedLocal = createDebtorAccount({ id, debtorName, entries });
    setAccounts((prev) => {
      const next = prev.map((acc) => (acc.id === id ? updatedLocal : acc));
      saveToLocalCache(next);
      return next;
    });

    try {
      const res = await fetch('/api/direct-debts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, debtorName, entries }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      showToast(json.message || `تم حفظ تعديلات جدول (${debtorName})`);
    } catch {
      showToast(`تم حفظ تعديلات جدول (${debtorName}) محلياً`);
    }
  };

  const handleDeleteAccount = async (id: string, debtorName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب المدين (${debtorName}) من دفتر الديون؟`)) {
      return;
    }
    setAccounts((prev) => {
      const next = prev.filter((acc) => acc.id !== id);
      saveToLocalCache(next);
      return next;
    });
    try {
      await fetch(`/api/direct-debts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      showToast(`تم حذف حساب المدين (${debtorName})`);
    } catch {
      showToast(`تم حذف حساب المدين (${debtorName}) محلياً`);
    }
  };

  const summary = useMemo(() => {
    let totalDebt = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let settledCount = 0;
    for (const acc of accounts) {
      totalDebt += acc.totalDebt;
      totalPaid += acc.totalPaid;
      totalRemaining += acc.totalRemaining;
      if (acc.totalRemaining > 0) activeCount++;
      else settledCount++;
    }
    return {
      debtorsCount: accounts.length,
      activeCount,
      settledCount,
      totalDebt,
      totalPaid,
      totalRemaining,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(
    () => filterAndSortDebtors(accounts, { searchTerm, statusFilter, sortBy }),
    [accounts, searchTerm, statusFilter, sortBy]
  );

  const { pagedItems, totalPages, currentPage: safePage } = useMemo(
    () => paginateItems(filteredAccounts, currentPage, PAGE_SIZE),
    [filteredAccounts, currentPage]
  );

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-emerald-600/30 flex items-center gap-3 border border-emerald-400/30">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ترويسة دفتر الديون المستقل */}
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">دفتر الديون</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                سجل خارجي مستقل
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              سجل حسابات المدينين الخارجيين ومتابعة المبالغ المسددة والمتبقية بذمتهم (مفصول تماماً عن النظام)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {onLock && (
            <button
              type="button"
              onClick={onLock}
              className="px-3.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700/80 flex items-center gap-2 transition-colors cursor-pointer"
              title="قفل دفتر الديون الآن وإعادة طلب كلمة المرور"
            >
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>قفل الدفتر</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة</span>
          </button>
        </div>
      </div>

      {/* ملخص إحصائيات دفتر الديون الخارجي */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">عدد المدينين</p>
            <p className="text-xl font-bold font-mono text-white mt-1">{summary.debtorsCount}</p>
          </div>
          <Users className="w-8 h-8 text-slate-600" />
        </div>
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">إجمالي الديون</p>
            <p className="text-xl font-bold font-mono text-white mt-1">
              {formatNumber(summary.totalDebt)} <span className="text-xs text-slate-400">د.ع</span>
            </p>
          </div>
          <Wallet className="w-8 h-8 text-blue-400/70" />
        </div>
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">إجمالي المبالغ المسددة</p>
            <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {formatNumber(summary.totalPaid)} <span className="text-xs">د.ع</span>
            </p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400/70" />
        </div>
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">إجمالي المتبقي بذمتهم</p>
            <p className="text-xl font-bold font-mono text-amber-400 mt-1">
              {formatNumber(summary.totalRemaining)} <span className="text-xs">د.ع</span>
            </p>
          </div>
          <Coins className="w-8 h-8 text-amber-400/70" />
        </div>
      </div>

      {/* شريط الفلترة والترتيب والبحث وقائمة المدينين */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              الكل ({summary.debtorsCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ACTIVE');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              بذمتهم ديون ({summary.activeCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('SETTLED');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                statusFilter === 'SETTLED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              مسدد بالكامل ({summary.settledCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as DebtorSortBy)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none"
              >
                <option value="HIGHEST_REMAINING" className="bg-slate-900">الأعلى متبقياً</option>
                <option value="RECENT" className="bg-slate-900">الأحدث حركة</option>
                <option value="NAME" className="bg-slate-900">الاسم أبجدياً</option>
              </select>
            </div>

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث باسم المدين أو الملاحظات..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pr-10 pl-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {pagedItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <BookOpenCheck className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">لا توجد حسابات مطابقة للبحث أو الفلتر</p>
            <p className="text-xs text-slate-500">
              اضغط على زر &quot;إضافة&quot; في الأعلى لفتح حساب مدين جديد وإدخال جدول ديونه
            </p>
          </div>
        ) : (
          <div>
            {pagedItems.map((acc) => (
              <DebtorTableSection
                key={acc.id}
                account={acc}
                isExpanded={Boolean(expandedIds[acc.id])}
                onToggleExpand={() => toggleExpand(acc.id)}
                onUpdateAccount={handleUpdateAccount}
                onDeleteAccount={handleDeleteAccount}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono">
              صفحة {safePage} من {totalPages} (إجمالي {filteredAccounts.length} مدين)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AddDebtorModal
        isOpen={isAddModalOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddDebtor}
      />
    </div>
  );
};
