
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, Filter, FileText, Printer, User as UserIcon, X, Camera } from 'lucide-react';
import { Product, Activity, Sale, User } from '../../types';
import { db } from '../../db';
import jsqr from 'jsqr';
import Pagination from '../Pagination';
import { printFullReport } from '../../utils/printService';

// Helper to extract date portion from locale string for comparison
const extractDateFromTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

interface DailyInventoryReportProps {
  products: Product[];
  logs: Activity[];
  sales: Sale[];
  users: User[];
}

const DailyInventoryReport: React.FC<DailyInventoryReportProps> = ({ products, logs, sales, users }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState('Rodriguez Rizal');
  const [snapshotMap, setSnapshotMap] = useState<Record<string, Record<string, number>>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // NEW: Printing Verification States
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPerson, setScannedPerson] = useState<string>("System Default");
  const [isVerifying, setIsVerifying] = useState(false);

  // Scanner Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // QR Scanning Logic
  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const startScanner = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          tick();
        }
      } catch (err) {
        console.error("Camera access denied", err);
        setIsScanning(false);
      }
    };

    const tick = () => {
      if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.height = videoRef.current.videoHeight;
          canvas.width = videoRef.current.videoWidth;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsqr(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            handleVerifyBadge(code.data);
            return; // Stop ticking once code is found
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    if (isScanning) {
      startScanner();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isScanning]);

  const handleVerifyBadge = async (token: string) => {
    setIsVerifying(true);
    try {
      // Use verifyQRToken instead of loginViaQR to avoid changing the logged-in user
      const user = await db.verifyQRToken(token);
      if (user) {
        console.log('QR Verified User Data:', user);
        const matchedUser = users.find(u => u.username === user.username);
        const fullName = db.getFullName(matchedUser || user);
        console.log('Computed Full Name:', fullName);
        setScannedPerson(fullName);
        setIsScanning(false);

        printFullReport(
          'Daily Inventory Movement',
          ['Item', 'Beg. Bal', 'Deliveries', 'Change In', 'Change Out', 'Sold', 'Ending Bal'],
          reportData.map(item => [
            item.description,
            item.beginningBalance,
            item.deliveries,
            item.adjIn,
            item.adjOut,
            item.sold,
            item.endingBalance
          ]),
          { branch: branchFilter, verifiedBy: fullName }
        );
      } else {
        alert("Invalid Badge. Verification Failed.");
      }
    } catch (err) {
      console.error('Verification error:', err);
      alert("System Error during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePrintRequest = () => {
    setIsScanning(true);
  };

  useEffect(() => {
    let isMounted = true;
    if (!selectedDate) return;
    const selected = new Date(selectedDate);
    const prev = new Date(selected);
    prev.setDate(prev.getDate() - 1);
    const prevDate = prev.toISOString().split('T')[0];

    Promise.all([
      db.getInventorySnapshots(selectedDate).catch(() => []),
      db.getInventorySnapshots(prevDate).catch(() => [])
    ])
      .then(([currentRows, prevRows]) => {
        if (!isMounted) return;
        const toMap = (rows: { productId: string; closingStock: number }[]) =>
          rows.reduce<Record<string, number>>((acc, row) => {
            acc[row.productId] = row.closingStock;
            return acc;
          }, {});
        setSnapshotMap({
          [selectedDate]: toMap(currentRows as any),
          [prevDate]: toMap(prevRows as any)
        });
      })
      .catch(() => {
        if (isMounted) setSnapshotMap({});
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  const reportData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const selected = new Date(selectedDate);
    const prev = new Date(selected);
    prev.setDate(prev.getDate() - 1);
    const prevDate = prev.toISOString().split('T')[0];

    return products.map(product => {
      // Filter logs for this specific ID and Date
      const productLogs = logs.filter(l => 
        extractDateFromTimestamp(l.timestamp) === selectedDate && 
        l.item.includes(`ID:${product.id}`)
      );

      // 1. Deliveries (From new products AND delivery logs)
      const deliveriesToday = productLogs
        .filter(l => l.action === 'Delivery Received' || l.action === 'Added Product')
        .reduce((sum, l) => {
            const match = l.item.match(/QTY:(\d+)/);
            return sum + (match ? parseInt(match[1]) : 0);
        }, 0);

      // 2. Sales
      const dateSales = sales.filter(s => s.status !== 'void' && extractDateFromTimestamp(s.timestamp) === selectedDate);
      const soldToday = dateSales.reduce((sum, s) => {
        const item = s.items.find(i => i.id === product.id);
        return sum + (item ? item.quantity : 0);
      }, 0);

      // 3. NEW: Exchanges (Movement)
      const adjIn = productLogs
        .filter(l => l.action === 'EXCHANGE_RETURN')
        .reduce((sum, l) => {
            const match = l.item.match(/QTY:(\d+)/);
            return sum + (match ? parseInt(match[1]) : 0);
        }, 0);

      const adjOut = productLogs
        .filter(l => l.action === 'EXCHANGE_OUT')
        .reduce((sum, l) => {
            const match = l.item.match(/QTY:(\d+)/);
            return sum + (match ? parseInt(match[1]) : 0);
        }, 0);

      const snapshotEnding = snapshotMap[selectedDate]?.[product.id];
      const snapshotBeginning = snapshotMap[prevDate]?.[product.id];

      const endingBalance = selectedDate === today
        ? product.stock
        : (snapshotEnding ?? product.stock);

      // Math: Beg = End - Del - AdjIn + AdjOut + Sold
      const beginningBalance = snapshotBeginning ?? (endingBalance - deliveriesToday - adjIn + adjOut + soldToday);

      return {
        id: product.id,
        description: product.name,
        beginningBalance,
        deliveries: deliveriesToday,
        adjIn, // Now populates from EXCHANGE_RETURN
        adjOut, // Now populates from EXCHANGE_OUT
        sold: soldToday,
        endingBalance
      };
    });
  }, [products, logs, sales, selectedDate, snapshotMap]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, reportData.length]);

  const effectivePageSize = itemsPerPage <= 0 ? reportData.length || 1 : itemsPerPage;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedReport = reportData.slice(startIndex, startIndex + effectivePageSize);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* QR Scanner Modal (No-Print) */}
      {isScanning && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 no-print">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Camera size={32} />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight">Identity Verification</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
              Scan your Employee Badge to authorize this report
            </p>
            
            <div className="relative aspect-square bg-black rounded-3xl overflow-hidden mb-6 border-4 border-slate-100">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-30px border-black/40 pointer-events-none"></div>
            </div>

            <button 
              onClick={() => setIsScanning(false)}
              className="w-full py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters (No-Print) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Branch</label>
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <select className="bg-white border border-slate-200 rounded-lg py-1.5 pl-8 pr-4 text-[10px] font-bold outline-none text-black" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                <option value="Rodriguez Rizal">Rodriguez Rizal Branch</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input type="date" className="bg-white border border-slate-200 rounded-lg py-1.5 pl-8 pr-4 text-[10px] font-bold outline-none text-black" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Entries</label>
            <select
              className="bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-[10px] font-bold outline-none text-black"
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(parseInt(e.target.value, 10)); setCurrentPage(1); }}
            >
              {[10, 25, 50, 100, 0].map(num => (
                <option key={num} value={num}>{num === 0 ? 'Show All' : `${num} Entries`}</option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={handlePrintRequest} 
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
        >
          <Printer size={14} /> Verify & Print Report
        </button>
      </div>

      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <FileText size={120} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Daily Inventory Movement</h3>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Status: Generated Auto-Report</p>
          </div>
          <div className="flex items-center md:justify-end gap-6">
            <div className="text-right">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Person on Duty (Verified)</p>
               <div className="flex items-center justify-end gap-2 mt-1">
                 <UserIcon size={12} className={scannedPerson === "System Default" ? "text-slate-300" : "text-indigo-600"} />
                 {/* This name cannot be edited by the user, only by the scan */}
                 <p className={`text-sm font-black uppercase tracking-tight ${scannedPerson === "System Default" ? "text-slate-400 italic" : "text-slate-900"}`}>
                   {scannedPerson}
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-[10px]">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Beg. Bal</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Deliveries</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Change In</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Change Out</th>
              <th className="px-4 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Sold</th>
              <th className="px-6 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-center">Ending Bal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginatedReport.map(row => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-black text-slate-900 uppercase">{row.description}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Catalog #{row.id}</p>
                </td>
                <td className="px-4 py-4 text-center font-bold text-slate-500">{row.beginningBalance}</td>
                <td className="px-4 py-4 text-center font-bold text-emerald-600">{row.deliveries > 0 ? `+${row.deliveries}` : '-'}</td>
                <td className="px-4 py-4 text-center font-bold text-indigo-600">{row.adjIn > 0 ? `+${row.adjIn}` : '-'}</td>
                <td className="px-4 py-4 text-center font-bold text-rose-500">{row.adjOut > 0 ? `-${row.adjOut}` : '-'}</td>
                <td className="px-4 py-4 text-center font-bold text-indigo-900">{row.sold > 0 ? row.sold : '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white rounded-lg font-black text-[10px]">
                    {row.endingBalance} Units
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        totalItems={reportData.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
        itemsPerPageOptions={[10, 25, 50, 100, 0]}
      />

      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
         <p className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={12} /> Data reflects movements up to the current timestamp. Manual overrides are disabled to ensure audit integrity.
         </p>
      </div>
    </div>
  );
};

export default DailyInventoryReport;
