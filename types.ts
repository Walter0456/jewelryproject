
export interface User {
  username: string;
  passwordHash?: string;
  salt?: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'staff';
  status?: 'active' | 'disabled' | 'deleted';
  profilePicture?: string;
  deletedAt?: string;
  originalName?: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  isPrimary: boolean;
}

export type ReceiptType = 'OR' | 'AR';

export interface ReceiptLayoutSettings {
  businessName?: string;
  headerNote?: string;
  footerNote?: string;
  thankYouNote?: string;
  officialReceiptLabel?: string;
  acknowledgementReceiptLabel?: string;
  accentColor?: string;
  defaultReceiptType?: ReceiptType;
  receiptSavePath?: string;
}

export interface SystemSettings {
  branchName: string;
  currencySymbol: string;
  taxRate: number;
  lowStockThreshold: number;
  timeFormat: '12h' | '24h';
  receiptAutoPrint: boolean;
  profitMargin: number;
  maxImagesPerProduct: number;
  staffCanEditPrice: boolean;
  adminPin: string;
  hasAdminPin?: boolean;
  currentAdminPin?: string;
  sessionTimeoutMinutes: number;
  branches: Branch[];
  receiptLayout?: ReceiptLayoutSettings;
  backupSettings?: {
    enabled?: boolean;
    time?: string;
    path?: string;
    provider?: 'local' | 'onedrive' | 'googledrive';
    taskName?: string;
    lastBackupAt?: string;
    lastBackupFile?: string;
    lastUploadsZip?: string | null;
  };
  lowStockAlerts?: boolean;
  salesSummaryAlerts?: boolean;
  securityAlerts?: boolean;
  inventorySyncAlerts?: boolean;
  desktopNotifications?: boolean;
  emailNotifications?: boolean;
  alertEmailAddress?: string;
  dailySummaryTime?: string;
  lowStockCheckFrequency?: 'hourly' | 'daily' | 'weekly';
}

export interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  weightGrams: number;
  specs: string;
  detailedDescription: string;
  material: string;
  materialGrade: string;
  mainImage: string;
  thumbnails: string[];
  category: string;
  collection?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Sale {
  id: string;
  orNumber: string;
  receiptType?: ReceiptType;
  timestamp: string;
  staff: string;
  staffFullName?: string;
  items: CartItem[];
  total: number;
  amountReceived?: number;
  changeAmount?: number;
  status?: 'completed' | 'void';
  reissued?: boolean;
  reissueDate?: string;
  reissueAdmin?: string;
}

export interface Activity {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  item: string;
}

export interface RevenueData {
  month: string;
  year: number;
  revenue: number;
}

export interface RegistrationCodeLog {
  id: number;
  code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  used_by_name?: string;
  used_by_username?: string;
}

export enum NavItem {
  DASHBOARD = 'Dashboard',
  POS = 'Jewelry Menu',
  INVENTORY = 'Inventory Catalog',
  
  // Sub-nav for User Management
  USER_MGMT = 'User Management',
  EMPLOYEE_ANALYTICS = 'Employee Analytics',
  EMPLOYEE_REGISTRY = 'Employee Registry',
  
  // Sub-nav for Reports
  REPORTS = 'Reports',
  DAILY_INVENTORY_REPORT = 'Daily Inventory Report',
  SALES_REPORT = 'Sales Report',
  BUSINESS_REVENUE = 'Business Revenue',
  
  LOGS = 'System Logs',
  SETTINGS = 'Settings',
  MY_LOGS = 'My Activity Log'
}
