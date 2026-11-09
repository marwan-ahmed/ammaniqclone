import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_SIDEBAR_ITEM_IDS,
  SIDEBAR_ORDER_STORAGE_KEY,
  resolveSidebarOrder,
  moveSidebarItem,
  loadSavedSidebarOrder,
  saveSidebarOrder,
} from '../utils/sidebarOrder';

describe('Sidebar Menu Reordering (تعديل أماكن أزرار القائمة الجانبية)', () => {
  test('resolveSidebarOrder preserves custom order and appends missing default items', () => {
    const customSaved = ['debt_ledger', 'investors', 'dashboard'];
    const resolved = resolveSidebarOrder(customSaved, DEFAULT_SIDEBAR_ITEM_IDS);

    assert.strictEqual(resolved[0], 'debt_ledger');
    assert.strictEqual(resolved[1], 'investors');
    assert.strictEqual(resolved[2], 'dashboard');
    assert.strictEqual(resolved.length, DEFAULT_SIDEBAR_ITEM_IDS.length);
  });

  test('resolveSidebarOrder ignores invalid or duplicate IDs and handles non-array input', () => {
    const resolvedFromInvalid = resolveSidebarOrder(['unknown_tab', 'investors', 'investors'], [
      'dashboard',
      'investors',
      'funds',
    ]);
    assert.deepStrictEqual(resolvedFromInvalid, ['investors', 'dashboard', 'funds']);

    const resolvedFromNull = resolveSidebarOrder(null, ['dashboard', 'investors']);
    assert.deepStrictEqual(resolvedFromNull, ['dashboard', 'investors']);
  });

  test('moveSidebarItem moves an item up and down and respects array boundaries', () => {
    const initial = ['dashboard', 'company_fund', 'investors', 'referrals'];

    // Move 'investors' up -> index 2 to index 1
    const movedUp = moveSidebarItem(initial, 'investors', 'up');
    assert.deepStrictEqual(movedUp, ['dashboard', 'investors', 'company_fund', 'referrals']);

    // Move 'investors' down -> index 1 back to index 2
    const movedDown = moveSidebarItem(movedUp, 'investors', 'down');
    assert.deepStrictEqual(movedDown, initial);

    // Moving first item 'up' does nothing
    const moveFirstUp = moveSidebarItem(initial, 'dashboard', 'up');
    assert.deepStrictEqual(moveFirstUp, initial);

    // Moving last item 'down' does nothing
    const moveLastDown = moveSidebarItem(initial, 'referrals', 'down');
    assert.deepStrictEqual(moveLastDown, initial);
  });

  test('saveSidebarOrder and loadSavedSidebarOrder persist and restore custom order via localStorage', () => {
    const storeMap = new Map<string, string>();
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = {
      localStorage: {
        getItem: (key: string) => storeMap.get(key) ?? null,
        setItem: (key: string, val: string) => {
          storeMap.set(key, val);
        },
      },
    };

    try {
      const sampleDefaults = ['dashboard', 'investors', 'borrowers'];
      const customOrder = ['borrowers', 'dashboard', 'investors'];

      saveSidebarOrder(customOrder);
      assert.strictEqual(
        storeMap.get(SIDEBAR_ORDER_STORAGE_KEY),
        JSON.stringify(customOrder)
      );

      const loaded = loadSavedSidebarOrder(sampleDefaults);
      assert.deepStrictEqual(loaded, customOrder);
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });
});

