'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingDown,
  Plus,
  Building2,
  Calendar,
  Tag,
  Search,
  Filter,
  Wallet,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  Receipt,
  UserCheck,
  Edit2,
  Trash2,
  Sparkles,
  DollarSign,
  Loader2
} from 'lucide-react';
import { SecurityConfirmationModal } from '@/components/common/SecurityConfirmationModal';
import { SimulationStore } from '@/services/simulation';
import { DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';
import { ExpenseItem } from '@/types/finance';
import { formatNumber, toEnglishDigits } from '@/utils/formatters';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';

interface ExpensesViewProps {
  store: SimulationStore;
  onAddExpense?: (data: {
    title: string;
    category: 'رواتب' | 'إيجارات' | 'تسويق' | 'مصاريف نقل ولوجستيك' | 'صيانة' | 'نثريات' | 'أجهزة ومعدات' | 'رسوم حكومية وإدارية' | 'أخرى';
    amountIQD: number;
    paidFromWalletId: string;
    recipientName?: string;
    referenceNo?: string;
    date?: string;
    notes?: string;
  }) => any;
  onEditExpense?: (
    expenseId: string,
    data: {
      title: string;
      category: 'رواتب' | 'إيجارات' | 'تسويق' | 'مصاريف نقل ولوجستيك' | 'صيانة' | 'نثريات' | 'أجهزة ومعدات' | 'رسوم حكومية وإدارية' | 'أخرى';
      amountIQD: number;
      paidFromWalletId: string;
      recipientName?: string;
      referenceNo?: string;
      date?: string;
      notes?: string;
    }
  ) => any;
  onDeleteExpense?: (expenseId: string) => any;
}

type ExpenseCategory = 'رواتب' | 'إيجارات' | 'تسويق' | 'مصاريف نقل ولوجستيك' | 'صيانة' | 'نثريات' | 'أجهزة ومعدات' | 'رسوم حكومية وإدارية' | 'أخرى';

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  store,
  onAddExpense,
  onEditExpense,
  onDeleteExpense
}) => {
  const profile = store.companyProfile || DEFAULT_COMPANY_REPORT_PROFILE;
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
  const [selectedExpenseForReceipt, setSelectedExpenseForReceipt] = useState<ExpenseItem | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [walletFilter, setWalletFilter] = useState<string>('ALL');

  // Form states for expense
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('نثريات');
  const [amountIQD, setAmountIQD] = useState<string>('');
  const [paidFromWalletId, setPaidFromWalletId] = useState<string>(store.companyWallet.id || 'wallet-company');
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState<string>('');

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteStatusMessage, setDeleteStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setSelectedExpenseForReceipt(null);
      }
    };
    if (showAddModal || selectedExpenseForReceipt) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showAddModal, selectedExpenseForReceipt]);

  // Available wallets list
  const availableWallets = useMemo(() => {
    return store.wallets || [];
  }, [store.wallets]);

  // Selected wallet balance
  const selectedWallet = useMemo(() => {
    return availableWallets.find((w) => w.id === paidFromWalletId) || store.companyWallet;
  }, [availableWallets, paidFromWalletId, store.companyWallet]);

  // Calculated Stats
  const totalExpensesAmount = useMemo(() => {
    return store.expenses.reduce((acc, exp) => acc + exp.amountIQD, 0);
  }, [store.expenses]);

  const expensesCount = store.expenses.length;

  const topCategory = useMemo(() => {
    if (store.expenses.length === 0) return 'لا يوجد';
    const catTotals: Record<string, number> = {};
    store.expenses.forEach((exp) => {
      catTotals[exp.category] = (catTotals[exp.category] || 0) + exp.amountIQD;
    });
    let maxCat = '';
    let maxAmt = 0;
    Object.entries(catTotals).forEach(([cat, amt]) => {
      if (amt > maxAmt) {
        maxAmt = amt;
        maxCat = cat;
      }
    });
    return maxCat ? `${maxCat} (${formatNumber(maxAmt)} د.ع)` : 'لا يوجد';
  }, [store.expenses]);

  // Filtered Expenses List
  const filteredExpenses = useMemo(() => {
    return store.expenses.filter((exp) => {
      const matchSearch =
        !searchTerm.trim() ||
        exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (exp.recipientName && exp.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (exp.referenceNo && exp.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = categoryFilter === 'ALL' || exp.category === categoryFilter;
      const matchWallet = walletFilter === 'ALL' || exp.paidFromWalletId === walletFilter;

      return matchSearch && matchCategory && matchWallet;
    });
  }, [store.expenses, searchTerm, categoryFilter, walletFilter]);

  // Open add Modal
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setEditingExpenseId(null);
    setTitle('');
    setCategory('نثريات');
    setAmountIQD('');
    setPaidFromWalletId(store.companyWallet.id || 'wallet-company');
    setRecipientName('');
    setNotes('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setReferenceNo(`EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setStatusMessage(null);
    setShowAddModal(true);
  };

  // Open edit Modal
  const handleOpenEditModal = (exp: ExpenseItem) => {
    setIsEditMode(true);
    setEditingExpenseId(exp.id);
    setTitle(exp.title);
    setCategory(exp.category);
    setAmountIQD(exp.amountIQD.toString());
    setPaidFromWalletId(exp.paidFromWalletId);
    setRecipientName(exp.recipientName || '');
    setNotes(exp.notes || '');
    setExpenseDate(exp.date);
    setReferenceNo(exp.referenceNo || '');
    setStatusMessage(null);
    setShowAddModal(true);
  };

  // Open delete Modal
  const handleOpenDeleteModal = (exp: ExpenseItem) => {
    setExpenseToDelete(exp);
    setDeleteStatusMessage(null);
    setShowDeleteConfirmModal(true);
  };

  // Confirm delete submission with password security check
  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;

    let result;
    if (onDeleteExpense) {
      result = await onDeleteExpense(expenseToDelete.id);
    } else {
      result = store.deleteExpense(expenseToDelete.id);
    }

    if (result && result.success) {
      setShowDeleteConfirmModal(false);
      setExpenseToDelete(null);
    } else if (result && !result.success) {
      throw new Error(result.message || 'تعذر نقل المصروف لسلة المهملات');
    }
  };

  // Handle Add / Edit Submission
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const numericAmount = parseFloat(amountIQD);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال مبلغ صحيح أكبر من صفر د.ع' });
      return;
    }

    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال عنوان أو بيان المصروف (ولأجل ماذا)' });
      return;
    }

    if (!selectedWallet) {
      setStatusMessage({ type: 'error', text: 'يرجى تحديد الصندوق/المحفظة المراد الصرف منها' });
      return;
    }

    // Check balance if adding a new one, or if increasing the amount of an existing one on the same wallet
    // or if transferring to a different wallet. The check inside SimulationStore handles this precisely,
    // but we can give a descriptive validation on the client.
    if (isEditMode && editingExpenseId) {
      const originalExpense = store.expenses.find(e => e.id === editingExpenseId);
      if (originalExpense) {
        if (originalExpense.paidFromWalletId === paidFromWalletId) {
          const diff = numericAmount - originalExpense.amountIQD;
          if (diff > 0 && selectedWallet.balance < diff) {
            setStatusMessage({
              type: 'error',
              text: `السيولة المتاحة لا تكفي لتغطية فارق الزيادة بقيمة ${formatNumber(diff)} د.ع`
            });
            return;
          }
        } else {
          if (selectedWallet.balance < numericAmount) {
            setStatusMessage({
              type: 'error',
              text: `السيولة في الصندوق المختار لا تكفي لتغطية مبلغ المصروف بالكامل`
            });
            return;
          }
        }
      }
    } else {
      if (selectedWallet.balance < numericAmount) {
        setStatusMessage({
          type: 'error',
          text: `السيولة المتاحة في ${selectedWallet.ownerName} (${formatNumber(selectedWallet.balance)} د.ع) لا تكفي لتغطية المصروف بقيمة ${formatNumber(numericAmount)} د.ع`
        });
        return;
      }
    }

    const payload = {
      title: title.trim(),
      category,
      amountIQD: numericAmount,
      paidFromWalletId: selectedWallet.id,
      recipientName: recipientName.trim() || undefined,
      referenceNo: referenceNo.trim() || undefined,
      date: expenseDate,
      notes: notes.trim() || undefined
    };

    setIsSubmittingExpense(true);
    try {
      let result;
      if (isEditMode && editingExpenseId) {
        if (onEditExpense) {
          result = await onEditExpense(editingExpenseId, payload);
        } else {
          result = store.editExpense(editingExpenseId, payload);
        }
      } else {
        if (onAddExpense) {
          result = await onAddExpense(payload);
        } else {
          result = store.addExpense(payload);
        }
      }

      if (result.success) {
        setStatusMessage({ type: 'success', text: result.message });
        // Reset form fields
        setTitle('');
        setAmountIQD('');
        setNotes('');
        setRecipientName('');
        setReferenceNo('');

        setTimeout(() => {
          setShowAddModal(false);
          setStatusMessage(null);
        }, 1200);
      } else {
        setStatusMessage({ type: 'error', text: result.message });
      }
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-40 h-40 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-rose-400/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-inner">
            <TrendingDown className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">إدارة المصروفات التشغيلية للشركة</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-semibold border border-rose-500/20">
                سامراء - صلاح الدين
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تسجيل وتتبع مصاريف الشركة والنثريات والرواتب مع تحديد <span className="text-rose-300 font-semibold">من أين يتم الصرف</span> و <span className="text-amber-300 font-semibold">ولأجل ماذا</span> بكل دقة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <PrivacyToggleButton />
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-rose-500/20 active:scale-95 shrink-0"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>تسجيل مصروف جديد</span>
          </button>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses Card */}
        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">إجمالي المصروفات التشغيلية</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400">
            {formatNumber(totalExpensesAmount)} <span className="text-xs font-normal text-slate-400">د.ع</span>
          </p>
          <p className="text-[11px] text-slate-500">من واقع {expensesCount} سند صرف مسجل في النظام</p>
        </div>

        {/* Top Expense Category Card */}
        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">أعلى بند إنفاقاً</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-amber-300 truncate">{topCategory}</p>
          <p className="text-[11px] text-slate-500">حسب إحصائيات الدورة المالية الحالية</p>
        </div>

        {/* Company Main Wallet Balance */}
        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">رصيد صندوق أمان الرئيسي</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {formatNumber(store.companyWallet.balance)} <span className="text-xs font-normal text-slate-400">د.ع</span>
          </p>
          <p className="text-[11px] text-slate-500">السيولة المتاحة للخصم المباشر</p>
        </div>

        {/* Active Funding Sources */}
        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">عدد الصناديق والمحافظ المتاحة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-400">
            {availableWallets.length} <span className="text-xs font-normal text-slate-400">صناديق نقدية</span>
          </p>
          <p className="text-[11px] text-slate-500">شاملة صندوق الشركة وحسابات المستثمرين</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="ابحث بعنوان المصروف، البيان، اسم المستلم، أو رقم السند..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter & Privacy */}
        <div className="flex items-center gap-2">
          <PrivacyToggleButton variant="compact" />
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-rose-400" />
            <span>التصنيف:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-slate-900 text-white">كافة التصنيفات</option>
              <option value="رواتب" className="bg-slate-900 text-white">رواتب موظفين</option>
              <option value="إيجارات" className="bg-slate-900 text-white">إيجارات المقار</option>
              <option value="تسويق" className="bg-slate-900 text-white">تسويق وإعلانات</option>
              <option value="مصاريف نقل ولوجستيك" className="bg-slate-900 text-white">نقل ولوجستيك</option>
              <option value="صيانة" className="bg-slate-900 text-white">صيانة تشغيلية</option>
              <option value="نثريات" className="bg-slate-900 text-white">نثريات وضيافة</option>
              <option value="أجهزة ومعدات" className="bg-slate-900 text-white">أجهزة ومعدات</option>
              <option value="رسوم حكومية وإدارية" className="bg-slate-900 text-white">رسوم حكومية وإدارية</option>
              <option value="أخرى" className="bg-slate-900 text-white">مصاريف أخرى</option>
            </select>
          </div>

          {/* Wallet Source Filter */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>جهة الصرف:</span>
            <select
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-slate-900 text-white">كافة الصناديق</option>
              {availableWallets.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                  {w.ownerName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table & Cards List */}
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-rose-400" />
            <h2 className="font-bold text-white text-base">سندات المصروفات المسجلة</h2>
            <span className="px-3 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
              {filteredExpenses.length} مصروف
            </span>
          </div>

          {(searchTerm || categoryFilter !== 'ALL' || walletFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('ALL');
                setWalletFilter('ALL');
              }}
              className="text-xs text-rose-400 hover:underline flex items-center gap-1"
            >
              <span>إعادة ضبط التصفية</span>
            </button>
          )}
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <TrendingDown className="w-6 h-6" />
            </div>
            <p className="text-slate-400 text-sm font-medium">لا توجد مصروفات تشغيلية مطابقة لشروط البحث والتصفية</p>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold transition-all"
            >
              تسجيل مصروف جديد الآن
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((exp) => {
              const walletSource = availableWallets.find((w) => w.id === exp.paidFromWalletId);
              const walletName = exp.paidFromWalletName || walletSource?.ownerName || 'صندوق أمان الرئيسي';

              return (
                <div
                  key={exp.id}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs group"
                >
                  {/* Icon & Expense Details */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                      <TrendingDown className="w-5.5 h-5.5" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{exp.title}</span>
                        {exp.referenceNo && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono border border-slate-700/60">
                            {exp.referenceNo}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-semibold">
                          {exp.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                        {/* Source Wallet (من أين الصرف) */}
                        <div className="flex items-center gap-1 text-emerald-400 font-medium">
                          <Wallet className="w-3.5 h-3.5" />
                          <span>جهة الصرف:</span>
                          <span className="font-bold text-white">{walletName}</span>
                        </div>

                        {/* Recipient */}
                        {exp.recipientName && (
                          <div className="flex items-center gap-1 text-slate-300">
                            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                            <span>المستلم:</span>
                            <PrivacyMaskedText id={`exp-recip-${exp.id}`} text={exp.recipientName} as="span" className="font-semibold text-slate-200" />
                          </div>
                        )}

                        {/* Date */}
                        <div className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>التاريخ: {exp.date}</span>
                        </div>
                      </div>

                      {/* Notes / Purpose */}
                      {exp.notes && (
                        <p className="text-slate-400 text-[11px] bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800/60 mt-1">
                          <span className="text-amber-400/90 font-medium">السبب والتفاصيل (ولأجل ماذا): </span>
                          {exp.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Amount and Actions (Edit, Delete, Print Slip) */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2.5 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800/80 shrink-0">
                    <div className="text-left font-black text-rose-400 text-lg">
                      -<PrivacyMaskedAmount id={`exp-amt-${exp.id}`} value={exp.amountIQD} label={`مصروف: ${exp.title}`} size="sm" className="text-rose-400" />
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Print Voucher */}
                      <button
                        onClick={() => setSelectedExpenseForReceipt(exp)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition-all hover:text-white"
                        title="معاينة سند الصرف"
                      >
                        <Receipt className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden sm:inline">سند</span>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEditModal(exp)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-bold border border-blue-500/20 transition-all"
                        title="تعديل السند"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">تعديل</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleOpenDeleteModal(exp)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold border border-rose-500/20 transition-all"
                        title="حذف القيد"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">حذف</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Register / Edit Expense (تسجيل / تعديل مصروف) */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-rose-950/50 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold border border-rose-500/30">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">
                    {isEditMode ? 'تعديل السند والمصروف التشغيلي' : 'تسجيل مصروف تشغيلي جديد'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isEditMode 
                      ? 'قم بتحديث البيانات المطلوبة وسيتم تسوية الحساب المالي في الصناديق فورياً' 
                      : 'حدد جهة الصرف وسبب الصرف بدقة وسيتم الخصم والتدقيق تلقائياً'
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Alert Message inside modal */}
            {statusMessage && (
              <div
                className={`mx-6 mt-4 p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitExpense} className="p-6 space-y-5 text-xs">
              {/* SECTION 1: من أين سيتم الصرف؟ (Source Wallet Selection) */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                    <Wallet className="w-4 h-4" />
                    <span>1. من أين سيتم الصرف؟ (جهة الصرف / الصندوق المالي) *</span>
                  </label>
                  <span className="text-[11px] text-slate-400">تغذية وخصم مباشر</span>
                </div>

                <select
                  value={paidFromWalletId}
                  onChange={(e) => setPaidFromWalletId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                >
                  {availableWallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.ownerName} (السيولة المتاحة: {formatNumber(wallet.balance)} د.ع)
                    </option>
                  ))}
                </select>

                {/* Selected Wallet Balance Preview */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px]">
                  <span className="text-slate-400">الرصيد والسيولة المتاحة للخصم بالصندوق المختار:</span>
                  <span className="font-black text-emerald-400 text-sm">
                    {formatNumber(selectedWallet?.balance)} د.ع
                  </span>
                </div>
              </div>

              {/* SECTION 2: ولأجل ماذا؟ (Expense Purpose & Category) */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <label className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                  <Tag className="w-4 h-4" />
                  <span>2. ولأجل ماذا؟ (سبب وتصنيف المصروف والبيان) *</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Category Selection */}
                  <div className="space-y-1.5">
                    <span className="text-slate-300 font-medium">التصنيف التشغيلي الرئيسي:</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-amber-500 transition-colors"
                    >
                      <option value="رواتب">رواتب موظفين كادر الشركة</option>
                      <option value="إيجارات">إيجارات المقار والمكاتب</option>
                      <option value="تسويق">تسويق وإعلانات تجارية</option>
                      <option value="مصاريف نقل ولوجستيك">مصاريف نقل وتوصيل ولوجستيك</option>
                      <option value="صيانة">صيانة وتحديث تشغيلي</option>
                      <option value="نثريات">نثريات وضيافة المكاتب</option>
                      <option value="أجهزة ومعدات">أجهزة ومعدات جديدة</option>
                      <option value="رسوم حكومية وإدارية">رسوم حكومية وتدقيق إداري</option>
                      <option value="أخرى">أخرى (مصاريف عامة وغير تصنيفية)</option>
                    </select>
                  </div>

                  {/* Title / Main Purpose */}
                  <div className="space-y-1.5">
                    <span className="text-slate-300 font-medium">عنوان / سبب المصروف (بيان مختصر): *</span>
                    <input
                      type="text"
                      placeholder="مثال: دفع إيجار مقر الشركة الرئيسي لشهر شباط"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 font-medium text-xs focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Recipient Name */}
                <div className="space-y-1.5">
                  <span className="text-slate-300 font-medium">اسم المستلم / الجهة المستفيدة (اختياري):</span>
                  <input
                    type="text"
                    placeholder="مثال: صاحب العقار (حسام السامري)، محطة الوقود، شركة الاتصالات..."
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 font-medium text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Detailed Purpose Notes */}
                <div className="space-y-1.5">
                  <span className="text-slate-300 font-medium">التفاصيل والنثريات ولأجل ماذا (ملاحظات تفصيلية):</span>
                  <textarea
                    rows={2}
                    placeholder="اكتب هنا تفاصيل الفاتورة أو الأسباب النثرية مثل: شراء وقود للسيارات + ضيافة الوفد الزائر..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 font-medium text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* SECTION 3: القيم المالية والسند (Amount, Date & Reference) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Amount IQD */}
                <div className="space-y-1.5">
                  <label className="font-bold text-rose-400 text-[11px]">المبلغ (دينار عراقي) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="مثال: 500000"
                      value={amountIQD}
                      onChange={(e) => setAmountIQD(e.target.value)}
                      className="w-full p-3 pr-4 pl-12 rounded-xl bg-slate-950 border border-slate-700 text-rose-400 font-black text-sm focus:outline-none focus:border-rose-500 transition-colors"
                      required
                      min="1"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">د.ع</span>
                  </div>
                </div>

                {/* Date */}
                <DocumentDateField
                  value={expenseDate}
                  onChange={setExpenseDate}
                  label="تاريخ سند الصرف *"
                  helpText="تاريخ تحرير السند وصرف المصروف (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
                />

                {/* Reference Number */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 text-[11px]">رقم سند الصرف *</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 font-mono text-xs focus:outline-none focus:border-slate-500 transition-colors"
                    required
                    disabled={isEditMode} // Reference number shouldn't be edited to keep ledger sync
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmittingExpense}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-rose-500/20 active:scale-95"
                >
                  {isSubmittingExpense ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>جاري تسجيل المصروف...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isEditMode ? 'حفظ التعديلات' : 'تأكيد وتسجيل المصروف'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Delete Confirmation (تأكيد الحذف وإعادة الشحن) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: Security Protected Delete Confirmation (نقل لسلة المهملات بكلمة سر) */}
      {/* ========================================================================= */}
      <SecurityConfirmationModal
        isOpen={showDeleteConfirmModal && !!expenseToDelete}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setExpenseToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="تأكيد نقل المصروف إلى سلة المهملات"
        subtitle="سيتم نقل سند الصرف لسلة المهملات وإرجاع مبلغ السيولة تلقائياً إلى الصندوق"
        itemName={expenseToDelete ? `${expenseToDelete.title} (${expenseToDelete.referenceNo})` : undefined}
        itemDetails={expenseToDelete ? `المبلغ: ${formatNumber(expenseToDelete.amountIQD)} د.ع | سيتم إرجاعها إلى: ${expenseToDelete.paidFromWalletName || 'الصندوق'}` : undefined}
        actionType="TRASH"
        confirmButtonText="تأكيد ونقل لسلة المهملات"
      />

      {/* ========================================================================= */}
      {/* MODAL: Printable Receipt Voucher Slip (معاينة سند الصرف) */}
      {/* ========================================================================= */}
      {selectedExpenseForReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-8 print:shadow-none print:m-0 print:w-full">
            {/* Slip Header Action Bar (Hidden in print) */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-400" />
                <span className="font-bold text-sm">سند صرف تشغيلي رسمي</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة السند</span>
                </button>
                <button
                  onClick={() => setSelectedExpenseForReceipt(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Slip Printable Body */}
            <div className="p-8 space-y-6 text-right font-sans dir-rtl">
              {/* Header Company Info */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{profile.companyName}</h2>
                  <p className="text-xs text-slate-600 font-medium">{profile.companyAddress}</p>
                  <p className="text-[11px] text-slate-500">{profile.companyActivity}</p>
                </div>
                <div className="text-left">
                  <div className="px-3 py-1 bg-rose-100 text-rose-900 font-bold text-xs rounded-lg border border-rose-300">
                    سند صرف
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                    {selectedExpenseForReceipt.referenceNo || 'EXP-2026-000'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">تاريخ الصرف: {selectedExpenseForReceipt.date}</p>
                </div>
              </div>

              {/* Amount Highlight */}
              <div className="bg-slate-100 p-4 rounded-2xl border border-slate-300 flex items-center justify-between">
                <span className="font-bold text-slate-700 text-sm">مبلغ المصروف الصادر:</span>
                <span className="text-2xl font-black text-rose-700">
                  {formatNumber(selectedExpenseForReceipt.amountIQD)}{' '}
                  <span className="text-xs font-bold text-slate-600">دينار عراقي</span>
                </span>
              </div>

              {/* Expense Voucher Table Details */}
              <div className="space-y-3 text-xs text-slate-800">
                <div className="flex border-b border-slate-200 pb-2">
                  <span className="w-36 font-bold text-slate-500">من أين تم الصرف:</span>
                  <span className="font-bold text-emerald-800 text-sm">
                    {selectedExpenseForReceipt.paidFromWalletName || store.companyWallet.ownerName}
                  </span>
                </div>

                <div className="flex border-b border-slate-200 pb-2">
                  <span className="w-36 font-bold text-slate-500">التصنيف الرئيسي:</span>
                  <span className="font-bold text-slate-900">{selectedExpenseForReceipt.category}</span>
                </div>

                <div className="flex border-b border-slate-200 pb-2">
                  <span className="w-36 font-bold text-slate-500">عنوان / سبب المصروف:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedExpenseForReceipt.title}</span>
                </div>

                {selectedExpenseForReceipt.recipientName && (
                  <div className="flex border-b border-slate-200 pb-2">
                    <span className="w-36 font-bold text-slate-500">اسم المستلم:</span>
                    <span className="font-bold text-blue-900">{selectedExpenseForReceipt.recipientName}</span>
                  </div>
                )}

                {selectedExpenseForReceipt.notes && (
                  <div className="flex flex-col pt-1">
                    <span className="font-bold text-slate-500 mb-1">تفاصيل ولأجل ماذا (السبب الكامل):</span>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed font-medium">
                      {selectedExpenseForReceipt.notes}
                    </div>
                  </div>
                )}
              </div>

              {/* Signatures Block */}
              <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs text-slate-700 font-bold">
                <div>
                  <p>توقيع المستلم</p>
                  <div className="h-10 border-b border-dashed border-slate-400 mt-2" />
                </div>
                <div>
                  <p>توقيع المحاسب المنفذ</p>
                  <div className="h-10 border-b border-dashed border-slate-400 mt-2" />
                </div>
                <div>
                  <p>مصادقة مدير النظام ({profile.managerName || 'أحمد إياد'})</p>
                  <div className="h-10 border-b border-dashed border-slate-400 mt-2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
