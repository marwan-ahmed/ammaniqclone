import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  formatUSD,
  convertIQDtoUSD,
  convertUSDtoIQD,
  formatDualCurrencyAmounts,
} from '../utils/formatters';
import { DEFAULT_EXCHANGE_RATE_PER_100 } from '../types/currency';

describe('USD Currency & Dual Exchange Rate Conversion Engine Tests', () => {
  describe('convertIQDtoUSD & convertUSDtoIQD Conversions', () => {
    test('converts IQD to USD accurately with 153,000 exchange rate per 100$', () => {
      // 153,000 IQD = 100 USD
      const usd100 = convertIQDtoUSD(153000, 153000);
      assert.strictEqual(Math.round(usd100), 100);

      // 1,530,000 IQD = 1,000 USD
      const usd1000 = convertIQDtoUSD(1530000, 1530000 / 10);
      assert.strictEqual(Math.round(usd1000), 1000);

      // 1,000,000 IQD at 150,000 rate -> (1,000,000 / 150,000) * 100 = 666.666...
      const usdMil = convertIQDtoUSD(1000000, 150000);
      assert.strictEqual(usdMil.toFixed(2), '666.67');
    });

    test('converts USD to IQD accurately with 153,000 exchange rate per 100$', () => {
      // 100 USD = 153,000 IQD
      const iqd100 = convertUSDtoIQD(100, 153000);
      assert.strictEqual(Math.round(iqd100), 153000);

      // 1,000 USD = 1,530,000 IQD
      const iqd1000 = convertUSDtoIQD(1000, 153000);
      assert.strictEqual(Math.round(iqd1000), 1530000);

      // 500 USD at 152,000 rate -> 760,000 IQD
      const iqd500 = convertUSDtoIQD(500, 152000);
      assert.strictEqual(Math.round(iqd500), 760000);
    });

    test('handles round-trip precision within 0.01 margin', () => {
      const originalUSD = 750;
      const rate = 153000;
      const inIQD = convertUSDtoIQD(originalUSD, rate);
      const backToUSD = convertIQDtoUSD(inIQD, rate);
      assert.strictEqual(Math.abs(backToUSD - originalUSD) < 0.0001, true);
    });

    test('safely falls back to default exchange rate when 0 or negative rate is passed', () => {
      const resultZero = convertIQDtoUSD(153000, 0);
      assert.strictEqual(Math.round(resultZero), 100);

      const resultNegative = convertIQDtoUSD(153000, -100);
      assert.strictEqual(Math.round(resultNegative), 100);
    });

    test('handles 0, null, undefined, and non-numeric inputs gracefully', () => {
      assert.strictEqual(convertIQDtoUSD(0, 153000), 0);
      assert.strictEqual(convertIQDtoUSD(null, 153000), 0);
      assert.strictEqual(convertIQDtoUSD(undefined, 153000), 0);
      assert.strictEqual(convertIQDtoUSD('invalid', 153000), 0);

      assert.strictEqual(convertUSDtoIQD(0, 153000), 0);
      assert.strictEqual(convertUSDtoIQD(null, 153000), 0);
      assert.strictEqual(convertUSDtoIQD(undefined, 153000), 0);
      assert.strictEqual(convertUSDtoIQD('invalid', 153000), 0);
    });

    test('converts Eastern Arabic numerals in strings', () => {
      const fromArabicDigits = convertIQDtoUSD('١٥٣٠٠٠', 153000);
      assert.strictEqual(Math.round(fromArabicDigits), 100);
    });
  });

  describe('formatUSD Formatter Tests', () => {
    test('formats whole dollar amounts with comma separators', () => {
      assert.strictEqual(formatUSD(1000), '$1,000');
      assert.strictEqual(formatUSD(1000000), '$1,000,000');
      assert.strictEqual(formatUSD(0), '$0');
      assert.strictEqual(formatUSD(50), '$50');
    });

    test('formats decimal amounts with cents', () => {
      assert.strictEqual(formatUSD(1250.5), '$1,250.50');
      assert.strictEqual(formatUSD(99.99), '$99.99');
      assert.strictEqual(formatUSD(100.001), '$100');
    });

    test('respects showCents option flag', () => {
      assert.strictEqual(formatUSD(1000, { showCents: true }), '$1,000.00');
      assert.strictEqual(formatUSD(1250.5, { showCents: false }), '$1,251');
    });

    test('handles edge cases safely without crashing', () => {
      assert.strictEqual(formatUSD(null), '$0');
      assert.strictEqual(formatUSD(undefined), '$0');
      assert.strictEqual(formatUSD('invalid'), '$0');
    });
  });

  describe('formatDualCurrencyAmounts Engine Tests', () => {
    test('when activeCurrency is IQD, returns IQD primary and USD secondary with approximation symbol', () => {
      const dual = formatDualCurrencyAmounts(1530000, 153000, 'IQD');
      assert.strictEqual(dual.primaryCurrency, 'IQD');
      assert.strictEqual(dual.secondaryCurrency, 'USD');
      assert.strictEqual(dual.primaryText, '1.530.000 د.ع');
      assert.strictEqual(dual.secondaryText, '≈ $1,000');
      assert.strictEqual(dual.rawPrimaryAmount, 1530000);
      assert.strictEqual(dual.rawSecondaryAmount, 1000);
    });

    test('when activeCurrency is USD, inverts and returns USD primary and IQD secondary', () => {
      const dual = formatDualCurrencyAmounts(1530000, 153000, 'USD');
      assert.strictEqual(dual.primaryCurrency, 'USD');
      assert.strictEqual(dual.secondaryCurrency, 'IQD');
      assert.strictEqual(dual.primaryText, '$1,000');
      assert.strictEqual(dual.secondaryText, '≈ 1.530.000 د.ع');
      assert.strictEqual(dual.rawPrimaryAmount, 1000);
      assert.strictEqual(dual.rawSecondaryAmount, 1530000);
    });

    test('handles privacy masking mode cleanly', () => {
      const maskedIQD = formatDualCurrencyAmounts(1530000, 153000, 'IQD', { isPrivacyActive: true });
      assert.strictEqual(maskedIQD.primaryText, '••••••••');
      assert.strictEqual(maskedIQD.secondaryText, '••••••');

      const maskedUSD = formatDualCurrencyAmounts(1530000, 153000, 'USD', { isPrivacyActive: true });
      assert.strictEqual(maskedUSD.primaryText, '••••••••');
      assert.strictEqual(maskedUSD.secondaryText, '••••••');
    });

    test('handles dynamic custom exchange rate (e.g. 150,000 per 100$)', () => {
      const dual = formatDualCurrencyAmounts(1500000, 150000, 'IQD');
      assert.strictEqual(dual.primaryText, '1.500.000 د.ع');
      assert.strictEqual(dual.secondaryText, '≈ $1,000');
    });
  });
});

