import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { User } from 'lucide-react';
import { generateQrPayload } from './IDGenerator';

export default function IDCardPreview({ card }) {
  if (!card) return null;

  const isOfficer = card.type === 'officer' || card.battalion === 'CADET OFFICERS' || card.battalion === 'Brigade HQ';
  const rawDesignation = (card.designation && card.designation !== 'None')
    ? card.designation
    : (card.platoon && card.platoon !== '1st Platoon' ? card.platoon : 'Corps Command Staff');

  const cleanName = (card.name || 'SANTOS, MARIA L').replace(/\.$/, '');
  const cleanId = card.id || '221-11101';

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
          <div className="cr80-info">
            <div className="cr80-name">{cleanName}</div>
            <div className="cr80-rank">{card.rank || 'Cadet'}</div>

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
                  fontSize: rawDesignation.length > 22 ? '0.54rem' : '0.62rem',
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
                fontSize: '0.60rem',
                fontWeight: 800,
                color: 'var(--rotc-green-dark)',
                background: 'rgba(6, 78, 46, 0.08)',
                border: '1px solid rgba(6, 78, 46, 0.18)',
                padding: '2px 5px',
                borderRadius: '5px',
                display: 'inline-flex',
                flexDirection: 'column',
                gap: '1px',
                margin: '2px 0',
                lineHeight: 1.2
              }}>
                <div>
                  {`${card.battalion || '1st Battalion'} • ${card.company ? (card.company.includes('Coy') || card.company.includes('Company') ? card.company : `${card.company} Coy`) : 'Alpha Coy'}`}
                </div>
                <div style={{ color: '#047857', fontWeight: 700 }}>
                  {`${card.platoon || '1st Platoon'}`}
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

          <div className="back-signature-box">
            <div className="sig-line"></div>
            <div className="sig-label">ROTC COMMANDANT SIGNATURE</div>
          </div>
        </div>

        <div className="cr80-footer">
          <span>HONOR • PATRIOTISM • DUTY</span>
        </div>
      </div>
    </div>
  );
}
