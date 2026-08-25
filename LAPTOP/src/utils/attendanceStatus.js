/**
 * Attendance Status & Roster Reconciliation Engine
 * Enforces dynamic Time-In cutoff checks, Time-Out presence, and full roster reconciliation matrix.
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

/**
 * Parses timestamp into total minutes from midnight (0 - 1439).
 */
export function parseTimestampMinutes(timestamp) {
  return parseTimeToMinutes(timestamp);
}

/**
 * Parses cutoff time string ("07:30", "07:30 AM", "21:01", "09:01 PM") into total minutes from midnight.
 */
export function parseCutoffMinutes(cutoffTimeStr = '07:30') {
  const mins = parseTimeToMinutes(cutoffTimeStr);
  return isNaN(mins) ? 450 : mins; // Default to 450 mins (07:30 AM)
}

/**
 * Evaluates the status of an individual scan record:
 * - Time-In: PRESENT if <= cutoff, LATE if > cutoff.
 * - Time-Out: PRESENT (No cutoff applies to Time-Out).
 */
export function evaluateSingleScan(log, cutoffTimeStr = '07:30') {
  if (!log) return 'PRESENT';

  const mode = log.scanMode || (String(log.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');
  if (mode === 'Time-Out') {
    return 'PRESENT';
  }

  const logMins = parseTimestampMinutes(log.timestamp);
  if (isNaN(logMins)) {
    return 'PRESENT';
  }

  const cutoffMins = parseCutoffMinutes(cutoffTimeStr);
  return logMins > cutoffMins ? 'LATE' : 'PRESENT';
}

/**
 * Legacy getAttendanceStatus helper for compatibility
 */
export function getAttendanceStatus(log, cutoffTimeStr = '07:30') {
  if (!log) return 'PRESENT';
  const mode = log.scanMode || (String(log.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');
  if (mode === 'Time-Out') {
    return 'TIME-OUT';
  }
  return evaluateSingleScan(log, cutoffTimeStr);
}

/**
 * Reconciles a single cadet's daily attendance from their Time-In and Time-Out scans
 * according to the ROTC Summary Status Matrix:
 *
 * 1. Time-In <= Cutoff && Time-Out Scanned   => Time-In: PRESENT, Time-Out: PRESENT,     Final: PRESENT
 * 2. Time-In > Cutoff  && Time-Out Scanned   => Time-In: LATE,    Time-Out: PRESENT,     Final: LATE
 * 3. Time-In <= Cutoff && Time-Out No Scan   => Time-In: PRESENT, Time-Out: NO TIME-OUT, Final: NO TIME-OUT
 * 4. Time-In > Cutoff  && Time-Out No Scan   => Time-In: LATE,    Time-Out: NO TIME-OUT, Final: LATE / NO TIME-OUT
 * 5. Time-In No Scan   && Time-Out No Scan   => Time-In: ABSENT,  Time-Out: ABSENT,      Final: ABSENT
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
 * Reconciles the full cadet roster against attendance scan records.
 * Returns the enriched list of reconciled cadets + attendance summary breakdown.
 */
export function reconcileRosterAttendance(cadets = [], attendanceLogs = [], sessionDate = null, cutoffTimeStr = '07:30') {
  const targetDateStr = sessionDate ? new Date(sessionDate).toDateString() : null;

  // Filter logs by date if a specific session date is provided
  const relevantLogs = targetDateStr
    ? attendanceLogs.filter(l => l.timestamp && new Date(l.timestamp).toDateString() === targetDateStr)
    : attendanceLogs;

  // Group logs by normalized Cadet ID
  const cadetLogsMap = new Map();
  relevantLogs.forEach(log => {
    const id = String(log.cadetId || log.id || '').trim().toUpperCase();
    if (!id) return;
    if (!cadetLogsMap.has(id)) {
      cadetLogsMap.set(id, { timeIn: null, timeOut: null, all: [] });
    }
    const group = cadetLogsMap.get(id);
    group.all.push(log);

    // Check if the log itself carries explicit timeIn / timeOut properties (merged row model)
    const rawTimeIn = log.timeIn || log.timeInTime || (log.timeInScan ? log.timeInScan.timestamp : null);
    const rawTimeOut = log.timeOut || log.timeOutTime || (log.timeOutScan ? log.timeOutScan.timestamp : null);

    if (rawTimeIn) {
      const timeInObj = log.timeInScan || { ...log, scanMode: 'Time-In', timestamp: rawTimeIn };
      if (!group.timeIn || (rawTimeIn && new Date(rawTimeIn) < new Date(group.timeIn.timestamp || group.timeIn.timeIn))) {
        group.timeIn = timeInObj;
      }
    }
    if (rawTimeOut) {
      const timeOutObj = log.timeOutScan || { ...log, scanMode: 'Time-Out', timestamp: rawTimeOut };
      if (!group.timeOut || (rawTimeOut && new Date(rawTimeOut) > new Date(group.timeOut.timestamp || group.timeOut.timeOut))) {
        group.timeOut = timeOutObj;
      }
    }

    // If neither explicit property is set, fall back to scanMode / status
    if (!rawTimeIn && !rawTimeOut) {
      const mode = log.scanMode || (String(log.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');
      if (mode === 'Time-Out') {
        if (!group.timeOut || (log.timestamp && new Date(log.timestamp) > new Date(group.timeOut.timestamp))) {
          group.timeOut = log;
        }
      } else {
        if (!group.timeIn || (log.timestamp && new Date(log.timestamp) < new Date(group.timeIn.timestamp))) {
          group.timeIn = log;
        }
      }
    }
  });

  const reconciledList = [];
  const processedIds = new Set();

  // 1. Process all registered cadets from master roster
  cadets.forEach(cadet => {
    const id = String(cadet.id || cadet.cadetId || '').trim().toUpperCase();
    processedIds.add(id);
    const logsGroup = cadetLogsMap.get(id);
    const timeInScan = logsGroup ? logsGroup.timeIn : null;
    const timeOutScan = logsGroup ? logsGroup.timeOut : null;

    const reconciled = reconcileCadetDailyStatus(cadet, timeInScan, timeOutScan, cutoffTimeStr);
    reconciledList.push(reconciled);
  });

  // 2. Include any scanned cadets not present in the static roster
  cadetLogsMap.forEach((logsGroup, id) => {
    if (!processedIds.has(id)) {
      const sample = logsGroup.timeIn || logsGroup.timeOut || logsGroup.all[0];
      const virtualCadet = {
        id: sample.cadetId || id,
        name: sample.name || sample.cadetName || 'Unregistered Cadet',
        rank: sample.rank || 'Cadet',
        battalion: sample.battalion || '1st Battalion',
        company: sample.company || 'Alpha Company',
        platoon: sample.platoon || '1st Platoon'
      };
      const reconciled = reconcileCadetDailyStatus(virtualCadet, logsGroup.timeIn, logsGroup.timeOut, cutoffTimeStr);
      reconciledList.push(reconciled);
    }
  });

  // Summary Metrics
  const totalStrength = reconciledList.length;
  const presentCompleteCount = reconciledList.filter(r => r.finalDailyStatus === 'PRESENT' || (r.hasTimeIn && !r.finalDailyStatus?.includes('ABSENT'))).length;
  const lateCompleteCount = reconciledList.filter(r => r.finalDailyStatus === 'LATE' || r.finalDailyStatus?.includes('LATE') || r.isLate).length;
  const incompleteCount = reconciledList.filter(r =>
    r.finalDailyStatus === 'NO TIME-OUT' ||
    r.finalDailyStatus === 'NO TIME-IN' ||
    r.finalDailyStatus?.includes('NO TIME-OUT') ||
    r.finalDailyStatus?.includes('NO TIME-IN') ||
    r.finalDailyStatus?.includes('INCOMPLETE') ||
    (r.hasTimeIn && !r.hasTimeOut) ||
    (!r.hasTimeIn && r.hasTimeOut)
  ).length;
  const absentCount = reconciledList.filter(r => r.finalDailyStatus === 'ABSENT' || r.finalDailyStatus?.includes('ABSENT')).length;
  const totalScanned = reconciledList.filter(r => r.hasTimeIn || r.hasTimeOut).length;

  return {
    reconciledRoster: reconciledList,
    summary: {
      totalStrength,
      presentCompleteCount,
      lateCompleteCount,
      incompleteCount,
      absentCount,
      totalScanned,
      presentOrLateCount: presentCompleteCount + lateCompleteCount
    }
  };
}

/**
 * Normalizes Battalion identifier ('1', '2', 'OFFICER', etc.)
 */
export function normalizeBattalion(val) {
  if (!val) return null;
  const s = String(val).toLowerCase().trim();
  if (s.includes('brigade') || s.includes('officer')) return 'OFFICER';
  if (s.includes('1st') || s.includes('1bn') || s.match(/\b1\b/)) return '1';
  if (s.includes('2nd') || s.includes('2bn') || s.match(/\b2\b/)) return '2';
  return s.replace(' battalion', '').trim();
}

/**
 * Normalizes Company identifier ('alpha', 'bravo', 'charlie', 'delta', 'officer', etc.)
 */
export function normalizeCompany(val) {
  if (!val) return null;
  const s = String(val).toLowerCase().trim();
  if (s.includes('alpha')) return 'alpha';
  if (s.includes('bravo')) return 'bravo';
  if (s.includes('charlie')) return 'charlie';
  if (s.includes('delta')) return 'delta';
  if (s.includes('hq') || s.includes('headquarters') || s.includes('officer')) return 'officer';
  return s.replace(' company', '').trim();
}

/**
 * Normalizes Platoon identifier ('1', '2', '3', '4')
 */
export function normalizePlatoon(val) {
  if (!val) return null;
  const s = String(val).toLowerCase().trim();
  if (s.includes('1st') || s.includes('1pltn') || s.includes('1st platoon') || s.match(/\b1\b/)) return '1';
  if (s.includes('2nd') || s.includes('2pltn') || s.includes('2nd platoon') || s.match(/\b2\b/)) return '2';
  if (s.includes('3rd') || s.includes('3pltn') || s.includes('3rd platoon') || s.match(/\b3\b/)) return '3';
  if (s.includes('4th') || s.includes('4pltn') || s.includes('4th platoon') || s.match(/\b4\b/)) return '4';
  return s.replace(' platoon', '').trim();
}

/**
 * Resolves the unit echelon directly from the scanned record or session data
 */
export function getScannedUnitEchelon(log) {
  if (!log) return { battalion: '1st Battalion', company: 'Alpha Company', platoon: '1st Platoon' };

  let bn = log.battalion && log.battalion !== 'N/A' ? log.battalion : null;
  let co = log.company && log.company !== 'N/A' ? log.company : null;
  let pl = log.platoon && log.platoon !== 'N/A' ? log.platoon : null;

  if (log.sessionName) {
    const s = log.sessionName;
    if (!bn) {
      const bnMatch = s.match(/(1st Battalion|2nd Battalion|Brigade HQ|CADET OFFICERS|[1-9](?:st|nd|rd|th)?\s*Battalion)/i);
      if (bnMatch) bn = bnMatch[0];
    }

    if (!co) {
      const coMatch = s.match(/(Alpha|Bravo|Charlie|Delta|HQ|Headquarters|Cadet Officer)(?:\s*Company)?/i);
      if (coMatch && !coMatch[0].toLowerCase().includes('battalion')) {
        co = coMatch[0].includes('Company') ? coMatch[0] : `${coMatch[0]} Company`;
      }
    }

    if (!pl) {
      const plMatch = s.match(/([1-4](?:st|nd|rd|th)?\s*Platoon|Officer Corps)/i);
      if (plMatch) pl = plMatch[0];
    }
  }

  return {
    battalion: bn || '1st Battalion',
    company: co || 'Alpha Company',
    platoon: pl || '1st Platoon'
  };
}

/**
 * Gets the active formation cutoff time from localStorage or returns default "07:30"
 */
export function getActiveFormationCutoff() {
  try {
    const local = localStorage.getItem('csu_rotc_admin_settings');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed.morningCutoffTime) return parsed.morningCutoffTime;
      if (parsed.formationCutoffTime) return parsed.formationCutoffTime;
    }
    const legacy = localStorage.getItem('csu_rotc_formation_cutoff');
    if (legacy) return legacy;
  } catch (e) {}
  return '07:30';
}

/**
 * Re-evaluates and dynamically recalculates the status of all master attendance log rows
 * against the provided cutoff time setting.
 */
export function recalculateAttendanceLogs(logs = [], cutoffTimeStr = '07:30') {
  if (!Array.isArray(logs)) return [];

  const activeCutoff = cutoffTimeStr || getActiveFormationCutoff();

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

    const reconciled = reconcileCadetDailyStatus(cadet, timeInScan, timeOutScan, activeCutoff);

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
