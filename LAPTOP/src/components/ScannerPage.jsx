import React from 'react';
import { Camera, Smartphone, FileSpreadsheet, ShieldCheck, CheckCircle2, QrCode, ArrowRight, Clock } from 'lucide-react';

export default function ScannerPage({ onOpenScanner, attendanceLogs = [] }) {
  const totalScans = attendanceLogs.length;

  // Group attendance logs into distinct echelon batches
  const batchMap = new Map();
  attendanceLogs.forEach((log) => {
    const bn = log.battalion || '1st Battalion';
    const co = log.company || 'Alpha Company';
    const pl = log.platoon || '1st Platoon';
    const officer = log.dutyOfficer || log.d || 'Duty Officer';
    const timeKey = log.receivedAt ? log.receivedAt.slice(0, 16) : (log.timestamp ? log.timestamp.slice(0, 16) : 'batch');
    const key = `${bn}__${co}__${pl}__${officer}__${timeKey}`;

    if (!batchMap.has(key)) {
      batchMap.set(key, {
        battalion: bn,
        company: co,
        platoon: pl,
        dutyOfficer: officer,
        timestamp: log.receivedAt || log.timestamp || new Date().toISOString(),
        count: 0,
        status: log.status || 'PRESENT'
      });
    }
    const batch = batchMap.get(key);
    batch.count += 1;
  });

  const recentBatches = Array.from(batchMap.values()).slice(0, 6);

  return (
    <div>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #064e2e 0%, #005a36 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '1.75rem',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(229, 169, 0, 0.2)',
            color: 'var(--rotc-yellow-gold)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '1px',
            marginBottom: '0.75rem',
            border: '1px solid rgba(229, 169, 0, 0.35)'
          }}>
            <ShieldCheck size={14} />
            <span>OFFLINE QR-TO-CAMERA SYNC ENGINE</span>
          </div>

          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.8rem', margin: '0 0 0.5rem 0', letterSpacing: '0.5px' }}>
            Webcam Field Batch Scanner
          </h2>
          <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.6 }}>
            Use the laptop webcam to scan and ingest attendance batches displayed on Duty Officers' smartphone screens. Zero internet or Wi-Fi required—data transfers camera-to-screen directly into master Excel logs.
          </p>
        </div>

        <div>
          <button
            className="btn btn-gold"
            onClick={onOpenScanner}
            style={{
              padding: '0.9rem 1.75rem',
              fontSize: '1rem',
              fontWeight: 800,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              borderRadius: '10px'
            }}
          >
            <Camera size={22} />
            <span>LAUNCH WEBCAM SCANNER</span>
          </button>
        </div>
      </div>

      {/* 3-Step Synchronization Guide */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header">
          <div className="card-title" style={{ fontSize: '1.05rem' }}>
            <QrCode size={20} />
            <span>How Offline QR-to-Camera Sync Works</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Step 1 */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(6, 78, 46, 0.1)', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              1
            </div>
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--rotc-green-dark)', fontSize: '0.95rem' }}>
              Field Duty Officer Scans Cadets
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Duty Officers scan cadet ID cards in the field using their smartphone web app. Scans are saved securely in local phone storage.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(229, 169, 0, 0.15)', color: '#b48400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              2
            </div>
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--rotc-green-dark)', fontSize: '0.95rem' }}>
              Present Batch Sync QR Code
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Officer taps <strong>[ PRESENT BATCH SYNC QR ]</strong> on the phone. The phone generates a high-contrast, low-density QR code.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(5, 150, 105, 0.15)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              3
            </div>
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--rotc-green-dark)', fontSize: '0.95rem' }}>
              Laptop Ingests & Writes Excel
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Laptop Admin HQ webcam decodes the QR code in milliseconds and writes formatted records directly into local Excel reports.
            </p>
          </div>
        </div>
      </div>

      {/* Ingestion Overview & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Sync Engine Health */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: '0.95rem' }}>
              <ShieldCheck size={18} />
              <span>Camera Node Status</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontWeight: 700, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} />
                <span>Webcam Scanner Node Ready</span>
              </div>
              <span className="badge badge-present">ONLINE</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Master Records Logged:</span>
              <strong style={{ color: 'var(--rotc-green-dark)', fontSize: '1rem' }}>{totalScans} Records</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>QR Payload Compression:</span>
              <strong style={{ color: '#059669', fontSize: '0.85rem' }}>8-Cadet Low-Density Chunks</strong>
            </div>
          </div>
        </div>

        {/* Recent Ingestions Preview (Grouped by Batches) */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: '0.95rem' }}>
              <FileSpreadsheet size={18} />
              <span>Latest Ingested Batches ({recentBatches.length})</span>
            </div>
          </div>

          {recentBatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No batch ingestions recorded yet today. Launch the scanner above to import field scans.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentBatches.map((batch, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 0.9rem',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--rotc-green-dark)', fontWeight: 800, fontSize: '0.88rem' }}>
                      {batch.battalion} • {batch.company} • {batch.platoon}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                      <strong style={{ color: '#059669' }}>{batch.count} Cadets Ingested</strong> • Duty Officer: {batch.dutyOfficer} • {batch.timestamp ? new Date(batch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                    </div>
                  </div>
                  <span className="badge badge-present" style={{ fontSize: '0.72rem', gap: '3px', fontWeight: 800 }}>
                    <CheckCircle2 size={11} /> SYNCED
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
