import React, { useState } from 'react';
import { UserCheck, Calendar, Clock, Building, Users, Play, Shield, Layers, Compass } from 'lucide-react';

export default function SessionSetup({ initialSetup, onStartSession }) {
  const [dutyOfficer, setDutyOfficer] = useState(initialSetup.dutyOfficer || 'C/CPT Santos');
  const [sessionDate, setSessionDate] = useState(initialSetup.sessionDate || new Date().toISOString().split('T')[0]);
  const [sessionTime, setSessionTime] = useState(initialSetup.sessionTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [battalion, setBattalion] = useState(initialSetup.battalion || '1st Battalion');
  const [company, setCompany] = useState(initialSetup.company || 'Alpha Company');
  const [platoon, setPlatoon] = useState(initialSetup.platoon || '1st Platoon');
  const [scanMode, setScanMode] = useState(initialSetup.scanMode || 'Time-In');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!dutyOfficer.trim()) {
      alert("Please enter Duty Officer Name.");
      return;
    }
    onStartSession({
      dutyOfficer,
      sessionDate,
      sessionTime,
      battalion,
      company,
      platoon,
      scanMode
    });
  };

  return (
    <div className="setup-landing-wrapper">
      <div className="setup-portal-card">
        
        {/* ROTC Unit Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <img
            src="./rotc-seal-transparent.png"
            alt="CSU ROTC Unit Seal"
            style={{ width: '85px', height: '85px', objectFit: 'contain', background: 'transparent', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))' }}
          />
        </div>

        {/* Headquarters Header Info */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ color: 'var(--rotc-yellow-gold)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
            BRIGADE HEADQUARTERS
          </div>
          <h1 style={{ color: '#ffffff', fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.25, margin: '0 0 6px 0' }}>
            Caraga State University<br />
            Main Campus<br />
            ROTC Unit
          </h1>
          <div style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.3 }}>
            <div>Attendance & Field Scanner System</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: '2px' }}>1501st CDC • 15th RCDG • ARESCOM</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>Ampayon, Butuan City</div>
          </div>
        </div>

        {/* Chain of Command & Unit Strength Pill */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(229, 169, 0, 0.3)',
          borderRadius: '10px',
          padding: '0.65rem 0.75rem',
          marginBottom: '1.25rem',
          fontSize: '0.73rem',
          color: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ color: 'var(--rotc-yellow-gold)', fontWeight: 800 }}>UNIT STRENGTH: 1,184 CADETS</div>
            <div style={{ opacity: 0.8, fontSize: '0.68rem' }}>2 Battalions • 4 Coys/Bn • 37 Cadets/Platoon</div>
          </div>
          <div style={{ background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '9999px', fontWeight: 800, fontSize: '0.68rem' }}>
            37 / PLTN
          </div>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          
          {/* Duty Officer Name */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
              <UserCheck size={14} /> Duty Officer-in-Charge (OIC) *
            </label>
            <input
              type="text"
              className="setup-input"
              placeholder="e.g. C/CPT Santos"
              value={dutyOfficer}
              onChange={(e) => setDutyOfficer(e.target.value)}
            />
          </div>

          {/* Scan Mode Toggle (Time-In vs Time-Out) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '6px' }}>
              Scan Mode *
            </label>
            <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.3)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  background: scanMode === 'Time-In' ? '#059669' : 'transparent',
                  color: scanMode === 'Time-In' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setScanMode('Time-In')}
              >
                🟢 TIME-IN
              </button>

              <button
                type="button"
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  background: scanMode === 'Time-Out' ? 'var(--rotc-yellow-gold)' : 'transparent',
                  color: scanMode === 'Time-Out' ? 'var(--text-dark)' : 'rgba(255, 255, 255, 0.6)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setScanMode('Time-Out')}
              >
                🟡 TIME-OUT
              </button>
            </div>
          </div>

          {/* Battalion Selector */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
              <Layers size={14} /> Echelon / Battalion *
            </label>
            <select
              className="setup-select"
              value={battalion}
              onChange={(e) => setBattalion(e.target.value)}
            >
              <option value="1st Battalion">1st Battalion (592 Cadets)</option>
              <option value="2nd Battalion">2nd Battalion (592 Cadets)</option>
              <option value="Brigade HQ">Brigade HQ (Staff & Officers)</option>
              <option value="All Battalions">All Battalions</option>
            </select>
          </div>

          {/* Company & Platoon Dropdowns */}
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
                <Users size={14} /> Platoon (37 Fixed) *
              </label>
              <select
                className="setup-select"
                value={platoon}
                onChange={(e) => setPlatoon(e.target.value)}
              >
                <option value="1st Platoon">1st Platoon (37)</option>
                <option value="2nd Platoon">2nd Platoon (37)</option>
                <option value="3rd Platoon">3rd Platoon (37)</option>
                <option value="4th Platoon">4th Platoon (37)</option>
                <option value="All Platoons">All Platoons (148)</option>
              </select>
            </div>
          </div>

          {/* Session Date & Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
                <Calendar size={14} /> Date
              </label>
              <input
                type="date"
                className="setup-input"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)', marginBottom: '4px' }}>
                <Clock size={14} /> Time
              </label>
              <input
                type="text"
                className="setup-input"
                placeholder="07:30 AM"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
            </div>
          </div>

          {/* Start Session Gold Portal Button */}
          <button
            type="submit"
            className="setup-gold-btn"
          >
            <Play size={18} />
            <span>Start Field Scanner Session</span>
          </button>
        </form>

        {/* Footer Credit Line */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>
          GMA • Cpl Christian B Abamo PA (Res)
        </div>

      </div>
    </div>
  );
}
