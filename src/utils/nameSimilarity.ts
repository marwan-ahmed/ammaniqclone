import { toEnglishDigits } from './formatters';

// Arabic Name Similarity and Duplicate Detection Engine
// Supports Exact Match, First Name Match, Partial Substring, and Phone Duplicate Checking

/**
 * Normalizes Arabic text by standardizing letter variations, removing diacritics and kashida.
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';

  return (
    text
      .trim()
      // Remove Arabic diacritics (Harakat / Tashkeel) and Tatweel / Kashida
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      // Standardize Alef forms (أ, إ, آ, ٱ) -> ا
      .replace(/[أإآٱ]/g, 'ا')
      // Standardize Taa Marbuta (ة) -> ه
      .replace(/ة/g, 'ه')
      // Standardize Yaa forms (ى, ئ) -> ي
      .replace(/[ىئ]/g, 'ي')
      // Standardize Waw with Hamza (ؤ) -> و
      .replace(/ؤ/g, 'و')
      // Replace multiple whitespace characters with a single space
      .replace(/\s+/g, ' ')
      .toLowerCase()
  );
}

/**
 * Normalizes a phone number by stripping spaces, dashes, country codes prefix (+964 or 00964).
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = toEnglishDigits(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+964')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('00964')) {
    cleaned = '0' + cleaned.slice(5);
  }
  return cleaned;
}

/**
 * Extracts first name token from a full name.
 */
export function extractFirstName(name: string): string {
  const normalized = normalizeArabicText(name);
  if (!normalized) return '';
  const parts = normalized.split(' ').filter(Boolean);
  return parts[0] || '';
}

export interface DuplicateMatchResult<T> {
  exactNameMatches: T[];
  firstNameMatches: T[];
  partialNameMatches: T[];
  phoneMatches: T[];
  hasHighRiskDuplicate: boolean;
  hasWarningDuplicate: boolean;
}

/**
 * Checks an input name and phone against an existing list of entities (investors, borrowers, etc.)
 */
export function findDuplicateMatches<
  T extends { id: string; name: string; phone?: string; [key: string]: any }
>(
  inputName: string,
  inputPhone: string | undefined,
  existingList: T[],
  currentIdToExclude?: string
): DuplicateMatchResult<T> {
  const normInputName = normalizeArabicText(inputName);
  const inputFirstName = extractFirstName(inputName);
  const normInputPhone = inputPhone ? normalizePhoneNumber(inputPhone) : '';

  const exactNameMatches: T[] = [];
  const firstNameMatches: T[] = [];
  const partialNameMatches: T[] = [];
  const phoneMatches: T[] = [];

  if (!normInputName && !normInputPhone) {
    return {
      exactNameMatches: [],
      firstNameMatches: [],
      partialNameMatches: [],
      phoneMatches: [],
      hasHighRiskDuplicate: false,
      hasWarningDuplicate: false,
    };
  }

  const candidateList = currentIdToExclude
    ? existingList.filter((item) => item.id !== currentIdToExclude)
    : existingList;

  for (const item of candidateList) {
    const normItemName = normalizeArabicText(item.name);
    const itemFirstName = extractFirstName(item.name);
    const normItemPhone = item.phone ? normalizePhoneNumber(item.phone) : '';

    // 1. Phone number match
    if (normInputPhone && normInputPhone.length >= 8 && normItemPhone && normItemPhone === normInputPhone) {
      phoneMatches.push(item);
    }

    if (normInputName.length >= 2) {
      // 2. Exact match (100% normalized letters match)
      if (normInputName === normItemName) {
        exactNameMatches.push(item);
        continue; // Exact match already captured
      }

      // 3. Partial substring match (e.g. "أحمد إياد" vs "أحمد إياد علي" or "علي عبد الحسين" vs "علي عبدالحسين")
      const normInputNoSpace = normInputName.replace(/\s+/g, '');
      const normItemNoSpace = normItemName.replace(/\s+/g, '');

      if (
        (normInputNoSpace.length >= 4 && normItemNoSpace.includes(normInputNoSpace)) ||
        (normItemNoSpace.length >= 4 && normInputNoSpace.includes(normItemNoSpace))
      ) {
        partialNameMatches.push(item);
        continue;
      }

      // 4. First name match (if first name has at least 3 letters, e.g. "محمد", "أحمد", "علي", "سيف", "عمر")
      if (inputFirstName && inputFirstName.length >= 3 && inputFirstName === itemFirstName) {
        firstNameMatches.push(item);
      }
    }
  }

  const hasHighRiskDuplicate = exactNameMatches.length > 0 || phoneMatches.length > 0;
  const hasWarningDuplicate =
    !hasHighRiskDuplicate && (firstNameMatches.length > 0 || partialNameMatches.length > 0);

  return {
    exactNameMatches,
    firstNameMatches,
    partialNameMatches,
    phoneMatches,
    hasHighRiskDuplicate,
    hasWarningDuplicate,
  };
}
