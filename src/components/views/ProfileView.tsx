'use client';

import React from 'react';
import { User, ShieldCheck, Mail, Phone, MapPin, Key, Flame, CheckCircle2, Lock, FileText, Briefcase } from 'lucide-react';
import { Employee, SYSTEM_PERMISSIONS } from '@/types/finance';
import { formatNumber } from '@/utils/formatters';

interface ProfileViewProps {
  currentEmployee?: Employee;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentEmployee }) => {
  const emp = currentEmployee || {
    id: 'emp-1',
    name: 'أحمد إياد',
    role: 'مدير النظام',
    phone: '07705554433',
    email: 'admin@aman.iq',
    nationalId: 'IQ-10029384',
    salaryIQD: 1500000,
    status: 'نشط',
    joinedDate: '2025-11-01',
    permissions: SYSTEM_PERMISSIONS.map(p => p.id),
    notes: 'المدير العام المالك وصاحب الصلاحيات الشاملة المطلقة للنظام'
  };


  const isSuperAdmin = emp.role === 'مدير النظام';
  const assignedPermissions = emp.permissions || [];

  return (
    <div className="space-y-6">
      {/* Header Profile Card */}
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center font-black text-indigo-400 text-2xl">
              {emp.name.charAt(0)}
            </div>
          </div>
          <div className="text-center md:text-right space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <h1 className="text-2xl font-bold text-white">{emp.name}</h1>
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold">
                {emp.role}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-center md:justify-start gap-2 pt-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>سامراء - الفرع الرئيسي لنظام أمان للتقسيط</span>
            </p>
          </div>
        </div>
      </div>

      {/* Account Info Details */}
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="font-bold text-white text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>بيانات الموظف والمشروع الحالية</span>
          </h2>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
            حالة الحساب: {emp.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[10px]">البريد الإلكتروني:</span>
            <span className="font-bold text-white text-sm truncate block">{emp.email}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[10px]">رقم الهاتف:</span>
            <span className="font-bold text-white text-sm block font-mono">{emp.phone}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[10px]">الراتب الشهري المعتمد:</span>
            <span className="font-bold text-emerald-400 text-sm block">{formatNumber(emp.salaryIQD)} د.ع</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[10px]">تاريخ الانضمام:</span>
            <span className="font-bold text-purple-300 text-sm block">{emp.joinedDate}</span>
          </div>
        </div>
      </div>

      {/* Permissions Breakdown Matrix */}
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              <span>مصفوفة الصلاحيات المتاحة لحسابك الحالي</span>
            </h2>
            <p className="text-xs text-slate-400">الصلاحيات المفعّلة والقيود المطبقة على شاشات النظام</p>
          </div>

          <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs font-bold border border-purple-500/20">
            {isSuperAdmin ? 'كامل الصلاحيات (12)' : `${assignedPermissions.length} من 12 صلاحية`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {SYSTEM_PERMISSIONS.map((perm) => {
            const hasAccess = isSuperAdmin || assignedPermissions.includes(perm.id);

            return (
              <div
                key={perm.id}
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                  hasAccess
                    ? 'bg-slate-950 border-emerald-500/30 text-slate-200'
                    : 'bg-slate-950/50 border-slate-800/80 text-slate-500 opacity-60'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${hasAccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
                  {hasAccess ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-bold ${hasAccess ? 'text-white' : 'text-slate-500'}`}>{perm.name}</p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{perm.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
