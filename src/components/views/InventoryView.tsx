'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  ShieldCheck,
  Tag,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  DollarSign,
  TrendingUp,
  FileText,
  Building2,
  Wallet,
  Receipt,
  User,
  ShoppingBag,
  Layers,
  ArrowUpRight,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { InventoryItem } from '@/types/finance';

// Import and re-export formatIQD from centralized formatters utility
import { formatIQD } from '@/utils/formatters';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { usePrivacy } from '@/context/PrivacyContext';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { getCapitalInvestors } from '@/utils/investorSelectors';
export { formatIQD };

interface InventoryViewProps {
  store: SimulationStore;
  onPurchaseInventory?: (data: {
    sku?: string;
    name: string;
    category: string;
    investorId: string;
    quantity: number;
    unitCostIQD: number;
    targetSellingPriceIQD?: number;
    purchaseInvoiceId?: string;
    date?: string;
  }) => any;
  onUpdateInventory?: (data: {
    id: string;
    name: string;
    category: string;
    quantity: number;
    unitCostIQD: number;
    targetSellingPriceIQD?: number;
  }) => any;
  onDeleteInventory?: (itemId: string) => any;
}

type StatusFilter = 'ALL' | 'IN_STOCK' | 'FULLY_FINANCED';

export const InventoryView: React.FC<InventoryViewProps> = ({
  store,
  onPurchaseInventory,
  onUpdateInventory,
  onDeleteInventory
}) => {
  const capitalInvestors = getCapitalInvestors(store.investors);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
  const [filterInvestorId, setFilterInvestorId] = useState<string>('ALL');

  // View Mode: 'grid' (شبكة رباعية) | 'table' (قائمة جدولية)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Privacy Masking from global context
  const { isPrivacyActive } = usePrivacy();

  // Selected Item for Details Modal
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);

  // Dynamic available categories from current inventory
  const availableCategories = Array.from(
    new Set(store.inventory.map((item) => item.category).filter(Boolean))
  );

  // Submitting States for Visual Feedback & Anti-Double-Click
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Purchase Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseModalError, setPurchaseModalError] = useState<string | null>(null);
  const [purchaseFormData, setPurchaseFormData] = useState<{
    investorId: string;
    name: string;
    category: string;
    quantity: number;
    unitCostIQD: number;
    date: string;
  }>({
    investorId: store.companyWallet.id || capitalInvestors[0]?.id || '',
    name: '',
    category: '',
    quantity: 1,
    unitCostIQD: 1000000,
    date: new Date().toISOString().split('T')[0]
  });

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^\d]/g, '');
    const num = digitsOnly ? parseInt(digitsOnly, 10) : 0;
    setPurchaseFormData((prev) => ({
      ...prev,
      unitCostIQD: num
    }));
  };

  // Edit Modal State
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [editFormData, setEditFormData] = useState<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    unitCostIQD: number;
    targetSellingPriceIQD: number;
  }>({
    id: '',
    name: '',
    category: '',
    quantity: 1,
    unitCostIQD: 0,
    targetSellingPriceIQD: 0
  });

  // Delete Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (itemToDelete) {
          setItemToDelete(null);
        } else if (itemToEdit) {
          setItemToEdit(null);
        } else if (selectedItemForDetails) {
          setSelectedItemForDetails(null);
        } else if (isPurchaseModalOpen) {
          setIsPurchaseModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemToDelete, itemToEdit, selectedItemForDetails, isPurchaseModalOpen]);

  const handleOpenEdit = (item: InventoryItem) => {
    setItemToEdit(item);
    setEditFormData({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unitCostIQD: item.unitCostIQD,
      targetSellingPriceIQD: item.targetSellingPriceIQD || item.unitCostIQD
    });
  };

  const handleEditCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^\d]/g, '');
    const num = digitsOnly ? parseInt(digitsOnly, 10) : 0;
    setEditFormData((prev) => ({
      ...prev,
      unitCostIQD: num
    }));
  };

  const handleEditTargetPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^\d]/g, '');
    const num = digitsOnly ? parseInt(digitsOnly, 10) : 0;
    setEditFormData((prev) => ({
      ...prev,
      targetSellingPriceIQD: num
    }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEdit) return;
    if (!editFormData.name.trim()) {
      showNotification('يرجى إدخال اسم المادة بشكل صحيح', 'error');
      return;
    }
    if (!editFormData.category.trim()) {
      showNotification('يرجى إدخال نوع المادة', 'error');
      return;
    }
    if (editFormData.quantity <= 0 || editFormData.unitCostIQD <= 0) {
      showNotification('يرجى إدخال عدد وسعر شراء صحيحين أكبر من صفر', 'error');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      let result;
      if (onUpdateInventory) {
        result = await onUpdateInventory(editFormData);
      } else {
        result = store.updateInventory(editFormData);
      }

      if (result.success) {
        showNotification(result.message, 'success');
        setItemToEdit(null);
      } else {
        showNotification(result.message, 'error');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || isSubmittingDelete) return;

    setIsSubmittingDelete(true);
    try {
      let result;
      if (onDeleteInventory) {
        result = await onDeleteInventory(itemToDelete.id);
      } else {
        result = store.deleteInventory(itemToDelete.id);
      }

      if (result.success) {
        showNotification(result.message, 'success');
        setItemToDelete(null);
        if (selectedItemForDetails?.id === itemToDelete.id) {
          setSelectedItemForDetails(null);
        }
      } else {
        showNotification(result.message, 'error');
      }
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Notification Toast State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper for masking numbers and formatting with Iraqi Dinar separators
  const formatCurrency = (amount: number) => {
    if (isPrivacyActive) return '••••••••';
    return `${formatIQD(amount)} د.ع`;
  };

  // Filtered Inventory Items
  const filteredItems = store.inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.purchaseInvoiceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.investorName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
    const matchesStatus =
      filterStatus === 'ALL'
        ? true
        : filterStatus === 'FULLY_FINANCED'
        ? item.status === 'FULLY_FINANCED' || item.quantity === 0
        : item.status !== 'FULLY_FINANCED' && (item.quantity === undefined || item.quantity > 0);
    const matchesInvestor = filterInvestorId === 'ALL' || item.investorId === filterInvestorId;

    return matchesSearch && matchesCategory && matchesStatus && matchesInvestor;
  });

  // KPI Computations
  const inStockItemsList = store.inventory.filter(
    (item) => item.status !== 'FULLY_FINANCED' && (item.quantity === undefined || item.quantity > 0)
  );
  const totalAssetsValuationAll = inStockItemsList.reduce(
    (sum, item) => sum + ((item.quantity !== undefined ? item.quantity : 1) * (item.unitCostIQD || 0)),
    0
  );
  const totalItemsCount = store.inventory.length;
  const inStockItemsCount = inStockItemsList.length;

  // Selected Funding Target (Company or Investor) info for Purchase Modal validation
  const isCompanySelected =
    purchaseFormData.investorId === 'wallet-company' ||
    purchaseFormData.investorId === 'company-s' ||
    purchaseFormData.investorId === 'COMPANY' ||
    purchaseFormData.investorId === store.companyWallet.id;

  const selectedPurchaseInvestor = capitalInvestors.find((i) => i.id === purchaseFormData.investorId);
  const selectedWallet = isCompanySelected
    ? store.companyWallet
    : store.wallets.find(
        (w) => w.id === selectedPurchaseInvestor?.walletId || w.ownerId === selectedPurchaseInvestor?.id
      );

  const purchaseTotalCost = purchaseFormData.quantity * purchaseFormData.unitCostIQD;
  const hasEnoughBalance = selectedWallet ? selectedWallet.balance >= purchaseTotalCost : false;

  // Handle Purchase Submit
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPurchase) return;
    setPurchaseModalError(null);

    if (!purchaseFormData.name.trim()) {
      const msg = 'يرجى كتابة اسم المادة أو الأصل بشكل صحيح';
      setPurchaseModalError(msg);
      showNotification(msg, 'error');
      return;
    }
    if (!purchaseFormData.category.trim()) {
      const msg = 'يرجى كتابة نوع المادة';
      setPurchaseModalError(msg);
      showNotification(msg, 'error');
      return;
    }
    if (!purchaseFormData.investorId) {
      const msg = 'يرجى اختيار الجهة الممولة للشراء';
      setPurchaseModalError(msg);
      showNotification(msg, 'error');
      return;
    }
    if (purchaseFormData.quantity <= 0 || purchaseFormData.unitCostIQD <= 0) {
      const msg = 'يرجى إدخال عدد وسعر شراء صحيحين أكبر من صفر';
      setPurchaseModalError(msg);
      showNotification(msg, 'error');
      return;
    }
    if (!hasEnoughBalance) {
      const msg = `رصيد سيولة الجهة الممولة (${formatCurrency(selectedWallet?.balance || 0)}) غير كافٍ لتكلفة الشراء (${formatCurrency(purchaseTotalCost)})`;
      setPurchaseModalError(msg);
      showNotification(msg, 'error');
      return;
    }

    const payload = {
      name: purchaseFormData.name.trim(),
      category: purchaseFormData.category.trim(),
      investorId: purchaseFormData.investorId,
      quantity: Number(purchaseFormData.quantity),
      unitCostIQD: Number(purchaseFormData.unitCostIQD),
      targetSellingPriceIQD: Number(purchaseFormData.unitCostIQD),
      date: purchaseFormData.date
    };

    setIsSubmittingPurchase(true);
    try {
      let result;
      if (onPurchaseInventory) {
        result = await onPurchaseInventory(payload);
      } else {
        result = store.purchaseInventory(payload);
      }

      if (result.success) {
        showNotification(result.message, 'success');
        setIsPurchaseModalOpen(false);
        setPurchaseModalError(null);
        setPurchaseFormData({
          investorId: store.companyWallet.id || capitalInvestors[0]?.id || '',
          name: '',
          category: '',
          quantity: 1,
          unitCostIQD: 1000000,
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        const errorMsg = result.message || 'تعذر تسجيل عملية الشراء بالسيستم';
        setPurchaseModalError(errorMsg);
        showNotification(errorMsg, 'error');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'حدث خطأ غير متوقع أثناء تسجيل الشراء';
      setPurchaseModalError(errorMsg);
      showNotification(errorMsg, 'error');
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">إدارة المخزن والأصول</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          {/* Privacy Toggle */}
          <PrivacyToggleButton />

          {/* New Purchase Button */}
          <button
            onClick={() => {
              setPurchaseFormData({
                investorId: store.companyWallet.id || capitalInvestors[0]?.id || '',
                name: '',
                category: '',
                quantity: 1,
                unitCostIQD: 1000000,
                date: new Date().toISOString().split('T')[0]
              });
              setPurchaseModalError(null);
              setIsPurchaseModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/10 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>شراء مادة جديدة للمخزن</span>
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Assets Valuation */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">تكلفة الأصول بالمخزن</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-amber-400 tracking-tight">
              {formatCurrency(totalAssetsValuationAll)}
            </p>
          </div>
        </div>

        {/* Total Items Count */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">عدد أصناف الأصول</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-white tracking-tight">
              {totalItemsCount} <span className="text-xs font-normal text-slate-400">صنف</span>
            </p>
          </div>
        </div>

        {/* Funding Investors Count */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-pink-400" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">المستثمرون الممولون للأصول</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-400 tracking-tight">
              {capitalInvestors.length} <span className="text-xs font-normal text-slate-400">مستثمر</span>
            </p>
          </div>
        </div>
      </div>


      {/* Filter, Search, and View Mode Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث باسم المادة، الرمز SKU، الفاتورة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Group */}
          <div className="flex items-center gap-2.5 overflow-x-auto text-xs">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400 font-semibold whitespace-nowrap">النوع:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">جميع الفئات</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400 font-semibold whitespace-nowrap">الحالة:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="IN_STOCK">متاحة بالمخزن</option>
                <option value="FULLY_FINANCED">مباعة بالكامل</option>
              </select>
            </div>

            {/* Investor Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400 font-semibold whitespace-nowrap">المالك:</span>
              <select
                value={filterInvestorId}
                onChange={(e) => setFilterInvestorId(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">جميع المستثمرين</option>
                {capitalInvestors.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* View Mode Toggle (شبكة رباعية / قائمة) & Privacy Button */}
        <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
          <PrivacyToggleButton variant="compact" />
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'grid'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
            title="عرض شبكة رباعية"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>شبكة رباعية</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'table'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
            title="عرض قائمة جدولية"
          >
            <List className="w-4 h-4" />
            <span>قائمة</span>
          </button>
        </div>
        </div>
      </div>

      {/* Items Display: 4-Column Grid View */}
      {viewMode === 'grid' && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const investor = store.investors.find((i) => i.id === item.investorId);
            const linkedContracts = store.contracts.filter((c) => c.inventoryItemId === item.id);
            const marginIQD = item.targetSellingPriceIQD - item.totalCostIQD;

            return (
              <div
                key={item.id}
                className="bg-slate-900 rounded-3xl p-4.5 border border-slate-800 hover:border-slate-700 space-y-3.5 shadow-xl transition-all relative overflow-hidden flex flex-col justify-between group"
              >
                {/* Top Accent Bar */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500" />

                <div className="space-y-3">
                  {/* Card Header: Badges & Status */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded-md border border-slate-800">
                        {item.sku}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                        item.quantity === 0 || item.status === 'FULLY_FINANCED'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : linkedContracts.length > 0
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {item.quantity === 0 || item.status === 'FULLY_FINANCED'
                        ? 'مباعة بالكامل'
                        : linkedContracts.length > 0
                        ? `متاح جزئياً (${item.quantity} بالمخزن)`
                        : `متاحة (${item.quantity})`}
                    </span>
                  </div>

                  {/* Item Name & Invoice */}
                  <div>
                    <h2 className="text-base font-bold text-white leading-snug line-clamp-2 group-hover:text-amber-300 transition-colors">
                      {item.name}
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-1">
                      فاتورة: <span className="font-mono text-slate-300">{item.purchaseInvoiceId}</span>
                    </p>
                  </div>

                  {/* Real Owner Investor Callout */}
                  <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] text-slate-400 block leading-tight">الجهة الممولة:</span>
                        <PrivacyMaskedText id={`inv-item-owner-${item.id}`} text={item.investorName} as="span" className="font-bold text-indigo-300 text-xs truncate block" />
                      </div>
                    </div>
                    {investor && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800 shrink-0">
                        {investor.contract.investorSharePercent}%
                      </span>
                    )}
                  </div>

                  {/* Pricing Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                    <div>
                      <span className="text-slate-400 block text-[10px]">الكمية بالمخزن:</span>
                      <span className="font-bold text-white text-sm">{item.quantity}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">تكلفة الشراء:</span>
                      <span className="font-bold text-amber-400 text-xs">{formatCurrency(item.totalCostIQD)}</span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/50 flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">سعر البيع المخطط:</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(item.targetSellingPriceIQD)}</span>
                    </div>
                  </div>

                  {/* Margin info */}
                  {marginIQD > 0 && (
                    <div className="flex items-center justify-between text-[10px] px-1 text-slate-400">
                      <span>الربح المخطط:</span>
                      <span className="text-emerald-400 font-bold">+{formatCurrency(marginIQD)}</span>
                    </div>
                  )}
                  {linkedContracts.length > 0 && (
                    <div className="text-[10px] text-purple-400 font-bold px-1">
                      {item.quantity > 0
                        ? `مرتبطة بـ ${linkedContracts.length} عقد تقسيط (المتبقي للبيع: ${item.quantity} قطعة)`
                        : 'مرتبطة بعقد تقسيط قيد السداد (تم تمويل كامل الكمية)'}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedItemForDetails(item)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700/60 flex items-center justify-center gap-1.5"
                    title="عرض تفاصيل الأصل والفاتورة"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>التفاصيل</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition-colors border border-slate-700/60"
                    title="تعديل بيانات المادة"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setItemToDelete(item)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-rose-400 hover:text-rose-300 transition-colors border border-slate-700/60"
                    title="حذف المادة من المخزن"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Items Display: Table / List View */}
      {viewMode === 'table' && filteredItems.length > 0 && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                <tr>
                  <th className="py-3.5 px-4">المادة والتصنيف</th>
                  <th className="py-3.5 px-4">رمز SKU / الفاتورة</th>
                  <th className="py-3.5 px-4">الجهة الممولة (المالك)</th>
                  <th className="py-3.5 px-4 text-center">الكمية</th>
                  <th className="py-3.5 px-4">تكلفة الشراء الإجمالية</th>
                  <th className="py-3.5 px-4">سعر البيع المخطط</th>
                  <th className="py-3.5 px-4 text-center">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredItems.map((item) => {
                  const investor = store.investors.find((i) => i.id === item.investorId);
                  const itemLinkedContracts = store.contracts.filter((c) => c.inventoryItemId === item.id);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{item.name}</div>
                        <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 inline-block mt-0.5">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-300">{item.sku}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.purchaseInvoiceId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <PrivacyMaskedText id={`inv-table-owner-${item.id}`} text={item.investorName} as="div" className="font-bold text-indigo-300" />
                        {investor && (
                          <div className="text-[10px] text-slate-400">عقد {investor.contract.investorSharePercent}%</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-white text-sm">
                        {item.quantity}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-amber-400">
                        {formatCurrency(item.totalCostIQD)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        {formatCurrency(item.targetSellingPriceIQD)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-block ${
                            item.quantity === 0 || item.status === 'FULLY_FINANCED'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : itemLinkedContracts.length > 0
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {item.quantity === 0 || item.status === 'FULLY_FINANCED'
                            ? 'مباعة بالكامل'
                            : itemLinkedContracts.length > 0
                            ? `متاح جزئياً (${item.quantity} متبقي)`
                            : `متاحة بالمخزن (${item.quantity})`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedItemForDetails(item)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition-colors border border-slate-700/60 inline-flex items-center gap-1 shadow-sm"
                            title="عرض التفاصيل"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>التفاصيل</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition-colors border border-slate-700/60"
                            title="تعديل المادة"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-rose-400 hover:text-rose-300 transition-colors border border-slate-700/60"
                            title="حذف المادة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {filteredItems.length === 0 && (
        <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Boxes className="w-8 h-8" />
          </div>
          <p className="text-slate-400 text-sm font-medium">لم يتم العثور على أي مادة تطابق معايير التصفية والبحث</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterCategory('ALL');
              setFilterStatus('ALL');
              setFilterInvestorId('ALL');
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold"
          >
            إعادة تصفية البحث
          </button>
        </div>
      )}

      {/* MODAL 1: Purchase Asset Modal (نافذة شراء مادة جديدة من صندوق مستثمر) */}
      {isPurchaseModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 cursor-default"
          >
            {/* Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">شراء مادة جديدة للمخزن (تخصيص أصل)</h3>
                  <p className="text-xs text-slate-400">تخصيص المادة باسم الجهة الممولة (صندوق الشركة أو المستثمر) وخصم التكلفة من محفظتها</p>
                </div>
              </div>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-4 text-xs">
              {/* Funding Entity Selection */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">الجهة الممولة للشراء (صندوق المستثمر أو الشركة):</label>
                <select
                  value={purchaseFormData.investorId}
                  onChange={(e) => setPurchaseFormData({ ...purchaseFormData, investorId: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value={store.companyWallet.id}>
                    🏢 {store.companyWallet.ownerName} (سيولة متاح: {formatCurrency(store.companyWallet.balance)})
                  </option>
                  {capitalInvestors.map((inv) => {
                    const invWallet = store.wallets.find((w) => w.id === inv.walletId || w.ownerId === inv.id);
                    return (
                      <option key={inv.id} value={inv.id}>
                        👤 {inv.name} (سيولة متاح: {formatCurrency(invWallet ? invWallet.balance : 0)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Liquidity Alert Bar */}
              {selectedWallet && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    hasEnoughBalance
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300 animate-pulse'
                  }`}
                >
                  <span>السيولة المتاحة حالياً بصندوق الجهة الممولة:</span>
                  <strong className="font-mono">{formatCurrency(selectedWallet.balance)}</strong>
                </div>
              )}

              {/* Purchase Document Date */}
              <DocumentDateField
                value={purchaseFormData.date}
                onChange={(d) => setPurchaseFormData({ ...purchaseFormData, date: d })}
                label="تاريخ فاتورة الشراء والتوريد"
                helpText="تاريخ شراء المادة وتوريدها للمخزن (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
              />

              {/* Item Name & Category / Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">اسم المادة:</label>
                  <input
                    type="text"
                    required
                    value={purchaseFormData.name}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, name: e.target.value })}
                    placeholder="مثال: طن حديد تسليح 12 ملم"
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">نوع المادة:</label>
                  <input
                    type="text"
                    required
                    value={purchaseFormData.category}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        category: e.target.value
                      })
                    }
                    placeholder="مثال: مواد إنشائية، كهربائيات، سيارات..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Quantity (العدد) & Unit Cost (سعر الشراء) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">العدد:</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={purchaseFormData.quantity || ''}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, quantity: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                    placeholder="1"
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-semibold block">سعر الشراء (IQD):</label>
                    {purchaseFormData.unitCostIQD > 0 && (
                      <span className="text-[11px] text-amber-400 font-mono font-bold">
                        {formatIQD(purchaseFormData.unitCostIQD)} د.ع
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={purchaseFormData.unitCostIQD ? formatIQD(purchaseFormData.unitCostIQD) : ''}
                    onChange={handleCostChange}
                    placeholder="مثال: 1.000.000"
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Calculation Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>إجمالي تكلفة الشراء المخصومة من صندوق الجهة الممولة:</span>
                  <strong className="text-amber-400 font-mono text-sm">{formatCurrency(purchaseTotalCost)}</strong>
                </div>
              </div>

              {/* Error Message inside modal */}
              {purchaseModalError && (
                <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="font-bold leading-relaxed">{purchaseModalError}</span>
                </div>
              )}

              {/* Submit / Cancel Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  disabled={isSubmittingPurchase}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!hasEnoughBalance || isSubmittingPurchase}
                  className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                    hasEnoughBalance && !isSubmittingPurchase
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmittingPurchase ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>جاري تسجيل الشراء...</span>
                    </>
                  ) : (
                    <span>تأكيد الشراء وخصم المبلغ</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Asset Details & Ownership Drawer/Modal */}
      {selectedItemForDetails && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-0 cursor-default"
          >
            {/* Modal Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Boxes className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{selectedItemForDetails.name}</h3>
                  <p className="text-xs text-slate-400">
                    رمز المادة SKU: <span className="font-mono text-slate-300">{selectedItemForDetails.sku}</span> | الفاتورة: {selectedItemForDetails.purchaseInvoiceId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemForDetails(null)}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Content */}
            <div className="p-6 space-y-5 text-xs">
              {/* Owner Investor Section */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>معلومات المالك الممول الحقيقي للمادة</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">اسم المستثمر الممول:</span>
                    <strong className="text-emerald-400 text-sm">{selectedItemForDetails.investorName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">تاريخ الشراء والخصم:</span>
                    <strong className="text-slate-200">{selectedItemForDetails.purchaseDate}</strong>
                  </div>
                </div>
              </div>

              {/* Pricing & Cost breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">الكمية بالمخزن</span>
                  <strong className="text-white text-base">{selectedItemForDetails.quantity}</strong>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">تكلفة شراء الوحدة</span>
                  <strong className="text-amber-400 text-base">{formatCurrency(selectedItemForDetails.unitCostIQD)}</strong>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">التكلفة الإجمالية</span>
                  <strong className="text-amber-400 text-base">{formatCurrency(selectedItemForDetails.totalCostIQD)}</strong>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">سعر البيع المخطط</span>
                  <strong className="text-emerald-400 text-base">{formatCurrency(selectedItemForDetails.targetSellingPriceIQD)}</strong>
                </div>
              </div>

              {/* Linked Installment Contracts */}
              <div className="space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>عقود التقسيط المرتبطة بهذ المادة</span>
                </h4>

                {store.contracts.filter((c) => c.inventoryItemId === selectedItemForDetails.id).length === 0 ? (
                  <p className="text-slate-500 text-center py-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
                    هذه المادة متاحة حالياً بالمخزن ولم تُرتبط بأي عقد تقسيط بعد.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {store.contracts
                      .filter((c) => c.inventoryItemId === selectedItemForDetails.id)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-300">{c.contractNumber}</span>
                            <p className="text-slate-400 mt-0.5">الزبون: <strong className="text-white">{c.borrowerName}</strong></p>
                          </div>
                          <div className="text-left">
                            <span className="text-emerald-400 font-bold">{formatCurrency(c.totalSalePriceIQD)}</span>
                            <span className="text-[10px] text-slate-500 block">قسط شهري: {formatCurrency(c.monthlyInstallmentIQD)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const item = selectedItemForDetails;
                    setSelectedItemForDetails(null);
                    handleOpenEdit(item);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold border border-blue-500/30 transition-colors text-xs flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>تعديل المادة</span>
                </button>
                <button
                  onClick={() => {
                    const item = selectedItemForDetails;
                    setSelectedItemForDetails(null);
                    setItemToDelete(item);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-bold border border-rose-500/30 transition-colors text-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المادة</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedItemForDetails(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors text-xs"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Inventory Item Modal */}
      {itemToEdit && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 cursor-default"
          >
            {/* Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">تعديل بيانات مادة بالمخزن</h3>
                  <p className="text-xs text-slate-400">الرمز: {itemToEdit.sku} | الممول: {itemToEdit.investorName}</p>
                </div>
              </div>
              <button
                onClick={() => setItemToEdit(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              {itemToEdit.status === 'FULLY_FINANCED' && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>تنبيه: هذه المادة مرتبطة بعقد تقسيط قيد السداد؛ يسمح بتعديل الاسم والتصنيف فقط.</span>
                </div>
              )}

              {/* Item Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">اسم المادة:</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">نوع المادة / الفئة:</label>
                  <input
                    type="text"
                    required
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Quantity & Unit Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">العدد / الكمية:</label>
                  <input
                    type="number"
                    min="1"
                    required
                    disabled={itemToEdit.status === 'FULLY_FINANCED'}
                    value={editFormData.quantity || ''}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        quantity: Math.max(1, parseInt(e.target.value || '1', 10))
                      })
                    }
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono font-bold focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-semibold block">سعر الشراء للوحدة (IQD):</label>
                    {editFormData.unitCostIQD > 0 && (
                      <span className="text-[11px] text-amber-400 font-mono font-bold">
                        {formatIQD(editFormData.unitCostIQD)} د.ع
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    disabled={itemToEdit.status === 'FULLY_FINANCED'}
                    value={editFormData.unitCostIQD ? formatIQD(editFormData.unitCostIQD) : ''}
                    onChange={handleEditCostChange}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Target Selling Price */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold block">سعر البيع المخطط للوحدة (IQD):</label>
                  {editFormData.targetSellingPriceIQD > 0 && (
                    <span className="text-[11px] text-emerald-400 font-mono font-bold">
                      {formatIQD(editFormData.targetSellingPriceIQD)} د.ع
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={itemToEdit.status === 'FULLY_FINANCED'}
                  value={editFormData.targetSellingPriceIQD ? formatIQD(editFormData.targetSellingPriceIQD) : ''}
                  onChange={handleEditTargetPriceChange}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              {/* Total Calculation Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>إجمالي تكلفة الشراء الجديدة:</span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {formatCurrency(editFormData.quantity * editFormData.unitCostIQD)}
                  </strong>
                </div>
                {itemToEdit.status !== 'FULLY_FINANCED' && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span>فارق التسوية مع محفظة {itemToEdit.investorName}:</span>
                    <strong
                      className={
                        editFormData.quantity * editFormData.unitCostIQD - itemToEdit.totalCostIQD >= 0
                          ? 'text-rose-400 font-mono'
                          : 'text-emerald-400 font-mono'
                      }
                    >
                      {editFormData.quantity * editFormData.unitCostIQD - itemToEdit.totalCostIQD > 0
                        ? `خصم إضافي: +${formatIQD(editFormData.quantity * editFormData.unitCostIQD - itemToEdit.totalCostIQD)} د.ع`
                        : editFormData.quantity * editFormData.unitCostIQD - itemToEdit.totalCostIQD < 0
                        ? `استرجاع للمحفظة: ${formatIQD(Math.abs(editFormData.quantity * editFormData.unitCostIQD - itemToEdit.totalCostIQD))} د.ع`
                        : 'لا يوجد تغيير في التكلفة'}
                    </strong>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setItemToEdit(null)}
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>جاري حفظ التعديل...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation Modal */}
      {itemToDelete && (
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
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">تأكيد حذف مادة من المخزن</h3>
                  <p className="text-xs text-slate-400">حذف الأصل واسترجاع السيولة المخصومة للممول</p>
                </div>
              </div>
              <button
                onClick={() => setItemToDelete(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">{itemToDelete.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {itemToDelete.sku}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-400 pt-1">
                  <div>العدد: <strong className="text-white">{itemToDelete.quantity}</strong></div>
                  <div>الجهة الممولة: <strong className="text-indigo-300">{itemToDelete.investorName}</strong></div>
                  <div>تكلفة الوحدة: <strong className="text-amber-400">{formatCurrency(itemToDelete.unitCostIQD)}</strong></div>
                  <div>الإجمالي: <strong className="text-amber-400">{formatCurrency(itemToDelete.totalCostIQD)}</strong></div>
                </div>
              </div>

              {(() => {
                const linkedContracts = store.contracts.filter((c) => c.inventoryItemId === itemToDelete.id);
                const borrowerNames = Array.from(new Set(linkedContracts.map((c) => c.borrowerName))).filter(Boolean);

                if (linkedContracts.length > 0) {
                  return (
                    <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-300 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                      <div className="space-y-1.5 flex-1">
                        <strong className="block font-bold text-white text-xs">
                          تنبيه: هذه المادة مرتبطة بعقد تقسيط!
                        </strong>
                        <div className="text-xs text-amber-200">
                          الزبون المرتبط بقرضه:{' '}
                          <span className="font-bold text-white bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 inline-block mr-1">
                            {borrowerNames.length > 0 ? borrowerNames.join('، ') : 'غير محدد'}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-300/80 pt-1">
                          عند التأكيد، سيتم إلغاء ارتباط المادة بالعقد وحذفها واسترجاع كامل مبلغ الشراء (
                          <strong className="text-white font-mono">{formatCurrency(itemToDelete.totalCostIQD)}</strong>
                          ) كسيولة نقدية إلى صندوق <strong className="text-white">{itemToDelete.investorName}</strong>.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <strong className="block font-bold">الأثر المالي للحذف:</strong>
                      <p className="text-[11px] text-emerald-200/90 mt-0.5">
                        سيتم إلغاء المادة واسترجاع مبلغ <strong className="text-white">{formatCurrency(itemToDelete.totalCostIQD)}</strong> بالكامل كسيولة متاحة إلى صندوق <strong className="text-white">{itemToDelete.investorName}</strong>.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  disabled={isSubmittingDelete}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmittingDelete}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2"
                >
                  {isSubmittingDelete ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>جاري الحذف والاسترجاع...</span>
                    </>
                  ) : (
                    <span>تأكيد الحذف واسترجاع المبلغ</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
