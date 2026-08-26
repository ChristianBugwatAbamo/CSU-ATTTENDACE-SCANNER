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
    } catch (_) {}
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
    } catch (e) {}
    return DEFAULT_OFFICER_RANKS;
  });

  const [officerDesignations, setOfficerDesignations] = useState(() => {
    try {
      const local = localStorage.getItem('csu_rotc_admin_settings');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.officerDesignations && parsed.officerDesignations.length > 0) return parsed.officerDesignations;
      }
    } catch (e) {}
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
      } catch (e) {}
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
      } catch (e) {}
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
    } catch (_) {}
    return '';
  });

  const [firstName, setFirstName] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).firstName || '';
    } catch (_) {}
    return '';
  });

  const [middleInitial, setMiddleInitial] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).middleInitial || '';
    } catch (_) {}
    return '';
  });

  // Cadet ID, Rank, Echelon State with LocalStorage Persistence
  const [cadetId, setCadetId] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).cadetId || '';
    } catch (_) {}
    return '';
  });

  const [rank, setRank] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).rank || 'Cadet';
    } catch (_) {}
    return 'Cadet';
  });

  const [battalion, setBattalion] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).battalion || '1st Battalion';
    } catch (_) {}
    return '1st Battalion';
  });

  const [company, setCompany] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).company || 'Alpha';
    } catch (_) {}
    return 'Alpha';
  });

  const [platoon, setPlatoon] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).platoon || '1st Platoon';
    } catch (_) {}
    return '1st Platoon';
  });

  const [designation, setDesignation] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).designation || 'None';
    } catch (_) {}
    return 'None';
  });

  // Batch Cards Queue with LocalStorage Persistence
  const [batchQueue, setBatchQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_batch_queue');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

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
    } catch (_) {}
  }, [category, lastName, firstName, middleInitial, cadetId, rank, battalion, company, platoon, designation]);

  // Synchronize Batch Print Queue to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('csu_rotc_id_gen_batch_queue', JSON.stringify(batchQueue));
    } catch (_) {}
  }, [batchQueue]);

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

  const handleAddToBatch = async () => {
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

    const newCard = {
      id: cadetId,
      name: fullName,
      rank: category === 'basic' ? 'Cadet' : rank,
      battalion: category === 'basic' ? battalion : 'CADET OFFICERS',
      company: category === 'basic' ? normalizeCompany(company) : officerClass,
      platoon: category === 'basic' ? platoon : (designation && designation !== 'None' ? designation : 'Corps Command Staff'),
      designation: category === 'basic' ? 'None' : designation,
      type: normalizeCadetType(category, rank),
      is_active: true
    };

    // Immediately upsert into Supabase `cadets` table
    try {
      setIsSaving(true);
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('cadets')
          .upsert([newCard], { onConflict: 'id' });

        if (error) {
          console.error("Supabase upsert error:", error);
          alert("Warning: Could not save cadet to database: " + error.message);
        } else {
          setToastMessage({
            type: 'SUCCESS',
            message: `Cadet ${cadetId} (${fullName}) saved to Supabase & added to queue!`,
          });
          setTimeout(() => setToastMessage(null), 3500);
        }
      }

      if (typeof refreshCadetsRoster === 'function') refreshCadetsRoster();
      if (typeof onRefresh === 'function') onRefresh();
      window.dispatchEvent(new Event('local-attendance-update'));

      // Add to batch queue for printing
      setBatchQueue(prev => {
        const exists = prev.some(c => (c.id || c.cadet_id) === cadetId);
        return exists ? prev.map(c => (c.id || c.cadet_id) === cadetId ? newCard : c) : [...prev, newCard];
      });

    } catch (err) {
      console.error("Error saving cadet:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFromBatch = (index) => {
    setBatchQueue(prev => prev.filter((_, idx) => idx !== index));
  };

  // Supabase Sync + Print Execution Handler
  const handlePrintAndSaveCadets = async () => {
    try {
      if (!batchQueue || batchQueue.length === 0) {
        alert("Batch queue is empty. Please add cadet cards to the batch before printing.");
        return;
      }

      // Format cadet objects for Supabase cadets table
      const formattedCadets = batchQueue.map((c) => ({
        id: c.id || c.cadet_id || c.cadetId,
        name: c.name || `${c.last_name || ''}, ${c.first_name || ''} ${c.middle_initial || ''}`.trim(),
        rank: c.rank || (normalizeCadetType(c.type, c.rank) === 'Cadet Officer' ? 'Cadet Officer' : 'Cadet'),
        battalion: c.battalion || '1st Battalion',
        company: normalizeCompany(c.company),
        platoon: c.platoon || '1st Platoon',
        type: normalizeCadetType(c.type, c.rank),
        designation: c.designation || 'N/A',
        is_active: true
      }));

      // Upsert records into Supabase `cadets` table
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('cadets')
          .upsert(formattedCadets, { onConflict: 'id' });

        if (error) {
          console.error("Failed to sync cadets to Supabase:", error);
          alert("Warning: Could not save cadet records to database before printing.");
          return;
        }
      }

      // Trigger local state refresh so it reflects on Cadets Roster immediately
      if (typeof refreshCadetsRoster === 'function') {
        refreshCadetsRoster();
      }
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
      window.dispatchEvent(new Event('local-attendance-update'));

      // Trigger Browser Print Dialog after successful database save
      window.print();

    } catch (err) {
      console.error("Print and save execution error:", err);
    }
  };

  // Function to save batch queue to Supabase and reset queue
  const handleSaveBatchToDatabase = async () => {
    if (!batchQueue || batchQueue.length === 0) {
      alert("Batch print queue is empty.");
      return;
    }

    try {
      setIsSaving(true);

      // Format cadet records for Supabase `cadets` table
      const formattedCadets = batchQueue.map((cadet) => ({
        id: cadet.id || cadet.cadet_id || cadet.cadetId,
        name: cadet.name || `${cadet.last_name || ''}, ${cadet.first_name || ''} ${cadet.middle_initial || ''}`.trim(),
        rank: cadet.rank || (normalizeCadetType(cadet.type, cadet.rank) === 'Cadet Officer' ? 'Cadet Officer' : 'Cadet'),
        battalion: cadet.battalion || '1st Battalion',
        company: normalizeCompany(cadet.company),
        platoon: cadet.platoon || '1st Platoon',
        type: normalizeCadetType(cadet.type, cadet.rank),
        designation: cadet.designation || 'N/A',
        is_active: true
      }));

      // Upsert into Supabase (insert or update existing profiles)
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('cadets')
          .upsert(formattedCadets, { onConflict: 'id' });

        if (error) throw error;
      }

      // Show Success Alert Notification
      setToastMessage({
        type: 'SUCCESS',
        message: `Successfully saved ${batchQueue.length} cadets to Database!`,
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

      // AUTOMATICALLY CLEAR THE BATCH PRINT QUEUE AFTER SAVING
      setBatchQueue([]);

    } catch (err) {
      console.error("Error saving batch queue to Supabase:", err);
      alert("Failed to save batch to database. Please check connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const cardsToPrint = batchQueue;

  return (
    <div className="id-generator-container">
      {/* Top Header Controls */}
      <div className="id-generator-header no-print">
        <div>
          <h1 className="page-heading">ROTC ID Card Generator</h1>
          <p className="page-subheading">Official CSU ROTC CR80 Double-Sided ID Cards with Echelon Badges & Scannable QR Codes</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn-print-action" onClick={handlePrintAndSaveCadets}>
            <Printer size={18} /> Print Batch ({batchQueue.length} {batchQueue.length === 1 ? 'Card' : 'Cards'})
          </button>
        </div>
      </div>

      {/* 2-Column Grid Layout */}
      <div className="id-generator-grid">

        {/* Left Column: Cadet Information Form */}
        <div className="form-card-container no-print">
          <div className="form-card-header">
            <User size={18} />
            <span>Cadet & Echelon Information</span>
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
                <label>Last Name *</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="e.g., DELA CRUZ"
                  value={lastName}
                  onChange={(e) => handleLastNameChange(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label>First Name *</label>
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
                <label>Cadet ID (221-XXXXX) *</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="e.g., 221-00001"
                  maxLength={9}
                  value={cadetId}
                  onChange={(e) => handleIdChange(e.target.value)}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>Format: 221-XXXXX (Used for QR code rendering)</span>
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
                  <label>Platoon (37)</label>
                  <select
                    className="custom-select"
                    value={platoon}
                    onChange={(e) => setPlatoon(e.target.value)}
                  >
                    <option value="1st Platoon">1st Pltn</option>
                    <option value="2nd Platoon">2nd Pltn</option>
                    <option value="3rd Platoon">3rd Pltn</option>
                    <option value="4th Platoon">4th Pltn</option>
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
              <Plus size={18} style={{ strokeWidth: 2.5 }} /> Save to Supabase & Add to Queue
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

                  {/* Save to Database Button */}
                  <button
                    type="button"
                    onClick={handleSaveBatchToDatabase}
                    disabled={batchQueue.length === 0 || isSaving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: '#065f46',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: batchQueue.length === 0 || isSaving ? 'not-allowed' : 'pointer',
                      opacity: batchQueue.length === 0 || isSaving ? 0.55 : 1,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (batchQueue.length > 0 && !isSaving) e.currentTarget.style.background = '#044e3a';
                    }}
                    onMouseLeave={(e) => {
                      if (batchQueue.length > 0 && !isSaving) e.currentTarget.style.background = '#065f46';
                    }}
                  >
                    <Database size={13} />
                    <span>{isSaving ? 'Saving...' : 'Save to Database'}</span>
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
          <div className="preview-card-header no-print">
            <Sparkles size={16} style={{ color: 'var(--rotc-green-dark)' }} />
            <span>LIVE ID CARD PREVIEW (Batch {batchQueue.length} {batchQueue.length === 1 ? 'Card' : 'Cards'})</span>
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
