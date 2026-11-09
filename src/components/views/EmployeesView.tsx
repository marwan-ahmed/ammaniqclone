'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCog,
  Plus,
  Phone,
  Mail,
  ShieldCheck,
  Search,
  Filter,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Edit,
  Trash2,
  Key,
  DollarSign,
  Briefcase,
  SlidersHorizontal,
  RefreshCw,
  Check,
  X,
  LayoutGrid,
  List,
  ShieldAlert,
  Sparkles,
  FileText,
  UserCheck,
  Shield
} from 'lucide-react';
import { SecurityConfirmationModal } from '@/components/common/SecurityConfirmationModal';
import { SimulationStore } from '@/services/simulation';
import { Employee, SYSTEM_PERMISSIONS, SystemPermission, PermissionActionType } from '@/types/finance';
import { formatNumber } from '@/utils/formatters';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';

interface EmployeesViewProps {
  store: SimulationStore;
  onAddEmployee?: (data: {
    name: string;
    role: 'مدير النظام' | 'محاسب مالي' | 'مسؤول مخزن' | 'متابعة أقساط' | 'استعلام ميداني';
    phone: string;
    email: string;
    nationalId?: string;
    salaryIQD: number;
    status: 'نشط' | 'إجازة' | 'معطل' | 'بانتظار الموافقة';
    permissions: string[];
    notes?: string;
  }) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
  onEditEmployee?: (
    empId: string,
    data: {
      name: string;
      role: 'مدير النظام' | 'محاسب مالي' | 'مسؤول مخزن' | 'متابعة أقساط' | 'استعلام ميداني';
      phone: string;
      email: string;
      nationalId?: string;
      salaryIQD: number;
      status: 'نشط' | 'إجازة' | 'معطل' | 'بانتظار الموافقة';
      permissions?: string[];
      notes?: string;
    }
  ) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;

  onUpdatePermissions?: (empId: string, permissions: string[]) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
  onDeleteEmployee?: (empId: string) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
  onApproveEmployee?: (empId: string) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
  onRejectEmployee?: (empId: string) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
}


type RoleType = 'مدير النظام' | 'محاسب مالي' | 'مسؤول مخزن' | 'متابعة أقساط' | 'استعلام ميداني';
type StatusType = 'نشط' | 'إجازة' | 'معطل' | 'بانتظار الموافقة';


export const EmployeesView: React.FC<EmployeesViewProps> = ({
  store,
  onAddEmployee,
  onEditEmployee,
  onUpdatePermissions,
  onDeleteEmployee,
  onApproveEmployee,
  onRejectEmployee
}) => {
  // State Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'salary_desc' | 'salary_asc' | 'date_desc'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const pendingEmployees = useMemo(() => {
    return (store.employees || []).filter(e => e.status === 'بانتظار الموافقة');
  }, [store.employees]);


  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [permissionsTargetEmp, setPermissionsTargetEmp] = useState<Employee | null>(null);
  const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (permissionsTargetEmp) {
          setPermissionsTargetEmp(null);
        } else if (isAddModalOpen || editingEmployee) {
          setIsAddModalOpen(false);
          setEditingEmployee(null);
        }
      }
    };
    if (permissionsTargetEmp || isAddModalOpen || editingEmployee) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [permissionsTargetEmp, isAddModalOpen, editingEmployee]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: 'محاسب مالي' as RoleType,
    phone: '',
    email: '',
    nationalId: '',
    salaryIQD: 850000,
    status: 'نشط' as StatusType,
    permissions: [] as string[],
    notes: ''
  });

  // Permissions Modal Temp State
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permSearchQuery, setPermSearchQuery] = useState('');
  const [permCategoryFilter, setPermCategoryFilter] = useState<string>('ALL');
  const [permActionFilter, setPermActionFilter] = useState<string>('ALL');

  // Filter & Search Logic
  const filteredEmployees = useMemo(() => {
    let emps = store.employees || [];

    // Role Filter
    if (roleFilter !== 'ALL') {
      emps = emps.filter(e => e.role === roleFilter);
    }

    // Status Filter
    if (statusFilter !== 'ALL') {
      emps = emps.filter(e => e.status === statusFilter);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      emps = emps.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    return [...emps].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      if (sortBy === 'salary_desc') return b.salaryIQD - a.salaryIQD;
      if (sortBy === 'salary_asc') return a.salaryIQD - b.salaryIQD;
      if (sortBy === 'date_desc') return new Date(b.joinedDate).getTime() - new Date(a.joinedDate).getTime();
      return 0;
    });
  }, [store.employees, roleFilter, statusFilter, searchQuery, sortBy]);

  // Metrics
  const metrics = useMemo(() => {
    const totalEmployees = store.employees.length;
    const activeEmployees = store.employees.filter(e => e.status === 'نشط').length;
    const totalSalaries = store.employees.reduce((sum, e) => sum + (e.status !== 'معطل' ? e.salaryIQD : 0), 0);
    const adminsCount = store.employees.filter(e => e.role === 'مدير النظام').length;

    return { totalEmployees, activeEmployees, totalSalaries, adminsCount };
  }, [store.employees]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      role: 'محاسب مالي',
      phone: '0770',
      email: '',
      nationalId: '',
      salaryIQD: 850000,
      status: 'نشط',
      permissions: [
        'DASHBOARD_VIEW',
        'FUNDS_MANAGE',
        'EXPENSES_MANAGE',
        'REVENUES_MANAGE',
        'REPORTS_VIEW'
      ],
      notes: ''
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      role: emp.role,
      phone: emp.phone,
      email: emp.email,
      nationalId: emp.nationalId || '',
      salaryIQD: emp.salaryIQD,
      status: emp.status,
      permissions: emp.permissions || [],
      notes: emp.notes || ''
    });
  };

  // Submit Add/Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('يرجى إدخال اسم الموظف');
      return;
    }

    if (editingEmployee) {
      if (onEditEmployee) {
        const res = await onEditEmployee(editingEmployee.id, formData);
        if (res && res.success) {
          alert('✅ ' + res.message);
          setEditingEmployee(null);
        } else {
          alert('❌ ' + (res?.message || 'تعذر تعديل بيانات الموظف'));
        }
      }
    } else {
      if (onAddEmployee) {
        const res = await onAddEmployee(formData);
        if (res && res.success) {
          alert('✅ ' + res.message);
          setIsAddModalOpen(false);
        } else {
          alert('❌ ' + (res?.message || 'تعذر إضافة الموظف'));
        }
      }
    }
  };

  // Open Permissions Modal
  const handleOpenPermissionsModal = (emp: Employee) => {
    setPermissionsTargetEmp(emp);
    setSelectedPermissions(emp.permissions || []);
    setPermSearchQuery('');
    setPermCategoryFilter('ALL');
    setPermActionFilter('ALL');
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!permissionsTargetEmp) return;
    if (onUpdatePermissions) {
      const res = await onUpdatePermissions(permissionsTargetEmp.id, selectedPermissions);
      if (res && res.success) {
        alert('✅ ' + res.message);
        setPermissionsTargetEmp(null);
      } else {
        alert('❌ ' + (res?.message || 'تعذر تحديث الصلاحيات'));
      }
    }
  };

  // Delete Employee with security confirmation
  const handleConfirmDelete = async () => {
    if (!deletingEmpId) return;
    if (onDeleteEmployee) {
      const res = await onDeleteEmployee(deletingEmpId);
      if (res && res.success) {
        alert('✅ ' + res.message);
        setDeletingEmpId(null);
      } else {
        throw new Error(res?.message || 'تعذر حذف الحساب');
      }
    }
  };

  // Preset Role Permission Templates
  const applyPermissionPreset = (
    preset: 'ALL' | 'ACCOUNTANT' | 'INVENTORY' | 'FIELD' | 'RECEPTION' | 'AUDITOR' | 'VIEW_ONLY' | 'NONE'
  ) => {
    if (preset === 'ALL') {
      setSelectedPermissions(SYSTEM_PERMISSIONS.map(p => p.id));
    } else if (preset === 'ACCOUNTANT') {
      setSelectedPermissions([
        'DASHBOARD_VIEW', 'COMPANY_FUND_MANAGE', 'COMPANY_FUND_WITHDRAW', 'FUNDS_MANAGE',
        'REPORTS_VIEW', 'REPORTS_EXPORT', 'INVESTORS_VIEW', 'INVESTORS_STATEMENT_PRINT',
        'BORROWERS_VIEW', 'CONTRACTS_VIEW', 'CONTRACTS_CREATE', 'INSTALLMENTS_PAY',
        'CONTRACTS_PRINT', 'DEBT_LEDGER_MANAGE', 'INVENTORY_VIEW', 'EXPENSES_MANAGE',
        'REVENUES_MANAGE'
      ]);
    } else if (preset === 'INVENTORY') {
      setSelectedPermissions([
        'DASHBOARD_VIEW', 'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'INVENTORY_EDIT',
        'CONTRACTS_VIEW', 'REPORTS_VIEW'
      ]);
    } else if (preset === 'FIELD') {
      setSelectedPermissions([
        'DASHBOARD_VIEW', 'BORROWERS_VIEW', 'OVERDUE_MANAGE', 'COLLECTION_PRINT',
        'CONTRACTS_VIEW', 'INSTALLMENTS_PAY', 'CONTRACTS_PRINT', 'DEBT_LEDGER_MANAGE',
        'CREDIT_SCORE_VIEW'
      ]);
    } else if (preset === 'RECEPTION') {
      setSelectedPermissions([
        'DASHBOARD_VIEW', 'BORROWERS_VIEW', 'BORROWERS_MANAGE', 'CREDIT_SCORE_VIEW',
        'INVENTORY_VIEW', 'CONTRACTS_VIEW', 'CONTRACTS_CREATE', 'CONTRACTS_PRINT',
        'INSTALLMENTS_PAY'
      ]);
    } else if (preset === 'AUDITOR') {
      setSelectedPermissions([
        'DASHBOARD_VIEW', 'COMPANY_FUND_MANAGE', 'FUNDS_MANAGE', 'REPORTS_VIEW', 'REPORTS_EXPORT',
        'INVESTORS_VIEW', 'INVESTORS_STATEMENT_PRINT', 'BORROWERS_VIEW', 'CREDIT_SCORE_VIEW',
        'CONTRACTS_VIEW', 'INVENTORY_VIEW', 'TRASH_MANAGE'
      ]);
    } else if (preset === 'VIEW_ONLY') {
      setSelectedPermissions(SYSTEM_PERMISSIONS.filter(p => p.actionType === 'VIEW').map(p => p.id));
    } else if (preset === 'NONE') {
      setSelectedPermissions([]);
    }
  };

  // Filtered and Grouped Permissions by Category & Search & Action Filter
  const filteredPermissionsList = useMemo(() => {
    return SYSTEM_PERMISSIONS.filter((p) => {
      // 1. Category Filter
      if (permCategoryFilter !== 'ALL' && p.category !== permCategoryFilter) {
        return false;
      }
      // 2. Action Type Filter
      if (permActionFilter !== 'ALL' && p.actionType !== permActionFilter) {
        return false;
      }
      // 3. Search Query Filter
      if (permSearchQuery.trim()) {
        const q = permSearchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesId) return false;
      }
      return true;
    });
  }, [permCategoryFilter, permActionFilter, permSearchQuery]);

  const groupedFilteredPermissions = useMemo(() => {
    const map: Record<string, SystemPermission[]> = {};
    filteredPermissionsList.forEach((p) => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    });
    return map;
  }, [filteredPermissionsList]);

  // Visual Badge helper for Action Types
  const getActionBadge = (actionType: PermissionActionType) => {
    switch (actionType) {
      case 'VIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
            👁️ عرض
          </span>
        );
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            ➕ إضافة
          </span>
        );
      case 'EDIT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            ✏️ تعديل
          </span>
        );
      case 'FINANCIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20 shrink-0">
            💰 مالي
          </span>
        );
      case 'PRINT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0">
            🖨️ طباعة
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            🗑️ حذف
          </span>
        );
      case 'SECURITY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0">
            🛡️ أمان
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <UserCog className="w-7 h-7 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">إدارة الموظفين وصلاحيات الوصول</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                نظام التحكم بالصلاحيات RBAC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              إدارة فريق عمل نظام أمان للتقسيط (سامراء)، تعديل الأدوار، الرواتب، وتعيين الصلاحيات الخاصة بكل موظف
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <PrivacyToggleButton />
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة موظف جديد</span>
          </button>
        </div>
      </div>

      {/* Pending Registration Approvals Section */}
      {pendingEmployees.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base flex items-center gap-2">
                  <span>طلبات تسجيل وانضمام موظفين جدد بانتظار موافقتك</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                    {pendingEmployees.length}
                  </span>
                </h2>
                <p className="text-xs text-amber-200/80">
                  قام هؤلاء الموظفون بالتسجيل الذاتي من بوابة الدخول وهم بانتظار تفعيل حساباتهم وتعيين صلاحياتهم من قبل مدير النظام
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingEmployees.map((emp) => (
              <div key={emp.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">{emp.name}</h3>
                    <p className="text-xs text-indigo-400 font-mono mt-0.5">{emp.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 text-[11px] font-semibold border border-purple-500/20">
                        {emp.role}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        تاريخ الطلب: {emp.joinedDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={async () => {
                      if (onApproveEmployee) {
                        const res = await onApproveEmployee(emp.id);
                        if (res) alert(res.success ? '✅ ' + res.message : '❌ ' + res.message);
                      }
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>موافقة وتفعيل الحساب</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`هل أنت متأكد من رغبتك في رفض طلب انضمام ${emp.name}؟`)) {
                        if (onRejectEmployee) {
                          const res = await onRejectEmployee(emp.id);
                          if (res) alert(res.success ? '✅ ' + res.message : '❌ ' + res.message);
                        }
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs border border-rose-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>رفض</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Employees */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>كادر الموظفين</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white">{metrics.totalEmployees}</p>
          <p className="text-[11px] text-slate-400">إجمالي الموظفين المسجلين</p>
        </div>

        {/* Card 2: Active Employees */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>الموظفون النشطون</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{metrics.activeEmployees}</p>
          <p className="text-[11px] text-emerald-400/80">على رأس العمل وحاضرون</p>
        </div>

        {/* Card 3: Monthly Payroll */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>كتلة الرواتب الشهرية</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">
            {formatNumber(metrics.totalSalaries)} <span className="text-xs text-slate-400 font-normal">د.ع</span>
          </p>
          <p className="text-[11px] text-slate-400">الرواتب الشهرية للكادر النشط</p>
        </div>

        {/* Card 4: System Admins */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>المدراء والمسؤولون</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400">{metrics.adminsCount}</p>
          <p className="text-[11px] text-slate-400">بصلاحيات إدارية كاملة</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الموظف، الهاتف، البريد..."
              className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute left-2.5 top-2.5 text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>الدور:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">جميع الأدوار</option>
                <option value="مدير النظام">مدير النظام</option>
                <option value="محاسب مالي">محاسب مالي</option>
                <option value="مسؤول مخزن">مسؤول مخزن</option>
                <option value="متابعة أقساط">متابعة أقساط</option>
                <option value="استعلام ميداني">استعلام ميداني</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>الحالة:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="نشط">نشط (On Duty)</option>
                <option value="إجازة">في إجازة</option>
                <option value="معطل">معطل (Disabled)</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>الترتيب:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="name">الاسم (أبجدياً)</option>
                <option value="salary_desc">الراتب (الأعلى أولاً)</option>
                <option value="salary_asc">الراتب (الأدنى أولاً)</option>
                <option value="date_desc">تاريخ الانضمام (الأحدث)</option>
              </select>
            </div>

            {/* View Mode Toggle & Privacy */}
            <div className="flex items-center gap-2">
              <PrivacyToggleButton variant="compact" />
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="عرض بطاقات الشبكة"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="عرض الجدول التفصيلي"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employees Display: Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.length === 0 ? (
            <div className="col-span-full bg-slate-900 p-12 rounded-3xl border border-slate-800 text-center text-slate-500 space-y-2">
              <UserCog className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="font-bold text-white">لا يوجد موظفون يطابقون معايير البحث والفلترة الحالية</p>
              <p className="text-xs">جرب تغيير شروط الفلترة أو إعادة ضبط البحث</p>
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const permCount = emp.permissions ? emp.permissions.length : 0;
              const isSuperAdmin = emp.role === 'مدير النظام';

              return (
                <div
                  key={emp.id}
                  className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl hover:border-indigo-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Card Top Info */}
                    <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center text-base">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <PrivacyMaskedText id={`emp-name-${emp.id}`} text={emp.name} as="h2" className="font-bold text-white text-base leading-tight" />
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold mt-1 inline-block">
                            {emp.role}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                        emp.status === 'نشط' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : emp.status === 'إجازة' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'نشط' ? 'bg-emerald-400 animate-pulse' : 'bg-current'}`}></span>
                        {emp.status}
                      </span>
                    </div>

                    {/* Contact & Financial Details */}
                    <div className="space-y-2 text-xs text-slate-300">
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{emp.phone}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{emp.email}</span>
                      </p>
                      <p className="flex items-center gap-2 text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-mono text-[11px] truncate" title={emp.uid || emp.id}>UID: {emp.uid || emp.id}</span>
                      </p>
                      {emp.nationalId && (
                        <p className="flex items-center gap-2 text-slate-400">
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>الهوية: {emp.nationalId}</span>
                        </p>
                      )}

                      {/* Salary & Permissions Badge */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-slate-400">الراتب الشهري:</span>
                        <PrivacyMaskedAmount id={`emp-sal-${emp.id}`} value={emp.salaryIQD} label={`راتب: ${emp.name}`} size="sm" className="text-emerald-400" />
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-slate-400">الصلاحيات الممنوحة:</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-purple-400 font-bold">
                          {isSuperAdmin ? `كل الصلاحيات (${SYSTEM_PERMISSIONS.length})` : `${permCount} من ${SYSTEM_PERMISSIONS.length} صلاحية`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Controls */}
                  <div className="pt-4 border-t border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenPermissionsModal(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold text-xs border border-purple-500/30 transition-all active:scale-95"
                      title="إدارة وتعيين صلاحيات الوصول"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>الصلاحيات</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(emp)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all"
                      title="تعديل البيانات"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeletingEmpId(emp.id)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                      title="حذف الموظف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Employees Display: Table View */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                  <th className="p-4">الموظف والاسم</th>
                  <th className="p-4">الدور الوظيفي</th>
                  <th className="p-4">الهاتف والبريد</th>
                  <th className="p-4">الراتب الشهري</th>
                  <th className="p-4">عدد الصلاحيات</th>
                  <th className="p-4">تاريخ الانضمام</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">الإجراءات والتحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-500 py-8">
                      لا يوجد موظفون يطابقون الفلترة
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <PrivacyMaskedText id={`emp-table-name-${emp.id}`} text={emp.name} as="p" className="font-bold text-white" />
                            {emp.nationalId && <p className="text-[11px] text-slate-400">الهوية: {emp.nationalId}</p>}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                          {emp.role}
                        </span>
                      </td>

                      <td className="p-4">
                        <p className="text-slate-200 font-mono">{emp.phone}</p>
                        <p className="text-[11px] text-slate-400">{emp.email}</p>
                        <p className="text-[10px] text-cyan-400 font-mono" title={emp.uid || emp.id}>UID: {emp.uid || emp.id}</p>
                      </td>

                      <td className="p-4 font-bold text-emerald-400">
                        <PrivacyMaskedAmount id={`emp-table-sal-${emp.id}`} value={emp.salaryIQD} label={`راتب: ${emp.name}`} size="xs" className="text-emerald-400" />
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-purple-400 font-bold">
                          {emp.role === 'مدير النظام' ? `كاملة (${SYSTEM_PERMISSIONS.length})` : `${emp.permissions ? emp.permissions.length : 0} صلاحيات`}
                        </span>
                      </td>

                      <td className="p-4 text-slate-400">
                        {emp.joinedDate}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                          emp.status === 'نشط' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : emp.status === 'إجازة' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {emp.status}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenPermissionsModal(emp)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 transition-all"
                            title="إدارة الصلاحيات"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                            title="تعديل البيانات"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeletingEmpId(emp.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                            title="حذف الموظف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Add/Edit Employee Form Modal */}
      {(isAddModalOpen || editingEmployee) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 w-full max-w-xl shadow-2xl overflow-hidden my-8 space-y-6 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingEmployee ? `تعديل بيانات الموظف: ${editingEmployee.name}` : 'إضافة موظف جديد للكادر'}
                  </h2>
                  <p className="text-xs text-slate-400">تحديد الدور الوظيفي، البيانات الشخصية والراتب الشهري</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingEmployee(null);
                }}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">اسم الموظف الكامل *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: أحمد عبد الله السامراوي"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">الدور الوظيفي *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as RoleType })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="مدير النظام">مدير النظام (Super Admin)</option>
                    <option value="محاسب مالي">محاسب مالي (Accountant)</option>
                    <option value="مسؤول مخزن">مسؤول مخزن (Inventory Officer)</option>
                    <option value="متابعة أقساط">متابعة أقساط (Installment Agent)</option>
                    <option value="استعلام ميداني">استعلام ميداني (Field Inspector)</option>
                  </select>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">رقم الهاتف *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0770xxxxxxx"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="emp@aman.iq"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* National ID */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">رقم الهوية الوطنية (اختياري)</label>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                    placeholder="IQ-xxxxxxxx"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Salary IQD */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">الراتب الشهري (د.ع) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={25000}
                    value={formData.salaryIQD}
                    onChange={(e) => setFormData({ ...formData, salaryIQD: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5 col-span-full">
                  <label className="text-slate-300 font-medium">الحالة الوظيفية *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['نشط', 'إجازة', 'معطل'] as StatusType[]).map((st) => (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setFormData({ ...formData, status: st })}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          formData.status === st
                            ? st === 'نشط' ? 'bg-emerald-600 text-white border-emerald-500'
                              : st === 'إجازة' ? 'bg-amber-600 text-white border-amber-500'
                              : 'bg-rose-600 text-white border-rose-500'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5 col-span-full">
                  <label className="text-slate-300 font-medium">ملاحظات وقسم الموظف</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="أي ملاحظات إضافية حول التعيين، المهام، أو الفرع..."
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingEmployee(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
                >
                  {editingEmployee ? 'حفظ التعديلات' : 'إضافة الموظف الان'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Granular Interactive Permissions Modal */}
      {permissionsTargetEmp && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl border border-purple-500/40 w-full max-w-5xl shadow-2xl overflow-hidden my-6 space-y-5 p-6 text-right">
            {/* Permissions Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold shadow-md shadow-purple-950/40 shrink-0">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      مصفوفة الصلاحيات للموظف: {permissionsTargetEmp.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs border border-purple-500/30">
                      {permissionsTargetEmp.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    حدد الصلاحيات التفصيلية بدقة، أو اختر أحد القوالب التفاعلية الجاهزة حسب المهام الوظيفية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPermissionsTargetEmp(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors self-start sm:self-center shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Coverage & Progress Indicator */}
            {(() => {
              const count = selectedPermissions.length;
              const total = SYSTEM_PERMISSIONS.length;
              const percent = Math.round((count / total) * 100);
              return (
                <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-bold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span>تغطية الصلاحيات الإجمالية للنظام:</span>
                    </span>
                    <span className="font-mono font-black text-purple-300">
                      {count} من أصل {total} صلاحية مفعّلة ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Interactive Presets Toolbar */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>تطبيق القوالب الجاهزة حسب الدور:</span>
                </span>
                <span className="text-[11px] text-slate-500">نقرة واحدة لتعيين الحزمة المناسبة</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => applyPermissionPreset('ALL')}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 font-bold border border-purple-500/30 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <span>👑 المدير العام (الكل - 35)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPermissionPreset('ACCOUNTANT')}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 font-bold border border-blue-500/30 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <span>💼 محاسب مالي (17)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPermissionPreset('INVENTORY')}
                  className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 font-bold border border-amber-500/30 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <span>📦 مسؤول مخزن (6)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPermissionPreset('RECEPTION')}
                  className="px-3 py-1.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-200 font-bold border border-teal-500/30 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <span>🤝 مبيعات واستقبال (9)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPermissionPreset('FIELD')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 font-bold border border-emerald-500/30 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <span>📋 متابعة وتحصيل (9)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPermissionPreset('AUDITOR')}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 font-bold border border-cyan-500/30 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <span>📖 مدقق حسابات (11)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPermissionPreset('VIEW_ONLY')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700 transition-all active:scale-95"
                  title="تفعيل صلاحيات الاستعراض والقراءة فقط لجميع الأقسام"
                >
                  <span>👁️ قراءة واستعلام فقط (8)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPermissionPreset('NONE')}
                  className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold border border-rose-500/30 transition-all ml-auto active:scale-95"
                >
                  <span>❌ تفريغ الكل</span>
                </button>
              </div>
            </div>

            {/* Interactive Search & Live Filter Bar */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                    placeholder="ابحث في اسم الصلاحية أو وصفها (مثال: حذف، طباعة، زبائن، سحب، مخزن)..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  {permSearchQuery && (
                    <button
                      onClick={() => setPermSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = filteredPermissionsList.map((p) => p.id);
                      setSelectedPermissions(Array.from(new Set([...selectedPermissions, ...allIds])));
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700"
                  >
                    تحديد المعروض حالياً
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const displayedIds = filteredPermissionsList.map((p) => p.id);
                      setSelectedPermissions(selectedPermissions.filter((id) => !displayedIds.includes(id)));
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold transition-all border border-slate-700"
                  >
                    إلغاء المعروض
                  </button>
                </div>
              </div>

              {/* Action Type Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-[11px] text-slate-400 font-bold ml-1">نوع الإجراء:</span>
                {[
                  { id: 'ALL', label: 'الكل' },
                  { id: 'VIEW', label: '👁️ استعراض وعرض' },
                  { id: 'CREATE', label: '➕ إضافة وإنشاء' },
                  { id: 'EDIT', label: '✏️ تعديل' },
                  { id: 'FINANCIAL', label: '💰 مالي وتحصيل' },
                  { id: 'PRINT', label: '🖨️ طباعة وتصدير' },
                  { id: 'DELETE', label: '🗑️ حذف وإلغاء' },
                  { id: 'SECURITY', label: '🛡️ أمان ونظام' }
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setPermActionFilter(act.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      permActionFilter === act.id
                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-[11px] text-slate-400 font-bold ml-1">القسم:</span>
                {[
                  { id: 'ALL', label: 'جميع الأقسام' },
                  { id: 'لوحة التحكم والمحاسبة', label: 'لوحة التحكم والمحاسبة' },
                  { id: 'المستثمرون والمحافظ', label: 'المستثمرون والمحافظ' },
                  { id: 'الزبائن والعقود', label: 'الزبائن والعقود' },
                  { id: 'المخزن والأصول', label: 'المخزن والأصول' },
                  { id: 'المصاريف والإيرادات', label: 'المصاريف والإيرادات' },
                  { id: 'الإدارة والنظام', label: 'الإدارة والنظام' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPermCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      permCategoryFilter === cat.id
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permission Matrix Categorized (Interactive Cards) */}
            <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-1">
              {Object.keys(groupedFilteredPermissions).length === 0 ? (
                <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-bold text-white text-sm">لا توجد صلاحيات تطابق شروط البحث والفلترة</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPermSearchQuery('');
                      setPermCategoryFilter('ALL');
                      setPermActionFilter('ALL');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600/20 text-purple-300 font-bold text-xs border border-purple-500/30 mt-2"
                  >
                    إعادة ضبط الفلاتر
                  </button>
                </div>
              ) : (
                Object.entries(groupedFilteredPermissions).map(([category, list]) => {
                  const categoryIds = list.map((p) => p.id);
                  const selectedInThisCategory = categoryIds.filter((id) => selectedPermissions.includes(id)).length;
                  const isAllCategorySelected = categoryIds.length > 0 && selectedInThisCategory === categoryIds.length;

                  return (
                    <div key={category} className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                      {/* Category Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-purple-400" />
                          <span className="font-bold text-white text-xs sm:text-sm">{category}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 text-[10px] font-mono text-purple-300 border border-slate-800">
                            {selectedInThisCategory} من {categoryIds.length} محدد
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (isAllCategorySelected) {
                              setSelectedPermissions(selectedPermissions.filter((id) => !categoryIds.includes(id)));
                            } else {
                              setSelectedPermissions(Array.from(new Set([...selectedPermissions, ...categoryIds])));
                            }
                          }}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                            isAllCategorySelected
                              ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                              : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                          }`}
                        >
                          {isAllCategorySelected ? 'إلغاء تحديد هذا القسم' : 'تحديد كل هذا القسم'}
                        </button>
                      </div>

                      {/* Permissions Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {list.map((perm) => {
                          const isChecked = selectedPermissions.includes(perm.id);

                          return (
                            <div
                              key={perm.id}
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedPermissions(selectedPermissions.filter((id) => id !== perm.id));
                                } else {
                                  setSelectedPermissions([...selectedPermissions, perm.id]);
                                }
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                                isChecked
                                  ? 'bg-purple-950/40 border-purple-500/60 text-white shadow-lg shadow-purple-950/30'
                                  : 'bg-slate-950/90 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                                  isChecked ? 'bg-purple-600 border-purple-500 text-white shadow-sm' : 'border-slate-700 bg-slate-900'
                                }`}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5" />}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <p className="font-bold text-xs sm:text-sm text-white leading-tight">{perm.name}</p>
                                  {getActionBadge(perm.actionType)}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">{perm.description}</p>
                                <span className="font-mono text-[9px] text-slate-600 block pt-0.5">{perm.id}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Permissions Footer Buttons */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-medium">
                تم تفعيل <strong className="text-purple-400 font-bold">{selectedPermissions.length}</strong> من أصل {SYSTEM_PERMISSIONS.length} صلاحية
              </span>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setPermissionsTargetEmp(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black transition-all shadow-lg shadow-purple-600/30 active:scale-95 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ الصلاحيات المخصصة للموظف</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Security-Protected Delete Employee Confirmation */}
      {(() => {
        const deletingEmp = store.employees.find((e) => e.id === deletingEmpId);
        return (
          <SecurityConfirmationModal
            isOpen={!!deletingEmpId}
            onClose={() => setDeletingEmpId(null)}
            onConfirm={handleConfirmDelete}
            title="تأكيد حذف حساب الموظف نهائياً"
            subtitle="سيتم إلغاء صلاحيات الموظف وحذف الحساب من كادر النظام"
            itemName={deletingEmp?.name}
            itemDetails={deletingEmp ? `المسمى: ${deletingEmp.role} | البريد: ${deletingEmp.email}` : undefined}
            actionType="PERMANENT_DELETE"
            confirmButtonText="تأكيد حذف الموظف"
          />
        );
      })()}
    </div>
  );
};
