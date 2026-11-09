import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  toEnglishDigits,
  formatIQD,
  formatNumber,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
} from '../utils/formatters';

describe('English Numerals & Unified Formatters Unit Tests', () => {
  test('toEnglishDigits converts Arabic and Persian numerals to English digits', () => {
    assert.strictEqual(toEnglishDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
    assert.strictEqual(toEnglishDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
    assert.strictEqual(toEnglishDigits('الهاتف: ٠٧٧٠١٢٣٤٥٦٧'), 'الهاتف: 07701234567');
    assert.strictEqual(toEnglishDigits('المبلغ: ١,٥٠٠,٠٠٠ د.ع'), 'المبلغ: 1,500,000 د.ع');
    assert.strictEqual(toEnglishDigits('12345'), '12345');
    assert.strictEqual(toEnglishDigits(null), '');
    assert.strictEqual(toEnglishDigits(undefined), '');
  });

  test('formatIQD formats Iraqi Dinars with dot thousands separators in English digits', () => {
    assert.strictEqual(formatIQD(1000000), '1.000.000');
    assert.strictEqual(formatIQD(1000), '1.000');
    assert.strictEqual(formatIQD(250000), '250.000');
    assert.strictEqual(formatIQD(0), '0');
    assert.strictEqual(formatIQD('5000000'), '5.000.000');
    assert.strictEqual(formatIQD('٥٠٠٠٠٠٠'), '5.000.000');
    assert.strictEqual(formatIQD('invalid'), '0');
    assert.strictEqual(formatIQD(1234.56), '1.235');
  });

  test('formatNumber formats numbers with comma thousands separators in English digits', () => {
    assert.strictEqual(formatNumber(1000000), '1,000,000');
    assert.strictEqual(formatNumber(250000), '250,000');
    assert.strictEqual(formatNumber('١٥٠٠٠٠٠'), '1,500,000');
    assert.strictEqual(formatNumber(0), '0');
    assert.strictEqual(formatNumber('invalid'), '0');
  });

  test('formatCurrency handles privacy masking and appends IQD symbol', () => {
    assert.strictEqual(formatCurrency(1500000, false), '1,500,000 د.ع');
    assert.strictEqual(formatCurrency(1500000, true), '••••••••');
    assert.strictEqual(formatCurrency(1500000, false, true), '1.500.000 د.ع');
  });

  test('formatDate outputs dates with strictly English numerals and no Arabic digits', () => {
    const testDate = new Date('2026-10-05T12:00:00Z');
    const formatted = formatDate(testDate);
    const formattedFull = formatDate(testDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Ensure NO Eastern Arabic digits exist
    assert.strictEqual(/[٠-٩]/.test(formatted), false, `Found Arabic digits in: ${formatted}`);
    assert.strictEqual(/[٠-٩]/.test(formattedFull), false, `Found Arabic digits in: ${formattedFull}`);

    // Ensure English year is present
    assert.ok(formatted.includes('2026'));
    assert.ok(formattedFull.includes('2026'));
  });

  test('formatTime outputs times with strictly English numerals and no Arabic digits', () => {
    const testDate = new Date('2026-10-05T14:30:45');
    const formattedTime = formatTime(testDate);
    const formattedTimeSec = formatTime(testDate, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Ensure NO Eastern Arabic digits exist
    assert.strictEqual(/[٠-٩]/.test(formattedTime), false, `Found Arabic digits in: ${formattedTime}`);
    assert.strictEqual(/[٠-٩]/.test(formattedTimeSec), false, `Found Arabic digits in: ${formattedTimeSec}`);

    // Ensure English numbers are present (e.g. 02:30 or 14:30 depending on 12/24 hour)
    assert.ok(/\d{2}:\d{2}/.test(formattedTime));
  });

  test('formatDateTime outputs combined date & time with strictly English numerals', () => {
    const testDate = new Date('2026-10-05T14:30:00');
    const formatted = formatDateTime(testDate);

    assert.strictEqual(/[٠-٩]/.test(formatted), false, `Found Arabic digits in: ${formatted}`);
    assert.ok(formatted.includes('2026'));
  });
});
