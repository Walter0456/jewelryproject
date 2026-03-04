
import React, { useState } from 'react';
import { Edit2, Trash2, Eye, RefreshCw } from 'lucide-react';
import { Product } from '../types';
import UpdateStockModal from './UpdateStockModal';
import ProductGallery from './ProductGallery';

interface LowStockGridProps {
  products: Product[];
  stockThreshold?: number;
  onUpdateStock?: (id: string, newStock: number) => void;
  readOnly?: boolean;
}

const LowStockGrid: React.FC<LowStockGridProps> = ({ 
  products, 
  stockThreshold = 3,
  onUpdateStock,
  readOnly = false
}) => {
  const [updatingProduct, setUpdatingProduct] = useState<Product | null>(null);
  const [animatedId, setAnimatedId] = useState<string | null>(null);

  const filteredProducts = products.filter(p => p.stock <= stockThreshold);

  const handleUpdateClick = (product: Product) => {
    setUpdatingProduct(product);
  };

  const handleConfirmUpdate = (productId: string, newStock: number) => {
    if (onUpdateStock) {
      onUpdateStock(productId, newStock);
      setAnimatedId(productId);
      setTimeout(() => setAnimatedId(null), 1500);
    }
    setUpdatingProduct(null);
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-400 font-medium">No items matching current stock criteria.</p>
        </div>
      ) : (
        filteredProducts.map((product) => (
          <div 
            key={product.id} 
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row hover:border-indigo-200 transition-colors"
          >
            {/* Left: Slider Section */}
            <div className="md:w-1/3 p-4 bg-slate-50/50">
              <ProductGallery images={[product.mainImage, ...(product.thumbnails || [])]} />
            </div>

            {/* Right: Details Section */}
            <div className="flex-1 p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU: {product.id}</p>
                    {product.materialGrade && (
                      <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-widest">{product.materialGrade}</span>
                    )}
                  </div>
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{product.name}</h4>
                </div>
                {!readOnly && (
                  <div className="flex space-x-1">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={`
                  p-4 rounded-2xl border transition-all duration-500
                  ${animatedId === product.id ? 'bg-emerald-50 border-emerald-300 scale-[1.02]' : 'bg-slate-50 border-slate-100'}
                `}>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Available Units</p>
                  <p className={`text-xl font-black ${product.stock <= 2 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {product.stock}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Unit Price</p>
                  <p className="text-xl font-black text-slate-900">₱{product.price.toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Materials & Specs</p>
                  <p className="text-xs text-slate-600 italic leading-relaxed">
                    "{product.specs}"
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-end space-x-3">
                {!readOnly && (
                  <button 
                    onClick={() => handleUpdateClick(product)}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    <RefreshCw size={14} />
                    <span>Quick Update</span>
                  </button>
                )}
                <button className="flex items-center space-x-2 px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all text-[10px] font-black uppercase tracking-widest active:scale-95">
                  <Eye size={14} />
                  <span>Insights</span>
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {updatingProduct && (
        <UpdateStockModal
          product={updatingProduct}
          isOpen={!!updatingProduct}
          onClose={() => setUpdatingProduct(null)}
          onConfirm={handleConfirmUpdate}
        />
      )}
    </div>
  );
};

export default LowStockGrid;
