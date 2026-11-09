'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  MapPin,
  Database,
  Bell,
  Lock,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Trash2,
  Rocket,
  RefreshCw,
  X,
  DatabaseZap,
  CheckCircle2,
  ShieldAlert,
  Server,
  Timer,
  DollarSign,
  Coins,
  TrendingUp,
  Clock,
  Download,
  Upload,
  HardDrive,
  FileJson,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Hash,
  Building2,
  Printer,
  Phone,
  UserCheck
} from 'lucide-react';
import { usePrivacy } from '@/context/PrivacyContext';
import { useCurrency } from '@/context/CurrencyContext';
import { formatNumber, formatIQD, formatUSD, formatDateTime } from '@/utils/formatters';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { validateBackupData, BackupValidationResult } from '@/utils/backup';
import { CompanyReportProfile, DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';

interface SettingsViewProps {
  adminPasscode?: string;
  onChangeAdminPasscode?: (newPasscode: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  onClearDemoData?: () => { success: boolean; message: string };
  onResetDatabase?: () => Promise<{ success: boolean; message: string }>;
  numberingResetEpoch?: string | null;
  onResetNumbering?: (passcode: string) => Promise<{ success: boolean; message: string }>;
  onLock?: () => void;
  companyProfile?: CompanyReportProfile;
  onSaveCompanyProfile?: (profile: CompanyReportProfile) => Promise<{ success: boolean; message: string }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  adminPasscode = '2026',
  onChangeAdminPasscode,
  onClearDemoData,
  onResetDatabase,
  numberingResetEpoch,
  onResetNumbering,
  onLock,
  companyProfile,
  onSaveCompanyProfile
}) => {
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isDbResetLoading, setIsDbResetLoading] = useState(false);

  // Company Profile State (for A4 reports & official documents header)
  const [profileCompanyName, setProfileCompanyName] = useState(companyProfile?.companyName || DEFAULT_COMPANY_REPORT_PROFILE.companyName);
  const [profileCompanyAddress, setProfileCompanyAddress] = useState(companyProfile?.companyAddress || DEFAULT_COMPANY_REPORT_PROFILE.companyAddress);
  const [profileCompanyPhone, setProfileCompanyPhone] = useState(companyProfile?.companyPhone || DEFAULT_COMPANY_REPORT_PROFILE.companyPhone);
  const [profileCompanyActivity, setProfileCompanyActivity] = useState(companyProfile?.companyActivity || DEFAULT_COMPANY_REPORT_PROFILE.companyActivity || '');
  const [profileManagerName, setProfileManagerName] = useState(companyProfile?.managerName || DEFAULT_COMPANY_REPORT_PROFILE.managerName || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (companyProfile) {
      if (companyProfile.companyName) setProfileCompanyName(companyProfile.companyName);
      if (companyProfile.companyAddress) setProfileCompanyAddress(companyProfile.companyAddress);
      if (companyProfile.companyPhone) setProfileCompanyPhone(companyProfile.companyPhone);
      if (companyProfile.companyActivity) setProfileCompanyActivity(companyProfile.companyActivity);
      if (companyProfile.managerName) setProfileManagerName(companyProfile.managerName);
    }
  }, [companyProfile]);

  // Backup & Recovery State
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupToast, setBackupToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedBackupData, setParsedBackupData] = useState<unknown | null>(null);
  const [backupValidation, setBackupValidation] = useState<BackupValidationResult | null>(null);
  const [restorePasscodeInput, setRestorePasscodeInput] = useState('');
  const [showRestorePasscode, setShowRestorePasscode] = useState(false);
  const [autoBackupBeforeRestore, setAutoBackupBeforeRestore] = useState(true);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  // Numbering Cycle Reset State
  const [isNumberingModalOpen, setIsNumberingModalOpen] = useState(false);
  const [numberingPasscode, setNumberingPasscode] = useState('');
  const [showNumberingPasscode, setShowNumberingPasscode] = useState(false);
  const [isNumberingLoading, setIsNumberingLoading] = useState(false);
  const [numberingMsg, setNumberingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentResetEpoch, setCurrentResetEpoch] = useState<string | null>(numberingResetEpoch || null);

  useEffect(() => {
    if (numberingResetEpoch) {
      setCurrentResetEpoch(numberingResetEpoch);
    }
  }, [numberingResetEpoch]);

  const handleConfirmResetNumbering = async () => {
    const cleanPass = numberingPasscode.trim();
    if (!cleanPass) {
      setNumberingMsg({ type: 'error', text: 'يرجى إدخال رمز أمان الإدارة للمتابعة' });
      return;
    }
    if (cleanPass !== adminPasscode) {
      setNumberingMsg({ type: 'error', text: 'رمز أمان الإدارة غير صحيح. يرجى إدخال الرمز الإداري المعتمد' });
      return;
    }

    setIsNumberingLoading(true);
    setNumberingMsg(null);

    try {
      if (onResetNumbering) {
        const res = await onResetNumbering(cleanPass);
        if (res.success) {
          setCurrentResetEpoch(new Date().toISOString());
          setNumberingMsg({ type: 'success', text: res.message });
          setNumberingPasscode('');
          setTimeout(() => {
            setIsNumberingModalOpen(false);
            setNumberingMsg(null);
          }, 2000);
        } else {
          setNumberingMsg({ type: 'error', text: res.message || 'فشل تصفير دورة الترقيم' });
        }
      } else {
        const res = await fetch('/api/settings/reset-numbering', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminPasscode: cleanPass })
        });
        const data = await res.json();
        if (data.success) {
          setCurrentResetEpoch(data.numberingResetEpoch || new Date().toISOString());
          setNumberingMsg({ type: 'success', text: data.message });
          setNumberingPasscode('');
          setTimeout(() => {
            setIsNumberingModalOpen(false);
            setNumberingMsg(null);
          }, 2000);
        } else {
          setNumberingMsg({ type: 'error', text: data.message || 'تعذر تصفير دورة الترقيم' });
        }
      }
    } catch (err: any) {
      setNumberingMsg({ type: 'error', text: 'حدث خطأ في الاتصال: ' + (err?.message || 'خطأ غير معروف') });
    } finally {
      setIsNumberingLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileCompanyName.trim()) {
      setProfileMsg({ type: 'error', text: 'يرجى كتابة اسم الشركة الرسمي' });
      return;
    }
    setIsSavingProfile(true);
    setProfileMsg(null);
    try {
      const payload: CompanyReportProfile = {
        companyName: profileCompanyName.trim(),
        companyAddress: profileCompanyAddress.trim() || DEFAULT_COMPANY_REPORT_PROFILE.companyAddress,
        companyPhone: profileCompanyPhone.trim() || DEFAULT_COMPANY_REPORT_PROFILE.companyPhone,
        companyActivity: profileCompanyActivity.trim() || DEFAULT_COMPANY_REPORT_PROFILE.companyActivity,
        managerName: profileManagerName.trim() || DEFAULT_COMPANY_REPORT_PROFILE.managerName,
      };

      if (onSaveCompanyProfile) {
        const res = await onSaveCompanyProfile(payload);
        if (res.success) {
          setProfileMsg({ type: 'success', text: res.message || 'تم حفظ بيانات وهوية الشركة بنجاح' });
        } else {
          setProfileMsg({ type: 'error', text: res.message || 'تعذر حفظ بيانات الشركة' });
        }
      } else {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyProfile: payload })
        });
        const data = await res.json();
        if (data.success) {
          setProfileMsg({ type: 'success', text: data.message || 'تم حفظ بيانات وهوية الشركة بنجاح' });
        } else {
          setProfileMsg({ type: 'error', text: data.message || 'تعذر حفظ بيانات الشركة' });
        }
      }
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء حفظ بيانات الشركة' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Privacy & Masking Settings Context
  const {
    privacyPasscode: currentPrivacyPasscode,
    autoHideSeconds: currentAutoHideSeconds,
    updatePrivacySettings,
    lockAll,
    unlockedCount
  } = usePrivacy();

  const [privacyCurrentPin, setPrivacyCurrentPin] = useState('');
  const [privacyNewPin, setPrivacyNewPin] = useState('');
  const [privacyConfirmPin, setPrivacyConfirmPin] = useState('');
  const [showPrivacyCurrentPin, setShowPrivacyCurrentPin] = useState(false);
  const [showPrivacyNewPin, setShowPrivacyNewPin] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(currentAutoHideSeconds);
  const [privacyMsg, setPrivacyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Currency Context (USD / IQD Exchange Rate)
  const {
    activeCurrency,
    setActiveCurrency,
    exchangeRatePer100,
    exchangeRate,
    lastUpdated: exchangeRateLastUpdated,
    updateExchangeRate,
    isLoading: isUpdatingRate
  } = useCurrency();

  const [rateInput, setRateInput] = useState<string>(String(exchangeRatePer100));
  const [rateMsg, setRateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setRateInput(String(exchangeRatePer100));
  }, [exchangeRatePer100]);

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateMsg(null);
    const num = Number(rateInput.replace(/[^\d.]/g, ''));
    if (isNaN(num) || num <= 0) {
      setRateMsg({ type: 'error', text: 'يرجى إدخال سعر صرف صالح أكبر من الصفر' });
      return;
    }
    const res = await updateExchangeRate(num);
    if (res.success) {
      setRateMsg({ type: 'success', text: res.message });
    } else {
      setRateMsg({ type: 'error', text: res.message });
    }
  };

  useEffect(() => {
    setSelectedDuration(currentAutoHideSeconds);
  }, [currentAutoHideSeconds]);

  const handleUpdatePrivacySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrivacyMsg(null);

    let targetPass = currentPrivacyPasscode;

    // If changing passcode
    if (privacyNewPin.trim()) {
      if (privacyCurrentPin.trim() !== currentPrivacyPasscode && privacyCurrentPin.trim() !== adminPasscode) {
        setPrivacyMsg({ type: 'error', text: 'رمز المرور الحالي غير صحيح' });
        return;
      }
      if (privacyNewPin.trim().length < 4) {
        setPrivacyMsg({ type: 'error', text: 'رمز المرور الجديد يجب أن يتكون من 4 خانات على الأقل' });
        return;
      }
      if (privacyNewPin.trim() !== privacyConfirmPin.trim()) {
        setPrivacyMsg({ type: 'error', text: 'تأكيد رمز المرور الجديد غير متطابق' });
        return;
      }
      targetPass = privacyNewPin.trim();
    }

    setIsSavingPrivacy(true);
    try {
      const res = await updatePrivacySettings(targetPass, selectedDuration);
      if (res.success) {
        setPrivacyMsg({ type: 'success', text: res.message || 'تم حفظ إعدادات الخصوصية بنجاح' });
        setPrivacyCurrentPin('');
        setPrivacyNewPin('');
        setPrivacyConfirmPin('');
      } else {
        setPrivacyMsg({ type: 'error', text: res.message || 'تعذر حفظ إعدادات الخصوصية' });
      }
    } catch (err: any) {
      setPrivacyMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء حفظ الإعدادات' });
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWipeModalOpen(false);
        if (!isRestoringBackup) {
          setIsRestoreModalOpen(false);
        }
      }
    };
    if (isWipeModalOpen || isRestoreModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isWipeModalOpen, isRestoreModalOpen, isRestoringBackup]);

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const cleanCurrent = currentPinInput.trim();
    const cleanNew = newPinInput.trim();
    const cleanConfirm = confirmPinInput.trim();

    // Verify current PIN strictly
    if (cleanCurrent !== adminPasscode) {
      setMsg({ type: 'error', text: 'رمز المرور الحالي غير صحيح. يرجى إدخال الرمز المعتمد حالياً.' });
      return;
    }

    if (!cleanNew || cleanNew.length < 4) {
      setMsg({ type: 'error', text: 'رمز المرور الجديد يجب أن يتكون من 4 خانات على الأقل.' });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setMsg({ type: 'error', text: 'تأكيد رمز المرور الجديد غير متطابق مع الرمز المدخل.' });
      return;
    }

    setIsSavingPin(true);
    try {
      if (onChangeAdminPasscode) {
        const res = await onChangeAdminPasscode(cleanNew);
        if (res.success) {
          setMsg({ type: 'success', text: res.message || 'تم حفظ رمز المرور الجديد بنجاح في قاعدة البيانات المركزية' });
          setCurrentPinInput('');
          setNewPinInput('');
          setConfirmPinInput('');
        } else {
          setMsg({ type: 'error', text: res.message || 'تعذر حفظ رمز المرور الجديد' });
        }
      } else {
        setMsg({ type: 'success', text: 'تم تحديث رمز المرور بنجاح' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء حفظ كلمة السر في قاعدة البيانات' });
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    setBackupToast(null);
    try {
      const res = await fetch('/api/backup/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPasscode })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'تعذر تصدير النسخة الاحتياطية');
      }

      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `aman_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupToast({
        type: 'success',
        text: `تم تنزيل النسخة الاحتياطية بنجاح (${data.metadata?.totalRecords || 0} سجل)`
      });
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'حدث خطأ أثناء تصدير النسخة الاحتياطية';
      setBackupToast({ type: 'error', text: errText });
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setRestoreError(null);
    setRestoreSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = validateBackupData(parsed);
        if (!validation.isValid) {
          setRestoreError(validation.error || 'الملف لا يتوافق مع بنية النسخ الاحتياطي المعتمدة لنظام أمان');
          setParsedBackupData(null);
          setBackupValidation(null);
        } else {
          setParsedBackupData(parsed);
          setBackupValidation(validation);
        }
      } catch {
        setRestoreError('الملف المحدد ليس بصيغة JSON صالحة أو تالف');
        setParsedBackupData(null);
        setBackupValidation(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!parsedBackupData || !backupValidation?.isValid) {
      setRestoreError('يرجى تحديد ملف نسخة احتياطية صالح أولاً');
      return;
    }

    if (restorePasscodeInput.trim() !== adminPasscode) {
      setRestoreError('رمز أمان الإدارة غير صحيح. يرجى إدخال رمز المرور الإداري الصحيح.');
      return;
    }

    setIsRestoringBackup(true);
    setRestoreError(null);

    try {
      if (autoBackupBeforeRestore) {
        try {
          const exportRes = await fetch('/api/backup/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPasscode })
          });
          const exportData = await exportRes.json();
          if (exportData.success && exportData.backup) {
            const blob = new Blob([JSON.stringify(exportData.backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aman_backup_pre_restore_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } catch (preErr) {
          console.warn('Pre-restore backup export warning:', preErr);
        }
      }

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPasscode: restorePasscodeInput.trim(),
          backupData: parsedBackupData
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشلت عملية استعادة النسخة الاحتياطية');
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('aman_finance_live_cache');
      }

      setRestoreSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'حدث خطأ أثناء استعادة البيانات';
      setRestoreError(errText);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const closeRestoreModal = () => {
    if (isRestoringBackup) return;
    setIsRestoreModalOpen(false);
    setRestoreFile(null);
    setParsedBackupData(null);
    setBackupValidation(null);
    setRestorePasscodeInput('');
    setRestoreError(null);
    setRestoreSuccess(false);
  };

  const handleConfirmWipeData = async () => {
    setIsDbResetLoading(true);
    try {
      if (onResetDatabase) {
        const dbRes = await onResetDatabase();
        if (dbRes.success) {
          alert('✅ ' + dbRes.message);
        } else {
          alert('⚠️ ' + dbRes.message);
        }
      } else if (onClearDemoData) {
        const res = onClearDemoData();
        if (res.success) {
          alert('✅ ' + res.message);
        }
      }
    } catch (err: any) {
      alert('❌ تعذر تصفير قاعدة البيانات: ' + err.message);
    } finally {
      setIsDbResetLoading(false);
      setIsWipeModalOpen(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/5">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">إعدادات النظام والأمان وقاعدة البيانات</h1>
            <p className="text-xs text-slate-400">إدارة كلمة سر الحذف وتفريغ السلة، وتوطين النظام، ومزامنة السيرفر</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap">
          <PrivacyToggleButton variant="compact" />
          {onLock && (
            <button
              type="button"
              onClick={onLock}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="قفل إعدادات النظام الآن وإعادة طلب كلمة المرور"
            >
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>قفل الإعدادات</span>
            </button>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
            <Server className="w-3.5 h-3.5" />
            <span>قاعدة البيانات: Neon Postgres (نشطة ومربوطة)</span>
          </span>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Password Box */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">كلمة مرور أمان النظام والإعدادات ودفتر الديون</h2>
                <p className="text-[11px] text-slate-400">الرمز المعتمد لحماية دفتر الديون، إعدادات النظام، وتأكيد الحذف</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[11px] font-bold border border-purple-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>حماية مركزية</span>
            </span>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <p className="text-xs text-slate-300 font-semibold leading-relaxed">
              تُستخدم كلمة المرور هذه (الافتراضي: <strong>2026</strong>) كطبقة أمان مشددة لحماية الدخول إلى <strong>دفتر الديون</strong>، وحماية <strong>إعدادات النظام</strong>، وتأكيد عمليات الحذف وتفريغ سلة المهملات.
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              الرمز المحفوظ حالياً في قاعدة البيانات: <strong className="text-purple-400 font-mono">••••</strong>
            </p>
          </div>

          {msg && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95 duration-200 ${
                msg.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="leading-relaxed">{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePin} className="space-y-3.5 text-xs">
            <div className="space-y-1.5 text-right">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>كلمة المرور الحالية *</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">(الافتراضي: 2026)</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPin ? 'text' : 'password'}
                  required
                  value={currentPinInput}
                  onChange={(e) => {
                    setCurrentPinInput(e.target.value);
                    if (msg) setMsg(null);
                  }}
                  placeholder="أدخل كلمة المرور الحالية..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono text-xs transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPin(!showCurrentPin)}
                  className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 text-right">
                <label className="text-slate-300 font-semibold">كلمة المرور الجديدة *</label>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    required
                    value={newPinInput}
                    onChange={(e) => {
                      setNewPinInput(e.target.value);
                      if (msg) setMsg(null);
                    }}
                    placeholder="الرمز الجديد (4 خانات+)"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono text-xs transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-slate-300 font-semibold">تأكيد كلمة المرور الجديدة *</label>
                <input
                  type={showNewPin ? 'text' : 'password'}
                  required
                  value={confirmPinInput}
                  onChange={(e) => {
                    setConfirmPinInput(e.target.value);
                    if (msg) setMsg(null);
                  }}
                  placeholder="إعادة كتابة الرمز الجديد..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono text-xs transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingPin || !currentPinInput || !newPinInput || !confirmPinInput}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSavingPin ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ في قاعدة البيانات...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>حفظ كلمة المرور في قاعدة البيانات</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Financial Numbers Privacy & Auto-Lock Settings Card */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">خصوصية الأرقام والبيانات المالية</h2>
                <p className="text-[11px] text-slate-400">حجب افتراضي بنجوم وكشف للعنصر المحدد فقط</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unlockedCount > 0 && (
                <button
                  type="button"
                  onClick={lockAll}
                  className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold hover:bg-rose-500/30 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>قفل الكل ({unlockedCount})</span>
                </button>
              )}
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold border border-amber-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>حماية مشددة</span>
              </span>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
            <p className="font-medium leading-relaxed">
              عند فتح النظام، تبقى كافة الأرقام المالية في جميع الشاشات محجوبة بـ <strong className="text-amber-400 font-mono tracking-wider">•••••••• د.ع</strong> افتراضياً. ولا يمكن إظهار أي رقم إلا بالنقر على رمز العين وإدخال رمز المرور السري، حيث ينكشف الرقم المحدد فقط.
            </p>
          </div>

          {privacyMsg && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
                privacyMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {privacyMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{privacyMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePrivacySettings} className="space-y-4 pt-1">
            {/* Auto-Lock Duration Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                <span>المهلة الزمنية لإعادة القفل التلقائي (Auto-Lock):</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { sec: 15, label: '15 ثانية (سريع)' },
                  { sec: 30, label: '30 ثانية (مستحسن)' },
                  { sec: 60, label: 'دقيقة واحدة' },
                  { sec: 120, label: 'دقيقتان' },
                  { sec: 0, label: 'يدوي فقط (بدون مؤقت)' }
                ].map((item) => (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => setSelectedDuration(item.sec)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      selectedDuration === item.sec
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Passcode Update Fields */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">تغيير رمز مرور فك حجب الأرقام (اختياري):</span>
                <span className="text-[10px] text-slate-500 font-mono">الرمز الحالي: ••••</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <input
                    type={showPrivacyCurrentPin ? 'text' : 'password'}
                    value={privacyCurrentPin}
                    onChange={(e) => setPrivacyCurrentPin(e.target.value)}
                    placeholder="الرمز الحالي..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono text-xs transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrivacyCurrentPin(!showPrivacyCurrentPin)}
                    className="absolute left-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPrivacyCurrentPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPrivacyNewPin ? 'text' : 'password'}
                    value={privacyNewPin}
                    onChange={(e) => setPrivacyNewPin(e.target.value)}
                    placeholder="الرمز الجديد (4+ خانات)..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono text-xs transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrivacyNewPin(!showPrivacyNewPin)}
                    className="absolute left-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPrivacyNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <input
                  type="password"
                  value={privacyConfirmPin}
                  onChange={(e) => setPrivacyConfirmPin(e.target.value)}
                  placeholder="تأكيد الرمز الجديد..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono text-xs transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingPrivacy}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSavingPrivacy ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ في السيرفر...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>حفظ إعدادات الخصوصية والمهلة الزمنية</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* USD / IQD Exchange Rate Card */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">سعر صرف الدولار الأمريكي (USD / IQD)</h2>
                <p className="text-[11px] text-slate-400">إدارة تسعير الدولار والتبديل التلقائي المزدوج في النظام</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>مباشر في الواجهات</span>
            </span>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">السعر الحالي المعتمد:</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">
                  100$ = {formatNumber(exchangeRatePer100)} د.ع
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                (سعر الدولار الواحد: <strong className="text-slate-200 font-mono">{formatNumber(exchangeRate)} د.ع</strong>)
              </div>
            </div>

            {exchangeRateLastUpdated && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                <Clock className="w-3 h-3" />
                <span>آخر تحديث: {formatDateTime(exchangeRateLastUpdated)}</span>
              </div>
            )}
          </div>

          {rateMsg && (
            <div
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                rateMsg.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              {rateMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{rateMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveRate} className="space-y-4">
            <div className="space-y-1.5 text-right">
              <label className="text-slate-300 font-semibold text-xs flex items-center justify-between">
                <span>سعر الـ 100 دولار بالدينار العراقي: *</span>
                <span className="text-[10px] text-slate-500">مثال: 153,000</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={rateInput}
                  onChange={(e) => {
                    setRateInput(e.target.value);
                    if (rateMsg) setRateMsg(null);
                  }}
                  placeholder="153000"
                  className="w-full pl-12 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-sm transition-colors text-right"
                />
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 font-mono">
                  د.ع
                </span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-400">خيارات سريعة شائعة:</span>
              <div className="flex flex-wrap gap-1.5">
                {[150000, 151500, 152000, 152500, 153000, 153500, 154000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setRateInput(String(preset));
                      if (rateMsg) setRateMsg(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                      Number(rateInput) === preset
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {formatNumber(preset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Interactive Conversion Preview */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] space-y-1">
              <span className="text-slate-400 font-semibold block">معاينة تحويل حية بناءً على المدخل:</span>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">1,000,000 د.ع =</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {formatUSD(Number(rateInput) > 0 ? (1000000 / Number(rateInput)) * 100 : 0)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">$1,000 دولار =</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {formatIQD(Number(rateInput) > 0 ? (1000 * Number(rateInput)) / 100 : 0)} د.ع
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingRate}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isUpdatingRate ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري حفظ وتطبيق سعر الصرف...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  <span>حفظ سعر الصرف وتطبيقه في النظام</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Company Profile & Report Header Settings Card */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-5 shadow-xl lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">هوية المنشأة وترويسة التقارير والمطبوعات الرسمية</h2>
                <p className="text-[11px] text-slate-400">
                  تعديل اسم الشركة، العنوان، الهاتف، وبيانات الإدارة التي تظهر تلقائياً في ترويسة وتذييل كافة التقارير والوصولات A4 دون لمس أي كود
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-bold border border-indigo-500/20 flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              <span>مطبوعات A4 موحدة</span>
            </span>
          </div>

          {profileMsg && (
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between animate-in fade-in duration-200 ${
              profileMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span>{profileMsg.text}</span>
              </div>
              <button onClick={() => setProfileMsg(null)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* Company Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>اسم الشركة / المنشأة الرسمي:</span>
                </label>
                <input
                  type="text"
                  value={profileCompanyName}
                  onChange={(e) => setProfileCompanyName(e.target.value)}
                  placeholder="مثال: شركة أمان للتقسيط والاستثمار المالي"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Manager Name */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>اسم المدير التنفيذي (للمصادقة والتوقيع):</span>
                </label>
                <input
                  type="text"
                  value={profileManagerName}
                  onChange={(e) => setProfileManagerName(e.target.value)}
                  placeholder="مثال: أحمد إياد"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Company Address */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>العنوان والفرع المعتمد:</span>
                </label>
                <input
                  type="text"
                  value={profileCompanyAddress}
                  onChange={(e) => setProfileCompanyAddress(e.target.value)}
                  placeholder="مثال: سامراء - حي الجامعة"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Company Phone */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                  <span>الهاتف المعتمد للإدارة:</span>
                </label>
                <input
                  type="text"
                  value={profileCompanyPhone}
                  onChange={(e) => setProfileCompanyPhone(e.target.value)}
                  placeholder="مثال: 07700000000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Company Activity */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>مجال النشاط / الوصف التعريفي:</span>
                </label>
                <input
                  type="text"
                  value={profileCompanyActivity}
                  onChange={(e) => setProfileCompanyActivity(e.target.value)}
                  placeholder="مثال: تقسيط الأجهزة والمواد والمشاريع الاستثمارية"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Live Header Preview Box */}
            <div className="p-4 rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-sm space-y-2">
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100 pb-1 flex items-center justify-between">
                <span>معاينة حية لشكل ترويسة التقارير والوصولات A4:</span>
                <span className="text-indigo-600 font-bold">معاينة مباشرة</span>
              </div>
              <div className="flex items-start justify-between gap-4 pt-1">
                <div>
                  <h3 className="text-base font-black text-indigo-950 m-0 leading-tight">
                    {profileCompanyName || 'اسم الشركة الرسمي'}
                  </h3>
                  <div className="text-xs font-bold text-indigo-600 mt-0.5">
                    تقرير تتبع ورصد شبكة الإحالة والعمولات المكتسبة
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {profileCompanyAddress || 'العنوان'} | الهاتف المعتمد للإدارة: <span className="font-mono">{profileCompanyPhone || 'الهاتف'}</span>
                    {profileCompanyActivity ? ` | ${profileCompanyActivity}` : ''}
                  </div>
                </div>
                <div className="text-left text-[9px] text-slate-500 border-r-2 border-slate-200 pr-3 shrink-0">
                  <div><strong>تاريخ الطباعة:</strong> {new Date().toLocaleDateString('en-GB')}</div>
                  <div><strong>المصادقة:</strong> تقرير مالي رسمي معتمد</div>
                  <div><strong>المدير:</strong> {profileManagerName || 'المدير'}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
              >
                {isSavingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>حفظ هوية المنشأة وتطبيقها على كافة التقارير</span>
              </button>
            </div>
          </form>
        </div>

        {/* Localization & Region */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">التوطين والعملة المعتمدة</h2>
                <p className="text-[11px] text-slate-400">إعدادات النطاق الجغرافي والعملات</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
              العراق
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">النطاق الجغرافي:</span>
              <span className="font-bold text-white">العراق - صلاح الدين - سامراء</span>
            </div>
            <div className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">العملة الأساسية:</span>
              <span className="font-bold text-emerald-400 font-mono">دينار عراقي (IQD) ⇄ دولار أمريكي (USD)</span>
            </div>
            <div className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">تنسيق الأرقام واللغة:</span>
              <span className="font-bold text-white">أرقام قياسية ولغة عربية (RTL)</span>
            </div>
            <div className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">حالة المزامنة السحابية:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>متصل بقاعدة بيانات Neon Live</span>
              </span>
            </div>
          </div>
        </div>

        {/* Backup & Recovery Box */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">النسخ الاحتياطي واستعادة البيانات</h2>
                <p className="text-[11px] text-slate-400">تصدير وتنزيل نسخة احتياطية كاملة لكافة الجداول الـ 16 أو استعادة النظام من ملف سابق</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
              حماية واسترجاع آمن
            </span>
          </div>

          {backupToast && (
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              backupToast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              <div className="flex items-center gap-2">
                {backupToast.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{backupToast.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setBackupToast(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>تصدير وتنزيل نسخة احتياطية فورية</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  يقوم بتجميع كافة بيانات المستثمرين، الزبائن، العقود، الأقساط، المخزن، وسجلات المحاسبة وتنزيلها كملف <span className="font-mono text-emerald-400">.json</span> مشفر برمز الإدارة لجهازك.
                </p>
              </div>

              <button
                type="button"
                disabled={isExportingBackup}
                onClick={handleExportBackup}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                {isExportingBackup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التصدير والتجهيز...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>تنزيل النسخة الاحتياطية الآن</span>
                  </>
                )}
              </button>
            </div>

            {/* Restore Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>استعادة النظام من ملف نسخة سابقة</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  يتيح لك استرجاع النظام بالكامل من ملف نسخة احتياطية مع فحص سلامة الملف ومعاينة السجلات قبل الاستبدال، وتأكيد رمز الأمان.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>فتح معالج الاستعادة...</span>
              </button>
            </div>
          </div>
        </div>

        {/* Accounting Numbering Cycle Management */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">إدارة دورة الترقيم المحاسبي (العقود والوصولات)</h2>
                <p className="text-[11px] text-slate-400">تصفير دورة أرقام العقود والفواتير ووصولات القبض لتبدأ من 1 يدوياً بقرار الإدارة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold border border-amber-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                تحكم إداري يدوي
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-white text-xs">تصفير دورة الترقيم (بدء العقود والفواتير والوصولات القادمة من رقم 1)</p>
                {currentResetEpoch ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                    آخر تصفير: {formatDateTime(currentResetEpoch)}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                    الترقيم متسلسل تراكمياً (لم يتم التصفير مسبقاً)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 max-w-xl leading-relaxed">
                يسمح لك هذا الزر ببدء دورة ترقيم جديدة تبدأ من (1) عند بدء العمل الفعلي بعد إكمال تجربة النظام، أو عند بداية سنة مالية جديدة دون تصفير تلقائي مزعج.
                <strong className="text-slate-300 mr-1">ملاحظة أمان:</strong> تظل جميع العقود والفواتير السابقة والوصولات القديمة محفوظة بالكامل في قاعدة البيانات بأرقامها السابقة وبكامل تفاصيلها المالية دون أي حذف أو فقدان.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNumberingPasscode('');
                setNumberingMsg(null);
                setIsNumberingModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-600/20 shrink-0 flex items-center gap-2 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 text-slate-950" />
              <span>تصفير دورة الترقيم الآن</span>
            </button>
          </div>
        </div>

        {/* Database Management & Reset Box */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <DatabaseZap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">تهيئة وإدارة قاعدة البيانات</h2>
                <p className="text-[11px] text-slate-400">تصفير السجلات وإعادة تهيئة الجداول</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-bold border border-rose-500/20">
              إجراء فائق الحساسية
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="space-y-1">
              <p className="font-bold text-white text-xs">تصفير السجلات وإعادة تهيئة الجداول في قاعدة البيانات المركزية</p>
              <p className="text-[11px] text-slate-400 max-w-xl leading-relaxed">
                يقوم هذا الإجراء بمسح كافة المعاملات والمستثمرين والزبائن وإعادة تهيئة النظام بنقطة بداية نظيفة (0 د.ع) وصندوق الشركة الرئيسي.
              </p>
            </div>

            <button
              onClick={() => setIsWipeModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/30 shrink-0 flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>تصفير وتهيئة قاعدة البيانات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for DB Reset */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl border border-rose-500/40 w-full max-w-md shadow-2xl p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
              <DatabaseZap className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-bold text-white">تأكيد تصفير وتهيئة قاعدة البيانات</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                هل أنت متأكد من رغبتك في تصفير كافة الجداول في قاعدة البيانات المركزية؟ سيتم مسح كافة المعاملات والمستثمرين والزبائن وإعادة تهيئة النظام بنقطة بداية نظيفة (0 د.ع).
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={isDbResetLoading}
                onClick={() => setIsWipeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                disabled={isDbResetLoading}
                onClick={handleConfirmWipeData}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDbResetLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التصفير...</span>
                  </>
                ) : (
                  <span>تأكيد التصفير</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Numbering Reset */}
      {isNumberingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl border border-amber-500/40 w-full max-w-md shadow-2xl p-6 space-y-5 text-right">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Hash className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">تأكيد تصفير دورة الترقيم المحاسبي</h2>
                <p className="text-xs text-slate-400">بدء ترقيم العقود والفواتير والوصولات القادمة من رقم 1</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-white">حفظ السجلات السابقة:</strong> كافة العقود والفواتير والوصولات الحالية ستبقى محفوظة بأرقامها السابقة وبكامل تفاصيلها المالية دون أي حذف.</span>
              </div>
              <div className="flex items-start gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong className="text-white">الدورة الجديدة:</strong> أي عقد أو فاتورة أو وصل يتم إنشاؤه بعد هذه اللحظة سيبدأ بتسلسل جديد (1، 2، 3...).</span>
              </div>
            </div>

            {numberingMsg && (
              <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                numberingMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {numberingMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{numberingMsg.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                أدخل رمز أمان الإدارة لتأكيد العملية
              </label>
              <div className="relative">
                <input
                  type={showNumberingPasscode ? 'text' : 'password'}
                  value={numberingPasscode}
                  onChange={(e) => setNumberingPasscode(e.target.value)}
                  placeholder="رمز أمان الإدارة (مثال: 2026)"
                  disabled={isNumberingLoading}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNumberingPasscode(!showNumberingPasscode)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showNumberingPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isNumberingLoading}
                onClick={() => setIsNumberingModalOpen(false)}
                className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isNumberingLoading || !numberingPasscode.trim()}
                onClick={handleConfirmResetNumbering}
                className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isNumberingLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التصفير...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>تأكيد تصفير دورة الترقيم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore from Backup Modal */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl border border-cyan-500/30 w-full max-w-xl shadow-2xl p-6 space-y-5 text-right">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">استعادة النظام من نسخة احتياطية</h2>
                  <p className="text-xs text-slate-400">تحديث واستبدال السجلات بقاعدة البيانات من ملف معتمد</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isRestoringBackup}
                onClick={closeRestoreModal}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success Notification */}
            {restoreSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-xs font-bold animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>تمت استعادة النسخة الاحتياطية بنجاح! جاري تحديث بيانات النظام تلقائياً...</span>
              </div>
            )}

            {/* Error Notification */}
            {restoreError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-xs font-semibold animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            {/* Step 1: File Selection Dropzone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                1. اختيار ملف النسخة الاحتياطية (.json):
              </label>
              <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-4 text-center bg-slate-950/60 transition-colors">
                <input
                  type="file"
                  id="backupFileInput"
                  accept=".json,application/json"
                  onChange={handleBackupFileSelect}
                  disabled={isRestoringBackup || restoreSuccess}
                  className="hidden"
                />
                <label
                  htmlFor="backupFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-cyan-400 flex items-center justify-center">
                    <FileJson className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-cyan-400 hover:underline">انقر لاختيار ملف</span>
                    <span className="text-xs text-slate-400"> أو اسحب الملف وأفلته هنا</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {restoreFile ? restoreFile.name : 'يدعم فقط ملفات .json المستخرجة من نظام أمان'}
                  </p>
                </label>
              </div>
            </div>

            {/* Step 2: Backup Validation Preview Card */}
            {backupValidation?.summary && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4" />
                    <span>تم التحقق من سلامة الملف</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    الإصدار {backupValidation.summary.version}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">الزبائن</div>
                    <div className="text-white font-bold font-mono text-sm">
                      {formatNumber(backupValidation.summary.borrowersCount)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">عقود التقسيط</div>
                    <div className="text-white font-bold font-mono text-sm">
                      {formatNumber(backupValidation.summary.contractsCount)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">المستثمرون</div>
                    <div className="text-white font-bold font-mono text-sm">
                      {formatNumber(backupValidation.summary.investorsCount)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-emerald-400 font-bold font-mono text-sm">
                      {formatNumber(backupValidation.summary.totalRecords)}
                    </div>
                    <div className="text-slate-400 text-[10px]">إجمالي السجلات</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>تاريخ تصدير النسخة:</span>
                  <span className="font-mono text-slate-300">
                    {formatDateTime(backupValidation.summary.exportedAt)}
                  </span>
                </div>
              </div>
            )}

            {/* Step 3: Admin Passcode Verification */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                2. إدخال رمز أمان الإدارة للتحقق والتأكيد:
              </label>
              <div className="relative">
                <input
                  type={showRestorePasscode ? 'text' : 'password'}
                  value={restorePasscodeInput}
                  onChange={(e) => setRestorePasscodeInput(e.target.value)}
                  placeholder="أدخل رمز مرور الإدارة (مثال: 2026)"
                  disabled={isRestoringBackup || restoreSuccess}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowRestorePasscode(!showRestorePasscode)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showRestorePasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Safety Option: Auto Backup Before Restore */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={autoBackupBeforeRestore}
                onChange={(e) => setAutoBackupBeforeRestore(e.target.checked)}
                disabled={isRestoringBackup || restoreSuccess}
                className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900"
              />
              <div className="space-y-0.5 text-slate-300">
                <span className="font-bold text-white">تنزيل نسخة احتياطية طارئة للبيانات الحالية قبل الاستعادة</span>
                <p className="text-[11px] text-slate-400">
                  (موصى به) يقوم بحفظ نسخة من البيانات الحالية وتنزيلها تلقائياً قبل بدء الاستبدال لحمايتك من أي فقدان غير مقصود.
                </p>
              </div>
            </label>

            {/* Warning Callout */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                تنبيه أمان: استعادة النسخة الاحتياطية ستقوم باستبدال البيانات الحالية بالكامل في قاعدة البيانات ببيانات هذا الملف.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isRestoringBackup}
                onClick={closeRestoreModal}
                className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={!backupValidation?.isValid || !restorePasscodeInput.trim() || isRestoringBackup || restoreSuccess}
                onClick={handleConfirmRestore}
                className="py-2.5 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                {isRestoringBackup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري استعادة البيانات والتحقق...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>تأكيد واستعادة النسخة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
