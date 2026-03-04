
import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, DollarSign, AlertCircle, Calendar, BarChart2 } from 'lucide-react';
import RevenueChart from './RevenueChart';
import ActivityLog from './ActivityLog';
import LowStockGrid from './LowStockGrid';
import StatCard from './StatCard';
import { Product, Activity, User, Sale, RevenueData, SystemSettings } from '../types';
import { db } from '../db';

interface DashboardViewProps {
  user: User;
  products: Product[];
  logs: Activity[];
  sales: Sale[];
  users: User[];
  settings?: SystemSettings;
  onUpdateStock: (id: string, newStock: number) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ user, products, logs, sales, users, settings, onUpdateStock }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const isAdmin = user.role === 'admin';
  
  // Fixed: handle async revenue data fetching using state and useEffect
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);

  useEffect(() => {
    const fetchRevenue = async () => {
      const data = await db.getRevenue();
      setRevenueData(data);
    };
    fetchRevenue();
  }, [sales]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous <= 0) {
      return current > 0 ? '+100%' : '0%';
    }
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${Math.round(change)}%`;
  };

  const stats = useMemo(() => {
    const now = new Date();
    
    // TODAY VS YESTERDAY
    const todayStr = now.toLocaleDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();

    const todaySales = sales.filter(s => new Date(s.timestamp).toLocaleDateString() === todayStr);
    const totalToday = todaySales.reduce((sum, s) => sum + s.total, 0);

    const yesterdaySales = sales.filter(s => new Date(s.timestamp).toLocaleDateString() === yesterdayStr);
    const totalYesterday = yesterdaySales.reduce((sum, s) => sum + s.total, 0);
    const todayPercentage = calculatePercentageChange(totalToday, totalYesterday);

    // THIS WEEK (Last 7 Days) VS LAST WEEK (7-14 Days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);

    const thisWeekSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d >= sevenDaysAgo && d <= now;
    });
    const totalThisWeek = thisWeekSales.reduce((sum, s) => sum + s.total, 0);

    const lastWeekSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });
    const totalLastWeek = lastWeekSales.reduce((sum, s) => sum + s.total, 0);
    const weekPercentage = calculatePercentageChange(totalThisWeek, totalLastWeek);

    // TOTAL PROFIT (All time aggregate vs previous month block)
    // For "Total Profit", we'll compare current month profit vs previous month
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const prevMonthSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear;
    });

    const margin = (settings?.profitMargin ?? 35) / 100;
    const totalProfit = sales.reduce((sum, s) => sum + s.total, 0) * margin;
    
    const curMonthProfit = currentMonthSales.reduce((sum, s) => sum + s.total, 0) * margin;
    const prevMonthProfit = prevMonthSales.reduce((sum, s) => sum + s.total, 0) * margin;
    const profitPercentage = calculatePercentageChange(curMonthProfit, prevMonthProfit);

    // LOW STOCK
    const lowStockThreshold = settings?.lowStockThreshold ?? 3;
    const lowStockCount = products.filter(i => i.stock <= lowStockThreshold).length;

    return [
      { 
        title: 'Total Sales Today', 
        value: `₱${totalToday.toLocaleString()}`, 
        change: todayPercentage,
        icon: <TrendingUp className="text-indigo-600" size={24} />, 
        color: 'indigo' 
      },
      { 
        title: 'Total Sales This Week', 
        value: `₱${totalThisWeek.toLocaleString()}`, 
        change: weekPercentage, 
        icon: <BarChart2 className="text-emerald-600" size={24} />, 
        color: 'emerald' 
      },
      { 
        title: 'Total Profit', 
        value: `₱${Math.floor(totalProfit).toLocaleString()}`, 
        change: profitPercentage, 
        icon: <DollarSign className="text-amber-600" size={24} />, 
        color: 'amber' 
      },
      { 
        title: 'Low Stock Items', 
        value: `${lowStockCount}`, 
        change: 'Attention', 
        icon: <AlertCircle className="text-rose-600" size={24} />, 
        color: 'rose' 
      },
    ];
  }, [sales, products]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">GREETINGS {db.getFullName(user)}</h2>
          <p className="text-slate-500 mt-1 font-bold text-xs uppercase tracking-widest opacity-60">
            Here's your dashboard for today!
          </p>
        </div>
        <div className="flex items-center bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm font-black text-slate-800 text-xs uppercase tracking-tighter">
          <Calendar size={18} className="text-indigo-600 mr-2" />
          {currentTime.toLocaleTimeString()} | {currentTime.toLocaleDateString()}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => <StatCard key={idx} {...stat} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-120">
          <h3 className="text-xs font-black text-slate-400 mb-6 uppercase tracking-[0.2em]">Monthly Revenue</h3>
          <div className="flex-1 relative min-h-0">
            <RevenueChart data={revenueData} />
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-120">
          <h3 className="text-xs font-black text-slate-400 mb-6 uppercase tracking-[0.2em]">Activity Log</h3>
          <div className="flex-1 overflow-hidden">
            <ActivityLog 
              activities={isAdmin ? logs : logs.filter(l => l.user === user.username)} 
              users={users}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Near out of Stock Table</h3>
        <LowStockGrid 
          products={products.filter(p => p.stock <= (settings?.lowStockThreshold ?? 3))} 
          stockThreshold={settings?.lowStockThreshold ?? 3} 
          onUpdateStock={isAdmin ? onUpdateStock : undefined} 
          readOnly={!isAdmin}
        />
      </div>
    </div>
  );
};

export default DashboardView;
