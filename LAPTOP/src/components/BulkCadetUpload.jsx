import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Trash2,
  Database,
  Copy,
  Users,
  Info,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import {
  getSupabaseClient,
  MAX_PLATOON_CAPACITY,
  normalizePlatoonParts
} from '../utils/supabaseClient';
import { normalizeCompany } from './BasicCadetRegistration';
import { downloadDynamicCadetTemplate, parseCadetNameComponents } from '../utils/excelExport';
import { parseCadetExcel, parseCadetRows, isTitleOrLetterheadRow } from '../utils/parseCadetExcel';
import { useUnitStructure } from '../context/UnitContext';

// ── Normalize Column Keys ──
const normalizeKey = (key = '') => {
  return String(key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const COLUMN_MAPPINGS = {
  student_id: ['studentid', 'studentno', 'studentnumber', 'id', 'cadetid', 'cadetno', 'student_id', 'cadet_id'],
  last_name: ['lastname', 'last', 'surname', 'familyname', 'last_name'],
  first_name: ['firstname', 'first', 'givenname', 'fname', 'first_name'],
  middle_initial: ['middleinitial', 'mi', 'middle_initial', 'middlename', 'middle'],
  contact_number: ['contactnumber', 'contact', 'phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact_number', 'contact_no', 'cellphone'],
  gender: ['gender', 'sex'],
  department: ['department', 'dept', 'college'],
  academic_program: ['academicprogram', 'program', 'course', 'degree', 'academic_program'],
  battalion: ['battalion', 'bat', 'bn'],
  company: ['company', 'coy', 'comp'],
  platoon: ['platoon', 'plt', 'plat']
};

const resolveField = (row, fieldKey) => {
  const aliases = COLUMN_MAPPINGS[fieldKey] || [fieldKey];
  for (const rawKey of Object.keys(row)) {
    const cleaned = normalizeKey(rawKey);
    if (aliases.some((a) => normalizeKey(a) === cleaned)) {
      return String(row[rawKey] || '').trim();
    }
  }
  return '';
};

// ── Normalize Echelons ──
const normalizeBattalionName = (bnStr) => {
  const s = String(bnStr || '').trim().toLowerCase();
  if (/\b(2nd|second)\b/i.test(s) || /\b2\s*(nd)?\s*(battalion|bn)\b/i.test(s)) return '2nd Battalion';
  return '1st Battalion';
};

const normalizePlatoonName = (pltStr) => {
  const s = String(pltStr || '').trim().toLowerCase();
  if (/\b(2nd|second)\b/i.test(s) || /\b2\s*(nd)?\s*(platoon|plt|pltn)\b/i.test(s)) return '2nd Platoon';
  if (/\b(3rd|third)\b/i.test(s) || /\b3\s*(rd)?\s*(platoon|plt|pltn)\b/i.test(s)) return '3rd Platoon';
  if (/\b(4th|fourth)\b/i.test(s) || /\b4\s*(th)?\s*(platoon|plt|pltn)\b/i.test(s)) return '4th Platoon';
  return '1st Platoon';
};

// ── Format Cadet ID ──
const formatCadetId = (rawId) => {
  if (!rawId) return '';
  const digits = String(rawId).replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return String(rawId).trim().toUpperCase();
};

// ── Deep Comparison: Uploaded Cadet vs Existing Supabase Record ──
const compareCadetWithExisting = (uploaded, existing) => {
  if (!existing) {
    return { isUnchanged: false, changedFields: [] };
  }

  const changedFields = [];
  const cleanStr = (s) => String(s || '').trim().toUpperCase();
  const cleanPhone = (p) => String(p || '').replace(/—|-/g, '').replace(/\D/g, '');
  const cleanGender = (g) => {
    const s = String(g || '').trim().toLowerCase();
    return (s === 'f' || s.startsWith('fem') || s.includes('female') || s === 'w' || s === 'woman') ? 'FEMALE' : 'MALE';
  };

  // 1. Name comparison
  const exParts = parseCadetNameComponents(existing);
  const upParts = parseCadetNameComponents({
    last_name: uploaded.lastName || uploaded.last_name,
    first_name: uploaded.firstName || uploaded.first_name,
    middle_initial: uploaded.middleInitial || uploaded.middle_initial,
    name: uploaded.fullName || uploaded.name
  });

  const exLast = cleanStr(exParts.lastName);
  const upLast = cleanStr(upParts.lastName);
  const exFirst = cleanStr(exParts.firstName);
  const upFirst = cleanStr(upParts.firstName);
  const exMi = cleanStr(exParts.middleInitial).replace(/\./g, '');
  const upMi = cleanStr(upParts.middleInitial).replace(/\./g, '');

  if (exLast !== upLast || exFirst !== upFirst || exMi !== upMi) {
    changedFields.push('Name');
  }

  // 2. Contact Number comparison (compare digits only, ignore template '—' filler)
  const exPhone = cleanPhone(existing.contact_number || existing.contactNumber || existing.phone);
  const upPhone = cleanPhone(uploaded.contact_number || uploaded.contactNumber || uploaded.phone);
  if (exPhone !== upPhone) {
    changedFields.push('Contact #');
  }

  // 3. Gender comparison
  const exGender = cleanGender(existing.gender);
  const upGender = cleanGender(uploaded.gender);
  if (exGender !== upGender) {
    changedFields.push('Gender');
  }

  // 4. Department comparison
  const exDept = cleanStr(existing.department || existing.dept || 'CCIS');
  const upDept = cleanStr(uploaded.department || uploaded.dept || 'CCIS');
  if (exDept !== upDept) {
    changedFields.push('Department');
  }

  // 5. Academic Program comparison
  const exProg = cleanStr(existing.program || existing.academic_program || existing.academicProgram || existing.course || '');
  const upProg = cleanStr(uploaded.program || uploaded.academic_program || uploaded.academicProgram || uploaded.course || '');
  if (exProg && upProg && exProg !== upProg) {
    changedFields.push('Program');
  }

  // 6. Echelon hierarchy comparison (Battalion, Company, Platoon)
  const exBn = normalizeBattalionName(existing.battalion);
  const upBn = normalizeBattalionName(uploaded.battalion);
  const exCoy = normalizeCompany(existing.company);
  const upCoy = normalizeCompany(uploaded.company);
  const exPlt = normalizePlatoonName(existing.platoon);
  const upPlt = normalizePlatoonName(uploaded.platoon);

  if (exBn !== upBn || exCoy !== upCoy || exPlt !== upPlt) {
    changedFields.push('Platoon/Echelon');
  }

  return {
    isUnchanged: changedFields.length === 0,
    changedFields
  };
};

// ── Styled Validation Notes Cell with Badge Icons & +X More Popover ──
function ValidationNotesCell({ notes = [] }) {
  const [isHovered, setIsHovered] = useState(false);

  if (!notes || notes.length === 0) {
    return <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>—</span>;
  }

  const primaryNote = notes[0];
  const hasMultiple = notes.length > 1;

  const renderBadge = (item) => {
    let bg = '#f1f5f9';
    let text = '#475569';
    let border = '#cbd5e1';
    let Icon = CheckCircle2;

    if (item.type === 'DUPLICATE_ID') {
      bg = '#fee2e2';
      text = '#991b1b';
      border = '#fca5a5';
      Icon = Copy;
    } else if (item.type === 'MISSING_FIELDS' || item.type === 'MISSING_ID' || item.type === 'INVALID_ID' || item.category === 'error') {
      bg = '#fee2e2';
      text = '#b91c1c';
      border = '#fecaca';
      Icon = AlertTriangle;
    } else if (item.type === 'CAPACITY_OVERFLOW') {
      bg = '#fef3c7';
      text = '#92400e';
      border = '#fde68a';
      Icon = Users;
    } else if (item.type === 'UPDATE') {
      bg = '#fef3c7';
      text = '#b45309';
      border = '#fde68a';
      Icon = RefreshCw;
    } else if (item.type === 'READY') {
      bg = '#dcfce7';
      text = '#166534';
      border = '#86efac';
      Icon = CheckCircle2;
    } else if (item.type === 'UNCHANGED') {
      bg = '#f1f5f9';
      text = '#475569';
      border = '#cbd5e1';
      Icon = CheckCircle2;
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 700,
          backgroundColor: bg,
          color: text,
          border: `1px solid ${border}`,
          whiteSpace: 'nowrap'
        }}
        title={item.fullText || item.label}
      >
        <Icon size={12} style={{ flexShrink: 0 }} />
        <span>{item.label}</span>
      </span>
    );
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {renderBadge(primaryNote)}

      {hasMultiple && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            padding: '2px 7px',
            borderRadius: '9999px',
            fontSize: '0.70rem',
            fontWeight: 800,
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            userSelect: 'none'
          }}
          title={notes.map((n, i) => `${i + 1}. ${n.fullText || n.label}`).join('\n')}
        >
          +{notes.length - 1} more
        </span>
      )}

      {/* Floating Popover on Hover */}
      {hasMultiple && isHovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '125%',
            left: 0,
            zIndex: 100,
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            padding: '0.65rem 0.85rem',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            minWidth: '250px',
            maxWidth: '360px',
            fontSize: '0.74rem',
            lineHeight: 1.4,
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: '0.35rem', color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            All Validation Notes ({notes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {notes.map((n, idx) => {
              let dotColor = '#94a3b8';
              if (n.category === 'error' || n.type === 'DUPLICATE_ID' || n.type === 'MISSING_FIELDS' || n.type === 'MISSING_ID') dotColor = '#f87171';
              else if (n.category === 'warning' || n.type === 'CAPACITY_OVERFLOW') dotColor = '#fbbf24';
              else if (n.type === 'UPDATE') dotColor = '#fb923c';
              else if (n.type === 'READY') dotColor = '#4ade80';

              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ color: dotColor, fontSize: '0.85rem', lineHeight: '1' }}>•</span>
                  <span style={{ color: '#f1f5f9' }}>{n.fullText || n.label}</span>
                </div>
              );
            })}
          </div>
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '18px',
              borderWidth: '5px',
              borderStyle: 'solid',
              borderColor: '#0f172a transparent transparent transparent'
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function BulkCadetUpload({ cadets = [], onRefresh, onBackToSingle }) {
  const { unitStructure } = useUnitStructure();
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Filter & Search inside Preview Table
  const [tableFilter, setTableFilter] = useState('ALL'); // 'ALL' | 'READY' | 'UPDATE' | 'UNCHANGED' | 'ERROR'
  const [searchQuery, setSearchQuery] = useState('');

  // Batch Insert Execution State
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [saveResult, setSaveResult] = useState(null);

  const fileInputRef = useRef(null);

  // ── Existing Cadets Map for Fast Lookup & Deep Comparison ──
  const existingCadetsMap = useMemo(() => {
    const map = new Map();
    (cadets || []).forEach((c) => {
      const rawId = c.id || c.cadet_id || c.cadetId || '';
      const id = String(rawId).trim().toUpperCase();
      if (id) {
        map.set(id, c);
        const digits = id.replace(/\D/g, '');
        if (digits.length === 8) {
          const formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
          map.set(formatted, c);
        }
      }
    });
    return map;
  }, [cadets]);

  // ── Existing Load per Platoon ──
  const existingPlatoonLoads = useMemo(() => {
    const counts = {};
    cadets.forEach((c) => {
      const isOfficer = c.type === 'Cadet Officer' || /1CL|2CL|3CL|4CL|COL|MAJ|CPT|LT/.test(String(c.rank || ''));
      if (!isOfficer) {
        const parts = normalizePlatoonParts(c.battalion, c.company, c.platoon);
        counts[parts.key] = (counts[parts.key] || 0) + 1;
      }
    });
    return counts;
  }, [cadets]);

  // ── Generate & Download Excel Template ──
  const handleDownloadTemplate = async () => {
    try {
      await downloadDynamicCadetTemplate({
        cadets,
        unitStructure,
        filename: 'CSU_ROTC_Cadet_Registration_Template.xlsx',
        sheetTitle: 'CSU ROTC Cadet Registration Template'
      });
    } catch (err) {
      console.error('Template export error:', err);
      alert('Failed to generate Excel template: ' + err.message);
    }
  };

  // ── Parse Uploaded File ──
  const parseFile = async (file) => {
    if (!file) return;

    setIsParsing(true);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    setSaveResult(null);

    const isCsv = file.name.toLowerCase().endsWith('.csv');

    try {
      if (isCsv) {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const rows2D = results.data || [];
              const parsed = parseCadetRows(rows2D);
              processParsedRows(parsed);
            } catch (err) {
              console.error('CSV parse error:', err);
              alert('Failed to parse CSV file: ' + err.message);
            } finally {
              setIsParsing(false);
            }
          },
          error: (err) => {
            console.error('CSV parse error:', err);
            alert('Failed to parse CSV file: ' + err.message);
            setIsParsing(false);
          }
        });
      } else {
        const cadets = await parseCadetExcel(file);
        processParsedRows(cadets);
        setIsParsing(false);
      }
    } catch (err) {
      console.error('Upload parse error:', err);
      alert('Failed to parse Excel file: ' + err.message);
      setIsParsing(false);
    }
  };

  // ── Validate & Process Parsed Rows ──
  const processParsedRows = (rawRows) => {
    const seenIdsInFile = new Map(); // id -> count
    const projectedPlatoonAdditions = {}; // key -> count

    const processed = rawRows.map((row, index) => {
      const rowNumber = row._sourceRow || (index + 2);

      const rawId = resolveField(row, 'student_id');
      const studentId = formatCadetId(rawId);
      const lastName = resolveField(row, 'last_name').replace(/[^a-zA-Z\s\-ñÑ']/g, '').trim().toUpperCase();
      const firstName = resolveField(row, 'first_name').replace(/[^a-zA-Z\s\-ñÑ']/g, '').trim().toUpperCase();
      const miRaw = resolveField(row, 'middle_initial').replace(/[^a-zA-ZñÑ]/g, '').trim().toUpperCase().slice(0, 1);
      const middleInitial = miRaw ? `${miRaw}.` : '';

      // Guardrail: Safely skip title/letterhead rows or echelon section headers if they slipped through
      const rawLastName = resolveField(row, 'last_name');
      const rawFirstName = resolveField(row, 'first_name');
      if (
        isTitleOrLetterheadRow(rawId) ||
        isTitleOrLetterheadRow(rawLastName) ||
        (!studentId && (isTitleOrLetterheadRow(rawFirstName) || isTitleOrLetterheadRow(resolveField(row, 'department'))))
      ) {
        return null;
      }

      const genderRaw = resolveField(row, 'gender');
      const gender = /female|f\b/i.test(genderRaw) ? 'Female' : 'Male';

      const contactNumber = resolveField(row, 'contact_number').trim();
      const department = resolveField(row, 'department').toUpperCase() || 'CCIS';
      const academicProgram = resolveField(row, 'academic_program').toUpperCase() || '';

      const rawBn = resolveField(row, 'battalion');
      const rawCoy = resolveField(row, 'company');
      const rawPlt = resolveField(row, 'platoon');

      const battalion = normalizeBattalionName(rawBn);
      const company = normalizeCompany(rawCoy);
      const platoon = normalizePlatoonName(rawPlt);

      const fullName = middleInitial
        ? `${lastName}, ${firstName} ${middleInitial}`
        : `${lastName}, ${firstName}`;

      const notes = [];
      const errors = [];
      const warnings = [];

      // Validation 1: Student ID
      const ID_RE = /^\d{3}-\d{5}$/;
      if (!studentId) {
        errors.push('Missing Student ID');
        notes.push({
          type: 'MISSING_ID',
          label: 'Missing Student ID',
          fullText: 'Cadet record is missing required Student ID (Expected XXX-XXXXX)',
          category: 'error'
        });
      } else if (!ID_RE.test(studentId)) {
        errors.push(`Invalid ID format: ${studentId} (Expected XXX-XXXXX)`);
        notes.push({
          type: 'INVALID_ID',
          label: `Invalid ID: ${studentId}`,
          fullText: `Invalid Student ID format: "${studentId}" (Expected XXX-XXXXX)`,
          category: 'error'
        });
      }

      // Validation 2: Missing Required Fields (Last Name, First Name, Academic Program)
      const missingFields = [];
      if (!lastName) missingFields.push('Last Name');
      if (!firstName) missingFields.push('First Name');
      if (!academicProgram) missingFields.push('Academic Program');

      if (missingFields.length > 0) {
        errors.push(`Missing ${missingFields.join(', ')}`);
        notes.push({
          type: 'MISSING_FIELDS',
          label: `Missing: ${missingFields.join(', ')}`,
          fullText: `Missing required field(s): ${missingFields.join(', ')}`,
          category: 'error'
        });
      }

      // Validation 3: Duplicate in File (tracks specific conflicting row)
      if (studentId) {
        const prevSeen = seenIdsInFile.get(studentId);
        if (prevSeen) {
          const msg = `Duplicate ID in upload file (${studentId}) — conflicts with Row ${prevSeen.firstSeenRow}`;
          errors.push(msg);
          notes.push({
            type: 'DUPLICATE_ID',
            label: `Duplicate ID (Row ${prevSeen.firstSeenRow})`,
            fullText: `Duplicate Student ID in file (${studentId}) — conflicts with record on Row ${prevSeen.firstSeenRow}`,
            category: 'error'
          });
          seenIdsInFile.set(studentId, { ...prevSeen, count: prevSeen.count + 1 });
        } else {
          seenIdsInFile.set(studentId, { firstSeenRow: rowNumber, count: 1 });
        }
      }

      // Check against Existing DB Cadets & Deep Compare
      const existingCadet = studentId ? existingCadetsMap.get(studentId) : null;
      const isExistingInDb = Boolean(existingCadet);

      let comparison = { isUnchanged: false, changedFields: [] };
      if (isExistingInDb) {
        comparison = compareCadetWithExisting({
          lastName,
          firstName,
          middleInitial,
          fullName,
          contact_number: contactNumber,
          gender,
          department,
          academic_program: academicProgram,
          battalion,
          company,
          platoon
        }, existingCadet);

        if (comparison.isUnchanged) {
          warnings.push('Record matches database exactly (will skip on save)');
          notes.push({
            type: 'UNCHANGED',
            label: 'Unchanged (Matches DB)',
            fullText: 'Record matches database exactly (will be skipped during bulk import)',
            category: 'neutral'
          });
        } else {
          warnings.push(`Existing cadet will be updated: ${comparison.changedFields.join(', ')}`);
          notes.push({
            type: 'UPDATE',
            label: `Update: ${comparison.changedFields.join(', ')}`,
            fullText: `Existing cadet record will be updated in Supabase: ${comparison.changedFields.join(', ')}`,
            category: 'info'
          });
        }
      }

      // Check Platoon Capacity
      const pltParts = normalizePlatoonParts(battalion, company, platoon);
      const initialDbLoad = existingPlatoonLoads[pltParts.key] || 0;
      const currentBatchAdditions = projectedPlatoonAdditions[pltParts.key] || 0;

      const isAlreadyInSamePlatoon = isExistingInDb && existingCadet && (
        normalizeBattalionName(existingCadet.battalion) === battalion &&
        normalizeCompany(existingCadet.company) === company &&
        normalizePlatoonName(existingCadet.platoon) === platoon
      );

      // Only count towards new platoon additions if not already in that platoon in DB
      if (!isAlreadyInSamePlatoon && errors.length === 0) {
        projectedPlatoonAdditions[pltParts.key] = currentBatchAdditions + 1;
      }

      const totalProjected = initialDbLoad + (isAlreadyInSamePlatoon ? 0 : currentBatchAdditions + 1);
      if (totalProjected > MAX_PLATOON_CAPACITY) {
        warnings.push(`Exceeds platoon capacity (${totalProjected}/${MAX_PLATOON_CAPACITY}) for ${pltParts.label}`);
        notes.push({
          type: 'CAPACITY_OVERFLOW',
          label: `Platoon Over Capacity (${totalProjected}/${MAX_PLATOON_CAPACITY})`,
          fullText: `Exceeds maximum platoon capacity of 37 cadets (${totalProjected}/${MAX_PLATOON_CAPACITY}) for ${pltParts.label}`,
          category: 'warning'
        });
      }

      // Determine Status:
      // - ERROR: Any validation rule failed
      // - UNCHANGED: Existing cadet with identical database fields (will skip on bulk insert)
      // - UPDATE: Existing cadet with modified fields (will update on bulk insert)
      // - READY: New student ID passing all guardrails
      let status = 'READY';
      if (errors.length > 0) {
        status = 'ERROR';
      } else if (isExistingInDb) {
        status = comparison.isUnchanged ? 'UNCHANGED' : 'UPDATE';
      }

      if (status === 'READY' && errors.length === 0 && notes.length === 0) {
        notes.push({
          type: 'READY',
          label: 'Ready to Insert',
          fullText: 'New cadet passes all guardrails and is ready for bulk enrollment',
          category: 'success'
        });
      }

      return {
        rowNumber,
        status,
        errors,
        warnings,
        notes,
        isExistingInDb,
        isUnchanged: comparison.isUnchanged,
        changedFields: comparison.changedFields,
        cadet: {
          id: String(studentId || '').toUpperCase().trim(),
          name: String(fullName || '').toUpperCase().trim(),
          rank: 'Cadet',
          battalion,
          company,
          platoon,
          type: 'Basic Cadet',
          designation: 'N/A',
          gender,
          contact_number: contactNumber,
          department: String(department || 'CCIS').toUpperCase().trim(),
          program: String(academicProgram || '').toUpperCase().trim(),
          course: String(academicProgram || '').toUpperCase().trim(),
          is_active: true
        }
      };
    });

    setFileData(processed.filter(Boolean));
  };

  // ── Drag & Drop Handlers ──
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      parseFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      parseFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setFileData(null);
    setFileName('');
    setFileSize('');
    setSaveResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Filtered Rows & Metric Breakdown ──
  const stats = useMemo(() => {
    if (!fileData) return { total: 0, ready: 0, updates: 0, unchanged: 0, errors: 0 };
    return {
      total: fileData.length,
      ready: fileData.filter((r) => r.status === 'READY').length,
      updates: fileData.filter((r) => r.status === 'UPDATE').length,
      unchanged: fileData.filter((r) => r.status === 'UNCHANGED').length,
      errors: fileData.filter((r) => r.status === 'ERROR').length
    };
  }, [fileData]);

  const displayedRows = useMemo(() => {
    if (!fileData) return [];
    return fileData.filter((r) => {
      // Filter by status
      if (tableFilter === 'READY' && r.status !== 'READY') return false;
      if (tableFilter === 'UPDATE' && r.status !== 'UPDATE') return false;
      if (tableFilter === 'UNCHANGED' && r.status !== 'UNCHANGED') return false;
      if (tableFilter === 'ERROR' && r.status !== 'ERROR') return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = (r.cadet.id || '').toLowerCase().includes(q);
        const nameMatch = (r.cadet.name || '').toLowerCase().includes(q);
        const progMatch = (r.cadet.program || '').toLowerCase().includes(q);
        const coyMatch = (r.cadet.company || '').toLowerCase().includes(q);
        const pltMatch = (r.cadet.platoon || '').toLowerCase().includes(q);
        return idMatch || nameMatch || progMatch || coyMatch || pltMatch;
      }

      return true;
    });
  }, [fileData, tableFilter, searchQuery]);

  // ── Batch Insertion to Supabase ──
  const handleBatchInsert = async () => {
    if (!fileData) return;

    // Only save new cadets (READY) and modified cadets (UPDATE). Unchanged records are skipped!
    const recordsToSave = fileData.filter((r) => r.status === 'READY' || r.status === 'UPDATE');

    if (recordsToSave.length === 0) {
      if (stats.unchanged > 0) {
        alert(`All ${stats.unchanged} cadet records in this file already match the database exactly. There are no new or updated records to import.`);
      } else {
        alert('No valid records to import. Please resolve the errors shown in the table.');
      }
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      alert('Supabase client is not configured. Please check Settings > Cloud Database.');
      return;
    }

    setIsSaving(true);
    setSaveProgress({ current: 0, total: recordsToSave.length });

    const cadetsToUpsert = recordsToSave.map((r) => {
      const c = r.cadet;
      const deptUpper = String(c.department || 'CCIS').toUpperCase().trim();
      const progUpper = String(c.program || c.course || '').toUpperCase().trim();
      return {
        id: String(c.id || '').toUpperCase().trim(),
        name: String(c.name || '').toUpperCase().trim(),
        rank: c.rank || 'Cadet',
        battalion: c.battalion || '1st Battalion',
        company: c.company || 'Alpha Company',
        platoon: c.platoon || '1st Platoon',
        type: c.type || 'Basic Cadet',
        designation: c.designation || 'N/A',
        gender: c.gender || 'Male',
        department: deptUpper,
        program: progUpper,
        course: progUpper,
        contact_number: String(c.contact_number || '').trim(),
        is_active: true
      };
    });
    const BATCH_SIZE = 50;
    let insertedCount = 0;
    let failedCount = 0;
    const errorsList = [];

    try {
      for (let i = 0; i < cadetsToUpsert.length; i += BATCH_SIZE) {
        const chunk = cadetsToUpsert.slice(i, i + BATCH_SIZE);
        const { error } = await client.from('cadets').upsert(chunk, { onConflict: 'id' });

        if (error) {
          console.error('Batch insert error on chunk:', i, error);
          failedCount += chunk.length;
          errorsList.push(error.message);
        } else {
          insertedCount += chunk.length;
        }

        setSaveProgress({ current: Math.min(i + BATCH_SIZE, cadetsToUpsert.length), total: cadetsToUpsert.length });
      }

      setSaveResult({
        success: insertedCount > 0,
        inserted: insertedCount,
        failed: failedCount,
        skippedUnchanged: stats.unchanged,
        errors: errorsList
      });

      if (typeof onRefresh === 'function') {
        onRefresh();
      }
      window.dispatchEvent(new Event('local-attendance-update'));

    } catch (err) {
      console.error('Unexpected batch upload error:', err);
      setSaveResult({
        success: false,
        inserted: insertedCount,
        failed: cadetsToUpsert.length - insertedCount,
        skippedUnchanged: stats.unchanged,
        errors: [err.message]
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* ── Top Info & Template Download Card ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(6, 78, 46, 0.06) 0%, rgba(229, 169, 0, 0.08) 100%)',
          border: '1.5px solid rgba(6, 78, 46, 0.2)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '260px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #064e2e, #005a36)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e5a900',
              flexShrink: 0,
              boxShadow: '0 4px 10px rgba(6, 78, 46, 0.3)'
            }}
          >
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--rotc-green-dark, #064e2e)' }}>
              Bulk Cadet Enrollment (Excel / CSV)
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>
              Upload enrollment sheets to parse, review guardrails, and batch register cadets into Supabase.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #006633',
              color: '#006633',
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 102, 51, 0.06)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            title="Download formatted Excel template (.xlsx) grouped dynamically by Battalion > Company > Platoon with green banners"
          >
            <Download size={16} color="#006633" />
            <span>Download Excel Template</span>
          </button>
        </div>
      </div>

      {/* ── Drag and Drop File Upload Area (Shown when no file loaded) ── */}
      {!fileData && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          style={{
            border: isDragging ? '2.5px dashed #e5a900' : '2px dashed #064e2e',
            backgroundColor: isDragging ? 'rgba(229, 169, 0, 0.08)' : 'rgba(6, 78, 46, 0.02)',
            borderRadius: '16px',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            position: 'relative'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
          />

          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: isDragging ? '#e5a900' : 'rgba(6, 78, 46, 0.1)',
              color: isDragging ? '#ffffff' : '#064e2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              transition: 'all 0.2s ease'
            }}
          >
            {isParsing ? (
              <RefreshCw size={30} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <UploadCloud size={32} />
            )}
          </div>

          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-dark, #111827)' }}>
            {isParsing ? 'Parsing Enrollment File...' : 'Drag & Drop your Excel or CSV file here'}
          </h4>

          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.88rem', color: 'var(--text-muted, #64748b)' }}>
            Supported formats: <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong>
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (fileInputRef.current) fileInputRef.current.click();
            }}
            style={{
              backgroundColor: 'var(--rotc-green-dark, #064e2e)',
              color: '#ffffff',
              border: 'none',
              padding: '0.65rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(6, 78, 46, 0.35)'
            }}
          >
            Browse Computer Files
          </button>
        </div>
      )}

      {/* ── Loaded File Summary & Action Bar ── */}
      {fileData && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(6, 78, 46, 0.1)',
                color: '#064e2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>{fileName}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                {fileSize} • {stats.total} records parsed
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleClear}
              disabled={isSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer'
              }}
            >
              <Trash2 size={15} />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={handleBatchInsert}
              disabled={isSaving || (stats.ready + stats.updates === 0)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: (stats.ready + stats.updates === 0) ? '#9ca3af' : 'var(--rotc-green-dark, #064e2e)',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.4rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 800,
                cursor: (isSaving || (stats.ready + stats.updates === 0)) ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(6, 78, 46, 0.35)'
              }}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving {saveProgress.current}/{saveProgress.total}...</span>
                </>
              ) : (
                <>
                  <Database size={16} />
                  <span>
                    {(stats.ready + stats.updates === 0 && stats.unchanged > 0)
                      ? `All Up to Date (${stats.unchanged} Unchanged)`
                      : `Import ${stats.ready + stats.updates} Cadets`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Save Result Notification ── */}
      {saveResult && (
        <div
          style={{
            backgroundColor: saveResult.success ? '#f0fdf4' : '#fef2f2',
            border: `1.5px solid ${saveResult.success ? '#86efac' : '#fca5a5'}`,
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: saveResult.success ? '#dcfce7' : '#fee2e2',
              color: saveResult.success ? '#16a34a' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {saveResult.success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.98rem', fontWeight: 800, color: saveResult.success ? '#166534' : '#991b1b' }}>
              {saveResult.success ? 'Batch Import Completed Successfully!' : 'Batch Import Failed'}
            </h4>
            <p style={{ margin: 0, fontSize: '0.84rem', color: saveResult.success ? '#15803d' : '#b91c1c' }}>
              Successfully saved/updated <strong>{saveResult.inserted}</strong> cadet records into the Supabase database.
              {saveResult.skippedUnchanged > 0 && ` (${saveResult.skippedUnchanged} unchanged records were skipped).`}
              {saveResult.failed > 0 && ` ${saveResult.failed} records failed.`}
            </p>
            {saveResult.errors && saveResult.errors.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#b91c1c' }}>
                {saveResult.errors.slice(0, 3).map((e, idx) => (
                  <div key={idx}>• {e}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Validation Metric Cards ── */}
      {fileData && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.85rem'
          }}
        >
          {/* Card 1: Total Records */}
          <div
            onClick={() => setTableFilter('ALL')}
            style={{
              backgroundColor: '#ffffff',
              border: `2px solid ${tableFilter === 'ALL' ? '#064e2e' : '#e5e7eb'}`,
              borderRadius: '10px',
              padding: '1rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Total Parsed</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#111827', margin: '0.2rem 0' }}>{stats.total}</div>
            <div style={{ fontSize: '0.73rem', color: '#064e2e', fontWeight: 600 }}>All rows in file</div>
          </div>

          {/* Card 2: Ready (New) */}
          <div
            onClick={() => setTableFilter('READY')}
            style={{
              backgroundColor: tableFilter === 'READY' ? '#f0fdf4' : '#ffffff',
              border: `2px solid ${tableFilter === 'READY' ? '#10b981' : '#e5e7eb'}`,
              borderRadius: '10px',
              padding: '1rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Ready (New)</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#059669', margin: '0.2rem 0' }}>{stats.ready}</div>
            <div style={{ fontSize: '0.73rem', color: '#6b7280' }}>New cadet additions</div>
          </div>

          {/* Card 3: Updates */}
          <div
            onClick={() => setTableFilter('UPDATE')}
            style={{
              backgroundColor: tableFilter === 'UPDATE' ? '#fffbeb' : '#ffffff',
              border: `2px solid ${tableFilter === 'UPDATE' ? '#f59e0b' : '#e5e7eb'}`,
              borderRadius: '10px',
              padding: '1rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>Updates</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#d97706', margin: '0.2rem 0' }}>{stats.updates}</div>
            <div style={{ fontSize: '0.73rem', color: '#6b7280' }}>Changed cadet records</div>
          </div>

          {/* Card 4: Unchanged (Skip) */}
          <div
            onClick={() => setTableFilter('UNCHANGED')}
            style={{
              backgroundColor: tableFilter === 'UNCHANGED' ? '#f1f5f9' : '#ffffff',
              border: `2px solid ${tableFilter === 'UNCHANGED' ? '#64748b' : '#e5e7eb'}`,
              borderRadius: '10px',
              padding: '1rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Unchanged (Skip)</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#475569', margin: '0.2rem 0' }}>{stats.unchanged}</div>
            <div style={{ fontSize: '0.73rem', color: '#6b7280' }}>Matches database exactly</div>
          </div>

          {/* Card 5: Errors / Invalid */}
          <div
            onClick={() => setTableFilter('ERROR')}
            style={{
              backgroundColor: tableFilter === 'ERROR' ? '#fef2f2' : '#ffffff',
              border: `2px solid ${tableFilter === 'ERROR' ? '#ef4444' : '#e5e7eb'}`,
              borderRadius: '10px',
              padding: '1rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Invalid Records</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#dc2626', margin: '0.2rem 0' }}>{stats.errors}</div>
            <div style={{ fontSize: '0.73rem', color: '#6b7280' }}>Excluded on save</div>
          </div>
        </div>
      )}

      {/* ── Data Preview Table ── */}
      {fileData && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}
        >
          {/* Full-Width Search Input Bar */}
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
            }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                placeholder="Search parsed records by cadet name, student ID, program or department"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 2.6rem 0.65rem 2.6rem',
                  fontSize: '0.875rem',
                  color: '#111827',
                  border: '1.5px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#064e2e';
                  e.target.style.boxShadow = '0 0 0 3px rgba(6, 78, 46, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                  title="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div style={{ overflowX: 'auto', maxHeight: '520px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#064e2e', color: '#ffffff', zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, width: '50px' }}>Row</th>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, width: '110px' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>Student ID</th>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>Cadet Full Name</th>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>Contact #</th>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>Gender</th>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>Dept & Program</th>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>Unit Hierarchy</th>
                  <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>Validation Notes</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#6b7280' }}>
                      No parsed records matching the current filter/search.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={idx}
                        style={{
                          backgroundColor: r.status === 'ERROR' ? '#fef2f2' : (r.status === 'UPDATE' ? '#fffbeb' : (r.status === 'UNCHANGED' ? '#f8fafc' : (isEven ? '#ffffff' : '#f9fafb'))),
                          borderBottom: '1px solid #e5e7eb'
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem', color: '#9ca3af', fontWeight: 600 }}>{r.rowNumber}</td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          {r.status === 'READY' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backgroundColor: '#dcfce7',
                                color: '#166534'
                              }}
                            >
                              <CheckCircle2 size={12} />
                              READY (NEW)
                            </span>
                          )}
                          {r.status === 'UPDATE' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backgroundColor: '#fef3c7',
                                color: '#92400e'
                              }}
                            >
                              <RefreshCw size={12} />
                              UPDATE
                            </span>
                          )}
                          {r.status === 'UNCHANGED' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1'
                              }}
                              title="Cadet fields match the database exactly. This record will be skipped during bulk import."
                            >
                              <CheckCircle2 size={12} />
                              UNCHANGED
                            </span>
                          )}
                          {r.status === 'ERROR' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backgroundColor: '#fee2e2',
                                color: '#991b1b'
                              }}
                            >
                              <XCircle size={12} />
                              ERROR
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, fontFamily: 'monospace' }}>
                          {r.cadet.id || <span style={{ color: '#ef4444' }}>Missing</span>}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#111827' }}>
                          {r.cadet.name || <span style={{ color: '#ef4444' }}>Missing Name</span>}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#4b5563', fontFamily: 'monospace' }}>
                          {r.cadet.contact_number || '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#4b5563' }}>{r.cadet.gender}</td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 700, color: '#064e2e' }}>{r.cadet.department}</span>
                          <span style={{ color: '#6b7280', marginLeft: '6px' }}>({r.cadet.program || 'N/A'})</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#374151' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{r.cadet.battalion}</div>
                          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                            {r.cadet.company} • {r.cadet.platoon}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <ValidationNotesCell notes={r.notes} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              fontSize: '0.78rem',
              color: '#6b7280',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              Showing <strong>{displayedRows.length}</strong> of <strong>{fileData.length}</strong> records
            </div>
            <div>
              Platoon capacity guardrail: <strong>37 Cadets Max</strong> per Platoon
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
