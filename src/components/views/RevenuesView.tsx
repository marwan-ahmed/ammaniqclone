'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Plus,
  DollarSign,
  Building2,
  Calendar,
  Tag,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  Receipt,
  Trash2,
  Sparkles,
  Wallet,
  Coins,
  Loader2,
  FileText
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';
import { RevenueItem } from '@/types/finance';
import { tafqeetIQD } from '@/components/common/ContractDocumentHubModal';
import { formatNumber, toEnglishDigits } from '@/utils/formatters';
import { DocumentDateField } from '@/components/common/DocumentDateField';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';

interface RevenuesViewProps {
  store: SimulationStore;
  onAddRevenue?: (data: {
    title: string;
    category: 'رسوم كشف واستعلام' | 'رسوم فتح ملف وتنظيم عقد' | 'أرباح إدارية واستشارية' | 'غرامات تأخير ورسوم تسوية' | 'إيرادات أخرى';
    amountIQD: number;
    notes?: string;
    date?: string;
  }) => any;
  onDeleteRevenue?: (revenueId: string) => any;
}

type RevenueCategory = 'رسوم كشف واستعلام' | 'رسوم فتح ملف وتنظيم عقد' | 'أرباح إدارية واستشارية' | 'غرامات تأخير ورسوم تسوية' | 'إيرادات أخرى';

const PRESET_AMOUNTS = [
  { label: '25,000 د.ع (كشف ميداني)', value: 25000 },
  { label: '50,000 د.ع (فتح ملف وتنظيم)', value: 50000 },
  { label: '100,000 د.ع (عمولة إدارية)', value: 100000 },
  { label: '250,000 د.ع (أرباح استشارية)', value: 250000 }
];

export const RevenuesView: React.FC<RevenuesViewProps> = ({
  store,
  onAddRevenue,
  onDeleteRevenue
}) => {
  const profile = store.companyProfile || DEFAULT_COMPANY_REPORT_PROFILE;
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRevenueForReceipt, setSelectedRevenueForReceipt] = useState<RevenueItem | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RevenueCategory>('رسوم فتح ملف وتنظيم عقد');
  const [amountIQD, setAmountIQD] = useState<string>('50000');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setSelectedRevenueForReceipt(null);
      }
    };
    if (showAddModal || selectedRevenueForReceipt) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showAddModal, selectedRevenueForReceipt]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const totalRevenues = store.revenues.reduce((acc, rev) => acc + rev.amountIQD, 0);
  const parsedAmount = parseInt(amountIQD.replace(/[^\d]/g, ''), 10) || 0;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showNotification('يرجى إدخال بيان أو وصف الإيراد', 'error');
      return;
    }
    if (parsedAmount <= 0) {
      showNotification('يرجى إدخال مبلغ إيراد صحيح أكبر من صفر', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAddRevenue) {
        const res = await onAddRevenue({
          title: title.trim(),
          category,
          amountIQD: parsedAmount,
          notes: notes.trim() || undefined,
          date
        });
        if (res && res.success === false) {
          showNotification(res.message || 'تعذر تسجيل الإيراد', 'error');
          setIsSubmitting(false);
          return;
        }
      } else {
        store.addRevenue({
          title: title.trim(),
          category,
          amountIQD: parsedAmount,
          notes: notes.trim() || undefined,
          date
        });
      }

      showNotification(`تم تسجيل الإيراد "${title.trim()}" بقيمة ${formatNumber(parsedAmount)} د.ع وتغذية صندوق الشركة بنجاح`);
      setShowAddModal(false);
      setTitle('');
      setAmountIQD('50000');
      setNotes('');
    } catch (err: any) {
      showNotification(err?.message || 'حدث خطأ أثناء تسجيل الإيراد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (revId: string, revTitle: string) => {
    if (confirm(`هل أنت متأكد من حذف الإيراد "${revTitle}" واستبعاد قيمته من صندوق الشركة؟`)) {
      if (onDeleteRevenue) {
        onDeleteRevenue(revId);
      } else {
        store.deleteRevenue(revId);
      }
      showNotification(`تم حذف الإيراد "${revTitle}" بنجاح`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2 border animate-bounce ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400/30'
              : 'bg-rose-600 text-white border-rose-400/30'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30 shadow-lg shadow-teal-500/10">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">إدارة الإيرادات والرسوم الإدارية</h1>
            <p className="text-xs text-slate-400">
              تتبع رسوم فتح الملفات، الاستعلام الميداني، والعمولات الإدارية المباشرة التي تغذي{' '}
              <strong className="text-emerald-400">صندوق نظام أمان الرئيسي</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <PrivacyToggleButton />
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-teal-500/20 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل إيراد جديد</span>
          </button>
        </div>
      </div>

      {/* Revenues & Company Fund Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metric 1: Total Administrative Revenues */}
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400 font-medium">إجمالي الإيرادات الإدارية والرسوم</p>
            <div className="text-3xl font-black text-teal-400 mt-1">
              <PrivacyMaskedAmount id="rev-total-amt" value={totalRevenues} label="إجمالي الإيرادات الإدارية" size="lg" className="text-teal-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">عدد العمليات المسجلة: {store.revenues.length} إيراد</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Destination Company Fund */}
        <div className="bg-slate-900 p-6 rounded-3xl border border-emerald-500/30 flex items-center justify-between shadow-lg bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40">
          <div>
            <p className="text-xs text-emerald-300 font-medium">الجهة المستلمة (المستودع المالي للإيرادات)</p>
            <p className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span>صندوق نظام أمان الرئيسي</span>
            </p>
            <p className="text-xs text-slate-300 mt-1">
              الرصيد المتاح الحالي بالصندوق:{' '}
              <strong className="text-emerald-400 font-mono font-bold text-sm">
                {formatNumber(store.companyWallet.balance)} د.ع
              </strong>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Revenues Table */}
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="font-bold text-white text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-400" />
            <span>سجل الإيرادات المباشرة</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">الإجمالي: {formatNumber(totalRevenues)} د.ع</span>
        </div>

        {store.revenues.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <TrendingUp className="w-10 h-10 mx-auto text-slate-600 opacity-40" />
            <p className="text-sm font-bold text-slate-400">لا توجد إيرادات مسجلة حتى الآن</p>
            <p className="text-xs text-slate-500">اضغط على زر "تسجيل إيراد جديد" لإضافة أول إيراد لصندوق الشركة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {store.revenues.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-white text-sm">{rev.title}</p>
                      <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 text-[10px] font-bold border border-teal-500/20">
                        {rev.category}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-2">
                      <span>📅 التاريخ: {rev.date}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">📥 أودع في: صندوق الشركة</span>
                    </p>
                    {rev.notes && <p className="text-slate-400 text-[11px] mt-1 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/60">{rev.notes}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-500 block">المبلغ المودع</span>
                    <span className="font-mono font-black text-teal-400 text-base">+<PrivacyMaskedAmount id={`rev-amt-${rev.id}`} value={rev.amountIQD} label={`إيراد: ${rev.title}`} size="sm" className="text-teal-400" /></span>
                  </div>

                  <button
                    onClick={() => setSelectedRevenueForReceipt(rev)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="معاينة وطباعة وصل استلام الإيراد"
                  >
                    <Receipt className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(rev.id, rev.title)}
                    className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 transition-colors border border-red-500/20 cursor-pointer"
                    title="حذف الإيراد"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD NEW REVENUE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            {/* Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">تسجيل إيراد إداري جديد</h3>
                  <p className="text-xs text-slate-400">
                    سيتم إيداع المبلغ وتغذيته تلقائياً في <strong className="text-emerald-400">صندوق الشركة الرئيسي</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              {/* Title / Description */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">بيان أو وصف الإيراد *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: رسوم تنظيم عقد وفتح ملف للزبون أحمد"
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">تصنيف الإيراد *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RevenueCategory)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="رسوم فتح ملف وتنظيم عقد">رسوم فتح ملف وتنظيم عقد</option>
                  <option value="رسوم كشف واستعلام">رسوم كشف واستعلام ميداني</option>
                  <option value="أرباح إدارية واستشارية">أرباح إدارية واستشارية</option>
                  <option value="غرامات تأخير ورسوم تسوية">غرامات تأخير ورسوم تسوية</option>
                  <option value="إيرادات أخرى">إيرادات متنوعة أخرى</option>
                </select>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[11px] block">مبالغ شائعة سريعة:</label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_AMOUNTS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setAmountIQD(p.value.toString())}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-teal-500/50 text-slate-300 text-[11px] font-medium text-right transition-all cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount IQD */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold block">مبلغ الإيراد (دينار عراقي) *</label>
                  {parsedAmount > 0 && (
                    <span className="text-[11px] text-teal-400 font-mono font-bold">{formatNumber(parsedAmount)} د.ع</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={amountIQD}
                  onChange={(e) => setAmountIQD(toEnglishDigits(e.target.value).replace(/[^\d]/g, ''))}
                  placeholder="50000"
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-base font-bold focus:outline-none focus:border-teal-500"
                />
                {parsedAmount > 0 && (
                  <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                    التفقيط: <strong className="text-teal-300">{tafqeetIQD(parsedAmount)}</strong>
                  </p>
                )}
              </div>

              {/* Date */}
              <DocumentDateField
                value={date}
                onChange={setDate}
                label="تاريخ سند الإيراد"
                helpText="تاريخ تحرير السند وتحصيل الإيراد (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
              />

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">ملاحظات إضافية (اختياري)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="تفاصيل العميل أو رقم الوصل..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || parsedAmount <= 0}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black transition-all shadow-lg shadow-teal-500/20 flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>تأكيد تسجيل الإيراد</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIPT VIEW MODAL */}
      {selectedRevenueForReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-white text-base">سند قبض إيراد مالي</h3>
              </div>
              <button
                onClick={() => setSelectedRevenueForReceipt(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs bg-white text-black font-sans">
              <div className="text-center border-b pb-3 border-gray-300">
                <h2 className="text-lg font-black text-black">{profile.companyName}</h2>
                <p className="text-xs text-gray-700">{profile.companyAddress}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-gray-100 border border-gray-400 font-bold rounded">
                  وصل قبض إيراد إداري
                </span>
              </div>

              <div className="space-y-2 border-b pb-3 border-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-600">بيان الإيراد:</span>
                  <strong className="text-black">{selectedRevenueForReceipt.title}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">التصنيف:</span>
                  <strong>{selectedRevenueForReceipt.category}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">التاريخ:</span>
                  <span className="font-mono">{selectedRevenueForReceipt.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">المبلغ المقبوض:</span>
                  <strong className="font-mono font-black text-sm">{formatNumber(selectedRevenueForReceipt.amountIQD)} د.ع</strong>
                </div>
                <div className="pt-1">
                  <span className="text-gray-600">فقط: </span>
                  <strong className="text-black">{tafqeetIQD(selectedRevenueForReceipt.amountIQD)}</strong>
                </div>
              </div>

              <div className="flex justify-between pt-4 text-[10px] text-gray-600">
                <span>توقيع المستلم: ....................</span>
                <span>ختم الإدارة ({profile.managerName || 'أحمد إياد'}): ....................</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الوصل</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
