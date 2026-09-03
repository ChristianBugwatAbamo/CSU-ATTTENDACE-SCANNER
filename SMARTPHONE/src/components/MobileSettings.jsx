import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings,
  Wifi,
  Server,
  Shield,
  User,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Info,
  Layers,
  Building,
  Users,
  Plus,
  Edit2,
  RotateCcw,
  DownloadCloud,
  X,
  Check,
  ChevronRight
} from 'lucide-react';
import {
  getUnitStructure,
  getBattalions,
  getCompaniesForBattalion,
  getPlatoonsForCompany,
  addBattalion,
  editBattalion,
  removeBattalion,
  addCompany,
  editCompany,
  removeCompany,
  addPlatoon,
  editPlatoon,
  removePlatoon,
  resetDefaultStructure,
  syncUnitStructureFromAdmin,
  UNIT_UPDATE_EVENT
} from '../utils/unitStructure';

export default function MobileSettings({
  adminIp,
  onUpdateAdminIp,
  sessionSetup,
  onUpdateSessionSetup,
  serverConnected,
  offlineQueue = [],
  onResetQueue,
  onEditSetup
}) {
  const [ipInput, setIpInput] = useState(adminIp || 'http://192.168.1.100:8080');
  const [dutyOfficer, setDutyOfficer] = useState(sessionSetup?.dutyOfficer || '');
  const [battalion, setBattalion] = useState(sessionSetup?.battalion || '');
  const [company, setCompany] = useState(sessionSetup?.company || '');
  const [platoon, setPlatoon] = useState(sessionSetup?.platoon || '');
  const [scanMode, setScanMode] = useState(sessionSetup?.scanMode || 'Time-In');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  // Unit Hierarchy state & synchronization
  const [unitVersion, setUnitVersion] = useState(0);
  const [syncingStructure, setSyncingStructure] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

  // Manage Units Drawer & Add/Edit Dialog States
  const [isManageDrawerOpen, setIsManageDrawerOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    level: '', // 'battalion' | 'company' | 'platoon'
    mode: 'add', // 'add' | 'edit'
    targetId: '',
    name: '',
    shortCode: '',
    error: ''
  });

  // Listen to unit structure updates
  useEffect(() => {
    const handleUpdate = () => {
      setUnitVersion(v => v + 1);
    };
    window.addEventListener(UNIT_UPDATE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(UNIT_UPDATE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const rawStructure = useMemo(() => getUnitStructure(), [unitVersion]);
  const availableBattalions = useMemo(() => getBattalions(rawStructure), [rawStructure]);
  const availableCompanies = useMemo(() => getCompaniesForBattalion(battalion, rawStructure), [battalion, rawStructure]);
  const availablePlatoons = useMemo(() => getPlatoonsForCompany(battalion, company, rawStructure), [battalion, company, rawStructure]);

  // Ensure current selections are valid within the available structure
  useEffect(() => {
    if (availableBattalions.length > 0 && (!battalion || !availableBattalions.includes(battalion))) {
      const fallbackBn = availableBattalions[0];
      setBattalion(fallbackBn);
      const coys = getCompaniesForBattalion(fallbackBn, rawStructure);
      const fallbackCoy = coys[0] || '';
      setCompany(fallbackCoy);
      const plats = getPlatoonsForCompany(fallbackBn, fallbackCoy, rawStructure);
      setPlatoon(plats[0] || '');
    }
  }, [availableBattalions, battalion, rawStructure]);

  useEffect(() => {
    if (battalion && availableCompanies.length > 0 && (!company || !availableCompanies.includes(company))) {
      const fallbackCoy = availableCompanies[0];
      setCompany(fallbackCoy);
      const plats = getPlatoonsForCompany(battalion, fallbackCoy, rawStructure);
      setPlatoon(plats[0] || '');
    }
  }, [availableCompanies, company, battalion, rawStructure]);

  useEffect(() => {
    if (company && availablePlatoons.length > 0 && (!platoon || !availablePlatoons.includes(platoon))) {
      setPlatoon(availablePlatoons[0]);
    }
  }, [availablePlatoons, platoon, company]);

  const showToast = (message, type = 'success') => {
    setStatusNotice({ message, type });
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleSaveIp = () => {
    onUpdateAdminIp(ipInput);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleTestConnection = async () => {
    setPingTesting(true);
    setPingResult(null);
    try {
      const endpoint = `${ipInput.replace(/\/$/, '')}/api/health`;
      const res = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        setPingResult({ success: true, message: 'Laptop Admin HQ server reachable!' });
      } else {
        setPingResult({ success: false, message: `Server responded with status ${res.status}` });
      }
    } catch (err) {
      setPingResult({ success: false, message: 'Connection failed. Check Wi-Fi / IP port 8080.' });
    } finally {
      setPingTesting(false);
    }
  };

  const handleSaveSessionParams = () => {
    if (onUpdateSessionSetup) {
      onUpdateSessionSetup({
        ...sessionSetup,
        dutyOfficer,
        battalion,
        company,
        platoon,
        scanMode
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  // --- Modal Open Handlers for CRUD inside Drawer ---
  const handleOpenAdd = (level) => {
    setModalConfig({
      isOpen: true,
      level,
      mode: 'add',
      targetId: '',
      name: '',
      shortCode: '',
      error: ''
    });
  };

  const handleOpenEdit = (level, currentName) => {
    if (!currentName) {
      showToast(`Select a ${level} first to edit.`, 'error');
      return;
    }

    setModalConfig({
      isOpen: true,
      level,
      mode: 'edit',
      targetId: currentName,
      name: currentName,
      shortCode: '',
      error: ''
    });
  };

  const handleConfirmModalSave = () => {
    const { level, mode, targetId, name, shortCode } = modalConfig;
    const cleanName = (name || '').trim();

    if (!cleanName) {
      setModalConfig(prev => ({ ...prev, error: 'Please enter a valid name.' }));
      return;
    }

    try {
      if (level === 'battalion') {
        if (mode === 'add') {
          addBattalion(cleanName, shortCode);
          setBattalion(cleanName);
          showToast(`Added Battalion: ${cleanName}`);
        } else {
          editBattalion(targetId, cleanName, shortCode);
          setBattalion(cleanName);
          showToast(`Updated Battalion: ${cleanName}`);
        }
      } else if (level === 'company') {
        if (mode === 'add') {
          addCompany(battalion, cleanName, shortCode);
          setCompany(cleanName);
          showToast(`Added Company: ${cleanName}`);
        } else {
          editCompany(battalion, targetId, cleanName, shortCode);
          setCompany(cleanName);
          showToast(`Updated Company: ${cleanName}`);
        }
      } else if (level === 'platoon') {
        if (mode === 'add') {
          addPlatoon(battalion, company, cleanName, shortCode);
          setPlatoon(cleanName);
          showToast(`Added Platoon: ${cleanName}`);
        } else {
          editPlatoon(battalion, company, targetId, cleanName, shortCode);
          setPlatoon(cleanName);
          showToast(`Updated Platoon: ${cleanName}`);
        }
      }

      setUnitVersion(v => v + 1);
      setModalConfig({ isOpen: false, level: '', mode: 'add', targetId: '', name: '', shortCode: '', error: '' });
    } catch (err) {
      setModalConfig(prev => ({ ...prev, error: err.message || 'Operation failed' }));
    }
  };

  const handleDeleteEchelon = (level, target) => {
    if (!target) {
      showToast(`Select a ${level} first to delete.`, 'error');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to remove "${target}"?`);
    if (!confirmed) return;

    try {
      if (level === 'battalion') {
        removeBattalion(target);
        showToast(`Removed Battalion: ${target}`);
      } else if (level === 'company') {
        removeCompany(battalion, target);
        showToast(`Removed Company: ${target}`);
      } else if (level === 'platoon') {
        removePlatoon(battalion, company, target);
        showToast(`Removed Platoon: ${target}`);
      }
      setUnitVersion(v => v + 1);
    } catch (err) {
      showToast(err.message || 'Cannot remove echelon', 'error');
    }
  };

  const handleSyncFromAdmin = async () => {
    setSyncingStructure(true);
    try {
      await syncUnitStructureFromAdmin(ipInput || adminIp);
      setUnitVersion(v => v + 1);
      showToast('✅ Synced unit structure from Laptop HQ!');
    } catch (err) {
      showToast(`Sync failed: ${err.message || 'Check connection'}`, 'error');
    } finally {
      setSyncingStructure(false);
    }
  };

  const handleResetDefaults = () => {
    const confirmed = window.confirm('Reset unit structure back to CSU ROTC standard default (1st & 2nd Battalion, 4 Platoons)?');
    if (!confirmed) return;
    resetDefaultStructure();
    setUnitVersion(v => v + 1);
    showToast('Restored CSU standard unit hierarchy.');
  };

  return (
    <div className="mobile-settings-view" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '5.5rem' }}>

      {/* Status Notice Toast */}
      {statusNotice && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          fontSize: '0.8rem',
          fontWeight: 700,
          background: statusNotice.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          color: statusNotice.type === 'error' ? '#f87171' : '#34d399',
          border: `1px solid ${statusNotice.type === 'error' ? '#ef4444' : '#10b981'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-in'
        }}>
          {statusNotice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{statusNotice.message}</span>
        </div>
      )}

      {/* Card 1: Admin HQ Connection & Sync */}
      <div className="setup-card-group">
        <div className="setup-card-title">
          <Server size={18} />
          <span>Laptop Admin HQ Connection</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>
              Admin HQ Server IP / URL
            </label>
            <input
              type="text"
              className="setup-input"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="http://192.168.1.100:8080"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSaveIp}
              className="setup-gold-btn"
              style={{ flex: 1 }}
            >
              {saveSuccess ? 'Saved!' : 'Save IP Address'}
            </button>
            <button
              onClick={handleTestConnection}
              disabled={pingTesting}
              className="setup-sub-btn"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              {pingTesting ? <RefreshCw size={14} className="spin" /> : <Wifi size={14} />}
              <span>{pingTesting ? 'Testing...' : 'Test Ping'}</span>
            </button>
          </div>

          {pingResult && (
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: pingResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: pingResult.success ? 'var(--rotc-green-bright)' : '#f87171',
              border: `1px solid ${pingResult.success ? 'var(--rotc-green-bright)' : '#ef4444'}`
            }}>
              {pingResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{pingResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Clean Unit Echelon Hierarchy Card (Uncluttered, with Manage Hierarchy button) */}
      <div className="setup-card-group">
        <div className="setup-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={18} />
            <span>Unit Echelon Hierarchy</span>
          </div>
          <button
            type="button"
            onClick={() => setIsManageDrawerOpen(true)}
            style={{
              background: 'rgba(217, 119, 6, 0.15)',
              color: 'var(--rotc-gold-bright)',
              border: '1px solid rgba(217, 119, 6, 0.4)',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            <Settings size={13} />
            <span>Manage Hierarchy</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Battalion Selection */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>
              Battalion
            </label>
            <select
              className="setup-select"
              value={battalion}
              onChange={(e) => {
                const newBn = e.target.value;
                setBattalion(newBn);
                const validCoys = getCompaniesForBattalion(newBn, rawStructure);
                setCompany(validCoys[0] || '');
                const validPlat = getPlatoonsForCompany(newBn, validCoys[0], rawStructure);
                setPlatoon(validPlat[0] || '');
              }}
            >
              <option value="" disabled>-- Select Battalion --</option>
              {availableBattalions.map(bn => (
                <option key={bn} value={bn}>{bn}</option>
              ))}
            </select>
          </div>

          {/* Company & Platoon Dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', marginBottom: '4px' }}>
                <Building size={13} /> Company
              </label>
              <select
                className="setup-select"
                value={company}
                disabled={!battalion}
                onChange={(e) => {
                  const newCoy = e.target.value;
                  setCompany(newCoy);
                  const validPlat = getPlatoonsForCompany(battalion, newCoy, rawStructure);
                  setPlatoon(validPlat[0] || '');
                }}
              >
                <option value="" disabled>-- Select Coy --</option>
                {availableCompanies.map(coy => (
                  <option key={coy} value={coy}>{coy}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', marginBottom: '4px' }}>
                <Users size={13} /> Platoon
              </label>
              <select
                className="setup-select"
                value={platoon}
                disabled={!company}
                onChange={(e) => setPlatoon(e.target.value)}
              >
                <option value="" disabled>-- Select PL --</option>
                {availablePlatoons.map(pl => (
                  <option key={pl} value={pl}>{pl}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Field Session & Duty Officer */}
      <div className="setup-card-group">
        <div className="setup-card-title">
          <User size={18} />
          <span>Field Session & Duty Officer</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>
              Duty Officer Name
            </label>
            <input
              type="text"
              className="setup-input"
              value={dutyOfficer}
              onChange={(e) => setDutyOfficer(e.target.value)}
              placeholder="e.g., C/COL JUAN DELA CRUZ 1CL"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>
              Default Scan Mode
            </label>
            <select
              className="setup-select"
              value={scanMode}
              onChange={(e) => setScanMode(e.target.value)}
            >
              <option value="Time-In">Time-In</option>
              <option value="Time-Out">Time-Out</option>
            </select>
          </div>

          <button
            onClick={handleSaveSessionParams}
            className="setup-gold-btn"
            style={{ marginTop: '0.25rem' }}
          >
            Update Session Parameters
          </button>
        </div>
      </div>

      {/* Card 4: Local Phone Storage & Queue */}
      <div className="setup-card-group">
        <div className="setup-card-title">
          <Smartphone size={18} />
          <span>Local Phone Storage & Queue</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-dark-input)',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1px solid var(--border-dark)'
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-bright)' }}>Pending Offline Scans</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Stored locally until Admin batch sync</div>
            </div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              color: offlineQueue.length > 0 ? 'var(--rotc-gold-bright)' : 'var(--rotc-green-bright)'
            }}>
              {offlineQueue.length}
            </div>
          </div>

          {offlineQueue.length > 0 && onResetQueue && (
            <button
              onClick={onResetQueue}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1.5px solid #ef4444',
                borderRadius: '10px',
                padding: '0.75rem',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Trash2 size={16} /> Reset / Clear Unsynced Scans
            </button>
          )}

          {onEditSetup && (
            <button
              onClick={onEditSetup}
              style={{
                background: 'var(--bg-dark-input)',
                color: 'var(--text-bright)',
                border: '1px solid var(--border-dark)',
                borderRadius: '10px',
                padding: '0.75rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} /> Reconfigure Session Setup
            </button>
          )}
        </div>
      </div>

      {/* Card 5: System Information */}
      <div style={{
        background: 'var(--bg-dark-card)',
        borderRadius: '16px',
        padding: '1rem',
        border: '1px solid var(--border-dark)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        textAlign: 'center'
      }}>
        <div style={{ fontWeight: 800, color: 'var(--rotc-gold-bright)' }}>CSU ROTC 1501st CDC Unit Attendance Node</div>
        <div>Offline Field PWA Client • Level L QR Compression</div>
        <div style={{ fontSize: '0.7rem' }}>Caraga State University Main Campus</div>
      </div>

      {/* DEDICATED MOBILE BOTTOM DRAWER: MANAGE UNIT HIERARCHY */}
      {isManageDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          zIndex: 9998
        }}>
          <div style={{
            background: 'var(--bg-dark-card, #0f172a)',
            borderTop: '1.5px solid var(--border-dark, #334155)',
            borderRadius: '24px 24px 0 0',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Top Handle Bar */}
            <div style={{ width: '40px', height: '4px', background: '#475569', borderRadius: '2px', margin: '10px auto 4px auto', flexShrink: 0 }} />

            {/* Drawer Header */}
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-dark, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} color="var(--rotc-gold-bright)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                    Manage Unit Hierarchy
                  </h3>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Add, edit, or remove echelons offline
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageDrawerOpen(false)}
                style={{ background: 'var(--bg-dark-input)', border: '1px solid var(--border-dark)', color: '#94a3b8', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* 1. Battalions Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--rotc-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    1. Battalions ({availableBattalions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenAdd('battalion')}
                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid #10b981', borderRadius: '6px', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Plus size={12} /> Add Bn
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableBattalions.map(bn => (
                    <div
                      key={bn}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.8rem',
                        background: bn === battalion ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-dark-input)',
                        border: bn === battalion ? '1px solid var(--rotc-gold-bright)' : '1px solid var(--border-dark)',
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>{bn}</span>
                        {bn === battalion && (
                          <span style={{ fontSize: '0.65rem', background: 'var(--rotc-gold-bright)', color: '#0b0f19', padding: '1px 6px', borderRadius: '9999px', fontWeight: 800 }}>Active</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit('battalion', bn)}
                          style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEchelon('battalion', bn)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid #ef4444', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={11} /> Del
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Companies Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--rotc-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    2. Companies in {battalion} ({availableCompanies.length})
                  </span>
                  <button
                    type="button"
                    disabled={!battalion}
                    onClick={() => handleOpenAdd('company')}
                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid #10b981', borderRadius: '6px', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Plus size={12} /> Add Coy
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableCompanies.map(coy => (
                    <div
                      key={coy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.8rem',
                        background: coy === company ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-dark-input)',
                        border: coy === company ? '1px solid var(--rotc-gold-bright)' : '1px solid var(--border-dark)',
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>{coy}</span>
                        {coy === company && (
                          <span style={{ fontSize: '0.65rem', background: 'var(--rotc-gold-bright)', color: '#0b0f19', padding: '1px 6px', borderRadius: '9999px', fontWeight: 800 }}>Active</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit('company', coy)}
                          style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEchelon('company', coy)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid #ef4444', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={11} /> Del
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Platoons Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--rotc-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    3. Platoons in {company} ({availablePlatoons.length})
                  </span>
                  <button
                    type="button"
                    disabled={!company}
                    onClick={() => handleOpenAdd('platoon')}
                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid #10b981', borderRadius: '6px', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Plus size={12} /> Add Pltn
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availablePlatoons.map(pl => (
                    <div
                      key={pl}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.8rem',
                        background: pl === platoon ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-dark-input)',
                        border: pl === platoon ? '1px solid var(--rotc-gold-bright)' : '1px solid var(--border-dark)',
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>{pl}</span>
                        {pl === platoon && (
                          <span style={{ fontSize: '0.65rem', background: 'var(--rotc-gold-bright)', color: '#0b0f19', padding: '1px 6px', borderRadius: '9999px', fontWeight: 800 }}>Active</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit('platoon', pl)}
                          style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEchelon('platoon', pl)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid #ef4444', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={11} /> Del
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawer Actions: Sync & Reset */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-dark)' }}>
                <button
                  type="button"
                  onClick={handleSyncFromAdmin}
                  disabled={syncingStructure}
                  style={{
                    background: 'var(--bg-dark-input)',
                    color: 'var(--text-bright)',
                    border: '1px solid var(--border-dark)',
                    borderRadius: '8px',
                    padding: '0.6rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  {syncingStructure ? <RefreshCw size={13} className="spin" /> : <DownloadCloud size={13} color="var(--rotc-gold-bright)" />}
                  <span>{syncingStructure ? 'Syncing...' : 'Sync from HQ'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDefaults}
                  style={{
                    background: 'var(--bg-dark-input)',
                    color: 'var(--text-subtle)',
                    border: '1px solid var(--border-dark)',
                    borderRadius: '8px',
                    padding: '0.6rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Reset Defaults</span>
                </button>
              </div>

            </div>

            {/* Drawer Footer */}
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-dark)', background: '#0b0f19', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsManageDrawerOpen(false)}
                className="setup-gold-btn"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Check size={16} />
                <span>Done & Return to Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG MODAL: ADD / EDIT ECHELON */}
      {modalConfig.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-dark-card, #0f172a)',
            border: '1px solid var(--border-dark, #334155)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '380px',
            padding: '1.25rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={18} color="var(--rotc-gold-bright)" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', textTransform: 'capitalize' }}>
                  {modalConfig.mode} {modalConfig.level}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalConfig({ isOpen: false, level: '', mode: 'add', targetId: '', name: '', shortCode: '', error: '' })}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
              >
                <X size={18} />
              </button>
            </div>

            {modalConfig.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                {modalConfig.error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  {modalConfig.level.toUpperCase()} NAME
                </label>
                <input
                  type="text"
                  className="setup-input"
                  autoFocus
                  value={modalConfig.name}
                  onChange={(e) => setModalConfig(prev => ({ ...prev, name: e.target.value, error: '' }))}
                  placeholder={`e.g. ${modalConfig.level === 'battalion' ? '3rd Battalion' : modalConfig.level === 'company' ? 'Echo Company' : '5th Platoon'}`}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  SHORT CODE (OPTIONAL)
                </label>
                <input
                  type="text"
                  className="setup-input"
                  value={modalConfig.shortCode}
                  onChange={(e) => setModalConfig(prev => ({ ...prev, shortCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. 3BN / ECHO / 5PL"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setModalConfig({ isOpen: false, level: '', mode: 'add', targetId: '', name: '', shortCode: '', error: '' })}
                className="setup-sub-btn"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModalSave}
                className="setup-gold-btn"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <Check size={14} />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export { MobileSettings as MobileSettingsView };
