
import React, { useState, useMemo, useEffect } from 'react';
import { Activity, User } from '../types';
import { Search, X } from 'lucide-react';
import Pagination from './Pagination';
import { TIME_RANGE_OPTIONS, TimeRange, isWithinRange } from '../utils/timeRange';

interface ActivityLogProps {
  activities: Activity[];
  users?: User[];
  showSearch?: boolean;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ activities, users = [], showSearch = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const getUserName = (username: string) => {
    const user = users.find(u => u.username === username);
    if (user && (user.firstName || user.lastName)) {
        return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return username;
  };

  const filteredActivities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return activities.filter(activity => {
      if (!term) return true;
      return (
        activity.action.toLowerCase().includes(term) ||
        activity.item.toLowerCase().includes(term) ||
        activity.timestamp.toLowerCase().includes(term) ||
        activity.user.toLowerCase().includes(term)
      );
    }).filter(activity => isWithinRange(activity.timestamp, timeRange));
  }, [activities, searchTerm, timeRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, timeRange, activities.length]);

  const effectivePageSize = itemsPerPage <= 0 ? filteredActivities.length || 1 : itemsPerPage;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedActivities = filteredActivities.slice(startIndex, startIndex + effectivePageSize);

  const clearSearch = () => setSearchTerm('');

  return (
    <div className="h-full flex flex-col">
      {showSearch && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search operations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={timeRange}
            onChange={(e) => { setTimeRange(e.target.value as TimeRange); setCurrentPage(1); }}
            className="bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            {TIME_RANGE_OPTIONS.map(option => (
              <option key={option} value={option}>{option === 'All' ? 'Whole Entries' : option}</option>
            ))}
          </select>
        </div>
      )}

      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-slate-100">
              <th className="py-2 px-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
              <th className="py-2 px-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">User</th>
              <th className="py-2 px-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">Action</th>
              <th className="py-2 px-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">Item / ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredActivities.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400 text-xs font-medium">
                  {searchTerm ? 'No operations found matching your search' : 'No operations recorded yet'}
                </td>
              </tr>
            ) : (
              paginatedActivities.map((activity) => (
                <tr key={activity.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-2 text-sm text-slate-600 tabular-nums">{activity.timestamp}</td>
                  <td className="py-3 px-2 text-sm">
                    <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {getUserName(activity.user)}
                      </span>
                  </td>
                  <td className="py-3 px-2 text-sm">
                    <span className={`
                      inline-block w-2 h-2 rounded-full mr-2
                      ${activity.action.includes('Added') ? 'bg-emerald-500' : 
                        activity.action.includes('Deleted') ? 'bg-rose-500' : 
                        activity.action.includes('Updated') ? 'bg-amber-500' : 'bg-indigo-500'}
                    `}></span>
                    <span className="text-slate-700">{activity.action}</span>
                  </td>
                  <td className="py-3 px-2 text-sm font-medium text-slate-800">{activity.item}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        totalItems={filteredActivities.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
      />
    </div>
  );
};

export default ActivityLog;
