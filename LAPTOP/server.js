const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const EXCEL_DIR = path.join(__dirname, 'desktop_excel_reports');
const CADETS_FILE = path.join(DATA_DIR, 'cadets.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(EXCEL_DIR)) fs.mkdirSync(EXCEL_DIR, { recursive: true });

const DEFAULT_SETTINGS = {
  formationCutoffTime: "07:30",
  formationTardyGrace: 15,
  cadetQuotaPerPlatoon: 37,
  commandingOfficer: "LTC RYAN L MARCELO INF (GSC) PA",
  commandingOfficerTitle: "Commandant, CSU ROTC Unit",
  unitName: "1501st CDC ROTC Unit",
  parentCommand: "15th RCDG, ARESCOM, Philippine Army",
  hostInstitution: "Caraga State University (CSU Main Campus, Ampayon, Butuan City)",
  exportDirectory: "desktop_excel_reports",
  autoBackupEnabled: true
};

function getSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_) {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// First names and Filipino Surnames bank for realistic roster generation
const SURNAMES = [
  'DELA CRUZ', 'SANTOS', 'REYES', 'GARCIA', 'TORRES', 'FLORES', 'BAUTISTA', 'MENDOZA', 'RAMOS', 'CASTILLO',
  'GONZALES', 'VILLANUEVA', 'AQUINO', 'NAVARRO', 'FERNANDEZ', 'LOPEZ', 'MARTINEZ', 'PEREZ', 'CRUZ', 'SANCHEZ',
  'RAMIREZ', 'DIAZ', 'RODRIGUEZ', 'ALVAREZ', 'GOMEZ', 'VALDEZ', 'SORIANO', 'DELOS REYES', 'MORALES', 'ESTRADA',
  'SALAZAR', 'PASCUAL', 'MERCADO', 'ABRIOL', 'ABAMO', 'BUGWAT', 'MANALO', 'ILAGAN', 'PANGANIBAN', 'DOMINGO',
  'HERRERA', 'OCAMPO', 'CORTEZ', 'SERRANO', 'AGUILAR', 'ESPIRITU', 'CORPUZ', 'DE GUZMAN', 'VILLAR', 'CUSTODIO'
];

const FIRST_NAMES = [
  'JUAN', 'MARIA', 'PEDRO', 'ANA', 'LUIS', 'CARLA', 'MARK', 'CLARA', 'DANIEL', 'ELENA',
  'ARTH', 'ROSA', 'JOSE', 'KATHLEEN', 'MICHAEL', 'ANGELA', 'GABRIEL', 'BEATRICE', 'CHRISTIAN', 'JASMINE',
  'ALEXANDER', 'SARAH', 'PAULO', 'DIANA', 'RENZ', 'PATRICIA', 'JOSHUA', 'MAE', 'KEVIN', 'GRACE',
  'ADRIAN', 'NICOLE', 'VINCENT', 'DENISE', 'FRANCIS', 'JOYCE', 'CARLO', 'PRINCESS', 'RAFAEL', 'CAMILLE'
];

const MIDDLE_INITIALS = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'P.', 'R.', 'S.', 'T.', 'V.'];

// Generator for the complete 1,184 Cadets Echelon Hierarchy
// 1 Brigade HQ + 2 Battalions + 4 Companies/Bn (Alpha, Bravo, Charlie, Delta) + 4 Platoons/Coy (1st, 2nd, 3rd, 4th) x 37 cadets = 1,184 Cadets
function generateFullEchelonRoster() {
  const roster = [];

  // 1. Cadet Officers (Key Staff & Commanders)
  const cadetOfficers = [
    { id: "221-00101", name: "BAUTISTA, MARK G.", rank: "Cadet COL (ROTC) 1CL", battalion: "CADET OFFICERS", company: "1CL", platoon: "Officer Corps", type: "Cadet Officer", designation: "Corps Commander" },
    { id: "221-00102", name: "MENDOZA, CLARA H.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "CADET OFFICERS", company: "1CL", platoon: "Officer Corps", type: "Cadet Officer", designation: "Deputy Commander" },
    { id: "221-00103", name: "RAMOS, DANIEL I.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", type: "Cadet Officer", designation: "S1 Brigade" },
    { id: "221-00104", name: "CASTILLO, ELENA J.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", type: "Cadet Officer", designation: "S2 Brigade" },
    { id: "221-00105", name: "GONZALES, ARTH K.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", type: "Cadet Officer", designation: "S3 Brigade" },
    { id: "221-00106", name: "VILLANUEVA, ROSA L.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", type: "Cadet Officer", designation: "S4 Brigade" },
    { id: "221-00107", name: "ABAMO, CHRISTIAN B.", rank: "Cadet CPT (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", type: "Cadet Officer", designation: "S7 Brigade" },
    { id: "221-00108", name: "AQUINO, JOSHUA D.", rank: "Cadet CPT (ROTC) 3CL", battalion: "CADET OFFICERS", company: "3CL", platoon: "Officer Corps", type: "Cadet Officer", designation: "Adjutant" },
    // Battalion Commanders
    { id: "221-00109", name: "NAVARRO, MICHAEL E.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "1st Battalion", company: "Headquarters", platoon: "Battalion Staff", type: "Cadet Officer", designation: "1st Bn Commander" },
    { id: "221-00110", name: "FERNANDEZ, GABRIEL F.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "2nd Battalion", company: "Headquarters", platoon: "Battalion Staff", type: "Cadet Officer", designation: "2nd Bn Commander" }
  ];

  cadetOfficers.forEach(staff => roster.push(staff));

  // 2. Generate 1,184 Basic Cadets (2 Battalions x 4 Companies x 4 Platoons x 37 Cadets)
  const battalions = ['1st Battalion', '2nd Battalion'];
  const companies = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
  const platoons = ['1st Platoon', '2nd Platoon', '3rd Platoon', '4th Platoon'];
  const CADETS_PER_PLATOON = 37;

  let cadetNumber = 1001;

  battalions.forEach((bn, bnIdx) => {
    companies.forEach((co, coIdx) => {
      platoons.forEach((pl, plIdx) => {
        for (let i = 1; i <= CADETS_PER_PLATOON; i++) {
          const surname = SURNAMES[(cadetNumber * 7 + i * 13) % SURNAMES.length];
          const firstName = FIRST_NAMES[(cadetNumber * 11 + i * 17) % FIRST_NAMES.length];
          const mi = MIDDLE_INITIALS[(cadetNumber + i) % MIDDLE_INITIALS.length];
          
          // Generate 5-digit formatted ID: 221-BN CO PL XX
          const idNum = `${(bnIdx + 1)}${(coIdx + 1)}${(plIdx + 1)}${String(i).padStart(2, '0')}`;
          const formattedId = `221-${idNum}`;

          roster.push({
            id: formattedId,
            name: `${surname}, ${firstName} ${mi}`,
            rank: "Cadet",
            battalion: bn,
            company: co,
            platoon: pl,
            type: "Basic Cadet",
            designation: i === 1 ? "Platoon Guide" : (i === 2 ? "Squad Leader" : "N/A")
          });

          cadetNumber++;
        }
      });
    });
  });

  return roster;
}

function getCadets() {
  if (!fs.existsSync(CADETS_FILE)) {
    const defaultRoster = generateFullEchelonRoster();
    fs.writeFileSync(CADETS_FILE, JSON.stringify(defaultRoster, null, 2));
    return defaultRoster;
  }
  try {
    const raw = fs.readFileSync(CADETS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaultRoster = generateFullEchelonRoster();
      fs.writeFileSync(CADETS_FILE, JSON.stringify(defaultRoster, null, 2));
      return defaultRoster;
    }
    return parsed;
  } catch (err) {
    const defaultRoster = generateFullEchelonRoster();
    return defaultRoster;
  }
}

function saveCadets(cadets) {
  fs.writeFileSync(CADETS_FILE, JSON.stringify(cadets, null, 2));
}

function getAttendanceLogs() {
  if (!fs.existsSync(ATTENDANCE_FILE)) {
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const raw = fs.readFileSync(ATTENDANCE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveAttendanceLogs(logs) {
  fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(logs, null, 2));
}

// Write/Append to Multi-Sheet Excel Report organized by [Battalion] - [Company] - [Platoon]
async function exportToExcel(records, sessionName = "Drill Session") {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `ROTC_Attendance_${dateStr}.xlsx`;
  const filePath = path.join(EXCEL_DIR, filename);

  let workbook = new ExcelJS.Workbook();
  const activeSettings = getSettings();
  const cutoffStr = activeSettings.morningCutoffTime || activeSettings.formationCutoffTime || "07:30";

  function parseTimeToMinutes(input) {
    if (!input && input !== 0) return NaN;
    if (input instanceof Date) {
      if (isNaN(input.getTime())) return NaN;
      return input.getHours() * 60 + input.getMinutes();
    }
    if (typeof input === 'number') {
      const d = new Date(input > 1e11 ? input : input * 1000);
      if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
    }
    const str = String(input).trim();
    if (!str) return NaN;
    const ampmMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = parseInt(ampmMatch[2], 10);
      const meridiem = ampmMatch[4].toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    const timeOnlyMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnlyMatch) {
      const h = parseInt(timeOnlyMatch[1], 10);
      const m = parseInt(timeOnlyMatch[2], 10);
      return h * 60 + m;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
    const fallbackMatch = str.match(/(\d{1,2}):(\d{2})/);
    if (fallbackMatch) {
      const h = parseInt(fallbackMatch[1], 10);
      const m = parseInt(fallbackMatch[2], 10);
      return h * 60 + m;
    }
    return NaN;
  }

  const parsedCutoff = parseTimeToMinutes(cutoffStr);
  const cutoffMins = isNaN(parsedCutoff) ? 450 : parsedCutoff;

  // Enrich records with normalized echelons and evaluated status
  const enrichedRows = records.map((rec) => {
    const cid = String(rec.cadetId || rec.id || '').trim().toUpperCase();
    const isOfficer = rec.battalion === 'CADET OFFICERS' ||
      rec.type === 'Cadet Officer' ||
      (rec.rank && (rec.rank.includes('1CL') || rec.rank.includes('2CL') || rec.rank.includes('3CL') || rec.rank.includes('4CL') || rec.rank.includes('ASPIRANT')));

    let directBn = rec.battalion && rec.battalion !== 'N/A' ? rec.battalion : '1st Battalion';
    if (isOfficer && !directBn.includes('Battalion')) {
      directBn = 'CADET OFFICERS';
    }
    const directCo = rec.company && rec.company !== 'N/A' ? rec.company : 'Alpha Company';
    const directPl = rec.platoon && rec.platoon !== 'N/A' ? rec.platoon : '1st Platoon';

    let calcStatus = 'PRESENT';
    if (rec.scanMode === 'Time-Out' || (rec.status && String(rec.status).toUpperCase().includes('TIME-OUT'))) {
      calcStatus = 'TIME-OUT';
    } else if (rec.timestamp) {
      const mins = parseTimeToMinutes(rec.timestamp);
      if (!isNaN(mins)) {
        calcStatus = mins > cutoffMins ? 'LATE' : 'PRESENT';
      }
    }

    const timeInRaw = rec.timeIn || (rec.scanMode !== 'Time-Out' ? rec.timestamp : null);
    const timeOutRaw = rec.timeOut || (rec.scanMode === 'Time-Out' ? rec.timestamp : null);

    return {
      cadetId: cid || 'N/A',
      name: (rec.name && rec.name !== 'UNREGISTERED CADET' && rec.name.trim().length > 0) ? rec.name.trim() : (cid ? `CADET ${cid}` : 'CADET'),
      rank: rec.rank || 'Cadet',
      designation: rec.designation || 'None',
      battalion: directBn,
      company: directCo,
      platoon: directPl,
      isOfficer,
      scanMode: rec.scanMode || 'Time-In',
      timeIn: timeInRaw ? new Date(timeInRaw).toLocaleString() : '—',
      timeOut: timeOutRaw ? new Date(timeOutRaw).toLocaleString() : '—',
      timestamp: rec.timestamp ? new Date(rec.timestamp).toLocaleString() : new Date().toLocaleString(),
      sessionName: rec.sessionName || sessionName,
      dutyOfficer: rec.dutyOfficer || rec.d || 'Duty Officer',
      status: rec.finalDailyStatus || rec.finalStatus || calcStatus
    };
  });

  const setupSheet = (worksheet, title) => {
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'CSU ROTC UNIT (1501st CDC) - ATTENDANCE MASTER REPORT';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E2E' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells('A2:J2');
    const subTitle = worksheet.getCell('A2');
    subTitle.value = `${title} | Cutoff: ${cutoffStr} | Generated: ${new Date().toLocaleString()}`;
    subTitle.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF334155' } };
    subTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 20;

    const headers = ['#', 'Cadet ID', 'Cadet Name', 'Rank', 'Battalion', 'Company', 'Platoon', 'Time-In', 'Time-Out', 'Status'];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005A36' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });
  };

  const populateRows = (worksheet, rows) => {
    rows.forEach((rec, i) => {
      const dataRow = worksheet.addRow([
        i + 1,
        rec.cadetId,
        rec.name,
        rec.rank,
        rec.battalion,
        rec.company,
        rec.platoon,
        rec.timeIn,
        rec.timeOut,
        rec.status
      ]);
      dataRow.height = 20;

      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 || colNumber === 2 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 9 || colNumber === 10 ? 'center' : 'left'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colNumber === 10) {
          const st = String(rec.status || '').toUpperCase();
          if (st.includes('PRESENT')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF065F46' } };
          } else if (st.includes('LATE') && !st.includes('NO TIME-OUT')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
          } else if (st.includes('NO TIME-OUT') || st.includes('INCOMPLETE')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
            cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF9A3412' } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
          }
        }
      });
    });

    worksheet.columns = [
      { width: 6 },
      { width: 14 },
      { width: 26 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 22 }
    ];
  };

  // 1. Master Summary Sheet
  const masterSheet = workbook.addWorksheet('Master Summary');
  setupSheet(masterSheet, 'All Units Master Summary');
  populateRows(masterSheet, enrichedRows);

  // 2. Separate Sheets individually organized by [Company] - [Platoon]
  const echelonGroups = new Map();
  enrichedRows.forEach(r => {
    let sheetName = 'Cadet Officers';
    if (!r.isOfficer && r.battalion !== 'CADET OFFICERS') {
      const coCode = r.company.replace(' Company', '').trim();
      const plCode = r.platoon.includes('1') ? '1st Platoon' : r.platoon.includes('2') ? '2nd Platoon' : r.platoon.includes('3') ? '3rd Platoon' : r.platoon.includes('4') ? '4th Platoon' : r.platoon;
      sheetName = `${coCode} Co - ${plCode}`.slice(0, 31);
    }
    if (!echelonGroups.has(sheetName)) {
      echelonGroups.set(sheetName, []);
    }
    echelonGroups.get(sheetName).push(r);
  });

  echelonGroups.forEach((rows, name) => {
    const ws = workbook.addWorksheet(name);
    setupSheet(ws, `Unit: ${name}`);
    populateRows(ws, rows);
  });

  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Multi-Sheet Excel Report saved: ${filePath}`);
  return filename;
}

// API Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', service: 'CSU ROTC Admin HQ Server', time: new Date() });
});

// Cadets CRUD
app.get('/api/cadets', (req, res) => {
  res.json(getCadets());
});

// Generate / Reset Complete 1,184 Cadets Echelon Hierarchy Roster
app.post('/api/cadets/generate-hierarchy-roster', (req, res) => {
  const fullRoster = generateFullEchelonRoster();
  saveCadets(fullRoster);
  res.json({
    success: true,
    totalCadets: fullRoster.length,
    message: `Generated complete CSU ROTC Echelon Roster: 2 Battalions, 8 Companies, 32 Platoons (${fullRoster.length} Cadets total with 37 cadets/platoon).`
  });
});

app.post('/api/cadets', (req, res) => {
  const cadets = getCadets();
  const newCadet = req.body;

  if (!newCadet.id || !newCadet.name) {
    return res.status(400).json({ error: "Cadet ID and Name are required." });
  }

  newCadet.name = newCadet.name.trim().toUpperCase();
  if (cadets.some(c => c.id === newCadet.id)) {
    return res.status(400).json({ error: `Cadet ID ${newCadet.id} already exists!` });
  }

  if (newCadet.type === 'Basic Cadet') {
    newCadet.rank = 'Cadet';
    newCadet.designation = newCadet.designation || 'N/A';
  }

  cadets.push(newCadet);
  saveCadets(cadets);
  res.json({ success: true, cadet: newCadet, message: "Cadet registered successfully." });
});

app.put('/api/cadets/:id', (req, res) => {
  const { id } = req.params;
  let cadets = getCadets();
  const index = cadets.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Cadet not found." });
  }

  const updated = { ...cadets[index], ...req.body };
  updated.name = updated.name.trim().toUpperCase();
  if (updated.type === 'Basic Cadet') {
    updated.rank = 'Cadet';
  }

  cadets[index] = updated;
  saveCadets(cadets);
  res.json({ success: true, cadet: updated, message: "Cadet updated successfully." });
});

app.delete('/api/cadets/:id', (req, res) => {
  const { id } = req.params;
  let cadets = getCadets();
  const initialLength = cadets.length;
  cadets = cadets.filter(c => c.id !== id);

  if (cadets.length === initialLength) {
    return res.status(404).json({ error: "Cadet not found." });
  }

  saveCadets(cadets);
  res.json({ success: true, message: "Cadet removed from roster." });
});

// Mobile Sync Endpoint with Ingestion Duty Officer & Timestamp Updates
app.post('/api/sync', async (req, res) => {
  try {
    const { dutyOfficer, sessionName, records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No records received in sync payload." });
    }

    const cadets = getCadets();
    const cadetMap = new Map(cadets.map(c => [c.id, c]));

    let currentLogs = [...getAttendanceLogs()];
    let updatedCount = 0;
    let newCount = 0;
    const recordsForExcel = [];

    for (const rec of records) {
      const cid = String(rec.cadetId || '').trim().toUpperCase();
      if (!cid) continue;

      const scanDateStr = rec.timestamp ? new Date(rec.timestamp).toDateString() : new Date().toDateString();
      const scanMode = rec.scanMode || 'Time-In';
      const effectiveDO = dutyOfficer || rec.dutyOfficer || 'Duty Officer';
      const effectiveSession = sessionName || rec.sessionName || 'Training Session';

      const match = cadetMap.get(rec.cadetId) || cadetMap.get(cid);
      const enriched = {
        ...rec,
        cadetId: cid,
        name: match ? match.name : (rec.name || 'UNREGISTERED CADET'),
        rank: match ? match.rank : (rec.rank || 'Cadet'),
        battalion: match ? match.battalion : (rec.battalion || '1st Battalion'),
        company: match ? match.company : (rec.company || 'N/A'),
        platoon: match ? match.platoon : (rec.platoon || 'N/A'),
        designation: match ? match.designation : (rec.designation || 'N/A'),
        dutyOfficer: effectiveDO,
        sessionName: effectiveSession,
        scanMode: scanMode,
        timestamp: rec.timestamp || new Date().toISOString(),
        receivedAt: new Date().toISOString()
      };

      // Check if Cadet already has an entry today for this scanMode
      const existingIndex = currentLogs.findIndex(l => {
        const dStr = l.timestamp ? new Date(l.timestamp).toDateString() : '';
        const lCid = String(l.cadetId || '').trim().toUpperCase();
        const lMode = l.scanMode || (String(l.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');
        return lCid === cid && dStr === scanDateStr && lMode === scanMode;
      });

      if (existingIndex !== -1) {
        // OVERWRITE: Update Duty Officer, timestamp, session details, and receivedAt
        currentLogs[existingIndex] = {
          ...currentLogs[existingIndex],
          dutyOfficer: enriched.dutyOfficer,
          timestamp: enriched.timestamp,
          sessionName: enriched.sessionName,
          status: enriched.status || currentLogs[existingIndex].status,
          receivedAt: new Date().toISOString()
        };
        updatedCount++;
        recordsForExcel.push(currentLogs[existingIndex]);
      } else {
        // NEW RECORD: Insert to front of list
        currentLogs.unshift(enriched);
        newCount++;
        recordsForExcel.push(enriched);
      }
    }

    saveAttendanceLogs(currentLogs);
    const filename = await exportToExcel(recordsForExcel, sessionName);

    console.log(`[SYNC INGESTION] Received: ${records.length} | Ingested: ${newCount} new, ${updatedCount} updated to Duty Officer "${dutyOfficer || 'Duty Officer'}".`);

    res.json({
      success: true,
      count: newCount,
      updated: updatedCount,
      totalLogs: currentLogs.length,
      filename: filename,
      message: `Synced ${records.length} records (${newCount} new, ${updatedCount} updated to Duty Officer "${dutyOfficer || 'Duty Officer'}").`
    });
  } catch (err) {
    console.error("Sync processing error:", err);
    res.status(500).json({ error: "Internal server error during sync.", details: err.message });
  }
});

// Attendance Logs & Excel Reports Endpoints
app.get('/api/attendance', (req, res) => {
  res.json(getAttendanceLogs());
});

app.delete('/api/attendance', (req, res) => {
  try {
    const { type, cadetId, battalion, company, platoon } = req.query || req.body || {};
    let logs = getAttendanceLogs();

    if (type === 'CADET' && cadetId) {
      const cIdNorm = String(cadetId).trim().toUpperCase();
      logs = logs.filter(l => String(l.cadetId || l.id || '').trim().toUpperCase() !== cIdNorm);
      saveAttendanceLogs(logs);
      console.log(`[RESET] Cleared cadet ${cadetId} from Master Attendance Logs.`);
      return res.json({ success: true, message: `Cadet ${cadetId} attendance removed.` });
    }

    if (type === 'PLATOON' && (platoon || company || battalion)) {
      logs = logs.filter(l => {
        const matchBn = battalion ? String(l.battalion || '').toLowerCase().includes(String(battalion).toLowerCase()) : true;
        const matchCo = company ? String(l.company || '').toLowerCase().includes(String(company).toLowerCase()) : true;
        const matchPl = platoon ? String(l.platoon || '').toLowerCase().includes(String(platoon).toLowerCase()) : true;
        return !(matchBn && matchCo && matchPl);
      });
      saveAttendanceLogs(logs);
      console.log(`[RESET] Cleared platoon ${platoon || company || battalion} from Master Attendance Logs.`);
      return res.json({ success: true, message: `Platoon attendance removed.` });
    }

    // Default: Clear All
    saveAttendanceLogs([]);
    console.log('[RESET] Master Attendance Logs cleared by admin.');
    res.json({ success: true, message: 'Master Attendance Logs cleared successfully.' });
  } catch (err) {
    console.error('Error clearing attendance logs:', err);
    res.status(500).json({ error: 'Failed to clear attendance logs.' });
  }
});

app.post('/api/reports/save-direct', async (req, res) => {
  try {
    const { records, sessionName } = req.body;
    if (Array.isArray(records) && records.length > 0) {
      const filename = await exportToExcel(records, sessionName || 'Field Formation Session');
      res.json({ success: true, filename });
    } else {
      res.status(400).json({ error: 'No records provided for export.' });
    }
  } catch (err) {
    console.error('Error saving direct report:', err);
    res.status(500).json({ error: 'Failed to save report to server.' });
  }
});

app.get('/api/reports', (req, res) => {
  try {
    const files = fs.readdirSync(EXCEL_DIR).filter(f => f.endsWith('.xlsx'));
    const reports = files.map(f => {
      const stats = fs.statSync(path.join(EXCEL_DIR, f));
      return {
        filename: f,
        size: stats.size,
        modifiedAt: stats.mtime
      };
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: "Could not read reports directory." });
  }
});

app.get('/api/reports/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Report file not found.");
  }
  res.download(filePath);
});

// System Settings API Endpoints
app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', (req, res) => {
  try {
    const updated = { ...getSettings(), ...req.body };
    saveSettings(updated);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to save settings." });
  }
});

// Database Backup and Restore Endpoints
app.get('/api/backup', (req, res) => {
  try {
    const backupPayload = {
      exportTimestamp: new Date().toISOString(),
      systemVersion: "1.0.0",
      settings: getSettings(),
      cadetRoster: getCadets(),
      attendanceLogs: getAttendanceLogs()
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=CSU_ROTC_DATABASE_BACKUP_${new Date().toISOString().slice(0, 10)}.json`);
    res.json(backupPayload);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate backup." });
  }
});

app.post('/api/backup/restore', (req, res) => {
  try {
    const { cadetRoster, cadets, attendanceLogs, settings } = req.body;
    const restoredCadets = cadetRoster || cadets;
    if (Array.isArray(restoredCadets) && restoredCadets.length > 0) {
      fs.writeFileSync(CADETS_FILE, JSON.stringify(restoredCadets, null, 2));
    }
    if (Array.isArray(attendanceLogs)) {
      saveAttendanceLogs(attendanceLogs);
    }
    if (settings && typeof settings === 'object') {
      saveSettings(settings);
    }
    res.json({ success: true, message: "Database restored successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore database: " + err.message });
  }
});

app.post('/api/roster/reset', (req, res) => {
  try {
    const defaultRoster = generateFullEchelonRoster();
    fs.writeFileSync(CADETS_FILE, JSON.stringify(defaultRoster, null, 2));
    res.json({ success: true, count: defaultRoster.length, message: "Cadet roster reset to default template." });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset cadet roster." });
  }
});

// Serve Smartphone scanner web app statically under /mobile
const smartphoneDist = path.join(__dirname, '..', 'SMARTPHONE', 'dist');
if (fs.existsSync(smartphoneDist)) {
  app.use('/mobile', express.static(smartphoneDist));
  app.get('/mobile/*', (req, res) => {
    res.sendFile(path.join(smartphoneDist, 'index.html'));
  });
}

// Serve Desktop static files if built
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routing
app.get('*', (req, res) => {
  if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>CSU ROTC Admin HQ Server</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #064e2e; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { background: rgba(255,255,255,0.1); padding: 2rem; border-radius: 12px; border: 1px solid #e5a900; max-width: 500px; }
          h1 { color: #e5a900; margin-top: 0; }
          code { background: #005a36; padding: 4px 8px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>CSU ROTC Admin HQ Server</h1>
          <p>Local Backend Server is running on port <code>8080</code></p>
          <p>Sync API Endpoint: <code>POST /api/sync</code></p>
          <p>Mobile Web Scanner: <a href="/mobile" style="color:#e5a900">/mobile</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 CSU ROTC Admin HQ Server running on port ${PORT}`);
  console.log(`📡 Local Sync Endpoint: http://localhost:${PORT}/api/sync`);
  console.log(`📱 Mobile Web Scanner: http://localhost:${PORT}/mobile`);
  console.log(`📁 Excel Reports Directory: ${EXCEL_DIR}`);
  console.log(`====================================================`);
});
