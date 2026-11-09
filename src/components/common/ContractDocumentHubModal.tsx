'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  Calendar,
  DollarSign,
  ShieldCheck,
  Building2,
  User,
  Table as TableIcon,
  Award,
  Layers,
  ChevronLeft,
  Check,
  Receipt,
  Scissors,
  Eye,
  Sparkles
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';
import { InstallmentContract, InstallmentScheduleItem } from '@/types/finance';
import { formatNumber, formatDate } from '@/utils/formatters';

// Helper Tafqeet Function (Arabic Numbers-to-Words for IQD)
export function tafqeetIQD(n: number): string {
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

// Helper to extract or generate clean Arabic integer contract number (pure digits, sequential, no CNT- or prefixes)
export function getContractNumber(c: InstallmentContract | { contractNumber?: string | number }): string {
  if (!c) return '1';
  const raw = c.contractNumber !== undefined && c.contractNumber !== null ? String(c.contractNumber).trim() : '';
  if (!raw) return '1';

  // If already a pure integer (e.g. "1", "2", "3", "123")
  if (/^\d+$/.test(raw)) {
    return raw;
  }

  // Extract trailing numeric sequence from contractNumber (e.g. CNT-2026-6832 -> 6832, CNT-2026-151 -> 151, CNT-2026-1 -> 1)
  const parts = raw.split('-');
  const lastPart = parts[parts.length - 1];
  if (lastPart && /^\d+$/.test(lastPart)) {
    return lastPart;
  }

  const digits = raw.replace(/\D/g, '');
  return digits || '1';
}

// Helper to extract or generate clean Arabic integer invoice number (pure digits, no SP or symbols)
export function getInvoiceNumber(c: InstallmentContract): string {
  if (c.invoiceNumber !== undefined && c.invoiceNumber !== null && String(c.invoiceNumber).trim()) {
    const cleaned = String(c.invoiceNumber).replace(/\D/g, '');
    if (cleaned) return cleaned;
  }
  return getContractNumber(c);
}

export interface InvoiceTableItem {
  index: number;
  itemName: string;
  quantity: number;
  unit: string;
  unitPriceIQD: number;
  totalPriceIQD: number;
}

// Helper to calculate exact installment sales invoice row items (Total = Quantity × Unit Price)
export function getInvoiceTableItem(c: InstallmentContract): InvoiceTableItem {
  const quantity = c.quantity && c.quantity > 0 ? c.quantity : 1;
  const unitPriceIQD = Math.round(c.totalSalePriceIQD / quantity);
  const totalPriceIQD = quantity * unitPriceIQD;
  const rawName = c.inventoryItemName || 'عامة';
  const itemName = rawName.startsWith('بضاعة') ? rawName : `بضاعة ${rawName}`;

  return {
    index: 1,
    itemName,
    quantity,
    unit: 'قطعة',
    unitPriceIQD,
    totalPriceIQD
  };
}

// Helper to extract or generate clean Arabic integer receipt number (pure digits, no SP or symbols, sequential starting from 1)
export function getReceiptNumber(
  sch: InstallmentScheduleItem,
  c?: InstallmentContract,
  store?: SimulationStore
): string {
  // 1. If explicitly stored on the schedule as a number or numeric string
  if (sch.receiptNumber !== undefined && sch.receiptNumber !== null && String(sch.receiptNumber).trim()) {
    const cleaned = String(sch.receiptNumber).replace(/\D/g, '');
    if (cleaned) return cleaned;
  }

  // 2. If store is provided, compute sequential index among all paid schedules in current cycle
  if (store) {
    const epochTime = store.numberingResetEpoch && !isNaN(Date.parse(store.numberingResetEpoch))
      ? new Date(store.numberingResetEpoch).getTime()
      : 0;
    const allPaid: { id: string; paidDate?: string; contractId: string; installmentNumber: number }[] = [];
    if (Array.isArray(store.contracts)) {
      for (const contract of store.contracts) {
        if (Array.isArray(contract.schedules)) {
          for (const s of contract.schedules) {
            if (s.status === 'PAID') {
              const pTime = s.paidDate && !isNaN(Date.parse(s.paidDate)) ? new Date(s.paidDate).getTime() : 0;
              if (pTime >= epochTime) {
                allPaid.push({
                  id: s.id,
                  paidDate: s.paidDate,
                  contractId: s.contractId,
                  installmentNumber: s.installmentNumber
                });
              }
            }
          }
        }
      }
    }
    if (Array.isArray(store.directDebts)) {
      for (const debt of store.directDebts) {
        if (Array.isArray(debt.schedules)) {
          for (const s of debt.schedules) {
            if (s.status === 'PAID') {
              const pTime = s.paidDate && !isNaN(Date.parse(s.paidDate)) ? new Date(s.paidDate).getTime() : 0;
              if (pTime >= epochTime) {
                allPaid.push({
                  id: s.id,
                  paidDate: s.paidDate,
                  contractId: s.contractId,
                  installmentNumber: s.installmentNumber
                });
              }
            }
          }
        }
      }
    }

    allPaid.sort((a, b) => {
      const dateA = a.paidDate || '';
      const dateB = b.paidDate || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      if (a.contractId !== b.contractId) return a.contractId.localeCompare(b.contractId);
      return a.installmentNumber - b.installmentNumber;
    });

    const idx = allPaid.findIndex((item) => item.id === sch.id);
    if (idx !== -1) {
      return String(1 + idx);
    }
  }

  // 3. Fallback using contract's paid schedules index (1-based)
  if (c && Array.isArray(c.schedules)) {
    const paidIdx = c.schedules
      .filter((s) => s.status === 'PAID')
      .findIndex((s) => s.id === sch.id);
    if (paidIdx !== -1) {
      return String(1 + paidIdx);
    }
  }

  // 4. Extract digits from schedule ID (e.g. sch-1107 -> 1107)
  const digits = sch.id.replace(/\D/g, '');
  if (digits && digits.length >= 1) {
    return digits.slice(-4);
  }

  return '1';
}

interface ContractDocumentHubModalProps {
  contract: InstallmentContract;
  store: SimulationStore;
  onClose: () => void;
  onPaySchedule?: (contractId: string, scheduleId: string) => void;
  initialTab?: 'INVOICE' | 'CONTRACT' | 'SCHEDULE';
}

export const ContractDocumentHubModal: React.FC<ContractDocumentHubModalProps> = ({
  contract: c,
  store,
  onClose,
  onPaySchedule,
  initialTab = 'INVOICE'
}) => {
  const profile = store.companyProfile || DEFAULT_COMPANY_REPORT_PROFILE;
  const [activeDocTab, setActiveDocTab] = useState<'INVOICE' | 'CONTRACT' | 'SCHEDULE'>(initialTab);
  const [invoiceScreenMode, setInvoiceScreenMode] = useState<'DUAL_A5' | 'SINGLE_A5'>('DUAL_A5');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const item = store.inventory.find((i) => i.id === c.inventoryItemId);
  const borrower = store.borrowers.find((b) => b.id === c.borrowerId);
  const guarantor = borrower?.guarantors?.[0];
  const guarantorName = guarantor?.name || 'عبد الله عباس شاكر';
  const invoiceNo = getInvoiceNumber(c);
  const itemSku = item?.sku || 'SKU-8821';
  const invoiceItem = getInvoiceTableItem(c);

  const totalPaid = c.schedules.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountIQD, 0) + c.downPaymentIQD;
  const totalRemaining = c.totalSalePriceIQD - totalPaid;

  // Ultra-Reliable Isolated Iframe Print Method (100% White, Zero Dark Bleed, Populated Content)
  const handlePrint = () => {
    const printableElement = document.getElementById('printable-hub-document');
    if (!printableElement) {
      window.print();
      return;
    }

    // Clean up any existing iframe
    const existingIframe = document.getElementById('print-hub-isolated-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'print-hub-isolated-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    const orientation = activeDocTab === 'SCHEDULE' ? 'landscape' : 'portrait';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${activeDocTab === 'INVOICE' ? 'فاتورة بيع رسمية' : activeDocTab === 'CONTRACT' ? 'عقد تقسيط رسمي' : 'جدول الأقساط'}</title>
        <style>
          @page {
            size: A4 ${orientation};
            margin: 4mm 6mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, 'Tajawal', Arial, sans-serif;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            direction: rtl;
            margin: 0;
            padding: 0;
            width: 100%;
            height: auto;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            border: 1px solid #000;
          }
          .a5-voucher-box {
            border: 1px solid #000;
            border-radius: 6px;
            padding: 7px 9px;
            margin-bottom: 3px;
            background: #ffffff;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .scissors-cut-divider {
            padding: 3px 0;
            text-align: center;
            font-size: 8.5px;
            font-weight: bold;
            border-top: 1px dashed #555;
            border-bottom: 1px dashed #555;
            margin: 3px 0;
            background: #ffffff;
          }
          .flex { display: flex; }
          .flex-col { flex-direction: column; }
          .items-start { align-items: flex-start; }
          .items-center { align-items: center; }
          .items-end { align-items: flex-end; }
          .justify-between { justify-content: space-between; }
          .justify-center { justify-content: center; }
          .justify-end { justify-content: flex-end; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .gap-1 { gap: 4px; }
          .gap-1\\.5 { gap: 6px; }
          .gap-2 { gap: 8px; }
          .gap-3 { gap: 12px; }
          .gap-4 { gap: 16px; }
          .gap-6 { gap: 24px; }
          .space-y-0\\.5 > * + * { margin-top: 2px; }
          .space-y-1 > * + * { margin-top: 4px; }
          .space-y-1\\.5 > * + * { margin-top: 6px; }
          .space-y-2 > * + * { margin-top: 8px; }
          .space-y-3 > * + * { margin-top: 12px; }
          .space-y-4 > * + * { margin-top: 16px; }
          .space-y-8 > * + * { margin-top: 32px; }
          .p-1 { padding: 4px; }
          .p-1\\.5 { padding: 6px; }
          .p-2 { padding: 8px; }
          .p-2\\.5 { padding: 10px; }
          .p-3 { padding: 12px; }
          .p-6 { padding: 24px; }
          .px-1 { padding-left: 4px; padding-right: 4px; }
          .px-1\\.5 { padding-left: 6px; padding-right: 6px; }
          .px-2 { padding-left: 8px; padding-right: 8px; }
          .px-3 { padding-left: 12px; padding-right: 12px; }
          .px-5 { padding-left: 20px; padding-right: 20px; }
          .px-6 { padding-left: 24px; padding-right: 24px; }
          .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .py-1\\.5 { padding-top: 6px; padding-bottom: 6px; }
          .border { border: 1px solid #000; }
          .border-2 { border: 2px solid #000; }
          .border-b { border-bottom: 1px solid #000; }
          .border-b-2 { border-bottom: 2px solid #000; }
          .border-t { border-top: 1px solid #000; }
          .border-t-2 { border-top: 2px solid #000; }
          .border-r { border-right: 1px solid #ccc; }
          .border-dashed { border-style: dashed; }
          .border-black { border-color: #000; }
          .rounded { border-radius: 4px; }
          .rounded-lg { border-radius: 8px; }
          .rounded-xl { border-radius: 12px; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-justify { text-align: justify; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .font-bold { font-weight: bold; }
          .font-semibold { font-weight: 600; }
          .font-extrabold { font-weight: 800; }
          .font-black { font-weight: 900; }
          .bg-black { background-color: #000000 !important; color: #ffffff !important; }
          .text-white { color: #ffffff !important; }
          .bg-white { background-color: #ffffff !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-gray-200 { background-color: #e5e7eb !important; }
          .w-full { width: 100%; }
          .w-6 { width: 24px; }
          .w-7 { width: 28px; }
          .h-7 { height: 28px; }
          .w-10 { width: 40px; }
          .w-12 { width: 48px; }
          .w-16 { width: 64px; }
          .w-20 { width: 80px; }
          .w-24 { width: 96px; }
          .w-28 { width: 112px; }
        </style>
      </head>
      <body>
        ${printableElement.innerHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  // Export Invoice to XLSX
  const exportInvoiceXLSX = () => {
    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; text-align: right; }
          th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
          th { background-color: #333; color: #fff; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <h2>${profile.companyName}</h2>
        <h3>فاتورة بيع رقم: ${invoiceNo}</h3>
        <table>
          <tr><th>اسم العميل</th><td>${c.borrowerName}</td><th>نوع الفاتورة</th><td>اقساط</td></tr>
          <tr><th>العنوان</th><td>${borrower?.city || 'سامراء'}</td><th>التاريخ</th><td>${c.startDate}</td></tr>
        </table>
        <br/>
        <table>
          <thead>
            <tr>
              <th>ت</th><th>اسم المادة</th><th>العدد</th><th>الوحدة</th><th>سعر الوحدة</th><th>الاجمالي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoiceItem.index}</td><td>${invoiceItem.itemName}</td><td>${invoiceItem.quantity}</td><td>${invoiceItem.unit}</td><td>${formatNumber(invoiceItem.unitPriceIQD)}</td><td>${formatNumber(invoiceItem.totalPriceIQD)}</td>
            </tr>
          </tbody>
        </table>
        <br/>
        <table>
          <tr><th>المبلغ الإجمالي</th><td>${formatNumber(c.totalSalePriceIQD)} د.ع</td></tr>
          <tr><th>الدفعة المقدمة</th><td>${formatNumber(c.downPaymentIQD)} د.ع</td></tr>
          <tr><th>المبلغ الصافي المؤجل</th><td>${formatNumber(c.financedAmountIQD)} د.ع</td></tr>
          <tr><th>التفقيط</th><td>${tafqeetIQD(c.totalSalePriceIQD)}</td></tr>
        </table>
      </body>
      </html>
    `;
    downloadFile(htmlTable, `فاتورة_بيع_${invoiceNo}_${c.borrowerName}.xlsx`, 'application/vnd.ms-excel;charset=utf-8');
    showNotification('تم تصدير فاتورة البيع بصيغة Excel بنجاح');
  };

  // Export Invoice to CSV
  const exportInvoiceCSV = () => {
    let csvContent = '\uFEFF';
    csvContent += `${profile.companyName} - فاتورة بيع رسمية\n`;
    csvContent += `رقم الفاتورة,${invoiceNo}\n`;
    csvContent += `رقم العقد,${getContractNumber(c)}\n`;
    csvContent += `اسم العميل,${c.borrowerName}\n`;
    csvContent += `العنوان,${borrower?.city || 'سامراء'}\n`;
    csvContent += `التاريخ,${c.startDate}\n\n`;
    csvContent += `ت,اسم المادة,العدد,الوحدة,سعر الوحدة,الاجمالي\n`;
    csvContent += `${invoiceItem.index},${invoiceItem.itemName},${invoiceItem.quantity},${invoiceItem.unit},${invoiceItem.unitPriceIQD},${invoiceItem.totalPriceIQD}\n\n`;
    csvContent += `المبلغ الإجمالي,${c.totalSalePriceIQD}\n`;
    csvContent += `الدفعة المقدمة,${c.downPaymentIQD}\n`;
    csvContent += `المبلغ الصافي المؤجل,${c.financedAmountIQD}\n`;
    csvContent += `التفقيط,${tafqeetIQD(c.totalSalePriceIQD)}\n`;
    downloadFile(csvContent, `فاتورة_بيع_${invoiceNo}_${c.borrowerName}.csv`, 'text/csv;charset=utf-8;');
    showNotification('تم تصدير فاتورة البيع بصيغة CSV بنجاح');
  };

  // Export Contract to XLSX
  const exportContractXLSX = () => {
    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; text-align: right; }
          th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
          th { background-color: #2b3a4a; color: #fff; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>عقد بيع بالتقسيط المباشر وكفالة تضامنية</h2>
        <h3>رقم العقد: ${getContractNumber(c)} - تاريخ العقد: ${c.startDate}</h3>
        <table>
          <tr><th>الطرف الأول (البائع/الممول)</th><td>${profile.companyName} / المستثمر: ${c.investorName}</td></tr>
          <tr><th>الطرف الثاني (المشتري/الزبون)</th><td>${c.borrowerName} - هاتف: ${borrower?.phone || ''} - عنوان: ${borrower?.address || ''} - هوية: ${borrower?.nationalId || ''}</td></tr>
          <tr><th>الطرف الثالث (الكفيل الضامن)</th><td>${guarantorName} - هاتف: ${guarantor?.phone || ''} - دائرة: ${guarantor?.department || ''} - كتاب كفالة: ${guarantor?.letterNumber || ''}</td></tr>
        </table>
        <br/>
        <table>
          <tr><th>المادة المبيعة</th><td>بضاعة ${c.inventoryItemName}</td><th>سعر البيع الإجمالي</th><td>${formatNumber(c.totalSalePriceIQD)} د.ع</td></tr>
          <tr><th>الدفعة النقدية المقدمة</th><td>${formatNumber(c.downPaymentIQD)} د.ع</td><th>المبلغ المؤجل بالذمة</th><td>${formatNumber(c.financedAmountIQD)} د.ع</td></tr>
          <tr><th>عدد الأشهر</th><td>${c.monthsCount} شهر</td><th>القسط الشهري</th><td>${formatNumber(c.monthlyInstallmentIQD)} د.ع / شهرياً</td></tr>
        </table>
      </body>
      </html>
    `;
    downloadFile(htmlTable, `عقد_تقسيط_${getContractNumber(c)}_${c.borrowerName}.xlsx`, 'application/vnd.ms-excel;charset=utf-8');
    showNotification('تم تصدير عقد التقسيط بصيغة Excel بنجاح');
  };

  // Export Schedule to XLSX
  const exportScheduleXLSX = () => {
    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; text-align: center; }
          th, td { border: 1px solid #000; padding: 6px; font-size: 11px; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>${profile.companyName} - جدول الأقساط</h2>
        <table>
          <tr><th>اسم العميل</th><td>${c.borrowerName}</td><th>العنوان</th><td>${borrower?.city || 'سامراء'}</td><th>الهاتف</th><td>${borrower?.phone || ''}</td></tr>
          <tr><th>رقم العقد</th><td>${getContractNumber(c)}</td><th>اسم الكفيل</th><td>${guarantorName}</td><th>المادة المبيعة</th><td>${c.inventoryItemName}</td></tr>
          <tr><th>إجمالي المبلغ</th><td>${formatNumber(c.totalSalePriceIQD)} د.ع</td><th>الدفعة المقدمة</th><td>${formatNumber(c.downPaymentIQD)} د.ع</td><th>إجمالي المتبقي</th><td>${formatNumber(totalRemaining)} د.ع</td></tr>
        </table>
        <br/>
        <table>
          <thead>
            <tr>
              <th>ت</th><th>العملة</th><th>تاريخ الاستحقاق</th><th>مبلغ القسط</th><th>المسدد</th><th>المتبقي</th><th>تاريخ التسديد</th><th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${c.schedules.map((sch) => `
              <tr>
                <td>${sch.installmentNumber}</td>
                <td>دينار</td>
                <td>${sch.dueDate}</td>
                <td>${formatNumber(sch.amountIQD)}</td>
                <td>${sch.status === 'PAID' ? formatNumber(sch.amountIQD) : '0'}</td>
                <td>${sch.status === 'PAID' ? '0' : formatNumber(sch.amountIQD)}</td>
                <td>${sch.paidDate || ''}</td>
                <td>${sch.status === 'PAID' ? 'مسدد' : 'قيد السداد'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    downloadFile(htmlTable, `جدول_أقساط_${getContractNumber(c)}_${c.borrowerName}.xlsx`, 'application/vnd.ms-excel;charset=utf-8');
    showNotification('تم تصدير جدول الأقساط بصيغة Excel بنجاح');
  };

  // Export Schedule to CSV
  const exportScheduleCSV = () => {
    let csvContent = '\uFEFF';
    csvContent += `${profile.companyName} - جدول الأقساط الرسمية\n`;
    csvContent += `رقم العقد,${getContractNumber(c)}\n`;
    csvContent += `اسم العميل,${c.borrowerName}\n`;
    csvContent += `العنوان,${borrower?.city || 'سامراء'}\n`;
    csvContent += `اسم الكفيل,${guarantorName}\n`;
    csvContent += `إجمالي المبلغ,${c.totalSalePriceIQD}\n`;
    csvContent += `الدفعة المقدمة,${c.downPaymentIQD}\n`;
    csvContent += `إجمالي المتبقي,${totalRemaining}\n\n`;
    csvContent += `ت,العملة,تاريخ الاستحقاق,مبلغ القسط,المسدد,المتبقي,تاريخ التسديد,الحالة\n`;
    c.schedules.forEach((sch) => {
      const isPaid = sch.status === 'PAID';
      csvContent += `${sch.installmentNumber},دينار,${sch.dueDate},${sch.amountIQD},${isPaid ? sch.amountIQD : 0},${isPaid ? 0 : sch.amountIQD},${sch.paidDate || ''},${isPaid ? 'مسدد' : 'قيد السداد'}\n`;
    });
    downloadFile(csvContent, `جدول_أقساط_${getContractNumber(c)}_${c.borrowerName}.csv`, 'text/csv;charset=utf-8;');
    showNotification('تم تصدير جدول الأقساط بصيغة CSV بنجاح');
  };

  // Helper file downloader
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render a Single A5 Sales Invoice Voucher (Compact, Pure Black & White)
  const renderA5InvoiceVoucher = (
    copyType: 'CUSTOMER' | 'COMPANY',
    badgeText: string,
    copyNote: string
  ) => {
    return (
      <div className="a5-voucher-box border border-black rounded-lg p-3 space-y-2 text-[10px] leading-tight text-black bg-white shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-black pb-1.5">
          <div className="text-right space-y-0.5">
            <h2 className="text-sm font-black text-black tracking-tight leading-none">{profile.companyName}</h2>
            <p className="text-[9px] text-gray-800 font-bold">{profile.companyActivity}</p>
            <p className="text-[8.5px] text-gray-700">{profile.companyAddress}</p>
            {profile.companyPhone && (
              <p className="text-[8.5px] text-black font-mono font-bold">{profile.companyPhone}</p>
            )}
          </div>

          <div className="text-center flex flex-col items-center justify-center">
            <div className="border border-black px-3 py-1 rounded bg-white shadow-none">
              <span className="text-[10px] font-black text-black block">{badgeText}</span>
              <span className="text-[8.5px] text-gray-700 font-bold block">فاتورة بيع بالتقسيط</span>
            </div>
          </div>

          <div className="text-left flex flex-col items-end space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 bg-black text-white font-black rounded flex items-center justify-center text-sm">
                أ
              </div>
              <div className="text-right">
                <h1 className="text-[11px] font-black text-black leading-none font-sans">فاتورة رقم: <span className="font-mono font-black">{invoiceNo}</span></h1>
                <p className="text-[8.5px] font-bold text-gray-700 mt-0.5">التاريخ: <span className="font-mono">{c.startDate}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Guarantor Info Bar */}
        <div className="border border-black rounded p-1.5 grid grid-cols-2 gap-2 text-[9px] bg-white">
          <div className="space-y-0.5 text-right">
            <p><span className="font-bold text-gray-700">اسم العميل :</span> <strong className="font-black text-black text-[10px]">{c.borrowerName}</strong></p>
            <p><span className="font-bold text-gray-700">العنوان :</span> <span className="font-semibold text-black">{borrower?.city || 'سامراء'} - {borrower?.address || ''}</span></p>
            <p><span className="font-bold text-gray-700">الهاتف :</span> <span className="font-mono font-bold text-black">{borrower?.phone || ''}</span></p>
          </div>
          <div className="space-y-0.5 text-right border-r border-gray-300 pr-2">
            <p><span className="font-bold text-gray-700">الكفيل الضامن :</span> <strong className="font-bold text-black">{guarantorName}</strong></p>
            <p><span className="font-bold text-gray-700">نوع الفاتورة :</span> <span className="font-bold text-black">أقساط شهرية ({c.monthsCount} شهر)</span></p>
          </div>
        </div>

        {/* Products Table */}
        <table className="w-full text-center border-collapse border border-black text-[9px]">
          <thead>
            <tr className="bg-gray-100 border-b border-black font-black text-black">
              <th className="border border-black py-1 px-1 w-6">ت</th>
              <th className="border border-black py-1 px-2 text-right">اسم المادة</th>
              <th className="border border-black py-1 px-1 w-10">العدد</th>
              <th className="border border-black py-1 px-1.5 w-12">الوحدة</th>
              <th className="border border-black py-1 px-2 w-24">سعر الوحدة</th>
              <th className="border border-black py-1 px-2 w-24">الاجمالي</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black font-bold">
              <td className="border border-black py-1 px-1 font-mono">{invoiceItem.index}</td>
              <td className="border border-black py-1 px-2 text-right font-extrabold pr-2">{invoiceItem.itemName}</td>
              <td className="border border-black py-1 px-1 font-mono">{invoiceItem.quantity}</td>
              <td className="border border-black py-1 px-1.5">{invoiceItem.unit}</td>
              <td className="border border-black py-1 px-2 font-mono font-black">{formatNumber(invoiceItem.unitPriceIQD)}</td>
              <td className="border border-black py-1 px-2 font-mono font-black">{formatNumber(invoiceItem.totalPriceIQD)}</td>
            </tr>
          </tbody>
        </table>

        {/* Financial Breakdown Grid */}
        <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
          <div className="border border-black rounded p-1.5 space-y-1 bg-white text-right">
            <div className="flex items-center justify-between border-b border-gray-200 pb-0.5">
              <span className="text-gray-700">الدفعة النقدية المقدمة:</span>
              <span className="font-mono font-black text-black">{formatNumber(c.downPaymentIQD)} د.ع</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-200 pb-0.5">
              <span className="text-gray-700">عدد الأقساط الشهرية:</span>
              <span className="font-mono font-black text-black">{c.monthsCount} شهر</span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-black font-extrabold">المبلغ المتبقي بالتقسيط:</span>
              <span className="font-mono text-[10.5px] font-black text-black">{formatNumber(c.financedAmountIQD)} د.ع</span>
            </div>
          </div>

          <div className="border border-black rounded p-1.5 space-y-1 bg-white text-left">
            <div className="flex items-center justify-between border-b border-gray-200 pb-0.5">
              <span className="text-gray-700 font-bold">المبلغ الإجمالي:</span>
              <span className="font-mono font-black text-black">{formatNumber(c.totalSalePriceIQD)} د.ع</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-200 pb-0.5">
              <span className="text-gray-700 font-bold">القسط الشهري:</span>
              <span className="font-mono font-black text-black">{formatNumber(c.monthlyInstallmentIQD)} د.ع</span>
            </div>
            <div className="flex items-center justify-between pt-0.5 font-black text-[10px]">
              <span>المبلغ الصافي:</span>
              <span className="font-mono text-[10.5px]">{formatNumber(c.totalSalePriceIQD)} د.ع</span>
            </div>
          </div>
        </div>

        {/* Tafqeet Bar */}
        <div className="border border-black rounded px-2 py-1 text-[8.5px] font-bold text-center bg-white">
          فقط: <span className="font-black text-black">{tafqeetIQD(c.totalSalePriceIQD)}</span>
        </div>

        {/* Footer Strip with Signatures & Barcode */}
        <div className="pt-1.5 border-t border-black flex items-center justify-between text-[8.5px] font-bold">
          <div className="space-y-0.5 text-right">
            <p><span className="text-gray-700">الملاحظات :</span> عقد بيع بالتقسيط المباشر</p>
            <p><span className="text-gray-700">منظم الوصل :</span> الحسابات • {copyNote}</p>
          </div>

          <div className="text-center space-y-1">
            <p className="text-[9px] font-black">الخطأ والسهو مرجوع للطرفين</p>
            <div className="flex items-center gap-6 text-[8px] text-gray-600">
              <span>توقيع المشتري: ....................</span>
              <span>توقيع وختم الإدارة: ....................</span>
            </div>
          </div>

          <div className="text-left">
            <div className="tracking-[3px] font-black text-sm leading-none font-mono">|||| ||||| || ||| ||||</div>
            <span className="text-[8px] font-bold block mt-0.5 font-sans">رقم الفاتورة: <span className="font-mono font-bold">{invoiceNo}</span></span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 hub-modal-overlay"
    >
      {/* Strict Print CSS for Direct Browser Print as Fallback */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${activeDocTab === 'SCHEDULE' ? 'A4 landscape' : 'A4 portrait'};
            margin: 4mm 6mm !important;
          }

          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print,
          .hub-no-print,
          nav,
          header,
          button {
            display: none !important;
          }

          .hub-modal-overlay {
            position: static !important;
            display: block !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            backdrop-filter: none !important;
          }

          .hub-main-window {
            position: static !important;
            display: block !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #printable-hub-document {
            display: block !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-a4-dual-a5-sheet {
            display: block !important;
            width: 100% !important;
            max-width: 195mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .a5-voucher-box {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
        }
      `}</style>

      {/* Main Screen Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden shadow-2xl relative hub-main-window cursor-default"
      >
        {/* Floating Notification */}
        {notification && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[90] bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-xl border border-emerald-400/30 flex items-center gap-2 animate-bounce no-print">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification}</span>
          </div>
        )}

        {/* Top Control & Document Switcher Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 no-print">
          {/* Left / Info & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base">مركز مستندات التقسيط الموحد</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-mono font-bold border border-blue-500/20">
                  عقد: #{getContractNumber(c)}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                الزبون: <strong className="text-slate-200">{c.borrowerName}</strong> | المادة: {c.inventoryItemName}
              </p>
            </div>
          </div>

          {/* Center / 3-in-1 Tabs Switcher */}
          <div className="flex items-center justify-center bg-slate-900 p-1 rounded-2xl border border-slate-800 self-center">
            <button
              onClick={() => setActiveDocTab('INVOICE')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDocTab === 'INVOICE'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/15'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>فاتورة بيع (نسختين A5 في A4)</span>
            </button>

            <button
              onClick={() => setActiveDocTab('CONTRACT')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDocTab === 'CONTRACT'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/15'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>عقد تقسيط رسمي (A4)</span>
            </button>

            <button
              onClick={() => setActiveDocTab('SCHEDULE')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDocTab === 'SCHEDULE'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/15'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>جدول دفعات (A4 عرضي)</span>
            </button>
          </div>

          {/* Right / Print & Export Actions */}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              title="طباعة نقية للورقة (بدون أي خلفيات أو حبر مهدور)"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / PDF</span>
            </button>

            {/* Export XLSX based on current tab */}
            <button
              onClick={() => {
                if (activeDocTab === 'INVOICE') exportInvoiceXLSX();
                else if (activeDocTab === 'CONTRACT') exportContractXLSX();
                else exportScheduleXLSX();
              }}
              className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              title="تصدير بصيغة Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* Export CSV based on current tab */}
            <button
              onClick={() => {
                if (activeDocTab === 'INVOICE') exportInvoiceCSV();
                else if (activeDocTab === 'CONTRACT') exportContractXLSX();
                else exportScheduleCSV();
              }}
              className="px-3 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              title="تصدير بصيغة CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors mr-1 cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Bar for Invoice on Screen (Single vs Dual A5) */}
        {activeDocTab === 'INVOICE' && (
          <div className="bg-slate-950/60 px-6 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 no-print">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>تخطيط الطباعة الرسمي: <strong className="text-slate-200">نسختين A5 في ورقة A4 واحدة (نسخة الزبون + خط القص + نسخة الإدارة)</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setInvoiceScreenMode('DUAL_A5')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  invoiceScreenMode === 'DUAL_A5'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ورقة A4 كاملة (2x A5)
              </button>
              <button
                onClick={() => setInvoiceScreenMode('SINGLE_A5')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  invoiceScreenMode === 'SINGLE_A5'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                معاينة مكبرة (A5 Zoom)
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PRINTABLE DOCUMENT CORE */}
        {/* ========================================================================= */}
        <div id="printable-hub-document" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white text-black font-sans">
          {/* TAB 1: OFFICIAL SALES INVOICE (2x A5 in 1x A4 Page) */}
          {activeDocTab === 'INVOICE' && (
            <div className="w-full max-w-[195mm] mx-auto space-y-2 bg-white text-black print-a4-dual-a5-sheet">
              {/* TOP VOUCHER: Customer Copy (نسخة الزبون) */}
              {renderA5InvoiceVoucher('CUSTOMER', 'نسخة الزبون (أصلية)', 'سند استلام البضاعة للمشتري')}

              {/* MIDDLE DIVIDER: Scissors Cut Line (Shown in DUAL mode and in Print) */}
              {(invoiceScreenMode === 'DUAL_A5' || typeof window !== 'undefined') && (
                <div className="scissors-cut-divider py-1 flex items-center justify-center gap-2 text-[9px] font-bold text-gray-700 border-y border-dashed border-gray-400 bg-white my-1">
                  <Scissors className="w-3.5 h-3.5" />
                  <span className="tracking-widest">----------------- خط القص والفصل (نسخة المشتري بالأعلى / نسخة الإدارة بالأسفل) -----------------</span>
                  <Scissors className="w-3.5 h-3.5 rotate-180" />
                </div>
              )}

              {/* BOTTOM VOUCHER: Company Copy (نسخة الإدارة) */}
              {(invoiceScreenMode === 'DUAL_A5' || typeof window !== 'undefined') && (
                renderA5InvoiceVoucher('COMPANY', 'نسخة الإدارة (سند حفظ)', 'سند الإدارة والمحاسبة')
              )}
            </div>
          )}

          {/* TAB 2: OFFICIAL LEGAL INSTALLMENT CONTRACT (A4 Portrait) */}
          {activeDocTab === 'CONTRACT' && (
            <div className="w-full max-w-[195mm] mx-auto border-2 border-black rounded-xl p-6 space-y-4 text-[11.5px] leading-relaxed text-black bg-white shadow-none">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="text-right space-y-0.5">
                  <h2 className="text-lg font-black text-black">{profile.companyName}</h2>
                  <p className="text-[11px] text-gray-800 font-bold">{profile.companyActivity}</p>
                  <p className="text-[10px] text-gray-600">{profile.companyAddress}</p>
                </div>

                <div className="border-2 border-black px-5 py-1.5 rounded-lg text-center bg-white">
                  <h1 className="text-lg font-black tracking-wide text-black">عقد بيع بالتقسيط وكفالة ضامنة</h1>
                  <span className="text-[11px] font-mono font-bold block mt-0.5">رقم العقد: {getContractNumber(c)}</span>
                </div>

                <div className="text-left font-mono text-[11px]">
                  <p className="font-bold">التاريخ: {c.startDate}</p>
                  <p className="text-gray-600 mt-0.5">سامراء - صلاح الدين</p>
                </div>
              </div>

              {/* Legal Introduction */}
              <p className="text-justify font-medium leading-relaxed bg-white p-2 rounded border border-gray-300 text-[11px]">
                بعون الله تعالى وتوفيقه، تم إبرام هذا العقد في يوم <strong>{formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong> بين كل من الأطراف التالية صفاتهم وأهليتهم القانونية المعتبرة:
              </p>

              {/* Parties Block */}
              <div className="space-y-2 text-[11px]">
                {/* First Party */}
                <div className="border border-black rounded p-2 bg-white">
                  <span className="font-black block text-black border-b border-gray-300 pb-0.5 mb-1">
                    الطرف الأول (البائع / الممول):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div><strong>الاسم:</strong> {profile.companyName} (المستثمر: {c.investorName})</div>
                    <div><strong>العنوان:</strong> {profile.companyAddress}</div>
                    <div><strong>الهاتف:</strong> {profile.companyPhone || '07772004002 / 07872004002'}</div>
                    <div><strong>الصفة:</strong> المالك والممول للبضاعة المبيعة</div>
                  </div>
                </div>

                {/* Second Party (Borrower) */}
                <div className="border border-black rounded p-2 bg-white">
                  <span className="font-black block text-black border-b border-gray-300 pb-0.5 mb-1">
                    الطرف الثاني (المشتري / الزبون):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div><strong>الاسم الكامل:</strong> {c.borrowerName}</div>
                    <div><strong>رقم الهاتف:</strong> {borrower?.phone || 'غير مسجل'}</div>
                    <div><strong>العنوان السكني:</strong> {borrower?.city || 'سامراء'} - {borrower?.address || ''}</div>
                    <div><strong>رقم الهوية / الموحدة:</strong> {borrower?.nationalId || 'IQ-XXXXXX'}</div>
                    <div><strong>الوظيفة / الدائرة:</strong> {borrower?.jobTitle || 'موظف'}</div>
                    <div><strong>الدخل الشهري:</strong> {borrower?.monthlyIncomeIQD ? `${formatNumber(borrower.monthlyIncomeIQD)} د.ع` : '---'}</div>
                  </div>
                </div>

                {/* Third Party (Guarantor) */}
                <div className="border border-black rounded p-2 bg-white">
                  <span className="font-black block text-black border-b border-gray-300 pb-0.5 mb-1">
                    الطرف الثالث (الكفيل الضامن والتضامني):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div><strong>الاسم الكامل:</strong> {guarantorName}</div>
                    <div><strong>رقم الهاتف:</strong> {guarantor?.phone || 'غير مسجل'}</div>
                    <div><strong>دائرة / وزارة الكفيل:</strong> {guarantor?.department || 'تربية صلاح الدين / سامراء'}</div>
                    <div><strong>رقم كتاب الكفالة:</strong> {guarantor?.letterNumber || 'كتاب رسمي'}</div>
                    <div><strong>تاريخ كتاب الكفالة:</strong> {guarantor?.letterDate || c.startDate}</div>
                    <div><strong>رقم الهوية:</strong> {guarantor?.nationalId || 'IQ-XXXXXX'}</div>
                  </div>
                </div>
              </div>

              {/* Financial Terms Table */}
              <div>
                <h4 className="font-black text-[11px] mb-1 text-black">بيانات المبيع والمبالغ المالية المتفق عليها:</h4>
                <table className="w-full text-center border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 font-black border-b border-black">
                      <th className="border border-black p-1.5">المادة المبيعة</th>
                      <th className="border border-black p-1.5">سعر البيع الإجمالي</th>
                      <th className="border border-black p-1.5">المقدمة المستلمة</th>
                      <th className="border border-black p-1.5">المبلغ المؤجل</th>
                      <th className="border border-black p-1.5">عدد الأشهر</th>
                      <th className="border border-black p-1.5">القسط الشهري</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-bold font-mono">
                      <td className="border border-black p-1.5 font-sans font-extrabold">{c.inventoryItemName}</td>
                      <td className="border border-black p-1.5">{formatNumber(c.totalSalePriceIQD)} د.ع</td>
                      <td className="border border-black p-1.5">{formatNumber(c.downPaymentIQD)} د.ع</td>
                      <td className="border border-black p-1.5">{formatNumber(c.financedAmountIQD)} د.ع</td>
                      <td className="border border-black p-1.5 font-sans">{c.monthsCount} شهر</td>
                      <td className="border border-black p-1.5 font-extrabold">{formatNumber(c.monthlyInstallmentIQD)} د.ع</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legal Clauses */}
              <div className="space-y-1 text-[10px] leading-tight border-t border-gray-400 pt-2 text-justify">
                <p><strong>البند الأول:</strong> أقر الطرف الثاني باستلامه المبيع المذكور بحالة ممتازة ومطابقة للمواصفات معاينة نافية للجهالة شرعاً وقانوناً.</p>
                <p><strong>البند الثاني:</strong> يلتزم الطرف الثاني بدفع الأقساط الشهرية في مواعيد استحقاقها المحددة في جدول الأقساط الملحق بهذا العقد دون أي تأخير.</p>
                <p><strong>البند الثالث (كفالة تضامنية مطلقة):</strong> يضمن الطرف الثالث (الكفيل) سداد كافة المبالغ المستحقة بذمة الطرف الثاني كفالة تضامنية وتكافلية مطلقة، ويحق للطرف الأول الرجوع على الكفيل ومطالبته والاستقطاع المباشر من راتبه أو مستحقاته عند تخلف المدين.</p>
                <p><strong>البند الرابع:</strong> في حال تأخر الطرف الثاني عن سداد قسطين متتاليين تسقط جميع الآجال وتصبح كامل الذمة المتبقية واجبة الأداء فوراً ويتحمل المشتري والكفيل كافة المصاريف القانونية والقضائية.</p>
                <p><strong>البند الخامس:</strong> يخضع هذا العقد لأحكام القانون العراقي النافذ، وتختص محاكم قضاء سامراء بالنظر في أي نزاع ينشأ عنه.</p>
              </div>

              {/* Signatures & Stamp Blocks */}
              <div className="pt-4 border-t-2 border-black grid grid-cols-3 gap-3 text-center text-[11px] font-bold">
                <div className="space-y-8">
                  <p className="font-black">الطرف الأول (الشركة / الممول)</p>
                  <div className="border-t border-dashed border-gray-500 pt-0.5 text-[10px] text-gray-600">
                    التوقيع والختم الرسمي
                  </div>
                </div>

                <div className="space-y-8">
                  <p className="font-black">الطرف الثاني (المشتري / الزبون)</p>
                  <div className="border-t border-dashed border-gray-500 pt-0.5 text-[10px] text-gray-600">
                    التوقيع والبصمة الإبهامية
                  </div>
                </div>

                <div className="space-y-8">
                  <p className="font-black">الطرف الثالث (الكفيل الضامن)</p>
                  <div className="border-t border-dashed border-gray-500 pt-0.5 text-[10px] text-gray-600">
                    التوقيع والبصمة الإبهامية
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OFFICIAL INSTALLMENT SCHEDULE (A4 Landscape) */}
          {activeDocTab === 'SCHEDULE' && (
            <div className="w-full max-w-[285mm] mx-auto space-y-3 text-[11px] leading-tight text-black bg-white">
              {/* Header Row */}
              <div className="flex items-start justify-between border-b-2 border-black pb-2">
                <div className="text-right space-y-0.5">
                  <h2 className="text-lg font-extrabold text-black">{profile.companyName}</h2>
                  <p className="text-[10.5px] text-black font-semibold">{profile.companyAddress}</p>
                  {profile.companyPhone && (
                    <p className="text-[10px] text-black font-mono font-bold">{profile.companyPhone}</p>
                  )}
                </div>

                <div className="border-2 border-black px-6 py-1 text-center rounded bg-white">
                  <h1 className="text-xl font-black tracking-wide text-black">جدول الأقساط الرسمية</h1>
                </div>

                <div className="text-left font-mono text-[10.5px]">
                  <p className="font-bold">رقم العقد: {getContractNumber(c)}</p>
                  <p className="text-[10px] text-gray-700 mt-0.5">تاريخ الإصدار: {c.startDate}</p>
                </div>
              </div>

              {/* Metadata Rows */}
              <div className="border border-black p-2.5 rounded space-y-1.5 bg-white">
                <div className="grid grid-cols-3 gap-3">
                  <div><strong className="font-bold">اسم العميل:</strong> {c.borrowerName}</div>
                  <div><strong className="font-bold">العنوان:</strong> {borrower?.city || 'سامراء'} - {borrower?.address || ''}</div>
                  <div><strong className="font-bold">الهاتف:</strong> {borrower?.phone || '07701234567'}</div>
                </div>
                <div className="grid grid-cols-3 gap-3 border-t border-gray-300 pt-1.5">
                  <div><strong className="font-bold">اسم الكفيل:</strong> {guarantorName}</div>
                  <div><strong className="font-bold">هاتف الكفيل:</strong> {guarantor?.phone || 'غير مسجل'}</div>
                  <div><strong className="font-bold">المادة المبيعة:</strong> {c.inventoryItemName}</div>
                </div>
              </div>

              {/* Totals Summary Bar */}
              <div className="grid grid-cols-4 gap-2 text-center font-bold text-[10.5px]">
                <div className="border border-black p-1.5 bg-white">
                  <span className="block text-[9.5px] text-gray-700">إجمالي قيمة البيع</span>
                  <span className="text-sm font-mono font-black">{formatNumber(c.totalSalePriceIQD)} د.ع</span>
                </div>
                <div className="border border-black p-1.5 bg-white">
                  <span className="block text-[9.5px] text-gray-700">الدفعة المقدمة</span>
                  <span className="text-sm font-mono font-black text-black">{formatNumber(c.downPaymentIQD)} د.ع</span>
                </div>
                <div className="border border-black p-1.5 bg-white">
                  <span className="block text-[9.5px] text-gray-700">إجمالي المسدد فعلياً</span>
                  <span className="text-sm font-mono font-black text-black">{formatNumber(totalPaid)} د.ع</span>
                </div>
                <div className="border border-black p-1.5 bg-white">
                  <span className="block text-[9.5px] text-gray-700">إجمالي المتبقي بالذمة</span>
                  <span className="text-sm font-mono font-black text-black">{formatNumber(totalRemaining)} د.ع</span>
                </div>
              </div>

              {/* Main Installment Table */}
              <div>
                <table className="w-full text-center border-collapse border-2 border-black text-[10.5px]">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-black font-extrabold">
                      <th className="border border-black p-1.5 w-10">ت</th>
                      <th className="border border-black p-1.5 w-16">العملة</th>
                      <th className="border border-black p-1.5 w-28">تاريخ الاستحقاق</th>
                      <th className="border border-black p-1.5 w-28">مبلغ القسط</th>
                      <th className="border border-black p-1.5 w-24">المسدد</th>
                      <th className="border border-black p-1.5 w-28">المتبقي</th>
                      <th className="border border-black p-1.5 w-28">تاريخ التسديد</th>
                      <th className="border border-black p-1.5 w-24">الحالة</th>
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
                          <td className="border border-black p-1 font-mono font-bold">{paidAmt}</td>
                          <td className="border border-black p-1 font-mono font-bold">{remAmt}</td>
                          <td className="border border-black p-1 font-mono text-xs">{sch.paidDate || '---'}</td>
                          <td className="border border-black p-1 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${isPaid ? 'bg-gray-200 text-black' : 'bg-white text-black border border-black'}`}>
                              {isPaid ? 'مسدد' : 'قيد السداد'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Document Footer */}
              <div className="flex items-center justify-between text-[9.5px] text-gray-700 pt-2 border-t border-black font-mono">
                <span>صفحة 1 من 1</span>
                <span>تم التوليد والتوثيق بواسطة {profile.companyName} - {formatDate(new Date())}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Status Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 no-print">
          <div className="flex items-center gap-4">
            <span>مدة العقد: <strong className="text-white">{c.monthsCount} أشهر</strong></span>
            <span>•</span>
            <span>القسط الشهري: <strong className="text-emerald-400">{formatNumber(c.monthlyInstallmentIQD)} د.ع</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
          >
            إغلاق مركز المستندات
          </button>
        </div>
      </div>
    </div>
  );
};
