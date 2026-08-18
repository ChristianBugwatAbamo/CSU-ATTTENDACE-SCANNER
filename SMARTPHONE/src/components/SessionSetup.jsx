import React, { useState, useEffect } from 'react';
import { UserCheck, Calendar, Clock, Building, Users, Play, Shield, Layers, CheckCircle2, ChevronDown, X, Award, Check } from 'lucide-react';

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
  for (const group of OFFICER_CLASSES) {
    if (rankStr.includes(group.classKey)) {
      return group;
    }
  }
  return OFFICER_CLASSES[0];
};

export default function SessionSetup({ initialSetup = {}, onStartSession, isEditing = false }) {
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

  // Parse initial duty officer string if formatted: "C/LT COL MARIA L SANTOS (ROTC) 1CL" or legacy "C/LT COL (ROTC) 1CL SANTOS, MARIA L"
  const parseInitialDutyOfficer = (raw) => {
    if (!raw) return { rank: 'C/COL (ROTC) 1CL', firstName: 'MARIA', middleInitial: 'L', lastName: 'SANTOS' };

    let matchedRank = 'C/COL (ROTC) 1CL';
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
        lastName: (last || '').trim().toUpperCase() || 'SANTOS',
        firstName: (first || '').trim().toUpperCase() || 'MARIA',
        middleInitial: mi.slice(0, 2).toUpperCase() || 'L'
      };
    }

    // New format: FIRST [MI] LAST (e.g. "MARIA L SANTOS" or "MARIA SANTOS")
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
        firstName: 'MARIA',
        middleInitial: 'L'
      };
    }

    return {
      rank: matchedRank,
      lastName: 'SANTOS',
      firstName: 'MARIA',
      middleInitial: 'L'
    };
  };

  const parsedOic = parseInitialDutyOfficer(initialSetup.dutyOfficer);

  const [oicRank, setOicRank] = useState(parsedOic.rank);
  const [oicFirstName, setOicFirstName] = useState(parsedOic.firstName);
  const [oicMiddleInitial, setOicMiddleInitial] = useState(parsedOic.middleInitial);
  const [oicLastName, setOicLastName] = useState(parsedOic.lastName);

  const [sessionDate, setSessionDate] = useState(initialSetup.sessionDate || new Date().toISOString().split('T')[0]);
  const [battalion, setBattalion] = useState(initialSetup.battalion || '1st Battalion');
  const [company, setCompany] = useState(initialSetup.company || 'Alpha Company');
  const [platoon, setPlatoon] = useState(initialSetup.platoon || '1st Platoon');
  const [scanMode, setScanMode] = useState(initialSetup.scanMode || 'Time-In');

  useEffect(() => {
    if (initialSetup && initialSetup.dutyOfficer) {
      const p = parseInitialDutyOfficer(initialSetup.dutyOfficer);
      setOicRank(p.rank);
      setOicFirstName(p.firstName);
      setOicMiddleInitial(p.middleInitial);
      setOicLastName(p.lastName);
      setSessionDate(initialSetup.sessionDate || new Date().toISOString().split('T')[0]);
      setBattalion(initialSetup.battalion || '1st Battalion');
      setCompany(initialSetup.company || 'Alpha Company');
      setPlatoon(initialSetup.platoon || '1st Platoon');
      setScanMode(initialSetup.scanMode || 'Time-In');
    }
  }, [initialSetup]);

  // Format: [Rank Prefix] [First Name] [MI] [Last Name] [Branch/Class Suffix]
  // e.g. "C/LT COL MARIA L SANTOS (ROTC) 1CL"
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

    if (!nameParts) {
      return rankSuffix ? `${rankPrefix} SANTOS ${rankSuffix}` : `${rankPrefix} SANTOS`;
    }

    return rankSuffix
      ? `${rankPrefix} ${nameParts} ${rankSuffix}`
      : `${rankPrefix} ${nameParts}`;
  };

  const handleMiddleInitialChange = (val) => {
    const cleaned = val.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    setOicMiddleInitial(cleaned);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!oicLastName.trim() && !oicFirstName.trim()) {
      alert("Please enter Platoon Leader Last Name and First Name.");
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
        <div style={{ color: 'var(--rotc-yellow-gold)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '2px' }}>
          SCANNER CONFIGURATION
        </div>
        <h1 style={{ color: '#ffffff', fontSize: '1.4rem', fontWeight: 800, margin: 0, fontFamily: 'Oswald, sans-serif' }}>
          Field Session Settings
        </h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.78rem', margin: '2px 0 0 0' }}>
          Configure active platoon leader, echelon hierarchy, and scan mode
        </p>
      </div>

      {/* Setup Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Platoon Leader In Charge Section */}
        <div style={{ background: 'rgba(0, 0, 0, 0.22)', padding: '0.9rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--rotc-yellow-gold)', marginBottom: '0.65rem' }}>
            <UserCheck size={16} /> Platoon Leader In Charge *
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {/* Rank / Class Dropdown with Class Badge Highlights */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', display: 'block', marginBottom: '4px' }}>
                Rank & Class*
              </label>

              {/* Interactive Custom Rank Selector Trigger */}
              <button
                type="button"
                onClick={() => setIsRankModalOpen(true)}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1.5px solid rgba(255, 255, 255, 0.22)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  {/* Class Badge Highlight */}
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

                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {oicRank}
                  </span>
                </div>

                <ChevronDown size={18} style={{ color: 'var(--rotc-yellow-gold)', flexShrink: 0 }} />
              </button>
            </div>

            {/* Split Name Fields: Last Name, First Name, Middle Initial (No Period) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 65px', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', display: 'block', marginBottom: '3px' }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  className="setup-input"
                  placeholder="SANTOS"
                  value={oicLastName}
                  onChange={(e) => setOicLastName(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', display: 'block', marginBottom: '3px' }}>
                  First Name *
                </label>
                <input
                  type="text"
                  className="setup-input"
                  placeholder="MARIA"
                  value={oicFirstName}
                  onChange={(e) => setOicFirstName(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', display: 'block', marginBottom: '3px' }} title="Middle initial without period">
                  M.I.
                </label>
                <input
                  type="text"
                  className="setup-input"
                  placeholder="L"
                  maxLength={2}
                  value={oicMiddleInitial}
                  onChange={(e) => handleMiddleInitialChange(e.target.value)}
                  style={{ textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Live Name Preview */}
            <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
              Platoon Leader : <strong style={{ color: '#ffffff' }}>{getFormattedDutyOfficer()}</strong>
            </div>
          </div>
        </div>

        {/* Scan Mode Toggle (Time-In vs Time-Out Interactive Segmented Control) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--rotc-yellow-gold)', marginBottom: '6px' }}>
            Scan Mode *
          </label>
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

        {/* Battalion Selector */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
            <Layers size={14} /> Battalion / Unit *
          </label>
          <select
            className="setup-select"
            value={battalion}
            onChange={(e) => {
              const newBn = e.target.value;
              setBattalion(newBn);
              if (newBn === 'CADET OFFICERS') {
                if (!['1CL', '2CL', '3CL', '4CL', 'ASPIRANT'].includes(company)) {
                  setCompany('1CL');
                }
                setPlatoon('Officer Corps');
              } else if (['1CL', '2CL', '3CL', '4CL', 'ASPIRANT'].includes(company)) {
                setCompany('Alpha Company');
                setPlatoon('1st Platoon');
              }
            }}
          >
            <option value="1st Battalion">1st Battalion</option>
            <option value="2nd Battalion">2nd Battalion</option>
            <option value="CADET OFFICERS">CADET OFFICERS</option>
            <option value="All Battalions">All Units / Battalions</option>
          </select>
        </div>

        {/* Company & Platoon Dropdowns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
              <Building size={14} /> {battalion === 'CADET OFFICERS' ? 'Officer Class *' : 'Company *'}
            </label>
            <select
              className="setup-select"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              {battalion === 'CADET OFFICERS' ? (
                <>
                  <option value="1CL">1CL (First Class Officers)</option>
                  <option value="2CL">2CL (Second Class Officers)</option>
                  <option value="3CL">3CL (Third Class Officers)</option>
                  <option value="4CL">4CL (Fourth Class Officers)</option>
                  <option value="ASPIRANT">ASPIRANT (Officer Candidates)</option>
                  <option value="All Officer Classes">All Officer Classes</option>
                </>
              ) : (
                <>
                  <option value="Alpha Company">Alpha Company</option>
                  <option value="Bravo Company">Bravo Company</option>
                  <option value="Charlie Company">Charlie Company</option>
                  <option value="Delta Company">Delta Company</option>
                  <option value="Headquarters">Headquarters (HQ)</option>
                  <option value="All Companies">All Companies</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
              <Users size={14} /> {battalion === 'CADET OFFICERS' ? 'Formation / Staff *' : 'Platoon *'}
            </label>
            <select
              className="setup-select"
              value={platoon}
              onChange={(e) => setPlatoon(e.target.value)}
            >
              {battalion === 'CADET OFFICERS' ? (
                <>
                  <option value="Officer Corps">Officer Corps</option>
                  <option value="Command Staff">Command Staff</option>
                  <option value="Special Staff">Special Staff</option>
                  <option value="All Officers">All Officers</option>
                </>
              ) : (
                <>
                  <option value="1st Platoon">1st Platoon</option>
                  <option value="2nd Platoon">2nd Platoon</option>
                  <option value="3rd Platoon">3rd Platoon</option>
                  <option value="4th Platoon">4th Platoon</option>
                  <option value="All Platoons">All Platoons</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Session Date & System Clock */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
            <Calendar size={14} /> Session Date & System Clock
          </label>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <input
              type="date"
              className="setup-input"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              style={{ flex: 1 }}
            />
            <div style={{
              background: 'rgba(0, 0, 0, 0.28)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '0.75rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--rotc-yellow-gold)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Clock size={14} />
              <span>LIVE CLOCK</span>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
            ⚡ Scans automatically log exact smartphone system time in real-time.
          </div>
        </div>

        {/* Save & Apply Yellow Portal Button */}
        <button
          type="submit"
          className="setup-gold-btn"
          style={{ marginTop: '0.5rem' }}
        >
          <Play size={18} />
          <span>Save & Apply Scanner Setup</span>
        </button>
      </form>

      {/* Grouped Rank & Class Selection Modal with Full Vertical Scrolling */}
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
            background: 'rgba(0, 15, 8, 0.82)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '430px',
            maxHeight: '82vh',
            height: 'auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            border: '1px solid var(--border-light)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#064e2e',
              color: '#ffffff',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontFamily: 'Oswald, sans-serif', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                <Award size={20} color="var(--rotc-yellow-gold)" />
                <span>SELECT OFFICER RANK & CLASS</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRankModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Grouped List with explicit touch and overflow settings */}
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
              gap: '0.9rem'
            }}>
              {OFFICER_CLASSES.map((classGroup) => (
                <div key={classGroup.classKey} style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                  {/* Class Group Header Badge Banner */}
                  <div style={{
                    padding: '0.45rem 0.85rem',
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
                      background: 'rgba(255, 255, 255, 0.75)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: `1px solid ${classGroup.badgeBorder}`
                    }}>
                      Class {classGroup.classKey}
                    </span>
                  </div>

                  {/* Ranks inside Class Group */}
                  <div style={{ padding: '0.4rem 0.5rem' }}>
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
                            padding: '0.7rem 0.8rem',
                            borderRadius: '8px',
                            border: isSelected ? '1.5px solid var(--rotc-green-dark)' : '1px solid #e2e8f0',
                            background: isSelected ? '#ecfdf5' : '#ffffff',
                            marginBottom: '6px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: isSelected ? '0 2px 6px rgba(6, 78, 46, 0.15)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: isSelected ? 'var(--rotc-green-dark)' : 'var(--text-dark)' }}>
                              {r.label}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                              {r.title}
                            </div>
                          </div>

                          {isSelected && (
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'var(--rotc-green-dark)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Check size={15} />
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
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right', flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsRankModalOpen(false)}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export { SessionSetup as SettingsView };
