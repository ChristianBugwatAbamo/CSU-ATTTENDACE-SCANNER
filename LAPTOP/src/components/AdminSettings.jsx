import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUnitStructure } from '../context/UnitContext';
import { getAutoBattalionName, getAutoCompanyName, getAutoPlatoonName } from './UnitManagement';
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
  EyeOff,
  Sliders,
  Plus,
  Edit2,
  FolderPlus,
  ChevronRight,
  Sparkles,
  CalendarRange,
  Info,
  X,
  IdCard,
  ArrowLeft,
  ArrowRight,
  Star,
  GripVertical,
  Pencil,
  Archive,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import LetterheadSettingsModal from './LetterheadSettingsModal';
import AcademicTermsTab from './AcademicTermsTab';
import { useAcademicTerm } from '../context/AcademicTermContext';
import { recalculateAttendanceLogs } from '../utils/attendanceStatus';
import {
  fetchSettingsFromSupabase,
  saveSettingsToSupabase,
  uploadBrandingAsset,
  syncSessionCutoffTime,
  clearCadetsFromSupabase,
  clearAttendanceFromSupabase,
  reassignCadetsCompany,
  checkUnitDependencies,
  reassignUnitDependencies,
  softArchiveUnitEchelon,
  restoreUnitEchelon,
  fetchSystemWidePlatoonCapacities,
  getSupabaseClient
} from '../utils/supabaseClient';

export { DEFAULT_UNIT_STRUCTURE, DEFAULT_HIERARCHY, STANDARD_BATTALIONS, STANDARD_COMPANIES, STANDARD_PLATOONS } from '../constants/defaultHierarchy.js';
import { DEFAULT_UNIT_STRUCTURE } from '../constants/defaultHierarchy.js';

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
  // Excuse Letter Workflow
  excuseGracePeriodDays: 3,
  excuseHardCutoffDatetime: '',

  // Tab 2: Dynamic Unit Structure & Echelons
  unitStructure: DEFAULT_UNIT_STRUCTURE,

  // Tab 2: Unit Branding & Passes (Unit Command Profile & Dynamic Hero Emblems)
  commandant: "LTC CHRISTIAN B ABAMO INF (GSC) PA",
  commandingOfficer: "LTC CHRISTIAN B ABAMO INF (GSC) PA",
  commandingOfficerTitle: "Commandant, CSU ROTC Unit",
  unit_name: "1501st CDC ROTC Unit",
  unitName: "1501st CDC ROTC Unit",
  school_name: "Caraga State University (CSU Main Campus, Ampayon, Butuan City)",
  hostInstitution: "Caraga State University (CSU Main Campus, Ampayon, Butuan City)",
  cdc_name: "1501st Community Defense Center",
  rcdg_name: "15th Regional Community Defense Group (15RCDG)",
  parentCommand: "15th Regional Community Defense Group (15RCDG)",
  hero_emblems: [
    { id: '1', label: '15th RCDG Seal', url: '/rcdg-logo.png', is_center: false, active: true },
    { id: '2', label: '1501st CDC Seal', url: '/cdc-logo.png', is_center: false, active: true },
    { id: '3', label: 'Official ROTC Unit Seal (Center)', url: '/rotc-seal-transparent.png', is_center: true, active: true },
    { id: '4', label: 'NSTP Logo', url: '/nstp-logo.png', is_center: false, active: true },
    { id: '5', label: 'University / College Logo', url: '/csu-logo.png', is_center: false, active: true }
  ],
  heroEmblems: [
    { id: '1', label: '15th RCDG Seal', url: '/rcdg-logo.png', is_center: false, active: true },
    { id: '2', label: '1501st CDC Seal', url: '/cdc-logo.png', is_center: false, active: true },
    { id: '3', label: 'Official ROTC Unit Seal (Center)', url: '/rotc-seal-transparent.png', is_center: true, active: true },
    { id: '4', label: 'NSTP Logo', url: '/nstp-logo.png', is_center: false, active: true },
    { id: '5', label: 'University / College Logo', url: '/csu-logo.png', is_center: false, active: true }
  ],
  rcdg_seal_url: "/rcdg-logo.png",
  rcdgSealUrl: "/rcdg-logo.png",
  cdc_seal_url: "/cdc-logo.png",
  cdcSealUrl: "/cdc-logo.png",
  rotc_seal_url: "/rotc-seal-transparent.png",
  rotcSealUrl: "/rotc-seal-transparent.png",
  nstp_logo_url: "/nstp-logo.png",
  nstpLogoUrl: "/nstp-logo.png",
  university_logo_url: "/csu-logo.png",
  universityLogoUrl: "/csu-logo.png",

  // Tab 4: Data Management & Exports
  exportDirectory: "./desktop_excel_reports/",
  letterheadConfig: null,
  autoExcelExport: true,
  autoBackupEnabled: true,

  // Tab 5: ID Printing Setup
  signatoryName: "COL CHARIS J ABAMO INF (GSC) PA",
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
  const { updateUnitStructure } = useUnitStructure();
  const { selectedTermId, activeTermId, selectedTerm, activeTerm } = useAcademicTerm();
  const currentTermId = selectedTermId || activeTermId;
  const isArchived = Boolean(
    selectedTerm &&
    (String(selectedTerm.status || '').toUpperCase() === 'ARCHIVED' || selectedTerm.is_archived === true)
  );

  // Live term-scoped cadets & platoon capacity counts
  const [liveTermCadets, setLiveTermCadets] = useState(null);
  const [livePlatoonHeadcounts, setLivePlatoonHeadcounts] = useState({});

  // Active top tab: 'structure' | 'branding' | 'storage' | 'terms'
  const [activeTab, setActiveTab] = useState('structure');

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(null);
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);

  // Print Orientation State for QR Pass & Layout Setup ('portrait' | 'landscape')
  const [orientation, setOrientation] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_print_orientation');
      if (saved === 'portrait' || saved === 'landscape') return saved;
    } catch (_) { }
    return 'landscape';
  });

  const handleOrientationChange = (newOrientation) => {
    if (isArchived) return;
    setOrientation(newOrientation);
    handleChange('cardOrientation', newOrientation === 'portrait' ? 'vertical' : 'horizontal');
    handleChange('printOrientation', newOrientation);
    try {
      localStorage.setItem('csu_rotc_print_orientation', newOrientation);
      window.dispatchEvent(new Event('csu_rotc_orientation_change'));
    } catch (_) { }
  };

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

  // Echelon Safe Delete & 'Reassign Cadets First' Modal State
  const [checkingDeleteUnitId, setCheckingDeleteUnitId] = useState(null);
  const [isReassignCadetsModalOpen, setIsReassignCadetsModalOpen] = useState(false);
  const [reassignModalConfig, setReassignModalConfig] = useState({
    level: 'battalion',
    parentId: null,
    parentBnId: null,
    parentCoId: null,
    battalionName: '',
    companyName: '',
    item: { id: '', name: '' },
    cadetCount: 0,
    logCount: 0,
    sampleCadets: []
  });
  const [reassignTargetUnit, setReassignTargetUnit] = useState({
    id: '',
    name: '',
    battalionName: '',
    companyName: '',
    platoonName: '',
    defaultCompanyName: '',
    defaultPlatoonName: ''
  });
  const [systemPlatoonCapacities, setSystemPlatoonCapacities] = useState({});
  const [isReassigningAndDeleting, setIsReassigningAndDeleting] = useState(false);
  const [showArchivedUnits, setShowArchivedUnits] = useState(false);
  const [isReassigningOrphans, setIsReassigningOrphans] = useState(false);

  // Modals & Security Verification
  const [isResetRosterModalOpen, setIsResetRosterModalOpen] = useState(false);

  // Secure Wipe Modal State
  const [isSecurePurgeModalOpen, setIsSecurePurgeModalOpen] = useState(false);
  const [purgePasswordInput, setPurgePasswordInput] = useState('');
  const [purgeErrorMsg, setPurgeErrorMsg] = useState('');

  // Logo / File Upload Refs
  const rcdgSealInputRef = useRef(null);
  const cdcSealInputRef = useRef(null);
  const rotcSealInputRef = useRef(null);
  const nstpLogoInputRef = useRef(null);
  const univLogoInputRef = useRef(null);
  const dynamicEmblemFileInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const backupFileInputRef = useRef(null);

  const [activeUploadEmblemId, setActiveUploadEmblemId] = useState(null);
  const [uploadingSlot, setUploadingSlot] = useState(null);

  // Hero Emblems drag-and-drop, edit modal & hover tooltip states
  const [editingEmblem, setEditingEmblem] = useState(null);
  const [hoveredEmblemId, setHoveredEmblemId] = useState(null);
  const [draggedEmblemIndex, setDraggedEmblemIndex] = useState(null);
  const [dragOverEmblemIndex, setDragOverEmblemIndex] = useState(null);
  const [modalUploadLoading, setModalUploadLoading] = useState(false);
  const modalFileInputRef = useRef(null);

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
          const loadedUnitStructure = (Array.isArray(sbSettings.unit_structure) && sbSettings.unit_structure.length > 0)
            ? sbSettings.unit_structure
            : (Array.isArray(sbSettings.unitStructure) && sbSettings.unitStructure.length > 0 ? sbSettings.unitStructure : DEFAULT_UNIT_STRUCTURE);
          const loadedCommandant = sbSettings.commandant || sbSettings.commanding_officer || sbSettings.commandingOfficer || DEFAULT_SETTINGS.commandant;
          const loadedUnitName = sbSettings.unit_name || sbSettings.unitName || DEFAULT_SETTINGS.unit_name;
          const loadedSchoolName = sbSettings.school_name || sbSettings.host_institution || sbSettings.hostInstitution || DEFAULT_SETTINGS.school_name;
          const loadedCdcName = sbSettings.cdc_name || DEFAULT_SETTINGS.cdc_name;
          const loadedRcdgName = sbSettings.rcdg_name || sbSettings.parent_command || sbSettings.parentCommand || DEFAULT_SETTINGS.rcdg_name;
          const loadedOfficerTitle = sbSettings.commanding_officer_title || DEFAULT_SETTINGS.commandingOfficerTitle;
          const loadedSignatoryName = sbSettings.id_signatory_name || loadedCommandant;
          const loadedSignatoryTitle = sbSettings.id_signatory_title || loadedOfficerTitle;

          let loadedHeroEmblems = DEFAULT_SETTINGS.hero_emblems;
          if (Array.isArray(sbSettings.hero_emblems) && sbSettings.hero_emblems.length > 0) {
            loadedHeroEmblems = sbSettings.hero_emblems;
          } else if (typeof sbSettings.hero_emblems === 'string') {
            try {
              const parsed = JSON.parse(sbSettings.hero_emblems);
              if (Array.isArray(parsed) && parsed.length > 0) loadedHeroEmblems = parsed;
            } catch (_) { }
          } else if (sbSettings.rcdg_seal_url || sbSettings.cdc_seal_url || sbSettings.rotc_seal_url) {
            loadedHeroEmblems = [
              { id: '1', label: '15th RCDG Seal', url: sbSettings.rcdg_seal_url || '/rcdg-logo.png', is_center: false, active: true },
              { id: '2', label: '1501st CDC Seal', url: sbSettings.cdc_seal_url || '/cdc-logo.png', is_center: false, active: true },
              { id: '3', label: 'Official ROTC Unit Seal (Center)', url: sbSettings.rotc_seal_url || '/rotc-seal-transparent.png', is_center: true, active: true },
              { id: '4', label: 'NSTP Logo', url: sbSettings.nstp_logo_url || '/nstp-logo.png', is_center: false, active: true },
              { id: '5', label: 'University / College Logo', url: sbSettings.university_logo_url || '/csu-logo.png', is_center: false, active: true }
            ];
          }

          let termProfiles = sbSettings.term_command_profiles || sbSettings.termCommandProfiles || {};
          if (typeof termProfiles === 'string') {
            try { termProfiles = JSON.parse(termProfiles); } catch (_) {}
          }

          // If a command profile exists for the currently selected term, use it
          const activeTermProfile = currentTermId && termProfiles[currentTermId] ? termProfiles[currentTermId] : null;
          const finalCommandant = activeTermProfile?.commandant || activeTermProfile?.commanding_officer || loadedCommandant;
          const finalOfficerTitle = activeTermProfile?.commanding_officer_title || activeTermProfile?.commandingOfficerTitle || loadedOfficerTitle;
          const finalUnitName = activeTermProfile?.unit_name || loadedUnitName;
          const finalSchoolName = activeTermProfile?.school_name || loadedSchoolName;
          const finalCdcName = activeTermProfile?.cdc_name || loadedCdcName;
          const finalRcdgName = activeTermProfile?.rcdg_name || loadedRcdgName;

          finalSettings = {
            ...DEFAULT_SETTINGS,
            ...sbSettings,
            term_command_profiles: termProfiles,
            termCommandProfiles: termProfiles,
            morningCutoffTime: loadedCutoff,
            formationCutoffTime: loadedCutoff,
            formationTardyGrace: sbSettings.formation_tardy_grace ?? DEFAULT_SETTINGS.formationTardyGrace,
            cadetQuotaPerPlatoon: sbSettings.cadet_quota_per_platoon ?? DEFAULT_SETTINGS.cadetQuotaPerPlatoon,
            totalUnitTarget: sbSettings.total_unit_target ?? DEFAULT_SETTINGS.totalUnitTarget,
            excuseGracePeriodDays: sbSettings.excuse_grace_period_days ?? DEFAULT_SETTINGS.excuseGracePeriodDays,
            unitStructure: loadedUnitStructure,
            unit_structure: loadedUnitStructure,
            commandant: finalCommandant,
            commandingOfficer: finalCommandant,
            commanding_officer: finalCommandant,
            commandingOfficerTitle: finalOfficerTitle,
            commanding_officer_title: finalOfficerTitle,
            unit_name: finalUnitName,
            unitName: finalUnitName,
            school_name: finalSchoolName,
            hostInstitution: finalSchoolName,
            host_institution: finalSchoolName,
            cdc_name: finalCdcName,
            rcdg_name: finalRcdgName,
            parentCommand: finalRcdgName,
            parent_command: finalRcdgName,
            hero_emblems: loadedHeroEmblems,
            heroEmblems: loadedHeroEmblems,
            rcdg_seal_url: sbSettings.rcdg_seal_url || sbSettings.rcdgSealUrl || DEFAULT_SETTINGS.rcdg_seal_url,
            rcdgSealUrl: sbSettings.rcdg_seal_url || sbSettings.rcdgSealUrl || DEFAULT_SETTINGS.rcdgSealUrl,
            cdc_seal_url: sbSettings.cdc_seal_url || sbSettings.cdcSealUrl || DEFAULT_SETTINGS.cdc_seal_url,
            cdcSealUrl: sbSettings.cdc_seal_url || sbSettings.cdcSealUrl || DEFAULT_SETTINGS.cdcSealUrl,
            rotc_seal_url: sbSettings.rotc_seal_url || sbSettings.rotcSealUrl || DEFAULT_SETTINGS.rotc_seal_url,
            rotcSealUrl: sbSettings.rotc_seal_url || sbSettings.rotcSealUrl || DEFAULT_SETTINGS.rotcSealUrl,
            nstp_logo_url: sbSettings.nstp_logo_url || sbSettings.nstpLogoUrl || DEFAULT_SETTINGS.nstp_logo_url,
            nstpLogoUrl: sbSettings.nstp_logo_url || sbSettings.nstpLogoUrl || DEFAULT_SETTINGS.nstpLogoUrl,
            university_logo_url: sbSettings.university_logo_url || sbSettings.universityLogoUrl || DEFAULT_SETTINGS.university_logo_url,
            universityLogoUrl: sbSettings.university_logo_url || sbSettings.universityLogoUrl || DEFAULT_SETTINGS.universityLogoUrl,
            exportDirectory: sbSettings.excel_export_path || DEFAULT_SETTINGS.exportDirectory,
            letterheadConfig: sbSettings.letterhead_config || DEFAULT_SETTINGS.letterheadConfig,
            autoBackupEnabled: sbSettings.auto_backup_enabled !== false,
            signatoryName: loadedSignatoryName,
            id_signatory_name: loadedSignatoryName,
            signatoryDesignation: loadedSignatoryTitle,
            id_signatory_title: loadedSignatoryTitle,
            signatureImageUrl: sbSettings.id_signature_url || DEFAULT_SETTINGS.signatureImageUrl,
            cardOrientation: sbSettings.id_card_orientation || DEFAULT_SETTINGS.cardOrientation,
            officerRanks: (Array.isArray(sbSettings.officer_ranks_list) && sbSettings.officer_ranks_list.length > 0) ? sbSettings.officer_ranks_list : (sbSettings.officerRanks || DEFAULT_OFFICER_RANKS),
            officerDesignations: (Array.isArray(sbSettings.officer_roles_list) && sbSettings.officer_roles_list.length > 0) ? sbSettings.officer_roles_list : (sbSettings.officerDesignations || DEFAULT_OFFICER_DESIGNATIONS)
          };
        }
      } catch (_) { }

      // 2. Local fallback if Supabase not yet populated
      if (!finalSettings || Object.keys(finalSettings).length <= 5) {
        try {
          const res = await fetch('/api/settings');
          if (res.ok) {
            const data = await res.json();
            const loadedLocalStructure = (Array.isArray(data.unit_structure) && data.unit_structure.length > 0)
              ? data.unit_structure
              : (Array.isArray(data.unitStructure) && data.unitStructure.length > 0 ? data.unitStructure : DEFAULT_UNIT_STRUCTURE);
            const localOfficer = data.commandingOfficer || data.commanding_officer || DEFAULT_SETTINGS.commandingOfficer;
            const localTitle = data.commandingOfficerTitle || data.commanding_officer_title || DEFAULT_SETTINGS.commandingOfficerTitle;
            const localSignatory = data.signatoryName || data.id_signatory_name || localOfficer;
            const localSignatoryTitle = data.signatoryDesignation || data.id_signatory_title || localTitle;
            finalSettings = {
              ...DEFAULT_SETTINGS,
              ...data,
              morningCutoffTime: data.morningCutoffTime || data.formationCutoffTime || DEFAULT_SETTINGS.morningCutoffTime,
              formationCutoffTime: data.morningCutoffTime || data.formationCutoffTime || DEFAULT_SETTINGS.formationCutoffTime,
              unitStructure: loadedLocalStructure,
              unit_structure: loadedLocalStructure,
              commandingOfficer: localOfficer,
              commanding_officer: localOfficer,
              commandingOfficerTitle: localTitle,
              commanding_officer_title: localTitle,
              signatoryName: localSignatory,
              id_signatory_name: localSignatory,
              signatoryDesignation: localSignatoryTitle,
              id_signatory_title: localSignatoryTitle,
              officerRanks: data.officerRanks && data.officerRanks.length > 0 ? data.officerRanks : DEFAULT_OFFICER_RANKS,
              officerDesignations: data.officerDesignations && data.officerDesignations.length > 0 ? data.officerDesignations : DEFAULT_OFFICER_DESIGNATIONS
            };
          }
        } catch (_) { }
      }

      const loadedOri = finalSettings.printOrientation || finalSettings.print_orientation || (finalSettings.cardOrientation === 'vertical' || finalSettings.id_card_orientation === 'vertical' ? 'portrait' : 'landscape');
      if (loadedOri === 'portrait' || loadedOri === 'landscape') {
        setOrientation(loadedOri);
        try { localStorage.setItem('csu_rotc_print_orientation', loadedOri); } catch (_) { }
      }

      setSettings(finalSettings);
      setSavedSettings(finalSettings);
    };
    loadSettings();
  }, []);

  // Live query for cadets and platoon capacities scoped to currentTermId
  useEffect(() => {
    let cancelled = false;
    const fetchTermData = async () => {
      if (!currentTermId) return;
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('cadets')
            .select('id, name, rank, battalion, company, platoon, battalion_id, company_id, platoon_id, academic_term_id')
            .eq('academic_term_id', currentTermId);
          if (!error && Array.isArray(data) && !cancelled) {
            setLiveTermCadets(data);
          }
        }
        const capacities = await fetchSystemWidePlatoonCapacities(currentTermId);
        if (!cancelled && capacities) {
          setLivePlatoonHeadcounts(capacities);
          setSystemPlatoonCapacities(capacities);
        }
      } catch (err) {
        console.warn('Error fetching term-scoped cadets in AdminSettings:', err);
      }
    };
    fetchTermData();
    return () => { cancelled = true; };
  }, [currentTermId]);

  // Dynamically load Command Profile for currentTermId
  useEffect(() => {
    if (!currentTermId) return;
    const termProfiles = settings.term_command_profiles || settings.termCommandProfiles || {};
    let profile = termProfiles[currentTermId] || null;

    if (!profile) {
      try {
        const local = JSON.parse(localStorage.getItem('csu_rotc_term_command_profiles') || '{}');
        if (local[currentTermId]) profile = local[currentTermId];
      } catch (_) {}
    }

    if (!profile && selectedTerm) {
      if (selectedTerm.commandant || selectedTerm.commanding_officer || selectedTerm.unit_name || selectedTerm.school_name) {
        profile = {
          commandant: selectedTerm.commandant || selectedTerm.commanding_officer,
          commandingOfficer: selectedTerm.commandant || selectedTerm.commanding_officer,
          commanding_officer: selectedTerm.commandant || selectedTerm.commanding_officer,
          commandingOfficerTitle: selectedTerm.commanding_officer_title || selectedTerm.commandingOfficerTitle,
          unit_name: selectedTerm.unit_name,
          school_name: selectedTerm.school_name,
          cdc_name: selectedTerm.cdc_name,
          rcdg_name: selectedTerm.rcdg_name
        };
      }
    }

    if (profile) {
      setSettings(prev => ({
        ...prev,
        commandant: profile.commandant || profile.commanding_officer || prev.commandant,
        commandingOfficer: profile.commandant || profile.commanding_officer || prev.commandingOfficer,
        commanding_officer: profile.commandant || profile.commanding_officer || prev.commanding_officer,
        commandingOfficerTitle: profile.commanding_officer_title || profile.commandingOfficerTitle || prev.commandingOfficerTitle,
        commanding_officer_title: profile.commanding_officer_title || profile.commandingOfficerTitle || prev.commanding_officer_title,
        unit_name: profile.unit_name || prev.unit_name,
        unitName: profile.unit_name || prev.unitName,
        school_name: profile.school_name || prev.school_name,
        hostInstitution: profile.school_name || prev.hostInstitution,
        cdc_name: profile.cdc_name || prev.cdc_name,
        rcdg_name: profile.rcdg_name || prev.rcdg_name,
        parentCommand: profile.rcdg_name || prev.parentCommand
      }));
    }
  }, [currentTermId, selectedTerm]);

  // Keyboard shortcut Ctrl+S / Cmd+S to Save All Settings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isArchived) return;
        handleSaveSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, orientation, isArchived]);

  const handleChange = (field, value) => {
    if (isArchived) return;
    setSettings(prev => {
      const next = { ...prev, [field]: value };
      // 👈 Automatically sync ID Signatory name & title whenever Commandant is modified
      if (field === 'commandant' || field === 'commandingOfficer') {
        next.commandant = value;
        next.commandingOfficer = value;
        next.commanding_officer = value;
        next.signatoryName = value;
        next.id_signatory_name = value;
      } else if (field === 'unit_name' || field === 'unitName') {
        next.unit_name = value;
        next.unitName = value;
      } else if (field === 'school_name' || field === 'hostInstitution') {
        next.school_name = value;
        next.hostInstitution = value;
        next.host_institution = value;
      } else if (field === 'cdc_name') {
        next.cdc_name = value;
      } else if (field === 'rcdg_name' || field === 'parentCommand') {
        next.rcdg_name = value;
        next.parentCommand = value;
        next.parent_command = value;
      } else if (field === 'commandingOfficerTitle') {
        next.commanding_officer_title = value;
        next.signatoryDesignation = value;
        next.id_signatory_title = value;
      } else if (field === 'signatoryName') {
        next.id_signatory_name = value;
      } else if (field === 'signatoryDesignation') {
        next.id_signatory_title = value;
      }
      return next;
    });
  };

  // Save Settings Handler (Centralized for all 4 tabs with payload sanitization & network timeout guard)
  const handleSaveSettings = async (e, customSettings = null) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (isArchived) {
      alert('🔒 Settings are locked for archived academic terms. Please switch to the Current term to make changes.');
      return;
    }
    setIsSaving(true);

    // Timeout helper to guarantee async operations never hang indefinitely
    const withTimeout = (promise, ms = 7500, fallbackVal = null) =>
      Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => {
          console.warn(`Save operation timed out after ${ms}ms, continuing gracefully...`);
          resolve(fallbackVal);
        }, ms))
      ]);

    const rawToSave = customSettings || settings;
    const newCutoff = rawToSave.morningCutoffTime || rawToSave.formationCutoffTime || (rawToSave.musterAndUnit && rawToSave.musterAndUnit.timeInCutoff) || '07:30';
    const activeUnitStructure = rawToSave.unit_structure || rawToSave.unitStructure || currentStructure || DEFAULT_UNIT_STRUCTURE;
    const activeCommandant = rawToSave.commandant || rawToSave.commandingOfficer || rawToSave.commanding_officer || 'LTC CHRISTIAN B ABAMO INF (GSC) PA';
    const activeUnitName = rawToSave.unit_name || rawToSave.unitName || '1501st CDC ROTC Unit';
    const activeSchoolName = rawToSave.school_name || rawToSave.hostInstitution || rawToSave.host_institution || 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)';
    const activeCdcName = rawToSave.cdc_name || '1501st Community Defense Center';
    const activeRcdgName = rawToSave.rcdg_name || rawToSave.parentCommand || rawToSave.parent_command || '15th Regional Community Defense Group (15RCDG)';
    const activeOfficerTitle = rawToSave.commandingOfficerTitle || rawToSave.commanding_officer_title || 'Commandant, CSU ROTC Unit';
    const activeSignatoryName = rawToSave.signatoryName || activeCommandant;
    const activeSignatoryTitle = rawToSave.signatoryDesignation || activeOfficerTitle;

    // 1. Sanitize hero_emblems to ensure pure JSON serializable array (zero DOM refs, zero circular refs)
    const rawHeroEmblems = Array.isArray(rawToSave.hero_emblems) && rawToSave.hero_emblems.length > 0
      ? rawToSave.hero_emblems
      : (Array.isArray(rawToSave.heroEmblems) && rawToSave.heroEmblems.length > 0 ? rawToSave.heroEmblems : DEFAULT_SETTINGS.hero_emblems);

    const sanitizedHeroEmblems = rawHeroEmblems.map((emblem, index) => ({
      id: String(emblem?.id || `emblem-${index + 1}`),
      label: String(emblem?.label || `Seal ${index + 1}`).trim(),
      url: String(emblem?.url || '/rotc-seal-transparent.png').trim(),
      is_center: Boolean(emblem?.is_center),
      active: emblem?.active !== false
    }));

    const cleanHeroEmblems = JSON.parse(JSON.stringify(sanitizedHeroEmblems));
    const centerEmblem = cleanHeroEmblems.find(e => e.is_center) || cleanHeroEmblems[Math.floor(cleanHeroEmblems.length / 2)] || cleanHeroEmblems[0];

    // Maintain per-term command profiles dictionary
    const currentProfilesMap = {
      ...(rawToSave.term_command_profiles || {}),
      ...(rawToSave.termCommandProfiles || {})
    };
    if (currentTermId) {
      currentProfilesMap[currentTermId] = {
        commandant: activeCommandant,
        commanding_officer: activeCommandant,
        commandingOfficer: activeCommandant,
        commanding_officer_title: activeOfficerTitle,
        commandingOfficerTitle: activeOfficerTitle,
        unit_name: activeUnitName,
        unitName: activeUnitName,
        school_name: activeSchoolName,
        hostInstitution: activeSchoolName,
        cdc_name: activeCdcName,
        rcdg_name: activeRcdgName,
        parentCommand: activeRcdgName
      };
      try {
        localStorage.setItem('csu_rotc_term_command_profiles', JSON.stringify(currentProfilesMap));
      } catch (_) {}
    }

    const toSave = {
      ...rawToSave,
      term_command_profiles: currentProfilesMap,
      termCommandProfiles: currentProfilesMap,
      hero_emblems: cleanHeroEmblems,
      heroEmblems: cleanHeroEmblems,
      printOrientation: orientation,
      print_orientation: orientation,
      cardOrientation: orientation === 'portrait' ? 'vertical' : 'horizontal',
      id_card_orientation: orientation === 'portrait' ? 'vertical' : 'horizontal',
      commandant: activeCommandant,
      commandingOfficer: activeCommandant,
      commanding_officer: activeCommandant,
      commandingOfficerTitle: activeOfficerTitle,
      commanding_officer_title: activeOfficerTitle,
      unit_name: activeUnitName,
      unitName: activeUnitName,
      school_name: activeSchoolName,
      hostInstitution: activeSchoolName,
      host_institution: activeSchoolName,
      cdc_name: activeCdcName,
      rcdg_name: activeRcdgName,
      parentCommand: activeRcdgName,
      parent_command: activeRcdgName,
      rotc_seal_url: centerEmblem?.url || rawToSave.rotc_seal_url || '/rotc-seal-transparent.png',
      rotcSealUrl: centerEmblem?.url || rawToSave.rotcSealUrl || '/rotc-seal-transparent.png',
      rcdg_seal_url: cleanHeroEmblems[0]?.url || rawToSave.rcdg_seal_url || '/rcdg-logo.png',
      rcdgSealUrl: cleanHeroEmblems[0]?.url || rawToSave.rcdgSealUrl || '/rcdg-logo.png',
      cdc_seal_url: cleanHeroEmblems[1]?.url || rawToSave.cdc_seal_url || '/cdc-logo.png',
      cdcSealUrl: cleanHeroEmblems[1]?.url || rawToSave.cdcSealUrl || '/cdc-logo.png',
      nstp_logo_url: cleanHeroEmblems[3]?.url || rawToSave.nstp_logo_url || '/nstp-logo.png',
      nstpLogoUrl: cleanHeroEmblems[3]?.url || rawToSave.nstpLogoUrl || '/nstp-logo.png',
      university_logo_url: cleanHeroEmblems[4]?.url || rawToSave.university_logo_url || '/csu-logo.png',
      universityLogoUrl: cleanHeroEmblems[4]?.url || rawToSave.universityLogoUrl || '/csu-logo.png',
      signatoryName: activeSignatoryName,
      id_signatory_name: activeSignatoryName,
      signatoryDesignation: activeSignatoryTitle,
      id_signatory_title: activeSignatoryTitle,
      morningCutoffTime: newCutoff,
      formationCutoffTime: newCutoff,
      unitStructure: activeUnitStructure,
      unit_structure: activeUnitStructure,
      updated_at: new Date().toISOString()
    };

    try {
      try {
        localStorage.setItem('csu_rotc_print_orientation', orientation);
        window.dispatchEvent(new Event('csu_rotc_orientation_change'));
      } catch (_) { }

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

      // 2. Persist to localStorage safely
      try {
        localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(toSave));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('local-attendance-update'));
        window.dispatchEvent(new CustomEvent('csu_settings_updated', { detail: toSave }));
      } catch (errLocal) {
        console.warn('Local storage write warning:', errLocal);
      }

      // 3. Save directly to Supabase Cloud system_settings with network timeout guard
      let cloudResult = null;
      try {
        cloudResult = await withTimeout(saveSettingsToSupabase(toSave), 8000, { timedOut: true });
        await withTimeout(syncSessionCutoffTime(newCutoff), 4000, null);

        // Also persist command profile directly onto academic_terms row if currentTermId exists
        if (currentTermId) {
          try {
            const client = getSupabaseClient();
            if (client) {
              await client
                .from('academic_terms')
                .update({
                  commandant: activeCommandant,
                  commanding_officer: activeCommandant,
                  commanding_officer_title: activeOfficerTitle,
                  unit_name: activeUnitName,
                  school_name: activeSchoolName,
                  cdc_name: activeCdcName,
                  rcdg_name: activeRcdgName,
                  command_profile: {
                    commandant: activeCommandant,
                    commanding_officer_title: activeOfficerTitle,
                    unit_name: activeUnitName,
                    school_name: activeSchoolName,
                    cdc_name: activeCdcName,
                    rcdg_name: activeRcdgName
                  }
                })
                .eq('id', currentTermId);
            }
          } catch (_) {}
        }
      } catch (errCloud) {
        console.warn('Supabase save settings network warning:', errCloud?.message || errCloud);
      }

      // 4. Save to local node server if available
      try {
        await withTimeout(
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toSave)
          }),
          4000,
          null
        );
      } catch (_) { }

      setSavedSettings(toSave);
      if (cloudResult?.missingUnitStructure) {
        setSaveSuccessToast('Settings saved locally. Note: Run the SQL migration in Supabase SQL Editor to enable Cloud sync for Unit Structure.');
      } else if (cloudResult?.timedOut) {
        setSaveSuccessToast('Settings saved locally. Note: Cloud database sync timed out, local cache is up to date.');
      } else {
        setSaveSuccessToast('All settings & unit configurations saved successfully!');
      }
    } catch (err) {
      console.error('Save settings error:', err);
      setSavedSettings(toSave);
      setSaveSuccessToast('Settings saved locally.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  const handleSaveAllSettings = handleSaveSettings;

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
    if (window.confirm('Reset Officer Ranks and Staff Designations to military defaults in draft state? (Click "SAVE ALL" to commit)')) {
      setSettings(prev => ({
        ...prev,
        officerRanks: DEFAULT_OFFICER_RANKS,
        officerDesignations: DEFAULT_OFFICER_DESIGNATIONS
      }));
    }
  };

  // Image Upload Handlers with Supabase Storage Support
  const handleImageUpload = async (e, fieldKey, slotName = 'Logo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlot(fieldKey);
    try {
      const uploadedUrl = await uploadBrandingAsset(file, slotName);
      if (uploadedUrl) {
        setSettings(prev => ({
          ...prev,
          [fieldKey]: uploadedUrl,
          ...(fieldKey === 'rcdg_seal_url' || fieldKey === 'rcdgSealUrl' ? { rcdg_seal_url: uploadedUrl, rcdgSealUrl: uploadedUrl } : {}),
          ...(fieldKey === 'cdc_seal_url' || fieldKey === 'cdcSealUrl' ? { cdc_seal_url: uploadedUrl, cdcSealUrl: uploadedUrl } : {}),
          ...(fieldKey === 'rotc_seal_url' || fieldKey === 'rotcSealUrl' ? { rotc_seal_url: uploadedUrl, rotcSealUrl: uploadedUrl } : {}),
          ...(fieldKey === 'nstp_logo_url' || fieldKey === 'nstpLogoUrl' ? { nstp_logo_url: uploadedUrl, nstpLogoUrl: uploadedUrl } : {}),
          ...(fieldKey === 'university_logo_url' || fieldKey === 'universityLogoUrl' ? { university_logo_url: uploadedUrl, universityLogoUrl: uploadedUrl } : {})
        }));
        setSaveSuccessToast(`${slotName} uploaded successfully! Click "SAVE ALL" to commit.`);
      }
    } catch (err) {
      console.error('Failed to upload image asset:', err);
      // Fallback to FileReader base64
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Data = uploadEvent.target.result;
        setSettings(prev => ({
          ...prev,
          [fieldKey]: base64Data,
          ...(fieldKey === 'rcdg_seal_url' || fieldKey === 'rcdgSealUrl' ? { rcdg_seal_url: base64Data, rcdgSealUrl: base64Data } : {}),
          ...(fieldKey === 'cdc_seal_url' || fieldKey === 'cdcSealUrl' ? { cdc_seal_url: base64Data, cdcSealUrl: base64Data } : {}),
          ...(fieldKey === 'rotc_seal_url' || fieldKey === 'rotcSealUrl' ? { rotc_seal_url: base64Data, rotcSealUrl: base64Data } : {}),
          ...(fieldKey === 'nstp_logo_url' || fieldKey === 'nstpLogoUrl' ? { nstp_logo_url: base64Data, nstpLogoUrl: base64Data } : {}),
          ...(fieldKey === 'university_logo_url' || fieldKey === 'universityLogoUrl' ? { university_logo_url: base64Data, universityLogoUrl: base64Data } : {})
        }));
        setSaveSuccessToast(`${slotName} uploaded locally! Click "SAVE ALL" to commit.`);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingSlot(null);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Dynamic Hero Emblems Handlers (Branding & Passes)
  const handleTriggerEmblemUpload = (emblemId) => {
    setActiveUploadEmblemId(emblemId);
    dynamicEmblemFileInputRef.current?.click();
  };

  const handleDynamicEmblemFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadEmblemId) return;

    const emblemId = activeUploadEmblemId;
    const currentList = settings.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
    const targetEmblem = currentList.find(item => item.id === emblemId);
    const emblemLabel = targetEmblem?.label || 'Emblem';

    setUploadingSlot(emblemId);
    try {
      const uploadedUrl = await uploadBrandingAsset(file, emblemLabel);
      if (uploadedUrl) {
        setSettings(prev => {
          const list = prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
          const updated = list.map(item => item.id === emblemId ? { ...item, url: uploadedUrl } : item);
          return { ...prev, hero_emblems: updated, heroEmblems: updated };
        });
        setSaveSuccessToast(`"${emblemLabel}" image uploaded to Cloud Storage! Click "SAVE ALL" to commit.`);
      }
    } catch (err) {
      console.error('Failed to upload emblem to Supabase Storage:', err);
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Data = uploadEvent.target.result;
        setSettings(prev => {
          const list = prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
          const updated = list.map(item => item.id === emblemId ? { ...item, url: base64Data } : item);
          return { ...prev, hero_emblems: updated, heroEmblems: updated };
        });
        setSaveSuccessToast(`"${emblemLabel}" image uploaded locally! Click "SAVE ALL" to commit.`);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingSlot(null);
      setActiveUploadEmblemId(null);
      if (dynamicEmblemFileInputRef.current) dynamicEmblemFileInputRef.current.value = '';
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  const handleUpdateEmblemLabel = (emblemId, newLabel) => {
    if (isArchived) return;
    setSettings(prev => {
      const list = prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
      const updated = list.map(item => item.id === emblemId ? { ...item, label: newLabel } : item);
      return { ...prev, hero_emblems: updated, heroEmblems: updated };
    });
  };

  const handleToggleEmblemActive = (emblemId) => {
    if (isArchived) return;
    setSettings(prev => {
      const list = prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
      const updated = list.map(item => item.id === emblemId ? { ...item, active: item.active === false ? true : false } : item);
      return { ...prev, hero_emblems: updated, heroEmblems: updated };
    });
  };

  const handleSetCenterEmblem = (emblemId) => {
    if (isArchived) return;
    setSettings(prev => {
      const list = prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
      const updated = list.map(item => ({
        ...item,
        is_center: item.id === emblemId
      }));
      return { ...prev, hero_emblems: updated, heroEmblems: updated };
    });
  };

  const handleReorderEmblems = (fromIndex, toIndex) => {
    if (isArchived) return;
    if (fromIndex === toIndex || fromIndex === null || toIndex === null) return;
    setSettings(prev => {
      const list = [...(prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems)];
      const [movedItem] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, movedItem);
      return { ...prev, hero_emblems: list, heroEmblems: list };
    });
  };

  const handleMoveEmblem = (index, direction) => {
    if (isArchived) return;
    setSettings(prev => {
      const list = [...(prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems)];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...prev, hero_emblems: list, heroEmblems: list };
    });
  };

  const handleDeleteEmblem = (emblemId) => {
    if (isArchived) return;
    const list = settings.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
    if (list.length <= 1) {
      alert('You must keep at least 1 hero banner emblem.');
      return;
    }
    const target = list.find(item => item.id === emblemId);
    if (!confirm(`Are you sure you want to remove "${target?.label || 'this emblem'}" from the landing page hero banner?`)) {
      return;
    }
    setSettings(prev => {
      const current = prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
      let updated = current.filter(item => item.id !== emblemId);
      if (target?.is_center && updated.length > 0) {
        const midIdx = Math.floor(updated.length / 2);
        updated = updated.map((item, idx) => ({ ...item, is_center: idx === midIdx }));
      }
      return { ...prev, hero_emblems: updated, heroEmblems: updated };
    });
  };

  const handleAddEmblemSlot = () => {
    if (isArchived) return;
    const list = settings.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
    const newSlotNumber = list.length + 1;
    const newEmblem = {
      id: `emblem-${Date.now()}`,
      label: `Slot ${newSlotNumber} Seal`,
      url: '/rotc-seal-transparent.png',
      is_center: false,
      active: true
    };
    setSettings(prev => {
      const current = prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
      const updated = [...current, newEmblem];
      return { ...prev, hero_emblems: updated, heroEmblems: updated };
    });
    setEditingEmblem(newEmblem);
  };

  const handleResetEmblemsToDefault = () => {
    if (isArchived) return;
    if (confirm('Reset hero emblems to the official 5 default military & university seals?')) {
      setSettings(prev => ({
        ...prev,
        hero_emblems: DEFAULT_SETTINGS.hero_emblems,
        heroEmblems: DEFAULT_SETTINGS.hero_emblems
      }));
    }
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

  // Download System Backup (scoped to selected academic term)
  const handleDownloadBackup = async () => {
    try {
      // Scoped records strictly matching currentTermId
      const scopedCadets = currentTermId
        ? (cadets || []).filter(c => !c.academic_term_id || c.academic_term_id === currentTermId)
        : (cadets || []);
      const scopedAttendance = currentTermId
        ? (attendanceLogs || []).filter(l => !l.academic_term_id || l.academic_term_id === currentTermId)
        : (attendanceLogs || []);

      const termNameSlug = selectedTerm
        ? `${selectedTerm.academicYear}_${selectedTerm.semester}`.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'active_term';

      const backupData = {
        exportTimestamp: new Date().toISOString(),
        academicTermId: currentTermId,
        academicTermName: selectedTerm ? `${selectedTerm.academicYear} • ${selectedTerm.semester}` : 'Active Term',
        isArchived: isArchived,
        settings: settings,
        cadets: scopedCadets,
        attendanceLogs: scopedAttendance
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `csu_rotc_${termNameSlug}_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSaveSuccessToast(
        isArchived
          ? 'Archived term historical snapshot downloaded successfully.'
          : 'Term backup JSON downloaded successfully.'
      );
    } catch (err) {
      alert('Could not download backup: ' + err.message);
    } finally {
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Restore System Backup (strictly disabled for archived terms)
  const handleRestoreBackup = (e) => {
    if (isArchived) {
      alert('⚠️ Restore from backup is strictly disabled when viewing an archived academic term (Read-Only Term).');
      if (e?.target) e.target.value = '';
      return;
    }

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

  // Clear Cadets for Selected Term from Supabase & Local Cache
  const handleClearCadetsFromApp = async () => {
    if (isArchived) {
      alert('⚠️ Purging cadet records is strictly disabled for archived academic terms.');
      return;
    }
    const termLabel = selectedTerm ? `${selectedTerm.academicYear} • ${selectedTerm.semester}` : 'the selected term';
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to delete all cadets matching "${termLabel}" (${currentTermId || 'active'}) from Supabase and clear the local cadet cache for this term? This action cannot be undone.`)) {
      return;
    }
    setIsClearingCadets(true);
    try {
      await clearCadetsFromSupabase(currentTermId);
      try {
        const localRaw = localStorage.getItem('csu_rotc_cadets_roster');
        if (localRaw) {
          const allCadets = JSON.parse(localRaw);
          const remaining = Array.isArray(allCadets)
            ? (currentTermId ? allCadets.filter(c => c.academic_term_id && c.academic_term_id !== currentTermId) : [])
            : [];
          localStorage.setItem('csu_rotc_cadets_roster', JSON.stringify(remaining));
        }
      } catch (_) {}
      setLiveTermCadets([]);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('local-attendance-update'));
      setSaveSuccessToast(`Cadets for ${termLabel} successfully cleared from Supabase & local cache.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error clearing cadets: ' + err.message);
    } finally {
      setIsClearingCadets(false);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  // Clear Attendance Logs for Selected Term from Supabase & Local Cache
  const handleClearAttendanceFromApp = async () => {
    if (isArchived) {
      alert('⚠️ Purging attendance records is strictly disabled for archived academic terms.');
      return;
    }
    const termLabel = selectedTerm ? `${selectedTerm.academicYear} • ${selectedTerm.semester}` : 'the selected term';
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to delete all attendance logs matching "${termLabel}" (${currentTermId || 'active'}) from Supabase and clear local attendance history for this term? This action cannot be undone.`)) {
      return;
    }
    setIsClearingAttendance(true);
    try {
      await clearAttendanceFromSupabase(currentTermId);
      try {
        const localRaw = localStorage.getItem('csu_rotc_master_attendance');
        if (localRaw) {
          const allLogs = JSON.parse(localRaw);
          const remaining = Array.isArray(allLogs)
            ? (currentTermId ? allLogs.filter(l => l.academic_term_id && l.academic_term_id !== currentTermId) : [])
            : [];
          localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(remaining));
        }
      } catch (_) {}
      localStorage.removeItem('csu_rotc_recent_approved_signatures');
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('local-attendance-update'));
      setSaveSuccessToast(`Attendance logs for ${termLabel} successfully cleared from Supabase & local cache.`);
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

  // Active battalions list (excluding soft-archived units)
  const activeBattalionsList = useMemo(() => {
    return currentStructure.filter(b => !b.is_archived);
  }, [currentStructure]);

  // Active battalion object
  const activeBattalion = currentStructure.find(b => b.id === selectedBnId && (!b.is_archived || showArchivedUnits)) 
    || activeBattalionsList[0] 
    || currentStructure[0] 
    || null;

  // Active company object
  const activeCompany = activeBattalion
    ? ((activeBattalion.companies || []).find(c => c.id === selectedCoId && (!c.is_archived || showArchivedUnits)) 
       || (activeBattalion.companies || []).find(c => !c.is_archived) 
       || (activeBattalion.companies || [])[0] 
       || null)
    : null;

  // Calculate totals based on active operational units
  const totalBattalionsCount = activeBattalionsList.length;
  const totalCompaniesCount = activeBattalionsList.reduce((acc, bn) => acc + ((bn.companies || []).filter(c => !c.is_archived).length), 0);
  const totalPlatoonsCount = activeBattalionsList.reduce((acc, bn) => {
    return acc + ((bn.companies || []).filter(c => !c.is_archived).reduce((pAcc, co) => pAcc + ((co.platoons || []).filter(p => !p.is_archived).length), 0));
  }, 0);
  const totalBasicQuota = activeBattalionsList.reduce((acc, bn) => acc + (Number(bn.targetQuota) || 0), 0);

  // Dynamic cadet calculations scoped strictly to currentTermId
  const effectiveTermCadets = useMemo(() => {
    if (liveTermCadets !== null) return liveTermCadets;
    if (currentTermId && Array.isArray(cadets)) {
      const filtered = cadets.filter(c => c.academic_term_id === currentTermId);
      return filtered.length > 0 ? filtered : cadets;
    }
    return Array.isArray(cadets) ? cadets : [];
  }, [liveTermCadets, currentTermId, cadets]);

  const termEnrolledCount = effectiveTermCadets.length;

  const getBattalionCadetCount = (bn) => {
    if (!bn) return 0;
    const bnName = String(bn.name || '').trim().toLowerCase();
    const bnId = String(bn.id || '').trim().toLowerCase();
    return effectiveTermCadets.filter(c =>
      String(c.battalion || '').trim().toLowerCase() === bnName ||
      String(c.battalion_id || '').trim().toLowerCase() === bnId
    ).length;
  };

  const getCompanyCadetCount = (bn, co) => {
    if (!co) return 0;
    const coName = String(co.name || '').trim().toLowerCase();
    const coId = String(co.id || '').trim().toLowerCase();
    const bnName = bn ? String(bn.name || '').trim().toLowerCase() : '';
    return effectiveTermCadets.filter(c => {
      const matchCo = String(c.company || '').trim().toLowerCase() === coName ||
                      String(c.company_id || '').trim().toLowerCase() === coId;
      if (!matchCo) return false;
      if (!bnName) return true;
      return String(c.battalion || '').trim().toLowerCase() === bnName;
    }).length;
  };

  const getPlatoonCadetCount = (pl, co = null, bn = null) => {
    if (!pl) return 0;
    const plName = String(pl.name || '').trim().toLowerCase();
    const plId = String(pl.id || '').trim().toLowerCase();
    if (livePlatoonHeadcounts) {
      if (bn && co) {
        const fullKey = `${String(bn.name || '').trim().toLowerCase()}__${String(co.name || '').trim().toLowerCase()}__${plName}`;
        if (livePlatoonHeadcounts[fullKey] !== undefined) return livePlatoonHeadcounts[fullKey];
      }
      if (livePlatoonHeadcounts[plId] !== undefined) return livePlatoonHeadcounts[plId];
      if (livePlatoonHeadcounts[plName] !== undefined) return livePlatoonHeadcounts[plName];
    }
    return effectiveTermCadets.filter(c =>
      String(c.platoon || '').trim().toLowerCase() === plName ||
      String(c.platoon_id || '').trim().toLowerCase() === plId
    ).length;
  };

  // Active platoons system-wide across all battalions and companies (excluding the echelon being deleted)
  const allActivePlatoonsSystemWide = useMemo(() => {
    const list = [];
    (currentStructure || []).forEach(bn => {
      if (bn.is_archived) return;
      (bn.companies || []).forEach(co => {
        if (co.is_archived) return;
        (co.platoons || []).forEach(pl => {
          if (pl.is_archived) return;
          // Exclude the unit echelon being deleted and its descendants
          if (reassignModalConfig.level === 'battalion' && bn.id === reassignModalConfig.item?.id) return;
          if (reassignModalConfig.level === 'company' && co.id === reassignModalConfig.item?.id) return;
          if (reassignModalConfig.level === 'platoon' && pl.id === reassignModalConfig.item?.id) return;

          const key = `${String(bn.name || '').trim().toLowerCase()}__${String(co.name || '').trim().toLowerCase()}__${String(pl.name || '').trim().toLowerCase()}`;
          const currentCount = systemPlatoonCapacities[pl.id] ?? systemPlatoonCapacities[key] ?? 0;
          const quota = Number(pl.targetQuota) || 37;
          const available = Math.max(0, quota - currentCount);
          const isFull = currentCount >= quota;

          const bnNumMatch = String(bn.name || '').match(/\d+/);
          const bnCode = bn.shortCode || (bnNumMatch ? `${bnNumMatch[0]}BN` : 'BN');
          const coLabel = String(co.name || '').replace(/ Company$/i, ' Coy').replace(/ Coy$/i, ' Coy');
          const label = `[${bnCode} - ${coLabel}] ${pl.name} (${currentCount}/${quota} - ${isFull ? 'FULL' : `${available} Available`})`;

          list.push({
            id: pl.id,
            name: pl.name,
            platoonId: pl.id,
            platoonName: pl.name,
            companyId: co.id,
            companyName: co.name,
            battalionId: bn.id,
            battalionName: bn.name,
            currentCount,
            quota,
            available,
            isFull,
            label
          });
        });
      });
    });
    return list;
  }, [currentStructure, reassignModalConfig, systemPlatoonCapacities]);

  // Automatic Standard Echelon Creation (Replaces manual text input prompts)
  const handleAutoAddEchelon = (level, parentId = null) => {
    let updatedStructure = JSON.parse(JSON.stringify(currentStructure));

    if (level === 'battalion') {
      const autoBn = getAutoBattalionName(currentStructure);
      const autoCo = getAutoCompanyName(currentStructure);

      const newBn = {
        id: `bn-${Date.now()}`,
        name: autoBn.name,
        shortCode: autoBn.shortCode,
        targetQuota: autoBn.targetQuota,
        companies: [
          {
            id: `co-${Date.now()}-1`,
            name: autoCo.name,
            shortCode: autoCo.shortCode,
            targetQuota: autoCo.targetQuota,
            platoons: autoCo.platoons // Sets up 2 platoons by default: 1st Platoon & 2nd Platoon
          }
        ]
      };

      updatedStructure.push(newBn);
      setSettings(prev => ({
        ...prev,
        unitStructure: updatedStructure,
        unit_structure: updatedStructure
      }));
      updateUnitStructure(updatedStructure);
      setSelectedBnId(newBn.id);
      setSelectedCoId(newBn.companies[0].id);

      setSaveSuccessToast(`✅ Auto-Created ${autoBn.name} with ${autoCo.name} (2 Platoons default)`);
      setTimeout(() => setSaveSuccessToast(null), 3500);
    } else if (level === 'company') {
      const bnIdx = updatedStructure.findIndex(b => b.id === (parentId || selectedBnId));
      if (bnIdx === -1) {
        alert('Please select a Battalion first.');
        return;
      }

      const autoCo = getAutoCompanyName(currentStructure);
      const newCo = {
        id: `co-${Date.now()}`,
        name: autoCo.name,
        shortCode: autoCo.shortCode,
        targetQuota: autoCo.targetQuota,
        platoons: autoCo.platoons // Sets up 2 platoons by default: 1st Platoon & 2nd Platoon
      };

      updatedStructure[bnIdx].companies.push(newCo);

      // Auto-sync Battalion Quota to sum of companies
      const coSum = updatedStructure[bnIdx].companies.reduce((acc, c) => acc + Number(c.targetQuota || 0), 0);
      if (coSum > 0) updatedStructure[bnIdx].targetQuota = coSum;

      setSettings(prev => ({
        ...prev,
        unitStructure: updatedStructure,
        unit_structure: updatedStructure
      }));
      updateUnitStructure(updatedStructure);
      setSelectedCoId(newCo.id);

      setSaveSuccessToast(`✅ Auto-Created ${autoCo.name} (2 Platoons default) in ${updatedStructure[bnIdx].name}`);
      setTimeout(() => setSaveSuccessToast(null), 3500);
    } else if (level === 'platoon') {
      const bnIdx = updatedStructure.findIndex(b => b.id === selectedBnId);
      if (bnIdx === -1) return;
      const coIdx = updatedStructure[bnIdx].companies.findIndex(c => c.id === (parentId || selectedCoId));
      if (coIdx === -1) {
        alert('Please select a Company first.');
        return;
      }

      const autoPl = getAutoPlatoonName(updatedStructure[bnIdx].companies[coIdx]);
      const newPl = {
        id: `pl-${Date.now()}`,
        name: autoPl.name,
        shortCode: autoPl.shortCode,
        targetQuota: autoPl.targetQuota
      };

      updatedStructure[bnIdx].companies[coIdx].platoons.push(newPl);

      // Auto-sync Company and Battalion Quotas
      const plSum = updatedStructure[bnIdx].companies[coIdx].platoons.reduce((acc, p) => acc + Number(p.targetQuota || 0), 0);
      if (plSum > 0) updatedStructure[bnIdx].companies[coIdx].targetQuota = plSum;

      const coSum = updatedStructure[bnIdx].companies.reduce((acc, c) => acc + Number(c.targetQuota || 0), 0);
      if (coSum > 0) updatedStructure[bnIdx].targetQuota = coSum;

      setSettings(prev => ({
        ...prev,
        unitStructure: updatedStructure,
        unit_structure: updatedStructure
      }));
      updateUnitStructure(updatedStructure);

      setSaveSuccessToast(`✅ Auto-Created ${autoPl.name} under ${updatedStructure[bnIdx].companies[coIdx].name}`);
      setTimeout(() => setSaveSuccessToast(null), 3500);
    }
  };

  const handleOpenAddEchelon = handleAutoAddEchelon;

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

    const newSettings = { ...settings, unitStructure: updatedStructure, unit_structure: updatedStructure };
    setSettings(newSettings);
    if (updateUnitStructure) updateUnitStructure(updatedStructure);
    setIsEchelonModalOpen(false);
  };

  // Direct Safe Archive / Deletion Execution (when 0 cadets assigned or after transfer)
  const executeDirectArchiveUnit = async (level, item, parentId = null) => {
    let updatedStructure = JSON.parse(JSON.stringify(currentStructure));
    const nowIso = new Date().toISOString();

    if (level === 'battalion') {
      const activeRemaining = updatedStructure.filter(b => b.id !== item.id && !b.is_archived);
      if (activeRemaining.length === 0) {
        alert('Cannot archive the only remaining active Battalion.');
        return false;
      }
      const bIdx = updatedStructure.findIndex(b => b.id === item.id);
      if (bIdx !== -1) {
        updatedStructure[bIdx].is_archived = true;
        updatedStructure[bIdx].archived_at = nowIso;
      }
      if (selectedBnId === item.id) {
        setSelectedBnId(activeRemaining[0]?.id || null);
        const nextActiveCo = (activeRemaining[0]?.companies || []).find(c => !c.is_archived);
        setSelectedCoId(nextActiveCo?.id || null);
      }
    } else if (level === 'company') {
      const bnIdx = updatedStructure.findIndex(b => b.id === (parentId || selectedBnId));
      if (bnIdx !== -1) {
        const bnObj = updatedStructure[bnIdx];
        const activeCos = (bnObj.companies || []).filter(c => c.id !== item.id && !c.is_archived);
        if (activeCos.length === 0) {
          alert('Cannot archive the only remaining active Company in this Battalion.');
          return false;
        }
        const cIdx = bnObj.companies.findIndex(c => c.id === item.id);
        if (cIdx !== -1) {
          bnObj.companies[cIdx].is_archived = true;
          bnObj.companies[cIdx].archived_at = nowIso;
        }
        if (selectedCoId === item.id) {
          setSelectedCoId(activeCos[0]?.id || null);
        }
        const coSum = activeCos.reduce((acc, c) => acc + Number(c.targetQuota || 0), 0);
        if (coSum > 0) bnObj.targetQuota = coSum;
      }
    } else if (level === 'platoon') {
      const bnIdx = updatedStructure.findIndex(b => b.id === selectedBnId);
      if (bnIdx !== -1) {
        const coIdx = updatedStructure[bnIdx].companies.findIndex(c => c.id === (parentId || selectedCoId));
        if (coIdx !== -1) {
          const coObj = updatedStructure[bnIdx].companies[coIdx];
          const activePls = (coObj.platoons || []).filter(p => p.id !== item.id && !p.is_archived);
          if (activePls.length === 0) {
            alert('Cannot archive the only remaining active Platoon in this Company.');
            return false;
          }
          const pIdx = coObj.platoons.findIndex(p => p.id === item.id);
          if (pIdx !== -1) {
            coObj.platoons[pIdx].is_archived = true;
            coObj.platoons[pIdx].archived_at = nowIso;
          }
          const plSum = activePls.reduce((acc, p) => acc + Number(p.targetQuota || 0), 0);
          if (plSum > 0) coObj.targetQuota = plSum;
          const remainingActiveCos = (updatedStructure[bnIdx].companies || []).filter(c => !c.is_archived);
          const coSum = remainingActiveCos.reduce((acc, c) => acc + Number(c.targetQuota || 0), 0);
          if (coSum > 0) updatedStructure[bnIdx].targetQuota = coSum;
        }
      }
    }

    await softArchiveUnitEchelon({ level, id: item.id, name: item.name });

    const newSettings = { ...settings, unitStructure: updatedStructure, unit_structure: updatedStructure };
    setSettings(newSettings);
    if (updateUnitStructure) updateUnitStructure(updatedStructure);
    return true;
  };

  // Click Delete on Unit: Checks active cadets first
  const handleOpenDeleteEchelon = async (level, item, parentId = null) => {
    let parentBn = null;
    let parentCo = null;

    if (level === 'battalion') {
      parentBn = item;
    } else if (level === 'company') {
      parentBn = currentStructure.find(b => b.id === (parentId || selectedBnId));
      parentCo = item;
    } else if (level === 'platoon') {
      parentBn = currentStructure.find(b => b.id === selectedBnId);
      parentCo = parentBn?.companies?.find(c => c.id === (parentId || selectedCoId));
    }

    const bnName = parentBn?.name || '';
    const coName = parentCo?.name || '';

    setCheckingDeleteUnitId(item.id);

    try {
      // 1. Check live dependencies & fetch system-wide capacities in parallel
      const [deps, capacities] = await Promise.all([
        checkUnitDependencies({
          level,
          id: item.id,
          name: item.name,
          battalionName: bnName,
          companyName: coName
        }),
        fetchSystemWidePlatoonCapacities()
      ]);

      if (capacities) {
        setSystemPlatoonCapacities(capacities);
      }

      // 2. If Cadets = 0: Proceed with deletion/archiving directly
      if (!deps || deps.cadetCount === 0) {
        const confirmed = window.confirm(
          `Archive "${item.name}"?\n\n✓ 0 active cadets assigned to this unit.\n\nProceed with direct archiving?`
        );
        if (confirmed) {
          const success = await executeDirectArchiveUnit(level, item, parentId);
          if (success) {
            setSaveSuccessToast(`✅ Safely archived ${item.name} (0 active cadets affected).`);
            setTimeout(() => setSaveSuccessToast(null), 4000);
          }
        }
        return;
      }

      // 3. If Cadets > 0: Block deletion and open 'Reassign Cadets First' Modal
      if (level === 'battalion') {
        const remainingBns = currentStructure.filter(b => b.id !== item.id && !b.is_archived);
        const firstTarget = remainingBns[0];
        const firstCo = (firstTarget?.companies || []).find(c => !c.is_archived);
        const firstPl = (firstCo?.platoons || []).find(p => !p.is_archived);
        setReassignTargetUnit({
          id: firstTarget?.id || '',
          name: firstTarget?.name || '',
          battalionId: firstTarget?.id || '',
          battalionName: firstTarget?.name || '',
          companyId: firstCo?.id || '',
          companyName: firstCo?.name || '',
          platoonId: firstPl?.id || '',
          platoonName: firstPl?.name || '',
          defaultCompanyName: firstCo?.name || '',
          defaultCompanyId: firstCo?.id || '',
          defaultPlatoonName: firstPl?.name || '',
          defaultPlatoonId: firstPl?.id || ''
        });
      } else if (level === 'company') {
        const remainingCos = [];
        currentStructure.forEach(b => {
          if (b.is_archived) return;
          (b.companies || []).forEach(c => {
            if (!c.is_archived && c.id !== item.id) {
              remainingCos.push({ ...c, parentBn: b });
            }
          });
        });
        const firstTarget = remainingCos[0];
        const firstPl = (firstTarget?.platoons || []).find(p => !p.is_archived);
        setReassignTargetUnit({
          id: firstTarget?.id || '',
          name: firstTarget?.name || '',
          battalionId: firstTarget?.parentBn?.id || bnName,
          battalionName: firstTarget?.parentBn?.name || bnName,
          companyId: firstTarget?.id || '',
          companyName: firstTarget?.name || '',
          platoonId: firstPl?.id || '',
          platoonName: firstPl?.name || '',
          defaultPlatoonName: firstPl?.name || '',
          defaultPlatoonId: firstPl?.id || ''
        });
      } else if (level === 'platoon') {
        // Collect candidate platoons across ALL Battalions and Companies system-wide
        const candidates = [];
        (currentStructure || []).forEach(b => {
          if (b.is_archived) return;
          (b.companies || []).forEach(c => {
            if (c.is_archived) return;
            (c.platoons || []).forEach(p => {
              if (p.is_archived || p.id === item.id) return;
              const k = `${String(b.name || '').trim().toLowerCase()}__${String(c.name || '').trim().toLowerCase()}__${String(p.name || '').trim().toLowerCase()}`;
              const count = capacities?.[p.id] ?? capacities?.[k] ?? 0;
              const q = Number(p.targetQuota) || 37;
              candidates.push({
                id: p.id,
                name: p.name,
                platoonId: p.id,
                platoonName: p.name,
                companyId: c.id,
                companyName: c.name,
                battalionId: b.id,
                battalionName: b.name,
                isFull: count >= q
              });
            });
          });
        });

        // Automatically default to the first available platoon that is not full
        const firstAvailable = candidates.find(c => !c.isFull) || candidates[0];
        if (firstAvailable) {
          setReassignTargetUnit({
            id: firstAvailable.id,
            name: firstAvailable.name,
            platoonId: firstAvailable.platoonId,
            platoonName: firstAvailable.platoonName,
            companyId: firstAvailable.companyId,
            companyName: firstAvailable.companyName,
            battalionId: firstAvailable.battalionId,
            battalionName: firstAvailable.battalionName
          });
        }
      }

      setReassignModalConfig({
        level,
        item,
        parentId,
        parentBnId: parentBn?.id || null,
        parentCoId: parentCo?.id || null,
        battalionName: bnName,
        companyName: coName,
        cadetCount: deps.cadetCount,
        logCount: deps.logCount,
        sampleCadets: deps.sampleCadets || []
      });

      setIsReassignCadetsModalOpen(true);
    } catch (err) {
      console.error('Error checking active cadets:', err);
      alert(`Could not verify active cadets: ${err.message || err}`);
    } finally {
      setCheckingDeleteUnitId(null);
    }
  };

  // Reassign all affected cadets to chosen target unit in Supabase first, and then safely delete/archive original unit
  const handleConfirmReassignAndDelete = async () => {
    const { level, item, parentId, battalionName, companyName, cadetCount } = reassignModalConfig;
    if (!reassignTargetUnit.name) {
      alert('Please select an available destination unit before proceeding.');
      return;
    }

    setIsReassigningAndDeleting(true);
    try {
      // Step 1: Reassign all affected cadets to the chosen target unit in Supabase first
      await reassignUnitDependencies({
        level,
        source: {
          id: item.id,
          name: item.name,
          battalionName,
          companyName
        },
        target: reassignTargetUnit
      });

      // Step 2: Safely delete/archive the original unit
      await executeDirectArchiveUnit(level, item, parentId);

      setIsReassignCadetsModalOpen(false);
      setSaveSuccessToast(`✅ Successfully reassigned ${cadetCount} cadets to ${reassignTargetUnit.name} and archived ${item.name}.`);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error during reassignment and deletion:', err);
      alert(`Error during reassignment: ${err.message || err}`);
    } finally {
      setIsReassigningAndDeleting(false);
    }
  };


  // Restore Soft-Archived Echelon
  const handleRestoreArchivedEchelon = async (level, item, parentId = null) => {
    let updatedStructure = JSON.parse(JSON.stringify(currentStructure));

    try {
      if (level === 'battalion') {
        const bIdx = updatedStructure.findIndex(b => b.id === item.id);
        if (bIdx !== -1) {
          updatedStructure[bIdx].is_archived = false;
          updatedStructure[bIdx].archived_at = null;
        }
      } else if (level === 'company') {
        const bnIdx = updatedStructure.findIndex(b => b.id === (parentId || selectedBnId));
        if (bnIdx !== -1) {
          const cIdx = updatedStructure[bnIdx].companies.findIndex(c => c.id === item.id);
          if (cIdx !== -1) {
            updatedStructure[bnIdx].companies[cIdx].is_archived = false;
            updatedStructure[bnIdx].companies[cIdx].archived_at = null;
          }
        }
      } else if (level === 'platoon') {
        const bnIdx = updatedStructure.findIndex(b => b.id === selectedBnId);
        if (bnIdx !== -1) {
          const coIdx = updatedStructure[bnIdx].companies.findIndex(c => c.id === (parentId || selectedCoId));
          if (coIdx !== -1) {
            const pIdx = updatedStructure[bnIdx].companies[coIdx].platoons.findIndex(p => p.id === item.id);
            if (pIdx !== -1) {
              updatedStructure[bnIdx].companies[coIdx].platoons[pIdx].is_archived = false;
              updatedStructure[bnIdx].companies[coIdx].platoons[pIdx].archived_at = null;
            }
          }
        }
      }

      await restoreUnitEchelon({ level, id: item.id, name: item.name });

      const newSettings = { ...settings, unitStructure: updatedStructure, unit_structure: updatedStructure };
      setSettings(newSettings);
      if (updateUnitStructure) updateUnitStructure(updatedStructure);

      setSaveSuccessToast(`✓ Restored ${item.name} to active unit roster.`);
      setTimeout(() => setSaveSuccessToast(null), 3000);
    } catch (err) {
      alert(`Error restoring unit: ${err.message || err}`);
    }
  };

  // One-click helper to reassign orphaned cadets (e.g. 2nd Bn Alpha -> Charlie Company)
  const handleFixOrphanedCadets = async () => {
    setIsReassigningOrphans(true);
    try {
      const res = await reassignCadetsCompany('2nd Battalion', 'Alpha Company', 'Charlie Company');
      let msg = 'Cadet assignments checked!\n\n';
      if (res.localCadetsCount > 0 || res.supabaseUpdatedCount > 0) {
        msg += `✓ Successfully reassigned ${Math.max(res.localCadetsCount, res.supabaseUpdatedCount)} cadets from 2nd Bn Alpha Company to Charlie Company.\n`;
      } else {
        msg += '✓ Local records checked. To ensure all cloud records in Supabase are updated, run supabase_reassign_orphaned_cadets.sql in Supabase SQL Editor.\n';
      }
      alert(msg);
    } catch (err) {
      alert(`Error reassigning cadets: ${err.message}`);
    } finally {
      setIsReassigningOrphans(false);
    }
  };

  // Restore Default CSU ROTC Hierarchy Structure (1st - 3rd Bn + HQ, 8 Coys, 16 Platoons)
  const handleRestoreDefaultStructure = () => {
    if (window.confirm('Reset the organizational structure back to standard CSU ROTC Defaults (4 Battalions: 1st, 2nd, 3rd, Headquarters • 8 Companies • 16 Platoons)? (Click "SAVE ALL" to commit)')) {
      const newSettings = { ...settings, unitStructure: DEFAULT_UNIT_STRUCTURE, unit_structure: DEFAULT_UNIT_STRUCTURE };
      setSettings(newSettings);
      if (updateUnitStructure) updateUnitStructure(DEFAULT_UNIT_STRUCTURE);
      setSelectedBnId('bn-1');
      setSelectedCoId('co-1-alpha');
    }
  };

  const tabs = [
    { id: 'structure', label: 'Unit Setup', icon: Sliders, desc: 'Cutoffs, excuse limits & echelon structure' },
    { id: 'branding', label: 'Branding & Passes', icon: IdCard, desc: 'Command profile, official seals & QR card layout' },
    { id: 'storage', label: 'Data Management & Exports', icon: Database, desc: 'Excel paths, backups & letterhead settings' },
    { id: 'terms', label: 'Academic Terms', icon: CalendarRange, desc: 'Academic years, semesters & training days', badge: 'PER SEM' }
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
            disabled={isSaving || isArchived}
            title={isArchived ? "🔒 Settings are locked for archived terms" : "Save All Settings (Ctrl+S)"}
            style={{
              padding: '0.85rem 1.75rem',
              fontSize: '0.95rem',
              fontWeight: 800,
              boxShadow: isArchived ? 'none' : '0 8px 24px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              borderRadius: '10px',
              cursor: (isSaving || isArchived) ? 'not-allowed' : 'pointer',
              background: isArchived ? '#64748b' : undefined,
              borderColor: isArchived ? '#475569' : undefined,
              color: isArchived ? '#e2e8f0' : undefined,
              opacity: isArchived ? 0.75 : 1
            }}
          >
            {isSaving ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : isArchived ? (
              <Lock size={18} />
            ) : (
              <Save size={18} />
            )}
            <span>{isSaving ? 'SAVING...' : isArchived ? 'LOCKED (ARCHIVED)' : 'SAVE ALL'}</span>
          </button>
        </div>
      </div>

      {/* Archived Term Read-Only Notice Banner */}
      {isArchived && (
        <div style={{
          background: '#fef2f2',
          border: '1.5px solid #f87171',
          color: '#991b1b',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontWeight: 700,
          fontSize: '0.9rem',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
        }}>
          <Lock size={22} color="#dc2626" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 800 }}>Archived Term (Read-Only Mode):</span> When viewing historical terms ({selectedTerm?.term_name || 'Archived'}), all settings, command profiles, logos, and unit hierarchies are locked to protect historical data integrity.
          </div>
        </div>
      )}

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
                  {tab.badge && <span className="at-tab-badge">{tab.badge}</span>}
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
          {/* 2-Column Split: Formation Cutoff Schedule & Excuse Letter Grace Period */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.25rem',
              width: '100%'
            }}
          >
            {/* Left Card: Formation Cutoff Schedule */}
            <div className="card" style={{ width: '100%' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Clock size={20} />
                  <span>Formation Cutoff Schedule</span>
                </div>
                <span
                  className="badge badge-present"
                  style={{
                    background: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.5px'
                  }}
                >
                  TIME RULES
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Time-In Cutoff
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={settings.morningCutoffTime}
                  disabled={isArchived}
                  onChange={(e) => handleChange('morningCutoffTime', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.95rem',
                    backgroundColor: isArchived ? '#f1f5f9' : '#ffffff',
                    cursor: isArchived ? 'not-allowed' : 'auto'
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block', lineHeight: 1.4 }}>
                  Default morning muster deadline (e.g., 07:30 AM). Scans on or before this are marked Present; scans after this are marked Late.
                </span>
              </div>
            </div>

            {/* Right Card: Excuse Letter Grace Period */}
            <div className="card" style={{ width: '100%' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title" style={{ fontSize: '1.05rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FileText size={20} />
                  <span>Excuse Letter Grace Period</span>
                </div>
                <span
                  className="badge badge-warning"
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.5px'
                  }}
                >
                  POLICY DEADLINE
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                  Excuse Letter Submission Grace Period (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  className="form-control"
                  value={settings.excuseGracePeriodDays ?? 3}
                  disabled={isArchived}
                  onChange={(e) => handleChange('excuseGracePeriodDays', parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '100%',
                    padding: '0.7rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.95rem',
                    backgroundColor: isArchived ? '#f1f5f9' : '#ffffff',
                    cursor: isArchived ? 'not-allowed' : 'auto'
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block', lineHeight: 1.4 }}>
                  Number of days after the formation date that a cadet may still file an online excuse. After this window, any <strong>EXCUSE_PENDING</strong> records automatically convert to <strong>ABSENT</strong>.
                </span>
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
                  onClick={handleFixOrphanedCadets}
                  disabled={isArchived || isReassigningOrphans}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.45rem 0.85rem',
                    color: isArchived ? '#94a3b8' : '#92400e',
                    backgroundColor: isArchived ? '#f1f5f9' : '#fef3c7',
                    borderColor: isArchived ? '#cbd5e1' : '#fde68a',
                    cursor: isArchived ? 'not-allowed' : 'pointer',
                    opacity: isArchived ? 0.6 : 1
                  }}
                  title={isArchived ? "🔒 Locked for archived terms" : "Reassign cadets from removed companies (e.g. 2nd Bn Alpha -> Charlie Company)"}
                >
                  <Users size={14} /> {isReassigningOrphans ? 'Reassigning...' : 'Fix Orphaned Cadets (2nd Bn Alpha → Charlie)'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowArchivedUnits(!showArchivedUnits)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    backgroundColor: showArchivedUnits ? '#e2e8f0' : '#ffffff',
                    borderColor: showArchivedUnits ? '#94a3b8' : '#cbd5e1',
                    color: showArchivedUnits ? '#0f172a' : '#475569'
                  }}
                  title="Toggle visibility of soft-archived units"
                >
                  <Archive size={14} color={showArchivedUnits ? '#0f172a' : '#64748b'} />
                  {showArchivedUnits ? 'Hide Archived Units' : 'Show Archived Units'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRestoreDefaultStructure}
                  disabled={isArchived}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.8rem',
                    cursor: isArchived ? 'not-allowed' : 'pointer',
                    opacity: isArchived ? 0.6 : 1,
                    backgroundColor: isArchived ? '#f1f5f9' : '#ffffff'
                  }}
                  title={isArchived ? "🔒 Locked for archived terms" : "Reset to standard CSU ROTC hierarchy (4 Battalions, 8 Companies, 16 Platoons)"}
                >
                  <RefreshCw size={14} /> Reset Hierarchy to CSU Defaults
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
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {termEnrolledCount} Enrolled • {totalBasicQuota.toLocaleString()} Quota
                </div>
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
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {termEnrolledCount} Enrolled ({totalBasicQuota > 0 ? Math.round((termEnrolledCount / totalBasicQuota) * 100) : 0}% of Target)
                </div>
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

                {!isArchived && (
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
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                {currentStructure.filter(bn => showArchivedUnits || !bn.is_archived).map(bn => {
                  const isSelected = selectedBnId === bn.id;
                  const coyCount = (bn.companies || []).filter(c => !c.is_archived).length;
                  const isUnitArchived = Boolean(bn.is_archived);
                  const enrolledCount = getBattalionCadetCount(bn);

                  return (
                    <div
                      key={bn.id}
                      onClick={() => {
                        setSelectedBnId(bn.id);
                        if (bn.companies && bn.companies.length > 0) {
                          const firstActiveCo = bn.companies.find(c => !c.is_archived) || bn.companies[0];
                          setSelectedCoId(firstActiveCo?.id || null);
                        } else {
                          setSelectedCoId(null);
                        }
                      }}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        background: isUnitArchived ? '#f1f5f9' : isSelected ? '#ffffff' : '#f8fafc',
                        border: isUnitArchived ? '1.5px dashed #94a3b8' : isSelected ? '2px solid #2563eb' : '1px solid #bfdbfe',
                        boxShadow: isSelected && !isUnitArchived ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none',
                        opacity: isUnitArchived ? 0.78 : 1,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isUnitArchived ? '#64748b' : isSelected ? '#1e3a8a' : '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{bn.name}</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '4px' }}>
                              {bn.shortCode || 'BN'}
                            </span>
                            {isUnitArchived && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                ARCHIVED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {coyCount} Active Companies • Quota: <strong>{bn.targetQuota}</strong> • Enrolled: <strong style={{ color: '#1e40af' }}>{enrolledCount}</strong>
                          </div>
                        </div>

                        {/* Controls */}
                        {!isArchived && (
                          <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                            {!isUnitArchived ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditEchelon('battalion', bn)}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 6px', color: '#334155', cursor: 'pointer' }}
                                  title={`Edit ${bn.name}`}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteEchelon('battalion', bn)}
                                  disabled={checkingDeleteUnitId === bn.id}
                                  style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 6px', color: '#dc2626', cursor: checkingDeleteUnitId === bn.id ? 'wait' : 'pointer' }}
                                  title={`Archive / Safe Delete ${bn.name}`}
                                >
                                  {checkingDeleteUnitId === bn.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestoreArchivedEchelon('battalion', bn)}
                                style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '4px 8px', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title={`Restore ${bn.name} to active roster`}
                              >
                                <RotateCcw size={12} /> Restore
                              </button>
                            )}
                          </div>
                        )}
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

                {!isArchived && (
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
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                {(!activeBattalion || !activeBattalion.companies || activeBattalion.companies.length === 0) ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No companies configured under this battalion. Click "+ Add Coy" to create one.
                  </div>
                ) : (
                  (activeBattalion.companies || []).filter(co => showArchivedUnits || !co.is_archived).map(co => {
                    const isSelected = selectedCoId === co.id;
                    const pltnCount = (co.platoons || []).filter(p => !p.is_archived).length;
                    const isUnitArchived = Boolean(co.is_archived);
                    const enrolledCount = getCompanyCadetCount(activeBattalion, co);

                    return (
                      <div
                        key={co.id}
                        onClick={() => setSelectedCoId(co.id)}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '10px',
                          background: isUnitArchived ? '#f1f5f9' : isSelected ? '#ffffff' : '#f8fafc',
                          border: isUnitArchived ? '1.5px dashed #94a3b8' : isSelected ? '2px solid #059669' : '1px solid #a7f3d0',
                          boxShadow: isSelected && !isUnitArchived ? '0 4px 12px rgba(5, 150, 105, 0.2)' : 'none',
                          opacity: isUnitArchived ? 0.78 : 1,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isUnitArchived ? '#64748b' : isSelected ? '#064e2e' : '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{co.name}</span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#d1fae5', color: '#065f46', padding: '1px 6px', borderRadius: '4px' }}>
                                {co.shortCode || 'CO'}
                              </span>
                              {isUnitArchived && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                  ARCHIVED
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {pltnCount} Active Platoons • Quota: <strong>{co.targetQuota}</strong> • Enrolled: <strong style={{ color: '#065f46' }}>{enrolledCount}</strong>
                            </div>
                          </div>

                          {/* Controls */}
                          {!isArchived && (
                            <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                              {!isUnitArchived ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditEchelon('company', co, selectedBnId)}
                                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 6px', color: '#334155', cursor: 'pointer' }}
                                    title={`Edit ${co.name}`}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteEchelon('company', co, selectedBnId)}
                                    disabled={checkingDeleteUnitId === co.id}
                                    style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 6px', color: '#dc2626', cursor: checkingDeleteUnitId === co.id ? 'wait' : 'pointer' }}
                                    title={`Archive / Safe Delete ${co.name}`}
                                  >
                                    {checkingDeleteUnitId === co.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreArchivedEchelon('company', co, selectedBnId)}
                                  style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '4px 8px', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title={`Restore ${co.name} to active roster`}
                                >
                                  <RotateCcw size={12} /> Restore
                                </button>
                              )}
                            </div>
                          )}
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

                {!isArchived && (
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
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                {(!activeCompany || !activeCompany.platoons || activeCompany.platoons.length === 0) ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No platoons configured under this company. Click "+ Add Pltn" to create one.
                  </div>
                ) : (
                  (activeCompany.platoons || []).filter(pl => showArchivedUnits || !pl.is_archived).map(pl => {
                    const isUnitArchived = Boolean(pl.is_archived);
                    const enrolledCount = getPlatoonCadetCount(pl, activeCompany, activeBattalion);
                    return (
                      <div
                        key={pl.id}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '10px',
                          background: isUnitArchived ? '#f1f5f9' : '#ffffff',
                          border: isUnitArchived ? '1.5px dashed #94a3b8' : '1px solid #fde68a',
                          boxShadow: 'none',
                          opacity: isUnitArchived ? 0.78 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: isUnitArchived ? '#64748b' : '#78350f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{pl.name}</span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>
                                {pl.shortCode || 'PLTN'}
                              </span>
                              {isUnitArchived && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                  ARCHIVED
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Capacity Quota: <strong>{pl.targetQuota} Cadets</strong> • Enrolled: <strong style={{ color: '#92400e' }}>{enrolledCount}</strong>
                            </div>
                          </div>

                          {/* Controls */}
                          {!isArchived && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {!isUnitArchived ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditEchelon('platoon', pl, selectedCoId)}
                                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 6px', color: '#334155', cursor: 'pointer' }}
                                    title={`Edit ${pl.name}`}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteEchelon('platoon', pl, selectedCoId)}
                                    disabled={checkingDeleteUnitId === pl.id}
                                    style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 6px', color: '#dc2626', cursor: checkingDeleteUnitId === pl.id ? 'wait' : 'pointer' }}
                                    title={`Archive / Safe Delete ${pl.name}`}
                                  >
                                    {checkingDeleteUnitId === pl.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreArchivedEchelon('platoon', pl, selectedCoId)}
                                  style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '4px 8px', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title={`Restore ${pl.name} to active roster`}
                                >
                                  <RotateCcw size={12} /> Restore
                                </button>
                              )}
                            </div>
                          )}
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
          TAB 2: BRANDING & PASSES
          ========================================================================= */}
      {activeTab === 'branding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          {/* Top Row (2 Columns): Unit Command Profile (Left) & QR Pass & Layout Setup (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
            {/* Unit Command Profile */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: 0 }}>
              <div className="card-header">
                <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                  <Landmark size={20} />
                  <span>Unit Command Profile</span>
                </div>
                <span className="badge badge-present">COMMAND PROFILE</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* 1. Commanding Officer / Commandant (Key: commandant) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    Commanding Officer / Commandant
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.commandant || settings.commandingOfficer || ''}
                    disabled={isArchived}
                    onChange={(e) => handleChange('commandant', e.target.value)}
                    placeholder="e.g. LTC CHRISTIAN B ABAMO INF (GSC) PA"
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.95rem',
                      backgroundColor: isArchived ? '#f1f5f9' : '#ffffff',
                      cursor: isArchived ? 'not-allowed' : 'auto'
                    }}
                  />
                </div>

                {/* 2. Unit (Key: unit_name) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.unit_name || settings.unitName || ''}
                    disabled={isArchived}
                    onChange={(e) => handleChange('unit_name', e.target.value)}
                    placeholder="e.g. 1501st CDC ROTC Unit"
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.95rem',
                      backgroundColor: isArchived ? '#f1f5f9' : '#ffffff',
                      cursor: isArchived ? 'not-allowed' : 'auto'
                    }}
                  />
                </div>

                {/* 3. School (Key: school_name) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    School
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.school_name || settings.hostInstitution || ''}
                    disabled={isArchived}
                    onChange={(e) => handleChange('school_name', e.target.value)}
                    placeholder="e.g. Caraga State University (CSU Main Campus, Ampayon, Butuan City)"
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.95rem',
                      backgroundColor: isArchived ? '#f1f5f9' : '#ffffff',
                      cursor: isArchived ? 'not-allowed' : 'auto'
                    }}
                  />
                </div>

                {/* 4. CDC (Key: cdc_name) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    CDC
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.cdc_name || ''}
                    disabled={isArchived}
                    onChange={(e) => handleChange('cdc_name', e.target.value)}
                    placeholder="e.g. 1501st Community Defense Center"
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.95rem',
                      backgroundColor: isArchived ? '#f1f5f9' : '#ffffff',
                      cursor: isArchived ? 'not-allowed' : 'auto'
                    }}
                  />
                </div>

                {/* 5. RCDG (Key: rcdg_name) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                    RCDG
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.rcdg_name || settings.parentCommand || ''}
                    disabled={isArchived}
                    onChange={(e) => handleChange('rcdg_name', e.target.value)}
                    placeholder="e.g. 15th Regional Community Defense Group (15RCDG)"
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.95rem',
                      backgroundColor: isArchived ? '#f1f5f9' : '#ffffff',
                      cursor: isArchived ? 'not-allowed' : 'auto'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* QR Pass & Layout Setup Panel */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: 0, justifyContent: 'space-between' }}>
              <div>
                <div className="card-header">
                  <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IdCard size={20} />
                    <span>QR Pass & Layout Setup</span>
                  </div>
                  <span className="badge badge-present">CR80 & PRINT CONFIG</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', padding: '0.5rem 0' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                      Print Orientation
                    </label>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.85rem 0' }}>
                      Configure the default physical sheet page orientation when generating or printing QR pass batches.
                    </p>
                    {/* Segmented Control Button Group (Zero Spacing, Joined Corners) */}
                    <div
                      className="flex gap-0 max-w-[500px] w-full rounded-xl shadow-xs"
                      style={{
                        display: 'flex',
                        gap: '0px',
                        maxWidth: '500px',
                        width: '100%'
                      }}
                    >
                      {/* Vertical (Portrait) Button */}
                      <button
                        type="button"
                        onClick={() => handleOrientationChange('portrait')}
                        disabled={isArchived}
                        className={`flex-1 py-3 px-4 rounded-l-xl rounded-r-none transition-all flex items-center justify-center gap-2 ${orientation === 'portrait'
                          ? 'border-2 border-[#004d25] bg-emerald-100 text-[#004d25] font-black z-10 shadow-xs'
                          : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-bold border-r-0'
                          }`}
                        style={{
                          flex: 1,
                          padding: '0.85rem 1rem',
                          borderTopLeftRadius: '12px',
                          borderBottomLeftRadius: '12px',
                          borderTopRightRadius: '0px',
                          borderBottomRightRadius: '0px',
                          border: orientation === 'portrait' ? '2px solid #004d25' : '1.5px solid #cbd5e1',
                          borderRight: orientation === 'portrait' ? '2px solid #004d25' : 'none',
                          backgroundColor: orientation === 'portrait' ? '#d1fae5' : '#ffffff',
                          color: orientation === 'portrait' ? '#004d25' : '#475569',
                          fontWeight: 900,
                          cursor: isArchived ? 'not-allowed' : 'pointer',
                          opacity: isArchived ? 0.65 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          position: 'relative',
                          zIndex: orientation === 'portrait' ? 2 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {orientation === 'portrait' && <Check size={18} color="#004d25" strokeWidth={3} />}
                        <span>Vertical (Portrait)</span>
                      </button>

                      {/* Horizontal (Landscape) Button */}
                      <button
                        type="button"
                        onClick={() => handleOrientationChange('landscape')}
                        disabled={isArchived}
                        className={`flex-1 py-3 px-4 rounded-r-xl rounded-l-none transition-all flex items-center justify-center gap-2 ${orientation === 'landscape'
                          ? 'border-2 border-[#004d25] bg-emerald-100 text-[#004d25] font-black z-10 shadow-xs'
                          : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-bold border-l-0'
                          }`}
                        style={{
                          flex: 1,
                          padding: '0.85rem 1rem',
                          borderTopRightRadius: '12px',
                          borderBottomRightRadius: '12px',
                          borderTopLeftRadius: '0px',
                          borderBottomLeftRadius: '0px',
                          border: orientation === 'landscape' ? '2px solid #004d25' : '1.5px solid #cbd5e1',
                          borderLeft: orientation === 'landscape' ? '2px solid #004d25' : 'none',
                          backgroundColor: orientation === 'landscape' ? '#d1fae5' : '#ffffff',
                          color: orientation === 'landscape' ? '#004d25' : '#475569',
                          fontWeight: 900,
                          cursor: isArchived ? 'not-allowed' : 'pointer',
                          opacity: isArchived ? 0.65 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          position: 'relative',
                          zIndex: orientation === 'landscape' ? 2 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {orientation === 'landscape' && <Check size={18} color="#004d25" strokeWidth={3} />}
                        <span>Horizontal (Landscape)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light)', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-dark)' }}>Card Format Specification</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--rotc-green-dark)', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                    ISO/IEC 7810 ID-1 • CR80
                  </span>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>
                  Standard CR80 (85.60 mm × 53.98 mm • 3.370" × 2.125")
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                  Calibrated for standard physical sheet printing (A4 / Letter) with 4 passes per row. Current sheet print orientation is set to <strong style={{ color: '#064e2e', textTransform: 'uppercase' }}>{orientation}</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row (Full Width - 12 Columns): Landing Page Hero Emblems & Logos */}
          <div className="card" style={{ width: '100%', overflow: 'hidden' }}>
            <input
              type="file"
              ref={dynamicEmblemFileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              disabled={isArchived}
              onChange={handleDynamicEmblemFileChange}
            />

            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div className="card-title" style={{ fontSize: '1.05rem', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={20} />
                <span>Landing Page Hero Emblems & Logos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetEmblemsToDefault}
                  disabled={isArchived}
                  style={{
                    fontSize: '0.72rem',
                    padding: '4px 8px',
                    color: isArchived ? '#94a3b8' : '#64748b',
                    cursor: isArchived ? 'not-allowed' : 'pointer',
                    opacity: isArchived ? 0.6 : 1
                  }}
                  title={isArchived ? "🔒 Locked for archived terms" : "Reset to 5 official default seals"}
                >
                  <RefreshCw size={11} style={{ marginRight: '4px' }} />
                  Reset Defaults
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleAddEmblemSlot}
                  disabled={isArchived}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    background: isArchived ? '#94a3b8' : '#064e2e',
                    borderColor: isArchived ? '#cbd5e1' : '#064e2e',
                    color: '#ffffff',
                    cursor: isArchived ? 'not-allowed' : 'pointer',
                    opacity: isArchived ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title={isArchived ? "🔒 Locked for archived terms" : "Add Emblem Slot"}
                >
                  <Plus size={14} />
                  <span>Add Emblem Slot</span>
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
              Drag and drop cards to reorder the hero banner sequence from left to right. Hover over an emblem to view its title, or click the edit icon to change its image and label.
            </p>

            {/* 5-Column Drag-and-Drop Sequence Container */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max((settings.hero_emblems || DEFAULT_SETTINGS.hero_emblems).length, 5)}, minmax(140px, 1fr))`,
                gap: '1rem',
                overflowX: 'auto',
                padding: '0.5rem 0.25rem 1.25rem 0.25rem'
              }}
            >
              {(settings.hero_emblems || DEFAULT_SETTINGS.hero_emblems).map((emblem, index) => {
                const isDragging = draggedEmblemIndex === index;
                const isDragOver = dragOverEmblemIndex === index;
                const isHovered = hoveredEmblemId === emblem.id;

                return (
                  <div
                    key={emblem.id || `emblem-${index}`}
                    draggable={!isArchived}
                    onDragStart={(e) => {
                      if (isArchived) return;
                      setDraggedEmblemIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      if (isArchived) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverEmblemIndex !== index) setDragOverEmblemIndex(index);
                    }}
                    onDragLeave={() => {
                      if (dragOverEmblemIndex === index) setDragOverEmblemIndex(null);
                    }}
                    onDrop={(e) => {
                      if (isArchived) return;
                      e.preventDefault();
                      if (draggedEmblemIndex !== null && draggedEmblemIndex !== index) {
                        handleReorderEmblems(draggedEmblemIndex, index);
                      }
                      setDraggedEmblemIndex(null);
                      setDragOverEmblemIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedEmblemIndex(null);
                      setDragOverEmblemIndex(null);
                    }}
                    style={{
                      padding: '0.75rem',
                      background: isDragOver ? '#f0fdf4' : '#ffffff',
                      borderRadius: '14px',
                      border: isDragOver ? '2px dashed #059669' : '1.5px solid var(--border-light)',
                      boxShadow: isDragOver ? '0 4px 16px rgba(5, 150, 105, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      minHeight: '145px',
                      opacity: isDragging ? 0.35 : 1,
                      cursor: isArchived ? 'default' : 'grab',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Top Action Row: Drag Handle (Left) & Action Icons Edit / Delete (Right) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.4rem', minHeight: '22px' }}>
                      {!isArchived ? (
                        <>
                          <div
                            title="Drag card to reorder position"
                            style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', cursor: 'grab', padding: '2px' }}
                          >
                            <GripVertical size={16} />
                          </div>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEmblem({ ...emblem });
                              }}
                              title={`Edit ${emblem.label || 'Emblem'}`}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#475569',
                                borderRadius: '6px',
                                padding: '3px 6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.color = '#059669'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; }}
                            >
                              <Pencil size={12} />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEmblem(emblem.id);
                              }}
                              title="Delete Emblem Slot"
                              style={{
                                border: '1px solid #fecaca',
                                background: '#ffffff',
                                color: '#dc2626',
                                borderRadius: '6px',
                                padding: '3px 6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.5px' }}>
                          POSITION #{index + 1}
                        </div>
                      )}
                    </div>

                    {/* Card Surface: Image-Only with Hover Tooltip */}
                    <div
                      onMouseEnter={() => setHoveredEmblemId(emblem.id)}
                      onMouseLeave={() => setHoveredEmblemId(null)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        width: '100%',
                        padding: '0.4rem 0'
                      }}
                    >
                      <div
                        style={{
                          width: '82px',
                          height: '82px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          padding: '4px',
                          border: '1.5px solid #cbd5e1',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          transform: isHovered ? 'scale(1.08)' : 'scale(1)'
                        }}
                      >
                        <img
                          src={emblem.url || '/rotc-seal-transparent.png'}
                          alt={emblem.label}
                          title={emblem.label}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                          onError={(e) => { e.target.src = '/rotc-seal-transparent.png'; }}
                        />
                      </div>

                      {/* Floating Tooltip displaying Emblem Title / Name on Hover */}
                      {isHovered && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '-14px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                            pointerEvents: 'none',
                            zIndex: 50,
                            letterSpacing: '0.2px'
                          }}
                        >
                          {emblem.label || 'Emblem Seal'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit Emblem Modal */}
          {editingEmblem && !isArchived && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem'
              }}
              onClick={() => setEditingEmblem(null)}
            >
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '440px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                  border: '1.5px solid #cbd5e1',
                  overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ImageIcon size={18} color="#064e2e" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      Edit Hero Emblem
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingEmblem(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Emblem Image Preview & Replace */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '96px',
                        height: '96px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        padding: '6px',
                        border: '2px solid #cbd5e1',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <img
                        src={editingEmblem.url || '/rotc-seal-transparent.png'}
                        alt={editingEmblem.label}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                        onError={(e) => { e.target.src = '/rotc-seal-transparent.png'; }}
                      />
                    </div>

                    <input
                      type="file"
                      ref={modalFileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setModalUploadLoading(true);
                        try {
                          const uploadedUrl = await uploadBrandingAsset(file, editingEmblem.label || 'Emblem');
                          if (uploadedUrl) {
                            setEditingEmblem(prev => ({ ...prev, url: uploadedUrl }));
                          }
                        } catch (err) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setEditingEmblem(prev => ({ ...prev, url: ev.target.result }));
                          };
                          reader.readAsDataURL(file);
                        } finally {
                          setModalUploadLoading(false);
                          if (modalFileInputRef.current) modalFileInputRef.current.value = '';
                        }
                      }}
                    />

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={modalUploadLoading}
                      onClick={() => modalFileInputRef.current?.click()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem' }}
                    >
                      {modalUploadLoading ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                      <span>{modalUploadLoading ? 'Uploading...' : 'Upload / Replace Image'}</span>
                    </button>
                  </div>

                  {/* Emblem Label Input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Emblem Title / Label
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingEmblem.label || ''}
                      onChange={(e) => setEditingEmblem(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g. 15th RCDG Seal"
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 600 }}
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingEmblem(null)}
                    style={{ padding: '6px 14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSettings(prev => {
                        const list = prev.hero_emblems || DEFAULT_SETTINGS.hero_emblems;
                        const updated = list.map(item => item.id === editingEmblem.id ? { ...item, label: editingEmblem.label, url: editingEmblem.url } : item);
                        return { ...prev, hero_emblems: updated, heroEmblems: updated };
                      });
                      setEditingEmblem(null);
                      setSaveSuccessToast('Emblem details updated! Click "SAVE ALL" to commit.');
                      setTimeout(() => setSaveSuccessToast(null), 3000);
                    }}
                    style={{ padding: '6px 16px', background: '#064e2e', borderColor: '#064e2e', fontWeight: 700 }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: ACADEMIC TERMS (PER SEM) — Strictly Supabase Synced
          ========================================================================= */}
      {activeTab === 'terms' && <AcademicTermsTab />}

      {/* =========================================================================
          TAB 3: DATA MANAGEMENT & EXPORTS
          ========================================================================= */}
      {activeTab === 'storage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>

          {/* Top 2-Column Equal-Width Row (50% / 50% Stretched on Desktop) */}
          <div
            className="storage-grid-container"
            style={{
              display: 'grid',
              gap: '1.75rem',
              width: '100%',
              alignItems: 'stretch'
            }}
          >
            {/* 1. Data Directories & Backups Card */}
            <div
              className="card"
              style={{
                backgroundColor: 'rgba(248, 250, 252, 0.85)',
                border: '1.5px solid #cbd5e1',
                borderRadius: '16px',
                padding: '2rem',
                margin: 0,
                boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.5rem',
                width: '100%'
              }}
            >
              <div>
                <div className="card-header" style={{ marginBottom: '1.25rem', paddingBottom: '0.85rem' }}>
                  <div className="card-title" style={{ fontSize: '1.1rem', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={22} color="var(--rotc-green-dark)" />
                    <span>Data Directories & Backups</span>
                  </div>
                  <span className="badge badge-present" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>STORAGE ENGINE</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.45rem' }}>
                      Excel Export Directory
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.exportDirectory}
                      disabled={isArchived}
                      onChange={(e) => handleChange('exportDirectory', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.95rem',
                        background: isArchived ? '#f1f5f9' : '#ffffff',
                        cursor: isArchived ? 'not-allowed' : 'text',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                      }}
                      placeholder="e.g., C:/Users/.../Desktop/ROTC ATTENDANCE/EXPORTS"
                    />
                    {isArchived ? (
                      <span style={{ fontSize: '0.76rem', color: '#b45309', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        <Lock size={12} /> Directory settings locked during historical review to prevent path tampering.
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                        Designated local storage path where periodic master and platoon <code>.xlsx</code> attendance reports are saved.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* JSON Backup & Restore Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDownloadBackup}
                  title="Download JSON backup snapshot for this academic term"
                  style={{
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                    width: '100%'
                  }}
                >
                  <Download size={17} />
                  <span>Download Backup JSON {isArchived ? '(Archived)' : ''}</span>
                </button>

                <input
                  type="file"
                  ref={backupFileInputRef}
                  accept=".json"
                  style={{ display: 'none' }}
                  disabled={isArchived}
                  onChange={handleRestoreBackup}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isArchived}
                  onClick={() => !isArchived && backupFileInputRef.current?.click()}
                  title={isArchived ? "🔒 Restoring from backup is strictly disabled for archived terms" : "Restore system data from backup JSON"}
                  style={{
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                    width: '100%',
                    opacity: isArchived ? 0.5 : 1,
                    cursor: isArchived ? 'not-allowed' : 'pointer',
                    background: isArchived ? '#f1f5f9' : undefined
                  }}
                >
                  {isArchived ? <Lock size={16} /> : <Upload size={17} />}
                  <span>{isArchived ? '🔒 Restore Disabled (Archived Term)' : 'Restore from Backup'}</span>
                </button>
              </div>
            </div>

            {/* 2. Official Excel Report Letterhead & Signatories Card */}
            <div
              className="card"
              style={{
                backgroundColor: 'rgba(248, 250, 252, 0.85)',
                border: '1.5px solid #cbd5e1',
                borderRadius: '16px',
                padding: '2rem',
                margin: 0,
                boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.5rem',
                width: '100%'
              }}
            >
              <div>
                <div className="card-header" style={{ marginBottom: '1.25rem', paddingBottom: '0.85rem' }}>
                  <div className="card-title" style={{ fontSize: '1.1rem', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileSpreadsheet size={22} color="var(--rotc-green-dark)" />
                    <span>Official Excel Report Letterhead & Signatories</span>
                  </div>
                  <span className="badge badge-present" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>EXCEL LETTERHEAD</span>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--rotc-green-dark)' }}>
                    Military Form Header Template
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
                    Configure the official military letterhead text (Motto, Headquarters, Parent Command, Unit Name, Location, and Commandant / Signatory titles) automatically printed on every <code>[Company] - [Platoon]</code> sheet when saving attendance to Excel.
                  </p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => setIsLetterheadModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 800,
                    padding: '0.85rem 1.5rem',
                    fontSize: '0.9rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxShadow: '0 2px 8px rgba(229, 169, 0, 0.25)'
                  }}
                >
                  {isArchived ? <Lock size={18} /> : <Settings size={18} />}
                  <span>{isArchived ? 'View Letterhead & Signatories (Read-Only Preview)' : 'Open Letterhead & Signatories Editor'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Database & Cloud Roster Maintenance (Full Width) */}
          <div
            className="card"
            style={{
              border: isArchived ? '1.5px solid #cbd5e1' : '1.5px solid #fca5a5',
              background: isArchived ? '#f8fafc' : '#fffafb',
              borderRadius: '16px',
              padding: '2rem',
              margin: 0,
              boxShadow: '0 4px 16px -2px rgba(220, 38, 38, 0.06)',
              width: '100%'
            }}
          >
            <div className="card-header" style={{ marginBottom: '1.25rem', paddingBottom: '0.85rem', borderColor: isArchived ? '#e2e8f0' : '#fecaca' }}>
              <div className="card-title" style={{ color: isArchived ? '#475569' : '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                <Trash2 size={22} color={isArchived ? '#64748b' : '#dc2626'} />
                <span>Database & Cloud Roster Maintenance</span>
              </div>
              {isArchived ? (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  🔒 PURGING LOCKED (ARCHIVED)
                </span>
              ) : (
                <span className="badge badge-absent" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>ADMIN PURGE</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: isArchived ? '#92400e' : '#7f1d1d', margin: 0, lineHeight: 1.55 }}>
                {isArchived ? (
                  <span>
                    🔒 <strong>Archived Academic Term:</strong> Database purges are strictly disabled while inspecting historical terms to preserve data integrity and historical attendance records.
                  </span>
                ) : (
                  <span>
                    Manage or wipe database records stored in Supabase and local browser cache strictly matching <strong>academic_term_id = {currentTermId ? `${currentTermId} (${selectedTerm ? `${selectedTerm.academicYear} • ${selectedTerm.semester}` : 'Active Term'})` : 'selectedTermId'}</strong>.
                  </span>
                )}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {/* Clear Cadets */}
                <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: isArchived ? '1px solid #cbd5e1' : '1px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: isArchived ? '#475569' : '#991b1b', marginBottom: '4px' }}>
                      Clear Cadets Directory
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      Deletes registered cadets strictly matching <code>academic_term_id = {currentTermId || 'selectedTermId'}</code> from Supabase <code>cadets</code> table and clears local cache.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleClearCadetsFromApp}
                    disabled={isArchived || isClearingCadets}
                    title={isArchived ? "🔒 Purging cadets is strictly disabled for archived terms" : "Delete cadets for selected term"}
                    style={{
                      background: isArchived ? '#94a3b8' : '#ef4444',
                      color: '#ffffff',
                      fontWeight: 800,
                      borderRadius: '8px',
                      padding: '0.7rem 1rem',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      border: 'none',
                      width: '100%',
                      opacity: isArchived ? 0.6 : 1,
                      cursor: (isArchived || isClearingCadets) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isArchived ? <Lock size={16} /> : <Trash2 size={16} />}
                    <span>{isArchived ? '🔒 Purge Disabled (Archived Term)' : isClearingCadets ? 'Clearing Cadets...' : 'Clear All Cadets in Supabase & Local'}</span>
                  </button>
                </div>

                {/* Clear Attendance */}
                <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: isArchived ? '1px solid #cbd5e1' : '1px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: isArchived ? '#475569' : '#991b1b', marginBottom: '4px' }}>
                      Clear Attendance Logs
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      Deletes scan history strictly matching <code>academic_term_id = {currentTermId || 'selectedTermId'}</code> from Supabase <code>attendance_logs</code> table and clears local records.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleClearAttendanceFromApp}
                    disabled={isArchived || isClearingAttendance}
                    title={isArchived ? "🔒 Purging attendance is strictly disabled for archived terms" : "Delete attendance for selected term"}
                    style={{
                      background: isArchived ? '#94a3b8' : '#b91c1c',
                      color: '#ffffff',
                      fontWeight: 800,
                      borderRadius: '8px',
                      padding: '0.7rem 1rem',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      border: 'none',
                      width: '100%',
                      opacity: isArchived ? 0.6 : 1,
                      cursor: (isArchived || isClearingAttendance) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isArchived ? <Lock size={16} /> : <Trash2 size={16} />}
                    <span>{isArchived ? '🔒 Purge Disabled (Archived Term)' : isClearingAttendance ? 'Clearing Logs...' : 'Clear All Attendance in Supabase & Local'}</span>
                  </button>
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
          REASSIGN CADETS FIRST (DELETION BLOCKED) MODAL
          ========================================================================= */}
      {isReassignCadetsModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 850,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '540px',
            padding: '2rem',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
            border: '2px solid #ef4444'
          }}>
            {/* Header: DELETION BLOCKED */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1.5px solid #fca5a5'
              }}>
                <ShieldAlert size={30} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    background: '#dc2626',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    DELETION BLOCKED
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700 }}>
                    INTEGRITY ENFORCEMENT
                  </span>
                </div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.02em' }}>
                  REASSIGN CADETS FIRST
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isReassigningAndDeleting && setIsReassignCadetsModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isReassigningAndDeleting ? 'not-allowed' : 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Explanation Warning Banner */}
            <div style={{
              background: '#fff1f2',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid #fecdd3',
              marginBottom: '1.25rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#9f1239', lineHeight: 1.5 }}>
                Deletion of <strong>{reassignModalConfig.item?.name}</strong> is blocked because active cadets are currently assigned to it. To prevent orphaned cadets and broken attendance records, reassign all affected cadets to an active destination unit before deletion.
              </p>
            </div>

            {/* Prominent Active Cadet Count Stat Box */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '1.25rem',
              marginBottom: '1.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(15, 23, 42, 0.25)'
            }}>
              <div>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 800 }}>
                  TOTAL ACTIVE CADETS ASSIGNED
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1.1, marginTop: '2px', fontFamily: 'Oswald, sans-serif' }}>
                  {reassignModalConfig.cadetCount} <span style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: 600 }}>Cadet{reassignModalConfig.cadetCount === 1 ? '' : 's'}</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
                  Current Unit: <strong>{reassignModalConfig.item?.name}</strong> ({reassignModalConfig.level.toUpperCase()})
                </div>
              </div>

              {reassignModalConfig.logCount > 0 && (
                <div style={{ textAlign: 'right', borderLeft: '1px solid #334155', paddingLeft: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>ATTENDANCE LOGS</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8' }}>{reassignModalConfig.logCount}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>will be preserved</div>
                </div>
              )}
            </div>

            {/* Sample Affected Cadets Chips */}
            {reassignModalConfig.sampleCadets && reassignModalConfig.sampleCadets.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Sample Affected Cadets to be Transferred:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {reassignModalConfig.sampleCadets.map((c, i) => (
                    <span key={c.id || i} style={{
                      fontSize: '0.72rem',
                      background: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 600
                    }}>
                      {c.name} {c.rank ? `(${c.rank})` : ''}
                    </span>
                  ))}
                  {reassignModalConfig.cadetCount > (reassignModalConfig.sampleCadets.length) && (
                    <span style={{ fontSize: '0.72rem', color: '#64748b', alignSelf: 'center', fontWeight: 700 }}>
                      + {reassignModalConfig.cadetCount - reassignModalConfig.sampleCadets.length} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Destination Unit Dropdown Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.84rem',
                fontWeight: 800,
                color: '#0f172a',
                marginBottom: '0.45rem'
              }}>
                SELECT DESTINATION UNIT <span style={{ color: '#ef4444' }}>*</span>
              </label>

              {reassignModalConfig.level === 'battalion' && (
                <select
                  value={reassignTargetUnit.id}
                  onChange={(e) => {
                    const targetBn = currentStructure.find(b => b.id === e.target.value);
                    const firstCo = (targetBn?.companies || []).find(c => !c.is_archived);
                    const firstPl = (firstCo?.platoons || []).find(p => !p.is_archived);
                    setReassignTargetUnit({
                      id: targetBn?.id || '',
                      name: targetBn?.name || '',
                      battalionName: targetBn?.name || '',
                      companyName: firstCo?.name || '',
                      platoonName: firstPl?.name || '',
                      defaultCompanyName: firstCo?.name || '',
                      defaultPlatoonName: firstPl?.name || ''
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid #2563eb',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    backgroundColor: '#f8fafc',
                    color: '#0f172a'
                  }}
                >
                  {currentStructure.filter(b => b.id !== reassignModalConfig.item?.id && !b.is_archived).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.shortCode || 'BN'})
                    </option>
                  ))}
                </select>
              )}

              {reassignModalConfig.level === 'company' && (() => {
                const allCos = [];
                (currentStructure || []).forEach(bn => {
                  if (bn.is_archived) return;
                  (bn.companies || []).forEach(co => {
                    if (co.is_archived || co.id === reassignModalConfig.item?.id) return;
                    const bnNumMatch = String(bn.name || '').match(/\d+/);
                    const bnCode = bn.shortCode || (bnNumMatch ? `${bnNumMatch[0]}BN` : 'BN');
                    allCos.push({
                      id: co.id,
                      name: co.name,
                      companyId: co.id,
                      companyName: co.name,
                      battalionId: bn.id,
                      battalionName: bn.name,
                      platoons: co.platoons || [],
                      label: `[${bnCode}] ${co.name} (${(co.platoons || []).filter(p => !p.is_archived).length} Platoons)`
                    });
                  });
                });
                return (
                  <select
                    value={reassignTargetUnit.companyId || reassignTargetUnit.id}
                    onChange={(e) => {
                      const targetCo = allCos.find(c => c.id === e.target.value);
                      const firstPl = (targetCo?.platoons || []).find(p => !p.is_archived);
                      setReassignTargetUnit({
                        id: targetCo?.id || '',
                        name: targetCo?.name || '',
                        companyId: targetCo?.id || '',
                        companyName: targetCo?.name || '',
                        battalionId: targetCo?.battalionId || '',
                        battalionName: targetCo?.battalionName || '',
                        platoonId: firstPl?.id || '',
                        platoonName: firstPl?.name || '',
                        defaultPlatoonName: firstPl?.name || '',
                        defaultPlatoonId: firstPl?.id || ''
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '8px',
                      border: '1.5px solid #059669',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      color: '#0f172a'
                    }}
                  >
                    {allCos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                );
              })()}

              {reassignModalConfig.level === 'platoon' && (
                <div>
                  <select
                    value={reassignTargetUnit.platoonId || reassignTargetUnit.id}
                    onChange={(e) => {
                      const targetPl = allActivePlatoonsSystemWide.find(p => (p.platoonId || p.id) === e.target.value);
                      if (targetPl) {
                        setReassignTargetUnit({
                          id: targetPl.platoonId,
                          name: targetPl.platoonName,
                          platoonId: targetPl.platoonId,
                          platoonName: targetPl.platoonName,
                          companyId: targetPl.companyId,
                          companyName: targetPl.companyName,
                          battalionId: targetPl.battalionId,
                          battalionName: targetPl.battalionName
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '8px',
                      border: '1.5px solid #2563eb',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      color: '#0f172a'
                    }}
                  >
                    {allActivePlatoonsSystemWide.map(p => (
                      <option
                        key={p.platoonId}
                        value={p.platoonId}
                        disabled={p.isFull}
                        style={{ color: p.isFull ? '#94a3b8' : '#0f172a', fontWeight: p.isFull ? 400 : 600 }}
                      >
                        {p.label}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.74rem' }}>
                    <span style={{ color: '#64748b' }}>
                      Target: <strong>{reassignTargetUnit.battalionName} → {reassignTargetUnit.companyName} → {reassignTargetUnit.platoonName}</strong>
                    </span>
                    <span style={{ color: '#2563eb', fontWeight: 700 }}>
                      {allActivePlatoonsSystemWide.filter(p => !p.isFull).length} of {allActivePlatoonsSystemWide.length} Platoons with open capacity
                    </span>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                All {reassignModalConfig.cadetCount} cadets will be updated in Supabase to target unit: <strong>{reassignTargetUnit.name || 'Selected Destination'}</strong> before original unit is deleted/archived.
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsReassignCadetsModalOpen(false)}
                disabled={isReassigningAndDeleting}
                style={{ padding: '0.75rem', fontWeight: 700 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReassignAndDelete}
                disabled={isReassigningAndDeleting || !reassignTargetUnit.name}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: (isReassigningAndDeleting || !reassignTargetUnit.name) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  opacity: (isReassigningAndDeleting || !reassignTargetUnit.name) ? 0.7 : 1
                }}
              >
                {isReassigningAndDeleting ? (
                  <>
                    <RefreshCw size={17} className="animate-spin" />
                    <span>Reassigning & Deleting...</span>
                  </>
                ) : (
                  <>
                    <Archive size={17} />
                    <span>Reassign ({reassignModalConfig.cadetCount}) & Delete</span>
                  </>
                )}
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
        readOnly={isArchived}
        onClose={() => setIsLetterheadModalOpen(false)}
        onSaved={() => {
          setSaveSuccessToast("Excel letterhead configuration updated successfully.");
          setTimeout(() => setSaveSuccessToast(null), 3500);
        }}
      />
    </div>
  );
}
