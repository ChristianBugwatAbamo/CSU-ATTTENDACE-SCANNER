import React, { useState, useEffect } from 'react';
import { UserCheck, Calendar, Clock, Building, Users, Play, Shield, Layers, CheckCircle2 } from 'lucide-react';

const OFFICER_RANKS = [
  'C/CPT (ROTC) 2CL',
  'C/CPT (ROTC) 3CL',
  'C/1LT (ROTC) 3CL',
  'C/1LT (ROTC) 4CL',
  'C/2LT (ROTC) 4CL',
  'C/MAJ (ROTC) 2CL',
  'C/LT COL (ROTC) 1CL',
  'C/COL (ROTC) 1CL',
  'C/CPT',
  'C/1LT',
  'C/2LT',
  'C/MAJ'
];

export default function SessionSetup({ initialSetup = {}, onStartSession, isEditing = false }) {
  // Parse initial duty officer string if formatted: "RANK LAST, FIRST MI" or "C/CPT Santos"
  const parseInitialDutyOfficer = (raw) => {
    if (!raw) return { rank: 'C/CPT (ROTC) 2CL', firstName: 'MARIA', middleInitial: 'L', lastName: 'SANTOS' };
    
    // Check if starts with a known rank prefix
    let matchedRank = 'C/CPT (ROTC) 2CL';
    let remaining = raw;

    for (const r of OFFICER_RANKS) {
      if (raw.startsWith(r)) {
        matchedRank = r;
        remaining = raw.slice(r.length).trim();
        break;
      }
    }

    if (remaining.startsWith('C/CPT') && matchedRank === 'C/CPT (ROTC) 2CL') {
      remaining = remaining.replace(/^C\/CPT\s*/, '').trim();
    }

    // Split Last, First MI if comma present
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

    return {
      rank: matchedRank,
      lastName: remaining.trim().toUpperCase() || 'SANTOS',
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

  const getFormattedDutyOfficer = () => {
    const l = oicLastName.trim().toUpperCase();
    const f = oicFirstName.trim().toUpperCase();
    const mi = oicMiddleInitial.trim().toUpperCase().replace(/\./g, '');
    
    if (l && f) {
      return `${oicRank} ${l}, ${f}${mi ? ` ${mi}` : ''}`;
    }
    if (l || f) {
      return `${oicRank} ${l || f}${mi ? ` ${mi}` : ''}`;
    }
    return `${oicRank} SANTOS`;
  };

  const handleMiddleInitialChange = (val) => {
    // Strip periods and limit to 2 characters without period
    const cleaned = val.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    setOicMiddleInitial(cleaned);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!oicLastName.trim() && !oicFirstName.trim()) {
      alert("Please enter Duty Officer Last Name and First Name.");
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
          Configure active duty officer, echelon hierarchy, and scan mode
        </p>
      </div>

      {/* Setup Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Officer In Charge (OIC) Section with Separate Fields */}
        <div style={{ background: 'rgba(0, 0, 0, 0.22)', padding: '0.9rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--rotc-yellow-gold)', marginBottom: '0.65rem' }}>
            <UserCheck size={16} /> Duty Officer-in-Charge (OIC) *
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {/* Rank / Class Dropdown */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', display: 'block', marginBottom: '3px' }}>
                Rank & Class *
              </label>
              <select
                className="setup-select"
                value={oicRank}
                onChange={(e) => setOicRank(e.target.value)}
              >
                {OFFICER_RANKS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
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
              OIC Title: <strong style={{ color: '#ffffff' }}>{getFormattedDutyOfficer()}</strong>
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

        {/* Battalion Selector (No Cadet Counts) */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
            <Layers size={14} /> Echelon / Battalion *
          </label>
          <select
            className="setup-select"
            value={battalion}
            onChange={(e) => setBattalion(e.target.value)}
          >
            <option value="1st Battalion">1st Battalion</option>
            <option value="2nd Battalion">2nd Battalion</option>
            <option value="Brigade HQ">Brigade HQ</option>
            <option value="All Battalions">All Battalions</option>
          </select>
        </div>

        {/* Company & Platoon Dropdowns (No Cadet Counts) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
              <Building size={14} /> Company *
            </label>
            <select
              className="setup-select"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="Alpha Company">Alpha Company</option>
              <option value="Bravo Company">Bravo Company</option>
              <option value="Charlie Company">Charlie Company</option>
              <option value="Delta Company">Delta Company</option>
              <option value="Headquarters">Headquarters (HQ)</option>
              <option value="All Companies">All Companies</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
              <Users size={14} /> Platoon *
            </label>
            <select
              className="setup-select"
              value={platoon}
              onChange={(e) => setPlatoon(e.target.value)}
            >
              <option value="1st Platoon">1st Platoon</option>
              <option value="2nd Platoon">2nd Platoon</option>
              <option value="3rd Platoon">3rd Platoon</option>
              <option value="4th Platoon">4th Platoon</option>
              <option value="All Platoons">All Platoons</option>
            </select>
          </div>
        </div>

        {/* Session Date & Auto-Synced System Clock */}
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

      {/* Footer Credit Line */}
      <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>
        GMA • Cpl Christian B Abamo PA (Res)
      </div>
    </div>
  );
}

export { SessionSetup as SettingsView };

