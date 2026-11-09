/**
 * Unified Formatting & Digit Standardization Utilities
 * Enforces English (Western Arabic 0-9) numerals throughout the entire application.
 */

import { DEFAULT_EXCHANGE_RATE_PER_100, ActiveCurrency, DualCurrencyFormatted } from '@/types/currency';

// Eastern Arabic (٠-٩) and Persian (۰-۹) numerals mapping
const ARABIC_PERSIAN_DIGITS_MAP: Record<string, string> = {
  '٠': '0', '۰': '0',
  '١': '1', '۱': '1',
  '٢': '2', '۲': '2',
  '٣': '3', '۳': '3',
  '٤': '4', '۴': '4',
  '٥': '5', '۵': '5',
  '٦': '6', '۶': '6',
  '٧': '7', '۷': '7',
  '٨': '8', '۸': '8',
  '٩': '9', '۹': '9',
};

const ARABIC_DIGITS_REGEX = /[٠-٩۰-۹]/g;

/**
 * Converts any Eastern Arabic or Persian numerals in a string to standard English numerals (0-9).
 */
export function toEnglishDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!ARABIC_DIGITS_REGEX.test(str)) {
    return str;
  }
  return str.replace(ARABIC_DIGITS_REGEX, (char) => ARABIC_PERSIAN_DIGITS_MAP[char] || char);
}

/**
 * Standard Iraqi Dinar dot-separated thousands formatter (e.g. 1.000.000, 250.000).
 * Always outputs English digits.
 */
export function formatIQD(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0';
  const cleanStr = typeof amount === 'string' ? toEnglishDigits(amount) : amount;
  const num = typeof cleanStr === 'string' ? parseFloat(cleanStr) : cleanStr;
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Standard comma-separated number formatter (e.g. 1,000,000).
 * Always outputs English digits.
 */
export function formatNumber(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0';
  const cleanStr = typeof amount === 'string' ? toEnglishDigits(amount) : amount;
  const num = typeof cleanStr === 'string' ? parseFloat(cleanStr) : cleanStr;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US');
}

/**
 * Currency formatter with privacy toggle support.
 * Always formats numbers with English digits and appends Iraqi Dinar symbol "د.ع".
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  isPrivacyActive: boolean = false,
  useDots: boolean = false
): string {
  if (isPrivacyActive) return '••••••••';
  const formatted = useDots ? formatIQD(amount) : formatNumber(amount);
  return `${formatted} د.ع`;
}

/**
 * US Dollar currency formatter.
 * Formats amounts with English digits and prepends '$' symbol (e.g. $1,250 or $1,250.50).
 */
export function formatUSD(
  amount: number | string | null | undefined,
  options?: { showCents?: boolean; compact?: boolean }
): string {
  if (amount === null || amount === undefined) return '$0';
  const cleanStr = typeof amount === 'string' ? toEnglishDigits(amount) : amount;
  const num = typeof cleanStr === 'string' ? parseFloat(cleanStr) : cleanStr;
  if (isNaN(num)) return '$0';

  const cents = Math.round(Math.abs(num) * 100) % 100;
  const hasSignificantCents = cents > 0;
  const shouldShowCents = options?.showCents !== undefined ? options.showCents : hasSignificantCents;

  const valueToFormat = shouldShowCents ? num : Math.round(num);

  const formattedNum = valueToFormat.toLocaleString('en-US', {
    minimumFractionDigits: shouldShowCents ? 2 : 0,
    maximumFractionDigits: shouldShowCents ? 2 : 0,
  });

  return `$${formattedNum}`;
}

/**
 * Converts an Iraqi Dinar amount to US Dollar based on exchange rate per 100 USD.
 * Formula: (amountIQD / ratePer100) * 100
 */
export function convertIQDtoUSD(
  amountIQD: number | string | null | undefined,
  ratePer100: number = DEFAULT_EXCHANGE_RATE_PER_100
): number {
  if (amountIQD === null || amountIQD === undefined) return 0;
  const cleanStr = typeof amountIQD === 'string' ? toEnglishDigits(amountIQD) : amountIQD;
  const num = typeof cleanStr === 'string' ? parseFloat(cleanStr) : cleanStr;
  if (isNaN(num) || num === 0) return 0;
  const safeRate = ratePer100 > 0 ? ratePer100 : DEFAULT_EXCHANGE_RATE_PER_100;
  return (num / safeRate) * 100;
}

/**
 * Converts a US Dollar amount to Iraqi Dinar based on exchange rate per 100 USD.
 * Formula: (amountUSD * ratePer100) / 100
 */
export function convertUSDtoIQD(
  amountUSD: number | string | null | undefined,
  ratePer100: number = DEFAULT_EXCHANGE_RATE_PER_100
): number {
  if (amountUSD === null || amountUSD === undefined) return 0;
  const cleanStr = typeof amountUSD === 'string' ? toEnglishDigits(amountUSD) : amountUSD;
  const num = typeof cleanStr === 'string' ? parseFloat(cleanStr) : cleanStr;
  if (isNaN(num) || num === 0) return 0;
  const safeRate = ratePer100 > 0 ? ratePer100 : DEFAULT_EXCHANGE_RATE_PER_100;
  return (num * safeRate) / 100;
}

/**
 * Formats an amount with both primary and secondary currencies.
 * When activeCurrency is 'IQD', IQD is primary and USD is secondary.
 * When activeCurrency is 'USD', USD is primary and IQD is secondary.
 */
export function formatDualCurrencyAmounts(
  amountIQD: number | string | null | undefined,
  ratePer100: number = DEFAULT_EXCHANGE_RATE_PER_100,
  activeCurrency: ActiveCurrency = 'IQD',
  options?: { hideSub?: boolean; compact?: boolean; isPrivacyActive?: boolean }
): DualCurrencyFormatted {
  if (options?.isPrivacyActive) {
    return {
      primaryText: '••••••••',
      secondaryText: '••••••',
      primaryCurrency: activeCurrency,
      secondaryCurrency: activeCurrency === 'IQD' ? 'USD' : 'IQD',
      rawPrimaryAmount: 0,
      rawSecondaryAmount: 0,
    };
  }

  let safeIQD = 0;
  if (amountIQD !== null && amountIQD !== undefined) {
    const cleanStr = typeof amountIQD === 'string' ? toEnglishDigits(amountIQD) : amountIQD;
    const parsed = typeof cleanStr === 'string' ? parseFloat(cleanStr) : Number(cleanStr);
    if (!isNaN(parsed)) {
      safeIQD = parsed;
    }
  }
  const numUSD = convertIQDtoUSD(safeIQD, ratePer100);

  if (activeCurrency === 'USD') {
    return {
      primaryText: formatUSD(numUSD, { showCents: Math.abs(numUSD % 1) > 0.001 }),
      secondaryText: `≈ ${formatIQD(safeIQD)} د.ع`,
      primaryCurrency: 'USD',
      secondaryCurrency: 'IQD',
      rawPrimaryAmount: numUSD,
      rawSecondaryAmount: safeIQD,
    };
  }

  return {
    primaryText: `${formatIQD(safeIQD)} د.ع`,
    secondaryText: `≈ ${formatUSD(numUSD, { showCents: Math.abs(numUSD % 1) > 0.001 })}`,
    primaryCurrency: 'IQD',
    secondaryCurrency: 'USD',
    rawPrimaryAmount: safeIQD,
    rawSecondaryAmount: numUSD,
  };
}

/**
 * Date formatter guaranteeing English digits while preserving Arabic words for month and day.
 * Uses the 'ar-IQ-u-nu-latn' Unicode locale extension.
 */
export function formatDate(
  dateInput: string | Date | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '—';
  try {
    const date = typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);

    const defaultOptions: Intl.DateTimeFormatOptions = options || {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };

    return date.toLocaleDateString('ar-IQ-u-nu-latn', defaultOptions);
  } catch {
    return String(dateInput);
  }
}

/**
 * Time formatter guaranteeing English digits while preserving Arabic (ص / م) indicator.
 * Uses the 'ar-IQ-u-nu-latn' Unicode locale extension.
 */
export function formatTime(
  dateInput?: string | Date | number | null,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const date = !dateInput
      ? new Date()
      : typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;

    if (isNaN(date.getTime())) return '';

    const defaultOptions: Intl.DateTimeFormatOptions = options || {
      hour: '2-digit',
      minute: '2-digit'
    };

    return date.toLocaleTimeString('ar-IQ-u-nu-latn', defaultOptions);
  } catch {
    return '';
  }
}

/**
 * Full Date & Time formatter guaranteeing English digits throughout.
 */
export function formatDateTime(
  dateInput?: string | Date | number | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '—';
  try {
    const date = typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;

    if (isNaN(date.getTime())) return String(dateInput);

    const defaultOptions: Intl.DateTimeFormatOptions = options || {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    return date.toLocaleString('ar-IQ-u-nu-latn', defaultOptions);
  } catch {
    return String(dateInput);
  }
}
