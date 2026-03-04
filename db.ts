
import { Product, Activity, RevenueData, User, CartItem, Sale, SystemSettings, ReceiptLayoutSettings, ReceiptType } from './types';

const DB_KEYS = {
  SESSION: 'jewel_admin_session',
  API_BASE_OVERRIDE: 'jewel_admin_api_base_override',
  AUTH_TOKEN: 'jewel_admin_auth_token'
};

const normalizeApiBase = (raw: string) => {
  const value = (raw || '').trim().replace(/\/+$/, '');
  if (!value) return '';
  return value.endsWith('/api') ? value : `${value}/api`;
};

const isNgrokHost = (rawUrl: string) => {
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('.ngrok-free.dev') ||
      host.endsWith('.ngrok.io') ||
      host.endsWith('.ngrok.app') ||
      host.endsWith('.ngrok-free.app')
    );
  } catch {
    return false;
  }
};

const withNgrokBypassHeader = (url: string, options: RequestInit = {}): RequestInit => {
  const headers = new Headers(options.headers || {});
  if (isNgrokHost(url)) {
    headers.set('ngrok-skip-browser-warning', '1');
  }
  return { ...options, headers };
};

const isLocalRuntime = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
};

const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = (localStorage.getItem(DB_KEYS.AUTH_TOKEN) || '').trim();
  return token || null;
};

const saveAuthToken = (token: unknown) => {
  if (typeof window === 'undefined') return;
  if (typeof token === 'string' && token.trim().length > 0) {
    localStorage.setItem(DB_KEYS.AUTH_TOKEN, token.trim());
    return;
  }
  localStorage.removeItem(DB_KEYS.AUTH_TOKEN);
};

let lastOfflineAlertAt = 0;
const notifyOffline = () => {
  if (isLocalRuntime()) return;
  const now = Date.now();
  if (now - lastOfflineAlertAt < 8000) return;
  lastOfflineAlertAt = now;
  alert("SYSTEM OFFLINE: Please turn on the backend and database on Walter's laptop.");
};

const resolveApiBase = () => {
  if (typeof window === 'undefined') {
    return normalizeApiBase(String(import.meta.env.VITE_API_BASE_URL || '')) || '/api';
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('apiBase');
  if (fromQuery) {
    if (fromQuery.toLowerCase() === 'clear') {
      localStorage.removeItem(DB_KEYS.API_BASE_OVERRIDE);
      return normalizeApiBase(String(import.meta.env.VITE_API_BASE_URL || '')) || '/api';
    }
    const normalized = normalizeApiBase(fromQuery);
    if (normalized) {
      localStorage.setItem(DB_KEYS.API_BASE_OVERRIDE, normalized);
      return normalized;
    }
  }

  // Local development should always use Vite proxy for smooth localhost workflow.
  if (isLocalRuntime()) {
    return '/api';
  }

  const fromStorage = normalizeApiBase(localStorage.getItem(DB_KEYS.API_BASE_OVERRIDE) || '');
  if (fromStorage) return fromStorage;

  const fromEnv = normalizeApiBase(String(import.meta.env.VITE_API_BASE_URL || ''));
  if (fromEnv) return fromEnv;

  return '/api';
};

let API_BASE = resolveApiBase();

const DEFAULT_RECEIPT_LAYOUT: ReceiptLayoutSettings = {
  businessName: 'Rodriguez Jewelry',
  headerNote: 'Authorized Sale Record',
  footerNote: 'This receipt serves as your proof of transaction.',
  thankYouNote: 'Thank you for your purchase.',
  officialReceiptLabel: 'Official Receipt',
  acknowledgementReceiptLabel: 'Acknowledgement Receipt',
  accentColor: '#4f46e5',
  defaultReceiptType: 'OR',
  receiptSavePath: 'receipts'
};

const parseSession = (): { user: User; loginAt: string } | null => {
  const raw = localStorage.getItem(DB_KEYS.SESSION);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.user) {
      const loginAt = parsed.loginAt || new Date().toISOString();
      if (!parsed.loginAt) {
        localStorage.setItem(DB_KEYS.SESSION, JSON.stringify({ ...parsed, loginAt }));
      }
      return { user: parsed.user, loginAt };
    }
    // Legacy session without user object -> clear it
    localStorage.removeItem(DB_KEYS.SESSION);
    return null;
  } catch {
    return null;
  }
};

const saveSession = (user: User, loginAt?: string) => {
  const sessionLoginAt = loginAt || new Date().toISOString();
  localStorage.setItem(DB_KEYS.SESSION, JSON.stringify({ user, loginAt: sessionLoginAt }));
};

const clearSession = () => {
  localStorage.removeItem(DB_KEYS.SESSION);
  localStorage.removeItem(DB_KEYS.AUTH_TOKEN);
};

const fetchJson = async (url: string, options?: RequestInit) => {
  try {
    const requestOptions = withNgrokBypassHeader(url, options);
    const headers = new Headers(requestOptions.headers || {});
    const token = getStoredAuthToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(url, { ...requestOptions, headers, credentials: 'include' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        clearSession();
      }
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        notifyOffline();
      }
      throw new Error(data.message || `API Error: ${response.status}`);
    }
    return await response.json();
  } catch (err: any) {
    if (
      err?.name === 'TypeError' ||
      String(err?.message || '').includes('Failed to fetch') ||
      String(err?.message || '').includes('NetworkError')
    ) {
      notifyOffline();
    }
    console.error(`Network or API Error at ${url}:`, err);
    throw err;
  }
};

const extractUser = (raw: any) => raw?.user ?? raw;

const normalizeUser = (raw: any): User => ({
  ...raw,
  firstName: raw?.first_name ?? raw?.firstName,
  lastName: raw?.last_name ?? raw?.lastName,
  profilePicture: raw?.profile_picture ?? raw?.profilePicture
});

export const db = {
  getApiBase: (): string => API_BASE,

  getApiRequestOptions: (url: string, options: RequestInit = {}): RequestInit => {
    const requestOptions = withNgrokBypassHeader(url, options);
    const headers = new Headers(requestOptions.headers || {});
    const token = getStoredAuthToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return { ...requestOptions, headers, credentials: 'include' };
  },

  getApiBaseOverride: (): string | null => {
    if (typeof window === 'undefined') return null;
    const value = normalizeApiBase(localStorage.getItem(DB_KEYS.API_BASE_OVERRIDE) || '');
    return value || null;
  },

  setApiBaseOverride: (raw: string): string => {
    const normalized = normalizeApiBase(raw);
    if (!normalized) {
      throw new Error('Please enter a valid API URL');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(DB_KEYS.API_BASE_OVERRIDE, normalized);
    }
    API_BASE = normalized;
    return API_BASE;
  },

  clearApiBaseOverride: (): string => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DB_KEYS.API_BASE_OVERRIDE);
    }
    const fromEnv = normalizeApiBase(String(import.meta.env.VITE_API_BASE_URL || ''));
    API_BASE = fromEnv || '/api';
    return API_BASE;
  },

  init: async () => {
    console.log('Database client initialized - Rodriguez Rizal Branch active');
  },

  getSettings: async (): Promise<SystemSettings> => {
    const data = await fetchJson(`${API_BASE}/settings`);
    const backupSettings = (() => {
        if (!data?.backup_settings) return {};
        if (typeof data.backup_settings === 'string') {
            try { return JSON.parse(data.backup_settings); } catch { return {}; }
        }
        return data.backup_settings;
    })();
    const receiptLayout = (() => {
        if (!data?.receipt_layout) return { ...DEFAULT_RECEIPT_LAYOUT };
        const parsedLayout = typeof data.receipt_layout === 'string'
          ? (() => { try { return JSON.parse(data.receipt_layout); } catch { return {}; } })()
          : data.receipt_layout;
        return { ...DEFAULT_RECEIPT_LAYOUT, ...(parsedLayout || {}) };
    })();
    return {
        branchName: data.branch_name,
        currencySymbol: data.currency_symbol,
        taxRate: parseFloat(data.tax_rate),
        lowStockThreshold: data.low_stock_threshold,
        timeFormat: data.time_format,
        receiptAutoPrint: data.receipt_auto_print,
        profitMargin: parseFloat(data.profit_margin),
        maxImagesPerProduct: data.max_images_per_product,
        staffCanEditPrice: data.staff_can_edit_price,
        adminPin: '',
        hasAdminPin: !!data.has_admin_pin,
        sessionTimeoutMinutes: data.session_timeout_minutes,
        branches: data.branches || [],
        receiptLayout,
        backupSettings
    };
  },

  saveSettings: async (settings: SystemSettings) => {
    const payload: any = { ...settings };
    if (!payload.adminPin || payload.adminPin.trim() === '') {
      delete payload.adminPin;
    }
    await fetchJson(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    db.addLog(db.getCurrentUser()?.username || 'System', 'Updated Settings', 'System Config');
  },

  getUsers: async (): Promise<User[]> => {
    try {
        const users = await fetchJson(`${API_BASE}/users`);
        return users.map((u: any) => normalizeUser(u));
    } catch (err) {
        return [];
    }
  },

  updateUserStatus: async (username: string, status: 'active' | 'disabled') => {
    await fetchJson(`${API_BASE}/users/${username}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    db.addLog(db.getCurrentUser()?.username || 'System', 'Updated User Status', `${username} -> ${status}`);
  },

  updateUserProfile: async (username: string, firstName: string, lastName: string, profilePicture?: string) => {
    await fetchJson(`${API_BASE}/users/${username}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, profilePicture })
    });
  },

  changePassword: async (username: string, currentPassword: string, newPassword: string, adminPin?: string): Promise<{ success: boolean; message: string }> => {
    try {
        await fetchJson(`${API_BASE}/users/${username}/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword, adminPin })
        });
        db.addLog(db.getCurrentUser()?.username || 'System', 'Password Changed', username);
        return { success: true, message: 'Password updated successfully' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Password change failed' };
    }
  },

  verifyAdminPin: async (pin: string): Promise<boolean> => {
    if (!pin || pin.trim().length === 0) return false;
    try {
      const result = await fetchJson(`${API_BASE}/admin/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      return !!result?.valid;
    } catch (err) {
      return false;
    }
  },

  deleteUser: async (username: string) => {
    await fetchJson(`${API_BASE}/users/${username}`, { method: 'DELETE' });
    db.addLog(db.getCurrentUser()?.username || 'System', 'Deleted User', username);
  },

  register: async (username: string, password: string, role: 'admin' | 'staff' = 'staff', firstName?: string, lastName?: string, registrationCode?: string): Promise<{ success: boolean; message: string }> => {
    try {
        await fetchJson(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, firstName, lastName, registrationCode })
        });
        return { success: true, message: 'Account created' };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
  },

  login: async (username: string, password: string): Promise<User | null> => {
    try {
      const rawUser = await fetchJson(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const userPayload = extractUser(rawUser);
      const user = normalizeUser(userPayload);
      saveAuthToken(rawUser?.token);
      saveSession(user);
      db.addLog(username, 'Login', 'Session Started');
      return user;
    } catch (err) {
      return null;
    }
  },

  // Secure QR Login
  loginViaQR: async (token: string): Promise<User | null> => {
    try {
      const rawUser = await fetchJson(`${API_BASE}/login/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const userPayload = extractUser(rawUser);
      const user = normalizeUser(userPayload);
      saveAuthToken(rawUser?.token);
      saveSession(user);
      db.addLog(user.username, 'QR Login', 'Authenticated via Badge');
      return user;
    } catch (err) {
      return null;
    }
  },

  // Verify QR Token without logging in (for print verification)
  verifyQRToken: async (token: string): Promise<User | null> => {
     try {
        const rawUser = await fetchJson(`${API_BASE}/login/qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        const userPayload = extractUser(rawUser);
        const user = normalizeUser(userPayload);
        
        // Log the verification separately (not as a login)
        const currentUser = db.getCurrentUser();
        if (currentUser) {
            db.addLog(currentUser.username, 'QR Verification', `Verified ${user.username} for document signing`);
        }
        
        return user;
     } catch (err) {
         return null;
     }
  },

  saveQRToken: async (username: string): Promise<string | null> => {
    const result = await fetchJson(`${API_BASE}/qr-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    db.addLog(db.getCurrentUser()?.username || 'System', 'Generated QR Badge', username);
    return result?.token || null;
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const uploadUrl = `${API_BASE}/upload`;
    const response = await fetch(
      uploadUrl,
      db.getApiRequestOptions(uploadUrl, {
        method: 'POST',
        body: formData,
      })
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `Upload failed: ${response.status}`);
    }
    const data = await response.json();
    return data.url;
  },

  getCurrentUser: (): User | null => {
    const session = parseSession();
    return session?.user || null;
  },

  getSessionInfo: (): { user: User; loginAt: string } | null => {
    return parseSession();
  },

  getAuthHeaders: (): HeadersInit => {
    return {};
  },

  getFullName: (user: User | null): string => {
    if (!user) return '';
    const first = (user as any).firstName ?? (user as any).first_name ?? '';
    const last = (user as any).lastName ?? (user as any).last_name ?? '';
    if (first || last) {
      return `${first || ''} ${last || ''}`.trim();
    }
    return user.username;
  },

  updateSessionUser: (updates: Partial<User>) => {
    const session = parseSession();
    if (!session?.user) return;
    const updated = { ...session.user, ...updates };
    saveSession(updated, session.loginAt);
  },

  logout: async () => {
    const user = db.getCurrentUser();
    if (user) db.addLog(user.username, 'Logout', 'Session Ended');
    await fetchJson(`${API_BASE}/logout`, { method: 'POST' }).catch(() => {});
    clearSession();
  },

  getProducts: async (): Promise<Product[]> => {
    const raw = await fetchJson(`${API_BASE}/products`);
    return raw.map((p: any) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        price: parseFloat(p.price),
        weightGrams: parseFloat(p.weight_grams),
        specs: p.specs,
        detailedDescription: p.detailed_description,
        material: p.material,
        materialGrade: p.material_grade,
        mainImage: p.main_image,
        thumbnails: p.thumbnails || [],
        category: p.category
    }));
  },

  saveProduct: async (product: Product, isNew: boolean) => {
    await fetchJson(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    });
    
    if (isNew) {
      db.addLog(db.getCurrentUser()?.username || 'System', 'Added Product', `ID:${product.id} | QTY:${product.stock} | ${product.name}`);
    } else {
      db.addLog(db.getCurrentUser()?.username || 'System', 'Updated Metadata', `ID:${product.id} | ${product.name}`);
    }
  },

  deleteProduct: async (id: string) => {
    await fetchJson(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    db.addLog(db.getCurrentUser()?.username || 'System', 'Archived Product', `ID: ${id}`);
  },

  updateStock: async (id: string, newStock: number) => {
    await fetchJson(`${API_BASE}/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock })
    });
    db.addLog(db.getCurrentUser()?.username || 'System', 'Stock Adjusted', `ID: ${id} -> ${newStock}`);
  },

  // Receive Delivery - adds stock and logs it as a delivery
  receiveDelivery: async (id: string, quantity: number, productName: string) => {
    const products = await db.getProducts();
    const p = products.find(prod => prod.id === id);
    const newStock = (p?.stock || 0) + quantity;

    await fetchJson(`${API_BASE}/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock })
    });
    
    // Crucial: Use a standard format "QTY:X" for the report to read
    db.addLog(db.getCurrentUser()?.username || 'System', 'Delivery Received', `ID:${id} | QTY:${quantity} | ${productName}`);
  },

  getSales: async (): Promise<Sale[]> => {
    const raw = await fetchJson(`${API_BASE}/sales`);
    return raw.map((s: any) => ({
        id: s.id,
        orNumber: s.or_number,
        receiptType: (s.receipt_type || s.receiptType || 'OR') as ReceiptType,
        timestamp: new Date(s.timestamp).toLocaleString(),
        staff: s.staff,
        total: parseFloat(s.total),
        amountReceived: s.amount_received != null
          ? parseFloat(s.amount_received)
          : (s.amountReceived != null ? parseFloat(s.amountReceived) : parseFloat(s.total)),
        changeAmount: s.change_amount != null
          ? parseFloat(s.change_amount)
          : (s.changeAmount != null ? parseFloat(s.changeAmount) : 0),
        items: s.items,
        status: s.status || 'completed',
        reissued: s.reissued,
        reissueDate: s.reissue_date,
        reissueAdmin: s.reissue_admin
    }));
  },

  voidSale: async (saleId: string, pin: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await fetchJson(`${API_BASE}/sales/${encodeURIComponent(saleId)}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      db.addLog(db.getCurrentUser()?.username || 'System', 'Sale Voided', `ID:${saleId}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  purgeUnusedUploads: async (): Promise<{ success: boolean; deleted?: number; total?: number; kept?: number; message?: string }> => {
    try {
      const result = await fetchJson(`${API_BASE}/uploads/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return { success: true, deleted: result.deleted, total: result.total, kept: result.kept };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  getInventorySnapshots: async (date: string): Promise<{ productId: string; closingStock: number; snapshotDate: string }[]> => {
    const raw = await fetchJson(`${API_BASE}/inventory-snapshots?date=${encodeURIComponent(date)}`);
    return raw.map((r: any) => ({
      productId: r.product_id,
      closingStock: Number(r.closing_stock),
      snapshotDate: r.snapshot_date
    }));
  },

  runInventorySnapshot: async (date?: string) => {
    await fetchJson(`${API_BASE}/inventory-snapshots/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });
  },

  runServerBackup: async (path?: string): Promise<{ success: boolean; files?: { sql?: string; uploadsZip?: string | null }; settings?: any }> => {
    return await fetchJson(`${API_BASE}/backup/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
  },

  saveReceiptImage: async (payload: {
    imageData: string;
    orNumber?: string;
    receiptType?: ReceiptType;
    saleId?: string;
    savePath?: string;
  }): Promise<{ success: boolean; filePath?: string }> => {
    return await fetchJson(`${API_BASE}/receipts/save-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  pickFolderPath: async (title?: string): Promise<{ success: boolean; path?: string | null }> => {
    return await fetchJson(`${API_BASE}/system/select-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
  },

  scheduleServerBackup: async (config: {
    enabled: boolean;
    time?: string;
    path?: string;
    provider?: string;
    taskName?: string;
  }): Promise<{ success: boolean; taskName?: string; settings?: any }> => {
    return await fetchJson(`${API_BASE}/backup/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  },

  getNextOrNumber: async (): Promise<string> => {
    try {
        const data = await fetchJson(`${API_BASE}/sales/next-or`);
        return data?.nextOr || '0001';
    } catch (err) {
        return '0001';
    }
  },

  completeSale: async (
    items: CartItem[],
    staff: string,
    orNumber: string,
    receiptType: ReceiptType = 'OR',
    amountReceived?: number,
    changeAmount?: number
  ) => {
    const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    const result = await fetchJson(`${API_BASE}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orNumber, staff, total, items, receiptType, amountReceived, changeAmount })
    });
    db.addLog(staff, 'Sale Completed', `${receiptType}#${orNumber} - ₱${total.toLocaleString()}`);
    return result;
  },

  getLogs: async (): Promise<Activity[]> => {
    return await fetchJson(`${API_BASE}/logs`);
  },
  
  addLog: async (user: string, action: string, item: string) => {
    try {
        await fetchJson(`${API_BASE}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, action, item })
        });
    } catch (err) { /* silent log failure */ }
  },

  getAvailableYears: async (): Promise<number[]> => {
    const sales = await db.getSales();
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    sales.filter(s => s.status !== 'void').forEach(s => {
      const d = new Date(s.timestamp);
      if(!isNaN(d.getTime())) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  },

  getRevenue: async (year?: number): Promise<RevenueData[]> => {
    const sales = await db.getSales();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const targetYear = year || new Date().getFullYear();

    const dataMap: Record<string, number> = {};
    months.forEach(m => dataMap[m] = 0);

    sales.filter(s => s.status !== 'void').forEach(sale => {
      const d = new Date(sale.timestamp);
      if (d.getFullYear() === targetYear) {
        const m = months[d.getMonth()];
        dataMap[m] += sale.total;
      }
    });

    return months.map(m => ({
      month: m,
      year: targetYear,
      revenue: dataMap[m]
    }));
  }
};
