'use client';

import React from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { RefreshCw, DollarSign } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';

interface CurrencySwitcherProps {
  className?: string;
  showRateBadge?: boolean;
}

export const CurrencySwitcher: React.FC<CurrencySwitcherProps> = ({
  className = '',
  showRateBadge = true,
}) => {
  const { activeCurrency, toggleCurrency, exchangeRatePer100 } = useCurrency();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Exchange Rate Info Badge (Hidden on very small screens) */}
      {showRateBadge && (
        <div
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 shadow-inner"
          title={`سعر الصرف المعتمد في النظام: كل 100 دولار = ${formatNumber(exchangeRatePer100)} دينار عراقي`}
        >
          <span className="text-[#1783C1] font-bold">$100</span>
          <span className="text-slate-400">=</span>
          <span className="font-semibold text-slate-200">{formatNumber(exchangeRatePer100)} د.ع</span>
        </div>
      )}

      {/* Interactive Toggle Switch */}
      <button
        type="button"
        onClick={toggleCurrency}
        title={`العملة الحالية المعروضة: ${activeCurrency === 'IQD' ? 'الدينار العراقي' : 'الدولار الأمريكي'}. انقر للتبديل.`}
        className="group relative inline-flex items-center p-1 rounded-xl bg-slate-950/70 border border-slate-700/80 hover:border-slate-600 transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1783C1]/40"
        aria-label="تبديل عملة العرض الأساسية"
      >
        {/* IQD Option */}
        <span
          className={`relative z-10 px-2.5 py-1 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1 ${
            activeCurrency === 'IQD'
              ? 'bg-[#0A3C6E] text-white shadow-md shadow-[#0A3C6E]/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          د.ع
        </span>

        {/* USD Option */}
        <span
          className={`relative z-10 px-2.5 py-1 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1 ${
            activeCurrency === 'USD'
              ? 'bg-[#0A3C6E] text-white shadow-md shadow-[#0A3C6E]/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>USD</span>
        </span>
      </button>
    </div>
  );
};

