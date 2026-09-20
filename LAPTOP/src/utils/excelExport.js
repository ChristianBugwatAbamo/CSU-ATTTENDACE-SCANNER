import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  getScannedUnitEchelon,
  evaluateSingleScan,
  reconcileCadetDailyStatus,
  getActiveFormationCutoff,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon
} from './attendanceStatus';
import { getSupabaseClient } from './supabaseClient';
import { DEFAULT_UNIT_STRUCTURE } from '../components/AdminSettings';

export const DEFAULT_LETTERHEAD = {
  topMotto: 'ARMY 2040: WORLD CLASS. MULTI-MISSION READY. CROSS-DOMAIN CAPABLE',
  headquarters: 'H E A D Q U A R T E R S',
  unitName: 'CARAGA STATE UNIVERSITY MAIN CAMPUS ROTC UNIT (ACTIVATED)',
  parentCommand: '1501 (ADN), 15TH (CARAGA) RCDG, ARESCOM',
  location: 'Ampayon, Butuan City',
  officeSymbol: 'CSUROTCU1',
  leftLogoUrl: '/csu-logo.png',
  rightLogoUrl: '/rotc-seal-transparent.png'
};

/**
 * Dynamically fetches letterhead configuration from Supabase system_settings or Unit Settings
 * Matches: motto_text, heading_title, unit_name, unit_address, base64 seal images
 */
export async function fetchActiveLetterhead(providedLetterhead = null) {
  if (providedLetterhead && typeof providedLetterhead === 'object' && Object.keys(providedLetterhead).length > 0) {
    return { ...DEFAULT_LETTERHEAD, ...providedLetterhead };
  }

  // 1. Query Supabase system_settings
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('system_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const lhConfig = data.letterhead_config || {};

        // Extract motto, heading, unit name, address/location from system_settings
        const topMotto = data.motto_text || data.top_motto || lhConfig.motto_text || lhConfig.mottoText || lhConfig.topMotto || DEFAULT_LETTERHEAD.topMotto;
        const headquarters = data.heading_title || data.headquarters || lhConfig.heading_title || lhConfig.headingTitle || lhConfig.headquarters || DEFAULT_LETTERHEAD.headquarters;
        const unitName = data.unit_name || data.unitName || lhConfig.unit_name || lhConfig.unitName || DEFAULT_LETTERHEAD.unitName;
        const parentCommand = data.parent_command || data.parentCommand || lhConfig.parent_command || lhConfig.parentCommand || DEFAULT_LETTERHEAD.parentCommand;
        const location = data.unit_address || data.host_institution || data.hostInstitution || data.location || lhConfig.unit_address || lhConfig.unitAddress || lhConfig.location || DEFAULT_LETTERHEAD.location;
        const officeSymbol = data.office_symbol || data.officeSymbol || lhConfig.office_symbol || lhConfig.officeSymbol || DEFAULT_LETTERHEAD.officeSymbol;

        // Base64 seal images or URL paths
        const leftLogoUrl = data.left_logo_url || data.university_logo_url || lhConfig.left_logo_url || lhConfig.leftLogoUrl || DEFAULT_LETTERHEAD.leftLogoUrl;
        const rightLogoUrl = data.right_logo_url || data.rotc_seal_url || lhConfig.right_logo_url || lhConfig.rightLogoUrl || DEFAULT_LETTERHEAD.rightLogoUrl;

        return {
          topMotto,
          headquarters,
          unitName,
          parentCommand,
          location,
          officeSymbol,
          leftLogoUrl,
          rightLogoUrl
        };
      }
    } catch (err) {
      console.warn('Could not fetch letterhead from system_settings:', err);
    }
  }

  // 2. Fallback to localStorage settings
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedLh = localStorage.getItem('csu_rotc_letterhead_settings');
      if (savedLh) {
        return { ...DEFAULT_LETTERHEAD, ...JSON.parse(savedLh) };
      }
      const savedAdmin = localStorage.getItem('csu_rotc_admin_settings');
      if (savedAdmin) {
        const parsed = JSON.parse(savedAdmin);
        return {
          topMotto: parsed.motto_text || parsed.mottoText || DEFAULT_LETTERHEAD.topMotto,
          headquarters: parsed.heading_title || parsed.headingTitle || DEFAULT_LETTERHEAD.headquarters,
          unitName: parsed.unitName || parsed.unit_name || DEFAULT_LETTERHEAD.unitName,
          parentCommand: parsed.parentCommand || parsed.parent_command || DEFAULT_LETTERHEAD.parentCommand,
          location: parsed.unit_address || parsed.unitAddress || parsed.hostInstitution || parsed.location || DEFAULT_LETTERHEAD.location,
          officeSymbol: parsed.officeSymbol || parsed.office_symbol || DEFAULT_LETTERHEAD.officeSymbol,
          leftLogoUrl: parsed.leftLogoUrl || parsed.universityLogoUrl || DEFAULT_LETTERHEAD.leftLogoUrl,
          rightLogoUrl: parsed.rightLogoUrl || parsed.rotcSealUrl || DEFAULT_LETTERHEAD.rightLogoUrl
        };
      }
    }
  } catch (_) { }

  return DEFAULT_LETTERHEAD;
}

/**
 * Retrieves saved letterhead settings from localStorage or fallback to defaults
 */
export function getActiveLetterhead() {
  try {
    const saved = localStorage.getItem('csu_rotc_letterhead_settings');
    if (saved) {
      return { ...DEFAULT_LETTERHEAD, ...JSON.parse(saved) };
    }
  } catch (_) { }
  return DEFAULT_LETTERHEAD;
}

/**
 * Saves letterhead settings to localStorage
 */
export function saveActiveLetterhead(settings) {
  try {
    localStorage.setItem('csu_rotc_letterhead_settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('csu_letterhead_updated'));
  } catch (_) { }
}

/**
 * Formats a clean sheet name structured as [Company] - [Platoon] (e.g. "Alpha Co - 1st Platoon")
 * Maximum 31 characters allowed by Excel standard.
 */
export function formatSheetName(echelon, isOfficer = false) {
  if (isOfficer || echelon.battalion === 'CADET OFFICERS') return 'Cadet Officers';

  const coClean = (echelon.company || 'Alpha').replace(' Company', '').trim();
  const plNorm = normalizePlatoon(echelon.platoon);
  const plText = plNorm ? `${plNorm === '1' ? '1st' : plNorm === '2' ? '2nd' : plNorm === '3' ? '3rd' : '4th'} Platoon` : (echelon.platoon || '1st Platoon');

  const name = `${coClean} Co - ${plText}`;
  return name.slice(0, 31);
}

/**
 * Helper to process Base64 Data URLs, raw Base64 strings, or asset URLs into ExcelJS image IDs
 */
async function addLogoToWorkbook(workbook, logoInput) {
  if (!logoInput || typeof logoInput !== 'string' || !logoInput.trim()) return null;
  const trimmed = logoInput.trim();
  try {
    if (trimmed.startsWith('data:image/')) {
      const match = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        let rawExt = match[1].toLowerCase();
        let ext = 'png';
        if (rawExt.includes('jpeg') || rawExt.includes('jpg')) ext = 'jpeg';
        else if (rawExt.includes('gif')) ext = 'gif';
        else if (rawExt.includes('png')) ext = 'png';
        else return null;

        return workbook.addImage({
          base64: match[2].trim(),
          extension: ext
        });
      }
    } else if (trimmed.startsWith('iVBORw0KGgo') || trimmed.startsWith('/9j/') || (trimmed.length > 200 && !trimmed.includes('/') && !trimmed.includes(' '))) {
      // Direct raw base64 string without data:image prefix
      const ext = trimmed.startsWith('/9j/') ? 'jpeg' : 'png';
      return workbook.addImage({
        base64: trimmed,
        extension: ext
      });
    } else if (typeof fetch !== 'undefined') {
      // Fetch public asset path
      const res = await fetch(trimmed);
      if (res.ok) {
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        const lower = trimmed.toLowerCase();
        let ext = 'png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) ext = 'jpeg';
        else if (lower.endsWith('.gif')) ext = 'gif';

        return workbook.addImage({
          buffer,
          extension: ext
        });
      }
    }
  } catch (err) {
    console.warn('Could not load logo for Excel embedding:', err);
  }
  return null;
}

/**
 * Groups records into a nested Map: Company -> Platoon -> Cadet Records[]
 */
function groupRecordsHierarchically(rows) {
  const companyMap = new Map();

  rows.forEach(row => {
    let coName = row.isOfficer ? 'CADET OFFICERS & STAFF' : (row.company || 'Alpha Company');
    if (!coName.toLowerCase().includes('company') && !row.isOfficer) {
      coName = `${coName} Company`;
    }

    let plName = row.isOfficer ? 'Officer Staff' : (row.platoon || '1st Platoon');

    if (!companyMap.has(coName)) {
      companyMap.set(coName, new Map());
    }
    const platoonMap = companyMap.get(coName);
    if (!platoonMap.has(plName)) {
      platoonMap.set(plName, []);
    }
    platoonMap.get(plName).push(row);
  });

  return companyMap;
}

/**
 * Formats any date input (YYYY-MM-DD, ISO string, or Date) to standard military date: "24 August 2026"
 */
export function formatMilitaryDate(dateInput) {
  if (!dateInput) {
    const now = new Date();
    return `${now.getDate()} ${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;
  }

  if (typeof dateInput === 'string') {
    const clean = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      const parts = clean.slice(0, 10).split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      return `${d} ${dt.toLocaleString('en-US', { month: 'long' })} ${y}`;
    }
  }

  const d = new Date(dateInput);
  if (!isNaN(d.getTime())) {
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  }

  return String(dateInput);
}

/**
 * Generates an official, multi-sheet .xlsx attendance workbook using ExcelJS.
 * - Center Header Text in Columns C-H (Rows 1-3)
 * - Right Logo in Columns I-J (Rows 1-3)
 * - Multi-sheet tabs structured cleanly
 */
export async function exportAttendanceToExcel(records = [], sessionName = 'Field Formation Session', customLetterhead = null, formationDate = null) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CSU ROTC Admin HQ';
  workbook.lastModifiedBy = 'CSU ROTC Admin HQ';
  workbook.created = new Date();
  workbook.modified = new Date();

  const letterhead = customLetterhead || getActiveLetterhead();
  const cutoffTime = getActiveFormationCutoff();

  // Resolve effective formation date from parameter, customLetterhead, records, or calendar state
  let effectiveFormationDate = formationDate || customLetterhead?.selectedDate || customLetterhead?.formationDate;
  if (!effectiveFormationDate && records.length > 0) {
    const firstLog = records.find(r => r.timestamp || r.timeIn || r.date);
    if (firstLog) {
      const raw = firstLog.timestamp || firstLog.timeIn || firstLog.date;
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
        effectiveFormationDate = raw.slice(0, 10);
      }
    }
  }
  if (!effectiveFormationDate) {
    try {
      effectiveFormationDate = localStorage.getItem('csu_rotc_selected_formation_date');
    } catch (_) { }
  }

  const formattedDate = formatMilitaryDate(effectiveFormationDate);

  // Load and add Left & Right Logos to workbook
  const leftLogoId = await addLogoToWorkbook(workbook, letterhead.leftLogoUrl);
  const rightLogoId = await addLogoToWorkbook(workbook, letterhead.rightLogoUrl);

  // Safe Time Cell Formatter: Handles pre-formatted strings ("06:45 AM"), ISO timestamps, or fallback
  const formatTimeCell = (val) => {
    if (!val || val === '—' || val === '-') return '—';
    if (typeof val === 'string' && (/AM|PM/i.test(val) || /^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(val.trim()))) {
      return val.trim();
    }
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    } catch (_) { }
    return String(val);
  };

  // Pre-process records into enriched attendance rows
  const enrichedRecords = (records || []).map((log, idx) => {
    const echelon = getScannedUnitEchelon(log);
    const isOfficer = log.battalion === 'CADET OFFICERS' ||
      log.type === 'Cadet Officer' ||
      (log.rank && (log.rank.includes('1CL') || log.rank.includes('2CL') || log.rank.includes('3CL') || log.rank.includes('4CL') || log.rank.includes('ASPIRANT')));

    const timeInVal = log.timeInDisplay || log.timeIn || (log.scanMode !== 'Time-Out' ? log.timestamp : null);
    const timeOutVal = log.timeOutDisplay || log.timeOut || (log.scanMode === 'Time-Out' ? log.timestamp : null);

    const hasValidTimeIn = Boolean(timeInVal && String(timeInVal).trim() && String(timeInVal).trim() !== '—');
    const hasValidTimeOut = Boolean(timeOutVal && String(timeOutVal).trim() && String(timeOutVal).trim() !== '—');

    const timeInStatus = hasValidTimeIn
      ? evaluateSingleScan({ timestamp: timeInVal, scanMode: 'Time-In' }, cutoffTime)
      : 'ABSENT';

    let finalStatus = log.finalStatus || log.status;
    if (!finalStatus) {
      if (hasValidTimeIn && hasValidTimeOut) {
        finalStatus = timeInStatus === 'LATE' ? 'LATE' : 'PRESENT';
      } else if (hasValidTimeIn && !hasValidTimeOut) {
        finalStatus = timeInStatus === 'LATE' ? 'LATE / NO TIME-OUT' : 'NO TIME-OUT';
      } else if (!hasValidTimeIn && hasValidTimeOut) {
        finalStatus = 'NO TIME-IN';
      } else {
        finalStatus = 'ABSENT';
      }
    }

    const timeInFormatted = formatTimeCell(timeInVal);
    const timeOutFormatted = formatTimeCell(timeOutVal);

    return {
      index: idx + 1,
      cadetId: log.cadetId || log.id || 'N/A',
      name: log.name || 'Cadet',
      rank: log.rank || 'Cadet',
      designation: log.designation || 'None',
      battalion: echelon.battalion || '1st Battalion',
      company: echelon.company || 'Alpha Company',
      platoon: echelon.platoon || '1st Platoon',
      isOfficer,
      timeIn: timeInFormatted,
      timeOut: timeOutFormatted,
      timeInStatus,
      finalStatus,
      dutyOfficer: log.dutyOfficer || log.d || 'Duty Officer',
      sessionName: log.sessionName || sessionName,
      date: log.date || formattedDate
    };
  });

  // Helper function to build standard sheet with hierarchical grouping (Company -> Platoon -> Cadets)
  const buildHierarchicalSheet = (worksheet, sheetTitle, subtitleInfo, rows) => {
    // 1. Establish explicit Column Widths first so coordinate calculations are pixel-accurate
    worksheet.columns = [
      { key: 'col_a', width: 8 },   // Col A (#) - Left Logo
      { key: 'col_b', width: 15 },  // Col B (Cadet ID) - Left Logo
      { key: 'col_c', width: 26 },  // Col C (Cadet Name) - Header Text
      { key: 'col_d', width: 14 },  // Col D (Rank) - Header Text
      { key: 'col_e', width: 16 },  // Col E (Battalion) - Header Text
      { key: 'col_f', width: 16 },  // Col F (Company) - Header Text
      { key: 'col_g', width: 16 },  // Col G (Platoon) - Header Text
      { key: 'col_h', width: 14 },  // Col H (Time-In) - Header Text
      { key: 'col_i', width: 14 },  // Col I (Time-Out) - Right Logo
      { key: 'col_j', width: 22 }   // Col J (Final Status) - Right Logo
    ];

    // 2. Set precise Row Heights for header rows 1-6
    worksheet.getRow(1).height = 18;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 22;
    worksheet.getRow(4).height = 19;
    worksheet.getRow(5).height = 19;
    worksheet.getRow(6).height = 18;

    // 3. Row 1: Top Motto Line (Centered across Columns A to J)
    worksheet.mergeCells('A1:J1');
    const mottoCell = worksheet.getCell('A1');
    mottoCell.value = letterhead.topMotto || 'ARMY 2040: WORLD CLASS. MULTI-MISSION READY. CROSS-DOMAIN CAPABLE';
    mottoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    mottoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 4. Merge Left Logo Cells A2:B5
    worksheet.mergeCells('A2:B5');
    const leftLogoCell = worksheet.getCell('A2');
    leftLogoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 5. Center Header Text: Columns C to H (Rows 2, 3, 4, 5)
    // Row 2: Headquarters Title Line
    worksheet.mergeCells('C2:H2');
    const hqCell = worksheet.getCell('C2');
    hqCell.value = letterhead.headquarters || 'H E A D Q U A R T E R S';
    hqCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF003E1D' } };
    hqCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: ROTC Unit Name
    worksheet.mergeCells('C3:H3');
    const unitCell = worksheet.getCell('C3');
    unitCell.value = letterhead.unitName || 'CARAGA STATE UNIVERSITY MAIN CAMPUS ROTC UNIT (ACTIVATED)';
    unitCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
    unitCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 4: Parent Command Line
    worksheet.mergeCells('C4:H4');
    const cmdCell = worksheet.getCell('C4');
    cmdCell.value = letterhead.parentCommand || '1501 (ADN), 15TH (CARAGA) RCDG, ARESCOM';
    cmdCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    cmdCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 5: Host Institution & Location Line
    worksheet.mergeCells('C5:H5');
    const locCell = worksheet.getCell('C5');
    locCell.value = letterhead.location || 'Ampayon, Butuan City';
    locCell.font = { name: 'Arial', size: 9.5, italic: false, color: { argb: 'FF475569' } };
    locCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 6. Merge Right Logo Cells I2:J5
    worksheet.mergeCells('I2:J5');
    const rightLogoCell = worksheet.getCell('I2');
    rightLogoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 7. Embed Left Logo with exact bounds inside A2:B5
    if (leftLogoId !== null) {
      try {
        worksheet.addImage(leftLogoId, {
          tl: { col: 0.1, row: 1.1 },
          br: { col: 1.9, row: 4.9 },
          editAs: 'oneCell'
        });
      } catch (imgErr) {
        console.warn('Could not embed left logo in sheet:', imgErr);
      }
    }

    // 8. Embed Right Logo with exact bounds inside I2:J5
    if (rightLogoId !== null) {
      try {
        worksheet.addImage(rightLogoId, {
          tl: { col: 8.1, row: 1.1 },
          br: { col: 9.9, row: 4.9 },
          editAs: 'oneCell'
        });
      } catch (imgErr) {
        console.warn('Could not embed right logo in sheet:', imgErr);
      }
    }

    // 9. Row 6: Office Symbol on Left, Current Date on Right
    worksheet.mergeCells('A6:D6');
    const officeCell = worksheet.getCell('A6');
    officeCell.value = letterhead.officeSymbol || 'CSUROTCU1';
    officeCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
    officeCell.alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.mergeCells('G6:J6');
    const dateCell = worksheet.getCell('G6');
    dateCell.value = formattedDate;
    dateCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
    dateCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // 10. Row 7: Sheet Echelon Title Banner (Columns A-J)
    worksheet.mergeCells('A7:J7');
    const titleCell = worksheet.getCell('A7');
    titleCell.value = `ATTENDANCE MASTER RECORD: ${sheetTitle.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003E1D' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(7).height = 24;

    // 11. Row 8: Sub-information (Session, Formation Cutoff, Date)
    worksheet.mergeCells('A8:J8');
    const subCell = worksheet.getCell('A8');
    subCell.value = `${subtitleInfo} | Cutoff: ${cutoffTime} | Date: ${formattedDate}`;
    subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(8).height = 18;

    // 12. Row 9: Empty Spacer Row
    worksheet.addRow([]);
    worksheet.getRow(9).height = 10;

    // 11. Hierarchical Nested Grouping: Company -> Platoon -> Cadet Rows
    const companyMap = groupRecordsHierarchically(rows);

    // Sort companies in tactical order (Alpha -> Bravo -> Charlie -> Delta -> Officers)
    const sortedCompanies = Array.from(companyMap.keys()).sort((a, b) => {
      const coOrder = ['alpha', 'bravo', 'charlie', 'delta'];
      const aIdx = coOrder.findIndex(c => a.toLowerCase().includes(c));
      const bIdx = coOrder.findIndex(c => b.toLowerCase().includes(c));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });

    sortedCompanies.forEach(companyName => {
      const platoonMap = companyMap.get(companyName);

      // Compute company summary stats
      let compCadets = [];
      platoonMap.forEach(list => compCadets.push(...list));
      const compPresent = compCadets.filter(c => String(c.finalStatus || '').toUpperCase().includes('PRESENT')).length;
      const compLate = compCadets.filter(c => String(c.finalStatus || '').toUpperCase().includes('LATE')).length;

      // 1. Company Header Banner: Darker Green background (#003E1D), 12pt bold centered text
      const compRow = worksheet.addRow([`${companyName.toUpperCase()} (Strength: ${compCadets.length} | Present: ${compPresent} | Late: ${compLate})`]);
      worksheet.mergeCells(`A${compRow.number}:J${compRow.number}`);
      compRow.height = 25;
      const compCell = compRow.getCell(1);
      compCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003E1D' } };
      compCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      compCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Sort platoons (1st -> 2nd -> 3rd -> 4th)
      const sortedPlatoons = Array.from(platoonMap.keys()).sort((a, b) => {
        const aNum = parseInt(a, 10) || 99;
        const bNum = parseInt(b, 10) || 99;
        return aNum - bNum;
      });

      sortedPlatoons.forEach(platoonName => {
        const platoonCadets = platoonMap.get(platoonName);
        const pltPresent = platoonCadets.filter(c => String(c.finalStatus || '').toUpperCase().includes('PRESENT')).length;
        const pltLate = platoonCadets.filter(c => String(c.finalStatus || '').toUpperCase().includes('LATE')).length;

        // 2. Platoon Header Banner: Mid-Green background (#008037), 10pt bold centered text
        const pltRow = worksheet.addRow([`${platoonName} (Strength: ${platoonCadets.length} | Present: ${pltPresent} | Late: ${pltLate})`]);
        worksheet.mergeCells(`A${pltRow.number}:J${pltRow.number}`);
        pltRow.height = 20;
        const pltCell = pltRow.getCell(1);
        pltCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008037' } };
        pltCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        pltCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // 3. Table Headers: Standard Unit Green (#005A2B)
        const headers = [
          '#',
          'Cadet ID',
          'Cadet Name',
          'Rank',
          'Battalion',
          'Company',
          'Platoon',
          'Time-In',
          'Time-Out',
          'Final Daily Status'
        ];

        const headerRow = worksheet.addRow(headers);
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005A2B' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FF003E1D' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        });

        // 4. Cadet Data Rows
        platoonCadets.forEach((row, i) => {
          const dataRow = worksheet.addRow([
            i + 1,
            row.cadetId,
            row.name,
            row.rank,
            row.battalion,
            row.company,
            row.platoon,
            row.timeIn,
            row.timeOut,
            row.finalStatus
          ]);
          dataRow.height = 20;

          const isEven = i % 2 === 0;
          dataRow.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 9.5 };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            if (colNumber === 2) {
              cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF065F46' } };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (colNumber === 10) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              // Status cell styling
              if (row.finalStatus === 'PRESENT') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF065F46' } };
              } else if (row.finalStatus === 'LATE') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
              } else if (row.finalStatus === 'NO TIME-OUT') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
                cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF9A3412' } };
              } else if (row.finalStatus === 'LATE / NO TIME-OUT') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF991B1B' } };
              } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
              }
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
              if (isEven) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
              }
            }
          });
        });

        // Small spacer between platoons
        const pltSpacer = worksheet.addRow([]);
        pltSpacer.height = 6;
      });

      // Medium spacer between companies
      const coSpacer = worksheet.addRow([]);
      coSpacer.height = 10;
    });
  };

  // 1. Master Summary Sheet (Hierarchically grouped by Company -> Platoon)
  const masterSheet = workbook.addWorksheet('Master Summary');
  const presentTotal = enrichedRecords.filter(r => String(r.finalStatus || '').toUpperCase().includes('PRESENT')).length;
  const lateTotal = enrichedRecords.filter(r => String(r.finalStatus || '').toUpperCase().includes('LATE')).length;
  buildHierarchicalSheet(
    masterSheet,
    'Master Attendance Summary (All Formations)',
    `Total Cadets: ${enrichedRecords.length} | Present: ${presentTotal} | Late: ${lateTotal}`,
    enrichedRecords
  );

  // 2. Group Records individually by [Company] - [Platoon] (e.g. "Alpha Co - 1st Platoon")
  const echelonMap = new Map();
  enrichedRecords.forEach((record) => {
    const sheetKey = formatSheetName(
      {
        battalion: record.battalion,
        company: record.company,
        platoon: record.platoon
      },
      record.isOfficer
    );

    if (!echelonMap.has(sheetKey)) {
      echelonMap.set(sheetKey, []);
    }
    echelonMap.get(sheetKey).push(record);
  });

  // Sort sheet keys in tactical company order (Alpha -> Bravo -> Charlie -> Delta -> Officers)
  const sortedSheetKeys = Array.from(echelonMap.keys()).sort((a, b) => {
    if (a === 'Cadet Officers') return 1;
    if (b === 'Cadet Officers') return -1;
    return a.localeCompare(b);
  });

  // 3. Create separate sheet for each [Company] - [Platoon] with hierarchical headers
  sortedSheetKeys.forEach((sheetName) => {
    const echelonRecords = echelonMap.get(sheetName) || [];
    const echelonSheet = workbook.addWorksheet(sheetName);
    const echPresent = echelonRecords.filter(r => String(r.finalStatus || '').toUpperCase().includes('PRESENT')).length;
    const echLate = echelonRecords.filter(r => String(r.finalStatus || '').toUpperCase().includes('LATE')).length;

    buildHierarchicalSheet(
      echelonSheet,
      sheetName,
      `Strength: ${echelonRecords.length} Cadets | Present: ${echPresent} | Late: ${echLate}`,
      echelonRecords
    );
  });

  // 4. Generate binary buffer & trigger download with file-saver
  const cleanDateSlug = (effectiveFormationDate || 'Formation').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `ROTC_Attendance_${cleanDateSlug}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);

  // 5. Also sync report with server backend if available
  try {
    await fetch('/api/reports/save-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        records: enrichedRecords,
        sessionName,
        letterhead
      })
    });
  } catch (_) {
    // Server offline, local browser export succeeded
  }

  return { success: true, filename, count: enrichedRecords.length, sheetsCount: sortedSheetKeys.length + 1 };
}

// Re-export as alias for compatibility
export const exportAttendanceReport = exportAttendanceToExcel;

/**
 * Parses cadet name into last_name, first_name, and middle_initial
 */
export function parseCadetNameComponents(cadet = {}) {
  let lastName = cadet.last_name || cadet.lastName || '';
  let firstName = cadet.first_name || cadet.firstName || '';
  let middleInitial = cadet.middle_initial || cadet.middleInitial || '';

  if (!lastName && !firstName && cadet.name) {
    const raw = String(cadet.name).trim();
    if (raw.includes(',')) {
      const parts = raw.split(',');
      lastName = parts[0].trim().toUpperCase();
      const rest = (parts[1] || '').trim();
      const nameTokens = rest.split(/\s+/);
      if (nameTokens.length > 1 && /^[a-zA-Z]\.?$/.test(nameTokens[nameTokens.length - 1])) {
        middleInitial = nameTokens.pop().replace(/\./g, '').toUpperCase();
      }
      firstName = nameTokens.join(' ').toUpperCase();
    } else {
      const tokens = raw.split(/\s+/);
      if (tokens.length >= 2) {
        if (/^[a-zA-Z]\.?$/.test(tokens[tokens.length - 1])) {
          middleInitial = tokens.pop().replace(/\./g, '').toUpperCase();
        }
        lastName = tokens.pop().toUpperCase();
        firstName = tokens.join(' ').toUpperCase();
      } else {
        lastName = raw.toUpperCase();
      }
    }
  }

  const miFormatted = middleInitial
    ? (middleInitial.replace(/\./g, '').trim().toUpperCase() + '.')
    : '';

  return {
    lastName: lastName.trim().toUpperCase(),
    firstName: firstName.trim().toUpperCase(),
    middleInitial: miFormatted
  };
}

/**
 * Dynamic Filipino cadet profile templates for realistic sample row generation
 */
const SAMPLE_NAME_POOL = [
  { lastName: 'DELA CRUZ', firstName: 'JUAN', mi: 'M.', gender: 'Male', dept: 'CCIS', prog: 'BSCS', contact: '09123456789' },
  { lastName: 'SANTOS', firstName: 'MARIA', mi: 'A.', gender: 'Female', dept: 'CEGS', prog: 'BSCE', contact: '09187654321' },
  { lastName: 'GARCIA', firstName: 'CARLOS', mi: 'D.', gender: 'Male', dept: 'CCIS', prog: 'BSIT', contact: '09201234567' },
  { lastName: 'LOPEZ', firstName: 'ANA', mi: 'P.', gender: 'Female', dept: 'CED', prog: 'BSED', contact: '09309876543' },
  { lastName: 'REYES', firstName: 'MARK ANTHONY', mi: 'L.', gender: 'Male', dept: 'CAS', prog: 'BACOMM', contact: '09171122334' },
  { lastName: 'TORRES', firstName: 'BEA MARIE', mi: 'K.', gender: 'Female', dept: 'CHASS', prog: 'BSN', contact: '09224455667' },
  { lastName: 'CRUZ', firstName: 'ANGELO', mi: 'J.', gender: 'Male', dept: 'CEGS', prog: 'BSME', contact: '09337788990' },
  { lastName: 'FLORES', firstName: 'ANGELICA', mi: 'T.', gender: 'Female', dept: 'CHASS', prog: 'BSN', contact: '09193344556' },
  { lastName: 'MENDOZA', firstName: 'PAULO', mi: 'R.', gender: 'Male', dept: 'CEGS', prog: 'BSEE', contact: '09285566778' },
  { lastName: 'AQUINO', firstName: 'JOSHUA', mi: 'E.', gender: 'Male', dept: 'CCIS', prog: 'BSCS', contact: '09397788991' },
  { lastName: 'CASTILLO', firstName: 'KEVIN', mi: 'B.', gender: 'Male', dept: 'CAS', prog: 'BSMATH', contact: '09162233445' },
  { lastName: 'DELOS SANTOS', firstName: 'ELLA', mi: 'N.', gender: 'Female', dept: 'CAA', prog: 'BSF', contact: '09274455668' },
  { lastName: 'MORALES', firstName: 'CEDRIC', mi: 'P.', gender: 'Male', dept: 'CEGS', prog: 'BSGE', contact: '09386677889' },
  { lastName: 'BAUTISTA', firstName: 'DIANA', mi: 'M.', gender: 'Female', dept: 'CED', prog: 'BEED', contact: '09491122336' },
  { lastName: 'NAVARRO', firstName: 'CLARA', mi: 'F.', gender: 'Female', dept: 'CCIS', prog: 'BSIS', contact: '09441122335' },
  { lastName: 'RAMOS', firstName: 'GABRIEL', mi: 'V.', gender: 'Male', dept: 'CAS', prog: 'BSBIO', contact: '09405678901' }
];

/**
 * Robust matcher for echelon names (battalion, company, platoon)
 */
function matchesEchelon(cadetVal = '', configVal = '') {
  const cNorm = String(cadetVal || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const cfgNorm = String(configVal || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cNorm || !cfgNorm) return false;
  if (cNorm === cfgNorm) return true;

  // Compare numerical digits for platoons (e.g. "1st Platoon" vs "1" or "1PLTN")
  const cPltMatch = cNorm.match(/(\d+)/);
  const cfgPltMatch = cfgNorm.match(/(\d+)/);
  if (cPltMatch && cfgPltMatch && cPltMatch[1] === cfgPltMatch[1]) {
    if ((cfgNorm.includes('platoon') || cfgNorm.includes('plt')) && (cNorm.includes('platoon') || cNorm.includes('plt') || /^\d+(st|nd|rd|th)?$/.test(cNorm))) {
      return true;
    }
    if ((cfgNorm.includes('battalion') || cfgNorm.includes('bn')) && (cNorm.includes('battalion') || cNorm.includes('bn') || /^\d+(st|nd|rd|th)?$/.test(cNorm))) {
      return true;
    }
  }

  // Compare company names (Alpha, Bravo, Charlie, Delta, etc.)
  const coKeywords = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
  for (const kw of coKeywords) {
    if (cNorm.includes(kw) && cfgNorm.includes(kw)) {
      return true;
    }
  }

  return cNorm.includes(cfgNorm) || cfgNorm.includes(cNorm);
}

/**
 * Dynamically queries active Unit Structure from Supabase or Unit Settings
 */
export async function fetchActiveUnitStructure(providedStructure = null) {
  // 1. Structure passed directly by caller
  if (Array.isArray(providedStructure) && providedStructure.length > 0) {
    return providedStructure;
  }

  // 2. Query Supabase database
  const client = getSupabaseClient();
  if (client) {
    // 2a. Check if dedicated unit_structure table exists
    try {
      const { data: tableData, error: tableError } = await client
        .from('unit_structure')
        .select('*');

      if (!tableError && Array.isArray(tableData) && tableData.length > 0) {
        if (tableData[0]?.companies && Array.isArray(tableData[0]?.companies)) {
          return tableData;
        }
        if (tableData[0]?.battalion && tableData[0]?.company) {
          const bnMap = new Map();
          tableData.forEach((row) => {
            const bName = row.battalion || '1st Battalion';
            const cName = row.company || 'Alpha Company';
            const pName = row.platoon || '1st Platoon';
            if (!bnMap.has(bName)) {
              bnMap.set(bName, { id: `bn-${bnMap.size + 1}`, name: bName, companies: new Map() });
            }
            const bnObj = bnMap.get(bName);
            if (!bnObj.companies.has(cName)) {
              bnObj.companies.set(cName, { id: `co-${bnObj.companies.size + 1}`, name: cName, platoons: [] });
            }
            const coObj = bnObj.companies.get(cName);
            if (!coObj.platoons.some((p) => p.name === pName)) {
              coObj.platoons.push({
                id: `pl-${coObj.platoons.length + 1}`,
                name: pName,
                shortCode: `${pName.charAt(0)}PLTN`,
                targetQuota: row.target_quota || 37
              });
            }
          });
          const parsed = Array.from(bnMap.values()).map((b) => ({
            ...b,
            companies: Array.from(b.companies.values())
          }));
          if (parsed.length > 0) return parsed;
        }
      }
    } catch (_) {
      // Table doesn't exist or query failed, fall through to system_settings
    }

    // 2b. Check system_settings table (unit_structure JSONB column)
    try {
      const { data: settingsData, error: settingsError } = await client
        .from('system_settings')
        .select('unit_structure')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!settingsError && settingsData && settingsData.length > 0) {
        const struct = settingsData[0].unit_structure;
        if (Array.isArray(struct) && struct.length > 0) {
          return struct;
        }
      }
    } catch (_) { }
  }

  // 3. Check browser localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('csu_rotc_admin_settings') || localStorage.getItem('csu_rotc_system_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const struct = parsed.unit_structure || parsed.unitStructure;
        if (Array.isArray(struct) && struct.length > 0) {
          return struct;
        }
      }
    }
  } catch (_) { }

  // 4. Default Unit Structure fallback (1st & 2nd Battalion, 2 Companies each, 2 Platoons each)
  return DEFAULT_UNIT_STRUCTURE || [
    {
      id: 'bn-1',
      name: '1st Battalion',
      companies: [
        {
          id: 'co-1-alpha',
          name: 'Alpha Company',
          platoons: [
            { id: 'pl-1-a-1', name: '1st Platoon', targetQuota: 37 },
            { id: 'pl-1-a-2', name: '2nd Platoon', targetQuota: 37 }
          ]
        },
        {
          id: 'co-1-bravo',
          name: 'Bravo Company',
          platoons: [
            { id: 'pl-1-b-1', name: '1st Platoon', targetQuota: 37 },
            { id: 'pl-1-b-2', name: '2nd Platoon', targetQuota: 37 }
          ]
        }
      ]
    },
    {
      id: 'bn-2',
      name: '2nd Battalion',
      companies: [
        {
          id: 'co-2-charlie',
          name: 'Charlie Company',
          platoons: [
            { id: 'pl-2-c-1', name: '1st Platoon', targetQuota: 37 },
            { id: 'pl-2-c-2', name: '2nd Platoon', targetQuota: 37 }
          ]
        },
        {
          id: 'co-2-delta',
          name: 'Delta Company',
          platoons: [
            { id: 'pl-2-d-1', name: '1st Platoon', targetQuota: 37 },
            { id: 'pl-2-d-2', name: '2nd Platoon', targetQuota: 37 }
          ]
        }
      ]
    }
  ];
}

/**
 * Dynamically generates sample cadet rows ONLY for platoons configured in unit_structure
 */
export function generateSampleCadetsForStructure(unitStructure = []) {
  const sampleCadets = [];
  let sampleIdIndex = 1;
  let poolIdx = 0;

  unitStructure.forEach((bn) => {
    const bnName = bn.name || '1st Battalion';
    (bn.companies || []).forEach((coy) => {
      const coyName = coy.name || 'Alpha Company';
      (coy.platoons || []).forEach((plt) => {
        const pltName = plt.name || '1st Platoon';
        // Generate exactly 2 realistic sample cadet rows per configured platoon
        for (let k = 0; k < 2; k++) {
          const profile = SAMPLE_NAME_POOL[poolIdx % SAMPLE_NAME_POOL.length];
          poolIdx++;
          const idNum = String(sampleIdIndex++).padStart(5, '0');
          sampleCadets.push({
            id: `221-${idNum}`,
            name: `${profile.lastName}, ${profile.firstName} ${profile.mi}`,
            gender: profile.gender,
            department: profile.dept,
            program: profile.prog,
            contact_number: profile.contact,
            battalion: bnName,
            company: coyName,
            platoon: pltName,
            rank: 'Cadet',
            type: 'Basic Cadet'
          });
        }
      });
    });
  });

  return sampleCadets;
}

/**
 * Standard Columns for Cadet Registration & Roster Ledger
 */
const STANDARD_CADET_COLUMNS = [
  { header: '#', key: 'index', width: 6 },
  { header: 'Cadet ID', key: 'cadet_id', width: 16 },
  { header: 'Last Name', key: 'last_name', width: 22 },
  { header: 'First Name', key: 'first_name', width: 22 },
  { header: 'Middle Initial', key: 'middle_initial', width: 14 },
  { header: 'Contact Number', key: 'contact_number', width: 18 },
  { header: 'Gender', key: 'gender', width: 12 },
  { header: 'Department', key: 'department', width: 16 },
  { header: 'Academic Program', key: 'academic_program', width: 22 }
];

/**
 * Exports Cadet Roster or Registration Template to Excel with dynamic echelon grouping:
 * Battalion > Company > Platoon with green text section banners and ROTC forest green (#006633) headers.
 * Queries active unit structure to ensure section headers and sample rows strictly match configured units.
 */
export async function exportCadetRosterToExcel(cadetsInput = [], options = {}) {
  const {
    isTemplate = false,
    filename: customFilename = null,
    sheetTitle = isTemplate ? 'Cadet Registration Template' : 'Cadet Roster Ledger',
    unitStructure: customStructure = null
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CSU ROTC Admin HQ';
  workbook.lastModifiedBy = 'CSU ROTC Admin HQ';
  workbook.created = new Date();
  workbook.modified = new Date();

  const letterhead = await fetchActiveLetterhead(options.letterhead);
  const leftLogoId = await addLogoToWorkbook(workbook, letterhead.leftLogoUrl);
  const rightLogoId = await addLogoToWorkbook(workbook, letterhead.rightLogoUrl);

  // 1. Dynamically fetch active unit structure
  const activeStructure = await fetchActiveUnitStructure(customStructure);

  // 2. Determine records to process (for live roster export or template pre-fill)
  let rawList = (Array.isArray(cadetsInput) && cadetsInput.length > 0)
    ? cadetsInput
    : (Array.isArray(options.cadets) && options.cadets.length > 0)
      ? options.cadets
      : [];

  // Query existing registered cadets from Supabase if none provided
  if (rawList.length === 0) {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('cadets')
          .select('*')
          .order('last_name', { ascending: true });
        if (!error && Array.isArray(data)) {
          rawList = data;
        }
      } catch (err) {
        console.warn('Could not query existing cadets from Supabase for template:', err);
      }
    }
  }

  // 3. Normalize and parse every cadet record
  const normalizedCadets = rawList.map((c, i) => {
    const { lastName, firstName, middleInitial } = parseCadetNameComponents(c);
    const bn = normalizeBattalion(c.battalion || '1st Battalion');
    const coy = normalizeCompany(c.company || 'Alpha Company');
    const plt = c.platoon ? (String(c.platoon).toLowerCase().endsWith('platoon') ? c.platoon : `${c.platoon} Platoon`) : '1st Platoon';

    return {
      index: i + 1,
      id: String(c.id || c.cadet_id || c.cadetId || '').trim().toUpperCase(),
      lastName,
      firstName,
      middleInitial,
      contactNumber: String(c.contact_number || c.contactNumber || c.phone || '').trim(),
      gender: c.gender ? (String(c.gender).toUpperCase().startsWith('F') ? 'Female' : 'Male') : 'Male',
      department: String(c.department || c.dept || 'CCIS').trim().toUpperCase(),
      program: String(c.academic_program || c.academicProgram || c.program || c.course || 'BSCS').trim().toUpperCase(),
      battalion: bn,
      company: coy,
      platoon: plt,
      rank: c.rank || 'Cadet',
      type: c.type || 'Basic Cadet'
    };
  });

  // 4. Pre-seed hierarchy strictly from the configured unit structure
  // Only configured platoons (e.g. max 2 per company) will exist as section headers
  const hierarchy = new Map();

  activeStructure.forEach((bn) => {
    const coyMap = new Map();
    (bn.companies || []).forEach((coy) => {
      const pltMap = new Map();
      (coy.platoons || []).forEach((plt) => {
        pltMap.set(plt.name, []);
      });
      coyMap.set(coy.name, pltMap);
    });
    hierarchy.set(bn.name, coyMap);
  });

  // 5. Populate cadets strictly into configured unit echelons
  normalizedCadets.forEach((cadet) => {
    let assigned = false;
    for (const [bnName, coyMap] of hierarchy.entries()) {
      if (matchesEchelon(cadet.battalion, bnName)) {
        for (const [coyName, pltMap] of coyMap.entries()) {
          if (matchesEchelon(cadet.company, coyName)) {
            for (const pltName of pltMap.keys()) {
              if (matchesEchelon(cadet.platoon, pltName)) {
                pltMap.get(pltName).push(cadet);
                assigned = true;
                break;
              }
            }
            if (assigned) break;
          }
        }
        if (assigned) break;
      }
    }
  });

  // Helper function to build a structured worksheet
  const buildRosterWorksheet = (worksheet, titleBanner, subInfo, bnEntries) => {
    // 1. Column Widths
    worksheet.columns = STANDARD_CADET_COLUMNS.map(col => ({
      key: col.key,
      width: col.width
    }));

    // 2. Row Heights for Header Rows 1-6
    worksheet.getRow(1).height = 18;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 22;
    worksheet.getRow(4).height = 19;
    worksheet.getRow(5).height = 24;
    worksheet.getRow(6).height = 18;

    // Row 1: Motto Banner (A1:I1)
    worksheet.mergeCells('A1:I1');
    const mottoCell = worksheet.getCell('A1');
    mottoCell.value = letterhead.topMotto || 'ARMY 2040: WORLD CLASS. MULTI-MISSION READY. CROSS-DOMAIN CAPABLE';
    mottoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    mottoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2-4: Left Logo (A2:B4)
    worksheet.mergeCells('A2:B4');
    const leftLogoCell = worksheet.getCell('A2');
    leftLogoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Center Title Text: Columns C to G (Rows 2, 3, 4)
    worksheet.mergeCells('C2:G2');
    const hqCell = worksheet.getCell('C2');
    hqCell.value = letterhead.headquarters || 'H E A D Q U A R T E R S';
    hqCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF003E1D' } };
    hqCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('C3:G3');
    const unitCell = worksheet.getCell('C3');
    unitCell.value = letterhead.unitName || 'CARAGA STATE UNIVERSITY MAIN CAMPUS ROTC UNIT (ACTIVATED)';
    unitCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
    unitCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('C4:G4');
    const cmdCell = worksheet.getCell('C4');
    cmdCell.value = `${letterhead.parentCommand || '1501 (ADN), 15TH (CARAGA) RCDG, ARESCOM'} • ${letterhead.location || 'Ampayon, Butuan City'}`;
    cmdCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    cmdCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2-4: Right Logo (H2:I4)
    worksheet.mergeCells('H2:I4');
    const rightLogoCell = worksheet.getCell('H2');
    rightLogoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Embed Logos if loaded
    if (leftLogoId !== null) {
      try {
        worksheet.addImage(leftLogoId, {
          tl: { col: 0.2, row: 1.1 },
          br: { col: 1.8, row: 3.9 },
          editAs: 'oneCell'
        });
      } catch (_) { }
    }

    if (rightLogoId !== null) {
      try {
        worksheet.addImage(rightLogoId, {
          tl: { col: 7.2, row: 1.1 },
          br: { col: 8.8, row: 3.9 },
          editAs: 'oneCell'
        });
      } catch (_) { }
    }

    // Row 5: Sheet Title Banner (A5:I5)
    worksheet.mergeCells('A5:I5');
    const titleCell = worksheet.getCell('A5');
    titleCell.value = titleBanner.toUpperCase();
    titleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006633' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 6: Subtitle info line (A6:I6)
    worksheet.mergeCells('A6:I6');
    const subCell = worksheet.getCell('A6');
    subCell.value = subInfo;
    subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 7: Spacer
    worksheet.addRow([]);
    worksheet.getRow(7).height = 10;

    let runningIndex = 1;

    // ── Build Battalion > Company > Platoon Blocks ──
    bnEntries.forEach(([bnName, companyMap]) => {
      // Calculate Battalion Total Strength
      let bnTotalCadets = 0;
      companyMap.forEach(pltMap => {
        pltMap.forEach(list => { bnTotalCadets += list.length; });
      });

      // Battalion Level Header Banner (Merged A:I, Centered, #006633 fill, bold white font)
      const bnRow = worksheet.addRow([` ${bnName.toUpperCase()}`]);
      worksheet.mergeCells(`A${bnRow.number}:I${bnRow.number}`);
      bnRow.height = 28;
      const bnCell = bnRow.getCell(1);
      bnCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006633' } };
      bnCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      bnCell.alignment = { horizontal: 'center', vertical: 'middle' };
      bnCell.border = {
        top: { style: 'medium', color: { argb: 'FF004D26' } },
        bottom: { style: 'medium', color: { argb: 'FF004D26' } },
        left: { style: 'medium', color: { argb: 'FF004D26' } },
        right: { style: 'medium', color: { argb: 'FF004D26' } }
      };

      // Sort companies: Alpha -> Bravo -> Charlie -> Delta
      const sortedCompanies = Array.from(companyMap.keys()).sort((a, b) => {
        const coOrder = ['alpha', 'bravo', 'charlie', 'delta'];
        const aIdx = coOrder.findIndex(c => a.toLowerCase().includes(c));
        const bIdx = coOrder.findIndex(c => b.toLowerCase().includes(c));
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        return a.localeCompare(b);
      });

      sortedCompanies.forEach(companyName => {
        const platoonMap = companyMap.get(companyName);

        // Compute Company Strength
        let companyCadets = [];
        platoonMap.forEach(list => companyCadets.push(...list));

        // ── 1. SECTION BANNER ROW: COMPANY NAME (Merged A:I, Centered, #006633 fill, bold white font) ──
        const compRow = worksheet.addRow([`${companyName.toUpperCase()}`]);
        worksheet.mergeCells(`A${compRow.number}:I${compRow.number}`);
        compRow.height = 26;
        const compCell = compRow.getCell(1);
        compCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006633' } };
        compCell.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FFFFFFFF' } };
        compCell.alignment = { horizontal: 'center', vertical: 'middle' };
        compCell.border = {
          top: { style: 'medium', color: { argb: 'FF004D26' } },
          bottom: { style: 'thin', color: { argb: 'FF004D26' } },
          left: { style: 'medium', color: { argb: 'FF004D26' } },
          right: { style: 'medium', color: { argb: 'FF004D26' } }
        };

        // Sort Platoons (1st -> 2nd -> 3rd -> 4th)
        const sortedPlatoons = Array.from(platoonMap.keys()).sort((a, b) => {
          const aNum = parseInt(a, 10) || 99;
          const bNum = parseInt(b, 10) || 99;
          return aNum - bNum;
        });

        sortedPlatoons.forEach(platoonName => {
          const platoonCadets = platoonMap.get(platoonName);

          // ── 2. SUB-HEADER: PLATOON NAME (Merged A:I, Centered, #008040 fill, bold white font) ──
          const pltRow = worksheet.addRow([`${platoonName.toUpperCase()}`]);
          worksheet.mergeCells(`A${pltRow.number}:I${pltRow.number}`);
          pltRow.height = 22;
          const pltCell = pltRow.getCell(1);
          pltCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008040' } };
          pltCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
          pltCell.alignment = { horizontal: 'center', vertical: 'middle' };
          pltCell.border = {
            top: { style: 'thin', color: { argb: 'FF006633' } },
            bottom: { style: 'thin', color: { argb: 'FF006633' } },
            left: { style: 'thin', color: { argb: 'FF006633' } },
            right: { style: 'thin', color: { argb: 'FF006633' } }
          };

          // ── 3. STANDARD COLUMNS TABLE HEADERS: ROTC Forest Green (#006633 background with white text) ──
          const tableHeaderRow = worksheet.addRow(STANDARD_CADET_COLUMNS.map(col => col.header));
          tableHeaderRow.height = 24;
          tableHeaderRow.eachCell(cell => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF006633' } // Forest Green #006633
            };
            cell.font = {
              name: 'Arial',
              size: 9.5,
              bold: true,
              color: { argb: 'FFFFFFFF' } // White text
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF004D26' } },
              bottom: { style: 'thin', color: { argb: 'FF004D26' } },
              left: { style: 'thin', color: { argb: 'FF004D26' } },
              right: { style: 'thin', color: { argb: 'FF004D26' } }
            };
          });

          // ── 4. CADET ROWS IN PLATOON BLOCK ──
          if (isTemplate) {
            // Sort existing registered cadets under this platoon alphabetically by Last Name, First Name
            const sortedRegistered = [...platoonCadets].sort((a, b) =>
              (a.lastName || '').localeCompare(b.lastName || '') ||
              (a.firstName || '').localeCompare(b.firstName || '')
            );

            let slotIndex = 1;

            // 4a. Populate registered cadets under their assigned Platoon first
            sortedRegistered.forEach(cadet => {
              const rowData = [
                slotIndex,
                cadet.id,
                cadet.lastName,
                cadet.firstName,
                cadet.middleInitial,
                cadet.contactNumber || '—',
                cadet.gender,
                cadet.department,
                cadet.program
              ];

              const cRow = worksheet.addRow(rowData);
              cRow.height = 20;

              const isEven = slotIndex % 2 === 0;

              cRow.eachCell((cell, colNum) => {
                cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF111827' } };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFFFFFFF' }
                };
                cell.border = {
                  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };

                // Alignments
                if (colNum === 1 || colNum === 2 || colNum === 5 || colNum === 6 || colNum === 7 || colNum === 8 || colNum === 9) {
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else {
                  cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                }

                // Row index # styling
                if (colNum === 1) {
                  cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
                }
                // Bold ID & Cadet Name
                if (colNum === 2) {
                  cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF064E2E' } };
                }
                if (colNum === 3 || colNum === 4) {
                  cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF111827' } };
                }
              });

              slotIndex++;
            });

            // 4b. Fill any remaining slots up to 37 with numbered blank rows
            for (let rowIdx = slotIndex; rowIdx <= 37; rowIdx++) {
              const rowData = [
                rowIdx,         // Col 1: # (rowIdx up to 37)
                '',             // Col 2: Cadet ID (blank for user entry)
                '',             // Col 3: Last Name (blank for user entry)
                '',             // Col 4: First Name (blank for user entry)
                '',             // Col 5: Middle Initial (blank for user entry)
                '',             // Col 6: Contact Number (blank for user entry)
                '',             // Col 7: Gender (blank for user entry)
                '',             // Col 8: Department (blank for user entry)
                ''              // Col 9: Academic Program (blank for user entry)
              ];

              const cRow = worksheet.addRow(rowData);
              cRow.height = 20;

              const isEven = rowIdx % 2 === 0;

              cRow.eachCell((cell, colNum) => {
                cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF111827' } };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFFFFFFF' }
                };
                cell.border = {
                  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };

                // Alignments
                if (colNum === 1 || colNum === 2 || colNum === 5 || colNum === 6 || colNum === 7 || colNum === 8 || colNum === 9) {
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else {
                  cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                }

                // Row index # styling
                if (colNum === 1) {
                  cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
                }
              });
            }
          } else {
            // Live Roster Export: Output actual registered cadet records
            platoonCadets.forEach(cadet => {
              const rowData = [
                runningIndex++,
                cadet.id,
                cadet.lastName,
                cadet.firstName,
                cadet.middleInitial,
                cadet.contactNumber || '—',
                cadet.gender,
                cadet.department,
                cadet.program
              ];

              const cRow = worksheet.addRow(rowData);
              cRow.height = 20;

              const isEven = runningIndex % 2 === 0;

              cRow.eachCell((cell, colNum) => {
                cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF111827' } };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFFFFFFF' }
                };
                cell.border = {
                  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                  right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };

                // Alignments
                if (colNum === 1 || colNum === 2 || colNum === 5 || colNum === 6 || colNum === 7 || colNum === 8 || colNum === 9) {
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else {
                  cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                }

                // Bold ID & Cadet Name
                if (colNum === 2) {
                  cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF064E2E' } };
                }
                if (colNum === 3 || colNum === 4) {
                  cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF111827' } };
                }
              });
            });
          }

          // Small spacer row after each platoon block
          const spacerRow = worksheet.addRow([]);
          spacerRow.height = 8;
        });

        // Medium spacer row after each company block
        const compSpacer = worksheet.addRow([]);
        compSpacer.height = 12;
      });
    });
  };

  // ── 1. Create Master Roster Sheet (All Echelons) ──
  const masterSheet = workbook.addWorksheet(isTemplate ? 'Registration Template' : 'Master Cadet Ledger');
  const allEntries = Array.from(hierarchy.entries());
  const subInfo = isTemplate
    ? `Official Cadet Registration Template | Pre-filled Existing Cadets (${normalizedCadets.length} Registered) | 37 Cadet Slots Per Platoon`
    : `Complete Cadet Ledger | Total Enrolled: ${normalizedCadets.length} Cadets | Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  buildRosterWorksheet(
    masterSheet,
    sheetTitle,
    subInfo,
    allEntries
  );

  // ── 2. Create Dedicated Sheets for Each Battalion ──
  allEntries.forEach(([bnName, companyMap]) => {
    const cleanBnName = bnName.replace(' Battalion', ' Bn');
    const bnSheet = workbook.addWorksheet(cleanBnName.slice(0, 31));
    let bnCount = 0;
    companyMap.forEach(pltMap => { pltMap.forEach(list => { bnCount += list.length; }); });

    const bnSub = isTemplate
      ? `${bnName} | Registration Template (Pre-filled Existing Cadets + Up to 37 Slots per Platoon)`
      : `${bnName} | Total Strength: ${bnCount} Cadets | ROTC Formative Record`;

    buildRosterWorksheet(
      bnSheet,
      `${bnName.toUpperCase()} ${isTemplate ? 'REGISTRATION TEMPLATE' : 'CADET LEDGER'}`,
      bnSub,
      [[bnName, companyMap]]
    );
  });

  // ── 3. Write Buffer & Trigger File Download ──
  const defaultFile = isTemplate
    ? 'CSU_ROTC_Cadet_Registration_Template.xlsx'
    : `CSU_ROTC_Cadet_Roster_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const finalFilename = customFilename || defaultFile;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
  saveAs(blob, finalFilename);

  return { success: true, filename: finalFilename, count: normalizedCadets.length };
}

/**
 * Dynamic Cadet Template Downloader:
 * Generates an Excel workbook with official letterhead, centered unit section banners,
 * pre-fills existing registered cadets queried from Supabase under their assigned platoon,
 * and fills any remaining slots up to 37 with numbered blank rows strictly across 9 columns:
 * #, Cadet ID, Last Name, First Name, Middle Initial, Contact Number, Gender, Department, Academic Program.
 */
export async function downloadDynamicCadetTemplate(options = {}) {
  return exportCadetRosterToExcel(options.cadets || [], {
    ...options,
    isTemplate: true,
    filename: options.filename || 'CSU_ROTC_Cadet_Registration_Template.xlsx',
    sheetTitle: options.sheetTitle || 'CSU ROTC Cadet Registration Template'
  });
}


