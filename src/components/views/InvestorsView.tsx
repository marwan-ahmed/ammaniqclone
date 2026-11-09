'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  ShieldCheck,
  Wallet,
  FileText,
  ChevronLeft,
  Percent,
  Search,
  Boxes,
  TrendingUp,
  X,
  CheckCircle2,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Building2,
  Receipt,
  ArrowDownLeft,
  AlertTriangle,
  Loader2,
  Printer,
  Calendar,
  Edit3
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { Investor } from '@/types/finance';
import { findDuplicateMatches } from '@/utils/nameSimilarity';
import { DuplicateWarningBanner } from '@/components/common/DuplicateWarningBanner';
import { InvestorStatementModal } from '@/components/common/InvestorStatementModal';
import {
  InvestorWithdrawalReceiptModal,
  InvestorWithdrawalReceiptData
} from '@/components/common/InvestorWithdrawalReceiptModal';
import { getNextInvestorWithdrawalReceiptNumber } from '@/utils/receiptNumbering';
import { formatNumber, toEnglishDigits, formatIQD, formatTime } from '@/utils/formatters';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { usePrivacy } from '@/context/PrivacyContext';
import { getCapitalInvestors, getEligibleReferrers, isReferralBroker } from '@/utils/investorSelectors';
import { getContractNumber } from '@/components/common/ContractDocumentHubModal';

export { formatIQD };

interface InvestorsViewProps {
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
  onWithdrawInvestor?: (data: {
    investorId: string;
    amountIQD: number;
    type?: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
    notes?: string;
    receiptNo?: string;
    date?: string;
  }) => any;
}

type ViewMode = 'table' | 'general_statement' | 'inventory' | 'loans' | 'details';

export const InvestorsView: React.FC<InvestorsViewProps> = ({
  store,
  onAddInvestor,
  onUpdateInvestor,
  onWithdrawInvestor
}) => {
  const { lockAll, unlockedItemIds } = usePrivacy();
  const capitalInvestors = useMemo(() => getCapitalInvestors(store.investors), [store.investors]);
  const eligibleReferrers = useMemo(() => getEligibleReferrers(store.investors), [store.investors]);

  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(
    () => getCapitalInvestors(store.investors)[0]?.id || null
  );
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Privacy / Masking States
  const [isGlobalPrivacyActive, setIsGlobalPrivacyActive] = useState<boolean>(false);
  const [hiddenInvestorIds, setHiddenInvestorIds] = useState<string[]>([]);
  const [isPrivacyMenuOpen, setIsPrivacyMenuOpen] = useState<boolean>(false);

  // Form State for New Investor
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: 'سامراء - ',
    nationalId: '',
    capitalAmount: 10000000,
    investorSharePercent: 60,
    companySharePercent: 40,
    referrerId: '',
    referrerSharePercent: 0,
    isReferralPartner: false,
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Real-time Duplicate Checking
  const investorDuplicateMatches = useMemo(() => {
    return findDuplicateMatches(formData.name, formData.phone, store.investors);
  }, [formData.name, formData.phone, store.investors]);

  const [notification, setNotification] = useState<string | null>(null);

  // Submitting States for Visual Feedback & Anti-Double-Click
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Cash Withdrawal & Edit Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isWithdrawReceiptModalOpen, setIsWithdrawReceiptModalOpen] = useState(false);
  const [selectedWithdrawReceipt, setSelectedWithdrawReceipt] = useState<InvestorWithdrawalReceiptData | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInvestorId, setEditingInvestorId] = useState<string | null>(null);
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

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setIsWithdrawModalOpen(false);
        setIsEditModalOpen(false);
      }
    };
    if (isAddModalOpen || isWithdrawModalOpen || isEditModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isAddModalOpen, isWithdrawModalOpen, isEditModalOpen]);
  const [withdrawFormData, setWithdrawFormData] = useState<{
    amountIQD: number;
    type: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
    notes: string;
    receiptNo: string;
    date: string;
  }>({
    amountIQD: 1000000,
    type: 'PROFIT_WITHDRAWAL',
    notes: '',
    receiptNo: '',
    date: new Date().toISOString().split('T')[0]
  });

  const selectedInvestor = capitalInvestors.find((i) => i.id === selectedInvestorId) || capitalInvestors[0];
  const investorWallet = store.wallets.find((w) => w.id === selectedInvestor?.walletId || w.ownerId === selectedInvestor?.id);
  const investorItems = store.inventory.filter((inv) => inv.investorId === selectedInvestorId);
  const investorContracts = store.contracts.filter((c) => c.investorId === selectedInvestorId);

  // Expanded Insights calculations for the selected investor:
  const investorWithdrawals = useMemo(() => {
    if (!selectedInvestor) return [];
    return store.transactions.filter(
      (tx) =>
        tx.investorId === selectedInvestor.id &&
        (tx.type === 'PROFIT_DISTRIBUTION' ||
         tx.type === 'INVESTOR_WITHDRAWAL' ||
         (tx.type === 'EXPENSE' && tx.fromWalletId === investorWallet?.id) ||
         tx.description?.includes('سحب'))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [store.transactions, selectedInvestor, investorWallet]);

  const totalWithdrawnAmount = useMemo(() => {
    return investorWithdrawals.reduce((sum, tx) => sum + tx.amountIQD, 0);
  }, [investorWithdrawals]);

  const totalInventoryValuation = useMemo(() => {
    return investorItems.reduce((sum, item) => sum + item.totalCostIQD, 0);
  }, [investorItems]);

  const activeLoansPrincipal = useMemo(() => {
    return investorContracts.reduce((sum, c) => {
      const unpaid = c.schedules && c.schedules.length > 0
        ? c.schedules.filter(s => s.status !== 'PAID').reduce((sSum, s) => sSum + (s.principalAmountIQD || 0), 0)
        : (c.financedAmountIQD || 0);
      return sum + unpaid;
    }, 0);
  }, [investorContracts]);

  const totalNetPortfolioValuation = useMemo(() => {
    return (investorWallet?.balance || 0) + totalInventoryValuation + activeLoansPrincipal;
  }, [investorWallet?.balance, totalInventoryValuation, activeLoansPrincipal]);

  // Statement filters & calculation for General Withdrawals across all investors
  const [statementStartDate, setStatementStartDate] = useState<string>('2026-01-01');
  const [statementEndDate, setStatementEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statementInvestorFilter, setStatementInvestorFilter] = useState<string>('ALL');
  const [statementSearchQuery, setStatementSearchQuery] = useState<string>('');

  const allInvestorsGeneralWithdrawalRows = useMemo(() => {
    const rows: {
      id: string;
      investorId: string;
      investorName: string;
      previousBalance: number;
      withdrawnAmount: number;
      remainingBalance: number;
      date: string;
      description: string;
      notes: string;
      type: string;
      referenceNo: string;
      isPurchase: boolean;
      isProfitDist: boolean;
    }[] = [];

    capitalInvestors.forEach((inv) => {
      const invWallet = store.wallets.find((w) => w.id === inv.walletId || w.ownerId === inv.id);
      if (!invWallet) return;

      const investorTxs = (store.transactions || [])
        .filter(
          (tx) =>
            tx.fromWalletId === invWallet.id ||
            tx.toWalletId === invWallet.id ||
            tx.investorId === inv.id
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningBal = 0;
      for (const tx of investorTxs) {
        const isIncoming =
          tx.toWalletId === invWallet.id &&
          (tx.type === 'DEPOSIT' || tx.type === 'PAYMENT_RECEIVED' || tx.type === 'REVENUE');
        const isWithdrawal =
          tx.type === 'PURCHASE_INVENTORY' ||
          tx.type === 'PROFIT_DISTRIBUTION' ||
          tx.type === 'INVESTOR_WITHDRAWAL' ||
          tx.type === 'WITHDRAWAL' ||
          (tx.type === 'EXPENSE' && tx.fromWalletId === invWallet.id) ||
          tx.description?.includes('سحب') ||
          (tx.fromWalletId === invWallet.id && tx.toWalletId !== invWallet.id);

        if (isIncoming) {
          runningBal += tx.amountIQD;
        } else if (isWithdrawal) {
          const prevBal = runningBal;
          const amt = tx.amountIQD;
          const remBal = Math.max(0, prevBal - amt);
          runningBal = remBal;

          const isPurchase = tx.type === 'PURCHASE_INVENTORY';
          const isProfitDist = tx.type === 'PROFIT_DISTRIBUTION' || tx.description?.includes('أرباح');

          rows.push({
            id: tx.id,
            investorId: inv.id,
            investorName: inv.name,
            previousBalance: prevBal,
            withdrawnAmount: amt,
            remainingBalance: remBal,
            date: tx.date,
            description: tx.description || (isPurchase ? 'شراء مواد وبضائع بالمخزن' : 'سحب نقدي من الصندوق'),
            notes: tx.referenceNo ? `سند: ${tx.referenceNo}` : '—',
            type: tx.type,
            referenceNo: tx.referenceNo || '',
            isPurchase,
            isProfitDist
          });
        }
      }
    });

    return rows
      .filter((r) => {
        if (statementInvestorFilter !== 'ALL' && r.investorId !== statementInvestorFilter) return false;
        if (statementStartDate && r.date < statementStartDate) return false;
        if (statementEndDate && r.date > statementEndDate) return false;
        if (statementSearchQuery.trim()) {
          const q = statementSearchQuery.toLowerCase().trim();
          const match =
            r.investorName.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.notes.toLowerCase().includes(q) ||
            r.referenceNo.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [capitalInvestors, store.wallets, store.transactions, statementInvestorFilter, statementStartDate, statementEndDate, statementSearchQuery]);

  const handleWithdrawAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = toEnglishDigits(e.target.value).replace(/[^\d]/g, '');
    const num = digitsOnly ? parseInt(digitsOnly, 10) : 0;
    setWithdrawFormData((prev) => ({
      ...prev,
      amountIQD: num
    }));
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestor || !investorWallet || isSubmittingWithdraw) return;

    if (withdrawFormData.amountIQD <= 0) {
      alert('يرجى إدخال مبلغ سحب صحيح أكبر من صفر');
      return;
    }

    if (withdrawFormData.amountIQD > investorWallet.balance) {
      alert(`الرصيد المتاح (${formatNumber(investorWallet.balance)} د.ع) غير كافٍ لسحب هذا المبلغ`);
      return;
    }

    const prevBalance = investorWallet.balance;
    const newBalance = Math.max(0, prevBalance - withdrawFormData.amountIQD);
    const assignedReceiptNo =
      withdrawFormData.receiptNo && withdrawFormData.receiptNo.trim()
        ? withdrawFormData.receiptNo.trim()
        : getNextInvestorWithdrawalReceiptNumber(store.transactions);

    const payload = {
      investorId: selectedInvestor.id,
      amountIQD: withdrawFormData.amountIQD,
      type: withdrawFormData.type,
      notes: withdrawFormData.notes,
      receiptNo: assignedReceiptNo,
      date: withdrawFormData.date
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
        setNotification(`✅ ${result.message}`);
        setTimeout(() => setNotification(null), 5000);

        // Instantly generate and open A5 Printed Receipt Modal
        const receiptData: InvestorWithdrawalReceiptData = {
          receiptNo: assignedReceiptNo,
          date: withdrawFormData.date || new Date().toISOString().split('T')[0],
          time: formatTime(new Date(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          investorId: selectedInvestor.id,
          investorName: selectedInvestor.name,
          investorPhone: selectedInvestor.phone,
          investorAddress: selectedInvestor.address,
          walletName: investorWallet.ownerName,
          amountIQD: withdrawFormData.amountIQD,
          type: withdrawFormData.type,
          previousBalance: prevBalance,
          newBalance: newBalance,
          totalCapitalDeposited: selectedInvestor.totalCapitalDeposited,
          investorSharePercent: selectedInvestor.contract.investorSharePercent,
          notes: withdrawFormData.notes,
          recordedBy: 'أحمد إياد'
        };
        setSelectedWithdrawReceipt(receiptData);
        setIsWithdrawReceiptModalOpen(true);

        setWithdrawFormData({
          amountIQD: 0,
          type: 'PROFIT_WITHDRAWAL',
          notes: '',
          receiptNo: '',
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        alert(result?.message || 'تعذر إتمام عملية السحب النقدي');
      }
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const handleOpenPastWithdrawalReceipt = (tx: any) => {
    if (!selectedInvestor || !investorWallet) return;
    const isCapital = tx.description?.includes('رأس') || tx.type === 'CAPITAL_WITHDRAWAL';
    const isProfit = tx.description?.includes('أرباح') || tx.type === 'PROFIT_DISTRIBUTION' || tx.type === 'PROFIT_WITHDRAWAL';
    const withdrawalType: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL' =
      isCapital ? 'CAPITAL_WITHDRAWAL' : isProfit ? 'PROFIT_WITHDRAWAL' : 'GENERAL_WITHDRAWAL';

    const cleanReceiptNo = tx.referenceNo ? String(tx.referenceNo).replace(/^#/, '') : '1';

    const receiptData: InvestorWithdrawalReceiptData = {
      receiptNo: cleanReceiptNo,
      date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      time: formatTime(new Date(tx.date || new Date()), { hour: '2-digit', minute: '2-digit' }),
      investorId: selectedInvestor.id,
      investorName: selectedInvestor.name,
      investorPhone: selectedInvestor.phone,
      investorAddress: selectedInvestor.address,
      walletName: investorWallet.ownerName,
      amountIQD: Number(tx.amountIQD) || 0,
      type: withdrawalType,
      previousBalance: investorWallet.balance + (Number(tx.amountIQD) || 0),
      newBalance: investorWallet.balance,
      totalCapitalDeposited: selectedInvestor.totalCapitalDeposited,
      investorSharePercent: selectedInvestor.contract.investorSharePercent,
      notes: tx.description,
      recordedBy: 'أحمد إياد'
    };
    setSelectedWithdrawReceipt(receiptData);
    setIsWithdrawReceiptModalOpen(true);
  };

  // Privacy helpers
  const isInvestorHidden = (investorId: string) => {
    return isGlobalPrivacyActive || hiddenInvestorIds.includes(investorId);
  };

  const toggleInvestorPrivacy = (investorId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHiddenInvestorIds((prev) =>
      prev.includes(investorId)
        ? prev.filter((id) => id !== investorId)
        : [...prev, investorId]
    );
  };

  const handleToggleHideAll = () => {
    if (hiddenInvestorIds.length === capitalInvestors.length || isGlobalPrivacyActive) {
      setIsGlobalPrivacyActive(false);
      setHiddenInvestorIds([]);
    } else {
      setIsGlobalPrivacyActive(false);
      setHiddenInvestorIds(capitalInvestors.map((i) => i.id));
    }
  };

  // Filtered Investors list for search (excludes pure referral brokers)
  const filteredInvestors = capitalInvestors.filter(
    (inv) =>
      inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.phone.includes(searchQuery) ||
      (inv.address && inv.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filtered Inventory list for search in Tab 2
  const filteredInventory = store.inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.investorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtered Contracts list for search in Tab 3
  const filteredContracts = store.contracts.filter(
    (contract) =>
      contract.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.investorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.inventoryItemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getContractNumber(contract).includes(searchQuery.trim())
  );

  // Totals across all capital investors
  const totalCapitalAll = capitalInvestors.reduce((sum, i) => sum + i.totalCapitalDeposited, 0);
  const totalLiquidityAll = capitalInvestors.reduce((sum, i) => sum + i.availableLiquidity, 0);
  const totalProfitsAll = capitalInvestors.reduce((sum, i) => sum + i.totalProfitsEarned, 0);
  const totalInventoryValuationAll = store.inventory
    .filter((i) => i.status !== 'FULLY_FINANCED' && (i.quantity ?? 0) > 0)
    .reduce((sum, i) => sum + ((i.quantity || 0) * (i.unitCostIQD || 0)), 0);
  const totalLoansValuationAll = store.contracts.reduce((sum, c) => sum + c.totalSalePriceIQD, 0);

  const handleSharePercentChange = (investorShare: number) => {
    const validShare = Math.min(100, Math.max(0, investorShare));
    setFormData((prev) => ({
      ...prev,
      investorSharePercent: validShare,
      companySharePercent: 100 - validShare
    }));
  };

  const handleAddInvestorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || (!formData.isReferralPartner && formData.capitalAmount <= 0) || isSubmittingAdd) {
      alert('يرجى ملء جميع الحقول الأساسية بشكل صحيح');
      return;
    }

    if (formData.referrerId && formData.referrerSharePercent > formData.companySharePercent) {
      alert(`عمولة الإحالة (${formData.referrerSharePercent}%) لا يمكن أن تتجاوز حصة الشركة من الأرباح (${formData.companySharePercent}%)`);
      return;
    }

    // Safety check for exact duplicates
    if (investorDuplicateMatches.exactNameMatches.length > 0) {
      const match = investorDuplicateMatches.exactNameMatches[0];
      const proceed = window.confirm(
        `⚠️ تنبيه: يوجد مستثمر مسجل مسبقاً بنفس الاسم تماماً:\n"${match.name}" (الهاتف: ${match.phone || 'غير مسجل'})\n\nهل أنت متأكد من رغبتك في إنشاء حساب مستثمر جديد بنفس الاسم؟`
      );
      if (!proceed) return;
    } else if (investorDuplicateMatches.phoneMatches.length > 0) {
      const match = investorDuplicateMatches.phoneMatches[0];
      const proceed = window.confirm(
        `⚠️ تنبيه: رقم الهاتف المدخل مسجل مسبقاً للمستثمر:\n"${match.name}" (${match.phone})\n\nهل أنت متأكد من رغبتك في المتابعة؟`
      );
      if (!proceed) return;
    }

    const referrerObj = formData.referrerId ? store.investors.find(i => i.id === formData.referrerId) : null;

    const payload = {
      name: formData.name,
      phone: formData.phone,
      address: formData.address,
      nationalId: formData.nationalId,
      capitalAmount: formData.isReferralPartner ? 0 : Number(formData.capitalAmount),
      investorSharePercent: formData.isReferralPartner ? 0 : formData.investorSharePercent,
      companySharePercent: formData.isReferralPartner ? 100 : formData.companySharePercent,
      referrerId: formData.referrerId || undefined,
      referrerName: referrerObj ? referrerObj.name : undefined,
      referrerSharePercent: formData.referrerId ? Number(formData.referrerSharePercent || 0) : 0,
      isReferralPartner: Boolean(formData.isReferralPartner),
      notes: formData.notes,
      date: formData.date
    };

    setIsSubmittingAdd(true);
    try {
      let result;
      if (onAddInvestor) {
        result = await onAddInvestor(payload);
      } else if (typeof store.addInvestor === 'function') {
        result = store.addInvestor(payload);
      } else {
        const investorId = `investor-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const walletId = `wallet-${investorId}`;
        const newContract = {
          id: `contract-${investorId}`,
          investorId,
          investorSharePercent: payload.investorSharePercent,
          companySharePercent: payload.companySharePercent,
          lossSharingPolicy: 'SHARED' as const,
          referrerId: payload.referrerId,
          referrerName: payload.referrerName,
          referrerSharePercent: payload.referrerSharePercent || 0,
          contractDate: payload.date || new Date().toISOString().split('T')[0],
          notes: payload.notes || 'عقد محفظة سرية ومستقلة حسب الأصول'
        };
        const newInvestor: Investor = {
          id: investorId,
          name: payload.name,
          phone: payload.phone,
          address: payload.address,
          nationalId: payload.nationalId || `IQ-${Math.floor(10000000 + Math.random() * 90000000)}`,
          walletId,
          contract: newContract,
          totalCapitalDeposited: payload.capitalAmount,
          activeInvestmentsAmount: 0,
          availableLiquidity: payload.capitalAmount,
          totalProfitsEarned: 0,
          totalReferralCommissionsEarned: 0,
          totalLossesIncurred: 0,
          isReferralPartner: Boolean(payload.isReferralPartner),
          referredById: payload.referrerId,
          referredByName: payload.referrerName,
          referralSharePercent: payload.referrerSharePercent || 0,
          createdAt: payload.date || new Date().toISOString().split('T')[0]
        };
        const newWallet = {
          id: walletId,
          ownerType: 'INVESTOR' as const,
          ownerId: investorId,
          ownerName: payload.isReferralPartner ? `محفظة عمولات الإحالة (${payload.name})` : `صندوق المستثمر ${payload.name}`,
          balance: payload.capitalAmount,
          totalAssetsValuation: 0,
          totalDebtsValuation: 0,
          currency: 'IQD' as const,
          updatedAt: new Date().toISOString()
        };
        store.investors.push(newInvestor);
        store.wallets.push(newWallet);
        result = {
          success: true,
          message: `تم إضافة المستثمر ${payload.name} وإنشاء محفظة بقيمة ${formatNumber(payload.capitalAmount)} د.ع بنجاح`,
          investor: newInvestor
        };
      }

      if (result && result.success && result.investor) {
        setSelectedInvestorId(result.investor.id);
        setIsAddModalOpen(false);
        setNotification(`✅ ${result.message}`);
        setTimeout(() => setNotification(null), 5000);

        setFormData({
          name: '',
          phone: '',
          address: 'سامراء - ',
          nationalId: '',
          capitalAmount: 10000000,
          investorSharePercent: 60,
          companySharePercent: 40,
          referrerId: '',
          referrerSharePercent: 0,
          isReferralPartner: false,
          notes: '',
          date: new Date().toISOString().split('T')[0]
        });
      } else if (result && !result.success) {
        alert(result.message || 'تعذر إضافة المستثمر');
      }
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const openEditModal = (investor: Investor) => {
    setEditingInvestorId(investor.id);
    setEditFormData({
      name: investor.name,
      phone: investor.phone,
      address: investor.address || '',
      nationalId: investor.nationalId || '',
      investorSharePercent: investor.contract?.investorSharePercent ?? 60,
      companySharePercent: investor.contract?.companySharePercent ?? 40,
      referrerId: investor.contract?.referrerId || investor.referredById || '',
      referrerSharePercent: investor.contract?.referrerSharePercent ?? investor.referralSharePercent ?? 0,
      notes: investor.contract?.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvestorId || !editFormData.name.trim() || !editFormData.phone.trim()) return;
    if (isSubmittingEdit) return;

    const selectedReferrer = store.investors.find((inv) => inv.id === editFormData.referrerId);
    const payload = {
      id: editingInvestorId,
      name: editFormData.name.trim(),
      phone: editFormData.phone.trim(),
      address: editFormData.address.trim(),
      nationalId: editFormData.nationalId.trim(),
      investorSharePercent: Number(editFormData.investorSharePercent),
      companySharePercent: Number(editFormData.companySharePercent),
      referrerId: editFormData.referrerId || '',
      referrerName: selectedReferrer ? selectedReferrer.name : undefined,
      referrerSharePercent: editFormData.referrerId ? Number(editFormData.referrerSharePercent || 0) : 0,
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
        setNotification(`✅ ${result.message}`);
        setTimeout(() => setNotification(null), 5000);
      } else if (result && !result.success) {
        alert(result.message || 'تعذر تحديث بيانات المستثمر');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between text-emerald-300 animate-in fade-in slide-in-from-top-4 duration-300 shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-slate-900/90 p-6 rounded-3xl border border-slate-800/80 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">سجل المستثمرين وعقود المحافظ</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <PrivacyToggleButton />
          <button
            onClick={() => setViewMode('general_statement')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-sm transition-all shadow-md active:scale-95 shrink-0"
          >
            <Receipt className="w-4 h-4 text-amber-400" />
            <span>كشف المسحوبات والحركات العامة (شامل)</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>إضافة مستثمر وعقد جديد</span>
          </button>
        </div>
      </div>

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 flex items-center justify-between shadow-sm hover:border-slate-700/60 transition-all">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-medium">إجمالي رؤوس الأموال المودعة</p>
            <div className="text-3xl font-black text-white tracking-tight">
              <PrivacyMaskedAmount id="inv-top-capital" value={totalCapitalAll} label="إجمالي رؤوس الأموال المودعة" size="lg" />
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 flex items-center justify-between shadow-sm hover:border-slate-700/60 transition-all">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-medium">السيولة المتاحة بالصناديق</p>
            <div className="text-3xl font-black text-emerald-400 tracking-tight">
              <PrivacyMaskedAmount id="inv-top-liquidity" value={totalLiquidityAll} label="السيولة المتاحة بالصناديق" size="lg" />
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 flex items-center justify-between shadow-sm hover:border-slate-700/60 transition-all">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-medium">إجمالي أرباح المستثمرين</p>
            <div className="text-3xl font-black text-teal-400 tracking-tight">
              <PrivacyMaskedAmount id="inv-top-profits" value={totalProfitsAll} label="إجمالي أرباح المستثمرين" size="lg" />
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="bg-slate-900/90 p-2 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-2 shadow-lg">
        <button
          onClick={() => setViewMode('table')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'table'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>المستثمرون والحسابات</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950 text-[10px] text-slate-400">
            {capitalInvestors.length}
          </span>
        </button>

        <button
          onClick={() => setViewMode('general_statement')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'general_statement'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>كشف الحركات والمسحوبات العامة (لكافة المستثمرين)</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950 text-[10px] text-amber-400 font-mono">
            {allInvestorsGeneralWithdrawalRows.length}
          </span>
        </button>

        <button
          onClick={() => setViewMode('inventory')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'inventory'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Boxes className="w-4 h-4 text-amber-400" />
          <span>المواد والأصول بالصناديق</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950 text-[10px] text-amber-400/80">
            {store.inventory.length}
          </span>
        </button>

        <button
          onClick={() => setViewMode('loans')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'loans'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-400" />
          <span>عقود التمويل والقروض</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950 text-[10px] text-blue-400/80">
            {store.contracts.length}
          </span>
        </button>

        <button
          onClick={() => setViewMode('details')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'details'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Eye className="w-4 h-4 text-purple-400" />
          <span>تفاصيل المحفظة الفردية</span>
        </button>
      </div>

      {/* Tab 1: Investors Master Financial Table */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4 p-6">
          {/* Table Search & Privacy Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-lg font-bold text-white shrink-0">جدول حسابات و محافظ المستثمرين</h2>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* Search Box */}
              <div className="relative flex-1 sm:w-64 sm:flex-initial">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث باسم المستثمر..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Global & Multi-Select Privacy Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Reusable Privacy Toggle Button */}
                <PrivacyToggleButton variant="compact" />

                {/* Multi-Select Privacy Menu Button */}
                <div className="relative">
                  <button
                    onClick={() => setIsPrivacyMenuOpen(!isPrivacyMenuOpen)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-bold transition-all"
                  >
                    <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>تخصيص الإخفاء ({hiddenInvestorIds.length})</span>
                  </button>

                  {/* Multi-Select Popover Menu */}
                  {isPrivacyMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-white">تخصيص إخفاء المستثمرين</span>
                        <button onClick={() => setIsPrivacyMenuOpen(false)} className="text-slate-400 hover:text-white p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] gap-2">
                        <button
                          onClick={handleToggleHideAll}
                          className="text-amber-400 hover:underline font-semibold"
                        >
                          {hiddenInvestorIds.length === capitalInvestors.length ? 'إظهار الكل' : 'إخفاء الكل'}
                        </button>
                        <button
                          onClick={() => { setHiddenInvestorIds([]); setIsGlobalPrivacyActive(false); }}
                          className="text-slate-400 hover:text-white"
                        >
                          إعادة ضبط
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {capitalInvestors.map((inv) => {
                          const hidden = isInvestorHidden(inv.id);
                          return (
                            <label
                              key={inv.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/60 cursor-pointer text-xs"
                            >
                              <span className="font-semibold text-slate-200">{inv.name}</span>
                              <input
                                type="checkbox"
                                checked={hidden}
                                onChange={() => toggleInvestorPrivacy(inv.id)}
                                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Master Table - 5 Columns */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-950/80 text-slate-400 text-xs font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-4 px-6">المستثمر</th>
                  <th className="py-4 px-6">نسب توزيع الأرباح</th>
                  <th className="py-4 px-6">رأس المال المودع</th>
                  <th className="py-4 px-6">السيولة المتاحة بالصندوق</th>
                  <th className="py-4 px-6">الأرباح المستحصلة</th>
                  <th className="py-4 px-6 text-center">الإجراءات والتقارير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredInvestors.length > 0 ? (
                  filteredInvestors.map((investor) => {
                    const wallet = store.wallets.find((w) => w.id === investor.walletId);
                    const hidden = isInvestorHidden(investor.id);
                    const referredCount = store.investors.filter(
                      i => i.contract.referrerId === investor.id || i.referredById === investor.id
                    ).length;
                    const wasReferred = Boolean(investor.contract.referrerId || investor.referredById);
                    const referrerName = investor.referredByName || investor.contract.referrerName || store.investors.find(i => i.id === (investor.contract.referrerId || investor.referredById))?.name;
                    const refSharePercent = investor.referralSharePercent || investor.contract.referrerSharePercent || 0;

                    return (
                      <tr
                        key={investor.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedInvestorId(investor.id);
                          setViewMode('details');
                        }}
                      >
                        {/* Investor Name & Privacy Toggle */}
                        <td className="py-5 px-6">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold text-sm group-hover:border-emerald-500 transition-colors shrink-0">
                                {hidden ? '🔒' : investor.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
                                  {hidden ? '•••••••• (مخفي)' : <PrivacyMaskedText id={`inv-tbl-name-${investor.id}`} value={investor.name} label={`المستثمر: ${investor.name}`} />}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                  {investor.isReferralPartner && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                      🤝 شريك إحالة
                                    </span>
                                  )}
                                  {wasReferred && !investor.isReferralPartner && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                      المُحيل: <PrivacyMaskedText id={`inv-tbl-ref-${investor.id}`} value={referrerName} label={`المحيل: ${referrerName}`} size="xs" /> (%{refSharePercent})
                                    </span>
                                  )}
                                  {referredCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                                      مُحيل لـ ({referredCount}) مستثمرين
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Individual Privacy Toggle */}
                            <button
                              onClick={(e) => toggleInvestorPrivacy(investor.id, e)}
                              title={hidden ? 'إظهار بيانات هذا المستثمر' : 'إخفاء بيانات هذا المستثمر'}
                              className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors shrink-0"
                            >
                              {hidden ? (
                                <EyeOff className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Eye className="w-4 h-4 opacity-40 hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Profit Split % */}
                        <td className="py-5 px-6">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-xs border border-emerald-500/20">
                            <span>المستثمر: %{investor.contract.investorSharePercent}</span>
                            <span className="text-slate-500">|</span>
                            <span className="text-blue-400">الشركة: %{investor.contract.companySharePercent}</span>
                          </div>
                        </td>

                        {/* Deposited Capital */}
                        <td className="py-5 px-6">
                          <PrivacyMaskedAmount id={`inv-cap-${investor.id}`} value={investor.totalCapitalDeposited} label={`رأس مال: ${investor.name}`} size="md" />
                        </td>

                        {/* Available Liquidity */}
                        <td className="py-5 px-6">
                          <PrivacyMaskedAmount id={`inv-liq-${investor.id}`} value={wallet?.balance || 0} label={`سيولة: ${investor.name}`} size="md" />
                        </td>

                        {/* Earned Profits */}
                        <td className="py-5 px-6">
                          <PrivacyMaskedAmount id={`inv-prof-${investor.id}`} value={investor.totalProfitsEarned} label={`أرباح: ${investor.name}`} size="md" />
                          {investor.totalReferralCommissionsEarned ? (
                            <span className="text-[10px] text-amber-400/90 block mt-0.5">
                              منها {formatIQD(investor.totalReferralCommissionsEarned)} د.ع عمولات إحالة
                            </span>
                          ) : null}
                        </td>

                        {/* Actions / Custom Statement & Edit */}
                        <td className="py-5 px-6 text-center">
                          <div className="inline-flex items-center justify-center gap-2 flex-wrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(investor);
                              }}
                              className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-bold text-xs inline-flex items-center gap-1.5 transition-colors border border-amber-500/30 shadow-sm active:scale-95"
                              title="تعديل بيانات المستثمر أو الوسيط ونسبة العمولة"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>تعديل البيانات / العمولة</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInvestorId(investor.id);
                                setIsStatementModalOpen(true);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-bold text-xs inline-flex items-center gap-1.5 transition-colors border border-slate-700/60 shadow-sm active:scale-95"
                              title="عرض وطباعة كشف حساب مخصص"
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-400" />
                              <span>كشف حساب مخصص</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                      لا يوجد مستثمرين يطابقون نتيجة البحث الحالية
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: General Statement Across All Investors (كشف الحركات والمسحوبات العامة) */}
      {viewMode === 'general_statement' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-6 space-y-5">
          {/* Header & Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-400" />
                  <span>كشف الحركات والمسحوبات العامة للمستثمرين</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {statementInvestorFilter === 'ALL' ? `كافة المستثمرين (${capitalInvestors.length})` : capitalInvestors.find(i => i.id === statementInvestorFilter)?.name || 'مستثمر محدد'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                كشف تفصيلي موحد يوضح (اسم المستثمر • الرصيد السابق • المبلغ المسحوب • الرصيد المتبقي • التاريخ • البيان • الملاحظات)
              </p>
            </div>

            {/* Print & Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setIsStatementModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الكشف الرسمي (A4)</span>
              </button>
            </div>
          </div>

          {/* Filters Bar: Investor Selector, Date Range, Search & Presets */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Investor Selector */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-400 shrink-0 font-medium">تحديد المستثمر:</span>
                <select
                  value={statementInvestorFilter}
                  onChange={(e) => setStatementInvestorFilter(e.target.value)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer w-full text-xs"
                >
                  <option value="ALL">جميع المستثمرين ({capitalInvestors.length})</option>
                  {capitalInvestors.map((inv) => (
                    <option key={inv.id} value={inv.id} className="bg-slate-900 text-white">
                      {inv.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1 md:pb-0">
                <button
                  onClick={() => { setStatementStartDate(''); setStatementEndDate(''); }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
                >
                  كامل المدة (الكل)
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    setStatementStartDate(`${now.getFullYear()}-${m}-01`);
                    setStatementEndDate(now.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
                >
                  الشهر الحالي
                </button>
                <button
                  onClick={() => {
                    const d3 = new Date();
                    d3.setMonth(d3.getMonth() - 3);
                    const m3 = String(d3.getMonth() + 1).padStart(2, '0');
                    setStatementStartDate(`${d3.getFullYear()}-${m3}-01`);
                    setStatementEndDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
                >
                  آخر 3 أشهر
                </button>
                <button
                  onClick={() => {
                    setStatementStartDate('2026-01-01');
                    setStatementEndDate('2026-12-31');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
                >
                  السنة الحالية (2026)
                </button>
              </div>
            </div>

            {/* Date Pickers and Search Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-slate-400 shrink-0 font-medium">من تاريخ:</span>
                <input
                  type="date"
                  value={statementStartDate}
                  onChange={(e) => setStatementStartDate(e.target.value)}
                  className="bg-transparent text-white w-full outline-none text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-slate-400 shrink-0 font-medium">إلى تاريخ:</span>
                <input
                  type="date"
                  value={statementEndDate}
                  onChange={(e) => setStatementEndDate(e.target.value)}
                  className="bg-transparent text-white w-full outline-none text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="بحث باسم المستثمر، البيان، أو رقم السند..."
                  value={statementSearchQuery}
                  onChange={(e) => setStatementSearchQuery(e.target.value)}
                  className="bg-transparent text-white placeholder-slate-500 w-full outline-none text-xs"
                />
                {statementSearchQuery && (
                  <button onClick={() => setStatementSearchQuery('')} className="text-slate-400 hover:text-white text-xs">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">المستثمرون المشمولون:</span>
              <span className="font-bold text-white text-sm">
                {statementInvestorFilter === 'ALL' ? `${capitalInvestors.length} مستثمرين` : capitalInvestors.find(i => i.id === statementInvestorFilter)?.name}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30">
              <span className="text-amber-400 text-[11px] block font-semibold">إجمالي المبالغ المسحوبة:</span>
              <div className="font-mono font-black text-amber-400 text-sm">
                <PrivacyMaskedAmount id="inv-stmt-total-withdrawn" value={allInvestorsGeneralWithdrawalRows.reduce((s, r) => s + r.withdrawnAmount, 0)} label="إجمالي المسحوبات العامة" size="xs" />
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">عدد حركات السحب:</span>
              <span className="font-bold text-purple-400 text-sm">{allInvestorsGeneralWithdrawalRows.length} حركة</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">النطاق الزمني:</span>
              <span className="font-bold text-emerald-400 text-xs">
                {statementStartDate || 'البداية'} إلى {statementEndDate || 'اليوم'}
              </span>
            </div>
          </div>

          {/* 7 Columns Master Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">ت</th>
                  <th className="py-3.5 px-4">اسم المستثمر</th>
                  <th className="py-3.5 px-4 text-center">الرصيد السابق</th>
                  <th className="py-3.5 px-4 text-center">المبلغ المسحوب</th>
                  <th className="py-3.5 px-4 text-center">الرصيد المتبقي</th>
                  <th className="py-3.5 px-4 text-center">التاريخ</th>
                  <th className="py-3.5 px-4">البيان</th>
                  <th className="py-3.5 px-4">الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allInvestorsGeneralWithdrawalRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      لا توجد حركات مسحوبات أو قيود سحب مطابقة للفلاتر المحددة
                    </td>
                  </tr>
                ) : (
                  allInvestorsGeneralWithdrawalRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-950/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-white">{row.investorName}</td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-300 font-bold">
                        <PrivacyMaskedAmount id={`inv-stmt-prev-${row.id}`} value={row.previousBalance} label={`رصيد سابق: ${row.investorName}`} size="xs" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <PrivacyMaskedAmount id={`inv-stmt-w-${row.id}`} value={row.withdrawnAmount} label={`مبلغ مسحوب: ${row.investorName}`} size="xs" />
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-bold">
                        <PrivacyMaskedAmount id={`inv-stmt-rem-${row.id}`} value={row.remainingBalance} label={`رصيد متبقي: ${row.investorName}`} size="xs" />
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                        {row.date}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="text-slate-200 font-medium block">{row.description}</span>
                          <span className="text-[10px] text-slate-500">
                            {row.isPurchase ? 'شراء بضاعة للمخزن' : row.isProfitDist ? 'سحب أرباح مستثمر' : 'سحب نقدي'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {row.notes}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Investor Inventory Assets */}
      {viewMode === 'inventory' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-6 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-400" />
                <span>سجل المواد والأصول المشتراة بالمخزن</span>
              </h2>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث باسم المادة، الرمز SKU، أو المستثمر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredInventory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredInventory.map((item) => {
                const hidden = isInvestorHidden(item.investorId);

                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                          {item.sku}
                        </span>
                        <h3 className="font-bold text-white text-base mt-2">{item.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          التصنيف: <strong className="text-slate-300">{item.category}</strong> • الكمية: <strong className="text-slate-300">{item.quantity}</strong>
                        </p>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 text-xs font-bold">
                        {item.status === 'IN_STOCK' ? 'متاحة بالمخزن' : 'مباعة بالتقسيط'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">المستثمر المالِك:</span>
                        <span className="font-bold text-white">{hidden ? '•••••••• (مخفي)' : item.investorName}</span>
                      </div>

                      <div className="text-left">
                        <span className="text-slate-400 block text-[10px]">تكلفة الشراء الكلية:</span>
                        <PrivacyMaskedAmount id={`inv-item-cost-${item.id}`} value={item.totalCostIQD} label={`تكلفة شراء: ${item.name}`} size="xs" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              لا توجد مواد مسجلة بالمخزن تطابق معايير البحث
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Investor Funded Loans */}
      {viewMode === 'loans' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-6 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span>سجل العقود والزبائن الممولة من المحافظ</span>
              </h2>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث برقم العقد، اسم الزبون، أو المستثمر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredContracts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredContracts.map((contract) => {
                const hidden = isInvestorHidden(contract.investorId);

                return (
                  <div
                    key={contract.id}
                    className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 hover:border-slate-700 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                            #{getContractNumber(contract)}
                          </span>
                          <h3 className="font-bold text-white text-base">{contract.borrowerName}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          المادة الممولة: <strong className="text-amber-300">{contract.inventoryItemName}</strong> • الممول: <strong className="text-emerald-400">{hidden ? '••••••••' : contract.investorName}</strong>
                        </p>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 shrink-0 self-start sm:self-auto">
                        عقد إقراض نشط
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">مبلغ البيع بالتقسيط:</span>
                        <PrivacyMaskedAmount id={`inv-loan-price-${contract.id}`} value={contract.totalSalePriceIQD} label={`بيع بالتقسيط: ${contract.borrowerName}`} size="xs" />
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">المقدمة المستحصلة:</span>
                        <PrivacyMaskedAmount id={`inv-loan-dp-${contract.id}`} value={contract.downPaymentIQD} label={`المقدمة: ${contract.borrowerName}`} size="xs" />
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">القسط الشهري:</span>
                        <PrivacyMaskedAmount id={`inv-loan-inst-${contract.id}`} value={contract.monthlyInstallmentIQD} label={`القسط الشهري: ${contract.borrowerName}`} size="xs" />
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">توزيع الأرباح:</span>
                        <span className="font-bold text-blue-400 text-xs">المستثمر %{store.investors.find(i=>i.id===contract.investorId)?.contract.investorSharePercent || 60}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              لا توجد عقود إقراض ممولة تطابق البحث الحالية
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Detailed Individual Investor Portfolio */}
      {viewMode === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Investor Sidebar Selector */}
          <div className="space-y-3">
            <h3 className="font-bold text-white text-sm px-1">اختر المستثمر لتصفح محفظته التفصيلية</h3>
            <div className="space-y-2.5">
              {capitalInvestors.map((investor) => {
                const isSelected = investor.id === selectedInvestorId;
                const hidden = isInvestorHidden(investor.id);
                return (
                  <div
                    key={investor.id}
                    onClick={() => setSelectedInvestorId(investor.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-500 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">
                        {hidden ? '•••••••• (مخفي)' : investor.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                        %{investor.contract.investorSharePercent} الربح
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mt-2.5 pt-2.5 border-t border-slate-700/40">
                      <div>
                        <span className="text-slate-400 block text-[10px]">رأس المال:</span>
                        <span className="font-bold text-white">
                          {hidden ? '••••••••' : `${formatNumber(investor.totalCapitalDeposited)} د.ع`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">السيولة بالصندوق:</span>
                        <span className="font-bold text-emerald-400">
                          {hidden ? '••••••••' : `${formatNumber(investor.availableLiquidity)} د.ع`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Portfolio Dashboard Breakdown */}
          {selectedInvestor ? (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl">
                {/* Investor Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                      <span>{isInvestorHidden(selectedInvestor.id) ? '•••••••• (بيانات مشفّرة)' : selectedInvestor.name}</span>
                      <button
                        onClick={(e) => toggleInvestorPrivacy(selectedInvestor.id, e)}
                        title={isInvestorHidden(selectedInvestor.id) ? 'إظهار بيانات هذا المستثمر' : 'إخفاء بيانات هذا المستثمر'}
                        className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                      >
                        {isInvestorHidden(selectedInvestor.id) ? (
                          <EyeOff className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                      <span>الهاتف: <strong className="text-slate-200">{isInvestorHidden(selectedInvestor.id) ? '••••••••' : selectedInvestor.phone}</strong></span>
                      <span>•</span>
                      <span>العنوان: <strong className="text-slate-200">{isInvestorHidden(selectedInvestor.id) ? '••••••••' : (selectedInvestor.address || 'سامراء')}</strong></span>
                      <span>•</span>
                      <span>الهوية: <strong className="text-slate-200">{isInvestorHidden(selectedInvestor.id) ? '••••••••' : selectedInvestor.nationalId}</strong></span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                    <div className="px-4 py-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-left">
                      <p className="text-[10px] text-emerald-400 font-medium">صندوق المحفظة المستقلة</p>
                      <div className="text-xl font-black text-emerald-400 font-mono">
                        <PrivacyMaskedAmount id={`inv-det-bal-${selectedInvestor.id}`} value={investorWallet?.balance || 0} label={`صندوق محفظة: ${selectedInvestor.name}`} size="md" />
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(selectedInvestor)}
                      className="px-4 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center gap-2 border border-amber-500/30 transition-all active:scale-95 shrink-0"
                      title="تعديل بيانات المستثمر أو الوسيط ونسبة العمولة"
                    >
                      <Edit3 className="w-4 h-4 text-amber-400" />
                      <span>تعديل البيانات / العمولة</span>
                    </button>

                    <button
                      onClick={() => setIsStatementModalOpen(true)}
                      className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all active:scale-95 shrink-0"
                      title="عرض وطباعة كشف حساب مخصص للمستثمر"
                    >
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>كشف حساب مخصص</span>
                    </button>

                    <button
                      onClick={() => {
                        const nextNum = getNextInvestorWithdrawalReceiptNumber(store.transactions);
                        setWithdrawFormData({
                          amountIQD: Math.min(1000000, investorWallet?.balance || 0),
                          type: 'PROFIT_WITHDRAWAL',
                          notes: '',
                          receiptNo: nextNum,
                          date: new Date().toISOString().split('T')[0]
                        });
                        setIsWithdrawModalOpen(true);
                      }}
                      className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 shrink-0"
                      title="سحب نقدي من محفظة المستثمر"
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                      <span>سحب نقدي للمستثمر</span>
                    </button>
                  </div>
                </div>

                {/* 6 Expanded Insight Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* 1. إجمالي رأس المال المودع */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold">رأس المال المودع</span>
                      <Wallet className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-white font-mono truncate">
                      <PrivacyMaskedAmount id={`inv-det-cap-${selectedInvestor.id}`} value={selectedInvestor.totalCapitalDeposited} label={`رأس مال: ${selectedInvestor.name}`} size="xs" />
                    </div>
                    <span className="text-[10px] text-slate-500 block">الإيداع التأسيسي</span>
                  </div>

                  {/* 2. السيولة النقدية المتاحة بالصندوق */}
                  <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                    <div className="flex items-center justify-between text-emerald-400">
                      <span className="text-[11px] font-semibold">السيولة المتاحة</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-emerald-400 font-mono truncate">
                      <PrivacyMaskedAmount id={`inv-det-liq-${selectedInvestor.id}`} value={investorWallet?.balance || 0} label={`سيولة: ${selectedInvestor.name}`} size="xs" />
                    </div>
                    <span className="text-[10px] text-emerald-500/80 block">جاهز للاستثمار أو السحب</span>
                  </div>

                  {/* 3. إجمالي المبالغ المسحوبة (NEW) */}
                  <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-1">
                    <div className="flex items-center justify-between text-amber-400">
                      <span className="text-[11px] font-semibold">المبالغ المسحوبة</span>
                      <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-amber-400 font-mono truncate">
                      <PrivacyMaskedAmount id={`inv-det-withdrawn-${selectedInvestor.id}`} value={totalWithdrawnAmount} label={`المسحوبات: ${selectedInvestor.name}`} size="xs" />
                    </div>
                    <span className="text-[10px] text-amber-500/80 block">{investorWithdrawals.length} حركات سحب نقدية</span>
                  </div>

                  {/* 4. الأرباح المستحصلة للمستثمر */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold">الأرباح المستحصلة</span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-emerald-300 font-mono truncate">
                      <PrivacyMaskedAmount id={`inv-det-profits-${selectedInvestor.id}`} value={selectedInvestor.totalProfitsEarned} label={`الأرباح: ${selectedInvestor.name}`} size="xs" />
                    </div>
                    <span className="text-[10px] text-slate-500 block">من الأقساط المسددة</span>
                  </div>

                  {/* 5. بضائع وأصول المخزن */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold">بضاعة المخزن</span>
                      <Boxes className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-white font-mono truncate">
                      <PrivacyMaskedAmount id={`inv-det-invval-${selectedInvestor.id}`} value={totalInventoryValuation} label={`قيمة المخزون: ${selectedInvestor.name}`} size="xs" />
                    </div>
                    <span className="text-[10px] text-slate-500 block">{investorItems.length} مواد ممولة</span>
                  </div>

                  {/* 6. التمويلات والديون القائمة */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold">التمويلات القائمة</span>
                      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-blue-300 font-mono truncate">
                      <PrivacyMaskedAmount id={`inv-det-activeinv-${selectedInvestor.id}`} value={activeLoansPrincipal} label={`التمويلات القائمة: ${selectedInvestor.name}`} size="xs" />
                    </div>
                    <span className="text-[10px] text-slate-500 block">{investorContracts.length} عقود تقسيط</span>
                  </div>
                </div>

                {/* Contract & Net Portfolio Breakdown Card */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-950/90 border border-slate-800">
                  <div className="text-center sm:text-right border-b sm:border-b-0 sm:border-l border-slate-800/80 pb-2 sm:pb-0 sm:pl-3">
                    <p className="text-[11px] text-slate-400">حصة المستثمر من الربح</p>
                    <p className="text-lg font-black text-emerald-400">%{selectedInvestor.contract.investorSharePercent}</p>
                  </div>

                  <div className="text-center sm:text-right border-b sm:border-b-0 sm:border-l border-slate-800/80 pb-2 sm:pb-0 sm:pl-3">
                    <p className="text-[11px] text-slate-400">عمولة الشركة الإدارية</p>
                    <p className="text-lg font-black text-blue-400">%{selectedInvestor.contract.companySharePercent}</p>
                  </div>

                  <div className="text-center sm:text-right border-b sm:border-b-0 sm:border-l border-slate-800/80 pb-2 sm:pb-0 sm:pl-3">
                    <p className="text-[11px] text-slate-400">سياسة الخسارة</p>
                    <p className="text-xs font-bold text-purple-300 mt-1">
                      {selectedInvestor.contract.lossSharingPolicy === 'SHARED' ? 'مشاركة حسب النسبة' : 'مضمون من الشركة'}
                    </p>
                  </div>

                  <div className="text-center sm:text-right">
                    <p className="text-[11px] text-slate-400">صافي القيمة الكلية للمحفظة</p>
                    <div className="text-sm font-black text-white font-mono mt-0.5">
                      <PrivacyMaskedAmount id={`inv-det-totalnet-${selectedInvestor.id}`} value={totalNetPortfolioValuation} label={`صافي القيمة الكلية: ${selectedInvestor.name}`} size="xs" />
                    </div>
                  </div>
                </div>

                {/* Referral Network Breakdown (شبكة الإحالة والعمولات) */}
                {(() => {
                  const referredInvestors = store.investors.filter(
                    (inv) => inv.contract.referrerId === selectedInvestor.id || inv.referredById === selectedInvestor.id
                  );
                  const totalRefCommissions = selectedInvestor.totalReferralCommissionsEarned || 0;
                  const isReferrer = referredInvestors.length > 0;
                  const wasReferred = Boolean(selectedInvestor.contract.referrerId || selectedInvestor.referredById);
                  const referrer = wasReferred
                    ? store.investors.find(i => i.id === (selectedInvestor.contract.referrerId || selectedInvestor.referredById))
                    : null;

                  if (!isReferrer && !wasReferred && !selectedInvestor.isReferralPartner) return null;

                  return (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 border border-indigo-500/30 space-y-4 shadow-inner">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm">نظام الإحالة واستقطاب رؤوس الأموال</h4>
                            <p className="text-[11px] text-slate-400">
                              {selectedInvestor.isReferralPartner
                                ? 'شريك إحالة معتمد في النظام (تجميع عمولات الإحالة وسحبها دون الحاجة لرأس مال)'
                                : isReferrer
                                ? `مُحيل معتمد استقطب (${referredInvestors.length}) مستثمرين للشركة`
                                : 'مستثمر مُحال عبر شريك إحالة معتمد'}
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 block">إجمالي عمولات الإحالة المستحصلة:</span>
                          <strong className="text-emerald-400 font-mono text-sm sm:text-base">
                            {formatIQD(totalRefCommissions)} د.ع
                          </strong>
                        </div>
                      </div>

                      {/* Was Referred Banner */}
                      {wasReferred && (
                        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-300">
                            تم استقطاب هذا المستثمر بواسطة: <strong className="text-white">{referrer?.name || selectedInvestor.contract.referrerName || selectedInvestor.referredByName}</strong>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold font-mono">
                            عمولة المُحيل: %{selectedInvestor.contract.referrerSharePercent || selectedInvestor.referralSharePercent || 0}
                          </span>
                        </div>
                      )}

                      {/* Referred Investors List */}
                      {isReferrer && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-300 block">
                            المستثمرون الذين تم استقطابهم بواسطة {selectedInvestor.name} ({referredInvestors.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {referredInvestors.map((refInv) => {
                              const refCut = refInv.contract.referrerSharePercent || refInv.referralSharePercent || 0;
                              return (
                                <div key={refInv.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-white">{refInv.name}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold text-[10px] font-mono">
                                      عمولة الإحالة: %{refCut}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-1">
                                    <span>رأس المال: <strong className="text-slate-200 font-mono">{formatIQD(refInv.totalCapitalDeposited)} د.ع</strong></span>
                                    <span>نسبة المستثمر: <strong className="text-emerald-400 font-mono">%{refInv.contract.investorSharePercent}</strong></span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Investor Cash Withdrawals History (سجل المسحوبات النقدية) */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <ArrowDownLeft className="w-4 h-4 text-amber-400" />
                      <span>سجل حركات السحب وسندات الصرف</span>
                    </h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsStatementModalOpen(true)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 transition-colors bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>كشف حساب تفصيلي</span>
                      </button>
                      <span className="text-xs text-amber-400 font-bold">
                        {investorWithdrawals.length} حركات • إجمالي {formatIQD(totalWithdrawnAmount)} د.ع
                      </span>
                    </div>
                  </div>

                  {investorWithdrawals.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2.5 max-h-60 overflow-y-auto pr-1">
                      {investorWithdrawals.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                {tx.referenceNo || 'سند صرف'}
                              </span>
                              <span className="text-slate-400 text-[11px]">{tx.date}</span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                                {tx.description?.includes('أرباح') ? 'سحب أرباح' : tx.description?.includes('رأس') ? 'سحب رأس مال' : 'سحب نقدي'}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px]">{tx.description}</p>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                            <div className="text-left sm:text-right">
                              <span className="font-mono font-bold text-amber-400 text-sm block">
                                -{formatIQD(tx.amountIQD)} د.ع
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenPastWithdrawalReceipt(tx)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 hover:border-amber-500/30 transition-all flex items-center gap-1.5 text-[11px] font-bold"
                              title="عرض وطباعة سند الصرف A5"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden sm:inline">طباعة السند</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-center text-slate-400 text-xs">
                      لا توجد أي حركات سحب نقدية مسجلة لهذه المحفظة حتى الآن (0 د.ع)
                    </div>
                  )}
                </div>

                {/* Investor Owned Assets */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Boxes className="w-5 h-5 text-amber-400" />
                      <span>المواد والأصول بالمخزن</span>
                    </h3>
                    <span className="text-xs text-amber-400 font-bold">{investorItems.length} مواد</span>
                  </div>

                  {investorItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {investorItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-white text-sm">{item.name}</p>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                              رمز المادة: <span className="font-mono text-amber-300">{item.sku}</span> • التصنيف: {item.category}
                            </p>
                          </div>

                          <div className="text-left">
                            <PrivacyMaskedAmount id={`inv-det-item-cost-${item.id}`} value={item.totalCostIQD} label={`تكلفة المادة: ${item.name}`} size="xs" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-slate-400 text-xs">
                      لا توجد مواد حالياً في المخزن مسجلة باسم هذا المستثمر
                    </div>
                  )}
                </div>

                {/* Investor Funded Loans */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <span>عقود الإقراض والعملاء الممولة</span>
                    </h3>
                    <span className="text-xs text-blue-400 font-bold">{investorContracts.length} عقود إقراض</span>
                  </div>

                  {investorContracts.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {investorContracts.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                            <span className="font-bold text-white text-sm">عقد #{getContractNumber(c)} — {c.borrowerName}</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                              عقد نشط
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-slate-300 text-center">
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">مبلغ التقسيط:</span>
                              <PrivacyMaskedAmount id={`inv-det-loan-price-${c.id}`} value={c.totalSalePriceIQD} label={`سعر البيع: ${c.borrowerName}`} size="xs" />
                            </div>
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">المقدمة:</span>
                              <PrivacyMaskedAmount id={`inv-det-loan-dp-${c.id}`} value={c.downPaymentIQD} label={`المقدمة: ${c.borrowerName}`} size="xs" />
                            </div>
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">القسط الشهري:</span>
                              <PrivacyMaskedAmount id={`inv-det-loan-inst-${c.id}`} value={c.monthlyInstallmentIQD} label={`القسط: ${c.borrowerName}`} size="xs" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-slate-400 text-xs">
                      لا توجد عقود أقساط ممولة من هذا المستثمر حالياً
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Add Investor Modal Dialog */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 cursor-default max-h-[92vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg">إضافة مستثمر وعقد محفظة جديد</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">إنشاء حساب المستثمر وصندوق المحفظة المالية فوراً</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddInvestorSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* العمود الأيمن: البيانات الشخصية والتوثيق التعاقدي */}
                <div className="space-y-3 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/60">
                    <span className="w-1.5 h-3.5 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-bold text-slate-200">البيانات الشخصية والتوثيق</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المستثمر الثلاثي *</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: علي عبدالحسين السامراوي"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الهاتف *</label>
                      <input
                        type="tel"
                        required
                        lang="en"
                        dir="ltr"
                        placeholder="0770xxxxxxx"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: toEnglishDigits(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-right"
                      />
                    </div>
                  </div>

                  {/* Dynamic Duplicate Warning Banner */}
                  <DuplicateWarningBanner
                    matchResult={investorDuplicateMatches}
                    entityLabel="مستثمر"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">العنوان السكني</label>
                      <input
                        type="text"
                        placeholder="سامراء - حي الضباط"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الهوية الوطنية / الموحدة</label>
                      <input
                        type="text"
                        placeholder="IQ-10982736"
                        value={formData.nationalId}
                        onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Document Date */}
                  <DocumentDateField
                    value={formData.date}
                    onChange={(d) => setFormData({ ...formData, date: d })}
                    label="تاريخ توقيع العقد وإيداع رأس المال"
                    helpText="تاريخ تحرير العقد واستلام مبلغ الاستثمار (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
                  />
                </div>

                {/* العمود الأيسر: الشروط المالية وعقد المحفظة ونظام الإحالة */}
                <div className="space-y-3 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/60">
                    <span className="w-1.5 h-3.5 rounded-full bg-amber-500"></span>
                    <span className="text-xs font-bold text-slate-200">الشروط المالية ونظام الأرباح</span>
                  </div>

                  {/* Capital Deposited */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">رأس المال المودع (بالدينار العراقي) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      step="any"
                      lang="en"
                      dir="ltr"
                      placeholder="أدخل أي مبلغ بالدينار العراقي..."
                      value={formData.capitalAmount || ''}
                      onChange={(e) => setFormData({ ...formData, isReferralPartner: false, capitalAmount: Number(toEnglishDigits(e.target.value)) })}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm font-bold text-emerald-400 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-right"
                    />
                  </div>

                  {/* Profit Split Sliders / Inputs */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                    <p className="text-xs font-bold text-white">تحديد نسب توزيع الأرباح بموجب العقد</p>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1 text-[11px]">حصة المستثمر من الأرباح (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          lang="en"
                          dir="ltr"
                          value={formData.investorSharePercent}
                          onChange={(e) => handleSharePercentChange(Number(toEnglishDigits(e.target.value)))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-400 text-right"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 text-[11px]">عمولة الشركة من الأرباح (%)</label>
                        <input
                          type="number"
                          disabled
                          lang="en"
                          dir="ltr"
                          value={formData.companySharePercent}
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-400 opacity-80 text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Referral Assignment Section */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>🤝 الوسيط المُحيل (من جلب هذا المستثمر؟)</span>
                        <span className="text-[10px] font-normal text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">اختياري</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1 text-[11px]">الوسيط المُحيل المعتمد</label>
                        <select
                          value={formData.referrerId}
                          onChange={(e) => setFormData(prev => ({ ...prev, referrerId: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">بدون وسيط (مستثمر مباشر مع الشركة)</option>
                          {eligibleReferrers.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name} {isReferralBroker(inv) ? '(وسيط إحالة معتمد)' : '(مستثمر حالي)'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {formData.referrerId && (
                        <div>
                          <label className="block text-slate-400 mb-1 text-[11px]">نسبة عمولة الإحالة للوسيط (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={formData.companySharePercent}
                            lang="en"
                            dir="ltr"
                            value={formData.referrerSharePercent}
                            onChange={(e) => setFormData(prev => ({ ...prev, referrerSharePercent: Number(toEnglishDigits(e.target.value)) }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500 text-right"
                          />
                        </div>
                      )}
                    </div>

                    {formData.referrerId && (
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-300">
                          <span>حصة المستثمر الجديد: <strong className="text-emerald-400 font-mono">%{formData.investorSharePercent}</strong></span>
                          <span>عمولة الوسيط: <strong className="text-amber-400 font-mono">%{formData.referrerSharePercent}</strong></span>
                          <span>صافي حصة الشركة: <strong className="text-blue-400 font-mono">%{Math.max(0, formData.companySharePercent - formData.referrerSharePercent)}</strong></span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          * ملاحظة: تُقتطع عمولة الوسيط ({formData.referrerSharePercent}%) بالكامل من حصة الشركة ({formData.companySharePercent}%)، دون أي مساس بحصة المستثمر ({formData.investorSharePercent}%).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmittingAdd}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {isSubmittingAdd ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>جاري الحفظ وتوقيع العقد...</span>
                    </>
                  ) : (
                    <span>تأكيد وتوقيع العقد</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Investor Cash Withdrawal (سحب نقدي للمستثمر) */}
      {isWithdrawModalOpen && selectedInvestor && investorWallet && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 cursor-default"
          >
            {/* Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">سحب نقدي من محفظة المستثمر</h3>
                  <p className="text-xs text-slate-400">
                    المستثمر: <strong className="text-white">{selectedInvestor.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4 text-xs">
              {/* Financial & Contract Profit Share Summary Card */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                <div className="space-y-1">
                  <span className="text-slate-400 block text-[11px]">السيولة النقدية المتاحة بالصندوق:</span>
                  <strong className="text-emerald-400 text-sm sm:text-base font-mono">
                    {formatIQD(investorWallet.balance)} د.ع
                  </strong>
                </div>

                <div className="space-y-1 text-left">
                  <span className="text-slate-400 block text-[11px]">إجمالي رأس المال المودع:</span>
                  <strong className="text-white text-xs sm:text-sm font-mono">
                    {formatIQD(selectedInvestor.totalCapitalDeposited)} د.ع
                  </strong>
                </div>

                <div className="pt-2.5 border-t border-slate-800/80 space-y-1">
                  <span className="text-slate-400 block text-[11px]">نسبة أرباح المستثمر المعتمدة:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-amber-400 font-bold text-xs sm:text-sm bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      %{selectedInvestor.contract.investorSharePercent}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      (الشركة: %{selectedInvestor.contract.companySharePercent})
                    </span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-800/80 space-y-1 text-left">
                  <span className="text-slate-400 block text-[11px]">الأرباح المستحصلة للمستثمر:</span>
                  <strong className="text-emerald-400 text-xs sm:text-sm font-mono block">
                    {formatIQD(selectedInvestor.totalProfitsEarned)} د.ع
                  </strong>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold block">مبلغ السحب (دينار عراقي) *:</label>
                  {withdrawFormData.amountIQD > 0 && (
                    <span className="text-[11px] text-amber-400 font-mono font-bold">
                      {formatIQD(withdrawFormData.amountIQD)} د.ع
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={withdrawFormData.amountIQD ? formatIQD(withdrawFormData.amountIQD) : ''}
                  onChange={handleWithdrawAmountChange}
                  placeholder="مثال: 500.000 أو 1.000.000"
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-base focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Document Date */}
              <DocumentDateField
                value={withdrawFormData.date}
                onChange={(d) => setWithdrawFormData((prev) => ({ ...prev, date: d }))}
                label="تاريخ سند الصرف"
                helpText="تاريخ تحرير السند وتسليم المبلغ للمستثمر (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
              />

              {/* Withdrawal Type */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">نوع السحب / بند القيد:</label>
                <select
                  value={withdrawFormData.type}
                  onChange={(e) =>
                    setWithdrawFormData({
                      ...withdrawFormData,
                      type: e.target.value as any
                    })
                  }
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="PROFIT_WITHDRAWAL">سحب أرباح متحققة (توزيع أرباح)</option>
                  <option value="CAPITAL_WITHDRAWAL">سحب جزئي من رأس المال المودع</option>
                  <option value="GENERAL_WITHDRAWAL">سحب سيولة نقدية عام</option>
                </select>
              </div>

              {/* Receipt Number */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold block">رقم سند الصرف / الوصل:</label>
                  <span className="text-[10px] text-amber-400 font-bold">تسلسلي يبدأ بـ 1 تلقائياً</span>
                </div>
                <input
                  type="text"
                  placeholder="1"
                  value={withdrawFormData.receiptNo}
                  onChange={(e) => setWithdrawFormData({ ...withdrawFormData, receiptNo: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono text-sm font-bold"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">ملاحظات وبيان السند:</label>
                <textarea
                  rows={2}
                  placeholder="بيان سند الصرف أو أسباب السحب..."
                  value={withdrawFormData.notes}
                  onChange={(e) => setWithdrawFormData({ ...withdrawFormData, notes: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Remaining Balance Preview Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>السيولة المتبقية بعد السحب:</span>
                  <strong
                    className={`font-mono text-sm ${
                      investorWallet.balance - withdrawFormData.amountIQD < 0
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {formatIQD(Math.max(0, investorWallet.balance - withdrawFormData.amountIQD))} د.ع
                  </strong>
                </div>

                {withdrawFormData.amountIQD > investorWallet.balance && (
                  <div className="flex items-center gap-2 text-rose-400 text-[11px] pt-1 border-t border-rose-500/20">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>تنبيه: المبلغ المطلوب يتجاوز السيولة النقدية المتاحة بالصندوق!</span>
                  </div>
                )}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  disabled={isSubmittingWithdraw}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingWithdraw ||
                    withdrawFormData.amountIQD <= 0 ||
                    withdrawFormData.amountIQD > investorWallet.balance
                  }
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  {isSubmittingWithdraw ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>جاري تنفيذ السحب...</span>
                    </>
                  ) : (
                    <span>تأكيد السحب وتسجيل القيد</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Investor & Referral Commission Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">تعديل بيانات المستثمر والوسيط ونسب العمولة</h3>
                  <p className="text-xs text-slate-400">
                    يمكنك تعديل البيانات الشخصية، نسب الأرباح، أو ربط وتعديل نسبة عمولة وسيط الإحالة بأثر فوري على الأقساط غير المسددة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">اسم المستثمر الثلاثي *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">رقم الهاتف *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: toEnglishDigits(e.target.value) })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">عنوان السكن</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">رقم البطاقة الوطنية / الهوية</label>
                  <input
                    type="text"
                    value={editFormData.nationalId}
                    onChange={(e) => setEditFormData({ ...editFormData, nationalId: toEnglishDigits(e.target.value) })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Profit Distribution % */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-emerald-400" />
                    <span>توزيع نسب الأرباح التعاقدية</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    المستثمر %{editFormData.investorSharePercent} | الشركة %{editFormData.companySharePercent}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 block">نسبة ربح المستثمر (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editFormData.investorSharePercent}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                        setEditFormData({
                          ...editFormData,
                          investorSharePercent: val,
                          companySharePercent: 100 - val
                        });
                      }}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-bold text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 block">نسبة ربح الشركة (%)</label>
                    <input
                      type="number"
                      readOnly
                      value={editFormData.companySharePercent}
                      className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-blue-400 font-bold text-center cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Referral Broker & Commission % */}
              <div className="p-4 rounded-2xl bg-amber-950/15 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 flex items-center gap-2">
                    <span>🤝 الوسيط المُحيل ونسبة عمولة الإحالة</span>
                  </span>
                  <span className="text-[10px] text-amber-400/80">تُقتطع من حصة أرباح الشركة</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-semibold block">اختر الوسيط / المُحيل:</label>
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
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">بدون وسيط إحالة (مباشر للشركة)</option>
                      {eligibleReferrers
                        .filter((inv) => inv.id !== editingInvestorId)
                        .map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} {isReferralBroker(inv) ? '(وسيط إحالة معتمد)' : '(مستثمر وشريك)'}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-semibold block">نسبة عمولة الوسيط (% من الربح):</label>
                    <div className="flex items-center gap-2">
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
                        className="w-full p-3 rounded-xl bg-slate-950 border border-amber-500/40 disabled:opacity-40 text-amber-400 font-black text-center font-mono text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    {editFormData.referrerId && (
                      <div className="flex items-center gap-1.5 pt-1">
                        {[5, 10, 15, 20].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, referrerSharePercent: pct })}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                              Number(editFormData.referrerSharePercent) === pct
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-900 text-amber-300 border-slate-800 hover:border-amber-500/40'
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

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">ملاحظات العقد</label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                >
                  إلغاء
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
                      <span>حفظ التعديلات ونسب العمولة</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Investor Account Statement Modal with Date Range & Print */}
      <InvestorStatementModal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        wallet={investorWallet || null}
        investor={selectedInvestor || null}
        allTransactions={store.transactions}
        investorsList={capitalInvestors}
        walletsList={store.wallets}
      />

      {/* Official Investor Cash Withdrawal Receipt Modal (وصل صرف نقدي نصف A4 = A5) */}
      <InvestorWithdrawalReceiptModal
        isOpen={isWithdrawReceiptModalOpen}
        onClose={() => setIsWithdrawReceiptModalOpen(false)}
        receipt={selectedWithdrawReceipt}
      />
    </div>
  );
};
