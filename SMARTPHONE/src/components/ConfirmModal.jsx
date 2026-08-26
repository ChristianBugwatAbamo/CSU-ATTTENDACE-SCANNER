import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = "Reset Scanning Session?",
  message = "Are you sure you want to clear all scanned records from this device? This action cannot be undone.",
  confirmLabel = "Clear Queue",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = true
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'var(--bg-dark-card)',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '390px',
        padding: '1.5rem',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.75)',
        border: '1.5px solid var(--border-dark)',
        animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header Icon & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div style={{
            background: isDestructive ? 'rgba(239, 68, 68, 0.18)' : 'rgba(245, 158, 11, 0.18)',
            color: isDestructive ? '#f87171' : 'var(--rotc-gold-bright)',
            border: `1.5px solid ${isDestructive ? '#ef4444' : 'var(--rotc-gold-bright)'}`,
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#ffffff',
              fontFamily: 'Oswald, sans-serif',
              letterSpacing: '0.4px'
            }}>
              {title}
            </h3>
          </div>
        </div>

        {/* Body Text */}
        <p style={{
          fontSize: '0.86rem',
          lineHeight: '1.5',
          color: 'var(--text-subtle)',
          margin: '0 0 1.35rem 0'
        }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem'
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1.5px solid var(--border-dark)',
              background: 'var(--bg-dark-input)',
              color: 'var(--text-bright)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: isDestructive ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: isDestructive ? '0 4px 12px rgba(220, 38, 38, 0.4)' : '0 4px 12px rgba(16, 185, 129, 0.4)',
              transition: 'transform 0.15s ease'
            }}
          >
            {isDestructive && <Trash2 size={16} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
