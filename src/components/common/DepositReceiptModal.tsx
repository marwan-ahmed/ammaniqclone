'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  Copy,
  Check,
  Building2,
  Wallet,
  ShieldCheck,
  Clock,
  Calendar,
  Layers,
  TrendingUp,
  FileCheck,
  Receipt,
  Share2
} from 'lucide-react';
import { tafqeetIQD } from '@/utils/tafqeet';
import { formatTime } from '@/utils/formatters';
import { CompanyReportProfile, DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';

export interface DepositReceiptData {
  referenceNo: string;
  date: string;
  time?: string;
  walletId: string;
  walletName: string;
  ownerType: 'COMPANY' | 'INVESTOR';
  investorName?: string;
  depositorName?: string;
  amountIQD: number;
  previousBalance?: number;
  newBalance?: number;
  notes?: string;
  paymentMethod?: string;
  recordedBy?: string;
}

interface DepositReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: DepositReceiptData | null;
  companyProfile?: CompanyReportProfile;
  store?: any;
}

export const DepositReceiptModal: React.FC<DepositReceiptModalProps> = ({
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const depositorDisplay =
    receipt.depositorName ||
    (receipt.ownerType === 'INVESTOR'
      ? receipt.investorName || receipt.walletName
      : `إدارة ${profile.companyName} (تغذية رأس المال الرئيسي)`);

  const previousBalanceFormatted =
    receipt.previousBalance !== undefined
      ? `${receipt.previousBalance.toLocaleString('en-US')} د.ع`
      : '—';

  const newBalanceFormatted =
    receipt.newBalance !== undefined
      ? `${receipt.newBalance.toLocaleString('en-US')} د.ع`
      : receipt.previousBalance !== undefined
      ? `${(receipt.previousBalance + receipt.amountIQD).toLocaleString('en-US')} د.ع`
      : '—';

  // Copy Receipt Text Summary to Clipboard
  const handleCopySummary = () => {
    const text = `
📜 *سند إيداع وقبض رأس مال - ${profile.companyName}*
━━━━━━━━━━━━━━━━━━━━
▫️ *رقم السند:* ${receipt.referenceNo}
▫️ *التاريخ والوقت:* ${dateFormatted} | ${timeFormatted}
▫️ *المودع / الجهة:* ${depositorDisplay}
▫️ *الصندوق المستفيد:* ${receipt.walletName}
▫️ *مبلغ الإيداع:* ${formattedAmount} د.ع
▫️ *التفقيط:* ${tafqeetText}
▫️ *الرصيد بعد الإيداع:* ${newBalanceFormatted}
▫️ *البيان:* ${receipt.notes || 'إيداع وتغذية رأس مال نقدي'}
━━━━━━━━━━━━━━━━━━━━
🏢 *${profile.companyName} - ${profile.companyAddress}*
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Generate HTML for a single receipt copy
  const generateReceiptHTML = (copyLabel: string = 'النسخة الأصلية (المودع)') => {
    return `
      <div class="receipt-box">
        <!-- Header Strip -->
        <div class="receipt-header">
          <div class="header-right">
            <h2 class="company-title">${profile.companyName}</h2>
            <p class="company-sub">${profile.companyActivity}</p>
            <p class="company-contact">العنوان: ${profile.companyAddress}${profile.companyPhone ? ` | هاتف الحسابات: ${profile.companyPhone}` : ''}</p>
          </div>
          <div class="header-center">
            <div class="voucher-badge">
              <span class="badge-title">سند قبض نقدي / إيداع رأس مال</span>
              <span class="badge-sub">CAPITAL DEPOSIT RECEIPT</span>
            </div>
            <div class="copy-note">${copyLabel}</div>
          </div>
          <div class="header-left">
            <div class="meta-row"><span class="meta-lbl">رقم السند:</span> <strong class="meta-val mono">${receipt.referenceNo}</strong></div>
            <div class="meta-row"><span class="meta-lbl">التاريخ:</span> <span class="meta-val mono">${dateFormatted}</span></div>
            <div class="meta-row"><span class="meta-lbl">الوقت:</span> <span class="meta-val mono">${timeFormatted}</span></div>
          </div>
        </div>

        <!-- Verification Banner -->
        <div class="status-strip">
          <span>✓ سند مالي رسمي مقيد ومطابق دفترياً وموثق برمجياً في قاعدة البيانات</span>
          <span class="mono">VERIFIED TRANSACTION</span>
        </div>

        <!-- Details Grid -->
        <table class="details-table">
          <tr>
            <td class="lbl-col" style="width: 20%;">استلمنا من السيد / الجهة:</td>
            <td class="val-col highlight-text" style="width: 45%;">${depositorDisplay}</td>
            <td class="lbl-col" style="width: 15%;">طريقة الدفع:</td>
            <td class="val-col" style="width: 20%;">${receipt.paymentMethod || 'نقداً (صندوق كاش)'}</td>
          </tr>
          <tr>
            <td class="lbl-col">لحساب الصندوق المالي:</td>
            <td class="val-col font-bold">${receipt.walletName} (${receipt.ownerType === 'COMPANY' ? 'صندوق الشركة العام' : 'محفظة مستثمر مستقلة'})</td>
            <td class="lbl-col">رقم الحساب:</td>
            <td class="val-col mono">${receipt.walletId}</td>
          </tr>
          <tr>
            <td class="lbl-col">مبلغ الإيداع بالأرقام:</td>
            <td class="val-col amount-highlight mono" colspan="3">
              <span class="iqd-amount">${formattedAmount}</span> <span class="currency">دينار عراقي (IQD)</span>
            </td>
          </tr>
          <tr>
            <td class="lbl-col">المبلغ كتابةً وتفقيطاً:</td>
            <td class="val-col tafqeet-text" colspan="3">${tafqeetText}</td>
          </tr>
          <tr>
            <td class="lbl-col">البيان والملاحظات:</td>
            <td class="val-col notes-text" colspan="3">${receipt.notes || 'تغذية وإيداع رأس مال جديد نقداً في الصندوق المالي'}</td>
          </tr>
        </table>

        <!-- Balances Summary Bar -->
        <div class="balances-bar">
          <div class="bal-item">
            <span class="bal-lbl">الرصيد السابق:</span>
            <span class="bal-val mono">${previousBalanceFormatted}</span>
          </div>
          <div class="bal-item center">
            <span class="bal-lbl">مبلغ الإيداع الحالي:</span>
            <span class="bal-val plus mono">+${formattedAmount} د.ع</span>
          </div>
          <div class="bal-item">
            <span class="bal-lbl">الرصيد الإجمالي بعد الإيداع:</span>
            <span class="bal-val total mono">${newBalanceFormatted}</span>
          </div>
        </div>

        <!-- Footer Signatures & Disclaimer -->
        <div class="receipt-footer">
          <div class="legal-notice">
            <p>• الخطأ والسهو مرجوع للطرفين. يعتبر هذا الوصل سنداً مالياً رسمياً لإثبات استلام النقدية وإيداعها.</p>
            <p>• منظم السند: قسم الحسابات والمالية (${receipt.recordedBy || 'المحاسب المسؤول'})</p>
          </div>

          <div class="signatures-grid">
            <div class="sig-box">
              <span>توقيع المودع / المسلّم:</span>
              <div class="sig-line">...................................</div>
            </div>
            <div class="sig-box">
              <span>توقيع أمين الصندوق / المستلم:</span>
              <div class="sig-line">...................................</div>
            </div>
            <div class="sig-box seal-area">
              <span>ختم واعتماد الإدارة المالية:</span>
              <div class="sig-line">...................................</div>
            </div>
          </div>

          <div class="barcode-strip">
            <span class="barcode mono">||| |||| | ||||| || |||| |||</span>
            <span class="barcode-text mono">AUTH-${receipt.referenceNo}-${Date.now().toString().slice(-4)}</span>
          </div>
        </div>
      </div>
    `;
  };

  // Handle Isolated Iframe Printing
  const handlePrint = (copies: number = 1) => {
    const existingIframe = document.getElementById('print-deposit-receipt-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'print-deposit-receipt-iframe';
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

    const copiesHTML =
      copies === 2
        ? `
          <div class="two-copies-page">
            ${generateReceiptHTML('نسخة المودع / المستثمر (Original)')}
            <div class="cut-divider">
              <span>✂----------------- خط قطع أصولي بين النسختين -----------------✂</span>
            </div>
            ${generateReceiptHTML('نسخة الحسابات والإدارة (Accounting Copy)')}
          </div>
        `
        : generateReceiptHTML('النسخة الأصلية المعتمدة');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>سند قبض - ${receipt.referenceNo}</title>
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
          .two-copies-page {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .cut-divider {
            text-align: center;
            font-size: 9px;
            color: #64748b;
            margin: 4px 0;
            letter-spacing: 1px;
          }
          .receipt-box {
            border: 2px solid #0f172a;
            border-radius: 8px;
            padding: 12px 14px;
            background: #ffffff;
            position: relative;
          }
          .receipt-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .header-right {
            flex: 1.2;
          }
          .company-title {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
          }
          .company-sub {
            font-size: 9.5px;
            color: #334155;
            font-weight: bold;
            margin-top: 2px;
          }
          .company-contact {
            font-size: 8.5px;
            color: #64748b;
            margin-top: 2px;
          }
          .header-center {
            flex: 1.2;
            text-align: center;
          }
          .voucher-badge {
            display: inline-block;
            border: 1.5px solid #0f172a;
            background: #f8fafc;
            padding: 4px 12px;
            border-radius: 6px;
          }
          .badge-title {
            display: block;
            font-size: 13px;
            font-weight: 900;
            color: #0f172a;
          }
          .badge-sub {
            display: block;
            font-size: 7.5px;
            letter-spacing: 1px;
            color: #475569;
            font-weight: bold;
          }
          .copy-note {
            font-size: 8.5px;
            font-weight: bold;
            color: #0284c7;
            margin-top: 3px;
          }
          .header-left {
            flex: 1;
            text-align: left;
            font-size: 9px;
            background: #f1f5f9;
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .meta-lbl {
            color: #475569;
            font-weight: bold;
          }
          .meta-val {
            font-weight: bold;
            color: #0f172a;
          }
          .status-strip {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            color: #065f46;
            font-size: 8.5px;
            font-weight: bold;
            padding: 3px 8px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            font-size: 10.5px;
          }
          .details-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 7px;
          }
          .lbl-col {
            background: #f8fafc;
            font-weight: bold;
            color: #334155;
          }
          .val-col {
            color: #0f172a;
          }
          .highlight-text {
            font-weight: 900;
            font-size: 11px;
            color: #0f172a;
          }
          .amount-highlight {
            background: #f0fdf4 !important;
            padding: 6px 8px !important;
          }
          .iqd-amount {
            font-size: 15px;
            font-weight: 900;
            color: #15803d;
          }
          .currency {
            font-size: 10px;
            font-weight: bold;
            color: #166534;
            margin-right: 4px;
          }
          .tafqeet-text {
            font-weight: bold;
            color: #1e293b;
            background: #fafafa;
          }
          .notes-text {
            color: #475569;
            font-style: italic;
          }
          .balances-bar {
            display: flex;
            justify-content: space-between;
            background: #f8fafc;
            border: 1px dashed #94a3b8;
            border-radius: 6px;
            padding: 5px 10px;
            margin-bottom: 8px;
            font-size: 9.5px;
          }
          .bal-item {
            display: flex;
            flex-direction: column;
            gap: 1px;
          }
          .bal-lbl {
            color: #64748b;
            font-weight: bold;
          }
          .bal-val {
            font-weight: bold;
            color: #0f172a;
          }
          .bal-val.plus {
            color: #16a34a;
            font-weight: 900;
          }
          .bal-val.total {
            color: #0284c7;
            font-weight: 900;
          }
          .receipt-footer {
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
          }
          .legal-notice {
            font-size: 8px;
            color: #64748b;
            margin-bottom: 8px;
            line-height: 1.3;
          }
          .signatures-grid {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 6px;
          }
          .sig-box {
            flex: 1;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            padding: 5px 8px;
            border-radius: 4px;
            text-align: center;
            font-size: 8.5px;
            font-weight: bold;
            color: #334155;
          }
          .sig-line {
            margin-top: 14px;
            color: #94a3b8;
            font-size: 8px;
          }
          .barcode-strip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dotted #e2e8f0;
            padding-top: 4px;
            font-size: 8px;
            color: #64748b;
          }
          .barcode {
            font-size: 11px;
            letter-spacing: 2px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        ${copiesHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Dialog Bar */}
        <div className="p-4 sm:p-5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">سند قبض وإيداع رأس مال رسمي</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  تم التوثيق بنجاح
                </span>
              </div>
              <p className="text-xs text-slate-400">
                تم اعتماد الإيداع وتقييد الحركة في الصندوق المالي وقاعدة البيانات
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: High Fidelity Printable Voucher Preview */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs bg-slate-950/50">
          {/* Paper Sheet Preview */}
          <div className="bg-white text-slate-900 rounded-2xl p-5 sm:p-6 border-2 border-slate-300 shadow-xl space-y-4 font-sans relative overflow-hidden">
            {/* Watermark effect */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
              <span className="text-7xl font-black text-slate-900 rotate-[-25deg]">
                AMAN SYSTEM
              </span>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-slate-900 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">{profile.companyName}</h2>
                <p className="text-[11px] font-bold text-slate-700">{profile.companyActivity}</p>
                <p className="text-[10px] text-slate-500">{profile.companyAddress}{profile.companyPhone ? ` • هاتف الحسابات: ${profile.companyPhone}` : ''}</p>
              </div>

              <div className="text-center sm:text-left bg-slate-100 p-2.5 rounded-xl border border-slate-300 w-full sm:w-auto">
                <span className="block text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-md border border-emerald-300">
                  سند قبض نقدي / إيداع رأس مال
                </span>
                <div className="text-[10px] font-mono font-bold text-slate-700 mt-1 flex sm:flex-col justify-between sm:justify-start">
                  <span>سند رقم: <strong className="text-slate-950 font-black">{receipt.referenceNo}</strong></span>
                  <span className="sm:mt-0.5">{dateFormatted} | {timeFormatted}</span>
                </div>
              </div>
            </div>

            {/* Status Strip */}
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                سند رسمي معتمد ومقيد في سجل الحسابات المالية
              </span>
              <span className="font-mono text-[10px] text-emerald-700">AUTH: VERIFIED</span>
            </div>

            {/* Main Details Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden text-[11.5px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 bg-slate-50/70 border-b border-slate-200 p-2.5">
                <div className="space-y-0.5">
                  <span className="text-slate-500 text-[10px] block">استلمنا من السيد / الجهة:</span>
                  <span className="font-black text-slate-900 text-xs block">{depositorDisplay}</span>
                </div>
                <div className="space-y-0.5 pt-1.5 sm:pt-0 sm:pr-3">
                  <span className="text-slate-500 text-[10px] block">لحساب الصندوق المالي:</span>
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                    {receipt.ownerType === 'COMPANY' ? <Building2 className="w-3.5 h-3.5 text-blue-600" /> : <Wallet className="w-3.5 h-3.5 text-indigo-600" />}
                    {receipt.walletName}
                  </span>
                </div>
              </div>

              {/* Amount Highlight Box */}
              <div className="p-3 bg-emerald-50/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-slate-600 text-[10px] font-bold block">مبلغ الإيداع المقبوض:</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-emerald-700 font-mono tracking-tight">
                      {formattedAmount}
                    </span>
                    <span className="text-xs font-bold text-emerald-800">دينار عراقي (IQD)</span>
                  </div>
                </div>

                <div className="sm:text-left bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block font-semibold">طريقة التحصيل:</span>
                  <span className="font-bold text-slate-800 text-[11px]">{receipt.paymentMethod || 'نقداً (صندوق كاش)'}</span>
                </div>
              </div>

              {/* Tafqeet in Words */}
              <div className="p-2.5 bg-slate-50 border-b border-slate-200">
                <span className="text-slate-500 text-[10px] block">المبلغ كتابةً وتفقيطاً:</span>
                <span className="font-black text-slate-900 text-xs mt-0.5 block">{tafqeetText}</span>
              </div>

              {/* Notes */}
              <div className="p-2.5">
                <span className="text-slate-500 text-[10px] block">البيان وملاحظات السند:</span>
                <span className="text-slate-700 text-xs block mt-0.5">
                  {receipt.notes || 'تغذية وإيداع رأس مال جديد نقداً في الصندوق المالي'}
                </span>
              </div>
            </div>

            {/* Balances Breakdown */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[10.5px]">
              <div>
                <span className="text-slate-500 text-[10px] block font-medium">الرصيد السابق:</span>
                <span className="font-mono font-bold text-slate-700 block">{previousBalanceFormatted}</span>
              </div>
              <div className="text-center border-x border-slate-200 px-1">
                <span className="text-slate-500 text-[10px] block font-medium">مبلغ الإيداع:</span>
                <span className="font-mono font-black text-emerald-600 block">+{formattedAmount} د.ع</span>
              </div>
              <div className="text-left">
                <span className="text-slate-500 text-[10px] block font-medium">الرصيد بعد الإيداع:</span>
                <span className="font-mono font-black text-blue-700 block">{newBalanceFormatted}</span>
              </div>
            </div>

            {/* Signatures & Stamps */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex justify-between text-[9px] text-slate-500 font-medium">
                <span>الخطأ والسهو مرجوع للطرفين</span>
                <span>منظم السند: قسم الحسابات والمالية</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-700 font-bold">
                <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                  <span>توقيع المودع:</span>
                  <div className="h-8 border-b border-dotted border-slate-400 mt-2" />
                </div>
                <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                  <span>أمين الصندوق:</span>
                  <div className="h-8 border-b border-dotted border-slate-400 mt-2" />
                </div>
                <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                  <span>ختم الإدارة المالية:</span>
                  <div className="h-8 border-b border-dotted border-slate-400 mt-2" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم نسخ التفاصيل' : 'نسخ السند'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint(2)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700"
              title="طباعة نسختين على ورقة A4 واحدة (نسخة للعميل + نسخة للإدارة)"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>طباعة نسختين (A4)</span>
            </button>

            <button
              onClick={() => handlePrint(1)}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السند الفورية (A5)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
