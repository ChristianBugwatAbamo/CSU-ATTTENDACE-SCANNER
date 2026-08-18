import React, { useState } from 'react';
import { Settings, Wifi, Server, Shield, User, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Smartphone, Info } from 'lucide-react';

export default function MobileSettings({
  adminIp,
  onUpdateAdminIp,
  sessionSetup,
  onUpdateSessionSetup,
  serverConnected,
  offlineQueue = [],
  onResetQueue,
  onEditSetup
}) {
  const [ipInput, setIpInput] = useState(adminIp || 'http://192.168.1.100:8080');
  const [dutyOfficer, setDutyOfficer] = useState(sessionSetup?.dutyOfficer || 'C/CPT Santos');
  const [battalion, setBattalion] = useState(sessionSetup?.battalion || '1st Battalion');
  const [company, setCompany] = useState(sessionSetup?.company || 'Alpha Company');
  const [platoon, setPlatoon] = useState(sessionSetup?.platoon || '1st Platoon');
  const [scanMode, setScanMode] = useState(sessionSetup?.scanMode || 'Time-In');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const handleSaveIp = () => {
    onUpdateAdminIp(ipInput);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleTestConnection = async () => {
    setPingTesting(true);
    setPingResult(null);
    try {
      const endpoint = `${ipInput.replace(/\/$/, '')}/api/health`;
      const res = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        setPingResult({ success: true, message: 'Laptop Admin HQ server reachable!' });
      } else {
        setPingResult({ success: false, message: `Server responded with status ${res.status}` });
      }
    } catch (err) {
      setPingResult({ success: false, message: 'Connection failed. Check Wi-Fi / IP port 8080.' });
    } finally {
      setPingTesting(false);
    }
  };

  const handleSaveSessionParams = () => {
    if (onUpdateSessionSetup) {
      onUpdateSessionSetup({
        ...sessionSetup,
        dutyOfficer,
        battalion,
        company,
        platoon,
        scanMode
      });
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '90px' }}>
      {/* Settings Header */}
      <div style={{
        background: 'linear-gradient(135deg, #064e2e 0%, #005a36 100%)',
        color: '#ffffff',
        padding: '1.2rem',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(229, 169, 0, 0.2)', color: 'var(--rotc-yellow-gold)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, marginBottom: '0.35rem' }}>
            <Settings size={12} /> SYSTEM CONFIGURATION
          </div>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.3rem', margin: 0 }}>Device & Node Settings</h2>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', margin: '2px 0 0 0' }}>Configure network connection & duty parameters</p>
        </div>
        <div style={{
          background: serverConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
          color: serverConnected ? '#10b981' : '#ef4444',
          padding: '6px 12px',
          borderRadius: '9999px',
          fontWeight: 800,
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          border: `1px solid ${serverConnected ? '#10b981' : '#ef4444'}`
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: serverConnected ? '#10b981' : '#ef4444' }} />
          {serverConnected ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      {/* Save Toast */}
      {saveSuccess && (
        <div style={{
          background: '#d1fae5',
          color: '#065f46',
          border: '1px solid #6ee7b7',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <CheckCircle2 size={18} /> Settings successfully saved!
        </div>
      )}

      {/* Card 1: Admin Laptop IP / Network Sync */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.2rem',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: 'var(--rotc-green-dark)', fontSize: '0.95rem', marginBottom: '0.85rem' }}>
          <Server size={18} />
          <span>Laptop Admin HQ Node Connection</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
              Admin Laptop IP & Port (e.g. http://192.168.1.100:8080)
            </label>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="http://192.168.1.100:8080"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                fontSize: '0.88rem',
                fontWeight: 600,
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSaveIp}
              style={{
                flex: 1,
                background: 'var(--rotc-green-dark)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Save IP Address
            </button>
            <button
              onClick={handleTestConnection}
              disabled={pingTesting}
              style={{
                background: '#f3f4f6',
                color: 'var(--text-dark)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                padding: '0.65rem 1rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={14} className={pingTesting ? 'spin' : ''} />
              {pingTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {pingResult && (
            <div style={{
              background: pingResult.success ? '#ecfdf5' : '#fef2f2',
              color: pingResult.success ? '#065f46' : '#991b1b',
              border: `1px solid ${pingResult.success ? '#a7f3d0' : '#fecaca'}`,
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {pingResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{pingResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Duty Officer & Echelon Configuration */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.2rem',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: 'var(--rotc-green-dark)', fontSize: '0.95rem', marginBottom: '0.85rem' }}>
          <User size={18} />
          <span>Field Session & Duty Officer</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Duty Officer Name</label>
            <input
              type="text"
              value={dutyOfficer}
              onChange={(e) => setDutyOfficer(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Battalion / Unit</label>
              <select
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
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.82rem', fontWeight: 600 }}
              >
                <option value="1st Battalion">1st Battalion</option>
                <option value="2nd Battalion">2nd Battalion</option>
                <option value="CADET OFFICERS">CADET OFFICERS</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                {battalion === 'CADET OFFICERS' ? 'Officer Class' : 'Company'}
              </label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.82rem', fontWeight: 600 }}
              >
                {battalion === 'CADET OFFICERS' ? (
                  <>
                    <option value="1CL">1CL (First Class)</option>
                    <option value="2CL">2CL (Second Class)</option>
                    <option value="3CL">3CL (Third Class)</option>
                    <option value="4CL">4CL (Fourth Class)</option>
                    <option value="ASPIRANT">ASPIRANT (Candidates)</option>
                  </>
                ) : (
                  <>
                    <option value="Alpha Company">Alpha Company</option>
                    <option value="Bravo Company">Bravo Company</option>
                    <option value="Charlie Company">Charlie Company</option>
                    <option value="Delta Company">Delta Company</option>
                    <option value="HQ Company">HQ Company</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Platoon</label>
              <select
                value={platoon}
                onChange={(e) => setPlatoon(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.82rem', fontWeight: 600 }}
              >
                <option value="1st Platoon">1st Platoon</option>
                <option value="2nd Platoon">2nd Platoon</option>
                <option value="3rd Platoon">3rd Platoon</option>
                <option value="4th Platoon">4th Platoon</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Default Scan Mode</label>
              <select
                value={scanMode}
                onChange={(e) => setScanMode(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.82rem', fontWeight: 600 }}
              >
                <option value="Time-In">Time-In</option>
                <option value="Time-Out">Time-Out</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSaveSessionParams}
            style={{
              background: 'var(--rotc-green-dark)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.65rem',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              marginTop: '0.25rem'
            }}
          >
            Update Session Parameters
          </button>
        </div>
      </div>

      {/* Card 3: Storage & Queue Actions */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.2rem',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: 'var(--rotc-green-dark)', fontSize: '0.95rem', marginBottom: '0.85rem' }}>
          <Smartphone size={18} />
          <span>Local Phone Storage & Queue</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Unsynced Scans in Queue:</span>
            <strong style={{ color: 'var(--rotc-green-dark)', fontSize: '0.95rem' }}>{offlineQueue.length} Records</strong>
          </div>

          {offlineQueue.length > 0 && onResetQueue && (
            <button
              onClick={onResetQueue}
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '0.65rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Trash2 size={16} /> Reset / Clear Unsynced Scans
            </button>
          )}

          {onEditSetup && (
            <button
              onClick={onEditSetup}
              style={{
                background: '#f3f4f6',
                color: 'var(--text-dark)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                padding: '0.65rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} /> Reconfigure Session Setup
            </button>
          )}
        </div>
      </div>

      {/* Card 4: System Information */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '16px',
        padding: '1rem',
        border: '1px solid var(--border-light)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        textAlign: 'center'
      }}>
        <div style={{ fontWeight: 800, color: 'var(--rotc-green-dark)' }}>CSU ROTC 1501st CDC Unit Attendance Node</div>
        <div>Offline Field PWA Client • Level L QR Compression</div>
        <div style={{ fontSize: '0.7rem' }}>Caraga State University Main Campus</div>
      </div>
    </div>
  );
}
