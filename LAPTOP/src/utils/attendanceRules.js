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
  '2026-08-28'
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
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  let d = new Date(dateInput);
  if (isNaN(d.getTime()) && typeof dateInput === 'string') {
    d = new Date(`${dateInput} ${new Date().getFullYear()}`);
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

  const sortedDates = Array.from(new Set(formationDates)).sort();

  let unexcusedAbsences = 0;
  let consecutiveAbsences = 0;
  let maxConsecutiveAbsences = 0;
  let consecutiveLates = 0;
  let totalIntervalLates = 0;
  let totalIntervalMissingScans = 0; // Tracks No Time-In or No Time-Out occurrences
  const dailyBreakdown = [];

  sortedDates.forEach((formationDate) => {
    const log = cadetLogsByDate[formationDate];

    if (log) {
      const st = (log.status || log.finalStatus || '').toUpperCase();
      const hasMissingScan =
        st.includes('NO TIME-IN') ||
        st.includes('NO TIME-OUT') ||
        st.includes('INCOMPLETE') ||
        (log.hasTimeIn && !log.hasTimeOut) ||
        (!log.hasTimeIn && log.hasTimeOut) ||
        (log.timeIn && !log.timeOut) ||
        (!log.timeIn && log.timeOut);

      let penaltyLabel = 'Present & Verified';
      let dayType = 'PRESENT';

      if (hasMissingScan) {
        totalIntervalMissingScans += 1;
        penaltyLabel = `Missing Scan (+1/4 Interval Penalty)`;
        dayType = st.includes('NO TIME-IN') ? 'NO TIME-IN' : 'NO TIME-OUT';
      }

      if (st === 'ABSENT') {
        unexcusedAbsences += 1;
        consecutiveAbsences += 1;
        maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, consecutiveAbsences);
        consecutiveLates = 0;
        penaltyLabel = `Official Absent (+1 Absent, Streak: ${consecutiveAbsences})`;
        dayType = 'ABSENT';
      } else if (st === 'LATE') {
        consecutiveAbsences = 0;
        consecutiveLates += 1;
        totalIntervalLates += 1;
        dayType = 'LATE';

        // Rule: 3 consecutive lates = 1 absent
        if (consecutiveLates === 3) {
          unexcusedAbsences += 1;
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
      } else {
        if (!hasMissingScan) {
          consecutiveAbsences = 0;
          consecutiveLates = 0;
          penaltyLabel = `Present & Verified`;
          dayType = 'PRESENT';
        }
      }

      dailyBreakdown.push({
        date: formationDate,
        dayType,
        status: st || dayType,
        timeIn: log.timeIn || log.time_in || (log.scanMode === 'Time-In' ? log.timestamp : null),
        timeOut: log.timeOut || log.time_out || (log.scanMode === 'Time-Out' ? log.timestamp : null),
        timestamp: log.timestamp,
        penaltyLabel,
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

  // Rule: 4 interval lates = 1 absent
  const lateConversions = Math.floor(totalIntervalLates / 4);

  // Rule: 4 interval No Time-In / No Time-Out = 1 absent
  const missingScanConversions = Math.floor(totalIntervalMissingScans / 4);

  const totalAbsences = unexcusedAbsences + lateConversions + missingScanConversions;

  // Status classification
  let status = 'GOOD';
  let reason = 'Good Standing';

  if (maxConsecutiveAbsences >= 3) {
    status = 'DROPPED';
    reason = 'Dropped (3 Consecutive Absences)';
  } else if (totalAbsences > 3) {
    status = 'DROPPED';
    reason = 'Dropped (Exceeded 3 Interval Absences)';
  } else if (totalAbsences === 3) {
    status = 'WARNING';
    reason = 'Warning (3 Interval Absences)';
  } else if (totalAbsences === 2) {
    status = 'WARNING';
    reason = 'Warning (2 Absences)';
  }

  return {
    ...cadet,
    unexcusedAbsences,
    totalAbsences,
    maxConsecutiveAbsences,
    totalIntervalLates,
    totalIntervalMissingScans,
    lateConversions,
    missingScanConversions,
    dailyBreakdown,
    status,
    reason
  };
}
