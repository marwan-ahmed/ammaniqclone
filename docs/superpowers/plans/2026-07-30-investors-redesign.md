# Investors Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and restructure `InvestorsView.tsx` to eliminate visual clutter, expand whitespace, and introduce 4 clean tabs (Investors, Inventory Assets, Funded Loans, Individual Details).

**Architecture:** Refactor `src/components/views/InvestorsView.tsx` into clean tabbed sub-views with spacious Tailwind UI cards and tables while maintaining 100% compatibility with `SimulationStore`.

**Tech Stack:** Next.js, React, Tailwind CSS, Lucide React icons.

## Global Constraints
- Do not break existing data bindings or `SimulationStore` methods.
- Keep clean Arabic typography and HSL dark mode color system (`slate-900`, `emerald-400`, `slate-950`).
- Ensure no TypeScript errors during `npm run build`.

---

### Task 1: Refactor Header & Top KPI Cards

**Files:**
- Modify: `d:\ajeeb-company\ahmed-eyad\app\src\components\views\InvestorsView.tsx:183-290`

**Interfaces:**
- Consumes: `totalCapitalAll`, `totalLiquidityAll`, `totalProfitsAll`
- Produces: Simplified header banner and 3 spacious top KPI cards

- [ ] **Step 1: Clean up top page header banner**
Remove dense explanation text, leaving clean title and quick action buttons.

- [ ] **Step 2: Remove dense subtitle notes from KPI cards**
Remove secondary text ("عقود محافظ رسمية مسجلة", "جاهزة لشراء البضائع وتسهيل القروض", "المستحصلة من سداد الأقساط"). Enlarge values (`text-2xl font-black text-white`).

- [ ] **Step 3: Verify visually in component code**

---

### Task 2: Implement 4-Tab Navigation Bar & View States

**Files:**
- Modify: `d:\ajeeb-company\ahmed-eyad\app\src\components\views\InvestorsView.tsx:44-50, 215-247`

**Interfaces:**
- Consumes: `activeTab` state (`'table' | 'inventory' | 'loans' | 'details'`)
- Produces: Interactive sub-tabs menu

- [ ] **Step 1: Expand state type `viewMode`**
Set state `viewMode` to `'table' | 'inventory' | 'loans' | 'details'`.

- [ ] **Step 2: Render 4-Tab Navigation Bar**
Create tab buttons:
1. المستثمرون والحسابات
2. المواد والأصول بالصناديق
3. عقود التمويل والقروض
4. تفاصيل المحفظة الفردية

- [ ] **Step 3: Verify tab switching logic**

---

### Task 3: Refactor Tab 1 (Investors Master Table)

**Files:**
- Modify: `d:\ajeeb-company\ahmed-eyad\app\src\components\views\InvestorsView.tsx:313-458`

**Interfaces:**
- Consumes: `filteredInvestors`, `store.wallets`
- Produces: Spacious 6-column clean table (`py-5 px-6`)

- [ ] **Step 1: Remove cluttered columns from main table**
Remove "ماذا اشترى للمخزن" and "لمن أعطى قرض" columns from Tab 1 to eliminate text density.

- [ ] **Step 2: Expand padding and clean cell styles**
Apply `py-5 px-6` row padding, crisp typography, and badge-styled profit split percentages.

---

### Task 4: Implement Tab 2 (Inventory Assets) & Tab 3 (Funded Loans)

**Files:**
- Modify: `d:\ajeeb-company\ahmed-eyad\app\src\components\views\InvestorsView.tsx:460-645`

**Interfaces:**
- Consumes: `store.inventory`, `store.contracts`, `store.investors`
- Produces: Dedicated inventory assets view and funded loans view

- [ ] **Step 1: Create Tab 2 (المواد والأصول بالصناديق)**
Display a spacious grid/table listing each inventory item, its owner investor, total cost, purchase date, and SKU.

- [ ] **Step 2: Create Tab 3 (عقود التمويل والقروض)**
Display a spacious list of financing contracts with borrower name, funding investor name, loan value, monthly installment, and profit split ratio.

---

### Task 5: Refactor Individual Portfolio View & Add Investor Modal

**Files:**
- Modify: `d:\ajeeb-company\ahmed-eyad\app\src\components\views\InvestorsView.tsx:465-500, 646-784`

**Interfaces:**
- Consumes: `selectedInvestor`, `isAddModalOpen`
- Produces: Refined single portfolio dashboard and clean 2-column modal form

- [ ] **Step 1: Polish Tab 4 (Individual Portfolio)**
Provide investor selection sidebar and clean spacious cards for selected investor profile, contract details, items, and loans.

- [ ] **Step 2: Polish Add Investor Modal**
Format modal form fields into a balanced 2-column grid (`gap-4`) with clean input borders and generous spacing.

---

### Task 6: Verification & Build Check

**Files:**
- Test: Build verification (`npm run build`)

- [ ] **Step 1: Run build check**
Verify TypeScript types and Next.js build compilation.
