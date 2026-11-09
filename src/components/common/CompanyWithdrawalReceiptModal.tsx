'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  Copy,
  Check,
  Building2,
  Wallet,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowDownLeft,
  FileCheck,
  Share2
} from 'lucide-react';
import { tafqeetIQD } from '@/utils/tafqeet';
import { formatTime } from '@/utils/formatters';
import { CompanyReportProfile, DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';

export interface CompanyWithdrawalReceiptData {
  referenceNo: string;
  date: string;
  time?: string;
  amountIQD: number;
  recipientName: string;
  type: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
  previousBalance: number;
  newBalance: number;
  notes?: string;
  recordedBy?: string;
}

interface CompanyWithdrawalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: CompanyWithdrawalReceiptData | null;
  companyProfile?: CompanyReportProfile;
  store?: any;
}

export const CompanyWithdrawalReceiptModal: React.FC<CompanyWithdrawalReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  companyProfile,
  store
}) => {
  const profile: CompanyReportProfile = useMemo(() => {
    if (companyProfile) return companyProfile;
    if (store?.companyProfile) return store.companyProfile;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('aman_finance_live_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.companyProfile) return parsed.companyProfile;
        }
      } catch {}
    }
    return DEFAULT_COMPANY_REPORT_PROFILE;
  }, [companyProfile, store?.companyProfile]);

  const [copied, setCopied] = useState(false);

  if (!isOpen || !receipt) return null;

  const formattedAmount = receipt.amountIQD.toLocaleString('en-US');
  const tafqeetText = tafqeetIQD(receipt.amountIQD);
  const timeFormatted =
    receipt.time ||
    formatTime(new Date(), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  const dateFormatted = receipt.date || new Date().toISOString().split('T')[0];

  const typeLabel =
    receipt.type === 'PROFIT_WITHDRAWAL'
      ? 'سحب أرباح شركة متحققة'
      : receipt.type === 'CAPITAL_WITHDRAWAL'
      ? 'سحب جزئي من رأس المال'
      : 'سحب سيولة نقدية عامة';

  const handleCopySummary = () => {
    const text = `
📜 *سند صرف نقدي - خزينة ${profile.companyName}*
━━━━━━━━━━━━━━━━━━━━
▫️ *رقم السند:* ${receipt.referenceNo}
▫️ *التاريخ والوقت:* ${dateFormatted} | ${timeFormatted}
▫️ *يُصرف للسيد / الجهة:* ${receipt.recipientName}
▫️ *مبلغ الصرف:* ${formattedAmount} د.ع
▫️ *فقط وقدره:* ${tafqeetText}
▫️ *بند القيد / النوع:* ${typeLabel}
▫️ *الرصيد المتبقي بالخزينة:* ${receipt.newBalance.toLocaleString('en-US')} د.ع
▫️ *البيان:* ${receipt.notes || 'سحب نقدي من صندوق الشركة الرئيسي'}
━━━━━━━━━━━━━━━━━━━━
🏢 *${profile.companyName} - ${profile.companyAddress}*
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Modal Top Actions Header (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">سند صرف نقدي رسمي معتمد</h2>
              <p className="text-xs text-slate-400 font-mono">رقم السند: {receipt.referenceNo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
              title="نسخ ملخص السند"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة السند</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PRINTABLE RECEIPT CONTENT (Stylized for screen and clean white on print) */}
        {/* ========================================================================= */}
        <div id="company-withdrawal-voucher" className="p-6 sm:p-8 space-y-6 bg-slate-900 text-slate-100 print:bg-white print:text-black print:p-6 print:m-0">
          {/* Company Brand Header */}
          <div className="border-b-2 border-amber-500/30 print:border-black pb-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-amber-400 print:text-black" />
                  <span className="text-xl font-black tracking-tight text-white print:text-black">{profile.companyName}</span>
                </div>
                <p className="text-xs text-slate-400 print:text-gray-600 font-semibold">
                  {profile.companyAddress} | {profile.companyActivity}
                </p>
                <div className="inline-block px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 print:bg-gray-100 print:border-black print:text-black text-[11px] font-bold mt-1">
                  صندوق نظام أمان الرئيسي (الخزينة المركزية)
                </div>
              </div>

              <div className="text-left font-mono space-y-1">
                <div className="inline-block px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 print:bg-gray-100 print:border-black print:text-black text-amber-400 font-black text-sm">
                  سند صرف نقدي
                </div>
                <div className="text-xs text-slate-400 print:text-gray-700">
                  <span className="block font-bold text-slate-300 print:text-black">{receipt.referenceNo}</span>
                  <span className="block text-[11px]">{dateFormatted} - {timeFormatted}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Amount Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-950 border-2 border-amber-500/40 print:bg-gray-50 print:border-black text-center space-y-2">
            <span className="text-xs font-bold text-amber-400 print:text-gray-700 block">المبلغ المصروف نقداً</span>
            <div className="text-3xl sm:text-4xl font-black text-white print:text-black font-mono tracking-tight">
              {formattedAmount} <span className="text-lg font-bold text-amber-400 print:text-black">دينار عراقي</span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-300 print:text-gray-800 bg-slate-900/60 print:bg-white p-2 rounded-xl border border-slate-800 print:border-gray-300">
              فقط وقدره: <span className="text-amber-300 print:text-black font-bold">{tafqeetText}</span>
            </div>
          </div>

          {/* Details Table */}
          <div className="rounded-2xl border border-slate-800 print:border-black overflow-hidden bg-slate-950/40 print:bg-transparent">
            <table className="w-full text-right text-xs sm:text-sm divide-y divide-slate-800 print:divide-black">
              <tbody>
                <tr className="divide-x divide-x-reverse divide-slate-800 print:divide-black">
                  <td className="p-3.5 bg-slate-900/80 print:bg-gray-100 font-bold text-slate-400 print:text-gray-700 w-1/3">
                    يُصرف للسيد / الجهة:
                  </td>
                  <td className="p-3.5 font-black text-white print:text-black text-sm sm:text-base">
                    {receipt.recipientName}
                  </td>
                </tr>

                <tr className="divide-x divide-x-reverse divide-slate-800 print:divide-black">
                  <td className="p-3.5 bg-slate-900/80 print:bg-gray-100 font-bold text-slate-400 print:text-gray-700">
                    الصندوق المصروف منه:
                  </td>
                  <td className="p-3.5 font-bold text-emerald-400 print:text-black">
                    صندوق نظام أمان الرئيسي
                  </td>
                </tr>

                <tr className="divide-x divide-x-reverse divide-slate-800 print:divide-black">
                  <td className="p-3.5 bg-slate-900/80 print:bg-gray-100 font-bold text-slate-400 print:text-gray-700">
                    نوع السحب / بند القيد:
                  </td>
                  <td className="p-3.5 font-bold text-slate-200 print:text-black">
                    {typeLabel}
                  </td>
                </tr>

                {receipt.notes && (
                  <tr className="divide-x divide-x-reverse divide-slate-800 print:divide-black">
                    <td className="p-3.5 bg-slate-900/80 print:bg-gray-100 font-bold text-slate-400 print:text-gray-700">
                      البيان والغرض:
                    </td>
                    <td className="p-3.5 text-slate-300 print:text-gray-900 font-medium">
                      {receipt.notes}
                    </td>
                  </tr>
                )}

                <tr className="divide-x divide-x-reverse divide-slate-800 print:divide-black">
                  <td className="p-3.5 bg-slate-900/80 print:bg-gray-100 font-bold text-slate-400 print:text-gray-700">
                    السيولة المتبقية بالخزينة:
                  </td>
                  <td className="p-3.5 font-mono font-bold text-slate-300 print:text-black">
                    {receipt.newBalance.toLocaleString('en-US')} د.ع
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Official Signatures Section */}
          <div className="pt-6 border-t border-slate-800 print:border-black grid grid-cols-3 gap-4 text-center text-xs">
            <div className="space-y-8">
              <span className="block font-bold text-slate-400 print:text-gray-700">أمين الخزينة والصندوق</span>
              <div className="border-b border-dashed border-slate-700 print:border-black w-24 mx-auto" />
              <span className="block text-[11px] text-slate-500 print:text-gray-500">التوقيع والختم</span>
            </div>

            <div className="space-y-8">
              <span className="block font-bold text-slate-400 print:text-gray-700">المدير العام / المسؤول المالي</span>
              <div className="border-b border-dashed border-slate-700 print:border-black w-24 mx-auto" />
              <span className="block text-[11px] text-slate-500 print:text-gray-500">{profile.managerName || 'أحمد إياد'}</span>
            </div>

            <div className="space-y-8">
              <span className="block font-bold text-slate-400 print:text-gray-700">توقيع المستلم نقداً</span>
              <div className="border-b border-dashed border-slate-700 print:border-black w-24 mx-auto" />
              <span className="block text-[11px] text-slate-500 print:text-gray-500">{receipt.recipientName}</span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-4 text-center text-[10px] text-slate-500 print:text-gray-400 border-t border-slate-800/40 print:border-gray-200">
            سند صرف نقدي معتمد صادر من المنظومة المحاسبية لـ {profile.companyName} - {profile.companyAddress} | تم تحرير السند بواسطة: {receipt.recordedBy || profile.managerName || 'مدير النظام'}
          </div>
        </div>
      </div>
    </div>
  );
};
