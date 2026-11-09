/**
 * Unified Corporate Print Report Template & Header Engine (A4 Standard)
 * محرك ترويسة وقالب التقارير والمطبوعات الرسمية الموحدة (نظام أمان للتقسيط)
 */

export interface CompanyReportProfile {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyActivity?: string;
  managerName?: string;
}

export const DEFAULT_COMPANY_REPORT_PROFILE: CompanyReportProfile = {
  companyName: 'شركة أمان للتقسيط والاستثمار المالي',
  companyAddress: 'سامراء - حي الجامعة',
  companyPhone: '07700000000',
  companyActivity: 'تقسيط الأجهزة والمواد والمشاريع الاستثمارية',
  managerName: 'أحمد إياد',
};

export interface ReportMetaItem {
  label: string;
  value: string;
}

export interface ReportKpiCard {
  title: string;
  value: string;
  color?: 'emerald' | 'blue' | 'purple' | 'amber' | 'slate';
}

/**
 * Standard A4 print stylesheet matching the corporate report aesthetic
 */
export function generateReportPrintStyles(): string {
  return `
    @page {
      size: A4;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      color: #0f172a;
      direction: rtl;
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-size: 10pt;
      line-height: 1.5;
    }
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2.5px solid #0A3C6E;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .company-title {
      font-size: 17pt;
      font-weight: 900;
      color: #0A3C6E;
      margin: 0;
      line-height: 1.2;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: 800;
      color: #1783C1;
      margin-top: 4px;
    }
    .company-contact {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 3px;
      font-weight: 500;
    }
    .meta-box {
      text-align: left;
      font-size: 8.5pt;
      color: #475569;
      line-height: 1.6;
      border-right: 2px solid #e2e8f0;
      padding-right: 12px;
    }
    .meta-box strong {
      color: #1e293b;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 9px 10px;
      background: #f8fafc;
      text-align: center;
    }
    .kpi-title {
      font-size: 8pt;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 12.5pt;
      font-weight: 900;
      color: #0f172a;
      font-family: 'Courier New', monospace;
    }
    .kpi-value.purple { color: #6d28d9; }
    .kpi-value.emerald { color: #047857; }
    .kpi-value.blue { color: #0369a1; }
    .kpi-value.amber { color: #b45309; }

    .section-heading {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0A3C6E;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 14px 0 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 14px;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: 700;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      text-align: right;
    }
    td {
      padding: 5.5px 8px;
      border: 1px solid #e2e8f0;
      text-align: right;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-mono { font-family: 'Courier New', monospace; font-weight: 700; }
    .badge {
      display: inline-block;
      padding: 1.5px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
    }
    .badge-purple { background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; }
    .badge-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-emerald { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

    .report-footer {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 170px;
    }
    .sig-line {
      margin-top: 32px;
      border-bottom: 1px solid #94a3b8;
    }
  `;
}

/**
 * Generates the formal corporate header HTML
 */
export function generateReportPrintHeaderHtml(options: {
  title: string;
  subtitle?: string;
  profile?: Partial<CompanyReportProfile>;
  metaItems?: ReportMetaItem[];
}): string {
  const p: CompanyReportProfile = {
    ...DEFAULT_COMPANY_REPORT_PROFILE,
    ...(options.profile || {}),
  };

  const defaultMeta: ReportMetaItem[] = [
    { label: 'تاريخ الطباعة', value: new Date().toLocaleDateString('en-GB') },
    { label: 'المصادقة', value: 'تقرير مالي رسمي معتمد' },
  ];

  const metaList = options.metaItems || defaultMeta;

  return `
    <div class="report-header">
      <div>
        <h1 class="company-title">${p.companyName}</h1>
        <div class="doc-title">${options.title}</div>
        ${options.subtitle ? `<div style="font-size: 9pt; color: #4338ca; font-weight: 600; margin-top: 2px;">${options.subtitle}</div>` : ''}
        <div class="company-contact">
          ${p.companyAddress} | الهاتف المعتمد للإدارة: ${p.companyPhone}
          ${p.companyActivity ? ` | ${p.companyActivity}` : ''}
        </div>
      </div>
      <div class="meta-box">
        ${metaList.map((m) => `<div><strong>${m.label}:</strong> ${m.value}</div>`).join('')}
      </div>
    </div>
  `;
}

/**
 * Generates KPI summary cards HTML
 */
export function generateReportKpisHtml(kpis: ReportKpiCard[]): string {
  if (!kpis || kpis.length === 0) return '';
  return `
    <div class="kpi-grid">
      ${kpis
        .map(
          (kpi) => `
        <div class="kpi-card">
          <div class="kpi-title">${kpi.title}</div>
          <div class="kpi-value ${kpi.color || ''}">${kpi.value}</div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Generates official signature boxes HTML
 */
export function generateReportPrintFooterHtml(options?: {
  profile?: Partial<CompanyReportProfile>;
  signatures?: string[];
}): string {
  const p: CompanyReportProfile = {
    ...DEFAULT_COMPANY_REPORT_PROFILE,
    ...(options?.profile || {}),
  };

  const sigs = options?.signatures || [
    'إعداد وتدقيق الحسابات',
    'مسؤول القسم المالي',
    `مصادقة المدير التنفيذي (${p.managerName || 'أحمد إياد'})`,
  ];

  return `
    <div class="report-footer">
      ${sigs
        .map(
          (title) => `
        <div class="sig-box">
          <div>${title}</div>
          <div class="sig-line"></div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Helper to open and print an isolated popup report window
 */
export function openPrintReportWindow(options: {
  windowTitle: string;
  bodyHtml: string;
}): void {
  if (typeof window === 'undefined') return;
  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة (Popups) لطباعة التقرير');
    return;
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${options.windowTitle}</title>
      <style>
        ${generateReportPrintStyles()}
      </style>
    </head>
    <body>
      ${options.bodyHtml}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}
