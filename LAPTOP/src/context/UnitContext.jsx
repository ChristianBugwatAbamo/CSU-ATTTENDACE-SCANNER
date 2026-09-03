import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { DEFAULT_UNIT_STRUCTURE } from '../components/AdminSettings';
import { fetchSettingsFromSupabase, saveSettingsToSupabase } from '../utils/supabaseClient';

const UnitContext = createContext(null);

export function UnitProvider({ children }) {
  const [unitStructure, setUnitStructureState] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings') || localStorage.getItem('csu_rotc_system_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const struct = parsed.unitStructure || parsed.unit_structure;
        if (Array.isArray(struct) && struct.length > 0) {
          return struct;
        }
      }
    } catch (_) {}
    return DEFAULT_UNIT_STRUCTURE;
  });

  // Re-fetch and sync with Supabase Cloud
  const refreshUnitStructure = useCallback(async () => {
    try {
      const sb = await fetchSettingsFromSupabase();
      if (sb) {
        const struct = sb.unit_structure || sb.unitStructure;
        if (Array.isArray(struct) && struct.length > 0) {
          setUnitStructureState(struct);
          // Sync to localStorage
          try {
            const local = JSON.parse(localStorage.getItem('csu_rotc_admin_settings') || '{}');
            local.unitStructure = struct;
            local.unit_structure = struct;
            localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(local));
          } catch (_) {}
          return struct;
        }
      }
    } catch (err) {
      console.warn('[UnitContext] Failed to fetch settings from Supabase:', err);
    }
    return null;
  }, []);

  // Sync with cloud on initial mount and register event listeners
  useEffect(() => {
    refreshUnitStructure();

    const handleCustomUpdate = (e) => {
      const s = e?.detail || (() => {
        try {
          return JSON.parse(localStorage.getItem('csu_rotc_admin_settings') || '{}');
        } catch (_) {
          return {};
        }
      })();
      const struct = s.unitStructure || s.unit_structure;
      if (Array.isArray(struct) && struct.length > 0) {
        setUnitStructureState(struct);
      }
    };

    window.addEventListener('csu_settings_updated', handleCustomUpdate);
    window.addEventListener('storage', handleCustomUpdate);

    return () => {
      window.removeEventListener('csu_settings_updated', handleCustomUpdate);
      window.removeEventListener('storage', handleCustomUpdate);
    };
  }, [refreshUnitStructure]);

  // Centralized mutation function
  const updateUnitStructure = useCallback(async (newStructure) => {
    if (!Array.isArray(newStructure) || newStructure.length === 0) return;

    // 1. Update React Context state immediately for all listening views
    setUnitStructureState(newStructure);

    // 2. Persist to localStorage
    let updatedSettings = {};
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings') || '{}';
      updatedSettings = JSON.parse(saved);
    } catch (_) {}

    updatedSettings.unitStructure = newStructure;
    updatedSettings.unit_structure = newStructure;
    updatedSettings.updated_at = new Date().toISOString();

    try {
      localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(updatedSettings));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('csu_settings_updated', { detail: updatedSettings }));
    } catch (err) {
      console.warn('[UnitContext] localStorage write error:', err);
    }

    // 3. Save to Supabase Cloud in the background
    try {
      await saveSettingsToSupabase(updatedSettings);
    } catch (err) {
      console.warn('[UnitContext] Supabase cloud save error:', err);
    }
  }, []);

  // Helper selectors
  const battalions = useMemo(() => {
    return (unitStructure || []).map(b => ({
      id: b.id,
      name: b.name,
      shortCode: b.shortCode || b.code || '',
      targetQuota: b.targetQuota || 0,
      companies: b.companies || []
    }));
  }, [unitStructure]);

  const getCompaniesForBattalion = useCallback((bnIdentifier) => {
    if (!bnIdentifier || !Array.isArray(unitStructure)) return [];
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
    const targetNorm = norm(bnIdentifier);

    const bnObj = unitStructure.find(b => {
      const bNorm = norm(b.name);
      const bId = norm(b.id);
      const bCode = norm(b.shortCode || b.code || '');
      return bNorm === targetNorm || bId === targetNorm || bCode === targetNorm ||
        (targetNorm.includes('1') && bNorm.includes('1')) ||
        (targetNorm.includes('2') && bNorm.includes('2'));
    }) || unitStructure[0];

    return (bnObj && Array.isArray(bnObj.companies)) ? bnObj.companies : [];
  }, [unitStructure]);

  const getPlatoonsForCompany = useCallback((bnIdentifier, coIdentifier) => {
    const companies = getCompaniesForBattalion(bnIdentifier);
    if (!companies || companies.length === 0) return [];
    if (!coIdentifier) return companies[0]?.platoons || [];

    const norm = (s) => String(s || '').trim().toLowerCase().replace(/company|coy|\s+/gi, '');
    const targetNorm = norm(coIdentifier);

    const coObj = companies.find(c => {
      const cNorm = norm(c.name || c.id || '');
      return cNorm === targetNorm || cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
    }) || companies[0];

    return (coObj && Array.isArray(coObj.platoons)) ? coObj.platoons : [];
  }, [getCompaniesForBattalion]);

  const totalUnitTarget = useMemo(() => {
    if (!Array.isArray(unitStructure)) return 296;
    return unitStructure.reduce((acc, b) => {
      const bQuota = Number(b.targetQuota) || (b.companies || []).reduce((coAcc, c) => coAcc + (Number(c.targetQuota) || 0), 0);
      return acc + bQuota;
    }, 0);
  }, [unitStructure]);

  const value = useMemo(() => ({
    unitStructure,
    setUnitStructure: updateUnitStructure,
    updateUnitStructure,
    refreshUnitStructure,
    battalions,
    getCompaniesForBattalion,
    getPlatoonsForCompany,
    totalUnitTarget
  }), [
    unitStructure,
    updateUnitStructure,
    refreshUnitStructure,
    battalions,
    getCompaniesForBattalion,
    getPlatoonsForCompany,
    totalUnitTarget
  ]);

  return (
    <UnitContext.Provider value={value}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnitStructure() {
  const context = useContext(UnitContext);
  if (!context) {
    // Graceful fallback for components rendered outside provider
    return {
      unitStructure: DEFAULT_UNIT_STRUCTURE,
      setUnitStructure: () => {},
      updateUnitStructure: () => {},
      refreshUnitStructure: () => {},
      battalions: (DEFAULT_UNIT_STRUCTURE || []).map(b => ({
        id: b.id,
        name: b.name,
        shortCode: b.shortCode || '',
        targetQuota: b.targetQuota || 0,
        companies: b.companies || []
      })),
      getCompaniesForBattalion: () => [],
      getPlatoonsForCompany: () => [],
      totalUnitTarget: 296
    };
  }
  return context;
}
