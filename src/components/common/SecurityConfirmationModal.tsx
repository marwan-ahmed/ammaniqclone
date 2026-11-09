'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, Key, Eye, EyeOff, X, AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';

interface SecurityConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  subtitle?: string;
  itemName?: string;
  itemDetails?: string;
  actionType?: 'TRASH' | 'PERMANENT_DELETE' | 'EMPTY_TRASH' | 'SECURITY';
  confirmButtonText?: string;
  adminPasscode?: string;
}

export const SecurityConfirmationModal: React.FC<SecurityConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  itemName,
  itemDetails,
  actionType = 'TRASH',
  confirmButtonText = 'تأكيد العملية',
  adminPasscode = '2026'
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let currentConfiguredPasscode = adminPasscode;
    if (typeof window !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
        if (cache.adminPasscode) {
          currentConfiguredPasscode = cache.adminPasscode;
        }
      } catch {}
    }

    const cleanInput = password.trim();
    const activePasscode = currentConfiguredPasscode || adminPasscode || '2026';
    const isPasscodeMatch = cleanInput === activePasscode;

    if (!cleanInput) {
      setErrorMessage('يرجى إدخال كلمة المرور أو رمز الأمان للمتابعة');
      return;
    }

    if (!isPasscodeMatch) {
      setErrorMessage('كلمة المرور غير صحيحة! يرجى إدخال رمز الأمان المعتمد في إعدادات النظام');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm();
      setPassword('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'فشلت العملية، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPermanent = actionType === 'PERMANENT_DELETE' || actionType === 'EMPTY_TRASH';

  return (
    <div
      className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header Icon */}
        <div className={`p-6 text-center border-b border-slate-800/80 ${
          isPermanent 
            ? 'bg-gradient-to-b from-rose-950/40 to-slate-900' 
            : 'bg-gradient-to-b from-amber-950/30 to-slate-900'
        }`}>
          <div className="flex justify-end -mt-2 -mr-2">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-3 ${
            isPermanent
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-rose-500/10'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-amber-500/10'
          }`}>
            {isPermanent ? <ShieldAlert className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
          </div>

          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Item Pill */}
          {itemName && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1 text-right">
              <span className="text-[10px] text-slate-500 font-bold block">السجل المستهدف:</span>
              <p className="text-xs font-bold text-white font-mono break-words">{itemName}</p>
              {itemDetails && <p className="text-[11px] text-slate-400">{itemDetails}</p>}
            </div>
          )}

          {/* Warning Message */}
          <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
            isPermanent
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
          }`}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isPermanent
                ? 'تحذير: هذا الإجراء نهائي ولا يمكن التراجع عنه. تتطلب هذه العملية تصريح المدير العام.'
                : 'لحماية البيانات من الحذف غير المقصود، يرجى تأكيد هويتك بإدخال كلمة المرور.'}
            </p>
          </div>

          {/* Password Input Field */}
          <div className="space-y-1.5 text-right">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>كلمة المرور / رمز الأمان:</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">(رمز الإدارة: 2026)</span>
            </label>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="أدخل كلمة المرور للتأكيد..."
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 text-xs font-mono tracking-wider transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in shake duration-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password.trim()}
              className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isPermanent
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              }`}
            >
              {isPermanent ? <Trash2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{isSubmitting ? 'جاري التحقق...' : confirmButtonText}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
