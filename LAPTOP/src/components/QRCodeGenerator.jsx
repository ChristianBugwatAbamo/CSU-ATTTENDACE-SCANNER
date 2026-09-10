import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, Search, Users, CheckSquare, Square, Printer,
  RefreshCw, X, Shield, CheckCircle2, ChevronRight, AlertTriangle
} from 'lucide-react';
import { getSupabaseClient, supabase } from '../supabaseClient';
import { generateQrPayload, getLastNameOnly } from './BasicCadetRegistration';
import UnitHierarchyDrillDown from './UnitHierarchyDrillDown';
import { getDepartmentStyle } from './CadetRosterTable';

// ─── Formatters for Selected QR Pass Preview Card ────────────────────────────
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

// ─── QR Pass Tile (for both on-screen grid and print layout) ─────────────────

function QRPassTile({ cadet, isPrint = false }) {
  const qrPayload = generateQrPayload(cadet);

  // Line 1: LAST NAME ONLY (e.g. TRAZARES)
  const lastNameOnly = (cadet.lastName ? String(cadet.lastName).trim().toUpperCase() : getLastNameOnly(cadet.name)) || 'UNKNOWN CADET';

  // Line 2: Cadet ID Badge (e.g. 221-00003)
  const cadetId = cadet.id || cadet.cadetId || '—';

  // Line 3: Battalion & Company (e.g. 1ST BAT • ALPHA COY)
  const bn = formatBn(cadet.battalion);
  const co = formatCo(cadet.company);
  const bnCoLine = [bn, co].filter(Boolean).join(' • ') || '—';

  // Line 4: Platoon (e.g. 1ST PLATOON)
  const plLine = formatPl(cadet.platoon);

  return (
    <div
      className={`qr-pass-tile break-inside-avoid print:break-inside-avoid ${isPrint ? 'qr-print-tile' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isPrint ? '4px' : '6px',
        padding: isPrint ? '10px 8px' : '14px 12px',
        background: '#ffffff',
        border: isPrint ? '1.5px solid #1a3a2a' : '1px solid #e2e8f0',
        borderRadius: isPrint ? '6px' : '10px',
        boxShadow: isPrint ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >


      {/* QR Code */}
      <div style={{
        background: '#fff', padding: '4px', borderRadius: '4px',
        border: isPrint ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <QRCodeSVG
          value={qrPayload}
          size={isPrint ? 105 : 95}
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
        fontSize: isPrint ? '0.8rem' : '0.88rem',
        color: '#0f172a',
        textAlign: 'center',
        lineHeight: 1.15,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        maxWidth: isPrint ? '100%' : '130px',
        wordBreak: 'break-word'
      }}>
        {lastNameOnly}
      </div>

      {/* Line 2: Cadet ID Badge (e.g. 221-00003) */}
      <div style={{
        fontFamily: 'monospace',
        fontWeight: 800,
        fontSize: isPrint ? '0.66rem' : '0.72rem',
        color: isPrint ? '#064e2e' : '#047857',
        letterSpacing: '0.06em',
        background: isPrint ? 'rgba(6,78,46,0.06)' : 'rgba(6,78,46,0.08)',
        border: '1px solid rgba(6,78,46,0.2)',
        padding: '1px 7px',
        borderRadius: '4px',
        lineHeight: 1.3
      }}>
        {cadetId}
      </div>

      {/* Line 3: Battalion & Company (e.g. 1ST BAT • ALPHA COY) */}
      <div style={{
        fontSize: isPrint ? '0.6rem' : '0.67rem',
        color: isPrint ? '#1e293b' : '#334155',
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
        fontSize: isPrint ? '0.56rem' : '0.63rem',
        color: isPrint ? '#475569' : '#64748b',
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
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QRCodeGenerator() {
  // ── Drill-down state: null means ALL (no filter applied at that level) ──
  const [selectedBattalion, setSelectedBattalion] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedPlatoon, setSelectedPlatoon] = useState(null);

  // ── Platoon/Roster cadets from Supabase ──
  const [cadets, setCadets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  // ── Quick Filter Search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // ── Selected cadets map (persists across drill-down switches) ──
  const [selectedCadetsMap, setSelectedCadetsMap] = useState(new Map());

  // ── Print state ──
  const [isPrinting, setIsPrinting] = useState(false);

  // ── Print Orientation State (synced with Settings) ──
  const [printOrientation, setPrintOrientation] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_print_orientation');
      if (saved === 'portrait' || saved === 'landscape') return saved;
    } catch (_) {}
    return 'landscape';
  });

  useEffect(() => {
    const handleOrientationSync = () => {
      try {
        const saved = localStorage.getItem('csu_rotc_print_orientation');
        if (saved === 'portrait' || saved === 'landscape') {
          setPrintOrientation(saved);
        }
      } catch (_) {}
    };
    window.addEventListener('storage', handleOrientationSync);
    window.addEventListener('csu_rotc_orientation_change', handleOrientationSync);
    return () => {
      window.removeEventListener('storage', handleOrientationSync);
      window.removeEventListener('csu_rotc_orientation_change', handleOrientationSync);
    };
  }, []);

  // Fetch cadets with flexible hierarchy filters (null skips matching that echelon)
  const fetchCadets = useCallback(async () => {
    setIsLoading(true);
    try {
      const client = getSupabaseClient() || supabase;
      let fetched = [];

      const bnMatch = selectedBattalion ? String(selectedBattalion).match(/(\d+)/) : null;
      const bnClean = bnMatch ? bnMatch[1] : (selectedBattalion ? String(selectedBattalion).trim() : null);
      const coClean = selectedCompany ? String(selectedCompany).replace(/ COY| COMPANY/i, '').trim() : null;
      const plMatch = selectedPlatoon ? String(selectedPlatoon).match(/(\d+)/) : null;
      const plClean = plMatch ? plMatch[1] : (selectedPlatoon ? String(selectedPlatoon).trim() : null);

      if (client) {
        let query = client.from('cadets').select('*');
        if (bnClean) query = query.ilike('battalion', `%${bnClean}%`);
        if (coClean) query = query.ilike('company', `%${coClean}%`);
        if (plClean) query = query.ilike('platoon', `%${plClean}%`);
        query = query.order('name', { ascending: true });

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          fetched = data;
        }
      }

      // Fallback to local storage roster if offline or empty
      if (fetched.length === 0) {
        try {
          const saved = localStorage.getItem('csu_rotc_cadets_roster');
          if (saved) {
            const localCadets = JSON.parse(saved);
            fetched = localCadets.filter(c => {
              const cBn = String(c.battalion || '').toLowerCase();
              const cCo = String(c.company || '').toLowerCase();
              const cPl = String(c.platoon || '').toLowerCase();
              const matchBn = !bnClean || cBn.includes(bnClean);
              const matchCo = !coClean || cCo.includes(coClean.toLowerCase());
              const matchPl = !plClean || cPl.includes(plClean);
              return matchBn && matchCo && matchPl;
            });
          }
        } catch (_) { }
      }

      // Keep only Basic Cadets for QR pass generation
      const basicOnly = (fetched || []).filter(c => {
        const isOfficer = c.type === 'Cadet Officer' || /1CL|2CL|3CL|4CL|COL|MAJ|CPT|LT/.test(String(c.rank || ''));
        return !isOfficer;
      });

      setCadets(basicOnly);
      setLastFetch(new Date());
    } catch (err) {
      console.error('Failed to fetch cadets for QR Generator:', err);
      setCadets([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBattalion, selectedCompany, selectedPlatoon]);

  useEffect(() => {
    fetchCadets();
  }, [fetchCadets]);

  // ── Clear All Filters Handler ──
  const handleClearFilters = useCallback(() => {
    setSelectedBattalion(null);
    setSelectedCompany(null);
    setSelectedPlatoon(null);
    setSearchQuery('');
  }, []);

  // ── Filter cadets by search query ──
  const filteredCadets = useMemo(() => {
    if (!searchQuery.trim()) return cadets;
    const q = searchQuery.toLowerCase().trim();
    return cadets.filter(cadet => {
      const name = String(cadet.name || '').toLowerCase();
      const id = String(cadet.id || cadet.cadetId || '').toLowerCase();
      const dept = String(cadet.department || '').toLowerCase();
      const prog = String(cadet.program || cadet.course || '').toLowerCase();
      const gender = String(cadet.gender || '').toLowerCase();
      return name.includes(q) || id.includes(q) || dept.includes(q) || prog.includes(q) || gender.includes(q);
    });
  }, [cadets, searchQuery]);

  // ── Selection helpers ──
  const toggleCadet = (cadet) => {
    const cadetKey = String(cadet.id || cadet.cadetId || '');
    if (!cadetKey) return;
    setSelectedCadetsMap(prev => {
      const next = new Map(prev);
      if (next.has(cadetKey)) {
        next.delete(cadetKey);
      } else {
        next.set(cadetKey, cadet);
      }
      return next;
    });
  };

  const isCadetSelected = (cadet) => {
    const cadetKey = String(cadet.id || cadet.cadetId || '');
    return selectedCadetsMap.has(cadetKey);
  };

  const isAllFilteredSelected = filteredCadets.length > 0 && filteredCadets.every(isCadetSelected);

  const toggleSelectAllFiltered = () => {
    setSelectedCadetsMap(prev => {
      const next = new Map(prev);
      if (isAllFilteredSelected) {
        // Deselect all in current view
        filteredCadets.forEach(c => {
          const k = String(c.id || c.cadetId || '');
          next.delete(k);
        });
      } else {
        // Select all in current view
        filteredCadets.forEach(c => {
          const k = String(c.id || c.cadetId || '');
          if (k) next.set(k, c);
        });
      }
      return next;
    });
  };

  const clearAllSelected = () => {
    setSelectedCadetsMap(new Map());
  };

  const selectedCadetsList = useMemo(() =>
    Array.from(selectedCadetsMap.values()),
    [selectedCadetsMap]
  );

  const selectedCountInCurrentView = useMemo(() =>
    filteredCadets.filter(isCadetSelected).length,
    [filteredCadets, selectedCadetsMap]
  );

  // ── Print handler ──
  const handlePrint = () => {
    if (selectedCadetsMap.size === 0) return;
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrinting(false), 1500);
    }, 100);
  };

  // Human readable active filter description
  const activeEchelonLabel = useMemo(() => {
    const parts = [selectedBattalion, selectedCompany, selectedPlatoon].filter(Boolean);
    return parts.length > 0 ? parts.join(' • ') : 'ALL REGIMENT (ALL UNITS)';
  }, [selectedBattalion, selectedCompany, selectedPlatoon]);

  const hasActiveFilters = Boolean(selectedBattalion || selectedCompany || selectedPlatoon || searchQuery);

  return (
    <div
      className="qr-code-generator-root w-full p-6 md:p-8 space-y-6 print:p-0 print:m-0 print:space-y-0 print:w-full print:bg-transparent print:border-none print:shadow-none"
      style={{ width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      {/* ── Page Header (Hidden during print) ── */}
      <div className="print:hidden qr-screen-ui" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #064e2e, #065f46)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(6,78,46,0.25)',
            border: '1px solid rgba(229,169,0,0.3)'
          }}>
            <QrCode size={22} color="#e5a900" />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dark)',
              fontFamily: 'Oswald, sans-serif', margin: 0, letterSpacing: '0.5px'
            }}>
              QR CODE GENERATOR
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
              Select cadets from the Supabase roster and print compact QR pass sheets
            </p>
          </div>
        </div>
      </div>

      {/* ── TOP CARD CONTAINER: Unit Hierarchy Drill-Down Buttons (Hidden during print) ── */}
      <div className="w-full print:hidden qr-screen-ui" style={{ width: '100%' }}>
        <UnitHierarchyDrillDown
          selectedBattalion={selectedBattalion}
          setSelectedBattalion={setSelectedBattalion}
          selectedCompany={selectedCompany}
          setSelectedCompany={setSelectedCompany}
          selectedPlatoon={selectedPlatoon}
          setSelectedPlatoon={setSelectedPlatoon}
          title="Unit Hierarchy Drill-Down & QR Code Generator"
          subtitle="Click to filter by Battalion, Company, or Platoon. Click an active button again to unselect and view all cadets."
          icon={QrCode}
          allowToggle={true}
        />
      </div>

      {/* ── BOTTOM CARD CONTAINER: Cadet Selection Table (Hidden during print) ── */}
      <div
        className="w-full bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs print:hidden qr-screen-ui"
        style={{
          width: '100%',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        {/* Bottom Card Header with Title, Search & Actions */}
        <div style={{
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
              Enrolled Cadets &bull; {activeEchelonLabel}
            </h4>
            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
              Total: <strong>{filteredCadets.length}</strong> {filteredCadets.length === 1 ? 'cadet' : 'cadets'} in view
              {' '}• <strong>{selectedCountInCurrentView}</strong> selected in current view
              {selectedCadetsMap.size > 0 && (
                <span style={{ color: '#047857', fontWeight: 700 }}>
                  {' '}• <strong>{selectedCadetsMap.size}</strong> total selected across roster
                </span>
              )}
            </span>
          </div>

          {/* Header Action Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            flexWrap: 'wrap',
            justifyContent: 'flex-end'
          }}>
            {/* Quick Filter Search Bar */}
            <div style={{
              position: 'relative',
              width: '300px',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '0.625rem',
              border: isSearchFocused ? '2px solid #059669' : '2px solid #94a3b8',
              boxShadow: isSearchFocused
                ? '0 0 0 4px rgba(16, 185, 129, 0.18), 0 2px 6px rgba(0,0,0,0.08)'
                : '0 2px 5px rgba(15, 23, 42, 0.06)',
              transition: 'all 0.2s ease-in-out'
            }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: isSearchFocused ? '#059669' : '#64748b',
                  transition: 'color 0.2s ease'
                }}
              />
              <input
                type="text"
                placeholder="Search name, ID, department, program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                style={{
                  width: '100%',
                  padding: '0.55rem 2.2rem 0.55rem 2.4rem',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '0.625rem',
                  outline: 'none'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#475569'
                  }}
                  title="Clear search filter"
                >
                  <X size={11} />
                </button>
              )}
            </div>



            {/* Clear Filters Button (shown when any filter is active) */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Reset all filters to view all regiment records"
              >
                <X size={12} />
                <span>Reset Filters</span>
              </button>
            )}


          </div>
        </div>

        {/* Loading state or Cadets Table */}
        {isLoading ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            color: '#64748b', fontSize: '0.85rem', padding: '3.5rem 0',
            justifyContent: 'center', fontWeight: 600
          }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', color: '#047857' }} />
            Loading cadets from Supabase...
          </div>
        ) : (
          <div
            className="overflow-x-auto overflow-y-auto max-h-[480px] rounded-xl border border-slate-200 shadow-xs relative"
            style={{
              width: '100%',
              maxHeight: '480px',
              overflowX: 'auto',
              overflowY: 'auto',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff'
            }}
          >
            <table
              className="w-full text-left border-collapse"
              style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}
            >
              {/* Table Header matching Cadets Roster styling with Sticky Positioning */}
              <thead
                className="sticky top-0 z-10 bg-emerald-950 text-white text-[11px] font-black uppercase tracking-wider shadow-sm"
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  backgroundColor: '#022c22'
                }}
              >
                <tr
                  className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: '#022c22',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'center', width: '3.5rem', backgroundColor: '#022c22' }}>#</th>
                  <th style={{ padding: '0.875rem 1rem', width: '140px', backgroundColor: '#022c22' }}>CADET ID</th>
                  <th style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22' }}>CADET NAME</th>
                  <th style={{ padding: '0.875rem 1rem', width: '110px', backgroundColor: '#022c22' }}>GENDER</th>
                  <th style={{ padding: '0.875rem 1rem', width: '120px', backgroundColor: '#022c22' }}>DEPARTMENT</th>
                  <th style={{ padding: '0.875rem 1rem', width: '170px', backgroundColor: '#022c22' }}>ACADEMIC PROGRAM</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'center', width: '140px', backgroundColor: '#022c22' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <span>Selection Actions</span>
                    </div>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-800">
                {filteredCadets.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      style={{
                        padding: '3rem 1rem',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        fontWeight: 500
                      }}
                    >
                      <Users size={28} style={{ opacity: 0.35, margin: '0 auto 8px', display: 'block' }} />
                      {searchQuery ? 'No cadets match your search query in this selection.' : 'No cadets found for this unit filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredCadets.map((cadet, index) => {
                    const isSelected = isCadetSelected(cadet);
                    const deptStyle = getDepartmentStyle(cadet.department);
                    const cadetIdDisplay = cadet.id || cadet.cadetId || '—';

                    return (
                      <tr
                        key={cadetIdDisplay}
                        onClick={() => toggleCadet(cadet)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-100/80 border-l-4 border-l-emerald-700'
                            : 'hover:bg-slate-50'
                        }`}
                        style={{
                          borderBottom: index === filteredCadets.length - 1 ? 'none' : '1px solid #f1f5f9',
                          backgroundColor: isSelected ? 'rgba(209, 250, 229, 0.85)' : (index % 2 === 0 ? '#ffffff' : '#fcfcfc'),
                          borderLeft: isSelected ? '4px solid #047857' : '4px solid transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease, border-left-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(248, 250, 252, 0.9)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#fcfcfc';
                        }}
                      >
                        {/* 1. # (Index) */}
                        <td style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'center',
                          fontSize: '0.78rem',
                          color: isSelected ? '#047857' : '#94a3b8',
                          fontWeight: 800
                        }}>
                          {index + 1}
                        </td>

                        {/* 2. Cadet ID */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            color: isSelected ? '#064e2e' : '#047857',
                            backgroundColor: isSelected ? '#d1fae5' : 'rgba(6,78,46,0.08)',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            border: `1px solid ${isSelected ? '#a7f3d0' : 'rgba(6,78,46,0.15)'}`,
                            letterSpacing: '0.04em'
                          }}>
                            {cadetIdDisplay}
                          </span>
                        </td>

                        {/* 3. Cadet Name */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: isSelected ? '#064e2e' : '#0f172a',
                            fontFamily: 'Inter, sans-serif'
                          }}>
                            {cadet.name || 'UNKNOWN CADET'}
                          </div>
                        </td>

                        {/* 4. Gender */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: cadet.gender === 'Female' ? '#fdf2f8' : '#eff6ff',
                            color: cadet.gender === 'Female' ? '#9d174d' : '#1e40af',
                            border: `1px solid ${cadet.gender === 'Female' ? '#fbcfe8' : '#bfdbfe'}`
                          }}>
                            {cadet.gender || 'Male'}
                          </span>
                        </td>

                        {/* 5. Department */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {deptStyle ? (
                            <span
                              className={deptStyle.className}
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backgroundColor: deptStyle.bg,
                                color: deptStyle.text,
                                border: `1px solid ${deptStyle.border}`
                              }}
                            >
                              {cadet.department}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>

                        {/* 6. Academic Program */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
                            {cadet.program || cadet.course || '—'}
                          </span>
                        </td>

                        {/* 7. Selection Actions */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCadet(cadet);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: isSelected ? '1.5px solid #047857' : '1.5px solid #cbd5e1',
                              backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                              color: isSelected ? '#065f46' : '#64748b',
                              fontWeight: 800,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title={isSelected ? 'Click to deselect' : 'Click to select for QR print'}
                          >
                            {isSelected ? (
                              <>
                                <CheckSquare size={14} color="#047857" />
                                <span>Selected</span>
                              </>
                            ) : (
                              <>
                                <Square size={14} color="#94a3b8" />
                                <span>Select</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Card Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #f1f5f9'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
            <span>{filteredCadets.length} cadets shown in view</span>
            {' '}• <strong style={{ color: '#0f172a' }}>{selectedCountInCurrentView}</strong> selected in current view
            {selectedCadetsMap.size > 0 && (
              <span> • <strong style={{ color: '#047857' }}>{selectedCadetsMap.size}</strong> selected total across roster</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>


            {/* Clear Selection Button */}
            {selectedCadetsMap.size > 0 && (
              <button
                type="button"
                onClick={clearAllSelected}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>Clear Selection ({selectedCadetsMap.size})</span>
              </button>
            )}


          </div>
        </div>
      </div>

      {/* ── LIVE QR PASS PREVIEW SECTION (Main preview below cadet selection table) ── */}
      {selectedCadetsMap.size > 0 && (
        <div
          className="w-full bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs qr-preview-bottom-card"
          style={{
            width: '100%',
            padding: '1.5rem',
            backgroundColor: '#ffffff',
            borderRadius: '1rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <div className="print:hidden qr-screen-ui" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <QrCode size={18} color="#064e2e" />
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                  Selected QR Pass Preview ({selectedCadetsMap.size} {selectedCadetsMap.size === 1 ? 'cadet' : 'cadets'})
                </h4>
                <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  Preview of QR passes that will be generated on standard 4-per-row printable sheets ({printOrientation.toUpperCase()} mode)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #064e2e, #065f46)',
                color: '#ffffff', fontSize: '0.84rem', fontWeight: 800,
                cursor: 'pointer', boxShadow: '0 3px 10px rgba(6,78,46,0.3)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Printer size={15} />
              Print QR Pass Sheets ({selectedCadetsMap.size})
            </button>
          </div>

          <div
            className="print:hidden qr-screen-ui"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px',
              padding: '1.25rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px'
            }}
          >
            {selectedCadetsList.map((cadet, i) => (
              <QRPassTile key={`${cadet.id || cadet.cadetId}-${i}`} cadet={cadet} isPrint={false} />
            ))}
          </div>

          {/* Dedicated 4-per-row Print Sheet (Strictly rendered during print) */}
          <div className="qr-print-sheet">
            <div className="qr-print-grid">
              {selectedCadetsList.map((cadet, i) => (
                <QRPassTile key={`print-pass-${cadet.id || cadet.cadetId}-${i}`} cadet={cadet} isPrint={true} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Screen & Print Styles */}
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        /* Hidden on screen by default */
        .qr-print-sheet {
          display: none !important;
        }

        @media print {
          @page {
            size: ${printOrientation};
            margin: 8mm;
          }

          .qr-preview-bottom-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            background: transparent !important;
            margin: 0 !important;
            width: 100% !important;
          }

          /* Reset spacing, backgrounds, and positioning */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-image: none !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .app-container,
          .main-wrapper,
          .content-body,
          .qr-code-generator-root {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            width: 100% !important;
            max-width: 100% !important;
            position: static !important;
            overflow: visible !important;
            display: block !important;
          }

          /* Hide application shell, headers, navigation bars, buttons & screen UI */
          .sidebar,
          .top-header,
          .mobile-bottom-nav,
          .mobile-nav-container,
          .no-print,
          header,
          nav,
          aside,
          button,
          input,
          select,
          .qr-screen-ui,
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Dedicated Print Area: Strictly 4 passes per row grid */
          .qr-print-sheet {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            position: static !important;
          }

          .qr-print-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 7mm !important;
            row-gap: 7mm !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }

          /* Page Break Rules: Avoid breaking inside individual QR pass tiles */
          .qr-pass-tile {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </div>
  );
}
