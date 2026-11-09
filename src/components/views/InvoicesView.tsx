'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Search,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  DollarSign,
  TrendingUp,
  Boxes,
  Calendar,
  ArrowRightLeft,
  Check,
  Printer,
  Receipt,
  Download,
  Table as TableIcon,
  FileSpreadsheet,
  Award,
  Barcode,
  Loader2,
  Lock,
  Percent,
  Scissors,
  Wallet,
  Sparkles,
  Layers,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Hash
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';
import { InstallmentContract, InstallmentScheduleItem, LedgerTransaction } from '@/types/finance';
import {
  ContractDocumentHubModal,
  getContractNumber,
  getInvoiceNumber,
  getReceiptNumber,
  getInvoiceTableItem
} from '@/components/common/ContractDocumentHubModal';
import { formatNumber, formatDate, toEnglishDigits, formatIQD } from '@/utils/formatters';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { usePrivacy } from '@/context/PrivacyContext';
import {
  calculateInstallmentDueStatus,
  isContractCompleted,
  getPersistedInvoicesViewMode,
  persistInvoicesViewMode
} from '@/utils/installmentDates';
import { evaluateBorrowerCredit } from '@/utils/creditScore';
import { getCapitalInvestors } from '@/utils/investorSelectors';

interface InvoicesViewProps {
  store: SimulationStore;
  onCreateContract?: (data: {
    borrowerId: string;
    inventoryItemId: string;
    totalSalePriceIQD: number;
    downPaymentIQD: number;
    monthsCount: number;
    startDate?: string;
    quantity?: number;
  }) => any;
  onPaySchedule?: (contractId: string, scheduleId: string, customPaidAmountIQD?: number, paidDate?: string) => any;
}

type ViewTab = 'CONTRACTS' | 'INVOICES_LOG';
type StatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE';
type TxTypeFilter = 'ALL' | 'PURCHASE_INVENTORY' | 'PAYMENT_RECEIVED' | 'DEPOSIT';
type SortOrder = 'LATEST' | 'DUE_DATE' | 'REMAINING_HIGH' | 'TOTAL_HIGH';

// Helper Tafqeet Function (Arabic Numbers-to-Words)
function tafqeetIQD(n: number): string {
  if (n === 0) return 'صفر فقط لاغيرها';
  
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  let words = '';

  if (n >= 1000000) {
    const millions = Math.floor(n / 1000000);
    n %= 1000000;
    if (millions === 1) words += 'مليون ';
    else if (millions === 2) words += 'مليونان ';
    else words += tafqeetIQD(millions).replace('دينار فقط لاغيرها', '') + 'مليون ';
  }

  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    n %= 1000;
    if (thousands === 1) words += 'ألف ';
    else if (thousands === 2) words += 'ألفان ';
    else if (thousands >= 3 && thousands <= 10) words += ones[thousands] + ' آلاف ';
    else words += convertHundreds(thousands) + ' ألف ';
  }

  if (n > 0) {
    if (words.length > 0) words += 'و';
    words += convertHundreds(n);
  }

  return words.trim() + ' دينار فقط لاغيرها';

  function convertHundreds(num: number): string {
    let str = '';
    const h = Math.floor(num / 100);
    const remainder = num % 100;
    if (h > 0) {
      str += hundreds[h] + ' ';
    }
    if (remainder > 0) {
      if (h > 0) str += 'و';
      if (remainder < 20) {
        str += ones[remainder];
      } else {
        const t = Math.floor(remainder / 10);
        const o = remainder % 10;
        if (o > 0) {
          str += ones[o] + ' و' + tens[t];
        } else {
          str += tens[t];
        }
      }
    }
    return str.trim();
  }
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({ store, onCreateContract, onPaySchedule }) => {
  const profile = store.companyProfile || DEFAULT_COMPANY_REPORT_PROFILE;
  const { lockAll, unlockedItemIds, isPrivacyActive } = usePrivacy();
  const capitalInvestors = getCapitalInvestors(store.investors);
  // Main View Switcher
  const [activeTab, setActiveTab] = useState<ViewTab>('CONTRACTS');

  // View Mode: Cards vs Accounting Table
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => getPersistedInvoicesViewMode());
  const [sortBy, setSortBy] = useState<SortOrder>('LATEST');

  useEffect(() => {
    const saved = getPersistedInvoicesViewMode();
    if (saved !== viewMode) {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    persistInvoicesViewMode(mode);
  };

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
  const [filterInvestorId, setFilterInvestorId] = useState<string>('ALL');
  const [filterTxType, setFilterTxType] = useState<TxTypeFilter>('ALL');

  // Modals state
  const [selectedContractForHub, setSelectedContractForHub] = useState<InstallmentContract | null>(null);
  const [selectedContractForSchedules, setSelectedContractForSchedules] = useState<InstallmentContract | null>(null);
  const [selectedContractForInvoice, setSelectedContractForInvoice] = useState<InstallmentContract | null>(null);
  const [selectedContractForOfficialLandscape, setSelectedContractForOfficialLandscape] = useState<InstallmentContract | null>(null);
  const [selectedScheduleForReceipt, setSelectedScheduleForReceipt] = useState<{
    contract: InstallmentContract;
    schedule: InstallmentScheduleItem;
  } | null>(null);
  const [payingTarget, setPayingTarget] = useState<{
    contract: InstallmentContract;
    schedule: InstallmentScheduleItem;
  } | null>(null);
  const [paymentInputAmount, setPaymentInputAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiptPrintMode, setReceiptPrintMode] = useState<'DUAL' | 'CUSTOMER' | 'ADMIN'>('DUAL');

  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);
  const [isSubmittingContract, setIsSubmittingContract] = useState(false);
  const [payingScheduleId, setPayingScheduleId] = useState<string | null>(null);

  // Manual Numbering Reset State
  const [isNumberingModalOpen, setIsNumberingModalOpen] = useState(false);
  const [numberingPasscode, setNumberingPasscode] = useState('');
  const [showNumberingPasscode, setShowNumberingPasscode] = useState(false);
  const [isNumberingLoading, setIsNumberingLoading] = useState(false);
  const [numberingMsg, setNumberingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleConfirmResetNumbering = async () => {
    const cleanPass = numberingPasscode.trim();
    if (!cleanPass) {
      setNumberingMsg({ type: 'error', text: 'يرجى إدخال رمز أمان الإدارة للمتابعة' });
      return;
    }
    const adminPass = store.adminPasscode || '2026';
    if (cleanPass !== adminPass) {
      setNumberingMsg({ type: 'error', text: 'رمز أمان الإدارة غير صحيح. يرجى إدخال الرمز الإداري المعتمد' });
      return;
    }

    setIsNumberingLoading(true);
    setNumberingMsg(null);

    try {
      const res = await fetch('/api/settings/reset-numbering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPasscode: cleanPass })
      });
      const data = await res.json();
      if (data.success) {
        store.numberingResetEpoch = data.numberingResetEpoch || new Date().toISOString();
        if (typeof window !== 'undefined') {
          try {
            const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
            cache.numberingResetEpoch = store.numberingResetEpoch;
            localStorage.setItem('aman_finance_live_cache', JSON.stringify(cache));
          } catch {}
        }
        setNumberingMsg({ type: 'success', text: data.message });
        setNumberingPasscode('');
        showNotification(data.message, 'success');
        setTimeout(() => {
          setIsNumberingModalOpen(false);
          setNumberingMsg(null);
          window.location.reload();
        }, 1500);
      } else {
        setNumberingMsg({ type: 'error', text: data.message || 'تعذر تصفير دورة الترقيم' });
      }
    } catch (err: any) {
      setNumberingMsg({ type: 'error', text: 'حدث خطأ في الاتصال: ' + (err?.message || 'خطأ غير معروف') });
    } finally {
      setIsNumberingLoading(false);
    }
  };

  // Close any active modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (payingTarget) {
          setPayingTarget(null);
        } else if (selectedScheduleForReceipt) {
          setSelectedScheduleForReceipt(null);
        } else if (selectedContractForHub) {
          setSelectedContractForHub(null);
        } else if (selectedContractForInvoice) {
          setSelectedContractForInvoice(null);
        } else if (selectedContractForOfficialLandscape) {
          setSelectedContractForOfficialLandscape(null);
        } else if (selectedContractForSchedules) {
          setSelectedContractForSchedules(null);
        } else if (isNewContractModalOpen) {
          setIsNewContractModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    payingTarget,
    selectedScheduleForReceipt,
    selectedContractForHub,
    selectedContractForInvoice,
    selectedContractForOfficialLandscape,
    selectedContractForSchedules,
    isNewContractModalOpen
  ]);

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

  // New Contract Form State
  const [contractFormData, setContractFormData] = useState(() => {
    const initialItem = store.inventory.find((i) => (i.quantity === undefined || i.quantity > 0) && i.status !== 'FULLY_FINANCED') || store.inventory[0];
    const cost = initialItem?.unitCostIQD || 0;
    let initialProfitPercent = 30;
    if (initialItem && initialItem.unitCostIQD > 0 && initialItem.targetSellingPriceIQD > initialItem.unitCostIQD) {
      initialProfitPercent = Number((((initialItem.targetSellingPriceIQD - initialItem.unitCostIQD) / initialItem.unitCostIQD) * 100).toFixed(1));
    }
    const pricing = calculatePricingFromProfitPercent(cost, initialProfitPercent, 0);
    return {
      borrowerId: store.borrowers[0]?.id || '',
      selectedInvestorId: initialItem?.investorId || 'COMPANY_MAIN',
      inventoryItemId: initialItem?.id || '',
      quantity: 1,
      ...pricing,
      monthsCount: 14,
      startDate: new Date().toISOString().split('T')[0]
    };
  });

  // Toast Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Currency Formatter with Privacy toggle
  const formatCurrency = (amount: number) => {
    if (isPrivacyActive) return '••••••••';
    return `${formatNumber(amount)} د.ع`;
  };

  // Filtered Contracts
  const filteredContracts = store.contracts.filter((c) => {
    const invNo = getInvoiceNumber(c);
    const borrower = store.borrowers.find((b) => b.id === c.borrowerId);
    const cleanSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !cleanSearch ||
      c.contractNumber.toLowerCase().includes(cleanSearch) ||
      getContractNumber(c).toLowerCase().includes(cleanSearch) ||
      invNo.toLowerCase().includes(cleanSearch) ||
      c.borrowerName.toLowerCase().includes(cleanSearch) ||
      c.investorName.toLowerCase().includes(cleanSearch) ||
      c.inventoryItemName.toLowerCase().includes(cleanSearch) ||
      (borrower?.phone && borrower.phone.includes(cleanSearch)) ||
      (borrower?.city && borrower.city.toLowerCase().includes(cleanSearch));

    const isCompleted = isContractCompleted(c);
    let matchesStatus = true;
    if (filterStatus === 'ACTIVE') {
      matchesStatus = !isCompleted;
    } else if (filterStatus === 'COMPLETED') {
      matchesStatus = isCompleted;
    } else if (filterStatus === 'OVERDUE') {
      matchesStatus =
        !isCompleted &&
        c.schedules.some(
          (s) => s.status === 'PENDING' && calculateInstallmentDueStatus(s.dueDate, false).status === 'OVERDUE'
        );
    }

    const matchesInvestor = filterInvestorId === 'ALL' || c.investorId === filterInvestorId;

    return matchesSearch && matchesStatus && matchesInvestor;
  });

  // Sorted Contracts
  const sortedContracts = [...filteredContracts].sort((a, b) => {
    if (sortBy === 'LATEST') {
      return (b.startDate || '').localeCompare(a.startDate || '') || b.id.localeCompare(a.id);
    }
    if (sortBy === 'DUE_DATE') {
      const nextA = a.schedules.find((s) => s.status === 'PENDING')?.dueDate || '9999-99-99';
      const nextB = b.schedules.find((s) => s.status === 'PENDING')?.dueDate || '9999-99-99';
      return nextA.localeCompare(nextB);
    }
    if (sortBy === 'REMAINING_HIGH') {
      const paidA =
        a.schedules.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountIQD, 0) + a.downPaymentIQD;
      const remA = a.totalSalePriceIQD - paidA;
      const paidB =
        b.schedules.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountIQD, 0) + b.downPaymentIQD;
      const remB = b.totalSalePriceIQD - paidB;
      return remB - remA;
    }
    if (sortBy === 'TOTAL_HIGH') {
      return b.totalSalePriceIQD - a.totalSalePriceIQD;
    }
    return 0;
  });

  // Filtered Transactions Log
  const filteredTransactions = store.transactions.filter((tx) => {
    const matchesSearch =
      (tx.referenceNo && tx.referenceNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.investorName && tx.investorName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterTxType === 'ALL' || tx.type === filterTxType;
    return matchesSearch && matchesType;
  });

  // Overview KPI Computations
  const totalContractsCount = store.contracts.length;
  const completedContractsCount = store.contracts.filter(isContractCompleted).length;
  const activeContractsCount = store.contracts.filter((c) => !isContractCompleted(c)).length;
  const overdueContractsCount = store.contracts.filter((c) =>
    !isContractCompleted(c) &&
    c.schedules.some((s) => s.status === 'PENDING' && calculateInstallmentDueStatus(s.dueDate, false).status === 'OVERDUE')
  ).length;

  const totalFinancedValuationAll = store.contracts.reduce((sum, c) => sum + c.totalSalePriceIQD, 0);

  const totalRepaidAll = store.contracts.reduce((sum, c) => {
    const paidSum = c.schedules
      .filter((s) => s.status === 'PAID')
      .reduce((sSum, s) => sSum + s.amountIQD, 0);
    return sum + c.downPaymentIQD + paidSum;
  }, 0);

  const totalRemainingDebtAll = totalFinancedValuationAll - totalRepaidAll;
  const overallCollectionPercent =
    totalFinancedValuationAll > 0
      ? Number(((totalRepaidAll / totalFinancedValuationAll) * 100).toFixed(1))
      : 0;

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

  // Available IN_STOCK items strictly filtered by the currently selected investor
  const availableInStockItems = React.useMemo(() => {
    return getItemsForInvestor(contractFormData.selectedInvestorId);
  }, [store.inventory, store.investors, store.companyWallet, contractFormData.selectedInvestorId]);

  // Investor selection handler: strictly sets matching items of that investor and updates non-editable cost & pricing
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

  // Auto price selection when item changes: pulls non-editable base price and re-derives profit and total
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

  // Quantity change handler: recalculates item cost and pricing according to requested quantity
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

  // Helper to open the New Contract Modal with the best initial investor that owns items
  const handleOpenNewContractModal = () => {
    let defaultInvestorId = store.investors[0]?.id || 'COMPANY_MAIN';

    // Find first investor or company with available stock
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
      borrowerId: store.borrowers[0]?.id || '',
      selectedInvestorId: defaultInvestorId,
      inventoryItemId: firstMatching ? firstMatching.id : '',
      quantity: 1,
      startDate: new Date().toISOString().split('T')[0],
      ...pricing,
      monthsCount: 14
    });
    setIsNewContractModalOpen(true);
  };

  // Calculations for New Contract: Monthly installment divides the remaining financed debt by months count
  const financedAmountCalc = Math.max(
    0,
    contractFormData.financedAmountIQD ??
      (contractFormData.totalSalePriceIQD - (contractFormData.downPaymentIQD || 0))
  );
  const monthlyInstallmentCalc =
    contractFormData.monthsCount > 0 ? Math.round(financedAmountCalc / contractFormData.monthsCount) : 0;

  // Submit New Contract
  const handleContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingContract) return;
    if (!contractFormData.borrowerId) {
      showNotification('يرجى اختيار الزبون الخاص بالعقد', 'error');
      return;
    }
    if (!contractFormData.inventoryItemId) {
      showNotification('يرجى اختيار المادة المتاحة بالمخزن', 'error');
      return;
    }
    if (contractFormData.downPaymentIQD > contractFormData.itemCostPriceIQD) {
      showNotification('الدفعة المقدمة لا يمكن أن تتجاوز سعر تكلفة البضاعة الأصلي', 'error');
      return;
    }
    if (contractFormData.totalSalePriceIQD <= 0) {
      showNotification('يرجى إدخال سعر بيع بالتقسيط صحيح', 'error');
      return;
    }
    if (contractFormData.monthsCount <= 0) {
      showNotification('يرجى تحديد عدد أشهر التقسيط (شهر واحد على الأقل)', 'error');
      return;
    }

    const contractQty = Math.max(1, contractFormData.quantity || 1);
    const selectedItem = store.inventory.find((i) => i.id === contractFormData.inventoryItemId);
    const availableQty = selectedItem ? (selectedItem.quantity !== undefined ? selectedItem.quantity : 1) : 0;
    if (availableQty < contractQty) {
      showNotification(`الكمية المطلوبة (${contractQty}) غير متوفرة بالمخزن. المتوفر حالياً: (${availableQty}) قطعة`, 'error');
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

      if (result.success) {
        showNotification(result.message, 'success');
        setIsNewContractModalOpen(false);
      } else {
        showNotification(result.message, 'error');
      }
    } finally {
      setIsSubmittingContract(false);
    }
  };

  // Pay schedule inside Full Schedules Modal
  const handlePayScheduleAction = async (contractId: string, scheduleId: string, customPaidAmountIQD?: number, paidDate?: string) => {
    if (payingScheduleId === scheduleId) return;
    setPayingScheduleId(scheduleId);
    try {
      let isSuccess = false;
      let activeContract: InstallmentContract | undefined;

      if (onPaySchedule) {
        await onPaySchedule(contractId, scheduleId, customPaidAmountIQD, paidDate);
        showNotification('تم سداد القسط بنجاح وتحديث الجدول والترحيل المالي', 'success');
        isSuccess = true;

        activeContract = store.contracts.find((c) => c.id === contractId);
        if (activeContract && selectedContractForSchedules) {
          setSelectedContractForSchedules({ ...activeContract });
        }
      } else {
        const res = store.payInstallmentSchedule(contractId, scheduleId, customPaidAmountIQD, paidDate);
        if (res.success) {
          showNotification(res.message, 'success');
          isSuccess = true;
          activeContract = store.contracts.find((c) => c.id === contractId);
          if (activeContract && selectedContractForSchedules) {
            setSelectedContractForSchedules({ ...activeContract });
          }
        } else {
          showNotification(res.message, 'error');
        }
      }

      // Automatically display the official payment receipt for printing (Customer + Admin copy)
      if (isSuccess) {
        const finalContract = activeContract || store.contracts.find((c) => c.id === contractId) || selectedContractForSchedules;
        if (finalContract) {
          const paidSchedule = finalContract.schedules.find((s) => s.id === scheduleId);
          if (paidSchedule) {
            setSelectedScheduleForReceipt({
              contract: { ...finalContract },
              schedule: { ...paidSchedule }
            });
          }
        }
      }
    } finally {
      setPayingScheduleId(null);
    }
  };

  // Export Sales Invoice to CSV
  const exportInvoiceCSV = (c: InstallmentContract) => {
    const borrower = store.borrowers.find((b) => b.id === c.borrowerId);
    const invoiceNo = getInvoiceNumber(c);
    const invoiceItem = getInvoiceTableItem(c);

    let csvContent = '\uFEFF';
    csvContent += `نظام أمان للتقسيط - فاتورة بيع رسمية\n`;
    csvContent += `رقم الفاتورة,${invoiceNo}\n`;
    csvContent += `نوع الفاتورة,اقساط\n`;
    csvContent += `التاريخ,${c.startDate}\n`;
    csvContent += `اسم العميل,${c.borrowerName}\n`;
    csvContent += `العنوان,${borrower?.city || 'سامراء'}\n\n`;

    csvContent += `ت,اسم المادة,العدد,الوحدة,سعر الوحدة,الاجمالي\n`;
    csvContent += `${invoiceItem.index},${invoiceItem.itemName},${invoiceItem.quantity},${invoiceItem.unit},${invoiceItem.unitPriceIQD},${invoiceItem.totalPriceIQD}\n\n`;

    csvContent += `إجمالي المبلغ,${invoiceItem.totalPriceIQD}\n`;
    csvContent += `إجمالي الخصم,0\n`;
    csvContent += `المبلغ الصافي,${invoiceItem.totalPriceIQD}\n`;
    csvContent += `التفقيط,${tafqeetIQD(invoiceItem.totalPriceIQD)}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `فاتورة_بيع_${invoiceNo}_${c.borrowerName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('تم تصدير فاتورة البيع بصيغة CSV بنجاح', 'success');
  };

  // Export Sales Invoice to XLSX
  const exportInvoiceXLSX = (c: InstallmentContract) => {
    const borrower = store.borrowers.find((b) => b.id === c.borrowerId);
    const invoiceNo = getInvoiceNumber(c);
    const invoiceItem = getInvoiceTableItem(c);

    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>فاتورة بيع</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; text-align: right; }
          th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
          th { background-color: #333; color: #fff; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <h2>نظام أمان للتقسيط</h2>
        <h3>فاتورة بيع رقم: ${invoiceNo}</h3>
        <table>
          <tr><th>اسم العميل</th><td>${c.borrowerName}</td><th>نوع الفاتورة</th><td>اقساط</td></tr>
          <tr><th>العنوان</th><td>${borrower?.city || 'سامراء'}</td><th>التاريخ</th><td>${c.startDate}</td></tr>
        </table>
        <br/>
        <table>
          <thead>
            <tr>
              <th>ت</th>
              <th>اسم المادة</th>
              <th>العدد</th>
              <th>الوحدة</th>
              <th>سعر الوحدة</th>
              <th>الاجمالي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoiceItem.index}</td>
              <td>${invoiceItem.itemName}</td>
              <td>${invoiceItem.quantity}</td>
              <td>${invoiceItem.unit}</td>
              <td>${formatNumber(invoiceItem.unitPriceIQD)}</td>
              <td>${formatNumber(invoiceItem.totalPriceIQD)}</td>
            </tr>
          </tbody>
        </table>
        <br/>
        <table>
          <tr><th>المبلغ الإجمالي</th><td>${formatNumber(invoiceItem.totalPriceIQD)} د.ع</td></tr>
          <tr><th>إجمالي الخصم</th><td>0 د.ع</td></tr>
          <tr><th>المبلغ الصافي</th><td>${formatNumber(invoiceItem.totalPriceIQD)} د.ع</td></tr>
          <tr><th>التفقيط</th><td>${tafqeetIQD(invoiceItem.totalPriceIQD)}</td></tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `فاتورة_بيع_${invoiceNo}_${c.borrowerName}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('تم تصدير فاتورة البيع بصيغة Excel (XLSX) بنجاح', 'success');
  };

  // Export Receipt to CSV
  const exportReceiptCSV = (c: InstallmentContract, sch: InstallmentScheduleItem) => {
    const invoiceNo = getInvoiceNumber(c);
    const receiptNo = getReceiptNumber(sch, c, store);
    let csvContent = '\uFEFF';
    csvContent += `نظام أمان للتقسيط - وصل تسديد قسط\n`;
    csvContent += `رقم الوصل,${receiptNo}\n`;
    csvContent += `التاريخ,${sch.paidDate || new Date().toISOString().split('T')[0]}\n`;
    csvContent += `استلمت من,${c.borrowerName}\n`;
    csvContent += `مبلغ قدره (د.ع),${sch.amountIQD}\n`;
    csvContent += `المبلغ بالكلمات,${tafqeetIQD(sch.amountIQD)}\n`;
    csvContent += `وذلك عن,تسديد قسط من حساب الفاتورة رقم (${invoiceNo}) / القسط رقم ${sch.installmentNumber}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `وصل_سداد_قسط_فاتورة_${invoiceNo}_قسط_${sch.installmentNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('تم تصدير وصل السداد صيغة CSV بنجاح', 'success');
  };

  // Export Receipt to XLSX
  const exportReceiptXLSX = (c: InstallmentContract, sch: InstallmentScheduleItem) => {
    const invoiceNo = getInvoiceNumber(c);
    const receiptNo = getReceiptNumber(sch, c, store);
    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>وصل تسديد قسط</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; text-align: right; }
          th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>نظام أمان للتقسيط - وصل تسديد قسط</h2>
        <table>
          <tr><th>رقم الوصل</th><td>${receiptNo}</td><th>التاريخ</th><td>${sch.paidDate || new Date().toISOString().split('T')[0]}</td></tr>
          <tr><th>استلمت من</th><td colspan="3">${c.borrowerName}</td></tr>
          <tr><th>مبلغ قدره (د.ع)</th><td>${formatNumber(sch.amountIQD)} د.ع</td><th>بالكلمات</th><td>${tafqeetIQD(sch.amountIQD)}</td></tr>
          <tr><th>وذلك عن</th><td colspan="3">تسديد قسط من حساب الفاتورة رقم (${invoiceNo}) / القسط رقم ${sch.installmentNumber}</td></tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `وصل_سداد_قسط_فاتورة_${invoiceNo}_قسط_${sch.installmentNumber}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('تم تصدير وصل السداد صيغة Excel (XLSX) بنجاح', 'success');
  };

  // Export to CSV Function
  const exportToCSV = (contract: InstallmentContract) => {
    const borrower = store.borrowers.find((b) => b.id === contract.borrowerId);
    const totalPaid = contract.schedules.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountIQD, 0) + contract.downPaymentIQD;
    const totalRemaining = contract.totalSalePriceIQD - totalPaid;

    let csvContent = '\uFEFF';
    csvContent += `نظام أمان للتقسيط - جدول الأقساط الرسمية\n`;
    csvContent += `رقم العقد,${getContractNumber(contract)}\n`;
    csvContent += `اسم العميل,${contract.borrowerName}\n`;
    csvContent += `العنوان,${borrower?.city || 'سامراء'}\n`;
    csvContent += `الهاتف,${borrower?.phone || 'غير مدخل'}\n`;
    csvContent += `اسم المنتج,بضاعة ${contract.inventoryItemName}\n`;
    csvContent += `إجمالي المبلغ,${contract.totalSalePriceIQD}\n`;
    csvContent += `المقدمة,${contract.downPaymentIQD}\n`;
    csvContent += `إجمالي المسدد,${totalPaid}\n`;
    csvContent += `إجمالي المتبقي,${totalRemaining}\n\n`;

    csvContent += `ت,العملة,تاريخ الاستحقاق,مبلغ القسط,مبلغ إضافي,مبلغ الخصم,المسدد,المتبقي,تاريخ التسديد,الدفعة\n`;

    contract.schedules.forEach((sch) => {
      const isPaid = sch.status === 'PAID';
      const paidAmt = isPaid ? sch.amountIQD : 0;
      const remAmt = isPaid ? 0 : sch.amountIQD;
      csvContent += `${sch.installmentNumber},دينار,${sch.dueDate},${sch.amountIQD},0,0,${paidAmt},${remAmt},${sch.paidDate || ''},${sch.installmentNumber}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `جدول_أقساط_${getContractNumber(contract)}_${contract.borrowerName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('تم تصدير ملف CSV بنجاح', 'success');
  };

  // Export to XLSX Function
  const exportToXLSX = (contract: InstallmentContract) => {
    const borrower = store.borrowers.find((b) => b.id === contract.borrowerId);
    const totalPaid = contract.schedules.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountIQD, 0) + contract.downPaymentIQD;
    const totalRemaining = contract.totalSalePriceIQD - totalPaid;

    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>جدول الأقساط</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; text-align: center; }
          th, td { border: 1px solid #000; padding: 6px; font-size: 11px; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .header-box { text-align: center; font-size: 16px; font-weight: bold; padding: 10px; border: 2px solid #000; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div className="header-box">نظام أمان للتقسيط - جدول الأقساط</div>
        <table>
          <tr>
            <th>اسم العميل</th><td>${contract.borrowerName}</td>
            <th>العنوان</th><td>${borrower?.city || 'سامراء'}</td>
            <th>الهاتف</th><td>${borrower?.phone || 'غير مدخل'}</td>
          </tr>
          <tr>
            <th>رقم العقد</th><td>${getContractNumber(contract)}</td>
            <th>اسم المنتج</th><td>بضاعة ${contract.inventoryItemName}</td>
            <th>إجمالي المبلغ</th><td>${formatNumber(contract.totalSalePriceIQD)} دينار</td>
          </tr>
          <tr>
            <th>إجمالي المسدد</th><td>${formatNumber(totalPaid)} دينار</td>
            <th>إجمالي المتبقي</th><td>${formatNumber(totalRemaining)} دينار</td>
            <th>عدد الأشهر</th><td>${contract.monthsCount} شهر</td>
          </tr>
        </table>
        <br/>
        <table>
          <thead>
            <tr>
              <th>ت</th>
              <th>العملة</th>
              <th>تاريخ الاستحقاق</th>
              <th>مبلغ القسط</th>
              <th>مبلغ إضافي</th>
              <th>مبلغ الخصم</th>
              <th>المسدد</th>
              <th>المتبقي</th>
              <th>تاريخ التسديد</th>
              <th>الدفعة</th>
            </tr>
          </thead>
          <tbody>
            ${contract.schedules
              .map((sch) => {
                const isPaid = sch.status === 'PAID';
                const paidAmt = isPaid ? formatNumber(sch.amountIQD) : '0';
                const remAmt = isPaid ? '0' : formatNumber(sch.amountIQD);
                return `
                <tr>
                  <td>${sch.installmentNumber}</td>
                  <td>دينار</td>
                  <td>${sch.dueDate}</td>
                  <td>${formatNumber(sch.amountIQD)}</td>
                  <td>0</td>
                  <td>0</td>
                  <td>${paidAmt}</td>
                  <td>${remAmt}</td>
                  <td>${sch.paidDate || ''}</td>
                  <td>${sch.installmentNumber}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `جدول_أقساط_${getContractNumber(contract)}_${contract.borrowerName}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('تم تصدير ملف Excel (XLSX) بنجاح', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Print CSS Injection for A4 Portrait & Landscape Printing */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            direction: rtl !important;
            font-family: Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide non-printable UI elements */
          nav, header, sidebar, footer, button, input, select, .no-print {
            display: none !important;
          }
          .print-a4-portrait-container {
            display: block !important;
            width: 100% !important;
            max-width: 200mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-a4-landscape-container {
            display: block !important;
            width: 100% !important;
            max-width: 285mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-a5-landscape-container {
            display: block !important;
            width: 100% !important;
            max-width: 200mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .scissors-cut-divider {
            display: flex !important;
          }
          .a5-voucher-box {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md transition-all animate-bounce ${
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

      {/* Main Screen Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">سجل الفواتير وعقود التقسيط</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          {/* Manual Numbering Reset Action Button */}
          <button
            type="button"
            onClick={() => {
              setNumberingPasscode('');
              setNumberingMsg(null);
              setIsNumberingModalOpen(true);
            }}
            title="تصفير دورة الترقيم لبدء أرقام العقود والفواتير والوصولات القادمة من رقم 1"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-amber-500/20 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">تصفير دورة الترقيم</span>
          </button>

          {/* Reusable Privacy Toggle Button */}
          <PrivacyToggleButton />

          {/* New Contract Button */}
          <button
            onClick={handleOpenNewContractModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-blue-500/10 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء عقد تقسيط جديد</span>
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contracts Count */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-300">إجمالي عقود التقسيط</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-2xl font-black text-white tracking-tight">
              {totalContractsCount} <span className="text-xs font-normal text-slate-400">عقد</span>
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span className="text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                {activeContractsCount} نشط
              </span>
              <span className="text-slate-400 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                {completedContractsCount} مكتمل
              </span>
            </div>
          </div>
        </div>

        {/* Total Financed Value */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-300">إجمالي قيم البيع بالتقسيط</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-indigo-400 tracking-tight">
              <PrivacyMaskedAmount id="inv-top-total-financed" value={totalFinancedValuationAll} label="إجمالي قيم البيع بالتقسيط" size="lg" />
            </div>
          </div>
        </div>

        {/* Total Repaid Value */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-300">إجمالي الأقساط المحصلة</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              <PrivacyMaskedAmount id="inv-top-total-repaid" value={totalRepaidAll} label="إجمالي الأقساط المحصلة" size="lg" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
              {overallCollectionPercent}% محصّل
            </span>
          </div>
        </div>

        {/* Total Remaining Debt */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-pink-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-300">إجمالي الذمم المتبقية</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-2xl font-black text-purple-400 tracking-tight">
              <PrivacyMaskedAmount id="inv-top-total-remaining" value={totalRemainingDebtAll} label="إجمالي الذمم المتبقية" size="lg" />
            </div>
            {overdueContractsCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
                ⚠️ {overdueContractsCount} متعثر
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-4">
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('CONTRACTS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
              activeTab === 'CONTRACTS'
                ? 'bg-blue-500 text-slate-950 shadow-md shadow-blue-500/10 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>عقود التقسيط المبرمة ({store.contracts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('INVOICES_LOG')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
              activeTab === 'INVOICES_LOG'
                ? 'bg-blue-500 text-slate-950 shadow-md shadow-blue-500/10 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>سجل الفواتير والمعاملات المالية ({store.transactions.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CONTRACTS VIEW */}
      {activeTab === 'CONTRACTS' && (
        <div className="space-y-4">
          {/* Smart Search, Filter, Sort & View Control Bar */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة، رقم العقد، اسم الزبون، الهاتف، المادة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                    title="مسح البحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters & Actions Group */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Status Filter */}
                <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 font-semibold">الحالة:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="ALL" className="bg-slate-950 text-white">جميع العقود ({store.contracts.length})</option>
                    <option value="ACTIVE" className="bg-slate-950 text-white">عقود نشطة ({activeContractsCount})</option>
                    <option value="COMPLETED" className="bg-slate-950 text-white">عقود مكتملة ({completedContractsCount})</option>
                    <option value="OVERDUE" className="bg-slate-950 text-white">متأخرة في السداد ({overdueContractsCount})</option>
                  </select>
                </div>

                {/* Investor Filter */}
                <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-400 font-semibold">المستثمر:</span>
                  <select
                    value={filterInvestorId}
                    onChange={(e) => setFilterInvestorId(e.target.value)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-1 max-w-[150px] truncate"
                  >
                    <option value="ALL" className="bg-slate-950 text-white">جميع المستثمرين</option>
                    {capitalInvestors.map((inv) => (
                      <option key={inv.id} value={inv.id} className="bg-slate-950 text-white">
                        {inv.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-slate-400 font-semibold">الترتيب:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOrder)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="LATEST" className="bg-slate-950 text-white">الأحدث تاريخاً</option>
                    <option value="DUE_DATE" className="bg-slate-950 text-white">الأقرب استحقاقاً للقسط</option>
                    <option value="REMAINING_HIGH" className="bg-slate-950 text-white">الأعلى متبقي ذمة</option>
                    <option value="TOTAL_HIGH" className="bg-slate-950 text-white">الأعلى قيمة عقد</option>
                  </select>
                </div>

                {/* View Mode Switcher Toggle */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    onClick={() => handleViewModeChange('cards')}
                    title="عرض البطاقات المطوّرة"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'cards'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">بطاقات</span>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('table')}
                    title="عرض الجدول المحاسبي الشامل"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'table'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">جدول</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Filter Info & Reset Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
              <div className="flex items-center gap-2">
                <span>
                  يتم عرض <strong className="text-white font-bold">{sortedContracts.length}</strong> من أصل <strong className="text-white font-bold">{store.contracts.length}</strong> عقد
                </span>
                {(searchTerm || filterStatus !== 'ALL' || filterInvestorId !== 'ALL' || sortBy !== 'LATEST') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setFilterStatus('ALL');
                      setFilterInvestorId('ALL');
                      setSortBy('LATEST');
                    }}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold px-2 py-0.5 rounded-md hover:bg-blue-500/10 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة ضبط الفلاتر</span>
                  </button>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>مكتمل</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  <span>نشط قيد السداد</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  <span>متأخر</span>
                </span>
              </div>
            </div>
          </div>

          {/* Contracts View: CARDS MODE */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {sortedContracts.map((c) => {
                const investor = store.investors.find((i) => i.id === c.investorId);
                const borrower = store.borrowers.find((b) => b.id === c.borrowerId);
                const paidSchedulesCount = c.schedules.filter((s) => s.status === 'PAID').length;
                const progressPercent = c.monthsCount > 0 ? Math.round((paidSchedulesCount / c.monthsCount) * 100) : 0;
                const nextPendingSchedule = c.schedules.find((s) => s.status === 'PENDING');
                const isCompleted = isContractCompleted(c);

                const totalPaid = c.schedules.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountIQD, 0) + c.downPaymentIQD;
                const totalRemaining = Math.max(0, c.totalSalePriceIQD - totalPaid);

                const nextDue = nextPendingSchedule
                  ? calculateInstallmentDueStatus(nextPendingSchedule.dueDate, false)
                  : null;
                const isOverdue = !isCompleted && nextDue?.status === 'OVERDUE';

                return (
                  <div
                    key={c.id}
                    className="bg-slate-900 rounded-2xl p-5 border border-slate-800 hover:border-slate-700 space-y-4 shadow-xl transition-all relative overflow-hidden flex flex-col justify-between group"
                  >
                    {/* Top Status Accent Line */}
                    <div
                      className={`absolute top-0 right-0 left-0 h-1.5 ${
                        isCompleted
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : isOverdue
                          ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                          : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500'
                      }`}
                    />

                    {/* Zone 1: Card Header (Badges + Investor Chip) */}
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 font-mono shadow-sm">
                          فاتورة: #{getInvoiceNumber(c)}
                        </span>
                        <span className="text-xs font-bold text-blue-400 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 font-mono">
                          عقد: #{getContractNumber(c)}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            isCompleted
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : isOverdue
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'
                              : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          {isCompleted ? 'مكتمل المسداد' : isOverdue ? '⚠️ متأخر في السداد' : 'نشط قيد السداد'}
                        </span>
                      </div>

                      {/* Investor Chip */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-400">المستثمر:</span>
                        <span className="font-bold text-emerald-300">
                          <PrivacyMaskedText id={`inv-c-investor-${c.id}`} value={c.investorName} label={`المستثمر: ${c.investorName}`} size="xs" />
                        </span>
                        {investor && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({investor.contract.investorSharePercent}% / {investor.contract.companySharePercent}%)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Zone 2: Customer & Goods Info */}
                    <div className="flex items-center justify-between gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-white truncate">
                            <PrivacyMaskedText id={`inv-c-borrower-${c.id}`} value={c.borrowerName} label={`الزبون: ${c.borrowerName}`} />
                          </h2>
                          <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            {borrower?.phone && <span className="font-mono text-slate-300">{borrower.phone}</span>}
                            <span>•</span>
                            <span>{borrower?.city || 'سامراء'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="text-xs font-bold text-slate-200 block">
                          بضاعة {c.inventoryItemName}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          البدء: <strong className="text-slate-300 font-mono">{c.startDate}</strong> ({c.monthsCount} شهر)
                        </span>
                      </div>
                    </div>

                    {/* Zone 3: Financial Summary 4-tile Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                      <div className="space-y-0.5">
                        <span className="text-slate-400 block text-[10px]">إجمالي البيع:</span>
                        <div className="font-bold text-white">
                          <PrivacyMaskedAmount id={`inv-sale-${c.id}`} value={c.totalSalePriceIQD} label={`إجمالي بيع: #${getContractNumber(c)}`} size="xs" />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-emerald-400/90 block text-[10px]">المسدد (مقدمة+أقساط):</span>
                        <div className="font-bold text-emerald-400">
                          <PrivacyMaskedAmount id={`inv-paid-${c.id}`} value={totalPaid} label={`مسدد: #${getContractNumber(c)}`} size="xs" />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-purple-300 block text-[10px]">المتبقي بذمة العميل:</span>
                        <div className="font-bold text-purple-400">
                          <PrivacyMaskedAmount id={`inv-rem-${c.id}`} value={totalRemaining} label={`متبقي: #${getContractNumber(c)}`} size="xs" />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-blue-300 block text-[10px]">القسط الشهري:</span>
                        <div className="font-bold text-blue-400">
                          <PrivacyMaskedAmount id={`inv-inst-${c.id}`} value={c.monthlyInstallmentIQD} label={`قسط شهري: #${getContractNumber(c)}`} size="xs" />
                        </div>
                      </div>
                    </div>

                    {/* Zone 4: Progress Bar & Next Due Alert */}
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                          <span>نسبة السداد:</span>
                          <strong className="text-emerald-400 font-mono">
                            {paidSchedulesCount} من {c.monthsCount} قسط مسدد ({progressPercent}%)
                          </strong>
                        </span>

                        {isCompleted ? (
                          <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>مكتمل بالكامل</span>
                          </span>
                        ) : nextPendingSchedule && nextDue ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[11px]">
                              القسط القادم: <strong className="text-amber-400 font-mono">{nextPendingSchedule.dueDate}</strong>
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${nextDue.badgeClassName}`}>
                              {nextDue.status === 'OVERDUE' && '⚠️ '}
                              {nextDue.status === 'DUE_TODAY' && '🔔 '}
                              {nextDue.status === 'UPCOMING' && '⏳ '}
                              {nextDue.label}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Progress Bar Container */}
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-sm"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Zone 5: Action Toolbar (Organized & Consolidated) */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Interactive Schedules & Repayment Modal */}
                        <button
                          onClick={() => setSelectedContractForSchedules(c)}
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                          title="عرض جدول الأقساط وتسجيل سداد الأقساط"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          <span>جدول الأقساط والسداد</span>
                        </button>

                        {/* 3-in-1 Document Hub Modal */}
                        <button
                          onClick={() => setSelectedContractForHub(c)}
                          className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-indigo-500/30 shadow-sm"
                          title="فتح مركز الوثائق الموحد: الفاتورة، العقد، وجدول الأقساط"
                        >
                          <Layers className="w-4 h-4 text-indigo-400" />
                          <span>مركز الوثائق (3 في 1)</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Printable Official Sales Invoice Button */}
                        <button
                          onClick={() => setSelectedContractForInvoice(c)}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-400 border border-slate-700/80 transition-all flex items-center gap-1 text-xs"
                          title="طباعة فاتورة البيع الرسمية (A4 Portrait)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">فاتورة A4</span>
                        </button>

                        {/* Printable Official Landscape A4 Schedule Button */}
                        <button
                          onClick={() => setSelectedContractForOfficialLandscape(c)}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-400 border border-slate-700/80 transition-all flex items-center gap-1 text-xs"
                          title="طباعة جدول الأقساط (A4 Landscape)"
                        >
                          <TableIcon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">جدول بالعرض</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Contracts View: TABLE MODE */}
          {viewMode === 'table' && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5 whitespace-nowrap">رقم الفاتورة / العقد</th>
                      <th className="p-3.5 whitespace-nowrap">الزبون</th>
                      <th className="p-3.5 whitespace-nowrap">المادة المبيعة</th>
                      <th className="p-3.5 whitespace-nowrap">المستثمر الممول</th>
                      <th className="p-3.5 whitespace-nowrap text-left">إجمالي البيع</th>
                      <th className="p-3.5 whitespace-nowrap text-left">المسدد</th>
                      <th className="p-3.5 whitespace-nowrap text-left">المتبقي</th>
                      <th className="p-3.5 whitespace-nowrap text-left">القسط</th>
                      <th className="p-3.5 whitespace-nowrap">القسط القادم والاستحقاق</th>
                      <th className="p-3.5 whitespace-nowrap">نسبة السداد</th>
                      <th className="p-3.5 whitespace-nowrap text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sortedContracts.map((c) => {
                      const borrower = store.borrowers.find((b) => b.id === c.borrowerId);
                      const paidSchedulesCount = c.schedules.filter((s) => s.status === 'PAID').length;
                      const progressPercent = c.monthsCount > 0 ? Math.round((paidSchedulesCount / c.monthsCount) * 100) : 0;
                      const nextPendingSchedule = c.schedules.find((s) => s.status === 'PENDING');
                      const isCompleted = isContractCompleted(c);

                      const totalPaid = c.schedules.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountIQD, 0) + c.downPaymentIQD;
                      const totalRemaining = Math.max(0, c.totalSalePriceIQD - totalPaid);

                      const nextDue = nextPendingSchedule
                        ? calculateInstallmentDueStatus(nextPendingSchedule.dueDate, false)
                        : null;

                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px]">
                                #{getInvoiceNumber(c)}
                              </span>
                              <span className="font-mono text-slate-400 text-[11px]">
                                #{getContractNumber(c)}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-bold text-white">
                              <PrivacyMaskedText id={`inv-t-borrower-${c.id}`} value={c.borrowerName} />
                            </div>
                            {borrower?.phone && (
                              <span className="text-[10px] text-slate-500 font-mono block">
                                {borrower.phone}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-medium text-slate-200 block">
                              {c.inventoryItemName}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {c.monthsCount} شهر • {c.startDate}
                            </span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-emerald-400 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <PrivacyMaskedText id={`inv-t-investor-${c.id}`} value={c.investorName} size="xs" />
                            </div>
                          </td>
                          <td className="p-3.5 whitespace-nowrap text-left font-mono font-bold text-white">
                            <PrivacyMaskedAmount id={`inv-t-sale-${c.id}`} value={c.totalSalePriceIQD} size="xs" />
                          </td>
                          <td className="p-3.5 whitespace-nowrap text-left font-mono font-bold text-emerald-400">
                            <PrivacyMaskedAmount id={`inv-t-paid-${c.id}`} value={totalPaid} size="xs" />
                          </td>
                          <td className="p-3.5 whitespace-nowrap text-left font-mono font-bold text-purple-400">
                            <PrivacyMaskedAmount id={`inv-t-rem-${c.id}`} value={totalRemaining} size="xs" />
                          </td>
                          <td className="p-3.5 whitespace-nowrap text-left font-mono font-bold text-blue-400">
                            <PrivacyMaskedAmount id={`inv-t-inst-${c.id}`} value={c.monthlyInstallmentIQD} size="xs" />
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {isCompleted ? (
                              <span className="text-emerald-400 font-bold text-[11px]">
                                مكتمل بالكامل
                              </span>
                            ) : nextPendingSchedule && nextDue ? (
                              <div className="space-y-1">
                                <span className="font-mono text-amber-400 text-[11px] block">
                                  {nextPendingSchedule.dueDate}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${nextDue.badgeClassName}`}>
                                  {nextDue.label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="w-28 space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-slate-400">{paidSchedulesCount}/{c.monthsCount}</span>
                                <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedContractForSchedules(c)}
                                className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors"
                                title="جدول الأقساط والسداد"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSelectedContractForHub(c)}
                                className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 transition-colors"
                                title="مركز الوثائق (3 في 1)"
                              >
                                <Layers className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSelectedContractForInvoice(c)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
                                title="طباعة فاتورة البيع A4"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSelectedContractForOfficialLandscape(c)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors"
                                title="طباعة جدول الأقساط بالعرض"
                              >
                                <TableIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty Search / Filter State */}
          {sortedContracts.length === 0 && (
            <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800 space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto border border-slate-700">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">لم يتم العثور على أي عقد تقسيط يطابق التصفية والبحث</h3>
                <p className="text-slate-400 text-xs mt-1">جرب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية المعينة</p>
              </div>
              {(searchTerm || filterStatus !== 'ALL' || filterInvestorId !== 'ALL' || sortBy !== 'LATEST') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('ALL');
                    setFilterInvestorId('ALL');
                    setSortBy('LATEST');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-md shadow-blue-600/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط الفلاتر والبحث</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVOICES & TRANSACTIONS LOG VIEW */}
      {activeTab === 'INVOICES_LOG' && (
        <div className="space-y-5">
          {/* Filters for Invoices Log */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث برقم المرجع، الوصف، اسم الطرف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-slate-400 font-semibold whitespace-nowrap">نوع العملية:</span>
              <select
                value={filterTxType}
                onChange={(e) => setFilterTxType(e.target.value as TxTypeFilter)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">جميع المعاملات والفواتير</option>
                <option value="PURCHASE_INVENTORY">شراء مواد ومخزن</option>
                <option value="PAYMENT_RECEIVED">سداد وتحصيل أقساط</option>
                <option value="DEPOSIT">إيداع رأس مال</option>
              </select>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">رقم المرجع / الفاتورة</th>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">نوع المعاملة</th>
                    <th className="p-4">من (الطرف المرسل)</th>
                    <th className="p-4">إلى (الطرف المستلم)</th>
                    <th className="p-4">المبلغ (IQD)</th>
                    <th className="p-4">البيان والتفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-blue-400">
                        {tx.referenceNo || tx.id}
                      </td>
                      <td className="p-4 font-mono text-slate-400">{tx.date}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            tx.type === 'PURCHASE_INVENTORY'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : tx.type === 'PAYMENT_RECEIVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {tx.type === 'PURCHASE_INVENTORY'
                            ? 'شراء أصل/مادة'
                            : tx.type === 'PAYMENT_RECEIVED'
                            ? 'تحصيل قسط تقسيط'
                            : 'إيداع رأس مال'}
                        </span>
                      </td>
                      <td className="p-4 text-white font-medium">{tx.fromWalletName}</td>
                      <td className="p-4 text-emerald-400 font-medium">{tx.toWalletName}</td>
                      <td className="p-4 font-bold font-mono text-white">
                        <PrivacyMaskedAmount id={`inv-tx-${tx.id}`} value={tx.amountIQD} label={`معاملة: ${tx.description}`} size="xs" />
                      </td>
                      <td className="p-4 text-slate-400 max-w-xs truncate">{tx.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                لا توجد فواتير أو معاملات تجارية تطابق التصفية
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Official Printable Sales Invoice Modal (Pixel-perfect replica of attached sales invoice image) */}
      {selectedContractForInvoice && (() => {
        const c = selectedContractForInvoice;
        const item = store.inventory.find((i) => i.id === c.inventoryItemId);
        const borrower = store.borrowers.find((b) => b.id === c.borrowerId);
        const invoiceNo = getInvoiceNumber(c);
        const invoiceItem = getInvoiceTableItem(c);

        return (
          <div
            className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl cursor-default"
            >
              {/* Modal Top Control Bar */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">فاتورة بيع رسمية (A4 Portrait - 210mm × 297mm)</h3>
                    <p className="text-xs text-slate-400">مطابقة للنموذج المرفق مع التفقيط والباركود والعبارة القانونية</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Print / PDF Button */}
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/10"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة / PDF (A4 العمودي)</span>
                  </button>

                  {/* XLSX Export Button */}
                  <button
                    onClick={() => exportInvoiceXLSX(c)}
                    className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/10"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تصدير Excel (XLSX)</span>
                  </button>

                  {/* CSV Export Button */}
                  <button
                    onClick={() => exportInvoiceCSV(c)}
                    className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/10"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير CSV</span>
                  </button>

                  <button
                    onClick={() => setSelectedContractForInvoice(null)}
                    className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors mr-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Sales Invoice Body (Exact organized replica of sales invoice) */}
              <div className="flex-1 overflow-y-auto p-8 bg-white text-black font-sans print-a4-portrait-container">
                <div className="w-full max-w-[190mm] mx-auto border-2 border-black rounded-xl p-6 space-y-6 text-[12px] leading-tight text-black bg-white shadow-sm">
                  
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between border-b-2 border-black pb-4">
                    {/* Right Company Info */}
                    <div className="text-right space-y-1">
                      <h2 className="text-xl font-black text-black tracking-tight">{profile.companyName}</h2>
                      <p className="text-xs text-gray-800 font-bold">{profile.companyActivity}</p>
                      <p className="text-xs text-gray-700">{profile.companyAddress}</p>
                      {profile.companyPhone && (
                        <p className="text-xs text-black font-mono font-extrabold tracking-wider">{profile.companyPhone}</p>
                      )}
                    </div>

                    {/* Left Brand Logo Box */}
                    <div className="text-left flex flex-col items-end">
                      <div className="w-14 h-14 bg-black text-white font-black rounded-xl flex items-center justify-center text-3xl shadow-md border-2 border-black">
                        أ
                      </div>
                      <span className="text-xs font-black tracking-widest text-black mt-1.5 uppercase">أمان للتقسيط</span>
                    </div>
                  </div>

                  {/* Customer Info & Invoice Details Box */}
                  <div className="bg-gray-50 border border-black rounded-xl p-4 flex items-start justify-between text-xs">
                    {/* Right Customer Info */}
                    <div className="space-y-1.5 text-right">
                      <p className="font-bold text-black"><span className="font-black text-gray-700">اسم العميل :</span> <strong className="text-sm font-black text-black">{c.borrowerName}</strong></p>
                      <p className="font-bold text-black"><span className="font-black text-gray-700">العنوان :</span> <span className="font-bold">{borrower?.city || 'سامراء'}</span></p>
                    </div>

                    {/* Left Invoice Ref & Type */}
                    <div className="space-y-1.5 text-right border-r border-gray-300 pr-6">
                      <h1 className="text-base font-black text-black tracking-wide font-sans">فاتورة رقم: <span className="font-mono">{invoiceNo}</span></h1>
                      <p className="font-bold text-black text-xs font-sans"><span className="font-black text-gray-700">نوع الفاتورة :</span> <span className="font-extrabold">اقساط</span></p>
                      <p className="font-bold text-black text-xs font-sans"><span className="font-black text-gray-700">التاريخ :</span> <span className="font-mono font-bold">{c.startDate}</span></p>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div>
                    <table className="w-full text-center border-collapse border-2 border-black text-xs">
                      <thead>
                        <tr className="bg-black text-white font-black border-b-2 border-black">
                          <th className="border border-black py-2.5 px-2 w-10">ت</th>
                          <th className="border border-black py-2.5 px-2 text-right">اسم المادة</th>
                          <th className="border border-black py-2.5 px-2 w-16">العدد</th>
                          <th className="border border-black py-2.5 px-2 w-20">الوحدة</th>
                          <th className="border border-black py-2.5 px-2 w-36">سعر الوحدة</th>
                          <th className="border border-black py-2.5 px-2 w-36">الاجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b-2 border-black font-bold">
                          <td className="border border-black py-3 px-2 font-mono">{invoiceItem.index}</td>
                          <td className="border border-black py-3 px-2 font-extrabold text-right pr-4">{invoiceItem.itemName}</td>
                          <td className="border border-black py-3 px-2 font-mono">{invoiceItem.quantity}</td>
                          <td className="border border-black py-3 px-2">{invoiceItem.unit}</td>
                          <td className="border border-black py-3 px-2 font-mono font-black">{formatNumber(invoiceItem.unitPriceIQD)}</td>
                          <td className="border border-black py-3 px-2 font-mono font-black">{formatNumber(invoiceItem.totalPriceIQD)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Calculations & Customer Balances Block */}
                  <div className="grid grid-cols-2 gap-4 pt-1 text-xs font-bold">
                    {/* Right Side: Customer Balances & Tafqeet */}
                    <div className="border border-black rounded-xl p-3.5 space-y-2 bg-gray-50/70 text-right">
                      <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                        <span className="text-gray-700">رصيد العميل السابق :</span>
                        <span className="font-mono text-sm font-black">0</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                        <span className="text-gray-700">المبلغ الواصل :</span>
                        <div className="flex items-center gap-3 font-mono text-sm font-black">
                          <span>$ 0</span>
                          <span>|</span>
                          <span>دينار 0</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-black font-extrabold">رصيد العميل الحالي :</span>
                        <span className="font-mono text-base font-black">{formatNumber(c.totalSalePriceIQD)}</span>
                      </div>

                      {/* Tafqeet Box */}
                      <div className="border-t-2 border-black pt-2 text-xs font-black text-black bg-white p-2 rounded border border-gray-300 text-center">
                        {tafqeetIQD(c.totalSalePriceIQD)}
                      </div>
                    </div>

                    {/* Left Side: Net Financial Totals */}
                    <div className="border border-black rounded-xl p-3.5 space-y-2.5 bg-gray-50/70 text-left">
                      <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                        <span className="text-gray-700 font-bold">دينار المبلغ الاجمالي :</span>
                        <span className="font-mono text-sm font-black">{formatNumber(c.totalSalePriceIQD)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                        <span className="text-gray-700 font-bold">اجمالي الخصم :</span>
                        <span className="font-mono text-sm font-black">0</span>
                      </div>
                      
                      <div className="border-t-2 border-black pt-2 flex items-center justify-between text-base font-black bg-white p-2 rounded border border-gray-300">
                        <span>المبلغ الصافي :</span>
                        <span className="font-mono">{formatNumber(c.totalSalePriceIQD)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Footer Block */}
                  <div className="pt-12 border-t border-gray-400 grid grid-cols-3 gap-4 items-end text-[11px] font-bold">
                    {/* Right: Notes & Items count */}
                    <div className="space-y-1 text-right">
                      <p><span className="text-gray-700">الملاحظات :</span> عقد بيع بالتقسيط</p>
                      <p><span className="text-gray-700">عدد المنتجات :</span> 1</p>
                      <p className="text-[10px] text-gray-600 font-mono mt-2">{new Date().toLocaleDateString('en-CA')} 6:01 PM</p>
                    </div>

                    {/* Center: Receipt Creator & Representative */}
                    <div className="space-y-1 text-center border-x border-gray-200 px-2">
                      <p><span className="text-gray-700">منظم الوصل :</span> <strong className="font-black">الحسابات</strong></p>
                      <p><span className="text-gray-700">المندوب :</span> ...</p>
                      <p className="text-[10px] text-gray-600 font-mono mt-2">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} 6:06 PM</p>
                    </div>

                    {/* Left: Barcode Graphic & Legal Disclaimer */}
                    <div className="space-y-1.5 text-left flex flex-col items-end">
                      {/* Barcode representation */}
                      <div className="font-mono text-center border-b-2 border-black pb-1 px-3">
                        <div className="tracking-[4px] font-black text-xl">|||| ||||| || ||| ||||</div>
                        <span className="text-[10px] font-black block mt-0.5 font-sans">رقم الفاتورة: <span className="font-mono">{invoiceNo}</span></span>
                      </div>
                      <p className="text-xs font-black text-black mt-1">الخطأ والسهو مرجوع للطرفين</p>
                      <p className="text-[10px] text-gray-500 font-mono">صفحة 1 من 1</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Official Printable Landscape A4 Schedule Modal */}
      {selectedContractForOfficialLandscape && (() => {
        const c = selectedContractForOfficialLandscape;
        const borrower = store.borrowers.find((b) => b.id === c.borrowerId);
        const guarantor = borrower?.guarantors?.[0]?.name || 'عبد الله عباس شاكر';
        const totalPaid = c.schedules.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountIQD, 0) + c.downPaymentIQD;
        const totalRemaining = c.totalSalePriceIQD - totalPaid;

        return (
          <div
            className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl cursor-default"
            >
              {/* Modal Top Control Bar */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <TableIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">جدول الأقساط الرسمي (A4 Landscape - 297mm × 210mm)</h3>
                    <p className="text-xs text-slate-400">مطابق للنموذج المرفق مع ترويسة نظام أمان للتقسيط</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Export PDF / Print Button */}
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/10"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة / PDF (A4 العرضي)</span>
                  </button>

                  {/* Export XLSX Button */}
                  <button
                    onClick={() => exportToXLSX(c)}
                    className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/10"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تصدير Excel (XLSX)</span>
                  </button>

                  {/* Export CSV Button */}
                  <button
                    onClick={() => exportToCSV(c)}
                    className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/10"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير CSV</span>
                  </button>

                  <button
                    onClick={() => setSelectedContractForOfficialLandscape(null)}
                    className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors mr-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Official Document Body */}
              <div className="flex-1 overflow-y-auto p-8 bg-white text-black font-sans print-a4-landscape-container">
                <div className="w-full max-w-[280mm] mx-auto space-y-4 text-[12px] leading-tight text-black">
                  
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between border-b-2 border-black pb-3">
                    {/* Right Company Info */}
                    <div className="text-right space-y-1">
                      <h2 className="text-xl font-extrabold text-black">{profile.companyName}</h2>
                      <p className="text-xs text-black font-semibold">{profile.companyAddress}</p>
                      {profile.companyPhone && (
                        <p className="text-xs text-black font-mono font-bold">{profile.companyPhone}</p>
                      )}
                    </div>

                    {/* Center Title Box */}
                    <div className="border-2 border-black px-8 py-2 text-center rounded-lg shadow-sm">
                      <h1 className="text-2xl font-black tracking-wide text-black">جدول الأقساط</h1>
                    </div>

                    {/* Left Contract Ref Badge */}
                    <div className="text-left font-mono text-xs">
                      <p className="font-bold">رقم العقد: {getContractNumber(c)}</p>
                      <p className="text-[11px] text-gray-700 mt-1">تاريخ الإصدار: {c.startDate}</p>
                    </div>
                  </div>

                  {/* Metadata Rows */}
                  <div className="border border-black p-3 rounded space-y-2 bg-gray-50/50">
                    <div className="grid grid-cols-3 gap-4">
                      <div><strong className="font-bold">اسم العميل:</strong> {c.borrowerName}</div>
                      <div><strong className="font-bold">العنوان:</strong> {borrower?.city || 'سامراء'}</div>
                      <div><strong className="font-bold">الهاتف:</strong> {borrower?.phone || '07701234567'}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 border-t border-gray-300 pt-2">
                      <div><strong className="font-bold">اسم الكفيل:</strong> {guarantor}</div>
                      <div><strong className="font-bold">الملاحظات:</strong> عقد بيع بالتقسيط المباشر</div>
                      <div><strong className="font-bold">التأخير:</strong> 0 يوم</div>
                    </div>
                  </div>

                  {/* Product Details Table */}
                  <div>
                    <h3 className="font-extrabold text-sm mb-1">تفاصيل القائمة</h3>
                    <table className="w-full text-center border-collapse border border-black text-xs">
                      <thead>
                        <tr className="bg-gray-200 border-b border-black font-bold">
                          <th className="border border-black p-1.5 w-12">ت</th>
                          <th className="border border-black p-1.5">اسم المنتج</th>
                          <th className="border border-black p-1.5 w-20">العدد</th>
                          <th className="border border-black p-1.5 w-24">الوحدة</th>
                          <th className="border border-black p-1.5 w-44">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black p-1.5">1</td>
                          <td className="border border-black p-1.5 font-bold text-right pr-3">بضاعة {c.inventoryItemName}</td>
                          <td className="border border-black p-1.5 font-mono">1</td>
                          <td className="border border-black p-1.5">قطعة</td>
                          <td className="border border-black p-1.5 font-mono font-bold">{formatNumber(c.totalSalePriceIQD)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Summary Bar */}
                  <div className="grid grid-cols-4 gap-2 text-center font-bold text-xs">
                    <div className="border border-black p-2 bg-gray-100">
                      <span className="block text-[10px] text-gray-700">إجمالي المبلغ</span>
                      <span className="text-sm font-mono">{formatNumber(c.totalSalePriceIQD)}</span>
                    </div>
                    <div className="border border-black p-2 bg-gray-100">
                      <span className="block text-[10px] text-gray-700">إجمالي الخصم</span>
                      <span className="text-sm font-mono">0</span>
                    </div>
                    <div className="border border-black p-2 bg-gray-100">
                      <span className="block text-[10px] text-gray-700">إجمالي المسدد</span>
                      <span className="text-sm font-mono">{formatNumber(totalPaid)}</span>
                    </div>
                    <div className="border border-black p-2 bg-gray-100">
                      <span className="block text-[10px] text-gray-700">إجمالي المتبقي</span>
                      <span className="text-sm font-mono text-red-700">{formatNumber(totalRemaining)}</span>
                    </div>
                  </div>

                  {/* Main Installment Table */}
                  <div>
                    <table className="w-full text-center border-collapse border-2 border-black text-[11px]">
                      <thead>
                        <tr className="bg-gray-200 border-b-2 border-black font-extrabold">
                          <th className="border border-black p-1.5 w-10">ت</th>
                          <th className="border border-black p-1.5 w-16">العملة</th>
                          <th className="border border-black p-1.5 w-28">تاريخ الاستحقاق</th>
                          <th className="border border-black p-1.5 w-28">مبلغ القسط</th>
                          <th className="border border-black p-1.5 w-24">مبلغ إضافي</th>
                          <th className="border border-black p-1.5 w-24">مبلغ الخصم</th>
                          <th className="border border-black p-1.5 w-24">المسدد</th>
                          <th className="border border-black p-1.5 w-28">المتبقي</th>
                          <th className="border border-black p-1.5 w-28">تاريخ التسديد</th>
                          <th className="border border-black p-1.5 w-16">الدفعة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.schedules.map((sch) => {
                          const isPaid = sch.status === 'PAID';
                          const paidAmt = isPaid ? formatNumber(sch.amountIQD) : '0';
                          const remAmt = isPaid ? '0' : formatNumber(sch.amountIQD);

                          return (
                            <tr key={sch.id} className="border-b border-black hover:bg-gray-50">
                              <td className="border border-black p-1 font-mono font-bold">{sch.installmentNumber}</td>
                              <td className="border border-black p-1">دينار</td>
                              <td className="border border-black p-1 font-mono">{sch.dueDate}</td>
                              <td className="border border-black p-1 font-mono font-bold">{formatNumber(sch.amountIQD)}</td>
                              <td className="border border-black p-1 font-mono">0</td>
                              <td className="border border-black p-1 font-mono">0</td>
                              <td className="border border-black p-1 font-mono text-emerald-800 font-bold">{paidAmt}</td>
                              <td className="border border-black p-1 font-mono font-bold">{remAmt}</td>
                              <td className="border border-black p-1 font-mono text-xs">{sch.paidDate || ''}</td>
                              <td className="border border-black p-1 font-mono">{sch.installmentNumber}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Document Footer */}
                  <div className="flex items-center justify-between text-[10px] text-gray-700 pt-3 border-t border-black font-mono">
                    <span>صفحة 1 من 1</span>
                    <span>تم التوليد بواسطة نظام أمان للتقسيط - {formatDate(new Date())}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: New Installment Contract Modal */}
      {isNewContractModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl cursor-default"
          >
            {/* Header */}
            <div className="p-5 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base whitespace-nowrap">إنشاء عقد تقسيط جديد</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewContractModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleContractSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              {/* Scrollable Form Body */}
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
                    <label className="text-slate-300 font-semibold block whitespace-nowrap">1. الزبون الخاص بالعقد:</label>
                    <select
                      value={contractFormData.borrowerId}
                      onChange={(e) => setContractFormData({ ...contractFormData, borrowerId: e.target.value })}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      {store.borrowers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.jobTitle || b.city})
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
                      {capitalInvestors.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          👤 {inv.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Credit Assessment Banner for Selected Borrower */}
                {(() => {
                  const selectedBorrower = store.borrowers.find((b) => b.id === contractFormData.borrowerId);
                  if (!selectedBorrower) return null;
                  const credit = evaluateBorrowerCredit(selectedBorrower, store.contracts);
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

              {/* Submit Buttons (Fixed at bottom) */}
              <div className="p-4 px-6 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewContractModalOpen(false)}
                  disabled={isSubmittingContract}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold transition-colors whitespace-nowrap"
                >
                  إلغاء
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

      {/* MODAL: Full Schedules & Repayment Drawer */}
      {selectedContractForSchedules && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl cursor-default"
          >
            {/* Modal Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-3">
                    جدول أقساط العقد #{getContractNumber(selectedContractForSchedules)}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    الزبون: <strong className="text-white">{selectedContractForSchedules.borrowerName}</strong> | المادة: {selectedContractForSchedules.inventoryItemName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedContractForSchedules(null)}
                  className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Schedules Table Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="space-y-3">
                {selectedContractForSchedules.schedules.map((sch) => {
                  const isPaid = sch.status === 'PAID';
                  return (
                    <div
                      key={sch.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs ${
                        isPaid
                          ? 'bg-slate-950/40 border-slate-800/80 opacity-90'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Left Schedule details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">قسط شهر {sch.installmentNumber}</span>
                          {isPaid ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              مدفوع ({sch.paidDate || 'تم التسديد'})
                            </span>
                          ) : (() => {
                            const due = calculateInstallmentDueStatus(sch.dueDate, false);
                            return (
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${due.badgeClassName}`}>
                                {due.status === 'OVERDUE' && '⚠️ '}
                                {due.status === 'DUE_TODAY' && '🔔 '}
                                {due.status === 'UPCOMING' && '⏳ '}
                                {due.label}
                              </span>
                            );
                          })()}
                        </div>

                        <p className="text-slate-400">تاريخ الاستحقاق: <span className="font-mono text-slate-200">{sch.dueDate}</span></p>

                        <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-3">
                          <span>حصة المستثمر من الربح: <PrivacyMaskedAmount id={`inv-sch-invprof-${sch.id}`} value={sch.investorProfitShareIQD} label={`ربح المستثمر: قسط ${sch.installmentNumber}`} size="xs" /></span>
                          <span>|</span>
                          <span>حصة الشركة: <PrivacyMaskedAmount id={`inv-sch-cmpprof-${sch.id}`} value={sch.companyProfitShareIQD} label={`ربح الشركة: قسط ${sch.installmentNumber}`} size="xs" /></span>
                        </div>

                        {sch.notes && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                            <FileText className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                            <div className="space-y-0.5">
                              <span className="font-bold text-amber-300">ملاحظة الترحيل / القسط:</span>
                              <p className="whitespace-pre-line leading-relaxed text-amber-100">{sch.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Amount & Action */}
                      <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                        <div className="text-left">
                          <div className="text-lg font-black text-emerald-400 tracking-tight">
                            <PrivacyMaskedAmount id={`inv-sch-amt-${sch.id}`} value={sch.amountIQD} label={`مبلغ القسط #${sch.installmentNumber}`} size="md" />
                          </div>
                          <span className="text-[10px] text-slate-500 block">IQD</span>
                        </div>

                        {!isPaid && (
                          <button
                            onClick={() => {
                              setPayingTarget({
                                contract: selectedContractForSchedules,
                                schedule: sch,
                              });
                              setPaymentInputAmount(sch.amountIQD.toString());
                              setPaymentDate(new Date().toISOString().split('T')[0]);
                            }}
                            disabled={payingScheduleId === sch.id}
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                          >
                            {payingScheduleId === sch.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                                <span>جاري السداد...</span>
                              </>
                            ) : (
                              <span>سداد القسط</span>
                            )}
                          </button>
                        )}

                        {isPaid && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedScheduleForReceipt({ contract: selectedContractForSchedules, schedule: sch })}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-amber-500/40"
                            >
                              <Receipt className="w-3.5 h-3.5 text-amber-400" />
                              <span>وصل التسديد الرسمية (A5)</span>
                            </button>
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                              <Check className="w-4 h-4" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>إجمالي أقساط العقد: <strong className="text-white">{selectedContractForSchedules.monthsCount} شهر</strong></span>
              <button
                onClick={() => setSelectedContractForSchedules(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Installment Payment with Partial Rollover Dialog (Layered on top of schedules) */}
      {payingTarget && (() => {
        const currentSchedule = payingTarget.schedule;
        const contract = payingTarget.contract;
        const originalAmount = currentSchedule.amountIQD;
        const rawInput = toEnglishDigits(paymentInputAmount).replace(/,/g, '').trim();
        const enteredAmount = parseFloat(rawInput) || 0;

        // Eligible schedules starting from current schedule onwards
        const eligibleSchedules = contract.schedules
          .filter((s) => s.status !== 'PAID' && s.installmentNumber >= currentSchedule.installmentNumber)
          .sort((a, b) => a.installmentNumber - b.installmentNumber);

        const totalPayableDebt = eligibleSchedules.reduce((acc, s) => acc + s.amountIQD, 0);

        const isExactSingle = enteredAmount === originalAmount;
        const isPartial = enteredAmount > 0 && enteredAmount < originalAmount;
        const diff = originalAmount - enteredAmount;
        const isMultiCascade = enteredAmount > originalAmount && enteredAmount <= totalPayableDebt;
        const isExceedingTotal = enteredAmount > totalPayableDebt;
        const isZeroOrNeg = enteredAmount <= 0;

        // Next schedule target for simple partial payment
        const nextSchedule = contract.schedules.find((s) => s.installmentNumber === currentSchedule.installmentNumber + 1)
          || contract.schedules.find((s) => s.status !== 'PAID' && s.id !== currentSchedule.id);

        // Real-time cascade simulation preview
        let cascadeSummary: {
          fullyPaid: { num: number; amount: number; due: string }[];
          partial: { num: number; paid: number; rem: number; orig: number; due: string } | null;
        } | null = null;

        if (isMultiCascade) {
          let rem = enteredAmount;
          const fulls: { num: number; amount: number; due: string }[] = [];
          let part: { num: number; paid: number; rem: number; orig: number; due: string } | null = null;

          for (const s of eligibleSchedules) {
            if (rem <= 0) break;
            if (rem >= s.amountIQD) {
              fulls.push({ num: s.installmentNumber, amount: s.amountIQD, due: s.dueDate });
              rem -= s.amountIQD;
            } else {
              part = { num: s.installmentNumber, paid: rem, rem: s.amountIQD - rem, orig: s.amountIQD, due: s.dueDate };
              rem = 0;
            }
          }
          cascadeSummary = { fullyPaid: fulls, partial: part };
        }

        return (
          <div
            className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl cursor-default flex flex-col animate-in fade-in zoom-in-95 duration-200 my-auto"
            >
              {/* Header */}
              <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">سداد قسط (كامل، جزئي، أو فائض متعدد)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      العقد: <span className="font-mono text-emerald-400 font-bold">#{getContractNumber(contract)}</span> | الزبون: <span className="text-slate-200">{contract.borrowerName}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPayingTarget(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                {/* Summary Box */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">القسط المستهدف:</span>
                    <span className="font-bold text-white text-sm">قسط شهر {currentSchedule.installmentNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">تاريخ الاستحقاق:</span>
                    <span className="font-mono text-slate-300">{currentSchedule.dueDate}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400 font-medium">قيمة هذا القسط:</span>
                    <span className="text-base font-black text-emerald-400 tracking-tight">
                      {formatCurrency(originalAmount)} د.ع
                    </span>
                  </div>
                  {eligibleSchedules.length > 1 && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/50 text-[11px]">
                      <span className="text-slate-400">إجمالي الأقساط المتبقية على العقد ({eligibleSchedules.length} أقساط):</span>
                      <span className="font-mono font-bold text-cyan-400">
                        {formatCurrency(totalPayableDebt)} د.ع
                      </span>
                    </div>
                  )}
                </div>

                {/* Repayment Document Date */}
                <DocumentDateField
                  value={paymentDate}
                  onChange={setPaymentDate}
                  label="تاريخ سند استلام القسط"
                  helpText="تاريخ تحرير السند واستلام مبلغ القسط (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
                />

                {/* Amount Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-200 block text-xs">
                      المبلغ المستلم المراد سداده الآن (د.ع):
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaymentInputAmount(originalAmount.toString())}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
                    >
                      سداد هذا القسط ({formatCurrency(originalAmount)})
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      value={paymentInputAmount}
                      onChange={(e) => setPaymentInputAmount(e.target.value)}
                      placeholder="أدخل المبلغ المسدد (كامل، جزئي، أو فائض للأقساط اللاحقة)..."
                      min={1}
                      max={totalPayableDebt}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-2xl px-4 py-3 text-lg font-black text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left pl-12"
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs pointer-events-none">
                      د.ع
                    </span>
                  </div>

                  {/* Quick presets */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaymentInputAmount(Math.round(originalAmount * 0.5).toString())}
                      className="py-1.5 px-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold transition-colors text-center"
                    >
                      50% ({formatCurrency(Math.round(originalAmount * 0.5))})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentInputAmount(originalAmount.toString())}
                      className="py-1.5 px-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-emerald-400 text-[11px] font-bold transition-colors border border-emerald-500/30 text-center"
                    >
                      قسط 1 ({formatCurrency(originalAmount)})
                    </button>
                    {eligibleSchedules.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const twoTotal = eligibleSchedules[0].amountIQD + eligibleSchedules[1].amountIQD;
                          setPaymentInputAmount(twoTotal.toString());
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-cyan-300 text-[11px] font-semibold transition-colors text-center"
                      >
                        قسطين ({formatCurrency(eligibleSchedules[0].amountIQD + eligibleSchedules[1].amountIQD)})
                      </button>
                    )}
                    {totalPayableDebt > originalAmount && (
                      <button
                        type="button"
                        onClick={() => setPaymentInputAmount(totalPayableDebt.toString())}
                        className="py-1.5 px-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-amber-300 text-[11px] font-bold transition-colors border border-amber-500/30 text-center"
                      >
                        كامل المتبقي ({formatCurrency(totalPayableDebt)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Real-time Calculation Breakdown / Alerts */}
                {isExceedingTotal && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                    <div>
                      <p className="font-bold">المبلغ المدخل يتجاوز إجمالي ديون العقد المتبقية!</p>
                      <p className="text-[11px] text-rose-200 mt-0.5">
                        إجمالي الأقساط المتبقية على العقد هي {formatCurrency(totalPayableDebt)} د.ع. يرجى إدخال مبلغ لا يتجاوز هذا الحد.
                      </p>
                    </div>
                  </div>
                )}

                {isZeroOrNeg && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                    <p>يرجى إدخال مبلغ سداد صحيح بالدينار العراقي أكبر من صفر.</p>
                  </div>
                )}

                {/* Case 1: Exact Full Payment of Single Installment */}
                {isExactSingle && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                    <div>
                      <p className="font-bold">سداد كامل قيمة القسط الحالي ({formatCurrency(originalAmount)} د.ع)</p>
                      <p className="text-[11px] text-emerald-200 mt-0.5">
                        سيتم تسديد قسط شهر {currentSchedule.installmentNumber} بالكامل وإغلاقه دون ترحيل أي مبالغ.
                      </p>
                    </div>
                  </div>
                )}

                {/* Case 2: Partial Payment with Rollover */}
                {isPartial && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 text-amber-200 text-xs">
                    <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>تسديد جزئي وترحيل المتبقي للدفعة اللاحقة</span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-amber-500/20">
                      <div className="flex justify-between">
                        <span>المبلغ المسدد الآن للقسط الحالي:</span>
                        <strong className="text-emerald-400 font-mono text-xs">{formatCurrency(enteredAmount)} د.ع</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>المتبقي غير المسدد:</span>
                        <strong className="text-amber-400 font-mono text-xs">{formatCurrency(diff)} د.ع</strong>
                      </div>
                      {nextSchedule ? (
                        <div className="flex justify-between border-t border-slate-800 pt-1.5 text-slate-300">
                          <span>الدفعة اللاحقة (قسط شهر {nextSchedule.installmentNumber}):</span>
                          <strong className="text-cyan-300 font-mono text-xs">
                            {formatCurrency(nextSchedule.amountIQD)} + {formatCurrency(diff)} = {formatCurrency(nextSchedule.amountIQD + diff)} د.ع
                          </strong>
                        </div>
                      ) : (
                        <div className="flex justify-between border-t border-slate-800 pt-1.5 text-slate-300">
                          <span>قسط تمديد إضافي لاحق:</span>
                          <strong className="text-cyan-300 font-mono text-xs">{formatCurrency(diff)} د.ع</strong>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/20 text-[11px] space-y-1">
                      <span className="font-bold text-amber-300 block">الملاحظة التي ستوثق على الدفعة اللاحقة:</span>
                      <p className="text-slate-200 leading-relaxed font-sans">
                        "القسط الأصلي: {nextSchedule ? formatCurrency(nextSchedule.amountIQD) : '0'} د.ع، والمتبقي {formatCurrency(diff)} د.ع هو عن الدفعة السابقة (قسط شهر {currentSchedule.installmentNumber})"
                      </p>
                    </div>
                  </div>
                )}

                {/* Case 3: Surplus / Multi-Installment Cascade Payment */}
                {isMultiCascade && cascadeSummary && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/50 via-slate-900 to-emerald-950/40 border border-cyan-500/40 space-y-3 text-cyan-200 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-cyan-300 text-sm">
                        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>تسديد فائض / سداد عدة أقساط دفعة واحدة</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/40 flex items-center gap-1 font-mono">
                        <Layers className="w-3 h-3" />
                        {cascadeSummary.fullyPaid.length} قسط بالكامل {cascadeSummary.partial ? '+ جزء' : ''}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-[11px] text-slate-300 bg-slate-950/80 p-3.5 rounded-xl border border-cyan-500/20">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                        <span className="text-slate-400">إجمالي المبلغ المستلم والموزع:</span>
                        <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(enteredAmount)} د.ع</strong>
                      </div>

                      <div className="space-y-1.5 pt-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>الأقساط التي سيتم تسديدها وإغلاقها بالكامل:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {cascadeSummary.fullyPaid.map((item) => (
                            <div key={item.num} className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                              <span className="font-bold">قسط شهر {item.num}</span>
                              <span className="font-mono font-bold text-emerald-200">{formatCurrency(item.amount)} د.ع</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {cascadeSummary.partial && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800">
                          <div className="font-bold text-amber-300 flex items-center gap-1.5">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                            <span>سداد جزئي للقسط التالي (قسط شهر {cascadeSummary.partial.num}):</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-1">
                            <div className="flex justify-between">
                              <span>المبلغ المستقطع له من الدفعة:</span>
                              <strong className="text-emerald-400 font-mono font-bold">{formatCurrency(cascadeSummary.partial.paid)} د.ع</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>المتبقي غير المسدد يرحل للدفعة اللاحقة:</span>
                              <strong className="text-amber-400 font-mono font-bold">{formatCurrency(cascadeSummary.partial.rem)} د.ع</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-300/90 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                      💡 سيتم تسديد الأقساط المذكورة تباعاً بحسب الترتيب، وتغذية المحافظ وحصص المستثمرين والشركة، وتخفيض مديونية الزبون بمقدار <strong className="text-emerald-400 font-mono">{formatCurrency(enteredAmount)} د.ع</strong> بالكامل.
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPayingTarget(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  disabled={isExceedingTotal || isZeroOrNeg || payingScheduleId === currentSchedule.id}
                  onClick={async () => {
                    const contractId = contract.id;
                    const scheduleId = currentSchedule.id;
                    const amountToPay = enteredAmount;
                    const pDate = paymentDate;
                    setPayingTarget(null);
                    await handlePayScheduleAction(contractId, scheduleId, amountToPay, pDate);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  {payingScheduleId === currentSchedule.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>جاري معالجة السداد...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {isMultiCascade
                          ? `تأكيد واستلام التسديد المتعدد (${formatCurrency(enteredAmount)} د.ع)`
                          : isPartial
                          ? `تأكيد واستلام التسديد الجزئي (${formatCurrency(enteredAmount)} د.ع)`
                          : `تأكيد واستلام التسديد (${formatCurrency(enteredAmount > 0 ? enteredAmount : originalAmount)} د.ع)`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Official Printable A5 Payment Receipt Modal (Layered on top of schedules) */}
      {selectedScheduleForReceipt && (() => {
        const { contract: c, schedule: sch } = selectedScheduleForReceipt;
        const invoiceNo = getInvoiceNumber(c);
        const receiptNo = getReceiptNumber(sch, c, store);
        const paidDateStr = sch.paidDate || new Date().toISOString().split('T')[0];

        // 1. Total Financed Contract Balance to be settled
        const totalContractFinancedIQD = (c.financedAmountIQD && c.financedAmountIQD > 0)
          ? c.financedAmountIQD
          : Math.max(0, (c.totalSalePriceIQD || 0) - (c.downPaymentIQD || 0));

        const fallbackTotal = c.schedules.reduce((sum, s) => sum + s.amountIQD, 0);
        const effectiveContractTotalIQD = totalContractFinancedIQD > 0 ? totalContractFinancedIQD : fallbackTotal;

        // 2. Sum of all installments paid prior to this schedule
        const paidPriorToThisIQD = c.schedules
          .filter((s) => s.installmentNumber < sch.installmentNumber && s.status === 'PAID')
          .reduce((sum, s) => sum + s.amountIQD, 0);

        // 3. Previous Balance: Total debt on the contract before paying this installment
        const previousBalanceIQD = Math.max(0, effectiveContractTotalIQD - paidPriorToThisIQD);

        // 4. Current Paid Amount in this voucher
        const currentPaidAmountIQD = sch.amountIQD;

        // 5. Current Balance: Remaining debt after deducting this payment
        const currentBalanceIQD = Math.max(0, previousBalanceIQD - currentPaidAmountIQD);

        const renderReceiptVoucher = (
          copyType: 'CUSTOMER' | 'ADMIN',
          badgeText: string,
          subText: string
        ) => (
          <div className="border-2 border-black rounded-2xl p-4 bg-white space-y-2.5 text-black a5-voucher-box shadow-none">
            {/* Top Header Row inside Voucher */}
            <div className="flex items-start justify-between border-b border-gray-300 pb-2">
              {/* Right Company Info */}
              <div className="text-right space-y-0.5">
                <h2 className="text-base font-extrabold text-black">{profile.companyName}</h2>
                <p className="text-[10.5px] text-black font-semibold">{profile.companyActivity}</p>
                <p className="text-[10px] text-black">{profile.companyAddress}</p>
                {profile.companyPhone && (
                  <p className="text-[10px] text-black font-mono font-bold">{profile.companyPhone}</p>
                )}
              </div>

              {/* Center Copy Badge */}
              <div className="text-center pt-0.5">
                <div className="border-2 border-black px-3.5 py-1 rounded-xl bg-gray-50 text-center">
                  <span className="text-xs font-black text-black block">{badgeText}</span>
                  <span className="text-[9px] text-gray-700 font-bold block">{subText}</span>
                </div>
              </div>

              {/* Left Brand Logo Box */}
              <div className="text-left flex flex-col items-end">
                <div className="w-10 h-10 bg-black text-white font-black rounded-lg flex items-center justify-center text-lg shadow-sm">
                  أ
                </div>
                <span className="text-[10px] font-bold tracking-widest text-black mt-0.5">أمان للتقسيط</span>
              </div>
            </div>

            {/* Receipt Box Header */}
            <div className="flex items-start justify-between border-b border-black pb-1.5">
              <div className="text-right flex-1">
                <h1 className="text-lg font-black text-black underline underline-offset-4">تسديد قسط</h1>
              </div>
              <div className="text-left font-mono font-bold text-xs space-y-0.5">
                <p>التاريخ : <span className="font-sans font-bold">{paidDateStr}</span></p>
                <p>رقم الوصل: <span className="font-mono">{receiptNo}</span></p>
              </div>
            </div>

            {/* Receipt Main Body Lines */}
            <div className="space-y-1.5 text-xs font-semibold pt-0.5">
              {/* Received From */}
              <div className="flex items-center gap-2">
                <span className="font-extrabold min-w-[95px] text-gray-800">استلمت من :</span>
                <span className="text-sm font-black text-black">{c.borrowerName}</span>
              </div>

              {/* Amount IQD + Words */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold min-w-[95px] text-gray-800">مبلغ قدره :</span>
                  <span className="font-mono text-sm font-black px-2.5 py-0.5 border border-black rounded bg-gray-50">
                    {formatNumber(sch.amountIQD)}
                  </span>
                </div>
                <div className="flex items-center gap-1 font-bold text-black text-xs">
                  <span>د.ع</span>
                  <span className="text-black font-bold">({tafqeetIQD(sch.amountIQD)})</span>
                </div>
              </div>

              {/* Amount USD (0 $) */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold min-w-[95px] text-gray-800">مبلغ قدره :</span>
                  <span className="font-mono text-xs font-black px-2.5 py-0.5 border border-black rounded bg-gray-50">0</span>
                </div>
                <div className="flex items-center gap-1 font-bold text-black text-xs">
                  <span>$</span>
                  <span>( صفر فقط لاغيرها )</span>
                </div>
              </div>

              {/* Description */}
              <div className="flex items-start gap-2 pt-0.5">
                <span className="font-extrabold min-w-[95px] text-gray-800">وذلك عن :</span>
                <span className="font-medium text-black leading-snug">
                  تسديد قسط من حساب الفاتورة رقم ( {invoiceNo} ) / تسديد القسط {sch.installmentNumber === 1 ? 'الأول' : sch.installmentNumber === 2 ? 'الثاني' : sch.installmentNumber === 3 ? 'الثالث' : sch.installmentNumber === 4 ? 'الرابع' : sch.installmentNumber === 5 ? 'الخامس' : `رقم ${sch.installmentNumber}`} {c.borrowerName}
                </span>
              </div>

              {sch.notes && (
                <div className="flex items-start gap-2 pt-0.5 text-[11px]">
                  <span className="font-extrabold min-w-[95px] text-black">ملاحظة القسط :</span>
                  <span className="font-semibold text-gray-900 leading-snug">{sch.notes}</span>
                </div>
              )}
            </div>

            {/* Bottom Balances & Signatures Block */}
            <div className="pt-2 border-t-2 border-black grid grid-cols-4 gap-2 text-center text-[10.5px] font-bold">
              <div className="space-y-1.5">
                <p className="border-b border-black pb-0.5">المحاسب</p>
                <p className="font-black pt-0.5">الحسابات</p>
              </div>

              <div className="space-y-0.5">
                <p className="border-b border-black pb-0.5">الرصيد السابق</p>
                <p className="font-mono font-black">{formatNumber(previousBalanceIQD)} د.ع</p>
                <p className="font-mono text-gray-700 text-[10px]">0 $</p>
              </div>

              <div className="space-y-0.5">
                <p className="border-b border-black pb-0.5">الرصيد الحالي</p>
                <p className="font-mono font-black">{formatNumber(currentBalanceIQD)} د.ع</p>
                <p className="font-mono text-gray-700 text-[10px]">0 $</p>
              </div>

              <div className="space-y-1.5">
                <p className="border-b border-black pb-0.5">توقيع المستلم</p>
                <p className="text-gray-400 font-mono pt-0.5">....................</p>
              </div>
            </div>
          </div>
        );

        return (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl cursor-default"
            >
              {/* Modal Top Control Bar */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 no-print">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">وصل تسديد قسط رسمي (نسخة الزبون + نسخة الإدارة)</h3>
                    <p className="text-xs text-slate-400">سند مالي رسمي معتمد لتسليم المشتري نسخته وحفظ نسخة في الإدارة</p>
                  </div>
                </div>

                {/* Copies Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setReceiptPrintMode('DUAL')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      receiptPrintMode === 'DUAL'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    نسختين معاً (زبون + إدارة)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptPrintMode('CUSTOMER')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      receiptPrintMode === 'CUSTOMER'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    نسخة الزبون فقط
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptPrintMode('ADMIN')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      receiptPrintMode === 'ADMIN'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    نسخة الإدارة فقط
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Export PDF / Print Button */}
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة الوصل ({receiptPrintMode === 'DUAL' ? 'نسختين: زبون + إدارة' : receiptPrintMode === 'CUSTOMER' ? 'نسخة الزبون' : 'نسخة الإدارة'})</span>
                  </button>

                  {/* Export XLSX Button */}
                  <button
                    onClick={() => exportReceiptXLSX(c, sch)}
                    className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-blue-500/10"
                    title="تصدير Excel (XLSX)"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden sm:inline">Excel</span>
                  </button>

                  {/* Export CSV Button */}
                  <button
                    onClick={() => exportReceiptCSV(c, sch)}
                    className="px-3 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-500/10"
                    title="تصدير CSV"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">CSV</span>
                  </button>

                  <button
                    onClick={() => setSelectedScheduleForReceipt(null)}
                    className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors mr-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Official Document Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white text-black font-sans print-a5-landscape-container">
                <div className="w-full max-w-[200mm] mx-auto space-y-3 text-[12px] leading-snug text-black">
                  {/* TOP VOUCHER: Customer Copy */}
                  {(receiptPrintMode === 'DUAL' || receiptPrintMode === 'CUSTOMER') && (
                    renderReceiptVoucher('CUSTOMER', 'نسخة الزبون (أصلية)', 'سند استلام للمشتري')
                  )}

                  {/* SCISSORS CUT DIVIDER (Shown in DUAL mode) */}
                  {receiptPrintMode === 'DUAL' && (
                    <div className="scissors-cut-divider py-1 flex items-center justify-center gap-2 text-[9.5px] font-bold text-gray-700 border-y border-dashed border-gray-400 bg-white my-2">
                      <Scissors className="w-4 h-4 text-gray-700" />
                      <span className="tracking-widest">----------------- خط القص والفصل (نسخة الزبون بالأعلى / نسخة الإدارة بالأسفل) -----------------</span>
                      <Scissors className="w-4 h-4 text-gray-700 rotate-180" />
                    </div>
                  )}

                  {/* BOTTOM VOUCHER: Company / Admin Copy */}
                  {(receiptPrintMode === 'DUAL' || receiptPrintMode === 'ADMIN') && (
                    renderReceiptVoucher('ADMIN', 'نسخة الإدارة والحسابات (سند حفظ)', 'أرشيف الشركة والمحاسبة')
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Unified 3-in-1 Document Hub Modal */}
      {selectedContractForHub && (
        <ContractDocumentHubModal
          contract={selectedContractForHub}
          store={store}
          onClose={() => setSelectedContractForHub(null)}
          onPaySchedule={handlePayScheduleAction}
          initialTab="INVOICE"
        />
      )}

      {/* MODAL: Numbering Cycle Reset Confirmation */}
      {isNumberingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl border border-amber-500/40 w-full max-w-md shadow-2xl p-6 space-y-5 text-right">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Hash className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">تأكيد تصفير دورة الترقيم المحاسبي</h2>
                <p className="text-xs text-slate-400">بدء ترقيم العقود والفواتير والوصولات القادمة من رقم 1</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-white">حفظ السجلات السابقة:</strong> كافة العقود والفواتير والوصولات الحالية ستبقى محفوظة بأرقامها السابقة وبكامل تفاصيلها المالية دون أي حذف.</span>
              </div>
              <div className="flex items-start gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong className="text-white">الدورة الجديدة:</strong> أي عقد أو فاتورة أو وصل يتم إنشاؤه بعد هذه اللحظة سيبدأ بتسلسل جديد (1، 2، 3...).</span>
              </div>
            </div>

            {numberingMsg && (
              <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                numberingMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {numberingMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{numberingMsg.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                أدخل رمز أمان الإدارة لتأكيد العملية
              </label>
              <div className="relative">
                <input
                  type={showNumberingPasscode ? 'text' : 'password'}
                  value={numberingPasscode}
                  onChange={(e) => setNumberingPasscode(e.target.value)}
                  placeholder="رمز أمان الإدارة (مثال: 2026)"
                  disabled={isNumberingLoading}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNumberingPasscode(!showNumberingPasscode)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showNumberingPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isNumberingLoading}
                onClick={() => setIsNumberingModalOpen(false)}
                className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isNumberingLoading || !numberingPasscode.trim()}
                onClick={handleConfirmResetNumbering}
                className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isNumberingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التصفير...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>تأكيد تصفير دورة الترقيم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
