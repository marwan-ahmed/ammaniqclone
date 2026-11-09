import assert from 'node:assert';
import { test, describe } from 'node:test';
import { SimulationStore } from '../services/simulation';
import {
  DEFAULT_COMPANY_REPORT_PROFILE,
  CompanyReportProfile,
  generateReportPrintStyles,
  generateReportPrintHeaderHtml,
  generateReportKpisHtml,
  generateReportPrintFooterHtml
} from '../utils/printReportHeader';

describe('Corporate Profile & Unified Report Header Engine', () => {
  test('DEFAULT_COMPANY_REPORT_PROFILE contains expected defaults', () => {
    assert.strictEqual(DEFAULT_COMPANY_REPORT_PROFILE.companyName, 'شركة أمان للتقسيط والاستثمار المالي');
    assert.strictEqual(DEFAULT_COMPANY_REPORT_PROFILE.companyAddress, 'سامراء - حي الجامعة');
    assert.strictEqual(DEFAULT_COMPANY_REPORT_PROFILE.managerName, 'أحمد إياد');
    assert.ok(DEFAULT_COMPANY_REPORT_PROFILE.companyPhone.length > 0);
    assert.ok(DEFAULT_COMPANY_REPORT_PROFILE.companyActivity!.length > 0);
  });

  test('SimulationStore initializes with DEFAULT_COMPANY_REPORT_PROFILE', () => {
    const store = new SimulationStore();
    assert.ok(store.companyProfile);
    assert.strictEqual(store.companyProfile.companyName, 'شركة أمان للتقسيط والاستثمار المالي');
    assert.strictEqual(store.companyProfile.managerName, 'أحمد إياد');
  });

  test('SimulationStore.setCompanyProfile updates and trims fields', () => {
    const store = new SimulationStore();

    store.setCompanyProfile({
      companyName: '  شركة النور للتمويل والتقسيط  ',
      companyAddress: '  بغداد - الكرادة  ',
      companyPhone: '  07701112233  ',
      managerName: '  علي حسن  '
    });

    assert.strictEqual(store.companyProfile.companyName, 'شركة النور للتمويل والتقسيط');
    assert.strictEqual(store.companyProfile.companyAddress, 'بغداد - الكرادة');
    assert.strictEqual(store.companyProfile.companyPhone, '07701112233');
    assert.strictEqual(store.companyProfile.managerName, 'علي حسن');
    // Unchanged field remains intact
    assert.strictEqual(store.companyProfile.companyActivity, DEFAULT_COMPANY_REPORT_PROFILE.companyActivity);
  });

  test('generateReportPrintStyles produces valid CSS with print media queries', () => {
    const css = generateReportPrintStyles();
    assert.ok(css.includes('@page'));
    assert.ok(css.includes('size: A4;'));
    assert.ok(css.includes('print-color-adjust: exact'));
  });

  test('generateReportPrintHeaderHtml renders dynamic company profile fields', () => {
    const customProfile: CompanyReportProfile = {
      companyName: 'شركة الرافدين للتقسيط المحدودة',
      companyAddress: 'صلاح الدين - تكريت',
      companyPhone: '07800000000',
      companyActivity: 'استثمارات وتجارة بالتقسيط الميسر',
      managerName: 'محمد أحمد'
    };

    const html = generateReportPrintHeaderHtml({
      title: 'كشف التدفقات النقدية السنوي',
      subtitle: 'تقرير شامل لكافة الحسابات',
      profile: customProfile,
      metaItems: [
        { label: 'السنة المالية', value: '2026' },
        { label: 'القسم', value: 'المحاسبة العامة' }
      ]
    });

    assert.ok(html.includes('شركة الرافدين للتقسيط المحدودة'));
    assert.ok(html.includes('صلاح الدين - تكريت'));
    assert.ok(html.includes('07800000000'));
    assert.ok(html.includes('كشف التدفقات النقدية السنوي'));
    assert.ok(html.includes('تقرير شامل لكافة الحسابات'));
    assert.ok(html.includes('السنة المالية'));
    assert.ok(html.includes('2026'));
  });

  test('generateReportKpisHtml renders KPI metric cards', () => {
    const html = generateReportKpisHtml([
      { title: 'إجمالي المحفظة', value: '50.000.000 د.ع', color: 'emerald' },
      { title: 'نسبة التحصيل', value: '98.5%' }
    ]);

    assert.ok(html.includes('إجمالي المحفظة'));
    assert.ok(html.includes('50.000.000 د.ع'));
    assert.ok(html.includes('نسبة التحصيل'));
    assert.ok(html.includes('98.5%'));
  });

  test('generateReportPrintFooterHtml renders manager and auditor signatures', () => {
    const profile: CompanyReportProfile = {
      companyName: 'نظام أمان',
      companyAddress: 'سامراء',
      companyPhone: '07700000000',
      companyActivity: 'تجارة',
      managerName: 'زيد طارق'
    };

    const footerHtml = generateReportPrintFooterHtml({
      profile,
      signatures: [
        'إعداد وتدقيق الحسابات (أحمد محمود)',
        'مدير العمليات',
        `مصادقة المدير التنفيذي (${profile.managerName})`
      ]
    });

    assert.ok(footerHtml.includes('زيد طارق'));
    assert.ok(footerHtml.includes('مصادقة المدير التنفيذي'));
    assert.ok(footerHtml.includes('إعداد وتدقيق الحسابات'));
    assert.ok(footerHtml.includes('أحمد محمود'));
    assert.ok(footerHtml.includes('مدير العمليات'));
  });
});
