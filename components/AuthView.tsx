
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User as UserIcon, Lock, ArrowRight, Sparkles, ShieldCheck, CheckCircle2, AlertCircle, Briefcase, Eye, EyeOff, QrCode, X, Camera, Key, Link2 } from 'lucide-react';
import { db } from '../db';
import { User } from '../types';
import jsQR from 'jsqr';

interface AuthViewProps {
  onLoginSuccess: (user: User) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [activeApiBase, setActiveApiBase] = useState(() => db.getApiBase());
  const [apiBaseInput, setApiBaseInput] = useState(() => db.getApiBaseOverride() || db.getApiBase());
  const [apiBaseMessage, setApiBaseMessage] = useState('');
  const [apiBaseError, setApiBaseError] = useState('');
  
  // Registration code states
  const [registryCode, setRegistryCode] = useState('');
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const passwordsMatch = useMemo(() => isLogin || !confirmPassword || password === confirmPassword, [password, confirmPassword, isLogin]);

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const startScanner = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          tick();
        }
      } catch (err) {
        setError('Camera access denied');
        setIsScanning(false);
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.height = videoRef.current.videoHeight;
          canvas.width = videoRef.current.videoWidth;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code) {
            handleQRSuccess(code.data);
            return;
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

  const handleQRSuccess = async (data: string) => {
    setIsScanning(false);
    setIsLoading(true);
    // data is the secure token: JEWEL:base64(...)
    const user = await db.loginViaQR(data);
    if (user) {
      onLoginSuccess(user);
    } else {
      setError('Invalid or Expired QR Badge');
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isLogin) {
      if (!firstName.trim() || !lastName.trim()) {
        setError('First Name and Last Name are strictly required');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords mismatch');
        return;
      }
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        const user = await db.login(username, password);
        if (user) {
          onLoginSuccess(user);
        } else {
          const connected = await checkConnection();
          if (connected) {
            setError('Invalid credentials');
          } else {
            setError('Backend offline or API URL is incorrect. Configure API endpoint from the API button.');
            setShowApiSettings(true);
          }
        }
      } else {
        const result = await db.register(username, password, 'staff', firstName, lastName, registryCode);
        if (result.success) {
          setIsLogin(true);
          setIsCodeVerified(false);
          setRegistryCode('');
          setError('Staff account created!');
        } else setError(result.message);
      }
    } catch (err) {
      setError('System error');
      setShowApiSettings(true);
    }
    setIsLoading(false);
  };

  const verifyCode = async () => {
    try {
      const verifyUrl = `${db.getApiBase()}/codes/verify`;
      const response = await fetch(
        verifyUrl,
        db.getApiRequestOptions(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: registryCode.toUpperCase() })
        })
      );
      if (response.ok) {
        setIsCodeVerified(true);
        setError('');
      } else {
        const data = await response.json();
        setError(data.message || 'Invalid or Expired Registry Code');
        setIsCodeVerified(false);
      }
    } catch (err) {
      setError('Failed to verify code. Check API endpoint and backend connection.');
      setShowApiSettings(true);
      await checkConnection();
      setIsCodeVerified(false);
    }
  };

  const handleShowRegister = () => {
    setIsLogin(false);
    setIsCodeVerified(false);
    setRegistryCode('');
    setError('');
  };

  const checkConnection = async (baseOverride?: string) => {
    const base = baseOverride || db.getApiBase();
    try {
      const healthUrl = `${base}/health`;
      const response = await fetch(healthUrl, db.getApiRequestOptions(healthUrl));
      if (!response.ok) throw new Error('Health check failed');
      setApiBaseError('');
      setApiBaseMessage('Backend connection is active.');
      return true;
    } catch {
      setApiBaseMessage('');
      setApiBaseError('Cannot reach backend. Check API URL and ngrok status.');
      return false;
    }
  };

  const handleApplyApiBase = async () => {
    setApiBaseMessage('');
    setApiBaseError('');
    try {
      const next = db.setApiBaseOverride(apiBaseInput);
      setActiveApiBase(next);
      setApiBaseInput(next);
      setError('');
      await checkConnection(next);
    } catch (err: any) {
      setApiBaseMessage('');
      setApiBaseError(err?.message || 'Invalid API URL');
    }
  };

  const handleResetApiBase = async () => {
    setApiBaseMessage('');
    setApiBaseError('');
    const fallback = db.clearApiBaseOverride();
    setActiveApiBase(fallback);
    setApiBaseInput(fallback);
    setError('');
    await checkConnection(fallback);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 relative p-4 text-sm">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px]"></div>
      <button
        type="button"
        onClick={() => setShowApiSettings(true)}
        className="absolute top-4 right-4 z-30 w-11 h-11 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all shadow-lg"
        title="Configure Backend API"
      >
        <Link2 size={16} />
      </button>
      
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm aspect-square bg-slate-900 rounded-[3rem] border-4 border-white/10 overflow-hidden shadow-2xl ring-8 ring-white/5">
            {/* Blurred overlay outside viewfinder */}
            <div className="absolute inset-0 bg-black/60 z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, calc(50% - 130px) calc(50% - 130px), calc(50% - 130px) calc(50% + 130px), calc(50% + 130px) calc(50% + 130px), calc(50% + 130px) calc(50% - 130px), calc(50% - 130px) calc(50% - 130px))' }}></div>
            {/* Video - fully visible inside viewfinder */}
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Viewfinder overlay - clear inside */}
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/40 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center relative">
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-16 h-16 border-l-4 border-t-4 border-white/60 rounded-tl-3xl"></div>
                <div className="absolute top-0 right-0 w-16 h-16 border-r-4 border-t-4 border-white/60 rounded-tr-3xl"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 border-l-4 border-b-4 border-white/60 rounded-bl-3xl"></div>
                <div className="absolute bottom-0 right-0 w-16 h-16 border-r-4 border-b-4 border-white/60 rounded-br-3xl"></div>
                {/* Scanning line animation */}
                <div className="absolute top-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_20px_#4f46e5] animate-scan"></div>
              </div>
            </div>

            <div className="absolute bottom-8 left-0 right-0 px-8 text-center z-10">
              <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] opacity-80 mb-1">Optical Authentication</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Hold your badge steady</p>
            </div>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsScanning(false);
              }}
              className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-2xl text-white rounded-full hover:bg-white/20 transition-all active:scale-90 cursor-pointer z-50"
              title="Close QR Scanner"
            >
              <X size={20} className="text-white hover:text-slate-200 transition-colors" />
            </button>
          </div>
        </div>
      )}

      {showApiSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowApiSettings(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                  <Link2 size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">Backend API Endpoint</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Active: {activeApiBase}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiSettings(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:bg-white/20 flex items-center justify-center transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 px-3 text-white text-[10px] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                value={apiBaseInput}
                onChange={e => setApiBaseInput(e.target.value)}
                placeholder="https://your-ngrok-url.ngrok-free.app"
              />
              {apiBaseMessage && <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400">{apiBaseMessage}</p>}
              {apiBaseError && <p className="text-[8px] font-black uppercase tracking-widest text-rose-400">{apiBaseError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleApplyApiBase}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                >
                  Save Endpoint
                </button>
                <button
                  type="button"
                  onClick={handleResetApiBase}
                  className="py-2.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 transition-all"
                >
                  Reset Default
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-600/30 mb-4 ring-4 ring-white/5">
            <Sparkles className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">JewelAdmin Pro</h1>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5 opacity-60">Strategic Branch Governance System</p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl ring-1 ring-white/5">
          <div className="flex bg-slate-950/40 p-1.5 rounded-2xl border border-white/5 mb-8">
            <button onClick={() => { setIsLogin(true); setIsCodeVerified(false); setRegistryCode(''); setError(''); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Login</button>
            <button onClick={handleShowRegister} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Register</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Login Tab */}
            {isLogin && (
              <>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Username</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input id="username" name="username" autoComplete="username" required placeholder="Staff ID" className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-white text-[11px] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-800" value={username} onChange={e => setUsername(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase mb-2 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input id="password" name="password" autoComplete="current-password" required type={showPassword ? "text" : "password"} placeholder="••••••••" className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 pl-11 pr-12 text-white text-[11px] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-800" value={password} onChange={e => setPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-indigo-400 transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Register Tab - Code Verification First */}
            {!isLogin && !isCodeVerified && (
              <div className="space-y-4 py-4 animate-in fade-in duration-300">
                <div className="text-center mb-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">New Employee Registration</p>
                  <p className="text-[8px] text-slate-500">Enter the code provided by your admin</p>
                </div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Registry Code</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input 
                    placeholder="ENTER CODE" 
                    className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-white text-[11px] font-bold outline-none uppercase focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-800"
                    value={registryCode}
                    onChange={e => setRegistryCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        verifyCode();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <button 
                  type="button"
                  onClick={verifyCode}
                  disabled={!registryCode || isLoading}
                  className="w-full bg-indigo-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50 hover:bg-indigo-700 transition-all"
                >
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            )}

            {/* Register Tab - Registration Form (after code verified) */}
            {!isLogin && isCodeVerified && (
              <>
                <div className="text-center mb-4">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Code Verified!</p>
                  <p className="text-[8px] text-slate-500">Complete your registration below</p>
                </div>

                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Username</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input id="regUsername" name="regUsername" autoComplete="username" required placeholder="Choose Staff ID" className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-white text-[11px] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-800" value={username} onChange={e => setUsername(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase mb-2 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input id="regPassword" name="regPassword" autoComplete="new-password" required type={showPassword ? "text" : "password"} placeholder="Create Password" className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 pl-11 pr-12 text-white text-[11px] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-800" value={password} onChange={e => setPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-indigo-400 transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input id="confirmPassword" name="confirmPassword" autoComplete="new-password" required type={showPassword ? "text" : "password"} placeholder="Confirm Password" className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 pl-11 pr-12 text-white text-[11px] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-800" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {confirmPassword && (password === confirmPassword ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-rose-500" />)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase mb-2 ml-1">First Name</label>
                    <input 
                      required 
                      placeholder="First Name"
                      className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 px-4 text-white text-[11px] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-800" 
                      value={firstName} 
                      onChange={e => setFirstName(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase mb-2 ml-1">Last Name</label>
                    <input 
                      required 
                      placeholder="Last Name"
                      className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 px-4 text-white text-[11px] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-800" 
                      value={lastName} 
                      onChange={e => setLastName(e.target.value)} 
                    />
                  </div>
                </div>
              </>
            )}

            {error && <div className={`text-center py-3 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider ${error.includes('created') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{error}</div>}

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setIsScanning(true)}
                className="flex items-center justify-center space-x-2 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all active:scale-95 shadow-lg group"
              >
                <QrCode size={18} className="group-hover:text-indigo-400 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest">Badge Scan</span>
              </button>
              
              {isLogin ? (
                <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white font-black uppercase text-[10px] py-3 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center space-x-2">
                  {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><ShieldCheck size={18} /> <span>Grant Access</span></>}
                </button>
              ) : (
                isCodeVerified && (
                  <button type="submit" disabled={isLoading || password !== confirmPassword} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white font-black uppercase text-[10px] py-3 rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center space-x-2">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><CheckCircle2 size={18} /> <span>Create Account</span></>}
                  </button>
                )
              )}
            </div>
          </form>
        </div>

        <p className="text-center mt-8 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] opacity-40 leading-relaxed">
          Proprietary Digital Governance Infrastructure<br/>
          Rodriguez Rizal Branch • Authorized Access Required
        </p>
      </div>
    </div>
  );
};

export default AuthView;
