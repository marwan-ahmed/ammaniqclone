# Implementation Plan: Overdue & Upcoming Installments Tracking with Printable Collector Sheet

**Date:** 2026-10-23  
**Status:** In Progress  

---

## Plan Structure & Phases

### Phase 1: Pure Calculation Utility & Unit Tests
- Create `src/utils/installmentDates.ts`:
  - `calculateInstallmentDueStatus`: calculates exact day differences, returns status ('PAID', 'OVERDUE', 'DUE_TODAY', 'UPCOMING', 'FUTURE'), labels in Arabic with English digits, and severity flags.
  - `getBorrowerDueSummary`: summarizes the most critical installment state for a borrower.
- Create `src/tests/installment_dates.test.ts`:
  - Test overdue calculations (-1 day, -5 days, -30 days).
  - Test due today (0 days).
  - Test upcoming (1 to 7 days, specifically 5 days like user example).
  - Test future (> 7 days).
  - Test paid installments.
  - Execute test suite and confirm 100% pass.

### Phase 2: Printable Collector Modal (`CollectorReportModal.tsx`)
- Create `src/components/common/CollectorReportModal.tsx`:
  - Official company header ("نظام أمان للتقسيط - سامراء").
  - Filter tabs: All Actionable, Overdue, Due Today, Upcoming.
  - Search input.
  - Printable A4 layout with `@media print` rules.
  - Full table with borrower info, phone, address, guarantors (name, phone, department), contract details, installment number, due date, status in days, amount, and handwritten collector check-off fields.
  - Print trigger button using `window.print()`.

### Phase 3: Integration into `BorrowersView.tsx`
- Import utility functions and `CollectorReportModal`.
- Add borrower status badge in borrower cards and table view.
- In `schedules` tab:
  - Add status filter tabs: All, Overdue, Due Today, Upcoming within 7 days, Paid.
  - Add "الأيام والاستحقاق" column showing color-coded badges with exact days.
  - Add "🖨️ كشف المحصل الميداني" button to open the modal.

### Phase 4: Integration into `InvoicesView.tsx`
- Display exact overdue/upcoming days in contract schedules table.

### Phase 5: Verification & Full Regression Testing
- Run all unit tests with `npx tsx --test src/tests/*.test.ts`.
- Run typecheck and linting.
