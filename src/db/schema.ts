// Drizzle ORM Schema for Neon PostgreSQL
// Finance System for Investor Funds, Inventory & Installments (Samarra, Iraq)

import { pgTable, text, numeric, integer, timestamp, varchar, uuid, pgEnum } from 'drizzle-orm/pg-core';

export const ownerTypeEnum = pgEnum('owner_type', ['COMPANY', 'INVESTOR']);
export const lossPolicyEnum = pgEnum('loss_policy', ['INVESTOR_ONLY', 'SHARED', 'COMPANY_GUARANTEED']);
export const itemStatusEnum = pgEnum('item_status', ['IN_STOCK', 'PARTIALLY_FINANCED', 'FULLY_FINANCED']);
export const contractStatusEnum = pgEnum('contract_status', ['ACTIVE', 'COMPLETED', 'DEFAULTED']);
export const scheduleStatusEnum = pgEnum('schedule_status', ['PENDING', 'PAID', 'OVERDUE']);
export const txTypeEnum = pgEnum('tx_type', [
  'DEPOSIT',
  'PURCHASE_INVENTORY',
  'ISSUE_INSTALLMENT',
  'PAYMENT_RECEIVED',
  'EXPENSE',
  'REVENUE',
  'PROFIT_DISTRIBUTION',
  'REFERRAL_COMMISSION',
]);



// 1. Company Table
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().default('نظام أمان للتقسيط - سامراء'),
  city: varchar('city', { length: 100 }).notNull().default('سامراء'),
  governorate: varchar('governorate', { length: 100 }).notNull().default('صلاح الدين'),
  currency: varchar('currency', { length: 10 }).notNull().default('IQD'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Investors Table
export const investors = pgTable('investors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  nationalId: varchar('national_id', { length: 50 }),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Investor Contracts (نسب المستثمر والشركة)
export const investorContracts = pgTable('investor_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  investorId: uuid('investor_id').references(() => investors.id).notNull(),
  investorSharePercent: numeric('investor_share_percent', { precision: 5, scale: 2 }).notNull(), // e.g. 60.00
  companySharePercent: numeric('company_share_percent', { precision: 5, scale: 2 }).notNull(),   // e.g. 40.00
  lossPolicy: lossPolicyEnum('loss_policy').notNull().default('SHARED'),
  referrerId: uuid('referrer_id').references(() => investors.id),
  referrerSharePercent: numeric('referrer_share_percent', { precision: 5, scale: 2 }).default('0.00'),
  contractDate: timestamp('contract_date').defaultNow().notNull(),
  notes: text('notes'),
});

// 4. Wallets (صناديق المال المستقلة)
export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerType: ownerTypeEnum('owner_type').notNull(), // COMPANY or INVESTOR
  investorId: uuid('investor_id').references(() => investors.id), // Null if COMPANY
  ownerName: varchar('owner_name', { length: 255 }).notNull(),
  balanceIQD: numeric('balance_iqd', { precision: 18, scale: 2 }).notNull().default('0.00'),
  totalCapitalDepositedIQD: numeric('total_capital_deposited_iqd', { precision: 18, scale: 2 }).notNull().default('0.00'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. Inventory Items (المخزن والأصول مع تحديد المالك الممول الحقيقي)
export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  investorId: uuid('investor_id').references(() => investors.id).notNull(), // الممول الحقيقي
  quantity: integer('quantity').notNull().default(1),
  unitCostIQD: numeric('unit_cost_iqd', { precision: 18, scale: 2 }).notNull(),
  targetSellingPriceIQD: numeric('target_selling_price_iqd', { precision: 18, scale: 2 }).notNull(),
  status: itemStatusEnum('status').notNull().default('IN_STOCK'),
  purchaseDate: timestamp('purchase_date').defaultNow().notNull(),
});

// 6. Borrowers (الزبائن)
export const borrowers = pgTable('borrowers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull().default('سامراء'),
  jobTitle: varchar('job_title', { length: 150 }),
  monthlyIncomeIQD: numeric('monthly_income_iqd', { precision: 18, scale: 2 }),
  guarantors: text('guarantors').notNull().default('[]'),
  introducedBy: varchar('introduced_by', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Installment Contracts (عقود التقسيط)
export const installmentContracts = pgTable('installment_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractNumber: varchar('contract_number', { length: 100 }).notNull(),
  borrowerId: uuid('borrower_id').references(() => borrowers.id).notNull(),
  investorId: uuid('investor_id').references(() => investors.id).notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id, { onDelete: 'set null' }),
  itemCostPriceIQD: numeric('item_cost_price_iqd', { precision: 18, scale: 2 }).notNull(),
  totalSalePriceIQD: numeric('total_sale_price_iqd', { precision: 18, scale: 2 }).notNull(),
  downPaymentIQD: numeric('down_payment_iqd', { precision: 18, scale: 2 }).notNull().default('0.00'),
  monthlyInstallmentIQD: numeric('monthly_installment_iqd', { precision: 18, scale: 2 }).notNull(),
  monthsCount: integer('months_count').notNull(),
  status: contractStatusEnum('status').notNull().default('ACTIVE'),
  startDate: timestamp('start_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Installment Schedules (جدول الأقساط الشهرية)
export const installmentSchedules = pgTable('installment_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').references(() => installmentContracts.id).notNull(),
  installmentNumber: integer('installment_number').notNull(),
  dueDate: timestamp('due_date').notNull(),
  amountIQD: numeric('amount_iqd', { precision: 18, scale: 2 }).notNull(),
  principalAmountIQD: numeric('principal_amount_iqd', { precision: 18, scale: 2 }).notNull(),
  profitAmountIQD: numeric('profit_amount_iqd', { precision: 18, scale: 2 }).notNull(),
  investorProfitShareIQD: numeric('investor_profit_share_iqd', { precision: 18, scale: 2 }).notNull(),
  referrerProfitShareIQD: numeric('referrer_profit_share_iqd', { precision: 18, scale: 2 }).default('0.00'),
  companyProfitShareIQD: numeric('company_profit_share_iqd', { precision: 18, scale: 2 }).notNull(),
  paidDate: timestamp('paid_date'),
  status: scheduleStatusEnum('status').notNull().default('PENDING'),
});

// 9. Ledger Transactions (السجل المالي المحاسبي)
export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceNo: varchar('reference_no', { length: 100 }).notNull(),
  date: timestamp('date').defaultNow().notNull(),
  type: txTypeEnum('type').notNull(),
  fromWalletId: uuid('from_wallet_id').notNull(),
  toWalletId: uuid('to_wallet_id').notNull(),
  investorId: uuid('investor_id'),
  borrowerId: uuid('borrower_id'),
  referrerId: uuid('referrer_id'),
  amountIQD: numeric('amount_iqd', { precision: 18, scale: 2 }).notNull(),
  investorProfitShareIQD: numeric('investor_profit_share_iqd', { precision: 18, scale: 2 }),
  referrerProfitShareIQD: numeric('referrer_profit_share_iqd', { precision: 18, scale: 2 }),
  companyProfitShareIQD: numeric('company_profit_share_iqd', { precision: 18, scale: 2 }),
  description: text('description').notNull(),
});

// 10. Employees Table (إدارة الموظفين والصلاحيات والموافقات)
export const employees = pgTable('employees', {
  id: varchar('id', { length: 100 }).primaryKey(),
  uid: varchar('uid', { length: 128 }),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  nationalId: varchar('national_id', { length: 50 }),
  salaryIQD: numeric('salary_iqd', { precision: 18, scale: 2 }).notNull().default('0.00'),
  status: varchar('status', { length: 50 }).notNull().default('بانتظار الموافقة'),
  permissions: text('permissions').notNull().default('[]'), // JSON string of permission IDs
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Expenses Table (سجل المصاريف التشغيلية)
export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  amountIQD: numeric('amount_iqd', { precision: 18, scale: 2 }).notNull(),
  date: timestamp('date').defaultNow().notNull(),
  paidFromWalletId: uuid('paid_from_wallet_id').references(() => wallets.id).notNull(),
  recipientName: varchar('recipient_name', { length: 255 }),
  referenceNo: varchar('reference_no', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Revenues Table (سجل الإيرادات المتنوعة)
export const revenues = pgTable('revenues', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  amountIQD: numeric('amount_iqd', { precision: 18, scale: 2 }).notNull(),
  date: timestamp('date').defaultNow().notNull(),
  receivedToWalletId: uuid('received_to_wallet_id').references(() => wallets.id).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Direct Debts Table (دفتر الديون)
export const directDebts = pgTable('direct_debts', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractNumber: varchar('contract_number', { length: 100 }).notNull(),
  borrowerName: varchar('borrower_name', { length: 255 }).notNull(),
  borrowerPhone: varchar('borrower_phone', { length: 50 }),
  investorId: varchar('investor_id', { length: 100 }).notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  totalAmountIQD: numeric('total_amount_iqd', { precision: 18, scale: 2 }).notNull(),
  downPaymentIQD: numeric('down_payment_iqd', { precision: 18, scale: 2 }).notNull().default('0.00'),
  monthsCount: integer('months_count').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  startDate: timestamp('start_date').defaultNow().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Direct Debt Schedules Table (أقساط دفتر الديون)
export const directDebtSchedules = pgTable('direct_debt_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  directDebtId: uuid('direct_debt_id').references(() => directDebts.id, { onDelete: 'cascade' }).notNull(),
  installmentNumber: integer('installment_number').notNull(),
  dueDate: timestamp('due_date').notNull(),
  amountIQD: numeric('amount_iqd', { precision: 18, scale: 2 }).notNull(),
  principalAmountIQD: numeric('principal_amount_iqd', { precision: 18, scale: 2 }).notNull(),
  profitAmountIQD: numeric('profit_amount_iqd', { precision: 18, scale: 2 }).notNull(),
  investorProfitShareIQD: numeric('investor_profit_share_iqd', { precision: 18, scale: 2 }).notNull(),
  companyProfitShareIQD: numeric('company_profit_share_iqd', { precision: 18, scale: 2 }).notNull(),
  paidDate: timestamp('paid_date'),
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
});

// 15. Trash Items Table (سلة المهملات المركزية)
export const trashItems = pgTable('trash_items', {
  id: varchar('id', { length: 100 }).primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  subtitle: text('subtitle'),
  category: varchar('category', { length: 100 }).notNull(),
  amountIQD: numeric('amount_iqd', { precision: 18, scale: 2 }),
  deletedAt: timestamp('deleted_at').defaultNow().notNull(),
  deletedBy: varchar('deleted_by', { length: 255 }).default('مدير النظام').notNull(),
  originalData: text('original_data').notNull(), // Serialized JSON
  notes: text('notes'),
});

// 16. System Settings Table (إعدادات النظام وكلمة السر)
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: varchar('updated_by', { length: 255 }).default('مدير النظام'),
});


