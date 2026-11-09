/**
 * Tafqeet: Arabic Numbers to Words Converter specifically tailored for Iraqi Dinars (IQD).
 * Transforms numerical values into formal Arabic financial wording.
 */

const ONES: string[] = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر'
];

const TENS: string[] = [
  '',
  '',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون'
];

const HUNDREDS: string[] = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة'
];

/**
 * Converts a 3-digit number (1..999) into Arabic words.
 */
function convertThreeDigits(num: number): string {
  if (num === 0) return '';

  const h = Math.floor(num / 100);
  const remainder = num % 100;
  const parts: string[] = [];

  if (h > 0) {
    parts.push(HUNDREDS[h]);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ONES[remainder]);
    } else {
      const t = Math.floor(remainder / 10);
      const o = remainder % 10;
      if (o > 0) {
        parts.push(`${ONES[o]} و${TENS[t]}`);
      } else {
        parts.push(TENS[t]);
      }
    }
  }

  return parts.join(' و');
}

/**
 * Convert any integer into Arabic words without currency suffix.
 */
export function numberToArabicWords(n: number): string {
  const value = Math.floor(Math.abs(n));
  if (value === 0) return 'صفر';

  const parts: string[] = [];

  // Billions (مليارات)
  const billions = Math.floor(value / 1_000_000_000);
  const remBillions = value % 1_000_000_000;
  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(`${ONES[billions]} مليارات`);
    else parts.push(`${convertThreeDigits(billions)} ملياراً`);
  }

  // Millions (ملايين)
  const millions = Math.floor(remBillions / 1_000_000);
  const remMillions = remBillions % 1_000_000;
  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${ONES[millions]} ملايين`);
    else parts.push(`${convertThreeDigits(millions)} مليوناً`);
  }

  // Thousands (آلاف)
  const thousands = Math.floor(remMillions / 1_000);
  const remThousands = remMillions % 1_000;
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${ONES[thousands]} آلاف`);
    else parts.push(`${convertThreeDigits(thousands)} ألفاً`);
  }

  // Hundreds & Under
  if (remThousands > 0) {
    parts.push(convertThreeDigits(remThousands));
  }

  return parts.join(' و');
}

/**
 * Full formal Iraqi Dinar Tafqeet for financial receipts and contracts.
 * e.g. "فقط خمسة ملايين دينار عراقي لا غيرها"
 */
export function tafqeetIQD(amount: number): string {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'فقط صفر دينار عراقي لا غير';

  const words = numberToArabicWords(num);
  return `فقط ${words} دينار عراقي لا غير`;
}
