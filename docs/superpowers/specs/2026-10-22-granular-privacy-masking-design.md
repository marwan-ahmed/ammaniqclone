# Design Specification: Granular Item-Level Privacy Masking & Security Guard

**Date:** 2026-10-22  
**Project:** نظام أمان للتقسيط - سامراء (Aman Installments System)  
**Status:** Approved  

---

## 1. Executive Summary

This feature establishes an end-to-end, high-security **Privacy & Number Masking Engine** across all financial views and dashboards in the Aman Finance System. By default, every monetary and financial figure (capital, wallet balances, installment totals, debts, profits, expenses, revenues) is masked with asterisks/dots (`•••••••• د.ع` or `******`). To reveal any figure, an operator must click an interactive eye icon (`Eye`) next to the specific item and enter a secure passcode. 

Crucially, entering the passcode reveals **only the targeted item/number**, keeping all other financial figures across the screen strictly masked and private. Furthermore, the passcode and auto-hide duration (e.g. 15s, 30s, 60s, 120s, or manual) are fully configurable through the System Settings (`SettingsView.tsx`), persisted to Neon PostgreSQL and synced to local storage.

---

## 2. Core Architectural Components

### 2.1 Central Privacy Context (`src/context/PrivacyContext.tsx`)
A dedicated React context providing application-wide privacy state:
- `isMaskedByDefault`: Boolean (always `true` on entry).
- `unlockedItemIds`: `Record<string, number>` mapping unlocked item IDs to their auto-lock expiration timestamps (`Date.now() + durationMs`).
- `unlockItem(id: string, enteredPasscode: string): { success: boolean; message?: string }`: Validates passcode against the active `privacyPasscode` and unlocks the single item.
- `lockItem(id: string): void`: Immediately relocks the target item.
- `lockAll(): void`: Immediately relocks all currently unlocked items.
- `isItemUnlocked(id: string): boolean`: Returns true if item is present in map and timestamp > `Date.now()`.
- `privacyPasscode`: String, default `'2026'` (synced from `SimulationStore` / `system_settings`).
- `autoHideSeconds`: Number, default `30` seconds.
- `setPrivacySettings(passcode: string, autoHideSeconds: number): Promise<boolean>`: Updates state, `localStorage`, and calls `/api/settings` to persist to Neon PostgreSQL.
- Auto-clean timer effect: Checks every 1,000ms to prune expired IDs, automatically re-masking figures.

### 2.2 Reusable UI Component (`src/components/common/PrivacyMaskedAmount.tsx`)
A universal, ergonomic component replacing raw number displays:
- Props:
  - `id`: string (Unique scoped identifier, e.g. `header-company-balance`, `investor-cap-${id}`, `inv-row-${id}`)
  - `value`: number | string | React.ReactNode (The raw unmasked content)
  - `currency?: string` (Optional suffix, defaults to `د.ع`)
  - `formatter?: (val: number) => string` (Defaults to `formatNumber` or `formatIQD`)
  - `className?: string` (Custom styling classes)
  - `size?: 'sm' | 'md' | 'lg' | 'xs'`
  - `inline?: boolean`
- Behavior:
  - When locked: Displays `•••••••• د.ع` with an interactive eye icon button (`<Eye className="w-3.5 h-3.5" />`).
  - Clicking the locked eye icon triggers the lightweight Passcode Modal targeted to `id`.
  - When unlocked: Renders the unmasked value alongside an active eye icon (`<EyeOff className="w-3.5 h-3.5 text-emerald-400" />`) and a subtle countdown indicator.
  - Clicking the unlocked eye icon immediately relocks it back to `••••••••`.

### 2.3 Lightweight Passcode Dialog (`src/components/common/ItemPrivacyPasscodeModal.tsx`)
- Sleek, focused modal that requests the privacy passcode:
  - Header displays the item label/context.
  - Auto-focused PIN input with numeric/password mask.
  - Quick submit on `Enter` key or clicking "تأكيد فك الحجب".
  - Clear error feedback if passcode is incorrect.
  - Closes on `Escape` key or backdrop click.

---

## 3. Settings Integration (`SettingsView.tsx`)

In `SettingsView.tsx`, a new dedicated card **"إعدادات خصوصية الأرقام المالية والحماية"**:
1. **رمز مرور فك الحجب (Privacy Passcode):**
   - View/update the passcode with current passcode confirmation.
2. **المهلة الزمنية للإخفاء التلقائي (Auto-Lock Duration):**
   - Dropdown options:
     - 15 ثانية (أعلى درجات الحذر)
     - 30 ثانية (الافتراضي والمتوازن)
     - 60 ثانية (دقيقة واحدة)
     - 120 ثانية (دقيقتان)
     - 0 (إلغاء المؤقت - إغلاق يدود فقط)
3. **مفتاح قفل فوري شامل (Global Quick Lock):**
   - One-click button in the header and settings to reset all unlocked items immediately.
4. **Backend Sync:**
   - Saved to Neon DB `system_settings` table (`privacy_passcode` and `privacy_auto_hide_seconds`).
   - Synced to `SimulationStore` and cached in `localStorage` under `aman_finance_live_cache`.

---

## 4. Screen-by-Screen Coverage

1. **Header (`Header.tsx`):**
   - Company Balance (`header-company-wallet`)
   - Total Investors Capital (`header-investors-capital`)
   - Quick "قفل الكل" (Lock All) button when any items are unlocked.
2. **Dashboard (`DashboardView.tsx`):**
   - Main KPI cards (Total Capital, Available Liquidity, Active Debts, Total Profits, Expected Monthly Collection).
3. **Investors (`InvestorsView.tsx`):**
   - Summary cards (Total Deposited, Total Liquidity, Total Profits).
   - Investor rows (Capital, Liquidity, Profit Share, Paid Profit).
4. **Company Fund (`CompanyFundView.tsx`):**
   - Cash Balance, Accumulated Profits, Withdrawals, Direct Debt Collections.
5. **Borrowers & Contracts (`BorrowersView.tsx` & `InvoicesView.tsx`):**
   - Contract values, down payments, monthly installment amounts, remaining balances.
6. **Funds & Inventory (`FundsView.tsx` & `InventoryView.tsx`):**
   - Fund balances, inventory purchase costs, valuation totals.
7. **Reports & Ledgers (`ReportsView.tsx` & `DebtLedgerView.tsx`):**
   - P&L statements, income, operating expenses, debt ledger amounts.

---

## 5. Security & Verification Strategy

- Zero data leakage: Masking happens at render time with granular item tracking.
- Automated tests in `src/tests/privacy_masking.test.ts`:
  1. Default masked behavior verification.
  2. Granular unmasking (unlocking item A does NOT unlock item B).
  3. Incorrect passcode rejection.
  4. Auto-lock expiration timing and cleanup.
  5. Settings persistence and update validation.
