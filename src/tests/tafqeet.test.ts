import assert from 'node:assert';
import { test, describe } from 'node:test';
import { tafqeetIQD, numberToArabicWords } from '../utils/tafqeet';

describe('Arabic Tafqeet (Number to Words) Tests', () => {
  test('handles 0 correctly', () => {
    assert.strictEqual(tafqeetIQD(0), 'فقط صفر دينار عراقي لا غير');
  });

  test('converts basic thousands', () => {
    assert.strictEqual(tafqeetIQD(1000), 'فقط ألف دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(2000), 'فقط ألفان دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(5000), 'فقط خمسة آلاف دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(50000), 'فقط خمسون ألفاً دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(500000), 'فقط خمسمائة ألفاً دينار عراقي لا غير');
  });

  test('converts millions correctly', () => {
    assert.strictEqual(tafqeetIQD(1000000), 'فقط مليون دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(2000000), 'فقط مليونان دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(5000000), 'فقط خمسة ملايين دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(10000000), 'فقط عشرة ملايين دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(15000000), 'فقط خمسة عشر مليوناً دينار عراقي لا غير');
  });

  test('converts composite complex amounts', () => {
    assert.strictEqual(
      tafqeetIQD(5250000),
      'فقط خمسة ملايين ومائتان وخمسون ألفاً دينار عراقي لا غير'
    );
    assert.strictEqual(
      tafqeetIQD(10500750),
      'فقط عشرة ملايين وخمسمائة ألفاً وسبعمائة وخمسون دينار عراقي لا غير'
    );
  });

  test('converts billions correctly', () => {
    assert.strictEqual(tafqeetIQD(1000000000), 'فقط مليار دينار عراقي لا غير');
    assert.strictEqual(tafqeetIQD(2000000000), 'فقط ملياران دينار عراقي لا غير');
  });
});
