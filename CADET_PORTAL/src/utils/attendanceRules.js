/**
 * ROTC Attendance Performance & Drop Evaluation Engine
 * Enforces official ROTC training manual regulations:
 * 1. 3 Consecutive Absences = Official Drop (Discharge)
 * 2. > 3 Interval Absences = Official Drop (Discharge)
 * 3. 3 Interval Absences = Warning Threshold
 * 4. 2 Absences = Warning Threshold
 * 5. 3 Consecutive Lates = Converted to 1 Absent
 * 6. 4 Interval Lates = Converted to 1 Absent
 * 7. 4 Interval No Time-In / Time-Out = Converted to 1 Absent
 */

export const ACTIVE_FORMATION_DATES = [
  '2026-08-22',
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-31',
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
  '2026-09-04'
];

export const ATTENDANCE_POLICY_RULES = [
  { id: 1, type: 'DROP', title: '3 Consecutive Absences', description: 'Official Drop (Discharge)' },
  { id: 2, type: 'DROP', title: '> 3 Interval Absences', description: 'Official Drop (Discharge)' },
  { id: 3, type: 'WARNING', title: '3 Interval Absences', description: 'Warning for Drop' },
  { id: 4, type: 'WARNING', title: '2 Absences', description: 'Warning for Drop' },
  { id: 5, type: 'CONVERSION', title: '3 Consecutive Lates', description: 'Converted to 1 Absent' },
  { id: 6, type: 'CONVERSION', title: '4 Interval Lates', description: 'Converted to 1 Absent' },
  { id: 7, type: 'CONVERSION', title: '4 Interval No Time-In / Time-Out', description: 'Converted to 1 Absent' },
  { id: 8, type: 'CONVERSION', title: '3 Consecutive Excuses', description: 'Converted to 1 Equivalent Absent' },
  { id: 9, type: 'CONVERSION', title: '4 Interval Excuses', description: 'Converted to 1 Equivalent Absent' }
];

export function toDateKey(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  let d = new Date(str);
  if (isNaN(d.getTime()) && typeof dateInput === 'string') {
    d = new Date(`${str} ${new Date().getFullYear()}`);
  }
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format YYYY-MM-DD into a clean, human-readable date (e.g. "Aug 16, 2026")
 */
export function formatHumanDate(dateKey) {
  if (!dateKey) return '';
  try {
    const parts = String(dateKey).trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return String(dateKey);
  } catch (_) {
    return String(dateKey);
  }
}

/**
 * Evaluates an individual cadet's attendance logs across the active formation schedule.
 */
export function evaluateCadetAttendance(cadet = {}, formationDates) {
  const safeCadet = cadet || {};
  const datesToUse = formationDates !== undefined ? formationDates : ACTIVE_FORMATION_DATES;
  const cadetLogsByDate = {};

  // Also collect any excuse records if present in cadet.excuse_requests or cadet.excuseRequests
  const rawExcuses = safeCadet.excuse_requests || safeCadet.excuseRequests || safeCadet.excuses || [];
  if (Array.isArray(rawExcuses)) {
    rawExcuses.forEach(ex => {
      const dk = toDateKey(ex.drill_date || ex.date || ex.formation_date || ex.session_date);
      if (dk) {
        const exSt = String(ex.status || '').toUpperCase();
        const isExRejected = exSt === 'REJECTED' || exSt === 'DECLINED' || exSt === 'DECLARED_ABSENT' || exSt === 'DECLARED ABSENT' || exSt === 'ABSENT' || exSt === 'EXCUSE_REJECTED';
        const normalizedExStatus = (exSt === 'APPROVED' || exSt === 'EXCUSED')
          ? 'EXCUSED'
          : (isExRejected || exSt === 'ABSENT')
            ? 'ABSENT'
            : 'EXCUSE_PENDING';
        cadetLogsByDate[dk] = {
          date: dk,
          status: normalizedExStatus,
          final_daily_status: normalizedExStatus,
          excuse_status: exSt,
          excuseStatus: exSt,
          excuse_reason: ex.reason || ex.excuse_reason || (isExRejected ? 'Excuse Rejected / Declared Absent by Admin' : 'Absence excuse submitted'),
          excuse_submitted_at: ex.submitted_at || ex.created_at,
          is_excuse: normalizedExStatus !== 'ABSENT'
        };
      }
    });
  }

  (safeCadet.attendance_logs || []).forEach((log) => {
    const dk = toDateKey(log.date || log.session_date || log.timestamp);
    if (dk) {
      const existing = cadetLogsByDate[dk];
      const logStatus = String(log.final_daily_status || log.status || '').toUpperCase();
      const isExcuse = logStatus === 'EXCUSE_PENDING' || logStatus === 'PENDING' || logStatus === 'EXCUSED' || logStatus === 'APPROVED' || logStatus.includes('EXCUSED');

      if (!existing) {
        cadetLogsByDate[dk] = log;
      } else {
        const existingStatus = String(existing.final_daily_status || existing.status || '').toUpperCase();
        const existingIsExcuse = existingStatus === 'EXCUSE_PENDING' || existingStatus === 'PENDING' || existingStatus === 'EXCUSED' || existingStatus === 'APPROVED' || existingStatus.includes('EXCUSED');

        if (isExcuse && !existingIsExcuse) {
          // Excuse record takes precedence over default/unexcused log
          cadetLogsByDate[dk] = { ...existing, ...log, status: logStatus, final_daily_status: logStatus, is_excuse: true };
        } else if (!isExcuse && existingIsExcuse) {
          if (logStatus === 'ABSENT') {
            cadetLogsByDate[dk] = { ...existing, ...log, status: 'ABSENT', final_daily_status: 'ABSENT', is_excuse: false };
          } else {
            cadetLogsByDate[dk] = { ...log, ...existing, status: existingStatus, final_daily_status: existingStatus, is_excuse: true };
          }
        } else {
          // If either logStatus or existingStatus is EXCUSED/APPROVED, resolve to EXCUSED
          const isEitherApproved = logStatus === 'EXCUSED' || logStatus === 'APPROVED' || existingStatus === 'EXCUSED' || existingStatus === 'APPROVED';
          const isEitherAbsent = logStatus === 'ABSENT' || existingStatus === 'ABSENT';
          const resolvedStatus = isEitherApproved ? 'EXCUSED' : isEitherAbsent ? 'ABSENT' : (logStatus || existingStatus);
          cadetLogsByDate[dk] = { ...existing, ...log, status: resolvedStatus, final_daily_status: resolvedStatus, is_excuse: Boolean(isExcuse || existingIsExcuse) && resolvedStatus !== 'ABSENT' };
        }
      }
    }
  });

  const logDates = Object.keys(cadetLogsByDate);
  const allDates = [...(datesToUse || []), ...logDates];
  const sortedDates = Array.from(new Set(allDates)).filter(Boolean).sort();

  let unexcusedAbsences = 0;
  let consecutiveAbsences = 0;
  let maxConsecutiveAbsences = 0;
  let consecutiveLates = 0;
  let maxConsecutiveLates = 0;
  let consecutiveLateConversions = 0;
  let totalIntervalLates = 0;
  let totalIntervalMissingScans = 0; // Tracks No Time-In or No Time-Out occurrences

  // Rule 8 & 9: Excuse Accumulation Tracking
  let consecutiveExcuses = 0;
  let maxConsecutiveExcuses = 0;
  let consecutiveExcuseConversions = 0;
  let totalIntervalExcuses = 0;
  const dailyBreakdown = [];

  sortedDates.forEach((formationDate) => {
    const log = cadetLogsByDate[formationDate];

    if (log) {
      const st = (log.final_daily_status || log.finalDailyStatus || log.status || log.finalStatus || '').toUpperCase();

      // CHECK EXCUSE STATUS FIRST
      const isExcusePending = st === 'EXCUSE_PENDING' || st === 'PENDING';
      const isExcused = st === 'EXCUSED' || st === 'APPROVED' || st.includes('EXCUSED');
      const isExcuse = isExcusePending || isExcused;

      const rawTimeIn = log.time_in || log.timeIn;
      const rawTimeOut = log.time_out || log.timeOut;

      const isNullTimeOut = !rawTimeOut || String(rawTimeOut).trim() === '' || String(rawTimeOut).toUpperCase() === 'NO TIME-OUT' || String(rawTimeOut).toUpperCase() === 'NULL';
      const isNullTimeIn = !rawTimeIn || String(rawTimeIn).trim() === '' || String(rawTimeIn).toUpperCase() === 'NO TIME-IN' || String(rawTimeIn).toUpperCase() === 'NULL';

      // An actual QR scan only occurred if an explicit scan flag is set, not an excuse submission
      const hasActualScan = Boolean(
        log.is_qr_scan ||
        log.isQrScan ||
        log.scanned_by ||
        log.scannedBy ||
        (log.scan_mode && log.scan_mode !== 'Excuse' && log.scan_mode !== 'Manual' && log.scan_mode !== 'Time-In' && log.scan_mode !== 'Time-Out')
      );

      // If status is EXCUSE_PENDING or EXCUSED, TIME-IN and TIME-OUT must render null/dash unless an actual QR scan occurred:
      const cleanTimeIn = (!isExcuse || hasActualScan)
        ? (isNullTimeIn ? null : rawTimeIn)
        : null;

      const cleanTimeOut = (!isExcuse || hasActualScan)
        ? (isNullTimeOut ? null : rawTimeOut)
        : null;

      const hasTimeIn = Boolean(cleanTimeIn);
      const hasTimeOut = Boolean(cleanTimeOut);

      let penaltyLabel = 'Present & Verified';
      let dayType = 'PRESENT';
      let entryStatus = 'PRESENT';

      // 1. CHECK EXCUSE STATUS FIRST before assigning Late, Missing Scans, or Absent
      if (isExcusePending) {
        consecutiveAbsences = 0;
        consecutiveLates = 0;
        consecutiveExcuses = 0;
        dayType = 'EXCUSE_PENDING';
        entryStatus = 'EXCUSE_PENDING';
        penaltyLabel = 'Online excuse submitted — Awaiting Verification';
      } else if (isExcused) {
        consecutiveAbsences = 0;
        consecutiveLates = 0;
        totalIntervalExcuses += 1;
        consecutiveExcuses += 1;
        maxConsecutiveExcuses = Math.max(maxConsecutiveExcuses, consecutiveExcuses);
        dayType = 'EXCUSED';
        entryStatus = 'EXCUSED';

        // Rule 8: 3 Consecutive Excuses = +1 Equivalent Absent
        if (consecutiveExcuses === 3) {
          consecutiveExcuseConversions += 1;
          consecutiveExcuses = 0;
          penaltyLabel = '3rd Consecutive Excuse (+1 Equivalent Absent)';
        } else {
          penaltyLabel = `Official Excuse Approved (Consecutive: ${consecutiveExcuses}/3, Total Excused: ${totalIntervalExcuses})`;
        }
      } else if (st === 'ABSENT' || (!hasTimeIn && !hasTimeOut)) {
        consecutiveExcuses = 0;
        unexcusedAbsences += 1;
        consecutiveAbsences += 1;
        maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, consecutiveAbsences);
        consecutiveLates = 0;
        const rawLogExSt = String(log.excuse_status || log.excuseStatus || '').toUpperCase();
        const isLogExRejected = rawLogExSt === 'REJECTED' || rawLogExSt === 'DECLINED' || rawLogExSt === 'DECLARED_ABSENT';
        const isRawExRejected = rawExcuses.some(e => {
          const edk = toDateKey(e.drill_date || e.date || e.formation_date || e.session_date);
          const es = String(e.status || '').toUpperCase();
          return edk === formationDate && (es === 'REJECTED' || es === 'DECLINED' || es === 'DECLARED_ABSENT');
        });
        penaltyLabel = (isLogExRejected || isRawExRejected || (log.excuse_reason && String(log.excuse_reason).includes('Rejected')))
          ? 'Excuse Rejected / Declared Absent by Admin'
          : `Official Absent (+1 Absent, Streak: ${consecutiveAbsences})`;
        dayType = 'ABSENT';
        entryStatus = 'ABSENT';
      } else if (hasTimeIn && !hasTimeOut) {
        consecutiveExcuses = 0;
        totalIntervalMissingScans += 1;
        consecutiveAbsences = 0;
        consecutiveLates = 0;
        dayType = 'NO TIME-OUT';
        const isLate = log.isLate !== undefined ? Boolean(log.isLate) : (st.includes('LATE') || Boolean(log.is_late));
        entryStatus = isLate ? 'LATE / NO TIME-OUT' : 'NO TIME-OUT';
        penaltyLabel = `Missing Time-Out Scan (+1/4 Interval Penalty)`;
      } else if (!hasTimeIn && hasTimeOut) {
        consecutiveExcuses = 0;
        totalIntervalMissingScans += 1;
        consecutiveAbsences = 0;
        consecutiveLates = 0;
        dayType = 'NO TIME-IN';
        entryStatus = 'NO TIME-IN';
        penaltyLabel = `Missing Time-In Scan (+1/4 Interval Penalty)`;
      } else if (log.isLate !== undefined ? Boolean(log.isLate) : st.includes('LATE')) {
        consecutiveExcuses = 0;
        consecutiveAbsences = 0;
        consecutiveLates += 1;
        maxConsecutiveLates = Math.max(maxConsecutiveLates, consecutiveLates);
        totalIntervalLates += 1;
        dayType = 'LATE';
        entryStatus = 'LATE (Complete)';

        // Rule 5: 3 consecutive lates = 1 absent
        if (consecutiveLates === 3) {
          consecutiveLateConversions += 1;
          consecutiveLates = 0;
          penaltyLabel = `3rd Consecutive Late (+1 Converted Absent)`;
        } else {
          penaltyLabel = `Late Scan (Consecutive: ${consecutiveLates}/3, Total Lates: ${totalIntervalLates})`;
        }
      } else {
        consecutiveExcuses = 0;
        consecutiveAbsences = 0;
        consecutiveLates = 0;
        penaltyLabel = `Present & Verified`;
        dayType = 'PRESENT';
        entryStatus = 'PRESENT (Complete)';
      }

      dailyBreakdown.push({
        date: formationDate,
        dayType,
        status: entryStatus,
        timeIn: (isExcusePending || isExcused) ? (isNullTimeIn ? null : cleanTimeIn) : cleanTimeIn,
        timeOut: (isExcusePending || isExcused) ? (isNullTimeOut ? null : cleanTimeOut) : cleanTimeOut,
        hasTimeIn: (isExcusePending || isExcused) ? !isNullTimeIn : hasTimeIn,
        hasTimeOut: (isExcusePending || isExcused) ? !isNullTimeOut : hasTimeOut,
        timestamp: (isExcusePending || isExcused) ? null : log.timestamp,
        penaltyLabel,
        cutoffTime: log.cutoff_time || log.cutoffTime || log.formation_cutoff_time || null,
        isRecorded: true,
        excuseReason: log.excuse_reason || log.excuseReason || null,
        excuse_status: log.excuse_status || log.excuseStatus || null,
        excuseStatus: log.excuse_status || log.excuseStatus || null
      });
    } else {
      // Unrecorded on an active formation date -> ABSENT
      consecutiveExcuses = 0;
      unexcusedAbsences += 1;
      consecutiveAbsences += 1;
      maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, consecutiveAbsences);
      consecutiveLates = 0;
      dailyBreakdown.push({
        date: formationDate,
        dayType: 'UNRECORDED',
        status: 'UNRECORDED / ABSENT',
        timeIn: null,
        timeOut: null,
        timestamp: null,
        penaltyLabel: `Unrecorded Formation Day (+1 Absent, Streak: ${consecutiveAbsences})`,
        isRecorded: false
      });
    }
  });

  // Rule 6: 4 interval lates = 1 absent
  const lateConversions = Math.floor(totalIntervalLates / 4);

  // Rule 7: 4 interval No Time-In / No Time-Out = 1 absent
  const missingScanConversions = Math.floor(totalIntervalMissingScans / 4);

  // Rule 9: 4 interval/cumulative excuses = 1 equivalent absent
  const intervalExcuseConversions = Math.floor(totalIntervalExcuses / 4);

  // Total excuse conversion equivalent absences
  const totalExcuseConversions = consecutiveExcuseConversions + intervalExcuseConversions;

  // Total converted absences from rules 5, 6, 7, 8, and 9
  const totalConvertedAbsences = consecutiveLateConversions + lateConversions + missingScanConversions + totalExcuseConversions;

  // Calculated Absences column incorporates converted absences
  const totalAbsences = unexcusedAbsences + totalConvertedAbsences;

  // Status, Reason, and Badge classification
  let status = 'GOOD';
  let reason = 'Good Standing';
  let badgeLabel = 'GOOD';
  let ruleId = null;

  if (maxConsecutiveAbsences >= 3) {
    status = 'DROPPED';
    reason = 'Dropped (3 Consecutive Absences)';
    badgeLabel = 'DROPPED';
    ruleId = 1;
  } else if (totalAbsences > 3) {
    status = 'DROPPED';
    reason = 'Dropped (Exceeded 3 Interval Absences)';
    badgeLabel = 'DROPPED';
    ruleId = 2;
  } else if (totalAbsences === 3 && (unexcusedAbsences === 3 || (!consecutiveLateConversions && !lateConversions && !missingScanConversions && !totalExcuseConversions))) {
    status = 'WARNING';
    reason = 'Warning (3 Interval Absences)';
    badgeLabel = 'WARNING';
    ruleId = 3;
  } else if (consecutiveExcuseConversions > 0 || maxConsecutiveExcuses >= 3) {
    status = 'PENALTY / WARNING';
    reason = 'Penalized (3 Consecutive Excuses)';
    badgeLabel = 'Penalized (3 Consecutive Excuses)';
    ruleId = 8;
  } else if (intervalExcuseConversions > 0 || totalIntervalExcuses >= 4) {
    status = 'PENALTY / WARNING';
    reason = 'Penalized (4 Interval Excuses)';
    badgeLabel = 'Penalized (4 Interval Excuses)';
    ruleId = 9;
  } else if (consecutiveLateConversions > 0 || maxConsecutiveLates >= 3) {
    status = 'PENALTY / WARNING';
    reason = 'Penalized (3 Consecutive Lates)';
    badgeLabel = 'Penalized (3 Consecutive Lates)';
    ruleId = 5;
  } else if (lateConversions > 0 || totalIntervalLates >= 4) {
    status = 'PENALTY / WARNING';
    reason = 'Penalized (4 Interval Lates)';
    badgeLabel = 'Penalized (4 Interval Lates)';
    ruleId = 6;
  } else if (missingScanConversions > 0 || totalIntervalMissingScans >= 4) {
    status = 'PENALTY / WARNING';
    reason = 'Penalized (4 Missing Scans)';
    badgeLabel = 'Penalized (4 Missing Scans)';
    ruleId = 7;
  } else if (totalAbsences === 2 || totalAbsences === 3) {
    status = 'WARNING';
    reason = totalAbsences === 3 ? 'Warning (3 Interval Absences)' : 'Warning (2 Absences)';
    badgeLabel = 'WARNING';
    ruleId = totalAbsences === 3 ? 3 : 4;
  }

  return {
    ...cadet,
    unexcusedAbsences,
    consecutiveLateConversions,
    lateConversions,
    missingScanConversions,
    consecutiveExcuses,
    maxConsecutiveExcuses,
    consecutiveExcuseConversions,
    totalIntervalExcuses,
    intervalExcuseConversions,
    totalExcuseConversions,
    hasExcusePenalty: totalExcuseConversions > 0,
    totalConvertedAbsences,
    totalAbsences,
    maxConsecutiveAbsences,
    totalIntervalLates,
    totalIntervalMissingScans,
    dailyBreakdown,
    status,
    reason,
    badgeLabel,
    ruleId
  };
}

/**
 * Sorts evaluated cadets in ascending order based on:
 * 1. Calculated Absences (0, 1, 2, 3...)
 * 2. Alert Status Tiers (Ascending: Penalty / Warning [1] -> Warning Threshold [2] -> Official Drop [3])
 * 3. Tardiness (Total Interval Lates) (0, 1, 2...)
 * 4. Missing Scans count (0, 1, 2...)
 * 5. Stable Alphabetical Tie-breaker by Cadet Name / ID
 */
export function sortCadetAlertsAscending(cadets = []) {
  if (!Array.isArray(cadets)) return [];

  const getStatusRank = (c) => {
    const s = String(c?.status || '').toUpperCase();
    if (s === 'DROPPED') return 3; // Highest alert tier (Official Drop)
    if (s === 'WARNING') return 2; // Warning Threshold
    if (s.includes('PENALTY') || s.includes('PENALIZED')) return 1; // Penalty / Warning tier
    return 0; // Good / lowest tier
  };

  return [...cadets].sort((a, b) => {
    // 1. Calculated Absences (Ascending: 0, 1, 2, 3...)
    const absencesA = Number(a.totalAbsences ?? a.unexcusedAbsences ?? 0);
    const absencesB = Number(b.totalAbsences ?? b.unexcusedAbsences ?? 0);
    if (absencesA !== absencesB) {
      return absencesA - absencesB;
    }

    // 2. Alert Status Tiers (Ascending: Warning Threshold [1] -> Official Drop [2])
    const statusDiff = getStatusRank(a) - getStatusRank(b);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    // 3. Tardiness / Total Interval Lates (Ascending: 0, 1, 2...)
    const latesA = Number(a.totalIntervalLates ?? 0);
    const latesB = Number(b.totalIntervalLates ?? 0);
    if (latesA !== latesB) {
      return latesA - latesB;
    }

    // 4. Missing Scans (No Time-In / Time-Out) (Ascending: 0, 1, 2...)
    const missingA = Number(a.totalIntervalMissingScans ?? 0);
    const missingB = Number(b.totalIntervalMissingScans ?? 0);
    if (missingA !== missingB) {
      return missingA - missingB;
    }

    // 5. Stable Tie-breaker: Alphabetical by Cadet Name / ID
    const nameA = String(a.name || a.id || '').toUpperCase();
    const nameB = String(b.name || b.id || '').toUpperCase();
    return nameA.localeCompare(nameB);
  });
}

/**
 * Centralized utility to calculate a cadet's complete attendance statistics,
 * performance metrics, excuse accumulation penalties, and drop/warning status.
 * Enforces official ROTC training regulation formulas:
 * - Rule 5: 3 Consecutive Lates = +1 Converted Absent
 * - Rule 6: 4 Interval Lates = +1 Converted Absent
 * - Rule 7: 4 Interval Missing Scans = +1 Converted Absent
 * - Rule 8: 3 Consecutive Excuses = +1 Equivalent Absent
 * - Rule 9: 4 Cumulative/Interval Excuses = +1 Equivalent Absent
 * - Adjusted Attendance Rate: ((Total Formations - Converted Absences) / Total Formations) * 100
 */
export function calculateCadetAttendanceStats(cadet, formationDates) {
  const datesToUse = formationDates !== undefined ? formationDates : ACTIVE_FORMATION_DATES;
  const evaluated = evaluateCadetAttendance(cadet, datesToUse);
  const rawAbsences = Number(evaluated.unexcusedAbsences || 0);
  const missingScans = Number(evaluated.totalIntervalMissingScans || 0);
  const intervalLates = Number(evaluated.totalIntervalLates || 0);
  const maxConsecutiveLates = Number(evaluated.maxConsecutiveLates || 0);
  const consecutiveLateConversions = Number(
    evaluated.consecutiveLateConversions !== undefined
      ? evaluated.consecutiveLateConversions
      : Math.floor(maxConsecutiveLates / 3)
  );

  const missingScanConversions = Math.floor(missingScans / 4);
  const intervalLateConversions = Math.floor(intervalLates / 4);

  // Excuse Accumulation Policy (Rules 8 & 9)
  const totalExcuses = Number(evaluated.totalIntervalExcuses || 0);
  const consecutiveExcuses = Number(evaluated.consecutiveExcuses || 0);
  const maxConsecutiveExcuses = Number(evaluated.maxConsecutiveExcuses || 0);
  const consecutiveExcuseConversions = Number(evaluated.consecutiveExcuseConversions || 0);
  const intervalExcuseConversions = Number(evaluated.intervalExcuseConversions || 0);
  const totalExcuseConversions = consecutiveExcuseConversions + intervalExcuseConversions;
  const hasExcusePenalty = totalExcuseConversions > 0;

  // Build human-readable excuse penalty breakdown reasons
  const excusePenaltyReasons = [];
  if (consecutiveExcuseConversions > 0) {
    excusePenaltyReasons.push(`${consecutiveExcuseConversions} equivalent absent from 3 consecutive excuses`);
  }
  if (intervalExcuseConversions > 0) {
    excusePenaltyReasons.push(`${intervalExcuseConversions} equivalent absent from 4 cumulative excuses`);
  }

  // Total Converted Absences: Raw Absences + Missing Scan Converted + Late Converted + Consecutive Late Converted + Excuse Converted
  const convertedAbsences = Number(
    evaluated.totalAbsences ?? (rawAbsences + missingScanConversions + intervalLateConversions + consecutiveLateConversions + totalExcuseConversions)
  );

  const totalFormations = (evaluated.dailyBreakdown && evaluated.dailyBreakdown.length > 0)
    ? evaluated.dailyBreakdown.length
    : (datesToUse && datesToUse.length > 0 ? datesToUse.length : 0);

  let adjustedAttendanceRate = 100;
  if (totalFormations > 0) {
    const rate = ((totalFormations - convertedAbsences) / totalFormations) * 100;
    adjustedAttendanceRate = Math.max(0, Math.min(100, Math.round(rate)));
  } else {
    adjustedAttendanceRate = 100;
  }

  const attendedSessions = Math.max(0, totalFormations - convertedAbsences);

  return {
    ...evaluated,
    rawAbsences,
    unexcusedAbsences: rawAbsences,
    missingScans,
    intervalLates,
    consecutiveLateConversions,
    missingScanConversions,
    intervalLateConversions,

    // Excuse accumulation metrics
    totalExcuses,
    totalIntervalExcuses: totalExcuses,
    consecutiveExcuses,
    maxConsecutiveExcuses,
    consecutiveExcuseConversions,
    intervalExcuseConversions,
    totalExcuseConversions,
    hasExcusePenalty,
    excusePenaltyBreakdown: {
      consecutivePenalties: consecutiveExcuseConversions,
      intervalPenalties: intervalExcuseConversions,
      totalEquivalentAbsences: totalExcuseConversions,
      reasons: excusePenaltyReasons
    },

    convertedAbsences,
    totalAbsences: convertedAbsences,
    totalFormations,
    attendedSessions,
    adjustedAttendanceRate,
    complianceRate: adjustedAttendanceRate
  };
}

/**
 * Shared utility to calculate a cadet's converted absences and adjusted attendance rate.
 * Maintained as an alias delegating directly to calculateCadetAttendanceStats for full backwards-compatibility.
 */
export function calculateCadetAbsences(cadet, formationDates) {
  return calculateCadetAttendanceStats(cadet, formationDates);
}
