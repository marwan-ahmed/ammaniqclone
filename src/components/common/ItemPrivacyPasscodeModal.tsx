'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, X, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { usePrivacy } from '@/context/PrivacyContext';

export const ItemPrivacyPasscodeModal: React.FC = () => {
  const { activePromptItem, closePrompt, confirmUnlock } = usePrivacy();
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activePromptItem) {
      setPasscode('');
      setErrorMessage(null);
      setShowPasscode(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [activePromptItem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePromptItem) {
        closePrompt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePromptItem, closePrompt]);

  if (!activePromptItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = passcode.trim();
    if (!cleanInput) {
      setErrorMessage('يرجى إدخال رمز المرور للمتابعة');
      return;
    }

    setIsSubmitting(true);
    const result = confirmUnlock(activePromptItem.id, cleanInput);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message || 'رمز المرور غير صحيح');
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-right"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-b from-indigo-950/40 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {activePromptItem.id === '__ALL__' ? 'فك حجب كافة الأرقام المالية' : 'فك حجب الرقم المحدد'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {activePromptItem.id === '__ALL__' ? 'إظهار كافة الأرقام في جميع الشاشات بحماية أمنية' : 'إظهار القيمة المحددة فقط بحماية أمنية'}
              </p>
            </div>
          </div>
          <button
            onClick={closePrompt}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {activePromptItem.label && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs space-y-1">
              <span className="text-[10px] text-slate-500 font-bold block">العنصر المستهدف:</span>
              <p className="font-semibold text-emerald-400">{activePromptItem.label}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>رمز المرور السري:</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">(الافتراضي: 2026)</span>
            </label>

            <div className="relative">
              <input
                ref={inputRef}
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="أدخل رمز المرور..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 text-xs font-mono tracking-wider transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in shake duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={closePrompt}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !passcode.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{activePromptItem.id === '__ALL__' ? 'فك حجب الكل' : 'إظهار الرقم'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
