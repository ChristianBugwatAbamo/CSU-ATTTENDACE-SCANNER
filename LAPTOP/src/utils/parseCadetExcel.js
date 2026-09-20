/**
 * ============================================================================
 * ROTC BULK CADET EXCEL & CSV UPLOAD PARSER & DATA NORMALIZER
 * parseCadetExcel.js
 * 
 * Stateful parser for cadet rosters and registration templates.
 * Tracks active echelons:
 *   - currentBattalion (e.g., '1ST BATTALION', '2ND BATTALION')
 *   - currentCompany   (e.g., 'ALPHA COMPANY', 'BRAVO COMPANY')
 *   - currentPlatoon   (e.g., '1ST PLATOON', '2ND PLATOON')
 * 
 * Whenever an echelon banner row is encountered in the spreadsheet, the parser
 * updates the active state and automatically attaches those values to every
 * cadet row read under that section.
 * 
 * Normalization guardrails:
 *   - Automatic Auto-Capitalization: Text fields (last_name, first_name,
 *     middle_initial, gender, department, academic_program, battalion,
 *     company, platoon) are strictly converted to .toUpperCase().trim().
 *   - Gender Normalization: Flexible inputs (male, m, female, f, etc.)
 *     standardized to 'MALE' or 'FEMALE'.
 *   - Clean Middle Initial: Trailing periods and stray spaces stripped
 *     (e.g. 'G.' or 'g' becomes 'G').
 *   - Clean ID / Contact: Spaces trimmed from student_id and contact_number.
 *   - Strictly handles the 9-column roster layout:
 *     #, Cadet ID, Last Name, First Name, Middle Initial, Contact Number,
 *     Gender, Department, Academic Program
 * 
 * Safely skips empty template slots (such as the 37 pre-numbered blank rows)
 * and letterhead / title banner rows.
 * ============================================================================
 */

import * as XLSX from 'xlsx';

// ── Clean Middle Initial ──
export const cleanMiddleInitial = (miStr) => {
  if (!miStr) return '';
  const cleaned = String(miStr)
    .replace(/\./g, '')
    .replace(/[^a-zA-ZñÑ]/g, '')
    .trim()
    .toUpperCase();
  return cleaned ? cleaned.slice(0, 1) : '';
};

// ── Gender Normalizer ──
export const normalizeGender = (genderStr) => {
  const s = String(genderStr || '').trim().toLowerCase();
  if (s === 'f' || s.startsWith('fem') || s.includes('female') || s === 'woman' || s === 'w') {
    return 'FEMALE';
  }
  return 'MALE';
};

// ── Echelon Normalizers (UPPERCASE) ──
export const normalizeBattalion = (bnStr) => {
  const s = String(bnStr || '').trim().toLowerCase();
  if (/\b(2nd|second)\b/i.test(s) || /\b2\s*(nd)?\s*(battalion|bn)\b/i.test(s)) return '2ND BATTALION';
  return '1ST BATTALION';
};

export const normalizeCompany = (coyStr) => {
  const s = String(coyStr || '').trim().toLowerCase();
  if (s.includes('bravo')) return 'BRAVO COMPANY';
  if (s.includes('charlie')) return 'CHARLIE COMPANY';
  if (s.includes('delta')) return 'DELTA COMPANY';
  if (s.includes('echo')) return 'ECHO COMPANY';
  if (s.includes('foxtrot')) return 'FOXTROT COMPANY';
  return 'ALPHA COMPANY';
};

export const normalizePlatoon = (pltStr) => {
  const s = String(pltStr || '').trim().toLowerCase();
  if (/\b(2nd|second)\b/i.test(s) || /\b2\s*(nd)?\s*(platoon|plt|pltn)\b/i.test(s)) return '2ND PLATOON';
  if (/\b(3rd|third)\b/i.test(s) || /\b3\s*(rd)?\s*(platoon|plt|pltn)\b/i.test(s)) return '3RD PLATOON';
  if (/\b(4th|fourth)\b/i.test(s) || /\b4\s*(th)?\s*(platoon|plt|pltn)\b/i.test(s)) return '4TH PLATOON';
  return '1ST PLATOON';
};

// ── Banner Check Matchers ──
export const isBattalionBanner = (text) => {
  const s = String(text || '').trim();
  if (!s) return false;
  return (
    /\b(1st|2nd|3rd|4th|first|second)\s*(battalion|bn)\b/i.test(s) ||
    /\bbattalion\s*echelon\b/i.test(s) ||
    /^\s*(1st|2nd|3rd|4th)\s+bn\b/i.test(s)
  );
};

export const isCompanyBanner = (text) => {
  const s = String(text || '').trim();
  if (!s) return false;
  return /\b(alpha|bravo|charlie|delta|echo|foxtrot)\s*(company|coy|co)?\b/i.test(s);
};

export const isPlatoonBanner = (text) => {
  const s = String(text || '').trim();
  if (!s) return false;
  return /\b(1st|2nd|3rd|4th|1|2|3|4)\s*(st|nd|rd|th)?\s*(platoon|plt|pltn)\b/i.test(s);
};

// ── Title & Letterhead Noise Check ──
export const isTitleOrLetterheadRow = (text) => {
  const s = String(text || '').trim();
  if (!s) return true;
  const upper = s.toUpperCase();
  return (
    upper.includes('CDC ROTC UNIT') ||
    upper.includes('ROTC UNIT') ||
    upper.includes('HEADQUARTERS') ||
    upper.includes('H E A D Q U A R T E R S') ||
    upper.includes('TEMPLATE') ||
    upper.includes('ARMY 2040') ||
    upper.includes('CARAGA STATE UNIVERSITY') ||
    upper.includes('ARESCOM') ||
    upper.includes('RCDG') ||
    upper.includes('CADET LEDGER') ||
    upper.includes('MASTER CADET') ||
    upper.includes('OFFICIAL CADET REGISTRATION') ||
    upper.includes('PRE-FILLED UNIT ECHELONS') ||
    upper.includes('AMPAYON') ||
    upper.includes('CSUROTCU') ||
    upper.includes('DEPARTMENT OF MILITARY SCIENCE') ||
    upper.includes('OFFICE OF') ||
    upper.includes('COMMAND') ||
    /\b(cdc rotc unit|rotc unit|headquarters|template|battalion echelon)\b/i.test(s)
  );
};

// ── Column Index Mapping ──
const DEFAULT_COLUMN_MAP = {
  index: 0,
  student_id: 1,
  last_name: 2,
  first_name: 3,
  middle_initial: 4,
  contact_number: 5,
  gender: 6,
  department: 7,
  academic_program: 8
};

export const detectHeaderRow = (rowCells) => {
  if (!Array.isArray(rowCells) || rowCells.length === 0) return null;
  const normalized = rowCells.map(c => String(c || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

  const hasId = normalized.some(c => c === 'id' || c.includes('cadetid') || c.includes('studentid') || c.includes('studentno'));
  const hasName = normalized.some(c => c.includes('lastname') || c.includes('surname') || c.includes('firstname'));

  if (hasId || hasName) {
    const colMap = { ...DEFAULT_COLUMN_MAP };
    normalized.forEach((clean, idx) => {
      if (['studentid', 'cadetid', 'id', 'studentno', 'cadetno'].includes(clean)) colMap.student_id = idx;
      else if (['lastname', 'last', 'surname', 'familyname'].includes(clean)) colMap.last_name = idx;
      else if (['firstname', 'first', 'givenname', 'fname'].includes(clean)) colMap.first_name = idx;
      else if (['middleinitial', 'mi', 'middle', 'middlename'].includes(clean)) colMap.middle_initial = idx;
      else if (['contactnumber', 'contact', 'phone', 'phonenumber', 'mobile', 'cellphone', 'contactno'].includes(clean)) colMap.contact_number = idx;
      else if (['gender', 'sex'].includes(clean)) colMap.gender = idx;
      else if (['department', 'dept', 'college'].includes(clean)) colMap.department = idx;
      else if (['academicprogram', 'program', 'course', 'degree'].includes(clean)) colMap.academic_program = idx;
      else if (['battalion', 'bn'].includes(clean)) colMap.battalion = idx;
      else if (['company', 'coy'].includes(clean)) colMap.company = idx;
      else if (['platoon', 'plt'].includes(clean)) colMap.platoon = idx;
      else if (['#', 'no', 'num', 'index'].includes(clean)) colMap.index = idx;
    });
    return colMap;
  }
  return null;
};

/**
 * Parses raw 2D row array maintaining stateful echelon tracking and uppercase normalizations.
 * 
 * @param {Array<Array<any>>} rows2D - 2D matrix of row cells from Excel sheet or CSV
 * @param {Object} [initialEchelons] - Optional initial defaults
 * @returns {Array<Object>} List of parsed cadet record objects with attached echelons
 */
export function parseCadetRows(rows2D = [], initialEchelons = {}) {
  let currentBattalion = (initialEchelons.battalion ? normalizeBattalion(initialEchelons.battalion) : '1ST BATTALION').toUpperCase().trim();
  let currentCompany = (initialEchelons.company ? normalizeCompany(initialEchelons.company) : 'ALPHA COMPANY').toUpperCase().trim();
  let currentPlatoon = (initialEchelons.platoon ? normalizePlatoon(initialEchelons.platoon) : '1ST PLATOON').toUpperCase().trim();

  let activeColMap = { ...DEFAULT_COLUMN_MAP };
  let hasEncounteredHeader = false;
  const parsedCadets = [];

  for (let rowIndex = 0; rowIndex < rows2D.length; rowIndex++) {
    const row = rows2D[rowIndex];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Join non-empty row cells for banner / letterhead evaluation
    const nonBlankCells = row.map(c => String(c !== null && c !== undefined ? c : '').trim()).filter(Boolean);
    if (nonBlankCells.length === 0) continue;

    const rowText = nonBlankCells.join(' ');

    // ── 1. Check for Echelon Banner Rows ──
    let isBanner = false;

    // Check Platoon banner first to avoid greedy match if platoon text mentions company
    const isPlt = isPlatoonBanner(rowText);
    const isCoy = isCompanyBanner(rowText);
    const isBn = isBattalionBanner(rowText);

    if (isBn) {
      currentBattalion = normalizeBattalion(rowText).toUpperCase().trim();
      currentPlatoon = '1ST PLATOON';
      isBanner = true;
    }
    if (isCoy) {
      currentCompany = normalizeCompany(rowText).toUpperCase().trim();
      currentPlatoon = '1ST PLATOON';
      isBanner = true;
    }
    if (isPlt) {
      currentPlatoon = normalizePlatoon(rowText).toUpperCase().trim();
      isBanner = true;
    }

    if (isBanner) {
      continue; // Skip banner row, echelons updated!
    }

    // ── 2. Check for Table Header Row ──
    const detectedMap = detectHeaderRow(row);
    if (detectedMap) {
      activeColMap = detectedMap;
      hasEncounteredHeader = true;
      continue; // Skip header row
    }

    // ── 3. Check for Letterhead Noise / Title Banners / Echelon Rows ──
    // Header rows containing CDC ROTC UNIT, HEADQUARTERS, TEMPLATE, BATTALION, COMPANY, or PLATOON
    // are strictly ignored before student validation runs.
    if (!hasEncounteredHeader) {
      continue;
    }

    const rowUpper = rowText.toUpperCase();
    const hasHeaderKeywords =
      rowUpper.includes('CDC ROTC UNIT') ||
      rowUpper.includes('ROTC UNIT') ||
      rowUpper.includes('HEADQUARTERS') ||
      rowUpper.includes('TEMPLATE') ||
      rowUpper.includes('BATTALION') ||
      rowUpper.includes('COMPANY') ||
      rowUpper.includes('PLATOON');

    if (isTitleOrLetterheadRow(rowText) || (hasHeaderKeywords && !row[activeColMap.student_id])) {
      continue;
    }

    // ── 4. Extract Cadet Cell Values ──
    const getCell = (colIdx) => {
      if (colIdx === undefined || colIdx === null || colIdx < 0 || colIdx >= row.length) return '';
      return String(row[colIdx] !== null && row[colIdx] !== undefined ? row[colIdx] : '').trim();
    };

    const studentIdRaw = getCell(activeColMap.student_id);
    const lastNameRaw = getCell(activeColMap.last_name);
    const firstNameRaw = getCell(activeColMap.first_name);
    const middleInitialRaw = getCell(activeColMap.middle_initial);
    const contactRaw = getCell(activeColMap.contact_number);
    const genderRaw = getCell(activeColMap.gender);
    const deptRaw = getCell(activeColMap.department);
    const progRaw = getCell(activeColMap.academic_program);

    // Optional explicit echelon columns if present in legacy/flat files
    const explicitBn = activeColMap.battalion !== undefined ? getCell(activeColMap.battalion) : '';
    const explicitCoy = activeColMap.company !== undefined ? getCell(activeColMap.company) : '';
    const explicitPlt = activeColMap.platoon !== undefined ? getCell(activeColMap.platoon) : '';

    // ── 5. Filter Blank Template Slots & Header Row Remnants ──
    // The template pre-populates 37 rows per platoon where Col 1 (#) is 1..37 but all other columns are blank.
    // If student_id, last_name, and first_name are ALL blank, ignore this empty slot!
    if (!studentIdRaw && !lastNameRaw && !firstNameRaw) {
      continue;
    }

    // Safety guard: If student_id or last_name contains header / title keywords, skip
    const nameUpper = String(lastNameRaw || '').toUpperCase();
    const idUpper = String(studentIdRaw || '').toUpperCase();
    if (
      isTitleOrLetterheadRow(nameUpper) ||
      isTitleOrLetterheadRow(idUpper) ||
      nameUpper.includes('CDC ROTC UNIT') ||
      nameUpper.includes('HEADQUARTERS') ||
      nameUpper.includes('TEMPLATE') ||
      nameUpper.includes('BATTALION') ||
      nameUpper.includes('COMPANY') ||
      nameUpper.includes('PLATOON')
    ) {
      continue;
    }

    // ── 6. Collect Structured Error Reasons into an Array (errors: []) ──
    const rowErrors = [];
    const cleanId = String(studentIdRaw || '').trim().toUpperCase();
    const ID_RE = /^\d{3}-\d{5}$/;

    if (!cleanId) {
      rowErrors.push('Missing Student ID');
    } else {
      const digits = cleanId.replace(/\D/g, '');
      if (digits.length !== 8 && !ID_RE.test(cleanId)) {
        rowErrors.push(`Invalid ID format: ${cleanId} (Expected XXX-XXXXX)`);
      }
    }

    if (!lastNameRaw) rowErrors.push('Missing Last Name');
    if (!firstNameRaw) rowErrors.push('Missing First Name');
    if (!progRaw) rowErrors.push('Missing Academic Program');

    // Determine final echelons (prefer explicit column if present and non-empty, otherwise use tracked banner echelon)
    const finalBattalion = (explicitBn ? normalizeBattalion(explicitBn) : currentBattalion).toUpperCase().trim();
    const finalCompany = (explicitCoy ? normalizeCompany(explicitCoy) : currentCompany).toUpperCase().trim();
    const finalPlatoon = (explicitPlt ? normalizePlatoon(explicitPlt) : currentPlatoon).toUpperCase().trim();

    parsedCadets.push({
      _sourceRow: rowIndex + 1,
      student_id: cleanId,
      last_name: String(lastNameRaw || '').toUpperCase().trim(),
      first_name: String(firstNameRaw || '').toUpperCase().trim(),
      middle_initial: cleanMiddleInitial(middleInitialRaw),
      contact_number: String(contactRaw || '').trim(),
      gender: normalizeGender(genderRaw),
      department: String(deptRaw || '').toUpperCase().trim(),
      academic_program: String(progRaw || '').toUpperCase().trim(),
      battalion: finalBattalion,
      company: finalCompany,
      platoon: finalPlatoon,
      errors: rowErrors
    });
  }

  return parsedCadets;
}

/**
 * Parses an Excel file (File, Blob, ArrayBuffer, or Uint8Array) or CSV string.
 * Tracks active currentBattalion, currentCompany, and currentPlatoon across banner rows.
 * Automatically capitalizes text fields and standardizes gender and middle initials.
 * 
 * @param {File|Blob|ArrayBuffer|Uint8Array|string} fileInput - Uploaded file or buffer
 * @returns {Promise<Array<Object>>} Array of parsed cadet records
 */
export async function parseCadetExcel(fileInput) {
  if (!fileInput) return [];

  // 1. If already an array of rows or objects
  if (Array.isArray(fileInput)) {
    if (fileInput.length === 0) return [];
    if (Array.isArray(fileInput[0])) {
      return parseCadetRows(fileInput);
    }
    // Array of objects (flat JSON)
    return fileInput.map(row => ({
      ...row,
      student_id: String(row.student_id || row.studentId || row.id || '').trim(),
      last_name: String(row.last_name || row.lastName || '').toUpperCase().trim(),
      first_name: String(row.first_name || row.firstName || '').toUpperCase().trim(),
      middle_initial: cleanMiddleInitial(row.middle_initial || row.middleInitial || ''),
      contact_number: String(row.contact_number || row.contactNumber || row.phone || '').trim(),
      gender: normalizeGender(row.gender),
      department: String(row.department || row.dept || '').toUpperCase().trim(),
      academic_program: String(row.academic_program || row.academicProgram || row.program || row.course || '').toUpperCase().trim(),
      battalion: normalizeBattalion(row.battalion || '1ST BATTALION').toUpperCase().trim(),
      company: normalizeCompany(row.company || 'ALPHA COMPANY').toUpperCase().trim(),
      platoon: normalizePlatoon(row.platoon || '1ST PLATOON').toUpperCase().trim()
    }));
  }

  // 2. Read file or buffer into ArrayBuffer
  let arrayBuffer;
  if (fileInput instanceof ArrayBuffer) {
    arrayBuffer = fileInput;
  } else if (fileInput instanceof Uint8Array) {
    arrayBuffer = fileInput.buffer;
  } else if (typeof Blob !== 'undefined' && fileInput instanceof Blob) {
    arrayBuffer = await fileInput.arrayBuffer();
  } else if (typeof fileInput === 'string') {
    // Might be CSV string or base64
    const workbook = XLSX.read(fileInput, { type: 'string' });
    return parseCadetWorkbook(workbook);
  } else {
    throw new Error('Unsupported file input type for parseCadetExcel');
  }

  // 3. Read Workbook using SheetJS
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  return parseCadetWorkbook(workbook);
}

/**
 * Parses sheets from an XLSX workbook object.
 * Prefers the primary registration template or master sheet, and falls back to
 * checking individual echelon sheets if the primary sheet is empty.
 * 
 * @param {Object} workbook - SheetJS workbook
 * @returns {Array<Object>}
 */
export function parseCadetWorkbook(workbook) {
  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return [];
  }

  // Identify primary sheet (prefer 'Registration Template' or 'Master Cadet Ledger' or 1st sheet)
  const preferredNames = ['registration template', 'master cadet ledger', 'template', 'cadets', 'sheet1'];
  let primarySheetName = workbook.SheetNames[0];

  for (const name of preferredNames) {
    const found = workbook.SheetNames.find(s => s.trim().toLowerCase().includes(name));
    if (found) {
      primarySheetName = found;
      break;
    }
  }

  const primarySheet = workbook.Sheets[primarySheetName];
  if (primarySheet) {
    const rows2D = XLSX.utils.sheet_to_json(primarySheet, { header: 1, defval: '' });
    const cadets = parseCadetRows(rows2D);
    if (cadets.length > 0) {
      return cadets;
    }
  }

  // If primary sheet was empty, iterate through remaining sheets to collect any cadet records
  const allCadets = [];
  const seenIds = new Set();

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === primarySheetName) continue;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows2D = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    // If sheetName suggests an echelon (e.g. '1st Bn', '2nd Bn'), seed it
    const defaultBn = isBattalionBanner(sheetName) ? normalizeBattalion(sheetName) : '1ST BATTALION';
    const sheetCadets = parseCadetRows(rows2D, { battalion: defaultBn });

    sheetCadets.forEach(c => {
      const id = String(c.student_id || '').trim().toUpperCase();
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        allCadets.push(c);
      } else if (!id) {
        allCadets.push(c);
      }
    });
  }

  return allCadets;
}

export default parseCadetExcel;
