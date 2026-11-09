'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Building2,
  ShieldCheck,
  ArrowRightLeft,
  DollarSign,
  Layers,
  Plus,
  Search,
  Filter,
  Eye,
  EyeOff,
  TrendingUp,
  Boxes,
  FileText,
  CheckCircle2,
  X,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Unlock,
  AlertCircle,
  Receipt,
  UserCheck,
  Loader2
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { Wallet as WalletType, LedgerTransaction } from '@/types/finance';
import { InvestorStatementModal } from '@/components/common/InvestorStatementModal';
import { DepositReceiptModal, DepositReceiptData } from '@/components/common/DepositReceiptModal';
import { CompanyWithdrawalModal } from '@/components/common/CompanyWithdrawalModal';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { formatTime, formatNumber } from '@/utils/formatters';
import { CompanyWithdrawalReceiptModal, CompanyWithdrawalReceiptData } from '@/components/common/CompanyWithdrawalReceiptModal';
import { usePrivacy } from '@/context/PrivacyContext';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { getCapitalInvestors, getCapitalWallets } from '@/utils/investorSelectors';

interface FundsViewProps {
  store: SimulationStore;
  onDepositCapital?: (data: {
    walletId: string;
    amountIQD: number;
    notes?: string;
    date?: string;
  }) => any;
  onWithdrawCompany?: (data: {
    amountIQD: number;
    recipientName: string;
    type: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
    notes?: string;
    receiptNo?: string;
    date?: string;
  }) => any;
}

type OwnerTypeFilter = 'ALL' | 'COMPANY' | 'INVESTOR';
type TxTypeFilter = 'ALL' | 'DEPOSIT' | 'PURCHASE_INVENTORY' | 'PAYMENT_RECEIVED' | 'EXPENSE' | 'REVENUE';

export const FundsView: React.FC<FundsViewProps> = ({ store, onDepositCapital, onWithdrawCompany }) => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<OwnerTypeFilter>('ALL');

  // Privacy state from global context
  const { isPrivacyActive } = usePrivacy();

  // Statement Modal State
  const [selectedWalletIdForStatement, setSelectedWalletIdForStatement] = useState<string | null>(null);
  const [txTypeFilter, setTxTypeFilter] = useState<TxTypeFilter>('ALL');

  // Deposit Capital Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const [depositFormData, setDepositFormData] = useState({
    walletId: store.wallets[0]?.id || 'wallet-company',
    amountIQD: 5000000,
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDepositModalOpen(false);
      }
    };
    if (isDepositModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isDepositModalOpen]);

  // Deposit Receipt Modal State (وصل قبض وإيداع رأس مال رسمي)
  const [isDepositReceiptModalOpen, setIsDepositReceiptModalOpen] = useState(false);
  const [selectedDepositReceipt, setSelectedDepositReceipt] = useState<DepositReceiptData | null>(null);

  // Company Cash Withdrawal Modal State
  const [isCompanyWithdrawModalOpen, setIsCompanyWithdrawModalOpen] = useState(false);
  const [selectedCompanyWithdrawReceipt, setSelectedCompanyWithdrawReceipt] = useState<CompanyWithdrawalReceiptData | null>(null);
  const [isCompanyWithdrawReceiptModalOpen, setIsCompanyWithdrawReceiptModalOpen] = useState(false);

  const handleCompanyWithdrawSubmit = async (data: {
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
        setIsCompanyWithdrawModalOpen(false);
        showNotification(result.message || 'تم سحب المبلغ بنجاح من صندوق الشركة', 'success');
        const prevBal = store.companyWallet.balance + data.amountIQD;
        setSelectedCompanyWithdrawReceipt({
          referenceNo: data.receiptNo || `WTH-COMP-${Date.now().toString().slice(-4)}`,
          date: data.date || new Date().toISOString().split('T')[0],
          time: formatTime(new Date(), { hour: '2-digit', minute: '2-digit' }),
          amountIQD: data.amountIQD,
          recipientName: data.recipientName,
          type: data.type,
          previousBalance: prevBal,
          newBalance: store.companyWallet.balance,
          notes: data.notes,
          recordedBy: 'أحمد إياد (مدير النظام)'
        });
        setIsCompanyWithdrawReceiptModalOpen(true);
        return { success: true };
      } else {
        return { success: false, message: result?.message || 'تعذر إتمام السحب' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'حدث خطأ أثناء الاتصال' };
    }
  };

  // Toast / Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper for masking numbers when privacy is enabled
  const formatCurrency = (amount: number) => {
    if (isPrivacyActive) return '••••••••';
    return `${formatNumber(amount)} د.ع`;
  };

  const capitalInvestors = React.useMemo(() => getCapitalInvestors(store.investors), [store.investors]);

  // Calculations for Wallets with Guaranteed Company Wallet Inclusion (excluding pure referral broker wallets)
  const allWallets = React.useMemo(() => {
    const list = [...getCapitalWallets(store.wallets, store.investors)];
    const companyWallet = store.companyWallet || {
      id: 'wallet-company',
      ownerType: 'COMPANY',
      ownerId: 'company-s',
      ownerName: 'صندوق نظام أمان الرئيسي',
      balance: 0,
      totalAssetsValuation: 0,
      totalDebtsValuation: 0,
      currency: 'IQD',
      updatedAt: new Date().toISOString()
    };
    if (!list.some((w) => w.id === companyWallet.id || w.ownerType === 'COMPANY')) {
      list.unshift(companyWallet);
    }
    return list;
  }, [store.wallets, store.investors, store.companyWallet]);

  // Calculations for Summary Header
  const totalLiquidityAll = allWallets.reduce((sum, w) => sum + w.balance, 0);
  const companyBalance = store.companyWallet.balance;
  const investorsLiquidityAll = allWallets
    .filter((w) => w.ownerType === 'INVESTOR')
    .reduce((sum, w) => sum + w.balance, 0);
  const totalCapitalDepositedAll = capitalInvestors.reduce(
    (sum, i) => sum + i.totalCapitalDeposited,
    0
  );
  const totalInventoryValuationAll = store.inventory.reduce((sum, i) => sum + i.totalCostIQD, 0);
  const totalLoansValuationAll = store.contracts.reduce((sum, c) => sum + c.totalSalePriceIQD, 0);

  // Filtered Wallets list
  const filteredWallets = allWallets.filter((w) => {
    const matchesOwnerType =
      ownerTypeFilter === 'ALL' || w.ownerType === ownerTypeFilter;
    const matchesSearch =
      w.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.ownerType === 'COMPANY' && 'صندوق الشركة'.includes(searchQuery)) ||
      (w.ownerType === 'INVESTOR' && 'مستثمر'.includes(searchQuery));
    return matchesOwnerType && matchesSearch;
  });

  // Selected Wallet for Account Statement
  const statementWallet = allWallets.find((w) => w.id === selectedWalletIdForStatement);
  const statementInvestor = store.investors.find((i) => i.walletId === selectedWalletIdForStatement || i.id === statementWallet?.ownerId);

  // Filtered Ledger Transactions for Statement Wallet
  const statementTransactions = statementWallet
    ? store.transactions.filter((tx) => {
        const belongsToWallet =
          tx.fromWalletId === statementWallet.id ||
          tx.toWalletId === statementWallet.id ||
          (statementWallet.ownerType === 'INVESTOR' && tx.investorId === statementWallet.ownerId);

        if (!belongsToWallet) return false;

        if (txTypeFilter === 'ALL') return true;
        return tx.type === txTypeFilter;
      })
    : [];

  // Statement summary stats
  const statementTotalDeposits = statementTransactions
    .filter((tx) => tx.type === 'DEPOSIT' && tx.toWalletId === statementWallet?.id)
    .reduce((sum, tx) => sum + tx.amountIQD, 0);

  const statementTotalPurchases = statementTransactions
    .filter((tx) => tx.type === 'PURCHASE_INVENTORY' && tx.fromWalletId === statementWallet?.id)
    .reduce((sum, tx) => sum + tx.amountIQD, 0);

  const statementTotalRepayments = statementTransactions
    .filter((tx) => tx.type === 'PAYMENT_RECEIVED' && tx.toWalletId === statementWallet?.id)
    .reduce((sum, tx) => sum + tx.amountIQD, 0);

  // Handle Deposit Form Submit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDeposit) return;
    if (!depositFormData.walletId) {
      showNotification('يرجى اختيار الصندوق المالي المستهدف', 'error');
      return;
    }
    if (depositFormData.amountIQD <= 0) {
      showNotification('يرجى إدخال مبلغ إيداع صحيح أكبر من صفر', 'error');
      return;
    }

    setIsSubmittingDeposit(true);
    try {
      let result;
      if (onDepositCapital) {
        result = await onDepositCapital({
          walletId: depositFormData.walletId,
          amountIQD: Number(depositFormData.amountIQD),
          notes: depositFormData.notes,
          date: depositFormData.date
        });
      } else {
        result = store.depositCapital({
          walletId: depositFormData.walletId,
          amountIQD: Number(depositFormData.amountIQD),
          notes: depositFormData.notes,
          date: depositFormData.date
        });
      }

      if (result.success) {
        showNotification(result.message, 'success');

        const targetWallet =
          allWallets.find((w) => w.id === depositFormData.walletId) ||
          store.companyWallet;
        const targetInvestor = store.investors.find(
          (i) => i.walletId === targetWallet?.id || i.id === targetWallet?.ownerId
        );

        const depositAmt = Number(depositFormData.amountIQD);
        const prevBal =
          result.previousBalance !== undefined
            ? result.previousBalance
            : targetWallet?.balance !== undefined
            ? Math.max(0, targetWallet.balance - depositAmt)
            : 0;
        const newBal =
          result.newBalance !== undefined
            ? result.newBalance
            : (targetWallet?.balance || (prevBal + depositAmt));
        const refNumber =
          result.transaction?.referenceNo ||
          result.data?.transaction?.referenceNo ||
          `DEP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

        const receiptData: DepositReceiptData = {
          referenceNo: refNumber,
          date: result.transaction?.date || depositFormData.date || new Date().toISOString().split('T')[0],
          time: formatTime(new Date(), {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          walletId: targetWallet?.id || depositFormData.walletId,
          walletName:
            targetWallet?.ownerName ||
            (targetWallet?.ownerType === 'COMPANY'
              ? 'صندوق شركة أمان الرئيسي'
              : 'صندوق المستثمر'),
          ownerType: targetWallet?.ownerType || 'COMPANY',
          investorName: targetInvestor?.name || result.investorName,
          depositorName:
            targetInvestor?.name ||
            (targetWallet?.ownerType === 'INVESTOR'
              ? targetWallet?.ownerName
              : 'إدارة شركة أمان (تغذية رأس المال الرئيسي)'),
          amountIQD: depositAmt,
          previousBalance: prevBal,
          newBalance: newBal,
          notes: depositFormData.notes?.trim() || undefined,
          paymentMethod: 'نقداً (صندوق كاش)',
          recordedBy: 'قسم الحسابات والمالية'
        };

        setSelectedDepositReceipt(receiptData);
        setIsDepositReceiptModalOpen(true);

        setIsDepositModalOpen(false);
        setDepositFormData({
          walletId: store.wallets[0]?.id || 'wallet-company',
          amountIQD: 5000000,
          notes: '',
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        showNotification(result.message, 'error');
      }
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  const openDepositModalForWallet = (walletId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDepositFormData((prev) => ({ ...prev, walletId }));
    setIsDepositModalOpen(true);
  };

  const openStatementModalForWallet = (walletId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedWalletIdForStatement(walletId);
    setTxTypeFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md transition-all animate-bounce ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-bold">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              إدارة الصناديق والمحافظ المالية المستقلة
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              متابعة حركة الصناديق والسيولة النقدية وكشوفات الحساب المحاسبية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          {/* Masking / Privacy Toggle */}
          <PrivacyToggleButton />

          {/* New Deposit Button */}
          <button
            onClick={() => {
              setDepositFormData({
                walletId: store.companyWallet?.id || 'wallet-company',
                amountIQD: 5000000,
                notes: '',
                date: new Date().toISOString().split('T')[0]
              });
              setIsDepositModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إيداع رأس مال جديد</span>
          </button>
        </div>
      </div>

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Liquidity */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">إجمالي السيولة النقدية المتاحة</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-400 tracking-tight">
              {formatCurrency(totalLiquidityAll)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">موزعة بين الشركة والمستثمرين</p>
          </div>
        </div>

        {/* Company Wallet Balance */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">رصيد صندوق أمان الرئيسي</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-400 tracking-tight">
              {formatCurrency(companyBalance)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">العمولات الإدارية وحصة الشركة</p>
          </div>
        </div>

        {/* Investor Liquidity Total */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">سيولة صناديق المستثمرين النقدية</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-indigo-400 tracking-tight">
              {formatCurrency(investorsLiquidityAll)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">جاهزة للاستثمار بشراء أصل أو تقسيط</p>
          </div>
        </div>

        {/* Capital & Portfolio Assets */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">إجمالي رأس المال المودع</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-amber-400 tracking-tight">
              {formatCurrency(totalCapitalDepositedAll)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              مخزن: {formatCurrency(totalInventoryValuationAll)} | قروض: {formatCurrency(totalLoansValuationAll)}
            </p>
          </div>
        </div>
      </div>


      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الصندوق أو المستثمر..."
            className="w-full pl-4 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <PrivacyToggleButton variant="compact" />
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setOwnerTypeFilter('ALL')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              ownerTypeFilter === 'ALL'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            جميع الصناديق ({allWallets.length})
          </button>
          <button
            onClick={() => setOwnerTypeFilter('COMPANY')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              ownerTypeFilter === 'COMPANY'
                ? 'bg-blue-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            صندوق الشركة
          </button>
          <button
            onClick={() => setOwnerTypeFilter('INVESTOR')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              ownerTypeFilter === 'INVESTOR'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            صناديق المستثمرين ({allWallets.filter((w) => w.ownerType === 'INVESTOR').length})
          </button>
        </div>
        </div>
      </div>

      {/* Funds Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWallets.map((w) => {
          const isCompany = w.ownerType === 'COMPANY';
          const investor = store.investors.find((i) => i.walletId === w.id || i.id === w.ownerId);
          const investorItems = store.inventory.filter((inv) => inv.investorId === investor?.id);
          const investorContracts = store.contracts.filter((c) => c.investorId === investor?.id);

          // Calculate exact valuation from active inventory & contracts if investor
          const inventoryValuation = isCompany
            ? 0
            : investorItems.reduce((sum, item) => sum + item.totalCostIQD, 0);

          const loansValuation = isCompany
            ? 0
            : investorContracts.reduce((sum, c) => sum + c.totalSalePriceIQD, 0);

          return (
            <div
              key={w.id}
              className={`rounded-3xl p-6 border space-y-5 shadow-xl transition-all relative overflow-hidden flex flex-col justify-between ${
                isCompany
                  ? 'bg-slate-900 border-emerald-500/40 shadow-emerald-500/5'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Top Accent Stripe */}
              <div
                className={`absolute top-0 right-0 left-0 h-1.5 ${
                  isCompany
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
                }`}
              />

              <div>
                {/* Header info */}
                <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                        isCompany
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      }`}
                    >
                      {isCompany ? <Building2 className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-base leading-snug">
                        {isCompany ? (
                          w.ownerName
                        ) : (
                          <PrivacyMaskedText
                            id={`wallet-owner-${w.id}`}
                            text={investor?.name || w.ownerName.replace(/صندوق المستثمر\s*/g, '').trim() || w.ownerName}
                            as="span"
                          />
                        )}
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isCompany
                          ? 'صندوق أمان الرئيسي - سامراء'
                          : `محفظة مستقلة باسم المستثمر`}
                      </p>
                    </div>
                  </div>

                  {/* Owner Type Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      isCompany
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}
                  >
                    {isCompany ? 'صندوق رئيسي' : 'صندوق مستقل'}
                  </span>
                </div>

                {/* Contract Split details if Investor */}
                {!isCompany && investor && (
                  <div className="mt-4 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">نسبة العقد المحاسبي:</span>
                    <span className="font-bold text-indigo-300">
                      {investor.contract.investorSharePercent}% للمستثمر / {investor.contract.companySharePercent}% للشركة
                    </span>
                  </div>
                )}

                {/* Liquidity Balance Card */}
                <div className="mt-4 p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span>السيولة النقدية المتاحة حالياً</span>
                    <span className="text-emerald-400 font-mono text-[10px]">IQD</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-400 tracking-tight">
                    {formatCurrency(w.balance)}
                  </p>
                </div>

                {/* Assets & Debts breakdown */}
                {!isCompany && (
                  <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                    <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Boxes className="w-3 h-3 text-amber-400" />
                        <span>بضائع بالمخزن:</span>
                      </div>
                      <span className="font-bold text-amber-400 text-xs block">
                        {formatCurrency(inventoryValuation)}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <FileText className="w-3 h-3 text-purple-400" />
                        <span>ذمم وقروض قيد السداد:</span>
                      </div>
                      <span className="font-bold text-purple-400 text-xs block">
                        {formatCurrency(loansValuation)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Investor Total Capital & Profits earned */}
                {!isCompany && investor && (
                  <div className="grid grid-cols-2 gap-3 text-xs mt-3 pt-3 border-t border-slate-800/60">
                    <div>
                      <span className="text-slate-500 text-[10px] block">رأس المال المودع:</span>
                      <span className="font-bold text-slate-300">{formatCurrency(investor.totalCapitalDeposited)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">إجمالي الأرباح المحققة:</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(investor.totalProfitsEarned)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-2">
                {isCompany && (
                  <button
                    onClick={() => setIsCompanyWithdrawModalOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-400 text-xs font-bold transition-all border border-amber-500/30 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <ArrowDownLeft className="w-4 h-4 text-amber-400" />
                    <span>سحب نقدي من صندوق الشركة</span>
                  </button>
                )}

                <button
                  onClick={(e) => openDepositModalForWallet(w.id, e)}
                  className="w-full py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all border border-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>تغذية / إيداع رأس مال في هذا الصندوق</span>
                </button>

                <button
                  onClick={(e) => openStatementModalForWallet(w.id, e)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700/60 flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                  <span>عرض كشف حساب الصندوق التفصيلي</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredWallets.length === 0 && (
        <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <p className="text-slate-400 text-sm font-medium">لم يتم العثور على أي صندوق يطابق البحث</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setOwnerTypeFilter('ALL');
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold"
          >
            إعادة تصفية البحث
          </button>
        </div>
      )}

      {/* MODAL 1: Deposit Capital Modal (نافذة إيداع رأس مال جديد) */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="p-6 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">إيداع رأس مال جديد / تغذية صندوق</h3>
                  <p className="text-xs text-slate-400">إضافة سيولة نقديّة مباشرة لحساب الصندوق المالي</p>
                </div>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleDepositSubmit} className="p-6 space-y-4 text-xs">
              {/* Wallet Select */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">الصندوق المستهدف للإيداع:</label>
                <select
                  value={depositFormData.walletId}
                  onChange={(e) => setDepositFormData({ ...depositFormData, walletId: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value={store.companyWallet?.id || 'wallet-company'} className="font-bold text-emerald-400">
                    🏢 {store.companyWallet?.ownerName || 'صندوق نظام أمان الرئيسي'} (صندوق الشركة الرئيسي) - رصيد حالي: {formatNumber(store.companyWallet?.balance)} د.ع
                  </option>
                  {allWallets
                    .filter((w) => w.id !== (store.companyWallet?.id || 'wallet-company') && w.ownerType !== 'COMPANY')
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        💼 {w.ownerName.replace(/صندوق المستثمر\s*/g, '').trim()} (مستثمر) - رصيد حالي: {formatNumber(w.balance)} د.ع
                      </option>
                    ))}
                </select>
              </div>

              {/* Document Date */}
              <DocumentDateField
                value={depositFormData.date}
                onChange={(newDate) => setDepositFormData((prev) => ({ ...prev, date: newDate }))}
                label="تاريخ سند الإيداع"
                helpText="تاريخ تحرير السند وتوريد المبلغ للصندوق (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
              />

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">مبلغ الإيداع (بالدينار العراقي IQD):</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={depositFormData.amountIQD}
                  onChange={(e) => setDepositFormData({ ...depositFormData, amountIQD: Number(e.target.value) })}
                  placeholder="مثال: 5,000,000"
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
                />

                {/* Quick Add Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDepositFormData((prev) => ({ ...prev, amountIQD: prev.amountIQD + 1000000 }))}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
                  >
                    +1,000,000
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositFormData((prev) => ({ ...prev, amountIQD: prev.amountIQD + 5000000 }))}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
                  >
                    +5,000,000
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositFormData((prev) => ({ ...prev, amountIQD: prev.amountIQD + 10000000 }))}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
                  >
                    +10,000,000
                  </button>
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">رقم السند أو ملاحظات الإيداع:</label>
                <textarea
                  rows={3}
                  value={depositFormData.notes}
                  onChange={(e) => setDepositFormData({ ...depositFormData, notes: e.target.value })}
                  placeholder="مثال: إيداع رأس مال إضافي بموجب الملحق الأصولي العراقي - سامراء"
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  disabled={isSubmittingDeposit}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDeposit}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                >
                  {isSubmittingDeposit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>جاري تنفيذ الإيداع...</span>
                    </>
                  ) : (
                    <span>تأكيد الإيداع والتغذية</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Detailed Account Statement Modal with Date Range & Official Print (كشف حساب الصندوق التفصيلي) */}
      <InvestorStatementModal
        isOpen={!!statementWallet}
        onClose={() => setSelectedWalletIdForStatement(null)}
        wallet={statementWallet || null}
        investor={statementInvestor || null}
        allTransactions={store.transactions}
      />

      {/* MODAL 3: Official Capital Deposit Receipt Modal (وصل وسند قبض رأس المال المالي القابل للطباعة) */}
      <DepositReceiptModal
        isOpen={isDepositReceiptModalOpen}
        onClose={() => setIsDepositReceiptModalOpen(false)}
        receipt={selectedDepositReceipt}
      />

      {/* MODAL 4: Company Cash Withdrawal Modal (نافذة السحب النقدي من صندوق الشركة) */}
      <CompanyWithdrawalModal
        isOpen={isCompanyWithdrawModalOpen}
        onClose={() => setIsCompanyWithdrawModalOpen(false)}
        companyBalance={store.companyWallet.balance}
        onSubmitWithdrawal={handleCompanyWithdrawSubmit}
      />

      {/* MODAL 5: Official Company Cash Disbursement Voucher (سند صرف نقدي رسمي) */}
      <CompanyWithdrawalReceiptModal
        isOpen={isCompanyWithdrawReceiptModalOpen}
        onClose={() => setIsCompanyWithdrawReceiptModalOpen(false)}
        receipt={selectedCompanyWithdrawReceipt}
      />
    </div>
  );
};
