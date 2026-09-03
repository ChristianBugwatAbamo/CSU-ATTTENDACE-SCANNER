import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  X,
  CheckCircle,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
  Highlighter,
  Eraser,
  Undo,
  Redo,
  Type,
  ChevronDown
} from 'lucide-react';
import {
  DEFAULT_LETTERHEAD,
  getActiveLetterhead,
  saveActiveLetterhead,
  formatMilitaryDate
} from '../utils/excelExport';
import { supabase, getSupabaseClient } from '../utils/supabaseClient';

export { formatMilitaryDate };

/**
 * Standard ROTC military letterhead initial HTML template
 */
export function generateDefaultLetterheadHtml(data = DEFAULT_LETTERHEAD) {
  const motto = data.topMotto || 'ARMY 2040: WORLD CLASS. MULTI-MISSION READY. CROSS-DOMAIN CAPABLE';
  const hq = data.headquarters || 'H E A D Q U A R T E R S';
  const unit = data.unitName || 'CARAGA STATE UNIVERSITY MAIN CAMPUS ROTC UNIT (ACTIVATED)';
  const parent = data.parentCommand || '1501 (ADN), 15TH (CARAGA) RCDG, ARESCOM';
  const loc = data.location || 'Ampayon, Butuan City';

  return `<div style="text-align: center; font-family: Arial, sans-serif; line-height: 1.35;">
  <div style="font-size: 11px; font-weight: 800; color: #0f172a; letter-spacing: 0.3px; text-transform: uppercase; margin-bottom: 4px;">
    ${motto}
  </div>
  <div style="font-size: 14px; font-weight: 900; color: #000000; letter-spacing: 3.5px; text-transform: uppercase; margin-top: 3px;">
    ${hq}
  </div>
  <div style="font-size: 13px; font-weight: 800; color: #064e2e; text-transform: uppercase; margin-top: 2px;">
    ${unit}
  </div>
  <div style="font-size: 12px; font-weight: 700; color: #334155; margin-top: 2px;">
    ${parent}
  </div>
  <div style="font-size: 12px; color: #475569; margin-top: 1px;">
    ${loc}
  </div>
</div>`;
}

/**
 * Parses raw text lines from HTML for Excel and reporting fallback
 */
export function extractLinesFromHtml(html) {
  if (!html) return [];
  try {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return (temp.innerText || temp.textContent || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Text case helper functions
 */
function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function toSentenceCase(str) {
  return str.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
}

const FONT_FAMILIES = [
  { label: 'Arial (Default)', value: 'Arial, sans-serif' },
  { label: 'Times New Roman (Formal)', value: '"Times New Roman", Times, serif' },
  { label: 'Calibri (Office)', value: 'Calibri, Candara, Segoe, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Oswald (Military Display)', value: 'Oswald, sans-serif' },
  { label: 'Verdana (Legible)', value: 'Verdana, sans-serif' },
  { label: 'Courier New (Monospace)', value: '"Courier New", Courier, monospace' }
];

const FONT_SIZES = [
  { label: '9px', value: '9' },
  { label: '10px', value: '10' },
  { label: '11px (Motto)', value: '11' },
  { label: '12px (Regular)', value: '12' },
  { label: '13px (Unit Name)', value: '13' },
  { label: '14px (Headquarters)', value: '14' },
  { label: '16px (Large)', value: '16' },
  { label: '18px (Header)', value: '18' },
  { label: '20px (Display)', value: '20' },
  { label: '24px (Title)', value: '24' }
];

const QUICK_TEXT_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'ROTC Dark Green', value: '#064e2e' },
  { label: 'Slate Dark', value: '#1e293b' },
  { label: 'Muted Slate', value: '#475569' },
  { label: 'Navy Blue', value: '#1e3a8a' },
  { label: 'Tactical Amber', value: '#b45309' },
  { label: 'Crimson Red', value: '#b91c1c' }
];

const QUICK_HIGHLIGHT_COLORS = [
  { label: 'No Color', value: 'transparent' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Soft Green', value: '#bbf7d0' },
  { label: 'Soft Blue', value: '#bfdbfe' },
  { label: 'Soft Pink', value: '#fbcfe8' },
  { label: 'Soft Orange', value: '#fed7aa' }
];

export default function LetterheadSettingsModal({ isOpen = true, onClose, onSaved, onSaveSuccess, selectedDate = null }) {
  const [form, setForm] = useState(DEFAULT_LETTERHEAD);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSupabase, setLoadingSupabase] = useState(false);

  // Active Ribbon States
  const [activeFontFamily, setActiveFontFamily] = useState('Arial, sans-serif');
  const [activeFontSize, setActiveFontSize] = useState('13');
  const [activeTextColor, setActiveTextColor] = useState('#000000');
  const [activeHighlightColor, setActiveHighlightColor] = useState('transparent');
  const [isCaseMenuOpen, setIsCaseMenuOpen] = useState(false);
  const [isTextColorMenuOpen, setIsTextColorMenuOpen] = useState(false);
  const [isHighlightMenuOpen, setIsHighlightMenuOpen] = useState(false);

  const leftLogoInputRef = useRef(null);
  const rightLogoInputRef = useRef(null);
  const editorRef = useRef(null);
  const textColorInputRef = useRef(null);
  const highlightColorInputRef = useRef(null);

  // Derive effective formation date dynamically from props, stored calendar state, or fallback
  const effectiveFormationDate = selectedDate || form.selectedDate || (() => {
    try {
      return localStorage.getItem('csu_rotc_selected_formation_date');
    } catch (_) {
      return null;
    }
  })() || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  const formattedDisplayDate = formatMilitaryDate(effectiveFormationDate);

  // Initialize form and editor on modal open, syncing from Supabase system_settings
  useEffect(() => {
    if (isOpen) {
      const active = getActiveLetterhead();
      setForm(active);
      setSavedSuccess(false);

      setTimeout(() => {
        if (editorRef.current) {
          if (active.contentHtml) {
            editorRef.current.innerHTML = active.contentHtml;
          } else {
            editorRef.current.innerHTML = generateDefaultLetterheadHtml(active);
          }
        }
      }, 50);

      // Async fetch latest settings from Supabase system_settings
      async function loadSystemSettingsFromSupabase() {
        try {
          setLoadingSupabase(true);
          const client = getSupabaseClient() || supabase;
          if (!client) return;

          const { data, error } = await client
            .from('system_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            const fetchedHtml = data.letterhead_html || data.letterhead_config?.contentHtml;
            const fetchedOffice = data.office_symbol || data.letterhead_config?.officeSymbol;
            const fetchedLeftLogo = data.left_logo_url || data.letterhead_config?.leftLogoUrl;
            const fetchedRightLogo = data.right_logo_url || data.letterhead_config?.rightLogoUrl;

            setForm(prev => ({
              ...prev,
              ...(fetchedHtml ? { contentHtml: fetchedHtml } : {}),
              ...(fetchedOffice ? { officeSymbol: fetchedOffice } : {}),
              ...(fetchedLeftLogo ? { leftLogoUrl: fetchedLeftLogo } : {}),
              ...(fetchedRightLogo ? { rightLogoUrl: fetchedRightLogo } : {})
            }));

            if (fetchedHtml && editorRef.current) {
              editorRef.current.innerHTML = fetchedHtml;
            }
          }
        } catch (err) {
          console.warn('Could not load system_settings from Supabase, using local defaults:', err.message);
        } finally {
          setLoadingSupabase(false);
        }
      }

      loadSystemSettingsFromSupabase();
    }
  }, [isOpen]);

  // Close drop-downs on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.ribbon-dropdown-container')) {
        setIsCaseMenuOpen(false);
        setIsTextColorMenuOpen(false);
        setIsHighlightMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Keep form state in sync when editor content changes
  const handleCanvasInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const lines = extractLinesFromHtml(html);
      setForm(prev => ({
        ...prev,
        contentHtml: html,
        topMotto: lines[0] || prev.topMotto,
        headquarters: lines[1] || prev.headquarters,
        unitName: lines[2] || prev.unitName,
        parentCommand: lines[3] || prev.parentCommand,
        location: lines[4] || prev.location
      }));
    }
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

  // Execute standard formatting command
  const applyExecCommand = (command, value = null) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleCanvasInput();
  };

  // Font Family execution
  const applyFontFamily = (familyValue) => {
    setActiveFontFamily(familyValue);
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('fontName', false, familyValue.split(',')[0].replace(/['"]/g, ''));
    handleCanvasInput();
  };

  // Font Size execution
  const applyFontSize = (sizePx) => {
    setActiveFontSize(sizePx);
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = `${sizePx}px`;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    }
    handleCanvasInput();
  };

  // Text Color execution
  const applyTextColor = (hexColor) => {
    setActiveTextColor(hexColor);
    setIsTextColorMenuOpen(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('foreColor', false, hexColor);
    handleCanvasInput();
  };

  // Highlight / Background Color execution
  const applyHighlightColor = (hexColor) => {
    setActiveHighlightColor(hexColor);
    setIsHighlightMenuOpen(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (hexColor === 'transparent') {
      document.execCommand('removeFormat', false, null);
    } else {
      document.execCommand('hiliteColor', false, hexColor);
    }
    handleCanvasInput();
  };

  // Case Transformation
  const applyCaseTransform = (mode) => {
    setIsCaseMenuOpen(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
      const range = selection.getRangeAt(0);
      const originalText = range.toString();
      let transformed = originalText;
      if (mode === 'uppercase') transformed = originalText.toUpperCase();
      else if (mode === 'lowercase') transformed = originalText.toLowerCase();
      else if (mode === 'titlecase') transformed = toTitleCase(originalText);
      else if (mode === 'sentencecase') transformed = toSentenceCase(originalText);

      range.deleteContents();
      const textNode = document.createTextNode(transformed);
      range.insertNode(textNode);
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(textNode);
      selection.addRange(newRange);
    } else {
      // Transform all text nodes in canvas
      const html = editorRef.current.innerHTML;
      let newHtml = html;
      if (mode === 'uppercase') {
        newHtml = html.replace(/>([^<]+)</g, (m, text) => `>${text.toUpperCase()}<`);
      } else if (mode === 'lowercase') {
        newHtml = html.replace(/>([^<]+)</g, (m, text) => `>${text.toLowerCase()}<`);
      } else if (mode === 'titlecase') {
        newHtml = html.replace(/>([^<]+)</g, (m, text) => `>${toTitleCase(text)}<`);
      } else if (mode === 'sentencecase') {
        newHtml = html.replace(/>([^<]+)</g, (m, text) => `>${toSentenceCase(text)}<`);
      }
      editorRef.current.innerHTML = newHtml;
    }
    handleCanvasInput();
  };

  // Clear Formatting
  const handleClearFormatting = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
      document.execCommand('removeFormat', false, null);
    } else {
      const lines = extractLinesFromHtml(editorRef.current.innerHTML);
      editorRef.current.innerHTML = lines.map(l => `<div style="text-align: center; font-size: 13px; font-family: Arial, sans-serif;">${l}</div>`).join('');
    }
    handleCanvasInput();
  };

  // Restore Official Military Template
  const handleResetToMilitaryTemplate = () => {
    const defaultHtml = generateDefaultLetterheadHtml(DEFAULT_LETTERHEAD);
    if (editorRef.current) {
      editorRef.current.innerHTML = defaultHtml;
    }
    setForm(prev => ({
      ...prev,
      ...DEFAULT_LETTERHEAD,
      contentHtml: defaultHtml
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const currentHtml = editorRef.current ? editorRef.current.innerHTML : form.contentHtml;
      const lines = extractLinesFromHtml(currentHtml);

      const payload = {
        ...form,
        selectedDate: effectiveFormationDate,
        contentHtml: currentHtml,
        topMotto: lines[0] || form.topMotto || DEFAULT_LETTERHEAD.topMotto,
        headquarters: lines[1] || form.headquarters || DEFAULT_LETTERHEAD.headquarters,
        unitName: lines[2] || form.unitName || DEFAULT_LETTERHEAD.unitName,
        parentCommand: lines[3] || form.parentCommand || DEFAULT_LETTERHEAD.parentCommand,
        location: lines[4] || form.location || DEFAULT_LETTERHEAD.location
      };

      // 1. Save locally to localStorage and fire in-app update event
      saveActiveLetterhead(payload);

      // 2. Persist directly to Supabase system_settings table
      const client = getSupabaseClient() || supabase;
      if (client) {
        // Query existing record ID to update singleton row
        const { data: existing } = await client
          .from('system_settings')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        const supabasePayload = {
          ...(existing?.id ? { id: existing.id } : {}),
          letterhead_html: currentHtml,
          office_symbol: form.officeSymbol || 'CSUROTCU1',
          left_logo_url: form.leftLogoUrl || '/csug-logo.png',
          right_logo_url: form.rightLogoUrl || '/rotc-seal-transparent.png',
          letterhead_config: payload,
          updated_at: new Date().toISOString()
        };

        const { error: sbError } = await client
          .from('system_settings')
          .upsert(supabasePayload);

        if (sbError) {
          console.warn('Supabase system_settings upsert notice:', sbError.message);
        }
      }

      setSavedSuccess(true);
      if (onSaved) onSaved(payload);
      if (onSaveSuccess) onSaveSuccess(payload);
      setTimeout(() => {
        setSavedSuccess(false);
        if (onClose) onClose();
      }, 1200);
    } catch (err) {
      console.error('Error saving letterhead settings:', err);
      alert(`Save note: ${err.message}`);
    } finally {
      setSaving(false);
    }
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
        maxWidth: '840px',
        width: '100%',
        maxHeight: '94vh',
        overflowY: 'auto',
        padding: '1.75rem',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-light)',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Modal Header */}
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
                Microsoft Word–style formatting ribbon for live header styling and unit insignia management.
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

        {/* Section 1: Left & Right Logo File Upload Inputs */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--rotc-green-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ImageIcon size={15} /> Official Unit Insignia & Seals (Left & Right)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Left Logo: 1501st CDC Logo */}
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.85rem', background: '#ffffff' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem', color: '#1e293b' }}>
                Left Logo (1501st CDC Insignia)
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8fafc' }}>
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
                value={form.leftLogoUrl || ''}
                onChange={(e) => handleChange('leftLogoUrl', e.target.value)}
                placeholder="Or paste Image URL / path..."
                style={{ fontSize: '0.75rem' }}
              />
            </div>

            {/* Right Logo: ROTC Unit Seal */}
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.85rem', background: '#ffffff' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem', color: '#1e293b' }}>
                Right Logo (ROTC Unit Seal)
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8fafc' }}>
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
                value={form.rightLogoUrl || ''}
                onChange={(e) => handleChange('rightLogoUrl', e.target.value)}
                placeholder="Or paste Image URL / path..."
                style={{ fontSize: '0.75rem' }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Microsoft Word–Style Formatting Ribbon & WYSIWYG Canvas */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--rotc-green-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Sparkles size={15} /> Official Letterhead Word-Style Formatting Ribbon
            </div>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleResetToMilitaryTemplate}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', fontWeight: 700, color: '#065f46', background: '#ecfdf5', borderColor: '#a7f3d0' }}
              title="Restore default standard ROTC military letterhead"
            >
              Restore Official ROTC Template
            </button>
          </div>

          {/* Microsoft Word–Style Multi-Control Ribbon */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '10px 10px 0 0',
            border: '1px solid #cbd5e1',
            borderBottom: 'none',
            padding: '0.55rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            {/* Ribbon Row 1: Font Family, Font Size, Basic Styles, Colors, Case, Eraser */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>

              {/* 1. Font Family Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <select
                  value={activeFontFamily}
                  onChange={(e) => applyFontFamily(e.target.value)}
                  style={{
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer',
                    minWidth: '135px'
                  }}
                  title="Font Family"
                >
                  {FONT_FAMILIES.map(f => (
                    <option key={f.label} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* 2. Font Size Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <select
                  value={activeFontSize}
                  onChange={(e) => applyFontSize(e.target.value)}
                  style={{
                    padding: '0.3rem 0.45rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer',
                    minWidth: '85px'
                  }}
                  title="Font Size"
                >
                  {FONT_SIZES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Ribbon Divider */}
              <div style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 2px' }} />

              {/* 3. Character Formatting: Bold, Italic, Underline, Strikethrough */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('bold')}
                  title="Bold (Ctrl+B)"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('italic')}
                  title="Italic (Ctrl+I)"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('underline')}
                  title="Underline (Ctrl+U)"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Underline size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('strikeThrough')}
                  title="Strikethrough"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Strikethrough size={14} />
                </button>
              </div>

              {/* Ribbon Divider */}
              <div style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 2px' }} />

              {/* 4. Text Color Picker */}
              <div className="ribbon-dropdown-container" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextColor(activeTextColor)}
                    title={`Text Color (${activeTextColor})`}
                    style={{ padding: '0.3rem 0.45rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 800, fontSize: '0.78rem' }}>
                      <span>A</span>
                    </div>
                    <div style={{ width: '14px', height: '3px', background: activeTextColor, borderRadius: '1px', marginTop: '1px' }} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsTextColorMenuOpen(prev => !prev)}
                    title="Choose Text Color"
                    style={{ padding: '0.35rem 0.3rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronDown size={11} />
                  </button>
                </div>

                {isTextColorMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 50,
                    marginTop: '4px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    minWidth: '150px'
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Standard Colors</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.5rem' }}>
                      {QUICK_TEXT_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyTextColor(c.value)}
                          title={c.label}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            background: c.value,
                            border: activeTextColor === c.value ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Palette size={13} color="#475569" />
                      <input
                        type="color"
                        ref={textColorInputRef}
                        value={activeTextColor}
                        onChange={(e) => applyTextColor(e.target.value)}
                        style={{ width: '100%', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Highlight / Background Color */}
              <div className="ribbon-dropdown-container" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlightColor(activeHighlightColor)}
                    title={`Text Highlight Color`}
                    style={{ padding: '0.3rem 0.45rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    <Highlighter size={13} />
                    <div style={{ width: '14px', height: '3px', background: activeHighlightColor === 'transparent' ? '#cbd5e1' : activeHighlightColor, borderRadius: '1px', marginTop: '1px' }} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsHighlightMenuOpen(prev => !prev)}
                    title="Choose Highlight Color"
                    style={{ padding: '0.35rem 0.3rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronDown size={11} />
                  </button>
                </div>

                {isHighlightMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 50,
                    marginTop: '4px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    minWidth: '150px'
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Highlight Markers</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.4rem' }}>
                      {QUICK_HIGHLIGHT_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyHighlightColor(c.value)}
                          title={c.label}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            background: c.value === 'transparent' ? '#ffffff' : c.value,
                            border: activeHighlightColor === c.value ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                        >
                          {c.value === 'transparent' && <span style={{ fontSize: '9px', color: '#ef4444', position: 'absolute', top: '2px', left: '4px' }}>✕</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ribbon Divider */}
              <div style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 2px' }} />

              {/* 6. Case Transformer Dropdown */}
              <div className="ribbon-dropdown-container" style={{ position: 'relative' }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsCaseMenuOpen(prev => !prev)}
                  title="Change Case (UPPERCASE, Title Case, etc.)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0.35rem 0.55rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    cursor: 'pointer'
                  }}
                >
                  <Type size={13} />
                  <span>Aa</span>
                  <ChevronDown size={11} />
                </button>

                {isCaseMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 50,
                    marginTop: '4px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    minWidth: '180px',
                    overflow: 'hidden'
                  }}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyCaseTransform('uppercase')}
                      style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', border: 'none', background: 'transparent', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      UPPERCASE
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyCaseTransform('titlecase')}
                      style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', border: 'none', background: 'transparent', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      Capitalize Each Word
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyCaseTransform('sentencecase')}
                      style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', border: 'none', background: 'transparent', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      Sentence case
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyCaseTransform('lowercase')}
                      style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', border: 'none', background: 'transparent', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      lowercase
                    </button>
                  </div>
                )}
              </div>

              {/* 7. Clear Formatting (Eraser) */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearFormatting}
                title="Clear Formatting"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0.35rem 0.55rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  cursor: 'pointer'
                }}
              >
                <Eraser size={13} />
                <span>Clear</span>
              </button>

              {/* Ribbon Divider */}
              <div style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 2px' }} />

              {/* 8. Text Alignment: Left, Center, Right, Justify */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('justifyLeft')}
                  title="Align Left"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('justifyCenter')}
                  title="Align Center (Official Military Standard)"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: '#ecfdf5', color: '#065f46', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('justifyRight')}
                  title="Align Right"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <AlignRight size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('justifyFull')}
                  title="Justify"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <AlignJustify size={14} />
                </button>
              </div>

              {/* Ribbon Divider */}
              <div style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 2px' }} />

              {/* 9. Undo / Redo */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('undo')}
                  title="Undo (Ctrl+Z)"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Undo size={13} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyExecCommand('redo')}
                  title="Redo (Ctrl+Y)"
                  style={{ padding: '0.35rem 0.5rem', border: 'none', borderLeft: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Redo size={13} />
                </button>
              </div>

            </div>
          </div>

          {/* Formatted Letterhead Preview & WYSIWYG Editable Canvas */}
          <div style={{
            background: '#ffffff',
            border: '2px solid #065f46',
            borderRadius: '0 0 10px 10px',
            padding: '1.25rem',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              {/* Left Logo Preview */}
              <div style={{ width: '68px', height: '68px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                {form.leftLogoUrl ? (
                  <img src={form.leftLogoUrl} alt="1501st CDC Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', padding: '2px' }}>Left Logo</span>
                )}
              </div>

              {/* Direct WYSIWYG Editable Canvas */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleCanvasInput}
                onBlur={handleCanvasInput}
                style={{
                  flex: 1,
                  minHeight: '115px',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  outline: 'none',
                  border: '1px solid transparent',
                  transition: 'all 0.15s ease',
                  cursor: 'text'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.15)';
                }}
                onBlurCapture={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />

              {/* Right Logo Preview */}
              <div style={{ width: '68px', height: '68px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                {form.rightLogoUrl ? (
                  <img src={form.rightLogoUrl} alt="ROTC Unit Seal" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', padding: '2px' }}>Right Logo</span>
                )}
              </div>
            </div>

            {/* Sub-header details: Office Symbol (Left) & Formation Date from Calendar (Right) */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.75rem',
              paddingTop: '0.45rem',
              borderTop: '1px dashed #cbd5e1',
              fontSize: '0.76rem',
              fontWeight: 700,
              color: '#334155'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>OFFICE SYMBOL:</span>
                <input
                  type="text"
                  value={form.officeSymbol || 'CSUROTCU1'}
                  onChange={(e) => handleChange('officeSymbol', e.target.value.toUpperCase())}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    textTransform: 'uppercase',
                    width: '120px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>FORMATION DATE:</span>
                <span style={{
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  color: '#065f46',
                  background: '#ecfdf5',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #a7f3d0'
                }}>
                  {formattedDisplayDate}
                </span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>💡 <strong>Word Ribbon:</strong> Select text to change Font, Color, Size, Alignment, or Case. Changes are saved directly to exported Excel reports.</span>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResetToMilitaryTemplate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <RotateCcw size={13} /> Reset to Default Letterhead
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
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 800,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              <CheckCircle size={15} />
              {saving ? 'Syncing to Supabase...' : savedSuccess ? 'Saved & Synced!' : 'Save & Set Letterhead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { LetterheadSettingsModal as OfficialLetterheadSettings };
