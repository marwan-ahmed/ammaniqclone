'use client';

import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Printer,
  Search,
  Filter,
  Eye,
  EyeOff,
  Building2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle2,
  Receipt,
  FileText,
  DollarSign,
  Boxes,
  HelpCircle,
  Share2
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { LedgerTransaction } from '@/types/finance';
import { CompanyWithdrawalModal } from '@/components/common/CompanyWithdrawalModal';
import { formatTime, formatNumber } from '@/utils/formatters';
import { CompanyWithdrawalReceiptModal, CompanyWithdrawalReceiptData } from '@/components/common/CompanyWithdrawalReceiptModal';
import { DepositReceiptModal, DepositReceiptData } from '@/components/common/DepositReceiptModal';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { usePrivacy } from '@/context/PrivacyContext';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';

interface CompanyFundViewProps {
  store: SimulationStore;
  onWithdrawCompany?: (data: {
    amountIQD: number;
    recipientName: string;
    type: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
    notes?: string;
    receiptNo?: string;
    date?: string;
  }) => Promise<{ success: boolean; message: string }>;
  onDepositCapital?: (data: {
    walletId: string;
    amountIQD: number;
    notes?: string;
    date?: string;
  }) => Promise<{ success: boolean; message: string; receipt?: DepositReceiptData }>;
  setActiveTab?: (tab: any) => void;
}

type TxTypeFilter = 'ALL' | 'WITHDRAWAL' | 'DEPOSIT' | 'PAYMENT_RECEIVED' | 'REVENUE' | 'EXPENSE' | 'PURCHASE_INVENTORY';

export const CompanyFundView: React.FC<CompanyFundViewProps> = ({
  store,
  onWithdrawCompany,
  onDepositCapital,
  setActiveTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<TxTypeFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const { isPrivacyActive } = usePrivacy();

  // Withdrawal Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Voucher / Receipt Modals State
  const [selectedWithdrawReceipt, setSelectedWithdrawReceipt] = useState<CompanyWithdrawalReceiptData | null>(null);
  const [isWithdrawReceiptModalOpen, setIsWithdrawReceiptModalOpen] = useState(false);

  const [selectedDepositReceipt, setSelectedDepositReceipt] = useState<DepositReceiptData | null>(null);
  const [isDepositReceiptModalOpen, setIsDepositReceiptModalOpen] = useState(false);

  // Deposit Capital Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(5000000);
  const [depositNotes, setDepositNotes] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);

  // Notification Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const formatCurrency = (amount: number) => {
    if (isPrivacyActive) return '••••••••';
    return `${formatNumber(amount)} د.ع`;
  };

  const companyWallet = store.companyWallet;

  // Filter Company Fund Transactions
  const companyTransactions = useMemo(() => {
    return (store.transactions || []).filter((tx) => {
      // Must touch company wallet directly or represent company profit/fund
      const isFromCompany = tx.fromWalletId === companyWallet.id;
      const isToCompany = tx.toWalletId === companyWallet.id;
      const isCompanyFundProfit = (tx.companyProfitShareIQD || 0) > 0;
      const isDirectRevenue = tx.type === 'REVENUE' && isToCompany;

      return isFromCompany || isToCompany || isCompanyFundProfit || isDirectRevenue;
    });
  }, [store.transactions, companyWallet.id]);

  // Aggregate Metrics for Company Fund
  const metrics = useMemo(() => {
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalDirectRevenues = 0;
    let totalInstallmentProfits = 0;
    let totalExpensesPaid = 0;
    let totalPurchasesFinanced = 0;

    for (const tx of companyTransactions) {
      if (tx.type === 'DEPOSIT' && tx.toWalletId === companyWallet.id) {
        totalDeposited += tx.amountIQD;
      } else if (tx.type === 'WITHDRAWAL' && tx.fromWalletId === companyWallet.id) {
        totalWithdrawn += tx.amountIQD;
      } else if (tx.type === 'REVENUE' && tx.toWalletId === companyWallet.id) {
        totalDirectRevenues += tx.amountIQD;
      } else if (tx.type === 'PAYMENT_RECEIVED') {
        if (tx.toWalletId === companyWallet.id && !tx.investorProfitShareIQD) {
          // 100% company-owned contract payment
          totalInstallmentProfits += (tx.companyProfitShareIQD || 0);
        } else {
          totalInstallmentProfits += (tx.companyProfitShareIQD || 0);
        }
      } else if (tx.type === 'EXPENSE' && tx.fromWalletId === companyWallet.id) {
        totalExpensesPaid += tx.amountIQD;
      } else if (tx.type === 'PURCHASE_INVENTORY' && tx.fromWalletId === companyWallet.id) {
        totalPurchasesFinanced += tx.amountIQD;
      }
    }

    const netProfits = totalInstallmentProfits + totalDirectRevenues;

    return {
      currentBalance: companyWallet.balance,
      totalDeposited,
      totalWithdrawn,
      totalDirectRevenues,
      totalInstallmentProfits,
      netProfits,
      totalExpensesPaid,
      totalPurchasesFinanced
    };
  }, [companyTransactions, companyWallet.balance, companyWallet.id]);

  // Chronological Ledger with Running Balance
  const ledgerRowsWithRunningBalance = useMemo(() => {
    const sorted = [...companyTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let runningBal = 0;
    const enriched = sorted.map((tx) => {
      let isIncoming = false;
      let effectiveAmount = tx.amountIQD;

      if (tx.toWalletId === companyWallet.id) {
        isIncoming = true;
      } else if (tx.fromWalletId === companyWallet.id) {
        isIncoming = false;
      } else if ((tx.companyProfitShareIQD || 0) > 0) {
        isIncoming = true;
        effectiveAmount = tx.companyProfitShareIQD!;
      }

      if (isIncoming) {
        runningBal += effectiveAmount;
      } else {
        runningBal = Math.max(0, runningBal - effectiveAmount);
      }

      return {
        tx,
        isIncoming,
        effectiveAmount,
        runningBalanceAfter: runningBal
      };
    });

    // Reverse to show latest first
    return enriched.reverse();
  }, [companyTransactions, companyWallet.id]);

  // Filtered Rows for display
  const filteredLedgerRows = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    return ledgerRowsWithRunningBalance.filter(({ tx }) => {
      // Type Filter
      if (txTypeFilter !== 'ALL' && tx.type !== txTypeFilter) return false;

      // Date Filter
      if (dateFilter === 'TODAY' && tx.date !== today) return false;
      if (dateFilter === 'WEEK') {
        const txDate = new Date(tx.date);
        const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }
      if (dateFilter === 'MONTH') {
        const txDate = new Date(tx.date);
        const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = tx.referenceNo?.toLowerCase().includes(q);
        const matchDesc = tx.description?.toLowerCase().includes(q);
        const matchFrom = tx.fromWalletName?.toLowerCase().includes(q);
        const matchTo = tx.toWalletName?.toLowerCase().includes(q);
        return matchRef || matchDesc || matchFrom || matchTo;
      }

      return true;
    });
  }, [ledgerRowsWithRunningBalance, txTypeFilter, dateFilter, searchQuery]);

  // Handle Cash Withdrawal Submission
  const handleWithdrawalSubmit = async (data: {
    amountIQD: number;
    recipientName: string;
    type: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
    notes?: string;
    receiptNo?: string;
    date?: string;
  }) => {
    try {
      let result;
      if (onWithdrawCompany) {
        result = await onWithdrawCompany(data);
      } else {
        result = store.withdrawCompanyFunds(data);
      }

      if (result && result.success) {
        setIsWithdrawModalOpen(false);
        showNotification(result.message || 'تم صرف السند النقدي بنجاح', 'success');

        // Open Voucher Receipt Modal
        const prevBal = companyWallet.balance + data.amountIQD;
        const newBal = companyWallet.balance;
        setSelectedWithdrawReceipt({
          referenceNo: data.receiptNo || `WTH-COMP-${Date.now().toString().slice(-4)}`,
          date: data.date || new Date().toISOString().split('T')[0],
          time: formatTime(new Date(), { hour: '2-digit', minute: '2-digit' }),
          amountIQD: data.amountIQD,
          recipientName: data.recipientName,
          type: data.type,
          previousBalance: prevBal,
          newBalance: newBal,
          notes: data.notes,
          recordedBy: 'أحمد إياد (مدير النظام)'
        });
        setIsWithdrawReceiptModalOpen(true);
        return { success: true };
      } else {
        return { success: false, message: result?.message || 'تعذر إتمام عملية السحب' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'حدث خطأ أثناء الاتصال' };
    }
  };

  // Handle Deposit Capital Submission
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDeposit || depositAmount <= 0) return;

    setIsSubmittingDeposit(true);
    try {
      let result;
      if (onDepositCapital) {
        result = await onDepositCapital({
          walletId: companyWallet.id,
          amountIQD: Number(depositAmount),
          notes: depositNotes,
          date: depositDate
        });
      } else {
        result = store.depositCapital({
          walletId: companyWallet.id,
          amountIQD: Number(depositAmount),
          notes: depositNotes,
          date: depositDate
        });
      }

      if (result && result.success) {
        setIsDepositModalOpen(false);
        showNotification(result.message || 'تم إيداع رأس المال بنجاح', 'success');

        const prevBal = companyWallet.balance - depositAmount;
        setSelectedDepositReceipt({
          referenceNo: (result as any)?.receipt?.referenceNo || (result as any)?.transaction?.referenceNo || `DEP-${Date.now().toString().slice(-4)}`,
          date: (result as any)?.transaction?.date || depositDate || new Date().toISOString().split('T')[0],
          walletId: companyWallet.id,
          walletName: companyWallet.ownerName,
          ownerType: 'COMPANY',
          depositorName: 'إدارة شركة أمان (تغذية الخزينة المركزية)',
          amountIQD: depositAmount,
          previousBalance: prevBal,
          newBalance: companyWallet.balance,
          notes: depositNotes
        });
        setIsDepositReceiptModalOpen(true);
        setDepositNotes('');
        setDepositDate(new Date().toISOString().split('T')[0]);
      } else {
        showNotification(result?.message || 'تعذر إتمام الإيداع', 'error');
      }
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  // View Row Receipt Voucher
  const handleViewReceipt = (row: typeof filteredLedgerRows[0]) => {
    const tx = row.tx;
    if (tx.type === 'WITHDRAWAL') {
      const recipient = tx.toWalletName?.replace('المستلم نقداً: ', '') || 'إدارة الشركة نقداً';
      setSelectedWithdrawReceipt({
        referenceNo: tx.referenceNo,
        date: tx.date,
        amountIQD: tx.amountIQD,
        recipientName: recipient,
        type: tx.description?.includes('أرباح') ? 'PROFIT_WITHDRAWAL' : tx.description?.includes('رأس') ? 'CAPITAL_WITHDRAWAL' : 'GENERAL_WITHDRAWAL',
        previousBalance: row.runningBalanceAfter + tx.amountIQD,
        newBalance: row.runningBalanceAfter,
        notes: tx.description,
        recordedBy: 'أحمد إياد'
      });
      setIsWithdrawReceiptModalOpen(true);
    } else if (tx.type === 'DEPOSIT') {
      setSelectedDepositReceipt({
        referenceNo: tx.referenceNo,
        date: tx.date,
        walletId: companyWallet.id,
        walletName: companyWallet.ownerName,
        ownerType: 'COMPANY',
        depositorName: tx.fromWalletName || 'إيداع وتغذية الخزينة',
        amountIQD: tx.amountIQD,
        previousBalance: Math.max(0, row.runningBalanceAfter - tx.amountIQD),
        newBalance: row.runningBalanceAfter,
        notes: tx.description
      });
      setIsDepositReceiptModalOpen(true);
    }
  };

  return (
    <div className="space-y-7 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Banner / Hero Title */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-7 sm:p-8 border border-emerald-500/30 shadow-2xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Landmark className="w-3.5 h-3.5" />
              <span>الخزينة المركزية والمحفظة السيادية</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>صندوق نظام أمان الرئيسي</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
              إدارة حركة السيولة النقدية، السحب النقدي المباشر، الإيداعات الرأسمالية، ومتابعة عوائد أرباح التقسيط والرسوم الإدارية.
            </p>
          </div>

          {/* Quick Actions Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <PrivacyToggleButton />
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>سحب نقدي من الصندوق</span>
            </button>

            <button
              onClick={() => setIsDepositModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>تغذية وإيداع بالصندوق</span>
            </button>

            {setActiveTab && (
              <button
                onClick={() => setActiveTab('revenues')}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>تسجيل إيراد إداري</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
              title="طباعة كشف حساب الخزينة"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available Liquidity */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-2 border-emerald-500/40 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400">السيولة النقدية الحالية بالخزينة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            <PrivacyMaskedAmount id="comp-fund-current-balance" value={metrics.currentBalance} label="السيولة النقدية الحالية بالخزينة" size="lg" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            <span>رصيد نقدي جاهز للصرف</span>
            <span className="text-emerald-400 font-bold">100% سيولة</span>
          </div>
        </div>

        {/* Card 2: Total Withdrawn */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">إجمالي المسحوبات النقدية</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono tracking-tight">
            <PrivacyMaskedAmount id="comp-fund-total-withdrawn" value={metrics.totalWithdrawn} label="إجمالي المسحوبات النقدية" size="lg" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            <span>سحوبات أرباح ورأس مال</span>
            <button
              onClick={() => setTxTypeFilter('WITHDRAWAL')}
              className="text-amber-400 font-bold hover:underline cursor-pointer"
            >
              استعراض السندات
            </button>
          </div>
        </div>

        {/* Card 3: Total Capital Deposited */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400">إجمالي التغذية والإيداعات</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            <PrivacyMaskedAmount id="comp-fund-total-deposited" value={metrics.totalDeposited} label="إجمالي التغذية والإيداعات" size="lg" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            <span>تغذية رأس المال التأسيسي</span>
            <button
              onClick={() => setTxTypeFilter('DEPOSIT')}
              className="text-blue-400 font-bold hover:underline cursor-pointer"
            >
              استعراض الإيداعات
            </button>
          </div>
        </div>

        {/* Card 4: Net Profits Collected */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400">صافي أرباح وعمولات الشركة</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
            <PrivacyMaskedAmount id="comp-fund-net-profits" value={metrics.netProfits} label="صافي أرباح وعمولات الشركة" size="lg" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            <span>أقساط محصلة + إيرادات</span>
            <span className="text-slate-400">{metrics.totalDirectRevenues > 0 ? `+${formatNumber(metrics.totalDirectRevenues)} رسوم` : 'أرباح مباشرة'}</span>
          </div>
        </div>
      </div>

      {/* Comprehensive Ledger & Account Statement Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {/* Table Filter Controls Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">سجل القيود المحاسبية وكشف حساب الخزينة</h2>
              <p className="text-xs text-slate-400">عرض تفصيلي لكافة الحركات الدائنة والمدينة والرصيد اللحظي للصندوق</p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم السند أو البيان..."
                className="w-full px-3.5 py-2 pr-9 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-400 transition-all"
              />
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Type Filter */}
            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-emerald-400 transition-all"
            >
              <option value="ALL">جميع الحركات</option>
              <option value="WITHDRAWAL">مسحوبات نقدية (صرف)</option>
              <option value="DEPOSIT">إيداعات نقدية (قبض)</option>
              <option value="PAYMENT_RECEIVED">أرباح أقساط مقبوضة</option>
              <option value="REVENUE">إيرادات ورسوم إدارية</option>
              <option value="EXPENSE">مصاريف تشغيلية</option>
              <option value="PURCHASE_INVENTORY">تمويل بضائع المخزن</option>
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-emerald-400 transition-all"
            >
              <option value="ALL">كافة الفترات</option>
              <option value="TODAY">حركات اليوم</option>
              <option value="WEEK">آخر 7 أيام</option>
              <option value="MONTH">آخر 30 يوماً</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                <th className="p-4">رقم السند والتاريخ</th>
                <th className="p-4">نوع المعاملة</th>
                <th className="p-4">البيان والتفاصيل</th>
                <th className="p-4 text-emerald-400">وارد / تغذية (د.ع)</th>
                <th className="p-4 text-amber-400">صادر / صرف (د.ع)</th>
                <th className="p-4 text-white">الرصيد اللحظي</th>
                <th className="p-4 text-center">السند الرسمي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredLedgerRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <Receipt className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="text-sm font-semibold">لا توجد حركات أو قيود محاسبية مطابقة للبحث</p>
                  </td>
                </tr>
              ) : (
                filteredLedgerRows.map((row) => {
                  const tx = row.tx;
                  const isWithdrawal = tx.type === 'WITHDRAWAL';
                  const isDeposit = tx.type === 'DEPOSIT';
                  const isRevenue = tx.type === 'REVENUE';
                  const isPayment = tx.type === 'PAYMENT_RECEIVED';
                  const isExpense = tx.type === 'EXPENSE';
                  const isPurchase = tx.type === 'PURCHASE_INVENTORY';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Ref & Date */}
                      <td className="p-4">
                        <span className="font-mono font-bold text-white block">
                          {(tx.referenceNo || '—').replace(/-NEON-/gi, '-')}
                        </span>
                        <span className="text-[11px] text-slate-500">{tx.date}</span>
                      </td>

                      {/* Type Badge */}
                      <td className="p-4">
                        {isWithdrawal && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>سحب نقدي</span>
                          </span>
                        )}
                        {isDeposit && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>إيداع وتغذية</span>
                          </span>
                        )}
                        {isRevenue && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold">
                            <TrendingUp className="w-3 h-3" />
                            <span>إيراد مباشر</span>
                          </span>
                        )}
                        {isPayment && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold">
                            <Receipt className="w-3 h-3" />
                            <span>ربح قسط تقسيط</span>
                          </span>
                        )}
                        {isExpense && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-bold">
                            <TrendingDown className="w-3 h-3" />
                            <span>مصروف تشغيلي</span>
                          </span>
                        )}
                        {isPurchase && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[11px] font-bold">
                            <Boxes className="w-3 h-3" />
                            <span>شراء بضاعة للمخزن</span>
                          </span>
                        )}
                      </td>

                      {/* Description & Party */}
                      <td className="p-4 max-w-xs sm:max-w-md">
                        <PrivacyMaskedText
                          id={`comp-desc-${tx.id}`}
                          text={(tx.description || '')
                            .replace(/\s*في\s*Neon\s*DB/gi, '')
                            .replace(/Neon\s*DB/gi, 'النظام')}
                          as="span"
                          className="text-slate-200 block text-xs font-semibold"
                        />
                        {tx.toWalletName && (
                          <PrivacyMaskedText id={`comp-towallet-${tx.id}`} text={`إلى: ${tx.toWalletName}`} as="span" className="text-[11px] text-slate-500 block truncate" />
                        )}
                      </td>

                      {/* Inflow (Credit) */}
                      <td className="p-4 font-mono font-bold text-emerald-400 text-sm">
                        {row.isIncoming ? (
                          <PrivacyMaskedAmount id={`comp-fund-credit-${tx.id}`} value={row.effectiveAmount} label={`وارد: ${tx.description}`} size="xs" />
                        ) : '—'}
                      </td>

                      {/* Outflow (Debit) */}
                      <td className="p-4 font-mono font-bold text-amber-400 text-sm">
                        {!row.isIncoming ? (
                          <PrivacyMaskedAmount id={`comp-fund-debit-${tx.id}`} value={row.effectiveAmount} label={`صادر: ${tx.description}`} size="xs" />
                        ) : '—'}
                      </td>

                      {/* Running Balance */}
                      <td className="p-4 font-mono font-black text-slate-200">
                        <PrivacyMaskedAmount id={`comp-fund-bal-${tx.id}`} value={row.runningBalanceAfter} label={`الرصيد اللحظي: ${tx.referenceNo || tx.id}`} size="xs" />
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        {(isWithdrawal || isDeposit) ? (
                          <button
                            onClick={() => handleViewReceipt(row)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            title="معاينة وطباعة السند الرسمي"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                            <span>سند</span>
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Withdrawal Modal */}
      <CompanyWithdrawalModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        companyBalance={companyWallet.balance}
        onSubmitWithdrawal={handleWithdrawalSubmit}
      />

      {/* Official Withdrawal Voucher Receipt Modal */}
      <CompanyWithdrawalReceiptModal
        isOpen={isWithdrawReceiptModalOpen}
        onClose={() => setIsWithdrawReceiptModalOpen(false)}
        receipt={selectedWithdrawReceipt}
      />

      {/* Official Deposit Receipt Modal */}
      <DepositReceiptModal
        isOpen={isDepositReceiptModalOpen}
        onClose={() => setIsDepositReceiptModalOpen(false)}
        receipt={selectedDepositReceipt}
      />

      {/* Deposit Capital Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">تغذية وإيداع رأس مال بالخزينة</h3>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">مبلغ الإيداع (دينار عراقي) *</label>
                  {depositAmount > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400 font-mono">
                      {formatNumber(depositAmount)} د.ع
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={depositAmount || ''}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              {/* Document Date */}
              <DocumentDateField
                value={depositDate}
                onChange={setDepositDate}
                label="تاريخ سند الإيداع"
                helpText="تاريخ تحرير السند وتوريد المبلغ للخزينة (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
              />

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">البيان والملاحظات</label>
                <input
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  placeholder="مثال: تغذية رأس مال إضافي لصندوق الشركة..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDeposit || depositAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSubmittingDeposit ? 'جاري الإيداع...' : 'تأكيد الإيداع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
