'use client';

import React from 'react';
import { Eye, EyeOff, ShieldAlert, Timer } from 'lucide-react';
import { usePrivacy } from '@/context/PrivacyContext';

interface PrivacyToggleButtonProps {
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
  showTimerBadge?: boolean;
}

export const PrivacyToggleButton: React.FC<PrivacyToggleButtonProps> = ({
  variant = 'default',
  className = '',
  showTimerBadge = true
}) => {
  const {
    isAllRevealed,
    unlockedCount,
    remainingSeconds,
    autoHideSeconds,
    toggleAll
  } = usePrivacy();

  const isUnlocked = isAllRevealed || unlockedCount > 0;

  if (variant === 'minimal') {
    return (
      <button
        type="button"
        onClick={toggleAll}
        title={isUnlocked ? 'إعادة حجب كافة البيانات والأسماء فورياً' : 'إظهار كافة الأرقام والأسماء السرية'}
        className={`p-2 rounded-xl transition-all cursor-pointer border flex items-center justify-center shrink-0 ${
          isUnlocked
            ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30 shadow-sm shadow-rose-500/10'
            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
        } ${className}`}
      >
        {isUnlocked ? <EyeOff className="w-4 h-4 text-rose-400" /> : <Eye className="w-4 h-4 text-emerald-400" />}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleAll}
        title={isUnlocked ? 'إعادة حجب كافة البيانات والأسماء فورياً' : 'إظهار كافة الأرقام والأسماء السرية'}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 shrink-0 ${
          isUnlocked
            ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30 shadow-sm shadow-rose-500/10'
            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
        } ${className}`}
      >
        {isUnlocked ? (
          <>
            <EyeOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>إخفاء البيانات</span>
            {showTimerBadge && (
              <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                {autoHideSeconds === 0 ? 'يدوي' : `${remainingSeconds ?? autoHideSeconds}ث`}
              </span>
            )}
          </>
        ) : (
          <>
            <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>إظهار البيانات</span>
          </>
        )}
      </button>
    );
  }

  // Default variant: prominent & well-styled for toolbars and page headers
  return (
    <button
      type="button"
      onClick={toggleAll}
      title={isUnlocked ? 'إعادة حجب وقفل كافة الأرقام والأسماء فورياً' : 'إظهار كافة الأرقام والأسماء السرية في النظام'}
      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 shrink-0 select-none shadow-sm ${
        isUnlocked
          ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/35 shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-95'
          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/35 shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95'
      } ${className}`}
    >
      {isUnlocked ? (
        <>
          <EyeOff className="w-4 h-4 text-rose-400 shrink-0" />
          <span>إخفاء البيانات</span>
          {showTimerBadge && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-lg font-bold border ${
                autoHideSeconds === 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-sans'
                  : 'bg-rose-500/25 text-rose-200 border-rose-500/30 font-mono animate-pulse'
              }`}
            >
              {autoHideSeconds === 0 ? 'يدوي' : `${remainingSeconds ?? autoHideSeconds}ث`}
            </span>
          )}
        </>
      ) : (
        <>
          <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>إظهار البيانات</span>
        </>
      )}
    </button>
  );
};
