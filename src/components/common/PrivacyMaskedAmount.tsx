'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { usePrivacy } from '@/context/PrivacyContext';
import { useCurrency } from '@/context/CurrencyContext';
import { formatNumber, formatIQD } from '@/utils/formatters';

interface PrivacyMaskedAmountProps {
  id: string;
  value: number | string;
  label?: string;
  currency?: string;
  formatter?: (val: number) => string;
  className?: string;
  maskString?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  iconPosition?: 'left' | 'right';
  hideIcon?: boolean;
  showDual?: boolean;
  inlineDual?: boolean;
}

export const PrivacyMaskedAmount: React.FC<PrivacyMaskedAmountProps> = ({
  id,
  value,
  label,
  currency = 'د.ع',
  formatter,
  className = '',
  maskString = '••••••••',
  size = 'md',
  iconPosition = 'right',
  hideIcon = false,
  showDual = true,
  inlineDual = false,
}) => {
  const { isItemUnlocked, requestUnlock, lockItem } = usePrivacy();
  const { activeCurrency, formatDual } = useCurrency();
  const unlocked = isItemUnlocked(id);

  const numericValue = React.useMemo(() => {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }, [value]);

  // Is this an IQD amount that should participate in dual-currency conversion?
  const isIQD = !currency || currency === 'د.ع' || currency === 'IQD';

  const dualData = React.useMemo(() => {
    if (!isIQD) return null;
    return formatDual(numericValue);
  }, [isIQD, numericValue, formatDual]);

  const primaryDisplay = React.useMemo(() => {
    if (!unlocked) {
      const activeSymbol = activeCurrency === 'USD' && isIQD ? '$' : currency;
      return {
        text: maskString,
        symbol: activeSymbol,
      };
    }

    if (isIQD && dualData) {
      if (activeCurrency === 'USD') {
        return {
          text: dualData.primaryText,
          symbol: '',
        };
      }
      // activeCurrency === 'IQD'
      const baseNum = formatter ? formatter(numericValue) : formatIQD(numericValue);
      return {
        text: baseNum,
        symbol: 'د.ع',
      };
    }

    const formatted = typeof value === 'number'
      ? (formatter ? formatter(value) : formatNumber(value))
      : String(value);

    return {
      text: formatted,
      symbol: currency,
    };
  }, [unlocked, isIQD, dualData, activeCurrency, currency, maskString, formatter, numericValue, value]);

  const secondaryText = React.useMemo(() => {
    if (!unlocked || !isIQD || !showDual || !dualData) return null;
    return dualData.secondaryText;
  }, [unlocked, isIQD, showDual, dualData]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unlocked) {
      lockItem(id);
    } else {
      requestUnlock(id, label);
    }
  };

  const iconClasses = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const renderEyeButton = () => {
    if (hideIcon) return null;
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
          unlocked
            ? 'text-emerald-400 hover:text-rose-400'
            : 'text-slate-500 hover:text-amber-400'
        }`}
      >
        {unlocked ? <EyeOff className={iconClasses} /> : <Eye className={iconClasses} />}
      </button>
    );
  };

  const shouldRenderSubline = Boolean(secondaryText && !inlineDual && size !== 'xs');
  const shouldRenderInlineSub = Boolean(secondaryText && (inlineDual || size === 'xs'));

  return (
    <span className={`inline-flex flex-col text-right select-none ${className}`}>
      <span
        className="inline-flex items-center gap-1.5 font-mono"
        title={
          unlocked
            ? 'الرقم مكشوف مؤقتاً - انقر للقفل الفوري'
            : 'انقر على رمز العين لإدخال رمز المرور وإظهار هذا الرقم فقط'
        }
      >
        {iconPosition === 'left' && renderEyeButton()}

        <span>
          <span className={!unlocked ? 'tracking-widest font-bold opacity-75' : ''}>
            {primaryDisplay.text}
          </span>
          {primaryDisplay.symbol && (
            <span className="text-[0.85em] font-sans mr-1 opacity-80">
              {primaryDisplay.symbol}
            </span>
          )}
          {shouldRenderInlineSub && (
            <span className="text-[0.65em] font-sans text-slate-400 font-normal mr-1.5">
              ({secondaryText})
            </span>
          )}
        </span>

        {iconPosition === 'right' && renderEyeButton()}
      </span>

      {shouldRenderSubline && (
        <span
          className="text-[0.58em] font-sans text-slate-400 font-medium tracking-normal mt-0.5 opacity-85 block text-right"
          title={activeCurrency === 'IQD' ? 'المعادل بالدولار الأمريكي' : 'المعادل بالدينار العراقي'}
        >
          {secondaryText}
        </span>
      )}
    </span>
  );
};
