'use client';

import React, { useState } from 'react';
import { X, ArrowLeft, ArrowRight, Plus, Trash2, UserPlus, Check, Loader2 } from 'lucide-react';
import {
  DebtLedgerEntry,
  createEmptyDebtEntry,
  recalculateRunningEntries,
  calculateDebtorTotals,
} from '@/utils/debtLedger';
import { formatNumber } from '@/utils/formatters';

interface AddDebtorModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (debtorName: string, entries: DebtLedgerEntry[]) => Promise<void>;
}

export const AddDebtorModal: React.FC<AddDebtorModalProps> = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [debtorName, setDebtorName] = useState('');
  const [entries, setEntries] = useState<DebtLedgerEntry[]>(() => [createEmptyDebtEntry()]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setStep(1);
    setDebtorName('');
    setEntries([createEmptyDebtEntry()]);
    setErrorMsg(null);
    onClose();
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtorName.trim()) {
      setErrorMsg('يرجى إدخال اسم المدين أولاً');
      return;
    }
    setErrorMsg(null);
    setStep(2);
  };

  const handleUpdateEntry = (
    id: string,
    field: keyof DebtLedgerEntry,
    value: string | number
  ) => {
    setEntries((prev) =>
      recalculateRunningEntries(
        prev.map((row) => {
          if (row.id !== id) return row;
          const nextRow = { ...row, [field]: value };
          if (field === 'debtAmount') nextRow.debtAmount = Math.max(0, Number(value) || 0);
          if (field === 'paidAmount') nextRow.paidAmount = Math.max(0, Number(value) || 0);
          return nextRow;
        })
      )
    );
  };

  const handleAddRow = () => {
    setEntries((prev) => recalculateRunningEntries([...prev, createEmptyDebtEntry()]));
  };

  const handleRemoveRow = (id: string) => {
    if (entries.length <= 1) return;
    setEntries((prev) => recalculateRunningEntries(prev.filter((r) => r.id !== id)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtorName.trim()) {
      setErrorMsg('اسم المدين مطلوب');
      return;
    }
    setErrorMsg(null);
    await onSubmit(debtorName.trim(), entries);
    setStep(1);
    setDebtorName('');
    setEntries([createEmptyDebtEntry()]);
  };

  const totals = calculateDebtorTotals(entries);

  return (
    <div
      onClick={handleCloseModal}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {step === 1 ? 'إضافة مدين جديد في دفتر الديون' : `جدول الديون للمدين: ${debtorName}`}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 1
                  ? 'الخطوة 1 من 2: أدخل اسم المدين ثم اضغط التالي'
                  : 'الخطوة 2 من 2: املأ جدول الديون والتسديدات الخاصة بالمدين'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleNextStep} className="p-6 space-y-6">
            <div>
              <label className="block text-xs text-slate-300 font-bold mb-2">
                اسم المدين <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="مثال: جميل / أوس / نهاد"
                value={debtorName}
                onChange={(e) => setDebtorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                <span>التالي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">اسم المدين:</span>
                <span className="text-sm font-bold text-emerald-400">{debtorName}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>تعديل الاسم</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة سطر</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 text-xs">
                    <th className="py-3 px-3 font-bold">مبلغ الدين</th>
                    <th className="py-3 px-3 font-bold">التاريخ</th>
                    <th className="py-3 px-3 font-bold">المبلغ المسدد</th>
                    <th className="py-3 px-3 font-bold">تاريخ التسديد</th>
                    <th className="py-3 px-3 font-bold">المتبقي</th>
                    <th className="py-3 px-3 font-bold">الملاحظات</th>
                    <th className="py-3 px-2 font-bold text-center w-10">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs bg-slate-900/60">
                  {entries.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/30">
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={row.debtAmount || ''}
                          onChange={(e) => handleUpdateEntry(row.id, 'debtAmount', e.target.value)}
                          className="w-32 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          value={row.debtDate}
                          onChange={(e) => handleUpdateEntry(row.id, 'debtDate', e.target.value)}
                          className="bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={row.paidAmount || ''}
                          onChange={(e) => handleUpdateEntry(row.id, 'paidAmount', e.target.value)}
                          className="w-32 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs font-mono text-emerald-400"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          value={row.paidDate}
                          onChange={(e) => handleUpdateEntry(row.id, 'paidDate', e.target.value)}
                          className="bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                        />
                      </td>
                      <td className="p-2">
                        <div className="px-3 py-2 rounded-lg bg-slate-950/90 border border-slate-800 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {formatNumber(row.remainingAmount)} د.ع
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="ملاحظات..."
                          value={row.notes}
                          onChange={(e) => handleUpdateEntry(row.id, 'notes', e.target.value)}
                          className="w-full min-w-[140px] bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs text-white"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          disabled={entries.length <= 1}
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-400">
                  إجمالي الدين: <strong className="font-mono text-white">{formatNumber(totals.totalDebt)} د.ع</strong>
                </span>
                <span className="text-slate-400">
                  إجمالي المسدد: <strong className="font-mono text-emerald-400">{formatNumber(totals.totalPaid)} د.ع</strong>
                </span>
                <span className="text-slate-400">
                  المتبقي بذمته: <strong className="font-mono text-amber-400">{formatNumber(totals.totalRemaining)} د.ع</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>حفظ</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

