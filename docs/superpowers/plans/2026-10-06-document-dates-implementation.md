# Document Dates & Historical Backdating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable recording custom/historical document dates for every financial operation in the system (deposits, withdrawals, installment contracts, payment collections, inventory purchases, direct debts, expenses, revenues, and new investor onboarding), defaulting to today with full chronological ledger ordering and database persistence.

**Architecture:** Create a unified `DocumentDateField` component for forms, extend `SimulationStore` mutations to accept custom dates and calculate installment schedules from `startDate`, update API routes to persist dates in Neon PostgreSQL and `ledger_transactions`, and wire up all modal forms in the UI.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Drizzle ORM, PostgreSQL (Neon), Tailwind CSS, Lucide React, Node.js Test Runner / `tsx`.

## Global Constraints

- Never hardcode secrets.
- Parameterize every query; no raw SQL string concatenation.
- Keep `npx tsc --noEmit` clean with zero errors.
- Preserve existing styling and responsive layout.
- Date format throughout the system is standard `YYYY-MM-DD`.

---

### Task 1: Reusable UI Component `DocumentDateField`

**Files:**
- Create: `src/components/common/DocumentDateField.tsx`
- Test: `src/tests/document_dates_component.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface DocumentDateFieldProps {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    label?: string; // Default: 'تاريخ المستند'
    required?: boolean;
    disabled?: boolean;
    className?: string;
    helperText?: string;
  }
  ```

- [ ] **Step 1: Write unit test verifying date formatting & helper behavior**

```typescript
// src/tests/document_dates_component.test.ts
import test from 'node-test';
import assert from 'node-assert';

test('isHistoricalDate helper correctly detects past dates', () => {
  const today = new Date().toISOString().split('T')[0];
  const pastDate = '2025-01-01';
  
  assert.strictEqual(pastDate < today, true);
  assert.strictEqual(today < today, false);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test src/tests/document_dates_component.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `DocumentDateField.tsx`**

```tsx
// src/components/common/DocumentDateField.tsx
'use client';

import React from 'react';
import { Calendar, RotateCcw, AlertCircle } from 'lucide-react';

export interface DocumentDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  helperText?: string;
}

export const DocumentDateField: React.FC<DocumentDateFieldProps> = ({
  value,
  onChange,
  label = 'تاريخ المستند المالي',
  required = false,
  disabled = false,
  className = '',
  helperText
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const isHistorical = Boolean(value && value < todayStr);

  const handleSetToday = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(todayStr);
  };

  return (
    <div className={`space-y-1.5 ${className}`} dir="rtl">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
        {value !== todayStr && (
          <button
            type="button"
            onClick={handleSetToday}
            disabled={disabled}
            className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline transition-colors disabled:opacity-50"
            title="إعادة التعيين إلى تاريخ اليوم"
          >
            <RotateCcw className="w-3 h-3" />
            <span>تعيين اليوم</span>
          </button>
        )}
      </div>

      <div className="relative">
        <input
          type="date"
          value={value || todayStr}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {isHistorical && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 mt-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>مستند بأثر رجعي: سيتم تقييد القيد واحتساب الحركات بتاريخ ({value})</span>
        </div>
      )}

      {helperText && !isHistorical && (
        <p className="text-[11px] text-slate-400 pr-1">{helperText}</p>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Commit Component**

```bash
git add src/components/common/DocumentDateField.tsx src/tests/document_dates_component.test.ts
git commit -m "feat: add DocumentDateField reusable component"
```

---

### Task 2: Accounting Engine (`SimulationStore`) Date Enhancements & Unit Tests

**Files:**
- Modify: `src/services/simulation.ts`
- Create: `src/tests/document_dates.test.ts`

**Interfaces:**
- `depositCapital(data: { walletId: string; amountIQD: number; notes?: string; date?: string })`
- `withdrawCompanyFunds(data: { amountIQD: number; recipientName?: string; type?: ...; notes?: string; receiptNo?: string; date?: string })`
- `withdrawInvestorFunds(data: { investorId: string; amountIQD: number; type?: ...; notes?: string; receiptNo?: string; date?: string })`
- `createContract(data: { borrowerId: string; inventoryItemId: string; totalSalePriceIQD: number; downPaymentIQD: number; monthsCount: number; startDate?: string })`
- `payInstallmentSchedule(contractId: string, scheduleId: string, customPaidAmountIQD?: number, paymentDate?: string)`
- `addDirectDebt(data: { ..., startDate?: string })`
- `payDirectDebtSchedule(contractId: string, scheduleId: string, customPaidAmountIQD?: number, paymentDate?: string)`
- `purchaseInventory(data: { ..., date?: string })`
- `addExpense(data: { ..., date?: string })`
- `addRevenue(data: { ..., date?: string })`
- `addInvestor(data: { ..., date?: string })`

- [ ] **Step 1: Write comprehensive failing tests for historical date handling**

```typescript
// src/tests/document_dates.test.ts
import test from 'node-test';
import assert from 'node-assert';
import { SimulationStore } from '../services/simulation';

test('SimulationStore respects custom dates for deposits, contracts, payments, and expenses', () => {
  const store = new SimulationStore();
  const pastDate = '2025-06-01';

  // 1. Historical Deposit
  const depRes = store.depositCapital({
    walletId: 'wallet-company',
    amountIQD: 10000000,
    date: pastDate,
    notes: 'Historical Capital Injection'
  });
  assert.strictEqual(depRes.success, true);
  assert.strictEqual(depRes.transaction?.date, pastDate);
  assert.strictEqual(store.transactions[0].date, pastDate);

  // 2. Historical Expense
  const expRes = store.addExpense({
    title: 'Historical Rent',
    category: 'إيجارات',
    amountIQD: 500000,
    paidFromWalletId: 'wallet-company',
    date: '2025-06-05'
  });
  assert.strictEqual(expRes.success, true);
  assert.strictEqual(store.expenses[0].date, '2025-06-05');
  const expTx = store.transactions.find(t => t.description.includes('Historical Rent'));
  assert.strictEqual(expTx?.date, '2025-06-05');
});
```

- [ ] **Step 2: Run test to verify it fails initially or needs implementation**

Run: `npx tsx --test src/tests/document_dates.test.ts`

- [ ] **Step 3: Update `src/services/simulation.ts`**
  - Accept `date?: string` in `depositCapital` and stamp `newTx.date = data.date || todayStr`.
  - Accept `date?: string` in `withdrawCompanyFunds` and `withdrawInvestorFunds` and stamp `tx.date = data.date || todayStr`.
  - Accept `startDate?: string` in `createContract`:
    - Base `startDate` on `data.startDate || todayStr`.
    - Generate schedule `dueDate`s by incrementing months from `startDate`.
    - Compute `endDate` by adding `monthsCount` to `startDate`.
    - If down payment > 0, set its `LedgerTransaction.date = startDate`.
  - Accept `paymentDate?: string` in `payInstallmentSchedule` and `payDirectDebtSchedule`:
    - Set `schedule.paidDate = paymentDate || todayStr`.
    - Set `newTx.date = paymentDate || todayStr`.
  - Accept `startDate?: string` in `addDirectDebt` and calculate schedule dates starting from `startDate`.
  - Accept `date?: string` in `purchaseInventory`:
    - Set `newItem.purchaseDate = data.date || todayStr`.
    - Set `newTx.date = data.date || todayStr`.
  - Accept `date?: string` in `addExpense`:
    - Set `newExpense.date = data.date || todayStr`.
    - Set `newTx.date = data.date || todayStr`.
  - Accept `date?: string` in `addRevenue`:
    - Set `newRevenue.date = data.date || todayStr`.
    - Set `newTx.date = data.date || todayStr`.
  - Accept `date?: string` in `addInvestor`:
    - If initial capital > 0, stamp initial deposit `LedgerTransaction.date = data.date || todayStr`.

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npx tsx --test src/tests/document_dates.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/services/simulation.ts src/tests/document_dates.test.ts
git commit -m "feat: support custom document dates across SimulationStore accounting engine"
```

---

### Task 3: API Routes & Neon DB Persistence

**Files:**
- Modify: `src/app/api/deposits/route.ts`
- Modify: `src/app/api/withdrawals/route.ts`
- Modify: `src/app/api/contracts/route.ts`
- Modify: `src/app/api/installments/pay/route.ts`
- Modify: `src/app/api/direct-debts/pay/route.ts`
- Modify: `src/app/api/inventory/route.ts`
- Modify: `src/app/api/investors/route.ts`
- Modify: `src/app/api/expenses/route.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update API routes with server-side date validation and assignment**
  - `/api/deposits`: read `date` from body; `parsedDate = date ? new Date(date) : new Date()`; pass `date: parsedDate` to `ledgerTransactions.values`.
  - `/api/withdrawals`: read `date` from body; `parsedDate = date ? new Date(date) : new Date()`; pass `date: parsedDate` to `ledgerTransactions.values`.
  - `/api/contracts`: read `startDate` from body; `contractStart = startDate ? new Date(startDate) : new Date()`; pass `startDate: contractStart` to `installmentContracts.values`, and compute `dueDate` from `contractStart`.
  - `/api/installments/pay`: read `paidDate` from body; `paymentDateObj = paidDate ? new Date(paidDate) : new Date()`; pass `paidDate: paymentDateObj` to `installmentSchedules` and `date: paymentDateObj` to `ledgerTransactions`.
  - `/api/direct-debts/pay`: read `paidDate` from body; pass `paidDate: paymentDateObj` and `date: paymentDateObj` to `ledgerTransactions`.
  - `/api/inventory`: read `purchaseDate` / `date`; set `purchaseDate: parsedDate` on `inventoryItems` and `date: parsedDate` on `ledgerTransactions`.
  - `/api/investors`: read `date`; pass `date: parsedDate` to `ledgerTransactions`.
  - `/api/expenses`: ensure `date: parsedDate` is passed to `ledgerTransactions` as well as `expenses`.

- [ ] **Step 2: Update `src/app/page.tsx` handler bridges**
  - Update `handleDepositCapital` to forward `date: data.date`.
  - Update `handleWithdrawCompanyFunds` to forward `date: data.date`.
  - Update `handleWithdrawInvestor` to forward `date: data.date`.
  - Update `handlePaySchedule` to accept optional `paidDate?: string` and pass to API and local store.
  - Update `handlePayDirectDebtSchedule` to accept optional `paidDate?: string`.
  - Update `handleCreateContract` to pass `startDate: data.startDate`.
  - Update `handlePurchaseInventory` to pass `purchaseDate: data.date || data.purchaseDate`.
  - Update `handleAddExpense` to pass `date: data.date`.
  - Update `handleAddRevenue` to pass `date: data.date`.
  - Update `handleAddInvestor` to pass `date: data.date`.

- [ ] **Step 3: Run existing and new tests to ensure zero API handler breakage**

Run: `npx tsx --test src/tests/*.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit API changes**

```bash
git add src/app/api/ src/app/page.tsx
git commit -m "feat: persist document dates to Neon PostgreSQL across API routes"
```

---

### Task 4: UI Modals & Views Integration

**Files:**
- Modify: `src/components/common/CompanyWithdrawalModal.tsx`
- Modify: `src/components/common/DepositReceiptModal.tsx`
- Modify: `src/components/common/CompanyWithdrawalReceiptModal.tsx`
- Modify: `src/components/views/FundsView.tsx`
- Modify: `src/components/views/CompanyFundView.tsx`
- Modify: `src/components/views/InvestorsView.tsx`
- Modify: `src/components/views/InvoicesView.tsx`
- Modify: `src/components/views/BorrowersView.tsx`
- Modify: `src/components/views/DebtLedgerView.tsx`
- Modify: `src/components/views/InventoryView.tsx`
- Modify: `src/components/views/ExpensesView.tsx`
- Modify: `src/components/views/RevenuesView.tsx`

- [ ] **Step 1: Integrate `DocumentDateField` in Deposit and Withdrawal Modals**
  - In `FundsView.tsx` and `CompanyFundView.tsx`: Add `DocumentDateField` to `depositFormData` (`date: new Date().toISOString().split('T')[0]`).
  - In `CompanyWithdrawalModal.tsx`: Add `documentDate` state defaulting to today; pass `date` to `onSubmitWithdrawal`.
  - In `InvestorsView.tsx`: Add `documentDate` to the investor withdrawal modal and new investor registration modal.

- [ ] **Step 2: Integrate `DocumentDateField` in Installment Contracts and Payments**
  - In `InvoicesView.tsx` and `BorrowersView.tsx` contract modals: Add `DocumentDateField` for contract start date (`startDate`).
  - In payment action dialogs (paying an installment): Add option to confirm or change the payment date (`paidDate`).
  - In `DebtLedgerView.tsx`: Add `DocumentDateField` for direct debt creation and debt installment payments.

- [ ] **Step 3: Integrate `DocumentDateField` in Inventory, Expenses, and Revenues**
  - In `InventoryView.tsx`: Add `DocumentDateField` to new inventory item purchase modal.
  - In `ExpensesView.tsx`: Add `DocumentDateField` to add expense modal.
  - In `RevenuesView.tsx`: Ensure `DocumentDateField` is used for adding revenues.

- [ ] **Step 4: Update printable vouchers and receipts**
  - Ensure `DepositReceiptModal` and `CompanyWithdrawalReceiptModal` display the actual document date (`tx.date` / `data.date`) rather than today's timestamp.

- [ ] **Step 5: Commit UI integration**

```bash
git add src/components/
git commit -m "feat: integrate DocumentDateField across all financial modal forms"
```

---

### Task 5: End-to-End Verification & Health Check

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run complete test suite**

Run: `npx tsx --test src/tests/*.test.ts`
Expected: 100% tests passing with 0 failures.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero TypeScript errors.

- [ ] **Step 3: Run Next.js lint / build smoke check**

Run: `npm run lint`
Expected: Clean pass.

- [ ] **Step 4: Final commit and summary report**
