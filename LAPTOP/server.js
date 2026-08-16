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

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(EXCEL_DIR)) fs.mkdirSync(EXCEL_DIR, { recursive: true });

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

  // 1. Brigade HQ Staff Officers (12 Key Staff)
  const brigadeStaff = [
    { id: "221-00101", name: "BAUTISTA, MARK G.", rank: "Cadet COL (ROTC) 1CL", battalion: "Brigade HQ", company: "Headquarters", platoon: "Brigade Staff", type: "Cadet Officer", designation: "Corps Commander" },
    { id: "221-00102", name: "MENDOZA, CLARA H.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "Brigade HQ", company: "Headquarters", platoon: "Brigade Staff", type: "Cadet Officer", designation: "Deputy Commander" },
    { id: "221-00103", name: "RAMOS, DANIEL I.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "Brigade HQ", company: "Headquarters", platoon: "Brigade Staff", type: "Cadet Officer", designation: "S1 Brigade" },
    { id: "221-00104", name: "CASTILLO, ELENA J.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "Brigade HQ", company: "Headquarters", platoon: "Brigade Staff", type: "Cadet Officer", designation: "S2 Brigade" },
    { id: "221-00105", name: "GONZALES, ARTH K.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "Brigade HQ", company: "Headquarters", platoon: "Brigade Staff", type: "Cadet Officer", designation: "S3 Brigade" },
    { id: "221-00106", name: "VILLANUEVA, ROSA L.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "Brigade HQ", company: "Headquarters", platoon: "Brigade Staff", type: "Cadet Officer", designation: "S4 Brigade" },
    { id: "221-00107", name: "ABAMO, CHRISTIAN B.", rank: "Cadet CPT (ROTC) 2CL", battalion: "Brigade HQ", company: "Headquarters", platoon: "Brigade Staff", type: "Cadet Officer", designation: "S7 Brigade" },
    { id: "221-00108", name: "AQUINO, JOSHUA D.", rank: "Cadet CPT (ROTC) 3CL", battalion: "Brigade HQ", company: "Headquarters", platoon: "Brigade Staff", type: "Cadet Officer", designation: "Adjutant" },
    // Battalion Commanders
    { id: "221-00109", name: "NAVARRO, MICHAEL E.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "1st Battalion", company: "Headquarters", platoon: "Battalion Staff", type: "Cadet Officer", designation: "1st Bn Commander" },
    { id: "221-00110", name: "FERNANDEZ, GABRIEL F.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "2nd Battalion", company: "Headquarters", platoon: "Battalion Staff", type: "Cadet Officer", designation: "2nd Bn Commander" }
  ];

  brigadeStaff.forEach(staff => roster.push(staff));

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

// Write/Append to Excel Report
async function exportToExcel(records, sessionName = "Drill Session") {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `ROTC_Attendance_${dateStr}.xlsx`;
  const filePath = path.join(EXCEL_DIR, filename);

  let workbook = new ExcelJS.Workbook();
  let worksheet;

  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
    worksheet = workbook.getWorksheet('Attendance Log') || workbook.addWorksheet('Attendance Log');
  } else {
    worksheet = workbook.addWorksheet('Attendance Log');
    
    // Set Header Info
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'CSU ROTC UNIT (1501st CDC) - ATTENDANCE MASTER REPORT';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E2E' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells('A2:L2');
    const subTitle = worksheet.getCell('A2');
    subTitle.value = `Unit Target Strength: 1,184 Cadets (37/Pltn) | Generated: ${new Date().toLocaleString()} | Session: ${sessionName}`;
    subTitle.font = { name: 'Arial', size: 10, italic: true };
    subTitle.alignment = { horizontal: 'center', vertical: 'middle' };

    // Column Headers
    const headers = ['#', 'Cadet ID', 'Cadet Name', 'Battalion', 'Company', 'Platoon', 'Rank', 'Designation', 'Scan Timestamp', 'Session Name', 'Duty Officer', 'Status'];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 24;
    
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005A36' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  }

  // Find next row index
  let startRow = worksheet.lastRow ? worksheet.lastRow.number + 1 : 4;

  records.forEach((rec, idx) => {
    const directName = (rec.name && rec.name !== 'UNREGISTERED CADET' && rec.name.trim().length > 0)
      ? rec.name.trim()
      : (rec.cadetId ? `CADET ${rec.cadetId}` : 'CADET');
    const directBn = rec.battalion && rec.battalion !== 'N/A' ? rec.battalion : '1st Battalion';
    const directCo = rec.company && rec.company !== 'N/A' ? rec.company : 'Alpha Company';
    const directPl = rec.platoon && rec.platoon !== 'N/A' ? rec.platoon : '1st Platoon';

    // Calculate Late vs Present based on formation cutoff (default 07:00 AM)
    let calcStatus = rec.status;
    if (!calcStatus) {
      if (rec.scanMode === 'Time-Out') {
        calcStatus = 'TIME-OUT';
      } else if (rec.timestamp) {
        const d = new Date(rec.timestamp);
        const mins = d.getHours() * 60 + d.getMinutes();
        const cutoffMins = 7 * 60; // 07:00 AM default
        calcStatus = mins > cutoffMins ? 'LATE' : 'PRESENT';
      } else {
        calcStatus = 'PRESENT';
      }
    }

    const rowValues = [
      startRow - 3 + idx,
      rec.cadetId || rec.id || 'N/A',
      directName,
      directBn,
      directCo,
      directPl,
      rec.rank || 'Cadet',
      rec.designation || 'None',
      rec.timestamp ? new Date(rec.timestamp).toLocaleString() : new Date().toLocaleString(),
      rec.sessionName || sessionName,
      rec.dutyOfficer || rec.d || 'Duty Officer',
      calcStatus
    ];
    
    const row = worksheet.addRow(rowValues);
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 || colNumber === 2 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 12 ? 'center' : 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };

      // Highlight Status column (col 12)
      if (colNumber === 12) {
        if (calcStatus === 'LATE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light amber
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB45309' } };
        } else if (calcStatus === 'PRESENT') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Light emerald
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
        }
      }
    });
  });

  // Auto column widths
  worksheet.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value ? cell.value.toString().length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 35);
  });

  await workbook.xlsx.writeFile(filePath);
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

// Mobile Sync Endpoint
app.post('/api/sync', async (req, res) => {
  try {
    const { dutyOfficer, sessionName, records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No records received in sync payload." });
    }

    const cadets = getCadets();
    const cadetMap = new Map(cadets.map(c => [c.id, c]));

    const enrichedRecords = records.map(rec => {
      const match = cadetMap.get(rec.cadetId);
      return {
        ...rec,
        name: match ? match.name : (rec.name || 'UNREGISTERED CADET'),
        rank: match ? match.rank : (rec.rank || 'Cadet'),
        battalion: match ? match.battalion : (rec.battalion || '1st Battalion'),
        company: match ? match.company : (rec.company || 'N/A'),
        platoon: match ? match.platoon : (rec.platoon || 'N/A'),
        designation: match ? match.designation : (rec.designation || 'N/A'),
        dutyOfficer: dutyOfficer || rec.dutyOfficer || 'Duty Officer',
        sessionName: sessionName || rec.sessionName || 'Training Session',
        receivedAt: new Date().toISOString()
      };
    });

    const currentLogs = getAttendanceLogs();
    const updatedLogs = [...enrichedRecords, ...currentLogs];
    saveAttendanceLogs(updatedLogs);

    const filename = await exportToExcel(enrichedRecords, sessionName);

    console.log(`[SYNC RECEIVED] ${enrichedRecords.length} records processed from ${dutyOfficer || 'Mobile Officer'}.`);

    res.json({
      success: true,
      count: enrichedRecords.length,
      filename: filename,
      message: `Successfully synced ${enrichedRecords.length} records and exported to Excel (${filename}).`
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
    saveAttendanceLogs([]);
    console.log('[RESET] Master Attendance Logs cleared by admin.');
    res.json({ success: true, message: 'Master Attendance Logs cleared successfully.' });
  } catch (err) {
    console.error('Error clearing attendance logs:', err);
    res.status(500).json({ error: 'Failed to clear attendance logs.' });
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
