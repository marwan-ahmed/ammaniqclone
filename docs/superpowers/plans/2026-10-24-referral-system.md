# Investor & Partner Referral System (نظام الإحالة والعمولات) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an end-to-end Affiliate and Referral System (نظام الإحالة والعمولات) for active investors and external partners, deducting referral commission percentages from company profits upon installment collection and depositing them into dedicated wallets with full transparency, printing, and ledger tracking.

**Architecture:** 
- Extend database schema and domain types with backward-compatible referral fields (`referrerId`, `referrerSharePercent`, `referrerProfitShareIQD`).
- Implement exact dinar conservation calculation in `SimulationStore.createContract` and automated split distribution in `SimulationStore.payInstallmentSchedule`.
- Update API route handlers (`/api/investors`, `/api/contracts`, `/api/installments/pay`, `/api/dashboard`) for Neon PostgreSQL persistence.
- Add UI controls in `InvestorsView.tsx` for configuring referrers and build the dedicated referral commission tab and printout inside `InvestorStatementModal.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM, Neon PostgreSQL, Tailwind CSS 4, Node.js Test Runner (`node:test`, `tsx`).

## Global Constraints
- Preserve exact dinar conservation: `principalAmountIQD + investorProfitShareIQD + referrerProfitShareIQD + companyProfitShareIQD === amountIQD`.
- Zero tolerance for dinar drift across odd months.
- Commercial privacy: Referred investor contracts do not expose referrer commission cuts to the borrower or referred investor; commission is an internal company split.
- Strict English digits (Western Arabic 0-9) via `src/utils/formatters.ts`.
- Zero TypeScript compiler errors (`npx tsc --noEmit`).
- All existing 75 unit tests must remain passing.

---

### Task 1: Schema & Domain Types

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/types/finance.ts`
- Test: `src/tests/referral_system.test.ts`

**Interfaces:**
- Produces:
  - `investorContracts.referrerId`, `investorContracts.referrerSharePercent`
  - `installmentSchedules.referrerProfitShareIQD`
  - `txTypeEnum: 'REFERRAL_COMMISSION'`
  - `InvestorContract.referrerId`, `InvestorContract.referrerSharePercent`, `InvestorContract.referrerName`
  - `Investor.isReferralPartner`, `Investor.totalReferralCommissionsEarned`
  - `InstallmentScheduleItem.referrerProfitShareIQD`

- [ ] **Step 1: Write the failing test for schema and types**

Create `src/tests/referral_system.test.ts`:
```typescript
import assert from 'node:assert';
import { test, describe } from 'node:test';
import { InvestorContract, InstallmentScheduleItem, Investor } from '../types/finance';

describe('Referral System: Type Definitions and Contracts', () => {
  test('InvestorContract and InstallmentScheduleItem support referral fields', () => {
    const contract: InvestorContract = {
      id: 'inv-cnt-1',
      investorId: 'inv-bashir',
      investorSharePercent: 50,
      companySharePercent: 50,
      lossSharingPolicy: 'SHARED',
      contractDate: '2026-10-24',
      referrerId: 'inv-khalid',
      referrerName: 'خالد',
      referrerSharePercent: 5,
    };
    assert.strictEqual(contract.referrerSharePercent, 5);
    assert.strictEqual(contract.referrerId, 'inv-khalid');

    const schedule: InstallmentScheduleItem = {
      id: 'sch-1',
      contractId: 'cnt-1',
      installmentNumber: 1,
      dueDate: '2026-11-24',
      amountIQD: 100000,
      principalAmountIQD: 70000,
      profitAmountIQD: 30000,
      investorProfitShareIQD: 15000,
      referrerProfitShareIQD: 1500,
      companyProfitShareIQD: 13500,
      status: 'PENDING'
    };
    assert.strictEqual(schedule.referrerProfitShareIQD, 1500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/tests/referral_system.test.ts`  
Expected: FAIL (compilation error: `referrerSharePercent` does not exist on type `InvestorContract`).

- [ ] **Step 3: Update `src/types/finance.ts` and `src/db/schema.ts`**

In `src/types/finance.ts`:
Add `referrerId?: string; referrerName?: string; referrerSharePercent?: number;` to `InvestorContract`.
Add `isReferralPartner?: boolean; totalReferralCommissionsEarned?: number;` to `Investor`.
Add `referrerProfitShareIQD?: number;` to `InstallmentScheduleItem`.
Add `'REFERRAL_COMMISSION'` to `LedgerTransaction['type']`.

In `src/db/schema.ts`:
Add `referrerId: uuid('referrer_id').references(() => investors.id),`
Add `referrerSharePercent: numeric('referrer_share_percent', { precision: 5, scale: 2 }).default('0.00'),` to `investorContracts`.
Add `referrerProfitShareIQD: numeric('referrer_profit_share_iqd', { precision: 18, scale: 2 }).notNull().default('0.00'),` to `installmentSchedules`.
Add `'REFERRAL_COMMISSION'` to `txTypeEnum`.
Add `referrerId: uuid('referrer_id'),` and `referrerProfitShareIQD: numeric('referrer_profit_share_iqd', { precision: 18, scale: 2 }),` to `ledgerTransactions`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/tests/referral_system.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/finance.ts src/db/schema.ts src/tests/referral_system.test.ts
git commit -m "feat(referral): add referral schema and domain types"
```

---

### Task 2: Core Accounting Engine - Referral Contract Creation & Remainder Conservation

**Files:**
- Modify: `src/services/simulation.ts:1120-1185` (`createContract`)
- Test: `src/tests/referral_system.test.ts`

**Interfaces:**
- Consumes: `InvestorContract.referrerSharePercent`, `InvestorContract.referrerId`
- Produces: `InstallmentScheduleItem.referrerProfitShareIQD` with exact dinar conservation:
  `invShare + refShare + compShare === profitIQD`
  `principalIQD + profitIQD === amountIQD`

- [ ] **Step 1: Write the failing unit test for contract creation with referral**

Append to `src/tests/referral_system.test.ts`:
```typescript
test('SimulationStore.createContract calculates exact referral shares with zero dinar drift', () => {
  const store = new SimulationStore();

  // 1. Setup Khalid as Referrer
  const khalid = store.addInvestor({
    name: 'خالد المستثمر',
    phone: '07701111111',
    initialDepositIQD: 10000000,
    investorSharePercent: 40,
    companySharePercent: 60,
  });

  // 2. Setup Bashir as Referred Investor (Referred by Khalid with 5% commission)
  const bashir = store.addInvestor({
    name: 'بشير المستثمر',
    phone: '07702222222',
    initialDepositIQD: 10000000,
    investorSharePercent: 50,
    companySharePercent: 50,
    referrerId: khalid.id,
    referrerSharePercent: 5,
  });

  // 3. Add inventory item for Bashir
  const item = store.purchaseInventory({
    name: 'شاشة سامسونج 65 بوصة',
    category: 'إلكترونيات',
    investorId: bashir.id,
    quantity: 1,
    unitCostIQD: 1000000,
    targetSellingPriceIQD: 1300000,
  });

  // 4. Add borrower
  const borrower = store.addBorrower({
    name: 'عمر علي',
    phone: '07703333333',
    address: 'سامراء - شارع القاطول',
  });

  // 5. Create 10-month contract (Profit = 300,000 IQD)
  // Bashir 50% = 150,000 IQD (15,000/mo)
  // Khalid 5% = 15,000 IQD (1,500/mo)
  // Company net 45% = 135,000 IQD (13,500/mo)
  const contract = store.createContract({
    borrowerId: borrower.id,
    inventoryItemId: item.id,
    totalSalePriceIQD: 1300000,
    downPaymentIQD: 0,
    monthsCount: 10,
    startDate: '2026-11-01',
  });

  assert.strictEqual(contract.schedules.length, 10);

  let sumPrincipal = 0;
  let sumInvProfit = 0;
  let sumRefProfit = 0;
  let sumCompProfit = 0;

  contract.schedules.forEach((s) => {
    assert.strictEqual(s.amountIQD, s.principalAmountIQD + s.profitAmountIQD);
    assert.strictEqual(
      s.profitAmountIQD,
      s.investorProfitShareIQD + (s.referrerProfitShareIQD || 0) + s.companyProfitShareIQD
    );
    sumPrincipal += s.principalAmountIQD;
    sumInvProfit += s.investorProfitShareIQD;
    sumRefProfit += s.referrerProfitShareIQD || 0;
    sumCompProfit += s.companyProfitShareIQD;
  });

  assert.strictEqual(sumPrincipal, 1000000);
  assert.strictEqual(sumInvProfit, 150000); // 50%
  assert.strictEqual(sumRefProfit, 15000);  // 5% to Khalid
  assert.strictEqual(sumCompProfit, 135000); // 45% net to Company
  assert.strictEqual(sumInvProfit + sumRefProfit + sumCompProfit, 300000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/tests/referral_system.test.ts`  
Expected: FAIL (sumRefProfit is 0 because `createContract` doesn't calculate referral share yet).

- [ ] **Step 3: Update `addInvestor` and `createContract` in `src/services/simulation.ts`**

Update `addInvestor`: accept `referrerId?: string; referrerSharePercent?: number; isReferralPartner?: boolean;`.
Update `createContract`:
```typescript
const referrerId = investor?.contract?.referrerId;
const referrerSharePercent = investor?.contract?.referrerSharePercent || 0;

const totalInvProfit = isCompanyOwned ? 0 : Math.round(profitMarginIQD * (investorSharePercent / 100));
const totalRefProfit = (!isCompanyOwned && referrerId && referrerSharePercent > 0)
  ? Math.round(profitMarginIQD * (referrerSharePercent / 100))
  : 0;
const totalCompProfit = profitMarginIQD - totalInvProfit - totalRefProfit;
```
Distribute `remRef` remainder across schedules:
```typescript
const baseRef = Math.floor(totalRefProfit / months);
const remRef = totalRefProfit % months;
// ...
const refShare = baseRef + (i <= remRef ? 1 : 0);
```
Save `referrerProfitShareIQD: refShare` into each schedule item.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/tests/referral_system.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/simulation.ts src/tests/referral_system.test.ts
git commit -m "feat(referral): implement exact referral profit calculations in createContract"
```

---

### Task 3: Core Accounting Engine - Installment Repayment & Commission Credit

**Files:**
- Modify: `src/services/simulation.ts:160-350` (`payInstallmentSchedule`)
- Test: `src/tests/referral_system.test.ts`

**Interfaces:**
- Consumes: `InstallmentScheduleItem.referrerProfitShareIQD`, `investorContracts.referrerId`
- Produces:
  - Referrer wallet balance increase: `referrerWallet.balance += paidRefProfit`
  - Referrer `totalReferralCommissionsEarned += paidRefProfit`
  - `LedgerTransaction` (`type: 'REFERRAL_COMMISSION'`)

- [ ] **Step 1: Write the failing unit test for installment repayment and referral commission credit**

Append to `src/tests/referral_system.test.ts`:
```typescript
test('payInstallmentSchedule credits investor, referrer, and company wallet with ledger voucher', () => {
  const store = new SimulationStore();

  const khalid = store.addInvestor({
    name: 'خالد المستثمر',
    phone: '07701111111',
    initialDepositIQD: 5000000,
    investorSharePercent: 40,
    companySharePercent: 60,
  });

  const bashir = store.addInvestor({
    name: 'بشير المستثمر',
    phone: '07702222222',
    initialDepositIQD: 5000000,
    investorSharePercent: 50,
    companySharePercent: 50,
    referrerId: khalid.id,
    referrerSharePercent: 5,
  });

  const item = store.purchaseInventory({
    name: 'غسالة ال جي',
    category: 'أجهزة منزلية',
    investorId: bashir.id,
    quantity: 1,
    unitCostIQD: 1000000,
    targetSellingPriceIQD: 1300000,
  });

  const borrower = store.addBorrower({
    name: 'علي حسن',
    phone: '07704444444',
    address: 'سامراء',
  });

  const contract = store.createContract({
    borrowerId: borrower.id,
    inventoryItemId: item.id,
    totalSalePriceIQD: 1300000,
    downPaymentIQD: 0,
    monthsCount: 10,
    startDate: '2026-11-01',
  });

  const initialKhalidBal = store.wallets.find(w => w.ownerId === khalid.id)!.balance;
  const initialBashirBal = store.wallets.find(w => w.ownerId === bashir.id)!.balance;
  const initialCompanyBal = store.companyWallet.balance;

  // Pay first installment: Amount = 130,000 IQD
  // Principal = 100,000 (returns to Bashir)
  // Bashir Profit (50%) = 15,000 (to Bashir)
  // Khalid Referral (5%) = 1,500 (to Khalid)
  // Company Profit (45%) = 13,500 (to Company)
  const scheduleId = contract.schedules[0].id;
  store.payInstallmentSchedule(contract.id, scheduleId);

  const updatedKhalidWallet = store.wallets.find(w => w.ownerId === khalid.id)!;
  const updatedBashirWallet = store.wallets.find(w => w.ownerId === bashir.id)!;
  const updatedCompanyWallet = store.companyWallet;

  assert.strictEqual(updatedBashirWallet.balance, initialBashirBal + 100000 + 15000);
  assert.strictEqual(updatedKhalidWallet.balance, initialKhalidBal + 1500);
  assert.strictEqual(updatedCompanyWallet.balance, initialCompanyBal + 13500);

  // Check ledger transactions for REFERRAL_COMMISSION
  const refTx = store.transactions.find(t => t.type === 'REFERRAL_COMMISSION');
  assert.ok(refTx, 'Referral commission ledger transaction must exist');
  assert.strictEqual(refTx.amountIQD, 1500);
  assert.strictEqual(refTx.toWalletId, updatedKhalidWallet.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/tests/referral_system.test.ts`  
Expected: FAIL (Khalid balance did not increase by 1,500; no REFERRAL_COMMISSION transaction).

- [ ] **Step 3: Update `payInstallmentSchedule` in `src/services/simulation.ts`**

In `payInstallmentSchedule`:
1. Calculate `paidRefProfit` based on `sch.referrerProfitShareIQD`.
2. Locate `referrerId` from `investor.contract.referrerId`.
3. If `paidRefProfit > 0` and `referrerId`:
   - Credit `referrerWallet.balance += paidRefProfit`.
   - Update `referrer.totalProfitsEarned += paidRefProfit` and `referrer.totalReferralCommissionsEarned = (referrer.totalReferralCommissionsEarned || 0) + paidRefProfit`.
   - Record `LedgerTransaction` with:
     ```typescript
     this.transactions.unshift({
       id: `tx-ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
       referenceNo: `REF-${sch.installmentNumber}-${Date.now().toString().slice(-4)}`,
       date: paidDateStr,
       type: 'REFERRAL_COMMISSION',
       fromWalletId: this.companyWallet.id,
       fromWalletName: this.companyWallet.ownerName,
       toWalletId: referrerWallet.id,
       toWalletName: referrerWallet.ownerName,
       amountIQD: paidRefProfit,
       description: `عمولة إحالة (${referrerSharePercent}%) عن قسط رقم (${sch.installmentNumber}) للمستثمر (${investor.name}) - العقد ${contract.contractNumber}`
     });
     ```
4. Deduct `paidRefProfit` from `paidCompanyProfit` credited to `companyWallet.balance`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/tests/referral_system.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/simulation.ts src/tests/referral_system.test.ts
git commit -m "feat(referral): credit referral commissions and log ledger transaction upon installment payment"
```

---

### Task 4: Partial Payment & Rollover Engine with Referral Share

**Files:**
- Modify: `src/services/simulation.ts` (partial payment logic in `payInstallmentSchedule`)
- Test: `src/tests/referral_system.test.ts`

**Interfaces:**
- Consumes: `customPaidAmountIQD`
- Produces: Proportional `paidRefProfit`, `remainingRefProfit` rolled over to `nextSchedule.referrerProfitShareIQD`

- [ ] **Step 1: Write the failing unit test for partial payment with referral**

Append to `src/tests/referral_system.test.ts`:
```typescript
test('partial payment distributes referral share proportionally and rolls over difference', () => {
  const store = new SimulationStore();

  const khalid = store.addInvestor({
    name: 'خالد المستثمر',
    phone: '07701111111',
    initialDepositIQD: 1000000,
    investorSharePercent: 40,
    companySharePercent: 60,
  });

  const bashir = store.addInvestor({
    name: 'بشير المستثمر',
    phone: '07702222222',
    initialDepositIQD: 1000000,
    investorSharePercent: 50,
    companySharePercent: 50,
    referrerId: khalid.id,
    referrerSharePercent: 10, // 10% referral commission for clear math
  });

  const item = store.purchaseInventory({
    name: 'جهاز كهربائي',
    category: 'أجهزة',
    investorId: bashir.id,
    quantity: 1,
    unitCostIQD: 400000,
    targetSellingPriceIQD: 600000,
  });

  const borrower = store.addBorrower({
    name: 'سالم أحمد',
    phone: '07705555555',
    address: 'سامراء',
  });

  const contract = store.createContract({
    borrowerId: borrower.id,
    inventoryItemId: item.id,
    totalSalePriceIQD: 600000,
    downPaymentIQD: 0,
    monthsCount: 2,
    startDate: '2026-11-01',
  });

  // Schedule 1: Amount = 300,000 (Principal = 200,000, Profit = 100,000)
  // Inv profit = 50,000, Ref profit = 10,000, Comp profit = 40,000
  // Partial payment: Customer pays only 150,000 (50% of schedule 1)
  const sch1 = contract.schedules[0];
  store.payInstallmentSchedule(contract.id, sch1.id, 150000);

  const updatedSch1 = contract.schedules.find(s => s.id === sch1.id)!;
  const updatedSch2 = contract.schedules.find(s => s.installmentNumber === 2)!;

  assert.strictEqual(updatedSch1.amountIQD, 150000);
  assert.strictEqual(updatedSch1.status, 'PAID');
  assert.strictEqual(updatedSch1.referrerProfitShareIQD, 5000); // 50% of 10,000

  // The remaining 5,000 referral profit rolls over to Schedule 2
  assert.strictEqual(updatedSch2.referrerProfitShareIQD, 15000); // original 10,000 + rolled over 5,000
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/tests/referral_system.test.ts`  
Expected: FAIL (rollover of `referrerProfitShareIQD` not yet handled).

- [ ] **Step 3: Update partial payment branch in `payInstallmentSchedule`**

In `src/services/simulation.ts`:
Calculate:
```typescript
let paidReferrerProfit = sch.referrerProfitShareIQD || 0;
let remainingReferrerProfit = 0;

if (isPartialPayment) {
  const ratio = Math.max(0, Math.min(1, targetAmount / originalAmount));
  paidReferrerProfit = Math.min(sch.referrerProfitShareIQD || 0, Math.round((sch.referrerProfitShareIQD || 0) * ratio));
  remainingReferrerProfit = (sch.referrerProfitShareIQD || 0) - paidReferrerProfit;
}
```
Add `remainingReferrerProfit` to `nextSchedule.referrerProfitShareIQD` or create an extension installment if on the final installment.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/tests/referral_system.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/simulation.ts src/tests/referral_system.test.ts
git commit -m "feat(referral): support referral commission rollover on partial installment payments"
```

---

### Task 5: API Handlers & Neon DB Sync

**Files:**
- Modify: `src/app/api/investors/route.ts`
- Modify: `src/app/api/contracts/route.ts`
- Modify: `src/app/api/installments/pay/route.ts`
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `src/app/page.tsx` (`fetchLiveData`, `handleAddInvestor`, `handleCreateContract`, `handlePayInstallment`)

**Interfaces:**
- Synchronizes referral data between `SimulationStore` and Neon PostgreSQL tables (`investor_contracts`, `installment_schedules`, `wallets`, `ledger_transactions`).

- [ ] **Step 1: Update `/api/investors/route.ts` to accept and persist `referrerId` and `referrerSharePercent`**

In `src/app/api/investors/route.ts`:
Save `referrerId` and `referrerSharePercent` into `investorContracts` insert/update.
Support creating an investor with `isReferralPartner: true`.

- [ ] **Step 2: Update `/api/contracts/route.ts` to persist `referrerProfitShareIQD`**

In `src/app/api/contracts/route.ts`:
Fetch investor contract config to read `referrerId` and `referrerSharePercent`.
Save `referrerProfitShareIQD` into `installmentSchedules` insertion.

- [ ] **Step 3: Update `/api/installments/pay/route.ts`**

Credit the referrer wallet if `referrerProfitShareIQD > 0` and insert `REFERRAL_COMMISSION` transaction into Neon DB.

- [ ] **Step 4: Update `/api/dashboard/route.ts` and `src/app/page.tsx` mapping**

Ensure `fetchLiveData` in `page.tsx` maps `referrerId`, `referrerSharePercent`, `referrerProfitShareIQD`, and restores them into `store.investors` and `store.contracts`.

- [ ] **Step 5: Typecheck & Commit**

Run: `npx tsc --noEmit`  
Expected: 0 errors  
Commit:
```bash
git add src/app/api/ src/app/page.tsx
git commit -m "feat(referral): synchronize referral contracts and payments with Neon DB"
```

---

### Task 6: UI - Investor Creation & Referral Selection in `InvestorsView.tsx`

**Files:**
- Modify: `src/components/views/InvestorsView.tsx`

**Interfaces:**
- Adds UI in investor add/edit modal:
  - Toggle / Checkbox: "شريك إحالة فقط (دون رأس مال)؟"
  - Select Referrer: dropdown of potential referrers.
  - Input: "نسبة عمولة الإحالة (%)" with real-time feedback showing:
    - حصة المستثمر الممول: X%
    - عمولة المحيل: Y%
    - صافي ربح الشركة: (100 - X - Y)%
  - Badge on investor card: "المُحيل: [الاسم] (Y%)" or "مُحيل لـ [N] مستثمرين".
  - Filter tabs: "الكل", "مستثمرون ممولون", "شركاء إحالة".

- [ ] **Step 1: Add referral fields to `InvestorsView.tsx` state and modal**

Add `referrerId`, `referrerSharePercent`, and `isReferralPartner` to the state in `InvestorsView.tsx`.
Add form inputs in the modal with dynamic validation: ensure `investorSharePercent + referrerSharePercent <= 100`.

- [ ] **Step 2: Add badge and metrics to investor card**

Display referral commission stats on the card of referrers (e.g. Khalid's card shows total earned referral commissions and count of referred investors).

- [ ] **Step 3: Verify visually and run typecheck**

Run: `npx tsc --noEmit`  
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/views/InvestorsView.tsx
git commit -m "feat(referral): add referral management controls to InvestorsView"
```

---

### Task 7: UI & Reporting - Transparent Referral Statement, Printing & Export

**Files:**
- Modify: `src/components/common/InvestorStatementModal.tsx`
- Modify: `src/components/views/ReportsView.tsx`

**Interfaces:**
- In `InvestorStatementModal.tsx`:
  - New tab: **"أرباح الإحالة والعمولات"**.
  - Displays detailed table of all installments paid for referred investors (بشير، سعيد، رعد).
  - Summary KPI cards:
    - "إجمالي أرباح المحفظة المباشرة": X د.ع (40%)
    - "إجمالي عمولات الإحالة المكتسبة": Y د.ع (5% + 7% + 3%)
    - "العائد الكلي الموحد": (X + Y) د.ع (55%)
  - Printable layout and Excel export formatting.

- [ ] **Step 1: Update `InvestorStatementModal.tsx`**

Add referral earnings calculation and section. Show every installment payment that credited this investor's wallet with a referral commission.
Support printing and exporting to Excel.

- [ ] **Step 2: Update `ReportsView.tsx`**

Include referral commissions in P&L report under profit deductions.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`  
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/common/InvestorStatementModal.tsx src/components/views/ReportsView.tsx
git commit -m "feat(referral): add transparent referral earnings statement and reporting"
```

---

### Task 8: End-to-End Verification & Zero Regression Validation

**Files:**
- Test: `src/tests/*.test.ts`
- Test: Full app typecheck and lint

- [ ] **Step 1: Run complete test suite**

Run: `npx tsx --test src/tests/*.test.ts`  
Expected: All tests pass (75 original + all new referral tests, total ~80+ passing).

- [ ] **Step 2: Run strict TypeScript typecheck**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 3: Verification before completion**

Verify that all user requirements (Khalid 40% + Bashir 5% + Saeed 7% + Raad 3% = 55%, transparent statements, non-investor referrer support, exact dinar conservation, no hallucinated features) are 100% satisfied.

- [ ] **Step 4: Final Git Commit**

```bash
git commit -am "chore: complete end-to-end verification of referral system"
```
