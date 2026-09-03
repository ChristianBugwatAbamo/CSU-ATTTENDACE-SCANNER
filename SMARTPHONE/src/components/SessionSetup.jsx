import React, { useState, useEffect, useMemo } from 'react';
import { UserCheck, Calendar, Clock, Building, Users, Play, Shield, Layers, CheckCircle2, ChevronDown, X, Award, Check, Plus, Edit2, Trash2, RotateCcw, AlertTriangle, Settings, DownloadCloud } from 'lucide-react';
import { getLocalPhilippineDate } from '../services/storage';
import {
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
  UNIT_UPDATE_EVENT
} from '../utils/unitStructure';

const OFFICER_CLASSES = [
  {
    classKey: '1CL',
    label: '1CL • First Class',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    badgeBorder: '#fcd34d',
    ranks: [
      { value: 'C/COL (ROTC) 1CL', label: 'C/COL (ROTC) 1CL', title: 'Cadet Colonel' },
      { value: 'C/LT COL (ROTC) 1CL', label: 'C/LT COL (ROTC) 1CL', title: 'Cadet Lieutenant Colonel' }
    ]
  },
  {
    classKey: '2CL',
    label: '2CL • Second Class',
    badgeBg: '#dbeafe',
    badgeColor: '#1e40af',
    badgeBorder: '#93c5fd',
    ranks: [
      { value: 'C/MAJ (ROTC) 2CL', label: 'C/MAJ (ROTC) 2CL', title: 'Cadet Major' },
      { value: 'C/CPT (ROTC) 2CL', label: 'C/CPT (ROTC) 2CL', title: 'Cadet Captain' }
    ]
  },
  {
    classKey: '3CL',
    label: '3CL • Third Class',
    badgeBg: '#d1fae5',
    badgeColor: '#065f46',
    badgeBorder: '#6ee7b7',
    ranks: [
      { value: 'C/CPT (ROTC) 3CL', label: 'C/CPT (ROTC) 3CL', title: 'Cadet Captain' },
      { value: 'C/1LT (ROTC) 3CL', label: 'C/1LT (ROTC) 3CL', title: 'Cadet First Lieutenant' }
    ]
  },
  {
    classKey: '4CL',
    label: '4CL • Fourth Class',
    badgeBg: '#f1f5f9',
    badgeColor: '#334155',
    badgeBorder: '#cbd5e1',
    ranks: [
      { value: 'C/1LT (ROTC) 4CL', label: 'C/1LT (ROTC) 4CL', title: 'Cadet First Lieutenant' },
      { value: 'C/2LT (ROTC) 4CL', label: 'C/2LT (ROTC) 4CL', title: 'Cadet Second Lieutenant' }
    ]
  }
];

const OFFICER_RANKS = OFFICER_CLASSES.flatMap(c => c.ranks.map(r => r.value));

const getClassBadgeStyle = (rankStr) => {
  if (!rankStr) {
    return {
      classKey: 'RANK',
      label: 'Select Rank',
      badgeBg: 'rgba(255, 255, 255, 0.1)',
      badgeColor: '#fbbf24',
      badgeBorder: 'rgba(251, 191, 36, 0.3)'
    };
  }
  for (const group of OFFICER_CLASSES) {
    if (rankStr.includes(group.classKey)) {
      return group;
    }
  }
  return OFFICER_CLASSES[0];
};

export default function SessionSetup({ initialSetup = {}, onStartSession, isEditing = false }) {
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

  // Parse initial duty officer string if formatted
  const parseInitialDutyOfficer = (raw) => {
    if (!raw || !raw.trim() || raw.includes('SANTOS') || raw.includes('MARIA')) {
      return { rank: '', firstName: '', middleInitial: '', lastName: '' };
    }

    let matchedRank = '';
    let remaining = raw;

    // Check matching rank from sorted class hierarchy
    for (const r of OFFICER_RANKS) {
      const parenIdx = r.indexOf('(');
      const prefix = parenIdx !== -1 ? r.substring(0, parenIdx).trim() : r;
      const suffix = parenIdx !== -1 ? r.substring(parenIdx).trim() : '';

      if (raw.startsWith(prefix)) {
        if (!suffix || raw.includes(suffix)) {
          matchedRank = r;
          remaining = raw.replace(prefix, '').replace(suffix, '').trim();
          break;
        }
      }
    }

    // Clean remaining string of any leading rank codes
    remaining = remaining.replace(/^C\/\w+\s*/, '').trim();

    // Check if legacy comma separated: LAST, FIRST MI
    if (remaining.includes(',')) {
      const [last, firstMi] = remaining.split(',');
      const parts = (firstMi || '').trim().split(/\s+/);
      const first = parts.slice(0, -1).join(' ') || parts[0] || '';
      const mi = parts.length > 1 ? parts[parts.length - 1].replace(/\./g, '') : '';
      return {
        rank: matchedRank,
        lastName: (last || '').trim().toUpperCase(),
        firstName: (first || '').trim().toUpperCase(),
        middleInitial: mi.slice(0, 2).toUpperCase()
      };
    }

    // New format: FIRST [MI] LAST
    const words = remaining.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 3 && words[words.length - 2].length <= 2) {
      const last = words[words.length - 1];
      const mi = words[words.length - 2];
      const first = words.slice(0, words.length - 2).join(' ');
      return {
        rank: matchedRank,
        lastName: last.toUpperCase(),
        firstName: first.toUpperCase(),
        middleInitial: mi.toUpperCase()
      };
    } else if (words.length === 2) {
      return {
        rank: matchedRank,
        lastName: words[1].toUpperCase(),
        firstName: words[0].toUpperCase(),
        middleInitial: ''
      };
    } else if (words.length === 1) {
      return {
        rank: matchedRank,
        lastName: words[0].toUpperCase(),
        firstName: '',
        middleInitial: ''
      };
    }

    return {
      rank: matchedRank,
      lastName: '',
      firstName: '',
      middleInitial: ''
    };
  };

  const parsedOic = parseInitialDutyOfficer(initialSetup.dutyOfficer);

  const [oicRank, setOicRank] = useState(parsedOic.rank || '');
  const [oicFirstName, setOicFirstName] = useState(parsedOic.firstName || '');
  const [oicMiddleInitial, setOicMiddleInitial] = useState(parsedOic.middleInitial || '');
  const [oicLastName, setOicLastName] = useState(parsedOic.lastName || '');

  const [sessionDate, setSessionDate] = useState(initialSetup.sessionDate || getLocalPhilippineDate());
  const [battalion, setBattalion] = useState(initialSetup.battalion || '');
  const [company, setCompany] = useState(initialSetup.company || '');
  const [platoon, setPlatoon] = useState(initialSetup.platoon || '');
  const [scanMode, setScanMode] = useState(initialSetup.scanMode || '');

  const [unitVersion, setUnitVersion] = useState(0);

  useEffect(() => {
    const handleUnitUpdate = () => {
      setUnitVersion(v => v + 1);
    };
    window.addEventListener(UNIT_UPDATE_EVENT, handleUnitUpdate);
    window.addEventListener('storage', handleUnitUpdate);
    return () => {
      window.removeEventListener(UNIT_UPDATE_EVENT, handleUnitUpdate);
      window.removeEventListener('storage', handleUnitUpdate);
    };
  }, []);

  const availableBattalions = useMemo(() => getBattalions(), [unitVersion]);
  const availableCompanies = useMemo(() => getCompaniesForBattalion(battalion), [battalion, unitVersion]);
  const availablePlatoons = useMemo(() => getPlatoonsForCompany(battalion, company), [battalion, company, unitVersion]);

  // Manage Units Drawer & Modal States
  const [isManageDrawerOpen, setIsManageDrawerOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    level: '',
    mode: 'add',
    targetId: '',
    name: '',
    shortCode: '',
    error: ''
  });
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

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

  const handleOpenEdit = (level) => {
    let currentName = '';
    if (level === 'battalion') currentName = battalion;
    else if (level === 'company') currentName = company;
    else if (level === 'platoon') currentName = platoon;

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

  const handleDeleteEchelon = (level) => {
    let target = '';
    if (level === 'battalion') target = battalion;
    else if (level === 'company') target = company;
    else if (level === 'platoon') target = platoon;

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

  const handleResetDefaults = () => {
    const confirmed = window.confirm('Reset unit structure back to CSU ROTC standard default (1st & 2nd Battalion, 4 Platoons)?');
    if (!confirmed) return;
    resetDefaultStructure();
    setUnitVersion(v => v + 1);
    showToast('Restored CSU standard unit hierarchy.');
  };

  useEffect(() => {
    if (initialSetup && initialSetup.dutyOfficer) {
      const p = parseInitialDutyOfficer(initialSetup.dutyOfficer);
      setOicRank(p.rank || '');
      setOicFirstName(p.firstName || '');
      setOicMiddleInitial(p.middleInitial || '');
      setOicLastName(p.lastName || '');
    }
    if (initialSetup.battalion !== undefined) setBattalion(initialSetup.battalion);
    if (initialSetup.company !== undefined) setCompany(initialSetup.company);
    if (initialSetup.platoon !== undefined) setPlatoon(initialSetup.platoon);
    if (initialSetup.scanMode !== undefined) setScanMode(initialSetup.scanMode);
    if (initialSetup.sessionDate !== undefined) setSessionDate(initialSetup.sessionDate);
  }, [initialSetup]);

  // Format: [Rank Prefix] [First Name] [MI] [Last Name] [Branch/Class Suffix]
  const getFormattedDutyOfficer = () => {
    const l = oicLastName.trim().toUpperCase();
    const f = oicFirstName.trim().toUpperCase();
    const mi = oicMiddleInitial.trim().toUpperCase().replace(/\./g, '');

    const parenIndex = oicRank.indexOf('(');
    let rankPrefix = oicRank;
    let rankSuffix = '';

    if (parenIndex !== -1) {
      rankPrefix = oicRank.substring(0, parenIndex).trim();
      rankSuffix = oicRank.substring(parenIndex).trim();
    }

    const nameParts = [f, mi, l].filter(Boolean).join(' ');

    if (!nameParts && !oicRank) {
      return '(Not Configured)';
    }

    if (!nameParts) {
      return oicRank;
    }

    if (!oicRank) {
      return nameParts;
    }

    return rankSuffix
      ? `${rankPrefix} ${nameParts} ${rankSuffix}`
      : `${rankPrefix} ${nameParts}`;
  };

  const handleMiddleInitialChange = (val) => {
    const cleaned = val.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    setOicMiddleInitial(cleaned);
  };

  // Form Validation Check: All fields must be explicitly selected/filled
  const isFormValid = Boolean(
    oicRank.trim() &&
    oicLastName.trim() &&
    oicFirstName.trim() &&
    scanMode.trim() &&
    battalion.trim() &&
    company.trim() &&
    platoon.trim()
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) {
      alert("Please fill in and select all required fields (Platoon Leader Rank, Last Name, First Name, Scan Mode, Battalion, Company, and Platoon).");
      return;
    }
    const fullOfficerName = getFormattedDutyOfficer();

    onStartSession({
      dutyOfficer: fullOfficerName,
      sessionDate,
      sessionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      battalion,
      company,
      platoon,
      scanMode
    });
  };

  const currentClassInfo = getClassBadgeStyle(oicRank);

  return (
    <div className="settings-edge-to-edge-view">
      {/* Clean Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ color: 'var(--rotc-gold-bright)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '3px' }}>
          SCANNER CONFIGURATION
        </div>
        <h1 style={{ color: '#ffffff', fontSize: '1.45rem', fontWeight: 800, margin: 0, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.4px' }}>
          Field Session Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '3px 0 0 0' }}>
          Configure officer on duty and active scan mode
        </p>
      </div>

      {/* Setup Form Grouped in High-Contrast Modern Visual Cards */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

        {/* Visual Card 1: Platoon Leader In Charge Section */}
        <div className="setup-card-group">
          <div className="setup-card-title">
            <UserCheck size={16} />
            <span>Platoon Leader In Charge </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Rank / Class Selector Button with Class Badge */}
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '5px' }}>
                Rank & Class
              </label>

              <button
                type="button"
                onClick={() => setIsRankModalOpen(true)}
                style={{
                  width: '100%',
                  background: 'var(--bg-dark-input)',
                  border: oicRank ? '1.5px solid var(--border-dark)' : '1.5px dashed var(--rotc-gold-bright)',
                  borderRadius: '12px',
                  padding: '0.75rem 0.85rem',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: currentClassInfo.badgeBg,
                    color: currentClassInfo.badgeColor,
                    border: `1px solid ${currentClassInfo.badgeBorder}`,
                    flexShrink: 0,
                    letterSpacing: '0.3px'
                  }}>
                    {currentClassInfo.classKey}
                  </span>

                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: oicRank ? '#ffffff' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {oicRank || '-- Tap to Select Officer Rank & Class * --'}
                  </span>
                </div>

                <ChevronDown size={18} style={{ color: 'var(--rotc-gold-bright)', flexShrink: 0 }} />
              </button>
            </div>

            {/* Split Name Fields: Last Name, First Name, Middle Initial */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 68px', gap: '0.55rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  className="setup-input"
                  placeholder="e.g., DELA CRUZ"
                  value={oicLastName}
                  onChange={(e) => setOicLastName(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>
                  First Name
                </label>
                <input
                  type="text"
                  className="setup-input"
                  placeholder="e.g., JUAN"
                  value={oicFirstName}
                  onChange={(e) => setOicFirstName(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }} title="Middle initial without period">
                  M.I.
                </label>
                <input
                  type="text"
                  className="setup-input"
                  placeholder="A"
                  maxLength={1}
                  value={oicMiddleInitial}
                  onChange={(e) => handleMiddleInitialChange(e.target.value)}
                  style={{ textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Live Name Preview */}
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-dark-input)',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px'
            }}>
              <span>Officer Name:</span>
              <strong style={{ color: oicLastName || oicFirstName ? 'var(--rotc-gold-bright)' : 'var(--text-muted)', textAlign: 'right' }}>
                {getFormattedDutyOfficer()}
              </strong>
            </div>
          </div>
        </div>

        {/* Visual Card 2: Bright Pill-Toggle Scan Mode Selection */}
        <div className="setup-card-group">
          <div className="setup-card-title">
            <Shield size={16} />
            <span>Active Scan Mode </span>
          </div>

          <div className="segmented-mode-track">
            <button
              type="button"
              className={`segmented-mode-btn ${scanMode === 'Time-In' ? 'active-timein' : ''}`}
              onClick={() => setScanMode('Time-In')}
            >
              <span className="mode-btn-dot dot-green"></span>
              <span>TIME-IN</span>
            </button>

            <button
              type="button"
              className={`segmented-mode-btn ${scanMode === 'Time-Out' ? 'active-timeout' : ''}`}
              onClick={() => setScanMode('Time-Out')}
            >
              <span className="mode-btn-dot dot-amber"></span>
              <span>TIME-OUT</span>
            </button>
          </div>
        </div>

        {/* Visual Card 3: Unit Echelon Hierarchy (Clean Card with Manage Hierarchy Header Action) */}
        <div className="setup-card-group">
          <div className="setup-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} />
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
            {/* Battalion */}
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
                  const validCoys = getCompaniesForBattalion(newBn);
                  setCompany(validCoys[0] || '');
                  const validPlat = getPlatoonsForCompany(newBn, validCoys[0]);
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
                    const validPlat = getPlatoonsForCompany(battalion, newCoy);
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

        {/* Visual Card 4: Session Date & System Clock */}
        <div className="setup-card-group">
          <div className="setup-card-title">
            <Calendar size={16} />
            <span>Session Date & Time</span>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <input
              type="date"
              className="setup-input"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              style={{ flex: 1 }}
            />
            <div style={{
              background: 'var(--bg-dark-input)',
              border: '1px solid var(--border-dark)',
              borderRadius: '12px',
              padding: '0.75rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: 'var(--rotc-gold-bright)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Clock size={14} />
              <span>LIVE CLOCK</span>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            ⚡ Real-time smartphone timestamp is automatically attached to each scanned attendance record.
          </div>
        </div>

        {/* Save & Apply Portal Button */}
        <button
          type="submit"
          className="setup-gold-btn"
          disabled={!isFormValid}
          style={{ marginTop: '0.35rem' }}
        >
          <Play size={18} />
          <span>{isFormValid ? 'Save & Launch Scanner' : 'Complete Required Setup to Continue'}</span>
        </button>
      </form>

      {/* Grouped Rank & Class Selection Modal in High-Contrast Dark Slate */}
      {isRankModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsRankModalOpen(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{
            background: 'var(--bg-dark-card)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '430px',
            maxHeight: '82vh',
            height: 'auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.75)',
            border: '1.5px solid var(--border-dark)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0f172a',
              color: '#ffffff',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontFamily: 'Oswald, sans-serif', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                <Award size={20} color="var(--rotc-gold-bright)" />
                <span>SELECT OFFICER RANK & CLASS</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRankModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Grouped List */}
            <div style={{
              padding: '1rem',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y',
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
              background: 'var(--bg-dark-base)'
            }}>
              {OFFICER_CLASSES.map((classGroup) => (
                <div key={classGroup.classKey} style={{ background: 'var(--bg-dark-card)', borderRadius: '12px', border: '1px solid var(--border-dark)', overflow: 'hidden', flexShrink: 0 }}>
                  {/* Class Group Header Banner */}
                  <div style={{
                    padding: '0.5rem 0.85rem',
                    background: classGroup.badgeBg,
                    borderBottom: `1px solid ${classGroup.badgeBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: classGroup.badgeColor, letterSpacing: '0.5px' }}>
                      {classGroup.label}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: classGroup.badgeColor,
                      background: 'rgba(255, 255, 255, 0.85)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: `1px solid ${classGroup.badgeBorder}`
                    }}>
                      Class {classGroup.classKey}
                    </span>
                  </div>

                  {/* Ranks inside Class Group */}
                  <div style={{ padding: '0.5rem' }}>
                    {classGroup.ranks.map((r) => {
                      const isSelected = oicRank === r.value;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => {
                            setOicRank(r.value);
                            setIsRankModalOpen(false);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 0.85rem',
                            borderRadius: '10px',
                            border: isSelected ? '1.5px solid var(--rotc-gold-bright)' : '1px solid var(--border-dark)',
                            background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-dark-input)',
                            marginBottom: '6px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: isSelected ? '0 2px 8px rgba(245, 158, 11, 0.25)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: isSelected ? 'var(--rotc-gold-bright)' : '#ffffff' }}>
                              {r.label}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {r.title}
                            </div>
                          </div>

                          {isSelected && (
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'var(--rotc-gold-bright)',
                              color: '#0b0f19',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Check size={15} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border-dark)', background: '#0f172a', textAlign: 'right', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsRankModalOpen(false)}
                style={{
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  borderRadius: '10px',
                  background: 'var(--bg-dark-card)',
                  color: '#ffffff',
                  border: '1px solid var(--border-dark)',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                          onClick={() => handleOpenEdit('battalion')}
                          style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEchelon('battalion')}
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
                          onClick={() => handleOpenEdit('company')}
                          style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEchelon('company')}
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
                          onClick={() => handleOpenEdit('platoon')}
                          style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEchelon('platoon')}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid #ef4444', borderRadius: '6px', padding: '3px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={11} /> Del
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawer Quick Reset Defaults Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-dark)' }}>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  style={{
                    background: 'var(--bg-dark-input)',
                    color: 'var(--text-subtle)',
                    border: '1px solid var(--border-dark)',
                    borderRadius: '8px',
                    padding: '0.6rem 1rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Reset Hierarchy to CSU Defaults</span>
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
                <span>Done & Return to Setup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ECHELON DIALOG */}
      {modalConfig.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
                <span>Save Echelon</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '5.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.65rem 1.25rem',
          borderRadius: '12px',
          fontSize: '0.8rem',
          fontWeight: 800,
          background: toastMessage.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10000,
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          {toastMessage.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          <span>{toastMessage.message}</span>
        </div>
      )}

    </div>
  );
}

export { SessionSetup as SettingsView, SessionSetup as MobileSettingsView };
