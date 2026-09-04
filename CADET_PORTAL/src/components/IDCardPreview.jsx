import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { User } from 'lucide-react';

// Helpers for Generating Compact QR Payload String
const getLastNameOnly = (nameStr) => {
  if (!nameStr) return '';
  const clean = nameStr.split(',')[0].trim();
  return clean.toUpperCase();
};

const extractNumber = (val) => {
  if (!val) return '';
  const match = String(val).match(/\d+/);
  return match ? match[0] : '';
};

const getCompanyCode = (coy) => {
  if (!coy) return '';
  const c = String(coy).toUpperCase();
  if (c.includes('ALPHA') || c.startsWith('A')) return 'A';
  if (c.includes('BRAVO') || c.startsWith('B')) return 'B';
  if (c.includes('CHARLIE') || c.startsWith('C')) return 'C';
  if (c.includes('DELTA') || c.startsWith('D')) return 'D';
  if (c.includes('ECHO') || c.startsWith('E')) return 'E';
  if (c.includes('FOXTROT') || c.startsWith('F')) return 'F';
  if (c.includes('HQ') || c.includes('HEADQUARTERS')) return 'HQ';
  return c.slice(0, 1);
};

export const generateQrPayload = (cadet) => {
  if (!cadet) return '{}';
  const payload = {
    id: cadet.id || cadet.cadet_id || cadet.cadetId || '',
    name: getLastNameOnly(cadet.name || cadet.full_name || cadet.fullName || ''),
    bat: extractNumber(cadet.battalion),
    coy: getCompanyCode(cadet.company),
    pl: extractNumber(cadet.platoon),
  };

  return JSON.stringify(payload);
};

export default function IDCardPreview({ card }) {
  if (!card) return null;

  // Directly feed selected battalion to badge text
  const selectedBattalion = (
    card.battalion && card.battalion !== 'CADET OFFICERS' && card.battalion !== 'None'
      ? card.battalion
      : (card.unit || '1st Battalion')
  ).toUpperCase();

  const formattedCompany = (
    card.company
      ? (card.company.includes('Coy') || card.company.includes('Company') ? card.company : `${card.company} Company`)
      : 'Alpha Company'
  ).toUpperCase();

  const formattedPlatoon = (card.platoon || '1st Platoon').toUpperCase();

  const unitLine1 = `${selectedBattalion} • ${formattedCompany}`;
  const unitLine2 = formattedPlatoon;

  const currentSettings = (() => {
    try {
      const raw = localStorage.getItem('csu_rotc_admin_settings');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  })();
  const activeSignatoryName = card.signatoryName || currentSettings?.id_signatory_name || currentSettings?.signatoryName || currentSettings?.commanding_officer || currentSettings?.commandingOfficer || 'COL CHARIS J ABAMO INF (GSC) PA';
  const activeSignatoryTitle = card.signatoryTitle || currentSettings?.id_signatory_title || currentSettings?.signatoryDesignation || currentSettings?.commanding_officer_title || currentSettings?.commandingOfficerTitle || 'Commandant, CSU ROTC Unit';
  const activeSignatureUrl = card.signatureUrl || currentSettings?.id_signature_url || currentSettings?.signatureImageUrl || '';

  const cleanName = (card.name || 'LASTNAME, FIRSTNAME M.I.').replace(/\.$/, '');
  const cleanId = card.id || card.cadetId || '221-00000';

  // Derive Officer status and designation directly from card rank, type, battalion, and designation
  const isOfficer = Boolean(
    card.isOfficer ||
    card.type === 'Cadet Officer' ||
    card.battalion === 'CADET OFFICERS' ||
    String(card.rank || '').toUpperCase().includes('1CL') ||
    String(card.rank || '').toUpperCase().includes('2CL') ||
    String(card.rank || '').toUpperCase().includes('3CL') ||
    String(card.rank || '').toUpperCase().includes('4CL') ||
    String(card.rank || '').toUpperCase().includes('COL') ||
    String(card.rank || '').toUpperCase().includes('MAJ') ||
    String(card.rank || '').toUpperCase().includes('CPT') ||
    String(card.rank || '').toUpperCase().includes('LT') ||
    String(card.rank || '').toLowerCase().includes('officer')
  );

  const rawDesignation = String(
    card.designation && card.designation !== 'None'
      ? card.designation
      : (card.platoon || (isOfficer ? 'RANK / POSITION' : '1ST PLATOON'))
  ).trim().toUpperCase();

  // Dynamic font scaling & tracking for Cadet Name to enforce single-line layout
  const getNameStyles = (nameStr) => {
    const len = (nameStr || '').length;
    if (len > 28) {
      return { fontSize: '0.62rem', letterSpacing: '-0.4px' };
    }
    if (len > 24) {
      return { fontSize: '0.68rem', letterSpacing: '-0.3px' };
    }
    if (len > 20) {
      return { fontSize: '0.74rem', letterSpacing: '-0.2px' };
    }
    if (len > 16) {
      return { fontSize: '0.82rem', letterSpacing: '-0.1px' };
    }
    return { fontSize: '0.94rem', letterSpacing: '0px' };
  };

  const nameStyles = getNameStyles(cleanName);

  // S7 Specific 2-Line Split Rule
  const isS7CivilMilitary = isOfficer && rawDesignation.toLowerCase().includes('s7') && rawDesignation.toLowerCase().includes('civil military');
  let s7Line1 = '';
  let s7Line2 = '';
  if (isS7CivilMilitary && rawDesignation.includes('(')) {
    const parts = rawDesignation.split('(');
    s7Line1 = parts[0].trim().toUpperCase();
    s7Line2 = `(${parts.slice(1).join('(')}`.trim().toUpperCase();
  }

  return (
    <div className="double-sided-card-pair card-category-transition">
      {/* ========================================================================= */}
      {/* FRONT SIDE OF CR80 CARD                                                   */}
      {/* ========================================================================= */}
      <div className="cr80-id-card printable-card front-card">
        {/* Header Bar */}
        <div className="cr80-header">
          <img
            src="/rotc-seal-transparent.png"
            alt="ROTC Seal"
            className="cr80-logo-img"
            style={{ width: '38px', height: '38px', objectFit: 'contain', background: 'transparent' }}
          />
          <div className="cr80-header-titles">
            <div className="sub-title">ARESCOM • 15th RCDG • 1501st CDC</div>
            <div className="main-title">CARAGA STATE UNIVERSITY MAIN CAMPUS</div>
            <div className="campus-title">ROTC UNIT</div>
          </div>
        </div>

        {/* Card Body */}
        <div className="cr80-body">
          {/* Official Photo Avatar Box */}
          <div className="cr80-photo-box">
            <User size={32} color="#9ca3af" />
            <span className="photo-label">OFFICIAL ID</span>
          </div>

          {/* Cadet Details */}
          <div className="cr80-info" style={{ minWidth: 0 }}>
            <div
              className="cr80-name"
              title={cleanName}
              style={{
                fontSize: nameStyles.fontSize,
                letterSpacing: nameStyles.letterSpacing,
                whiteSpace: 'nowrap',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.15
              }}
            >
              {cleanName}
            </div>
            <div className="cr80-rank">CADET</div>

            {/* Echelon Badge Container */}
            {isOfficer ? (
              isS7CivilMilitary && s7Line1 ? (
                <div className="cr80-echelon-badge cr80-echelon-badge-s7" style={{
                  fontSize: '0.56rem',
                  fontWeight: 800,
                  color: 'var(--rotc-green-dark)',
                  background: 'rgba(6, 78, 46, 0.08)',
                  border: '1px solid rgba(6, 78, 46, 0.18)',
                  padding: '2px 5px',
                  borderRadius: '5px',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  margin: '2px 0',
                  lineHeight: 1.15,
                  letterSpacing: '0.2px',
                  textTransform: 'uppercase',
                  maxWidth: '100%',
                  minHeight: '24px'
                }}>
                  <div>{s7Line1}</div>
                  <div style={{ fontSize: '0.48rem', color: '#047857', fontWeight: 700 }}>
                    {s7Line2}
                  </div>
                </div>
              ) : (
                <div className="cr80-echelon-badge" style={{
                  fontSize: rawDesignation.length > 28 ? '0.49rem' : rawDesignation.length > 20 ? '0.54rem' : '0.62rem',
                  fontWeight: 800,
                  color: 'var(--rotc-green-dark)',
                  background: 'rgba(6, 78, 46, 0.08)',
                  border: '1px solid rgba(6, 78, 46, 0.18)',
                  padding: '3px 6px',
                  borderRadius: '5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  margin: '2px 0',
                  lineHeight: 1.15,
                  letterSpacing: '0.2px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  minHeight: '24px'
                }}>
                  {rawDesignation}
                </div>
              )
            ) : (
              <div className="cr80-echelon-badge cr80-echelon-badge-basic" style={{
                fontSize: '0.52rem',
                fontWeight: 800,
                color: 'var(--rotc-green-dark)',
                background: 'rgba(6, 78, 46, 0.08)',
                border: '1px solid rgba(6, 78, 46, 0.18)',
                padding: '2px 6px',
                borderRadius: '5px',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                textAlign: 'left',
                margin: '2px 0',
                lineHeight: 1.18,
                letterSpacing: '0.2px',
                textTransform: 'uppercase',
                maxWidth: '100%',
                width: 'fit-content'
              }}>
                <div style={{ whiteSpace: 'nowrap', fontSize: '0.50rem', textAlign: 'left' }}>
                  {unitLine1}
                </div>
                <div style={{ color: '#047857', fontWeight: 800, fontSize: '0.49rem', whiteSpace: 'nowrap', textAlign: 'left', alignSelf: 'flex-start' }}>
                  {unitLine2}
                </div>
              </div>
            )}

            <div className="cr80-id-no">
              <span>ID NO:</span> <strong>{cleanId}</strong>
            </div>
          </div>

          {/* Scannable QR Code */}
          <div className="cr80-qr-section">
            <div className="qr-wrapper">
              <QRCodeSVG
                value={generateQrPayload(card)}
                size={80}
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="qr-caption">QR CODE</div>
          </div>
        </div>

        {/* Motto Footer Bar */}
        <div className="cr80-footer">
          <span>HONOR • PATRIOTISM • DUTY</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BACK SIDE OF CR80 CARD                                                    */}
      {/* ========================================================================= */}
      <div className="cr80-id-card printable-card back-card">
        <div className="cr80-header" style={{ background: '#111827' }}>
          <div style={{ textAlign: 'center', width: '100%', fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', color: '#ffffff', letterSpacing: '0.5px' }}>
            OFFICIAL ROTC CADET IDENTIFICATION
          </div>
        </div>

        <div className="cr80-back-body">
          <p className="back-notice">This card certifies that the person named on the front is an officially enrolled cadet of CSU ROTC Unit.</p>

          <div className="back-emergency-section">
            <div className="emerg-title">IN CASE OF EMERGENCY NOTIFY:</div>
            <div className="emerg-detail">CSU ROTC Commandant Office / Duty Sergeant</div>
            <div className="emerg-detail">Unit Strength: 1,184 Cadets • 1501st CDC</div>
          </div>

          <div className="back-signature-box" style={{ position: 'relative', textAlign: 'center' }}>
            {activeSignatureUrl && (
              <img
                src={activeSignatureUrl}
                alt="Signature"
                style={{
                  position: 'absolute',
                  bottom: '22px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxHeight: '44px',
                  pointerEvents: 'none',
                  filter: 'contrast(1.2)'
                }}
              />
            )}
            <div className="sig-line"></div>
            <div className="sig-label" style={{ fontWeight: 800, fontSize: '0.66rem', letterSpacing: '0.03em', color: '#0f172a' }}>
              {activeSignatoryName}
            </div>
            <div className="sig-sublabel" style={{ fontSize: '0.55rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginTop: '1px' }}>
              {activeSignatoryTitle}
            </div>
          </div>
        </div>

        <div className="cr80-footer">
          <span>HONOR • PATRIOTISM • DUTY</span>
        </div>
      </div>
    </div>
  );
}
