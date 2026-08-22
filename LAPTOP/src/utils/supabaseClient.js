import { createClient } from '@supabase/supabase-js';

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
  } catch (_) {}

  // Auto-correct historical typo if stored in localStorage
  if (url && url.includes('rsexdynexmqlltzscoip')) {
    url = url.replace('rsexdynexmqlltzscoip', 'rsexdynexmqlitzscoip');
    try {
      localStorage.setItem('csu_rotc_supabase_config', JSON.stringify({ url, anonKey }));
    } catch (_) {}
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

// ==============================================================================
// 1. CADETS ROSTER CRUD (Supabase Cloud)
// ==============================================================================

/**
 * Fetches all cadets from Supabase
 */
export async function fetchCadetsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('cadets')
      .select('*')
      .order('id', { ascending: true })
      .limit(10000);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Supabase fetch cadets failed:', err);
    return [];
  }
}

/**
 * Adds a new cadet to Supabase
 */
export async function addCadetToSupabase(cadet) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      id: cadet.id || cadet.cadetId,
      name: cadet.name,
      rank: cadet.rank || 'Cadet',
      battalion: cadet.battalion || '1st Battalion',
      company: cadet.company || 'Alpha Company',
      platoon: cadet.platoon || '1st Platoon',
      type: cadet.type || 'Basic Cadet',
      designation: cadet.designation || 'N/A',
      course: cadet.course || '',
      contact_number: cadet.contactNumber || cadet.contact_number || '',
      emergency_contact: cadet.emergencyContact || cadet.emergency_contact || '',
      is_active: true
    };

    const { data, error } = await client.from('cadets').insert(payload).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase add cadet error:', err);
    throw err;
  }
}

/**
 * Updates an existing cadet in Supabase
 */
export async function updateCadetInSupabase(id, updates) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('cadets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase update cadet error:', err);
    throw err;
  }
}

/**
 * Deletes a cadet from Supabase
 */
export async function deleteCadetFromSupabase(id) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('cadets').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase delete cadet error:', err);
    return false;
  }
}

// ==============================================================================
// 2. ATTENDANCE LOGS CRUD (Supabase Cloud)
// ==============================================================================

/**
 * Fetches all attendance logs from Supabase
 */
export async function fetchAttendanceFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('attendance_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(10000);

    if (error) throw error;
    return (data || []).map(l => ({
      cadetId: l.cadet_id,
      name: l.name,
      rank: l.rank,
      battalion: l.battalion,
      company: l.company,
      platoon: l.platoon,
      designation: l.designation,
      date: l.date,
      timeIn: l.time_in,
      timeOut: l.time_out,
      timestamp: l.timestamp || l.time_in || l.time_out,
      scanMode: l.scan_mode,
      timeInStatus: l.time_in_status,
      timeOutStatus: l.time_out_status,
      status: l.final_daily_status || l.status,
      finalDailyStatus: l.final_daily_status || l.status,
      dutyOfficer: l.duty_officer,
      sessionName: l.session_name,
      scannedBy: l.scanned_by,
      receivedAt: l.received_at
    }));
  } catch (err) {
    console.error('Supabase fetch attendance error:', err);
    return [];
  }
}

/**
 * Fetches all attendance sessions from Supabase.
 * Used by AttendanceHistory to determine which formation dates exist
 * independently of whether attendance_logs has been populated yet.
 */
export async function fetchAttendanceSessionsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Supabase] Client is null — no URL/key configured');
    return [];
  }

  try {
    const { data, error } = await client
      .from('attendance_sessions')
      .select('session_date, session_name, duty_officer, cutoff_time, total_scanned')
      .order('session_date', { ascending: false })
      .limit(500);

    // Log raw response for diagnosis (visible in browser DevTools → Console)
    console.log('[Supabase] attendance_sessions query →', { rowCount: (data || []).length, error, data });

    if (error) throw error;
    return (data || []).map(s => ({
      dateKey: s.session_date,
      sessionName: s.session_name,
      dutyOfficer: s.duty_officer,
      cutoffTime: s.cutoff_time,
      totalScanned: s.total_scanned || 0
    }));
  } catch (err) {
    console.error('[Supabase] fetchAttendanceSessionsFromSupabase error:', err);
    return [];
  }
}

function toDateKey(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Bulk upserts cadets to Supabase
 */
export async function bulkUpsertCadetsToSupabase(cadetsList) {
  const client = getSupabaseClient();
  if (!client || !Array.isArray(cadetsList) || cadetsList.length === 0) return null;

  const cadetRows = cadetsList.map(c => ({
    id: c.id || c.cadetId,
    name: c.name || 'Cadet',
    rank: c.rank || 'Cadet',
    battalion: c.battalion || '1st Battalion',
    company: c.company || 'Alpha Company',
    platoon: c.platoon || '1st Platoon',
    type: c.type || (c.rank?.includes('1CL') || c.rank?.includes('2CL') || c.rank?.includes('3CL') || c.rank?.includes('4CL') || c.rank?.includes('COL') || c.rank?.includes('MAJ') || c.rank?.includes('CPT') || c.rank?.includes('LT') ? 'Cadet Officer' : 'Basic Cadet'),
    designation: c.designation || 'N/A',
    is_active: true
  }));

  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < cadetRows.length; i += CHUNK_SIZE) {
      const chunk = cadetRows.slice(i, i + CHUNK_SIZE);
      const { error } = await client
        .from('cadets')
        .upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }
    return cadetRows;
  } catch (err) {
    console.error('Supabase bulk cadets upsert error:', err);
    return null;
  }
}

/**
 * Intelligently infers cadet echelon, rank, and type from Cadet ID and partial scan metadata.
 * Ensures all required non-null fields for public.cadets table are valid strings.
 */
export function inferCadetFromId(cadetId, partial = {}) {
  const cid = String(cadetId || partial.id || partial.cadetId || '').trim().toUpperCase();
  let bn = partial.battalion && partial.battalion !== 'N/A' ? partial.battalion : null;
  let co = partial.company && partial.company !== 'N/A' ? partial.company : null;
  let pl = partial.platoon && partial.platoon !== 'N/A' ? partial.platoon : null;
  let type = partial.type || 'Basic Cadet';
  let rank = partial.rank || 'Cadet';

  // Check for Officer Corps patterns
  if (
    cid.startsWith('221-001') ||
    (rank && (rank.includes('COL') || rank.includes('MAJ') || rank.includes('CPT') || rank.includes('LT') || rank.includes('1CL') || rank.includes('2CL') || rank.includes('3CL') || rank.includes('4CL'))) ||
    (partial.battalion && String(partial.battalion).toUpperCase().includes('OFFICER'))
  ) {
    type = 'Cadet Officer';
    bn = bn || 'CADET OFFICERS';
    co = co || (rank.includes('1CL') ? '1CL' : rank.includes('2CL') ? '2CL' : rank.includes('3CL') ? '3CL' : 'Officer Corps');
    pl = pl || 'Officer Corps';
    if (!partial.rank) rank = 'Cadet Officer';
  } else if (/^221-\d{5}$/.test(cid)) {
    // Basic Cadet CSU ROTC ID pattern: 221-BN CO PL NUM (e.g., 221-11232)
    const bnDigit = cid.charAt(4);
    const coDigit = cid.charAt(5);
    const plDigit = cid.charAt(6);

    if (!bn) bn = bnDigit === '2' ? '2nd Battalion' : '1st Battalion';
    if (!co) {
      if (coDigit === '1') co = 'Alpha Company';
      else if (coDigit === '2') co = 'Bravo Company';
      else if (coDigit === '3') co = 'Charlie Company';
      else if (coDigit === '4') co = 'Delta Company';
      else co = 'Alpha Company';
    }
    if (!pl) {
      if (plDigit === '1') pl = '1st Platoon';
      else if (plDigit === '2') pl = '2nd Platoon';
      else if (plDigit === '3') pl = '3rd Platoon';
      else if (plDigit === '4') pl = '4th Platoon';
      else pl = '1st Platoon';
    }
  }

  const cleanName = partial.name && partial.name !== 'UNREGISTERED CADET' && partial.name !== 'Cadet' && String(partial.name).trim().length > 0
    ? String(partial.name).trim()
    : `CADET ${cid}`;

  return {
    id: cid,
    name: cleanName,
    rank: rank,
    battalion: bn || '1st Battalion',
    company: co || 'Alpha Company',
    platoon: pl || '1st Platoon',
    type: type,
    designation: partial.designation || 'N/A',
    is_active: true
  };
}

/**
 * Bulk upserts attendance records to Supabase with automatic Cadet & Session provisioning,
 * seamlessly merging TIME-OUT scans into existing daily attendance records.
 */
export async function bulkUpsertAttendanceToSupabase(logs) {
  const client = getSupabaseClient();
  if (!client || !Array.isArray(logs) || logs.length === 0) return null;

  // 1. Determine unique dates and cadet IDs involved in this batch
  const uniqueDatesSet = new Set();
  const uniqueCidsSet = new Set();

  logs.forEach(log => {
    const cid = String(log.cadetId || log.id || '').trim().toUpperCase();
    const dateStr = toDateKey(log.date || log.timestamp) || new Date().toISOString().split('T')[0];
    if (cid) {
      uniqueCidsSet.add(cid);
      uniqueDatesSet.add(dateStr);
    }
  });

  const uniqueDates = Array.from(uniqueDatesSet);
  const uniqueCids = Array.from(uniqueCidsSet);
  if (uniqueDates.length === 0 || uniqueCids.length === 0) return null;

  // 2. Fetch existing rows from Supabase for (cadet_id, date) to merge seamlessly
  const existingDbMap = new Map();
  try {
    const { data: existingRows, error: fetchErr } = await client
      .from('attendance_logs')
      .select('*')
      .in('date', uniqueDates)
      .in('cadet_id', uniqueCids);

    if (!fetchErr && Array.isArray(existingRows)) {
      existingRows.forEach(row => {
        existingDbMap.set(`${row.cadet_id}__${row.date}`, row);
      });
    }
  } catch (err) {
    console.warn('Note on fetching existing attendance logs for merging:', err);
  }

  // 3. Process and merge incoming logs against existing database state
  const mergedRowsMap = new Map();
  const uniqueCadetsMap = new Map();
  const uniqueSessionsMap = new Map();

  logs.forEach(log => {
    const cid = String(log.cadetId || log.id || '').trim().toUpperCase();
    if (!cid) return;
    const dateStr = toDateKey(log.date || log.timestamp) || new Date().toISOString().split('T')[0];
    const key = `${cid}__${dateStr}`;
    const cadetMeta = inferCadetFromId(cid, log);

    // Register cadet for auto-provisioning
    if (!uniqueCadetsMap.has(cid)) {
      uniqueCadetsMap.set(cid, cadetMeta);
    }

    // Register session for auto-provisioning
    if (!uniqueSessionsMap.has(dateStr)) {
      const dObj = new Date(`${dateStr}T12:00:00`);
      const dayOfWeek = isNaN(dObj.getTime()) ? 6 : dObj.getDay();
      const defaultSessionTitle = dayOfWeek === 6
        ? `Saturday Formation & Muster (${dateStr})`
        : `Daily Training & Drill Session (${dateStr})`;

      uniqueSessionsMap.set(dateStr, {
        session_date: dateStr,
        session_name: log.sessionName || defaultSessionTitle,
        duty_officer: log.dutyOfficer || 'Duty Officer',
        cutoff_time: '07:30'
      });
    }

    // Existing record in DB or previously merged in this batch
    const existing = mergedRowsMap.get(key) || existingDbMap.get(key) || null;

    const isTimeOutScan = log.scanMode === 'Time-Out' ||
      log.m === 0 ||
      log.mode === 'TIME_OUT' ||
      (log.status && String(log.status).toUpperCase().includes('TIME-OUT'));

    let finalTimeIn = null;
    let finalTimeOut = null;

    if (existing) {
      if (isTimeOutScan) {
        // Rule 2 (TIME-OUT Scan on existing record):
        // Preserve existing time_in and attach new time_out
        finalTimeIn = existing.time_in || existing.timeIn || null;
        finalTimeOut = log.timestamp || log.timeOut || existing.time_out || existing.timeOut || null;
      } else {
        // Rule 1 (TIME-IN Scan on existing record):
        // Keep or update time_in, preserve existing time_out
        finalTimeIn = log.timestamp || log.timeIn || existing.time_in || existing.timeIn || null;
        finalTimeOut = existing.time_out || existing.timeOut || log.timeOut || null;
      }
    } else {
      if (isTimeOutScan) {
        // Rule 2 (TIME-OUT Scan with NO existing record):
        finalTimeIn = log.timeIn || null;
        finalTimeOut = log.timestamp || log.timeOut || null;
      } else {
        // Rule 1 (TIME-IN Scan with NO existing record):
        finalTimeIn = log.timestamp || log.timeIn || null;
        finalTimeOut = log.timeOut || null;
      }
    }

    // Helper: Determine if Time-In was late (after 07:30 cutoff)
    let isLate = false;
    if (finalTimeIn) {
      const timeInDate = new Date(finalTimeIn);
      if (!isNaN(timeInDate.getTime())) {
        const mins = timeInDate.getHours() * 60 + timeInDate.getMinutes();
        isLate = mins > 450; // 07:30 AM = 450 minutes
      }
    }

    // Reconcile status based on merged scans
    const hasIn = Boolean(finalTimeIn);
    const hasOut = Boolean(finalTimeOut);

    let timeInStatus = 'ABSENT';
    let timeOutStatus = 'ABSENT';
    let finalDailyStatus = 'ABSENT';

    if (hasIn && hasOut) {
      timeInStatus = isLate ? 'LATE' : 'PRESENT';
      timeOutStatus = 'PRESENT';
      finalDailyStatus = isLate ? 'LATE' : 'PRESENT';
    } else if (hasIn && !hasOut) {
      timeInStatus = isLate ? 'LATE' : 'PRESENT';
      timeOutStatus = 'NO TIME-OUT';
      finalDailyStatus = isLate ? 'LATE / NO TIME-OUT' : 'NO TIME-OUT';
    } else if (!hasIn && hasOut) {
      timeInStatus = 'NO TIME-IN';
      timeOutStatus = 'PRESENT';
      finalDailyStatus = 'NO TIME-IN';
    }

    const mergedRow = {
      cadet_id: cid,
      name: (log.name && log.name !== 'UNREGISTERED CADET') ? log.name : (existing?.name || cadetMeta.name),
      rank: log.rank || existing?.rank || cadetMeta.rank,
      battalion: log.battalion || existing?.battalion || cadetMeta.battalion,
      company: log.company || existing?.company || cadetMeta.company,
      platoon: log.platoon || existing?.platoon || cadetMeta.platoon,
      designation: log.designation || existing?.designation || cadetMeta.designation || 'N/A',
      date: dateStr,
      time_in: finalTimeIn,
      time_out: finalTimeOut,
      timestamp: finalTimeIn || finalTimeOut || new Date().toISOString(),
      scan_mode: isTimeOutScan ? 'Time-Out' : 'Time-In',
      time_in_status: timeInStatus,
      time_out_status: timeOutStatus,
      status: finalDailyStatus === 'NO TIME-OUT' && !isLate ? 'PRESENT' : finalDailyStatus,
      final_daily_status: finalDailyStatus,
      duty_officer: log.dutyOfficer || existing?.duty_officer || 'Duty Officer',
      session_name: log.sessionName || existing?.session_name || `Formation Session (${dateStr})`,
      received_at: new Date().toISOString()
    };

    mergedRowsMap.set(key, mergedRow);
  });

  const finalRows = Array.from(mergedRowsMap.values());
  if (finalRows.length === 0) return null;

  try {
    // 4. Ensure all referenced cadets exist in public.cadets to satisfy Foreign Key rules
    const cadetRows = Array.from(uniqueCadetsMap.values());
    const CADET_CHUNK_SIZE = 400;
    for (let i = 0; i < cadetRows.length; i += CADET_CHUNK_SIZE) {
      const chunk = cadetRows.slice(i, i + CADET_CHUNK_SIZE);
      const { error: cadetErr } = await client
        .from('cadets')
        .upsert(chunk, { onConflict: 'id' });
      if (cadetErr) {
        console.warn('Note on auto-provisioning cadets in Supabase:', cadetErr);
      }
    }

    // 5. Ensure daily session dates exist in attendance_sessions
    const sessionRows = Array.from(uniqueSessionsMap.values());
    for (const session of sessionRows) {
      const { error: sessErr } = await client
        .from('attendance_sessions')
        .upsert(session, { onConflict: 'session_date' });
      if (sessErr) {
        console.warn('Note on auto-provisioning session in Supabase:', sessErr);
      }
    }

    // 6. Upsert attendance logs (single-row merged model with cadet_id,date unique key)
    const CHUNK_SIZE = 400;
    for (let i = 0; i < finalRows.length; i += CHUNK_SIZE) {
      const chunk = finalRows.slice(i, i + CHUNK_SIZE);
      const { error: logErr } = await client
        .from('attendance_logs')
        .upsert(chunk, { onConflict: 'cadet_id,date' });
      if (logErr) throw logErr;
    }

    // 7. Update attendance_sessions aggregate statistics for all affected dates
    for (const dateStr of uniqueSessionsMap.keys()) {
      try {
        const { data: dateLogs } = await client
          .from('attendance_logs')
          .select('final_daily_status, status')
          .eq('date', dateStr);

        if (dateLogs && dateLogs.length > 0) {
          const totalScanned = dateLogs.length;
          const presentCount = dateLogs.filter(l => (l.final_daily_status || l.status) === 'PRESENT' || (l.final_daily_status || l.status) === 'PRESENT (Complete)').length;
          const lateCount = dateLogs.filter(l => (l.final_daily_status || l.status) === 'LATE' || (l.final_daily_status || l.status) === 'LATE (Complete)').length;

          await client
            .from('attendance_sessions')
            .update({
              total_scanned: totalScanned,
              present_count: presentCount,
              late_count: lateCount,
              updated_at: new Date().toISOString()
            })
            .eq('session_date', dateStr);
        }
      } catch (_) {}
    }

    return finalRows;
  } catch (err) {
    console.error('Supabase bulk upsert error:', err);
    return null;
  }
}

/**
 * Deletes all cadet records from Supabase
 */
export async function clearCadetsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('cadets').delete().neq('id', '');
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase clear cadets error:', err);
    return false;
  }
}

/**
 * Deletes all attendance records from Supabase
 */
export async function clearAttendanceFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('attendance_logs').delete().neq('cadet_id', '');
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase clear attendance error:', err);
    return false;
  }
}

/**
 * Subscribes to Supabase Realtime changes on attendance_logs AND attendance_sessions.
 * Fires onPayload for any INSERT, UPDATE, or DELETE event on either table.
 * Returns the channel so the caller can unsubscribe on cleanup.
 */
export function subscribeToAttendanceRealtime(onPayload) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('attendance_history_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        (payload) => {
          if (onPayload) onPayload(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_sessions' },
        (payload) => {
          if (onPayload) onPayload(payload);
        }
      )
      .subscribe();

    return channel;
  } catch (err) {
    console.warn('Realtime subscription error:', err);
    return null;
  }
}

/** Alias for components that only need history-specific realtime syncing */
export const subscribeToHistoryRealtime = subscribeToAttendanceRealtime;

// ==============================================================================
// 3. SYSTEM SETTINGS CRUD (Supabase Cloud)
// ==============================================================================

/**
 * Fetches system settings from Supabase
 */
export async function fetchSettingsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (err) {
    console.error('Supabase fetch settings error:', err);
    return null;
  }
}

/**
 * Saves system settings to Supabase
 */
export async function saveSettingsToSupabase(settings) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      formation_cutoff_time: settings.formationCutoffTime || '07:30',
      formation_tardy_grace: Number(settings.formationTardyGrace || 15),
      cadet_quota_per_platoon: Number(settings.cadetQuotaPerPlatoon || 37),
      commanding_officer: settings.commandingOfficer || 'LTC RYAN L MARCELO INF (GSC) PA',
      commanding_officer_title: settings.commandingOfficerTitle || 'Commandant, CSU ROTC Unit',
      unit_name: settings.unitName || '1501st CDC ROTC Unit',
      parent_command: settings.parentCommand || '15th RCDG, ARESCOM, Philippine Army',
      host_institution: settings.hostInstitution || 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)',
      rotc_seal_url: settings.rotcSealUrl || '/rotc-seal-transparent.png',
      university_logo_url: settings.universityLogoUrl || '/csu-logo.png',
      auto_backup_enabled: settings.autoBackupEnabled !== false,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('system_settings')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase save settings error:', err);
    return null;
  }
}
