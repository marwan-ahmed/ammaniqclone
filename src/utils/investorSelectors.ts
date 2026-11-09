import { Investor, Wallet } from '@/types/finance';

/**
 * Determines whether a record in `store.investors` is a pure Referral Broker (وسيط إحالة فقط)
 * rather than a Capital Investor (مستثمر برأس مال).
 */
export function isReferralBroker(investor: Investor | null | undefined): boolean {
  if (!investor) return false;
  if (investor.isReferralPartner === true) return true;
  const sharePercent = Number(investor.contract?.investorSharePercent ?? 60);
  const capital = Number(investor.totalCapitalDeposited ?? 0);
  return sharePercent === 0 && capital === 0;
}

/**
 * Returns ONLY actual capital investors (مستثمرين فعليين برؤوس أموال).
 * Excludes pure referral brokers so they never appear in InvestorsView, InventoryView,
 * InvoicesView, BorrowersView, or FundsView capital portfolios.
 */
export function getCapitalInvestors(investors: Investor[] = []): Investor[] {
  return investors.filter((inv) => !isReferralBroker(inv));
}

/**
 * Returns ONLY pure referral brokers (وسطاء الإحالة فقط).
 */
export function getReferralBrokers(investors: Investor[] = []): Investor[] {
  return investors.filter((inv) => isReferralBroker(inv));
}

/**
 * Returns all eligible referrers (brokers first, plus any existing investor who has already referred someone)
 * for selection when registering a new capital investor.
 */
export function getEligibleReferrers(investors: Investor[] = []): Investor[] {
  const brokers = getReferralBrokers(investors);
  const others = investors.filter((inv) => !isReferralBroker(inv));
  return [...brokers, ...others];
}

/**
 * Filters wallets to exclude pure referral broker commission wallets when displaying
 * capital investment funds in FundsView.
 */
export function getCapitalWallets(wallets: Wallet[] = [], investors: Investor[] = []): Wallet[] {
  return wallets.filter((w) => {
    if (w.ownerType === 'COMPANY') return true;
    if (w.ownerName && w.ownerName.includes('محفظة عمولات الإحالة')) return false;
    const owner = investors.find((i) => i.id === w.ownerId || i.walletId === w.id);
    if (owner && isReferralBroker(owner)) return false;
    return true;
  });
}

