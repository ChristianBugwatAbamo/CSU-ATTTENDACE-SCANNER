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
  const [dutyOfficer, setDutyOfficer] = useState(sessionSetup?.dutyOfficer || '');
  const [battalion, setBattalion] = useState(sessionSetup?.battalion || '');
  const [company, setCompany] = useState(sessionSetup?.company || '');
  const [platoon, setPlatoon] = useState(sessionSetup?.platoon || '');
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
    <div style={{ padding: '1.15rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '90px', background: 'var(--bg-dark-base)', minHeight: 'calc(100vh - 64px)' }}>
      {/* Settings Header */}
      <div style={{
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        padding: '1.2rem',
        borderRadius: '16px',
        border: '1.5px solid var(--border-dark)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--rotc-gold-bright)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, marginBottom: '0.35rem' }}>
            <Settings size={12} /> SYSTEM CONFIGURATION
          </div>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.35rem', margin: 0, letterSpacing: '0.4px' }}>Device & Node Settings</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>Configure network connection & duty parameters</p>
        </div>
        <div style={{
          background: serverConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          color: serverConnected ? '#34d399' : '#f87171',
          padding: '6px 12px',
          borderRadius: '9999px',
          fontWeight: 800,
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          border: `1px solid ${serverConnected ? '#10b981' : '#ef4444'}`
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: serverConnected ? '#10b981' : '#ef4444' }} />
          {serverConnected ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      {/* Save Toast */}
      {saveSuccess && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.2)',
          color: '#34d399',
          border: '1.5px solid #10b981',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} /> Settings successfully saved!
        </div>
      )}

      {/* Card 1: Admin Laptop IP / Network Sync */}
      <div className="setup-card-group">
        <div className="setup-card-title">
          <Server size={18} />
          <span>Laptop Admin HQ Node Connection</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '5px' }}>
              Admin Laptop IP & Port (e.g. http://192.168.1.100:8080)
            </label>
            <input
              type="text"
              className="setup-input"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="http://192.168.1.100:8080"
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSaveIp}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
              }}
            >
              Save IP Address
            </button>
            <button
              onClick={handleTestConnection}
              disabled={pingTesting}
              style={{
                background: 'var(--bg-dark-input)',
                color: 'var(--text-bright)',
                border: '1px solid var(--border-dark)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className={pingTesting ? 'spin' : ''} />
              {pingTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {pingResult && (
            <div style={{
              background: pingResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: pingResult.success ? '#34d399' : '#f87171',
              border: `1.5px solid ${pingResult.success ? '#10b981' : '#ef4444'}`,
              padding: '0.7rem 0.85rem',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 700,
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
      <div className="setup-card-group">
        <div className="setup-card-title">
          <User size={18} />
          <span>Field Session & Duty Officer</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>Duty Officer Name</label>
            <input
              type="text"
              className="setup-input"
              value={dutyOfficer}
              onChange={(e) => setDutyOfficer(e.target.value)}
              placeholder="e.g., C/COL JUAN DELA CRUZ 1CL"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>Battalion / Unit</label>
              <select
                className="setup-select"
                value={battalion}
                onChange={(e) => {
                  setBattalion(e.target.value);
                  setCompany('');
                  setPlatoon('');
                }}
              >
                <option value="" disabled>-- Select Battalion --</option>
                <option value="1st Battalion">1st Battalion</option>
                <option value="2nd Battalion">2nd Battalion</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>Company</label>
              <select
                className="setup-select"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              >
                <option value="" disabled>-- Select Company --</option>
                <option value="Alpha Company">Alpha Company</option>
                <option value="Bravo Company">Bravo Company</option>
                <option value="Charlie Company">Charlie Company</option>
                <option value="Delta Company">Delta Company</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>Platoon</label>
              <select
                className="setup-select"
                value={platoon}
                onChange={(e) => setPlatoon(e.target.value)}
              >
                <option value="" disabled>-- Select Platoon --</option>
                <option value="1st Platoon">1st Platoon</option>
                <option value="2nd Platoon">2nd Platoon</option>
                <option value="3rd Platoon">3rd Platoon</option>
                <option value="4th Platoon">4th Platoon</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'block', marginBottom: '4px' }}>Default Scan Mode</label>
              <select
                className="setup-select"
                value={scanMode}
                onChange={(e) => setScanMode(e.target.value)}
              >
                <option value="Time-In">Time-In</option>
                <option value="Time-Out">Time-Out</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSaveSessionParams}
            className="setup-gold-btn"
            style={{ marginTop: '0.25rem' }}
          >
            Update Session Parameters
          </button>
        </div>
      </div>

      {/* Card 3: Storage & Queue Actions */}
      <div className="setup-card-group">
        <div className="setup-card-title">
          <Smartphone size={18} />
          <span>Local Phone Storage & Queue</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-dark-input)',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1px solid var(--border-dark)'
          }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Unsynced Scans in Queue:</span>
            <strong style={{ color: 'var(--rotc-gold-bright)', fontSize: '1rem' }}>{offlineQueue.length} Records</strong>
          </div>

          {offlineQueue.length > 0 && onResetQueue && (
            <button
              onClick={onResetQueue}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1.5px solid #ef4444',
                borderRadius: '10px',
                padding: '0.75rem',
                fontWeight: 800,
                fontSize: '0.85rem',
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
                background: 'var(--bg-dark-input)',
                color: 'var(--text-bright)',
                border: '1px solid var(--border-dark)',
                borderRadius: '10px',
                padding: '0.75rem',
                fontWeight: 700,
                fontSize: '0.85rem',
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
        background: 'var(--bg-dark-card)',
        borderRadius: '16px',
        padding: '1rem',
        border: '1px solid var(--border-dark)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        textAlign: 'center'
      }}>
        <div style={{ fontWeight: 800, color: 'var(--rotc-gold-bright)' }}>CSU ROTC 1501st CDC Unit Attendance Node</div>
        <div>Offline Field PWA Client • Level L QR Compression</div>
        <div style={{ fontSize: '0.7rem' }}>Caraga State University Main Campus</div>
      </div>
    </div>
  );
}

export { MobileSettings as MobileSettingsView };
