import assert from 'node:assert';
import { test, describe } from 'node:test';
import { SYSTEM_PERMISSIONS, SYSTEM_ADMIN_EMPLOYEE, SystemPermission } from '../types/finance';

describe('System Permissions (RBAC) Granular & Interactive Permissions Engine Tests', () => {
  test('SYSTEM_PERMISSIONS contains exactly 35 comprehensive granular permissions', () => {
    assert.strictEqual(SYSTEM_PERMISSIONS.length, 35);
  });

  test('All 35 permission IDs are unique without any duplicate definitions', () => {
    const ids = SYSTEM_PERMISSIONS.map(p => p.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, 35);
  });

  test('All permissions have explicit Arabic names, descriptions, categories, and action types', () => {
    const validActionTypes = new Set(['VIEW', 'CREATE', 'EDIT', 'DELETE', 'FINANCIAL', 'PRINT', 'SECURITY']);
    const validCategories = new Set([
      'لوحة التحكم والمحاسبة',
      'المستثمرون والمحافظ',
      'الزبائن والعقود',
      'المخزن والأصول',
      'المصاريف والإيرادات',
      'الإدارة والنظام'
    ]);

    SYSTEM_PERMISSIONS.forEach(p => {
      assert.ok(p.id && p.id.trim().length > 0, `Permission must have valid ID: ${p.id}`);
      assert.ok(p.name && p.name.trim().length > 0, `Permission must have non-empty name: ${p.id}`);
      assert.ok(p.description && p.description.trim().length > 0, `Permission must have non-empty description: ${p.id}`);
      assert.ok(validCategories.has(p.category), `Invalid category: ${p.category} on ${p.id}`);
      assert.ok(validActionTypes.has(p.actionType), `Invalid actionType: ${p.actionType} on ${p.id}`);
    });
  });

  test('All 17 original core permission IDs are preserved for 100% backwards compatibility', () => {
    const permMap = new Map(SYSTEM_PERMISSIONS.map(p => [p.id, p]));
    const original17 = [
      'DASHBOARD_VIEW', 'COMPANY_FUND_MANAGE', 'FUNDS_MANAGE', 'REPORTS_VIEW',
      'INVESTORS_MANAGE', 'REFERRALS_MANAGE', 'BORROWERS_MANAGE', 'OVERDUE_MANAGE',
      'CREDIT_SCORE_VIEW', 'CONTRACTS_CREATE', 'DEBT_LEDGER_MANAGE', 'INVENTORY_MANAGE',
      'EXPENSES_MANAGE', 'REVENUES_MANAGE', 'EMPLOYEES_MANAGE', 'SETTINGS_MANAGE',
      'TRASH_MANAGE'
    ];

    original17.forEach(id => {
      assert.ok(permMap.has(id), `Original permission ID ${id} must exist in expanded system permissions`);
    });
  });

  test('SYSTEM_ADMIN_EMPLOYEE has all 35 permissions', () => {
    assert.strictEqual(SYSTEM_ADMIN_EMPLOYEE.permissions.length, 35);
    SYSTEM_PERMISSIONS.forEach(p => {
      assert.ok(
        SYSTEM_ADMIN_EMPLOYEE.permissions.includes(p.id),
        `Admin employee must include permission ${p.id}`
      );
    });
  });

  test('Permissions are grouped into exactly 6 clear financial & operational categories', () => {
    const categories = new Set(SYSTEM_PERMISSIONS.map(p => p.category));
    assert.strictEqual(categories.size, 6);
    assert.ok(categories.has('لوحة التحكم والمحاسبة'));
    assert.ok(categories.has('المستثمرون والمحافظ'));
    assert.ok(categories.has('الزبائن والعقود'));
    assert.ok(categories.has('المخزن والأصول'));
    assert.ok(categories.has('المصاريف والإيرادات'));
    assert.ok(categories.has('الإدارة والنظام'));
  });

  test('Action types cover all key user operational categories', () => {
    const actions = new Set(SYSTEM_PERMISSIONS.map(p => p.actionType));
    assert.ok(actions.has('VIEW'), 'Must have VIEW permissions');
    assert.ok(actions.has('CREATE'), 'Must have CREATE permissions');
    assert.ok(actions.has('EDIT'), 'Must have EDIT permissions');
    assert.ok(actions.has('DELETE'), 'Must have DELETE permissions');
    assert.ok(actions.has('FINANCIAL'), 'Must have FINANCIAL permissions');
    assert.ok(actions.has('PRINT'), 'Must have PRINT permissions');
    assert.ok(actions.has('SECURITY'), 'Must have SECURITY permissions');
  });
});

