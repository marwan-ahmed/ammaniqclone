'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Phone,
  MapPin,
  Briefcase,
  Search,
  ShieldCheck,
  Coins,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronLeft,
  Eye,
  EyeOff,
  FileText,
  DollarSign,
  Building2,
  BadgeAlert,
  UserPlus,
  Filter,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  X,
  CreditCard,
  Pencil,
  Trash2,
  LayoutGrid,
  List,
  Loader2,
  Lock,
  Percent,
  Wallet,
  Printer,
  Users
} from 'lucide-react';
import { SecurityConfirmationModal } from '@/components/common/SecurityConfirmationModal';
import { ContractDocumentHubModal, getInvoiceNumber, getContractNumber } from '@/components/common/ContractDocumentHubModal';
import { CollectorReportModal } from '@/components/common/CollectorReportModal';
import { BorrowerIntroducersModal } from '@/components/common/BorrowerIntroducersModal';
import {
  calculateInstallmentDueStatus,
  getBorrowerDueSummary,
  isBorrowerSettled,
  getBorrowerStatusDisplay,
  getPersistedBorrowersCardLayout,
  persistBorrowersCardLayout
} from '@/utils/installmentDates';
import { SimulationStore } from '@/services/simulation';
import { Borrower, InstallmentContract, InstallmentScheduleItem } from '@/types/finance';
import { findDuplicateMatches } from '@/utils/nameSimilarity';
import { DuplicateWarningBanner } from '@/components/common/DuplicateWarningBanner';
import { formatNumber, formatIQD } from '@/utils/formatters';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { usePrivacy } from '@/context/PrivacyContext';
import { evaluateBorrowerCredit, CreditTier } from '@/utils/creditScore';
import { getCapitalInvestors } from '@/utils/investorSelectors';

interface BorrowersViewProps {
  store: SimulationStore;
  onPaySchedule?: (contractId: string, scheduleId: string, customPaidAmountIQD?: number, paidDate?: string) => Promise<any> | void;
  onAddBorrower?: (data: {
    name: string;
    phone: string;
    address: string;
    nationalId?: string;
    wifeName?: string;
    city?: string;
    jobTitle?: string;
    monthlyIncomeIQD?: number;
    introducedBy?: string;
    guarantors: {
      name: string;
      phone: string;
      nationalId: string;
      address?: string;
      department?: string;
      letterNumber?: string;
      letterDate?: string;
    }[];
  }) => Promise<any> | any;
  onUpdateBorrower?: (borrowerId: string, data: any) => Promise<any> | any;
  onAddGuarantor?: (
    borrowerId: string,
    guarantor: {
      name: string;
      phone: string;
      nationalId: string;
      address?: string;
      department?: string;
      letterNumber?: string;
      letterDate?: string;
    }
  ) => Promise<any> | any;
  onCreateContract?: (data: {
    borrowerId: string;
    inventoryItemId: string;
    totalSalePriceIQD: number;
    downPaymentIQD: number;
    monthsCount: number;
    startDate?: string;
    quantity?: number;
  }) => Promise<any> | any;
  onDeleteBorrower?: (borrowerId: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  adminPasscode?: string;
}

type TabMode = 'cards' | 'table' | 'guarantors' | 'schedules';
type StatusFilter = 'ALL' | 'ACTIVE' | 'SETTLED' | 'DEFAULTED';

const getCreditTierBadge = (tier: CreditTier, score: number) => {
  switch (tier) {
    case 'AAA':
      return {
        label: `★ AAA (${score})`,
        classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      };
    case 'A':
      return {
        label: `A (${score})`,
        classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      };
    case 'B':
      return {
        label: `B (${score})`,
        classes: 'bg-teal-500/15 text-teal-300 border-teal-500/30'
      };
    case 'C':
      return {
        label: `C (${score})`,
        classes: 'bg-orange-500/15 text-orange-300 border-orange-500/30'
      };
    case 'D':
      return {
        label: `🚫 قائمة سوداء (${score})`,
        classes: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      };
  }
};

export const BorrowersView: React.FC<BorrowersViewProps> = ({
  store,
  onPaySchedule,
  onAddBorrower,
  onAddGuarantor,
  onUpdateBorrower,
  onCreateContract,
  onDeleteBorrower,
  adminPasscode = '2026'
}) => {
  const { lockAll, unlockedItemIds, isPrivacyActive } = usePrivacy();
  const [activeTab, setActiveTab] = useState<TabMode>('cards');
  const [cardLayoutMode, setCardLayoutMode] = useState<'grid' | 'list'>(() => getPersistedBorrowersCardLayout());

  useEffect(() => {
    const saved = getPersistedBorrowersCardLayout();
    if (saved !== cardLayoutMode) {
      setCardLayoutMode(saved);
    }
  }, []);

  const handleCardLayoutModeChange = (mode: 'grid' | 'list') => {
    setCardLayoutMode(mode);
    persistBorrowersCardLayout(mode);
  };
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const isPrivacyMasked = isPrivacyActive;
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Selected Borrower for Details Modal
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(null);

  // 3-in-1 Document Hub Modal State
  const [selectedContractForHub, setSelectedContractForHub] = useState<InstallmentContract | null>(null);

  // Debt Collector Field Call Sheet Modal State
  const [isCollectorReportOpen, setIsCollectorReportOpen] = useState(false);
  const [collectorReportFilter, setCollectorReportFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING'>('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'PAID'>('ALL');

  // Borrower Introducers (من أحضر الزبائن) Modal State
  const [isIntroducersModalOpen, setIsIntroducersModalOpen] = useState(false);

  // Issue Contract & Sales Invoice Modal State (Immediate next step after new borrower registration)
  const [isIssueContractModalOpen, setIsIssueContractModalOpen] = useState(false);
  const [newContractBorrower, setNewContractBorrower] = useState<Borrower | null>(null);
  const [isSubmittingContract, setIsSubmittingContract] = useState(false);

  // Contract Form State
  const [contractFormData, setContractFormData] = useState({
    borrowerId: '',
    selectedInvestorId: 'COMPANY_MAIN',
    inventoryItemId: '',
    itemCostPriceIQD: 0,
    downPaymentIQD: 0,
    netCostIQD: 0,
    profitMarginPercent: 30,
    profitAmountIQD: 0,
    financedAmountIQD: 0,
    totalSalePriceIQD: 0,
    quantity: 1,
    monthsCount: 14,
    startDate: new Date().toISOString().split('T')[0]
  });

  // Modals state
  const [isAddBorrowerOpen, setIsAddBorrowerOpen] = useState(false);
  const [isAddGuarantorOpen, setIsAddGuarantorOpen] = useState(false);
  const [guarantorTargetBorrowerId, setGuarantorTargetBorrowerId] = useState<string | null>(null);

  // Submitting States for Visual Feedback & Anti-Double-Click
  const [isSubmittingBorrower, setIsSubmittingBorrower] = useState(false);
  const [isSubmittingGuarantor, setIsSubmittingGuarantor] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [payingScheduleId, setPayingScheduleId] = useState<string | null>(null);

  // Edit Borrower Modal State
  const [isEditBorrowerOpen, setIsEditBorrowerOpen] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedContractForHub) {
          setSelectedContractForHub(null);
        } else if (isIntroducersModalOpen) {
          setIsIntroducersModalOpen(false);
        } else if (isCollectorReportOpen) {
          setIsCollectorReportOpen(false);
        } else if (isIssueContractModalOpen) {
          setIsIssueContractModalOpen(false);
        } else if (isEditBorrowerOpen) {
          setIsEditBorrowerOpen(false);
        } else if (isAddGuarantorOpen) {
          setIsAddGuarantorOpen(false);
        } else if (isAddBorrowerOpen) {
          setIsAddBorrowerOpen(false);
        } else if (selectedBorrowerId) {
          setSelectedBorrowerId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedContractForHub,
    isIssueContractModalOpen,
    isEditBorrowerOpen,
    isAddGuarantorOpen,
    isAddBorrowerOpen,
    selectedBorrowerId
  ]);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    phone: '',
    address: '',
    city: '',
    jobTitle: '',
    monthlyIncomeIQD: 0,
    nationalId: '',
    wifeName: '',
    introducedBy: ''
  });

  // Toast / Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const openEditModal = (b: Borrower) => {
    setEditForm({
      id: b.id,
      name: b.name,
      phone: b.phone,
      address: b.address,
      city: b.city || 'سامراء',
      jobTitle: b.jobTitle || 'غير محدد',
      monthlyIncomeIQD: b.monthlyIncomeIQD || 0,
      nationalId: b.nationalId || '',
      wifeName: b.wifeName || '',
      introducedBy: b.introducedBy || ''
    });
    setIsEditBorrowerOpen(true);
  };

  const handleEditBorrowerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      alert('يرجى إدخال اسم الزبون ورقم الهاتف');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      let res: { success: boolean; message: string };
      const editPayload = {
        name: editForm.name,
        phone: editForm.phone,
        address: editForm.address,
        city: editForm.city,
        jobTitle: editForm.jobTitle,
        monthlyIncomeIQD: Number(editForm.monthlyIncomeIQD || 0),
        nationalId: editForm.nationalId,
        wifeName: editForm.wifeName,
        introducedBy: editForm.introducedBy ? editForm.introducedBy.trim() : undefined,
      };

      if (onUpdateBorrower) {
        res = await onUpdateBorrower(editForm.id, editPayload);
      } else if (typeof store.updateBorrower === 'function') {
        res = store.updateBorrower(editForm.id, editPayload);
      } else {
        // Safe fallback if React state holds pre-HMR store instance
        const borrower = store.borrowers.find((b) => b.id === editForm.id);
        if (borrower) {
          borrower.name = editForm.name;
          borrower.phone = editForm.phone;
          borrower.address = editForm.address;
          borrower.city = editForm.city;
          borrower.jobTitle = editForm.jobTitle;
          borrower.monthlyIncomeIQD = Number(editForm.monthlyIncomeIQD || 0);
          borrower.nationalId = editForm.nationalId;
          borrower.wifeName = editForm.wifeName;
          borrower.introducedBy = editForm.introducedBy ? editForm.introducedBy.trim() : undefined;
          store.contracts.forEach((c) => {
            if (c.borrowerId === editForm.id) c.borrowerName = editForm.name;
          });
          res = { success: true, message: `تم تحديث بيانات الزبون ${editForm.name} بنجاح` };
        } else {
          res = { success: false, message: 'الزبون غير موجود' };
        }
      }

      if (res && res.success) {
        showToast(res.message);
        setIsEditBorrowerOpen(false);
        setRefreshCounter((prev) => prev + 1);
      } else {
        alert(res?.message || 'تعذر تعديل بيانات الزبون');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const [borrowerToDelete, setBorrowerToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteBorrower = (borrowerId: string, name: string) => {
    setBorrowerToDelete({ id: borrowerId, name });
  };

  const handleConfirmDeleteBorrower = async () => {
    if (!borrowerToDelete) return;
    let res: { success: boolean; message: string };
    if (onDeleteBorrower) {
      res = await onDeleteBorrower(borrowerToDelete.id);
    } else if (typeof store.deleteBorrower === 'function') {
      res = store.deleteBorrower(borrowerToDelete.id);
    } else {
      // Safe fallback if React state holds pre-HMR store instance
      const idx = store.borrowers.findIndex((b) => b.id === borrowerToDelete.id);
      if (idx !== -1) {
        store.borrowers.splice(idx, 1);
        store.contracts = store.contracts.filter((c) => c.borrowerId !== borrowerToDelete.id);
        res = { success: true, message: `تم إلغاء ملف الزبون ${borrowerToDelete.name} بنجاح` };
      } else {
        res = { success: false, message: 'الزبون غير موجود' };
      }
    }

    if (res.success) {
      showToast(res.message);
      setRefreshCounter((prev) => prev + 1);
      if (selectedBorrowerId === borrowerToDelete.id) {
        setSelectedBorrowerId(null);
      }
      setBorrowerToDelete(null);
    } else {
      showToast(res.message);
      throw new Error(res.message);
    }
  };

  // Form State: New Borrower
  const [borrowerForm, setBorrowerForm] = useState({
    name: '',
    address: 'سامراء - ',
    phone: '',
    nationalId: '',
    wifeName: '',
    city: 'سامراء',
    introducedBy: '',
    g1Name: '',
    g1Address: 'سامراء - ',
    g1Phone: '',
    g1NationalId: '',
    g1Department: 'تربية صلاح الدين / سامراء',
    g1LetterNumber: '',
    g1LetterDate: new Date().toISOString().split('T')[0]
  });

  // Form State: New Guarantor
  const [guarantorForm, setGuarantorForm] = useState({
    name: '',
    address: 'سامراء - ',
    phone: '',
    nationalId: '',
    department: '',
    letterNumber: '',
    letterDate: new Date().toISOString().split('T')[0]
  });

  // Real-time Duplicate Checking
  const borrowerDuplicateMatches = useMemo(() => {
    return findDuplicateMatches(borrowerForm.name, borrowerForm.phone, store.borrowers);
  }, [borrowerForm.name, borrowerForm.phone, store.borrowers]);

  const guarantorDuplicateMatches = useMemo(() => {
    return findDuplicateMatches(borrowerForm.g1Name, borrowerForm.g1Phone, store.borrowers);
  }, [borrowerForm.g1Name, borrowerForm.g1Phone, store.borrowers]);

  const guarantorModalDuplicateMatches = useMemo(() => {
    return findDuplicateMatches(guarantorForm.name, guarantorForm.phone, store.borrowers);
  }, [guarantorForm.name, guarantorForm.phone, store.borrowers]);

  const editBorrowerDuplicateMatches = useMemo(() => {
    return findDuplicateMatches(editForm.name, editForm.phone, store.borrowers, editForm.id);
  }, [editForm.name, editForm.phone, editForm.id, store.borrowers]);

  // Selected Borrower Object
  const selectedBorrower = store.borrowers.find((b) => b.id === selectedBorrowerId);

  // Filtering Logic
  const filteredBorrowers = store.borrowers.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.phone.includes(searchQuery) ||
      b.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.jobTitle ? b.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) : false) ||
      (b.introducedBy ? b.introducedBy.toLowerCase().includes(searchQuery.toLowerCase()) : false) ||
      b.guarantors.some(
        (g) =>
          g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.phone.includes(searchQuery)
      ) ||
      store.contracts.some(
        (c) => c.borrowerId === b.id && (c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) || getContractNumber(c).includes(searchQuery.trim()) || getInvoiceNumber(c).includes(searchQuery.trim()))
      );

    const isSettled = isBorrowerSettled(b);
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? !isSettled
        : statusFilter === 'SETTLED'
        ? isSettled
        : b.status === 'DEFAULTED';

    return matchesSearch && matchesStatus;
  });

  // Global KPIs Calculation
  const totalFinanced = store.borrowers.reduce((sum, b) => sum + b.totalFinancedIQD, 0);
  const totalRepaid = store.borrowers.reduce((sum, b) => sum + b.totalRepaidIQD, 0);
  const totalRemaining = store.borrowers.reduce((sum, b) => sum + b.remainingDebtIQD, 0);
  const activeBorrowersCount = store.borrowers.filter((b) => !isBorrowerSettled(b)).length;
  const settledBorrowersCount = store.borrowers.filter((b) => isBorrowerSettled(b)).length;
  const collectionRate = totalFinanced > 0 ? Math.round((totalRepaid / totalFinanced) * 100) : 0;

  // Flattened Guarantors List for Guarantors Tab
  const allGuarantors = store.borrowers.flatMap((b) =>
    b.guarantors.map((g) => ({
      ...g,
      borrowerId: b.id,
      borrowerName: b.name,
      borrowerStatus: b.status,
      totalFinancedIQD: b.totalFinancedIQD,
      remainingDebtIQD: b.remainingDebtIQD
    }))
  ).filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.phone.includes(searchQuery) ||
    g.borrowerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Flattened Installment Schedules across all contracts for Schedules Tab
  const allSchedules = useMemo(() => {
    const today = new Date();
    return store.contracts.flatMap((c) =>
      c.schedules.map((s) => ({
        ...s,
        contractId: c.id,
        contractNumber: getContractNumber(c),
        invoiceNumber: getInvoiceNumber(c),
        borrowerName: c.borrowerName,
        borrowerId: c.borrowerId,
        investorName: c.investorName,
        inventoryItemName: c.inventoryItemName,
        dueInfo: calculateInstallmentDueStatus(s.dueDate, s.status === 'PAID', today)
      }))
    ).filter((s) => {
      const matchesSearch =
        s.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.invoiceNumber.includes(searchQuery.trim()) ||
        s.investorName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        scheduleFilter === 'ALL'
          ? true
          : scheduleFilter === 'OVERDUE'
          ? s.dueInfo.status === 'OVERDUE'
          : scheduleFilter === 'DUE_TODAY'
          ? s.dueInfo.status === 'DUE_TODAY'
          : scheduleFilter === 'UPCOMING'
          ? s.dueInfo.status === 'UPCOMING'
          : s.status === 'PAID';

      return matchesSearch && matchesStatus;
    });
  }, [store.contracts, searchQuery, scheduleFilter]);

  // Helper to calculate contract pricing and profit (Deducts down payment from item cost, multiplies remainder by profit %)
  const calculatePricingFromProfitPercent = (
    cost: number,
    profitPercent: number,
    downPayment: number = 0
  ) => {
    const safeCost = Math.max(0, cost);
    const safeDownPayment = Math.min(safeCost, Math.max(0, downPayment));
    const netCost = Math.max(0, safeCost - safeDownPayment);
    const safePercent = Math.max(0, profitPercent);
    const profitAmount = Math.round(netCost * (safePercent / 100));
    const financedAmount = netCost + profitAmount;
    const totalSale = safeDownPayment + financedAmount;

    return {
      itemCostPriceIQD: safeCost,
      downPaymentIQD: safeDownPayment,
      netCostIQD: netCost,
      profitMarginPercent: safePercent,
      profitAmountIQD: profitAmount,
      financedAmountIQD: financedAmount,
      totalSalePriceIQD: totalSale
    };
  };

  const calculatePricingFromProfitAmount = (
    cost: number,
    profitAmount: number,
    downPayment: number = 0
  ) => {
    const safeCost = Math.max(0, cost);
    const safeDownPayment = Math.min(safeCost, Math.max(0, downPayment));
    const netCost = Math.max(0, safeCost - safeDownPayment);
    const safeProfitAmount = Math.max(0, profitAmount);
    const profitPercent = netCost > 0 ? Number(((safeProfitAmount / netCost) * 100).toFixed(1)) : 0;
    const financedAmount = netCost + safeProfitAmount;
    const totalSale = safeDownPayment + financedAmount;

    return {
      itemCostPriceIQD: safeCost,
      downPaymentIQD: safeDownPayment,
      netCostIQD: netCost,
      profitMarginPercent: profitPercent,
      profitAmountIQD: safeProfitAmount,
      financedAmountIQD: financedAmount,
      totalSalePriceIQD: totalSale
    };
  };

  // Helper to strictly get available items belonging to a specific investor / company
  const getItemsForInvestor = (investorId: string) => {
    return store.inventory.filter((item) => {
      const availableQty = item.quantity !== undefined ? item.quantity : 1;
      if (availableQty <= 0) return false;
      if (item.status === 'FULLY_FINANCED' && availableQty <= 0) return false;
      if (
        investorId === 'COMPANY_MAIN' ||
        investorId === 'company-s' ||
        investorId === 'wallet-company' ||
        investorId === store.companyWallet?.id
      ) {
        return (
          item.investorId === 'COMPANY_MAIN' ||
          item.investorId === 'company-s' ||
          item.investorId === 'wallet-company' ||
          item.investorId === store.companyWallet?.id ||
          !item.investorId ||
          item.investorName.includes('الشركة') ||
          item.investorName.includes('أمان') ||
          item.investorName.includes('نظام أمان')
        );
      }
      const selectedInvObj = store.investors.find((inv) => inv.id === investorId);
      return (
        item.investorId === investorId ||
        (selectedInvObj && (
          item.investorId === selectedInvObj.walletId ||
          item.investorName.trim().toLowerCase() === selectedInvObj.name.trim().toLowerCase() ||
          item.investorName.includes(selectedInvObj.name) ||
          selectedInvObj.name.includes(item.investorName)
        ))
      );
    });
  };

  // Available In-stock Items strictly filtered by chosen investor
  const availableInStockItems = React.useMemo(() => {
    return getItemsForInvestor(contractFormData.selectedInvestorId);
  }, [store.inventory, store.investors, store.companyWallet, contractFormData.selectedInvestorId]);

  // Investor selection handler for contract form
  const handleInvestorSelect = (investorId: string) => {
    const matchingItems = getItemsForInvestor(investorId);
    const firstMatching = matchingItems[0] || null;

    if (firstMatching) {
      const cost = firstMatching.unitCostIQD || 0;
      let defaultProfitPercent = 30;
      if (firstMatching.unitCostIQD > 0 && firstMatching.targetSellingPriceIQD > firstMatching.unitCostIQD) {
        defaultProfitPercent = Number((((firstMatching.targetSellingPriceIQD - firstMatching.unitCostIQD) / firstMatching.unitCostIQD) * 100).toFixed(1));
      } else if (contractFormData.profitMarginPercent > 0) {
        defaultProfitPercent = contractFormData.profitMarginPercent;
      }
      const pricing = calculatePricingFromProfitPercent(cost, defaultProfitPercent, contractFormData.downPaymentIQD || 0);

      setContractFormData((prev) => ({
        ...prev,
        selectedInvestorId: investorId,
        inventoryItemId: firstMatching.id,
        quantity: 1,
        ...pricing
      }));
    } else {
      setContractFormData((prev) => ({
        ...prev,
        selectedInvestorId: investorId,
        inventoryItemId: '',
        quantity: 1,
        itemCostPriceIQD: 0,
        downPaymentIQD: 0,
        netCostIQD: 0,
        profitMarginPercent: 30,
        profitAmountIQD: 0,
        financedAmountIQD: 0,
        totalSalePriceIQD: 0
      }));
    }
  };

  // Item selection handler for contract form: pulls non-editable base cost & calculates profit
  const handleItemSelect = (itemId: string) => {
    const item = store.inventory.find((i) => i.id === itemId);
    if (item) {
      const cost = item.unitCostIQD || 0;
      let defaultProfitPercent = 30;
      if (item.unitCostIQD > 0 && item.targetSellingPriceIQD > item.unitCostIQD) {
        defaultProfitPercent = Number((((item.targetSellingPriceIQD - item.unitCostIQD) / item.unitCostIQD) * 100).toFixed(1));
      } else if (contractFormData.profitMarginPercent > 0) {
        defaultProfitPercent = contractFormData.profitMarginPercent;
      }
      const pricing = calculatePricingFromProfitPercent(cost, defaultProfitPercent, contractFormData.downPaymentIQD || 0);

      setContractFormData((prev) => ({
        ...prev,
        inventoryItemId: itemId,
        selectedInvestorId: item.investorId || prev.selectedInvestorId,
        quantity: 1,
        ...pricing
      }));
    } else {
      setContractFormData((prev) => ({ ...prev, inventoryItemId: itemId, quantity: 1 }));
    }
  };

  // Quantity change handler for contract form: recalculates cost and pricing according to quantity
  const handleQuantityChange = (newQty: number) => {
    const currentItem = store.inventory.find((i) => i.id === contractFormData.inventoryItemId);
    const maxQty = currentItem ? (currentItem.quantity !== undefined ? currentItem.quantity : 1) : 1;
    const safeQty = isNaN(newQty) ? 1 : Math.max(1, Math.min(maxQty, newQty));
    const unitCost = currentItem?.unitCostIQD || 0;
    const totalCost = unitCost * safeQty;
    const safeDownPayment = Math.min(totalCost, contractFormData.downPaymentIQD || 0);
    const pricing = calculatePricingFromProfitPercent(
      totalCost,
      contractFormData.profitMarginPercent || 30,
      safeDownPayment
    );
    setContractFormData((prev) => ({
      ...prev,
      quantity: safeQty,
      ...pricing
    }));
  };

  // Helper to open the Issue Contract Modal for a specific borrower
  const openIssueContractModalForBorrower = (b: Borrower) => {
    setNewContractBorrower(b);
    let defaultInvestorId = store.investors[0]?.id || 'COMPANY_MAIN';

    const companyItems = getItemsForInvestor('COMPANY_MAIN');
    if (companyItems.length > 0) {
      defaultInvestorId = 'COMPANY_MAIN';
    } else {
      const invWithItems = store.investors.find((inv) => getItemsForInvestor(inv.id).length > 0);
      if (invWithItems) {
        defaultInvestorId = invWithItems.id;
      }
    }

    const matchingItems = getItemsForInvestor(defaultInvestorId);
    const firstMatching = matchingItems[0] || null;

    let pricing = calculatePricingFromProfitPercent(0, 30, 0);

    if (firstMatching) {
      const cost = firstMatching.unitCostIQD || 0;
      let defaultProfitPercent = 30;
      if (firstMatching.unitCostIQD > 0 && firstMatching.targetSellingPriceIQD > firstMatching.unitCostIQD) {
        defaultProfitPercent = Number((((firstMatching.targetSellingPriceIQD - firstMatching.unitCostIQD) / firstMatching.unitCostIQD) * 100).toFixed(1));
      }
      pricing = calculatePricingFromProfitPercent(cost, defaultProfitPercent, 0);
    }

    setContractFormData({
      borrowerId: b.id,
      selectedInvestorId: defaultInvestorId,
      inventoryItemId: firstMatching ? firstMatching.id : '',
      quantity: 1,
      startDate: new Date().toISOString().split('T')[0],
      ...pricing,
      monthsCount: 14
    });
    setIsIssueContractModalOpen(true);
  };

  // Calculations for Contract Form: financed amount is net remainder + profit (or totalSale - downPayment)
  const financedAmountCalc = Math.max(
    0,
    contractFormData.financedAmountIQD ??
      (contractFormData.totalSalePriceIQD - (contractFormData.downPaymentIQD || 0))
  );
  const monthlyInstallmentCalc =
    contractFormData.monthsCount > 0 ? Math.round(financedAmountCalc / contractFormData.monthsCount) : 0;

  // Masking Helper
  const maskText = (str: string) => (isPrivacyMasked ? '••••••••' : str);
  const maskMoney = (num: number, id?: string, label?: string) => {
    if (!id) return `${formatNumber(num)} د.ع`;
    return <PrivacyMaskedAmount id={id} value={num} label={label} size="xs" />;
  };

  // Handle Add Borrower Submit
  const handleAddBorrowerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingBorrower) return;
    if (!borrowerForm.name.trim() || !borrowerForm.phone.trim()) {
      alert('يرجى ملء كافة البيانات الأساسية للزبون (الاسم ورقم الهاتف)');
      return;
    }
    if (!borrowerForm.g1Name.trim() || !borrowerForm.g1Phone.trim()) {
      alert('يرجى إضافة بيانات الكفيل (الاسم ورقم الهاتف)');
      return;
    }

    // Duplicate Check Confirmations
    if (borrowerDuplicateMatches.exactNameMatches.length > 0) {
      const match = borrowerDuplicateMatches.exactNameMatches[0];
      const proceed = window.confirm(
        `⚠️ تنبيه: يوجد زبون مسجل مسبقاً بنفس الاسم تماماً:\n"${match.name}" (الهاتف: ${match.phone || 'غير مسجل'})\n\nهل أنت متأكد من رغبتك في تسجيل زبون جديد بنفس الاسم؟`
      );
      if (!proceed) return;
    } else if (borrowerDuplicateMatches.phoneMatches.length > 0) {
      const match = borrowerDuplicateMatches.phoneMatches[0];
      const proceed = window.confirm(
        `⚠️ تنبيه: رقم الهاتف المدخل مسجل مسبقاً للزبون:\n"${match.name}" (${match.phone})\n\nهل أنت متأكد من رغبتك في المتابعة؟`
      );
      if (!proceed) return;
    }

    const guarantors = [
      {
        name: borrowerForm.g1Name,
        address: borrowerForm.g1Address,
        phone: borrowerForm.g1Phone,
        nationalId: borrowerForm.g1NationalId || `IQ-${Math.floor(100000 + Math.random() * 900000)}`,
        department: borrowerForm.g1Department,
        letterNumber: borrowerForm.g1LetterNumber || `BOOK-${Math.floor(1000 + Math.random() * 9000)}`,
        letterDate: borrowerForm.g1LetterDate
      }
    ];

    const payload = {
      name: borrowerForm.name,
      address: borrowerForm.address,
      phone: borrowerForm.phone,
      nationalId: borrowerForm.nationalId,
      wifeName: borrowerForm.wifeName,
      city: borrowerForm.city,
      introducedBy: borrowerForm.introducedBy ? borrowerForm.introducedBy.trim() : undefined,
      guarantors
    };

    setIsSubmittingBorrower(true);
    try {
      let res: { success: boolean; message: string; borrower?: Borrower } | undefined;
      if (onAddBorrower) {
        const apiRes = await onAddBorrower(payload);
        res = apiRes || { success: true, message: `تم تسجيل الزبون ${payload.name} بنجاح` };
      } else {
        res = store.addBorrower(payload);
      }

      if (res && res.success) {
        showToast(res.message);
        setIsAddBorrowerOpen(false);

        // Find or create the borrower object to pass to the issue contract modal
        const targetBorrower: Borrower = res.borrower || store.borrowers.find((b) => b.name === payload.name) || {
          id: `borrower-${Date.now()}`,
          name: payload.name,
          phone: payload.phone,
          address: payload.address,
          city: payload.city,
          guarantors: payload.guarantors,
          totalFinancedIQD: 0,
          totalRepaidIQD: 0,
          remainingDebtIQD: 0,
          status: 'ACTIVE',
          createdAt: new Date().toISOString().split('T')[0]
        };

        // Open the Issue Contract Modal immediately for the newly registered borrower!
        openIssueContractModalForBorrower(targetBorrower);

        setBorrowerForm({
          name: '',
          address: 'سامراء - ',
          phone: '',
          nationalId: '',
          wifeName: '',
          city: 'سامراء',
          introducedBy: '',
          g1Name: '',
          g1Address: 'سامراء - ',
          g1Phone: '',
          g1NationalId: '',
          g1Department: 'تربية صلاح الدين / سامراء',
          g1LetterNumber: '',
          g1LetterDate: new Date().toISOString().split('T')[0]
        });
      }
    } finally {
      setIsSubmittingBorrower(false);
    }
  };

  // Handle Issue Contract Submit
  const handleIssueContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingContract) return;
    if (!contractFormData.borrowerId) {
      alert('يرجى اختيار الزبون الخاص بالعقد');
      return;
    }
    if (!contractFormData.inventoryItemId) {
      alert('يرجى اختيار المادة المتاحة بالمخزن');
      return;
    }
    if (contractFormData.downPaymentIQD > contractFormData.itemCostPriceIQD) {
      alert('الدفعة المقدمة لا يمكن أن تتجاوز سعر تكلفة البضاعة الأصلي');
      return;
    }
    if (contractFormData.totalSalePriceIQD <= 0) {
      alert('يرجى إدخال سعر بيع بالتقسيط صحيح');
      return;
    }
    if (contractFormData.monthsCount <= 0) {
      alert('يرجى تحديد عدد أشهر التقسيط (شهر واحد على الأقل)');
      return;
    }
    const contractQty = Math.max(1, contractFormData.quantity || 1);
    const selectedItem = store.inventory.find((i) => i.id === contractFormData.inventoryItemId);
    const availableQty = selectedItem ? (selectedItem.quantity !== undefined ? selectedItem.quantity : 1) : 0;
    if (availableQty < contractQty) {
      alert(`الكمية المطلوبة (${contractQty}) غير متوفرة بالمخزن. المتوفر حالياً: (${availableQty}) قطعة`);
      return;
    }

    setIsSubmittingContract(true);
    try {
      let result;
      if (onCreateContract) {
        result = await onCreateContract({
          borrowerId: contractFormData.borrowerId,
          inventoryItemId: contractFormData.inventoryItemId,
          quantity: contractQty,
          totalSalePriceIQD: Number(contractFormData.totalSalePriceIQD),
          downPaymentIQD: Number(contractFormData.downPaymentIQD || 0),
          monthsCount: Number(contractFormData.monthsCount),
          startDate: contractFormData.startDate
        });
      } else {
        result = store.createContract({
          borrowerId: contractFormData.borrowerId,
          inventoryItemId: contractFormData.inventoryItemId,
          quantity: contractQty,
          totalSalePriceIQD: Number(contractFormData.totalSalePriceIQD),
          downPaymentIQD: Number(contractFormData.downPaymentIQD || 0),
          monthsCount: Number(contractFormData.monthsCount),
          startDate: contractFormData.startDate
        });
      }

      if (result && result.success) {
        showToast(result.message || 'تم إبرام عقد التقسيط وتوليد الفاتورة والجدول بنجاح');
        setIsIssueContractModalOpen(false);

        // Find the created contract or use returned one
        const createdContract =
          result.contract ||
          store.contracts.find((c) => c.borrowerId === contractFormData.borrowerId) ||
          store.contracts[0];

        if (createdContract) {
          setSelectedContractForHub(createdContract);
        }
      } else {
        alert(result?.message || 'تعذر إنشاء العقد بالسيستم');
      }
    } finally {
      setIsSubmittingContract(false);
    }
  };

  // Handle Add Guarantor Submit
  const handleAddGuarantorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingGuarantor) return;
    if (!guarantorTargetBorrowerId || !guarantorForm.name.trim() || !guarantorForm.phone.trim()) {
      alert('يرجى ملء كافة بيانات الكفيل الأساسية');
      return;
    }

    const payload = {
      name: guarantorForm.name,
      address: guarantorForm.address,
      phone: guarantorForm.phone,
      nationalId: guarantorForm.nationalId || `IQ-${Math.floor(100000 + Math.random() * 900000)}`,
      department: guarantorForm.department,
      letterNumber: guarantorForm.letterNumber,
      letterDate: guarantorForm.letterDate
    };

    setIsSubmittingGuarantor(true);
    try {
      let res: { success: boolean; message: string } | undefined;
      if (onAddGuarantor) {
        await onAddGuarantor(guarantorTargetBorrowerId, payload);
        res = { success: true, message: `تم إضافة الكفيل ${payload.name} بنجاح` };
      } else {
        res = store.addGuarantor(guarantorTargetBorrowerId, payload);
      }

      if (res && res.success) {
        showToast(res.message);
        setIsAddGuarantorOpen(false);
        setGuarantorForm({
          name: '',
          address: 'سامراء - ',
          phone: '',
          nationalId: '',
          department: '',
          letterNumber: '',
          letterDate: new Date().toISOString().split('T')[0]
        });
        setGuarantorTargetBorrowerId(null);
      }
    } finally {
      setIsSubmittingGuarantor(false);
    }
  };

  // Handle Pay Installment
  const handlePay = async (contractId: string, scheduleId: string, paidDate?: string) => {
    if (payingScheduleId === scheduleId) return;
    setPayingScheduleId(scheduleId);
    try {
      if (onPaySchedule) {
        await onPaySchedule(contractId, scheduleId, undefined, paidDate);
        showToast('تم تسديد القسط بنجاح وتحديث السجل المالي');
      } else {
        const res = store.payInstallmentSchedule(contractId, scheduleId, undefined, paidDate);
        if (res.success) {
          showToast(res.message);
        }
      }
    } finally {
      setPayingScheduleId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-purple-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-purple-400/30 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span className="font-bold text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30 shadow-inner">
            <UserCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white tracking-tight">سجل الزبائن والكفلاء</h1>
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs font-bold border border-purple-500/20">
                متابعة الذمم والضمانات
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              إدارة ملفات الزبائن، بيانات الكفلاء الضامنين، تتبع السداد، وجدولة الأقساط المتبقية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end z-10">
          {/* Reusable Privacy Toggle Button */}
          <PrivacyToggleButton />

          {/* Borrower Introducers Report Trigger (Subtle / Quiet button) */}
          <button
            onClick={() => setIsIntroducersModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="كشف الزبائن مجمعين حسب من أحضرهم (المتابعة الودية قبل الكفيل)"
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>كشف المعرّفين</span>
          </button>

          {/* Debt Collector Field Report Trigger */}
          <button
            onClick={() => {
              setCollectorReportFilter('ALL');
              setIsCollectorReportOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="طباعة كشف المتابعة الميدانية والاتصال بالمتأخرين"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>كشف المحصل الميداني</span>
          </button>

          {/* New Borrower Action Button */}
          <button
            onClick={() => setIsAddBorrowerOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-purple-900/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل زبون جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Financed */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">إجمالي الذمم الممنوحة</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            <PrivacyMaskedAmount id="bor-top-financed" value={totalFinanced} label="إجمالي الذمم الممنوحة" size="lg" />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-purple-400 font-bold">عقود تمويل قروض</span>
            <span>في سامراء والمحافظة</span>
          </div>
        </div>

        {/* Card 2: Total Repaid */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">المبالغ المسددة فعلياً</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            <PrivacyMaskedAmount id="bor-top-repaid" value={totalRepaid} label="المبالغ المسددة فعلياً" size="lg" />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold">نسبة التحصيل: {collectionRate}%</span>
            <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Remaining Debt */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">الذمم المتبقية بالذمة</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <BadgeAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-300 tracking-tight">
            <PrivacyMaskedAmount id="bor-top-remaining" value={totalRemaining} label="الذمم المتبقية بالذمة" size="lg" />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-purple-400 font-bold">مضمونة بكفلاء رسميين</span>
          </div>
        </div>

        {/* Card 4: Borrowers Count */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">الزبائن والنشطون</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">
            {store.borrowers.length}{' '}
            <span className="text-xs font-normal text-slate-400">ملفات زبائن</span>
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-emerald-400 font-bold">{activeBorrowersCount} نشط</span>
            <span>•</span>
            <span className="text-blue-400 font-bold">{settledBorrowersCount} مسدد</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter & Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        {/* Realtime Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث باسم الزبون، رقم الهاتف، العنوان، اسم الكفيل، أو رقم العقد..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500 transition-all"
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

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1 hidden sm:flex">
            <Filter className="w-3.5 h-3.5 text-purple-400" /> الحالة:
          </span>
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({store.borrowers.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              نشط ({activeBorrowersCount})
            </button>
            <button
              onClick={() => setStatusFilter('SETTLED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'SETTLED'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              مسدد ({settledBorrowersCount})
            </button>
          </div>
        </div>

        {/* Tabs & Layout Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Card Layout Switcher (Grid vs List) when active tab is cards */}
          {activeTab === 'cards' && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => handleCardLayoutModeChange('grid')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  cardLayoutMode === 'grid'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="عرض شبكي مدمج (4-5 أعمدة)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">شبكة</span>
              </button>
              <button
                onClick={() => handleCardLayoutModeChange('list')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  cardLayoutMode === 'list'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="عرض قائمة تفصيلية"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">قائمة</span>
              </button>
            </div>
          )}

          {/* Main Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'cards'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">بطاقات الزبائن</span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'table'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">الجدول الشامل</span>
            </button>

            <button
              onClick={() => setActiveTab('guarantors')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'guarantors'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">سجل الكفلاء ({allGuarantors.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('schedules')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'schedules'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">جدول الأقساط ({allSchedules.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: Borrowers Cards Grid View (Compact 4-5 Columns / List View) */}
      {activeTab === 'cards' && (
        filteredBorrowers.length === 0 ? (
          <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center">
            <UserCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">لا يوجد زبائن يطابقون معايير البحث</h3>
            <p className="text-xs text-slate-400 mt-1">جرّب تغيير عبارة البحث أو الفلتر المالي</p>
          </div>
        ) : cardLayoutMode === 'grid' ? (
          /* 4 to 5 Columns Compact Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {filteredBorrowers.map((b) => {
              const borrowerContracts = store.contracts.filter((c) => c.borrowerId === b.id);
              const pctRepaid =
                b.totalFinancedIQD > 0
                  ? Math.round((b.totalRepaidIQD / b.totalFinancedIQD) * 100)
                  : 0;

              return (
                <div
                  key={b.id}
                  className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between gap-3 shadow-lg hover:border-purple-500/40 transition-all relative overflow-hidden group"
                >
                  <div className="space-y-2.5">
                    {/* Borrower Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-sm truncate group-hover:text-purple-300 transition-colors" title={b.name}>
                          <PrivacyMaskedText id={`bor-card-name-${b.id}`} value={b.name} label={`الزبون: ${b.name}`} />
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-purple-400 shrink-0" />
                          <span>{maskText(b.phone)}</span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const statusDisplay = getBorrowerStatusDisplay(b);
                            return (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusDisplay.className}`}
                              >
                                {statusDisplay.label}
                              </span>
                            );
                          })()}
                          {(() => {
                            const credit = evaluateBorrowerCredit(b, store.contracts);
                            const badge = getCreditTierBadge(credit.tier, credit.totalScore);
                            return (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.classes}`}
                                title={`التقييم الائتماني: ${credit.totalScore}/100 - سقف متاح: ${formatIQD(credit.availableCreditLimitIQD)} د.ع`}
                              >
                                {badge.label}
                              </span>
                            );
                          })()}
                        </div>
                        {(() => {
                          const due = getBorrowerDueSummary(b.id, store.contracts);
                          if (due.overallStatus === 'OVERDUE') {
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${due.summaryBadge.className}`}>
                                ⚠️ {due.summaryBadge.label}
                              </span>
                            );
                          }
                          if (due.overallStatus === 'DUE_TODAY') {
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${due.summaryBadge.className}`}>
                                🔔 {due.summaryBadge.label}
                              </span>
                            );
                          }
                          if (due.overallStatus === 'UPCOMING') {
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${due.summaryBadge.className}`}>
                                ⏳ {due.summaryBadge.label}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Location & Job */}
                    <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/40 p-2 rounded-xl border border-slate-800/40">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">المدينة:</span>
                        <span className="font-semibold text-slate-300">{b.city || 'سامراء'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">الوظيفة:</span>
                        <span className="font-semibold text-slate-300 truncate max-w-[110px]">{b.jobTitle || 'غير محدد'}</span>
                      </div>
                      {b.guarantors.length > 0 && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">الكفلاء:</span>
                          <span className="font-bold text-purple-300">{b.guarantors.length} كفيل</span>
                        </div>
                      )}
                      {b.introducedBy && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">المعرّف:</span>
                          <span className="font-bold text-amber-300 truncate max-w-[120px]">{b.introducedBy}</span>
                        </div>
                      )}
                    </div>

                    {/* Financial Summary & Progress */}
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">إجمالي الذمة:</span>
                        <span className="font-bold text-white">{maskMoney(b.totalFinancedIQD, `bor-list-fin-${b.id}`, `ذمة: ${b.name}`)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">المتبقي ذمة:</span>
                        <span className="font-bold text-purple-300">{maskMoney(b.remainingDebtIQD, `bor-list-rem-${b.id}`, `متبقي: ${b.name}`)}</span>
                      </div>

                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
                          <span>سداد الديون</span>
                          <span className="font-bold text-emerald-400">{pctRepaid}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                            style={{ width: `${pctRepaid}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compact Toolbar Action Buttons */}
                  <div className="pt-2 flex items-center justify-between gap-1 border-t border-slate-800/60 text-[11px]">
                    <button
                      onClick={() => openIssueContractModalForBorrower(b)}
                      className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                      title="إصدار فاتورة بيع وعقد تقسيط لهذا الزبون"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setSelectedBorrowerId(b.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white transition-colors"
                      title="عرض التفاصيل وكشف الحساب"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => openEditModal(b)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-colors border border-slate-700/50"
                      title="تعديل بيانات الزبون"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setGuarantorTargetBorrowerId(b.id);
                        setIsAddGuarantorOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 transition-colors border border-slate-700/50"
                      title="إضافة كفيل"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteBorrower(b.id, b.name)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20"
                      title="حذف الزبون"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Mode */
          <div className="space-y-3">
            {filteredBorrowers.map((b) => {
              const borrowerContracts = store.contracts.filter((c) => c.borrowerId === b.id);
              const pctRepaid =
                b.totalFinancedIQD > 0
                  ? Math.round((b.totalRepaidIQD / b.totalFinancedIQD) * 100)
                  : 0;

              return (
                <div
                  key={b.id}
                  className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg hover:border-purple-500/40 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-white text-base">
                        <PrivacyMaskedText id={`bor-list-name-${b.id}`} value={b.name} label={`الزبون: ${b.name}`} />
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-xs border border-purple-500/20">
                        {b.city || 'سامراء'}
                      </span>
                      {(() => {
                        const statusDisplay = getBorrowerStatusDisplay(b);
                        return (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusDisplay.className}`}
                          >
                            {statusDisplay.label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const credit = evaluateBorrowerCredit(b, store.contracts);
                        const badge = getCreditTierBadge(credit.tier, credit.totalScore);
                        return (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.classes}`}
                            title={`التقييم الائتماني: ${credit.totalScore}/100 - سقف متاح: ${formatIQD(credit.availableCreditLimitIQD)} د.ع`}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const due = getBorrowerDueSummary(b.id, store.contracts);
                        if (due.overallStatus === 'OVERDUE') {
                          return (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${due.summaryBadge.className}`}>
                              ⚠️ {due.summaryBadge.label}
                            </span>
                          );
                        }
                        if (due.overallStatus === 'DUE_TODAY') {
                          return (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${due.summaryBadge.className}`}>
                              🔔 {due.summaryBadge.label}
                            </span>
                          );
                        }
                        if (due.overallStatus === 'UPCOMING') {
                          return (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${due.summaryBadge.className}`}>
                              ⏳ {due.summaryBadge.label}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span>الهاتف: {maskText(b.phone)}</span>
                      <span>•</span>
                      <span>العنوان: {b.address}</span>
                      <span>•</span>
                      <span>الوظيفة: {b.jobTitle || 'غير محدد'}</span>
                      <span>•</span>
                      <span>الكفلاء: {b.guarantors.length} كفيل</span>
                      {b.introducedBy && (
                        <>
                          <span>•</span>
                          <span className="text-amber-300 font-semibold">المعرّف: {b.introducedBy}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-left text-xs">
                      <div className="text-slate-400 flex items-center gap-2"><span>إجمالي الذمة:</span> <span className="font-bold text-white">{maskMoney(b.totalFinancedIQD, `bor-card-fin-${b.id}`, `ذمة: ${b.name}`)}</span></div>
                      <div className="text-slate-400 flex items-center gap-2"><span>المتبقي:</span> <span className="font-bold text-purple-300">{maskMoney(b.remainingDebtIQD, `bor-card-rem-${b.id}`, `متبقي: ${b.name}`)}</span> <span className="text-[10px]">({pctRepaid}% مسدد)</span></div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openIssueContractModalForBorrower(b)}
                        className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-bold text-xs transition-all border border-emerald-500/30 flex items-center gap-1"
                        title="إصدار فاتورة بيع وعقد تقسيط لهذا الزبون"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>إصدار عقد / فاتورة</span>
                      </button>

                      <button
                        onClick={() => setSelectedBorrowerId(b.id)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 font-bold text-xs transition-all border border-slate-700 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>كشف الحساب</span>
                      </button>

                      <button
                        onClick={() => openEditModal(b)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-amber-300 transition-all border border-slate-700"
                        title="تعديل الزبون"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setGuarantorTargetBorrowerId(b.id);
                          setIsAddGuarantorOpen(true);
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-purple-500/20 text-purple-300 transition-all border border-slate-700"
                        title="إضافة كفيل"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteBorrower(b.id, b.name)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all border border-red-500/20"
                        title="حذف الزبون"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB 2: Comprehensive Table View */}
      {activeTab === 'table' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-4">اسم الزبون والمعلومات</th>
                  <th className="p-4">الوظيفة والدخل الشهري</th>
                  <th className="p-4">الكفلاء والضمانات</th>
                  <th className="p-4">إجمالي الذمة</th>
                  <th className="p-4">المسدد فعلياً</th>
                  <th className="p-4">المتبقي ذمة</th>
                  <th className="p-4">الحالة والتأمين</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBorrowers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      لا يوجد زبائن يطابقون معايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredBorrowers.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm">
                            <PrivacyMaskedText id={`bor-tbl-name-${b.id}`} value={b.name} label={`الزبون: ${b.name}`} />
                          </p>
                          {(() => {
                            const credit = evaluateBorrowerCredit(b, store.contracts);
                            const badge = getCreditTierBadge(credit.tier, credit.totalScore);
                            return (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.classes}`}
                                title={`التقييم الائتماني: ${credit.totalScore}/100 - سقف متاح: ${formatIQD(credit.availableCreditLimitIQD)} د.ع`}
                              >
                                {badge.label}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                          <span>{maskText(b.phone)}</span>
                          <span>•</span>
                          <span>{b.address}</span>
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-slate-200 font-semibold">{b.jobTitle || 'غير محدد'}</p>
                        {b.introducedBy && (
                          <p className="text-amber-400 text-[10px] font-semibold mt-0.5">
                            المعرّف: {b.introducedBy}
                          </p>
                        )}
                        <p className="text-emerald-400 text-[11px] font-bold">
                          {maskMoney(b.monthlyIncomeIQD || 0)} / شهرياً
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {b.guarantors.map((g, i) => (
                            <div key={i} className="text-slate-300 text-[11px]">
                              <span className="text-white font-semibold">
                                <PrivacyMaskedText id={`bor-tbl-g-${b.id}-${i}`} value={g.name} label={`الكفيل: ${g.name}`} size="xs" />
                              </span>{' '}
                              <span className="text-slate-500">({maskText(g.phone)})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-white">{maskMoney(b.totalFinancedIQD, `bor-tbl-fin-${b.id}`, `ممنوح: ${b.name}`)}</td>
                      <td className="p-4 font-bold text-emerald-400">{maskMoney(b.totalRepaidIQD, `bor-tbl-rep-${b.id}`, `مسدد: ${b.name}`)}</td>
                      <td className="p-4 font-bold text-purple-300">{maskMoney(b.remainingDebtIQD, `bor-tbl-rem-${b.id}`, `متبقي: ${b.name}`)}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          {(() => {
                            const statusDisplay = getBorrowerStatusDisplay(b);
                            return (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusDisplay.className}`}
                              >
                                {statusDisplay.label}
                              </span>
                            );
                          })()}
                          {(() => {
                            const due = getBorrowerDueSummary(b.id, store.contracts);
                            if (due.overallStatus === 'OVERDUE') {
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${due.summaryBadge.className}`}>
                                  ⚠️ {due.summaryBadge.label}
                                </span>
                              );
                            }
                            if (due.overallStatus === 'DUE_TODAY') {
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${due.summaryBadge.className}`}>
                                  🔔 {due.summaryBadge.label}
                                </span>
                              );
                            }
                            if (due.overallStatus === 'UPCOMING') {
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${due.summaryBadge.className}`}>
                                  ⏳ {due.summaryBadge.label}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openIssueContractModalForBorrower(b)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold transition-all text-[11px] flex items-center gap-1"
                            title="إصدار فاتورة بيع وعقد تقسيط لهذا الزبون"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>عقد/فاتورة</span>
                          </button>

                          <button
                            onClick={() => setSelectedBorrowerId(b.id)}
                            className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 font-bold transition-all text-[11px]"
                            title="عرض التفاصيل وكشف الحساب"
                          >
                            عرض التفاصيل
                          </button>

                          <button
                            onClick={() => openEditModal(b)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-colors border border-slate-700"
                            title="تعديل بيانات الزبون"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteBorrower(b.id, b.name)}
                            className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20"
                            title="حذف الزبون"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Guarantors & Securities Registry */}
      {activeTab === 'guarantors' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>سجل كافة الكفلاء الضامنين للذمم المالية القائمة ({allGuarantors.length})</span>
            </span>
            <span className="text-slate-400">ملاحظة: كافة الكفلاء ملزمون قانونياً بسداد الأقساط عند التعثر</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allGuarantors.length === 0 ? (
              <div className="col-span-full bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center">
                <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">لا يوجد كفلاء مطبقون لمعيار البحث</h3>
              </div>
            ) : (
              allGuarantors.map((g, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-lg hover:border-purple-500/40 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="font-bold text-white text-base">{g.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">هاتف: {maskText(g.phone)}</p>
                    </div>
                    <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">المكفول:</span>
                      <strong className="text-white">{g.borrowerName}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">الذمة المكفولة:</span>
                      <strong className="text-purple-300">{maskMoney(g.remainingDebtIQD, `bor-guar-rem-${g.borrowerId}-${g.phone}`, `كفالة: ${g.borrowerName}`)}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">البطاقة الوطنية:</span>
                      <span className="text-slate-300 font-mono text-[11px]">{maskText(g.nationalId)}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedBorrowerId(g.borrowerId)}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-bold transition-all border border-slate-700"
                  >
                    عرض ملف الزبون المكفول
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Installment Schedules & Collection View */}
      {activeTab === 'schedules' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>جدول استحقاقات الأقساط الشهري والمتابعة</span>
              </h3>
              <p className="text-xs text-slate-400">تتبع استحقاقات الأقساط بالأيام، الدفعات المستلمة، والاتصال بالمتأخرين</p>
            </div>

            <button
              onClick={() => {
                setCollectorReportFilter(
                  scheduleFilter === 'OVERDUE'
                    ? 'OVERDUE'
                    : scheduleFilter === 'DUE_TODAY'
                    ? 'DUE_TODAY'
                    : scheduleFilter === 'UPCOMING'
                    ? 'UPCOMING'
                    : 'ALL'
                );
                setIsCollectorReportOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-900/30 hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ طباعة كشف المحصل الميداني (A4)</span>
            </button>
          </div>

          {/* Schedule Status Sub-Filter */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setScheduleFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                scheduleFilter === 'ALL'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setScheduleFilter('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                scheduleFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-rose-400 hover:bg-rose-950/40'
              }`}
            >
              المتأخرون عن السداد
            </button>
            <button
              onClick={() => setScheduleFilter('DUE_TODAY')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                scheduleFilter === 'DUE_TODAY'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-blue-400 hover:bg-blue-950/40'
              }`}
            >
              يستحقون اليوم
            </button>
            <button
              onClick={() => setScheduleFilter('UPCOMING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                scheduleFilter === 'UPCOMING'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-amber-400 hover:bg-amber-950/40'
              }`}
            >
              قريباً (خلال 7 أيام)
            </button>
            <button
              onClick={() => setScheduleFilter('PAID')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                scheduleFilter === 'PAID'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-emerald-400 hover:bg-emerald-950/40'
              }`}
            >
              المسددون
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-4">رقم القسط والعقد</th>
                  <th className="p-4">اسم الزبون والمادة</th>
                  <th className="p-4">المستثمر الممول</th>
                  <th className="p-4">تاريخ الاستحقاق</th>
                  <th className="p-4 text-center">حالة الاستحقاق والأيام</th>
                  <th className="p-4">مبلغ القسط</th>
                  <th className="p-4">تقسيم الربح (مستثمر/شركة)</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      لا يوجد أقساط مطابقة للبحث أو الفلتر المختار
                    </td>
                  </tr>
                ) : (
                  allSchedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-white">
                        قسط #{s.installmentNumber}{' '}
                        <span className="text-[11px] font-normal text-slate-400">(عقد #{s.contractNumber})</span>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-white">{s.borrowerName}</p>
                        <p className="text-slate-400 text-[11px]">{s.inventoryItemName}</p>
                      </td>
                      <td className="p-4 text-emerald-400 font-semibold">{s.investorName}</td>
                      <td className="p-4 font-mono text-slate-300">{s.dueDate}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] ${s.dueInfo.badgeClassName}`}>
                          {s.dueInfo.status === 'OVERDUE' && '⚠️ '}
                          {s.dueInfo.status === 'DUE_TODAY' && '🔔 '}
                          {s.dueInfo.status === 'UPCOMING' && '⏳ '}
                          {s.dueInfo.status === 'PAID' && '✅ '}
                          {s.dueInfo.label}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-white">{maskMoney(s.amountIQD, `bor-sch-amt-${s.id}`, `قسط: ${s.dueDate}`)}</td>
                      <td className="p-4 text-[11px] text-slate-300">
                        <span className="text-emerald-400 font-bold">{maskMoney(s.investorProfitShareIQD, `bor-sch-invprof-${s.id}`, `ربح المستثمر`)}</span> /{' '}
                        <span className="text-purple-400 font-bold">{maskMoney(s.companyProfitShareIQD, `bor-sch-compprof-${s.id}`, `ربح الشركة`)}</span>
                      </td>
                      <td className="p-4">
                        {s.status === 'PAID' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[11px] border border-emerald-500/20">
                            مسدد ({s.paidDate})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 font-bold text-[11px] border border-amber-500/20">
                            بانتظار السداد
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {s.status === 'PAID' ? (
                          <span className="text-slate-500 font-bold text-[11px]">مكتمل</span>
                        ) : (
                          <button
                            onClick={() => handlePay(s.contractId, s.id)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all text-[11px] shadow-md"
                          >
                            تسديد القسط
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Register New Borrower & Guarantors */}
      {isAddBorrowerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-6 p-6 max-h-[90vh] overflow-y-auto cursor-default"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">تسجيل زبون جديد مع الكفلاء</h3>
                  <p className="text-xs text-slate-400">إدخال البيانات الرسمية للزبون والكفيل الضامن بدقة وبساطة</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddBorrowerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBorrowerSubmit} className="space-y-6 text-xs">
              {/* Section 1: Borrower Details */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-purple-300 text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> 1. معلومات الزبون
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 font-semibold mb-1">الاسم الكامل *</label>
                    <input
                      type="text"
                      required
                      placeholder="الاسم الثلاثي واللقب للزبون"
                      value={borrowerForm.name}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, name: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">العنوان *</label>
                    <input
                      type="text"
                      required
                      placeholder="المدينة / الحي / الزقاق"
                      value={borrowerForm.address}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, address: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">رقم الهاتف *</label>
                    <input
                      type="text"
                      required
                      placeholder="0770XXXXXXX"
                      value={borrowerForm.phone}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, phone: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">رقم الهوية / البطاقة الوطنية</label>
                    <input
                      type="text"
                      placeholder="رقم الهوية الوطنية"
                      value={borrowerForm.nationalId}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, nationalId: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">اسم الزوجة</label>
                    <input
                      type="text"
                      placeholder="اسم الزوجة الكامل"
                      value={borrowerForm.wifeName}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, wifeName: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 font-semibold mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-amber-300">
                        <Users className="w-3.5 h-3.5" />
                        <span>من أحضر الزبون (المعرّف للمتابعة الودية)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">اختياري - موظف أو شخص خارجي</span>
                    </label>
                    <input
                      type="text"
                      list="introducers-suggestions-list"
                      placeholder="اكتب اسم الشخص الذي أحضر الزبون (مثال: مروان، أسعد، خالد...)"
                      value={borrowerForm.introducedBy}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, introducedBy: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500 font-semibold text-xs"
                    />
                    <datalist id="introducers-suggestions-list">
                      {Array.from(new Set(store.borrowers.map((b) => b.introducedBy).filter(Boolean))).map((name) => (
                        <option key={name} value={name!} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Duplicate Borrower Warning Banner */}
                <DuplicateWarningBanner
                  matchResult={borrowerDuplicateMatches}
                  entityLabel="زبون"
                />
              </div>

              {/* Section 2: Guarantor & Department Details */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> 2. معلومات الكفيل ودائرة الكفيل
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 font-semibold mb-1">اسم الكفيل *</label>
                    <input
                      type="text"
                      required
                      placeholder="الاسم الثلاثي واللقب للكفيل"
                      value={borrowerForm.g1Name}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, g1Name: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">عنوان الكفيل</label>
                    <input
                      type="text"
                      placeholder="عنوان سكن الكفيل"
                      value={borrowerForm.g1Address}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, g1Address: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">رقم هاتف الكفيل *</label>
                    <input
                      type="text"
                      required
                      placeholder="0770XXXXXXX"
                      value={borrowerForm.g1Phone}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, g1Phone: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">رقم الهوية للكفيل</label>
                    <input
                      type="text"
                      placeholder="رقم بطاقة الكفيل الوطنية"
                      value={borrowerForm.g1NationalId}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, g1NationalId: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">دائرة الكفيل</label>
                    <input
                      type="text"
                      placeholder="اسم الوزارة / الدائرة / المديرية"
                      value={borrowerForm.g1Department}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, g1Department: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">رقم كتاب الكفالة</label>
                    <input
                      type="text"
                      placeholder="رقم كتاب التكفيل / التأييد"
                      value={borrowerForm.g1LetterNumber}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, g1LetterNumber: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">تاريخ كتاب الكفالة</label>
                    <input
                      type="date"
                      value={borrowerForm.g1LetterDate}
                      onChange={(e) => setBorrowerForm({ ...borrowerForm, g1LetterDate: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Duplicate Guarantor Warning Banner */}
                <DuplicateWarningBanner
                  matchResult={guarantorDuplicateMatches}
                  entityLabel="كفيل"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddBorrowerOpen(false)}
                  disabled={isSubmittingBorrower}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBorrower}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white font-bold transition-all shadow-lg flex items-center gap-2"
                >
                  {isSubmittingBorrower ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>جاري تسجيل الزبون والكفيل...</span>
                    </>
                  ) : (
                    <span>حفظ وتسجيل الزبون</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Guarantor Modal */}
      {isAddGuarantorOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5 cursor-default"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">إضافة كفيل جديد لزبون</h3>
              <button
                onClick={() => setIsAddGuarantorOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddGuarantorSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">اسم الكفيل *</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم الكفيل الكامل"
                    value={guarantorForm.name}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">العنوان</label>
                  <input
                    type="text"
                    placeholder="عنوان سكن الكفيل"
                    value={guarantorForm.address}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, address: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">رقم الهاتف *</label>
                  <input
                    type="text"
                    required
                    placeholder="0770XXXXXXX"
                    value={guarantorForm.phone}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">رقم الهوية الوطنية</label>
                  <input
                    type="text"
                    placeholder="IQ-XXXXXX"
                    value={guarantorForm.nationalId}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, nationalId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">دائرة الكفيل</label>
                  <input
                    type="text"
                    placeholder="اسم الدائرة / الوزارة"
                    value={guarantorForm.department}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, department: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">رقم كتاب الكفالة</label>
                  <input
                    type="text"
                    placeholder="رقم الكتاب الرسمي"
                    value={guarantorForm.letterNumber}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, letterNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">تاريخ الكتاب</label>
                  <input
                    type="date"
                    value={guarantorForm.letterDate}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, letterDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Duplicate Guarantor Modal Warning Banner */}
              <DuplicateWarningBanner
                matchResult={guarantorModalDuplicateMatches}
                entityLabel="كفيل"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddGuarantorOpen(false)}
                  disabled={isSubmittingGuarantor}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGuarantor}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold shadow-md flex items-center gap-2"
                >
                  {isSubmittingGuarantor ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>جاري الإضافة...</span>
                    </>
                  ) : (
                    <span>إضافة الكفيل</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL 3: Detailed Borrower Statement & Installment History */}
      {selectedBorrower && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-6 p-6 max-h-[90vh] overflow-y-auto relative cursor-default"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-white">{selectedBorrower.name}</h3>
                  {(() => {
                    const statusDisplay = getBorrowerStatusDisplay(selectedBorrower);
                    return (
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs border ${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-4">
                  <span>الهاتف: {maskText(selectedBorrower.phone)}</span>
                  <span>العنوان: {selectedBorrower.address}</span>
                  <span>الوظيفة: {selectedBorrower.jobTitle}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedBorrowerId(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] mb-0.5">إجمالي القروض الممنوحة:</span>
                <span className="font-bold text-white text-sm">{maskMoney(selectedBorrower.totalFinancedIQD, `bor-det-fin-${selectedBorrower.id}`, `ممنوح: ${selectedBorrower.name}`)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] mb-0.5">المبلغ المسدد فعلياً:</span>
                <span className="font-bold text-emerald-400 text-sm">{maskMoney(selectedBorrower.totalRepaidIQD, `bor-det-rep-${selectedBorrower.id}`, `مسدد: ${selectedBorrower.name}`)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] mb-0.5">الذمة المتبقية بالسجل:</span>
                <span className="font-bold text-purple-300 text-sm">{maskMoney(selectedBorrower.remainingDebtIQD, `bor-det-rem-${selectedBorrower.id}`, `متبقي: ${selectedBorrower.name}`)}</span>
              </div>
            </div>

            {/* Credit Score & Assessment Card */}
            {(() => {
              const credit = evaluateBorrowerCredit(selectedBorrower, store.contracts);
              const badge = getCreditTierBadge(credit.tier, credit.totalScore);

              return (
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-400" />
                      <h4 className="font-bold text-white text-sm">بطاقة قياس الجودة والائتمان</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badge.classes}`}>
                        {badge.label}
                      </span>
                      <span className="text-white font-bold text-sm bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                        {credit.totalScore} <span className="text-slate-400 text-xs">/ 100</span>
                      </span>
                    </div>
                  </div>

                  {credit.isBlacklisted && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{credit.blacklistReason || 'الزبون مدرج في القائمة السوداء.'}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                      <span className="text-slate-400 block text-[10px]">السقف الائتماني المقترح:</span>
                      <span className="font-bold text-emerald-400 text-xs">{formatIQD(credit.recommendedCreditLimitIQD)} د.ع</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                      <span className="text-slate-400 block text-[10px]">الرصيد الائتماني المتاح:</span>
                      <span className="font-bold text-cyan-300 text-xs">{formatIQD(credit.availableCreditLimitIQD)} د.ع</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                      <span className="text-slate-400 block text-[10px]">دقة الالتزام بالأقساط:</span>
                      <span className="font-bold text-white text-xs">{credit.breakdown.punctualityScore} / 40</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                      <span className="text-slate-400 block text-[10px]">نسبة عبء الدخل (DTI):</span>
                      <span className="font-bold text-white text-xs">{credit.breakdown.dtiScore} / 25</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Guarantors */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 flex items-center justify-between">
                <span>الكفلاء الضامنون لملف الزبون:</span>
                <button
                  onClick={() => {
                    setGuarantorTargetBorrowerId(selectedBorrower.id);
                    setIsAddGuarantorOpen(true);
                  }}
                  className="text-purple-400 hover:text-purple-300 text-[11px] flex items-center gap-1 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة كفيل
                </button>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedBorrower.guarantors.map((g, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex justify-between">
                    <div>
                      <p className="font-bold text-white">{g.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">هاتف: {maskText(g.phone)}</p>
                    </div>
                    {g.nationalId && (
                      <span className="text-[10px] text-slate-500 font-mono">هوية: {maskText(g.nationalId)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Installment Contracts & Schedules */}
            <div className="space-y-4 text-xs pt-2">
              <h4 className="font-bold text-white text-sm">جدول كشف الحساب واستحقاق الأقساط:</h4>

              {store.contracts
                .filter((c) => c.borrowerId === selectedBorrower.id)
                .map((c) => (
                  <div key={c.id} className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
                      <div>
                        <h5 className="font-bold text-purple-300 text-sm">{c.inventoryItemName}</h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          العقد: <span className="font-mono text-white">#{getContractNumber(c)}</span> | فاتورة رقم: <span className="font-mono text-emerald-400 font-bold">{getInvoiceNumber(c)}</span> | المستثمر:{' '}
                          <span className="text-emerald-400 font-semibold">{c.investorName}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedContractForHub(c)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/20 transition-all active:scale-95"
                          title="فتح مركز المستندات الموحد: فاتورة البيع الرسمية، عقد التقسيط، وجدول الأقساط"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>المستندات الرسمية (3 في 1)</span>
                        </button>

                        <div className="text-left">
                          <span className="font-bold text-white text-sm">{maskMoney(c.monthlyInstallmentIQD, `bor-det-inst-${c.id}`, `قسط: #${getContractNumber(c)}`)}</span>
                          <span className="text-[10px] text-slate-400 block">/ شهرياً</span>
                        </div>
                      </div>
                    </div>

                    {/* Schedules Table inside Modal */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                          <tr>
                            <th className="p-2.5">رقم القسط</th>
                            <th className="p-2.5">استحقاق</th>
                            <th className="p-2.5">المبلغ</th>
                            <th className="p-2.5">حصة المستثمر</th>
                            <th className="p-2.5">حصة الشركة</th>
                            <th className="p-2.5">الحالة</th>
                            <th className="p-2.5 text-center">الإجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {c.schedules.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-800/30">
                              <td className="p-2.5 font-bold text-white">قسط #{s.installmentNumber}</td>
                              <td className="p-2.5 font-mono text-slate-300">{s.dueDate}</td>
                              <td className="p-2.5 font-bold text-white">{maskMoney(s.amountIQD, `bor-det-sch-amt-${s.id}`, `قسط: ${s.dueDate}`)}</td>
                              <td className="p-2.5 text-emerald-400 font-bold">{maskMoney(s.investorProfitShareIQD, `bor-det-sch-inv-${s.id}`, `ربح المستثمر`)}</td>
                              <td className="p-2.5 text-purple-400 font-bold">{maskMoney(s.companyProfitShareIQD, `bor-det-sch-cmp-${s.id}`, `ربح الشركة`)}</td>
                              <td className="p-2.5">
                                {s.status === 'PAID' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                                    مسدد ({s.paidDate})
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold text-[10px] border border-amber-500/20">
                                    بانتظار السداد
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                {s.status === 'PAID' ? (
                                  <span className="text-slate-500 font-bold text-[10px]">مكتمل</span>
                                ) : (
                                <button
                                  onClick={() => handlePay(c.id, s.id)}
                                  disabled={payingScheduleId === s.id}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-[11px] shadow transition-all flex items-center gap-1.5 mx-auto"
                                >
                                  {payingScheduleId === s.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                                      <span>جاري السداد...</span>
                                    </>
                                  ) : (
                                    <span>تسديد القسط</span>
                                  )}
                                </button>
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

            <div className="flex items-center justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedBorrowerId(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Borrower Dialog */}
      {isEditBorrowerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 md:p-8 space-y-5 shadow-2xl relative overflow-hidden cursor-default"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-slate-800 pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">تعديل بيانات الزبون</h3>
                  <p className="text-xs text-slate-400">تحديث المعلومات الشخصية والوظيفية والسكنية للزبون</p>
                </div>
              </div>

              <button
                onClick={() => setIsEditBorrowerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditBorrowerSubmit} className="space-y-4 relative z-10 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">اسم الزبون الثلاثي *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">رقم الهاتف *</label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">المدينة / القضاء</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">العنوان السكني التفصيلي</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">الوظيفة / المهنة</label>
                  <input
                    type="text"
                    value={editForm.jobTitle}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">الدخل الشهري التقديري (د.ع)</label>
                  <input
                    type="number"
                    value={editForm.monthlyIncomeIQD}
                    onChange={(e) => setEditForm({ ...editForm, monthlyIncomeIQD: Number(e.target.value) })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">رقم الهوية / الموحدة</label>
                  <input
                    type="text"
                    value={editForm.nationalId}
                    onChange={(e) => setEditForm({ ...editForm, nationalId: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">اسم الزوجة (اختياري)</label>
                  <input
                    type="text"
                    value={editForm.wifeName}
                    onChange={(e) => setEditForm({ ...editForm, wifeName: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Users className="w-3.5 h-3.5" />
                    <span>من أحضر الزبون (المعرّف للمتابعة الودية)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">اختياري - موظف أو شخص خارجي</span>
                </label>
                <input
                  type="text"
                  list="introducers-suggestions-edit"
                  placeholder="اسم الشخص الذي أحضر الزبون (مثال: مروان، أسعد، خالد...)"
                  value={editForm.introducedBy}
                  onChange={(e) => setEditForm({ ...editForm, introducedBy: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-bold text-xs"
                />
                <datalist id="introducers-suggestions-edit">
                  {Array.from(new Set(store.borrowers.map((b) => b.introducedBy).filter(Boolean))).map((name) => (
                    <option key={name} value={name!} />
                  ))}
                </datalist>
              </div>

              {/* Duplicate Edit Borrower Warning Banner */}
              <DuplicateWarningBanner
                matchResult={editBorrowerDuplicateMatches}
                entityLabel="زبون"
              />

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditBorrowerOpen(false)}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/25 transition-all active:scale-95"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Issue Sales Invoice & Installment Contract Modal (Automatic Flow) */}
      {isIssueContractModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl cursor-default"
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base whitespace-nowrap">إصدار فاتورة بيع وعقد تقسيط مباشر</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-bold border border-blue-500/20 whitespace-nowrap">
                      خطوة فورية بعد التسجيل
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 whitespace-nowrap">
                    توليد وتوثيق فاتورة البيع الرسمية، عقد التقسيط القانوني، وجدول الدفعات دفعة واحدة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsIssueContractModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
                title="تخطي وإغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleIssueContractSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Contract Document Date */}
                <DocumentDateField
                  value={contractFormData.startDate}
                  onChange={(d) => setContractFormData({ ...contractFormData, startDate: d })}
                  label="تاريخ تحرير العقد / الفاتورة"
                  helpText="تاريخ بدء العقد وجدول الأقساط الشهرية (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
                />

                {/* Row: Borrower Select & Investor Select */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Borrower Select */}
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-semibold block flex items-center justify-between whitespace-nowrap">
                      <span className="whitespace-nowrap">1. الزبون الخاص بالعقد:</span>
                      {newContractBorrower?.guarantors?.[0] && (
                        <span className="text-[11px] text-slate-400 font-normal mr-2 whitespace-nowrap">
                          (الكفيل: {newContractBorrower.guarantors[0].name})
                        </span>
                      )}
                    </label>
                    <select
                      value={contractFormData.borrowerId}
                      onChange={(e) => {
                        const b = store.borrowers.find((item) => item.id === e.target.value);
                        if (b) setNewContractBorrower(b);
                        setContractFormData({ ...contractFormData, borrowerId: e.target.value });
                      }}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      {store.borrowers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.jobTitle || b.city || 'سامراء'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Investor Select */}
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-semibold block flex items-center justify-between whitespace-nowrap">
                      <span className="whitespace-nowrap">2. المستثمر الممول للشراء (صاحب الصندوق / الأصل):</span>
                      <span className="text-[11px] text-slate-400 font-normal mr-2 whitespace-nowrap">
                        (يتم عرض بضاعة المستثمر المختار فقط)
                      </span>
                    </label>
                    <select
                      value={contractFormData.selectedInvestorId}
                      onChange={(e) => handleInvestorSelect(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-bold focus:outline-none focus:border-blue-500"
                    >
                      <option value="COMPANY_MAIN">🏢 نظام أمان (صندوق أمان الرئيسي)</option>
                      {getCapitalInvestors(store.investors).map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          👤 {inv.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Credit Assessment Banner for Selected Borrower */}
                {(() => {
                  const targetBorrower = store.borrowers.find((b) => b.id === contractFormData.borrowerId) || newContractBorrower;
                  if (!targetBorrower) return null;
                  const credit = evaluateBorrowerCredit(targetBorrower, store.contracts);
                  const salePrice = Number(contractFormData.totalSalePriceIQD || 0);
                  const exceedsLimit = salePrice > credit.availableCreditLimitIQD;

                  if (credit.isBlacklisted) {
                    return (
                      <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-300 text-sm">
                              ⚠️ تحذير ائتماني حرج: الزبون مدرج في القائمة السوداء (Blacklist)
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              تصنيف {credit.tier} ({credit.totalScore} نقطة)
                            </span>
                          </div>
                          <p className="text-xs text-rose-200/90 mt-1 font-medium">
                            {credit.blacklistReason || 'سجل السداد حرج أو وجود أقساط متأخرة تجاوزت المدة المسموحة.'}
                          </p>
                          <div className="text-[11px] text-slate-400 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                            <span>السقف الموصى به: 0 د.ع</span>
                            <span>الديون النشطة الحالية: {formatIQD(credit.remainingDebtIQD)} د.ع</span>
                            <span className="text-rose-400 font-semibold">(تنبيه تحليلي لإدارة المخاطر - يرجى مراجعة الإدارة)</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (exceedsLimit && credit.availableCreditLimitIQD > 0) {
                    return (
                      <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300 text-sm">
                              تنبيه ائتماني: قيمة العقد تتجاوز السقف الائتماني المتاح
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              تصنيف {credit.tier} ({credit.totalScore} نقطة)
                            </span>
                          </div>
                          <p className="text-xs text-amber-200/80 mt-1">
                            مبلغ العقد ({formatIQD(salePrice)} د.ع) يتجاوز الرصيد المتاح لهذا الزبون ({formatIQD(credit.availableCreditLimitIQD)} د.ع).
                          </p>
                          <div className="text-[11px] text-slate-400 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                            <span>السقف الأقصى المعتمد: {formatIQD(credit.recommendedCreditLimitIQD)} د.ع</span>
                            <span>الديون النشطة: {formatIQD(credit.remainingDebtIQD)} د.ع</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-300 text-sm">مؤهل ائتمانياً للتعاقد</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              تصنيف {credit.tier} ({credit.totalScore}/100 نقطة)
                            </span>
                          </div>
                          <span className="text-xs text-emerald-400 font-bold">
                            الرصيد المتاح: {formatIQD(credit.availableCreditLimitIQD)} د.ع
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          <span>السقف الائتماني: {formatIQD(credit.recommendedCreditLimitIQD)} د.ع</span>
                          <span>الديون النشطة: {formatIQD(credit.remainingDebtIQD)} د.ع</span>
                          <span>دقة السداد: {credit.breakdown.punctualityScore}/40</span>
                          <span>نسبة عبء الدخل: {credit.breakdown.dtiScore}/25</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Inventory Item & Quantity Select (Strictly filtered to chosen Investor only) */}
                {(() => {
                  const selectedInventoryItem = store.inventory.find((i) => i.id === contractFormData.inventoryItemId);
                  const maxAvailableQty = selectedInventoryItem ? (selectedInventoryItem.quantity !== undefined ? selectedInventoryItem.quantity : 1) : 1;
                  const itemUnitCost = selectedInventoryItem?.unitCostIQD || 0;

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
                        {/* Item Select (Takes 3 cols on desktop) */}
                        <div className="md:col-span-3 space-y-1.5">
                          <label className="text-slate-300 font-semibold block flex items-center justify-between whitespace-nowrap">
                            <span className="whitespace-nowrap">3. المادة المتاحة بالمخزن (الأصل المبيع):</span>
                            <span className="text-[11px] text-slate-400 font-normal whitespace-nowrap">
                              (المتاح لهذا المستثمر: {availableInStockItems.length} مادة)
                            </span>
                          </label>
                          <select
                            value={contractFormData.inventoryItemId}
                            onChange={(e) => handleItemSelect(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-blue-500"
                          >
                            {availableInStockItems.length === 0 ? (
                              <option value="" disabled>
                                ⚠️ لا توجد مواد متاحة بالمخزن لهذا المستثمر (يرجى شراء بضاعة بالمخزن أو اختيار مستثمر آخر)
                              </option>
                            ) : (
                              availableInStockItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.category}) — المتاح: ({item.quantity !== undefined ? item.quantity : 1} قطعة)
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {/* Quantity Input (Takes 1 col on desktop) */}
                        <div className="md:col-span-1 space-y-1.5">
                          <label className="text-slate-300 font-semibold block flex items-center justify-between whitespace-nowrap">
                            <span className="whitespace-nowrap">الكمية (العدد):</span>
                            {selectedInventoryItem && (
                              <span className="text-[11px] text-cyan-400 font-normal whitespace-nowrap">
                                (المتاح: {maxAvailableQty})
                              </span>
                            )}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max={maxAvailableQty}
                              step="1"
                              value={contractFormData.quantity || 1}
                              onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10))}
                              className="w-full p-3 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-400 font-mono font-bold text-center text-base focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 4. Pricing & Profit Calculation Section */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3.5">
                        {/* Row 1: Locked Item Cost & Down Payment Input */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Item Base Cost (Read Only / Locked from Inventory) */}
                          <div className="space-y-1.5">
                            <label className="text-slate-300 font-semibold block flex items-center justify-between whitespace-nowrap">
                              <span className="flex items-center gap-1.5 text-amber-300">
                                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="whitespace-nowrap">سعر البضاعة الأصلي (التكلفة):</span>
                              </span>
                              {(contractFormData.quantity || 1) > 1 && (
                                <span className="text-[11px] text-amber-300/90 font-normal">
                                  ({contractFormData.quantity} قطع × {formatNumber(itemUnitCost)} د.ع)
                                </span>
                              )}
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                readOnly
                                disabled
                                value={`${formatNumber(contractFormData.itemCostPriceIQD)} د.ع`}
                                className="w-full p-3 pl-12 rounded-xl bg-slate-900/90 border border-amber-500/30 text-amber-400 font-mono font-bold text-sm cursor-not-allowed select-none focus:outline-none whitespace-nowrap"
                              />
                              <Lock className="w-4 h-4 text-amber-400/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>

                    {/* Down Payment Input (الدفعة المقدمة) */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block whitespace-nowrap">
                        <span className="flex items-center gap-1 text-blue-300">
                          <Wallet className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="whitespace-nowrap">الدفعة المقدمة المستلمة (د.ع):</span>
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max={contractFormData.itemCostPriceIQD}
                          step="any"
                          value={contractFormData.downPaymentIQD || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            const safeVal = isNaN(val) ? 0 : Math.max(0, val);
                            const pricing = calculatePricingFromProfitPercent(
                              contractFormData.itemCostPriceIQD,
                              contractFormData.profitMarginPercent,
                              safeVal
                            );
                            setContractFormData((prev) => ({ ...prev, ...pricing }));
                          }}
                          placeholder="0 د.ع (إن وجدت)"
                          className="w-full p-3 pl-12 rounded-xl bg-slate-900 border border-blue-500/40 text-blue-400 font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none whitespace-nowrap">
                          د.ع
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Net Remaining Cost & Profit Percentage Input */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Net Remaining Cost (سعر البضاعة - المقدمة) */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block flex items-center justify-between whitespace-nowrap">
                        <span className="text-slate-300 whitespace-nowrap">صافي التكلفة الخاضعة للربح:</span>
                        <span className="text-[10px] text-slate-400 font-normal whitespace-nowrap mr-2">(التكلفة - المقدمة)</span>
                      </label>
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400 font-mono whitespace-nowrap" dir="ltr">
                          {formatNumber(contractFormData.itemCostPriceIQD)} - {formatNumber(contractFormData.downPaymentIQD)}
                        </span>
                        <strong className="text-slate-200 font-mono font-bold text-sm whitespace-nowrap">
                          {formatNumber(contractFormData.itemCostPriceIQD - contractFormData.downPaymentIQD)} د.ع
                        </strong>
                      </div>
                    </div>

                    {/* Profit Percentage Input (Applied to Net Remainder) */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block flex items-center justify-between whitespace-nowrap">
                        <span className="flex items-center gap-1 text-emerald-300 whitespace-nowrap">
                          <Percent className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="whitespace-nowrap">نسبة الربح المضافة (%):</span>
                        </span>
                        <span className="text-xs text-emerald-400 font-mono font-bold whitespace-nowrap mr-2">
                          +{formatNumber(contractFormData.profitAmountIQD)} د.ع
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          step="any"
                          value={contractFormData.profitMarginPercent || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            const pricing = calculatePricingFromProfitPercent(
                              contractFormData.itemCostPriceIQD,
                              isNaN(val) ? 0 : val,
                              contractFormData.downPaymentIQD
                            );
                            setContractFormData((prev) => ({ ...prev, ...pricing }));
                          }}
                          placeholder="أدخل نسبة الربح (مثال: 30)"
                          className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-sm pointer-events-none whitespace-nowrap">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Extracted Total Contract Price Banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/70 via-indigo-950/70 to-slate-900 border border-blue-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm text-blue-300 font-bold whitespace-nowrap">
                          المبلغ المقسط (إجمالي الذمة بالأقساط):
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold whitespace-nowrap">
                          المتبقي + الربح
                        </span>
                      </div>
                      <span className="text-xs text-slate-300 font-mono block whitespace-nowrap">
                        (صافي التكلفة: {formatNumber(contractFormData.itemCostPriceIQD - contractFormData.downPaymentIQD)} د.ع + الربح: {formatNumber(contractFormData.profitAmountIQD)} د.ع)
                      </span>
                    </div>
                    <div className="text-right md:text-left shrink-0">
                      <div className="text-blue-400 font-mono text-xl font-black whitespace-nowrap">
                        {formatNumber(contractFormData.financedAmountIQD ?? (contractFormData.totalSalePriceIQD - contractFormData.downPaymentIQD))} د.ع
                      </div>
                      {contractFormData.downPaymentIQD > 0 && (
                        <span className="block text-xs text-emerald-400 font-mono font-bold whitespace-nowrap mt-0.5">
                          إجمالي البيع الكلي: {formatNumber(contractFormData.totalSalePriceIQD)} د.ع (مع المقدمة)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

                {/* Months Count & Quick Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-semibold block whitespace-nowrap">
                      <span>عدد أشهر التقسيط (مدة السداد بالشهور):</span>
                    </label>
                    <span className="text-xs text-blue-400 font-mono font-bold whitespace-nowrap">
                      {contractFormData.monthsCount > 0
                        ? `${contractFormData.monthsCount} شهر${
                            contractFormData.monthsCount >= 12
                              ? ` (${(contractFormData.monthsCount / 12).toFixed(1)} سنة)`
                              : ''
                          }`
                        : 'يرجى كتابة عدد الأشهر'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative w-full sm:w-44 shrink-0">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        step="1"
                        value={contractFormData.monthsCount || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                          setContractFormData({
                            ...contractFormData,
                            monthsCount: isNaN(val) ? 0 : val
                          });
                        }}
                        placeholder="عدد الأشهر"
                        className="w-full p-3 pl-14 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono font-bold text-base focus:outline-none focus:border-blue-500"
                      />
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none whitespace-nowrap">
                        شهر
                      </span>
                    </div>

                    {/* Quick Presets for Rapid Selection */}
                    <div className="flex items-center gap-2 flex-wrap flex-1 w-full">
                      <span className="text-xs text-slate-400 shrink-0 font-medium whitespace-nowrap">خيارات شائعة:</span>
                      {[6, 10, 12, 14, 18, 24, 36].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setContractFormData((prev) => ({ ...prev, monthsCount: m }))}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            contractFormData.monthsCount === m
                              ? 'bg-blue-500 text-slate-950 shadow-md shadow-blue-500/20 font-black scale-105'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {m} شهر
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="p-4.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
                    <div className="flex items-center justify-between text-slate-400 gap-2 border-b border-slate-900 pb-2 md:border-b-0 md:pb-0">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="whitespace-nowrap">سعر البضاعة الأصلي (التكلفة):</span>
                      </span>
                      <strong className="text-amber-400 font-mono text-xs whitespace-nowrap">{formatNumber(contractFormData.itemCostPriceIQD)} د.ع</strong>
                    </div>

                    {contractFormData.downPaymentIQD > 0 ? (
                      <div className="flex items-center justify-between text-slate-400 gap-2 border-b border-slate-900 pb-2 md:border-b-0 md:pb-0">
                        <span className="text-blue-400 flex items-center gap-1 whitespace-nowrap">
                          <Wallet className="w-3 h-3 text-blue-400 shrink-0" />
                          <span className="whitespace-nowrap">(-) الدفعة المقدمة المستلمة نقداً:</span>
                        </span>
                        <strong className="text-blue-400 font-mono text-xs whitespace-nowrap">-{formatNumber(contractFormData.downPaymentIQD)} د.ع</strong>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-slate-500 gap-2 border-b border-slate-900 pb-2 md:border-b-0 md:pb-0">
                        <span className="whitespace-nowrap">الدفعة المقدمة:</span>
                        <span className="font-mono text-xs text-slate-400 whitespace-nowrap">لا توجد دفعة مقدمة</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-slate-400 gap-2 border-b border-slate-900 pb-2 md:border-b-0 md:pb-0">
                      <span className="whitespace-nowrap">(=) صافي التكلفة المتبقية للخضوع للتقسيط:</span>
                      <strong className="text-slate-200 font-mono text-xs whitespace-nowrap">
                        {formatNumber(contractFormData.itemCostPriceIQD - contractFormData.downPaymentIQD)} د.ع
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 gap-2">
                      <span className="whitespace-nowrap">(+) مبلغ الربح المضاف ({contractFormData.profitMarginPercent}% على المتبقي):</span>
                      <strong className="text-emerald-400 font-mono text-xs whitespace-nowrap">+{formatNumber(contractFormData.profitAmountIQD)} د.ع</strong>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 whitespace-nowrap">
                      <span className="text-blue-300 font-bold text-xs whitespace-nowrap">المبلغ المطلوب سداده بالأقساط (إجمالي الذمة):</span>
                      <strong className="text-blue-400 font-mono text-base font-black whitespace-nowrap">
                        {formatNumber(contractFormData.financedAmountIQD ?? (contractFormData.totalSalePriceIQD - contractFormData.downPaymentIQD))} د.ع
                      </strong>
                    </div>

                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-slate-300 font-medium whitespace-nowrap">القسط الشهري المستحق:</span>
                      <strong className="text-emerald-400 font-mono text-base font-black whitespace-nowrap">
                        {formatNumber(monthlyInstallmentCalc)} د.ع / شهر
                      </strong>
                      {contractFormData.monthsCount > 0 && (
                        <span className="text-xs text-slate-400 font-normal whitespace-nowrap mr-1">
                          (على مدار {contractFormData.monthsCount} شهر)
                        </span>
                      )}
                    </div>
                  </div>

                  {contractFormData.downPaymentIQD > 0 && (
                    <div className="flex items-center justify-between text-slate-400 text-xs pt-2 border-t border-slate-900">
                      <span className="whitespace-nowrap">إجمالي سعر البيع الكلي (المقدمة + الأقساط):</span>
                      <span className="font-mono text-slate-200 font-bold whitespace-nowrap">{formatNumber(contractFormData.totalSalePriceIQD)} د.ع</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 px-6 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsIssueContractModalOpen(false)}
                  disabled={isSubmittingContract}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold transition-colors whitespace-nowrap"
                >
                  تخطي الآن
                </button>

                <button
                  type="submit"
                  disabled={availableInStockItems.length === 0 || isSubmittingContract}
                  className={`px-8 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    availableInStockItems.length > 0 && !isSubmittingContract
                      ? 'bg-blue-500 hover:bg-blue-400 text-slate-950 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmittingContract ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950 shrink-0" />
                      <span className="whitespace-nowrap">جاري إبرام وتوثيق العقد...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">تأكيد وإبرام عقد التقسيط</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Unified 3-in-1 Document Hub Modal */}
      {selectedContractForHub && (
        <ContractDocumentHubModal
          contract={selectedContractForHub}
          store={store}
          onClose={() => setSelectedContractForHub(null)}
          onPaySchedule={onPaySchedule}
        />
      )}

      {/* Security Confirmation Modal for deleting borrower */}
      <SecurityConfirmationModal
        isOpen={!!borrowerToDelete}
        onClose={() => setBorrowerToDelete(null)}
        onConfirm={handleConfirmDeleteBorrower}
        title="تأكيد إلغاء وتصفية ملف الزبون ونقله لسلة المهملات"
        subtitle="سيتم استرجاع البضاعة الممولة للمخزن بحساب الممول، وتصفير الديون، واسترداد رأس المال مع إلغاء الأرباح المتوقعة بأمان."
        itemName={borrowerToDelete?.name}
        actionType="TRASH"
        confirmButtonText="تأكيد الإلغاء ونقل لسلة المهملات"
        adminPasscode={adminPasscode}
      />

      {/* Debt Collector Field Report Modal */}
      <CollectorReportModal
        isOpen={isCollectorReportOpen}
        onClose={() => setIsCollectorReportOpen(false)}
        store={store}
        initialFilter={collectorReportFilter}
      />

      {/* Borrower Introducers (من أحضر الزبائن) Modal */}
      <BorrowerIntroducersModal
        isOpen={isIntroducersModalOpen}
        onClose={() => setIsIntroducersModalOpen(false)}
        store={store}
      />
    </div>
  );
};

