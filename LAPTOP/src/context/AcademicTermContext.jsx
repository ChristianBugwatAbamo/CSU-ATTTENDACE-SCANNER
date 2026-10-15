import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAcademicTerms } from '../utils/academicTermsApi';

const AcademicTermContext = createContext(null);

export const ACADEMIC_TERM_STORAGE_KEY = 'csu_rotc_active_term_id';
export const SELECTED_TERM_STORAGE_KEY = 'csu_rotc_selected_term_id';
export const ACADEMIC_TERMS_CACHE_KEY = 'csu_rotc_academic_terms_cache';

export function AcademicTermProvider({ children }) {
  const [academicTerms, setAcademicTerms] = useState(() => {
    try {
      const cached = localStorage.getItem(ACADEMIC_TERMS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  const [selectedTermId, setSelectedTermIdState] = useState(() => {
    try {
      return (
        localStorage.getItem(SELECTED_TERM_STORAGE_KEY) ||
        localStorage.getItem(ACADEMIC_TERM_STORAGE_KEY) ||
        null
      );
    } catch (_) {
      return null;
    }
  });

  const [activeTermId, setActiveTermIdState] = useState(() => {
    try {
      return localStorage.getItem(ACADEMIC_TERM_STORAGE_KEY) || null;
    } catch (_) {
      return null;
    }
  });

  const [isLoadingTerms, setIsLoadingTerms] = useState(true);

  // Re-fetch all academic terms directly from Supabase Cloud
  const refreshTerms = useCallback(async () => {
    setIsLoadingTerms(true);
    try {
      const terms = await fetchAcademicTerms();
      if (Array.isArray(terms) && terms.length > 0) {
        setAcademicTerms(terms);
        try {
          localStorage.setItem(ACADEMIC_TERMS_CACHE_KEY, JSON.stringify(terms));
        } catch (_) {}

        // Identify real active/current term in DB
        const currentDbTerm =
          terms.find(
            (t) =>
              String(t.status || '').trim().toLowerCase() === 'current' ||
              t.isActive === true
          ) || terms[0];

        if (currentDbTerm?.id) {
          setActiveTermIdState(currentDbTerm.id);
        }

        // Auto-select or preserve selectedTermId (strictly CURRENT or ARCHIVED)
        setSelectedTermIdState((prevId) => {
          if (
            prevId &&
            terms.some(
              (t) =>
                t.id === prevId &&
                String(t.status || '').trim().toLowerCase() !== 'upcoming'
            )
          ) {
            return prevId;
          }
          const defaultId = currentDbTerm?.id || terms[0]?.id || null;
          if (defaultId) {
            try {
              localStorage.setItem(SELECTED_TERM_STORAGE_KEY, defaultId);
              localStorage.setItem(ACADEMIC_TERM_STORAGE_KEY, defaultId);
            } catch (_) {}
          }
          return defaultId;
        });
      }
      return terms;
    } catch (err) {
      console.warn('[AcademicTermContext] Failed to load academic terms from Supabase:', err);
      return [];
    } finally {
      setIsLoadingTerms(false);
    }
  }, []);

  // Set the selected term ID globally across all route components
  const setSelectedTermId = useCallback((id) => {
    if (!id) return;
    setSelectedTermIdState(id);
    try {
      localStorage.setItem(SELECTED_TERM_STORAGE_KEY, id);
      localStorage.setItem(ACADEMIC_TERM_STORAGE_KEY, id);
    } catch (_) {}
    window.dispatchEvent(
      new CustomEvent('csu_academic_term_changed', { detail: { termId: id, selectedTermId: id } })
    );
  }, []);

  // Update active term ID globally (alias to setSelectedTermId for backwards compatibility)
  const setActiveTermId = useCallback((id) => {
    setSelectedTermId(id);
  }, [setSelectedTermId]);

  // Sync on initial mount & bind real-time event listeners
  useEffect(() => {
    refreshTerms();

    const handleExternalChange = (e) => {
      const changedId =
        e?.detail?.selectedTermId ||
        e?.detail?.termId ||
        localStorage.getItem(SELECTED_TERM_STORAGE_KEY) ||
        localStorage.getItem(ACADEMIC_TERM_STORAGE_KEY);
      if (changedId) {
        setSelectedTermIdState(changedId);
      }
    };

    const handleTermsListUpdate = () => {
      refreshTerms();
    };

    window.addEventListener('csu_academic_term_changed', handleExternalChange);
    window.addEventListener('csu_settings_updated', handleTermsListUpdate);
    window.addEventListener('csu_term_created', handleTermsListUpdate);
    window.addEventListener('csu_supabase_config_updated', handleTermsListUpdate);

    const handleStorage = (e) => {
      if ((e.key === SELECTED_TERM_STORAGE_KEY || e.key === ACADEMIC_TERM_STORAGE_KEY) && e.newValue) {
        setSelectedTermIdState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('csu_academic_term_changed', handleExternalChange);
      window.removeEventListener('csu_settings_updated', handleTermsListUpdate);
      window.removeEventListener('csu_term_created', handleTermsListUpdate);
      window.removeEventListener('csu_supabase_config_updated', handleTermsListUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshTerms]);

  // The active term object (status = 'current' in DB)
  const activeTerm = useMemo(() => {
    if (!academicTerms || academicTerms.length === 0) return null;
    return (
      academicTerms.find(
        (t) =>
          String(t.status || '').trim().toLowerCase() === 'current' ||
          t.isActive === true
      ) ||
      academicTerms[0] ||
      null
    );
  }, [academicTerms]);

  // The selected term object (strictly the one selected in the top-right header)
  const selectedTerm = useMemo(() => {
    if (!academicTerms || academicTerms.length === 0) return null;
    return academicTerms.find((t) => t.id === selectedTermId) || activeTerm || null;
  }, [academicTerms, selectedTermId, activeTerm]);

  // Term Guardrail Policy: Active (AY 2026-2027 1st & 2nd Sem) vs Archived (AY 2025-2026 & older)
  const isArchived = useMemo(() => {
    if (!selectedTerm) return false;
    const st = String(selectedTerm.status || '').trim().toLowerCase();
    const ay = String(selectedTerm.academic_year || selectedTerm.academicYear || '').trim();
    if (st === 'archived' || selectedTerm.is_archived === true || selectedTerm.isArchived === true) {
      return true;
    }
    // If academic year is explicitly older than AY 2026-2027
    if (ay && !ay.includes('2026-2027')) {
      return true;
    }
    return false;
  }, [selectedTerm]);

  const value = useMemo(
    () => ({
      academicTerms,
      selectedTermId: selectedTermId || activeTerm?.id || null,
      activeTermId: activeTerm?.id || selectedTermId || null,
      selectedTerm,
      activeTerm,
      isArchived,
      setSelectedTermId,
      setActiveTermId,
      refreshTerms,
      isLoadingTerms
    }),
    [
      academicTerms,
      selectedTermId,
      selectedTerm,
      activeTerm,
      isArchived,
      setSelectedTermId,
      setActiveTermId,
      refreshTerms,
      isLoadingTerms
    ]
  );

  return (
    <AcademicTermContext.Provider value={value}>
      {children}
    </AcademicTermContext.Provider>
  );
}

export function useAcademicTerm() {
  const ctx = useContext(AcademicTermContext);
  if (!ctx) {
    return {
      academicTerms: [],
      selectedTermId: null,
      activeTermId: null,
      selectedTerm: null,
      activeTerm: null,
      isArchived: false,
      setSelectedTermId: () => {},
      setActiveTermId: () => {},
      refreshTerms: async () => [],
      isLoadingTerms: false
    };
  }
  return ctx;
}

