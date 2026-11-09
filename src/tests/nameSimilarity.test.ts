import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  normalizeArabicText,
  normalizePhoneNumber,
  extractFirstName,
  findDuplicateMatches
} from '../utils/nameSimilarity';

describe('Arabic Name Similarity & Duplicate Detection Tests', () => {
  test('normalizeArabicText normalizes Alefs, Taa Marbuta, Yaa, and Tashkeel', () => {
    assert.strictEqual(normalizeArabicText('  أَحْمَدُ  '), 'احمد');
    assert.strictEqual(normalizeArabicText('إِيَاد'), 'اياد');
    assert.strictEqual(normalizeArabicText('آمنة'), 'امنه');
    assert.strictEqual(normalizeArabicText('عَلِيّ'), 'علي');
    assert.strictEqual(normalizeArabicText('مُصْطَفَى'), 'مصطفي');
    assert.strictEqual(normalizeArabicText('عَبْدُ الرَّحْمَنِ'), 'عبد الرحمن');
    assert.strictEqual(normalizeArabicText('مـحـمـد'), 'محمد'); // Kashida
  });

  test('normalizePhoneNumber cleans Iraqi phone number formats', () => {
    assert.strictEqual(normalizePhoneNumber('0770 123 4567'), '07701234567');
    assert.strictEqual(normalizePhoneNumber('+9647701234567'), '07701234567');
    assert.strictEqual(normalizePhoneNumber('009647701234567'), '07701234567');
    assert.strictEqual(normalizePhoneNumber('0770-123-4567'), '07701234567');
  });

  test('extractFirstName retrieves first name token', () => {
    assert.strictEqual(extractFirstName('أحمد إياد علي'), 'احمد');
    assert.strictEqual(extractFirstName('محمد جاسم'), 'محمد');
    assert.strictEqual(extractFirstName('   '), '');
  });

  test('findDuplicateMatches detects exact name duplicate with different spelling', () => {
    const existingList = [
      { id: '1', name: 'أحمد إياد', phone: '07701111111' },
      { id: '2', name: 'علي حسن', phone: '07702222222' }
    ];

    // User inputs 'احمد اياد' (without Hamzas)
    const result = findDuplicateMatches('احمد اياد', '07703333333', existingList);
    assert.strictEqual(result.exactNameMatches.length, 1);
    assert.strictEqual(result.exactNameMatches[0].name, 'أحمد إياد');
    assert.strictEqual(result.hasHighRiskDuplicate, true);
  });

  test('findDuplicateMatches detects first name match and partial match', () => {
    const existingList = [
      { id: '1', name: 'محمد علي حسن', phone: '07701111111' },
      { id: '2', name: 'محمد جاسم', phone: '07702222222' },
      { id: '3', name: 'سيف الدين', phone: '07703333333' }
    ];

    // User inputs 'محمد فاروق' -> first name matches both 'محمد علي حسن' and 'محمد جاسم'
    const result1 = findDuplicateMatches('محمد فاروق', '07709999999', existingList);
    assert.strictEqual(result1.exactNameMatches.length, 0);
    assert.strictEqual(result1.firstNameMatches.length, 2);
    assert.strictEqual(result1.hasWarningDuplicate, true);

    // User inputs 'محمد علي' -> partial match with 'محمد علي حسن'
    const result2 = findDuplicateMatches('محمد علي', '07709999999', existingList);
    assert.strictEqual(result2.exactNameMatches.length, 0);
    assert.strictEqual(result2.partialNameMatches.length, 1);
    assert.strictEqual(result2.partialNameMatches[0].name, 'محمد علي حسن');
  });

  test('findDuplicateMatches detects phone duplicate', () => {
    const existingList = [
      { id: '1', name: 'عمر خالد', phone: '07705554433' }
    ];

    const result = findDuplicateMatches('خالد وليد', '0770-555-4433', existingList);
    assert.strictEqual(result.phoneMatches.length, 1);
    assert.strictEqual(result.phoneMatches[0].name, 'عمر خالد');
    assert.strictEqual(result.hasHighRiskDuplicate, true);
  });
});
