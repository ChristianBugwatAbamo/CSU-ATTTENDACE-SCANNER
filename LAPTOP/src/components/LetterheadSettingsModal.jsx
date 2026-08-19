import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  X,
  CheckCircle,
  RotateCcw,
  Shield,
  Building,
  MapPin,
  Award,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Trash2
} from 'lucide-react';
import {
  DEFAULT_LETTERHEAD,
  getActiveLetterhead,
  saveActiveLetterhead
} from '../utils/excelExport';

export default function LetterheadSettingsModal({ isOpen, onClose, onSaved }) {
  const [form, setForm] = useState(DEFAULT_LETTERHEAD);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const leftLogoInputRef = useRef(null);
  const rightLogoInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setForm(getActiveLetterhead());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Convert uploaded image file to base64 Data URL
  const handleFileUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target.result;
      setForm(prev => ({ ...prev, [field]: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleResetDefaults = () => {
    setForm(DEFAULT_LETTERHEAD);
  };

  const handleSave = () => {
    saveActiveLetterhead(form);
    setSavedSuccess(true);
    if (onSaved) onSaved(form);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1.25rem',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        maxWidth: '720px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.75rem',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-light)',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px', borderRadius: '8px', display: 'flex' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--rotc-green-dark)' }}>
                Official Excel Letterhead Settings
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Configure official letterhead text and upload Left & Right unit seals printed on exported <code>.xlsx</code> reports.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Letterhead Preview Card with Left & Right Logos */}
        <div style={{
          background: '#f8fafc',
          border: '1px dashed #065f46',
          borderRadius: '10px',
          padding: '1.2rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Sparkles size={12} /> Live Header Preview on Each [Company] - [Platoon] Sheet
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            {/* Left Logo Preview */}
            <div style={{ width: '64px', height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              {form.leftLogoUrl ? (
                <img src={form.leftLogoUrl} alt="1501st CDC Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', padding: '2px' }}>Left Logo</span>
              )}
            </div>

            {/* Center Letterhead Text */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#064e2e', textTransform: 'uppercase' }}>
                {form.headquarters || 'HEADQUARTERS 1501st (CSU) COMMUNITY DEFENSE CENTER'}
              </div>
              <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: '#475569', marginTop: '2px' }}>
                {form.parentCommand || '15th Regional Community Defense Group, Reserve Command, Philippine Army'}
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                {form.unitName || 'CSU ROTC UNIT (1501st CDC)'} • {form.location || 'Ampayon, Butuan City'}
              </div>
            </div>

            {/* Right Logo Preview */}
            <div style={{ width: '64px', height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              {form.rightLogoUrl ? (
                <img src={form.rightLogoUrl} alt="ROTC Unit Seal" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', padding: '2px' }}>Right Logo</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: Left & Right Logo File Upload Inputs */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--rotc-green-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ImageIcon size={15} /> Official Unit Insignia & Seals (Left & Right)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Left Logo: 1501st CDC Logo */}
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.9rem', background: '#ffffff' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem', color: '#1e293b' }}>
                Left Logo (1501st CDC Insignia)
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8fafc' }}>
                  {form.leftLogoUrl ? (
                    <img src={form.leftLogoUrl} alt="Left Seal" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <ImageIcon size={20} style={{ color: '#94a3b8' }} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <input
                    type="file"
                    ref={leftLogoInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, 'leftLogoUrl')}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => leftLogoInputRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  >
                    <Upload size={13} /> Upload Image File
                  </button>

                  {form.leftLogoUrl && (
                    <button
                      type="button"
                      onClick={() => handleChange('leftLogoUrl', '')}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '3px', padding: 0 }}
                    >
                      <Trash2 size={11} /> Remove
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                className="form-control form-control-sm"
                value={form.leftLogoUrl}
                onChange={(e) => handleChange('leftLogoUrl', e.target.value)}
                placeholder="Or paste Image URL / path..."
                style={{ fontSize: '0.75rem' }}
              />
            </div>

            {/* Right Logo: ROTC Unit Seal */}
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.9rem', background: '#ffffff' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem', color: '#1e293b' }}>
                Right Logo (ROTC Unit Seal)
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8fafc' }}>
                  {form.rightLogoUrl ? (
                    <img src={form.rightLogoUrl} alt="Right Seal" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <ImageIcon size={20} style={{ color: '#94a3b8' }} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <input
                    type="file"
                    ref={rightLogoInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, 'rightLogoUrl')}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => rightLogoInputRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  >
                    <Upload size={13} /> Upload Image File
                  </button>

                  {form.rightLogoUrl && (
                    <button
                      type="button"
                      onClick={() => handleChange('rightLogoUrl', '')}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '3px', padding: 0 }}
                    >
                      <Trash2 size={11} /> Remove
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                className="form-control form-control-sm"
                value={form.rightLogoUrl}
                onChange={(e) => handleChange('rightLogoUrl', e.target.value)}
                placeholder="Or paste Image URL / path..."
                style={{ fontSize: '0.75rem' }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Official Letterhead Text Inputs */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--rotc-green-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Building size={15} /> Official Letterhead Text
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* 1. Headquarters Line */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: '#1e293b' }}>
                <Shield size={14} style={{ color: 'var(--rotc-green-dark)' }} />
                Headquarters Title Line
              </label>
              <input
                type="text"
                className="form-control"
                value={form.headquarters}
                onChange={(e) => handleChange('headquarters', e.target.value)}
                placeholder="e.g. HEADQUARTERS 1501st (CSU) COMMUNITY DEFENSE CENTER"
                style={{ fontSize: '0.82rem' }}
              />
            </div>

            {/* 2. Parent Command */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: '#1e293b' }}>
                <Building size={14} style={{ color: 'var(--rotc-green-dark)' }} />
                Parent Command Line
              </label>
              <input
                type="text"
                className="form-control"
                value={form.parentCommand}
                onChange={(e) => handleChange('parentCommand', e.target.value)}
                placeholder="e.g. 15th Regional Community Defense Group, ARESCOM"
                style={{ fontSize: '0.82rem' }}
              />
            </div>

            {/* 3. Unit Name */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: '#1e293b' }}>
                <Award size={14} style={{ color: 'var(--rotc-green-dark)' }} />
                ROTC Unit Name
              </label>
              <input
                type="text"
                className="form-control"
                value={form.unitName}
                onChange={(e) => handleChange('unitName', e.target.value)}
                placeholder="e.g. CSU ROTC UNIT (1501st CDC)"
                style={{ fontSize: '0.82rem' }}
              />
            </div>

            {/* 4. Location / Campus */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: '#1e293b' }}>
                <MapPin size={14} style={{ color: 'var(--rotc-green-dark)' }} />
                Host Institution Location
              </label>
              <input
                type="text"
                className="form-control"
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="e.g. Caraga State University, Ampayon, Butuan City"
                style={{ fontSize: '0.82rem' }}
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResetDefaults}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <RotateCcw size={13} /> Reset Defaults
          </button>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
            >
              <CheckCircle size={15} />
              {savedSuccess ? 'Saved!' : 'Save & Set Letterhead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
