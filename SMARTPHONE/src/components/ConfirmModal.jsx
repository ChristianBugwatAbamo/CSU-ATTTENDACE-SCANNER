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
      background: 'rgba(0, 15, 8, 0.75)',
      backdropFilter: 'blur(5px)',
      WebkitBackdropFilter: 'blur(5px)',
      zIndex: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '380px',
        padding: '1.5rem',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
        border: '1px solid var(--border-light)',
        animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header Icon & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
          <div style={{
            background: isDestructive ? '#fee2e2' : '#fef3c7',
            color: isDestructive ? '#dc2626' : '#d97706',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
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
              color: 'var(--text-dark)',
              fontFamily: 'Oswald, sans-serif',
              letterSpacing: '0.3px'
            }}>
              {title}
            </h3>
          </div>
        </div>

        {/* Body Text */}
        <p style={{
          fontSize: '0.88rem',
          lineHeight: '1.45',
          color: '#4b5563',
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
              padding: '0.72rem 1rem',
              borderRadius: '10px',
              border: '1.5px solid #d1d5db',
              background: '#f9fafb',
              color: '#374151',
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
              padding: '0.72rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: isDestructive ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'var(--rotc-green)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: isDestructive ? '0 4px 12px rgba(220, 38, 38, 0.35)' : 'var(--shadow-sm)',
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
