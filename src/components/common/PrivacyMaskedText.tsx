'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { usePrivacy } from '@/context/PrivacyContext';

interface PrivacyMaskedTextProps {
  id: string;
  value?: string | null | undefined;
  text?: string | null | undefined;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'div';
  label?: string;
  className?: string;
  maskString?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  iconPosition?: 'left' | 'right';
  hideIcon?: boolean;
  emptyFallback?: string;
}

export const PrivacyMaskedText: React.FC<PrivacyMaskedTextProps> = ({
  id,
  value,
  text,
  as = 'span',
  label,
  className = '',
  maskString = '••••••••',
  size = 'md',
  iconPosition = 'right',
  hideIcon = false,
  emptyFallback = '—'
}) => {
  const { isItemUnlocked, requestUnlock, lockItem } = usePrivacy();
  const unlocked = isItemUnlocked(id);

  const rawValue = value !== undefined ? value : text;
  const displayValue = rawValue ? String(rawValue).trim() : emptyFallback;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unlocked) {
      lockItem(id);
    } else {
      requestUnlock(id, label || `الاسم: ${displayValue}`);
    }
  };

  const Tag = as;

  const iconClasses = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-4.5 h-4.5' : 'w-4 h-4';

  return (
    <Tag
      className={`inline-flex items-center gap-1.5 select-none ${className}`}
      title={
        unlocked
          ? 'الاسم مكشوف مؤقتاً - انقر للقفل الفوري'
          : 'اسم سري محجوب - انقر على رمز العين لإدخال رمز المرور وإظهار هذا الاسم فقط'
      }
    >
      {iconPosition === 'left' && !hideIcon && (
        <button
          type="button"
          onClick={handleToggle}
          className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
            unlocked
              ? 'text-emerald-400 hover:text-rose-400'
              : 'text-slate-500 hover:text-amber-400'
          }`}
          title={unlocked ? 'قفل الاسم' : 'إظهار الاسم'}
        >
          {unlocked ? <EyeOff className={iconClasses} /> : <Eye className={iconClasses} />}
        </button>
      )}

      {unlocked ? (
        <span className="font-semibold transition-opacity duration-200">{displayValue}</span>
      ) : (
        <span className="tracking-widest font-mono font-bold opacity-75 text-slate-400">
          {maskString}
        </span>
      )}

      {iconPosition === 'right' && !hideIcon && (
        <button
          type="button"
          onClick={handleToggle}
          className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
            unlocked
              ? 'text-emerald-400 hover:text-rose-400'
              : 'text-slate-500 hover:text-amber-400'
          }`}
          title={unlocked ? 'قفل الاسم' : 'إظهار الاسم'}
        >
          {unlocked ? <EyeOff className={iconClasses} /> : <Eye className={iconClasses} />}
        </button>
      )}
    </Tag>
  );
};

