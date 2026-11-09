'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  Building2,
  Calendar,
  Filter,
  Printer,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Boxes,
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileText,
  RotateCcw,
  ListFilter,
  Table as TableIcon,
  Users,
  Coins,
  Download,
  Share2,
  Award
} from 'lucide-react';
import { Wallet as WalletType, Investor, LedgerTransaction } from '@/types/finance';
import { DepositReceiptModal, DepositReceiptData } from '@/components/common/DepositReceiptModal';
import { CompanyReportProfile, DEFAULT_COMPANY_REPORT_PROFILE } from '@/utils/printReportHeader';

export const formatIQD = (amount: number | string): string => {
  if (amount === undefined || amount === null || amount === '') return '0';
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : amount;
  if (isNaN(num)) return '0';
  const parts = Math.round(num).toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.join('.');
};

interface InvestorStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet?: WalletType | null;
  investor?: Investor | null;
  allTransactions: LedgerTransaction[];
  investorsList?: Investor[];
  walletsList?: WalletType[];
  companyProfile?: CompanyReportProfile;
  store?: any;
}

type StatementViewMode = 'GENERAL_WITHDRAWALS' | 'DETAILED_LEDGER' | 'REFERRAL_COMMISSIONS';
type TxFilterType = 'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE_INVENTORY' | 'PAYMENT_RECEIVED' | 'REFERRAL_COMMISSION' | 'EXPENSE';

export const InvestorStatementModal: React.FC<InvestorStatementModalProps> = ({
  isOpen,
  onClose,
  wallet,
  investor,
  allTransactions,
  investorsList = [],
  walletsList = [],
  companyProfile,
  store
}) => {
  const profile: CompanyReportProfile = useMemo(() => {
    if (companyProfile) return companyProfile;
    if (store?.companyProfile) return store.companyProfile;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('aman_finance_live_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.companyProfile) return parsed.companyProfile;
        }
      } catch {}
    }
    return DEFAULT_COMPANY_REPORT_PROFILE;
  }, [companyProfile, store?.companyProfile]);

  // Current date helpers for defaults
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  // Multi-Investor Selection State
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>(investor?.id || 'ALL');

  useEffect(() => {
    if (investor?.id) {
      setSelectedInvestorId(investor.id);
    } else {
      setSelectedInvestorId('ALL');
    }
  }, [investor]);

  // Statement Mode: Default to General Withdrawals statement with (الرصيد السابق - المسحوب - المتبقي)
  const [statementViewMode, setStatementViewMode] = useState<StatementViewMode>('GENERAL_WITHDRAWALS');

  // Date Range States
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [txTypeFilter, setTxTypeFilter] = useState<TxFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Deposit Receipt Modal State for Re-printing from Statement
  const [viewingDepositReceipt, setViewingDepositReceipt] = useState<DepositReceiptData | null>(null);

  const handleOpenDepositReceipt = (tx: LedgerTransaction) => {
    const targetWallet = walletsList.find((w) => w.id === tx.toWalletId) || effectiveWallet;
    const inv = investorsList.find((i) => i.id === tx.investorId || i.walletId === tx.toWalletId) || effectiveInvestor;

    const receiptData: DepositReceiptData = {
      referenceNo: tx.referenceNo || `DEP-${tx.date.replace(/-/g, '')}-${tx.id.slice(-4)}`,
      date: tx.date,
      time: '12:00:00 م',
      walletId: tx.toWalletId,
      walletName: tx.toWalletName || targetWallet?.ownerName || ownerName,
      ownerType: targetWallet?.ownerType || 'INVESTOR',
      investorName: inv?.name || tx.investorName || ownerName,
      depositorName: inv?.name || tx.investorName || (targetWallet?.ownerType === 'INVESTOR' ? targetWallet?.ownerName : 'إدارة شركة أمان (تغذية رأس المال)'),
      amountIQD: tx.amountIQD,
      notes: tx.description,
      paymentMethod: 'نقداً (صندوق كاش)',
      recordedBy: 'قسم الحسابات والمالية'
    };
    setViewingDepositReceipt(receiptData);
  };

  // Resolved Current Target (Single vs All)
  const isAllInvestors = selectedInvestorId === 'ALL';
  const effectiveInvestor = useMemo(() => {
    if (isAllInvestors) return null;
    return investorsList.find((i) => i.id === selectedInvestorId) || investor || null;
  }, [isAllInvestors, selectedInvestorId, investorsList, investor]);

  const effectiveWallet = useMemo(() => {
    if (isAllInvestors) return null;
    if (effectiveInvestor) {
      return (
        walletsList.find((w) => w.id === effectiveInvestor.walletId || w.ownerId === effectiveInvestor.id) ||
        wallet ||
        null
      );
    }
    return wallet || null;
  }, [isAllInvestors, effectiveInvestor, walletsList, wallet]);

  const ownerName = isAllInvestors ? 'كافة المستثمرين (كشف مجمع)' : effectiveInvestor?.name || effectiveWallet?.ownerName || 'المستثمر';
  const ownerPhone = effectiveInvestor?.phone || '—';
  const ownerAddress = effectiveInvestor?.address || 'سامراء';

  // 1. Filter all raw transactions for effective target
  const rawTargetTransactions = useMemo(() => {
    if (isAllInvestors) {
      // All transactions related to investors
      return allTransactions.filter((tx) => {
        return (
          !!tx.investorId ||
          tx.type === 'PROFIT_DISTRIBUTION' ||
          tx.type === 'PURCHASE_INVENTORY' ||
          tx.type === 'INVESTOR_WITHDRAWAL' ||
          tx.type === 'DEPOSIT' ||
          tx.type === 'PAYMENT_RECEIVED' ||
          tx.type === 'REFERRAL_COMMISSION'
        );
      });
    }

    if (!effectiveWallet && !effectiveInvestor) return [];

    return allTransactions.filter((tx) => {
      const matchWallet =
        (effectiveWallet && (tx.fromWalletId === effectiveWallet.id || tx.toWalletId === effectiveWallet.id)) ||
        (effectiveWallet?.ownerType === 'INVESTOR' && tx.investorId === effectiveWallet.ownerId);
      const matchInvestor = effectiveInvestor ? tx.investorId === effectiveInvestor.id : false;
      return matchWallet || matchInvestor;
    });
  }, [isAllInvestors, allTransactions, effectiveWallet, effectiveInvestor]);

  // 2. Compute General Withdrawals / Outflows Statement with (الرصيد السابق - المبلغ المسحوب - الرصيد المتبقي)
  const generalWithdrawalRows = useMemo(() => {
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

    const targetInvestors = isAllInvestors
      ? investorsList.length > 0
        ? investorsList
        : effectiveInvestor
        ? [effectiveInvestor]
        : []
      : effectiveInvestor
      ? [effectiveInvestor]
      : [];

    if (targetInvestors.length === 0 && effectiveWallet) {
      // Fallback single wallet
      const sortedChronological = [...rawTargetTransactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      let runningBalance = 0;
      for (const tx of sortedChronological) {
        const isIncoming =
          tx.toWalletId === effectiveWallet.id &&
          (tx.type === 'DEPOSIT' || tx.type === 'PAYMENT_RECEIVED' || tx.type === 'REVENUE');
        const isWithdrawal =
          tx.type === 'PURCHASE_INVENTORY' ||
          tx.type === 'PROFIT_DISTRIBUTION' ||
          tx.type === 'INVESTOR_WITHDRAWAL' ||
          tx.type === 'WITHDRAWAL' ||
          (tx.type === 'EXPENSE' && tx.fromWalletId === effectiveWallet.id) ||
          tx.description?.includes('سحب') ||
          (tx.fromWalletId === effectiveWallet.id && tx.toWalletId !== effectiveWallet.id);

        if (isIncoming) {
          runningBalance += tx.amountIQD;
        } else if (isWithdrawal) {
          const prevBal = runningBalance;
          const amount = tx.amountIQD;
          const remBal = Math.max(0, prevBal - amount);
          runningBalance = remBal;

          const isPurchase = tx.type === 'PURCHASE_INVENTORY';
          const isProfitDist = tx.type === 'PROFIT_DISTRIBUTION' || tx.description?.includes('أرباح');

          rows.push({
            id: tx.id,
            investorId: effectiveWallet.ownerId || '',
            investorName: ownerName,
            previousBalance: prevBal,
            withdrawnAmount: amount,
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
    } else {
      // Calculate per investor accurately
      targetInvestors.forEach((inv) => {
        const invWallet = walletsList.find((w) => w.id === inv.walletId || w.ownerId === inv.id) || effectiveWallet;
        if (!invWallet) return;

        const investorTxs = allTransactions
          .filter(
            (tx) =>
              tx.fromWalletId === invWallet.id ||
              tx.toWalletId === invWallet.id ||
              tx.investorId === inv.id
          )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningBalance = 0;
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
            runningBalance += tx.amountIQD;
          } else if (isWithdrawal) {
            const prevBal = runningBalance;
            const amount = tx.amountIQD;
            const remBal = Math.max(0, prevBal - amount);
            runningBalance = remBal;

            const isPurchase = tx.type === 'PURCHASE_INVENTORY';
            const isProfitDist = tx.type === 'PROFIT_DISTRIBUTION' || tx.description?.includes('أرباح');

            rows.push({
              id: tx.id,
              investorId: inv.id,
              investorName: inv.name,
              previousBalance: prevBal,
              withdrawnAmount: amount,
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
    }

    // Filter by date range and search query
    return rows
      .filter((row) => {
        if (startDate && row.date < startDate) return false;
        if (endDate && row.date > endDate) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            row.investorName.toLowerCase().includes(q) ||
            row.description.toLowerCase().includes(q) ||
            row.notes.toLowerCase().includes(q) ||
            row.referenceNo.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [
    isAllInvestors,
    investorsList,
    effectiveInvestor,
    effectiveWallet,
    walletsList,
    allTransactions,
    rawTargetTransactions,
    ownerName,
    startDate,
    endDate,
    searchQuery,
    sortOrder
  ]);

  const totalGeneralWithdrawnInView = useMemo(() => {
    return generalWithdrawalRows.reduce((sum, r) => sum + r.withdrawnAmount, 0);
  }, [generalWithdrawalRows]);

  // 3. Filter for Detailed Ledger
  const filteredTransactions = useMemo(() => {
    return rawTargetTransactions
      .filter((tx) => {
        // Date range filtering
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;

        // Transaction type filtering
        if (txTypeFilter !== 'ALL') {
          if (txTypeFilter === 'WITHDRAWAL') {
            const isWithdrawal =
              tx.type === 'PROFIT_DISTRIBUTION' ||
              tx.type === 'INVESTOR_WITHDRAWAL' ||
              tx.type === 'WITHDRAWAL' ||
              tx.type === 'EXPENSE' ||
              tx.description?.includes('سحب');
            if (!isWithdrawal) return false;
          } else if (txTypeFilter === 'DEPOSIT') {
            if (tx.type !== 'DEPOSIT') return false;
          } else if (txTypeFilter === 'PURCHASE_INVENTORY') {
            if (tx.type !== 'PURCHASE_INVENTORY') return false;
          } else if (txTypeFilter === 'PAYMENT_RECEIVED') {
            if (tx.type !== 'PAYMENT_RECEIVED') return false;
          } else if (txTypeFilter === 'REFERRAL_COMMISSION') {
            if (tx.type !== 'REFERRAL_COMMISSION' && !tx.description?.includes('عمولة إحالة')) return false;
          } else if (txTypeFilter === 'EXPENSE') {
            if (tx.type !== 'EXPENSE') return false;
          } else if (tx.type !== txTypeFilter) {
            return false;
          }
        }

        // Search text filtering
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            tx.referenceNo?.toLowerCase().includes(q) ||
            tx.description?.toLowerCase().includes(q) ||
            tx.fromWalletName?.toLowerCase().includes(q) ||
            tx.toWalletName?.toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [rawTargetTransactions, startDate, endDate, txTypeFilter, searchQuery, sortOrder]);

  // 4. Range-specific Financial Summaries
  const periodDeposits = useMemo(() => {
    return rawTargetTransactions
      .filter((tx) => {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        return tx.type === 'DEPOSIT';
      })
      .reduce((sum, tx) => sum + tx.amountIQD, 0);
  }, [rawTargetTransactions, startDate, endDate]);

  const periodWithdrawals = useMemo(() => {
    return rawTargetTransactions
      .filter((tx) => {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        return (
          tx.type === 'PROFIT_DISTRIBUTION' ||
          tx.type === 'INVESTOR_WITHDRAWAL' ||
          tx.type === 'WITHDRAWAL' ||
          tx.description?.includes('سحب')
        );
      })
      .reduce((sum, tx) => sum + tx.amountIQD, 0);
  }, [rawTargetTransactions, startDate, endDate]);

  const periodPurchases = useMemo(() => {
    return rawTargetTransactions
      .filter((tx) => {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        return tx.type === 'PURCHASE_INVENTORY';
      })
      .reduce((sum, tx) => sum + tx.amountIQD, 0);
  }, [rawTargetTransactions, startDate, endDate]);

  const periodInstallments = useMemo(() => {
    return rawTargetTransactions
      .filter((tx) => {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        return tx.type === 'PAYMENT_RECEIVED';
      })
      .reduce((sum, tx) => sum + tx.amountIQD, 0);
  }, [rawTargetTransactions, startDate, endDate]);

  const periodInvestorProfits = useMemo(() => {
    return rawTargetTransactions
      .filter((tx) => {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        return !!tx.investorProfitShareIQD;
      })
      .reduce((sum, tx) => sum + (tx.investorProfitShareIQD || 0), 0);
  }, [rawTargetTransactions, startDate, endDate]);

  const periodReferralCommissions = useMemo(() => {
    return rawTargetTransactions
      .filter((tx) => {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        return tx.type === 'REFERRAL_COMMISSION' || tx.description?.includes('عمولة إحالة');
      })
      .reduce((sum, tx) => sum + tx.amountIQD, 0);
  }, [rawTargetTransactions, startDate, endDate]);

  const referralCommissionRows = useMemo(() => {
    return rawTargetTransactions
      .filter((tx) => {
        const isReferral = tx.type === 'REFERRAL_COMMISSION' || tx.description?.includes('عمولة إحالة');
        if (!isReferral) return false;
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            tx.referenceNo?.toLowerCase().includes(q) ||
            tx.description?.toLowerCase().includes(q) ||
            (tx.investorName && tx.investorName.toLowerCase().includes(q)) ||
            (tx.borrowerName && tx.borrowerName.toLowerCase().includes(q)) ||
            tx.toWalletName?.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [rawTargetTransactions, startDate, endDate, searchQuery, sortOrder]);

  const totalReferralCommissionsInView = useMemo(() => {
    return referralCommissionRows.reduce((sum, tx) => sum + tx.amountIQD, 0);
  }, [referralCommissionRows]);

  const referredInvestorsList = useMemo(() => {
    if (isAllInvestors) {
      return investorsList.filter((inv) => !!inv.contract?.referrerId);
    }
    if (!effectiveInvestor) return [];
    return investorsList.filter((inv) => inv.contract?.referrerId === effectiveInvestor.id);
  }, [isAllInvestors, investorsList, effectiveInvestor]);

  const netPeriodFlow = useMemo(() => {
    return periodDeposits + periodInstallments - (periodWithdrawals + periodPurchases);
  }, [periodDeposits, periodInstallments, periodWithdrawals, periodPurchases]);

  // Quick Preset Handlers
  const handleSetPreset = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_3_MONTHS' | 'H1_2026' | 'THIS_YEAR') => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      setStartDate(`${y}-${m}-01`);
      setEndDate(todayStr);
    } else if (preset === 'LAST_3_MONTHS') {
      const d3 = new Date();
      d3.setMonth(d3.getMonth() - 3);
      const m3 = String(d3.getMonth() + 1).padStart(2, '0');
      setStartDate(`${d3.getFullYear()}-${m3}-01`);
      setEndDate(todayStr);
    } else if (preset === 'H1_2026') {
      setStartDate('2026-01-01');
      setEndDate('2026-06-30');
    } else if (preset === 'THIS_YEAR') {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  // Export to formatted Excel spreadsheet file
  const handleExportExcel = () => {
    const isGeneralMode = statementViewMode === 'GENERAL_WITHDRAWALS';
    const isReferralMode = statementViewMode === 'REFERRAL_COMMISSIONS';

    const title = isGeneralMode
      ? 'كشف حركات ومسحوبات المستثمر'
      : isReferralMode
      ? 'كشف أرباح وعمولات الإحالة'
      : 'كشف حساب مالي تفصيلي';

    let tableHeadersHtml = '';
    let tableRowsHtml = '';

    if (isGeneralMode) {
      tableHeadersHtml = `
        <tr>
          <th>ت</th>
          <th>اسم المستثمر</th>
          <th>الرصيد السابق</th>
          <th>المبلغ المسحوب</th>
          <th>الرصيد المتبقي</th>
          <th>التاريخ</th>
          <th>البيان</th>
          <th>الملاحظات</th>
        </tr>
      `;
      tableRowsHtml = generalWithdrawalRows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.investorName}</td>
          <td class="number">${formatIQD(r.previousBalance)} د.ع</td>
          <td class="number" style="color: #dc2626;">-${formatIQD(r.withdrawnAmount)} د.ع</td>
          <td class="number" style="color: #059669;">${formatIQD(r.remainingBalance)} د.ع</td>
          <td>${r.date}</td>
          <td>${r.description}</td>
          <td>${r.notes}</td>
        </tr>
      `).join('');
    } else if (isReferralMode) {
      tableHeadersHtml = `
        <tr>
          <th>ت</th>
          <th>التاريخ</th>
          <th>رقم السند</th>
          <th>المستثمر المحال</th>
          <th>الزبون / العقد</th>
          <th>البيان المحاسبي</th>
          <th>المحفظة المستلمة</th>
          <th>عمولة الإحالة المكتسبة (د.ع)</th>
        </tr>
      `;
      tableRowsHtml = referralCommissionRows.map((tx, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${tx.date}</td>
          <td>${tx.referenceNo || '—'}</td>
          <td>${tx.investorName || 'مستثمر محال'}</td>
          <td>${tx.borrowerName || 'عقد تقسيط'}</td>
          <td>${tx.description}</td>
          <td>${tx.toWalletName || ownerName}</td>
          <td class="number" style="color: #7c3aed;">+${formatIQD(tx.amountIQD)} د.ع</td>
        </tr>
      `).join('');
    } else {
      tableHeadersHtml = `
        <tr>
          <th>ت</th>
          <th>التاريخ</th>
          <th>رقم السند</th>
          <th>نوع الحركة</th>
          <th>البيان والتفاصيل المحاسبية</th>
          <th>من محفظة</th>
          <th>إلى محفظة</th>
          <th>المبلغ (د.ع)</th>
        </tr>
      `;
      tableRowsHtml = filteredTransactions.map((tx, i) => {
        const isIncoming =
          (effectiveWallet && tx.toWalletId === effectiveWallet.id) ||
          tx.type === 'DEPOSIT' ||
          tx.type === 'PAYMENT_RECEIVED' ||
          tx.type === 'REFERRAL_COMMISSION';
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${tx.date}</td>
            <td>${tx.referenceNo || '—'}</td>
            <td>${tx.type}</td>
            <td>${tx.description}</td>
            <td>${tx.fromWalletName}</td>
            <td>${tx.toWalletName}</td>
            <td class="number" style="color: ${isIncoming ? '#059669' : '#dc2626'};">
              ${isIncoming ? '+' : '-'}${formatIQD(tx.amountIQD)} د.ع
            </td>
          </tr>
        `;
      }).join('');
    }

    const excelContent = `
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
          .number { font-weight: bold; direction: ltr; text-align: left; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h2>نظام أمان للتقسيط والاستثمار المالي - سامراء</h2>
          <h3>${title} - ${ownerName}</h3>
          <p>الفترة: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}</p>
        </div>

        <table>
          <thead>
            ${tableHeadersHtml}
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `كشف_حساب_${ownerName}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ultra-Reliable Isolated Iframe Print Method
  const handlePrint = () => {
    const existingIframe = document.getElementById('print-statement-isolated-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'print-statement-isolated-iframe';
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

    const isGeneralMode = statementViewMode === 'GENERAL_WITHDRAWALS';
    const isReferralMode = statementViewMode === 'REFERRAL_COMMISSIONS';

    const tableContentHtml = isGeneralMode
      ? `
        <table class="ledger-table">
          <thead>
            <tr>
              <th style="width: 25px;">ت</th>
              <th style="width: 120px;">اسم المستثمر</th>
              <th style="width: 100px;">الرصيد السابق</th>
              <th style="width: 110px;">المبلغ المسحوب</th>
              <th style="width: 100px;">الرصيد المتبقي</th>
              <th style="width: 80px;">التاريخ</th>
              <th>البيان</th>
              <th style="width: 90px;">الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${
              generalWithdrawalRows.length > 0
                ? generalWithdrawalRows
                    .map(
                      (r, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">
                  <td style="padding: 7px 5px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                  <td style="padding: 7px 5px; font-weight: bold; color: #0f172a;">${r.investorName}</td>
                  <td style="padding: 7px 5px; font-family: monospace; text-align: center; color: #475569; direction: ltr;">${formatIQD(r.previousBalance)} د.ع</td>
                  <td style="padding: 7px 5px; font-family: monospace; font-weight: bold; text-align: center; color: #dc2626; direction: ltr;">-${formatIQD(r.withdrawnAmount)} د.ع</td>
                  <td style="padding: 7px 5px; font-family: monospace; font-weight: bold; text-align: center; color: #059669; direction: ltr;">${formatIQD(r.remainingBalance)} د.ع</td>
                  <td style="padding: 7px 5px; font-family: monospace; direction: ltr; text-align: center;">${r.date}</td>
                  <td style="padding: 7px 5px; color: #334155; line-height: 1.4;">${r.description}</td>
                  <td style="padding: 7px 5px; color: #64748b; font-size: 10px;">${r.notes}</td>
                </tr>
              `
                    )
                    .join('')
                : `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #64748b;">لا توجد حركات مسحوبات أو خصومات مسجلة خلال الفترة المحددة</td></tr>`
            }
          </tbody>
        </table>
      `
      : isReferralMode
      ? `
        <table class="ledger-table">
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">ت</th>
              <th style="width: 75px; text-align: center;">التاريخ</th>
              <th style="width: 95px; text-align: center;">رقم السند</th>
              <th style="width: 120px;">المستثمر المحال</th>
              <th style="width: 120px;">الزبون / العقد</th>
              <th>البيان المحاسبي</th>
              <th style="width: 110px; text-align: center;">عمولة الإحالة (د.ع)</th>
            </tr>
          </thead>
          <tbody>
            ${
              referralCommissionRows.length > 0
                ? referralCommissionRows
                    .map(
                      (tx, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">
                  <td style="padding: 7px 5px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                  <td style="padding: 7px 5px; font-family: monospace; direction: ltr; text-align: center;">${tx.date}</td>
                  <td style="padding: 7px 5px; font-family: monospace; font-weight: bold; color: #0f172a; text-align: center;">${tx.referenceNo || '—'}</td>
                  <td style="padding: 7px 5px; font-weight: bold; color: #7c3aed;">${tx.investorName || 'مستثمر محال'}</td>
                  <td style="padding: 7px 5px; color: #334155;">${tx.borrowerName || 'عقد تقسيط'}</td>
                  <td style="padding: 7px 5px; color: #475569; line-height: 1.4;">${tx.description}</td>
                  <td style="padding: 7px 5px; font-weight: bold; font-family: monospace; text-align: center; color: #7c3aed; direction: ltr;">
                    +${formatIQD(tx.amountIQD)} د.ع
                  </td>
                </tr>
              `
                    )
                    .join('')
                : `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">لا توجد أي عمولات إحالة مسجلة خلال الفترة الزمنية المحددة</td></tr>`
            }
          </tbody>
        </table>
      `
      : `
        <table class="ledger-table">
          <thead>
            <tr>
              <th style="width: 25px;">ت</th>
              <th style="width: 75px;">التاريخ</th>
              <th style="width: 95px;">رقم السند/الوصل</th>
              <th style="width: 110px;">نوع الحركة</th>
              <th>البيان والتفاصيل المحاسبية</th>
              <th style="width: 100px;">الجهة المقابلة</th>
              <th style="width: 100px;">المبلغ (د.ع)</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredTransactions.length > 0
                ? filteredTransactions
                    .map((tx, idx) => {
                      const isIncoming =
                        (effectiveWallet && tx.toWalletId === effectiveWallet.id) ||
                        tx.type === 'DEPOSIT' ||
                        tx.type === 'PAYMENT_RECEIVED' ||
                        tx.type === 'REFERRAL_COMMISSION';
                      const txTypeName =
                        tx.type === 'DEPOSIT'
                          ? 'إيداع رأس مال'
                          : tx.type === 'PURCHASE_INVENTORY'
                          ? 'شراء مواد بالمخزن'
                          : tx.type === 'PAYMENT_RECEIVED'
                          ? 'سداد قسط واستلام أرباح'
                          : tx.type === 'REFERRAL_COMMISSION'
                          ? 'عمولة إحالة واستقطاب'
                          : tx.type === 'PROFIT_DISTRIBUTION' || tx.type === 'INVESTOR_WITHDRAWAL'
                          ? 'سحب أرباح / نقدي'
                          : tx.type === 'EXPENSE'
                          ? 'مصروف'
                          : tx.type;

                      return `
                        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">
                          <td style="padding: 7px 5px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                          <td style="padding: 7px 5px; font-family: monospace; direction: ltr; text-align: center;">${tx.date}</td>
                          <td style="padding: 7px 5px; font-family: monospace; font-weight: bold; color: #0f172a; text-align: center;">${tx.referenceNo || '—'}</td>
                          <td style="padding: 7px 5px; font-weight: 600; color: #1e293b;">${txTypeName}</td>
                          <td style="padding: 7px 5px; color: #334155; line-height: 1.4;">${tx.description || '—'}</td>
                          <td style="padding: 7px 5px; color: #475569; font-size: 10px;">${tx.fromWalletName || 'طرف خارجي'}</td>
                          <td style="padding: 7px 5px; font-weight: bold; font-family: monospace; text-align: center; color: ${isIncoming ? '#059669' : '#dc2626'}; direction: ltr;">
                            ${isIncoming ? '+' : '-'}${formatIQD(tx.amountIQD)} د.ع
                          </td>
                        </tr>
                      `;
                    })
                    .join('')
                : `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">لا توجد أي قيود مسجلة خلال الفترة الزمنية المحددة</td></tr>`
            }
          </tbody>
        </table>
      `;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف حساب المستثمرين - ${ownerName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
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
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .company-title {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 3px 0;
          }
          .company-subtitle {
            font-size: 11px;
            color: #475569;
            margin: 0;
          }
          .badge-doc {
            background-color: #0f172a;
            color: #ffffff;
            font-size: 13px;
            font-weight: bold;
            padding: 5px 12px;
            border-radius: 6px;
            display: inline-block;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 12px;
            font-size: 11px;
          }
          .meta-item span {
            color: #64748b;
            display: block;
            font-size: 10px;
          }
          .meta-item strong {
            color: #0f172a;
            font-size: 11px;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
          }
          .summary-table th {
            background-color: #f1f5f9;
            padding: 7px;
            font-size: 10px;
            color: #475569;
            border: 1px solid #e2e8f0;
            text-align: center;
          }
          .summary-table td {
            padding: 8px 6px;
            font-size: 11px;
            font-weight: bold;
            font-family: monospace;
            border: 1px solid #e2e8f0;
            text-align: center;
          }
          table.ledger-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          table.ledger-table th {
            background-color: #1e293b;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
            padding: 8px 6px;
            text-align: right;
            border: 1px solid #1e293b;
          }
          table.ledger-table td {
            border: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="sheet-container">
          <!-- Clean Header -->
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="text-align: right;">
              <h1 style="font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 4px 0;">${profile.companyName}</h1>
              <p style="font-size: 11px; color: #475569; margin: 0;">${profile.companyAddress}${profile.companyPhone ? ` • ${profile.companyPhone}` : ''}</p>
            </div>
            <div style="text-align: left;">
              <h2 style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0;">
                ${isGeneralMode ? 'كشف حركات ومسحوبات المستثمر' : isReferralMode ? 'كشف أرباح وعمولات الإحالة واستقطاب رؤوس الأموال' : 'كشف حساب مالي تفصيلي'}
              </h2>
              <span style="font-size: 11px; color: #64748b;">تاريخ الطباعة: <strong>${currentDateFormatted}</strong></span>
            </div>
          </div>
          <div style="font-size: 11px; color: #475569; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <span>الفترة: <strong>من ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}</strong></span>
            <span>المستثمر: <strong>${ownerName}</strong></span>
          </div>

          ${
            isReferralMode
              ? `
            <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
              <div>
                <span style="color: #6d28d9; font-weight: bold; display: block;">أرباح المحفظة المباشرة:</span>
                <strong style="font-family: monospace; color: #0f172a; font-size: 12px;">${formatIQD(periodInvestorProfits)} د.ع</strong>
              </div>
              <div style="font-size: 13px; font-weight: bold; color: #8b5cf6;">+</div>
              <div>
                <span style="color: #6d28d9; font-weight: bold; display: block;">عمولات الإحالة المكتسبة:</span>
                <strong style="font-family: monospace; color: #7c3aed; font-size: 12px;">+${formatIQD(totalReferralCommissionsInView)} د.ع</strong>
              </div>
              <div style="font-size: 13px; font-weight: bold; color: #8b5cf6;">=</div>
              <div>
                <span style="color: #059669; font-weight: bold; display: block;">إجمالي العائد الموحد:</span>
                <strong style="font-family: monospace; color: #059669; font-size: 13px;">${formatIQD(periodInvestorProfits + totalReferralCommissionsInView)} د.ع</strong>
              </div>
            </div>
            ${
              referredInvestorsList.length > 0
                ? `
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; font-size: 10px; color: #475569;">
                <strong>المستثمرون المحالون في الشبكة: </strong>
                ${referredInvestorsList.map(r => `${r.name} (${r.contract?.referrerSharePercent || 0}% عمولة)`).join(' • ')}
              </div>
            `
                : ''
            }
          `
              : ''
          }

          <!-- Rendered Table (General Withdrawals, Referral Commissions or Detailed Ledger) -->
          ${tableContentHtml}

          <!-- Grand Total Box -->
          ${
            isGeneralMode
              ? `
            <div style="margin-top: 14px; padding: 10px 14px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: bold;">
              <span>إجمالي المبالغ المسحوبة:</span>
              <span style="font-family: monospace; font-size: 14px; color: #b91c1c; direction: ltr;">
                -${formatIQD(totalGeneralWithdrawnInView)} د.ع
              </span>
            </div>
          `
              : isReferralMode
              ? `
            <div style="margin-top: 14px; padding: 10px 14px; background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: bold;">
              <span style="color: #6d28d9;">إجمالي عمولات الإحالة المستلمة:</span>
              <span style="font-family: monospace; font-size: 14px; color: #7c3aed; direction: ltr;">
                +${formatIQD(totalReferralCommissionsInView)} د.ع
              </span>
            </div>
          `
              : ''
          }

          <!-- Simple Signatures Row -->
          <div style="display: flex; justify-content: space-between; margin-top: 35px; padding-top: 15px; border-top: 1px dashed #cbd5e1; page-break-inside: avoid;">
            <div style="width: 40%; text-align: center; font-size: 12px; color: #0f172a;">
              <strong>توقيع المحاسب المالي</strong>
              <div style="height: 35px; border-bottom: 1px dotted #94a3b8; margin: 10px 30px 5px 30px;"></div>
            </div>
            <div style="width: 40%; text-align: center; font-size: 12px; color: #0f172a;">
              <strong>اعتماد الإدارة العامة</strong>
              <div style="height: 35px; border-bottom: 1px dotted #94a3b8; margin: 10px 30px 5px 30px;"></div>
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                isAllInvestors
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isAllInvestors ? <Users className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-lg tracking-tight">
                  كشف حساب: <span className="text-emerald-400">{ownerName}</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {statementViewMode === 'GENERAL_WITHDRAWALS'
                    ? 'كشف الحركات والمسحوبات العامة'
                    : statementViewMode === 'REFERRAL_COMMISSIONS'
                    ? 'كشف أرباح وعمولات الإحالة'
                    : 'كشف تفصيلي أصولي'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>
                  السيولة المتاحة:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {formatIQD(isAllInvestors ? walletsList.reduce((s, w) => s + w.balance, 0) : effectiveWallet?.balance || 0)} د.ع
                  </strong>
                </span>
                <span>•</span>
                <span>
                  رأس المال الكلي:{' '}
                  <strong className="text-amber-400 font-mono">
                    {formatIQD(isAllInvestors ? investorsList.reduce((s, i) => s + i.totalCapitalDeposited, 0) : effectiveInvestor?.totalCapitalDeposited || 0)} د.ع
                  </strong>
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {/* Investor Selector in Header */}
            {investorsList.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedInvestorId}
                  onChange={(e) => setSelectedInvestorId(e.target.value)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">جميع المستثمرين ({investorsList.length})</option>
                  {investorsList.map((inv) => (
                    <option key={inv.id} value={inv.id} className="bg-slate-900 text-white">
                      {inv.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all active:scale-95"
              title="تصدير كشف الحساب إلى ملف Excel"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف</span>
            </button>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Statement Mode Switcher Tabs */}
        <div className="px-4 pt-3 pb-2 bg-slate-950 flex items-center gap-2 border-b border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setStatementViewMode('GENERAL_WITHDRAWALS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              statementViewMode === 'GENERAL_WITHDRAWALS'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span>كشف الحركات العامة والمسحوبات (الرصيد السابق - المسحوب - المتبقي)</span>
          </button>

          <button
            onClick={() => setStatementViewMode('REFERRAL_COMMISSIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              statementViewMode === 'REFERRAL_COMMISSIONS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Coins className="w-4 h-4 text-purple-400" />
            <span>أرباح وعمولات الإحالة ({referralCommissionRows.length})</span>
          </button>

          <button
            onClick={() => setStatementViewMode('DETAILED_LEDGER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              statementViewMode === 'DETAILED_LEDGER'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>الكشف المالي التفصيلي (كافة القيود)</span>
          </button>
        </div>

        {/* Date Range Selector & Period Controls */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>تحديد الفترة الزمنية للكشف:</span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1 md:pb-0">
              <button
                onClick={() => handleSetPreset('ALL')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
              >
                كامل الفترة (الكل)
              </button>
              <button
                onClick={() => handleSetPreset('THIS_MONTH')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
              >
                الشهر الحالي
              </button>
              <button
                onClick={() => handleSetPreset('LAST_3_MONTHS')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
              >
                آخر 3 أشهر
              </button>
              <button
                onClick={() => handleSetPreset('H1_2026')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
              >
                النصف الأول 2026
              </button>
              <button
                onClick={() => handleSetPreset('THIS_YEAR')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
              >
                السنة الحالية (2026)
              </button>
            </div>
          </div>

          {/* Date Pickers & Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
              <span className="text-slate-400 shrink-0 font-medium">من تاريخ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white w-full outline-none text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
              <span className="text-slate-400 shrink-0 font-medium">إلى تاريخ:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-white w-full outline-none text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 sm:col-span-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="بحث باسم المستثمر، رقم السند، أو البيان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-white placeholder-slate-500 w-full outline-none text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Period Summary Stats Cards */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 text-xs">
          <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">إيداعات الفترة:</span>
            <span className="font-bold text-emerald-400 font-mono">{formatIQD(periodDeposits)} د.ع</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-amber-950/20 border border-amber-500/30">
            <span className="text-amber-400 text-[10px] block font-semibold">مسحوبات الفترة:</span>
            <span className="font-bold text-amber-400 font-mono">{formatIQD(periodWithdrawals)} د.ع</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">مشتريات بضائع:</span>
            <span className="font-bold text-slate-300 font-mono">{formatIQD(periodPurchases)} د.ع</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">تحصيلات الأقساط:</span>
            <span className="font-bold text-purple-400 font-mono">{formatIQD(periodInstallments)} د.ع</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">أرباح المستثمرين بالفترة:</span>
            <span className="font-bold text-emerald-300 font-mono">{formatIQD(periodInvestorProfits)} د.ع</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-950/20 border border-purple-500/30">
            <span className="text-purple-400 text-[10px] block font-semibold">عمولات الإحالة:</span>
            <span className="font-bold text-purple-300 font-mono">+{formatIQD(periodReferralCommissions)} د.ع</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">صافي حركة الفترة:</span>
            <span className={`font-bold font-mono ${netPeriodFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netPeriodFlow >= 0 ? '+' : ''}{formatIQD(netPeriodFlow)} د.ع
            </span>
          </div>
        </div>

        {/* Filter Tx Types in Detailed Mode */}
        {statementViewMode === 'DETAILED_LEDGER' && (
          <div className="p-3 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto text-xs">
            <span className="text-slate-400 font-semibold shrink-0">تصفية نوع القيد:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setTxTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  txTypeFilter === 'ALL'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                جميع الحركات ({filteredTransactions.length})
              </button>
              <button
                onClick={() => setTxTypeFilter('DEPOSIT')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  txTypeFilter === 'DEPOSIT'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                إيداعات رأس المال
              </button>
              <button
                onClick={() => setTxTypeFilter('WITHDRAWAL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  txTypeFilter === 'WITHDRAWAL'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                مسحوبات وأرباح
              </button>
              <button
                onClick={() => setTxTypeFilter('PURCHASE_INVENTORY')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  txTypeFilter === 'PURCHASE_INVENTORY'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                شراء مواد
              </button>
              <button
                onClick={() => setTxTypeFilter('PAYMENT_RECEIVED')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  txTypeFilter === 'PAYMENT_RECEIVED'
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                تحصيل أقساط
              </button>
              <button
                onClick={() => setTxTypeFilter('REFERRAL_COMMISSION')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  txTypeFilter === 'REFERRAL_COMMISSION'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                عمولات الإحالة
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div id="printable-investor-statement" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {/* VIEW MODE 1: General Withdrawals Statement */}
          {statementViewMode === 'GENERAL_WITHDRAWALS' ? (
            <div>
              {generalWithdrawalRows.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-3">
                  <Receipt className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
                  <p className="text-xs">لا توجد حركات مسحوبات أو خصومات مسجلة خلال الفترة المحددة</p>
                  <button
                    onClick={() => handleSetPreset('ALL')}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إلغاء قيود الفترة وعرض كافة الحركات</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5">ت</th>
                        <th className="py-3 px-3.5">اسم المستثمر</th>
                        <th className="py-3 px-3.5 text-center">الرصيد السابق</th>
                        <th className="py-3 px-3.5 text-center">المبلغ المسحوب</th>
                        <th className="py-3 px-3.5 text-center">الرصيد المتبقي</th>
                        <th className="py-3 px-3.5 text-center">التاريخ</th>
                        <th className="py-3 px-3.5">البيان</th>
                        <th className="py-3 px-3.5">الملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {generalWithdrawalRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-950/60 transition-colors">
                          <td className="py-3.5 px-3.5 font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-3.5 px-3.5">
                            <span className="font-bold text-white">{row.investorName}</span>
                          </td>
                          <td className="py-3.5 px-3.5 text-center">
                            <span className="font-mono text-slate-300 font-bold">{formatIQD(row.previousBalance)} د.ع</span>
                          </td>
                          <td className="py-3.5 px-3.5 text-center">
                            <span className="font-mono text-amber-400 font-black bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 inline-block">
                              -{formatIQD(row.withdrawnAmount)} د.ع
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 text-center">
                            <span className="font-mono text-emerald-400 font-bold">{formatIQD(row.remainingBalance)} د.ع</span>
                          </td>
                          <td className="py-3.5 px-3.5 text-center font-mono text-slate-400">
                            {row.date}
                          </td>
                          <td className="py-3.5 px-3.5">
                            <div className="space-y-0.5">
                              <span className="text-slate-200 font-medium block">{row.description}</span>
                              <span className="text-[10px] text-slate-500">
                                {row.isPurchase ? 'شراء بضاعة للمخزن' : row.isProfitDist ? 'سحب أرباح مستثمر' : 'سحب نقدي'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3.5 text-slate-400 text-[11px]">
                            {row.notes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : statementViewMode === 'REFERRAL_COMMISSIONS' ? (
            /* VIEW MODE 3: Referral Commissions Statement */
            <div className="space-y-4">
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>أرباح المحفظة المباشرة</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-lg font-black text-emerald-400 font-mono">
                    {formatIQD(periodInvestorProfits)} <span className="text-xs text-slate-400 font-normal">د.ع</span>
                  </p>
                  <p className="text-[10.5px] text-slate-400">
                    حصة الأرباح من عقود رأس المال المودع
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-1">
                  <div className="flex items-center justify-between text-purple-300 text-xs font-semibold">
                    <span>عمولات الإحالة المكتسبة</span>
                    <Coins className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-lg font-black text-purple-400 font-mono">
                    +{formatIQD(totalReferralCommissionsInView)} <span className="text-xs text-purple-300 font-normal">د.ع</span>
                  </p>
                  <p className="text-[10.5px] text-purple-300/80">
                    مستقطعة من حصة أرباح الشركة
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-emerald-950/40 border border-purple-500/40 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                    <span>إجمالي العائد المالي الموحد</span>
                    <Award className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 font-mono">
                    {formatIQD(periodInvestorProfits + totalReferralCommissionsInView)} <span className="text-xs text-slate-400 font-normal">د.ع</span>
                  </p>
                  <p className="text-[10.5px] text-emerald-400 font-semibold">
                    صافي الأرباح المباشرة + عمولات الإحالة
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>شبكة المستثمرين المحالين</span>
                    <Share2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-lg font-black text-blue-400 font-mono">
                    {referredInvestorsList.length} <span className="text-xs text-slate-400 font-normal">مستثمر</span>
                  </p>
                  <p className="text-[10.5px] text-slate-400">
                    استقطبوا رؤوس أموال ضمن الشركة
                  </p>
                </div>
              </div>

              {/* Referred Investors Network Pill Box */}
              {referredInvestorsList.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>المستثمرون التابعون لشبكة الإحالة:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {referredInvestorsList.map((refInv) => (
                      <div
                        key={refInv.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs"
                      >
                        <span className="font-bold text-white">{refInv.name}</span>
                        <span className="text-purple-300 font-mono font-bold bg-purple-500/20 px-1.5 py-0.5 rounded text-[10px]">
                          عمولة: {refInv.contract?.referrerSharePercent || 0}%
                        </span>
                        <span className="text-slate-400 font-mono text-[10.5px]">
                          ({formatIQD(refInv.totalCapitalDeposited)} د.ع رأس مال)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Table of Referral Commission Transactions */}
              {referralCommissionRows.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <Coins className="w-12 h-12 mx-auto text-purple-500/40 stroke-[1.5]" />
                  <p className="text-xs">لا توجد عمولات إحالة مسجلة أو مدفوعة خلال الفترة الزمنية المحددة</p>
                  <p className="text-[11px] text-slate-500">
                    يتم صرف وإيداع عمولة الإحالة آلياً في محفظة المحيل مع كل قسط يتم تحصيله من عقود المستثمر المحال
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 text-center w-10">ت</th>
                        <th className="py-3 px-3.5 text-center">التاريخ</th>
                        <th className="py-3 px-3.5 text-center">رقم السند</th>
                        <th className="py-3 px-3.5">المستثمر المحال</th>
                        <th className="py-3 px-3.5">الزبون / العقد</th>
                        <th className="py-3 px-3.5">البيان المحاسبي</th>
                        <th className="py-3 px-3.5 text-center">المحفظة المستلمة</th>
                        <th className="py-3 px-3.5 text-center">عمولة الإحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {referralCommissionRows.map((tx, idx) => (
                        <tr key={tx.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-3.5 text-center font-mono text-slate-400">{tx.date}</td>
                          <td className="py-3 px-3.5 text-center font-mono font-bold text-amber-300">
                            {tx.referenceNo || 'سند عمولة'}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-purple-400">{tx.investorName || 'مستثمر محال'}</span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-300">
                            {tx.borrowerName || 'عقد تقسيط'}
                          </td>
                          <td className="py-3 px-3.5 text-slate-200">
                            {tx.description}
                          </td>
                          <td className="py-3 px-3.5 text-center text-slate-400 text-[11px]">
                            {tx.toWalletName}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span className="font-mono text-purple-400 font-bold bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 inline-block">
                              +{formatIQD(tx.amountIQD)} د.ع
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-3">
                  <Receipt className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
                  <p className="text-xs">لا توجد حركات مالية مسجلة خلال الفترة المحددة</p>
                  <button
                    onClick={() => handleSetPreset('ALL')}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إلغاء قيود الفترة وعرض كافة الحركات</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTransactions.map((tx) => {
                    const isIncoming =
                      (effectiveWallet && tx.toWalletId === effectiveWallet.id) ||
                      tx.type === 'DEPOSIT' ||
                      tx.type === 'PAYMENT_RECEIVED' ||
                      tx.type === 'REFERRAL_COMMISSION';
                    const isWithdrawal =
                      tx.type === 'PROFIT_DISTRIBUTION' ||
                      tx.type === 'INVESTOR_WITHDRAWAL' ||
                      tx.type === 'WITHDRAWAL' ||
                      (effectiveWallet && tx.type === 'EXPENSE' && tx.fromWalletId === effectiveWallet.id) ||
                      tx.description?.includes('سحب');

                    return (
                      <div
                        key={tx.id}
                        className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                      >
                        {/* Left Info */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isIncoming
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isWithdrawal
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {isIncoming ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : isWithdrawal ? (
                              <ArrowUpRight className="w-4 h-4 text-amber-400" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                {tx.referenceNo || 'سند مالي'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">• {tx.date}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  tx.type === 'DEPOSIT'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : tx.type === 'PURCHASE_INVENTORY'
                                    ? 'bg-slate-800 text-slate-300'
                                    : tx.type === 'PAYMENT_RECEIVED'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : tx.type === 'REFERRAL_COMMISSION'
                                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                                    : isWithdrawal
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-blue-500/10 text-blue-400'
                                }`}
                              >
                                {tx.type === 'DEPOSIT'
                                  ? 'إيداع رأس مال'
                                  : tx.type === 'PURCHASE_INVENTORY'
                                  ? 'شراء مواد بالمخزن'
                                  : tx.type === 'PAYMENT_RECEIVED'
                                  ? 'سداد قسط واستلام أرباح'
                                  : tx.type === 'REFERRAL_COMMISSION'
                                  ? 'عمولة إحالة واستقطاب'
                                  : isWithdrawal
                                  ? 'سحب أرباح / نقدي'
                                  : tx.type}
                              </span>
                            </div>

                            <p className="text-slate-200 font-medium">{tx.description}</p>

                            <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                              <span>المصدر: <strong className="text-slate-300">{tx.fromWalletName}</strong></span>
                              <span>←</span>
                              <span>الوجهة: <strong className="text-slate-300">{tx.toWalletName}</strong></span>
                            </div>

                            {/* Profit Shares breakdown if available */}
                            {(tx.investorProfitShareIQD || tx.companyProfitShareIQD) && (
                              <div className="text-[10px] text-indigo-300 pt-0.5 flex items-center gap-3">
                                <span>حصة المستثمر من الربح: <strong>{formatIQD(tx.investorProfitShareIQD || 0)} د.ع</strong></span>
                                <span>|</span>
                                <span>عمولة الشركة: <strong>{formatIQD(tx.companyProfitShareIQD || 0)} د.ع</strong></span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Amount */}
                        <div className="text-left shrink-0 self-end md:self-center flex flex-col items-end">
                          <p
                            className={`text-base font-black font-mono tracking-tight ${
                              isIncoming ? 'text-emerald-400' : isWithdrawal ? 'text-amber-400' : 'text-rose-400'
                            }`}
                          >
                            {isIncoming ? '+' : '-'}{formatIQD(tx.amountIQD)} د.ع
                          </p>
                          <span className="text-[10px] text-slate-500 block">دينار عراقي IQD</span>

                          {tx.type === 'DEPOSIT' && (
                            <button
                              onClick={() => handleOpenDepositReceipt(tx)}
                              className="mt-2 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[10.5px] font-bold border border-emerald-500/30 flex items-center gap-1 transition-all"
                              title="معاينة وطباعة وصل وسند القبض المالي"
                            >
                              <Printer className="w-3 h-3" />
                              <span>طباعة وصل القبض</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            إجمالي عدد القيود: <strong className="text-white font-mono">{statementViewMode === 'GENERAL_WITHDRAWALS' ? generalWithdrawalRows.length : statementViewMode === 'REFERRAL_COMMISSIONS' ? referralCommissionRows.length : filteredTransactions.length}</strong>
            {statementViewMode === 'GENERAL_WITHDRAWALS' && (
              <span className="mr-3">| إجمالي المسحوبات بالجدول: <strong className="text-amber-400 font-mono">{formatIQD(totalGeneralWithdrawnInView)} د.ع</strong></span>
            )}
            {statementViewMode === 'REFERRAL_COMMISSIONS' && (
              <span className="mr-3">| إجمالي العمولات المستلمة: <strong className="text-purple-400 font-mono">+{formatIQD(totalReferralCommissionsInView)} د.ع</strong></span>
            )}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors"
          >
            إغلاق الكشف
          </button>
        </div>
      </div>

      {/* Re-Print Deposit Receipt Modal */}
      <DepositReceiptModal
        isOpen={!!viewingDepositReceipt}
        onClose={() => setViewingDepositReceipt(null)}
        receipt={viewingDepositReceipt}
      />
    </div>
  );
};
