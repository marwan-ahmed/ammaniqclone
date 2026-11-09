'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Users, Phone, UserCheck, ShieldAlert } from 'lucide-react';
import { DuplicateMatchResult } from '@/utils/nameSimilarity';

interface DuplicateWarningBannerProps<T> {
  matchResult: DuplicateMatchResult<T>;
  entityLabel: 'مستثمر' | 'زبون' | 'كفيل';
  onSelectExisting?: (item: T) => void;
}

export function DuplicateWarningBanner<
  T extends { id: string; name: string; phone?: string; [key: string]: any }
>({ matchResult, entityLabel, onSelectExisting }: DuplicateWarningBannerProps<T>) {
  const {
    exactNameMatches,
    firstNameMatches,
    partialNameMatches,
    phoneMatches,
    hasHighRiskDuplicate,
    hasWarningDuplicate,
  } = matchResult;

  if (!hasHighRiskDuplicate && !hasWarningDuplicate) {
    return null;
  }

  return (
    <div className="space-y-2.5 my-2 animate-in fade-in slide-in-from-top-2 duration-200 text-right">
      {/* 1. CRITICAL: Exact Name Matches */}
      {exactNameMatches.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 shadow-lg shadow-rose-950/40 text-xs text-rose-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>⚠️ تنبيه حرج: يوجد {entityLabel} مسجل مسبقاً بنفس الاسم تماماً!</span>
          </div>
          <p className="text-[11px] text-rose-300/90 leading-relaxed">
            تم العثور على تطابق تام في الأحرف مع سجل مسبق في النظام لتجنب الازدواجية وإرباك الحسابات:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {exactNameMatches.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectExisting && onSelectExisting(item)}
                className={`px-3 py-1.5 rounded-xl bg-rose-900/60 border border-rose-500/40 text-white font-bold flex items-center gap-2 ${
                  onSelectExisting ? 'cursor-pointer hover:bg-rose-900 transition-colors' : ''
                }`}
              >
                <span>{item.name}</span>
                {item.phone && (
                  <span className="text-[10px] text-rose-300 font-mono flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5" />
                    <span>{item.phone}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Phone Duplicate Matches */}
      {phoneMatches.length > 0 && exactNameMatches.length === 0 && (
        <div className="p-3 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <Phone className="w-4 h-4 text-rose-400 shrink-0" />
            <span>⚠️ رقم الهاتف هذا مسجل مسبقاً باسم {entityLabel} آخر:</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {phoneMatches.map((item) => (
              <div
                key={item.id}
                className="px-2.5 py-1 rounded-lg bg-rose-900/40 border border-rose-500/30 text-rose-100 font-semibold flex items-center gap-2 text-[11px]"
              >
                <span className="font-bold text-white">{item.name}</span>
                <span className="text-rose-300 font-mono">({item.phone})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Partial Substring Matches */}
      {partialNameMatches.length > 0 && exactNameMatches.length === 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500/40 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>💡 تنبيه تطابق جزئي: توجد أسماء مشابهة مسجلة في قائمة الـ {entityLabel}ين</span>
          </div>
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            الاسم المدخل يشترك في مقطع أو تطابق جزئي مع السجلات التالية:
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {partialNameMatches.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectExisting && onSelectExisting(item)}
                className={`px-2.5 py-1 rounded-xl bg-amber-900/40 border border-amber-500/30 text-amber-100 font-medium flex items-center gap-2 text-[11px] ${
                  onSelectExisting ? 'cursor-pointer hover:bg-amber-900/70 transition-colors' : ''
                }`}
              >
                <span className="font-bold text-white">{item.name}</span>
                {item.phone && (
                  <span className="text-amber-300/80 font-mono text-[10px]">({item.phone})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. First Name Matches */}
      {firstNameMatches.length > 0 && exactNameMatches.length === 0 && partialNameMatches.length === 0 && (
        <div className="p-3 rounded-2xl bg-blue-950/60 border border-blue-500/30 text-xs text-blue-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-blue-300">
            <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>🔍 تنبيه الاسم الأول: مسجل مسبقاً بنفس الاسم الأول ({firstNameMatches.length} {entityLabel})</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {firstNameMatches.slice(0, 4).map((item) => (
              <span
                key={item.id}
                className="px-2 py-0.5 rounded-lg bg-blue-900/40 border border-blue-500/20 text-blue-100 text-[11px]"
              >
                {item.name} {item.phone ? `(${item.phone})` : ''}
              </span>
            ))}
            {firstNameMatches.length > 4 && (
              <span className="text-[10px] text-blue-400 self-center">
                +{firstNameMatches.length - 4} آخرين
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
