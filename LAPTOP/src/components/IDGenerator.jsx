import React, { useState, useEffect } from 'react';
import { Printer, Shield, Award, User, Sparkles, Plus, Trash2, Layers, Database, CheckCircle2, AlertTriangle, Users, X, Info } from 'lucide-react';
import IDCardPreview from './IDCardPreview';
import { DEFAULT_OFFICER_RANKS, DEFAULT_OFFICER_DESIGNATIONS } from './AdminSettings';
import { getSupabaseClient, supabase, MAX_PLATOON_CAPACITY, normalizePlatoonParts, validatePlatoonCapacity } from '../utils/supabaseClient';

export { MAX_PLATOON_CAPACITY, normalizePlatoonParts, validatePlatoonCapacity };
export const OFFICER_DESIGNATIONS = DEFAULT_OFFICER_DESIGNATIONS;

// ==============================================================================
// THEMED CAPACITY / GUARDRAIL ALERT MODAL (Replaces Native Browser Alerts)
// ==============================================================================
function CapacityAlertModal({ isOpen, onClose, config }) {
  if (!isOpen || !config) return null;

  const { title, message, details, type = 'warning' } = config;

  const isError = type === 'error';
  const isWarning = type === 'warning';
  const isInfo = type === 'info';

  const accentColor = isError ? '#ef4444' : isWarning ? '#e5a900' : '#10b981';
  const badgeBg = isError ? 'rgba(239, 68, 68, 0.15)' : isWarning ? 'rgba(229, 169, 0, 0.15)' : 'rgba(16, 185, 129, 0.15)';
  const badgeBorder = isError ? 'rgba(239, 68, 68, 0.35)' : isWarning ? 'rgba(229, 169, 0, 0.35)' : 'rgba(16, 185, 129, 0.35)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(3, 20, 12, 0.82)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'modalFadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#0c2317',
          border: '1.5px solid #1e4d36',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 25px rgba(6, 78, 46, 0.4)',
          color: '#ffffff',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: badgeBg,
                border: `1px solid ${badgeBorder}`,
                color: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isError ? <AlertTriangle size={22} /> : isWarning ? <Shield size={22} /> : <CheckCircle2 size={22} />}
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: accentColor }}>
                {isError ? 'Guardrail Alert' : isWarning ? 'System Notice' : 'Information'}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fef3c7', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.3px' }}>
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '6px'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message */}
        <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.55, margin: '0 0 1rem 0' }}>
          {message}
        </p>

        {/* Optional Structured Breakdown Table */}
        {details && (
          <div
            style={{
              backgroundColor: 'rgba(2, 44, 34, 0.75)',
              border: '1px solid #164e33',
              borderRadius: '10px',
              padding: '0.75rem 0.9rem',
              marginBottom: '1.25rem',
              fontSize: '0.8rem'
            }}
          >
            {details.platoon && (
              <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: '#6ee7b7' }}>
                🎯 Target Unit: {details.platoon}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', color: '#cbd5e1' }}>
              {details.inDb !== undefined && (
                <div>• In Database: <strong style={{ color: '#ffffff' }}>{details.inDb}</strong></div>
              )}
              {details.inQueue !== undefined && (
                <div>• In Print Queue: <strong style={{ color: '#ffffff' }}>{details.inQueue}</strong></div>
              )}
              {details.projected !== undefined && (
                <div>• Projected Total: <strong style={{ color: '#ef4444' }}>{details.projected}</strong></div>
              )}
              {details.max !== undefined && (
                <div>• Platoon Capacity: <strong style={{ color: '#e5a900' }}>{details.max} Cadets Max</strong></div>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#e5a900',
              color: '#0A192F',
              fontWeight: 800,
              fontSize: '0.84rem',
              padding: '0.55rem 1.4rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(229, 169, 0, 0.4)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#c68c00'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#e5a900'}
          >
            UNDERSTOOD
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to parse Company Name to Numeric Code (1-4)
export const getCompanyCode = (companyStr) => {
  if (!companyStr) return 1;
  const upper = String(companyStr).toUpperCase();
  if (upper.includes('ALPHA') || upper === '1') return 1;
  if (upper.includes('BRAVO') || upper === '2') return 2;
  if (upper.includes('CHARLIE') || upper === '3') return 3;
  if (upper.includes('DELTA') || upper === '4') return 4;
  return 1;
};

// Helper to extract numeric values (e.g., "1ST BATTALION" -> 1)
export const extractNumber = (str) => {
  if (!str && str !== 0) return 1;
  if (typeof str === 'number') return str;
  const match = String(str).match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

// Helper to extract Last Name ONLY
export const getLastNameOnly = (fullName) => {
  if (!fullName) return '';
  const str = String(fullName).trim();
  // Handles "LASTNAME, FIRSTNAME M" or "FIRSTNAME LASTNAME"
  if (str.includes(',')) {
    return str.split(',')[0].trim().toUpperCase();
  }
  const parts = str.split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
};

// Helper to normalize company name to full string (e.g. "Alpha" -> "Alpha Company")
export const normalizeCompany = (companyStr) => {
  if (!companyStr) return 'Alpha Company';
  const str = String(companyStr).trim();
  const upper = str.toUpperCase();
  if (['1CL', '2CL', '3CL', '4CL', 'ASPIRANT', 'COCC', 'OFFICER CORPS', 'COMMAND STAFF', 'SPECIAL STAFF'].includes(upper)) {
    return str;
  }
  if (upper.includes('ALPHA') || upper === '1') return 'Alpha Company';
  if (upper.includes('BRAVO') || upper === '2') return 'Bravo Company';
  if (upper.includes('CHARLIE') || upper === '3') return 'Charlie Company';
  if (upper.includes('DELTA') || upper === '4') return 'Delta Company';
  if (upper.includes('HEADQUARTERS') || upper === 'HQ') return 'Headquarters';
  return str.endsWith('Company') ? str : `${str} Company`;
};

// Helper to normalize cadet type string (e.g. "basic" -> "Basic Cadet", "officer" -> "Cadet Officer")
export const normalizeCadetType = (typeStr, rankStr = '') => {
  const t = String(typeStr || '').trim().toLowerCase();
  const r = String(rankStr || '').trim().toUpperCase();
  if (
    t === 'officer' ||
    t === 'cadet officer' ||
    r.includes('1CL') ||
    r.includes('2CL') ||
    r.includes('3CL') ||
    r.includes('4CL') ||
    r.includes('COL') ||
    r.includes('MAJ') ||
    r.includes('CPT') ||
    r.includes('LT')
  ) {
    return 'Cadet Officer';
  }
  return 'Basic Cadet';
};

// Generate Compact QR Payload String
export const generateQrPayload = (cadet) => {
  if (!cadet) return '{}';
  const payload = {
    id: cadet.id || cadet.cadet_id || cadet.cadetId || '',
    name: getLastNameOnly(cadet.name || cadet.full_name || cadet.fullName || ''),
    bat: extractNumber(cadet.battalion),
    coy: getCompanyCode(cadet.company),
    pl: extractNumber(cadet.platoon),
  };

  return JSON.stringify(payload);
};

export default function IDGenerator({ cadets = [], onRefresh, refreshCadetsRoster }) {
  // Category state: 'basic' | 'officer'
  const [category, setCategory] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.category) return parsed.category;
      }
    } catch (_) { }
    return 'basic';
  });

  // Dynamic Ranks and Designations loaded from settings
  const [officerRanks, setOfficerRanks] = useState(() => {
    try {
      const local = localStorage.getItem('csu_rotc_admin_settings');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.officerRanks && parsed.officerRanks.length > 0) return parsed.officerRanks;
      }
    } catch (e) { }
    return DEFAULT_OFFICER_RANKS;
  });

  const [officerDesignations, setOfficerDesignations] = useState(() => {
    try {
      const local = localStorage.getItem('csu_rotc_admin_settings');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.officerDesignations && parsed.officerDesignations.length > 0) return parsed.officerDesignations;
      }
    } catch (e) { }
    return DEFAULT_OFFICER_DESIGNATIONS;
  });

  useEffect(() => {
    const syncOptions = () => {
      try {
        const local = localStorage.getItem('csu_rotc_admin_settings');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.officerRanks && parsed.officerRanks.length > 0) {
            setOfficerRanks(parsed.officerRanks);
          }
          if (parsed.officerDesignations && parsed.officerDesignations.length > 0) {
            setOfficerDesignations(parsed.officerDesignations);
          }
        }
      } catch (e) { }
    };

    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.officerRanks && data.officerRanks.length > 0) {
            setOfficerRanks(data.officerRanks);
          }
          if (data.officerDesignations && data.officerDesignations.length > 0) {
            setOfficerDesignations(data.officerDesignations);
          }
        }
      } catch (e) { }
    };

    fetchSettings();
    window.addEventListener('storage', syncOptions);
    window.addEventListener('csu_settings_updated', syncOptions);
    return () => {
      window.removeEventListener('storage', syncOptions);
      window.removeEventListener('csu_settings_updated', syncOptions);
    };
  }, []);

  // Split Name Fields State with LocalStorage Persistence
  const [lastName, setLastName] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).lastName || '';
    } catch (_) { }
    return '';
  });

  const [firstName, setFirstName] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).firstName || '';
    } catch (_) { }
    return '';
  });

  const [middleInitial, setMiddleInitial] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).middleInitial || '';
    } catch (_) { }
    return '';
  });

  // Cadet ID, Rank, Echelon State with LocalStorage Persistence
  const [cadetId, setCadetId] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).cadetId || '';
    } catch (_) { }
    return '';
  });

  const [rank, setRank] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).rank || 'Cadet';
    } catch (_) { }
    return 'Cadet';
  });

  const [battalion, setBattalion] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).battalion || '1st Battalion';
    } catch (_) { }
    return '1st Battalion';
  });

  const [company, setCompany] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).company || 'Alpha';
    } catch (_) { }
    return 'Alpha';
  });

  const [platoon, setPlatoon] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).platoon || '1st Platoon';
    } catch (_) { }
    return '1st Platoon';
  });

  const [designation, setDesignation] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).designation || 'None';
    } catch (_) { }
    return 'None';
  });

  // Batch Cards Queue with LocalStorage Persistence
  const [printQueue, setPrintQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_batch_queue');
      if (saved) return JSON.parse(saved);
    } catch (_) { }
    return [];
  });
  const batchQueue = printQueue;
  const setBatchQueue = setPrintQueue;

  // Selected Platoon Real-Time Capacity Calculation
  const selectedPlatoonParts = normalizePlatoonParts(battalion, company, platoon);

  // Existing registered basic cadets in this platoon from Supabase / Master Roster prop
  const dbCadetsInSelectedPlatoon = cadets.filter(c => {
    const isOfficer = (
      c.type === 'Cadet Officer' ||
      String(c.rank || '').includes('1CL') ||
      String(c.rank || '').includes('2CL') ||
      String(c.rank || '').includes('3CL') ||
      String(c.rank || '').includes('4CL') ||
      String(c.rank || '').includes('COL') ||
      String(c.rank || '').includes('MAJ') ||
      String(c.rank || '').includes('CPT') ||
      String(c.rank || '').includes('LT')
    );
    if (isOfficer) return false;
    return normalizePlatoonParts(c.battalion, c.company, c.platoon).key === selectedPlatoonParts.key;
  });

  // Queued basic cadets in this platoon
  const queuedCadetsInSelectedPlatoon = printQueue.filter(c => {
    const isOfficer = (
      c.type === 'Cadet Officer' ||
      String(c.rank || '').includes('1CL') ||
      String(c.rank || '').includes('2CL') ||
      String(c.rank || '').includes('3CL') ||
      String(c.rank || '').includes('4CL') ||
      String(c.rank || '').includes('COL') ||
      String(c.rank || '').includes('MAJ') ||
      String(c.rank || '').includes('CPT') ||
      String(c.rank || '').includes('LT')
    );
    if (isOfficer) return false;
    return normalizePlatoonParts(c.battalion, c.company, c.platoon).key === selectedPlatoonParts.key;
  });

  // Combined unique count (accounting for same ID in both DB and queue)
  const combinedSelectedPlatoonCadetIds = new Set([
    ...dbCadetsInSelectedPlatoon.map(c => String(c.id || c.cadetId || '').toUpperCase()),
    ...queuedCadetsInSelectedPlatoon.map(c => String(c.id || c.cadetId || '').toUpperCase())
  ]);
  const currentPlatoonLoad = combinedSelectedPlatoonCadetIds.size;
  const isPlatoonAtMax = currentPlatoonLoad >= MAX_PLATOON_CAPACITY;

  // Print Lock State: true only AFTER user clicks "Print Batch" for the current batch
  const [hasPrintedCurrentBatch, setHasPrintedCurrentBatch] = useState(false);
  const hasPrinted = hasPrintedCurrentBatch;
  const setHasPrinted = setHasPrintedCurrentBatch;
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Custom Capacity & Guardrail Alert Modal State
  const [alertModal, setAlertModal] = useState(null);
  const showAlert = (config) => setAlertModal(config);
  const closeAlert = () => setAlertModal(null);

  // Synchronize Form State to LocalStorage
  useEffect(() => {
    try {
      const formData = {
        category,
        lastName,
        firstName,
        middleInitial,
        cadetId,
        rank,
        battalion,
        company,
        platoon,
        designation
      };
      localStorage.setItem('csu_rotc_id_gen_form', JSON.stringify(formData));
    } catch (_) { }
  }, [category, lastName, firstName, middleInitial, cadetId, rank, battalion, company, platoon, designation]);

  // Synchronize Batch Print Queue to LocalStorage
  useEffect(() => {
    try {
      if (printQueue.length === 0) {
        localStorage.removeItem('csu_rotc_id_gen_batch_queue');
      } else {
        localStorage.setItem('csu_rotc_id_gen_batch_queue', JSON.stringify(printQueue));
      }
    } catch (_) { }
  }, [printQueue]);

  // Category Switcher Handler
  const handleCategorySwitch = (newCat) => {
    setCategory(newCat);
    if (newCat === 'basic') {
      setRank('Cadet');
      setBattalion('1st Battalion');
      setCompany('Alpha');
      setPlatoon('1st Platoon');
      setDesignation('None');
    } else {
      const firstRank = officerRanks && officerRanks.length > 0 ? officerRanks[0] : '1CL Cadet Col';
      const firstDesig = officerDesignations && officerDesignations.length > 0 ? officerDesignations[0] : 'Corps Commander';
      setRank(firstRank);
      setBattalion('CADET OFFICERS');
      setCompany('1CL');
      setPlatoon(firstDesig);
      setDesignation(firstDesig);
    }
  };

  // Helper to format full display name: "LASTNAME, FIRSTNAME M"
  const fullName = (() => {
    const l = lastName.trim().toUpperCase();
    const f = firstName.trim().toUpperCase();
    const m = middleInitial.trim().toUpperCase().replace(/\./g, '');
    if (!l && !f) return 'CADET FULL NAME';
    let formatted = l || 'LASTNAME';
    if (f) formatted += `, ${f}`;
    if (m) formatted += ` ${m}`;
    return formatted;
  })();

  const handleLastNameChange = (val) => {
    // Strictly block numbers and special characters; permit letters, spaces, hyphens, and ñ/Ñ
    const sanitized = val.replace(/[0-9]/g, '').replace(/[^a-zA-Z\s\-ñÑ']/g, '').toUpperCase();
    setLastName(sanitized);
  };

  const handleFirstNameChange = (val) => {
    // Strictly block numbers and special characters; permit letters, spaces, hyphens, and ñ/Ñ
    const sanitized = val.replace(/[0-9]/g, '').replace(/[^a-zA-Z\s\-ñÑ']/g, '').toUpperCase();
    setFirstName(sanitized);
  };

  const handleMiddleInitialChange = (val) => {
    // Single alphabetical letter only
    const cleaned = val.replace(/[0-9]/g, '').replace(/[^a-zA-ZñÑ]/g, '').toUpperCase().slice(0, 1);
    setMiddleInitial(cleaned);
  };

  const handleIdChange = (val) => {
    // Strictly accept only up to 8 digits and auto-format as XXX-XXXXX
    const digits = val.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setCadetId(formatted);
  };

  // 1. Add New Card to Queue (Strict 37 Cadets Max Guardrail)
  const handleAddToQueue = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!lastName.trim() || !firstName.trim() || !cadetId.trim()) {
      showAlert({
        type: 'warning',
        title: 'Missing Required Fields',
        message: 'Please fill in Last Name, First Name, and Cadet ID before adding to the queue.'
      });
      return;
    }

    // Strict Name Validation: Prohibit numeric characters
    const NAME_VALIDATION_REGEX = /^[A-Z\s\-Ñ']+$/i;
    if (!NAME_VALIDATION_REGEX.test(lastName.trim()) || !NAME_VALIDATION_REGEX.test(firstName.trim())) {
      showAlert({
        type: 'warning',
        title: 'Invalid Characters in Name',
        message: 'Last Name and First Name cannot contain numeric digits or invalid symbols. Please use letters only.'
      });
      return;
    }

    const cleanCid = cadetId.trim();

    // Strict Cadet ID Validation: Must strictly match XXX-XXXXX format (3 digits - 5 digits)
    const CADET_ID_REGEX = /^\d{3}-\d{5}$/;
    if (!CADET_ID_REGEX.test(cleanCid)) {
      showAlert({
        type: 'warning',
        title: 'Invalid Cadet ID Format',
        message: 'Cadet ID must strictly follow the format XXX-XXXXX (3 digits, hyphen, 5 digits — e.g., 221-01231).'
      });
      return;
    }

    // --------------------------------------------------------------------------
    // GUARDRAIL: Strict 37 Cadets Max Capacity Limit per Platoon
    // --------------------------------------------------------------------------
    if (category === 'basic') {
      const targetParts = normalizePlatoonParts(battalion, company, platoon);

      // Check DB registered count
      const existingInDb = cadets.filter(c => {
        const isOfficer = (
          c.type === 'Cadet Officer' ||
          String(c.rank || '').includes('1CL') ||
          String(c.rank || '').includes('2CL') ||
          String(c.rank || '').includes('3CL') ||
          String(c.rank || '').includes('4CL') ||
          String(c.rank || '').includes('COL') ||
          String(c.rank || '').includes('MAJ') ||
          String(c.rank || '').includes('CPT') ||
          String(c.rank || '').includes('LT')
        );
        if (isOfficer) return false;
        return normalizePlatoonParts(c.battalion, c.company, c.platoon).key === targetParts.key;
      });

      const dbHasThisCadet = existingInDb.some(c => String(c.id || c.cadetId || '').toUpperCase() === cleanCid.toUpperCase());

      // If DB already has 37 cadets and this is a NEW cadet not currently in DB
      if (existingInDb.length >= MAX_PLATOON_CAPACITY && !dbHasThisCadet) {
        showAlert({
          type: 'error',
          title: 'Platoon Database Capacity Full (37/37 Max)',
          message: `The Supabase database already has ${existingInDb.length} registered cadets assigned to ${targetParts.label}. Cannot add a 38th cadet to this platoon. Platoon capacity is strictly capped at ${MAX_PLATOON_CAPACITY} cadets.`,
          details: {
            platoon: targetParts.label,
            inDb: existingInDb.length,
            inQueue: queuedCadetsInSelectedPlatoon.length,
            max: MAX_PLATOON_CAPACITY
          }
        });
        return;
      }

      // Check existing queue count for this platoon
      const existingInQueue = printQueue.filter(c => {
        const isOfficer = (
          c.type === 'Cadet Officer' ||
          String(c.rank || '').includes('1CL') ||
          String(c.rank || '').includes('2CL') ||
          String(c.rank || '').includes('3CL') ||
          String(c.rank || '').includes('4CL') ||
          String(c.rank || '').includes('COL') ||
          String(c.rank || '').includes('MAJ') ||
          String(c.rank || '').includes('CPT') ||
          String(c.rank || '').includes('LT')
        );
        if (isOfficer) return false;
        return normalizePlatoonParts(c.battalion, c.company, c.platoon).key === targetParts.key;
      });

      // Calculate projected combined count
      const combinedIds = new Set([
        ...existingInDb.map(c => String(c.id || c.cadetId || '').toUpperCase()),
        ...existingInQueue.map(c => String(c.id || c.cadetId || '').toUpperCase()),
        cleanCid.toUpperCase()
      ]);

      if (combinedIds.size > MAX_PLATOON_CAPACITY) {
        showAlert({
          type: 'error',
          title: 'Platoon Capacity Limit Exceeded (37 Max)',
          message: `Adding this cadet would exceed the 37-cadet maximum capacity for ${targetParts.label}.`,
          details: {
            platoon: targetParts.label,
            inDb: existingInDb.length,
            inQueue: existingInQueue.length,
            projected: combinedIds.size,
            max: MAX_PLATOON_CAPACITY
          }
        });
        return;
      }
    }

    const newCadet = {
      id: cleanCid,
      lastName: lastName.trim().toUpperCase(),
      firstName: firstName.trim().toUpperCase(),
      middleInitial: middleInitial.trim().toUpperCase(),
      name: fullName,
      rank: 'Cadet',
      battalion: battalion,
      company: normalizeCompany(company),
      platoon: platoon,
      designation: 'None',
      type: 'Basic Cadet',
      is_active: true,
      queueId: Date.now()
    };

    setPrintQueue(prev => {
      const exists = prev.some(c => (c.id || c.cadet_id) === newCadet.id);
      return exists ? prev.map(c => (c.id || c.cadet_id) === newCadet.id ? newCadet : c) : [...prev, newCadet];
    });

    setHasPrintedCurrentBatch(false);

    setLastName('');
    setFirstName('');
    setMiddleInitial('');
    setCadetId('');

    setToastMessage({
      type: 'SUCCESS',
      message: `Added ${newCadet.lastName || newCadet.name} to local print queue.`,
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRemoveFromQueue = (index) => {
    setPrintQueue(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        setHasPrintedCurrentBatch(false);
      }
      return updated;
    });
  };

  const handleAddToBatch = handleAddToQueue;
  const handleRemoveFromBatch = handleRemoveFromQueue;

  const handlePrintBatch = () => {
    if (!printQueue || printQueue.length === 0) {
      showAlert({
        type: 'info',
        title: 'Batch Queue Is Empty',
        message: 'Please add cadet cards to the batch queue before printing.'
      });
      return;
    }
    setHasPrintedCurrentBatch(true);
    window.print();
  };

  // 3. Save Printed Cards to Database & Clear Them From Queue (Explicit User Action Only with 37 Max Guardrail)
  const handleSaveToDatabase = async () => {
    if (!hasPrintedCurrentBatch || printQueue.length === 0) {
      showAlert({
        type: 'warning',
        title: 'Print Required First',
        message: 'You must print the ID cards first before saving them to the Supabase database!'
      });
      return;
    }

    try {
      setIsSaving(true);

      // Format queue items for Supabase cadets schema
      const recordsToInsert = printQueue.map((cadet) => ({
        id: cadet.id || cadet.cadet_id || cadet.cadetId,
        name: cadet.name || `${cadet.lastName || cadet.last_name || ''}, ${cadet.firstName || cadet.first_name || ''} ${cadet.middleInitial || cadet.middle_initial || ''}`.trim(),
        rank: cadet.rank || (normalizeCadetType(cadet.type, cadet.rank) === 'Cadet Officer' ? 'Cadet Officer' : 'Cadet'),
        battalion: cadet.battalion || '1st Battalion',
        company: normalizeCompany(cadet.company),
        platoon: cadet.platoon || '1st Platoon',
        type: normalizeCadetType(cadet.type, cadet.rank),
        designation: cadet.designation || 'N/A',
        is_active: true
      }));

      // Explicit DB Insert Call via Supabase with Platoon Capacity Guardrail
      const client = getSupabaseClient();
      if (client) {
        // Enforce 37-cadet max platoon validation before executing upsert
        const validation = await validatePlatoonCapacity(recordsToInsert, client);
        if (!validation.valid) {
          showAlert({
            type: 'error',
            title: 'Database Save Blocked (Capacity Violation)',
            message: validation.error,
            details: {
              platoon: validation.platoon,
              inDb: validation.currentCount,
              inQueue: validation.incomingCount,
              projected: validation.projectedCount,
              max: MAX_PLATOON_CAPACITY
            }
          });
          setIsSaving(false);
          return;
        }

        const { error } = await client
          .from('cadets')
          .upsert(recordsToInsert, { onConflict: 'id' });

        if (error) throw error;
      }

      // Success Notification
      setToastMessage({
        type: 'SUCCESS',
        message: `Successfully saved ${recordsToInsert.length} cadet(s) to Supabase database!`,
      });
      setTimeout(() => setToastMessage(null), 3500);

      // Refresh Cadets Roster view state if callback exists
      if (typeof refreshCadetsRoster === 'function') {
        refreshCadetsRoster();
      }
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
      window.dispatchEvent(new Event('local-attendance-update'));

      // CRITICAL FIX: CLEAR THE QUEUE SO SAVED CARDS DON'T STICK AROUND
      setPrintQueue([]);
      setHasPrintedCurrentBatch(false);
      try {
        localStorage.removeItem('csu_rotc_id_gen_batch_queue');
      } catch (_) { }

    } catch (err) {
      console.error("Error saving to database:", err);
      showAlert({
        type: 'error',
        title: 'Database Save Failed',
        message: err.message || 'Please check your connection and Supabase settings.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBatchToDatabase = handleSaveToDatabase;

  const cardsToPrint = batchQueue;

  return (
    <div className="id-generator-container">
      {/* Top Header Controls */}
      <div className="id-generator-header no-print">
        <div>
          <h1 className="page-heading">ROTC ID Card Generator</h1>
          <p className="page-subheading">Official CSU ROTC Double-Sided ID Cards with Scannable QR Codes</p>
        </div>
      </div>

      {/* 2-Column Grid Layout */}
      <div className="id-generator-grid">

        {/* Left Column: Cadet Information Form */}
        <div className="form-card-container no-print">
          <div className="form-card-header">
            <User size={18} />
            <span>Cadet Information</span>
          </div>

          <div className="form-card-body">
            {/* Split Name Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: '0.75rem' }}>
              <div className="form-field-group">
                <label>Last Name </label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="e.g., DELA CRUZ"
                  value={lastName}
                  onChange={(e) => handleLastNameChange(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label>First Name </label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="e.g., JUAN"
                  value={firstName}
                  onChange={(e) => handleFirstNameChange(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label>M.I.</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="e.g., A"
                  maxLength={1}
                  value={middleInitial}
                  onChange={(e) => handleMiddleInitialChange(e.target.value)}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>Single letter only (no period)</span>
              </div>
            </div>

            {/* Cadet ID & Rank (Locked to Cadet) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-field-group">
                <label>Cadet ID</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="e.g., 221-01231"
                  maxLength={9}
                  value={cadetId}
                  onChange={(e) => handleIdChange(e.target.value)}
                />

              </div>

              <div className="form-field-group">
                <label>Rank</label>
                <input
                  type="text"
                  className="custom-input"
                  value="Cadet"
                  disabled
                  style={{ backgroundColor: '#f3f4f6', color: 'var(--text-dark)', fontWeight: 600 }}
                />
              </div>
            </div>

            {/* Basic Cadet Echelon Hierarchy Assignment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
              <div className="form-field-group">
                <label>Battalion</label>
                <select
                  className="custom-select"
                  value={battalion}
                  onChange={(e) => setBattalion(e.target.value)}
                >
                  <option value="1st Battalion">1st Battalion</option>
                  <option value="2nd Battalion">2nd Battalion</option>
                </select>
              </div>

              <div className="form-field-group">
                <label>Company</label>
                <select
                  className="custom-select"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                >
                  <option value="Alpha">Alpha</option>
                  <option value="Bravo">Bravo</option>
                  <option value="Charlie">Charlie</option>
                  <option value="Delta">Delta</option>
                </select>
              </div>

              <div className="form-field-group">
                <label>Platoon</label>
                <select
                  className="custom-select"
                  value={platoon}
                  onChange={(e) => setPlatoon(e.target.value)}
                >
                  <option value="1st Platoon">1st Pltn</option>
                  <option value="2nd Platoon">2nd Pltn</option>
                </select>
              </div>
            </div>

            {/* LIVE VISUAL CAPACITY PROGRESS BAR (37 Cadets Max per Platoon) */}
            <div
              style={{
                marginTop: '0.85rem',
                marginBottom: '0.45rem',
                padding: '0.75rem 0.85rem',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: `1.5px solid ${isPlatoonAtMax ? '#fecaca' : currentPlatoonLoad >= 30 ? '#fde68a' : '#e2e8f0'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.25s ease'
              }}
            >
              {/* Progress Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color={isPlatoonAtMax ? '#dc2626' : currentPlatoonLoad >= 30 ? '#d97706' : '#059669'} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>
                    {selectedPlatoonParts.label}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: isPlatoonAtMax ? '#b91c1c' : currentPlatoonLoad >= 30 ? '#b45309' : '#047857'
                  }}
                >
                  {currentPlatoonLoad} / {MAX_PLATOON_CAPACITY} Cadets ({Math.min(100, Math.round((currentPlatoonLoad / MAX_PLATOON_CAPACITY) * 100))}%)
                </span>
              </div>

              {/* Progress Bar Track */}
              <div
                style={{
                  width: '100%',
                  height: '10px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, (currentPlatoonLoad / MAX_PLATOON_CAPACITY) * 100))}%`,
                    height: '100%',
                    background: isPlatoonAtMax
                      ? 'linear-gradient(90deg, #ef4444, #b91c1c)'
                      : currentPlatoonLoad >= 30
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: '999px',
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isPlatoonAtMax
                      ? '0 0 8px rgba(239, 68, 68, 0.5)'
                      : currentPlatoonLoad >= 30
                        ? '0 0 8px rgba(245, 158, 11, 0.35)'
                        : '0 0 8px rgba(16, 185, 129, 0.35)'
                  }}
                />
              </div>

              {/* Progress Footer Breakdown */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.69rem', color: '#64748b' }}>
                <span>
                  Database: <strong style={{ color: '#0f172a' }}>{dbCadetsInSelectedPlatoon.length}</strong> • Queue: <strong style={{ color: '#0f172a' }}>{queuedCadetsInSelectedPlatoon.length}</strong>
                </span>
                <span style={{ fontWeight: 800, color: isPlatoonAtMax ? '#dc2626' : currentPlatoonLoad >= 30 ? '#d97706' : '#059669' }}>
                  {isPlatoonAtMax ? '⛔ Platoon Limit Full' : `${Math.max(0, MAX_PLATOON_CAPACITY - currentPlatoonLoad)} slot(s) remaining`}
                </span>
              </div>
            </div>

            {/* Add to Batch Queue Button */}
            <button
              type="button"
              onClick={handleAddToBatch}
              style={{
                marginTop: '0.45rem',
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: isPlatoonAtMax ? '#cbd5e1' : '#E5A900',
                color: isPlatoonAtMax ? '#64748b' : '#0A192F',
                fontWeight: 700,
                fontSize: '0.88rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                border: 'none',
                boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
                cursor: isPlatoonAtMax ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
              onMouseEnter={(e) => {
                if (!isPlatoonAtMax) {
                  e.currentTarget.style.background = '#C68C00';
                  e.currentTarget.style.boxShadow = '0px 6px 10px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPlatoonAtMax) {
                  e.currentTarget.style.background = '#E5A900';
                  e.currentTarget.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              <Plus size={18} style={{ strokeWidth: 2.5 }} /> Add to Batch Print Queue
            </button>

            {/* Batch Queue Manager */}
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.88rem', color: 'var(--rotc-green-dark)' }}>
                  <Layers size={17} />
                  <span>Batch Print Queue ({batchQueue.length})</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>4 Cards / A4 Sheet</span>

                  {/* Save to Database Button - Gated until Print Batch is clicked */}
                  <button
                    type="button"
                    onClick={handleSaveBatchToDatabase}
                    disabled={batchQueue.length === 0 || !hasPrinted || isSaving}
                    title={
                      batchQueue.length === 0
                        ? "Batch print queue is empty"
                        : !hasPrinted
                          ? "⚠️ Print batch first before saving to Supabase database"
                          : "Save all queued cadets to Supabase database"
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: !hasPrinted || batchQueue.length === 0 ? '#64748b' : '#065f46',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: batchQueue.length === 0 || !hasPrinted || isSaving ? 'not-allowed' : 'pointer',
                      opacity: batchQueue.length === 0 || !hasPrinted || isSaving ? 0.6 : 1,
                      boxShadow: hasPrinted && batchQueue.length > 0 ? '0 2px 6px rgba(6, 95, 70, 0.35)' : '0 1px 3px rgba(0,0,0,0.12)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (batchQueue.length > 0 && hasPrinted && !isSaving) {
                        e.currentTarget.style.background = '#044e3a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (batchQueue.length > 0 && hasPrinted && !isSaving) {
                        e.currentTarget.style.background = '#065f46';
                      }
                    }}
                  >
                    <Database size={13} />
                    <span>
                      {isSaving
                        ? 'Saving...'
                        : !hasPrinted && batchQueue.length > 0
                          ? 'Save to Database (Print First)'
                          : 'Save to Database'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Success Alert Notification */}
              {toastMessage && (
                <div style={{
                  marginBottom: '0.6rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  background: '#ecfdf5',
                  border: '1px solid #10b981',
                  color: '#065f46',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <CheckCircle2 size={15} color="#059669" />
                  <span>{toastMessage.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                {batchQueue.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                    Batch queue is empty. Add cadet cards using the form above.
                  </div>
                ) : (
                  batchQueue.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="queue-item-anim" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                      <div>
                        <strong>{item.id}</strong> - {item.name} <span style={{ color: 'var(--rotc-green-dark)', fontWeight: 600 }}>({item.company} Coy • {item.platoon})</span>
                      </div>
                      <button onClick={() => handleRemoveFromBatch(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }} title="Remove from batch queue">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live CR80 ID Card Preview */}
        <div className="preview-card-container">
          <div className="preview-card-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1.25rem', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} style={{ color: 'var(--rotc-green-dark)' }} />
              <span>LIVE ID CARD PREVIEW (Batch {printQueue.length} {printQueue.length === 1 ? 'Card' : 'Cards'})</span>
            </div>
            <button
              type="button"
              className="btn-print-action"
              onClick={handlePrintBatch}
              disabled={printQueue.length === 0}
              title={printQueue.length === 0 ? "Add cadet cards to print batch" : "Print batch cards (4 per A4 sheet)"}
              style={{
                fontSize: '0.82rem',
                padding: '0.45rem 0.95rem',
                opacity: printQueue.length === 0 ? 0.6 : 1,
                cursor: printQueue.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Printer size={16} /> Print Batch ({printQueue.length} {printQueue.length === 1 ? 'Card' : 'Cards'})
            </button>
          </div>

          <div className="preview-display-wrapper">
            {cardsToPrint.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8', fontSize: '0.88rem' }}>
                <Layers size={36} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
                <p style={{ fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>No cards in batch queue</p>
                <span style={{ fontSize: '0.78rem' }}>Fill in cadet details and click "Add Form Cadet to Batch Queue" to preview cards.</span>
              </div>
            ) : (
              <div className="batch-print-grid">
                {cardsToPrint.map((card, idx) => (
                  <IDCardPreview key={`${card.id}-${card.type}-${idx}`} card={card} />
                ))}
              </div>
            )}
          </div>

          <div className="preview-footer-note no-print">
            <Printer size={14} />
            <span>Tapping <strong>Print Batch</strong> formats 4 double-sided cards per A4 page.</span>
          </div>
        </div>

      </div>

      {/* Themed Capacity & Guardrail Alert Modal */}
      <CapacityAlertModal
        isOpen={Boolean(alertModal)}
        config={alertModal}
        onClose={closeAlert}
      />
    </div>
  );
}

export { IDGenerator as IdCardGenerator };
