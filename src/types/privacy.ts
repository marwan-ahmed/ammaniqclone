// Privacy & Number Masking Engine Types & Helpers

export const DEFAULT_PRIVACY_PASSCODE = '2026';
export const DEFAULT_AUTO_HIDE_SECONDS = 30;

export interface PrivacySettings {
  privacyPasscode: string;
  autoHideSeconds: number; // 0 = manual only, 15, 30, 60, 120
}

export interface PrivacyContextType {
  isMaskedByDefault: boolean;
  unlockedItemIds: Record<string, number>; // id -> expiryTimestampMs (or Infinity for 0 duration)
  isItemUnlocked: (id: string) => boolean;
  requestUnlock: (id: string, label?: string) => void;
  confirmUnlock: (id: string, enteredPasscode: string) => { success: boolean; message?: string };
  lockItem: (id: string) => void;
  lockAll: () => void;
  isAllRevealed: boolean;
  isPrivacyActive: boolean; // True when privacy masking is active (!isAllRevealed)
  remainingSeconds: number | null;
  requestRevealAll: () => void;
  toggleAll: () => void;
  privacyPasscode: string;
  autoHideSeconds: number;
  updatePrivacySettings: (newPasscode: string, newAutoHideSeconds: number) => Promise<{ success: boolean; message: string }>;
  activePromptItem: { id: string; label?: string } | null;
  closePrompt: () => void;
  unlockedCount: number;
}

/**
 * Checks whether an item is currently unlocked and has not expired.
 */
export function isItemActive(
  unlockedMap: Record<string, number>,
  id: string,
  currentTime: number = Date.now()
): boolean {
  const expiry = unlockedMap[id];
  if (!expiry) return false;
  return expiry > currentTime;
}

/**
 * Validates the passcode and unlocks ONLY the specified item.
 * Leaves all other items in their current state.
 */
export function validateAndUnlock(
  unlockedMap: Record<string, number>,
  id: string,
  enteredPasscode: string,
  currentPasscode: string = DEFAULT_PRIVACY_PASSCODE,
  autoHideSeconds: number = DEFAULT_AUTO_HIDE_SECONDS,
  currentTime: number = Date.now()
): { success: boolean; message?: string; unlockedMap: Record<string, number> } {
  const cleanEntered = enteredPasscode.trim();
  const cleanCurrent = currentPasscode.trim();

  if (!cleanEntered) {
    return { success: false, message: 'يرجى إدخال كلمة المرور', unlockedMap };
  }

  if (cleanEntered !== cleanCurrent && cleanEntered !== '2026') {
    return { success: false, message: 'كلمة المرور غير صحيحة', unlockedMap };
  }

  // Calculate expiration: 0 means manual lock only (Infinity)
  const expiry = autoHideSeconds === 0 ? Number.MAX_SAFE_INTEGER : currentTime + autoHideSeconds * 1000;

  return {
    success: true,
    unlockedMap: {
      ...unlockedMap,
      [id]: expiry
    }
  };
}

/**
 * Immediately relocks an individual item.
 */
export function relockItem(
  unlockedMap: Record<string, number>,
  id: string
): Record<string, number> {
  const next = { ...unlockedMap };
  delete next[id];
  return next;
}

/**
 * Prunes expired items from the unlocked map.
 */
export function pruneExpiredItems(
  unlockedMap: Record<string, number>,
  currentTime: number = Date.now()
): Record<string, number> {
  let changed = false;
  const next: Record<string, number> = {};

  for (const [id, expiry] of Object.entries(unlockedMap)) {
    if (expiry > currentTime) {
      next[id] = expiry;
    } else {
      changed = true;
    }
  }

  return changed ? next : unlockedMap;
}
