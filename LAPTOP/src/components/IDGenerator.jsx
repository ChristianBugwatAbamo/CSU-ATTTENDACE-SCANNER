import React, { useState, useEffect } from 'react';
import { Printer, Shield, Award, User, Sparkles, Plus, Trash2, Layers, Database, CheckCircle2 } from 'lucide-react';
import IDCardPreview from './IDCardPreview';
import { DEFAULT_OFFICER_RANKS, DEFAULT_OFFICER_DESIGNATIONS } from './AdminSettings';
import { getSupabaseClient, supabase } from '../utils/supabaseClient';

export const OFFICER_DESIGNATIONS = DEFAULT_OFFICER_DESIGNATIONS;

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

  const [hasPrintedCurrentBatch, setHasPrintedCurrentBatch] = useState(false);
  const hasPrinted = hasPrintedCurrentBatch;
  const setHasPrinted = setHasPrintedCurrentBatch;

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Synchronize Form State to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('csu_rotc_id_gen_form', JSON.stringify({
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
      }));
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

  // Helper: Format combined Full Name: LAST NAME, FIRST NAME MIDDLE INITIAL
  const getFormattedFullName = () => {
    const last = lastName.trim().toUpperCase();
    const first = firstName.trim().toUpperCase();
    const mi = middleInitial.replace(/\./g, '').trim().toUpperCase();

    if (!last && !first) return 'SANTOS, MARIA L';
    if (last && first) return `${last}, ${first}${mi ? ` ${mi}` : ''}`;
    return `${last || first}${mi ? ` ${mi}` : ''}`;
  };

  const fullName = getFormattedFullName();

  // Category Switch Handler
  const handleCategorySwitch = (newCategory) => {
    setCategory(newCategory);
    if (newCategory === 'basic') {
      setRank('Cadet');
      setBattalion('1st Battalion');
      setCompany('Alpha');
      setPlatoon('1st Platoon');
      setDesignation('None');
    } else {
      setRank('Cadet COL (ROTC) 1CL');
      setBattalion('CADET OFFICERS');
      setCompany('1CL');
      setPlatoon('Corps Command Staff');
      setDesignation('Corps Commander');
    }
  };

  const handleLastNameChange = (val) => {
    setLastName(val.toUpperCase());
  };

  const handleFirstNameChange = (val) => {
    setFirstName(val.toUpperCase());
  };

  const handleMiddleInitialChange = (val) => {
    const cleaned = val.replace(/\./g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
    setMiddleInitial(cleaned);
  };

  const handleIdChange = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setCadetId(formatted);
  };

  // 1. Add New Card to Queue (Resets Print Lock for New Items - Zero Supabase Calls)
  const handleAddToQueue = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!lastName.trim() || !firstName.trim() || !cadetId.trim()) {
      alert("Please fill in Last Name, First Name, and Cadet ID.");
      return;
    }

    let officerClass = '1CL';
    if (rank.includes('1CL')) officerClass = '1CL';
    else if (rank.includes('2CL')) officerClass = '2CL';
    else if (rank.includes('3CL')) officerClass = '3CL';
    else if (rank.includes('4CL')) officerClass = '4CL';
    else if (rank.includes('ASPIRANT') || rank.includes('COCC')) officerClass = 'ASPIRANT';

    const newCadet = {
      id: cadetId.trim(),
      lastName: lastName.trim().toUpperCase(),
      firstName: firstName.trim().toUpperCase(),
      middleInitial: middleInitial.trim().toUpperCase(),
      name: fullName,
      rank: category === 'basic' ? 'Cadet' : rank,
      battalion: category === 'basic' ? battalion : 'CADET OFFICERS',
      company: category === 'basic' ? normalizeCompany(company) : officerClass,
      platoon: category === 'basic' ? platoon : (designation && designation !== 'None' ? designation : 'Corps Command Staff'),
      designation: category === 'basic' ? 'None' : designation,
      type: normalizeCadetType(category, rank),
      is_active: true,
      queueId: Date.now()
    };

    // Add new card and require a new print trigger for this new batch
    setPrintQueue(prev => {
      const exists = prev.some(c => (c.id || c.cadet_id) === newCadet.id);
      return exists ? prev.map(c => (c.id || c.cadet_id) === newCadet.id ? newCadet : c) : [...prev, newCadet];
    });

    // Reset printed state so new/modified batch must be printed before saving to DB
    setHasPrintedCurrentBatch(false);

    // Clear inputs after adding to local queue
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

  const handleAddToBatch = handleAddToQueue;

  const handleRemoveFromQueue = (index) => {
    setPrintQueue(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        setHasPrintedCurrentBatch(false);
      }
      return updated;
    });
  };

  const handleRemoveFromBatch = handleRemoveFromQueue;

  // 2. Print Execution Handler: Opens print view and unlocks Save to Database for current batch
  const handlePrintBatch = () => {
    if (!printQueue || printQueue.length === 0) {
      alert("Batch queue is empty. Please add cadet cards to the batch before printing.");
      return;
    }

    // Unlock Save to Database button for current batch
    setHasPrintedCurrentBatch(true);

    // Trigger Browser Print Dialog
    window.print();
  };

  // 3. Save Printed Cards to Database & Clear Them From Queue (Explicit User Action Only)
  const handleSaveToDatabase = async () => {
    if (!hasPrintedCurrentBatch || printQueue.length === 0) {
      alert("You must print the ID cards first before saving to Supabase!");
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

      // Explicit DB Insert Call via Supabase
      const client = getSupabaseClient();
      if (client) {
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
      alert(`Database save failed: ${err.message || "Please check connection."}`);
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
            {/* Category Segmented Switcher */}
            <div className="category-switcher">
              <button
                type="button"
                className={`switch-btn ${category === 'basic' ? 'active' : ''}`}
                onClick={() => handleCategorySwitch('basic')}
              >
                <Shield size={16} />
                <span>Basic Cadet</span>
              </button>

              <button
                type="button"
                className={`switch-btn ${category === 'officer' ? 'active' : ''}`}
                onClick={() => handleCategorySwitch('officer')}
              >
                <Award size={16} />
                <span>Cadet Officer</span>
              </button>
            </div>

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

            {/* Cadet ID & Rank */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-field-group">
                <label>Cadet ID</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="e.g., 221-00001"
                  maxLength={9}
                  value={cadetId}
                  onChange={(e) => handleIdChange(e.target.value)}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>Used for QR code rendering</span>
              </div>

              <div className="form-field-group">
                <label>Rank</label>
                {category === 'basic' ? (
                  <input
                    type="text"
                    className="custom-input"
                    value="Cadet"
                    disabled
                    style={{ backgroundColor: '#f3f4f6', color: 'var(--text-dark)', fontWeight: 600 }}
                  />
                ) : (
                  <select
                    className="custom-select"
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                  >
                    {officerRanks.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Basic Cadet Echelon Hierarchy Assignment */}
            {category === 'basic' && (
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
            )}

            {/* Cadet Officer: Single Designation Field (Replaces Bn, Co, Platoon) */}
            {category === 'officer' && (
              <div className="form-field-group">
                <label>Officer Designation / Position</label>
                <select
                  className="custom-select"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                >
                  {officerDesignations.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                  Rendered on Line 2 inside the green echelon badge
                </span>
              </div>
            )}

            {/* Add to Batch Queue Button */}
            <button
              type="button"
              onClick={handleAddToBatch}
              style={{
                marginTop: '0.65rem',
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#E5A900',
                color: '#0A192F',
                fontWeight: 700,
                fontSize: '0.88rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                border: 'none',
                boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#C68C00';
                e.currentTarget.style.boxShadow = '0px 6px 10px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#E5A900';
                e.currentTarget.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
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
    </div>
  );
}

export { IDGenerator as IdCardGenerator };
