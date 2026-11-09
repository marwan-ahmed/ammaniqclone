'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, ActiveTab } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SimulationStore } from '@/services/simulation';
import { DashboardView } from '@/components/views/DashboardView';
import { InvestorsView } from '@/components/views/InvestorsView';
import { ReferralsView } from '@/components/views/ReferralsView';
import { BorrowersView } from '@/components/views/BorrowersView';
import { FundsView } from '@/components/views/FundsView';
import { CompanyFundView } from '@/components/views/CompanyFundView';
import { InventoryView } from '@/components/views/InventoryView';
import { InvoicesView } from '@/components/views/InvoicesView';
import { ExpensesView } from '@/components/views/ExpensesView';
import { RevenuesView } from '@/components/views/RevenuesView';
import { ReportsView } from '@/components/views/ReportsView';
import { DebtLedgerView } from '@/components/views/DebtLedgerView';
import { EmployeesView } from '@/components/views/EmployeesView';
import { SettingsView } from '@/components/views/SettingsView';
import { TrashView } from '@/components/views/TrashView';
import { ProfileView } from '@/components/views/ProfileView';
import { OverdueView } from '@/components/views/OverdueView';
import { CreditScoreView } from '@/components/views/CreditScoreView';
import { AuthView } from '@/components/auth/AuthView';
import { calculateInstallmentDueStatus, isContractCompleted } from '@/utils/installmentDates';
import { PrivacyProvider } from '@/context/PrivacyContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { ItemPrivacyPasscodeModal } from '@/components/common/ItemPrivacyPasscodeModal';
import { ProtectedTabGate } from '@/components/common/ProtectedTabGate';
import { WelcomeBanner3D } from '@/components/common/WelcomeBanner3D';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { logoutUser } from '@/services/auth';
import { Employee, SYSTEM_PERMISSIONS, SYSTEM_ADMIN_EMPLOYEE, TrashItem, TrashEntityType } from '@/types/finance';
import { ShieldAlert, UserCheck, Lock, X, Check, ArrowRight, UserCog, Key, Eye, EyeOff, AlertCircle, Trash2 } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';

const TAB_PERMISSION_MAP: Record<ActiveTab, { perm: string | string[] | null; title: string }> = {
  dashboard: { perm: 'DASHBOARD_VIEW', title: 'لوحة التحكم الرئيسية' },
  company_fund: { perm: ['COMPANY_FUND_MANAGE', 'COMPANY_FUND_WITHDRAW', 'FUNDS_MANAGE'], title: 'صندوق الشركة' },
  investors: { perm: ['INVESTORS_MANAGE', 'INVESTORS_VIEW', 'INVESTORS_WITHDRAW', 'INVESTORS_STATEMENT_PRINT'], title: 'المستثمرين والمحافظ' },
  referrals: { perm: ['REFERRALS_MANAGE', 'INVESTORS_MANAGE'], title: 'شبكة الإحالة والعمولات' },
  borrowers: { perm: ['BORROWERS_MANAGE', 'BORROWERS_VIEW', 'BORROWERS_DELETE'], title: 'الزبائن والكفلاء' },
  overdue: { perm: ['OVERDUE_MANAGE', 'BORROWERS_MANAGE'], title: 'سجل المتأخرين عن السداد والتحصيل' },
  credit_score: { perm: ['CREDIT_SCORE_VIEW', 'BORROWERS_MANAGE'], title: 'لوحة قياس الائتمان وجودة الزبائن' },
  funds: { perm: ['FUNDS_MANAGE', 'COMPANY_FUND_MANAGE'], title: 'الصناديق والمحاسبة' },
  inventory: { perm: ['INVENTORY_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_EDIT', 'INVENTORY_DELETE'], title: 'المخزن والأصول' },
  invoices: { perm: ['CONTRACTS_CREATE', 'CONTRACTS_VIEW', 'INSTALLMENTS_PAY', 'CONTRACTS_PRINT'], title: 'الفواتير وعقود التقسيط' },
  expenses: { perm: ['EXPENSES_MANAGE', 'EXPENSES_DELETE'], title: 'المصاريف التشغيلية' },
  revenues: { perm: 'REVENUES_MANAGE', title: 'الإيرادات والعمولات' },
  reports: { perm: ['REPORTS_VIEW', 'REPORTS_EXPORT'], title: 'التقارير المالية P&L' },
  debt_ledger: { perm: 'DEBT_LEDGER_MANAGE', title: 'دفتر الديون والتحصيل' },
  employees: { perm: ['EMPLOYEES_MANAGE', 'PERMISSIONS_ASSIGN'], title: 'إدارة الموظفين والصلاحيات' },
  trash: { perm: ['TRASH_MANAGE', 'TRASH_PERMANENT_DELETE'], title: 'سلة المهملات والأرشيف' },
  settings: { perm: 'SETTINGS_MANAGE', title: 'إعدادات النظام' },
  profile: { perm: null, title: 'الملف الشخصي' },
};

export default function Home() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [store, setStoreState] = useState<SimulationStore>(() => new SimulationStore());
  const [isWelcomeBannerOpen, setIsWelcomeBannerOpen] = useState<boolean>(false);

  const saveStoreCache = (currentStore: SimulationStore) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('aman_finance_live_cache', JSON.stringify({
        wallets: currentStore.wallets,
        companyWallet: currentStore.companyWallet,
        investors: currentStore.investors,
        inventory: currentStore.inventory,
        borrowers: currentStore.borrowers,
        contracts: currentStore.contracts,
        directDebts: currentStore.directDebts,
        transactions: currentStore.transactions,
        expenses: currentStore.expenses,
        revenues: currentStore.revenues,
        employees: currentStore.employees,
        trashItems: currentStore.trashItems,
        adminPasscode: currentStore.adminPasscode,
        numberingResetEpoch: currentStore.numberingResetEpoch
      }));
    } catch (e) {
      console.warn('Failed to save store cache:', e);
    }
  };

  const [adminPasscode, setAdminPasscode] = useState<string>(() => store.adminPasscode || '2026');

  // Passcode-protected tabs: 'debt_ledger' and 'settings'
  const [unlockedProtectedTabs, setUnlockedProtectedTabs] = useState<Record<string, boolean>>({});
  const [rememberSessionProtectedTabs, setRememberSessionProtectedTabs] = useState<Record<string, boolean>>({});

  const handleUnlockProtectedTab = (tab: 'debt_ledger' | 'settings', remember: boolean) => {
    setUnlockedProtectedTabs((prev) => ({ ...prev, [tab]: true }));
    if (remember) {
      setRememberSessionProtectedTabs((prev) => ({ ...prev, [tab]: true }));
    }
  };

  const handleLockProtectedTab = (tab: 'debt_ledger' | 'settings') => {
    setUnlockedProtectedTabs((prev) => ({ ...prev, [tab]: false }));
    setRememberSessionProtectedTabs((prev) => ({ ...prev, [tab]: false }));
  };

  useEffect(() => {
    if (activeTab !== 'debt_ledger' && !rememberSessionProtectedTabs['debt_ledger']) {
      setUnlockedProtectedTabs((prev) => (prev['debt_ledger'] ? { ...prev, debt_ledger: false } : prev));
    }
    if (activeTab !== 'settings' && !rememberSessionProtectedTabs['settings']) {
      setUnlockedProtectedTabs((prev) => (prev['settings'] ? { ...prev, settings: false } : prev));
    }
  }, [activeTab, rememberSessionProtectedTabs]);

  const setStore = (updater: SimulationStore | ((prev: SimulationStore) => SimulationStore)) => {
    setStoreState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      saveStoreCache(next);
      return next;
    });
  };

  const [isLiveNeonConnected, setIsLiveNeonConnected] = useState<boolean>(false);

  // Firebase Auth State Guard with Deterministic SSR-Safe Initial State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>('emp-1');

  // Current Logged-in Employee Object
  const currentEmployee = useMemo(() => {
    const adminEmailEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim();
    const userEmail = firebaseUser?.email?.toLowerCase().trim() || '';
    const matchedEmp = store.employees.find(
      (e) => (firebaseUser?.uid && (e.uid === firebaseUser.uid || e.id === firebaseUser.uid)) || (userEmail && e.email.toLowerCase().trim() === userEmail)
    );
    const isSuperAdmin = (adminEmailEnv && userEmail === adminEmailEnv) || matchedEmp?.role === 'مدير النظام';
    
    // 1. If logged in user is Super Admin
    if (isSuperAdmin) {
      const adminEmp = matchedEmp || store.employees.find((e) => e.role === 'مدير النظام') || SYSTEM_ADMIN_EMPLOYEE;
      if (firebaseUser?.uid && !adminEmp.uid) adminEmp.uid = firebaseUser.uid;
      return adminEmp;
    }

    // 2. Try finding by firebaseUser UID
    if (firebaseUser?.uid) {
      const foundByUid = store.employees.find((e) => e.uid === firebaseUser.uid || e.id === firebaseUser.uid);
      if (foundByUid) return foundByUid;
    }

    // 3. Try finding by currentEmployeeId
    const foundById = store.employees.find((e) => e.id === currentEmployeeId);
    if (foundById) return foundById;

    // 4. Try finding by firebaseUser email
    if (firebaseUser?.email) {
      const foundByEmail = store.employees.find((e) => e.email.toLowerCase().trim() === firebaseUser.email?.toLowerCase().trim());
      if (foundByEmail) {
        if (firebaseUser.uid && !foundByEmail.uid) foundByEmail.uid = firebaseUser.uid;
        return foundByEmail;
      }
    }

    // 5. Default fallback to System Admin (أحمد إياد)
    return store.employees.find((e) => e.role === 'مدير النظام') || SYSTEM_ADMIN_EMPLOYEE;
  }, [store.employees, currentEmployeeId, firebaseUser]);

  // Firebase Auth Listener with Strict Role and Approval Verification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const adminEmailEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim();
        const userEmail = user.email?.toLowerCase().trim() || '';
        const matchedEmp = store.employees.find(
          (e) => (e.uid && (e.uid === user.uid || e.id === user.uid)) || e.email.toLowerCase().trim() === userEmail
        );
        const isSuperAdmin = (adminEmailEnv && userEmail === adminEmailEnv) || matchedEmp?.role === 'مدير النظام';

        if (matchedEmp && !matchedEmp.uid) {
          matchedEmp.uid = user.uid;
        }

        // Account status guard: immediately revoke session for disabled or pending accounts
        if (!isSuperAdmin) {
          if (matchedEmp && (matchedEmp.status === 'بانتظار الموافقة' || matchedEmp.status === 'معطل')) {
            await logoutUser();
            if (typeof window !== 'undefined') {
              localStorage.removeItem('aman_auth_session');
            }
            setIsAuthenticated(false);
            setFirebaseUser(null);
            setAuthChecking(false);
            return;
          }
        }

        setIsAuthenticated(true);
        if (matchedEmp) {
          setCurrentEmployeeId(matchedEmp.id);
        } else if (isSuperAdmin) {
          setCurrentEmployeeId('emp-1');
        }
      } else {
        // Clear authenticated session when signed out
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aman_auth_session');
        }
        setIsAuthenticated(false);
        setFirebaseUser(null);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [store.employees]);

  // Permission Check Function
  const hasPermission = (permissionId: string) => {
    if (!currentEmployee) return true;
    if (currentEmployee.role === 'مدير النظام') return true;
    const perms = currentEmployee.permissions || [];
    if (perms.includes(permissionId)) return true;
    // Parent permission fallback logic
    if (permissionId === 'BORROWERS_VIEW' && perms.includes('BORROWERS_MANAGE')) return true;
    if (permissionId === 'INVENTORY_VIEW' && perms.includes('INVENTORY_MANAGE')) return true;
    if (permissionId === 'CONTRACTS_VIEW' && perms.includes('CONTRACTS_CREATE')) return true;
    if (permissionId === 'INVESTORS_VIEW' && perms.includes('INVESTORS_MANAGE')) return true;
    if (permissionId === 'FUNDS_MANAGE' && perms.includes('COMPANY_FUND_MANAGE')) return true;
    return false;
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      try {
        const sessionRaw = localStorage.getItem('aman_auth_session');
        if (sessionRaw) {
          const session = JSON.parse(sessionRaw);
          if (session && session.email) {
            setFirebaseUser({
              uid: session.uid || 'emp-1',
              email: session.email,
              displayName: session.name || 'أحمد إياد',
            } as any);
            setIsAuthenticated(true);
            setCurrentEmployeeId(session.uid || 'emp-1');
          }
        }
      } catch (e) {
        console.warn('Initial session restore:', e);
      }
    }
    fetchLiveData();
  }, []);

  // 3D Welcome Banner Auto-Greeting & Storage Check
  useEffect(() => {
    if (mounted && isAuthenticated) {
      try {
        const dismissedSession = sessionStorage.getItem('aman_welcome_dismissed');
        const dontShowToday = localStorage.getItem('aman_welcome_dont_show_today');
        const todayStr = new Date().toISOString().split('T')[0];

        if (!dismissedSession && dontShowToday !== todayStr) {
          setIsWelcomeBannerOpen(true);
        }
      } catch (e) {
        setIsWelcomeBannerOpen(true);
      }
    }
  }, [mounted, isAuthenticated]);

  // Listener for manual triggers from anywhere in the window
  useEffect(() => {
    const handleOpenBannerEvent = () => setIsWelcomeBannerOpen(true);
    window.addEventListener('open-welcome-banner', handleOpenBannerEvent);
    return () => window.removeEventListener('open-welcome-banner', handleOpenBannerEvent);
  }, []);

  const handleCloseWelcomeBanner = (dontShowToday?: boolean) => {
    setIsWelcomeBannerOpen(false);
    try {
      sessionStorage.setItem('aman_welcome_dismissed', 'true');
      if (dontShowToday) {
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem('aman_welcome_dont_show_today', todayStr);
      }
    } catch (e) {}
  };

  const handleOpenWelcomeBanner = () => {
    setIsWelcomeBannerOpen(true);
  };

  // Fetch Live Data from Neon DB API Route
  const fetchLiveData = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) {
        console.warn('Dashboard fetch response not OK:', res.status, res.statusText);
        return;
      }
      const json = await res.json();

      if (json.success && json.data) {
        setIsLiveNeonConnected(true);
        const {
          wallets = [],
          investors: dbInvestors = [],
          investorContracts: dbContractsConfig = [],
          inventory = [],
          borrowers: dbBorrowers = [],
          contracts: dbInstContracts = [],
          schedules: dbSchedules = [],
          transactions: dbTransactions = [],
          expenses: dbExpenses = [],
          revenues: dbRevenues = [],
          employees: dbEmployees = [],
          directDebts = [],
          directSchedules = [],
          trashItems: dbTrashItems = []
        } = json.data;

        const newStore = new SimulationStore();

        // 1. Map Wallets
        if (wallets.length > 0) {
          newStore.wallets = wallets.map((w: any) => ({
            id: w.id,
            ownerType: w.ownerType,
            ownerId: w.investorId || 'company-s',
            ownerName: w.ownerName,
            balance: parseFloat(w.balanceIQD || '0'),
            totalAssetsValuation: 0,
            totalDebtsValuation: 0,
            currency: 'IQD',
            updatedAt: w.updatedAt || new Date().toISOString()
          }));
          const companyW = newStore.wallets.find((w) => w.ownerType === 'COMPANY');
          if (companyW) {
            newStore.companyWallet = companyW;
          }
        }

        // 2. Map Investors
        newStore.investors = dbInvestors.map((inv: any) => {
          const matchW = newStore.wallets.find((w) => w.ownerId === inv.id);
          const matchCConfig = dbContractsConfig.find((c: any) => c.investorId === inv.id);
          const referrerObj = matchCConfig?.referrerId ? dbInvestors.find((i: any) => i.id === matchCConfig.referrerId) : null;
          const isBroker = Boolean(
            matchW?.ownerName?.includes('محفظة عمولات الإحالة') ||
            matchCConfig?.notes?.includes('شريك إحالة') ||
            (matchCConfig && parseFloat(matchCConfig.investorSharePercent || '0') === 0)
          );
          
          return {
            id: inv.id,
            name: inv.name,
            phone: inv.phone || '',
            nationalId: inv.nationalId || '',
            address: inv.address || '',
            walletId: matchW ? matchW.id : `wallet-${inv.id}`,
            isReferralPartner: isBroker,
            referredById: matchCConfig?.referrerId || undefined,
            referredByName: referrerObj ? referrerObj.name : undefined,
            referralSharePercent: matchCConfig?.referrerSharePercent ? parseFloat(matchCConfig.referrerSharePercent) : 0,
            contract: matchCConfig ? {
              id: matchCConfig.id,
              investorId: inv.id,
              investorSharePercent: parseFloat(matchCConfig.investorSharePercent || '60'),
              companySharePercent: parseFloat(matchCConfig.companySharePercent || '40'),
              lossSharingPolicy: matchCConfig.lossPolicy || 'SHARED',
              referrerId: matchCConfig.referrerId || undefined,
              referrerName: referrerObj ? referrerObj.name : undefined,
              referrerSharePercent: matchCConfig.referrerSharePercent ? parseFloat(matchCConfig.referrerSharePercent) : 0,
              contractDate: matchCConfig.contractDate ? new Date(matchCConfig.contractDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              notes: matchCConfig.notes || ''
            } : {
              id: `contract-${inv.id}`,
              investorId: inv.id,
              investorSharePercent: 60,
              companySharePercent: 40,
              lossSharingPolicy: 'SHARED',
              referrerId: undefined,
              referrerName: undefined,
              referrerSharePercent: 0,
              contractDate: new Date().toISOString().split('T')[0],
              notes: 'عقد افتراضي'
            },
            totalCapitalDeposited: isBroker ? 0 : (matchW ? matchW.balance : 0),
            activeInvestmentsAmount: 0,
            availableLiquidity: matchW ? matchW.balance : 0,
            totalProfitsEarned: 0,
            totalReferralCommissionsEarned: 0,
            totalLossesIncurred: 0,
            createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
        });

        // 3. Map Inventory Items
        newStore.inventory = inventory.map((item: any) => {
          const investorObj = newStore.investors.find((inv) => inv.id === item.investorId);
          const cost = parseFloat(item.unitCostIQD || '0');
          const qty = item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 1;
          const totalCost = cost * qty;

          // Self-heal: If an item has quantity > 0, it must be available for contracts
          let status = item.status;
          if (qty > 0 && status === 'FULLY_FINANCED') {
            status = 'IN_STOCK';
          }

          return {
            id: item.id,
            sku: item.sku,
            name: item.name,
            category: item.category,
            investorId: item.investorId,
            investorName: investorObj ? investorObj.name : 'مموّل النظام',
            quantity: qty,
            unitCostIQD: cost,
            totalCostIQD: totalCost,
            targetSellingPriceIQD: parseFloat(item.targetSellingPriceIQD || '0'),
            purchaseInvoiceId: item.purchaseInvoiceId || '',
            status: status,
            purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
        });

        // Update wallet totalAssetsValuation from inventory
        newStore.inventory.forEach(item => {
          if (item.quantity > 0) {
            const matchW = newStore.wallets.find(w => w.ownerId === item.investorId);
            if (matchW) {
              matchW.totalAssetsValuation += item.totalCostIQD;
            }
          }
        });

        // 4. Map Borrowers
        newStore.borrowers = dbBorrowers.map((b: any) => {
          let parsedGuarantors = [];
          try {
            parsedGuarantors = b.guarantors ? JSON.parse(b.guarantors) : [];
          } catch (e) {
            console.warn('Failed to parse guarantors JSON:', e);
          }
          return {
            id: b.id,
            name: b.name,
            phone: b.phone || '',
            address: b.address || '',
            city: b.city || 'سامراء',
            nationalId: b.nationalId || '',
            wifeName: '',
            jobTitle: b.jobTitle || 'موظف حكومي',
            monthlyIncomeIQD: parseFloat(b.monthlyIncomeIQD || '0'),
            introducedBy: b.introducedBy || b.introduced_by || undefined,
            guarantors: parsedGuarantors,
            totalFinancedIQD: 0,
            totalRepaidIQD: 0,
            remainingDebtIQD: 0,
            status: b.status || 'ACTIVE',
            createdAt: b.createdAt ? new Date(b.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
        });

        // 5. Map Contracts and Installment Schedules
        newStore.contracts = dbInstContracts.map((c: any) => {
          const borrowerObj = newStore.borrowers.find(b => b.id === c.borrowerId);
          const investorObj = newStore.investors.find(inv => inv.id === c.investorId);
          const itemObj = newStore.inventory.find(item => item.id === c.inventoryItemId);

          const costPrice = parseFloat(c.itemCostPriceIQD || '0');
          const salePrice = parseFloat(c.totalSalePriceIQD || '0');
          const downPay = parseFloat(c.downPaymentIQD || '0');
          const financed = salePrice - downPay;
          const profit = salePrice - costPrice;

          const rawSchedules = dbSchedules.filter((s: any) => s.contractId === c.id);
          const schedules = rawSchedules.map((s: any) => ({
            id: s.id,
            contractId: s.contractId,
            installmentNumber: s.installmentNumber,
            dueDate: s.dueDate ? new Date(s.dueDate).toISOString().split('T')[0] : '',
            amountIQD: parseFloat(s.amountIQD || '0'),
            principalAmountIQD: parseFloat(s.principalAmountIQD || '0'),
            profitAmountIQD: parseFloat(s.profitAmountIQD || '0'),
            investorProfitShareIQD: parseFloat(s.investorProfitShareIQD || '0'),
            referrerProfitShareIQD: s.referrerProfitShareIQD ? parseFloat(s.referrerProfitShareIQD) : 0,
            companyProfitShareIQD: parseFloat(s.companyProfitShareIQD || '0'),
            paidDate: s.paidDate ? new Date(s.paidDate).toISOString().split('T')[0] : undefined,
            status: s.status
          })).sort((a: any, b: any) => a.installmentNumber - b.installmentNumber);

          if (borrowerObj) {
            borrowerObj.totalFinancedIQD += salePrice;
            const repaid = schedules.filter((s: any) => s.status === 'PAID').reduce((sum: number, s: any) => sum + s.amountIQD, 0);
            borrowerObj.totalRepaidIQD += repaid;
            borrowerObj.remainingDebtIQD += (financed - repaid);
          }

          const unpaidFinanced = schedules.filter((s: any) => s.status !== 'PAID').reduce((sum: number, s: any) => sum + s.principalAmountIQD, 0);
          const matchW = newStore.wallets.find(w => w.ownerId === c.investorId);
          if (matchW) {
            matchW.totalDebtsValuation += unpaidFinanced;
          }

          if (investorObj) {
            investorObj.activeInvestmentsAmount += unpaidFinanced;
            const earnedProfits = schedules.filter((s: any) => s.status === 'PAID').reduce((sum: number, s: any) => sum + s.investorProfitShareIQD, 0);
            investorObj.totalProfitsEarned += earnedProfits;
          }

          const unitCost = itemObj ? itemObj.unitCostIQD : 0;
          const derivedQty = unitCost > 0 ? Math.max(1, Math.round(costPrice / unitCost)) : 1;

          return {
            id: c.id,
            contractNumber: c.contractNumber,
            borrowerId: c.borrowerId,
            borrowerName: borrowerObj ? borrowerObj.name : 'عميل النظام',
            investorId: c.investorId,
            investorName: investorObj ? investorObj.name : 'مموّل النظام',
            inventoryItemId: c.inventoryItemId,
            inventoryItemName: itemObj ? itemObj.name : 'بضاعة ممولة',
            quantity: derivedQty,
            itemCostPriceIQD: costPrice,
            totalSalePriceIQD: salePrice,
            profitMarginIQD: profit,
            downPaymentIQD: downPay,
            financedAmountIQD: financed,
            monthlyInstallmentIQD: parseFloat(c.monthlyInstallmentIQD || '0'),
            monthsCount: c.monthsCount,
            startDate: c.startDate ? new Date(c.startDate).toISOString().split('T')[0] : '',
            endDate: c.startDate ? new Date(new Date(c.startDate).setMonth(new Date(c.startDate).getMonth() + c.monthsCount)).toISOString().split('T')[0] : '',
            schedules: schedules,
            status: isContractCompleted({ status: c.status, totalSalePriceIQD: salePrice, downPaymentIQD: downPay, schedules }) ? 'COMPLETED' : c.status
          };
        });

        // Synchronize borrower statuses based on loan repayment
        newStore.borrowers.forEach((b: any) => {
          if (b.totalFinancedIQD > 0 && b.remainingDebtIQD <= 0) {
            b.status = 'SETTLED';
          } else if (b.remainingDebtIQD > 0) {
            b.status = 'ACTIVE';
          }
        });

        // 6. Map Ledger Transactions
        newStore.transactions = dbTransactions.map((tx: any) => {
          const investorObj = newStore.investors.find(inv => inv.id === tx.investorId);
          const borrowerObj = newStore.borrowers.find(b => b.id === tx.borrowerId);
          const fromW = newStore.wallets.find(w => w.id === tx.fromWalletId);
          const toW = newStore.wallets.find(w => w.id === tx.toWalletId);

          return {
            id: tx.id,
            referenceNo: tx.referenceNo,
            date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : '',
            type: tx.type,
            investorId: tx.investorId || undefined,
            investorName: investorObj ? investorObj.name : undefined,
            borrowerId: tx.borrowerId || undefined,
            borrowerName: borrowerObj ? borrowerObj.name : undefined,
            referrerId: tx.referrerId || undefined,
            fromWalletId: tx.fromWalletId,
            fromWalletName: fromW ? fromW.ownerName : 'حساب خارجي/بضاعة',
            toWalletId: tx.toWalletId,
            toWalletName: toW ? toW.ownerName : 'حساب خارجي/بضاعة',
            amountIQD: parseFloat(tx.amountIQD || '0'),
            investorProfitShareIQD: tx.investorProfitShareIQD ? parseFloat(tx.investorProfitShareIQD) : undefined,
            referrerProfitShareIQD: tx.referrerProfitShareIQD ? parseFloat(tx.referrerProfitShareIQD) : undefined,
            companyProfitShareIQD: tx.companyProfitShareIQD ? parseFloat(tx.companyProfitShareIQD) : undefined,
            description: tx.description
          };
        });

        // Calculate and aggregate referral commissions earned for referrers
        newStore.investors.forEach((inv) => {
          const refTxs = newStore.transactions.filter(
            (t) => t.type === 'REFERRAL_COMMISSION' && (t.investorId === inv.id || t.toWalletId === inv.walletId)
          );
          const totalRefEarned = refTxs.reduce((sum, t) => sum + t.amountIQD, 0);
          inv.totalReferralCommissionsEarned = totalRefEarned;
          inv.totalProfitsEarned += totalRefEarned;
        });

        // 7. Map Expenses
        newStore.expenses = dbExpenses.map((exp: any) => {
          const fromW = newStore.wallets.find(w => w.id === exp.paidFromWalletId);
          return {
            id: exp.id,
            title: exp.title,
            category: exp.category,
            amountIQD: parseFloat(exp.amountIQD || '0'),
            date: exp.date ? new Date(exp.date).toISOString().split('T')[0] : '',
            paidFromWalletId: exp.paidFromWalletId,
            paidFromWalletName: fromW ? fromW.ownerName : 'صندوق مجهول',
            recipientName: exp.recipientName || undefined,
            referenceNo: exp.referenceNo || undefined,
            notes: exp.notes || undefined
          };
        });

        // 8. Map Revenues
        newStore.revenues = dbRevenues.map((rev: any) => {
          return {
            id: rev.id,
            title: rev.title,
            category: rev.category,
            amountIQD: parseFloat(rev.amountIQD || '0'),
            date: rev.date ? new Date(rev.date).toISOString().split('T')[0] : '',
            receivedToWalletId: rev.receivedToWalletId,
            notes: rev.notes || undefined
          };
        });

        // 9. Map Employees
        if (dbEmployees.length > 0) {
          const dbEmps = dbEmployees.map((emp: any) => ({
            id: emp.id,
            name: emp.name,
            role: emp.role,
            phone: emp.phone,
            email: emp.email,
            nationalId: emp.nationalId || undefined,
            salaryIQD: parseFloat(emp.salaryIQD || '0'),
            status: emp.status,
            permissions: typeof emp.permissions === 'string' ? JSON.parse(emp.permissions || '[]') : (emp.permissions || []),
            notes: emp.notes || undefined,
            joinedDate: emp.createdAt ? new Date(emp.createdAt).toISOString().split('T')[0] : '2026-01-01'
          }));

          const hasAdminInDB = dbEmps.some((e: any) => e.email.toLowerCase().trim() === 'ahmed.ayad@ajeebiq.com' || e.role === 'مدير النظام');
          if (!hasAdminInDB) {
            dbEmps.unshift(SYSTEM_ADMIN_EMPLOYEE);
          }
          newStore.employees = dbEmps;
        }

        // 10. Update totalCapitalDeposited for investors based on deposits in ledger transactions
        newStore.investors.forEach(investor => {
          const depositsSum = newStore.transactions
            .filter((tx: any) => tx.type === 'DEPOSIT' && tx.investorId === investor.id)
            .reduce((sum: number, tx: any) => sum + tx.amountIQD, 0);
          if (depositsSum > 0) {
            investor.totalCapitalDeposited = depositsSum;
          }
        });

        // 11. Map Direct Debts (دفتر الديون - منفصل تماماً)
        newStore.directDebts = directDebts.map((c: any) => {
          const investorObj = newStore.investors.find(inv => inv.id === c.investorId);
          const isCompany = c.investorId === 'company-s';
          const investorName = isCompany
            ? 'نظام أمان للتقسيط (صندوق الشركة الرئيسي)'
            : investorObj
            ? investorObj.name
            : 'الدائن الممول';

          const costPrice = parseFloat(c.itemCostPriceIQD || '0') || Math.round(parseFloat(c.totalAmountIQD || '0') * 0.8);
          const salePrice = parseFloat(c.totalAmountIQD || '0');
          const downPay = parseFloat(c.downPaymentIQD || '0');
          const financed = salePrice - downPay;
          const profit = salePrice - costPrice;

          const rawSchedules = directSchedules.filter((s: any) => s.directDebtId === c.id);
          const schedules = rawSchedules.map((s: any) => ({
            id: s.id,
            contractId: s.directDebtId,
            installmentNumber: s.installmentNumber,
            dueDate: s.dueDate ? new Date(s.dueDate).toISOString().split('T')[0] : '',
            amountIQD: parseFloat(s.amountIQD || '0'),
            principalAmountIQD: parseFloat(s.principalAmountIQD || '0'),
            profitAmountIQD: parseFloat(s.profitAmountIQD || '0'),
            investorProfitShareIQD: parseFloat(s.investorProfitShareIQD || '0'),
            companyProfitShareIQD: parseFloat(s.companyProfitShareIQD || '0'),
            paidDate: s.paidDate ? new Date(s.paidDate).toISOString().split('T')[0] : undefined,
            status: s.status
          })).sort((a: any, b: any) => a.installmentNumber - b.installmentNumber);

          return {
            id: c.id,
            contractNumber: c.contractNumber,
            borrowerId: `direct-borrower-${c.id}`,
            borrowerName: c.borrowerName,
            investorId: c.investorId,
            investorName: investorName,
            inventoryItemId: `item-${c.id}`,
            inventoryItemName: c.itemName,
            itemCostPriceIQD: costPrice,
            totalSalePriceIQD: salePrice,
            profitMarginIQD: profit,
            downPaymentIQD: downPay,
            financedAmountIQD: financed,
            monthlyInstallmentIQD: Math.round(financed / c.monthsCount),
            monthsCount: c.monthsCount,
            startDate: c.startDate ? new Date(c.startDate).toISOString().split('T')[0] : '',
            endDate: c.startDate ? new Date(new Date(c.startDate).setMonth(new Date(c.startDate).getMonth() + c.monthsCount)).toISOString().split('T')[0] : '',
            schedules: schedules,
            status: isContractCompleted({ status: c.status, totalSalePriceIQD: salePrice, downPaymentIQD: downPay, schedules }) ? 'COMPLETED' : c.status
          };
        });

        // 12. Map Trash Items (سلة المهملات)
        if (dbTrashItems && dbTrashItems.length > 0) {
          newStore.trashItems = dbTrashItems.map((item: any) => ({
            id: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            title: item.title,
            subtitle: item.subtitle || '',
            category: item.category || 'عام',
            amountIQD: item.amountIQD ? parseFloat(item.amountIQD) : undefined,
            deletedAt: item.deletedAt ? new Date(item.deletedAt).toISOString() : new Date().toISOString(),
            deletedBy: item.deletedBy || 'مدير النظام',
            originalData: typeof item.originalData === 'string' ? JSON.parse(item.originalData || '{}') : (item.originalData || {}),
            notes: item.notes || undefined
          }));
        }

        // 13. Map Admin Security Passcode & Privacy Settings from DB
        const dbPasscode = json.data.adminPasscode || json.data.settings?.adminPasscode || '2026';
        newStore.adminPasscode = dbPasscode;
        setAdminPasscode(dbPasscode);

        const dbPrivacyPasscode = json.data.privacyPasscode || json.data.settings?.privacy_passcode || dbPasscode;
        newStore.privacyPasscode = dbPrivacyPasscode;

        const rawSec = json.data.privacyAutoHideSeconds !== undefined && json.data.privacyAutoHideSeconds !== null
          ? Number(json.data.privacyAutoHideSeconds)
          : (json.data.settings?.privacy_auto_hide_seconds !== undefined && json.data.settings?.privacy_auto_hide_seconds !== null
              ? Number(json.data.settings.privacy_auto_hide_seconds)
              : undefined);

        if (rawSec !== undefined && !isNaN(rawSec)) {
          newStore.privacyAutoHideSeconds = rawSec;
        }

        const dbResetEpoch = json.data.settings?.numbering_reset_epoch || null;
        newStore.numberingResetEpoch = dbResetEpoch;

        const dbCompanyProfile = {
          companyName: json.data.settings?.company_name || 'شركة أمان للتقسيط والاستثمار المالي',
          companyAddress: json.data.settings?.company_address || 'سامراء - حي الجامعة',
          companyPhone: json.data.settings?.company_phone || '07700000000',
          companyActivity: json.data.settings?.company_activity || 'تقسيط الأجهزة والمواد والمشاريع الاستثمارية',
          managerName: json.data.settings?.manager_name || 'أحمد إياد',
        };
        newStore.companyProfile = dbCompanyProfile;

        setStore(newStore);
      }
    } catch (err) {
      console.warn('Neon DB connection fallback to local state:', err);
    }
  };

  // Update Company Profile & Reports Header
  const handleSaveCompanyProfile = async (profileData: any): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyProfile: profileData,
          updatedBy: currentEmployee?.name || 'مدير النظام'
        })
      });
      const json = await res.json();
      if (json.success) {
        setStore((prevStore) => {
          const updated = new SimulationStore();
          Object.assign(updated, prevStore);
          updated.setCompanyProfile(json.companyProfile || profileData);
          return updated;
        });
        return { success: true, message: json.message || 'تم حفظ بيانات وهوية الشركة بنجاح' };
      }
      return { success: false, message: json.message || 'تعذر حفظ بيانات الشركة' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'حدث خطأ أثناء حفظ بيانات الشركة' };
    }
  };

  // Change Admin Passcode & Persist to Neon DB
  const handleChangeAdminPasscode = async (newPasscode: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'admin_passcode',
          value: newPasscode,
          updatedBy: currentEmployee?.name || 'مدير النظام'
        })
      });
      const json = await res.json();
      if (json.success) {
        setAdminPasscode(newPasscode);
        setStore((prevStore) => {
          const next = Object.assign(Object.create(SimulationStore.prototype), prevStore);
          next.adminPasscode = newPasscode;
          return next;
        });
        if (typeof window !== 'undefined') {
          try {
            const cache = JSON.parse(localStorage.getItem('aman_finance_live_cache') || '{}');
            cache.adminPasscode = newPasscode;
            localStorage.setItem('aman_finance_live_cache', JSON.stringify(cache));
          } catch {}
        }
        return { success: true, message: json.message || 'تم حفظ رمز المرور الجديد في قاعدة البيانات بنجاح' };
      } else {
        return { success: false, message: json.message || 'تعذر حفظ كلمة السر في قاعدة البيانات' };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'حدث خطأ أثناء الاتصال بالخادم لحفظ كلمة السر' };
    }
  };

  // Save Privacy Settings & Persist to Neon DB
  const handleSavePrivacySettings = async (newPasscode: string, newAutoHideSeconds: number): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyPasscode: newPasscode,
          autoHideSeconds: newAutoHideSeconds,
          updatedBy: currentEmployee?.name || 'مدير النظام'
        })
      });
      const json = await res.json();
      if (json.success) {
        setAdminPasscode(newPasscode);
        setStore((prevStore) => {
          const next = Object.assign(Object.create(SimulationStore.prototype), prevStore);
          next.privacyPasscode = newPasscode;
          next.adminPasscode = newPasscode;
          next.privacyAutoHideSeconds = newAutoHideSeconds;
          return next;
        });
        return { success: true, message: json.message || 'تم حفظ إعدادات الخصوصية بنجاح' };
      }
      return { success: false, message: json.message || 'تعذر حفظ إعدادات الخصوصية' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'حدث خطأ أثناء الاتصال بالخادم لحفظ إعدادات الخصوصية' };
    }
  };

  const handleResetSimulation = () => {
    setStore(new SimulationStore());
    fetchLiveData();
  };

  const handlePaySchedule = async (contractId: string, scheduleId: string, customPaidAmountIQD?: number, paidDate?: string) => {
    // 1. Optimistic Update immediately (0ms UI latency)
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    const localResult = newStore.payInstallmentSchedule(contractId, scheduleId, customPaidAmountIQD, paidDate);
    if (localResult.success) {
      setStore(newStore);
    }

    try {
      const res = await fetch('/api/installments/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, paidAmountIQD: customPaidAmountIQD, paidDate }),
      });
      const json = await res.json();
      if (json.success) {
        // Sync in background without blocking UI
        await fetchLiveData();
      } else {
        console.warn('Payment API returned error:', json.error);
      }
    } catch (err) {
      console.warn('API call fallback to state:', err);
    }
  };

  const handlePayDirectDebtSchedule = async (contractId: string, scheduleId: string, customPaidAmountIQD?: number, paidDate?: string) => {
    // 1. Optimistic Update immediately
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    const localResult = newStore.payDirectDebtSchedule(contractId, scheduleId, customPaidAmountIQD, paidDate);
    if (localResult.success) {
      setStore(newStore);
    }

    try {
      const res = await fetch('/api/direct-debts/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, paidAmountIQD: customPaidAmountIQD, paidDate }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
      } else {
        console.warn('Direct debt pay API error:', json.error);
      }
    } catch (err) {
      console.warn('API call fallback to state:', err);
    }
  };

  const handleAddDirectDebt = async (data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.addDirectDebt(data);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch('/api/direct-debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message };
      } else {
        return { success: false, message: json.error || 'تعذر تسجيل الدين المباشر بالسيستم' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleAddInvestor = async (data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.addInvestor(data);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch('/api/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message, investor: json.data?.investor };
      } else {
        return { success: false, message: json.error || 'تعذر إضافة المستثمر في قاعدة البيانات الحية' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleUpdateInvestor = async (data: any) => {
    // 1. Optimistic local update using latest SimulationStore.prototype (HMR-safe)
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    const localResult = SimulationStore.prototype.updateInvestor.call(newStore, data);
    if (localResult.success) {
      newStore.investors = newStore.investors.map((i) => ({
        ...i,
        contract: i.contract ? { ...i.contract } : i.contract,
      }));
      newStore.wallets = newStore.wallets.map((w) => ({ ...w }));
      newStore.contracts = newStore.contracts.map((c) => ({
        ...c,
        schedules: c.schedules.map((s) => ({ ...s })),
      }));
      setStore(newStore);
    }

    try {
      const res = await fetch('/api/investors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message, investor: json.data || localResult.investor };
      } else {
        return {
          success: localResult.success,
          message: json.error || localResult.message || 'تعذر تحديث البيانات في قاعدة البيانات الحية',
          investor: localResult.investor,
        };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleAddBorrower = async (data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.addBorrower(data);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch('/api/borrowers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message, borrower: json.data || localResult.borrower };
      } else {
        return { success: false, message: json.error || 'تعذر تسجيل الزبون في قاعدة البيانات', borrower: localResult.borrower };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleAddGuarantor = async (borrowerId: string, guarantor: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.addGuarantor(borrowerId, guarantor);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch('/api/borrowers/guarantor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowerId, guarantor }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message };
      } else {
        return { success: false, message: json.error || 'تعذر تسجيل الكفيل في قاعدة البيانات' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleDeleteBorrower = async (borrowerId: string) => {
    // 1. Optimistic local state update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;

    const localRes = newStore.deleteBorrower(borrowerId);
    if (!localRes.success) {
      return localRes;
    }

    newStore.borrowers = [...newStore.borrowers];
    newStore.contracts = [...newStore.contracts];
    newStore.inventory = [...newStore.inventory];
    newStore.wallets = newStore.wallets.map(w => ({ ...w }));
    newStore.investors = newStore.investors.map(inv => ({ ...inv }));
    newStore.trashItems = [...newStore.trashItems];
    newStore.transactions = [...newStore.transactions];
    setStore(newStore);

    // 2. Call backend DELETE API to persist in Neon DB and sync
    try {
      const res = await fetch('/api/borrowers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowerId }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message || localRes.message };
      } else {
        // If DB returned an error (e.g. paid installments constraint), revert state
        await fetchLiveData();
        return { success: false, message: json.error || 'تعذر إلغاء ملف الزبون في قاعدة البيانات' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localRes;
    }
  };

  const handleUpdateBorrower = async (borrowerId: string, data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localRes = newStore.updateBorrower(borrowerId, data);
    if (localRes.success) {
      newStore.borrowers = [...newStore.borrowers];
      newStore.contracts = [...newStore.contracts];
      setStore(newStore);
    }

    // 2. Call backend PUT API to persist in Neon DB
    try {
      const res = await fetch('/api/borrowers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: borrowerId, ...data }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message };
      } else {
        return { success: false, message: json.error || 'تعذر تعديل بيانات الزبون في قاعدة البيانات' };
      }
    } catch (err: any) {
      console.warn('API update borrower fallback to state:', err);
      return localRes;
    }
  };

  const handleDepositCapital = async (data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.depositCapital(data);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return {
          success: true,
          message: json.message,
          data: json.data,
          transaction: localResult.transaction,
          previousBalance: localResult.previousBalance,
          newBalance: localResult.newBalance,
          wallet: localResult.wallet,
          investorName: localResult.investorName
        };
      } else {
        return { success: false, message: json.error || 'تعذر إيداع رأس المال ماليّاً في قاعدة البيانات' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleWithdrawInvestor = async (data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.withdrawInvestorFunds(data);
    if (localResult.success) setStore(newStore);

    try {
      const targetInvestor = store.investors.find((i) => i.id === data.investorId);
      const targetWallet = store.wallets.find(
        (w) => w.id === targetInvestor?.walletId || w.ownerId === targetInvestor?.id
      );
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: targetWallet?.id || data.walletId,
          amountIQD: data.amountIQD,
          type: data.type,
          notes: data.notes,
          receiptNo: data.receiptNo,
          date: data.date,
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message };
      } else {
        return { success: false, message: json.error || 'تعذر سحب المبلغ من قاعدة البيانات' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleWithdrawCompanyFunds = async (data: {
    amountIQD: number;
    recipientName: string;
    type: 'PROFIT_WITHDRAWAL' | 'CAPITAL_WITHDRAWAL' | 'GENERAL_WITHDRAWAL';
    notes?: string;
    receiptNo?: string;
    date?: string;
  }) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    const localResult = newStore.withdrawCompanyFunds(data);
    if (localResult.success) setStore(newStore);

    try {
      const companyWalletId = store.companyWallet?.id || 'wallet-company';
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: companyWalletId,
          amountIQD: data.amountIQD,
          recipientName: data.recipientName,
          type: data.type,
          notes: data.notes,
          receiptNo: data.receiptNo,
          date: data.date,
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message || localResult.message };
      } else {
        return { success: false, message: json.error || 'تعذر سحب المبلغ من قاعدة البيانات' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handlePurchaseInventory = async (data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.purchaseInventory(data);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message };
      } else {
        await fetchLiveData();
        return { success: false, message: json.error || 'تعذر تسجيل عملية شراء البضائع بالسيستم' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleUpdateInventory = async (data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.updateInventory(data);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message };
      } else {
        return { success: false, message: json.error || 'تعذر تعديل المادة بالسيستم' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleDeleteInventory = async (itemId: string) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.deleteInventory(itemId);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch(`/api/inventory?id=${itemId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message };
      } else {
        return { success: false, message: json.error || 'تعذر حذف المادة بالسيستم' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleCreateContract = async (data: any) => {
    // 1. Optimistic local update
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.createContract(data);
    if (localResult.success) setStore(newStore);

    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message, contract: localResult.contract || json.data?.contract };
      } else {
        return { success: false, message: json.error || 'تعذر تسجيل عقد التقسيط بالسيستم', contract: localResult.contract };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleAddExpense = async (data: any) => {
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.addExpense(data);
    if (localResult.success) {
      newStore.expenses = [...newStore.expenses];
      newStore.transactions = [...newStore.transactions];
      newStore.wallets = newStore.wallets.map((w) => ({ ...w }));
      newStore.investors = newStore.investors.map((i) => ({ ...i }));
      setStore(newStore);
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLiveData();
        return { success: true, message: json.message };
      } else {
        return { success: false, message: json.error || 'تعذر تقييد المصروف بقاعدة البيانات' };
      }
    } catch (err: any) {
      console.warn('API call fallback to state:', err);
      return localResult;
    }
  };

  const handleEditExpense = (expenseId: string, data: any) => {
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let result = newStore.editExpense(expenseId, data);
    if (result.success) {
      newStore.expenses = [...newStore.expenses];
      newStore.transactions = [...newStore.transactions];
      newStore.wallets = newStore.wallets.map((w) => ({ ...w }));
      newStore.investors = newStore.investors.map((i) => ({ ...i }));
      setStore(newStore);
    }
    return result;
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const exp = store.expenses.find(e => e.id === expenseId);
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let result = newStore.deleteExpense(expenseId, currentEmployee.name);
    if (result.success) {
      newStore.expenses = [...newStore.expenses];
      newStore.transactions = [...newStore.transactions];
      newStore.wallets = newStore.wallets.map((w) => ({ ...w }));
      newStore.investors = newStore.investors.map((i) => ({ ...i }));
      newStore.trashItems = [...newStore.trashItems];
      setStore(newStore);

      if (exp) {
        try {
          await fetch('/api/trash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entityType: 'EXPENSE',
              entityId: exp.id,
              title: exp.title,
              subtitle: `سند صرف (${exp.referenceNo}) بقيمة ${formatNumber(exp.amountIQD)} د.ع`,
              category: 'المصروفات التشغيلية',
              amountIQD: exp.amountIQD,
              deletedBy: currentEmployee.name,
              originalData: exp
            })
          });
        } catch (e) {
          console.warn('Trash API sync error:', e);
        }
      }
    }
    return result;
  };

  const handleAddEmployee = (data: any) => {
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let result = newStore.addEmployee(data);
    if (result.success) {
      newStore.employees = [...newStore.employees];
      setStore(newStore);
    }
    return result;
  };

  const handleAddRevenue = async (data: any) => {
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.addRevenue(data);
    if (localResult.success) {
      newStore.revenues = [...newStore.revenues];
      newStore.transactions = [...newStore.transactions];
      newStore.wallets = newStore.wallets.map((w) => ({ ...w }));
      newStore.companyWallet = { ...newStore.companyWallet };
      setStore(newStore);
    }
    return localResult;
  };

  const handleDeleteRevenue = async (revenueId: string) => {
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let localResult = newStore.deleteRevenue(revenueId);
    if (localResult.success) {
      newStore.revenues = [...newStore.revenues];
      newStore.wallets = newStore.wallets.map((w) => ({ ...w }));
      newStore.companyWallet = { ...newStore.companyWallet };
      setStore(newStore);
    }
    return localResult;
  };

  const handleEditEmployee = (empId: string, data: any) => {
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let result = newStore.editEmployee(empId, data);
    if (result.success) {
      newStore.employees = [...newStore.employees];
      setStore(newStore);
    }
    return result;
  };

  const handleUpdateEmployeePermissions = async (empId: string, permissions: string[]) => {
    try {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_permissions', employeeId: empId, permissions }),
      });
    } catch (e) {
      console.warn('Server API error fallback:', e);
    }
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let result = newStore.updateEmployeePermissions(empId, permissions);
    if (result.success) {
      newStore.employees = [...newStore.employees];
      setStore(newStore);
    }
    return result;
  };

  const handleDeleteEmployee = async (empId: string) => {
    const emp = store.employees.find(e => e.id === empId);
    try {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', employeeId: empId }),
      });
    } catch (e) {
      console.warn('Server API error fallback:', e);
    }
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let result = newStore.deleteEmployee(empId, currentEmployee.name);
    if (result.success) {
      newStore.employees = [...newStore.employees];
      newStore.trashItems = [...newStore.trashItems];
      setStore(newStore);

      if (emp) {
        try {
          await fetch('/api/trash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entityType: 'EMPLOYEE',
              entityId: emp.id,
              title: emp.name,
              subtitle: `موظف (${emp.role}) - الراتب: ${formatNumber(emp.salaryIQD)} د.ع`,
              category: 'الموظفون والصلاحيات',
              amountIQD: emp.salaryIQD,
              deletedBy: currentEmployee.name,
              originalData: emp
            })
          });
        } catch (e) {
          console.warn('Trash API sync error:', e);
        }
      }
    }
    return result;
  };

  // Trash Actions: Restore, Permanent Delete, Empty Bin
  const handleRestoreTrashItem = async (trashId: string) => {
    try {
      const res = await fetch('/api/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashId }),
      });
      const json = await res.json().catch(() => ({}));
      const newStore = Object.assign(
        Object.create(SimulationStore.prototype),
        store
      ) as SimulationStore;
      const localRes = newStore.restoreFromTrash(trashId);
      if (localRes.success) {
        newStore.trashItems = [...newStore.trashItems];
        newStore.borrowers = [...newStore.borrowers];
        newStore.contracts = [...newStore.contracts];
        newStore.expenses = [...newStore.expenses];
        newStore.revenues = [...newStore.revenues];
        newStore.inventory = [...newStore.inventory];
        newStore.employees = [...newStore.employees];
        newStore.investors = [...newStore.investors];
        newStore.directDebts = [...newStore.directDebts];
        newStore.wallets = newStore.wallets.map(w => ({ ...w }));
        setStore(newStore);
      }
      return { success: true, message: json.message || localRes.message };
    } catch (e: any) {
      const newStore = Object.assign(
        Object.create(SimulationStore.prototype),
        store
      ) as SimulationStore;
      const localRes = newStore.restoreFromTrash(trashId);
      if (localRes.success) {
        newStore.trashItems = [...newStore.trashItems];
        newStore.borrowers = [...newStore.borrowers];
        newStore.contracts = [...newStore.contracts];
        newStore.expenses = [...newStore.expenses];
        newStore.revenues = [...newStore.revenues];
        newStore.inventory = [...newStore.inventory];
        newStore.employees = [...newStore.employees];
        newStore.investors = [...newStore.investors];
        newStore.directDebts = [...newStore.directDebts];
        newStore.wallets = newStore.wallets.map(w => ({ ...w }));
        setStore(newStore);
      }
      return localRes;
    }
  };

  const handlePermanentDeleteTrashItem = async (trashId: string) => {
    try {
      const res = await fetch('/api/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashId }),
      });
      const json = await res.json().catch(() => ({}));
      const newStore = Object.assign(
        Object.create(SimulationStore.prototype),
        store
      ) as SimulationStore;
      const localRes = newStore.permanentDeleteFromTrash(trashId);
      if (localRes.success) {
        newStore.trashItems = [...newStore.trashItems];
        setStore(newStore);
      }
      return { success: true, message: json.message || localRes.message };
    } catch (e: any) {
      const newStore = Object.assign(
        Object.create(SimulationStore.prototype),
        store
      ) as SimulationStore;
      const localRes = newStore.permanentDeleteFromTrash(trashId);
      if (localRes.success) {
        newStore.trashItems = [...newStore.trashItems];
        setStore(newStore);
      }
      return localRes;
    }
  };

  const handleEmptyTrash = async (entityType?: TrashEntityType) => {
    try {
      const res = await fetch('/api/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emptyAll: !entityType, entityType }),
      });
      const json = await res.json().catch(() => ({}));
      const newStore = Object.assign(
        Object.create(SimulationStore.prototype),
        store
      ) as SimulationStore;
      const localRes = newStore.emptyTrash(entityType);
      if (localRes.success) {
        newStore.trashItems = [...newStore.trashItems];
        setStore(newStore);
      }
      return { success: true, message: json.message || localRes.message, count: localRes.count };
    } catch (e: any) {
      const newStore = Object.assign(
        Object.create(SimulationStore.prototype),
        store
      ) as SimulationStore;
      const localRes = newStore.emptyTrash(entityType);
      if (localRes.success) {
        newStore.trashItems = [...newStore.trashItems];
        setStore(newStore);
      }
      return localRes;
    }
  };

  const handleApproveEmployee = async (empId: string) => {
    const emp = store.employees.find(e => e.id === empId);
    try {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', employeeId: empId, permissions: emp?.permissions }),
      });
    } catch (e) {
      console.warn('Server API error fallback:', e);
    }
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let result = newStore.approveEmployee(empId);
    if (result.success) {
      newStore.employees = [...newStore.employees];
      setStore(newStore);
    }
    return result;
  };

  const handleRejectEmployee = async (empId: string) => {
    try {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', employeeId: empId }),
      });
    } catch (e) {
      console.warn('Server API error fallback:', e);
    }
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    let result = newStore.rejectEmployee(empId);
    if (result.success) {
      newStore.employees = [...newStore.employees];
      setStore(newStore);
    }
    return result;
  };

  const handleRegisterEmployee = async (data: { uid?: string; name: string; role: any; email: string; phone: string }) => {
    try {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...data }),
      });
    } catch (e) {
      console.warn('Server API error fallback:', e);
    }
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;
    newStore.addEmployee({
      uid: data.uid,
      name: data.name,
      role: data.role,
      phone: data.phone,
      email: data.email,
      salaryIQD: 850000,
      status: 'بانتظار الموافقة',
      permissions: []
    });
    setStore(newStore);
  };

  const handleClearAllDemoData = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aman_finance_live_cache');
    }
    const newStore = Object.assign(
      Object.create(SimulationStore.prototype),
      store
    ) as SimulationStore;

    let result;
    if (typeof newStore.clearAllDemoData === 'function') {
      result = newStore.clearAllDemoData();
    } else {
      result = { success: false, message: 'تعذر تفريغ البيانات' };
    }

    if (result.success) {
      newStore.investors = [];
      newStore.wallets = [newStore.companyWallet];
      newStore.inventory = [];
      newStore.borrowers = [];
      newStore.contracts = [];
      newStore.directDebts = [];
      newStore.transactions = [];
      newStore.expenses = [];
      newStore.revenues = [];
      newStore.trashItems = [];
      newStore.employees = [...newStore.employees];
      setStore(newStore);
    }
    return result;
  };

  const handleResetDatabase = async () => {
    try {
      const res = await fetch('/api/database/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.success) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aman_finance_live_cache');
        }
        handleClearAllDemoData();
        await fetchLiveData();
        return {
          success: true,
          message: json.message || 'تم تصفير وإعادة تهيئة كافة جداول قاعدة البيانات المركزية بنجاح ونقطة بداية نظيفة (0 د.ع)',
        };
      } else {
        return {
          success: false,
          message: json.error || 'تعذر تصفير قاعدة البيانات المركزية في الخادم',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: 'فشل الاتصال بالخادم لتصفير قاعدة البيانات: ' + (err?.message || 'خطأ غير معروف'),
      };
    }
  };

  const handleResetNumberingCycle = async (passcode: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/settings/reset-numbering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPasscode: passcode }),
      });
      const json = await res.json();
      if (json.success) {
        const epoch = json.numberingResetEpoch || new Date().toISOString();
        setStore((prevStore) => {
          const next = Object.assign(Object.create(SimulationStore.prototype), prevStore);
          next.numberingResetEpoch = epoch;
          return next;
        });
        await fetchLiveData();
        return {
          success: true,
          message: json.message || 'تم تصفير دورة الترقيم بنجاح. ستبدأ العقود والفواتير والوصولات الجديدة من رقم (1)',
        };
      } else {
        return {
          success: false,
          message: json.message || 'تعذر تصفير دورة الترقيم في الخادم',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: 'فشل الاتصال بالخادم لتصفير دورة الترقيم: ' + (err?.message || 'خطأ غير معروف'),
      };
    }
  };


  // Auth Login Handler with Strict Approval Verification
  const handleAuthLoginSuccess = async (email: string, name?: string, uid?: string) => {
    const adminEmailEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();
    const matchedEmp = store.employees.find(
      (e) => (uid && (e.uid === uid || e.id === uid)) || e.email.toLowerCase().trim() === cleanEmail
    );
    const isSuperAdmin = (adminEmailEnv && cleanEmail === adminEmailEnv) || matchedEmp?.role === 'مدير النظام';

    if (matchedEmp && uid && !matchedEmp.uid) {
      matchedEmp.uid = uid;
    }

    if (!isSuperAdmin) {
      if (matchedEmp && matchedEmp.status === 'بانتظار الموافقة') {
        await logoutUser();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aman_auth_session');
        }
        setIsAuthenticated(false);
        setFirebaseUser(null);
        return {
          allowed: false,
          message: 'تم تسجيل الطلب بنجاح! حسابك قيد المراجعة وبانتظار موافقة مدير النظام (أحمد إياد) لتفعيل الدخول وتعيين الصلاحيات.'
        };
      }
      if (matchedEmp && matchedEmp.status === 'معطل') {
        await logoutUser();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aman_auth_session');
        }
        setIsAuthenticated(false);
        setFirebaseUser(null);
        return {
          allowed: false,
          message: 'هذا الحساب معطل حالياً من قِبل إدارة النظام.'
        };
      }
    }

    const assignedUid = uid || (matchedEmp ? matchedEmp.id : (isSuperAdmin ? 'emp-1' : 'emp-2'));
    const assignedName = name || (matchedEmp ? matchedEmp.name : (isSuperAdmin ? 'أحمد إياد' : cleanEmail.split('@')[0]));
    const assignedRole = isSuperAdmin ? 'مدير النظام' : (matchedEmp ? matchedEmp.role : 'محاسب مالي');

    if (typeof window !== 'undefined') {
      localStorage.setItem('aman_auth_session', JSON.stringify({
        email: cleanEmail,
        uid: assignedUid,
        name: assignedName,
        role: assignedRole,
      }));
    }

    setFirebaseUser({
      uid: assignedUid,
      email: cleanEmail,
      displayName: assignedName,
    } as any);

    setIsAuthenticated(true);
    setCurrentEmployeeId(assignedUid);
    return { allowed: true, message: 'تم تسجيل الدخول بنجاح' };
  };


  // Auth Sign Out Handler
  const handleSignOut = async () => {
    await logoutUser();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aman_auth_session');
    }
    setIsAuthenticated(false);
    setFirebaseUser(null);
  };

  const totalInvestorsCapital = store.investors.reduce(
    (sum, inv) => sum + inv.totalCapitalDeposited,
    0
  );

  const overdueCount = useMemo(() => {
    let count = 0;
    store.contracts.forEach((contract) => {
      contract.schedules.forEach((schedule) => {
        if (schedule.status !== 'PAID') {
          const due = calculateInstallmentDueStatus(schedule.dueDate, false);
          if (due.status === 'OVERDUE') count++;
        }
      });
    });
    return count;
  }, [store.contracts]);

  // Active Tab Permission check
  const activeTabConfig = TAB_PERMISSION_MAP[activeTab];
  const isCurrentTabAllowed = !activeTabConfig?.perm
    ? true
    : Array.isArray(activeTabConfig.perm)
      ? activeTabConfig.perm.some((p: string) => hasPermission(p))
      : hasPermission(activeTabConfig.perm);
  const adminEmployee = store.employees.find(e => e.role === 'مدير النظام') || store.employees[0];

  // 1. HYDRATION GUARD: Render clean deterministic loading screen until mounted in client browser
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium font-sans">جاري تشغيل نظام أمان للتقسيط...</p>
        </div>
      </div>
    );
  }

  // 2. AUTH GUARD: If not authenticated via Firebase Auth, render full screen AuthView login
  if (!isAuthenticated) {
    return (
      <AuthView
        onLoginSuccess={handleAuthLoginSuccess}
        onRegisterEmployee={handleRegisterEmployee}
        employees={store.employees}
      />
    );
  }

  return (
    <CurrencyProvider>
      <PrivacyProvider
        initialPasscode={adminPasscode}
        initialAutoHideSeconds={typeof store.privacyAutoHideSeconds === 'number' ? store.privacyAutoHideSeconds : 30}
        onSaveSettingsToBackend={handleSavePrivacySettings}
      >
      <div className="min-h-screen bg-slate-950 print:bg-white print:text-black text-slate-100 flex font-sans antialiased selection:bg-[#1783C1] selection:text-white">
      {/* Sidebar Navigation with permission checks */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentEmployee={currentEmployee}
        hasPermission={hasPermission}
        trashCount={store.trashItems ? store.trashItems.length : 0}
        overdueCount={overdueCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          companyBalance={store.companyWallet.balance}
          totalInvestorsCapital={totalInvestorsCapital}
          onResetSimulation={handleResetSimulation}
          currentEmployee={currentEmployee}
          onSignOut={handleSignOut}
          onOpenWelcomeBanner={handleOpenWelcomeBanner}
        />

        <main className="flex-1 p-8 print:p-0 overflow-y-auto">
          {/* If the current employee does NOT have permission for this tab, show Access Denied Screen */}
          {!isCurrentTabAllowed ? (
            <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 shadow-2xl text-center space-y-6 max-w-2xl mx-auto my-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
                <Lock className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20">
                  تنبيه: وصول محظور (Access Denied)
                </span>
                <h1 className="text-2xl font-bold text-white">لا تملك صلاحية الوصول إلى: {activeTabConfig.title}</h1>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  الحساب الحالي المسجل باسم <strong className="text-white">{currentEmployee.name}</strong> ({currentEmployee.role}) لا يمتلك الصلاحية المطلوبة <code className="text-purple-400 font-mono">[{activeTabConfig.perm}]</code> لاستعراض هذه الشاشة.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                <p className="font-bold text-slate-300">ملاحظة الأمن والسلامة:</p>
                <p>إذا كنت بحاجة إلى صلاحيات إضافية، يرجى التواصل مع المدير العام لتفويض الحساب بهذه الصلاحية.</p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
                >
                  العودة للوحة التحكم
                </button>

                <button
                  onClick={handleSignOut}
                  className="px-5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition-all"
                >
                  تسجيل الخروج
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  store={store}
                  onPaySchedule={handlePaySchedule}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'investors' && (
                <InvestorsView
                  store={store}
                  onAddInvestor={handleAddInvestor}
                  onUpdateInvestor={handleUpdateInvestor}
                  onWithdrawInvestor={handleWithdrawInvestor}
                />
              )}

              {activeTab === 'referrals' && (
                <ReferralsView
                  store={store}
                  onAddInvestor={handleAddInvestor}
                  onUpdateInvestor={handleUpdateInvestor}
                  onWithdrawInvestor={handleWithdrawInvestor}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'borrowers' && (
                <BorrowersView
                  store={store}
                  onPaySchedule={handlePaySchedule}
                  onAddBorrower={handleAddBorrower}
                  onAddGuarantor={handleAddGuarantor}
                  onUpdateBorrower={handleUpdateBorrower}
                  onCreateContract={handleCreateContract}
                  onDeleteBorrower={handleDeleteBorrower}
                  adminPasscode={adminPasscode}
                />
              )}

              {activeTab === 'overdue' && (
                <OverdueView
                  store={store}
                  onPaySchedule={handlePaySchedule}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'credit_score' && (
                <CreditScoreView
                  store={store}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'company_fund' && (
                <CompanyFundView
                  store={store}
                  onWithdrawCompany={handleWithdrawCompanyFunds}
                  onDepositCapital={handleDepositCapital}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'funds' && (
                <FundsView
                  store={store}
                  onDepositCapital={handleDepositCapital}
                  onWithdrawCompany={handleWithdrawCompanyFunds}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryView
                  store={store}
                  onPurchaseInventory={handlePurchaseInventory}
                  onUpdateInventory={handleUpdateInventory}
                  onDeleteInventory={handleDeleteInventory}
                />
              )}

              {activeTab === 'invoices' && (
                <InvoicesView
                  store={store}
                  onCreateContract={handleCreateContract}
                  onPaySchedule={handlePaySchedule}
                />
              )}

              {activeTab === 'expenses' && (
                <ExpensesView
                  store={store}
                  onAddExpense={handleAddExpense}
                  onEditExpense={handleEditExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {activeTab === 'revenues' && (
                <RevenuesView
                  store={store}
                  onAddRevenue={handleAddRevenue}
                  onDeleteRevenue={handleDeleteRevenue}
                />
              )}

              {activeTab === 'reports' && <ReportsView store={store} />}

              {activeTab === 'debt_ledger' && (
                !unlockedProtectedTabs['debt_ledger'] ? (
                  <ProtectedTabGate
                    tabKey="debt_ledger"
                    adminPasscode={adminPasscode}
                    onUnlock={(remember) => handleUnlockProtectedTab('debt_ledger', remember)}
                    onCancel={() => setActiveTab('dashboard')}
                  />
                ) : (
                  <DebtLedgerView
                    store={store}
                    onPaySchedule={handlePayDirectDebtSchedule}
                    onAddDirectDebt={handleAddDirectDebt}
                    onLock={() => handleLockProtectedTab('debt_ledger')}
                  />
                )
              )}

              {activeTab === 'employees' && (
                <EmployeesView
                  store={store}
                  onAddEmployee={handleAddEmployee}
                  onEditEmployee={handleEditEmployee}
                  onUpdatePermissions={handleUpdateEmployeePermissions}
                  onDeleteEmployee={handleDeleteEmployee}
                  onApproveEmployee={handleApproveEmployee}
                  onRejectEmployee={handleRejectEmployee}
                />
              )}


              {activeTab === 'trash' && (
                <TrashView
                  trashItems={store.trashItems || []}
                  onRestoreItem={handleRestoreTrashItem}
                  onPermanentDeleteItem={handlePermanentDeleteTrashItem}
                  onEmptyTrash={handleEmptyTrash}
                  adminPasscode={adminPasscode}
                />
              )}

              {activeTab === 'settings' && (
                !unlockedProtectedTabs['settings'] ? (
                  <ProtectedTabGate
                    tabKey="settings"
                    adminPasscode={adminPasscode}
                    onUnlock={(remember) => handleUnlockProtectedTab('settings', remember)}
                    onCancel={() => setActiveTab('dashboard')}
                  />
                ) : (
                  <SettingsView
                    adminPasscode={adminPasscode}
                    onChangeAdminPasscode={handleChangeAdminPasscode}
                    onClearDemoData={handleClearAllDemoData}
                    onResetDatabase={handleResetDatabase}
                    numberingResetEpoch={store.numberingResetEpoch}
                    onResetNumbering={handleResetNumberingCycle}
                    onLock={() => handleLockProtectedTab('settings')}
                    companyProfile={store.companyProfile}
                    onSaveCompanyProfile={handleSaveCompanyProfile}
                  />
                )
              )}


              {activeTab === 'profile' && (
                <ProfileView
                  currentEmployee={currentEmployee}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
      <ItemPrivacyPasscodeModal />
      <WelcomeBanner3D
        isOpen={isWelcomeBannerOpen}
        onClose={handleCloseWelcomeBanner}
        userName={currentEmployee ? currentEmployee.name : 'مدير النظام'}
      />
    </PrivacyProvider>
  </CurrencyProvider>
  );
}
