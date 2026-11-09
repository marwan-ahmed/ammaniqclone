export type ActiveCurrency = 'IQD' | 'USD';

export interface CurrencySettings {
  exchangeRatePer100: number; // e.g. 153,000 IQD per 100 USD
  exchangeRate: number; // e.g. 1,530 IQD per 1 USD
  lastUpdated?: string;
  updatedBy?: string;
}

export interface DualCurrencyFormatted {
  primaryText: string;
  secondaryText: string;
  primaryCurrency: ActiveCurrency;
  secondaryCurrency: ActiveCurrency;
  rawPrimaryAmount: number;
  rawSecondaryAmount: number;
}

export interface CurrencyContextType {
  activeCurrency: ActiveCurrency;
  setActiveCurrency: (currency: ActiveCurrency) => void;
  toggleCurrency: () => void;
  exchangeRatePer100: number;
  exchangeRate: number;
  lastUpdated: string;
  isLoading: boolean;
  updateExchangeRate: (newRatePer100: number) => Promise<{ success: boolean; message: string }>;
  convertIQDtoUSD: (amountIQD: number | string | null | undefined) => number;
  convertUSDtoIQD: (amountUSD: number | string | null | undefined) => number;
  formatDual: (
    amountIQD: number | string | null | undefined,
    options?: { hideSub?: boolean; compact?: boolean; isPrivacyActive?: boolean }
  ) => DualCurrencyFormatted;
}

export const DEFAULT_EXCHANGE_RATE_PER_100 = 153000;

