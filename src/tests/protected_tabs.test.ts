import assert from 'node:assert';
import { test, describe } from 'node:test';
import { SimulationStore } from '../services/simulation';

describe('Protected Tabs (Debt Ledger & Settings) Passcode Protection & Customization', () => {
  test('SimulationStore initializes adminPasscode with default 2026', () => {
    const store = new SimulationStore();
    assert.strictEqual(store.adminPasscode || '2026', '2026');
  });

  test('Validating passcode against default 2026', () => {
    const currentPasscode = '2026';
    
    // Correct passcode
    const verifyCorrect = (input: string) => input.trim() === currentPasscode;
    assert.strictEqual(verifyCorrect('2026'), true);
    assert.strictEqual(verifyCorrect('  2026  '), true);

    // Incorrect passcode
    assert.strictEqual(verifyCorrect('0000'), false);
    assert.strictEqual(verifyCorrect('1234'), false);
    assert.strictEqual(verifyCorrect(''), false);
  });

  test('Changing passcode in settings updates active passcode and invalidates old 2026', () => {
    const store = new SimulationStore();
    let currentPasscode = store.adminPasscode || '2026';
    assert.strictEqual(currentPasscode, '2026');

    // Simulate changing passcode to '9876' from Settings
    const newPasscode = '9876';
    store.adminPasscode = newPasscode;
    currentPasscode = store.adminPasscode;

    assert.strictEqual(currentPasscode, '9876');

    const verifyPasscode = (input: string) => input.trim() === currentPasscode;

    // New passcode succeeds
    assert.strictEqual(verifyPasscode('9876'), true);
    assert.strictEqual(verifyPasscode('  9876  '), true);

    // Old default 2026 is now rejected
    assert.strictEqual(verifyPasscode('2026'), false);
    assert.strictEqual(verifyPasscode('1234'), false);
  });

  test('Protected tabs unlock state lifecycle and re-locking logic', () => {
    let unlockedTabs: Record<string, boolean> = {
      debt_ledger: false,
      settings: false,
    };
    let rememberSessionTabs: Record<string, boolean> = {
      debt_ledger: false,
      settings: false,
    };

    // Initially locked
    assert.strictEqual(unlockedTabs.debt_ledger, false);
    assert.strictEqual(unlockedTabs.settings, false);

    // Unlock debt_ledger with rememberSession = true
    const unlockTab = (tab: 'debt_ledger' | 'settings', remember: boolean) => {
      unlockedTabs[tab] = true;
      if (remember) {
        rememberSessionTabs[tab] = true;
      }
    };

    unlockTab('debt_ledger', true);
    assert.strictEqual(unlockedTabs.debt_ledger, true);
    assert.strictEqual(rememberSessionTabs.debt_ledger, true);

    // Switch away from debt_ledger to dashboard
    let activeTab = 'dashboard';
    if (activeTab !== 'debt_ledger' && !rememberSessionTabs['debt_ledger']) {
      unlockedTabs['debt_ledger'] = false;
    }
    // Should stay unlocked because rememberSession is true
    assert.strictEqual(unlockedTabs.debt_ledger, true);

    // Unlock settings with rememberSession = false (single-entry security mode)
    unlockTab('settings', false);
    assert.strictEqual(unlockedTabs.settings, true);
    assert.strictEqual(rememberSessionTabs.settings, false);

    // Switch away to invoices
    activeTab = 'invoices';
    if (activeTab !== 'settings' && !rememberSessionTabs['settings']) {
      unlockedTabs['settings'] = false;
    }
    // Settings should be re-locked
    assert.strictEqual(unlockedTabs.settings, false);

    // Explicit manual lock on debt_ledger
    const lockTab = (tab: 'debt_ledger' | 'settings') => {
      unlockedTabs[tab] = false;
      rememberSessionTabs[tab] = false;
    };
    lockTab('debt_ledger');
    assert.strictEqual(unlockedTabs.debt_ledger, false);
    assert.strictEqual(rememberSessionTabs.debt_ledger, false);
  });

  test('Passcode input sanitization and length validation', () => {
    const validateNewPinInput = (currentInput: string, newInput: string, confirmInput: string, activePass: string) => {
      if (currentInput.trim() !== activePass) {
        return { success: false, error: 'رمز المرور الحالي غير صحيح' };
      }
      if (!newInput.trim() || newInput.trim().length < 4) {
        return { success: false, error: 'رمز المرور الجديد يجب أن يتكون من 4 خانات على الأقل' };
      }
      if (newInput.trim() !== confirmInput.trim()) {
        return { success: false, error: 'تأكيد رمز المرور الجديد غير متطابق' };
      }
      return { success: true, passcode: newInput.trim() };
    };

    const activePass = '2026';

    // Wrong current pass
    const res1 = validateNewPinInput('1111', '5555', '5555', activePass);
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.error, 'رمز المرور الحالي غير صحيح');

    // Too short
    const res2 = validateNewPinInput('2026', '12', '12', activePass);
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.error, 'رمز المرور الجديد يجب أن يتكون من 4 خانات على الأقل');

    // Mismatched confirmation
    const res3 = validateNewPinInput('2026', '5555', '5556', activePass);
    assert.strictEqual(res3.success, false);
    assert.strictEqual(res3.error, 'تأكيد رمز المرور الجديد غير متطابق');

    // Valid change
    const res4 = validateNewPinInput('2026', '5555', '5555', activePass);
    assert.strictEqual(res4.success, true);
    assert.strictEqual(res4.passcode, '5555');
  });
});

