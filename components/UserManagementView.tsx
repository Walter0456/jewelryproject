
import React, { useState } from 'react';
import { Shield, Trash2, UserPlus, Fingerprint, QrCode, X } from 'lucide-react';
import { User as UserType, SystemSettings } from '../types';
import { db } from '../db';
import QRBadgeGenerator from './QRBadgeGenerator';

interface UserManagementViewProps {
  users: UserType[];
  settings: SystemSettings;
  onDeleteUser: (username: string) => void;
}

const UserManagementView: React.FC<UserManagementViewProps> = ({ users, settings, onDeleteUser }) => {
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pinPrompt, setPinPrompt] = useState<{username: string} | null>(null);
  const [pinInput, setPinInput] = useState('');

  const handleDeleteClick = (username: string) => {
    setDeleteConfirm(username);
  };

  const handleFinalDelete = (username: string) => {
    setPinPrompt({ username });
    setPinInput('');
  };

  const verifyPinAndExclude = async () => {
    const valid = await db.verifyAdminPin(pinInput);
    if (valid) {
      if (pinPrompt) {
        onDeleteUser(pinPrompt.username);
        setPinPrompt(null);
        setDeleteConfirm(null);
        setPinInput('');
      }
    } else {
      alert('INCORRECT MASTER PIN');
      setPinInput('');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Access Control</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Manage authorized store personnel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user.username} className="bg-white p-6 rounded-2rem border border-slate-200 shadow-sm flex flex-col hover:border-indigo-200 transition-colors group">
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shadow-inner">
                {user.role === 'admin' ? <Shield size={28} /> : <Fingerprint size={28} />}
              </div>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-sm ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {user.role}
              </span>
            </div>
            
            <div className="mb-8">
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{db.getFullName(user)}</h4>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">@{user.username}</p>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100">
              {deleteConfirm === user.username ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <button 
                    onClick={() => handleFinalDelete(user.username)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-600/20"
                  >
                    <Trash2 size={14} /> Delete Account Permanently
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm(null)}
                    className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      setSelectedUser(user);
                      setShowQRGenerator(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all active:scale-95"
                  >
                    <QrCode size={14} /> Generate QR Badge
                  </button>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Access</span>
                    {(user.username !== 'admin') ? (
                      <button 
                        onClick={() => handleDeleteClick(user.username)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    ) : (
                      <span className="text-[9px] font-black text-indigo-500 uppercase">System Root</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        
        <div className="bg-slate-100 p-6 rounded-2rem border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center py-12 group cursor-not-allowed">
           <UserPlus size={40} className="text-slate-300 mb-4 group-hover:scale-110 transition-transform" />
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Add New Staff</p>
           <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 italic">Use registration portal</p>
        </div>
      </div>

      {showQRGenerator && selectedUser && (
        <div className="fixed inset-0 z-100 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 no-print" onClick={() => setShowQRGenerator(false)}>
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl p-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Credential Management</h2>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQRGenerator(false);
                }} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Close QR Badge Generator"
              >
                <X size={24} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <QRBadgeGenerator user={selectedUser} settings={settings} />
          </div>
        </div>
      )}

      {pinPrompt && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Master Verification</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Enter Admin PIN to delete @{pinPrompt.username}</p>
            </div>
            <input 
              type="password" 
              maxLength={6}
              className="w-full text-center text-2xl font-bold tracking-[0.5em] border-b-2 border-indigo-600 outline-none mb-8 bg-transparent text-slate-900"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyPinAndExclude()}
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={() => { setPinPrompt(null); setPinInput(''); }} 
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={verifyPinAndExclude}
                className="flex-1 bg-rose-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
              >
                Verify & Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
