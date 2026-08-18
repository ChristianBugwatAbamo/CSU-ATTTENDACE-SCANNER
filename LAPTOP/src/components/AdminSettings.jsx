import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Shield,
  Clock,
  Users,
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Save,
  Server,
  FileSpreadsheet,
  Building,
  Landmark,
  Trash2,
  FileText,
  Lock,
  Layers,
  Printer,
  Award,
  Image as ImageIcon,
  KeyRound,
  Check,
  Eye,
  Sliders
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const DEFAULT_SETTINGS = {
  // Tab 1: Attendance Rules
  morningCutoffTime: "07:30",
  afternoonCutoffTime: "16:00",
  formationTardyGrace: 15,
  lateThresholdGrace: 30,
  cadetQuotaPerPlatoon: 37,
  requireTimeInAndOut: true,

  // Tab 2: Unit Branding
  unitName: "1501st CDC ROTC Unit",
  commandingOfficer: "LTC RYAN L MARCELO INF (GSC) PA",
  commandingOfficerTitle: "Commandant, CSU ROTC Unit",
  parentCommand: "15th RCDG, ARESCOM, Philippine Army",
  hostInstitution: "Caraga State University (CSU Main Campus, Ampayon, Butuan City)",
  rotcSealUrl: "/rotc-seal-transparent.png",
  universityLogoUrl: "/csu-logo.png",

  // Tab 3: Data & Storage
  exportDirectory: "./desktop_excel_reports/",
  autoExcelExport: true,
  autoBackupEnabled: true,

  // Tab 4: ID Printing Setup
  signatoryName: "LTC RYAN L MARCELO INF (GSC) PA",
  signatoryDesignation: "Commandant, CSU ROTC Unit",
  signatureImageUrl: "",
  cardOrientation: "vertical", // 'vertical' | 'horizontal'
  cardDimensions: "CR80", // 'CR80' (85.6mm x 53.98mm)
  printDpi: 300,
  enableSecurityBorder: true,
  qrCodePosition: "top-right"
};

export default function AdminSettings({ cadets = [], attendanceLogs = [], onRefresh, serverOnline }) {
  // Active top tab: 'attendance' | 'branding' | 'storage' | 'idprinting'
  const [activeTab, setActiveTab] = useState('attendance');

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(null);

  // Modals & Security Verification
  const [isResetRosterModalOpen, setIsResetRosterModalOpen] = useState(false);
  const [isSecurePurgeModalOpen, setIsSecurePurgeModalOpen] = useState(false);
  const [purgePasswordInput, setPurgePasswordInput] = useState('');
  const [purgeErrorMsg, setPurgeErrorMsg] = useState('');

  // File Inputs Refs
  const rotcSealInputRef = useRef(null);
  const univLogoInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const backupFileInputRef = useRef(null);

  // Load Settings on Mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ ...prev, ...data }));
        } else {
          const local = localStorage.getItem('csu_rotc_admin_settings');
          if (local) {
            setSettings(prev => ({ ...prev, ...JSON.parse(local) }));
          }
        }
      } catch (err) {
        const local = localStorage.getItem('csu_rotc_admin_settings');
        if (local) {
          setSettings(prev => ({ ...prev, ...JSON.parse(local) }));
        }
      }
    };
    loadSettings();
  }, []);

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // Save Settings Handler
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    try {
      localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(settings));

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setSaveSuccessToast('System parameters saved and applied successfully!');
      } else {
        setSaveSuccessToast('Settings saved locally to browser storage.');
      }
    } catch (err) {
      setSaveSuccessToast('Settings saved locally (Server node offline).');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Image Upload Helper (converts image file to Base64 data URL for persistence)
  const handleImageUpload = (e, fieldKey) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (.png, .jpg, .jpeg, .webp).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      handleChange(fieldKey, loadEvt.target.result);
      setSaveSuccessToast(`Image uploaded for ${fieldKey}! Click "Save All Settings" to apply.`);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    };
    reader.readAsDataURL(file);
  };

  // Export Full Database Backup (.json)
  const handleExportBackup = async () => {
    try {
      const backupPayload = {
        exportTimestamp: new Date().toISOString(),
        systemVersion: "1.0.0",
        unitProfile: {
          unitName: settings.unitName,
          commandingOfficer: settings.commandingOfficer,
          hostInstitution: settings.hostInstitution
        },
        settings: settings,
        totalCadets: cadets.length,
        totalAttendanceLogs: attendanceLogs.length,
        cadetRoster: cadets,
        attendanceLogs: attendanceLogs
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateKey = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `CSU_ROTC_DATABASE_BACKUP_${dateKey}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setSaveSuccessToast('Complete system JSON backup downloaded successfully!');
      setTimeout(() => setSaveSuccessToast(null), 4000);
    } catch (err) {
      alert("Failed to export backup: " + err.message);
    }
  };

  // Restore from File Picker (.json)
  const handleRestoreFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.cadetRoster && !parsed.cadets && !parsed.attendanceLogs) {
          alert("Invalid backup file format. Expected CSU ROTC database payload.");
          return;
        }

        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });

        if (res.ok) {
          setSaveSuccessToast('Database successfully restored from backup file!');
          if (onRefresh) onRefresh();
        } else {
          setSaveSuccessToast('Backup parsed successfully. Refreshing view...');
          if (onRefresh) onRefresh();
        }
      } catch (err) {
        alert("Failed to parse backup JSON file: " + err.message);
      } finally {
        setTimeout(() => setSaveSuccessToast(null), 4000);
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Password Protected Log Purge Execution
  const handleExecuteSecurePurge = async () => {
    // Check against authorized security passcodes
    const normalizedInput = purgePasswordInput.trim();
    if (normalizedInput !== '1501' && normalizedInput !== 'admin' && normalizedInput !== 'csu1501') {
      setPurgeErrorMsg('Incorrect Admin PIN / Password. Verification failed.');
      return;
    }

    try {
      const res = await fetch('/api/attendance', { method: 'DELETE' });
      if (res.ok) {
        setSaveSuccessToast('Master attendance logs securely purged from database.');
      }
      if (onRefresh) onRefresh();
      setIsSecurePurgeModalOpen(false);
      setPurgePasswordInput('');
      setPurgeErrorMsg('');
    } catch (err) {
      alert("Error purging logs: " + err.message);
    } finally {
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Confirm Reset Roster to default 1,184 cadets
  const handleConfirmResetRoster = async () => {
    try {
      const res = await fetch('/api/roster/reset', { method: 'POST' });
      if (res.ok) {
        setSaveSuccessToast('Cadet roster reset to standard 1,184 echelon template.');
      } else {
        setSaveSuccessToast('Roster reset requested.');
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Error resetting roster: " + err.message);
    } finally {
      setIsResetRosterModalOpen(false);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  const tabs = [
    { id: 'attendance', label: 'Attendance Rules', icon: Clock, desc: 'Cutoff times & capacity buffers' },
    { id: 'branding', label: 'Unit Branding', icon: Award, desc: 'Command profile & official seals' },
    { id: 'storage', label: 'Data & Storage', icon: Database, desc: 'Excel paths & JSON backups' },
    { id: 'idprinting', label: 'ID Printing Setup', icon: Printer, desc: 'Signatories & CR80 specs' }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Hero Banner Header */}
      <div style={{
        background: 'linear-gradient(135deg, #064e2e 0%, #005a36 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(229, 169, 0, 0.2)',
            color: 'var(--rotc-yellow-gold)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '1px',
            marginBottom: '0.6rem',
            border: '1px solid rgba(229, 169, 0, 0.35)'
          }}>
            <Shield size={14} />
            <span>ADMIN HQ CONTROL PANEL</span>
          </div>

          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', margin: '0 0 0.4rem 0', letterSpacing: '0.5px' }}>
            System & Unit Settings
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.5 }}>
            Configure formation rules, official seals, database operations, and ID printing parameters.
          </p>
        </div>

        {/* Global Save Button in Hero */}
        <div>
          <button
            className="btn btn-gold"
            onClick={handleSaveSettings}
            disabled={isSaving}
            style={{
              padding: '0.85rem 1.75rem',
              fontSize: '0.95rem',
              fontWeight: 800,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              borderRadius: '10px'
            }}
          >
            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            <span>{isSaving ? 'SAVING...' : 'SAVE ALL SETTINGS'}</span>
          </button>
        </div>
      </div>

      {/* Floating Save Toast Banner */}
      {saveSuccessToast && (
        <div style={{
          background: '#d1fae5',
          border: '1.5px solid #10b981',
          color: '#065f46',
          padding: '0.9rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontWeight: 700,
          fontSize: '0.92rem',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={22} color="#059669" />
          <span>{saveSuccessToast}</span>
        </div>
      )}

      {/* Top 4-Tab Navigation Buttons Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.9rem 1.1rem',
                borderRadius: '12px',
                border: isActive ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
                background: isActive ? '#ffffff' : '#ffffff',
                color: isActive ? 'var(--rotc-green-dark)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 4px 12px rgba(6, 78, 46, 0.15)' : 'var(--shadow-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: isActive ? 'rgba(6, 78, 46, 0.1)' : '#f1f5f9',
                color: isActive ? 'var(--rotc-green-dark)' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={20} />
              </div>

              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: isActive ? 'var(--rotc-green-dark)' : 'var(--text-dark)' }}>
                  {tab.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {tab.desc}
                </div>
              </div>

              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '20px',
                  right: '20px',
                  height: '3px',
                  background: 'var(--rotc-green-dark)',
                  borderRadius: '3px 3px 0 0'
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: ATTENDANCE RULES
          ========================================================================= */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {/* Formation Cutoff Times Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Clock size={20} />
                <span>Formation Cutoff Schedule</span>
              </div>
              <span className="badge badge-present">TIME RULES</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Morning Formation Cutoff (Time-In Assembly)
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={settings.morningCutoffTime}
                  onChange={(e) => handleChange('morningCutoffTime', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Default morning muster deadline (e.g., 07:30 AM). Scans before this are marked Present.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Afternoon Formation Cutoff (Dismissal / Retreat)
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={settings.afternoonCutoffTime}
                  onChange={(e) => handleChange('afternoonCutoffTime', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Standard afternoon formation dismissal time (e.g., 04:00 PM / 16:00).
                </span>
              </div>
            </div>
          </div>

          {/* Tardy Grace Buffers & Capacity Limits */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Sliders size={20} />
                <span>Grace Buffers & Platoon Limits</span>
              </div>
              <span className="badge badge-present">CAPACITY & GRACE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Tardy Grace Period Buffer (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="form-control"
                  value={settings.formationTardyGrace}
                  onChange={(e) => handleChange('formationTardyGrace', parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
                
                {/* Status Transition Legend */}
                <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)', marginBottom: '4px' }}>Automatic Scan Status Transition:</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#065f46', fontWeight: 700 }}>🟢 Before 07:30 → PRESENT</span>
                    <span style={{ color: '#92400e', fontWeight: 700 }}>🟡 07:31 - 07:45 → TARDY</span>
                    <span style={{ color: '#991b1b', fontWeight: 700 }}>🔴 After 07:45 → LATE</span>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Fixed Platoon Capacity Quota Limit
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  className="form-control"
                  value={settings.cadetQuotaPerPlatoon}
                  onChange={(e) => handleChange('cadetQuotaPerPlatoon', parseInt(e.target.value) || 37)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Standard active platoon limit. Hard guard blocks scanning once this capacity is reached on mobile.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: UNIT BRANDING
          ========================================================================= */}
      {activeTab === 'branding' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {/* Unit Command Profile */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Landmark size={20} />
                <span>Unit Command Profile</span>
              </div>
              <span className="badge badge-present">COMMAND PROFILE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Unit Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.unitName}
                  onChange={(e) => handleChange('unitName', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Commanding Officer / Commandant
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.commandingOfficer}
                  onChange={(e) => handleChange('commandingOfficer', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Host Institution
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.hostInstitution}
                  onChange={(e) => handleChange('hostInstitution', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Parent Command / Division
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.parentCommand}
                  onChange={(e) => handleChange('parentCommand', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>
            </div>
          </div>

          {/* Official Logo Uploaders */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <ImageIcon size={20} />
                <span>Official Logo Uploaders</span>
              </div>
              <span className="badge badge-present">INSIGNIA & SEALS</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* ROTC Unit Seal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ffffff', border: '2px solid var(--rotc-yellow-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px' }}>
                    <img src={settings.rotcSealUrl || '/rotc-seal-transparent.png'} alt="ROTC Seal" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--rotc-green-dark)' }}>ROTC Unit Seal</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Displays on ID Cards, Reports, and Top Banners (.PNG transparent recommended)</div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => rotcSealInputRef.current?.click()}
                    style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Upload size={16} />
                    <span>Upload Seal</span>
                  </button>
                  <input
                    ref={rotcSealInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => handleImageUpload(e, 'rotcSealUrl')}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* University Logo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ffffff', border: '2px solid var(--rotc-green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px' }}>
                    <img src={settings.universityLogoUrl || '/csu-logo.png'} alt="University Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.src = '/rotc-seal-transparent.png'; }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--rotc-green-dark)' }}>University / Institution Logo</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Host university header badge (.PNG / .JPG)</div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => univLogoInputRef.current?.click()}
                    style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Upload size={16} />
                    <span>Upload Logo</span>
                  </button>
                  <input
                    ref={univLogoInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => handleImageUpload(e, 'universityLogoUrl')}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DATA & STORAGE
          ========================================================================= */}
      {activeTab === 'storage' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {/* Storage Paths & Auto-Save */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <FileSpreadsheet size={20} />
                <span>Export Paths & Auto-Save Locations</span>
              </div>
              <span className="badge badge-present">FILE DIRECTORY</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Local Excel Auto-Save Directory Path
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.exportDirectory}
                  onChange={(e) => handleChange('exportDirectory', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  All synced attendance batch logs automatically write formatted multi-echelon sheets to this folder.
                </span>
              </div>

              <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--rotc-green-dark)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Database Node Storage Path
                </div>
                <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                  ./data/ (cadets.json, attendance.json, settings.json)
                </div>
              </div>
            </div>
          </div>

          {/* Database Backup, Restore, & Secure Purge */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Database size={20} />
                <span>Database Backup & Master Maintenance</span>
              </div>
              <span className="badge badge-present">DATA OPS</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Export Backup Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                    Full JSON System Backup
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Download complete snapshot (Roster, Logs, Branding & Settings).
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExportBackup}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={16} />
                  <span>Download Backup</span>
                </button>
              </div>

              {/* Restore Backup Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                    Restore from Backup File
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Upload a previously saved `.json` database file.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => backupFileInputRef.current?.click()}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={16} />
                  <span>Upload & Restore</span>
                </button>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFile}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Reset Roster */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                    Re-initialize Master Roster
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Reset roster to standard 1,184 echelon hierarchy template.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsResetRosterModalOpen(true)}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={16} />
                  <span>Reset Roster</span>
                </button>
              </div>

              {/* Master Log Purge (Password Protected) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: '#fee2e2', borderRadius: '10px', border: '1px solid #fca5a5' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Lock size={15} /> Master Log Purge (Password Protected)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#7f1d1d' }}>
                    Erase all recorded attendance logs while preserving cadet roster data.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPurgePasswordInput('');
                    setPurgeErrorMsg('');
                    setIsSecurePurgeModalOpen(true);
                  }}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Trash2 size={16} />
                  <span>Purge Logs</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: ID PRINTING SETUP
          ========================================================================= */}
      {activeTab === 'idprinting' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {/* Authorized Signatory Details */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Award size={20} />
                <span>Authorized Signatory Profile</span>
              </div>
              <span className="badge badge-present">SIGNATORY</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Signatory Full Name (with Rank / Branch)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.signatoryName}
                  onChange={(e) => handleChange('signatoryName', e.target.value)}
                  placeholder="LTC RYAN L MARCELO INF (GSC) PA"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Signatory Designation / Official Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.signatoryDesignation}
                  onChange={(e) => handleChange('signatoryDesignation', e.target.value)}
                  placeholder="Commandant, CSU ROTC Unit"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>

              {/* Digital Signature Image Uploader */}
              <div style={{ padding: '0.9rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                    Digital Signature (.PNG Transparent)
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => signatureInputRef.current?.click()}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Upload size={14} />
                    <span>Upload Signature</span>
                  </button>
                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => handleImageUpload(e, 'signatureImageUrl')}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Signature Preview Box */}
                <div style={{
                  height: '80px',
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1.5px dashed #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {settings.signatureImageUrl ? (
                    <img src={settings.signatureImageUrl} alt="Digital Signature" style={{ maxHeight: '65px', maxWidth: '90%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      No signature image uploaded yet (Default official stamp will be used)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CR80 Dimensions & Printing Template Preferences */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Printer size={20} />
                <span>CR80 Card Template & Layout Preferences</span>
              </div>
              <span className="badge badge-present">CR80 PRINT ENGINE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                  Default ID Card Orientation
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => handleChange('cardOrientation', 'vertical')}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: settings.cardOrientation === 'vertical' ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
                      background: settings.cardOrientation === 'vertical' ? '#ecfdf5' : '#ffffff',
                      color: settings.cardOrientation === 'vertical' ? 'var(--rotc-green-dark)' : 'var(--text-dark)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {settings.cardOrientation === 'vertical' && <Check size={16} />}
                    <span>Vertical (Portrait)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChange('cardOrientation', 'horizontal')}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: settings.cardOrientation === 'horizontal' ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
                      background: settings.cardOrientation === 'horizontal' ? '#ecfdf5' : '#ffffff',
                      color: settings.cardOrientation === 'horizontal' ? 'var(--rotc-green-dark)' : 'var(--text-dark)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {settings.cardOrientation === 'horizontal' && <Check size={16} />}
                    <span>Horizontal (Landscape)</span>
                  </button>
                </div>
              </div>

              <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)' }}>Card Format Specification</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--rotc-green-dark)', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                    ISO/IEC 7810 ID-1
                  </span>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>
                  Standard CR80 (85.60 mm × 53.98 mm • 3.370" × 2.125")
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Calibrated for PVC ID Card Printers (Evolis, Zebra, Fargo) and A4 8-card sheets.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={isResetRosterModalOpen}
        title="⚠️ Reset Cadet Master Roster?"
        message="Are you sure you want to regenerate the entire 1,184-cadet echelon hierarchy roster? Any custom modifications will be restored to standard template names."
        confirmLabel="Reset Roster"
        cancelLabel="Cancel"
        onConfirm={handleConfirmResetRoster}
        onCancel={() => setIsResetRosterModalOpen(false)}
        isDestructive={true}
      />

      {/* Password Protected Modal for Master Log Purge */}
      {isSecurePurgeModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 15, 8, 0.82)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            border: '1px solid #fca5a5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <KeyRound size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#991b1b', fontFamily: 'Oswald, sans-serif' }}>
                  SECURITY VERIFICATION REQUIRED
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#7f1d1d' }}>Master Attendance Log Purge</span>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Enter the Admin Security PIN to confirm purging all recorded attendance logs. Cadet roster cards will not be affected.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.35rem' }}>
                Admin PIN / Password (Default: 1501)
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter PIN (e.g. 1501)"
                value={purgePasswordInput}
                onChange={(e) => {
                  setPurgePasswordInput(e.target.value);
                  setPurgeErrorMsg('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteSecurePurge();
                }}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: purgeErrorMsg ? '1.5px solid #dc2626' : '1px solid #d1d5db', fontSize: '1rem', letterSpacing: '2px' }}
                autoFocus
              />
              {purgeErrorMsg && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>
                  {purgeErrorMsg}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsSecurePurgeModalOpen(false);
                  setPurgePasswordInput('');
                  setPurgeErrorMsg('');
                }}
                style={{ padding: '0.7rem', fontWeight: 700 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteSecurePurge}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.7rem',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
