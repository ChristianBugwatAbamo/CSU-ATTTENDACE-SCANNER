import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Helpers for Generating Compact QR Payload String & Text Formatters
export const getLastNameOnly = (nameStr) => {
  if (!nameStr) return '';
  const clean = nameStr.split(',')[0].trim();
  if (nameStr.includes(',')) return clean.toUpperCase();
  const parts = nameStr.trim().split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
};

export const extractNumber = (str) => {
  if (!str && str !== 0) return 1;
  if (typeof str === 'number') return str;
  const match = String(str).match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

export const getCompanyCode = (companyStr) => {
  if (!companyStr) return 1;
  const upper = String(companyStr).toUpperCase();
  if (upper.includes('ALPHA') || upper === '1') return 1;
  if (upper.includes('BRAVO') || upper === '2') return 2;
  if (upper.includes('CHARLIE') || upper === '3') return 3;
  if (upper.includes('DELTA') || upper === '4') return 4;
  return 1;
};

export const generateQrPayload = (cadet) => {
  if (!cadet) return '{}';
  const payload = {
    id: cadet.id || cadet.cadet_id || cadet.cadetId || '',
    name: cadet.lastName ? String(cadet.lastName).trim().toUpperCase() : getLastNameOnly(cadet.name || cadet.full_name || cadet.fullName || ''),
    bat: extractNumber(cadet.battalion),
    coy: getCompanyCode(cadet.company),
    pl: extractNumber(cadet.platoon),
  };

  return JSON.stringify(payload);
};

const formatBn = (bn) => {
  if (!bn) return '';
  let s = String(bn).trim().toUpperCase();
  s = s.replace(/BATTALION/g, 'BAT').replace(/\bBN\b/g, 'BAT').trim();
  if (/^\d+(ST|ND|RD|TH)?$/.test(s)) s = `${s} BAT`;
  return s;
};

const formatCo = (co) => {
  if (!co) return '';
  let s = String(co).trim().toUpperCase();
  s = s.replace(/COMPANY/g, 'COY').trim();
  if (!s.includes('COY') && !s.includes('HQ') && !s.includes('BAND')) s = `${s} COY`;
  return s;
};

const formatPl = (pl) => {
  if (!pl) return '—';
  let s = String(pl).trim().toUpperCase();
  if (/^\d+(ST|ND|RD|TH)?$/.test(s)) s = `${s} PLATOON`;
  else if (!s.includes('PLATOON') && !s.includes('PLT')) s = `${s} PLATOON`;
  return s;
};

const IDCardPreview = React.forwardRef(({ card }, ref) => {
  if (!card) return null;

  // Line 1: LAST NAME ONLY (e.g., CALIGUID)
  const lastNameOnly = (card.lastName ? String(card.lastName).trim().toUpperCase() : getLastNameOnly(card.name || card.full_name || card.fullName || '')) || 'UNKNOWN CADET';

  // Line 2: Cadet ID Badge (e.g., 221-00001)
  const cleanId = card.id || card.cadetId || card.cadet_id || '221-00000';

  // Line 3: Battalion & Company (e.g., 1ST BAT • ALPHA COY)
  const bn = formatBn(card.battalion);
  const co = formatCo(card.company);
  const bnCoLine = [bn, co].filter(Boolean).join(' • ') || '—';

  // Line 4: Platoon (e.g., 1ST PLATOON)
  const plLine = formatPl(card.platoon);

  return (
    <div
      ref={ref}
      id="printable-qr-pass"
      className="qr-pass-tile printable-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '10px 8px',
        background: '#ffffff',
        border: '1.5px solid #1a3a2a',
        borderRadius: '6px',
        boxShadow: 'none',
        width: '164px',
        maxWidth: '168px',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        overflow: 'hidden'
      }}
    >
      {/* QR Code */}
      <div style={{
        background: '#fff',
        padding: '4px',
        borderRadius: '4px',
        border: '1px solid #cbd5e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <QRCodeSVG
          value={generateQrPayload(card)}
          size={105}
          bgColor="#ffffff"
          fgColor="#064e2e"
          level="M"
          includeMargin={false}
        />
      </div>

      {/* Line 1: LAST NAME ONLY (e.g. TRAZARES) */}
      <div style={{
        fontFamily: 'Oswald, sans-serif',
        fontWeight: 800,
        fontSize: '0.8rem',
        color: '#0f172a',
        textAlign: 'center',
        lineHeight: 1.15,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        maxWidth: '100%',
        wordBreak: 'break-word',
        marginTop: '2px'
      }}>
        {lastNameOnly}
      </div>

      {/* Line 2: Cadet ID Badge (e.g. 221-00003) */}
      <div style={{
        fontFamily: 'monospace',
        fontWeight: 800,
        fontSize: '0.66rem',
        color: '#064e2e',
        letterSpacing: '0.06em',
        background: 'rgba(6,78,46,0.06)',
        border: '1px solid rgba(6,78,46,0.2)',
        padding: '1px 7px',
        borderRadius: '4px',
        lineHeight: 1.3
      }}>
        {cleanId}
      </div>

      {/* Line 3: Battalion & Company (e.g. 1ST BAT • ALPHA COY) */}
      <div style={{
        fontSize: '0.6rem',
        color: '#1e293b',
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: '0.03em',
        textTransform: 'uppercase'
      }}>
        {bnCoLine}
      </div>

      {/* Line 4: Platoon (e.g. 1ST PLATOON) */}
      <div style={{
        fontSize: '0.56rem',
        color: '#475569',
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }}>
        {plLine}
      </div>
    </div>
  );
});

export default IDCardPreview;
