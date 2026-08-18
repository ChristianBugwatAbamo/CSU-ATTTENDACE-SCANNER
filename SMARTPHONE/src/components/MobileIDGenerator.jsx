import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Shield, Award, User, Sparkles, Download, RefreshCw, QrCode } from 'lucide-react';

export default function MobileIDGenerator({ sessionSetup }) {
  const [category, setCategory] = useState('basic');
  const [lastName, setLastName] = useState('SANTOS');
  const [firstName, setFirstName] = useState('MARIA');
  const [middleInitial, setMiddleInitial] = useState('L.');
  const [cadetId, setCadetId] = useState('221-11101');
  const [rank, setRank] = useState('Cadet');
  const [battalion, setBattalion] = useState(sessionSetup?.battalion || '1st Battalion');
  const [company, setCompany] = useState(sessionSetup?.company?.replace(' Company', '') || 'Alpha');
  const [platoon, setPlatoon] = useState(sessionSetup?.platoon || '1st Platoon');
  const [designation, setDesignation] = useState('None');
  const [cardSide, setCardSide] = useState('front'); // 'front' | 'back'

  const officerRanks = [
    'Cadet 2LT (ROTC) 4CL',
    'Cadet 1LT (ROTC) 4CL',
    'Cadet 1LT (ROTC) 3CL',
    'Cadet CPT (ROTC) 3CL',
    'Cadet CPT (ROTC) 2CL',
    'Cadet MAJ (ROTC) 2CL',
    'Cadet LT COL (ROTC) 1CL',
    'Cadet COL (ROTC) 1CL'
  ];

  const officerDesignations = [
    'None',
    'Corps Commander',
    'Deputy Commander',
    'Adjutant',
    'S1 Brigade',
    'S2 Brigade',
    'S3 Brigade',
    'S4 Brigade',
    'S7 Brigade',
    '1st Bn Commander',
    '2nd Bn Commander',
    'Alpha Coy Commander',
    'Bravo Coy Commander',
    'Charlie Coy Commander',
    'Delta Coy Commander',
    'Platoon Leader'
  ];

  const getFormattedFullName = () => {
    const last = lastName.trim().toUpperCase();
    const first = firstName.trim().toUpperCase();
    let mi = middleInitial.trim().toUpperCase();
    if (mi && !mi.endsWith('.')) {
      mi = `${mi}.`;
    }
    if (!last && !first) return 'SANTOS, MARIA L.';
    if (last && first) return `${last}, ${first}${mi ? ` ${mi}` : ''}`;
    return `${last || first}${mi ? ` ${mi}` : ''}`;
  };

  const fullName = getFormattedFullName();

  const handleCategorySwitch = (newCat) => {
    setCategory(newCat);
    if (newCat === 'basic') {
      setRank('Cadet');
      setDesignation('None');
    } else {
      setRank('Cadet 2LT (ROTC) 4CL');
      setDesignation('None');
    }
  };

  const handleIdChange = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setCadetId(formatted);
  };

  const qrPayloadString = JSON.stringify({
    id: cadetId || '221-11101',
    name: fullName
  });

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '90px' }}>
      {/* Title Header */}
      <div style={{
        background: 'linear-gradient(135deg, #064e2e 0%, #005a36 100%)',
        color: '#ffffff',
        padding: '1.2rem',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(229, 169, 0, 0.2)', color: 'var(--rotc-yellow-gold)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, marginBottom: '0.35rem' }}>
            <Sparkles size={12} /> CR80 DIGITAL GENERATOR
          </div>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.3rem', margin: 0 }}>Cadet ID Generator</h2>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', margin: '2px 0 0 0' }}>Generate official scannable ROTC QR ID cards</p>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            background: 'var(--rotc-yellow-gold)',
            color: 'var(--text-dark)',
            border: 'none',
            borderRadius: '10px',
            padding: '0.6rem 0.85rem',
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Printer size={16} /> Print
        </button>
      </div>

      {/* Card Preview Switcher */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => setCardSide('front')}
          style={{
            flex: 1,
            padding: '0.55rem',
            borderRadius: '8px',
            border: cardSide === 'front' ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
            background: cardSide === 'front' ? 'var(--rotc-green-dark)' : '#ffffff',
            color: cardSide === 'front' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          Front Side Preview
        </button>
        <button
          onClick={() => setCardSide('back')}
          style={{
            flex: 1,
            padding: '0.55rem',
            borderRadius: '8px',
            border: cardSide === 'back' ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
            background: cardSide === 'back' ? 'var(--rotc-green-dark)' : '#ffffff',
            color: cardSide === 'back' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          Back Side Preview
        </button>
      </div>

      {/* CR80 Card Preview Container */}
      <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', padding: '0.5rem 0' }}>
        {cardSide === 'front' ? (
          /* FRONT SIDE */
          <div style={{
            width: '340px',
            height: '215px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '2px solid var(--rotc-green-dark)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {/* Card Header */}
            <div style={{
              background: 'var(--rotc-green-dark)',
              color: '#ffffff',
              padding: '0.45rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderBottom: '2.5px solid var(--rotc-yellow-gold)'
            }}>
              <img src="/rotc-seal-transparent.png" alt="ROTC Seal" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--rotc-yellow-gold)' }}>ARESCOM • 15TH RCDG</span>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', fontWeight: 700 }}>1501st CDC ROTC UNIT</span>
                <span style={{ fontSize: '0.45rem', opacity: 0.9 }}>CARAGA STATE UNIVERSITY MAIN CAMPUS</span>
              </div>
            </div>

            {/* Card Body */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.65rem', gap: '0.5rem', flexGrow: 1 }}>
              {/* Photo placeholder */}
              <div style={{
                width: '60px',
                height: '74px',
                border: '2px dashed #9ca3af',
                borderRadius: '6px',
                background: '#f9fafb',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <User size={26} color="#9ca3af" />
                <span style={{ fontSize: '0.45rem', fontWeight: 800, color: '#6b7280', marginTop: '2px' }}>OFFICIAL ID</span>
              </div>

              {/* Info Text */}
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--rotc-green-dark)', lineHeight: 1.1 }}>
                  {fullName}
                </div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#005a36' }}>
                  {rank}
                </div>
                <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--rotc-green-dark)', background: 'rgba(6,78,46,0.1)', padding: '1px 5px', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                  {battalion} • {company} Coy • {platoon}
                </div>
                {designation && designation !== 'None' && (
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#064e2e' }}>{designation}</div>
                )}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dark)', marginTop: '2px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>ID NO: </span>
                  <strong>{cadetId}</strong>
                </div>
              </div>

              {/* Scannable QR Code */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ background: '#ffffff', padding: '2px', border: '1px solid var(--border-light)', borderRadius: '4px' }}>
                  <QRCodeSVG
                    value={qrPayloadString}
                    size={56}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <span style={{ fontSize: '0.42rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '2px' }}>QR CODE</span>
              </div>
            </div>

            {/* Card Footer */}
            <div style={{ background: 'var(--rotc-yellow-gold)', color: 'var(--text-dark)', textAlign: 'center', padding: '0.2rem', fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.8px' }}>
              HONOR • PATRIOTISM • DUTY
            </div>
          </div>
        ) : (
          /* BACK SIDE */
          <div style={{
            width: '340px',
            height: '215px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '2px solid var(--rotc-green-dark)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            <div style={{ background: '#111827', color: '#ffffff', textAlign: 'center', padding: '0.35rem', fontFamily: 'Oswald, sans-serif', fontSize: '0.72rem', letterSpacing: '0.5px' }}>
              OFFICIAL ROTC CADET IDENTIFICATION
            </div>

            <div style={{ padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1 }}>
              <p style={{ fontSize: '0.52rem', color: 'var(--text-dark)', lineHeight: 1.25, margin: 0 }}>
                This card certifies that the person named on the front is an officially enrolled cadet of CSU ROTC Unit.
              </p>

              <div style={{ background: '#f8fafc', padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.52rem', fontWeight: 800, color: 'var(--rotc-green-dark)' }}>IN CASE OF EMERGENCY NOTIFY:</div>
                <div style={{ fontSize: '0.48rem', color: 'var(--text-dark)' }}>CSU ROTC Commandant Office / Duty Sergeant</div>
                <div style={{ fontSize: '0.48rem', color: 'var(--text-dark)' }}>Unit Strength: 1,184 Cadets • 1501st CDC</div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '2px' }}>
                <div style={{ borderBottom: '1px dashed #9ca3af', width: '60%', margin: '0 auto 2px auto' }}></div>
                <div style={{ fontSize: '0.48rem', fontWeight: 800, color: 'var(--text-dark)' }}>ROTC COMMANDANT SIGNATURE</div>
              </div>
            </div>

            <div style={{ background: 'var(--rotc-yellow-gold)', color: 'var(--text-dark)', textAlign: 'center', padding: '0.2rem', fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.8px' }}>
              HONOR • PATRIOTISM • DUTY
            </div>
          </div>
        )}
      </div>

      {/* Editor Form Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.25rem',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Category Switcher */}
        <div style={{ display: 'flex', background: '#f3f4f6', padding: '3px', borderRadius: '10px', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => handleCategorySwitch('basic')}
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: category === 'basic' ? 'var(--rotc-green-dark)' : 'transparent',
              color: category === 'basic' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Shield size={14} /> Basic Cadet
          </button>
          <button
            type="button"
            onClick={() => handleCategorySwitch('officer')}
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: category === 'officer' ? 'var(--rotc-green-dark)' : 'transparent',
              color: category === 'officer' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Award size={14} /> Cadet Officer
          </button>
        </div>

        {/* Input Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 65px', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>M.I.</label>
              <input
                type="text"
                maxLength={3}
                value={middleInitial}
                onChange={(e) => setMiddleInitial(e.target.value.toUpperCase().slice(0, 3))}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Cadet ID</label>
              <input
                type="text"
                maxLength={9}
                value={cadetId}
                onChange={(e) => handleIdChange(e.target.value)}
                placeholder="221-11101"
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Rank</label>
              {category === 'basic' ? (
                <input
                  type="text"
                  value="Cadet"
                  disabled
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: '#f3f4f6', fontSize: '0.85rem', fontWeight: 600 }}
                />
              ) : (
                <select
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  {officerRanks.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Battalion</label>
              <select
                value={battalion}
                onChange={(e) => setBattalion(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.8rem', fontWeight: 600 }}
              >
                <option value="1st Battalion">1st Bn</option>
                <option value="2nd Battalion">2nd Bn</option>
                <option value="Brigade HQ">Brigade HQ</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Company</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.8rem', fontWeight: 600 }}
              >
                <option value="Alpha">Alpha</option>
                <option value="Bravo">Bravo</option>
                <option value="Charlie">Charlie</option>
                <option value="Delta">Delta</option>
                <option value="Headquarters">HQ</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Platoon</label>
              <select
                value={platoon}
                onChange={(e) => setPlatoon(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.8rem', fontWeight: 600 }}
              >
                <option value="1st Platoon">1st Pltn</option>
                <option value="2nd Platoon">2nd Pltn</option>
                <option value="3rd Platoon">3rd Pltn</option>
                <option value="4th Platoon">4th Pltn</option>
              </select>
            </div>
          </div>

          {category === 'officer' && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Designation</label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {officerDesignations.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
