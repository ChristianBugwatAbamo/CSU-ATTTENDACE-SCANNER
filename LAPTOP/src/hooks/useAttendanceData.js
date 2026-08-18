import { useState, useEffect, useCallback } from 'react';
import { getAttendanceStatus } from '../utils/attendanceStatus';

/**
 * Custom hook that provides live-synced attendance records, settings, and cadets roster
 * with automatic re-rendering whenever localStorage changes or custom events fire.
 */
export const useAttendanceData = () => {
  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_master_attendance');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings') || localStorage.getItem('csu_rotc_system_settings');
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  const [cadets, setCadets] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_cadets_roster');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const refreshFromStorage = useCallback(() => {
    try {
      const updatedRecords = localStorage.getItem('csu_rotc_master_attendance');
      const updatedSettings = localStorage.getItem('csu_rotc_admin_settings') || localStorage.getItem('csu_rotc_system_settings');
      const updatedCadets = localStorage.getItem('csu_rotc_cadets_roster');

      if (updatedRecords) setRecords(JSON.parse(updatedRecords));
      else setRecords([]);

      if (updatedSettings) setSettings(JSON.parse(updatedSettings));
      if (updatedCadets) setCadets(JSON.parse(updatedCadets));
    } catch (e) {
      console.warn("useAttendanceData storage parse error:", e);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      refreshFromStorage();
    };

    // Listen for cross-tab or manual state dispatch events
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-attendance-update', handleStorageChange);
    window.addEventListener('csu_settings_updated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-attendance-update', handleStorageChange);
      window.removeEventListener('csu_settings_updated', handleStorageChange);
    };
  }, [refreshFromStorage]);

  const activeCutoff = settings?.morningCutoffTime || settings?.formationCutoffTime || settings?.musterAndUnit?.timeInCutoff || "07:30";

  // Live filter/map records using current cutoff setting
  const dynamicRecords = records.map(record => ({
    ...record,
    status: getAttendanceStatus(record, activeCutoff)
  }));

  return {
    records,
    dynamicRecords,
    settings,
    cadets,
    activeCutoff,
    refreshFromStorage
  };
};
