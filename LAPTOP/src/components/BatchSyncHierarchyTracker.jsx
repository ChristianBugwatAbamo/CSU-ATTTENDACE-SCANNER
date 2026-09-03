import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

const COMPANIES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
const PLATOONS = ['1st Platoon', '2nd Platoon'];
const BATTALIONS = ['1st Battalion', '2nd Battalion'];

// Helper function to check if a timestamp/date string matches today (YYYY-MM-DD)
const isToday = (dateInput) => {
  if (!dateInput) return false;

  // Format today's date in local time as YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // If already a YYYY-MM-DD format string
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10) === todayStr;
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const dYear = d.getFullYear();
  const dMonth = String(d.getMonth() + 1).padStart(2, '0');
  const dDay = String(d.getDate()).padStart(2, '0');
  const recordDateStr = `${dYear}-${dMonth}-${dDay}`;

  return todayStr === recordDateStr;
};

export default function BatchSyncHierarchyTracker({ ingestedBatches = [] }) {
  // Check if a specific platoon has been scanned TODAY
  const isPlatoonScanned = (bat, coy, pl) => {
    return ingestedBatches.some((b) => {
      // Verify date timestamp is today
      const batchDate = b.scannedAt || b.timestamp || b.created_at || b.date || b.receivedAt || b.timeIn || b.timeOut;
      if (!isToday(batchDate)) return false;

      const bBn = String(b.battalion || '').toLowerCase();
      const bCo = String(b.company || '').toLowerCase();
      const bPl = String(b.platoon || '').toLowerCase();

      const targetBn = bat.toLowerCase();
      const targetCoy = coy.toLowerCase();
      const targetPl = pl.toLowerCase();

      // Check matching Battalion (e.g., '1st battalion' or contains '1')
      const targetBnNum = (targetBn.match(/(\d+)/) || [])[1];
      const matchBn = bBn.includes(targetBn) || (targetBnNum && bBn.includes(targetBnNum));
      // Check matching Company (e.g., 'alpha' or 'alpha company')
      const matchCo = bCo.includes(targetCoy);
      // Check matching Platoon (e.g., '1st platoon' or contains '1')
      const targetPlNum = (targetPl.match(/(\d+)/) || [])[1];
      const matchPl = bPl.includes(targetPl) || (targetPlNum && (bPl.includes(targetPlNum) || bPl.includes(`${targetPlNum}pltn`)));

      return matchBn && matchCo && matchPl;
    });
  };

  // Check if entire company is complete (both platoons scanned)
  const isCompanyComplete = (bat, coy) => {
    return PLATOONS.every((pl) => isPlatoonScanned(bat, coy, pl));
  };

  // Check if entire battalion is complete (all 4 companies complete)
  const isBattalionComplete = (bat) => {
    return COMPANIES.every((coy) => isCompanyComplete(bat, coy));
  };

  return (
    <div 
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}
    >
      {/* HEADER WITH STATUS LEGEND */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '0.85rem',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div>
          <h3 
            style={{
              fontSize: '0.92rem',
              fontWeight: 900,
              color: '#0f172a',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              margin: 0
            }}
          >
            Unit Batch Sync Status Map
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
            Real-time visual tracking of received platoon batch QR codes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 800 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#059669', display: 'inline-block' }} />
            Scanned / Complete
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f1f5f9', border: '1.5px dashed #cbd5e1', display: 'inline-block' }} />
            Pending Scan
          </span>
        </div>
      </div>

      {/* BATTALIONS GRID */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {(() => {
          let bList = BATTALIONS;
          try {
            const saved = localStorage.getItem('csu_rotc_admin_settings');
            if (saved) {
              const parsed = JSON.parse(saved);
              const struct = parsed.unitStructure || parsed.unit_structure;
              if (Array.isArray(struct) && struct.length > 0) {
                bList = struct.map(b => b.name);
              }
            }
          } catch (_) {}
          return bList.map((bat) => {
            const batDone = isBattalionComplete(bat);
            return (
              <div 
                key={bat}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.1rem'
              }}
            >
              {/* BATTALION NODE */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div 
                  style={{
                    padding: '0.6rem 1.4rem',
                    borderRadius: '10px',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    backgroundColor: batDone ? '#047857' : '#ffffff',
                    color: batDone ? '#ffffff' : '#1e293b',
                    border: batDone ? '1.5px solid #065f46' : '1.5px solid #94a3b8',
                    boxShadow: batDone ? '0 4px 12px rgba(4, 120, 87, 0.25)' : '0 2px 4px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  {batDone ? <CheckCircle2 size={16} color="#a7f3d0" /> : <Clock size={16} color="#64748b" />}
                  <span>{bat}</span>
                </div>
              </div>

              {/* COMPANIES GRID (4 COYS) */}
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.5rem'
                }}
              >
                {COMPANIES.map((coy) => {
                  const coyDone = isCompanyComplete(bat, coy);
                  return (
                    <div 
                      key={coy}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        textAlign: 'center'
                      }}
                    >
                      {/* COMPANY NODE */}
                      <div 
                        style={{
                          padding: '0.5rem 0.25rem',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          transition: 'all 0.2s ease',
                          backgroundColor: coyDone ? '#059669' : '#ffffff',
                          color: coyDone ? '#ffffff' : '#334155',
                          border: coyDone ? '1px solid #047857' : '1.5px solid #cbd5e1',
                          boxShadow: coyDone ? '0 2px 6px rgba(5, 150, 105, 0.2)' : 'none'
                        }}
                      >
                        {coy} COY
                      </div>

                      {/* PLATOONS NODES (2 PLATOONS PER COY) */}
                      <div 
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem'
                        }}
                      >
                        {PLATOONS.map((pl) => {
                          const plDone = isPlatoonScanned(bat, coy, pl);
                          return (
                            <div
                              key={pl}
                              style={{
                                padding: '0.45rem 0.25rem',
                                borderRadius: '6px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                transition: 'all 0.2s ease',
                                backgroundColor: plDone ? '#10b981' : '#ffffff',
                                color: plDone ? '#ffffff' : '#94a3b8',
                                border: plDone ? '1px solid #059669' : '1.5px dashed #cbd5e1',
                                boxShadow: plDone ? '0 2px 4px rgba(16, 185, 129, 0.2)' : 'none'
                              }}
                            >
                              {pl === '1st Platoon' ? '1ST PL' : '2ND PL'}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>

              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
