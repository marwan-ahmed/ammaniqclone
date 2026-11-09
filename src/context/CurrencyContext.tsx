'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActiveCurrency,
  CurrencyContextType,
  DEFAULT_EXCHANGE_RATE_PER_100,
  DualCurrencyFormatted,
} from '@/types/currency';
import {
  convertIQDtoUSD as convertIQDtoUSDUtil,
  convertUSDtoIQD as convertUSDtoIQDUtil,
  formatDualCurrencyAmounts,
} from '@/utils/formatters';

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const STORAGE_KEY_CURRENCY = 'aman_active_currency';
const STORAGE_KEY_RATE = 'aman_usd_exchange_rate_per_100';
const STORAGE_KEY_UPDATED_AT = 'aman_usd_exchange_rate_updated_at';

interface CurrencyProviderProps {
  children: React.ReactNode;
  initialActiveCurrency?: ActiveCurrency;
  initialRatePer100?: number;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({
  children,
  initialActiveCurrency = 'IQD',
  initialRatePer100 = DEFAULT_EXCHANGE_RATE_PER_100,
}) => {
  // Active Display Currency ('IQD' or 'USD')
  const [activeCurrency, setActiveCurrencyState] = useState<ActiveCurrency>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_CURRENCY);
        if (saved === 'IQD' || saved === 'USD') return saved;
      } catch {}
    }
    return initialActiveCurrency;
  });

  // Exchange Rate per 100 USD (e.g. 153000)
  const [exchangeRatePer100, setExchangeRatePer100State] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRate = localStorage.getItem(STORAGE_KEY_RATE);
        if (savedRate) {
          const num = Number(savedRate);
          if (!isNaN(num) && num > 0) return num;
        }
      } catch {}
    }
    return initialRatePer100;
  });

  // Last update timestamp
  const [lastUpdated, setLastUpdated] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedDate = localStorage.getItem(STORAGE_KEY_UPDATED_AT);
        if (savedDate) return savedDate;
      } catch {}
    }
    return '';
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch latest settings from server on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchServerSettings() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.settings && isMounted) {
          if (data.settings.usdExchangeRatePer100) {
            const serverRate = Number(data.settings.usdExchangeRatePer100);
            if (!isNaN(serverRate) && serverRate > 0) {
              setExchangeRatePer100State(serverRate);
              localStorage.setItem(STORAGE_KEY_RATE, String(serverRate));
            }
          }
          if (data.settings.usdExchangeRateUpdatedAt) {
            setLastUpdated(data.settings.usdExchangeRateUpdatedAt);
            localStorage.setItem(STORAGE_KEY_UPDATED_AT, data.settings.usdExchangeRateUpdatedAt);
          }
        }
      } catch (err) {
        console.warn('CurrencyContext: Error loading exchange rate settings:', err);
      }
    }

    fetchServerSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update Active Currency and persist in localStorage
  const setActiveCurrency = useCallback((currency: ActiveCurrency) => {
    setActiveCurrencyState(currency);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CURRENCY, currency);
      } catch {}
    }
  }, []);

  // Toggle between IQD and USD
  const toggleCurrency = useCallback(() => {
    setActiveCurrencyState((prev) => {
      const next = prev === 'IQD' ? 'USD' : 'IQD';
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_CURRENCY, next);
        } catch {}
      }
      return next;
    });
  }, []);

  // Update Exchange Rate both locally and in the database
  const updateExchangeRate = useCallback(async (newRatePer100: number): Promise<{ success: boolean; message: string }> => {
    if (!newRatePer100 || isNaN(newRatePer100) || newRatePer100 <= 0) {
      return { success: false, message: 'يرجى إدخال سعر صرف صالح أكبر من الصفر' };
    }

    const rounded = Math.round(newRatePer100);
    setIsLoading(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchangeRatePer100: rounded,
          updatedBy: 'مدير النظام',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل تحديث سعر الصرف في السيرفر');
      }

      setExchangeRatePer100State(rounded);
      const timestamp = data.usdExchangeRateUpdatedAt || new Date().toISOString();
      setLastUpdated(timestamp);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_RATE, String(rounded));
          localStorage.setItem(STORAGE_KEY_UPDATED_AT, timestamp);
        } catch {}
      }

      return {
        success: true,
        message: `تم تحديث سعر الصرف بنجاح (100$ = ${rounded.toLocaleString('en-US')} د.ع)`,
      };
    } catch (err: any) {
      console.error('Error updating exchange rate:', err);
      // Fallback: update locally anyway
      setExchangeRatePer100State(rounded);
      const now = new Date().toISOString();
      setLastUpdated(now);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_RATE, String(rounded));
          localStorage.setItem(STORAGE_KEY_UPDATED_AT, now);
        } catch {}
      }
      return {
        success: true,
        message: `تم حفظ سعر الصرف محلياً (100$ = ${rounded.toLocaleString('en-US')} د.ع) مع تعذر الاتصال بالسيرفر`,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Converter helpers
  const convertIQDtoUSD = useCallback(
    (amountIQD: number | string | null | undefined): number => {
      return convertIQDtoUSDUtil(amountIQD, exchangeRatePer100);
    },
    [exchangeRatePer100]
  );

  const convertUSDtoIQD = useCallback(
    (amountUSD: number | string | null | undefined): number => {
      return convertUSDtoIQDUtil(amountUSD, exchangeRatePer100);
    },
    [exchangeRatePer100]
  );

  // Dual currency formatter bound to current state
  const formatDual = useCallback(
    (
      amountIQD: number | string | null | undefined,
      options?: { hideSub?: boolean; compact?: boolean; isPrivacyActive?: boolean }
    ): DualCurrencyFormatted => {
      return formatDualCurrencyAmounts(amountIQD, exchangeRatePer100, activeCurrency, options);
    },
    [exchangeRatePer100, activeCurrency]
  );

  const exchangeRate = useMemo(() => exchangeRatePer100 / 100, [exchangeRatePer100]);

  const value: CurrencyContextType = useMemo(
    () => ({
      activeCurrency,
      setActiveCurrency,
      toggleCurrency,
      exchangeRatePer100,
      exchangeRate,
      lastUpdated,
      isLoading,
      updateExchangeRate,
      convertIQDtoUSD,
      convertUSDtoIQD,
      formatDual,
    }),
    [
      activeCurrency,
      setActiveCurrency,
      toggleCurrency,
      exchangeRatePer100,
      exchangeRate,
      lastUpdated,
      isLoading,
      updateExchangeRate,
      convertIQDtoUSD,
      convertUSDtoIQD,
      formatDual,
    ]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    // Graceful fallback for components or tests rendered without provider
    const fallbackRate = DEFAULT_EXCHANGE_RATE_PER_100;
    return {
      activeCurrency: 'IQD',
      setActiveCurrency: () => {},
      toggleCurrency: () => {},
      exchangeRatePer100: fallbackRate,
      exchangeRate: fallbackRate / 100,
      lastUpdated: '',
      isLoading: false,
      updateExchangeRate: async () => ({ success: true, message: '' }),
      convertIQDtoUSD: (amt) => convertIQDtoUSDUtil(amt, fallbackRate),
      convertUSDtoIQD: (amt) => convertUSDtoIQDUtil(amt, fallbackRate),
      formatDual: (amt, opts) => formatDualCurrencyAmounts(amt, fallbackRate, 'IQD', opts),
    };
  }
  return context;
};

