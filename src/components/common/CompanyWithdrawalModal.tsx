'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowDownLeft,
  Wallet,
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  UserCheck,
  FileText,
  DollarSign
} from 'lucide-react';
import { tafqeetIQD } from '@/utils/tafqeet';
import { CompanyWithdrawalReceiptData } from './CompanyWithdrawalReceiptModal';
import { formatNumber } from '@/utils/formatters';
import { DocumentDateField } from '@/components/common/DocumentDateField';

interface CompanyWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyBalance: number;
  onSubmitWithdrawal: (data: {
    amountIQD: number;
    recipientName: string;
    type: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
    notes?: string;
    receiptNo?: string;
    date?: string;
  }) => Promise<{ success: boolean; message: string; receipt?: CompanyWithdrawalReceiptData } | any>;
}

export const CompanyWithdrawalModal: React.FC<CompanyWithdrawalModalProps> = ({
  isOpen,
  onClose,
  companyBalance,
  onSubmitWithdrawal
}) => {
  const [amountIQD, setAmountIQD] = useState<number>(1000000);
  const [recipientName, setRecipientName] = useState<string>('أحمد إياد (المدير العام)');
  const [type, setType] = useState<'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL'>('PROFIT_WITHDRAWAL');
  const [notes, setNotes] = useState<string>('');
  const [receiptNo, setReceiptNo] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const generatedNo = `WTH-COMP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      setReceiptNo(generatedNo);
      setAmountIQD(Math.min(1000000, companyBalance > 0 ? companyBalance : 1000000));
      setDate(new Date().toISOString().split('T')[0]);
      setErrorMessage(null);
    }
  }, [isOpen, companyBalance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isExcess = amountIQD > companyBalance;
  const remainingBalance = Math.max(0, companyBalance - amountIQD);
  const tafqeetText = amountIQD > 0 ? tafqeetIQD(amountIQD) : 'صفر دينار عراقي';

  const quickAmounts = [250000, 500000, 1000000, 2500000, 5000000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (amountIQD <= 0) {
      setErrorMessage('يرجى إدخال مبلغ سحب صحيح أكبر من صفر');
      return;
    }

    if (amountIQD > companyBalance) {
      setErrorMessage(`السيولة النقدية المتاحة (${formatNumber(companyBalance)} د.ع) غير كافية لصرف هذا المبلغ`);
      return;
    }

    if (!recipientName.trim()) {
      setErrorMessage('يرجى تحديد أو كتابة اسم المستلم نقداً');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSubmitWithdrawal({
        amountIQD,
        recipientName: recipientName.trim(),
        type,
        notes: notes.trim(),
        receiptNo: receiptNo.trim(),
        date: date || undefined
      });

      if (res && !res.success) {
        setErrorMessage(res.message || 'تعذر إتمام عملية السحب النقدي');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء معالجة السحب');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">سحب نقدي من صندوق الشركة</h2>
              <p className="text-xs text-slate-400">صرف سيولة نقدية مباشرة من الخزينة الرئيسية</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Company Fund Current Balance Callout */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">صندوق نظام أمان الرئيسي</span>
                <span className="text-xs font-semibold text-emerald-400">السيولة النقدية المتوفرة حالياً</span>
              </div>
            </div>
            <div className="text-left font-mono">
              <span className="text-lg font-black text-white block">{formatNumber(companyBalance)}</span>
              <span className="text-[10px] text-slate-400 font-sans">دينار عراقي</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Amount IQD Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">مبلغ السحب (دينار عراقي) *</label>
              {amountIQD > 0 && (
                <span className={`text-[11px] font-bold ${isExcess ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isExcess ? 'المبلغ يتجاوز السيولة المتوفرة!' : `المتبقي بالصندوق: ${formatNumber(remainingBalance)} د.ع`}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                value={amountIQD || ''}
                onChange={(e) => setAmountIQD(Number(e.target.value))}
                className={`w-full px-4 py-3 rounded-2xl bg-slate-950 border ${
                  isExcess ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-400'
                } text-white font-mono text-lg font-black focus:outline-none transition-all pl-16`}
                placeholder="أدخل مبلغ السحب..."
                required
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">د.ع</span>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {quickAmounts.map((qAmt) => (
                <button
                  key={qAmt}
                  type="button"
                  onClick={() => setAmountIQD(qAmt)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border ${
                    amountIQD === qAmt
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {qAmt >= 1000000 ? `${qAmt / 1000000} مليون` : `${qAmt / 1000} ألف`}
                </button>
              ))}
              {companyBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountIQD(companyBalance)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all mr-auto"
                >
                  كامل الرصيد
                </button>
              )}
            </div>

            {/* Arabic Tafqeet Box */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <span className="text-slate-500 block text-[10px] font-bold mb-0.5">المبلغ كتابة وتفقيطاً:</span>
              <span className="text-amber-300 font-bold">{tafqeetText}</span>
            </div>
          </div>

          {/* Recipient Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">يُصرف للسيد / الجهة المستلمة نقداً *</label>
            <div className="relative">
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-amber-400 transition-all pr-10"
                placeholder="اسم المستلم نقداً (مثال: أحمد إياد - المدير العام)"
                required
              />
              <UserCheck className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Document Date */}
          <DocumentDateField
            value={date}
            onChange={setDate}
            label="تاريخ سند الصرف"
            helpText="تاريخ تحرير السند وصرف المبلغ (افتراضياً اليوم، أو اختر تاريخاً سابقاً)"
          />

          {/* Withdrawal Type & Receipt Number Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">نوع السحب / بند القيد *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-amber-400 transition-all"
              >
                <option value="PROFIT_WITHDRAWAL">سحب أرباح شركة متحققة</option>
                <option value="CAPITAL_WITHDRAWAL">سحب جزئي من رأس المال المودع</option>
                <option value="GENERAL_WITHDRAWAL">سحب سيولة نقدية عامة</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">رقم سند الصرف</label>
              <input
                type="text"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs focus:outline-none focus:border-amber-400 transition-all"
                placeholder="رقم السند..."
              />
            </div>
          </div>

          {/* Purpose / Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">البيان / سبب الصرف (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-medium focus:outline-none focus:border-amber-400 transition-all"
              placeholder="اكتب بيان سند الصرف أو سبب السحب..."
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isExcess || amountIQD <= 0}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تسجيل وصرف السند...</span>
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>تأكيد وصرف السند النقدي</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
