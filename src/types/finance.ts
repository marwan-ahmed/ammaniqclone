// Types for Finance Company S - Samarra, Iraq
// Domain Driven Design (DDD) Core Types

export interface InvestorContract {
  id: string;
  investorId: string;
  investorSharePercent: number; // e.g. 60 for 60%
  companySharePercent: number;  // e.g. 40 for 40%
  lossSharingPolicy: 'INVESTOR_ONLY' | 'SHARED' | 'COMPANY_GUARANTEED';
  contractDate: string;
  notes?: string;
  referrerId?: string; // معرف المستثمر أو الشريك المحيل
  referrerName?: string; // اسم المحيل
  referrerSharePercent?: number; // نسبة عمولة الإحالة المقتطعة من حصة الشركة (مثلاً 5.00)
}

export interface Investor {
  id: string;
  name: string;
  phone: string;
  nationalId?: string;
  address?: string;
  walletId: string;
  contract: InvestorContract;
  totalCapitalDeposited: number; // د.ع
  activeInvestmentsAmount: number; // د.ع في المخزن والقروض
  availableLiquidity: number; // د.ع السيولة النقدية في صندوق المستثمر
  totalProfitsEarned: number; // د.ع
  totalLossesIncurred: number; // د.ع
  createdAt: string;
  isReferralPartner?: boolean; // هل هو شريك إحالة فقط (دون رأس مال)
  referredById?: string; // المحيل الذي قام بجلبه إن وجد
  referredByName?: string;
  referralSharePercent?: number; // نسبة عمولة الإحالة المستحقة للمحيل
  totalReferralCommissionsEarned?: number; // إجمالي عمولات الإحالة المكتسبة
}

export interface Wallet {
  id: string;
  ownerType: 'COMPANY' | 'INVESTOR';
  ownerId: string; // 'company' or investorId
  ownerName: string;
  balance: number; // د.ع - السيولة النقدية المتاحة
  totalAssetsValuation: number; // قيمة البضائع الممولة القائمة
  totalDebtsValuation: number; // قيمة القروض القائمة للعملاء
  currency: 'IQD';
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string; // e.g., "حديد تسليح 12 ملم", "مولدة كهربائية 50 كافيا", "سيارة هيونداي"
  category: string; // نوع المادة أو تصنيفها (مثال: مواد إنشائية، كهربائيات، سيارات، أثاث...)
  investorId: string; // الممول الحقيقي للمادة
  investorName: string;
  quantity: number;
  unitCostIQD: number; // سعر شراء الوحدة من صندوق المستثمر
  totalCostIQD: number;
  targetSellingPriceIQD: number;
  purchaseInvoiceId: string;
  status: 'IN_STOCK' | 'PARTIALLY_FINANCED' | 'FULLY_FINANCED';
  purchaseDate: string;
}

export interface Borrower {
  id: string;
  name: string; // e.g. الزبون غ، الزبون ق
  phone: string;
  address: string;
  city: string; // سامراء، تكريت، بيجي...
  nationalId?: string;
  wifeName?: string;
  jobTitle?: string;
  monthlyIncomeIQD?: number;
  guarantors: {
    name: string;
    phone: string;
    nationalId: string;
    address?: string;
    department?: string;
    letterNumber?: string;
    letterDate?: string;
  }[];
  introducedBy?: string; // الشخص الذي أحضر الزبون (المعرّف للمتابعة الودية)
  totalFinancedIQD: number;
  totalRepaidIQD: number;
  remainingDebtIQD: number;
  status: 'ACTIVE' | 'SETTLED' | 'DEFAULTED';
  createdAt: string;
}


export interface InstallmentScheduleItem {
  id: string;
  contractId: string;
  installmentNumber: number; // 1, 2, 3...
  dueDate: string; // YYYY-MM-DD
  amountIQD: number; // إجمالي القسط
  principalAmountIQD: number; // جزء رأس المال
  profitAmountIQD: number; // جزء الربح الإجمالي
  investorProfitShareIQD: number; // حصة المستثمر من الربح
  referrerProfitShareIQD?: number; // حصة المحيل من الربح (تُقتطع من حصة الشركة)
  companyProfitShareIQD: number; // حصة الشركة الصافية من الربح
  paidDate?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  notes?: string;
  receiptNumber?: string | number;
}

export interface InstallmentContract {
  id: string;
  contractNumber: string;
  invoiceNumber?: string | number;
  borrowerId: string;
  borrowerName: string;
  investorId: string; // المستثمر صاحب رأس المال والمادة
  investorName: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity?: number;
  itemCostPriceIQD: number; // سعر التكلفة الأصلية
  totalSalePriceIQD: number; // سعر البيع الإجمالي بالتقسيط
  profitMarginIQD: number; // إجمالي الربح المتوقع
  downPaymentIQD: number; // المقدمة
  financedAmountIQD: number; // المبلغ المتبقي للتقسيط
  monthlyInstallmentIQD: number;
  monthsCount: number;
  startDate: string;
  endDate: string;
  schedules: InstallmentScheduleItem[];
  status: 'ACTIVE' | 'COMPLETED' | 'DEFAULTED';
  createdAt?: string;
}

export interface LedgerTransaction {
  id: string;
  referenceNo: string;
  date: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'INVESTOR_WITHDRAWAL' | 'PURCHASE_INVENTORY' | 'ISSUE_INSTALLMENT' | 'PAYMENT_RECEIVED' | 'EXPENSE' | 'REVENUE' | 'PROFIT_DISTRIBUTION' | 'INVENTORY_REVERSAL' | 'INVENTORY_ADJUSTMENT' | 'REFERRAL_COMMISSION';
  investorId?: string;
  investorName?: string;
  borrowerId?: string;
  borrowerName?: string;
  referrerId?: string;
  referrerProfitShareIQD?: number;
  fromWalletId: string; // صندوق المصدر
  fromWalletName: string;
  toWalletId: string; // صندوق الوجهة
  toWalletName: string;
  amountIQD: number;
  investorProfitShareIQD?: number;
  companyProfitShareIQD?: number;
  description: string;
}

export interface ExpenseItem {
  id: string;
  title: string;
  category: 'رواتب' | 'إيجارات' | 'تسويق' | 'مصاريف نقل ولوجستيك' | 'صيانة' | 'نثريات' | 'أجهزة ومعدات' | 'رسوم حكومية وإدارية' | 'أخرى';
  amountIQD: number;
  date: string;
  paidFromWalletId: string; // صندوق الشركة أو المستثمر
  paidFromWalletName?: string;
  recipientName?: string;
  referenceNo?: string;
  notes?: string;
}

export interface RevenueItem {
  id: string;
  title: string;
  category: 'عمولات إدارية' | 'رسوم فتح ملف' | 'رسوم كشف واستعلام' | 'رسوم فتح ملف وتنظيم عقد' | 'أرباح إدارية واستشارية' | 'غرامات تأخير ورسوم تسوية' | 'إيرادات أخرى';
  amountIQD: number;
  date: string;
  receivedToWalletId?: string; // صندوق الشركة
  notes?: string;
}

export type PermissionActionType =
  | 'VIEW'        // استعراض وعرض
  | 'CREATE'      // إضافة وإنشاء
  | 'EDIT'        // تعديل وتحديث
  | 'DELETE'      // حذف وإلغاء
  | 'FINANCIAL'   // حركات مالية وتحصيل وسحب
  | 'PRINT'       // طباعة وتصدير
  | 'SECURITY';   // أمان ونظام وتشفير

export interface SystemPermission {
  id: string;
  name: string;
  category: 'لوحة التحكم والمحاسبة' | 'المستثمرون والمحافظ' | 'الزبائن والعقود' | 'المخزن والأصول' | 'المصاريف والإيرادات' | 'الإدارة والنظام';
  description: string;
  actionType: PermissionActionType;
}

export const SYSTEM_PERMISSIONS: SystemPermission[] = [
  // 1. لوحة التحكم والمحاسبة (Dashboard & General Finance)
  { id: 'DASHBOARD_VIEW', name: 'عرض لوحة التحكم والمؤشرات المالية', category: 'لوحة التحكم والمحاسبة', description: 'الاطلاع على المؤشرات المالية والملخص الإحصائي العام والسيولة', actionType: 'VIEW' },
  { id: 'COMPANY_FUND_MANAGE', name: 'إدارة صندوق الشركة وحركات الخزينة', category: 'لوحة التحكم والمحاسبة', description: 'الاطلاع على رصيد الخزينة العامة ومتابعة الأرباح الخاصة بالشركة', actionType: 'FINANCIAL' },
  { id: 'COMPANY_FUND_WITHDRAW', name: 'السحب والإيداع النقدي لصندوق الشركة', category: 'لوحة التحكم والمحاسبة', description: 'تنفيذ عمليات الإيداع والسحب النقدي المباشر من وإلى خزينة الشركة', actionType: 'FINANCIAL' },
  { id: 'FUNDS_MANAGE', name: 'إدارة الصناديق والمحافظ المالية', category: 'لوحة التحكم والمحاسبة', description: 'الاطلاع على صناديق المستثمرين وحركات الإيداع والسيولة المتوفرة', actionType: 'VIEW' },
  { id: 'REPORTS_VIEW', name: 'عرض وتوليد التقارير المالية P&L', category: 'لوحة التحكم والمحاسبة', description: 'توليد تقارير الأرباح والخسائر الشاملة وكشوفات الحركات المالية', actionType: 'VIEW' },
  { id: 'REPORTS_EXPORT', name: 'تصدير التقارير والبيانات (Excel / PDF)', category: 'لوحة التحكم والمحاسبة', description: 'تنزيل ملفات الجداول والبيانات المالية الرسمية بصيغ Excel و PDF', actionType: 'PRINT' },

  // 2. المستثمرون والمحافظ والعمولات (Investors & Portfolios)
  { id: 'INVESTORS_VIEW', name: 'استعراض سجل المستثمرين والمحافظ', category: 'المستثمرون والمحافظ', description: 'الاطلاع على بطاقات المستثمرين وأرصدة المحافظ والسيولة المتاحة', actionType: 'VIEW' },
  { id: 'INVESTORS_MANAGE', name: 'إضافة وتعديل بيانات المستثمرين والعقود', category: 'المستثمرون والمحافظ', description: 'تسجيل مستثمر جديد وتعديل العقود الاستثمارية ونسب توزيع الأرباح', actionType: 'CREATE' },
  { id: 'INVESTORS_WITHDRAW', name: 'تنفيذ سحب نقدي للمستثمر وسند الصرف', category: 'المستثمرون والمحافظ', description: 'إجراء حركات السحب النقدي وتوليد سند صرف A5 وطباعة الوصل', actionType: 'FINANCIAL' },
  { id: 'INVESTORS_STATEMENT_PRINT', name: 'عرض وطباعة كشف حساب المستثمر المخصص', category: 'المستثمرون والمحافظ', description: 'توليد وطباعة كشوفات الحساب المالية المخصصة والتفصيلية لكل مستثمر', actionType: 'PRINT' },
  { id: 'REFERRALS_MANAGE', name: 'إدارة شبكة الإحالة والوسطاء والعمولات', category: 'المستثمرون والمحافظ', description: 'متابعة وسطاء الإحالة واستقطاب رؤوس الأموال واحتساب عمولات الشركاء', actionType: 'EDIT' },

  // 3. الزبائن والكفلاء والائتمان (Borrowers & Contracts)
  { id: 'BORROWERS_VIEW', name: 'استعراض سجل الزبائن والكفلاء', category: 'الزبائن والعقود', description: 'البحث في بيانات الزبائن وعرض تفاصيل السكن والهواتف والكفلاء', actionType: 'VIEW' },
  { id: 'BORROWERS_MANAGE', name: 'تسجيل وتعديل بيانات الزبائن والكفلاء', category: 'الزبائن والعقود', description: 'إضافة ملف زبون جديد وتحديث بيانات الكفلاء والمستندات الثبوتية', actionType: 'CREATE' },
  { id: 'BORROWERS_DELETE', name: 'إلغاء وحذف ملف الزبون واسترجاع البضائع', category: 'الزبائن والعقود', description: 'إلغاء وتصفية ملف الزبون قبل السداد واسترداد البضاعة الممولة للمخزن', actionType: 'DELETE' },
  { id: 'CREDIT_SCORE_VIEW', name: 'تقييم الجدارة الائتمانية وجودة الزبائن', category: 'الزبائن والعقود', description: 'الاطلاع على تصنيفات الجدارة المالية والسقوف وقوائم الحظر المعتمدة', actionType: 'VIEW' },
  { id: 'OVERDUE_MANAGE', name: 'متابعة المتأخرين عن السداد والتحصيل', category: 'الزبائن والعقود', description: 'سجل الأقساط المتعثرة ومتابعة المتأخرات واتخاذ الإجراءات الإدارية', actionType: 'EDIT' },
  { id: 'COLLECTION_PRINT', name: 'طباعة تقارير التحصيل والإنذارات الرسمية', category: 'الزبائن والعقود', description: 'توليد وطباعة تقارير الجباية الميدانية والكتب والإنذارات القانونية', actionType: 'PRINT' },
  { id: 'CONTRACTS_VIEW', name: 'استعراض الفواتير وعقود التقسيط', category: 'الزبائن والعقود', description: 'الاطلاع على تفاصيل عقود التقسيط وجداول استحقاق الأقساط الشهرية', actionType: 'VIEW' },
  { id: 'CONTRACTS_CREATE', name: 'إصدار وتوقيع عقود التقسيط الجديدة', category: 'الزبائن والعقود', description: 'إنشاء عقود التمويل بالتقسيط وتحديد المدد والأقساط والدفعة المقدمة', actionType: 'CREATE' },
  { id: 'INSTALLMENTS_PAY', name: 'تحصيل وتسديد الأقساط وإصدار الوصولات', category: 'الزبائن والعقود', description: 'تسجيل استلام الأقساط الشهرية وتوزيع الأرباح وإصدار وصل القبض المالي', actionType: 'FINANCIAL' },
  { id: 'CONTRACTS_PRINT', name: 'طباعة العقود والكمبيالات وجداول الأقساط', category: 'الزبائن والعقود', description: 'طباعة النسخ الرسمية لعقود التقسيط والكمبيالات وسندات القبض القانونية', actionType: 'PRINT' },
  { id: 'DEBT_LEDGER_MANAGE', name: 'إدارة دفتر الديون المباشرة والتحصيل', category: 'الزبائن والعقود', description: 'إدارة ديون الذمم المباشرة وتسجيل دفعاتها ومعالجة التعثر المالي', actionType: 'FINANCIAL' },

  // 4. المخزن والأصول (Inventory & Warehouse)
  { id: 'INVENTORY_VIEW', name: 'استعراض بضائع المخزن والأصول', category: 'المخزن والأصول', description: 'الاطلاع على قائمة المواد المتوفرة وكمياتها وأسعار التكلفة الحالية', actionType: 'VIEW' },
  { id: 'INVENTORY_MANAGE', name: 'شراء وإدخال بضائع جديدة إلى المخزن', category: 'المخزن والأصول', description: 'تسجيل وتتبع فواتير شراء البضائع والمواد وتحديد الجهة الممولة لها', actionType: 'CREATE' },
  { id: 'INVENTORY_EDIT', name: 'تعديل بيانات البضائع وأسعار البيع المستهدفة', category: 'المخزن والأصول', description: 'تحديث أسماء المواد وفئاتها ورمز SKU وتعديل أسعار البيع المستهدفة', actionType: 'EDIT' },
  { id: 'INVENTORY_DELETE', name: 'حذف وتصفية مواد المخزن', category: 'المخزن والأصول', description: 'حذف المواد التالفة أو غير الصالحة ونقلها إلى سلة الأرشيف', actionType: 'DELETE' },

  // 5. المصاريف والإيرادات (Expenses & Revenues)
  { id: 'EXPENSES_MANAGE', name: 'تسجيل وصرف المصروفات التشغيلية', category: 'المصاريف والإيرادات', description: 'صرف الرواتب والإيجارات وتسجيل القيود والمصاريف التشغيلية اليومية', actionType: 'FINANCIAL' },
  { id: 'EXPENSES_DELETE', name: 'تعديل وحذف قيود المصروفات', category: 'المصاريف والإيرادات', description: 'إلغاء قيود الصرف الخاطئة وإعادة المبالغ المسحوبة إلى رصيد الصندوق', actionType: 'DELETE' },
  { id: 'REVENUES_MANAGE', name: 'تقييد وإضافة الإيرادات والرسوم', category: 'المصاريف والإيرادات', description: 'تسجيل الإيرادات المباشرة والرسوم الإدارية المتفرقة وإيداعها بالصندوق', actionType: 'FINANCIAL' },

  // 6. الإدارة والنظام والأمان المتقدم (Administration & Security)
  { id: 'EMPLOYEES_MANAGE', name: 'إدارة كادر الموظفين والرواتب', category: 'الإدارة والنظام', description: 'إضافة وتعديل بيانات الموظفين والرواتب وحالات التفعيل والتعطيل', actionType: 'CREATE' },
  { id: 'PERMISSIONS_ASSIGN', name: 'تخصيص وتعديل صلاحيات الوصول والأذونات', category: 'الإدارة والنظام', description: 'التحكم بمصفوفة الصلاحيات الممنوحة لكل موظف وتطبيق القوالب الذكية', actionType: 'SECURITY' },
  { id: 'SETTINGS_MANAGE', name: 'تغيير إعدادات النظام وسعر الصرف', category: 'الإدارة والنظام', description: 'إدارة إعدادات النظام وتحديث سعر الصرف الرسمي وسياسات الحفظ التلقائي', actionType: 'EDIT' },
  { id: 'TRASH_MANAGE', name: 'استعراض واستعادة سلة المهملات والأرشيف', category: 'الإدارة والنظام', description: 'استعراض السجلات المحذوفة واستعادة العقود والزبائن والمواد بأمان', actionType: 'VIEW' },
  { id: 'TRASH_PERMANENT_DELETE', name: 'الحذف النهائي القطعي وتفريغ سلة المهملات', category: 'الإدارة والنظام', description: 'الإتلاف النهائي الدائم للسجلات بكلمة مرور المدير العام لمنع استرجاعها', actionType: 'DELETE' },
  { id: 'PRIVACY_VIEW_SENSITIVE', name: 'فك تشفير البيانات المالية والاطلاع على الأرقام الحساسة', category: 'الإدارة والنظام', description: 'تجاوز قناع الخصوصية واستعراض الأرقام والمبالغ المالية وأسماء الزبائن الحساسة', actionType: 'SECURITY' },
];

export type TrashEntityType =
  | 'CONTRACT'
  | 'BORROWER'
  | 'EXPENSE'
  | 'REVENUE'
  | 'INVENTORY'
  | 'EMPLOYEE'
  | 'INVESTOR'
  | 'DIRECT_DEBT'
  | 'WALLET';

export interface TrashItem {
  id: string;
  entityType: TrashEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  category: string;
  amountIQD?: number;
  deletedAt: string;
  deletedBy: string;
  originalData: any; // Full JSON snapshot of deleted entity and its children
  notes?: string;
}

export interface Employee {
  id: string;
  uid?: string; // Firebase User UID
  name: string;
  role: 'مدير النظام' | 'محاسب مالي' | 'مسؤول مخزن' | 'متابعة أقساط' | 'استعلام ميداني';
  phone: string;
  email: string;
  nationalId?: string;
  salaryIQD: number;
  status: 'نشط' | 'إجازة' | 'معطل' | 'بانتظار الموافقة';

  joinedDate: string;
  permissions: string[];
  notes?: string;
}

export const SYSTEM_ADMIN_EMPLOYEE: Employee = {
  id: 'emp-1',
  name: 'أحمد إياد',
  role: 'مدير النظام',
  phone: '07705554433',
  email: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ADMIN_EMAIL ? process.env.NEXT_PUBLIC_ADMIN_EMAIL : 'admin@ammaniqclone.com',
  nationalId: 'IQ-10029384',
  salaryIQD: 1500000,
  status: 'نشط',
  joinedDate: '2025-11-01',
  permissions: SYSTEM_PERMISSIONS.map(p => p.id),
  notes: 'المدير العام المالك وصاحب الصلاحيات الشاملة المطلقة للنظام'
};

