import React, { useState, useEffect } from 'react';
import { supabase, getSupabaseClient } from '../utils/supabaseClient';
import {
  User,
  Building,
  GraduationCap,
  Phone,
  MapPin,
  HeartHandshake,
  Save,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const EditCadetModal = ({ cadet, isOpen, onClose, onRefresh }) => {
  const [formData, setFormData] = useState({
    name: '',
    gender: 'Male',
    department: 'CCIS',
    degree: '',
    contactNumber: '',
    province: '',
    city: '',
    barangay: '',
    religion: 'ROMAN CATHOLIC',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (cadet) {
      setFormData({
        name: cadet.name || '',
        gender: cadet.gender === 'Female' ? 'Female' : 'Male',
        department: cadet.department || cadet.college || 'CCIS',
        degree: cadet.degree || cadet.program || cadet.course || '',
        contactNumber: cadet.contactNumber || cadet.contact_number || '',
        province: cadet.province || '',
        city: cadet.city || '',
        barangay: cadet.barangay || '',
        religion: cadet.religion || 'ROMAN CATHOLIC',
      });
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [cadet]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'name' || name === 'degree' ? value.toUpperCase() : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!cadet) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    // The cadets table stores cadet string IDs (e.g. "221-00002") in the 'id' column
    const targetId = cadet.id || cadet.cadetId || cadet.cadet_id;

    // Only include columns that actually exist in the cadets Supabase table
    const payload = {
      name: formData.name.trim() || cadet.name,
      gender: formData.gender,
      department: formData.department,
      program: formData.degree.trim(),
      course: formData.degree.trim(),
      contact_number: formData.contactNumber.trim(),
      province: formData.province.trim() || null,
      city: formData.city.trim() || null,
      barangay: formData.barangay.trim() || null,
      religion: formData.religion || null,
    };

    const updatedCadet = { ...cadet, ...payload, id: targetId, cadetId: targetId };

    try {
      if (supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('cadets')
          .update(payload)
          .eq('id', targetId)
          .select();

        if (error) {
          console.error('Supabase Update Error:', error);
          setSaveError(`Save failed: ${error.message}`);
          setIsSaving(false);
          return;
        }

        console.log('Supabase update result:', data);
      }

      // Update local storage cache
      try {
        const localKey = 'csu_rotc_cadets_roster';
        const saved = localStorage.getItem(localKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const updated = parsed.map(c => {
            const cId = String(c.id || c.cadetId || c.cadet_id || '').toUpperCase();
            const tId = String(targetId || '').toUpperCase();
            return cId === tId ? { ...c, ...payload } : c;
          });
          localStorage.setItem(localKey, JSON.stringify(updated));
        }
      } catch (_) {}

      // Broadcast update to other components
      try {
        window.dispatchEvent(new CustomEvent('local-cadet-update', { detail: updatedCadet }));
      } catch (_) {}

      setSaveSuccess(true);
      if (onRefresh) await onRefresh(updatedCadet);

      setTimeout(() => { if (onClose) onClose(); }, 400);
    } catch (err) {
      console.error('Error saving cadet:', err);
      setSaveError(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #cbd5e1',
          width: '100%',
          maxWidth: '560px',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          maxHeight: '92vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={20} color="#047857" /> Edit Cadet Details
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '3px 0 0 0' }}>
              ID: <span style={{ fontFamily: 'monospace', color: '#047857', fontWeight: 800 }}>{cadet?.id || cadet?.cadetId}</span> • {cadet?.battalion || '1st Battalion'} • {cadet?.company || 'Alpha Company'} • {cadet?.platoon || '1st Platoon'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center' }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Alerts */}
        {saveError && (
          <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '0.8rem', marginBottom: '1rem' }}>
            <AlertCircle size={16} />
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccess && (
          <div style={{ padding: '0.75rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontSize: '0.8rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={16} />
            <span>Cadet record updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g. DELA CRUZ, JUAN A."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                backgroundColor: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#1e293b',
                outline: 'none'
              }}
            />
          </div>

          {/* Gender & Department Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                <Building size={13} color="#047857" /> Department / College
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="CEGS">CEGS</option>
                <option value="CCIS">CCIS</option>
                <option value="CHASS">CHASS</option>
                <option value="CAA">CAA</option>
                <option value="CMNS">CMNS</option>
                <option value="CED">CED</option>
                <option value="COFES">COFES</option>
              </select>
            </div>
          </div>

          {/* Program & Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                <GraduationCap size={13} color="#047857" /> Academic Program / Degree
              </label>
              <input
                type="text"
                name="degree"
                value={formData.degree}
                onChange={handleChange}
                placeholder="e.g. BSIT"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                <Phone size={13} color="#047857" /> Contact Number
              </label>
              <input
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="e.g. 09123456789"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* MANUAL ADDRESS INPUTS */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#047857', marginBottom: '0.5rem' }}>
              <MapPin size={14} /> Permanent Address (Manual Input)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>Province</span>
                <input
                  type="text"
                  name="province"
                  placeholder="e.g. Agusan del Norte"
                  value={formData.province}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>City / Municipality</span>
                <input
                  type="text"
                  name="city"
                  placeholder="e.g. Butuan City"
                  value={formData.city}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>Barangay</span>
                <input
                  type="text"
                  name="barangay"
                  placeholder="e.g. Ampayon"
                  value={formData.barangay}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* RELIGION DROPDOWN */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
              <HeartHandshake size={14} color="#047857" /> Religion / Faith Community
            </label>
            <select
              name="religion"
              value={formData.religion}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                backgroundColor: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#1e293b',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ROMAN CATHOLIC">ROMAN CATHOLIC</option>
              <option value="BAPTIST">BAPTIST</option>
              <option value="CHRISTIAN">CHRISTIAN</option>
              <option value="SEVENTH-DAY">SEVENTH-DAY</option>
              <option value="BORN AGAIN">BORN AGAIN</option>
              <option value="FREE METHODIST">FREE METHODIST</option>
              <option value="IGLESIA NI CRISTO">IGLESIA NI CRISTO</option>
              <option value="UNITED CHURCH OF CHRIST IN THE PHILIPPINES">UNITED CHURCH OF CHRIST IN THE PHILIPPINES</option>
              <option value="OTHERS">OTHERS</option>
            </select>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '0.55rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#64748b',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: isSaving ? '#6ee7b7' : '#047857',
                border: 'none',
                borderRadius: '8px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(4, 120, 87, 0.3)'
              }}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={14} /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCadetModal;
