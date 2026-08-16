import React from 'react';
import { Activity, Clock, Users, Shield, CheckCircle2, Layers, Trash2 } from 'lucide-react';
import { formatCadetHeading } from '../services/cadetDirectory';

export default function MobileAnalytics({ scanLogs = [], sessionSetup, onResetQueue }) {
  // 1. Clean out any corrupted or JSON test payloads
  const cleanScans = scanLogs.filter(scan => {
    if (!scan.cadetId) return false;
    const id = scan.cadetId.trim();
    return !id.startsWith('{') && !id.startsWith('[') && !id.startsWith('http');
  });

  const totalAllScans = cleanScans.length;
  const PLATOON_CAPACITY = 37;

  // Active Platoon details from session setup
  const activeBn = (sessionSetup?.battalion || '1st Battalion').trim();
  const activeCoy = (sessionSetup?.company || 'Alpha Company').trim();
  const activePltn = (sessionSetup?.platoon || '1st Platoon').trim();
  const activeMode = sessionSetup?.scanMode || 'Time-In';

  // 2. SCOPED ARRAY SELECTOR: Filter strictly by active unit context
  const activeUnitScans = cleanScans.filter(scan => {
    // Battalion match
    const matchBn = !sessionSetup?.battalion ||
      sessionSetup.battalion === 'All Battalions' ||
      scan.battalion === sessionSetup.battalion ||
      (scan.sessionName || '').includes(sessionSetup.battalion);

    // Company match
    const setupCoClean = activeCoy.replace(' Company', '');
    const matchCo = !sessionSetup?.company ||
      sessionSetup.company === 'All Companies' ||
      (scan.company || '').includes(setupCoClean) ||
      (scan.sessionName || '').includes(setupCoClean);

    // Platoon match
    const setupPlClean = activePltn.replace(' Platoon', '');
    const matchPl = !sessionSetup?.platoon ||
      sessionSetup.platoon === 'All Platoons' ||
      (scan.platoon || '').includes(setupPlClean) ||
      (scan.sessionName || '').includes(setupPlClean);

    // Scan Mode match (Time-In vs Time-Out)
    const matchMode = !activeMode || scan.scanMode === activeMode;

    return matchBn && matchCo && matchPl && matchMode;
  });

  const activeScannedCount = activeUnitScans.length;
  const progressPercent = Math.min(100, Math.round((activeScannedCount / PLATOON_CAPACITY) * 100));
  const remaining = Math.max(0, PLATOON_CAPACITY - activeScannedCount);

  // Format display heading: CDT ABAMO, CDT SANTOS, etc.
  const getDisplayHeading = (scan) => {
    return formatCadetHeading(scan);
  };

  const formattedBn = activeBn.toUpperCase();
  const formattedCoy = activeCoy.replace(' Company', ' COY').toUpperCase();
  const formattedPltn = activePltn.toUpperCase();

  return (
    <div>
      {/* Active Platoon Attendance & Progress Card */}
      <div className="mobile-card">
        <div className="mobile-card-title">
          <Activity size={18} />
          <span>ACTIVE PLATOON ATTENDANCE</span>
        </div>

        {/* Selected Unit Echelon Banner */}
        <div style={{
          background: 'linear-gradient(135deg, var(--rotc-green-dark) 0%, #005a36 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '0.9rem 1rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--rotc-yellow-gold)',
            textTransform: 'uppercase',
            fontWeight: 800,
            letterSpacing: '0.8px',
            marginBottom: '4px'
          }}>
            ACTIVE SCANNING UNIT
          </div>

          <div style={{
            fontSize: '0.98rem',
            fontWeight: 800,
            fontFamily: 'Oswald, sans-serif',
            letterSpacing: '0.5px',
            lineHeight: 1.2
          }}>
            {formattedBn} • {formattedCoy} • {formattedPltn}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            opacity: 0.85,
            marginTop: '4px'
          }}>
            <span>Duty OIC: <strong>{sessionSetup?.dutyOfficer || 'Duty Officer'}</strong></span>
            <span>•</span>
            <span>Mode: <strong>{activeMode}</strong></span>
          </div>
        </div>

        {/* Platoon Progress Block (Fixed 37 Cadets Capacity strictly for active platoon) */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid var(--border-light)',
          borderRadius: '12px',
          padding: '0.9rem 1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--rotc-green-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Platoon Capacity ({PLATOON_CAPACITY} Cadets Fixed)
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1.1, marginTop: '2px' }}>
                {activeScannedCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ {PLATOON_CAPACITY} Scanned</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: activeScannedCount >= PLATOON_CAPACITY ? '#d1fae5' : '#fef3c7',
                color: activeScannedCount >= PLATOON_CAPACITY ? '#065f46' : '#92400e',
                border: `1px solid ${activeScannedCount >= PLATOON_CAPACITY ? '#6ee7b7' : '#fde68a'}`
              }}>
                {activeScannedCount >= PLATOON_CAPACITY ? '100% COMPLETE' : `${remaining} REMAINING`}
              </span>
            </div>
          </div>

          {/* Clean Visual Progress Bar */}
          <div style={{
            width: '100%',
            height: '10px',
            background: '#e2e8f0',
            borderRadius: '9999px',
            overflow: 'hidden',
            marginTop: '0.4rem'
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: activeScannedCount >= PLATOON_CAPACITY
                ? 'linear-gradient(90deg, #059669, #10b981)'
                : 'linear-gradient(90deg, #064e2e, var(--rotc-yellow-gold))',
              borderRadius: '9999px',
              transition: 'width 0.4s ease'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
            <span>0 Cadets</span>
            <span>{progressPercent}% of {activePltn}</span>
            <span>37 Cadets Quota</span>
          </div>
        </div>
      </div>

      {/* Recent Field Scans List View (Scoped strictly to active unit context) */}
      <div className="mobile-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="mobile-card-title" style={{ margin: 0 }}>
            <Clock size={18} />
            <span>RECENT FIELD SCANS ({activeScannedCount})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {totalAllScans > activeScannedCount && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', padding: '2px 7px', borderRadius: '9999px', fontWeight: 600 }}>
                {totalAllScans} in queue
              </span>
            )}

            {totalAllScans > 0 && onResetQueue && (
              <button
                type="button"
                onClick={onResetQueue}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#dc2626',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  transition: 'background 0.2s ease'
                }}
                title="Clear all scans from offline device storage"
              >
                <Trash2 size={12} />
                <span>CLEAR QUEUE</span>
              </button>
            )}
          </div>
        </div>

        {activeUnitScans.length === 0 ? (
          <div style={{ textTransform: 'uppercase', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: '#f8fafc', borderRadius: '10px', border: '1px dashed var(--border-light)' }}>
            No scans recorded for <strong>{activePltn}</strong> ({activeMode}) yet.
            {totalAllScans > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--rotc-green-dark)', marginTop: '4px', fontWeight: 700 }}>
                ({totalAllScans} cadet scan(s) recorded in other platoon sessions are safely queued for batch sync).
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '280px', overflowY: 'auto' }}>
            {activeUnitScans.map((scan, idx) => (
              <div key={`${scan.cadetId}-${idx}`} className="scan-log-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 0.85rem', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                
                {/* Left Side: Top Line = Cadet Name/ID, Bottom Line = ID + Timestamp */}
                <div>
                  {/* Top Line (Primary): CADET SANTOS, MARIA L. */}
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--rotc-green-dark)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {getDisplayHeading(scan)}
                  </div>

                  {/* Bottom Line (Secondary): ID: 221-01001 • 09:05 AM */}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>ID: {scan.cadetId}</span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      <Clock size={11} />
                      {scan.timestamp ? new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                </div>

                {/* Right Side: Scan Mode Badge */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: scan.scanMode === 'Time-Out' ? '#fef3c7' : '#d1fae5',
                    color: scan.scanMode === 'Time-Out' ? '#92400e' : '#065f46',
                    border: `1px solid ${scan.scanMode === 'Time-Out' ? '#fde68a' : '#6ee7b7'}`
                  }}>
                    {scan.scanMode ? scan.scanMode.toUpperCase() : 'PRESENT'}
                  </span>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
