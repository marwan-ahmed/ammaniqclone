'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  Building2,
  Wallet,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowDownLeft,
  FileCheck,
  Share2,
  Receipt,
  UserCheck
} from 'lucide-react';
import { tafqeetIQD } from '@/utils/tafqeet';
import { formatIQD, formatTime } from '@/utils/formatters';
import { CompanyReportProfile, DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';

export interface InvestorWithdrawalReceiptData {
  receiptNo: string; // Sequential receipt number starting from 1, 2, 3, 4...
  date: string;
  time?: string;
  investorId: string;
  investorName: string;
  investorPhone?: string;
  investorAddress?: string;
  walletName: string;
  amountIQD: number;
  type: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL' | 'COMMISSION_WITHDRAWAL';
  previousBalance: number;
  newBalance: number;
  totalCapitalDeposited?: number;
  investorSharePercent?: number;
  notes?: string;
  recordedBy?: string;
}

interface InvestorWithdrawalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: InvestorWithdrawalReceiptData | null;
  companyProfile?: CompanyReportProfile;
  store?: any;
}

export const InvestorWithdrawalReceiptModal: React.FC<InvestorWithdrawalReceiptModalProps> = ({
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
  const [printCopies, setPrintCopies] = useState<1 | 2>(1);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !receipt) return null;

  const formattedAmount = formatIQD(receipt.amountIQD);
  const tafqeetText = tafqeetIQD(receipt.amountIQD);
  const timeFormatted =
    receipt.time ||
    formatTime(new Date(), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  const dateFormatted = receipt.date || new Date().toISOString().split('T')[0];

  const isBrokerCommission = receipt.type === 'COMMISSION_WITHDRAWAL';
  const typeLabel =
    receipt.type === 'COMMISSION_WITHDRAWAL'
      ? 'سحب عمولات إحالة واستقطاب'
      : receipt.type === 'PROFIT_WITHDRAWAL'
      ? 'سحب أرباح استثمارية متحققة'
      : receipt.type === 'CAPITAL_WITHDRAWAL'
      ? 'سحب جزئي من رأس المال المودع'
      : 'سحب سيولة نقدية عامة';

  const handleCopySummary = () => {
    const text = `
📜 *${isBrokerCommission ? 'سند صرف عمولة وسيط إحالة نقداً' : 'سند صرف نقدي للمستثمر'} - ${profile.companyName}*
━━━━━━━━━━━━━━━━━━━━
▫️ *رقم الوصل:* ${receipt.receiptNo}
▫️ *التاريخ والوقت:* ${dateFormatted} | ${timeFormatted}
▫️ *${isBrokerCommission ? 'الوسيط المستلم' : 'المستثمر المستلم'}:* ${receipt.investorName}
▫️ *المحفظة / الصندوق:* ${receipt.walletName}
▫️ *المبلغ المصروف:* ${formattedAmount} د.ع
▫️ *فقط وقدره:* ${tafqeetText}
▫️ *نوع السحب:* ${typeLabel}
▫️ *الرصيد السابق:* ${formatIQD(receipt.previousBalance)} د.ع
▫️ *الرصيد المتبقي بالصندوق:* ${formatIQD(receipt.newBalance)} د.ع
▫️ *البيان:* ${receipt.notes || (isBrokerCommission ? 'سحب نقدي من عمولات الإحالة' : 'سحب نقدي من محفظة المستثمر')}
━━━━━━━━━━━━━━━━━━━━
🏢 *${profile.companyName} - ${profile.companyAddress}*
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Generate Isolated HTML for A5 or A4 (2 copies) Printing
  const generateReceiptHTML = (copyBadgeTitle: string = 'النسخة الأصلية') => `
    <div class="a5-receipt-card">
      <!-- Header -->
      <div class="receipt-header">
        <div class="company-brand">
          <div class="company-title">
            <span class="logo-text">${profile.companyName}</span>
          </div>
          <p class="company-subtitle">${profile.companyAddress} | ${profile.companyActivity}</p>
          <div class="wallet-badge">${receipt.walletName}</div>
        </div>

        <div class="voucher-meta">
          <div class="voucher-title-pill">${isBrokerCommission ? 'سند صرف عمولة وسيط إحالة نقداً' : 'سند صرف نقدي للمستثمر'}</div>
          <div class="voucher-number">وصل رقم: <strong>#${receipt.receiptNo}</strong></div>
          <div class="voucher-datetime">${dateFormatted} • ${timeFormatted}</div>
          <div class="copy-tag">${copyBadgeTitle}</div>
        </div>
      </div>

      <!-- Amount Highlight Box -->
      <div class="amount-box">
        <div class="amount-label">${isBrokerCommission ? 'المبلغ المصروف نقداً لعمولة الوسيط' : 'المبلغ المصروف نقداً للمستثمر'}</div>
        <div class="amount-val mono">${formattedAmount} <span>دينار عراقي</span></div>
        <div class="amount-words">فقط وقدره: <strong>${tafqeetText}</strong></div>
      </div>

      <!-- Financial & Beneficiary Details Table -->
      <table class="details-table">
        <tbody>
          <tr>
            <td class="lbl">${isBrokerCommission ? 'يُصرف للسيد الوسيط / المحيل:' : 'يُصرف للسيد المستثمر:'}</td>
            <td class="val bold primary-text">
              ${receipt.investorName}
              ${receipt.investorPhone ? `<span class="meta-inline">(هاتف: ${receipt.investorPhone})</span>` : ''}
            </td>
            <td class="lbl">نوع السحب / بند القيد:</td>
            <td class="val bold">${typeLabel}</td>
          </tr>
          <tr>
            <td class="lbl">الصندوق المصروف منه:</td>
            <td class="val">${receipt.walletName}</td>
            <td class="lbl">المبلغ المصروف:</td>
            <td class="val mono bold">${formattedAmount} د.ع</td>
          </tr>
          <tr>
            <td class="lbl">رصيد الصندوق قبل السحب:</td>
            <td class="val mono">${formatIQD(receipt.previousBalance)} د.ع</td>
            <td class="lbl">السيولة المتبقية بعد السحب:</td>
            <td class="val mono bold highlight">${formatIQD(receipt.newBalance)} د.ع</td>
          </tr>
          ${
            receipt.notes
              ? `<tr>
                  <td class="lbl">البيان والملاحظات:</td>
                  <td class="val" colspan="3">${receipt.notes}</td>
                </tr>`
              : ''
          }
        </tbody>
      </table>

      <!-- Official Signatures -->
      <div class="signatures-wrapper">
        <div class="sig-column">
          <span class="sig-title">أمين الصندوق / المسلّم</span>
          <div class="sig-dash"></div>
          <span class="sig-sub">التوقيع والختم</span>
        </div>

        <div class="sig-column">
          <span class="sig-title">الإدارة والتدقيق المالي</span>
          <div class="sig-dash"></div>
          <span class="sig-sub">${receipt.recordedBy || 'أحمد إياد'}</span>
        </div>

        <div class="sig-column">
          <span class="sig-title">${isBrokerCommission ? 'الوسيط المستلم نقداً' : 'المستثمر المستلم نقداً'}</span>
          <div class="sig-dash"></div>
          <span class="sig-sub">${receipt.investorName}</span>
        </div>
      </div>

      <!-- Legal & Security Barcode Strip -->
      <div class="footer-strip">
        <span>سند صرف نقدي معتمد صادر من المنظومة المحاسبية لـ ${profile.companyName} - ${profile.companyAddress}</span>
        <span class="mono barcode-text">AUTH-WTH-${receipt.receiptNo}-${Date.now().toString().slice(-4)}</span>
      </div>
    </div>
  `;

  const handlePrint = (copies: 1 | 2 = printCopies) => {
    const existingIframe = document.getElementById('print-investor-withdrawal-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'print-investor-withdrawal-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const contentHTML =
      copies === 2
        ? `
          <div class="two-copies-wrapper">
            ${generateReceiptHTML('نسخة المستثمر (Original)')}
            <div class="scissors-divider">
              <span>✂----------------- خط قطع أصولي بين النسختين (نصف ورقة A4 = A5) -----------------✂</span>
            </div>
            ${generateReceiptHTML('نسخة الإدارة المالية والحسابات (Copy)')}
          </div>
        `
        : generateReceiptHTML('النسخة الأصلية المعتمدة (A5)');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${isBrokerCommission ? 'سند صرف عمولة وسيط إحالة' : 'سند صرف نقدي للمستثمر'} - وصل رقم ${receipt.receiptNo}</title>
        <style>
          @page {
            size: ${copies === 2 ? 'A4 portrait' : 'A5 landscape'};
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #ffffff;
            color: #0f172a;
            direction: rtl;
            text-align: right;
            padding: 4px;
            font-size: 11px;
            line-height: 1.4;
          }
          .mono {
            font-family: 'Courier New', Courier, monospace, sans-serif;
          }
          .two-copies-wrapper {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .scissors-divider {
            text-align: center;
            font-size: 9px;
            font-weight: bold;
            color: #64748b;
            padding: 4px 0;
            border-top: 1px dashed #94a3b8;
            border-bottom: 1px dashed #94a3b8;
            margin: 2px 0;
          }
          .a5-receipt-card {
            border: 2px solid #0f172a;
            border-radius: 12px;
            padding: 12px 14px;
            background: #ffffff;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .receipt-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
          }
          .company-title {
            font-size: 17px;
            font-weight: 900;
            color: #0f172a;
          }
          .company-subtitle {
            font-size: 9.5px;
            color: #475569;
            margin-top: 2px;
          }
          .wallet-badge {
            display: inline-block;
            margin-top: 4px;
            padding: 2px 8px;
            border: 1px solid #0f172a;
            border-radius: 6px;
            font-size: 9.5px;
            font-weight: bold;
            background: #f8fafc;
          }
          .voucher-meta {
            text-align: left;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
          }
          .voucher-title-pill {
            background: #0f172a;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 10px;
            border-radius: 6px;
          }
          .voucher-number {
            font-size: 12px;
            color: #0f172a;
            font-family: 'Courier New', Courier, monospace;
          }
          .voucher-datetime {
            font-size: 9px;
            color: #64748b;
          }
          .copy-tag {
            font-size: 8.5px;
            font-weight: bold;
            color: #047857;
            border: 1px solid #047857;
            padding: 1px 6px;
            border-radius: 4px;
            margin-top: 2px;
          }
          .amount-box {
            border: 2px solid #0f172a;
            background: #f8fafc;
            border-radius: 8px;
            padding: 8px;
            text-align: center;
          }
          .amount-label {
            font-size: 10px;
            font-weight: bold;
            color: #475569;
          }
          .amount-val {
            font-size: 22px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .amount-val span {
            font-size: 12px;
            font-weight: bold;
            color: #334155;
          }
          .amount-words {
            font-size: 10px;
            color: #1e293b;
            margin-top: 2px;
            padding-top: 3px;
            border-top: 1px dotted #cbd5e1;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .details-table td {
            padding: 5px 7px;
            border: 1px solid #cbd5e1;
          }
          .details-table td.lbl {
            background: #f1f5f9;
            font-weight: bold;
            color: #334155;
            width: 20%;
            white-space: nowrap;
          }
          .details-table td.val {
            color: #0f172a;
            width: 30%;
          }
          .nowrap {
            white-space: nowrap;
          }
          .details-table td.bold {
            font-weight: bold;
          }
          .details-table td.highlight {
            font-weight: 800;
            color: #047857;
          }
          .meta-inline {
            font-size: 9px;
            font-weight: normal;
            color: #64748b;
            margin-right: 4px;
          }
          .signatures-wrapper {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            text-align: center;
            padding-top: 8px;
            border-top: 1px solid #0f172a;
          }
          .sig-column {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .sig-title {
            font-size: 9.5px;
            font-weight: bold;
            color: #334155;
          }
          .sig-dash {
            border-bottom: 1px dashed #64748b;
            width: 80%;
            margin: 0 auto;
          }
          .sig-sub {
            font-size: 8.5px;
            color: #64748b;
          }
          .footer-strip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
          }
          .barcode-text {
            font-weight: bold;
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        ${contentHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 350);
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-4 text-right">
        {/* Top Control Header (Hidden when printing parent window) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  {isBrokerCommission ? 'وصل صرف عمولة وسيط إحالة' : 'وصل صرف نقدي للمستثمر'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-black border border-amber-500/40">
                  #{receipt.receiptNo}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {isBrokerCommission ? 'الوسيط: ' : 'المستثمر: '}{receipt.investorName} • {dateFormatted}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
              title="نسخ ملخص السند للمستثمر"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>

            <button
              onClick={() => handlePrint(1)}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
              title="طباعة السند بمقاس A5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الوصل (A5)</span>
            </button>

            <button
              onClick={() => handlePrint(2)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
              title="طباعة نسختين (للمستثمر والحسابات) على ورقة A4 واحدة"
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>نسختين (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all mr-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* A5 VISUAL PREVIEW CONTAINER */}
        {/* ========================================================================= */}
        <div className="p-5 sm:p-6 bg-slate-950/60 max-h-[82vh] overflow-y-auto">
          <div className="p-6 sm:p-7 rounded-2xl bg-slate-900 border-2 border-slate-800 shadow-xl space-y-5 text-slate-100">
            {/* Header Brand */}
            <div className="border-b-2 border-amber-500/30 pb-4 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-amber-400" />
                  <span className="text-xl font-black text-white">{profile.companyName}</span>
                </div>
                <p className="text-xs text-slate-400 font-semibold">
                  {profile.companyAddress} | {profile.companyActivity}
                </p>
                <div className="inline-block px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold mt-1">
                  {receipt.walletName}
                </div>
              </div>

              <div className="text-left font-mono space-y-1">
                <div className="inline-block px-3 py-1 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-400 font-black text-sm">
                  {isBrokerCommission ? 'سند صرف عمولة وسيط إحالة نقداً' : 'سند صرف نقدي للمستثمر'}
                </div>
                <div className="text-xs text-slate-400 space-y-0.5">
                  <div className="font-bold text-white font-mono text-sm">
                    وصل رقم: <span className="text-amber-400">#{receipt.receiptNo}</span>
                  </div>
                  <div className="text-[11px]">{dateFormatted} - {timeFormatted}</div>
                </div>
              </div>
            </div>

            {/* Amount Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-950 border-2 border-amber-500/40 text-center space-y-1.5">
              <span className="text-xs font-bold text-amber-400 block">المبلغ المصروف نقداً</span>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {formattedAmount} <span className="text-base sm:text-lg font-bold text-amber-400">د.ع</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-300 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                فقط وقدره: <span className="text-amber-300 font-bold">{tafqeetText}</span>
              </div>
            </div>

            {/* Details Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/60 text-xs sm:text-sm">
              <table className="w-full text-right divide-y divide-slate-800">
                <tbody>
                  <tr className="divide-x divide-x-reverse divide-slate-800">
                    <td className="p-3.5 bg-slate-900/90 font-bold text-slate-400 whitespace-nowrap w-[18%]">
                      {isBrokerCommission ? 'يُصرف للسيد الوسيط / المحيل:' : 'يُصرف للسيد المستثمر:'}
                    </td>
                    <td className="p-3.5 font-black text-white text-sm sm:text-base w-[32%]">
                      {receipt.investorName}
                      {receipt.investorPhone && (
                        <span className="text-xs font-normal text-slate-400 mr-2 font-mono">({receipt.investorPhone})</span>
                      )}
                    </td>
                    <td className="p-3.5 bg-slate-900/90 font-bold text-slate-400 whitespace-nowrap w-[18%]">
                      نوع السحب / بند القيد:
                    </td>
                    <td className="p-3.5 font-bold text-amber-400 whitespace-nowrap w-[32%]">
                      {typeLabel}
                    </td>
                  </tr>

                  <tr className="divide-x divide-x-reverse divide-slate-800">
                    <td className="p-3.5 bg-slate-900/90 font-bold text-slate-400 whitespace-nowrap">
                      الصندوق المصروف منه:
                    </td>
                    <td className="p-3.5 font-bold text-emerald-400 whitespace-nowrap">
                      {receipt.walletName}
                    </td>
                    <td className="p-3.5 bg-slate-900/90 font-bold text-slate-400 whitespace-nowrap">
                      المبلغ المصروف:
                    </td>
                    <td className="p-3.5 font-mono font-black text-white whitespace-nowrap">
                      {formattedAmount} د.ع
                    </td>
                  </tr>

                  <tr className="divide-x divide-x-reverse divide-slate-800">
                    <td className="p-3.5 bg-slate-900/90 font-bold text-slate-400 whitespace-nowrap">
                      الرصيد قبل السحب:
                    </td>
                    <td className="p-3.5 font-mono text-slate-300 whitespace-nowrap">
                      {formatIQD(receipt.previousBalance)} د.ع
                    </td>
                    <td className="p-3.5 bg-slate-900/90 font-bold text-slate-400 whitespace-nowrap">
                      السيولة المتبقية بعد السحب:
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {formatIQD(receipt.newBalance)} د.ع
                    </td>
                  </tr>

                  {receipt.notes && (
                    <tr className="divide-x divide-x-reverse divide-slate-800">
                      <td className="p-3.5 bg-slate-900/90 font-bold text-slate-400 whitespace-nowrap">
                        البيان والملاحظات:
                      </td>
                      <td className="p-3.5 text-slate-200" colSpan={3}>
                        {receipt.notes}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="pt-4 border-t border-slate-800 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="space-y-6">
                <span className="block font-bold text-slate-400">أمين الصندوق / المسلّم</span>
                <div className="border-b border-dashed border-slate-700 w-24 mx-auto" />
                <span className="block text-[11px] text-slate-500">التوقيع والختم</span>
              </div>

              <div className="space-y-6">
                <span className="block font-bold text-slate-400">الإدارة المالية</span>
                <div className="border-b border-dashed border-slate-700 w-24 mx-auto" />
                <span className="block text-[11px] text-slate-500">{receipt.recordedBy || profile.managerName || 'أحمد إياد'}</span>
              </div>

              <div className="space-y-6">
                <span className="block font-bold text-slate-400">
                  {isBrokerCommission ? 'الوسيط المستلم نقداً' : 'المستثمر المستلم نقداً'}
                </span>
                <div className="border-b border-dashed border-slate-700 w-24 mx-auto" />
                <span className="block text-[11px] text-slate-300 font-bold">{receipt.investorName}</span>
              </div>
            </div>

            {/* Footer Bar */}
            <div className="pt-3 text-center text-[10px] text-slate-500 border-t border-slate-800/40 flex items-center justify-between">
              <span>سند رسمي معتمد صادر من {profile.companyName} - ${profile.companyAddress}</span>
              <span className="font-mono text-slate-600">AUTH-WTH-{receipt.receiptNo}</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              إغلاق
            </button>
            <button
              onClick={() => handlePrint(1)}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الوصل الآن</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

