'use client';

import React from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { usePrivacy } from '@/context/PrivacyContext';

export interface DualCurrencyProps {
  amount: number | string | null | undefined;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
  showSecondary?: boolean;
  inline?: boolean;
  privacyMask?: boolean;
  privacyId?: string;
}

export const DualCurrency: React.FC<DualCurrencyProps> = ({
  amount,
  className = '',
  primaryClassName = '',
  secondaryClassName = '',
  showSecondary = true,
  inline = false,
  privacyMask = false,
  privacyId,
}) => {
  const { formatDual, activeCurrency } = useCurrency();
  const privacy = usePrivacy();

  // Determine if this amount should be masked
  let isMasked = privacyMask;
  if (privacyId && privacy) {
    isMasked = !privacy.isItemUnlocked(privacyId);
  } else if (privacy?.isPrivacyActive && privacyMask) {
    isMasked = true;
  }

  const { primaryText, secondaryText } = formatDual(amount, {
    isPrivacyActive: isMasked,
  });

  if (inline) {
    return (
      <span className={`inline-flex items-baseline gap-1.5 font-medium ${className}`}>
        <span className={`font-bold ${primaryClassName}`}>{primaryText}</span>
        {showSecondary && !isMasked && (
          <span className={`text-[11px] text-slate-400 font-normal ${secondaryClassName}`}>
            ({secondaryText})
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={`flex flex-col text-right ${className}`}>
      <span className={`font-bold tracking-tight ${primaryClassName}`}>
        {primaryText}
      </span>
      {showSecondary && !isMasked && (
        <span
          className={`text-[11px] text-slate-400 font-medium tracking-normal mt-0.5 ${secondaryClassName}`}
          title={activeCurrency === 'IQD' ? 'المعادل بالدولار الأمريكي' : 'المعادل بالدينار العراقي'}
        >
          {secondaryText}
        </span>
      )}
    </div>
  );
};

