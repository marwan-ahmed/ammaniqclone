# Privacy Toggle & Confidential Names Masking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a prominent show/hide data toggle button across every screen, mask confidential names (borrowers, guarantors, investors, partners) alongside numbers, and ensure settings persist the choice (manual vs timer) in Neon PostgreSQL and browser cache.

**Architecture:** Centralized state in `PrivacyContext` providing `isAllRevealed`, `remainingSeconds`, and item-level unlocking. Reusable `<PrivacyToggleButton />` for view headers and `<PrivacyMaskedText />` for confidential names. Settings persistence in `system_settings` table via `/api/settings`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Lucide React, Drizzle ORM, Neon PostgreSQL.

---

## Global Constraints

- Preserve all existing functionality, styles, and currency formatters.
- Zero TypeScript and ESLint errors (`npx tsc --noEmit`).
- No hardcoded secrets; use existing adminPasscode or default '2026'.
- Sensitive fields stripped or masked on render when privacy is active.
- Edits must be surgical, preserving existing event handlers and table structures.

---

### Task 1: Extend Privacy Types and `PrivacyContext`

**Files:**
- Modify: `src/types/privacy.ts`
- Modify: `src/context/PrivacyContext.tsx`
- Test: `src/tests/privacy_masking.test.ts`

**Interfaces:**
- Consumes: `PrivacyContextType`, `validateAndUnlock`, `relockItem` from `src/types/privacy.ts`
- Produces: `remainingSeconds: number | null`, `isAllRevealed: boolean`, `requestRevealAll: () => void`, `lockAll: () => void` in `usePrivacy()`

- [ ] **Step 1: Write test for PrivacyContext remainingSeconds and manual mode in `src/tests/privacy_masking.test.ts`**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Update `src/types/privacy.ts` to include `remainingSeconds: number | null` in `PrivacyContextType`**
- [ ] **Step 4: Update `src/context/PrivacyContext.tsx` to calculate `remainingSeconds` dynamically and manage 0 (manual mode) vs >0 (timer mode)**
- [ ] **Step 5: Run tests and verify they pass**
- [ ] **Step 6: Commit changes with git**

---

### Task 2: Create Reusable `<PrivacyMaskedText />` Component

**Files:**
- Create: `src/components/common/PrivacyMaskedText.tsx`
- Test: `src/tests/privacy_masking.test.ts`

**Interfaces:**
- Consumes: `usePrivacy` from `@/context/PrivacyContext`
- Produces: `<PrivacyMaskedText id="..." value="..." label="..." />`

- [ ] **Step 1: Write unit test for `PrivacyMaskedText` behavior (masked `••••••••` vs unmasked name)**
- [ ] **Step 2: Create `src/components/common/PrivacyMaskedText.tsx` supporting `id`, `value`, `label`, `maskString`, `size`, `hideIcon`, `iconPosition`**
- [ ] **Step 3: Run test to verify it passes**
- [ ] **Step 4: Commit changes with git**

---

### Task 3: Create Reusable `<PrivacyToggleButton />` Component

**Files:**
- Create: `src/components/common/PrivacyToggleButton.tsx`
- Modify: `src/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `usePrivacy` (`isAllRevealed`, `remainingSeconds`, `autoHideSeconds`, `requestRevealAll`, `lockAll`)
- Produces: `<PrivacyToggleButton />`

- [ ] **Step 1: Create `src/components/common/PrivacyToggleButton.tsx` with emerald "إظهار البيانات" and rose "إخفاء البيانات" states + badges for `(يدوي)` or `(متبقي X ثانية)`**
- [ ] **Step 2: Integrate `PrivacyToggleButton` into `src/components/layout/Header.tsx` replacing inline toggle**
- [ ] **Step 3: Verify TypeScript builds cleanly**
- [ ] **Step 4: Commit changes with git**

---

### Task 4: Verify & Harden Settings Persistence (Manual vs Timer)

**Files:**
- Modify: `src/components/views/SettingsView.tsx`
- Modify: `src/app/api/settings/route.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `POST /api/settings` with `autoHideSeconds: number`
- Produces: Persisted settings in Neon Postgres `system_settings` table and `aman_finance_live_cache`

- [ ] **Step 1: Ensure `SettingsView.tsx` handles setting `selectedDuration` to 0 (يدوي فقط) without requiring PIN change**
- [ ] **Step 2: Ensure `/api/settings` cleanly accepts `autoHideSeconds: 0` without fallback to 30**
- [ ] **Step 3: Ensure `src/app/page.tsx` passes `initialAutoHideSeconds` correctly to `PrivacyProvider` when value is 0**
- [ ] **Step 4: Test saving 0 and reloading to verify persistence**
- [ ] **Step 5: Commit changes with git**

---

### Task 5: Integrate Privacy Toggle and Name Masking into Primary Views

**Files:**
- Modify: `src/components/views/DashboardView.tsx`
- Modify: `src/components/views/InvoicesView.tsx`
- Modify: `src/components/views/BorrowersView.tsx`
- Modify: `src/components/views/InvestorsView.tsx`

**Interfaces:**
- Consumes: `<PrivacyToggleButton />`, `<PrivacyMaskedText />`, `<PrivacyMaskedAmount />`

- [ ] **Step 1: In `DashboardView.tsx`, add `PrivacyToggleButton` in top banner and mask overdue borrower names and remaining numbers**
- [ ] **Step 2: In `InvoicesView.tsx`, add `PrivacyToggleButton` in toolbar and mask borrower & investor names with `PrivacyMaskedText`**
- [ ] **Step 3: In `BorrowersView.tsx`, add `PrivacyToggleButton` in toolbar and mask borrower & guarantor names and confidential debts**
- [ ] **Step 4: In `InvestorsView.tsx`, add `PrivacyToggleButton` in toolbar and mask investor names and balances**
- [ ] **Step 5: Test TypeScript compilation and commit**

---

### Task 6: Integrate Privacy Toggle and Name Masking into Secondary Views

**Files:**
- Modify: `src/components/views/ReferralsView.tsx`
- Modify: `src/components/views/FundsView.tsx`
- Modify: `src/components/views/CompanyFundView.tsx`
- Modify: `src/components/views/InventoryView.tsx`
- Modify: `src/components/views/OverdueView.tsx`
- Modify: `src/components/views/CreditScoreView.tsx`
- Modify: `src/components/views/DebtLedgerView.tsx`
- Modify: `src/components/views/ReportsView.tsx`
- Modify: `src/components/views/ExpensesView.tsx`
- Modify: `src/components/views/RevenuesView.tsx`
- Modify: `src/components/views/EmployeesView.tsx`
- Modify: `src/components/views/TrashView.tsx`

**Interfaces:**
- Consumes: `<PrivacyToggleButton />`, `<PrivacyMaskedText />`, `<PrivacyMaskedAmount />`

- [ ] **Step 1: Add `PrivacyToggleButton` to header/toolbar of `ReferralsView`, `FundsView`, `CompanyFundView`, and `InventoryView`**
- [ ] **Step 2: Add `PrivacyToggleButton` to header/toolbar of `OverdueView`, `CreditScoreView`, `DebtLedgerView`, and `ReportsView`**
- [ ] **Step 3: Add `PrivacyToggleButton` to header/toolbar of `ExpensesView`, `RevenuesView`, `EmployeesView`, and `TrashView`**
- [ ] **Step 4: Wrap confidential names with `<PrivacyMaskedText />` in each view's tables and lists**
- [ ] **Step 5: Verify all views build without type errors**
- [ ] **Step 6: Commit changes with git**

---

### Task 7: Comprehensive Verification & Regression Testing

**Files:**
- Modify: `src/tests/privacy_masking.test.ts`

- [ ] **Step 1: Add end-to-end unit tests covering all masking and toggle permutations**
- [ ] **Step 2: Run test suite via `npm test` or direct test runner**
- [ ] **Step 3: Run production typecheck `npx tsc --noEmit`**
- [ ] **Step 4: Final commit and summary report**
