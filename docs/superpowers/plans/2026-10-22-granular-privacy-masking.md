# Granular Privacy Masking & Security Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an application-wide, default-masked privacy system where all monetary figures are concealed with asterisks by default upon entering the system, and can only be individually revealed on a per-item basis by clicking an eye icon and entering a configurable security passcode, with configurable auto-lock duration in settings.

**Architecture:** A central React `PrivacyContext` maintains global default masking and a reactive dictionary of individually unlocked items (`itemId -> expiryTimestamp`). A reusable `<PrivacyMaskedAmount />` component guards every numeric display. Passcode and auto-hide duration are persisted in Neon PostgreSQL (`system_settings`) and `SimulationStore`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Drizzle ORM, Node test runner (`tsx --test`).

## Global Constraints
- Numbers on all screens must be masked by default upon entering the application (`•••••••• د.ع`).
- Entering the passcode must reveal ONLY the specifically selected number/item; no other number on the screen may be unlocked.
- Passcode and auto-lock duration must be configurable in `SettingsView.tsx` and persisted to Neon PostgreSQL and `localStorage`.
- Immediate relock must be available by clicking the active eye icon or via a "Lock All" button in the header.
- Zero TypeScript errors (`npx tsc --noEmit`), zero build errors (`npm run build`), and all unit tests must pass.

---

### Task 1: Privacy Engine Core Types & Pure Logic Unit Tests

**Files:**
- Create: `src/types/privacy.ts`
- Create: `src/tests/privacy_masking.test.ts`

**Interfaces:**
- `PrivacyState`: `{ isMaskedByDefault: boolean; unlockedItemIds: Record<string, number>; privacyPasscode: string; autoHideSeconds: number; }`
- Pure helper functions for testable lock/unlock/expiration math.

- [ ] **Step 1: Write the failing unit tests for privacy logic**

Create `src/tests/privacy_masking.test.ts` testing:
1. Item is locked by default.
2. Unlocking with correct passcode succeeds and registers target ID only.
3. Unlocking with incorrect passcode fails and does not register target ID.
4. Unlocking Item A does NOT unlock Item B.
5. Expiration check correctly marks item as expired after `autoHideSeconds`.
6. Manual relock removes item from unlocked map.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/tests/privacy_masking.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `src/types/privacy.ts`**

Define interfaces, defaults, and helper verification functions:
- `DEFAULT_PRIVACY_PASSCODE = '2026'`
- `DEFAULT_AUTO_HIDE_SECONDS = 30`
- `isItemActive(unlockedMap, id, currentTime)`
- `validateAndUnlock(unlockedMap, id, enteredPasscode, currentPasscode, autoHideSeconds)`
- `relockItem(unlockedMap, id)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/tests/privacy_masking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/privacy.ts src/tests/privacy_masking.test.ts
git commit -m "feat: add privacy engine types and unit test suite"
```

---

### Task 2: Central React Privacy Context (`PrivacyContext.tsx`)

**Files:**
- Create: `src/context/PrivacyContext.tsx`
- Modify: `src/tests/privacy_masking.test.ts`

**Interfaces:**
- Consumes: `src/types/privacy.ts`
- Produces: `PrivacyContext`, `PrivacyProvider`, `usePrivacy()` hook providing:
  - `isItemUnlocked(id: string): boolean`
  - `requestUnlock(id: string, label?: string): void`
  - `confirmUnlock(id: string, passcode: string): boolean`
  - `lockItem(id: string): void`
  - `lockAll(): void`
  - `privacyPasscode: string`
  - `autoHideSeconds: number`
  - `updatePrivacySettings(newPasscode: string, newAutoHideSeconds: number): Promise<boolean>`
  - `activePromptItem: { id: string; label?: string } | null`
  - `closePrompt(): void`

- [ ] **Step 1: Write context state logic with automatic cleanup interval**
- [ ] **Step 2: Sync with `localStorage` and `system_settings`**
- [ ] **Step 3: Run unit tests**
- [ ] **Step 4: Commit**

```bash
git add src/context/PrivacyContext.tsx
git commit -m "feat: implement central PrivacyProvider with auto-lock timer"
```

---

### Task 3: UI Components (`PrivacyMaskedAmount` & `ItemPrivacyPasscodeModal`)

**Files:**
- Create: `src/components/common/ItemPrivacyPasscodeModal.tsx`
- Create: `src/components/common/PrivacyMaskedAmount.tsx`

**Interfaces:**
- `<ItemPrivacyPasscodeModal />`: Compact, RTL-oriented modal asking for PIN.
- `<PrivacyMaskedAmount id="..." value={number} />`: High-polish masked number display with eye toggle icon.

- [ ] **Step 1: Create `ItemPrivacyPasscodeModal.tsx`**
- [ ] **Step 2: Create `PrivacyMaskedAmount.tsx`**
- [ ] **Step 3: Run TypeScript check (`npx tsc --noEmit`)**
- [ ] **Step 4: Commit**

```bash
git add src/components/common/ItemPrivacyPasscodeModal.tsx src/components/common/PrivacyMaskedAmount.tsx
git commit -m "feat: add PrivacyMaskedAmount and ItemPrivacyPasscodeModal UI components"
```

---

### Task 4: Settings Integration & Neon PostgreSQL Persistence

**Files:**
- Modify: `src/services/simulation.ts` (store fields)
- Modify: `src/app/api/settings/route.ts` (support `privacy_passcode` and `privacy_auto_hide_seconds`)
- Modify: `src/components/views/SettingsView.tsx` (Privacy Settings UI card)

**Interfaces:**
- `SimulationStore.privacyPasscode`, `SimulationStore.privacyAutoHideSeconds`
- `/api/settings`: Accepts `privacyPasscode` and `autoHideSeconds`
- `SettingsView`: Interactive card with password change, duration selector (15s, 30s, 60s, 120s, off), and live save.

- [ ] **Step 1: Update `simulation.ts` store defaults and serialization**
- [ ] **Step 2: Update `/api/settings/route.ts` to return and update privacy settings**
- [ ] **Step 3: Add dedicated UI card in `SettingsView.tsx`**
- [ ] **Step 4: Run unit tests & type check**
- [ ] **Step 5: Commit**

```bash
git add src/services/simulation.ts src/app/api/settings/route.ts src/components/views/SettingsView.tsx
git commit -m "feat: add privacy passcode and auto-lock duration settings with db sync"
```

---

### Task 5: Application Root & Header Wiring

**Files:**
- Modify: `src/app/page.tsx` (wrap with `PrivacyProvider`)
- Modify: `src/components/layout/Header.tsx` (mask company balance & investors capital, add quick Lock All button)

- [ ] **Step 1: Wrap `Home` in `page.tsx` with `<PrivacyProvider>` and mount `<ItemPrivacyPasscodeModal>`**
- [ ] **Step 2: Convert `Header.tsx` balances to `<PrivacyMaskedAmount />` and add "قفل الكل" button**
- [ ] **Step 3: Verify build and runtime**
- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/layout/Header.tsx
git commit -m "feat: wire PrivacyProvider into page root and mask header figures"
```

---

### Task 6: Key Financial Views Masking (Dashboard, Investors, Company Fund, Borrowers)

**Files:**
- Modify: `src/components/views/DashboardView.tsx`
- Modify: `src/components/views/InvestorsView.tsx`
- Modify: `src/components/views/CompanyFundView.tsx`
- Modify: `src/components/views/BorrowersView.tsx`

- [ ] **Step 1: Wire `<PrivacyMaskedAmount />` into `DashboardView.tsx` KPI cards**
- [ ] **Step 2: Wire `<PrivacyMaskedAmount />` into `InvestorsView.tsx` cards and table rows**
- [ ] **Step 3: Wire `<PrivacyMaskedAmount />` into `CompanyFundView.tsx`**
- [ ] **Step 4: Wire `<PrivacyMaskedAmount />` into `BorrowersView.tsx`**
- [ ] **Step 5: Commit**

```bash
git add src/components/views/DashboardView.tsx src/components/views/InvestorsView.tsx src/components/views/CompanyFundView.tsx src/components/views/BorrowersView.tsx
git commit -m "feat: apply granular privacy masking across main financial dashboards and views"
```

---

### Task 7: Full Verification & Build Audit

**Files:**
- Verify all modified files
- Run test suite
- Run production build

- [ ] **Step 1: Run full unit test suite (`npx tsx --test src/tests/*.test.ts`)**
- [ ] **Step 2: Run strict TypeScript typecheck (`npx tsc --noEmit`)**
- [ ] **Step 3: Run production build (`npm run build`)**
- [ ] **Step 4: Commit final verification**

```bash
git add -A
git commit -m "chore: verify privacy masking integration and clean production build"
```
