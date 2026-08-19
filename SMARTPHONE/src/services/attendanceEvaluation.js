/**
 * Attendance Evaluation & Roster Reconciliation Service for Mobile App
 */

/**
 * Universally parses any time representation (12-hour AM/PM with or without seconds,
 * 24-hour HH:MM, ISO datetime string, Date instance, or unix epoch timestamp)
 * into total minutes from midnight (0 - 1439).
 */
export function parseTimeToMinutes(input) {
  if (input === null || input === undefined || input === '') return NaN;

  // 1. If Date object
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return NaN;
    return input.getHours() * 60 + input.getMinutes();
  }

  // 2. If numerical timestamp (ms or epoch seconds)
  if (typeof input === 'number') {
    if (isNaN(input)) return NaN;
    const d = new Date(input > 1e11 ? input : input * 1000);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  const str = String(input).trim();
  if (!str) return NaN;

  // 3. Check for explicit 12-hour time format with AM/PM (e.g. "08:25 PM", "09:01:00 PM", "8/19/2026, 8:25:00 PM", "2026-08-19 08:25:00 PM")
  const ampmMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[4].toUpperCase();
    if (meridiem === 'PM' && h < 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  // 4. Check for pure 24-hour time format (e.g. "21:01", "07:30", "20:25:00", "08:25")
  const timeOnlyMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch) {
    const h = parseInt(timeOnlyMatch[1], 10);
    const m = parseInt(timeOnlyMatch[2], 10);
    return h * 60 + m;
  }

  // 5. Try parsing as full standard Date / ISO string (e.g. "2026-08-19T20:25:00.000Z", "2026-08-19 20:25:00")
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.getHours() * 60 + d.getMinutes();
  }

  // 6. Fallback regex to capture any embedded HH:MM
  const fallbackMatch = str.match(/(\d{1,2}):(\d{2})/);
  if (fallbackMatch) {
    const h = parseInt(fallbackMatch[1], 10);
    const m = parseInt(fallbackMatch[2], 10);
    return h * 60 + m;
  }

  return NaN;
}

export function parseTimestampMinutes(timestamp) {
  return parseTimeToMinutes(timestamp);
}

export function parseCutoffMinutes(cutoffTimeStr = '07:30') {
  const mins = parseTimeToMinutes(cutoffTimeStr);
  return isNaN(mins) ? 450 : mins; // Default to 450 mins (07:30 AM)
}

/**
 * Evaluates the status of an individual scan record:
 * - Time-In: PRESENT if <= cutoff, LATE if > cutoff.
 * - Time-Out: PRESENT (No cutoff applies to Time-Out).
 */
export function evaluateSingleScan(scan, cutoffTimeStr = '07:30') {
  if (!scan) return 'PRESENT';

  const mode = scan.scanMode || (String(scan.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');
  if (mode === 'Time-Out') {
    return 'PRESENT';
  }

  const scanMins = parseTimestampMinutes(scan.timestamp);
  if (isNaN(scanMins)) {
    return 'PRESENT';
  }

  const cutoffMins = parseCutoffMinutes(cutoffTimeStr);
  return scanMins > cutoffMins ? 'LATE' : 'PRESENT';
}

/**
 * Reconciles a single cadet's daily attendance from their Time-In and Time-Out scans
 * according to the Summary Status Matrix:
 */
export function reconcileCadetDailyStatus(cadet, timeInScan, timeOutScan, cutoffTimeStr = '07:30') {
  const timeInRaw = typeof timeInScan === 'string' ? timeInScan : (timeInScan?.timestamp || timeInScan?.timeIn || timeInScan?.timeInTime || null);
  const timeOutRaw = typeof timeOutScan === 'string' ? timeOutScan : (timeOutScan?.timestamp || timeOutScan?.timeOut || timeOutScan?.timeOutTime || null);

  const hasTimeIn = Boolean(timeInRaw && String(timeInRaw).trim());
  const hasTimeOut = Boolean(timeOutRaw && String(timeOutRaw).trim());

  let timeInStatus = 'ABSENT';
  let isLate = false;

  if (hasTimeIn) {
    const timeInMins = parseTimestampMinutes(timeInRaw);
    const cutoffMins = parseCutoffMinutes(cutoffTimeStr);
    isLate = !isNaN(timeInMins) && timeInMins > cutoffMins;
    timeInStatus = isLate ? 'LATE' : 'PRESENT';
  }

  let timeOutStatus = 'ABSENT';
  if (hasTimeOut) {
    timeOutStatus = 'PRESENT';
  } else if (hasTimeIn) {
    timeOutStatus = 'NO TIME-OUT';
  }

  let finalDailyStatus = 'ABSENT';
  let finalStatusClass = 'status-absent';

  if (hasTimeIn && hasTimeOut) {
    if (isLate) {
      finalDailyStatus = 'LATE';
      finalStatusClass = 'status-late-complete';
    } else {
      finalDailyStatus = 'PRESENT';
      finalStatusClass = 'status-present-complete';
    }
  } else if (hasTimeIn && !hasTimeOut) {
    if (isLate) {
      finalDailyStatus = 'LATE / NO TIME-OUT';
      finalStatusClass = 'status-incomplete-late';
    } else {
      finalDailyStatus = 'NO TIME-OUT';
      finalStatusClass = 'status-incomplete';
    }
  } else if (!hasTimeIn && hasTimeOut) {
    finalDailyStatus = 'NO TIME-IN';
    finalStatusClass = 'status-incomplete';
    timeInStatus = 'NO TIME-IN';
  } else {
    finalDailyStatus = 'ABSENT';
    finalStatusClass = 'status-absent';
  }

  const timeInScanObj = hasTimeIn ? (typeof timeInScan === 'object' && timeInScan !== null ? timeInScan : { timestamp: timeInRaw, scanMode: 'Time-In' }) : null;
  const timeOutScanObj = hasTimeOut ? (typeof timeOutScan === 'object' && timeOutScan !== null ? timeOutScan : { timestamp: timeOutRaw, scanMode: 'Time-Out' }) : null;

  return {
    cadetId: cadet?.id || cadet?.cadetId || timeInScan?.cadetId || timeOutScan?.cadetId || 'UNKNOWN',
    name: cadet?.name || timeInScan?.name || timeOutScan?.name || 'Cadet',
    rank: cadet?.rank || timeInScan?.rank || timeOutScan?.rank || 'Cadet',
    battalion: cadet?.battalion || timeInScan?.battalion || timeOutScan?.battalion || '1st Battalion',
    company: cadet?.company || timeInScan?.company || timeOutScan?.company || 'Alpha Company',
    platoon: cadet?.platoon || timeInScan?.platoon || timeOutScan?.platoon || '1st Platoon',
    dutyOfficer: timeInScan?.dutyOfficer || timeOutScan?.dutyOfficer || 'N/A',
    sessionName: timeInScan?.sessionName || timeOutScan?.sessionName || 'Field Session',
    hasTimeIn,
    hasTimeOut,
    timeInScan: timeInScanObj,
    timeOutScan: timeOutScanObj,
    timeIn: timeInRaw,
    timeOut: timeOutRaw,
    timeInTime: timeInRaw,
    timeOutTime: timeOutRaw,
    timeInStatus,
    timeOutStatus,
    finalDailyStatus,
    finalStatusClass,
    isComplete: hasTimeIn && hasTimeOut,
    isLate,
    isAbsent: !hasTimeIn && !hasTimeOut
  };
}

/**
 * Reconciles mobile attendance scans into daily cadet attendance records.
 */
export function reconcileMobileScans(scans = [], sessionDate = null, cutoffTimeStr = '07:30') {
  const targetDateStr = sessionDate ? new Date(sessionDate).toDateString() : null;

  const relevantScans = targetDateStr
    ? scans.filter(l => l.timestamp && new Date(l.timestamp).toDateString() === targetDateStr)
    : scans;

  const cadetLogsMap = new Map();
  relevantScans.forEach(scan => {
    const id = String(scan.cadetId || scan.id || '').trim().toUpperCase();
    if (!id) return;
    if (!cadetLogsMap.has(id)) {
      cadetLogsMap.set(id, { timeIn: null, timeOut: null, all: [] });
    }
    const group = cadetLogsMap.get(id);
    group.all.push(scan);

    const rawTimeIn = scan.timeIn || scan.timeInTime || (scan.timeInScan ? scan.timeInScan.timestamp : null);
    const rawTimeOut = scan.timeOut || scan.timeOutTime || (scan.timeOutScan ? scan.timeOutScan.timestamp : null);

    if (rawTimeIn) {
      const timeInObj = scan.timeInScan || { ...scan, scanMode: 'Time-In', timestamp: rawTimeIn };
      if (!group.timeIn || (rawTimeIn && new Date(rawTimeIn) < new Date(group.timeIn.timestamp || group.timeIn.timeIn))) {
        group.timeIn = timeInObj;
      }
    }
    if (rawTimeOut) {
      const timeOutObj = scan.timeOutScan || { ...scan, scanMode: 'Time-Out', timestamp: rawTimeOut };
      if (!group.timeOut || (rawTimeOut && new Date(rawTimeOut) > new Date(group.timeOut.timestamp || group.timeOut.timeOut))) {
        group.timeOut = timeOutObj;
      }
    }

    if (!rawTimeIn && !rawTimeOut) {
      const mode = scan.scanMode || (String(scan.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');
      if (mode === 'Time-Out') {
        if (!group.timeOut || (scan.timestamp && new Date(scan.timestamp) > new Date(group.timeOut.timestamp))) {
          group.timeOut = scan;
        }
      } else {
        if (!group.timeIn || (scan.timestamp && new Date(scan.timestamp) < new Date(group.timeIn.timestamp))) {
          group.timeIn = scan;
        }
      }
    }
  });

  const reconciledList = [];
  cadetLogsMap.forEach((group, id) => {
    const sample = group.timeIn || group.timeOut || group.all[0];
    const cadet = {
      id: sample.cadetId || id,
      name: sample.name || 'Cadet',
      rank: sample.rank || 'Cadet',
      battalion: sample.battalion || '1st Battalion',
      company: sample.company || 'Alpha Company',
      platoon: sample.platoon || '1st Platoon'
    };
    const reconciled = reconcileCadetDailyStatus(cadet, group.timeIn, group.timeOut, cutoffTimeStr);
    reconciledList.push(reconciled);
  });

  const totalScannedCadets = reconciledList.length;
  const presentCompleteCount = reconciledList.filter(r => r.finalDailyStatus === 'PRESENT' || r.finalDailyStatus === 'PRESENT (Complete)').length;
  const lateCompleteCount = reconciledList.filter(r => r.finalDailyStatus === 'LATE' || r.finalDailyStatus === 'LATE (Complete)').length;
  const incompleteNoTimeOutCount = reconciledList.filter(r => r.finalDailyStatus === 'NO TIME-OUT' || r.finalDailyStatus === 'INCOMPLETE (No Time-Out)').length;
  const incompleteLateCount = reconciledList.filter(r => r.finalDailyStatus === 'LATE / NO TIME-OUT' || r.finalDailyStatus === 'INCOMPLETE (Late / No Time-Out)').length;

  return {
    reconciledList,
    summary: {
      totalScannedCadets,
      presentCompleteCount,
      lateCompleteCount,
      incompleteNoTimeOutCount,
      incompleteLateCount,
      totalIncomplete: incompleteNoTimeOutCount + incompleteLateCount,
      totalPresent: presentCompleteCount + lateCompleteCount
    }
  };
}

/**
 * Re-evaluates and dynamically recalculates the status of all attendance logs
 * against the provided cutoff time setting.
 */
export function recalculateAttendanceLogs(logs = [], cutoffTimeStr = '07:30') {
  if (!Array.isArray(logs)) return [];

  return logs.map((log) => {
    const isTimeOutOnly = log.scanMode === 'Time-Out' && !log.timeIn;
    const timeInTimestamp = log.timeIn || (!isTimeOutOnly ? (log.timeInTime || (log.scanMode !== 'Time-Out' ? log.timestamp : null)) : null);
    const timeOutTimestamp = log.timeOut || (log.scanMode === 'Time-Out' ? (log.timeOutTime || log.timestamp) : null);

    const timeInScan = timeInTimestamp
      ? (log.timeInScan || { ...log, scanMode: 'Time-In', timestamp: timeInTimestamp })
      : null;

    const timeOutScan = timeOutTimestamp
      ? (log.timeOutScan || { ...log, scanMode: 'Time-Out', timestamp: timeOutTimestamp })
      : null;

    const cadet = {
      id: log.cadetId || log.id || 'UNKNOWN',
      name: log.name,
      rank: log.rank,
      battalion: log.battalion,
      company: log.company,
      platoon: log.platoon
    };

    const reconciled = reconcileCadetDailyStatus(cadet, timeInScan, timeOutScan, cutoffTimeStr);

    return {
      ...log,
      timeIn: timeInTimestamp,
      timeOut: timeOutTimestamp,
      timeInScan,
      timeOutScan,
      timeInStatus: reconciled.timeInStatus,
      timeOutStatus: reconciled.timeOutStatus,
      finalDailyStatus: reconciled.finalDailyStatus,
      status: reconciled.finalDailyStatus,
      finalStatusClass: reconciled.finalStatusClass,
      isLate: reconciled.isLate,
      isComplete: reconciled.isComplete,
      isAbsent: reconciled.isAbsent
    };
  });
}
