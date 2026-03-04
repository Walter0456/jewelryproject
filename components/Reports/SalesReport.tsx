
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db';
import { Search, Printer, Receipt, X, ArrowLeftRight, CheckCircle, PackageSearch } from 'lucide-react';
import { Product, CartItem, Sale, User } from '../../types';
import ProductGallery from '../ProductGallery';
import Pagination from '../Pagination';
import { printFullReport } from '../../utils/printService';
import { TIME_RANGE_OPTIONS, TimeRange, isWithinRange } from '../../utils/timeRange';

interface SalesReportProps {
  sales: Sale[];
}

const SalesReport: React.FC<SalesReportProps> = ({ sales }) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [timeRange, setTimeRange] = useState<TimeRange>('All');
  const [users, setUsers] = useState<User[]>([]);
  const [voidModal, setVoidModal] = useState<Sale | null>(null);
  const [voidPin, setVoidPin] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidSuccess, setVoidSuccess] = useState<{ orNumber: string } | null>(null);
  const [exchangeSale, setExchangeSale] = useState<Sale | null>(null);
  const [exchangeStep, setExchangeStep] = useState<1 | 2 | 3>(1); // 1: Select Return, 2: Select Replacement, 3: Confirm
  const [returningItem, setReturningItem] = useState<CartItem | null>(null);
  const [replacementItem, setReplacementItem] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [exchangePin, setExchangePin] = useState('');

  const currentUser = db.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    db.getProducts().then(setAllProducts).catch(() => setAllProducts([]));
  }, []);

  useEffect(() => {
    db.getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const getStaffDisplay = (username: string) => {
    const matched = users.find(u => u.username === username);
    if (matched) return db.getFullName(matched);
    return username;
  };

  const filteredSales = sales.filter(s => 
    s.orNumber.includes(search) || 
    s.staff.toLowerCase().includes(search.toLowerCase()) ||
    s.items.some(item => item.id.includes(search))
  ).filter(s => isWithinRange(s.timestamp, timeRange));

  const completedSales = useMemo(() => filteredSales.filter(s => s.status !== 'void'), [filteredSales]);
  const totalRevenue = useMemo(() => completedSales.reduce((sum, s) => sum + s.total, 0), [completedSales]);
  const totalItemsSold = useMemo(
    () => completedSales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0), 0),
    [completedSales]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, timeRange, sales.length]);

  const effectivePageSize = itemsPerPage <= 0 ? filteredSales.length || 1 : itemsPerPage;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedSales = filteredSales.slice(startIndex, startIndex + effectivePageSize);

  const handleVoidSale = (sale: Sale) => {
    setVoidModal(sale);
    setVoidPin('');
    setVoidError(null);
  };

  const handleConfirmVoid = async () => {
    if (!voidModal) return;
    if (!voidPin.trim()) {
      setVoidError('Master Admin PIN is required');
      return;
    }
    setIsVoiding(true);
    const result = await db.voidSale(voidModal.id, voidPin.trim());
    if (!result.success) {
      setVoidError(result.message || 'Failed to void sale');
      setIsVoiding(false);
      return;
    }
    setIsVoiding(false);
    setVoidModal(null);
    setVoidSuccess({ orNumber: voidModal.orNumber });
    setVoidPin('');
    setVoidError(null);
  };

  const handlePrintAll = () => {
    printFullReport(
      'Sales Transaction History',
      ['Timestamp', 'OR#', 'Employee', 'Items', 'Total', 'Status'],
      filteredSales.map(sale => [
        sale.timestamp,
        `#${sale.orNumber}`,
        getStaffDisplay(sale.staff),
        sale.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
        `₱${sale.total.toLocaleString()}`,
        sale.status === 'void' ? 'VOID' : 'COMPLETED'
      ]),
      { branch: 'Rodriguez Rizal' }
    );
  };

  const printRevisedReceipt = (sale: any) => {
    const windowPrint = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
    if (!windowPrint) return;

    const items = Array.isArray(sale.items) ? sale.items : [];
    const reissueDate = sale.reissueDate ? new Date(sale.reissueDate).toLocaleDateString() : new Date().toLocaleDateString();
    const reissueAdmin = sale.reissueAdmin || currentUser?.username || 'Admin';

    windowPrint.document.write(`
      <html>
        <head>
          <title>REVISED OR# ${sale.or_number || sale.orNumber}</title>
          <style>
            body { 
              font-family: 'Courier New', Courier, monospace; 
              padding: 40px; 
              line-height: 1.4; 
              font-size: 14px; 
              width: 380px; 
              margin: 0 auto; 
              color: #000;
            }
            .center { text-align: center; }
            .dashed { border-top: 2px dashed #000; margin: 15px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; font-size: 16px; }
            .header { margin-bottom: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
            .footer { margin-top: 30px; font-size: 10px; text-align: center; opacity: 0.7; }
            .details { margin-bottom: 15px; }
            .details div { display: flex; justify-content: space-between; text-transform: uppercase; }
            .reissue-notice { 
              background: #f3f4f6; 
              border: 2px solid #d1d5db; 
              padding: 15px; 
              margin: 20px 0; 
              text-align: center;
              border-radius: 8px;
            }
            .reissue-notice h3 { 
              margin: 0 0 8px 0; 
              font-size: 14px; 
              text-transform: uppercase; 
            }
            .reissue-notice p { 
              margin: 4px 0; 
              font-size: 11px; 
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Rodriguez Jewelry</h1>
            <p>RODRIGUEZ RIZAL BRANCH</p>
          </div>
          <div class="dashed"></div>
          <div class="details">
            <div><span>Date:</span> <span>${sale.timestamp || new Date().toLocaleString()}</span></div>
            <div><span>Staff:</span> <span>${getStaffDisplay(sale.staff)}</span></div>
            <div><span style="font-weight:bold">OR Number:</span> <span style="font-weight:bold">#${sale.or_number || sale.orNumber}</span></div>
          </div>
          <div class="dashed"></div>
          <div style="font-weight:bold; margin-bottom: 10px; display: flex; justify-content: space-between;">
            <span>DESCRIPTION</span>
            <span>TOTAL</span>
          </div>
          ${items.map((item: any) => `
            <div class="item-row">
              <div style="display:flex; flex-direction:column">
                <span>${(item.name || '').toUpperCase()}</span>
                <span style="font-size:10px">${item.quantity || 1} x ₱${(item.price || 0).toLocaleString()}</span>
              </div>
              <span>₱${((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
            </div>
          `).join('')}
          <div class="dashed"></div>
          <div class="total-row">
            <span>GRAND TOTAL</span>
            <span>₱${(sale.total || 0).toLocaleString()}</span>
          </div>
          <div class="reissue-notice">
            <h3>⚠️ REISSUED RECORD</h3>
            <p>Exchange transaction performed on ${reissueDate} by ${reissueAdmin}.</p>
            <p>Original OR sequence maintained.</p>
          </div>
          <div class="footer">
            <p>Authorized Digital Record</p>
            <p>System ID: ${sale.id}</p>
            <p>*** THANK YOU ***</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    windowPrint.document.close();
    windowPrint.focus();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase">Sales transaction history</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Comprehensive audit of store transactions</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search OR#, Staff..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-600 text-black"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
           </div>
           <select
             value={timeRange}
             onChange={(e) => { setTimeRange(e.target.value as TimeRange); setCurrentPage(1); }}
             className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-[9px] font-black uppercase tracking-widest text-slate-500"
           >
             {TIME_RANGE_OPTIONS.map(option => (
               <option key={option} value={option}>{option === 'All' ? 'Whole Entries' : option}</option>
             ))}
           </select>
           <button onClick={handlePrintAll} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"><Printer size={16} /></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-[10px]">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">OR Number</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Items Sold</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-right">Total Payable</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginatedSales.map(sale => (
              <tr key={sale.id} className={`hover:bg-slate-50/50 transition-colors ${sale.status === 'void' ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4 font-bold text-slate-500 tabular-nums">{sale.timestamp}</td>
                <td className="px-4 py-4 font-black text-slate-900 tracking-tight">#{sale.orNumber}</td>
                <td className="px-4 py-4 uppercase font-black text-indigo-600 tracking-widest text-[9px]">{getStaffDisplay(sale.staff)}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1.5">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-400">#{item.id}</span>
                        <span className="text-[9px] text-slate-600 font-bold uppercase truncate max-w-140px leading-tight">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4 text-center font-bold text-slate-400">{sale.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
                <td className="px-6 py-4 text-right font-black text-slate-900 text-xs">₱{sale.total.toLocaleString()}</td>
                <td className="px-4 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${sale.status === 'void' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {sale.status === 'void' ? 'VOID' : 'COMPLETED'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isAdmin && sale.status !== 'void' && (
                      <>
                        <button
                          onClick={() => {
                            setExchangeSale(sale);
                            setExchangeStep(1);
                            setReturningItem(null);
                            setReplacementItem(null);
                            setExchangePin('');
                          }}
                          className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          Exchange
                        </button>
                        <button
                          onClick={() => handleVoidSale(sale)}
                          className="px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                        >
                          Void
                        </button>
                      </>
                    )}
                    {(!isAdmin || sale.status === 'void') && (
                      <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-white text-[10px] font-black uppercase tracking-widest">
          <span className="text-slate-400">Time Range Total</span>
          <span className="text-slate-900">
            ₱{totalRevenue.toLocaleString()}
            <span className="ml-2 text-[9px] text-slate-400">({totalItemsSold} items)</span>
          </span>
        </div>
        <Pagination
          totalItems={filteredSales.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
        />
        {filteredSales.length === 0 && (
           <div className="p-20 text-center flex flex-col items-center justify-center opacity-30">
              <Receipt size={48} strokeWidth={1} className="mb-4" />
              <p className="text-[9px] font-black uppercase tracking-widest">No Sales Records Found</p>
           </div>
        )}
      </div>

      {voidModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Void Sale Verification</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">OR#{voidModal.orNumber}</p>
              </div>
              <button
                onClick={() => setVoidModal(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Enter Master Admin PIN to void this sale.
              </p>
              <input
                type="password"
                value={voidPin}
                onChange={(e) => setVoidPin(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmVoid(); }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-500"
                placeholder="Master Admin PIN"
              />
              {voidError && (
                <div className="text-[9px] font-black uppercase tracking-widest text-rose-500">
                  {voidError}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setVoidModal(null)}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isVoiding ? 'Verifying...' : 'Verify & Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {voidSuccess && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Sale Voided</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Confirmation</p>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                Sale OR#{voidSuccess.orNumber} has been voided.
              </p>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setVoidSuccess(null)}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEM EXCHANGE MODAL */}
      {exchangeSale && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
                  <ArrowLeftRight size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Item Exchange System</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Original OR#{exchangeSale.orNumber}</p>
                </div>
              </div>
              <button onClick={() => setExchangeSale(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
            </div>

            <div className="flex flex-col md:flex-row min-h-500px">
              {/* STEP INDICATOR SIDEBAR */}
              <div className="w-full md:w-64 bg-slate-50 p-6 border-r border-slate-100 space-y-6">
                {[
                  { step: 1, title: 'Return Item', desc: 'Select item to return' },
                  { step: 2, title: 'Replacement', desc: 'Choose new item' },
                  { step: 3, title: 'Verification', desc: 'Final review & PIN' }
                ].map((s) => (
                  <div key={s.step} className={`flex gap-4 items-center transition-all ${exchangeStep === s.step ? 'opacity-100 translate-x-1' : 'opacity-40'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${exchangeStep === s.step ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {s.step}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-900">{s.title}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* MAIN CONTENT AREA */}
              <div className="flex-1 p-8 overflow-y-auto max-h-[70vh]">
                {exchangeStep === 1 && (
                  <div className="space-y-6">
                    <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest">Select item being returned:</h5>
                    <div className="grid grid-cols-1 gap-3">
                      {exchangeSale.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => { setReturningItem(item); setExchangeStep(2); }}
                          className="flex items-center gap-4 p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-600 hover:shadow-lg transition-all text-left"
                        >
                          <img src={item.mainImage} className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                          <div className="flex-1">
                            <p className="text-[11px] font-black uppercase text-slate-900">{item.name}</p>
                            <p className="text-[9px] font-bold text-indigo-600">₱{item.price.toLocaleString()}</p>
                          </div>
                          <CheckCircle className={returningItem?.id === item.id ? "text-indigo-600" : "text-slate-100"} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {exchangeStep === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest">Choose replacement:</h5>
                      <div className="relative w-48">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                        <input
                          type="text"
                          placeholder="Search products..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold outline-none focus:border-indigo-500"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {allProducts
                        .filter(p => p.stock > 0 && (p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.id.includes(productSearch)))
                        .slice(0, 9)
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setReplacementItem(p); setExchangeStep(3); }}
                            className="p-3 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-600 hover:shadow-lg transition-all text-left group"
                          >
                            <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-slate-100">
                              <img src={p.mainImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-[9px] font-black uppercase text-slate-900 truncate">{p.name}</p>
                            <p className="text-[8px] font-bold text-indigo-600">₱{p.price.toLocaleString()}</p>
                          </button>
                        ))}
                    </div>
                    <button onClick={() => setExchangeStep(1)} className="text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-colors">← Back to return selection</button>
                  </div>
                )}

                {exchangeStep === 3 && returningItem && replacementItem && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-4xl border border-slate-100">
                      <div className="text-center flex-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Returning</p>
                        <img src={returningItem.mainImage} className="w-16 h-16 rounded-2xl mx-auto mb-2 border-2 border-white shadow-sm" />
                        <p className="text-[10px] font-black uppercase text-slate-900">{returningItem.name}</p>
                        <p className="text-[9px] font-bold text-rose-500">- ₱{returningItem.price.toLocaleString()}</p>
                      </div>
                      <div className="px-4 text-slate-300"><ArrowLeftRight size={24} /></div>
                      <div className="text-center flex-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Replacement</p>
                        <img src={replacementItem.mainImage} className="w-16 h-16 rounded-2xl mx-auto mb-2 border-2 border-white shadow-sm" />
                        <p className="text-[10px] font-black uppercase text-slate-900">{replacementItem.name}</p>
                        <p className="text-[9px] font-bold text-indigo-600">+ ₱{replacementItem.price.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {(() => {
                        const diff = replacementItem.price - returningItem.price;
                        return (
                          <div className={`p-6 rounded-4xl border ${diff <= 0 ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100'}`}>
                            {diff < 0 ? (
                              <div className="flex gap-4">
                                <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl h-fit"><PackageSearch size={24} /></div>
                                <div>
                                  <p className="text-xs font-black text-amber-900 uppercase mb-1">NO REFUND POLICY ENFORCED</p>
                                  <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                                    The replacement item is cheaper by ₱{Math.abs(diff).toLocaleString()}. 
                                    Per store policy, no cash refunds are issued. The original sale total will be maintained.
                                  </p>
                                </div>
                              </div>
                            ) : diff > 0 ? (
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-xs font-black text-indigo-900 uppercase">Balance to be Paid</p>
                                  <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">New total will be updated</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-3xl font-black text-indigo-600">₱{diff.toLocaleString()}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-2">
                                <p className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center justify-center gap-2">
                                  <CheckCircle size={16} /> Even Exchange - No Balance Due
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="space-y-3 pt-4">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Admin Authorization Required</label>
                        <input
                          type="password"
                          placeholder="Enter Master Admin PIN"
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-center tracking-[0.5em] outline-none focus:border-indigo-600 transition-all"
                          value={exchangePin}
                          onChange={(e) => setExchangePin(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => setExchangeStep(2)}
                        className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Back
                      </button>
                      <button
                        disabled={!exchangePin || isExchanging}
                        onClick={async () => {
                          setIsExchanging(true);
                          try {
                            const response = await fetch(`${db.getApiBase()}/sales/${exchangeSale.id}/exchange`, {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json', ...db.getAuthHeaders() },
                              body: JSON.stringify({
                                returnItemId: returningItem.id,
                                replacementItemId: replacementItem.id,
                                pin: exchangePin,
                                adminUser: currentUser?.username
                              })
                            });
                            
                            const result = await response.json();
                            console.log('Exchange response:', response.status, result);
                            if (response.ok) {
                              // Print the revised receipt
                              printRevisedReceipt(result.sale);
                              alert("Exchange successful. Revised receipt has been printed.");
                              setExchangeSale(null);
                              window.location.reload(); // Refresh to see updated sale
                            } else {
                              alert(result.message || `Exchange failed (${response.status})`);
                            }
                          } catch (err) {
                            console.error('Exchange error:', err);
                            alert("A system error occurred. Please check the console for details.");
                          } finally {
                            setIsExchanging(false);
                          }
                        }}
                        className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50"
                      >
                        {isExchanging ? 'Processing...' : 'Confirm & Reissue Record'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
