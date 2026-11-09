'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  User,
  ChevronDown,
  ChevronUp,
  History,
  Calendar,
} from 'lucide-react';
import {
  DebtorAccount,
  DebtLedgerEntry,
  createEmptyDebtEntry,
  recalculateRunningEntries,
  calculateDebtorTotals,
  getDebtorLastActivityDate,
  getVisibleEntries,
} from '@/utils/debtLedger';
import { formatNumber } from '@/utils/formatters';

interface DebtorTableSectionProps {
  account: DebtorAccount;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateAccount: (id: string, debtorName: string, entries: DebtLedgerEntry[]) => Promise<void>;
  onDeleteAccount: (id: string, debtorName: string) => Promise<void>;
}

export const DebtorTableSection: React.FC<DebtorTableSectionProps> = ({
  account,
  isExpanded,
  onToggleExpand,
  onUpdateAccount,
  onDeleteAccount,
}) => {
  const [entries, setEntries] = useState<DebtLedgerEntry[]>(() =>
    recalculateRunningEntries(account.entries)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);

  const handleCellChange = (
    entryId: string,
    field: keyof DebtLedgerEntry,
    value: string | number
  ) => {
    setIsDirty(true);
    setEntries((prev) =>
      recalculateRunningEntries(
        prev.map((row) => {
          if (row.id !== entryId) return row;
          const nextRow = { ...row, [field]: value };
          if (field === 'debtAmount') nextRow.debtAmount = Math.max(0, Number(value) || 0);
          if (field === 'paidAmount') nextRow.paidAmount = Math.max(0, Number(value) || 0);
          return nextRow;
        })
      )
    );
  };

  const handleAddRow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) onToggleExpand();
    setIsDirty(true);
    setEntries((prev) => recalculateRunningEntries([...prev, createEmptyDebtEntry()]));
  };

  const handleDeleteRow = async (entryId: string) => {
    if (entries.length <= 1) return;
    const updated = recalculateRunningEntries(entries.filter((e) => e.id !== entryId));
    setEntries(updated);
    setIsSaving(true);
    try {
      await onUpdateAccount(account.id, account.debtorName, updated);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChanges = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      await onUpdateAccount(account.id, account.debtorName, entries);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const totals = calculateDebtorTotals(entries);
  const lastActivity = getDebtorLastActivityDate({ ...account, entries });
  const { visibleEntries, hiddenCount } = getVisibleEntries(entries, showAllEntries, 4);
  const isSettled = totals.totalRemaining <= 0 && totals.totalDebt > 0;

  return (
    <div className="border-b border-slate-800/80 last:border-b-0 transition-colors">
      {/* شريط الملخص المدمج للمدين (سطر واحد سريع وخفيف) */}
      <div
        onClick={onToggleExpand}
        className={`p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer transition-colors ${
          isExpanded ? 'bg-slate-800/40' : 'hover:bg-slate-900/60'
        }`}
      >
        <div className="flex items-center gap-3 min-w-[200px]">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isSettled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">{account.debtorName}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isSettled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                {isSettled ? 'مسدد بالكامل' : 'نشط'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
              <span>{entries.length} حركات</span>
              {lastActivity && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {lastActivity}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">مجموع الدين</span>
            <span className="font-mono font-semibold text-slate-200">
              {formatNumber(totals.totalDebt)} د.ع
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">إجمالي المسدد</span>
            <span className="font-mono font-semibold text-emerald-400">
              {formatNumber(totals.totalPaid)} د.ع
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">المتبقي بذمته</span>
            <span className="font-mono font-bold text-sm text-amber-400">
              {formatNumber(totals.totalRemaining)} د.ع
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveChanges}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>حفظ</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleAddRow}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>إضافة سطر</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 transition-colors"
          >
            <span>{isExpanded ? 'إخفاء الجدول' : 'عرض الجدول'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteAccount(account.id, account.debtorName);
            }}
            title="حذف حساب المدين"
            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* الجدول التفصيلي للمدين (يُحمّل فقط عند الفتح Lazy Rendering) */}
      {isExpanded && (
        <div className="p-4 pt-2 bg-slate-950/50 border-t border-slate-800/60 space-y-3">
          {entries.length > 4 && (
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] text-slate-400">
                {showAllEntries
                  ? `يتم عرض جميع الحركات (${entries.length} حركة)`
                  : `يتم عرض آخر 4 حركات فقط (توجد ${hiddenCount} حركات أقدم مخفية)`}
              </span>
              <button
                type="button"
                onClick={() => setShowAllEntries((prev) => !prev)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                <span>
                  {showAllEntries ? 'عرض آخر 4 حركات فقط' : `عرض السجل الكامل (${entries.length} حركة)`}
                </span>
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-800/90 bg-slate-950/70">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                  <th className="py-2.5 px-3 font-bold">مبلغ الدين</th>
                  <th className="py-2.5 px-3 font-bold">التاريخ</th>
                  <th className="py-2.5 px-3 font-bold">المبلغ المسدد</th>
                  <th className="py-2.5 px-3 font-bold">تاريخ التسديد</th>
                  <th className="py-2.5 px-3 font-bold">المتبقي</th>
                  <th className="py-2.5 px-3 font-bold">الملاحظات</th>
                  <th className="py-2.5 px-2 font-bold text-center w-10">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {visibleEntries.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/50">
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.debtAmount || ''}
                        placeholder="0"
                        onChange={(e) => handleCellChange(row.id, 'debtAmount', e.target.value)}
                        className="w-28 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="date"
                        value={row.debtDate}
                        onChange={(e) => handleCellChange(row.id, 'debtDate', e.target.value)}
                        className="bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.paidAmount || ''}
                        placeholder="0"
                        onChange={(e) => handleCellChange(row.id, 'paidAmount', e.target.value)}
                        className="w-28 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-400"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="date"
                        value={row.paidDate}
                        onChange={(e) => handleCellChange(row.id, 'paidDate', e.target.value)}
                        className="bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200"
                      />
                    </td>
                    <td className="p-2">
                      <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono font-bold text-amber-400 whitespace-nowrap">
                        {formatNumber(row.remainingAmount)} د.ع
                      </div>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.notes}
                        placeholder="إضافة ملاحظة..."
                        onChange={(e) => handleCellChange(row.id, 'notes', e.target.value)}
                        className="w-full min-w-[140px] bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        disabled={entries.length <= 1 || isSaving}
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
