import React, { useState, useEffect, useMemo } from 'react';
import {
  User, CheckCircle2, AlertTriangle, X, Building, GraduationCap,
  Users, Database, Shield, ClipboardList, RefreshCw
} from 'lucide-react';
import { DEFAULT_UNIT_STRUCTURE } from './AdminSettings';
import {
  getSupabaseClient,
  MAX_PLATOON_CAPACITY,
  normalizePlatoonParts,
  validatePlatoonCapacity,
  fetchSettingsFromSupabase
} from '../utils/supabaseClient';
import { useUnitStructure } from '../context/UnitContext';

// Re-export shared helpers (used by QRCodeGenerator too)
export { MAX_PLATOON_CAPACITY, normalizePlatoonParts, validatePlatoonCapacity };

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const getCompanyCode = (companyStr) => {
  if (!companyStr) return 1;
  const upper = String(companyStr).toUpperCase();
  if (upper.includes('ALPHA') || upper === '1') return 1;
  if (upper.includes('BRAVO') || upper === '2') return 2;
  if (upper.includes('CHARLIE') || upper === '3') return 3;
  if (upper.includes('DELTA') || upper === '4') return 4;
  return 1;
};

export const extractNumber = (str) => {
  if (!str && str !== 0) return 1;
  if (typeof str === 'number') return str;
  const match = String(str).match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

export const getLastNameOnly = (fullName) => {
  if (!fullName) return '';
  const str = String(fullName).trim();
  if (str.includes(',')) return str.split(',')[0].trim().toUpperCase();
  const parts = str.split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
};

export const normalizeCompany = (companyStr) => {
  if (!companyStr) return 'Alpha Company';
  const str = String(companyStr).trim();
  const upper = str.toUpperCase();
  if (upper.includes('ALPHA') || upper === '1') return 'Alpha Company';
  if (upper.includes('BRAVO') || upper === '2') return 'Bravo Company';
  if (upper.includes('CHARLIE') || upper === '3') return 'Charlie Company';
  if (upper.includes('DELTA') || upper === '4') return 'Delta Company';
  return str.endsWith('Company') ? str : `${str} Company`;
};

export const normalizeCadetType = (typeStr = '', rankStr = '') => {
  const t = String(typeStr).trim().toLowerCase();
  const r = String(rankStr).trim().toUpperCase();
  if (
    t === 'officer' || t === 'cadet officer' ||
    r.includes('1CL') || r.includes('2CL') || r.includes('3CL') || r.includes('4CL') ||
    r.includes('COL') || r.includes('MAJ') || r.includes('CPT') || r.includes('LT')
  ) return 'Cadet Officer';
  return 'Basic Cadet';
};

export const generateQrPayload = (cadet) => {
  if (!cadet) return '{}';
  return JSON.stringify({
    id: cadet.id || cadet.cadet_id || cadet.cadetId || '',
    name: getLastNameOnly(cadet.name || ''),
    bat: extractNumber(cadet.battalion),
    coy: getCompanyCode(cadet.company),
    pl: extractNumber(cadet.platoon),
  });
};

// ─── Capacity Alert Modal ─────────────────────────────────────────────────────

export function CapacityAlertModal({ isOpen, onClose, config }) {
  if (!isOpen || !config) return null;
  const { title, message, details, type = 'warning' } = config;
  const isError = type === 'error';
  const isInfo = type === 'info';
  const accentColor = isError ? '#ef4444' : isInfo ? '#10b981' : '#e5a900';
  const badgeBg = isError ? 'rgba(239,68,68,0.15)' : isInfo ? 'rgba(16,185,129,0.15)' : 'rgba(229,169,0,0.15)';
  const badgeBorder = isError ? 'rgba(239,68,68,0.35)' : isInfo ? 'rgba(16,185,129,0.35)' : 'rgba(229,169,0,0.35)';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(3,20,12,0.82)',
        backdropFilter: 'blur(6px)', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#0c2317', border: '1.5px solid #1e4d36', borderRadius: '16px',
        width: '100%', maxWidth: '480px', padding: '1.5rem',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.9), 0 0 25px rgba(6,78,46,0.4)',
        color: '#ffffff', position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              backgroundColor: badgeBg, border: `1px solid ${badgeBorder}`,
              color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {isError ? <AlertTriangle size={22} /> : isInfo ? <CheckCircle2 size={22} /> : <Shield size={22} />}
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: accentColor }}>
                {isError ? 'Guardrail Alert' : isInfo ? 'Information' : 'System Notice'}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fef3c7', fontFamily: 'Oswald, sans-serif' }}>
                {title}
              </h3>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.55, margin: '0 0 1rem 0' }}>{message}</p>

        {details && (
          <div style={{
            backgroundColor: 'rgba(2,44,34,0.75)', border: '1px solid #164e33',
            borderRadius: '10px', padding: '0.75rem 0.9rem', marginBottom: '1.25rem', fontSize: '0.8rem'
          }}>
            {details.platoon && <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: '#6ee7b7' }}>🎯 {details.platoon}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', color: '#cbd5e1' }}>
              {details.inDb !== undefined && <div>• In Database: <strong style={{ color: '#fff' }}>{details.inDb}</strong></div>}
              {details.projected !== undefined && <div>• Projected: <strong style={{ color: '#ef4444' }}>{details.projected}</strong></div>}
              {details.max !== undefined && <div>• Capacity: <strong style={{ color: '#e5a900' }}>{details.max} Max</strong></div>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button" onClick={onClose}
            style={{
              background: '#e5a900', color: '#0A192F', fontWeight: 800, fontSize: '0.84rem',
              padding: '0.55rem 1.4rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(229,169,0,0.4)'
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

// ─── Main Component ───────────────────────────────────────────────────────────

const FORM_KEY = 'csu_rotc_reg_form';

export default function BasicCadetRegistration({ cadets = [], onRefresh }) {
  const { unitStructure: contextStructure } = useUnitStructure();
  const unitStructure = (contextStructure && Array.isArray(contextStructure) && contextStructure.length > 0)
    ? contextStructure : DEFAULT_UNIT_STRUCTURE;

  // ── Form state (with localStorage persistence) ──
  const load = (field, fallback) => {
    try {
      const saved = localStorage.getItem(FORM_KEY);
      if (saved) { const v = JSON.parse(saved)[field]; if (v !== undefined && v !== null) return v; }
    } catch (_) { }
    return fallback;
  };

  const [lastName, setLastName] = useState(() => load('lastName', ''));
  const [firstName, setFirstName] = useState(() => load('firstName', ''));
  const [middleInitial, setMI] = useState(() => load('middleInitial', ''));
  const [gender, setGender] = useState(() => load('gender', 'Male'));
  const [department, setDepartment] = useState(() => load('department', 'CCIS'));
  const [academicProgram, setProgram] = useState(() => load('academicProgram', ''));
  const [cadetId, setCadetId] = useState(() => load('cadetId', ''));
  const [battalion, setBattalion] = useState(() => load('battalion', '1st Battalion'));
  const [company, setCompany] = useState(() => load('company', 'Alpha Company'));
  const [platoon, setPlatoon] = useState(() => load('platoon', '1st Platoon'));

  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [alertModal, setAlertModal] = useState(null);

  // Persist form to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({
        lastName, firstName, middleInitial, gender, department, academicProgram, cadetId, battalion, company, platoon
      }));
    } catch (_) { }
  }, [lastName, firstName, middleInitial, gender, department, academicProgram, cadetId, battalion, company, platoon]);

  // ── Dynamic echelon selectors from unit structure ──
  const dynamicBattalions = useMemo(() =>
    unitStructure.map(b => b.name), [unitStructure]);

  const selectedBattalionObj = useMemo(() => {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
    const cur = norm(battalion);
    return unitStructure.find(b => {
      const bn = norm(b.name);
      const bc = norm(b.shortCode || '');
      return bn === cur || bc === cur || (cur.includes('1') && bn.includes('1')) || (cur.includes('2') && bn.includes('2'));
    }) || unitStructure[0];
  }, [unitStructure, battalion]);

  const availableCompanies = useMemo(() => {
    if (selectedBattalionObj?.companies?.length > 0) return selectedBattalionObj.companies;
    const norm = String(battalion || '').toLowerCase();
    return norm.includes('2')
      ? [{ name: 'Charlie Company' }, { name: 'Delta Company' }]
      : [{ name: 'Alpha Company' }, { name: 'Bravo Company' }];
  }, [selectedBattalionObj, battalion]);

  const selectedCompanyObj = useMemo(() => {
    const norm = s => String(s || '').toLowerCase().replace(/company|coy|\s+/gi, '');
    const cur = norm(company);
    return availableCompanies.find(c => {
      const cn = typeof c === 'string' ? c : c.name;
      return norm(cn) === cur || cn.toLowerCase().includes(cur) || cur.includes(norm(cn));
    }) || availableCompanies[0];
  }, [availableCompanies, company]);

  const availablePlatoons = useMemo(() => {
    if (selectedCompanyObj?.platoons?.length > 0)
      return selectedCompanyObj.platoons.map(p => typeof p === 'string' ? p : p.name);
    return ['1st Platoon', '2nd Platoon', '3rd Platoon', '4th Platoon'];
  }, [selectedCompanyObj]);

  const handleBattalionChange = (newBn) => {
    setBattalion(newBn);
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
    const cur = norm(newBn);
    const targetBn = unitStructure.find(b => {
      const bn = norm(b.name), bc = norm(b.shortCode || '');
      return bn === cur || bc === cur || (cur.includes('1') && bn.includes('1')) || (cur.includes('2') && bn.includes('2'));
    }) || unitStructure[0];
    const comps = targetBn?.companies?.length > 0 ? targetBn.companies
      : cur.includes('2') ? [{ name: 'Charlie Company' }, { name: 'Delta Company' }]
        : [{ name: 'Alpha Company' }, { name: 'Bravo Company' }];
    const compNorm = s => String(s || '').toLowerCase().replace(/company|coy|\s+/gi, '');
    const match = comps.find(c => compNorm(typeof c === 'string' ? c : c.name) === compNorm(company));
    const nextCo = match ? (typeof match === 'string' ? match : match.name) : (typeof comps[0] === 'string' ? comps[0] : comps[0].name);
    if (!match) setCompany(nextCo);
    const targetCo = match || comps[0];
    const plats = targetCo?.platoons?.length > 0
      ? targetCo.platoons.map(p => typeof p === 'string' ? p : p.name)
      : ['1st Platoon', '2nd Platoon', '3rd Platoon', '4th Platoon'];
    const platNorm = s => String(s || '').toLowerCase().replace(/platoon|pltn|\s+/gi, '');
    if (!plats.some(p => platNorm(p) === platNorm(platoon))) setPlatoon(plats[0]);
  };

  const handleCompanyChange = (newCo) => {
    setCompany(newCo);
    const compNorm = s => String(s || '').toLowerCase().replace(/company|coy|\s+/gi, '');
    const targetCo = availableCompanies.find(c => compNorm(typeof c === 'string' ? c : c.name) === compNorm(newCo));
    const plats = targetCo?.platoons?.length > 0
      ? targetCo.platoons.map(p => typeof p === 'string' ? p : p.name)
      : ['1st Platoon', '2nd Platoon', '3rd Platoon', '4th Platoon'];
    const platNorm = s => String(s || '').toLowerCase().replace(/platoon|pltn|\s+/gi, '');
    if (!plats.some(p => platNorm(p) === platNorm(platoon))) setPlatoon(plats[0]);
  };

  // ── Computed full name ──
  const fullName = (() => {
    const l = lastName.trim().toUpperCase();
    const f = firstName.trim().toUpperCase();
    const m = middleInitial.trim().toUpperCase().replace(/\./g, '');
    if (!l && !f) return '';
    if (l && !f) return m ? `${l} ${m}.` : l;
    if (!l && f) return m ? `${f} ${m}.` : f;
    return m ? `${l}, ${f} ${m}.` : `${l}, ${f}`;
  })();

  // ── Platoon capacity ──
  const selectedPlatoonParts = normalizePlatoonParts(battalion, company, platoon);
  const dbCadetsInPlatoon = cadets.filter(c => {
    const isOfficer = c.type === 'Cadet Officer' || /1CL|2CL|3CL|4CL|COL|MAJ|CPT|LT/.test(String(c.rank || ''));
    if (isOfficer) return false;
    return normalizePlatoonParts(c.battalion, c.company, c.platoon).key === selectedPlatoonParts.key;
  });
  const currentLoad = dbCadetsInPlatoon.length;
  const isPlatoonFull = currentLoad >= MAX_PLATOON_CAPACITY;

  // ── Input handlers ──
  const handleLastName = v => {
    setLastName(v.replace(/[0-9]/g, '').replace(/[^a-zA-Z\s\-ñÑ']/g, '').toUpperCase());
    if (formErrors.lastName) setFormErrors(p => ({ ...p, lastName: '' }));
  };
  const handleFirstName = v => {
    setFirstName(v.replace(/[0-9]/g, '').replace(/[^a-zA-Z\s\-ñÑ']/g, '').toUpperCase());
    if (formErrors.firstName) setFormErrors(p => ({ ...p, firstName: '' }));
  };
  const handleMI = v => setMI(v.replace(/[0-9]/g, '').replace(/[^a-zA-ZñÑ]/g, '').toUpperCase().slice(0, 1));
  const handleIdChange = v => {
    const digits = v.replace(/\D/g, '').slice(0, 8);
    setCadetId(digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits);
    if (formErrors.cadetId) setFormErrors(p => ({ ...p, cadetId: '' }));
  };

  const clearForm = () => {
    setLastName(''); setFirstName(''); setMI(''); setCadetId(''); setProgram('');
    setFormErrors({});
    try { localStorage.removeItem(FORM_KEY); } catch (_) { }
  };

  const showToast = (type, message, duration = 3500) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  };

  // ── Register & Save ──
  const handleRegister = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const NAME_RE = /^[A-Z\s\-Ñ']+$/i;
    const ID_RE = /^\d{3}-\d{5}$/;
    const errors = {};

    if (!lastName.trim()) errors.lastName = 'Last Name is required';
    else if (!NAME_RE.test(lastName.trim())) errors.lastName = 'Letters only';

    if (!firstName.trim()) errors.firstName = 'First Name is required';
    else if (!NAME_RE.test(firstName.trim())) errors.firstName = 'Letters only';

    if (!cadetId.trim()) errors.cadetId = 'Cadet ID is required';
    else if (!ID_RE.test(cadetId.trim())) errors.cadetId = 'Format: XXX-XXXXX (e.g. 221-00000)';

    if (!gender) errors.gender = 'Required';
    if (!department) errors.department = 'Required';
    if (!academicProgram.trim()) errors.program = 'Program is required (e.g., BSCS)';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setAlertModal({ type: 'warning', title: 'Missing Required Fields', message: 'Please fill in all highlighted fields before registering.' });
      return;
    }
    setFormErrors({});

    // Platoon capacity check
    if (isPlatoonFull && !dbCadetsInPlatoon.some(c => String(c.id || '').toUpperCase() === cadetId.trim().toUpperCase())) {
      setAlertModal({
        type: 'error',
        title: 'Platoon Capacity Full (37/37)',
        message: `${selectedPlatoonParts.label} already has ${currentLoad} registered cadets. Cannot exceed the maximum of ${MAX_PLATOON_CAPACITY}.`,
        details: { platoon: selectedPlatoonParts.label, inDb: currentLoad, max: MAX_PLATOON_CAPACITY }
      });
      return;
    }

    const payload = {
      id: cadetId.trim(),
      name: fullName,
      rank: 'Cadet',
      battalion: battalion || '1st Battalion',
      company: normalizeCompany(company),
      platoon: platoon || '1st Platoon',
      type: 'Basic Cadet',
      designation: 'N/A',
      gender: gender || 'Male',
      department: department || 'CCIS',
      program: academicProgram.trim().toUpperCase() || null,
      course: academicProgram.trim().toUpperCase() || null,
      is_active: true
    };

    try {
      setIsSaving(true);
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase not configured. Check Settings > Cloud Database.');

      // Final server-side capacity validation
      const validation = await validatePlatoonCapacity(payload, client);
      if (!validation.valid) {
        setAlertModal({
          type: 'error', title: 'Capacity Violation (Server-Side)',
          message: validation.error,
          details: { platoon: validation.platoon, inDb: validation.currentCount, projected: validation.projectedCount, max: MAX_PLATOON_CAPACITY }
        });
        return;
      }

      const { error } = await client.from('cadets').upsert(payload, { onConflict: 'id' });
      if (error) throw error;

      showToast('success', `✅ ${payload.name} (${payload.id}) registered successfully!`);
      clearForm();
      if (typeof onRefresh === 'function') onRefresh();
      window.dispatchEvent(new Event('local-attendance-update'));

    } catch (err) {
      console.error('Registration error:', err);
      setAlertModal({ type: 'error', title: 'Registration Failed', message: err.message || 'Check your connection and Supabase settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full p-6 md:p-8" style={{ width: '100%', padding: '2rem' }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #064e2e, #065f46)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(6,78,46,0.2)'
            }}>
              <ClipboardList size={22} color="#e5a900" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)', fontFamily: 'Oswald, sans-serif', margin: 0, letterSpacing: '0.5px' }}>
                BASIC CADET REGISTRATION
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                Register basic cadets directly into the official Supabase roster database
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Emphasized Workspace Card Container ── */}
      <div
        className="w-full bg-white border-2 border-emerald-800/20 shadow-xl rounded-2xl p-6 md:p-8"
        style={{
          backgroundColor: '#ffffff',
          border: '2px solid rgba(6, 78, 46, 0.2)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          borderRadius: '1rem',
          padding: '2rem'
        }}
      >
        {/* ── 1. PERSONAL INFORMATION ── */}
        <div style={{ marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#064e2e', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Oswald, sans-serif' }}>
              1. PERSONAL INFORMATION
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(160px, 1.2fr) minmax(180px, 1.4fr) minmax(180px, 1.4fr) 90px 140px',
            gap: '1.25rem'
          }}>
            {/* Cadet ID */}
            <div className="form-field-group">
              <label>Student ID <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                className="custom-input"
                style={{
                  padding: '0.8rem 1rem', fontSize: '0.95rem', fontFamily: 'monospace', letterSpacing: '0.05em',
                  ...(formErrors.cadetId ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.12)' } : {})
                }}
                placeholder="e.g. 221-11101"
                maxLength={9}
                value={cadetId}
                onChange={e => handleIdChange(e.target.value)}
              />
              {formErrors.cadetId && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠️ {formErrors.cadetId}</span>}
            </div>

            {/* Last Name */}
            <div className="form-field-group">
              <label>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                className="custom-input"
                style={{
                  padding: '0.8rem 1rem', fontSize: '0.95rem',
                  ...(formErrors.lastName ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.12)' } : {})
                }}
                placeholder="e.g. DELA CRUZ"
                value={lastName}
                onChange={e => handleLastName(e.target.value)}
              />
              {formErrors.lastName && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠️ {formErrors.lastName}</span>}
            </div>

            {/* First Name */}
            <div className="form-field-group">
              <label>First Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                className="custom-input"
                style={{
                  padding: '0.8rem 1rem', fontSize: '0.95rem',
                  ...(formErrors.firstName ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.12)' } : {})
                }}
                placeholder="e.g. JUAN"
                value={firstName}
                onChange={e => handleFirstName(e.target.value)}
              />
              {formErrors.firstName && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠️ {formErrors.firstName}</span>}
            </div>

            {/* M.I. */}
            <div className="form-field-group">
              <label>M.I.</label>
              <input
                type="text"
                className="custom-input"
                style={{ padding: '0.8rem 1rem', fontSize: '0.95rem', textAlign: 'center' }}
                placeholder="A"
                maxLength={1}
                value={middleInitial}
                onChange={e => handleMI(e.target.value)}
              />
            </div>

            {/* Gender */}
            <div className="form-field-group">
              <label>Gender <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                className="custom-select"
                style={{
                  padding: '0.8rem 1rem', fontSize: '0.95rem',
                  ...(formErrors.gender ? { borderColor: '#ef4444' } : {})
                }}
                value={gender}
                onChange={e => { setGender(e.target.value); if (formErrors.gender) setFormErrors(p => ({ ...p, gender: '' })); }}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              {formErrors.gender && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠️ {formErrors.gender}</span>}
            </div>
          </div>
        </div>

        {/* ── 2. ACADEMIC PROGRAM & DEPARTMENT ── */}
        <div style={{ marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#064e2e', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Oswald, sans-serif' }}>
              2. ACADEMIC PROGRAM &amp; DEPARTMENT
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-field-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Building size={14} color="#047857" /> Department <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="custom-select"
                style={{
                  padding: '0.8rem 1rem', fontSize: '0.95rem',
                  ...(formErrors.department ? { borderColor: '#ef4444' } : {})
                }}
                value={department}
                onChange={e => { setDepartment(e.target.value); if (formErrors.department) setFormErrors(p => ({ ...p, department: '' })); }}
              >
                <option value="CCIS">CCIS</option>
                <option value="CEGS">CEGS</option>
                <option value="CHASS">CHASS</option>
                <option value="CAA">CAA</option>
                <option value="CMNS">CMNS</option>
                <option value="CED">CED</option>
                <option value="COFES">COFES</option>
              </select>
              {formErrors.department && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠️ {formErrors.department}</span>}
            </div>

            <div className="form-field-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <GraduationCap size={14} color="#047857" /> Academic Program <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="custom-input"
                style={{
                  padding: '0.8rem 1rem', fontSize: '0.95rem',
                  ...(formErrors.program ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.12)' } : {})
                }}
                placeholder="e.g. BSCS, BSIT, BSCE"
                value={academicProgram}
                onChange={e => { setProgram(e.target.value.toUpperCase()); if (formErrors.program) setFormErrors(p => ({ ...p, program: '' })); }}
              />
              {formErrors.program && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠️ {formErrors.program}</span>}
            </div>
          </div>
        </div>

        {/* ── 3. UNIT ECHELON ASSIGNMENT ── */}
        <div style={{ marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#064e2e', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Oswald, sans-serif' }}>
              3. UNIT ECHELON ASSIGNMENT
            </span>
          </div>

          {/* Echelon Selection (Battalion, Company, Platoon) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-field-group">
              <label>Battalion</label>
              <select
                className="custom-select"
                style={{ padding: '0.8rem 1rem', fontSize: '0.95rem' }}
                value={battalion}
                onChange={e => handleBattalionChange(e.target.value)}
              >
                {dynamicBattalions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="form-field-group">
              <label>Company</label>
              <select
                className="custom-select"
                style={{ padding: '0.8rem 1rem', fontSize: '0.95rem' }}
                value={selectedCompanyObj ? (typeof selectedCompanyObj === 'string' ? selectedCompanyObj : selectedCompanyObj.name) : company}
                onChange={e => handleCompanyChange(e.target.value)}
              >
                {availableCompanies.map(c => {
                  const cn = typeof c === 'string' ? c : c.name;
                  return <option key={cn} value={cn}>{cn}</option>;
                })}
              </select>
            </div>

            <div className="form-field-group">
              <label>Platoon</label>
              <select
                className="custom-select"
                style={{ padding: '0.8rem 1rem', fontSize: '0.95rem' }}
                value={availablePlatoons.includes(platoon) ? platoon : (availablePlatoons[0] || platoon)}
                onChange={e => setPlatoon(e.target.value)}
              >
                {availablePlatoons.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Platoon Capacity Indicator */}
          <div style={{
            padding: '0.85rem 1.15rem',
            backgroundColor: isPlatoonFull ? '#fee2e2' : currentLoad >= 30 ? '#fef3c7' : '#dcfce7',
            borderRadius: '8px',
            border: `1px solid ${isPlatoonFull ? '#f87171' : currentLoad >= 30 ? '#facc15' : '#86efac'}`,
            transition: 'all 0.25s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color={isPlatoonFull ? '#dc2626' : currentLoad >= 30 ? '#d97706' : '#059669'} />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                  Target Platoon: <strong style={{ color: '#064e2e' }}>{selectedPlatoonParts.label}</strong>
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isPlatoonFull ? '#b91c1c' : currentLoad >= 30 ? '#b45309' : '#047857' }}>
                {currentLoad} / {MAX_PLATOON_CAPACITY} Cadets ({Math.min(100, Math.round((currentLoad / MAX_PLATOON_CAPACITY) * 100))}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, (currentLoad / MAX_PLATOON_CAPACITY) * 100)}%`,
                height: '100%',
                background: isPlatoonFull ? 'linear-gradient(90deg,#ef4444,#b91c1c)' : currentLoad >= 30 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#10b981,#059669)',
                borderRadius: '999px', transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.72rem', color: '#475569' }}>
              <span>Supabase Official Roster: <strong style={{ color: '#0f172a' }}>{currentLoad}</strong> enrolled</span>
              <span style={{ fontWeight: 800, color: isPlatoonFull ? '#dc2626' : currentLoad >= 30 ? '#d97706' : '#059669' }}>
                {isPlatoonFull ? '⛔ Platoon Capacity Reached (Cannot add more)' : `${MAX_PLATOON_CAPACITY - currentLoad} enrollment slot(s) remaining`}
              </span>
            </div>
          </div>
        </div>

        {/* Toast feedback */}
        {toast && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '0.85rem 1.25rem', borderRadius: '8px',
            background: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1.5px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: toast.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '0.88rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            {toast.type === 'success' ? <CheckCircle2 size={18} color="#059669" /> : <AlertTriangle size={18} color="#dc2626" />}
            {toast.message}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={handleRegister}
            disabled={isSaving || isPlatoonFull}
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: (isSaving || isPlatoonFull) ? '#94a3b8' : 'linear-gradient(135deg, #064e2e, #065f46)',
              color: '#ffffff', fontWeight: 800, fontSize: '0.95rem',
              padding: '0.9rem 2rem', borderRadius: '10px', border: 'none',
              cursor: (isSaving || isPlatoonFull) ? 'not-allowed' : 'pointer',
              boxShadow: (isSaving || isPlatoonFull) ? 'none' : '0 4px 14px rgba(6,78,46,0.25)',
              transition: 'all 0.2s ease',
              letterSpacing: '0.3px'
            }}
            onMouseEnter={e => { if (!isSaving && !isPlatoonFull) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {isSaving
              ? <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving to Database...</>
              : <><Database size={18} /> Register &amp; Save to Supabase</>
            }
          </button>

          <button
            type="button"
            onClick={clearForm}
            disabled={isSaving}
            title="Clear form"
            style={{
              padding: '0.9rem 1.5rem', borderRadius: '10px', border: '1.5px solid #cbd5e1',
              background: '#ffffff', color: '#64748b', cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.88rem',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; }}
          >
            <X size={17} /> Clear Form
          </button>
        </div>
      </div>

      {/* Capacity Alert Modal */}
      <CapacityAlertModal
        isOpen={Boolean(alertModal)}
        config={alertModal}
        onClose={() => setAlertModal(null)}
      />

      {/* Spin animation */}
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
