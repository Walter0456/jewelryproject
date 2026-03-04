
import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { RevenueData } from '../types';

interface RevenueChartProps {
  data: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isComparison = payload.length > 1;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700">
        <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="text-[9px] font-black" style={{ color: p.fill }}>{p.name}</span>
              <p className="text-xs font-bold">₱{p.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const isComparison = data.length > 0 && 'revenueA' in data[0];

  return (
    <div className="w-full h-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="month" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          tickFormatter={(value) => `₱${value >= 1000 ? (value / 1000) + 'k' : value}`}
        />
        <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
        
        {isComparison ? (
          <>
            <Bar dataKey="revenueA" name="Year A" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="revenueB" name="Year B" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
          </>
        ) : (
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={40}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.revenue === Math.max(...data.map((d: any) => d.revenue)) ? '#4f46e5' : '#818cf8'} 
                className="hover:fill-indigo-700 transition-colors duration-200 cursor-pointer"
              />
            ))}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;

