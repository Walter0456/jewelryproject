
import React, { useMemo, useState, useEffect } from 'react';
import { User, Sale } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { db } from '../db';
import Pagination from './Pagination';
import { TIME_RANGE_OPTIONS, TimeRange, isWithinRange } from '../utils/timeRange';

interface EmployeeAnalyticsProps {
  sales: Sale[];
  users: User[];
}

const EmployeeAnalytics: React.FC<EmployeeAnalyticsProps> = ({ sales, users }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('Month');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredSales = useMemo(() => {
    return sales.filter(s => s.status !== 'void').filter(s => isWithinRange(s.timestamp, timeRange));
  }, [sales, timeRange]);

  const employeeStats = useMemo(() => {
    return users.map(u => {
      const userSales = filteredSales.filter(s => s.staff === u.username);
      const totalRevenue = userSales.reduce((sum, s) => sum + s.total, 0);
      const itemsSold = userSales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);
      const transactions = userSales.length;
      const avgSale = transactions > 0 ? totalRevenue / transactions : 0;
      
      // For deleted users, show their original name with "Deleted" label
      const fullName = db.getFullName(u);
      const displayName = u.status === 'deleted' 
        ? `DELETED: ${u.originalName || fullName}`
        : fullName;

      return {
        username: u.username,
        name: displayName,
        originalName: fullName,
        isDeleted: u.status === 'deleted',
        revenue: totalRevenue,
        items: itemsSold,
        tx: transactions,
        avg: avgSale
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, users]);

  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange, employeeStats.length]);

  const effectivePageSize = itemsPerPage <= 0 ? employeeStats.length || 1 : itemsPerPage;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedEmployees = employeeStats.slice(startIndex, startIndex + effectivePageSize);
  const getRevenueBarColor = (index: number) => {
    const total = employeeStats.length || 1;
    const fadeRatio = total <= 1 ? 0 : index / (total - 1);
    const alpha = Math.max(0.45, 1 - fadeRatio * 0.55);
    return `rgba(79, 70, 229, ${alpha.toFixed(2)})`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase">Employee Performance summary</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Audit-derived staff productivity metrics</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
          {TIME_RANGE_OPTIONS.map(option => (
            <button
              key={option}
              onClick={() => setTimeRange(option)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${timeRange === option ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {option === 'All' ? 'Whole' : option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Charts Section */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
           <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Revenue by Employee</h3>
           <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={employeeStats}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={40}>
                       {employeeStats.map((entry, index) => <Cell key={index} fill={getRevenueBarColor(index)} />)}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Top Performer Card */}
        <div className="lg:col-span-4 space-y-4">
           {employeeStats.slice(0, 3).map((emp, i) => (
             <div key={emp.name} className={`p-5 rounded-2xl border transition-all ${i === 0 ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl shadow-indigo-600/20' : 'bg-white text-slate-900 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${i === 0 ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{emp.name[0]}</div>
                   <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${i === 0 ? 'bg-white/20' : 'bg-emerald-50 text-emerald-600'}`}>{i === 0 ? 'Top Tier' : 'Verified'}</span>
                </div>
                <h4 className="text-sm font-black uppercase tracking-tight">{emp.name}</h4>
                <div className="grid grid-cols-2 gap-4 mt-4">
                   <div>
                      <p className={`text-[8px] font-bold uppercase tracking-widest ${i === 0 ? 'text-white/60' : 'text-slate-400'}`}>Sales</p>
                      <p className="text-base font-black tabular-nums">₱{emp.revenue.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className={`text-[8px] font-bold uppercase tracking-widest ${i === 0 ? 'text-white/60' : 'text-slate-400'}`}>Items</p>
                      <p className="text-base font-black tabular-nums">{emp.items}</p>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-[10px]">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Transactions</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Avg Sale</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Total Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginatedEmployees.map(emp => (
              <tr key={emp.name} className={`hover:bg-slate-50/50 transition-colors ${emp.isDeleted ? 'opacity-50 bg-slate-50/50' : ''}`}>
                <td className="px-6 py-4 font-black text-slate-900 uppercase">
                  {emp.name}
                  {emp.isDeleted && <span className="ml-2 text-[8px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">ARCHIVED</span>}
                </td>
                <td className="px-4 py-4 text-center font-bold text-slate-600">{emp.tx} Tx</td>
                <td className="px-4 py-4 text-center font-bold text-indigo-600">₱{emp.avg.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-black text-slate-900">₱{emp.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          totalItems={employeeStats.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
};

export default EmployeeAnalytics;
