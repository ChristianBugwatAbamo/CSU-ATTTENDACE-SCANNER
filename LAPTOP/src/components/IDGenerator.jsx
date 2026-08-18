import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Shield, Award, User, Sparkles, Plus, Trash2, Layers, Building, Users } from 'lucide-react';

export default function IDGenerator({ cadets = [] }) {
  // Category state: 'basic' | 'officer'
  const [category, setCategory] = useState('basic');

  // Split Name Fields State
  const [lastName, setLastName] = useState('SANTOS');
  const [firstName, setFirstName] = useState('MARIA');
  const [middleInitial, setMiddleInitial] = useState('L.');

  // Cadet ID, Rank, Echelon State
  const [cadetId, setCadetId] = useState('221-11101');
  const [rank, setRank] = useState('Cadet');
  const [battalion, setBattalion] = useState('1st Battalion');
  const [company, setCompany] = useState('Alpha');
  const [platoon, setPlatoon] = useState('1st Platoon');
  const [designation, setDesignation] = useState('None');

  // Batch import helper selectors
  const [batchBn, setBatchBn] = useState('1st Battalion');
  const [batchCo, setBatchCo] = useState('Alpha');
  const [batchPl, setBatchPl] = useState('1st Platoon');

  // Print Mode state: 'single' | 'batch'
  const [printMode, setPrintMode] = useState('single');

  // Batch Cards Queue
  const [batchQueue, setBatchQueue] = useState([
    { id: '221-11101', name: 'SANTOS, MARIA L.', rank: 'Cadet', battalion: '1st Battalion', company: 'Alpha', platoon: '1st Platoon', designation: 'None', type: 'basic' },
    { id: '221-11102', name: 'DELA CRUZ, JUAN A.', rank: 'Cadet', battalion: '1st Battalion', company: 'Alpha', platoon: '1st Platoon', designation: 'None', type: 'basic' },
    { id: '221-00101', name: 'BAUTISTA, MARK G.', rank: 'Cadet COL (ROTC) 1CL', battalion: 'CADET OFFICERS', company: '1CL', platoon: 'Officer Corps', designation: 'Corps Commander', type: 'officer' },
    { id: '221-00104', name: 'CASTILLO, ELENA J.', rank: 'Cadet MAJ (ROTC) 2CL', battalion: 'CADET OFFICERS', company: '2CL', platoon: 'Officer Corps', designation: 'S4 Brigade', type: 'officer' }
  ]);

  const officerRanks = [
    'Cadet 2LT (ROTC) 4CL',
    'Cadet 1LT (ROTC) 4CL',
    'Cadet 1LT (ROTC) 3CL',
    'Cadet CPT (ROTC) 3CL',
    'Cadet CPT (ROTC) 2CL',
    'Cadet MAJ (ROTC) 2CL',
    'Cadet LT COL (ROTC) 1CL',
    'Cadet COL (ROTC) 1CL'
  ];

  const officerDesignations = [
    'None',
    'Corps Commander',
    'Deputy Commander',
    'Adjutant',
    'S1 Brigade',
    'S2 Brigade',
    'S3 Brigade',
    'S4 Brigade',
    'S7 Brigade',
    '1st Bn Commander',
    '2nd Bn Commander',
    'Alpha Coy Commander',
    'Bravo Coy Commander',
    'Charlie Coy Commander',
    'Delta Coy Commander',
    'Platoon Leader'
  ];

  // Helper: Format combined Full Name: LAST NAME, FIRST NAME MIDDLE INITIAL
  const getFormattedFullName = () => {
    const last = lastName.trim().toUpperCase();
    const first = firstName.trim().toUpperCase();
    let mi = middleInitial.trim().toUpperCase();

    if (mi && !mi.endsWith('.')) {
      mi = `${mi}.`;
    }

    if (!last && !first) return 'SANTOS, MARIA L.';
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
      setRank('Cadet 2LT (ROTC) 4CL');
      setBattalion('CADET OFFICERS');
      setCompany('1CL');
      setPlatoon('Officer Corps');
      setDesignation('None');
    }
  };

  const handleLastNameChange = (val) => {
    setLastName(val.toUpperCase());
  };

  const handleFirstNameChange = (val) => {
    setFirstName(val.toUpperCase());
  };

  const handleMiddleInitialChange = (val) => {
    const cleaned = val.toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 3);
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
    const newCard = {
      id: cadetId,
      name: fullName,
      rank: category === 'basic' ? 'Cadet' : rank,
      battalion: battalion,
      company: company,
      platoon: platoon,
      designation: category === 'basic' ? 'None' : designation,
      type: category
    };
    setBatchQueue(prev => [...prev, newCard]);
  };

  // Quick Load Entire 37-Cadet Platoon from Roster
  const handleLoadPlatoonFromRoster = () => {
    const matching = cadets.filter(c => 
      (c.battalion === batchBn) && 
      (c.company === batchCo) && 
      (c.platoon === batchPl)
    );

    if (matching.length === 0) {
      alert(`No registered cadets found for ${batchBn} • ${batchCo} Company • ${batchPl}. You can generate the full roster from Master Cadet Directory.`);
      return;
    }

    const formattedCards = matching.map(c => ({
      id: c.id,
      name: c.name,
      rank: c.rank || 'Cadet',
      battalion: c.battalion || batchBn,
      company: c.company || batchCo,
      platoon: c.platoon || batchPl,
      designation: c.designation || 'None',
      type: c.type === 'Cadet Officer' ? 'officer' : 'basic'
    }));

    setBatchQueue(formattedCards);
    setPrintMode('batch');
    alert(`Loaded all ${formattedCards.length} cadets of ${batchBn} - ${batchCo} Coy (${batchPl}) into Batch Print Queue!`);
  };

  const handleRemoveFromBatch = (index) => {
    setBatchQueue(prev => prev.filter((_, idx) => idx !== index));
  };

  const handlePrint = () => {
    window.print();
  };

  const cardsToPrint = printMode === 'single' ? [
    {
      id: cadetId || '221-11101',
      name: fullName || 'SANTOS, MARIA L.',
      rank: category === 'basic' ? 'Cadet' : rank,
      battalion: battalion || '1st Battalion',
      company: company || 'Alpha',
      platoon: platoon || '1st Platoon',
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
                  placeholder="SANTOS"
                  value={lastName}
                  onChange={(e) => handleLastNameChange(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label>First Name *</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="MARIA"
                  value={firstName}
                  onChange={(e) => handleFirstNameChange(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label>M.I.</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="L."
                  maxLength={3}
                  value={middleInitial}
                  onChange={(e) => handleMiddleInitialChange(e.target.value)}
                />
              </div>
            </div>

            {/* Cadet ID & Rank */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-field-group">
                <label>Cadet ID (221-XXXXX)</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder="221-11101"
                  maxLength={9}
                  value={cadetId}
                  onChange={(e) => handleIdChange(e.target.value)}
                />
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

            {/* Echelon Hierarchy Assignment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
              <div className="form-field-group">
                <label>Battalion / Unit</label>
                <select
                  className="custom-select"
                  value={battalion}
                  onChange={(e) => setBattalion(e.target.value)}
                >
                  <option value="1st Battalion">1st Battalion</option>
                  <option value="2nd Battalion">2nd Battalion</option>
                  <option value="CADET OFFICERS">CADET OFFICERS</option>
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
                  <option value="Headquarters">HQ</option>
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

            {/* Designation Input (Only for Cadet Officer) */}
            {category === 'officer' && (
              <div className="form-field-group">
                <label>Designation</label>
                <select
                  className="custom-select"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                >
                  {officerDesignations.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
              onClick={handleAddToBatch}
            >
              <Plus size={16} /> Add Form Cadet to Batch Queue
            </button>

            {/* Quick Platoon Batch Import Section */}
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.5rem' }}>
                <Sparkles size={15} /> Quick Load Entire Platoon Batch (37 Cadets)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select className="custom-select" value={batchBn} onChange={(e) => setBatchBn(e.target.value)}>
                  <option value="1st Battalion">1st Bn</option>
                  <option value="2nd Battalion">2nd Bn</option>
                </select>
                <select className="custom-select" value={batchCo} onChange={(e) => setBatchCo(e.target.value)}>
                  <option value="Alpha">Alpha Coy</option>
                  <option value="Bravo">Bravo Coy</option>
                  <option value="Charlie">Charlie Coy</option>
                  <option value="Delta">Delta Coy</option>
                </select>
                <select className="custom-select" value={batchPl} onChange={(e) => setBatchPl(e.target.value)}>
                  <option value="1st Platoon">1st Pltn</option>
                  <option value="2nd Platoon">2nd Pltn</option>
                  <option value="3rd Platoon">3rd Pltn</option>
                  <option value="4th Platoon">4th Pltn</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.82rem', justifyContent: 'center', padding: '0.5rem' }}
                onClick={handleLoadPlatoonFromRoster}
              >
                <Users size={14} /> Load 37 Cadets into Batch Queue
              </button>
            </div>

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
                <div key={`${card.id}-${card.type}-${idx}`} className="double-sided-card-pair card-category-transition">

                  {/* FRONT SIDE OF CR80 CARD */}
                  <div className="cr80-id-card printable-card front-card">
                    {/* Header Bar */}
                    <div className="cr80-header">
                      <img src="/rotc-seal-transparent.png" alt="ROTC Seal" className="cr80-logo-img" style={{ width: '40px', height: '40px', objectFit: 'contain', background: 'transparent' }} />
                      <div className="cr80-header-titles">
                        <div className="sub-title">ARESCOM • 15TH RCDG</div>
                        <div className="main-title">1501st CDC ROTC UNIT</div>
                        <div className="campus-title">CARAGA STATE UNIVERSITY MAIN CAMPUS</div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="cr80-body">
                      {/* Official Photo Avatar Box */}
                      <div className="cr80-photo-box">
                        <User size={34} color="#9ca3af" />
                        <span className="photo-label">OFFICIAL ID</span>
                      </div>

                      {/* Cadet Details */}
                      <div className="cr80-info">
                        <div className="cr80-name">{card.name || 'SANTOS, MARIA L.'}</div>
                        <div className="cr80-rank">{card.rank || 'Cadet'}</div>
                        
                        {/* Echelon Badge */}
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--rotc-green-dark)', background: 'rgba(6,78,46,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', margin: '2px 0' }}>
                          {card.type === 'officer' || card.battalion === 'CADET OFFICERS' || card.battalion === 'Brigade HQ'
                            ? `CADET OFFICERS • ${card.company || '1CL'} • ${card.platoon || 'Officer Corps'}`
                            : `${card.battalion || '1st Bn'} • ${card.company || 'Alpha'} Coy • ${card.platoon || '1st Pltn'}`}
                        </div>

                        {card.designation && card.designation !== 'None' && (
                          <div className="cr80-designation">{card.designation}</div>
                        )}
                        <div className="cr80-id-no">
                          <span>ID NO:</span> <strong>{card.id || '221-11101'}</strong>
                        </div>
                      </div>

                      {/* Scannable QR Code (Encodes ID and Full Name) */}
                      <div className="cr80-qr-section">
                        <div className="qr-wrapper">
                          <QRCodeSVG
                            value={JSON.stringify({
                              id: card.id || '221-11101',
                              name: card.name || 'SANTOS, MARIA L.'
                            })}
                            size={64}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <div className="qr-caption">QR CODE</div>
                      </div>
                    </div>

                    {/* Motto Footer Bar */}
                    <div className="cr80-footer">
                      <span>HONOR • PATRIOTISM • DUTY</span>
                    </div>
                  </div>

                  {/* BACK SIDE OF CR80 CARD */}
                  <div className="cr80-id-card printable-card back-card">
                    <div className="cr80-header" style={{ background: '#111827' }}>
                      <div style={{ textAlign: 'center', width: '100%', fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', color: '#ffffff', letterSpacing: '0.5px' }}>
                        OFFICIAL ROTC CADET IDENTIFICATION
                      </div>
                    </div>

                    <div className="cr80-back-body">
                      <p className="back-notice">This card certifies that the person named on the front is an officially enrolled cadet of CSU ROTC Unit.</p>

                      <div className="back-emergency-section">
                        <div className="emerg-title">IN CASE OF EMERGENCY NOTIFY:</div>
                        <div className="emerg-detail">CSU ROTC Commandant Office / Duty Sergeant</div>
                        <div className="emerg-detail">Unit Strength: 1,184 Cadets • 1501st CDC</div>
                      </div>

                      <div className="back-signature-box">
                        <div className="sig-line"></div>
                        <div className="sig-label">ROTC COMMANDANT SIGNATURE</div>
                      </div>
                    </div>

                    <div className="cr80-footer">
                      <span>HONOR • PATRIOTISM • DUTY</span>
                    </div>
                  </div>

                </div>
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
