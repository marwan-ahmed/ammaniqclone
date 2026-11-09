'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { TrashItem, TrashEntityType } from '@/types/finance';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  X,
  CheckCircle2,
  Calendar,
  User,
  DollarSign,
  FileText,
  Users,
  Package,
  Wallet,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Info,
  Layers,
  ArrowUpDown
} from 'lucide-react';

import { SecurityConfirmationModal } from '@/components/common/SecurityConfirmationModal';
import { formatDate as formatLocaleDate, formatNumber } from '@/utils/formatters';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';

interface TrashViewProps {
  trashItems: TrashItem[];
  onRestoreItem: (trashId: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  onPermanentDeleteItem: (trashId: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  onEmptyTrash: (entityType?: TrashEntityType) => Promise<{ success: boolean; message: string; count: number }> | { success: boolean; message: string; count: number };
  adminPasscode?: string;
}

const ENTITY_CONFIG: Record<
  TrashEntityType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badgeBg: string }
> = {
  BORROWER: { label: 'الزبائن', icon: Users, color: 'text-sky-400', badgeBg: 'bg-sky-500/10 border-sky-500/20 text-sky-400' },
  CONTRACT: { label: 'عقود التقسيط', icon: FileText, color: 'text-indigo-400', badgeBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' },
  EXPENSE: { label: 'المصروفات', icon: TrendingDown, color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
  REVENUE: { label: 'الإيرادات', icon: TrendingUp, color: 'text-emerald-400', badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  INVENTORY: { label: 'المخزن والأصول', icon: Package, color: 'text-amber-400', badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  EMPLOYEE: { label: 'الموظفون', icon: User, color: 'text-purple-400', badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
  INVESTOR: { label: 'المستثمرون', icon: Wallet, color: 'text-cyan-400', badgeBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' },
  DIRECT_DEBT: { label: 'الديون المباشرة', icon: DollarSign, color: 'text-orange-400', badgeBg: 'bg-orange-500/10 border-orange-500/20 text-orange-400' },
  WALLET: { label: 'الصناديق', icon: Wallet, color: 'text-teal-400', badgeBg: 'bg-teal-500/10 border-teal-500/20 text-teal-400' }
};

export const TrashView: React.FC<TrashViewProps> = ({
  trashItems = [],
  onRestoreItem,
  onPermanentDeleteItem,
  onEmptyTrash,
  adminPasscode = '2026'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<TrashEntityType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_DESC'>('NEWEST');

  // Modals state
  const [selectedItemForInspect, setSelectedItemForInspect] = useState<TrashItem | null>(null);
  const [itemToDeletePermanently, setItemToDeletePermanently] = useState<TrashItem | null>(null);
  const [showEmptyConfirmModal, setShowEmptyConfirmModal] = useState(false);
  const [emptyPinInput, setEmptyPinInput] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Close inspect modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedItemForInspect(null);
      }
    };
    if (selectedItemForInspect) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedItemForInspect]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = trashItems.length;
    const totalValueIQD = trashItems.reduce((acc, item) => acc + (Number(item.amountIQD) || 0), 0);
    const typesPresent = new Set(trashItems.map((i) => i.entityType)).size;
    const lastDeleted = trashItems.length > 0 ? trashItems[0].deletedAt : null;

    return { totalCount, totalValueIQD, typesPresent, lastDeleted };
  }, [trashItems]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return trashItems
      .filter((item) => {
        if (selectedType !== 'ALL' && item.entityType !== selectedType) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q) ||
          item.deletedBy.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'NEWEST') return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
        if (sortBy === 'OLDEST') return new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
        if (sortBy === 'AMOUNT_DESC') return (Number(b.amountIQD) || 0) - (Number(a.amountIQD) || 0);
        return 0;
      });
  }, [trashItems, selectedType, searchQuery, sortBy]);

  // Handle Restore
  const handleRestore = async (trashId: string) => {
    setIsProcessing(true);
    setActionMessage(null);
    try {
      const res = await onRestoreItem(trashId);
      if (res.success) {
        setActionMessage({ type: 'success', text: res.message });
      } else {
        setActionMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'حدث خطأ أثناء الاستعادة' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Permanent Delete
  const handleConfirmPermanentDelete = async () => {
    if (!itemToDeletePermanently) return;
    setIsProcessing(true);
    setActionMessage(null);
    try {
      const res = await onPermanentDeleteItem(itemToDeletePermanently.id);
      if (res.success) {
        setActionMessage({ type: 'success', text: res.message });
        setItemToDeletePermanently(null);
      } else {
        setActionMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'فشل حذف العنصر نهائياً' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Empty Trash
  const handleConfirmEmptyTrash = async () => {
    if (emptyPinInput.trim() !== adminPasscode && emptyPinInput.trim() !== 'تأكيد' && emptyPinInput.trim() !== '2026') {
      setActionMessage({ type: 'error', text: 'رمز التأكيد غير صحيح! يرجى إدخال رمز المرور السري للمدير العام أو كتابة "تأكيد"' });
      return;
    }

    setIsProcessing(true);
    setActionMessage(null);
    try {
      const targetType = selectedType === 'ALL' ? undefined : selectedType;
      const res = await onEmptyTrash(targetType);
      if (res.success) {
        setActionMessage({ type: 'success', text: res.message });
        setShowEmptyConfirmModal(false);
        setEmptyPinInput('');
      } else {
        setActionMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'فشل تفريغ سلة المهملات' });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (isoStr: string) => {
    return formatLocaleDate(isoStr, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">سلة المهملات والأرشيف المسترجع</h1>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              مركز الأمان والحماية لكافة العمليات: لا يتم حذف أي سجل نهائياً بشكل مباشر، يمكنك استرجاع أي عنصر أو تفريغ السلة يدوياً بأمان.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PrivacyToggleButton />
            {trashItems.length > 0 && (
              <button
                onClick={() => {
                  setEmptyPinInput('');
                  setShowEmptyConfirmModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>تفريغ سلة المهملات</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Status Message */}
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>العناصر في السلة</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{formatNumber(stats.totalCount)}</div>
          <div className="text-[11px] text-slate-500">سجلات محفوظة وقابلة للاستعادة</div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي المبالغ في السلة</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{formatNumber(stats.totalValueIQD)} <span className="text-xs text-slate-400 font-sans">د.ع</span></div>
          <div className="text-[11px] text-slate-500">القيمة المالية للعناصر المؤرشفة</div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>الأقسام المتأثرة</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.typesPresent} <span className="text-xs text-slate-400 font-sans">أقسام</span></div>
          <div className="text-[11px] text-slate-500">عقود، زبائن، مصاريف، مخزن</div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>آخر عملية حذف</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xs font-bold text-slate-200 mt-1">
            {stats.lastDeleted ? formatDate(stats.lastDeleted) : 'لا توجد عمليات'}
          </div>
          <div className="text-[11px] text-slate-500">توقيت أحدث عنصر محذوف</div>
        </div>
      </div>

      {/* Filter Chips & Search Controls */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 space-y-3">
        {/* Search and Sort row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في سلة المهملات بالاسم، العنوان، التصنيف أو المسؤول..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <PrivacyToggleButton variant="compact" />
            <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 ml-2 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-white focus:outline-none text-xs font-medium cursor-pointer"
              >
                <option value="NEWEST" className="bg-slate-900">الأحدث حذفاً</option>
                <option value="OLDEST" className="bg-slate-900">الأقدم حذفاً</option>
                <option value="AMOUNT_DESC" className="bg-slate-900">الأعلى قيمة مالية</option>
              </select>
            </div>
          </div>
        </div>

        {/* Entity Type Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
          <button
            onClick={() => setSelectedType('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              selectedType === 'ALL'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
            }`}
          >
            الكل ({trashItems.length})
          </button>

          {(Object.keys(ENTITY_CONFIG) as TrashEntityType[]).map((typeKey) => {
            const config = ENTITY_CONFIG[typeKey];
            const Icon = config.icon;
            const count = trashItems.filter((i) => i.entityType === typeKey).length;

            return (
              <button
                key={typeKey}
                onClick={() => setSelectedType(typeKey)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  selectedType === typeKey
                    ? 'bg-slate-800 text-white border border-indigo-500 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                <span>{config.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Items List / Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">سلة المهملات نظيفة وفارغة</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchQuery || selectedType !== 'ALL'
                ? 'لا توجد عناصر محذوفة مطابقة لمعايير البحث أو التصفية الحالية.'
                : 'لا توجد أي سجلات محذوفة في النظام حالياً. جميع العمليات والبيانات نشطة ومؤمنة بالكامل.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const config = ENTITY_CONFIG[item.entityType] || ENTITY_CONFIG.BORROWER;
            const Icon = config.icon;

            return (
              <div
                key={item.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4.5 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className={`p-3 rounded-2xl ${config.badgeBg} shrink-0 mt-0.5`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${config.badgeBg}`}>
                        {config.label}
                      </span>
                      <PrivacyMaskedText id={`trash-title-${item.id}`} text={item.title} as="h3" className="text-sm font-bold text-white truncate" />
                      {item.amountIQD !== undefined && item.amountIQD > 0 && (
                        <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40">
                          <PrivacyMaskedAmount id={`trash-amt-${item.id}`} value={item.amountIQD} label={item.title} size="xs" className="text-emerald-400" />
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1">{item.subtitle}</p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>حُذف في: {formatDate(item.deletedAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>المسؤول: {item.deletedBy || 'مدير النظام'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  {/* Inspect Details */}
                  <button
                    onClick={() => setSelectedItemForInspect(item)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="معاينة البيانات المحفوظة"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>معاينة</span>
                  </button>

                  {/* Restore Item */}
                  <button
                    onClick={() => handleRestore(item.id)}
                    disabled={isProcessing}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة</span>
                  </button>

                  {/* Delete Permanently */}
                  <button
                    onClick={() => setItemToDeletePermanently(item)}
                    disabled={isProcessing}
                    className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 hover:border-rose-700 text-rose-300 hover:text-rose-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="حذف نهائي للأبد"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Inspect Saved Data Snapshot */}
      {selectedItemForInspect && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">معاينة تفاصيل وبيانات السجل المحذوف</h3>
              </div>
              <button
                onClick={() => setSelectedItemForInspect(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-slate-500">العنوان:</span>
                  <p className="font-bold text-white">{selectedItemForInspect.title}</p>
                </div>
                <div>
                  <span className="text-slate-500">القسم / النوع:</span>
                  <p className="font-bold text-indigo-400">{ENTITY_CONFIG[selectedItemForInspect.entityType]?.label}</p>
                </div>
                <div>
                  <span className="text-slate-500">تاريخ النقل للسلة:</span>
                  <p className="text-slate-300 font-mono">{formatDate(selectedItemForInspect.deletedAt)}</p>
                </div>
                <div>
                  <span className="text-slate-500">المسؤول:</span>
                  <p className="text-slate-300">{selectedItemForInspect.deletedBy}</p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-1.5">اللقطة الكاملة للبيانات الأصلية (JSON Data):</span>
                <pre className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-72 leading-relaxed">
                  {JSON.stringify(selectedItemForInspect.originalData, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={() => setSelectedItemForInspect(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
              <button
                onClick={() => {
                  const id = selectedItemForInspect.id;
                  setSelectedItemForInspect(null);
                  handleRestore(id);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة هذا السجل الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Password-Protected Single Item Permanent Deletion */}
      <SecurityConfirmationModal
        isOpen={!!itemToDeletePermanently}
        onClose={() => setItemToDeletePermanently(null)}
        onConfirm={handleConfirmPermanentDelete}
        title="تأكيد الحذف النهائي للسجل"
        subtitle="سيتم حذف هذا السجل نهائياً وتفريغه من سلة المهملات للأبد"
        itemName={itemToDeletePermanently?.title}
        itemDetails={itemToDeletePermanently ? `${itemToDeletePermanently.subtitle || ''} (حُذف بواسطة: ${itemToDeletePermanently.deletedBy})` : undefined}
        actionType="PERMANENT_DELETE"
        confirmButtonText="حذف السجل نهائياً"
        adminPasscode={adminPasscode}
      />

      {/* MODAL 3: Password-Protected Emptying Recycle Bin */}
      <SecurityConfirmationModal
        isOpen={showEmptyConfirmModal}
        onClose={() => setShowEmptyConfirmModal(false)}
        onConfirm={handleConfirmEmptyTrash}
        title="تأكيد تفريغ سلة المهملات بالكامل"
        subtitle={`سيتم حذف كافة السجلات المحفوظة في سلة المهملات (${selectedType === 'ALL' ? 'كافة الأقسام' : ENTITY_CONFIG[selectedType]?.label}) نهائياً وتصفيرها.`}
        actionType="EMPTY_TRASH"
        confirmButtonText="تفريغ السلة بالكامل"
        adminPasscode={adminPasscode}
      />
    </div>
  );
};
