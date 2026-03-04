
import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, color }) => {
  const isPositive = change.startsWith('+');
  const isNeutral = change === '0%' || change === 'Attention';
  const isNegative = change.startsWith('-');

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50',
    emerald: 'bg-emerald-50',
    amber: 'bg-amber-50',
    rose: 'bg-rose-50'
  };

  const bgColorClass = colorMap[color] || 'bg-slate-50';
  
  const getChangeBadgeStyles = () => {
    if (change === 'Attention') return 'text-rose-700 bg-rose-50';
    if (isNeutral) return 'text-slate-700 bg-slate-100';
    if (isPositive) return 'text-emerald-700 bg-emerald-50';
    if (isNegative) return 'text-rose-700 bg-rose-50';
    return 'text-slate-700 bg-slate-100';
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <h4 className="text-2xl font-black text-slate-900 tabular-nums uppercase tracking-tighter">{value}</h4>
          <div className="mt-2 flex items-center">
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${getChangeBadgeStyles()}`}>
              {change}
            </span>
            <span className="text-[9px] font-bold text-slate-400 ml-2 uppercase tracking-widest">from last period</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${bgColorClass} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
