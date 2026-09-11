import React, { useState } from 'react';
import {
  ShieldCheck,
  Calendar,
  Clock,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Loader2,
  Layers,
  Check
} from 'lucide-react';
import { toDateKey } from '../utils/attendanceRules';

// Format YYYY-MM-DD to friendly student/admin display
const formatFriendlyDate = (dateStr) => {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  try {
    const parts = String(dateStr).trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return dateStr;
  } catch (_) {
    return dateStr;
  }
};

export default function DutyOfficerActionModal({
  isOpen,
  record,
  gracePeriodDays = 3,
  onClose,
  onApprove,
  onDeclareAbsent,
  isLoading = false
}) {
  const [actionType, setActionType] = useState(null); // 'APPROVE' | 'REJECT' | null

  if (!isOpen || !record) return null;

  const isPending = record.status === 'EXCUSE_PENDING';
  const isExcused = record.status === 'EXCUSED';

  // Calculate dynamic grace period info
  const getGraceInfo = () => {
    if (!isPending) {
      return { type: 'resolved', label: isExcused ? 'Approved (Excused)' : 'Closed / Declared Absent', isResolved: true };
    }

    const baseStr = record.date || (record.submittedAt ? toDateKey(new Date(record.submittedAt)) : null);
    if (!baseStr) return { type: 'unknown', label: 'No drill date recorded' };

    try {
      const parts = String(baseStr).split('-');
      if (parts.length !== 3) return { type: 'unknown', label: 'Invalid date' };

      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      const deadline = new Date(year, month, day + Number(gracePeriodDays), 23, 59, 59, 999);
      const now = new Date();
      const diffMs = deadline.getTime() - now.getTime();

      if (diffMs <= 0) {
        return { type: 'expired', label: '🔴 Expired (Auto-Absent)' };
      }

      const today = new Date();
      const isSameDay = deadline.getFullYear() === today.getFullYear() &&
                        deadline.getMonth() === today.getMonth() &&
                        deadline.getDate() === today.getDate();

      if (isSameDay) {
        return { type: 'today', label: '⚠️ Expiring Today' };
      }

      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfDeadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
      const daysLeft = Math.round((startOfDeadlineDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 0) {
        return { type: 'expired', label: '🔴 Expired (Auto-Absent)' };
      }
      if (daysLeft === 1) {
        return { type: 'warning', label: '⏳ 1 Day Left' };
      }
      return { type: 'pending', label: `⏳ ${daysLeft} Days Left` };
    } catch (_) {
      return { type: 'unknown', label: 'Unknown status' };
    }
  };

  const graceInfo = getGraceInfo();

  const handleApproveClick = async () => {
    setActionType('APPROVE');
    try {
      if (onApprove) await onApprove(record);
    } finally {
      setActionType(null);
    }
  };

  const handleDeclareAbsentClick = async () => {
    setActionType('REJECT');
    try {
      if (onDeclareAbsent) await onDeclareAbsent(record);
    } finally {
      setActionType(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(3, 20, 12, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #005a36 0%, #004529 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #003620'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6ee7b7'
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  letterSpacing: '0.3px',
                  fontFamily: 'Oswald, sans-serif'
                }}
              >
                DUTY OFFICER VERIFICATION
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#a7f3d0' }}>
                Verify physical excuse letter submission & resolve attendance status
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Cadet Summary */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
          
          {/* Cadet Profile Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '14px',
              padding: '1rem 1.15rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>
                Cadet Personnel
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {record.name}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#047857', fontWeight: 700, marginTop: '2px' }}>
                {record.rank} • {record.battalion} • {record.company} • {record.platoon}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Cadet ID
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  color: '#005a36',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '4px 9px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  marginTop: '2px'
                }}
              >
                {record.cadetId}
              </span>
            </div>
          </div>

          {/* Key Dates & Policy Countdown Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Formation Drill Date */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                <Calendar size={13} color="#005a36" />
                <span>Drill Formation Date</span>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {formatFriendlyDate(record.date)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                {record.date}
              </div>
            </div>

            {/* Date Filed */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                <Clock size={13} color="#2563eb" />
                <span>Date Filed</span>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {record.submittedAt ? new Date(record.submittedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) : '—'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                {record.submittedAt ? new Date(record.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unrecorded'}
              </div>
            </div>
          </div>

          {/* Policy Grace Period Remaining Badge */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>
              Grace Period Policy Countdown:
            </div>
            <div>
              {graceInfo.type === 'resolved' ? (
                <span style={{ color: '#047857', fontWeight: 800, fontSize: '0.78rem' }}>
                  {graceInfo.label}
                </span>
              ) : graceInfo.type === 'expired' ? (
                <span
                  style={{
                    background: '#fef2f2',
                    color: '#b91c1c',
                    border: '1px solid #fca5a5',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontWeight: 900,
                    fontSize: '0.74rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {graceInfo.label}
                </span>
              ) : graceInfo.type === 'today' ? (
                <span
                  style={{
                    background: '#fffbeb',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontWeight: 900,
                    fontSize: '0.74rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {graceInfo.label}
                </span>
              ) : (
                <span
                  style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontWeight: 900,
                    fontSize: '0.74rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {graceInfo.label}
                </span>
              )}
            </div>
          </div>

          {/* Reason for Absence Card */}
          <div
            style={{
              background: '#fdfefe',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '1rem',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              <FileText size={14} color="#005a36" />
              <span>Cadet Excuse Statement / Reason</span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '0.88rem',
                color: '#1e293b',
                lineHeight: 1.45,
                fontStyle: 'italic',
                backgroundColor: '#ffffff',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                wordBreak: 'break-word'
              }}
            >
              "{record.reason || record.excuseReason || 'No reason provided'}"
            </p>
          </div>

        </div>

        {/* Modal Actions Footer */}
        <div
          style={{
            padding: '1.15rem 1.5rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '0.6rem 1.15rem',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#475569',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Cancel
          </button>

          {/* Verification Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* [❌ Declare Absent / Reject] */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleDeclareAbsentClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.65rem 1.15rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: '#dc2626',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                transition: 'all 0.15s ease'
              }}
              title="Reject excuse or declare absent"
            >
              {actionType === 'REJECT' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Declaring Absent...</span>
                </>
              ) : (
                <>
                  <XCircle size={15} />
                  <span>Declare Absent</span>
                </>
              )}
            </button>

            {/* [✅ Approve Excuse] */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleApproveClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: '#059669',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                transition: 'all 0.15s ease'
              }}
              title="Approve official excuse upon receipt of physical letter"
            >
              {actionType === 'APPROVE' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Approving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Approve Excuse</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
