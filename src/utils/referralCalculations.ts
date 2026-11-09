import { InstallmentContract, Investor, LedgerTransaction } from '@/types/finance';

export interface ContractReferralBreakdown {
  contractId: string;
  contractNumber: string;
  borrowerName: string;
  itemName: string;
  itemCostPriceIQD: number;
  totalSalePriceIQD: number;
  totalMonths: number;
  paidMonths: number;
  investorSharePercent: number;
  referrerSharePercent: number;
  effectiveReferrerPercent: number;
  grossCompanySharePercent: number;
  netCompanySharePercent: number;
  totalContractProfitIQD: number;
  totalInvestorProfitIQD: number;
  totalReferrerProfitIQD: number;
  totalCompanyProfitIQD: number;
  collectedContractProfitIQD: number;
  collectedInvestorProfitIQD: number;
  collectedReferrerProfitIQD: number;
  collectedCompanyProfitIQD: number;
  remainingReferrerProfitIQD: number;
}

export interface ReferredInvestorSummary {
  investorId: string;
  investorName: string;
  investorSharePercent: number;
  referrerSharePercent: number;
  effectiveReferrerPercent: number;
  grossCompanySharePercent: number;
  netCompanySharePercent: number;
  contractsCount: number;
  totalInstallments: number;
  totalPaidInstallments: number;
  totalContractProfitIQD: number;
  totalInvestorProfitIQD: number;
  totalReferrerProfitIQD: number;
  totalCompanyProfitIQD: number;
  collectedContractProfitIQD: number;
  collectedInvestorProfitIQD: number;
  collectedReferrerProfitIQD: number;
  collectedCompanyProfitIQD: number;
  remainingReferrerProfitIQD: number;
  contracts: ContractReferralBreakdown[];
}

export interface ResolvedCommissionVoucher {
  txId: string;
  referenceNo: string;
  date: string;
  referrerId?: string;
  referrerName: string;
  referredInvestorId?: string;
  referredInvestorName: string;
  contractNumber: string;
  borrowerName: string;
  itemName: string;
  commissionPercent: number;
  investorSharePercent: number;
  netCompanySharePercent: number;
  installmentTotalProfitIQD: number;
  investorShareAmountIQD: number;
  commissionAmountIQD: number;
  netCompanyShareAmountIQD: number;
  toWalletName: string;
  description: string;
}

export function getThreeWaySplitPercents(investor: Investor): {
  investorSharePercent: number;
  referrerSharePercent: number;
  effectiveReferrerPercent: number;
  grossCompanySharePercent: number;
  netCompanySharePercent: number;
} {
  const investorSharePercent = investor.contract?.investorSharePercent ?? 60;
  // إجمالي حصة الشركة من العقد قبل استقطاع عمولة الوسيط يكمّل حصة المستثمر إلى 100% دائماً
  const grossCompanySharePercent = Math.max(0, 100 - investorSharePercent);
  const referrerSharePercent =
    investor.contract?.referrerSharePercent ?? investor.referralSharePercent ?? 0;
  // عمولة الوسيط تُحسب كنسبة من حصة الشركة الإجمالية (وليس من كامل ربح العقد)
  const effectiveReferrerPercent = Number(
    ((grossCompanySharePercent * referrerSharePercent) / 100).toFixed(2)
  );
  // صافي حصة الشركة المتبقية من العقد
  const netCompanySharePercent = Number(
    Math.max(0, grossCompanySharePercent - effectiveReferrerPercent).toFixed(2)
  );

  return {
    investorSharePercent,
    referrerSharePercent,
    effectiveReferrerPercent,
    grossCompanySharePercent,
    netCompanySharePercent,
  };
}

export function calculateContractReferralBreakdown(
  contract: InstallmentContract,
  investor: Investor
): ContractReferralBreakdown {
  const splits = getThreeWaySplitPercents(investor);
  const schedules = contract.schedules || [];
  const paidSchedules = schedules.filter((s) => s.status === 'PAID');
  const unpaidSchedules = schedules.filter((s) => s.status !== 'PAID');

  const totalContractProfitIQD = schedules.reduce((sum, s) => sum + (s.profitAmountIQD || 0), 0);
  const totalInvestorProfitIQD = schedules.reduce((sum, s) => sum + (s.investorProfitShareIQD || 0), 0);
  const totalReferrerProfitIQD = schedules.reduce((sum, s) => sum + (s.referrerProfitShareIQD || 0), 0);
  const totalCompanyProfitIQD = schedules.reduce((sum, s) => sum + (s.companyProfitShareIQD || 0), 0);

  const collectedContractProfitIQD = paidSchedules.reduce((sum, s) => sum + (s.profitAmountIQD || 0), 0);
  const collectedInvestorProfitIQD = paidSchedules.reduce((sum, s) => sum + (s.investorProfitShareIQD || 0), 0);
  const collectedReferrerProfitIQD = paidSchedules.reduce((sum, s) => sum + (s.referrerProfitShareIQD || 0), 0);
  const collectedCompanyProfitIQD = paidSchedules.reduce((sum, s) => sum + (s.companyProfitShareIQD || 0), 0);

  const remainingReferrerProfitIQD = unpaidSchedules.reduce(
    (sum, s) => sum + (s.referrerProfitShareIQD || 0),
    0
  );

  return {
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    borrowerName: contract.borrowerName,
    itemName: contract.inventoryItemName,
    itemCostPriceIQD: contract.itemCostPriceIQD,
    totalSalePriceIQD: contract.totalSalePriceIQD,
    totalMonths: schedules.length || contract.monthsCount || 0,
    paidMonths: paidSchedules.length,
    ...splits,
    totalContractProfitIQD,
    totalInvestorProfitIQD,
    totalReferrerProfitIQD,
    totalCompanyProfitIQD,
    collectedContractProfitIQD,
    collectedInvestorProfitIQD,
    collectedReferrerProfitIQD,
    collectedCompanyProfitIQD,
    remainingReferrerProfitIQD,
  };
}

export function buildReferredInvestorSummary(
  investor: Investor,
  allContracts: InstallmentContract[]
): ReferredInvestorSummary {
  const splits = getThreeWaySplitPercents(investor);
  const invContracts = allContracts.filter((c) => c.investorId === investor.id);
  const contractBreakdowns = invContracts.map((c) => calculateContractReferralBreakdown(c, investor));

  const totalInstallments = contractBreakdowns.reduce((sum, c) => sum + c.totalMonths, 0);
  const totalPaidInstallments = contractBreakdowns.reduce((sum, c) => sum + c.paidMonths, 0);

  const totalContractProfitIQD = contractBreakdowns.reduce((sum, c) => sum + c.totalContractProfitIQD, 0);
  const totalInvestorProfitIQD = contractBreakdowns.reduce((sum, c) => sum + c.totalInvestorProfitIQD, 0);
  const totalReferrerProfitIQD = contractBreakdowns.reduce((sum, c) => sum + c.totalReferrerProfitIQD, 0);
  const totalCompanyProfitIQD = contractBreakdowns.reduce((sum, c) => sum + c.totalCompanyProfitIQD, 0);

  const collectedContractProfitIQD = contractBreakdowns.reduce(
    (sum, c) => sum + c.collectedContractProfitIQD,
    0
  );
  const collectedInvestorProfitIQD =
    contractBreakdowns.length > 0
      ? contractBreakdowns.reduce((sum, c) => sum + c.collectedInvestorProfitIQD, 0)
      : investor.totalProfitsEarned || 0;
  const collectedReferrerProfitIQD = contractBreakdowns.reduce(
    (sum, c) => sum + c.collectedReferrerProfitIQD,
    0
  );
  const collectedCompanyProfitIQD = contractBreakdowns.reduce(
    (sum, c) => sum + c.collectedCompanyProfitIQD,
    0
  );
  const remainingReferrerProfitIQD = contractBreakdowns.reduce(
    (sum, c) => sum + c.remainingReferrerProfitIQD,
    0
  );

  return {
    investorId: investor.id,
    investorName: investor.name,
    ...splits,
    contractsCount: contractBreakdowns.length,
    totalInstallments,
    totalPaidInstallments,
    totalContractProfitIQD,
    totalInvestorProfitIQD,
    totalReferrerProfitIQD,
    totalCompanyProfitIQD,
    collectedContractProfitIQD,
    collectedInvestorProfitIQD,
    collectedReferrerProfitIQD,
    collectedCompanyProfitIQD,
    remainingReferrerProfitIQD,
    contracts: contractBreakdowns,
  };
}

export function resolveReferralCommissionVoucher(
  tx: LedgerTransaction,
  investors: Investor[],
  contracts: InstallmentContract[]
): ResolvedCommissionVoucher {
  const referrer = investors.find(
    (inv) =>
      inv.id === tx.referrerId ||
      inv.id === tx.investorId ||
      inv.walletId === tx.toWalletId
  );

  const referredChildren = referrer
    ? investors.filter(
        (inv) => inv.referredById === referrer.id || inv.contract?.referrerId === referrer.id
      )
    : [];

  const childIds = new Set(referredChildren.map((c) => c.id));
  const matchedContract =
    contracts.find((c) => c.borrowerId === tx.borrowerId && childIds.has(c.investorId)) ||
    contracts.find((c) => c.borrowerId === tx.borrowerId);

  const referredInvestor =
    (matchedContract ? investors.find((inv) => inv.id === matchedContract.investorId) : undefined) ||
    (referredChildren.length === 1 ? referredChildren[0] : undefined);

  const splits = referredInvestor
    ? getThreeWaySplitPercents(referredInvestor)
    : {
        investorSharePercent: 50,
        referrerSharePercent: 5,
        grossCompanySharePercent: 50,
        netCompanySharePercent: 45,
      };

  const commissionAmountIQD = tx.amountIQD || 0;
  const commissionPercent = splits.referrerSharePercent;
  // بما أن العمولة مقتطعة من حصة أرباح الشركة
  const companyGrossShareIQD =
    commissionPercent > 0 ? Math.round(commissionAmountIQD / (commissionPercent / 100)) : 0;
  const installmentTotalProfitIQD =
    splits.grossCompanySharePercent > 0
      ? Math.round(companyGrossShareIQD / (splits.grossCompanySharePercent / 100))
      : companyGrossShareIQD * 2;
  const investorShareAmountIQD = Math.max(0, installmentTotalProfitIQD - companyGrossShareIQD);
  const netCompanyShareAmountIQD = Math.max(0, companyGrossShareIQD - commissionAmountIQD);

  return {
    txId: tx.id,
    referenceNo: tx.referenceNo || 'سند عمولة',
    date: tx.date,
    referrerId: referrer?.id,
    referrerName: referrer?.name || tx.investorName || 'الوسيط المحيل',
    referredInvestorId: referredInvestor?.id,
    referredInvestorName:
      referredInvestor?.name || matchedContract?.investorName || 'مستثمر محال',
    contractNumber: matchedContract?.contractNumber || '—',
    borrowerName: matchedContract?.borrowerName || tx.borrowerName || '—',
    itemName: matchedContract?.inventoryItemName || '—',
    commissionPercent,
    investorSharePercent: splits.investorSharePercent,
    netCompanySharePercent: splits.netCompanySharePercent,
    installmentTotalProfitIQD,
    investorShareAmountIQD,
    commissionAmountIQD,
    netCompanyShareAmountIQD,
    toWalletName: tx.toWalletName,
    description: tx.description,
  };
}

