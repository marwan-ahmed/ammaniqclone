'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  PieChart,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Calendar,
  DollarSign,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  SlidersHorizontal,
  Layers,
  Building,
  Briefcase,
  ShieldAlert,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Percent,
  Coins,
  Receipt,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { SimulationStore } from '@/services/simulation';
import { LedgerTransaction, ExpenseItem, RevenueItem, Investor, InstallmentContract } from '@/types/finance';
import { formatNumber, formatDate, formatDateTime } from '@/utils/formatters';
import { PrivacyToggleButton } from '@/components/common/PrivacyToggleButton';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';
import { getCapitalInvestors } from '@/utils/investorSelectors';
import { getContractNumber } from '@/components/common/ContractDocumentHubModal';
import { DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';

interface ReportsViewProps {
  store: SimulationStore;
}

type TabType = 'pnl' | 'investors' | 'installments' | 'transactions' | 'general_withdrawals';
type DateRangeType = 'all' | 'today' | 'month' | 'quarter' | 'year' | 'custom';
type SortByType = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export const ReportsView: React.FC<ReportsViewProps> = ({ store }) => {
  const profile = store.companyProfile || DEFAULT_COMPANY_REPORT_PROFILE;
  const capitalInvestors = useMemo(() => getCapitalInvestors(store.investors), [store.investors]);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('pnl');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeType>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTxType, setSelectedTxType] = useState<string>('ALL');
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>('ALL');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortByType>('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [generalWithdrawalsViewMode, setGeneralWithdrawalsViewMode] = useState<'grouped' | 'table'>('grouped');

  // Helper: Check if date falls within filter
  const isDateInFilter = (dateStr: string) => {
    if (!dateStr || dateRange === 'all') return true;
    const itemDate = new Date(dateStr);
    const now = new Date();

    if (isNaN(itemDate.getTime())) return true;

    if (dateRange === 'today') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (dateRange === 'month') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    if (dateRange === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const itemQuarter = Math.floor(itemDate.getMonth() / 3);
      return currentQuarter === itemQuarter && itemDate.getFullYear() === now.getFullYear();
    }
    if (dateRange === 'year') {
      return itemDate.getFullYear() === now.getFullYear();
    }
    if (dateRange === 'custom') {
      if (customStartDate && new Date(dateStr) < new Date(customStartDate)) return false;
      if (customEndDate && new Date(dateStr) > new Date(customEndDate + 'T23:59:59')) return false;
      return true;
    }
    return true;
  };

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    let txs = store.transactions || [];

    // Date Filter
    txs = txs.filter(t => isDateInFilter(t.date));

    // Type Filter
    if (selectedTxType !== 'ALL') {
      txs = txs.filter(t => t.type === selectedTxType);
    }

    // Investor Filter
    if (selectedInvestorId !== 'ALL') {
      txs = txs.filter(t => t.investorId === selectedInvestorId || t.fromWalletId.includes(selectedInvestorId) || t.toWalletId.includes(selectedInvestorId));
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      txs = txs.filter(t =>
        t.referenceNo.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.investorName && t.investorName.toLowerCase().includes(q)) ||
        (t.borrowerName && t.borrowerName.toLowerCase().includes(q)) ||
        t.fromWalletName.toLowerCase().includes(q) ||
        t.toWalletName.toLowerCase().includes(q)
      );
    }

    // Sort
    return [...txs].sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount_desc') return b.amountIQD - a.amountIQD;
      if (sortBy === 'amount_asc') return a.amountIQD - b.amountIQD;
      return 0;
    });
  }, [store.transactions, dateRange, customStartDate, customEndDate, selectedTxType, selectedInvestorId, searchQuery, sortBy]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    let exps = store.expenses || [];

    exps = exps.filter(e => isDateInFilter(e.date));

    if (selectedExpenseCategory !== 'ALL') {
      exps = exps.filter(e => e.category === selectedExpenseCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      exps = exps.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.recipientName && e.recipientName.toLowerCase().includes(q)) ||
        (e.referenceNo && e.referenceNo.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    }

    return exps;
  }, [store.expenses, dateRange, customStartDate, customEndDate, selectedExpenseCategory, searchQuery]);

  // Filtered Revenues
  const filteredRevenues = useMemo(() => {
    let revs = store.revenues || [];
    revs = revs.filter(r => isDateInFilter(r.date));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      revs = revs.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }
    return revs;
  }, [store.revenues, dateRange, customStartDate, customEndDate, searchQuery]);

  // General Withdrawals and Outflows Statement (الرصيد السابق - المسحوب - المتبقي)
  const allGeneralWithdrawalRows = useMemo(() => {
    const rows: {
      id: string;
      investorId: string;
      investorName: string;
      previousBalance: number;
      withdrawnAmount: number;
      remainingBalance: number;
      date: string;
      description: string;
      notes: string;
      type: string;
      referenceNo: string;
      isPurchase: boolean;
      isProfitDist: boolean;
    }[] = [];

    capitalInvestors.forEach((inv) => {
      const invWallet = store.wallets.find((w) => w.id === inv.walletId || w.ownerId === inv.id);
      if (!invWallet) return;

      const investorTxs = (store.transactions || [])
        .filter(
          (tx) =>
            tx.fromWalletId === invWallet.id ||
            tx.toWalletId === invWallet.id ||
            tx.investorId === inv.id
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningBal = 0;
      for (const tx of investorTxs) {
        const isIncoming =
          tx.toWalletId === invWallet.id &&
          (tx.type === 'DEPOSIT' || tx.type === 'PAYMENT_RECEIVED' || tx.type === 'REVENUE');
        const isWithdrawal =
          tx.type === 'PURCHASE_INVENTORY' ||
          tx.type === 'PROFIT_DISTRIBUTION' ||
          tx.type === 'INVESTOR_WITHDRAWAL' ||
          tx.type === 'WITHDRAWAL' ||
          (tx.type === 'EXPENSE' && tx.fromWalletId === invWallet.id) ||
          tx.description?.includes('سحب') ||
          (tx.fromWalletId === invWallet.id && tx.toWalletId !== invWallet.id);

        if (isIncoming) {
          runningBal += tx.amountIQD;
        } else if (isWithdrawal) {
          const prevBal = runningBal;
          const amt = tx.amountIQD;
          const remBal = Math.max(0, prevBal - amt);
          runningBal = remBal;

          const isPurchase = tx.type === 'PURCHASE_INVENTORY';
          const isProfitDist = tx.type === 'PROFIT_DISTRIBUTION' || tx.description?.includes('أرباح');

          rows.push({
            id: tx.id,
            investorId: inv.id,
            investorName: inv.name,
            previousBalance: prevBal,
            withdrawnAmount: amt,
            remainingBalance: remBal,
            date: tx.date,
            description: tx.description || (isPurchase ? 'شراء مواد وبضائع بالمخزن' : 'سحب نقدي من الصندوق'),
            notes: tx.referenceNo ? `سند: ${tx.referenceNo}` : '—',
            type: tx.type,
            referenceNo: tx.referenceNo || '',
            isPurchase,
            isProfitDist
          });
        }
      }
    });

    // Filter by selected investor, date filter, and search query
    return rows
      .filter((r) => {
        if (selectedInvestorId !== 'ALL' && r.investorId !== selectedInvestorId) return false;
        if (!isDateInFilter(r.date)) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            r.investorName.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.notes.toLowerCase().includes(q) ||
            r.referenceNo.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === 'amount_desc') return b.withdrawnAmount - a.withdrawnAmount;
        if (sortBy === 'amount_asc') return a.withdrawnAmount - b.withdrawnAmount;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [capitalInvestors, store.wallets, store.transactions, selectedInvestorId, dateRange, customStartDate, customEndDate, searchQuery, sortBy]);

  // Grouped by Investor: Every investor has their own section/sub-table under each other
  const investorsGroupedWithdrawals = useMemo(() => {
    return capitalInvestors
      .map((inv) => {
        const invWallet = store.wallets.find((w) => w.id === inv.walletId || w.ownerId === inv.id);
        if (!invWallet) return null;

        const investorTxs = (store.transactions || [])
          .filter(
            (tx) =>
              tx.fromWalletId === invWallet.id ||
              tx.toWalletId === invWallet.id ||
              tx.investorId === inv.id
          )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningBal = 0;
        const rows: {
          id: string;
          investorName: string;
          previousBalance: number;
          withdrawnAmount: number;
          remainingBalance: number;
          date: string;
          description: string;
          notes: string;
          type: string;
          referenceNo: string;
          isPurchase: boolean;
          isProfitDist: boolean;
        }[] = [];

        for (const tx of investorTxs) {
          const isIncoming =
            tx.toWalletId === invWallet.id &&
            (tx.type === 'DEPOSIT' || tx.type === 'PAYMENT_RECEIVED' || tx.type === 'REVENUE');
          const isWithdrawal =
            tx.type === 'PURCHASE_INVENTORY' ||
            tx.type === 'PROFIT_DISTRIBUTION' ||
            tx.type === 'INVESTOR_WITHDRAWAL' ||
            tx.type === 'WITHDRAWAL' ||
            (tx.type === 'EXPENSE' && tx.fromWalletId === invWallet.id) ||
            tx.description?.includes('سحب') ||
            (tx.fromWalletId === invWallet.id && tx.toWalletId !== invWallet.id);

          if (isIncoming) {
            runningBal += tx.amountIQD;
          } else if (isWithdrawal) {
            const prevBal = runningBal;
            const amt = tx.amountIQD;
            const remBal = Math.max(0, prevBal - amt);
            runningBal = remBal;

            const isPurchase = tx.type === 'PURCHASE_INVENTORY';
            const isProfitDist = tx.type === 'PROFIT_DISTRIBUTION' || tx.description?.includes('أرباح');

            rows.push({
              id: tx.id,
              investorName: inv.name,
              previousBalance: prevBal,
              withdrawnAmount: amt,
              remainingBalance: remBal,
              date: tx.date,
              description: tx.description || (isPurchase ? 'شراء مواد وبضائع بالمخزن' : 'سحب نقدي من الصندوق'),
              notes: tx.referenceNo ? `سند: ${tx.referenceNo}` : '—',
              type: tx.type,
              referenceNo: tx.referenceNo || '',
              isPurchase,
              isProfitDist
            });
          }
        }

        const filteredRows = rows
          .filter((r) => {
            if (!isDateInFilter(r.date)) return false;
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase().trim();
              const match =
                r.investorName.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q) ||
                r.notes.toLowerCase().includes(q) ||
                r.referenceNo.toLowerCase().includes(q);
              if (!match) return false;
            }
            return true;
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const totalWithdrawn = filteredRows.reduce((s, r) => s + r.withdrawnAmount, 0);

        return {
          investor: inv,
          wallet: invWallet,
          rows: filteredRows,
          totalWithdrawn
        };
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;
        if (selectedInvestorId !== 'ALL' && item.investor.id !== selectedInvestorId) return false;
        return true;
      });
  }, [capitalInvestors, store.wallets, store.transactions, selectedInvestorId, dateRange, customStartDate, customEndDate, searchQuery]);

  // Financial Metrics Calculations
  const metrics = useMemo(() => {
    const totalInvestorsCapital = capitalInvestors.reduce((sum, inv) => sum + inv.totalCapitalDeposited, 0);
    const totalActiveInvestments = capitalInvestors.reduce((sum, inv) => sum + inv.activeInvestmentsAmount, 0);
    const totalAvailableLiquidity = store.wallets.reduce((sum, w) => sum + w.balance, 0);
    const totalInvestorProfits = capitalInvestors.reduce((sum, inv) => sum + inv.totalProfitsEarned, 0);
    const companyBalance = store.companyWallet.balance;

    // Expenses Totals
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amountIQD, 0);

    // Direct Revenues Totals
    const totalDirectRevenues = filteredRevenues.reduce((sum, r) => sum + r.amountIQD, 0);

    // Profit Share from Schedules
    let totalCollectedInstallmentsAmount = 0;
    let totalCollectedCompanyProfit = 0;
    let totalCollectedInvestorProfit = 0;
    let totalCollectedReferralCommission = 0;
    let totalOverdueAmount = 0;
    let totalPendingAmount = 0;
    let overdueSchedulesCount = 0;
    let totalSchedulesCount = 0;

    store.contracts.forEach(contract => {
      contract.schedules.forEach(sched => {
        totalSchedulesCount++;
        if (sched.status === 'PAID' && isDateInFilter(sched.paidDate || sched.dueDate)) {
          totalCollectedInstallmentsAmount += sched.amountIQD;
          totalCollectedCompanyProfit += sched.companyProfitShareIQD || 0;
          totalCollectedInvestorProfit += sched.investorProfitShareIQD || 0;
          totalCollectedReferralCommission += sched.referrerProfitShareIQD || 0;
        } else if (sched.status === 'OVERDUE') {
          totalOverdueAmount += sched.amountIQD;
          overdueSchedulesCount++;
        } else if (sched.status === 'PENDING') {
          totalPendingAmount += sched.amountIQD;
        }
      });
    });

    const totalGrossRevenue = totalCollectedCompanyProfit + totalCollectedInvestorProfit + totalCollectedReferralCommission + totalDirectRevenues;
    const netProfitAfterExpenses = totalGrossRevenue - totalExpenses;
    const companyNetProfit = totalCollectedCompanyProfit + totalDirectRevenues - (totalExpenses * 0.5); // Allocate 50% ops to company
    const collectionEfficiency = totalSchedulesCount > 0
      ? Math.round(((totalSchedulesCount - overdueSchedulesCount) / totalSchedulesCount) * 100)
      : 100;

    // Inventory Assets (in-stock warehouse goods only)
    const totalInventoryValue = store.inventory
      .filter((item) => item.status !== 'FULLY_FINANCED' && (item.quantity ?? 0) > 0)
      .reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitCostIQD || 0)), 0);

    return {
      totalInvestorsCapital,
      totalActiveInvestments,
      totalAvailableLiquidity,
      totalInvestorProfits,
      companyBalance,
      totalExpenses,
      totalDirectRevenues,
      totalCollectedInstallmentsAmount,
      totalCollectedCompanyProfit,
      totalCollectedInvestorProfit,
      totalCollectedReferralCommission,
      totalGrossRevenue,
      netProfitAfterExpenses,
      companyNetProfit,
      totalOverdueAmount,
      totalPendingAmount,
      overdueSchedulesCount,
      totalSchedulesCount,
      collectionEfficiency,
      totalInventoryValue
    };
  }, [store, filteredExpenses, filteredRevenues, dateRange, customStartDate, customEndDate]);

  // Expenses Category Breakdown
  const expensesByCategory = useMemo(() => {
    const categoriesMap: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      categoriesMap[e.category] = (categoriesMap[e.category] || 0) + e.amountIQD;
    });
    return Object.entries(categoriesMap).map(([category, amount]) => ({
      category,
      amount,
      percentage: metrics.totalExpenses > 0 ? Math.round((amount / metrics.totalExpenses) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, metrics.totalExpenses]);

  // Export to CSV with UTF-8 BOM for proper Arabic text support in MS Excel
  const handleExportCSV = () => {
    let csvContent = '\uFEFF'; // UTF-8 BOM header

    if (activeTab === 'transactions') {
      csvContent += 'رقم المرجع,التاريخ,النوع,من صندوق,إلى صندوق,المبلغ (د.ع),المستثمر,الزبون,البيان\n';
      filteredTransactions.forEach(t => {
        const typeLabel = t.type === 'PAYMENT_RECEIVED' ? 'تحصيل قسط'
          : t.type === 'EXPENSE' ? 'مصروف تشغيلي'
          : t.type === 'REVENUE' ? 'إيراد مباشر'
          : t.type === 'PURCHASE_INVENTORY' ? 'شراء مخزون'
          : t.type === 'ISSUE_INSTALLMENT' ? 'اصدار عقد تقسيط'
          : t.type === 'DEPOSIT' ? 'إيداع رأس مال'
          : t.type === 'REFERRAL_COMMISSION' ? 'عمولة إحالة واستقطاب'
          : t.type === 'PROFIT_DISTRIBUTION' ? 'توزيع أرباح' : t.type;

        csvContent += `"${t.referenceNo}","${t.date}","${typeLabel}","${t.fromWalletName}","${t.toWalletName}","${t.amountIQD}","${t.investorName || '-'}","${t.borrowerName || '-'}","${t.description.replace(/"/g, '""')}"\n`;
      });
    } else if (activeTab === 'investors') {
      csvContent += 'المستثمر,رقم الهاتف,رأس المال المودع,الاستثمارات القائمة,السيولة المتاحة,حصة الربح %,الأرباح المحصلة (د.ع),العائد الاستثماري ROI %\n';
      capitalInvestors.forEach(inv => {
        const roi = inv.totalCapitalDeposited > 0 ? ((inv.totalProfitsEarned / inv.totalCapitalDeposited) * 100).toFixed(1) : '0';
        csvContent += `"${inv.name}","${inv.phone}","${inv.totalCapitalDeposited}","${inv.activeInvestmentsAmount}","${inv.availableLiquidity}","${inv.contract.investorSharePercent}%","${inv.totalProfitsEarned}","${roi}%"\n`;
      });
    } else if (activeTab === 'pnl') {
      csvContent += 'البند المالي,القيمة بالدينار العراقي (د.ع),الملاحظات والتفاصيل\n';
      csvContent += `"إجمالي الأرباح المحصلة من عقود التقسيط","${metrics.totalCollectedCompanyProfit + metrics.totalCollectedInvestorProfit + metrics.totalCollectedReferralCommission}","حصة المستثمرين والشركة والمحيلين"\n`;
      csvContent += `"إجمالي عمولات الإحالة والاستقطاب للمحيلين","${metrics.totalCollectedReferralCommission}","مستقطعة من حصة أرباح الشركة ومودعة للمحيلين"\n`;
      csvContent += `"إجمالي الإيرادات والرسوم الإدارية المباشرة","${metrics.totalDirectRevenues}","رسوم فتح ملفات واستعلام وعمولات"\n`;
      csvContent += `"إجمالي الإيرادات والأرباح الإجمالية","${metrics.totalGrossRevenue}","الربح الإجمالي الكلي"\n`;
      csvContent += `"إجمالي المصاريف التشغيلية والإدارية","${metrics.totalExpenses}","رواتب وإيجارات ونثريات وخدمات"\n`;
      csvContent += `"صافي الربح / الخسارة النهائي","${metrics.netProfitAfterExpenses}","بعد اقتطاع كافة المصاريف"\n`;
      csvContent += `"حصة أرباح المستثمرين الكلية","${metrics.totalInvestorProfits}","الموزعة على المحافظ"\n`;
      csvContent += `"صافي دخل وعمولات شركة أمان","${metrics.companyBalance}","في صندوق الشركة الرئيسي"\n`;
    } else {
      csvContent += 'رقم العقد,الزبون,المستثمر,المبلغ الممول,القسط الشهر,الأقساط المسددة,الأقساط المتأخرة,المبلغ المتأخر (د.ع),الحالة\n';
      store.contracts.forEach(c => {
        const paidCount = c.schedules.filter(s => s.status === 'PAID').length;
        const overdueCount = c.schedules.filter(s => s.status === 'OVERDUE').length;
        const overdueAmount = c.schedules.filter(s => s.status === 'OVERDUE').reduce((s, item) => s + item.amountIQD, 0);
        csvContent += `"${getContractNumber(c)}","${c.borrowerName}","${c.investorName}","${c.financedAmountIQD}","${c.monthlyInstallmentIQD}","${paidCount} / ${c.monthsCount}","${overdueCount}","${overdueAmount}","${c.status}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `التقرير_المالي_نظام_أمان_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to formatted Excel spreadsheet file
  const handleExportExcel = () => {
    let excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th { background-color: #0f172a; color: #ffffff; border: 1px solid #334155; padding: 10px; font-weight: bold; }
          td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .header-box { background-color: #1e293b; color: #ffffff; padding: 15px; text-align: center; border-radius: 8px; margin-bottom: 15px; }
          .stat-title { font-weight: bold; color: #0f172a; }
          .number { font-weight: bold; color: #047857; direction: ltr; text-align: left; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h2>نظام أمان للتقسيط - سامراء</h2>
          <h3>التقرير المالي والأرباح والخسائر الرسمي - ${formatDate(new Date())}</h3>
          <p>النطاق الزمني: ${dateRange === 'all' ? 'جميع الأوقات' : dateRange}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th colspan="2">ملخص المؤشرات المالية الرئيسية (د.ع)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td class="stat-title">إجمالي رأس مال المستثمرين:</td><td class="number">${formatNumber(metrics.totalInvestorsCapital)} د.ع</td></tr>
            <tr><td class="stat-title">إجمالي البضائع والقروض المستثمرة:</td><td class="number">${formatNumber(metrics.totalActiveInvestments)} د.ع</td></tr>
            <tr><td class="stat-title">إجمالي السيولة النقدية المتوفرة:</td><td class="number">${formatNumber(metrics.totalAvailableLiquidity)} د.ع</td></tr>
            <tr><td class="stat-title">إجمالي الأرباح والإيرادات الإجمالية:</td><td class="number">${formatNumber(metrics.totalGrossRevenue)} د.ع</td></tr>
            <tr><td class="stat-title">إجمالي عمولات الإحالة والاستقطاب للمحيلين:</td><td class="number">${formatNumber(metrics.totalCollectedReferralCommission)} د.ع</td></tr>
            <tr><td class="stat-title">إجمالي المصاريف التشغيلية:</td><td class="number">${formatNumber(metrics.totalExpenses)} د.ع</td></tr>
            <tr><td class="stat-title">صافي الأرباح بعد المصاريف:</td><td class="number">${formatNumber(metrics.netProfitAfterExpenses)} د.ع</td></tr>
            <tr><td class="stat-title">صافي أرباح صندوق شركة أمان:</td><td class="number">${formatNumber(metrics.companyBalance)} د.ع</td></tr>
            <tr><td class="stat-title">إجمالي أرباح المستثمرين الموزعة:</td><td class="number">${formatNumber(metrics.totalInvestorProfits)} د.ع</td></tr>
          </tbody>
        </table>

        <h3>تفاصيل الحركة المالية المفلترة</h3>
        <table>
          <thead>
            <tr>
              <th>رقم المرجع</th>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>من صندوق</th>
              <th>إلى صندوق</th>
              <th>المبلغ (د.ع)</th>
              <th>البيان</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredTransactions.forEach(t => {
      excelContent += `
        <tr>
          <td>${t.referenceNo}</td>
          <td>${t.date}</td>
          <td>${t.type}</td>
          <td>${t.fromWalletName}</td>
          <td>${t.toWalletName}</td>
          <td class="number">${formatNumber(t.amountIQD)} د.ع</td>
          <td>${t.description}</td>
        </tr>
      `;
    });

    excelContent += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `تقرير_أرباح_نظام_أمان_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setDateRange('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedTxType('ALL');
    setSelectedInvestorId('ALL');
    setSelectedExpenseCategory('ALL');
    setSortBy('date_desc');
  };

  // Official Grouped Multi-Investor Statement Print Method (A4 Portrait/Landscape with high-res styling)
  const handlePrintAllInvestorsReport = () => {
    const existingIframe = document.getElementById('print-all-investors-statement-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'print-all-investors-statement-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const currentDateFormatted = new Date().toLocaleString('ar-IQ-u-nu-latn', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalGrandWithdrawn = investorsGroupedWithdrawals.reduce((sum, g) => sum + g.totalWithdrawn, 0);

    // Build clean, unified table rows grouped by investor
    const rowsHtml = investorsGroupedWithdrawals
      .map((group, groupIdx) => {
        const inv = group.investor;
        const rows = group.rows;

        // Clean investor section row header
        const investorHeaderRow = `
          <tr class="investor-header-row">
            <td colspan="8" style="background-color: #f1f5f9; padding: 10px 12px; font-weight: bold; font-size: 13px; color: #0f172a; border-top: 2px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
              <span style="display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; background: #0f172a; color: #fff; border-radius: 50%; font-size: 11px; margin-left: 8px;">${groupIdx + 1}</span>
              <span>المستثمر: <strong>${inv.name}</strong></span>
              <span style="font-weight: normal; font-size: 11px; color: #64748b; margin-right: 15px;">(مجموع مسحوبات الفترة: <strong style="color: #b91c1c;">-${formatNumber(group.totalWithdrawn)} د.ع</strong>)</span>
            </td>
          </tr>
        `;

        if (rows.length === 0) {
          return (
            investorHeaderRow +
            `<tr><td colspan="8" style="text-align: center; padding: 10px; color: #94a3b8; font-size: 11px;">لا توجد حركات مسحوبات مسجلة خلال الفترة</td></tr>`
          );
        }

        const itemsRows = rows
          .map(
            (r, idx) => `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 8px 6px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
            <td style="padding: 8px 6px; font-weight: bold; color: #1e293b;">${r.investorName}</td>
            <td style="padding: 8px 6px; font-family: monospace; text-align: center; color: #475569; direction: ltr;">${formatNumber(r.previousBalance)} د.ع</td>
            <td style="padding: 8px 6px; font-family: monospace; font-weight: bold; text-align: center; color: #b91c1c; direction: ltr;">-${formatNumber(r.withdrawnAmount)} د.ع</td>
            <td style="padding: 8px 6px; font-family: monospace; font-weight: bold; text-align: center; color: #047857; direction: ltr;">${formatNumber(r.remainingBalance)} د.ع</td>
            <td style="padding: 8px 6px; font-family: monospace; direction: ltr; text-align: center; color: #475569;">${r.date}</td>
            <td style="padding: 8px 6px; color: #334155;">${r.description}</td>
            <td style="padding: 8px 6px; color: #64748b; font-size: 11px;">${r.notes}</td>
          </tr>
        `
          )
          .join('');

        return investorHeaderRow + itemsRows;
      })
      .join('');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف مسحوبات وحركات المستثمرين</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, 'Cairo', 'Amiri';
            background-color: #ffffff !important;
            color: #0f172a !important;
            margin: 0;
            padding: 0;
            font-size: 12px;
            direction: rtl;
          }
          .sheet-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
          }
          .header-box {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .company-title {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 4px 0;
          }
          .report-title {
            font-size: 14px;
            font-weight: bold;
            color: #334155;
            margin: 0 0 6px 0;
          }
          .report-meta {
            font-size: 11px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
          }
          table.clean-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          table.clean-table th {
            background-color: #1e293b;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
            padding: 8px 6px;
            text-align: right;
            border: 1px solid #1e293b;
          }
          table.clean-table td {
            border: 1px solid #e2e8f0;
          }
          .grand-total-box {
            margin-top: 14px;
            padding: 10px 14px;
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: bold;
          }
          .signature-box {
            display: flex;
            justify-content: space-between;
            margin-top: 35px;
            padding-top: 15px;
            border-top: 1px dashed #cbd5e1;
            page-break-inside: avoid;
          }
          .sig-item {
            width: 40%;
            text-align: center;
            font-size: 12px;
            color: #0f172a;
          }
          .sig-line {
            height: 35px;
            border-bottom: 1px dotted #94a3b8;
            margin: 10px 30px 5px 30px;
          }
        </style>
      </head>
      <body>
        <div class="sheet-container">
          <!-- Clean Header -->
          <div class="header-box">
            <h1 class="company-title">${profile.companyName}</h1>
            <h2 class="report-title">كشف حركات ومسحوبات المستثمرين</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${profile.companyAddress} | الهاتف المعتمد للإدارة: ${profile.companyPhone}</div>
            <div class="report-meta">
              <span>الفترة: <strong>${dateRange === 'all' ? 'جميع الأوقات' : dateRange === 'custom' ? `${customStartDate || 'البداية'} إلى ${customEndDate || 'اليوم'}` : dateRange}</strong></span>
              <span>عدد المستثمرين: <strong>${investorsGroupedWithdrawals.length}</strong></span>
              <span>تاريخ الطباعة: <strong>${currentDateFormatted}</strong></span>
            </div>
          </div>

          <!-- Clean Single Table with Grouped Investor Headers -->
          <table class="clean-table">
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">ت</th>
                <th style="width: 120px;">اسم المستثمر</th>
                <th style="width: 100px; text-align: center;">الرصيد السابق</th>
                <th style="width: 105px; text-align: center;">المبلغ المسحوب</th>
                <th style="width: 100px; text-align: center;">الرصيد المتبقي</th>
                <th style="width: 80px; text-align: center;">التاريخ</th>
                <th>البيان</th>
                <th style="width: 95px;">الملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Grand Total Box -->
          <div class="grand-total-box">
            <span>إجمالي المبالغ المسحوبة لكافة المستثمرين:</span>
            <span style="font-family: monospace; font-size: 14px; color: #b91c1c; direction: ltr;">
              -${formatNumber(totalGrandWithdrawn)} د.ع
            </span>
          </div>

          <!-- Simple Signatures Row -->
          <div class="signature-box">
            <div class="sig-item">
              <strong>توقيع المحاسب المالي</strong>
              <div class="sig-line"></div>
            </div>
            <div class="sig-item">
              <strong>اعتماد الإدارة العامة</strong>
              <div class="sig-line"></div>
              <span style="font-size: 11px; color: #64748b;">${profile.managerName || 'أحمد إياد'}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 400);
  };

  const hasActiveFilters = searchQuery !== '' || dateRange !== 'all' || selectedTxType !== 'ALL' || selectedInvestorId !== 'ALL' || selectedExpenseCategory !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Dynamic Print Styles for A4 Financial Statement */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
          .print-text-dark { color: #0f172a !important; }
          .print-text-muted { color: #475569 !important; }
          .print-table th { background: #1e293b !important; color: white !important; }
          .print-table td { border-bottom: 1px solid #e2e8f0 !important; color: black !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Main Header & Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl no-print">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">التقارير المالية والأرباح والخسائر</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                نظام دقيق 100%
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تقرير الحسابات الختامية، كشف أرباح المستثمرين، التحصيل المالي، وتحليل المصاريف والإيرادات
            </p>
          </div>
        </div>

        {/* Action Controls & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
          <PrivacyToggleButton />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-medium text-xs border transition-all ${
              showFilters || hasActiveFilters
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>التصفية والفرز</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all shadow-md active:scale-95"
            title="تصدير ملف CSV متوافق مع الاكسل للغة العربية"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير CSV</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
            title="تنزيل جدول بيانات مصمم بصيغة Excel"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all active:scale-95"
            title="طباعة التقرير أو التصدير بصيغة PDF"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>طباعة / PDF</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Panel */}
      {showFilters && (
        <div className="bg-slate-900/90 backdrop-blur-md p-5 rounded-3xl border border-slate-800 space-y-4 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200 no-print">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Filter className="w-4 h-4 text-emerald-400" />
              <span>فلاتر البحث والتصفية المتقدمة</span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                <span>إعادة ضبط الفلاتر</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">البحث العام بالكلمات:</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم مرجع، اسم، أو بيان..."
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute left-2.5 top-2.5 text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Date Range Selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">النطاق الزمني:</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeType)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="all">جميع الأوقات</option>
                <option value="today">اليوم</option>
                <option value="month">هذا الشهر</option>
                <option value="quarter">هذا الربع السنوي</option>
                <option value="year">هذه السنة 2026</option>
                <option value="custom">نطاق تاريخ مخصص...</option>
              </select>
            </div>

            {/* Transaction Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">نوع المعاملة المالية:</label>
              <select
                value={selectedTxType}
                onChange={(e) => setSelectedTxType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="ALL">جميع أنواع المعاملات</option>
                <option value="PAYMENT_RECEIVED">تحصيل أقساط (Payment Received)</option>
                <option value="EXPENSE">مصاريف تشغيلية (Expense)</option>
                <option value="REVENUE">إيرادات ورسوم رسمية (Revenue)</option>
                <option value="PROFIT_DISTRIBUTION">توزيع أرباح (Profit Distribution)</option>
                <option value="PURCHASE_INVENTORY">شراء بضائع ومخزون (Inventory)</option>
                <option value="DEPOSIT">إيداع رأس مال (Capital Deposit)</option>
                <option value="ISSUE_INSTALLMENT">إصدار عقد تقسيط (Installment Contract)</option>
              </select>
            </div>

            {/* Investor Selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">تصفية حسب المستثمر:</label>
              <select
                value={selectedInvestorId}
                onChange={(e) => setSelectedInvestorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="ALL">جميع المستثمرين والمحافظ</option>
                {capitalInvestors.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Date Controls if Custom selected */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">من تاريخ:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">إلى تاريخ:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>
            </div>
          )}

          {/* Additional Filter Row: Sort By & Category */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/60 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">فئة المصروف:</span>
              <select
                value={selectedExpenseCategory}
                onChange={(e) => setSelectedExpenseCategory(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
              >
                <option value="ALL">جميع الفئات</option>
                <option value="رواتب">رواتب ومكافآت</option>
                <option value="إيجارات">إيجارات ومقار</option>
                <option value="تسويق">تسويق وإعلان</option>
                <option value="مصاريف نقل ولوجستيك">لوجستيات ونقل</option>
                <option value="صيانة">صيانة وتشغيل</option>
                <option value="نثريات">نثريات وضيافة</option>
                <option value="أجهزة ومعدات">أجهزة ومعدات</option>
                <option value="رسوم حكومية وإدارية">رسوم إدارية وحكومية</option>
                <option value="أخرى">مصاريف أخرى</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400">ترتيب النتائج:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortByType)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
              >
                <option value="date_desc">التاريخ (الأحدث أولاً)</option>
                <option value="date_asc">التاريخ (الأقدم أولاً)</option>
                <option value="amount_desc">المبلغ (الأعلى أولاً)</option>
                <option value="amount_asc">المبلغ (الأدنى أولاً)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 no-print">
        {/* Card 1: Gross Revenues */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي الإيرادات</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-400">
            {formatNumber(metrics.totalGrossRevenue)} <span className="text-xs text-slate-400 font-normal">د.ع</span>
          </p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">أرباح أقساط + إيرادات</span>
          </p>
        </div>

        {/* Card 2: Operating Expenses */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>المصاريف التشغيلية</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-rose-400">
            {formatNumber(metrics.totalExpenses)} <span className="text-xs text-slate-400 font-normal">د.ع</span>
          </p>
          <p className="text-[11px] text-slate-400">
            {filteredExpenses.length} مصروف مسجل
          </p>
        </div>

        {/* Card 3: Net Profit */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>صافي أرباح التشغيل</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-xl font-black ${metrics.netProfitAfterExpenses >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            {formatNumber(metrics.netProfitAfterExpenses)} <span className="text-xs text-slate-400 font-normal">د.ع</span>
          </p>
          <p className="text-[11px] text-slate-400">
            بعد اقتطاع المصاريف
          </p>
        </div>

        {/* Card 4: Company Net Profits */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg hover:border-teal-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>صندوق شركة أمان</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-teal-400">
            {formatNumber(metrics.companyBalance)} <span className="text-xs text-slate-400 font-normal">د.ع</span>
          </p>
          <p className="text-[11px] text-slate-400">
            السيولة المحصلة للشركة
          </p>
        </div>

        {/* Card 5: Investors Profits */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>أرباح المستثمرين</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-amber-400">
            {formatNumber(metrics.totalInvestorProfits)} <span className="text-xs text-slate-400 font-normal">د.ع</span>
          </p>
          <p className="text-[11px] text-slate-400">
            موزعة على المحافظ {metrics.totalCollectedReferralCommission > 0 && `(تشمل +${formatNumber(metrics.totalCollectedReferralCommission)} د.ع عمولات إحالة)`}
          </p>
        </div>

        {/* Card 6: Collection Efficiency */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>نسبة التحصيل والالتزام</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-purple-400">
            {metrics.collectionEfficiency}%
          </p>
          <p className="text-[11px] text-slate-400">
            {metrics.overdueSchedulesCount} أقساط متأخرة
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 no-print">
        <button
          onClick={() => setActiveTab('pnl')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'pnl'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>قائمة الأرباح والخسائر الشاملة (P&L)</span>
        </button>

        <button
          onClick={() => setActiveTab('investors')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'investors'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>كشف أرباح ومحافظ المستثمرين ({capitalInvestors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('installments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'installments'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>الأقساط ومعدل التعثر والتحصيل</span>
        </button>

        <button
          onClick={() => setActiveTab('general_withdrawals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'general_withdrawals'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>كشف الحركات العامة والمسحوبات ({allGeneralWithdrawalRows.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'transactions'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>سجل حركات المعاملات ({filteredTransactions.length})</span>
        </button>
      </div>

      {/* Tab 1: P&L Statement */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Breakdown */}
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">إجمالي الإيرادات والأرباح المحصلة</h2>
                    <p className="text-[11px] text-slate-400">شاملة حصة المستثمرين والشركة والرسوم الإدارية</p>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  +{formatNumber(metrics.totalGrossRevenue)} د.ع
                </span>
              </div>

              <div className="space-y-3 pt-1 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">أرباح عقود التقسيط المحصلة (حصة المستثمرين)</p>
                    <p className="text-[11px] text-slate-400">تم توزيعها وحفظها في صناديق المستثمرين</p>
                  </div>
                  <span className="font-bold text-emerald-400 text-sm">+{formatNumber(metrics.totalCollectedInvestorProfit)} د.ع</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">أرباح وعمولات عقود التقسيط (حصة شركة أمان)</p>
                    <p className="text-[11px] text-slate-400">حصة الشركة بموجب نسب العقود</p>
                  </div>
                  <span className="font-bold text-teal-400 text-sm">+{formatNumber(metrics.totalCollectedCompanyProfit)} د.ع</span>
                </div>

                {metrics.totalCollectedReferralCommission > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-purple-500/30 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">عمولات الإحالة واستقطاب رؤوس الأموال للمحيلين</p>
                      <p className="text-[11px] text-purple-400">مستقطعة من حصة أرباح الشركة وموزعة للمحيلين</p>
                    </div>
                    <span className="font-bold text-purple-400 text-sm">+{formatNumber(metrics.totalCollectedReferralCommission)} د.ع</span>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">الرسوم الإدارية المباشرة ورسوم الفتح</p>
                    <p className="text-[11px] text-slate-400">رسوم الاستعلام والملفات المباشرة</p>
                  </div>
                  <span className="font-bold text-blue-400 text-sm">+{formatNumber(metrics.totalDirectRevenues)} د.ع</span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-emerald-300 font-bold">
                  <span>إجمالي الإيرادات التشغيلية الكلية:</span>
                  <span className="text-base">{formatNumber(metrics.totalGrossRevenue)} د.ع</span>
                </div>
              </div>
            </div>

            {/* Expenses Breakdown */}
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">تحليل المصاريف التشغيلية والإدارية</h2>
                    <p className="text-[11px] text-slate-400">مصنفة حسب القطاعات والأقسام</p>
                  </div>
                </div>
                <span className="text-xs font-black text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                  -{formatNumber(metrics.totalExpenses)} د.ع
                </span>
              </div>

              <div className="space-y-3 pt-1 text-xs">
                {expensesByCategory.length === 0 ? (
                  <p className="text-center text-slate-500 py-6">لا توجد مصاريف تشغيلية مسجلة في هذا النطاق</p>
                ) : (
                  expensesByCategory.map((cat, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{cat.category}</span>
                        <span className="font-bold text-rose-400">{formatNumber(cat.amount)} د.ع ({cat.percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${cat.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}

                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between text-rose-300 font-bold">
                  <span>إجمالي التكاليف والمصاريف:</span>
                  <span className="text-base">-{formatNumber(metrics.totalExpenses)} د.ع</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statement Summary Ribbon */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-right">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>النتيجة المالية النهائية والحساب الختامي</span>
              </h3>
              <p className="text-xs text-slate-400">
                صافي الدخل النهائي المتبقي للشركة والمستثمرين بعد سداد التكاليف التشغيلية
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center px-4 py-2 bg-slate-950 rounded-2xl border border-slate-800">
                <p className="text-[11px] text-slate-400">إجمالي الأرباح</p>
                <p className="font-black text-emerald-400 text-base">{formatNumber(metrics.totalGrossRevenue)} د.ع</p>
              </div>
              <div className="text-xl font-bold text-slate-600">-</div>
              <div className="text-center px-4 py-2 bg-slate-950 rounded-2xl border border-slate-800">
                <p className="text-[11px] text-slate-400">إجمالي المصاريف</p>
                <p className="font-black text-rose-400 text-base">{formatNumber(metrics.totalExpenses)} د.ع</p>
              </div>
              <div className="text-xl font-bold text-slate-600">=</div>
              <div className="text-center px-6 py-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                <p className="text-xs text-emerald-300 font-bold">صافي الفائض المالي</p>
                <p className="font-black text-emerald-400 text-xl">{formatNumber(metrics.netProfitAfterExpenses)} د.ع</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Investors Ledger */}
      {activeTab === 'investors' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white text-lg">كشف أرباح ومحافظ المستثمرين الشامل</h2>
              <p className="text-xs text-slate-400">تفاصيل المحافظ، رأس المال المودع، والسيولة والأرباح لكل مستثمر</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
              {capitalInvestors.length} مستثمرين مسجلين
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                  <th className="p-4">اسم المستثمر والمحفظة</th>
                  <th className="p-4">العقد والنسبة</th>
                  <th className="p-4">رأس المال المودع</th>
                  <th className="p-4">الاستثمارات القائمة</th>
                  <th className="p-4">السيولة المتاحة</th>
                  <th className="p-4">الأرباح المحصلة</th>
                  <th className="p-4">العائد على الاستثمار ROI</th>
                  <th className="p-4">الحالة والتحديث</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {capitalInvestors.map((inv) => {
                  const roi = inv.totalCapitalDeposited > 0
                    ? ((inv.totalProfitsEarned / inv.totalCapitalDeposited) * 100).toFixed(1)
                    : '0';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black">
                            {inv.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <PrivacyMaskedText id={`rep-inv-${inv.id}`} text={inv.name} as="p" className="text-white font-bold" />
                              {inv.isReferralPartner && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                                  شريك إحالة
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{inv.phone}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-bold text-[11px] border border-blue-500/20">
                          {inv.contract.investorSharePercent}% مستثمر / {inv.contract.companySharePercent}% شركة
                        </span>
                      </td>

                      <td className="p-4 font-bold text-slate-100">
                        {formatNumber(inv.totalCapitalDeposited)} د.ع
                      </td>

                      <td className="p-4 font-bold text-amber-400">
                        {formatNumber(inv.activeInvestmentsAmount)} د.ع
                      </td>

                      <td className="p-4 font-bold text-emerald-400">
                        {formatNumber(inv.availableLiquidity)} د.ع
                      </td>

                      <td className="p-4 font-black text-emerald-400">
                        <div>+{formatNumber(inv.totalProfitsEarned)} د.ع</div>
                        {(inv.totalReferralCommissionsEarned || 0) > 0 && (
                          <div className="text-[10px] text-purple-400 font-normal">
                            منها عمولات إحالة: +{formatNumber(inv.totalReferralCommissionsEarned || 0)} د.ع
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-black text-xs border border-emerald-500/20">
                          +{roi}%
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          نشط وسليم
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Installments & Collection Analysis */}
      {activeTab === 'installments' && (
        <div className="space-y-6">
          {/* Status Breakdown Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>الأقساط المسددة المكتملة</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400">
                {formatNumber(metrics.totalCollectedInstallmentsAmount)} <span className="text-xs font-normal text-slate-400">د.ع</span>
              </p>
              <p className="text-[11px] text-emerald-300">تم تحصيلها وإيداعها في الصناديق</p>
            </div>

            <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>الأقساط القادمة المستحقة</span>
                <Calendar className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-black text-blue-400">
                {formatNumber(metrics.totalPendingAmount)} <span className="text-xs font-normal text-slate-400">د.ع</span>
              </p>
              <p className="text-[11px] text-blue-300">أقساط سارية في انتظار موعد السداد</p>
            </div>

            <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>الأقساط المتأخرة (الخطر)</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-black text-rose-400">
                {formatNumber(metrics.totalOverdueAmount)} <span className="text-xs font-normal text-slate-400">د.ع</span>
              </p>
              <p className="text-[11px] text-rose-300">{metrics.overdueSchedulesCount} أقساط تجاوزت الاستحقاق</p>
            </div>
          </div>

          {/* Contracts Debt Table */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-white text-lg">جدول العقود ومتابعة التحصيل والتعثر</h2>
                <p className="text-xs text-slate-400">قائمة عقود التقسيط ونسب الإنجاز لكل زبون</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                {store.contracts.length} عقود تقسيط قائمة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                    <th className="p-4">رقم العقد والزبون</th>
                    <th className="p-4">المستثمر الممول</th>
                    <th className="p-4">المبلغ الممول</th>
                    <th className="p-4">القسط الشهر</th>
                    <th className="p-4">نسبة السداد</th>
                    <th className="p-4">الأقساط المتأخرة</th>
                    <th className="p-4">الحالة الرسمية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {store.contracts.map((c) => {
                    const paidCount = c.schedules.filter(s => s.status === 'PAID').length;
                    const overdueCount = c.schedules.filter(s => s.status === 'OVERDUE').length;
                    const overdueAmount = c.schedules.filter(s => s.status === 'OVERDUE').reduce((s, item) => s + item.amountIQD, 0);
                    const progressPercent = Math.round((paidCount / c.monthsCount) * 100);

                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-bold text-white">
                          <p className="font-bold text-emerald-400">عقد #{getContractNumber(c)}</p>
                          <PrivacyMaskedText id={`rep-borrower-${c.id}`} text={c.borrowerName} as="p" className="text-slate-300 font-semibold" />
                          <p className="text-[11px] text-slate-400">{c.inventoryItemName}</p>
                        </td>

                        <td className="p-4 font-semibold text-slate-300">
                          <PrivacyMaskedText id={`rep-c-investor-${c.id}`} text={c.investorName} as="span" className="font-semibold text-slate-300" />
                        </td>

                        <td className="p-4 font-bold text-white">
                          {formatNumber(c.financedAmountIQD)} د.ع
                        </td>

                        <td className="p-4 font-bold text-teal-400">
                          {formatNumber(c.monthlyInstallmentIQD)} د.ع
                        </td>

                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-white">{paidCount} من {c.monthsCount} أقساط</span>
                              <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                            </div>
                            <div className="w-28 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          {overdueCount > 0 ? (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 font-bold text-[11px] border border-rose-500/20 flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              {overdueCount} أقساط ({formatNumber(overdueAmount)} د.ع)
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">لا يوجد تأخير</span>
                          )}
                        </td>

                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                            c.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.status === 'DEFAULTED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {c.status === 'COMPLETED' ? 'مكتمل المسدد' : c.status === 'DEFAULTED' ? 'متعثر' : 'ساري ونشط'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Transactions Ledger Log */}
      {activeTab === 'transactions' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden space-y-4">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white text-lg">سجل المعاملات والحركات المالية التفصيلي</h2>
              <p className="text-xs text-slate-400">سجل محاسبي معتمد وفق معايير المحاسبة المزدوجة "كل دينار معروف الفاتورة والحساب"</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
              عرض {filteredTransactions.length} من {store.transactions.length} حركات
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                  <th className="p-4">رقم المرجع والتاريخ</th>
                  <th className="p-4">نوع الحركة المالية</th>
                  <th className="p-4">من الحساب / الصندوق</th>
                  <th className="p-4">إلى الحساب / الصندوق</th>
                  <th className="p-4">المبلغ الإجمالي</th>
                  <th className="p-4">حصة أرباح الشركة/المستثمر</th>
                  <th className="p-4">تفاصيل البيان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">
                      لا توجد حركات مالية تطابق فلاتر البحث الحالية
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isExpense = tx.type === 'EXPENSE';
                    const isPayment = tx.type === 'PAYMENT_RECEIVED';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <p className="font-mono font-bold text-emerald-400">{tx.referenceNo}</p>
                          <p className="text-[11px] text-slate-400">{tx.date}</p>
                        </td>

                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${
                            isPayment ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isExpense ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : tx.type === 'REVENUE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {tx.type === 'PAYMENT_RECEIVED' ? 'تحصيل قسط'
                              : tx.type === 'EXPENSE' ? 'مصروف تشغيلي'
                              : tx.type === 'REVENUE' ? 'إيراد مباشر'
                              : tx.type === 'PURCHASE_INVENTORY' ? 'شراء بضاعة'
                              : tx.type === 'ISSUE_INSTALLMENT' ? 'اصدار عقد'
                              : tx.type === 'DEPOSIT' ? 'إيداع رأس مال'
                              : tx.type}
                          </span>
                        </td>

                        <td className="p-4 font-medium text-slate-300">
                          {tx.fromWalletName}
                        </td>

                        <td className="p-4 font-medium text-slate-300">
                          {tx.toWalletName}
                        </td>

                        <td className="p-4 font-bold text-white text-sm">
                          <span className={isExpense ? 'text-rose-400' : 'text-emerald-400'}>
                            {isExpense ? '-' : '+'}{formatNumber(tx.amountIQD)} د.ع
                          </span>
                        </td>

                        <td className="p-4 text-[11px]">
                          {tx.companyProfitShareIQD || tx.investorProfitShareIQD ? (
                            <div className="space-y-0.5">
                              {tx.companyProfitShareIQD ? <p className="text-teal-400">الشركة: +{formatNumber(tx.companyProfitShareIQD)} د.ع</p> : null}
                              {tx.investorProfitShareIQD ? <p className="text-amber-400">المستثمر: +{formatNumber(tx.investorProfitShareIQD)} د.ع</p> : null}
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        <td className="p-4 text-slate-400 max-w-xs truncate" title={tx.description}>
                          {tx.description}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: General Withdrawals and Outflows Statement */}
      {activeTab === 'general_withdrawals' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl space-y-5 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-white text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-400" />
                  <span>كشف الحركات والمسحوبات العامة للمستثمرين</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {selectedInvestorId === 'ALL' ? `كافة المستثمرين (${store.investors.length})` : store.investors.find(i => i.id === selectedInvestorId)?.name || 'مستثمر محدد'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                كشف رسمي موحد (اسم المستثمر • الرصيد السابق • المبلغ المسحوب • الرصيد المتبقي • التاريخ • البيان • الملاحظات)
              </p>
            </div>

            {/* Quick Controls & Print Button */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Switcher: Grouped vs Flat Table */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <button
                  onClick={() => setGeneralWithdrawalsViewMode('grouped')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    generalWithdrawalsViewMode === 'grouped'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  قائمة مقسمة (مستثمر تحته مستثمر)
                </button>
                <button
                  onClick={() => setGeneralWithdrawalsViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    generalWithdrawalsViewMode === 'table'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  جدول متصل
                </button>
              </div>

              {/* Investor Selector */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">المستثمر:</span>
                <select
                  value={selectedInvestorId}
                  onChange={(e) => setSelectedInvestorId(e.target.value)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer"
                >
                  <option value="ALL">جميع المستثمرين ({store.investors.length})</option>
                  {store.investors.map((inv) => (
                    <option key={inv.id} value={inv.id} className="bg-slate-900 text-white">
                      {inv.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Official Grouped Print Button */}
              <button
                onClick={handlePrintAllInvestorsReport}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة كشف رسمي شامل بكافة المستثمرين</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">المستثمرون المشمولون:</span>
              <span className="font-bold text-white text-sm">
                {selectedInvestorId === 'ALL' ? `${store.investors.length} مستثمرين` : store.investors.find(i => i.id === selectedInvestorId)?.name}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30">
              <span className="text-amber-400 text-[11px] block font-semibold">إجمالي المبالغ المسحوبة:</span>
              <span className="font-mono font-black text-amber-400 text-sm">
                -{formatNumber(allGeneralWithdrawalRows.reduce((s, r) => s + r.withdrawnAmount, 0))} د.ع
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">عدد حركات السحب:</span>
              <span className="font-bold text-purple-400 text-sm">{allGeneralWithdrawalRows.length} حركة</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">النطاق الزمني:</span>
              <span className="font-bold text-emerald-400 text-xs">
                {dateRange === 'all' ? 'جميع الأوقات' : dateRange === 'custom' ? `${customStartDate || 'البداية'} إلى ${customEndDate || 'اليوم'}` : dateRange}
              </span>
            </div>
          </div>

          {/* Unified Clean Table with Grouped Dividers or Flat List */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 text-center w-10">ت</th>
                  <th className="py-3.5 px-4">اسم المستثمر</th>
                  <th className="py-3.5 px-4 text-center">الرصيد السابق</th>
                  <th className="py-3.5 px-4 text-center">المبلغ المسحوب</th>
                  <th className="py-3.5 px-4 text-center">الرصيد المتبقي</th>
                  <th className="py-3.5 px-4 text-center">التاريخ</th>
                  <th className="py-3.5 px-4">البيان</th>
                  <th className="py-3.5 px-4">الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {generalWithdrawalsViewMode === 'grouped' ? (
                  investorsGroupedWithdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                        لا توجد حركات مسحوبات أو قيود سحب مطابقة للفلاتر المحددة
                      </td>
                    </tr>
                  ) : (
                    investorsGroupedWithdrawals.map((group, gIdx) => {
                      const inv = group.investor;
                      const rows = group.rows;

                      return (
                        <React.Fragment key={inv.id}>
                          {/* Clean Investor Divider Row */}
                          <tr className="bg-slate-900/90 border-t-2 border-slate-700/80">
                            <td colSpan={8} className="py-3 px-4 text-xs font-bold text-white">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                                    {gIdx + 1}
                                  </span>
                                  <span className="text-amber-300 font-bold text-sm">المستثمر: {inv.name}</span>
                                  <span className="text-[11px] text-slate-400 mr-2 font-normal">({inv.phone || 'بدون هاتف'})</span>
                                </div>
                                <div className="text-xs text-slate-300">
                                  <span>مجموع مسحوبات الفترة: </span>
                                  <strong className="font-mono text-rose-400">-{formatNumber(group.totalWithdrawn)} د.ع</strong>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-4 text-center text-slate-500 text-[11px]">
                                لا توجد حركات مسحوبات مسجلة لهذا المستثمر خلال الفترة
                              </td>
                            </tr>
                          ) : (
                            rows.map((row, rIdx) => (
                              <tr key={row.id} className="hover:bg-slate-900/40 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-500 text-center">{rIdx + 1}</td>
                                <td className="py-3 px-4 font-bold text-white">{row.investorName}</td>
                                <td className="py-3 px-4 text-center font-mono text-slate-300">
                                  {formatNumber(row.previousBalance)} د.ع
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-mono text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 inline-block">
                                    -{formatNumber(row.withdrawnAmount)} د.ع
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-emerald-400 font-bold">
                                  {formatNumber(row.remainingBalance)} د.ع
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-slate-400">{row.date}</td>
                                <td className="py-3 px-4 text-slate-200">{row.description}</td>
                                <td className="py-3 px-4 text-slate-400 text-[11px]">{row.notes}</td>
                              </tr>
                            ))
                          )}
                        </React.Fragment>
                      );
                    })
                  )
                ) : (
                  allGeneralWithdrawalRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                        لا توجد حركات مسحوبات أو قيود سحب مطابقة للفلاتر المحددة
                      </td>
                    </tr>
                  ) : (
                    allGeneralWithdrawalRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-500 text-center">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-white">{row.investorName}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">
                          {formatNumber(row.previousBalance)} د.ع
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 inline-block">
                            -{formatNumber(row.withdrawnAmount)} د.ع
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-400 font-bold">
                          {formatNumber(row.remainingBalance)} د.ع
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{row.date}</td>
                        <td className="py-3 px-4 text-slate-200">{row.description}</td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">{row.notes}</td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Official A4 Print Document (Visible only when Printing) */}
      <div className="print-only print-container font-sans text-black">
        {/* Printable Formal Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{profile.companyName}</h1>
            <p className="text-xs text-slate-600">{profile.companyAddress} | الهاتف المعتمد للإدارة: {profile.companyPhone}</p>
            {profile.companyActivity && <p className="text-xs text-slate-600">{profile.companyActivity}</p>}
          </div>
          <div className="text-left border-r-2 border-slate-900 pr-4">
            <h2 className="text-lg font-bold text-slate-900">تقرير الأرباح والخسائر والمالية العامة</h2>
            <p className="text-xs text-slate-700">تاريخ الإصدار: {formatDate(new Date())}</p>
            <p className="text-xs text-slate-700">النطاق المطبق: {dateRange === 'all' ? 'جميع الأوقات' : dateRange}</p>
            <p className="text-xs text-slate-700">المصادقة: تقرير مالي رسمي معتمد</p>
          </div>
        </div>

        {activeTab === 'general_withdrawals' ? (
          <div className="mb-6">
            <h3 className="font-bold text-base mb-2 border-b border-slate-300 pb-1">
              كشف الحركات العامة والمسحوبات للمستثمرين ({selectedInvestorId === 'ALL' ? 'كافة المستثمرين' : store.investors.find(i => i.id === selectedInvestorId)?.name})
            </h3>
            <table className="w-full border-collapse border border-slate-400 text-xs print-table">
              <thead>
                <tr className="bg-slate-200 text-slate-900">
                  <th className="border border-slate-400 p-2 text-center">ت</th>
                  <th className="border border-slate-400 p-2 text-right">اسم المستثمر</th>
                  <th className="border border-slate-400 p-2 text-center">الرصيد السابق</th>
                  <th className="border border-slate-400 p-2 text-center">المبلغ المسحوب</th>
                  <th className="border border-slate-400 p-2 text-center">الرصيد المتبقي</th>
                  <th className="border border-slate-400 p-2 text-center">التاريخ</th>
                  <th className="border border-slate-400 p-2 text-right">البيان</th>
                  <th className="border border-slate-400 p-2 text-right">الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {allGeneralWithdrawalRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border border-slate-300 p-4 text-center text-slate-500">
                      لا توجد حركات مسحوبات مطابقة للفلاتر
                    </td>
                  </tr>
                ) : (
                  allGeneralWithdrawalRows.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="border border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{row.investorName}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{formatNumber(row.previousBalance)} د.ع</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-bold text-rose-700">-{formatNumber(row.withdrawnAmount)} د.ع</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-bold text-emerald-700">{formatNumber(row.remainingBalance)} د.ع</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{row.date}</td>
                      <td className="border border-slate-300 p-2">{row.description}</td>
                      <td className="border border-slate-300 p-2 text-slate-600">{row.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {/* Print Summary Table */}
            <div className="mb-6">
              <h3 className="font-bold text-base mb-2 border-b border-slate-300 pb-1">أولاً: الحسابات الختامية والمؤشرات الرئيسية (د.ع)</h3>
              <table className="w-full border-collapse border border-slate-400 text-xs print-table">
                <thead>
                  <tr className="bg-slate-200 text-slate-900">
                    <th className="border border-slate-400 p-2 text-right">المؤشر المالي</th>
                    <th className="border border-slate-400 p-2 text-right">القيمة بالدينار العراقي (د.ع)</th>
                    <th className="border border-slate-400 p-2 text-right">التفاصيل والأهمية</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">إجمالي رأس مال المستثمرين:</td>
                    <td className="border border-slate-300 p-2 font-bold">{formatNumber(metrics.totalInvestorsCapital)} د.ع</td>
                    <td className="border border-slate-300 p-2">رأس المال الكلي المودع في محافظ المستثمرين</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">إجمالي الإيرادات والأرباح التشغيلية:</td>
                    <td className="border border-slate-300 p-2 font-bold">{formatNumber(metrics.totalGrossRevenue)} د.ع</td>
                    <td className="border border-slate-300 p-2">أرباح عقود التقسيط + الإيرادات المباشرة</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">إجمالي المصاريف التشغيلية والإدارية:</td>
                    <td className="border border-slate-300 p-2 font-bold">-{formatNumber(metrics.totalExpenses)} د.ع</td>
                    <td className="border border-slate-300 p-2">الرواتب، الإيجارات، والنثريات التشغيلية</td>
                  </tr>
                  <tr className="bg-slate-100 font-bold">
                    <td className="border border-slate-400 p-2">صافي الربح / الفائض المالي النهائي:</td>
                    <td className="border border-slate-400 p-2 text-sm">{formatNumber(metrics.netProfitAfterExpenses)} د.ع</td>
                    <td className="border border-slate-400 p-2">صافي الأرباح الكلية المتبقية</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">صافي أرباح وعمولات شركة أمان:</td>
                    <td className="border border-slate-300 p-2 font-bold">{formatNumber(metrics.companyBalance)} د.ع</td>
                    <td className="border border-slate-300 p-2">المحفوظ في صندوق الشركة الرئيسي</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">إجمالي أرباح المستثمرين الكلية:</td>
                    <td className="border border-slate-300 p-2 font-bold">{formatNumber(metrics.totalInvestorProfits)} د.ع</td>
                    <td className="border border-slate-300 p-2">الموزعة على المحافظ حسب نسب العقود</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Print Investors Table */}
            <div className="mb-6">
              <h3 className="font-bold text-base mb-2 border-b border-slate-300 pb-1">ثانياً: موقف كشف أرباح المستثمرين</h3>
              <table className="w-full border-collapse border border-slate-400 text-xs print-table">
                <thead>
                  <tr className="bg-slate-200 text-slate-900">
                    <th className="border border-slate-400 p-2 text-right">المستثمر</th>
                    <th className="border border-slate-400 p-2 text-right">نسبة العقد</th>
                    <th className="border border-slate-400 p-2 text-right">رأس المال</th>
                    <th className="border border-slate-400 p-2 text-right">السيولة المتاحة</th>
                    <th className="border border-slate-400 p-2 text-right">الأرباح المحصلة</th>
                  </tr>
                </thead>
                <tbody>
                  {store.investors.map(inv => (
                    <tr key={inv.id}>
                      <td className="border border-slate-300 p-2 font-bold">{inv.name}</td>
                      <td className="border border-slate-300 p-2">{inv.contract.investorSharePercent}% مستثمر</td>
                      <td className="border border-slate-300 p-2 font-bold">{formatNumber(inv.totalCapitalDeposited)} د.ع</td>
                      <td className="border border-slate-300 p-2 font-bold">{formatNumber(inv.availableLiquidity)} د.ع</td>
                      <td className="border border-slate-300 p-2 font-bold">+{formatNumber(inv.totalProfitsEarned)} د.ع</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Official Signatures Block */}
        <div className="mt-12 pt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <p className="font-bold">المحاسب المالي</p>
            <p className="text-slate-600 mt-6">التوقيع: .....................</p>
          </div>
          <div>
            <p className="font-bold">مدير قسم التدقيق والرقابة</p>
            <p className="text-slate-600 mt-6">التوقيع: .....................</p>
          </div>
          <div>
            <p className="font-bold">المدير العام ({profile.managerName || 'أحمد إياد'})</p>
            <p className="text-slate-600 mt-6">الختم والتوقيع: .....................</p>
          </div>
        </div>
      </div>
    </div>
  );
};
