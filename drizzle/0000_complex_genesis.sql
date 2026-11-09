CREATE TYPE "public"."contract_status" AS ENUM('ACTIVE', 'COMPLETED', 'DEFAULTED');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('IN_STOCK', 'PARTIALLY_FINANCED', 'FULLY_FINANCED');--> statement-breakpoint
CREATE TYPE "public"."loss_policy" AS ENUM('INVESTOR_ONLY', 'SHARED', 'COMPANY_GUARANTEED');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('COMPANY', 'INVESTOR');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('PENDING', 'PAID', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('DEPOSIT', 'PURCHASE_INVENTORY', 'ISSUE_INSTALLMENT', 'PAYMENT_RECEIVED', 'EXPENSE', 'REVENUE', 'PROFIT_DISTRIBUTION');--> statement-breakpoint
CREATE TABLE "borrowers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100) DEFAULT 'سامراء' NOT NULL,
	"job_title" varchar(150),
	"monthly_income_iqd" numeric(18, 2),
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) DEFAULT 'شركة التمويل والاستثمار الأهلي - سامراء' NOT NULL,
	"city" varchar(100) DEFAULT 'سامراء' NOT NULL,
	"governorate" varchar(100) DEFAULT 'صلاح الدين' NOT NULL,
	"currency" varchar(10) DEFAULT 'IQD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" varchar(100) NOT NULL,
	"borrower_id" uuid NOT NULL,
	"investor_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"item_cost_price_iqd" numeric(18, 2) NOT NULL,
	"total_sale_price_iqd" numeric(18, 2) NOT NULL,
	"down_payment_iqd" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"monthly_installment_iqd" numeric(18, 2) NOT NULL,
	"months_count" integer NOT NULL,
	"status" "contract_status" DEFAULT 'ACTIVE' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "installment_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "installment_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" timestamp NOT NULL,
	"amount_iqd" numeric(18, 2) NOT NULL,
	"principal_amount_iqd" numeric(18, 2) NOT NULL,
	"profit_amount_iqd" numeric(18, 2) NOT NULL,
	"investor_profit_share_iqd" numeric(18, 2) NOT NULL,
	"company_profit_share_iqd" numeric(18, 2) NOT NULL,
	"paid_date" timestamp,
	"status" "schedule_status" DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"investor_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost_iqd" numeric(18, 2) NOT NULL,
	"target_selling_price_iqd" numeric(18, 2) NOT NULL,
	"status" "item_status" DEFAULT 'IN_STOCK' NOT NULL,
	"purchase_date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "investor_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investor_id" uuid NOT NULL,
	"investor_share_percent" numeric(5, 2) NOT NULL,
	"company_share_percent" numeric(5, 2) NOT NULL,
	"loss_policy" "loss_policy" DEFAULT 'SHARED' NOT NULL,
	"contract_date" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"national_id" varchar(50),
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_no" varchar(100) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"type" "tx_type" NOT NULL,
	"from_wallet_id" uuid NOT NULL,
	"to_wallet_id" uuid NOT NULL,
	"investor_id" uuid,
	"borrower_id" uuid,
	"amount_iqd" numeric(18, 2) NOT NULL,
	"investor_profit_share_iqd" numeric(18, 2),
	"company_profit_share_iqd" numeric(18, 2),
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"investor_id" uuid,
	"owner_name" varchar(255) NOT NULL,
	"balance_iqd" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"total_capital_deposited_iqd" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "installment_contracts" ADD CONSTRAINT "installment_contracts_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_contracts" ADD CONSTRAINT "installment_contracts_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_contracts" ADD CONSTRAINT "installment_contracts_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_schedules" ADD CONSTRAINT "installment_schedules_contract_id_installment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."installment_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_contracts" ADD CONSTRAINT "investor_contracts_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE no action ON UPDATE no action;