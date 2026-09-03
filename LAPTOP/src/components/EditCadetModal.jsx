import React, { useState, useEffect, useRef } from 'react';
import { supabase, getSupabaseClient, validatePlatoonCapacity } from '../utils/supabaseClient';
import {
  User,
  Building,
  GraduationCap,
  Phone,
  MapPin,
  HeartHandshake,
  Save,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield
} from 'lucide-react';

import {
  PHILIPPINE_PROVINCES,
  getLocalCities,
  getLocalBarangays,
  formatCityName,
  normalizeKey,
  cacheLocalAddressData
} from '../data/philippineAddresses';

export { formatCityName };

// Pre-transformed province objects for instant 0ms access
const STATIC_PROVINCES = PHILIPPINE_PROVINCES.map((p) => ({
  code: p,
  name: p
}));

// In-memory cache for any dynamically extended geographic data
const psgcCache = {
  provinces: STATIC_PROVINCES,
  citiesByProvince: {},
  barangaysByCity: {}
};

function normalizePlaceName(str) {
  return normalizeKey(str);
}

export const EditCadetModal = ({ cadet, isOpen, onClose, onRefresh }) => {
  const [formData, setFormData] = useState({
    name: '',
    gender: 'Male',
    department: 'CCIS',
    degree: '',
    contactNumber: '',
    province: '',
    city: '',
    barangay: '',
    religion: 'ROMAN CATHOLIC',
    battalion: '1st Battalion',
    company: 'Alpha Company',
    platoon: '1st Platoon'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Field input references for auto-focusing missing items
  const nameInputRef = useRef(null);
  const degreeInputRef = useRef(null);
  const contactInputRef = useRef(null);
  const provinceInputRef = useRef(null);
  const cityInputRef = useRef(null);
  const barangayInputRef = useRef(null);

  // Dynamic PSGC geographic options & loading states (pre-seeded with static data)
  const [provinces, setProvinces] = useState(STATIC_PROVINCES);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  const dynamicBattalions = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const struct = parsed.unitStructure || parsed.unit_structure;
        if (Array.isArray(struct) && struct.length > 0) {
          return struct.map(b => b.name);
        }
      }
    } catch (_) {}
    return ['1st Battalion', '2nd Battalion'];
  }, [isOpen]);

  // 1. Instant 0ms Provinces initialization
  useEffect(() => {
    if (!isOpen) return;
    setProvinces(STATIC_PROVINCES);
  }, [isOpen]);

  // 2. Instant 0ms Cities / Municipalities Lookup via Local Static PSGC
  useEffect(() => {
    if (!formData.province) {
      setCities([]);
      return;
    }

    // Step A: Check local in-memory pre-loaded dataset (0ms synchronous lookup)
    const localCities = getLocalCities(formData.province);
    if (localCities && localCities.length > 0) {
      setCities(localCities.map((c) => ({ code: c, name: c })));
      setLoadingCities(false);
      return;
    }

    // Step B: Graceful background fetch only if province is not in local preloaded dataset
    let isMounted = true;
    const fetchRemoteCities = async () => {
      const cacheKey = normalizeKey(formData.province);
      if (psgcCache.citiesByProvince[cacheKey]) {
        if (isMounted) setCities(psgcCache.citiesByProvince[cacheKey]);
        return;
      }

      setLoadingCities(true);
      try {
        const res = await fetch('https://psgc.gitlab.io/api/provinces.json');
        if (!res.ok) throw new Error('Remote PSGC lookup failed');
        const provData = await res.json();
        const matched = provData.find(
          (p) => normalizeKey(p.name) === cacheKey
        );

        if (matched && isMounted) {
          const citiesRes = await fetch(
            `https://psgc.gitlab.io/api/provinces/${matched.code}/cities-municipalities.json`
          );
          if (citiesRes.ok) {
            const data = await citiesRes.json();
            const list = (data || [])
              .map((c) => ({
                code: c.code,
                name: formatCityName(c.name)
              }))
              .sort((a, b) => a.name.localeCompare(b.name));

            psgcCache.citiesByProvince[cacheKey] = list;
            cacheLocalAddressData(
              formData.province,
              list.map((c) => c.name)
            );
            if (isMounted) setCities(list);
          }
        }
      } catch (err) {
        console.warn('Remote PSGC cities fallback note:', err);
      } finally {
        if (isMounted) setLoadingCities(false);
      }
    };

    fetchRemoteCities();
    return () => {
      isMounted = false;
    };
  }, [formData.province]);

  // 3. Instant 0ms Barangays Lookup via Local Static PSGC
  useEffect(() => {
    if (!formData.city) {
      setBarangays([]);
      return;
    }

    // Step A: Check local in-memory pre-loaded dataset (0ms synchronous lookup)
    const localBarangays = getLocalBarangays(formData.city);
    if (localBarangays && localBarangays.length > 0) {
      setBarangays(localBarangays.map((b) => ({ code: b, name: b })));
      setLoadingBarangays(false);
      return;
    }

    // Step B: Graceful background fetch only if city is not in local preloaded dataset
    let isMounted = true;
    const fetchRemoteBarangays = async () => {
      const cacheKey = normalizeKey(formData.city);
      if (psgcCache.barangaysByCity[cacheKey]) {
        if (isMounted) setBarangays(psgcCache.barangaysByCity[cacheKey]);
        return;
      }

      setLoadingBarangays(true);
      try {
        const matchedCityObj = cities.find(
          (c) => normalizeKey(c.name) === cacheKey
        );
        if (matchedCityObj && matchedCityObj.code && /^\d+$/.test(matchedCityObj.code)) {
          const res = await fetch(
            `https://psgc.gitlab.io/api/cities-municipalities/${matchedCityObj.code}/barangays.json`
          );
          if (res.ok) {
            const data = await res.json();
            const list = (data || [])
              .map((b) => ({
                code: b.code,
                name: String(b.name).toUpperCase()
              }))
              .sort((a, b) => a.name.localeCompare(b.name));

            psgcCache.barangaysByCity[cacheKey] = list;
            cacheLocalAddressData(
              formData.province,
              [],
              formData.city,
              list.map((b) => b.name)
            );
            if (isMounted) setBarangays(list);
          }
        }
      } catch (err) {
        console.warn('Remote PSGC barangays fallback note:', err);
      } finally {
        if (isMounted) setLoadingBarangays(false);
      }
    };

    fetchRemoteBarangays();
    return () => {
      isMounted = false;
    };
  }, [formData.city, cities]);


  useEffect(() => {
    if (cadet) {
      setFormData({
        name: String(cadet.name || '').toUpperCase(),
        gender: String(cadet.gender || 'MALE').toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
        department: String(cadet.department || cadet.college || 'CCIS').toUpperCase(),
        degree: String(cadet.degree || cadet.program || cadet.course || '').toUpperCase(),
        contactNumber: String(cadet.contactNumber || cadet.contact_number || '').toUpperCase(),
        province: String(cadet.province || '').toUpperCase(),
        city: formatCityName(cadet.city),
        barangay: String(cadet.barangay || '').toUpperCase(),
        religion: String(cadet.religion || 'ROMAN CATHOLIC').toUpperCase(),
        battalion: cadet.battalion || '1st Battalion',
        company: cadet.company || 'Alpha Company',
        platoon: cadet.platoon || '1st Platoon',
      });
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [cadet]);

  // Evaluates whether the cadet has missing required profile details
  const hasIncompleteProfile = Boolean(
    cadet?._highlightMissing ||
    cadet?.highlightMissing ||
    !cadet?.contact_number ||
    !cadet?.contactNumber ||
    (!cadet?.province && !cadet?.address) ||
    !cadet?.city ||
    !cadet?.barangay ||
    (!cadet?.program && !cadet?.course && !cadet?.degree)
  );

  // Dynamic missing field checks (turn false as soon as user types into them)
  const isNameMissing = hasIncompleteProfile && !formData.name?.trim();
  const isDegreeMissing = hasIncompleteProfile && !formData.degree?.trim();
  const isContactMissing = hasIncompleteProfile && !formData.contactNumber?.trim();
  const isProvinceMissing = hasIncompleteProfile && !formData.province?.trim();
  const isCityMissing = hasIncompleteProfile && !formData.city?.trim();
  const isBarangayMissing = hasIncompleteProfile && !formData.barangay?.trim();

  // Auto-focus the primary missing field with pulsing focus ring
  useEffect(() => {
    if (!isOpen || !cadet) return;
    const timer = setTimeout(() => {
      const target = cadet.focusField || cadet.highlightField;
      if (target === 'Contact #' || (!cadet.contact_number && !cadet.contactNumber)) {
        contactInputRef.current?.focus();
      } else if (target === 'Program' || (!cadet.program && !cadet.course && !cadet.degree)) {
        degreeInputRef.current?.focus();
      } else if (target === 'Address' || (!cadet.province && !cadet.address)) {
        provinceInputRef.current?.focus();
      } else if (!cadet.name) {
        nameInputRef.current?.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isOpen, cadet]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: typeof value === 'string' ? value.toUpperCase() : value
    }));
  };

  const handleProvinceChange = (e) => {
    const val = String(e.target.value || '').toUpperCase();
    setFormData((prev) => ({
      ...prev,
      province: val,
      city: '',
      barangay: ''
    }));
    setCities([]);
    setBarangays([]);
  };

  const handleCityChange = (e) => {
    const val = formatCityName(e.target.value);
    setFormData((prev) => ({
      ...prev,
      city: val,
      barangay: ''
    }));
    setBarangays([]);
  };

  const handleBarangayChange = (e) => {
    const val = String(e.target.value || '').toUpperCase();
    setFormData((prev) => ({
      ...prev,
      barangay: val
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!cadet) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    // The cadets table stores cadet string IDs (e.g. "221-00002") in the 'id' column
    const targetId = cadet.id || cadet.cadetId || cadet.cadet_id;

    // Enforce Platoon Capacity Guardrail (Strict 37 Cadets Max) if Echelon or Platoon Changed
    const targetBattalion = formData.battalion || cadet.battalion || '1st Battalion';
    const targetCompany = formData.company || cadet.company || 'Alpha Company';
    const targetPlatoon = formData.platoon || cadet.platoon || '1st Platoon';

    const isEchelonChanged = (
      targetBattalion !== cadet.battalion ||
      targetCompany !== cadet.company ||
      targetPlatoon !== cadet.platoon
    );

    if (isEchelonChanged) {
      const capacityCheck = await validatePlatoonCapacity({
        id: targetId,
        battalion: targetBattalion,
        company: targetCompany,
        platoon: targetPlatoon,
        type: cadet.type || 'Basic Cadet',
        rank: cadet.rank || 'Cadet'
      });

      if (!capacityCheck.valid) {
        setSaveError(capacityCheck.error || 'Platoon capacity limit exceeded (37 Cadets Max).');
        setIsSaving(false);
        return;
      }
    }

    // Only include columns that actually exist in the cadets Supabase table (all uppercase)
    const payload = {
      name: formData.name.trim().toUpperCase() || String(cadet.name || '').toUpperCase(),
      gender: formData.gender.toUpperCase(),
      department: formData.department.toUpperCase(),
      program: formData.degree.trim().toUpperCase(),
      course: formData.degree.trim().toUpperCase(),
      contact_number: formData.contactNumber.trim().toUpperCase(),
      province: formData.province.trim().toUpperCase() || null,
      city: formatCityName(formData.city) || null,
      barangay: formData.barangay.trim().toUpperCase() || null,
      religion: (formData.religion || '').toUpperCase() || null,
      battalion: targetBattalion,
      company: targetCompany,
      platoon: targetPlatoon
    };

    const updatedCadet = { ...cadet, ...payload, id: targetId, cadetId: targetId };

    try {
      if (supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('cadets')
          .update(payload)
          .eq('id', targetId)
          .select();

        if (error) {
          console.error('Supabase Update Error:', error);
          setSaveError(`Save failed: ${error.message}`);
          setIsSaving(false);
          return;
        }

        console.log('Supabase update result:', data);
      }

      // Update local storage cache
      try {
        const localKey = 'csu_rotc_cadets_roster';
        const saved = localStorage.getItem(localKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const updated = parsed.map(c => {
            const cId = String(c.id || c.cadetId || c.cadet_id || '').toUpperCase();
            const tId = String(targetId || '').toUpperCase();
            return cId === tId ? { ...c, ...payload } : c;
          });
          localStorage.setItem(localKey, JSON.stringify(updated));
        }
      } catch (_) { }

      // Broadcast update to other components
      try {
        window.dispatchEvent(new CustomEvent('local-cadet-update', { detail: updatedCadet }));
      } catch (_) { }

      setSaveSuccess(true);
      if (onRefresh) await onRefresh(updatedCadet);

      setTimeout(() => { if (onClose) onClose(); }, 400);
    } catch (err) {
      console.error('Error saving cadet:', err);
      setSaveError(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #cbd5e1',
          width: '100%',
          maxWidth: '560px',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          maxHeight: '92vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={20} color="#047857" /> Edit Cadet Details
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '3px 0 0 0' }}>
              ID: <span style={{ fontFamily: 'monospace', color: '#047857', fontWeight: 800 }}>{cadet?.id || cadet?.cadetId}</span> • {cadet?.battalion || '1st Battalion'} • {cadet?.company || 'Alpha Company'} • {cadet?.platoon || '1st Platoon'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center' }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pulsing Highlight Animation for Action Required Fields */}
        <style>{`
          @keyframes missingPulseGlow {
            0%, 100% {
              box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
              border-color: #ef4444;
            }
            50% {
              box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.5);
              border-color: #dc2626;
            }
          }
          .missing-field-pulse {
            animation: missingPulseGlow 1.8s infinite ease-in-out !important;
          }
        `}</style>

        {/* Action Required Banner for Incomplete Profiles */}
        {hasIncompleteProfile && !saveSuccess && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: '#fff1f2',
              border: '1.5px solid #fecdd3',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#9f1239',
              fontSize: '0.78rem',
              fontWeight: 700,
              marginBottom: '1rem',
              boxShadow: '0 1px 3px rgba(225, 29, 72, 0.08)'
            }}
          >
            <AlertCircle size={16} color="#e11d48" style={{ flexShrink: 0 }} />
            <span>Action Required: Please fill out the highlighted empty fields below to update cadet records.</span>
          </div>
        )}

        {/* Status Alerts */}
        {saveError && (
          <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '0.8rem', marginBottom: '1rem' }}>
            <AlertCircle size={16} />
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccess && (
          <div style={{ padding: '0.75rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontSize: '0.8rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={16} />
            <span>Cadet record updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Full Name */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: isNameMissing ? '#b91c1c' : '#475569' }}>
                Full Name
              </label>
              {isNameMissing && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 800, color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  <AlertCircle size={10} color="#dc2626" /> Missing Field
                </span>
              )}
            </div>
            <input
              ref={nameInputRef}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="E.G. DELA CRUZ, JUAN A."
              className={isNameMissing ? 'missing-field-pulse' : ''}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                backgroundColor: isNameMissing ? '#fef2f2' : '#f8fafc',
                border: isNameMissing ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: isNameMissing ? '#991b1b' : '#1e293b',
                outline: 'none',
                textTransform: 'uppercase',
                transition: 'all 0.2s ease'
              }}
            />
          </div>

          {/* UNIT ECHELON & PLATOON ASSIGNMENT (WITH 37 MAX CAPACITY GUARDRAIL) */}
          <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                <Shield size={13} color="#047857" /> Unit / Platoon Assignment
              </label>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#047857', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px' }}>
                37 Max Guardrail
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>Battalion</span>
                <select
                  name="battalion"
                  value={formData.battalion}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    outline: 'none'
                  }}
                >
                  {dynamicBattalions.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>Company</span>
                <select
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    outline: 'none'
                  }}
                >
                  <option value="Alpha Company">Alpha Company</option>
                  <option value="Bravo Company">Bravo Company</option>
                  <option value="Charlie Company">Charlie Company</option>
                  <option value="Delta Company">Delta Company</option>
                </select>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>Platoon</span>
                <select
                  name="platoon"
                  value={formData.platoon}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    outline: 'none'
                  }}
                >
                  <option value="1st Platoon">1st Platoon</option>
                  <option value="2nd Platoon">2nd Platoon</option>
                  <option value="3rd Platoon">3rd Platoon</option>
                  <option value="4th Platoon">4th Platoon</option>
                </select>
              </div>
            </div>
          </div>

          {/* Gender & Department Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                <option value="MALE">MALE</option>
                <option value="FEMALE">FEMALE</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                <Building size={13} color="#64748b" /> Department / College
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                <option value="CEGS">CEGS</option>
                <option value="CCIS">CCIS</option>
                <option value="CHASS">CHASS</option>
                <option value="CAA">CAA</option>
                <option value="CMNS">CMNS</option>
                <option value="CED">CED</option>
                <option value="COFES">COFES</option>
              </select>
            </div>
          </div>

          {/* Program & Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: isDegreeMissing ? '#b91c1c' : '#475569' }}>
                  <GraduationCap size={13} color={isDegreeMissing ? '#dc2626' : '#64748b'} /> Academic Program / Degree
                </label>
                {isDegreeMissing && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', fontWeight: 800, color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    <AlertCircle size={9} color="#dc2626" /> Missing
                  </span>
                )}
              </div>
              <input
                ref={degreeInputRef}
                type="text"
                name="degree"
                value={formData.degree}
                onChange={handleChange}
                placeholder="E.G. BSIT"
                className={isDegreeMissing ? 'missing-field-pulse' : ''}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: isDegreeMissing ? '#fef2f2' : '#f8fafc',
                  border: isDegreeMissing ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: isDegreeMissing ? '#991b1b' : '#1e293b',
                  outline: 'none',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: isContactMissing ? '#b91c1c' : '#475569' }}>
                  <Phone size={13} color={isContactMissing ? '#dc2626' : '#64748b'} /> Contact Number
                </label>
                {isContactMissing && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', fontWeight: 800, color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    <AlertCircle size={9} color="#dc2626" /> Missing
                  </span>
                )}
              </div>
              <input
                ref={contactInputRef}
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="E.G. 09123456789"
                className={isContactMissing ? 'missing-field-pulse' : ''}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: isContactMissing ? '#fef2f2' : '#f8fafc',
                  border: isContactMissing ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: isContactMissing ? '#991b1b' : '#1e293b',
                  outline: 'none',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>
          </div>

          {/* DYNAMIC PSGC ADDRESS AUTOCOMPLETE */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: (isProvinceMissing || isCityMissing || isBarangayMissing) ? '#b91c1c' : '#475569' }}>
                <MapPin size={14} color={(isProvinceMissing || isCityMissing || isBarangayMissing) ? '#dc2626' : '#64748b'} /> Permanent Address (PSGC Standard Geographic Code)
              </label>
              {(isProvinceMissing || isCityMissing || isBarangayMissing) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 800, color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  <AlertCircle size={10} color="#dc2626" /> Incomplete Address
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {/* Province */}
              <div>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: isProvinceMissing ? '#b91c1c' : '#64748b', marginBottom: '2px' }}>
                  <span>Province</span>
                  {provinces.length > 0 && <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{provinces.length} options</span>}
                </span>
                <input
                  ref={provinceInputRef}
                  type="text"
                  name="province"
                  list="psgc-provinces-list"
                  placeholder="SELECT / TYPE PROVINCE"
                  value={formData.province}
                  onChange={handleProvinceChange}
                  className={isProvinceMissing ? 'missing-field-pulse' : ''}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: isProvinceMissing ? '#fef2f2' : '#f8fafc',
                    border: isProvinceMissing ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: isProvinceMissing ? 700 : 500,
                    color: isProvinceMissing ? '#991b1b' : '#1e293b',
                    outline: 'none',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease'
                  }}
                />
                <datalist id="psgc-provinces-list">
                  {provinces.map(p => (
                    <option key={p.code} value={p.name.toUpperCase()} />
                  ))}
                </datalist>
              </div>

              {/* City / Municipality */}
              <div>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: isCityMissing ? '#b91c1c' : '#64748b', marginBottom: '2px' }}>
                  <span>City / Municipality</span>
                  {cities.length > 0 && <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{cities.length} options</span>}
                </span>
                <input
                  ref={cityInputRef}
                  type="text"
                  name="city"
                  list="psgc-cities-list"
                  placeholder={loadingCities ? "LOADING CITIES..." : (formData.province ? "SELECT / TYPE CITY" : "SELECT PROVINCE FIRST")}
                  value={formData.city}
                  onChange={handleCityChange}
                  disabled={loadingCities}
                  className={isCityMissing ? 'missing-field-pulse' : ''}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: isCityMissing ? '#fef2f2' : (loadingCities ? '#f1f5f9' : '#f8fafc'),
                    border: isCityMissing ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: isCityMissing ? 700 : 500,
                    color: isCityMissing ? '#991b1b' : '#1e293b',
                    outline: 'none',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease'
                  }}
                />
                <datalist id="psgc-cities-list">
                  {cities.map(c => (
                    <option key={c.code} value={c.name.toUpperCase()} />
                  ))}
                </datalist>
              </div>

              {/* Barangay */}
              <div>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: isBarangayMissing ? '#b91c1c' : '#64748b', marginBottom: '2px' }}>
                  <span>Barangay</span>
                  {barangays.length > 0 && <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{barangays.length} options</span>}
                </span>
                <input
                  ref={barangayInputRef}
                  type="text"
                  name="barangay"
                  list="psgc-barangays-list"
                  placeholder={loadingBarangays ? "LOADING BARANGAYS..." : (formData.city ? "SELECT / TYPE BARANGAY" : "SELECT CITY FIRST")}
                  value={formData.barangay}
                  onChange={handleBarangayChange}
                  disabled={loadingBarangays}
                  className={isBarangayMissing ? 'missing-field-pulse' : ''}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: isBarangayMissing ? '#fef2f2' : (loadingBarangays ? '#f1f5f9' : '#f8fafc'),
                    border: isBarangayMissing ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: isBarangayMissing ? 700 : 500,
                    color: isBarangayMissing ? '#991b1b' : '#1e293b',
                    outline: 'none',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease'
                  }}
                />
                <datalist id="psgc-barangays-list">
                  {barangays.map(b => (
                    <option key={b.code} value={b.name.toUpperCase()} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* RELIGION DROPDOWN */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
              <HeartHandshake size={14} color="#64748b" /> Religion / Faith Community
            </label>
            <select
              name="religion"
              value={formData.religion}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                backgroundColor: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#1e293b',
                outline: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              <option value="ROMAN CATHOLIC">ROMAN CATHOLIC</option>
              <option value="BAPTIST">BAPTIST</option>
              <option value="CHRISTIAN">CHRISTIAN</option>
              <option value="SEVENTH-DAY">SEVENTH-DAY</option>
              <option value="BORN AGAIN">BORN AGAIN</option>
              <option value="FREE METHODIST">FREE METHODIST</option>
              <option value="IGLESIA NI CRISTO">IGLESIA NI CRISTO</option>
              <option value="UNITED CHURCH OF CHRIST IN THE PHILIPPINES">UNITED CHURCH OF CHRIST IN THE PHILIPPINES</option>
              <option value="OTHERS">OTHERS</option>
            </select>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '0.55rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#64748b',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: isSaving ? '#6ee7b7' : '#047857',
                border: 'none',
                borderRadius: '8px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(4, 120, 87, 0.3)'
              }}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={14} /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCadetModal;
