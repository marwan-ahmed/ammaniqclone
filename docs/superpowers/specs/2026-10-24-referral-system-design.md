# Design Specification: Investor & Partner Referral System (نظام الإحالة والعمولات)

**Date:** 2026-10-24  
**Project:** نظام أمان للتقسيط - سامراء (Aman Installments System)  
**Status:** Approved by User  

---

## 1. Executive Summary

This feature introduces a comprehensive, transparent, and mathematically rigorous **Affiliate & Referral System (نظام الإحالة وعمولات المستثمرين)** into the Aman Installments ERP. 

It allows any person—whether an active capital-depositing investor (like "خالد") or an external referral partner without capital—to bring new investors (e.g., "بشير", "سعيد", "رعد") into the company. The referral commission percentage is deducted from the **Company's profit share** on the referred investor's contracts and credited directly and automatically into the referrer's independent cash wallet upon installment payment.

The system ensures complete commercial privacy, 100% exact dinar conservation, full audit ledger integration, transparent statements, and seamless printing and export.

---

## 2. Business & Financial Rules

### 2.1 The Profit Split Model

For any installment contract funded by a referred investor:
1. **Contract Profit Margin:** $\text{Profit} = \text{Total Sale Price} - \text{Item Cost Price}$.
2. **Referred Investor Agreement:** Contract has an agreed investor profit percent $\text{Inv}\%$ and contractual company percent $\text{Comp}\%$, where:
   $$\text{Inv}\% + \text{Comp}\% = 100\%$$
3. **Referral Agreement:** The company agrees to allocate a referral commission percent $\text{Ref}\%$ to the referrer from its share:
   - **Referred Investor Share:** $\text{Inv}\%$ (remains unchanged and protected).
   - **Referrer Commission Share:** $\text{Ref}\%$.
   - **Net Company Profit Share:** $\text{CompNet}\% = \text{Comp}\% - \text{Ref}\%$.
   - **Constraint:** $\text{CompNet}\% \ge 0\%$.

### 2.2 Mathematical Walkthrough (User's Example)

- **خالد (Referrer):**
  - Khalid's direct investments contract: 40% Khalid / 60% Company.
- **بشير (Referred by Khalid):**
  - Bashir's contract: 50% Bashir / 50% Company.
  - Referral agreement: 5% to Khalid from Company's share.
  - Actual split on Bashir's contracts:
    - بشير: 50%
    - خالد (إحالة): 5%
    - الشركة (صافي): 45%
- **سعيد (Referred by Khalid):**
  - Saeed's contract: 40% Saeed / 60% Company.
  - Referral agreement: 7% to Khalid from Company's share.
  - Actual split on Saeed's contracts:
    - سعيد: 40%
    - خالد (إحالة): 7%
    - الشركة (صافي): 53%
- **رعد (Referred by Khalid):**
  - Raad's contract: 60% Raad / 40% Company.
  - Referral agreement: 3% to Khalid from Company's share.
  - Actual split on Raad's contracts:
    - رعد: 60%
    - خالد (إحالة): 3%
    - الشركة (صافي): 37%
- **خالد's Total Statement & Combined Portfolio:**
  - On his own contracts: خالد earns his direct 40%.
  - On referred contracts: خالد earns 5% from بشير + 7% from سعيد + 3% from رعد.
  - Total effective yield / earnings pool for خالد: $40\% + 5\% + 7\% + 3\% = 55\%$.

### 2.3 Non-Investor Referrers (شركاء الإحالة الخارجيين)
- An external partner who does not deposit capital can be registered as an `Affiliate / Referral Partner` (شريك إحالة).
- An independent cash wallet (`wallets`) is created for them with initial balance `0 د.ع`.
- As installments for their referred investors are collected, their cash wallet accumulates commissions automatically.
- They can withdraw their cash liquidity at any time with official disbursement receipts (`CompanyWithdrawalModal` / `withdrawInvestorFunds`).

### 2.4 Exact Dinar Conservation & Partial Payments
- Every installment schedule item distributes the principal, investor profit, referrer commission, and company profit with integer division and remainder distribution.
- Sum identity:
  $$\text{principalIQD} + \text{investorProfitIQD} + \text{referrerProfitIQD} + \text{companyProfitIQD} = \text{amountIQD}$$
- In partial payment scenarios: the paid amount is allocated proportionally across principal and profit components, rolling over exact remaining differences to the next installment.

---

## 3. Data Model & Schema Modifications

### 3.1 Drizzle Schema (`src/db/schema.ts`)

```typescript
// In investorContracts table:
export const investorContracts = pgTable('investor_contracts', {
  // ... existing fields ...
  referrerId: uuid('referrer_id').references(() => investors.id),
  referrerSharePercent: numeric('referrer_share_percent', { precision: 5, scale: 2 }).default('0.00'),
});

// In installmentSchedules table:
export const installmentSchedules = pgTable('installment_schedules', {
  // ... existing fields ...
  referrerProfitShareIQD: numeric('referrer_profit_share_iqd', { precision: 18, scale: 2 }).notNull().default('0.00'),
});

// In txTypeEnum:
export const txTypeEnum = pgEnum('tx_type', [
  // ... existing types ...
  'REFERRAL_COMMISSION',
]);

// In ledgerTransactions table:
export const ledgerTransactions = pgTable('ledger_transactions', {
  // ... existing fields ...
  referrerId: uuid('referrer_id'),
  referrerProfitShareIQD: numeric('referrer_profit_share_iqd', { precision: 18, scale: 2 }),
});
```

### 3.2 Domain Types (`src/types/finance.ts`)

```typescript
export interface InvestorContract {
  // ... existing fields ...
  referrerId?: string;
  referrerName?: string;
  referrerSharePercent?: number; // e.g. 5.00 for 5%
}

export interface Investor {
  // ... existing fields ...
  isReferralPartner?: boolean;
  referredById?: string;
  referredByName?: string;
  referralSharePercent?: number;
  totalReferralCommissionsEarned?: number;
}

export interface InstallmentScheduleItem {
  // ... existing fields ...
  referrerProfitShareIQD?: number;
}
```

---

## 4. Accounting & Simulation Engine (`SimulationStore`)

1. **`addInvestor` / `updateInvestor`**:
   - Supports selecting a `referrerId` and configuring `referrerSharePercent`.
   - Flags whether an entity is a pure referral partner (`isReferralPartner`).
   - Automatically maintains `totalReferralCommissionsEarned`.
2. **`createContract`**:
   - Reads the investor's contract configuration to determine if a `referrerId` and `referrerSharePercent` exist.
   - Calculates `totalInvProfit`, `totalRefProfit`, and `totalCompProfit`:
     $$\text{totalInvProfit} = \text{round}(\text{profitMargin} \times (\text{investorSharePercent} / 100))$$
     $$\text{totalRefProfit} = \text{round}(\text{profitMargin} \times (\text{referrerSharePercent} / 100))$$
     $$\text{totalCompProfit} = \text{profitMargin} - \text{totalInvProfit} - \text{totalRefProfit}$$
   - Generates schedules where each schedule $i$ receives an exact share without dinar drift.
3. **`payInstallmentSchedule`**:
   - Credits the investor's wallet with `investorProfitShareIQD`.
   - If `referrerProfitShareIQD > 0` and `referrerId` exists:
     - Credits the referrer's wallet with `referrerProfitShareIQD`.
     - Increments the referrer's `totalProfitsEarned` / `totalReferralCommissionsEarned`.
     - Emits a `LedgerTransaction` with type `'REFERRAL_COMMISSION'`.
   - Credits the company wallet with `companyProfitShareIQD`.

---

## 5. UI/UX & Transparency

1. **Investor Creation & Edit Modal (`InvestorsView.tsx`)**:
   - New dedicated referral section:
     - Toggle: "تم جلبه بواسطة مُحيل / شريك إحالة؟"
     - Dropdown: Select Referrer (lists existing investors + referral partners).
     - Input: "نسبة عمولة الإحالة (%)" with live feedback showing the net company share.
2. **Investor Card & Overview**:
   - Displays referral badges (e.g. "مُحيل لـ 3 مستثمرين" or "مُحال بواسطة: خالد (5%)").
   - Filter to view "مستثمرون ممولون" or "وسطاء وشركاء إحالة".
3. **Transparent Investor Statement Modal (`InvestorStatementModal.tsx`)**:
   - Tab / Section: **"عمولات وأرباح الإحالة (Referral Commissions)"**.
   - Shows detailed table:
     - Date & Time.
     - Referred Investor Name (بشير / سعيد / رعد).
     - Contract Number & Item.
     - Installment #.
     - Referral Commission Amount (د.ع).
   - Summary card: Total referral earnings collected and effective combined percentage.
   - Official printable view and Excel export.

---

## 6. Testing & Quality Assurance

- **Mandatory Unit Tests (`src/tests/referral_system.test.ts`)**:
  - Full financial flow: Investor creation with referral partner -> contract generation -> dinar conservation -> installment payment -> wallet balance updates.
  - Partial payment and rollover preservation with referral share.
  - Cash withdrawal from commission wallet.
  - Validation: Ensure company net share cannot be negative.
- **Regression Suite:** All 75 existing tests in `src/tests/*.test.ts` must pass with zero failures.
- **Type Safety:** Clean compilation with `npx tsc --noEmit`.
