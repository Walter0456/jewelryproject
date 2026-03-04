import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle, Receipt, 
  ShoppingBag, X, Eye, Hash, Printer, Copy, Download, Info, FileText
} from 'lucide-react';
import { Product, CartItem, Sale, User, SystemSettings, ReceiptType } from '../types';
import { db } from '../db';
import ProductGallery from './ProductGallery';
import html2canvas from 'html2canvas';
import Pagination from './Pagination';

interface POSViewProps {
  products: Product[];
  onSaleComplete: () => void;
  users: User[];
  settings: SystemSettings;
}

const DEFAULT_RECEIPT_LAYOUT = {
  businessName: 'Rodriguez Jewelry',
  headerNote: 'Authorized Sale Record',
  footerNote: 'This receipt serves as your proof of transaction.',
  thankYouNote: 'Thank you for your purchase.',
  officialReceiptLabel: 'Official Receipt',
  acknowledgementReceiptLabel: 'Acknowledgement Receipt',
  accentColor: '#4f46e5',
  defaultReceiptType: 'OR' as ReceiptType,
  receiptSavePath: 'receipts'
};

const POSView: React.FC<POSViewProps> = ({ products, onSaleComplete, users, settings }) => {
  const currentUser = db.getCurrentUser();
  const fullName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : currentUser?.username || '';
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [staffOnDuty, setStaffOnDuty] = useState(currentUser?.username || '');
  const [orNumber, setOrNumber] = useState('');
  const [selectedReceiptType, setSelectedReceiptType] = useState<ReceiptType>(
    settings.receiptLayout?.defaultReceiptType || DEFAULT_RECEIPT_LAYOUT.defaultReceiptType
  );
  const [quickLookItem, setQuickLookItem] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(true);
  const [checkoutStep, setCheckoutStep] = useState<0 | 1 | 2>(0); // 0: Idle, 1: Summary, 2: Final
  const [successToast, setSuccessToast] = useState('');
  const [amountReceivedInput, setAmountReceivedInput] = useState('');

  const receiptRef = useRef<HTMLDivElement>(null);
  const receiptLayout = useMemo(() => ({
    ...DEFAULT_RECEIPT_LAYOUT,
    ...(settings.receiptLayout || {})
  }), [settings.receiptLayout]);
  const activeReceiptType = lastSale?.receiptType || selectedReceiptType;
  const receiptTitle = activeReceiptType === 'AR'
    ? (receiptLayout.acknowledgementReceiptLabel || DEFAULT_RECEIPT_LAYOUT.acknowledgementReceiptLabel)
    : (receiptLayout.officialReceiptLabel || DEFAULT_RECEIPT_LAYOUT.officialReceiptLabel);
  const receiptAccent = receiptLayout.accentColor || DEFAULT_RECEIPT_LAYOUT.accentColor;
  const currency = (settings.currencySymbol || 'PHP').trim() || 'PHP';
  const currencyPrefix = `${currency}${currency.length > 1 ? ' ' : ''}`;

  const getStaffFullName = (username: string) => {
    const user = users.find(u => u.username === username);
    if (user && (user.firstName || user.lastName)) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return username;
  };

  useEffect(() => {
    const initOR = async () => {
        const nextOR = await db.getNextOrNumber();
        setOrNumber(nextOR);
    };
    initOR();
  }, [products]);

  useEffect(() => {
    setSelectedReceiptType(settings.receiptLayout?.defaultReceiptType || DEFAULT_RECEIPT_LAYOUT.defaultReceiptType);
  }, [settings.receiptLayout?.defaultReceiptType]);

  useEffect(() => {
    if (cart.length === 0 && checkoutStep === 0) {
      setAmountReceivedInput('');
    }
  }, [cart.length, checkoutStep]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.id.includes(searchTerm) ||
      p.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.materialGrade && p.materialGrade.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, products.length]);

  const effectivePageSize = itemsPerPage <= 0 ? filteredProducts.length || 1 : itemsPerPage;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + effectivePageSize);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        const original = products.find(p => p.id === id);
        if (original && newQty > original.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const amountReceived = useMemo(() => {
    const parsed = parseFloat(amountReceivedInput);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [amountReceivedInput]);
  const computedChange = useMemo(
    () => roundMoney(Math.max(0, amountReceived - cartTotal)),
    [amountReceived, cartTotal]
  );
  const canProceedWithPayment = cart.length > 0 && amountReceived >= cartTotal;

  const handleCheckout = () => {
    if (cart.length === 0 || !staffOnDuty || !orNumber.trim()) return;
    if (!amountReceivedInput.trim()) {
      setAmountReceivedInput(cartTotal.toFixed(2));
    }
    setCheckoutStep(1); // Open Summary
  };

  const confirmCheckout = () => {
    if (!canProceedWithPayment) return;
    setIsProcessing(true);
    setCheckoutStep(0);
    
    const saleData: Sale = {
      id: 'pending',
      orNumber: orNumber.trim(),
      receiptType: selectedReceiptType,
      timestamp: new Date().toLocaleString(),
      staff: staffOnDuty,
      staffFullName: getStaffFullName(staffOnDuty),
      items: [...cart],
      total: cartTotal,
      amountReceived,
      changeAmount: computedChange
    };

    setTimeout(async () => {
      try {
        const result = await db.completeSale(cart, staffOnDuty, orNumber, selectedReceiptType, amountReceived, computedChange);
        setLastSale({
          ...saleData,
          id: result?.id || saleData.id,
          amountReceived: result?.amountReceived ?? saleData.amountReceived,
          changeAmount: result?.changeAmount ?? saleData.changeAmount
        });
        setIsProcessing(false);
        setShowReceipt(true);
        setCart([]);
        setAmountReceivedInput('');
        const nextOR = await db.getNextOrNumber();
        setOrNumber(nextOR);
        onSaleComplete();
        setSuccessToast('Sale Successfully Recorded');
        setTimeout(() => setSuccessToast(''), 3000);
      } catch (err) {
        setIsProcessing(false);
        alert("Checkout failed. Check stock availability.");
      }
    }, 1200);
  };

  const renderReceiptCanvas = useCallback(async () => {
    if (!receiptRef.current) return null;
    const hasVisibleContent = (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return true;
      try {
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a > 10 && (r < 245 || g < 245 || b < 245)) {
            return true;
          }
        }
      } catch {
        return true;
      }
      return false;
    };

    const cloneStyling = (clonedDoc: Document) => {
      const clonedRoot = clonedDoc.querySelector('[data-receipt-capture="true"]') as HTMLElement | null;
      if (!clonedRoot) return;

      const nodes = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll('*'))];
      nodes.forEach((node) => {
        if (!('style' in node)) return;
        const style = (node as HTMLElement).style;
        style.color = '#0f172a';
        style.backgroundColor = 'transparent';
        style.borderColor = '#cbd5e1';
        style.outlineColor = '#cbd5e1';
        style.boxShadow = 'none';
        style.textShadow = 'none';
        style.filter = 'none';
      });

      clonedRoot.style.backgroundColor = '#ffffff';
      clonedRoot.style.borderColor = receiptAccent;

      clonedDoc.querySelectorAll<HTMLElement>('[data-receipt-accent="true"]').forEach((el) => {
        el.style.color = receiptAccent;
        el.style.borderColor = receiptAccent;
      });
    };

    const baseOptions = {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      ignoreElements: (element: Element) => element.classList?.contains('ignore-capture'),
      onclone: cloneStyling
    };

    try {
      const defaultCanvas = await html2canvas(receiptRef.current, baseOptions);
      if (hasVisibleContent(defaultCanvas)) {
        return defaultCanvas;
      }
    } catch (err) {
      // Retry with alternate renderer below.
    }
    try {
      const foreignObjectCanvas = await html2canvas(receiptRef.current, {
        ...baseOptions,
        foreignObjectRendering: true
      });
      if (hasVisibleContent(foreignObjectCanvas)) {
        return foreignObjectCanvas;
      }
      return null;
    } catch {
      return null;
    }
  }, [receiptAccent]);

  const saveReceiptImageToFolder = useCallback(async (imageData: string) => {
    if (!lastSale) return false;
    try {
      const result = await db.saveReceiptImage({
        imageData,
        orNumber: lastSale.orNumber,
        receiptType: activeReceiptType,
        saleId: lastSale.id,
        savePath: receiptLayout.receiptSavePath
      });
      return !!result?.success;
    } catch (err) {
      console.warn('Failed to save receipt image to local folder', err);
      return false;
    }
  }, [lastSale, activeReceiptType, receiptLayout.receiptSavePath]);

  const printImageInIframe = useCallback((title: string, imageData: string) => {
    return new Promise<boolean>((resolve) => {
      const printWindow = window.open('', '', 'left=0,top=0,width=500,height=900,toolbar=0,scrollbars=1,status=0');
      if (!printWindow) {
        resolve(false);
        return;
      }

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @page {
                margin: 12mm;
              }
              body {
                margin: 0;
                padding: 24px;
                background: #ffffff;
                display: flex;
                justify-content: center;
              }
              #print-root {
                width: 380px;
                max-width: 100%;
                min-height: 40px;
              }
              img {
                width: 380px;
                max-width: 100%;
                height: auto;
                display: block;
              }
            </style>
          </head>
          <body>
            <div id="print-root">
              <img id="receipt-image" alt="Receipt" src="${imageData}" />
            </div>
            <script>
              (function () {
                const img = document.getElementById('receipt-image');
                const triggerPrint = function () {
                  setTimeout(function () {
                    window.focus();
                    window.print();
                  }, 80);
                };
                if (!img) {
                  window.close();
                  return;
                }
                if (img.complete && img.naturalWidth > 0) {
                  triggerPrint();
                } else {
                  img.onload = triggerPrint;
                  img.onerror = function () { window.close(); };
                }
                window.onafterprint = function () { window.close(); };
              })();
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      resolve(true);
    });
  }, []);

  const printHtmlInIframe = useCallback((title: string, htmlBody: string) => {
    return new Promise<boolean>((resolve) => {
      const printWindow = window.open('', '', 'left=0,top=0,width=500,height=900,toolbar=0,scrollbars=1,status=0');
      if (!printWindow) {
        resolve(false);
        return;
      }

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @page {
                margin: 12mm;
              }
              body {
                font-family: 'Courier New', Courier, monospace;
                padding: 40px;
                line-height: 1.4;
                font-size: 14px;
                width: 380px;
                margin: 0 auto;
                color: #000;
                background: #fff;
              }
              .dashed { border-top: 2px dashed #000; margin: 15px 0; }
              .item-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
              .total-row { display: flex; justify-content: space-between; font-weight: bold; margin-top: 8px; font-size: 16px; }
              .header { margin-bottom: 20px; text-align: center; }
              .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
              .receipt-label { margin-top: 6px; font-weight: bold; text-transform: uppercase; color: ${receiptAccent}; }
              .footer { margin-top: 30px; font-size: 10px; text-align: center; opacity: 0.85; }
              .details { margin-bottom: 15px; }
              .details div { display: flex; justify-content: space-between; text-transform: uppercase; }
            </style>
          </head>
          <body>
            ${htmlBody}
            <script>
              window.onload = function () {
                setTimeout(function () {
                  window.focus();
                  window.print();
                }, 100);
              };
              window.onafterprint = function () { window.close(); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      resolve(true);
    });
  }, [receiptAccent]);

  const handleSaveAsImage = async () => {
    const canvas = await renderReceiptCanvas();
    if (!canvas) return;
    try {
      const imageData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${activeReceiptType}_${lastSale?.orNumber || 'receipt'}.png`;
      link.href = imageData;
      link.click();
      await saveReceiptImageToFolder(imageData);
    } catch (err) {
      console.warn('Image generation failed', err);
    }
  };

  const getReceiptText = useCallback(() => {
    if (!lastSale) return '';
    const saleAmountReceived = lastSale.amountReceived ?? lastSale.total;
    const saleChange = lastSale.changeAmount ?? roundMoney(Math.max(0, saleAmountReceived - lastSale.total));
    const lines = [
      `${receiptLayout.businessName || DEFAULT_RECEIPT_LAYOUT.businessName}`.toUpperCase(),
      `${receiptTitle}`.toUpperCase(),
      `${settings.branchName} BRANCH`,
      '----------------------------------------',
      `DATE/TIME: ${lastSale.timestamp}`,
      `STAFF: ${lastSale.staffFullName || lastSale.staff}`,
      `${activeReceiptType} #: ${lastSale.orNumber}`,
      '----------------------------------------',
      'DESCRIPTION                           TOTAL',
      ...lastSale.items.map(item => {
        const total = (item.price * item.quantity).toLocaleString();
        return `${item.name.toUpperCase()} x${item.quantity} @ ${currencyPrefix}${item.price.toLocaleString()} = ${currencyPrefix}${total}`;
      }),
      '----------------------------------------',
      `TOTAL AMOUNT: ${currencyPrefix}${lastSale.total.toLocaleString()}`,
      `AMOUNT RECEIVED: ${currencyPrefix}${saleAmountReceived.toLocaleString()}`,
      `CHANGE: ${currencyPrefix}${saleChange.toLocaleString()}`,
      `${receiptLayout.footerNote || DEFAULT_RECEIPT_LAYOUT.footerNote}`,
      `${receiptLayout.thankYouNote || DEFAULT_RECEIPT_LAYOUT.thankYouNote}`,
      `SYSTEM ID: ${lastSale.id}`
    ];
    return lines.join('\n');
  }, [lastSale, receiptLayout, receiptTitle, settings.branchName, activeReceiptType, currencyPrefix]);

  const handleSaveAsText = () => {
    const content = getReceiptText();
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeReceiptType}_${lastSale?.orNumber || 'receipt'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReceipt = useCallback(async () => {
    if (!lastSale) return;
    const saleAmountReceived = lastSale.amountReceived ?? lastSale.total;
    const saleChange = lastSale.changeAmount ?? roundMoney(Math.max(0, saleAmountReceived - lastSale.total));
    let capturedImageData: string | null = null;
    try {
      const canvas = await renderReceiptCanvas();
      if (canvas) {
        capturedImageData = canvas.toDataURL('image/png');
        const saved = await saveReceiptImageToFolder(capturedImageData);
        if (!saved) {
          const fallbackLink = document.createElement('a');
          fallbackLink.download = `${activeReceiptType}_${lastSale.orNumber || 'receipt'}.png`;
          fallbackLink.href = capturedImageData;
          fallbackLink.click();
          alert('Receipt image was downloaded because folder auto-save failed.');
        }
      }
    } catch (err) {
      console.warn('Auto-save receipt image failed', err);
    }

    const fallbackHtml = `
      <div class="header">
        <h1>${receiptLayout.businessName || DEFAULT_RECEIPT_LAYOUT.businessName}</h1>
        <p>${settings.branchName.toUpperCase()} BRANCH</p>
        <p class="receipt-label">${receiptTitle}</p>
        <p>${receiptLayout.headerNote || DEFAULT_RECEIPT_LAYOUT.headerNote}</p>
      </div>
      <div class="dashed"></div>
      <div class="details">
        <div><span>Date:</span> <span>${lastSale.timestamp}</span></div>
        <div><span>Staff:</span> <span>${lastSale.staffFullName || lastSale.staff}</span></div>
        <div><span style="font-weight:bold">${activeReceiptType} Number:</span> <span style="font-weight:bold">#${lastSale.orNumber}</span></div>
      </div>
      <div class="dashed"></div>
      <div style="font-weight:bold; margin-bottom: 10px; display: flex; justify-content: space-between;">
        <span>DESCRIPTION</span>
        <span>TOTAL</span>
      </div>
      ${lastSale.items.map(item => `
        <div class="item-row">
          <div style="display:flex; flex-direction:column">
            <span>${item.name.toUpperCase()}</span>
            <span style="font-size:10px">${item.quantity} x ${currencyPrefix}${item.price.toLocaleString()}</span>
          </div>
          <span>${currencyPrefix}${(item.price * item.quantity).toLocaleString()}</span>
        </div>
      `).join('')}
      <div class="dashed"></div>
      <div class="total-row">
        <span>GRAND TOTAL</span>
        <span>${currencyPrefix}${lastSale.total.toLocaleString()}</span>
      </div>
      <div class="item-row" style="font-weight:bold;">
        <span>AMOUNT RECEIVED</span>
        <span>${currencyPrefix}${saleAmountReceived.toLocaleString()}</span>
      </div>
      <div class="item-row" style="font-weight:bold;">
        <span>CHANGE</span>
        <span>${currencyPrefix}${saleChange.toLocaleString()}</span>
      </div>
      <div class="footer">
        <p>${receiptLayout.footerNote || DEFAULT_RECEIPT_LAYOUT.footerNote}</p>
        <p>System ID: ${lastSale.id}</p>
        <p>${receiptLayout.thankYouNote || DEFAULT_RECEIPT_LAYOUT.thankYouNote}</p>
      </div>
    `;

    const printedFallback = await printHtmlInIframe(
      `${activeReceiptType}# ${lastSale.orNumber}`,
      fallbackHtml
    );
    if (printedFallback) {
      return;
    }

    if (capturedImageData) {
      const printedImage = await printImageInIframe(
        `${activeReceiptType}# ${lastSale.orNumber}`,
        capturedImageData
      );
      if (printedImage) {
        return;
      }
      console.warn('Failed to print captured image.');
    }

    alert('Printing failed. Please allow print dialogs and try again.');
  }, [lastSale, activeReceiptType, settings.branchName, receiptLayout, receiptTitle, receiptAccent, currencyPrefix, renderReceiptCanvas, saveReceiptImageToFolder, printImageInIframe, printHtmlInIframe]);

  useEffect(() => {
    if (!showReceipt || !lastSale || !settings.receiptAutoPrint) return;
    const timer = window.setTimeout(() => handlePrintReceipt(), 250);
    return () => window.clearTimeout(timer);
  }, [showReceipt, lastSale, settings.receiptAutoPrint, handlePrintReceipt]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0 animate-in fade-in duration-300 relative">
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Search catalog..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 transition-all font-bold text-black"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            onClick={() => setIsCartOpen(!isCartOpen)}
            className={`relative p-2 rounded-xl border transition-all ${isCartOpen ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
          >
            <ShoppingCart size={20} />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white ring-2 ring-white">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
          {successToast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl animate-in fade-in slide-in-from-top-4">
              {successToast}
            </div>
          )}
          <div className={`grid gap-4 ${isCartOpen ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 md:grid-cols-4 xl:grid-cols-5'}`}>
            {paginatedProducts.map(product => (
              <div 
                key={product.id}
                onClick={() => setQuickLookItem(product)}
                className={`group border rounded-xl p-3 transition-all cursor-pointer ${product.stock <= 0 ? 'bg-slate-50 opacity-60 grayscale' : 'bg-white hover:border-indigo-200 hover:shadow-lg hover:-translate-y-1'}`}
              >
                <div className="aspect-square rounded-lg overflow-hidden mb-2 relative bg-slate-50">
                  <img src={product.mainImage} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setQuickLookItem(product); }}
                    className="absolute top-2 left-2 p-1.5 bg-white/90 backdrop-blur rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Eye size={14} />
                  </button>
                  {product.materialGrade && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-white/90 backdrop-blur rounded-lg text-[7px] font-black text-indigo-700 border border-indigo-100 shadow-sm uppercase">
                      {product.materialGrade}
                    </span>
                  )}
                  {product.stock <= 0 && <span className="absolute inset-0 bg-slate-900/40 flex items-center justify-center text-[8px] font-black text-white uppercase">Out of Stock</span>}
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase truncate">{product.material} â€¢ {product.weightGrams}g</p>
                <h4 className="text-[10px] font-black text-slate-800 truncate uppercase mt-0.5">{product.name}</h4>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-indigo-600 font-black text-xs">{currencyPrefix}{product.price.toLocaleString()}</span>
                  <span className="text-[9px] font-bold text-slate-400">{product.stock}U</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Pagination
              totalItems={filteredProducts.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
            />
          </div>
        </div>
      </div>

      {isCartOpen && (
        <div className="w-full lg:w-72 2xl:w-80 flex flex-col bg-white rounded-2xl overflow-hidden text-slate-900 border border-slate-200 shadow-xl animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-slate-800">
              <ShoppingCart size={16} className="mr-2 text-indigo-600" /> Cart Contents
            </h3>
            <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-slate-900 lg:hidden">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <ShoppingBag size={48} strokeWidth={1} className="mb-2 opacity-30" />
                <p className="text-[8px] font-black uppercase tracking-widest opacity-40 text-slate-400">Add items to begin</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center space-x-3 transition-colors hover:bg-slate-100/80">
                  <img src={item.mainImage} className="w-10 h-10 rounded-lg object-cover border border-slate-200 shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black truncate uppercase text-slate-800">{item.name}</p>
                    </div>
                    <p className="text-[8px] text-indigo-600 font-black">{currencyPrefix}{item.price.toLocaleString()}</p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center bg-white rounded p-0.5 border border-slate-200">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-0.5 hover:bg-slate-50 text-slate-500 rounded"><Minus size={10} /></button>
                        <span className="text-[9px] font-black w-4 text-center text-slate-700">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-0.5 hover:bg-slate-50 text-slate-500 rounded"><Plus size={10} /></button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-slate-50/50 border-t border-slate-100 space-y-4">
            <div className="space-y-2">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Authorized Staff</label>
              <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                 <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-[10px]">
                   {currentUser?.firstName ? currentUser.firstName[0].toUpperCase() : currentUser?.username?.[0].toUpperCase()}
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-900 uppercase">
                     {db.getFullName(currentUser)}
                   </p>
                   <p className="text-[7px] font-bold text-indigo-600 uppercase tracking-widest">Active Session</p>
                 </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Receipt Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['OR', 'AR'] as ReceiptType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedReceiptType(type)}
                    className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                      selectedReceiptType === type
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Reference {selectedReceiptType}#</label>
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input 
                  type="text" 
                  value={orNumber}
                  onChange={(e) => setOrNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-8 pr-4 text-[10px] font-black outline-none focus:border-indigo-500 text-slate-600 shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-between items-end pt-2">
              <span className="text-[9px] font-black uppercase text-indigo-600">Total Payable</span>
              <span className="text-xl font-black tabular-nums text-slate-900">{currencyPrefix}{cartTotal.toLocaleString()}</span>
            </div>

            <button 
              disabled={cart.length === 0 || !staffOnDuty || isProcessing || !orNumber.trim()}
              onClick={handleCheckout}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-lg shadow-indigo-600/20"
            >
              {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><CheckCircle size={16} /> <span>Checkout Sale</span></>}
            </button>
          </div>
        </div>
      )}

      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <Receipt size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase text-slate-900 leading-tight">{receiptTitle}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{activeReceiptType} # {lastSale.orNumber}</p>
                </div>
              </div>
              <button onClick={() => setShowReceipt(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50 custom-scrollbar">
              <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm mb-6 flex items-start gap-4">
                 <Info size={16} className="text-indigo-500 mt-1 shrink-0" />
                 <p className="text-[10px] text-slate-600 font-bold leading-relaxed">
                    Use the buttons below to print or save this {activeReceiptType} document. This digital copy serves as your system audit record.
                  </p>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-2">
                {(['OR', 'AR'] as ReceiptType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedReceiptType(type);
                      setLastSale(prev => prev ? { ...prev, receiptType: type } : prev);
                    }}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                      activeReceiptType === type
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                    }`}
                  >
                    Print as {type}
                  </button>
                ))}
              </div>

              {/* Enhanced Receipt UI Container */}
              <div 
                ref={receiptRef} 
                data-receipt-capture="true"
                className="bg-white p-6 shadow-sm border mx-auto w-full max-w-95 font-mono text-slate-900"
                style={{ borderColor: '#d1d5db' }}
              >
                <div className="text-center mb-5">
                  <h1 className="text-[20px] font-black uppercase leading-tight">{receiptLayout.businessName || DEFAULT_RECEIPT_LAYOUT.businessName}</h1>
                  <p className="text-[11px] uppercase">{settings.branchName} BRANCH</p>
                  <p data-receipt-accent="true" className="text-[11px] font-black uppercase mt-1" style={{ color: receiptAccent }}>{receiptTitle}</p>
                  <p className="text-[10px] uppercase mt-1">{receiptLayout.headerNote || DEFAULT_RECEIPT_LAYOUT.headerNote}</p>
                </div>
                
                <div className="border-t-2 border-dashed border-black my-3"></div>
                
                <div className="space-y-1 text-[11px] mb-4 uppercase">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{lastSale.timestamp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Staff:</span>
                    <span>{getStaffFullName(lastSale.staff)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-black">{activeReceiptType} Number:</span>
                    <span className="font-black">#{lastSale.orNumber}</span>
                  </div>
                </div>

                <div className="border-t-2 border-dashed border-black my-3"></div>

                <div className="mb-4">
                  <div className="flex justify-between font-black text-[11px] uppercase mb-2">
                    <span>Description</span>
                    <span>Total</span>
                  </div>
                  <div className="space-y-2">
                    {lastSale.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-3">
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-[11px] uppercase truncate">{item.name}</span>
                          <span className="text-[10px]">{item.quantity} x {currencyPrefix}{item.price.toLocaleString()}</span>
                        </div>
                        <span className="text-[11px] whitespace-nowrap">{currencyPrefix}{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t-2 border-dashed border-black my-3"></div>

                <div className="space-y-1 text-[11px] uppercase">
                  <div className="flex justify-between font-black text-[15px] mt-2">
                    <span>Grand Total</span>
                    <span>{currencyPrefix}{lastSale.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span>Amount Received</span>
                    <span>{currencyPrefix}{(lastSale.amountReceived ?? lastSale.total).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span>Change</span>
                    <span>{currencyPrefix}{(lastSale.changeAmount ?? roundMoney(Math.max(0, (lastSale.amountReceived ?? lastSale.total) - lastSale.total))).toLocaleString()}</span>
                  </div>
                </div>

        {lastSale.reissued && (
          <div className="mt-4 p-3 border border-dashed border-black text-center">
            <p className="text-[10px] font-black uppercase mb-1">REISSUED RECORD</p>
            <p className="text-[9px] leading-tight uppercase">
              Exchange transaction performed on {new Date(lastSale.reissueDate || '').toLocaleDateString()} by {lastSale.reissueAdmin}.<br/>
              Original {activeReceiptType} sequence maintained.
            </p>
          </div>
        )}

        <div className="mt-6 pt-3 border-t-2 border-dashed border-black text-center uppercase text-[10px] space-y-1">
          <p>{receiptLayout.footerNote || DEFAULT_RECEIPT_LAYOUT.footerNote}</p>
          <p>System ID: {lastSale.id}</p>
          <p>{receiptLayout.thankYouNote || DEFAULT_RECEIPT_LAYOUT.thankYouNote}</p>
        </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                <button 
                  onClick={handlePrintReceipt}
                  className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                >
                  <Printer size={14} /> Print
                </button>
                <button 
                  onClick={handleSaveAsImage}
                  className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-800 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                >
                  <Download size={14} /> Save PNG
                </button>
                <button
                  onClick={handleSaveAsText}
                  className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-800 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                >
                  <FileText size={14} /> Save TXT
                </button>
                <button 
                  onClick={() => setShowReceipt(false)}
                  className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                >
                  <Copy size={14} /> New Sale
                </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: SUMMARY MODAL */}
      {checkoutStep === 1 && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-2rem shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between">
              <h3 className="text-sm font-black uppercase">Transaction Summary</h3>
              <button onClick={() => setCheckoutStep(0)}><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4 max-h-[50vh] overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-xs font-bold uppercase">
                  <span>{item.name} (x{item.quantity})</span>
                  <span>{currencyPrefix}{ (item.price * item.quantity).toLocaleString() }</span>
                </div>
              ))}
              <div className="pt-4 border-t flex justify-between items-end">
                <span className="text-[10px] font-black text-indigo-600 uppercase">Grand Total</span>
                <span className="text-2xl font-black">{currencyPrefix}{cartTotal.toLocaleString()}</span>
              </div>

              <div className="pt-4 border-t space-y-3">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest">Cash Received</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">{currency}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountReceivedInput}
                    onChange={(e) => setAmountReceivedInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-slate-500">Change</span>
                  <span className={`text-lg font-black ${canProceedWithPayment ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {currencyPrefix}{computedChange.toLocaleString()}
                  </span>
                </div>
                {!canProceedWithPayment && amountReceivedInput.trim() !== '' && (
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">
                    Insufficient payment. Add {currencyPrefix}{roundMoney(cartTotal - amountReceived).toLocaleString()} more.
                  </p>
                )}
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button onClick={() => setCheckoutStep(0)} className="flex-1 py-3 text-[10px] font-black uppercase">Cancel</button>
              <button
                onClick={() => setCheckoutStep(2)}
                disabled={!canProceedWithPayment}
                className="flex-1 py-3 bg-indigo-600 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl text-[10px] font-black uppercase"
              >
                Proceed to Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: FINAL VERIFICATION */}
      {checkoutStep === 2 && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-indigo-900/90 backdrop-blur-xl">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-10 text-center">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-xl font-black uppercase mb-4">Payment Verification</h3>
            <p className="text-sm text-slate-600 mb-8 font-medium">
              "I confirm that the **Full Payment** has been received and all items are **Physically Packed** for {selectedReceiptType}#{orNumber}."
            </p>
            <div className="mb-8 p-4 rounded-xl border border-slate-200 bg-slate-50 text-left space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
                <span>Cash Received</span>
                <span className="text-slate-900">{currencyPrefix}{amountReceived.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-600">
                <span>Change</span>
                <span>{currencyPrefix}{computedChange.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmCheckout} 
                disabled={isProcessing || !canProceedWithPayment}
                className="w-full py-4 bg-indigo-600 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20"
              >
                {isProcessing ? 'Recording...' : 'Yes, Record Transaction'}
              </button>
              <button onClick={() => setCheckoutStep(1)} className="w-full py-3 text-slate-400 font-bold uppercase text-[10px]">Back to Summary</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Look Modal */}
      {quickLookItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => setQuickLookItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row" onClick={(e) => e.stopPropagation()}>
            <div className="w-full md:w-1/2 p-6 bg-slate-50">
              <ProductGallery images={[quickLookItem.mainImage, ...(quickLookItem.thumbnails || [])]} />
            </div>
            <div className="flex-1 p-8 flex flex-col">
               <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{quickLookItem.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">SKU {quickLookItem.id} â€¢ {quickLookItem.category}</p>
                    </div>
                  </div>
                  <button onClick={() => setQuickLookItem(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-400" /></button>
               </div>
               <div className="space-y-6 flex-1 text-black">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Price</p>
                        <p className="text-2xl font-black text-indigo-600">{currencyPrefix}{quickLookItem.price.toLocaleString()}</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Specifications</p>
                        <p className="text-lg font-black text-slate-900">{quickLookItem.weightGrams}g {quickLookItem.material}</p>
                     </div>
                  </div>
                  <div className="pt-4">
                    <p className="text-[11px] text-slate-500 italic leading-relaxed font-medium">"{quickLookItem.detailedDescription}"</p>
                  </div>
               </div>
               <button 
                onClick={() => { addToCart(quickLookItem); setQuickLookItem(null); }}
                className="mt-8 w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
               >
                 Add to Cart Selection
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSView;
