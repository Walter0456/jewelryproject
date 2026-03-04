
import React, { useState, useEffect, useMemo } from 'react';
import { Key, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../db';
import { RegistrationCodeLog } from '../types';
import Pagination from './Pagination';
import { TIME_RANGE_OPTIONS, TimeRange, isWithinRange } from '../utils/timeRange';

const EmployeeRegistry = () => {
  const [logs, setLogs] = useState<RegistrationCodeLog[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [timeRange, setTimeRange] = useState<TimeRange>('All');
  const currentUser = db.getCurrentUser();

  const loadLogs = async () => {
    try {
      const response = await fetch(`${db.getApiBase()}/codes/logs`, {
        credentials: 'include',
        headers: db.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Make sure the backend server is running.');
      }
      
      const data = await response.json();
      setLogs(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load code logs:', err);
      setError(err.message || 'Failed to load code logs. Is the backend server running?');
    }
  };

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [logs.length, timeRange]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => isWithinRange(log.created_at, timeRange));
  }, [logs, timeRange]);

  const effectivePageSize = itemsPerPage <= 0 ? filteredLogs.length || 1 : itemsPerPage;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + effectivePageSize);

  const generateCode = async () => {
    if (!currentUser) {
      setError('You must be logged in to generate codes');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`${db.getApiBase()}/codes/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...db.getAuthHeaders() },
        body: JSON.stringify({ adminUser: currentUser.username })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        await loadLogs();
      } else {
        setError(result.message || 'Failed to generate code');
      }
    } catch (err: any) {
      console.error('Failed to generate code:', err);
      setError(err.message || 'Failed to generate code. Is the backend server running?');
    }
    setIsGenerating(false);
  };

  const getTimeRemaining = (expiry: string) => {
    const remaining = new Date(expiry).getTime() - new Date().getTime();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((remaining % (1000 * 60)) / 1000);
    return `${hours}h ${mins}m ${secs}s left`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase">Employee Registry Gateway</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Generate one-time access keys for new staff</p>
        </div>
        <button 
          onClick={generateCode}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          {isGenerating ? <RefreshCw className="animate-spin" size={14} /> : <Key size={14} />}
          Generate Registry Code
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50/50">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Time Range</span>
          <select
            value={timeRange}
            onChange={(e) => { setTimeRange(e.target.value as TimeRange); setCurrentPage(1); }}
            className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-[9px] font-black uppercase tracking-widest text-slate-500"
          >
            {TIME_RANGE_OPTIONS.map(option => (
              <option key={option} value={option}>{option === 'All' ? 'Whole Entries' : option}</option>
            ))}
          </select>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Code</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Generated By</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Time Remaining</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Used By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[11px]">
            {error && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-rose-500 font-bold">
                  {error}
                </td>
              </tr>
            )}
            {paginatedLogs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-black text-indigo-600 font-mono text-sm">{log.code}</td>
                <td className="px-6 py-4 font-bold text-slate-600 uppercase">{log.created_by}</td>
                <td className="px-6 py-4 font-bold text-slate-400 text-[10px]">{formatDate(log.created_at)}</td>
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-1.5 font-black uppercase text-[9px] ${
                    log.status === 'USED' ? 'text-emerald-500' : 
                    log.status === 'EXPIRED' ? 'text-rose-400' : 'text-amber-500'
                  }`}>
                    {log.status === 'USED' && <CheckCircle size={10} />}
                    {log.status === 'EXPIRED' && <XCircle size={10} />}
                    {log.status === 'ACTIVE' && <Clock size={10} />}
                    {log.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {log.status === 'ACTIVE' ? (
                    <span className="font-bold text-amber-500">{getTimeRemaining(log.expires_at)}</span>
                  ) : (
                    <span className="text-slate-300">---</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {log.status === 'USED' ? (
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 uppercase">{log.used_by_name}</span>
                      <span className="text-[9px] text-slate-400">@{log.used_by_username}</span>
                    </div>
                  ) : <span className="text-slate-300 italic">Not yet consumed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          totalItems={filteredLogs.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
};

export default EmployeeRegistry;
