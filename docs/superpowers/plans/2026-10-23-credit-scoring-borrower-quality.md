# Credit Scoring & Borrower Quality Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an enterprise-grade Credit Scoring & Borrower Quality Engine for the Aman Installments System (`نظام أمان للتقسيط - سامراء`), including a dedicated analytical dashboard (`CreditScoreView`), smart auto-blacklisting (for delays > 60/90 days), automated credit limit recommendations, instant contract eligibility pre-screening in `InvoicesView`, and credit score badges in `BorrowersView`, with comprehensive print (A4) and CSV export support.

**Architecture:** Pure algorithmic calculation based on live `SimulationStore` data (Borrowers, Contracts, Schedules, Guarantors) with zero database schema alterations. The scoring engine evaluates 4 weighted pillars: Payment Punctuality (40%), Debt-to-Income capacity (25%), Guarantor Strength (20%), and Contract Track Record (15%).

**Tech Stack:** Next.js App Router (React 19 / TypeScript), Tailwind CSS, Lucide React, Node.js Test Runner (`node:test`).

## Global Constraints

- **Strict zero database schema alterations:** All credit scores, tiers, limits, and blacklist statuses are calculated dynamically from existing fields (`dueDate`, `monthlyIncomeIQD`, `remainingDebtIQD`, `status`, `guarantors`).
- **Strict English Numerals (0-9):** Always format numbers with `toEnglishDigits` and `formatNumber` / `formatIQD`.
- **Pure surgical edits:** Maintain exact existing multi-wallet accounting integrity; no hallucinated imports or APIs.
- **TDD:** Write unit tests first in `src/tests/credit_score.test.ts` before creating UI components.

---

### Task 1: Credit Scoring Engine & Unit Tests

**Files:**
- Create: `src/utils/creditScore.ts`
- Create: `src/tests/credit_score.test.ts`

**Interfaces:**
- Consumes: `Borrower`, `InstallmentContract`, `InstallmentScheduleItem` from `@/types/finance` and `calculateInstallmentDueStatus` from `@/utils/installmentDates`.
- Produces:
  ```ts
  export type CreditTier = 'AAA' | 'A' | 'B' | 'C' | 'D';

  export interface CreditBreakdown {
    punctualityScore: number;    // 0 - 40
    dtiScore: number;            // 0 - 25
    guarantorScore: number;      // 0 - 20
    historyScore: number;        // 0 - 15
    totalScore: number;          // 0 - 100
  }

  export interface BorrowerCreditEvaluation {
    borrowerId: string;
    borrowerName: string;
    totalScore: number;
    tier: CreditTier;
    tierLabel: string;
    tierColor: string;
    tierBadgeClass: string;
    isBlacklisted: boolean;
    blacklistReason?: string;
    dtiRatio: number; // e.g. 0.35 (35%)
    monthlyInstallmentSum: number;
    monthlyIncomeIQD: number;
    recommendedCreditLimitIQD: number;
    availableCreditLimitIQD: number;
    remainingDebtIQD: number;
    overdueInstallmentsCount: number;
    maxDaysOverdue: number;
    breakdown: CreditBreakdown;
  }

  export function evaluateBorrowerCredit(
    borrower: Borrower,
    contracts: InstallmentContract[],
    referenceDate?: Date
  ): BorrowerCreditEvaluation;

  export function evaluatePortfolioCredit(
    borrowers: Borrower[],
    contracts: InstallmentContract[],
    referenceDate?: Date
  ): {
    evaluations: BorrowerCreditEvaluation[];
    portfolioHealthIndex: number;
    tierCounts: Record<CreditTier, number>;
    blacklistedCount: number;
    totalExposureIQD: number;
  };
  ```

- [ ] **Step 1: Write failing unit test suite in `src/tests/credit_score.test.ts`**
  - Test Tier AAA: on-time payments, low DTI (<30%), government guarantor.
  - Test Tier B: minor delays (1-7 days), moderate DTI (40%).
  - Test Auto-Blacklist Tier D: installment late by > 60 days triggers immediate `isBlacklisted = true` and `tier = 'D'`.
  - Test Auto-Blacklist Tier D: defaulted contract triggers blacklist.
  - Test Credit Limit Calculator: verifies recommended ceiling and available balance.
  - Test Portfolio Health Index: aggregates all borrowers into weighted percentage.
- [ ] **Step 2: Run test suite to verify tests fail cleanly**
  - Run: `npx tsx --test src/tests/credit_score.test.ts`
- [ ] **Step 3: Implement `src/utils/creditScore.ts`**
  - Implement scoring formulas, tier mapping, DTI calculation, limit recommendation, and portfolio aggregation.
- [ ] **Step 4: Run test suite and verify all pass**
  - Run: `npx tsx --test src/tests/credit_score.test.ts`
- [ ] **Step 5: Verify full test suite passes**
  - Run: `npx tsx --test src/tests/*.test.ts`

---

### Task 2: Dedicated Credit Scoring & Quality Dashboard (`CreditScoreView.tsx`)

**Files:**
- Create: `src/components/views/CreditScoreView.tsx`

**Features:**
- Header with Portfolio Credit Health gauge (percentage circular progress / bar).
- Top KPI statistics:
  - Overall Portfolio Health Index (مؤشر السلامة الائتمانية).
  - Count of VIP / AAA Golden Borrowers.
  - Count of High-Risk / Constrained Borrowers.
  - Count of Blacklisted Borrowers (القائمة السوداء).
- Filter Tabs:
  - All (`الكل`)
  - Golden AAA (`الفئة الذهبية AAA`)
  - Silver A (`الفئة الفضية A`)
  - Bronze B (`الفئة البرونزية B`)
  - High Risk C (`عالي المخاطر C`)
  - Blacklist D (`القائمة السوداء المحظورة 🚫`)
- Instant Search (Borrower name, phone, address, national ID, job).
- Comprehensive Data Table:
  - `#`
  - Borrower & Contact
  - Credit Score (Progress Bar 0-100 & numeric score)
  - Tier & Quality Badge
  - Monthly Income & DTI Ratio (`عبء الدين للراتب`)
  - Recommended Credit Limit (`السقف الائتماني الأقصى`)
  - Available Credit (`الرصيد الائتماني المتاح`)
  - Current Debt (`إجمالي الدين القائم`)
  - Blacklist status with reason
  - Quick actions (View breakdown modal, WhatsApp, Call, Print Statement)
- Print A4 Credit Quality Statement sheet with `@media print`.
- Export to CSV utility with English digits and Arabic headers.
- Borrower Credit Score Details Breakdown Modal.

- [ ] **Step 1: Create `CreditScoreView.tsx` with all components, filters, table, and modals.**
- [ ] **Step 2: Run TypeScript typecheck to verify 0 errors.**

---

### Task 3: Instant Contract Eligibility Check in `InvoicesView.tsx`

**Files:**
- Modify: `src/components/views/InvoicesView.tsx`

**Features:**
- In the "إنشاء عقد تقسيط جديد" (Create Contract) modal:
  - When a borrower is selected:
    - Run `evaluateBorrowerCredit(selectedBorrower, store.contracts)`.
    - If `isBlacklisted === true`: display prominent pulsing Red Alert Banner:
      `⚠️ تنبيه حرج: هذا المقترض مدرج في القائمة السوداء (${blacklistReason}) - لا يُنصح بفتح العقد إلا بتسوية وضمانات استثنائية!`
    - If `remainingCreditLimit < totalSalePrice`: display Orange Warning Banner:
      `⚠️ تنبيه ائتماني: إجمالي قيمة هذا العقد (${formatIQD(totalSalePrice)} د.ع) يتجاوز السقف الائتماني المتاح (${formatIQD(availableCreditLimit)} د.ع).`
    - If Tier AAA/A: display Green Verified Banner:
      `✅ مؤهل ائتمانياً: التقييم الائتماني ممتاز (${score}/100) - سقف ائتماني متاح كافٍ.`

- [ ] **Step 1: Update `InvoicesView.tsx` to include instant credit pre-screening.**
- [ ] **Step 2: Run TypeScript typecheck.**

---

### Task 4: Credit Score Badge & Modal in `BorrowersView.tsx`

**Files:**
- Modify: `src/components/views/BorrowersView.tsx`

**Features:**
- Add Credit Score Badge (`AAA`, `A`, `B`, `C`, `🚫 قائمة سوداء`) directly next to borrower names in:
  - Borrower Cards Grid view.
  - Borrower Table view.
- Clicking the badge opens the Credit Details Breakdown Modal showing the 4 score factors and credit limit.

- [ ] **Step 1: Update `BorrowersView.tsx` with Credit Badges and details trigger.**
- [ ] **Step 2: Run TypeScript typecheck.**

---

### Task 5: App-Level Navigation & Permissions (`Sidebar`, `Header`, `page.tsx`)

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/app/page.tsx`

**Features:**
- Add `'credit_score'` to `ActiveTab` in `Sidebar.tsx`.
- Add menu item "قياس الائتمان وجودة المقترضين" with `ShieldCheck` icon.
- Add title mapping in `Header.tsx`.
- Add `TAB_PERMISSION_MAP` in `page.tsx` under `BORROWERS_MANAGE`.
- Render `<CreditScoreView store={store} setActiveTab={setActiveTab} />` when `activeTab === 'credit_score'`.

- [ ] **Step 1: Update `Sidebar.tsx`, `Header.tsx`, and `page.tsx`.**
- [ ] **Step 2: Run `npx tsc --noEmit` and verify 0 errors.**
- [ ] **Step 3: Run `npx tsx --test src/tests/*.test.ts` and verify 100% pass rate.**

---

### Task 6: Final Verification & Git Commit

- [ ] **Step 1: Run complete test suite and compiler checks.**
- [ ] **Step 2: Check git diff and review against Disciplined Agent Operating Contract.**
