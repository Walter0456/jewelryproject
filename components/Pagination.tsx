import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (num: number) => void;
  itemsPerPageOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions
}) => {
  const safeItemsPerPage = itemsPerPage <= 0 ? Math.max(totalItems, 1) : itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const options = itemsPerPageOptions || [10, 25, 50, 100, 0];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-slate-100 bg-white px-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Show</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black p-1 outline-none focus:border-indigo-500"
        >
          {options.map((num) => (
            <option key={num} value={num}>
              {num === 0 ? 'All' : `${num} Entries`}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1 px-4">
          <span className="text-[10px] font-black text-indigo-600 uppercase">Page {currentPage}</span>
          <span className="text-[10px] font-bold text-slate-300 uppercase">of {totalPages}</span>
        </div>

        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
        Total {totalItems.toLocaleString()} records found
      </div>
    </div>
  );
};

export default Pagination;
