# Design Specification: Overdue & Upcoming Installment Tracking Engine with Printable Collector Call Sheet

**Date:** 2026-10-23  
**Project:** نظام أمان للتقسيط - سامراء (Aman Installments System)  
**Status:** Approved  

---

## 1. Executive Summary

This feature adds a daily **Installment Due & Overdue Tracking Engine** and a dedicated **Printable Debt Collector Call Sheet** (كشف التحصيل والمتابعة الميدانية للمحصل) to the Aman Installments System.

It enables debt collectors and administrators to:
1. Track installments with day-level precision relative to the current date:
   - **Overdue (تأخير السداد):** Exact number of days overdue (e.g. `متأخر منذ 2 يوم`, `متأخر منذ 14 يوم`).
   - **Due Today (استحقاق اليوم):** Highlighted alerts for installments due on the current date.
   - **Upcoming (استحقاق قريب):** Proactive reminders for installments due within the next 5 to 7 days (e.g., `باقي 5 أيام على موعد السداد`).
2. Generate an official, print-ready (A4) **Debt Collector Call Sheet & Field Statement** containing:
   - Borrower's name, primary phone, secondary phone, and detailed address in Samarra / Salah al-Din.
   - Guarantor's name, phone, department, and letter reference.
   - Contract number, installment number, original due date, exact overdue/due status in days.
   - Required installment amount and total outstanding contract debt.
   - Dedicated field tracking boxes for the debt collector (call status, promised repayment date, collector notes, and signatures).

---

## 2. Core Architectural Components

### 2.1 Pure Date Calculation Engine (`src/utils/installmentDates.ts`)
A robust, standalone utility module calculating exact calendar day differences:
- `calculateInstallmentDueStatus(dueDateStr: string, isPaid: boolean, referenceDate?: Date)`:
  - Normalizes both dates to local calendar day (midnight).
  - Categorizes status:
    - `'PAID'`: Installment already paid.
    - `'OVERDUE'`: `diffDays < 0` (days late = `Math.abs(diffDays)`).
    - `'DUE_TODAY'`: `diffDays === 0`.
    - `'UPCOMING'`: `0 < diffDays <= 7` (e.g. `باقي 5 أيام`).
    - `'FUTURE'`: `diffDays > 7`.
- `getBorrowerDueSummary(borrowerId: string, contracts: InstallmentContract[], referenceDate?: Date)`:
  - Computes borrower-level alert status across all active contracts.

### 2.2 Reusable Printable Collector Modal (`src/components/common/CollectorReportModal.tsx`)
A dedicated, responsive and `@media print` optimized modal:
- Filterable by:
  - All actionable (overdue + due today + upcoming)
  - Overdue only (with sub-grouping or sorting by most overdue)
  - Due today
  - Upcoming within 7 days
- Printable A4 layout with official company header, summary KPIs, detailed contact & guarantor tables, and handwriting areas for the field collector.

### 2.3 View Integrations
- **`src/components/views/BorrowersView.tsx`**:
  - Adds due badges to borrower cards and list views.
  - Upgrades `schedules` tab with an "الأيام والتأخير" column and quick filter tabs.
  - Adds a prominent action button: "🖨️ كشف المحصل الميداني".
- **`src/components/views/InvoicesView.tsx`**:
  - Highlights overdue/upcoming days in the contract installment schedules table.

---

## 3. Security, Performance & Data Integrity
- No schema changes required: calculations are derived deterministically from existing `dueDate` and `status` fields.
- 100% parameter preservation and zero side effects on monetary ledger records.
- Complete unit test coverage for day boundaries and leap/month rollovers.
