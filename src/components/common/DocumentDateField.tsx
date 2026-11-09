'use client';

import React from 'react';
import { Calendar, RotateCcw, AlertCircle } from 'lucide-react';

export interface DocumentDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  helperText?: string;
  helpText?: string;
}

export const DocumentDateField: React.FC<DocumentDateFieldProps> = ({
  value,
  onChange,
  label = 'تاريخ المستند المالي',
  required = false,
  disabled = false,
  className = '',
  helperText,
  helpText
}) => {
  const effectiveHelperText = helperText || helpText;
  const todayStr = new Date().toISOString().split('T')[0];
  const isHistorical = Boolean(value && value < todayStr);

  const handleSetToday = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(todayStr);
  };

  return (
    <div className={`space-y-1.5 ${className}`} dir="rtl">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
        {value !== todayStr && (
          <button
            type="button"
            onClick={handleSetToday}
            disabled={disabled}
            className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline transition-colors disabled:opacity-50"
            title="إعادة التعيين إلى تاريخ اليوم"
          >
            <RotateCcw className="w-3 h-3" />
            <span>تعيين اليوم</span>
          </button>
        )}
      </div>

      <div className="relative">
        <input
          type="date"
          lang="en"
          dir="ltr"
          value={value || todayStr}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed text-right"
        />
      </div>

      {isHistorical && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 mt-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>مستند بأثر رجعي: سيتم تقييد القيد واحتساب الحركات بتاريخ ({value})</span>
        </div>
      )}

      {effectiveHelperText && !isHistorical && (
        <p className="text-[11px] text-slate-400 pr-1">{effectiveHelperText}</p>
      )}
    </div>
  );
};
