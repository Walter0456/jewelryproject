import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, MapPin, Settings as SettingsIcon, CreditCard, Package, Bell, 
  Database, ShieldAlert, Save, RefreshCcw, QrCode, Trash2, ShieldCheck, 
  Ban, CheckCircle, ChevronRight, HardDriveDownload, HardDriveUpload, X, User, Edit, Plus, Printer
} from 'lucide-react';
import { SystemSettings, User as UserType } from '../types';
import { db } from '../db';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

interface SettingsViewProps {
  onSettingsUpdate: () => void;
  initialSettings: SystemSettings;
  initialUsers: UserType[];
  onProfileUpdate?: () => void;
}

type BackupSettings = NonNullable<SystemSettings['backupSettings']>;
const DEFAULT_RECEIPT_LAYOUT = {
  businessName: 'Rodriguez Jewelry',
  headerNote: 'Authorized Sale Record',
  footerNote: 'This receipt serves as your proof of transaction.',
  thankYouNote: 'Thank you for your purchase.',
  officialReceiptLabel: 'Official Receipt',
  acknowledgementReceiptLabel: 'Acknowledgement Receipt',
  accentColor: '#4f46e5',
  defaultReceiptType: 'OR' as const,
  receiptSavePath: 'receipts'
};

const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsUpdate, initialSettings, initialUsers, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState('Staff');
  
  const [settings, setSettings] = useState<SystemSettings>({
    ...initialSettings,
    adminPin: initialSettings.adminPin ?? '',
    hasAdminPin: initialSettings.hasAdminPin ?? false,
    lowStockAlerts: initialSettings.lowStockAlerts ?? true,
    salesSummaryAlerts: initialSettings.salesSummaryAlerts ?? true,
    securityAlerts: initialSettings.securityAlerts ?? true,
    inventorySyncAlerts: initialSettings.inventorySyncAlerts ?? true,
    desktopNotifications: initialSettings.desktopNotifications ?? true,
    emailNotifications: initialSettings.emailNotifications ?? false,
    alertEmailAddress: initialSettings.alertEmailAddress ?? '',
    dailySummaryTime: initialSettings.dailySummaryTime ?? '18:00',
    lowStockCheckFrequency: initialSettings.lowStockCheckFrequency ?? 'hourly',
    receiptLayout: {
      ...DEFAULT_RECEIPT_LAYOUT,
      ...(initialSettings.receiptLayout || {})
    },
    backupSettings: {
      enabled: initialSettings.backupSettings?.enabled ?? false,
      time: initialSettings.backupSettings?.time ?? '02:00',
      path: initialSettings.backupSettings?.path ?? 'backups',
      provider: initialSettings.backupSettings?.provider ?? 'local',
      taskName: initialSettings.backupSettings?.taskName,
      lastBackupAt: initialSettings.backupSettings?.lastBackupAt,
      lastBackupFile: initialSettings.backupSettings?.lastBackupFile,
      lastUploadsZip: initialSettings.backupSettings?.lastUploadsZip ?? null
    }
  });
  const [users, setUsers] = useState<UserType[]>(initialUsers);
  const [branchPin, setBranchPin] = useState('');
  const [currentAdminPin, setCurrentAdminPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [confirmAdminPin, setConfirmAdminPin] = useState('');
  
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const requireAdminPin = async (pin: string) => {
    if (!pin || pin.trim().length === 0) {
      alert('PLEASE ENTER MASTER PIN');
      return false;
    }
    const valid = await db.verifyAdminPin(pin.trim());
    if (!valid) {
      alert('INCORRECT MASTER PIN');
    }
    return valid;
  };

  const [isSaved, setIsSaved] = useState(false);
  const [apiBaseInput, setApiBaseInput] = useState('');
  const [apiBaseMessage, setApiBaseMessage] = useState<string | null>(null);
  const [apiBaseError, setApiBaseError] = useState<string | null>(null);
  const [activeApiBase, setActiveApiBase] = useState(() => db.getApiBase());
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [receiptPathBusy, setReceiptPathBusy] = useState(false);
  const [testPrintBusy, setTestPrintBusy] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{username: string, token: string, qrDataUrl?: string} | null>(null);
  const [profileEdit, setProfileEdit] = useState<{firstName: string, lastName: string, profilePicture?: string} | null>(null);
  const [editingUser, setEditingUser] = useState<{username: string, firstName: string, lastName: string, profilePicture?: string} | null>(null);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<UserType | null>(null);
  const [staffEditModal, setStaffEditModal] = useState<{
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    pin: string;
  } | null>(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [branchPinModal, setBranchPinModal] = useState(false);
  const [deletePinModal, setDeletePinModal] = useState(false);
  const testReceiptPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialApiBase = db.getApiBaseOverride() || db.getApiBase();
    setApiBaseInput(initialApiBase);
    setActiveApiBase(db.getApiBase());
  }, []);

  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>, isSelf: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isSelf) {
          setProfileEdit(prev => {
             const currentUser = users.find(u => u.username === db.getCurrentUser()?.username);
             const baseState = prev || (currentUser ? { firstName: currentUser.firstName || '', lastName: currentUser.lastName || '', profilePicture: currentUser.profilePicture } : { firstName: '', lastName: '' });
             return { ...baseState, profilePicture: reader.result as string };
          });
        } else {
          setEditingUser(prev => prev ? { ...prev, profilePicture: reader.result as string } : null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const tabs = [
    { name: 'Profile', icon: <User size={18} /> },
    { name: 'Staff', icon: <Users size={18} /> },
    { name: 'Branch', icon: <MapPin size={18} /> },
    { name: 'System', icon: <SettingsIcon size={18} /> },
    { name: 'POS', icon: <CreditCard size={18} /> },
    { name: 'Products', icon: <Package size={18} /> },
    { name: 'Alerts', icon: <Bell size={18} /> },
    { name: 'Security', icon: <ShieldAlert size={18} /> },
    { name: 'Maintenance', icon: <Database size={18} /> },
  ];

  const handleSave = async () => {
    if (activeTab === 'Branch') {
      setPinInput(branchPin);
      setBranchPinModal(true);
      return;
    }

    if (activeTab === 'Security' && newAdminPin.trim() !== '') {
      if (!/^\d{4,6}$/.test(newAdminPin)) {
        alert('NEW PIN MUST BE 4-6 DIGITS');
        return;
      }
      if (newAdminPin !== confirmAdminPin) {
        alert('NEW PIN DOES NOT MATCH CONFIRMATION');
        return;
      }
      if (settings.hasAdminPin) {
        const pinOk = await requireAdminPin(currentAdminPin);
        if (!pinOk) return;
      }
      await db.saveSettings({ ...settings, adminPin: newAdminPin, currentAdminPin });
      setCurrentAdminPin('');
      setNewAdminPin('');
      setConfirmAdminPin('');
      setSettings(prev => ({ ...prev, adminPin: '', hasAdminPin: true }));
    } else {
      await db.saveSettings(settings);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    onSettingsUpdate();
  };

  const handleToggleUser = async (username: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
    await db.updateUserStatus(username, nextStatus as any);
    const updatedUsers = await db.getUsers();
    setUsers(updatedUsers);
  };

  const handleGenerateQR = async (username: string) => {
    const token = await db.saveQRToken(username);
    if (!token) {
      alert('Failed to generate QR token');
      return;
    }
    const qrDataUrl = await QRCode.toDataURL(token, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    setQrModal({ username, token, qrDataUrl });
  };

  const handleExport = async () => {
    const data = {
      products: await db.getProducts(),
      sales: await db.getSales(),
      users: await db.getUsers(),
      settings: await db.getSettings()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jeweladmin-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const updateBackupSettings = (patch: Partial<BackupSettings>) => {
    setSettings(prev => ({
      ...prev,
      backupSettings: { ...(prev.backupSettings || {}), ...patch }
    }));
  };

  const updateReceiptLayout = (patch: Partial<NonNullable<SystemSettings['receiptLayout']>>) => {
    setSettings(prev => ({
      ...prev,
      receiptLayout: { ...DEFAULT_RECEIPT_LAYOUT, ...(prev.receiptLayout || {}), ...patch }
    }));
  };

  const handleBrowseReceiptFolder = async () => {
    setReceiptPathBusy(true);
    try {
      const result = await db.pickFolderPath('Select Receipt Save Folder');
      if (result?.path) {
        updateReceiptLayout({ receiptSavePath: result.path });
      }
    } catch (err: any) {
      alert(err?.message || 'Unable to open folder picker');
    } finally {
      setReceiptPathBusy(false);
    }
  };

  const handleRunBackupNow = async () => {
    setBackupBusy(true);
    setBackupMessage(null);
    setBackupError(null);
    try {
      const result = await db.runServerBackup(settings.backupSettings?.path);
      const nowIso = new Date().toISOString();
      updateBackupSettings({
        lastBackupAt: nowIso,
        lastBackupFile: result?.files?.sql || settings.backupSettings?.lastBackupFile,
        lastUploadsZip: result?.files?.uploadsZip || settings.backupSettings?.lastUploadsZip || null
      });
      const sqlFile = result?.files?.sql;
      const zipFile = result?.files?.uploadsZip;
      if (sqlFile && zipFile) {
        setBackupMessage(`Backup saved: ${sqlFile} + ${zipFile}`);
      } else if (sqlFile) {
        setBackupMessage(`Backup saved to ${sqlFile}`);
      } else {
        setBackupMessage('Backup completed');
      }
    } catch (err: any) {
      setBackupError(err?.message || 'Backup failed');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleSaveBackupSettings = async () => {
    setBackupBusy(true);
    setBackupMessage(null);
    setBackupError(null);
    try {
      await db.saveSettings(settings);
      setBackupMessage('Backup settings saved');
      onSettingsUpdate();
    } catch (err: any) {
      setBackupError(err?.message || 'Failed to save backup settings');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleApplyBackupSchedule = async () => {
    setBackupBusy(true);
    setBackupMessage(null);
    setBackupError(null);
    try {
      const result = await db.scheduleServerBackup({
        enabled: !!settings.backupSettings?.enabled,
        time: settings.backupSettings?.time,
        path: settings.backupSettings?.path,
        provider: settings.backupSettings?.provider,
        taskName: settings.backupSettings?.taskName
      });
      if (result?.settings) {
        updateBackupSettings(result.settings);
      }
      setBackupMessage(settings.backupSettings?.enabled ? 'Backup schedule applied' : 'Backup schedule disabled');
    } catch (err: any) {
      setBackupError(err?.message || 'Failed to update schedule');
    } finally {
      setBackupBusy(false);
    }
  };

  const handlePurgeUnusedImages = async () => {
    setPurgeBusy(true);
    setPurgeMessage(null);
    setPurgeError(null);
    try {
      const result = await db.purgeUnusedUploads();
      if (!result.success) {
        setPurgeError(result.message || 'Purge failed');
      } else {
        setPurgeMessage(`Removed ${result.deleted || 0} unused files (scanned ${result.total || 0})`);
      }
    } catch (err: any) {
      setPurgeError(err?.message || 'Purge failed');
    } finally {
      setPurgeBusy(false);
    }
  };

  const handleApplyApiBase = () => {
    setApiBaseMessage(null);
    setApiBaseError(null);
    try {
      const updated = db.setApiBaseOverride(apiBaseInput);
      setApiBaseInput(updated);
      setActiveApiBase(updated);
      setApiBaseMessage('API endpoint saved. New requests now use this URL.');
    } catch (err: any) {
      setApiBaseError(err?.message || 'Failed to save API endpoint');
    }
  };

  const handleResetApiBase = () => {
    setApiBaseMessage(null);
    setApiBaseError(null);
    const fallback = db.clearApiBaseOverride();
    setApiBaseInput(fallback);
    setActiveApiBase(fallback);
    setApiBaseMessage('API endpoint reset to default.');
  };

  const previewReceiptType = settings.receiptLayout?.defaultReceiptType || 'OR';
  const previewReceiptLabel = previewReceiptType === 'AR'
    ? (settings.receiptLayout?.acknowledgementReceiptLabel || DEFAULT_RECEIPT_LAYOUT.acknowledgementReceiptLabel)
    : (settings.receiptLayout?.officialReceiptLabel || DEFAULT_RECEIPT_LAYOUT.officialReceiptLabel);
  const previewAccentColor = settings.receiptLayout?.accentColor || DEFAULT_RECEIPT_LAYOUT.accentColor;
  const previewBusinessName = settings.receiptLayout?.businessName || DEFAULT_RECEIPT_LAYOUT.businessName;
  const previewHeaderNote = settings.receiptLayout?.headerNote || DEFAULT_RECEIPT_LAYOUT.headerNote;
  const previewFooterNote = settings.receiptLayout?.footerNote || DEFAULT_RECEIPT_LAYOUT.footerNote;
  const previewThankYouNote = settings.receiptLayout?.thankYouNote || DEFAULT_RECEIPT_LAYOUT.thankYouNote;
  const previewCurrency = (settings.currencySymbol || 'PHP').trim() || 'PHP';
  const previewCurrencyPrefix = `${previewCurrency}${previewCurrency.length > 1 ? ' ' : ''}`;

  const renderTestReceiptCanvas = async () => {
    if (!testReceiptPreviewRef.current) return null;
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
      const clonedRoot = clonedDoc.querySelector('[data-admin-receipt-preview="true"]') as HTMLElement | null;
      if (!clonedRoot) return;

      const nodes = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll('*'))];
      nodes.forEach((node) => {
        if (!('style' in node)) return;
        const style = (node as HTMLElement).style;
        style.color = '#0f172a';
        style.backgroundColor = 'transparent';
        style.borderColor = '#d1d5db';
        style.outlineColor = '#d1d5db';
        style.boxShadow = 'none';
        style.textShadow = 'none';
        style.filter = 'none';
      });

      clonedRoot.style.backgroundColor = '#ffffff';
      clonedRoot.style.borderColor = '#d1d5db';

      clonedDoc.querySelectorAll<HTMLElement>('[data-admin-receipt-accent="true"]').forEach((el) => {
        el.style.color = previewAccentColor;
        el.style.borderColor = previewAccentColor;
      });
    };

    const options = {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      onclone: cloneStyling
    };

    try {
      const defaultCanvas = await html2canvas(testReceiptPreviewRef.current, options);
      if (hasVisibleContent(defaultCanvas)) {
        return defaultCanvas;
      }
    } catch {
      // Retry with alternate renderer below.
    }
    try {
      const foreignObjectCanvas = await html2canvas(testReceiptPreviewRef.current, {
        ...options,
        foreignObjectRendering: true
      });
      if (hasVisibleContent(foreignObjectCanvas)) {
        return foreignObjectCanvas;
      }
      return null;
    } catch {
      return null;
    }
  };

  const printImageInIframe = (title: string, imageData: string) => {
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
              <img id="receipt-image" alt="Test Receipt" src="${imageData}" />
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
  };

  const printTestReceiptHtml = (testReceiptType: 'OR' | 'AR') => {
    return new Promise<boolean>((resolve) => {
      const printWindow = window.open('', '', 'left=0,top=0,width=500,height=900,toolbar=0,scrollbars=1,status=0');
      if (!printWindow) {
        resolve(false);
        return;
      }

      const receiptLabel = testReceiptType === 'AR'
        ? (settings.receiptLayout?.acknowledgementReceiptLabel || DEFAULT_RECEIPT_LAYOUT.acknowledgementReceiptLabel)
        : (settings.receiptLayout?.officialReceiptLabel || DEFAULT_RECEIPT_LAYOUT.officialReceiptLabel);

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>Test Print - ${testReceiptType}# TEST-0001</title>
            <style>
              @page { margin: 12mm; }
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
              .receipt-label { margin-top: 6px; font-weight: bold; text-transform: uppercase; color: ${previewAccentColor}; }
              .footer { margin-top: 30px; font-size: 10px; text-align: center; opacity: 0.85; }
              .details { margin-bottom: 15px; }
              .details div { display: flex; justify-content: space-between; text-transform: uppercase; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${previewBusinessName}</h1>
              <p>${settings.branchName.toUpperCase()} BRANCH</p>
              <p class="receipt-label">${receiptLabel}</p>
              <p>${previewHeaderNote}</p>
            </div>
            <div class="dashed"></div>
            <div class="details">
              <div><span>Date:</span> <span>${new Date().toLocaleString()}</span></div>
              <div><span>Staff:</span> <span>TEST USER</span></div>
              <div><span style="font-weight:bold">${testReceiptType} Number:</span> <span style="font-weight:bold">#TEST-0001</span></div>
            </div>
            <div class="dashed"></div>
            <div style="font-weight:bold; margin-bottom: 10px; display: flex; justify-content: space-between;">
              <span>DESCRIPTION</span>
              <span>TOTAL</span>
            </div>
            <div class="item-row">
              <div style="display:flex; flex-direction:column">
                <span>SAMPLE ITEM</span>
                <span style="font-size:10px">1 x ${previewCurrencyPrefix}1,000.00</span>
              </div>
              <span>${previewCurrencyPrefix}1,000.00</span>
            </div>
            <div class="dashed"></div>
            <div class="total-row">
              <span>GRAND TOTAL</span>
              <span>${previewCurrencyPrefix}1,000.00</span>
            </div>
            <div class="footer">
              <p>${previewFooterNote}</p>
              <p>${previewThankYouNote}</p>
            </div>
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
  };

  const handleTestPrint = async () => {
    if (testPrintBusy) return;
    setTestPrintBusy(true);
    const testReceiptType = previewReceiptType;

    try {
      const canvas = await renderTestReceiptCanvas();
      if (!canvas) {
        alert('Unable to render receipt preview for test print.');
        return;
      }

      const imageData = canvas.toDataURL('image/png');
      let saved = false;
      try {
        const result = await db.saveReceiptImage({
          imageData,
          orNumber: 'TEST-0001',
          receiptType: testReceiptType,
          saleId: 'test-print',
          savePath: settings.receiptLayout?.receiptSavePath
        });
        saved = !!result?.success;
      } catch {
        saved = false;
      }

      if (!saved) {
        const fallbackLink = document.createElement('a');
        fallbackLink.download = `${testReceiptType}_TEST-0001.png`;
        fallbackLink.href = imageData;
        fallbackLink.click();
        alert('Test receipt image was downloaded because folder auto-save failed.');
      }

      const printedHtml = await printTestReceiptHtml(testReceiptType);
      if (printedHtml) {
        return;
      }

      const printedImage = await printImageInIframe(
        `Test Print - ${testReceiptType}# TEST-0001`,
        imageData
      );

      if (!printedImage) {
        alert('Test print failed. Please allow print dialogs and try again.');
      }
    } finally {
      setTestPrintBusy(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      <div className="w-full lg:w-64 shrink-0 space-y-1">
        {tabs.map(tab => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`flex items-center w-full px-4 py-3 space-x-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest ${
              activeTab === tab.name 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
              : 'text-slate-400 hover:bg-white hover:text-slate-900'
            }`}
          >
            {tab.icon} <span>{tab.name}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-600px">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{activeTab} Configuration</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Adjust branch behavioral parameters</p>
          </div>
          {activeTab !== 'Staff' && activeTab !== 'Maintenance' && activeTab !== 'Profile' && (
            <button 
              onClick={handleSave}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isSaved ? <CheckCircle size={14} /> : <Save size={14} />}
              <span>{isSaved ? 'Saved' : 'Apply Changes'}</span>
            </button>
          )}
        </div>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          {activeTab === 'Profile' && (() => {
            const currentUser = users.find(u => u.username === db.getCurrentUser()?.username);
            const editing = profileEdit || (currentUser ? { firstName: currentUser.firstName || '', lastName: currentUser.lastName || '', profilePicture: currentUser.profilePicture } : null);
            return (
              <div className="space-y-6 max-w-md">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">Your Profile</h4>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative group">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl overflow-hidden">
                        {editing?.profilePicture ? (
                          <img src={editing.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          editing?.firstName?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase()
                        )}
                      </div>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleProfilePictureUpload(e, true)} />
                        <span className="text-[8px] font-bold text-white uppercase tracking-widest">Upload</span>
                      </label>
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 uppercase">
                        {currentUser?.firstName || currentUser?.lastName 
                          ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
                          : db.getFullName(currentUser)}
                      </p>
                      <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest">{currentUser?.role}</p>
                    </div>
                  </div>
                  {!profileEdit && currentUser?.firstName && (
                    <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest mb-4">✓ Full name saved</p>
                  )}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">First Name</label>
                      <input 
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                        value={editing?.firstName || ''}
                        onChange={e => setProfileEdit(editing ? { ...editing, firstName: e.target.value } : null)}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Name</label>
                      <input 
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                        value={editing?.lastName || ''}
                        onChange={e => setProfileEdit(editing ? { ...editing, lastName: e.target.value } : null)}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={async () => {
                        if (currentUser) {
                          await db.updateUserProfile(currentUser.username, editing!.firstName, editing!.lastName, editing!.profilePicture);
                          const sessionUser = db.getCurrentUser();
                          if (sessionUser && sessionUser.username === currentUser.username) {
                            db.updateSessionUser({
                              firstName: editing!.firstName,
                              lastName: editing!.lastName,
                              profilePicture: editing!.profilePicture
                            });
                          }
                          const updatedUsers = await db.getUsers();
                          setUsers(updatedUsers);
                          setProfileEdit(null);
                          onSettingsUpdate();
                          if (onProfileUpdate) onProfileUpdate();
                        }
                      }}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                    >
                      Save Profile
                    </button>
                    {profileEdit && (
                      <button 
                        onClick={() => setProfileEdit(null)}
                        className="px-4 py-3 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'Staff' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.map(u => (
                  <div key={u.username || `user-${Math.random()}`} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        {u.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username || 'Unknown'}
                        </p>
                        <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest">@{u.username || 'unknown'}</p>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${u.status === 'disabled' ? 'text-rose-500' : 'text-slate-400'} mt-1`}>
                          {u.role} • {u.status || 'active'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 transition-opacity">
                      <button 
                        onClick={() => {
                          if (u.role === 'admin') {
                            setEditingUser({ username: u.username, firstName: u.firstName || '', lastName: u.lastName || '' });
                          } else {
                            setStaffEditModal({
                              username: u.username || '',
                              firstName: u.firstName || '',
                              lastName: u.lastName || '',
                              profilePicture: u.profilePicture,
                              currentPassword: '',
                              newPassword: '',
                              confirmPassword: '',
                              pin: ''
                            });
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600" 
                        title={u.role === 'admin' ? 'Edit Name' : 'Edit Staff Info'}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleGenerateQR(u.username)}
                        className="p-2 text-slate-400 hover:text-indigo-600" 
                        title="Generate QR Login"
                      >
                        <QrCode size={16} />
                      </button>
                      {u.username !== 'admin' && (
                        <>
                          <button 
                            onClick={() => handleToggleUser(u.username, u.status)}
                            className={`p-2 transition-colors ${u.status === 'disabled' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-rose-500 hover:bg-rose-50'}`}
                            title={u.status === 'disabled' ? 'Enable' : 'Disable'}
                          >
                            {u.status === 'disabled' ? <CheckCircle size={16} /> : <Ban size={16} />}
                          </button>
                          <button 
                            onClick={() => {
                              setDeleteUserConfirm(u);
                              setDeletePinModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Staff"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Branch' && (
            <div className="max-w-md space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Branch Management</h4>
                  <button 
                    onClick={() => {
                      const newBranch = { id: Date.now().toString(), name: '', address: '', isPrimary: false };
                      setSettings({...settings, branches: [...(settings.branches || []), newBranch]});
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                    <Plus size={14} /> Add Branch
                  </button>
                </div>
                <div className="space-y-3">
                  {(settings.branches || []).map((branch, index) => (
                    <div key={branch.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Branch #{index + 1}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              const updatedBranches = settings.branches!.map(b => ({ ...b, isPrimary: b.id === branch.id }));
                              setSettings({...settings, branches: updatedBranches});
                            }}
                            className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                              branch.isPrimary ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {branch.isPrimary ? 'Primary' : 'Set Primary'}
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm('Are you sure you want to remove this branch?')) {
                                const updatedBranches = settings.branches?.filter(b => b.id !== branch.id) || [];
                                setSettings({...settings, branches: updatedBranches});
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Delete Branch"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Store Name</label>
                          <input 
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-600"
                            value={branch.name}
                            onChange={e => {
                              const updatedBranches = [...settings.branches!];
                              updatedBranches[index] = {...branch, name: e.target.value};
                              setSettings({...settings, branches: updatedBranches});
                            }}
                            placeholder="Enter store name"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Branch Location</label>
                          <input 
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-600"
                            value={branch.address}
                            onChange={e => {
                              const updatedBranches = [...(settings.branches || [])];
                              updatedBranches[index] = {...branch, address: e.target.value};
                              setSettings({...settings, branches: updatedBranches});
                            }}
                            placeholder="Enter branch location"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Primary Branch Location</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                  value={(settings.branches || []).find(b => b.isPrimary)?.id || ''}
                  onChange={(e) => {
                    const updatedBranches = (settings.branches || []).map(b => ({ ...b, isPrimary: b.id === e.target.value }));
                    setSettings({...settings, branches: updatedBranches});
                  }}
                >
                  <option value="">Select Primary Branch</option>
                  {(settings.branches || []).map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name || `Branch ${branch.id}`} - {branch.address || 'No address'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Master Admin PIN (Required for Branch Changes)</label>
                <input 
                  type="password"
                  maxLength={6}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 tracking-[0.5em]"
                  value={branchPin}
                  onChange={e => setBranchPin(e.target.value)}
                  placeholder="Enter master PIN"
                />
              </div>
            </div>
          )}

          {activeTab === 'System' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Currency Indicator</label>
                  <input 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                    value={settings.currencySymbol}
                    onChange={e => setSettings({...settings, currencySymbol: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sales Tax / VAT (%)</label>
                  <input 
                    type="number"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                    value={settings.taxRate}
                    onChange={e => setSettings({...settings, taxRate: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Low Stock Alert Threshold</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="1" max="20"
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      value={settings.lowStockThreshold}
                      onChange={e => setSettings({...settings, lowStockThreshold: parseInt(e.target.value)})}
                    />
                    <span className="w-8 text-center font-black text-indigo-600">{settings.lowStockThreshold}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Time Format</label>
                  <div className="flex gap-2">
                    {['12h', '24h'].map(t => (
                      <button 
                        key={t}
                        onClick={() => setSettings({...settings, timeFormat: t as any})}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${settings.timeFormat === t ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'border-slate-200 text-slate-400 hover:border-indigo-400'}`}
                      >
                        {t} format
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'POS' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-6xl">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Auto-Print Receipts</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Trigger print on sale confirm</p>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, receiptAutoPrint: !settings.receiptAutoPrint})}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings.receiptAutoPrint ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.receiptAutoPrint ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Local Receipt Save Folder</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.receiptLayout?.receiptSavePath || ''}
                      onChange={e => updateReceiptLayout({ receiptSavePath: e.target.value })}
                      placeholder="receipts"
                    />
                    <button
                      onClick={handleBrowseReceiptFolder}
                      disabled={receiptPathBusy}
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {receiptPathBusy ? 'Opening...' : 'Browse'}
                    </button>
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    Used for auto-saving PNG copy after print. Example: receipts or C:\JewelAdmin\Receipts
                  </p>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Receipt Layout Builder</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Edit fields and see a live receipt preview</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Business Name</label>
                    <input
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.receiptLayout?.businessName || ''}
                      onChange={e => updateReceiptLayout({ businessName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Header Note</label>
                    <input
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.receiptLayout?.headerNote || ''}
                      onChange={e => updateReceiptLayout({ headerNote: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OR Label</label>
                      <input
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                        value={settings.receiptLayout?.officialReceiptLabel || ''}
                        onChange={e => updateReceiptLayout({ officialReceiptLabel: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AR Label</label>
                      <input
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                        value={settings.receiptLayout?.acknowledgementReceiptLabel || ''}
                        onChange={e => updateReceiptLayout({ acknowledgementReceiptLabel: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Footer Note</label>
                    <textarea
                      className="w-full p-3 min-h-20 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.receiptLayout?.footerNote || ''}
                      onChange={e => updateReceiptLayout({ footerNote: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Thank You Note</label>
                    <input
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.receiptLayout?.thankYouNote || ''}
                      onChange={e => updateReceiptLayout({ thankYouNote: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Accent Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="w-12 h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                          value={settings.receiptLayout?.accentColor || DEFAULT_RECEIPT_LAYOUT.accentColor}
                          onChange={e => updateReceiptLayout({ accentColor: e.target.value })}
                        />
                        <input
                          className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-indigo-600"
                          value={settings.receiptLayout?.accentColor || DEFAULT_RECEIPT_LAYOUT.accentColor}
                          onChange={e => updateReceiptLayout({ accentColor: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Default Receipt Type</label>
                      <select
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:border-indigo-600"
                        value={settings.receiptLayout?.defaultReceiptType || 'OR'}
                        onChange={e => updateReceiptLayout({ defaultReceiptType: (e.target.value === 'AR' ? 'AR' : 'OR') as 'OR' | 'AR' })}
                      >
                        <option value="OR">Official Receipt (OR)</option>
                        <option value="AR">Acknowledgement Receipt (AR)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Preview</p>
                  <button
                    onClick={handleTestPrint}
                    disabled={testPrintBusy}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Printer size={12} />
                    {testPrintBusy ? 'Printing...' : 'Test Print'}
                  </button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <div
                    ref={testReceiptPreviewRef}
                    data-admin-receipt-preview="true"
                    className="bg-white p-6 shadow-sm border mx-auto w-full max-w-[380px] font-mono text-slate-900 rounded-xl"
                  >
                    <div className="text-center mb-5">
                      <p className="text-[20px] font-black uppercase leading-tight">{previewBusinessName}</p>
                      <p className="text-[11px] uppercase">{settings.branchName} BRANCH</p>
                      <p data-admin-receipt-accent="true" className="text-[11px] font-black uppercase mt-1" style={{ color: previewAccentColor }}>{previewReceiptLabel}</p>
                      <p className="text-[10px] uppercase mt-1">{previewHeaderNote}</p>
                    </div>
                    <div className="border-t-2 border-dashed border-black my-3"></div>
                    <div className="space-y-1 text-[11px] mb-4 uppercase">
                      <div className="flex justify-between"><span>Date:</span><span>02/03/2026 10:45 AM</span></div>
                      <div className="flex justify-between"><span>Staff:</span><span>Sample Staff</span></div>
                      <div className="flex justify-between"><span className="font-black">{previewReceiptType} Number:</span><span className="font-black">#TEST-0001</span></div>
                    </div>
                    <div className="border-t-2 border-dashed border-black my-3"></div>
                    <div className="mb-4">
                      <div className="flex justify-between font-black text-[11px] uppercase mb-2">
                        <span>Description</span>
                        <span>Total</span>
                      </div>
                      <div className="space-y-2 text-[11px]">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="uppercase truncate">Gold Ring</span>
                            <span className="text-[10px]">1 x {previewCurrencyPrefix}3,500</span>
                          </div>
                          <span className="whitespace-nowrap">{previewCurrencyPrefix}3,500</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="uppercase truncate">Silver Chain</span>
                            <span className="text-[10px]">1 x {previewCurrencyPrefix}1,200</span>
                          </div>
                          <span className="whitespace-nowrap">{previewCurrencyPrefix}1,200</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t-2 border-dashed border-black my-3"></div>
                    <div className="space-y-1 text-[11px] uppercase">
                      <div className="flex justify-between font-black text-[15px] mt-2">
                        <span>Grand Total</span>
                        <span>{previewCurrencyPrefix}4,700</span>
                      </div>
                      <div className="flex justify-between font-black">
                        <span>Amount Received</span>
                        <span>{previewCurrencyPrefix}5,000</span>
                      </div>
                      <div className="flex justify-between font-black">
                        <span>Change</span>
                        <span>{previewCurrencyPrefix}300</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-3 border-t-2 border-dashed border-black text-center uppercase text-[10px] space-y-1">
                      <p>{previewFooterNote}</p>
                      <p>System ID: TEST-PRINT</p>
                      <p>{previewThankYouNote}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">API Endpoint</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Paste your current ngrok URL. /api is auto-appended if missing.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Backend URL</label>
                  <input
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                    value={apiBaseInput}
                    onChange={e => setApiBaseInput(e.target.value)}
                    placeholder="https://your-ngrok-url.ngrok-free.app"
                  />
                </div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                  Active endpoint: <span className="text-slate-700">{activeApiBase}</span>
                </p>
                {apiBaseMessage && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">{apiBaseMessage}</p>
                )}
                {apiBaseError && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-rose-600">{apiBaseError}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleApplyApiBase}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                    Save Endpoint
                  </button>
                  <button
                    onClick={handleResetApiBase}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-slate-400 transition-all"
                  >
                    Reset Default
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Products' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Max Images per Item</label>
                <input 
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                  value={settings.maxImagesPerProduct}
                  onChange={e => setSettings({...settings, maxImagesPerProduct: parseInt(e.target.value)})}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Staff Price Overrides</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Allow staff to edit sale price</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, staffCanEditPrice: !settings.staffCanEditPrice})}
                  className={`w-10 h-5 rounded-full transition-all relative ${settings.staffCanEditPrice ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.staffCanEditPrice ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Alerts' && (
            <div className="space-y-8 max-w-2xl">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">Notification Settings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Low Stock Alerts</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Notify when items reach threshold</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, lowStockAlerts: !settings.lowStockAlerts})}
                      className={`w-12 h-6 rounded-full transition-all relative ${settings.lowStockAlerts ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.lowStockAlerts ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Sales Summary Alerts</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Daily sales report notifications</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, salesSummaryAlerts: !settings.salesSummaryAlerts})}
                      className={`w-12 h-6 rounded-full transition-all relative ${settings.salesSummaryAlerts ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.salesSummaryAlerts ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Security Alerts</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Login attempts and system events</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, securityAlerts: !settings.securityAlerts})}
                      className={`w-12 h-6 rounded-full transition-all relative ${settings.securityAlerts ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.securityAlerts ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Inventory Sync Alerts</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Multi-branch sync notifications</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, inventorySyncAlerts: !settings.inventorySyncAlerts})}
                      className={`w-12 h-6 rounded-full transition-all relative ${settings.inventorySyncAlerts ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.inventorySyncAlerts ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">Alert Channels</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Desktop Notifications</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Browser pop-up alerts</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, desktopNotifications: !settings.desktopNotifications})}
                      className={`w-12 h-6 rounded-full transition-all relative ${settings.desktopNotifications ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.desktopNotifications ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Email Notifications</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Email alerts to admin</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
                      className={`w-12 h-6 rounded-full transition-all relative ${settings.emailNotifications ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.emailNotifications ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Address for Alerts</label>
                    <input 
                      type="email"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.alertEmailAddress || ''}
                      onChange={e => setSettings({...settings, alertEmailAddress: e.target.value})}
                      placeholder="admin@jewelstore.com"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">Alert Schedule</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Summary Time</label>
                    <input 
                      type="time"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.dailySummaryTime || '18:00'}
                      onChange={e => setSettings({...settings, dailySummaryTime: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Low Stock Check Frequency</label>
                    <select 
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.lowStockCheckFrequency || 'hourly'}
                      onChange={e => setSettings({...settings, lowStockCheckFrequency: e.target.value as any})}
                    >
                      <option value="hourly">Every Hour</option>
                      <option value="daily">Every Day</option>
                      <option value="weekly">Every Week</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="max-w-md space-y-8">
              <div className="space-y-4">
                {settings.hasAdminPin && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Master Admin PIN</label>
                    <input 
                      type="password"
                      maxLength={6}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 tracking-[0.5em]"
                      value={currentAdminPin}
                      onChange={e => setCurrentAdminPin(e.target.value)}
                      placeholder="Enter current PIN"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">New Master Admin PIN</label>
                  <input 
                    type="password"
                    maxLength={6}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 tracking-[0.5em]"
                    value={newAdminPin}
                    onChange={e => setNewAdminPin(e.target.value)}
                    placeholder="Enter new PIN"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Confirm New PIN</label>
                  <input 
                    type="password"
                    maxLength={6}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 tracking-[0.5em]"
                    value={confirmAdminPin}
                    onChange={e => setConfirmAdminPin(e.target.value)}
                    placeholder="Re-enter new PIN"
                  />
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Leave new PIN blank to keep current
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Idle Session Timeout (Minutes)</label>
                <input 
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                  value={settings.sessionTimeoutMinutes}
                  onChange={e => setSettings({...settings, sessionTimeoutMinutes: parseInt(e.target.value)})}
                />
              </div>
            </div>
          )}

          {activeTab === 'Maintenance' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                  onClick={handleExport}
                  className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-4 hover:bg-indigo-100 transition-all text-left"
                >
                  <div className="p-4 bg-white rounded-2xl text-indigo-600 shadow-sm"><HardDriveDownload size={24} /></div>
                  <div>
                    <p className="text-xs font-black text-indigo-900 uppercase tracking-tight">Export Database</p>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Snapshot products, sales & logs</p>
                  </div>
                </button>
                <button className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4 hover:bg-slate-100 transition-all text-left">
                  <div className="p-4 bg-white rounded-2xl text-slate-600 shadow-sm"><HardDriveUpload size={24} /></div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Restore Backup</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Merge or overwrite current state</p>
                  </div>
                </button>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Automated Backups</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Schedule nightly pg_dump backups to a local or synced folder
                    </p>
                  </div>
                  <button
                    onClick={handleRunBackupNow}
                    disabled={backupBusy}
                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      backupBusy ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    Run Backup Now
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Backup Folder</label>
                    <input
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.backupSettings?.path || ''}
                      onChange={e => updateBackupSettings({ path: e.target.value })}
                      placeholder="backups or a OneDrive/Google Drive folder"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Storage Provider</label>
                    <select
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={settings.backupSettings?.provider || 'local'}
                      onChange={e => updateBackupSettings({ provider: e.target.value as any })}
                    >
                      <option value="local">Local Folder</option>
                      <option value="onedrive">OneDrive (Synced Folder)</option>
                      <option value="googledrive">Google Drive (Synced Folder)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Schedule</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                        <input
                          type="checkbox"
                          checked={!!settings.backupSettings?.enabled}
                          onChange={e => updateBackupSettings({ enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                      <input
                        type="time"
                        className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-600"
                        value={settings.backupSettings?.time || '02:00'}
                        onChange={e => updateBackupSettings({ time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Task Name</label>
                    <input
                      className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500"
                      value={settings.backupSettings?.taskName || 'JewelAdmin Backup'}
                      onChange={e => updateBackupSettings({ taskName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                  <button
                    onClick={handleSaveBackupSettings}
                    disabled={backupBusy}
                    className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    Save Backup Settings
                  </button>
                  <button
                    onClick={handleApplyBackupSchedule}
                    disabled={backupBusy}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                    Apply Schedule
                  </button>
                </div>

                {backupMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                    {backupMessage}
                  </div>
                )}
                {backupError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-bold text-rose-700 uppercase tracking-widest">
                    {backupError}
                  </div>
                )}

                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Last Backup:{' '}
                  <span className="text-slate-700 font-black">
                    {settings.backupSettings?.lastBackupAt
                      ? new Date(settings.backupSettings.lastBackupAt).toLocaleString()
                      : 'Not yet run'}
                  </span>
                </div>
                {settings.backupSettings?.lastBackupFile && (
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    File: <span className="text-slate-700 font-black">{settings.backupSettings.lastBackupFile}</span>
                  </div>
                )}
                {settings.backupSettings?.lastUploadsZip && (
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Uploads Zip: <span className="text-slate-700 font-black">{settings.backupSettings.lastUploadsZip}</span>
                  </div>
                )}
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  Tip: Use your OneDrive or Google Drive sync folder to auto‑upload backups to the cloud.
                </p>
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Upload Cleanup</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Remove image files that are no longer linked to any product
                    </p>
                  </div>
                  <button
                    onClick={handlePurgeUnusedImages}
                    disabled={purgeBusy}
                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      purgeBusy ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-700'
                    }`}
                  >
                    Purge Unused Images
                  </button>
                </div>
                {purgeMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                    {purgeMessage}
                  </div>
                )}
                {purgeError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-bold text-rose-700 uppercase tracking-widest">
                    {purgeError}
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-slate-100">
                <button className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all">
                  <RefreshCcw size={16} /> Factory Reset Application
                </button>
                <p className="text-[8px] font-black text-rose-300 uppercase tracking-widest mt-4 ml-1">Warning: This action is irreversible</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Edit Staff Profile</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{editingUser.username}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">First Name</label>
                <input 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                  value={editingUser.firstName}
                  onChange={e => setEditingUser({...editingUser, firstName: e.target.value})}
                  placeholder="Enter first name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Name</label>
                <input 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                  value={editingUser.lastName}
                  onChange={e => setEditingUser({...editingUser, lastName: e.target.value})}
                  placeholder="Enter last name"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={async () => {
                  await db.updateUserProfile(editingUser.username, editingUser.firstName, editingUser.lastName);
                  const updatedUsers = await db.getUsers();
                  setUsers(updatedUsers);
                  setEditingUser(null);
                  onSettingsUpdate();
                }}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {staffEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Edit Staff Information</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{staffEditModal.username}</p>
              </div>
              <button onClick={() => setStaffEditModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl overflow-hidden">
                    {staffEditModal.profilePicture ? (
                      <img src={staffEditModal.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      staffEditModal.username[0].toUpperCase()
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setStaffEditModal({...staffEditModal, profilePicture: reader.result as string});
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                    <span className="text-[8px] font-bold text-white uppercase tracking-widest">Upload</span>
                  </label>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900 uppercase">
                    {staffEditModal.firstName || staffEditModal.lastName 
                      ? `${staffEditModal.firstName || ''} ${staffEditModal.lastName || ''}`.trim() 
                      : staffEditModal.username}
                  </p>
                  <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest">Staff Member</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">First Name</label>
                  <input 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                    value={staffEditModal.firstName}
                    onChange={e => setStaffEditModal({...staffEditModal, firstName: e.target.value})}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Name</label>
                  <input 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                    value={staffEditModal.lastName}
                    onChange={e => setStaffEditModal({...staffEditModal, lastName: e.target.value})}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Password</label>
                  <input 
                    type="password"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                    value={staffEditModal.currentPassword}
                    onChange={e => setStaffEditModal({...staffEditModal, currentPassword: e.target.value})}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">New Password</label>
                    <input 
                      type="password"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={staffEditModal.newPassword}
                      onChange={e => setStaffEditModal({...staffEditModal, newPassword: e.target.value})}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Confirm New Password</label>
                    <input 
                      type="password"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600"
                      value={staffEditModal.confirmPassword}
                      onChange={e => setStaffEditModal({...staffEditModal, confirmPassword: e.target.value})}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Master Admin PIN</label>
                <input 
                  type="password"
                  maxLength={6}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 tracking-[0.5em]"
                  value={staffEditModal.pin}
                  onChange={e => setStaffEditModal({...staffEditModal, pin: e.target.value})}
                  placeholder="Enter master PIN"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={async () => {
                  const pinOk = await requireAdminPin(staffEditModal.pin);
                  if (!pinOk) {
                    return;
                  }
                  if (staffEditModal.newPassword && staffEditModal.newPassword !== staffEditModal.confirmPassword) {
                    alert('New passwords do not match');
                    return;
                  }
                  await db.updateUserProfile(staffEditModal.username, staffEditModal.firstName, staffEditModal.lastName, staffEditModal.profilePicture);
                  if (staffEditModal.newPassword) {
                    const passwordResult = await db.changePassword(staffEditModal.username, staffEditModal.currentPassword, staffEditModal.newPassword);
                    if (!passwordResult.success) {
                      alert(passwordResult.message);
                      return;
                    }
                  }
                  const updatedUsers = await db.getUsers();
                  setUsers(updatedUsers);
                  setStaffEditModal(null);
                  onSettingsUpdate();
                }}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                Save Staff Information
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={async () => {
                const pinOk = await requireAdminPin(pinInput);
                if (pinOk) {
                  setShowPinPrompt(false);
                  setPinInput('');
                } else {
                  setPinInput('');
                }
              }} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[9px] font-black uppercase">Verify</button>
            </div>
          </div>
        </div>
      )}

      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Staff QR Badge</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{qrModal.username}</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setQrModal(null); }} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Close QR Badge"
              >
                <X size={20} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center">
              <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-lg mb-4">
                {qrModal.qrDataUrl ? (
                  <img src={qrModal.qrDataUrl} alt="QR Code" className="w-48 h-48" />
                ) : (
                  <QrCode size={180} className="text-slate-800" />
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-2">
                Scan this QR code at login
              </p>
              <p className="text-[8px] font-mono text-slate-300 break-all text-center max-w-full px-4 border border-slate-200 rounded p-2 bg-slate-50">
                {qrModal.token}
              </p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => window.print()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                Print Badge
              </button>
            </div>
          </div>
        </div>
      )}

      {branchPinModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Master Admin PIN Required</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Enter PIN to save Branch changes</p>
              </div>
              <button onClick={() => setBranchPinModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Master Admin PIN</label>
                <input 
                  type="password"
                  maxLength={6}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 tracking-[0.5em] text-center"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  placeholder="••••"
                  autoFocus
                />
              </div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">
                PIN is masked for security
              </p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex gap-3">
                <button 
                  onClick={async () => {
                    if (!settings.hasAdminPin) {
                      setBranchPinModal(false);
                      await db.saveSettings(settings);
                      setIsSaved(true);
                      setTimeout(() => setIsSaved(false), 2000);
                      onSettingsUpdate();
                      setPinInput('');
                      setBranchPin('');
                      return;
                    }

                    const pinOk = await requireAdminPin(pinInput);
                    if (pinOk) {
                      setBranchPinModal(false);
                      await db.saveSettings(settings);
                      setSettings(prev => ({ ...prev, adminPin: '' }));
                      setIsSaved(true);
                      setTimeout(() => setIsSaved(false), 2000);
                      onSettingsUpdate();
                      setPinInput('');
                      setBranchPin('');
                    } else {
                      setPinInput('');
                    }
                  }}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                >
                  Verify & Save
                </button>
                <button 
                  onClick={() => { setBranchPinModal(false); setPinInput(''); }}
                  className="flex-1 py-3 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {deletePinModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-rose-600 uppercase tracking-tight">Confirm Delete Staff</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {deleteUserConfirm?.firstName || deleteUserConfirm?.lastName 
                    ? `${deleteUserConfirm.firstName || ''} ${deleteUserConfirm.lastName || ''}`.trim()
                    : deleteUserConfirm?.username}
                </p>
              </div>
              <button onClick={() => { setDeletePinModal(false); setDeleteUserConfirm(null); setPinInput(''); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                <p className="text-xs font-bold text-rose-600 text-center">
                  Are you sure you want to delete this staff member? This action will preserve all sales history.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Master Admin PIN</label>
                <input 
                  type="password"
                  maxLength={6}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-600 tracking-[0.5em] text-center"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  placeholder="••••"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex gap-3">
                <button 
                  onClick={async () => {
                    const pinOk = await requireAdminPin(pinInput);
                    if (pinOk) {
                      if (deleteUserConfirm?.username) {
                        await db.deleteUser(deleteUserConfirm.username);
                        const updatedUsers = await db.getUsers();
                        setUsers(updatedUsers);
                      }
                      setDeletePinModal(false);
                      setDeleteUserConfirm(null);
                      setPinInput('');
                    } else {
                      setPinInput('');
                    }
                  }}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                >
                  Delete Staff
                </button>
                <button 
                  onClick={() => { setDeletePinModal(false); setDeleteUserConfirm(null); setPinInput(''); }}
                  className="flex-1 py-3 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
