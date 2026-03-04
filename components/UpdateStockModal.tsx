
import React, { useState } from 'react';
import { X, Package, ArrowRight } from 'lucide-react';
import { Product } from '../types';

interface UpdateStockModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (productId: string, newStock: number) => void;
}

const UpdateStockModal: React.FC<UpdateStockModalProps> = ({ product, isOpen, onClose, onConfirm }) => {
  const [newStock, setNewStock] = useState(product.stock);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
              <Package size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Stock Control</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="flex items-center space-x-5 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <img src={product.mainImage} className="w-20 h-20 rounded-xl object-cover shadow-sm" alt={product.name} />
            <div>
              <p className="text-sm font-black text-slate-900 uppercase">{product.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {product.id}</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Adjust Inventory Level</span>
              <div className="flex items-center justify-between space-x-6">
                <div className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Current</span>
                  <span className="text-2xl font-black text-slate-900">{product.stock}</span>
                </div>
                <ArrowRight className="text-slate-300 shrink-0" size={28} />
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    value={newStock}
                    onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                    className="w-full p-4 text-center text-2xl font-black bg-white border-2 border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl outline-none transition-all shadow-lg text-black"
                    autoFocus
                  />
                  <span className="text-[9px] font-black text-indigo-600 uppercase block mt-2 text-center tracking-widest">New Quantity</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-6 py-3 text-xs font-black text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(product.id, newStock)}
            className="px-8 py-3 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xl shadow-indigo-600/20 transition-all hover:-translate-y-1 uppercase tracking-widest"
          >
            Update Inventory
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateStockModal;
