'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  Settings,
  CheckCircle2
} from 'lucide-react';

interface ProtectedTabGateProps {
  tabKey: 'debt_ledger' | 'settings';
  adminPasscode?: string;
  onUnlock: (rememberSession: boolean) => void;
  onCancel: () => void;
}

export const ProtectedTabGate: React.FC<ProtectedTabGateProps> = ({
  tabKey,
  adminPasscode = '2026',
  onUnlock,
  onCancel
}) => {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isDebt = tabKey === 'debt_ledger';
  const tabTitle = isDebt ? 'دفتر الديون' : 'إعدادات النظام';
  const tabSubtitle = isDebt
    ? 'سجل حسابات المدينين الخارجيين ومتابعة المبالغ المسددة والمتبقية محمي برمز أمان الإدارة للحفاظ على السرية المالية.'
    : 'لوحة التحكم بإعدادات النظام، التوطين وقواعد البيانات محمية برمز أمان الإدارة لمنع أي تعديلات غير مصرح بها.';

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = passcode.trim();
    if (!cleanInput) {
      setErrorMessage('يرجى إدخال رمز المرور للمتابعة');
      inputRef.current?.focus();
      return;
    }

    // Determine current effective passcode
    let effectivePasscode = adminPasscode || '2026';
    if (typeof window !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
        if (cache.adminPasscode) {
          effectivePasscode = String(cache.adminPasscode);
        }
      } catch {}
    }

    if (cleanInput !== effectivePasscode) {
      setErrorMessage('رمز المرور غير صحيح! يرجى إدخال رمز أمان الإدارة المعتمد (الافتراضي: 2026 أو الرمز الجديد المحدد في الإعدادات).');
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    // Success animation and unlock
    setIsSuccess(true);
    setTimeout(() => {
      onUnlock(rememberSession);
    }, 250);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-right animate-in fade-in zoom-in-95 duration-200">
        {/* Background glow effects */}
        <div
          className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 ${
            isDebt ? 'bg-emerald-500/10' : 'bg-purple-500/10'
          }`}
        />
        <div
          className={`absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/2 ${
            isDebt ? 'bg-teal-500/10' : 'bg-indigo-500/10'
          }`}
        />

        {/* Header Icon */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-3 mb-6">
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg relative ${
              isDebt
                ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
                : 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/30 text-purple-400 shadow-purple-500/10'
            }`}
          >
            {isDebt ? <BookOpenCheck className="w-8 h-8" /> : <Settings className="w-8 h-8" />}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>قسم محمي برمز مرور</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {tabTitle}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              {tabSubtitle}
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="relative z-10 mb-4 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-start gap-2.5 animate-in shake duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success message */}
        {isSuccess && (
          <div className="relative z-10 mb-4 p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95 duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>تم التحقق بنجاح! جاري فتح الشاشة...</span>
          </div>
        )}

        {/* Passcode Form */}
        <form onSubmit={handleVerify} className="relative z-10 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>أدخل رمز أمان الإدارة</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">(الافتراضي: 2026)</span>
            </label>

            <div className="relative">
              <input
                ref={inputRef}
                type={showPasscode ? 'text' : 'password'}
                required
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="أدخل رمز المرور..."
                className={`w-full py-3 px-11 rounded-2xl bg-slate-950 border text-white font-mono text-center tracking-widest text-lg focus:outline-none transition-all placeholder:text-slate-600 placeholder:text-xs placeholder:tracking-normal ${
                  isDebt
                    ? 'border-slate-800 focus:border-emerald-500 shadow-inner'
                    : 'border-slate-800 focus:border-purple-500 shadow-inner'
                }`}
                autoComplete="current-password"
              />

              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>

              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                tabIndex={-1}
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember session checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>إبقاء الشاشة مفتوحة أثناء جلسة العمل الحالية</span>
          </label>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSuccess}
              className={`w-full py-3 px-4 rounded-2xl text-xs font-black text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
                isDebt
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/25'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>فتح {tabTitle}</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold border border-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة للوحة التحكم الرئيسية</span>
            </button>
          </div>
        </form>

        {/* Footer info note */}
        <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            💡 يمكنك تغيير رمز المرور في أي وقت من شاشة <strong>إعدادات النظام</strong> (بطاقة كلمة مرور أمان النظام).
          </p>
        </div>
      </div>
    </div>
  );
};

