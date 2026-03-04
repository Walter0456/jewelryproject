
import React, { useMemo, useState, useEffect } from 'react';
import { Sale, RevenueData } from '../../types';
import { db } from '../../db';
import { TrendingUp, DollarSign, PieChart, ArrowUpRight, ChevronDown, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface BusinessRevenueProps {
  sales: Sale[];
}

const BusinessRevenue: React.FC<BusinessRevenueProps> = ({ sales }) => {
  // Fixed: properly handle async available years and revenue data using state
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearA, setYearA] = useState(new Date().getFullYear());
  const [yearB, setYearB] = useState(new Date().getFullYear() - 1);
  const [dataA, setDataA] = useState<RevenueData[]>([]);
  const [dataB, setDataB] = useState<RevenueData[]>([]);

  useEffect(() => {
    const fetchYears = async () => {
        const years = await db.getAvailableYears();
        setAvailableYears(years);
        if (years.length > 0 && !years.includes(yearA)) setYearA(years[0]);
    };
    fetchYears();
  }, [sales]);

  useEffect(() => {
    const fetchA = async () => {
        const data = await db.getRevenue(yearA);
        setDataA(data);
    };
    fetchA();
  }, [sales, yearA]);

  useEffect(() => {
    const fetchB = async () => {
        const data = await db.getRevenue(yearB);
        setDataB(data);
    };
    fetchB();
  }, [sales, yearB]);

  const comparisonData = useMemo(() => {
    return dataA.map((item, idx) => ({
      month: item.month,
      revenueA: item.revenue,
      revenueB: dataB[idx]?.revenue || 0,
      labelA: yearA.toString(),
      labelB: yearB.toString()
    }));
  }, [dataA, dataB, yearA, yearB]);

  const validSales = useMemo(() => sales.filter(s => s.status !== 'void'), [sales]);
  const totalRevenue = useMemo(() => validSales.reduce((sum, s) => sum + s.total, 0), [validSales]);
  const avgMonthly = useMemo(() => totalRevenue / (availableYears.length * 12 || 1), [totalRevenue, availableYears]);

  const dailySpikeData = useMemo(() => {
    const parsed = validSales
      .map((s) => ({ sale: s, date: new Date(s.timestamp) }))
      .filter((s) => !Number.isNaN(s.date.getTime()) && s.date.getFullYear() === yearA);

    if (parsed.length === 0) {
      return { label: `${yearA}`, data: [] as { day: string; revenue: number }[], total: 0 };
    }

    const monthTotals = new Array(12).fill(0);
    parsed.forEach(({ sale, date }) => {
      monthTotals[date.getMonth()] += sale.total || 0;
    });

    let peakMonth = 0;
    let peakTotal = monthTotals[0] || 0;
    monthTotals.forEach((value, idx) => {
      if (value > peakTotal) {
        peakTotal = value;
        peakMonth = idx;
      }
    });

    const daysInMonth = new Date(yearA, peakMonth + 1, 0).getDate();
    const dailyTotals = new Array(daysInMonth).fill(0);
    parsed.forEach(({ sale, date }) => {
      if (date.getMonth() === peakMonth) {
        dailyTotals[date.getDate() - 1] += sale.total || 0;
      }
    });

    const label = new Date(yearA, peakMonth, 1).toLocaleString(undefined, { month: 'long' });
    const data = dailyTotals.map((revenue, idx) => ({
      day: String(idx + 1).padStart(2, '0'),
      revenue
    }));

    return { label, data, total: peakTotal };
  }, [validSales, yearA]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase">Revenue Intelligence</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Real-time financial status & projections</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-0.5">Year A</span>
              <div className="relative min-w-[100px]">
                <select 
                  className="w-full bg-indigo-50 border-none rounded-lg py-1.5 pl-3 pr-8 text-[10px] font-black text-indigo-700 outline-none appearance-none cursor-pointer"
                  value={yearA}
                  onChange={(e) => setYearA(parseInt(e.target.value))}
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
              </div>
           </div>
           
           <div className="text-slate-300 font-black text-xs pt-4">VS</div>

           <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-0.5">Year B</span>
              <div className="relative min-w-[100px]">
                <select 
                  className="w-full bg-slate-50 border-none rounded-lg py-1.5 pl-3 pr-8 text-[10px] font-black text-slate-700 outline-none appearance-none cursor-pointer"
                  value={yearB}
                  onChange={(e) => setYearB(parseInt(e.target.value))}
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4"><DollarSign size={20} /></div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gross Total Revenue</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">₱{totalRevenue.toLocaleString()}</h3>
            <div className="flex items-center gap-1 text-emerald-500 text-[8px] font-bold mt-2 uppercase tracking-tighter">
               <ArrowUpRight size={10} /> Active Growth Tracking
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4"><PieChart size={20} /></div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Avg Monthly Revenue</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">₱{Math.round(avgMonthly).toLocaleString()}</h3>
            <div className="flex items-center gap-1 text-slate-400 text-[8px] font-bold mt-2 uppercase tracking-tighter">
               All-time performance
            </div>
         </div>
         <div className="bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-900/20 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4"><TrendingUp size={20} className="text-indigo-400" /></div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Sales Volume</p>
            <h3 className="text-2xl font-black text-white mt-1">{validSales.length} <span className="text-xs text-slate-500 font-black">SALES</span></h3>
            <div className="flex items-center gap-1 text-indigo-400 text-[8px] font-bold mt-2 uppercase tracking-tighter">
               Audit Verified Data
            </div>
         </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[520px]">
         <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Monthly Revenue Comparison</h3>
              <div className="flex items-center gap-4 text-[9px] font-black uppercase">
                 <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-600"></span> {yearA}</div>
                 <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> {yearB}</div>
              </div>
            </div>
            <div className="text-right">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Comparison Mode</p>
               <p className="text-sm font-black text-slate-900 uppercase">Yearly Variance</p>
            </div>
         </div>
         
         <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `₱${v/1000}k`} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-800 min-w-[140px]">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">{payload[0].payload.month}</p>
                          <div className="space-y-2">
                             <div className="flex items-center justify-between gap-4">
                                <span className="text-[9px] font-black uppercase text-indigo-400">{yearA}</span>
                                <span className="text-xs font-black">₱{payload[0].value?.toLocaleString()}</span>
                             </div>
                             <div className="flex items-center justify-between gap-4">
                                <span className="text-[9px] font-black uppercase text-slate-400">{yearB}</span>
                                <span className="text-xs font-black">₱{payload[1].value?.toLocaleString()}</span>
                             </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="revenueA" name={yearA.toString()} fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="revenueB" name={yearB.toString()} fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[420px]">
         <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Daily Revenue Spikes</h3>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-500">
                <Calendar size={12} className="text-indigo-500" />
                <span>{dailySpikeData.label} {yearA}</span>
              </div>
            </div>
            <div className="text-right">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Peak Month Total</p>
               <p className="text-sm font-black text-slate-900 uppercase">₱{Math.round(dailySpikeData.total).toLocaleString()}</p>
            </div>
         </div>

         <div className="flex-1 min-h-0">
            {dailySpikeData.data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                No sales data for {yearA}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={dailySpikeData.data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `₱${Math.round(v/1000)}k`} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-800 min-w-[140px]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">Day {payload[0].payload.day}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[9px] font-black uppercase text-indigo-400">{dailySpikeData.label}</span>
                              <span className="text-xs font-black">₱{payload[0].value?.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="revenue" name="Daily Revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={10} />
                 </BarChart>
              </ResponsiveContainer>
            )}
         </div>
      </div>
    </div>
  );
};

export default BusinessRevenue;
