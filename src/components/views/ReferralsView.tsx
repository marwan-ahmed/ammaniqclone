'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Share2,
  Users,
  Wallet,
  Coins,
  Award,
  TrendingUp,
  Printer,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  CheckCircle2,
  Building2,
  Sparkles,
  Plus,
  FileText,
  ChevronDown,
  ChevronUp,
  Percent,
  X,
  Receipt,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Loader2,
  Phone,
  MapPin,
  ExternalLink,
  Edit3,
  ArrowDownLeft
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { Investor, LedgerTransaction } from '@/types/finance';
import { InvestorStatementModal } from '@/components/common/InvestorStatementModal';
import {
  InvestorWithdrawalReceiptModal,
  InvestorWithdrawalReceiptData,
} from '@/components/common/InvestorWithdrawalReceiptModal';
import { formatNumber, toEnglishDigits, formatIQD, formatTime } from '@/utils/formatters';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { findDuplicateMatches } from '@/utils/nameSimilarity';
import { DuplicateWarningBanner } from '@/components/common/DuplicateWarningBanner';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { isReferralBroker, getCapitalInvestors, getEligibleReferrers } from '@/utils/investorSelectors';
import { getNextInvestorWithdrawalReceiptNumber } from '@/utils/receiptNumbering';
import { tafqeetIQD } from '@/utils/tafqeet';
import {
  buildReferredInvestorSummary,
  resolveReferralCommissionVoucher
} from '@/utils/referralCalculations';
import { ReferralContractBreakdownRow } from './ReferralContractBreakdownRow';

interface ReferralsViewProps {
  store: SimulationStore;
  onAddInvestor?: (data: {
    name: string;
    phone: string;
    address: string;
    nationalId?: string;
    capitalAmount: number;
    investorSharePercent: number;
    companySharePercent: number;
    notes?: string;
    date?: string;
    referrerId?: string;
    referrerName?: string;
    referrerSharePercent?: number;
    isReferralPartner?: boolean;
  }) => any;
  onUpdateInvestor?: (data: {
    id: string;
    name: string;
    phone: string;
    address?: string;
    nationalId?: string;
    investorSharePercent?: number;
    companySharePercent?: number;
    referrerId?: string;
    referrerName?: string;
    referrerSharePercent?: number;
    notes?: string;
  }) => any;
  onWithdrawInvestor?: (data: any) => any;
  setActiveTab?: (tab: any) => void;
}

type SubTab = 'networks' | 'referred_investors' | 'commissions_ledger';

export const ReferralsView: React.FC<ReferralsViewProps> = ({
  store,
  onAddInvestor,
  onUpdateInvestor,
  onWithdrawInvestor,
  setActiveTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('networks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<'ALL' | 'INVESTORS_WITH_CAPITAL' | 'AFFILIATE_PARTNERS_ONLY'>('ALL');
  const [expandedReferrerIds, setExpandedReferrerIds] = useState<Record<string, boolean>>({});
  const [expandedChildContractIds, setExpandedChildContractIds] = useState<Record<string, boolean>>({});

  // Statement modal state
  const [statementInvestor, setStatementInvestor] = useState<Investor | null>(null);

  // Broker Commission Withdrawal Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedWithdrawBroker, setSelectedWithdrawBroker] = useState<Investor | null>(null);
  const [withdrawFormData, setWithdrawFormData] = useState<{
    amountIQD: number;
    receiptNo: string;
    date: string;
    notes: string;
  }>({
    amountIQD: 0,
    receiptNo: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Withdrawal Receipt Modal State
  const [selectedWithdrawReceipt, setSelectedWithdrawReceipt] = useState<InvestorWithdrawalReceiptData | null>(null);
  const [isWithdrawReceiptModalOpen, setIsWithdrawReceiptModalOpen] = useState(false);

  // Ledger Filter for Sub-tab 3
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'ACCRUALS' | 'WITHDRAWALS'>('ALL');

  // Add Partner / Referred Investor Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Broker / Referred Investor Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Investor | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    address: '',
    nationalId: '',
    investorSharePercent: 60,
    companySharePercent: 40,
    referrerId: '',
    referrerSharePercent: 0,
    notes: ''
  });
  const [quickLinkInvestorId, setQuickLinkInvestorId] = useState('');
  const [quickLinkCommissionPct, setQuickLinkCommissionPct] = useState<number>(10);

  const capitalInvestors = useMemo(() => getCapitalInvestors(store.investors), [store.investors]);
  const eligibleReferrers = useMemo(() => getEligibleReferrers(store.investors), [store.investors]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: 'سامراء - ',
    nationalId: '',
    capitalAmount: 0,
    investorSharePercent: 0,
    companySharePercent: 100,
    referrerId: '',
    referrerSharePercent: 0,
    isReferralPartner: true,
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const duplicateMatches = useMemo(() => {
    return findDuplicateMatches(formData.name, formData.phone, store.investors);
  }, [formData.name, formData.phone, store.investors]);

  // Expand all networks and child contract breakdowns by default once loaded
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    const initialChildContracts: Record<string, boolean> = {};
    store.investors.forEach((inv) => {
      initialExpanded[inv.id] = true;
      initialChildContracts[inv.id] = true;
    });
    setExpandedReferrerIds(initialExpanded);
    setExpandedChildContractIds(initialChildContracts);
  }, [store.investors.length]);

  const toggleExpand = (id: string) => {
    setExpandedReferrerIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleChildContracts = (id: string) => {
    setExpandedChildContractIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Grouping and Derivations
  const allReferralTransactions = useMemo(() => {
    return store.transactions.filter((t) => t.type === 'REFERRAL_COMMISSION');
  }, [store.transactions]);

  const referredInvestorsList = useMemo(() => {
    return store.investors.filter((inv) => !!inv.referredById || (inv.contract && !!inv.contract.referrerId));
  }, [store.investors]);

  // Distinct Referrers: Any referral broker OR any investor who has referred at least one investor
  const referrersList = useMemo(() => {
    return store.investors.filter((inv) => {
      const hasReferredSomeone = store.investors.some(
        (other) => other.referredById === inv.id || other.contract?.referrerId === inv.id
      );
      return isReferralBroker(inv) || hasReferredSomeone;
    });
  }, [store.investors]);

  // Broker Cash Withdrawal Transactions
  const brokerWithdrawalTransactions = useMemo(() => {
    const brokerIds = new Set(referrersList.map((r) => r.id));
    const brokerWalletIds = new Set(
      store.wallets.filter((w) => brokerIds.has(w.ownerId)).map((w) => w.id)
    );

    return store.transactions.filter((tx) => {
      const isWth =
        tx.type === 'INVESTOR_WITHDRAWAL' ||
        (tx.type === 'PROFIT_DISTRIBUTION' && tx.investorId) ||
        tx.description?.includes('عمولة إحالة') ||
        tx.description?.includes('عمولة');
      const belongsToBroker =
        brokerIds.has(tx.investorId || '') || brokerWalletIds.has(tx.fromWalletId || '');
      return isWth && belongsToBroker;
    });
  }, [store.transactions, referrersList, store.wallets]);

  // Aggregate Metrics
  const totalCommissionsPaid = useMemo(() => {
    return allReferralTransactions.reduce((acc, tx) => acc + (tx.amountIQD || 0), 0);
  }, [allReferralTransactions]);

  const totalCapitalAttracted = useMemo(() => {
    return referredInvestorsList.reduce((acc, inv) => acc + (inv.totalCapitalDeposited || 0), 0);
  }, [referredInvestorsList]);

  const totalReferredInvestorsCount = referredInvestorsList.length;
  const totalReferrersCount = referrersList.length;

  const totalProfitsGeneratedByReferred = useMemo(() => {
    return referredInvestorsList.reduce((acc, inv) => acc + (inv.totalProfitsEarned || 0), 0);
  }, [referredInvestorsList]);

  // Filtered Referrers
  const filteredReferrers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return referrersList.filter((ref) => {
      if (selectedPartnerFilter === 'AFFILIATE_PARTNERS_ONLY' && !isReferralBroker(ref)) {
        return false;
      }
      if (selectedPartnerFilter === 'INVESTORS_WITH_CAPITAL' && isReferralBroker(ref)) {
        return false;
      }
      if (!q) return true;

      const nameMatch = ref.name.toLowerCase().includes(q);
      const phoneMatch = ref.phone.toLowerCase().includes(q);
      const childMatch = store.investors.some(
        (child) =>
          (child.referredById === ref.id || child.contract?.referrerId === ref.id) &&
          child.name.toLowerCase().includes(q)
      );
      return nameMatch || phoneMatch || childMatch;
    });
  }, [referrersList, searchQuery, selectedPartnerFilter, store.investors]);

  // Filtered Referred Investors
  const filteredReferredInvestors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return referredInvestorsList.filter((inv) => {
      if (!q) return true;
      const nameMatch = inv.name.toLowerCase().includes(q);
      const phoneMatch = inv.phone.toLowerCase().includes(q);
      const referrerMatch = (inv.referredByName || inv.contract?.referrerName || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch || referrerMatch;
    });
  }, [referredInvestorsList, searchQuery]);

  // Filtered Ledger Transactions
  const filteredCommissionsLog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allReferralTransactions.filter((tx) => {
      if (!q) return true;
      const refMatch = (tx.referenceNo || '').toLowerCase().includes(q);
      const invMatch = (tx.investorName || '').toLowerCase().includes(q);
      const descMatch = (tx.description || '').toLowerCase().includes(q);
      const borrowerMatch = (tx.borrowerName || '').toLowerCase().includes(q);
      return refMatch || invMatch || descMatch || borrowerMatch;
    });
  }, [allReferralTransactions, searchQuery]);

  // Filtered Broker Withdrawals
  const filteredWithdrawalsLog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return brokerWithdrawalTransactions.filter((tx) => {
      if (!q) return true;
      const refMatch = (tx.referenceNo || '').toLowerCase().includes(q);
      const invMatch = (tx.investorName || '').toLowerCase().includes(q);
      const descMatch = (tx.description || '').toLowerCase().includes(q);
      return refMatch || invMatch || descMatch;
    });
  }, [brokerWithdrawalTransactions, searchQuery]);

  // Open Broker Cash Withdrawal Modal
  const openBrokerWithdrawModal = (broker: Investor) => {
    setSelectedWithdrawBroker(broker);
    const brokerWallet = store.wallets.find((w) => w.id === broker.walletId || w.ownerId === broker.id);
    const available = brokerWallet ? brokerWallet.balance : (broker.availableLiquidity || 0);
    const nextReceipt = getNextInvestorWithdrawalReceiptNumber(store.transactions, store.numberingResetEpoch);
    setWithdrawFormData({
      amountIQD: available > 0 ? available : 0,
      receiptNo: nextReceipt,
      date: new Date().toISOString().split('T')[0],
      notes: `سحب عمولة إحالة نقداً للوسيط (${broker.name})`,
    });
    setIsWithdrawModalOpen(true);
  };

  // Confirm and Execute Broker Cash Withdrawal
  const handleConfirmBrokerWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawBroker || isSubmittingWithdraw) return;

    const brokerWallet = store.wallets.find(
      (w) => w.id === selectedWithdrawBroker.walletId || w.ownerId === selectedWithdrawBroker.id
    );
    const prevBalance = brokerWallet ? brokerWallet.balance : (selectedWithdrawBroker.availableLiquidity || 0);
    const withdrawAmount = Number(withdrawFormData.amountIQD);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      alert('يرجى إدخال مبلغ سحب صحيح أكبر من صفر');
      return;
    }

    if (withdrawAmount > prevBalance) {
      alert(`الرصيد المتاح للوسيط (${formatIQD(prevBalance)} د.ع) غير كافٍ لسحب مبلغ ${formatIQD(withdrawAmount)} د.ع`);
      return;
    }

    const assignedReceiptNo =
      withdrawFormData.receiptNo && withdrawFormData.receiptNo.trim()
        ? withdrawFormData.receiptNo.trim()
        : getNextInvestorWithdrawalReceiptNumber(store.transactions, store.numberingResetEpoch);

    const newBalance = Math.max(0, prevBalance - withdrawAmount);
    const payload = {
      investorId: selectedWithdrawBroker.id,
      walletId: brokerWallet?.id,
      amountIQD: withdrawAmount,
      type: 'COMMISSION_WITHDRAWAL' as const,
      notes: withdrawFormData.notes,
      receiptNo: assignedReceiptNo,
      date: withdrawFormData.date,
    };

    setIsSubmittingWithdraw(true);
    try {
      let result;
      if (onWithdrawInvestor) {
        result = await onWithdrawInvestor(payload);
      } else {
        result = store.withdrawInvestorFunds(payload);
      }

      if (result && result.success) {
        setIsWithdrawModalOpen(false);
        setNotification({
          type: 'success',
          message: `تم صرف مبلغ ${formatIQD(withdrawAmount)} د.ع بنجاح للوسيط "${selectedWithdrawBroker.name}" وحفظ سند الصرف رقم #${assignedReceiptNo}`,
        });

        const receiptData: InvestorWithdrawalReceiptData = {
          receiptNo: assignedReceiptNo,
          date: withdrawFormData.date || new Date().toISOString().split('T')[0],
          time: formatTime(new Date(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          investorId: selectedWithdrawBroker.id,
          investorName: selectedWithdrawBroker.name,
          investorPhone: selectedWithdrawBroker.phone,
          investorAddress: selectedWithdrawBroker.address,
          walletName: brokerWallet?.ownerName || `محفظة عمولات: ${selectedWithdrawBroker.name}`,
          amountIQD: withdrawAmount,
          type: 'COMMISSION_WITHDRAWAL' as const,
          previousBalance: prevBalance,
          newBalance: newBalance,
          notes: withdrawFormData.notes,
          recordedBy: 'أحمد إياد',
        };

        setSelectedWithdrawReceipt(receiptData);
        setIsWithdrawReceiptModalOpen(true);
      } else {
        alert(result?.message || 'تعذر إتمام عملية السحب النقدي');
      }
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Open Past Withdrawal Receipt for Reprinting
  const handleOpenPastWithdrawalReceipt = (tx: LedgerTransaction) => {
    const broker = store.investors.find((i) => i.id === tx.investorId) || {
      id: tx.investorId || '',
      name: tx.investorName || 'الوسيط',
      phone: '',
      address: '',
    };
    const brokerWallet = store.wallets.find((w) => w.id === tx.fromWalletId || w.ownerId === broker.id);
    const cleanReceiptNo = tx.referenceNo ? String(tx.referenceNo).replace(/^#/, '') : '1';

    const receiptData: InvestorWithdrawalReceiptData = {
      receiptNo: cleanReceiptNo,
      date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      time: formatTime(new Date(tx.date || new Date()), { hour: '2-digit', minute: '2-digit' }),
      investorId: broker.id,
      investorName: broker.name,
      investorPhone: (broker as any).phone,
      investorAddress: (broker as any).address,
      walletName: brokerWallet?.ownerName || tx.fromWalletName || `محفظة عمولات ${broker.name}`,
      amountIQD: Number(tx.amountIQD) || 0,
      type: 'COMMISSION_WITHDRAWAL' as const,
      previousBalance: (brokerWallet?.balance || 0) + (Number(tx.amountIQD) || 0),
      newBalance: brokerWallet?.balance || 0,
      notes: tx.description,
      recordedBy: 'أحمد إياد',
    };
    setSelectedWithdrawReceipt(receiptData);
    setIsWithdrawReceiptModalOpen(true);
  };

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setNotification({ type: 'error', message: 'يرجى كتابة الاسم الكامل للشريك أو المستثمر' });
      return;
    }
    if (!formData.phone.trim()) {
      setNotification({ type: 'error', message: 'يرجى كتابة رقم الهاتف للتواصل' });
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        nationalId: formData.nationalId.trim() || undefined,
        capitalAmount: 0,
        investorSharePercent: 0,
        companySharePercent: 100,
        referrerId: undefined,
        referrerName: undefined,
        referrerSharePercent: 0,
        isReferralPartner: true,
        notes: formData.notes.trim() || undefined,
        date: formData.date
      };

      if (onAddInvestor) {
        await onAddInvestor(payload);
      } else {
        store.addInvestor(payload);
      }

      setNotification({
        type: 'success',
        message: `تم تسجيل وسيط الإحالة "${formData.name}" وإنشاء محفظة عمولات مستقلة بنجاح`
      });

      setIsAddModalOpen(false);
      setFormData({
        name: '',
        phone: '',
        address: 'سامراء - ',
        nationalId: '',
        capitalAmount: 0,
        investorSharePercent: 0,
        companySharePercent: 100,
        referrerId: '',
        referrerSharePercent: 0,
        isReferralPartner: true,
        notes: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'حدث خطأ أثناء حفظ البيانات' });
    } finally {
      setIsSubmittingAdd(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const openEditModal = (target: Investor) => {
    setEditingTarget(target);
    setEditFormData({
      name: target.name,
      phone: target.phone,
      address: target.address || '',
      nationalId: target.nationalId || '',
      investorSharePercent: target.contract?.investorSharePercent ?? (isReferralBroker(target) ? 0 : 60),
      companySharePercent: isReferralBroker(target) ? 100 : Math.max(0, 100 - (target.contract?.investorSharePercent ?? 60)),
      referrerId: target.contract?.referrerId || target.referredById || '',
      referrerSharePercent: target.contract?.referrerSharePercent ?? target.referralSharePercent ?? 0,
      notes: target.contract?.notes || ''
    });
    setQuickLinkInvestorId('');
    setQuickLinkCommissionPct(10);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget || !editFormData.name.trim() || !editFormData.phone.trim()) return;
    if (isSubmittingEdit) return;

    const selectedReferrer = store.investors.find((inv) => inv.id === editFormData.referrerId);
    const isBrokerOnly = isReferralBroker(editingTarget);
    const payload = {
      id: editingTarget.id,
      name: editFormData.name.trim(),
      phone: editFormData.phone.trim(),
      address: editFormData.address.trim(),
      nationalId: editFormData.nationalId.trim(),
      investorSharePercent: isBrokerOnly ? 0 : Number(editFormData.investorSharePercent),
      companySharePercent: isBrokerOnly ? 100 : Math.max(0, 100 - Number(editFormData.investorSharePercent)),
      referrerId: isBrokerOnly ? '' : editFormData.referrerId || '',
      referrerName: !isBrokerOnly && selectedReferrer ? selectedReferrer.name : undefined,
      referrerSharePercent:
        !isBrokerOnly && editFormData.referrerId ? Number(editFormData.referrerSharePercent || 0) : 0,
      notes: editFormData.notes.trim()
    };

    setIsSubmittingEdit(true);
    try {
      let result;
      if (onUpdateInvestor) {
        result = await onUpdateInvestor(payload);
      } else {
        result = SimulationStore.prototype.updateInvestor.call(store, payload);
      }

      if (result && result.success) {
        setIsEditModalOpen(false);
        setNotification({
          type: 'success',
          message: result.message || `تم تحديث بيانات "${payload.name}" بنجاح`
        });
      } else {
        setNotification({
          type: 'error',
          message: result?.message || 'تعذر تحديث البيانات'
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'حدث خطأ أثناء تحديث البيانات' });
    } finally {
      setIsSubmittingEdit(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleAssignOrUpdateReferredInvestor = async (
    referredInvestor: Investor,
    broker: Investor,
    commissionPercent: number
  ) => {
    const payload = {
      id: referredInvestor.id,
      name: referredInvestor.name,
      phone: referredInvestor.phone,
      address: referredInvestor.address,
      nationalId: referredInvestor.nationalId,
      investorSharePercent: referredInvestor.contract?.investorSharePercent ?? 60,
      companySharePercent: referredInvestor.contract?.companySharePercent ?? 40,
      referrerId: broker.id,
      referrerName: broker.name,
      referrerSharePercent: Math.max(0, Number(commissionPercent || 0)),
      notes: referredInvestor.contract?.notes
    };

    setIsSubmittingEdit(true);
    try {
      let result;
      if (onUpdateInvestor) {
        result = await onUpdateInvestor(payload);
      } else {
        result = SimulationStore.prototype.updateInvestor.call(store, payload);
      }

      if (result && result.success) {
        setNotification({
          type: 'success',
          message: `تم تحديث نسبة عمولة الوسيط "${broker.name}" على المستثمر "${referredInvestor.name}" إلى (${payload.referrerSharePercent}%) بنجاح`
        });
        setQuickLinkInvestorId('');
      }
    } finally {
      setIsSubmittingEdit(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Export to Excel Spreadsheet (.xls)
  const handleExportExcel = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `تقرير_شبكة_الإحالة_والعمولات_${timestamp}.xls`;

    let content = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; }
          .title { font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 8px; text-align: center; }
          .subtitle { font-size: 12px; color: #64748b; margin-bottom: 20px; text-align: center; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 25px; }
          th { background-color: #6366f1; color: #ffffff; padding: 10px; border: 1px solid #cbd5e1; font-size: 12px; }
          td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 11px; }
          .section-title { font-size: 14px; font-weight: bold; color: #4338ca; margin: 15px 0 8px; }
          .number { font-family: 'Courier New', monospace; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="title">شركة أمان للتقسيط - سامراء</div>
        <div class="title">تقرير شبكة الإحالة والعمولات واستقطاب رؤوس الأموال المعتمد</div>
        <div class="subtitle">تاريخ التصدير: ${timestamp} | إجمالي العمولات المصروفة: ${formatNumber(totalCommissionsPaid)} د.ع | رؤوس الأموال المستقطبة: ${formatNumber(totalCapitalAttracted)} د.ع</div>

        <div class="section-title">1. قائمة شبكات المحيلين والشركاء المستقطبين:</div>
        <table>
          <thead>
            <tr>
              <th>ت</th>
              <th>اسم المحيل</th>
              <th>رقم الهاتف</th>
              <th>الصفة في الشركة</th>
              <th>رأس المال المودع</th>
              <th>عدد المستثمرين التابعين</th>
              <th>إجمالي رؤوس الأموال المستقطبة</th>
              <th>إجمالي العمولات المستلمة (د.ع)</th>
            </tr>
          </thead>
          <tbody>
            ${referrersList.map((ref, idx) => {
              const children = store.investors.filter(
                (c) => c.referredById === ref.id || c.contract?.referrerId === ref.id
              );
              const attractedCap = children.reduce((acc, c) => acc + (c.totalCapitalDeposited || 0), 0);
              const comms = ref.totalReferralCommissionsEarned || 0;
              const roleText = ref.isReferralPartner ? 'شريك إحالة وسيط (دون رأس مال)' : 'مستثمر ومحيل برأس مال';
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><b>${ref.name}</b></td>
                  <td>${ref.phone}</td>
                  <td>${roleText}</td>
                  <td class="number">${formatNumber(ref.totalCapitalDeposited)} د.ع</td>
                  <td>${children.length} مستثمر</td>
                  <td class="number">${formatNumber(attractedCap)} د.ع</td>
                  <td class="number" style="color: #6d28d9;">+${formatNumber(comms)} د.ع</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="section-title">2. قائمة المستثمرين المُحالين ورؤوس أموالهم:</div>
        <table>
          <thead>
            <tr>
              <th>ت</th>
              <th>اسم المستثمر المحال</th>
              <th>رقم الهاتف</th>
              <th>المحيل المستقطب</th>
              <th>نسبة عمولة المحيل من الشركة</th>
              <th>نسبة العقد (مستثمر / شركة)</th>
              <th>رأس المال المودع</th>
              <th>الأرباح المحصلة</th>
            </tr>
          </thead>
          <tbody>
            ${referredInvestorsList.map((inv, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><b>${inv.name}</b></td>
                <td>${inv.phone}</td>
                <td>${inv.referredByName || inv.contract?.referrerName || '—'}</td>
                <td><b>${inv.contract?.referrerSharePercent || inv.referralSharePercent || 0}%</b></td>
                <td>${inv.contract?.investorSharePercent}% / ${inv.contract?.companySharePercent}%</td>
                <td class="number">${formatNumber(inv.totalCapitalDeposited)} د.ع</td>
                <td class="number">${formatNumber(inv.totalProfitsEarned)} د.ع</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">3. سجل سندات وحركات صرف عمولات الإحالة:</div>
        <table>
          <thead>
            <tr>
              <th>ت</th>
              <th>التاريخ</th>
              <th>رقم السند</th>
              <th>المحيل المستحق</th>
              <th>المستثمر المحال</th>
              <th>الزبون / العقد</th>
              <th>المحفظة المستلمة</th>
              <th>مبلغ العمولة (د.ع)</th>
            </tr>
          </thead>
          <tbody>
            ${allReferralTransactions.map((tx, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${tx.date}</td>
                <td>${tx.referenceNo || 'سند عمولة'}</td>
                <td><b>${tx.investorName || 'المحيل'}</b></td>
                <td>${tx.investorName || '—'}</td>
                <td>${tx.borrowerName || '—'}</td>
                <td>${tx.toWalletName}</td>
                <td class="number" style="color: #6d28d9;">+${formatNumber(tx.amountIQD)} د.ع</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Full Network Report (A4 Printable Window)
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const timestamp = new Date().toLocaleDateString('en-GB');
    const profile = store.companyProfile || {
      companyName: 'شركة أمان للتقسيط والاستثمار المالي',
      companyAddress: 'سامراء - حي الجامعة',
      companyPhone: '07700000000',
      managerName: 'أحمد إياد'
    };

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير شبكة الإحالة والعمولات - شركة أمان للتقسيط</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            color: #0f172a;
            direction: rtl;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-size: 11pt;
            line-height: 1.5;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .company-title {
            font-size: 18pt;
            font-weight: 900;
            color: #1e1b4b;
            margin: 0;
          }
          .doc-title {
            font-size: 13pt;
            font-weight: 700;
            color: #4f46e5;
            margin-top: 4px;
          }
          .meta-box {
            text-align: left;
            font-size: 9pt;
            color: #475569;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px;
            background: #f8fafc;
            text-align: center;
          }
          .kpi-title { font-size: 8.5pt; color: #64748b; font-weight: 600; margin-bottom: 4px; }
          .kpi-value { font-size: 13pt; font-weight: 900; color: #1e293b; font-family: 'Courier New', monospace; }
          .kpi-value.purple { color: #6d28d9; }
          .section-heading {
            font-size: 11pt;
            font-weight: 800;
            color: #1e1b4b;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 4px;
            margin: 16px 0 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5pt;
            margin-bottom: 16px;
          }
          th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: 700;
            padding: 7px 8px;
            border: 1px solid #cbd5e1;
            text-align: right;
          }
          td {
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            text-align: right;
          }
          .number { font-family: 'Courier New', monospace; font-weight: 700; }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 700;
          }
          .badge-purple { background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; }
          .badge-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
          .footer {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            font-size: 9.5pt;
            border-top: 1px dashed #cbd5e1;
            padding-top: 15px;
          }
          .sig-box { text-align: center; width: 180px; }
          .sig-line { margin-top: 35px; border-bottom: 1px solid #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="company-title">${profile.companyName}</h1>
            <div class="doc-title">تقرير تتبع ورصد شبكة الإحالة والعمولات المكتسبة</div>
            <div style="font-size: 9pt; color: #64748b;">${profile.companyAddress} | الهاتف المعتمد للإدارة: ${profile.companyPhone}</div>
          </div>
          <div class="meta-box">
            <div><strong>تاريخ الطباعة:</strong> ${timestamp}</div>
            <div><strong>نطاق التدقيق:</strong> شامل لكافة المحيلين والشركاء</div>
            <div><strong>المصادقة:</strong> تقرير مالي رسمي</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">إجمالي العمولات المصروفة</div>
            <div class="kpi-value purple">+${formatNumber(totalCommissionsPaid)} د.ع</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">رؤوس الأموال المستقطبة</div>
            <div class="kpi-value">${formatNumber(totalCapitalAttracted)} د.ع</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">عدد المحيلين والشركاء</div>
            <div class="kpi-value">${totalReferrersCount} محيل</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">المستثمرون المحالون</div>
            <div class="kpi-value">${totalReferredInvestorsCount} مستثمر</div>
          </div>
        </div>

        <div class="section-heading">أولاً: شبكات المحيلين واستقطاب رؤوس الأموال</div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">ت</th>
              <th>اسم المحيل</th>
              <th>رقم الهاتف</th>
              <th>الصفة</th>
              <th>رأس المال الشخصي</th>
              <th style="text-align: center;">المحالين</th>
              <th>رؤوس الأموال المستقطبة</th>
              <th>إجمالي العمولات المكتسبة</th>
            </tr>
          </thead>
          <tbody>
            ${referrersList.map((ref, i) => {
              const children = store.investors.filter(
                (c) => c.referredById === ref.id || c.contract?.referrerId === ref.id
              );
              const attracted = children.reduce((acc, c) => acc + (c.totalCapitalDeposited || 0), 0);
              const comm = ref.totalReferralCommissionsEarned || 0;
              return `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td><strong>${ref.name}</strong></td>
                  <td class="number">${ref.phone}</td>
                  <td>
                    <span class="badge ${ref.isReferralPartner ? 'badge-purple' : 'badge-blue'}">
                      ${ref.isReferralPartner ? 'شريك إحالة' : 'مستثمر ومحيل'}
                    </span>
                  </td>
                  <td class="number">${formatNumber(ref.totalCapitalDeposited)} د.ع</td>
                  <td style="text-align: center;"><strong>${children.length}</strong></td>
                  <td class="number">${formatNumber(attracted)} د.ع</td>
                  <td class="number" style="color: #6d28d9;">+${formatNumber(comm)} د.ع</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="section-heading">ثانياً: المستثمرون المحالون ونسب عمولة المحيل</div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">ت</th>
              <th>اسم المستثمر المحال</th>
              <th>المحيل المستقطب</th>
              <th>نسبة العمولة من الشركة</th>
              <th>رأس المال المودع</th>
              <th>الأرباح المكتسبة</th>
              <th>السيولة المتاحة</th>
            </tr>
          </thead>
          <tbody>
            ${referredInvestorsList.map((inv, i) => `
              <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td><strong>${inv.name}</strong></td>
                <td>${inv.referredByName || inv.contract?.referrerName || '—'}</td>
                <td><span class="badge badge-purple">${inv.contract?.referrerSharePercent || inv.referralSharePercent || 0}% من أرباح الشركة</span></td>
                <td class="number">${formatNumber(inv.totalCapitalDeposited)} د.ع</td>
                <td class="number">${formatNumber(inv.totalProfitsEarned)} د.ع</td>
                <td class="number">${formatNumber(inv.availableLiquidity)} د.ع</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div class="sig-box">
            <div>إعداد وتدقيق الحسابات</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-box">
            <div>مسؤول شؤون المستثمرين</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-box">
            <div>مصادقة المدير التنفيذي (${profile.managerName || 'أحمد إياد'})</div>
            <div class="sig-line"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center font-black">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                استقطاب رؤوس الأموال والعمولات الدورية
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              شبكة الإحالة والعمولات واستقطاب المستثمرين
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              تتبع مركزي ودقيق لكافة الوسطاء والمستثمرين المحيلين، ورصد رؤوس الأموال المستقطبة، وتوزيع عمولات الإحالة المستقطعة آلياً من أرباح شركة أمان مع كل قسط مسدد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <PrivacyToggleButton />
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة وسيط إحالة جديد</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700/80 flex items-center gap-2 transition-colors"
              title="تصدير بيانات الشبكة بملف Excel"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700/80 flex items-center gap-2 transition-colors"
              title="طباعة تقرير شبكة الإحالة A4"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 hover:border-purple-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-purple-300 font-semibold">
              <span>إجمالي العمولات المصروفة</span>
              <Coins className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-black text-purple-400 font-mono tracking-tight flex items-center">
              <span>+</span>
              <PrivacyMaskedAmount
                id="ref-kpi-commissions"
                value={totalCommissionsPaid}
                label="إجمالي العمولات المصروفة"
                size="lg"
                className="text-purple-400 font-black"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              مودعة في محافظ المحيلين من حصة الشركة
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>رؤوس الأموال المستقطبة</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono tracking-tight">
              <PrivacyMaskedAmount
                id="ref-kpi-attracted"
                value={totalCapitalAttracted}
                label="رؤوس الأموال المستقطبة"
                size="lg"
                className="text-emerald-400 font-black"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              إجمالي الودائع التي جلبها المحيلون
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 hover:border-blue-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>شبكة المحيلين والشركاء</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl font-black text-blue-400 font-mono tracking-tight">
              {totalReferrersCount} <span className="text-xs text-slate-400 font-normal">شخص</span>
            </p>
            <p className="text-[11px] text-slate-400">
              مستثمرون نشطون ووسطاء معتمدون
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>المستثمرون المُحالون</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl font-black text-amber-400 font-mono tracking-tight">
              {totalReferredInvestorsCount} <span className="text-xs text-slate-400 font-normal">مستثمر</span>
            </p>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>أرباحهم المحققة:</span>
              <PrivacyMaskedAmount
                id="ref-kpi-profits"
                value={totalProfitsGeneratedByReferred}
                label="أرباح المستثمرين المحالين"
                size="xs"
                className="text-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/70 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-slate-800/60 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Tabs & Filters Navigation Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Sub-Tabs Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveSubTab('networks')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'networks'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>شبكات المحيلين ({referrersList.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('referred_investors')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'referred_investors'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>المستثمرون المُحالون ({referredInvestorsList.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('commissions_ledger')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'commissions_ledger'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>سجل سندات العمولات ({allReferralTransactions.length})</span>
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2.5 flex-1 md:max-w-md justify-end">
          <PrivacyToggleButton variant="compact" />
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، رقم الهاتف، أو اسم المحيل..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
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

          {activeSubTab === 'networks' && (
            <select
              value={selectedPartnerFilter}
              onChange={(e) => setSelectedPartnerFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">جميع الشركاء</option>
              <option value="INVESTORS_WITH_CAPITAL">مستثمرون برأس مال</option>
              <option value="AFFILIATE_PARTNERS_ONLY">وسطاء إحالة فقط</option>
            </select>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: Networks & Hierarchy View */}
      {activeSubTab === 'networks' && (
        <div className="space-y-4">
          {filteredReferrers.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-500 space-y-3">
              <Share2 className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="text-sm font-bold text-slate-300">لا توجد شبكات إحالة مطابقة لمعايير البحث</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يمكنك تسجيل مستثمر جديد وربطه بمحيل، أو إضافة وسيط إحالة معتمد للبدء في تشغيل شبكة الإحالة.
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أول شريك إحالة</span>
              </button>
            </div>
          ) : (
            filteredReferrers.map((referrer) => {
              const children = store.investors.filter(
                (c) => c.referredById === referrer.id || c.contract?.referrerId === referrer.id
              );
              const totalAttracted = children.reduce((acc, c) => acc + (c.totalCapitalDeposited || 0), 0);
              const commsEarned = referrer.totalReferralCommissionsEarned || 0;
              const isExpanded = !!expandedReferrerIds[referrer.id];
              const isPurePartner = !!referrer.isReferralPartner;
              const brokerWallet = store.wallets.find((w) => w.id === referrer.walletId || w.ownerId === referrer.id);
              const brokerAvailable = brokerWallet ? brokerWallet.balance : (referrer.availableLiquidity || 0);

              return (
                <div
                  key={referrer.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 transition-all"
                >
                  {/* Referrer Header Strip */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                          isPurePartner
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {referrer.name.charAt(0)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PrivacyMaskedText id={`ref-name-${referrer.id}`} text={referrer.name} as="h3" className="text-base font-black text-white" />
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                              isPurePartner
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {isPurePartner ? 'شريك وسيط إحالة (دون رأس مال)' : 'مستثمر ومحيل برأس مال'}
                          </span>
                          {!isPurePartner && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              حصة عقده: {referrer.contract?.investorSharePercent}%
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <PrivacyMaskedText id={`ref-phone-${referrer.id}`} text={referrer.phone} label={`هاتف: ${referrer.name}`} size="xs" className="text-slate-400 font-mono text-xs" />
                          </span>
                          {referrer.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {referrer.address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons & Expand Toggle */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                      <button
                        onClick={() => openBrokerWithdrawModal(referrer)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-all"
                        title="صرف وسحب عمولة نقداً للوسيط مع سند صرف رسمي"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                        <span>سحب عمولة نقداً</span>
                      </button>

                      <button
                        onClick={() => openEditModal(referrer)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition-all"
                        title="تعديل بيانات الوسيط أو تعديل وتعيين نسب عمولة المستثمرين التابعين له"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>تعديل بيانات الوسيط / العمولة</span>
                      </button>

                      <button
                        onClick={() => setStatementInvestor(referrer)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-bold border border-purple-500/30 flex items-center gap-1.5 transition-all"
                        title="فتح كشف حساب عمولات الإحالة والطباعة"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>كشف حساب الإحالة</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(referrer.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <span>المستثمرون التابعون ({children.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Pills for This Referrer */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-0.5">
                      <span className="text-slate-400 text-[11px]">رأس المال الشخصي</span>
                      <div className="font-bold font-mono text-white">
                        <PrivacyMaskedAmount
                          id={`ref-cap-${referrer.id}`}
                          value={referrer.totalCapitalDeposited}
                          label={`رأس مال: ${referrer.name}`}
                          size="sm"
                          className="text-white"
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-0.5">
                      <span className="text-slate-400 text-[11px]">رؤوس أموال المستقطبين</span>
                      <div className="font-bold font-mono text-emerald-400">
                        <PrivacyMaskedAmount
                          id={`ref-attracted-${referrer.id}`}
                          value={totalAttracted}
                          label={`أموال مستقطبة: ${referrer.name}`}
                          size="sm"
                          className="text-emerald-400"
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-0.5">
                      <span className="text-slate-400 text-[11px]">المستثمرون المحالون</span>
                      <p className="font-bold font-mono text-blue-400">
                        {children.length} مستثمر
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-500/30 text-xs space-y-0.5">
                      <span className="text-purple-300 text-[11px] font-semibold">عمولات الإحالة المستلمة</span>
                      <div className="font-bold font-mono text-purple-300 flex items-center">
                        <span>+</span>
                        <PrivacyMaskedAmount
                          id={`ref-comms-${referrer.id}`}
                          value={commsEarned}
                          label={`عمولات مستلمة: ${referrer.name}`}
                          size="sm"
                          className="text-purple-300"
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs space-y-0.5">
                      <span className="text-emerald-300 text-[11px] font-semibold">المتاح للسحب نقداً</span>
                      <div className="font-bold font-mono text-emerald-400 flex items-center">
                        <PrivacyMaskedAmount
                          id={`ref-avail-${referrer.id}`}
                          value={brokerAvailable}
                          label={`متاح للسحب: ${referrer.name}`}
                          size="sm"
                          className="text-emerald-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Children / Referred Investors Network List */}
                  {isExpanded && (
                    <div className="pt-2">
                      {children.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-500">
                          لم يتم ربط مستثمرين بهذا المحيل حتى الآن. عند إضافة مستثمر جديد، اختر "{referrer.name}" كمحيل له.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-950 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                              <tr>
                                <th className="py-2.5 px-3 text-center w-9">ت</th>
                                <th className="py-2.5 px-3">المستثمر المحال</th>
                                <th className="py-2.5 px-3 text-center">تقسيم الربح (100%)</th>
                                <th className="py-2.5 px-3 text-left">رأس المال المودع</th>
                                <th className="py-2.5 px-3 text-left">إجمالي ربح العقود (100%)</th>
                                <th className="py-2.5 px-3 text-left">ربح المستثمر</th>
                                <th className="py-2.5 px-3 text-left">عمولة الوسيط</th>
                                <th className="py-2.5 px-3 text-left">صافي الشركة</th>
                                <th className="py-2.5 px-3 text-left">السيولة المتاحة</th>
                                <th className="py-2.5 px-3 text-center">الإجراءات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {children.map((child, idx) => {
                                const summary = buildReferredInvestorSummary(child, store.contracts);
                                const isContractsOpen = !!expandedChildContractIds[child.id];
                                return (
                                  <React.Fragment key={child.id}>
                                    <tr className="hover:bg-slate-900/40 transition-colors">
                                      <td className="py-2.5 px-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></span>
                                          <div>
                                            <PrivacyMaskedText id={`ref-child-name-${child.id}`} text={child.name} className="font-bold text-white" />
                                            <div className="text-[10.5px] text-slate-400 font-mono">
                                              <PrivacyMaskedText id={`ref-child-phone-${child.id}`} text={child.phone} label={`هاتف: ${child.name}`} size="xs" className="text-slate-400 font-mono text-[10.5px]" />
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <div className="inline-flex flex-col items-center gap-0.5 font-mono text-[10px]">
                                          <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
                                            <span className="text-emerald-400 font-bold" title="حصة المستثمر الممول من العقد">
                                              {summary.investorSharePercent}% مستثمر
                                            </span>
                                            <span className="text-slate-600">|</span>
                                            <span className="text-blue-400 font-bold" title="حصة الشركة من العقد">
                                              {summary.grossCompanySharePercent}% شركة
                                            </span>
                                          </div>
                                          {summary.referrerSharePercent > 0 && (
                                            <span className="text-purple-300 font-bold text-[9.5px]" title={`تُستقطع عمولة الوسيط (${summary.referrerSharePercent}%) بالكامل من حصة أرباح الشركة`}>
                                              عمولة الوسيط {summary.referrerSharePercent}% من الشركة
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-100">
                                        <PrivacyMaskedAmount
                                          id={`ref-child-cap-${child.id}`}
                                          value={child.totalCapitalDeposited}
                                          label={`رأس مال مودع: ${child.name}`}
                                          size="xs"
                                          className="text-slate-100"
                                        />
                                      </td>
                                      <td className="py-2.5 px-3 text-left font-mono">
                                        <div className="font-bold text-white">
                                          <PrivacyMaskedAmount
                                            id={`ref-child-totprof-${child.id}`}
                                            value={summary.collectedContractProfitIQD}
                                            label={`إجمالي ربح العقود المحصل (100%): ${child.name}`}
                                            size="xs"
                                            className="text-white"
                                          />
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          من {summary.contractsCount} عقد ({summary.totalPaidInstallments}/{summary.totalInstallments} قسط)
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-left font-mono">
                                        <div className="font-bold text-emerald-400 inline-flex items-center">
                                          <span>+</span>
                                          <PrivacyMaskedAmount
                                            id={`ref-child-prof-${child.id}`}
                                            value={summary.collectedInvestorProfitIQD}
                                            label={`ربح المستثمر (${summary.investorSharePercent}%): ${child.name}`}
                                            size="xs"
                                            className="text-emerald-400"
                                          />
                                        </div>
                                        <div className="text-[10px] text-emerald-500/70">حصة {summary.investorSharePercent}%</div>
                                      </td>
                                      <td className="py-2.5 px-3 text-left font-mono">
                                        <div className="font-bold text-purple-300 inline-flex items-center">
                                          <span>+</span>
                                          <PrivacyMaskedAmount
                                            id={`ref-child-refcomm-${child.id}`}
                                            value={summary.collectedReferrerProfitIQD}
                                            label={`عمولة الوسيط المحصلة (${summary.referrerSharePercent}%): ${referrer.name}`}
                                            size="xs"
                                            className="text-purple-300"
                                          />
                                        </div>
                                        <div className="text-[10px] text-purple-400/70" title={`عمولة الوسيط (${summary.referrerSharePercent}%) مقتطعة بالكامل من حصة أرباح الشركة`}>
                                          عمولة {summary.referrerSharePercent}% من الشركة
                                          {summary.remainingReferrerProfitIQD > 0 && ' (مجدولة متبقية)'}
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-left font-mono">
                                        <div className="font-bold text-blue-400 inline-flex items-center">
                                          <span>+</span>
                                          <PrivacyMaskedAmount
                                            id={`ref-child-compprof-${child.id}`}
                                            value={summary.collectedCompanyProfitIQD}
                                            label={`صافي ربح الشركة: ${child.name}`}
                                            size="xs"
                                            className="text-blue-400"
                                          />
                                        </div>
                                        <div className="text-[10px] text-blue-400/70">صافي بعد خصم العمولة</div>
                                      </td>
                                      <td className="py-2.5 px-3 text-left font-mono font-bold text-teal-400">
                                        <PrivacyMaskedAmount
                                          id={`ref-child-liq-${child.id}`}
                                          value={child.availableLiquidity}
                                          label={`سيولة متاحة: ${child.name}`}
                                          size="xs"
                                          className="text-teal-400"
                                        />
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button
                                            onClick={() => toggleChildContracts(child.id)}
                                            className={`px-2 py-1 rounded-lg font-bold text-[10.5px] border inline-flex items-center gap-1 transition-all ${
                                              isContractsOpen
                                                ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                            }`}
                                            title="عرض أو إخفاء تفصيل أرباح العقود"
                                          >
                                            <span>تفصيل العقود ({summary.contractsCount})</span>
                                            {isContractsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                          </button>
                                          <button
                                            onClick={() => openEditModal(child)}
                                            className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-[10.5px] border border-amber-500/30 inline-flex items-center gap-1 transition-all"
                                            title="تعديل نسبة العمولة أو بيانات المستثمر"
                                          >
                                            <Edit3 className="w-3 h-3 text-amber-400" />
                                            <span>تعديل</span>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                    {isContractsOpen && (
                                      <ReferralContractBreakdownRow
                                        summary={summary}
                                        referrerName={referrer.name}
                                        colSpan={10}
                                      />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUB-TAB 2: Referred Investors Table */}
      {activeSubTab === 'referred_investors' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">سجل المستثمرين المُحالين بواسطة شركاء</h2>
              <p className="text-xs text-slate-400">قائمة المستثمرين الذين دخلوا برؤوس أموال عن طريق شبكة الإحالة والوسطاء مع تفصيل أرباح عقودهم</p>
            </div>
            <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              {filteredReferredInvestors.length} مستثمر
            </span>
          </div>

          {filteredReferredInvestors.length === 0 ? (
            <div className="text-center py-16 text-slate-500 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="text-xs">لا يوجد مستثمرون محالون مسجلون حالياً</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3 text-center w-9">ت</th>
                    <th className="py-3 px-3">المستثمر المحال</th>
                    <th className="py-3 px-3">المحيل المستقطب</th>
                    <th className="py-3 px-3 text-center">تقسيم الربح (100%)</th>
                    <th className="py-3 px-3 text-left">رأس المال المودع</th>
                    <th className="py-3 px-3 text-left">إجمالي ربح العقود (100%)</th>
                    <th className="py-3 px-3 text-left">ربح المستثمر</th>
                    <th className="py-3 px-3 text-left">عمولة الوسيط</th>
                    <th className="py-3 px-3 text-left">صافي الشركة</th>
                    <th className="py-3 px-3 text-left">السيولة المتاحة</th>
                    <th className="py-3 px-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredReferredInvestors.map((inv, idx) => {
                    const summary = buildReferredInvestorSummary(inv, store.contracts);
                    const isContractsOpen = !!expandedChildContractIds[inv.id];
                    const refName = inv.referredByName || inv.contract?.referrerName || 'الوسيط';
                    return (
                      <React.Fragment key={inv.id}>
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div>
                              <PrivacyMaskedText id={`ref-inv-name-${inv.id}`} text={inv.name} as="p" className="font-bold text-white" />
                              <PrivacyMaskedText id={`ref-inv-phone-${inv.id}`} text={inv.phone} label={`هاتف: ${inv.name}`} size="xs" className="text-[11px] text-slate-400 font-mono" />
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <PrivacyMaskedText id={`ref-inv-referrer-${inv.id}`} text={refName} as="span" className="font-bold text-purple-400" />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex flex-col items-center gap-0.5 font-mono text-[10px]">
                              <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
                                <span className="text-emerald-400 font-bold" title="حصة المستثمر الممول من العقد">
                                  {summary.investorSharePercent}% مستثمر
                                </span>
                                <span className="text-slate-600">|</span>
                                <span className="text-blue-400 font-bold" title="حصة الشركة من العقد">
                                  {summary.grossCompanySharePercent}% شركة
                                </span>
                              </div>
                              {summary.referrerSharePercent > 0 && (
                                <span className="text-purple-300 font-bold text-[9.5px]" title={`تُستقطع عمولة الوسيط (${summary.referrerSharePercent}%) بالكامل من حصة أرباح الشركة`}>
                                  عمولة الوسيط {summary.referrerSharePercent}% من الشركة
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-left font-mono font-bold text-slate-100">
                            <PrivacyMaskedAmount
                              id={`ref-inv-cap-${inv.id}`}
                              value={inv.totalCapitalDeposited}
                              label={`رأس مال: ${inv.name}`}
                              size="xs"
                              className="text-slate-100"
                            />
                          </td>
                          <td className="py-3 px-3 text-left font-mono">
                            <div className="font-bold text-white">
                              <PrivacyMaskedAmount
                                id={`ref-inv-totprof-${inv.id}`}
                                value={summary.collectedContractProfitIQD}
                                label={`إجمالي ربح العقود (100%): ${inv.name}`}
                                size="xs"
                                className="text-white"
                              />
                            </div>
                            <div className="text-[10px] text-slate-400">
                              من {summary.contractsCount} عقد
                            </div>
                          </td>
                          <td className="py-3 px-3 text-left font-mono font-bold text-emerald-400">
                            <span className="inline-flex items-center">
                              <span>+</span>
                              <PrivacyMaskedAmount
                                id={`ref-inv-prof-${inv.id}`}
                                value={summary.collectedInvestorProfitIQD}
                                label={`أرباح: ${inv.name}`}
                                size="xs"
                                className="text-emerald-400"
                              />
                            </span>
                          </td>
                          <td className="py-3 px-3 text-left font-mono font-bold text-purple-300">
                            <span className="inline-flex items-center">
                              <span>+</span>
                              <PrivacyMaskedAmount
                                id={`ref-inv-refcomm-${inv.id}`}
                                value={summary.collectedReferrerProfitIQD}
                                label={`عمولة الوسيط: ${refName}`}
                                size="xs"
                                className="text-purple-300"
                              />
                            </span>
                          </td>
                          <td className="py-3 px-3 text-left font-mono font-bold text-blue-400">
                            <span className="inline-flex items-center">
                              <span>+</span>
                              <PrivacyMaskedAmount
                                id={`ref-inv-compprof-${inv.id}`}
                                value={summary.collectedCompanyProfitIQD}
                                label={`صافي الشركة: ${inv.name}`}
                                size="xs"
                                className="text-blue-400"
                              />
                            </span>
                          </td>
                          <td className="py-3 px-3 text-left font-mono font-bold text-teal-400">
                            <PrivacyMaskedAmount
                              id={`ref-inv-liq-${inv.id}`}
                              value={inv.availableLiquidity}
                              label={`سيولة: ${inv.name}`}
                              size="xs"
                              className="text-teal-400"
                            />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => toggleChildContracts(inv.id)}
                                className={`px-2 py-1.5 rounded-xl font-bold text-[11px] border inline-flex items-center gap-1 transition-all ${
                                  isContractsOpen
                                    ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                }`}
                              >
                                <span>تفصيل العقود ({summary.contractsCount})</span>
                                {isContractsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => openEditModal(inv)}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-[11px] border border-amber-500/30 inline-flex items-center gap-1 transition-all"
                                title="تعديل نسبة العمولة أو بيانات المستثمر"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                <span>تعديل</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isContractsOpen && (
                          <ReferralContractBreakdownRow
                            summary={summary}
                            referrerName={refName}
                            colSpan={11}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: Commissions Ledger & Cash Withdrawal Receipts */}
      {activeSubTab === 'commissions_ledger' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          {/* Sub-tab 3 Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">سجل القيود وسندات صرف عمولات الإحالة</h2>
              <p className="text-xs text-slate-400">
                متابعة دقيقة لاستحقاقات عمولات الإحالة الدورية وسندات الصرف والسحب النقدي مع إمكانية طباعة الوصل
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setLedgerFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  ledgerFilter === 'ALL'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                الكل ({filteredCommissionsLog.length + filteredWithdrawalsLog.length})
              </button>
              <button
                onClick={() => setLedgerFilter('ACCRUALS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  ledgerFilter === 'ACCRUALS'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                استحقاقات الأقساط ({filteredCommissionsLog.length})
              </button>
              <button
                onClick={() => setLedgerFilter('WITHDRAWALS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  ledgerFilter === 'WITHDRAWALS'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                سندات الصرف والسحب النقدي ({filteredWithdrawalsLog.length})
              </button>
            </div>
          </div>

          {/* Section 1: Broker Cash Withdrawals Table */}
          {(ledgerFilter === 'ALL' || ledgerFilter === 'WITHDRAWALS') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>سندات الصرف والسحب النقدي للوسطاء ({filteredWithdrawalsLog.length})</span>
                </span>
                {ledgerFilter === 'ALL' && filteredWithdrawalsLog.length > 0 && (
                  <span className="text-[11px] text-slate-500">سندات موثقة ومحفوظة بالخزينة</span>
                )}
              </div>

              {filteredWithdrawalsLog.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800 space-y-1">
                  <p>لا توجد سندات صرف وسحب نقدي مسجلة حتى الآن</p>
                  <p className="text-[11px] text-slate-600">
                    يمكن للوسيط سحب عمولته نقداً في أي وقت عبر زر "سحب عمولة نقداً" في الأعلى أو من بطاقة الوسيط.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3 text-center w-9">ت</th>
                        <th className="py-3 px-3 text-center">التاريخ</th>
                        <th className="py-3 px-3 text-center">رقم السند</th>
                        <th className="py-3 px-3">اسم الوسيط المستلم</th>
                        <th className="py-3 px-3">المحفظة / الحساب</th>
                        <th className="py-3 px-3 text-left">المبلغ المصروف نقداً</th>
                        <th className="py-3 px-3">البيان / الملاحظات</th>
                        <th className="py-3 px-3 text-center">وصل الاستلام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredWithdrawalsLog.map((tx, idx) => (
                        <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-400">
                            {tx.date ? new Date(tx.date).toISOString().split('T')[0] : '—'}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-amber-300">
                            #{String(tx.referenceNo || '').replace(/^#/, '')}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-white">{tx.investorName || '—'}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            {tx.fromWalletName || 'محفظة عمولات الوسيط'}
                          </td>
                          <td className="py-3 px-3 text-left font-mono font-bold text-rose-400">
                            <span className="inline-flex items-center">
                              <span>-</span>
                              <PrivacyMaskedAmount
                                id={`ref-wth-amt-${tx.id}`}
                                value={tx.amountIQD}
                                label={`سحب نقدي #${tx.referenceNo}`}
                                size="xs"
                                className="text-rose-400 font-bold"
                              />
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 text-[11px] max-w-xs truncate">
                            {tx.description || 'صرف عمولة إحالة نقداً'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleOpenPastWithdrawalReceipt(tx)}
                              className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-[11px] font-bold border border-purple-500/30 inline-flex items-center gap-1.5 transition-all shadow-sm"
                              title="معاينة وطباعة سند الصرف النقدي الرسمي (A5 / A4)"
                            >
                              <Printer className="w-3.5 h-3.5 text-purple-400" />
                              <span>طباعة الوصل</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Accruals from installments Table */}
          {(ledgerFilter === 'ALL' || ledgerFilter === 'ACCRUALS') && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  <span>استحقاقات عمولات الإحالة المستقطعة آلياً من الأقساط ({filteredCommissionsLog.length})</span>
                </span>
                {ledgerFilter === 'ALL' && (
                  <span className="text-[11px] text-slate-500">مستقطعة من أرباح شركة أمان</span>
                )}
              </div>

              {filteredCommissionsLog.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <Receipt className="w-9 h-9 mx-auto text-slate-600 stroke-[1.5]" />
                  <p className="text-xs">لا توجد استحقاقات عمولة إحالة مسجلة حتى الآن</p>
                  <p className="text-[11px] text-slate-500">
                    يتم توليد السندات آلياً مع كل قسط يتم تسديده لعقود المستثمرين المحالين
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3 text-center w-9">ت</th>
                        <th className="py-3 px-3 text-center">التاريخ</th>
                        <th className="py-3 px-3 text-center">رقم السند</th>
                        <th className="py-3 px-3">الوسيط المستلم</th>
                        <th className="py-3 px-3">المستثمر الممول</th>
                        <th className="py-3 px-3">العقد / الزبون</th>
                        <th className="py-3 px-3 text-left">ربح القسط المسدد (100%)</th>
                        <th className="py-3 px-3 text-center">نسبة ومبلغ عمولة الوسيط</th>
                        <th className="py-3 px-3 text-center">المحفظة المودع بها</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredCommissionsLog.map((tx, idx) => {
                        const voucher = resolveReferralCommissionVoucher(tx, store.investors, store.contracts);
                        return (
                          <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                            <td className="py-3 px-3 text-center font-mono text-slate-400">{voucher.date}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-amber-300">
                              {voucher.referenceNo}
                            </td>
                            <td className="py-3 px-3">
                              <PrivacyMaskedText id={`ref-comm-inv-${tx.id}`} text={voucher.referrerName} as="span" className="font-bold text-purple-400" />
                            </td>
                            <td className="py-3 px-3">
                              <PrivacyMaskedText id={`ref-comm-inv-sub-${tx.id}`} text={voucher.referredInvestorName} as="span" className="font-bold text-emerald-400" />
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-mono font-bold text-amber-300 text-[11px]">{voucher.contractNumber}</div>
                              <div className="text-slate-300 text-[11px]">
                                <PrivacyMaskedText id={`ref-comm-borrower-${tx.id}`} text={voucher.borrowerName} size="xs" className="text-slate-300 font-medium" />
                              </div>
                            </td>
                            <td className="py-3 px-3 text-left font-mono">
                              <div className="font-bold text-white">
                                <PrivacyMaskedAmount
                                  id={`ref-comm-totprof-${tx.id}`}
                                  value={voucher.installmentTotalProfitIQD}
                                  label={`ربح القسط المسدد (100%) لسند #${voucher.referenceNo}`}
                                  size="xs"
                                  className="text-white"
                                />
                              </div>
                              <div className="text-[10px] text-slate-400">
                                مستثمر ({voucher.investorSharePercent}%) + شركة ({100 - voucher.investorSharePercent}%) مع عمولة الوسيط ({voucher.commissionPercent}%)
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="inline-flex items-center gap-1.5 font-mono font-bold text-purple-300 bg-purple-500/10 border border-purple-500/25 px-2.5 py-1 rounded-lg">
                                <span className="text-[10.5px] bg-purple-500/20 text-purple-200 px-1.5 py-0.5 rounded">
                                  {voucher.commissionPercent}%
                                </span>
                                <span className="text-slate-500">←</span>
                                <span className="inline-flex items-center">
                                  <span>+</span>
                                  <PrivacyMaskedAmount
                                    id={`ref-comm-amt-${tx.id}`}
                                    value={voucher.commissionAmountIQD}
                                    label={`عمولة سند #${voucher.referenceNo}`}
                                    size="xs"
                                    className="text-purple-300"
                                  />
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-400 text-[11px]">
                              {voucher.toWalletName}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Referral Broker Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تسجيل وسيط إحالة معتمد (دون رأس مال)</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">إضافة وسيط مستقل مهمته استقطاب وجلب المستثمرين للشركة مقابل عمولة إحالة</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Broker Info Banner */}
              <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-purple-200 space-y-1">
                <p className="font-bold text-purple-300 flex items-center gap-1.5">
                  <span>✨ حساب وسيط إحالة مستقل (مفصول تماماً عن المستثمرين):</span>
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  يُدرج الوسيط في شاشة الإحالات فقط ولا يظهر في قوائم المستثمرين أو المخزن أو العقود. عند رغبته في إيداع رأس مال كمستثمر فعلي، يتم تسجيله من شاشة <strong>المستثمرين والمحافظ</strong>.
                </p>
              </div>

              {/* Duplicate Warning */}
              <DuplicateWarningBanner matchResult={duplicateMatches} entityLabel="مستثمر" />

              <div className="space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/60">
                  <span className="w-1.5 h-3.5 rounded-full bg-purple-500"></span>
                  <span className="text-xs font-bold text-slate-200">البيانات الشخصية والتوثيق للوسيط</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold">اسم الوسيط الكامل *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="مثال: خالد عبد الرحمن أو بشير جاسم"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold">رقم الهاتف *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: toEnglishDigits(e.target.value) }))}
                      placeholder="0770xxxxxxx"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold">السكن / العنوان</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                      placeholder="سامراء - حي المعلمين"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold">ملاحظات (اختياري)</label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="وسيط معتمد لاستقطاب المستثمرين..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <DocumentDateField
                  value={formData.date}
                  onChange={(dateStr) => setFormData((p) => ({ ...p, date: dateStr }))}
                  label="تاريخ تسجيل الوسيط"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmittingAdd}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
                >
                  {isSubmittingAdd ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>تأكيد التسجيل وإنشاء المحفظة</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Broker / Referred Investor & Commission Modal */}
      {isEditModalOpen && editingTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {isReferralBroker(editingTarget)
                      ? `تعديل بيانات الوسيط "${editingTarget.name}" ونسب عمولاته`
                      : `تعديل بيانات المستثمر "${editingTarget.name}" ونسبة العمولة`}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    تحديث البيانات الشخصية وتعيين أو تعديل نسبة عمولة الإحالة بأثر فوري على الأقساط غير المسددة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Personal Info Section */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/80">
                  <span className="w-1.5 h-3.5 rounded-full bg-amber-500"></span>
                  <span className="font-bold text-slate-200">البيانات الشخصية والتوثيق</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold">الاسم الكامل *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold">رقم الهاتف *</label>
                    <input
                      type="tel"
                      required
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: toEnglishDigits(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-amber-500 text-right"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold">العنوان / السكن</label>
                    <input
                      type="text"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold">ملاحظات</label>
                    <input
                      type="text"
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* If editing a Capital Investor: allow editing their Contract Split + Assigned Referrer & Commission % */}
              {!isReferralBroker(editingTarget) && (
                <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300 flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-purple-400" />
                      <span>الوسيط المُحيل لهذا المستثمر ونسبة العمولة</span>
                    </span>
                    <span className="text-[10px] text-purple-300/80">تُقتطع من حصة أرباح الشركة</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-bold block">الوسيط / المُحيل:</label>
                      <select
                        value={editFormData.referrerId}
                        onChange={(e) => {
                          const refId = e.target.value;
                          setEditFormData({
                            ...editFormData,
                            referrerId: refId,
                            referrerSharePercent: refId
                              ? editFormData.referrerSharePercent > 0
                                ? editFormData.referrerSharePercent
                                : 10
                              : 0
                          });
                        }}
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">بدون وسيط إحالة (مباشر للشركة)</option>
                        {eligibleReferrers
                          .filter((inv) => inv.id !== editingTarget.id)
                          .map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name} {isReferralBroker(inv) ? '(وسيط إحالة معتمد)' : '(مستثمر وشريك)'}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-bold block">نسبة عمولة الوسيط (%):</label>
                      <input
                        type="number"
                        min={0}
                        max={editFormData.companySharePercent}
                        step="0.5"
                        disabled={!editFormData.referrerId}
                        value={editFormData.referrerId ? editFormData.referrerSharePercent : 0}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            referrerSharePercent: Math.max(0, Number(e.target.value) || 0)
                          })
                        }
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-purple-500/40 disabled:opacity-40 text-purple-300 font-black text-center font-mono text-sm focus:outline-none focus:border-purple-500"
                      />
                      {editFormData.referrerId && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {[5, 10, 15, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setEditFormData({ ...editFormData, referrerSharePercent: pct })}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                Number(editFormData.referrerSharePercent) === pct
                                  ? 'bg-purple-500 text-white border-purple-400'
                                  : 'bg-slate-900 text-purple-300 border-slate-800 hover:border-purple-500/40'
                              }`}
                            >
                              %{pct}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Manage Investors Referred by this Broker / Referrer */}
              {(() => {
                const brokerChildren = store.investors.filter(
                  (c) => c.referredById === editingTarget.id || c.contract?.referrerId === editingTarget.id
                );
                const linkableCapitalInvestors = capitalInvestors.filter(
                  (c) =>
                    c.id !== editingTarget.id &&
                    c.referredById !== editingTarget.id &&
                    c.contract?.referrerId !== editingTarget.id
                );

                return (
                  <div className="p-4 rounded-2xl bg-amber-950/15 border border-amber-500/30 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-400" />
                        <span>المستثمرون التابعون لـ "{editingTarget.name}" وتعديل عمولتهم ({brokerChildren.length})</span>
                      </span>
                    </div>

                    {brokerChildren.length > 0 ? (
                      <div className="space-y-2">
                        {brokerChildren.map((child) => {
                          const currentPct = child.contract?.referrerSharePercent ?? child.referralSharePercent ?? 0;
                          return (
                            <div
                              key={child.id}
                              className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <p className="font-bold text-white text-xs">{child.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  رأس المال: {formatIQD(child.totalCapitalDeposited)} د.ع • العمولة الحالية:{' '}
                                  <strong className="text-amber-400 font-mono">%{currentPct}</strong>
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {[5, 10, 15, 20].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    disabled={isSubmittingEdit}
                                    onClick={() => handleAssignOrUpdateReferredInvestor(child, editingTarget, pct)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                      Number(currentPct) === pct
                                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                                        : 'bg-slate-900 text-amber-300 border-slate-800 hover:border-amber-500/40'
                                    }`}
                                  >
                                    %{pct}
                                  </button>
                                ))}
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.5"
                                  defaultValue={currentPct}
                                  onBlur={(e) => {
                                    const nextVal = Math.max(0, Number(e.target.value) || 0);
                                    if (nextVal !== Number(currentPct)) {
                                      handleAssignOrUpdateReferredInvestor(child, editingTarget, nextVal);
                                    }
                                  }}
                                  className="w-16 p-1 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-mono font-bold text-center text-xs"
                                  title="اكتب نسبة مخصصة ثم اضغط خارج الحقل للحفظ"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        لا يوجد مستثمرون مرتبطون بهذا الوسيط حالياً. يمكنك ربط مستثمر حالي به وتحديد نسبة العمولة أدناه:
                      </p>
                    )}

                    {/* Quick Link Existing Investor to this Broker */}
                    {linkableCapitalInvestors.length > 0 && (
                      <div className="pt-2 border-t border-amber-500/20 space-y-2">
                        <label className="text-slate-300 font-bold block text-[11px]">
                          ربط مستثمر مسجل بهذا الوسيط وتعيين نسبة عمولته فوراً:
                        </label>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <select
                            value={quickLinkInvestorId}
                            onChange={(e) => setQuickLinkInvestorId(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                          >
                            <option value="">— اختر المستثمر لربطه بالوسيط "{editingTarget.name}" —</option>
                            {linkableCapitalInvestors.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} (رأس المال: {formatNumber(inv.totalCapitalDeposited)} د.ع)
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[11px] shrink-0">العمولة %:</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              value={quickLinkCommissionPct}
                              onChange={(e) => setQuickLinkCommissionPct(Math.max(0, Number(e.target.value) || 0))}
                              className="w-20 bg-slate-950 border border-amber-500/40 rounded-xl px-2.5 py-2 text-amber-400 font-mono font-bold text-center text-xs"
                            />
                            <button
                              type="button"
                              disabled={!quickLinkInvestorId || isSubmittingEdit}
                              onClick={() => {
                                const targetInv = store.investors.find((i) => i.id === quickLinkInvestorId);
                                if (targetInv) {
                                  handleAssignOrUpdateReferredInvestor(targetInv, editingTarget, quickLinkCommissionPct);
                                }
                              }}
                              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs whitespace-nowrap transition-all"
                            >
                              ربط وتعيين العمولة
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Referrer Statement Modal */}
      {statementInvestor && (
        <InvestorStatementModal
          isOpen={!!statementInvestor}
          onClose={() => setStatementInvestor(null)}
          wallet={store.wallets.find((w) => w.ownerId === statementInvestor.id) || null}
          investor={statementInvestor}
          allTransactions={store.transactions}
          investorsList={store.investors}
          walletsList={store.wallets}
        />
      )}

      {/* Broker Cash Withdrawal Modal */}
      {isWithdrawModalOpen && selectedWithdrawBroker && (() => {
        const brokerWallet = store.wallets.find(
          (w) => w.id === selectedWithdrawBroker.walletId || w.ownerId === selectedWithdrawBroker.id
        );
        const prevBalance = brokerWallet ? brokerWallet.balance : (selectedWithdrawBroker.availableLiquidity || 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">سحب وصرف عمولة نقداً للوسيط</h3>
                    <p className="text-xs text-slate-400">
                      {selectedWithdrawBroker.name} {selectedWithdrawBroker.phone && `• ${selectedWithdrawBroker.phone}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleConfirmBrokerWithdraw} className="p-5 space-y-4 text-xs">
                {/* Available Balance Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-teal-950/20 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>رصيد العمولات المتاح للسحب حالياً:</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      جاهز للصرف
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                    {formatIQD(prevBalance)} <span className="text-xs font-bold text-slate-400">د.ع</span>
                  </div>
                  {brokerWallet && (
                    <div className="text-[10.5px] text-slate-400">
                      المحفظة: <span className="text-slate-300 font-medium">{brokerWallet.ownerName}</span>
                    </div>
                  )}
                </div>

                {/* Amount Field with Quick Presets */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-300">
                    المبلغ المطلوب سحبه نقداً (د.ع) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={withdrawFormData.amountIQD ? withdrawFormData.amountIQD.toLocaleString('en-US') : ''}
                      onChange={(e) => {
                        const clean = toEnglishDigits(e.target.value).replace(/,/g, '');
                        const val = Math.max(0, Number(clean) || 0);
                        setWithdrawFormData((prev) => ({ ...prev, amountIQD: val }));
                      }}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-base text-white font-mono font-bold focus:outline-none focus:border-emerald-500 text-left"
                      dir="ltr"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      د.ع
                    </span>
                  </div>

                  {/* Percentage Presets */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[
                      { label: '25%', pct: 0.25 },
                      { label: '50%', pct: 0.5 },
                      { label: '75%', pct: 0.75 },
                      { label: '100% (الكل)', pct: 1.0 },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          const calculated = Math.round(prevBalance * item.pct);
                          setWithdrawFormData((prev) => ({ ...prev, amountIQD: calculated }));
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700/60 hover:border-emerald-500/40 font-mono font-bold text-[11px] transition-all text-center"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Tafqeet in Arabic Words */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11.5px] text-emerald-400/90 leading-relaxed">
                    <span className="text-slate-500 font-semibold ml-1">فقط:</span>
                    <span className="font-bold">{tafqeetIQD(Number(withdrawFormData.amountIQD) || 0)}</span>
                  </div>
                </div>

                {/* Document Details: Receipt No & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-semibold text-[11px]">
                      رقم السند التسلسلي <span className="text-slate-500">(تلقائي)</span>
                    </label>
                    <input
                      type="text"
                      value={withdrawFormData.receiptNo}
                      onChange={(e) => setWithdrawFormData((prev) => ({ ...prev, receiptNo: e.target.value }))}
                      placeholder="#1"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-semibold text-[11px]">
                      تاريخ صرف السند
                    </label>
                    <DocumentDateField
                      value={withdrawFormData.date}
                      onChange={(val) => setWithdrawFormData((prev) => ({ ...prev, date: val }))}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold text-[11px]">
                    ملاحظات وبيان الصرف
                  </label>
                  <input
                    type="text"
                    value={withdrawFormData.notes}
                    onChange={(e) => setWithdrawFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="بيان سند الصرف..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    disabled={isSubmittingWithdraw}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingWithdraw || !withdrawFormData.amountIQD || withdrawFormData.amountIQD <= 0}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-black transition-all shadow-lg shadow-emerald-600/25 flex items-center gap-2"
                  >
                    {isSubmittingWithdraw ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الصرف والتوثيق...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد الصرف وطباعة الوصل</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Official Withdrawal Receipt Modal */}
      {isWithdrawReceiptModalOpen && selectedWithdrawReceipt && (
        <InvestorWithdrawalReceiptModal
          isOpen={isWithdrawReceiptModalOpen}
          onClose={() => {
            setIsWithdrawReceiptModalOpen(false);
            setSelectedWithdrawReceipt(null);
          }}
          receipt={selectedWithdrawReceipt}
        />
      )}
    </div>
  );
};
