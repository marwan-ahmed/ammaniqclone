import { LedgerTransaction } from '@/types/finance';

/**
 * Calculates the next sequential receipt number for investor cash withdrawals.
 * Ensures the sequence starts at 1, 2, 3, 4, and so on.
 */
export function getNextInvestorWithdrawalReceiptNumber(
  transactions?: LedgerTransaction[],
  resetEpoch?: string | null
): string {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return '1';
  }

  const epochDate = resetEpoch && !isNaN(Date.parse(resetEpoch))
    ? resetEpoch.split('T')[0]
    : null;

  // Filter transactions that represent investor cash withdrawals
  const withdrawalTxs = transactions.filter(
    (tx) => {
      if (epochDate && tx.date < epochDate) return false;
      return (
        tx.type === 'INVESTOR_WITHDRAWAL' ||
        (tx.type === 'PROFIT_DISTRIBUTION' && tx.investorId) ||
        (tx.type === 'EXPENSE' && tx.description?.includes('سحب')) ||
        tx.description?.includes('سحب نقدي') ||
        tx.description?.includes('سحب أرباح') ||
        tx.description?.includes('سحب من رأس المال')
      );
    }
  );

  const numericRefs: number[] = [];

  for (const tx of withdrawalTxs) {
    const rawRef = String(tx.referenceNo || '').trim();
    // Only accept pure positive integers (1, 2, 3, ...)
    if (/^\d+$/.test(rawRef)) {
      const num = parseInt(rawRef, 10);
      if (!isNaN(num) && num > 0) {
        numericRefs.push(num);
      }
    }
  }

  if (numericRefs.length > 0) {
    return String(Math.max(...numericRefs) + 1);
  }

  return '1';
}
