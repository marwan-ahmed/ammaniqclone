'use client';

import React, { useState } from 'react';
import { loginWithEmail, registerWithEmail, resetPasswordWithEmail, logoutUser } from '@/services/auth';
import { Employee } from '@/types/finance';
import {
  Lock,
  Mail,
  Key,
  User,
  ShieldCheck,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Sparkles,
  UserPlus,
  HelpCircle,
  LogIn
} from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: (userEmail: string, employeeName?: string, userUid?: string) => { allowed: boolean; message: string } | Promise<{ allowed: boolean; message: string }>;
  onRegisterEmployee?: (data: {
    uid?: string;
    name: string;
    role: 'مدير النظام' | 'محاسب مالي' | 'مسؤول مخزن' | 'متابعة أقساط' | 'استعلام ميداني';
    email: string;
    phone: string;
  }) => void;
  employees: Employee[];
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess, onRegisterEmployee, employees }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'reset'>('login');

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('محاسب مالي');
  const [nationalId, setNationalId] = useState('');
  const [showPassword, setShowPassword] = useState(false);


  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Submit Login (Strict Firebase Auth with Dev/LAN IP fallback & Approval check)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const res = await loginWithEmail(email, password);
    setLoading(false);

    if (res.success) {
      const cleanEmail = email.trim().toLowerCase();
      const matchedEmp = employees.find((emp) => (emp.uid && emp.uid === res.user?.uid) || emp.email.toLowerCase().trim() === cleanEmail);
      const empName = matchedEmp ? matchedEmp.name : (res.user?.displayName || cleanEmail.split('@')[0]);
      const checkRes = await onLoginSuccess(cleanEmail, empName, res.user?.uid);
      if (checkRes && checkRes.allowed === false) {
        setMsg({ type: 'error', text: checkRes.message });
      }
    } else {
      setMsg({ type: 'error', text: res.error || 'فشل تسجيل الدخول، يرجى التأكد من صحة البريد وكلمة المرور' });
    }
  };


  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setMsg({ type: 'error', text: 'يرجى إكمال جميع الحقول المطلوبة' });
      setLoading(false);
      return;
    }

    const res = await registerWithEmail(email, password, fullName, role);
    setLoading(false);

    if (res.success) {
      // Immediately sign out newly registered user so Firebase Auth doesn't auto-login into dashboard
      await logoutUser();

      if (onRegisterEmployee) {
        await onRegisterEmployee({
          uid: res.user?.uid,
          name: fullName.trim(),
          role: role as any,
          email: email.trim(),
          phone: nationalId ? `0770${nationalId.slice(0, 7)}` : '07700000000'
        });
      }
      setMsg({
        type: 'success',
        text: 'تم تقديم طلب إنشاء الحساب بنجاح! حسابك قيد المراجعة وبانتظار موافقة مدير النظام (أحمد إياد) لتفعيل الدخول وتعيين الصلاحيات. لن تتمكن من دخول النظام إلا بعد اعتماد حسابك من قِبل المدير العام.'
      });
      setTimeout(() => {
        setActiveTab('login');
      }, 5000);
    } else {
      setMsg({ type: 'error', text: res.error || 'فشل إنشاء الحساب' });
    }
  };


  // Submit Password Reset
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (!email.trim()) {
      setMsg({ type: 'error', text: 'يرجى إدخال البريد الإلكتروني المسجل' });
      setLoading(false);
      return;
    }

    const res = await resetPasswordWithEmail(email);
    setLoading(false);

    if (res.success) {
      setMsg({ type: 'success', text: res.message || 'تم إرسال رابط استعادة كلمة المرور بنجاح' });
    } else {
      setMsg({ type: 'error', text: res.error || 'تعذر إرسال رابط الاستعادة' });
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-[#1783C1] selection:text-white relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#1783C1]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#0A3C6E]/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative z-10 animate-in fade-in duration-300">
        {/* Company Header Logo & Identity */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0A3C6E] to-[#1783C1] p-0.5 mx-auto shadow-lg shadow-[#0A3C6E]/30">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[#1783C1]" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">نظام أمان للتقسيط</h1>
          <p className="text-xs text-slate-400">بوابة المصادقة والدخول المركزية وحماية البيانات</p>
        </div>


        {/* Auth Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => { setActiveTab('login'); setMsg(null); }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-[#0A3C6E] text-white shadow-md shadow-[#0A3C6E]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>الدخول</span>
          </button>

          <button
            onClick={() => { setActiveTab('register'); setMsg(null); }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-[#0A3C6E] text-white shadow-md shadow-[#0A3C6E]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>إنشاء حساب</span>
          </button>

          <button
            onClick={() => { setActiveTab('reset'); setMsg(null); }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'reset'
                ? 'bg-[#0A3C6E] text-white shadow-md shadow-[#0A3C6E]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>نسيت الرمز</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {msg && (
          <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
            msg.type === 'success'
              ? 'bg-[#1783C1]/10 text-sky-300 border-[#1783C1]/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {msg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="leading-relaxed">{msg.text}</span>
          </div>
        )}

        {/* TAB 1: LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">البريد الإلكتروني *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="omar@aman.iq"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1783C1] focus:ring-1 focus:ring-[#1783C1] transition-all font-mono"
                />
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-slate-300 font-medium">كلمة المرور *</label>
                <button
                  type="button"
                  onClick={() => setActiveTab('reset')}
                  className="text-[11px] text-[#1783C1] hover:underline font-semibold"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1783C1] focus:ring-1 focus:ring-[#1783C1] transition-all font-mono text-sm"
                />
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#0A3C6E] hover:bg-[#1783C1] text-white font-bold text-xs transition-all shadow-lg shadow-[#0A3C6E]/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>جاري المصادقة...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>تسجيل الدخول إلى المنصة</span>
                </>
              )}
            </button>

            {/* Security Notice */}
            <div className="pt-3 border-t border-slate-800 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1783C1]/10 border border-[#1783C1]/20 text-sky-300 text-[11px] font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1783C1]" />
                <span>المصادقة مؤمنة ومحمية بتشفير السيرفر السحابي</span>
              </div>
            </div>

          </form>
        )}


        {/* TAB 2: REGISTER FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">الاسم الرباعي واللقب *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله السامراوي"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">البريد الإلكتروني المعتمد *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ahmed@aman.iq"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">المسمى الوظيفي *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="محاسب مالي">محاسب مالي</option>
                  <option value="مسؤول مخزن">مسؤول مخزن</option>
                  <option value="متابعة أقساط">متابعة أقساط</option>
                  <option value="استعلام ميداني">استعلام ميداني</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">كلمة المرور *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#0A3C6E] hover:bg-[#072B50] text-white font-bold text-xs transition-all shadow-md shadow-[#0A3C6E]/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>جاري تسجيل الحساب...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-white" />
                  <span>إنشاء حساب موظف جديد بالنظام</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 3: RESET PASSWORD FORM */}
        {activeTab === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600 text-[11px] leading-relaxed">
              أدخل بريدك الإلكتروني المسجل في النظام لإرسال رابط آمن لإعادة تعيين كلمة المرور الخاصة بك.
            </p>


            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">البريد الإلكتروني المسجل *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@aman.iq"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1783C1] focus:ring-1 focus:ring-[#1783C1] font-mono"
                />
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#0A3C6E] hover:bg-[#1783C1] text-white font-bold text-xs transition-all shadow-lg shadow-[#0A3C6E]/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>جاري إرسال الرابط...</span>
              ) : (
                <>
                  <Key className="w-4 h-4 text-white" />
                  <span>إرسال رابط إعادة التعيين عبر البريد</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 text-center">
          نظام أمان للتقسيط - نطاق العمل: العراق (سامراء) © 2026
        </div>
      </div>
    </div>
  );
};
