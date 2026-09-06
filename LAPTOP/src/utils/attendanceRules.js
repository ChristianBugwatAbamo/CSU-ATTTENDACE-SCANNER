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
  { id: 7, type: 'CONVERSION', title: '4 Interval No Time-In / Time-Out', description: 'Converted to 1 Absent' }
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
 * Evaluates an individual cadet's attendance logs across the active formation schedule.
 */
export function evaluateCadetAttendance(cadet, formationDates = ACTIVE_FORMATION_DATES) {
  const cadetLogsByDate = {};
  (cadet.attendance_logs || []).forEach((log) => {
    const dk = toDateKey(log.date || log.session_date || log.timestamp);
    if (dk) {
      cadetLogsByDate[dk] = log;
    }
  });

  const logDates = Object.keys(cadetLogsByDate);
  const allDates = [...(formationDates || []), ...logDates];
  const sortedDates = Array.from(new Set(allDates)).filter(Boolean).sort();

  let unexcusedAbsences = 0;
  let consecutiveAbsences = 0;
  let maxConsecutiveAbsences = 0;
  let consecutiveLates = 0;
  let maxConsecutiveLates = 0;
  let consecutiveLateConversions = 0;
  let totalIntervalLates = 0;
  let totalIntervalMissingScans = 0; // Tracks No Time-In or No Time-Out occurrences
  const dailyBreakdown = [];

  sortedDates.forEach((formationDate) => {
    const log = cadetLogsByDate[formationDate];

    if (log) {
      const st = (log.final_daily_status || log.finalDailyStatus || log.status || log.finalStatus || '').toUpperCase();
      
      const rawTimeIn = log.time_in || log.timeIn;
      const rawTimeOut = log.time_out || log.timeOut;
      
      const isNullTimeOut = !rawTimeOut || String(rawTimeOut).trim() === '' || String(rawTimeOut).toUpperCase() === 'NO TIME-OUT' || String(rawTimeOut).toUpperCase() === 'NULL';
      const isNullTimeIn = !rawTimeIn || String(rawTimeIn).trim() === '' || String(rawTimeIn).toUpperCase() === 'NO TIME-IN' || String(rawTimeIn).toUpperCase() === 'NULL';

      const cleanTimeIn = isNullTimeIn
        ? ((!st.includes('NO TIME-IN') && !rawTimeOut && (log.scanMode === 'Time-In' || log.scan_mode === 'Time-In')) ? log.timestamp : null)
        : rawTimeIn;
      const cleanTimeOut = isNullTimeOut
        ? ((!st.includes('NO TIME-OUT') && !rawTimeIn && (log.scanMode === 'Time-Out' || log.scan_mode === 'Time-Out')) ? log.timestamp : null)
        : rawTimeOut;

      const hasTimeIn = Boolean(cleanTimeIn);
      const hasTimeOut = Boolean(cleanTimeOut);

      let penaltyLabel = 'Present & Verified';
      let dayType = 'PRESENT';
      let entryStatus = 'PRESENT';

      if (hasTimeIn && !hasTimeOut) {
        totalIntervalMissingScans += 1;
        consecutiveAbsences = 0;
        consecutiveLates = 0;
        dayType = 'NO TIME-OUT';
        const isLate = st.includes('LATE') || Boolean(log.isLate || log.is_late);
        entryStatus = isLate ? 'LATE / NO TIME-OUT' : 'NO TIME-OUT';
        penaltyLabel = `Missing Time-Out Scan (+1/4 Interval Penalty)`;
      } else if (!hasTimeIn && hasTimeOut) {
        totalIntervalMissingScans += 1;
        consecutiveAbsences = 0;
        consecutiveLates = 0;
        dayType = 'NO TIME-IN';
        entryStatus = 'NO TIME-IN';
        penaltyLabel = `Missing Time-In Scan (+1/4 Interval Penalty)`;
      } else if (st === 'ABSENT' || (!hasTimeIn && !hasTimeOut)) {
        unexcusedAbsences += 1;
        consecutiveAbsences += 1;
        maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, consecutiveAbsences);
        consecutiveLates = 0;
        penaltyLabel = `Official Absent (+1 Absent, Streak: ${consecutiveAbsences})`;
        dayType = 'ABSENT';
        entryStatus = 'ABSENT';
      } else if (st.includes('LATE')) {
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
      } else if (st === 'EXCUSED') {
        consecutiveAbsences = 0;
        consecutiveLates = 0;
        penaltyLabel = `Excused / Official Duty (No Penalty)`;
        dayType = 'EXCUSED';
        entryStatus = 'EXCUSED';
      } else {
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
        timeIn: cleanTimeIn,
        timeOut: cleanTimeOut,
        hasTimeIn,
        hasTimeOut,
        timestamp: log.timestamp,
        penaltyLabel,
        cutoffTime: log.cutoff_time || log.cutoffTime || log.formation_cutoff_time || null,
        isRecorded: true
      });
    } else {
      // Unrecorded on an active formation date -> ABSENT
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

  // Total converted absences from rules 5, 6, and 7
  const totalConvertedAbsences = consecutiveLateConversions + lateConversions + missingScanConversions;

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
  } else if (totalAbsences === 3 && (unexcusedAbsences === 3 || (!consecutiveLateConversions && !lateConversions && !missingScanConversions))) {
    status = 'WARNING';
    reason = 'Warning (3 Interval Absences)';
    badgeLabel = 'WARNING';
    ruleId = 3;
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
 * Shared utility to calculate a cadet's converted absences and adjusted attendance rate.
 * Enforces official ROTC training regulation formulas:
 * - Converted Absences: Raw Absences + ⌊Missing Scans / 4⌋ + ⌊Interval Lates / 4⌋ + ⌊Consecutive Lates / 3⌋
 * - Adjusted Attendance Rate: ((Total Formations - Converted Absences) / Total Formations) * 100
 */
export function calculateCadetAbsences(cadet, formationDates = ACTIVE_FORMATION_DATES) {
  const evaluated = evaluateCadetAttendance(cadet, formationDates);
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

  // Converted Absences: Raw Absences + ⌊Missing Scans / 4⌋ + ⌊Interval Lates / 4⌋ + ⌊Consecutive Lates / 3⌋
  const convertedAbsences = rawAbsences + missingScanConversions + intervalLateConversions + consecutiveLateConversions;

  const totalFormations = (evaluated.dailyBreakdown && evaluated.dailyBreakdown.length > 0)
    ? evaluated.dailyBreakdown.length
    : (formationDates && formationDates.length > 0 ? formationDates.length : 1);

  // Adjusted Attendance Rate: ((Total Formations - Converted Absences) / Total Formations) * 100
  let adjustedAttendanceRate = 100;
  if (totalFormations > 0) {
    const rate = ((totalFormations - convertedAbsences) / totalFormations) * 100;
    adjustedAttendanceRate = Math.max(0, Math.min(100, Math.round(rate)));
  }

  return {
    ...evaluated,
    rawAbsences,
    missingScans,
    intervalLates,
    consecutiveLateConversions,
    missingScanConversions,
    intervalLateConversions,
    convertedAbsences,
    totalAbsences: convertedAbsences,
    totalFormations,
    adjustedAttendanceRate,
    complianceRate: adjustedAttendanceRate
  };
}
