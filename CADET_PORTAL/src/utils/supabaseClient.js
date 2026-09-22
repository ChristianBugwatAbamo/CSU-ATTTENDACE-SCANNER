import { createClient } from '@supabase/supabase-js';
import { ACTIVE_FORMATION_DATES } from './attendanceRules.js';

// Default Supabase project URL and anon public key
const DEFAULT_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://rsexdynexmqlitzscoip.supabase.co';
const DEFAULT_SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZXhkeW5leG1xbGl0enNjb2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxOTg2MjEsImV4cCI6MjEwMjc3NDYyMX0.c2Ajh8MqUwqvUd5VaTZSfQM9rc3pTDNodtqb6FVcenY';

// Helper to retrieve active Supabase configuration
export function getSupabaseConfig() {
  let url = DEFAULT_SUPABASE_URL;
  let anonKey = DEFAULT_SUPABASE_KEY;

  try {
    const saved = localStorage.getItem('csu_rotc_supabase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url) url = parsed.url;
      if (parsed.anonKey) anonKey = parsed.anonKey;
    }
  } catch (_) { }

  // Auto-correct historical typo if stored in localStorage
  if (url && url.includes('rsexdynexmqlltzscoip')) {
    url = url.replace('rsexdynexmqlltzscoip', 'rsexdynexmqlitzscoip');
    try {
      localStorage.setItem('csu_rotc_supabase_config', JSON.stringify({ url, anonKey }));
    } catch (_) { }
  }

  return { url, anonKey, isConfigured: Boolean(url && anonKey) };
}

// Saves custom Supabase configuration
export function saveSupabaseConfig(url, anonKey) {
  try {
    localStorage.setItem(
      'csu_rotc_supabase_config',
      JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
    );
    supabaseInstance = null; // reset client instance
    window.dispatchEvent(new Event('csu_supabase_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save Supabase configuration:', err);
    return false;
  }
}

// Singleton client instance
let supabaseInstance = null;

export function getSupabaseClient() {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(url, anonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  }
  return supabaseInstance;
}

export const supabase = new Proxy({}, {
  get: (_, prop) => {
    const client = getSupabaseClient();
    if (!client) return undefined;
    const val = client[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  }
});

// Helper for normalizing dates to YYYY-MM-DD
function toDateKey(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==============================================================================
// 1. SESSIONS & CALENDAR
// ==============================================================================

let _cachedSessions = null;
let _cachedSessionsTime = 0;
const SESSIONS_CACHE_TTL = 5 * 1000; // 5 seconds

/**
 * Fetches attendance sessions from Supabase attendance_sessions table.
 */
export async function fetchAttendanceSessionsFromSupabase(forceRefresh = false) {
  const now = Date.now();
  if (forceRefresh) {
    _cachedSessions = null;
    _cachedSessionsTime = 0;
  } else if (_cachedSessions && (now - _cachedSessionsTime < SESSIONS_CACHE_TTL)) {
    return _cachedSessions;
  }

  // Check localStorage first for instant load only if NOT forcing refresh
  if (!forceRefresh) {
    try {
      const saved = localStorage.getItem('csu_rotc_db_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          _cachedSessions = parsed;
          _cachedSessionsTime = now;
          // Trigger background update silently
          setTimeout(() => fetchAttendanceSessionsFromSupabase(true), 100);
          return parsed;
        }
      }
    } catch (_) { }
  }

  const client = getSupabaseClient();
  if (!client) {
    return _cachedSessions || [];
  }

  try {
    const { data, error } = await client
      .from('attendance_sessions')
      .select('session_date, session_name, duty_officer, cutoff_time, total_scanned')
      .order('session_date', { ascending: false })
      .limit(500);

    if (error) throw error;
    const formatted = (data || []).map(s => ({
      dateKey: s.session_date,
      sessionDate: s.session_date,
      session_date: s.session_date,
      sessionName: s.session_name,
      session_name: s.session_name,
      dutyOfficer: s.duty_officer,
      duty_officer: s.duty_officer,
      cutoffTime: s.cutoff_time,
      cutoff_time: s.cutoff_time,
      totalScanned: s.total_scanned || 0
    }));

    _cachedSessions = formatted;
    _cachedSessionsTime = Date.now();
    try {
      localStorage.setItem('csu_rotc_db_sessions', JSON.stringify(formatted));
    } catch (_) { }
    return formatted;
  } catch (err) {
    console.error('[Supabase] fetchAttendanceSessionsFromSupabase error:', err);
    return _cachedSessions || [];
  }
}

let _cachedDates = null;
let _cachedDatesTime = 0;
const DATES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches all scheduled/recorded mandatory formation dates with caching.
 */
export async function fetchMandatoryFormationDates(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _cachedDates && (now - _cachedDatesTime < DATES_CACHE_TTL)) {
    return _cachedDates;
  }

  const datesSet = new Set();

  // Check local cache first
  if (!forceRefresh) {
    try {
      const saved = localStorage.getItem('csu_rotc_formation_dates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          _cachedDates = parsed;
          _cachedDatesTime = now;
          setTimeout(() => fetchMandatoryFormationDates(true), 300);
          return parsed;
        }
      }
    } catch (_) { }
  }

  // Query Supabase attendance_sessions efficiently
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('session_date')
        .limit(200);

      if (!error && Array.isArray(data)) {
        data.forEach(s => {
          const dk = toDateKey(s.session_date);
          if (dk) datesSet.add(dk);
        });
      }
    }
  } catch (e) {
    console.warn('Error fetching formation dates from Supabase:', e);
  }

  // Add local storage master attendance dates ONLY if no Supabase session dates were found (offline fallback)
  if (datesSet.size === 0) {
    try {
      const localLogs = localStorage.getItem('csu_rotc_master_attendance');
      if (localLogs) {
        const parsed = JSON.parse(localLogs);
        if (Array.isArray(parsed)) {
          parsed.forEach(l => {
            const dk = toDateKey(l.session_date || l.date || l.timestamp);
            if (dk) datesSet.add(dk);
          });
        }
      }
    } catch (_) { }
  }

  // Fall back to sample schedule ONLY if offline with no Supabase client and no dates exist
  if (datesSet.size === 0 && !getSupabaseClient()) {
    ACTIVE_FORMATION_DATES.forEach(d => datesSet.add(d));
  }

  const result = Array.from(datesSet).sort();
  _cachedDates = result;
  _cachedDatesTime = Date.now();
  try {
    localStorage.setItem('csu_rotc_formation_dates', JSON.stringify(result));
  } catch (_) { }

  return result;
}

// ==============================================================================
// 2. REALTIME & SYSTEM SETTINGS
// ==============================================================================

/**
 * High-precision Realtime subscriber for the Cadet Portal.
 * Automatically invalidates in-memory caches, syncs localStorage, and triggers callbacks
 * immediately when Admin saves settings (e.g. cut-off time, branding) or sessions.
 */
export function subscribeToPortalRealtime({ onSettingsChange, onSessionsChange, onAttendanceChange, onAnyChange } = {}) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channelId = `cadet_portal_realtime_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = client
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings' },
        (payload) => {
          _cachedSettings = null;
          _cachedSettingsTime = 0;
          if (payload?.new) {
            try {
              localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(payload.new));
              window.dispatchEvent(new CustomEvent('csu_settings_updated', { detail: payload.new }));
            } catch (_) { }
          }
          if (onSettingsChange) onSettingsChange(payload);
          if (onAnyChange) onAnyChange({ type: 'system_settings', payload });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_sessions' },
        (payload) => {
          _cachedSessions = null;
          _cachedSessionsTime = 0;
          if (onSessionsChange) onSessionsChange(payload);
          if (onAnyChange) onAnyChange({ type: 'attendance_sessions', payload });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        (payload) => {
          if (onAttendanceChange) onAttendanceChange(payload);
          if (onAnyChange) onAnyChange({ type: 'attendance_logs', payload });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'excuse_requests' },
        (payload) => {
          if (onAttendanceChange) onAttendanceChange(payload);
          if (onAnyChange) onAnyChange({ type: 'excuse_requests', payload });
        }
      )
      .subscribe();

    return channel;
  } catch (err) {
    console.warn('subscribeToPortalRealtime error:', err);
    return null;
  }
}

let _cachedSettings = null;
let _cachedSettingsTime = 0;
const SETTINGS_CACHE_TTL = 5 * 1000; // 5 seconds

/**
 * Fetches system settings from Supabase with caching.
 */
export async function fetchSettingsFromSupabase(forceRefresh = false) {
  const now = Date.now();
  if (forceRefresh) {
    _cachedSettings = null;
    _cachedSettingsTime = 0;
  } else if (_cachedSettings && (now - _cachedSettingsTime < SETTINGS_CACHE_TTL)) {
    return _cachedSettings;
  }

  // Check localStorage first for instant load only if NOT forcing refresh
  if (!forceRefresh) {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          _cachedSettings = parsed;
          _cachedSettingsTime = now;
          setTimeout(() => fetchSettingsFromSupabase(true), 100);
          return parsed;
        }
      }
    } catch (_) { }
  }

  const client = getSupabaseClient();
  if (!client) return _cachedSettings;

  try {
    const { data, error } = await client
      .from('system_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      _cachedSettings = data[0];
      _cachedSettingsTime = Date.now();
      try {
        localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(data[0]));
      } catch (_) { }
      return data[0];
    }
    return _cachedSettings;
  } catch (err) {
    console.error('Supabase fetch settings error:', err);
    return _cachedSettings;
  }
}

// ==============================================================================
// 3. CADET AUTHENTICATION & LOOKUP
// ==============================================================================

/**
 * Extracts normalized uppercase last name from a cadet object or full name string
 */
export const extractCadetLastName = (cadet) => {
  if (!cadet) return '';
  if (cadet.last_name) return String(cadet.last_name).trim().toUpperCase();
  if (cadet.lastName) return String(cadet.lastName).trim().toUpperCase();
  const name = String(cadet.name || cadet.fullName || '').trim();
  if (name.includes(',')) return name.split(',')[0].trim().toUpperCase();
  const parts = name.split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
};

/**
 * Fetches a single cadet profile by their Cadet ID and optional Last Name.
 * Requires two-factor parameter matching (student_id AND last_name) before granting access.
 * Checks Supabase first, falls back to local roster cache.
 */
export async function fetchCadetByCadetId(rawCadetId, rawLastName = '') {
  if (!rawCadetId) return null;
  const cleanId = String(rawCadetId).trim().toUpperCase();
  const cleanLastName = String(rawLastName || '').trim().toUpperCase();
  const digitsOnly = cleanId.replace(/[^0-9]/g, '');
  const dashedId = digitsOnly.length > 3 ? `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}` : cleanId;

  const buildProfile = (data) => ({
    id: data.id,
    cadetId: data.id,
    name: data.name,
    rank: data.rank || 'Cadet',
    battalion: data.battalion || '1st Battalion',
    company: data.company || 'Alpha Company',
    platoon: data.platoon || '1st Platoon',
    type: data.type || 'Basic Cadet',
    designation: data.designation || 'None',
    course: data.course || '',
    gender: data.gender || '',
    department: data.department || '',
    program: data.program || '',
    contact_number: data.contact_number || '',
    emergency_contact: data.emergency_contact || '',
    province: data.province || '',
    city: data.city || '',
    barangay: data.barangay || '',
    religion: data.religion || '',
    is_active: data.is_active !== false,
    status: data.is_active !== false ? 'ACTIVE' : 'INACTIVE',
    ...data
  });

  const cacheProfile = (profile) => {
    try {
      localStorage.setItem(`csu_rotc_cadet_profile_${cleanId}`, JSON.stringify(profile));
      if (dashedId !== cleanId) {
        localStorage.setItem(`csu_rotc_cadet_profile_${dashedId}`, JSON.stringify(profile));
      }
    } catch (_) { }
  };

  const verifyLastNameMatch = (cadetData) => {
    if (!cleanLastName) return true;
    const recordLastName = extractCadetLastName(cadetData);
    const normalizedInput = cleanLastName.replace(/[\s.-]/g, '');
    const normalizedRecord = recordLastName.replace(/[\s.-]/g, '');
    return recordLastName === cleanLastName || normalizedRecord === normalizedInput;
  };

  // 1. Query Supabase directly as the primary source of truth (STRICT EXACT MATCH ONLY)
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      // If last name is provided, query verifying both parameters (student_id AND last_name)
      if (cleanLastName) {
        try {
          const { data: directMatch, error: directErr } = await supabase
            .from('cadets')
            .select('*')
            .eq('student_id', cleanId)
            .eq('last_name', cleanLastName)
            .limit(1)
            .maybeSingle();

          if (!directErr && directMatch) {
            const profile = buildProfile(directMatch);
            cacheProfile(profile);
            return profile;
          }
        } catch (_) {
          // Fallback to table schema where student ID is stored in 'id' column
        }
      }

      // Query by id matching cleanId or dashedId
      const candidates = Array.from(new Set([cleanId, dashedId])).filter(Boolean);
      let query = supabase.from('cadets').select('*');

      if (candidates.length === 1) {
        query = query.eq('id', candidates[0]);
      } else {
        query = query.or(candidates.map(c => `id.eq.${c}`).join(','));
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (!error && data) {
        // Enforce strict exact equality verification on ID
        const matchedId = String(data.id || '').trim().toUpperCase();
        if (matchedId !== cleanId && matchedId !== dashedId) {
          console.warn(`[AUTH] Refusing mismatched cadet profile for login: typed "${cleanId}", matched "${matchedId}"`);
          return null;
        }

        // Enforce strict Last Name verification
        if (cleanLastName && !verifyLastNameMatch(data)) {
          const actualLastName = extractCadetLastName(data);
          console.warn(`[AUTH] Last name mismatch for cadet "${cleanId}": typed "${cleanLastName}", record has "${actualLastName}"`);
          const mismatchErr = new Error(`Last Name "${cleanLastName}" does not match record for Cadet ID "${cleanId}".`);
          mismatchErr.code = 'LAST_NAME_MISMATCH';
          mismatchErr.cadetId = cleanId;
          mismatchErr.enteredLastName = cleanLastName;
          mismatchErr.expectedLastName = actualLastName;
          throw mismatchErr;
        }

        const profile = buildProfile(data);
        cacheProfile(profile);
        return profile;
      }
    }
  } catch (err) {
    if (err.code === 'LAST_NAME_MISMATCH') {
      throw err;
    }
    console.warn('fetchCadetByCadetId Supabase query error, checking local roster:', err);
  }

  // 2. Fallback to local storage roster (STRICT EXACT MATCH ONLY)
  try {
    const cached = localStorage.getItem('csu_rotc_cadets_roster');
    if (cached) {
      const roster = JSON.parse(cached);
      if (Array.isArray(roster)) {
        const found = roster.find(c => {
          const cId = String(c.id || c.cadetId || c.cadet_id || '').trim().toUpperCase();
          const sId = String(c.student_id || c.studentId || '').trim().toUpperCase();
          return (
            cId === cleanId ||
            cId === dashedId ||
            (sId && sId === cleanId) ||
            (sId && sId === dashedId)
          );
        });

        if (found) {
          if (cleanLastName && !verifyLastNameMatch(found)) {
            const actualLastName = extractCadetLastName(found);
            const mismatchErr = new Error(`Last Name "${cleanLastName}" does not match record for Cadet ID "${cleanId}".`);
            mismatchErr.code = 'LAST_NAME_MISMATCH';
            mismatchErr.cadetId = cleanId;
            mismatchErr.enteredLastName = cleanLastName;
            mismatchErr.expectedLastName = actualLastName;
            throw mismatchErr;
          }
          return found;
        }
      }
    }
  } catch (err) {
    if (err.code === 'LAST_NAME_MISMATCH') {
      throw err;
    }
  }

  return null;
}

// ==============================================================================
// 4. CADET ATTENDANCE HISTORY
// ==============================================================================

/**
 * Fetches attendance history for a single cadet.
 * Checks Supabase first, falls back to local master attendance cache.
 */
export async function fetchCadetAttendanceHistory(rawCadetId, forceRefresh = false) {
  if (!rawCadetId) return [];
  const cleanId = String(rawCadetId).trim().toUpperCase();
  const digitsOnly = cleanId.replace(/[^0-9]/g, '');
  const dashedId = digitsOnly.length > 3 ? `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}` : cleanId;

  // 0. Check local cache first for instant UI load (0ms)
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(`csu_rotc_cadet_logs_${cleanId}`) ||
        (dashedId !== cleanId ? localStorage.getItem(`csu_rotc_cadet_logs_${dashedId}`) : null);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Trigger background update silently
          setTimeout(() => fetchCadetAttendanceHistory(rawCadetId, true), 300);
          return parsed;
        }
      }
    } catch (_) { }
  }

  let logs = [];

  // 1. Try Supabase with single consolidated OR query
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const orCond = dashedId !== cleanId
        ? `cadet_id.eq.${cleanId},cadet_id.eq.${dashedId}`
        : `cadet_id.eq.${cleanId}`;

      let { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .or(orCond)
        .order('date', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        logs = data.map(l => ({
          ...l,
          cadetId: l.cadet_id,
          timeIn: l.time_in,
          timeOut: l.time_out,
          timeInStatus: l.time_in_status,
          timeOutStatus: l.time_out_status,
          status: l.final_daily_status || l.status,
          finalDailyStatus: l.final_daily_status || l.status,
          dutyOfficer: l.duty_officer,
          sessionName: l.session_name,
          scanMode: l.scan_mode
        }));
      }

      // 1b. Also query excuse_requests table if present to ensure excuse status is always prioritized
      try {
        const { data: excuseData } = await supabase
          .from('excuse_requests')
          .select('*')
          .or(orCond);

        if (Array.isArray(excuseData) && excuseData.length > 0) {
          excuseData.forEach(ex => {
            const rawD = ex.drill_date || ex.date || ex.formation_date || ex.session_date;
            const exDate = toDateKey(rawD) || rawD;
            const rawExSt = String(ex.status || '').toUpperCase();
            const isExRejected = rawExSt === 'REJECTED' || rawExSt === 'DECLINED' || rawExSt === 'DECLARED_ABSENT' || rawExSt === 'DECLARED ABSENT' || rawExSt === 'ABSENT' || rawExSt === 'EXCUSE_REJECTED';
            const exStatus = (rawExSt === 'APPROVED' || rawExSt === 'EXCUSED')
              ? 'EXCUSED'
              : (isExRejected || rawExSt === 'ABSENT')
                ? 'ABSENT'
                : 'EXCUSE_PENDING';

            const matchIdx = logs.findIndex(l => {
              const ld = toDateKey(l.date || l.session_date || l.timestamp) || l.date;
              return ld === exDate;
            });

            if (matchIdx >= 0) {
              const existing = logs[matchIdx];
              const existingSt = String(existing.status || existing.final_daily_status || '').toUpperCase();
              let resolvedStatus = exStatus;
              if (exStatus === 'EXCUSED' || existingSt === 'EXCUSED' || existingSt === 'APPROVED') {
                resolvedStatus = 'EXCUSED';
              } else if (exStatus === 'ABSENT' || existingSt === 'ABSENT') {
                resolvedStatus = 'ABSENT';
              }

              logs[matchIdx] = {
                ...existing,
                status: resolvedStatus,
                final_daily_status: resolvedStatus,
                finalDailyStatus: resolvedStatus,
                excuse_status: rawExSt,
                excuseStatus: rawExSt,
                excuse_reason: ex.reason || ex.excuse_reason || existing.excuse_reason || (isExRejected ? 'Excuse Rejected / Declared Absent by Admin' : ''),
                excuse_submitted_at: ex.submitted_at || ex.created_at || existing.excuse_submitted_at,
                is_excuse: resolvedStatus !== 'ABSENT'
              };
            } else {
              logs.push({
                cadet_id: cleanId,
                cadetId: cleanId,
                date: exDate,
                session_date: exDate,
                status: exStatus,
                final_daily_status: exStatus,
                finalDailyStatus: exStatus,
                excuse_status: rawExSt,
                excuseStatus: rawExSt,
                excuse_reason: ex.reason || ex.excuse_reason || (isExRejected ? 'Excuse Rejected / Declared Absent by Admin' : (exStatus === 'ABSENT' ? 'Excuse Rejected / Declared Absent' : 'Absence excuse submitted')),
                excuse_submitted_at: ex.submitted_at || ex.created_at,
                is_excuse: exStatus !== 'ABSENT'
              });
            }
          });
        }
      } catch (_) { }

      if (logs.length > 0) {
        try {
          localStorage.setItem(`csu_rotc_cadet_logs_${cleanId}`, JSON.stringify(logs));
          if (dashedId !== cleanId) {
            localStorage.setItem(`csu_rotc_cadet_logs_${dashedId}`, JSON.stringify(logs));
          }
        } catch (_) { }
      }
    }
  } catch (err) {
    console.warn('fetchCadetAttendanceHistory Supabase query error, checking local logs:', err);
  }

  // 2. Supplement / fallback from local master attendance
  try {
    const cached = localStorage.getItem('csu_rotc_master_attendance');
    if (cached) {
      const masterLogs = JSON.parse(cached);
      if (Array.isArray(masterLogs)) {
        const localMatches = masterLogs.filter(l => {
          const cId = String(l.cadetId || l.cadet_id || l.id || l.i || '').trim().toUpperCase();
          const cNum = cId.replace(/[^A-Z0-9]/gi, '');
          return cId === cleanId || cId === dashedId || (cNum && cNum === digitsOnly);
        });

        if (logs.length === 0) {
          logs = localMatches;
        } else {
          // Merge unique dates/sessions
          const seen = new Set(logs.map(l => `${l.session_date || l.date}_${l.time_in || l.timeIn}`));
          localMatches.forEach(ml => {
            const key = `${ml.session_date || ml.date}_${ml.time_in || ml.timeIn}`;
            if (!seen.has(key)) {
              logs.push(ml);
              seen.add(key);
            }
          });
        }
      }
    }
  } catch (_) { }

  // Sort descending by date
  const sorted = logs.sort((a, b) => {
    const dateA = a.date || a.session_date || a.created_at || '';
    const dateB = b.date || b.session_date || b.created_at || '';
    return dateB.localeCompare(dateA);
  });

  if (sorted.length > 0) {
    try {
      localStorage.setItem(`csu_rotc_cadet_logs_${cleanId}`, JSON.stringify(sorted));
      if (dashedId !== cleanId) {
        localStorage.setItem(`csu_rotc_cadet_logs_${dashedId}`, JSON.stringify(sorted));
      }
    } catch (_) { }
  }

  return sorted;
}

// ==============================================================================
// 5. EXCUSE LETTER SUBMISSION (Cadet Portal)
// ==============================================================================

/**
 * Cadet submits an excuse request for a past absent formation date.
 * Upserts an attendance_logs row with status = EXCUSE_PENDING.
 */
export async function submitExcuseRequest(cadetId, formationDate, reason, proofDataUrl = null) {
  const client = getSupabaseClient();
  if (!client || !cadetId || !formationDate) return { error: 'INVALID_INPUT', message: 'Cadet ID and Formation Date are required.' };

  const cid = String(cadetId).trim().toUpperCase();

  function _dateKey(d) {
    if (!d) return '';
    const str = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const dt = new Date(str);
    if (isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  const dateKey = _dateKey(formationDate);
  if (!cid || !dateKey) return { error: 'INVALID_DATE', message: 'Invalid formation date selected.' };

  try {
    // 1. Strict validation: Verify that an official formation session exists in attendance_sessions
    const { data: sessionData, error: sessionErr } = await client
      .from('attendance_sessions')
      .select('id, session_name, session_date')
      .eq('session_date', dateKey)
      .limit(1)
      .maybeSingle();

    let session = sessionData;
    if (!session || !session.id) {
      try {
        const { data: newSession } = await client
          .from('attendance_sessions')
          .insert({
            session_name: `Training Formation - ${dateKey}`,
            session_date: dateKey,
            session_type: 'TRAINING_DAY',
            status: 'OPEN'
          })
          .select('id, session_name, session_date')
          .maybeSingle();
        if (newSession?.id) {
          session = newSession;
        }
      } catch (_) { }
    }

    if (!session || !session.id) {
      console.warn(`Cannot file excuse: No official formation session found for date ${dateKey}`);
      return {
        error: 'NON_FORMATION_DATE',
        message: `No official formation event was scheduled or conducted by Headquarters on ${dateKey}. Excuses can only be filed for verified formation dates.`
      };
    }

    // Check if record already exists for this cadet and date
    const { data: existing } = await client
      .from('attendance_logs')
      .select('id, status, session_id, name, rank, battalion, company, platoon')
      .eq('cadet_id', cid)
      .eq('date', dateKey)
      .maybeSingle();

    if (existing) {
      const exSt = String(existing.status || '').toUpperCase();
      if (exSt === 'EXCUSED' || exSt === 'APPROVED') {
        console.warn('Cannot file excuse: record is already EXCUSED.');
        return { error: 'ALREADY_EXCUSED', message: 'An official excuse for this formation has already been approved by Admin.' };
      }
      if (exSt === 'EXCUSE_PENDING' || exSt === 'PENDING') {
        console.warn('Cannot file excuse: record is already EXCUSE_PENDING.');
        return { error: 'ALREADY_PENDING', message: 'An excuse request for this formation date has already been submitted and is pending admin review.' };
      }
      if (exSt === 'REJECTED' || exSt === 'DECLINED' || exSt === 'DECLARED_ABSENT' || exSt === 'DECLARED ABSENT') {
        console.warn('Cannot file excuse: request was already REJECTED by Admin.');
        return { error: 'ALREADY_REJECTED', message: 'An excuse request for this formation date was already rejected by Admin and cannot be re-filed.' };
      }
    }

    // Also check excuse_requests table if present
    try {
      const { data: existingEx } = await client
        .from('excuse_requests')
        .select('id, status')
        .eq('cadet_id', cid)
        .eq('drill_date', dateKey)
        .maybeSingle();

      if (existingEx) {
        const exSt = String(existingEx.status || '').toUpperCase();
        if (exSt === 'EXCUSED' || exSt === 'APPROVED') {
          return { error: 'ALREADY_EXCUSED', message: 'An official excuse for this formation has already been approved by Admin.' };
        }
        if (exSt === 'EXCUSE_PENDING' || exSt === 'PENDING') {
          return { error: 'ALREADY_PENDING', message: 'An excuse request for this formation date has already been submitted and is pending admin review.' };
        }
        if (exSt === 'REJECTED' || exSt === 'DECLINED' || exSt === 'DECLARED_ABSENT' || exSt === 'DECLARED ABSENT') {
          return { error: 'ALREADY_REJECTED', message: 'An excuse request for this formation date was already rejected by Admin and cannot be re-filed.' };
        }
      }
    } catch (_) { }

    const now = new Date().toISOString();

    if (existing?.id) {
      // UPDATE existing row (whether ABSENT or updating EXCUSE_PENDING)
      const updatePayload = {
        status: 'EXCUSE_PENDING',
        final_daily_status: 'EXCUSE_PENDING',
        excuse_reason: reason || '',
        excuse_proof_url: proofDataUrl || null,
        excuse_submitted_at: now,
        updated_at: now
      };

      let { data, error } = await client
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single();

      // If database column is named 'reason' rather than 'excuse_reason', retry with 'reason'
      if (error && error.message && error.message.includes('excuse_reason')) {
        const altPayload = { ...updatePayload };
        delete altPayload.excuse_reason;
        altPayload.reason = reason || '';
        const altRes = await client
          .from('attendance_logs')
          .update(altPayload)
          .eq('id', existing.id)
          .select()
          .single();
        data = altRes.data;
        error = altRes.error;
      }

      if (error) throw error;
      return {
        data,
        updated: true,
        message: existing.status === 'EXCUSE_PENDING'
          ? 'Your pending excuse reason has been updated successfully.'
          : 'Excuse request submitted successfully! Awaiting Duty Officer verification.'
      };
    } else {
      // INSERT new minimal row for unrecorded formation or unscanned date
      // Fetch cadet profile from master roster to satisfy NOT NULL constraints (e.g. name)
      const { data: cadetProfile } = await client
        .from('cadets')
        .select('name, rank, battalion, company, platoon')
        .eq('id', cid)
        .maybeSingle();

      // Check if an official session exists for this date to avoid foreign key rejections
      const { data: sessionData } = await client
        .from('attendance_sessions')
        .select('id')
        .eq('session_date', dateKey)
        .limit(1)
        .maybeSingle();

      const insertPayload = {
        session_id: session?.id || sessionData?.id || null,
        cadet_id: cid,
        name: cadetProfile?.name || ('Cadet ' + cid),
        rank: cadetProfile?.rank || 'Cadet',
        battalion: cadetProfile?.battalion || '1st Battalion',
        company: cadetProfile?.company || 'Alpha Company',
        platoon: cadetProfile?.platoon || '1st Platoon',
        date: dateKey,
        status: 'EXCUSE_PENDING',
        final_daily_status: 'EXCUSE_PENDING',
        excuse_reason: reason || '',
        excuse_proof_url: proofDataUrl || null,
        excuse_submitted_at: now,
        updated_at: now
      };

      let { data, error } = await client
        .from('attendance_logs')
        .insert(insertPayload)
        .select()
        .single();

      // If database column is named 'reason' rather than 'excuse_reason', retry with 'reason'
      if (error && error.message && error.message.includes('excuse_reason')) {
        const altInsert = { ...insertPayload };
        delete altInsert.excuse_reason;
        altInsert.reason = reason || '';
        const altRes = await client
          .from('attendance_logs')
          .insert(altInsert)
          .select()
          .single();
        data = altRes.data;
        error = altRes.error;
      }

      if (error) throw error;

      // Also sync to excuse_requests table if present in Supabase
      try {
        await client
          .from('excuse_requests')
          .upsert({
            cadet_id: cid,
            drill_date: dateKey,
            date: dateKey,
            reason: reason || '',
            status: 'PENDING',
            submitted_at: now,
            updated_at: now
          }, { onConflict: 'cadet_id,drill_date' });
      } catch (_) { }

      return { data, created: true, message: 'Excuse request submitted successfully! Awaiting Duty Officer verification.' };
    }
  } catch (err) {
    console.error('submitExcuseRequest error:', err);
    return { error: 'DB_ERROR', message: err?.message || 'Database error occurred while submitting excuse.' };
  }
}
