
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, Edit2, Eye, X, ImagePlus, Save, Upload, Camera, Diamond, Hash, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { Product } from '../types';
import { db } from '../db';
import ProductGallery from './ProductGallery';
import Pagination from './Pagination';

interface InventoryViewProps {
  products: Product[];
  readOnly?: boolean;
  onUpdateStock: (id: string, newStock: number) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const InventoryView: React.FC<InventoryViewProps> = ({ products, readOnly, onUpdateStock, onDelete, onAdd }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [textSize, setTextSize] = useState(() => localStorage.getItem('inventory_text_size') || 'text-base');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  
  // Stock lock states
  const [isStockLocked, setIsStockLocked] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [incomingDelivery, setIncomingDelivery] = useState(0);
  
  // NEW: Image Input Mode Toggle
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'link'>('upload');
  const [uploadingCount, setUploadingCount] = useState(0);
  
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const thumbImageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: 0,
    stock: 0,
    grams: 0,
    specs: '',
    material: '',
    materialGrade: '',
    category: 'Rings',
    mainImage: '',
    thumbnails: [] as string[]
  });

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        id: editingProduct.id,
        name: editingProduct.name,
        price: editingProduct.price,
        stock: editingProduct.stock,
        grams: editingProduct.weightGrams,
        specs: editingProduct.specs,
        material: editingProduct.material,
        materialGrade: editingProduct.materialGrade || '',
        category: editingProduct.category,
        mainImage: editingProduct.mainImage,
        thumbnails: editingProduct.thumbnails || []
      });
      setIsStockLocked(true);
      setIncomingDelivery(0);
      setIsModalOpen(true);
    } else {
      setFormData({
        id: '',
        name: '',
        price: 0,
        stock: 0,
        grams: 0,
        specs: '',
        material: '',
        materialGrade: '',
        category: 'Rings',
        mainImage: '',
        thumbnails: []
      });
      setIsStockLocked(false);
      setIncomingDelivery(0);
    }
  }, [editingProduct]);

  // Handle Admin PIN verification
  const handleUnlockStock = async () => {
    const valid = await db.verifyAdminPin(pinInput);
    if (valid) {
      setIsStockLocked(false);
      setShowPinPrompt(false);
      setPinInput('');
    } else {
      alert('INCORRECT MASTER PIN');
      setPinInput('');
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.includes(searchTerm)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, products.length]);

  const effectivePageSize = itemsPerPage <= 0 ? filtered.length || 1 : itemsPerPage;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedProducts = filtered.slice(startIndex, startIndex + effectivePageSize);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingCount > 0) {
      alert('Please wait for image uploads to finish.');
      return;
    }
    
    const finalId = formData.id.trim() || (editingProduct ? editingProduct.id : Math.floor(100 + Math.random() * 899).toString());
    
    // 1. Prepare the product object
    const product: Product = {
      id: finalId,
      name: formData.name,
      price: formData.price,
      stock: formData.stock, // This is the base stock
      weightGrams: formData.grams,
      specs: formData.specs,
      material: formData.material || 'Gold',
      materialGrade: formData.materialGrade,
      category: formData.category || 'Jewelry',
      detailedDescription: formData.specs,
      mainImage: formData.mainImage || 'https://images.unsplash.com/photo-1515562141207-7a18b5ce33c3?w=400',
      thumbnails: formData.thumbnails.length > 0 ? formData.thumbnails : [formData.mainImage]
    };
    
    // 2. Save the metadata first (Price, Name, etc.)
    await db.saveProduct(product, !editingProduct);

    // 3. If there is a delivery, process it AFTER the metadata save
    if (editingProduct && incomingDelivery > 0) {
      await db.receiveDelivery(product.id, incomingDelivery, product.name);
    }

    // Reset states
    setIncomingDelivery(0);
    setIsStockLocked(true);
    setIsModalOpen(false);
    setEditingProduct(null);
    onAdd(); // Refresh the parent data
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'main' | 'thumb') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (target === 'thumb' && formData.thumbnails.length >= 4) {
      alert('Maximum of 4 thumbnails reached.');
      e.target.value = '';
      return;
    }

    setUploadingCount(count => count + 1);
    try {
      const url = await db.uploadImage(file);
      if (target === 'main') {
        setFormData(prev => ({ ...prev, mainImage: url }));
      } else {
        setFormData(prev => ({ ...prev, thumbnails: [...prev.thumbnails, url].slice(0, 4) }));
      }
    } catch (err: any) {
      console.error('Image upload failed', err);
      alert(err?.message || 'Image upload failed');
    } finally {
      setUploadingCount(count => Math.max(0, count - 1));
      e.target.value = '';
    }
  };

  const openNewModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleTextSizeChange = (size: string) => {
    setTextSize(size);
    localStorage.setItem('inventory_text_size', size);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase">Inventory Catalog</h2>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Branch Inventory Assets</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 mt-3">
            <span className="text-[7px] font-black text-slate-400 uppercase ml-1">Text:</span>
            {(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleTextSizeChange(size)}
                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${textSize === size ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {size.includes('xs') ? 'XS' : size.includes('sm') ? 'S' : size.includes('base') ? 'M' : size.includes('lg') ? 'L' : 'XL'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Filter catalog..." 
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 bg-white text-black"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {!readOnly && (
            <button 
              onClick={openNewModal}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/20 whitespace-nowrap"
            >
              <Plus size={14} /> <span>New Item</span>
            </button>
          )}
        </div>
      </div>

      {isModalOpen && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setIsModalOpen(false); setEditingProduct(null); }}>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar transform transition-all scale-100 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-black text-slate-800 uppercase">
                {editingProduct ? `Edit Item: ${editingProduct.name}` : 'Register New Jewelry Piece'}
              </h4>
              
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => setImageInputMode('link')}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${imageInputMode === 'link' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <LinkIcon size={12} /> Image Link
                  </button>
                  <button 
                    onClick={() => setImageInputMode('upload')}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${imageInputMode === 'upload' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Upload size={12} /> System Upload
                  </button>
                </div>
                <button onClick={() => { setIsModalOpen(false); setEditingProduct(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="md:col-span-2 space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Name</label>
                      <input required className="w-full p-2 border rounded-lg text-[10px] font-bold outline-none focus:border-indigo-600 bg-white text-black" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Product ID</label>
                      <input className="w-full p-2 border rounded-lg text-[10px] font-bold outline-none focus:border-indigo-600 bg-white text-black" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} placeholder="SKU / ID" />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Category</label>
                      <select className="w-full p-2 border rounded-lg text-[10px] font-bold outline-none focus:border-indigo-600 bg-white text-black" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        <option value="Rings">Rings</option>
                        <option value="Necklaces">Necklaces</option>
                        <option value="Earrings">Earrings</option>
                        <option value="Bracelets">Bracelets</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Material Base</label>
                      <input placeholder="E.g. Gold, Silver, Platinum" className="w-full p-2 border rounded-lg text-[10px] font-bold outline-none focus:border-indigo-600 bg-white text-black" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="md:col-span-2 space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Material Grade</label>
                      <div className="relative">
                        <Diamond size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400" />
                        <input placeholder="E.g. 18K, VS1, Saudi Gold" className="w-full p-2 pl-6 border rounded-lg text-[10px] font-bold outline-none focus:border-indigo-600 bg-white text-black" value={formData.materialGrade} onChange={e => setFormData({...formData, materialGrade: e.target.value})} />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Price (₱)</label>
                      <input required type="number" className="w-full p-2 border rounded-lg text-[10px] font-bold outline-none focus:border-indigo-600 bg-white text-black" value={formData.price || ''} onChange={e => setFormData({...formData, price: parseInt(e.target.value)})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Grams</label>
                      <input required type="number" step="0.01" className="w-full p-2 border rounded-lg text-[10px] font-bold outline-none focus:border-indigo-600 bg-white text-black" value={formData.grams || ''} onChange={e => setFormData({...formData, grams: parseFloat(e.target.value)})} />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  
                  {/* 1. Base Stock Column */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label htmlFor="base-stock" className="text-[8px] font-black text-slate-400 uppercase ml-1">
                        Base Stock (Locked)
                      </label>
                      {editingProduct && (
                        <button 
                          type="button"
                          onClick={() => setShowPinPrompt(true)}
                          className="text-[8px] font-black text-indigo-600 uppercase hover:underline"
                        >
                          Unlock
                        </button>
                      )}
                    </div>
                    <input 
                      id="base-stock"
                      type="number" 
                      className={`w-full p-2 h-10 border rounded-lg text-[10px] font-bold outline-none transition-all ${
                        isStockLocked && editingProduct 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' 
                          : 'bg-white text-black border-indigo-600 ring-2 ring-indigo-50'
                      }`} 
                      value={formData.stock} 
                      onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} 
                      disabled={isStockLocked && !!editingProduct}
                    />
                  </div>

                  {/* 2. Delivery Column */}
                  <div className="space-y-1">
                    <label htmlFor="incoming-stock" className="text-[8px] font-black text-emerald-600 uppercase ml-1">
                      Add New Delivery (+)
                    </label>
                    <input 
                      id="incoming-stock"
                      placeholder="Qty"
                      type="number" 
                      className="w-full p-2 h-10 border-2 border-emerald-500 rounded-lg text-[10px] font-black outline-none bg-emerald-50 text-emerald-700 placeholder:text-emerald-300 focus:ring-4 focus:ring-emerald-500/10" 
                      value={incomingDelivery || ''} 
                      onChange={e => setIncomingDelivery(parseInt(e.target.value) || 0)} 
                    />
                  </div>

                  {/* 3. PROPER BUTTON COLUMN */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">
                      Primary Asset
                    </label>
                    {imageInputMode === 'upload' ? (
                      <button 
                        type="button" 
                        onClick={() => mainImageInputRef.current?.click()}
                        className="w-full h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 font-black text-[9px] uppercase hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
                      >
                        <Upload size={14} /> Upload Picture
                      </button>
                    ) : (
                      <div className="relative">
                        <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input className="w-full pl-8 p-3 border-2 border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-600 h-11.5" placeholder="Paste Image URL..." value={formData.mainImage} onChange={e => setFormData({...formData, mainImage: e.target.value})} />
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={mainImageInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => handleFileChange(e, 'main')} 
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Multi-Angle Perspectives ({formData.thumbnails.filter(Boolean).length}/4)
                    </label>
                    {imageInputMode === 'upload' && (
                      <button 
                        type="button" 
                        onClick={() => thumbImageInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-indigo-700"
                      >
                        <Plus size={14} /> Add Perspective
                      </button>
                    )}
                    <input 
                      type="file" 
                      ref={thumbImageInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => handleFileChange(e, 'thumb')} 
                    />
                  </div>

                  {imageInputMode === 'upload' ? (
                    <div className="grid grid-cols-4 gap-3">
                      {formData.thumbnails.filter(Boolean).map((t, idx) => (
                        <div key={idx} className="relative aspect-square">
                          <img src={t} className="w-full h-full object-cover rounded-xl border-2 border-white shadow-sm" alt="" />
                          <button 
                            type="button" 
                            onClick={() => setFormData(p => ({...p, thumbnails: p.thumbnails.filter((_, i) => i !== idx)}))} 
                            className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-lg"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {formData.thumbnails.filter(Boolean).length === 0 && (
                        <div className="col-span-4 py-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-300">
                          <Camera size={20} className="mb-2 opacity-30" />
                          <p className="text-[8px] font-black uppercase">No multi-angle views uploaded</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="relative">
                          <LinkIcon size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input 
                            className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-[9px] font-bold outline-none focus:border-indigo-600 bg-white" 
                            placeholder={`Perspective URL #${i+1}`} 
                            value={formData.thumbnails[i] || ''} 
                            onChange={e => {
                              const newThumbs = [...formData.thumbnails];
                              newThumbs[i] = e.target.value;
                              setFormData({...formData, thumbnails: newThumbs});
                            }} 
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Detailed Item Specs</label>
                   <textarea className="w-full p-2 border rounded-lg text-[10px] font-bold outline-none focus:border-indigo-600 h-16 bg-white text-black placeholder:text-slate-300" placeholder="E.g. Full cut diamond, high polish finish..." value={formData.specs} onChange={e => setFormData({...formData, specs: e.target.value})} />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => { setIsModalOpen(false); setEditingProduct(null); }} className="px-4 py-2 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:text-slate-600 transition-colors">Discard</button>
                  <button
                    type="submit"
                    disabled={uploadingCount > 0}
                    className={`px-8 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 shadow-lg transition-all flex items-center gap-2 ${
                      uploadingCount > 0
                        ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                        : 'bg-indigo-600 text-white shadow-indigo-600/20'
                    }`}
                  >
                    {uploadingCount > 0
                      ? 'Uploading...'
                      : editingProduct
                        ? <><Save size={14} /> Update changes</>
                        : <><Plus size={14} /> Register piece</>}
                  </button>
                </div>
              </form>

              <div className="bg-slate-100 p-6 rounded-3xl border border-slate-200/50 flex flex-col items-center sticky top-0">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-6 w-full text-center">Interactive Item Preview</p>
                <div className="w-full max-w-[320px]">
                  <ProductGallery images={[formData.mainImage, ...formData.thumbnails].filter(Boolean)} />
                  <div className="mt-4 px-4 py-5 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="text-[12px] font-black text-slate-900 uppercase truncate pr-4">{formData.name || 'New Item Name'}</h5>
                      <span className="text-[7px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase">{formData.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[14px] font-black text-indigo-600">₱{(formData.price || 0).toLocaleString()}</p>
                      <div className="flex gap-1">
                        {formData.id && <span className="text-[7px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 uppercase">#{formData.id}</span>}
                        {formData.materialGrade && <span className="text-[7px] font-black text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded">{formData.materialGrade}</span>}
                      </div>
                    </div>
                  </div>
                  
                  {/* Live Specs Preview */}
                  <div className="mt-4 px-4 py-5 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <ImageIcon size={10} /> Live Technical Preview
                    </p>
                    <p className="text-[10px] text-slate-500 italic leading-relaxed line-clamp-4">
                      {formData.specs || '"Type your detailed specifications here to see them previewed in real-time..."' }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin PIN Prompt */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 w-64">
            <p className="text-[10px] font-black text-slate-900 uppercase mb-4 text-center">Enter Master Admin PIN</p>
            <input 
              type="password" 
              maxLength={6}
              className="w-full text-center text-xl font-bold tracking-[0.5em] border-b-2 border-indigo-600 outline-none mb-4"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowPinPrompt(false); setPinInput(''); }} className="flex-1 text-[9px] font-black uppercase text-slate-400">Cancel</button>
              <button onClick={handleUnlockStock} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[9px] font-black uppercase">Verify</button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Table */}
      <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${textSize} shadow-sm transition-all duration-300`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest opacity-70">Product & Grade</th>
                <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest opacity-70">Weight</th>
                <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-center opacity-70">Status</th>
                {!readOnly && <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-right opacity-70">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedProducts.map(product => (
                <tr 
                  key={product.id} 
                  onClick={() => setViewingProduct(product)}
                  className="group hover:bg-indigo-50/50 hover:border-l-4 hover:border-l-indigo-600 transition-all cursor-pointer border-l-4 border-l-transparent"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <img src={product.mainImage} className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover border border-slate-200 shadow-sm transition-all" alt="" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 uppercase leading-tight">{product.name}</p>
                          {product.materialGrade && (
                            <span className="px-1.5 py-0.5 text-[0.7em] font-black text-indigo-600 bg-indigo-50 rounded uppercase">{product.materialGrade}</span>
                          )}
                        </div>
                        <p className="text-[0.8em] font-bold text-slate-400 uppercase tracking-wide mt-0.5">#{product.id} • ₱{product.price.toLocaleString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-600 uppercase tracking-tight">{product.weightGrams}g / {product.material}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full font-black uppercase text-[0.8em] ${product.stock <= 3 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {product.stock} Units
                    </span>
                  </td>
                  {!readOnly && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end space-x-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditingProduct(product)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit Product"><Edit2 size={16} /></button>
                        <button onClick={() => onDelete(product.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Delete Product"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        totalItems={filtered.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
      />

      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setViewingProduct(null)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row transform transition-all animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="w-full md:w-1/2 p-6 bg-slate-50 flex items-center justify-center">
              <ProductGallery images={[viewingProduct.mainImage, ...(viewingProduct.thumbnails || [])].filter(Boolean)} />
            </div>
            <div className="flex-1 p-8 flex flex-col">
               <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{viewingProduct.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Catalog ID #{viewingProduct.id} • {viewingProduct.category}</p>
                      {viewingProduct.materialGrade && (
                        <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-widest">{viewingProduct.materialGrade}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setViewingProduct(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
               </div>
               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-black">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Material Base</p>
                    <p className="text-sm font-black text-slate-800 uppercase">{viewingProduct.material}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-black">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Gram Weight</p>
                    <p className="text-sm font-black text-slate-800">{viewingProduct.weightGrams}g</p>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Detailed Specifications</p>
                 <p className="text-sm text-slate-600 italic leading-relaxed font-medium">"{viewingProduct.detailedDescription}"</p>
               </div>
               <div className="mt-8 flex gap-3">
                  <button onClick={() => setViewingProduct(null)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all active:scale-95">Close Insights</button>
                  {!readOnly && (
                    <button 
                      onClick={() => { setViewingProduct(null); setEditingProduct(viewingProduct); }}
                      className="px-6 border border-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                    >
                      Quick Edit
                    </button>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
