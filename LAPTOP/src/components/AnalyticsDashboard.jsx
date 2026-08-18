import React, { useState } from 'react';
import { Users, UserCheck, Shield, Award, Activity, RefreshCw, Layers, Compass, Building, CheckCircle2, Filter, XCircle } from 'lucide-react';

export default function AnalyticsDashboard({ cadets = [], attendanceLogs = [], onRefresh }) {
  const [selectedBattalion, setSelectedBattalion] = useState('ALL');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedPlatoon, setSelectedPlatoon] = useState('ALL');

  const TARGET_UNIT_STRENGTH = 1184;
  const TARGET_PER_BATTALION = 592;
  const TARGET_PER_COMPANY = 148;
  const TARGET_PER_PLATOON = 37;

  // 1. Dynamic Counts calculated directly from attendanceLogs
  const totalAttendanceScans = attendanceLogs.length;
  const uniqueCadetIds = new Set(attendanceLogs.map(l => (l.cadetId || '').trim()).filter(Boolean));
  const uniqueCadetsCount = uniqueCadetIds.size;

  const firstBnCount = attendanceLogs.filter(l => (l.battalion || '').includes('1st')).length;
  const secondBnCount = attendanceLogs.filter(l => (l.battalion || '').includes('2nd')).length;
  const brigadeHqCount = attendanceLogs.filter(l => (l.battalion || '').includes('Brigade') || (l.company || '') === 'Headquarters').length;

  // 2. Filtered logs according to active Battalion selector for top gauges
  const bnSelectorClean = selectedBattalion.replace(' Battalion', '').toLowerCase().trim();
  const activeLogs = selectedBattalion === 'ALL'
    ? attendanceLogs
    : attendanceLogs.filter(log => (log.battalion || '').toLowerCase().includes(bnSelectorClean));

  // 3. Battalion Summaries (Computed dynamically from attendanceLogs)
  const battalions = [
    {
      name: '1st Battalion',
      scanned: firstBnCount,
      target: TARGET_PER_BATTALION,
      companiesDesc: 'Alpha, Bravo, Charlie, Delta • 16 Platoons'
    },
    {
      name: '2nd Battalion',
      scanned: secondBnCount,
      target: TARGET_PER_BATTALION,
      companiesDesc: 'Alpha, Bravo, Charlie, Delta • 16 Platoons'
    },
    {
      name: 'Brigade HQ',
      scanned: brigadeHqCount,
      target: 12,
      companiesDesc: 'Command Group & Special Staff'
    }
  ];

  // 4. Company Summaries (Computed dynamically from activeLogs)
  const companies = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Headquarters'];
  const companyCounts = companies.map(c => {
    const isHQ = c === 'Headquarters';
    const target = isHQ ? 12 : TARGET_PER_COMPANY;
    const scanned = activeLogs.filter(log => {
      const co = (log.company || '').toLowerCase().trim();
      return co.includes(c.toLowerCase().trim());
    }).length;
    const percent = Math.min(100, Math.round((scanned / target) * 100));

    return {
      name: c,
      scanned,
      target,
      percent
    };
  });

  // 5. Platoon Summaries (Computed dynamically from activeLogs against 37-Cadet capacity)
  const platoons = ['1st Platoon', '2nd Platoon', '3rd Platoon', '4th Platoon'];
  const platoonCounts = platoons.map(p => {
    const plClean = p.replace(' Platoon', '').toLowerCase().trim();
    const scanned = activeLogs.filter(log => {
      const pl = (log.platoon || '').toLowerCase().trim();
      const sn = (log.sessionName || '').toLowerCase().trim();
      return pl.includes(plClean) || sn.includes(plClean);
    }).length;
    const percent = Math.min(100, Math.round((scanned / TARGET_PER_PLATOON) * 100));

    return {
      name: p,
      scanned,
      target: TARGET_PER_PLATOON,
      percent
    };
  });

  const overallPercent = Math.min(100, Math.round(((uniqueCadetsCount || totalAttendanceScans) / TARGET_UNIT_STRENGTH) * 100));

  // 6. Interactive Card Click Handlers
  const handleToggleBattalion = (bnName) => {
    if (selectedBattalion === bnName) {
      setSelectedBattalion('ALL');
    } else {
      setSelectedBattalion(bnName);
    }
  };

  const handleToggleCompany = (coName) => {
    if (selectedCompany === coName) {
      setSelectedCompany('ALL');
    } else {
      setSelectedCompany(coName);
    }
  };

  const handleTogglePlatoon = (plName) => {
    if (selectedPlatoon === plName) {
      setSelectedPlatoon('ALL');
    } else {
      setSelectedPlatoon(plName);
    }
  };

  const handleClearAllFilters = () => {
    setSelectedBattalion('ALL');
    setSelectedCompany('ALL');
    setSelectedPlatoon('ALL');
  };

  const isAnyFilterActive = selectedBattalion !== 'ALL' || selectedCompany !== 'ALL' || selectedPlatoon !== 'ALL';

  // 7. Interactive Filtered Table Records (Strict Case-Insensitive String Matching)
  const tableFilteredLogs = attendanceLogs.filter(log => {
    const bnClean = selectedBattalion === 'ALL' ? '' : selectedBattalion.replace(' Battalion', '').toLowerCase().trim();
    const matchesBn = selectedBattalion === 'ALL' || (log.battalion || '').toLowerCase().trim().includes(bnClean);

    const coClean = selectedCompany === 'ALL' ? '' : selectedCompany.toLowerCase().trim();
    const matchesCo = selectedCompany === 'ALL' || (log.company || '').toLowerCase().trim().includes(coClean);

    const plClean = selectedPlatoon === 'ALL' ? '' : selectedPlatoon.replace(' Platoon', '').toLowerCase().trim();
    const logPl = (log.platoon || '').toLowerCase().trim();
    const logSn = (log.sessionName || '').toLowerCase().trim();
    const matchesPl = selectedPlatoon === 'ALL' || logPl.includes(plClean) || logSn.includes(plClean);

    return matchesBn && matchesCo && matchesPl;
  });

  return (
    <div>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', margin: 0 }}>
            COMMAND DASHBOARD • ECHELON ANALYTICS
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '3px 0 0 0' }}>
            Full Unit Target: <strong>1,184 Cadets</strong> (1 Brigade HQ • 2 Battalions • 8 Companies • 32 Platoons × 37 Cadets)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {isAnyFilterActive && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearAllFilters}
              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fee2e2', fontWeight: 700 }}
            >
              <XCircle size={15} /> Clear Filters
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Top Dynamic Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Total Unit Strength Progress */}
        <div className="card" style={{ borderLeft: '5px solid var(--rotc-green-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(6, 78, 46, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rotc-green-dark)' }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Unit Strength</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                {uniqueCadetsCount || totalAttendanceScans} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {TARGET_UNIT_STRENGTH}</span>
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{ width: `${overallPercent}%`, height: '100%', background: 'var(--rotc-green-dark)', transition: 'width 0.4s ease' }}></div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {overallPercent}% of Total Brigade Target
          </div>
        </div>

        {/* Master Attendance Logs */}
        <div className="card" style={{ borderLeft: '5px solid var(--rotc-yellow-gold)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(229, 169, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rotc-yellow-gold)' }}>
              <UserCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Attendance Scans</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                {totalAttendanceScans}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Live synced from mobile field scanner
          </div>
        </div>

        {/* 1st Battalion Scans */}
        <div
          className="card"
          onClick={() => handleToggleBattalion('1st Battalion')}
          style={{
            borderLeft: '5px solid #3b82f6',
            cursor: 'pointer',
            border: selectedBattalion === '1st Battalion' ? '2px solid #2563eb' : undefined,
            background: selectedBattalion === '1st Battalion' ? '#eff6ff' : undefined,
            boxShadow: selectedBattalion === '1st Battalion' ? '0 4px 14px rgba(37, 99, 235, 0.2)' : undefined,
            transition: 'all 0.2s ease'
          }}
          title="Click to filter by 1st Battalion"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Shield size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>1st Battalion</span>
                {selectedBattalion === '1st Battalion' && <span style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.65rem' }}>● ACTIVE</span>}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                {firstBnCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {TARGET_PER_BATTALION}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Alpha, Bravo, Charlie, Delta • Click to Filter
          </div>
        </div>

        {/* 2nd Battalion Scans */}
        <div
          className="card"
          onClick={() => handleToggleBattalion('2nd Battalion')}
          style={{
            borderLeft: '5px solid #8b5cf6',
            cursor: 'pointer',
            border: selectedBattalion === '2nd Battalion' ? '2px solid #7c3aed' : undefined,
            background: selectedBattalion === '2nd Battalion' ? '#f5f3ff' : undefined,
            boxShadow: selectedBattalion === '2nd Battalion' ? '0 4px 14px rgba(124, 58, 237, 0.2)' : undefined,
            transition: 'all 0.2s ease'
          }}
          title="Click to filter by 2nd Battalion"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
              <Award size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>2nd Battalion</span>
                {selectedBattalion === '2nd Battalion' && <span style={{ color: '#7c3aed', fontWeight: 800, fontSize: '0.65rem' }}>● ACTIVE</span>}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                {secondBnCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {TARGET_PER_BATTALION}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Alpha, Bravo, Charlie, Delta • Click to Filter
          </div>
        </div>
      </div>

      {/* Battalion Echelon Interactive Row */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title" style={{ fontSize: '1rem' }}>
            <Layers size={18} />
            <span>Battalion Echelon Cards (Click to Filter Table)</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {battalions.map(bn => {
            const pct = Math.min(100, Math.round((bn.scanned / bn.target) * 100));
            const isSelected = selectedBattalion === bn.name;

            return (
              <div
                key={bn.name}
                onClick={() => handleToggleBattalion(bn.name)}
                style={{
                  background: isSelected ? '#ecfdf5' : '#f8fafc',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
                  boxShadow: isSelected ? '0 4px 16px rgba(6, 78, 46, 0.18)' : undefined,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--rotc-green-dark)', fontSize: '0.95rem' }}>
                    {bn.name} {isSelected && '✓'}
                  </strong>
                  <span className="badge" style={{
                    background: isSelected ? 'var(--rotc-green-dark)' : (bn.scanned > 0 ? '#d1fae5' : '#f1f5f9'),
                    color: isSelected ? '#ffffff' : (bn.scanned > 0 ? '#065f46' : '#64748b'),
                    fontWeight: 800
                  }}>
                    {bn.scanned} / {bn.target} Scanned ({pct}%)
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  {bn.companiesDesc}
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #064e2e, #059669)', transition: 'width 0.4s ease' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-Column: Company Quotas & Platoon Breakdown (Clickable Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        {/* Company Breakdown (Clickable) */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: '0.95rem' }}>
              <Building size={18} />
              <span>Company Filter Cards (Click to Filter Table)</span>
            </div>
            {selectedCompany !== 'ALL' && (
              <span className="badge badge-company" onClick={() => setSelectedCompany('ALL')} style={{ cursor: 'pointer' }}>
                {selectedCompany} ✕
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {companyCounts.map(comp => {
              const isSelected = selectedCompany === comp.name;

              return (
                <div
                  key={comp.name}
                  onClick={() => handleToggleCompany(comp.name)}
                  style={{
                    padding: '0.75rem 0.9rem',
                    background: isSelected ? '#ecfdf5' : '#ffffff',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
                    boxShadow: isSelected ? '0 4px 12px rgba(6, 78, 46, 0.16)' : undefined,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title={`Click to filter by ${comp.name} Company`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--rotc-green-dark)', fontSize: '0.9rem' }}>
                        {comp.name} Company {isSelected && '✓'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>4 Platoons × 37 Cadets</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: comp.scanned > 0 ? 'var(--rotc-green-dark)' : 'var(--text-muted)' }}>
                        {comp.scanned} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {comp.target} Scanned</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${comp.percent}%`, height: '100%', background: comp.scanned > 0 ? 'var(--rotc-green-primary)' : '#cbd5e1', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platoon Breakdown (Clickable) */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: '0.95rem' }}>
              <Users size={18} />
              <span>Platoon Filter Cards (Click to Filter Table)</span>
            </div>
            {selectedPlatoon !== 'ALL' && (
              <span className="badge" style={{ background: '#fef3c7', color: '#92400e', cursor: 'pointer', fontWeight: 800 }} onClick={() => setSelectedPlatoon('ALL')}>
                {selectedPlatoon} ✕
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {platoonCounts.map(pltn => {
              const isSelected = selectedPlatoon === pltn.name;

              return (
                <div
                  key={pltn.name}
                  onClick={() => handleTogglePlatoon(pltn.name)}
                  style={{
                    padding: '0.75rem 0.9rem',
                    background: isSelected ? '#fffbeb' : '#ffffff',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #d97706' : '1px solid var(--border-light)',
                    boxShadow: isSelected ? '0 4px 12px rgba(217, 119, 6, 0.18)' : undefined,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title={`Click to filter by ${pltn.name}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>
                        {pltn.name} {isSelected && '✓'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Standard Platoon Formation</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: pltn.scanned > 0 ? '#059669' : 'var(--text-muted)' }}>
                        {pltn.scanned} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {pltn.target} Scanned</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pltn.percent}%`, height: '100%', background: pltn.scanned > 0 ? 'linear-gradient(90deg, #059669, #10b981)' : '#cbd5e1', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Master Attendance Ingestions Table (Dynamically Filtered) */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div className="card-title">
              <Activity size={20} />
              <span>Recent Master Attendance Ingestions ({tableFilteredLogs.length} Records)</span>
            </div>
            {isAnyFilterActive && (
              <div style={{ fontSize: '0.78rem', color: 'var(--rotc-green-dark)', marginTop: '2px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={13} />
                <span>Filtered by:</span>
                {selectedBattalion !== 'ALL' && <strong style={{ background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: '4px' }}>{selectedBattalion}</strong>}
                {selectedCompany !== 'ALL' && <strong style={{ background: '#d1fae5', color: '#065f46', padding: '1px 6px', borderRadius: '4px' }}>{selectedCompany} Coy</strong>}
                {selectedPlatoon !== 'ALL' && <strong style={{ background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>{selectedPlatoon}</strong>}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isAnyFilterActive && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearAllFilters}
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', color: '#dc2626', borderColor: '#fca5a5', background: '#fee2e2', fontWeight: 700 }}
                title="Reset all echelon filters"
              >
                <XCircle size={14} /> Clear Active Filters
              </button>
            )}
          </div>
        </div>

        {tableFilteredLogs.length === 0 ? (
          <div style={{ textTransform: 'uppercase', padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No attendance records matching active filters ({selectedBattalion} • {selectedCompany} • {selectedPlatoon}).
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cadet ID</th>
                  <th>Cadet Name</th>
                  <th>Battalion</th>
                  <th>Company</th>
                  <th>Platoon</th>
                  <th>Rank</th>
                  <th>Session Details</th>
                  <th>Duty Officer</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tableFilteredLogs.map((log, idx) => {
                  const isTimeOut = log.scanMode === 'Time-Out' || (log.status && String(log.status).toUpperCase().includes('TIME-OUT'));
                  let isLate = false;
                  if (!isTimeOut && log.timestamp) {
                    const cutoff = localStorage.getItem('csu_rotc_formation_cutoff') || '07:00';
                    const [ch, cm] = cutoff.split(':').map(Number);
                    const cutoffMinutes = (isNaN(ch) ? 7 : ch) * 60 + (isNaN(cm) ? 0 : cm);
                    const d = new Date(log.timestamp);
                    if (!isNaN(d.getTime())) {
                      isLate = (d.getHours() * 60 + d.getMinutes()) > cutoffMinutes;
                    }
                  }

                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--rotc-green-dark)' }}>{log.cadetId}</td>
                      <td style={{ fontWeight: 600 }}>{log.name}</td>
                      <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>{log.battalion || '1st Battalion'}</span></td>
                      <td><span className="badge badge-company">{log.company}</span></td>
                      <td><span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>{log.platoon || '1st Platoon'}</span></td>
                      <td style={{ fontWeight: 600 }}>{log.rank || 'Cadet'}</td>
                      <td>{log.sessionName || 'Drill Session'}</td>
                      <td>{log.dutyOfficer || 'Duty Officer'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                      <td>
                        {isTimeOut ? (
                          <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', gap: '3px' }}>
                            <CheckCircle2 size={11} /> TIME-OUT
                          </span>
                        ) : isLate ? (
                          <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800, gap: '3px' }}>
                            ⏱️ LATE
                          </span>
                        ) : (
                          <span className="badge badge-present" style={{ gap: '3px' }}>
                            <CheckCircle2 size={11} /> PRESENT
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
