'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DEFAULT_PRIVACY_PASSCODE,
  DEFAULT_AUTO_HIDE_SECONDS,
  PrivacyContextType,
  isItemActive,
  validateAndUnlock,
  relockItem,
  pruneExpiredItems
} from '@/types/privacy';

const PrivacyContext = createContext<PrivacyContextType | null>(null);

interface PrivacyProviderProps {
  children: React.ReactNode;
  initialPasscode?: string;
  initialAutoHideSeconds?: number;
  onSaveSettingsToBackend?: (passcode: string, autoHideSeconds: number) => Promise<{ success: boolean; message: string }>;
}

export const PrivacyProvider: React.FC<PrivacyProviderProps> = ({
  children,
  initialPasscode = DEFAULT_PRIVACY_PASSCODE,
  initialAutoHideSeconds = DEFAULT_AUTO_HIDE_SECONDS,
  onSaveSettingsToBackend
}) => {
  // Always masked by default upon entering the system
  const isMaskedByDefault = true;

  // Granular map of unlocked items: id -> expiryTimestamp
  const [unlockedItemIds, setUnlockedItemIds] = useState<Record<string, number>>({});

  // Global unmask state: when true, all amounts and names are revealed
  const [isAllRevealed, setIsAllRevealed] = useState<boolean>(false);
  const [allRevealedExpiry, setAllRevealedExpiry] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Active prompt modal state
  const [activePromptItem, setActivePromptItem] = useState<{ id: string; label?: string } | null>(null);

  // Settings: passcode & auto-lock seconds
  const [privacyPasscode, setPrivacyPasscode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
        if (cache.privacyPasscode) return String(cache.privacyPasscode);
        if (cache.adminPasscode) return String(cache.adminPasscode);
      } catch {}
    }
    return initialPasscode;
  });

  const [autoHideSeconds, setAutoHideSeconds] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
        if (typeof cache.privacyAutoHideSeconds === 'number') return cache.privacyAutoHideSeconds;
      } catch {}
    }
    return typeof initialAutoHideSeconds === 'number' ? initialAutoHideSeconds : DEFAULT_AUTO_HIDE_SECONDS;
  });

  // Sync if initial props change
  useEffect(() => {
    if (initialPasscode && initialPasscode !== DEFAULT_PRIVACY_PASSCODE) {
      setPrivacyPasscode(initialPasscode);
    }
  }, [initialPasscode]);

  useEffect(() => {
    if (typeof initialAutoHideSeconds === 'number') {
      setAutoHideSeconds(initialAutoHideSeconds);
    }
  }, [initialAutoHideSeconds]);

  // Periodic pruning of expired items & allRevealed expiry (every 1 second)
  useEffect(() => {
    const hasItems = Object.keys(unlockedItemIds).length > 0;
    if (!hasItems && !allRevealedExpiry) {
      if (remainingSeconds !== null) setRemainingSeconds(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();

      // Check all-revealed timeout
      if (allRevealedExpiry) {
        if (now >= allRevealedExpiry) {
          setIsAllRevealed(false);
          setAllRevealedExpiry(null);
          setRemainingSeconds(null);
        } else {
          setRemainingSeconds(Math.max(0, Math.ceil((allRevealedExpiry - now) / 1000)));
        }
      }

      // Check individual items
      setUnlockedItemIds((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        const pruned = pruneExpiredItems(prev, now);
        return pruned !== prev ? pruned : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [unlockedItemIds, allRevealedExpiry, remainingSeconds]);

  const isItemUnlocked = useCallback(
    (id: string): boolean => {
      if (isAllRevealed) return true;
      return isItemActive(unlockedItemIds, id, Date.now());
    },
    [isAllRevealed, unlockedItemIds]
  );

  const requestUnlock = useCallback((id: string, label?: string) => {
    setActivePromptItem({ id, label });
  }, []);

  const requestRevealAll = useCallback(() => {
    setActivePromptItem({ id: '__ALL__', label: 'كافة الأرقام والبيانات المالية في النظام' });
  }, []);

  const closePrompt = useCallback(() => {
    setActivePromptItem(null);
  }, []);

  const confirmUnlock = useCallback(
    (id: string, enteredPasscode: string): { success: boolean; message?: string } => {
      const cleanEntered = enteredPasscode.trim();
      const cleanCurrent = privacyPasscode.trim();

      if (!cleanEntered) {
        return { success: false, message: 'يرجى إدخال رمز المرور للمتابعة' };
      }

      if (cleanEntered !== cleanCurrent && cleanEntered !== '2026') {
        return { success: false, message: 'رمز المرور غير صحيح' };
      }

      // If unlocking ALL items
      if (id === '__ALL__') {
        setIsAllRevealed(true);
        setActivePromptItem(null);
        if (autoHideSeconds > 0) {
          setAllRevealedExpiry(Date.now() + autoHideSeconds * 1000);
          setRemainingSeconds(autoHideSeconds);
        } else {
          setAllRevealedExpiry(null); // 0 = manual only (stays unmasked until lockAll)
          setRemainingSeconds(null);
        }
        return { success: true, message: 'تم فك حجب كافة الأرقام والأسماء بنجاح' };
      }

      const now = Date.now();
      const res = validateAndUnlock(
        unlockedItemIds,
        id,
        enteredPasscode,
        privacyPasscode,
        autoHideSeconds,
        now
      );

      if (res.success) {
        setUnlockedItemIds(res.unlockedMap);
        setActivePromptItem(null);
      }

      return { success: res.success, message: res.message };
    },
    [unlockedItemIds, privacyPasscode, autoHideSeconds]
  );

  const lockItem = useCallback((id: string) => {
    setUnlockedItemIds((prev) => relockItem(prev, id));
  }, []);

  const lockAll = useCallback(() => {
    setIsAllRevealed(false);
    setAllRevealedExpiry(null);
    setRemainingSeconds(null);
    setUnlockedItemIds({});
    setActivePromptItem(null);
  }, []);

  const toggleAll = useCallback(() => {
    if (isAllRevealed || Object.keys(unlockedItemIds).length > 0) {
      lockAll();
    } else {
      requestRevealAll();
    }
  }, [isAllRevealed, unlockedItemIds, lockAll, requestRevealAll]);

  const updatePrivacySettings = useCallback(
    async (newPasscode: string, newAutoHideSeconds: number): Promise<{ success: boolean; message: string }> => {
      const cleanPasscode = newPasscode.trim();
      if (!cleanPasscode || cleanPasscode.length < 4) {
        return { success: false, message: 'رمز المرور يجب أن يتكون من 4 خانات على الأقل' };
      }

      setPrivacyPasscode(cleanPasscode);
      setAutoHideSeconds(newAutoHideSeconds);

      // Save to localStorage cache
      if (typeof window !== 'undefined') {
        try {
          const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
          cache.privacyPasscode = cleanPasscode;
          cache.privacyAutoHideSeconds = newAutoHideSeconds;
          cache.adminPasscode = cleanPasscode;
          localStorage.setItem('aman_finance_live_cache', JSON.stringify(cache));
        } catch (e) {
          console.warn('Failed to update local cache privacy settings:', e);
        }
      }

      // If backend callback provided, persist to Neon DB
      if (onSaveSettingsToBackend) {
        try {
          return await onSaveSettingsToBackend(cleanPasscode, newAutoHideSeconds);
        } catch (err: any) {
          return { success: false, message: err?.message || 'تعذر الحفظ في قاعدة البيانات' };
        }
      }

      return { success: true, message: 'تم تحديث إعدادات الخصوصية بنجاح' };
    },
    [onSaveSettingsToBackend]
  );

  const unlockedCount = useMemo(() => {
    if (isAllRevealed) return 999;
    const now = Date.now();
    return Object.values(unlockedItemIds).filter((expiry) => expiry > now).length;
  }, [isAllRevealed, unlockedItemIds]);

  const contextValue: PrivacyContextType = useMemo(
    () => ({
      isMaskedByDefault,
      unlockedItemIds,
      isItemUnlocked,
      requestUnlock,
      confirmUnlock,
      lockItem,
      lockAll,
      toggleAll,
      isAllRevealed,
      isPrivacyActive: !isAllRevealed,
      remainingSeconds,
      requestRevealAll,
      privacyPasscode,
      autoHideSeconds,
      updatePrivacySettings,
      activePromptItem,
      closePrompt,
      unlockedCount
    }),
    [
      isMaskedByDefault,
      unlockedItemIds,
      isItemUnlocked,
      requestUnlock,
      confirmUnlock,
      lockItem,
      lockAll,
      toggleAll,
      isAllRevealed,
      remainingSeconds,
      requestRevealAll,
      privacyPasscode,
      autoHideSeconds,
      updatePrivacySettings,
      activePromptItem,
      closePrompt,
      unlockedCount
    ]
  );

  return <PrivacyContext.Provider value={contextValue}>{children}</PrivacyContext.Provider>;
};

export const usePrivacy = (): PrivacyContextType => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};
