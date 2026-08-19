import React, { useState, useEffect } from 'react';
import { Printer, Shield, Award, User, Sparkles, Plus, Trash2, Layers } from 'lucide-react';
import IDCardPreview from './IDCardPreview';
import { DEFAULT_OFFICER_RANKS, DEFAULT_OFFICER_DESIGNATIONS } from './AdminSettings';

export const OFFICER_DESIGNATIONS = DEFAULT_OFFICER_DESIGNATIONS;

export default function IDGenerator({ cadets = [] }) {
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

  // Print Mode state: 'single' | 'batch'
  const [printMode, setPrintMode] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_form');
      if (saved) return JSON.parse(saved).printMode || 'single';
    } catch (_) {}
    return 'single';
  });

  // Batch Cards Queue with LocalStorage Persistence
  const [batchQueue, setBatchQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_id_gen_batch_queue');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [
      { id: '221-11101', name: 'SANTOS, MARIA L', rank: 'Cadet', battalion: '1st Battalion', company: 'Alpha', platoon: '1st Platoon', designation: 'None', type: 'basic' },
      { id: '221-11102', name: 'DELA CRUZ, JUAN A', rank: 'Cadet', battalion: '1st Battalion', company: 'Alpha', platoon: '1st Platoon', designation: 'None', type: 'basic' },
      { id: '221-00101', name: 'BAUTISTA, MARK G', rank: 'Cadet COL (ROTC) 1CL', battalion: 'CADET OFFICERS', company: '1CL', platoon: 'Officer Corps', designation: 'Corps Commander', type: 'officer' },
      { id: '221-00104', name: 'CASTILLO, ELENA J', rank: 'Cadet MAJ (ROTC) 2CL', battalion: 'CADET OFFICERS', company: '2CL', platoon: 'Officer Corps', designation: 'S4 Brigade', type: 'officer' }
    ];
  });

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
        designation,
        printMode
      }));
    } catch (_) {}
  }, [category, lastName, firstName, middleInitial, cadetId, rank, battalion, company, platoon, designation, printMode]);

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

  const handleAddToBatch = () => {
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
      company: category === 'basic' ? company : officerClass,
      platoon: category === 'basic' ? platoon : (designation && designation !== 'None' ? designation : 'Corps Command Staff'),
      designation: category === 'basic' ? 'None' : designation,
      type: category
    };
    setBatchQueue(prev => [...prev, newCard]);
  };



  const handleRemoveFromBatch = (index) => {
    setBatchQueue(prev => prev.filter((_, idx) => idx !== index));
  };

  const handlePrint = () => {
    window.print();
  };

  let singleOfficerClass = '1CL';
  if (rank.includes('1CL')) singleOfficerClass = '1CL';
  else if (rank.includes('2CL')) singleOfficerClass = '2CL';
  else if (rank.includes('3CL')) singleOfficerClass = '3CL';
  else if (rank.includes('4CL')) singleOfficerClass = '4CL';
  else if (rank.includes('ASPIRANT') || rank.includes('COCC')) singleOfficerClass = 'ASPIRANT';

  const cardsToPrint = printMode === 'single' ? [
    {
      id: cadetId || '221-11101',
      name: fullName || 'SANTOS, MARIA L',
      rank: category === 'basic' ? 'Cadet' : rank,
      battalion: category === 'basic' ? (battalion || '1st Battalion') : 'CADET OFFICERS',
      company: category === 'basic' ? (company || 'Alpha') : singleOfficerClass,
      platoon: category === 'basic' ? (platoon || '1st Platoon') : (designation && designation !== 'None' ? designation : 'Corps Command Staff'),
      designation: category === 'basic' ? 'None' : designation,
      type: category
    }
  ] : batchQueue;

  return (
    <div className="id-generator-container">
      {/* Top Header Controls */}
      <div className="id-generator-header no-print">
        <div>
          <h1 className="page-heading">ROTC ID Card Generator</h1>
          <p className="page-subheading">Official CSU ROTC CR80 Double-Sided ID Cards with Echelon Badges & Scannable QR Codes</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="print-mode-toggle">
            <button
              className={`mode-btn ${printMode === 'single' ? 'active' : ''}`}
              onClick={() => setPrintMode('single')}
            >
              Single Card
            </button>
            <button
              className={`mode-btn ${printMode === 'batch' ? 'active' : ''}`}
              onClick={() => setPrintMode('batch')}
            >
              Batch Mode ({batchQueue.length} Cards)
            </button>
          </div>

          <button className="btn-print-action" onClick={handlePrint}>
            <Printer size={18} /> Print {printMode === 'single' ? 'ID Card' : `Batch (${batchQueue.length} Cards)`}
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

            {/* Add to Batch Queue Button (Batch Mode Only) */}
            {printMode === 'batch' && (
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
                <Plus size={18} style={{ strokeWidth: 2.5 }} /> Add Form Cadet to Batch Queue
              </button>
            )}



            {/* Batch Queue Manager */}
            {printMode === 'batch' && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={16} /> Batch Print Queue ({batchQueue.length})
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>4 Cards / A4 Sheet</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {batchQueue.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="queue-item-anim" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                      <div>
                        <strong>{item.id}</strong> - {item.name} <span style={{ color: 'var(--rotc-green-dark)', fontWeight: 600 }}>({item.company} Coy • {item.platoon})</span>
                      </div>
                      <button onClick={() => handleRemoveFromBatch(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }} title="Remove from batch queue">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live CR80 ID Card Preview */}
        <div className="preview-card-container">
          <div className="preview-card-header no-print">
            <Sparkles size={16} style={{ color: 'var(--rotc-green-dark)' }} />
            <span>LIVE ID CARD PREVIEW ({printMode === 'single' ? 'Single Front & Back' : `Batch ${batchQueue.length} Cards`})</span>
          </div>

          <div className="preview-display-wrapper">
            <div className="batch-print-grid">
              {cardsToPrint.map((card, idx) => (
                <IDCardPreview key={`${card.id}-${card.type}-${idx}`} card={card} />
              ))}
            </div>
          </div>

          <div className="preview-footer-note no-print">
            <Printer size={14} />
            <span>Tapping <strong>Print ID Card</strong> formats 4 double-sided cards per A4 page.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
