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

  const [selectedScanDetail, setSelectedScanDetail] = React.useState(null);

  return (
    <div style={{ padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '90px' }}>
      {/* Active Platoon Attendance & Progress Card */}
      <div className="setup-card-group">
        <div className="setup-card-title">
          <Activity size={18} />
          <span>ACTIVE PLATOON ATTENDANCE</span>
        </div>

        {/* Selected Unit Echelon Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '0.9rem 1rem',
          border: '1px solid var(--border-dark)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--rotc-gold-bright)',
            textTransform: 'uppercase',
            fontWeight: 800,
            letterSpacing: '0.8px',
            marginBottom: '4px'
          }}>
            ACTIVE SCANNING UNIT
          </div>

          <div style={{
            fontSize: '1rem',
            fontWeight: 800,
            fontFamily: 'Oswald, sans-serif',
            letterSpacing: '0.5px',
            lineHeight: 1.2,
            color: '#ffffff'
          }}>
            {formattedBn} • {formattedCoy} • {formattedPltn}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            marginTop: '4px'
          }}>
            <span>Platoon Leader: <strong style={{ color: 'var(--text-bright)' }}>{sessionSetup?.dutyOfficer || 'Duty Officer'}</strong></span>
            <span>•</span>
            <span>Mode: <strong style={{ color: 'var(--rotc-gold-bright)' }}>{activeMode}</strong></span>
          </div>
        </div>

        {/* Platoon Progress Block */}
        <div style={{
          background: 'var(--bg-dark-input)',
          border: '1px solid var(--border-dark)',
          borderRadius: '12px',
          padding: '0.9rem 1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--rotc-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Platoon Capacity ({PLATOON_CAPACITY} Cadets Fixed)
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginTop: '2px' }}>
                {activeScannedCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ {PLATOON_CAPACITY} Scanned</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: activeScannedCount > PLATOON_CAPACITY
                  ? 'rgba(239, 68, 68, 0.2)'
                  : (activeScannedCount === PLATOON_CAPACITY ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'),
                color: activeScannedCount > PLATOON_CAPACITY
                  ? '#f87171'
                  : (activeScannedCount === PLATOON_CAPACITY ? '#34d399' : 'var(--rotc-gold-bright)'),
                border: `1px solid ${activeScannedCount > PLATOON_CAPACITY
                    ? '#ef4444'
                    : (activeScannedCount === PLATOON_CAPACITY ? '#10b981' : '#f59e0b')
                  }`,
                transition: 'all 0.4s ease'
              }}>
                {activeScannedCount > PLATOON_CAPACITY
                  ? `OVER CAPACITY (${activeScannedCount}/${PLATOON_CAPACITY})`
                  : (activeScannedCount === PLATOON_CAPACITY ? `CAPACITY REACHED (${PLATOON_CAPACITY}/${PLATOON_CAPACITY})` : `${remaining} REMAINING`)}
              </span>
            </div>
          </div>

          {/* Smooth Animated Visual Progress Bar */}
          <div style={{
            width: '100%',
            height: '11px',
            background: '#0b0f19',
            borderRadius: '9999px',
            overflow: 'hidden',
            marginTop: '0.4rem',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-dark)'
          }}>
            <div
              className="animated-progress-fill"
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: activeScannedCount > PLATOON_CAPACITY
                  ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)'
                  : (activeScannedCount === PLATOON_CAPACITY
                    ? 'linear-gradient(90deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(90deg, #059669 0%, #10b981 50%, var(--rotc-gold-bright) 100%)'),
                borderRadius: '9999px',
                transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.5s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
            <span>0 Cadets</span>
            <span style={{
              color: activeScannedCount > PLATOON_CAPACITY ? '#f87171' : (activeScannedCount === PLATOON_CAPACITY ? '#34d399' : 'var(--rotc-gold-bright)'),
              fontWeight: 800
            }}>
              {activeScannedCount > PLATOON_CAPACITY
                ? `Over Quota (${activeScannedCount}/${PLATOON_CAPACITY})`
                : (activeScannedCount === PLATOON_CAPACITY ? '100% (Quota Reached)' : `${progressPercent}% of ${activePltn}`)}
            </span>
            <span>37 Cadets Quota</span>
          </div>
        </div>
      </div>

      {/* Recent Field Scans List View */}
      <div className="setup-card-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="setup-card-title" style={{ margin: 0 }}>
            <Clock size={18} />
            <span>RECENT FIELD SCANS ({activeScannedCount})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {totalAllScans > activeScannedCount && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-dark-input)', padding: '2px 7px', borderRadius: '9999px', fontWeight: 600, border: '1px solid var(--border-dark)' }}>
                {totalAllScans} in queue
              </span>
            )}

            {totalAllScans > 0 && onResetQueue && (
              <button
                type="button"
                onClick={onResetQueue}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  transition: 'all 0.2s ease'
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
          <div style={{ textTransform: 'uppercase', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--bg-dark-input)', borderRadius: '10px', border: '1px dashed var(--border-dark)' }}>
            No scans recorded for <strong>{activePltn}</strong> ({activeMode}) yet.
            {totalAllScans > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--rotc-gold-bright)', marginTop: '4px', fontWeight: 700 }}>
                ({totalAllScans} cadet scan(s) recorded in other platoon sessions are safely queued for batch sync).
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '290px', overflowY: 'auto' }}>
            {activeUnitScans.map((scan, idx) => (
              <div
                key={`${scan.cadetId}-${idx}`}
                className="scan-log-item interactive-scan-row"
                onClick={() => setSelectedScanDetail(scan)}
                role="button"
                tabIndex={0}
                title="Tap to view cadet attendance details"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.9rem',
                  background: 'var(--bg-dark-input)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-dark)',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* Left Side: Top Line = Cadet Name/ID, Bottom Line = ID + Timestamp */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--rotc-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {getDisplayHeading(scan)}
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>ID: {scan.cadetId}</span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      <Clock size={11} />
                      {scan.timestamp ? new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                </div>

                {/* Right Side: Scan Mode Badge */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 850,
                    padding: '3px 9px',
                    borderRadius: '9999px',
                    background: scan.scanMode === 'Time-Out' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: scan.scanMode === 'Time-Out' ? 'var(--rotc-gold-bright)' : '#34d399',
                    border: `1px solid ${scan.scanMode === 'Time-Out' ? '#f59e0b' : '#10b981'}`
                  }}>
                    {scan.scanMode === 'Time-Out' ? 'TIME-OUT' : 'TIME-IN'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tap-to-View Cadet Detail Modal */}
      {selectedScanDetail && (
        <div className="modal-overlay" onClick={() => setSelectedScanDetail(null)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            maxWidth: '380px',
            padding: '1.25rem',
            background: 'var(--bg-dark-card)',
            border: '1.5px solid var(--border-dark)',
            borderRadius: '18px',
            boxShadow: '0 20px 45px rgba(0,0,0,0.75)',
            width: '100%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--rotc-gold-bright)', fontWeight: 800, fontSize: '0.95rem' }}>
                <CheckCircle2 size={20} color="var(--rotc-gold-bright)" />
                <span>CADET SCAN DETAILS</span>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setSelectedScanDetail(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--bg-dark-input)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-dark)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cadet Name</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>{getDisplayHeading(selectedScanDetail)}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Cadet ID</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--rotc-gold-bright)' }}>{selectedScanDetail.cadetId}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Scan Mode</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: selectedScanDetail.scanMode === 'Time-Out' ? '#fbbf24' : '#34d399' }}>
                    {selectedScanDetail.scanMode || 'Time-In'}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Unit Hierarchy</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-subtle)' }}>
                  {selectedScanDetail.battalion || activeBn} • {selectedScanDetail.company || activeCoy} • {selectedScanDetail.platoon || activePltn}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Logged System Timestamp</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                  {selectedScanDetail.timestamp ? new Date(selectedScanDetail.timestamp).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="setup-gold-btn"
              onClick={() => setSelectedScanDetail(null)}
              style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontWeight: 800, borderRadius: '10px' }}
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
