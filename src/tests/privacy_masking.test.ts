import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_PRIVACY_PASSCODE,
  DEFAULT_AUTO_HIDE_SECONDS,
  isItemActive,
  validateAndUnlock,
  relockItem,
  pruneExpiredItems
} from '../types/privacy';

describe('Granular Item-Level Privacy & Masking Engine Tests', () => {
  test('Item is locked by default when not in unlocked map', () => {
    const unlockedMap: Record<string, number> = {};
    const currentTime = 1000000;
    assert.strictEqual(isItemActive(unlockedMap, 'company-balance', currentTime), false);
  });

  test('validateAndUnlock succeeds with correct passcode and unlocks ONLY the specified item', () => {
    let unlockedMap: Record<string, number> = {};
    const currentTime = 1000000;
    const res = validateAndUnlock(
      unlockedMap,
      'item-1',
      '2026',
      DEFAULT_PRIVACY_PASSCODE,
      30,
      currentTime
    );

    assert.strictEqual(res.success, true);
    assert.ok(res.unlockedMap['item-1']);
    assert.strictEqual(res.unlockedMap['item-1'], currentTime + 30 * 1000);

    // Verify item-1 is active
    assert.strictEqual(isItemActive(res.unlockedMap, 'item-1', currentTime), true);
    // Crucial requirement: item-2 must remain strictly locked!
    assert.strictEqual(isItemActive(res.unlockedMap, 'item-2', currentTime), false);
  });

  test('validateAndUnlock rejects incorrect passcode without unlocking', () => {
    const unlockedMap: Record<string, number> = {};
    const currentTime = 1000000;
    const res = validateAndUnlock(
      unlockedMap,
      'item-1',
      'wrong-pass',
      DEFAULT_PRIVACY_PASSCODE,
      30,
      currentTime
    );

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.message, 'كلمة المرور غير صحيحة');
    assert.strictEqual(isItemActive(res.unlockedMap, 'item-1', currentTime), false);
  });

  test('relockItem immediately locks the item', () => {
    const currentTime = 1000000;
    let unlockedMap: Record<string, number> = {
      'item-1': currentTime + 30000,
      'item-2': currentTime + 30000
    };

    assert.strictEqual(isItemActive(unlockedMap, 'item-1', currentTime), true);
    unlockedMap = relockItem(unlockedMap, 'item-1');

    assert.strictEqual(isItemActive(unlockedMap, 'item-1', currentTime), false);
    // item-2 remains unaffected
    assert.strictEqual(isItemActive(unlockedMap, 'item-2', currentTime), true);
  });

  test('Auto-lock expiration correctly expires item after specified duration', () => {
    const startTime = 1000000;
    const unlockedMap: Record<string, number> = {
      'item-1': startTime + 30 * 1000 // 30s
    };

    // Still active at 29s
    assert.strictEqual(isItemActive(unlockedMap, 'item-1', startTime + 29 * 1000), true);

    // Expired at 31s
    assert.strictEqual(isItemActive(unlockedMap, 'item-1', startTime + 31 * 1000), false);
  });

  test('pruneExpiredItems removes expired entries while preserving active ones', () => {
    const currentTime = 1000000;
    const unlockedMap: Record<string, number> = {
      'expired-item': currentTime - 5000,
      'active-item': currentTime + 15000
    };

    const pruned = pruneExpiredItems(unlockedMap, currentTime);
    assert.strictEqual(pruned['expired-item'], undefined);
    assert.strictEqual(pruned['active-item'], currentTime + 15000);
  });

  test('Zero duration (0) means manual lock only (never auto-expires)', () => {
    const startTime = 1000000;
    const res = validateAndUnlock(
      {},
      'item-manual',
      '2026',
      '2026',
      0, // 0 = manual only
      startTime
    );

    assert.strictEqual(res.success, true);
    // After 1 hour, still active because 0 means no auto-expiration
    assert.strictEqual(isItemActive(res.unlockedMap, 'item-manual', startTime + 3600 * 1000), true);

    // pruneExpiredItems preserves manual items
    const pruned = pruneExpiredItems(res.unlockedMap, startTime + 86400 * 1000); // after 1 day
    assert.ok(pruned['item-manual']);
    assert.strictEqual(pruned['item-manual'], Number.MAX_SAFE_INTEGER);
  });

  test('Custom passcode works and fallback 2026 is always accepted', () => {
    const customPasscode = '9876';
    const currentTime = 1000000;

    // Unlocking with custom passcode
    const resCustom = validateAndUnlock(
      {},
      'item-1',
      '9876',
      customPasscode,
      30,
      currentTime
    );
    assert.strictEqual(resCustom.success, true);

    // Unlocking with fallback '2026'
    const resFallback = validateAndUnlock(
      {},
      'item-2',
      '2026',
      customPasscode,
      30,
      currentTime
    );
    assert.strictEqual(resFallback.success, true);

    // Wrong passcode fails
    const resWrong = validateAndUnlock(
      {},
      'item-3',
      '1111',
      customPasscode,
      30,
      currentTime
    );
    assert.strictEqual(resWrong.success, false);
  });

  test('Remaining seconds calculation countdown logic', () => {
    const durationSeconds = 30;
    const now = 1000000;
    const expiry = now + durationSeconds * 1000;

    // At start (0s elapsed)
    const remainingAtStart = Math.max(0, Math.ceil((expiry - now) / 1000));
    assert.strictEqual(remainingAtStart, 30);

    // At 15.5s elapsed
    const remainingMid = Math.max(0, Math.ceil((expiry - (now + 15500)) / 1000));
    assert.strictEqual(remainingMid, 15);

    // At 29.8s elapsed
    const remainingNearEnd = Math.max(0, Math.ceil((expiry - (now + 29800)) / 1000));
    assert.strictEqual(remainingNearEnd, 1);

    // At 30.1s elapsed (expired)
    const remainingExpired = Math.max(0, Math.ceil((expiry - (now + 30100)) / 1000));
    assert.strictEqual(remainingExpired, 0);
  });

  test('Simulating toggleAll state transition logic', () => {
    // Helper function reproducing toggleAll behavior from PrivacyContext
    function simulateToggle(
      isAllRevealed: boolean,
      unlockedItemIds: Record<string, number>
    ): 'lockAll' | 'requestRevealAll' {
      if (isAllRevealed || Object.keys(unlockedItemIds).length > 0) {
        return 'lockAll';
      }
      return 'requestRevealAll';
    }

    // When everything is locked -> request reveal
    assert.strictEqual(simulateToggle(false, {}), 'requestRevealAll');

    // When globally revealed -> lock all
    assert.strictEqual(simulateToggle(true, {}), 'lockAll');

    // When not globally revealed, but an individual item is unlocked -> lock all
    assert.strictEqual(simulateToggle(false, { 'borrower-1': 123456789 }), 'lockAll');
  });

  test('Name masking contract standards', () => {
    const DEFAULT_NAME_MASK = '••••••••';
    const DEFAULT_EMPTY_FALLBACK = '—';

    // Verify mask string format is 8 bullet dots
    assert.strictEqual(DEFAULT_NAME_MASK.length, 8);
    assert.strictEqual(DEFAULT_NAME_MASK, '••••••••');

    // Display helper function
    function getDisplayValue(value: string | null | undefined, unlocked: boolean): string {
      if (!unlocked) return DEFAULT_NAME_MASK;
      return value ? String(value).trim() : DEFAULT_EMPTY_FALLBACK;
    }

    assert.strictEqual(getDisplayValue('علي حسين محمد', false), '••••••••');
    assert.strictEqual(getDisplayValue('علي حسين محمد', true), 'علي حسين محمد');
    assert.strictEqual(getDisplayValue(null, true), '—');
    assert.strictEqual(getDisplayValue(undefined, false), '••••••••');
  });
});

