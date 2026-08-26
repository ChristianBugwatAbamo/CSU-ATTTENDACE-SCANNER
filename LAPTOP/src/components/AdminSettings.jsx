import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Shield,
  Clock,
  Users,
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Save,
  Server,
  FileSpreadsheet,
  Building,
  Landmark,
  Trash2,
  FileText,
  Lock,
  Layers,
  Printer,
  Award,
  Image as ImageIcon,
  KeyRound,
  Check,
  Eye,
  Sliders,
  Plus,
  Edit2,
  FolderPlus,
  ChevronRight,
  Sparkles,
  Info,
  X
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import LetterheadSettingsModal from './LetterheadSettingsModal';
import { recalculateAttendanceLogs } from '../utils/attendanceStatus';
import {
  fetchSettingsFromSupabase,
  saveSettingsToSupabase,
  syncSessionCutoffTime,
  clearCadetsFromSupabase,
  clearAttendanceFromSupabase
} from '../utils/supabaseClient';

// Standard CSU ROTC 1,184 Unit Structure Template
const DEFAULT_UNIT_STRUCTURE = [
  {
    id: 'bn-1',
    name: '1st Battalion',
    shortCode: '1BN',
    targetQuota: 592,
    companies: [
      {
        id: 'co-1-alpha',
        name: 'Alpha Company',
        shortCode: 'ALPHA',
        targetQuota: 148,
        platoons: [
          { id: 'pl-1-a-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-a-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-1-a-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-1-a-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-1-bravo',
        name: 'Bravo Company',
        shortCode: 'BRAVO',
        targetQuota: 148,
        platoons: [
          { id: 'pl-1-b-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-b-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-1-b-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-1-b-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-1-charlie',
        name: 'Charlie Company',
        shortCode: 'CHARLIE',
        targetQuota: 148,
        platoons: [
          { id: 'pl-1-c-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-c-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-1-c-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-1-c-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-1-delta',
        name: 'Delta Company',
        shortCode: 'DELTA',
        targetQuota: 148,
        platoons: [
          { id: 'pl-1-d-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-d-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-1-d-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-1-d-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      }
    ]
  },
  {
    id: 'bn-2',
    name: '2nd Battalion',
    shortCode: '2BN',
    targetQuota: 592,
    companies: [
      {
        id: 'co-2-alpha',
        name: 'Alpha Company',
        shortCode: 'ALPHA',
        targetQuota: 148,
        platoons: [
          { id: 'pl-2-a-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-a-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-2-a-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-2-a-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-2-bravo',
        name: 'Bravo Company',
        shortCode: 'BRAVO',
        targetQuota: 148,
        platoons: [
          { id: 'pl-2-b-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-b-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-2-b-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-2-b-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-2-charlie',
        name: 'Charlie Company',
        shortCode: 'CHARLIE',
        targetQuota: 148,
        platoons: [
          { id: 'pl-2-c-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-c-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-2-c-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-2-c-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-2-delta',
        name: 'Delta Company',
        shortCode: 'DELTA',
        targetQuota: 148,
        platoons: [
          { id: 'pl-2-d-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-d-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-2-d-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-2-d-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      }
    ]
  }
];

export const DEFAULT_OFFICER_RANKS = [
  'Cadet 2LT (ROTC) 4CL',
  'Cadet 1LT (ROTC) 4CL',
  'Cadet 1LT (ROTC) 3CL',
  'Cadet CPT (ROTC) 3CL',
  'Cadet CPT (ROTC) 2CL',
  'Cadet MAJ (ROTC) 2CL',
  'Cadet LT COL (ROTC) 1CL',
  'Cadet COL (ROTC) 1CL'
];

export const DEFAULT_OFFICER_DESIGNATIONS = [
  "Corps Commander",
  "Deputy Commander",
  "Adjutant",
  "S1 Brigade (Admin)",
  "S2 Brigade (Intelligence)",
  "S3 Brigade (Operations)",
  "S4 Brigade (Logistics)",
  "S7 Brigade (Civil Military Operation)",
  "S1 Assistant (Admin)",
  "S2 Assistant (Intelligence)",
  "S3 Assistant (Operations)",
  "S4 Assistant (Logistics)",
  "S7 Assistant (Civil Military Operation)"
];

const DEFAULT_SETTINGS = {
  // Tab 1: Attendance Rules & Unit
  morningCutoffTime: "07:30",
  afternoonCutoffTime: "16:00",
  formationTardyGrace: 15,
  lateThresholdGrace: 30,
  cadetQuotaPerPlatoon: 37,
  totalUnitTarget: 1184,
  requireTimeInAndOut: true,

  // Tab 2: Dynamic Unit Structure & Echelons
  unitStructure: DEFAULT_UNIT_STRUCTURE,

  // Tab 3: Unit Branding
  unitName: "1501st CDC ROTC Unit",
  commandingOfficer: "LTC CHRISTIAN B ABAMO INF (GSC) PA",
  commandingOfficerTitle: "Commandant, CSU ROTC Unit",
  parentCommand: "15th RCDG, ARESCOM, Philippine Army",
  hostInstitution: "Caraga State University (CSU Main Campus, Ampayon, Butuan City)",
  rotcSealUrl: "/rotc-seal-transparent.png",
  universityLogoUrl: "/csu-logo.png",

  // Tab 4: Data Management & Exports
  exportDirectory: "./desktop_excel_reports/",
  letterheadConfig: null,
  autoExcelExport: true,
  autoBackupEnabled: true,

  // Tab 5: ID Printing Setup
  signatoryName: "LTC CHRISTIAN B ABAMO INF (GSC) PA",
  signatoryDesignation: "Commandant, CSU ROTC Unit",
  signatureImageUrl: "",
  cardOrientation: "vertical", // 'vertical' | 'horizontal'
  cardDimensions: "CR80", // 'CR80' (85.6mm x 53.98mm)
  printDpi: 300,
  enableSecurityBorder: true,
  qrCodePosition: "top-right",
  officerRanks: DEFAULT_OFFICER_RANKS,
  officerDesignations: DEFAULT_OFFICER_DESIGNATIONS
};

export default function AdminSettings({ cadets = [], attendanceLogs = [], onRefresh, serverOnline }) {
  // Active top tab: 'structure' | 'branding' | 'storage' | 'idprinting'
  const [activeTab, setActiveTab] = useState('structure');

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(null);
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);

  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // Echelon Navigation in Structure Tab
  const [selectedBnId, setSelectedBnId] = useState('bn-1');
  const [selectedCoId, setSelectedCoId] = useState('co-1-alpha');

  // Echelon Add/Edit Modal State
  const [isEchelonModalOpen, setIsEchelonModalOpen] = useState(false);
  const [echelonModalConfig, setEchelonModalConfig] = useState({
    level: 'battalion', // 'battalion' | 'company' | 'platoon'
    mode: 'add', // 'add' | 'edit'
    parentId: null,
    item: { id: '', name: '', shortCode: '', targetQuota: 37 }
  });

  // Echelon Delete Modal State
  const [isEchelonDeleteModalOpen, setIsEchelonDeleteModalOpen] = useState(false);
  const [echelonDeleteConfig, setEchelonDeleteConfig] = useState({
    level: 'battalion',
    parentId: null,
    item: { id: '', name: '' }
  });

  // Modals & Security Verification
  const [isResetRosterModalOpen, setIsResetRosterModalOpen] = useState(false);

  // Secure Wipe Modal State
  const [isSecurePurgeModalOpen, setIsSecurePurgeModalOpen] = useState(false);
  const [purgePasswordInput, setPurgePasswordInput] = useState('');
  const [purgeErrorMsg, setPurgeErrorMsg] = useState('');

  // Logo / File Upload Refs
  const rotcSealInputRef = useRef(null);
  const univLogoInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const backupFileInputRef = useRef(null);

  // Dynamic Ranks & Designations input states
  const [newRankInput, setNewRankInput] = useState('');
  const [newDesignationInput, setNewDesignationInput] = useState('');

  // Load Settings on Mount
  useEffect(() => {
    const loadSettings = async () => {
      let finalSettings = DEFAULT_SETTINGS;

      // 1. Try loading from Supabase Cloud
      try {
        const sbSettings = await fetchSettingsFromSupabase();
        if (sbSettings) {
          const loadedCutoff = sbSettings.formation_cutoff_time || DEFAULT_SETTINGS.morningCutoffTime;
          finalSettings = {
            ...DEFAULT_SETTINGS,
            ...sbSettings,
            morningCutoffTime: loadedCutoff,
            formationCutoffTime: loadedCutoff,
            formationTardyGrace: sbSettings.formation_tardy_grace ?? DEFAULT_SETTINGS.formationTardyGrace,
            cadetQuotaPerPlatoon: sbSettings.cadet_quota_per_platoon ?? DEFAULT_SETTINGS.cadetQuotaPerPlatoon,
            totalUnitTarget: sbSettings.total_unit_target ?? DEFAULT_SETTINGS.totalUnitTarget,
            unitStructure: (Array.isArray(sbSettings.unit_structure) && sbSettings.unit_structure.length > 0) ? sbSettings.unit_structure : (sbSettings.unitStructure || DEFAULT_UNIT_STRUCTURE),
            unitName: sbSettings.unit_name || DEFAULT_SETTINGS.unitName,
            commandingOfficer: sbSettings.commanding_officer || DEFAULT_SETTINGS.commandingOfficer,
            commandingOfficerTitle: sbSettings.commanding_officer_title || DEFAULT_SETTINGS.commandingOfficerTitle,
            parentCommand: sbSettings.parent_command || DEFAULT_SETTINGS.parentCommand,
            hostInstitution: sbSettings.host_institution || DEFAULT_SETTINGS.hostInstitution,
            rotcSealUrl: sbSettings.rotc_seal_url || DEFAULT_SETTINGS.rotcSealUrl,
            universityLogoUrl: sbSettings.university_logo_url || DEFAULT_SETTINGS.universityLogoUrl,
            exportDirectory: sbSettings.excel_export_path || DEFAULT_SETTINGS.exportDirectory,
            letterheadConfig: sbSettings.letterhead_config || DEFAULT_SETTINGS.letterheadConfig,
            autoBackupEnabled: sbSettings.auto_backup_enabled !== false,
            signatoryName: sbSettings.id_signatory_name || sbSettings.commanding_officer || DEFAULT_SETTINGS.signatoryName,
            signatoryDesignation: sbSettings.id_signatory_title || sbSettings.commanding_officer_title || DEFAULT_SETTINGS.signatoryDesignation,
            signatureImageUrl: sbSettings.id_signature_url || DEFAULT_SETTINGS.signatureImageUrl,
            cardOrientation: sbSettings.id_card_orientation || DEFAULT_SETTINGS.cardOrientation,
            officerRanks: (Array.isArray(sbSettings.officer_ranks_list) && sbSettings.officer_ranks_list.length > 0) ? sbSettings.officer_ranks_list : (sbSettings.officerRanks || DEFAULT_OFFICER_RANKS),
            officerDesignations: (Array.isArray(sbSettings.officer_roles_list) && sbSettings.officer_roles_list.length > 0) ? sbSettings.officer_roles_list : (sbSettings.officerDesignations || DEFAULT_OFFICER_DESIGNATIONS)
          };
        }
      } catch (_) {}

      // 2. Local fallback if Supabase not yet populated
      if (!finalSettings || Object.keys(finalSettings).length <= 5) {
        try {
          const res = await fetch('/api/settings');
          if (res.ok) {
            const data = await res.json();
            finalSettings = {
              ...DEFAULT_SETTINGS,
              ...data,
              morningCutoffTime: data.morningCutoffTime || data.formationCutoffTime || DEFAULT_SETTINGS.morningCutoffTime,
              formationCutoffTime: data.morningCutoffTime || data.formationCutoffTime || DEFAULT_SETTINGS.formationCutoffTime,
              unitStructure: data.unitStructure && data.unitStructure.length > 0 ? data.unitStructure : DEFAULT_UNIT_STRUCTURE,
              officerRanks: data.officerRanks && data.officerRanks.length > 0 ? data.officerRanks : DEFAULT_OFFICER_RANKS,
              officerDesignations: data.officerDesignations && data.officerDesignations.length > 0 ? data.officerDesignations : DEFAULT_OFFICER_DESIGNATIONS
            };
          }
        } catch (_) {}
      }

      setSettings(finalSettings);
      setSavedSettings(finalSettings);
    };
    loadSettings();
  }, []);

  // Keyboard shortcut Ctrl+S / Cmd+S to Save All Settings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings]);

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // Save Settings Handler (Centralized for all 4 tabs)
  const handleSaveSettings = async (e, customSettings = null) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    const rawToSave = customSettings || settings;
    const newCutoff = rawToSave.morningCutoffTime || rawToSave.formationCutoffTime || (rawToSave.musterAndUnit && rawToSave.musterAndUnit.timeInCutoff) || '07:30';
    const toSave = {
      ...rawToSave,
      morningCutoffTime: newCutoff,
      formationCutoffTime: newCutoff
    };

    try {
      // 1. Re-evaluate and update all master attendance records against the new cutoff setting
      try {
        const savedLogsJson = localStorage.getItem('csu_rotc_master_attendance');
        if (savedLogsJson) {
          const parsedLogs = JSON.parse(savedLogsJson);
          const recalculatedLogs = recalculateAttendanceLogs(parsedLogs, newCutoff);
          localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(recalculatedLogs));
        }
      } catch (errRecalc) {
        console.warn('Error recalculating master attendance on settings update:', errRecalc);
      }

      localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(toSave));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('local-attendance-update'));
      window.dispatchEvent(new CustomEvent('csu_settings_updated', { detail: toSave }));

      // 2. Save directly to Supabase Cloud system_settings and propagate to attendance_sessions
      try {
        await saveSettingsToSupabase(toSave);
        await syncSessionCutoffTime(newCutoff);
      } catch (errCloud) {
        console.warn('Supabase save settings error:', errCloud);
      }

      // 3. Save to local server node if available
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSave)
        });
      } catch (_) {}

      setSavedSettings(toSave);
      setSaveSuccessToast('All settings & unit configurations saved to Cloud Database successfully!');
    } catch (err) {
      setSavedSettings(toSave);
      setSaveSuccessToast('Settings saved.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Handle Dynamic Ranks (Draft only until Save All Settings)
  const handleAddRank = () => {
    const trimmed = newRankInput.trim();
    if (!trimmed) return;
    const currentRanks = settings.officerRanks || DEFAULT_OFFICER_RANKS;
    if (currentRanks.includes(trimmed)) {
      alert('This rank already exists.');
      return;
    }
    const updated = [...currentRanks, trimmed];
    setSettings(prev => ({ ...prev, officerRanks: updated }));
    setNewRankInput('');
  };

  const handleDeleteRank = (rankToDelete) => {
    const currentRanks = settings.officerRanks || DEFAULT_OFFICER_RANKS;
    if (currentRanks.length <= 1) {
      alert('Must maintain at least one officer rank option.');
      return;
    }
    const updated = currentRanks.filter(r => r !== rankToDelete);
    setSettings(prev => ({ ...prev, officerRanks: updated }));
  };

  // Handle Dynamic Designations (Draft only until Save All Settings)
  const handleAddDesignation = () => {
    const trimmed = newDesignationInput.trim();
    if (!trimmed) return;
    const currentDesignations = settings.officerDesignations || DEFAULT_OFFICER_DESIGNATIONS;
    if (currentDesignations.includes(trimmed)) {
      alert('This designation already exists.');
      return;
    }
    const updated = [...currentDesignations, trimmed];
    setSettings(prev => ({ ...prev, officerDesignations: updated }));
    setNewDesignationInput('');
  };

  const handleDeleteDesignation = (designationToDelete) => {
    const currentDesignations = settings.officerDesignations || DEFAULT_OFFICER_DESIGNATIONS;
    if (currentDesignations.length <= 1) {
      alert('Must maintain at least one officer designation option.');
      return;
    }
    const updated = currentDesignations.filter(d => d !== designationToDelete);
    setSettings(prev => ({ ...prev, officerDesignations: updated }));
  };

  const handleResetRanksAndDesignations = () => {
    if (window.confirm('Reset Officer Ranks and Staff Designations to military defaults in draft state? (Click "SAVE ALL SETTINGS" to commit)')) {
      setSettings(prev => ({
        ...prev,
        officerRanks: DEFAULT_OFFICER_RANKS,
        officerDesignations: DEFAULT_OFFICER_DESIGNATIONS
      }));
    }
  };

  // Image Upload Handlers
  const handleImageUpload = (e, fieldKey) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target.result;
      setSettings(prev => ({ ...prev, [fieldKey]: base64Data }));
      setSaveSuccessToast(`Image uploaded for ${fieldKey}! Click "Save All Settings" to apply.`);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    };
    reader.readAsDataURL(file);
  };

  // Reset Full Cadet Roster
  const handleConfirmResetRoster = async () => {
    setIsResetRosterModalOpen(false);
    try {
      const res = await fetch('/api/cadets/reset', { method: 'POST' });
      if (res.ok) {
        setSaveSuccessToast('Master Cadet Directory restored to standard 1,184-cadet structure.');
        if (onRefresh) onRefresh();
      } else {
        alert('Could not reset roster on server.');
      }
    } catch (err) {
      alert('Error contacting server to reset roster: ' + err.message);
    } finally {
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Execute Purge Attendance Logs
  const handleExecuteSecurePurge = async () => {
    if (purgePasswordInput !== '1501') {
      setPurgeErrorMsg('Incorrect Admin PIN. Access denied.');
      return;
    }

    try {
      const res = await fetch('/api/attendance', { method: 'DELETE' });
      localStorage.removeItem('csu_rotc_master_attendance');
      localStorage.removeItem('csu_rotc_recent_approved_signatures');
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('local-attendance-update'));

      if (res.ok) {
        setIsSecurePurgeModalOpen(false);
        setPurgePasswordInput('');
        setPurgeErrorMsg('');
        setSaveSuccessToast('All attendance logs have been securely wiped.');
        if (onRefresh) onRefresh();
      } else {
        setPurgeErrorMsg('Failed to clear logs on server.');
      }
    } catch (err) {
      localStorage.removeItem('csu_rotc_master_attendance');
      localStorage.removeItem('csu_rotc_recent_approved_signatures');
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('local-attendance-update'));
      setPurgeErrorMsg('Error contacting server (cleared locally).');
    } finally {
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Download System Backup
  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `csu_rotc_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setSaveSuccessToast('System backup downloaded successfully.');
      } else {
        const backupData = {
          exportTimestamp: new Date().toISOString(),
          settings: settings,
          cadets: cadets,
          attendanceLogs: attendanceLogs
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `csu_rotc_local_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setSaveSuccessToast('Local backup downloaded successfully.');
      }
    } catch (err) {
      alert('Could not download backup: ' + err.message);
    } finally {
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Restore System Backup
  const handleRestoreBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.settings) {
          setSettings(data.settings);
          localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(data.settings));
        }

        if (data.attendanceLogs && Array.isArray(data.attendanceLogs)) {
          localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(data.attendanceLogs));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('local-attendance-update'));
        }

        if (data.cadets && Array.isArray(data.cadets)) {
          localStorage.setItem('csu_rotc_cadets_roster', JSON.stringify(data.cadets));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('local-attendance-update'));
        }

        const res = await fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          setSaveSuccessToast('System snapshot restored successfully from backup.');
          if (onRefresh) onRefresh();
        } else {
          setSaveSuccessToast('Settings loaded locally from backup file.');
        }
      } catch (err) {
        alert('Invalid backup JSON file: ' + err.message);
      } finally {
        setTimeout(() => setSaveSuccessToast(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  // State for clearing
  const [isClearingCadets, setIsClearingCadets] = useState(false);
  const [isClearingAttendance, setIsClearingAttendance] = useState(false);

  // Clear All Cadets from Supabase & Local Cache
  const handleClearCadetsFromApp = async () => {
    if (!window.confirm('⚠️ WARNING: Are you sure you want to delete ALL cadets from Supabase and clear the local cadet cache? This action cannot be undone.')) {
      return;
    }
    setIsClearingCadets(true);
    try {
      await clearCadetsFromSupabase();
      localStorage.removeItem('csu_rotc_cadets_roster');
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('local-attendance-update'));
      setSaveSuccessToast('All cadet records successfully cleared from Supabase & local cache.');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error clearing cadets: ' + err.message);
    } finally {
      setIsClearingCadets(false);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Clear All Attendance Logs from Supabase & Local Cache
  const handleClearAttendanceFromApp = async () => {
    if (!window.confirm('⚠️ WARNING: Are you sure you want to delete ALL attendance logs from Supabase and clear local attendance history? This action cannot be undone.')) {
      return;
    }
    setIsClearingAttendance(true);
    try {
      await clearAttendanceFromSupabase();
      localStorage.removeItem('csu_rotc_master_attendance');
      localStorage.removeItem('csu_rotc_recent_approved_signatures');
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('local-attendance-update'));
      setSaveSuccessToast('All attendance records successfully cleared from Supabase & local cache.');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error clearing attendance: ' + err.message);
    } finally {
      setIsClearingAttendance(false);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // =========================================================================
  // UNIT STRUCTURE & ECHELONS CRUD HANDLERS
  // =========================================================================

  const currentStructure = settings.unitStructure || DEFAULT_UNIT_STRUCTURE;

  // Active battalion object
  const activeBattalion = currentStructure.find(b => b.id === selectedBnId) || currentStructure[0] || null;

  // Active company object
  const activeCompany = activeBattalion
    ? (activeBattalion.companies.find(c => c.id === selectedCoId) || activeBattalion.companies[0] || null)
    : null;

  // Calculate totals
  const totalBattalionsCount = currentStructure.length;
  const totalCompaniesCount = currentStructure.reduce((acc, bn) => acc + (bn.companies ? bn.companies.length : 0), 0);
  const totalPlatoonsCount = currentStructure.reduce((acc, bn) => {
    return acc + (bn.companies ? bn.companies.reduce((pAcc, co) => pAcc + (co.platoons ? co.platoons.length : 0), 0) : 0);
  }, 0);
  const totalBasicQuota = currentStructure.reduce((acc, bn) => acc + (Number(bn.targetQuota) || 0), 0);

  // Open Modal to Add Echelon
  const handleOpenAddEchelon = (level, parentId = null) => {
    let defaultName = '';
    let defaultCode = '';
    let defaultQuota = 37;

    if (level === 'battalion') {
      const nextNum = currentStructure.length + 1;
      const suffix = nextNum === 1 ? 'st' : nextNum === 2 ? 'nd' : nextNum === 3 ? 'rd' : 'th';
      defaultName = `${nextNum}${suffix} Battalion`;
      defaultCode = `${nextNum}BN`;
      defaultQuota = 592;
    } else if (level === 'company') {
      const existingCoys = activeBattalion ? activeBattalion.companies.length : 0;
      const coyNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
      const pickName = coyNames[existingCoys] || `Company ${existingCoys + 1}`;
      defaultName = `${pickName} Company`;
      defaultCode = pickName.toUpperCase();
      defaultQuota = 148;
    } else if (level === 'platoon') {
      const existingPltns = activeCompany ? activeCompany.platoons.length : 0;
      const nextNum = existingPltns + 1;
      const suffix = nextNum === 1 ? 'st' : nextNum === 2 ? 'nd' : nextNum === 3 ? 'rd' : 'th';
      defaultName = `${nextNum}${suffix} Platoon`;
      defaultCode = `${nextNum}PLTN`;
      defaultQuota = 37;
    }

    setEchelonModalConfig({
      level,
      mode: 'add',
      parentId,
      item: {
        id: `echelon-${Date.now()}`,
        name: defaultName,
        shortCode: defaultCode,
        targetQuota: defaultQuota
      }
    });
    setIsEchelonModalOpen(true);
  };

  // Open Modal to Edit Echelon
  const handleOpenEditEchelon = (level, item, parentId = null) => {
    setEchelonModalConfig({
      level,
      mode: 'edit',
      parentId,
      item: { ...item }
    });
    setIsEchelonModalOpen(true);
  };

  // Save Echelon from Modal (Add or Edit)
  const handleSaveEchelonModal = () => {
    const { level, mode, parentId, item } = echelonModalConfig;

    if (!item.name || !item.name.trim()) {
      alert('Please enter a valid unit display name.');
      return;
    }

    const quotaNum = Number(item.targetQuota) || 37;
    const cleanItem = {
      ...item,
      name: item.name.trim(),
      shortCode: (item.shortCode || item.name.slice(0, 4)).trim().toUpperCase(),
      targetQuota: quotaNum
    };

    let updatedStructure = JSON.parse(JSON.stringify(currentStructure));

    if (level === 'battalion') {
      if (mode === 'add') {
        const newBn = {
          id: `bn-${Date.now()}`,
          name: cleanItem.name,
          shortCode: cleanItem.shortCode,
          targetQuota: cleanItem.targetQuota,
          companies: [
            {
              id: `co-${Date.now()}-alpha`,
              name: 'Alpha Company',
              shortCode: 'ALPHA',
              targetQuota: Math.round(cleanItem.targetQuota / 4) || 148,
              platoons: [
                { id: `pl-${Date.now()}-1`, name: '1st Platoon', shortCode: '1PLTN', targetQuota: Math.round(cleanItem.targetQuota / 16) || 37 },
                { id: `pl-${Date.now()}-2`, name: '2nd Platoon', shortCode: '2PLTN', targetQuota: Math.round(cleanItem.targetQuota / 16) || 37 },
                { id: `pl-${Date.now()}-3`, name: '3rd Platoon', shortCode: '3PLTN', targetQuota: Math.round(cleanItem.targetQuota / 16) || 37 },
                { id: `pl-${Date.now()}-4`, name: '4th Platoon', shortCode: '4PLTN', targetQuota: Math.round(cleanItem.targetQuota / 16) || 37 }
              ]
            }
          ]
        };
        updatedStructure.push(newBn);
        setSelectedBnId(newBn.id);
        setSelectedCoId(newBn.companies[0].id);
      } else {
        const idx = updatedStructure.findIndex(b => b.id === cleanItem.id);
        if (idx !== -1) {
          updatedStructure[idx] = { ...updatedStructure[idx], ...cleanItem };
        }
      }
    } else if (level === 'company') {
      const bnIdx = updatedStructure.findIndex(b => b.id === (parentId || selectedBnId));
      if (bnIdx !== -1) {
        if (mode === 'add') {
          const newCo = {
            id: `co-${Date.now()}`,
            name: cleanItem.name,
            shortCode: cleanItem.shortCode,
            targetQuota: cleanItem.targetQuota,
            platoons: [
              { id: `pl-${Date.now()}-1`, name: '1st Platoon', shortCode: '1PLTN', targetQuota: Math.round(cleanItem.targetQuota / 4) || 37 },
              { id: `pl-${Date.now()}-2`, name: '2nd Platoon', shortCode: '2PLTN', targetQuota: Math.round(cleanItem.targetQuota / 4) || 37 },
              { id: `pl-${Date.now()}-3`, name: '3rd Platoon', shortCode: '3PLTN', targetQuota: Math.round(cleanItem.targetQuota / 4) || 37 },
              { id: `pl-${Date.now()}-4`, name: '4th Platoon', shortCode: '4PLTN', targetQuota: Math.round(cleanItem.targetQuota / 4) || 37 }
            ]
          };
          updatedStructure[bnIdx].companies.push(newCo);
          setSelectedCoId(newCo.id);
        } else {
          const coIdx = updatedStructure[bnIdx].companies.findIndex(c => c.id === cleanItem.id);
          if (coIdx !== -1) {
            updatedStructure[bnIdx].companies[coIdx] = {
              ...updatedStructure[bnIdx].companies[coIdx],
              ...cleanItem
            };
          }
        }
        // Auto-sync Battalion Quota to sum of companies
        const coSum = updatedStructure[bnIdx].companies.reduce((acc, c) => acc + Number(c.targetQuota || 0), 0);
        if (coSum > 0) updatedStructure[bnIdx].targetQuota = coSum;
      }
    } else if (level === 'platoon') {
      const bnIdx = updatedStructure.findIndex(b => b.id === selectedBnId);
      if (bnIdx !== -1) {
        const coIdx = updatedStructure[bnIdx].companies.findIndex(c => c.id === (parentId || selectedCoId));
        if (coIdx !== -1) {
          if (mode === 'add') {
            const newPl = {
              id: `pl-${Date.now()}`,
              name: cleanItem.name,
              shortCode: cleanItem.shortCode,
              targetQuota: cleanItem.targetQuota
            };
            updatedStructure[bnIdx].companies[coIdx].platoons.push(newPl);
          } else {
            const plIdx = updatedStructure[bnIdx].companies[coIdx].platoons.findIndex(p => p.id === cleanItem.id);
            if (plIdx !== -1) {
              updatedStructure[bnIdx].companies[coIdx].platoons[plIdx] = {
                ...updatedStructure[bnIdx].companies[coIdx].platoons[plIdx],
                ...cleanItem
              };
            }
          }
          // Auto-sync Company Quota to sum of platoons
          const plSum = updatedStructure[bnIdx].companies[coIdx].platoons.reduce((acc, p) => acc + Number(p.targetQuota || 0), 0);
          if (plSum > 0) updatedStructure[bnIdx].companies[coIdx].targetQuota = plSum;

          // Auto-sync Battalion Quota
          const coSum = updatedStructure[bnIdx].companies.reduce((acc, c) => acc + Number(c.targetQuota || 0), 0);
          if (coSum > 0) updatedStructure[bnIdx].targetQuota = coSum;
        }
      }
    }

    const newSettings = { ...settings, unitStructure: updatedStructure };
    setSettings(newSettings);
    setIsEchelonModalOpen(false);
  };

  // Open Delete Confirmation
  const handleOpenDeleteEchelon = (level, item, parentId = null) => {
    setEchelonDeleteConfig({ level, item, parentId });
    setIsEchelonDeleteModalOpen(true);
  };

  // Confirm Delete Echelon
  const handleConfirmDeleteEchelon = () => {
    const { level, item, parentId } = echelonDeleteConfig;
    let updatedStructure = JSON.parse(JSON.stringify(currentStructure));

    if (level === 'battalion') {
      if (updatedStructure.length <= 1) {
        alert('Cannot delete the only remaining Battalion.');
        setIsEchelonDeleteModalOpen(false);
        return;
      }
      updatedStructure = updatedStructure.filter(b => b.id !== item.id);
      if (selectedBnId === item.id) {
        setSelectedBnId(updatedStructure[0]?.id || null);
        setSelectedCoId(updatedStructure[0]?.companies[0]?.id || null);
      }
    } else if (level === 'company') {
      const bnIdx = updatedStructure.findIndex(b => b.id === (parentId || selectedBnId));
      if (bnIdx !== -1) {
        if (updatedStructure[bnIdx].companies.length <= 1) {
          alert('Cannot delete the only remaining Company in this Battalion.');
          setIsEchelonDeleteModalOpen(false);
          return;
        }
        updatedStructure[bnIdx].companies = updatedStructure[bnIdx].companies.filter(c => c.id !== item.id);
        if (selectedCoId === item.id) {
          setSelectedCoId(updatedStructure[bnIdx].companies[0]?.id || null);
        }
        // Recalculate Quota
        const coSum = updatedStructure[bnIdx].companies.reduce((acc, c) => acc + Number(c.targetQuota || 0), 0);
        if (coSum > 0) updatedStructure[bnIdx].targetQuota = coSum;
      }
    } else if (level === 'platoon') {
      const bnIdx = updatedStructure.findIndex(b => b.id === selectedBnId);
      if (bnIdx !== -1) {
        const coIdx = updatedStructure[bnIdx].companies.findIndex(c => c.id === (parentId || selectedCoId));
        if (coIdx !== -1) {
          if (updatedStructure[bnIdx].companies[coIdx].platoons.length <= 1) {
            alert('Cannot delete the only remaining Platoon in this Company.');
            setIsEchelonDeleteModalOpen(false);
            return;
          }
          updatedStructure[bnIdx].companies[coIdx].platoons = updatedStructure[bnIdx].companies[coIdx].platoons.filter(p => p.id !== item.id);
          // Recalculate Quota
          const plSum = updatedStructure[bnIdx].companies[coIdx].platoons.reduce((acc, p) => acc + Number(p.targetQuota || 0), 0);
          if (plSum > 0) updatedStructure[bnIdx].companies[coIdx].targetQuota = plSum;

          const coSum = updatedStructure[bnIdx].companies.reduce((acc, c) => acc + Number(c.targetQuota || 0), 0);
          if (coSum > 0) updatedStructure[bnIdx].targetQuota = coSum;
        }
      }
    }

    const newSettings = { ...settings, unitStructure: updatedStructure };
    setSettings(newSettings);
    setIsEchelonDeleteModalOpen(false);
  };

  // Restore Default 1,184 Echelon Structure
  const handleRestoreDefaultStructure = () => {
    if (window.confirm('Reset the organizational structure back to standard CSU ROTC 1,184 template (2 Battalions × 4 Companies × 4 Platoons × 37 Cadets)? (Click "SAVE ALL SETTINGS" to commit)')) {
      const newSettings = { ...settings, unitStructure: DEFAULT_UNIT_STRUCTURE };
      setSettings(newSettings);
      setSelectedBnId('bn-1');
      setSelectedCoId('co-1-alpha');
    }
  };

  const tabs = [
    { id: 'structure', label: 'Muster & Unit Configuration', icon: Layers, desc: 'Formation schedules & battalion structure' },
    { id: 'branding', label: 'Unit Branding', icon: Award, desc: 'Command profile & official seals' },
    { id: 'storage', label: 'Data Management & Exports', icon: Database, desc: 'Excel paths, backups & letterhead settings' },
    { id: 'idprinting', label: 'ID Printing Setup', icon: Printer, desc: 'Signatories & CR80 specs' }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Hero Banner Header */}
      <div style={{
        background: 'linear-gradient(135deg, #064e2e 0%, #005a36 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(229, 169, 0, 0.2)',
            color: 'var(--rotc-yellow-gold)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '1px',
            marginBottom: '0.6rem',
            border: '1px solid rgba(229, 169, 0, 0.35)'
          }}>
            <Shield size={14} />
            <span>ADMIN HQ CONTROL PANEL</span>
          </div>

          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', margin: '0 0 0.4rem 0', letterSpacing: '0.5px' }}>
            System & Unit Settings
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.5 }}>
            Configure formation rules, dynamic organizational structure, official seals, and ID printing parameters.
          </p>
        </div>

        {/* Global Save Button in Hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {hasUnsavedChanges && (
            <span style={{
              background: 'rgba(239, 68, 68, 0.25)',
              color: '#fef08a',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '5px 12px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              letterSpacing: '0.5px'
            }}>
              ● UNSAVED DRAFT CHANGES
            </span>
          )}
          <button
            className="btn btn-gold"
            onClick={handleSaveSettings}
            disabled={isSaving}
            style={{
              padding: '0.85rem 1.75rem',
              fontSize: '0.95rem',
              fontWeight: 800,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              borderRadius: '10px',
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            <span>{isSaving ? 'SAVING...' : 'SAVE ALL SETTINGS'}</span>
          </button>
        </div>
      </div>

      {/* Floating Save Toast Banner */}
      {saveSuccessToast && (
        <div style={{
          background: '#d1fae5',
          border: '1.5px solid #10b981',
          color: '#065f46',
          padding: '0.9rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontWeight: 700,
          fontSize: '0.92rem',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={22} color="#059669" />
          <span>{saveSuccessToast}</span>
        </div>
      )}

      {/* Top Navigation Buttons Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.9rem 1.1rem',
                borderRadius: '12px',
                border: isActive ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
                background: '#ffffff',
                color: isActive ? 'var(--rotc-green-dark)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 4px 12px rgba(6, 78, 46, 0.15)' : 'var(--shadow-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: isActive ? 'rgba(6, 78, 46, 0.1)' : '#f1f5f9',
                color: isActive ? 'var(--rotc-green-dark)' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={20} />
              </div>

              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: isActive ? 'var(--rotc-green-dark)' : 'var(--text-dark)' }}>
                  {tab.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {tab.desc}
                </div>
              </div>

              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '20px',
                  right: '20px',
                  height: '3px',
                  background: 'var(--rotc-green-dark)',
                  borderRadius: '3px 3px 0 0'
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: ATTENDANCE & UNIT SETUP
          ========================================================================= */}
      {activeTab === 'structure' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Formation Cutoff Schedule Card */}
          <div className="card" style={{ width: '100%' }}>
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Clock size={20} />
                <span>Formation Cutoff Schedule</span>
              </div>
              <span className="badge badge-present">TIME RULES</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Time-In Cutoff
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={settings.morningCutoffTime}
                  onChange={(e) => handleChange('morningCutoffTime', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Default morning muster deadline (e.g., 07:30 AM). Scans on or before this are marked Present; scans after this are marked Late.
                </span>

                {/* Status Transition Legend */}
                <div style={{ marginTop: '0.85rem', padding: '0.75rem 0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)', marginBottom: '6px' }}>Automatic Scan Status Transition (Exact Cutoff):</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#065f46', fontWeight: 700, background: '#d1fae5', padding: '4px 10px', borderRadius: '4px' }}>
                      🟢 On or Before {settings.morningCutoffTime || '07:30'} → PRESENT
                    </span>
                    <span style={{ color: '#991b1b', fontWeight: 700, background: '#fee2e2', padding: '4px 10px', borderRadius: '4px' }}>
                      🔴 After {settings.morningCutoffTime || '07:30'} → LATE
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Unit Structure Summary Banner */}
          <div className="card" style={{ border: '2px solid #cbd5e1', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={22} color="var(--rotc-green-dark)" />
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-dark)', fontFamily: 'Oswald, sans-serif' }}>
                    UNIT MANAGEMENT
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Manage dynamic Battalions, Companies, and Platoons. Update display names, short codes, and cadet quotas.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRestoreDefaultStructure}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                  title="Reset to standard 1,184 structure (2 Battalions x 4 Coys x 4 Platoons)"
                >
                  <RefreshCw size={14} /> Restore 1,184 Standard Template
                </button>
              </div>
            </div>

            {/* Quota Breakdown Chips (4 Columns) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-light)'
            }}>
              <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>Battalions</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e3a8a' }}>{totalBattalionsCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{totalBasicQuota.toLocaleString()} Basic Quota</div>
              </div>

              <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.72rem', color: '#065f46', fontWeight: 700, textTransform: 'uppercase' }}>Companies</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#064e2e' }}>{totalCompaniesCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Across all battalions</div>
              </div>

              <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Platoons</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#78350f' }}>{totalPlatoonsCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fixed formation units</div>
              </div>

              <div style={{ padding: '0.75rem', background: 'rgba(6, 78, 46, 0.08)', borderRadius: '8px', border: '1.5px solid var(--rotc-green-dark)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--rotc-green-dark)', fontWeight: 800, textTransform: 'uppercase' }}>Total Unit Target</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--rotc-green-dark)' }}>{totalBasicQuota.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Basic Cadets Quota</div>
              </div>
            </div>
          </div>

          {/* 3-Column Interactive Hierarchy Manager */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

            {/* COLUMN 1: BATTALIONS (Theme: BLUE) */}
            <div className="card" style={{ border: '2px solid #bfdbfe', background: '#eff6ff' }}>
              <div className="card-header" style={{ paddingBottom: '0.75rem', borderBottom: '1.5px solid #dbeafe' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '0.98rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={18} color="#2563eb" />
                    <span>1. Battalions ({currentStructure.length})</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Level 1 Unit Echelons
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAddEchelon('battalion')}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <Plus size={13} /> Add Bn
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                {currentStructure.map(bn => {
                  const isSelected = selectedBnId === bn.id;
                  const coyCount = bn.companies ? bn.companies.length : 0;

                  return (
                    <div
                      key={bn.id}
                      onClick={() => {
                        setSelectedBnId(bn.id);
                        if (bn.companies && bn.companies.length > 0) {
                          setSelectedCoId(bn.companies[0].id);
                        } else {
                          setSelectedCoId(null);
                        }
                      }}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        background: isSelected ? '#ffffff' : '#f8fafc',
                        border: isSelected ? '2px solid #2563eb' : '1px solid #bfdbfe',
                        boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isSelected ? '#1e3a8a' : '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{bn.name}</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '4px' }}>
                              {bn.shortCode || 'BN'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {coyCount} Companies • Quota: <strong>{bn.targetQuota}</strong>
                          </div>
                        </div>

                        {/* Edit & Delete Controls */}
                        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditEchelon('battalion', bn)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '4px 6px',
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                            title={`Edit ${bn.name}`}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteEchelon('battalion', bn)}
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              padding: '4px 6px',
                              color: '#dc2626',
                              cursor: 'pointer'
                            }}
                            title={`Delete ${bn.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: isSelected ? '#2563eb' : '#94a3b8', fontWeight: 700, marginTop: '6px' }}>
                        <span>{isSelected ? '● ACTIVE BATTALION' : 'Click to View Companies'}</span>
                        <ChevronRight size={14} color={isSelected ? '#2563eb' : '#94a3b8'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: COMPANIES (Theme: EMERALD / GREEN) */}
            <div className="card" style={{ border: '2px solid #a7f3d0', background: '#ecfdf5' }}>
              <div className="card-header" style={{ paddingBottom: '0.75rem', borderBottom: '1.5px solid #d1fae5' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '0.98rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building size={18} color="#059669" />
                    <span>2. Companies ({activeBattalion?.name || 'None'})</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Level 2 Unit Echelons
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAddEchelon('company', selectedBnId)}
                  disabled={!activeBattalion}
                  style={{
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: activeBattalion ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)'
                  }}
                >
                  <Plus size={13} /> Add Coy
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                {(!activeBattalion || !activeBattalion.companies || activeBattalion.companies.length === 0) ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No companies configured under this battalion. Click "+ Add Coy" to create one.
                  </div>
                ) : (
                  activeBattalion.companies.map(co => {
                    const isSelected = selectedCoId === co.id;
                    const pltnCount = co.platoons ? co.platoons.length : 0;

                    return (
                      <div
                        key={co.id}
                        onClick={() => setSelectedCoId(co.id)}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '10px',
                          background: isSelected ? '#ffffff' : '#f8fafc',
                          border: isSelected ? '2px solid #059669' : '1px solid #a7f3d0',
                          boxShadow: isSelected ? '0 4px 12px rgba(5, 150, 105, 0.2)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isSelected ? '#064e2e' : '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{co.name}</span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#d1fae5', color: '#065f46', padding: '1px 6px', borderRadius: '4px' }}>
                                {co.shortCode || 'CO'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {pltnCount} Platoons • Quota: <strong>{co.targetQuota}</strong>
                            </div>
                          </div>

                          {/* Edit & Delete Controls */}
                          <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditEchelon('company', co, selectedBnId)}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 6px',
                                color: '#334155',
                                cursor: 'pointer'
                              }}
                              title={`Edit ${co.name}`}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteEchelon('company', co, selectedBnId)}
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fca5a5',
                                borderRadius: '6px',
                                padding: '4px 6px',
                                color: '#dc2626',
                                cursor: 'pointer'
                              }}
                              title={`Delete ${co.name}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: isSelected ? '#059669' : '#94a3b8', fontWeight: 700, marginTop: '6px' }}>
                          <span>{isSelected ? '● ACTIVE COMPANY' : 'Click to View Platoons'}</span>
                          <ChevronRight size={14} color={isSelected ? '#059669' : '#94a3b8'} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMN 3: PLATOONS (Theme: AMBER / ORANGE) */}
            <div className="card" style={{ border: '2px solid #fde68a', background: '#fffbeb' }}>
              <div className="card-header" style={{ paddingBottom: '0.75rem', borderBottom: '1.5px solid #fef3c7' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '0.98rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={18} color="#d97706" />
                    <span>3. Platoons ({activeCompany?.name || 'None'})</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Level 3 Formation Units
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAddEchelon('platoon', selectedCoId)}
                  disabled={!activeCompany}
                  style={{
                    background: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: activeCompany ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
                  }}
                >
                  <Plus size={13} /> Add Pltn
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                {(!activeCompany || !activeCompany.platoons || activeCompany.platoons.length === 0) ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No platoons configured under this company. Click "+ Add Pltn" to create one.
                  </div>
                ) : (
                  activeCompany.platoons.map(pl => {
                    return (
                      <div
                        key={pl.id}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '10px',
                          background: '#ffffff',
                          border: '1px solid #fde68a',
                          boxShadow: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#78350f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{pl.name}</span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>
                                {pl.shortCode || 'PLTN'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Capacity Quota: <strong>{pl.targetQuota} Cadets</strong>
                            </div>
                          </div>

                          {/* Edit & Delete Controls */}
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditEchelon('platoon', pl, selectedCoId)}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 6px',
                                color: '#334155',
                                cursor: 'pointer'
                              }}
                              title={`Edit ${pl.name}`}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteEchelon('platoon', pl, selectedCoId)}
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fca5a5',
                                borderRadius: '6px',
                                padding: '4px 6px',
                                color: '#dc2626',
                                cursor: 'pointer'
                              }}
                              title={`Delete ${pl.name}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: UNIT BRANDING
          ========================================================================= */}
      {activeTab === 'branding' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {/* Unit Command Profile */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Landmark size={20} />
                <span>Unit Command Profile</span>
              </div>
              <span className="badge badge-present">COMMAND PROFILE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Unit Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.unitName}
                  onChange={(e) => handleChange('unitName', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Commanding Officer / Commandant
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.commandingOfficer}
                  onChange={(e) => handleChange('commandingOfficer', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Host Institution
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.hostInstitution}
                  onChange={(e) => handleChange('hostInstitution', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Parent Command / Division
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.parentCommand}
                  onChange={(e) => handleChange('parentCommand', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
              </div>
            </div>
          </div>

          {/* Official Seals & Logos */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <ImageIcon size={20} />
                <span>Official Seals & Logos</span>
              </div>
              <span className="badge badge-present">BRANDING ASSETS</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* ROTC Unit Seal */}
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.75rem' }}>
                  Official ROTC Unit Seal
                </div>
                <div style={{ width: '90px', height: '90px', margin: '0 auto 0.75rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={settings.rotcSealUrl || '/rotc-seal-transparent.png'} alt="ROTC Seal" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <input
                  type="file"
                  ref={rotcSealInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e, 'rotcSealUrl')}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => rotcSealInputRef.current?.click()}
                  style={{ width: '100%', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  <Upload size={14} /> Upload Seal
                </button>
              </div>

              {/* University Logo */}
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.75rem' }}>
                  University / College Logo
                </div>
                <div style={{ width: '90px', height: '90px', margin: '0 auto 0.75rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={settings.universityLogoUrl || '/csu-logo.png'} alt="University Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.src = '/rotc-seal-transparent.png'; }} />
                </div>
                <input
                  type="file"
                  ref={univLogoInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e, 'universityLogoUrl')}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => univLogoInputRef.current?.click()}
                  style={{ width: '100%', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  <Upload size={14} /> Upload Logo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: DATA MANAGEMENT & EXPORTS
          ========================================================================= */}
      {activeTab === 'storage' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {/* Storage Paths & Sync */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Database size={20} />
                <span>Data Directories & Backups</span>
              </div>
              <span className="badge badge-present">STORAGE ENGINE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Excel Export Directory
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.exportDirectory}
                  onChange={(e) => handleChange('exportDirectory', e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Location where periodic master .xlsx reports are generated.
                </span>
              </div>

              {/* JSON Backup & Restore Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDownloadBackup}
                  style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  <Download size={16} />
                  <span>Download Backup JSON</span>
                </button>

                <input
                  type="file"
                  ref={backupFileInputRef}
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleRestoreBackup}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => backupFileInputRef.current?.click()}
                  style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  <Upload size={16} />
                  <span>Restore from Backup</span>
                </button>
              </div>
            </div>
          </div>

          {/* Official Excel Report Letterhead & Signatories Card */}
          <div className="card" style={{ border: '1px solid var(--border-light)' }}>
            <div className="card-header">
              <div className="card-title">
                <FileSpreadsheet size={20} style={{ color: 'var(--rotc-green-dark)' }} />
                <span>Official Excel Report Letterhead & Signatories</span>
              </div>
              <span className="badge badge-present">EXCEL LETTERHEAD</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Configure the official military letterhead text (Motto, Headquarters, Parent Command, Unit Name, Location, and Commandant / Signatory titles) automatically printed on every <code>[Company] - [Platoon]</code> sheet when saving attendance to Excel.
              </p>

              <button
                type="button"
                className="btn btn-gold"
                onClick={() => setIsLetterheadModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 800,
                  padding: '0.65rem 1rem'
                }}
              >
                <Settings size={16} /> Open Letterhead & Signatories Editor
              </button>
            </div>
          </div>

          {/* Card 3: Database & Cloud Roster Management */}
          <div className="card" style={{ border: '1px solid #fca5a5', background: '#fffafb', gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div className="card-title" style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={20} color="#dc2626" />
                <span>Database & Cloud Roster Maintenance</span>
              </div>
              <span className="badge badge-absent">ADMIN PURGE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.84rem', color: '#7f1d1d', margin: 0, lineHeight: 1.5 }}>
                Manage or wipe database records stored in Supabase and local browser cache. Use caution when wiping master cadets or attendance logs.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Clear Cadets */}
                <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#991b1b', marginBottom: '4px' }}>
                      Clear Cadets Directory
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Deletes all registered cadets from Supabase <code>cadets</code> table and clears local cadet roster cache.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleClearCadetsFromApp}
                    disabled={isClearingCadets}
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 700,
                      borderRadius: '7px',
                      padding: '0.55rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: 'none',
                      cursor: isClearingCadets ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Trash2 size={15} />
                    <span>{isClearingCadets ? 'Clearing Cadets...' : 'Clear All Cadets in Supabase & Local'}</span>
                  </button>
                </div>

                {/* Clear Attendance */}
                <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#991b1b', marginBottom: '4px' }}>
                      Clear Attendance Logs
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Deletes all scan history from Supabase <code>attendance_logs</code> table and clears local attendance records.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleClearAttendanceFromApp}
                    disabled={isClearingAttendance}
                    style={{
                      background: '#b91c1c',
                      color: '#ffffff',
                      fontWeight: 700,
                      borderRadius: '7px',
                      padding: '0.55rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: 'none',
                      cursor: isClearingAttendance ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Trash2 size={15} />
                    <span>{isClearingAttendance ? 'Clearing Logs...' : 'Clear All Attendance in Supabase & Local'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: ID PRINTING SETUP
          ========================================================================= */}
      {activeTab === 'idprinting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Row: 2 Equal-Width Columns (Command Signatory & Physical Card Specs) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem' }}>
            {/* Card 1: Signatory Profile */}
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                  <Printer size={20} />
                  <span>Command Signatory Profile</span>
                </div>
                <span className="badge badge-present">CARD SIGNATORY</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    Authorized Signatory Full Name & Rank
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.signatoryName}
                    onChange={(e) => handleChange('signatoryName', e.target.value)}
                    style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    Signatory Designation / Position
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.signatoryDesignation}
                    onChange={(e) => handleChange('signatoryDesignation', e.target.value)}
                    style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    Digital Signature Image
                  </label>
                  <input
                    type="file"
                    ref={signatureInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload(e, 'signatureImageUrl')}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => signatureInputRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                  >
                    <Upload size={14} /> Upload Transparent PNG Signature
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: CR80 Card Dimensions */}
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                  <Sliders size={20} />
                  <span>CR80 Physical Card Specs</span>
                </div>
                <span className="badge badge-present">CR80 PVC FORMAT</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    Print Orientation
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => handleChange('cardOrientation', 'vertical')}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: settings.cardOrientation === 'vertical' ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
                        background: settings.cardOrientation === 'vertical' ? '#ecfdf5' : '#ffffff',
                        color: settings.cardOrientation === 'vertical' ? 'var(--rotc-green-dark)' : 'var(--text-dark)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {settings.cardOrientation === 'vertical' && <Check size={16} />}
                      <span>Vertical (Portrait)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChange('cardOrientation', 'horizontal')}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: settings.cardOrientation === 'horizontal' ? '2px solid var(--rotc-green-dark)' : '1px solid var(--border-light)',
                        background: settings.cardOrientation === 'horizontal' ? '#ecfdf5' : '#ffffff',
                        color: settings.cardOrientation === 'horizontal' ? 'var(--rotc-green-dark)' : 'var(--text-dark)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {settings.cardOrientation === 'horizontal' && <Check size={16} />}
                      <span>Horizontal (Landscape)</span>
                    </button>
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)' }}>Card Format Specification</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--rotc-green-dark)', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                      ISO/IEC 7810 ID-1
                    </span>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>
                    Standard CR80 (85.60 mm × 53.98 mm • 3.370" × 2.125")
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Calibrated for PVC ID Card Printers (Evolis, Zebra, Fargo) and A4 8-card sheets.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Dynamic Cadet Ranks & Officer Designations */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                <Award size={20} />
                <span>Manage Ranks & Officer Designations</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                <span className="badge badge-present">DYNAMIC OPTIONS</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {/* Section A: Cadet / Officer Ranks */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="var(--rotc-green-dark)" />
                    <span>Cadet Officer Ranks ({(settings.officerRanks || DEFAULT_OFFICER_RANKS).length})</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shown on ID Generator</span>
                </div>

                {/* Add Rank Input Form */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Cadet COL (ROTC) 1CL"
                    value={newRankInput}
                    onChange={(e) => setNewRankInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddRank(); }}
                    style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid var(--border-light)' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddRank}
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                  >
                    <Plus size={14} /> Add Rank
                  </button>
                </div>

                {/* Ranks Tag List / Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                  {(settings.officerRanks || DEFAULT_OFFICER_RANKS).map((r, idx) => (
                    <span
                      key={`${r}-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '20px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--text-dark)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <span>{r}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRank(r)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                          transition: 'color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        title={`Delete ${r}`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Section B: Officer Designations */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Award size={16} color="var(--rotc-green-dark)" />
                    <span>Officer Designations / Roles ({(settings.officerDesignations || DEFAULT_OFFICER_DESIGNATIONS).length})</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shown on ID Generator</span>
                </div>

                {/* Add Designation Input Form */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., S3 Assistant (Operations)"
                    value={newDesignationInput}
                    onChange={(e) => setNewDesignationInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDesignation(); }}
                    style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid var(--border-light)' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddDesignation}
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                  >
                    <Plus size={14} /> Add Designation
                  </button>
                </div>

                {/* Designations Tag List / Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                  {(settings.officerDesignations || DEFAULT_OFFICER_DESIGNATIONS).map((d, idx) => (
                    <span
                      key={`${d}-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '20px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--rotc-green-dark)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <span>{d}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDesignation(d)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                          transition: 'color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        title={`Delete ${d}`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DYNAMIC UNIT ECHELON ADD / EDIT MODAL
          ========================================================================= */}
      {isEchelonModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 15, 8, 0.75)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          zIndex: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
            border: `2px solid ${echelonModalConfig.level === 'battalion'
              ? '#2563eb'
              : echelonModalConfig.level === 'company'
                ? '#059669'
                : '#d97706'
              }`
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background:
                    echelonModalConfig.level === 'battalion'
                      ? '#dbeafe'
                      : echelonModalConfig.level === 'company'
                        ? '#d1fae5'
                        : '#fef3c7',
                  color:
                    echelonModalConfig.level === 'battalion'
                      ? '#1e40af'
                      : echelonModalConfig.level === 'company'
                        ? '#065f46'
                        : '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {echelonModalConfig.level === 'battalion' && <Shield size={20} />}
                  {echelonModalConfig.level === 'company' && <Building size={20} />}
                  {echelonModalConfig.level === 'platoon' && <Users size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-dark)', fontFamily: 'Oswald, sans-serif' }}>
                    {echelonModalConfig.mode === 'add' ? 'ADD NEW ' : 'EDIT '}
                    {echelonModalConfig.level.toUpperCase()}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {echelonModalConfig.level === 'battalion' && 'Level 1 Battalion Echelon'}
                    {echelonModalConfig.level === 'company' && `Level 2 Company under ${activeBattalion?.name || 'Battalion'}`}
                    {echelonModalConfig.level === 'platoon' && `Level 3 Platoon under ${activeCompany?.name || 'Company'}`}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEchelonModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Input Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Unit Display Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={
                    echelonModalConfig.level === 'battalion'
                      ? 'e.g., 3rd Battalion'
                      : echelonModalConfig.level === 'company'
                        ? 'e.g., Echo Company'
                        : 'e.g., 5th Platoon'
                  }
                  value={echelonModalConfig.item.name}
                  onChange={(e) => setEchelonModalConfig(prev => ({
                    ...prev,
                    item: { ...prev.item, name: e.target.value }
                  }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    Short Code / Acronym
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., 3BN, ECHO, 5PLTN"
                    value={echelonModalConfig.item.shortCode}
                    onChange={(e) => setEchelonModalConfig(prev => ({
                      ...prev,
                      item: { ...prev.item, shortCode: e.target.value.toUpperCase() }
                    }))}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    Target Capacity (Expected)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    placeholder="e.g., 592, 148, 37"
                    value={echelonModalConfig.item.targetQuota}
                    onChange={(e) => setEchelonModalConfig(prev => ({
                      ...prev,
                      item: { ...prev.item, targetQuota: parseInt(e.target.value) || 0 }
                    }))}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.95rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEchelonModalOpen(false)}
                style={{ padding: '0.75rem', fontWeight: 700 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveEchelonModal}
                style={{
                  background:
                    echelonModalConfig.level === 'battalion'
                      ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)'
                      : echelonModalConfig.level === 'company'
                        ? 'linear-gradient(135deg, #065f46 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                Save Echelon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DYNAMIC UNIT ECHELON DELETE CONFIRMATION MODAL
          ========================================================================= */}
      {isEchelonDeleteModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 15, 8, 0.8)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          zIndex: 750,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '420px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            border: '2px solid #fca5a5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', fontFamily: 'Oswald, sans-serif' }}>
                  DELETE {echelonDeleteConfig.level.toUpperCase()}?
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#7f1d1d' }}>Permanent Structure Removal</span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to delete <strong>{echelonDeleteConfig.item.name}</strong>?
              {echelonDeleteConfig.level === 'battalion' && ' All child companies and platoons belonging to this battalion will also be removed.'}
              {echelonDeleteConfig.level === 'company' && ' All child platoons under this company will also be removed.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEchelonDeleteModalOpen(false)}
                style={{ padding: '0.7rem', fontWeight: 700 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteEchelon}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.7rem',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
              >
                Delete Unit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={isResetRosterModalOpen}
        title="⚠️ Reset Cadet Master Roster?"
        message="Are you sure you want to regenerate the entire 1,184-cadet echelon hierarchy roster? Any custom modifications will be restored to standard template names."
        confirmLabel="Reset Roster"
        cancelLabel="Cancel"
        onConfirm={handleConfirmResetRoster}
        onCancel={() => setIsResetRosterModalOpen(false)}
        isDestructive={true}
      />

      {/* Password Protected Modal for Master Log Purge */}
      {isSecurePurgeModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 15, 8, 0.82)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            border: '1px solid #fca5a5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <KeyRound size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#991b1b', fontFamily: 'Oswald, sans-serif' }}>
                  SECURITY VERIFICATION REQUIRED
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#7f1d1d' }}>Master Attendance Log Purge</span>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Enter the Admin Security PIN to confirm purging all recorded attendance logs. Cadet roster cards will not be affected.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.35rem' }}>
                Admin PIN / Password (Default: 1501)
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter PIN (e.g. 1501)"
                value={purgePasswordInput}
                onChange={(e) => {
                  setPurgePasswordInput(e.target.value);
                  setPurgeErrorMsg('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteSecurePurge();
                }}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: purgeErrorMsg ? '1.5px solid #dc2626' : '1px solid #d1d5db', fontSize: '1rem', letterSpacing: '2px' }}
                autoFocus
              />
              {purgeErrorMsg && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>
                  {purgeErrorMsg}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsSecurePurgeModalOpen(false);
                  setPurgePasswordInput('');
                  setPurgeErrorMsg('');
                }}
                style={{ padding: '0.7rem', fontWeight: 700 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteSecurePurge}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.7rem',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Excel Report Letterhead & Signatories Modal */}
      <LetterheadSettingsModal
        isOpen={isLetterheadModalOpen}
        onClose={() => setIsLetterheadModalOpen(false)}
        onSaved={() => {
          setSaveSuccessToast("Excel letterhead configuration updated successfully.");
          setTimeout(() => setSaveSuccessToast(null), 3500);
        }}
      />
    </div>
  );
}
