/**
 * Evaluates the real-time attendance status (PRESENT, LATE, or TIME-OUT)
 * dynamically based on the scan timestamp and the active Time-In Cutoff.
 *
 * @param {Object} log - Attendance scan record
 * @param {string} cutoffTimeStr - Time-In cutoff string in "HH:MM" (24h or 12h AM/PM)
 * @returns {"PRESENT" | "LATE" | "TIME-OUT"}
 */
export function getAttendanceStatus(log, cutoffTimeStr = '07:30') {
  if (!log) return 'PRESENT';

  // If explicitly a Time-Out scan, retain TIME-OUT
  if (log.scanMode === 'Time-Out' || (log.status && String(log.status).toUpperCase().includes('TIME-OUT'))) {
    return 'TIME-OUT';
  }

  if (!log.timestamp) {
    return 'PRESENT';
  }

  // 1. Parse log timestamp into total minutes of the day (0 to 1439)
  let logHours = NaN;
  let logMinutes = NaN;

  const d = new Date(log.timestamp);
  if (!isNaN(d.getTime())) {
    logHours = d.getHours();
    logMinutes = d.getMinutes();
  } else if (typeof log.timestamp === 'string') {
    const timeMatch = log.timestamp.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const meridiem = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      logHours = h;
      logMinutes = m;
    }
  }

  if (isNaN(logHours) || isNaN(logMinutes)) {
    return 'PRESENT';
  }

  const logTotalMinutes = logHours * 60 + logMinutes;

  // 2. Parse cutoff string into total minutes of the day (0 to 1439)
  let cutoffHours = 7;
  let cutoffMins = 30;

  if (typeof cutoffTimeStr === 'string' && cutoffTimeStr.trim()) {
    const cutoffMatch = cutoffTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (cutoffMatch) {
      let ch = parseInt(cutoffMatch[1], 10);
      const cm = parseInt(cutoffMatch[2], 10);
      const cMeridiem = cutoffMatch[3] ? cutoffMatch[3].toUpperCase() : null;
      if (cMeridiem === 'PM' && ch < 12) ch += 12;
      if (cMeridiem === 'AM' && ch === 12) ch = 0;
      cutoffHours = ch;
      cutoffMins = cm;
    }
  }

  const cutoffTotalMinutes = cutoffHours * 60 + cutoffMins;

  // 3. Dynamic evaluation: Time <= Cutoff is PRESENT, Time > Cutoff is LATE
  return logTotalMinutes > cutoffTotalMinutes ? 'LATE' : 'PRESENT';
}

/**
 * Resolves the unit echelon directly from the scanned QR batch session data
 * rather than static profile fallback.
 *
 * @param {Object} log - Attendance log record
 * @returns {{ battalion: string, company: string, platoon: string }}
 */
export function getScannedUnitEchelon(log) {
  if (!log) return { battalion: '1st Battalion', company: 'Alpha Company', platoon: '1st Platoon' };

  let bn = log.battalion;
  let co = log.company;
  let pl = log.platoon;

  // If sessionName contains echelon details, ensure consistency with the scanned session
  if (log.sessionName) {
    const s = log.sessionName;
    const bnMatch = s.match(/(1st Battalion|2nd Battalion|Brigade HQ|CADET OFFICERS|[1-9](?:st|nd|rd|th)?\s*Battalion)/i);
    if (bnMatch) bn = bnMatch[0];

    const coMatch = s.match(/(Alpha|Bravo|Charlie|Delta|HQ|Headquarters|Cadet Officer)(?:\s*Company)?/i);
    if (coMatch && !coMatch[0].toLowerCase().includes('battalion')) {
      co = coMatch[0].includes('Company') ? coMatch[0] : `${coMatch[0]} Company`;
    }

    const plMatch = s.match(/([1-4](?:st|nd|rd|th)?\s*Platoon|Officer Corps)/i);
    if (plMatch) pl = plMatch[0];
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
