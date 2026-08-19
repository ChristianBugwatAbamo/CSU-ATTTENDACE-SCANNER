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

export const DEFAULT_LETTERHEAD = {
  headquarters: 'HEADQUARTERS 1501st (CSU) COMMUNITY DEFENSE CENTER',
  parentCommand: '15th Regional Community Defense Group, Reserve Command, Philippine Army',
  unitName: 'CSU ROTC UNIT (1501st CDC)',
  location: 'Caraga State University, Ampayon, Butuan City',
  leftLogoUrl: '/csu-logo.png',
  rightLogoUrl: '/rotc-seal-transparent.png'
};

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
 * Helper to process Base64 Data URLs or asset URLs into ExcelJS image IDs
 */
async function addLogoToWorkbook(workbook, logoInput) {
  if (!logoInput || typeof logoInput !== 'string' || !logoInput.trim()) return null;
  try {
    if (logoInput.startsWith('data:image/')) {
      const match = logoInput.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg') ext = 'jpeg';
        else ext = 'png';

        return workbook.addImage({
          base64: match[2],
          extension: ext
        });
      }
    } else {
      // Fetch public asset path
      const res = await fetch(logoInput);
      if (res.ok) {
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        const ext = logoInput.toLowerCase().endsWith('.jpg') || logoInput.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png';
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
 * Generates and downloads an Excel attendance report workbook with:
 * - Hierarchical Nested Grouping: Company Banner (#003E1D) -> Platoon Banner (#008037) -> Table Headers (#005A2B) -> Cadet Rows
 * - Left Logo in Columns A-B (Rows 1-3)
 * - Center Header Text in Columns C-H (Rows 1-3)
 * - Right Logo in Columns I-J (Rows 1-3)
 * - Multi-sheet tabs structured cleanly
 */
export async function exportAttendanceToExcel(records = [], sessionName = 'Field Formation Session', customLetterhead = null) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CSU ROTC Admin HQ';
  workbook.lastModifiedBy = 'CSU ROTC Admin HQ';
  workbook.created = new Date();
  workbook.modified = new Date();

  const letterhead = customLetterhead || getActiveLetterhead();
  const cutoffTime = getActiveFormationCutoff();
  const dateStr = new Date().toISOString().split('T')[0];
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Load and add Left & Right Logos to workbook
  const leftLogoId = await addLogoToWorkbook(workbook, letterhead.leftLogoUrl);
  const rightLogoId = await addLogoToWorkbook(workbook, letterhead.rightLogoUrl);

  // Pre-process records into enriched attendance rows
  const enrichedRecords = records.map((log, idx) => {
    const echelon = getScannedUnitEchelon(log);
    const isOfficer = log.battalion === 'CADET OFFICERS' ||
      log.type === 'Cadet Officer' ||
      (log.rank && (log.rank.includes('1CL') || log.rank.includes('2CL') || log.rank.includes('3CL') || log.rank.includes('4CL') || log.rank.includes('ASPIRANT')));

    const timeInTimestamp = log.timeIn || (log.scanMode !== 'Time-Out' ? log.timestamp : null);
    const timeOutTimestamp = log.timeOut || (log.scanMode === 'Time-Out' ? log.timestamp : null);

    const hasValidTimeIn = Boolean(timeInTimestamp && String(timeInTimestamp).trim());
    const hasValidTimeOut = Boolean(timeOutTimestamp && String(timeOutTimestamp).trim());

    const timeInStatus = hasValidTimeIn
      ? evaluateSingleScan({ timestamp: timeInTimestamp, scanMode: 'Time-In' }, cutoffTime)
      : 'ABSENT';

    let finalStatus = 'ABSENT';
    if (hasValidTimeIn && hasValidTimeOut) {
      finalStatus = timeInStatus === 'LATE' ? 'LATE' : 'PRESENT';
    } else if (hasValidTimeIn && !hasValidTimeOut) {
      finalStatus = timeInStatus === 'LATE' ? 'LATE / NO TIME-OUT' : 'NO TIME-OUT';
    } else if (!hasValidTimeIn && hasValidTimeOut) {
      finalStatus = 'NO TIME-IN';
    } else {
      finalStatus = 'ABSENT';
    }

    const timeInFormatted = hasValidTimeIn ? new Date(timeInTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    const timeOutFormatted = hasValidTimeOut ? new Date(timeOutTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

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

    // 2. Set precise Row Heights for header rows 1-3
    worksheet.getRow(1).height = 22;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 22;

    // 3. Merge Left Logo Cells A1:B3
    worksheet.mergeCells('A1:B3');
    const leftLogoCell = worksheet.getCell('A1');
    leftLogoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 4. Center Header Text: Columns C to H (Rows 1, 2, 3)
    // Row 1: Headquarters Line
    worksheet.mergeCells('C1:H1');
    const hqCell = worksheet.getCell('C1');
    hqCell.value = letterhead.headquarters || 'HEADQUARTERS 1501st (CSU) COMMUNITY DEFENSE CENTER';
    hqCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF003E1D' } };
    hqCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Parent Command Line
    worksheet.mergeCells('C2:H2');
    const cmdCell = worksheet.getCell('C2');
    cmdCell.value = letterhead.parentCommand || '15th Regional Community Defense Group, Reserve Command, Philippine Army';
    cmdCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    cmdCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Unit Name & Location Line
    worksheet.mergeCells('C3:H3');
    const unitCell = worksheet.getCell('C3');
    unitCell.value = `${letterhead.unitName || 'CSU ROTC UNIT (1501st CDC)'} • ${letterhead.location || 'Ampayon, Butuan City'}`;
    unitCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    unitCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 5. Merge Right Logo Cells I1:J3
    worksheet.mergeCells('I1:J3');
    const rightLogoCell = worksheet.getCell('I1');
    rightLogoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 6. Embed Left Logo with exact two-cell bounds inside A1:B3
    if (leftLogoId !== null) {
      worksheet.addImage(leftLogoId, {
        tl: { col: 0.1, row: 0.1 },
        br: { col: 1.9, row: 2.9 },
        editAs: 'oneCell'
      });
    }

    // 7. Embed Right Logo with exact two-cell bounds inside I1:J3
    if (rightLogoId !== null) {
      worksheet.addImage(rightLogoId, {
        tl: { col: 8.1, row: 0.1 },
        br: { col: 9.9, row: 2.9 },
        editAs: 'oneCell'
      });
    }

    // 8. Row 4: Sheet Echelon Title Banner (Columns A-J)
    worksheet.mergeCells('A4:J4');
    const titleCell = worksheet.getCell('A4');
    titleCell.value = `ATTENDANCE MASTER RECORD: ${sheetTitle.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003E1D' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(4).height = 24;

    // 9. Row 5: Sub-information (Session, Formation Cutoff, Date)
    worksheet.mergeCells('A5:J5');
    const subCell = worksheet.getCell('A5');
    subCell.value = `${subtitleInfo} | Cutoff: ${cutoffTime} | Date: ${formattedDate}`;
    subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(5).height = 18;

    // 10. Row 6: Empty Spacer Row
    worksheet.addRow([]);
    worksheet.getRow(6).height = 10;

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
      const compPresent = compCadets.filter(c => c.finalStatus === 'PRESENT').length;
      const compLate = compCadets.filter(c => c.finalStatus === 'LATE').length;

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
        const pltPresent = platoonCadets.filter(c => c.finalStatus === 'PRESENT').length;
        const pltLate = platoonCadets.filter(c => c.finalStatus === 'LATE').length;

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
  const presentTotal = enrichedRecords.filter(r => r.finalStatus === 'PRESENT').length;
  const lateTotal = enrichedRecords.filter(r => r.finalStatus === 'LATE').length;
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
    const echPresent = echelonRecords.filter(r => r.finalStatus === 'PRESENT').length;
    const echLate = echelonRecords.filter(r => r.finalStatus === 'LATE').length;

    buildHierarchicalSheet(
      echelonSheet,
      sheetName,
      `Strength: ${echelonRecords.length} Cadets | Present: ${echPresent} | Late: ${echLate}`,
      echelonRecords
    );
  });

  // 4. Generate binary buffer & trigger download with file-saver
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `ROTC_Attendance_${dateStr}.xlsx`;
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
