
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Package, BarChart3, ClipboardList, Settings, LogOut, 
  User as UserIcon, Menu, X, Store, Users as UsersIcon, ChevronDown, ChevronRight,
  CheckCircle, AlertCircle, Info
} from 'lucide-react';
import { NavItem, Product, Activity, User, Sale, SystemSettings } from './types';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import POSView from './components/POSView';
import AuthView from './components/AuthView';
import ActivityLog from './components/ActivityLog';
import UserManagementView from './components/UserManagementView';
import DailyInventoryReport from './components/Reports/DailyInventoryReport';
import EmployeeAnalytics from './components/EmployeeAnalytics';
import EmployeeRegistry from './components/EmployeeRegistry';
import BusinessRevenue from './components/Reports/BusinessRevenue';
import SalesReport from './components/Reports/SalesReport';
import SettingsView from './components/SettingsView';
import { db } from './db';

// Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle size={16} className="text-emerald-500" />,
    error: <AlertCircle size={16} className="text-rose-500" />,
    info: <Info size={16} className="text-indigo-500" />
  };

  const bgStyles = {
    success: 'bg-emerald-50 border-emerald-100',
    error: 'bg-rose-50 border-rose-100',
    info: 'bg-indigo-50 border-indigo-100'
  };

  return (
    <div className={`fixed bottom-6 right-6 z-100 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl animate-in slide-in-from-right duration-300 ${bgStyles[type]}`}>
      {icons[type]}
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-800">{message}</p>
      <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full"><X size={12} className="text-slate-400" /></button>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavItem>(NavItem.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    [NavItem.USER_MGMT]: false,
    [NavItem.REPORTS]: false
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<Activity[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSessionWarning, setIsSessionWarning] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  const refreshData = useCallback(async () => {
    try {
        const [prodData, logData, userData, saleData, settingsData] = await Promise.all([
            db.getProducts(),
            db.getLogs(),
            db.getUsers(),
            db.getSales(),
            db.getSettings()
        ]);
        setProducts(prodData);
        setLogs(logData);
        setAllUsers(userData);
        setSales(saleData);
        setSettings(settingsData);
    } catch (err) {
        console.error("Failed to refresh data:", err);
        showToast("System connection issue", "error");
    }
  }, [showToast]);

  useEffect(() => {
    const initApp = async () => {
        await db.init();
        const currentUser = db.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            setActiveTab(currentUser.role === 'admin' ? NavItem.DASHBOARD : NavItem.POS);
            await refreshData();
        }
    };
    initApp();
  }, [refreshData]);

  const handleLogin = (u: User) => {
    setUser(u);
    setActiveTab(u.role === 'admin' ? NavItem.DASHBOARD : NavItem.POS);
    refreshData();
    showToast(`Welcome back, ${db.getFullName(u)}`);
  };

  const handleLogout = () => {
    db.logout();
    setUser(null);
    setIsSidebarOpen(false);
    showToast("Logged out successfully", "info");
  };

  // Session timeout management
  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (hardTimeoutRef.current) {
      clearTimeout(hardTimeoutRef.current);
      hardTimeoutRef.current = null;
    }
    
    if (!settings || !user) return;
    
    // Reset warning state on activity
    setIsSessionWarning(false);

    // Business rule: enforce 30-minute max session timeout
    const timeoutMinutes = Math.min(settings.sessionTimeoutMinutes || 30, 30);
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = timeoutMs - (5 * 60 * 1000); // 5 minutes before timeout

    const newTimeout = setTimeout(() => {
      // Auto logout after timeout
      handleLogout();
      showToast("Session expired due to inactivity", "error");
    }, timeoutMs);

    sessionTimeoutRef.current = newTimeout;

    // Show warning 5 minutes before timeout
    if (warningMs > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        setIsSessionWarning(true);
      }, warningMs);
    }

    // Hard session limit (absolute) based on login time
    const sessionInfo = db.getSessionInfo();
    const loginAt = sessionInfo?.loginAt;
    if (loginAt) {
      const loginTime = new Date(loginAt).getTime();
      const elapsed = Date.now() - loginTime;
      const remaining = timeoutMs - elapsed;
      if (remaining <= 0) {
        handleLogout();
        showToast("Session expired due to timeout", "error");
        return;
      }
      hardTimeoutRef.current = setTimeout(() => {
        handleLogout();
        showToast("Session expired due to timeout", "error");
      }, remaining);
    }
  }, [settings, user, showToast, handleLogout]);

  const extendSession = useCallback(() => {
    setIsSessionWarning(false);
    resetSessionTimeout();
  }, [resetSessionTimeout]);

  // Activity detection
  useEffect(() => {
    if (!user || !settings) return;

    const handleActivity = () => {
      resetSessionTimeout();
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize timeout
    resetSessionTimeout();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (hardTimeoutRef.current) {
        clearTimeout(hardTimeoutRef.current);
        hardTimeoutRef.current = null;
      }
    };
  }, [user, settings, resetSessionTimeout]);

  const toggleSubMenu = (menu: string) => {
    setExpandedMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const mainNavItems = useMemo(() => {
    if (!user) return [];
    const items = [];
    
    if (user.role === 'admin') {
      items.push({ name: NavItem.DASHBOARD, icon: <LayoutDashboard size={18} /> });
      items.push({ name: NavItem.POS, icon: <Store size={18} /> });
      items.push({ name: NavItem.INVENTORY, icon: <Package size={18} /> });
      
      items.push({ 
        name: NavItem.USER_MGMT, 
        icon: <UsersIcon size={18} />, 
        hasSub: true,
        subItems: [NavItem.EMPLOYEE_ANALYTICS, NavItem.EMPLOYEE_REGISTRY]
      });

      items.push({ 
        name: NavItem.REPORTS, 
        icon: <BarChart3 size={18} />, 
        hasSub: true,
        subItems: [NavItem.DAILY_INVENTORY_REPORT, NavItem.SALES_REPORT, NavItem.BUSINESS_REVENUE]
      });

      items.push({ name: NavItem.LOGS, icon: <ClipboardList size={18} /> });
      items.push({ name: NavItem.SETTINGS, icon: <Settings size={18} /> });
    } else {
      items.push({ name: NavItem.POS, icon: <Store size={18} /> });
      items.push({ name: NavItem.INVENTORY, icon: <Package size={18} /> });
      items.push({ name: NavItem.MY_LOGS, icon: <ClipboardList size={18} /> });
    }
    return items;
  }, [user]);

  if (!user) return <AuthView onLoginSuccess={handleLogin} />;
  if (!settings) return <div className="flex items-center justify-center h-screen bg-slate-900 text-white font-black uppercase">Syncing with Rodriguez Rizal Branch...</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-sm">
      {/* Toast Portal */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm no-print"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-slate-900 text-white transition-transform duration-300 no-print ${
        user.role === 'admin' 
          ? 'lg:relative lg:translate-x-0' 
          : 'lg:hidden'
      } ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex flex-col h-full">
          <div className="flex flex-col px-6 py-4 bg-slate-950 border-b border-white/5">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-600/20">J</div>
              <span className="text-base font-black tracking-tight uppercase">JewelAdmin</span>
            </div>
            <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-widest">{settings.branchName || 'Rodriguez Rizal'} Branch</span>
          </div>
          
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {mainNavItems.map((item) => (
              <div key={item.name}>
                {item.hasSub ? (
                  <>
                    <button 
                      onClick={() => toggleSubMenu(item.name)}
                      className={`flex items-center justify-between w-full px-3 py-2 space-x-3 rounded-lg transition-all ${activeTab.includes(item.name) ? 'text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                      <div className="flex items-center space-x-3">
                        {item.icon}
                        <span className="font-bold text-[10px] uppercase tracking-wider">{item.name}</span>
                      </div>
                      {expandedMenus[item.name] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {expandedMenus[item.name] && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.subItems?.map(sub => (
                          <button
                            key={sub}
                            onClick={() => { setActiveTab(sub); if(window.innerWidth < 1024) setIsSidebarOpen(false); }}
                            className={`flex items-center w-full px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === sub ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                          >
                           {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button 
                    onClick={() => { setActiveTab(item.name); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
                    className={`flex items-center w-full px-3 py-2 space-x-3 rounded-lg transition-all ${activeTab === item.name ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    {item.icon} <span className="font-bold text-[10px] uppercase tracking-wider">{item.name}</span>
                  </button>
                )}
              </div>
            ))}
          </nav>

          {/* Only show logout in sidebar for Admin */}
          {user.role === 'admin' && (
            <div className="p-3 bg-slate-950/50 border-t border-white/5">
               <button onClick={handleLogout} className="flex items-center w-full space-x-3 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors">
                 <LogOut size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
               </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10 no-print">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden"><Menu size={20} /></button>
            
            {/* Header Branding & Nav for Staff Desktop */}
            {user.role !== 'admin' && (
              <div className="hidden lg:flex items-center gap-6">
                 <div className="flex items-center space-x-2 mr-4">
                    <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-600/20">J</div>
                    <div>
                      <span className="text-base font-black tracking-tight uppercase text-slate-900 leading-none block">JewelAdmin</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{settings.branchName}</span>
                    </div>
                  </div>
                  
                  <nav className="flex items-center gap-1">
                    {mainNavItems.map(item => (
                      <button
                        key={item.name}
                        onClick={() => setActiveTab(item.name)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                          activeTab === item.name 
                            ? 'bg-slate-100 text-indigo-600' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        {item.icon} {item.name}
                      </button>
                    ))}
                  </nav>
              </div>
            )}

            <h1 className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ${user.role !== 'admin' ? 'lg:hidden' : ''}`}>{activeTab}</h1>
          </div>
          
          <div className="flex items-center space-x-3">
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-900 uppercase">
                  {user.lastName ? user.lastName : user.username}
                </p>
                <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-tight">{user.role}</p>
             </div>
             
             {/* User Profile & Dropdown */}
             <div className="relative">
               <button 
                 onClick={() => setUserMenuOpen(!userMenuOpen)}
                 className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 overflow-hidden hover:ring-2 hover:ring-indigo-600/20 transition-all focus:outline-none"
               >
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={14} />
                  )}
               </button>

               {/* Dropdown Menu */}
               {userMenuOpen && (
                 <>
                   <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)}></div>
                   <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                     <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                       <p className="text-[10px] font-black text-slate-900 uppercase truncate">{db.getFullName(user)}</p>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">@{user.username}</p>
                     </div>
                     <div className="p-1">
                       <button 
                         onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                         className="flex items-center w-full gap-2 px-3 py-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors text-[10px] font-black uppercase tracking-widest"
                       >
                         <LogOut size={14} /> Sign Out
                       </button>
                     </div>
                   </div>
                 </>
               )}
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {activeTab === NavItem.DASHBOARD && <DashboardView user={user} products={products} logs={logs} sales={sales} users={allUsers} settings={settings} onUpdateStock={async (id, s) => { await db.updateStock(id, s); showToast("Stock updated"); refreshData(); }} />}
          {activeTab === NavItem.POS && <POSView products={products} onSaleComplete={() => { showToast("Sale Recorded"); refreshData(); }} users={allUsers} settings={settings} />}
          {activeTab === NavItem.INVENTORY && <InventoryView products={products} readOnly={user.role !== 'admin'} onUpdateStock={async (id, s) => { await db.updateStock(id, s); showToast("Stock updated"); refreshData(); }} onDelete={async id => { await db.deleteProduct(id); showToast("Item archived", "info"); refreshData(); }} onAdd={() => { showToast("Product Saved"); refreshData(); }} />}
          {activeTab === NavItem.USER_MGMT && <UserManagementView users={allUsers} settings={settings} onDeleteUser={async username => { await db.deleteUser(username); showToast("User removed", "info"); refreshData(); }} />}
          {activeTab === NavItem.EMPLOYEE_ANALYTICS && <EmployeeAnalytics sales={sales} users={allUsers} />}
          {activeTab === NavItem.EMPLOYEE_REGISTRY && <EmployeeRegistry />}
          {activeTab === NavItem.DAILY_INVENTORY_REPORT && <DailyInventoryReport products={products} logs={logs} sales={sales} users={allUsers} />}
          {activeTab === NavItem.SALES_REPORT && <SalesReport sales={sales} />}
          {activeTab === NavItem.BUSINESS_REVENUE && <BusinessRevenue sales={sales} />}
          {activeTab === NavItem.SETTINGS && <SettingsView onSettingsUpdate={() => { showToast("Global settings applied"); refreshData(); }} initialSettings={settings} initialUsers={allUsers} onProfileUpdate={refreshData} />}
          {activeTab === NavItem.MY_LOGS && <div className="bg-white rounded-xl border border-slate-200 p-6"><h3 className="text-xs font-black text-slate-800 uppercase mb-4">Operations History</h3><ActivityLog activities={logs.filter(l => l.user === user.username)} users={allUsers} showSearch /></div>}
          {activeTab === NavItem.LOGS && <div className="bg-white rounded-xl border border-slate-200 p-6"><h3 className="text-xs font-black text-slate-800 uppercase mb-4">Audit Trail</h3><ActivityLog activities={logs} users={allUsers} showSearch /></div>}
        </div>

        {/* Session Timeout Warning Modal */}
        {isSessionWarning && (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertCircle size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Session Expiring</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">5 minutes remaining</p>
                  </div>
                </div>
                <button 
                  onClick={extendSession}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-6">
                  Your session will expire due to inactivity in 5 minutes. Continue working to stay logged in.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={extendSession}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                    Continue Session
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex-1 py-3 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
