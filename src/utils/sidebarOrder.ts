export const SIDEBAR_ORDER_STORAGE_KEY = 'aman_sidebar_order';

export const DEFAULT_SIDEBAR_ITEM_IDS = [
  'dashboard',
  'company_fund',
  'investors',
  'referrals',
  'borrowers',
  'overdue',
  'credit_score',
  'funds',
  'inventory',
  'invoices',
  'expenses',
  'revenues',
  'reports',
  'debt_ledger',
  'employees',
  'trash',
  'settings',
] as const;

/**
 * Merges a user-saved order with the canonical list of menu item IDs.
 * Keeps valid saved items in their custom order and appends any new items at the end.
 */
export function resolveSidebarOrder(
  savedIds: unknown,
  defaultIds: readonly string[] = DEFAULT_SIDEBAR_ITEM_IDS
): string[] {
  if (!Array.isArray(savedIds)) {
    return [...defaultIds];
  }

  const allowedSet = new Set(defaultIds);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of savedIds) {
    if (typeof id === 'string' && allowedSet.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  for (const id of defaultIds) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

/**
 * Moves a sidebar item one step up or down in the order array.
 */
export function moveSidebarItem(
  order: readonly string[],
  itemId: string,
  direction: 'up' | 'down'
): string[] {
  const index = order.indexOf(itemId);
  if (index === -1) return [...order];

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= order.length) {
    return [...order];
  }

  const next = [...order];
  const temp = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = temp;
  return next;
}

export function loadSavedSidebarOrder(
  defaultIds: readonly string[] = DEFAULT_SIDEBAR_ITEM_IDS
): string[] {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return [...defaultIds];
  }
  try {
    const raw = window.localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY);
    if (!raw) return [...defaultIds];
    const parsed = JSON.parse(raw);
    return resolveSidebarOrder(parsed, defaultIds);
  } catch {
    return [...defaultIds];
  }
}

export function saveSidebarOrder(order: readonly string[]): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Ignore storage quota errors
  }
}

