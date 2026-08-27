import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, X, CheckCircle2, Smartphone, ShieldCheck, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

// Max cadets per QR chunk (10 cadets maximum per page splits a full 37-cadet platoon into 4 low-density, easy-to-read QR pages)
const CHUNK_SIZE = 10;

export default function SyncControl({
  offlineQueue = [],
  sessionSetup,
  dutyOfficer,
  sessionName,
  onSyncSuccess,
  onResetQueue,
  isOpen,
  onClose,
  hideBottomBar = false
}) {
  const [internalQrModalOpen, setInternalQrModalOpen] = useState(false);
  const [activeBatchPayload, setActiveBatchPayload] = useState([]);
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState(null);
  const [currentChunk, setCurrentChunk] = useState(0);

  const isQrModalOpen = isOpen !== undefined ? isOpen : internalQrModalOpen;
  const setQrModalOpen = (val) => {
    if (onClose && !val) {
      onClose();
    }
    setInternalQrModalOpen(val);
  };

  // Mobile App: Clear local scans upon successful QR generation / Export
  const handleOpenQrModal = async () => {
    const queueToSync = offlineQueue.length > 0 ? [...offlineQueue] : (activeBatchPayload.length > 0 ? activeBatchPayload : []);
    if (queueToSync.length === 0) {
      setSyncStatusMsg({
        type: 'info',
        text: "No pending offline scans in queue to sync."
      });
      setTimeout(() => setSyncStatusMsg(null), 3000);
      return;
    }
    setActiveBatchPayload(queueToSync);
    setCurrentChunk(0);
    setQrModalOpen(true);

    // Clear local queue for the next scanning session
    if (onSyncSuccess) {
      await onSyncSuccess();
    }
  };

  const handleClearAndFinish = async () => {
    if (onSyncSuccess) {
      await onSyncSuccess();
    }
    setActiveBatchPayload([]);
    setQrModalOpen(false);
    setSyncStatusMsg({
      type: 'success',
      text: `Queue cleared! Ready for next session.`
    });
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  const handleConfirmSyncFinish = async () => {
    if (onSyncSuccess) {
      await onSyncSuccess();
    }
    setActiveBatchPayload([]);
    setIsSyncConfirmOpen(false);
    setQrModalOpen(false);
    setSyncStatusMsg({
      type: 'success',
      text: `Queue cleared! Records transferred to Laptop Admin HQ.`
    });
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  // Effective batch records currently being rendered in QR
  const effectiveQueue = activeBatchPayload.length > 0 ? activeBatchPayload : offlineQueue;

  // Build minified chunks for ultra-fast low-density QR scanning
  // Keys: T=type, d=dutyOfficer, s=sessionName, bn=battalion, co=company, pl=platoon, p=page, n=totalPages
  // Cadet records r: [{i: id, n: name, m: mode, t: timestamp}]
  const totalChunks = Math.max(1, Math.ceil(effectiveQueue.length / CHUNK_SIZE));

  const buildChunkPayload = (chunkIndex) => {
    const start = chunkIndex * CHUNK_SIZE;
    const slice = effectiveQueue.slice(start, start + CHUNK_SIZE);

    // Echelon info stored ONCE in the header object instead of repeating per cadet
    const bn = sessionSetup?.battalion || slice[0]?.battalion || '1st Battalion';
    const co = sessionSetup?.company || slice[0]?.company || 'Alpha Company';
    const pl = sessionSetup?.platoon || slice[0]?.platoon || '1st Platoon';
    const officer = sessionSetup?.dutyOfficer || dutyOfficer || 'Duty Officer';

    // Extract active mode ('OUT' for Time-Out, 'IN' for Time-In)
    const rawMode = sessionSetup?.scanMode || slice[0]?.scanMode || 'Time-In';
    const modeKey = String(rawMode).toLowerCase().includes('out') ? 'OUT' : 'IN';

    return JSON.stringify({
      T: 'RBS',                      // ROTC Batch Sync
      d: officer,                    // Duty Officer (Full string, e.g. "C/LT COL CHARIS S JALIQUE (ROTC) 1CL")
      m: modeKey,                    // Active Scan Mode ('IN' or 'OUT')
      bn: bn,                        // Battalion
      co: co,                        // Company
      pl: pl,                        // Platoon
      p: chunkIndex + 1,             // Current Page (1-indexed)
      n: totalChunks,                // Total Pages
      r: slice.map(item => String(item.cadetId || item.id || item.i || '').trim())
    });
  };

  const currentPayloadString = effectiveQueue.length > 0 ? buildChunkPayload(currentChunk) : '{}';

  return (
    <>
      {/* Sync Status Toast */}
      {syncStatusMsg && (
        <div style={{
          position: 'fixed',
          bottom: '85px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '440px',
          background: '#d1fae5',
          color: '#065f46',
          border: '1px solid #6ee7b7',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 250,
          fontSize: '0.8rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <CheckCircle2 size={18} />
          <span>{syncStatusMsg.text}</span>
        </div>
      )}

      {/* Fixed Bottom Action Bar */}
      {!hideBottomBar && (
        <div className="bottom-sync-bar">
          <button
            className="btn-sync-gold"
            onClick={handleOpenQrModal}
          >
            <QrCode size={20} />
            <span>PRESENT BATCH SYNC QR</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="queue-badge" title="Pending Offline Scans in Local Storage">
              QUEUE: {offlineQueue.length}
            </div>

            {offlineQueue.length > 0 && onResetQueue && (
              <button
                onClick={onResetQueue}
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s ease'
                }}
                title="Clear / Reset Offline Queue"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Batch Sync QR Modal */}
      {isQrModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 350,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '420px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            animation: 'loginSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            {/* Modal Header */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--rotc-green-dark)', fontWeight: 800, fontSize: '1rem', fontFamily: 'Oswald, sans-serif' }}>
                <Smartphone size={20} />
                <span>OFFLINE BATCH SYNC QR CODE</span>
              </div>
              <button onClick={() => setQrModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={22} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>
              Show {totalChunks > 1 ? <strong>each page</strong> : 'this QR code'} to the <strong>Laptop Admin HQ Webcam Scanner</strong> to import attendance!
            </p>

            {/* Page Navigation (if multiple chunks) */}
            {totalChunks > 1 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                marginBottom: '0.75rem',
                background: '#f8fafc',
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                width: '100%'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <button
                    onClick={() => setCurrentChunk(prev => Math.max(0, prev - 1))}
                    disabled={currentChunk === 0}
                    style={{ background: 'none', border: 'none', cursor: currentChunk === 0 ? 'default' : 'pointer', color: currentChunk === 0 ? '#cbd5e1' : 'var(--rotc-green-dark)', padding: '4px' }}
                    title="Previous QR Chunk Page"
                  >
                    <ChevronLeft size={24} />
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--rotc-green-dark)' }}>
                      PAGE {currentChunk + 1} OF {totalChunks}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Cadets {currentChunk * CHUNK_SIZE + 1}–{Math.min(effectiveQueue.length, (currentChunk + 1) * CHUNK_SIZE)} of {effectiveQueue.length}
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentChunk(prev => Math.min(totalChunks - 1, prev + 1))}
                    disabled={currentChunk === totalChunks - 1}
                    style={{ background: 'none', border: 'none', cursor: currentChunk === totalChunks - 1 ? 'default' : 'pointer', color: currentChunk === totalChunks - 1 ? '#cbd5e1' : 'var(--rotc-green-dark)', padding: '4px' }}
                    title="Next QR Chunk Page"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            )}

            {/* High-Contrast SVG QR Code Container (Low-Density Level L for Instant Webcam Reading) */}
            <div style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: '16px',
              border: '3px solid var(--rotc-green-dark)',
              boxShadow: '0 8px 24px rgba(6, 78, 46, 0.2)',
              marginBottom: '1rem'
            }}>
              <QRCodeSVG
                value={currentPayloadString}
                size={260}
                level="L"
                includeMargin={true}
              />
            </div>

            {/* Batch Metrics Summary */}
            <div style={{
              width: '100%',
              background: '#f8fafc',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              padding: '0.75rem',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '0.8rem',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Duty Officer:</span>
                <strong style={{ color: 'var(--rotc-green-dark)' }}>{dutyOfficer}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Session:</span>
                <strong>{sessionName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '4px', marginTop: '2px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Cadets:</span>
                <span style={{ background: 'var(--rotc-yellow-gold)', color: 'var(--text-dark)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 800 }}>
                  {effectiveQueue.length} Cadets ({totalChunks} QR Page{totalChunks > 1 ? 's' : ''})
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                className="btn-sync-gold"
                style={{ width: '100%', fontSize: '0.9rem', padding: '0.75rem' }}
                onClick={handleClearAndFinish}
              >
                <ShieldCheck size={18} />
                <span>MARK AS SCANNED & RESET QUEUE</span>
              </button>

              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  padding: '0.6rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
                onClick={() => setQrModalOpen(false)}
              >
                Close QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Complete Confirmation Modal */}
      <ConfirmModal
        isOpen={isSyncConfirmOpen}
        title="⚠️ Finish Sync & Reset Queue?"
        message={`Confirm: Have all ${totalChunks} QR code page(s) been scanned by the Admin Laptop webcam? This will reset the smartphone offline queue.`}
        confirmLabel="Reset Queue"
        cancelLabel="Cancel"
        onConfirm={handleConfirmSyncFinish}
        onCancel={() => setIsSyncConfirmOpen(false)}
        isDestructive={true}
      />
    </>
  );
}
