import { createClient } from '@supabase/supabase-js';

// Default Supabase project URL and anon public key
const DEFAULT_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://rsexdynexmqlltzscoip.supabase.co';
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
 * Bulk upserts attendance records to Supabase
 */
export async function bulkUpsertAttendanceToSupabase(logs) {
  const client = getSupabaseClient();
  if (!client || !Array.isArray(logs) || logs.length === 0) return null;

  const rows = logs.map(log => {
    const cid = log.cadetId || log.id;
    const dateStr = toDateKey(log.date || log.timestamp) || new Date().toISOString().split('T')[0];
    const finalStat = log.finalDailyStatus || log.status || (log.timeIn ? (log.isLate ? 'LATE' : 'PRESENT') : 'PRESENT');
    return {
      cadet_id: cid,
      name: log.name || 'Cadet',
      rank: log.rank || 'Cadet',
      battalion: log.battalion || '1st Battalion',
      company: log.company || 'Alpha Company',
      platoon: log.platoon || '1st Platoon',
      designation: log.designation || 'N/A',
      date: dateStr,
      time_in: log.timeIn || (log.scanMode !== 'Time-Out' ? log.timestamp : null),
      time_out: log.timeOut || (log.scanMode === 'Time-Out' ? log.timestamp : null),
      timestamp: log.timestamp || new Date().toISOString(),
      scan_mode: log.scanMode || 'Time-In',
      time_in_status: log.timeInStatus || (finalStat.includes('LATE') ? 'LATE' : 'PRESENT'),
      time_out_status: log.timeOutStatus || (log.timeOut ? 'PRESENT' : 'NO TIME-OUT'),
      status: finalStat,
      final_daily_status: finalStat,
      duty_officer: log.dutyOfficer || 'Duty Officer',
      session_name: log.sessionName || 'Training Session',
      received_at: new Date().toISOString()
    };
  });

  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await client
        .from('attendance_logs')
        .upsert(chunk, { onConflict: 'cadet_id,date' });
      if (error) throw error;
    }
    return rows;
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
 * Subscribes to Supabase Realtime changes on the attendance_logs table
 */
export function subscribeToAttendanceRealtime(onPayload) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('attendance_logs_live_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
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
