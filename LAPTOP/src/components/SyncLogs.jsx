import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, RefreshCw, CheckCircle, Clock, Camera, QrCode, Filter, Search, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function SyncLogs({ attendanceLogs, onRefresh, onClearLogs, onOpenScanner }) {
  const [excelReports, setExcelReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [battalionFilter, setBattalionFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [platoonFilter, setPlatoonFilter] = useState('ALL');
  const [formationCutoff, setFormationCutoff] = useState(() => localStorage.getItem('csu_rotc_formation_cutoff') || '07:00');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setExcelReports(data);
      }
    } catch (err) {
      console.error("Failed to fetch reports list:", err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRefreshAll = () => {
    onRefresh();
    fetchReports();
  };

  const handleConfirmClear = async () => {
    setIsClearModalOpen(false);
    if (onClearLogs) {
      await onClearLogs();
      setStatusNotice("Master Attendance Logs successfully cleared.");
      setTimeout(() => setStatusNotice(null), 4000);
    }
  };

  const getAttendanceStatus = (log) => {
    if (log.status === 'LATE' || log.status === 'PRESENT') return log.status;
    if (log.scanMode === 'Time-Out') return 'TIME-OUT';
    if (!log.timestamp) return 'PRESENT';
    const d = new Date(log.timestamp);
    const logMinutes = d.getHours() * 60 + d.getMinutes();
    const [cutoffH, cutoffM] = (formationCutoff || '07:00').split(':').map(Number);
    const cutoffMinutes = (cutoffH || 7) * 60 + (cutoffM || 0);
    return logMinutes > cutoffMinutes ? 'LATE' : 'PRESENT';
  };

  const filteredLogs = attendanceLogs.filter(log => {
    const matchesSearch = (log.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (log.cadetId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBn = battalionFilter === 'ALL' || (log.battalion || '').toLowerCase().includes(battalionFilter.replace(' Battalion', '').toLowerCase());
    const matchesCo = companyFilter === 'ALL' || (log.company || '').toLowerCase().includes(companyFilter.toLowerCase());
    const matchesPl = platoonFilter === 'ALL' || (log.platoon || '').toLowerCase().includes(platoonFilter.replace(' Platoon', '').toLowerCase()) || (log.sessionName || '').toLowerCase().includes(platoonFilter.toLowerCase());
    return matchesSearch && matchesBn && matchesCo && matchesPl;
  });

  const presentCount = filteredLogs.filter(l => getAttendanceStatus(l) === 'PRESENT').length;
  const lateCount = filteredLogs.filter(l => getAttendanceStatus(l) === 'LATE').length;

  return (
    <div>
      {/* Toast Notice */}
      {statusNotice && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#d1fae5',
          color: '#065f46',
          border: '1px solid #6ee7b7',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          fontSize: '0.85rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <CheckCircle size={18} />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Local Excel Reports Card */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="card-title">LOCAL EXCEL REPORTS & MASTER LOGS</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Attendance records ingested via QR webcam scanner are written to local <code>.xlsx</code> files in <code>LAPTOP/desktop_excel_reports/</code> with Battalion, Company, and Platoon columns.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Formation Cutoff Time Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <Clock size={16} style={{ color: 'var(--rotc-green-dark)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)' }}>Formation Cutoff:</span>
              <input
                type="time"
                className="form-control form-control-sm"
                style={{ width: '115px', padding: '2px 6px', fontWeight: 700, fontSize: '0.82rem' }}
                value={formationCutoff}
                onChange={(e) => {
                  setFormationCutoff(e.target.value);
                  localStorage.setItem('csu_rotc_formation_cutoff', e.target.value);
                }}
                title="Cadets scanned after this time will be marked LATE"
              />
            </div>

            <button className="btn btn-secondary btn-sm" onClick={handleRefreshAll}>
              <RefreshCw size={16} /> Refresh Reports
            </button>
            <button
              onClick={() => setIsClearModalOpen(true)}
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.2s ease'
              }}
              title="Wipe and clear all master attendance records"
            >
              <Trash2 size={15} /> Clear Master Log
            </button>
          </div>
        </div>

        {/* Excel Reports Files List */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--rotc-green-dark)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={18} /> Generated Local Excel Files
          </h3>

          {excelReports.length === 0 ? (
            <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No Excel files created yet. Sync attendance records from mobile device to automatically generate <code>ROTC_Attendance_YYYY-MM-DD.xlsx</code>.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {excelReports.map(rep => (
                <div key={rep.filename} style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--rotc-green-dark)' }}>{rep.filename}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Modified: {new Date(rep.modifiedAt).toLocaleString()}
                    </div>
                  </div>
                  <a
                    href={`/api/reports/download/${rep.filename}`}
                    className="btn btn-gold btn-sm"
                    download
                  >
                    <Download size={14} /> Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters Header for Attendance Log */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--rotc-green-dark)', margin: 0 }}>
              Master Attendance Log ({filteredLogs.length} Records)
            </h3>
            {filteredLogs.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700 }}>
                <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>
                  ✓ PRESENT: {presentCount}
                </span>
                {lateCount > 0 && (
                  <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                    ⏱️ LATE: {lateCount}
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
            
            <select className="form-control form-control-sm" value={battalionFilter} onChange={(e) => setBattalionFilter(e.target.value)}>
              <option value="ALL">All Battalions</option>
              <option value="1st Battalion">1st Battalion</option>
              <option value="2nd Battalion">2nd Battalion</option>
              <option value="Brigade HQ">Brigade HQ</option>
            </select>

            <select className="form-control form-control-sm" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="ALL">All Companies</option>
              <option value="Alpha">Alpha</option>
              <option value="Bravo">Bravo</option>
              <option value="Charlie">Charlie</option>
              <option value="Delta">Delta</option>
              <option value="Headquarters">Headquarters</option>
            </select>

            <select className="form-control form-control-sm" value={platoonFilter} onChange={(e) => setPlatoonFilter(e.target.value)}>
              <option value="ALL">All Platoons</option>
              <option value="1st Platoon">1st Pltn</option>
              <option value="2nd Platoon">2nd Pltn</option>
              <option value="3rd Platoon">3rd Pltn</option>
              <option value="4th Platoon">4th Pltn</option>
            </select>
          </div>
        </div>

        {/* Full Received Logs Table */}
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
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No sync logs matching selected echelon filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const status = getAttendanceStatus(log);
                  const isLate = status === 'LATE';

                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--rotc-green-dark)' }}>{log.cadetId}</td>
                      <td style={{ fontWeight: 600 }}>{log.name}</td>
                      <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>{log.battalion || '1st Battalion'}</span></td>
                      <td><span className="badge badge-company">{log.company}</span></td>
                      <td><span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>{log.platoon || '1st Platoon'}</span></td>
                      <td>{log.rank || 'Cadet'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{log.sessionName || 'Drill Session'}</td>
                      <td>{log.dutyOfficer || 'Duty Officer'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                      <td>
                        {status === 'TIME-OUT' ? (
                          <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', gap: '3px', fontWeight: 700 }}>
                            <Clock size={11} /> TIME-OUT
                          </span>
                        ) : isLate ? (
                          <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800, gap: '3px' }}>
                            <Clock size={11} /> LATE
                          </span>
                        ) : (
                          <span className="badge badge-present" style={{ gap: '3px' }}>
                            <CheckCircle size={11} /> PRESENT
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Military Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        title="⚠️ Clear Master Attendance Logs?"
        message="Are you sure you want to clear all Master Attendance Logs? This will reset local records."
        confirmText="Clear Master Log"
        cancelText="Cancel"
        isDestructive={true}
        onCancel={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClear}
      />
    </div>
  );
}
