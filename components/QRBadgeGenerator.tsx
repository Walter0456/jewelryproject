
import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, QrCode as QrIcon, CheckCircle, Info } from 'lucide-react';
import { User as UserType, SystemSettings } from '../types';
import { db } from '../db';
import html2canvas from 'html2canvas';

interface QRBadgeGeneratorProps {
  user: UserType;
  settings: SystemSettings;
}

const QRBadgeGenerator: React.FC<QRBadgeGeneratorProps> = ({ user, settings }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  const generateQRBadge = async () => {
    setIsGenerating(true);
    try {
      const token = await db.saveQRToken(user.username);
      if (!token) {
        throw new Error('Failed to generate token');
      }

      const qrUrl = await QRCode.toDataURL(token, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a', // slate-900
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });
      
      setQrDataUrl(qrUrl);
    } catch (err) {
      console.error("QR Generation failed", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!badgeRef.current) return;
    
    try {
      const canvas = await html2canvas(badgeRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `QR_Badge_${user.username}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 py-4">
      {!qrDataUrl ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <QrIcon size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Issue Security Badge</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-8 font-medium">
            Generating a badge will invalidate any previously issued QR codes for this staff member.
          </p>
          <button
            onClick={generateQRBadge}
            disabled={isGenerating}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 disabled:bg-slate-300"
          >
            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <QrIcon size={20} />}
            Generate New Badge
          </button>
        </div>
      ) : (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* The Badge - Styled for physical ID cards */}
            <div 
              ref={badgeRef}
              className="bg-white border-8 border-slate-950 rounded-[2.5rem] p-10 shadow-2xl mx-auto shrink-0 relative overflow-hidden"
              style={{ width: '400px', height: '620px' }}
            >
              {/* Branding Header */}
              <div className="text-center border-b-4 border-slate-950 pb-8 mb-8">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-black text-3xl">J</span>
                  </div>
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-950">
                  {settings.branchName}
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
                  OFFICIAL ACCESS BADGE
                </p>
              </div>

              {/* QR Container */}
              <div className="flex justify-center mb-8 relative">
                <div className="absolute -inset-4 bg-indigo-600/5 rounded-full blur-2xl"></div>
                <div className="bg-white p-5 rounded-[2rem] border-4 border-slate-100 shadow-inner relative z-10">
                  <img src={qrDataUrl} alt="Secure Token QR" className="w-48 h-48" />
                </div>
              </div>

              {/* Staff Credentials */}
              <div className="space-y-3 bg-slate-50 rounded-3xl p-6 border-2 border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</span>
                  <span className="text-xl font-black text-slate-900 uppercase tracking-tight">{db.getFullName(user)}</span>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">@{user.username}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Authority</span>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    user.role === 'admin' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                      : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 mt-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Validity</span>
                  <span className="flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase">
                    <CheckCircle size={12} strokeWidth={3} /> VERIFIED ACTIVE
                  </span>
                </div>
              </div>

              {/* Legal/Footer */}
              <div className="mt-8 pt-4 border-t border-slate-200 text-center opacity-40">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] leading-relaxed">
                  Confidential Property of {settings.branchName} Branch<br/>
                  Scan to Authenticate Session • No Sharing Permitted
                </p>
              </div>
            </div>

            {/* Sidebar Actions & Info */}
            <div className="flex-1 space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3 text-emerald-600 mb-3">
                  <CheckCircle size={20} />
                  <h4 className="text-sm font-black uppercase tracking-tight">Badge Provisioned</h4>
                </div>
                <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                  The digital key has been synchronized with the secure database. You can now issue this physical credential to {db.getFullName(user)}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                >
                  <Download size={18} />
                  Download PNG
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-lg active:scale-95"
                >
                  <Printer size={18} />
                  Print Badge
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
                <h4 className="flex items-center gap-2 text-[10px] font-black text-amber-900 uppercase tracking-[0.15em] mb-4">
                  <Info size={16} /> Physical Issue Guide
                </h4>
                <ol className="space-y-3 text-[10px] text-amber-800 font-bold uppercase tracking-wide list-decimal list-inside opacity-80">
                  <li>Export badge as high-res image</li>
                  <li>Print on 300gsm heavy cardstock</li>
                  <li>Laminate to prevent wear and tear</li>
                  <li>Test badge at the login terminal</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRBadgeGenerator;
