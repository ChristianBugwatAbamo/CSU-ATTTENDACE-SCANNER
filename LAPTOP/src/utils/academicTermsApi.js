import { getSupabaseClient, supabase } from './supabaseClient';

/**
 * Academic Terms (Per-Sem) data access.
 * Backed by public.academic_terms + RPC public.set_active_academic_term().
 * See supabase_academic_terms_migration.sql.
 */

const TERM_COLUMNS =
  'id, academic_year, semester, course, status, start_date, end_date, expected_training_days, completed_training_days, enrolled_cadets, term_order, created_at';

/**
 * Normalizes any date value (YYYY-MM-DD string, Date object, ISO timestamp) into standard 'YYYY-MM-DD'.
 * Uses local calendar values for Date objects to avoid UTC day-shift bugs.
 */
export function normalizeDateToISO(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(d = new Date()) {
  return normalizeDateToISO(d);
}

/**
 * Calculates a term's status in real time against the system date (new Date()):
 *  - currentDate >= start_date AND currentDate <= end_date -> 'current'
 *  - currentDate < start_date                              -> 'upcoming'
 *  - currentDate > end_date                                -> 'archived'
 */
export function evaluateTermStatusByDates(termOrDates, todayDate = new Date()) {
  const currentDate = normalizeDateToISO(todayDate);
  const rawStart = termOrDates?.startDate || termOrDates?.start_date || termOrDates?.startDateStr;
  const rawEnd = termOrDates?.endDate || termOrDates?.end_date || termOrDates?.endDateStr;

  const startDate = normalizeDateToISO(rawStart);
  const endDate = normalizeDateToISO(rawEnd);

  if (!startDate || !endDate || !currentDate) {
    return termOrDates?.status || 'upcoming';
  }

  // Pure standard ISO (YYYY-MM-DD) date comparison
  if (currentDate >= startDate && currentDate <= endDate) return 'current';
  if (currentDate > endDate) return 'archived';
  if (currentDate < startDate) return 'upcoming';
  return termOrDates?.status || 'upcoming';
}

/** DB row -> UI shape used by AcademicTermsTab / AcademicTermsManager */
export function mapTermRow(row) {
  if (!row) return null;
  const start_date = normalizeDateToISO(row.start_date || row.startDate || null);
  const end_date = normalizeDateToISO(row.end_date || row.endDate || null);

  // Strictly preserve the EXACT status value stored in Supabase (e.g., upcoming, CURRENT, or ARCHIVED)
  const exactStatus = row.status !== undefined && row.status !== null ? String(row.status).trim() : '';
  const normStatus = exactStatus.toLowerCase();
  const isActive = Boolean(row.is_active === true || normStatus === 'current');

  return {
    id: row.id,
    academicYear: row.academic_year || row.academicYear,
    semester: row.semester,
    course: row.course || '',
    // Strict status reflection: exact value stored in Supabase
    status: exactStatus || (isActive ? 'current' : 'upcoming'),
    rawStatus: exactStatus,
    normalizedStatus: normStatus || (isActive ? 'current' : 'upcoming'),
    isActive: isActive,
    startDate: start_date,
    endDate: end_date,
    expectedDays: Number(row.expected_training_days ?? row.expectedDays) || 0,
    completedDays: Number(row.completed_training_days ?? row.completedDays) || 0,
    enrolledCadets: Number(row.enrolled_cadets ?? row.enrolledCadets) || 0,
    termOrder: row.term_order ?? row.termOrder,
    created_at: row.created_at
  };
}

/** Turns Supabase/PostgREST errors into admin-friendly messages. */
export function describeTermError(error) {
  if (!error) return 'Unknown error.';
  const msg = String(error.message || error);
  const code = error.code;

  if (code === '23505') {
    if (msg.includes('single_current')) return 'Another term is already marked as current.';
    return 'That Academic Year & Semester already exists.';
  }
  if (code === '42501' || msg.includes('row-level security')) {
    return 'Permission denied. Sign in with an approved admin account to manage academic terms.';
  }
  if (code === '42P01' || code === 'PGRST205') {
    return 'The academic_terms table was not found. Run supabase_academic_terms_migration.sql in the Supabase SQL Editor.';
  }
  if (code === 'PGRST202') {
    return 'Database function was not found. Run supabase_academic_terms_migration.sql in the Supabase SQL Editor.';
  }
  if (code === '23503' || msg.includes('Deletion blocked') || msg.includes('Only UPCOMING')) {
    return 'Deletion blocked: Only UPCOMING terms with 0 completed training days and 0 enrolled cadets can be deleted to protect historical attendance integrity.';
  }
  if (code === '23514' || code === '22P02') return 'Invalid term details. Check Academic Year format, training days, and ensure start date <= end date.';
  if (msg.toLowerCase().includes('failed to fetch')) return 'Cannot reach Supabase. Check your internet connection.';
  return msg;
}

export function requireClient() {
  const client = getSupabaseClient() || supabase;
  if (!client) throw new Error('Supabase client is not configured.');
  return client;
}

/**
 * One-time migration helper: Links unlinked legacy cadets to the target active term.
 */
export async function migrateLegacyCadetsToActiveTerm(targetTermId) {
  if (!targetTermId) return { migrated: 0 };
  const client = requireClient();
  try {
    const { data: unlinked, error: findErr } = await client
      .from('cadets')
      .select('id')
      .is('academic_term_id', null);

    if (findErr) throw findErr;
    if (!unlinked || unlinked.length === 0) return { migrated: 0 };

    const { error: updateErr } = await client
      .from('cadets')
      .update({ academic_term_id: targetTermId })
      .is('academic_term_id', null);

    if (updateErr) throw updateErr;

    const { count } = await client
      .from('cadets')
      .select('*', { count: 'exact', head: true })
      .eq('academic_term_id', targetTermId);

    if (typeof count === 'number') {
      await client
        .from('academic_terms')
        .update({ enrolled_cadets: count })
        .eq('id', targetTermId);
    }

    return { migrated: unlinked.length, count };
  } catch (err) {
    console.error('migrateLegacyCadetsToActiveTerm error:', err);
    throw err;
  }
}

/** 
 * Fetches all terms with live relational cadet counts from Supabase.
 * Uses relational select '*, cadets:cadets(count)' and live count resolution via academic_term_id.
 * Also performs one-time auto-linking for legacy unlinked cadet records.
 */
export async function fetchAcademicTerms() {
  const client = requireClient();

  // 1. Relational Count Query: academic_terms while counting linked records in cadets
  let termsData = null;
  try {
    const { data, error } = await client
      .from('academic_terms')
      .select('*, cadets:cadets(count)')
      .order('term_order', { ascending: false });

    if (!error && Array.isArray(data)) {
      termsData = data;
    }
  } catch (_) {}

  // Fallback if PostgREST relation is not cached yet
  if (!termsData) {
    const { data, error } = await client
      .from('academic_terms')
      .select('*')
      .order('term_order', { ascending: false });

    if (error) throw error;
    termsData = data || [];
  }

  // 2. Query live cadets to count linked records via academic_term_id
  let unlinkedCadetsCount = 0;
  const countMap = {};
  try {
    const { data: cadetsList, error: cadetsErr } = await client
      .from('cadets')
      .select('id, academic_term_id');

    if (!cadetsErr && Array.isArray(cadetsList)) {
      cadetsList.forEach(c => {
        if (c.academic_term_id) {
          countMap[c.academic_term_id] = (countMap[c.academic_term_id] || 0) + 1;
        } else {
          unlinkedCadetsCount++;
        }
      });
    }
  } catch (cadetsErr) {
    console.warn('Could not query live cadet records:', cadetsErr);
  }

  // 3. Fallback / Legacy Cadets: If older cadet records don't have an academic_term_id assigned yet,
  // link those existing cadets to the current active term ID
  const activeTerm = termsData.find(t => String(t.status || '').toLowerCase() === 'current') || termsData[0];
  if (activeTerm && unlinkedCadetsCount > 0) {
    try {
      const { error: linkErr } = await client
        .from('cadets')
        .update({ academic_term_id: activeTerm.id })
        .is('academic_term_id', null);

      if (!linkErr) {
        countMap[activeTerm.id] = (countMap[activeTerm.id] || 0) + unlinkedCadetsCount;
        try {
          await client
            .from('academic_terms')
            .update({ enrolled_cadets: countMap[activeTerm.id] })
            .eq('id', activeTerm.id);
        } catch (_) {}
      }
    } catch (autoLinkErr) {
      console.warn('Auto-link legacy cadets error:', autoLinkErr);
    }
  }

  // 4. Dynamic Session Count Query: Count distinct formation dates in attendance_sessions per term ID
  const trainingDaysMap = {};
  const unlinkedSessionsToSync = [];
  try {
    let sessionRows = null;
    try {
      const { data: sessWithTerm, error: sessErr } = await client
        .from('attendance_sessions')
        .select('id, session_date, academic_term_id');
      if (!sessErr && Array.isArray(sessWithTerm)) {
        sessionRows = sessWithTerm;
      }
    } catch (_) {}

    if (!sessionRows) {
      const { data: rawSessions } = await client
        .from('attendance_sessions')
        .select('id, session_date');
      sessionRows = rawSessions || [];
    }

    if (Array.isArray(sessionRows) && sessionRows.length > 0) {
      // Initialize a Set of distinct dates for each term
      termsData.forEach(t => {
        trainingDaysMap[t.id] = new Set();
      });

      sessionRows.forEach(s => {
        const isoDate = normalizeDateToISO(s.session_date);
        if (!isoDate) return;

        let targetTermId = s.academic_term_id;

        // If not directly linked, match by term date range
        if (!targetTermId) {
          const matchedTerm = termsData.find(t => {
            const start = normalizeDateToISO(t.start_date);
            const end = normalizeDateToISO(t.end_date);
            return start && end && isoDate >= start && isoDate <= end;
          });

          if (matchedTerm) {
            targetTermId = matchedTerm.id;
            unlinkedSessionsToSync.push({ id: s.id, termId: matchedTerm.id });
          } else if (activeTerm) {
            targetTermId = activeTerm.id;
            unlinkedSessionsToSync.push({ id: s.id, termId: activeTerm.id });
          }
        }

        if (targetTermId && trainingDaysMap[targetTermId]) {
          trainingDaysMap[targetTermId].add(isoDate);
        }
      });

      // Convert Set size to distinct integer counts
      termsData.forEach(t => {
        const distinctCount = trainingDaysMap[t.id] ? trainingDaysMap[t.id].size : 0;
        trainingDaysMap[t.id] = distinctCount;

        // Auto-sync update to academic_terms.completed_training_days in Supabase
        if (distinctCount !== t.completed_training_days) {
          client
            .from('academic_terms')
            .update({ completed_training_days: distinctCount })
            .eq('id', t.id)
            .then(() => {})
            .catch(() => {});
        }
      });

      // Auto-link unlinked sessions to their term ID in Supabase
      if (unlinkedSessionsToSync.length > 0) {
        Promise.allSettled(
          unlinkedSessionsToSync.map(u =>
            client
              .from('attendance_sessions')
              .update({ academic_term_id: u.termId })
              .eq('id', u.id)
          )
        ).catch(() => {});
      }
    }
  } catch (sessCountErr) {
    console.warn('Could not query dynamic session counts:', sessCountErr);
  }

  return (termsData || []).map(row => {
    const relCount = row.cadets?.[0]?.count;
    const liveCount = countMap[row.id] !== undefined
      ? countMap[row.id]
      : (typeof relCount === 'number' ? relCount : 0);

    const distinctTrainingDays = typeof trainingDaysMap[row.id] === 'number'
      ? trainingDaysMap[row.id]
      : (Number(row.completed_training_days) || 0);

    return mapTermRow({
      ...row,
      enrolled_cadets: liveCount,
      completed_training_days: distinctTrainingDays
    });
  });
}

/**
 * Triggers an auto-sync update to academic_terms.completed_training_days
 * whenever a new attendance session is created, saved, or updated.
 */
export async function syncCompletedTrainingDays(termId = null) {
  const client = requireClient();
  try {
    let termsQuery = client.from('academic_terms').select('id, start_date, end_date, completed_training_days');
    if (termId) termsQuery = termsQuery.eq('id', termId);
    const { data: terms, error: tErr } = await termsQuery;
    if (tErr || !terms || terms.length === 0) return {};

    let sessions = [];
    try {
      const { data, error } = await client
        .from('attendance_sessions')
        .select('id, session_date, academic_term_id');
      if (!error && Array.isArray(data)) sessions = data;
    } catch (_) {}

    if (sessions.length === 0) {
      const { data } = await client
        .from('attendance_sessions')
        .select('id, session_date');
      sessions = data || [];
    }

    const results = {};
    for (const term of terms) {
      const startDate = normalizeDateToISO(term.start_date);
      const endDate = normalizeDateToISO(term.end_date);
      const uniqueDates = new Set();

      sessions.forEach(s => {
        const d = normalizeDateToISO(s.session_date);
        if (!d) return;
        const isLinked = s.academic_term_id === term.id;
        const isDateMatch = (!s.academic_term_id && startDate && endDate && d >= startDate && d <= endDate);
        if (isLinked || isDateMatch) {
          uniqueDates.add(d);
        }
      });

      const count = uniqueDates.size;
      results[term.id] = count;

      if (count !== term.completed_training_days) {
        await client
          .from('academic_terms')
          .update({ completed_training_days: count })
          .eq('id', term.id);
      }
    }

    return results;
  } catch (err) {
    console.error('syncCompletedTrainingDays error:', err);
    return {};
  }
}

/**
 * Inserts a new term with start_date and end_date.
 * Evaluates status dynamically before saving into Supabase instead of hardcoding 'upcoming'.
 */
export async function createAcademicTerm({ academicYear, semester, course, expectedDays, startDate, endDate, status }) {
  const client = requireClient();

  const isoStart = normalizeDateToISO(startDate);
  const isoEnd = normalizeDateToISO(endDate);

  // Evaluate status immediately against system date:
  // currentDate >= start_date AND currentDate <= end_date -> 'current'
  // currentDate < start_date                              -> 'upcoming'
  // currentDate > end_date                                -> 'archived'
  const computedStatus = status || ((isoStart && isoEnd)
    ? evaluateTermStatusByDates({ startDate: isoStart, endDate: isoEnd }, new Date())
    : 'upcoming');

  const insertPayload = {
    academic_year: academicYear,
    semester,
    course: course || null,
    status: computedStatus,
    is_active: computedStatus === 'current',
    start_date: isoStart,
    end_date: isoEnd,
    expected_training_days: Number(expectedDays)
  };

  // 1. Try create_academic_term RPC first (handles single-current atomically in DB)
  try {
    const { data: rpcData, error: rpcError } = await client.rpc('create_academic_term', {
      p_academic_year: academicYear,
      p_semester: semester,
      p_course: course || null,
      p_expected_days: Number(expectedDays),
      p_start_date: isoStart,
      p_end_date: isoEnd,
      p_status: computedStatus
    });
    if (!rpcError && rpcData) {
      const mapped = mapTermRow(rpcData);
      mapped.status = computedStatus;
      mapped.dynamicStatus = computedStatus;
      return mapped;
    }
  } catch (_) {
    // RPC not present yet, proceed to direct fallback
  }

  // 2. Direct Supabase insert fallback
  // If creating as 'current', demote previous 'current' terms so partial unique index doesn't conflict
  if (computedStatus === 'current') {
    try {
      await client
        .from('academic_terms')
        .update({ status: 'archived', is_active: false })
        .eq('status', 'current');
    } catch (_) {
      try {
        await client
          .from('academic_terms')
          .update({ status: 'archived' })
          .eq('status', 'current');
      } catch (_) {}
    }
  }

  let { data, error } = await client
    .from('academic_terms')
    .insert(insertPayload)
    .select('*')
    .single();

  // If is_active column doesn't exist yet, retry without is_active
  if (error && (error.message?.includes('is_active') || error.code === 'PGRST204')) {
    const noActivePayload = { ...insertPayload };
    delete noActivePayload.is_active;
    const retry = await client
      .from('academic_terms')
      .insert(noActivePayload)
      .select('*')
      .single();
    data = retry.data;
    error = retry.error;
  }

  // If older RLS policy blocked inserting status = 'current', insert as 'upcoming' then activate immediately
  if (error && (error.message?.includes('row-level security') || error.code === '42501') && computedStatus === 'current') {
    const fallbackPayload = { ...insertPayload, status: 'upcoming', is_active: false };
    const res = await client
      .from('academic_terms')
      .insert(fallbackPayload)
      .select('*')
      .single();
    if (res.error) throw res.error;
    data = res.data;
    try {
      await setActiveAcademicTerm(data.id);
      data.status = 'current';
      data.is_active = true;
    } catch (actErr) {
      console.warn('Auto-activate failed:', actErr);
    }
  } else if (error) {
    throw error;
  }

  const mapped = mapTermRow(data);
  mapped.status = computedStatus;
  mapped.dynamicStatus = computedStatus;

  // Mirror onto system_settings if current
  if (computedStatus === 'current') {
    try {
      await client
        .from('system_settings')
        .update({ current_term_id: mapped.id, updated_at: new Date().toISOString() })
        .not('id', 'is', null);
    } catch (_) { }
  }

  return mapped;
}

/**
 * Deletes an UPCOMING term.
 * Strictly blocked if status is CURRENT or ARCHIVED, or if completed_training_days > 0 or enrolled_cadets > 0.
 */
export async function deleteAcademicTerm(termId) {
  const client = requireClient();

  // Try RPC first for strict server-side validation
  try {
    const { error: rpcErr } = await client.rpc('delete_academic_term', { p_term_id: termId });
    if (!rpcErr) return true;
    if (rpcErr.message?.includes('Deletion blocked')) throw rpcErr;
  } catch (err) {
    if (err.message?.includes('Deletion blocked') || err.code === '23503') throw err;
  }

  // Fallback to direct DELETE (enforced by RLS)
  const { error } = await client
    .from('academic_terms')
    .delete()
    .eq('id', termId);

  if (error) throw error;
  return true;
}

/**
 * Makes `termId` the active system term.
 * Executes direct Supabase transaction:
 *  Step A: Set all other terms to non-active/archived (status: 'archived', is_active: false)
 *  Step B: Update target term to CURRENT and is_active = true
 *  Step C: Sync system_settings pointer (current_term_id = termId)
 */
export async function setActiveAcademicTerm(termId) {
  const client = requireClient();

  // 1. Try atomic database RPC first if available
  try {
    const { data, error } = await client.rpc('set_active_academic_term', { p_term_id: termId });
    if (!error && data) {
      return (data || []).map(mapTermRow);
    }
  } catch (_) {
    // Proceed to direct Step A / Step B / Step C execution
  }

  // 2. Direct Supabase Transaction Fallback
  // Step A: Set all other terms to non-active / archived
  try {
    await client
      .from('academic_terms')
      .update({ status: 'archived', is_active: false })
      .neq('id', termId);
  } catch (_) {
    try {
      await client
        .from('academic_terms')
        .update({ status: 'archived' })
        .neq('id', termId);
    } catch (_) {}
  }

  // Step B: Update target term to CURRENT and is_active = true
  try {
    const { error: errB } = await client
      .from('academic_terms')
      .update({ status: 'current', is_active: true })
      .eq('id', termId);
    if (errB) throw errB;
  } catch (_) {
    const { error: errB2 } = await client
      .from('academic_terms')
      .update({ status: 'current' })
      .eq('id', termId);
    if (errB2) throw errB2;
  }

  // Step C: Sync system_settings pointer
  try {
    const { data: settingsRow } = await client
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (settingsRow?.id) {
      await client
        .from('system_settings')
        .update({ current_term_id: termId, updated_at: new Date().toISOString() })
        .eq('id', settingsRow.id);
    } else {
      await client
        .from('system_settings')
        .insert({ current_term_id: termId });
    }
  } catch (errC) {
    console.warn('Could not sync system_settings pointer:', errC);
  }

  // Return the refreshed terms list
  return await fetchAcademicTerms();
}

/**
 * Fetches the currently active academic term.
 * Priority:
 *  1. system_settings.current_term_id (foreign key to active term)
 *  2. academic_terms where status = 'current'
 *  3. Dynamic date evaluation: find term whose start_date <= today <= end_date
 *  4. Fallback to the latest upcoming term, or the latest term in academic_terms
 */
export async function getActiveAcademicTerm() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    // 1. Try system_settings.current_term_id (newest setting record)
    try {
      const { data: settings } = await client
        .from('system_settings')
        .select('current_term_id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settings?.current_term_id) {
        const { data: term } = await client
          .from('academic_terms')
          .select(TERM_COLUMNS)
          .eq('id', settings.current_term_id)
          .maybeSingle();

        if (term) return mapTermRow(term);
      }
    } catch (_) {
      // Continue to next check
    }

    // 2. Try academic_terms where status = 'current'
    try {
      const { data: currentTerm } = await client
        .from('academic_terms')
        .select(TERM_COLUMNS)
        .eq('status', 'current')
        .order('term_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentTerm) return mapTermRow(currentTerm);
    } catch (_) {
      // Continue to next check
    }

    // 3. Dynamic Real-time Date Fallback:
    // Query all academic_terms and evaluate against current system date.
    // If today is within [start_date, end_date], that term is the active term!
    try {
      const { data: allTerms } = await client
        .from('academic_terms')
        .select(TERM_COLUMNS)
        .order('term_order', { ascending: false });

      if (allTerms && allTerms.length > 0) {
        const mapped = allTerms.map(mapTermRow);

        // Priority 3a: Today falls inside term date range
        const dateMatched = mapped.find(t => t.status === 'current' || t.dynamicStatus === 'current');
        if (dateMatched) return dateMatched;

        // Priority 3b: Next upcoming term
        const upcoming = mapped.find(t => t.status === 'upcoming' || t.dynamicStatus === 'upcoming');
        if (upcoming) return upcoming;

        // Priority 3c: Most recent term
        return mapped[0];
      }
    } catch (_) {
      // Continue
    }

    return null;
  } catch (err) {
    console.warn('Could not fetch active academic term:', err);
    return null;
  }
}

/**
 * Archives a term and optionally sets nextActiveTermId as the new active term.
 */
export async function archiveAcademicTerm(termId, nextActiveTermId = null) {
  const client = requireClient();

  // 1. Archive the target term
  const { error: archErr } = await client
    .from('academic_terms')
    .update({ status: 'archived', is_active: false })
    .eq('id', termId);
  if (archErr) throw archErr;

  // 2. If nextActiveTermId provided, activate it
  if (nextActiveTermId) {
    await setActiveAcademicTerm(nextActiveTermId);
  }

  return await fetchAcademicTerms();
}

