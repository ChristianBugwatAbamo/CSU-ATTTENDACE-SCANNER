import { createClient } from '@supabase/supabase-js';
import { getActiveFormationCutoff, parseCutoffMinutes, parseTimeToMinutes } from './attendanceStatus.js';

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
 * Fetches exact registered cadet count from Supabase
 */
export async function fetchCadetCountFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { count, error } = await client
      .from('cadets')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count;
  } catch (err) {
    console.error('Supabase fetch cadet count error:', err);
    return null;
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
 * Ingests a batch of scans directly to Supabase attendance_logs, executing direct
 * UPDATE queries specifically for TIME-OUT scans to merge with existing TIME-IN records.
 */
export async function ingestBatchToSupabase(batchScans = [], sessionDateInput = null) {
  const client = getSupabaseClient();
  if (!client || !Array.isArray(batchScans) || batchScans.length === 0) return null;

  const defaultDate = sessionDateInput || toDateKey(new Date());

  // Fetch active system settings for dynamic cutoff propagation
  let dbCutoff = getActiveFormationCutoff() || '07:30';
  try {
    const { data: currentSettings } = await client
      .from('system_settings')
      .select('formation_cutoff_time')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (currentSettings && currentSettings.length > 0 && currentSettings[0].formation_cutoff_time) {
      dbCutoff = currentSettings[0].formation_cutoff_time;
    }
  } catch (_) {}

  // 1. Group scans by (scanDate, dutyOfficer) to establish distinct session rows per Duty Officer
  const uniqueCadetsMap = new Map();
  const sessionGroupsMap = new Map();

  // Detect active duty officer from incoming batch scans or local settings
  let detectedDutyOfficer = null;
  for (const scan of batchScans) {
    const doName = scan.duty_officer || scan.dutyOfficer || scan.d;
    if (doName && doName !== 'Duty Officer' && String(doName).trim() !== '') {
      detectedDutyOfficer = String(doName).trim();
      break;
    }
  }

  if (!detectedDutyOfficer) {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeDutyOfficer) detectedDutyOfficer = parsed.activeDutyOfficer;
        else if (parsed.signatoryName) detectedDutyOfficer = parsed.signatoryName;
        else if (parsed.commandingOfficer) detectedDutyOfficer = parsed.commandingOfficer;
      }
    } catch (_) {}
  }

  batchScans.forEach(scan => {
    const cid = String(scan.cadet_id || scan.cadetId || scan.id || scan.i || '').trim().toUpperCase();
    if (!cid) return;
    const scanDate = toDateKey(scan.date || scan.session_date || scan.sessionDate || scan.timestamp) || defaultDate;
    const scanDutyOfficer = (scan.duty_officer && scan.duty_officer !== 'Duty Officer')
      ? scan.duty_officer
      : (scan.dutyOfficer && scan.dutyOfficer !== 'Duty Officer' ? scan.dutyOfficer : detectedDutyOfficer) || 'HQ Duty Officer';

    const groupKey = `${scanDate}__${scanDutyOfficer}`;

    if (!sessionGroupsMap.has(groupKey)) {
      const dObj = new Date(`${scanDate}T12:00:00`);
      const dayOfWeek = isNaN(dObj.getTime()) ? 6 : dObj.getDay();
      const platoonName = scan.platoon || scan.pl || null;
      const defaultTitle = scan.session_name || scan.sessionName || (platoonName && platoonName !== '1st Platoon'
        ? `Saturday Formation (${platoonName}) - ${scanDate}`
        : (dayOfWeek === 6 ? `Saturday Formation & Muster (${scanDate})` : `Daily Training & Drill Session (${scanDate})`));

      sessionGroupsMap.set(groupKey, {
        sessionDate: scanDate,
        dutyOfficer: scanDutyOfficer,
        sessionName: defaultTitle,
        cutoffTime: scan.cutoff_time || scan.cutoffTime || dbCutoff || '07:30',
        scans: []
      });
    }

    sessionGroupsMap.get(groupKey).scans.push(scan);

    if (!uniqueCadetsMap.has(cid)) {
      uniqueCadetsMap.set(cid, inferCadetFromId(cid, scan));
    }
  });

  // Provision cadets
  const cadetRows = Array.from(uniqueCadetsMap.values());
  const CADET_CHUNK_SIZE = 400;
  for (let i = 0; i < cadetRows.length; i += CADET_CHUNK_SIZE) {
    const chunk = cadetRows.slice(i, i + CADET_CHUNK_SIZE);
    try {
      await client.from('cadets').upsert(chunk, { onConflict: 'id' });
    } catch (_) {}
  }

  // Provision distinct session rows per Duty Officer + Date
  const sessionIdMap = new Map();
  for (const [groupKey, group] of sessionGroupsMap.entries()) {
    try {
      const sessionObj = await ensureSessionWithDutyOfficer(
        group.sessionDate,
        group.dutyOfficer,
        group.sessionName,
        group.cutoffTime
      );
      if (sessionObj?.id) {
        sessionIdMap.set(groupKey, sessionObj.id);
      }
    } catch (_) {}
  }

  // 2. Fetch existing logs for these cadets & dates in one batch query
  const uniqueDates = Array.from(new Set(Array.from(sessionGroupsMap.values()).map(g => g.sessionDate)));
  const uniqueCids = Array.from(uniqueCadetsMap.keys());
  const existingDbMap = new Map();

  try {
    const { data: existingRows } = await client
      .from('attendance_logs')
      .select('*')
      .in('date', uniqueDates)
      .in('cadet_id', uniqueCids);

    if (Array.isArray(existingRows)) {
      existingRows.forEach(r => {
        existingDbMap.set(`${r.cadet_id}__${r.date}`, r);
      });
    }
  } catch (err) {
    console.warn('Note on fetching existing attendance rows for ingest:', err);
  }

  // 3. Process each scan: execute targeted UPDATE for TIME-OUT on existing rows, or UPSERT for new
  const updatePromises = [];
  const upsertRows = [];

  for (const rawScan of batchScans) {
    const cid = String(rawScan.cadet_id || rawScan.cadetId || rawScan.id || rawScan.i || '').trim().toUpperCase();
    if (!cid) continue;

    const scanDate = toDateKey(rawScan.date || rawScan.session_date || rawScan.sessionDate || rawScan.timestamp) || defaultDate;
    const scanTimestamp = rawScan.timestamp || rawScan.time_out || rawScan.time_in || new Date().toISOString();
    const effectiveDutyOfficer = rawScan.duty_officer || rawScan.dutyOfficer || detectedDutyOfficer || 'HQ Duty Officer';
    const groupKey = `${scanDate}__${effectiveDutyOfficer}`;
    const targetSessionId = sessionIdMap.get(groupKey) || null;
    const key = `${cid}__${scanDate}`;
    const existing = existingDbMap.get(key);
    const cadetMeta = uniqueCadetsMap.get(cid) || inferCadetFromId(cid, rawScan);

    const isTimeOut = rawScan.scan_mode === 'Time-Out' ||
      rawScan.scanMode === 'Time-Out' ||
      rawScan.mode === 'TIME-OUT' ||
      rawScan.mode === 'TIME_OUT' ||
      rawScan.m === 0 ||
      (rawScan.status && String(rawScan.status).toUpperCase().includes('TIME-OUT'));

    if (isTimeOut) {
      if (existing) {
        // Direct Database UPDATE targeting time_out, time_out_status, and merged status
        const activeCutoffStr = rawScan.cutoff_time || rawScan.cutoffTime || (sessionGroupsMap.get(groupKey)?.cutoffTime) || dbCutoff || getActiveFormationCutoff() || '07:30';
        const cutoffMins = parseCutoffMinutes(activeCutoffStr);
        const timeInMins = parseTimeToMinutes(existing.time_in);
        const isLate = existing.time_in_status === 'LATE' || (!isNaN(timeInMins) && timeInMins > cutoffMins);
        const finalStatus = isLate ? 'LATE' : 'PRESENT';

        const updatePayload = {
          time_out: scanTimestamp,
          time_out_status: 'PRESENT',
          scan_mode: 'Time-Out',
          status: finalStatus,
          final_daily_status: finalStatus,
          duty_officer: effectiveDutyOfficer,
          session_name: rawScan.session_name || rawScan.sessionName || existing.session_name,
          updated_at: new Date().toISOString()
        };
        if (targetSessionId) updatePayload.session_id = targetSessionId;

        const updatePromise = client
          .from('attendance_logs')
          .update(updatePayload)
          .eq('cadet_id', cid)
          .eq('date', scanDate);

        updatePromises.push(updatePromise);
      } else {
        // No existing time-in: Insert new record with NO TIME-IN
        const insertRow = {
          cadet_id: cid,
          name: rawScan.name && rawScan.name !== 'UNREGISTERED CADET' ? rawScan.name : cadetMeta.name,
          rank: rawScan.rank || cadetMeta.rank,
          battalion: rawScan.battalion || cadetMeta.battalion,
          company: rawScan.company || cadetMeta.company,
          platoon: rawScan.platoon || cadetMeta.platoon,
          designation: rawScan.designation || cadetMeta.designation || 'N/A',
          date: scanDate,
          time_in: null,
          time_out: scanTimestamp,
          timestamp: scanTimestamp,
          scan_mode: 'Time-Out',
          time_in_status: 'NO TIME-IN',
          time_out_status: 'PRESENT',
          status: 'NO TIME-IN',
          final_daily_status: 'NO TIME-IN',
          duty_officer: effectiveDutyOfficer,
          session_name: rawScan.session_name || rawScan.sessionName || `Formation Session (${scanDate})`,
          received_at: new Date().toISOString()
        };
        if (targetSessionId) insertRow.session_id = targetSessionId;
        upsertRows.push(insertRow);
      }
    } else {
      // TIME-IN Scan evaluated against dynamic active formation cutoff
      const activeCutoffStr = rawScan.cutoff_time || rawScan.cutoffTime || (sessionGroupsMap.get(groupKey)?.cutoffTime) || dbCutoff || getActiveFormationCutoff() || '07:30';
      const cutoffMins = parseCutoffMinutes(activeCutoffStr);
      const timeInMins = parseTimeToMinutes(scanTimestamp);
      const isLate = !isNaN(timeInMins) && timeInMins > cutoffMins;
      const timeInStat = isLate ? 'LATE' : 'PRESENT';

      if (existing && existing.time_out) {
        // Has existing time_out: direct update time_in and complete status
        const finalStatus = isLate ? 'LATE' : 'PRESENT';
        const updatePayload = {
          time_in: scanTimestamp,
          time_in_status: timeInStat,
          scan_mode: 'Time-In',
          status: finalStatus,
          final_daily_status: finalStatus,
          duty_officer: effectiveDutyOfficer,
          updated_at: new Date().toISOString()
        };
        if (targetSessionId) updatePayload.session_id = targetSessionId;

        const updatePromise = client
          .from('attendance_logs')
          .update(updatePayload)
          .eq('cadet_id', cid)
          .eq('date', scanDate);

        updatePromises.push(updatePromise);
      } else {
        const insertRow = {
          cadet_id: cid,
          name: rawScan.name && rawScan.name !== 'UNREGISTERED CADET' ? rawScan.name : (existing?.name || cadetMeta.name),
          rank: rawScan.rank || existing?.rank || cadetMeta.rank,
          battalion: rawScan.battalion || existing?.battalion || cadetMeta.battalion,
          company: rawScan.company || existing?.company || cadetMeta.company,
          platoon: rawScan.platoon || existing?.platoon || cadetMeta.platoon,
          designation: rawScan.designation || existing?.designation || cadetMeta.designation || 'N/A',
          date: scanDate,
          time_in: scanTimestamp,
          time_out: existing?.time_out || null,
          timestamp: scanTimestamp,
          scan_mode: 'Time-In',
          time_in_status: timeInStat,
          time_out_status: existing?.time_out ? 'PRESENT' : 'NO TIME-OUT',
          status: timeInStat,
          final_daily_status: existing?.time_out ? timeInStat : (isLate ? 'LATE / NO TIME-OUT' : 'NO TIME-OUT'),
          duty_officer: effectiveDutyOfficer,
          session_name: rawScan.session_name || rawScan.sessionName || existing?.session_name || `Formation Session (${scanDate})`,
          received_at: new Date().toISOString()
        };
        if (targetSessionId) insertRow.session_id = targetSessionId;
        upsertRows.push(insertRow);
      }
    }
  }

  // Execute all direct updates in parallel
  if (updatePromises.length > 0) {
    const updateResults = await Promise.allSettled(updatePromises);
    for (let idx = 0; idx < updateResults.length; idx++) {
      const res = updateResults[idx];
      const err = res.status === 'rejected' ? res.reason : res.value?.error;
      if (err && (err.code === 'PGRST204' || String(err.message).includes('session_id'))) {
        // Fallback retry without session_id
        const rawScan = batchScans[idx] || {};
        const cid = String(rawScan.cadet_id || rawScan.cadetId || rawScan.id || rawScan.i || '').trim().toUpperCase();
        const scanDate = toDateKey(rawScan.date || rawScan.session_date || rawScan.sessionDate || rawScan.timestamp) || defaultDate;
        const scanTimestamp = rawScan.timestamp || rawScan.time_out || rawScan.time_in || new Date().toISOString();
        const effectiveDutyOfficer = rawScan.duty_officer || rawScan.dutyOfficer || detectedDutyOfficer || 'HQ Duty Officer';

        try {
          await client
            .from('attendance_logs')
            .update({
              time_out: scanTimestamp,
              time_out_status: 'PRESENT',
              duty_officer: effectiveDutyOfficer,
              updated_at: new Date().toISOString()
            })
            .eq('cadet_id', cid)
            .eq('date', scanDate);
        } catch (_) {}
      } else if (err) {
        console.error('Direct attendance log update error:', err);
      }
    }
  }

  // Execute upserts in chunks with resilient schema fallback
  if (upsertRows.length > 0) {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
      let chunk = upsertRows.slice(i, i + CHUNK_SIZE);
      let { error } = await client
        .from('attendance_logs')
        .upsert(chunk, { onConflict: 'cadet_id,date' });

      if (error && (error.code === 'PGRST204' || String(error.message).includes('session_id'))) {
        const strippedChunk = chunk.map(row => {
          const { session_id, ...rest } = row;
          return rest;
        });
        const retryResult = await client
          .from('attendance_logs')
          .upsert(strippedChunk, { onConflict: 'cadet_id,date' });
        error = retryResult.error;
      }

      if (error) {
        console.error('Batch attendance upsert error:', error);
      }
    }
  }

  // 4. Recalculate session aggregates for each session group
  for (const group of sessionGroupsMap.values()) {
    try {
      const { data: dateLogs } = await client
        .from('attendance_logs')
        .select('final_daily_status, status')
        .eq('date', group.sessionDate)
        .eq('duty_officer', group.dutyOfficer);

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
          .eq('session_date', group.sessionDate)
          .eq('duty_officer', group.dutyOfficer);
      }
    } catch (_) {}
  }

  return { success: true, count: batchScans.length };
}

/**
 * Bulk upserts attendance records to Supabase with automatic Cadet & Session provisioning
 */
export async function bulkUpsertAttendanceToSupabase(logs, sessionDate = null) {
  return ingestBatchToSupabase(logs, sessionDate);
}

/**
 * Ensures attendance_sessions record exists for sessionDate specific to this Duty Officer.
 * Architecture: Distinct session row per (session_date, duty_officer) batch.
 */
export async function ensureSessionWithDutyOfficer(sessionDate, officerName = null, sessionTitle = null, cutoffTime = null) {
  const client = getSupabaseClient();
  if (!client || !sessionDate) return null;

  let dutyOfficerName = officerName && officerName !== 'Duty Officer' && String(officerName).trim() !== ''
    ? String(officerName).trim()
    : null;

  // Fallback to active admin settings if no officer name was provided in the batch
  if (!dutyOfficerName) {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeDutyOfficer) dutyOfficerName = parsed.activeDutyOfficer;
        else if (parsed.signatoryName) dutyOfficerName = parsed.signatoryName;
        else if (parsed.commandingOfficer) dutyOfficerName = parsed.commandingOfficer;
      }
    } catch (_) {}
  }

  const finalOfficer = dutyOfficerName || 'HQ Duty Officer';
  const activeCutoff = cutoffTime || getActiveFormationCutoff() || '07:30';

  try {
    // 1. Check if a session already exists for this (session_date, duty_officer)
    const { data: existingSession, error: fetchErr } = await client
      .from('attendance_sessions')
      .select('id, session_date, session_name, duty_officer, cutoff_time, total_scanned, present_count, late_count')
      .eq('session_date', sessionDate)
      .eq('duty_officer', finalOfficer)
      .maybeSingle();

    if (existingSession) {
      return existingSession;
    }

    // 2. Insert new distinct session row for this Duty Officer + Date
    const dObj = new Date(`${sessionDate}T12:00:00`);
    const dayOfWeek = isNaN(dObj.getTime()) ? 6 : dObj.getDay();
    const defaultTitle = sessionTitle || (dayOfWeek === 6
      ? `Saturday Formation & Muster (${sessionDate})`
      : `Daily Training & Drill Session (${sessionDate})`);

    const { data: newSession, error: insertErr } = await client
      .from('attendance_sessions')
      .insert({
        session_date: sessionDate,
        session_name: defaultTitle,
        duty_officer: finalOfficer,
        cutoff_time: activeCutoff
      })
      .select()
      .maybeSingle();

    if (!insertErr && newSession) {
      return newSession;
    }

    // Fallback if unique constraint on session_date still exists in DB before migration SQL
    if (insertErr) {
      const { data: fallbackSession } = await client
        .from('attendance_sessions')
        .select('id, session_date, session_name, duty_officer, cutoff_time')
        .eq('session_date', sessionDate)
        .maybeSingle();

      if (fallbackSession) {
        await client
          .from('attendance_sessions')
          .update({ duty_officer: finalOfficer, updated_at: new Date().toISOString() })
          .eq('id', fallbackSession.id);
        return fallbackSession;
      }
    }

    return null;
  } catch (err) {
    console.error('ensureSessionWithDutyOfficer error:', err);
    return null;
  }
}

/**
 * Ingestion handler for smartphone batch data.
 * Creates or targets the session row specific to that Duty Officer + Date,
 * and upserts all scanned cadets into attendance_logs attached to this session.
 */
export async function processIncomingBatch(batchData = {}) {
  const { sessionDate, dutyOfficerName, platoon, scans = [] } = batchData;
  const targetDate = sessionDate || toDateKey(new Date());
  const officer = dutyOfficerName || 'HQ Duty Officer';

  const mappedScans = (scans || []).map(scan => ({
    ...scan,
    cadet_id: scan.cadet_id || scan.cadetId || scan.id || scan.i,
    date: targetDate,
    duty_officer: officer,
    platoon: scan.platoon || platoon || '1st Platoon',
    session_name: scan.session_name || scan.sessionName || (platoon ? `Saturday Formation (${platoon}) - ${targetDate}` : `Formation Session (${targetDate})`)
  }));

  return ingestBatchToSupabase(mappedScans, targetDate);
}

/**
 * Synchronizes formation cutoff time to both system_settings and today's attendance_sessions row in Supabase.
 */
export async function syncSessionCutoffTime(newCutoffTime) {
  const client = getSupabaseClient();
  if (!client || !newCutoffTime) return false;

  const today = toDateKey(new Date());
  const cleanCutoff = String(newCutoffTime).trim();

  try {
    // 1. Update system_settings table (singleton record)
    const { data: existingSettings } = await client
      .from('system_settings')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1);

    if (existingSettings && existingSettings.length > 0) {
      await client
        .from('system_settings')
        .update({
          formation_cutoff_time: cleanCutoff,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSettings[0].id);
    } else {
      await client
        .from('system_settings')
        .insert({
          formation_cutoff_time: cleanCutoff,
          updated_at: new Date().toISOString()
        });
    }

    // 2. Update active today session in attendance_sessions table
    await client
      .from('attendance_sessions')
      .update({
        cutoff_time: cleanCutoff,
        updated_at: new Date().toISOString()
      })
      .eq('session_date', today);

    return true;
  } catch (err) {
    console.error('syncSessionCutoffTime error:', err);
    return false;
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
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return (data && data.length > 0) ? data[0] : null;
  } catch (err) {
    console.error('Supabase fetch settings error:', err);
    return null;
  }
}

/**
 * Saves system settings to Supabase across all 4 tab sections:
 * Tab 1: Muster & Unit (formation_cutoff_time, total_unit_target, unit_structure)
 * Tab 2: Unit Branding (unit_name, commanding_officer, host_institution, parent_command, rotc_seal_url, university_logo_url)
 * Tab 3: Exports & Letters (excel_export_path, letterhead_config, auto_backup_enabled)
 * Tab 4: ID Printing (id_signatory_name, id_signatory_title, id_signature_url, id_card_orientation, officer_ranks_list, officer_roles_list)
 */
export async function saveSettingsToSupabase(settings) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const cutoff = settings.morningCutoffTime || settings.formationCutoffTime || (settings.musterAndUnit && settings.musterAndUnit.timeInCutoff) || getActiveFormationCutoff() || '07:30';

    let letterheadObj = settings.letterheadConfig || settings.letterhead_config || null;
    if (!letterheadObj) {
      try {
        const savedLh = localStorage.getItem('csu_rotc_letterhead_settings');
        if (savedLh) letterheadObj = JSON.parse(savedLh);
      } catch (_) {}
    }

    const fullPayload = {
      // Tab 1: Muster & Unit
      formation_cutoff_time: cutoff,
      formation_tardy_grace: Number(settings.formationTardyGrace ?? 15),
      cadet_quota_per_platoon: Number(settings.cadetQuotaPerPlatoon ?? 37),
      total_unit_target: Number(settings.totalUnitTarget || settings.unitTargetCapacity || 1184),
      unit_structure: settings.unitStructure || null,

      // Tab 2: Unit Branding
      unit_name: settings.unitName || '1501st CDC ROTC Unit',
      commanding_officer: settings.commandingOfficer || 'LTC CHRISTIAN B ABAMO INF (GSC) PA',
      commanding_officer_title: settings.commandingOfficerTitle || 'Commandant, CSU ROTC Unit',
      parent_command: settings.parentCommand || '15th RCDG, ARESCOM, Philippine Army',
      host_institution: settings.hostInstitution || 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)',
      rotc_seal_url: settings.rotcSealUrl || '/rotc-seal-transparent.png',
      university_logo_url: settings.universityLogoUrl || '/csu-logo.png',

      // Tab 3: Exports & Letters
      excel_export_path: settings.exportDirectory || settings.excelExportPath || './desktop_excel_reports/',
      letterhead_config: letterheadObj,
      auto_backup_enabled: settings.autoBackupEnabled !== false,

      // Tab 4: ID Printing
      id_signatory_name: settings.signatoryName || settings.idSignatoryName || settings.commandingOfficer || 'LTC CHRISTIAN B ABAMO INF (GSC) PA',
      id_signatory_title: settings.signatoryDesignation || settings.idSignatoryTitle || settings.commandingOfficerTitle || 'Commandant, CSU ROTC Unit',
      id_signature_url: settings.signatureImageUrl || settings.idSignatureUrl || '',
      id_card_orientation: settings.cardOrientation || settings.idCardOrientation || 'vertical',
      officer_ranks_list: settings.officerRanks || settings.officer_ranks_list || null,
      officer_roles_list: settings.officerDesignations || settings.officer_roles_list || null,

      updated_at: new Date().toISOString()
    };

    // Update existing singleton row in system_settings if present, else insert
    const { data: existingRows } = await client
      .from('system_settings')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1);

    let savedData = null;
    let targetId = (existingRows && existingRows.length > 0) ? existingRows[0].id : null;

    // Resilient upsert: attempts full payload first; if any column not yet migrated in DB, strips missing columns and retries
    let attemptPayload = { ...fullPayload };
    const maxAttempts = Object.keys(fullPayload).length + 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let res;
      if (targetId) {
        res = await client
          .from('system_settings')
          .update(attemptPayload)
          .eq('id', targetId)
          .select()
          .single();
      } else {
        res = await client
          .from('system_settings')
          .insert(attemptPayload)
          .select()
          .single();
      }

      if (!res.error) {
        savedData = res.data;
        break;
      }

      // Check if error is due to missing column in Supabase schema cache
      if (res.error.code === 'PGRST204' || res.error.message?.includes('column')) {
        const match = res.error.message.match(/'([^']+)' column/);
        if (match && match[1] && match[1] in attemptPayload) {
          delete attemptPayload[match[1]];
          continue;
        }
      }

      throw res.error;
    }

    // Propagate cutoff to today's session in attendance_sessions
    const today = toDateKey(new Date());
    await client
      .from('attendance_sessions')
      .update({ cutoff_time: cutoff, updated_at: new Date().toISOString() })
      .eq('session_date', today);

    return savedData;
  } catch (err) {
    console.error('Supabase save settings error:', err);
    return null;
  }
}
